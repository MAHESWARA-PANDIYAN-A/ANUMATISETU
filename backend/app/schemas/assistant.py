from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatAction(BaseModel):
    type: str = Field(default="NAVIGATE", description="Action type, e.g. NAVIGATE, OPEN_DOCUMENT, OPEN_APPLICATION")
    label: str = Field(..., description="User-facing label for action button")
    route: str = Field(..., description="Frontend navigation route")
    payload: Optional[Dict[str, Any]] = None


class ChatSource(BaseModel):
    title: str
    department: str
    source_url: Optional[str] = None
    last_verified_date: Optional[str] = None
    summary: Optional[str] = None


class ChatContextInput(BaseModel):
    page: Optional[str] = None
    application_id: Optional[str] = None
    document_id: Optional[int] = None
    approval_id: Optional[str] = None
    business_profile_id: Optional[int] = None
    context_json: Optional[Dict[str, Any]] = None


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)
    context: Optional[ChatContextInput] = None


class ChatMessageOut(BaseModel):
    id: Optional[int] = None
    session_id: str
    role: str
    content: str
    intent: Optional[str] = None
    sources: Optional[List[ChatSource]] = None
    actions: Optional[List[ChatAction]] = None
    created_at: Optional[datetime] = None


class ChatResponse(BaseModel):
    success: bool = True
    session_id: str
    message: ChatMessageOut
    sources: List[ChatSource] = []
    actions: List[ChatAction] = []


class ChatSessionOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message: Optional[str] = None


class NextActionOut(BaseModel):
    title: Optional[str] = None
    priority: str  # "high", "medium", "low", "none"
    label: str
    description: str
    approval_id: Optional[str] = None
    document_id: Optional[int] = None
    route: str
    action_type: str = "NAVIGATE"


class ExplainDocumentRequest(BaseModel):
    document_id: Any
    session_id: Optional[str] = None
    document_name: Optional[str] = None


class ExplainApplicationRequest(BaseModel):
    application_id: Optional[str] = None
    approval_id: Optional[str] = None
    session_id: Optional[str] = None
    approval_name: Optional[str] = None


class ExplainApprovalRequest(BaseModel):
    approval_id: str
    session_id: Optional[str] = None
    approval_name: Optional[str] = None
