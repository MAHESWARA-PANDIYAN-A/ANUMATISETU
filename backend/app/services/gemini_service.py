import json
import logging
from typing import Any, Dict, List, Tuple
from app.core.config import settings
from app.models.business_profile import BusinessProfile

logger = logging.getLogger(__name__)


def generate_deterministic_explanations(
    profile: BusinessProfile,
    matched_approvals: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Fallback explanation generator that constructs legally grounded, clear explanations
    without relying on external LLM APIs.
    """
    results: List[Dict[str, Any]] = []
    inv_lakhs = round(profile.investment_amount / 100000.0, 2)

    for item in matched_approvals:
        app_id = item.get("id", "")
        name = item.get("approval_name", "")
        dept = item.get("department", "")
        source = item.get("source", "")
        status = item.get("status", "MANDATORY")
        confidence = item.get("confidence", 0.95)

        # Context-specific explanation based on business profile
        if "fssai" in app_id:
            reason = (
                f"Because '{profile.company_name}' operates in the {profile.industry} sector, "
                f"Section 31 of the Food Safety & Standards Act mandates a valid manufacturing license "
                f"before any food production or commercial distribution can begin in {profile.district}."
            )
        elif "mpcb-cte" in app_id:
            reason = (
                f"Required for '{profile.company_name}' prior to commencing factory construction or installing plant machinery "
                f"with proposed capital investment of ₹{inv_lakhs} Lakhs under Maharashtra State Pollution Control norms."
            )
        elif "mpcb-cto" in app_id:
            reason = (
                f"Operating consent required before commercial commissioning and trial runs for '{profile.company_name}' "
                f"to verify effluent and environmental management compliance."
            )
        elif "fire" in app_id:
            reason = (
                f"Fire life safety clearance mandated for industrial building premises in {profile.district} "
                f"to ensure setbacks, emergency evacuation routes, and firefighting apparatus meet National Building Code standards."
            )
        elif "dish-factory" in app_id:
            reason = (
                f"Mandatory under the Factories Act 1948 because '{profile.company_name}' plans to engage {profile.employee_count} employees "
                f"(meeting or exceeding the statutory threshold of 10 workers with electric power)."
            )
        elif "msedcl" in app_id:
            reason = (
                f"Necessary for '{profile.company_name}' to verify high/low tension industrial power feasibility and secure sanctioned electrical load."
            )
        elif "legal-metrology" in app_id:
            reason = (
                f"Applicable for '{profile.company_name}' for pre-packaged commodities to verify declared weights, measures, labeling, and retail packaging compliance."
            )
        elif "cgwa" in app_id:
            reason = (
                f"Conditionally applicable if '{profile.company_name}' abstracts groundwater via private borewells in {profile.district}."
            )
        elif "boiler" in app_id:
            reason = (
                f"Conditionally required if '{profile.company_name}' installs steam boilers or pressurized steam vessels exceeding statutory volume limits."
            )
        elif "midc" in app_id:
            reason = (
                f"Mandatory for factory construction and occupancy approval if the plant is established on MIDC allotted land."
            )
        elif "labour" in app_id:
            reason = (
                f"Required if '{profile.company_name}' deploys 20 or more contract workers through registered contractors."
            )
        else:
            reason = (
                f"Statutory clearance applicable to '{profile.company_name}' based on industry classification ({profile.industry}) "
                f"and operational location ({profile.district}, {profile.state})."
            )

        results.append({
            "approval_name": name,
            "department": dept,
            "applicability_reason": reason,
            "required_documents": item.get("required_documents", []),
            "source": source,
            "confidence": confidence,
            "status": status
        })

    return results


def explain_approvals_with_gemini(
    profile: BusinessProfile,
    matched_approvals: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Uses Gemini strictly as an explanation and summarization layer for pre-matched approvals.
    CRITICAL: Does not invent or introduce any new approvals outside matched_approvals.
    Returns: (recommendations_list, provider_used)
    """
    if not matched_approvals:
        return [], "None"

    api_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
    is_mock_key = not api_key or api_key.startswith("mock_") or "your_gemini" in api_key or len(api_key) < 20

    if is_mock_key:
        logger.info("Using deterministic regulatory explanation engine (No external Gemini API key configured).")
        return generate_deterministic_explanations(profile, matched_approvals), "Deterministic-Rule-Engine"

    # Attempt to call Gemini for tailored conversational explanation of pre-matched approvals
    try:
        # Prepare strictly bounded payload for Gemini
        approvals_context = [
            {
                "approval_name": a["approval_name"],
                "department": a["department"],
                "source": a["source"],
                "status": a["status"],
                "confidence": a["confidence"],
                "required_documents": a["required_documents"]
            }
            for a in matched_approvals
        ]

        system_instruction = (
            "You are an industrial regulatory assistant for Maharashtra Single-Window Approvals (SIH26130).\n"
            "STRICT CONSTRAINT: You are strictly forbidden from inventing, adding, or modifying any legal approvals, laws, or departments.\n"
            "You must ONLY explain the exact approvals provided in the input list.\n"
            "For each approval in the list, write a concise, tailored 'applicability_reason' (1-2 sentences) explaining why it applies to this specific applicant "
            "based on their company name, industry, employees, investment, district, or project stage.\n"
            "Return a valid JSON array of objects with keys: 'approval_name', 'department', 'applicability_reason', 'required_documents', 'source', 'confidence', 'status'.\n"
            "Preserve the exact 'approval_name', 'department', 'source', 'confidence', and 'status' from the input."
        )

        user_prompt = (
            f"Applicant Business Profile:\n"
            f"- Company Name: {profile.company_name}\n"
            f"- Industry Sector: {profile.industry}\n"
            f"- Business Type: {profile.business_type}\n"
            f"- Location: {profile.district}, {profile.state}\n"
            f"- Investment: ₹{profile.investment_amount:,.2f}\n"
            f"- Headcount: {profile.employee_count} employees\n"
            f"- Project Stage: {profile.project_stage}\n"
            f"- Land Status: {profile.land_status}\n\n"
            f"Deterministically Matched Approvals to explain:\n"
            f"{json.dumps(approvals_context, indent=2)}\n\n"
            f"Provide the explained JSON array:"
        )

        # Call via google.genai or google.generativeai
        ai_response_text = None
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{system_instruction}\n\n{user_prompt}"
            )
            ai_response_text = response.text
        except Exception as e1:
            logger.warning(f"google.genai call failed, attempting google.generativeai: {e1}")
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=api_key)
            model = genai_legacy.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(f"{system_instruction}\n\n{user_prompt}")
            ai_response_text = response.text

        if ai_response_text:
            cleaned = ai_response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed_data = json.loads(cleaned.strip())
            if isinstance(parsed_data, list) and len(parsed_data) > 0:
                logger.info("Successfully generated AI explanations via Gemini.")
                return parsed_data, "Gemini-AI-Assisted"

    except Exception as e:
        logger.warning(f"Gemini explanation layer encountered an issue: {e}. Falling back safely to deterministic rule explanations.")

    # Graceful fallback to verified deterministic explanations
    return generate_deterministic_explanations(profile, matched_approvals), "Deterministic-Rule-Engine"
