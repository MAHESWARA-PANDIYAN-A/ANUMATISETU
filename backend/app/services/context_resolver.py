import json
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.business_profile import BusinessProfile
from app.models.application import (
    Application,
    ApprovalApplication,
    ApprovalJourney,
    Inspection,
    InspectionStatus,
    UserApprovalSelection,
)
from app.models.document import (
    Document,
    DocumentStatus,
    DocumentValidation,
    DocumentVersion,
    ValidationStatus,
)
from app.services.document_vault_service import calculate_user_document_completeness

logger = logging.getLogger(__name__)


def mask_identifier(val: Optional[str], id_type: str = "GENERIC") -> str:
    """Masks sensitive statutory identifiers (PAN, Aadhaar, Bank) to protect user privacy."""
    if not val or len(val) < 4:
        return "N/A"
    clean = str(val).strip()
    if len(clean) == 10:  # e.g. PAN: ABCDE1234F -> ABC*****4F
        return f"{clean[:3]}*****{clean[-2:]}"
    elif len(clean) == 12:  # e.g. Aadhaar
        return f"XXXX-XXXX-{clean[-4:]}"
    elif len(clean) > 8:
        return f"{clean[:2]}****{clean[-3:]}"
    return f"****{clean[-2:]}"


class ContextResolverService:
    """
    Safely retrieves and assembles a compact, privacy-masked snapshot of the user's
    TASKER data to provide as grounded context for the AI Assistant.
    """

    @staticmethod
    def resolve_user_context(
        db: Session,
        user: User,
        context_input: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        context_input = context_input or {}
        user_id = user.id

        # 1. User basic info
        user_data = {
            "name": user.full_name or "Entrepreneur",
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "email": user.email
        }

        # 2. Business Profile
        business_profile = (
            db.query(BusinessProfile)
            .filter(BusinessProfile.user_id == user_id)
            .first()
        )
        business_data = {}
        if business_profile:
            business_data = {
                "name": business_profile.company_name,
                "business_type": business_profile.business_type,
                "industry": business_profile.industry,
                "activity": business_profile.business_activity,
                "state": business_profile.state,
                "district": business_profile.district,
                "investment_amount_lakhs": business_profile.investment_amount,
                "employee_count": business_profile.employee_count,
                "project_stage": business_profile.project_stage,
                "land_status": business_profile.land_status,
                "existing_approvals": business_profile.existing_approvals or []
            }

        # 3. Selected Approvals & Applications
        approvals_list = []
        app_records = (
            db.query(Application)
            .filter(Application.applicant_id == user_id)
            .order_by(Application.created_at.desc())
            .all()
        )

        for app in app_records:
            status_str = app.status.value if hasattr(app.status, "value") else str(app.status)
            approvals_list.append({
                "approval_id": getattr(app, "approval_id", None) or getattr(app, "service_type", None) or "GENERAL",
                "name": getattr(app, "approval_name", None) or getattr(app, "project_title", None) or "Industrial Application",
                "application_number": app.application_number,
                "status": status_str,
                "current_stage": getattr(app, "current_stage", "Review"),
                "fssai_status": app.fssai_status,
                "gst_status": app.gst_status,
                "udyam_status": app.udyam_status,
                "officer_query": app.fssai_officer_remarks or app.gst_officer_remarks or app.udyam_officer_remarks
            })

        # If no single applications found, check simulated ApprovalApplications via journeys
        sim_apps = (
            db.query(ApprovalApplication)
            .join(ApprovalJourney, ApprovalApplication.journey_id == ApprovalJourney.id)
            .filter(ApprovalJourney.user_id == user_id)
            .all()
        )
        for s in sim_apps:
            if not any(a["approval_id"] == s.approval_id for a in approvals_list):
                approvals_list.append({
                    "approval_id": s.approval_id,
                    "name": s.approval_name or f"{s.approval_id} Statutory Clearance",
                    "application_number": s.external_application_id or f"APP-{s.id}",
                    "status": s.status,
                    "department": s.external_system,
                    "officer_query": s.officer_remarks
                })

        # Also check UserApprovalSelection for selected recommendations
        user_selections = (
            db.query(UserApprovalSelection)
            .filter(UserApprovalSelection.user_id == user_id, UserApprovalSelection.selected == True)
            .all()
        )
        for sel in user_selections:
            if not any(a["approval_id"] == sel.approval_id for a in approvals_list):
                approvals_list.append({
                    "approval_id": sel.approval_id,
                    "name": sel.approval_name,
                    "application_number": "Not yet submitted",
                    "status": sel.status or "SELECTED",
                    "department": sel.department,
                    "officer_query": None
                })

        # 4. Document Vault Summary & Specific Document Detail
        docs_query = (
            db.query(Document)
            .filter(Document.user_id == user_id, Document.status != DocumentStatus.DELETED)
            .all()
        )
        docs_summary = []
        for d in docs_query:
            docs_summary.append({
                "id": d.id,
                "type": getattr(d, "document_type", "DOCUMENT"),
                "title": getattr(d, "document_name", None) or getattr(d, "file_name", "Document"),
                "status": d.status.value if hasattr(d.status, "value") else str(d.status),
                "validation_status": d.validation_status.value if hasattr(d.validation_status, "value") else str(d.validation_status),
                "reusable_across": getattr(d, "reusable_portals", None) or ["FSSAI", "GST", "UDYAM"]
            })

        # Completeness & Missing docs calculation
        try:
            completeness = calculate_user_document_completeness(db, user_id)
            missing_docs = completeness.get("missing_documents", [])
        except Exception as e:
            logger.warning(f"Could not calculate completeness: {e}")
            missing_docs = []

        # 5. Specific Document Focus if requested
        doc_focus = None
        target_doc_id = context_input.get("document_id")
        if target_doc_id:
            target_doc = (
                db.query(Document)
                .filter(Document.id == target_doc_id, Document.user_id == user_id)
                .first()
            )
            if target_doc:
                # Latest validation
                latest_val = (
                    db.query(DocumentValidation)
                    .filter(DocumentValidation.document_id == target_doc.id)
                    .order_by(DocumentValidation.id.desc())
                    .first()
                )
                doc_focus = {
                    "id": target_doc.id,
                    "type": getattr(target_doc, "document_type", "DOCUMENT"),
                    "title": getattr(target_doc, "document_name", None) or getattr(target_doc, "file_name", "Document"),
                    "status": target_doc.status.value if hasattr(target_doc.status, "value") else str(target_doc.status),
                    "validation_status": target_doc.validation_status.value if hasattr(target_doc.validation_status, "value") else str(target_doc.validation_status),
                    "validation_notices": latest_val.missing_fields if latest_val and latest_val.missing_fields else [],
                    "validation_errors": latest_val.discrepancies if latest_val and latest_val.discrepancies else [],
                    "extracted_metadata": latest_val.extracted_data if latest_val else {},
                    "reusable_across": getattr(target_doc, "reusable_portals", None) or ["FSSAI", "GST", "UDYAM"]
                }

        # 6. Specific Application Focus if requested
        app_focus = None
        target_app_id = context_input.get("application_id")
        if target_app_id:
            target_app = (
                db.query(Application)
                .filter(
                    (Application.application_number == target_app_id) | (Application.id == (int(target_app_id) if str(target_app_id).isdigit() else -1)),
                    Application.applicant_id == user_id
                )
                .first()
            )
            if target_app:
                # Check for inspections
                insp = (
                    db.query(Inspection)
                    .filter(Inspection.application_id == target_app.id)
                    .order_by(Inspection.created_at.desc())
                    .first()
                )
                app_focus = {
                    "application_number": target_app.application_number,
                    "approval_name": target_app.approval_name or target_app.service_type,
                    "status": target_app.status.value if hasattr(target_app.status, "value") else str(target_app.status),
                    "current_stage": target_app.current_stage,
                    "officer_query": target_app.officer_query,
                    "inspection": {
                        "scheduled_date": insp.scheduled_date.isoformat() if insp and insp.scheduled_date else None,
                        "inspector_name": insp.inspector_name if insp else None,
                        "status": insp.status.value if insp and hasattr(insp.status, "value") else (str(insp.status) if insp else None)
                    } if insp else None
                }

        # 7. Pending Actions synthesis
        pending_actions = []
        for app in approvals_list:
            st = app.get("status", "").upper()
            if "QUERY" in st or app.get("officer_query"):
                pending_actions.append({
                    "priority": "high",
                    "label": f"Respond to {app.get('approval_id')} Document Query",
                    "description": f"Officer requested: {app.get('officer_query') or 'Clarification on submitted credentials.'}",
                    "approval_id": app.get("approval_id"),
                    "route": f"/applicant"
                })

        if missing_docs:
            pending_actions.append({
                "priority": "medium",
                "label": f"Upload {len(missing_docs)} Missing Vault Document(s)",
                "description": f"Mandatory credentials missing for approved filing: {', '.join([m.get('document_type_name', 'Doc') for m in missing_docs[:3]])}.",
                "route": "/applicant/documents"
            })

        return {
            "user": user_data,
            "business": business_data,
            "approvals": approvals_list,
            "documents_summary": docs_summary,
            "missing_documents": missing_docs,
            "document": doc_focus,
            "application": app_focus,
            "page": context_input.get("page", "dashboard"),
            "pending_actions": pending_actions
        }

    @staticmethod
    def format_context_for_prompt(context_dict: Dict[str, Any]) -> str:
        """Formats the context object into a clean, concise string for the system prompt."""
        return json.dumps(context_dict, indent=2, default=str)
