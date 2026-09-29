from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_optional_current_user
from app.models.user import User
from app.models.business_profile import BusinessProfile
from app.schemas.scheme import (
    SchemeRead,
    SchemeMatchRequest,
    SchemeMatchResponse,
    SchemeMatchResult,
)
from app.services.scheme_matcher import load_schemes_db, match_schemes_for_profile

router = APIRouter(prefix="/schemes", tags=["Government Scheme Discovery"])


@router.get("", response_model=List[SchemeRead])
def list_all_schemes():
    """Retrieve all verified government schemes from the curated knowledge base."""
    return load_schemes_db()


@router.get("/{scheme_id}", response_model=SchemeRead)
def get_scheme_by_id(scheme_id: str):
    """Retrieve details of a single government scheme by ID."""
    schemes = load_schemes_db()
    for s in schemes:
        if s["id"] == scheme_id:
            return s
    raise HTTPException(status_code=404, detail=f"Scheme '{scheme_id}' not found in knowledge base.")


@router.post("/match", response_model=SchemeMatchResponse)
def discover_and_match_schemes(
    req: SchemeMatchRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Match applicant business profile against configured deterministic eligibility rules
    and generate grounded explanations.
    """
    target_profile = None

    if req.profile_id:
        target_profile = db.query(BusinessProfile).filter(BusinessProfile.id == req.profile_id).first()
        if not target_profile:
            raise HTTPException(status_code=404, detail="Specified business profile not found.")
    elif current_user:
        target_profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()

    # If no stored profile or explicit fields provided, create an in-memory profile
    if not target_profile:
        target_profile = BusinessProfile(
            company_name="Applicant Enterprise",
            industry=req.industry or "General Manufacturing",
            state=req.state or "Maharashtra",
            business_type=req.business_type or "Private Limited",
            investment_amount=req.investment_amount or 5000000.0,
            project_stage=req.project_stage or "Setting Up"
        )
    else:
        # Override with any custom request overrides if provided
        if req.industry:
            target_profile.industry = req.industry
        if req.investment_amount is not None:
            target_profile.investment_amount = req.investment_amount
        if req.project_stage:
            target_profile.project_stage = req.project_stage
        if req.business_type:
            target_profile.business_type = req.business_type

    use_ai = req.use_ai if req.use_ai is not None else True
    matched_results = match_schemes_for_profile(target_profile, use_ai_explanations=use_ai)

    summary = {
        "company_name": target_profile.company_name or "Applicant Enterprise",
        "industry": target_profile.industry,
        "state": target_profile.state,
        "business_type": target_profile.business_type,
        "investment_amount": float(target_profile.investment_amount or 0.0),
        "project_stage": target_profile.project_stage
    }

    return SchemeMatchResponse(
        total_matched=len(matched_results),
        business_profile_summary=summary,
        matched_schemes=matched_results
    )
