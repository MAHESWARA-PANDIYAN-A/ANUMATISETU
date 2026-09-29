from fastapi import APIRouter
from app.api.v1 import (
    auth,
    health,
    protected,
    business_profile,
    approvals,
    documents,
    applications,
    regulatory_assistant,
    schemes,
    analytics,
    fssai,
    udyam,
    gst,
    requirements,
    assistant,
    approval_intelligence,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(protected.router, tags=["Role Protected Routes"])
api_router.include_router(business_profile.router, tags=["Business Profile"])
api_router.include_router(approvals.router, tags=["Approvals Recommendation"])
api_router.include_router(approval_intelligence.router, tags=["Approval Intelligence, Plan, Coverage & Compliance"])
api_router.include_router(documents.router, tags=["Document Intelligence & Pre-validation"])
api_router.include_router(applications.router, tags=["Applications & Workflows"])
api_router.include_router(regulatory_assistant.router, tags=["Regulatory Knowledge Assistant"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["Personalized TASKER Assistant"])
api_router.include_router(schemes.router, tags=["Government Scheme Discovery"])
api_router.include_router(analytics.router, tags=["Government Analytics & Executive Intelligence"])
api_router.include_router(fssai.router, tags=["FSSAI Food Safety Integration"])
api_router.include_router(udyam.router, tags=["Udyam MSME Registration Integration"])
api_router.include_router(gst.router, tags=["GST Registration Integration"])
api_router.include_router(requirements.router, tags=["TASKER Unified Requirements & Dynamic Applications"])


