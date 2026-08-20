import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const routeState = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))
const replace = vi.hoisted(() => vi.fn())
const setToken = vi.hoisted(() => vi.fn())
const showSuccess = vi.hoisted(() => vi.fn())
const showError = vi.hoisted(() => vi.fn())
const showInfo = vi.hoisted(() => vi.fn())
const apiClientPost = vi.hoisted(() => vi.fn())
const getPublicSettings = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ replace }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => ({ setToken }),
  useAppStore: () => ({ showSuccess, showError, showInfo }),
}))

vi.mock('@/api/client', () => ({
  apiClient: { post: (...args: unknown[]) => apiClientPost(...args) },
}))

vi.mock('@/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/api/auth')>('@/api/auth')
  return {
    ...actual,
    getPublicSettings: (...args: unknown[]) => getPublicSettings(...args),
  }
})

vi.mock('@/utils/oauthAffiliate', () => ({
  clearAllAffiliateReferralCodes: vi.fn(),
}))

import DingTalkEmailCompletionView from '../DingTalkEmailCompletionView.vue'

describe('DingTalkEmailCompletionView', () => {
  beforeEach(() => {
    routeState.query = { redirect: '/welcome' }
    replace.mockReset().mockResolvedValue(undefined)
    setToken.mockReset().mockResolvedValue(undefined)
    showSuccess.mockReset()
    showError.mockReset()
    showInfo.mockReset()
    apiClientPost.mockReset().mockResolvedValue({
      data: {
        access_token: 'completed-access',
        refresh_token: 'completed-refresh',
        expires_in: 3600,
      },
    })
    getPublicSettings.mockReset().mockResolvedValue({
      invitation_code_enabled: false,
      email_verify_enabled: false,
      turnstile_enabled: false,
      turnstile_site_key: '',
      tencent_captcha_enabled: false,
      aliyun_captcha_enabled: false,
    })
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('persists completion token context and returns to the sanitized redirect', async () => {
    const wrapper = mount(DingTalkEmailCompletionView, {
      global: {
        stubs: {
          AuthFormPanel: { template: '<section><slot /></section>' },
          CaptchaChallenge: true,
        },
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="dingtalk-create-account-email"]').setValue('new@example.com')
    await wrapper.get('[data-testid="dingtalk-create-account-password"]').setValue('secret-123')
    await wrapper.get('[data-testid="dingtalk-create-account-submit"]').trigger('click')
    await flushPromises()

    expect(apiClientPost).toHaveBeenCalledWith('/auth/oauth/pending/create-account', {
      email: 'new@example.com',
      password: 'secret-123',
      verify_code: undefined,
      invitation_code: undefined,
    })
    expect(window.localStorage.getItem('refresh_token')).toBe('completed-refresh')
    expect(window.localStorage.getItem('token_expires_at')).not.toBeNull()
    expect(setToken).toHaveBeenCalledWith('completed-access')
    expect(showSuccess).toHaveBeenCalledWith('auth.loginSuccess')
    expect(replace).toHaveBeenCalledWith('/welcome')
  })
})
