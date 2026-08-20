import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiAccordion from '../UiAccordion.vue'
import UiSideNavGroup from '../UiSideNavGroup.vue'

describe('shared disclosure relationships', () => {
  it('links each accordion trigger to its expanded body', async () => {
    const wrapper = mount(UiAccordion, {
      props: {
        items: [
          { key: 'first item', title: 'First', content: 'Details' },
          { key: 'second', title: 'Second', content: 'Other details' },
        ],
        defaultOpen: ['first item'],
      },
    })

    const firstButton = wrapper.find('button')
    const firstBodyId = firstButton.attributes('aria-controls')
    expect(firstBodyId).toBeTruthy()
    expect(wrapper.find(`#${firstBodyId}`).exists()).toBe(true)
    expect(firstButton.attributes('class')).toContain('ui-focus-ring')

    const secondButton = wrapper.findAll('button')[1]
    const secondBodyId = secondButton.attributes('aria-controls')
    expect(wrapper.find(`#${secondBodyId}`).exists()).toBe(false)
    await secondButton.trigger('click')
    expect(wrapper.find(`#${secondBodyId}`).exists()).toBe(true)
  })

  it('links the side navigation trigger to its persistent body', async () => {
    const wrapper = mount(UiSideNavGroup, { props: { label: 'Navigation' } })
    const button = wrapper.get('button')
    const bodyId = button.attributes('aria-controls')

    expect(bodyId).toBeTruthy()
    expect(wrapper.get(`#${bodyId}`).exists()).toBe(true)
    expect(button.attributes('class')).toContain('ui-focus-ring')

    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
  })
})
