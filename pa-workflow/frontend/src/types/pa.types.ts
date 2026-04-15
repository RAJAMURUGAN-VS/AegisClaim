// User Types
export interface User {
  id: string
  email: string
  name: string
  role: 'PROVIDER' | 'ADJUDICATOR' | 'ADMIN'
  organization?: string
  createdAt: string
}

export interface AuthToken {
  access_token: string
  token_type: string
  expires_in: number
}

// PA Request Types
export interface PARequest {
  id: string
  providerId: string
  patientId: string
  patientName: string
  patientDOB: string
  memberId: string
  insurancePlan: string
  providerNPI: string
  providerName: string
  providerPhone: string
  providerFax: string

  // Service Information
  serviceType: ServiceType
  procedureCodes: string[]
  diagnosisCodes: string[]

  // Clinical Information
  clinicalHistory: string
  previousTreatments: string
  symptoms: string
  durationOfSymptoms: string

  // Urgency
  urgencyLevel: UrgencyLevel
  requestedDate: string

  // Attachments
  attachments?: Attachment[]

  // Status and Timestamps
  status: PAStatus
  submittedAt: string
  updatedAt: string
  adjudicatedAt?: string

  // AI Agent Outputs
  agentOutputs?: AgentOutput[]

  // Scoring
  scoringResult?: ScoringResult

  // Decision
  decision?: PADecision
}

export type ServiceType =
  | 'MEDICAL'
  | 'SURGICAL'
  | 'PHARMACY'
  | 'DME'
  | 'IMAGING'
  | 'LAB'
  | 'BEHAVIORAL_HEALTH'
  | 'OTHER'

export type UrgencyLevel = 'ROUTINE' | 'URGENT' | 'EXPEDITED'

export type PAStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'PENDING_INFO'
  | 'AGENT_PROCESSING'
  | 'ESCALATED'
  | 'APPROVED'
  | 'DENIED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface Attachment {
  id: string
  filename: string
  fileType: string
  fileSize: number
  uploadedAt: string
  url: string
}

// Agent Output Types
export interface AgentOutput {
  agentId: string
  agentName: string
  agentType: 'POLICY' | 'FRAUD' | 'CLINICAL' | 'SCORING'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  output?: AgentAnalysisResult
  startedAt: string
  completedAt?: string
  errorMessage?: string
}

export interface AgentAnalysisResult {
  findings: string
  confidence: number
  riskIndicators?: RiskIndicator[]
  recommendations?: string[]
  matchedPolicies?: PolicyMatch[]
  anomalies?: Anomaly[]
}

export interface RiskIndicator {
  type: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface PolicyMatch {
  policyId: string
  policyName: string
  criteriaMatched: boolean
  evidence: string
}

export interface Anomaly {
  type: string
  description: string
  confidence: number
}

// Scoring Types
export interface ScoringResult {
  score: number
  category: 'LOW' | 'MEDIUM' | 'HIGH'
  confidence: number
  factors: ScoringFactor[]
  recommendation: 'AUTO_APPROVE' | 'AUTO_DENY' | 'MANUAL_REVIEW'
  processedAt: string
}

export interface ScoringFactor {
  factor: string
  weight: number
  contribution: number
  description: string
}

// Decision Types
export interface PADecision {
  id: string
  paRequestId: string
  adjudicatorId: string
  adjudicatorName: string
  decision: 'APPROVED' | 'DENIED' | 'PENDED'
  decisionType: 'AUTOMATED' | 'MANUAL'
  reason: string
  clinicalNotes?: string
  authorizedQuantity?: number
  authorizedUnits?: string
  effectiveDate?: string
  expirationDate?: string
  conditions?: string[]
  denialReasonCode?: string
  denialReasonDescription?: string
  appealInstructions?: string
  decidedAt: string
}

// Notification Types
export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export type NotificationType =
  | 'PA_SUBMITTED'
  | 'PA_STATUS_CHANGED'
  | 'PA_DECISION_MADE'
  | 'AGENT_COMPLETED'
  | 'ESCALATION_REQUIRED'
  | 'INFO_REQUESTED'
  | 'SYSTEM_ALERT'

// Webhook Event Types
export interface WebhookEvent {
  id: string
  eventType: WebhookEventType
  payload: WebhookPayload
  timestamp: string
  signature: string
  retryCount: number
  status: 'PENDING' | 'DELIVERED' | 'FAILED'
}

export type WebhookEventType =
  | 'pa.submitted'
  | 'pa.status_changed'
  | 'pa.decision_made'
  | 'pa.agent_completed'
  | 'pa.escalated'

export interface WebhookPayload {
  paId: string
  status: PAStatus
  previousStatus?: PAStatus
  timestamp: string
  data?: Record<string, unknown>
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Filter Types
export interface PAFilter {
  status?: PAStatus[]
  serviceType?: ServiceType[]
  urgencyLevel?: UrgencyLevel[]
  dateFrom?: string
  dateTo?: string
  searchQuery?: string
}

// Form Types
export interface PASubmissionFormData {
  patientName: string
  patientDOB: string
  memberId: string
  insurancePlan: string
  providerNPI: string
  providerName: string
  providerPhone: string
  providerFax?: string
  serviceType: ServiceType
  procedureCodes: string[]
  diagnosisCodes: string[]
  clinicalHistory: string
  previousTreatments: string
  symptoms: string
  durationOfSymptoms: string
  urgencyLevel: UrgencyLevel
  requestedDate: string
}

// New Provider Submission Form Data (for PASubmissionForm.tsx)
export interface ProviderPASubmissionFormData {
  // Step 1: Patient & Insurance Details
  patientMemberId: string
  payerId: string
  planId: string
  providerNpi: string
  dateOfService: string

  // Step 2: Clinical Information
  icd10Codes: string[]
  cptCodes: string[]
  priorTreatmentHistory?: string
  medicationName?: string
  medicationDosage?: string

  // Step 3: Documents
  documents: File[]
}

// Payer and Plan Types
export interface Payer {
  id: string
  name: string
  code: string
  isActive: boolean
}

export interface Plan {
  id: string
  payerId: string
  name: string
  planCode: string
  planType: string
  isActive: boolean
}

// Document Upload Types
export interface DocumentRequirements {
  required: string[]
  optional: string[]
}

export interface FileUpload {
  id: string
  file: File
  name: string
  size: number
  type: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  errorMessage?: string
}

export interface DecisionFormData {
  decision: 'APPROVED' | 'DENIED' | 'PENDED'
  reason: string
  clinicalNotes?: string
  authorizedQuantity?: number
  authorizedUnits?: string
  effectiveDate?: string
  expirationDate?: string
  conditions?: string[]
  denialReasonCode?: string
}
