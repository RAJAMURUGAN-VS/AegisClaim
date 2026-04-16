import React, { useState, useEffect, useRef } from 'react'
import { 
  Bell, 
  User, 
  ChevronDown, 
  LogOut, 
  Settings, 
  Search, 
  Menu,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  FileText,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export interface HeaderProps {
  onMenuToggle: () => void
  isSidebarCollapsed: boolean
}

// Mock notifications for the design
const mockNotifications = [
  { id: 1, type: 'success', message: 'PA Request #12345 has been approved', time: '2 min ago', icon: CheckCircle },
  { id: 2, type: 'warning', message: 'High risk flag on PA Request #12350', time: '15 min ago', icon: AlertTriangle },
  { id: 3, type: 'info', message: 'New PA request submitted by Dr. Smith', time: '1 hour ago', icon: FileText },
  { id: 4, type: 'info', message: 'System maintenance scheduled for tonight', time: '2 hours ago', icon: Info },
  { id: 5, type: 'warning', message: 'Pending review queue exceeds 10 items', time: '3 hours ago', icon: Clock },
]

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, isSidebarCollapsed }) => {
  const { user, logout } = useAuth()
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [pageTitle, setPageTitle] = useState('Dashboard')
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([])
  const [hasNewNotification, setHasNewNotification] = useState(true)
  
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)

  // Update page title based on current route
  useEffect(() => {
    const updatePageInfo = () => {
      const path = window.location.pathname
      const pathParts = path.split('/').filter(Boolean)
      
      // Set breadcrumbs
      const crumbs = pathParts.map(part => 
        part.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      )
      setBreadcrumbs(crumbs)
      
      // Set page title
      if (path.includes('/provider/submit')) setPageTitle('Submit Prior Authorization')
      else if (path.includes('/provider/status')) setPageTitle('My Requests')
      else if (path.includes('/adjudicator/queue')) setPageTitle('Review Queue')
      else if (path.includes('/adjudicator/review')) setPageTitle('Review Request')
      else if (path.includes('/admin/dashboard')) setPageTitle('Dashboard')
      else if (path.includes('/admin/pa-list')) setPageTitle('All PA Requests')
      else if (path.includes('/admin/analytics')) setPageTitle('Analytics')
      else setPageTitle('Dashboard')
    }

    updatePageInfo()
    window.addEventListener('popstate', updatePageInfo)
    return () => window.removeEventListener('popstate', updatePageInfo)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setIsUserDropdownOpen(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setIsNotificationOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success': return 'bg-success-100 text-success-600'
      case 'warning': return 'bg-warning-100 text-warning-600'
      case 'error': return 'bg-danger-100 text-danger-600'
      default: return 'bg-primary-100 text-primary-600'
    }
  }

  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      {/* Left side - Mobile menu toggle + Breadcrumb */}
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Title & Breadcrumb */}
        <div className="hidden sm:block">
          {breadcrumbs.length > 1 && (
            <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-0.5">
              {breadcrumbs.slice(0, -1).map((crumb, index) => (
                <React.Fragment key={index}>
                  <span className="hover:text-primary-600 cursor-pointer transition-colors">{crumb}</span>
                  <ChevronRight className="w-3 h-3" />
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="text-lg font-semibold text-neutral-900">{pageTitle}</h1>
        </div>
        
        {/* Mobile: Just show title */}
        <h1 className="sm:hidden text-base font-semibold text-neutral-900">{pageTitle}</h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Search Button */}
        <button 
          className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
          <span className="hidden md:inline">Search</span>
          <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-neutral-400 bg-neutral-100 rounded border border-neutral-200">
            ⌘K
          </kbd>
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => {
              setIsNotificationOpen(!isNotificationOpen)
              setHasNewNotification(false)
            }}
            className={`
              relative p-2 rounded-lg transition-all duration-200
              ${isNotificationOpen 
                ? 'bg-primary-50 text-primary-600' 
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }
              ${hasNewNotification ? 'animate-shake' : ''}
            `}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {hasNewNotification && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-danger-500 rounded-full">
                <span className="absolute inset-0 rounded-full bg-danger-500 animate-ping opacity-75"></span>
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {isNotificationOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-elevated border border-neutral-200 py-2 z-50 animate-fade-in">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-neutral-900">Notifications</h3>
                <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  Mark all read
                </button>
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {mockNotifications.map((notification) => {
                  const Icon = notification.icon
                  return (
                    <button
                      key={notification.id}
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-neutral-50 transition-colors text-left"
                    >
                      <div className={`p-2 rounded-lg flex-shrink-0 ${getNotificationStyles(notification.type)}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-900 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-neutral-500 mt-1">{notification.time}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              
              <div className="px-4 py-2 border-t border-neutral-100">
                <button className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium py-2">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className={`
              flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-all duration-200
              ${isUserDropdownOpen 
                ? 'bg-primary-50 text-primary-600' 
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }
            `}
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-neutral-900">{user?.name}</p>
              <p className="text-xs text-neutral-500 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* User Dropdown Menu */}
          {isUserDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-elevated border border-neutral-200 py-2 z-50 animate-fade-in">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{user?.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 capitalize mt-2 px-0.5">
                  {user?.role?.toLowerCase().replace('_', ' ')}
                </p>
              </div>
              
              {/* Menu Items */}
              <div className="py-1">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                  <User className="w-4 h-4 text-neutral-400" />
                  Profile
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                  <Settings className="w-4 h-4 text-neutral-400" />
                  Settings
                </button>
              </div>
              
              {/* Logout */}
              <div className="border-t border-neutral-100 pt-1 mt-1">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
