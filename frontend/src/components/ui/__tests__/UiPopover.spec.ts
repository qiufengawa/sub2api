import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import UiPopover from '../UiPopover.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UiPopover accessibility', () => {
  it('keeps trigger and panel roles aligned for the default menu contract', async () => {
    const wrapper = mount(UiPopover, {
      attachTo: document.body,
      slots: {
        trigger: '<button type="button" data-testid="menu-trigger">Actions</button>',
        default: '<button role="menuitem">Edit</button>'
      }
    })

    const trigger = wrapper.get('[data-testid="menu-trigger"]')
    await trigger.trigger('click')
    await flushPromises()

    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(document.body.querySelector('[role="menu"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('supports menu arrow navigation and lets Tab leave the popup', async () => {
    const wrapper = mount(UiPopover, {
      attachTo: document.body,
      slots: {
        trigger: '<button type="button" data-testid="keyboard-menu-trigger">Actions</button>',
        default: '<button role="menuitem" data-testid="first-action">Edit</button><button role="menuitem" data-testid="second-action">Delete</button>'
      }
    })

    const trigger = wrapper.get('[data-testid="keyboard-menu-trigger"]')
    await trigger.trigger('click')
    await flushPromises()
    const first = document.body.querySelector<HTMLButtonElement>('[data-testid="first-action"]')!
    const second = document.body.querySelector<HTMLButtonElement>('[data-testid="second-action"]')!
    expect(document.activeElement).toBe(first)

    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(second)

    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('forwards non-menu popup roles to the trigger', async () => {
    const wrapper = mount(UiPopover, {
      attachTo: document.body,
      props: { panelRole: 'listbox', ariaLabel: 'Models' },
      slots: {
        trigger: '<button type="button" data-testid="listbox-trigger">Models</button>',
        default: '<button role="option">GPT</button>'
      }
    })

    const trigger = wrapper.get('[data-testid="listbox-trigger"]')
    await trigger.trigger('click')
    await flushPromises()

    expect(trigger.attributes('aria-haspopup')).toBe('listbox')
    expect(document.body.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe('Models')
    wrapper.unmount()
  })

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
    const triggerShell = trigger.element.parentElement!

    await trigger.trigger('click')
    await flushPromises()

    const panel = document.body.querySelector<HTMLElement>('[role="dialog"]')
    const input = document.body.querySelector<HTMLInputElement>('[data-testid="panel-input"]')
    expect(panel?.getAttribute('aria-label')).toBe('Choose a model')
    expect(panel?.getAttribute('aria-modal')).toBe('true')
    expect(triggerShell.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.element.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.element.getAttribute('aria-haspopup')).toBe('dialog')
    expect(triggerShell.getAttribute('aria-controls')).toBe(panel?.id)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(input)
    expect(wrapper.emitted('openChange')?.[0]).toEqual([true])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(document.activeElement).toBe(trigger.element)
    expect(trigger.element.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe('')
    expect(wrapper.emitted('openChange')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('keeps keyboard focus inside a dialog panel', async () => {
    const wrapper = mount(UiPopover, {
      attachTo: document.body,
      props: { panelRole: 'dialog' },
      slots: {
        trigger: '<button type="button">Open</button>',
        default: '<button data-testid="first">First</button><button data-testid="last">Last</button>'
      }
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()
    const first = document.body.querySelector<HTMLButtonElement>('[data-testid="first"]')!
    const last = document.body.querySelector<HTMLButtonElement>('[data-testid="last"]')!

    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    first.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)
    wrapper.unmount()
  })

  it('restores focus and body scrolling when dismissed outside a dialog', async () => {
    const wrapper = mount(UiPopover, {
      attachTo: document.body,
      props: { panelRole: 'dialog' },
      slots: {
        trigger: '<button type="button" data-testid="outside-trigger">Open</button>',
        default: '<button>Close me</button>'
      }
    })
    const trigger = wrapper.get('[data-testid="outside-trigger"]')
    await trigger.trigger('click')
    await flushPromises()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.click()
    await flushPromises()

    expect(document.activeElement).toBe(trigger.element)
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })
})
