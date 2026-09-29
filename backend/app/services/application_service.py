from datetime import datetime, timedelta, timezone
import logging
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
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
from app.models.business_profile import BusinessProfile
from app.models.user import User

logger = logging.getLogger(__name__)


def generate_application_number(db: Session) -> str:
    """Generates a sequential human-readable application number like MAITRI-2026-AP-0001."""
    year = datetime.now(timezone.utc).year
    prefix = f"MAITRI-{year}-AP-"
    
    # Count existing applications for this year
    count = db.query(Application).filter(Application.application_number.like(f"{prefix}%")).count()
    return f"{prefix}{count + 1:04d}"


def resolve_department_for_approval(db: Session, approval_id: str, approval_name: str, dept_code_hint: Optional[str] = None) -> Department:
    """
    Intelligently maps an approval ID or name to its responsible configured Department.
    """
    if dept_code_hint:
        dept = db.query(Department).filter(Department.code == dept_code_hint.upper()).first()
        if dept:
            return dept

    app_id_lower = approval_id.lower()
    name_lower = approval_name.lower()

    if "mpcb" in app_id_lower or "cte" in app_id_lower or "cto" in app_id_lower or "pollution" in name_lower or "consent" in name_lower:
        dept = db.query(Department).filter(Department.code == "MPCB").first()
    elif "fire" in app_id_lower or "fire" in name_lower or "noc" in name_lower:
        dept = db.query(Department).filter(Department.code == "FIRE").first()
    elif "local" in app_id_lower or "midc" in app_id_lower or "plan" in name_lower or "town" in name_lower or "building" in name_lower:
        dept = db.query(Department).filter(Department.code == "LOCAL").first()
    elif "labour" in app_id_lower or "dish" in app_id_lower or "factor" in name_lower or "boiler" in name_lower:
        dept = db.query(Department).filter(Department.code == "LABOUR").first()
    elif "power" in app_id_lower or "discom" in app_id_lower or "msedcl" in app_id_lower or "electr" in name_lower:
        dept = db.query(Department).filter(Department.code == "DISCOM").first()
    else:
        dept = db.query(Department).filter(Department.code == "IND").first()

    if not dept:
        dept = db.query(Department).first()
        if not dept:
            dept = Department(
                code="IND",
                name="Directorate of Industries",
                description="Default Industrial Authority",
                sla_days=15,
                is_active=True
            )
            db.add(dept)
            db.commit()
            db.refresh(dept)

    return dept


def check_if_inspection_required(approval_id: str, approval_name: str) -> bool:
    """Checks if the approval typically mandates field or technical site inspection."""
    combined = f"{approval_id} {approval_name}".lower()
    keywords = ["fire", "mpcb", "pollution", "cte", "cto", "building", "plan", "boiler", "factory", "site"]
    return any(k in combined for k in keywords)


def calculate_sla_metrics(
    submitted_at: Optional[datetime],
    expected_completion_date: Optional[datetime],
    status: ApprovalWorkflowStatus,
    completed_at: Optional[datetime] = None,
) -> Tuple[int, int, SLAStatus]:
    """
    Calculates:
    - days_elapsed
    - days_remaining
    - SLA_status (ON_TRACK, APPROACHING, AT_RISK, OVERDUE, COMPLETED)
    """
    now = datetime.now(timezone.utc)

    # 1. Completed Status
    if status in [ApprovalWorkflowStatus.APPROVED, ApprovalWorkflowStatus.REJECTED] or completed_at:
        elapsed = 0
        if submitted_at:
            end_time = completed_at or now
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            start_time = submitted_at.replace(tzinfo=timezone.utc) if submitted_at.tzinfo is None else submitted_at
            elapsed = max(0, (end_time - start_time).days)
        return (elapsed, 0, SLAStatus.COMPLETED)

    # 2. Not yet submitted
    if not submitted_at or not expected_completion_date:
        return (0, 15, SLAStatus.ON_TRACK)

    start_time = submitted_at.replace(tzinfo=timezone.utc) if submitted_at.tzinfo is None else submitted_at
    target_time = expected_completion_date.replace(tzinfo=timezone.utc) if expected_completion_date.tzinfo is None else expected_completion_date

    days_elapsed = max(0, (now - start_time).days)
    
    # Calculate exact delta in seconds then convert to days (can be negative if overdue)
    total_remaining_seconds = (target_time - now).total_seconds()
    days_remaining = int(total_remaining_seconds // 86400) if total_remaining_seconds >= 0 else int(total_remaining_seconds // 86400)

    if total_remaining_seconds < 0:
        sla_status = SLAStatus.OVERDUE
    elif days_remaining <= 3:
        sla_status = SLAStatus.AT_RISK
    elif days_remaining <= 7:
        sla_status = SLAStatus.APPROACHING
    else:
        sla_status = SLAStatus.ON_TRACK

    return (days_elapsed, days_remaining, sla_status)


def calculate_aggregated_application_sla(application: Application) -> Tuple[int, int, SLAStatus, Optional[datetime]]:
    """
    Aggregates SLA status across all child approvals for an application.
    Returns: (max_elapsed, min_remaining, overall_sla_status, earliest_expected_date)
    """
    if application.status in [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED] or application.completed_at:
        return (0, 0, SLAStatus.COMPLETED, application.decision_at or application.expected_completion_date)

    if not application.approvals:
        return (0, 15, SLAStatus.ON_TRACK, application.expected_completion_date)

    sla_statuses = []
    days_remaining_list = []
    days_elapsed_list = []
    expected_dates = []

    for appr in application.approvals:
        exp_date = appr.expected_completion_date or appr.sla_due_date
        if exp_date:
            expected_dates.append(exp_date)
        
        sub_date = appr.submitted_at or application.submitted_at
        elapsed, rem, st = calculate_sla_metrics(
            submitted_at=sub_date,
            expected_completion_date=exp_date,
            status=appr.status,
            completed_at=appr.completed_at
        )
        sla_statuses.append(st)
        if st != SLAStatus.COMPLETED:
            days_remaining_list.append(rem)
        days_elapsed_list.append(elapsed)

    max_elapsed = max(days_elapsed_list) if days_elapsed_list else 0
    min_remaining = min(days_remaining_list) if days_remaining_list else 0
    earliest_expected = min(expected_dates) if expected_dates else application.expected_completion_date

    # Aggregation precedence: OVERDUE > AT_RISK > APPROACHING > ON_TRACK > COMPLETED
    if SLAStatus.OVERDUE in sla_statuses:
        overall_status = SLAStatus.OVERDUE
    elif SLAStatus.AT_RISK in sla_statuses:
        overall_status = SLAStatus.AT_RISK
    elif SLAStatus.APPROACHING in sla_statuses:
        overall_status = SLAStatus.APPROACHING
    elif all(s == SLAStatus.COMPLETED for s in sla_statuses):
        overall_status = SLAStatus.COMPLETED
    else:
        overall_status = SLAStatus.ON_TRACK

    return (max_elapsed, min_remaining, overall_status, earliest_expected)


def calculate_aggregated_application_status(application: Application) -> ApplicationStatus:
    """
    Evaluates all child ApplicationApproval statuses and computes overall Application status:
    - If no approvals: retain current status or DRAFT
    - If ANY approval has DOCUMENT_QUERY -> NEEDS_INFORMATION
    - If ANY approval is REJECTED -> REJECTED (or PARTIALLY_APPROVED if some are approved)
    - If ALL approvals are APPROVED -> APPROVED
    - If SOME approvals are APPROVED and others are PENDING/UNDER_REVIEW/INSPECTION -> PARTIALLY_APPROVED
    - If ANY approval is UNDER_REVIEW or INSPECTION_PENDING -> UNDER_REVIEW
    - If ALL are PENDING -> SUBMITTED
    """
    approvals = application.approvals
    if not approvals:
        return application.status

    statuses = [a.status for a in approvals]

    # Any query waiting for applicant input
    if ApprovalWorkflowStatus.DOCUMENT_QUERY in statuses:
        return ApplicationStatus.NEEDS_INFORMATION

    # All approved
    if all(s == ApprovalWorkflowStatus.APPROVED for s in statuses):
        return ApplicationStatus.APPROVED

    # Any rejected
    has_rejected = ApprovalWorkflowStatus.REJECTED in statuses
    has_approved = ApprovalWorkflowStatus.APPROVED in statuses

    if has_rejected and not has_approved:
        return ApplicationStatus.REJECTED
    elif has_rejected and has_approved:
        return ApplicationStatus.PARTIALLY_APPROVED

    if has_approved:
        return ApplicationStatus.PARTIALLY_APPROVED

    if any(s in [ApprovalWorkflowStatus.UNDER_REVIEW, ApprovalWorkflowStatus.INSPECTION_PENDING] for s in statuses):
        return ApplicationStatus.UNDER_REVIEW

    if all(s == ApprovalWorkflowStatus.PENDING for s in statuses):
        return ApplicationStatus.SUBMITTED

    return ApplicationStatus.UNDER_REVIEW


def log_timeline_event(
    db: Session,
    application_id: int,
    new_status: str,
    old_status: Optional[str] = None,
    application_approval_id: Optional[int] = None,
    changed_by_user: Optional[User] = None,
    remarks: Optional[str] = None,
) -> ApplicationStatusHistory:
    """Creates an audit trail entry for status changes, queries, and inspections."""
    user_id = changed_by_user.id if changed_by_user else None
    user_name = changed_by_user.full_name if changed_by_user else "System Automator"
    user_role = changed_by_user.role.value if changed_by_user else "SYSTEM"

    history_entry = ApplicationStatusHistory(
        application_id=application_id,
        application_approval_id=application_approval_id,
        old_status=old_status,
        new_status=new_status,
        changed_by_user_id=user_id,
        changed_by_name=user_name,
        changed_by_role=user_role,
        remarks=remarks,
    )
    db.add(history_entry)
    return history_entry
