import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import AppPage from '../AppPage.vue'

describe('AppPage landmark contract', () => {
  it('renders a neutral page wrapper so AppLayout owns the single main landmark', () => {
    const wrapper = mount(AppPage, { slots: { default: 'content' } })

    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.find('main').exists()).toBe(false)
    expect(wrapper.text()).toBe('content')
  })
})
