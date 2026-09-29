from datetime import datetime, timedelta, timezone
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.core.database import SessionLocal
from app.core.deps import get_db, get_current_user, get_current_officer, get_current_active_user
from app.models.user import User, UserRole
from app.models.business_profile import BusinessProfile
from app.models.application import (
    Application,
    ApplicationStatus,
    ApplicationApproval,
    ApprovalWorkflowStatus,
    Department,
    Inspection,
    InspectionStatus,
    ApplicationStatusHistory,
    SLAStatus,
)
from app.schemas.application import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationSummaryRead,
    ApplicationApprovalRead,
    ApprovalStatusUpdateInput,
    QueryResponseInput,
    InspectionCreateInput,
    InspectionCompleteInput,
    InspectionRead,
    TimelineEventRead,
    DepartmentRead,
    DepartmentCreate,
    BusinessProfileSummary,
    OfficerMetricsResponse,
    ApplicantMetricsResponse,
)
from app.services.application_service import (
    generate_application_number,
    resolve_department_for_approval,
    check_if_inspection_required,
    calculate_sla_metrics,
    calculate_aggregated_application_sla,
    calculate_aggregated_application_status,
    log_timeline_event,
)
from app.services.fssai_service import sync_all_fssai_applications
from app.services.udyam_service import sync_all_udyam_applications
from app.services.gst_service import sync_all_gst_applications

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Applications & Workflows"])



# --------------------------------------------------------------------------
# Departments API
# --------------------------------------------------------------------------
@router.get("/departments", response_model=List[DepartmentRead])
def list_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lists all configured industrial clearance regulatory departments."""
    return db.query(Department).filter(Department.is_active == True).order_by(Department.name).all()


@router.post("/departments", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_officer),
):
    """Admin/Officer endpoint to register a new department authority."""
    existing = db.query(Department).filter(Department.code == dept_in.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Department with code '{dept_in.code}' already exists.")
    
    dept = Department(
        code=dept_in.code.upper(),
        name=dept_in.name,
        description=dept_in.description,
        contact_email=dept_in.contact_email,
        sla_days=dept_in.sla_days,
        is_active=dept_in.is_active,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


# --------------------------------------------------------------------------
# Dashboard Metrics APIs (Phase 6)
# --------------------------------------------------------------------------
@router.get("/officer/metrics", response_model=OfficerMetricsResponse)
def get_officer_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_officer),
):
    """
    Computes real-time regulatory desk metrics for the Officer Dashboard:
    - total applications
    - pending
    - approaching SLA
    - at risk SLA
    - overdue SLA
    - inspection pending
    - scheduled inspections list
    """
    apps = db.query(Application).options(
        joinedload(Application.business_profile),
        joinedload(Application.approvals).joinedload(ApplicationApproval.department),
        joinedload(Application.approvals).joinedload(ApplicationApproval.inspections),
    ).all()

    total_apps = len(apps)
    pending_count = 0
    approaching_sla_count = 0
    at_risk_sla_count = 0
    overdue_count = 0
    inspection_pending_count = 0

    for app in apps:
        if app.status in [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.NEEDS_INFORMATION]:
            pending_count += 1

        _, _, app_sla, _ = calculate_aggregated_application_sla(app)
        if app_sla == SLAStatus.OVERDUE:
            overdue_count += 1
        elif app_sla == SLAStatus.AT_RISK:
            at_risk_sla_count += 1
        elif app_sla == SLAStatus.APPROACHING:
            approaching_sla_count += 1

        for appr in app.approvals:
            if appr.status == ApprovalWorkflowStatus.INSPECTION_PENDING:
                inspection_pending_count += 1

    # Fetch active/scheduled inspections
    inspections = db.query(Inspection).options(
        joinedload(Inspection.department),
        joinedload(Inspection.application_approval).joinedload(ApplicationApproval.application).joinedload(Application.business_profile),
    ).filter(Inspection.status == InspectionStatus.SCHEDULED).order_by(Inspection.scheduled_date.asc()).all()

    formatted_inspections = [_format_inspection_read(i) for i in inspections]

    return OfficerMetricsResponse(
        total_applications=total_apps,
        pending_count=pending_count,
        approaching_sla_count=approaching_sla_count,
        at_risk_sla_count=at_risk_sla_count,
        overdue_count=overdue_count,
        inspection_pending_count=inspection_pending_count,
        active_inspections=formatted_inspections,
    )


@router.get("/applicant/metrics", response_model=ApplicantMetricsResponse)
async def get_applicant_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Computes enterprise dashboard metrics for Applicant:
    - approval progress
    - expected completion date
    - current overall SLA status
    - upcoming inspection schedules
    """
    try:
        await sync_all_fssai_applications(db, current_user)
        await sync_all_udyam_applications(db, current_user)
        await sync_all_gst_applications(db, current_user)
    except Exception as e:
        logger.warning(f"Background FSSAI/Udyam/GST auto-sync notice in metrics: {e}")


    apps = db.query(Application).options(
        joinedload(Application.business_profile),
        joinedload(Application.approvals).joinedload(ApplicationApproval.department),
        joinedload(Application.approvals).joinedload(ApplicationApproval.inspections),
    ).filter(Application.applicant_id == current_user.id).all()

    total_apps = len(apps)
    total_approvals = 0
    approved_approvals = 0
    sla_statuses = []
    expected_dates = []
    days_remaining_list = []

    for app in apps:
        for appr in app.approvals:
            total_approvals += 1
            if appr.status == ApprovalWorkflowStatus.APPROVED:
                approved_approvals += 1

        _, rem, st, exp_date = calculate_aggregated_application_sla(app)
        sla_statuses.append(st)
        if exp_date:
            expected_dates.append(exp_date)
        if st != SLAStatus.COMPLETED:
            days_remaining_list.append(rem)

    if SLAStatus.OVERDUE in sla_statuses:
        overall_sla = SLAStatus.OVERDUE
    elif SLAStatus.AT_RISK in sla_statuses:
        overall_sla = SLAStatus.AT_RISK
    elif SLAStatus.APPROACHING in sla_statuses:
        overall_sla = SLAStatus.APPROACHING
    elif total_apps > 0 and all(s == SLAStatus.COMPLETED for s in sla_statuses):
        overall_sla = SLAStatus.COMPLETED
    else:
        overall_sla = SLAStatus.ON_TRACK

    min_rem = min(days_remaining_list) if days_remaining_list else 0
    earliest_exp = min(expected_dates) if expected_dates else None

    # Fetch upcoming inspections for this applicant
    applicant_app_ids = [a.id for a in apps]
    inspections = db.query(Inspection).options(
        joinedload(Inspection.department),
        joinedload(Inspection.application_approval).joinedload(ApplicationApproval.application).joinedload(Application.business_profile),
    ).filter(
        Inspection.status == InspectionStatus.SCHEDULED,
        Inspection.application_approval_id.in_(
            [ap.id for a in apps for ap in a.approvals]
        ) if apps else False
    ).order_by(Inspection.scheduled_date.asc()).all()

    formatted_inspections = [_format_inspection_read(i) for i in inspections]

    return ApplicantMetricsResponse(
        total_applications=total_apps,
        overall_sla_status=overall_sla,
        expected_completion=earliest_exp,
        days_remaining=min_rem,
        approved_approvals=approved_approvals,
        total_approvals=total_approvals,
        upcoming_inspections=formatted_inspections,
    )


# --------------------------------------------------------------------------
# Applications API
# --------------------------------------------------------------------------
@router.post("/applications", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
def create_application(
    app_in: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Creates a new multi-approval clearance application.
    - Resolves business profile for the applicant
    - Maps each requested approval to the responsible department
    - Initializes departmental approval sub-workflows with SLA deadlines
    - Computes inspection_required and expected_completion_date
    """
    # 1. Resolve business profile
    if app_in.business_profile_id:
        profile = db.query(BusinessProfile).filter(
            BusinessProfile.id == app_in.business_profile_id,
            BusinessProfile.user_id == current_user.id
        ).first()
    else:
        profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Active Business Profile required before filing an industrial clearance application. Please complete your profile first."
        )

    # 2. Generate Application Number
    app_number = generate_application_number(db)
    now = datetime.now(timezone.utc)
    initial_status = ApplicationStatus.SUBMITTED if app_in.submit_immediately else ApplicationStatus.DRAFT

    application = Application(
        application_number=app_number,
        applicant_id=current_user.id,
        business_profile_id=profile.id,
        status=initial_status,
        project_title=app_in.project_title or f"Clearance Package for {profile.company_name}",
        notes=app_in.notes,
        declaration_accepted=app_in.declaration_accepted,
        submitted_at=now if app_in.submit_immediately else None,
    )
    db.add(application)
    db.flush()

    # 3. Create Departmental Approvals
    initial_approval_status = ApprovalWorkflowStatus.PENDING if app_in.submit_immediately else ApprovalWorkflowStatus.PENDING
    max_completion_date = now

    for app_item in app_in.approvals:
        dept = resolve_department_for_approval(
            db=db,
            approval_id=app_item.approval_id,
            approval_name=app_item.approval_name,
            dept_code_hint=app_item.department_code
        )
        sla_days = app_item.custom_sla_days if app_item.custom_sla_days is not None else dept.sla_days
        
        # Check simulated days remaining override for testing AT_RISK/OVERDUE
        if app_in.simulated_days_remaining is not None:
            sla_due = now + timedelta(days=app_in.simulated_days_remaining)
        else:
            sla_due = now + timedelta(days=sla_days) if app_in.submit_immediately else None

        if sla_due and sla_due > max_completion_date:
            max_completion_date = sla_due

        insp_req = check_if_inspection_required(app_item.approval_id, app_item.approval_name)

        approval_record = ApplicationApproval(
            application_id=application.id,
            approval_id=app_item.approval_id,
            approval_name=app_item.approval_name,
            department_id=dept.id,
            status=initial_approval_status,
            submitted_at=now if app_in.submit_immediately else None,
            sla_due_date=sla_due,
            expected_completion_date=sla_due,
            inspection_required=insp_req,
        )
        db.add(approval_record)

    application.expected_completion_date = max_completion_date if app_in.submit_immediately else None
    db.flush()

    # 4. Log initial timeline event
    log_timeline_event(
        db=db,
        application_id=application.id,
        new_status=initial_status.value,
        old_status=None,
        changed_by_user=current_user,
        remarks=f"Clearance application initialized with {len(app_in.approvals)} statutory clearance(s)."
    )

    db.commit()
    db.refresh(application)

    return _format_application_response(db, application)


@router.get("/applications", response_model=List[ApplicationSummaryRead])
async def list_applications(
    status_filter: Optional[ApplicationStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Lists applications with summary counts and SLA indicators.
    """
    try:
        await sync_all_fssai_applications(db, current_user if current_user.role == UserRole.APPLICANT else None)
        await sync_all_udyam_applications(db, current_user if current_user.role == UserRole.APPLICANT else None)
        await sync_all_gst_applications(db, current_user if current_user.role == UserRole.APPLICANT else None)
    except Exception as e:
        logger.warning(f"Background FSSAI/Udyam/GST auto-sync notice in list_applications: {e}")

    query = db.query(Application).options(
        joinedload(Application.business_profile),
        joinedload(Application.approvals).joinedload(ApplicationApproval.department),
        joinedload(Application.approvals).joinedload(ApplicationApproval.inspections),
    )

    if current_user.role == UserRole.APPLICANT:
        query = query.filter(Application.applicant_id == current_user.id)

    if status_filter:
        query = query.filter(Application.status == status_filter)

    applications = query.order_by(Application.created_at.desc()).all()

    summaries = []
    for app in applications:
        approved_cnt = sum(1 for a in app.approvals if a.status == ApprovalWorkflowStatus.APPROVED)
        pending_cnt = sum(1 for a in app.approvals if a.status in [ApprovalWorkflowStatus.PENDING, ApprovalWorkflowStatus.UNDER_REVIEW])
        query_cnt = sum(1 for a in app.approvals if a.status == ApprovalWorkflowStatus.DOCUMENT_QUERY)
        insp_pending_cnt = sum(1 for a in app.approvals if a.status == ApprovalWorkflowStatus.INSPECTION_PENDING)

        _, days_rem, sla_st, exp_date = calculate_aggregated_application_sla(app)

        summaries.append(
            ApplicationSummaryRead(
                id=app.id,
                application_number=app.application_number,
                applicant_id=app.applicant_id,
                company_name=app.business_profile.company_name if app.business_profile else None,
                industry=app.business_profile.industry if app.business_profile else None,
                district=app.business_profile.district if app.business_profile else None,
                status=app.status,
                sla_status=sla_st,
                expected_completion_date=exp_date,
                days_remaining=days_rem,
                total_approvals=len(app.approvals),
                approved_count=approved_cnt,
                pending_count=pending_cnt,
                query_count=query_cnt,
                inspection_pending_count=insp_pending_cnt,
                submitted_at=app.submitted_at,
                created_at=app.created_at,
                fssai_application_number=app.fssai_application_number,
                fssai_status=app.fssai_status,
                udyam_application_number=app.udyam_application_number,
                udyam_registration_number=app.udyam_registration_number,
                udyam_status=app.udyam_status,
                msme_classification=app.msme_classification,
                udyam_certificate_url=app.udyam_certificate_url,
                gst_application_number=app.gst_application_number,
                gst_registration_ref=app.gst_registration_ref,
                gst_status=app.gst_status,
            )
        )


    return summaries


@router.get("/applications/{application_id}", response_model=ApplicationRead)
async def get_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieves full application details with nested approvals, SLA calculations, and inspections."""
    app = db.query(Application).options(
        joinedload(Application.business_profile),
        joinedload(Application.applicant),
        joinedload(Application.approvals).joinedload(ApplicationApproval.department),
        joinedload(Application.approvals).joinedload(ApplicationApproval.inspections),
    ).filter(Application.id == application_id).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    if app.fssai_application_number:
        try:
            from app.services.fssai_service import sync_fssai_application_status
            await sync_fssai_application_status(db, current_user, app.fssai_application_number)
            db.refresh(app)
        except Exception as e:
            logger.warning(f"Error syncing FSSAI app {app.fssai_application_number}: {e}")

    if app.udyam_application_number:
        try:
            from app.services.udyam_service import sync_udyam_application_status
            await sync_udyam_application_status(db, current_user, app.udyam_application_number)
            db.refresh(app)
        except Exception as e:
            logger.warning(f"Error syncing Udyam app {app.udyam_application_number}: {e}")

    if app.gst_application_number:
        try:
            from app.services.gst_service import sync_gst_application_status
            await sync_gst_application_status(db, current_user, app.gst_application_number)
            db.refresh(app)
        except Exception as e:
            logger.warning(f"Error syncing GST app {app.gst_application_number}: {e}")

    # Access control
    if current_user.role == UserRole.APPLICANT and app.applicant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized: Access restricted to application owner.")

    return _format_application_response(db, app)


@router.post("/applications/{application_id}/submit", response_model=ApplicationRead)
def submit_draft_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Submits a DRAFT application, assigning SLA targets to each departmental clearance."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    if current_user.role == UserRole.APPLICANT and app.applicant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    if app.status != ApplicationStatus.DRAFT:
        raise HTTPException(status_code=400, detail=f"Application is already in '{app.status.value}' state.")

    now = datetime.now(timezone.utc)
    old_status = app.status.value
    app.status = ApplicationStatus.SUBMITTED
    app.submitted_at = now

    max_date = now
    # Update SLAs on child approvals
    for approval in app.approvals:
        dept = db.query(Department).filter(Department.id == approval.department_id).first()
        sla_days = dept.sla_days if dept else 15
        approval.submitted_at = now
        approval.expected_completion_date = now + timedelta(days=sla_days)
        approval.sla_due_date = approval.expected_completion_date
        if approval.expected_completion_date > max_date:
            max_date = approval.expected_completion_date

    app.expected_completion_date = max_date

    log_timeline_event(
        db=db,
        application_id=app.id,
        new_status=ApplicationStatus.SUBMITTED.value,
        old_status=old_status,
        changed_by_user=current_user,
        remarks="Formal application submission completed by applicant."
    )

    db.commit()
    db.refresh(app)
    return _format_application_response(db, app)


@router.get("/applications/{application_id}/timeline", response_model=List[TimelineEventRead])
def get_application_timeline(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Fetches full historical chronological audit trail for the application."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    if current_user.role == UserRole.APPLICANT and app.applicant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    events = db.query(ApplicationStatusHistory).options(
        joinedload(ApplicationStatusHistory.application_approval)
    ).filter(
        ApplicationStatusHistory.application_id == application_id
    ).order_by(ApplicationStatusHistory.created_at.desc()).all()

    result = []
    for ev in events:
        approval_name = ev.application_approval.approval_name if ev.application_approval else None
        result.append(
            TimelineEventRead(
                id=ev.id,
                application_id=ev.application_id,
                application_approval_id=ev.application_approval_id,
                approval_name=approval_name,
                old_status=ev.old_status,
                new_status=ev.new_status,
                changed_by_user_id=ev.changed_by_user_id,
                changed_by_name=ev.changed_by_name,
                changed_by_role=ev.changed_by_role,
                remarks=ev.remarks,
                created_at=ev.created_at,
            )
        )

    return result


# --------------------------------------------------------------------------
# Departmental Approval Workflow Actions
# --------------------------------------------------------------------------
@router.patch("/application-approvals/{approval_id}/status", response_model=ApplicationApprovalRead)
def update_approval_status(
    approval_id: int,
    status_in: ApprovalStatusUpdateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_officer),
):
    """
    Department Officer updates the clearance status:
    - Moves from PENDING -> UNDER_REVIEW / DOCUMENT_QUERY / INSPECTION_PENDING / APPROVED / REJECTED
    - Automatically re-aggregates overall application status and SLA completed dates
    - Records timeline entry
    """
    approval = db.query(ApplicationApproval).options(
        joinedload(ApplicationApproval.application),
        joinedload(ApplicationApproval.department),
        joinedload(ApplicationApproval.inspections),
    ).filter(ApplicationApproval.id == approval_id).first()

    if not approval:
        raise HTTPException(status_code=404, detail="Departmental approval record not found.")

    old_approval_status = approval.status.value
    new_approval_status = status_in.status
    now = datetime.now(timezone.utc)

    approval.status = new_approval_status
    approval.assigned_officer_id = current_user.id
    approval.assigned_officer_name = current_user.full_name
    if status_in.remarks:
        approval.remarks = status_in.remarks
    if status_in.query_details:
        approval.query_details = status_in.query_details

    if new_approval_status in [ApprovalWorkflowStatus.APPROVED, ApprovalWorkflowStatus.REJECTED]:
        approval.completed_at = now
        if new_approval_status == ApprovalWorkflowStatus.APPROVED:
            approval.approved_at = now
        else:
            approval.rejected_at = now

    # Log approval timeline event
    log_timeline_event(
        db=db,
        application_id=approval.application_id,
        application_approval_id=approval.id,
        old_status=old_approval_status,
        new_status=new_approval_status.value,
        changed_by_user=current_user,
        remarks=status_in.remarks or f"Clearance status updated to {new_approval_status.value} by {current_user.full_name}."
    )

    # Recompute parent application overall status
    parent_app = approval.application
    old_app_status = parent_app.status
    new_app_status = calculate_aggregated_application_status(parent_app)

    if new_app_status != old_app_status:
        parent_app.status = new_app_status
        if new_app_status in [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]:
            parent_app.decision_at = now
            parent_app.completed_at = now

        log_timeline_event(
            db=db,
            application_id=parent_app.id,
            new_status=new_app_status.value,
            old_status=old_app_status.value,
            changed_by_user=None,
            remarks=f"Application status automatically recalculated to {new_app_status.value} based on departmental clearance actions."
        )

    db.commit()
    db.refresh(approval)

    return _format_approval_response(approval)


@router.post("/application-approvals/{approval_id}/query-response", response_model=ApplicationApprovalRead)
def submit_query_response(
    approval_id: int,
    query_in: QueryResponseInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Applicant provides answers or supplementary clarification for a departmental DOCUMENT_QUERY."""
    approval = db.query(ApplicationApproval).options(
        joinedload(ApplicationApproval.application),
        joinedload(ApplicationApproval.department),
        joinedload(ApplicationApproval.inspections),
    ).filter(ApplicationApproval.id == approval_id).first()

    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found.")

    if current_user.role == UserRole.APPLICANT and approval.application.applicant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    old_status = approval.status.value
    approval.query_response = query_in.query_response
    approval.status = ApprovalWorkflowStatus.UNDER_REVIEW

    log_timeline_event(
        db=db,
        application_id=approval.application_id,
        application_approval_id=approval.id,
        old_status=old_status,
        new_status=ApprovalWorkflowStatus.UNDER_REVIEW.value,
        changed_by_user=current_user,
        remarks=f"Applicant submitted clarification: {query_in.query_response[:100]}..."
    )

    parent_app = approval.application
    parent_app.status = calculate_aggregated_application_status(parent_app)

    db.commit()
    db.refresh(approval)
    return _format_approval_response(approval)


# --------------------------------------------------------------------------
# Inspection Scheduling & Execution APIs (Phase 6)
# --------------------------------------------------------------------------
@router.get("/inspections", response_model=List[InspectionRead])
def list_inspections(
    status_filter: Optional[InspectionStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Lists inspection schedules with officer, time, date, and location details."""
    query = db.query(Inspection).options(
        joinedload(Inspection.department),
        joinedload(Inspection.application_approval).joinedload(ApplicationApproval.application).joinedload(Application.business_profile),
    )

    if current_user.role == UserRole.APPLICANT:
        query = query.join(Inspection.application_approval).join(ApplicationApproval.application).filter(
            Application.applicant_id == current_user.id
        )

    if status_filter:
        query = query.filter(Inspection.status == status_filter)

    inspections = query.order_by(Inspection.scheduled_date.asc()).all()
    return [_format_inspection_read(i) for i in inspections]


@router.post("/application-approvals/{approval_id}/schedule-inspection", response_model=InspectionRead)
def schedule_inspection(
    approval_id: int,
    insp_in: InspectionCreateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_officer),
):
    """
    Department officer schedules field or technical inspection:
    - Sets date, time, location, inspector, contact
    - Transitions approval status to INSPECTION_PENDING
    """
    approval = db.query(ApplicationApproval).options(
        joinedload(ApplicationApproval.application).joinedload(Application.business_profile)
    ).filter(ApplicationApproval.id == approval_id).first()
    
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found.")

    location_str = insp_in.location
    if not location_str and approval.application.business_profile:
        prof = approval.application.business_profile
        location_str = f"Site Plot: {prof.company_name}, {prof.district}, {prof.state}"

    time_str = insp_in.scheduled_time or insp_in.scheduled_date.strftime("%I:%M %p")

    inspection = Inspection(
        application_approval_id=approval.id,
        department_id=approval.department_id,
        scheduled_date=insp_in.scheduled_date,
        scheduled_time=time_str,
        location=location_str,
        inspector_name=insp_in.inspector_name,
        inspector_contact=insp_in.inspector_contact,
        status=InspectionStatus.SCHEDULED,
        report_notes=insp_in.report_notes,
    )
    db.add(inspection)

    # Transition approval status to INSPECTION_PENDING & record inspection date
    old_status = approval.status.value
    approval.status = ApprovalWorkflowStatus.INSPECTION_PENDING
    approval.inspection_date = insp_in.scheduled_date

    log_timeline_event(
        db=db,
        application_id=approval.application_id,
        application_approval_id=approval.id,
        old_status=old_status,
        new_status=ApprovalWorkflowStatus.INSPECTION_PENDING.value,
        changed_by_user=current_user,
        remarks=f"Site inspection scheduled for {insp_in.scheduled_date.strftime('%Y-%m-%d')} ({time_str}) at '{location_str}' by {insp_in.inspector_name}."
    )

    approval.application.status = calculate_aggregated_application_status(approval.application)

    db.commit()
    db.refresh(inspection)

    return _format_inspection_read(inspection)


@router.patch("/inspections/{inspection_id}/complete", response_model=InspectionRead)
def complete_inspection(
    inspection_id: int,
    comp_in: InspectionCompleteInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_officer),
):
    """Department officer records inspection report findings and closes the inspection."""
    insp = db.query(Inspection).options(
        joinedload(Inspection.application_approval).joinedload(ApplicationApproval.application),
        joinedload(Inspection.department),
    ).filter(Inspection.id == inspection_id).first()

    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found.")

    now = datetime.now(timezone.utc)
    insp.status = InspectionStatus.COMPLETED
    insp.findings = comp_in.findings
    insp.report_notes = comp_in.report_notes
    insp.inspected_at = now

    approval = insp.application_approval
    old_status = approval.status.value
    approval.status = ApprovalWorkflowStatus.UNDER_REVIEW

    log_timeline_event(
        db=db,
        application_id=approval.application_id,
        application_approval_id=approval.id,
        old_status=old_status,
        new_status=ApprovalWorkflowStatus.UNDER_REVIEW.value,
        changed_by_user=current_user,
        remarks=f"Inspection completed by {insp.inspector_name}. Findings: {comp_in.findings[:100]}..."
    )

    db.commit()
    db.refresh(insp)

    return _format_inspection_read(insp)


# --------------------------------------------------------------------------
# Helper Formatting Functions
# --------------------------------------------------------------------------
def _format_inspection_read(insp: Inspection) -> InspectionRead:
    app_num = None
    comp_name = None
    appr_name = None
    if insp.application_approval:
        appr_name = insp.application_approval.approval_name
        if insp.application_approval.application:
            app_num = insp.application_approval.application.application_number
            if insp.application_approval.application.business_profile:
                comp_name = insp.application_approval.application.business_profile.company_name

    return InspectionRead(
        id=insp.id,
        application_approval_id=insp.application_approval_id,
        approval_name=appr_name,
        application_number=app_num,
        company_name=comp_name,
        department_id=insp.department_id,
        department_name=insp.department.name if insp.department else None,
        scheduled_date=insp.scheduled_date,
        scheduled_time=insp.scheduled_time or insp.scheduled_date.strftime("%I:%M %p"),
        location=insp.location or "Enterprise Industrial Facility",
        inspector_name=insp.inspector_name,
        inspector_contact=insp.inspector_contact,
        status=insp.status,
        findings=insp.findings,
        report_notes=insp.report_notes,
        inspected_at=insp.inspected_at,
        created_at=insp.created_at,
    )


def _format_approval_response(approval: ApplicationApproval) -> ApplicationApprovalRead:
    sub_date = approval.submitted_at or (approval.application.submitted_at if approval.application else None)
    exp_date = approval.expected_completion_date or approval.sla_due_date
    elapsed, rem, sla_st = calculate_sla_metrics(
        submitted_at=sub_date,
        expected_completion_date=exp_date,
        status=approval.status,
        completed_at=approval.completed_at
    )

    inspections_formatted = [_format_inspection_read(i) for i in approval.inspections]

    return ApplicationApprovalRead(
        id=approval.id,
        application_id=approval.application_id,
        approval_id=approval.approval_id,
        approval_name=approval.approval_name,
        department_id=approval.department_id,
        department_name=approval.department.name if approval.department else None,
        department_code=approval.department.code if approval.department else None,
        status=approval.status,
        current_status=approval.status,
        assigned_officer_id=approval.assigned_officer_id,
        assigned_officer_name=approval.assigned_officer_name,
        remarks=approval.remarks,
        query_details=approval.query_details,
        query_response=approval.query_response,
        
        # Phase 6 fields
        submitted_at=sub_date,
        expected_completion_date=exp_date,
        sla_due_date=exp_date,
        inspection_required=approval.inspection_required,
        inspection_date=approval.inspection_date,
        completed_at=approval.completed_at,
        approved_at=approval.approved_at,
        rejected_at=approval.rejected_at,
        days_elapsed=elapsed,
        days_remaining=rem,
        sla_status=sla_st,

        created_at=approval.created_at,
        updated_at=approval.updated_at,
        inspections=inspections_formatted,
    )


def _format_application_response(db: Session, app: Application) -> ApplicationRead:
    profile_summary = None
    if app.business_profile:
        profile_summary = BusinessProfileSummary(
            id=app.business_profile.id,
            company_name=app.business_profile.company_name,
            business_type=app.business_profile.business_type,
            industry=app.business_profile.industry,
            state=app.business_profile.state,
            district=app.business_profile.district,
            investment_amount=app.business_profile.investment_amount,
        )

    formatted_approvals = [_format_approval_response(a) for a in app.approvals]
    elapsed, rem, overall_sla, exp_date = calculate_aggregated_application_sla(app)

    return ApplicationRead(
        id=app.id,
        application_number=app.application_number,
        applicant_id=app.applicant_id,
        applicant_name=app.applicant.full_name if app.applicant else None,
        applicant_email=app.applicant.email if app.applicant else None,
        business_profile_id=app.business_profile_id,
        business_profile=profile_summary,
        status=app.status,
        project_title=app.project_title,
        notes=app.notes,
        declaration_accepted=app.declaration_accepted,
        submitted_at=app.submitted_at,
        expected_completion_date=exp_date,
        decision_at=app.decision_at,
        completed_at=app.completed_at,
        days_elapsed=elapsed,
        days_remaining=rem,
        sla_status=overall_sla,
        created_at=app.created_at,
        updated_at=app.updated_at,
        approvals=formatted_approvals,
        fssai_application_number=app.fssai_application_number,
        fssai_status=app.fssai_status,
        udyam_application_number=app.udyam_application_number,
        udyam_registration_number=app.udyam_registration_number,
        udyam_status=app.udyam_status,
        msme_classification=app.msme_classification,
        msme_classification_reason=app.msme_classification_reason,
        udyam_certificate_url=app.udyam_certificate_url,
    )

