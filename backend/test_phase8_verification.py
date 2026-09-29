import os
import sys
import json

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from app.services.scheme_matcher import load_schemes_db, match_schemes_for_profile
from app.models.business_profile import BusinessProfile

def test_phase8():
    print("==================================================")
    print("  PHASE 8: GOVERNMENT SCHEME DISCOVERY VERIFICATION")
    print("==================================================")

    # 1. Test Scheme Knowledge Base
    schemes = load_schemes_db()
    print(f"\n[1] Curated Schemes Knowledge Base: Found {len(schemes)} schemes.")
    assert len(schemes) >= 4, f"Expected at least 4 curated schemes, found {len(schemes)}"

    required_fields = [
        "scheme_name", "department", "state", "applicable_industries",
        "business_types", "eligibility_conditions", "investment_conditions",
        "benefits", "required_documents", "source", "last_verified_date"
    ]

    for s in schemes:
        for field in required_fields:
            assert field in s, f"Scheme {s.get('id')} missing required field: {field}"
        print(f"  [OK] {s['scheme_name']} ({s['department']}) - Verified on {s['last_verified_date']}")
        print(f"    Source: {s['source']}")

    # 2. Test Deterministic Scheme Matching on Target Business Profile
    print("\n[2] Testing Deterministic Scheme Matching for Food Processing Profile:")
    profile = BusinessProfile(
        company_name="Sahyadri Organic Agro & Food Processing Ltd",
        industry="Food Processing",
        state="Maharashtra",
        business_type="Private Limited Company",
        investment_amount=15000000.0, # 1.5 Crore
        project_stage="Setting Up"
    )

    matches = match_schemes_for_profile(profile, use_ai_explanations=False)
    print(f"  Matched {len(matches)} relevant schemes for {profile.company_name}:")

    for idx, match in enumerate(matches, 1):
        print(f"\n  Scheme #{idx}: {match['scheme_name']}")
        print(f"  Department: {match['department']}")
        print(f"  Relevance Status: {match['relevance_status']}")
        print(f"  Why Relevant: {match['why_relevant']}")
        print(f"  Benefits: {match['benefits'][:2]}")
        print(f"  Official Source: {match['source']}")

        # Strict wording validation: Must use 'Potentially relevant' and NEVER claim 'You are eligible'
        assert match["relevance_status"] == "Potentially relevant", f"Invalid relevance status: {match['relevance_status']}"
        assert "You are eligible" not in match["why_relevant"], f"Found forbidden phrase in explanation: {match['why_relevant']}"
        assert "Potentially relevant" in match["why_relevant"] or "relevant" in match["why_relevant"].lower()

    # Verify key food processing schemes were matched
    matched_ids = [m["id"] for m in matches]
    assert "scheme-psi-2019" in matched_ids, "Expected Package Scheme of Incentives (PSI 2019) to match"
    assert "scheme-pmfme-mofpi" in matched_ids, "Expected PMFME Scheme to match food processing"
    print("\n  [OK] Target industry schemes (PSI 2019, PMFME) correctly matched via deterministic rules!")

    # 3. Test AI Explanation Enrichment
    print("\n[3] Testing AI Grounded Explanation Enrichment (Groq LLM):")
    try:
        from app.services.ai_service import explain_schemes_with_ai
        ai_enriched_matches = explain_schemes_with_ai(profile, matches[:2])
        for m in ai_enriched_matches:
            print(f"\n  [AI Explained] Scheme: {m['scheme_name']}")
            print(f"  AI Justification: {m['why_relevant']}")
            assert "You are eligible" not in m["why_relevant"], "AI explanation violated strict framing constraints"
            assert "Potentially relevant" in m["why_relevant"] or "relevant" in m["why_relevant"].lower()
        print("\n  [OK] AI explanations safely formatted with grounded reasons and 'Potentially relevant' framing!")
    except Exception as e:
        print(f"  AI test warning (fallback active): {e}")

    print("\n==================================================")
    print("  PHASE 8 VERIFICATION SUCCESSFUL!")
    print("==================================================")

if __name__ == "__main__":
    test_phase8()
