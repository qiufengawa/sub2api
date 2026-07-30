import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import HomeSiteHeader from '../HomeSiteHeader.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

function mountHeader(overrides: Record<string, unknown> = {}) {
  return mount(HomeSiteHeader, {
    props: {
      siteName: 'Qiu API',
      siteLogo: '/brand.svg',
      docUrl: 'https://docs.example.test',
      isDark: false,
      isAuthenticated: false,
      dashboardPath: '/dashboard',
      modelPlazaEnabled: true,
      ...overrides,
    },
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        LocaleSwitcher: true,
        Icon: true,
      },
    },
  })
}

describe('HomeSiteHeader', () => {
  it('keeps branding, docs, model plaza, locale, theme, and login controls', async () => {
    const wrapper = mountHeader()

    expect(wrapper.get('.qiu-site-logo img').attributes()).toMatchObject({
      src: '/brand.svg',
      alt: 'Qiu API Logo',
    })
    expect(wrapper.findAll('a[href="/model-plaza"]')).toHaveLength(2)
    expect(wrapper.get('a[href="https://docs.example.test"]').attributes('aria-label')).toBe('home.viewDocs')
    expect(wrapper.get('a[href="/login"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'LocaleSwitcher' }).exists()).toBe(true)

    await wrapper.get('button[aria-label="home.switchToDark"]').trigger('click')
    expect(wrapper.emitted('toggle-theme')).toHaveLength(1)
  })

  it('uses the authenticated dashboard destination and hides disabled optional links', () => {
    const wrapper = mountHeader({
      siteLogo: '',
      docUrl: '',
      isAuthenticated: true,
      dashboardPath: '/admin/dashboard',
      modelPlazaEnabled: false,
      isDark: true,
    })

    expect(wrapper.get('.qiu-site-logo img').attributes('src')).toBe('/logo.svg')
    expect(wrapper.get('a[href="/admin/dashboard"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/model-plaza"]').exists()).toBe(false)
    expect(wrapper.find('.qiu-doc-button').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="home.switchToLight"]').exists()).toBe(true)
  })

  it('opens the mobile navigation and closes it with Escape', async () => {
    const wrapper = mountHeader()
    const toggle = wrapper.get('button[aria-controls="qiu-mobile-menu"]')
    const menu = wrapper.get('#qiu-mobile-menu')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(menu.attributes('style')).toContain('display: none')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(menu.attributes('style')).not.toContain('display: none')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(menu.attributes('style')).toContain('display: none')
  })
})
