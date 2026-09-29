import logging
import os
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session

from app.models.application import (
    Application,
    ApprovalApplication,
    ApprovalJourney,
    UserApprovalSelection,
)
from app.models.business_profile import BusinessProfile
from app.models.user import User
from app.services.form_merge_service import distribute_canonical_data_to_portals
from app.services.fssai_service import submit_fssai_application_headless
from app.services.gst_service import submit_gst_application_headless
from app.services.udyam_service import submit_udyam_application_headless

logger = logging.getLogger(__name__)


async def execute_unified_applications_submission(
    db: Session,
    user: User,
    selected_approvals: List[str],
    canonical_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Takes unified canonical responses, transforms them to portal payloads,
    submits headlessly to all selected external portals, and stores
    both parent journey and child application records in PostgreSQL.
    """
    if not selected_approvals:
        selected_approvals = ["FSSAI", "GST", "UDYAM"]

    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()

    # 1. Create or retrieve parent journey
    year = datetime.now().year
    journey_count = db.query(ApprovalJourney).count() + 1
    journey_num = f"TASKER-JOURNEY-{year}-{journey_count:04d}"

    journey = ApprovalJourney(
        journey_number=journey_num,
        user_id=user.id,
        business_profile_id=profile.id if profile else None,
        selected_approvals=selected_approvals,
        status="IN_PROGRESS",
        canonical_responses=canonical_data,
    )
    db.add(journey)
    db.flush()

    # 2. Distribute canonical data
    portals_payloads = distribute_canonical_data_to_portals(canonical_data, selected_approvals)

    results = []
    has_errors = False

    # A. FSSAI Submission
    if "FSSAI" in selected_approvals:
        try:
            fssai_res = await submit_fssai_application_headless(
                db=db,
                user=user,
                form_data=portals_payloads["FSSAI"]
            )
            app_no = fssai_res.get("fssai_application_number") or fssai_res.get("application_number")
            child_app = ApprovalApplication(
                journey_id=journey.id,
                approval_id="FSSAI",
                approval_name="FSSAI Food Safety Licensing",
                external_system="MOCK_FSSAI",
                external_application_id=app_no,
                status=fssai_res.get("status", "SUBMITTED"),
                portal_url=f"http://localhost:5173/fssai-license",
                submission_payload=portals_payloads["FSSAI"],
                response_payload=fssai_res,
                officer_remarks="Application submitted headlessly to Mock FSSAI portal.",
                registration_ref=fssai_res.get("registration_number")
            )
            db.add(child_app)
            results.append({
                "approval_id": "FSSAI",
                "name": "FSSAI Food Safety Licensing",
                "success": True,
                "application_number": app_no,
                "status": fssai_res.get("status", "SUBMITTED"),
                "message": "FSSAI License application headlessly filed."
            })
        except Exception as e:
            logger.error(f"FSSAI unified submission error: {e}")
            has_errors = True
            results.append({
                "approval_id": "FSSAI",
                "name": "FSSAI Food Safety Licensing",
                "success": False,
                "error": str(e)
            })

    # B. GST Submission
    if "GST" in selected_approvals:
        try:
            gst_res = await submit_gst_application_headless(
                db=db,
                user=user,
                form_data=portals_payloads["GST"]
            )
            app_no = gst_res.get("application_number")
            child_app = ApprovalApplication(
                journey_id=journey.id,
                approval_id="GST",
                approval_name="GST Registration (GSTIN)",
                external_system="MOCK_GST",
                external_application_id=app_no,
                status=gst_res.get("status", "SUBMITTED"),
                portal_url=f"http://localhost:5173/gst-registration",
                submission_payload=portals_payloads["GST"],
                response_payload=gst_res,
                officer_remarks="Application submitted headlessly to Mock GST portal.",
                registration_ref=gst_res.get("mock_registration_ref")
            )
            db.add(child_app)
            results.append({
                "approval_id": "GST",
                "name": "GST Registration",
                "success": True,
                "application_number": app_no,
                "status": gst_res.get("status", "SUBMITTED"),
                "message": "GST Registration headlessly submitted to Mock GST portal."
            })
        except Exception as e:
            logger.error(f"GST unified submission error: {e}")
            has_errors = True
            results.append({
                "approval_id": "GST",
                "name": "GST Registration",
                "success": False,
                "error": str(e)
            })

    # C. Udyam MSME Submission
    if "UDYAM" in selected_approvals:
        try:
            udyam_res = await submit_udyam_application_headless(
                db=db,
                user=user,
                form_data=portals_payloads["UDYAM"]
            )
            app_no = udyam_res.get("udyam_application_number") or udyam_res.get("application_number")
            child_app = ApprovalApplication(
                journey_id=journey.id,
                approval_id="UDYAM",
                approval_name="Udyam MSME Registration Certificate",
                external_system="MOCK_UDYAM",
                external_application_id=app_no,
                status=udyam_res.get("status", "SUBMITTED"),
                portal_url=f"http://localhost:5173/udyam-registration",
                submission_payload=portals_payloads["UDYAM"],
                response_payload=udyam_res,
                officer_remarks=f"Enterprise classified as {udyam_res.get('msme_classification', 'MICRO')} Enterprise.",
                registration_ref=udyam_res.get("udyam_registration_number")
            )
            db.add(child_app)
            results.append({
                "approval_id": "UDYAM",
                "name": "Udyam MSME Registration",
                "success": True,
                "application_number": app_no,
                "status": udyam_res.get("status", "SUBMITTED"),
                "msme_classification": udyam_res.get("msme_classification", "MICRO"),
                "message": "Udyam MSME application submitted & classified."
            })
        except Exception as e:
            logger.error(f"Udyam unified submission error: {e}")
            has_errors = True
            results.append({
                "approval_id": "UDYAM",
                "name": "Udyam MSME Registration",
                "success": False,
                "error": str(e)
            })

    # D. Trademark Submission (if selected)
    if "TRADEMARK" in selected_approvals:
        tm_app_no = f"TM-MOCK-2026-{int(datetime.now().timestamp()) % 1000000:06d}"
        child_app = ApprovalApplication(
            journey_id=journey.id,
            approval_id="TRADEMARK",
            approval_name="Trademark & Brand Protection",
            external_system="MOCK_TRADEMARK",
            external_application_id=tm_app_no,
            status="SUBMITTED",
            portal_url=None,
            submission_payload=portals_payloads.get("TRADEMARK", {}),
            response_payload={"application_number": tm_app_no, "status": "SUBMITTED"},
            officer_remarks="Trademark application dispatched to IP registry scrutiny queue.",
            registration_ref=None
        )
        db.add(child_app)
        results.append({
            "approval_id": "TRADEMARK",
            "name": "Trademark & Brand Protection",
            "success": True,
            "application_number": tm_app_no,
            "status": "SUBMITTED",
            "message": "Trademark application successfully registered."
        })

    # Update journey status
    journey.status = "PARTIALLY_CREATED" if has_errors else "SUBMITTED"

    # Update UserApprovalSelections
    for item in results:
        sel = db.query(UserApprovalSelection).filter(
            UserApprovalSelection.user_id == user.id,
            UserApprovalSelection.approval_id == item["approval_id"]
        ).first()
        if sel:
            sel.status = item.get("status", "SUBMITTED") if item.get("success") else "FAILED"

    db.commit()
    db.refresh(journey)

    return {
        "success": not has_errors or len([r for r in results if r.get("success")]) > 0,
        "journey_id": journey.id,
        "journey_number": journey.journey_number,
        "status": journey.status,
        "selected_approvals": selected_approvals,
        "results": results,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
