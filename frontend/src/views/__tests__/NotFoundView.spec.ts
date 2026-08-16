import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotFoundView from '@/views/NotFoundView.vue'

const { backMock, fetchPublicSettingsMock, appStoreState, authStoreState } = vi.hoisted(() => ({
  backMock: vi.fn(),
  fetchPublicSettingsMock: vi.fn(),
  appStoreState: {
    publicSettingsLoaded: false,
    contactInfo: '  support@example.com  '
  },
  authStoreState: {
    isAuthenticated: false
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: backMock }),
  RouterLink: defineComponent({
    name: 'RouterLink',
    props: { to: { type: [String, Object], required: true } },
    setup(props, { slots, attrs }) {
      return () => h('a', { ...attrs, 'data-to': String(props.to) }, slots.default?.())
    }
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'errors.pageNotFound': 'Page not found',
      'errors.pageNotFoundDescription': 'The requested page does not exist.',
      'common.back': 'Back',
      'common.goHome': 'Go home',
      'common.contactSupport': 'Contact support',
      'home.goToDashboard': 'Go to dashboard'
    })[key] ?? key
  })
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    ...appStoreState,
    fetchPublicSettings: fetchPublicSettingsMock
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreState
}))

describe('NotFoundView', () => {
  beforeEach(() => {
    backMock.mockReset()
    fetchPublicSettingsMock.mockReset()
    fetchPublicSettingsMock.mockResolvedValue(null)
    appStoreState.publicSettingsLoaded = false
    appStoreState.contactInfo = '  support@example.com  '
    authStoreState.isAuthenticated = false
  })

  it('loads public settings and routes unauthenticated visitors home', async () => {
    const wrapper = mount(NotFoundView)
    await flushPromises()

    expect(fetchPublicSettingsMock).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="not-found-primary"]').attributes('data-to')).toBe('/home')
    expect(wrapper.get('[data-testid="not-found-primary"]').text()).toContain('Go home')
    expect(wrapper.get('[data-testid="not-found-contact"]').text()).toContain('support@example.com')
  })

  it('routes authenticated visitors to the dashboard without refetching loaded settings', async () => {
    authStoreState.isAuthenticated = true
    appStoreState.publicSettingsLoaded = true

    const wrapper = mount(NotFoundView)
    await flushPromises()

    expect(fetchPublicSettingsMock).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="not-found-primary"]').attributes('data-to')).toBe('/dashboard')
    expect(wrapper.get('[data-testid="not-found-primary"]').text()).toContain('Go to dashboard')
  })

  it('uses browser history for the back command and hides blank contact details', async () => {
    appStoreState.contactInfo = '   '
    const wrapper = mount(NotFoundView)

    await wrapper.get('[data-testid="not-found-back"]').trigger('click')

    expect(backMock).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="not-found-contact"]').exists()).toBe(false)
  })
})
