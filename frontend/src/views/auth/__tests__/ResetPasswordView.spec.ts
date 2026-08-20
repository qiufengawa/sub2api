import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPasswordView from '@/views/auth/ResetPasswordView.vue'

const { routeQuery, resetPasswordMock, showErrorMock, showSuccessMock } = vi.hoisted(() => ({
  routeQuery: {} as Record<string, unknown>,
  resetPasswordMock: vi.fn(),
  showErrorMock: vi.fn(),
  showSuccessMock: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery }),
  RouterLink: { template: '<a><slot /></a>' }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/api/auth', () => ({
  resetPassword: (...args: unknown[]) => resetPasswordMock(...args)
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showError: (...args: unknown[]) => showErrorMock(...args),
    showSuccess: (...args: unknown[]) => showSuccessMock(...args)
  })
}))

describe('ResetPasswordView', () => {
  beforeEach(() => {
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    resetPasswordMock.mockReset()
    showErrorMock.mockReset()
    showSuccessMock.mockReset()
  })

  it('shows an invalid-link state when required query parameters are missing', async () => {
    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    expect(wrapper.text()).toContain('auth.invalidResetLink')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(showErrorMock).toHaveBeenCalledWith('auth.invalidResetLink')
  })

  it('submits the email, token, and new password from a valid link', async () => {
    routeQuery.email = 'user@example.com'
    routeQuery.token = 'reset-token'
    resetPasswordMock.mockResolvedValue({})
    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    await wrapper.get('#password').setValue('secret-123')
    await wrapper.get('#confirmPassword').setValue('secret-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(resetPasswordMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: 'reset-token',
      new_password: 'secret-123'
    })
    expect(showSuccessMock).toHaveBeenCalledWith('auth.passwordResetSuccess')
    expect(wrapper.text()).toContain('auth.passwordResetSuccessHint')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('keeps the form available and reports an expired token', async () => {
    routeQuery.email = 'user@example.com'
    routeQuery.token = 'expired-token'
    resetPasswordMock.mockRejectedValue({
      response: { data: { code: 'INVALID_RESET_TOKEN' } }
    })
    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    await wrapper.get('#password').setValue('secret-123')
    await wrapper.get('#confirmPassword').setValue('secret-123')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(showErrorMock).toHaveBeenCalledWith('auth.invalidOrExpiredToken')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('shows password rules on demand instead of a persistent hint row', async () => {
    routeQuery.email = 'user@example.com'
    routeQuery.token = 'reset-token'
    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    expect(wrapper.get('.ui-field-help').attributes('aria-label')).toBe('auth.passwordHint')
    expect(wrapper.find('.auth-text-field__hint').exists()).toBe(false)
  })

  it('connects validation messages to their fields for assistive technology', async () => {
    routeQuery.email = 'user@example.com'
    routeQuery.token = 'reset-token'
    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    for (const id of ['password', 'confirmPassword']) {
      const input = wrapper.get(`#${id}`)
      const messageId = `${id}-message`
      expect(input.attributes('aria-invalid')).toBe('true')
      expect(input.attributes('aria-describedby')).toBe(messageId)
      expect(wrapper.get(`#${messageId}`).text()).toContain('auth.')
    }
  })
})
