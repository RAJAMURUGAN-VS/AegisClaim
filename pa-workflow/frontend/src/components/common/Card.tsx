import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  variant?: 'default' | 'hover' | 'bordered' | 'gradient'
  collapsible?: boolean
  defaultExpanded?: boolean
  headerClassName?: string
  bodyClassName?: string
  gradientFrom?: string
  gradientTo?: string
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  actions,
  variant = 'default',
  collapsible = false,
  defaultExpanded = true,
  headerClassName = '',
  bodyClassName = '',
  gradientFrom = 'from-primary-700',
  gradientTo = 'to-primary-500',
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)

  const baseStyles = 'bg-white rounded-xl overflow-hidden transition-all duration-200'

  const variants = {
    default: 'shadow-card',
    hover: 'shadow-card hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
    bordered: 'shadow-card border border-neutral-200',
    gradient: `bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white shadow-lg`,
  }

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded)
    }
  }

  const hasHeader = title || subtitle || actions

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`}>
      {hasHeader && (
        <div 
          className={`px-6 py-4 flex justify-between items-start ${collapsible ? 'cursor-pointer' : ''} ${headerClassName}`}
          onClick={collapsible ? toggleExpanded : undefined}
        >
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className={`text-base font-semibold ${variant === 'gradient' ? 'text-white' : 'text-neutral-900'}`}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={`mt-1 text-sm ${variant === 'gradient' ? 'text-white/80' : 'text-neutral-500'}`}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {actions}
            {collapsible && (
              <button 
                className={`p-1 rounded-lg transition-colors ${variant === 'gradient' ? 'hover:bg-white/20' : 'hover:bg-neutral-100'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpanded()
                }}
              >
                {isExpanded ? (
                  <ChevronUp className={`w-5 h-5 ${variant === 'gradient' ? 'text-white' : 'text-neutral-500'}`} />
                ) : (
                  <ChevronDown className={`w-5 h-5 ${variant === 'gradient' ? 'text-white' : 'text-neutral-500'}`} />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {(!collapsible || isExpanded) && (
        <div className={`p-6 ${hasHeader ? 'pt-0' : ''} ${bodyClassName}`}>
          {children}
        </div>
      )}
    </div>
  )
}

export default Card
