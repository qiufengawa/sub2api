import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MonitorFiltersBar from './MonitorFiltersBar.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

describe('MonitorFiltersBar', () => {
  it('counts search and select filters, then clears every filter before reloading page one', () => {
    const wrapper = mount(MonitorFiltersBar, {
      props: {
        search: 'primary',
        provider: 'openai',
        enabled: 'true',
        loading: false,
      },
    })

    expect((wrapper.vm as any).activeFilterCount).toBe(3)
    ;(wrapper.vm as any).clearFilters()

    expect(wrapper.emitted('update:search')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('update:provider')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('update:enabled')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('filter-change')).toHaveLength(1)
    wrapper.unmount()
  })
})
