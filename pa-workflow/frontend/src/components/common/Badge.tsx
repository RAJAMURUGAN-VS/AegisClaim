import React from 'react'
import type { PAStatus } from '../../types/pa.types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center rounded-full font-medium'

  const variants = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-secondary/10 text-secondary',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  )
}

// Status badge for PA status
interface StatusBadgeProps {
  status: PAStatus
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig: Record<PAStatus, { variant: BadgeProps['variant']; label: string }> = {
    DRAFT: { variant: 'default', label: 'Draft' },
    SUBMITTED: { variant: 'info', label: 'Submitted' },
    IN_REVIEW: { variant: 'primary', label: 'In Review' },
    PENDING_INFO: { variant: 'warning', label: 'Pending Info' },
    AGENT_PROCESSING: { variant: 'primary', label: 'Processing' },
    ESCALATED: { variant: 'warning', label: 'Escalated' },
    APPROVED: { variant: 'success', label: 'Approved' },
    DENIED: { variant: 'danger', label: 'Denied' },
    EXPIRED: { variant: 'default', label: 'Expired' },
    CANCELLED: { variant: 'default', label: 'Cancelled' },
  }

  const config = statusConfig[status] || { variant: 'default', label: status }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

export default Badge
