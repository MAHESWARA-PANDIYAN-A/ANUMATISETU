import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.application import Application, ApplicationStatus, Inspection, InspectionStatus
from app.models.document import Document, DocumentStatus, ValidationStatus
from app.services.document_vault_service import calculate_user_document_completeness

logger = logging.getLogger(__name__)


class NextActionService:
    """
    Evaluates business context, application statuses, officer queries, inspections,
    and document completeness to determine the most urgent next action for the user.
    """

    @staticmethod
    def get_top_next_action(db: Session, user_id: int) -> Dict[str, Any]:
        """
        Returns the single most important actionable item, or an 'all caught up' state.
        """
        # 1. Check for active officer queries on submitted applications
        query_app = (
            db.query(Application)
            .filter(
                Application.applicant_id == user_id,
                Application.status.in_([ApplicationStatus.NEEDS_INFORMATION, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SUBMITTED])
            )
            .first()
        )
        if query_app and (query_app.fssai_officer_remarks or query_app.gst_officer_remarks or query_app.udyam_officer_remarks or getattr(query_app, "officer_query", None)):
            notice_text = query_app.fssai_officer_remarks or query_app.gst_officer_remarks or query_app.udyam_officer_remarks or getattr(query_app, "officer_query", "Clarification requested")
            lbl = f"Respond to {query_app.project_title or 'Application'} Query"
            return {
                "title": lbl,
                "priority": "high",
                "label": lbl,
                "description": f"Officer notice: '{notice_text}'",
                "approval_id": "QUERY",
                "route": "/applicant",
                "action_type": "NAVIGATE"
            }

        # 2. Check for missing mandatory vault documents
        try:
            completeness = calculate_user_document_completeness(db, user_id)
            missing = completeness.get("missing_documents", [])
            if missing:
                top_missing = missing[0]
                lbl = f"Upload {top_missing.get('document_type_name', 'Required Document')}"
                return {
                    "title": lbl,
                    "priority": "medium",
                    "label": lbl,
                    "description": f"Missing from vault: {top_missing.get('document_type_name')}. Required for connected approval filing.",
                    "approval_id": top_missing.get("approval_ids", ["VAULT"])[0] if top_missing.get("approval_ids") else "VAULT",
                    "route": "/applicant/documents",
                    "action_type": "NAVIGATE"
                }
        except Exception as e:
            logger.warning(f"Error checking missing docs in NextActionService: {e}")

        # 3. Check for upcoming field inspections
        insp = (
            db.query(Inspection)
            .join(Application, Inspection.application_id == Application.id)
            .filter(
                Application.applicant_id == user_id,
                Inspection.status == InspectionStatus.SCHEDULED
            )
            .order_by(Inspection.scheduled_date.asc())
            .first()
        )
        if insp:
            date_str = insp.scheduled_date.strftime("%d %b %Y, %I:%M %p") if insp.scheduled_date else "Scheduled Soon"
            lbl = f"Prepare for Field Inspection"
            return {
                "title": lbl,
                "priority": "medium",
                "label": lbl,
                "description": f"Site visit scheduled on {date_str} by Inspector {insp.inspector_name or 'Field Officer'}.",
                "approval_id": "INSPECTION",
                "route": "/applicant",
                "action_type": "NAVIGATE"
            }

        # 4. Check for unsubmitted applications / drafts
        draft_app = (
            db.query(Application)
            .filter(Application.applicant_id == user_id, Application.status == "DRAFT")
            .first()
        )
        if draft_app:
            lbl = f"Complete {draft_app.project_title or 'Draft Application'}"
            return {
                "title": lbl,
                "priority": "low",
                "label": lbl,
                "description": "Your single-window application draft is saved. Proceed to review and file.",
                "approval_id": "DRAFT",
                "route": "/applications/new",
                "action_type": "NAVIGATE"
            }

        # 5. Default / All Caught Up
        return {
            "title": "All Clear & Caught Up",
            "priority": "none",
            "label": "All Clear & Caught Up",
            "description": "All your statutory applications and vault credentials are active and up to date.",
            "approval_id": None,
            "route": "/applicant",
            "action_type": "NAVIGATE"
        }
