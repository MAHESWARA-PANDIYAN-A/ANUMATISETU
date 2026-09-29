import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.approval_intelligence import ApprovalCatalog, ApprovalRule
from app.models.business_profile import BusinessProfile

logger = logging.getLogger(__name__)


class ApprovalReasonService:
    """
    Deterministic rule-based service that determines why an approval is recommended,
    which factors matched, conditions checked, and citations attached.
    """

    @staticmethod
    def get_approval_reasons_for_profile(db: Session, profile: Optional[BusinessProfile]) -> List[Dict[str, Any]]:
        if not profile:
            return []

        rules = db.query(ApprovalRule).filter(ApprovalRule.active == True).all()
        catalogs = {c.code: c for c in db.query(ApprovalCatalog).filter(ApprovalCatalog.active == True).all()}

        results = []
        matched_approval_ids = set()

        for rule in rules:
            matches = True
            matched_factors = []

            # 1. Industry match
            if rule.industry:
                if profile.industry and rule.industry.lower() in profile.industry.lower():
                    matched_factors.append(f"Industry: {profile.industry}")
                else:
                    matches = False

            # 2. Business Activity match
            if matches and rule.business_activity:
                if profile.business_activity and (
                    rule.business_activity.lower() in profile.business_activity.lower()
                    or profile.business_activity.lower() in str(profile.industry or "").lower()
                ):
                    matched_factors.append(f"Activity: {profile.business_activity}")
                else:
                    # If specific activity doesn't match perfectly but industry matched food
                    if rule.approval_id == "FSSAI" and "food" in (profile.industry or "").lower():
                        matched_factors.append(f"Industry Activity: {profile.industry}")
                    else:
                        matches = False

            # 3. Investment threshold match
            if matches and rule.investment_min is not None and rule.investment_min > 0:
                inv_amt = profile.investment_amount or 0.0
                if inv_amt >= rule.investment_min:
                    matched_factors.append(f"Investment: ₹{inv_amt:.2f} Lakhs (Threshold >= ₹{rule.investment_min:.2f} Lakhs)")
                else:
                    matches = False

            if matches and rule.investment_max is not None:
                inv_amt = profile.investment_amount or 0.0
                if inv_amt <= rule.investment_max:
                    matched_factors.append(f"Investment Cap: ₹{inv_amt:.2f} Lakhs <= ₹{rule.investment_max:.2f} Lakhs")
                else:
                    matches = False

            # 4. Employee count match
            if matches and rule.employee_min is not None and rule.employee_min > 0:
                emp = profile.employee_count or 0
                if emp >= rule.employee_min:
                    matched_factors.append(f"Workforce: {emp} Employees (Threshold >= {rule.employee_min})")
                else:
                    matches = False

            # 5. Generic commercial operations
            if matches and not rule.industry and not rule.business_activity:
                matched_factors.append("Enterprise Commercial Operations")

            if matches:
                matched_approval_ids.add(rule.approval_id)
                catalog = catalogs.get(rule.approval_id)
                formatted_reason = rule.reason_template.format(
                    company_name=profile.company_name or "Enterprise",
                    industry=profile.industry or "General Industry",
                    business_type=profile.business_type or "Commercial Entity",
                    state=profile.state or "State",
                    district=profile.district or "District",
                    investment=profile.investment_amount or 0.0,
                    employees=profile.employee_count or 0,
                )

                results.append({
                    "approval_id": rule.approval_id,
                    "code": rule.approval_id,
                    "approval_name": catalog.name if catalog else rule.approval_id,
                    "department": catalog.department if catalog else "State/Central Department",
                    "category": catalog.category if catalog else "Statutory",
                    "recommended": True,
                    "reason": formatted_reason,
                    "matched_factors": matched_factors,
                    "base_priority": rule.priority_base,
                    "online_coverage": rule.online_coverage,
                    "external_requirement": rule.external_requirement,
                    "source": rule.source,
                    "last_verified_date": rule.last_verified_date,
                })

        return results

    @staticmethod
    def get_reason_for_approval(db: Session, approval_id: str, profile: Optional[BusinessProfile]) -> Dict[str, Any]:
        all_reasons = ApprovalReasonService.get_approval_reasons_for_profile(db, profile)
        for r in all_reasons:
            if r["approval_id"] == approval_id:
                return r

        # Fallback to catalog definition if not dynamically triggered
        catalog = db.query(ApprovalCatalog).filter(ApprovalCatalog.code == approval_id).first()
        return {
            "approval_id": approval_id,
            "code": approval_id,
            "approval_name": catalog.name if catalog else approval_id,
            "department": catalog.department if catalog else "Department",
            "category": catalog.category if catalog else "Statutory",
            "recommended": False,
            "reason": "This approval is part of the statutory catalog, but may not be strictly triggered by current business parameters.",
            "matched_factors": ["Catalog Listing"],
            "base_priority": "LOW",
            "online_coverage": "HYBRID",
            "external_requirement": None,
            "source": catalog.source if catalog else "Statutory Regulations",
            "last_verified_date": catalog.last_verified_date if catalog else "2026-09-01",
        }
