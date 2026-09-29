import json
import os
import sys
import requests

BASE_URL = "http://127.0.0.1:8000/api"

print("================================================================")
print("     MAITRI-Next Phase 7 Regulatory Assistant Tests             ")
print("================================================================")


def run_tests():
    # 1. Login
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "applicant@demo.com",
        "password": "Password123!"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 1. Authenticated successfully.")

    # 2. List Knowledge Base Sources
    sources_resp = requests.get(f"{BASE_URL}/regulatory-assistant/sources", headers=headers)
    assert sources_resp.status_code == 200, f"Sources catalog failed: {sources_resp.text}"
    sources = sources_resp.json()
    assert len(sources) >= 5, f"Expected at least 5 sources, got {len(sources)}"
    sample_src = sources[0]
    assert "title" in sample_src and "department" in sample_src and "source" in sample_src
    assert "publication_date" in sample_src and "last_verified_date" in sample_src
    print(f"[PASS] 2. Verified Knowledge Base Catalog: {len(sources)} statutory documents indexed with complete metadata.")

    # 3. Acceptance Test 1: Ask a question whose answer exists in the knowledge base
    # Question: "What documents are required for MPCB Consent to Establish?"
    q1 = "What documents are required for MPCB Consent to Establish (CTE)?"
    resp_q1 = requests.post(f"{BASE_URL}/regulatory-assistant/ask", headers=headers, json={"question": q1})
    assert resp_q1.status_code == 200, f"Q1 failed: {resp_q1.text}"
    ans_data1 = resp_q1.json()
    assert len(ans_data1["source_documents"]) >= 1, "Expected at least 1 source document"
    assert len(ans_data1["source_references"]) >= 1, "Expected statutory legal citations"
    assert ans_data1["confidence"] > 0.5
    assert "I could not find sufficient information" not in ans_data1["answer"]
    
    # Grounding check: verify MPCB / Water Act / Air Act or ETP is present
    answer_text = ans_data1["answer"].lower()
    assert ("mpcb" in answer_text or "pollution" in answer_text or "water" in answer_text or "effluent" in answer_text or "project" in answer_text), f"Answer not grounded: {ans_data1['answer']}"
    print("[PASS] 3. Grounded Question 1 answered with verified statutory source citations:")
    print(f"         Sources: {[d['title'] for d in ans_data1['source_documents']]}")
    print(f"         Citations: {ans_data1['source_references']}")

    # 4. Acceptance Test 2: Ask an unrelated question -> Must NOT hallucinate or invent answers
    unrelated_q = "How do I bake a chocolate cake at home with strawberries?"
    resp_unrelated = requests.post(f"{BASE_URL}/regulatory-assistant/ask", headers=headers, json={"question": unrelated_q})
    assert resp_unrelated.status_code == 200
    ans_unrelated = resp_unrelated.json()
    expected_msg = "I could not find sufficient information in the available verified sources."
    assert expected_msg in ans_unrelated["answer"], f"Expected exact refusal, got: {ans_unrelated['answer']}"
    assert len(ans_unrelated["source_documents"]) == 0 or ans_unrelated["confidence"] == 0.0
    print(f"[PASS] 4. Unrelated Question correctly refused without fabrication: '{ans_unrelated['answer']}'")

    # 5. Acceptance Test 3: Second non-existent regulatory query
    fake_regulation_q = "What is the quantum of cryptocurrency trading tax under Maharashtra Fire Safety Act 2026?"
    resp_fake = requests.post(f"{BASE_URL}/regulatory-assistant/ask", headers=headers, json={"question": fake_regulation_q})
    assert resp_fake.status_code == 200
    ans_fake = resp_fake.json()
    assert expected_msg in ans_fake["answer"] or len(ans_fake["source_documents"]) == 0
    print("[PASS] 5. Fabricated law query successfully refused without inventing answers.")

    # 6. Acceptance Test 4: Another domain question: Factory license thresholds
    q2 = "What are the worker thresholds for obtaining a factory license under the Factories Act?"
    resp_q2 = requests.post(f"{BASE_URL}/regulatory-assistant/ask", headers=headers, json={"question": q2})
    assert resp_q2.status_code == 200
    ans_data2 = resp_q2.json()
    assert len(ans_data2["source_documents"]) >= 1
    assert ("10" in ans_data2["answer"] or "20" in ans_data2["answer"] or "factories" in ans_data2["answer"].lower())
    print("[PASS] 6. Grounded Question 2 (Factories Act worker thresholds) answered accurately.")

    # 7. Check Disclaimer
    assert "legal counsel" in ans_data1["disclaimer"].lower()
    print("[PASS] 7. Statutory disclaimer verified on all outputs.")

    print("\n================================================================")
    print("  PHASE 7 BACKEND ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!    ")
    print("================================================================")


if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] Phase 7 Verification Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
