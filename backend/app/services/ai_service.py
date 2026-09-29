import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import openai
from app.core.config import settings

logger = logging.getLogger(__name__)

# Supported model identifiers on Groq
PRIMARY_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODELS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
VISION_MODEL = "openai/gpt-oss-120b"


def get_ai_client() -> Optional[openai.OpenAI]:
    """Initializes OpenAI-compatible client pointed at Groq API endpoint."""
    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("GROK_API_KEY") or getattr(settings, "GROQ_API_KEY", None)
    if not api_key or "mock" in api_key.lower():
        logger.warning("No valid GROQ_API_KEY found.")
        return None
    return openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=api_key
    )


def extract_document_entities_with_ai(raw_text: str, document_type: str) -> Optional[Dict[str, Any]]:
    """
    Uses Grok/Groq AI for structured interpretation of OCR/PDF extracted document text.
    Returns: parsed dictionary with company_name, address, relevant_dates, registration_numbers.
    """
    client = get_ai_client()
    if not client or not raw_text or len(raw_text) < 30:
        return None

    prompt = (
        f"You are a regulatory document pre-validation engine. Analyze this extracted text from an uploaded {document_type}:\n\n"
        f"{raw_text[:2500]}\n\n"
        "Return a clean JSON object with keys: 'company_name', 'address', 'relevant_dates' (list of strings), 'registration_numbers' (dict of identifier_name: value), 'document_type'."
    )

    for model in [PRIMARY_MODEL] + FALLBACK_MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a regulatory compliance extraction system. Always respond with clean, valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            content = response.choices[0].message.content or ""
            parsed = json.loads(content.strip())
            if isinstance(parsed, dict):
                logger.info(f"Successfully extracted document entities via Groq ({model}).")
                return parsed
        except Exception as e:
            logger.warning(f"Groq document entity extraction failed on {model}: {e}")

    return None


def extract_document_entities_with_vision(image_base64: str, document_type: str, mime_type: str = "image/png") -> Optional[Dict[str, Any]]:
    """
    Vision-based extraction for scanned PDFs and image documents using Qwen vision model.
    """
    client = get_ai_client()
    if not client or not image_base64:
        return None

    extraction_prompt = (
        f"You are a regulatory document pre-validation engine for Indian industrial compliance.\n"
        f"Carefully read this scanned {document_type} image and extract all visible information.\n\n"
        f"Return ONLY a valid JSON object with these exact keys:\n"
        f"  - company_name: string or null (legal company/organization name, firm name, or individual name on the document)\n"
        f"  - address: string or null (full address visible on the document)\n"
        f"  - relevant_dates: list of date strings visible on the document (issue date, expiry date, DOB, etc.)\n"
        f"  - registration_numbers: dict of identifier labels and values (e.g. PAN, GSTIN, FSSAI, CIN, Udyam, License No)\n"
        f"  - document_type: string (inferred document type)\n\n"
        f"Be precise. Extract exactly what is visible. Do not invent or guess values not on the document."
    )

    try:
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": extraction_prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}}
                    ]
                }
            ],
            temperature=0.1,
            max_tokens=800
        )
        content = response.choices[0].message.content or ""
        cleaned = content.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1]
        if "```" in cleaned:
            cleaned = cleaned.split("```")[0]
        cleaned = cleaned.strip()
        if "<think>" in cleaned:
            cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()
            json_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if json_match:
                cleaned = json_match.group(0)
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            logger.info(f"Vision extraction successful via {VISION_MODEL} for {document_type}.")
            return parsed
    except Exception as e:
        logger.warning(f"Vision-based entity extraction failed: {e}")

    return None


def explain_approvals_with_ai(profile: Any, matched_approvals: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str]:
    """Generates AI explanations for matched approvals based on profile parameters."""
    client = get_ai_client()
    if not client or not matched_approvals:
        return generate_deterministic_explanations(profile, matched_approvals), "Deterministic-Rule-Engine"

    context = {
        "company_name": getattr(profile, "company_name", "Enterprise"),
        "industry": getattr(profile, "industry", "General"),
        "state": getattr(profile, "state", "Maharashtra"),
        "district": getattr(profile, "district", "Pune"),
        "investment_amount": getattr(profile, "investment_amount", 0.0),
        "employee_count": getattr(profile, "employee_count", 0),
        "project_stage": getattr(profile, "project_stage", "Pre-Construction"),
    }

    prompt = (
        f"You are a regulatory compliance expert for Maharashtra state industrial clearances.\n"
        f"Explain why each approval applies to this enterprise: {json.dumps(context)}\n"
        f"Approvals:\n{json.dumps(matched_approvals, indent=2)}\n\n"
        f"Return JSON array matching the approvals with enhanced 'applicability_reason' and simplified 'document_summary'."
    )

    for model in [PRIMARY_MODEL] + FALLBACK_MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a regulatory assistant. Respond ONLY with valid JSON array."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            content = response.choices[0].message.content or ""
            parsed_data = json.loads(content.strip())
            if isinstance(parsed_data, dict) and "approvals" in parsed_data:
                parsed_data = parsed_data["approvals"]
            if isinstance(parsed_data, list) and len(parsed_data) > 0:
                enriched = []
                for i, orig in enumerate(matched_approvals):
                    item = dict(orig)
                    if i < len(parsed_data) and isinstance(parsed_data[i], dict):
                        llm_item = parsed_data[i]
                        if llm_item.get("applicability_reason"):
                            item["applicability_reason"] = llm_item["applicability_reason"]
                        if llm_item.get("document_summary"):
                            item["document_summary"] = llm_item["document_summary"]
                        if llm_item.get("required_documents") and isinstance(llm_item["required_documents"], list) and len(llm_item["required_documents"]) > 0:
                            item["required_documents"] = llm_item["required_documents"]
                    enriched.append(item)
                return enriched, f"Groq-{model.split('/')[-1]}"
        except Exception as e:
            logger.warning(f"Groq explanation failed on {model}: {e}")

    return generate_deterministic_explanations(profile, matched_approvals), "Deterministic-Rule-Engine"


def generate_deterministic_explanations(profile: Any, matched_approvals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deterministic fallback for approval explanations."""
    results = []
    industry = getattr(profile, "industry", "Industrial")
    for app in matched_approvals:
        copy_app = dict(app)
        copy_app["applicability_reason"] = (
            f"Mandated for {industry} enterprises under state regulatory frameworks ({app.get('source', 'Statutory Acts')})."
        )
        results.append(copy_app)
    return results


# --------------------------------------------------------------------------
# Phase 7: Source-Grounded Regulatory Knowledge Assistant
# --------------------------------------------------------------------------
INSUFFICIENT_INFO_MESSAGE = "I could not find sufficient information in the available verified sources."
LEGAL_DISCLAIMER = (
    "Regulatory Notice: Automated responses are synthesized exclusively from the project's verified statutory "
    "knowledge base and official government guidelines. This information does not constitute formal legal counsel."
)


def ask_regulatory_knowledge_assistant(
    question: str,
    department_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Source-grounded Question Answering over the curated regulatory knowledge base.
    """
    from app.services.regulatory_rag import retrieve_relevant_sources

    # 1. Retrieve grounded source documents
    retrieved = retrieve_relevant_sources(
        query=question,
        top_k=3,
        department_filter=department_filter,
        min_score_threshold=1.5
    )

    if not retrieved:
        logger.info(f"No sufficiently scored sources found for query: '{question}'")
        return {
            "answer": INSUFFICIENT_INFO_MESSAGE,
            "source_documents": [],
            "source_references": [],
            "confidence": 0.0,
            "disclaimer": LEGAL_DISCLAIMER
        }

    sources_context = []
    formatted_source_docs = []
    unique_refs = set()

    for src, score in retrieved:
        sources_context.append(
            f"--- SOURCE DOCUMENT ---\n"
            f"Title: {src['title']}\n"
            f"Department: {src['department']}\n"
            f"Legal Authority / Act: {src['source']}\n"
            f"Publication Date: {src['publication_date']} (Verified: {src['last_verified_date']})\n"
            f"Content:\n{src['content']}\n"
        )
        formatted_source_docs.append({
            "id": src["id"],
            "title": src["title"],
            "department": src["department"],
            "source": src["source"],
            "publication_date": src["publication_date"],
            "last_verified_date": src["last_verified_date"],
            "category": src.get("category", "Regulatory Policy"),
            "relevance_score": score,
            "summary": src.get("summary", "")
        })
        if src.get("source"):
            unique_refs.add(src["source"])

    combined_context = "\n\n".join(sources_context)

    client = get_ai_client()
    if not client:
        top_doc = retrieved[0][0]
        deterministic_answer = (
            f"According to verified regulatory guidelines from {top_doc['department']} ({top_doc['source']}):\n\n"
            f"{top_doc['content'][:400]}..."
        )
        return {
            "answer": deterministic_answer,
            "source_documents": formatted_source_docs,
            "source_references": list(unique_refs),
            "confidence": 0.85,
            "disclaimer": LEGAL_DISCLAIMER
        }

    system_prompt = (
        "You are the official MAITRI-Next Regulatory Compliance Knowledge Assistant for Maharashtra industrial clearances.\n"
        "STRICT GROUNDING INSTRUCTIONS:\n"
        "1. Answer the user's question using ONLY the facts explicitly stated in the provided VERIFIED SOURCES below.\n"
        "2. Do NOT extrapolate, speculate, or invent any legal rules, time limits, penalties, or document requirements not in the text.\n"
        "3. If the provided sources DO NOT contain sufficient information to answer the question, respond EXACTLY with:\n"
        f"\"{INSUFFICIENT_INFO_MESSAGE}\"\n"
        "4. Always present statutory requirements objectively. Do not present advice as definitive legal counsel.\n"
        "5. Structure the answer clearly with bullet points and explicitly cite the relevant Act or Department."
    )

    user_prompt = (
        f"VERIFIED REGULATORY SOURCES:\n"
        f"{combined_context}\n\n"
        f"USER QUESTION: {question}\n\n"
        f"Please provide a precise, grounded answer with clear citations."
    )

    for model in [PRIMARY_MODEL] + FALLBACK_MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.05,
                max_tokens=650
            )
            raw_answer = response.choices[0].message.content or ""
            cleaned_answer = raw_answer.strip()
            if "<think>" in cleaned_answer:
                cleaned_answer = re.sub(r"<think>.*?</think>", "", cleaned_answer, flags=re.DOTALL).strip()

            if INSUFFICIENT_INFO_MESSAGE.lower() in cleaned_answer.lower():
                return {
                    "answer": INSUFFICIENT_INFO_MESSAGE,
                    "source_documents": [],
                    "source_references": [],
                    "confidence": 0.0,
                    "disclaimer": LEGAL_DISCLAIMER
                }

            logger.info(f"Regulatory Assistant answered query via {model}.")
            return {
                "answer": cleaned_answer,
                "source_documents": formatted_source_docs,
                "source_references": list(unique_refs),
                "confidence": 0.95,
                "disclaimer": LEGAL_DISCLAIMER
            }
        except Exception as e:
            logger.warning(f"Regulatory RAG answer generation failed on {model}: {e}")

    top_doc = retrieved[0][0]
    return {
        "answer": f"Based on verified guidelines from {top_doc['department']}:\n\n{top_doc['content'][:450]}...",
        "source_documents": formatted_source_docs,
        "source_references": list(unique_refs),
        "confidence": 0.80,
        "disclaimer": LEGAL_DISCLAIMER
    }


# --------------------------------------------------------------------------
# Phase 8: Government Scheme Relevance Explanations
# --------------------------------------------------------------------------
def explain_schemes_with_ai(
    profile: Any,
    matched_schemes: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Uses Groq AI to explain why each matched government scheme is potentially relevant
    to the applicant's enterprise profile without promising unconditional eligibility.
    """
    client = get_ai_client()
    if not client or not matched_schemes:
        return matched_schemes

    context = {
        "company_name": getattr(profile, "company_name", "Enterprise"),
        "industry": getattr(profile, "industry", "General"),
        "state": getattr(profile, "state", "Maharashtra"),
        "district": getattr(profile, "district", "Pune"),
        "investment_amount_inr": getattr(profile, "investment_amount", 0.0),
        "business_type": getattr(profile, "business_type", "Private Limited"),
        "project_stage": getattr(profile, "project_stage", "Pre-Construction"),
    }

    simplified_schemes = [
        {
            "id": s["id"],
            "scheme_name": s["scheme_name"],
            "department": s["department"],
            "benefits": s.get("benefits", [])[:2],
        }
        for s in matched_schemes
    ]

    prompt = (
        f"You are a Government Industrial Scheme Advisor for Maharashtra.\n"
        f"Enterprise Profile: {json.dumps(context)}\n"
        f"Matched Schemes: {json.dumps(simplified_schemes)}\n\n"
        f"TASK:\n"
        f"For each scheme, provide a tailored 2-sentence explanation of why it is 'Potentially relevant' to this specific enterprise.\n"
        f"CRITICAL CONSTRAINT: Always use wording like 'Potentially relevant because...' or 'May offer support as...'.\n"
        f"NEVER declare 'You are eligible' or make promises of financial sanction.\n\n"
        f"Return ONLY a JSON object in this format:\n"
        f"{{\"explanations\": [{{\"id\": \"scheme-id\", \"why_relevant\": \"Potentially relevant because...\"}}]}}"
    )

    for model in [PRIMARY_MODEL] + FALLBACK_MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are an industrial scheme advisor. Always respond with clean JSON only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=600
            )
            content = response.choices[0].message.content or ""
            cleaned = content.strip()
            if "<think>" in cleaned:
                cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()
            parsed = json.loads(cleaned)
            exps = parsed.get("explanations", [])
            exp_map = {e["id"]: e["why_relevant"] for e in exps if "id" in e and "why_relevant" in e}

            for s in matched_schemes:
                if s["id"] in exp_map and "potentially relevant" in exp_map[s["id"]].lower():
                    s["why_relevant"] = exp_map[s["id"]]
            
            logger.info(f"Scheme AI explanations synthesized successfully via {model}.")
            return matched_schemes
        except Exception as e:
            logger.warning(f"Scheme AI explanation failed on {model}: {e}")

    return matched_schemes
