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
  Loader2,
  Calendar,
} from 'lucide-react'
import { useSubmitPA, usePayers, usePlansByPayer } from '../../hooks/usePA'
import { useNotifications } from '../../hooks/useNotifications'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Select } from '../../components/common/Select'

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
})

const step2Schema = z.object({
  icd10Codes: z.array(z.string()).min(1, 'At least one ICD-10 code is required'),
  cptCodes: z.array(z.string()).min(1, 'At least one CPT code is required'),
  priorTreatmentHistory: z.string().optional(),
  medicationName: z.string().optional(),
  medicationDosage: z.string().optional(),
})

const step3Schema = z.object({
  documents: z.array(z.instanceof(File)).min(1, 'At least one document is required'),
})

const formSchema = step1Schema.merge(step2Schema).merge(step3Schema)

type FormData = z.infer<typeof formSchema>

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
  const [currentStep, setCurrentStep] = useState(DIRECT_DOC_UPLOAD_TEST_MODE ? 3 : 1)
  const [icdInput, setIcdInput] = useState('')
  const [cptInput, setCptInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)

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
      documents: [],
    },
    mode: 'onBlur',
  })

  const selectedPayerId = watch('payerId')
  const icd10Codes = watch('icd10Codes') || []
  const cptCodes = watch('cptCodes') || []
  const documents = watch('documents') || []

  const submitPAMutation = useSubmitPA()
  const { data: payers, isLoading: isLoadingPayers } = usePayers()
  const { data: plans, isLoading: isLoadingPlans } = usePlansByPayer(selectedPayerId)

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const addIcdCode = () => {
    const trimmed = icdInput.trim().toUpperCase()
    if (!trimmed) return
    if (!icd10Codes.includes(trimmed)) {
      setValue('icd10Codes', [...icd10Codes, trimmed], { shouldValidate: true })
    }
    setIcdInput('')
  }

  const removeIcdCode = (code: string) => {
    setValue(
      'icd10Codes',
      icd10Codes.filter((c) => c !== code),
      { shouldValidate: true }
    )
  }

  const addCptCode = () => {
    const trimmed = cptInput.trim().toUpperCase()
    if (!trimmed) return
    if (!cptCodes.includes(trimmed)) {
      setValue('cptCodes', [...cptCodes, trimmed], { shouldValidate: true })
    }
    setCptInput('')
  }

  const removeCptCode = (code: string) => {
    setValue(
      'cptCodes',
      cptCodes.filter((c) => c !== code),
      { shouldValidate: true }
    )
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
        documents: data.documents,
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
      { id: 1, label: 'Patient & Insurance', description: 'Basic information' },
      { id: 2, label: 'Clinical Info', description: 'Diagnosis & codes' },
      { id: 3, label: 'Documents', description: 'Upload records' },
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
            {steps.map((step, index) => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <Controller
          name="planId"
          control={control}
          render={({ field }) => (
            <Select
              label="Insurance Plan"
              value={field.value}
              onChange={field.onChange}
              options={plans?.map((p) => ({ value: p.id, label: p.name })) || []}
              placeholder={!selectedPayerId ? 'Select payer first' : isLoadingPlans ? 'Loading plans...' : 'Select a plan'}
              error={errors.planId?.message}
              loading={isLoadingPlans}
              disabled={!selectedPayerId}
              required
            />
          )}
        />
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
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6 relative z-10 bg-white">
      <div className="border-b border-neutral-200 pb-4 bg-white">
        <h3 className="text-xl font-semibold text-neutral-900">Step 2: Clinical Information</h3>
        <p className="text-sm text-neutral-500 mt-1">Enter diagnosis codes and procedure codes</p>
      </div>

      {/* ICD-10 Codes */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
          ICD-10 Codes <span className="text-danger-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {icd10Codes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm border border-primary-200"
            >
              {code}
              <button type="button" onClick={() => removeIcdCode(code)} className="ml-2 hover:text-primary-900 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
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
            placeholder="Type code and press Enter"
            className="flex-1 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
              placeholder:text-neutral-400
              focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
              hover:border-neutral-300 transition-all duration-150"
          />
          <Button type="button" variant="secondary" onClick={addIcdCode}>
            Add
          </Button>
        </div>
        {errors.icd10Codes && (
          <p className="mt-1.5 text-sm text-danger-600 flex items-center">
            <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
            {errors.icd10Codes.message}
          </p>
        )}
      </div>

      {/* CPT Codes */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
          CPT Codes <span className="text-danger-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {cptCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 bg-success-100 text-success-700 rounded-full text-sm border border-success-200"
            >
              {code}
              <button type="button" onClick={() => removeCptCode(code)} className="ml-2 hover:text-success-900 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
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
            placeholder="Type code and press Enter"
            className="flex-1 px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
              placeholder:text-neutral-400
              focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
              hover:border-neutral-300 transition-all duration-150"
          />
          <Button type="button" variant="secondary" onClick={addCptCode}>
            Add
          </Button>
        </div>
        {errors.cptCodes && (
          <p className="mt-1.5 text-sm text-danger-600 flex items-center">
            <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
            {errors.cptCodes.message}
          </p>
        )}
      </div>

      <Controller
        name="priorTreatmentHistory"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
              Prior Treatment History
            </label>
            <textarea
              {...field}
              rows={4}
              className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900
                placeholder:text-neutral-400
                focus:outline-none focus:ring-[3px] focus:ring-primary-500/25 focus:border-primary-500
                hover:border-neutral-300 transition-all duration-150 resize-none"
              placeholder="Describe any prior treatments..."
            />
          </div>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Controller
          name="medicationName"
          control={control}
          render={({ field }) => <Input {...field} label="Medication Name" placeholder="e.g., Humira" />}
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
  )

  const renderStep3 = () => (
    <div className="space-y-6 relative z-10 bg-white">
      <div className="border-b border-neutral-200 pb-4 bg-white">
        <h3 className="text-xl font-semibold text-neutral-900">Step 3: Supporting Documents</h3>
        <p className="text-sm text-neutral-500 mt-1">Upload clinical notes and supporting documents</p>
      </div>

      {/* Document Requirements Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900">Document Requirements</h4>
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-blue-800">
                <strong>Required:</strong> Clinical Notes, Patient Demographics
              </p>
              <p className="text-blue-700">
                <strong>Optional:</strong> Prior Lab Results, Imaging Reports
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
          border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          ${isDragging
            ? 'border-primary-500 bg-primary-50/50'
            : 'border-neutral-300 hover:border-primary-400 hover:bg-neutral-50'
          }
        `}
      >
        <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <p className="text-neutral-700 font-semibold mb-2">Drag and drop files here</p>
        <p className="text-neutral-500 text-sm mb-4">or click to browse</p>
        <label className="cursor-pointer inline-flex">
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <span className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm">
            Browse Files
          </span>
        </label>
      </div>

      {errors.documents && (
        <div className="flex items-center text-danger-600 bg-danger-50 rounded-lg p-3">
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
  )

  return (
    <div className="max-w-4xl mx-auto">
      <Card title="Prior Authorization Request" subtitle="Submit a new PA request for your patient">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {renderStepIndicator()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

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
