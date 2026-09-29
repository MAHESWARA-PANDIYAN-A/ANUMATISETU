import sys
import uuid
import requests

BASE_URL = "http://127.0.0.1:8000"

def log_step(title):
    print(f"\n{'='*70}\n[TEST STEP] {title}\n{'='*70}")

def assert_res(cond, msg):
    if not cond:
        print(f"[-] FAILED: {msg}")
        sys.exit(1)
    print(f"[+] PASSED: {msg}")

def run_tests():
    session = requests.Session()
    session_b = requests.Session()
    session_officer = requests.Session()

    unique_id = uuid.uuid4().hex[:6]
    applicant_a_email = f"applicant_p2_{unique_id}@example.com"
    applicant_b_email = f"applicant_p2_b_{unique_id}@example.com"
    officer_email = f"officer_p2_{unique_id}@example.com"
    password = "SecurePassword@123"

    # Step 1: Register and Login Applicant A
    log_step("1. Register and Login Applicant A")
    res = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": applicant_a_email,
        "password": password,
        "full_name": f"Test Applicant A {unique_id}",
        "role": "APPLICANT"
    })
    assert_res(res.status_code in [200, 201], f"Applicant A registration status: {res.status_code}")
    token_a = res.json().get("access_token")
    assert_res(bool(token_a), "Applicant A received JWT access token")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Step 2: Register Applicant B and Officer for authorization boundary tests
    log_step("2. Setup Applicant B and Officer for Authorization Boundary Tests")
    res_b = session_b.post(f"{BASE_URL}/api/auth/register", json={
        "email": applicant_b_email,
        "password": password,
        "full_name": f"Test Applicant B {unique_id}",
        "role": "APPLICANT"
    })
    token_b = res_b.json().get("access_token")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    res_off = session_officer.post(f"{BASE_URL}/api/auth/register", json={
        "email": officer_email,
        "password": password,
        "full_name": f"Test Officer {unique_id}",
        "role": "OFFICER"
    })
    token_off = res_off.json().get("access_token")
    headers_off = {"Authorization": f"Bearer {token_off}"}

    # Step 3: Verify GET /api/business-profiles/me before profile creation (404)
    log_step("3. Verify GET /api/business-profiles/me returns 404 when profile not yet created")
    res = session.get(f"{BASE_URL}/api/business-profiles/me", headers=headers_a)
    assert_res(res.status_code == 404, f"GET /api/business-profiles/me returns 404: {res.status_code}")

    # Step 4: Security - Unauthenticated & Role Boundaries
    log_step("4. Security & Role Authorization Boundaries")
    res_unauth = session.get(f"{BASE_URL}/api/business-profiles/me")
    assert_res(res_unauth.status_code == 401, f"Unauthenticated request returns 401: {res_unauth.status_code}")

    res_off_post = session_officer.post(f"{BASE_URL}/api/business-profiles", headers=headers_off, json={
        "company_name": "Officer Corp",
        "business_type": "Private Limited (Pvt Ltd)",
        "industry": "Manufacturing",
        "state": "Maharashtra",
        "district": "Pune",
        "investment_amount": 1000000.0,
        "employee_count": 10,
        "project_stage": "Operational",
        "land_status": "Owned",
        "existing_approvals": []
    })
    assert_res(res_off_post.status_code == 403, f"Officer blocked from creating applicant profile (403): {res_off_post.status_code}")

    # Step 5: Input Validation Tests
    log_step("5. Input Validation & Constraints (HTTP 422)")
    # Invalid: negative investment amount
    res_inv1 = session.post(f"{BASE_URL}/api/business-profiles", headers=headers_a, json={
        "company_name": "Invalid Inc",
        "business_type": "Private Limited (Pvt Ltd)",
        "industry": "Manufacturing",
        "state": "Maharashtra",
        "district": "Pune",
        "investment_amount": -500.0,
        "employee_count": 10,
        "project_stage": "Operational",
        "land_status": "Owned",
        "existing_approvals": []
    })
    assert_res(res_inv1.status_code == 422, f"Negative investment amount rejected with 422: {res_inv1.status_code}")

    # Invalid: 0 employees
    res_inv2 = session.post(f"{BASE_URL}/api/business-profiles", headers=headers_a, json={
        "company_name": "Invalid Inc",
        "business_type": "Private Limited (Pvt Ltd)",
        "industry": "Manufacturing",
        "state": "Maharashtra",
        "district": "Pune",
        "investment_amount": 500000.0,
        "employee_count": 0,
        "project_stage": "Operational",
        "land_status": "Owned",
        "existing_approvals": []
    })
    assert_res(res_inv2.status_code == 422, f"Zero employee count rejected with 422: {res_inv2.status_code}")

    # Step 6: Create Valid Business Profile
    log_step("6. Create Valid Business Profile via POST /api/business-profiles")
    profile_payload = {
        "company_name": f"Sahyadri Agro Processing {unique_id} Ltd",
        "business_type": "Private Limited (Pvt Ltd)",
        "industry": "Agro-Processing & Food",
        "state": "Maharashtra",
        "district": "Pune",
        "investment_amount": 75000000.0,
        "employee_count": 85,
        "project_stage": "Under Construction",
        "land_status": "Government Allotted / MIDC",
        "existing_approvals": ["GST Registration", "MSME / Udyam Registration"]
    }
    res = session.post(f"{BASE_URL}/api/business-profiles", headers=headers_a, json=profile_payload)
    assert_res(res.status_code == 201, f"POST /api/business-profiles status: {res.status_code}")
    created_profile = res.json()
    assert_res(created_profile["company_name"] == profile_payload["company_name"], "Company name matches")
    assert_res(created_profile["investment_amount"] == 75000000.0, "Investment amount matches")
    assert_res(created_profile["employee_count"] == 85, "Employee count matches")
    assert_res("GST Registration" in created_profile["existing_approvals"], "Existing approvals persisted")
    profile_id = created_profile["id"]

    # Step 7: Duplicate Creation Conflict (409)
    log_step("7. Duplicate Creation returns 409 Conflict")
    res_dup = session.post(f"{BASE_URL}/api/business-profiles", headers=headers_a, json=profile_payload)
    assert_res(res_dup.status_code == 409, f"Duplicate profile creation returns 409 Conflict: {res_dup.status_code}")

    # Step 8: View Profile (GET /api/business-profiles/me)
    log_step("8. View Business Profile via GET /api/business-profiles/me")
    res_get = session.get(f"{BASE_URL}/api/business-profiles/me", headers=headers_a)
    assert_res(res_get.status_code == 200, f"GET /api/business-profiles/me status: {res_get.status_code}")
    fetched = res_get.json()
    assert_res(fetched["id"] == profile_id, "Fetched profile ID matches created ID")
    assert_res(fetched["district"] == "Pune", "District matches")
    assert_res(fetched["project_stage"] == "Under Construction", "Project stage matches")

    # Step 9: User Isolation (Applicant B cannot see Applicant A's profile)
    log_step("9. User Isolation - Applicant B receives 404 for their own profile")
    res_b_get = session_b.get(f"{BASE_URL}/api/business-profiles/me", headers=headers_b)
    assert_res(res_b_get.status_code == 404, f"Applicant B gets 404 for their own profile: {res_b_get.status_code}")

    # Step 10: Edit / Update Profile (PUT /api/business-profiles/me)
    log_step("10. Edit / Update Business Profile via PUT /api/business-profiles/me")
    update_payload = {
        "employee_count": 120,
        "project_stage": "Operational",
        "investment_amount": 95000000.0,
        "existing_approvals": ["GST Registration", "MSME / Udyam Registration", "Factory License", "CTE – MPCB"]
    }
    res_put = session.put(f"{BASE_URL}/api/business-profiles/me", headers=headers_a, json=update_payload)
    assert_res(res_put.status_code == 200, f"PUT /api/business-profiles/me status: {res_put.status_code}")
    updated = res_put.json()
    assert_res(updated["employee_count"] == 120, "Employee count updated to 120")
    assert_res(updated["project_stage"] == "Operational", "Project stage updated to Operational")
    assert_res(updated["investment_amount"] == 95000000.0, "Investment amount updated to 95000000.0")
    assert_res(len(updated["existing_approvals"]) == 4, "Existing approvals updated with new items")
    assert_res(updated["company_name"] == profile_payload["company_name"], "Unmodified company_name preserved")

    # Step 11: Re-fetch Profile (Persistence Confirmation)
    log_step("11. Re-fetch Profile to Confirm Persistence")
    res_final = session.get(f"{BASE_URL}/api/business-profiles/me", headers=headers_a)
    assert_res(res_final.status_code == 200, "Profile retrieved successfully after edit")
    final_data = res_final.json()
    assert_res(final_data["employee_count"] == 120, "Persisted employee_count is 120")
    assert_res(final_data["project_stage"] == "Operational", "Persisted project_stage is Operational")

    # Step 12: Verify Route Alias /api/v1/business-profiles/me
    log_step("12. Verify Route Alias /api/v1/business-profiles/me")
    res_v1 = session.get(f"{BASE_URL}/api/v1/business-profiles/me", headers=headers_a)
    assert_res(res_v1.status_code == 200, f"/api/v1 alias works cleanly: {res_v1.status_code}")

    print("\n" + "="*70)
    print("ALL PHASE 2 APPLICANT BUSINESS PROFILE TESTS PASSED SUCCESSFULLY!")
    print("="*70)

if __name__ == "__main__":
    run_tests()
