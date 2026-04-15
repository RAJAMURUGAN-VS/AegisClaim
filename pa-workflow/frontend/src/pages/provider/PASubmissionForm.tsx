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

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const PASubmissionForm: React.FC = () => {
  const navigate = useNavigate()
  const { showNotification } = useNotifications()
  const [currentStep, setCurrentStep] = useState(1)
  const [icdInput, setIcdInput] = useState('')
  const [cptInput, setCptInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientMemberId: '',
      payerId: '',
      planId: '',
      providerNpi: '',
      dateOfService: new Date().toISOString().split('T')[0],
      icd10Codes: [],
      cptCodes: [],
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

  const validateCurrentStep = async (): Promise<boolean> => {
    let fieldsToValidate: (keyof FormData)[] = []

    switch (currentStep) {
      case 1:
        fieldsToValidate = ['patientMemberId', 'payerId', 'planId', 'providerNpi', 'dateOfService']
        break
      case 2:
        fieldsToValidate = ['icd10Codes', 'cptCodes']
        break
      case 3:
        fieldsToValidate = ['documents']
        break
    }

    const result = await trigger(fieldsToValidate)
    return result
  }

  const handleNext = async () => {
    const isValid = await validateCurrentStep()
    if (isValid && currentStep < 3) {
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
      const submissionData = {
        patientName: '',
        patientDOB: data.dateOfService,
        memberId: data.patientMemberId,
        insurancePlan: data.planId,
        providerNPI: data.providerNpi,
        providerName: '',
        providerPhone: '',
        serviceType: 'MEDICAL' as const,
        procedureCodes: data.cptCodes,
        diagnosisCodes: data.icd10Codes,
        clinicalHistory: data.priorTreatmentHistory || '',
        previousTreatments: '',
        symptoms: '',
        durationOfSymptoms: '',
        urgencyLevel: 'ROUTINE' as const,
        requestedDate: data.dateOfService,
      }

      const result = await submitPAMutation.mutateAsync(submissionData)

      showNotification({
        type: 'success',
        title: 'PA Submitted Successfully',
        message: `Your prior authorization request ${result.id} has been submitted.`,
      })
      navigate(`/provider/status/${result.id}`)
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Submission Failed',
        message: error instanceof Error ? error.message : 'There was an error submitting your PA request. Please try again.',
      })
    }
  }

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-200 -translate-y-1/2" />
        <div
          className="absolute left-0 top-1/2 h-1 bg-primary -translate-y-1/2 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
        />
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
              step < currentStep
                ? 'bg-success text-white'
                : step === currentStep
                  ? 'bg-primary text-white'
                  : 'bg-white border-2 border-gray-300 text-gray-500'
            }`}
          >
            {step < currentStep ? <CheckCircle2 className="w-5 h-5" /> : step}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span className={currentStep >= 1 ? 'text-primary font-medium' : 'text-gray-500'}>
          Patient & Insurance
        </span>
        <span className={currentStep >= 2 ? 'text-primary font-medium' : 'text-gray-500'}>
          Clinical Info
        </span>
        <span className={currentStep >= 3 ? 'text-primary font-medium' : 'text-gray-500'}>Documents</span>
      </div>
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Step 1: Patient & Insurance Details</h3>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Controller
          name="payerId"
          control={control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Payer <span className="text-danger">*</span>
              </label>
              <select
                {...field}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.payerId ? 'border-danger' : 'border-gray-300'
                }`}
                disabled={isLoadingPayers}
              >
                <option value="">Select a payer</option>
                {payers?.map((payer) => (
                  <option key={payer.id} value={payer.id}>
                    {payer.name}
                  </option>
                ))}
              </select>
              {isLoadingPayers && (
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading payers...
                </div>
              )}
              {errors.payerId && <p className="mt-1 text-sm text-danger">{errors.payerId.message}</p>}
            </div>
          )}
        />

        <Controller
          name="planId"
          control={control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Plan <span className="text-danger">*</span>
              </label>
              <select
                {...field}
                disabled={!selectedPayerId || isLoadingPlans}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.planId ? 'border-danger' : 'border-gray-300'
                } ${!selectedPayerId || isLoadingPlans ? 'bg-gray-100' : ''}`}
              >
                <option value="">{selectedPayerId ? 'Select a plan' : 'Select payer first'}</option>
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              {isLoadingPlans && (
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading plans...
                </div>
              )}
              {errors.planId && <p className="mt-1 text-sm text-danger">{errors.planId.message}</p>}
            </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Service <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                {...field}
                type="date"
                max={new Date().toISOString().split('T')[0]}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.dateOfService ? 'border-danger' : 'border-gray-300'
                }`}
              />
              <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            {errors.dateOfService && <p className="mt-1 text-sm text-danger">{errors.dateOfService.message}</p>}
          </div>
        )}
      />
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Step 2: Clinical Information</h3>

      {/* ICD-10 Codes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ICD-10 Codes <span className="text-danger">*</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {icd10Codes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              {code}
              <button type="button" onClick={() => removeIcdCode(code)} className="ml-2 hover:text-blue-900">
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="button" variant="secondary" onClick={addIcdCode}>
            Add
          </Button>
        </div>
        {errors.icd10Codes && <p className="mt-1 text-sm text-danger">{errors.icd10Codes.message}</p>}
      </div>

      {/* CPT Codes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          CPT Codes <span className="text-danger">*</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {cptCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
            >
              {code}
              <button type="button" onClick={() => removeCptCode(code)} className="ml-2 hover:text-green-900">
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button type="button" variant="secondary" onClick={addCptCode}>
            Add
          </Button>
        </div>
        {errors.cptCodes && <p className="mt-1 text-sm text-danger">{errors.cptCodes.message}</p>}
      </div>

      <Controller
        name="priorTreatmentHistory"
        control={control}
        render={({ field }) => (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prior Treatment History</label>
            <textarea
              {...field}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
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
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Step 3: Document Upload</h3>

      {/* Document Requirements Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
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
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-700 font-medium mb-2">Drag and drop files here</p>
        <p className="text-gray-500 text-sm mb-4">or</p>
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <span className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            Browse Files
          </span>
        </label>
      </div>

      {errors.documents && (
        <div className="flex items-center text-danger">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">{errors.documents.message}</span>
        </div>
      )}

      {/* Uploaded Files List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Uploaded Files ({documents.length})</h4>
          {documents.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 text-gray-400 hover:text-danger transition-colors"
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
