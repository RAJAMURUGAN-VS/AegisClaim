import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'

export type ProviderType = 'testing' | 'real'

interface ProviderContextType {
  providerType: ProviderType
  setProviderType: (type: ProviderType) => void
}

const ProviderContext = createContext<ProviderContextType | undefined>(undefined)

interface ProviderProviderProps {
  children: ReactNode
}

export const ProviderTypeProvider: React.FC<ProviderProviderProps> = ({ children }) => {
  const [providerType, setProviderTypeState] = useState<ProviderType>('testing')

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('providerType') as ProviderType | null
    if (stored === 'testing' || stored === 'real') {
      setProviderTypeState(stored)
    }
  }, [])

  const setProviderType = (type: ProviderType) => {
    setProviderTypeState(type)
    localStorage.setItem('providerType', type)
  }

  const value: ProviderContextType = {
    providerType,
    setProviderType,
  }

  return (
    <ProviderContext.Provider value={value}>
      {children}
    </ProviderContext.Provider>
  )
}

export const useProviderType = (): ProviderContextType => {
  const context = useContext(ProviderContext)
  if (context === undefined) {
    throw new Error('useProviderType must be used within a ProviderTypeProvider')
  }
  return context
}
