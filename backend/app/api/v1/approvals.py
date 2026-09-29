import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_current_user, get_db
from app.models.audit_log import AuditLog
from app.models.business_profile import BusinessProfile
from app.models.user import User, UserRole
from app.schemas.recommendation import ApprovalRecommendationItem, RecommendationRequest
from app.services.ai_service import explain_approvals_with_ai
from app.services.matching_engine import match_approvals_deterministic

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/approvals/recommend",
    response_model=List[ApprovalRecommendationItem],
    status_code=status.HTTP_200_OK,
    summary="Generate AI-assisted approval recommendations from controlled knowledge base",
)
def get_approval_recommendations(
    req: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Given an applicant's business profile ID, evaluates applicable industrial approvals
    using the controlled approval knowledge base, enhances explanations using Groq/Grok AI,
    logs the audit record, and returns structured recommendations.
    """
    profile = db.query(BusinessProfile).filter(BusinessProfile.id == req.business_profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business profile with ID {req.business_profile_id} was not found."
        )

    # Security check: Only the profile owner or an ADMIN may request recommendations
    if profile.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You may only generate recommendations for your own business profile."
        )

    # 1. Deterministic Rule Matching against controlled knowledge base
    matched_rules = match_approvals_deterministic(profile)

    # 2. Groq/Grok AI Explanation Layer (strictly bounded to pre-matched rules)
    recommendations, provider_used = explain_approvals_with_ai(profile, matched_rules)

    # 3. Audit Logging in PostgreSQL
    try:
        audit_entry = AuditLog(
            user_id=current_user.id,
            business_profile_id=profile.id,
            action="AI_APPROVAL_RECOMMENDATION",
            input_summary={
                "company_name": profile.company_name,
                "industry": profile.industry,
                "business_type": profile.business_type,
                "district": profile.district,
                "state": profile.state,
                "investment_amount": profile.investment_amount,
                "employee_count": profile.employee_count,
                "project_stage": profile.project_stage
            },
            recommendations_count=len(recommendations),
            ai_provider=provider_used,
            status="SUCCESS"
        )
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to record audit log for recommendation request: {e}")
        db.rollback()

    return recommendations
