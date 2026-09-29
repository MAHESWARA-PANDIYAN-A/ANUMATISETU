from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InvestmentConditionsSchema(BaseModel):
    min_investment: Optional[float] = None
    max_investment: Optional[float] = None
    currency: Optional[str] = "INR"
    notes: Optional[str] = None


class SchemeBase(BaseModel):
    id: str
    scheme_name: str
    department: str
    state: str
    applicable_industries: List[str]
    business_types: List[str]
    eligibility_conditions: List[str]
    investment_conditions: Dict[str, Any]
    benefits: List[str]
    required_documents: List[str]
    source: str
    last_verified_date: str


class SchemeRead(SchemeBase):
    pass


class SchemeMatchResult(BaseModel):
    id: str
    scheme_name: str
    department: str
    state: str
    relevance_status: str = Field(default="Potentially relevant", description="Strictly 'Potentially relevant' unless prototype rule establishes explicit eligibility")
    match_score: float
    why_relevant: str
    benefits: List[str]
    eligibility_conditions: List[str]
    investment_conditions: Dict[str, Any]
    required_documents: List[str]
    source: str
    last_verified_date: str


class SchemeMatchRequest(BaseModel):
    profile_id: Optional[str] = None
    industry: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    business_type: Optional[str] = None
    investment_amount: Optional[float] = None
    project_stage: Optional[str] = None
    use_ai: Optional[bool] = True


class SchemeMatchResponse(BaseModel):
    total_matched: int
    business_profile_summary: Dict[str, Any]
    matched_schemes: List[SchemeMatchResult]
    disclaimer: str = "Government schemes are matched based on configured rules. Results indicate potential relevance and do not constitute a legal guarantee of scheme sanction or disbursement."
