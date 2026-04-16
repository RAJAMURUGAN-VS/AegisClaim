from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, BeforeValidator
from typing_extensions import Annotated
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
import pymongo

# Represents an ObjectId field in Pydantic.
# It will validate that the input is a valid ObjectId,
# and convert it to a string for JSON serialization.
PyObjectId = Annotated[
    ObjectId,
    BeforeValidator(lambda v: ObjectId(v) if not isinstance(v, ObjectId) else v)
]

class ClaimItem(BaseModel):
    """A single claim item within a patient's history."""
    claim_date: datetime
    cpt_code: str
    icd10_code: str
    billed_amount: float
    paid_amount: float
    pa_id: Optional[str] = None
    status: str

class AnomalyFlag(BaseModel):
    """A record of a detected anomaly."""
    flag_type: str
    detected_at: datetime
    severity: str # e.g., "LOW", "MEDIUM", "HIGH"
    details: dict = Field(default_factory=dict)

class ClaimHistoryDocument(BaseModel):
    """
    Document model for the 'claims_history' collection in MongoDB.
    Represents the complete claim history and risk profile for a patient/provider pair.
    """
    id: PyObjectId = Field(default_factory=ObjectId, alias="_id")
    patient_member_id: str = Field(..., index=True)
    provider_npi: str = Field(..., index=True)
    claims: List[ClaimItem] = []
    provider_risk_score: float = Field(default=0.0, ge=0.0, le=1.0)
    anomaly_flags: List[AnomalyFlag] = []
    last_evaluated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

async def create_indexes(db: AsyncIOMotorDatabase):
    """
    Creates required indexes on the claims_history collection.
    Should be called on application startup.
    """
    collection: AsyncIOMotorCollection = db.claims_history
    print("Creating MongoDB indexes for 'claims_history' collection...")
    try:
        await collection.create_index(
            [("patient_member_id", pymongo.ASCENDING)],
            name="patient_member_id_idx"
        )
        await collection.create_index(
            [("provider_npi", pymongo.ASCENDING)],
            name="provider_npi_idx"
        )
        print("MongoDB indexes created successfully.")
    except Exception as e:
        print(f"Error creating MongoDB indexes: {e}")
