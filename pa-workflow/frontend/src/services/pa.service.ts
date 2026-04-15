import api from './api'
import type {
  PARequest,
  PAFilter,
  PaginatedResponse,
  PASubmissionFormData,
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

  // Submit PA (alias for createPA with specific endpoint)
  submitPA: async (data: PASubmissionFormData): Promise<PARequest> => {
    const response = await api.post<PARequest>('/api/v1/pa/submit', data)
    return response.data
  },

  // Get PA by ID
  getPAById: async (id: string): Promise<PARequest> => {
    const response = await api.get<PARequest>(`/pa/${id}`)
    return response.data
  },

  // Get PA status (specific endpoint for status tracking)
  getPAStatus: async (id: string): Promise<PARequest> => {
    const response = await api.get<PARequest>(`/api/v1/pa/${id}`)
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
      `/api/v1/pa/${paId}/decision`,
      decisionData
    )
    return response.data
  },

  // Submit appeal for PA (for provider)
  submitAppeal: async (paId: string, reason: string): Promise<PARequest> => {
    const response = await api.post<PARequest>(`/api/v1/pa/${paId}/appeal`, {
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
    formData.append('file', file)

    const response = await api.post<{ id: string; url: string }>(
      `/pa/${paId}/attachments`,
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
    const response = await api.get<Payer[]>('/api/v1/payers')
    return response.data
  },

  // Get plans by payer ID
  getPlansByPayer: async (payerId: string): Promise<Plan[]> => {
    const response = await api.get<Plan[]>('/api/v1/plans', {
      params: { payer_id: payerId },
    })
    return response.data
  },

  // Get document requirements based on treatment type
  getDocumentRequirements: async (treatmentType: string): Promise<DocumentRequirements> => {
    const response = await api.get<DocumentRequirements>('/api/v1/documents/requirements', {
      params: { treatment_type: treatmentType },
    })
    return response.data
  },
}
