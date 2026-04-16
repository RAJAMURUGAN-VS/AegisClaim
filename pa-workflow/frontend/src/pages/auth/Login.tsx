import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Shield, 
  AlertCircle, 
  CheckCircle2, 
  Brain, 
  Lock, 
  Zap,
  Mail,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/common/Button'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

const features = [
  { icon: Brain, text: 'AI-Powered Decision Engine' },
  { icon: Lock, text: 'HIPAA Compliant & Secure' },
  { icon: Zap, text: 'Real-time Processing' },
]

const demoCredentials = [
  { email: 'provider@example.com', role: 'Provider' },
  { email: 'adjudicator@example.com', role: 'Adjudicator' },
  { email: 'admin@example.com', role: 'Admin' },
  { email: 'director@example.com', role: 'Medical Director' },
]

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
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
      // Get user from localStorage after successful login
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
          case 'MEDICAL_DIRECTOR':
            navigate('/adjudicator/queue')
            break
          default:
            navigate('/login')
        }
      }
    } catch (err: any) {
      // Display specific error message from backend if available
      const errorMessage = err?.response?.data?.detail || 'Invalid email or password. Please try again.'
      setError('root', {
        type: 'manual',
        message: errorMessage,
      })
    }
  }

  const fillDemoCredential = (email: string) => {
    setValue('email', email)
    setValue('password', 'password')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 relative overflow-hidden">
        {/* Abstract Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-400 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px),
                              linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AegisClaim</h1>
              <p className="text-sm text-primary-200">Prior Authorization System</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-md">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Intelligent Prior Authorization.
              <span className="block text-primary-200">Faster Decisions. Better Outcomes.</span>
            </h2>
            <p className="text-lg text-primary-100 mb-10">
              Streamline your healthcare workflow with AI-powered decision support and real-time processing.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-primary-200 text-sm">
            <p>© 2024 AegisClaim. All rights reserved.</p>
            <p className="mt-1">v2.1.0</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-white p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">AegisClaim</h1>
              <p className="text-xs text-neutral-500">Prior Authorization System</p>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome back</h2>
            <p className="text-neutral-500">Sign in to AegisClaim to continue</p>
          </div>

          {/* Error Message */}
          {errors.root && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-danger-700">{errors.root.message}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-neutral-400" />
                </div>
                <input
                  type="email"
                  placeholder="name@company.com"
                  autoFocus
                  className={`
                    w-full pl-11 pr-4 py-3 bg-white border rounded-lg text-sm
                    placeholder:text-neutral-400 transition-all duration-150
                    focus:outline-none focus:ring-[3px] focus:ring-primary-500/25
                    ${errors.email 
                      ? 'border-danger-300 focus:border-danger-500' 
                      : 'border-neutral-200 hover:border-neutral-300 focus:border-primary-500'
                    }
                  `}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-sm text-danger-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-neutral-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className={`
                    w-full pl-11 pr-11 py-3 bg-white border rounded-lg text-sm
                    placeholder:text-neutral-400 transition-all duration-150
                    focus:outline-none focus:ring-[3px] focus:ring-primary-500/25
                    ${errors.password 
                      ? 'border-danger-300 focus:border-danger-500' 
                      : 'border-neutral-200 hover:border-neutral-300 focus:border-primary-500'
                    }
                  `}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-danger-600">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-neutral-600">Remember me</span>
              </label>
              <button type="button" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </button>
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              Demo Credentials (password: "password")
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoCredentials.map((cred) => (
                <button
                  key={cred.email}
                  type="button"
                  onClick={() => fillDemoCredential(cred.email)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="block text-neutral-900 font-medium truncate">{cred.role}</span>
                    <span className="block text-xs text-neutral-500 truncate">{cred.email}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
