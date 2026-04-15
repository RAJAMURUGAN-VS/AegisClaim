import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronRight, ChevronLeft, Upload, X, FileText, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useSubmitPA } from '../../hooks/usePA'
import { useNotifications } from '../../hooks/useNotifications'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'

// Types
interface Payer {
  id: string
  name: string
  code: string
}

interface Plan {
  id: string
  name: string
  payerId: string
}


// Validation schemas for each step
const step1Schema = z.object({
  patient_member_id: z.string().min(8, 'Member ID must be at least 8 characters').max(20, 'Member ID must be at most 20 characters'),
  payer_id: z.string().min(1, 'Please select a payer'),
  plan_id: z.string().min(1, 'Please select a plan'),
  provider_npi: z.string().regex(/^\d{10}$/, 'NPI must be exactly 10 digits'),
  date_of_service: z.string().refine((date) => {
    const selected = new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return selected <= today
  }, 'Date of service cannot be in the future'),
})

const step2Schema = z.object({
  icd10_codes: z.array(z.string()).min(1, 'At least one ICD-10 code is required'),
  cpt_codes: z.array(z.string()).min(1, 'At least one CPT code is required'),
  prior_treatment_history: z.string().optional(),
  medication_name: z.string().optional(),
  medication_dosage: z.string().optional(),
})

const step3Schema = z.object({
  documents: z.array(z.instanceof(File)).min(1, 'At least one document is required'),
})

const formSchema = step1Schema.merge(step2Schema).merge(step3Schema)

type FormData = z.infer<typeof formSchema>

// Mock payers data - in real app, fetch from API
const mockPayers: Payer[] = [
  { id: '1', name: 'Blue Cross Blue Shield', code: 'BCBS' },
  { id: '2', name: 'UnitedHealthcare', code: 'UHC' },
  { id: '3', name: 'Aetna', code: 'AET' },
  { id: '4', name: 'Cigna', code: 'CIG' },
]

// Mock plans data - in real app, fetch from API based on payer
const mockPlans: Record<string, Plan[]> = {
  '1': [
    { id: '101', name: 'Blue Advantage', payerId: '1' },
    { id: '102', name: 'Blue Select', payerId: '1' },
  ],
  '2': [
    { id: '201', name: 'Choice Plus', payerId: '2' },
    { id: '202', name: 'Navigate', payerId: '2' },
  ],
  '3': [
    { id: '301', name: 'Choice', payerId: '3' },
    { id: '302', name: 'Managed Choice', payerId: '3' },
  ],
  '4': [
    { id: '401', name: 'Open Access', payerId: '4' },
    { id: '402', name: 'Connect', payerId: '4' },
  ],
}

const PASubmissionForm: React.FC = () => {
  const navigate = useNavigate()
  const { showNotification } = useNotifications()
  const [currentStep, setCurrentStep] = useState(1)
  const [tagInputs, setTagInputs] = useState({ icd10: '', cpt: '' })
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      icd10_codes: [],
      cpt_codes: [],
      documents: [],
    },
    mode: 'onBlur',
  })

  const watchedPayerId = watch('payer_id')
  const watchedIcd10Codes = watch('icd10_codes') || []
  const watchedCptCodes = watch('cpt_codes') || []

  const submitPAMutation = useSubmitPA()

  // Fetch plans when payer changes
  const availablePlans = watchedPayerId ? mockPlans[watchedPayerId] || [] : []

  const handleNext = async () => {
    let isValid = false

    if (currentStep === 1) {
      isValid = await trigger(['patient_member_id', 'payer_id', 'plan_id', 'provider_npi', 'date_of_service'])
    } else if (currentStep === 2) {
      isValid = await trigger(['icd10_codes', 'cpt_codes'])
    }

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 3))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const addTag = (field: 'icd10_codes' | 'cpt_codes', value: string) => {
    const trimmed = value.trim().toUpperCase()
    if (!trimmed) return

    const current = field === 'icd10_codes' ? watchedIcd10Codes : watchedCptCodes
    if (!current.includes(trimmed)) {
      setValue(field, [...current, trimmed], { shouldValidate: true })
    }
    setTagInputs((prev) => ({ ...prev, [field === 'icd10_codes' ? 'icd10' : 'cpt']: '' }))
  }

  const removeTag = (field: 'icd10_codes' | 'cpt_codes', tag: string) => {
    const current = field === 'icd10_codes' ? watchedIcd10Codes : watchedCptCodes
    setValue(
      field,
      current.filter((t) => t !== tag),
      { shouldValidate: true }
    )
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter((file) => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff']
      const isValidType = validTypes.includes(file.type)
      const isValidSize = file.size <= 10 * 1024 * 1024 // 10MB
      return isValidType && isValidSize
    })

    if (files.length > 0) {
      const newFiles = [...uploadedFiles, ...files]
      setUploadedFiles(newFiles)
      setValue('documents', newFiles, { shouldValidate: true })
    }
  }, [uploadedFiles, setValue])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) => file.size <= 10 * 1024 * 1024)
    if (files.length > 0) {
      const newFiles = [...uploadedFiles, ...files]
      setUploadedFiles(newFiles)
      setValue('documents', newFiles, { shouldValidate: true })
    }
  }

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    setValue('documents', newFiles, { shouldValidate: true })
  }

  const onSubmit = async (data: FormData) => {
    try {
      // Transform form data to PASubmissionFormData
      const submissionData = {
        patientName: '', // Will be fetched from member lookup
        patientDOB: '',
        memberId: data.patient_member_id,
        insurancePlan: data.plan_id,
        providerNPI: data.provider_npi,
        providerName: '', // From user profile
        providerPhone: '',
        serviceType: 'MEDICAL' as const,
        procedureCodes: data.cpt_codes,
        diagnosisCodes: data.icd10_codes,
        clinicalHistory: data.prior_treatment_history || '',
        previousTreatments: '',
        symptoms: '',
        durationOfSymptoms: '',
        urgencyLevel: 'ROUTINE' as const,
        requestedDate: data.date_of_service,
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
        message: 'There was an error submitting your PA request. Please try again.',
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
              step <= currentStep
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
        <span className={currentStep >= 3 ? 'text-primary font-medium' : 'text-gray-500'}>
          Documents
        </span>
      </div>
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Step 1: Patient & Insurance Details</h3>

      <Input
        label="Patient Member ID"
        {...register('patient_member_id')}
        error={errors.patient_member_id?.message}
        placeholder="Enter member ID (8-20 characters)"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Insurance Payer <span className="text-danger">*</span>
        </label>
        <select
          {...register('payer_id')}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
            errors.payer_id ? 'border-danger' : 'border-gray-300'
          }`}
        >
          <option value="">Select a payer</option>
          {mockPayers.map((payer) => (
            <option key={payer.id} value={payer.id}>
              {payer.name}
            </option>
          ))}
        </select>
        {errors.payer_id && <p className="mt-1 text-sm text-danger">{errors.payer_id.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Insurance Plan <span className="text-danger">*</span>
        </label>
        <select
          {...register('plan_id')}
          disabled={!watchedPayerId}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
            errors.plan_id ? 'border-danger' : 'border-gray-300'
          } ${!watchedPayerId ? 'bg-gray-100' : ''}`}
        >
          <option value="">{watchedPayerId ? 'Select a plan' : 'Select payer first'}</option>
          {availablePlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
        {errors.plan_id && <p className="mt-1 text-sm text-danger">{errors.plan_id.message}</p>}
      </div>

      <Input
        label="Provider NPI"
        {...register('provider_npi')}
        error={errors.provider_npi?.message}
        placeholder="10-digit NPI number"
        maxLength={10}
      />

      <Input
        label="Date of Service"
        type="date"
        {...register('date_of_service')}
        error={errors.date_of_service?.message}
        max={new Date().toISOString().split('T')[0]}
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
          {watchedIcd10Codes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              {code}
              <button
                type="button"
                onClick={() => removeTag('icd10_codes', code)}
                className="ml-2 hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInputs.icd10}
            onChange={(e) => setTagInputs((prev) => ({ ...prev, icd10: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag('icd10_codes', tagInputs.icd10)
              }
            }}
            placeholder="Type code and press Enter"
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => addTag('icd10_codes', tagInputs.icd10)}
          >
            Add
          </Button>
        </div>
        {errors.icd10_codes && <p className="mt-1 text-sm text-danger">{errors.icd10_codes.message}</p>}
      </div>

      {/* CPT Codes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          CPT Codes <span className="text-danger">*</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {watchedCptCodes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
            >
              {code}
              <button
                type="button"
                onClick={() => removeTag('cpt_codes', code)}
                className="ml-2 hover:text-green-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInputs.cpt}
            onChange={(e) => setTagInputs((prev) => ({ ...prev, cpt: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag('cpt_codes', tagInputs.cpt)
              }
            }}
            placeholder="Type code and press Enter"
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => addTag('cpt_codes', tagInputs.cpt)}
          >
            Add
          </Button>
        </div>
        {errors.cpt_codes && <p className="mt-1 text-sm text-danger">{errors.cpt_codes.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prior Treatment History
        </label>
        <textarea
          {...register('prior_treatment_history')}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Describe any prior treatments..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Medication Name"
          {...register('medication_name')}
          placeholder="e.g., Humira"
        />
        <Input
          label="Medication Dosage"
          {...register('medication_dosage')}
          placeholder="e.g., 40mg every 2 weeks"
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
              <p className="text-blue-600">
                Accepted formats: PDF, JPEG, PNG, TIFF. Max size: 10MB per file.
              </p>
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
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-700 font-medium mb-2">Drag and drop files here</p>
        <p className="text-gray-500 text-sm mb-4">or</p>
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff"
            onChange={handleFileSelect}
            className="hidden"
          />
          <span className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            Browse Files
          </span>
        </label>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Uploaded Files ({uploadedFiles.length})</h4>
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
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

      {errors.documents && (
        <div className="flex items-center text-danger">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">{errors.documents.message}</span>
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={handleBack}
          disabled={isSubmitting}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting || submitPAMutation.isPending}
        >
          Submit PA Request
        </Button>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <Card
        title="Prior Authorization Request"
        subtitle="Submit a new PA request for your patient"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {renderStepIndicator()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          {/* Navigation Buttons */}
          {currentStep < 3 && (
            <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                onClick={handleNext}
                icon={ChevronRight}
              >
                Next Step
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}

export default PASubmissionForm
