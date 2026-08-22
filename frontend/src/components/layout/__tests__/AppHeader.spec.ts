import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppHeader from '../AppHeader.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  logout: vi.fn(),
  replay: vi.fn(),
  toggleMobileSidebar: vi.fn(),
  route: {
    name: 'Dashboard',
    params: {},
    meta: { titleKey: 'nav.dashboard', descriptionKey: 'dashboard.description' },
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
  useRoute: () => mocks.route,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'nav.dashboard': 'Dashboard',
      'dashboard.description': 'Account overview',
      'common.availableBalance': 'Available balance',
      'common.frozenBalance': 'Frozen balance',
      'common.totalBalance': 'Total balance',
      'common.userMenu': 'User menu',
      'profile.administrator': 'Administrator',
    } as Record<string, string>)[key] || key,
  }),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    contactInfo: '',
    docUrl: '',
    cachedPublicSettings: { custom_menu_items: [] },
    mobileOpen: false,
    toggleMobileSidebar: mocks.toggleMobileSidebar,
  }),
  useAuthStore: () => ({
    user: {
      username: 'admin',
      email: 'admin@example.test',
      role: 'admin',
      balance: 12.5,
      frozen_balance: 2.5,
      avatar_url: '',
    },
    isAdmin: true,
    isSimpleMode: false,
    logout: mocks.logout,
  }),
  useOnboardingStore: () => ({ replay: mocks.replay }),
  useSubscriptionStore: () => ({ activeSubscriptions: [{ id: 1 }] }),
}))

vi.mock('@/stores/adminSettings', () => ({
  useAdminSettingsStore: () => ({ customMenuItems: [] }),
}))

vi.mock('@/components/common/AnnouncementBell.vue', () => ({
  default: { template: '<span />' },
}))
vi.mock('@/components/common/LocaleSwitcher.vue', () => ({
  default: { template: '<span />' },
}))
vi.mock('@/components/common/SubscriptionProgressMini.vue', () => ({
  default: { template: '<span />' },
}))

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="String(to)"><slot /></a>',
}

function mountHeader() {
  return mount(AppHeader, {
    attachTo: document.body,
    global: {
      stubs: {
        AnnouncementBell: true,
        LocaleSwitcher: true,
        SubscriptionProgressMini: true,
        RouterLink: RouterLinkStub,
      },
      mocks: { $t: (key: string) => key },
    },
  })
}

describe('AppHeader shared popovers', () => {
  beforeEach(() => {
    mocks.push.mockReset().mockResolvedValue(undefined)
    mocks.logout.mockReset().mockResolvedValue(undefined)
    mocks.replay.mockReset()
    document.body.innerHTML = ''
  })

  it('opens the balance details and restores the trigger on Escape', async () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('button[aria-label="Available balance"]')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('$12.50')
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('$15.00')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull())
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('exposes the mobile menu relationship to assistive technology', () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('#app-mobile-menu-trigger')

    expect(trigger.attributes('aria-controls')).toBe('app-sidebar')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('opens the user menu and completes logout navigation', async () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('button[aria-label="User menu"]')

    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const menu = document.body.querySelector('[role="menu"]')
    expect(menu?.textContent).toContain('admin@example.test')

    const logout = Array.from(menu?.querySelectorAll('button') || [])
      .find(button => button.textContent?.includes('nav.logout'))
    expect(logout).toBeDefined()
    logout!.click()
    await flushPromises()

    expect(mocks.logout).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/login')
    wrapper.unmount()
  })
})
