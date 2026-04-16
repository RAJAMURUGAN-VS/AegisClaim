import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
} from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Table, Column } from '../../components/common/Table'
import { Spinner } from '../../components/common/Spinner'
import api from '../../services/api'

// Types for review queue items
interface ReviewQueueItem {
  id: string
  paId: string
  patientId: string
  patientName: string
  submittedAt: string
  score: number
  riskFlag: 'LOW' | 'MEDIUM' | 'HIGH'
  payer: string
  payerCode: string
  plan: string
  status: string
  reviewedAt?: string
  hoursInQueue: number
}

interface QueueSummary {
  totalInQueue: number
  highRisk: number
  awaitingOver12Hours: number
  reviewedToday: number
}

interface QueueFilters {
  riskFlag: 'ALL' | 'MEDIUM' | 'HIGH'
  dateFrom: string
  dateTo: string
  patientId: string
}

// Summary Card Component
const SummaryCard: React.FC<{
  title: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'red' | 'orange' | 'green'
  loading?: boolean
}> = ({ title, value, icon, color, loading }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    green: 'bg-green-50 border-green-200 text-green-900',
  }

  const iconColors = {
    blue: 'text-blue-600',
    red: 'text-red-600',
    orange: 'text-orange-600',
    green: 'text-green-600',
  }

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2">
            {loading ? <Spinner size="sm" /> : value}
          </p>
        </div>
        <div className={`p-3 rounded-full bg-white/60 ${iconColors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// Pulsing badge for high risk
const PulsingBadge: React.FC<{ riskFlag: 'LOW' | 'MEDIUM' | 'HIGH' }> = ({
  riskFlag,
}) => {
  const baseClasses =
    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border'

  const colorClasses = {
    LOW: 'bg-green-100 text-green-800 border-green-200',
    MEDIUM: 'bg-orange-100 text-orange-800 border-orange-200',
    HIGH: 'bg-red-100 text-red-900 border-red-900 animate-pulse',
  }

  return (
    <span className={`${baseClasses} ${colorClasses[riskFlag]}`}>
      {riskFlag === 'HIGH' && (
        <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1.5 animate-ping" />
      )}
      {riskFlag}
    </span>
  )
}

// Score cell with color coding
const ScoreCell: React.FC<{ score: number }> = ({ score }) => {
  let colorClass = 'text-gray-900'
  let bgClass = 'bg-gray-100'

  if (score >= 85) {
    colorClass = 'text-green-800'
    bgClass = 'bg-green-100'
  } else if (score >= 75) {
    colorClass = 'text-orange-800'
    bgClass = 'bg-orange-100'
  } else if (score >= 60) {
    colorClass = 'text-orange-900'
    bgClass = 'bg-orange-200'
  } else {
    colorClass = 'text-red-900'
    bgClass = 'bg-red-100'
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${colorClass} ${bgClass}`}
    >
      {score}
    </span>
  )
}

const ReviewQueue: React.FC = () => {
  const navigate = useNavigate()

  // State
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([])
  const [summary, setSummary] = useState<QueueSummary>({
    totalInQueue: 0,
    highRisk: 0,
    awaitingOver12Hours: 0,
    reviewedToday: 0,
  })
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [filters, setFilters] = useState<QueueFilters>({
    riskFlag: 'ALL',
    dateFrom: '',
    dateTo: '',
    patientId: '',
  })

  // Fetch queue data
  const fetchQueueData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch review queue
      const params: Record<string, string> = {}
      if (filters.riskFlag !== 'ALL') params.risk_flag = filters.riskFlag
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo
      if (filters.patientId) params.patient_id = filters.patientId

      const response = await api.get<{
        items: ReviewQueueItem[]
        summary: QueueSummary
      }>('/api/v1/pa/queue/review', { params })

      setQueueItems(response.data.items)
      setSummary(response.data.summary)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to fetch queue data:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Initial load and auto-refresh
  useEffect(() => {
    fetchQueueData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchQueueData()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchQueueData])

  // Filter handlers
  const handleFilterChange = (key: keyof QueueFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleSearch = () => {
    fetchQueueData()
  }

  const handleClearFilters = () => {
    setFilters({
      riskFlag: 'ALL',
      dateFrom: '',
      dateTo: '',
      patientId: '',
    })
  }

  // Table columns
  const columns: Column<ReviewQueueItem>[] = useMemo(
    () => [
      {
        header: 'PA ID',
        accessor: 'paId',
        width: '120px',
      },
      {
        header: 'Patient ID',
        accessor: 'patientId',
        width: '120px',
      },
      {
        header: 'Submitted',
        accessor: (item: ReviewQueueItem) =>
          format(parseISO(item.submittedAt), 'MMM dd, yyyy HH:mm'),
        width: '160px',
      },
      {
        header: 'Score',
        accessor: (item: ReviewQueueItem) => <ScoreCell score={item.score} />,
        width: '100px',
        align: 'center',
      },
      {
        header: 'Risk Flag',
        accessor: (item: ReviewQueueItem) => (
          <PulsingBadge riskFlag={item.riskFlag} />
        ),
        width: '120px',
        align: 'center',
      },
      {
        header: 'Payer',
        accessor: (item: ReviewQueueItem) => (
          <div>
            <div className="font-medium">{item.payer}</div>
            <div className="text-xs text-gray-500">{item.payerCode}</div>
          </div>
        ),
        width: '150px',
      },
      {
        header: 'Action',
        accessor: (item: ReviewQueueItem) => (
          <Button
            size="sm"
            variant="primary"
            icon={Eye}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/adjudicator/review/${item.paId}`)
            }}
          >
            Review
          </Button>
        ),
        width: '120px',
        align: 'center',
      },
    ],
    [navigate]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-gray-500 mt-1">
            Prior authorization requests awaiting review
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
          Last updated: {format(lastRefresh, 'HH:mm:ss')}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total in Queue"
          value={summary.totalInQueue}
          icon={<Users className="w-6 h-6" />}
          color="blue"
          loading={loading}
        />
        <SummaryCard
          title="High Risk"
          value={summary.highRisk}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="red"
          loading={loading}
        />
        <SummaryCard
          title="Awaiting > 12hrs"
          value={summary.awaitingOver12Hours}
          icon={<Clock className="w-6 h-6" />}
          color="orange"
          loading={loading}
        />
        <SummaryCard
          title="Reviewed Today"
          value={summary.reviewedToday}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
          loading={loading}
        />
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          {/* Risk Flag Filter */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Flag
            </label>
            <select
              value={filters.riskFlag}
              onChange={(e) =>
                handleFilterChange('riskFlag', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                handleFilterChange('dateFrom', e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Patient ID Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by Patient ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter patient ID..."
                value={filters.patientId}
                onChange={(e) =>
                  handleFilterChange('patientId', e.target.value)
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="secondary" icon={Filter} onClick={handleSearch}>
              Filter
            </Button>
            <Button variant="ghost" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Queue Table */}
      <Card
        title="Pending Reviews"
        subtitle={`${queueItems.length} requests awaiting adjudication`}
      >
        <Table
          columns={columns}
          data={queueItems}
          loading={loading}
          keyExtractor={(item) => item.id}
          emptyMessage="No requests in review queue"
          onRowClick={(item) => navigate(`/adjudicator/review/${item.paId}`)}
        />
      </Card>
    </div>
  )
}

export default ReviewQueue
