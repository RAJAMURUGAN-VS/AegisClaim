import React from 'react'
import { 
  ClipboardList, 
  Inbox, 
  Search,
  FileText,
  AlertCircle,
  LucideIcon 
} from 'lucide-react'
import { Button } from './Button'

export type EmptyStateVariant = 
  | 'default' 
  | 'search' 
  | 'queue' 
  | 'inbox' 
  | 'documents' 
  | 'error'

export interface EmptyStateProps {
  variant?: EmptyStateVariant
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
  className?: string
}

const variantConfig: Record<EmptyStateVariant, { icon: LucideIcon; defaultTitle: string; defaultDescription: string }> = {
  default: {
    icon: Inbox,
    defaultTitle: 'No items found',
    defaultDescription: 'There are no items to display at this time.',
  },
  search: {
    icon: Search,
    defaultTitle: 'No results found',
    defaultDescription: 'Try adjusting your search terms or filters to find what you\'re looking for.',
  },
  queue: {
    icon: ClipboardList,
    defaultTitle: 'Queue is empty',
    defaultDescription: 'Great job! There are no items in your review queue right now.',
  },
  inbox: {
    icon: Inbox,
    defaultTitle: 'No messages',
    defaultDescription: 'Your inbox is empty. New notifications will appear here.',
  },
  documents: {
    icon: FileText,
    defaultTitle: 'No documents',
    defaultDescription: 'No documents have been uploaded yet. Upload files to get started.',
  },
  error: {
    icon: AlertCircle,
    defaultTitle: 'Something went wrong',
    defaultDescription: 'We encountered an error while loading your data. Please try again.',
  },
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'default',
  title,
  description,
  actionLabel,
  onAction,
  icon: CustomIcon,
  className = '',
}) => {
  const config = variantConfig[variant]
  const Icon = CustomIcon || config.icon

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-primary-500" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        {title || config.defaultTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-neutral-500 max-w-sm mb-6">
        {description || config.defaultDescription}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <Button 
          variant="primary" 
          onClick={onAction}
          icon={variant === 'search' ? Search : undefined}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// Compact version for inline use
export interface EmptyStateCompactProps {
  icon?: LucideIcon
  message: string
  className?: string
}

export const EmptyStateCompact: React.FC<EmptyStateCompactProps> = ({
  icon: Icon = Inbox,
  message,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-center gap-3 py-6 px-4 text-neutral-500 ${className}`}>
      <Icon className="w-5 h-5" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

export default EmptyState
