import React, { useEffect, useState, useCallback } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  LucideIcon 
} from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

export interface ToastProps {
  toast: Toast
  onRemove: (id: string) => void
}

const toastConfig: Record<ToastType, { icon: LucideIcon; colors: string; progressColor: string }> = {
  success: {
    icon: CheckCircle,
    colors: 'bg-success-50 border-success-200 text-success-800',
    progressColor: 'bg-success-500',
  },
  error: {
    icon: XCircle,
    colors: 'bg-danger-50 border-danger-200 text-danger-800',
    progressColor: 'bg-danger-500',
  },
  warning: {
    icon: AlertTriangle,
    colors: 'bg-warning-50 border-warning-200 text-warning-800',
    progressColor: 'bg-warning-500',
  },
  info: {
    icon: Info,
    colors: 'bg-primary-50 border-primary-200 text-primary-800',
    progressColor: 'bg-primary-500',
  },
}

export const ToastItem: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [progress, setProgress] = useState(100)
  const [isExiting, setIsExiting] = useState(false)
  const duration = toast.duration || 4000
  const config = toastConfig[toast.type]
  const Icon = config.icon

  useEffect(() => {
    const startTime = Date.now()
    const endTime = startTime + duration

    const updateProgress = () => {
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)
      const newProgress = (remaining / duration) * 100

      if (newProgress <= 0) {
        handleRemove()
      } else {
        setProgress(newProgress)
        requestAnimationFrame(updateProgress)
      }
    }

    const animationFrame = requestAnimationFrame(updateProgress)
    return () => cancelAnimationFrame(animationFrame)
  }, [duration])

  const handleRemove = () => {
    setIsExiting(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div
      className={`
        relative w-full max-w-sm rounded-xl border shadow-elevated overflow-hidden
        transition-all duration-300 ease-smooth
        ${config.colors}
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{toast.title}</h4>
          {toast.message && (
            <p className="text-sm mt-1 opacity-90">{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="h-1 bg-black/5">
        <div
          className={`h-full ${config.progressColor} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// Toast Container Component
export interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'success', title, message, duration })
  }, [addToast])

  const error = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'error', title, message, duration })
  }, [addToast])

  const warning = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'warning', title, message, duration })
  }, [addToast])

  const info = useCallback((title: string, message?: string, duration?: number) => {
    return addToast({ type: 'info', title, message, duration })
  }, [addToast])

  return { toasts, addToast, removeToast, success, error, warning, info }
}

export default ToastItem
