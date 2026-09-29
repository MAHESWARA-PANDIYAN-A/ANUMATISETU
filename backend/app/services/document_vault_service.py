import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session

from app.models.business_profile import BusinessProfile
from app.models.document import (
    Document,
    DocumentType,
    DocumentVersion,
    DocumentValidation,
    DocumentUsage,
    ApplicationDocumentRequirement,
    DocumentExternalMapping,
    DocumentAuditLog,
    DocumentStatus,
    ValidationStatus,
    DocumentUsageStatus,
    DocumentCategory,
)

logger = logging.getLogger(__name__)

# ─── CANONICAL SEED DOCUMENT TYPES ───────────────────────────────────────────
INITIAL_DOCUMENT_TYPES = [
    {
        "code": "PAN_CARD",
        "name": "Permanent Account Number (PAN)",
        "category": "TAX",
        "description": "Income Tax Department 10-character PAN card (Entity or Individual Director)",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "CERTIFICATE_OF_INCORPORATION",
        "name": "Certificate of Incorporation / MCA Registration",
        "category": "CERTIFICATE",
        "description": "Ministry of Corporate Affairs incorporation certificate or LLP registration deed",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "AADHAAR_CARD",
        "name": "Aadhaar Card (Authorized Signatory)",
        "category": "IDENTITY",
        "description": "UIDAI Aadhaar Card of the primary promoter / authorized signatory",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "PASSPORT_PHOTO",
        "name": "Passport Size Photograph",
        "category": "PHOTO",
        "description": "Recent colored passport size photo of proprietor / partner / director",
        "allowed_mime_types": ["image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "ADDRESS_PROOF",
        "name": "Business Address Proof / Electricity Bill",
        "category": "ADDRESS",
        "description": "Utility bill, electricity bill, or municipal property tax receipt (under 2 months old)",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "RENT_AGREEMENT",
        "name": "Registered Rent Agreement / Lease Deed",
        "category": "ADDRESS",
        "description": "Registered tenancy agreement or MIDC allotment letter for operating premises",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "BANK_PROOF",
        "name": "Bank Account Statement / Cancelled Cheque",
        "category": "BANK",
        "description": "Bank statement (last 3 months) or pre-printed cancelled cheque showing IFSC & Account No",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "FOOD_PRODUCT_DETAILS",
        "name": "Food Product / Category Classification Details",
        "category": "PRODUCT",
        "description": "List of food categories, manufacturing flowcharts, and recall plans for FSSAI",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "WATER_TEST_REPORT",
        "name": "Potable Water Test Report",
        "category": "CERTIFICATE",
        "description": "NABL accredited laboratory chemical and bacteriological water test report",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "FACTORY_LAYOUT_PLAN",
        "name": "Factory Building & Machinery Layout Plan",
        "category": "SUPPORTING",
        "description": "Architect-certified plant layout drawing showing machine positions and fire exits",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "LOGO",
        "name": "Brand Logo / Wordmark Device",
        "category": "BRAND",
        "description": "High resolution trademark representation image/logo",
        "allowed_mime_types": ["image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "TRADEMARK_SUPPORTING_DOCUMENT",
        "name": "Trademark User Affidavit / Prior Use Proof",
        "category": "BRAND",
        "description": "Affidavit testifying date of first commercial use along with supporting invoices",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
    {
        "code": "OTHER",
        "name": "Other Statutory Clearance / NOC",
        "category": "SUPPORTING",
        "description": "Any additional departmental NOC or compliance document",
        "allowed_mime_types": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
        "max_file_size": 5 * 1024 * 1024,
    },
]

# ─── APPROVAL REQUIREMENTS MAPPING ──────────────────────────────────────────
APPROVAL_DOCUMENT_REQUIREMENTS = {
    "fssai-state-manufacturing-license": [
        "IDENTITY_PROOF",  # Satisfied by AADHAAR_CARD or PAN_CARD
        "ADDRESS_PROOF",
        "PASSPORT_PHOTO",
        "FOOD_PRODUCT_DETAILS",
        "WATER_TEST_REPORT",
    ],
    "fssai": [
        "IDENTITY_PROOF",
        "ADDRESS_PROOF",
        "PASSPORT_PHOTO",
        "FOOD_PRODUCT_DETAILS",
        "WATER_TEST_REPORT",
    ],
    "gst-registration": [
        "PAN_CARD",
        "AADHAAR_CARD",
        "PASSPORT_PHOTO",
        "ADDRESS_PROOF",
        "BANK_PROOF",
    ],
    "gst": [
        "PAN_CARD",
        "AADHAAR_CARD",
        "PASSPORT_PHOTO",
        "ADDRESS_PROOF",
        "BANK_PROOF",
    ],
    "udyam-msme-registration": [
        # In modern Udyam portal, registration is Aadhaar/PAN API verified with no mandatory file upload
    ],
    "udyam": [],
    "mpcb-cte": [
        "CERTIFICATE_OF_INCORPORATION",
        "FACTORY_LAYOUT_PLAN",
        "ADDRESS_PROOF",
        "WATER_TEST_REPORT",
    ],
    "cfo-fire-provisional": [
        "FACTORY_LAYOUT_PLAN",
        "ADDRESS_PROOF",
        "CERTIFICATE_OF_INCORPORATION",
    ],
    "trademark-registration": [
        "LOGO",
        "TRADEMARK_SUPPORTING_DOCUMENT",
        "PAN_CARD",
    ],
    "general-compliance": [
        "PAN_CARD",
        "CERTIFICATE_OF_INCORPORATION",
        "ADDRESS_PROOF",
    ],
}


def ensure_document_types_seeded(db: Session) -> List[DocumentType]:
    """Ensures canonical document types are populated in the database."""
    types = db.query(DocumentType).all()
    if not types:
        for t_def in INITIAL_DOCUMENT_TYPES:
            new_type = DocumentType(
                code=t_def["code"],
                name=t_def["name"],
                category=t_def["category"],
                description=t_def["description"],
                allowed_mime_types=t_def["allowed_mime_types"],
                max_file_size=t_def["max_file_size"],
                active=True,
            )
            db.add(new_type)
        db.commit()
        types = db.query(DocumentType).all()
    return types


def get_canonical_type_code(raw_type_name: str) -> str:
    """Normalizes any document type string / UI label to a canonical code."""
    t = (raw_type_name or "").lower().strip()
    if "pan" in t or "permanent account" in t:
        return "PAN_CARD"
    if "incorporation" in t or "mca" in t or "cin" in t or "company" in t:
        return "CERTIFICATE_OF_INCORPORATION"
    if "aadhaar" in t or "aadhar" in t or "identity" in t:
        return "AADHAAR_CARD"
    if "photo" in t or "passport" in t:
        return "PASSPORT_PHOTO"
    if "address" in t or "electricity" in t or "power" in t or "utility" in t:
        return "ADDRESS_PROOF"
    if "rent" in t or "lease" in t or "allotment" in t or "midc" in t:
        return "RENT_AGREEMENT"
    if "bank" in t or "cheque" in t or "statement" in t:
        return "BANK_PROOF"
    if "food" in t or "product" in t or "fssai" in t or "recipe" in t or "menu" in t:
        return "FOOD_PRODUCT_DETAILS"
    if "water" in t or "test" in t or "effluent" in t:
        return "WATER_TEST_REPORT"
    if "layout" in t or "machinery" in t or "plan" in t or "factory" in t or "fire" in t:
        return "FACTORY_LAYOUT_PLAN"
    if "logo" in t or "trademark" in t or "brand" in t or "wordmark" in t:
        return "LOGO"
    return "OTHER"


def match_required_document_types(selected_approvals: List[str]) -> List[Dict[str, Any]]:
    """
    DocumentMatchingService: Returns deduplicated required canonical document types
    based on the user's selected approvals.
    """
    required_codes: Set[str] = set()
    code_to_approvals: Dict[str, List[str]] = {}

    for app_id in selected_approvals:
        norm_id = app_id.lower().strip()
        # Find matching approval key
        matched_reqs = APPROVAL_DOCUMENT_REQUIREMENTS.get(norm_id)
        if matched_reqs is None:
            # Fallback search for partial key
            for k, reqs in APPROVAL_DOCUMENT_REQUIREMENTS.items():
                if k in norm_id or norm_id in k:
                    matched_reqs = reqs
                    break
        
        for code in (matched_reqs or []):
            required_codes.add(code)
            if code not in code_to_approvals:
                code_to_approvals[code] = []
            
            clean_app_name = norm_id.replace("-", " ").upper()
            if "FSSAI" in clean_app_name:
                clean_app_name = "FSSAI"
            elif "GST" in clean_app_name:
                clean_app_name = "GST"
            elif "UDYAM" in clean_app_name:
                clean_app_name = "Udyam"
            elif "MPCB" in clean_app_name or "CTE" in clean_app_name:
                clean_app_name = "MPCB CTE"
            elif "FIRE" in clean_app_name:
                clean_app_name = "Fire NOC"

            if clean_app_name not in code_to_approvals[code]:
                code_to_approvals[code].append(clean_app_name)

    type_name_map = {t["code"]: t["name"] for t in INITIAL_DOCUMENT_TYPES}
    type_cat_map = {t["code"]: t["category"] for t in INITIAL_DOCUMENT_TYPES}

    result = []
    for code in sorted(list(required_codes)):
        result.append({
            "code": code,
            "name": type_name_map.get(code, code.replace("_", " ").title()),
            "category": type_cat_map.get(code, "SUPPORTING"),
            "required_by": code_to_approvals.get(code, []),
        })

    return result


def compute_document_completeness(
    db: Session,
    user_id: int,
    selected_approvals: List[str]
) -> Dict[str, Any]:
    """
    DocumentCompletenessService: Evaluates document repository against required approvals.
    Returns: total_required, available, missing, needs_attention, ready_for_submission, checklist.
    """
    ensure_document_types_seeded(db)
    required_types = match_required_document_types(selected_approvals)
    
    # Fetch active user documents
    user_docs = db.query(Document).filter(
        Document.user_id == user_id,
        Document.status == DocumentStatus.ACTIVE
    ).all()

    # Map available documents by canonical code
    code_to_doc: Dict[str, Document] = {}
    for doc in user_docs:
        doc_code = get_canonical_type_code(doc.document_type)
        if doc_code not in code_to_doc or doc.validation_status in [ValidationStatus.VALID, ValidationStatus.READY]:
            code_to_doc[doc_code] = doc
        
        # Special compatibility: PAN and AADHAAR also satisfy IDENTITY_PROOF
        if doc_code in ["PAN_CARD", "AADHAAR_CARD"] and "IDENTITY_PROOF" not in code_to_doc:
            code_to_doc["IDENTITY_PROOF"] = doc

    available_count = 0
    missing_count = 0
    needs_attention_count = 0
    checklist = []
    missing_types = []

    for req in required_types:
        code = req["code"]
        doc = code_to_doc.get(code)
        
        if not doc and code == "IDENTITY_PROOF":
            doc = code_to_doc.get("PAN_CARD") or code_to_doc.get("AADHAAR_CARD")

        if doc:
            is_valid = doc.validation_status in [ValidationStatus.VALID, ValidationStatus.READY]
            if is_valid:
                available_count += 1
                status = "AVAILABLE"
            else:
                needs_attention_count += 1
                status = "NEEDS_ATTENTION"
            
            checklist.append({
                "code": code,
                "name": req["name"],
                "required_by": req["required_by"],
                "status": status,
                "document_id": doc.id,
                "file_name": doc.file_name,
                "validation_status": doc.validation_status.value,
                "used_by": [u.approval_id for u in doc.usages] if doc.usages else req["required_by"],
            })
        else:
            missing_count += 1
            missing_types.append(req)
            checklist.append({
                "code": code,
                "name": req["name"],
                "required_by": req["required_by"],
                "status": "MISSING",
                "document_id": None,
                "file_name": None,
                "validation_status": None,
                "used_by": req["required_by"],
            })

    total_req = len(required_types)
    ready_for_submission = (missing_count == 0 and total_req > 0)

    return {
        "total_required": total_req,
        "available": available_count,
        "missing": missing_count,
        "needs_attention": needs_attention_count,
        "ready_for_submission": ready_for_submission,
        "checklist": checklist,
        "missing_documents": missing_types,
    }


def map_and_reuse_documents_for_application(
    db: Session,
    user_id: int,
    approval_id: str,
    application_id: str,
    profile: Optional[BusinessProfile] = None
) -> List[DocumentUsage]:
    """
    DocumentReuseService: Links compatible existing vault documents to an application
    without requiring re-uploading.
    """
    user_docs = db.query(Document).filter(
        Document.user_id == user_id,
        Document.status == DocumentStatus.ACTIVE
    ).all()

    norm_approval = approval_id.lower().strip()
    req_codes = []
    for k, v in APPROVAL_DOCUMENT_REQUIREMENTS.items():
        if k in norm_approval or norm_approval in k:
            req_codes = v
            break

    created_usages = []
    for req_code in req_codes:
        # Find existing compatible document
        matched_doc = None
        for doc in user_docs:
            doc_code = get_canonical_type_code(doc.document_type)
            if doc_code == req_code or (req_code == "IDENTITY_PROOF" and doc_code in ["PAN_CARD", "AADHAAR_CARD"]):
                matched_doc = doc
                break

        if matched_doc:
            # Check if usage already exists
            existing_usage = db.query(DocumentUsage).filter(
                DocumentUsage.document_id == matched_doc.id,
                DocumentUsage.approval_id == approval_id,
                DocumentUsage.application_id == application_id
            ).first()

            if not existing_usage:
                new_usage = DocumentUsage(
                    document_id=matched_doc.id,
                    user_id=user_id,
                    business_profile_id=profile.id if profile else getattr(matched_doc, "business_profile_id", None),
                    approval_id=approval_id,
                    application_id=application_id,
                    required_document_type=req_code,
                    usage_status=DocumentUsageStatus.SYNCED if matched_doc.validation_status in [ValidationStatus.VALID, ValidationStatus.READY] else DocumentUsageStatus.SELECTED,
                )
                db.add(new_usage)
                created_usages.append(new_usage)

    db.commit()
    return created_usages


def log_document_audit(
    db: Session,
    user_id: int,
    action: str,
    document_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
):
    """Writes an entry to the DocumentAuditLog."""
    try:
        entry = DocumentAuditLog(
            user_id=user_id,
            document_id=document_id,
            action=action,
            details=details or {},
            ip_address=ip_address,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to write audit log: {e}")


def calculate_user_document_completeness(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Calculates the completeness of the user's document vault against all required statutory approvals.
    Returns: total_required, available, missing, and list of missing document types with descriptions.
    """
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == user_id).first()
    
    # Get active user documents
    active_docs = (
        db.query(Document)
        .filter(Document.user_id == user_id, Document.status != DocumentStatus.DELETED)
        .all()
    )
    
    available_codes = set()
    for d in active_docs:
        code = get_canonical_type_code(d.document_type)
        available_codes.add(code)
        if code in ["PAN_CARD", "AADHAAR_CARD"]:
            available_codes.add("IDENTITY_PROOF")

    # Determine required document codes across standard workflows
    required_codes_map: Dict[str, List[str]] = {}
    for app_id, codes in APPROVAL_DOCUMENT_REQUIREMENTS.items():
        for c in codes:
            if c not in required_codes_map:
                required_codes_map[c] = []
            required_codes_map[c].append(app_id)

    missing_docs = []
    available_docs_list = []

    for req_code, mapped_approvals in required_codes_map.items():
        doc_type_obj = db.query(DocumentType).filter(DocumentType.code == req_code).first()
        name = doc_type_obj.name if doc_type_obj else req_code.replace("_", " ").title()
        
        if req_code in available_codes:
            available_docs_list.append({
                "code": req_code,
                "document_type_name": name,
                "approval_ids": mapped_approvals
            })
        else:
            missing_docs.append({
                "code": req_code,
                "document_type_name": name,
                "approval_ids": mapped_approvals
            })

    total_req = len(required_codes_map)
    avail_count = len(available_docs_list)
    missing_count = len(missing_docs)

    return {
        "total_required": total_req,
        "available": avail_count,
        "missing": missing_count,
        "missing_documents": missing_docs,
        "available_documents": available_docs_list
    }
