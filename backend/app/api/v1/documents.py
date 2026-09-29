import logging
import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_applicant
from app.models.business_profile import BusinessProfile
from app.models.document import (
    Document,
    DocumentType,
    DocumentVersion,
    DocumentValidation,
    DocumentUsage,
    ApplicationDocumentRequirement,
    DocumentExternalMapping,
    StorageReconciliationRecord,
    DocumentStatus,
    ValidationStatus,
    DocumentUsageStatus,
)
from app.models.user import User, UserRole
from app.services.document_service import document_service, mask_identifier
from app.services.document_vault_service import (
    ensure_document_types_seeded,
    get_canonical_type_code,
    compute_document_completeness,
    log_document_audit,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── 1. DOCUMENT TYPES API ───────────────────────────────────────────────────
@router.get(
    "/document-types",
    summary="Get all canonical document types and categories",
)
def list_document_types(db: Session = Depends(get_db)):
    """Returns all active canonical document types."""
    types = ensure_document_types_seeded(db)
    return [
        {
            "id": t.id,
            "code": t.code,
            "name": t.name,
            "category": t.category,
            "description": t.description,
            "allowed_mime_types": t.allowed_mime_types,
            "max_file_size": t.max_file_size,
            "active": t.active,
        }
        for t in types if t.active
    ]


# ─── 2. UPLOAD DOCUMENT ──────────────────────────────────────────────────────
@router.post(
    "/documents/upload",
    status_code=status.HTTP_201_CREATED,
    summary="Upload document to Cloudinary storage with duplicate detection & pre-validation",
)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    document_name: Optional[str] = Form(None),
    approval_id: Optional[str] = Form(None),
    issue_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    force_upload: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """
    Securely uploads a document to Cloudinary authenticated storage and records metadata in PostgreSQL.
    Performs SHA-256 duplicate detection, version 1 creation, and automated OCR pre-validation.
    """
    client_ip = request.client.host if request.client else None
    return document_service.upload_document(
        db=db,
        user=current_user,
        file=file,
        document_type=document_type,
        document_name=document_name,
        approval_id=approval_id,
        issue_date=issue_date,
        expiry_date=expiry_date,
        force_upload=force_upload,
        ip_address=client_ip,
    )


# ─── 3. LIST DOCUMENTS ───────────────────────────────────────────────────────
@router.get(
    "/documents",
    summary="List all vault documents with search, filter, and usage mappings",
)
def list_documents(
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    approval: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all active vault documents belonging to the authenticated business/user."""
    query = db.query(Document).filter(
        (Document.applicant_id == current_user.id) | (Document.user_id == current_user.id),
        Document.status != DocumentStatus.DELETED
    )

    if search:
        s_term = f"%{search.strip().lower()}%"
        query = query.filter(
            (Document.document_name.ilike(s_term)) |
            (Document.document_type.ilike(s_term)) |
            (Document.file_name.ilike(s_term)) |
            (Document.document_number_masked.ilike(s_term))
        )

    if type and type != "ALL":
        canonical = get_canonical_type_code(type)
        query = query.filter(
            (Document.document_type.ilike(f"%{type}%")) |
            (Document.document_type == canonical)
        )

    if status_filter and status_filter != "ALL":
        if status_filter == "READY":
            query = query.filter(Document.validation_status.in_([ValidationStatus.READY, ValidationStatus.VALID]))
        elif status_filter == "NEEDS_ATTENTION":
            query = query.filter(Document.validation_status.in_([ValidationStatus.WARNING, ValidationStatus.INVALID, ValidationStatus.FAILED]))
        elif status_filter == "ARCHIVED":
            query = query.filter(Document.status == DocumentStatus.ARCHIVED)
        elif status_filter == "ACTIVE":
            query = query.filter(Document.status == DocumentStatus.ACTIVE)

    total = query.count()
    docs = query.order_by(Document.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for d in docs:
        usages = [u.approval_id for u in d.usages] if d.usages else []
        if d.approval_id and d.approval_id not in usages:
            usages.append(d.approval_id)

        items.append({
            "id": d.id,
            "document_name": d.document_name or d.document_type,
            "document_type": d.document_type,
            "file_name": d.file_name,
            "original_filename": d.file_name,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "storage_provider": d.storage_provider or "CLOUDINARY",
            "storage_status": d.storage_status or "ACTIVE",
            "status": d.status.value,
            "validation_status": d.validation_status.value,
            "current_version": d.current_version,
            "version": d.current_version,
            "document_number_masked": d.document_number_masked,
            "issue_date": d.issue_date,
            "expiry_date": d.expiry_date,
            "used_by": list(dict.fromkeys(usages)) if usages else ["General Vault"],
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "validation": d.validation,
        })

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
    }


# ─── 4. DASHBOARD METRICS ────────────────────────────────────────────────────
@router.get(
    "/documents/metrics",
    summary="Get aggregated Document Center statistics from PostgreSQL",
)
def get_document_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculates realtime Document Center metrics directly from database."""
    return document_service.get_dashboard_metrics(db=db, user=current_user)


# ─── 5. MISSING DOCUMENTS & COMPLETENESS API ────────────────────────────────
@router.get(
    "/documents/completeness",
    summary="Calculate required, available, and missing documents for selected approvals",
)
def get_document_completeness(
    approvals: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """
    Evaluates required documents across selected approvals, checks the user's vault,
    and returns available vs missing documents without asking for duplicate uploads.
    """
    selected_list = [a.strip() for a in approvals.split(",") if a.strip()] if approvals else ["fssai", "gst", "udyam"]
    return compute_document_completeness(db, current_user.id, selected_list)


@router.get(
    "/documents/missing",
    summary="Get missing document checklist for active approval selections",
)
def get_missing_documents(
    approvals: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """Returns only the missing document requirements that still need to be uploaded."""
    selected_list = [a.strip() for a in approvals.split(",") if a.strip()] if approvals else ["fssai", "gst", "udyam"]
    comp = compute_document_completeness(db, current_user.id, selected_list)
    return {
        "missing_count": comp["missing"],
        "missing_documents": comp["missing_documents"],
        "total_required": comp["total_required"],
        "available_count": comp["available"],
    }


# ─── 6. GET SINGLE DOCUMENT ──────────────────────────────────────────────────
@router.get(
    "/documents/{id}",
    summary="Get single document details, versions, and validation results",
)
def get_document(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetches a specific document and its version history and validation report."""
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    
    document_service._verify_user_access(current_user, doc)

    log_document_audit(db, current_user.id, "VIEW", doc.id)

    usages = [
        {
            "approval": u.approval_id,
            "application_id": u.application_id,
            "usage_status": u.usage_status.value,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in doc.usages
    ]

    versions = [
        {
            "id": v.id,
            "version_number": v.version_number,
            "file_name": v.original_filename,
            "file_size": v.file_size,
            "uploaded_at": v.uploaded_at.isoformat() if v.uploaded_at else None,
            "validation_status": v.validation_status.value if v.validation_status else "PENDING",
            "notes": v.notes,
        }
        for v in doc.versions
    ]

    return {
        "id": doc.id,
        "document_name": doc.document_name or doc.document_type,
        "document_type": doc.document_type,
        "file_name": doc.file_name,
        "original_filename": doc.file_name,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "storage_provider": doc.storage_provider or "CLOUDINARY",
        "storage_status": doc.storage_status or "ACTIVE",
        "status": doc.status.value,
        "validation_status": doc.validation_status.value,
        "current_version": doc.current_version,
        "version": doc.current_version,
        "document_number_masked": doc.document_number_masked,
        "issue_date": doc.issue_date,
        "expiry_date": doc.expiry_date,
        "used_by": [u["approval"] for u in usages] if usages else ["General Vault"],
        "usages": usages,
        "versions": versions,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "validation": doc.validation,
    }


# ─── 7. VIEW DOCUMENT (SIGNED TEMPORARY ACCESS) ──────────────────────────────
@router.get(
    "/documents/{id}/view",
    summary="Generate time-limited signed URL for viewing sensitive document",
)
def view_document(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a short-lived, signed Cloudinary URL for in-browser previewing.
    No permanent public URL is ever exposed.
    """
    client_ip = request.client.host if request.client else None
    return document_service.get_secure_view_url(
        db=db,
        user=current_user,
        document_id=id,
        ip_address=client_ip,
    )


# ─── 8. DOWNLOAD DOCUMENT (SIGNED PRIVATE ATTACHMENT) ────────────────────────
@router.get(
    "/documents/{id}/download",
    summary="Generate time-limited signed download URL with Content-Disposition",
)
def download_document(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a secure signed URL configured with attachment Content-Disposition and original filename.
    """
    client_ip = request.client.host if request.client else None
    return document_service.get_secure_download_url(
        db=db,
        user=current_user,
        document_id=id,
        ip_address=client_ip,
    )


# ─── 9. REPLACE DOCUMENT (VERSIONING) ────────────────────────────────────────
@router.post(
    "/documents/{id}/replace",
    summary="Replace document with a new version (creates version history in Cloudinary & DB)",
)
async def replace_document(
    id: int,
    request: Request,
    file: UploadFile = File(...),
    notes: Optional[str] = Form("Updated document copy"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """
    Creates a new version (v2, v3) of the existing document in Cloudinary and database
    while strictly preserving version history.
    """
    client_ip = request.client.host if request.client else None
    return document_service.replace_document_version(
        db=db,
        user=current_user,
        document_id=id,
        file=file,
        notes=notes or "",
        ip_address=client_ip,
    )


# ─── 10. ARCHIVE DOCUMENT ────────────────────────────────────────────────────
@router.post(
    "/documents/{id}/archive",
    summary="Archive a document so it is not used for new applications",
)
def archive_document(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """Sets document status to ARCHIVED while preserving historical application references."""
    client_ip = request.client.host if request.client else None
    return document_service.archive_document(
        db=db,
        user=current_user,
        document_id=id,
        ip_address=client_ip,
    )


# ─── 11. DELETE DOCUMENT ─────────────────────────────────────────────────────
@router.delete(
    "/documents/{id}",
    summary="Delete document from vault (blocked if attached to active application)",
)
def delete_document(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deletes a document and its Cloudinary assets. Blocks deletion if attached to an active submitted application.
    """
    client_ip = request.client.host if request.client else None
    return document_service.delete_document(
        db=db,
        user=current_user,
        document_id=id,
        ip_address=client_ip,
    )


# ─── 12. RE-VALIDATE DOCUMENT ────────────────────────────────────────────────
@router.post(
    "/documents/{id}/validate",
    summary="Trigger automated OCR pre-validation on an existing document",
)
def trigger_document_validation(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-executes OCR entity extraction and profile consistency verification."""
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    
    document_service._verify_user_access(current_user, doc)

    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == doc.user_id).first()
    
    from app.services.document_extractor import prevalidate_document_workflow
    val_result = prevalidate_document_workflow(
        filename=doc.file_name,
        document_type=doc.document_type,
        profile=profile,
    )

    val_status_enum = ValidationStatus[val_result.get("status", "VALID")]
    
    val_record = db.query(DocumentValidation).filter(DocumentValidation.document_id == doc.id).first()
    if not val_record:
        val_record = DocumentValidation(
            document_id=doc.id,
            extracted_data=val_result.get("extracted_data", {}),
            discrepancies=val_result.get("discrepancies", []),
            missing_fields=val_result.get("missing_fields", []),
            status=val_status_enum,
            result=val_result.get("status", "PASS"),
            summary=val_result.get("summary"),
            recommended_action=val_result.get("recommended_action"),
        )
        db.add(val_record)
    else:
        val_record.extracted_data = val_result.get("extracted_data", {})
        val_record.discrepancies = val_result.get("discrepancies", [])
        val_record.missing_fields = val_result.get("missing_fields", [])
        val_record.status = val_status_enum
        val_record.result = val_result.get("status", "PASS")
        val_record.summary = val_result.get("summary")
        val_record.recommended_action = val_result.get("recommended_action")

    doc.validation_status = val_status_enum

    # Auto-enrich profile with extracted statutory identifiers
    if profile:
        reg_dict = dict(profile.existing_registrations or {})
        ext_regs = (val_result.get("extracted_data") or {}).get("registration_numbers") or {}
        if "PAN" in ext_regs and ext_regs["PAN"]:
            reg_dict["pan"] = ext_regs["PAN"]
            doc.document_number_masked = mask_identifier(ext_regs["PAN"])
        if "GSTIN" in ext_regs and ext_regs["GSTIN"]:
            reg_dict["gstin"] = ext_regs["GSTIN"]
        if "CIN" in ext_regs and ext_regs["CIN"]:
            reg_dict["cin"] = ext_regs["CIN"]
        if "FSSAI_NO" in ext_regs and ext_regs["FSSAI_NO"]:
            reg_dict["fssai"] = ext_regs["FSSAI_NO"]
        if "UDYAM_NO" in ext_regs and ext_regs["UDYAM_NO"]:
            reg_dict["udyam"] = ext_regs["UDYAM_NO"]
        profile.existing_registrations = reg_dict

    db.commit()
    db.refresh(val_record)

    log_document_audit(db, current_user.id, "VALIDATE", doc.id, {"status": val_status_enum.value})

    return {
        "document_id": doc.id,
        "status": doc.validation_status.value,
        "validation": val_record,
        "disclaimer": val_result.get("disclaimer"),
    }


# ─── 13. DOCUMENT USAGE API ──────────────────────────────────────────────────
@router.get(
    "/documents/{id}/usage",
    summary="Get approvals and applications currently using this document",
)
def get_document_usage(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all application mappings and sync states for a specific document."""
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    
    document_service._verify_user_access(current_user, doc)

    return {
        "document_id": doc.id,
        "document_name": doc.document_name,
        "used_by": [
            {
                "approval": u.approval_id,
                "application_id": u.application_id or "DRAFT",
                "status": u.usage_status.value,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in doc.usages
        ]
    }


# ─── 14. DOCUMENT VERSIONS API ───────────────────────────────────────────────
@router.get(
    "/documents/{id}/versions",
    summary="List all historical versions of a document",
)
def get_document_versions(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all historical versions of the document."""
    doc = db.query(Document).filter(Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    document_service._verify_user_access(current_user, doc)

    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "original_filename": v.original_filename,
            "file_size": v.file_size,
            "mime_type": v.mime_type,
            "validation_status": v.validation_status.value if v.validation_status else "PENDING",
            "uploaded_at": v.uploaded_at.isoformat() if v.uploaded_at else None,
            "notes": v.notes,
        }
        for v in doc.versions
    ]


# ─── 15. DOCUMENT REUSE API ──────────────────────────────────────────────────
@router.post(
    "/applications/{application_id}/documents/reuse",
    summary="Link an existing vault document to an application requirement",
)
def reuse_document_for_application(
    application_id: str,
    document_id: int = Form(...),
    approval_id: str = Form(...),
    required_document_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_applicant),
):
    """Attaches an existing valid vault document to an approval application."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    
    document_service._verify_user_access(current_user, doc)

    profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == current_user.id).first()

    # Upsert DocumentUsage
    usage = db.query(DocumentUsage).filter(
        DocumentUsage.document_id == doc.id,
        DocumentUsage.approval_id == approval_id,
        DocumentUsage.application_id == application_id
    ).first()

    if not usage:
        usage = DocumentUsage(
            document_id=doc.id,
            user_id=current_user.id,
            business_profile_id=profile.id if profile else None,
            approval_id=approval_id,
            application_id=application_id,
            required_document_type=required_document_type,
            usage_status=DocumentUsageStatus.SYNCED,
        )
        db.add(usage)
    else:
        usage.usage_status = DocumentUsageStatus.SYNCED

    # Update or create ApplicationDocumentRequirement
    req = db.query(ApplicationDocumentRequirement).filter(
        ApplicationDocumentRequirement.application_id == application_id,
        ApplicationDocumentRequirement.approval_id == approval_id,
        ApplicationDocumentRequirement.document_type_code == required_document_type
    ).first()

    if req:
        req.document_id = doc.id
        req.status = "AVAILABLE"
    else:
        req = ApplicationDocumentRequirement(
            application_id=application_id,
            approval_id=approval_id,
            document_type_code=required_document_type,
            required=True,
            status="AVAILABLE",
            document_id=doc.id,
        )
        db.add(req)

    db.commit()

    log_document_audit(db, current_user.id, "REUSE", doc.id, {"application_id": application_id, "approval": approval_id})

    return {
        "success": True,
        "message": f"Document '{doc.document_name or doc.file_name}' attached to {approval_id} application.",
        "usage": {
            "id": usage.id,
            "document_id": usage.document_id,
            "approval_id": usage.approval_id,
            "application_id": usage.application_id,
            "usage_status": usage.usage_status.value,
        },
    }


# ─── 16. STORAGE RECONCILIATION API (ADMIN) ──────────────────────────────────
@router.get(
    "/documents/reconciliation/records",
    summary="List storage reconciliation and orphan records for administration",
)
def list_reconciliation_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns storage reconciliation records."""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Admin authorization required.")

    records = db.query(StorageReconciliationRecord).order_by(StorageReconciliationRecord.created_at.desc()).limit(100).all()
    return [
        {
            "id": r.id,
            "document_id": r.document_id,
            "cloudinary_asset_id": r.cloudinary_asset_id,
            "cloudinary_public_id": r.cloudinary_public_id,
            "issue_type": r.issue_type,
            "status": r.status,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        }
        for r in records
    ]
