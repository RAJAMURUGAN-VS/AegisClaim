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

// REAL PROVIDER MODE - Normal multi-step workflow (no direct document upload)
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const RealProviderSubmissionForm: React.FC = () => {
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

  const { data: payers = [] } = usePayers()
  const payerId = watch('payerId')
  const { data: plans = [] } = usePlansByPayer(payerId)
  const icd10Codes = watch('icd10Codes')
  const cptCodes = watch('cptCodes')
  const documents = watch('documents')

  const submitPA = useSubmitPA()

  const handleAddIcd10 = useCallback(() => {
    if (icdInput.trim()) {
      const currentCodes = icd10Codes || []
      setValue('icd10Codes', [...currentCodes, icdInput.trim().toUpperCase()])
      setIcdInput('')
    }
  }, [icdInput, icd10Codes, setValue])

  const handleAddCpt = useCallback(() => {
    if (cptInput.trim()) {
      const currentCodes = cptCodes || []
      setValue('cptCodes', [...currentCodes, cptInput.trim().toUpperCase()])
      setCptInput('')
    }
  }, [cptInput, cptCodes, setValue])

  const handleRemoveIcd10 = useCallback((index: number) => {
    setValue(
      'icd10Codes',
      (icd10Codes || []).filter((_, i) => i !== index)
    )
  }, [icd10Codes, setValue])

  const handleRemoveCpt = useCallback((index: number) => {
    setValue(
      'cptCodes',
      (cptCodes || []).filter((_, i) => i !== index)
    )
  }, [cptCodes, setValue])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      handleFileSelect(droppedFiles)
    },
    []
  )

  const handleFileSelect = useCallback(
    (selectedFiles: File[]) => {
      const validFiles = selectedFiles.filter(
        (file) => ACCEPTED_FILE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE
      )

      if (validFiles.length === 0) {
        showNotification({
          type: 'error',
          title: 'Invalid Files',
          message: `Only PDF, JPEG, PNG, and TIFF files under 10MB are accepted.`,
        })
        return
      }

      const currentDocs = documents || []
      setValue('documents', [...currentDocs, ...validFiles])
    },
    [documents, setValue, showNotification]
  )

  const handleRemoveDocument = useCallback(
    (index: number) => {
      setValue(
        'documents',
        (documents || []).filter((_, i) => i !== index)
      )
    },
    [documents, setValue]
  )

  const onSubmit = async (data: FormData) => {
    try {
      const formData = new FormData()
      formData.append('patient_member_id', data.patientMemberId)
      formData.append('payer_id', data.payerId)
      formData.append('plan_id', data.planId)
      formData.append('provider_npi', data.providerNpi)
      formData.append('date_of_service', data.dateOfService)
      formData.append('icd10_codes', JSON.stringify(data.icd10Codes))
      formData.append('cpt_codes', JSON.stringify(data.cptCodes))
      if (data.priorTreatmentHistory) {
        formData.append('prior_treatment_history', data.priorTreatmentHistory)
      }
      if (data.medicationName) {
        formData.append('medication_name', data.medicationName)
      }
      if (data.medicationDosage) {
        formData.append('medication_dosage', data.medicationDosage)
      }

      data.documents?.forEach((doc) => {
        formData.append('documents', doc)
      })

      const result = await submitPA.mutateAsync(formData)

      showNotification({
        type: 'success',
        title: 'PA Submitted',
        message: 'Your prior authorization has been submitted successfully.',
      })

      navigate(`/real-provider/status/${result.id}`)
    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Submission Failed',
        message: 'Failed to submit PA. Please try again.',
      })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit Prior Authorization</h1>
        <p className="text-gray-600">Complete the form below to request prior authorization</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 flex gap-4">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${currentStep >= step
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-600'
                }`}
            >
              {step}
            </div>
            {step < 3 && (
              <div
                className={`w-12 h-1 mx-2 transition-colors ${currentStep > step ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Patient & Provider Info */}
        {currentStep === 1 && (
          <Card>
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Patient & Provider Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="patientMemberId"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Patient Member ID"
                      placeholder="e.g., MEM123456"
                      error={errors.patientMemberId?.message}
                    />
                  )}
                />

                <Controller
                  name="providerNpi"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Provider NPI"
                      placeholder="1234567890"
                      error={errors.providerNpi?.message}
                    />
                  )}
                />

                <Controller
                  name="payerId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Payer"
                      options={payers.map((p: any) => ({ label: p.name, value: p.id }))}
                      error={errors.payerId?.message}
                    />
                  )}
                />

                <Controller
                  name="planId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Plan"
                      options={plans.map((p: any) => ({ label: p.name, value: p.id }))}
                      error={errors.planId?.message}
                      disabled={!payerId}
                    />
                  )}
                />

                <Controller
                  name="dateOfService"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="date"
                      label="Date of Service"
                      error={errors.dateOfService?.message}
                    />
                  )}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="primary" onClick={() => setCurrentStep(2)}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Medical Codes */}
        {currentStep === 2 && (
          <Card>
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Medical Information</h2>

              {/* ICD-10 Codes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">ICD-10 Codes</label>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={icdInput}
                    onChange={(e) => setIcdInput(e.target.value)}
                    placeholder="e.g., E11.9"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddIcd10()
                      }
                    }}
                  />
                  <Button variant="secondary" onClick={handleAddIcd10} type="button">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {icd10Codes?.map((code, idx) => (
                    <div key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {code}
                      <button
                        type="button"
                        onClick={() => handleRemoveIcd10(idx)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {errors.icd10Codes && (
                  <p className="text-red-600 text-sm mt-1">{errors.icd10Codes.message}</p>
                )}
              </div>

              {/* CPT Codes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">CPT Codes</label>
                <div className="flex gap-2 mb-3">
                  <Input
                    value={cptInput}
                    onChange={(e) => setCptInput(e.target.value)}
                    placeholder="e.g., 99213"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCpt()
                      }
                    }}
                  />
                  <Button variant="secondary" onClick={handleAddCpt} type="button">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cptCodes?.map((code, idx) => (
                    <div key={idx} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {code}
                      <button
                        type="button"
                        onClick={() => handleRemoveCpt(idx)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {errors.cptCodes && (
                  <p className="text-red-600 text-sm mt-1">{errors.cptCodes.message}</p>
                )}
              </div>

              {/* Additional Medical Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="priorTreatmentHistory"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Prior Treatment History (Optional)"
                      placeholder="Previous treatments..."
                    />
                  )}
                />

                <Controller
                  name="medicationName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Medication Name (Optional)"
                      placeholder="e.g., Lisinopril"
                    />
                  )}
                />
              </div>

              <Controller
                name="medicationDosage"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Medication Dosage (Optional)"
                    placeholder="e.g., 10mg daily"
                  />
                )}
              />

              <div className="flex justify-between gap-3 pt-4">
                <Button variant="secondary" onClick={() => setCurrentStep(1)} type="button">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button variant="primary" onClick={() => setCurrentStep(3)}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Document Upload */}
        {currentStep === 3 && (
          <Card>
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Upload Documents</h2>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-900 font-semibold mb-1">Drag and drop your files</p>
                <p className="text-gray-500 text-sm mb-3">or</p>
                <label className="inline-block">
                  <Button variant="primary" as="span">
                    Browse Files
                  </Button>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_FILE_TYPES.join(',')}
                    onChange={(e) => handleFileSelect(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                </label>
                <p className="text-gray-500 text-xs mt-3">
                  PDF, JPEG, PNG, TIFF • Max 10MB each
                </p>
              </div>

              {documents && documents.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">Uploaded Documents</h3>
                  {documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">{(doc.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(idx)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {errors.documents && (
                <p className="text-red-600 text-sm">{errors.documents.message}</p>
              )}

              <div className="flex justify-between gap-3 pt-4">
                <Button variant="secondary" onClick={() => setCurrentStep(2)} type="button">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSubmitting || !documents || documents.length === 0}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Submit PA
                </Button>
              </div>
            </div>
          </Card>
        )}
      </form>
    </div>
  )
}

export default RealProviderSubmissionForm
