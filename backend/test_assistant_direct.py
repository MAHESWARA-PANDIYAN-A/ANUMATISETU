import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    print("=== Testing TASKER Assistant with Direct TestClient ===", flush=True)

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("1. Health Check: OK", flush=True)

    # 2. Login
    login_res = client.post("/api/v1/auth/login", json={
        "email": "applicant@demo.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("2. Authentication: OK", flush=True)

    # 3. Next Action
    na_res = client.get("/api/assistant/next-action", headers=headers)
    assert na_res.status_code == 200, f"Next action failed: {na_res.text}"
    print(f"3. Next Action: {na_res.json().get('label')} (Priority: {na_res.json().get('priority')})", flush=True)

    # 4. Chat - Business context
    chat_res = client.post("/api/assistant/chat", json={
        "message": "What is my business name and what approvals are selected?",
        "context": {"page": "dashboard"}
    }, headers=headers)
    assert chat_res.status_code == 200, f"Chat failed: {chat_res.text}"
    chat_data = chat_res.json()
    session_id = chat_data["session_id"]
    print(f"4. Chat Response (Session {session_id[:8]}...): {chat_data['message']['content'][:120]}...", flush=True)

    # 5. Chat - Missing docs
    doc_chat_res = client.post("/api/assistant/chat", json={
        "session_id": session_id,
        "message": "Which documents are missing?",
        "context": {"page": "document_center"}
    }, headers=headers)
    assert doc_chat_res.status_code == 200, f"Doc chat failed: {doc_chat_res.text}"
    print(f"5. Missing Docs Response: {doc_chat_res.json()['message']['content'][:120]}...", flush=True)

    # 6. Explain Approval
    exp_app_res = client.post(f"/api/assistant/explain-approval?approval_id=FSSAI&session_id={session_id}", headers=headers)
    assert exp_app_res.status_code == 200, f"Explain approval failed: {exp_app_res.text}"
    print(f"6. Explain Approval: {exp_app_res.json()['message']['content'][:120]}...", flush=True)

    # 7. Sessions list
    sess_res = client.get("/api/assistant/sessions", headers=headers)
    assert sess_res.status_code == 200, f"Sessions failed: {sess_res.text}"
    print(f"7. Active Sessions: {len(sess_res.json())} sessions found.", flush=True)

    print("\nALL DIRECT BACKEND TESTS PASSED SUCCESSFULLY!", flush=True)

if __name__ == "__main__":
    run_tests()
