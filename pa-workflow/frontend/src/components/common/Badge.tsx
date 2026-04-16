import React from 'react'

export type BadgeStatus = 
  | 'APPROVED' | 'PENDING' | 'DENIED' | 'REVIEW' | 'PROCESSING' | 'ESCALATED' | 'AWAITING_INFO'
  | 'LOW' | 'MEDIUM' | 'HIGH'
  | 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

export interface BadgeProps {
  children: React.ReactNode
  status?: BadgeStatus
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'dot' | 'pulse'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  status,
  size = 'md',
  variant = 'default',
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center rounded-full font-medium transition-all duration-150'

  const statusColors: Record<string, string> = {
    // Status variants
    APPROVED: 'bg-success-100 text-success-700 border border-success-200',
    PENDING: 'bg-warning-100 text-warning-700 border border-warning-200',
    DENIED: 'bg-danger-100 text-danger-700 border border-danger-200',
    REVIEW: 'bg-primary-100 text-primary-700 border border-primary-200',
    PROCESSING: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
    ESCALATED: 'bg-danger-100 text-danger-700 border border-danger-200',
    AWAITING_INFO: 'bg-warning-100 text-warning-700 border border-warning-200',
    // Risk variants
    LOW: 'bg-success-100 text-success-700 border border-success-200',
    MEDIUM: 'bg-warning-100 text-warning-700 border border-warning-200',
    HIGH: 'bg-danger-100 text-danger-700 border border-danger-200 animate-pulse',
    // Color variants
    primary: 'bg-primary-100 text-primary-700 border border-primary-200',
    success: 'bg-success-100 text-success-700 border border-success-200',
    warning: 'bg-warning-100 text-warning-700 border border-warning-200',
    danger: 'bg-danger-100 text-danger-700 border border-danger-200',
    neutral: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  const dotColors: Record<string, string> = {
    APPROVED: 'bg-success-500',
    PENDING: 'bg-warning-500',
    DENIED: 'bg-danger-500',
    REVIEW: 'bg-primary-500',
    PROCESSING: 'bg-neutral-500',
    ESCALATED: 'bg-danger-500',
    AWAITING_INFO: 'bg-warning-500',
    LOW: 'bg-success-500',
    MEDIUM: 'bg-warning-500',
    HIGH: 'bg-danger-500',
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    neutral: 'bg-neutral-500',
  }

  const colorClass = status ? statusColors[status] : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
  const dotColor = status ? dotColors[status] : 'bg-neutral-500'

  return (
    <span className={`${baseStyles} ${colorClass} ${sizes[size]} ${className}`}>
      {variant === 'dot' && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColor}`} />
      )}
      {variant === 'pulse' && status === 'HIGH' && (
        <span className="relative flex h-2 w-2 mr-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
        </span>
      )}
      {variant === 'pulse' && status !== 'HIGH' && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColor}`} />
      )}
      {children}
    </span>
  )
}

export default Badge
