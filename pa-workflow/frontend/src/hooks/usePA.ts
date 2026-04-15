import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paService } from '../services/pa.service'
import type {
  PARequest,
  PAFilter,
  PASubmissionFormData,
  DecisionFormData,
  PaginatedResponse,
} from '../types/pa.types'

// Query keys
export const paKeys = {
  all: ['pa'] as const,
  lists: () => [...paKeys.all, 'list'] as const,
  list: (filters: PAFilter | undefined) => [...paKeys.lists(), filters] as const,
  details: () => [...paKeys.all, 'detail'] as const,
  detail: (id: string) => [...paKeys.details(), id] as const,
  queue: () => [...paKeys.all, 'queue'] as const,
  provider: (providerId: string) => [...paKeys.all, 'provider', providerId] as const,
}

// Hook to fetch PA by ID
export const usePAById = (id: string | undefined) => {
  return useQuery<PARequest, Error>({
    queryKey: paKeys.detail(id || ''),
    queryFn: () => paService.getPAById(id!),
    enabled: !!id,
  })
}

// Hook to fetch PA list with filters
export const usePAList = (filters?: PAFilter, page: number = 1, pageSize: number = 20) => {
  return useQuery<PaginatedResponse<PARequest>, Error>({
    queryKey: paKeys.list(filters),
    queryFn: () => paService.getPAList(filters, page, pageSize),
  })
}

// Hook to fetch review queue
export const useReviewQueue = (filters?: PAFilter, page: number = 1, pageSize: number = 20) => {
  return useQuery<PaginatedResponse<PARequest>, Error>({
    queryKey: paKeys.queue(),
    queryFn: () => paService.getReviewQueue(filters, page, pageSize),
  })
}

// Hook to fetch provider PA requests
export const useProviderPARequests = (
  providerId: string | undefined,
  page: number = 1,
  pageSize: number = 20
) => {
  return useQuery<PaginatedResponse<PARequest>, Error>({
    queryKey: paKeys.provider(providerId || ''),
    queryFn: () => paService.getProviderPARequests(providerId!, page, pageSize),
    enabled: !!providerId,
  })
}

// Hook to create PA
export const useCreatePA = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, PASubmissionFormData>({
    mutationFn: (data) => paService.createPA(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paKeys.lists() })
    },
  })
}

// Hook to submit decision
export const useSubmitDecision = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, { paId: string; decisionData: DecisionFormData }>({
    mutationFn: ({ paId, decisionData }) => paService.submitDecision(paId, decisionData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: paKeys.detail(variables.paId) })
      queryClient.invalidateQueries({ queryKey: paKeys.queue() })
    },
  })
}

// Hook to cancel PA
export const useCancelPA = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => paService.cancelPA(id, reason),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: paKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: paKeys.lists() })
    },
  })
}
