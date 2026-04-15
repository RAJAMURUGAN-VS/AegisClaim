import React from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface PageLayoutProps {
  children: React.ReactNode
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 bg-background p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default PageLayout
