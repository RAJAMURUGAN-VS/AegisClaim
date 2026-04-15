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
