from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class BusinessProfileCreate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255, description="Registered company / enterprise name")
    business_name: Optional[str] = Field(None, max_length=255, description="Alias for company_name")
    business_type: str = Field(..., min_length=2, max_length=100, description="E.g. Proprietorship, Partnership, Pvt Ltd")
    organization_type: Optional[str] = Field(None, max_length=100)
    industry: str = Field(..., min_length=2, max_length=100, description="E.g. Manufacturing, IT, Agro-processing")
    business_activity: Optional[str] = Field(None, max_length=255)
    state: str = Field(default="Maharashtra", max_length=100)
    district: str = Field(..., min_length=2, max_length=100)
    pincode: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None)
    investment_amount: Optional[float] = Field(None, description="Project investment in INR")
    investment: Optional[float] = Field(None, description="Alias for investment_amount")
    expected_turnover: Optional[float] = Field(None)
    employee_count: int = Field(..., ge=1, description="Total proposed employee headcount")
    project_stage: str = Field(..., min_length=2, max_length=100, description="E.g. Concept, DPR Ready, Under Construction")
    land_status: str = Field(..., min_length=2, max_length=100, description="E.g. Owned, Leased, Government Allotted")
    premises_type: Optional[str] = Field(None, max_length=100)
    expected_start_date: Optional[str] = Field(None, max_length=50)
    existing_approvals: List[str] = Field(default_factory=list, description="List of approvals already obtained")
    existing_registrations: Optional[dict] = Field(default_factory=dict)

    @field_validator("company_name", "business_name", "business_type", "industry", "state", "district", "project_stage", "land_status", mode="before")
    @classmethod
    def strip_strings(cls, v):
        if isinstance(v, str):
            stripped = v.strip()
            return stripped if stripped else None
        return v

    @field_validator("existing_approvals", mode="before")
    @classmethod
    def clean_approvals(cls, v):
        if isinstance(v, list):
            return [item.strip() for item in v if isinstance(item, str) and item.strip()]
        return []


class BusinessProfileUpdate(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255)
    business_name: Optional[str] = Field(None, max_length=255)
    business_type: Optional[str] = Field(None, max_length=100)
    organization_type: Optional[str] = Field(None, max_length=100)
    industry: Optional[str] = Field(None, max_length=100)
    business_activity: Optional[str] = Field(None, max_length=255)
    state: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None)
    investment_amount: Optional[float] = None
    investment: Optional[float] = None
    expected_turnover: Optional[float] = None
    employee_count: Optional[int] = Field(None, ge=1)
    project_stage: Optional[str] = Field(None, max_length=100)
    land_status: Optional[str] = Field(None, max_length=100)
    premises_type: Optional[str] = Field(None, max_length=100)
    expected_start_date: Optional[str] = Field(None, max_length=50)
    existing_approvals: Optional[List[str]] = None
    existing_registrations: Optional[dict] = None


class BusinessProfileResponse(BaseModel):
    id: int
    user_id: int
    company_name: Optional[str] = None
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    organization_type: Optional[str] = None
    industry: Optional[str] = None
    business_activity: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    address: Optional[str] = None
    investment_amount: Optional[float] = None
    investment: Optional[float] = None
    expected_turnover: Optional[float] = None
    employee_count: Optional[int] = None
    project_stage: Optional[str] = None
    land_status: Optional[str] = None
    premises_type: Optional[str] = None
    expected_start_date: Optional[str] = None
    existing_approvals: List[str] = []
    existing_registrations: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

