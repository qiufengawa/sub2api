import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import HelpTooltip from '@/components/common/HelpTooltip.vue'

function getTooltipElement(): HTMLDivElement {
  const tooltip = document.body.querySelector('[role="tooltip"]')
  if (!(tooltip instanceof HTMLDivElement)) {
    throw new Error('tooltip element not found')
  }
  return tooltip
}

describe('HelpTooltip', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('keeps the existing hover interaction by default', async () => {
    const wrapper = mount(HelpTooltip, {
      attachTo: document.body,
      props: {
        content: 'hover details',
      },
    })

    const trigger = wrapper.get('.group')
    const tooltip = getTooltipElement()

    expect(tooltip.style.display).toBe('none')

    await trigger.trigger('mouseenter')
    await nextTick()
    expect(tooltip.style.display).not.toBe('none')

    await trigger.trigger('mouseleave')
    await nextTick()
    expect(tooltip.style.display).toBe('none')

    wrapper.unmount()
  })

  it('supports click-to-toggle details and closes on outside click', async () => {
    const wrapper = mount(HelpTooltip, {
      attachTo: document.body,
      props: {
        content: 'click details',
        trigger: 'click',
      },
    })

    const trigger = wrapper.get('.group')
    const tooltip = getTooltipElement()

    expect(tooltip.style.display).toBe('none')

    await trigger.trigger('click')
    await nextTick()
    expect(tooltip.style.display).not.toBe('none')
    expect(tooltip.textContent).toContain('click details')

    const closeButton = tooltip.querySelector('button[aria-label="Close"]')
    if (!(closeButton instanceof HTMLButtonElement)) {
      throw new Error('close button not found')
    }
    closeButton.click()
    await nextTick()
    expect(tooltip.style.display).toBe('none')

    await trigger.trigger('click')
    await nextTick()
    expect(tooltip.style.display).not.toBe('none')

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(tooltip.style.display).toBe('none')

    wrapper.unmount()
  })

  it('uses viewport coordinates and flips below when the upper space is insufficient', async () => {
    const wrapper = mount(HelpTooltip, {
      attachTo: document.body,
      props: { content: 'positioned details', widthClass: 'w-72' },
    })
    const trigger = wrapper.get('.group')
    const tooltip = getTooltipElement()

    vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue({
      x: 557,
      y: 238,
      left: 557,
      top: 238,
      right: 741,
      bottom: 270,
      width: 184,
      height: 32,
      toJSON: () => ({}),
    })
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 288,
      bottom: 260,
      width: 288,
      height: 260,
      toJSON: () => ({}),
    })
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(700)
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(120)

    await trigger.trigger('mouseenter')
    await nextTick()

    expect(tooltip.dataset.placement).toBe('bottom')
    expect(tooltip.style.top).toBe('278px')
    expect(tooltip.style.left).toBe('649px')
    expect(tooltip.classList.contains('translate-y-0')).toBe(true)

    wrapper.unmount()
  })

  it('clamps the horizontal center inside the viewport', async () => {
    const wrapper = mount(HelpTooltip, {
      attachTo: document.body,
      props: { content: 'edge details', widthClass: 'w-72' },
    })
    const trigger = wrapper.get('.group')
    const tooltip = getTooltipElement()

    vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue({
      x: 4,
      y: 500,
      left: 4,
      top: 500,
      right: 44,
      bottom: 532,
      width: 40,
      height: 32,
      toJSON: () => ({}),
    })
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 288,
      bottom: 100,
      width: 288,
      height: 100,
      toJSON: () => ({}),
    })
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(320)
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(700)

    await trigger.trigger('mouseenter')
    await nextTick()

    expect(tooltip.dataset.placement).toBe('top')
    expect(tooltip.style.top).toBe('492px')
    expect(tooltip.style.left).toBe('152px')
    expect(tooltip.classList.contains('-translate-y-full')).toBe(true)

    wrapper.unmount()
  })
})
