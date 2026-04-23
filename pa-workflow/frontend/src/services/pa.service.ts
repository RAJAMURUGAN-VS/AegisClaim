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

    data.documents.forEach((file) => {
      formData.append('documents', file)
    })

    console.log('📤 [PA Service] Submitting PA request...')
    console.log('📋 Patient Member ID:', data.patientMemberId)
    console.log('🏥 Payer ID:', data.payerId)
    console.log('📑 ICD-10 Codes:', data.icd10Codes)
    console.log('💊 CPT Codes:', data.cptCodes)
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

  // Get document requirements based on treatment type
  getDocumentRequirements: async (treatmentType: string): Promise<DocumentRequirements> => {
    const response = await api.get<DocumentRequirements>('/documents/requirements', {
      params: { treatment_type: treatmentType },
    })
    return response.data
  },
}
