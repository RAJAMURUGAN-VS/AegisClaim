import uuid
import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Enum as SAEnum,
    Numeric,
    Date,
    ForeignKey,
    TIMESTAMP,
    func,
    event,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.exc import InvalidRequestError

Base = declarative_base()

class StatusEnum(enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SCORING = "SCORING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    REVIEW = "REVIEW"
    APPEALED = "APPEALED"

class RiskFlagEnum(enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class DecisionEnum(enum.Enum):
    AUTO_APPROVE = "AUTO_APPROVE"
    HUMAN_APPROVE = "HUMAN_APPROVE"
    AUTO_DENY = "AUTO_DENY"
    HUMAN_DENY = "HUMAN_DENY"

class PayerMaster(Base):
    """Placeholder for Payer Master data."""
    __tablename__ = "payer_master"
    payer_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payer_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)

class PlanMaster(Base):
    """Placeholder for Plan Master data."""
    __tablename__ = "plan_master"
    plan_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payer_id = Column(UUID(as_uuid=True), ForeignKey("payer_master.payer_id"), nullable=False)
    plan_name = Column(String(100), nullable=False)
    pa_required = Column(Boolean, default=True)
    step_therapy_required = Column(Boolean, default=False)
    max_quantity = Column(Integer, nullable=True)

class PARequest(Base):
    """Model for Prior Authorization requests."""
    __tablename__ = "pa_requests"

    pa_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_member_id = Column(String(20), nullable=False, index=True)
    payer_id = Column(UUID(as_uuid=True), ForeignKey("payer_master.payer_id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plan_master.plan_id"), nullable=False)
    provider_npi = Column(String(10), nullable=False, index=True)
    icd10_codes = Column(ARRAY(String))
    cpt_codes = Column(ARRAY(String))
    status = Column(SAEnum(StatusEnum), nullable=False, default=StatusEnum.PENDING)
    final_score = Column(Numeric(5, 2), nullable=True)
    risk_flag = Column(SAEnum(RiskFlagEnum), nullable=True)
    decision = Column(SAEnum(DecisionEnum), nullable=True)
    auth_code = Column(String(20), nullable=True, unique=True)
    auth_valid_until = Column(Date, nullable=True)
    denial_reason_code = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    decided_at = Column(TIMESTAMP(timezone=True), nullable=True)
    rule_version_id = Column(UUID(as_uuid=True), nullable=True)

    scores = relationship("PAScore", back_populates="pa_request", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="pa_request", cascade="all, delete-orphan")

class PAScore(Base):
    """Model for scores associated with a PA request."""
    __tablename__ = "pa_scores"

    score_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pa_id = Column(UUID(as_uuid=True), ForeignKey("pa_requests.pa_id"), nullable=False, index=True)
    policy_score = Column(Numeric(5, 2), nullable=False)
    clinical_match_score = Column(Numeric(5, 2), nullable=False)
    fraud_score = Column(Numeric(5, 2), nullable=False)
    weighted_final_score = Column(Numeric(5, 2), nullable=False)
    shap_values_json = Column(JSONB, nullable=True)
    scored_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    pa_request = relationship("PARequest", back_populates="scores")

class AuditLog(Base):
    """Append-only log for all events in a PA request lifecycle."""
    __tablename__ = "audit_log"

    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pa_id = Column(UUID(as_uuid=True), ForeignKey("pa_requests.pa_id"), nullable=False, index=True)
    event_type = Column(String(60), nullable=False)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=True)
    actor = Column(String(60), nullable=False)
    payload_json = Column(JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    pa_request = relationship("PARequest", back_populates="audit_logs")

# To prevent updates/deletes on the audit_log table
@event.listens_for(AuditLog, 'before_update', propagate=True)
def prevent_audit_log_updates(mapper, connection, target):
    raise InvalidRequestError("Updates to audit_log are not permitted.")

@event.listens_for(AuditLog, 'before_delete', propagate=True)
def prevent_audit_log_deletes(mapper, connection, target):
    raise InvalidRequestError("Deletes from audit_log are not permitted.")
