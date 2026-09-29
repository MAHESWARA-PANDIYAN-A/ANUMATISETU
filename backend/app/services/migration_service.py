import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentVersion, DocumentStatus
from app.models.business_profile import BusinessProfile
from app.services.cloudinary_service import cloudinary_service

logger = logging.getLogger(__name__)


def migrate_local_documents_to_cloudinary(
    db: Session,
    cleanup_local_files: bool = False,
) -> Dict[str, Any]:
    """
    Scans PostgreSQL for documents with local file storage references,
    uploads each file to Cloudinary, verifies successful upload,
    updates PostgreSQL metadata, and creates a comprehensive migration audit log.
    Preserves local files safely unless cleanup_local_files is explicitly True.
    """
    docs = db.query(Document).filter(
        Document.status != DocumentStatus.DELETED
    ).all()

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_documents_scanned": len(docs),
        "migrated_count": 0,
        "already_migrated_count": 0,
        "failed_count": 0,
        "details": [],
    }

    for doc in docs:
        # Check if already migrated to Cloudinary
        if doc.storage_provider == "CLOUDINARY" and doc.cloudinary_public_id:
            report["already_migrated_count"] += 1
            report["details"].append({
                "document_id": doc.id,
                "file_name": doc.file_name,
                "status": "ALREADY_MIGRATED",
                "cloudinary_public_id": doc.cloudinary_public_id,
                "message": "Already safely stored in Cloudinary.",
            })
            continue

        local_path = doc.file_path
        if not local_path or not os.path.exists(local_path):
            # Check fallback directory
            fallback_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "documents")
            if doc.stored_filename and os.path.exists(os.path.join(fallback_dir, doc.stored_filename)):
                local_path = os.path.join(fallback_dir, doc.stored_filename)

        if not local_path or not os.path.exists(local_path):
            report["failed_count"] += 1
            report["details"].append({
                "document_id": doc.id,
                "file_name": doc.file_name,
                "status": "FAILED",
                "error": f"Physical local file missing at '{local_path or 'unknown'}'",
            })
            continue

        try:
            profile = db.query(BusinessProfile).filter(BusinessProfile.id == doc.business_profile_id).first()
            biz_id = profile.id if profile else f"usr_{doc.user_id}"

            with open(local_path, "rb") as f:
                file_bytes = f.read()

            cloud_res = cloudinary_service.upload_document(
                file_content=file_bytes,
                filename=doc.file_name,
                document_type=doc.document_type,
                business_id=biz_id,
                version=doc.current_version or 1,
                mime_type=doc.mime_type,
                extra_tags=["migrated_from_local"],
            )

            # Update master document record
            doc.storage_provider = "CLOUDINARY"
            doc.cloudinary_asset_id = cloud_res.get("asset_id")
            doc.cloudinary_public_id = cloud_res.get("public_id")
            doc.cloudinary_resource_type = cloud_res.get("resource_type", "image")
            doc.cloudinary_asset_type = cloud_res.get("asset_type", "authenticated")
            doc.cloudinary_version = str(cloud_res.get("version", "1"))
            doc.cloudinary_folder = cloud_res.get("folder")
            doc.storage_status = "MIGRATED"

            # Update latest version record
            latest_version = db.query(DocumentVersion).filter(
                DocumentVersion.document_id == doc.id,
                DocumentVersion.version_number == doc.current_version
            ).first()

            if latest_version:
                latest_version.cloudinary_asset_id = doc.cloudinary_asset_id
                latest_version.cloudinary_public_id = doc.cloudinary_public_id
                latest_version.cloudinary_resource_type = doc.cloudinary_resource_type
                latest_version.cloudinary_asset_type = doc.cloudinary_asset_type
                latest_version.cloudinary_version = doc.cloudinary_version

            db.commit()

            # Optional safe cleanup
            if cleanup_local_files and os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception as del_err:
                    logger.warning(f"Cleanup of local file after migration failed: {del_err}")

            report["migrated_count"] += 1
            report["details"].append({
                "document_id": doc.id,
                "file_name": doc.file_name,
                "status": "MIGRATED",
                "cloudinary_asset_id": doc.cloudinary_asset_id,
                "cloudinary_public_id": doc.cloudinary_public_id,
                "version": doc.current_version,
            })
            logger.info(f"Successfully migrated document #{doc.id} ('{doc.file_name}') to Cloudinary.")
        except Exception as e:
            db.rollback()
            report["failed_count"] += 1
            report["details"].append({
                "document_id": doc.id,
                "file_name": doc.file_name,
                "status": "FAILED",
                "error": str(e),
            })
            logger.error(f"Failed to migrate document #{doc.id}: {e}")

    return report
