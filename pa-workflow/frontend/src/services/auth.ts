import api from './api'
import type { User, AuthToken } from '../types/pa.types'

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  token: AuthToken
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout')
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me')
    return response.data
  },

  refreshToken: async (): Promise<AuthToken> => {
    const response = await api.post<AuthToken>('/auth/refresh')
    const { access_token } = response.data
    localStorage.setItem('access_token', access_token)
    return response.data
  },

  setStoredAuth: (token: AuthToken, user: User): void => {
    localStorage.setItem('access_token', token.access_token)
    localStorage.setItem('user', JSON.stringify(user))
  },

  getStoredToken: (): string | null => {
    return localStorage.getItem('access_token')
  },

  getStoredUser: (): User | null => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        return JSON.parse(userStr) as User
      } catch {
        return null
      }
    }
    return null
  },

  clearStoredAuth: (): void => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  },
}
