import React, { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export interface PageLayoutProps {
  children: React.ReactNode
  title?: string
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, title }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  // Update document title if provided
  useEffect(() => {
    if (title) {
      document.title = `${title} | AegisClaim`
    } else {
      document.title = 'AegisClaim | PA Workflow'
    }
  }, [title])

  // Handle responsive sidebar on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        // Auto collapse on tablet/mobile
        setIsSidebarCollapsed(true)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const sidebarWidth = isSidebarCollapsed ? 'md:ml-16 lg:ml-16' : 'md:ml-64 lg:ml-64'

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content */}
      <main
        className={`flex-1 min-h-screen overflow-x-hidden transition-all duration-200 ease-smooth z-0 ${sidebarWidth}`}
      >
        <Header 
          onMenuToggle={() => setIsMobileSidebarOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
        />
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </main>
    </div>
  )
}

export default PageLayout
