import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const loadAnimation = vi.hoisted(() => vi.fn())

vi.mock('lottie-web', () => ({
  default: { loadAnimation },
}))

import HomeEarthAnimation from '../HomeEarthAnimation.vue'

function setReducedMotion(matches: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('HomeEarthAnimation', () => {
  const destroy = vi.fn()
  const goToAndStop = vi.fn()

  beforeEach(() => {
    destroy.mockReset()
    goToAndStop.mockReset()
    loadAnimation.mockReset().mockReturnValue({ destroy, goToAndStop })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ layers: [] }),
    }))
    setReducedMotion(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('autoplays and loops the hero animation when full motion is allowed', async () => {
    mount(HomeEarthAnimation)
    await flushPromises()

    expect(loadAnimation).toHaveBeenCalledWith(expect.objectContaining({
      renderer: 'svg',
      loop: true,
      autoplay: true,
      assetsPath: '/animations/home-earth/images/',
    }))
    expect(goToAndStop).not.toHaveBeenCalled()
  })

  it('renders a static first frame when reduced motion is requested', async () => {
    setReducedMotion(true)
    mount(HomeEarthAnimation)
    await flushPromises()

    expect(loadAnimation).toHaveBeenCalledWith(expect.objectContaining({
      loop: false,
      autoplay: false,
    }))
    expect(goToAndStop).toHaveBeenCalledWith(0, true)
  })

  it('keeps the hero usable when the animation asset request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }))

    const wrapper = mount(HomeEarthAnimation)
    await flushPromises()

    expect(loadAnimation).not.toHaveBeenCalled()
    expect(wrapper.get('.home-earth-canvas').attributes('aria-hidden')).toBe('true')
  })

  it('destroys the Lottie instance when the component unmounts', async () => {
    const wrapper = mount(HomeEarthAnimation)
    await flushPromises()

    wrapper.unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
