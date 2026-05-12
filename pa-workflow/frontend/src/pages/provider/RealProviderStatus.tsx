import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  ArrowLeft,
  Copy,
  Loader2,
} from 'lucide-react'
import { usePAStatus, useSubmitAppeal } from '../../hooks/usePA'
import { useNotifications } from '../../hooks/useNotifications'
import { paService } from '../../services/pa.service'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { Modal } from '../../components/common/Modal'
import { Spinner } from '../../components/common/Spinner'
import type { PAStatus as PAStatusType } from '../../types/pa.types'

const RealProviderStatus: React.FC = () => {
  const { pa_id } = useParams<{ pa_id: string }>()
  const navigate = useNavigate()
  const { showNotification } = useNotifications()
  const [showAppealModal, setShowAppealModal] = useState(false)
  const [appealReason, setAppealReason] = useState('')
  const [copied, setCopied] = useState(false)
  const [loadingStepIndex, setLoadingStepIndex] = useState(0)

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

  const handleDownloadReport = async () => {
    if (!pa_id) return

    try {
      showNotification({
        type: 'info',
        title: 'Generating Report',
        message: 'Preparing your professional summary report...',
      })

      await paService.downloadSummaryReport(pa_id)

      showNotification({
        type: 'success',
        title: 'Report Downloaded',
        message: 'Your PA summary report has been downloaded successfully.',
      })
    } catch (error) {
      console.error('Failed to download report:', error)
      showNotification({
        type: 'error',
        title: 'Download Failed',
        message: 'Failed to download the report. Please try again.',
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
          icon: Clock,
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

  const formatDateSafe = (value: string | undefined | null, pattern: string, fallback = 'N/A') => {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return format(date, pattern)
  }

  useEffect(() => {
    const ocrGeneratingStatuses = ['SUBMITTED', 'PROCESSING', 'AGENT_PROCESSING', 'SCORING', 'IN_REVIEW']
    if (!paData || !ocrGeneratingStatuses.includes(paData.status)) {
      return undefined
    }

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
  }, [paData?.status])

  const getOcrJson = () => {
    const agentA = (paData as typeof paData & { details?: any }).details?.agent_a_output
    return agentA || null
  }

  const getOcrJsonDisplay = () => {
    const ocrJson = getOcrJson()
    if (ocrJson) {
      return JSON.stringify(ocrJson, null, 2)
    }

    const agentA = (paData as typeof paData & { details?: any }).details?.agent_a_output
    const analysisSummary = agentA?.text_analysis?.summary
    if (analysisSummary) {
      return JSON.stringify({ summary: analysisSummary }, null, 2)
    }

    return null
  }

  const isOcrGenerating = () => {
    const generatingStatuses = ['SUBMITTED', 'PROCESSING', 'AGENT_PROCESSING', 'SCORING', 'IN_REVIEW']
    const hasOcrJson = !!getOcrJson()
    return !!paData && generatingStatuses.includes(paData.status) && !hasOcrJson
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
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
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
  const getSubmittedAt = () => {
    const rawValue = (paData as any).submittedAt ||
      (paData as any).createdAt ||
      (paData as any).created_at
    return rawValue
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Back Button */}
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

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
                Submitted on {formatDateSafe(getSubmittedAt(), 'MMM d, yyyy at h:mm a')}
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex items-center gap-2">
              <Button variant="ghost" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="primary" onClick={handleDownloadReport} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="hidden md:block relative">
            <div className="absolute left-0 right-0 top-1/2 h-2 bg-neutral-100 -translate-y-1/2 rounded-full" />
            <div
              className="absolute left-0 top-1/2 h-2 bg-gradient-to-r from-primary-600 via-primary-500 to-success-500 -translate-y-1/2 transition-all duration-700 rounded-full"
              style={{ width: `${(timelineSteps.filter((s) => s.completed).length / 4) * 100}%` }}
            />
            <div className="relative flex justify-between">
              {timelineSteps.map((step, index) => {
                const isLast = index === timelineSteps.length - 1
                const isCompleted = step.completed
                const isCurrent = isCompleted && !timelineSteps[index + 1]?.completed

                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div
                      className={`
                        w-12 h-12 rounded-full flex items-center justify-center 
                        transition-all duration-300 shadow-sm
                        ${isCompleted
                          ? isLast
                            ? 'bg-success-500 text-white'
                            : isCurrent
                              ? 'bg-primary-500 text-white ring-4 ring-primary-100'
                              : 'bg-primary-500 text-white'
                          : 'bg-white border-2 border-neutral-200 text-neutral-400'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-neutral-300" />
                      )}
                    </div>
                    <div className="mt-3 text-center">
                      <span
                        className={`block text-sm font-semibold ${isCompleted ? 'text-neutral-900' : 'text-neutral-400'}`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Extracted OCR JSON" className="shadow-card border border-neutral-200">
        <div className="p-8 space-y-5">
          <p className="text-[15px] leading-7 text-slate-500">
            The OCR response JSON is shown below in a large centered viewer.
          </p>

          {isOcrGenerating() ? (
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
          ) : (
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
                {getOcrJsonDisplay() || 'No OCR JSON available yet.'}
              </pre>
            </div>
          )}
        </div>
      </Card>

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
                  {formatDateSafe(paData.decision.expirationDate, 'MMM d, yyyy')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Decision Date</p>
                <p className="font-medium">
                  {formatDateSafe(paData.decision.decidedAt, 'MMM d, yyyy')}
                </p>
              </div>
              {paData.decision.effectiveDate && (
                <div>
                  <p className="text-sm text-gray-600">Effective Date</p>
                  <p className="font-medium">
                    {formatDateSafe(paData.decision.effectiveDate, 'MMM d, yyyy')}
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

            <Button variant="primary" className="w-full" onClick={handleDownloadReport}>
              <Download className="w-4 h-4 mr-2" />
              Download Summary Report
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
              <Button variant="secondary" onClick={handleDownloadReport}>
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Appeal Modal */}
      <Modal
        isOpen={showAppealModal}
        onClose={() => {
          setShowAppealModal(false)
          setAppealReason('')
        }}
        title="Submit Appeal"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Please provide your reason for appealing this decision:</p>
          <textarea
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            placeholder="Enter your appeal reason here..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={5}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowAppealModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitAppeal}
              disabled={!appealReason.trim()}
            >
              Submit Appeal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default RealProviderStatus
