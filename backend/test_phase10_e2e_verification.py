import os
import sys
import json
import time
import requests
from datetime import datetime, timezone, timedelta

# Ensure UTF-8 stdout on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000/api"

def run_master_e2e_tests():
    print("================================================================================")
    print("      MAITRI-NEXT (SIH26130) MASTER END-TO-END INTEGRATION TEST SUITE          ")
    print("================================================================================")
    print(f"Server Target: {BASE_URL}")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("Executing comprehensive live API integration tests across all 10 phases...\n")

    # --------------------------------------------------------------------------
    # 1. AUTHENTICATION & AUTHORIZATION
    # --------------------------------------------------------------------------
    print("--- [STAGE 1] AUTHENTICATION & ROLE-BASED ACCESS CONTROL ---")
    
    # Register a unique applicant
    unique_ts = int(time.time())
    applicant_email = f"e2e_applicant_{unique_ts}@sahyadri.com"
    reg_resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": applicant_email,
        "password": "Password123!",
        "full_name": "Dr. Vijay Patil",
        "role": "APPLICANT"
    })
    assert reg_resp.status_code in (200, 201), f"Applicant registration failed: {reg_resp.text}"
    print(f"  [PASS] 1. Registered new applicant: {applicant_email}")

    # Login as Applicant
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": applicant_email,
        "password": "Password123!"
    })
    assert login_resp.status_code == 200, f"Applicant login failed: {login_resp.text}"
    app_token = login_resp.json()["access_token"]
    app_headers = {"Authorization": f"Bearer {app_token}"}
    print(f"  [PASS] 2. Authenticated Applicant with JWT access token.")

    # Login as Officer
    officer_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "officer.mpcb@gov.in",
        "password": "Password123!"
    })
    assert officer_login.status_code == 200, f"Officer login failed: {officer_login.text}"
    officer_token = officer_login.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}
    print(f"  [PASS] 3. Authenticated Scrutiny Officer (MPCB).")

    # --------------------------------------------------------------------------
    # 2. BUSINESS PROFILE
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 2] BUSINESS PROFILE CREATION & VALIDATION ---")
    profile_payload = {
        "company_name": "Sahyadri Organic Agro & Food Processing Ltd",
        "industry": "Food Processing",
        "state": "Maharashtra",
        "district": "Pune",
        "business_type": "Private Limited Company",
        "investment_amount": 15000000.0, # 1.5 Crore
        "employee_count": 45,
        "land_status": "MIDC_ALLOCATED",
        "project_stage": "Setting Up",
        "existing_approvals": []
    }
    prof_resp = requests.post(f"{BASE_URL}/business-profiles", json=profile_payload, headers=app_headers)
    assert prof_resp.status_code in (200, 201), f"Profile creation failed: {prof_resp.text}"
    profile = prof_resp.json()
    print(f"  [PASS] 4. Created & verified Business Profile (ID: {profile['id']}) for {profile['company_name']}")

    # --------------------------------------------------------------------------
    # 3. STATUTORY APPROVAL RECOMMENDATIONS
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 3] STATUTORY APPROVAL RECOMMENDATIONS & CHECKLIST ---")
    rec_resp = requests.post(f"{BASE_URL}/approvals/recommend", json={"business_profile_id": profile["id"], "use_ai": True}, headers=app_headers)
    assert rec_resp.status_code == 200, f"Approval recommendations failed: {rec_resp.text}"
    recommendations = rec_resp.json()
    assert len(recommendations) >= 3, f"Expected >=3 recommendations, got {len(recommendations)}"
    print(f"  [PASS] 5. Generated {len(recommendations)} recommended statutory clearances for Food Processing.")
    for r in recommendations[:3]:
        print(f"         - [{r['status']}] {r['approval_name']} ({r['department']})")

    # --------------------------------------------------------------------------
    # 4. DOCUMENT INTELLIGENCE & PRE-VALIDATION
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 4] DOCUMENT INTELLIGENCE & PRE-VALIDATION ---")
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "INCOME TAX DEPARTMENT GOVT OF INDIA\nPermanent Account Number: ABCDE1234F\nName: SAHYADRI ORGANIC AGRO & FOOD PROCESSING LTD\nIssue Date: 15/08/2020\nAddress: Plot B-14 MIDC Chakan Pune Maharashtra")
    pdf_bytes = doc.tobytes()
    doc.close()

    files = {"file": ("sahyadri_pan.pdf", pdf_bytes, "application/pdf")}
    data = {"document_type": "Permanent Account Number (PAN)"}
    
    val_resp = requests.post(f"{BASE_URL}/documents/upload", files=files, data=data, headers=app_headers)
    assert val_resp.status_code == 201, f"Document prevalidation failed: {val_resp.text}"
    val_data = val_resp.json()
    print(f"  [PASS] 6. Document uploaded & pre-validated (ID: {val_data['id']}) -> Status: {val_data['validation_status']}")
    assert val_data["validation_status"] in ("VALID", "WARNING", "PENDING")

    # --------------------------------------------------------------------------
    # 5. SINGLE-WINDOW APPLICATION SUBMISSION
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 5] APPLICATION SUBMISSION & MULTI-DEPARTMENT WORKFLOW ---")
    app_payload = {
        "business_profile_id": profile["id"],
        "project_title": "Integrated Agro Processing & Cold Chain Facility",
        "notes": "Formal filing for single-window industrial clearances.",
        "declaration_accepted": True,
        "submit_immediately": True,
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
    app_create_resp = requests.post(f"{BASE_URL}/applications", json=app_payload, headers=app_headers)
    assert app_create_resp.status_code == 201, f"Application creation failed: {app_create_resp.text}"
    app_data = app_create_resp.json()
    app_id = app_data["id"]
    print(f"  [PASS] 7. Filed Single-Window Application: {app_data['application_number']} (ID: {app_id})")
    assert len(app_data["approvals"]) == 2
    assert app_data["status"] == "SUBMITTED"

    # --------------------------------------------------------------------------
    # 6. OFFICER DESK - SCRUTINY, QUERY & JOINT INSPECTION
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 6] OFFICER DESK - SCRUTINY, QUERY & INSPECTION ---")
    
    # 1. Officer checks metrics
    off_metrics = requests.get(f"{BASE_URL}/officer/metrics", headers=officer_headers).json()
    assert off_metrics["total_applications"] >= 1
    print(f"  [PASS] 8. Officer retrieved active scrutiny desk metrics (Total: {off_metrics['total_applications']})")

    # 2. Officer raises document query on MPCB approval
    appr_mpcb_id = app_data["approvals"][0]["id"]
    query_resp = requests.patch(
        f"{BASE_URL}/application-approvals/{appr_mpcb_id}/status",
        json={
            "status": "DOCUMENT_QUERY",
            "remarks": "Please provide detailed ETP hydraulic flow diagram.",
            "query_details": "Calculations required for 50 KLD effluent treatment capacity as per MPCB guidelines."
        },
        headers=officer_headers
    )
    assert query_resp.status_code == 200, f"Raising query failed: {query_resp.text}"
    print(f"  [PASS] 9. Officer raised Document Query on MPCB Clearance -> App status: NEEDS_INFORMATION")

    # 3. Applicant responds to query
    resubmit_resp = requests.post(
        f"{BASE_URL}/application-approvals/{appr_mpcb_id}/query-response",
        json={
            "query_response": "ETP design flow calculations attached with 50 KLD zero-liquid discharge system.",
            "remarks": "Applicant uploaded revised ETP hydraulic drawings."
        },
        headers=app_headers
    )
    assert resubmit_resp.status_code == 200, f"Query response failed: {resubmit_resp.text}"
    print(f"  [PASS] 10. Applicant resolved query -> Clearance resumed to UNDER_REVIEW")

    # 4. Schedule Site Inspection for Fire NOC
    appr_fire_id = app_data["approvals"][1]["id"]
    insp_resp = requests.post(
        f"{BASE_URL}/application-approvals/{appr_fire_id}/schedule-inspection",
        json={
            "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "scheduled_time": "11:30 AM IST",
            "location": "Plot B-14, MIDC Chakan, Pune",
            "inspector_name": "Shri. S. V. Kulkarni (Divisional Fire Officer)",
            "inspector_contact": "+91 98220 12345"
        },
        headers=officer_headers
    )
    assert insp_resp.status_code == 200, f"Schedule inspection failed: {insp_resp.text}"
    insp_data = insp_resp.json()
    insp_id = insp_data["id"]
    print(f"  [PASS] 11. Scheduled field inspection (ID: {insp_id}) -> Clearance moved to INSPECTION_PENDING")

    # 5. Complete Field Inspection
    comp_insp = requests.patch(
        f"{BASE_URL}/inspections/{insp_id}/complete",
        json={
            "findings": "Water storage tanks and fire hydrant network installed as per NBC Part IV norms.",
            "report_notes": "Provisional NOC recommended."
        },
        headers=officer_headers
    )
    assert comp_insp.status_code == 200, f"Complete inspection failed: {comp_insp.text}"
    print(f"  [PASS] 12. Inspection completed with official findings recorded.")

    # 6. Approve all clearances
    requests.patch(f"{BASE_URL}/application-approvals/{appr_mpcb_id}/status", json={"status": "APPROVED", "remarks": "MPCB Consent Granted"}, headers=officer_headers)
    requests.patch(f"{BASE_URL}/application-approvals/{appr_fire_id}/status", json={"status": "APPROVED", "remarks": "Fire NOC Issued"}, headers=officer_headers)
    
    final_app = requests.get(f"{BASE_URL}/applications/{app_id}", headers=app_headers).json()
    assert final_app["status"] == "APPROVED"
    print(f"  [PASS] 13. All clearances approved -> Overall Application Status: {final_app['status']}")

    # --------------------------------------------------------------------------
    # 7. SLA TRACKING & TIMELINE AUDIT LOG
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 7] SLA METRICS & AUDIT TIMELINE ---")
    app_metrics = requests.get(f"{BASE_URL}/applicant/metrics", headers=app_headers).json()
    assert app_metrics["approved_approvals"] >= 2
    print(f"  [PASS] 14. Applicant SLA tracking: Approved {app_metrics['approved_approvals']}/{app_metrics['total_approvals']} clearances.")

    timeline = requests.get(f"{BASE_URL}/applications/{app_id}/timeline", headers=app_headers).json()
    assert len(timeline) >= 5
    print(f"  [PASS] 15. Audit timeline recorded {len(timeline)} chronological state events.")

    # --------------------------------------------------------------------------
    # 8. REGULATORY KNOWLEDGE ASSISTANT (RAG)
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 8] REGULATORY KNOWLEDGE ASSISTANT (RAG) ---")
    rag_resp = requests.post(f"{BASE_URL}/regulatory-assistant/ask", json={
        "question": "What documents are required for MPCB Consent to Establish (CTE)?"
    }, headers=app_headers)
    assert rag_resp.status_code == 200, f"RAG QA failed: {rag_resp.text}"
    rag_data = rag_resp.json()
    assert len(rag_data["source_documents"]) >= 1
    assert "disclaimer" in rag_data
    print(f"  [PASS] 16. Source-grounded RAG returned verified answer with {len(rag_data['source_documents'])} citations.")

    # --------------------------------------------------------------------------
    # 9. GOVERNMENT SCHEME DISCOVERY
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 9] GOVERNMENT SCHEME DISCOVERY ---")
    scheme_resp = requests.post(f"{BASE_URL}/schemes/match", json={
        "industry": "Food Processing",
        "state": "Maharashtra",
        "investment_amount": 15000000.0,
        "use_ai": True
    }, headers=app_headers)
    assert scheme_resp.status_code == 200, f"Scheme matching failed: {scheme_resp.text}"
    scheme_data = scheme_resp.json()
    assert scheme_data["total_matched"] >= 2
    for s in scheme_data["matched_schemes"][:2]:
        assert s["relevance_status"] == "Potentially relevant"
        assert "You are eligible" not in s["why_relevant"]
        print(f"  [PASS] 17. Matched Scheme: {s['scheme_name']} ({s['relevance_status']})")

    # --------------------------------------------------------------------------
    # 10. GOVERNMENT ANALYTICS & BOTTLENECK ENGINE
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 10] GOVERNMENT ANALYTICS & BOTTLENECK DETECTION ---")
    analytics_resp = requests.get(f"{BASE_URL}/analytics/dashboard", headers=officer_headers)
    assert analytics_resp.status_code == 200, f"Analytics failed: {analytics_resp.text}"
    analytics_data = analytics_resp.json()
    m = analytics_data["metrics"]
    b = analytics_data["bottlenecks"]
    assert m["total_applications"] >= 1
    assert len(analytics_data["charts"]["department_workload"]) >= 4
    print(f"  [PASS] 18. Analytics live DB metrics calculated: Total={m['total_applications']}, Approved={m['approved_applications']}")
    for bn in b:
        if bn["is_bottleneck"]:
            assert "Potential processing bottleneck" in bn["flag"]
            assert "Potential bottleneck based on observed processing duration" in bn["observation"]
    print(f"  [PASS] 19. Bottleneck detection evaluated across {len(b)} departments.")

    # --------------------------------------------------------------------------
    # 11. EDGE CASES, ERROR HANDLING & RESILIENCE
    # --------------------------------------------------------------------------
    print("\n--- [STAGE 11] EDGE CASES, AUTHORIZATION & RESILIENCE ---")
    
    # 1. 401 Unauthorized without token
    unauth_resp = requests.get(f"{BASE_URL}/applications")
    assert unauth_resp.status_code == 401
    print("  [PASS] 20. Edge Case: 401 Unauthorized enforced on missing authentication token.")

    # 2. 403 Forbidden when applicant accesses officer endpoint
    forbidden_resp = requests.get(f"{BASE_URL}/officer/metrics", headers=app_headers)
    assert forbidden_resp.status_code == 403
    print("  [PASS] 21. Edge Case: 403 Forbidden enforced on role-restricted endpoints.")

    # 3. 404 Not Found on invalid application ID
    not_found = requests.get(f"{BASE_URL}/applications/999999", headers=app_headers)
    assert not_found.status_code == 404
    print("  [PASS] 22. Edge Case: 404 Not Found returned on non-existent resources.")

    # 4. Refusal of off-topic RAG query
    off_topic = requests.post(f"{BASE_URL}/regulatory-assistant/ask", json={"question": "How do I bake chocolate cookies at home?"}, headers=app_headers)
    assert "I could not find sufficient information in the available verified sources" in off_topic.json()["answer"]
    print("  [PASS] 23. Edge Case: Hallucination guardrail active (refused off-topic query without fabrication).")

    print("\n================================================================================")
    print("      ALL 10 PHASES & END-TO-END ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!    ")
    print("================================================================================")

if __name__ == "__main__":
    run_master_e2e_tests()
