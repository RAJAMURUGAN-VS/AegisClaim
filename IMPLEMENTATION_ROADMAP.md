# AuthGuard AI — Backend Implementation Roadmap
**Version 1.0** | Frontend-First Backend Development  
**Stack**: FastAPI · LangGraph · PostgreSQL · MongoDB · AWS Textract  
**Target**: Full multi-agent PA workflow with explainable decisions in <30 seconds  
**Last Updated**: April 14, 2026

---

## Executive Summary

This roadmap outlines the **step-by-step implementation** of the backend across 5 major phases:
1. **Data Layer**: Database schema & models
2. **Document Processing**: Agent A (OCR → Medical NLP → FHIR)
3. **Agent B & C**: Policy compliance & fraud detection
4. **Orchestration**: LangGraph StateGraph with complete workflow
5. **API & Integration**: Endpoints, request routing, output generation

**Estimated Timeline**: 4–6 weeks  
**Total Components**: 45+ files/modules, 12 agents/services  

---

## Phase 1: Data Layer Foundation (Week 1)

### 1.1 PostgreSQL Schema Completion

**File**: `models/postgres_models.py`

**Definition**: Implement complete SQLAlchemy ORM models

**Models to Implement**:
```python
1. PayerMaster           # Insurance companies (Blue Cross, Aetna, etc.)
2. PlanMaster           # Insurance plans per payer
3. PARequest            # Individual PA submission records
4. PAAuthorization      # Approved auth codes
5. PayerRules           # Dynamic payer policy rules (ICD-CPT coverage)
6. IcdCptCrosswalk      # Mapping of valid ICD-10 codes to CPT procedures
7. StepTherapyRules     # Step therapy requirements per plan
8. QuantityLimits       # Max quantity/duration per CPT code per plan
9. UserProfile          # Provider/Adjudicator/Admin users
10. AuditLog            # Immutable audit trail (append-only)
11. ProviderRiskScore   # Historical provider risk metrics
12. ClaimHistory        # Link to MongoDB claim records
```

**Key Steps**:
- [ ] Define all columns with proper types (UUID, ARRAY, JSONB where needed)
- [ ] Add constraints (NOT NULL, UNIQUE, FOREIGN KEY)
- [ ] Add timestamps (created_at, updated_at)
- [ ] Create database indexes on frequently queried fields
- [ ] Add enums for Status, RiskFlag, Decision types

**File Structure**:
```python
# pa-workflow/models/postgres_models.py

from sqlalchemy import Column, String, UUID, JSONB, ForeignKey, Enum, ARRAY
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class PayerMaster(Base):
    __tablename__ = "payer_master"
    payer_id = Column(UUID(as_uuid=True), primary_key=True)
    payer_name = Column(String(200), unique=True, nullable=False)
    contact_email = Column(String(120))
    is_active = Column(Boolean, default=True)
    # ... more fields
    rule_versions = relationship("PayerRules")

class PlanMaster(Base):
    __tablename__ = "plan_master"
    plan_id = Column(UUID(as_uuid=True), primary_key=True)
    payer_id = Column(UUID, ForeignKey("payer_master.payer_id"))
    plan_name = Column(String(200), nullable=False)
    pa_required = Column(Boolean, default=False)
    dynamic_doc_checklist = Column(JSONB)  # {"treatment_type": ["doc1", "doc2"]}
    # ... more fields

class PARequest(Base):
    __tablename__ = "pa_requests"
    pa_id = Column(UUID(as_uuid=True), primary_key=True)
    payer_id = Column(UUID, ForeignKey("payer_master.payer_id"))
    patient_member_id = Column(String(50), nullable=False)
    status = Column(Enum(StatusEnum), default="PENDING")
    # ... more fields
    audit_logs = relationship("AuditLog")

# ... other models
```

---

### 1.2 MongoDB Schema Definition

**File**: `models/mongo_models.py`

**Collections to Create**:
```javascript
1. claims_history
   {
     _id: ObjectId,
     patient_member_id: String,
     payer_id: UUID,
     past_claims: [{pa_id, cpt_code, decision, amount, date}],
     duplicate_count: Int,
     high_frequency_flags: [String]
   }

2. fraud_signals
   {
     _id: ObjectId,
     provider_npi: String,
     signal_type: "UPCODING" | "DUPLICATE" | "IMPOSSIBLE_DAY",
     severity: "LOW" | "MEDIUM" | "HIGH",
     timestamp: Date,
     metadata: Object
   }

3. audit_trail
   {
     _id: ObjectId,
     pa_id: UUID,
     event_type: String,
     agent: "AGENT_A" | "AGENT_B" | "AGENT_C" | "ORCHESTRATOR",
     input: Object,
     output: Object,
     timestamp: Date
   }
```

**Implementation**:
```python
# pa-workflow/models/mongo_models.py

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class ClaimRecord(BaseModel):
    pa_id: str
    cpt_code: str
    decision: str
    amount: float
    date: datetime

class ClaimsHistory(BaseModel):
    patient_member_id: str
    payer_id: str
    past_claims: List[ClaimRecord] = []
    duplicate_count: int = 0
    high_frequency_flags: List[str] = []
    
    class Config:
        collection = "claims_history"
```

---

### 1.3 Alembic Migrations

**File**: `alembic/versions/001_initial_schema.py`

**Steps**:
- [ ] Initialize Alembic: `alembic init`
- [ ] Configure `alembic/env.py` with SQLAlchemy URL
- [ ] Create migration: `alembic revision --autogenerate -m "Initial schema"`
- [ ] Write migration to create all 12 PostgreSQL tables
- [ ] Add MongoDB collection creation in post-migration script

---

### 1.4 Database Connection & Factories

**File**: `core/database.py`

**Functions to Implement**:
```python
async def connect_db()        # PostgreSQL connection pool
async def disconnect_db()     # Cleanup
async def get_db()           # Dependency injection
async def connect_mongo()    # MongoDB client
async def get_mongo_db()     # Get MongoDB database
async def create_indexes()   # Create MongoDB indexes
```

---

## Phase 2: Agent A Implementation (Week 1-2)

### 2.1 OCR Service Layer

**File**: `services/ocr_service.py`

**Functions**:
```python
class OCRService:
    async def extract_with_textract(document_path: str) -> OCRResult
    async def extract_with_paddleocr(document_path: str) -> OCRResult
    async def upload_to_s3(file_bytes: bytes) -> str  # Returns S3 URL
    async def get_ocr_confidence(result: OCRResult) -> float
```

**Implementation Details**:
- Retry logic for AWS Textract (exponential backoff)
- Fallback to PaddleOCR if Textract fails
- S3 storage for original documents
- Confidence score aggregation across pages

---

### 2.2 Medical NLP Service

**File**: `services/nlp_service.py`

**Functions**:
```python
class MedicalNLPService:
    async def extract_icd10_codes(text: str) -> List[str]
    async def extract_cpt_codes(text: str) -> List[str]
    async def extract_rxnorm_codes(text: str) -> List[str]
    async def detect_negation(text: str) -> List[str]  # Negated codes
    async def extract_key_entities(text: str) -> Dict  # Conditions, medications, procedures
```

**Tools**:
- `medspacy` for clinical entity recognition
- `scispacy` for biomedical NLP
- Custom regex patterns for code detection
- RxNorm API calls for medication validation

---

### 2.3 FHIR R4 Structuring

**File**: `services/fhir_service.py`

**Functions**:
```python
class FHIRService:
    def create_patient_resource(patient_data: dict) -> Patient
    def create_condition_resource(icd10_code: str) -> Condition
    def create_procedure_resource(cpt_code: str) -> Procedure
    def create_medication_request(rxnorm_code: str) -> MedicationRequest
    def bundle_resources(patient, conditions, procedures) -> Bundle
    def validate_against_fhir_r4(bundle: Bundle) -> bool
```

**Implementation Details**:
- Use `fhir.resources` library for FHIR R4 models
- Map OCR text → ICD-10/CPT → FHIR resources
- Validate bundle against FHIR R4 schema
- Return Bundle as JSON for APIs

---

### 2.4 Agent A Complete Implementation

**File**: `agents/agent_a.py`

**Updated Class**:
```python
class DocumentProcessorAgent:
    async def process_documents(
        pa_id: UUID,
        document_paths: List[str],
        patient_data: dict
    ) -> AgentAOutput:
        """
        Complete pipeline:
        1. Upload to S3 → Get S3 URLs
        2. For each document:
           - OCR (Textract or PaddleOCR)
           - Text cleaning
           - Medical NLP (extract ICD-10, CPT, RxNorm)
           - Negation detection
        3. FHIR structuring (Patient → Conditions → Procedures)
        4. Return AgentAOutput with confidence scores
        """
        # Implementation steps outline
```

**Pseudo-code**:
```python
async def process_documents(...):
    ocr_results = []
    
    for doc_path in document_paths:
        # 1. Upload & OCR
        s3_url = await upload_to_s3(doc_path)
        ocr_result = await extract_with_textract(s3_url)
        ocr_results.append(ocr_result)
        
        # 2. Medical NLP
        icd10 = await extract_icd10_codes(ocr_result.text)
        cpt = await extract_cpt_codes(ocr_result.text)
        rxnorm = await extract_rxnorm_codes(ocr_result.text)
    
    # 3. FHIR Structuring
    patient_resource = fhir_service.create_patient_resource(patient_data)
    condition_resources = [fhir_service.create_condition_resource(code) for code in icd10]
    procedure_resources = [fhir_service.create_procedure_resource(code) for code in cpt]
    
    fhir_bundle = fhir_service.bundle_resources(patient_resource, condition_resources, procedure_resources)
    
    return AgentAOutput(
        pa_id=pa_id,
        fhir_bundle=fhir_bundle,
        ocr_results=ocr_results,
        medical_codes=MedicalCodes(...),
        overall_confidence=avg([r.confidence_score for r in ocr_results])
    )
```

**Unit Tests**:
- [ ] Test OCR with sample medical PDF
- [ ] Test ICD-10/CPT extraction accuracy
- [ ] Test FHIR bundle validation
- [ ] Mock AWS Textract responses

---

## Phase 3: Agent B & C Implementation (Week 2)

### 3.1 Agent B: Policy Compliance

**File**: `agents/agent_b.py`

**Class**:
```python
class PolicyComplianceAgent:
    async def validate_coverage(
        fhir_bundle: Dict,
        plan_id: UUID
    ) -> AgentBOutput:
        """
        1. Fetch payer rules from PostgreSQL
        2. ICD-10 ↔ CPT crosswalk validation
        3. Step therapy check
        4. Quantity limit validation  
        5. Prior auth history check
        6. Return policy_score (0-100)
        """

async def run(state: PAWorkflowState) -> PAWorkflowState:
    agent = PolicyComplianceAgent()
    
    # Extract from FHIR bundle
    icd10_codes = extract_icd10_from_bundle(state.agent_a_output.fhir_bundle)
    cpt_codes = extract_cpt_from_bundle(state.agent_a_output.fhir_bundle)
    
    # 1. Fetch payer rules
    payer_rules = await fetch_payer_rules(state['plan_id'])
    
    # 2. ICD-CPT Crosswalk
    valid_pairs = await validate_icd_cpt_match(icd10_codes, cpt_codes, payer_rules)
    
    # 3. Step Therapy
    step_therapy_passed = await check_step_therapy(state, payer_rules)
    
    # 4. Quantity Limits
    qty_ok = await validate_quantity_limits(cpt_codes, state['requested_quantity'], payer_rules)
    
    # 5. Duplicate check
    is_duplicate = await check_duplicate_pa(state['patient_member_id'], cpt_codes)
    
    # 6. Calculate policy_score
    score = calculate_policy_score(
        icd_cpt_match=valid_pairs,
        step_therapy=step_therapy_passed,
        qty_ok=qty_ok,
        duplicate=is_duplicate
    )
    
    return AgentBOutput(
        policy_score=score,
        compliance_flags=[...],
        matched_rule_id=payer_rules.rule_id
    )
```

**Database Queries**:
```sql
-- Fetch payer rules
SELECT * FROM payer_rules 
WHERE payer_id = ? AND plan_id = ? AND is_active = true;

-- ICD-CPT Crosswalk validation
SELECT * FROM icd_cpt_crosswalk 
WHERE icd10_code IN (?) AND cpt_code IN (?);

-- Check for duplicates
SELECT COUNT(*) FROM pa_requests 
WHERE patient_member_id = ? AND pa_id = ? AND status = 'APPROVED';
```

---

### 3.2 Agent C: Fraud Detection

**File**: `agents/agent_c.py`

**Class**:
```python
class FraudAnomalyAgent:
    async def detect_fraud_signals(
        pa_request: PAWorkflowState,
        patient_member_id: str,
        provider_npi: str
    ) -> AgentCOutput:
        """
        1. Claim history check (MongoDB)
        2. Provider risk scoring
        3. Billing anomalies (upcoding, unbundling, impossible day)
        4. Return fraud_score (0-100), risk_flag, anomaly_flags
        """

async def run(state: PAWorkflowState) -> PAWorkflowState:
    agent = FraudAnomalyAgent()
    mongo_db = await get_mongo_db()
    
    # 1. Claim History Check
    claim_history = await mongo_db.claims_history.find_one(
        {"patient_member_id": state['patient_member_id']}
    )
    
    duplicate_count = len([c for c in claim_history.past_claims if c.cpt_code == state['cpt_codes'][0]])
    is_duplicate = duplicate_count > 3  # Too many submissions for same code
    
    # 2. Provider Risk Score
    provider_risk = await calculate_provider_risk_score(state['provider_npi'])
    
    # 3. Billing Anomalies
    anomalies = []
    
    # Upcoding: CPT code higher complexity than diagnosis warrants
    if await is_upcoding_signal(state['cpt_codes'], state['patient_data']):
        anomalies.append("UPCODING_DETECTED")
    
    # Unbundling: Procedure codes shouldn't be billed separately
    if await is_unbundling_signal(state['cpt_codes']):
        anomalies.append("UNBUNDLING_DETECTED")
    
    # Impossible billing: Multiple codes on same day not medically feasible
    if await is_impossible_combination(state['cpt_codes']):
        anomalies.append("IMPOSSIBLE_DAY_BILLING")
    
    # 4. Risk Flag Assignment
    if len(anomalies) > 2:
        risk_flag = "HIGH"
    elif len(anomalies) > 0 or provider_risk > 0.7:
        risk_flag = "MEDIUM"
    else:
        risk_flag = "LOW"
    
    # 5. Calculate fraud_score (inverted: higher = less risky)
    fraud_score = 100 - (provider_risk * 100 + len(anomalies) * 15)
    
    return AgentCOutput(
        fraud_score=max(0, fraud_score),
        risk_flag=risk_flag,
        anomaly_flags=anomalies,
        provider_risk_score=provider_risk
    )
```

**MongoDB Queries**:
```python
# Fetch claim history
db.claims_history.find_one({"patient_member_id": member_id})

# Record fraud signal
db.fraud_signals.insert_one({
    "provider_npi": npi,
    "signal_type": "UPCODING",
    "severity": "HIGH",
    "timestamp": datetime.now()
})
```

---

## Phase 4: LangGraph Orchestration (Week 2-3)

### 4.1 Complete StateGraph Implementation

**File**: `agents/orchestrator.py`

**Full StateGraph**:
```python
from langgraph.graph import StateGraph, START, END

# 1. Create workflow graph
workflow = StateGraph(PAWorkflowState)

# 2. Add nodes
workflow.add_node("policy_selector", run_policy_selector)
workflow.add_node("document_processor", run_document_processor)
workflow.add_node("policy_compliance", run_policy_compliance)
workflow.add_node("fraud_detection", run_fraud_detection)
workflow.add_node("decision_engine", run_decision_engine)
workflow.add_node("generate_output", run_generate_output)

# 3. Add edges (routing logic)
workflow.add_edge(START, "policy_selector")

# After policy selector: check if PA required
workflow.add_conditional_edges(
    "policy_selector",
    lambda state: "END" if not state.get("pa_required") else "document_processor",
    {"END": END, "document_processor": "document_processor"}
)

# Document processor: check for missing docs
workflow.add_conditional_edges(
    "document_processor",
    lambda state: "RETRY" if state["missing_documents"] else "parallel",
    {
        "RETRY": "document_processor",  # Loop back (retry)
        "parallel": "policy_compliance"
    }
)

# Run Agents B & C in parallel
workflow.add_node("parallel_agents", run_agents_in_parallel)
workflow.add_edge("policy_compliance", "decision_engine")
workflow.add_edge("fraud_detection", "decision_engine")

# Decision engine: route to output
workflow.add_conditional_edges(
    "decision_engine",
    lambda state: state["decision"],  # AUTO_APPROVE, HUMAN_REVIEW, AUTO_DENY
    {
        "AUTO_APPROVE": "generate_output",
        "HUMAN_REVIEW": "generate_output",
        "AUTO_DENY": "generate_output"
    }
)

workflow.add_edge("generate_output", END)

# 4. Compile
app = workflow.compile()
```

###  4.2 Decision Engine Implementation

**File**: `agents/decision_engine.py`

**Scoring Logic**:
```python
async def run_decision_engine(state: PAWorkflowState) -> PAWorkflowState:
    """
    Final Score = (Policy Score × 0.40) + (Clinical Match × 0.35) + (Fraud Score × 0.25)
    """
    
    policy_score = state['agent_b_output'].policy_score  # 0-100
    clinical_score = calculate_clinical_match_score(state)  # 0-100
    fraud_score = state['agent_c_output'].fraud_score  # 0-100 (inverted)
    
    final_score = (
        policy_score * 0.40 +
        clinical_score * 0.35 +
        fraud_score * 0.25
    )
    
    state['final_score'] = final_score
    
    # Risk flag override: HIGH always goes to human review
    if state['agent_c_output'].risk_flag == "HIGH":
        state['decision'] = "HUMAN_REVIEW"
        return state
    
    # Score-based routing
    if final_score >= 85:
        state['decision'] = "AUTO_APPROVE"
    elif final_score >= 60:
        state['decision'] = "HUMAN_REVIEW"
    else:
        state['decision'] = "AUTO_DENY"
    
    # Log decision with SHAP explanation
    await log_decision_explanation(state, final_score)
    
    return state
```

### 4.3 Orchestrator Execution

**Entry Point**:
```python
async def run_pa_workflow(request_data: dict) -> PAWorkflowState:
    """Main orchestrator entry point."""
    
    initial_state = PAWorkflowState(
        pa_id=uuid4(),
        payer_id=request_data['payer_id'],
        # ... other fields
        status="PENDING",
        retry_count=0
    )
    
    # Run the workflow
    final_state = await app.ainvoke(initial_state)
    
    # Persist to database
    await save_pa_request_to_db(final_state)
    
    return final_state
```

---

## Phase 5: API & Integration (Week 3-4)

### 5.1 PA Submission Endpoint

**File**: `api/routes/pa_routes.py`

**Updated Endpoint**:
```python
@router.post("/pa/submit", response_model=PAStatusResponse, status_code=202)
async def submit_pa_request(
    request: PASubmitRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """
    Submit PA request with document upload
    1. Validate input
    2. Store files in S3
    3. Queue workflow
    4. Return pa_id immediately
    """
    
    pa_id = uuid4()
    
    # 1. Validate
    validation_errors = validate_pa_request(request)
    if validation_errors:
        raise HTTPException(400, detail=validation_errors)
    
    # 2. Upload documents to S3
    s3_urls = []
    for file in request.documents:
        url = await upload_document_to_s3(pa_id, file)
        s3_urls.append(url)
    
    # 3. Create PA record in DB
    db = await get_db()
    pa_record = PARequest(
        pa_id=pa_id,
        payer_id=request.payer_id,
        patient_member_id=request.patient_member_id,
        provider_npi=request.provider_npi,
        cpt_codes=request.cpt_codes,
        status="PENDING",
        document_urls=s3_urls
    )
    db.add(pa_record)
    await db.commit()
    
    # 4. Queue workflow
    workflow_data = request.model_dump()
    workflow_data.update({
        "pa_id": pa_id,
        "document_paths": s3_urls,
        "user_id": current_user.id
    })
    
    background_tasks.add_task(run_pa_workflow, workflow_data)
    
    return PAStatusResponse(
        pa_id=pa_id,
        status="PENDING",
        message="PA submitted successfully"
    )
```

### 5.2 PA Status Endpoint

**Endpoint**:
```python
@router.get("/pa/{pa_id}", response_model=PADetailResponse)
async def get_pa_status(
    pa_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """Fetch PA status with full details and AI explanation."""
    
    db = await get_db()
    pa_record = await db.query(PARequest).filter(PARequest.pa_id == pa_id).first()
    
    if not pa_record:
        raise HTTPException(404, detail="PA not found")
    
    # Check if decision is ready (cached in Redis)
    redis = await get_redis_client()
    decision_key = f"pa_decision_{pa_id}"
    
    if cached_decision := await redis.get(decision_key):
        final_state = json.loads(cached_decision)
    else:
        # Still processing
        return PADetailResponse(
            pa_id=pa_id,
            status="PROCESSING",
            progress_percent=50  # Estimate
        )
    
    # Build response with AI explanation
    return PADetailResponse(
        pa_id=pa_id,
        status=final_state['status'],
        decision=final_state['decision'],
        final_score=final_state['final_score'],
        auth_code=final_state.get('auth_code'),
        risk_flag=final_state['agent_c_output']['risk_flag'],
        explanation=generate_explanation(final_state),
        agent_outputs={
            "agent_a": final_state['agent_a_output'],
            "agent_b": final_state['agent_b_output'],
            "agent_c": final_state['agent_c_output']
        }
    )
```

### 5.3 Output Generation

**File**: `services/output_service.py`

**Functions**:
```python
async def generate_auth_code() -> str
    """Create unique authorization code: PA-YYYY-XXXXXX"""

async def generate_approval_pdf(pa_id: UUID) -> bytes
    """Generate PDF approval letter"""

async def generate_denial_letter(pa_id: UUID, reason: str) -> bytes
    """Generate PDF denial with appeals info"""

async def generate_appeals_draft(pa_id: UUID) -> str
    """Use Claude to draft appeals letter"""

async def send_notifications(pa_id: UUID, decision: str) -> None
    """Send WhatsApp/SMS/Email notifications"""
```

---

## Implementation Checklist

### Week 1
- [ ] Complete PostgreSQL schema (all 12 tables)
- [ ] Create Alembic migrations
- [ ] Implement MongoDB collections
- [ ] Agent A: OCR service + medical NLP + FHIR
- [ ] Unit tests for Agent A

### Week 2
- [ ] Agent B: Policy compliance checks
- [ ] Agent C: Fraud detection & risk scoring
- [ ] Complete LangGraph StateGraph
- [ ] Decision engine scoring formula
- [ ] Integration tests

### Week 3
- [ ] API endpoints (submit, status, documents)
- [ ] Background workflow execution
- [ ] Redis caching for decision results
- [ ] Output generation (auth codes, letters)
- [ ] Notification service

### Week 4
- [ ] End-to-end integration testing
- [ ] Performance optimization (<30s target)
- [ ] Logging (audit trail to PostgreSQL + MongoDB)
- [ ] Error handling & retries
- [ ] Documentation

---

## Key Metrics

| Metric | Target |
|--------|--------|
| PA Processing Time | < 30 seconds |
| OCR Accuracy | > 95% |
| Auto-Approve Rate | 60-70% |
| Human Review Rate | 20-30% |
| Auto-Deny Rate | 5-10% |
| API Availability | 99.9% |
| Database Query Time | < 200ms |

---

## Next Steps

1. **Immediate**: Set up requirements.txt & virtual environment
2. **This Week**: Implement Phase 1 (database layer)
3. **Next Week**: Complete Agents A, B, C
4. **Week 3**: LangGraph orchestration + API endpoints
5. **Week 4**: Testing, optimization, production readiness

---

**Document Version**: 1.0  
**Last Updated**: April 14, 2026  
**Prepared for**: AuthGuard AI Development Team
