import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/auth/LoginView.vue'

const loginMock = vi.fn()
const login2FAMock = vi.fn()
const loginWithPasskeyMock = vi.fn()
const getPublicSettingsMock = vi.fn()
const startOAuthLoginMock = vi.fn()
const verifyActionMock = vi.fn()
const captchaResetMock = vi.fn()
const isTotp2FARequiredMock = vi.fn()
const routerPushMock = vi.fn()
const totpSetErrorMock = vi.fn()
const totpSetVerifyingMock = vi.fn()
const locationState = { href: 'http://localhost/login' }

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { query: {} } },
    push: (...args: unknown[]) => routerPushMock(...args)
  }),
  RouterLink: { template: '<a><slot /></a>' }
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    login: (...args: unknown[]) => loginMock(...args),
    login2FA: (...args: unknown[]) => login2FAMock(...args),
    loginWithPasskey: (...args: unknown[]) => loginWithPasskeyMock(...args)
  }),
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn()
  })
}))

vi.mock('@/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/api/auth')>('@/api/auth')
  return {
    ...actual,
    getPublicSettings: (...args: unknown[]) => getPublicSettingsMock(...args),
    startOAuthLogin: (...args: unknown[]) => startOAuthLoginMock(...args),
    isTotp2FARequired: (...args: unknown[]) => isTotp2FARequiredMock(...args),
    isWeChatWebOAuthEnabled: () => false
  }
})

const CaptchaChallengeStub = defineComponent({
  setup(_, { expose }) {
    expose({
      verifyAction: verifyActionMock,
      reset: captchaResetMock
    })
    return () => h('div')
  }
})

const OAuthButtonStub = defineComponent({
  emits: ['start'],
  setup(_, { emit }) {
    return () => h('button', {
      type: 'button',
      'data-testid': 'oauth-start',
      onClick: () => emit('start', {
        provider: 'github',
        params: { redirect: '/dashboard' }
      })
    })
  }
})

const TotpLoginModalStub = defineComponent({
  props: {
    tempToken: { type: String, required: true },
    userEmailMasked: { type: String, default: '' }
  },
  emits: ['verify', 'cancel'],
  setup(_, { emit, expose }) {
    expose({
      setError: totpSetErrorMock,
      setVerifying: totpSetVerifyingMock
    })
    return () => h('div', { 'data-testid': 'totp-modal' }, [
      h('button', {
        type: 'button',
        'data-testid': 'totp-verify',
        onClick: () => emit('verify', '123456')
      }),
      h('button', {
        type: 'button',
        'data-testid': 'totp-cancel',
        onClick: () => emit('cancel')
      })
    ])
  }
})

function mountLogin() {
  return mount(LoginView, {
    global: {
      stubs: {
        AuthLayout: { template: '<div><slot /><slot name="footer" /></div>' },
        RouterLink: true,
        TurnstileWidget: CaptchaChallengeStub,
        Icon: true,
        LoginAgreementPrompt: true,
        TotpLoginModal: TotpLoginModalStub,
        EmailOAuthButtons: OAuthButtonStub,
        LinuxDoOAuthSection: true,
        DingTalkOAuthSection: true,
        OidcOAuthSection: true,
        WechatOAuthSection: true
      }
    }
  })
}

describe('Tencent captcha action gate', () => {
  beforeEach(() => {
    loginMock.mockReset()
    login2FAMock.mockReset()
    loginWithPasskeyMock.mockReset()
    getPublicSettingsMock.mockReset()
    startOAuthLoginMock.mockReset()
    verifyActionMock.mockReset()
    captchaResetMock.mockReset()
    isTotp2FARequiredMock.mockReset()
    routerPushMock.mockReset()
    totpSetErrorMock.mockReset()
    totpSetVerifyingMock.mockReset()
    getPublicSettingsMock.mockResolvedValue({
      turnstile_enabled: false,
      turnstile_site_key: '',
      tencent_captcha_enabled: true,
      tencent_captcha_app_id: 'tencent-app-id',
      backend_mode_enabled: false,
      password_reset_enabled: false,
      passkey_enabled: true,
      github_oauth_enabled: true,
      google_oauth_enabled: false
    })
    loginMock.mockResolvedValue({})
    login2FAMock.mockResolvedValue({})
    isTotp2FARequiredMock.mockReturnValue(false)
    loginWithPasskeyMock.mockResolvedValue({})
    startOAuthLoginMock.mockResolvedValue({ authorize_url: 'https://github.example/authorize' })
    verifyActionMock.mockResolvedValue({ token: 'ticket-1', randstr: '@rand-1' })
    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      value: class PublicKeyCredential {}
    })
    locationState.href = 'http://localhost/login'
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationState
    })
  })

  it('clicking login opens Tencent captcha before calling login', async () => {
    const wrapper = mountLogin()
    await flushPromises()
    await wrapper.get('#email').setValue('user@example.com')
    await wrapper.get('#password').setValue('secret-123')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(verifyActionMock).toHaveBeenCalledOnce()
    expect(loginMock).toHaveBeenCalledWith(expect.objectContaining({
      tencent_captcha_ticket: 'ticket-1',
      tencent_captcha_randstr: '@rand-1'
    }))
  })

  it('does not call login when Tencent captcha is closed', async () => {
    verifyActionMock.mockResolvedValue(null)
    const wrapper = mountLogin()
    await flushPromises()
    await wrapper.get('#email').setValue('user@example.com')
    await wrapper.get('#password').setValue('secret-123')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(verifyActionMock).toHaveBeenCalledOnce()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('keeps authentication actions locked when public settings fail to load', async () => {
    getPublicSettingsMock.mockRejectedValueOnce(new Error('settings unavailable'))
    const wrapper = mountLogin()
    await flushPromises()

    expect((wrapper.get('#email').element as HTMLInputElement).disabled).toBe(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(loginMock).not.toHaveBeenCalled()
    expect(verifyActionMock).not.toHaveBeenCalled()
  })

  it('does not open Tencent captcha when login form validation fails', async () => {
    const wrapper = mountLogin()
    await flushPromises()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(verifyActionMock).not.toHaveBeenCalled()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('starts OAuth through the Tencent gate before navigating', async () => {
    const wrapper = mountLogin()
    await flushPromises()

    await wrapper.get('[data-testid="oauth-start"]').trigger('click')
    await flushPromises()

    expect(verifyActionMock).toHaveBeenCalledOnce()
    expect(startOAuthLoginMock).toHaveBeenCalledWith(
      { provider: 'github', params: { redirect: '/dashboard' } },
      {
        tencent_captcha_ticket: 'ticket-1',
        tencent_captcha_randstr: '@rand-1'
      }
    )
    expect(locationState.href).toBe('https://github.example/authorize')
    expect(captchaResetMock).toHaveBeenCalledOnce()
  })

  it('does not start OAuth when Tencent captcha is closed', async () => {
    verifyActionMock.mockResolvedValue(null)
    const wrapper = mountLogin()
    await flushPromises()

    await wrapper.get('[data-testid="oauth-start"]').trigger('click')
    await flushPromises()

    expect(startOAuthLoginMock).not.toHaveBeenCalled()
    expect(locationState.href).toBe('http://localhost/login')
  })

  it('passes a fresh Tencent proof to Passkey login', async () => {
    const wrapper = mountLogin()
    await flushPromises()

    await wrapper.get('.auth-alternatives .ui-button--secondary').trigger('click')
    await flushPromises()

    expect(verifyActionMock).toHaveBeenCalledOnce()
    expect(loginWithPasskeyMock).toHaveBeenCalledWith({
      tencent_captcha_ticket: 'ticket-1',
      tencent_captcha_randstr: '@rand-1'
    })
    expect(captchaResetMock).toHaveBeenCalledOnce()
  })

  it('does not invoke Passkey when Tencent captcha is closed', async () => {
    verifyActionMock.mockResolvedValue(null)
    const wrapper = mountLogin()
    await flushPromises()

    await wrapper.get('.auth-alternatives .ui-button--secondary').trigger('click')
    await flushPromises()

    expect(loginWithPasskeyMock).not.toHaveBeenCalled()
  })

  it('completes the TOTP login challenge with the temporary token', async () => {
    loginMock.mockResolvedValue({
      temp_token: 'temp-token-1',
      user_email_masked: 'u***@example.com'
    })
    isTotp2FARequiredMock.mockReturnValue(true)

    const wrapper = mountLogin()
    await flushPromises()
    await wrapper.get('#email').setValue('user@example.com')
    await wrapper.get('#password').setValue('secret-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="totp-modal"]').exists()).toBe(true)
    await wrapper.get('[data-testid="totp-verify"]').trigger('click')
    await flushPromises()

    expect(totpSetVerifyingMock).toHaveBeenCalledWith(true)
    expect(login2FAMock).toHaveBeenCalledWith('temp-token-1', '123456')
    expect(routerPushMock).toHaveBeenCalledWith('/dashboard')
    expect(wrapper.find('[data-testid="totp-modal"]').exists()).toBe(false)
  })

  it('keeps the TOTP challenge open on verification failure and clears it on cancel', async () => {
    loginMock.mockResolvedValue({
      temp_token: 'temp-token-2',
      user_email_masked: 'u***@example.com'
    })
    login2FAMock.mockRejectedValue(new Error('Invalid code'))
    isTotp2FARequiredMock.mockReturnValue(true)

    const wrapper = mountLogin()
    await flushPromises()
    await wrapper.get('#email').setValue('user@example.com')
    await wrapper.get('#password').setValue('secret-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-testid="totp-verify"]').trigger('click')
    await flushPromises()

    expect(totpSetErrorMock).toHaveBeenCalledWith('Invalid code')
    expect(totpSetVerifyingMock).toHaveBeenLastCalledWith(false)
    expect(wrapper.get('[data-testid="totp-modal"]').exists()).toBe(true)

    await wrapper.get('[data-testid="totp-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="totp-modal"]').exists()).toBe(false)
  })
})
