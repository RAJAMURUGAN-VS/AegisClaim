import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { authService } from '../services/auth'
import type { User } from '../types/pa.types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = authService.getStoredToken()
      const storedUser = authService.getStoredUser()

      if (token && storedUser) {
        try {
          // Verify token is still valid by fetching current user
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
          authService.setStoredAuth(
            { access_token: token, token_type: 'bearer', expires_in: 3600 },
            currentUser
          )
        } catch (error) {
          // Token invalid, clear storage
          authService.clearStoredAuth()
          setUser(null)
        }
      }
      setIsLoading(false)
    }

    initializeAuth()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true)
    try {
      const { user: loggedInUser, token } = await authService.login({
        email,
        password,
      })

      authService.setStoredAuth(token, loggedInUser)
      setUser(loggedInUser)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      await authService.logout()
    } finally {
      setUser(null)
      setIsLoading(false)
    }
  }, [])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
