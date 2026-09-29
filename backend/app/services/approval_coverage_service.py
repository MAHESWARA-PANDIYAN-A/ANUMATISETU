import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.approval_intelligence import (
    ApprovalCatalog,
    ApprovalCoverage,
    ExternalWorkflowStep,
)
from app.models.business_profile import BusinessProfile
from app.models.document import Document

logger = logging.getLogger(__name__)


class ApprovalCoverageService:
    """
    Manages digital vs hybrid vs external process capabilities,
    district/authority mapping, and external step tracking.
    """

    COVERAGE_LABELS = {
        "ONLINE": {
            "title": "ANUMATISETU Managed",
            "badge": "Digital Workflow",
            "user_label": "Can be handled in ANUMATISETU",
            "description": "The configured statutory workflow can be completed entirely through ANUMATISETU's connected digital workflow and instant portal submission.",
            "color": "emerald",
        },
        "HYBRID": {
            "title": "Hybrid Workflow",
            "badge": "Hybrid",
            "user_label": "Partly requires external action",
            "description": "ANUMATISETU prepares, pre-validates, and tracks the application, but some required steps (e.g. physical premise inspection or lab testing) occur externally.",
            "color": "amber",
        },
        "EXTERNAL": {
            "title": "External Process",
            "badge": "External Action Required",
            "user_label": "Requires external action",
            "description": "ANUMATISETU provides guidance, checklists, and milestone tracking, but application submission or physical audits must happen directly with the department.",
            "color": "rose",
        },
        "GUIDANCE_ONLY": {
            "title": "Information Only",
            "badge": "Guidance Only",
            "user_label": "ANUMATISETU can guide and track",
            "description": "Advisory workflow information and compliance checklists.",
            "color": "blue",
        },
    }

    @staticmethod
    def get_coverage_for_profile(
        db: Session,
        profile: Optional[BusinessProfile]
    ) -> Dict[str, Any]:
        """
        Returns all relevant coverage configurations for the user's registered district/state,
        with summary statistics and geo coordinates for the map.
        """
        coverages = db.query(ApprovalCoverage).filter(ApprovalCoverage.active == True).all()
        catalogs = {c.code: c for c in db.query(ApprovalCatalog).all()}

        # Business anchor coordinates (Salem, TN default if not specified)
        business_location = {
            "company_name": profile.company_name if profile else "Enterprise",
            "district": profile.district if profile else "Salem",
            "state": profile.state if profile else "Tamil Nadu",
            "latitude": 11.6643 if (profile and "salem" in profile.district.lower()) else 11.6643,
            "longitude": 78.1460 if (profile and "salem" in profile.district.lower()) else 78.1460,
            "address": profile.address if profile else "Industrial Estate, Salem",
        }

        items = []
        counts = {"ONLINE": 0, "HYBRID": 0, "EXTERNAL": 0, "GUIDANCE_ONLY": 0}

        for cov in coverages:
            ctype = cov.coverage_type
            if ctype in counts:
                counts[ctype] += 1
            meta = ApprovalCoverageService.COVERAGE_LABELS.get(ctype, ApprovalCoverageService.COVERAGE_LABELS["HYBRID"])
            cat = catalogs.get(cov.approval_id)

            has_coords = cov.latitude is not None and cov.longitude is not None

            # Fetch active external workflow steps for this approval if any
            ext_steps = db.query(ExternalWorkflowStep).filter(
                ExternalWorkflowStep.approval_id == cov.approval_id
            ).all()

            items.append({
                "id": cov.id,
                "approval_id": cov.approval_id,
                "approval_name": cat.name if cat else cov.approval_id,
                "department": cat.department if cat else "Department",
                "coverage_type": cov.coverage_type,
                "coverage_label": meta["title"],
                "user_friendly_label": meta["user_label"],
                "badge_label": meta["badge"],
                "badge_color": meta["color"],
                "description": meta["description"],
                "tasker_capabilities": cov.tasker_capabilities_json or [],
                "external_steps": cov.external_steps_json or [],
                "authority": cov.authority,
                "authority_location": cov.authority_location or "External location not configured",
                "has_coordinates": has_coords,
                "latitude": cov.latitude,
                "longitude": cov.longitude,
                "source": cov.source,
                "last_verified_date": cov.last_verified_date,
                "active_external_steps_count": len(ext_steps),
                "external_steps_tracking": [
                    {
                        "id": s.id,
                        "step_name": s.step_name,
                        "description": s.description,
                        "step_type": s.step_type,
                        "status": s.status,
                        "required": s.required,
                        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                        "proof_document_id": s.proof_document_id,
                    }
                    for s in ext_steps
                ],
            })

        return {
            "business_location": business_location,
            "summary": {
                "total_workflows": len(items),
                "online_count": counts["ONLINE"],
                "hybrid_count": counts["HYBRID"],
                "external_count": counts["EXTERNAL"],
                "guidance_count": counts["GUIDANCE_ONLY"],
            },
            "items": items,
        }

    @staticmethod
    def complete_external_step(
        db: Session,
        step_id: int,
        proof_document_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Marks an external workflow step as complete with explicit applicant confirmation
        and optional proof document linking in the Document Center.
        """
        step = db.query(ExternalWorkflowStep).filter(ExternalWorkflowStep.id == step_id).first()
        if not step:
            raise ValueError(f"External workflow step with ID {step_id} not found.")

        now = datetime.now(timezone.utc)
        step.status = "COMPLETED"
        step.completed_at = now
        if proof_document_id:
            step.proof_document_id = proof_document_id
        if notes:
            step.notes = notes

        db.commit()
        db.refresh(step)

        return {
            "success": True,
            "message": f"External step '{step.step_name}' marked as complete.",
            "step_id": step.id,
            "status": step.status,
            "completed_at": step.completed_at.isoformat(),
            "proof_document_id": step.proof_document_id,
        }
