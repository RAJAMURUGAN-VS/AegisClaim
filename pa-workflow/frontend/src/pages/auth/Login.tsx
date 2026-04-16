import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/common/Button'
import { Input } from '../../components/common/Input'
import { Spinner } from '../../components/common/Spinner'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login, isLoading: authLoading } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password)
      // After successful login, user will be set and navigation happens via effect
      // or we can handle it here since login sets the user
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const user = JSON.parse(storedUser)
        switch (user.role) {
          case 'PROVIDER':
            navigate('/provider/submit')
            break
          case 'ADJUDICATOR':
            navigate('/adjudicator/queue')
            break
          case 'ADMIN':
            navigate('/admin/dashboard')
            break
          default:
            navigate('/login')
        }
      }
    } catch (err) {
      setError('root', {
        type: 'manual',
        message: 'Invalid email or password. Please try again.',
      })
    }
  }

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-3">
            <Shield className="w-12 h-12 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-primary">AegisClaim</h1>
              <p className="text-sm text-gray-500">PA Workflow</p>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-card p-8">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-500 text-center mb-6">
            Sign in to your account
          </p>

          {errors.root && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center text-danger">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{errors.root.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              required
              autoFocus
              {...register('email')}
              error={errors.email?.message}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              required
              {...register('password')}
              error={errors.password?.message}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p className="font-medium mb-2">Demo Credentials (all use "password"):</p>
            <div className="space-y-1">
              <p>
                <code className="bg-gray-100 px-2 py-1 rounded">provider@example.com</code> — Provider
              </p>
              <p>
                <code className="bg-gray-100 px-2 py-1 rounded">adjudicator@example.com</code> — Adjudicator
              </p>
              <p>
                <code className="bg-gray-100 px-2 py-1 rounded">admin@example.com</code> — Admin
              </p>
              <p>
                <code className="bg-gray-100 px-2 py-1 rounded">director@example.com</code> — Medical Director
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          © 2024 AegisClaim. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default Login
