from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
    JSON,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class ApprovalCatalog(Base):
    """Statutory & Regulatory approvals catalog containing authority and verified sources."""
    __tablename__ = "approval_catalog"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # FSSAI, GST, UDYAM, TRADEMARK, FIRE_NOC, MPCB_CTE
    name = Column(String(255), nullable=False)
    department = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)  # Food Safety, Tax, MSME, IPR, Safety, Environment
    description = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    source = Column(String(255), nullable=False, default="National Single Window Clearance System / Verified Act")
    last_verified_date = Column(String(50), nullable=False, default="2026-09-01")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ApprovalRule(Base):
    """Configurable conditions that trigger approval recommendations with verifiable citations."""
    __tablename__ = "approval_rules"

    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(String(50), nullable=False, index=True)  # FSSAI, GST, etc.
    industry = Column(String(100), nullable=True)  # Food Processing, Manufacturing, IT, etc.
    business_type = Column(String(100), nullable=True)  # Private Limited, Partnership, Proprietorship
    business_activity = Column(String(255), nullable=True)
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    investment_min = Column(Float, nullable=True, default=0.0)
    investment_max = Column(Float, nullable=True)
    employee_min = Column(Integer, nullable=True, default=0)
    employee_max = Column(Integer, nullable=True)
    project_stage = Column(String(100), nullable=True)
    condition_json = Column(JSON, nullable=True, default=dict)  # Custom attribute criteria
    priority_base = Column(String(50), default="MEDIUM", nullable=False)  # CRITICAL, HIGH, MEDIUM, LOW
    dependency_json = Column(JSON, nullable=True, default=list)  # Direct dependencies
    reason_template = Column(Text, nullable=False)  # "Your business profile indicates {industry} activity..."
    online_coverage = Column(String(50), default="HYBRID", nullable=False)  # ONLINE, HYBRID, EXTERNAL, GUIDANCE_ONLY
    external_requirement = Column(Text, nullable=True)
    source = Column(String(255), nullable=False, default="Statutory Clearance Rules 2026")
    last_verified_date = Column(String(50), nullable=False, default="2026-09-01")
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ApprovalDependency(Base):
    """Configured dependency graph relationships between industrial clearances."""
    __tablename__ = "approval_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(String(50), nullable=False, index=True)
    depends_on_approval_id = Column(String(50), nullable=False, index=True)
    dependency_type = Column(String(50), default="CAN_RUN_IN_PARALLEL", nullable=False)
    # REQUIRED_BEFORE, RECOMMENDED_BEFORE, CAN_RUN_IN_PARALLEL, NO_DEPENDENCY
    description = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ApprovalCoverage(Base):
    """Configured online vs hybrid vs external capabilities and regional authority mapping."""
    __tablename__ = "approval_coverage"

    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(String(50), nullable=False, index=True)
    coverage_type = Column(String(50), default="HYBRID", nullable=False)  # ONLINE, HYBRID, EXTERNAL, GUIDANCE_ONLY
    tasker_capabilities_json = Column(JSON, nullable=False, default=list)  # e.g. ["APPLICATION_PREPARATION", "DOCUMENT_MANAGEMENT", "STATUS_TRACKING"]
    external_steps_json = Column(JSON, nullable=False, default=list)  # e.g. ["Physical site inspection by Food Safety Officer", "Sample lab testing"]
    region = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    authority = Column(String(255), nullable=False)
    authority_location = Column(String(255), nullable=True)  # e.g. "Salem Collectorate Complex, Tamil Nadu"
    latitude = Column(Float, nullable=True)  # Optional if known verified coordinates
    longitude = Column(Float, nullable=True)
    source = Column(String(255), nullable=False, default="State Industrial Single Window Integration Grid")
    last_verified_date = Column(String(50), nullable=False, default="2026-09-01")
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ExternalWorkflowStep(Base):
    """Tracks external steps (e.g. site inspection, offline lab report) with optional proof upload."""
    __tablename__ = "external_workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True)
    approval_application_id = Column(Integer, ForeignKey("approval_applications.id", ondelete="CASCADE"), nullable=True, index=True)
    approval_id = Column(String(50), nullable=False, index=True)
    step_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    step_type = Column(String(50), default="EXTERNAL", nullable=False)  # ONLINE, EXTERNAL, INSPECTION, DOCUMENT, REVIEW, PAYMENT, OTHER
    status = Column(String(50), default="NOT_STARTED", nullable=False)  # NOT_STARTED, IN_PROGRESS, WAITING, COMPLETED, BLOCKED
    required = Column(Boolean, default=True, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    proof_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    source = Column(String(255), nullable=False, default="TASKER External Compliance Tracker")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ApprovalRecord(Base):
    """Post-approval active license / clearance records with validity and renewal tracking."""
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    approval_id = Column(String(50), nullable=False, index=True)  # FSSAI, GST, UDYAM, etc.
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="SET NULL"), nullable=True)
    approval_application_id = Column(Integer, ForeignKey("approval_applications.id", ondelete="SET NULL"), nullable=True)
    registration_number = Column(String(100), nullable=False, index=True)  # e.g. "12426002000088", "33AABCS1429B1ZB"
    status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, EXPIRING_SOON, RENEWAL_DUE, EXPIRED, SUSPENDED, CANCELLED
    issue_date = Column(DateTime, nullable=False)
    effective_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)  # None for lifetime registrations like GST / Udyam
    renewal_required = Column(Boolean, default=True, nullable=False)
    renewal_window_days = Column(Integer, default=90, nullable=False)  # e.g., 90 days prior for FSSAI
    last_verified_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    certificate_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ComplianceTask(Base):
    """Follow-up compliance tasks, recurring statutory returns, and license renewal actions."""
    __tablename__ = "compliance_tasks"

    id = Column(Integer, primary_key=True, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    approval_record_id = Column(Integer, ForeignKey("approval_records.id", ondelete="CASCADE"), nullable=True, index=True)
    task_type = Column(String(100), nullable=False)  # RENEWAL, CERTIFICATE_UPDATE, PERIODIC_RETURN, INSPECTION_FOLLOWUP, WATER_TEST
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, IN_PROGRESS, COMPLETED, OVERDUE
    priority = Column(String(50), default="MEDIUM", nullable=False)  # URGENT, HIGH, MEDIUM, LOW
    source = Column(String(255), nullable=False, default="TASKER Post-Approval Compliance Engine")
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class WorkflowSLARule(Base):
    """Configurable expected SLA durations and delay thresholds for each workflow stage."""
    __tablename__ = "workflow_sla_rules"

    id = Column(Integer, primary_key=True, index=True)
    approval_id = Column(String(50), nullable=False, index=True)  # FSSAI, GST, UDYAM, TRADEMARK, ALL
    status = Column(String(100), nullable=False)  # SUBMITTED, UNDER_REVIEW, DOCUMENT_QUERY, INSPECTION_SCHEDULED
    expected_duration_days = Column(Float, default=3.0, nullable=False)
    warning_after_days = Column(Float, default=5.0, nullable=False)
    critical_after_days = Column(Float, default=7.0, nullable=False)
    source = Column(String(255), nullable=False, default="Citizen Charter / Ease of Doing Business SLA 2026")
    last_verified_date = Column(String(50), nullable=False, default="2026-09-01")
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class DelayAnalysisRecord(Base):
    """Data-driven delay diagnostic records generated from real event timestamps & open blockers."""
    __tablename__ = "delay_analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, nullable=True, index=True)
    approval_application_id = Column(Integer, ForeignKey("approval_applications.id", ondelete="CASCADE"), nullable=True, index=True)
    analysis_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    delay_status = Column(String(50), default="ON_TRACK", nullable=False)  # ON_TRACK, APPROACHING, AT_RISK, OVERDUE
    reason_category = Column(String(100), nullable=False)
    # MISSING_INFORMATION, DOCUMENT_ISSUE, QUERY_PENDING, APPLICANT_RESPONSE_PENDING, OFFICER_REVIEW_PENDING,
    # INSPECTION_PENDING, EXTERNAL_PROCESS_PENDING, DEPENDENCY_PENDING, INTEGRATION_FAILURE, DATA_MISMATCH, NO_RECENT_UPDATE, OTHER
    reason_text = Column(Text, nullable=False)
    blocking_step = Column(String(100), nullable=False)  # e.g. "APPLICANT_RESPONSE", "OFFICER_SCRUTINY", "SITE_INSPECTION"
    evidence_json = Column(JSON, nullable=False, default=list)  # List of factual events and dates
    recommended_action = Column(JSON, nullable=True, default=dict)  # {"label": "Respond to Query", "route": "..."}
    confidence = Column(Float, default=1.0, nullable=False)  # Structured evidence confidence
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ApplicationEvent(Base):
    """Complete audit trail of application events powering timelines and delay diagnostics."""
    __tablename__ = "application_events"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, nullable=True, index=True)
    approval_application_id = Column(Integer, nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    # CREATED, SUBMITTED, ASSIGNED, REVIEW_STARTED, DOCUMENT_UPLOADED, QUERY_RAISED, QUERY_ANSWERED,
    # INSPECTION_SCHEDULED, INSPECTION_COMPLETED, EXTERNAL_STEP_STARTED, EXTERNAL_STEP_COMPLETED, APPROVED, REJECTED
    source = Column(String(50), default="SYSTEM", nullable=False)  # USER, OFFICER, ADMIN, SYSTEM, EXTERNAL_PORTAL, INTEGRATION
    actor_id = Column(Integer, nullable=True)
    actor_name = Column(String(255), nullable=True)
    metadata_json = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
