import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiQuotaSummary from '../UiQuotaSummary.vue'

describe('UiQuotaSummary', () => {
  it('exposes the visible quota label as the progressbar accessible name', () => {
    const wrapper = mount(UiQuotaSummary, {
      props: {
        label: 'Monthly requests',
        used: 42,
        total: 100,
        resetText: 'Resets tomorrow',
      },
    })

    const progress = wrapper.get('[role="progressbar"]')
    expect(progress.attributes('aria-label')).toBe('Monthly requests')
    expect(progress.attributes('aria-valuenow')).toBe('42')
    expect(wrapper.text()).toContain('Resets tomorrow')
  })
})
