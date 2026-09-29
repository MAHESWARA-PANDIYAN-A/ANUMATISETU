import hashlib
import io
import logging
import os
import shutil
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.business_profile import BusinessProfile
from app.models.document import (
    Document,
    DocumentType,
    DocumentVersion,
    DocumentValidation,
    DocumentUsage,
    ApplicationDocumentRequirement,
    DocumentExternalMapping,
    DocumentAuditLog,
    StorageReconciliationRecord,
    DocumentStatus,
    ValidationStatus,
    DocumentUsageStatus,
)
from app.models.user import User, UserRole
from app.services.cloudinary_service import CloudinaryStorageProvider, cloudinary_service
from app.services.document_extractor import (
    calculate_file_hash,
    prevalidate_document_workflow,
)
from app.services.document_vault_service import (
    ensure_document_types_seeded,
    get_canonical_type_code,
    log_document_audit,
)

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {f".{ext.strip().lstrip('.')}" for ext in settings.ALLOWED_DOCUMENT_TYPES.split(",")}
MAX_FILE_BYTES = settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024


def mask_identifier(val: Optional[str]) -> str:
    """Masks PAN / Aadhaar / Bank account numbers for non-sensitive logging."""
    if not val:
        return "N/A"
    s = str(val).strip()
    if len(s) <= 4:
        return "****"
    return s[:2] + "*" * (len(s) - 4) + s[-2:]


def sanitize_filename(filename: str) -> str:
    """Strips directory traversal sequences and unsafe characters."""
    clean = os.path.basename(filename or "document")
    clean = "".join(c for c in clean if c.isalnum() or c in "._- ")
    return clean.strip() or "document"


class DocumentService:
    """
    Central Domain Service managing the TASKER Document Vault.
    Decoupled from direct storage vendor calls via StorageProvider (Cloudinary).
    PostgreSQL stores metadata, relationships, versioning, and validation state.
    Cloudinary stores the actual encrypted/authenticated files.
    """

    def __init__(self, storage_provider: Optional[CloudinaryStorageProvider] = None):
        self.storage = storage_provider or cloudinary_service

    def upload_document(
        self,
        db: Session,
        user: User,
        file: UploadFile,
        document_type: str,
        document_name: Optional[str] = None,
        approval_id: Optional[str] = None,
        issue_date: Optional[str] = None,
        expiry_date: Optional[str] = None,
        force_upload: bool = False,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        1. Validates file format & size constraints.
        2. Computes SHA-256 hash for exact duplicate detection.
        3. Uploads file to Cloudinary with authenticated/private delivery.
        4. Persists metadata record + DocumentVersion (v1) in PostgreSQL.
        5. Runs automated OCR Pre-validation & profile enrichment.
        6. Logs technical audit event.
        """
        # 1. Validate file format
        ext = os.path.splitext((file.filename or "").lower())[1]
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS)).upper()}.",
            )

        clean_filename = sanitize_filename(file.filename or f"upload{ext}")
        
        # Read file contents into memory
        try:
            file_bytes = file.file.read()
        except Exception as e:
            logger.error(f"Failed to read uploaded file buffer: {e}")
            raise HTTPException(status_code=500, detail="Failed to read document buffer.")

        file_size = len(file_bytes)
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")
        if file_size > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File exceeds maximum allowed size of {settings.MAX_DOCUMENT_SIZE_MB} MB ({file_size / (1024*1024):.1f} MB uploaded).",
            )

        # 2. SHA-256 Duplicate Detection
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()
        canonical_code = get_canonical_type_code(document_type)
        doc_type_record = db.query(DocumentType).filter(DocumentType.code == canonical_code).first()

        biz_id = profile.id if profile else f"usr_{user.id}"

        if not force_upload:
            dup_query = db.query(Document).filter(
                (Document.applicant_id == user.id) | (Document.user_id == user.id),
                Document.file_hash == file_hash,
                Document.status == DocumentStatus.ACTIVE
            )
            if profile:
                dup_query = dup_query.filter(Document.business_profile_id == profile.id)

            existing_doc = dup_query.first()
            if existing_doc:
                return {
                    "duplicate_detected": True,
                    "message": f"An identical document already exists in your Document Center ('{existing_doc.document_name or existing_doc.file_name}').",
                    "existing_document": {
                        "id": existing_doc.id,
                        "document_name": existing_doc.document_name or existing_doc.document_type,
                        "document_type": existing_doc.document_type,
                        "file_name": existing_doc.file_name,
                        "validation_status": existing_doc.validation_status.value if existing_doc.validation_status else "VALID",
                        "uploaded_at": existing_doc.uploaded_at.isoformat() if existing_doc.uploaded_at else None,
                        "storage_provider": existing_doc.storage_provider or "CLOUDINARY",
                    }
                }

        # 3. Upload to Cloudinary Storage
        try:
            cloud_res = self.storage.upload_document(
                file_content=file_bytes,
                filename=clean_filename,
                document_type=canonical_code,
                business_id=biz_id,
                version=1,
                mime_type=file.content_type or "application/pdf",
                access_type=settings.CLOUDINARY_ASSET_TYPE,
            )
        except Exception as e:
            logger.error(f"StorageProvider upload failed for {clean_filename}: {e}")
            raise HTTPException(
                status_code=502,
                detail=f"Document could not be securely stored in cloud vault: {str(e)}",
            )

        # 4. Save Metadata in PostgreSQL with rollback handling
        try:
            doc = Document(
                applicant_id=user.id,
                user_id=user.id,
                business_profile_id=profile.id if profile else None,
                document_type_id=doc_type_record.id if doc_type_record else None,
                approval_id=approval_id.strip() if approval_id else None,
                document_type=document_type.strip(),
                document_name=document_name.strip() if document_name else document_type.strip(),
                file_name=clean_filename,
                stored_filename=os.path.basename(cloud_res.get("public_id", "")),
                file_path=None,  # No local file path needed for pure cloud storage
                mime_type=file.content_type or "application/pdf",
                file_size=file_size,
                file_hash=file_hash,
                storage_provider=cloud_res.get("storage_provider", "CLOUDINARY"),
                cloudinary_asset_id=cloud_res.get("asset_id"),
                cloudinary_public_id=cloud_res.get("public_id"),
                cloudinary_resource_type=cloud_res.get("resource_type", "image"),
                cloudinary_asset_type=cloud_res.get("asset_type", "authenticated"),
                cloudinary_version=str(cloud_res.get("version", "1")),
                cloudinary_folder=cloud_res.get("folder"),
                storage_status="ACTIVE",
                issue_date=issue_date.strip() if issue_date else None,
                expiry_date=expiry_date.strip() if expiry_date else None,
                status=DocumentStatus.ACTIVE,
                validation_status=ValidationStatus.PROCESSING,
                current_version=1,
                source="MANUAL_UPLOAD",
                trust_level="TASKER_PREVALIDATED",
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            # Create Version 1
            version = DocumentVersion(
                document_id=doc.id,
                version_number=1,
                original_filename=clean_filename,
                stored_filename=doc.stored_filename,
                storage_path=None,
                cloudinary_asset_id=doc.cloudinary_asset_id,
                cloudinary_public_id=doc.cloudinary_public_id,
                cloudinary_resource_type=doc.cloudinary_resource_type,
                cloudinary_asset_type=doc.cloudinary_asset_type,
                cloudinary_version=doc.cloudinary_version,
                mime_type=doc.mime_type,
                file_size=file_size,
                file_hash=file_hash,
                uploaded_by=user.id,
                validation_status=ValidationStatus.PROCESSING,
                notes="Initial upload to Cloudinary Document Vault.",
            )
            db.add(version)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Database metadata save failed after successful Cloudinary upload: {e}")
            # Attempt Cloudinary cleanup
            try:
                if cloud_res.get("public_id"):
                    self.storage.delete_document(
                        public_id=cloud_res["public_id"],
                        resource_type=cloud_res.get("resource_type", "image"),
                        access_type=cloud_res.get("asset_type", "authenticated"),
                    )
            except Exception as del_err:
                logger.critical(f"Cloudinary cleanup failed for orphaned asset: {del_err}")
                # Record in reconciliation table
                try:
                    recon = StorageReconciliationRecord(
                        cloudinary_asset_id=cloud_res.get("asset_id"),
                        cloudinary_public_id=cloud_res.get("public_id"),
                        business_profile_id=profile.id if profile else None,
                        issue_type="UPLOAD_DB_FAILURE",
                        status="REQUIRES_RECONCILIATION",
                        details={"error": str(e), "filename": clean_filename},
                    )
                    db.add(recon)
                    db.commit()
                except Exception:
                    pass

            raise HTTPException(status_code=500, detail="Failed to record document metadata in database.")

        # 5. Execute Pre-validation (OCR / Text Verification)
        try:
            val_result = prevalidate_document_workflow(
                file_bytes=file_bytes,
                filename=clean_filename,
                document_type=document_type.strip(),
                profile=profile,
            )

            val_status_enum = ValidationStatus[val_result.get("status", "VALID")]
            validation_record = DocumentValidation(
                document_id=doc.id,
                version_id=version.id,
                validation_type="OCR_CHECK",
                extracted_data=val_result.get("extracted_data", {}),
                discrepancies=val_result.get("discrepancies", []),
                missing_fields=val_result.get("missing_fields", []),
                status=val_status_enum,
                result=val_result.get("status", "PASS"),
                summary=val_result.get("summary"),
                recommended_action=val_result.get("recommended_action"),
            )
            db.add(validation_record)
            doc.validation_status = val_status_enum
            version.validation_status = val_status_enum

            # Extract masked document numbers
            ext_regs = (val_result.get("extracted_data") or {}).get("registration_numbers") or {}
            if "PAN" in ext_regs and ext_regs["PAN"]:
                doc.document_number_masked = mask_identifier(ext_regs["PAN"])
            elif "CIN" in ext_regs and ext_regs["CIN"]:
                doc.document_number_masked = mask_identifier(ext_regs["CIN"])
            elif "GSTIN" in ext_regs and ext_regs["GSTIN"]:
                doc.document_number_masked = mask_identifier(ext_regs["GSTIN"])

            # Auto-enrich Business Profile
            if profile and ext_regs:
                reg_dict = dict(profile.existing_registrations or {})
                for k, v in ext_regs.items():
                    if v:
                        reg_dict[k.lower()] = v
                profile.existing_registrations = reg_dict

            # If approval_id was specified, link initial DocumentUsage
            if approval_id and approval_id != "general-compliance":
                usage = DocumentUsage(
                    document_id=doc.id,
                    user_id=user.id,
                    business_profile_id=profile.id if profile else None,
                    approval_id=approval_id,
                    required_document_type=canonical_code,
                    usage_status=DocumentUsageStatus.SYNCED if val_status_enum in [ValidationStatus.VALID, ValidationStatus.READY] else DocumentUsageStatus.SELECTED,
                )
                db.add(usage)

            db.commit()
            db.refresh(doc)
        except Exception as ocr_err:
            logger.warning(f"Document pre-validation warning: {ocr_err}")
            doc.validation_status = ValidationStatus.READY
            db.commit()

        # 6. Audit Log
        log_document_audit(
            db=db,
            user_id=user.id,
            document_id=doc.id,
            action="UPLOAD",
            details={
                "filename": clean_filename,
                "document_type": canonical_code,
                "storage_provider": "CLOUDINARY",
                "cloudinary_public_id": doc.cloudinary_public_id,
                "file_size": file_size,
            },
            ip_address=ip_address,
        )

        return self._format_document_response(doc, db)

    def replace_document_version(
        self,
        db: Session,
        user: User,
        document_id: int,
        file: UploadFile,
        notes: str = "",
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Replaces current document with a new version (v2, v3...).
        Preserves the historical DocumentVersion record in database and Cloudinary.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        self._verify_user_access(user, doc)

        ext = os.path.splitext((file.filename or "").lower())[1]
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS)).upper()}.",
            )

        clean_filename = sanitize_filename(file.filename or "replacement_doc")
        file_bytes = file.file.read()
        file_size = len(file_bytes)
        if file_size > MAX_FILE_BYTES:
            raise HTTPException(status_code=400, detail=f"File exceeds maximum size of {settings.MAX_DOCUMENT_SIZE_MB} MB.")

        file_hash = hashlib.sha256(file_bytes).hexdigest()
        new_version_num = (doc.current_version or 1) + 1
        profile = db.query(BusinessProfile).filter(BusinessProfile.id == doc.business_profile_id).first()
        biz_id = profile.id if profile else f"usr_{user.id}"

        # Upload new version to Cloudinary
        cloud_res = self.storage.replace_document_version(
            old_public_id=doc.cloudinary_public_id or "",
            file_content=file_bytes,
            filename=clean_filename,
            document_type=doc.document_type,
            business_id=biz_id,
            new_version=new_version_num,
            mime_type=file.content_type or doc.mime_type,
            access_type=doc.cloudinary_asset_type or settings.CLOUDINARY_ASSET_TYPE,
        )

        # Create new version record
        new_version = DocumentVersion(
            document_id=doc.id,
            version_number=new_version_num,
            original_filename=clean_filename,
            stored_filename=os.path.basename(cloud_res.get("public_id", "")),
            storage_path=None,
            cloudinary_asset_id=cloud_res.get("asset_id"),
            cloudinary_public_id=cloud_res.get("public_id"),
            cloudinary_resource_type=cloud_res.get("resource_type", "image"),
            cloudinary_asset_type=cloud_res.get("asset_type", "authenticated"),
            cloudinary_version=str(cloud_res.get("version", str(new_version_num))),
            mime_type=file.content_type or doc.mime_type,
            file_size=file_size,
            file_hash=file_hash,
            uploaded_by=user.id,
            validation_status=ValidationStatus.PROCESSING,
            notes=notes.strip() or f"Replaced with version {new_version_num}.",
        )
        db.add(new_version)

        # Update Document master record
        doc.current_version = new_version_num
        doc.file_name = clean_filename
        doc.file_size = file_size
        doc.file_hash = file_hash
        doc.mime_type = file.content_type or doc.mime_type
        doc.cloudinary_asset_id = cloud_res.get("asset_id")
        doc.cloudinary_public_id = cloud_res.get("public_id")
        doc.cloudinary_version = str(cloud_res.get("version", str(new_version_num)))
        doc.uploaded_at = datetime.now(timezone.utc)
        doc.status = DocumentStatus.ACTIVE
        doc.validation_status = ValidationStatus.PROCESSING

        db.commit()
        db.refresh(doc)

        # Run OCR Prevalidation on new version
        try:
            val_result = prevalidate_document_workflow(
                file_bytes=file_bytes,
                filename=clean_filename,
                document_type=doc.document_type,
                profile=profile,
            )
            val_status_enum = ValidationStatus[val_result.get("status", "VALID")]
            
            # Update validation record
            val_rec = db.query(DocumentValidation).filter(DocumentValidation.document_id == doc.id).first()
            if val_rec:
                val_rec.version_id = new_version.id
                val_rec.extracted_data = val_result.get("extracted_data", {})
                val_rec.discrepancies = val_result.get("discrepancies", [])
                val_rec.missing_fields = val_result.get("missing_fields", [])
                val_rec.status = val_status_enum
                val_rec.result = val_result.get("status", "PASS")
                val_rec.summary = val_result.get("summary")
                val_rec.validated_at = datetime.now(timezone.utc)
            doc.validation_status = val_status_enum
            new_version.validation_status = val_status_enum
            db.commit()
        except Exception as e:
            logger.warning(f"Re-validation on replacement warning: {e}")
            doc.validation_status = ValidationStatus.READY
            db.commit()

        log_document_audit(
            db=db,
            user_id=user.id,
            document_id=doc.id,
            action="REPLACE",
            details={
                "old_version": new_version_num - 1,
                "new_version": new_version_num,
                "filename": clean_filename,
                "cloudinary_public_id": doc.cloudinary_public_id,
            },
            ip_address=ip_address,
        )

        return self._format_document_response(doc, db)

    def get_secure_view_url(
        self,
        db: Session,
        user: User,
        document_id: int,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates a short-lived signed access URL for viewing/previewing a document.
        Enforces strict cross-user authorization.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        self._verify_user_access(user, doc)

        public_id = doc.cloudinary_public_id or doc.stored_filename
        if not public_id:
            raise HTTPException(status_code=404, detail="Storage asset reference missing.")

        # Generate signed URL valid for 15 minutes
        signed_url = self.storage.generate_secure_access_url(
            public_id=public_id,
            resource_type=doc.cloudinary_resource_type or "image",
            access_type=doc.cloudinary_asset_type or "authenticated",
            expires_in_seconds=900,
        )

        log_document_audit(
            db=db,
            user_id=user.id,
            document_id=doc.id,
            action="VIEW",
            details={"public_id": public_id, "expires_in": 900},
            ip_address=ip_address,
        )

        return {
            "success": True,
            "document_id": doc.id,
            "document_name": doc.document_name or doc.file_name,
            "mime_type": doc.mime_type,
            "view_url": signed_url,
            "expires_in_seconds": 900,
            "storage_provider": doc.storage_provider or "CLOUDINARY",
        }

    def get_secure_download_url(
        self,
        db: Session,
        user: User,
        document_id: int,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates a short-lived signed URL with attachment Content-Disposition.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        self._verify_user_access(user, doc)

        public_id = doc.cloudinary_public_id or doc.stored_filename
        if not public_id:
            raise HTTPException(status_code=404, detail="Storage asset reference missing.")

        download_url = self.storage.generate_private_download_url(
            public_id=public_id,
            filename=doc.file_name or "download",
            resource_type=doc.cloudinary_resource_type or "image",
            access_type=doc.cloudinary_asset_type or "authenticated",
            expires_in_seconds=900,
        )

        log_document_audit(
            db=db,
            user_id=user.id,
            document_id=doc.id,
            action="DOWNLOAD",
            details={"filename": doc.file_name, "public_id": public_id},
            ip_address=ip_address,
        )

        return {
            "success": True,
            "document_id": doc.id,
            "file_name": doc.file_name,
            "download_url": download_url,
            "expires_in_seconds": 900,
            "storage_provider": doc.storage_provider or "CLOUDINARY",
        }

    def archive_document(
        self,
        db: Session,
        user: User,
        document_id: int,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Marks document status as ARCHIVED. Preserves Cloudinary asset for legal retention.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        self._verify_user_access(user, doc)

        doc.status = DocumentStatus.ARCHIVED
        db.commit()

        if doc.cloudinary_public_id:
            self.storage.archive_document(
                public_id=doc.cloudinary_public_id,
                resource_type=doc.cloudinary_resource_type or "image",
                access_type=doc.cloudinary_asset_type or "authenticated",
            )

        log_document_audit(
            db=db,
            user_id=user.id,
            document_id=doc.id,
            action="ARCHIVE",
            details={"status": "ARCHIVED"},
            ip_address=ip_address,
        )

        return {"success": True, "message": f"Document '{doc.document_name or doc.file_name}' has been archived."}

    def delete_document(
        self,
        db: Session,
        user: User,
        document_id: int,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Safely deletes document only if not currently mapped to an active statutory application.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found.")

        self._verify_user_access(user, doc)

        # Check if used by active applications
        active_usages = db.query(DocumentUsage).filter(
            DocumentUsage.document_id == doc.id,
            DocumentUsage.usage_status.in_([DocumentUsageStatus.SYNCED, DocumentUsageStatus.ACCEPTED, DocumentUsageStatus.UNDER_REVIEW])
        ).count()

        if active_usages > 0:
            raise HTTPException(
                status_code=400,
                detail=f"This document is currently used by {active_usages} active statutory applications. Please archive it instead.",
            )

        # Remove from Cloudinary
        if doc.cloudinary_public_id:
            try:
                self.storage.delete_document(
                    public_id=doc.cloudinary_public_id,
                    resource_type=doc.cloudinary_resource_type or "image",
                    access_type=doc.cloudinary_asset_type or "authenticated",
                )
            except Exception as e:
                logger.warning(f"Cloudinary deletion warning: {e}")

        # Delete database record
        db.delete(doc)
        db.commit()

        log_document_audit(
            db=db,
            user_id=user.id,
            document_id=document_id,
            action="DELETE",
            details={"filename": doc.file_name, "public_id": doc.cloudinary_public_id},
            ip_address=ip_address,
        )

        return {"success": True, "message": "Document deleted successfully."}

    def get_dashboard_metrics(self, db: Session, user: User) -> Dict[str, Any]:
        """Calculates realtime Document Center metrics strictly from PostgreSQL."""
        base_query = db.query(Document).filter(
            (Document.applicant_id == user.id) | (Document.user_id == user.id)
        )

        total = base_query.filter(Document.status == DocumentStatus.ACTIVE).count()
        ready = base_query.filter(
            Document.status == DocumentStatus.ACTIVE,
            Document.validation_status.in_([ValidationStatus.VALID, ValidationStatus.READY])
        ).count()
        needs_attention = base_query.filter(
            Document.status == DocumentStatus.ACTIVE,
            Document.validation_status.in_([ValidationStatus.WARNING, ValidationStatus.INVALID, ValidationStatus.FAILED])
        ).count()
        processing = base_query.filter(
            Document.status == DocumentStatus.ACTIVE,
            Document.validation_status == ValidationStatus.PROCESSING
        ).count()
        archived = base_query.filter(Document.status == DocumentStatus.ARCHIVED).count()

        # Count active reuse mappings across portals
        reused_count = db.query(DocumentUsage).filter(
            DocumentUsage.user_id == user.id,
            DocumentUsage.usage_status.in_([DocumentUsageStatus.SYNCED, DocumentUsageStatus.ACCEPTED, DocumentUsageStatus.SELECTED])
        ).count()

        return {
            "total_documents": total,
            "ready": ready,
            "needs_attention": needs_attention,
            "processing": processing,
            "archived": archived,
            "documents_reused": reused_count,
            "storage_provider": "CLOUDINARY",
            "cloudinary_connected": self.storage.is_configured,
        }

    def _verify_user_access(self, user: User, doc: Document):
        """Ensures the authenticated user has authorization to access the document."""
        role_str = str(user.role.value if hasattr(user.role, "value") else user.role).upper()
        if role_str in ["ADMIN", "SUPERADMIN"]:
            return
        if (doc.applicant_id and doc.applicant_id == user.id) or (doc.user_id and doc.user_id == user.id):
            return
        if role_str == "OFFICER":
            # Allow officer inspection
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have permission to view or manage this document.",
        )

    def _format_document_response(self, doc: Document, db: Session) -> Dict[str, Any]:
        """Formats canonical document output dictionary for API responses."""
        used_by = [u.approval_id for u in doc.usages] if doc.usages else []
        if doc.approval_id and doc.approval_id not in used_by:
            used_by.append(doc.approval_id)

        val = doc.validation
        return {
            "id": doc.id,
            "document_name": doc.document_name or doc.document_type,
            "document_type": doc.document_type,
            "document_type_code": doc.doc_type_rel.code if doc.doc_type_rel else get_canonical_type_code(doc.document_type),
            "file_name": doc.file_name,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "file_hash": doc.file_hash,
            "storage_provider": doc.storage_provider or "CLOUDINARY",
            "storage_status": doc.storage_status or "ACTIVE",
            "status": doc.status.value if doc.status else "ACTIVE",
            "validation_status": doc.validation_status.value if doc.validation_status else "PENDING",
            "version": doc.current_version or 1,
            "current_version": doc.current_version or 1,
            "document_number_masked": doc.document_number_masked,
            "used_by": list(dict.fromkeys(used_by)),
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            "validation_summary": val.summary if val else None,
            "recommended_action": val.recommended_action if val else None,
            "discrepancies": val.discrepancies if val else [],
        }


# Global singleton instance
document_service = DocumentService()
