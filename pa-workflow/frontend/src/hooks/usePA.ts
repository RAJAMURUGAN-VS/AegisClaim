import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paService } from '../services/pa.service'
import type {
  PARequest,
  PAFilter,
  PASubmissionFormData,
  ProviderPASubmissionFormData,
  DecisionFormData,
  PaginatedResponse,
  Payer,
  Plan,
  DocumentRequirements,
  WaitingPeriod,
  ExcludedProcedure,
  StepTherapyRule,
  Hospital,
  ClaimHistoryRow,
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

export const planDetailKeys = {
  all: ['plan-details'] as const,
  detail: (planId: string) => [...planDetailKeys.all, planId] as const,
}

export const waitingPeriodKeys = {
  all: ['waiting-periods'] as const,
  list: (planId?: string) => [...waitingPeriodKeys.all, planId || 'all'] as const,
}

export const excludedProcedureKeys = {
  all: ['excluded-procedures'] as const,
  list: (planId?: string) => [...excludedProcedureKeys.all, planId || 'all'] as const,
}

export const stepTherapyKeys = {
  all: ['step-therapy'] as const,
  list: (planId?: string) => [...stepTherapyKeys.all, planId || 'all'] as const,
}

export const hospitalKeys = {
  all: ['hospitals'] as const,
  list: (payerId?: string, search?: string) => [...hospitalKeys.all, payerId || 'all', search || ''] as const,
}

export const claimHistoryKeys = {
  all: ['claim-history'] as const,
  list: (patientId?: string) => [...claimHistoryKeys.all, patientId || 'all'] as const,
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
      // Keep polling until a terminal status is reached.
      // This prevents UI from getting stuck on placeholders when backend uses PROCESSING/SCORING states.
      if (!data) {
        return 5000
      }

      const terminalStatuses = new Set(['APPROVED', 'DENIED', 'DECIDED', 'ERROR'])
      if (!terminalStatuses.has(data.status)) {
        return 5000
      }

      return false
    },
  })
}

// Hook to submit PA (mutation)
export const useSubmitPA = () => {
  const queryClient = useQueryClient()

  return useMutation<PARequest, Error, ProviderPASubmissionFormData>({
    mutationFn: (data) => {
      console.log('🔄 [Hook] useSubmitPA: mutation starting...')
      return paService.submitPA(data)
    },
    onSuccess: (result) => {
      console.log('✅ [Hook] useSubmitPA: mutation succeeded')
      const paId = (result as PARequest & { pa_id?: string }).id || (result as PARequest & { pa_id?: string }).pa_id
      if (!paId) {
        console.warn('⚠️  [Hook] useSubmitPA: No PA ID in response')
        return
      }

      console.log(`🎯 [Hook] useSubmitPA: PA ID ${paId} cached for polling`)
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: paKeys.lists() })
      // Set the new PA data in cache
      queryClient.setQueryData(paKeys.detail(paId), result)
      queryClient.setQueryData(paKeys.status(paId), result)
    },
    onError: (error) => {
      console.error('❌ [Hook] useSubmitPA: mutation failed -', error)
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

export const usePlanDetails = (planId: string | undefined) => {
  return useQuery<Plan | null, Error>({
    queryKey: planDetailKeys.detail(planId || ''),
    queryFn: () => paService.getPlanDetails(planId!),
    enabled: !!planId,
  })
}

// ============== Dynamic Data Hooks ==============

// Hook to fetch all users from database
export const useUsers = () => {
  return useQuery<any[], Error>({
    queryKey: ['users', 'all'],
    queryFn: () => paService.getAllUsers(),
  })
}

// Hook to fetch all payers from database
export const useAllPayers = () => {
  return useQuery<Payer[], Error>({
    queryKey: ['payers', 'database', 'all'],
    queryFn: () => paService.getAllPayers(),
  })
}

// Hook to fetch plans by payer from database
export const usePlansByPayerDB = (payerId: string | undefined) => {
  return useQuery<Plan[], Error>({
    queryKey: ['plans', 'database', payerId],
    queryFn: () => paService.getPlansByPayerId(payerId!),
    enabled: !!payerId,
  })
}

// Hook to fetch procedures
export const useProcedures = (planId?: string) => {
  return useQuery<any[], Error>({
    queryKey: ['procedures', 'database', planId],
    queryFn: () => paService.getProcedures(planId),
  })
}

// Hook to fetch required documents
export const useDocumentsRequired = (planId?: string) => {
  return useQuery<any[], Error>({
    queryKey: ['documents', 'database', planId],
    queryFn: () => paService.getDocumentsRequired(planId),
    enabled: !!planId,
  })
}

export const useWaitingPeriods = (planId?: string) => {
  return useQuery<WaitingPeriod[], Error>({
    queryKey: waitingPeriodKeys.list(planId),
    queryFn: () => paService.getWaitingPeriods(planId),
    enabled: !!planId,
  })
}

export const useExcludedProcedures = (planId?: string) => {
  return useQuery<ExcludedProcedure[], Error>({
    queryKey: excludedProcedureKeys.list(planId),
    queryFn: () => paService.getExcludedProcedures(planId),
    enabled: !!planId,
  })
}

export const useStepTherapy = (planId?: string) => {
  return useQuery<StepTherapyRule[], Error>({
    queryKey: stepTherapyKeys.list(planId),
    queryFn: () => paService.getStepTherapy(planId),
    enabled: !!planId,
  })
}

export const useHospitals = (payerId?: string, search?: string) => {
  return useQuery<Hospital[], Error>({
    queryKey: hospitalKeys.list(payerId, search),
    queryFn: () => paService.getHospitals(payerId, search),
  })
}

export const useClaimHistory = (patientId?: string) => {
  return useQuery<ClaimHistoryRow[], Error>({
    queryKey: claimHistoryKeys.list(patientId),
    queryFn: () => paService.getClaimHistory(patientId),
  })
}

// Hook to fetch ICD codes with search
export const useICDCodes = (search?: string) => {
  return useQuery<any[], Error>({
    queryKey: ['icd-codes', 'database', search],
    queryFn: () => paService.getICDCodes(search),
    enabled: !!search,
  })
}

// Hook to fetch CPT codes with search
export const useCPTCodes = (search?: string) => {
  return useQuery<any[], Error>({
    queryKey: ['cpt-codes', 'database', search],
    queryFn: () => paService.getCPTCodes(search),
    enabled: !!search,
  })
}

// Hook to fetch plans for the current provider from user_policies
export const useProviderPlans = () => {
  return useQuery<Plan[], Error>({
    queryKey: ['plans', 'provider'],
    queryFn: () => paService.getProviderPlans(),
  })
}
