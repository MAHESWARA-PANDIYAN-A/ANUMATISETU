import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class MessageRole(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"
    SYSTEM = "SYSTEM"


class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    ACTION = "ACTION"
    SYSTEM_CONTEXT = "SYSTEM_CONTEXT"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, index=True)  # e.g. UUID string
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", backref="chat_sessions")
    business_profile = relationship("BusinessProfile", backref="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    contexts = relationship("ChatContext", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(MessageRole), nullable=False, default=MessageRole.USER)
    content = Column(Text, nullable=False)
    message_type = Column(Enum(MessageType), nullable=False, default=MessageType.TEXT)
    intent = Column(String(64), nullable=True)
    sources = Column(JSON, nullable=True)   # list of source objects [{title, department, source_url, last_verified_date}]
    actions = Column(JSON, nullable=True)   # list of action objects [{type: "NAVIGATE", label: "Open Document", route: "/documents"}]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="messages")
    user = relationship("User")


class ChatContext(Base):
    __tablename__ = "chat_contexts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    page = Column(String(100), nullable=True)
    application_id = Column(String(100), nullable=True)
    document_id = Column(Integer, nullable=True)
    approval_id = Column(String(50), nullable=True)
    context_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="contexts")


class AIRequestLog(Base):
    __tablename__ = "ai_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id = Column(String(64), nullable=True, index=True)
    model = Column(String(100), nullable=False)
    request_type = Column(String(50), nullable=False, default="chat")
    intent = Column(String(64), nullable=True)
    status = Column(String(30), nullable=False, default="SUCCESS")  # SUCCESS, FAILED, TIMEOUT, FALLBACK
    response_id = Column(String(128), nullable=True)
    latency_ms = Column(Integer, nullable=True)
    error_code = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
