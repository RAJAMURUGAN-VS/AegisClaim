from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import date, datetime, timedelta
from typing import List, Optional, Literal

class PASubmitRequest(BaseModel):
    """Schema for submitting a new Prior Authorization request."""
    patient_member_id: str = Field(..., min_length=8, max_length=20)
    payer_id: UUID
    plan_id: UUID
    provider_npi: str = Field(..., pattern=r"^\d{10}$")
    icd10_codes: List[str] = Field(..., min_length=1)
    cpt_codes: List[str] = Field(..., min_length=1)
    date_of_service: date
    prior_treatment_history: Optional[str] = None
    medication_name: Optional[str] = None
    medication_dosage: Optional[str] = None

    @field_validator('date_of_service')
    def validate_date_of_service(cls, v: date) -> date:
        if v < (date.today() - timedelta(days=90)):
            raise ValueError("Date of service cannot be more than 90 days in the past")
        return v

class PAStatusResponse(BaseModel):
    """Schema for the response of a PA status check."""
    pa_id: UUID
    status: str
    final_score: Optional[float] = None
    risk_flag: Optional[str] = None
    decision: Optional[str] = None
    auth_code: Optional[str] = None
    auth_valid_until: Optional[date] = None
    created_at: datetime
    decided_at: Optional[datetime] = None

class PADecisionRequest(BaseModel):
    """Schema for an adjudicator to submit a decision."""
    decision: Literal["HUMAN_APPROVE", "HUMAN_DENY"]
    denial_reason_code: Optional[str] = None
    conditions: Optional[str] = None
    override_reason: str = Field(..., min_length=10)

class PAAppealRequest(BaseModel):
    """Schema for submitting an appeal for a denied PA."""
    appeal_reason: str = Field(..., min_length=50)
    supporting_documents: Optional[List[str]] = None

class DocumentUploadResponse(BaseModel):
    """Schema for the response after uploading documents."""
    pa_id: UUID
    uploaded_files: List[str]
    missing_docs: List[str]
    status: str
