from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_applicant
from app.models.user import User
from app.models.business_profile import BusinessProfile
from app.schemas.business_profile import (
    BusinessProfileCreate,
    BusinessProfileResponse,
    BusinessProfileUpdate,
)

router = APIRouter()


@router.post(
    "/business-profiles",
    response_model=BusinessProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create applicant business profile",
)
def create_business_profile(
    profile_in: BusinessProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """
    Creates a business profile for the authenticated applicant.
    An applicant may only have one profile; attempting to create a second
    returns HTTP 409 Conflict.
    """
    existing = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A business profile already exists for your account. Use PUT /api/v1/business-profiles/me to update it.",
        )

    data = profile_in.model_dump()
    if not data.get("company_name") and data.get("business_name"):
        data["company_name"] = data["business_name"]
    if not data.get("investment_amount") and data.get("investment"):
        data["investment_amount"] = data["investment"]

    # Remove extra schema aliases if not in model
    data.pop("business_name", None)
    data.pop("investment", None)

    profile = BusinessProfile(
        user_id=current_user.id,
        **data,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get(
    "/business-profiles/me",
    response_model=Optional[BusinessProfileResponse],
    summary="Retrieve own business profile",
)
def get_my_business_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """
    Fetches the authenticated applicant's business profile.
    Returns null / 200 if no profile has been created yet.
    """
    profile = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.user_id == current_user.id)
        .first()
    )
    return profile



@router.put(
    "/business-profiles/me",
    response_model=BusinessProfileResponse,
    summary="Update own business profile",
)
def update_my_business_profile(
    profile_in: BusinessProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """
    Updates the authenticated applicant's existing business profile.
    Only fields explicitly provided in the request body are updated (partial update).
    Returns HTTP 404 if no profile exists yet.
    """
    profile = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business profile found. Please create one first via POST /api/v1/business-profiles.",
        )

    update_data = profile_in.model_dump(exclude_unset=True)
    if not update_data.get("company_name") and update_data.get("business_name"):
        update_data["company_name"] = update_data["business_name"]
    if not update_data.get("investment_amount") and update_data.get("investment"):
        update_data["investment_amount"] = update_data["investment"]

    update_data.pop("business_name", None)
    update_data.pop("investment", None)

    for field, value in update_data.items():
        if hasattr(profile, field):
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile

