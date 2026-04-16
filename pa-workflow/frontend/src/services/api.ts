import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// Create axios instance with default config
const getBaseUrl = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env
  return env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
}

const api: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    const { response, config } = error

    if (response) {
      switch (response.status) {
        case 401:
          // Skip redirect for login endpoint - let the component handle the error
          if (config?.url?.endsWith('/auth/login')) {
            break
          }
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('access_token')
          localStorage.removeItem('user')
          window.location.href = '/login'
          break

        case 403:
          // Forbidden - permission error
          console.error('Permission denied:', response.data)
          // You can emit an event or show a toast notification here
          break

        case 404:
          console.error('Resource not found:', response.data)
          break

        case 422:
          console.error('Validation error:', response.data)
          break

        case 500:
          console.error('Server error:', response.data)
          break

        default:
          console.error(`Error ${response.status}:`, response.data)
      }
    } else {
      // Network error
      console.error('Network error - please check your connection')
    }

    return Promise.reject(error)
  }
)

export default api
