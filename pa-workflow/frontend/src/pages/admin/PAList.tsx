import React, { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Download,
  List,
  Eye,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { Table, Column } from '../../components/common/Table'
import { Modal } from '../../components/common/Modal'
import { Spinner } from '../../components/common/Spinner'
import api from '../../services/api'
import {
  formatPAId,
  formatScore,
  formatDateTime,
  getStatusColour,
  getRiskColour,
} from '../../utils/formatters'

// Types
interface PARequest {
  id: string
  paId: string
  patientId: string
  patientName: string
  payer: string
  status: string
  score: number
  riskFlag: 'LOW' | 'MEDIUM' | 'HIGH'
  decision?: string
  submittedAt: string
  reviewedAt?: string
}

interface AuditLogEntry {
  id: string
  timestamp: string
  actor: string
  actorType: 'SYSTEM' | 'AGENT' | 'USER'
  eventType: string
  details: string
}

interface Filters {
  status: string
  dateFrom: string
  dateTo: string
  riskFlag: string
  search: string
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DENIED', label: 'Denied' },
  { value: 'REVIEW', label: 'In Review' },
  { value: 'PROCESSING', label: 'Processing' },
]

const RISK_OPTIONS = [
  { value: 'ALL', label: 'All Risk Levels' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

const PAList: React.FC = () => {
  const navigate = useNavigate()

  // State
  const [paList, setPAList] = useState<PARequest[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
    riskFlag: 'ALL',
    search: '',
  })

  // Audit log modal state
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [selectedPA, setSelectedPA] = useState<PARequest | null>(null)
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const pageSize = 20

  // Fetch PA list
  const fetchPAList = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string | number> = {
        page: currentPage,
        page_size: pageSize,
      }

      if (filters.status !== 'ALL') params.status = filters.status
      if (filters.riskFlag !== 'ALL') params.risk_flag = filters.riskFlag
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo
      if (filters.search) params.search = filters.search

      const response = await api.get<{
        items: PARequest[]
        total: number
      }>('/pa/list', { params })

      setPAList(response.data.items)
      setTotalCount(response.data.total)
    } catch (error) {
      console.error('Failed to fetch PA list:', error)
      // Mock data for development
      setPAList(generateMockPAData())
      setTotalCount(156)
    } finally {
      setLoading(false)
    }
  }, [currentPage, filters])

  // Generate mock data
  const generateMockPAData = (): PARequest[] => {
    const statuses = ['PENDING', 'APPROVED', 'DENIED', 'REVIEW', 'PROCESSING']
    const risks: ('LOW' | 'MEDIUM' | 'HIGH')[] = ['LOW', 'MEDIUM', 'HIGH']
    const payers = ['Aetna', 'Blue Cross', 'Cigna', 'UnitedHealthcare', 'Humana']

    return Array.from({ length: pageSize }, (_, i) => {
      const id = `PA-${2026}-${String(i + 1).padStart(6, '0')}`
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const score = Math.floor(Math.random() * 100)

      return {
        id: `mock-${i}`,
        paId: id,
        patientId: `PT-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
        patientName: `Patient ${i + 1}`,
        payer: payers[Math.floor(Math.random() * payers.length)],
        status,
        score,
        riskFlag: risks[Math.floor(Math.random() * risks.length)],
        decision: status === 'APPROVED' || status === 'DENIED' ? status : undefined,
        submittedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedAt: Math.random() > 0.5 ? new Date().toISOString() : undefined,
      }
    })
  }

  // Fetch audit log
  const fetchAuditLog = async (paId: string) => {
    try {
      setAuditLoading(true)
      const response = await api.get<{ auditLog: AuditLogEntry[] }>(`/pa/${paId}/audit-log`)
      setAuditLog(response.data.auditLog)
    } catch (error) {
      console.error('Failed to fetch audit log:', error)
      // Mock audit log
      setAuditLog([
        {
          id: '1',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          actor: 'System',
          actorType: 'SYSTEM',
          eventType: 'PA_CREATED',
          details: 'Prior authorization request submitted',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 82800000).toISOString(),
          actor: 'Agent A',
          actorType: 'AGENT',
          eventType: 'DOCUMENT_ANALYZED',
          details: 'Clinical data extraction completed',
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 79200000).toISOString(),
          actor: 'Agent B',
          actorType: 'AGENT',
          eventType: 'POLICY_CHECKED',
          details: 'Policy compliance verification passed',
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 75600000).toISOString(),
          actor: 'Agent C',
          actorType: 'AGENT',
          eventType: 'FRAUD_ANALYZED',
          details: 'Low risk assessment completed',
        },
        {
          id: '5',
          timestamp: new Date(Date.now() - 72000000).toISOString(),
          actor: 'System',
          actorType: 'SYSTEM',
          eventType: 'AUTO_APPROVED',
          details: 'Request auto-approved based on score',
        },
      ])
    } finally {
      setAuditLoading(false)
    }
  }

  // Handle view audit log
  const handleViewAudit = async (pa: PARequest) => {
    setSelectedPA(pa)
    setShowAuditModal(true)
    await fetchAuditLog(pa.paId)
  }

  // Handle download letter
  const handleDownloadLetter = async (pa: PARequest) => {
    try {
      const response = await api.get(`/pa/${pa.paId}/letter`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `PA-${pa.paId}-${pa.decision?.toLowerCase()}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to download letter:', error)
      alert('Failed to download letter. Please try again.')
    }
  }

  // Handle export CSV
  const handleExportCSV = async () => {
    try {
      const params: Record<string, string> = {}
      if (filters.status !== 'ALL') params.status = filters.status
      if (filters.riskFlag !== 'ALL') params.risk_flag = filters.riskFlag
      if (filters.dateFrom) params.date_from = filters.dateFrom
      if (filters.dateTo) params.date_to = filters.dateTo
      if (filters.search) params.search = filters.search

      const response = await api.get('/pa/export', {
        params,
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `pa-export-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to export CSV:', error)
      alert('Failed to export CSV. Please try again.')
    }
  }

  // Filter handlers
  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setFilters({
      status: 'ALL',
      dateFrom: '',
      dateTo: '',
      riskFlag: 'ALL',
      search: '',
    })
    setCurrentPage(1)
  }

  const handleSearch = () => {
    fetchPAList()
  }

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)

  // Table columns
  const columns: Column<PARequest>[] = useMemo(
    () => [
      {
        header: 'PA ID',
        accessor: (item: PARequest) => (
          <span className="font-mono text-sm">{formatPAId(item.paId)}</span>
        ),
        width: '140px',
      },
      {
        header: 'Patient ID',
        accessor: 'patientId',
        width: '120px',
      },
      {
        header: 'Payer',
        accessor: 'payer',
        width: '140px',
      },
      {
        header: 'Status',
        accessor: (item: PARequest) => {
          const colorClass = getStatusColour(item.status)
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
              {item.status}
            </span>
          )
        },
        width: '120px',
      },
      {
        header: 'Score',
        accessor: (item: PARequest) => {
          const { value, colorClass } = formatScore(item.score)
          return (
            <span className={`font-semibold ${colorClass}`}>{value}</span>
          )
        },
        width: '80px',
        align: 'center',
      },
      {
        header: 'Risk',
        accessor: (item: PARequest) => {
          const colorClass = getRiskColour(item.riskFlag)
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
              {item.riskFlag}
            </span>
          )
        },
        width: '100px',
        align: 'center',
      },
      {
        header: 'Decision',
        accessor: (item: PARequest) => {
          if (!item.decision) return '-'
          return (
            <Badge status={item.decision === 'APPROVED' ? 'APPROVED' : 'DENIED'}>
              {item.decision}
            </Badge>
          )
        },
        width: '100px',
      },
      {
        header: 'Submitted',
        accessor: (item: PARequest) => formatDateTime(item.submittedAt),
        width: '160px',
      },
      {
        header: 'Actions',
        accessor: (item: PARequest) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/admin/pa/${item.paId}`)
              }}
              className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </button>
            {item.decision && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownloadLetter(item)
                }}
                className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
                title="Download letter"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleViewAudit(item)
              }}
              className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded"
              title="View audit log"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        ),
        width: '120px',
        align: 'center',
      },
    ],
    [navigate]
  )

  // Get event icon based on type
  const getEventIcon = (eventType: string) => {
    if (eventType.includes('APPROVED')) return <CheckCircle className="w-5 h-5 text-green-600" />
    if (eventType.includes('DENIED')) return <AlertCircle className="w-5 h-5 text-red-600" />
    if (eventType.includes('CREATED')) return <FileText className="w-5 h-5 text-blue-600" />
    return <Clock className="w-5 h-5 text-gray-500" />
  }

  // Get event color based on type
  const getEventColor = (eventType: string) => {
    if (eventType.includes('APPROVED')) return 'border-green-500 bg-green-50'
    if (eventType.includes('DENIED')) return 'border-red-500 bg-red-50'
    if (eventType.includes('CREATED')) return 'border-blue-500 bg-blue-50'
    if (eventType.includes('AGENT')) return 'border-purple-500 bg-purple-50'
    return 'border-gray-300 bg-gray-50'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PA Request Management</h1>
          <p className="text-gray-500 mt-1">View and manage all prior authorization requests</p>
        </div>
        <Button variant="primary" icon={Download} onClick={handleExportCSV}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          {/* Status Filter */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Risk Filter */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Flag</label>
            <select
              value={filters.riskFlag}
              onChange={(e) => handleFilterChange('riskFlag', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {RISK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-[2] min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by PA ID or Patient ID..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
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

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        Showing {startIndex}-{endIndex} of {totalCount} results
      </div>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          data={paList}
          loading={loading}
          keyExtractor={(item) => item.id}
          emptyMessage="No PA requests found"
          onRowClick={(item) => navigate(`/admin/pa/${item.paId}`)}
        />
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = i + 1
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded text-sm font-medium ${
                  currentPage === pageNum
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronRight}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Audit Log Modal */}
      <Modal
        isOpen={showAuditModal}
        onClose={() => {
          setShowAuditModal(false)
          setSelectedPA(null)
          setAuditLog([])
        }}
        title={`Audit Log - ${selectedPA ? formatPAId(selectedPA.paId) : ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : auditLog.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No audit log entries found</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />

              <div className="space-y-4">
                {auditLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="relative flex items-start gap-4 pl-2"
                  >
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 ${getEventColor(entry.eventType)}`}
                    >
                      {getEventIcon(entry.eventType)}
                    </div>

                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {entry.eventType.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-500">{entry.details}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-900">
                            {formatDateTime(entry.timestamp)}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <User className="w-3 h-3" />
                            <span>{entry.actor}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default PAList
