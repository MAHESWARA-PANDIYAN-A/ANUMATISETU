import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_e2e_test():
    print("=" * 60)
    print("TASKER INDUSTRIAL APPROVAL PLATFORM -- E2E TEST SUITE")
    print("=" * 60)

    # 0. Register / Login test user
    email = f"rahul.foods_{int(time.time())}@abcfoods.in"
    print(f"\n[STEP 0] Registering demo applicant: {email}...")
    reg_r = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Rahul Sharma",
        "role": "APPLICANT"
    })
    
    login_r = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": "Password123!"
    })
    assert login_r.status_code == 200, f"Login failed: {login_r.text}"
    token = login_r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Applicant authenticated with JWT.")

    # 1. Check Onboarding Status
    print("\n[STEP 1] Checking Onboarding Status for new user...")
    r = requests.get(f"{BASE_URL}/onboarding/status", headers=headers)
    print(f"Status Code: {r.status_code}")
    res = r.json()
    print(f"User state: {res.get('state')} | Route: {res.get('next_route')}")
    assert res.get('state') == "BUSINESS_PROFILE_INCOMPLETE", "New user should have state BUSINESS_PROFILE_INCOMPLETE"

    # 2. Save Business Profile (Food Business Demo: ABC Foods Pvt Ltd)
    print("\n[STEP 2] Saving Business Profile (ABC Foods Pvt Ltd, Food Processing, Salem, INR 5 Cr)...")
    profile_payload = {
        "company_name": "ABC Foods Pvt Ltd",
        "business_name": "ABC Foods Pvt Ltd",
        "business_type": "Private Limited Company",
        "organization_type": "Private Limited Company",
        "industry": "Food & Food Processing",
        "business_activity": "Packaged Snack Manufacturing",
        "state": "Tamil Nadu",
        "district": "Salem",
        "pincode": "636001",
        "address": "Plot 42, SIDCO Industrial Estate, Salem",
        "investment": 50000000.0, # 5 Crore
        "expected_turnover": 150000000.0, # 15 Crore
        "employee_count": 100,
        "project_stage": "New Business",
        "land_status": "Allotted / Owned",
        "premises_type": "Industrial Unit",
        "existing_registrations": {
            "pan": "AAACA1234F",
            "gstin": "33AAACA1234F1Z5"
        }
    }
    r = requests.post(f"{BASE_URL}/business-profiles/", headers=headers, json=profile_payload)
    print(f"Save Profile Status: {r.status_code}")
    assert r.status_code in (200, 201), f"Profile save failed: {r.text}"
    profile_data = r.json()
    print(f"Profile saved! ID: {profile_data.get('id')} Name: {profile_data.get('company_name')}")

    # 3. Requirement Engine Evaluation
    print("\n[STEP 3] Running Requirement Engine & Fetching Recommendations...")
    r = requests.get(f"{BASE_URL}/requirements/recommendations", headers=headers)
    print(f"Recommendations Status: {r.status_code}")
    assert r.status_code == 200, f"Failed getting recommendations: {r.text}"
    rec_data = r.json()
    recs = rec_data.get("recommendations", [])
    print(f"Total Recommendations: {len(recs)}")
    for rec in recs:
        rec_mark = "[x] RECOMMENDED" if rec.get("recommended") else "[ ] OPTIONAL"
        print(f"  {rec_mark} {rec.get('approval_id')} ({rec.get('approval_name')}) -- Why: {rec.get('reason')}")

    rec_ids = [rec['approval_id'] for rec in recs if rec.get('recommended')]
    assert "FSSAI" in rec_ids, "FSSAI should be recommended for Food Processing!"
    assert "GST" in rec_ids, "GST should be recommended!"
    assert "UDYAM" in rec_ids, "UDYAM should be recommended!"
    
    # Verify Trademark is not recommended as mandatory
    tm_rec = next((rec for rec in recs if rec.get('approval_id') == 'TRADEMARK'), None)
    if tm_rec:
        assert not tm_rec.get("recommended"), "Trademark should NOT be automatically selected for food manufacturing!"

    # 4. Save User Approval Selection (FSSAI + GST + UDYAM)
    print("\n[STEP 4] Saving User Selection (FSSAI, GST, UDYAM)...")
    selected_approvals = ["FSSAI", "GST", "UDYAM"]
    r = requests.post(f"{BASE_URL}/requirements/approval-selections", headers=headers, json={"approval_ids": selected_approvals})
    print(f"Save Selection Status: {r.status_code}")
    assert r.status_code == 200

    # 5. Fetch Merged & Deduplicated Form Schema
    print("\n[STEP 5] Preparing Merged Form Schema (Deduplication + Prefill from Profile)...")
    prep_payload = {
        "business_profile_id": str(profile_data.get("id")),
        "approval_ids": selected_approvals
    }
    r = requests.post(f"{BASE_URL}/requirements/applications/prepare", headers=headers, json=prep_payload)
    print(f"Prepare Schema Status: {r.status_code}")
    assert r.status_code == 200
    form_prep = r.json()
    sections = form_prep.get("sections") or form_prep.get("merged_form", {}).get("sections", [])
    print(f"Merged Form Sections: {len(sections)}")
    
    total_fields = 0
    multi_used_fields = 0
    for sec in sections:
        fields = sec.get("fields", [])
        total_fields += len(fields)
        print(f"\n  * Section: {sec.get('title')} ({len(fields)} fields)")
        for f in fields:
            used_by = f.get("used_by", [])
            if len(used_by) > 1:
                multi_used_fields += 1
            clean_label = str(f.get('label', '')).encode('ascii', 'replace').decode('ascii')
            print(f"    - {clean_label} [ID: {f.get('id')}] | Used By: {', '.join(used_by)} | Value: {f.get('default_value')}")

    print(f"\nTotal Merged Fields: {total_fields}, Multi-Portal Shared Fields: {multi_used_fields}")
    assert multi_used_fields > 0, "Deduplication engine must detect shared fields across FSSAI, GST, and UDYAM!"

    # 6. Unified Headless Submission
    print("\n[STEP 6] Executing Unified Submission to Mock Portals (FSSAI, GST, UDYAM)...")
    submit_payload = {
        "business_profile_id": str(profile_data.get("id")),
        "approval_ids": selected_approvals,
        "canonical_data": {
            "applicant_name": "Rahul Sharma",
            "applicant_mobile": "9876543210",
            "applicant_email": email,
            "applicant_pan": "AAACA1234F",
            "applicant_aadhaar": "234567890123",
            "applicant_gender": "Male",
            "business_name": "ABC Foods Pvt Ltd",
            "legal_business_name": "ABC Foods Private Limited",
            "trade_name": "ABC Crunchies",
            "business_type": "Private Limited Company",
            "organization_type": "Private Limited Company",
            "industry": "Food & Food Processing",
            "business_activity": "Packaged Snack Manufacturing",
            "state": "Tamil Nadu",
            "district": "Salem",
            "pincode": "636001",
            "business_address": "Plot 42, SIDCO Industrial Estate, Salem",
            "investment": 50000000.0,
            "expected_turnover": 150000000.0,
            "employee_count": 100,
            "project_stage": "New Business",
            "food_category": "Snacks & Savouries",
            "food_product_name": "Roasted Spiced Banana Chips",
            "food_business_type": "Manufacturing",
            "installed_capacity": "5000 MT/annum",
            "authorized_signatory_name": "Rahul Sharma",
            "authorized_signatory_designation": "Managing Director",
            "constitution_of_business": "Private Limited Company",
            "enterprise_type": "Small Enterprise",
            "major_activity": "Manufacturing",
            "nic_2digit_code": "10",
            "nic_5digit_code": "10799"
        }
    }
    r = requests.post(f"{BASE_URL}/requirements/applications/unified-submit", headers=headers, json=submit_payload)
    print(f"Submit Status: {r.status_code}")
    assert r.status_code == 200
    submit_res = r.json()
    print(f"Parent Journey ID: {submit_res.get('journey_id')}")
    print(f"Summary: {submit_res.get('summary')}")
    for app in submit_res.get("applications", []):
        print(f"  -> Approval: {app.get('approval_id')} | Status: {app.get('status')} | Ext ID: {app.get('external_application_id')}")

    # 7. Dynamic Control Center Dashboard Verification
    print("\n[STEP 7] Verifying Dynamic Dashboard API returns only user's active approvals...")
    r = requests.get(f"{BASE_URL}/requirements/dashboard/my-approvals", headers=headers)
    print(f"Dashboard Status: {r.status_code}")
    assert r.status_code == 200
    dash_data = r.json()
    user_apps = dash_data.get("applications", [])
    print(f"Dashboard Applications Count: {len(user_apps)}")
    app_ids = [a.get("approval_id") for a in user_apps]
    print(f"Active approvals on dashboard: {app_ids}")
    assert "FSSAI" in app_ids and "GST" in app_ids and "UDYAM" in app_ids
    assert "TRADEMARK" not in app_ids, "Trademark must NOT appear on dashboard because it was not selected!"

    print("\n" + "=" * 60)
    print(" ALL 7 E2E STEPS PASSED SUCCESSFULLY! TASKER ARCHITECTURE VERIFIED!")
    print("=" * 60)

if __name__ == "__main__":
    run_e2e_test()
