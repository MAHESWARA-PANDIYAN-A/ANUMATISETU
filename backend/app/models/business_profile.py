from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class BusinessProfile(Base):
    __tablename__ = "business_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    business_type = Column(String(100), nullable=False)
    organization_type = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=False)
    business_activity = Column(String(255), nullable=True)
    state = Column(String(100), nullable=False, default="Maharashtra")
    district = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=True, default="411028")
    address = Column(Text, nullable=True)
    investment_amount = Column(Float, nullable=False, default=100.0)  # In Lakhs or Crores as specified
    expected_turnover = Column(Float, nullable=True, default=400.0)
    employee_count = Column(Integer, nullable=False, default=20)
    project_stage = Column(String(100), nullable=False, default="New Business")
    land_status = Column(String(100), nullable=False, default="Rented")
    premises_type = Column(String(100), nullable=True, default="Industrial Estate")
    expected_start_date = Column(String(50), nullable=True)
    existing_registrations = Column(JSON, nullable=False, default=dict)  # {"pan": "...", "gstin": "...", "udyam": "..."}
    existing_approvals = Column(JSON, nullable=False, default=list)  # List of string badges

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="business_profile")
