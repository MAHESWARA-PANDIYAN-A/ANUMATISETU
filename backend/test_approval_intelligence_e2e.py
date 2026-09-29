import requests

BASE_URL = "http://127.0.0.1:8000"


def test_e2e():
    print("[1] Logging in as demo applicant (applicant@demo.com)...")
    login_res = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"email": "applicant@demo.com", "password": "Password123!"}
    )
    if login_res.status_code != 200:
        login_res = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "applicant@demo.com", "password": "Password123!"}
        )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[OK] Authenticated successfully.")

    # 1. Test Approval Plan
    print("[2] Testing GET /api/v1/approvals/plan...")
    plan_res = requests.get(f"{BASE_URL}/api/v1/approvals/plan", headers=headers)
    assert plan_res.status_code == 200, f"Plan failed: {plan_res.text}"
    plan_data = plan_res.json()
    print(f"[OK] Plan title: '{plan_data['title']}', Total items: {plan_data['total']}")
    assert plan_data["total"] >= 3
    assert plan_data["items"][0]["priority_label"] == "Start First"

    # 2. Test Why Explanation
    print("[3] Testing GET /api/v1/approvals/FSSAI/why...")
    why_res = requests.get(f"{BASE_URL}/api/v1/approvals/FSSAI/why", headers=headers)
    assert why_res.status_code == 200, f"Why failed: {why_res.text}"
    why_data = why_res.json()
    print(f"[OK] FSSAI Reason: {why_data['reason'][:60]}...")
    assert "food" in why_data["reason"].lower() or "snack" in why_data["reason"].lower()

    # 3. Test Coverage Overview
    print("[4] Testing GET /api/v1/coverage...")
    cov_res = requests.get(f"{BASE_URL}/api/v1/coverage", headers=headers)
    assert cov_res.status_code == 200, f"Coverage failed: {cov_res.text}"
    cov_data = cov_res.json()
    print(f"[OK] Coverage Total Workflows: {cov_data['summary']['total_workflows']}")
    assert cov_data["summary"]["total_workflows"] >= 4

    # 4. Test Compliance Dashboard
    print("[5] Testing GET /api/v1/compliance...")
    comp_res = requests.get(f"{BASE_URL}/api/v1/compliance", headers=headers)
    assert comp_res.status_code == 200, f"Compliance failed: {comp_res.text}"
    comp_data = comp_res.json()
    print(f"[OK] Active Approvals: {comp_data['summary']['active_approvals_count']}, Tasks: {len(comp_data['tasks'])}")
    assert comp_data["summary"]["active_approvals_count"] >= 1

    # 5. Test Compliance Calendar
    print("[6] Testing GET /api/v1/compliance/calendar...")
    cal_res = requests.get(f"{BASE_URL}/api/v1/compliance/calendar", headers=headers)
    assert cal_res.status_code == 200, f"Calendar failed: {cal_res.text}"
    cal_data = cal_res.json()
    print(f"[OK] Calendar Events Count: {len(cal_data)}")

    # 6. Test Delay Analysis
    print("[7] Testing GET /api/v1/applications/1/delay-analysis...")
    delay_res = requests.get(f"{BASE_URL}/api/v1/applications/1/delay-analysis", headers=headers)
    assert delay_res.status_code == 200, f"Delay Analysis failed: {delay_res.text}"
    delay_data = delay_res.json()
    print(f"[OK] Delay Analysis Health: {delay_data['health_badge']}, Waiting Party: {delay_data['waiting_party']}")

    # 7. Test Officer Bottlenecks
    print("[8] Testing GET /api/v1/applications/bottlenecks...")
    bot_res = requests.get(f"{BASE_URL}/api/v1/applications/bottlenecks", headers=headers)
    assert bot_res.status_code == 200, f"Bottlenecks failed: {bot_res.text}"
    bot_data = bot_res.json()
    print(f"[OK] Officer Bottlenecks Stages Count: {len(bot_data['bottleneck_stages'])}")

    print("\n[SUCCESS] ALL 7 E2E INTEGRATION SUITES PASSED FLAWLESSLY!")


if __name__ == "__main__":
    test_e2e()
