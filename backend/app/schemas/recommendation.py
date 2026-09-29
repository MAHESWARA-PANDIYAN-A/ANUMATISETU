from typing import Any, List, Optional, Union
from pydantic import BaseModel, Field, field_validator


class RecommendationRequest(BaseModel):
    business_profile_id: int = Field(..., description="ID of the target applicant business profile")
    use_ai: Optional[bool] = True


class ApprovalRecommendationItem(BaseModel):
    id: Optional[str] = None
    approval_name: str
    department: str
    applicability_reason: str
    required_documents: Optional[List[str]] = Field(default_factory=list)
    document_summary: Optional[str] = None
    source: Optional[str] = "Statutory Authority"
    confidence: Optional[float] = 0.95
    status: Optional[str] = "MANDATORY"  # MANDATORY, CONDITIONAL, ALREADY_OBTAINED
    category: Optional[str] = "General"
    last_verified_date: Optional[str] = "2026-08-20"

    @field_validator("required_documents", mode="before")
    @classmethod
    def transform_docs(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [d.strip() for d in v.split(",") if d.strip()]
        if isinstance(v, list):
            return [str(d) for d in v]
        return []

    @field_validator("document_summary", mode="before")
    @classmethod
    def transform_doc_summary(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, list):
            return ", ".join(str(item) for item in v if item)
        return str(v)


class RecommendationResponse(BaseModel):
    business_profile_id: int
    company_name: str
    industry: str
    total_recommendations: int
    ai_provider: str
    recommendations: List[ApprovalRecommendationItem]
