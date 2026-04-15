import api from './api'
import type {
  PARequest,
  PAFilter,
  PaginatedResponse,
  PASubmissionFormData,
  DecisionFormData,
} from '../types/pa.types'

export const paService = {
  // Create new PA request
  createPA: async (data: PASubmissionFormData): Promise<PARequest> => {
    const response = await api.post<PARequest>('/pa', data)
    return response.data
  },

  // Get PA by ID
  getPAById: async (id: string): Promise<PARequest> => {
    const response = await api.get<PARequest>(`/pa/${id}`)
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

  // Submit decision for PA
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
}
