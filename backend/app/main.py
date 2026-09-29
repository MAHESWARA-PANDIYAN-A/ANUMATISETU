import logging
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import Base, check_db_connection, engine
from app.db.seed import seed_departments, seed_demo_users
from app.db.seed_approval_intelligence import seed_approval_intelligence_all

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sih26130_backend")


def ensure_schema_updates():
    try:
        Base.metadata.create_all(bind=engine)
        if engine.dialect.name == "postgresql":
            with engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS expected_completion_date TIMESTAMP;
                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP;
                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
                    
                    ALTER TABLE application_approvals ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
                    ALTER TABLE application_approvals ADD COLUMN IF NOT EXISTS expected_completion_date TIMESTAMP;
                    ALTER TABLE application_approvals ADD COLUMN IF NOT EXISTS inspection_required BOOLEAN DEFAULT FALSE;
                    ALTER TABLE application_approvals ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP;
                    ALTER TABLE application_approvals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
                    
                    ALTER TABLE inspections ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(50);
                    ALTER TABLE inspections ADD COLUMN IF NOT EXISTS location VARCHAR(500);

                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS fssai_application_number VARCHAR(50);
                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS fssai_status VARCHAR(50) DEFAULT 'NOT_STARTED';
                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS fssai_last_synced_at TIMESTAMP;
                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS fssai_officer_remarks TEXT;
                    ALTER TABLE applications ADD COLUMN IF NOT EXISTS fssai_external_data JSONB;

                    -- Document Storage & Cloudinary Metadata Extensions
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'CLOUDINARY';
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS cloudinary_asset_id VARCHAR(255);
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(500);
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS cloudinary_resource_type VARCHAR(50) DEFAULT 'image';
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS cloudinary_asset_type VARCHAR(50) DEFAULT 'authenticated';
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS cloudinary_version VARCHAR(50);
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS cloudinary_folder VARCHAR(255);
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_status VARCHAR(50) DEFAULT 'ACTIVE';
                    ALTER TABLE documents ALTER COLUMN file_path DROP NOT NULL;

                    ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS cloudinary_asset_id VARCHAR(255);
                    ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(500);
                    ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS cloudinary_resource_type VARCHAR(50) DEFAULT 'image';
                    ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS cloudinary_asset_type VARCHAR(50) DEFAULT 'authenticated';
                    ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS cloudinary_version VARCHAR(50);
                    ALTER TABLE document_versions ALTER COLUMN stored_filename DROP NOT NULL;
                    ALTER TABLE document_versions ALTER COLUMN storage_path DROP NOT NULL;
                """))
                conn.commit()
        logger.info("Database schema columns verified and up-to-date.")
        seed_departments()
        seed_demo_users()
        seed_approval_intelligence_all()
    except Exception as e:
        logger.error(f"Error ensuring schema updates: {e}")


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-blocking schema & seed verification on application startup
    try:
        ensure_schema_updates()
    except Exception as err:
        logger.warning(f"Startup initialization notice: {err}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Single-Window Industrial Approvals, Compliance Processes, and Support Services.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS (Fully supports Vercel, Render, and Localhost with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Formats HTTP exceptions consistently."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "type": "HTTPException"
            }
        },
        headers=exc.headers
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats validation errors into clear, actionable JSON."""
    errors = []
    messages = []
    for err in exc.errors():
        field_parts = [str(loc) for loc in err["loc"] if loc != "body"]
        field_name = " -> ".join(field_parts) if field_parts else "field"
        clean_msg = err["msg"]
        errors.append({"field": field_name, "message": clean_msg})
        messages.append(f"{field_name}: {clean_msg}")
    
    summary_message = "; ".join(messages) if messages else "Validation failed on the submitted data."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": 422,
                "message": summary_message,
                "details": errors,
                "type": "ValidationError"
            }
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catches unhandled exceptions and prevents internal trace leaks."""
    logger.error(f"Unhandled server error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": 500,
                "message": "An internal server error occurred. Please try again later.",
                "type": "InternalServerError"
            }
        }
    )


# Root Health Check as required: GET /api/health
@app.get("/api/health", tags=["Health"])
def health_check():
    """
    Primary system, database, and Cloudinary storage connectivity health check.
    Endpoint: GET /api/health
    """
    from app.services.cloudinary_service import cloudinary_service
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


# Include API Routes under /api/v1 and alias under /api
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, prefix="/api")


@app.api_route("/", methods=["GET", "HEAD"], tags=["Root"])
def root_info():
    return {
        "project": settings.PROJECT_NAME,
        "status": "operational",
        "health_check": "/api/health",
        "api_v1": settings.API_V1_STR,
        "docs": "/docs"
    }
