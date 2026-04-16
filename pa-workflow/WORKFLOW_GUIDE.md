# AegisClaim - Complete Workflow Guide
## Understanding How the Prior Authorization System Works

---

## Table of Contents
1. [What is Prior Authorization?](#what-is-prior-authorization)
2. [System Overview](#system-overview)
3. [The Four User Roles](#the-four-user-roles)
4. [Detailed Workflow by Role](#detailed-workflow-by-role)
5. [The AI Assistant](#the-ai-assistant)
6. [A Complete Journey: From Request to Decision](#a-complete-journey-from-request-to-decision)

---

## What is Prior Authorization?

**Prior Authorization (PA)** is like getting "permission" from an insurance company before a medical procedure, medication, or treatment can be performed.

### Real-World Analogy
Think of it like getting pre-approval for a home renovation:
- You want to remodel your kitchen (the medical treatment)
- Your warranty/insurance company needs to review if it's necessary and covered
- They check if cheaper alternatives exist
- They approve or deny based on their criteria

### Why Does PA Exist?
1. **Cost Control**: Insurance companies ensure expensive treatments are medically necessary
2. **Safety**: Prevents unnecessary procedures or dangerous drug combinations
3. **Alternative Treatments**: Checks if cheaper, equally effective options exist
4. **Fraud Prevention**: Stops unnecessary billing

### The Problem AegisClaim Solves
Traditional PA is slow, paper-based, and frustrating:
- Doctors fax forms and wait days
- Insurance staff manually review every request
- Patients delay treatment waiting for approval
- Appeals are complicated and lengthy

**AegisClaim automates this with AI** to make decisions in minutes instead of days.

---

## System Overview

### The Big Picture
AegisClaim is a digital platform that connects **four types of users**:

```
┌─────────────────┐     submits PA      ┌─────────────────┐
│   PROVIDERS     │ ───────────────────>│  AEGISCLAIM AI  │
│  (Doctors/Nurses)│                    │   PLATFORM      │
└─────────────────┘                     └────────┬────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                          ▼                    ▼                    ▼
                   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
                   │ ADJUDICATOR │      │   MEDICAL   │      │    ADMIN    │
                   │  (Reviewer) │      │  DIRECTOR   │      │  (Manager)  │
                   └─────────────┘      └─────────────┘      └─────────────┘
```

### Key Components
1. **AI Agents**: Automated analysis of medical requests
2. **Review Queue**: Human reviewers for complex cases
3. **Document Upload**: Secure handling of medical records
4. **Real-time Chat**: AI-powered assistance for questions
5. **Analytics Dashboard**: Insights and reporting

---

## The Four User Roles

### Role 1: Provider (Doctor/Clinic Staff)
**Who they are**: Medical professionals who prescribe treatments, medications, or procedures.

**What they do**: Submit PA requests when insurance pre-approval is needed.

**Examples**:
- A cardiologist requesting approval for a heart procedure
- A psychiatrist prescribing an expensive brand-name medication
- A specialist requesting an MRI scan

---

### Role 2: Adjudicator (Insurance Reviewer)
**Who they are**: Insurance company staff trained to review medical requests against policy guidelines.

**What they do**: Review AI-analyzed cases and make approve/deny decisions.

**Examples**:
- Reviewing if a requested surgery meets medical necessity criteria
- Checking if patient tried cheaper alternatives first
- Verifying documentation is complete

---

### Role 3: Medical Director (Senior Physician)
**Who they are**: Senior doctors who oversee the PA process and handle escalations.

**What they do**: Review complex cases, handle appeals, and provide clinical guidance.

**Examples**:
- Reviewing denied cases that providers appeal
- Making decisions on cases AI flagged as "uncertain"
- Overriding decisions when medically necessary

---

### Role 4: Admin (System Manager)
**Who they are**: Operations staff or managers who oversee the platform.

**What they do**: Monitor system performance, view analytics, manage users, and configure settings.

**Examples**:
- Checking how many PAs were processed today
- Seeing approval rates by provider
- Monitoring AI vs. human decision accuracy

---

## Detailed Workflow by Role

---

## 🔵 PROVIDER WORKFLOW

### Step-by-Step Process

#### Step 1: Log In
- Provider logs into AegisClaim with their credentials
- System shows their personalized dashboard
- They can see previously submitted requests

#### Step 2: Create New PA Request
**What happens**:
1. Provider clicks "Submit New PA Request"
2. **Step 1: Patient Information**
   - Enter patient's member ID
   - System auto-fetches patient details from database
   - Verify patient insurance information

3. **Step 2: Treatment Details**
   - Select treatment type: Medication / Procedure / Imaging / Specialist
   - Enter specific treatment name (e.g., "Humira", "MRI Brain", "Cardiac Catheterization")
   - Select patient's insurance payer (Blue Cross, Aetna, etc.)
   - Choose specific plan from that payer

4. **Step 3: Clinical Information**
   - Enter diagnosis codes (ICD-10 format)
   - Enter treatment/procedure codes (CPT/HCPCS)
   - Explain medical necessity: "Why does this patient need this treatment?"
   - List previous treatments tried and failed (required for many approvals)

5. **Step 4: Document Upload**
   - Upload supporting documents:
     - Clinical notes
     - Lab results
     - Prescription orders
     - Previous treatment records
     - Insurance card
   - System automatically processes documents with OCR (reads text from images)

6. **Step 5: Review & Submit**
   - Review all entered information
   - AI shows predicted approval probability
   - Submit to the system

#### Step 3: Track Status
After submission, provider can:
- See real-time status: PENDING → PROCESSING → APPROVED/DENIED
- View AI analysis results (confidence score, risk flags)
- Receive notifications when decision is made
- Download approval letter with authorization code
- Chat with AI assistant for questions

#### Step 4: Handle Denied Requests
If denied:
- Review reason for denial
- Submit appeal with additional information
- Request reconsideration
- Track appeal status separately

---

### Provider Dashboard Features

**PA Status Page**:
```
┌─────────────────────────────────────────────────────────┐
│ My PA Requests                                           │
├─────────────────────────────────────────────────────────┤
│ Filter: [All] [Pending] [Approved] [Denied]             │
│                                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ Total   │ │Pending  │ │Approved │ │ Denied  │        │
│ │   47    │ │   12    │ │   32    │ │    3    │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                          │
│ Request ID    Patient     Treatment     Status   Date   │
│ ────────────────────────────────────────────────────────│
│ PA-2024-001   John D.     Humira        APPROVED Jan 15 │
│ PA-2024-002   Sarah M.    MRI Brain     PENDING  Jan 16 │
│ PA-2024-003   Mike R.     Surgery       DENIED   Jan 14 │
└─────────────────────────────────────────────────────────┘
```

---

## 🟡 ADJUDICATOR WORKFLOW

### Step-by-Step Process

#### Step 1: Log In
- Adjudicator accesses the Review Queue
- System shows only cases requiring human review
- Cases are prioritized (High/Medium/Low urgency)

#### Step 2: Review Queue
**What they see**:
```
┌─────────────────────────────────────────────────────────┐
│ Review Queue (12 cases awaiting review)                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Priority: [High: 2] [Medium: 8] [Low: 2]               │
│                                                          │
│ AI Recommendation: [Auto-Approve: 5] [Review: 7]       │
│                                                          │
│ Patient   Treatment       AI Score  Risk   Time in Q    │
│ ───────────────────────────────────────────────────────│
│ John D.   Cardiac Cath    78%       LOW    2 hours      │
│ Sarah M.  MRI Brain       45%       HIGH   4 hours      │
│ Mike R.   Spinal Fusion   62%       MED    1 hour       │
└─────────────────────────────────────────────────────────┘
```

#### Step 3: Review Individual Case
**What happens when they open a case**:

**Left Side - Patient & Treatment Info**:
```
Patient: John Doe (ID: MEM-123456)
Age: 67 | Gender: Male | Payer: Blue Cross PPO

Treatment Requested:
- Procedure: Cardiac Catheterization
- CPT Code: 93458
- Diagnosis: Coronary Artery Disease (I25.10)
- Requesting Provider: Dr. Smith, Cardiology Associates
```

**Right Side - AI Analysis**:
```
┌─ AI Recommendation ─────────────────┐
│                                      │
│ Confidence Score: 78%               │
│ Recommendation: APPROVE             │
│ Risk Flags: None                    │
│                                      │
│ Analysis Summary:                   │
│ • Patient meets age criteria        │
│ • Documentation complete            │
│ • Medical necessity established       │
│ • No cheaper alternatives suggested   │
│                                      │
│ Similar Cases: 12 approved, 2 denied│
└─────────────────────────────────────┘
```

**Documents Tab**:
- View uploaded clinical notes
- View lab results
- View prescription orders
- All documents are OCR-processed and searchable

**Decision Section**:
```
┌─ Make Decision ─────────────────────┐
│                                      │
│ [○] APPROVE                         │
│ [○] DENY                            │
│ [○] REQUEST ADDITIONAL INFO         │
│                                      │
│ Decision Notes:                     │
│ [Text area for explanation...]      │
│                                      │
│ [Submit Decision]                   │
└─────────────────────────────────────┘
```

#### Step 4: Submit Decision
**Options**:
1. **APPROVE**: 
   - System generates authorization code
   - Provider and patient notified immediately
   - Case moves to completed status

2. **DENY**:
   - Must provide specific reason
   - Cite policy guideline violated
   - Suggest alternatives
   - Provider can appeal

3. **REQUEST ADDITIONAL INFO**:
   - Specify what's missing
   - Send back to provider
   - PA remains in pending state

---

## 🟣 MEDICAL DIRECTOR WORKFLOW

### Step-by-Step Process

#### Step 1: Access Dashboard
- Higher-level view than adjudicator
- Access to escalated and appealed cases
- Can override any decision

#### Step 2: Review Escalated Cases
**Cases that come here**:
- Provider appeals of denied PAs
- AI flagged as "uncertain" (confidence < 50%)
- High-cost treatments (>$50,000)
- Rare/unusual treatments not in standard guidelines
- Adjudicator requests medical director review

#### Step 3: Appeal Review Process
**What they see for an appeal**:
```
┌─ Appeal Review ─────────────────────┐
│                                      │
│ Original PA: PA-2024-003            │
│ Original Decision: DENIED           │
│ Denial Reason: "Alternative         │
│   treatment not attempted"          │
│                                      │
│ Appeal Submitted: Jan 15, 2024      │
│ Appeal Reason:                       │
│ "Patient allergic to alternative    │
│  medications. Tried in 2019 with    │
│  severe reaction. See attached      │
│  allergy documentation."            │
│                                      │
│ New Documents: 2 files attached      │
│                                      │
│ [○] UPHOLD DENIAL                   │
│ [○] REVERSE - APPROVE               │
│ [○] REQUEST MORE INFO               │
│                                      │
│ Medical Director Notes:             │
│ [Text area...]                      │
│                                      │
│ [Submit Final Decision]             │
└─────────────────────────────────────┘
```

#### Step 4: Make Final Decision
- Can approve, deny, or request more information
- Decision is final (unless legal escalation)
- Document reasoning for audit trail

---

## 🟢 ADMIN WORKFLOW

### Step-by-Step Process

#### Step 1: Access Admin Dashboard
**What they see**:
```
┌─────────────────────────────────────────────────────────┐
│ System Overview - Today                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│ │  Total  │ │  Auto   │ │ Human   │ │  Avg    │      │
│ │   PAs   │ │Approved │ │Reviewed │ │  Time   │      │
│ │  1,247  │ │   892   │ │   355   │ │ 4.2 min │      │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                          │
│ Approval Rate: 78% (industry avg: 65%)                │
│ AI Accuracy: 94.2%                                      │
│                                                          │
│ Charts showing:                                         │
│ • Daily volume trends                                   │
│ • Approval vs denial rates                             │
│ • Average processing time                                │
│ • Top requesting providers                               │
│ • Most common treatments                                 │
└─────────────────────────────────────────────────────────┘
```

#### Step 2: Monitor Performance
**Key Metrics**:
- **Volume**: How many PAs per day/week/month
- **Processing Time**: How long from submission to decision
- **Approval Rate**: Percentage approved vs denied
- **AI vs Human Split**: How many auto-approved vs reviewed
- **Appeal Rate**: How many denials are appealed

#### Step 3: User Management
- Add/remove users
- Assign roles (Provider, Adjudicator, Medical Director)
- Reset passwords
- View user activity logs

#### Step 4: System Configuration
- Manage payer list (insurance companies)
- Update treatment guidelines
- Configure AI thresholds
- Set notification preferences

---

## The AI Assistant

### What is the AI Assistant?
An AI-powered chat feature that helps users ask questions about any PA case.

### Who Can Use It?
- **Providers**: Ask "What documents are needed for this treatment?"
- **Adjudicators**: Ask "What's the clinical evidence for this diagnosis?"
- **Medical Directors**: Ask "What are similar cases decided?"

### How It Works
1. User clicks chat icon on any PA case
2. Asks a question in natural language
3. AI reads all case documents, history, and guidelines
4. Provides contextual answer with citations

**Example Conversation**:
```
User: "Why was this PA denied?"

AI: "This PA (PA-2024-003) was denied because the patient 
hasn't tried Step 1 therapies as required by Blue Cross 
policy BC-2024-MED-015.

Specifically:
• Requested: Biologic drug (Humira)
• Required first: Methotrexate for 3 months
• Documentation shows: No methotrexate attempt

To approve, provider should:
1. Document methotrexate trial
2. Or provide medical reason why methotrexate is contraindicated

[View Policy BC-2024-MED-015]"
```

---

## A Complete Journey: From Request to Decision

### Scenario: Patient Needs Expensive Medication

**Characters**:
- **Patient**: Sarah Johnson, 45, with rheumatoid arthritis
- **Provider**: Dr. Michael Chen, Rheumatologist
- **Treatment**: Humira (biologic medication, ~$6,000/month)
- **Payer**: Blue Cross Blue Shield

---

### Timeline of Events

#### **T+0 minutes: Provider Submits Request**
Dr. Chen logs into AegisClaim:
1. Enters Sarah's member ID → System fetches her info
2. Selects "Medication" treatment type
3. Enters "Humira" as medication
4. Diagnosis: M05.9 (Rheumatoid Arthritis)
5. Uploads:
   - Clinical notes showing joint inflammation
   - X-rays showing joint damage
   - Lab results (elevated rheumatoid factor)
   - Failed treatments record (methotrexate, sulfasalazine)
6. Writes: "Patient has failed 2 DMARDs. Active disease with 
   radiographic progression. Needs biologic therapy."
7. Submits request

#### **T+1 minute: AI Analysis Begins**
AegisClaim AI processes the request:
- **Agent A (Validator)**: Checks document completeness ✓
- **Agent B (Scorer)**: Scores medical necessity: 85/100 ✓
- **Agent C (Risk)**: No fraud flags detected ✓
- **Overall Confidence**: 82%

AI Recommendation: **AUTO-APPROVE**

#### **T+2 minutes: Decision Made**
System:
1. Generates authorization code: AUTH-BC-2024-789456
2. Sends approval notification to Dr. Chen
3. Sends approval to Sarah via email/SMS
4. Updates Blue Cross system
5. Logs transaction for analytics

#### **T+5 minutes: Provider Notified**
Dr. Chen receives:
```
Subject: PA Approved - Auth Code AUTH-BC-2024-789456

Your Prior Authorization request for patient Sarah Johnson 
(Humira) has been APPROVED.

Authorization Code: AUTH-BC-2024-789456
Valid for: 12 months
Quantity: 1 injection every 2 weeks

Patient can pick up medication at pharmacy.
```

#### **Same Day: Patient Gets Medication**
Sarah goes to pharmacy, gives authorization code, gets medication.

---

### Alternative Scenario: Case Needs Human Review

**Same request, but missing information**:

#### **T+0 minutes: Provider Submits**
Same as above, but Dr. Chen forgets to upload documentation of 
failed methotrexate trial.

#### **T+1 minute: AI Analysis**
- **Agent A (Validator)**: Missing "failed alternatives" document ⚠️
- **Agent B (Scorer)**: Cannot score without full history
- **Confidence**: 45% (below 70% threshold)

AI Recommendation: **SEND TO HUMAN REVIEW**

#### **T+2 minutes: Goes to Review Queue**
Case appears in adjudicator queue with HIGH priority and note:
"Missing documentation of failed alternative treatments."

#### **T+15 minutes: Adjudicator Reviews**
Adjudicator Lisa opens the case:
- Sees AI flagged missing documentation
- Reviews clinical notes (showing RA severity)
- Sees methotrexate mention in notes but no formal record
- Decision: REQUEST ADDITIONAL INFO

#### **T+20 minutes: Provider Notified**
Dr. Chen receives:
```
Your PA request requires additional information:

Missing: Documentation of methotrexate trial and failure

Please upload:
1. Pharmacy records showing methotrexate dispensing
2. Clinical notes documenting inefficacy or intolerance

[Upload Documents] [Cancel Request]
```

#### **T+2 hours: Provider Responds**
Dr. Chen uploads pharmacy records showing 6-month methotrexate 
trial with no improvement.

#### **T+2 hours + 1 minute: AI Re-analyzes**
- **Confidence**: 88% (documentation now complete)
- **Recommendation**: AUTO-APPROVE

#### **T+2 hours + 2 minutes: Approved**
Same approval process as above.

---

## Key Benefits of AegisClaim

### For Providers
- ✅ Submit PAs in 5-10 minutes (vs. 30+ minutes on paper)
- ✅ Get decisions in minutes (vs. days)
- ✅ Track all requests in one place
- ✅ AI helps ensure complete submissions
- ✅ Mobile-friendly for on-the-go access

### For Adjudicators
- ✅ AI pre-analyzes cases (know what to look for)
- ✅ Clear confidence scores help prioritize
- ✅ All documents digitized and searchable
- ✅ Reduce review time by 60%
- ✅ Consistent decision support

### For Medical Directors
- ✅ Handle complex cases efficiently
- ✅ Appeal reviews are streamlined
- ✅ Audit trail for all decisions
- ✅ Override capability when needed
- ✅ Clinical decision support

### For Admins
- ✅ Real-time analytics and reporting
- ✅ Monitor system performance
- ✅ Identify bottlenecks
- ✅ Cost savings tracking
- ✅ Compliance monitoring

### For Patients
- ✅ Faster access to needed treatments
- ✅ Less time waiting for approvals
- ✅ Clear status visibility
- ✅ Fewer denied claims due to incomplete submissions
- ✅ Better communication

---

## Common Questions

### Q: What if the AI makes a mistake?
A: All AI decisions are recommendations. High-confidence cases auto-approve, 
but providers can appeal, and medical directors can override any decision.

### Q: Is patient data secure?
A: Yes. AegisClaim uses encryption, role-based access, audit logs, and 
complies with HIPAA regulations.

### Q: What happens if the system is down?
A: The platform has redundancy built-in. Critical functions can run 
offline, and data is backed up continuously.

### Q: Can providers still call for urgent cases?
A: Yes. AegisClaim handles routine PAs, but urgent/emergency cases can 
still use phone authorization.

### Q: How does the AI learn?
A: The AI improves as adjudicators make decisions. Correct AI 
recommendations reinforce learning, and incorrect ones get flagged 
for model retraining.

---

## Summary

AegisClaim transforms the Prior Authorization process from a 
paper-based, multi-day ordeal into a digital, minutes-long workflow.

**The magic happens through**:
1. **AI Agents** that pre-analyze and score requests
2. **Smart Routing** that sends clear cases to auto-approval and 
   complex cases to humans
3. **Document Intelligence** that reads and understands medical records
4. **Real-time Collaboration** between providers and reviewers
5. **Analytics** that continuously improve the process

**Result**: Patients get faster access to care, providers spend less 
time on paperwork, and insurance companies make better decisions more 
efficiently.

---

*End of Workflow Guide*
