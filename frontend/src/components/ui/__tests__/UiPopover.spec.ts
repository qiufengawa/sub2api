import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import UiPopover from '../UiPopover.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UiPopover accessibility', () => {
  it('names the panel, focuses its first control, and restores focus on Escape', async () => {
    const wrapper = mount(UiPopover, {
      attachTo: document.body,
      props: {
        panelRole: 'dialog',
        ariaLabel: 'Choose a model'
      },
      slots: {
        trigger: '<button type="button" data-testid="trigger">Models</button>',
        default: '<input data-testid="panel-input" />'
      }
    })
    const trigger = wrapper.get<HTMLButtonElement>('[data-testid="trigger"]')

    await trigger.trigger('click')
    await flushPromises()

    const panel = document.body.querySelector<HTMLElement>('[role="dialog"]')
    const input = document.body.querySelector<HTMLInputElement>('[data-testid="panel-input"]')
    expect(panel?.getAttribute('aria-label')).toBe('Choose a model')
    expect(document.activeElement).toBe(input)
    expect(wrapper.emitted('openChange')?.[0]).toEqual([true])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(document.activeElement).toBe(trigger.element)
    expect(wrapper.emitted('openChange')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })
})
