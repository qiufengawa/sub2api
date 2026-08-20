import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const appStore = reactive({
  sidebarCollapsed: false,
})
const authStore = reactive({
  user: { role: 'user' as string },
})
const setReplayCallback = vi.fn()
const replayTour = vi.fn()

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStore,
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({ setReplayCallback }),
}))

vi.mock('@/composables/useOnboardingTour', () => ({
  useOnboardingTour: () => ({ replayTour }),
}))

import AppLayout from '../AppLayout.vue'

function mountLayout() {
  return mount(AppLayout, {
    global: {
      stubs: {
        AppSidebar: { template: '<aside data-test="app-sidebar" />' },
        AppHeader: { template: '<header data-test="app-header" />' },
      },
    },
    slots: {
      default: '<div data-test="page-content">page content</div>',
    },
  })
}

describe('AppLayout runtime behavior', () => {
  beforeEach(() => {
    appStore.sidebarCollapsed = false
    authStore.user = { role: 'user' }
    setReplayCallback.mockReset()
    replayTour.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the workspace shell and page slot mounted for the expanded sidebar', () => {
    const wrapper = mountLayout()

    expect(wrapper.get('.app-shell').classes()).not.toContain('app-shell--collapsed')
    expect(wrapper.get('[data-test="app-sidebar"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="app-header"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="page-content"]').text()).toBe('page content')
  })

  it('reflects the collapsed sidebar state without replacing the workspace', () => {
    appStore.sidebarCollapsed = true
    const wrapper = mountLayout()

    expect(wrapper.get('.app-shell').classes()).toContain('app-shell--collapsed')
    expect(wrapper.get('.app-shell__workspace').exists()).toBe(true)
    expect(wrapper.get('[data-test="page-content"]').exists()).toBe(true)
  })

  it('registers the onboarding replay callback after mount and exposes it', () => {
    const wrapper = mountLayout()

    expect(setReplayCallback).toHaveBeenCalledTimes(1)
    expect(setReplayCallback).toHaveBeenCalledWith(replayTour)

    ;(wrapper.vm as unknown as { replayTour: () => void }).replayTour()
    expect(replayTour).toHaveBeenCalledTimes(1)
  })
})
