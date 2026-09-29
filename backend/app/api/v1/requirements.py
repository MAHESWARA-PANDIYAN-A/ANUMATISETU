import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.application import (
    Application,
    ApprovalApplication,
    ApprovalJourney,
    UserApprovalSelection,
)
from app.models.business_profile import BusinessProfile
from app.models.document import Document
from app.models.user import User
from app.services.form_merge_service import prepare_unified_form_schema
from app.services.requirements_engine import evaluate_business_requirements
from app.services.unified_submission_service import execute_unified_applications_submission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["TASKER Unified Requirements & Dynamic Applications"])


# ─── 1. ONBOARDING & STATE ROUTING STATUS ────────────────────────────────────
@router.get("/onboarding/status", response_model=Dict[str, Any])
async def get_onboarding_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Returns the applicant's current onboarding state to power clean, state-based routing.
    Possible states:
    - BUSINESS_PROFILE_INCOMPLETE
    - REQUIREMENTS_PENDING
    - APPROVALS_SELECTED
    - ACTIVE_USER
    """
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()

    if not profile or not profile.company_name or not profile.industry:
        return {
            "success": True,
            "state": "BUSINESS_PROFILE_INCOMPLETE",
            "next_route": "/onboarding/business",
            "message": "Please set up your business profile first."
        }

    selections = db.query(UserApprovalSelection).filter(
        UserApprovalSelection.user_id == current_user.id,
        UserApprovalSelection.selected == True
    ).all()

    if not selections:
        return {
            "success": True,
            "state": "REQUIREMENTS_PENDING",
            "next_route": "/requirements",
            "message": "Business profile ready. Please select your required approvals."
        }

    # Check if applications or journey exist
    apps_count = db.query(Application).filter(Application.applicant_id == current_user.id).count()
    journeys_count = db.query(ApprovalJourney).filter(ApprovalJourney.user_id == current_user.id).count()

    if apps_count == 0 and journeys_count == 0:
        return {
            "success": True,
            "state": "APPROVALS_SELECTED",
            "next_route": "/applications/new",
            "selected_approvals": [s.approval_id for s in selections],
            "message": "Approvals selected. Ready to complete unified application."
        }

    return {
        "success": True,
        "state": "ACTIVE_USER",
        "next_route": "/applicant",
        "selected_approvals": [s.approval_id for s in selections],
        "message": "Active enterprise dashboard ready."
    }


# ─── 2. REQUIREMENTS RECOMMENDATIONS ENGINE ──────────────────────────────────
@router.get("/requirements/recommendations", response_model=Dict[str, Any])
async def get_requirements_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Dynamically generates potentially applicable statutory approvals
    based strictly on the applicant's BusinessProfile.
    """
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    result = evaluate_business_requirements(profile)
    return result


# ─── 3. USER APPROVAL SELECTIONS ──────────────────────────────────────────────
@router.post("/approval-selections", response_model=Dict[str, Any])
@router.post("/requirements/approval-selections", response_model=Dict[str, Any])
async def save_approval_selections(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Saves or updates the user's chosen approval workflows (e.g. ['FSSAI', 'GST', 'UDYAM']).
    """
    selected_ids = payload.get("selected_approvals") or payload.get("approval_ids") or []
    if not selected_ids or not isinstance(selected_ids, list):
        raise HTTPException(status_code=400, detail="Please select at least one approval to proceed.")

    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()

    # Clear previous un-submitted selections or update
    for sel_id in selected_ids:
        clean_id = str(sel_id).upper().strip()
        existing = db.query(UserApprovalSelection).filter(
            UserApprovalSelection.user_id == current_user.id,
            UserApprovalSelection.approval_id == clean_id
        ).first()

        name_map = {
            "FSSAI": "FSSAI Food Safety Licensing",
            "GST": "GST Registration (GSTIN)",
            "UDYAM": "Udyam MSME Registration",
            "TRADEMARK": "Trademark Brand Protection"
        }
        dept_map = {
            "FSSAI": "Food Safety and Standards Authority of India",
            "GST": "Goods and Services Tax Network",
            "UDYAM": "Ministry of MSME",
            "TRADEMARK": "CGPDTM"
        }

        if existing:
            existing.selected = True
            existing.status = "SELECTED"
        else:
            new_sel = UserApprovalSelection(
                user_id=current_user.id,
                business_profile_id=profile.id if profile else None,
                approval_id=clean_id,
                approval_name=name_map.get(clean_id, clean_id),
                department=dept_map.get(clean_id, "Statutory Authority"),
                category="STATUTORY",
                selected=True,
                status="SELECTED"
            )
            db.add(new_sel)

    # De-select unchosen
    all_user_sels = db.query(UserApprovalSelection).filter(UserApprovalSelection.user_id == current_user.id).all()
    for s in all_user_sels:
        if s.approval_id not in [str(x).upper().strip() for x in selected_ids]:
            s.selected = False

    db.commit()

    return {
        "success": True,
        "message": f"Saved {len(selected_ids)} selected approval workflows.",
        "selected_approvals": selected_ids,
        "next_route": "/applications/new"
    }


@router.get("/approval-selections", response_model=Dict[str, Any])
@router.get("/requirements/approval-selections", response_model=Dict[str, Any])
async def get_user_approval_selections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Returns the applicant's current active approval selections."""
    selections = db.query(UserApprovalSelection).filter(
        UserApprovalSelection.user_id == current_user.id,
        UserApprovalSelection.selected == True
    ).all()

    return {
        "success": True,
        "count": len(selections),
        "selections": [
            {
                "approval_id": s.approval_id,
                "approval_name": s.approval_name,
                "department": s.department,
                "status": s.status,
                "selected_at": s.selected_at.isoformat() if s.selected_at else None
            }
            for s in selections
        ]
    }


# ─── 4. FORM PREPARATION & DEDUPLICATION ─────────────────────────────────────
@router.post("/applications/prepare", response_model=Dict[str, Any])
@router.post("/requirements/applications/prepare", response_model=Dict[str, Any])
async def prepare_unified_form(
    payload: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Fetches schemas for chosen approvals, removes duplicate canonical fields,
    computes 'used_by' badges, and pre-fills from BusinessProfile & Document Center.
    """
    payload = payload or {}
    requested_approvals = payload.get("approval_ids") or payload.get("selected_approvals")

    if not requested_approvals:
        # Load from DB selections
        selections = db.query(UserApprovalSelection).filter(
            UserApprovalSelection.user_id == current_user.id,
            UserApprovalSelection.selected == True
        ).all()
        requested_approvals = [s.approval_id for s in selections]

    if not requested_approvals:
        requested_approvals = ["FSSAI", "GST", "UDYAM"]

    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()
    documents = db.query(Document).filter(
        (Document.applicant_id == current_user.id) | (Document.user_id == current_user.id)
    ).all()

    schema_result = prepare_unified_form_schema(
        selected_approvals=requested_approvals,
        user=current_user,
        profile=profile,
        documents=documents
    )

    return schema_result


# ─── 5. UNIFIED ONE-SHOT APPLICATION SUBMISSION ──────────────────────────────
@router.post("/applications/unified-submit", response_model=Dict[str, Any])
@router.post("/requirements/applications/unified-submit", response_model=Dict[str, Any])
async def submit_unified_applications(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Method 2: 100% Automated Multi-Portal Submission.
    Distributes unified canonical data to Mock FSSAI, Mock GST, Mock Udyam,
    persists records in PostgreSQL, and generates external application tracking IDs.
    """
    selected_approvals = payload.get("selected_approvals") or payload.get("approval_ids") or ["FSSAI", "GST", "UDYAM"]
    canonical_data = payload.get("canonical_data") or payload.get("formData") or {}

    if not canonical_data:
        raise HTTPException(status_code=400, detail="Form data payload is required.")

    result = await execute_unified_applications_submission(
        db=db,
        user=current_user,
        selected_approvals=selected_approvals,
        canonical_data=canonical_data
    )

    return result


# ─── 6. DYNAMIC DASHBOARD DATA (SHOWS ONLY RELEVANT USER APPROVALS) ─────────
@router.get("/dashboard/my-approvals", response_model=Dict[str, Any])
@router.get("/requirements/dashboard/my-approvals", response_model=Dict[str, Any])
async def get_dashboard_my_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Returns ONLY the approvals relevant to this applicant (selected & active).
    No hardcoded 4 cards! Includes live status, external IDs, and direct portal links.
    """
    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()

    selections = db.query(UserApprovalSelection).filter(
        UserApprovalSelection.user_id == current_user.id,
        UserApprovalSelection.selected == True
    ).all()

    child_apps = db.query(ApprovalApplication).join(ApprovalJourney).filter(
        ApprovalJourney.user_id == current_user.id
    ).order_by(ApprovalApplication.created_at.desc()).all()

    # Also check legacy Application table for FSSAI / GST / Udyam numbers
    legacy_apps = db.query(Application).filter(Application.applicant_id == current_user.id).all()

    active_cards = []
    selected_set = {s.approval_id for s in selections}

    # If no explicit selections exist but applications exist, infer from apps
    if not selected_set:
        for la in legacy_apps:
            if la.fssai_application_number:
                selected_set.add("FSSAI")
            if la.gst_application_number:
                selected_set.add("GST")
            if la.udyam_application_number:
                selected_set.add("UDYAM")

    # If still empty, return empty list (clean state)
    if not selected_set and not profile:
        return {
            "success": True,
            "has_profile": False,
            "approvals": []
        }

    # Map approval metadata
    approval_meta = {
        "FSSAI": {
            "title": "FSSAI Food Safety Licensing",
            "department": "Food Safety and Standards Authority of India",
            "category": "FOOD_SAFETY",
            "color": "emerald",
            "icon": "ShieldCheck",
            "portal_route": "/fssai-license"
        },
        "GST": {
            "title": "GST Registration (GSTIN)",
            "department": "Goods and Services Tax Network",
            "category": "TAX",
            "color": "teal",
            "icon": "Receipt",
            "portal_route": "/gst-registration"
        },
        "UDYAM": {
            "title": "Udyam MSME Registration",
            "department": "Ministry of Micro, Small and Medium Enterprises",
            "category": "MSME",
            "color": "amber",
            "icon": "Award",
            "portal_route": "/udyam-registration"
        },
        "TRADEMARK": {
            "title": "Trademark & Brand Protection",
            "department": "Controller General of Patents, Designs and Trade Marks",
            "category": "INTELLECTUAL_PROPERTY",
            "color": "purple",
            "icon": "Sparkles",
            "portal_route": None
        }
    }

    for app_id in sorted(list(selected_set)):
        meta = approval_meta.get(app_id, {
            "title": f"{app_id} Clearance",
            "department": "Statutory Authority",
            "category": "GENERAL",
            "color": "blue",
            "icon": "FileCheck",
            "portal_route": None
        })

        # Find latest application records
        matched_child = next((ca for ca in child_apps if ca.approval_id == app_id), None)
        app_num = matched_child.external_application_id if matched_child else None
        app_status = matched_child.status if matched_child else "SELECTED"
        ref_no = matched_child.registration_ref if matched_child else None
        officer_note = matched_child.officer_remarks if matched_child else None

        # Check selection status
        matched_sel = next((s for s in selections if s.approval_id == app_id), None)
        if matched_sel and matched_sel.status == "APPROVED":
            app_status = "APPROVED"

        child_is_approved = bool(matched_child and (str(matched_child.status).upper() in ("APPROVED", "ISSUED", "REGISTERED", "LICENSE_ISSUED") or bool(matched_child.registration_ref)))
        legacy_is_approved = False

        # Check legacy fallback
        for la in legacy_apps:
            if app_id == "FSSAI":
                f_app = getattr(la, "fssai_application_number", None)
                f_stat = str(getattr(la, "fssai_status", "") or "").upper()
                f_lic = getattr(la, "fssai_license_number", None)
                if not app_num and f_app:
                    app_num = f_app
                if f_stat in ("APPROVED", "ISSUED", "LICENSE_ISSUED") or f_lic:
                    legacy_is_approved = True
                    if f_lic:
                        ref_no = f_lic
                elif not child_is_approved and f_stat and f_stat not in ("NOT_STARTED", "SELECTED", "DRAFT", "NONE") and app_status != "APPROVED":
                    app_status = f_stat
            elif app_id == "GST":
                g_app = getattr(la, "gst_application_number", None)
                g_stat = str(getattr(la, "gst_status", "") or "").upper()
                g_ref = getattr(la, "gst_registration_ref", None)
                if not app_num and g_app:
                    app_num = g_app
                if g_stat in ("APPROVED", "ISSUED", "REGISTERED") or g_ref:
                    legacy_is_approved = True
                    if g_ref:
                        ref_no = g_ref
                elif not child_is_approved and g_stat and g_stat not in ("NOT_STARTED", "SELECTED", "DRAFT", "NONE") and app_status != "APPROVED":
                    app_status = g_stat
            elif app_id == "UDYAM":
                u_app = getattr(la, "udyam_application_number", None)
                u_stat = str(getattr(la, "udyam_status", "") or "").upper()
                u_ref = getattr(la, "udyam_registration_number", None)
                if not app_num and u_app:
                    app_num = u_app
                if u_stat in ("APPROVED", "ISSUED", "REGISTERED") or u_ref:
                    legacy_is_approved = True
                    if u_ref:
                        ref_no = u_ref
                elif not child_is_approved and u_stat and u_stat not in ("NOT_STARTED", "SELECTED", "DRAFT", "NONE") and app_status != "APPROVED":
                    app_status = u_stat

        # If status is APPROVED in any record or ref_no exists, ensure rich approved details
        is_approved = child_is_approved or legacy_is_approved or str(app_status).upper() in ("APPROVED", "ISSUED", "REGISTERED", "LICENSE_ISSUED") or bool(ref_no)
        if is_approved:
            app_status = "APPROVED"
        elif app_num and str(app_status).upper() in ("NOT_STARTED", "SELECTED", "DRAFT", "NONE", ""):
            app_status = "SUBMITTED"

        # Generate default certificate reference if approved
        if app_status == "APPROVED" and not ref_no:
            if app_id == "FSSAI":
                ref_no = f"FSSAI-LIC-2026-{(app_num or '511689').split('-')[-1]}"
            elif app_id == "UDYAM":
                ref_no = f"UDYAM-TN-24-{(app_num or '000011').split('-')[-1]}"
            elif app_id == "GST":
                ref_no = "33AAACA1234F1Z5"
            elif app_id == "TRADEMARK":
                ref_no = "TM-5928104-CLASS29"

        # Rich certificate and portal details
        cert_url = None
        validity = None
        classification = None
        if app_id == "UDYAM":
            cert_url = f"http://localhost:8001/certificate/{ref_no or 'UDYAM-TN-24-000011'}"
            validity = "Permanent MSME Lifetime Recognition"
            classification = "Small Enterprise (Manufacturing)"
        elif app_id == "FSSAI":
            cert_url = f"http://localhost:8002/track?app={app_num or 'FSSAI-MOCK-2026-511689'}"
            validity = "5 Years (Valid until 2031)"
            classification = "State License (Food Processing Unit)"
        elif app_id == "GST":
            cert_url = f"http://localhost:8003/track?app={app_num or 'GST-MOCK-2026-00001'}"
            validity = "Active & Regular Filing Status"
            classification = "Regular GST Taxpayer (SGST / CGST)"
        elif app_id == "TRADEMARK":
            cert_url = None
            validity = "10 Years (Valid until 2036)"
            classification = "Registered Wordmark (Class 29)"

        active_cards.append({
            "approval_id": app_id,
            "title": meta["title"],
            "department": meta["department"],
            "category": meta["category"],
            "color": meta["color"],
            "icon": meta["icon"],
            "portal_route": meta["portal_route"],
            "application_number": app_num,
            "status": app_status,
            "registration_ref": ref_no,
            "certificate_url": cert_url,
            "validity": validity,
            "classification": classification,
            "approved_at": "2026-09-28T10:00:00Z" if app_status == "APPROVED" else None,
            "officer_remarks": officer_note or ("Automated verification passed. Statutory certificate issued." if app_status == "APPROVED" else "Application submitted and queued for departmental verification."),
            "has_application": bool(app_num)
        })

    return {
        "success": True,
        "has_profile": bool(profile),
        "business_name": profile.company_name if profile else None,
        "industry": profile.industry if profile else None,
        "district": profile.district if profile else None,
        "state": profile.state if profile else None,
        "total_active_approvals": len(active_cards),
        "approved_count": len([c for c in active_cards if c["status"] == "APPROVED"]),
        "approvals": active_cards,
        "applications": active_cards
    }


# ─── 7. SIMULATE / SYNC APPROVAL STATUS ──────────────────────────────────────
@router.post("/applications/{approval_id}/simulate-status", response_model=Dict[str, Any])
@router.post("/requirements/applications/{approval_id}/simulate-status", response_model=Dict[str, Any])
async def simulate_approval_status(
    approval_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Allows toggling an application status to APPROVED, UNDER_REVIEW, DOCUMENT_QUERY, or SUBMITTED
    for instant demonstration of the approved certificate UI.
    """
    clean_id = approval_id.upper().strip()
    target_status = payload.get("status", "APPROVED").upper().strip()

    # Security check: Applicants cannot grant approvals to themselves
    from app.models.user import UserRole
    if current_user.role not in [UserRole.OFFICER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Applicants cannot grant statutory approvals on their own applications. Statutory clearances must be issued by an authorized department officer."
        )

    # Target applicant profile/journey (if officer passed user_id or for current profile)
    target_user_id = payload.get("user_id", current_user.id)
    child_apps = db.query(ApprovalApplication).join(ApprovalJourney).filter(
        ApprovalJourney.user_id == target_user_id,
        ApprovalApplication.approval_id == clean_id
    ).all()

    # Generate ref number if approving
    ref_number = payload.get("registration_ref")
    if target_status == "APPROVED" and not ref_number:
        if clean_id == "UDYAM":
            ref_number = "UDYAM-TN-24-000011"
        elif clean_id == "FSSAI":
            ref_number = "FSSAI-LIC-2026-511689"
        elif clean_id == "GST":
            ref_number = "33AAACA1234F1Z5"
        elif clean_id == "TRADEMARK":
            ref_number = "TM-5928104-CLASS29"

    for ca in child_apps:
        ca.status = target_status
        if ref_number:
            ca.registration_ref = ref_number
        ca.officer_remarks = f"Status updated to {target_status} via TASKER Compliance Engine."

    # Also update legacy Application records if present
    legacy_apps = db.query(Application).filter(Application.applicant_id == current_user.id).all()
    for la in legacy_apps:
        if clean_id == "FSSAI":
            la.fssai_status = target_status
            if ref_number:
                la.fssai_license_number = ref_number
        elif clean_id == "GST":
            la.gst_status = target_status
            if ref_number:
                la.gst_registration_ref = ref_number
        elif clean_id == "UDYAM":
            la.udyam_status = target_status
            if ref_number:
                la.udyam_registration_number = ref_number

    db.commit()

    return {
        "success": True,
        "approval_id": clean_id,
        "new_status": target_status,
        "registration_ref": ref_number,
        "message": f"{clean_id} status updated to {target_status}."
    }
