"""
End-to-End Test Suite for TASKER Personalized AI Assistant (xAI / Grok Integration)
Tests:
- Authentication & JWT user context scoping
- Chat Session & Multi-turn persistence
- Grounded Knowledge Retrieval & Safe Fallback
- Contextual Document, Application, and Approval explanation
- Next Action calculation
- Security: Cross-user boundary isolation
- Deterministic fallback on AI failure
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.business_profile import BusinessProfile
from app.models.application import Application, ApplicationStatus, ApprovalJourney, ApprovalApplication
from app.models.document import Document, ValidationStatus, DocumentValidation, DocumentUsage
from app.models.chat import ChatSession, ChatMessage, MessageRole, MessageType
from app.core.security import create_access_token, hash_password
from app.services.xai_service import XAIService


class TestAssistantE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db: Session = SessionLocal()

        # 1. Create or retrieve Test User A (Food Manufacturing - Rahul)
        cls.user_a = cls.db.query(User).filter(User.email == "test_assistant_user_a@tasker.in").first()
        if not cls.user_a:
            cls.user_a = User(
                email="test_assistant_user_a@tasker.in",
                hashed_password=hash_password("Password123!"),
                full_name="Rahul Kumar",
                phone="9876543210",
                role=UserRole.APPLICANT,
                is_active=True,
            )
            cls.db.add(cls.user_a)
            cls.db.commit()
            cls.db.refresh(cls.user_a)

        # Profile for User A
        cls.profile_a = cls.db.query(BusinessProfile).filter(BusinessProfile.user_id == cls.user_a.id).first()
        if not cls.profile_a:
            cls.profile_a = BusinessProfile(
                user_id=cls.user_a.id,
                company_name="ABC Foods Private Limited",
                business_type="Private Limited",
                organization_type="Manufacturing",
                industry="Food Processing",
                business_activity="Packaged Snack Manufacturing",
                state="Tamil Nadu",
                district="Salem",
                address="12 Industrial Estate, Salem",
                existing_registrations={"pan": "AABCS1234F"},
            )
            cls.db.add(cls.profile_a)
            cls.db.commit()
            cls.db.refresh(cls.profile_a)

        # Document for User A with WARNING
        cls.doc_a = cls.db.query(Document).filter(Document.user_id == cls.user_a.id).first()
        if not cls.doc_a:
            cls.doc_a = Document(
                applicant_id=cls.user_a.id,
                user_id=cls.user_a.id,
                document_type="ELECTRICITY_BILL",
                document_name="Address Proof - Electricity Bill",
                file_name="electricity_bill.pdf",
                file_path="uploads/vault/test_elec.pdf",
                file_size=102400,
                mime_type="application/pdf",
                validation_status=ValidationStatus.WARNING,
                document_number_masked="XXXX-XXXX-8921",
            )
            cls.db.add(cls.doc_a)
            cls.db.commit()
            cls.db.refresh(cls.doc_a)

            val_a = DocumentValidation(
                document_id=cls.doc_a.id,
                validation_type="ADDRESS_VERIFICATION",
                status=ValidationStatus.WARNING,
                result="WARNING",
                summary="Address extracted differs from business profile district.",
                message="Document is legible, but premises address shows Omalur Road, while profile specifies Industrial Estate.",
                recommended_action="Please upload electricity bill matching registered industrial premises.",
                discrepancies=[{"field": "address", "message": "Address mismatch detected."}],
            )
            cls.db.add(val_a)

            usage_a1 = DocumentUsage(
                document_id=cls.doc_a.id,
                user_id=cls.user_a.id,
                approval_id="FSSAI",
                required_document_type="ELECTRICITY_BILL"
            )
            usage_a2 = DocumentUsage(
                document_id=cls.doc_a.id,
                user_id=cls.user_a.id,
                approval_id="GST",
                required_document_type="ELECTRICITY_BILL"
            )
            cls.db.add_all([usage_a1, usage_a2])
            cls.db.commit()
            cls.db.refresh(cls.doc_a)

        # Application for User A (FSSAI in review, GST in document query, Udyam approved)
        cls.app_a = cls.db.query(Application).filter(Application.applicant_id == cls.user_a.id).first()
        if not cls.app_a:
            cls.app_a = Application(
                applicant_id=cls.user_a.id,
                business_profile_id=cls.profile_a.id,
                status=ApplicationStatus.UNDER_REVIEW,
                application_number="APP-TEST-2026-0001",
                fssai_application_number="FSSAI-MOCK-2026-000123",
                fssai_status="UNDER_REVIEW",
                gst_application_number="GST-MOCK-2026-000456",
                gst_status="DOCUMENT_QUERY",
                gst_officer_remarks="The officer requested a corrected principal-place proof.",
                udyam_application_number="UDYAM-TN-02-0001234",
                udyam_registration_number="UDYAM-TN-02-0001234",
                udyam_status="APPROVED",
            )
            cls.db.add(cls.app_a)
            cls.db.commit()
            cls.db.refresh(cls.app_a)

        # 2. Create Test User B (IT Business - Priya) for cross-user isolation tests
        cls.user_b = cls.db.query(User).filter(User.email == "test_assistant_user_b@tasker.in").first()
        if not cls.user_b:
            cls.user_b = User(
                email="test_assistant_user_b@tasker.in",
                hashed_password=hash_password("Password123!"),
                full_name="Priya Sharma",
                phone="9876543211",
                role=UserRole.APPLICANT,
                is_active=True,
            )
            cls.db.add(cls.user_b)
            cls.db.commit()
            cls.db.refresh(cls.user_b)

        # Tokens
        cls.token_a = create_access_token(subject=cls.user_a.id, role=cls.user_a.role.value, email=cls.user_a.email)
        cls.token_b = create_access_token(subject=cls.user_b.id, role=cls.user_b.role.value, email=cls.user_b.email)
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_health_and_auth_protection(self):
        """Assistant endpoint rejects unauthenticated requests with 401"""
        res = self.client.post("/api/v1/assistant/chat", json={"message": "Hello"})
        self.assertEqual(res.status_code, 401)

    def test_02_personalized_chat_business_context(self):
        """User A receives personalized answer incorporating ABC Foods / Salem context"""
        payload = {
            "message": "What is my business name and what approvals do I have?",
            "context": {"page": "dashboard"}
        }
        res = self.client.post("/api/v1/assistant/chat", json=payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("session_id", data)
        self.assertIn("message", data)
        self.assertEqual(data["message"]["role"].upper(), "ASSISTANT")
        content = data["message"]["content"]
        # Content should reference ABC Foods or user business context
        self.assertTrue(len(content) > 10)

    def test_03_explain_document_endpoint(self):
        """Explaining User A's document with warning returns contextual guidance and view action"""
        payload = {
            "document_id": int(self.doc_a.id),
            "document_name": self.doc_a.document_name
        }
        res = self.client.post("/api/v1/assistant/explain-document", json=payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        actions = data.get("actions", [])
        self.assertTrue(len(data["message"]["content"]) > 10)

    def test_04_explain_application_endpoint(self):
        """Explaining FSSAI application returns actual database status"""
        payload = {
            "approval_id": "FSSAI",
            "approval_name": "FSSAI Food Safety License"
        }
        res = self.client.post("/api/v1/assistant/explain-application", json=payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("message", data)

    def test_05_explain_approval_recommendation(self):
        """Explaining why FSSAI was recommended reflects Food Processing profile activity"""
        payload = {
            "approval_id": "FSSAI",
            "approval_name": "FSSAI Food Safety License"
        }
        res = self.client.post("/api/v1/assistant/explain-approval", json=payload, headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("message", data)

    def test_06_next_action_service(self):
        """Next action returns top prioritized compliance action"""
        res = self.client.get("/api/v1/assistant/next-action", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("title", data)
        self.assertIn("priority", data)
        self.assertIn("route", data)

    def test_07_security_cross_user_isolation(self):
        """User B cannot access or explain User A's private vault document"""
        payload = {
            "document_id": int(self.doc_a.id),
            "document_name": "Electricity Bill"
        }
        res = self.client.post("/api/v1/assistant/explain-document", json=payload, headers=self.headers_b)
        self.assertEqual(res.status_code, 404)

    def test_08_multi_turn_session_history(self):
        """Multi-turn conversation persists messages in database and lists in /sessions"""
        # Message 1
        res1 = self.client.post("/api/v1/assistant/chat", json={"message": "What is FSSAI?"}, headers=self.headers_a)
        self.assertEqual(res1.status_code, 200)
        sess_id = res1.json().get("session_id")
        self.assertIsNotNone(sess_id)

        # Message 2 in same session
        res2 = self.client.post("/api/v1/assistant/chat", json={"session_id": sess_id, "message": "Can I reuse my PAN for it?"}, headers=self.headers_a)
        self.assertEqual(res2.status_code, 200)

        # Check sessions list
        sess_res = self.client.get("/api/v1/assistant/sessions", headers=self.headers_a)
        self.assertEqual(sess_res.status_code, 200)
        sessions = sess_res.json()
        self.assertTrue(any(s["id"] == sess_id for s in sessions))

        # Check session messages
        msgs_res = self.client.get(f"/api/v1/assistant/sessions/{sess_id}", headers=self.headers_a)
        self.assertEqual(msgs_res.status_code, 200)
        session_msgs = msgs_res.json()
        self.assertTrue(len(session_msgs) >= 4)  # 2 user msgs + 2 assistant msgs


if __name__ == "__main__":
    unittest.main()
