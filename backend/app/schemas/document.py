from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DocumentValidationResponse(BaseModel):
    id: int
    document_id: int
    extracted_data: Dict[str, Any]
    discrepancies: List[Dict[str, Any]]
    missing_fields: List[str]
    status: str
    summary: Optional[str] = None
    recommended_action: Optional[str] = None
    validated_at: datetime

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: int
    applicant_id: int
    approval_id: Optional[str] = None
    document_type: str
    file_name: str
    uploaded_at: datetime
    validation_status: str
    validation: Optional[DocumentValidationResponse] = None

    class Config:
        from_attributes = True


class ValidateDocumentResponse(BaseModel):
    document_id: int
    status: str
    validation: DocumentValidationResponse
    disclaimer: str
