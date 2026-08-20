import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfileBalanceNotifyCard from '../ProfileBalanceNotifyCard.vue'

const { updateProfile, showSuccess, showError, authState } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  authState: { user: null as Record<string, unknown> | null },
}))

vi.mock('@/api', () => ({
  userAPI: {
    updateProfile,
    toggleNotifyEmail: vi.fn(),
    sendNotifyEmailCode: vi.fn(),
    verifyNotifyEmail: vi.fn(),
    removeNotifyEmail: vi.fn(),
    getProfile: vi.fn(),
  },
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showSuccess, showError }) }))
vi.mock('@/utils/apiError', () => ({
  extractApiErrorMessage: (error: unknown) => (error as Error).message,
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function mountCard() {
  return mount(ProfileBalanceNotifyCard, {
    props: {
      enabled: true,
      threshold: null,
      extraEmails: [],
      systemDefaultThreshold: 10,
      userEmail: '',
      embedded: true,
      flat: true,
    },
  })
}

describe('ProfileBalanceNotifyCard', () => {
  beforeEach(() => {
    updateProfile.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
    authState.user = null
  })

  it('updates the notification switch through the shared control contract', async () => {
    const updated = { id: 1, balance_notify_enabled: false }
    updateProfile.mockResolvedValue(updated)
    const wrapper = mountCard()

    await wrapper.get('[data-testid="profile-balance-notify-toggle"]').setValue(false)
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledWith({ balance_notify_enabled: false })
    expect(authState.user).toEqual(updated)
  })

  it('saves a numeric threshold and keeps the real input test contract', async () => {
    const updated = { id: 1, balance_notify_threshold: 12.5 }
    updateProfile.mockResolvedValue(updated)
    const wrapper = mountCard()

    await wrapper.get('[data-testid="profile-balance-notify-threshold"]').setValue('12.5')
    await wrapper.get('[data-testid="profile-balance-notify-threshold-save"]').trigger('click')
    await flushPromises()

    expect(updateProfile).toHaveBeenCalledWith({ balance_notify_threshold: 12.5 })
    expect(authState.user).toEqual(updated)
    expect(showSuccess).toHaveBeenCalledWith('common.saved')
  })

  it('adds a pending notification email with the compact field and button', async () => {
    const wrapper = mountCard()

    await wrapper.get('[data-testid="profile-balance-notify-new-email"]').setValue('ops@example.com')
    await wrapper.get('[data-testid="profile-balance-notify-add-email"]').trigger('click')

    expect(wrapper.text()).toContain('ops@example.com')
    expect(wrapper.find('[data-testid="profile-balance-notify-new-email"]').exists()).toBe(true)
  })
})
