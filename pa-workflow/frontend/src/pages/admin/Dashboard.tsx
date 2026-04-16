import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts'
import {
  FileText,
  Clock,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Spinner } from '../../components/common/Spinner'
import {
  useDateRange,
  useDashboardStats,
  usePAVolumeChart,
  useDecisionDistribution,
  useScoreDistribution,
  useAgentPerformance,
  useRiskTrend,
} from '../../hooks/useAnalytics'
import {
  formatNumber,
  formatPercentage,
  formatProcessingTime,
  formatDate,
} from '../../utils/formatters'

// Sparkline component for KPI cards
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - ((value - min) / range) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 100" className="w-full h-8" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
    </svg>
  )
}

// KPI Card Component
interface KPICardProps {
  title: string
  value: number
  yesterdayValue: number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'orange' | 'gray'
  format?: 'number' | 'percentage' | 'time'
  sparklineData?: number[]
  clickable?: boolean
  onClick?: () => void
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  yesterdayValue,
  icon,
  color,
  format = 'number',
  sparklineData,
  clickable,
  onClick,
}) => {
  const percentageChange = yesterdayValue
    ? ((value - yesterdayValue) / yesterdayValue) * 100
    : 0
  const isPositive = percentageChange >= 0

  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'bg-blue-600',
      text: 'text-blue-900',
      subtext: 'text-blue-600',
    },
    green: {
      bg: 'bg-green-50 border-green-200',
      icon: 'bg-green-600',
      text: 'text-green-900',
      subtext: 'text-green-600',
    },
    orange: {
      bg: 'bg-orange-50 border-orange-200',
      icon: 'bg-orange-600',
      text: 'text-orange-900',
      subtext: 'text-orange-600',
    },
    gray: {
      bg: 'bg-gray-50 border-gray-200',
      icon: 'bg-gray-600',
      text: 'text-gray-900',
      subtext: 'text-gray-600',
    },
  }

  const formatValue = () => {
    switch (format) {
      case 'percentage':
        return formatPercentage(value)
      case 'time':
        return formatProcessingTime(value)
      default:
        return formatNumber(value)
    }
  }

  const cardContent = (
    <div className={`p-6 rounded-xl border ${colorClasses[color].bg} ${clickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${colorClasses[color].text}`}>
            {formatValue()}
          </p>
          <div className="flex items-center gap-1 mt-2">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span
              className={`text-sm font-medium ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {Math.abs(percentageChange).toFixed(1)}%
            </span>
            <span className="text-sm text-gray-400">vs yesterday</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color].icon} text-white`}>
          {icon}
        </div>
      </div>
      {sparklineData && (
        <div className="mt-4">
          <Sparkline
            data={sparklineData}
            color={color === 'blue' ? '#2563eb' : color === 'green' ? '#16a34a' : color === 'orange' ? '#ea580c' : '#4b5563'}
          />
        </div>
      )}
    </div>
  )

  return clickable ? (
    <button onClick={onClick} className="w-full text-left">{cardContent}</button>
  ) : (
    cardContent
  )
}

// Custom Tooltip for charts
const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        {label && <p className="font-medium text-gray-900 mb-2">{label}</p>}
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Loading skeleton for charts
const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <div className="flex items-center justify-center" style={{ height }}>
    <Spinner size="lg" />
  </div>
)

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { dateRange, setDateRange } = useDateRange()

  // Fetch all analytics data
  const { data: stats } = useDashboardStats()
  const { data: volumeData, loading: volumeLoading } = usePAVolumeChart()
  const { data: decisionData, loading: decisionLoading } = useDecisionDistribution()
  const { data: scoreData, loading: scoreLoading } = useScoreDistribution()
  const { data: agentData, loading: agentLoading } = useAgentPerformance()
  const { data: riskData, loading: riskLoading } = useRiskTrend()

  // Calculate total from decisions for pie chart center label
  const totalDecisions = useMemo(() => {
    return decisionData.reduce((sum, item) => sum + item.value, 0)
  }, [decisionData])

  // Sparkline data (mock for demo - would come from API)
  const sparklineData = useMemo(() => {
    return {
      total: [120, 132, 145, 138, 156, 148, 156],
      autoApprove: [65, 68, 70, 67, 69, 68, 68.5],
      humanReview: [35, 32, 30, 28, 26, 25, 23],
      processingTime: [52, 50, 48, 46, 44, 45, 45],
    }
  }, [])

  const handleDateRangeChange = (type: 'from' | 'to', value: string) => {
    setDateRange({
      ...dateRange,
      [type]: value,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of PA system performance and metrics</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">From:</span>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateRangeChange('from', e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">To:</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateRangeChange('to', e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total PAs Today"
          value={stats.totalPAsToday}
          yesterdayValue={stats.totalPAsYesterday}
          icon={<FileText className="w-5 h-5" />}
          color="blue"
          format="number"
          sparklineData={sparklineData.total}
        />
        <KPICard
          title="Auto-Approved Rate"
          value={stats.autoApproveRate}
          yesterdayValue={stats.autoApproveRateYesterday}
          icon={<Zap className="w-5 h-5" />}
          color="green"
          format="percentage"
          sparklineData={sparklineData.autoApprove}
        />
        <KPICard
          title="Human Review Queue"
          value={stats.humanReviewQueue}
          yesterdayValue={stats.humanReviewQueueYesterday}
          icon={<Users className="w-5 h-5" />}
          color="orange"
          format="number"
          sparklineData={sparklineData.humanReview}
          clickable
          onClick={() => navigate('/adjudicator/queue')}
        />
        <KPICard
          title="Avg Processing Time"
          value={stats.avgProcessingTime}
          yesterdayValue={stats.avgProcessingTimeYesterday}
          icon={<Clock className="w-5 h-5" />}
          color="gray"
          format="time"
          sparklineData={sparklineData.processingTime}
        />
      </div>

      {/* Row 2: PieChart + AreaChart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Decision Distribution Pie Chart */}
        <Card title="PA Decision Distribution" subtitle="Breakdown by decision type">
          {decisionLoading ? (
            <ChartSkeleton height={300} />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {decisionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const percentage = totalDecisions
                        ? ((value / totalDecisions) * 100).toFixed(1)
                        : '0'
                      return [`${value} (${percentage}%)`, name]
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center mt-8">
                  <p className="text-3xl font-bold text-gray-900">{totalDecisions}</p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* PA Volume Over Time Area Chart */}
        <Card title="PA Volume Over Time" subtitle="Last 7 days activity">
          {volumeLoading ? (
            <ChartSkeleton height={300} />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDenied" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDate(value)}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="submitted"
                    name="Submitted"
                    stroke="#2563eb"
                    fillOpacity={1}
                    fill="url(#colorSubmitted)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="approved"
                    name="Approved"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorApproved)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="denied"
                    name="Denied"
                    stroke="#ef4444"
                    fillOpacity={1}
                    fill="url(#colorDenied)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card title="Score Distribution" subtitle="PA score ranges">
          {scoreLoading ? (
            <ChartSkeleton height={300} />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="range" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Count']}
                    cursor={{ fill: '#f3f4f6' }}
                  />
                  <Bar dataKey="count" name="PA Count" radius={[4, 4, 0, 0]} animationDuration={1000}>
                    {scoreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Agent Processing Time */}
        <Card title="Agent Processing Time" subtitle="Average time per agent (seconds)">
          {agentLoading ? (
            <ChartSkeleton height={300} />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDate(value)}
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}s`, 'Avg Time']}
                    cursor={{ fill: '#f3f4f6' }}
                  />
                  <Legend />
                  <Bar dataKey="agentA" name="Agent A (Clinical)" fill="#2563eb" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="agentB" name="Agent B (Policy)" fill="#7c3aed" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="agentC" name="Agent C (Fraud)" fill="#db2777" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: Risk Flag Trend (Full Width) */}
      <Card title="Risk Flag Trend" subtitle="Last 30 days risk distribution">
        {riskLoading ? (
          <ChartSkeleton height={350} />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(value)}
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <ReferenceLine
                  y={10}
                  label="HIGH > 10% threshold"
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="LOW"
                  name="Low Risk"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', r: 3 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="MEDIUM"
                  name="Medium Risk"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', r: 3 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="HIGH"
                  name="High Risk"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* View All PAs Link */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          icon={ArrowRight}
          onClick={() => navigate('/admin/pa-list')}
        >
          View All PA Requests
        </Button>
      </div>
    </div>
  )
}

export default Dashboard
