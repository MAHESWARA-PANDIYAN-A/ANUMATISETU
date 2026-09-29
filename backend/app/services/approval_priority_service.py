import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.approval_intelligence import (
    ApprovalCatalog,
    ApprovalRule,
    ApprovalDependency,
    ApprovalCoverage,
)
from app.models.business_profile import BusinessProfile
from app.models.application import ApprovalApplication, UserApprovalSelection
from app.services.approval_reason_service import ApprovalReasonService

logger = logging.getLogger(__name__)


class ApprovalPriorityService:
    """
    Deterministic rule-based Priority Engine that computes workflow sequence,
    parallel execution paths, dependency relations, and actionable labels.
    """

    PRIORITY_WEIGHTS = {
        "CRITICAL": 100,
        "HIGH": 75,
        "MEDIUM": 50,
        "LOW": 25,
    }

    @staticmethod
    def get_dependencies_map(db: Session) -> Dict[str, List[Dict[str, Any]]]:
        deps = db.query(ApprovalDependency).filter(ApprovalDependency.active == True).all()
        mapping = {}
        for d in deps:
            if d.approval_id not in mapping:
                mapping[d.approval_id] = []
            mapping[d.approval_id].append({
                "depends_on": d.depends_on_approval_id,
                "dependency_type": d.dependency_type,
                "description": d.description,
            })
        return mapping

    @staticmethod
    def calculate_approval_plan(
        db: Session,
        profile: Optional[BusinessProfile],
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Calculates the complete 'Your Approval Plan' structure with deterministic
        priority labels, sequence order, why-needed reasons, and parallel execution tags.
        """
        if not profile:
            return {"business_profile_id": None, "items": [], "total": 0}

        reasons = ApprovalReasonService.get_approval_reasons_for_profile(db, profile)
        deps_map = ApprovalPriorityService.get_dependencies_map(db)
        coverages = {c.approval_id: c for c in db.query(ApprovalCoverage).filter(ApprovalCoverage.active == True).all()}

        # Fetch existing user applications if any
        app_statuses = {}
        if user_id:
            user_apps = db.query(ApprovalApplication).join(
                ApprovalApplication.journey
            ).filter(ApprovalApplication.journey.has(user_id=user_id)).all()
            for ua in user_apps:
                app_statuses[ua.approval_id] = {
                    "status": ua.status,
                    "external_application_id": ua.external_application_id,
                    "registration_ref": ua.registration_ref,
                }

        # Priority calculation
        scored_items = []
        for r in reasons:
            approval_id = r["approval_id"]
            base_score = ApprovalPriorityService.PRIORITY_WEIGHTS.get(r["base_priority"], 50)
            
            # Specific food industry priority logic
            if approval_id == "FSSAI" and "food" in (profile.industry or "").lower():
                base_score += 50  # Must be prepared first for food businesses
            elif approval_id == "GST":
                base_score += 20
            elif approval_id == "UDYAM":
                base_score += 15

            # Deduct if already approved
            curr_app = app_statuses.get(approval_id)
            if curr_app and curr_app["status"] == "APPROVED":
                base_score -= 100

            cov = coverages.get(approval_id)
            item_deps = deps_map.get(approval_id, [])

            scored_items.append({
                "approval_id": approval_id,
                "code": approval_id,
                "approval_name": r["approval_name"],
                "department": r["department"],
                "category": r["category"],
                "base_priority": r["base_priority"],
                "calculated_score": base_score,
                "reason": r["reason"],
                "matched_factors": r["matched_factors"],
                "dependencies": item_deps,
                "coverage_type": cov.coverage_type if cov else r.get("online_coverage", "HYBRID"),
                "tasker_capabilities": cov.tasker_capabilities_json if cov else ["APPLICATION_PREPARATION", "STATUS_TRACKING"],
                "external_steps": cov.external_steps_json if cov else ([] if not r.get("external_requirement") else [r["external_requirement"]]),
                "authority": cov.authority if cov else "Competent Authority",
                "authority_location": cov.authority_location if cov else "Local Jurisdiction",
                "source": r["source"],
                "last_verified_date": r["last_verified_date"],
                "current_status": curr_app["status"] if curr_app else "NOT_STARTED",
                "registration_ref": curr_app.get("registration_ref") if curr_app else None,
            })

        # Sort descending by calculated score
        scored_items.sort(key=lambda x: x["calculated_score"], reverse=True)

        # Assign friendly Sequence labels
        final_items = []
        for idx, item in enumerate(scored_items):
            seq_num = idx + 1
            if seq_num == 1:
                label = "Start First"
                priority_badge = "HIGH" if item["base_priority"] in ["CRITICAL", "HIGH"] else "MEDIUM"
                priority_explanation = (
                    "Recommended first because this workflow is configured as the foundational statutory clearance for your industry."
                )
            elif seq_num == 2 or seq_num == 3:
                label = "Can Run in Parallel"
                priority_badge = "HIGH" if item["base_priority"] == "HIGH" else "MEDIUM"
                priority_explanation = (
                    "Can be prepared concurrently alongside other clearances; no blocking prerequisite is configured."
                )
            else:
                label = "Plan Next"
                priority_badge = item["base_priority"]
                priority_explanation = (
                    "Can be completed at your preferred pace once foundational registrations are underway."
                )

            # Determine next action
            status = item["current_status"]
            if status == "NOT_STARTED":
                next_action = "Prepare Application"
            elif status == "DOCUMENT_QUERY":
                next_action = "Respond to Query"
            elif status == "UNDER_REVIEW":
                next_action = "Awaiting Department Review"
            elif status == "APPROVED":
                next_action = "Active License (View Compliance)"
            else:
                next_action = "Track Progress"

            final_items.append({
                **item,
                "sequence": seq_num,
                "priority_label": label,
                "workflow_priority": priority_badge,
                "priority_explanation": priority_explanation,
                "next_action": next_action,
                "can_override_sequence": True,
            })

        return {
            "business_profile_id": profile.id,
            "company_name": profile.company_name,
            "industry": profile.industry,
            "location": f"{profile.district}, {profile.state}",
            "title": "Your Approval Plan",
            "subtitle": "ANUMATISETU has organized the approvals that may be relevant to your business and the order in which you may want to address them.",
            "disclaimer": "ANUMATISETU Workflow Priority is a rule-based operational recommendation, not an official government mandate.",
            "total": len(final_items),
            "items": final_items,
        }
