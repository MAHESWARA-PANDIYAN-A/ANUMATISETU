from datetime import datetime, timezone
import enum
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
    JSON,
    Float,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    PARTIALLY_APPROVED = "PARTIALLY_APPROVED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    NEEDS_INFORMATION = "NEEDS_INFORMATION"


class ApprovalWorkflowStatus(str, enum.Enum):
    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    DOCUMENT_QUERY = "DOCUMENT_QUERY"
    INSPECTION_PENDING = "INSPECTION_PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class SLAStatus(str, enum.Enum):
    ON_TRACK = "ON_TRACK"
    APPROACHING = "APPROACHING"
    AT_RISK = "AT_RISK"
    OVERDUE = "OVERDUE"
    COMPLETED = "COMPLETED"


class InspectionStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    RESCHEDULED = "RESCHEDULED"


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    contact_email = Column(String(255), nullable=True)
    sla_days = Column(Integer, default=15, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    approvals = relationship("ApplicationApproval", back_populates="department")
    inspections = relationship("Inspection", back_populates="department")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    application_number = Column(String(100), unique=True, nullable=False, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.DRAFT, nullable=False, index=True)
    project_title = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    declaration_accepted = Column(Boolean, default=True, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    expected_completion_date = Column(DateTime, nullable=True)
    decision_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # FSSAI Headless Integration Fields
    fssai_application_number = Column(String(50), nullable=True, index=True)
    fssai_status = Column(String(50), default="NOT_STARTED", nullable=True)
    fssai_last_synced_at = Column(DateTime, nullable=True)
    fssai_officer_remarks = Column(Text, nullable=True)
    fssai_external_data = Column(JSON, nullable=True)

    # Udyam MSME Headless Integration Fields
    udyam_application_number = Column(String(50), nullable=True, index=True)
    udyam_registration_number = Column(String(50), nullable=True, index=True)
    udyam_status = Column(String(50), default="NOT_STARTED", nullable=True)
    msme_classification = Column(String(50), nullable=True)
    msme_classification_reason = Column(Text, nullable=True)
    udyam_last_synced_at = Column(DateTime, nullable=True)
    udyam_officer_remarks = Column(Text, nullable=True)
    udyam_certificate_url = Column(String(255), nullable=True)
    udyam_external_data = Column(JSON, nullable=True)

    # GST Registration Headless Integration Fields
    gst_application_number = Column(String(50), nullable=True, index=True)
    gst_registration_ref = Column(String(50), nullable=True, index=True)
    gst_status = Column(String(50), default="NOT_STARTED", nullable=True)
    gst_last_synced_at = Column(DateTime, nullable=True)
    gst_officer_remarks = Column(Text, nullable=True)
    gst_external_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    applicant = relationship("User", backref="applications")
    business_profile = relationship("BusinessProfile", backref="applications")
    approvals = relationship("ApplicationApproval", back_populates="application", cascade="all, delete-orphan")
    status_history = relationship("ApplicationStatusHistory", back_populates="application", cascade="all, delete-orphan", order_by="ApplicationStatusHistory.created_at.desc()")


class ApplicationApproval(Base):
    __tablename__ = "application_approvals"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    approval_id = Column(String(100), nullable=False, index=True)  # KB Approval ID e.g., 'ENV-MPCB-CTE-01'
    approval_name = Column(String(255), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(Enum(ApprovalWorkflowStatus), default=ApprovalWorkflowStatus.PENDING, nullable=False, index=True)
    assigned_officer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_officer_name = Column(String(255), nullable=True)
    remarks = Column(Text, nullable=True)
    query_details = Column(Text, nullable=True)
    query_response = Column(Text, nullable=True)
    
    # SLA & Timeline fields
    submitted_at = Column(DateTime, nullable=True)
    sla_due_date = Column(DateTime, nullable=True)  # Legacy alias
    expected_completion_date = Column(DateTime, nullable=True)
    inspection_required = Column(Boolean, default=False, nullable=False)
    inspection_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    application = relationship("Application", back_populates="approvals")
    department = relationship("Department", back_populates="approvals")
    inspections = relationship("Inspection", back_populates="application_approval", cascade="all, delete-orphan")
    status_history = relationship("ApplicationStatusHistory", back_populates="application_approval", cascade="all, delete-orphan")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    application_approval_id = Column(Integer, ForeignKey("application_approvals.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True)
    scheduled_date = Column(DateTime, nullable=False)
    scheduled_time = Column(String(50), nullable=True)
    location = Column(String(500), nullable=True)
    inspector_name = Column(String(255), nullable=False)
    inspector_contact = Column(String(100), nullable=True)
    status = Column(Enum(InspectionStatus), default=InspectionStatus.SCHEDULED, nullable=False)
    findings = Column(Text, nullable=True)
    report_notes = Column(Text, nullable=True)
    inspected_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    application_approval = relationship("ApplicationApproval", back_populates="inspections")
    department = relationship("Department", back_populates="inspections")


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    application_approval_id = Column(Integer, ForeignKey("application_approvals.id", ondelete="CASCADE"), nullable=True, index=True)
    old_status = Column(String(100), nullable=True)
    new_status = Column(String(100), nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_by_name = Column(String(255), nullable=False, default="System")
    changed_by_role = Column(String(50), nullable=False, default="SYSTEM")
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    application = relationship("Application", back_populates="status_history")
    application_approval = relationship("ApplicationApproval", back_populates="status_history")


class UserApprovalSelection(Base):
    """Stores the specific approvals selected by the user from the requirement recommendations."""
    __tablename__ = "user_approval_selections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    approval_id = Column(String(50), nullable=False, index=True)  # e.g., 'FSSAI', 'GST', 'UDYAM', 'TRADEMARK'
    approval_name = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    category = Column(String(50), nullable=True)
    reason = Column(Text, nullable=True)
    selected = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="SELECTED", nullable=False)  # SELECTED, PREPARING, SUBMITTED, APPROVED, REJECTED
    selected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )


class ApprovalJourney(Base):
    """Central parent journey for an applicant applying for multiple statutory approvals in one shot."""
    __tablename__ = "approval_journeys"

    id = Column(Integer, primary_key=True, index=True)
    journey_number = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    selected_approvals = Column(JSON, nullable=False, default=list)  # ["FSSAI", "GST", "UDYAM"]
    status = Column(String(50), default="IN_PROGRESS", nullable=False)  # DRAFT, IN_PROGRESS, SUBMITTED, COMPLETED
    canonical_responses = Column(JSON, nullable=False, default=dict)  # Deduplicated form data
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    applications = relationship("ApprovalApplication", back_populates="journey", cascade="all, delete-orphan")


class ApprovalApplication(Base):
    """Child application created and distributed to external portal for each selected approval."""
    __tablename__ = "approval_applications"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("approval_journeys.id", ondelete="CASCADE"), nullable=False, index=True)
    approval_id = Column(String(50), nullable=False, index=True)  # FSSAI, GST, UDYAM, TRADEMARK
    approval_name = Column(String(255), nullable=False)
    external_system = Column(String(50), nullable=False)  # MOCK_FSSAI, MOCK_GST, MOCK_UDYAM, MOCK_TRADEMARK
    external_application_id = Column(String(100), nullable=True, index=True)  # FSSAI-MOCK-2026-..., GST-MOCK-...
    status = Column(String(50), default="SUBMITTED", nullable=False)  # DRAFT_CREATED, SUBMITTED, UNDER_REVIEW, DOCUMENT_QUERY, APPROVED, REJECTED
    portal_url = Column(String(500), nullable=True)
    submission_payload = Column(JSON, nullable=True)
    response_payload = Column(JSON, nullable=True)
    officer_remarks = Column(Text, nullable=True)
    registration_ref = Column(String(100), nullable=True)  # GSTIN or License / Udyam reg number
    last_synced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    journey = relationship("ApprovalJourney", back_populates="applications")
