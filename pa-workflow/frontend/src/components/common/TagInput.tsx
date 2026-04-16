import React, { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { X, Plus, Search } from 'lucide-react'

export interface Tag {
  id: string
  value: string
  label?: string
}

export interface TagInputProps {
  tags: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  placeholder?: string
  suggestions?: Array<{ value: string; label: string }>
  validate?: (value: string) => boolean
  formatValue?: (value: string) => string
  maxTags?: number
  className?: string
  tagColor?: 'primary' | 'success' | 'warning' | 'neutral'
  inputClassName?: string
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onAdd,
  onRemove,
  placeholder = 'Type and press Enter...',
  suggestions = [],
  validate,
  formatValue = (v) => v.trim().toUpperCase(),
  maxTags,
  className = '',
  tagColor = 'primary',
  inputClassName = '',
}) => {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredSuggestions = suggestions.filter(
    (s) => 
      s.value.toLowerCase().includes(inputValue.toLowerCase()) ||
      s.label.toLowerCase().includes(inputValue.toLowerCase())
  ).filter((s) => !tags.includes(s.value))

  const handleAdd = useCallback((value: string) => {
    const formatted = formatValue(value)
    if (!formatted) return
    
    if (maxTags && tags.length >= maxTags) return
    if (tags.includes(formatted)) return
    if (validate && !validate(formatted)) return
    
    onAdd(formatted)
    setInputValue('')
    setShowSuggestions(false)
    setHighlightedIndex(-1)
  }, [tags, maxTags, validate, formatValue, onAdd])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        handleAdd(filteredSuggestions[highlightedIndex].value)
      } else if (inputValue.trim()) {
        handleAdd(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightedIndex(-1)
    }
  }

  const tagColors = {
    primary: 'bg-primary-100 text-primary-700 border-primary-200',
    success: 'bg-success-100 text-success-700 border-success-200',
    warning: 'bg-warning-100 text-warning-700 border-warning-200',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  }

  const focusInput = () => {
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={focusInput}
        className={`
          min-h-[48px] w-full bg-white border border-neutral-200 rounded-lg px-3 py-2
          flex flex-wrap items-center gap-2 cursor-text transition-all duration-150
          hover:border-neutral-300 focus-within:border-primary-500 focus-within:ring-[3px] focus-within:ring-primary-500/25
          ${inputClassName}
        `}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium
              border ${tagColors[tagColor]} transition-all duration-150
            `}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(tag)
              }}
              className="p-0.5 rounded-full hover:bg-black/10 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-500"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(e.target.value.length > 0 && filteredSuggestions.length > 0)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && filteredSuggestions.length > 0 && setShowSuggestions(true)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm py-1 placeholder:text-neutral-400"
        />
        
        <Plus className="w-4 h-4 text-neutral-400 flex-shrink-0" />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-elevated max-h-60 overflow-auto">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Suggestions
            </div>
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.value}
                type="button"
                onClick={() => handleAdd(suggestion.value)}
                className={`
                  w-full px-3 py-2 text-left text-sm transition-colors
                  ${index === highlightedIndex ? 'bg-primary-50 text-primary-700' : 'hover:bg-neutral-50'}
                `}
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-neutral-400" />
                  <span className="font-medium">{suggestion.value}</span>
                  <span className="text-neutral-500">-</span>
                  <span className="text-neutral-600 truncate">{suggestion.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Max Tags Warning */}
      {maxTags && tags.length >= maxTags && (
        <p className="mt-1.5 text-xs text-warning-600">
          Maximum {maxTags} tags allowed
        </p>
      )}
    </div>
  )
}

export default TagInput
