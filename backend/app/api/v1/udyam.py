import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.application import Application
from app.models.user import User
from app.services.udyam_service import (
    get_udyam_schema,
    get_udyam_prefill_context,
    submit_udyam_application_headless,
    sync_udyam_application_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/udyam", tags=["Udyam MSME Registration Integration"])


@router.get("/schema", response_model=Dict[str, Any])
async def fetch_schema():
    """Dynamically retrieves the Udyam form schema with sections, fields, validations and options."""
    schema = await get_udyam_schema()
    return {
        "success": True,
        "source": "Mock Udyam MSME Portal / Public Schema Discovery",
        "data": schema
    }


@router.get("/prefill-data", response_model=Dict[str, Any])
async def get_prefill_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieves existing business profile data mapped to Udyam registration fields."""
    context = await get_udyam_prefill_context(db, current_user)
    return {
        "success": True,
        "data": context
    }


@router.post("/direct-submit", response_model=Dict[str, Any])
async def submit_udyam_direct_endpoint(
    form_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Method 2: 100% Automated / Headless Direct Submission to Mock Udyam Microservice.
    Executes automated MSME tier classification and synchronizes record into Main Platform DB.
    """
    try:
        result = await submit_udyam_application_headless(
            db=db,
            user=current_user,
            form_data=form_data
        )
        return result
    except Exception as e:
        logger.error(f"Udyam Headless Submission Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Udyam Headless Integration Failed: {str(e)}"
        )


@router.get("/status/{udyam_application_number}", response_model=Dict[str, Any])
async def get_udyam_status(
    udyam_application_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Syncs and returns real-time approval status from Mock Udyam portal."""
    try:
        result = await sync_udyam_application_status(
            db=db,
            user=current_user,
            udyam_application_number=udyam_application_number
        )
        return result
    except Exception as e:
        logger.error(f"Udyam Status Sync Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to sync with Udyam portal: {str(e)}"
        )


@router.post("/sync-all", response_model=Dict[str, Any])
async def sync_all_udyam_applications_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Syncs all active Udyam applications belonging to the current applicant."""
    apps = db.query(Application).filter(
        Application.applicant_id == current_user.id,
        Application.udyam_application_number.isnot(None)
    ).all()

    synced_results = []
    for app in apps:
        try:
            res = await sync_udyam_application_status(db, current_user, app.udyam_application_number)
            synced_results.append(res)
        except Exception as e:
            logger.warning(f"Failed to sync Udyam {app.udyam_application_number}: {e}")
            synced_results.append({
                "application_number": app.udyam_application_number,
                "status": app.udyam_status,
                "error": str(e)
            })

    return {
        "success": True,
        "count": len(synced_results),
        "results": synced_results
    }
