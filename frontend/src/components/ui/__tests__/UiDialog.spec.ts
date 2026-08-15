import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiConfirmDialog from '../UiConfirmDialog.vue'
import UiDialog from '../UiDialog.vue'

const wrappers: VueWrapper[] = []

function mountDialog(title: string, extraProps: Record<string, unknown> = {}) {
  const wrapper = mount(UiDialog, {
    attachTo: document.body,
    props: { show: true, title, ...extraProps },
    slots: { default: `<button data-test="${title}">${title}</button>` }
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  document.body.style.overflow = ''
  document.body.innerHTML = ''
})

describe('UiDialog', () => {
  it('renders its contract and only closes outside when enabled', async () => {
    const wrapper = mountDialog('Settings', { closeOnClickOutside: true, closeLabel: 'Close' })
    const dialog = document.body.querySelector<HTMLElement>('.ui-dialog')
    const overlay = document.body.querySelector<HTMLElement>('.ui-dialog__overlay')
    const close = document.body.querySelector<HTMLButtonElement>('[aria-label="Close"]')

    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(close?.type).toBe('button')
    overlay?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes only the top overlay and restores the opener focus', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const first = mountDialog('First')
    const second = mountDialog('Second')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(second.emitted('close')).toHaveLength(1)
    expect(first.emitted('close')).toBeUndefined()

    await second.setProps({ show: false })
    await first.setProps({ show: false })
    expect(document.activeElement).toBe(opener)
  })

  it('raises later overlays above a requested custom layer', () => {
    mountDialog('First', { zIndex: 120 })
    mountDialog('Second', { zIndex: 40 })
    const layers = [...document.body.querySelectorAll<HTMLElement>('.ui-dialog__overlay')]
    expect(Number(layers[1]?.style.zIndex)).toBeGreaterThan(Number(layers[0]?.style.zIndex))
  })
})

describe('UiConfirmDialog', () => {
  it('blocks every close path and confirmation while pending', async () => {
    const wrapper = mount(UiConfirmDialog, {
      attachTo: document.body,
      props: { show: true, title: 'Delete', message: 'This cannot be undone', pending: true }
    })
    wrappers.push(wrapper)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    const buttons = [...document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button')]
    buttons.forEach(button => button.click())

    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(document.body.querySelector('.ui-dialog__header button')).toBeNull()
  })

  it('focuses cancel and respects confirmDisabled', async () => {
    const wrapper = mount(UiConfirmDialog, {
      attachTo: document.body,
      props: {
        show: true,
        title: 'Delete',
        message: 'This cannot be undone',
        confirmDisabled: true,
        cancelText: 'Back',
        confirmText: 'Delete'
      }
    })
    wrappers.push(wrapper)
    await wrapper.vm.$nextTick()

    const cancel = document.body.querySelector<HTMLButtonElement>('.ui-dialog__footer button')
    const confirm = document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button')[1]
    expect(document.activeElement).toBe(cancel)
    confirm?.click()
    expect(wrapper.emitted('confirm')).toBeUndefined()
    cancel?.click()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
