import json
import logging
import os
from typing import Any, Dict, List, Optional
from app.models.business_profile import BusinessProfile

logger = logging.getLogger(__name__)


def get_knowledge_base_path() -> str:
    """Resolves the path to the controlled approvals knowledge base."""
    # Check root /data/approvals first, then backend/data/approvals
    candidate_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "approvals", "approvals_db.json"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "approvals", "approvals_db.json"),
        os.path.abspath("data/approvals/approvals_db.json")
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            return p
    # Fallback default
    return candidate_paths[0]


def load_approvals_knowledge_base() -> List[Dict[str, Any]]:
    """Loads and caches the structured approval rules from the controlled dataset."""
    path = get_knowledge_base_path()
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load approvals knowledge base from {path}: {e}")
        return []


def match_approvals_deterministic(profile: BusinessProfile) -> List[Dict[str, Any]]:
    """
    Executes deterministic rule matching against the controlled knowledge base.
    STRICT RULE: Only approvals existing in the controlled dataset may ever be matched.
    """
    knowledge_base = load_approvals_knowledge_base()
    matched: List[Dict[str, Any]] = []

    profile_industry_lower = profile.industry.lower().strip()
    profile_state_lower = profile.state.lower().strip()
    profile_stage_lower = profile.project_stage.lower().strip()
    existing_approvals_lower = [a.lower().strip() for a in (profile.existing_approvals or [])]

    for item in knowledge_base:
        # 1. State Filtering
        app_states = [s.lower().strip() for s in item.get("applicable_states", [])]
        if "all" not in app_states and profile_state_lower not in app_states:
            continue

        # 2. Industry Filtering
        app_industries = [ind.lower().strip() for ind in item.get("applicable_industries", [])]
        industry_match = False
        if "all" in app_industries:
            industry_match = True
        else:
            for ind in app_industries:
                if ind in profile_industry_lower or profile_industry_lower in ind:
                    industry_match = True
                    break
                # Special keyword overlaps (e.g. food -> agro/food processing)
                if ("food" in profile_industry_lower or "agro" in profile_industry_lower) and ("food" in ind or "agro" in ind):
                    industry_match = True
                    break

        if not industry_match:
            continue

        # 3. Employee Condition Filtering (e.g. Factories Act 10+ workers)
        emp_cond = item.get("employee_conditions", {})
        min_emp = emp_cond.get("min_employees", 1)
        if profile.employee_count < min_emp and item.get("id") in ["dish-factory-license", "dish-factory-plan-approval", "labour-contract-registration"]:
            continue

        # 4. Status Determination (Checks if already in existing_approvals)
        approval_name = item.get("approval_name", "")
        approval_name_lower = approval_name.lower()
        already_obtained = False
        for ex in existing_approvals_lower:
            if ex in approval_name_lower or approval_name_lower in ex:
                already_obtained = True
                break
            if "fssai" in ex and "fssai" in approval_name_lower:
                already_obtained = True
                break
            if "cte" in ex and "consent to establish" in approval_name_lower:
                already_obtained = True
                break
            if "cto" in ex and "consent to operate" in approval_name_lower:
                already_obtained = True
                break
            if "fire" in ex and "fire" in approval_name_lower:
                already_obtained = True
                break

        if already_obtained:
            status = "ALREADY_OBTAINED"
        elif item.get("is_mandatory", True):
            status = "MANDATORY"
        else:
            status = "CONDITIONAL"

        # 5. Deterministic Base Applicability Reason
        base_confidence = item.get("confidence_base", 0.95)
        if status == "MANDATORY":
            applicability_reason = (
                f"Statutorily required for '{profile.company_name}' operating in the {profile.industry} sector "
                f"in {profile.district}, {profile.state} under {item.get('source')}."
            )
        elif status == "ALREADY_OBTAINED":
            applicability_reason = (
                f"Recorded as already obtained in your enterprise profile. Keep renewal timelines monitored."
            )
        else:
            applicability_reason = (
                f"Conditionally applicable for '{profile.company_name}' based on operational parameters and equipment setup."
            )

        matched.append({
            "id": item.get("id"),
            "approval_name": approval_name,
            "department": item.get("department", ""),
            "applicability_reason": applicability_reason,
            "required_documents": item.get("required_documents", []),
            "source": item.get("source", ""),
            "confidence": base_confidence,
            "status": status,
            "description": item.get("description", ""),
            "category": item.get("category", "General"),
            "last_verified_date": item.get("last_verified_date", "")
        })

    # Sort: Mandatory first, then Conditional, then Already Obtained
    priority = {"MANDATORY": 1, "CONDITIONAL": 2, "ALREADY_OBTAINED": 3}
    matched.sort(key=lambda x: (priority.get(x["status"], 4), -x["confidence"]))
    return matched
