import api from './api'
import type {
  PARequest,
  PAFilter,
  PaginatedResponse,
  PASubmissionFormData,
  ProviderPASubmissionFormData,
  DecisionFormData,
} from '../types/pa.types'

// Payer Types
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
  coverageLimit?: number
  waitingPeriodDays?: number
  maxClaimsPerYear?: number
}

export interface PlanDetails extends Plan { }

export interface WaitingPeriod {
  id: number
  planId: string
  diseaseName: string
  waitingDays: number
}

export interface ExcludedProcedure {
  id: number
  planId: string
  procedureName: string
  planName?: string
  category?: string
  reason?: string
}

export interface StepTherapyRule {
  id: number
  planId: string
  procedureName: string
  requiredPrior: string
  planName?: string
}

export interface Hospital {
  id: string
  payerId: string
  name: string
  city: string
  state: string
  pincode: string
}

export interface ClaimHistoryRow {
  id: number
  patientId: string
  diagnosis: string
  procedureName: string
  claimDate: string
  cost: number
  hospitalName: string
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

export const paService = {
  // Create new PA request
  createPA: async (data: PASubmissionFormData): Promise<PARequest> => {
    const response = await api.post<PARequest>('/pa', data)
    return response.data
  },

  // Submit provider PA request with multipart form + documents
  submitPA: async (data: ProviderPASubmissionFormData): Promise<PARequest> => {
    const formData = new FormData()

    formData.append('patient_member_id', data.patientMemberId)
    formData.append('payer_id', data.payerId)
    formData.append('plan_id', data.planId)
    formData.append('provider_npi', data.providerNpi)
    formData.append('date_of_service', data.dateOfService)
    formData.append('icd_codes', JSON.stringify(data.icd10Codes))
    formData.append('cpt_codes', JSON.stringify(data.cptCodes))
    formData.append('prior_treatment_history', data.priorTreatmentHistory || '')
    formData.append('medication_name', data.medicationName || '')
    formData.append('medication_dosage', data.medicationDosage || '')
    formData.append('medical_necessity_summary', data.medicalNecessitySummary || '')
    formData.append('clinical_summary', data.clinicalSummary || '')
    formData.append('reason_for_claim', data.reasonForClaim || '')
    formData.append('provider_notes', data.providerNotes || '')

    data.documents.forEach((file) => {
      formData.append('documents', file)
    })

    console.log('📤 [PA Service] Submitting PA request...')
    console.log('📋 Patient Member ID:', data.patientMemberId)
    console.log('🏥 Payer ID:', data.payerId)
    console.log('📑 ICD-10 Codes:', data.icd10Codes)
    console.log('💊 CPT Codes:', data.cptCodes)
    console.log('🏥 Medical Necessity:', data.medicalNecessitySummary?.substring(0, 50) + '...')
    console.log('📎 Documents attached:', data.documents.length)
    data.documents.forEach((doc, idx) => {
      console.log(`   [${idx + 1}] ${doc.name} (${doc.size} bytes)`)
    })

    const response = await api.post<PARequest>('/pa/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    console.log('✅ [PA Service] Response received from API:')
    console.log(response.data)

    // Extract and display OCR results if available
    const details = (response.data as any)?.details
    if (details?.agent_a_output?.ocr_results) {
      const ocrResults = details.agent_a_output.ocr_results
      console.log('\n📄 ========== OCR EXTRACTION RESULTS ==========')
      console.log('OCR Results:', ocrResults)

      if (ocrResults.clean_lines && Array.isArray(ocrResults.clean_lines)) {
        console.log(`\n✨ Extracted ${ocrResults.clean_lines.length} lines of text:\n`)
        ocrResults.clean_lines.forEach((line: any, idx: number) => {
          console.log(`[Line ${idx + 1}] Confidence: ${(line.confidence * 100).toFixed(2)}% | Text: "${line.text}"`)
        })
      }

      if (ocrResults.full_text) {
        console.log('\n📋 Full Extracted Text:')
        console.log(ocrResults.full_text)
      }

      console.log('\n=========================================\n')
    } else {
      console.log('ℹ️  [PA Service] OCR results not yet available (still processing...)')
    }

    return response.data
  },

  // Get PA by ID
  getPAById: async (id: string): Promise<PARequest> => {
    const response = await api.get<PARequest>(`/pa/${id}`)
    return response.data
  },

  // Get PA status (specific endpoint for status tracking)
  getPAStatus: async (id: string): Promise<PARequest> => {
    const response = await api.get<PARequest>(`/pa/${id}/status`)
    return response.data
  },

  // Get PA list with filters and pagination
  getPAList: async (
    filters?: PAFilter,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<PARequest>> => {
    const response = await api.get<PaginatedResponse<PARequest>>('/pa', {
      params: {
        ...filters,
        page,
        page_size: pageSize,
      },
    })
    return response.data
  },

  // Get PA requests for provider
  getProviderPARequests: async (
    providerId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<PARequest>> => {
    const response = await api.get<PaginatedResponse<PARequest>>(
      `/pa/provider/${providerId}`,
      {
        params: {
          page,
          page_size: pageSize,
        },
      }
    )
    return response.data
  },

  // Get PA requests in review queue
  getReviewQueue: async (
    filters?: PAFilter,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResponse<PARequest>> => {
    const response = await api.get<PaginatedResponse<PARequest>>('/pa/queue', {
      params: {
        ...filters,
        page,
        page_size: pageSize,
      },
    })
    return response.data
  },

  // Submit decision for PA (for adjudicator)
  submitDecision: async (
    paId: string,
    decisionData: DecisionFormData
  ): Promise<PARequest> => {
    const response = await api.post<PARequest>(
      `/pa/${paId}/decision`,
      decisionData
    )
    return response.data
  },

  // Submit appeal for PA (for provider)
  submitAppeal: async (paId: string, reason: string): Promise<PARequest> => {
    const response = await api.post<PARequest>(`/pa/${paId}/appeal`, {
      reason,
    })
    return response.data
  },

  // Request additional information
  requestAdditionalInfo: async (
    paId: string,
    requestNotes: string
  ): Promise<PARequest> => {
    const response = await api.post<PARequest>(`/pa/${paId}/request-info`, {
      notes: requestNotes,
    })
    return response.data
  },

  // Cancel PA request
  cancelPA: async (id: string, reason: string): Promise<PARequest> => {
    const response = await api.post<PARequest>(`/pa/${id}/cancel`, {
      reason,
    })
    return response.data
  },

  // Upload attachment
  uploadAttachment: async (
    paId: string,
    file: File
  ): Promise<{ id: string; url: string }> => {
    const formData = new FormData()
    formData.append('files', file)

    const response = await api.post<{ id: string; url: string }>(
      `/pa/${paId}/documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Upload multiple documents
  uploadDocuments: async (paId: string, files: File[]): Promise<void> => {
    const uploadPromises = files.map((file) =>
      paService.uploadAttachment(paId, file)
    )
    await Promise.all(uploadPromises)
  },

  // Get analytics data
  getAnalytics: async (dateFrom?: string, dateTo?: string): Promise<{
    totalRequests: number
    approvalRate: number
    averageProcessingTime: number
    statusBreakdown: Record<string, number>
    dailyTrends: Array<{ date: string; count: number }>
  }> => {
    const response = await api.get('/analytics/dashboard', {
      params: {
        date_from: dateFrom,
        date_to: dateTo,
      },
    })
    return response.data
  },

  // Generate targeted follow-up questions from the backend LLM service
  generateQuestions: async (context: Record<string, any>): Promise<{ questions: any[]; metadata?: any }> => {
    const response = await api.post<{ questions: any[]; metadata?: any }>(`/provider/generate-questions`, context)
    return response.data
  },

  // Run AI reviewer (returns score, issues, suggestions)
  aiReview: async (submission: Record<string, any>): Promise<any> => {
    const response = await api.post(`/provider/ai-review`, submission)
    return response.data
  },

  // Get all payers
  getPayers: async (): Promise<Payer[]> => {
    const response = await api.get<Payer[]>('/payers')
    return response.data
  },

  // Get plans by payer ID
  getPlansByPayer: async (payerId: string): Promise<Plan[]> => {
    const response = await api.get<Plan[]>('/plans', {
      params: { payer_id: payerId },
    })
    return response.data
  },

  // Get a single plan's details
  getPlanDetails: async (planId: string): Promise<PlanDetails | null> => {
    const response = await api.get<PlanDetails | null>('/data/plan-details', {
      params: { plan_id: planId },
    })
    return response.data
  },

  // Get document requirements based on treatment type
  getDocumentRequirements: async (treatmentType: string): Promise<DocumentRequirements> => {
    const response = await api.get<DocumentRequirements>('/documents/requirements', {
      params: { treatment_type: treatmentType },
    })
    return response.data
  },

  // Download summary report as DOCX
  downloadSummaryReport: async (paId: string): Promise<void> => {
    try {
      console.log(`📄 [PA Service] Downloading summary report for PA ${paId}...`)

      const response = await api.get(`/pa/${paId}/report/download`, {
        responseType: 'blob',
      })

      // Create a blob and trigger download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `PA_${paId}_Summary_Report.docx`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      console.log(`✅ [PA Service] Report downloaded successfully for PA ${paId}`)
    } catch (error) {
      console.error(`❌ [PA Service] Failed to download report for PA ${paId}:`, error)
      throw error
    }
  },

  // ============== Dynamic Data Methods ==============

  // Get all users
  getAllUsers: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/data/users')
    return response.data
  },

  // Get all payers (from database)
  getAllPayers: async (): Promise<Payer[]> => {
    const response = await api.get<Payer[]>('/data/payers')
    return response.data
  },

  // Get plans by payer ID (from database)
  getPlansByPayerId: async (payerId: string): Promise<Plan[]> => {
    const response = await api.get<Plan[]>('/data/plans', {
      params: { payer_id: payerId },
    })
    return response.data
  },

  // Get procedures, optionally filtered by plan
  getProcedures: async (planId?: string): Promise<any[]> => {
    const response = await api.get<any[]>('/data/procedures', {
      params: planId ? { plan_id: planId } : {},
    })
    return response.data
  },

  // Get required documents, optionally filtered by plan
  getDocumentsRequired: async (planId?: string): Promise<any[]> => {
    const response = await api.get<any[]>('/data/documents-required', {
      params: planId ? { plan_id: planId } : {},
    })
    return response.data
  },

  // Get waiting periods, optionally filtered by plan
  getWaitingPeriods: async (planId?: string): Promise<WaitingPeriod[]> => {
    const response = await api.get<WaitingPeriod[]>('/data/waiting-periods', {
      params: planId ? { plan_id: planId } : {},
    })
    return response.data
  },

  // Get excluded procedures, optionally filtered by plan
  getExcludedProcedures: async (planId?: string): Promise<ExcludedProcedure[]> => {
    const response = await api.get<ExcludedProcedure[]>('/data/excluded-procedures', {
      params: planId ? { plan_id: planId } : {},
    })
    return response.data
  },

  // Get step therapy rules, optionally filtered by plan
  getStepTherapy: async (planId?: string): Promise<StepTherapyRule[]> => {
    const response = await api.get<StepTherapyRule[]>('/data/step-therapy', {
      params: planId ? { plan_id: planId } : {},
    })
    return response.data
  },

  // Get network hospitals, optionally filtered by payer/search
  getHospitals: async (payerId?: string, search?: string): Promise<Hospital[]> => {
    const response = await api.get<Hospital[]>('/data/hospitals', {
      params: {
        ...(payerId ? { payer_id: payerId } : {}),
        ...(search ? { search } : {}),
      },
    })
    return response.data
  },

  // Get claim history rows
  getClaimHistory: async (patientId?: string): Promise<ClaimHistoryRow[]> => {
    const response = await api.get<ClaimHistoryRow[]>('/data/claims-history', {
      params: patientId ? { patient_id: patientId } : {},
    })
    return response.data
  },

  // Get ICD codes with optional search
  getICDCodes: async (search?: string): Promise<any[]> => {
    const response = await api.get<any[]>('/data/icd-codes', {
      params: search ? { search } : {},
    })
    return response.data
  },

  // Get CPT codes with optional search
  getCPTCodes: async (search?: string): Promise<any[]> => {
    const response = await api.get<any[]>('/data/cpt-codes', {
      params: search ? { search } : {},
    })
    return response.data
  },

  // Get plans for the current provider from user_policies table
  getProviderPlans: async (): Promise<Plan[]> => {
    const response = await api.get<Plan[]>('/data/provider-plans')
    return response.data
  },

  // Extract medical codes (ICD-10 and CPT) from uploaded documents
  extractCodesFromDocuments: async (
    files: File[]
  ): Promise<{ icd10Codes: string[]; cptCodes: string[]; exactMatchFound: boolean; message: string }> => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const response = await api.post<{ icd10Codes: string[]; cptCodes: string[]; exactMatchFound: boolean; message: string }>(
      '/provider/extract-codes',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Extract full Sonar-like payload (OCR + Sonar analysis) from uploaded documents
  extractSonarFromDocuments: async (files: File[]): Promise<any> => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const response = await api.post<any>('/provider/extract-sonar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return response.data
  },
  // Extract OCR-only payload for immediate preview
  extractOcrFromDocuments: async (files: File[]): Promise<any> => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const response = await api.post<any>('/provider/extract-ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return response.data
  },
}
