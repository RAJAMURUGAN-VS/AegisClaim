import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paService } from '../services/pa.service'
import type {
  PARequest,
  PAFilter,
  PASubmissionFormData,
  DecisionFormData,
  PaginatedResponse,
  Payer,
  Plan,
  DocumentRequirements,
} from '../types/pa.types'

// Query keys
export const paKeys = {
  all: ['pa'] as const,
  lists: () => [...paKeys.all, 'list'] as const,
  list: (filters: PAFilter | undefined) => [...paKeys.lists(), filters] as const,
  details: () => [...paKeys.all, 'detail'] as const,
  detail: (id: string) => [...paKeys.details(), id] as const,
  status: (id: string) => [...paKeys.detail(id), 'status'] as const,
  queue: () => [...paKeys.all, 'queue'] as const,
  provider: (providerId: string) => [...paKeys.all, 'provider', providerId] as const,
}

// Payer and Plan query keys
export const payerKeys = {
  all: ['payers'] as const,
  list: () => [...payerKeys.all, 'list'] as const,
}

export const planKeys = {
  all: ['plans'] as const,
  byPayer: (payerId: string) => [...planKeys.all, 'payer', payerId] as const,
}

export const documentKeys = {
  all: ['documents'] as const,
  requirements: (treatmentType: string) => [...documentKeys.all, 'requirements', treatmentType] as const,
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

// Hook to get PA status with polling
export const usePAStatus = (paId: string | undefined) => {
  return useQuery<PARequest, Error>({
    queryKey: paKeys.status(paId || ''),
    queryFn: () => paService.getPAStatus(paId!),
    enabled: !!paId,
    refetchInterval: (query) => {
      const data = query.state.data
      // Poll every 10 seconds if status is SUBMITTED, IN_REVIEW, or AGENT_PROCESSING
      if (data && (data.status === 'SUBMITTED' || data.status === 'IN_REVIEW' || data.status === 'AGENT_PROCESSING')) {
        return 10000 // 10 seconds
      }
      return false // Stop polling for other statuses
    },
  })
}

// Hook to submit PA (mutation)
export const useSubmitPA = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, PASubmissionFormData>({
    mutationFn: (data) => paService.submitPA(data),
    onSuccess: (result) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: paKeys.lists() })
      // Set the new PA data in cache
      queryClient.setQueryData(paKeys.detail(result.id), result)
      queryClient.setQueryData(paKeys.status(result.id), result)
    },
  })
}

// Hook to create PA (legacy)
export const useCreatePA = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, PASubmissionFormData>({
    mutationFn: (data) => paService.createPA(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paKeys.lists() })
    },
  })
}

// Hook to submit decision (for adjudicator)
export const useSubmitDecision = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, { paId: string; decisionData: DecisionFormData }>({
    mutationFn: ({ paId, decisionData }) => paService.submitDecision(paId, decisionData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: paKeys.detail(variables.paId) })
      queryClient.invalidateQueries({ queryKey: paKeys.status(variables.paId) })
      queryClient.invalidateQueries({ queryKey: paKeys.queue() })
    },
  })
}

// Hook to submit appeal (for provider)
export const useSubmitAppeal = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, { paId: string; reason: string }>({
    mutationFn: ({ paId, reason }) => paService.submitAppeal(paId, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: paKeys.detail(variables.paId) })
      queryClient.invalidateQueries({ queryKey: paKeys.status(variables.paId) })
    },
  })
}

// Hook to cancel PA
export const useCancelPA = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => paService.cancelPA(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: paKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: paKeys.lists() })
    },
  })
}

// Hook to upload documents
export const useUploadDocuments = () => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { paId: string; files: File[] }>({
    mutationFn: ({ paId, files }) => paService.uploadDocuments(paId, files),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: paKeys.detail(variables.paId) })
      queryClient.invalidateQueries({ queryKey: paKeys.status(variables.paId) })
    },
  })
}

// Hook to fetch all payers
export const usePayers = () => {
  return useQuery<Payer[], Error>({
    queryKey: payerKeys.list(),
    queryFn: () => paService.getPayers(),
  })
}

// Hook to fetch plans by payer ID
export const usePlansByPayer = (payerId: string | undefined) => {
  return useQuery<Plan[], Error>({
    queryKey: planKeys.byPayer(payerId || ''),
    queryFn: () => paService.getPlansByPayer(payerId!),
    enabled: !!payerId,
  })
}

// Hook to fetch document requirements
export const useDocumentRequirements = (treatmentType: string | undefined) => {
  return useQuery<DocumentRequirements, Error>({
    queryKey: documentKeys.requirements(treatmentType || ''),
    queryFn: () => paService.getDocumentRequirements(treatmentType!),
    enabled: !!treatmentType,
  })
}
