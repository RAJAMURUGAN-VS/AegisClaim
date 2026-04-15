import React, { useState, useEffect } from 'react'
import { Bell, User, ChevronDown, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'

export const Header: React.FC = () => {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [pageTitle, setPageTitle] = useState('PA Workflow')

  // Update page title based on current route
  useEffect(() => {
    const updatePageTitle = () => {
      const path = window.location.pathname
      if (path.includes('/provider/submit')) setPageTitle('Submit Prior Authorization')
      else if (path.includes('/provider/status')) setPageTitle('My Requests')
      else if (path.includes('/adjudicator/queue')) setPageTitle('Review Queue')
      else if (path.includes('/adjudicator/completed')) setPageTitle('Completed Reviews')
      else if (path.includes('/adjudicator/review')) setPageTitle('Review Request')
      else if (path.includes('/admin/dashboard')) setPageTitle('Dashboard')
      else if (path.includes('/admin/pa-list')) setPageTitle('All PA Requests')
      else if (path.includes('/admin/analytics')) setPageTitle('Analytics')
      else setPageTitle('PA Workflow')
    }

    updatePageTitle()
    // Listen for route changes
    window.addEventListener('popstate', updatePageTitle)
    return () => window.removeEventListener('popstate', updatePageTitle)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.user-dropdown')) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
      <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>

      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-danger text-white text-xs font-medium rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Avatar with Dropdown */}
        <div className="relative user-dropdown">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-card border border-gray-100 py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <p className="text-xs text-gray-400 capitalize mt-1">{user?.role?.toLowerCase()}</p>
              </div>
              <button
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings className="w-4 h-4 mr-2" />
                Profile
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center px-4 py-2 text-sm text-danger hover:bg-danger/5"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
