import json
import logging
import os
from typing import Any, Dict, List, Optional
from app.models.business_profile import BusinessProfile

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCHEMES_DB_PATH = os.path.join(os.path.dirname(BASE_DIR), "data", "schemes", "schemes_db.json")

_SCHEMES_CACHE: List[Dict[str, Any]] = []


def load_schemes_db() -> List[Dict[str, Any]]:
    """Loads and caches the curated schemes knowledge base."""
    global _SCHEMES_CACHE
    if _SCHEMES_CACHE:
        return _SCHEMES_CACHE

    if os.path.exists(SCHEMES_DB_PATH):
        try:
            with open(SCHEMES_DB_PATH, "r", encoding="utf-8") as f:
                _SCHEMES_CACHE = json.load(f)
                logger.info(f"Loaded {len(_SCHEMES_CACHE)} government schemes from {SCHEMES_DB_PATH}")
                return _SCHEMES_CACHE
        except Exception as e:
            logger.error(f"Error loading schemes database: {e}")

    return []


def match_schemes_for_profile(
    profile: BusinessProfile,
    use_ai_explanations: bool = True
) -> List[Dict[str, Any]]:
    """
    Deterministic rule-based matching of government schemes against an applicant's business profile,
    with AI-assisted explanation layer.
    """
    schemes = load_schemes_db()
    matched_results = []

    profile_industry = (profile.industry or "").lower()
    profile_state = (profile.state or "Maharashtra").lower()
    profile_business_type = (profile.business_type or "").lower()
    profile_stage = (profile.project_stage or "").lower()
    profile_investment = float(profile.investment_amount or 0.0)

    for s in schemes:
        # 1. State check
        scheme_state = s.get("state", "Maharashtra").lower()
        if scheme_state != "all" and scheme_state != profile_state:
            continue

        # 2. Industry check
        applicable_industries = [i.lower() for i in s.get("applicable_industries", [])]
        industry_match = "all" in applicable_industries or any(
            ind in profile_industry or profile_industry in ind for ind in applicable_industries
        )

        # 3. Business type check
        applicable_biz_types = [b.lower() for b in s.get("business_types", [])]
        biz_match = "all" in applicable_biz_types or any(
            bt in profile_business_type or profile_business_type in bt for bt in applicable_biz_types
        )

        # 4. Investment bounds check
        inv_cond = s.get("investment_conditions", {})
        min_inv = inv_cond.get("min_investment") or 0.0
        max_inv = inv_cond.get("max_investment")

        investment_match = profile_investment >= min_inv
        if max_inv is not None and profile_investment > max_inv:
            investment_match = False

        # 5. Project stage check
        applicable_stages = [st.lower() for st in s.get("project_stages", [])]
        stage_match = "all" in applicable_stages or any(
            st in profile_stage or profile_stage in st for st in applicable_stages
        )

        # Determine overall match
        if industry_match and investment_match and (biz_match or stage_match):
            score = 0.85
            if industry_match and biz_match and investment_match and stage_match:
                score = 0.95

            # Deterministic default explanation
            why_relevant = (
                f"Potentially relevant because {profile.company_name} is operating in the {profile.industry} sector "
                f"in {profile.state} with a planned capital outlay of ₹{(profile_investment / 100000):.1f} Lakhs "
                f"at the {profile.project_stage} stage."
            )

            matched_results.append({
                "id": s["id"],
                "scheme_name": s["scheme_name"],
                "department": s["department"],
                "state": s["state"],
                "relevance_status": "Potentially relevant",
                "match_score": score,
                "why_relevant": why_relevant,
                "benefits": s.get("benefits", []),
                "eligibility_conditions": s.get("eligibility_conditions", []),
                "investment_conditions": s.get("investment_conditions", {}),
                "required_documents": s.get("required_documents", []),
                "source": s.get("source", ""),
                "last_verified_date": s.get("last_verified_date", "2026-08-20")
            })

    # Sort by match score descending
    matched_results.sort(key=lambda x: x["match_score"], reverse=True)

    # Optional AI enhancement for explanations
    if use_ai_explanations and matched_results:
        try:
            from app.services.ai_service import explain_schemes_with_ai
            matched_results = explain_schemes_with_ai(profile, matched_results)
        except Exception as e:
            logger.warning(f"AI scheme explanation fallback to deterministic rules: {e}")

    return matched_results
