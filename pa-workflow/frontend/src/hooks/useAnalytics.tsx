import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from 'react'
import api from '../services/api'

// Date Range Context
interface DateRangeContextType {
  dateRange: { from: string; to: string }
  setDateRange: (range: { from: string; to: string }) => void
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined)

interface DateRangeProviderProps {
  children: ReactNode
}

export function DateRangeProvider({ children }: DateRangeProviderProps) {
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [dateRange, setDateRange] = useState({
    from: thirtyDaysAgo.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  })

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export const useDateRange = () => {
  const context = useContext(DateRangeContext)
  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider')
  }
  return context
}

// Types
interface DashboardStats {
  totalPAsToday: number
  totalPAsYesterday: number
  autoApproveRate: number
  autoApproveRateYesterday: number
  humanReviewQueue: number
  humanReviewQueueYesterday: number
  avgProcessingTime: number
  avgProcessingTimeYesterday: number
}

interface PAVolumeData {
  date: string
  submitted: number
  approved: number
  denied: number
}

interface DecisionDistribution {
  name: string
  value: number
  color: string
}

interface ScoreDistribution {
  range: string
  count: number
  color: string
}

interface AgentPerformance {
  date: string
  agentA: number
  agentB: number
  agentC: number
}

interface RiskTrend {
  date: string
  LOW: number
  MEDIUM: number
  HIGH: number
}

interface UseAnalyticsReturn<T> {
  data: T
  loading: boolean
  error: string | null
  refresh: () => void
}

// Dashboard Stats Hook
export const useDashboardStats = (): UseAnalyticsReturn<DashboardStats> => {
  const [data, setData] = useState<DashboardStats>({
    totalPAsToday: 0,
    totalPAsYesterday: 0,
    autoApproveRate: 0,
    autoApproveRateYesterday: 0,
    humanReviewQueue: 0,
    humanReviewQueueYesterday: 0,
    avgProcessingTime: 0,
    avgProcessingTimeYesterday: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get<DashboardStats>('/analytics/dashboard-stats')
      setData(response.data)
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err)
      setError('Failed to load dashboard statistics')
      setData({
        totalPAsToday: 156,
        totalPAsYesterday: 142,
        autoApproveRate: 68.5,
        autoApproveRateYesterday: 65.2,
        humanReviewQueue: 23,
        humanReviewQueueYesterday: 28,
        avgProcessingTime: 45000,
        avgProcessingTimeYesterday: 52000,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { data, loading, error, refresh: fetchStats }
}

// PA Volume Chart Hook
export const usePAVolumeChart = (): UseAnalyticsReturn<PAVolumeData[]> => {
  const { dateRange } = useDateRange()
  const [data, setData] = useState<PAVolumeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get<PAVolumeData[]>('/analytics/volume', {
        params: { from: dateRange.from, to: dateRange.to },
      })
      setData(response.data)
    } catch (err) {
      console.error('Failed to fetch volume data:', err)
      setError('Failed to load volume data')
      const mockData: PAVolumeData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        mockData.push({
          date: date.toISOString().split('T')[0],
          submitted: Math.floor(Math.random() * 50) + 100,
          approved: Math.floor(Math.random() * 40) + 60,
          denied: Math.floor(Math.random() * 20) + 10,
        })
      }
      setData(mockData)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}

// Decision Distribution Hook
export const useDecisionDistribution = (): UseAnalyticsReturn<DecisionDistribution[]> => {
  const { dateRange } = useDateRange()
  const [data, setData] = useState<DecisionDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get<DecisionDistribution[]>('/analytics/decisions', {
        params: { from: dateRange.from, to: dateRange.to },
      })
      setData(response.data)
    } catch (err) {
      console.error('Failed to fetch decision distribution:', err)
      setError('Failed to load decision data')
      setData([
        { name: 'AUTO_APPROVE', value: 245, color: '#22c55e' },
        { name: 'HUMAN_REVIEW', value: 89, color: '#f97316' },
        { name: 'AUTO_DENY', value: 34, color: '#ef4444' },
      ])
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}

// Score Distribution Hook
export const useScoreDistribution = (): UseAnalyticsReturn<ScoreDistribution[]> => {
  const { dateRange } = useDateRange()
  const [data, setData] = useState<ScoreDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get<ScoreDistribution[]>('/analytics/scores', {
        params: { from: dateRange.from, to: dateRange.to },
      })
      setData(response.data)
    } catch (err) {
      console.error('Failed to fetch score distribution:', err)
      setError('Failed to load score data')
      setData([
        { range: '0-20', count: 12, color: '#ef4444' },
        { range: '21-40', count: 28, color: '#f87171' },
        { range: '41-60', count: 56, color: '#fb923c' },
        { range: '61-80', count: 124, color: '#facc15' },
        { range: '81-100', count: 148, color: '#22c55e' },
      ])
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}

// Agent Performance Hook
export const useAgentPerformance = (): UseAnalyticsReturn<AgentPerformance[]> => {
  const { dateRange } = useDateRange()
  const [data, setData] = useState<AgentPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get<AgentPerformance[]>('/analytics/agents', {
        params: { from: dateRange.from, to: dateRange.to },
      })
      setData(response.data)
    } catch (err) {
      console.error('Failed to fetch agent performance:', err)
      setError('Failed to load agent data')
      const mockData: AgentPerformance[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        mockData.push({
          date: date.toISOString().split('T')[0],
          agentA: Math.floor(Math.random() * 3) + 2 + Math.random(),
          agentB: Math.floor(Math.random() * 4) + 3 + Math.random(),
          agentC: Math.floor(Math.random() * 5) + 4 + Math.random(),
        })
      }
      setData(mockData)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}

// Risk Trend Hook
export const useRiskTrend = (): UseAnalyticsReturn<RiskTrend[]> => {
  const { dateRange } = useDateRange()
  const [data, setData] = useState<RiskTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get<RiskTrend[]>('/analytics/risk-trend', {
        params: { from: dateRange.from, to: dateRange.to },
      })
      setData(response.data)
    } catch (err) {
      console.error('Failed to fetch risk trend:', err)
      setError('Failed to load risk trend data')
      const mockData: RiskTrend[] = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        mockData.push({
          date: date.toISOString().split('T')[0],
          LOW: Math.floor(Math.random() * 40) + 80,
          MEDIUM: Math.floor(Math.random() * 20) + 10,
          HIGH: Math.floor(Math.random() * 10) + 2,
        })
      }
      setData(mockData)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh: fetchData }
}
