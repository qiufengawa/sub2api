import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileBillingPreferenceSection from '../ProfileBillingPreferenceSection.vue'

const { updateProfile, showSuccess, showError, authState } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  authState: { user: null as Record<string, unknown> | null },
}))

vi.mock('@/api', () => ({ userAPI: { updateProfile } }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showSuccess, showError }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ProfileBillingPreferenceSection', () => {
  beforeEach(() => {
    updateProfile.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
    authState.user = null
  })

  it('renders all four modes and saves the selected preference once', async () => {
    updateProfile.mockResolvedValue({ id: 1, billing_preference: 'wallet_first' })
    const wrapper = mount(ProfileBillingPreferenceSection, { props: { value: 'subscription_first' } })
    const radios = wrapper.findAll('input[type="radio"]')

    expect(radios).toHaveLength(4)
    expect((radios[0].element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await radios[1].setValue(true)
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledWith({ billing_preference: 'wallet_first' })
    expect(authState.user).toEqual({ id: 1, billing_preference: 'wallet_first' })
    expect(showSuccess).toHaveBeenCalledWith('common.saved')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await wrapper.get('button').trigger('click')
    expect(updateProfile).toHaveBeenCalledTimes(1)
  })

  it('keeps the changed value retryable after a failed save and follows prop updates', async () => {
    updateProfile.mockRejectedValue(new Error('network'))
    const wrapper = mount(ProfileBillingPreferenceSection, { props: { value: 'subscription_first' } })

    await wrapper.find('input[value="wallet_only"]').setValue(true)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(showError).toHaveBeenCalled()
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()

    await wrapper.setProps({ value: 'subscription_only' })
    expect((wrapper.find('input[value="subscription_only"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
})
