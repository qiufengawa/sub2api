import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiToast from '../UiToast.vue'

describe('UiToast', () => {
  it('uses alert semantics for danger and emits close', async () => {
    const wrapper = mount(UiToast, {
      props: { show: true, tone: 'danger', message: 'Request failed' }
    })
    expect(wrapper.get('[role="alert"]').attributes('aria-live')).toBe('assertive')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
