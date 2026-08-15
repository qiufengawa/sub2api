import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import HeaderOverrideEditor from '../HeaderOverrideEditor.vue'
import HeaderOverrideJsonTools from '../HeaderOverrideJsonTools.vue'

const { copyToClipboard, showError } = vi.hoisted(() => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
  showError: vi.fn()
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showInfo: vi.fn(), showSuccess: vi.fn() })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard })
}))

describe('HeaderOverrideEditor', () => {
  beforeEach(() => {
    copyToClipboard.mockClear()
    showError.mockClear()
  })

  it('keeps row editing and add/remove updates intact', async () => {
    const rows = [{ name: 'x-client', value: 'qiu' }]
    const wrapper = mount(HeaderOverrideEditor, { props: { rows } })

    await wrapper.findAll('input')[0].setValue('x-updated')
    expect(rows[0].name).toBe('x-updated')

    await wrapper.get('button[aria-label="common.delete"]').trigger('click')
    expect(wrapper.emitted('update:rows')?.at(-1)).toEqual([[]])

    const addButton = wrapper.findAll('button').find(button =>
      button.text().includes('admin.accounts.headerOverride.addRow')
    )
    await addButton!.trigger('click')
    expect(wrapper.emitted('update:rows')?.at(-1)).toEqual([
      [{ name: 'x-updated', value: 'qiu' }, { name: '', value: '' }]
    ])
  })

  it('imports and copies JSON through the shared controls', async () => {
    const wrapper = mount(HeaderOverrideJsonTools, {
      props: { rows: [{ name: 'x-client', value: 'qiu' }] }
    })
    const importButton = wrapper.findAll('button').find(button =>
      button.text().includes('admin.accounts.headerOverride.importJson')
    )
    await importButton!.trigger('click')
    await wrapper.get('textarea').setValue('{"x-token":"abc"}')
    const applyButton = wrapper.findAll('button').find(button =>
      button.text().includes('admin.accounts.headerOverride.importJsonApply')
    )
    await applyButton!.trigger('click')

    expect(wrapper.emitted('update:rows')?.at(-1)).toEqual([
      [{ name: 'x-token', value: 'abc' }]
    ])

    const copyButton = wrapper.findAll('button').find(button =>
      button.text().includes('admin.accounts.headerOverride.copyJson')
    )
    await copyButton!.trigger('click')
    await flushPromises()
    expect(copyToClipboard).toHaveBeenCalledWith('{\n  "x-client": "qiu"\n}')
  })

  it('reports invalid imported JSON without changing rows', async () => {
    const wrapper = mount(HeaderOverrideJsonTools, { props: { rows: [] } })
    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.get('textarea').setValue('not-json')
    const applyButton = wrapper.findAll('button').find(button =>
      button.text().includes('admin.accounts.headerOverride.importJsonApply')
    )
    await applyButton!.trigger('click')

    expect(wrapper.emitted('update:rows')).toBeUndefined()
    expect(showError).toHaveBeenCalledWith('admin.accounts.headerOverride.importJsonInvalid')
  })
})
