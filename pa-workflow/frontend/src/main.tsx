import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.tsx'
import './index.css'
import { NotificationProvider } from './context/NotificationContext'
import { ThemeProvider, applyThemeToDocument } from './context/ThemeContext'

const themeKey = 'aegisclaim-theme'

if (typeof window !== 'undefined') {
  const storedTheme = window.localStorage.getItem(themeKey)
  const preferredTheme =
    storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

  applyThemeToDocument(preferredTheme)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
)
