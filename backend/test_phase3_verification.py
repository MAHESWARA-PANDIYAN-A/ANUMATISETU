"""
Phase 3 Complete Verification Test Suite for SIH26130
Acceptance Test Requirements:
1. Create a food-processing business profile.
2. Run recommendation via POST /api/approvals/recommend.
3. System produces structured approval recommendations from the controlled dataset.
4. Each recommendation shows:
   - approval_name
   - department
   - applicability_reason
   - required_documents
   - source
   - confidence
   - status
5. Verify audit logging in PostgreSQL.
6. Verify RBAC security (unauthorized user cannot query another user's profile).
"""
import sys
import os

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.business_profile import BusinessProfile
from app.models.audit_log import AuditLog
from app.core.security import create_access_token

client = TestClient(app)

def run_phase3_tests():
    print("=" * 65)
    print("SIH26130 Phase 3 AI Approval Recommendation Engine Verification")
    print("=" * 65)

    db = SessionLocal()
    try:
        # 1. Setup Test Applicant
        test_email = "food_entrepreneur@sahyadri.in"
        applicant = db.query(User).filter(User.email == test_email).first()
        if not applicant:
            from app.core.security import hash_password
            applicant = User(
                email=test_email,
                hashed_password=hash_password("Password123!"),
                full_name="Rajendra Deshmukh",
                role=UserRole.APPLICANT,
                phone="+91 98220 54321",
                is_active=True
            )
            db.add(applicant)
            db.commit()
            db.refresh(applicant)
            print(f"[1] Created test applicant user: {applicant.email} (ID: {applicant.id})")
        else:
            print(f"[1] Found existing test applicant user: {applicant.email} (ID: {applicant.id})")

        token = create_access_token(subject=applicant.id, role="APPLICANT", email=applicant.email)
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Setup Food-Processing Business Profile
        profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == applicant.id).first()
        if not profile:
            profile = BusinessProfile(
                user_id=applicant.id,
                company_name="Sahyadri Mega Food Processing LLP",
                business_type="Limited Liability Partnership (LLP)",
                industry="Food Processing",
                state="Maharashtra",
                district="Pune",
                investment_amount=8500000.0,  # 85 Lakhs
                employee_count=28,  # Triggers Factories Act threshold (>= 10)
                project_stage="Machinery Installation",
                land_status="MIDC Industrial Land",
                existing_approvals=["PAN Card", "GSTIN Registration", "Udyam Registration"]
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            print(f"[2] Created food-processing profile: {profile.company_name} (ID: {profile.id})")
        else:
            profile.industry = "Food Processing"
            profile.employee_count = 28
            profile.investment_amount = 8500000.0
            db.commit()
            db.refresh(profile)
            print(f"[2] Updated food-processing profile: {profile.company_name} (ID: {profile.id})")

        # 3. Acceptance Test: Call POST /api/approvals/recommend
        print("\n[3] Calling POST /api/approvals/recommend with business_profile_id...")
        resp = client.post("/api/approvals/recommend", json={"business_profile_id": profile.id}, headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        recommendations = resp.json()
        assert isinstance(recommendations, list), "Response must be a list of recommendation items"
        assert len(recommendations) > 0, "Recommendations list must not be empty"

        print(f"    [PASS] Received {len(recommendations)} structured approval recommendations.")

        # Check required fields on each recommendation
        required_keys = {"approval_name", "department", "applicability_reason", "required_documents", "source", "confidence", "status"}
        fssai_found = False
        mpcb_found = False
        fire_found = False
        dish_found = False

        for idx, rec in enumerate(recommendations, 1):
            assert required_keys.issubset(rec.keys()), f"Missing keys in recommendation: {required_keys - set(rec.keys())}"
            assert len(rec["approval_name"]) > 0, "approval_name cannot be empty"
            assert len(rec["department"]) > 0, "department cannot be empty"
            assert len(rec["applicability_reason"]) > 0, "applicability_reason cannot be empty"
            assert isinstance(rec["required_documents"], list) and len(rec["required_documents"]) > 0, "required_documents must have items"
            assert len(rec["source"]) > 0, "source cannot be empty"
            assert 0.0 <= rec["confidence"] <= 1.0, f"Confidence out of range: {rec['confidence']}"
            assert rec["status"] in ["MANDATORY", "CONDITIONAL", "ALREADY_OBTAINED"], f"Unexpected status: {rec['status']}"

            if "FSSAI" in rec["approval_name"]:
                fssai_found = True
            if "Consent" in rec["approval_name"] or "MPCB" in rec["department"]:
                mpcb_found = True
            if "Fire" in rec["approval_name"] or "CFO" in rec["department"]:
                fire_found = True
            if "Factory" in rec["approval_name"] or "DISH" in rec["department"]:
                dish_found = True

            print(f"    - [{rec['status']}] {rec['approval_name']} ({rec['department']})")
            print(f"      Source: {rec['source']} | Confidence: {rec['confidence']*100:.0f}%")
            print(f"      Reason: {rec['applicability_reason'][:110]}...")

        assert fssai_found, "FSSAI License must be recommended for a food processing enterprise!"
        assert mpcb_found, "MPCB Consent must be recommended for a food processing plant!"
        assert fire_found, "Fire NOC must be recommended for factory premises!"
        assert dish_found, "Factory License must be recommended for unit with 28 employees!"

        print("\n    [PASS] Core statutory approvals verified: FSSAI, MPCB, CFO Fire, DISH Factories Act.")

        # 4. Verify Audit Logging
        print("\n[4] Verifying Audit Logging in PostgreSQL...")
        audit = db.query(AuditLog).filter(
            AuditLog.business_profile_id == profile.id,
            AuditLog.action == "AI_APPROVAL_RECOMMENDATION"
        ).order_by(AuditLog.id.desc()).first()

        assert audit is not None, "Audit log record was not created!"
        assert audit.user_id == applicant.id
        assert audit.recommendations_count == len(recommendations)
        assert audit.status == "SUCCESS"
        print(f"    [PASS] Audit record found in DB (ID: {audit.id})")
        print(f"           Action: {audit.action} | Provider: {audit.ai_provider} | Count: {audit.recommendations_count}")
        print(f"           Logged At: {audit.created_at}")

        # 5. Verify RBAC Route Protection (Another real user cannot query this profile)
        print("\n[5] Verifying RBAC Protection against unauthorized profile inspection...")
        other_user = db.query(User).filter(User.email == "other_applicant@test.com").first()
        if not other_user:
            from app.core.security import hash_password
            other_user = User(
                email="other_applicant@test.com",
                hashed_password=hash_password("Password123!"),
                full_name="Other Applicant",
                role=UserRole.APPLICANT,
                is_active=True
            )
            db.add(other_user)
            db.commit()
            db.refresh(other_user)

        other_token = create_access_token(subject=other_user.id, role="APPLICANT", email=other_user.email)
        unauth_resp = client.post(
            "/api/approvals/recommend",
            json={"business_profile_id": profile.id},
            headers={"Authorization": f"Bearer {other_token}"}
        )
        assert unauth_resp.status_code == 403, f"Expected 403 Forbidden, got {unauth_resp.status_code}: {unauth_resp.text}"
        print("    [PASS] Unauthorized request rejected with HTTP 403 Forbidden.")

        print("\n" + "=" * 65)
        print("PHASE 3 ACCEPTANCE TEST PASSED WITH 100% SUCCESS!")
        print("=" * 65)

    finally:
        db.close()

if __name__ == "__main__":
    run_phase3_tests()
