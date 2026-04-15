import React from 'react'

export interface BadgeProps {
  children: React.ReactNode
  status?: 'APPROVED' | 'PENDING' | 'DENIED' | 'REVIEW' | 'PROCESSING' | 'LOW' | 'MEDIUM' | 'HIGH'
  size?: 'sm' | 'md'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  status,
  size = 'md',
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center rounded-full font-medium'

  const statusColors: Record<string, string> = {
    // Status variants
    APPROVED: 'bg-green-100 text-green-800 border-green-200',
    PENDING: 'bg-orange-100 text-orange-800 border-orange-200',
    DENIED: 'bg-red-100 text-red-900 border-red-900',
    REVIEW: 'bg-blue-100 text-blue-800 border-blue-200',
    PROCESSING: 'bg-gray-100 text-gray-700 border-gray-200',
    // Risk variants
    LOW: 'bg-green-100 text-green-800 border-green-200',
    MEDIUM: 'bg-orange-100 text-orange-800 border-orange-200',
    HIGH: 'bg-red-100 text-red-900 border-red-900',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs border',
    md: 'px-2.5 py-1 text-sm border',
  }

  const colorClass = status ? statusColors[status] : 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <span className={`${baseStyles} ${colorClass} ${sizes[size]} ${className}`}>
      {children}
    </span>
  )
}

export default Badge
