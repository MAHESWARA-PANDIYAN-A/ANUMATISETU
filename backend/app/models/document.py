from datetime import datetime, timezone
import enum
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class DocumentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"
    REPLACED = "REPLACED"
    DELETED = "DELETED"


class ValidationStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    VALID = "VALID"
    WARNING = "WARNING"
    INVALID = "INVALID"
    FAILED = "FAILED"


class DocumentCategory(str, enum.Enum):
    IDENTITY = "IDENTITY"
    ADDRESS = "ADDRESS"
    BUSINESS = "BUSINESS"
    TAX = "TAX"
    BANK = "BANK"
    PHOTO = "PHOTO"
    PRODUCT = "PRODUCT"
    LICENCE = "LICENCE"
    CERTIFICATE = "CERTIFICATE"
    BRAND = "BRAND"
    SUPPORTING = "SUPPORTING"


class DocumentUsageStatus(str, enum.Enum):
    NOT_USED = "NOT_USED"
    SELECTED = "SELECTED"
    SYNCING = "SYNCING"
    SYNCED = "SYNCED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    NEEDS_CORRECTION = "NEEDS_CORRECTION"


class DocumentType(Base):
    __tablename__ = "document_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)  # E.g. PAN_CARD, AADHAAR_CARD
    name = Column(String(255), nullable=False)  # E.g. "Permanent Account Number (PAN)"
    category = Column(String(50), nullable=False, default="IDENTITY")  # Category enum name
    description = Column(Text, nullable=True)
    allowed_mime_types = Column(JSON, nullable=False, default=lambda: ["application/pdf", "image/png", "image/jpeg", "image/jpg"])
    max_file_size = Column(Integer, nullable=False, default=5 * 1024 * 1024)  # 5 MB
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    documents = relationship("Document", back_populates="doc_type_rel")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id", ondelete="SET NULL"), nullable=True, index=True)
    
    approval_id = Column(String(100), nullable=True, index=True)  # Primary associated approval, if any
    document_type = Column(String(100), nullable=False)  # Canonical code or readable label
    document_name = Column(String(255), nullable=True)  # User custom/display name
    
    # Storage & File References
    file_name = Column(String(255), nullable=False)  # Original client file name
    stored_filename = Column(String(255), nullable=True)  # Storage name / identifier
    file_path = Column(String(500), nullable=True)  # Local path if migrated/cached, or fallback
    mime_type = Column(String(100), nullable=True, default="application/pdf")
    file_size = Column(Integer, nullable=True, default=0)
    file_hash = Column(String(64), nullable=True, index=True)  # SHA-256 for duplicate detection
    
    # Cloudinary Specific Storage Identifiers
    storage_provider = Column(String(50), default="CLOUDINARY", nullable=False)  # CLOUDINARY, LOCAL
    cloudinary_asset_id = Column(String(255), nullable=True)
    cloudinary_public_id = Column(String(500), nullable=True, index=True)
    cloudinary_resource_type = Column(String(50), nullable=True, default="image")  # image / raw
    cloudinary_asset_type = Column(String(50), nullable=True, default="authenticated")  # authenticated / private / upload
    cloudinary_version = Column(String(50), nullable=True)
    cloudinary_folder = Column(String(255), nullable=True)
    storage_status = Column(String(50), nullable=True, default="ACTIVE")  # ACTIVE, MIGRATED, PENDING, ERROR
    
    # Metadata & Masking
    document_number_masked = Column(String(100), nullable=True)
    issue_date = Column(String(50), nullable=True)
    expiry_date = Column(String(50), nullable=True)
    
    # Lifecycle & Validation Status
    status = Column(Enum(DocumentStatus), default=DocumentStatus.ACTIVE, nullable=False, index=True)
    validation_status = Column(Enum(ValidationStatus), default=ValidationStatus.PENDING, nullable=False, index=True)
    current_version = Column(Integer, default=1, nullable=False)
    source = Column(String(50), default="MANUAL_UPLOAD", nullable=False)  # MANUAL_UPLOAD, SIH_IMPORT, DOCUMENT_EXTRACTION
    trust_level = Column(String(50), default="TASKER_PREVALIDATED", nullable=False)  # USER_UPLOADED, TASKER_PREVALIDATED, OFFICER_ACCEPTED
    
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def original_filename(self) -> str:
        return self.file_name

    # Relationships
    applicant = relationship("User", foreign_keys=[applicant_id], backref="documents")
    doc_type_rel = relationship("DocumentType", back_populates="documents")
    validation = relationship("DocumentValidation", back_populates="document", uselist=False, cascade="all, delete-orphan")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan", order_by="desc(DocumentVersion.version_number)")
    usages = relationship("DocumentUsage", back_populates="document", cascade="all, delete-orphan")
    external_mappings = relationship("DocumentExternalMapping", back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=True)
    storage_path = Column(String(500), nullable=True)
    
    # Cloudinary Version Identifiers
    cloudinary_asset_id = Column(String(255), nullable=True)
    cloudinary_public_id = Column(String(500), nullable=True)
    cloudinary_resource_type = Column(String(50), nullable=True, default="image")
    cloudinary_asset_type = Column(String(50), nullable=True, default="authenticated")
    cloudinary_version = Column(String(50), nullable=True)

    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    file_hash = Column(String(64), nullable=True)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    validation_status = Column(Enum(ValidationStatus), default=ValidationStatus.PENDING, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationship
    document = relationship("Document", back_populates="versions")


class DocumentValidation(Base):
    __tablename__ = "document_validations"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    version_id = Column(Integer, ForeignKey("document_versions.id", ondelete="SET NULL"), nullable=True)
    validation_type = Column(String(50), default="FILE_CHECK", nullable=False)
    extracted_data = Column(JSON, nullable=False, default=dict)  # company_name, address, dates, reg_numbers, etc.
    discrepancies = Column(JSON, nullable=False, default=list)  # list of warnings/mismatches with profile
    missing_fields = Column(JSON, nullable=False, default=list)  # list of expected fields not found
    status = Column(Enum(ValidationStatus), default=ValidationStatus.PENDING, nullable=False)
    result = Column(String(20), default="PASS", nullable=False)  # PASS, WARNING, FAIL
    summary = Column(Text, nullable=True)
    message = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)
    validated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    document = relationship("Document", back_populates="validation")


class DocumentUsage(Base):
    __tablename__ = "document_usages"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    approval_id = Column(String(100), nullable=False, index=True)  # FSSAI, GST, UDYAM, TRADEMARK
    application_id = Column(String(100), nullable=True, index=True)  # E.g. "GST-2026-000123"
    required_document_type = Column(String(100), nullable=False)  # Canonical requirement code
    usage_status = Column(Enum(DocumentUsageStatus), default=DocumentUsageStatus.SELECTED, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    document = relationship("Document", back_populates="usages")


class ApplicationDocumentRequirement(Base):
    __tablename__ = "application_document_requirements"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(String(100), nullable=False, index=True)
    approval_id = Column(String(100), nullable=False, index=True)  # FSSAI, GST, UDYAM
    document_type_code = Column(String(100), nullable=False)  # PAN_CARD, PASSPORT_PHOTO, etc.
    required = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="MISSING", nullable=False)  # AVAILABLE, MISSING, SUBMITTED
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    document = relationship("Document")


class DocumentExternalMapping(Base):
    __tablename__ = "document_external_mappings"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    approval_id = Column(String(100), nullable=False, index=True)  # FSSAI, GST, UDYAM, TRADEMARK
    application_id = Column(String(100), nullable=True, index=True)
    external_document_id = Column(String(100), nullable=False)  # E.g. "FSSAI-DOC-789"
    external_status = Column(String(50), default="SYNCED", nullable=False)  # SYNCED, PENDING, FAILED
    synced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    document = relationship("Document", back_populates="external_mappings")


class DocumentAuditLog(Base):
    __tablename__ = "document_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)  # UPLOAD, VIEW, DOWNLOAD, VALIDATE, REPLACE, ARCHIVE, REUSE, LINK, SYNC, REVIEW, DELETE
    details = Column(JSON, nullable=True, default=dict)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class StorageReconciliationRecord(Base):
    __tablename__ = "storage_reconciliation_records"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, nullable=True, index=True)
    cloudinary_asset_id = Column(String(255), nullable=True)
    cloudinary_public_id = Column(String(500), nullable=True, index=True)
    business_profile_id = Column(Integer, nullable=True)
    issue_type = Column(String(100), nullable=False)  # ORPHAN_CLOUDINARY_ASSET, ORPHAN_DB_RECORD, UPLOAD_DB_FAILURE, MIGRATION_FAILURE
    status = Column(String(50), default="REQUIRES_RECONCILIATION", nullable=False)  # REQUIRES_RECONCILIATION, RESOLVED, IGNORED
    details = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime, nullable=True)
