import { readFileSync } from 'node:fs'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiDialog from '../UiDialog.vue'
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
    ['dialog', UiDialog],
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
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    document.dispatchEvent(escapeEvent)
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(escapeEvent.defaultPrevented).toBe(true)

    await wrapper.setProps({ show: false })
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('keeps Escape disabled when a dialog opts out', () => {
    const wrapper = mount(UiDialog, {
      attachTo: document.body,
      props: { show: true, title: 'Detail', closeOnEscape: false },
      global: { stubs: { Icon: iconStub, Teleport: false } }
    })
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    document.dispatchEvent(escapeEvent)
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(escapeEvent.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('traps keyboard focus and restores the opener', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mount(UiDrawer, {
      attachTo: document.body,
      props: { show: true, title: 'Detail' },
      slots: { default: '<button id="first" autofocus>First</button><button id="last">Last</button>' },
      global: { stubs: { Icon: iconStub, Teleport: false } }
    })
    await nextTick()
    await nextTick()

    const panel = document.body.querySelector<HTMLElement>('.ui-drawer')!
    const close = panel.querySelector<HTMLButtonElement>('header button')!
    const first = panel.querySelector<HTMLButtonElement>('#first')!
    const last = panel.querySelector<HTMLButtonElement>('#last')!
    expect(document.activeElement).toBe(first)

    close.focus()
    const backwards = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(backwards)
    expect(backwards.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    last.focus()
    const forwards = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(forwards)
    expect(forwards.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close)

    await wrapper.setProps({ show: false })
    await nextTick()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
  })

  it('forwards an optional id to the drawer panel for disclosure relationships', () => {
    const wrapper = mount(UiDrawer, {
      attachTo: document.body,
      props: { show: true, title: 'Detail', id: 'custom-page-toc' },
      global: { stubs: { Icon: iconStub, Teleport: false } }
    })

    expect(document.body.querySelector('.ui-drawer')?.id).toBe('custom-page-toc')
    wrapper.unmount()
  })

  it.each([
    ['drawer', '../UiDrawer.vue'],
    ['sheet', '../UiSheet.vue'],
    ['snackbar', '../UiSnackbar.vue'],
    ['accordion', '../UiAccordion.vue']
  ])('disables %s transitions when reduced motion is requested', (_, relativePath) => {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    const reducedMotionBlock = source.match(/@media\(prefers-reduced-motion:reduce\)\{[^}]+\}/)?.[0]

    expect(reducedMotionBlock).toBeTruthy()
    expect(reducedMotionBlock).toContain('transition:none')
  })
})
