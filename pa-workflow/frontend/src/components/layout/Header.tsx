import React from 'react'
import { Bell, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export const Header: React.FC = () => {
  const { user } = useAuth()

  const getPageTitle = () => {
    const path = window.location.pathname
    if (path.includes('/provider/submit')) return 'Submit Prior Authorization'
    if (path.includes('/provider/status')) return 'PA Status'
    if (path.includes('/adjudicator/queue')) return 'Review Queue'
    if (path.includes('/adjudicator/review')) return 'Review Request'
    if (path.includes('/admin/dashboard')) return 'Dashboard'
    if (path.includes('/admin/pa-list')) return 'All PA Requests'
    if (path.includes('/admin/analytics')) return 'Analytics'
    return 'PA Workflow'
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-gray-900">{getPageTitle()}</h1>

      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
