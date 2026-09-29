import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_active_user
from app.models.application import Application
from app.models.user import User
from app.services.gst_service import (
    get_gst_schema,
    get_gst_prefill_context,
    submit_gst_application_headless,
    sync_gst_application_status,
    sync_all_gst_applications,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gst", tags=["GST Registration Integration"])


@router.get("/schema", response_model=Dict[str, Any])
async def fetch_schema():
    """Dynamically retrieves the GST form schema with sections, fields, validations and options."""
    schema = await get_gst_schema()
    return {
        "success": True,
        "source": "Mock GST Registration Portal / Schema Discovery",
        "data": schema
    }


@router.get("/prefill-data", response_model=Dict[str, Any])
async def get_prefill_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retrieves existing business profile data mapped to GST registration fields."""
    context = await get_gst_prefill_context(db, current_user)
    return {
        "success": True,
        "data": context
    }


@router.post("/headless-submit", response_model=Dict[str, Any])
async def submit_gst_headless_endpoint(
    form_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Method 2: 100% Automated / Headless Direct Submission to Mock GST Microservice.
    Executes automated registration and synchronizes record into Main Platform DB.
    """
    try:
        result = await submit_gst_application_headless(
            db=db,
            user=current_user,
            form_data=form_data
        )
        return result
    except Exception as e:
        logger.error(f"GST Headless Submission Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GST Headless Integration Failed: {str(e)}"
        )


@router.get("/status/{gst_application_number}", response_model=Dict[str, Any])
async def get_gst_status(
    gst_application_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Syncs and returns real-time approval status from Mock GST portal."""
    try:
        result = await sync_gst_application_status(
            db=db,
            user=current_user,
            gst_application_number=gst_application_number
        )
        return result
    except Exception as e:
        logger.error(f"GST Status Sync Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to sync with GST portal: {str(e)}"
        )


@router.post("/sync-all", response_model=Dict[str, Any])
async def sync_all_gst_applications_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Syncs all active GST applications belonging to the current applicant."""
    results = await sync_all_gst_applications(db=db, user=current_user)
    return {
        "success": True,
        "count": len(results),
        "results": results
    }
