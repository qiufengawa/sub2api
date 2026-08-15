import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UiSearchInput } from '@/components/ui'
import OpsErrorDetailsModal from '../OpsErrorDetailsModal.vue'

const { listRequestErrors, listUpstreamErrors } = vi.hoisted(() => ({
  listRequestErrors: vi.fn(),
  listUpstreamErrors: vi.fn(),
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    listRequestErrors,
    listUpstreamErrors,
  },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const ErrorTableStub = defineComponent({
  name: 'OpsErrorLogTable',
  props: {
    rows: { type: Array, default: () => [] },
    total: { type: Number, default: 0 },
    loading: { type: Boolean, default: false },
    page: { type: Number, required: true },
    pageSize: { type: Number, required: true },
  },
  emits: ['openErrorDetail', 'sort', 'update:page', 'update:pageSize'],
  template: '<div data-testid="error-table" />',
})

function mountModal(errorType: 'request' | 'upstream' = 'request') {
  return mount(OpsErrorDetailsModal, {
    attachTo: document.body,
    props: {
      show: false,
      timeRange: '1h',
      platform: 'openai',
      groupId: 7,
      errorType,
    },
    global: {
      stubs: {
        OpsErrorLogTable: ErrorTableStub,
      },
    },
  })
}

describe('OpsErrorDetailsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listRequestErrors.mockResolvedValue({ items: [], total: 3 })
    listUpstreamErrors.mockResolvedValue({ items: [], total: 4 })
  })

  it('loads request errors with the existing scope, sort, and pagination params', async () => {
    const wrapper = mountModal('request')
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(listRequestErrors).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      page_size: 10,
      view: 'errors',
      sort_by: 'created_at',
      sort_order: 'desc',
      time_range: '1h',
      platform: 'openai',
      group_id: 7,
    }))
    expect(listUpstreamErrors).not.toHaveBeenCalled()
    expect(document.body.querySelector('[data-testid="error-table"]')).not.toBeNull()

    wrapper.unmount()
  })

  it('keeps upstream mode on the upstream API and default upstream phase', async () => {
    const wrapper = mountModal('upstream')
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(listUpstreamErrors).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'upstream',
      view: 'errors',
    }))
    expect(listRequestErrors).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('submits the debounced search value and preserves the close event', async () => {
    const wrapper = mountModal('request')
    await wrapper.setProps({ show: true })
    await flushPromises()
    listRequestErrors.mockClear()

    const search = wrapper.getComponent(UiSearchInput)
    await search.vm.$emit('update:modelValue', ' req-7 ')
    await search.vm.$emit('search', ' req-7 ')
    await flushPromises()

    expect(listRequestErrors).toHaveBeenCalledWith(expect.objectContaining({ q: 'req-7' }))

    const closeButton = document.body.querySelector<HTMLButtonElement>('.ui-dialog__header button')
    closeButton?.click()
    await flushPromises()
    expect(wrapper.emitted('update:show')).toEqual([[false]])

    wrapper.unmount()
  })
})
