import React, { forwardRef, useState } from 'react'
import { type LucideIcon, Eye, EyeOff, Check } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: boolean
  helper?: string
  icon?: LucideIcon
  rightIcon?: LucideIcon
  floatingLabel?: boolean
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    error, 
    success, 
    helper,
    icon: Icon, 
    rightIcon: RightIcon,
    floatingLabel = false,
    type = 'text',
    className = '',
    containerClassName = '',
    disabled,
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue)

    const isPassword = type === 'password'
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value)
      props.onChange?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      props.onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      props.onBlur?.(e)
    }

    const getInputClasses = () => {
      let classes = `
        w-full bg-white border rounded-lg text-sm transition-all duration-150
        placeholder:text-neutral-400 focus:outline-none
        disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed
      `

      if (Icon) classes += ' pl-11 '
      else classes += ' pl-4 '

      if (isPassword || RightIcon || success) classes += ' pr-11 '
      else classes += ' pr-4 '

      if (floatingLabel) classes += ' pt-5 pb-2 '
      else classes += ' py-3 '

      if (error) {
        classes += 'border-danger-500 focus:border-danger-500 focus:ring-[3px] focus:ring-danger-500/25'
      } else if (success) {
        classes += 'border-success-500 focus:border-success-500 focus:ring-[3px] focus:ring-success-500/25'
      } else {
        classes += 'border-neutral-200 hover:border-neutral-300 focus:border-primary-500 focus:ring-[3px] focus:ring-primary-500/25'
      }

      return classes
    }

    return (
      <div className={`w-full ${containerClassName}`}>
        {!floatingLabel && label && (
          <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
            {label}
            {props.required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Icon className={`h-5 w-5 ${error ? 'text-danger-400' : success ? 'text-success-500' : 'text-neutral-400'}`} />
            </div>
          )}

          {floatingLabel && label && (
            <label 
              className={`
                absolute left-0 transition-all duration-150 pointer-events-none
                ${Icon ? 'left-11' : 'left-4'}
                ${(isFocused || hasValue) 
                  ? 'top-1.5 text-xs text-primary-500 font-medium' 
                  : 'top-3.5 text-sm text-neutral-400'
                }
              `}
            >
              {label}
              {props.required && <span className="text-danger-500 ml-1">*</span>}
            </label>
          )}
          
          <input
            ref={ref}
            type={inputType}
            className={`${getInputClasses()} ${className}`}
            disabled={disabled}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />

          {/* Right side icons */}
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
            {success && !RightIcon && !isPassword && (
              <Check className="h-5 w-5 text-success-500" />
            )}
            {RightIcon && !isPassword && (
              <RightIcon className="h-5 w-5 text-neutral-400" />
            )}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 rounded-md hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-neutral-500" />
                ) : (
                  <Eye className="h-4 w-4 text-neutral-500" />
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-1.5 text-sm text-danger-600 flex items-center">
            {error}
          </p>
        )}
        {helper && !error && (
          <p className="mt-1.5 text-sm text-neutral-500">
            {helper}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
