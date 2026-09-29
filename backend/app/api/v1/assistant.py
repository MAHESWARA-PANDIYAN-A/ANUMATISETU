import logging
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.document import Document
from app.schemas.assistant import (
    ChatAction,
    ChatContextInput,
    ChatMessageOut,
    ChatRequest,
    ChatResponse,
    ChatSessionOut,
    ChatSource,
    NextActionOut,
    ExplainDocumentRequest,
    ExplainApplicationRequest,
    ExplainApprovalRequest,
)
from app.services.chat_service import ChatService
from app.services.next_action_service import NextActionService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def send_chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Personalized conversational interaction with TASKER Assistant (powered by Grok / xAI).
    Grounds response in user's business profile, applications, vault documents, and verified knowledge.
    """
    context_dict = payload.context.model_dump() if payload.context else {}
    
    result = ChatService.process_user_message(
        db=db,
        user=current_user,
        message_text=payload.message.strip(),
        session_id=payload.session_id,
        context_input=context_dict
    )
    return result


@router.get("/sessions", response_model=List[ChatSessionOut])
def list_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists recent conversation sessions for the authenticated user."""
    return ChatService.list_user_sessions(db, current_user.id)


@router.get("/sessions/{session_id}", response_model=List[ChatMessageOut])
def get_session_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches full message history for a specific conversation session."""
    messages = ChatService.get_session_messages(db, current_user.id, session_id)
    if not messages:
        # Check if session exists
        sessions = ChatService.list_user_sessions(db, current_user.id)
        if not any(s["id"] == session_id for s in sessions):
            raise HTTPException(status_code=404, detail="Chat session not found or unauthorized.")
    return messages


@router.delete("/sessions/{session_id}")
def delete_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a conversation session from the user's history."""
    deleted = ChatService.delete_session(db, current_user.id, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return {"success": True, "message": "Chat session removed."}


@router.get("/next-action", response_model=NextActionOut)
def get_user_next_action(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the single most important actionable item for the authenticated entrepreneur
    (e.g., officer query response, missing mandatory vault document, scheduled inspection).
    """
    return NextActionService.get_top_next_action(db, current_user.id)


@router.post("/explain-document", response_model=ChatResponse)
def explain_document_state(
    payload: ExplainDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Contextual explain action when user clicks 'Explain' next to a document warning."""
    # Validate user ownership
    try:
        doc_id_int = int(payload.document_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Document not found.")

    doc = db.query(Document).filter(
        Document.id == doc_id_int,
        (Document.user_id == current_user.id) | (Document.applicant_id == current_user.id)
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")

    doc_label = payload.document_name or doc.document_name or doc.document_type
    return ChatService.process_user_message(
        db=db,
        user=current_user,
        message_text=f"Explain why my document '{doc_label}' (ID: {doc_id_int}) is in its current state using TASKER's validation and usage data.",
        session_id=payload.session_id,
        context_input={"page": "document_center", "document_id": doc_id_int}
    )


@router.post("/explain-application", response_model=ChatResponse)
def explain_application_status(
    payload: ExplainApplicationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Contextual explain action when user clicks 'Why?' or 'Explain Status' next to an application."""
    app_id = payload.application_id or payload.approval_id or "general"
    return ChatService.process_user_message(
        db=db,
        user=current_user,
        message_text=f"Explain the current status, queries, and next steps for application {app_id}.",
        session_id=payload.session_id,
        context_input={"page": "application", "application_id": app_id, "approval_id": payload.approval_id}
    )


@router.post("/explain-approval", response_model=ChatResponse)
def explain_approval_recommendation(
    payload: ExplainApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Contextual explain action when user clicks 'Why recommended?' on approval selection."""
    approval_name = payload.approval_name or payload.approval_id
    return ChatService.process_user_message(
        db=db,
        user=current_user,
        message_text=f"Why is the {approval_name} statutory approval recommended for my business?",
        session_id=payload.session_id,
        context_input={"page": "approval_details", "approval_id": payload.approval_id}
    )
