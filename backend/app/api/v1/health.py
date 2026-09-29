from datetime import datetime, timezone
from fastapi import APIRouter, status
from app.core.database import check_db_connection
from app.core.config import settings
from app.services.cloudinary_service import cloudinary_service

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
def get_health_status():
    """
    Health check endpoint returning system status, database connectivity, and Cloudinary storage state.
    """
    db_connected = check_db_connection()
    cld_status = cloudinary_service.check_connectivity()

    is_healthy = db_connected and (cld_status.get("status") in ["connected", "unconfigured_simulated"])

    return {
        "status": "healthy" if is_healthy else "degraded",
        "database": "connected" if db_connected else "disconnected",
        "cloudinary": {
            "configured": cld_status.get("configured", False),
            "status": cld_status.get("status", "unknown"),
            "cloud_name": cld_status.get("cloud_name", "none"),
        },
        "service": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
