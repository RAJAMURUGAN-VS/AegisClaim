import { z } from 'zod'

// PA Submission Form Schema
export const paSubmissionSchema = z.object({
  patientName: z.string().min(2, 'Patient name is required'),
  patientDOB: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  memberId: z.string().min(1, 'Member ID is required'),
  insurancePlan: z.string().min(1, 'Insurance plan is required'),
  providerNPI: z.string().regex(/^\d{10}$/, 'NPI must be 10 digits'),
  providerName: z.string().min(2, 'Provider name is required'),
  providerPhone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  providerFax: z.string().optional(),
  serviceType: z.enum(['MEDICAL', 'SURGICAL', 'PHARMACY', 'DME', 'IMAGING', 'LAB', 'BEHAVIORAL_HEALTH', 'OTHER']),
  procedureCodes: z.array(z.string()).min(1, 'At least one procedure code is required'),
  diagnosisCodes: z.array(z.string()).min(1, 'At least one diagnosis code is required'),
  clinicalHistory: z.string().min(10, 'Clinical history must be at least 10 characters'),
  previousTreatments: z.string().min(1, 'Previous treatments are required'),
  symptoms: z.string().min(1, 'Symptoms are required'),
  durationOfSymptoms: z.string().min(1, 'Duration of symptoms is required'),
  urgencyLevel: z.enum(['ROUTINE', 'URGENT', 'EXPEDITED']),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
})

export type PASubmissionSchema = z.infer<typeof paSubmissionSchema>

// Decision Form Schema
export const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'DENIED', 'PENDED']),
  reason: z.string().min(10, 'Decision reason must be at least 10 characters'),
  clinicalNotes: z.string().optional(),
  authorizedQuantity: z.number().optional(),
  authorizedUnits: z.string().optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  denialReasonCode: z.string().optional(),
})

export type DecisionSchema = z.infer<typeof decisionSchema>

// Login Schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginSchema = z.infer<typeof loginSchema>

// Helper validators
export const validateNPI = (npi: string): boolean => {
  // NPI validation (10 digits)
  return /^\d{10}$/.test(npi)
}

export const validatePhone = (phone: string): boolean => {
  // US phone validation (10 digits, optional country code)
  return /^1?\d{10}$/.test(phone.replace(/\D/g, ''))
}

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const validateDate = (date: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(date)) return false
  const d = new Date(date)
  return d instanceof Date && !isNaN(d.getTime())
}

export const validateCPTCode = (code: string): boolean => {
  // CPT code validation (5 digits)
  return /^\d{5}$/.test(code)
}

export const validateICDCode = (code: string): boolean => {
  // ICD-10 code validation (various formats)
  return /^[A-Z]\d{2}(\.\d{1,2})?$/.test(code)
}
