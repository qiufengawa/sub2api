import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OAuthProfileAdoptionPanel from '../OAuthProfileAdoptionPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('OAuthProfileAdoptionPanel', () => {
  it('renders available profile suggestions and emits independent choices', async () => {
    const wrapper = mount(OAuthProfileAdoptionPanel, {
      props: {
        providerName: 'Provider',
        displayName: 'Qiu User',
        avatarUrl: 'https://example.test/avatar.png',
        adoptDisplayName: true,
        adoptAvatar: true
      }
    })

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    expect(wrapper.text()).toContain('Qiu User')
    expect(wrapper.get('img').attributes('src')).toBe('https://example.test/avatar.png')

    await checkboxes[0]?.setValue(false)
    await checkboxes[1]?.setValue(false)

    expect(wrapper.emitted('update:adoptDisplayName')?.[0]).toEqual([false])
    expect(wrapper.emitted('update:adoptAvatar')?.[0]).toEqual([false])
  })
})
