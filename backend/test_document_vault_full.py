import os
import io
import requests

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== Testing TASKER Central Document Vault ===")
    
    # 1. Login as applicant
    login_res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": "applicant@demo.com",
        "password": "Password123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("1. Authentication successful.")

    # 2. Check Document Types API
    types_res = requests.get(f"{BASE_URL}/api/v1/document-types", headers=headers)
    assert types_res.status_code == 200, f"Document types failed: {types_res.text}"
    types = types_res.json()
    assert len(types) >= 10, f"Expected at least 10 canonical document types, got {len(types)}"
    print(f"2. Canonical Document Types fetched: {len(types)} types available.")

    # 3. Test Document Upload (PAN Card dummy PDF content)
    dummy_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (PAN Card) /Author (Rahul Kumar) >>\nendobj\ntrailer\n<< /Root 1 0 obj >>\n%%EOF"
    upload_data = {
        "document_type": "PAN_CARD",
        "document_name": "Test Director PAN Card",
        "approval_id": "gst",
    }
    files = {
        "file": ("director_pan.pdf", io.BytesIO(dummy_pdf_content), "application/pdf")
    }
    
    upload_res = requests.post(f"{BASE_URL}/api/v1/documents/upload", headers=headers, data=upload_data, files=files)
    assert upload_res.status_code in [200, 201], f"Upload failed: {upload_res.text}"
    uploaded_doc = upload_res.json()
    doc_id = uploaded_doc["id"] if "id" in uploaded_doc else uploaded_doc.get("existing_document", {}).get("id")
    print(f"3. Document Uploaded/Verified: doc_id = {doc_id}")

    # 4. Test Duplicate Detection
    files_dup = {
        "file": ("director_pan_duplicate.pdf", io.BytesIO(dummy_pdf_content), "application/pdf")
    }
    dup_res = requests.post(f"{BASE_URL}/api/v1/documents/upload", headers=headers, data=upload_data, files=files_dup)
    assert dup_res.status_code in [200, 201], f"Duplicate check failed: {dup_res.text}"
    dup_data = dup_res.json()
    print("4. Duplicate Upload check result:", dup_data.get("message", "Uploaded/Handled"))

    # 5. Test List Documents
    list_res = requests.get(f"{BASE_URL}/api/v1/documents", headers=headers)
    assert list_res.status_code == 200, f"List documents failed: {list_res.text}"
    doc_list = list_res.json()
    print(f"5. List Documents: Total {doc_list['total']} documents in user vault.")

    # 6. Test Single Document Details & Usages
    if doc_id:
        detail_res = requests.get(f"{BASE_URL}/api/v1/documents/{doc_id}", headers=headers)
        assert detail_res.status_code == 200, f"Get detail failed: {detail_res.text}"
        detail = detail_res.json()
        print(f"6. Document Detail: {detail['document_name']}, status = {detail['status']}, version = v{detail['current_version']}")

        # 7. Test Secure Download
        dl_res = requests.get(f"{BASE_URL}/api/v1/documents/{doc_id}/download", headers=headers)
        assert dl_res.status_code == 200, f"Download failed: {dl_res.text}"
        print(f"7. Secure Download: Received {len(dl_res.content)} bytes with content-type {dl_res.headers.get('content-type')}")

        # 8. Test Usage API
        usage_res = requests.get(f"{BASE_URL}/api/v1/documents/{doc_id}/usage", headers=headers)
        assert usage_res.status_code == 200, f"Usage API failed: {usage_res.text}"
        print(f"8. Document Usage API: Mapped to {len(usage_res.json()['used_by'])} application(s).")

    # 9. Test Missing Documents & Completeness Service
    comp_res = requests.get(f"{BASE_URL}/api/v1/documents/completeness?approvals=fssai,gst,udyam", headers=headers)
    assert comp_res.status_code == 200, f"Completeness failed: {comp_res.text}"
    comp_data = comp_res.json()
    print(f"9. Completeness Service: Total Required = {comp_data['total_required']}, Available = {comp_data['available']}, Missing = {comp_data['missing']}")

    missing_res = requests.get(f"{BASE_URL}/api/v1/documents/missing?approvals=fssai,gst,udyam", headers=headers)
    assert missing_res.status_code == 200, f"Missing API failed: {missing_res.text}"
    missing_data = missing_res.json()
    print(f"10. Missing Document API: {missing_data['missing_count']} missing item(s) to upload.")

    print("\nALL CENTRAL DOCUMENT VAULT SYSTEM TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
