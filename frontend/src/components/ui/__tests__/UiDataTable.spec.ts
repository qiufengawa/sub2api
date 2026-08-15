import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiDataTable from '../UiDataTable.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const wrappers: VueWrapper[] = []

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  document.body.innerHTML = ''
})

describe('UiDataTable', () => {
  it('keeps the named, focusable horizontal table region', () => {
    const wrapper = mount(UiDataTable, {
      attachTo: document.body,
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }],
        ariaLabel: 'Accounts table'
      }
    })
    wrappers.push(wrapper)
    const region = wrapper.get('[role="region"]')
    expect(region.attributes('tabindex')).toBe('0')
    expect(region.attributes('aria-label')).toBe('Accounts table')
    expect(wrapper.text()).toContain('Alpha')
  })

  it('forwards controlled selection events from the new core', async () => {
    const wrapper = mount(UiDataTable, {
      attachTo: document.body,
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
        selectable: true,
        selectedKeys: []
      }
    })
    wrappers.push(wrapper)
    await wrapper.get('[data-test="select-row"]').setValue(true)
    expect(wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]).toEqual([1])
    expect(wrapper.emitted('selectionChange')?.at(-1)?.[0]).toEqual([1])
  })
})
