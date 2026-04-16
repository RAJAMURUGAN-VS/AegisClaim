import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  Shield,
  User,
  Loader2,
} from 'lucide-react'
import { usePAStatus, useSubmitAppeal } from '../../hooks/usePA'
import { useNotifications } from '../../hooks/useNotifications'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { Modal } from '../../components/common/Modal'
import { Spinner } from '../../components/common/Spinner'
import type { PAStatus as PAStatusType, AgentOutput } from '../../types/pa.types'

const PAStatus: React.FC = () => {
  const { pa_id } = useParams<{ pa_id: string }>()
  const { showNotification } = useNotifications()
  const [showAgentPanel, setShowAgentPanel] = useState(true)
  const [showAppealModal, setShowAppealModal] = useState(false)
  const [appealReason, setAppealReason] = useState('')
  const [copied, setCopied] = useState(false)

  const { data: paData, isLoading, error, refetch } = usePAStatus(pa_id)
  const submitAppeal = useSubmitAppeal()

  const handleCopyAuthCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showNotification({
      type: 'success',
      title: 'Copied',
      message: 'Authorization code copied to clipboard',
    })
  }

  const handleSubmitAppeal = async () => {
    if (!pa_id || !appealReason.trim()) return

    try {
      await submitAppeal.mutateAsync({ paId: pa_id, reason: appealReason })
      showNotification({
        type: 'success',
        title: 'Appeal Submitted',
        message: 'Your appeal has been submitted successfully.',
      })
      setShowAppealModal(false)
      setAppealReason('')
      refetch()
    } catch (err) {
      showNotification({
        type: 'error',
        title: 'Appeal Failed',
        message: 'There was an error submitting your appeal. Please try again.',
      })
    }
  }

  const getStatusConfig = (status: PAStatusType) => {
    switch (status) {
      case 'APPROVED':
        return {
          badge: 'APPROVED' as const,
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        }
      case 'DENIED':
        return {
          badge: 'DENIED' as const,
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        }
      case 'IN_REVIEW':
      case 'ESCALATED':
        return {
          badge: 'REVIEW' as const,
          icon: User,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
        }
      case 'SUBMITTED':
      case 'AGENT_PROCESSING':
      case 'PENDING_INFO':
        return {
          badge: 'PROCESSING' as const,
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        }
      default:
        return {
          badge: 'PENDING' as const,
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        }
    }
  }

  const getTimelineSteps = (status: PAStatusType) => {
    const processingStatuses: PAStatusType[] = ['AGENT_PROCESSING', 'IN_REVIEW', 'ESCALATED', 'APPROVED', 'DENIED']
    const decisionStatuses: PAStatusType[] = ['APPROVED', 'DENIED']

    return [
      { id: 'submitted', label: 'Submitted', completed: true },
      { id: 'processing', label: 'Processing', completed: processingStatuses.includes(status) },
      { id: 'decision', label: 'Decision', completed: decisionStatuses.includes(status) },
      { id: 'notified', label: 'Notified', completed: decisionStatuses.includes(status) },
    ]
  }

  // Agent status helpers
  const getAgentStatusIcon = (agent: AgentOutput) => {
    switch (agent.status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'PROCESSING':
      case 'PENDING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getAgentStatusColor = (agent: AgentOutput) => {
    switch (agent.status) {
      case 'COMPLETED':
        return 'bg-green-100'
      case 'PROCESSING':
      case 'PENDING':
        return 'bg-blue-100'
      case 'FAILED':
        return 'bg-red-100'
      default:
        return 'bg-gray-100'
    }
  }

  const getAgentStatusText = (agent: AgentOutput) => {
    switch (agent.status) {
      case 'COMPLETED':
        return 'Complete'
      case 'PROCESSING':
        return 'Processing...'
      case 'PENDING':
        return 'Pending'
      case 'FAILED':
        return 'Failed'
      default:
        return agent.status
    }
  }

  const getAgentStatusTextColor = (agent: AgentOutput) => {
    switch (agent.status) {
      case 'COMPLETED':
        return 'text-green-600'
      case 'PROCESSING':
      case 'PENDING':
        return 'text-blue-600'
      case 'FAILED':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !paData) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading PA</h3>
            <p className="text-gray-500 mb-4">Unable to load the prior authorization details.</p>
            <Button onClick={() => refetch()} variant="primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const statusConfig = getStatusConfig(paData.status)
  const timelineSteps = getTimelineSteps(paData.status)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Status Card */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">PA Request #{paData.id}</h1>
                <Badge status={statusConfig.badge}>{paData.status.replace('_', ' ')}</Badge>
              </div>
              <p className="text-gray-500">
                Submitted on {format(new Date(paData.submittedAt), 'MMM d, yyyy at h:mm a')}
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex items-center gap-2">
              <Button variant="ghost" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="relative">
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-200 -translate-y-1/2" />
            <div
              className="absolute left-0 top-1/2 h-1 bg-primary -translate-y-1/2 transition-all duration-500"
              style={{ width: `${(timelineSteps.filter((s) => s.completed).length / 4) * 100}%` }}
            />
            <div className="relative flex justify-between">
              {timelineSteps.map((step) => (
                <div key={step.id} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                      step.completed
                        ? 'bg-primary border-primary text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-sm font-medium ${
                      step.completed ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Status Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Approved State */}
          {paData.status === 'APPROVED' && paData.decision && (
            <Card className="border-green-200">
              <div className={`p-6 ${statusConfig.bgColor} border-l-4 border-green-500 rounded-lg`}>
                <div className="flex items-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 mr-3" />
                  <h3 className="text-xl font-bold text-green-900">PA Approved</h3>
                </div>

                {/* Auth Code */}
                <div className="bg-white rounded-lg p-4 mb-4 border border-green-200">
                  <p className="text-sm text-gray-500 mb-1">Authorization Code</p>
                  <div className="flex items-center gap-3">
                    <code className="text-2xl font-mono font-bold text-green-700">
                      AUTH-{paData.id.slice(-8).toUpperCase()}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyAuthCode(`AUTH-${paData.id.slice(-8).toUpperCase()}`)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                {/* Valid Until */}
                {paData.decision.expirationDate && (
                  <div className="bg-white rounded-lg p-4 mb-4 border border-green-200">
                    <p className="text-sm text-gray-500 mb-1">Valid Until</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(paData.decision.expirationDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Decision Date</p>
                    <p className="font-medium">
                      {paData.decision.decidedAt
                        ? format(new Date(paData.decision.decidedAt), 'MMM d, yyyy')
                        : 'N/A'}
                    </p>
                  </div>
                  {paData.decision.effectiveDate && (
                    <div>
                      <p className="text-sm text-gray-600">Effective Date</p>
                      <p className="font-medium">
                        {format(new Date(paData.decision.effectiveDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>

                {paData.decision.conditions && paData.decision.conditions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">Conditions</p>
                    <ul className="list-disc list-inside text-sm text-gray-700">
                      {paData.decision.conditions.map((condition, idx) => (
                        <li key={idx}>{condition}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button variant="primary" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download Approval Letter
                </Button>
              </div>
            </Card>
          )}

          {/* Denied State */}
          {paData.status === 'DENIED' && paData.decision && (
            <Card className="border-red-200">
              <div className={`p-6 ${statusConfig.bgColor} border-l-4 border-red-500 rounded-lg`}>
                <div className="flex items-center mb-4">
                  <XCircle className="w-8 h-8 text-red-600 mr-3" />
                  <h3 className="text-xl font-bold text-red-900">PA Denied</h3>
                </div>

                {/* Denial Reason */}
                <div className="bg-white rounded-lg p-4 mb-4 border border-red-200">
                  <p className="text-sm text-gray-500 mb-2">Denial Reason</p>
                  <p className="font-medium text-gray-900">
                    {paData.decision.reason || 'No reason provided'}
                  </p>
                </div>

                {/* Policy Clause */}
                {paData.decision.denialReasonCode && (
                  <div className="bg-white rounded-lg p-4 mb-4 border border-red-200">
                    <p className="text-sm text-gray-500 mb-1">Policy Clause Cited</p>
                    <p className="font-mono text-sm text-gray-700">
                      {paData.decision.denialReasonCode}
                    </p>
                  </div>
                )}

                {paData.decision.denialReasonDescription && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-800 mb-2">Additional Information</p>
                    <p className="text-sm text-red-700">{paData.decision.denialReasonDescription}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="primary" onClick={() => setShowAppealModal(true)}>
                    Start Appeal
                  </Button>
                  <Button variant="secondary">Contact Support</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Human Review State */}
          {(paData.status === 'IN_REVIEW' || paData.status === 'ESCALATED') && (
            <Card className="border-orange-200">
              <div className={`p-6 ${statusConfig.bgColor} border-l-4 border-orange-500 rounded-lg`}>
                <div className="flex items-center mb-4">
                  <User className="w-8 h-8 text-orange-600 mr-3" />
                  <h3 className="text-xl font-bold text-orange-900">Under Clinical Review</h3>
                </div>

                <p className="text-orange-800 mb-4">
                  Your prior authorization request is currently being reviewed by our clinical team.
                  This process typically takes up to 24 business hours.
                </p>

                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-gray-500">Expected Response Time</p>
                      <p className="font-medium">Within 24 business hours</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Agent Processing Panel */}
          <Card>
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <Shield className="w-5 h-5 text-primary mr-3" />
                <h3 className="text-lg font-semibold">AI Agent Processing</h3>
              </div>
              {showAgentPanel ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {showAgentPanel && (
              <div className="px-6 pb-6 border-t">
                <div className="space-y-4 mt-4">
                  {/* Dynamic Agent Outputs */}
                  {paData.agentOutputs && paData.agentOutputs.length > 0 ? (
                    paData.agentOutputs.map((agent) => (
                      <div
                        key={agent.agentId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center">
                          <div
                            className={`w-8 h-8 ${getAgentStatusColor(agent)} rounded-full flex items-center justify-center mr-3`}
                          >
                            {getAgentStatusIcon(agent)}
                          </div>
                          <div>
                            <p className="font-medium">{agent.agentName}</p>
                            <p className="text-sm text-gray-500">{agent.agentType}</p>
                          </div>
                        </div>
                        <span className={`font-medium ${getAgentStatusTextColor(agent)}`}>
                          {getAgentStatusText(agent)}
                        </span>
                      </div>
                    ))
                  ) : (
                    // Default agents if no data from API
                    <>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">Document Processing</p>
                            <p className="text-sm text-gray-500">Agent A</p>
                          </div>
                        </div>
                        <span className="text-green-600 font-medium">Complete</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">Policy Compliance</p>
                            <p className="text-sm text-gray-500">Agent B</p>
                          </div>
                        </div>
                        <span className="text-green-600 font-medium">Complete</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">Fraud Check</p>
                            <p className="text-sm text-gray-500">Agent C</p>
                          </div>
                        </div>
                        <span className="text-green-600 font-medium">Complete</span>
                      </div>
                    </>
                  )}

                  {/* Confidence Score */}
                  {paData.scoringResult && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-600 mb-2">Overall Confidence Score</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${paData.scoringResult.confidence}%` }}
                          />
                        </div>
                        <span className="font-semibold text-primary">
                          {paData.scoringResult.confidence}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Patient Information */}
          <Card title="Patient Information">
            <div className="p-6 grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Patient Name</p>
                <p className="font-medium">{paData.patientName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Member ID</p>
                <p className="font-medium">{paData.memberId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Insurance Plan</p>
                <p className="font-medium">{paData.insurancePlan || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Provider NPI</p>
                <p className="font-medium">{paData.providerNPI || 'N/A'}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <Card title="Request Summary">
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Service Type</p>
                <p className="font-medium">{paData.serviceType.replace('_', ' ')}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Diagnosis Codes</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {paData.diagnosisCodes?.map((code) => (
                    <span key={code} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {code}
                    </span>
                  )) || <span className="text-gray-400">None</span>}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Procedure Codes</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {paData.procedureCodes?.map((code) => (
                    <span key={code} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      {code}
                    </span>
                  )) || <span className="text-gray-400">None</span>}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Documents</p>
                <div className="flex items-center mt-1">
                  <FileText className="w-4 h-4 text-gray-400 mr-2" />
                  <p className="font-medium">{paData.attachments?.length || 0} uploaded</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Need Help?">
            <div className="p-6 space-y-3">
              <Button variant="secondary" className="w-full">
                Contact Support
              </Button>
              <Button variant="ghost" className="w-full">
                View Guidelines
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Appeal Modal */}
      <Modal
        isOpen={showAppealModal}
        onClose={() => setShowAppealModal(false)}
        title="Submit Appeal"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAppealModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitAppeal}
              loading={submitAppeal.isPending}
              disabled={!appealReason.trim()}
            >
              Submit Appeal
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a detailed explanation for why you believe this decision should be
            reconsidered.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Appeal Reason <span className="text-danger">*</span>
            </label>
            <textarea
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Explain why you are appealing this decision..."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PAStatus
