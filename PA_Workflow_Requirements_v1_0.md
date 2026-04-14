# AI-Powered Prior Authorization (PA) Workflow
**Software Requirements Specification**  
Healthcare AI Automation Division  
Version 1.0 | Stack: Python · LangGraph · AWS Textract · PostgreSQL · MongoDB · FastAPI

---

## Version History
- v1.0 — Initial Release: Sections 1–10 covering all 4 layers, agents, DB schema, API surface, NFRs, and security.

---

## Table of Contents
1. System Overview & Agent Roles
2. Input Layer — Layer 1
3. Processing Layer — Layer 2 (Multi-Agent Orchestration)
4. Decision Engine — Layer 3
5. Output & Communication — Layer 4
6. Business Rules — Master List
7. API Surface
8. Database Schema
9. Non-Functional Requirements
10. Security & Compliance

---

## 1. System Overview & Agent Roles

This system automates the Prior Authorization (PA) workflow for health insurance using a multi-agent AI pipeline built on LangGraph. It replaces manual, paper-based PA processes with an intelligent, auditable, and scalable digital workflow accessible via hospital portals, EHR integrations, and mobile/web interfaces.

The pipeline has four layers: Input → Processing (Multi-Agent) → Decision Engine → Output & Communication.

### 1.1 System Components

| Component | Short Name | Responsibilities |
|---|---|---|
| Hospital Portal / EHR API | EHR_API | Submits PA requests, patient demographics, clinical notes, and documents via REST/FHIR R4 API |
| Policy Selector Agent | PSA | Identifies payer, insurance plan, and treatment type; generates dynamic document checklist |
| Agent A — Document Processor | DOC_PROC | OCR via AWS Textract → text cleaning → medical NLP (ICD-10, CPT, RxNorm) → FHIR R4 structuring |
| Agent B — Policy Compliance Agent | POL_COMP | Fetches payer rules from PostgreSQL Rule Store; checks diagnosis↔treatment match, step therapy, quantity limits; produces coverage decision score |
| Agent C — Fraud & Anomaly Agent | FRAUD_AGT | Claim history check (MongoDB), provider risk scoring, billing pattern anomaly detection; emits risk flag (Low/Medium/High) |
| Orchestrator (LangGraph StateGraph) | ORCH | Coordinates Agents A, B, C; handles missing-document retry loop; escalates to human if confidence < threshold |
| Decision Engine | DEC_ENG | Confidence-weighted scoring: Policy Score (40%) + Clinical Match (35%) + Fraud Score (25%); routes to AUTO-APPROVE, HUMAN REVIEW, or AUTO-DENY |
| Output & Communication Layer | OUT_COMM | Sends approval codes, denial letters, adjudicator dashboards, SHAP explanations, GenAI appeals drafts; notifies via WhatsApp/SMS, Portal, Email |

---

## 2. Input Layer — Layer 1

### 2.1 Hospital Portal / EHR API

Entry point of the system. All PA requests originate from hospital EHR systems or provider portals.

#### 2.1.1 Accepted Input Channels

| Channel | Protocol | Notes |
|---|---|---|
| Hospital EHR System | FHIR R4 REST API | Primary integration path; HL7 FHIR R4 compliant |
| Provider Web Portal | HTTPS Form Upload | Manual submission via browser-based portal |
| Direct API Integration | REST (JSON) | For third-party payer system integrations |

#### 2.1.2 Required Input Fields

| # | Field | Type | Validation |
|---|---|---|---|
| 1 | Patient Member ID | String | Alphanumeric, 8–20 chars; must match payer records |
| 2 | Payer / Insurance Company | String | Must resolve to a record in payer_master table |
| 3 | Insurance Plan ID | String | Must be linked to valid plan in plan_master |
| 4 | Requesting Provider NPI | String (10-digit) | Must be a valid NPI; checked against NPPES registry |
| 5 | Diagnosis Code(s) | ICD-10 Array | At least one valid ICD-10-CM code required |
| 6 | Procedure / Treatment Code(s) | CPT / HCPCS Array | At least one CPT or HCPCS code required |
| 7 | Date of Service (Requested) | Date (ISO 8601) | Cannot be in the past beyond 90 days |
| 8 | Clinical Notes / Referral Letter | File (PDF/Image) | Optional but improves confidence score; max 10MB |
| 9 | Prior Treatment History | Text / File | Required for step therapy validation |
| 10 | Medication Name & Dosage (if Rx) | RxNorm String | Required for Medication PA requests only |

### 2.2 Policy Selector Agent (PSA)

First AI agent invoked after input receipt. Identifies payer rules and generates a dynamic document checklist.

#### 2.2.1 PSA Logic
- Input: Member ID, Payer ID, Plan ID, Diagnosis codes, CPT codes
- Queries plan_master and payer_rules tables in PostgreSQL
- Determines treatment type: Inpatient / Outpatient / Specialist Referral / Pharmacy
- Checks if treatment type requires PA (some plans exempt routine care)
- Generates dynamic required-documents checklist based on payer + plan + treatment combination
- Returns: PA_Required flag, document_checklist[], payer_rule_version, plan_tier

#### 2.2.2 Dynamic Document Checklist Rules

| Condition / Treatment Type | Always Required | Conditionally Required |
|---|---|---|
| All PA Requests | Member ID, NPI, ICD-10, CPT | — |
| Inpatient Admission | Admission letter, clinical summary | Specialist referral (if applicable) |
| Specialty Drugs / Pharmacy | Prescription, diagnosis justification | Step therapy failure proof, prior Rx history |
| Surgical Procedure | Surgeon letter, pre-op notes | Second opinion (if plan mandates) |
| Mental Health / Behavioral | DSM-5 diagnosis, treating physician note | Treatment history for last 90 days |

> **NOTE:** If any required document is missing, the ORCH agent triggers a missing-document retry loop before proceeding to Agents A, B, C.

---

## 3. Processing Layer — Layer 2 (Multi-Agent Orchestration)

Layer 2 is the intelligence core. Built using LangGraph StateGraph with three specialised agents (A, B, C) coordinated by a central Orchestrator.

### 3.1 Agent A — Document Processor (DOC_PROC)

Ingests, extracts, cleans, and structures submitted documents into FHIR R4-compliant data objects.

#### 3.1.1 Processing Pipeline

| Step | Stage | Details |
|---|---|---|
| 1 | OCR — AWS Textract | Processes PDF, JPEG, PNG, TIFF; extracts text, tables, key-value pairs; confidence score per field |
| 2 | Text Cleaning | Normalises whitespace, removes boilerplate headers/footers, corrects OCR artefacts using medical dictionary |
| 3 | Medical NLP | ICD-10 extraction and normalisation; CPT/HCPCS identification; RxNorm drug normalisation; negation detection |
| 4 | FHIR R4 Structuring | Maps to FHIR R4 resources: Patient, Condition (ICD-10), MedicationRequest (Rx), Procedure (CPT), Claim |

#### 3.1.2 Agent A Output
- Structured FHIR R4 JSON bundle (Patient, Condition, MedicationRequest, Procedure)
- OCR confidence score per document (0.0–1.0); documents below 0.7 flagged for human review
- Extracted ICD-10, CPT, RxNorm codes list
- Missing fields list

### 3.2 Agent B — Policy Compliance Agent (POL_COMP)

Evaluates the PA request against payer coverage policies stored in the PostgreSQL Rule Store.

#### 3.2.1 Compliance Check Pipeline

| Step | Check | Logic |
|---|---|---|
| 1 | Fetch Payer Rules | Query payer_rules table using {payer_id, plan_id, treatment_type}; load active rule version |
| 2 | Diagnosis ↔ Treatment Match | Validate ICD-10 codes are covered indications for the requested CPT procedure via ICD-CPT crosswalk table |
| 3 | Step Therapy Validation | If plan requires step therapy, verify prior treatment history shows failed step; deny if no prior step evidence |
| 4 | Quantity / Duration Limits | Check requested quantity/dosage against plan's allowed limits; flag overages as non-compliant |
| 5 | Prior Treatment History | Review prior PA records for same patient; detect duplicates; identify potential over-utilisation |
| 6 | Coverage Decision Score | Aggregate all check results into policy_score (0–100); contributes 40% weight to final score |

#### 3.2.2 Agent B Output
- policy_score: 0–100
- compliance_flags[]: list of failed checks (e.g., 'STEP_THERAPY_NOT_MET', 'QTY_LIMIT_EXCEEDED')
- matched_rule_id: ID of the specific payer rule applied
- step_therapy_status: PASSED / FAILED / NOT_APPLICABLE

### 3.3 Agent C — Fraud & Anomaly Agent (FRAUD_AGT)

Analyses claim history and provider behaviour to detect fraud, abuse, and anomalies.

#### 3.3.1 Fraud Detection Pipeline

| Step | Check | Logic |
|---|---|---|
| 1 | Claim History Check | Query MongoDB claims_history for patient's last 24 months; identify duplicate patterns, high-frequency submissions |
| 2 | Provider Risk Scoring | Calculate provider_risk_score based on prior denial rate, anomaly flags, peer comparison for same specialty/region |
| 3 | Billing Pattern Anomaly | Detect: upcoding (higher-complexity codes), unbundling (splitting procedures), impossible day billing |
| 4 | Risk Flag Assignment | Low: no anomalies. Medium: 1–2 minor flags. High: multiple flags or known fraud pattern → mandatory human review |

#### 3.3.2 Agent C Output
- fraud_score: 0–100 (higher = lower risk; inverted for scoring)
- risk_flag: LOW / MEDIUM / HIGH
- anomaly_flags[]: list of detected anomalies (e.g., 'UPCODING_DETECTED', 'DUPLICATE_CLAIM')
- provider_risk_score: 0.0–1.0

### 3.4 Orchestrator — LangGraph StateGraph (ORCH)

Control layer that coordinates the three agents and manages the overall state machine for each PA request.

#### 3.4.1 Orchestration Logic
- Receives structured input from PSA (document checklist, payer rules version)
- Dispatches documents to Agent A for processing
- On Agent A completion: dispatches FHIR bundle to Agents B and C in parallel
- Missing-document retry loop: if Agent A reports missing_fields, send document request to portal and wait up to 48 hours
- Escalate to human reviewer if aggregate score < 60
- Manages state transitions: PENDING → PROCESSING → SCORING → DECIDED → NOTIFIED
- Logs all state transitions to audit_log table

#### 3.4.2 Retry & Escalation Rules

| Condition | Action | Timeout / Limit |
|---|---|---|
| Missing required document | Retry request | 48-hour window; max 2 retry attempts |
| OCR confidence < 0.7 | Human review flag | Immediate escalation |
| Aggregate score < 60 with no clear exclusion | Human review queue | SLA: reviewed within 24 business hours |
| Risk flag = HIGH | Mandatory human review | Cannot auto-approve or auto-deny |
| Missing-doc timeout exceeded | Auto-deny (incomplete) | Denial reason: INCOMPLETE_SUBMISSION |

---

## 4. Decision Engine — Layer 3

Aggregates outputs from all three agents into a confidence-weighted score and routes the request to one of three outcomes.

### 4.1 Scoring Formula

```
Final Score = (Policy Score × 0.40) + (Clinical Match Score × 0.35) + (Fraud Score × 0.25)
```

| Score Component | Weight | Source Agent | Description |
|---|---|---|---|
| Policy Score | 40% | Agent B (POL_COMP) | Payer rule compliance result; 100 = full coverage match |
| Clinical Match Score | 35% | Agent A + B | ICD-10/CPT/NLP match quality and medical necessity confidence |
| Fraud Score | 25% | Agent C (FRAUD_AGT) | Inverted fraud risk: 100 = low risk (clean), 0 = high risk |

### 4.2 Decision Thresholds & Routing

| Decision | Condition | Routing |
|---|---|---|
| AUTO-APPROVE | Score ≥ 85 AND Risk Flag = LOW | Generate auth code, validity period, conditions |
| HUMAN REVIEW | Score 60–84 OR Risk Flag = MEDIUM | Route to adjudicator dashboard with SHAP explanation |
| AUTO-DENY | Score < 60 OR Clear Policy Exclusion | Generate denial reason, cite policy clause, draft appeals letter |

> **NOTE:** Risk Flag = HIGH always forces HUMAN REVIEW regardless of numerical score.

### 4.3 Override Rules
- Risk Flag = HIGH → always HUMAN REVIEW, overrides score
- Score ≥ 85 is insufficient for AUTO-APPROVE if any compliance_flag is CRITICAL
- AUTO-DENY requires at least one explicit policy exclusion code or score < 60
- Adjudicator override is final and logged in audit_log with override reason

---

## 5. Output & Communication — Layer 4

### 5.1 AUTO-APPROVE Output

| Output Field | Details |
|---|---|
| Authorization Code | Unique code format: PA-{YEAR}-{XXXXXX}; stored in pa_authorizations table |
| Validity Period | Default 90 days from approval date; plan-defined validity may vary |
| Conditions / Limitations | e.g., 'Approved for 30 units only'; 'Requires specialist follow-up at 30 days' |
| Approval Document (PDF) | Generated PDF stored in S3 with auth code, patient info, treatment details |

### 5.2 HUMAN REVIEW Output (Adjudicator Dashboard)
- Patient summary, submitted documents, extracted FHIR data
- AI recommendation with confidence score and reasoning narrative
- SHAP breakdown: contribution of each factor to the final score
- Compliance flags and fraud flags with severity levels
- Adjudicator actions: Approve, Deny, Request more info, Escalate to Medical Director
- All actions logged to audit_log with timestamp and user ID

### 5.3 AUTO-DENY Output

| Output Component | Details |
|---|---|
| Plain-Language Reason | Patient/provider-friendly explanation; no technical jargon |
| Policy Clause Citation | Specific payer policy section that failed, e.g., 'Section 4.2.1 — Step Therapy Requirement Not Met' |
| Missing Document Request | Specific list of required documents for resubmission if denial is due to missing docs |
| GenAI Appeals Letter Draft | Pre-drafted appeals letter citing clinical evidence, patient history, medical guidelines |

### 5.4 Notification Matrix

| Event | Recipient | WhatsApp/SMS | Portal | Email |
|---|---|---|---|---|
| PA Submitted | Patient, Hospital | ✓ Patient | ✓ Hospital | ✓ Hospital |
| PA Auto-Approved | Patient, Hospital, TPA | ✓ Patient | ✓ Hospital | ✓ TPA |
| PA Under Review | Patient, Hospital | ✓ Patient | ✓ Hospital | ✗ |
| PA Denied | Patient, Hospital, TPA | ✓ Patient | ✓ Hospital | ✓ TPA |
| Missing Document Alert | Hospital, Provider | ✗ | ✓ Hospital | ✓ Provider |
| PA Expiry Reminder | Patient, Hospital | ✓ Patient (7 days prior) | ✓ Hospital | ✗ |

---

## 6. Business Rules — Master List

| ID | Rule | Detail |
|---|---|---|
| BR-01 | PA Required Check | Not all treatments require PA. PSA must check PA_required flag in plan_master before initiating pipeline. |
| BR-02 | Document Completeness Gate | PA request cannot proceed to Agent B or C if required documents are missing; ORCH triggers retry loop first. |
| BR-03 | ICD-CPT Crosswalk | Diagnosis code must be a covered indication for the requested procedure per ICD-CPT crosswalk table. |
| BR-04 | Step Therapy Enforcement | If step_therapy_required = true in payer rules, prior step must be documented and failed; no bypass allowed. |
| BR-05 | Quantity Limit Cap | Requested quantity/dosage cannot exceed plan-defined max_quantity; partial approval allowed up to plan max. |
| BR-06 | Duplicate PA Detection | If identical PA (same patient, CPT, payer) exists with APPROVED status within validity period, auto-deny. |
| BR-07 | High-Risk Override | Risk Flag = HIGH always routes to HUMAN REVIEW regardless of final score. |
| BR-08 | OCR Confidence Floor | Documents with OCR confidence < 0.70 must be flagged; cannot be fully automated. |
| BR-09 | Score Tie-Breaking | If score = 60 exactly, route to HUMAN REVIEW (not AUTO-DENY). |
| BR-10 | Appeals Letter Trigger | Every AUTO-DENY must generate a GenAI appeals letter draft. |
| BR-11 | Auth Code Uniqueness | Format: PA-{YYYY}-{6-digit-random}; collision check required before issuance. |
| BR-12 | Audit Log Immutability | All audit_log records are append-only; no updates or deletes permitted. |
| BR-13 | Adjudicator SLA | Human review queue items actioned within 24 business hours; auto-escalation to Medical Director at 48 hours. |
| BR-14 | PA Expiry | Services rendered after expiry are not covered; renewal requires new PA submission. |
| BR-15 | FHIR Compliance | All patient data exchanged externally must conform to FHIR R4 standard. |

---

## 7. API Surface

### 7.1 PA Submission Endpoints

| Method | Auth | Endpoint | Description |
|---|---|---|---|
| POST | API Key + JWT | /api/v1/pa/submit | Submit new PA request with patient data and documents |
| GET | JWT | /api/v1/pa/{pa_id} | Get PA request status and details by ID |
| POST | JWT | /api/v1/pa/{pa_id}/documents | Upload additional/missing documents for a pending PA |
| GET | JWT | /api/v1/pa/{pa_id}/status | Lightweight status poll endpoint |
| GET | JWT (Admin) | /api/v1/pa/queue/review | List all PA requests in HUMAN REVIEW queue; supports pagination |
| POST | JWT (Adjudicator) | /api/v1/pa/{pa_id}/decision | Submit adjudicator decision (approve/deny) with reason |
| GET | JWT | /api/v1/pa/{pa_id}/auth-code | Retrieve authorization code for approved PA |
| POST | JWT | /api/v1/pa/{pa_id}/appeal | Submit appeal for a denied PA; attaches appeal letter |

### 7.2 Webhooks (Outbound Notifications)

| Event | Payload | Recipients |
|---|---|---|
| pa.submitted | pa_id, patient_id, status | Hospital EHR system |
| pa.approved | pa_id, auth_code, validity_period, conditions | Hospital EHR, TPA email |
| pa.denied | pa_id, denial_reason, policy_clause, appeals_letter_url | Hospital EHR, Patient SMS, TPA email |
| pa.review_required | pa_id, score, flags, shap_url | Adjudicator dashboard |
| pa.document_requested | pa_id, missing_docs[] | Hospital portal, Provider email |

---

## 8. Database Schema

### 8.1 PostgreSQL Tables

#### pa_requests

| Column | Type | Description |
|---|---|---|
| pa_id | UUID PK | Globally unique PA request identifier |
| patient_member_id | VARCHAR(20) | Patient's insurance member ID |
| payer_id | UUID FK | References payer_master.payer_id |
| plan_id | UUID FK | References plan_master.plan_id |
| provider_npi | CHAR(10) | Requesting provider NPI number |
| icd10_codes | VARCHAR[] ARRAY | Array of extracted ICD-10 diagnosis codes |
| cpt_codes | VARCHAR[] ARRAY | Array of requested CPT/HCPCS procedure codes |
| status | ENUM | PENDING / PROCESSING / SCORING / APPROVED / DENIED / REVIEW / APPEALED |
| final_score | DECIMAL(5,2) | Computed confidence-weighted score (0–100) |
| risk_flag | ENUM | LOW / MEDIUM / HIGH |
| decision | ENUM NULL | AUTO_APPROVE / HUMAN_APPROVE / AUTO_DENY / HUMAN_DENY / NULL |
| auth_code | VARCHAR(20) NULL | Authorization code if approved; NULL otherwise |
| auth_valid_until | DATE NULL | Authorization expiry date |
| denial_reason_code | VARCHAR NULL | Standard denial reason code if denied |
| created_at | TIMESTAMP | Request creation timestamp (UTC) |
| decided_at | TIMESTAMP NULL | Decision timestamp (UTC) |
| rule_version_id | UUID FK | Payer rule version used for this evaluation |

#### pa_scores

| Column | Type | Description |
|---|---|---|
| score_id | UUID PK | Unique score record ID |
| pa_id | UUID FK | References pa_requests.pa_id |
| policy_score | DECIMAL(5,2) | Score from Agent B (0–100) |
| clinical_match_score | DECIMAL(5,2) | Score from Agent A+B (0–100) |
| fraud_score | DECIMAL(5,2) | Score from Agent C (0–100; 100 = clean) |
| weighted_final_score | DECIMAL(5,2) | Computed: (policy×0.4) + (clinical×0.35) + (fraud×0.25) |
| shap_values_json | JSONB | SHAP explanation JSON blob for adjudicator dashboard |
| scored_at | TIMESTAMP | Timestamp when scoring completed |

#### audit_log

| Column | Type | Description |
|---|---|---|
| log_id | UUID PK | Unique log entry ID |
| pa_id | UUID FK | Associated PA request |
| event_type | VARCHAR(60) | e.g., STATE_CHANGE, AGENT_COMPLETE, OVERRIDE, NOTIFICATION_SENT |
| from_status | VARCHAR NULL | Previous status (for state change events) |
| to_status | VARCHAR NULL | New status (for state change events) |
| actor | VARCHAR(60) | Agent name or user ID who triggered the event |
| payload_json | JSONB | Event-specific data payload |
| created_at | TIMESTAMP | Log entry creation timestamp (append-only; never updated) |

### 8.2 MongoDB Collection: claims_history

| Field | Description |
|---|---|
| _id | MongoDB ObjectId |
| patient_member_id | Patient's insurance member ID (indexed) |
| provider_npi | Provider NPI number (indexed) |
| claims[] | Array: {claim_date, cpt_code, icd10_code, billed_amount, paid_amount, pa_id, status} |
| provider_risk_score | Current risk score (0.0–1.0); updated by Agent C on each evaluation |
| anomaly_flags[] | Array of detected anomalies with timestamps |
| last_evaluated_at | Timestamp of last Agent C evaluation |

---

## 9. Non-Functional Requirements

| # | Category | Requirement | Target / Detail |
|---|---|---|---|
| NFR-01 | Performance | PA Processing Time (Auto) | Auto-approve/deny decision within 90 seconds of complete submission |
| NFR-02 | Performance | Human Review SLA | Adjudicator action within 24 business hours; escalation at 48 hours |
| NFR-03 | Availability | System Uptime | 99.9% uptime; planned maintenance with 48-hour notice |
| NFR-04 | Scalability | Concurrent PA Requests | Handle 10,000 concurrent PA submissions without degradation |
| NFR-05 | Throughput | Daily PA Volume | Up to 500,000 PA evaluations per day |
| NFR-06 | Reliability | OCR Accuracy | AWS Textract OCR accuracy ≥ 95% for standard medical documents |
| NFR-07 | Reliability | Scoring Consistency | Same input must produce same score on re-evaluation (deterministic) |
| NFR-08 | Audit | Log Retention | Audit logs retained for 7 years minimum per HIPAA requirements |
| NFR-09 | Latency | Notification Delivery | WhatsApp/SMS delivered within 60 seconds of decision |
| NFR-10 | Recoverability | Recovery Point Objective | RPO: 1 hour; RTO: 4 hours for full system recovery |

---

## 10. Security & Compliance

### 10.1 Authentication & Authorisation
- All API endpoints require JWT bearer token authentication
- Hospital EHR integrations use mutual TLS (mTLS) + API key pairs
- Role-based access control: PROVIDER, ADJUDICATOR, MEDICAL_DIRECTOR, ADMIN, AUDITOR
- JWT tokens expire in 1 hour; refresh tokens valid for 24 hours
- All failed authentication attempts logged to security_audit_log

### 10.2 Data Privacy & HIPAA Compliance
- All PHI encrypted at rest (AES-256) and in transit (TLS 1.3)
- Patient data access logged per HIPAA Minimum Necessary standard
- Data residency: all PHI stored within US regions only (AWS us-east-1, us-west-2)
- Right to Access: patients may request PA records via portal; fulfilled within 30 days
- HIPAA BAA required for all third-party integrations

### 10.3 AI Explainability & Bias
- SHAP explanations mandatory for all HUMAN REVIEW cases
- Model bias audit conducted quarterly across demographics
- Adjudicator override rate monitored; high override rate triggers model retraining review
- No personally identifiable attributes (race, gender, age) used as scoring features

---

> **NOTE:** This SRS is a living document. All changes must be version-controlled and approved by the Product Owner before implementation. Breaking API changes require a new version prefix (e.g., /api/v2/).
