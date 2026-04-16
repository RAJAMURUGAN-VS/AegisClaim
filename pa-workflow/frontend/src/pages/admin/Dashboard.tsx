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
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Calendar,
  Download,
  Filter,
} from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { SkeletonKpiCard } from '../../components/common/Skeleton'
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

// Hero KPI Card with glassmorphism effect
interface HeroKpiCardProps {
  title: string
  value: number
  yesterdayValue: number
  icon: React.ReactNode
  gradient: 'blue' | 'green' | 'purple' | 'orange'
  format?: 'number' | 'percentage' | 'time'
  trend?: 'up' | 'down' | 'neutral'
  onClick?: () => void
}

const HeroKpiCard: React.FC<HeroKpiCardProps> = ({
  title,
  value,
  yesterdayValue,
  icon,
  gradient,
  format = 'number',
  trend = 'up',
  onClick,
}) => {
  const percentageChange = yesterdayValue
    ? ((value - yesterdayValue) / yesterdayValue) * 100
    : 0
  const isPositive = percentageChange >= 0
  const isTrendGood = trend === 'up' ? isPositive : !isPositive

  const gradients = {
    blue: 'from-primary-500/10 via-primary-500/5 to-transparent border-primary-200',
    green: 'from-success-500/10 via-success-500/5 to-transparent border-success-200',
    purple: 'from-violet-500/10 via-violet-500/5 to-transparent border-violet-200',
    orange: 'from-warning-500/10 via-warning-500/5 to-transparent border-warning-200',
  }

  const bottomBorders = {
    blue: 'bg-primary-500',
    green: 'bg-success-500',
    purple: 'bg-violet-500',
    orange: 'bg-warning-500',
  }

  const iconBg = {
    blue: 'bg-primary-100 text-primary-600',
    green: 'bg-success-100 text-success-600',
    purple: 'bg-violet-100 text-violet-600',
    orange: 'bg-warning-100 text-warning-600',
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

  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl bg-white shadow-card 
        border p-6 transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5
        ${onClick ? 'cursor-pointer' : ''}
        ${gradients[gradient]}
      `}
    >
      {/* Bottom accent border */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${bottomBorders[gradient]}`} />
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-neutral-900 mt-2 tabular-nums">
            {formatValue()}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            {isPositive ? (
              <TrendingUp className={`w-4 h-4 ${isTrendGood ? 'text-success-500' : 'text-danger-500'}`} />
            ) : (
              <TrendingDown className={`w-4 h-4 ${isTrendGood ? 'text-danger-500' : 'text-success-500'}`} />
            )}
            <span className={`text-sm font-medium ${isTrendGood ? 'text-success-600' : 'text-danger-600'}`}>
              {Math.abs(percentageChange).toFixed(1)}%
            </span>
            <span className="text-sm text-neutral-400">vs yesterday</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${iconBg[gradient]} opacity-80`}>
          {icon}
        </div>
      </div>
    </div>
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
      <div className="bg-white p-3 border border-neutral-200 rounded-xl shadow-elevated">
        {label && <p className="font-semibold text-sm text-neutral-900 mb-2">{label}</p>}
        {payload.map((entry, index) => (
          <p key={index} className="text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-neutral-600">{entry.name}:</span>
            <span className="font-semibold text-neutral-900">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Dark Chart Card for premium feel
interface DarkChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}

const DarkChartCard: React.FC<DarkChartCardProps> = ({ title, subtitle, children, className = '' }) => {
  return (
    <div className={`rounded-xl bg-primary-900 p-6 shadow-card ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-primary-300 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { dateRange, setDateRange } = useDateRange()

  // Fetch all analytics data
  const { data: stats, loading: statsLoading } = useDashboardStats()
  const { data: volumeData, loading: volumeLoading } = usePAVolumeChart()
  const { data: decisionData, loading: decisionLoading } = useDecisionDistribution()
  const { data: scoreData, loading: scoreLoading } = useScoreDistribution()
  const { data: agentData, loading: agentLoading } = useAgentPerformance()
  const { data: riskData, loading: riskLoading } = useRiskTrend()

  // Calculate total from decisions for pie chart center label
  const totalDecisions = useMemo(() => {
    return decisionData?.reduce((sum, item) => sum + (item.value || 0), 0) || 0
  }, [decisionData])

  const handleDateRangeChange = (type: 'from' | 'to', value: string) => {
    setDateRange({
      ...dateRange,
      [type]: value,
    })
  }

  return (
    <div className="space-y-8">
      {/* Header with Date Range */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-500 mt-1">Real-time overview of your PA workflow performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-neutral-200 shadow-sm">
            <Calendar className="w-4 h-4 text-neutral-400 ml-2" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateRangeChange('from', e.target.value)}
              className="px-2 py-1 text-sm border-0 focus:ring-0 text-neutral-700"
            />
            <span className="text-neutral-400">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateRangeChange('to', e.target.value)}
              className="px-2 py-1 text-sm border-0 focus:ring-0 text-neutral-700"
            />
          </div>
          
          <Button variant="secondary" icon={Filter} size="sm">
            Filter
          </Button>
          
          <Button variant="ghost" icon={Download} size="sm">
            Export
          </Button>
        </div>
      </div>

      {/* Row 1: Hero KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </>
        ) : (
          <>
            <HeroKpiCard
              title="Total PAs"
              value={stats?.totalPAsToday || 0}
              yesterdayValue={stats?.totalPAsYesterday || 0}
              icon={<FileText className="w-6 h-6" />}
              gradient="blue"
              format="number"
              trend="up"
            />
            <HeroKpiCard
              title="Approval Rate"
              value={stats?.autoApproveRate || 0}
              yesterdayValue={stats?.autoApproveRateYesterday || 0}
              icon={<Zap className="w-6 h-6" />}
              gradient="green"
              format="percentage"
              trend="up"
            />
            <HeroKpiCard
              title="Avg Processing"
              value={stats?.avgProcessingTime || 0}
              yesterdayValue={stats?.avgProcessingTimeYesterday || 0}
              icon={<TrendingUp className="w-6 h-6" />}
              gradient="purple"
              format="time"
              trend="down"
            />
            <HeroKpiCard
              title="Queue Size"
              value={stats?.humanReviewQueue || 0}
              yesterdayValue={stats?.humanReviewQueueYesterday || 0}
              icon={<Users className="w-6 h-6" />}
              gradient="orange"
              format="number"
              trend="down"
              onClick={() => navigate('/adjudicator/queue')}
            />
          </>
        )}
      </div>

      {/* Row 2: PA Volume (Dark) + Decision Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* PA Volume Chart - Dark Card */}
        <DarkChartCard 
          title="PA Volume" 
          subtitle="Last 7 days trend"
          className="lg:col-span-3"
        >
          {volumeLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse space-y-4">
                <div className="h-32 w-96 bg-primary-800 rounded" />
              </div>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A7FCC" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4A7FCC" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorApprovedVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D7D4F" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2D7D4F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDate(value)}
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} />
                  <Tooltip 
                    content={<CustomTooltip />}
                    contentStyle={{ backgroundColor: '#1F3864', border: 'none', borderRadius: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="submitted"
                    name="Submitted"
                    stroke="#4A7FCC"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorVolume)"
                  />
                  <Area
                    type="monotone"
                    dataKey="approved"
                    name="Approved"
                    stroke="#2D7D4F"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorApprovedVol)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </DarkChartCard>

        {/* Decision Distribution - Donut Chart */}
        <Card 
          title="Decision Distribution" 
          subtitle="By outcome type"
          className="lg:col-span-2"
        >
          {decisionLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse">
                <div className="w-32 h-32 rounded-full border-8 border-neutral-200" />
              </div>
            </div>
          ) : (
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisionData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1000}
                  >
                    {(decisionData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
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
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-3xl font-bold text-neutral-900">{totalDecisions}</p>
                  <p className="text-sm text-neutral-500">Total</p>
                </div>
              </div>
              {/* Custom Legend */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4">
                {(decisionData || []).slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-neutral-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: Score Distribution + Agent Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card title="Score Distribution" subtitle="PA scores by range">
          {scoreLoading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="space-y-3 w-full px-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 bg-neutral-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="range" stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Count']}
                    cursor={{ fill: '#F1F5F9' }}
                    content={<CustomTooltip />}
                  />
                  <Bar dataKey="count" name="PA Count" radius={[6, 6, 0, 0]} animationDuration={1000}>
                    {(scoreData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Agent Performance */}
        <Card title="Agent Performance" subtitle="Processing time by agent (seconds)">
          {agentLoading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="space-y-3 w-full px-8">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="h-8 bg-neutral-100 rounded flex-1 animate-pulse" />
                    <div className="h-8 bg-neutral-100 rounded flex-1 animate-pulse" />
                    <div className="h-8 bg-neutral-100 rounded flex-1 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDate(value)}
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(2)}s`, 'Time']}
                    cursor={{ fill: '#F1F5F9' }}
                    content={<CustomTooltip />}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="agentA" name="Clinical Agent" fill="#4A7FCC" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="agentB" name="Policy Agent" fill="#2E5FA3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="agentC" name="Fraud Agent" fill="#1F3864" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: Risk Trend (Full Width) */}
      <Card title="Risk Trend" subtitle="30-day risk level distribution">
        {riskLoading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="w-full px-8 space-y-4">
              <div className="h-1 bg-neutral-200 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-neutral-300 animate-pulse" />
              </div>
              <div className="flex gap-4">
                {[...Array(30)].map((_, i) => (
                  <div key={i} className="flex-1 h-32 bg-neutral-100 rounded animate-pulse" style={{ height: `${20 + Math.random() * 80}px` }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(value)}
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <ReferenceLine
                  y={10}
                  label={{ value: 'Alert Threshold', position: 'insideTopRight', fill: '#DC2626', fontSize: 11 }}
                  stroke="#DC2626"
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="LOW"
                  name="Low Risk"
                  stroke="#2D7D4F"
                  strokeWidth={3}
                  dot={{ fill: '#2D7D4F', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="MEDIUM"
                  name="Medium Risk"
                  stroke="#C55A11"
                  strokeWidth={3}
                  dot={{ fill: '#C55A11', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="HIGH"
                  name="High Risk"
                  stroke="#DC2626"
                  strokeWidth={3}
                  dot={{ fill: '#DC2626', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* View All Link */}
      <div className="flex justify-end pt-4">
        <Button
          variant="secondary"
          icon={ArrowRight}
          iconPosition="right"
          onClick={() => navigate('/admin/pa-list')}
        >
          View All PA Requests
        </Button>
      </div>
    </div>
  )
}

export default Dashboard
