from typing import List, Optional
from pydantic import BaseModel, Field


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)
    department_filter: Optional[str] = None


class SourceDocumentRead(BaseModel):
    id: str
    title: str
    department: str
    source: str
    publication_date: str
    last_verified_date: str
    category: str
    summary: Optional[str] = None
    relevance_score: Optional[float] = None


class RegulatoryAnswerResponse(BaseModel):
    answer: str
    source_documents: List[SourceDocumentRead] = []
    source_references: List[str] = []
    confidence: float = 1.0
    disclaimer: str
