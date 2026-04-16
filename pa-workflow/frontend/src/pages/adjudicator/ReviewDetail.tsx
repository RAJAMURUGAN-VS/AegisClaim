import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Cell,
} from 'recharts'
import {
  ArrowLeft,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  User,
  Stethoscope,
  Shield,
  Search,
  Activity,
  Info,
} from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Spinner } from '../../components/common/Spinner'
import DecisionPanel from './DecisionPanel'
import api from '../../services/api'

// Types
interface Document {
  id: string
  filename: string
  fileType: string
  fileSize: number
  uploadedAt: string
  url: string
}

interface ICD10Code {
  code: string
  description: string
  confidence: number
}

interface CPTCode {
  code: string
  description: string
  confidence: number
}

interface Medication {
  name: string
  rxnormCode: string
  dosage?: string
}

interface ClinicalData {
  icd10Codes: ICD10Code[]
  cptCodes: CPTCode[]
  medications: Medication[]
  ocrConfidence: number
  lowConfidenceFlags: string[]
}

interface PolicyCompliance {
  policyScore: number
  stepTherapyStatus: 'PASSED' | 'FAILED' | 'NOT_APPLICABLE'
  complianceChecks: ComplianceCheck[]
}

interface ComplianceCheck {
  id: string
  name: string
  status: 'PASSED' | 'FAILED'
  explanation?: string
}

interface Anomaly {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  details: string
}

interface FraudAnalysis {
  fraudScore: number
  riskFlag: 'LOW' | 'MEDIUM' | 'HIGH'
  anomalies: Anomaly[]
  providerRiskScore: number
}

interface AIScoreBreakdown {
  finalScore: number
  policyContribution: number
  clinicalContribution: number
  fraudContribution: number
}

interface SHAPFactor {
  factor: string
  impact: number
  description: string
}

interface ReviewDetailData {
  id: string
  paId: string
  patientId: string
  patientName: string
  patientDOB: string
  memberId: string
  providerNpi: string
  providerName: string
  payer: string
  payerCode: string
  plan: string
  planCode: string
  dateOfService: string
  submittedAt: string
  documents: Document[]
  clinicalData: ClinicalData
  policyCompliance: PolicyCompliance
  fraudAnalysis: FraudAnalysis
  aiScoreBreakdown: AIScoreBreakdown
  shapExplanation: SHAPFactor[]
}

// Circular Progress Component
const CircularProgress: React.FC<{ value: number; color: string; size?: number }> = ({
  value,
  color,
  size = 120,
}) => {
  const data = [{ name: 'Score', value }]

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="90%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background
            dataKey="value"
            cornerRadius={10}
            fill={color}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="relative -mt-24 text-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  )
}

// Section Header Component
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
    <span className="text-primary">{icon}</span>
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
  </div>
)

// Document Item Component
const DocumentItem: React.FC<{ document: Document }> = ({ document }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
    <div className="flex items-center gap-3">
      <FileText className="w-5 h-5 text-gray-500" />
      <div>
        <p className="font-medium text-sm text-gray-900">{document.filename}</p>
        <p className="text-xs text-gray-500">
          {format(parseISO(document.uploadedAt), 'MMM dd, yyyy HH:mm')}
        </p>
      </div>
    </div>
    <button
      className="p-2 text-gray-500 hover:text-primary hover:bg-white rounded-lg transition-colors"
      title="Download document"
    >
      <Download className="w-4 h-4" />
    </button>
  </div>
)

// Code Badge Component
const CodeBadge: React.FC<{ code: string; confidence: number }> = ({
  code,
  confidence,
}) => {
  let bgColor = 'bg-green-100 text-green-800'
  if (confidence < 0.7) bgColor = 'bg-orange-100 text-orange-800'
  if (confidence < 0.5) bgColor = 'bg-red-100 text-red-800'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${bgColor}`}
      title={`Confidence: ${(confidence * 100).toFixed(1)}%`}
    >
      {code}
    </span>
  )
}

// Compliance Alert Component
const ComplianceAlert: React.FC<{ check: ComplianceCheck }> = ({ check }) => {
  const isPassed = check.status === 'PASSED'
  return (
    <div
      className={`p-3 rounded-lg border-l-4 ${
        isPassed
          ? 'bg-green-50 border-green-500'
          : 'bg-red-50 border-red-500'
      }`}
    >
      <div className="flex items-start gap-2">
        {isPassed ? (
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p
            className={`font-medium ${
              isPassed ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {check.name}
          </p>
          {check.explanation && (
            <p
              className={`text-sm mt-1 ${
                isPassed ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {check.explanation}
            </p>
          )}
        </div>
        <Badge status={isPassed ? 'APPROVED' : 'DENIED'}>
          {check.status}
        </Badge>
      </div>
    </div>
  )
}

// Anomaly Item Component
const AnomalyItem: React.FC<{ anomaly: Anomaly }> = ({ anomaly }) => {
  const severityColors = {
    LOW: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    MEDIUM: 'text-orange-600 bg-orange-50 border-orange-200',
    HIGH: 'text-red-600 bg-red-50 border-red-200',
  }

  return (
    <div className={`p-3 rounded-lg border ${severityColors[anomaly.severity]}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{anomaly.type}</span>
        <Badge status={anomaly.severity}>{anomaly.severity}</Badge>
      </div>
      <p className="text-sm mt-1 opacity-90">{anomaly.details}</p>
    </div>
  )
}

const ReviewDetail: React.FC = () => {
  const { pa_id } = useParams<{ pa_id: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<ReviewDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!pa_id) return

      try {
        setLoading(true)
        const response = await api.get<ReviewDetailData>(
          `/api/v1/pa/queue/review/${pa_id}`
        )
        setData(response.data)
      } catch (err) {
        console.error('Failed to fetch review details:', err)
        setError('Failed to load review details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [pa_id])

  const handleDecisionSubmitted = () => {
    // Show success toast and redirect back to queue
    navigate('/adjudicator/queue', {
      state: { success: true, message: 'Decision submitted successfully' },
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{error || 'Failed to load data'}</p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Score breakdown data for bar chart
  const scoreData = [
    {
      name: 'Policy',
      contribution: data.aiScoreBreakdown.policyContribution,
      weight: 40,
      fill: '#1F3864',
    },
    {
      name: 'Clinical',
      contribution: data.aiScoreBreakdown.clinicalContribution,
      weight: 35,
      fill: '#2E5FA3',
    },
    {
      name: 'Fraud',
      contribution: data.aiScoreBreakdown.fraudContribution,
      weight: 25,
      fill: '#4573B8',
    },
  ]

  // SHAP data
  const shapData = data.shapExplanation.map((item) => ({
    name: item.factor
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    value: item.impact,
    fill: item.impact >= 0 ? '#4A702F' : '#A30000',
  }))

  // Final score color
  const finalScore = data.aiScoreBreakdown.finalScore
  let scoreColor = '#4A702F' // green
  if (finalScore < 75) scoreColor = '#C55A11' // orange
  if (finalScore < 60) scoreColor = '#A30000' // red

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/adjudicator/queue')}
          >
            Back to Queue
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Review PA Request
            </h1>
            <p className="text-gray-500 text-sm">ID: {data.paId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <Badge status="REVIEW">IN REVIEW</Badge>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT PANEL - 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Section A: Patient & Request Info */}
          <Card>
            <SectionHeader icon={<User className="w-5 h-5" />} title="Patient & Request Information" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">PA ID</p>
                <p className="font-medium">{data.paId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Patient Member ID</p>
                <p className="font-medium">{data.memberId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Patient Name</p>
                <p className="font-medium">{data.patientName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Provider NPI</p>
                <p className="font-medium">{data.providerNpi}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Provider Name</p>
                <p className="font-medium">{data.providerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payer</p>
                <p className="font-medium">
                  {data.payer} ({data.payerCode})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Plan</p>
                <p className="font-medium">
                  {data.plan} ({data.planCode})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date of Service</p>
                <p className="font-medium">
                  {format(parseISO(data.dateOfService), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-3">Submitted Documents</p>
              <div className="space-y-2">
                {data.documents.map((doc) => (
                  <DocumentItem key={doc.id} document={doc} />
                ))}
              </div>
            </div>
          </Card>

          {/* Section B: Clinical Data */}
          <Card>
            <SectionHeader icon={<Stethoscope className="w-5 h-5" />} title="Clinical Data (Agent A - Document Analysis)" />

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">ICD-10 Codes</p>
                <div className="flex flex-wrap gap-2">
                  {data.clinicalData.icd10Codes.map((code) => (
                    <div key={code.code} className="group relative">
                      <CodeBadge code={code.code} confidence={code.confidence} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        {code.description}
                        <div className="mt-1 text-gray-300">
                          Confidence: {(code.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">CPT Codes</p>
                <div className="flex flex-wrap gap-2">
                  {data.clinicalData.cptCodes.map((code) => (
                    <div key={code.code} className="group relative">
                      <CodeBadge code={code.code} confidence={code.confidence} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                        {code.description}
                        <div className="mt-1 text-gray-300">
                          Confidence: {(code.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {data.clinicalData.medications.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Medications (RxNorm)</p>
                  <div className="space-y-2">
                    {data.clinicalData.medications.map((med) => (
                      <div
                        key={med.rxnormCode}
                        className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                      >
                        <span className="font-medium">{med.name}</span>
                        <span className="text-sm text-gray-600">
                          {med.rxnormCode}
                          {med.dosage && ` - ${med.dosage}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">OCR Confidence Score</p>
                  <span className="text-sm font-semibold">
                    {(data.clinicalData.ocrConfidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      data.clinicalData.ocrConfidence >= 0.8
                        ? 'bg-green-500'
                        : data.clinicalData.ocrConfidence >= 0.6
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${data.clinicalData.ocrConfidence * 100}%` }}
                  />
                </div>
              </div>

              {data.clinicalData.lowConfidenceFlags.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Low Confidence Documents</p>
                    <ul className="text-sm text-yellow-700 mt-1">
                      {data.clinicalData.lowConfidenceFlags.map((flag, idx) => (
                        <li key={idx}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Section C: Policy Compliance */}
          <Card>
            <SectionHeader icon={<Shield className="w-5 h-5" />} title="Policy Compliance (Agent B - Policy Analysis)" />

            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center">
                <CircularProgress
                  value={data.policyCompliance.policyScore}
                  color={
                    data.policyCompliance.policyScore >= 80
                      ? '#4A702F'
                      : data.policyCompliance.policyScore >= 60
                      ? '#C55A11'
                      : '#A30000'
                  }
                />
                <p className="text-sm font-medium text-gray-700 mt-2">Policy Score</p>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Step Therapy:</span>
                  <Badge
                    status={
                      data.policyCompliance.stepTherapyStatus === 'PASSED'
                        ? 'APPROVED'
                        : data.policyCompliance.stepTherapyStatus === 'FAILED'
                        ? 'DENIED'
                        : 'PENDING'
                    }
                  >
                    {data.policyCompliance.stepTherapyStatus.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Compliance Checks</p>
                  {data.policyCompliance.complianceChecks.map((check) => (
                    <ComplianceAlert key={check.id} check={check} />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Section D: Fraud Analysis */}
          <Card>
            <SectionHeader icon={<Search className="w-5 h-5" />} title="Fraud Analysis (Agent C - Fraud Detection)" />

            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center">
                <CircularProgress
                  value={data.fraudAnalysis.fraudScore}
                  color={
                    data.fraudAnalysis.fraudScore <= 30
                      ? '#4A702F'
                      : data.fraudAnalysis.fraudScore <= 60
                      ? '#C55A11'
                      : '#A30000'
                  }
                />
                <p className="text-sm font-medium text-gray-700 mt-2">Fraud Score</p>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Risk Flag:</span>
                  <Badge status={data.fraudAnalysis.riskFlag}>
                    {data.fraudAnalysis.riskFlag}
                  </Badge>
                </div>

                {data.fraudAnalysis.anomalies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Detected Anomalies</p>
                    {data.fraudAnalysis.anomalies.map((anomaly, idx) => (
                      <AnomalyItem key={idx} anomaly={anomaly} />
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Provider Risk Score</span>
                    <span className="text-sm font-semibold">
                      {data.fraudAnalysis.providerRiskScore}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        data.fraudAnalysis.providerRiskScore <= 30
                          ? 'bg-green-500'
                          : data.fraudAnalysis.providerRiskScore <= 60
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${data.fraudAnalysis.providerRiskScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT PANEL - 40% */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Score Breakdown */}
          <Card>
            <SectionHeader icon={<Activity className="w-5 h-5" />} title="AI Score Breakdown" />

            <div className="text-center mb-6">
              <p className="text-sm text-gray-500 mb-1">Final Weighted Score</p>
              <p
                className="text-5xl font-bold"
                style={{ color: scoreColor }}
              >
                {finalScore.toFixed(1)}
              </p>
              <p className="text-sm text-gray-500 mt-2">out of 100</p>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 50]} />
                  <YAxis dataKey="name" type="category" width={60} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}`, 'Contribution']}
                    labelFormatter={(label) => `${label} Score`}
                  />
                  <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                    {scoreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">AI Recommendation</span>
              </div>
              <Badge status="REVIEW" className="w-full justify-center py-2">
                AI Recommends: HUMAN REVIEW
              </Badge>
            </div>
          </Card>

          {/* SHAP Explanation Panel */}
          <Card>
            <SectionHeader icon={<Info className="w-5 h-5" />} title="SHAP Explanation" />
            <p className="text-sm text-gray-500 mb-4">
              Factors that pushed the score UP (green) or DOWN (red)
            </p>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={shapData}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[
                      -Math.max(...shapData.map((d) => Math.abs(d.value))) * 1.1,
                      Math.max(...shapData.map((d) => Math.abs(d.value))) * 1.1,
                    ]}
                  />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value > 0 ? '+' : ''}${value.toFixed(2)}`,
                      'Impact',
                    ]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {shapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-2">
              {data.shapExplanation.map((item) => (
                <div
                  key={item.factor}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600 capitalize">
                    {item.factor.replace(/_/g, ' ')}:
                  </span>
                  <span
                    className={`font-medium ${
                      item.impact >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {item.impact > 0 ? '+' : ''}
                    {item.impact.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Decision Panel */}
          <Card>
            <SectionHeader icon={<CheckCircle className="w-5 h-5" />} title="Decision" />
            <DecisionPanel
              paId={pa_id || ''}
              patientName={data.patientName}
              onDecisionSubmitted={handleDecisionSubmitted}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ReviewDetail
