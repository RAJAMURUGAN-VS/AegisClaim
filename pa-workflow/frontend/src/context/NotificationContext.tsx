import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number
  isRead?: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  showNotification: (notification: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length
  }, [notifications])

  const showNotification = useCallback(
    (notification: Omit<Notification, 'id'>): void => {
      const id = Math.random().toString(36).substring(2, 9)
      const newNotification = { ...notification, id, isRead: false }

      setNotifications((prev) => [...prev, newNotification])

      // Auto-dismiss after duration
      if (notification.duration !== 0) {
        setTimeout(() => {
          dismissNotification(id)
        }, notification.duration || 5000)
      }
    },
    []
  )

  const dismissNotification = useCallback((id: string): void => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const markAsRead = useCallback((id: string): void => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback((): void => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }, [])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    showNotification,
    dismissNotification,
    markAsRead,
    markAllAsRead,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// Custom hook to use notification context
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export default NotificationContext
