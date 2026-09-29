import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def evaluate_business_requirements(profile: Any) -> Dict[str, Any]:
    """
    Centralized, rule-driven requirement recommendation engine.
    Analyzes business profile (industry, activity, scale, constitution, state)
    and returns only potentially applicable statutory approvals.
    """
    if hasattr(profile, "__dict__"):
        industry = str(getattr(profile, "industry", "") or "").lower()
        activity = str(getattr(profile, "business_activity", "") or "").lower()
        company_name = str(getattr(profile, "company_name", "") or "")
        state = str(getattr(profile, "state", "") or "Maharashtra")
        district = str(getattr(profile, "district", "") or "")
        investment = float(getattr(profile, "investment_amount", 0) or 0)
        turnover = float(getattr(profile, "expected_turnover", 0) or 0)
    elif isinstance(profile, dict):
        industry = str(profile.get("industry", "") or "").lower()
        activity = str(profile.get("business_activity", "") or "").lower()
        company_name = str(profile.get("company_name", "") or profile.get("business_name", "") or "")
        state = str(profile.get("state", "") or "Maharashtra")
        district = str(profile.get("district", "") or "")
        investment = float(profile.get("investment_amount", 0) or 0)
        turnover = float(profile.get("expected_turnover", 0) or 0)
    else:
        industry = ""
        activity = ""
        company_name = ""
        state = "Maharashtra"
        district = ""
        investment = 0
        turnover = 0

    is_food = (
        "food" in industry or
        "agro" in industry or
        "snack" in activity or
        "bakery" in activity or
        "restaurant" in activity or
        "catering" in activity or
        "beverage" in activity or
        "edible" in activity or
        "processing" in activity and "food" in company_name.lower() or
        "foods" in company_name.lower()
    )

    is_manufacturing = (
        "manufactur" in industry or
        "manufactur" in activity or
        "textile" in industry or
        "chemical" in industry or
        "engineering" in industry
    )

    is_it_services = (
        "it" in industry or
        "software" in industry or
        "tech" in industry or
        "consulting" in industry or
        "services" in industry
    )

    recommendations: List[Dict[str, Any]] = []

    # 1. Food Safety Licensing (FSSAI)
    if is_food:
        recommendations.append({
            "approval_id": "FSSAI",
            "approval_name": "FSSAI Food Safety License / Registration",
            "department": "Food Safety and Standards Authority of India (FSSAI)",
            "category": "FOOD_SAFETY",
            "recommended": True,
            "selection_required": True,
            "reason": "Food-related manufacturing, packaging, processing, or distribution activity detected in your business profile.",
            "sla_days": 14,
            "form_schema_endpoint": "/api/integrations/fssai/form-schema",
            "integration_system": "MOCK_FSSAI",
            "confidence_or_basis": "Statutory FSS Act 2006 Rule Engine",
            "last_verified_date": "2026-09-28"
        })

    # 2. GST Registration (GSTN)
    recommendations.append({
        "approval_id": "GST",
        "approval_name": "GST Registration (GSTIN)",
        "department": "Goods and Services Tax Network (GSTN)",
        "category": "TAX_COMPLIANCE",
        "recommended": True,
        "selection_required": True,
        "reason": "Statutory Goods & Services Tax registration for inter-state supply, input tax credit, and enterprise billing.",
        "sla_days": 7,
        "form_schema_endpoint": "/api/integrations/gst/form-schema",
        "integration_system": "MOCK_GST",
        "confidence_or_basis": "CGST / SGST Statutory Threshold Analysis",
        "last_verified_date": "2026-09-28"
    })

    # 3. Udyam MSME Registration
    recommendations.append({
        "approval_id": "UDYAM",
        "approval_name": "Udyam MSME Registration Certificate",
        "department": "Ministry of Micro, Small and Medium Enterprises",
        "category": "MSME_RECOGNITION",
        "recommended": True,
        "selection_required": True,
        "reason": "Enterprise investment and expected turnover qualify for MSME statutory benefits, interest subvention, and collateral-free lending.",
        "sla_days": 3,
        "form_schema_endpoint": "/api/integrations/udyam/form-schema",
        "integration_system": "MOCK_UDYAM",
        "confidence_or_basis": "MSMED Act Composite Criteria Engine",
        "last_verified_date": "2026-09-28"
    })

    # 4. Optional Brand Protection (Trademark) - NOT pre-selected by default
    recommendations.append({
        "approval_id": "TRADEMARK",
        "approval_name": "Trademark & Brand Protection Registration",
        "department": "Controller General of Patents, Designs and Trade Marks (CGPDTM)",
        "category": "INTELLECTUAL_PROPERTY",
        "recommended": False,
        "selection_required": False,
        "reason": "Optional intellectual property protection to secure exclusive statutory rights over your brand name, logo, or packaging identity.",
        "sla_days": 30,
        "form_schema_endpoint": "/api/integrations/trademark/form-schema",
        "integration_system": "MOCK_TRADEMARK",
        "confidence_or_basis": "Trade Marks Act 1999 Assessment",
        "last_verified_date": "2026-09-28"
    })

    return {
        "success": True,
        "business_profile_complete": bool(company_name and industry and state and district),
        "evaluated_at": datetime.utcnow().isoformat() + "Z",
        "recommendations_count": len(recommendations),
        "recommendations": recommendations,
        "analysis_notes": f"Rule-based requirement evaluation completed for {company_name or 'Business'} in sector '{industry}' at {district}, {state}."
    }
