import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
import httpx
from sqlalchemy.orm import Session

from app.models.business_profile import BusinessProfile
from app.models.document import Document
from app.models.user import User

logger = logging.getLogger(__name__)

# Base URLs
MOCK_FSSAI_BASE_URL = os.getenv("MOCK_FSSAI_BASE_URL", "http://localhost:8002/api/integrations/v1")
MOCK_GST_BASE_URL = os.getenv("MOCK_GST_BASE_URL", "http://localhost:8003/api/integrations/v1")
MOCK_UDYAM_BASE_URL = os.getenv("MOCK_UDYAM_BASE_URL", "http://localhost:8001/api/integrations/v1")


# ─── CANONICAL FIELD REGISTRY ────────────────────────────────────────────────
# All unified fields across the statutory portal ecosystem
CANONICAL_FIELDS = {
    # Section: Applicant Information
    "applicant_name": {
        "id": "applicant_name",
        "label": "Authorized Signatory / Applicant Full Name",
        "type": "text",
        "section": "applicant",
        "required": True,
        "placeholder": "e.g. Rahul Kumar",
        "pattern": None
    },
    "applicant_mobile": {
        "id": "applicant_mobile",
        "label": "Mobile Number (10 Digits)",
        "type": "tel",
        "section": "applicant",
        "required": True,
        "placeholder": "9876543210",
        "pattern": "^[6-9]\\d{9}$"
    },
    "applicant_email": {
        "id": "applicant_email",
        "label": "Official Email Address",
        "type": "email",
        "section": "applicant",
        "required": True,
        "placeholder": "rahul@example.com",
        "pattern": None
    },
    "applicant_pan": {
        "id": "applicant_pan",
        "label": "Individual PAN / Director PAN",
        "type": "text",
        "section": "applicant",
        "required": True,
        "placeholder": "ABCDE1234F",
        "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
    },
    "aadhaar_last4": {
        "id": "aadhaar_last4",
        "label": "Aadhaar Last 4 Digits",
        "type": "text",
        "section": "applicant",
        "required": True,
        "placeholder": "1234",
        "pattern": "^\\d{4}$"
    },

    # Section: Business Identity
    "business_name": {
        "id": "business_name",
        "label": "Legal Name of Business (as per PAN)",
        "type": "text",
        "section": "business",
        "required": True,
        "placeholder": "e.g. ABC Foods Private Limited",
        "pattern": None
    },
    "trade_name": {
        "id": "trade_name",
        "label": "Trade Name / Brand Name",
        "type": "text",
        "section": "business",
        "required": True,
        "placeholder": "e.g. ABC Foods",
        "pattern": None
    },
    "business_pan": {
        "id": "business_pan",
        "label": "Entity Permanent Account Number (PAN)",
        "type": "text",
        "section": "business",
        "required": True,
        "placeholder": "ABCDE1234F",
        "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
    },
    "organization_type": {
        "id": "organization_type",
        "label": "Constitution / Organization Type",
        "type": "select",
        "section": "business",
        "required": True,
        "options": [
            {"value": "PRIVATE_LIMITED", "label": "Private Limited Company"},
            {"value": "PUBLIC_LIMITED", "label": "Public Limited Company"},
            {"value": "LLP", "label": "Limited Liability Partnership (LLP)"},
            {"value": "PROPRIETORSHIP", "label": "Proprietorship"},
            {"value": "PARTNERSHIP", "label": "Partnership Firm"}
        ]
    },
    "business_activity": {
        "id": "business_activity",
        "label": "Primary Business Activity",
        "type": "text",
        "section": "business",
        "required": True,
        "placeholder": "e.g. Packaged Snack Foods & Agro Processing",
        "pattern": None
    },

    # Section: Location & Premises
    "premise_name": {
        "id": "premise_name",
        "label": "Premises / Unit / Complex Name",
        "type": "text",
        "section": "location",
        "required": True,
        "placeholder": "e.g. ABC Food Processing Unit #1",
        "pattern": None
    },
    "address_line": {
        "id": "address_line",
        "label": "Street Address / Industrial Estate / Area",
        "type": "text",
        "section": "location",
        "required": True,
        "placeholder": "e.g. Plot 12, SIDCO Industrial Estate",
        "pattern": None
    },
    "state": {
        "id": "state",
        "label": "State",
        "type": "text",
        "section": "location",
        "required": True,
        "placeholder": "Tamil Nadu"
    },
    "district": {
        "id": "district",
        "label": "District",
        "type": "text",
        "section": "location",
        "required": True,
        "placeholder": "Salem"
    },
    "pincode": {
        "id": "pincode",
        "label": "Pincode (6 Digits)",
        "type": "text",
        "section": "location",
        "required": True,
        "placeholder": "636001",
        "pattern": "^[1-9][0-9]{5}$"
    },
    "nature_of_possession": {
        "id": "nature_of_possession",
        "label": "Nature of Premises Possession",
        "type": "select",
        "section": "location",
        "required": True,
        "options": [
            {"value": "OWNED", "label": "Owned"},
            {"value": "RENTED", "label": "Rented"},
            {"value": "LEASED", "label": "Leased"},
            {"value": "CONSENT", "label": "Consent / Shared"}
        ]
    },

    # Section: Scale & Financials
    "investment_amount": {
        "id": "investment_amount",
        "label": "Plant & Machinery Investment (₹ INR)",
        "type": "number",
        "section": "scale",
        "required": True,
        "placeholder": "50000000"
    },
    "expected_turnover": {
        "id": "expected_turnover",
        "label": "Annual Estimated Turnover (₹ INR)",
        "type": "number",
        "section": "scale",
        "required": True,
        "placeholder": "200000000"
    },
    "employee_count": {
        "id": "employee_count",
        "label": "Total Number of Employees / Workers",
        "type": "number",
        "section": "scale",
        "required": True,
        "placeholder": "100"
    },

    # Section: Approval-Specific Unique Fields
    # FSSAI Unique:
    "fssai_food_category": {
        "id": "fssai_food_category",
        "label": "FSSAI Food Product Category",
        "type": "select",
        "section": "fssai_specific",
        "required": True,
        "options": [
            {"value": "PROCESSED_FOODS", "label": "Ready-to-eat Savouries & Packaged Snacks (Cat 15)"},
            {"value": "DAIRY", "label": "Dairy products and analogues (Cat 01)"},
            {"value": "BAKERY", "label": "Bakery Products & Confectionery (Cat 07)"},
            {"value": "BEVERAGES", "label": "Beverages, excluding dairy (Cat 14)"},
            {"value": "GRAINS_AGRO", "label": "Cereals and cereal products, pulses (Cat 06)"}
        ]
    },
    "fssai_daily_capacity": {
        "id": "fssai_daily_capacity",
        "label": "Installed Daily Production Capacity (MT / Day)",
        "type": "text",
        "section": "fssai_specific",
        "required": True,
        "placeholder": "e.g. 5.0 MT / Day"
    },

    # GST Unique:
    "gst_authorized_signatory_role": {
        "id": "gst_authorized_signatory_role",
        "label": "Authorized Signatory Designation / Capacity",
        "type": "select",
        "section": "gst_specific",
        "required": True,
        "options": [
            {"value": "MANAGING_DIRECTOR", "label": "Managing Director / Director"},
            {"value": "PARTNER", "label": "Authorized Partner"},
            {"value": "PROPRIETOR", "label": "Proprietor"},
            {"value": "POWER_OF_ATTORNEY", "label": "Authorized Power of Attorney Holder"}
        ]
    },
    "gst_hsn_code": {
        "id": "gst_hsn_code",
        "label": "Primary HSN / SAC Code (4-8 Digits)",
        "type": "text",
        "section": "gst_specific",
        "required": True,
        "placeholder": "2106",
        "pattern": "^\\d{4,8}$"
    },

    # Udyam Unique:
    "udyam_nic_code": {
        "id": "udyam_nic_code",
        "label": "Primary National Industrial Classification (NIC) Code",
        "type": "select",
        "section": "udyam_specific",
        "required": True,
        "options": [
            {"value": "10", "label": "NIC 10: Manufacture of food products"},
            {"value": "11", "label": "NIC 11: Manufacture of beverages"},
            {"value": "13", "label": "NIC 13: Manufacture of textiles"},
            {"value": "62", "label": "NIC 62: Computer programming, consultancy & related activities"}
        ]
    },

    # Trademark Unique (if selected):
    "trademark_wordmark": {
        "id": "trademark_wordmark",
        "label": "Brand Name / Trademark Wordmark",
        "type": "text",
        "section": "trademark_specific",
        "required": True,
        "placeholder": "e.g. ABC CRISPS"
    },
    "trademark_nice_class": {
        "id": "trademark_nice_class",
        "label": "Trademark Nice Classification Class",
        "type": "select",
        "section": "trademark_specific",
        "required": True,
        "options": [
            {"value": "Class 29", "label": "Class 29: Meat, fish, poultry, preserved vegetables, snacks"},
            {"value": "Class 30", "label": "Class 30: Coffee, tea, flour, bakery, confectionery"},
            {"value": "Class 43", "label": "Class 43: Restaurant, catering, hospitality services"}
        ]
    }
}


# ─── PORTAL CANONICAL FIELD USAGE MAP ────────────────────────────────────────
PORTAL_FIELD_USAGES = {
    "FSSAI": [
        "applicant_name", "applicant_mobile", "applicant_email", "applicant_pan", "aadhaar_last4",
        "business_name", "trade_name", "organization_type", "business_activity",
        "premise_name", "address_line", "state", "district", "pincode", "nature_of_possession",
        "fssai_food_category", "fssai_daily_capacity"
    ],
    "GST": [
        "applicant_name", "applicant_mobile", "applicant_email", "applicant_pan", "aadhaar_last4",
        "business_name", "trade_name", "business_pan", "organization_type", "business_activity",
        "premise_name", "address_line", "state", "district", "pincode", "nature_of_possession",
        "gst_authorized_signatory_role", "gst_hsn_code"
    ],
    "UDYAM": [
        "applicant_name", "applicant_mobile", "applicant_email", "applicant_pan", "aadhaar_last4",
        "business_name", "business_pan", "organization_type",
        "address_line", "state", "district", "pincode",
        "investment_amount", "expected_turnover", "employee_count",
        "udyam_nic_code"
    ],
    "TRADEMARK": [
        "applicant_name", "applicant_mobile", "applicant_email",
        "business_name", "address_line", "state", "district", "pincode",
        "trademark_wordmark", "trademark_nice_class"
    ]
}


# ─── DOCUMENT REUSE CONFIGURATION ─────────────────────────────────────────────
SHARED_DOCUMENTS = [
    {
        "doc_id": "PAN_CARD",
        "canonical_code": "PAN_CARD",
        "title": "Permanent Account Number (PAN) Card",
        "used_by": ["GST", "UDYAM", "FSSAI", "TRADEMARK"],
        "description": "Copy of Entity or Proprietor PAN document"
    },
    {
        "doc_id": "ADDRESS_PROOF",
        "canonical_code": "ADDRESS_PROOF",
        "title": "Principal Premises Address / Electricity Bill / Rent Deed",
        "used_by": ["FSSAI", "GST", "UDYAM"],
        "description": "Proof of possession of business location"
    },
    {
        "doc_id": "SIGNATORY_PHOTO",
        "canonical_code": "PASSPORT_PHOTO",
        "title": "Passport Size Photo of Authorized Signatory",
        "used_by": ["FSSAI", "GST"],
        "description": "Clear color photograph of applicant"
    },
    {
        "doc_id": "INCORPORATION_CERT",
        "canonical_code": "CERTIFICATE_OF_INCORPORATION",
        "title": "Certificate of Incorporation / Partnership Deed / MOA",
        "used_by": ["GST", "FSSAI", "UDYAM"],
        "description": "Statutory constitution deed of enterprise"
    }
]


def prepare_unified_form_schema(
    selected_approvals: List[str],
    user: Optional[User] = None,
    profile: Optional[BusinessProfile] = None,
    documents: Optional[List[Document]] = None
) -> Dict[str, Any]:
    """
    Combines fields from all selected mock portals, merges duplicate canonical fields,
    computes 'used_by' badges, and pre-populates existing values from BusinessProfile.
    """
    if not selected_approvals:
        selected_approvals = ["FSSAI", "GST", "UDYAM"]

    # 1. Determine active canonical fields and their portal source maps
    active_field_map: Dict[str, Set[str]] = {}
    for app_id in selected_approvals:
        app_id_clean = app_id.upper().strip()
        fields_for_app = PORTAL_FIELD_USAGES.get(app_id_clean, [])
        for f_id in fields_for_app:
            if f_id not in active_field_map:
                active_field_map[f_id] = set()
            active_field_map[f_id].add(app_id_clean)

    # 2. Extract profile prefill values
    prefill_data: Dict[str, Any] = {}
    prefill_sources: Dict[str, str] = {}

    if user:
        prefill_data["applicant_name"] = user.full_name or "Rahul Kumar"
        prefill_sources["applicant_name"] = "From User Account"
        prefill_data["applicant_email"] = user.email
        prefill_sources["applicant_email"] = "From User Account"
        if getattr(user, "phone", None):
            prefill_data["applicant_mobile"] = user.phone
            prefill_sources["applicant_mobile"] = "From User Account"

    if profile:
        prefill_data["business_name"] = profile.company_name or "ABC Foods Private Limited"
        prefill_sources["business_name"] = "From Business Profile"
        prefill_data["trade_name"] = profile.company_name.replace("Private Limited", "").replace("Pvt Ltd", "").strip()
        prefill_sources["trade_name"] = "From Business Profile"
        prefill_data["state"] = profile.state or "Tamil Nadu"
        prefill_sources["state"] = "From Business Profile"
        prefill_data["district"] = profile.district or "Salem"
        prefill_sources["district"] = "From Business Profile"
        prefill_data["pincode"] = getattr(profile, "pincode", "636001") or "636001"
        prefill_sources["pincode"] = "From Business Profile"
        prefill_data["address_line"] = getattr(profile, "address", "") or f"Plot 12, SIDCO Industrial Estate, {profile.district}"
        prefill_sources["address_line"] = "From Business Profile"
        prefill_data["premise_name"] = f"{profile.company_name} Processing Unit"
        prefill_sources["premise_name"] = "From Business Profile"
        prefill_data["business_activity"] = getattr(profile, "business_activity", "") or "Packaged Snacks and Agro Processing"
        prefill_sources["business_activity"] = "From Business Profile"

        inv = float(profile.investment_amount or 500)
        # normalize to INR if stored in lakhs
        inv_inr = int(inv * 100000) if inv < 10000 else int(inv)
        prefill_data["investment_amount"] = inv_inr
        prefill_sources["investment_amount"] = "From Business Profile"

        turn = float(getattr(profile, "expected_turnover", 2000) or (inv * 4))
        turn_inr = int(turn * 100000) if turn < 10000 else int(turn)
        prefill_data["expected_turnover"] = turn_inr
        prefill_sources["expected_turnover"] = "From Business Profile"

        prefill_data["employee_count"] = profile.employee_count or 100
        prefill_sources["employee_count"] = "From Business Profile"

        const_str = str(profile.business_type or "PRIVATE_LIMITED").upper()
        if "PVT" in const_str or "PRIVATE" in const_str:
            prefill_data["organization_type"] = "PRIVATE_LIMITED"
        elif "LLP" in const_str:
            prefill_data["organization_type"] = "LLP"
        elif "PROP" in const_str:
            prefill_data["organization_type"] = "PROPRIETORSHIP"
        else:
            prefill_data["organization_type"] = "PRIVATE_LIMITED"
        prefill_sources["organization_type"] = "From Business Profile"

        # Registrations
        regs = getattr(profile, "existing_registrations", {}) or {}
        if isinstance(regs, dict):
            if regs.get("pan"):
                prefill_data["business_pan"] = regs["pan"]
                prefill_sources["business_pan"] = "From Business Profile"
                prefill_data["applicant_pan"] = regs["pan"]
                prefill_sources["applicant_pan"] = "From Business Profile"

    # Default fallbacks - leave empty for manual user entry
    # (Do not automatically fill dummy values)
    section_configs = [
        {"id": "applicant", "title": "1. Authorized Signatory / Applicant Details", "desc": "Official contact person and statutory signatory for all filings."},
        {"id": "business", "title": "2. Business Entity & Identity", "desc": "Corporate constitution, legal business title, and PAN registration."},
        {"id": "location", "title": "3. Principal Place of Business", "desc": "Physical operational address and premise occupancy."},
        {"id": "scale", "title": "4. Enterprise Scale & Financials", "desc": "Investment, turnover, and workforce size required for statutory MSME tiering."},
        {"id": "fssai_specific", "title": "5. Food Safety Specifications (FSSAI Unique)", "desc": "Specialized food category and daily manufacturing capacity.", "condition_approval": "FSSAI"},
        {"id": "gst_specific", "title": "6. Tax Registration Details (GST Unique)", "desc": "Authorized signatory designation and HSN commodity classification.", "condition_approval": "GST"},
        {"id": "udyam_specific", "title": "7. MSME Industrial Classification (Udyam Unique)", "desc": "National Industrial Classification (NIC) for MSME certificate issuance.", "condition_approval": "UDYAM"},
        {"id": "trademark_specific", "title": "8. Trademark & Brand Identity (Trademark Unique)", "desc": "Brand wordmark and international classification class.", "condition_approval": "TRADEMARK"},
    ]

    built_sections = []
    total_fields_count = 0
    prefilled_count = 0

    for sec in section_configs:
        cond_app = sec.get("condition_approval")
        if cond_app and cond_app not in selected_approvals:
            continue

        sec_fields = []
        for f_id, field_def in CANONICAL_FIELDS.items():
            if field_def["section"] == sec["id"] and f_id in active_field_map:
                used_by_list = sorted(list(active_field_map[f_id]))
                curr_val = prefill_data.get(f_id, "")
                source_label = prefill_sources.get(f_id)

                total_fields_count += 1
                if curr_val:
                    prefilled_count += 1

                sec_fields.append({
                    **field_def,
                    "used_by": used_by_list,
                    "default_value": curr_val,
                    "prefill_source": source_label,
                })

        if sec_fields:
            built_sections.append({
                "id": sec["id"],
                "title": sec["title"],
                "description": sec["desc"],
                "fields": sec_fields
            })

    # 4. Filter relevant documents
    relevant_docs = []
    for doc_item in SHARED_DOCUMENTS:
        applicable_portals = [p for p in doc_item["used_by"] if p in selected_approvals]
        if applicable_portals:
            # Check if user has uploaded this in Document Center
            existing_doc = None
            if documents:
                canon = doc_item.get("canonical_code", doc_item["doc_id"]).lower()
                doc_id_val = doc_item["doc_id"].lower()
                for d in documents:
                    d_type = str(d.document_type or "").lower()
                    d_name = str(d.document_name or "").lower()
                    if (
                        canon in d_type or doc_id_val in d_type
                        or (canon == "pan_card" and "pan" in d_type)
                        or (canon == "certificate_of_incorporation" and ("incorporation" in d_type or "cin" in d_type or "mca" in d_type))
                        or (canon == "passport_photo" and ("photo" in d_type or "signatory" in d_type))
                        or (canon == "address_proof" and ("address" in d_type or "electricity" in d_type or "utility" in d_type or "rent" in d_type))
                    ):
                        existing_doc = d
                        break

            val_status_str = "VALID"
            if existing_doc and existing_doc.validation_status:
                val_status_str = getattr(existing_doc.validation_status, "value", str(existing_doc.validation_status))

            relevant_docs.append({
                **doc_item,
                "used_by": applicable_portals,
                "is_available_in_center": bool(existing_doc),
                "existing_file_name": existing_doc.file_name if existing_doc else None,
                "existing_doc_id": existing_doc.id if existing_doc else None,
                "validation_status": val_status_str if existing_doc else None,
                "document_number_masked": getattr(existing_doc, "document_number_masked", None) if existing_doc else None,
                "file_size": getattr(existing_doc, "file_size", None) if existing_doc else None,
            })

    return {
        "success": True,
        "selected_approvals": selected_approvals,
        "total_fields": total_fields_count,
        "prefilled_fields_count": prefilled_count,
        "completion_percentage": int((prefilled_count / max(total_fields_count, 1)) * 100),
        "sections": built_sections,
        "document_requirements": relevant_docs,
        "prefill_values": prefill_data
    }


def distribute_canonical_data_to_portals(canonical_data: Dict[str, Any], selected_approvals: List[str]) -> Dict[str, Any]:
    """
    Transforms unified canonical form responses into the exact JSON payloads
    expected by Mock FSSAI, Mock GST, Mock Udyam, and Mock Trademark.
    """
    ext_ref_id = f"SIH-UNIFIED-{int(datetime.now(timezone.utc).timestamp())}"
    portals_payloads = {}

    # 1. FSSAI Payload
    if "FSSAI" in selected_approvals:
        portals_payloads["FSSAI"] = {
            "external_reference_id": f"{ext_ref_id}-FSSAI",
            "business_name": canonical_data.get("business_name") or "Enterprise Foods Private Limited",
            "applicant_name": canonical_data.get("applicant_name") or "Rahul Kumar",
            "email": canonical_data.get("applicant_email") or "applicant@example.com",
            "phone": canonical_data.get("applicant_mobile") or "9876543210",
            "organization_type": canonical_data.get("organization_type") or "PRIVATE_LIMITED",
            "state": canonical_data.get("state") or "Tamil Nadu",
            "district": canonical_data.get("district") or "Salem",
            "pincode": canonical_data.get("pincode") or "636001",
            "address_line_1": canonical_data.get("address_line") or "12 SIDCO Industrial Estate",
            "food_category": canonical_data.get("fssai_food_category") or "PROCESSED_FOODS",
            "daily_capacity": canonical_data.get("fssai_daily_capacity") or "5.0 MT / Day",
            "auto_verify_documents": True
        }

    # 2. GST Payload
    if "GST" in selected_approvals:
        pan = canonical_data.get("business_pan") or canonical_data.get("applicant_pan") or "ABCDE1234F"
        mob = canonical_data.get("applicant_mobile") or "9876543210"
        email = canonical_data.get("applicant_email") or "applicant@example.com"
        state = canonical_data.get("state") or "Tamil Nadu"
        district = canonical_data.get("district") or "Salem"
        pincode = canonical_data.get("pincode") or "636001"

        portals_payloads["GST"] = {
            "external_reference_id": f"{ext_ref_id}-GST",
            "source_system": "TASKER_UNIFIED_PLATFORM",
            "applicant": {
                "name": canonical_data.get("applicant_name") or "Rahul Kumar",
                "mobile": mob,
                "email": email
            },
            "business": {
                "legal_name": canonical_data.get("business_name") or "Enterprise Foods Private Limited",
                "trade_name": canonical_data.get("trade_name") or "Enterprise Foods",
                "pan": pan,
                "constitution": canonical_data.get("organization_type") or "PRIVATE_LIMITED",
                "business_activity": "MANUFACTURER",
                "primary_activity": canonical_data.get("business_activity") or "Packaged Snacks & Food Processing",
                "state": state,
                "district": district,
                "pincode": pincode,
                "reason_for_reg": "New Business Incorporation"
            },
            "principal_place": {
                "premise_name": canonical_data.get("premise_name") or "Enterprise Processing Unit",
                "locality": canonical_data.get("address_line") or "SIDCO Industrial Estate",
                "state": state,
                "district": district,
                "pincode": pincode,
                "nature_of_possession": canonical_data.get("nature_of_possession") or "RENTED"
            },
            "promoters": [
                {
                    "name": canonical_data.get("applicant_name") or "Rahul Kumar",
                    "role": canonical_data.get("gst_authorized_signatory_role") or "Managing Director",
                    "pan": pan,
                    "aadhaar_last4": canonical_data.get("aadhaar_last4") or "1234",
                    "mobile": mob,
                    "email": email,
                    "address": f"{canonical_data.get('address_line', 'Industrial Site')}, {district}"
                }
            ],
            "goods_services": [
                {
                    "type": "GOODS",
                    "description": canonical_data.get("business_activity") or "Packaged Snacks and Agro Products",
                    "hsn_sac_code": canonical_data.get("gst_hsn_code") or "2106"
                }
            ],
            "auto_generate_mock_documents": True
        }

    # 3. Udyam MSME Payload
    if "UDYAM" in selected_approvals:
        pan = canonical_data.get("business_pan") or "ABCDE1234F"
        portals_payloads["UDYAM"] = {
            "external_reference_id": f"{ext_ref_id}-UDYAM",
            "source_system": "TASKER_UNIFIED_PLATFORM",
            "applicant_name": canonical_data.get("applicant_name") or "Rahul Kumar",
            "mobile": canonical_data.get("applicant_mobile") or "9876543210",
            "email": canonical_data.get("applicant_email") or "applicant@example.com",
            "aadhaar_number": "12345678" + (canonical_data.get("aadhaar_last4") or "1234"),
            "pan_number": pan,
            "gstin": f"33{pan}1Z5",
            "enterprise_name": canonical_data.get("business_name") or "Enterprise Foods Private Limited",
            "organisation_type": canonical_data.get("organization_type") or "PRIVATE_LIMITED",
            "major_activity": "MANUFACTURING",
            "nic_code": canonical_data.get("udyam_nic_code") or "10",
            "address_line_1": canonical_data.get("address_line") or "SIDCO Industrial Estate",
            "city": canonical_data.get("district") or "Salem",
            "state": canonical_data.get("state") or "Tamil Nadu",
            "district": canonical_data.get("district") or "Salem",
            "pincode": canonical_data.get("pincode") or "636001",
            "investment": float(canonical_data.get("investment_amount") or 50000000),
            "turnover": float(canonical_data.get("expected_turnover") or 200000000),
            "export_turnover": 0,
            "date_of_incorporation": "2026-01-10",
            "date_of_commencement": "2026-03-01"
        }

    # 4. Trademark Payload
    if "TRADEMARK" in selected_approvals:
        portals_payloads["TRADEMARK"] = {
            "external_reference_id": f"{ext_ref_id}-TM",
            "applicant_name": canonical_data.get("applicant_name") or "Rahul Kumar",
            "applicant_email": canonical_data.get("applicant_email") or "applicant@example.com",
            "business_name": canonical_data.get("business_name") or "Enterprise Foods Private Limited",
            "wordmark": canonical_data.get("trademark_wordmark") or canonical_data.get("trade_name", "ABC FOODS"),
            "nice_class": canonical_data.get("trademark_nice_class") or "Class 29",
            "status": "SUBMITTED"
        }

    return portals_payloads
