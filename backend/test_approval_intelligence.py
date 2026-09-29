import pytest
from app.core.database import SessionLocal
from app.models.business_profile import BusinessProfile
from app.services.approval_reason_service import ApprovalReasonService
from app.services.approval_priority_service import ApprovalPriorityService
from app.services.approval_coverage_service import ApprovalCoverageService
from app.services.compliance_service import ComplianceService
from app.services.delay_analysis_service import DelayAnalysisService
from app.services.xai_service import xai_service


def test_approval_intelligence_services():
    db = SessionLocal()
    try:
        profile = db.query(BusinessProfile).filter(BusinessProfile.company_name.ilike("%ABC Foods%")).first()
        if not profile:
            profile = db.query(BusinessProfile).first()

        assert profile is not None, "Profile should exist"

        # 1. Test Reason Service
        reasons = ApprovalReasonService.get_approval_reasons_for_profile(db, profile)
        print(f"[OK] Generated {len(reasons)} reasons.")
        assert len(reasons) >= 3, "Should have FSSAI, GST, Udyam reasons"
        fssai_reason = next(r for r in reasons if r["approval_id"] == "FSSAI")
        assert "food" in fssai_reason["reason"].lower() or "snack" in fssai_reason["reason"].lower()

        # 2. Test Priority Service
        plan = ApprovalPriorityService.calculate_approval_plan(db, profile)
        print(f"[OK] Calculated Approval Plan with {plan['total']} items.")
        assert plan["total"] >= 3
        # First item should be Start First
        first_item = plan["items"][0]
        assert first_item["priority_label"] == "Start First"
        assert first_item["approval_id"] == "FSSAI"

        # 3. Test Coverage Service
        coverage = ApprovalCoverageService.get_coverage_for_profile(db, profile)
        print(f"[OK] Retrieved coverage summary: {coverage['summary']}")
        assert coverage["summary"]["total_workflows"] >= 4
        assert coverage["business_location"]["district"] is not None

        # 4. Test Compliance Service
        compliance = ComplianceService.get_compliance_overview(db, profile)
        print(f"[OK] Retrieved compliance overview: {compliance['summary']}")
        assert compliance["summary"]["active_approvals_count"] >= 1
        assert len(compliance["tasks"]) >= 1

        # 5. Test Delay Analysis Service
        delay_diag = DelayAnalysisService.analyze_application_delay(db, application_id=1)
        print(f"[OK] Generated Delay Diagnostic: health={delay_diag['health_badge']}, waiting_party={delay_diag['waiting_party']}")
        assert "health_badge" in delay_diag

        # 6. Test Assistant Fallbacks
        resp_priority = xai_service.generate_structured_response(
            "Why should I start FSSAI first?",
            "Business: ABC Foods",
            context_data={"business": {"name": profile.company_name, "industry": profile.industry}}
        )
        print(f"[OK] Assistant Priority Answer: {resp_priority['answer'][:60]}...")
        assert len(resp_priority["answer"]) > 10 and ("FSSAI" in resp_priority["answer"] or "Food" in resp_priority["answer"] or "TASKER" in resp_priority["answer"])

        resp_coverage = xai_service.generate_structured_response(
            "Can everything be done online?",
            "Business: ABC Foods",
            context_data={"business": {"name": profile.company_name, "industry": profile.industry}}
        )
        print(f"[OK] Assistant Coverage Answer: {resp_coverage['answer'][:60]}...")
        assert len(resp_coverage["answer"]) > 10

        resp_renewal = xai_service.generate_structured_response(
            "What renewals do I have coming up?",
            "Business: ABC Foods",
            context_data={"business": {"name": profile.company_name, "industry": profile.industry}}
        )
        print(f"[OK] Assistant Renewal Answer: {resp_renewal['answer'][:60]}...")
        assert len(resp_renewal["answer"]) > 10

        print("[SUCCESS] ALL APPROVAL INTELLIGENCE BACKEND TESTS PASSED!")

    finally:
        db.close()


if __name__ == "__main__":
    test_approval_intelligence_services()
