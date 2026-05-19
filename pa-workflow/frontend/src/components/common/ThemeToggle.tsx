import React from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:border-primary-300 hover:bg-neutral-50 hover:text-neutral-900 ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      {showLabel && <span>{isDark ? 'Light' : 'Dark'} mode</span>}
    </button>
  )
}

export default ThemeToggle
