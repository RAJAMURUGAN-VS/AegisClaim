import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number
}

interface NotificationContextType {
  notifications: Notification[]
  showNotification: (notification: Omit<Notification, 'id'>) => void
  dismissNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const showNotification = useCallback(
    (notification: Omit<Notification, 'id'>): void => {
      const id = Math.random().toString(36).substring(2, 9)
      const newNotification = { ...notification, id }

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

  const value: NotificationContextType = {
    notifications,
    showNotification,
    dismissNotification,
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
