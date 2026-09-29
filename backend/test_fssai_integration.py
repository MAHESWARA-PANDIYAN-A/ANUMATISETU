"""
Verification test suite for TASKER <-> Mock FSSAI Headless Integration
"""
import sys
import os

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(__file__))

import requests
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.application import Application
from app.core.security import create_access_token

BASE_URL = "http://127.0.0.1:8000/api"

def test_fssai_integration():
    print("=================================================================")
    print("  TASKER <-> MOCK FSSAI HEADLESS INTEGRATION VERIFICATION SUITE  ")
    print("=================================================================")
    
    db = SessionLocal()
    
    # 1. Get or create test applicant
    user = db.query(User).filter(User.email == "applicant.fssai@sahyadri.com").first()
    if not user:
        from app.core.security import hash_password
        user = User(
            email="applicant.fssai@sahyadri.com",
            hashed_password=hash_password("Applicant@123"),
            full_name="Rajesh Patil",
            role=UserRole.APPLICANT,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(subject=user.id, role=user.role.value, email=user.email)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Test Fetching Statutory Document Requirements
    print("\n[STEP 1] Fetching FSSAI Statutory Document Specifications...")
    req_resp = requests.get(f"{BASE_URL}/fssai/requirements", headers=headers)
    assert req_resp.status_code == 200, f"Failed to fetch requirements: {req_resp.text}"
    req_data = req_resp.json().get("data", [])
    assert len(req_data) >= 4, f"Expected 4 statutory document requirements, found {len(req_data)}"
    doc_ids = [d["id"] for d in req_data]
    assert "identity_proof" in doc_ids
    assert "address_proof" in doc_ids
    assert "passport_photo" in doc_ids
    assert "food_product_category" in doc_ids
    print(f"  [PASS] Successfully retrieved {len(req_data)} statutory document requirements:")
    for d in req_data:
        print(f"         - {d['name']} ({d['id']}): Max {d.get('max_size_mb', 5)}MB")

    # 3. Test Prefill Context Extraction
    print("\n[STEP 2] Fetching Prefill Context from Business Profile...")
    prefill_resp = requests.get(f"{BASE_URL}/fssai/prefill-data", headers=headers)
    assert prefill_resp.status_code == 200, f"Failed to get prefill data: {prefill_resp.text}"
    prefill_data = prefill_resp.json().get("data", {})
    assert "applicant" in prefill_data
    assert "business" in prefill_data
    assert "products" in prefill_data
    print(f"  [PASS] Prefill payload constructed:")
    print(f"         Applicant: {prefill_data['applicant']['applicant_name']} ({prefill_data['applicant']['designation']})")
    print(f"         Business:  {prefill_data['business']['business_name']} ({prefill_data['business']['organization_type']})")
    print(f"         Products:  {len(prefill_data['products'])} food product categories configured")

    # 4. Test 100% Headless 3-Step Automated Submission
    print("\n[STEP 3] Executing 100% Headless Automated FSSAI Submission Pipeline...")
    submit_payload = {
        "applicant_name": "Rajesh Patil",
        "designation": "Managing Director",
        "mobile": "9876543210",
        "email": user.email,
        "business_name": "Sahyadri Organic Agro & Food Processing Ltd",
        "organization_type": "PRIVATE_LIMITED",
        "business_type": "MANUFACTURING_UNIT",
        "pan_number": "AABCS1429K",
        "gst_number": "27AABCS1429K1Z5",
        "state": "Maharashtra",
        "district": "Pune",
        "pincode": "411028",
        "address_line_1": "Plot 42, Hadapsar Industrial Estate",
        "ownership_type": "OWNED",
        "activities": ["MANUFACTURING", "PACKAGING"],
        "products": [
            {
                "product_name": "Packaged Snack & Agro Food Products",
                "product_category": "Packaged Foods",
                "expected_capacity": 1500,
                "unit_of_measure": "kg/day"
            }
        ]
    }
    
    sub_resp = requests.post(f"{BASE_URL}/fssai/submit-json", json=submit_payload, headers=headers)
    assert sub_resp.status_code == 200, f"Headless submission failed: {sub_resp.text}"
    sub_data = sub_resp.json()
    assert sub_data.get("success") is True
    fssai_app_no = sub_data.get("fssai_application_number")
    assert fssai_app_no is not None and "FSSAI" in fssai_app_no
    assert sub_data.get("fssai_status") == "SUBMITTED"
    main_app_id = sub_data.get("main_application_id")
    print(f"  [PASS] 100% Automated 3-Step Chain Completed Successfully!")
    print(f"         Generated FSSAI App Number: {fssai_app_no}")
    print(f"         FSSAI Initial Status:      {sub_data.get('fssai_status')}")
    print(f"         Main Platform App Number:  {sub_data.get('main_application_number')} (ID: {main_app_id})")
    print(f"         Statutory Docs Uploaded:   {sub_data.get('documents_uploaded')}/4")

    # 5. Test Live Status Syncing
    print("\n[STEP 4] Testing Live Status Sync from Mock FSSAI Portal...")
    sync_resp = requests.get(f"{BASE_URL}/fssai/status/{fssai_app_no}", headers=headers)
    assert sync_resp.status_code == 200, f"Status sync failed: {sync_resp.text}"
    sync_data = sync_resp.json()
    assert sync_data.get("success") is True
    print(f"  [PASS] Live Status Synced:")
    print(f"         Application No:   {sync_data.get('application_number')}")
    print(f"         Live Status:      {sync_data.get('status')}")
    print(f"         Officer Remarks:  {sync_data.get('officer_remarks')}")

    # 6. Verify Database Persistence
    print("\n[STEP 5] Verifying PostgreSQL Database Persistence...")
    persisted_app = db.query(Application).filter(Application.id == main_app_id).first()
    assert persisted_app is not None
    assert persisted_app.fssai_application_number == fssai_app_no
    assert persisted_app.fssai_status == "SUBMITTED"
    assert persisted_app.fssai_last_synced_at is not None
    print(f"  [PASS] Main DB Record Verified (fssai_application_number={persisted_app.fssai_application_number}, status={persisted_app.fssai_status})")

    db.close()
    print("\n=================================================================")
    print("  ALL MOCK FSSAI HEADLESS INTEGRATION CHECKS PASSED (100% SUCCESS)!")
    print("=================================================================")

if __name__ == "__main__":
    test_fssai_integration()
