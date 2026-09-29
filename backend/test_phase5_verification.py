import json
import os
import sys
import requests

BASE_URL = "http://127.0.0.1:8000/api"

print("================================================================")
print("     MAITRI-Next Phase 5 Workflow Verification Suite            ")
print("================================================================")


def run_tests():
    # 1. Login as Applicant
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "applicant@demo.com",
        "password": "Password123!"
    })
    assert resp.status_code == 200, f"Applicant login failed: {resp.text}"
    applicant_token = resp.json()["access_token"]
    app_headers = {"Authorization": f"Bearer {applicant_token}"}
    print("[PASS] 1. Applicant authenticated successfully.")

    # 2. Login as Officers
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "officer.mpcb@gov.in",
        "password": "Password123!"
    })
    assert resp.status_code == 200, f"MPCB Officer login failed: {resp.text}"
    mpcb_token = resp.json()["access_token"]
    mpcb_headers = {"Authorization": f"Bearer {mpcb_token}"}
    print("[PASS] 2. MPCB Officer authenticated.")

    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "cfo.fire@gov.in",
        "password": "Password123!"
    })
    assert resp.status_code == 200, f"Fire Officer login failed: {resp.text}"
    fire_token = resp.json()["access_token"]
    fire_headers = {"Authorization": f"Bearer {fire_token}"}
    print("[PASS] 3. Fire Officer authenticated.")

    # 3. Ensure Applicant has a Business Profile
    profile_resp = requests.get(f"{BASE_URL}/business-profiles/me", headers=app_headers)
    if profile_resp.status_code != 200:
        create_prof = requests.post(f"{BASE_URL}/business-profiles", headers=app_headers, json={
            "company_name": "Sunrise Organic Agro Foods Ltd",
            "business_type": "Private Limited Company",
            "industry": "Food Processing",
            "state": "Maharashtra",
            "district": "Pune",
            "investment_amount": 85000000.0,
            "employee_count": 85,
            "project_stage": "Pre-Construction",
            "land_status": "Allotted by MIDC",
            "existing_approvals": ["Incorporation Certificate"]
        })
        assert create_prof.status_code in [200, 201], f"Profile creation failed: {create_prof.text}"
        profile = create_prof.json()
    else:
        profile = profile_resp.json()
    print(f"[PASS] 4. Business Profile active: {profile['company_name']} (ID: {profile['id']})")

    # 4. Check Departments
    depts_resp = requests.get(f"{BASE_URL}/departments", headers=app_headers)
    assert depts_resp.status_code == 200, f"Get departments failed: {depts_resp.text}"
    depts = depts_resp.json()
    assert len(depts) >= 4, f"Expected at least 4 departments, found {len(depts)}"
    dept_codes = [d["code"] for d in depts]
    print(f"[PASS] 5. Configured Departments verified: {dept_codes}")

    # 5. File a new clearance Application with 3 statutory clearances
    app_payload = {
        "business_profile_id": profile["id"],
        "project_title": "Agro-Industrial Food Processing Facility Clearance Package",
        "notes": "Application filed with all statutory certifications.",
        "declaration_accepted": True,
        "submit_immediately": True,
        "approvals": [
            {
                "approval_id": "ENV-MPCB-CTE-01",
                "approval_name": "Consent to Establish (CTE) - Orange Category",
                "department_code": "MPCB"
            },
            {
                "approval_id": "FIRE-NOC-01",
                "approval_name": "Provisional Fire Safety NOC",
                "department_code": "FIRE"
            },
            {
                "approval_id": "LOCAL-PLAN-01",
                "approval_name": "MIDC Factory Building Blueprint Permission",
                "department_code": "LOCAL"
            }
        ]
    }
    create_app_resp = requests.post(f"{BASE_URL}/applications", headers=app_headers, json=app_payload)
    assert create_app_resp.status_code == 201, f"Create application failed: {create_app_resp.text}"
    application = create_app_resp.json()
    app_id = application["id"]
    app_num = application["application_number"]
    assert app_num.startswith("MAITRI-"), f"Unexpected app number format: {app_num}"
    assert application["status"] == "SUBMITTED", f"Unexpected status: {application['status']}"
    assert len(application["approvals"]) == 3, f"Expected 3 approvals, got {len(application['approvals'])}"
    print(f"[PASS] 6. Application created: {app_num} (Status: {application['status']})")

    # Map approval items by department code
    approvals_by_dept = {a["department_code"]: a for a in application["approvals"]}
    mpcb_appr = approvals_by_dept["MPCB"]
    fire_appr = approvals_by_dept["FIRE"]
    local_appr = approvals_by_dept["LOCAL"]

    # 6. List Applications for Applicant
    list_resp = requests.get(f"{BASE_URL}/applications", headers=app_headers)
    assert list_resp.status_code == 200
    apps_list = list_resp.json()
    assert any(a["id"] == app_id for a in apps_list)
    print(f"[PASS] 7. Application listed in applicant portal (Count: {len(apps_list)})")

    # 7. MPCB Officer updates status to UNDER_REVIEW
    patch_mpcb = requests.patch(
        f"{BASE_URL}/application-approvals/{mpcb_appr['id']}/status",
        headers=mpcb_headers,
        json={"status": "UNDER_REVIEW", "remarks": "Scrutiny of effluent treatment plant design commenced."}
    )
    assert patch_mpcb.status_code == 200, f"MPCB update failed: {patch_mpcb.text}"
    print("[PASS] 8. MPCB Officer moved CTE to UNDER_REVIEW.")

    # 8. Fire Officer raises a DOCUMENT_QUERY -> verify application becomes NEEDS_INFORMATION
    patch_fire_query = requests.patch(
        f"{BASE_URL}/application-approvals/{fire_appr['id']}/status",
        headers=fire_headers,
        json={
            "status": "DOCUMENT_QUERY",
            "query_details": "Please provide hydraulic calculation sheets for high-pressure hydrant network.",
            "remarks": "Hydrant calculation document missing from initial package."
        }
    )
    assert patch_fire_query.status_code == 200, f"Fire query failed: {patch_fire_query.text}"

    # Verify overall application status is now NEEDS_INFORMATION
    get_app = requests.get(f"{BASE_URL}/applications/{app_id}", headers=app_headers).json()
    assert get_app["status"] == "NEEDS_INFORMATION", f"Expected NEEDS_INFORMATION, got {get_app['status']}"
    print(f"[PASS] 9. Document Query raised by Fire dept -> Application status automatically updated to {get_app['status']}.")

    # 9. Applicant responds to DOCUMENT_QUERY
    query_resp = requests.post(
        f"{BASE_URL}/application-approvals/{fire_appr['id']}/query-response",
        headers=app_headers,
        json={"query_response": "Hydraulic calculations uploaded under document vault with 2000 LPM capacity."}
    )
    assert query_resp.status_code == 200, f"Query response failed: {query_resp.text}"
    
    get_app = requests.get(f"{BASE_URL}/applications/{app_id}", headers=app_headers).json()
    assert get_app["status"] == "UNDER_REVIEW", f"Expected UNDER_REVIEW, got {get_app['status']}"
    print(f"[PASS] 10. Applicant responded to query -> Status returned to {get_app['status']}.")

    # 10. Officer schedules Inspection for LOCAL department
    insp_resp = requests.post(
        f"{BASE_URL}/application-approvals/{local_appr['id']}/schedule-inspection",
        headers=mpcb_headers,
        json={
            "scheduled_date": "2026-10-05T10:00:00Z",
            "inspector_name": "Er. S. M. Jadhav (Town Planning)",
            "inspector_contact": "+91 98221 00112",
            "report_notes": "Site setback verification and boundary demarcations."
        }
    )
    assert insp_resp.status_code == 200, f"Schedule inspection failed: {insp_resp.text}"
    insp_data = insp_resp.json()
    insp_id = insp_data["id"]
    print(f"[PASS] 11. Site Inspection scheduled (ID: {insp_id}) by {insp_data['inspector_name']}.")

    # 11. Officer completes inspection
    comp_insp = requests.patch(
        f"{BASE_URL}/inspections/{insp_id}/complete",
        headers=mpcb_headers,
        json={
            "findings": "Front and rear setbacks conform to MIDC Development Control Regulations 2024.",
            "report_notes": "Clearance recommended."
        }
    )
    assert comp_insp.status_code == 200, f"Complete inspection failed: {comp_insp.text}"
    print("[PASS] 12. Inspection completed with technical findings.")

    # 12. Approve all 3 clearances
    # MPCB approves
    requests.patch(
        f"{BASE_URL}/application-approvals/{mpcb_appr['id']}/status",
        headers=mpcb_headers,
        json={"status": "APPROVED", "remarks": "CTE Granted with standard discharge norms."}
    )
    # Check partial approval status
    get_app = requests.get(f"{BASE_URL}/applications/{app_id}", headers=app_headers).json()
    assert get_app["status"] == "PARTIALLY_APPROVED", f"Expected PARTIALLY_APPROVED, got {get_app['status']}"
    print(f"[PASS] 13. MPCB Approved -> Application status: {get_app['status']}.")

    # Fire approves
    requests.patch(
        f"{BASE_URL}/application-approvals/{fire_appr['id']}/status",
        headers=fire_headers,
        json={"status": "APPROVED", "remarks": "Provisional Fire NOC Granted."}
    )
    # LOCAL approves
    requests.patch(
        f"{BASE_URL}/application-approvals/{local_appr['id']}/status",
        headers=mpcb_headers,
        json={"status": "APPROVED", "remarks": "Building blueprint sanctioned."}
    )

    # Final overall application status check
    get_app = requests.get(f"{BASE_URL}/applications/{app_id}", headers=app_headers).json()
    assert get_app["status"] == "APPROVED", f"Expected APPROVED, got {get_app['status']}"
    assert get_app["decision_at"] is not None, "Decision date must be recorded"
    print(f"[PASS] 14. All 3 clearances APPROVED -> Application status: {get_app['status']} (Decision recorded).")

    # 13. Audit Timeline Verification
    timeline_resp = requests.get(f"{BASE_URL}/applications/{app_id}/timeline", headers=app_headers)
    assert timeline_resp.status_code == 200
    timeline = timeline_resp.json()
    assert len(timeline) >= 6, f"Expected at least 6 timeline events, found {len(timeline)}"
    print(f"[PASS] 15. Audit Timeline verified with {len(timeline)} logged transitions.")

    print("\n================================================================")
    print("  PHASE 5 BACKEND ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!    ")
    print("================================================================")


if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] Phase 5 Verification Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
