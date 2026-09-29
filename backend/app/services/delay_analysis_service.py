import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.approval_intelligence import (
    WorkflowSLARule,
    DelayAnalysisRecord,
    ApplicationEvent,
    ExternalWorkflowStep,
)
from app.models.application import (
    Application,
    ApplicationStatusHistory,
    ApprovalApplication,
    Inspection,
)

logger = logging.getLogger(__name__)


class DelayAnalysisService:
    """
    Deterministic, evidence-based engine that evaluates status history,
    open queries, inspection states, and SLA thresholds to diagnose application bottlenecks.
    """

    @staticmethod
    def analyze_application_delay(
        db: Session,
        application_id: Optional[int] = None,
        approval_app_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Builds a comprehensive, evidence-backed delay diagnostic for an application.
        """
        now = datetime.now(timezone.utc)

        app = None
        approval_app = None
        current_status = "SUBMITTED"
        approval_code = "GENERIC"
        created_at = now - timedelta(days=2)
        officer_remarks = ""

        if approval_app_id:
            approval_app = db.query(ApprovalApplication).filter(ApprovalApplication.id == approval_app_id).first()
            if approval_app:
                current_status = approval_app.status
                approval_code = approval_app.approval_id
                created_at = approval_app.created_at or approval_app.last_synced_at or now
                officer_remarks = approval_app.officer_remarks or ""
        elif application_id:
            app = db.query(Application).filter(Application.id == application_id).first()
            if app:
                current_status = app.status.value if hasattr(app.status, "value") else str(app.status)
                approval_code = "FSSAI" if app.fssai_application_number else "GENERAL"
                created_at = app.created_at or now
                officer_remarks = app.fssai_officer_remarks or ""

        # Fetch SLA rules for this stage
        sla_rule = db.query(WorkflowSLARule).filter(
            WorkflowSLARule.approval_id.in_([approval_code, "ALL"]),
            WorkflowSLARule.status == current_status,
            WorkflowSLARule.active == True,
        ).first()

        expected_days = sla_rule.expected_duration_days if sla_rule else 3.0
        warning_days = sla_rule.warning_after_days if sla_rule else 5.0
        critical_days = sla_rule.critical_after_days if sla_rule else 7.0

        # Calculate time in current stage
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        time_in_stage_days = round((now - created_at).total_seconds() / 86400, 1)

        # Default diagnostic state
        delay_status = "ON_TRACK"
        reason_category = "NO_RECENT_UPDATE"
        reason_text = "The application is proceeding within the expected operating SLA duration."
        blocking_step = "STANDARD_PROCESSING"
        waiting_party = "Awaiting Department Review"
        recommended_action = {"label": "Track Application", "route": f"/applications/{application_id or approval_app_id}"}
        evidence = []

        evidence.append({
            "event": "STAGE_ENTERED",
            "stage": current_status,
            "timestamp": created_at.strftime("%d %b %Y, %H:%M UTC"),
            "time_elapsed_days": time_in_stage_days,
        })

        # 1. Check for DOCUMENT_QUERY or Correction Pending
        if current_status in ["DOCUMENT_QUERY", "QUERY_PENDING", "ACTION_REQUIRED", "NEEDS_CORRECTION"]:
            delay_status = "AT_RISK" if time_in_stage_days <= warning_days else "OVERDUE"
            reason_category = "DOCUMENT_QUERY"
            blocking_step = "APPLICANT_RESPONSE"
            waiting_party = "Awaiting Applicant"
            reason_text = (
                f"The workflow is currently waiting for a response to a document query raised by the scrutiny officer. "
                f"{officer_remarks or 'Correction requested for submitted business premises or identity proof.'}"
            )
            recommended_action = {
                "label": "Respond to Document Query",
                "route": f"/applications/{application_id or approval_app_id}",
                "action_type": "QUERY_RESPONSE"
            }
            evidence.append({
                "event": "OFFICER_QUERY_RAISED",
                "date": created_at.strftime("%d %b %Y"),
                "details": officer_remarks or "Correction or additional documentation requested by department officer.",
                "applicant_response": "Pending",
            })

        # 2. Check for INSPECTION_SCHEDULED
        elif current_status in ["INSPECTION_SCHEDULED", "PENDING_INSPECTION"]:
            delay_status = "AT_RISK" if time_in_stage_days > warning_days else "APPROACHING"
            reason_category = "INSPECTION_PENDING"
            blocking_step = "SITE_INSPECTION"
            waiting_party = "Awaiting Inspection"
            reason_text = "Application is awaiting physical site audit and food hygiene scrutiny by the Designated Officer."
            recommended_action = {
                "label": "Review Inspection Checklist",
                "route": f"/applications/{application_id or approval_app_id}",
                "action_type": "INSPECTION_PREP"
            }
            evidence.append({
                "event": "INSPECTION_SCHEDULED",
                "date": created_at.strftime("%d %b %Y"),
                "details": "Premises scrutiny assigned to local jurisdictional officer.",
            })

        # 3. Check for EXTERNAL_STEP_PENDING
        elif current_status in ["EXTERNAL_PROCESS", "WAITING_EXTERNAL"]:
            delay_status = "APPROACHING" if time_in_stage_days <= warning_days else "AT_RISK"
            reason_category = "EXTERNAL_PROCESS_PENDING"
            blocking_step = "EXTERNAL_AUTHORITY"
            waiting_party = "Awaiting External Step"
            reason_text = "The application requires an offline or external clearance step before digital approval can be reconciled."
            recommended_action = {
                "label": "Complete External Step",
                "route": "/coverage",
                "action_type": "EXTERNAL_STEP"
            }
            evidence.append({
                "event": "EXTERNAL_COORDINATION",
                "date": created_at.strftime("%d %b %Y"),
                "details": "External clearance workflow in progress.",
            })

        # 4. Check for UNDER_REVIEW SLA breach
        elif current_status in ["UNDER_REVIEW", "IN_PROGRESS", "SUBMITTED"]:
            if time_in_stage_days > critical_days:
                delay_status = "OVERDUE"
                reason_category = "OFFICER_REVIEW_PENDING"
                blocking_step = "OFFICER_SCRUTINY"
                waiting_party = "Awaiting Department Review"
                reason_text = f"Application has spent {time_in_stage_days} days under review, exceeding the target SLA of {expected_days} days."
                recommended_action = {
                    "label": "Send Expedited Scrutiny Request",
                    "route": f"/applications/{application_id or approval_app_id}",
                    "action_type": "ESCALATION"
                }
            elif time_in_stage_days > warning_days:
                delay_status = "APPROACHING"
                reason_category = "OFFICER_REVIEW_PENDING"
                blocking_step = "OFFICER_SCRUTINY"
                waiting_party = "Awaiting Department Review"
                reason_text = f"Application review is nearing the {warning_days}-day threshold ({time_in_stage_days} days in current stage)."

        elif current_status in ["APPROVED", "COMPLETED"]:
            delay_status = "ON_TRACK"
            reason_category = "COMPLETED"
            blocking_step = "NONE"
            waiting_party = "None (Completed)"
            reason_text = "Application has received statutory approval and is active."
            recommended_action = {
                "label": "View License in Compliance",
                "route": "/compliance",
                "action_type": "VIEW_COMPLIANCE"
            }

        return {
            "application_id": application_id or approval_app_id,
            "approval_code": approval_code,
            "current_status": current_status,
            "delay_status": delay_status,
            "health_badge": "On Track" if delay_status == "ON_TRACK" else ("Approaching" if delay_status == "APPROACHING" else ("At Risk" if delay_status == "AT_RISK" else "Overdue")),
            "time_in_stage_days": time_in_stage_days,
            "expected_sla_days": expected_days,
            "reason_category": reason_category,
            "reason_text": reason_text,
            "blocking_step": blocking_step,
            "waiting_party": waiting_party,
            "recommended_action": recommended_action,
            "evidence": evidence,
            "confidence": 1.0,
            "analysis_timestamp": now.isoformat(),
        }

    @staticmethod
    def get_bottleneck_metrics(db: Session) -> Dict[str, Any]:
        """
        Aggregates officer & admin bottleneck metrics across all live applications.
        """
        now = datetime.now(timezone.utc)
        apps = db.query(ApprovalApplication).all()

        stage_counts = {}
        total_time_by_stage = {}
        at_risk_count = 0
        overdue_count = 0
        awaiting_applicant_count = 0
        awaiting_dept_count = 0
        awaiting_inspection_count = 0
        awaiting_external_count = 0

        for a in apps:
            diag = DelayAnalysisService.analyze_application_delay(db, approval_app_id=a.id)
            st = a.status
            stage_counts[st] = stage_counts.get(st, 0) + 1
            total_time_by_stage[st] = total_time_by_stage.get(st, 0.0) + diag["time_in_stage_days"]

            if diag["delay_status"] == "AT_RISK":
                at_risk_count += 1
            elif diag["delay_status"] == "OVERDUE":
                overdue_count += 1

            if diag["waiting_party"] == "Awaiting Applicant":
                awaiting_applicant_count += 1
            elif diag["waiting_party"] == "Awaiting Department Review":
                awaiting_dept_count += 1
            elif diag["waiting_party"] == "Awaiting Inspection":
                awaiting_inspection_count += 1
            elif diag["waiting_party"] == "Awaiting External Step":
                awaiting_external_count += 1

        bottleneck_stages = []
        for stage, count in stage_counts.items():
            avg_time = round(total_time_by_stage[stage] / count, 1) if count > 0 else 0.0
            bottleneck_stages.append({
                "stage": stage,
                "display_name": stage.replace("_", " ").title(),
                "applications_count": count,
                "average_time_days": avg_time,
                "pending_count": count,
            })

        bottleneck_stages.sort(key=lambda x: x["average_time_days"], reverse=True)

        return {
            "summary": {
                "total_applications": len(apps),
                "applications_at_risk": at_risk_count,
                "applications_overdue": overdue_count,
                "awaiting_applicant": awaiting_applicant_count,
                "awaiting_department": awaiting_dept_count,
                "awaiting_inspection": awaiting_inspection_count,
                "awaiting_external": awaiting_external_count,
            },
            "bottleneck_stages": bottleneck_stages,
        }
