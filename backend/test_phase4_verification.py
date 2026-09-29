
"""
Phase 4 Complete Verification Test Suite for SIH26130
Acceptance Test Requirements:
1. Upload a sample document (PDF/PNG/JPG).
2. System extracts text.
3. System displays extracted fields (company name, address, dates, reg numbers).
4. System compares extracted info with applicant's business profile.
5. System produces VALID / WARNING / INVALID with detailed reasons.
6. Verify API endpoints:
   - POST /api/documents/upload
   - GET /api/documents
   - GET /api/documents/{id}
   - POST /api/documents/{id}/validate
7. Clearly labeled as 'Pre-validation' without claiming legal authenticity.
"""

import sys
import os
import io
import fitz  # PyMuPDF
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.business_profile import BusinessProfile
from app.models.document import Document, DocumentValidation
from app.core.security import create_access_token

client = TestClient(app)


def generate_sample_pdf(title: str, company: str, address: str, pan: str, gstin: str, reg_no: str, date_str: str) -> bytes:
    """Generates a clean synthetic PDF for prevalidation testing."""
    doc = fitz.open()
    page = doc.new_page()
    content = (
        f"{title}\n\n"
        f"M/s. {company}\n"
        f"Factory Address: {address}\n"
        f"Registration No: {reg_no}\n"
        f"Permanent Account Number (PAN): {pan}\n"
        f"Goods & Services Tax Identification (GSTIN): {gstin}\n"
        f"Date of Issue: {date_str}\n"
        f"Status: Provisional Clearance Granted\n"
    )
    page.insert_text((50, 72), content, fontsize=11)
    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes


def run_phase4_tests():
    print("=" * 65)
    print("SIH26130 Phase 4 Document Intelligence & Pre-validation Tests")
    print("=" * 65)

    db = SessionLocal()
    try:
        # 1. Setup Test User & Profile: ABC Foods Pvt Ltd
        test_email = "applicant_doc_test@abcfoods.com"
        applicant = db.query(User).filter(User.email == test_email).first()
        if not applicant:
            from app.core.security import hash_password
            applicant = User(
                email=test_email,
                hashed_password=hash_password("Password123!"),
                full_name="Alok Verma",
                role=UserRole.APPLICANT,
                is_active=True
            )
            db.add(applicant)
            db.commit()
            db.refresh(applicant)

        token = create_access_token(subject=applicant.id, role="APPLICANT", email=applicant.email)
        headers = {"Authorization": f"Bearer {token}"}

        # Profile: "ABC Foods Pvt Ltd" in Pune
        profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == applicant.id).first()
        if not profile:
            profile = BusinessProfile(
                user_id=applicant.id,
                company_name="ABC Foods Pvt Ltd",
                business_type="Private Limited Company",
                industry="Food Processing",
                state="Maharashtra",
                district="Pune",
                investment_amount=5000000.0,
                employee_count=15,
                project_stage="Factory Construction",
                land_status="MIDC Industrial Land",
                existing_approvals=["PAN Card", "GSTIN Registration"]
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

        print(f"[1] Verified Profile: {profile.company_name} in {profile.district}, {profile.state}")

        # 2. Test Case A: Upload Document with Company-Name Mismatch (ABC Food Industries)
        # Expected: Status WARNING with "Possible company-name mismatch"
        print("\n[2] Testing Upload & Pre-validation on Document with Company Name Mismatch...")
        pdf_a_bytes = generate_sample_pdf(
            title="GOVERNMENT OF MAHARASHTRA - PROVISIONAL FACTORY NOC",
            company="ABC Food Industries",  # Mismatch: Industries vs Pvt Ltd
            address="Plot No. B-45, Chakan MIDC, Pune, Maharashtra - 410501",
            pan="ABCDE1234F",
            gstin="27ABCDE1234F1Z5",
            reg_no="NOC-MH-2026-98765",
            date_str="15/05/2026"
        )

        files_a = {
            "file": ("provisional_noc_mismatch.pdf", io.BytesIO(pdf_a_bytes), "application/pdf")
        }
        data_a = {
            "document_type": "Provisional Fire NOC",
            "approval_id": "cfo-fire-provisional"
        }

        resp_a = client.post("/api/documents/upload", files=files_a, data=data_a, headers=headers)
        assert resp_a.status_code == 201, f"Expected 201 Created, got {resp_a.status_code}: {resp_a.text}"
        doc_a = resp_a.json()
        print(f"    [PASS] Document uploaded successfully. ID: {doc_a['id']}")
        print(f"    [PASS] Auto-assigned validation_status: {doc_a['validation_status']}")

        assert doc_a["validation_status"] == "WARNING", f"Expected WARNING, got {doc_a['validation_status']}"
        val_a = doc_a["validation"]
        assert val_a is not None, "Validation record missing in response"

        # Check extracted fields
        ext_a = val_a["extracted_data"]
        print(f"    Extracted Company: {ext_a.get('company_name')}")
        print(f"    Extracted Address: {ext_a.get('address')}")
        print(f"    Extracted Reg Numbers: {ext_a.get('registration_numbers')}")
        print(f"    Extracted Dates: {ext_a.get('relevant_dates')}")

        assert "ABC Food Industries" in ext_a.get("company_name", ""), "Failed to extract company name"
        assert "ABCDE1234F" in ext_a.get("registration_numbers", {}).values(), "Failed to extract PAN"

        # Check discrepancies
        discrepancies_a = val_a["discrepancies"]
        mismatch_found = any("company-name" in d.get("message", "").lower() for d in discrepancies_a)
        assert mismatch_found, f"Expected company-name mismatch warning, got: {discrepancies_a}"
        print(f"    [PASS] Company name mismatch detected: {discrepancies_a[0]['message']}")

        # 3. Test Case B: Upload Fully Consistent Document
        # Expected: Status VALID
        print("\n[3] Testing Upload & Pre-validation on Fully Consistent Document...")
        pdf_b_bytes = generate_sample_pdf(
            title="INCORPORATION & ESTABLISHMENT CERTIFICATE",
            company="ABC Foods Pvt Ltd",  # Exact match!
            address="Plot No. B-45, Chakan MIDC, Pune, Maharashtra - 410501",
            pan="ABCDE1234F",
            gstin="27ABCDE1234F1Z5",
            reg_no="CIN-U15400MH2026PTC123456",
            date_str="20/03/2026"
        )
        files_b = {
            "file": ("valid_incorporation.pdf", io.BytesIO(pdf_b_bytes), "application/pdf")
        }
        data_b = {
            "document_type": "Certificate of Incorporation",
            "approval_id": None
        }
        resp_b = client.post("/api/documents/upload", files=files_b, data=data_b, headers=headers)
        assert resp_b.status_code == 201, f"Expected 201, got {resp_b.status_code}: {resp_b.text}"
        doc_b = resp_b.json()
        assert doc_b["validation_status"] == "VALID", f"Expected VALID, got {doc_b['validation_status']}"
        print(f"    [PASS] Fully consistent document verified as VALID. ID: {doc_b['id']}")

        # 4. Test Case C: Test GET /api/documents list
        print("\n[4] Testing GET /api/documents (Listing documents)...")
        list_resp = client.get("/api/documents", headers=headers)
        assert list_resp.status_code == 200, f"Expected 200, got {list_resp.status_code}"
        docs_list = list_resp.json()
        assert len(docs_list) >= 2, f"Expected at least 2 documents, got {len(docs_list)}"
        print(f"    [PASS] Retrieved {len(docs_list)} documents for applicant.")

        # 5. Test Case D: Test GET /api/documents/{id}
        print(f"\n[5] Testing GET /api/documents/{doc_a['id']}...")
        get_resp = client.get(f"/api/documents/{doc_a['id']}", headers=headers)
        assert get_resp.status_code == 200, f"Expected 200, got {get_resp.status_code}"
        assert get_resp.json()["id"] == doc_a["id"]
        print(f"    [PASS] Document details retrieved successfully.")

        # 6. Test Case E: Test POST /api/documents/{id}/validate (Re-trigger validation)
        print(f"\n[6] Testing POST /api/documents/{doc_a['id']}/validate (Re-validation)...")
        val_resp = client.post(f"/api/documents/{doc_a['id']}/validate", headers=headers)
        assert val_resp.status_code == 200, f"Expected 200, got {val_resp.status_code}"
        val_data = val_resp.json()
        assert val_data["status"] == "WARNING"
        assert "Pre-validation Notice" in val_data["disclaimer"]
        print(f"    [PASS] Re-validation complete. Status: {val_data['status']}")
        print(f"    [PASS] Disclaimer verified: '{val_data['disclaimer'][:80]}...'")

        # 7. Test Case F: Security RBAC (Another user cannot access document)
        print("\n[7] Testing RBAC Security...")
        other_user = db.query(User).filter(User.email == "other_applicant@test.com").first()
        other_token = create_access_token(subject=other_user.id, role="APPLICANT", email=other_user.email)
        other_headers = {"Authorization": f"Bearer {other_token}"}

        unauth_get = client.get(f"/api/documents/{doc_a['id']}", headers=other_headers)
        assert unauth_get.status_code == 403, f"Expected 403 Forbidden, got {unauth_get.status_code}"
        print("    [PASS] Unauthorized document access blocked with HTTP 403 Forbidden.")

        print("\n" + "=" * 65)
        print("PHASE 4 BACKEND ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!")
        print("=" * 65)

    finally:
        db.close()


if __name__ == "__main__":
    run_phase4_tests()
