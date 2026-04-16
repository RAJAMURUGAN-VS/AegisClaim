import React from 'react'

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  className?: string
  animation?: 'pulse' | 'wave' | 'none'
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'pulse',
}) => {
  const baseStyles = 'bg-neutral-200'

  const variants = {
    text: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-xl',
  }

  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  }

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  }

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${animations[animation]} ${className}`}
      style={style}
    />
  )
}

// Pre-built skeleton layouts
export interface SkeletonCardProps {
  lines?: number
  hasHeader?: boolean
  hasAction?: boolean
  className?: string
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  hasHeader = true,
  hasAction = false,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-card ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="text" width="40%" height={24} />
          {hasAction && <Skeleton variant="rounded" width={80} height={32} />}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            variant="text" 
            width={i === lines - 1 ? '70%' : '100%'} 
            height={16} 
          />
        ))}
      </div>
    </div>
  )
}

// KPI Card Skeleton
export interface SkeletonKpiCardProps {
  className?: string
}

export const SkeletonKpiCard: React.FC<SkeletonKpiCardProps> = ({ className = '' }) => {
  return (
    <div className={`bg-white rounded-xl p-6 shadow-card ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton variant="text" width="60%" height={16} />
          <Skeleton variant="text" width="40%" height={40} />
          <Skeleton variant="text" width="30%" height={16} />
        </div>
        <Skeleton variant="circular" width={48} height={48} />
      </div>
    </div>
  )
}

// Table Skeleton
export interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex gap-4 pb-4 border-b border-neutral-200">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="flex-1">
            <Skeleton variant="text" width="70%" height={16} />
          </div>
        ))}
      </div>
      {/* Rows */}
      <div className="space-y-4 pt-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-4 items-center">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={`cell-${rowIndex}-${colIndex}`} className="flex-1">
                <Skeleton 
                  variant="text" 
                  width={colIndex === 0 ? '80%' : colIndex === columns - 1 ? '50%' : '90%'} 
                  height={16} 
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Page Skeleton
export interface SkeletonPageProps {
  className?: string
}

export const SkeletonPage: React.FC<SkeletonPageProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rounded" width={120} height={40} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonCard lines={4} hasHeader hasAction />
        </div>
        <SkeletonCard lines={3} hasHeader />
      </div>
    </div>
  )
}

export default Skeleton
