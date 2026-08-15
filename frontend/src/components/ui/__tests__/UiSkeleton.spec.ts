import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiSkeleton from '../UiSkeleton.vue'

describe('UiSkeleton', () => {
  it('normalizes numeric dimensions and exposes no content to assistive technology', () => {
    const wrapper = mount(UiSkeleton, { props: { width: 120, height: 18 } })
    expect(wrapper.attributes('style')).toContain('width: 120px')
    expect(wrapper.attributes('style')).toContain('height: 18px')
    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('uses stable text and circle geometry', () => {
    const text = mount(UiSkeleton, { props: { variant: 'text' } })
    const circle = mount(UiSkeleton, { props: { variant: 'circle', width: 24 } })
    expect(text.attributes('style')).toContain('height: 1em')
    expect(text.classes()).toContain('ui-skeleton--text')
    expect(circle.classes()).toContain('ui-skeleton--circle')
  })
})
