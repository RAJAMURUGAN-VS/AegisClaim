import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  FileText,
  ClipboardList,
  LayoutDashboard,
  List,
  BarChart3,
  LogOut,
  Shield,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth()

  const getNavItems = () => {
    switch (user?.role) {
      case 'PROVIDER':
        return [
          { path: '/provider/submit', label: 'Submit PA', icon: FileText },
          { path: '/provider/status', label: 'Track Status', icon: ClipboardList },
        ]
      case 'ADJUDICATOR':
        return [
          { path: '/adjudicator/queue', label: 'Review Queue', icon: List },
        ]
      case 'ADMIN':
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/admin/pa-list', label: 'All PA Requests', icon: List },
          { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        ]
      default:
        return []
    }
  }

  const navItems = getNavItems()

  return (
    <aside className="w-64 bg-primary text-white flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-primary-light">
        <Shield className="w-8 h-8 mr-3 text-secondary" />
        <span className="text-lg font-bold">PA Workflow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-secondary text-white'
                      : 'text-gray-300 hover:bg-primary-light hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-primary-light">
        <div className="mb-4">
          <p className="text-sm font-medium text-white">{user?.name}</p>
          <p className="text-xs text-gray-400">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center w-full px-4 py-2 text-gray-300 hover:bg-primary-light hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
