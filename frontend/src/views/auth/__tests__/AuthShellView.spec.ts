import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthShellView from '../AuthShellView.vue'

describe('AuthShellView', () => {
  it('keeps a stable route stage around authentication child views', () => {
    const wrapper = mount(AuthShellView, {
      global: {
        stubs: {
          AuthLayout: { template: '<main><slot /></main>' },
          RouterView: {
            template: '<div class="router-view-stub" />'
          },
          Transition: false
        }
      }
    })

    expect(wrapper.get('.auth-route-stage').exists()).toBe(true)
    expect(wrapper.get('.router-view-stub').exists()).toBe(true)
  })
})
