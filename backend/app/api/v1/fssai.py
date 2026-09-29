import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.application import Application
from app.models.user import User
from app.services.fssai_service import (
    get_fssai_document_requirements,
    get_fssai_prefill_context,
    submit_fssai_application_headless,
    sync_fssai_application_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fssai", tags=["FSSAI Food Safety Integration"])


@router.get("/requirements", response_model=Dict[str, Any])
async def fetch_requirements():
    """Dynamically retrieves the statutory 4 document specifications for FSSAI licensing."""
    requirements = await get_fssai_document_requirements()
    return {
        "success": True,
        "source": "Mock FSSAI Portal / External Statutory Authority",
        "data": requirements
    }


@router.get("/prefill-data", response_model=Dict[str, Any])
async def get_prefill_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieves existing business profile data and document references to prefill FSSAI application."""
    context = await get_fssai_prefill_context(db, current_user)
    return {
        "success": True,
        "data": context
    }


@router.post("/submit-headless", response_model=Dict[str, Any])
async def submit_fssai_headless_endpoint(
    payload: Optional[str] = Form(None),
    identity_proof: Optional[UploadFile] = File(None),
    address_proof: Optional[UploadFile] = File(None),
    passport_photo: Optional[UploadFile] = File(None),
    food_product_category: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    100% Headless Automated FSSAI Submission:
    Executes 3-step automated API pipeline: Prefill ➔ Upload 4 Documents ➔ Submit.
    """
    form_data: Dict[str, Any] = {}
    if payload:
        try:
            form_data = json.loads(payload)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {e}")
    
    files_dict = {}
    if identity_proof:
        files_dict["identity_proof"] = identity_proof
    if address_proof:
        files_dict["address_proof"] = address_proof
    if passport_photo:
        files_dict["passport_photo"] = passport_photo
    if food_product_category:
        files_dict["food_product_category"] = food_product_category

    try:
        result = await submit_fssai_application_headless(
            db=db,
            user=current_user,
            form_data=form_data,
            files_dict=files_dict
        )
        return result
    except Exception as e:
        logger.error(f"FSSAI Headless Submission Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"FSSAI Headless Integration Failed: {str(e)}"
        )


@router.post("/submit-json", response_model=Dict[str, Any])
async def submit_fssai_json_endpoint(
    form_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """JSON-only Headless Submission (uses pre-validated verified documents automatically)."""
    try:
        result = await submit_fssai_application_headless(
            db=db,
            user=current_user,
            form_data=form_data,
            files_dict={}
        )
        return result
    except Exception as e:
        logger.error(f"FSSAI Headless Submission Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"FSSAI Headless Integration Failed: {str(e)}"
        )


@router.get("/status/{fssai_application_number}", response_model=Dict[str, Any])
async def get_fssai_status(
    fssai_application_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Syncs and returns real-time approval status from Mock FSSAI portal."""
    try:
        result = await sync_fssai_application_status(
            db=db,
            user=current_user,
            fssai_application_number=fssai_application_number
        )
        return result
    except Exception as e:
        logger.error(f"FSSAI Status Sync Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to sync with FSSAI portal: {str(e)}"
        )


@router.get("/application/{fssai_application_number}", response_model=Dict[str, Any])
async def get_fssai_app_details_endpoint(
    fssai_application_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieves full application details including inspections, queries, and timeline from Mock FSSAI."""
    try:
        from app.services.fssai_service import get_fssai_application_details
        result = await get_fssai_application_details(
            db=db,
            user=current_user,
            fssai_application_number=fssai_application_number
        )
        return result
    except Exception as e:
        logger.error(f"FSSAI Application Details Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch FSSAI application details: {str(e)}"
        )


@router.post("/sync-all", response_model=Dict[str, Any])
async def sync_all_fssai_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Syncs all active FSSAI applications belonging to the current applicant."""
    apps = db.query(Application).filter(
        Application.applicant_id == current_user.id,
        Application.fssai_application_number.isnot(None)
    ).all()

    synced_results = []
    for app in apps:
        try:
            res = await sync_fssai_application_status(db, current_user, app.fssai_application_number)
            synced_results.append(res)
        except Exception as e:
            logger.warning(f"Failed to sync {app.fssai_application_number}: {e}")
            synced_results.append({
                "application_number": app.fssai_application_number,
                "status": app.fssai_status,
                "error": str(e)
            })

    return {
        "success": True,
        "count": len(synced_results),
        "results": synced_results
    }
