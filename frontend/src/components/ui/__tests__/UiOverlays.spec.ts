import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiDrawer from '../UiDrawer.vue'
import UiFullscreenPanel from '../UiFullscreenPanel.vue'
import UiSheet from '../UiSheet.vue'

const iconStub = { template: '<i />' }

afterEach(() => {
  document.body.style.overflow = ''
  document.body.innerHTML = ''
})

describe('Qiu UI overlay lifecycle', () => {
  it.each([
    ['drawer', UiDrawer],
    ['sheet', UiSheet],
    ['fullscreen', UiFullscreenPanel]
  ])('locks scroll and closes %s with Escape', async (_, component) => {
    const wrapper = mount(component, {
      attachTo: document.body,
      props: { show: true, title: 'Detail' },
      global: { stubs: { Icon: iconStub, Teleport: false } }
    })

    expect(document.body.style.overflow).toBe('hidden')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.setProps({ show: false })
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('traps keyboard focus inside the top overlay', async () => {
    const wrapper = mount(UiDrawer, {
      attachTo: document.body,
      props: { show: true, title: 'Detail' },
      slots: { default: '<button id="first">First</button><button id="last">Last</button>' },
      global: { stubs: { Icon: iconStub, Teleport: false } }
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    const buttons = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    const last = buttons.at(-1) as HTMLButtonElement
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.body.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })
})
