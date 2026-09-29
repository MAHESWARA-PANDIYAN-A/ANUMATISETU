from fastapi import APIRouter, Depends
from app.core.deps import require_admin, require_applicant, require_officer
from app.models.user import User

router = APIRouter()


@router.get("/applicant/dashboard")
def get_applicant_dashboard_overview(
    current_user: User = Depends(require_applicant)
):
    """
    Protected route accessible only to users with APPLICANT (or ADMIN) role.
    """
    return {
        "status": "success",
        "message": f"Welcome to Entrepreneur/Applicant Workspace, {current_user.full_name}!",
        "role": current_user.role.value,
        "user_id": current_user.id,
        "access": "APPLICANT_GRANTED",
        "features": [
            "Know Your Approvals (KYA) Wizard",
            "Common Application Form (CAF)",
            "Single-Window Document Locker",
            "SLA and Deemed Approval Countdown",
            "Support Schemes & Subsidies Explorer"
        ]
    }


@router.get("/officer/dashboard")
def get_officer_dashboard_overview(
    current_user: User = Depends(require_officer)
):
    """
    Protected route accessible only to users with OFFICER (or ADMIN) role.
    """
    return {
        "status": "success",
        "message": f"Welcome to Government Scrutiny Desk, {current_user.full_name}!",
        "role": current_user.role.value,
        "department": current_user.department or "General Industrial Review",
        "user_id": current_user.id,
        "access": "OFFICER_GRANTED",
        "features": [
            "Departmental Scrutiny Queue",
            "Digital Verification Checklist",
            "Deficiency & Query Raising",
            "Digital Endorsement & QR Issuance",
            "Joint Inspection Scheduler"
        ]
    }


@router.get("/admin/dashboard")
def get_admin_dashboard_overview(
    current_user: User = Depends(require_admin)
):
    """
    Protected route accessible only to users with ADMIN role.
    """
    return {
        "status": "success",
        "message": f"Welcome to Administrative Intelligence Center, {current_user.full_name}!",
        "role": current_user.role.value,
        "user_id": current_user.id,
        "access": "ADMIN_GRANTED",
        "features": [
            "System User Management",
            "State & District Analytics",
            "Department Bottleneck Heatmaps",
            "Regulatory SLA Compliance Monitoring"
        ]
    }
