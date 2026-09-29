import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user, get_current_user
from app.models.user import User, UserRole
from app.models.business_profile import BusinessProfile
from app.models.approval_intelligence import (
    ApprovalCatalog,
    ApprovalRule,
    ApprovalDependency,
    ApprovalCoverage,
    ExternalWorkflowStep,
    ApprovalRecord,
    ComplianceTask,
    WorkflowSLARule,
    DelayAnalysisRecord,
)
from app.services.approval_reason_service import ApprovalReasonService
from app.services.approval_priority_service import ApprovalPriorityService
from app.services.approval_coverage_service import ApprovalCoverageService
from app.services.compliance_service import ComplianceService
from app.services.delay_analysis_service import DelayAnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Approval Intelligence, Priority, Coverage & Compliance"])


class CompleteExternalStepRequest(BaseModel):
    proof_document_id: Optional[int] = None
    notes: Optional[str] = None


class CompleteTaskRequest(BaseModel):
    notes: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# 1. APPROVAL PLAN & PRIORITIES
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/approvals/plan", response_model=Dict[str, Any])
def get_approval_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns the comprehensive, deterministic Approval Plan with sequential priority,
    parallel tracks, why-needed reasons, and coverage badges.
    """
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    plan = ApprovalPriorityService.calculate_approval_plan(db, profile, user_id=current_user.id)
    return plan


@router.get("/approvals/recommendations", response_model=Dict[str, Any])
def get_approval_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    items = ApprovalReasonService.get_approval_reasons_for_profile(db, profile)
    return {
        "success": True,
        "total": len(items),
        "items": items,
    }


@router.get("/approvals/{approval_id}", response_model=Dict[str, Any])
def get_approval_detail(
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    reason_info = ApprovalReasonService.get_reason_for_approval(db, approval_id, profile)
    coverage = db.query(ApprovalCoverage).filter(ApprovalCoverage.approval_id == approval_id).first()
    deps = db.query(ApprovalDependency).filter(ApprovalDependency.approval_id == approval_id).all()

    return {
        "approval_id": approval_id,
        "details": reason_info,
        "coverage": {
            "coverage_type": coverage.coverage_type if coverage else "HYBRID",
            "tasker_capabilities": coverage.tasker_capabilities_json if coverage else [],
            "external_steps": coverage.external_steps_json if coverage else [],
            "authority": coverage.authority if coverage else "Competent Authority",
            "authority_location": coverage.authority_location if coverage else "Local Jurisdiction",
            "source": coverage.source if coverage else reason_info.get("source"),
            "last_verified_date": coverage.last_verified_date if coverage else "2026-09-01",
        },
        "dependencies": [
            {
                "depends_on": d.depends_on_approval_id,
                "dependency_type": d.dependency_type,
                "description": d.description,
            }
            for d in deps
        ],
    }


@router.get("/approvals/{approval_id}/why", response_model=Dict[str, Any])
def get_approval_why(
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    return ApprovalReasonService.get_reason_for_approval(db, approval_id, profile)


@router.get("/approvals/{approval_id}/coverage", response_model=Dict[str, Any])
def get_approval_coverage_item(
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    coverage = db.query(ApprovalCoverage).filter(ApprovalCoverage.approval_id == approval_id).first()
    if not coverage:
        raise HTTPException(status_code=404, detail="Coverage mapping not configured for this approval.")
    return {
        "approval_id": approval_id,
        "coverage_type": coverage.coverage_type,
        "tasker_capabilities": coverage.tasker_capabilities_json or [],
        "external_steps": coverage.external_steps_json or [],
        "authority": coverage.authority,
        "authority_location": coverage.authority_location,
        "source": coverage.source,
        "last_verified_date": coverage.last_verified_date,
    }


@router.get("/approvals/{approval_id}/dependencies", response_model=List[Dict[str, Any]])
def get_approval_dependencies(
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    deps = db.query(ApprovalDependency).filter(ApprovalDependency.approval_id == approval_id).all()
    return [
        {
            "approval_id": d.approval_id,
            "depends_on": d.depends_on_approval_id,
            "dependency_type": d.dependency_type,
            "description": d.description,
        }
        for d in deps
    ]


# ─────────────────────────────────────────────────────────────────────────────
# 2. APPROVAL COVERAGE MAP & EXTERNAL TRACKING
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/coverage", response_model=Dict[str, Any])
def get_coverage_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    return ApprovalCoverageService.get_coverage_for_profile(db, profile)


@router.post("/coverage/external-steps/{step_id}/complete", response_model=Dict[str, Any])
def mark_external_step_complete(
    step_id: int,
    payload: CompleteExternalStepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return ApprovalCoverageService.complete_external_step(
            db=db,
            step_id=step_id,
            proof_document_id=payload.proof_document_id,
            notes=payload.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# 3. POST-APPROVAL COMPLIANCE & RENEWALS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/compliance", response_model=Dict[str, Any])
def get_compliance_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    return ComplianceService.get_compliance_overview(db, profile)


@router.get("/compliance/renewals", response_model=Dict[str, Any])
def get_compliance_renewals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    overview = ComplianceService.get_compliance_overview(db, profile)
    return {
        "summary": overview["summary"],
        "renewals": overview["approval_records"],
    }


@router.get("/compliance/tasks", response_model=List[Dict[str, Any]])
def get_compliance_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    overview = ComplianceService.get_compliance_overview(db, profile)
    return overview["tasks"]


@router.post("/compliance/tasks/{task_id}/complete", response_model=Dict[str, Any])
def mark_compliance_task_complete(
    task_id: int,
    payload: CompleteTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        return ComplianceService.complete_task(db, task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/compliance/calendar", response_model=List[Dict[str, Any]])
def get_compliance_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    return ComplianceService.get_calendar_events(db, profile)


# ─────────────────────────────────────────────────────────────────────────────
# 4. DELAY EXPLANATION & BOTTLENECK ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/applications/{application_id}/delay-analysis", response_model=Dict[str, Any])
def get_application_delay_analysis(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return DelayAnalysisService.analyze_application_delay(db, application_id=application_id)


@router.get("/applications/{application_id}/health", response_model=Dict[str, Any])
def get_application_health(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    diag = DelayAnalysisService.analyze_application_delay(db, application_id=application_id)
    return {
        "application_id": application_id,
        "health_badge": diag["health_badge"],
        "delay_status": diag["delay_status"],
        "time_in_stage_days": diag["time_in_stage_days"],
        "expected_sla_days": diag["expected_sla_days"],
        "waiting_party": diag["waiting_party"],
        "next_action": diag["recommended_action"],
    }


@router.get("/applications/{application_id}/timeline", response_model=List[Dict[str, Any]])
def get_application_timeline(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    diag = DelayAnalysisService.analyze_application_delay(db, application_id=application_id)
    return diag["evidence"]


@router.get("/applications/bottlenecks", response_model=Dict[str, Any])
def get_officer_bottlenecks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Officer & Admin aggregated stage duration analytics and bottleneck queues.
    """
    return DelayAnalysisService.get_bottleneck_metrics(db)
