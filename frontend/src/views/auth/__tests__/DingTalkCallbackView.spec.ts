import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const routeState = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))
const replace = vi.hoisted(() => vi.fn())
const setToken = vi.hoisted(() => vi.fn())
const setPendingAuthSession = vi.hoisted(() => vi.fn())
const clearPendingAuthSession = vi.hoisted(() => vi.fn())
const showSuccess = vi.hoisted(() => vi.fn())
const showError = vi.hoisted(() => vi.fn())
const showInfo = vi.hoisted(() => vi.fn())
const exchangePendingOAuthCompletion = vi.hoisted(() => vi.fn())
const apiClientPost = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ replace }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => ({ setToken, setPendingAuthSession, clearPendingAuthSession }),
  useAppStore: () => ({ showSuccess, showError, showInfo }),
}))

vi.mock('@/api/client', () => ({
  apiClient: { post: (...args: unknown[]) => apiClientPost(...args) },
}))

vi.mock('@/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/api/auth')>('@/api/auth')
  return {
    ...actual,
    exchangePendingOAuthCompletion: (...args: unknown[]) => exchangePendingOAuthCompletion(...args),
  }
})

vi.mock('@/utils/oauthAffiliate', () => ({
  clearAllAffiliateReferralCodes: vi.fn(),
  loadOAuthAffiliateCode: vi.fn().mockReturnValue(''),
  oauthAffiliatePayload: vi.fn().mockReturnValue({}),
}))

import DingTalkCallbackView from '../DingTalkCallbackView.vue'

function mountView() {
  return mount(DingTalkCallbackView, {
    global: {
      stubs: {
        AuthFormPanel: { template: '<section><slot /></section>' },
        OAuthProfileAdoptionPanel: true,
        PendingOAuthCreateAccountForm: true,
        transition: false,
      },
    },
  })
}

describe('DingTalkCallbackView', () => {
  beforeEach(() => {
    routeState.query = {}
    replace.mockReset().mockResolvedValue(undefined)
    setToken.mockReset().mockResolvedValue(undefined)
    setPendingAuthSession.mockReset()
    clearPendingAuthSession.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
    showInfo.mockReset()
    exchangePendingOAuthCompletion.mockReset()
    apiClientPost.mockReset()
    window.location.hash = ''
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('keeps the processing status visible while the initial exchange is pending', async () => {
    let rejectExchange!: (reason?: unknown) => void
    exchangePendingOAuthCompletion.mockImplementation(
      () => new Promise((_resolve, reject) => {
        rejectExchange = reject
      })
    )

    const wrapper = mount(DingTalkCallbackView, {
      global: {
        stubs: {
          AuthFormPanel: { template: '<section><slot /></section>' },
          OAuthProfileAdoptionPanel: true,
          PendingOAuthCreateAccountForm: true,
          transition: true,
        },
      },
    })

    expect(wrapper.get('.oauth-callback__processing[aria-live="polite"]')).toBeTruthy()
    expect(wrapper.get('.oauth-callback__processing [role="status"]').attributes('aria-label'))
      .toBe('auth.dingtalk.callbackProcessing')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.oauth-callback-flow').exists()).toBe(false)

    rejectExchange(new Error('Provider unavailable'))
    await flushPromises()

    expect(wrapper.find('.oauth-callback__processing').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Provider unavailable')
  })

  it('rejects an external completion redirect before entering email completion', async () => {
    exchangePendingOAuthCompletion.mockResolvedValue({
      step: 'email_completion',
      requires_email_completion: true,
      redirect: '//evil.example/phish',
    })

    mountView()
    await flushPromises()

    expect(replace).toHaveBeenCalledWith(
      '/auth/dingtalk/email-completion?redirect=%2Fdashboard',
    )
    expect(setToken).not.toHaveBeenCalled()
    expect(setPendingAuthSession).not.toHaveBeenCalled()
  })

  it('accepts the legacy fragment token without pending-session exchange', async () => {
    window.location.hash =
      '#access_token=legacy-access-token&refresh_token=legacy-refresh-token&expires_in=3600&token_type=Bearer&redirect=%2Flegacy-dashboard'

    mountView()
    await flushPromises()

    expect(exchangePendingOAuthCompletion).not.toHaveBeenCalled()
    expect(setToken).toHaveBeenCalledWith('legacy-access-token')
    expect(window.localStorage.getItem('refresh_token')).toBe('legacy-refresh-token')
    expect(window.localStorage.getItem('token_expires_at')).not.toBeNull()
    expect(showSuccess).toHaveBeenCalledWith('auth.loginSuccess')
    expect(replace).toHaveBeenCalledWith('/legacy-dashboard')
  })

  it('shows a recoverable inline error for a denied callback', async () => {
    window.location.hash = '#error=access_denied&error_description=Provider%20cancelled'

    const wrapper = mountView()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('Provider cancelled')
    expect(wrapper.get('[role="alert"]').text()).toContain('Provider cancelled')
    await wrapper.get('button').trigger('click')
    expect(replace).toHaveBeenCalledWith('/login')
  })
})
