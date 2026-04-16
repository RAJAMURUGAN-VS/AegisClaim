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

class ICDCPTCrosswalk(Base):
    """Coverage mapping between ICD-10 and CPT codes per plan/rule set."""
    __tablename__ = "icd_cpt_crosswalk"

    crosswalk_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    icd10_code = Column(String(16), nullable=False, index=True)
    cpt_code = Column(String(16), nullable=False, index=True)
    is_covered = Column(Boolean, default=True, nullable=False)

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


class BundledCPTRules(Base):
    """Rules for bundled CPT code combinations."""
    __tablename__ = "bundled_cpt_rules"

    rule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payer_id = Column(UUID(as_uuid=True), ForeignKey("payer_master.payer_id"), nullable=True)
    primary_cpt = Column(String(16), nullable=False, index=True)
    secondary_cpt = Column(String(16), nullable=False, index=True)
    rule_description = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)


class FraudDetectionConfig(Base):
    """Configurable fraud detection rules per payer."""
    __tablename__ = "fraud_detection_config"

    config_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payer_id = Column(UUID(as_uuid=True), ForeignKey("payer_master.payer_id"), nullable=False)
    anomaly_type = Column(String(60), nullable=False, index=True)
    statistical_threshold = Column(Numeric(5, 2), nullable=True)
    base_deduction = Column(Numeric(5, 2), default=0)
    severity_multiplier = Column(JSONB, default={"LOW": 0.5, "MEDIUM": 1.0, "HIGH": 1.5})
    is_active = Column(Boolean, default=True)


class SpecialtyBillingThresholds(Base):
    """Maximum claims per day thresholds by specialty."""
    __tablename__ = "specialty_billing_thresholds"

    threshold_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payer_id = Column(UUID(as_uuid=True), ForeignKey("payer_master.payer_id"), nullable=True)
    specialty = Column(String(100), nullable=False, index=True)
    max_claims_per_day = Column(Integer, nullable=False, default=8)
    is_active = Column(Boolean, default=True)
