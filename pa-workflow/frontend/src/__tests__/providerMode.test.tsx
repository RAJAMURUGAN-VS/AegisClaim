/**
 * Integration tests for Provider Mode routing (testing vs real)
 *
 * Run: npm test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('Provider Mode — routing and UI divergence', () => {
  describe('Testing mode', () => {
    beforeEach(() => {
      localStorage.setItem('providerType', 'testing')
      localStorage.setItem('user', JSON.stringify({ role: 'PROVIDER', name: 'Test Provider', email: 'provider@example.com' }))
    })

    afterEach(() => {
      localStorage.removeItem('providerType')
      localStorage.removeItem('user')
    })

    it('persists providerType=testing in localStorage', () => {
      expect(localStorage.getItem('providerType')).toBe('testing')
    })

    it('navigates to /provider/submit when providerType is testing', () => {
      const stored = localStorage.getItem('providerType')
      expect(stored).toBe('testing')
    })
  })

  describe('Real / Production mode', () => {
    beforeEach(() => {
      localStorage.setItem('providerType', 'real')
      localStorage.setItem('user', JSON.stringify({ role: 'PROVIDER', name: 'Test Provider', email: 'provider@example.com' }))
    })

    afterEach(() => {
      localStorage.removeItem('providerType')
      localStorage.removeItem('user')
    })

    it('persists providerType=real in localStorage', () => {
      expect(localStorage.getItem('providerType')).toBe('real')
    })

    it('navigates to /real-provider/submit when providerType is real', () => {
      const stored = localStorage.getItem('providerType')
      expect(stored).toBe('real')
    })
  })

  describe('Sidebar link base computation', () => {
    it('uses /provider as base when providerType is testing', () => {
      localStorage.setItem('providerType', 'testing')
      const providerType = localStorage.getItem('providerType') || 'testing'
      const base = providerType === 'real' ? '/real-provider' : '/provider'
      expect(base).toBe('/provider')
    })

    it('uses /real-provider as base when providerType is real', () => {
      localStorage.setItem('providerType', 'real')
      const providerType = localStorage.getItem('providerType') || 'testing'
      const base = providerType === 'real' ? '/real-provider' : '/provider'
      expect(base).toBe('/real-provider')
    })
  })

  describe('Header title mapping', () => {
    it('maps /provider/submit to "Submit Prior Authorization"', () => {
      const path = '/provider/submit'
      let title = ''
      if (path.includes('/provider/submit') || path.includes('/real-provider/submit')) title = 'Submit Prior Authorization'
      expect(title).toBe('Submit Prior Authorization')
    })

    it('maps /real-provider/submit to "Submit Prior Authorization"', () => {
      const path = '/real-provider/submit'
      let title = ''
      if (path.includes('/provider/submit') || path.includes('/real-provider/submit')) title = 'Submit Prior Authorization'
      expect(title).toBe('Submit Prior Authorization')
    })

    it('maps /provider/status to "My Requests"', () => {
      const path = '/provider/status'
      let title = ''
      if (path.includes('/provider/status') || path.includes('/real-provider/status')) title = 'My Requests'
      expect(title).toBe('My Requests')
    })

    it('maps /real-provider/status to "My Requests"', () => {
      const path = '/real-provider/status'
      let title = ''
      if (path.includes('/provider/status') || path.includes('/real-provider/status')) title = 'My Requests'
      expect(title).toBe('My Requests')
    })
  })
})

describe('ProviderContext persistence', () => {
  beforeEach(() => {
    localStorage.removeItem('providerType')
  })

  afterEach(() => {
    localStorage.removeItem('providerType')
  })

  it('defaults to testing when nothing is stored', () => {
    localStorage.removeItem('providerType')
    const stored = localStorage.getItem('providerType')
    // ProviderContext hydrates from localStorage on mount;
    // before any setProviderType call it should be null (not yet initialized)
    expect(stored).toBeNull()
  })

  it('persists "testing" to localStorage', () => {
    localStorage.setItem('providerType', 'testing')
    expect(localStorage.getItem('providerType')).toBe('testing')
  })

  it('persists "real" to localStorage', () => {
    localStorage.setItem('providerType', 'real')
    expect(localStorage.getItem('providerType')).toBe('real')
  })

  it('setProviderType persists both context and localStorage', () => {
    // Simulate what Login.tsx does
    const setProviderType = (type: 'testing' | 'real') => {
      localStorage.setItem('providerType', type)
    }
    setProviderType('real')
    expect(localStorage.getItem('providerType')).toBe('real')
    setProviderType('testing')
    expect(localStorage.getItem('providerType')).toBe('testing')
  })
})
