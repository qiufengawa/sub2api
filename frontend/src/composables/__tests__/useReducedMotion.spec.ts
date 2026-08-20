import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from '../useReducedMotion'

function mountProbe() {
  return mount(defineComponent({
    setup() {
      const reduced = useReducedMotion()
      return { reduced }
    },
    template: '<output>{{ reduced }}</output>',
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useReducedMotion', () => {
  it('tracks modern MediaQueryList change events and removes the listener', async () => {
    let matches = false
    let listener: (() => void) | undefined
    const remove = vi.fn()
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return matches },
      addEventListener: vi.fn((_type: string, callback: () => void) => { listener = callback }),
      removeEventListener: remove,
    }))

    const wrapper = mountProbe()
    expect(wrapper.text()).toBe('false')
    matches = true
    listener?.()
    await nextTick()
    expect(wrapper.text()).toBe('true')
    wrapper.unmount()
    expect(remove).toHaveBeenCalledOnce()
  })

  it('falls back to the legacy addListener API', async () => {
    let matches = false
    let listener: (() => void) | undefined
    const remove = vi.fn()
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return matches },
      addListener: vi.fn((callback: () => void) => { listener = callback }),
      removeListener: remove,
    }))

    const wrapper = mountProbe()
    matches = true
    listener?.()
    await nextTick()
    expect(wrapper.text()).toBe('true')
    wrapper.unmount()
    expect(remove).toHaveBeenCalledOnce()
  })
})
