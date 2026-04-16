import React, { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, FileText } from 'lucide-react'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import api from '../../services/api'

export interface DecisionData {
  decision: 'APPROVED' | 'DENIED' | 'PENDED'
  reason: string
  clinicalNotes?: string
  denialReasonCode?: string
  conditions?: string[]
}

interface DecisionPanelProps {
  paId: string
  patientName: string
  onDecisionSubmitted?: () => void
}

const DENIAL_REASON_CODES = [
  { code: 'NOT_MEDICALLY_NECESSARY', label: 'Not Medically Necessary' },
  { code: 'EXPERIMENTAL_INVESTIGATIONAL', label: 'Experimental/Investigational' },
  { code: 'OUT_OF_NETWORK', label: 'Out of Network' },
  { code: 'PRIOR_AUTH_REQUIRED', label: 'Prior Authorization Required' },
  { code: 'SERVICE_NOT_COVERED', label: 'Service Not Covered' },
  { code: 'INSUFFICIENT_DOCUMENTATION', label: 'Insufficient Documentation' },
  { code: 'ALTERNATIVE_TREATMENT_AVAILABLE', label: 'Alternative Treatment Available' },
  { code: 'FREQUENCY_LIMITATION', label: 'Frequency Limitation Exceeded' },
  { code: 'OTHER', label: 'Other' },
]

const DecisionPanel: React.FC<DecisionPanelProps> = ({
  paId,
  patientName,
  onDecisionSubmitted,
}) => {
  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showDenyModal, setShowDenyModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<DecisionData | null>(null)

  // Form states
  const [conditions, setConditions] = useState('')
  const [denialReasonCode, setDenialReasonCode] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [requestMoreInfo, setRequestMoreInfo] = useState(false)
  const [infoRequestNotes, setInfoRequestNotes] = useState('')

  // Loading state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle approve button click
  const handleApproveClick = () => {
    setConditions('')
    setClinicalNotes('')
    setShowApproveModal(true)
  }

  // Handle deny button click
  const handleDenyClick = () => {
    setDenialReasonCode('')
    setOverrideReason('')
    setClinicalNotes('')
    setShowDenyModal(true)
  }

  // Handle request more info click
  const handleRequestMoreInfoClick = () => {
    setRequestMoreInfo(true)
    setInfoRequestNotes('')
  }

  // Validate and prepare approve decision
  const prepareApproveDecision = () => {
    const decisionData: DecisionData = {
      decision: 'APPROVED',
      reason: 'Approved by adjudicator',
      clinicalNotes: clinicalNotes || undefined,
      conditions: conditions ? [conditions] : undefined,
    }

    setPendingDecision(decisionData)
    setShowApproveModal(false)
    setShowConfirmModal(true)
  }

  // Validate and prepare deny decision
  const prepareDenyDecision = () => {
    if (!denialReasonCode) {
      setError('Please select a denial reason code')
      return
    }

    if (!overrideReason.trim()) {
      setError('Override reason is required for audit purposes')
      return
    }

    const reasonCode = DENIAL_REASON_CODES.find(
      (r) => r.code === denialReasonCode
    )

    const decisionData: DecisionData = {
      decision: 'DENIED',
      reason: `${reasonCode?.label || denialReasonCode}. Override: ${overrideReason}`,
      clinicalNotes: clinicalNotes || undefined,
      denialReasonCode,
    }

    setPendingDecision(decisionData)
    setShowDenyModal(false)
    setShowConfirmModal(true)
  }

  // Submit final decision
  const submitDecision = async () => {
    if (!pendingDecision) return

    try {
      setSubmitting(true)
      setError(null)

      await api.post(`/api/v1/pa/${paId}/decision`, pendingDecision)

      setShowConfirmModal(false)
      setPendingDecision(null)

      // Call callback if provided
      onDecisionSubmitted?.()
    } catch (err) {
      console.error('Failed to submit decision:', err)
      setError('Failed to submit decision. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Submit request for more info
  const submitInfoRequest = async () => {
    if (!infoRequestNotes.trim()) {
      setError('Please provide details about what information is needed')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      await api.post(`/api/v1/pa/${paId}/request-info`, {
        notes: infoRequestNotes,
      })

      setRequestMoreInfo(false)
      setInfoRequestNotes('')

      // Call callback if provided
      onDecisionSubmitted?.()
    } catch (err) {
      console.error('Failed to request info:', err)
      setError('Failed to submit information request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel all modals
  const handleCancel = () => {
    setShowApproveModal(false)
    setShowDenyModal(false)
    setShowConfirmModal(false)
    setRequestMoreInfo(false)
    setPendingDecision(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Main Decision Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="secondary"
          size="lg"
          icon={CheckCircle}
          onClick={handleApproveClick}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          APPROVE
        </Button>
        <Button
          variant="danger"
          size="lg"
          icon={XCircle}
          onClick={handleDenyClick}
        >
          DENY
        </Button>
      </div>

      {/* Request More Info Link */}
      <div className="text-center">
        <button
          onClick={handleRequestMoreInfoClick}
          className="text-sm text-secondary hover:text-secondary-light underline flex items-center justify-center gap-1 mx-auto"
        >
          <Info className="w-4 h-4" />
          Request More Information
        </button>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={handleCancel}
        title="Approve Prior Authorization"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              icon={CheckCircle}
              onClick={prepareApproveDecision}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You are about to approve the prior authorization request for{' '}
            <strong>{patientName}</strong>.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conditions (Optional)
            </label>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="Enter any conditions or limitations..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Specify any conditions, limitations, or notes for this approval.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clinical Notes (Optional)
            </label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Enter clinical notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </Modal>

      {/* Deny Modal */}
      <Modal
        isOpen={showDenyModal}
        onClose={handleCancel}
        title="Deny Prior Authorization"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={prepareDenyDecision}
            >
              Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You are about to deny the prior authorization request for{' '}
            <strong>{patientName}</strong>.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Denial Reason Code <span className="text-red-500">*</span>
            </label>
            <select
              value={denialReasonCode}
              onChange={(e) => {
                setDenialReasonCode(e.target.value)
                setError(null)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Select a reason...</option>
              {DENIAL_REASON_CODES.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Override Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value)
                setError(null)
              }}
              placeholder="Explain the reason for this denial decision..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be logged to the audit trail.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clinical Notes (Optional)
            </label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Enter clinical notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </Modal>

      {/* Request More Info Modal */}
      <Modal
        isOpen={requestMoreInfo}
        onClose={handleCancel}
        title="Request Additional Information"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={FileText}
              onClick={submitInfoRequest}
              loading={submitting}
            >
              Submit Request
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Request additional information for the prior authorization request
            for <strong>{patientName}</strong>.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Information Needed <span className="text-red-500">*</span>
            </label>
            <textarea
              value={infoRequestNotes}
              onChange={(e) => {
                setInfoRequestNotes(e.target.value)
                setError(null)
              }}
              placeholder="Describe what additional information or documentation is needed..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={handleCancel}
        title="Confirm Decision"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant={
                pendingDecision?.decision === 'APPROVED' ? 'secondary' : 'danger'
              }
              onClick={submitDecision}
              loading={submitting}
              className={
                pendingDecision?.decision === 'APPROVED'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : ''
              }
            >
              Submit Decision
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-medium">This action cannot be undone.</span>
          </div>

          <p className="text-sm text-gray-600">
            You are about to{' '}
            <strong
              className={
                pendingDecision?.decision === 'APPROVED'
                  ? 'text-green-600'
                  : 'text-red-600'
              }
            >
              {pendingDecision?.decision === 'APPROVED' ? 'APPROVE' : 'DENY'}
            </strong>{' '}
            the prior authorization request for <strong>{patientName}</strong>.
          </p>

          {pendingDecision?.conditions && (
            <div className="text-sm">
              <span className="font-medium text-gray-700">Conditions: </span>
              <span className="text-gray-600">{pendingDecision.conditions.join(', ')}</span>
            </div>
          )}

          {pendingDecision?.denialReasonCode && (
            <div className="text-sm">
              <span className="font-medium text-gray-700">Reason: </span>
              <span className="text-gray-600">
                {
                  DENIAL_REASON_CODES.find(
                    (r) => r.code === pendingDecision.denialReasonCode
                  )?.label
                }
              </span>
            </div>
          )}

          <p className="text-xs text-gray-500">
            This decision will be logged to the audit trail and cannot be reversed.
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default DecisionPanel
