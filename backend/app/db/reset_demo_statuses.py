import logging
from app.core.database import SessionLocal
from app.models.application import ApprovalApplication, ApprovalJourney, Application
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reset_demo_statuses")


def reset_demo_application_statuses():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "applicant@demo.com").first()
        if not user:
            logger.info("Demo user applicant@demo.com not found.")
            return

        # 1. GST -> Reset to DOCUMENT_QUERY (Waiting for applicant response)
        gst_apps = db.query(ApprovalApplication).join(ApprovalJourney).filter(
            ApprovalJourney.user_id == user.id,
            ApprovalApplication.approval_id == "GST"
        ).all()
        for ga in gst_apps:
            ga.status = "DOCUMENT_QUERY"
            ga.registration_ref = None
            ga.officer_remarks = "Officer Query raised: Principal place of business electricity bill is blurry. Please upload a clear copy to resume verification."
            logger.info(f"Reset GST application #{ga.id} to DOCUMENT_QUERY")

        # 2. FSSAI -> UNDER_REVIEW
        fssai_apps = db.query(ApprovalApplication).join(ApprovalJourney).filter(
            ApprovalJourney.user_id == user.id,
            ApprovalApplication.approval_id == "FSSAI"
        ).all()
        for fa in fssai_apps:
            fa.status = "UNDER_REVIEW"
            fa.registration_ref = None
            fa.officer_remarks = "Dossier under departmental scrutiny by Designated Officer, Salem Zone."
            logger.info(f"Reset FSSAI application #{fa.id} to UNDER_REVIEW")

        # 3. UDYAM -> APPROVED (Certified by MSME Ministry)
        udyam_apps = db.query(ApprovalApplication).join(ApprovalJourney).filter(
            ApprovalJourney.user_id == user.id,
            ApprovalApplication.approval_id == "UDYAM"
        ).all()
        for ua in udyam_apps:
            ua.status = "APPROVED"
            ua.registration_ref = "UDYAM-TN-24-0098712"
            ua.officer_remarks = "MSME Certificate issued under Gazette Notification S.O. 2119(E)."
            logger.info(f"Maintained Udyam application #{ua.id} as APPROVED")

        # Update legacy Application table as well
        legacy_apps = db.query(Application).filter(Application.applicant_id == user.id).all()
        for la in legacy_apps:
            la.gst_status = "DOCUMENT_QUERY"
            la.gst_registration_ref = None
            la.fssai_status = "UNDER_REVIEW"
            la.fssai_license_number = None
            la.udyam_status = "APPROVED"
            la.udyam_registration_number = "UDYAM-TN-24-0098712"

        db.commit()
        logger.info("Demo statuses successfully reset to authentic departmental scrutiny states.")
    except Exception as e:
        logger.error(f"Error resetting statuses: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    reset_demo_application_statuses()
