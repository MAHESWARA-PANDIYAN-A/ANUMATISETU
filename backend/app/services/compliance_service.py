import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.approval_intelligence import (
    ApprovalCatalog,
    ApprovalRecord,
    ComplianceTask,
    ExternalWorkflowStep,
)
from app.models.business_profile import BusinessProfile
from app.models.document import Document, DocumentStatus

logger = logging.getLogger(__name__)


class ComplianceService:
    """
    Post-Approval Monitoring Engine for tracking active statutory licenses,
    calculating dynamic renewal windows, tracking follow-up compliance tasks,
    and monitoring expiring vault documents.
    """

    @staticmethod
    def get_compliance_overview(
        db: Session,
        profile: Optional[BusinessProfile]
    ) -> Dict[str, Any]:
        if not profile:
            return {
                "summary": {
                    "active_approvals_count": 0,
                    "renewals_approaching_count": 0,
                    "expired_count": 0,
                    "pending_tasks_count": 0,
                    "expiring_documents_count": 0,
                },
                "approval_records": [],
                "tasks": [],
                "expiring_documents": [],
            }

        now = datetime.now(timezone.utc)
        records = db.query(ApprovalRecord).filter(
            ApprovalRecord.business_profile_id == profile.id
        ).all()
        catalogs = {c.code: c for c in db.query(ApprovalCatalog).all()}

        processed_records = []
        renewals_approaching_count = 0
        expired_count = 0
        active_count = 0

        for r in records:
            cat = catalogs.get(r.approval_id)
            days_remaining = None
            renewal_status = "LIFETIME_VALIDITY"
            urgency_badge = "ACTIVE"

            if r.expiry_date:
                # Ensure UTC aware comparison
                expiry = r.expiry_date
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                diff = (expiry - now).days
                days_remaining = max(0, diff) if diff >= 0 else diff

                if diff < 0:
                    renewal_status = "EXPIRED"
                    urgency_badge = "EXPIRED"
                    expired_count += 1
                elif diff <= 7:
                    renewal_status = "URGENT_RENEWAL"
                    urgency_badge = "CRITICAL"
                    renewals_approaching_count += 1
                    active_count += 1
                elif diff <= 30:
                    renewal_status = "RENEWAL_DUE"
                    urgency_badge = "HIGH"
                    renewals_approaching_count += 1
                    active_count += 1
                elif diff <= (r.renewal_window_days or 90):
                    renewal_status = "RENEWAL_APPROACHING"
                    urgency_badge = "WARNING"
                    renewals_approaching_count += 1
                    active_count += 1
                else:
                    renewal_status = "ACTIVE"
                    urgency_badge = "ACTIVE"
                    active_count += 1
            else:
                active_count += 1

            processed_records.append({
                "id": r.id,
                "approval_id": r.approval_id,
                "approval_name": cat.name if cat else r.approval_id,
                "department": cat.department if cat else "Department",
                "registration_number": r.registration_number,
                "status": r.status,
                "issue_date": r.issue_date.isoformat() if r.issue_date else None,
                "effective_date": r.effective_date.isoformat() if r.effective_date else None,
                "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
                "renewal_required": r.renewal_required,
                "renewal_window_days": r.renewal_window_days,
                "days_remaining": days_remaining,
                "renewal_status": renewal_status,
                "urgency_badge": urgency_badge,
                "certificate_document_id": r.certificate_document_id,
            })

        # Fetch compliance tasks
        tasks = db.query(ComplianceTask).filter(
            ComplianceTask.business_profile_id == profile.id
        ).order_by(ComplianceTask.due_date.asc()).all()

        processed_tasks = []
        for t in tasks:
            due = t.due_date
            if due and due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            days_to_due = (due - now).days if due else 0
            processed_tasks.append({
                "id": t.id,
                "approval_record_id": t.approval_record_id,
                "task_type": t.task_type,
                "title": t.title,
                "description": t.description,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "days_to_due": days_to_due,
                "status": t.status,
                "priority": t.priority,
                "source": t.source,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            })

        # Fetch expiring documents from Document Center if any
        expiring_docs = []
        user_docs = db.query(Document).filter(
            Document.user_id == profile.user_id,
            Document.status != DocumentStatus.DELETED,
        ).all()
        for doc in user_docs:
            if doc.expiry_date:
                try:
                    # Parse string date (YYYY-MM-DD or ISO)
                    exp_str = str(doc.expiry_date).strip()
                    if len(exp_str) == 10:
                        doc_exp = datetime.strptime(exp_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    else:
                        doc_exp = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
                        if doc_exp.tzinfo is None:
                            doc_exp = doc_exp.replace(tzinfo=timezone.utc)
                    doc_diff = (doc_exp - now).days
                    if doc_diff <= 60:
                        expiring_docs.append({
                            "id": doc.id,
                            "document_name": doc.document_name or doc.file_name or doc.document_type,
                            "document_type": doc.document_type,
                            "expiry_date": doc_exp.isoformat(),
                            "days_remaining": doc_diff,
                            "status": "EXPIRED" if doc_diff < 0 else "EXPIRING_SOON",
                        })
                except Exception:
                    pass

        return {
            "summary": {
                "active_approvals_count": active_count,
                "renewals_approaching_count": renewals_approaching_count,
                "expired_count": expired_count,
                "pending_tasks_count": len([t for t in processed_tasks if t["status"] != "COMPLETED"]),
                "expiring_documents_count": len(expiring_docs),
            },
            "approval_records": processed_records,
            "tasks": processed_tasks,
            "expiring_documents": expiring_docs,
        }

    @staticmethod
    def complete_task(db: Session, task_id: int) -> Dict[str, Any]:
        task = db.query(ComplianceTask).filter(ComplianceTask.id == task_id).first()
        if not task:
            raise ValueError(f"Compliance task with ID {task_id} not found.")

        task.status = "COMPLETED"
        task.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(task)

        return {
            "success": True,
            "message": f"Task '{task.title}' marked as completed.",
            "task_id": task.id,
            "status": task.status,
            "completed_at": task.completed_at.isoformat(),
        }

    @staticmethod
    def get_calendar_events(db: Session, profile: Optional[BusinessProfile]) -> List[Dict[str, Any]]:
        overview = ComplianceService.get_compliance_overview(db, profile)
        events = []

        for r in overview["approval_records"]:
            if r["expiry_date"]:
                events.append({
                    "id": f"record-{r['id']}",
                    "title": f"License Expiry: {r['approval_name']}",
                    "date": r["expiry_date"][:10],
                    "type": "LICENSE_EXPIRY",
                    "priority": r["urgency_badge"],
                    "details": f"Registration No: {r['registration_number']} ({r['days_remaining']} days remaining)",
                })

        for t in overview["tasks"]:
            if t["due_date"]:
                events.append({
                    "id": f"task-{t['id']}",
                    "title": t["title"],
                    "date": t["due_date"][:10],
                    "type": "COMPLIANCE_TASK",
                    "priority": t["priority"],
                    "details": t["description"],
                    "status": t["status"],
                })

        for d in overview["expiring_documents"]:
            events.append({
                "id": f"doc-{d['id']}",
                "title": f"Document Expiry: {d['document_name']}",
                "date": d["expiry_date"][:10],
                "type": "DOCUMENT_EXPIRY",
                "priority": "HIGH" if d["days_remaining"] <= 15 else "MEDIUM",
                "details": f"{d['document_type']} expiring in {d['days_remaining']} days",
            })

        events.sort(key=lambda x: x["date"])
        return events
