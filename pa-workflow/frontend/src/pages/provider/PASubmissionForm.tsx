import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
  Calendar,
  Loader2,
} from 'lucide-react'
import {
  useSubmitPA,
  usePayers,
  usePlansByPayer,
  useProviderPlans,
  usePlanDetails,
  useDocumentsRequired,
  useWaitingPeriods,
  useExcludedProcedures,
  useStepTherapy,
  useICDCodes,
  useCPTCodes,
  useExtractCodes,
} from '../../hooks/usePA'
import { paService } from '../../services/pa.service'
import { useNotifications } from '../../hooks/useNotifications'
import type { Plan, WaitingPeriod, ExcludedProcedure, StepTherapyRule } from '../../types/pa.types'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Select } from '../../components/common/Select'
import { Spinner } from '../../components/common/Spinner'

// Validation schemas for each step
const step1Schema = z.object({
  patientMemberId: z.string().min(8, 'Member ID must be at least 8 characters').max(20, 'Member ID must be at most 20 characters'),
  payerId: z.string().min(1, 'Please select a payer'),
  planId: z.string().min(1, 'Please select a plan'),
  providerNpi: z.string().regex(/^\d{10}$/, 'NPI must be exactly 10 digits'),
  dateOfService: z.string().refine((date) => {
    const selected = new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return selected <= today
  }, 'Date of service cannot be in the future'),
  documents: z.array(z.instanceof(File)).min(1, 'At least one document is required'),
})

const step2Schema = z.object({
  icd10Codes: z.array(z.string()).min(1, 'At least one ICD-10 code is required'),
  cptCodes: z.array(z.string()).min(1, 'At least one CPT code is required'),
  priorTreatmentHistory: z.string().optional(),
  medicationName: z.string().optional(),
  medicationDosage: z.string().optional(),
})

const step3Schema = z.object({
  priorTreatmentHistory: z.string().optional(),
  medicationName: z.string().optional(),
  medicationDosage: z.string().optional(),
  medicalNecessitySummary: z.string().min(20, 'Medical necessity summary must be at least 20 characters'),
  clinicalSummary: z.string().min(20, 'Clinical summary must be at least 20 characters'),
  reasonForClaim: z.string().min(20, 'Reason for claiming must be at least 20 characters'),
  providerNotes: z.string().optional(),
})

const formSchema = step1Schema.merge(step2Schema).merge(step3Schema)

type FormDataBase = z.infer<typeof formSchema>
type FormData = FormDataBase & { dynamicQuestionAnswers?: Record<string, string> }

interface UploadedFile {
  id: string
  file: File
  name: string
  size: number
  type: string
}

// Temporary testing switch: lets provider land directly on document upload.
const DIRECT_DOC_UPLOAD_TEST_MODE = true

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const PASubmissionForm: React.FC = () => {
  const navigate = useNavigate()
  const { showNotification } = useNotifications()
  const [currentStep, setCurrentStep] = useState(1)
  const [icdInput, setIcdInput] = useState('')
  const [cptInput, setCptInput] = useState('')
  const [icdSearch, setIcdSearch] = useState('')
  const [cptSearch, setCptSearch] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [extractedCodes, setExtractedCodes] = useState<{ icd10: string[]; cpt: string[] }>({ icd10: [], cpt: [] })
  const [extractionMessage, setExtractionMessage] = useState('')
  const [loadingStepIndex, setLoadingStepIndex] = useState(0)
  const [extractionResult, setExtractionResult] = useState<{
    icd10Codes: string[]
    cptCodes: string[]
    exactMatchFound: boolean
    message: string
  } | null>(null)
  const [sonarPayload, setSonarPayload] = useState<any | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [dynamicQuestions, setDynamicQuestions] = useState<any[]>([])
  const [loadingDynamicQuestions, setLoadingDynamicQuestions] = useState(false)

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientMemberId: DIRECT_DOC_UPLOAD_TEST_MODE ? 'TEST12345' : '',
      payerId: DIRECT_DOC_UPLOAD_TEST_MODE ? '11111111-1111-1111-1111-111111111111' : '',
      planId: DIRECT_DOC_UPLOAD_TEST_MODE ? 'plan-001' : '',
      providerNpi: DIRECT_DOC_UPLOAD_TEST_MODE ? '1234567890' : '',
      dateOfService: new Date().toISOString().split('T')[0],
      icd10Codes: DIRECT_DOC_UPLOAD_TEST_MODE ? ['E11.9'] : [],
      cptCodes: DIRECT_DOC_UPLOAD_TEST_MODE ? ['99213'] : [],
      priorTreatmentHistory: '',
      medicationName: '',
      medicationDosage: '',
      medicalNecessitySummary: '',
      clinicalSummary: '',
      reasonForClaim: '',
      providerNotes: '',
      dynamicQuestionAnswers: {},
      documents: [],
    },
    mode: 'onBlur',
  })

  const selectedPayerId = watch('payerId')
  const icd10Codes = watch('icd10Codes') || []
  const cptCodes = watch('cptCodes') || []
  const documents = watch('documents') || []
  const selectedPlanId = watch('planId')

  const extractCodesMutation = useExtractCodes()
  const submitPAMutation = useSubmitPA()
  const { data: payers, isLoading: isLoadingPayers } = usePayers()
  const { data: plans, isLoading: isLoadingPlans } = usePlansByPayer(selectedPayerId)
  const { data: providerPlans = [], isLoading: isLoadingProviderPlans, isFetched: hasFetchedProviderPlans } = useProviderPlans()
  const showProviderPlans = !hasFetchedProviderPlans || providerPlans.length > 0
  const {
    data: selectedPlanDetailsData,
    isLoading: isLoadingPlanDetails,
    isFetching: isFetchingPlanDetails,
  } = usePlanDetails(selectedPlanId)
  const selectedPlanDetails = selectedPlanDetailsData as Plan | undefined
  const {
    data: documentRequirementsData,
    isLoading: isLoadingDocumentRequirements,
    isFetching: isFetchingDocumentRequirements,
  } = useDocumentsRequired(selectedPlanId)
  const documentRequirements = (documentRequirementsData ?? []) as Array<{ id: number | string; documentName: string }>
  const {
    data: waitingPeriodsData,
    isLoading: isLoadingWaitingPeriods,
    isFetching: isFetchingWaitingPeriods,
  } = useWaitingPeriods(selectedPlanId)
  const waitingPeriods = (waitingPeriodsData ?? []) as WaitingPeriod[]
  const {
    data: excludedProceduresData,
    isLoading: isLoadingExcludedProcedures,
    isFetching: isFetchingExcludedProcedures,
  } = useExcludedProcedures(selectedPlanId)
  const excludedProcedures = (excludedProceduresData ?? []) as ExcludedProcedure[]
  const {
    data: stepTherapyData,
    isLoading: isLoadingStepTherapy,
    isFetching: isFetchingStepTherapy,
  } = useStepTherapy(selectedPlanId)
  const { data: icdSuggestions = [] } = useICDCodes(icdSearch.trim())
  const { data: cptSuggestions = [] } = useCPTCodes(cptSearch.trim())
  const stepTherapy = (stepTherapyData ?? []) as StepTherapyRule[]
  const isPlanMetadataLoading =
    !!selectedPlanId &&
    (isLoadingPlanDetails ||
      isFetchingPlanDetails ||
      isLoadingDocumentRequirements ||
      isFetchingDocumentRequirements ||
      isLoadingWaitingPeriods ||
      isFetchingWaitingPeriods ||
      isLoadingExcludedProcedures ||
      isFetchingExcludedProcedures ||
      isLoadingStepTherapy ||
      isFetchingStepTherapy)

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  // Fetch dynamic questions when entering Step 2
  React.useEffect(() => {
    let mounted = true
    const fetchQuestions = async () => {
      if (currentStep !== 2) return
      try {
        setLoadingDynamicQuestions(true)
        const context = {
          patientMemberId: watch('patientMemberId'),
          icd10Codes: watch('icd10Codes'),
          cptCodes: watch('cptCodes'),
          priorTreatment: watch('priorTreatmentHistory'),
          planId: watch('planId'),
          documentsCount: (watch('documents') || []).length,
        }
        const res = await paService.generateQuestions(context)
        if (!mounted) return
        setDynamicQuestions(res.questions || [])
      } catch (err) {
        console.error('Failed to load dynamic questions', err)
      } finally {
        if (mounted) setLoadingDynamicQuestions(false)
      }
    }

    fetchQuestions()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  React.useEffect(() => {
    if (!isExtracting) return undefined

    const loadingSteps = [
      'Uploading document...',
      'Detecting document type...',
      'Running OCR extraction...',
      'Cleaning and structuring text...',
      'Building parsed JSON...',
      'Saving results for review...',
    ]

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingSteps.length)
    }, 1600)

    return () => window.clearInterval(intervalId)
  }, [isExtracting])

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleExtractCodes = async (files: File[] = documents) => {
    if (files.length === 0) {
      showNotification({
        type: 'error',
        title: 'No Documents',
        message: 'Please upload at least one document before extracting codes.',
      })
      return
    }

    try {
      setIsExtracting(true)
      // Call the new endpoint that returns the full sonar-like payload
      const sonarPayload = await paService.extractSonarFromDocuments(files)
      setSonarPayload(sonarPayload)
      setExtractionResult({
        icd10Codes: sonarPayload.medical_codes?.icd10_codes || [],
        cptCodes: sonarPayload.medical_codes?.cpt_codes || [],
        exactMatchFound: !!((sonarPayload.medical_codes?.icd10_codes || []).length || (sonarPayload.medical_codes?.cpt_codes || []).length),
        message: sonarPayload.text_analysis?.summary || 'Sonar analysis complete.',
      })

      setExtractedCodes({ icd10: sonarPayload.medical_codes?.icd10_codes || [], cpt: sonarPayload.medical_codes?.cpt_codes || [] })
      setExtractionMessage(sonarPayload.text_analysis?.summary || '')
      setValue('icd10Codes', sonarPayload.medical_codes?.icd10_codes || [], { shouldValidate: true })
      setValue('cptCodes', sonarPayload.medical_codes?.cpt_codes || [], { shouldValidate: true })

      showNotification({ type: 'success', title: 'Sonar Analysis Complete', message: 'Full Sonar analysis and OCR preview are available below.' })

      // Store the full sonar payload for the viewer and debugging
      setSonarPayload(sonarPayload)
        ; (window as any).__lastSonarPayload = sonarPayload
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Extraction Failed',
        message: error instanceof Error ? error.message : 'Could not run Sonar analysis on documents. Please try again or add codes manually.',
      })
    } finally {
      setIsExtracting(false)
    }
  }

  const addIcdCode = () => {
    const trimmed = icdInput.trim().toUpperCase()
    if (!trimmed) return
    if (icd10Codes.includes(trimmed)) {
      setIcdInput('')
      return
    }
    setValue('icd10Codes', [...icd10Codes, trimmed], { shouldValidate: true })
    setIcdInput('')
  }

  const removeIcdCode = (codeToRemove: string) => {
    setValue('icd10Codes', icd10Codes.filter((code) => code !== codeToRemove), {
      shouldValidate: true,
    })
    setExtractedCodes((prev) => ({
      ...prev,
      icd10: prev.icd10.filter((code) => code !== codeToRemove),
    }))
  }

  const addCptCode = () => {
    const trimmed = cptInput.trim().toUpperCase()
    if (!trimmed) return
    if (cptCodes.includes(trimmed)) {
      setCptInput('')
      return
    }
    setValue('cptCodes', [...cptCodes, trimmed], { shouldValidate: true })
    setCptInput('')
  }

  const removeCptCode = (codeToRemove: string) => {
    setValue('cptCodes', cptCodes.filter((code) => code !== codeToRemove), {
      shouldValidate: true,
    })
    setExtractedCodes((prev) => ({
      ...prev,
      cpt: prev.cpt.filter((code) => code !== codeToRemove),
    }))
  }

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Accepted: PDF, JPEG, PNG, TIFF'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 10MB limit'
    }
    return null
  }

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return

      const newFiles: UploadedFile[] = []
      const fileErrors: string[] = []

      Array.from(files).forEach((file) => {
        const error = validateFile(file)
        if (error) {
          fileErrors.push(`${file.name}: ${error}`)
        } else {
          newFiles.push({
            id: Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
          })
        }
      })

      if (fileErrors.length > 0) {
        showNotification({
          type: 'error',
          title: 'File Upload Error',
          message: fileErrors.join('\n'),
        })
      }

      if (newFiles.length > 0) {
        const allFiles = [...documents, ...newFiles.map((f) => f.file)]
        setValue('documents', allFiles, { shouldValidate: true })
        void handleExtractCodes(allFiles)
      }
    },
    [documents, setValue, showNotification]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }

  const removeFile = (index: number) => {
    const newFiles = documents.filter((_, i) => i !== index)
    setValue('documents', newFiles, { shouldValidate: true })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const onSubmit = async (data: FormData) => {
    try {
      console.log('🚀 [Form] Submit button clicked. Processing PA submission...')
      const submissionData = {
        patientMemberId: data.patientMemberId,
        payerId: data.payerId,
        planId: data.planId,
        providerNpi: data.providerNpi,
        dateOfService: data.dateOfService,
        icd10Codes: data.icd10Codes,
        cptCodes: data.cptCodes,
        priorTreatmentHistory: data.priorTreatmentHistory,
        medicationName: data.medicationName,
        medicationDosage: data.medicationDosage,
        medicalNecessitySummary: data.medicalNecessitySummary,
        clinicalSummary: data.clinicalSummary,
        reasonForClaim: data.reasonForClaim,
        providerNotes: data.providerNotes,
        documents: data.documents,
        dynamicQuestionAnswers: data.dynamicQuestionAnswers || {},
      }

      // Run lightweight AI review (non-blocking) to surface issues before final submit
      try {
        const reviewInput = {
          ...submissionData,
          documents: (data.documents || []).map((d: File) => d.name),
        }
        const review = await paService.aiReview(reviewInput)
        if (review && review.issues && review.issues.length > 0) {
          showNotification({ type: 'warning', title: 'AI Review Issues', message: `The AI reviewer found ${review.issues.length} issues. Please review before submitting.` })
        }
      } catch (err) {
        console.warn('AI review failed (non-blocking)', err)
      }

      console.log('⏳ [Form] Waiting for backend response (this may take up to 3 minutes)...')
      const startTime = Date.now()
      const result = await submitPAMutation.mutateAsync(submissionData)
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`⏱️  [Form] Response received in ${elapsedTime} seconds`)

      const paId = (result as { id?: string; pa_id?: string }).id || (result as { id?: string; pa_id?: string }).pa_id
      console.log('✨ [Form] Full API Response:', result)
      console.log('🎯 [Form] PA ID extracted:', paId)

      // Display OCR results details
      const details = (result as any)?.details
      if (details?.agent_a_output?.ocr_results) {
        const ocrResults = details.agent_a_output.ocr_results
        console.log('\n🔍 [Form] OCR RESULTS SUMMARY:')
        console.log(`Document Type: ${ocrResults.document_type || 'Unknown'}`)
        console.log(`Confidence: ${ocrResults.confidence?.toFixed(4) || 'N/A'}`)
        console.log(`Total Lines Extracted: ${ocrResults.clean_lines?.length || 0}`)
        if (ocrResults.full_text) {
          console.log(`Full Text Preview: ${ocrResults.full_text.substring(0, 200)}...`)
        }
        console.log('\n')
      }

      showNotification({
        type: 'success',
        title: 'PA Submitted Successfully',
        message: `Your prior authorization request ${paId || 'is'} has been submitted.`,
      })
      if (paId) {
        console.log(`🔗 [Form] Navigating to status page: /provider/status/${paId}`)
        navigate(`/provider/status/${paId}`)
      }
    } catch (error) {
      console.error('❌ [Form] Submission error:', error)
      showNotification({
        type: 'error',
        title: 'Submission Failed',
        message: error instanceof Error ? error.message : 'There was an error submitting your PA request. Please try again.',
      })
    }
  }

  const renderStepIndicator = () => {
    const steps = [
      { id: 1, label: 'Patient & Documents', description: 'Info and supporting files' },
      { id: 2, label: 'Review Codes', description: 'Diagnosis & procedure codes' },
      { id: 3, label: 'Clinical Details', description: 'History and medications' },
    ]

    return (
      <div className="mb-10 md:mb-24 lg:mb-28">
        {/* Desktop: Horizontal Stepper */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-neutral-200 -translate-y-1/2 rounded-full" />
            <div
              className="absolute left-0 top-1/2 h-1 bg-gradient-to-r from-primary-600 to-primary-500 -translate-y-1/2 transition-all duration-500 rounded-full"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step) => {
              const isCompleted = step.id < currentStep
              const isCurrent = step.id === currentStep

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm
                      transition-all duration-300 shadow-sm
                      ${isCompleted
                        ? 'bg-success-500 text-white shadow-success-500/30'
                        : isCurrent
                          ? 'bg-white border-2 border-primary-500 text-primary-600 shadow-md shadow-primary-500/20 scale-110'
                          : 'bg-white border-2 border-neutral-200 text-neutral-400'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="absolute top-14 w-32 text-center">
                    <p className={`text-sm font-semibold ${isCurrent || isCompleted ? 'text-neutral-900' : 'text-neutral-400'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mobile: Vertical Stepper */}
        <div className="md:hidden">
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isCompleted = step.id < currentStep
              const isCurrent = step.id === currentStep

              return (
                <div key={step.id} className="flex items-start">
                  <div className="flex flex-col items-center mr-4">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                        transition-all duration-300
                        ${isCompleted
                          ? 'bg-success-500 text-white'
                          : isCurrent
                            ? 'bg-primary-500 text-white'
                            : 'bg-neutral-200 text-neutral-400'
                        }
                      `}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-0.5 h-6 mt-1 rounded-full ${isCompleted ? 'bg-success-500' : 'bg-neutral-200'
                          }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={`text-sm font-semibold ${isCurrent || isCompleted ? 'text-neutral-900' : 'text-neutral-400'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-neutral-400">{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderStep1 = () => (
    <div className="space-y-6 relative z-10 bg-white">
      <div className="border-b border-neutral-200 pb-4 bg-white">
        <h3 className="text-xl font-semibold text-neutral-900">Step 1: Patient & Insurance Details</h3>
        <p className="text-sm text-neutral-500 mt-1">Enter patient member ID, insurance information, and service date</p>
      </div>

      <Controller
        name="patientMemberId"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            label="Patient Member ID"
            error={errors.patientMemberId?.message}
            placeholder="Enter member ID (8-20 characters)"
            required
          />
        )}
      />

      <div className={`grid gap-6 ${showProviderPlans ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {!showProviderPlans && (
          <Controller
            name="payerId"
            control={control}
            render={({ field }) => (
              <Select
                label="Insurance Payer"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value)
                  setValue('planId', '')
                }}
                options={payers?.map((p) => ({ value: p.id, label: p.name })) || []}
                placeholder={isLoadingPayers ? 'Loading payers...' : 'Select a payer'}
                error={errors.payerId?.message}
                loading={isLoadingPayers}
                required
              />
            )}
          />
        )}

        <Controller
          name="planId"
          control={control}
          render={({ field }) => {
            const planOptions = showProviderPlans ? providerPlans : plans

            const handlePlanChange = (value: string) => {
              field.onChange(value)
              if (showProviderPlans) {
                const selectedPlan = providerPlans.find((p) => p.id === value)
                if (selectedPlan && selectedPlan.payerId) {
                  setValue('payerId', selectedPlan.payerId)
                }
              }
            }

            return (
              <Select
                label={showProviderPlans ? 'Your Insurance Plans' : 'Insurance Plan'}
                value={field.value}
                onChange={handlePlanChange}
                options={planOptions?.map((p) => ({ value: p.id, label: p.name })) || []}
                placeholder="Select a plan"
                error={errors.planId?.message}
                loading={showProviderPlans ? isLoadingProviderPlans && hasFetchedProviderPlans : isLoadingPlans}
                disabled={showProviderPlans ? !hasFetchedProviderPlans : !selectedPayerId}
                required
              />
            )
          }}
        />

        <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4 space-y-4 min-h-[20rem]">
          <div>
            <h4 className="text-sm font-semibold text-primary-900">Plan details</h4>
            <p className="text-xs text-primary-700">Live metadata from the database</p>
          </div>

          {!selectedPlanId ? (
            <div className="flex min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-primary-200 bg-white/70 px-4 text-sm text-primary-700">
              Select an insurance plan to view coverage, documents, and policy rules.
            </div>
          ) : isPlanMetadataLoading ? (
            <div className="flex min-h-[14rem] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-primary-700">
                <Spinner size="lg" />
                <p className="text-sm font-medium">Loading plan details...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div className="rounded-lg border border-primary-100 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-primary-700">Coverage limit</div>
                  <div className="font-medium text-primary-950">
                    {selectedPlanDetails?.coverageLimit ? `$${selectedPlanDetails.coverageLimit.toLocaleString()}` : 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg border border-primary-100 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-primary-700">Waiting period</div>
                  <div className="font-medium text-primary-950">
                    {selectedPlanDetails?.waitingPeriodDays ?? 'N/A'} days
                  </div>
                </div>
                <div className="rounded-lg border border-primary-100 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-primary-700">Claims/year</div>
                  <div className="font-medium text-primary-950">
                    {selectedPlanDetails?.maxClaimsPerYear ?? 'N/A'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900">Required documents</h4>
                    <p className="text-xs text-neutral-500">Fetched from the database for the selected plan</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    {documentRequirements.length > 0 ? (
                      documentRequirements.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-neutral-700">
                          <CheckCircle2 className="w-4 h-4 text-success-600" />
                          {item.documentName}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-neutral-500 md:col-span-2">No document requirements found for this plan.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">Waiting periods</h4>
                    <ul className="space-y-1 text-sm text-neutral-700">
                      {waitingPeriods.length > 0 ? (
                        waitingPeriods.slice(0, 3).map((rule) => (
                          <li key={rule.id}>{rule.diseaseName}: {rule.waitingDays} days</li>
                        ))
                      ) : (
                        <li className="text-neutral-500">No waiting period rules found for this plan.</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">Excluded procedures</h4>
                    <ul className="space-y-1 text-sm text-neutral-700">
                      {excludedProcedures.length > 0 ? (
                        excludedProcedures.slice(0, 3).map((rule) => (
                          <li key={rule.id}>{rule.procedureName}</li>
                        ))
                      ) : (
                        <li className="text-neutral-500">No excluded procedures found for this plan.</li>
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900 mb-2">Step therapy</h4>
                    <ul className="space-y-1 text-sm text-neutral-700">
                      {stepTherapy.length > 0 ? (
                        stepTherapy.slice(0, 3).map((rule) => (
                          <li key={rule.id}>{rule.procedureName}: {rule.requiredPrior}</li>
                        ))
                      ) : (
                        <li className="text-neutral-500">No step therapy rules found for this plan.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Controller
        name="providerNpi"
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            label="Provider NPI"
            error={errors.providerNpi?.message}
            placeholder="10-digit NPI number"
            maxLength={10}
            required
          />
        )}
      />

      <Controller
        name="dateOfService"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
              Date of Service <span className="text-danger-500">*</span>
            </label>
            <div className="relative">
              <input
                {...field}
                type="date"
                max={new Date().toISOString().split('T')[0]}
                className={`
                  w-full px-3 py-2.5 bg-white border rounded-lg text-sm text-neutral-900
                  focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                  hover:border-neutral-300 transition-all duration-150
                  ${errors.dateOfService ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/25' : 'border-neutral-200'}
                `}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
            </div>
            {errors.dateOfService && (
              <p className="mt-1.5 text-sm text-danger-600 flex items-center">
                <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                {errors.dateOfService.message}
              </p>
            )}
          </div>
        )}
      />

      {/* Document Upload Section */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Supporting Documents <span className="text-danger-500">*</span>
        </label>

        {/* Document Requirements Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900">Document Requirements</h4>
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-blue-800">
                  <strong>Required:</strong>{' '}
                  {documentRequirements.length > 0
                    ? documentRequirements.slice(0, 8).map((item) => item.documentName).join(', ')
                    : 'Clinical Notes, Patient Demographics'}
                </p>
                <p className="text-blue-600">Accepted formats: PDF, JPEG, PNG, TIFF. Max size: 10MB per file.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 mb-4
            ${isDragging
              ? 'border-primary-500 bg-primary-50/50'
              : 'border-neutral-300 hover:border-primary-400 hover:bg-neutral-50'
            }
          `}
        >
          <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-700 font-semibold mb-2">Drag and drop files here</p>
          <p className="text-neutral-500 text-sm mb-4">or click to browse</p>
          <label className="cursor-pointer inline-flex relative">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
              onChange={handleFileSelect}
              className="hidden"
            />
            <span className="px-4 py-2 bg-primary-700 text-white rounded-lg hover:bg-primary-800 transition-colors shadow-sm opacity-100 visible z-10">
              Browse Files
            </span>
          </label>
        </div>

        {errors.documents && (
          <div className="flex items-center text-danger-600 bg-danger-50 rounded-lg p-3 mb-4">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="text-sm">{errors.documents.message}</span>
          </div>
        )}

        {/* Uploaded Files List */}
        {documents.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-neutral-900">Uploaded Files ({documents.length})</h4>
            {documents.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="flex items-center min-w-0">
                  <FileText className="w-5 h-5 text-neutral-400 mr-3 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{file.name}</p>
                    <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-1.5 text-neutral-400 hover:text-danger-500 hover:bg-danger-50 rounded-md transition-colors flex-shrink-0 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card title="Extracted OCR JSON" className="shadow-card border border-neutral-200">
        <div className="p-8 space-y-5">
          <p className="text-[15px] leading-7 text-slate-500">
            The OCR response JSON is shown below in a large centered viewer.
          </p>

          {isExtracting ? (
            <div className="min-h-[33rem] overflow-hidden rounded-[1.5rem] border border-dashed border-blue-200 bg-[#f8fbff] p-8 sm:p-10">
              <div className="flex items-center gap-4 mb-6 pl-2 sm:pl-6">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <div>
                  <p className="text-lg font-semibold text-slate-900">OCR in progress</p>
                  <p className="text-base text-slate-500">Please wait while we build the parsed JSON.</p>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-8 py-10 sm:px-12 sm:py-12 min-h-[24rem] flex items-center justify-center">
                <div className="text-center max-w-xl w-full">
                  <div className="flex items-center justify-center gap-3 mb-8">
                    <span className="h-3 w-3 rounded-full bg-blue-500/80 animate-pulse" />
                    <span className="h-3 w-3 rounded-full bg-blue-500/80 animate-pulse [animation-delay:150ms]" />
                    <span className="h-3 w-3 rounded-full bg-blue-500/80 animate-pulse [animation-delay:300ms]" />
                  </div>
                  <p className="text-[28px] leading-tight font-semibold text-slate-900 mb-3">
                    {[
                      'Uploading document...',
                      'Detecting document type...',
                      'Running OCR extraction...',
                      'Cleaning and structuring text...',
                      'Building parsed JSON...',
                      'Saving results for review...',
                    ][loadingStepIndex]}
                  </p>
                  <p className="text-[15px] leading-7 text-slate-500 max-w-lg mx-auto">
                    The extracted payload will appear here automatically once processing completes.
                  </p>
                </div>
              </div>
            </div>
          ) : extractionResult ? (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-4 sm:px-7">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Parsed OCR JSON</p>
                  <p className="text-xs text-slate-500">Scrollable view of the complete OCR response.</p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Live response
                </div>
              </div>
              <pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap break-words p-6 sm:p-7 text-sm leading-6 text-neutral-800 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))]">
                {JSON.stringify(sonarPayload || extractionResult, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-4 sm:px-7">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Parsed OCR JSON</p>
                  <p className="text-xs text-slate-500">Upload a document to generate the response.</p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Waiting
                </div>
              </div>
              <div className="min-h-[18rem] flex items-center justify-center p-6 sm:p-8 text-center">
                <div className="max-w-md">
                  <p className="text-lg font-semibold text-slate-900 mb-2">No OCR JSON available yet.</p>
                  <p className="text-sm text-slate-500">
                    Upload supporting documents and the extracted JSON will appear here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6 relative z-10 bg-white">
      <div className="border-b border-neutral-200 pb-4 bg-white">
        <h3 className="text-xl font-semibold text-neutral-900">Step 2: Review Extracted Codes</h3>
        <p className="text-sm text-neutral-500 mt-1">Medical codes extracted from your documents - review and approve</p>
      </div>

      {extractionMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="text-sm">{extractionMessage}</p>
          </div>
        </div>
      )}

      {extractCodesMutation.isPending && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="animate-spin mr-3">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-primary-300 rounded-full" />
            </div>
            <p className="text-sm text-primary-700 font-medium">Extracting medical codes from documents...</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">How Medical Codes Work</h4>
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-blue-800">
                <strong>ICD-10 Codes:</strong> Diagnosis codes that explain WHY the patient needs this procedure. Example: E11.9 (Type 2 Diabetes)
              </p>
              <p className="text-blue-800">
                <strong>CPT Codes:</strong> Procedure codes that describe WHAT procedure you're requesting. Example: 99213 (Office visit)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Diagnosis Codes (ICD-10) <span className="text-danger-500">*</span>
        </label>
        <input
          type="text"
          value={icdSearch}
          onChange={(e) => setIcdSearch(e.target.value)}
          placeholder="Search ICD-10 suggestions"
          className="mb-2 w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500 hover:border-neutral-300 transition-all duration-150"
        />
        {icdSuggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {icdSuggestions.slice(0, 8).map((item) => (
              <button
                key={item.icdCode}
                type="button"
                onClick={() => {
                  if (!icd10Codes.includes(item.icdCode)) {
                    setValue('icd10Codes', [...icd10Codes, item.icdCode], { shouldValidate: true })
                  }
                  setIcdSearch('')
                }}
                className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm text-primary-700 hover:bg-primary-100 transition-colors"
              >
                {item.icdCode}
              </button>
            ))}
          </div>
        )}

        {extractedCodes.icd10.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {extractedCodes.icd10.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center px-3 py-2 bg-primary-100 text-primary-700 rounded-full text-sm border border-primary-200"
                >
                  {code}
                  <button type="button" onClick={() => removeIcdCode(code)} className="ml-2 hover:text-primary-900 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mb-4">Found {extractedCodes.icd10.length} diagnosis codes. Remove any that don't apply.</p>
          </>
        ) : (
          <p className="text-sm text-neutral-600 mb-4">No diagnosis codes extracted from documents. You can add them manually below.</p>
        )}

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-medium text-neutral-700 mb-3">Add diagnosis codes manually</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={icdInput}
              onChange={(e) => setIcdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addIcdCode()
                }
              }}
              placeholder="Type code (e.g., E11.9) and press Enter"
              className="flex-1 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                placeholder:text-neutral-400
                focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                hover:border-neutral-300 transition-all duration-150"
            />
            <Button type="button" variant="secondary" onClick={addIcdCode}>
              Add
            </Button>
          </div>
        </div>

        {errors.icd10Codes && (
          <p className="mt-1.5 text-sm text-danger-600 flex items-center">
            <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
            {errors.icd10Codes.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          Procedure Codes (CPT) <span className="text-danger-500">*</span>
        </label>
        <input
          type="text"
          value={cptSearch}
          onChange={(e) => setCptSearch(e.target.value)}
          placeholder="Search CPT suggestions"
          className="mb-2 w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500 hover:border-neutral-300 transition-all duration-150"
        />
        {cptSuggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {cptSuggestions.slice(0, 8).map((item) => (
              <button
                key={item.cptCode}
                type="button"
                onClick={() => {
                  if (!cptCodes.includes(item.cptCode)) {
                    setValue('cptCodes', [...cptCodes, item.cptCode], { shouldValidate: true })
                  }
                  setCptSearch('')
                }}
                className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm text-primary-700 hover:bg-primary-100 transition-colors"
              >
                {item.cptCode}
              </button>
            ))}
          </div>
        )}

        {extractedCodes.cpt.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {extractedCodes.cpt.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center px-3 py-2 bg-success-100 text-success-700 rounded-full text-sm border border-success-200"
                >
                  {code}
                  <button type="button" onClick={() => removeCptCode(code)} className="ml-2 hover:text-success-900 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mb-4">Found {extractedCodes.cpt.length} procedure codes. Remove any that don't apply.</p>
          </>
        ) : (
          <p className="text-sm text-neutral-600 mb-4">No procedure codes extracted from documents. You can add them manually below.</p>
        )}

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          <p className="text-xs font-medium text-neutral-700 mb-3">Add procedure codes manually</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={cptInput}
              onChange={(e) => setCptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCptCode()
                }
              }}
              placeholder="Type code (e.g., 99213) and press Enter"
              className="flex-1 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                placeholder:text-neutral-400
                focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                hover:border-neutral-300 transition-all duration-150"
            />
            <Button type="button" variant="secondary" onClick={addCptCode}>
              Add
            </Button>
          </div>
        </div>

        {errors.cptCodes && (
          <p className="mt-1.5 text-sm text-danger-600 flex items-center">
            <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
            {errors.cptCodes.message}
          </p>
        )}
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6 relative z-10 bg-white">
      <div className="border-b border-neutral-200 pb-4 bg-white">
        <h3 className="text-xl font-semibold text-neutral-900">Step 3: Clinical Details</h3>
        <p className="text-sm text-neutral-500 mt-1">Provide clinical context and justification for insurance review</p>
      </div>

      {/* Medical Necessity Summary */}
      <Controller
        name="medicalNecessitySummary"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="text-red-500">*</span> Medical Necessity Summary
            </label>
            <p className="text-xs text-neutral-500 mb-2">Explain why this patient medically requires this procedure or treatment</p>
            <textarea
              {...field}
              rows={4}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                placeholder:text-neutral-400
                focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                hover:border-neutral-300 transition-all duration-150 resize-none"
              placeholder="e.g., Patient has Type 2 Diabetes with HbA1c of 9.2% despite standard therapy. This injectable therapy is medically necessary to prevent complications..."
            />
            {errors.medicalNecessitySummary && (
              <p className="text-xs text-red-500 mt-1">{errors.medicalNecessitySummary.message}</p>
            )}
          </div>
        )}
      />

      {/* Clinical Summary */}
      <Controller
        name="clinicalSummary"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="text-red-500">*</span> Clinical Summary
            </label>
            <p className="text-xs text-neutral-500 mb-2">Describe the patient's clinical presentation, current conditions, and relevant medical history</p>
            <textarea
              {...field}
              rows={4}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                placeholder:text-neutral-400
                focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                hover:border-neutral-300 transition-all duration-150 resize-none"
              placeholder="e.g., 55-year-old male with history of hypertension, Type 2 Diabetes, and hyperlipidemia. Currently on metformin and lisinopril. BMI 31. Recent labs show elevated triglycerides..."
            />
            {errors.clinicalSummary && (
              <p className="text-xs text-red-500 mt-1">{errors.clinicalSummary.message}</p>
            )}
          </div>
        )}
      />

      {/* Reason for Claim */}
      <Controller
        name="reasonForClaim"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <span className="text-red-500">*</span> Reason for Claiming
            </label>
            <p className="text-xs text-neutral-500 mb-2">Specify the specific reason for requesting insurance coverage (e.g., guideline-based therapy, failed conservative treatment, specialist recommendation)</p>
            <textarea
              {...field}
              rows={3}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                placeholder:text-neutral-400
                focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                hover:border-neutral-300 transition-all duration-150 resize-none"
              placeholder="e.g., Per ADA guidelines for inadequate glycemic control on metformin monotherapy; specialist endocrinologist recommendation; patient is unable to achieve target HbA1c with lifestyle modifications..."
            />
            {errors.reasonForClaim && (
              <p className="text-xs text-red-500 mt-1">{errors.reasonForClaim.message}</p>
            )}
          </div>
        )}
      />

      {/* Prior Treatment History & Medication (optional supporting details) */}
      <div className="border-t border-neutral-200 pt-4 mt-6">
        <h4 className="text-sm font-semibold text-neutral-700 mb-4">Additional Medical Information (Optional)</h4>

        <Controller
          name="priorTreatmentHistory"
          control={control}
          render={({ field }) => (
            <div className="mb-4">
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                Prior Treatment History
              </label>
              <textarea
                {...field}
                rows={3}
                className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                  placeholder:text-neutral-400
                  focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                  hover:border-neutral-300 transition-all duration-150 resize-none"
                placeholder="e.g., Patient previously tried metformin 2000mg daily for 6 months without adequate response..."
              />
            </div>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="medicationName"
            control={control}
            render={({ field }) => <Input {...field} label="Current Medication Name" placeholder="e.g., Humira" />}
          />

          <Controller
            name="medicationDosage"
            control={control}
            render={({ field }) => (
              <Input {...field} label="Medication Dosage" placeholder="e.g., 40mg every 2 weeks" />
            )}
          />
        </div>
      </div>

      {/* Dynamic follow-up questions (LLM generated) */}
      {loadingDynamicQuestions ? (
        <div className="p-3 bg-neutral-50 rounded">Loading follow-up questions…</div>
      ) : dynamicQuestions.length > 0 ? (
        <div className="space-y-4 border-t border-neutral-200 pt-4">
          <h4 className="text-sm font-semibold text-neutral-700">Follow-up Questions</h4>
          {dynamicQuestions.map((q: any) => (
            <div key={q.id} className="mb-3">
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">{q.label}</label>
              {q.type === 'select' ? (
                <Controller
                  name={("dynamicQuestionAnswers." + q.field) as any}
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900"
                    >
                      <option value="">Select...</option>
                      {(q.options || []).map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                />
              ) : (
                <Controller
                  name={("dynamicQuestionAnswers." + q.field) as any}
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={q.type === 'text' ? 3 : 1}
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 resize-none"
                      placeholder={q.placeholder || ''}
                    />
                  )}
                />
              )}
              {q.rationale && <p className="text-xs text-neutral-500 mt-1">Why: {q.rationale}</p>}
            </div>
          ))}
        </div>
      ) : null}

      {/* Provider Notes */}
      <Controller
        name="providerNotes"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
              Additional Provider Notes
            </label>
            <p className="text-xs text-neutral-500 mb-2">Any additional clinical justification or context for the reviewer</p>
            <textarea
              {...field}
              rows={3}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                placeholder:text-neutral-400
                focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                hover:border-neutral-300 transition-all duration-150 resize-none"
              placeholder="Any additional clinical information or special considerations..."
            />
          </div>
        )}
      />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <Card title="Prior Authorization Request" subtitle="Submit a new PA request for your patient">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {renderStepIndicator()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && renderStep4()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={currentStep === 1}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext}>
                Next Step
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                loading={isSubmitting || submitPAMutation.isPending}
                disabled={documents.length === 0}
              >
                Submit PA Request
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}

export default PASubmissionForm
