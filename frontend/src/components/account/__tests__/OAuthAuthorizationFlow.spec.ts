import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OAuthAuthorizationFlow from '../OAuthAuthorizationFlow.vue'

const getCapabilities = vi.hoisted(() => vi.fn())
const copyToClipboard = vi.hoisted(() => vi.fn().mockResolvedValue(true))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    grok: { getCapabilities }
  }
}))

vi.mock('@/composables/useClipboard', async () => {
  const { ref } = await import('vue')
  return {
    useClipboard: () => ({ copied: ref(false), copyToClipboard })
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const mountFlow = (props: Record<string, unknown> = {}) => mount(OAuthAuthorizationFlow, {
  props: {
    addMethod: 'oauth',
    showCookieOption: false,
    ...props
  }
})

describe('OAuthAuthorizationFlow', () => {
  beforeEach(() => {
    getCapabilities.mockReset()
    getCapabilities.mockResolvedValue({ password_auth_enabled: true })
    copyToClipboard.mockClear()
  })

  it('renders enabled methods through the shared radio group and emits selection changes', async () => {
    const wrapper = mountFlow({
      platform: 'openai',
      showCookieOption: true,
      showRefreshTokenOption: true,
      showCodexSessionImportOption: true
    })

    const values = wrapper.findAll('input[type="radio"]').map(input => input.attributes('value'))
    expect(values).toEqual(['manual', 'cookie', 'refresh_token', 'codex_session'])

    await wrapper.get('input[value="refresh_token"]').setValue()
    expect(wrapper.emitted('update:inputMethod')?.at(-1)).toEqual(['refresh_token'])
  })

  it('keeps trimmed refresh-token and raw cookie payload semantics', async () => {
    const refresh = mountFlow({
      platform: 'openai',
      showManualOption: false,
      showRefreshTokenOption: true,
      initialInputMethod: 'refresh_token'
    })
    await refresh.get('textarea').setValue('  refresh-secret  ')
    await refresh.get('button.ui-button--primary').trigger('click')
    expect(refresh.emitted('validate-refresh-token')?.at(-1)).toEqual(['refresh-secret'])

    const cookie = mountFlow({
      showManualOption: false,
      showCookieOption: true,
      initialInputMethod: 'cookie'
    })
    await cookie.get('textarea').setValue('  session-key  ')
    await cookie.get('button.ui-button--primary').trigger('click')
    expect(cookie.emitted('cookie-auth')?.at(-1)).toEqual(['  session-key  '])
  })

  it('fails closed when Grok password authorization capability is unavailable', async () => {
    getCapabilities.mockRejectedValueOnce(new Error('unavailable'))
    const wrapper = mountFlow({
      platform: 'grok',
      showEmailPasswordOption: true,
      showCookieOption: true
    })
    await flushPromises()

    expect(wrapper.find('input[value="email_password"]').exists()).toBe(false)
  })

  it('keeps the password payload untrimmed after capability approval', async () => {
    const wrapper = mountFlow({
      platform: 'grok',
      showManualOption: false,
      showEmailPasswordOption: true,
      initialInputMethod: 'email_password'
    })
    await flushPromises()
    await wrapper.get('textarea').setValue(' user@example.com----secret ')
    await wrapper.get('button.ui-button--primary').trigger('click')

    expect(wrapper.emitted('authorize-password')?.at(-1)).toEqual([' user@example.com----secret '])
  })

  it('extracts callback code and state and clears exposed state on reset', async () => {
    const wrapper = mountFlow({ platform: 'gemini' })
    await wrapper.get('textarea').setValue('http://localhost/callback?code=code-123&state=state-456')
    await flushPromises()

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('code-123')
    expect((wrapper.vm as unknown as { oauthState: string }).oauthState).toBe('state-456')

    ;(wrapper.vm as unknown as { reset: () => void }).reset()
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.vm as unknown as { oauthState: string }).oauthState).toBe('')
  })
})
