import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.deps import get_current_active_user
from app.models.user import User
from app.schemas.regulatory_assistant import (
    QuestionRequest,
    RegulatoryAnswerResponse,
    SourceDocumentRead,
)
from app.services.ai_service import ask_regulatory_knowledge_assistant
from app.services.regulatory_rag import get_all_sources_metadata

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/regulatory-assistant", tags=["Regulatory Knowledge Assistant"])


@router.post("/ask", response_model=RegulatoryAnswerResponse)
def ask_regulatory_question(
    req: QuestionRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Source-Grounded Regulatory Q&A Assistant.
    - Answers user questions strictly using the verified project knowledge base.
    - Returns structured answer, source documents, and statutory citations.
    - If the knowledge base does not contain sufficient information, returns:
      'I could not find sufficient information in the available verified sources.'
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be blank.")

    try:
        response_data = ask_regulatory_knowledge_assistant(
            question=req.question.strip(),
            department_filter=req.department_filter,
        )
        return response_data
    except Exception as e:
        logger.error(f"Error querying regulatory assistant: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing regulatory inquiry against the verified knowledge base."
        )


@router.get("/sources", response_model=List[SourceDocumentRead])
def list_regulatory_sources(
    current_user: User = Depends(get_current_active_user),
):
    """Lists all registered official guidelines, statutory acts, and policy documents in the knowledge base."""
    return get_all_sources_metadata()
