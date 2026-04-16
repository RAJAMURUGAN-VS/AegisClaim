// Date formatters
export const formatDate = (dateString: string | undefined, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return 'N/A'

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }

  return new Date(dateString).toLocaleDateString('en-US', defaultOptions)
}

export const formatDateTime = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A'

  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatRelativeTime = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A'

  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

  return formatDate(dateString)
}

// Number formatters
export const formatNumber = (num: number | undefined, decimals: number = 0): string => {
  if (num === undefined || num === null) return 'N/A'
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export const formatPercentage = (value: number | undefined, decimals: number = 1): string => {
  if (value === undefined || value === null) return 'N/A'
  return `${value.toFixed(decimals)}%`
}

export const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// String formatters
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

export const capitalizeFirst = (text: string | undefined): string => {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export const formatSnakeCase = (text: string): string => {
  return text
    .split('_')
    .map((word) => capitalizeFirst(word))
    .join(' ')
}

// File formatters
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// PA ID formatter - PA-2026-XXXXXX
export const formatPAId = (id: string): string => {
  if (!id) return 'N/A'
  // If already formatted, return as is
  if (id.startsWith('PA-')) return id
  // Extract last 6 characters or pad with zeros
  const padded = id.slice(-6).padStart(6, '0')
  const year = new Date().getFullYear()
  return `PA-${year}-${padded}`
}

// Score formatter with color class
export const formatScore = (score: number): { value: string; colorClass: string } => {
  if (score === undefined || score === null) {
    return { value: 'N/A', colorClass: 'text-gray-500' }
  }
  const formatted = score.toFixed(1)
  let colorClass = 'text-gray-900'

  if (score >= 85) {
    colorClass = 'text-green-600'
  } else if (score >= 75) {
    colorClass = 'text-orange-600'
  } else if (score >= 60) {
    colorClass = 'text-orange-700'
  } else {
    colorClass = 'text-red-600'
  }

  return { value: formatted, colorClass }
}

// Processing time formatter - ms to "1m 23s"
export const formatProcessingTime = (ms: number): string => {
  if (ms === undefined || ms === null) return 'N/A'

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

// Status color getter
export const getStatusColour = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING: 'text-yellow-600 bg-yellow-100 border-yellow-200',
    APPROVED: 'text-green-600 bg-green-100 border-green-200',
    DENIED: 'text-red-600 bg-red-100 border-red-200',
    REVIEW: 'text-blue-600 bg-blue-100 border-blue-200',
    PROCESSING: 'text-purple-600 bg-purple-100 border-purple-200',
    AUTO_APPROVE: 'text-green-600 bg-green-100 border-green-200',
    AUTO_DENY: 'text-red-600 bg-red-100 border-red-200',
    HUMAN_REVIEW: 'text-orange-600 bg-orange-100 border-orange-200',
  }
  return colors[status?.toUpperCase()] || 'text-gray-600 bg-gray-100 border-gray-200'
}

// Risk color getter
export const getRiskColour = (risk: string): string => {
  const colors: Record<string, string> = {
    LOW: 'text-green-600 bg-green-100 border-green-200',
    MEDIUM: 'text-orange-600 bg-orange-100 border-orange-200',
    HIGH: 'text-red-600 bg-red-100 border-red-200 animate-pulse',
  }
  return colors[risk?.toUpperCase()] || 'text-gray-600 bg-gray-100 border-gray-200'
}
