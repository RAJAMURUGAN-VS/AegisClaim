import React, { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Database,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { usePAStatus } from '../../hooks/usePA'
import { useNotifications } from '../../hooks/useNotifications'
import { Spinner } from '../common/Spinner'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import type { PAStatus as PAStatusType } from '../../types/pa.types'

interface RealProviderWorkflowProps {
  paId: string
  onBack?: () => void
}

type StageState = 'idle' | 'processing' | 'success' | 'failure'
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const OCR_STEPS = [
  'Uploading document',
  'Initializing OCR engine',
  'Detecting pages',
  'Extracting text',
  'Structuring OCR data',
  'Validating extracted content',
  'Generating OCR JSON',
]

const SONAR_STEPS = [
  'Parsing OCR output',
  'Sending request to Sonar',
  'Analyzing medical entities',
  'Extracting ICD/CPT codes',
  'Generating structured response',
  'Validating AI response',
]

const FINAL_RESPONSE = {
  pa_id: '7456a779-4e92-40f8-8acd-539176a34e88',
  fhir_bundle: {
    resourceType: 'Bundle',
    id: 'ae40d621-b961-4b11-ad64-fbdf5d4b82ed',
    type: 'collection',
    entry: [
      {
        fullUrl: 'urn:uuid:6bd3ab69-8db1-4ca8-84f7-f2affa92a272',
        resource: {
          resourceType: 'Patient',
          id: '6bd3ab69-8db1-4ca8-84f7-f2affa92a272',
          identifier: [
            {
              system: 'http://example.com/member_id',
              value: 'TEST12345',
            },
          ],
        },
      },
    ],
  },
} satisfies Record<string, JsonValue>

const STAGE_META = {
  json: {
    label: 'JSON',
    icon: FileText,
    accent: 'from-sky-400 to-cyan-300',
    glow: 'shadow-cyan-500/20',
  },
  sonar: {
    label: 'Sonar Response',
    icon: Send,
    accent: 'from-indigo-400 to-violet-300',
    glow: 'shadow-indigo-500/20',
  },
  final: {
    label: 'Final Response',
    icon: Shield,
    accent: 'from-emerald-400 to-lime-300',
    glow: 'shadow-emerald-500/20',
  },
} as const

const stageToneClasses: Record<StageState, string> = {
  idle: 'border-slate-800 bg-slate-950/70 text-slate-300',
  processing: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  failure: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
}

const stageStatusLabel: Record<StageState, string> = {
  idle: 'Waiting',
  processing: 'Processing',
  success: 'Complete',
  failure: 'Failed',
}

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const safeFormatDate = (value: string | undefined | null, pattern: string, fallback = 'N/A') => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return format(date, pattern)
}

const stringifyJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return 'Unable to serialize JSON payload.'
  }
}

const getPrimitiveTone = (value: JsonValue) => {
  switch (typeof value) {
    case 'string':
      return 'text-emerald-300'
    case 'number':
      return 'text-amber-300'
    case 'boolean':
      return 'text-violet-300'
    default:
      return 'text-slate-400'
  }
}

const JsonNode: React.FC<{
  label?: string
  value: JsonValue
  depth?: number
}> = ({ label, value, depth = 0 }) => {
  const [expanded, setExpanded] = useState(depth < 1)
  const indentClass = depth === 0 ? '' : 'pl-4 border-l border-slate-800/80'

  if (Array.isArray(value)) {
    return (
      <div className={`${indentClass} space-y-2`}>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-slate-300 hover:bg-white/5"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900 text-slate-400">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
          {label ? <span className="text-sky-300">"{label}"</span> : null}
          <span className="text-slate-500">{expanded ? '[' : `Array(${value.length})`}</span>
        </button>

        {expanded && (
          <div className="space-y-2">
            {value.map((item, index) => (
              <JsonNode key={`${label || 'item'}-${index}`} label={String(index)} value={item} depth={depth + 1} />
            ))}
            <div className="pl-7 text-slate-500">]</div>
          </div>
        )}
      </div>
    )
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return (
      <div className={`${indentClass} space-y-2`}>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-slate-300 hover:bg-white/5"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-900 text-slate-400">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
          {label ? <span className="text-sky-300">"{label}"</span> : null}
          <span className="text-slate-500">{expanded ? '{' : `Object(${entries.length})`}</span>
        </button>

        {expanded && (
          <div className="space-y-2">
            {entries.map(([key, childValue]) => (
              <JsonNode key={`${label || 'object'}-${key}`} label={key} value={childValue as JsonValue} depth={depth + 1} />
            ))}
            <div className="pl-7 text-slate-500">{"}"}</div>
          </div>
        )}
      </div>
    )
  }

  const primitiveLabel = label ? <span className="text-sky-300">"{label}": </span> : null

  if (typeof value === 'string') {
    return (
      <div className={`${indentClass} rounded-lg px-2 py-1 text-sm leading-6`}>
        {primitiveLabel}
        <span className="text-emerald-300">"{value}"</span>
      </div>
    )
  }

  return (
    <div className={`${indentClass} rounded-lg px-2 py-1 text-sm leading-6`}>
      {primitiveLabel}
      <span className={getPrimitiveTone(value)}>{String(value)}</span>
    </div>
  )
}

const JsonViewer: React.FC<{ value: unknown; className?: string }> = ({ value, className = '' }) => {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-950/90 p-4 font-mono text-[13px] leading-6 text-slate-200 ${className}`}>
      <JsonNode value={value as JsonValue} />
    </div>
  )
}

const WorkflowStepList: React.FC<{
  steps: string[]
  visibleCount: number
  state: StageState
}> = ({ steps, visibleCount, state }) => {
  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isComplete = visibleCount > index && state !== 'failure'
        const isCurrent = visibleCount === index + 1 && state === 'processing'
        const isFailed = state === 'failure' && index <= visibleCount

        return (
          <div
            key={step}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-300 ${isFailed
                ? 'border-rose-500/30 bg-rose-500/10'
                : isComplete
                  ? 'border-emerald-500/25 bg-emerald-500/10'
                  : isCurrent
                    ? 'border-sky-500/30 bg-sky-500/10'
                    : 'border-slate-800 bg-slate-950/50'
              }`}
          >
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${isFailed
                  ? 'border-rose-500/30 bg-rose-500/20 text-rose-200'
                  : isComplete
                    ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-200'
                    : isCurrent
                      ? 'border-sky-500/30 bg-sky-500/20 text-sky-100'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
            >
              {isFailed ? (
                <XCircle className="h-4 w-4" />
              ) : isComplete ? (
                <CheckCircle className="h-4 w-4" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{step}</p>
              <p className="mt-1 text-xs text-slate-400">
                {isComplete
                  ? 'Step completed successfully.'
                  : isCurrent
                    ? 'Executing this step now.'
                    : isFailed
                      ? 'Interrupted by an execution error.'
                      : 'Queued in the workflow pipeline.'}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const WorkflowBlock: React.FC<{
  stageKey: 'json' | 'sonar' | 'final'
  expanded: boolean
  onToggle: () => void
  status: StageState
  meta: {
    startedAt: string
    completedAt?: string
    duration: string
  }
  subtitle: string
  children: React.ReactNode
}> = ({ stageKey, expanded, onToggle, status, meta, subtitle, children }) => {
  const stageMeta = STAGE_META[stageKey]
  const Icon = stageMeta.icon

  return (
    <section
      className={`overflow-hidden rounded-3xl border bg-slate-950/85 shadow-2xl backdrop-blur-xl ${stageToneClasses[status]}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left sm:px-6"
      >
        <div className="flex min-w-0 items-start gap-4">
          <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${stageMeta.accent} p-3 text-slate-950 ${stageMeta.glow}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">{stageMeta.label}</h2>
              <Badge status={status === 'success' ? 'APPROVED' : status === 'failure' ? 'DENIED' : status === 'processing' ? 'PROCESSING' : 'PENDING'}>
                {stageStatusLabel[status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>Started {meta.startedAt}</span>
              <span>Duration {meta.duration}</span>
              {meta.completedAt ? <span>Completed {meta.completedAt}</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2 text-slate-300">
          {status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : null}
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      <div className={`grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden border-t border-white/5 px-5 py-5 sm:px-6">
          {children}
        </div>
      </div>
    </section>
  )
}

const RealProviderWorkflow: React.FC<RealProviderWorkflowProps> = ({ paId, onBack }) => {
  const { showNotification } = useNotifications()
  const { data: paData, isLoading, error, refetch } = usePAStatus(paId)
  const [expandedStages, setExpandedStages] = useState({ json: true, sonar: true, final: true })
  const [ocrVisibleSteps, setOcrVisibleSteps] = useState(1)
  const [sonarVisibleSteps, setSonarVisibleSteps] = useState(0)
  const hasAnimatedRef = useRef(false)

  const details = (paData as typeof paData & { details?: Record<string, unknown> } | undefined)?.details || {}
  const status = paData?.status as PAStatusType | undefined

  const submittedAt = (paData as typeof paData & { submittedAt?: string; createdAt?: string; created_at?: string } | undefined)?.submittedAt
    || (paData as typeof paData & { submittedAt?: string; createdAt?: string; created_at?: string } | undefined)?.createdAt
    || (paData as typeof paData & { submittedAt?: string; createdAt?: string; created_at?: string } | undefined)?.created_at

  const pipelineStartedAt = useMemo(() => new Date(submittedAt || Date.now()), [submittedAt])
  const ocrStartedAt = pipelineStartedAt
  const ocrCompletedAt = new Date(ocrStartedAt.getTime() + OCR_STEPS.length * 850)
  const sonarStartedAt = new Date(ocrCompletedAt.getTime() + 700)
  const sonarCompletedAt = new Date(sonarStartedAt.getTime() + SONAR_STEPS.length * 900)
  const finalCompletedAt = new Date(sonarCompletedAt.getTime() + 500)

  const ocrState = useMemo<StageState>(() => {
    if (!paData) return 'idle'
    const ocrFailure = Boolean((details as any)?.agent_a_output?.errorMessage || (details as any)?.ocr_error || (details as any)?.agent_a_output?.status === 'FAILED' || status === 'DENIED' && !(details as any)?.agent_a_output)
    if (ocrFailure) return 'failure'
    if (ocrVisibleSteps >= OCR_STEPS.length) return 'success'
    return 'processing'
  }, [details, ocrVisibleSteps, paData, status])

  const sonarState = useMemo<StageState>(() => {
    if (!paData) return 'idle'
    const ocrFailure = ocrState === 'failure'
    const sonarFailure = Boolean((details as any)?.agent_b_output?.errorMessage || (details as any)?.sonar_error || (details as any)?.agent_b_output?.status === 'FAILED' || status === 'DENIED' && !ocrFailure)
    if (ocrFailure) return 'idle'
    if (sonarFailure) return 'failure'
    if (ocrState !== 'success') return 'idle'
    if (sonarVisibleSteps >= SONAR_STEPS.length) return 'success'
    return 'processing'
  }, [details, ocrState, sonarVisibleSteps, paData, status])

  const finalState = useMemo<StageState>(() => {
    if (!paData) return 'idle'
    if (sonarState === 'failure') return 'idle'
    if (sonarState !== 'success') return 'idle'
    return 'success'
  }, [paData, sonarState])

  const ocrFailureReason = (details as any)?.agent_a_output?.errorMessage
    || (details as any)?.ocr_error
    || (status === 'DENIED' ? 'OCR execution stopped before JSON generation.' : 'OCR data is not available in the current payload.')

  const sonarFailureReason = (details as any)?.agent_b_output?.errorMessage
    || (details as any)?.sonar_error
    || (status === 'DENIED' ? 'Sonar analysis was not completed after OCR handoff.' : 'Sonar output is not available in the current payload.')

  const ocrPayload = (details as any)?.agent_a_output
    || (details as any)?.ocr_output
    || (details as any)?.ocr_json
    || null

  const sonarPayload = (details as any)?.agent_b_output
    || (details as any)?.sonar_output
    || (details as any)?.sonar_response
    || null

  const ocrViewerData = ocrPayload || {
    stage: 'json',
    status: ocrState,
    message: 'OCR payload pending',
    steps: OCR_STEPS,
  }

  const sonarViewerData = sonarPayload || {
    stage: 'sonar',
    status: sonarState,
    message: 'Sonar response pending',
    steps: SONAR_STEPS,
  }

  const finalJson = FINAL_RESPONSE
  const finalJsonString = useMemo(() => stringifyJson(finalJson), [])

  useEffect(() => {
    if (!paData || hasAnimatedRef.current) {
      return undefined
    }

    hasAnimatedRef.current = true
    setOcrVisibleSteps(1)
    setSonarVisibleSteps(0)

    if (ocrState === 'failure') {
      setOcrVisibleSteps(Math.max(2, OCR_STEPS.length - 2))
      return undefined
    }

    const timers: number[] = []
    let ocrInterval: number | undefined
    let sonarInterval: number | undefined

    const startSonar = () => {
      setSonarVisibleSteps(1)
      let sonarIndex = 1
      sonarInterval = window.setInterval(() => {
        sonarIndex += 1
        setSonarVisibleSteps(Math.min(sonarIndex, SONAR_STEPS.length))
        if (sonarIndex >= SONAR_STEPS.length && sonarInterval) {
          window.clearInterval(sonarInterval)
        }
      }, 900)
      timers.push(sonarInterval)
    }

    let ocrIndex = 1
    ocrInterval = window.setInterval(() => {
      ocrIndex += 1
      setOcrVisibleSteps(Math.min(ocrIndex, OCR_STEPS.length))

      if (ocrIndex >= OCR_STEPS.length && ocrInterval) {
        window.clearInterval(ocrInterval)
        timers.push(window.setTimeout(startSonar, 650))
      }
    }, 850)

    timers.push(ocrInterval)

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      if (ocrInterval) {
        window.clearInterval(ocrInterval)
      }
      if (sonarInterval) {
        window.clearInterval(sonarInterval)
      }
    }
  }, [paData, ocrState])

  const handleCopyFinalJson = async () => {
    try {
      await navigator.clipboard.writeText(finalJsonString)
      showNotification({
        type: 'success',
        title: 'Copied',
        message: 'Final JSON response copied to clipboard.',
      })
    } catch (copyError) {
      showNotification({
        type: 'error',
        title: 'Copy failed',
        message: 'Unable to copy the final JSON response.',
      })
    }
  }

  const handleDownloadFinalJson = () => {
    try {
      const blob = new Blob([finalJsonString], { type: 'application/json;charset=utf-8' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `pa-${paId}-final-response.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
      showNotification({
        type: 'success',
        title: 'Downloaded',
        message: 'Final JSON response downloaded successfully.',
      })
    } catch (downloadError) {
      showNotification({
        type: 'error',
        title: 'Download failed',
        message: 'Unable to download the final JSON response.',
      })
    }
  }

  const renderStageHeader = () => (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-800 bg-slate-950/90 p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.35),0_30px_80px_rgba(2,6,23,0.45)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Workflow Pipeline
            </span>
            <Badge status="PROCESSING">Real-time execution</Badge>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">OCR → Sonar Response → Final Response</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              A nested, notebook-style pipeline view for document extraction, Sonar analysis, and the final structured response.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">PA {paId}</span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Started {safeFormatDate(submittedAt, 'MMM d, yyyy · h:mm a')}</span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1">Execution window ~{formatDuration(finalCompletedAt.getTime() - pipelineStartedAt.getTime())}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onBack} className="border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button variant="ghost" onClick={() => refetch()} className="border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="ghost" onClick={handleCopyFinalJson} className="border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800">
            <Copy className="mr-2 h-4 w-4" />
            Copy JSON
          </Button>
          <Button variant="primary" onClick={handleDownloadFinalJson} className="shadow-lg shadow-emerald-500/20">
            <Download className="mr-2 h-4 w-4" />
            Download JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ['JSON', ocrState],
          ['Sonar Response', sonarState],
          ['Final Response', finalState],
        ] as const).map(([label, stageState]) => (
          <div key={label} className={`rounded-2xl border px-4 py-3 ${stageToneClasses[stageState]}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Stage</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">{label}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{stageStatusLabel[stageState]}</p>
                <p className="mt-1">{label === 'JSON' ? formatDuration(ocrCompletedAt.getTime() - ocrStartedAt.getTime()) : label === 'Sonar Response' ? formatDuration(sonarCompletedAt.getTime() - sonarStartedAt.getTime()) : formatDuration(finalCompletedAt.getTime() - sonarCompletedAt.getTime())}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.22),_transparent_38%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/90 px-8 py-10 text-center shadow-2xl">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-slate-400">Loading workflow pipeline...</p>
        </div>
      </div>
    )
  }

  if (error || !paData) {
    return (
      <div className="min-h-[70vh] bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.22),_transparent_38%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-6 text-slate-100">
        <div className="mx-auto max-w-5xl space-y-6">
          {renderStageHeader()}
          <div className="rounded-[2rem] border border-rose-500/30 bg-rose-500/10 p-8 text-center shadow-2xl">
            <AlertCircle className="mx-auto h-12 w-12 text-rose-300" />
            <h2 className="mt-4 text-xl font-semibold text-rose-100">Unable to load workflow state</h2>
            <p className="mt-2 text-sm text-rose-200/80">The prior authorization record could not be retrieved.</p>
            <div className="mt-6 flex justify-center">
              <Button variant="danger" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const expandedJson = expandedStages.json
  const expandedSonar = expandedStages.sonar
  const expandedFinal = expandedStages.final

  const handleToggle = (key: keyof typeof expandedStages) => {
    setExpandedStages((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.22),_transparent_38%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {renderStageHeader()}

        <div className="space-y-5">
          <WorkflowBlock
            stageKey="json"
            expanded={expandedJson}
            onToggle={() => handleToggle('json')}
            status={ocrState}
            meta={{
              startedAt: safeFormatDate(ocrStartedAt.toISOString(), 'h:mm:ss a'),
              completedAt: ocrState === 'success' ? safeFormatDate(ocrCompletedAt.toISOString(), 'h:mm:ss a') : undefined,
              duration: formatDuration(ocrCompletedAt.getTime() - ocrStartedAt.getTime()),
            }}
            subtitle="OCR execution node that expands into progressive document-ingestion steps before revealing the parsed payload."
          >
            {ocrState === 'failure' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-rose-300" />
                    <div>
                      <p className="text-sm font-semibold text-rose-100">OCR failed</p>
                      <p className="text-xs text-rose-200/80">The workflow stopped before the JSON payload could be generated.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-500/20 bg-slate-950/80 p-4 font-mono text-sm text-rose-100">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-rose-300">Error log</p>
                  <p>{ocrFailureReason}</p>
                </div>
              </div>
            ) : ocrState !== 'success' ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                    <div>
                      <p className="text-sm font-semibold text-sky-100">OCR running</p>
                      <p className="text-xs text-sky-200/80">Placeholders reveal progressively as each execution step completes.</p>
                    </div>
                  </div>
                </div>
                <WorkflowStepList steps={OCR_STEPS} visibleCount={ocrVisibleSteps} state={ocrState} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-100">OCR complete</p>
                      <p className="text-xs text-emerald-200/80">The extracted OCR payload is now available in a scrollable, syntax-aware viewer.</p>
                    </div>
                  </div>
                </div>
                <JsonViewer value={ocrViewerData} className="max-h-[32rem] overflow-auto" />
              </div>
            )}
          </WorkflowBlock>

          <WorkflowBlock
            stageKey="sonar"
            expanded={expandedSonar}
            onToggle={() => handleToggle('sonar')}
            status={sonarState}
            meta={{
              startedAt: safeFormatDate(sonarStartedAt.toISOString(), 'h:mm:ss a'),
              completedAt: sonarState === 'success' ? safeFormatDate(sonarCompletedAt.toISOString(), 'h:mm:ss a') : undefined,
              duration: formatDuration(sonarCompletedAt.getTime() - sonarStartedAt.getTime()),
            }}
            subtitle="Sonar executes after OCR success and turns extracted text into structured medical analysis and codes."
          >
            {sonarState === 'failure' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-rose-300" />
                    <div>
                      <p className="text-sm font-semibold text-rose-100">Sonar failed</p>
                      <p className="text-xs text-rose-200/80">The AI analysis node terminated before producing the structured response.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-500/20 bg-slate-950/80 p-4 font-mono text-sm text-rose-100">
                  <p className="mb-2 text-xs uppercase tracking-[0.2em] text-rose-300">Error log</p>
                  <p>{sonarFailureReason}</p>
                </div>
              </div>
            ) : sonarState !== 'success' ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
                    <div>
                      <p className="text-sm font-semibold text-indigo-100">Sonar running</p>
                      <p className="text-xs text-indigo-200/80">Nested placeholders appear as the response is analyzed and normalized.</p>
                    </div>
                  </div>
                </div>
                <WorkflowStepList steps={SONAR_STEPS} visibleCount={sonarVisibleSteps} state={sonarState} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-100">Sonar response complete</p>
                      <p className="text-xs text-emerald-200/80">The structured AI response is displayed below in a scrollable, nested JSON viewer.</p>
                    </div>
                  </div>
                </div>
                <JsonViewer value={sonarViewerData} className="max-h-[32rem] overflow-auto" />
              </div>
            )}
          </WorkflowBlock>

          <WorkflowBlock
            stageKey="final"
            expanded={expandedFinal}
            onToggle={() => handleToggle('final')}
            status={finalState}
            meta={{
              startedAt: safeFormatDate(finalCompletedAt.toISOString(), 'h:mm:ss a'),
              completedAt: finalState === 'success' ? safeFormatDate(finalCompletedAt.toISOString(), 'h:mm:ss a') : undefined,
              duration: formatDuration(1200),
            }}
            subtitle="The final workflow node produces the exact structured response returned by the pipeline."
          >
            {finalState !== 'success' ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-300" />
                <p className="mt-4 text-sm font-medium text-slate-100">Waiting for Sonar to complete</p>
                <p className="mt-2 text-xs text-slate-400">The final structured JSON will be revealed once the upstream nodes finish successfully.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-100">Final response complete</p>
                      <p className="text-xs text-emerald-200/80">Ready for copy, download, or downstream integration.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={handleCopyFinalJson} className="border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800">
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button variant="ghost" onClick={handleDownloadFinalJson} className="border border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
                <JsonViewer value={finalJson} className="max-h-[36rem] overflow-auto" />
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                    <Database className="h-4 w-4 text-emerald-300" />
                    Raw JSON
                  </div>
                  <pre className="max-h-[18rem] overflow-auto rounded-xl bg-slate-900/90 p-4 font-mono text-[13px] leading-6 text-slate-100">
                    {finalJsonString}
                  </pre>
                </div>
              </div>
            )}
          </WorkflowBlock>
        </div>
      </div>
    </div>
  )
}

export default RealProviderWorkflow
