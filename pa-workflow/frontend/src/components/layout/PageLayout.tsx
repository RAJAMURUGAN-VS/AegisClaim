import React from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export interface PageLayoutProps {
  children: React.ReactNode
  title?: string
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, title }) => {
  // Update document title if provided
  React.useEffect(() => {
    if (title) {
      document.title = `${title} | AegisClaim`
    } else {
      document.title = 'AegisClaim | PA Workflow'
    }
  }, [title])

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        <Header />
        <main className="flex-1 bg-background p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default PageLayout
