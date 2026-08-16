import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LocaleSwitcher from '../LocaleSwitcher.vue'

const { locale, setLocale } = vi.hoisted(() => ({
  locale: { value: 'zh' },
  setLocale: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ locale }) }))
vi.mock('@/i18n', () => ({
  availableLocales: [
    { code: 'zh', name: '简体中文' },
    { code: 'en', name: 'English' },
  ],
  setLocale,
}))

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    locale.value = 'zh'
    setLocale.mockReset().mockResolvedValue(undefined)
  })

  it('uses the shared compact icon trigger in the application header', () => {
    const wrapper = mount(LocaleSwitcher, { props: { compact: true } })

    const trigger = wrapper.get('button')
    expect(trigger.attributes('aria-label')).toBe('简体中文')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.text()).toBe('')
    wrapper.unmount()
  })

  it('shows the current locale code in the regular trigger', () => {
    const wrapper = mount(LocaleSwitcher)

    expect(wrapper.get('button').text()).toContain('ZH')
    expect(wrapper.get('button').attributes('aria-label')).toBe('简体中文')
    wrapper.unmount()
  })

  it('switches through the shared dropdown menu', async () => {
    const wrapper = mount(LocaleSwitcher)
    await wrapper.get('button').trigger('click')

    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    const options = document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')
    expect(options).toHaveLength(2)
    options[1].click()
    await vi.waitFor(() => expect(setLocale).toHaveBeenCalledWith('en'))
    wrapper.unmount()
  })
})
