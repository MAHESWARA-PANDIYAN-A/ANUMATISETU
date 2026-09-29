from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.application import (
    ApplicationStatus,
    ApprovalWorkflowStatus,
    InspectionStatus,
    SLAStatus,
)


# ---------------- Department Schemas ---------------- #
class DepartmentBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    contact_email: Optional[str] = None
    sla_days: int = Field(default=15, ge=1, le=180)
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentRead(DepartmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------- Inspection Schemas ---------------- #
class InspectionCreateInput(BaseModel):
    scheduled_date: datetime
    scheduled_time: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=500)
    inspector_name: str = Field(..., min_length=2, max_length=255)
    inspector_contact: Optional[str] = Field(None, max_length=100)
    report_notes: Optional[str] = None


class InspectionCompleteInput(BaseModel):
    findings: str = Field(..., min_length=5)
    report_notes: Optional[str] = None


class InspectionRead(BaseModel):
    id: int
    application_approval_id: int
    approval_name: Optional[str] = None
    application_number: Optional[str] = None
    company_name: Optional[str] = None
    department_id: int
    department_name: Optional[str] = None
    scheduled_date: datetime
    scheduled_time: Optional[str] = None
    location: Optional[str] = None
    inspector_name: str
    inspector_contact: Optional[str] = None
    status: InspectionStatus
    findings: Optional[str] = None
    report_notes: Optional[str] = None
    inspected_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------- Application Approval Schemas ---------------- #
class ApprovalItemInput(BaseModel):
    approval_id: str = Field(..., min_length=2, max_length=100)
    approval_name: str = Field(..., min_length=2, max_length=255)
    department_code: Optional[str] = None
    department_id: Optional[int] = None
    custom_sla_days: Optional[int] = None  # Optional for demo / scenario simulation


class ApprovalStatusUpdateInput(BaseModel):
    status: ApprovalWorkflowStatus
    remarks: Optional[str] = None
    query_details: Optional[str] = None


class QueryResponseInput(BaseModel):
    query_response: str = Field(..., min_length=3)


class ApplicationApprovalRead(BaseModel):
    id: int
    application_id: int
    approval_id: str
    approval_name: str
    department_id: int
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    status: ApprovalWorkflowStatus
    current_status: Optional[ApprovalWorkflowStatus] = None
    assigned_officer_id: Optional[int] = None
    assigned_officer_name: Optional[str] = None
    remarks: Optional[str] = None
    query_details: Optional[str] = None
    query_response: Optional[str] = None
    
    # Phase 6 SLA & Inspection Tracking fields
    submitted_at: Optional[datetime] = None
    expected_completion_date: Optional[datetime] = None
    sla_due_date: Optional[datetime] = None
    inspection_required: bool = False
    inspection_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    days_elapsed: int = 0
    days_remaining: int = 0
    sla_status: SLAStatus = SLAStatus.ON_TRACK

    created_at: datetime
    updated_at: datetime
    inspections: List[InspectionRead] = []

    class Config:
        from_attributes = True


# ---------------- Application Schemas ---------------- #
class ApplicationCreate(BaseModel):
    business_profile_id: Optional[int] = None
    project_title: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None
    declaration_accepted: bool = True
    approvals: List[ApprovalItemInput] = Field(..., min_length=1)
    submit_immediately: bool = True
    simulated_days_remaining: Optional[int] = None  # Allows acceptance testing of AT_RISK/OVERDUE SLAs


class BusinessProfileSummary(BaseModel):
    id: int
    company_name: str
    business_type: str
    industry: str
    state: str
    district: str
    investment_amount: float


class ApplicationRead(BaseModel):
    id: int
    application_number: str
    applicant_id: int
    applicant_name: Optional[str] = None
    applicant_email: Optional[str] = None
    business_profile_id: int
    business_profile: Optional[BusinessProfileSummary] = None
    status: ApplicationStatus
    project_title: Optional[str] = None
    notes: Optional[str] = None
    declaration_accepted: bool
    submitted_at: Optional[datetime] = None
    expected_completion_date: Optional[datetime] = None
    decision_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    days_elapsed: int = 0
    days_remaining: int = 0
    sla_status: SLAStatus = SLAStatus.ON_TRACK

    # Integration tracking
    fssai_application_number: Optional[str] = None
    fssai_status: Optional[str] = None
    udyam_application_number: Optional[str] = None
    udyam_registration_number: Optional[str] = None
    udyam_status: Optional[str] = None
    msme_classification: Optional[str] = None
    msme_classification_reason: Optional[str] = None
    udyam_certificate_url: Optional[str] = None
    gst_application_number: Optional[str] = None
    gst_registration_ref: Optional[str] = None
    gst_status: Optional[str] = None
    gst_officer_remarks: Optional[str] = None
    gst_last_synced_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime
    approvals: List[ApplicationApprovalRead] = []

    class Config:
        from_attributes = True


class ApplicationSummaryRead(BaseModel):
    id: int
    application_number: str
    applicant_id: int
    company_name: Optional[str] = None
    industry: Optional[str] = None
    district: Optional[str] = None
    status: ApplicationStatus
    sla_status: SLAStatus = SLAStatus.ON_TRACK
    expected_completion_date: Optional[datetime] = None
    days_remaining: int = 0
    total_approvals: int = 0
    approved_count: int = 0
    pending_count: int = 0
    query_count: int = 0
    inspection_pending_count: int = 0

    # Integration tracking
    fssai_application_number: Optional[str] = None
    fssai_status: Optional[str] = None
    udyam_application_number: Optional[str] = None
    udyam_registration_number: Optional[str] = None
    udyam_status: Optional[str] = None
    msme_classification: Optional[str] = None
    udyam_certificate_url: Optional[str] = None
    gst_application_number: Optional[str] = None
    gst_registration_ref: Optional[str] = None
    gst_status: Optional[str] = None

    submitted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True



# ---------------- Dashboard Metrics Schemas ---------------- #
class OfficerMetricsResponse(BaseModel):
    total_applications: int = 0
    pending_count: int = 0
    approaching_sla_count: int = 0
    at_risk_sla_count: int = 0
    overdue_count: int = 0
    inspection_pending_count: int = 0
    active_inspections: List[InspectionRead] = []


class ApplicantMetricsResponse(BaseModel):
    total_applications: int = 0
    overall_sla_status: SLAStatus = SLAStatus.ON_TRACK
    expected_completion: Optional[datetime] = None
    days_remaining: int = 0
    approved_approvals: int = 0
    total_approvals: int = 0
    upcoming_inspections: List[InspectionRead] = []


# ---------------- Timeline & History Schemas ---------------- #
class TimelineEventRead(BaseModel):
    id: int
    application_id: int
    application_approval_id: Optional[int] = None
    approval_name: Optional[str] = None
    old_status: Optional[str] = None
    new_status: str
    changed_by_user_id: Optional[int] = None
    changed_by_name: str
    changed_by_role: str
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
