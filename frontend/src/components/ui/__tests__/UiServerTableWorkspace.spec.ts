import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiServerTableWorkspace from '../UiServerTableWorkspace.vue'

describe('UiServerTableWorkspace', () => {
  it('wraps retained table content with the local loading overlay', () => {
    const wrapper = mount(UiServerTableWorkspace, {
      props: { loading: true, loadingText: 'Refreshing plans' },
      slots: { default: '<div data-testid="retained-rows">Current rows</div>' },
    })

    const loadingHost = wrapper.get('.ui-loading-host')
    expect(loadingHost.classes()).toContain('ui-table-workspace__loading-host')
    expect(loadingHost.get('[data-testid="retained-rows"]').text()).toBe('Current rows')
    expect(loadingHost.get('[role="status"]').attributes('aria-label')).toBe('Refreshing plans')
    expect(wrapper.get('.ui-table-workspace').attributes('aria-busy')).toBe('true')
  })

  it('keeps the shared empty state inside the same loading host', () => {
    const wrapper = mount(UiServerTableWorkspace, {
      props: { empty: true, emptyTitle: 'No plans', emptyDescription: 'Create the first plan' },
    })

    const loadingHost = wrapper.get('.ui-loading-host')
    expect(loadingHost.text()).toContain('No plans')
    expect(loadingHost.text()).toContain('Create the first plan')
    expect(loadingHost.find('[role="status"]').exists()).toBe(false)
  })
})
