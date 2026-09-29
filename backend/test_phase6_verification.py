import json
import os
import sys
import requests

BASE_URL = "http://127.0.0.1:8000/api"

print("================================================================")
print("     MAITRI-Next Phase 6 SLA & Inspections Verification Suite   ")
print("================================================================")


def run_tests():
    # 1. Login as Applicant & Officers
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "applicant@demo.com",
        "password": "Password123!"
    })
    assert resp.status_code == 200, f"Applicant login failed: {resp.text}"
    app_token = resp.json()["access_token"]
    app_headers = {"Authorization": f"Bearer {app_token}"}
    print("[PASS] 1. Applicant authenticated.")

    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "officer.mpcb@gov.in",
        "password": "Password123!"
    })
    assert resp.status_code == 200, f"Officer login failed: {resp.text}"
    officer_token = resp.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}
    print("[PASS] 2. Scrutiny Officer authenticated.")

    # 2. Ensure Business Profile exists
    prof_resp = requests.get(f"{BASE_URL}/business-profiles/me", headers=app_headers)
    assert prof_resp.status_code == 200, f"Profile check failed: {prof_resp.text}"
    profile = prof_resp.json()
    print(f"[PASS] 3. Profile verified for {profile['company_name']}.")

    # 3. Acceptance Test 1: Create an application with an approaching deadline -> Dashboard must show AT_RISK
    # simulated_days_remaining=2 triggers AT_RISK status (days_remaining <= 3)
    app_payload = {
        "business_profile_id": profile["id"],
        "project_title": "Agro Processing Unit - Expedited Commissioning Track",
        "notes": "Fast-track industrial clearance filed.",
        "declaration_accepted": True,
        "submit_immediately": True,
        "simulated_days_remaining": 2,  # 2 days remaining -> AT_RISK
        "approvals": [
            {
                "approval_id": "ENV-CTE-01",
                "approval_name": "Consent to Establish (CTE) - Orange Category",
                "department_code": "MPCB"
            },
            {
                "approval_id": "FIRE-NOC-01",
                "approval_name": "Provisional Fire Safety NOC",
                "department_code": "FIRE"
            }
        ]
    }
    create_resp = requests.post(f"{BASE_URL}/applications", headers=app_headers, json=app_payload)
    assert create_resp.status_code == 201, f"Create application failed: {create_resp.text}"
    app_data = create_resp.json()
    app_id = app_data["id"]
    app_num = app_data["application_number"]

    # Verify calculated SLA fields on application and child approvals
    assert app_data["sla_status"] == "AT_RISK", f"Expected AT_RISK, got {app_data['sla_status']}"
    assert app_data["days_remaining"] <= 3, f"Expected days_remaining <= 3, got {app_data['days_remaining']}"
    print(f"[PASS] 4. Application {app_num} created with approaching deadline -> SLA Status: {app_data['sla_status']} ({app_data['days_remaining']} days remaining).")

    # 4. Check Applicant Dashboard metrics API
    app_metrics = requests.get(f"{BASE_URL}/applicant/metrics", headers=app_headers).json()
    assert app_metrics["overall_sla_status"] in ["AT_RISK", "APPROACHING", "OVERDUE"], f"Unexpected applicant SLA: {app_metrics}"
    assert app_metrics["total_applications"] >= 1
    print(f"[PASS] 5. Applicant dashboard metrics calculated: overall_sla_status={app_metrics['overall_sla_status']}, total_apps={app_metrics['total_applications']}.")

    # 5. Check Officer Dashboard metrics API
    off_metrics = requests.get(f"{BASE_URL}/officer/metrics", headers=officer_headers).json()
    assert off_metrics["at_risk_sla_count"] >= 1, f"Expected at least 1 AT_RISK application, found {off_metrics['at_risk_sla_count']}"
    assert off_metrics["pending_count"] >= 1
    print(f"[PASS] 6. Officer dashboard metrics calculated: at_risk_sla_count={off_metrics['at_risk_sla_count']}, pending_count={off_metrics['pending_count']}.")

    # 6. Acceptance Test 2: Implement Inspection Scheduling (date, time, department, officer, location, status)
    approval_to_inspect = app_data["approvals"][0]
    insp_payload = {
        "scheduled_date": "2026-10-02T10:30:00Z",
        "scheduled_time": "10:30 AM IST",
        "location": f"Plot No. 44, MIDC Kurkumbh Industrial Area, {profile['district']}",
        "inspector_name": "Dr. Ananya Deshmukh (Regional Officer)",
        "inspector_contact": "+91 98200 54321",
        "report_notes": "Effluent treatment plant layout and stack emission sampling verification."
    }
    insp_resp = requests.post(
        f"{BASE_URL}/application-approvals/{approval_to_inspect['id']}/schedule-inspection",
        headers=officer_headers,
        json=insp_payload
    )
    assert insp_resp.status_code == 200, f"Schedule inspection failed: {insp_resp.text}"
    inspection = insp_resp.json()
    insp_id = inspection["id"]
    assert inspection["status"] == "SCHEDULED"
    assert inspection["inspector_name"] == insp_payload["inspector_name"]
    assert inspection["scheduled_time"] == "10:30 AM IST"
    assert "Plot No. 44" in inspection["location"]
    print(f"[PASS] 7. Inspection scheduled with location, time, and designated officer: ID={insp_id}, Time={inspection['scheduled_time']}, Status={inspection['status']}.")

    # 7. Verify Approval Workflow Status changed to INSPECTION_PENDING
    app_refreshed = requests.get(f"{BASE_URL}/applications/{app_id}", headers=app_headers).json()
    inspected_appr = next(a for a in app_refreshed["approvals"] if a["id"] == approval_to_inspect["id"])
    assert inspected_appr["status"] == "INSPECTION_PENDING", f"Expected INSPECTION_PENDING, got {inspected_appr['status']}"
    print(f"[PASS] 8. Department clearance moved to {inspected_appr['status']}.")

    # 8. Acceptance Test 3: Applicant sees inspection schedule & Officer sees pending inspections
    # Check Applicant view
    app_metrics_after_insp = requests.get(f"{BASE_URL}/applicant/metrics", headers=app_headers).json()
    assert len(app_metrics_after_insp["upcoming_inspections"]) >= 1, "Applicant should see upcoming inspection"
    print(f"[PASS] 9. Applicant portal retrieved upcoming inspection schedule ({len(app_metrics_after_insp['upcoming_inspections'])} active).")

    # Check Officer view
    off_metrics_after_insp = requests.get(f"{BASE_URL}/officer/metrics", headers=officer_headers).json()
    assert off_metrics_after_insp["inspection_pending_count"] >= 1
    assert len(off_metrics_after_insp["active_inspections"]) >= 1
    print(f"[PASS] 10. Officer portal retrieved active inspection queue (Pending count: {off_metrics_after_insp['inspection_pending_count']}).")

    # 9. List inspections endpoint
    inspections_list = requests.get(f"{BASE_URL}/inspections", headers=officer_headers).json()
    assert any(i["id"] == insp_id for i in inspections_list)
    print(f"[PASS] 11. GET /api/inspections verified ({len(inspections_list)} scheduled inspections total).")

    # 10. Officer completes inspection & records findings
    comp_resp = requests.patch(
        f"{BASE_URL}/inspections/{insp_id}/complete",
        headers=officer_headers,
        json={
            "findings": "Zero Liquid Discharge (ZLD) effluent plant confirmed compliant with CPCB standards.",
            "report_notes": "Recommended for full operational consent."
        }
    )
    assert comp_resp.status_code == 200, f"Complete inspection failed: {comp_resp.text}"
    print("[PASS] 12. Inspection completed with technical findings.")

    # 11. Grant approvals and verify SLA status transitions to COMPLETED
    for appr in app_data["approvals"]:
        requests.patch(
            f"{BASE_URL}/application-approvals/{appr['id']}/status",
            headers=officer_headers,
            json={"status": "APPROVED", "remarks": "Clearance granted."}
        )
    
    app_final = requests.get(f"{BASE_URL}/applications/{app_id}", headers=app_headers).json()
    assert app_final["status"] == "APPROVED"
    assert app_final["sla_status"] == "COMPLETED", f"Expected SLA COMPLETED, got {app_final['sla_status']}"
    print(f"[PASS] 13. Clearances APPROVED -> Application SLA Status transitioned to {app_final['sla_status']}.")

    # 12. Verify Timeline Visualization API
    timeline = requests.get(f"{BASE_URL}/applications/{app_id}/timeline", headers=app_headers).json()
    assert len(timeline) >= 5, f"Expected at least 5 timeline events, found {len(timeline)}"
    print(f"[PASS] 14. Timeline visualization verified with {len(timeline)} logged events.")

    print("\n================================================================")
    print("  PHASE 6 BACKEND ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!    ")
    print("================================================================")


if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] Phase 6 Verification Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
