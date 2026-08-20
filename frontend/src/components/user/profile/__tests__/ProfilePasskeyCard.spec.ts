import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfilePasskeyCard from '@/components/user/profile/ProfilePasskeyCard.vue'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  register: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => params ? `${key}:${JSON.stringify(params)}` : key })
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showSuccess: mocks.showSuccess,
    showError: mocks.showError
  })
}))

vi.mock('@/api', () => ({
  passkeyAPI: {
    isSupported: () => true,
    list: mocks.list,
    register: mocks.register,
    rename: mocks.rename,
    remove: mocks.remove
  }
}))

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('ProfilePasskeyCard', () => {
  beforeEach(() => {
    mocks.list.mockReset().mockResolvedValue([
      {
        id: 7,
        name: 'MacBook',
        created_at: '2026-08-19T00:00:00Z',
        backup: false
      }
    ])
    mocks.register.mockReset()
    mocks.rename.mockReset()
    mocks.remove.mockReset().mockResolvedValue(undefined)
    mocks.showSuccess.mockReset()
    mocks.showError.mockReset()
  })

  it('uses the shared dialog and preserves password-confirmed deletion', async () => {
    const wrapper = mount(ProfilePasskeyCard, {
      props: { enabled: true },
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.delete')
    expect(deleteButton).toBeTruthy()
    await deleteButton!.trigger('click')

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.get('h2').text()).toBe('profile.passkey.deleteTitle')

    await dialog.get('#passkey-delete-password').setValue('secret')
    await dialog.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(mocks.remove).toHaveBeenCalledWith(7, 'secret')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('MacBook')
  })
})
