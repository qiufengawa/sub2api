import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BaseDialog from '../BaseDialog.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

const wrappers: VueWrapper[] = []

function mountDialog(title: string, props: { zIndex?: number } = {}) {
  const wrapper = mount(BaseDialog, {
    attachTo: document.body,
    props: { show: true, title, ...props },
    slots: {
      default: `<button type="button" data-test="${title}">${title}</button>`,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

function pressKey(key: string, options: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  }))
}

afterEach(() => {
  while (wrappers.length > 0) wrappers.pop()?.unmount()
  document.body.classList.remove('modal-open')
  document.body.innerHTML = ''
})

describe('BaseDialog', () => {
  it('keeps body scrolling locked until the last dialog closes', async () => {
    const first = mountDialog('first')
    const second = mountDialog('second')

    expect(document.body.classList.contains('modal-open')).toBe(true)

    await second.setProps({ show: false })
    expect(document.body.classList.contains('modal-open')).toBe(true)

    await first.setProps({ show: false })
    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('traps tab focus inside the top-most dialog', async () => {
    mountDialog('focus')
    const panel = document.body.querySelector<HTMLElement>('[role="dialog"] .modal-content')
    const focusable = Array.from(
      panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    last.focus()
    pressKey('Tab')

    expect(document.activeElement).toBe(first)
  })

  it('closes only the top-most dialog on Escape', async () => {
    const first = mountDialog('first')
    const second = mountDialog('second')

    pressKey('Escape')

    expect(second.emitted('close')).toHaveLength(1)
    expect(first.emitted('close')).toBeUndefined()
  })

  it('renders a later dialog above an existing custom layer', () => {
    mountDialog('elevated', { zIndex: 100 })
    mountDialog('nested')

    const overlays = Array.from(document.body.querySelectorAll<HTMLElement>('.modal-overlay'))
    expect(Number(overlays[1]?.style.zIndex)).toBeGreaterThan(Number(overlays[0]?.style.zIndex))
  })

  it('restores focus to the element that opened the dialog', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const wrapper = mountDialog('restore-focus')
    await wrapper.setProps({ show: false })

    expect(document.activeElement).toBe(opener)
  })

  it('restores focus when an open dialog is unmounted', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const wrapper = mountDialog('unmount-focus')
    await wrapper.vm.$nextTick()
    wrappers.pop()
    wrapper.unmount()

    expect(document.activeElement).toBe(opener)
  })

  it('labels the close button and keeps focus in a dialog without slot controls', async () => {
    const wrapper = mount(BaseDialog, {
      attachTo: document.body,
      props: { show: true, title: 'empty' },
    })
    wrappers.push(wrapper)

    const closeButton = document.body.querySelector<HTMLButtonElement>('.modal-header button')
    expect(closeButton?.type).toBe('button')
    expect(closeButton?.getAttribute('aria-label')).toBe('common.close')

    closeButton?.setAttribute('disabled', '')
    const panel = document.body.querySelector<HTMLElement>('.modal-content')
    panel?.focus()
    pressKey('Tab')

    expect(document.activeElement).toBe(panel)
  })
})
