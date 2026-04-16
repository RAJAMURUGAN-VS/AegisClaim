import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ClipboardList,
  LayoutDashboard,
  List,
  BarChart3,
  LogOut,
  Shield,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  Bell,
  X,
  PlusCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface NavItem {
  path: string
  label: string
  icon: React.ElementType
  badge?: number
  children?: { path: string; label: string; icon: React.ElementType }[]
}

export interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  isMobileOpen: boolean
  onMobileClose: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  isMobileOpen,
  onMobileClose,
}) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const getNavItems = (): NavItem[] => {
    switch (user?.role) {
      case 'PROVIDER':
        return [
          { path: '/provider/dashboard', label: 'Dashboard', icon: Home },
          {
            path: '/provider/requests',
            label: 'PA Requests',
            icon: ClipboardList,
            children: [
              { path: '/provider/submit', label: 'Submit New', icon: PlusCircle },
              { path: '/provider/status', label: 'My Requests', icon: ClipboardList },
            ],
          },
        ]
      case 'ADJUDICATOR':
        return [
          { path: '/adjudicator/dashboard', label: 'Dashboard', icon: Home },
          { 
            path: '/adjudicator/queue', 
            label: 'Review Queue', 
            icon: List,
            badge: 3,
          },
          { path: '/adjudicator/completed', label: 'Completed', icon: CheckCircle },
        ]
      case 'ADMIN':
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/admin/pa-list', label: 'All PAs', icon: List },
          { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        ]
      default:
        return []
    }
  }

  const navItems = getNavItems()

  const toggleMenu = (path: string) => {
    setExpandedMenus((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64'
  const mobileSidebarClasses = isMobileOpen
    ? 'translate-x-0'
    : '-translate-x-full'

  // Desktop Sidebar Content
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={`h-16 flex items-center px-4 border-b border-primary-800 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <span className="text-lg font-bold text-white whitespace-nowrap">AegisClaim</span>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-primary-300 hover:text-white hover:bg-primary-800 transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-16 w-6 h-6 bg-primary-700 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition-colors shadow-md"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 overflow-y-auto">
        {/* Main Menu Section */}
        {!isCollapsed && (
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
              Main Menu
            </span>
          </div>
        )}
        
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.path)}
                    className={`
                      w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group
                      ${isActive(item.path) 
                        ? 'bg-primary-700 text-white' 
                        : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="ml-3 flex-1 text-sm font-medium text-left">{item.label}</span>
                        <ChevronRight 
                          className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.includes(item.path) ? 'rotate-90' : ''}`} 
                        />
                      </>
                    )}
                    
                    {/* Tooltip for collapsed */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                        {item.label}
                      </div>
                    )}
                  </button>
                  
                  {/* Submenu */}
                  {!isCollapsed && expandedMenus.includes(item.path) && (
                    <ul className="mt-1 ml-4 pl-4 border-l-2 border-primary-800 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <NavLink
                            to={child.path}
                            className={({ isActive: childActive }) =>
                              `flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                childActive
                                  ? 'bg-primary-700 text-white'
                                  : 'text-primary-400 hover:bg-primary-800 hover:text-white'
                              }`
                            }
                          >
                            <child.icon className="w-4 h-4 mr-2" />
                            {child.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive: active }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                      active
                        ? 'bg-primary-700 text-white'
                        : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="ml-3 flex-1 text-sm font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="px-2 py-0.5 bg-danger-500 text-white text-xs font-bold rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  
                  {/* Tooltip for collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                      {item.label}
                    </div>
                  )}
                  
                  {/* Active indicator */}
                  {!isCollapsed && isActive(item.path) && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                  )}
                </NavLink>
              )}
            </li>
          ))}
        </ul>

        {/* Settings Section */}
        {!isCollapsed && (
          <div className="mt-8 px-3 mb-2">
            <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
              Settings
            </span>
          </div>
        )}
        <ul className="space-y-1 mt-2">
          <li>
            <NavLink
              to="/preferences"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="ml-3 flex-1 text-sm font-medium">Preferences</span>
                </>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                  Preferences
                </div>
              )}
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <Bell className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="ml-3 flex-1 text-sm font-medium">Notifications</span>
                  <span className="px-2 py-0.5 bg-danger-500 text-white text-xs font-bold rounded-full">
                    5
                  </span>
                </>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                  Notifications
                </div>
              )}
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* User Card */}
      <div className={`p-4 border-t border-primary-800 ${isCollapsed ? 'px-2' : ''}`}>
        <div className={`bg-primary-800 rounded-xl p-3 ${isCollapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-white">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-primary-400 capitalize truncate">{user?.role?.toLowerCase()}</p>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <button
              onClick={logout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary-300 hover:text-white hover:bg-primary-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
          
          {isCollapsed && (
            <button
              onClick={logout}
              className="mt-2 w-full flex items-center justify-center p-2 text-primary-300 hover:text-white hover:bg-primary-700 rounded-lg transition-colors group relative"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                Logout
              </div>
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed h-full bg-primary-900 text-white transition-all duration-200 ease-smooth z-40 ${sidebarWidth}`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Drawer */}
      <>
        {/* Backdrop */}
        {isMobileOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
            onClick={onMobileClose}
          />
        )}
        
        {/* Mobile Drawer */}
        <aside
          className={`lg:hidden fixed inset-y-0 left-0 w-72 bg-primary-900 text-white flex flex-col z-50 transform transition-transform duration-300 ease-smooth ${mobileSidebarClasses}`}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-primary-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">AegisClaim</span>
            </div>
            <button
              onClick={onMobileClose}
              className="p-2 rounded-lg text-primary-300 hover:text-white hover:bg-primary-800 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 py-6">
            <div className="px-3 mb-2">
              <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
                Main Menu
              </span>
            </div>
            
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.path}>
                  {item.children ? (
                    <div>
                      <button
                        onClick={() => toggleMenu(item.path)}
                        className={`
                          w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200
                          ${isActive(item.path) 
                            ? 'bg-primary-700 text-white' 
                            : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                          }
                        `}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="ml-3 flex-1 text-sm font-medium text-left">{item.label}</span>
                        <ChevronRight 
                          className={`w-4 h-4 transition-transform duration-200 ${expandedMenus.includes(item.path) ? 'rotate-90' : ''}`} 
                        />
                      </button>
                      
                      {expandedMenus.includes(item.path) && (
                        <ul className="mt-1 ml-4 pl-4 border-l-2 border-primary-800 space-y-1">
                          {item.children.map((child) => (
                            <li key={child.path}>
                              <NavLink
                                to={child.path}
                                onClick={onMobileClose}
                                className={({ isActive: childActive }) =>
                                  `flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                    childActive
                                      ? 'bg-primary-700 text-white'
                                      : 'text-primary-400 hover:bg-primary-800 hover:text-white'
                                  }`
                                }
                              >
                                <child.icon className="w-4 h-4 mr-2" />
                                {child.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <NavLink
                      to={item.path}
                      onClick={onMobileClose}
                      className={({ isActive: active }) =>
                        `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 relative ${
                          active
                            ? 'bg-primary-700 text-white'
                            : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="ml-3 flex-1 text-sm font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="px-2 py-0.5 bg-danger-500 text-white text-xs font-bold rounded-full">
                          {item.badge}
                        </span>
                      )}
                      {isActive(item.path) && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                      )}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
            
            <div className="mt-8 px-3 mb-2">
              <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
                Settings
              </span>
            </div>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/preferences"
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-700 text-white'
                        : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                    }`
                  }
                >
                  <Settings className="w-5 h-5" />
                  <span className="ml-3 text-sm font-medium">Preferences</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/notifications"
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-700 text-white'
                        : 'text-primary-300 hover:bg-primary-800 hover:text-white'
                    }`
                  }
                >
                  <Bell className="w-5 h-5" />
                  <span className="ml-3 text-sm font-medium">Notifications</span>
                  <span className="ml-auto px-2 py-0.5 bg-danger-500 text-white text-xs font-bold rounded-full">
                    5
                  </span>
                </NavLink>
              </li>
            </ul>
          </div>
          
          {/* Mobile User Card */}
          <div className="p-4 border-t border-primary-800">
            <div className="bg-primary-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-primary-400 capitalize truncate">{user?.role?.toLowerCase()}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary-300 hover:text-white hover:bg-primary-700 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </aside>
      </>
    </>
  )
}

export default Sidebar
