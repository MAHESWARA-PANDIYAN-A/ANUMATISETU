import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== Testing Personalized TASKER Assistant & Grok Integration ===")

    # 1. Login as demo applicant
    print("\n1. Authenticating as demo applicant...")
    login_res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": "applicant@demo.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Auth successful.")

    # 2. Test Next Action API
    print("\n2. Testing /api/assistant/next-action...")
    next_action_res = requests.get(f"{BASE_URL}/api/assistant/next-action", headers=headers)
    assert next_action_res.status_code == 200, f"Next action failed: {next_action_res.text}"
    na_data = next_action_res.json()
    print(f"✓ Next Action: {na_data.get('label')} (Priority: {na_data.get('priority')})")

    # 3. Test Chat with business context
    print("\n3. Testing /api/assistant/chat (Business questions)...")
    chat_payload = {
        "message": "What is my business name and which approvals have I selected?",
        "context": {
            "page": "dashboard"
        }
    }
    chat_res = requests.post(f"{BASE_URL}/api/assistant/chat", json=chat_payload, headers=headers)
    assert chat_res.status_code == 200, f"Chat failed: {chat_res.text}"
    chat_data = chat_res.json()
    assert chat_data.get("success") is True
    session_id = chat_data.get("session_id")
    answer = chat_data.get("message", {}).get("content", "")
    print(f"✓ Session ID: {session_id}")
    print(f"✓ Assistant Answer: {answer[:180]}...")

    # 4. Test Chat with missing document inquiry
    print("\n4. Testing Chat (Missing document inquiry)...")
    doc_chat_payload = {
        "session_id": session_id,
        "message": "What documents am I missing for my approvals?",
        "context": {
            "page": "document_center"
        }
    }
    doc_res = requests.post(f"{BASE_URL}/api/assistant/chat", json=doc_chat_payload, headers=headers)
    assert doc_res.status_code == 200, f"Doc chat failed: {doc_res.text}"
    doc_ans = doc_res.json().get("message", {}).get("content", "")
    print(f"✓ Assistant Answer: {doc_ans[:180]}...")

    # 5. Test Explain Document API
    print("\n5. Testing /api/assistant/explain-document...")
    explain_doc_res = requests.post(
        f"{BASE_URL}/api/assistant/explain-document?document_id=43",
        headers=headers
    )
    assert explain_doc_res.status_code == 200, f"Explain doc failed: {explain_doc_res.text}"
    exp_doc_ans = explain_doc_res.json().get("message", {}).get("content", "")
    print(f"✓ Document explanation: {exp_doc_ans[:180]}...")

    # 6. Test Explain Approval API
    print("\n6. Testing /api/assistant/explain-approval...")
    explain_app_res = requests.post(
        f"{BASE_URL}/api/assistant/explain-approval?approval_id=FSSAI",
        headers=headers
    )
    assert explain_app_res.status_code == 200, f"Explain approval failed: {explain_app_res.text}"
    exp_app_ans = explain_app_res.json().get("message", {}).get("content", "")
    sources = explain_app_res.json().get("sources", [])
    print(f"✓ Approval explanation: {exp_app_ans[:180]}...")
    print(f"✓ Sources returned: {len(sources)}")

    # 7. Test Regulatory Verified Knowledge Query
    print("\n7. Testing Regulatory Knowledge RAG Question...")
    reg_chat_payload = {
        "message": "What are the statutory requirements under Food Safety and Standards Act for manufacturing?",
        "context": {
            "page": "regulatory_assistant"
        }
    }
    reg_res = requests.post(f"{BASE_URL}/api/assistant/chat", json=reg_chat_payload, headers=headers)
    assert reg_res.status_code == 200, f"Regulatory chat failed: {reg_res.text}"
    reg_data = reg_res.json()
    reg_sources = reg_data.get("sources", [])
    print(f"✓ Regulatory Answer: {reg_data.get('message', {}).get('content', '')[:180]}...")
    print(f"✓ Grounded Sources: {len(reg_sources)} sources attached.")

    # 8. Test Session History API
    print("\n8. Testing /api/assistant/sessions and session messages...")
    sessions_res = requests.get(f"{BASE_URL}/api/assistant/sessions", headers=headers)
    assert sessions_res.status_code == 200, f"List sessions failed: {sessions_res.text}"
    sessions_list = sessions_res.json()
    assert len(sessions_list) > 0, "No sessions found."
    print(f"✓ User has {len(sessions_list)} active conversation session(s).")

    msgs_res = requests.get(f"{BASE_URL}/api/assistant/sessions/{session_id}", headers=headers)
    assert msgs_res.status_code == 200, f"Get messages failed: {msgs_res.text}"
    msgs = msgs_res.json()
    print(f"✓ Retrieved {len(msgs)} messages in session {session_id}.")

    print("\n==================================================")
    print("ALL PERSONALIZED TASKER ASSISTANT TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
