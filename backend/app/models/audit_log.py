from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, JSON
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # E.g. "AI_APPROVAL_RECOMMENDATION"
    input_summary = Column(JSON, nullable=False, default=dict)
    recommendations_count = Column(Integer, nullable=False, default=0)
    ai_provider = Column(String(100), nullable=False)  # "Gemini-1.5-Flash" or "Deterministic-Rules"
    status = Column(String(50), nullable=False, default="SUCCESS")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
