"""
Phase 1 Complete Verification Test Suite for SIH26130
Tests:
1. Health check API (GET /api/health)
2. Database connectivity
3. Registration (POST /api/v1/auth/register)
4. Login (POST /api/v1/auth/login)
5. JWT token generation and validation
6. Applicant route protection (APPLICANT access 200, OFFICER access 403)
7. Officer route protection (OFFICER access 200, APPLICANT access 403)
8. Unauthenticated access protection (401 Unauthorized)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import check_db_connection

client = TestClient(app)

def run_phase1_tests():
    print("=" * 60)
    print("SIH26130 Phase 1 Verification Test Suite")
    print("=" * 60)

    # 1. Database Connection Test
    print("\n[1] Verifying Database Connection...")
    db_connected = check_db_connection()
    assert db_connected is True, "Database connection check failed!"
    print("    [PASS] Database connected successfully to PostgreSQL.")

    # 2. Health Check API (GET /api/health)
    print("\n[2] Verifying GET /api/health...")
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200, f"Expected 200, got {health_resp.status_code}"
    health_json = health_resp.json()
    assert health_json["status"] == "healthy", f"Expected healthy, got {health_json['status']}"
    assert health_json["database"] == "connected", f"Expected connected, got {health_json['database']}"
    print(f"    [PASS] Status: {health_json['status']} | Database: {health_json['database']}")
    print(f"    [PASS] Service: {health_json['service']}")

    # 3. Registration Test
    print("\n[3] Verifying User Registration (POST /api/v1/auth/register)...")
    test_applicant_email = f"test_applicant_{os.getpid()}@industry.com"
    reg_payload = {
        "email": test_applicant_email,
        "password": "SecurePassword123!",
        "full_name": "Test Industrialist",
        "role": "APPLICANT",
        "phone": "+91 9988776655"
    }
    reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201, f"Registration failed with code {reg_resp.status_code}: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert "access_token" in reg_data, "No access_token returned on registration"
    assert reg_data["user"]["role"] == "APPLICANT"
    print(f"    [PASS] Registered new user: {reg_data['user']['email']} (ID: {reg_data['user']['id']})")
    print(f"    [PASS] Returned JWT access_token: {reg_data['access_token'][:20]}...")

    # 4. Login Test (Applicant)
    print("\n[4] Verifying User Login (POST /api/v1/auth/login)...")
    login_resp = client.post("/api/v1/auth/login", json={
        "email": test_applicant_email,
        "password": "SecurePassword123!"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    applicant_token = login_resp.json()["access_token"]
    print(f"    [PASS] Login successful. Generated JWT Bearer Token.")

    # Login as seeded Officer
    officer_login_resp = client.post("/api/v1/auth/login", json={
        "email": "officer.mpcb@gov.in",
        "password": "Password123!"
    })
    assert officer_login_resp.status_code == 200, f"Officer login failed: {officer_login_resp.text}"
    officer_token = officer_login_resp.json()["access_token"]
    print(f"    [PASS] Officer login successful for officer.mpcb@gov.in.")

    # 5. Route Protection & RBAC: Applicant Dashboard
    print("\n[5] Verifying Applicant Route Protection (GET /api/v1/applicant/dashboard)...")
    # Case A: Unauthenticated
    unauth_resp = client.get("/api/v1/applicant/dashboard")
    assert unauth_resp.status_code == 401, f"Expected 401, got {unauth_resp.status_code}"
    print("    [PASS] Unauthenticated request rejected with HTTP 401.")

    # Case B: Authenticated as APPLICANT
    applicant_headers = {"Authorization": f"Bearer {applicant_token}"}
    auth_applicant_resp = client.get("/api/v1/applicant/dashboard", headers=applicant_headers)
    assert auth_applicant_resp.status_code == 200, f"Expected 200, got {auth_applicant_resp.status_code}"
    print(f"    [PASS] Applicant granted access (200 OK): {auth_applicant_resp.json()['message']}")

    # Case C: Officer attempting to access Applicant route (strict RBAC check)
    officer_headers = {"Authorization": f"Bearer {officer_token}"}
    officer_on_applicant_resp = client.get("/api/v1/applicant/dashboard", headers=officer_headers)
    assert officer_on_applicant_resp.status_code == 403, f"Expected 403, got {officer_on_applicant_resp.status_code}"
    print("    [PASS] Officer correctly denied access to Applicant route with HTTP 403 Forbidden.")

    # 6. Route Protection & RBAC: Officer Dashboard
    print("\n[6] Verifying Officer Route Protection (GET /api/v1/officer/dashboard)...")
    # Case A: Applicant attempting to access Officer route
    applicant_on_officer_resp = client.get("/api/v1/officer/dashboard", headers=applicant_headers)
    assert applicant_on_officer_resp.status_code == 403, f"Expected 403, got {applicant_on_officer_resp.status_code}"
    print("    [PASS] Applicant correctly denied access to Officer route with HTTP 403 Forbidden.")

    # Case B: Authenticated as OFFICER
    auth_officer_resp = client.get("/api/v1/officer/dashboard", headers=officer_headers)
    assert auth_officer_resp.status_code == 200, f"Expected 200, got {auth_officer_resp.status_code}"
    print(f"    [PASS] Officer granted access (200 OK): {auth_officer_resp.json()['message']}")
    print(f"    [PASS] Department: {auth_officer_resp.json()['department']}")

    print("\n" + "=" * 60)
    print("ALL PHASE 1 VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_phase1_tests()
