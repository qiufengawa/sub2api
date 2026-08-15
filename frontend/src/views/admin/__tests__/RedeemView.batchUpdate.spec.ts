import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import RedeemView from '../RedeemView.vue'

const { listRedeemCodes, batchDeleteRedeemCodes, batchUpdateRedeemCodes, getPlans, showSuccess, showError, showInfo } =
  vi.hoisted(() => ({
    listRedeemCodes: vi.fn(),
    batchDeleteRedeemCodes: vi.fn(),
    batchUpdateRedeemCodes: vi.fn(),
    getPlans: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn()
  }))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    redeem: {
      list: listRedeemCodes,
      generate: vi.fn(),
      delete: vi.fn(),
      batchDelete: batchDeleteRedeemCodes,
      batchUpdate: batchUpdateRedeemCodes,
      exportCodes: vi.fn()
    },
    payment: {
      getPlans
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showSuccess,
    showError,
    showInfo
  })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard: vi.fn()
  })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const DataTableStub = {
  props: ['columns', 'data'],
  template: `
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">
            <slot :name="'header-' + column.key" :column="column">{{ column.label }}</slot>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="row.id">
          <td v-for="column in columns" :key="column.key">
            <slot :name="'cell-' + column.key" :row="row" :value="row[column.key]">
              {{ row[column.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  `
}

const SelectStub = {
  props: ['modelValue', 'options'],
  emits: ['update:modelValue', 'change'],
  setup(props: { options: Array<{ value: unknown; label: string }> }, { emit }: { emit: (event: string, ...args: unknown[]) => void }) {
    const onChange = (event: Event) => {
      const raw = (event.target as HTMLSelectElement).value
      const option = props.options.find((item) => String(item.value ?? '') === raw)
      const value = option ? option.value : raw
      emit('update:modelValue', value)
      emit('change', value, option ?? null)
    }
    return { onChange }
  },
  template: `
    <select v-bind="$attrs" :value="modelValue ?? ''" @change="onChange">
      <option v-for="option in options" :key="String(option.value ?? '')" :value="option.value ?? ''">
        {{ option.label }}
      </option>
    </select>
  `
}

const CheckboxStub = {
  inheritAttrs: false,
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: `<input v-bind="$attrs" type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />`
}

const TextAreaStub = {
  inheritAttrs: false,
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `<textarea v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}

const mountView = () => mount(RedeemView, {
  attachTo: document.body,
  global: {
    stubs: {
      AppLayout: { template: '<div><slot /></div>' },
      UiServerTableWorkspace: {
        template: '<div><slot name="filters" /><slot /><slot name="pagination" /></div>'
      },
      UiDataTable: DataTableStub,
      UiPagination: true,
      UiConfirmDialog: true,
      UiDialog: { props: ['show'], template: '<section v-if="show"><slot/><slot name="footer"/></section>' },
      UiSelect: SelectStub,
      UiCheckbox: CheckboxStub,
      UiTextArea: TextAreaStub,
      Icon: true,
      Teleport: true
    }
  }
})

describe('admin RedeemView batch update', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''

    listRedeemCodes.mockReset()
    batchDeleteRedeemCodes.mockReset()
    batchUpdateRedeemCodes.mockReset()
    getPlans.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
    showInfo.mockReset()

    listRedeemCodes.mockResolvedValue({
      items: [
        {
          id: 1,
          code: 'CODE-1',
          type: 'balance',
          value: 10,
          status: 'unused',
          used_by: null,
          used_at: null,
          created_at: '2026-01-01T00:00:00Z',
          expires_at: null
        },
        {
          id: 2,
          code: 'CODE-2',
          type: 'balance',
          value: 20,
          status: 'unused',
          used_by: null,
          used_at: null,
          created_at: '2026-01-01T00:00:00Z',
          expires_at: null
        }
      ],
      total: 2,
      page: 1,
      page_size: 20,
      pages: 1
    })
    batchUpdateRedeemCodes.mockResolvedValue({ updated: 1, message: 'ok' })
    batchDeleteRedeemCodes.mockResolvedValue({ deleted: 1, message: 'ok' })
    getPlans.mockResolvedValue({ data: [] })
  })

  it('submits only checked fields for selected redeem codes', async () => {
    const wrapper = mountView()

    await flushPromises()
    await wrapper.findAll('[data-test="select-code"]')[0].setValue(true)
    await wrapper.get('[data-test="batch-update-open"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-test="batch-field-status"]').setValue(true)
    await wrapper.get('[data-test="batch-status-select"]').setValue('disabled')
    await wrapper.get('[data-test="batch-field-notes"]').setValue(true)
    await wrapper.get('[data-test="batch-notes-input"]').setValue('maintenance')
    await wrapper.get('[data-test="batch-update-form"]').trigger('submit')
    await flushPromises()

    expect(batchUpdateRedeemCodes).toHaveBeenCalledWith([1], {
      status: 'disabled',
      notes: 'maintenance'
    })
    expect(showSuccess).toHaveBeenCalledWith('admin.redeem.batchUpdateSuccess')
  })

  it('resets the server page when applying a filter', async () => {
    const wrapper = mountView()
    await flushPromises()
    listRedeemCodes.mockClear()
    const vm = wrapper.vm as any

    vm.pagination.page = 4
    vm.filters.status = 'unused'
    await vm.applyFilters()

    expect(listRedeemCodes).toHaveBeenLastCalledWith(
      1,
      expect.any(Number),
      expect.objectContaining({ status: 'unused' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('keeps selected subscription type metadata across pages', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any

    vm.clearSelectedCodes()
    vm.toggleSelectRow({ id: 91, type: 'subscription' }, true)
    expect(vm.selectedCodesAreSubscription).toBe(true)

    vm.toggleSelectRow({ id: 92, type: 'balance' }, true)
    expect(vm.selectedCodesAreSubscription).toBe(false)
  })

  it('collects every unused-code page before deleting', async () => {
    const wrapper = mountView()
    await flushPromises()
    listRedeemCodes.mockReset()
    listRedeemCodes
      .mockResolvedValueOnce({ items: [{ id: 11 }, { id: 12 }], total: 3, page: 1, page_size: 200, pages: 2 })
      .mockResolvedValueOnce({ items: [{ id: 13 }], total: 3, page: 2, page_size: 200, pages: 2 })
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
    batchDeleteRedeemCodes.mockResolvedValue({ deleted: 3, message: 'ok' })

    await (wrapper.vm as any).confirmDeleteUnused()

    expect(listRedeemCodes).toHaveBeenNthCalledWith(1, 1, 200, { status: 'unused' })
    expect(listRedeemCodes).toHaveBeenNthCalledWith(2, 2, 200, { status: 'unused' })
    expect(batchDeleteRedeemCodes).toHaveBeenCalledWith([11, 12, 13])
  })
})
