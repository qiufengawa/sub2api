import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logout } from '@/api/auth'

const post = vi.fn()

vi.mock('@/api/client', () => ({
  apiClient: {
    post: (...args: unknown[]) => post(...args),
  },
}))

function seedSession(suffix: string): void {
  localStorage.setItem('auth_token', `${suffix}-access`)
  localStorage.setItem('refresh_token', `${suffix}-refresh`)
  localStorage.setItem('auth_user', JSON.stringify({ id: suffix, email: `${suffix}@example.com` }))
}

describe('authAPI.logout session fencing', () => {
  beforeEach(() => {
    localStorage.clear()
    post.mockReset()
  })

  it('does not erase a session that replaced the one being revoked', async () => {
    let resolveRequest!: (value: unknown) => void
    post.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve
    }))
    seedSession('old')

    const pending = logout()
    seedSession('new')
    resolveRequest({ data: {} })
    await pending

    expect(localStorage.getItem('auth_token')).toBe('new-access')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
    expect(localStorage.getItem('auth_user')).toContain('new@example.com')
  })

  it('clears the unchanged session after revoke completes', async () => {
    seedSession('same')
    post.mockResolvedValueOnce({ data: {} })

    await logout()

    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
  })
})
