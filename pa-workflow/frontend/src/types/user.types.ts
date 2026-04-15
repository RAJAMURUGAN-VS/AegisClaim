// User-related types (also defined in pa.types.ts for convenience)
// This file can be used for additional user-specific types

import type { User } from './pa.types'

export type { User }

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  notifications: {
    email: boolean
    inApp: boolean
    webhook?: string
  }
  defaultFilters?: Record<string, unknown>
}

export interface UserActivity {
  id: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface RolePermissions {
  role: 'PROVIDER' | 'ADJUDICATOR' | 'ADMIN'
  permissions: string[]
}

// Permission types
export type Permission =
  | 'pa:create'
  | 'pa:read'
  | 'pa:update'
  | 'pa:delete'
  | 'pa:decide'
  | 'pa:cancel'
  | 'pa:export'
  | 'user:manage'
  | 'settings:manage'
  | 'analytics:view'
  | 'webhook:manage'
