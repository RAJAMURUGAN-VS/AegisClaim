import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const THEME_STORAGE_KEY = 'aegisclaim-theme'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

const getSystemTheme = () => {
  if (typeof window === 'undefined') {
    return 'light' as const
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const getResolvedTheme = (theme: ThemeMode) => (theme === 'system' ? getSystemTheme() : theme)

export const applyThemeToDocument = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.toggle('theme-dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.body.dataset.theme = theme
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'system'
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme
    }

    return 'system'
  })
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => getResolvedTheme(theme))

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      setThemeState(storedTheme)
      return
    }

    setThemeState('system')
  }, [])

  useEffect(() => {
    const nextResolvedTheme = getResolvedTheme(theme)
    setResolvedTheme(nextResolvedTheme)
    applyThemeToDocument(nextResolvedTheme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)

    if (theme !== 'system') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const updatedTheme = getResolvedTheme('system')
      setResolvedTheme(updatedTheme)
      applyThemeToDocument(updatedTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme)
  }

  const toggleTheme = () => {
    setThemeState((current) => (getResolvedTheme(current) === 'dark' ? 'light' : 'dark'))
  }

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
