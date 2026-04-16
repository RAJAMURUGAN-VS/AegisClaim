import React from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 ease-smooth focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]'

  const variants = {
    primary: 'bg-gradient-to-r from-primary-700 to-primary-500 text-white hover:from-primary-800 hover:to-primary-600 focus:ring-primary-500 shadow-sm hover:shadow-md',
    secondary: 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 focus:ring-neutral-500',
    danger: 'bg-gradient-to-r from-danger-700 to-danger-500 text-white hover:from-danger-800 hover:to-danger-600 focus:ring-danger-500 shadow-sm hover:shadow-md',
    success: 'bg-gradient-to-r from-success-700 to-success-500 text-white hover:from-success-800 hover:to-success-600 focus:ring-success-500 shadow-sm hover:shadow-md',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-neutral-400',
  }

  const sizes = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const renderIcon = () => {
    if (loading) {
      return <Loader2 className={`${iconSizes[size]} animate-spin ${children ? (iconPosition === 'left' ? 'mr-2' : 'ml-2') : ''}`} />
    }
    if (Icon) {
      return <Icon className={`${iconSizes[size]} ${children ? (iconPosition === 'left' ? 'mr-2' : 'ml-2') : ''}`} />
    }
    return null
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {iconPosition === 'left' && renderIcon()}
      {children}
      {iconPosition === 'right' && renderIcon()}
    </button>
  )
}

export default Button
