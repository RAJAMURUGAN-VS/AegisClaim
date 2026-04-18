import React, { forwardRef, useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, AlertCircle } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  label?: string
  error?: string
  helper?: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  required?: boolean
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  className?: string
  containerClassName?: string
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      label,
      error,
      helper,
      options,
      placeholder = 'Select an option',
      disabled = false,
      loading = false,
      required = false,
      value,
      onChange,
      onBlur,
      className = '',
      containerClassName = '',
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const selectedOption = options.find((opt) => opt.value === value)

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          onBlur?.()
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onBlur])

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (isOpen && highlightedIndex >= 0) {
            const option = options[highlightedIndex]
            if (!option.disabled) {
              onChange?.(option.value)
              setIsOpen(false)
            }
          } else {
            setIsOpen(!isOpen)
          }
          break
        case 'Escape':
          setIsOpen(false)
          onBlur?.()
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
          }
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
          break
        case 'Tab':
          if (isOpen) {
            setIsOpen(false)
            onBlur?.()
          }
          break
      }
    }

    const handleOptionClick = (option: SelectOption) => {
      if (option.disabled) return
      onChange?.(option.value)
      setIsOpen(false)
      onBlur?.()
    }

    return (
      <div ref={containerRef} className={`w-full ${containerClassName}`}>
        {label && (
          <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
            {label}
            {required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <button
            ref={ref}
            type="button"
            onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            className={`
              w-full bg-white border rounded-lg text-sm transition-all duration-150
              focus:outline-none focus:ring-[3px] text-left
              disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed
              flex items-center justify-between
              ${error 
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/25' 
                : 'border-neutral-200 hover:border-neutral-300 focus:border-primary-500 focus:ring-primary-500/25'
              }
              ${isOpen ? 'border-primary-500 ring-[3px] ring-primary-500/25' : ''}
              ${className}
            `}
            style={{ padding: '0.625rem 0.75rem' }}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <span className={`truncate ${!selectedOption ? 'text-neutral-400' : 'text-neutral-900'}`}>
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2 text-neutral-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                selectedOption?.label || placeholder
              )}
            </span>
            <ChevronDown 
              className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div 
              className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-auto"
              role="listbox"
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-neutral-400 text-center">
                  No options available
                </div>
              ) : (
                options.map((option, index) => (
                  <div
                    key={option.value}
                    onClick={() => handleOptionClick(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`
                      px-3 py-2 text-sm cursor-pointer flex items-center justify-between
                      transition-colors duration-100
                      ${option.disabled 
                        ? 'text-neutral-300 cursor-not-allowed' 
                        : 'hover:bg-neutral-50 text-neutral-700'
                      }
                      ${highlightedIndex === index ? 'bg-neutral-50' : ''}
                      ${value === option.value ? 'bg-primary-50 text-primary-700' : ''}
                      ${index === 0 ? 'rounded-t-lg' : ''}
                      ${index === options.length - 1 ? 'rounded-b-lg' : ''}
                    `}
                    role="option"
                    aria-selected={value === option.value}
                    aria-disabled={option.disabled}
                  >
                    <span className="truncate">{option.label}</span>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-primary-600 flex-shrink-0 ml-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-sm text-danger-600 flex items-center">
            <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
            {error}
          </p>
        )}
        {helper && !error && (
          <p className="mt-1.5 text-sm text-neutral-500">{helper}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
