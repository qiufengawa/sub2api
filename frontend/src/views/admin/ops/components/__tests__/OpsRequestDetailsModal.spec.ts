import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UiDataTable, UiPagination } from '@/components/ui'
import OpsRequestDetailsModal from '../OpsRequestDetailsModal.vue'

const { listRequestDetails, copyToClipboard, showError, showWarning } = vi.hoisted(() => ({
  listRequestDetails: vi.fn(),
  copyToClipboard: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: { listRequestDetails },
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard }),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({ showError, showWarning }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const rows = [
  {
    kind: 'error',
    created_at: '2026-08-16T09:00:00Z',
    request_id: 'req-error',
    platform: 'openai',
    model: 'gpt-5',
    duration_ms: 900,
    status_code: 500,
    error_id: 9,
  },
  {
    kind: 'success',
    created_at: '2026-08-16T09:01:00Z',
    request_id: 'req-success',
    platform: 'openai',
    model: 'gpt-5-mini',
    duration_ms: 120,
    status_code: 200,
  },
]

function mountModal() {
  return mount(OpsRequestDetailsModal, {
    attachTo: document.body,
    props: {
      modelValue: false,
      timeRange: '1h',
      platform: 'openai',
      groupId: 7,
      preset: {
        title: 'Slow requests',
        kind: 'error',
        sort: 'duration_desc',
        min_duration_ms: 500,
      },
    },
  })
}

describe('OpsRequestDetailsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    copyToClipboard.mockResolvedValue(true)
    listRequestDetails.mockResolvedValue({ items: rows, total: rows.length })
  })

  it('loads the selected preset and keeps mobile on the shared table layout', async () => {
    const wrapper = mountModal()
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(listRequestDetails).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      page_size: 10,
      kind: 'error',
      sort: 'duration_desc',
      min_duration_ms: 500,
      platform: 'openai',
      group_id: 7,
    }))
    expect(wrapper.getComponent(UiDataTable).props('mobileTable')).toBe(true)
    expect(document.body.textContent).toContain('req-error')
    expect(document.body.textContent).toContain('req-success')

    wrapper.unmount()
  })

  it('keeps copy, error detail, and pagination behavior connected', async () => {
    const wrapper = mountModal()
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    const copyButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="admin.ops.requestDetails.copy"]'
    )
    copyButton?.click()
    await flushPromises()
    expect(copyToClipboard).toHaveBeenCalledWith(
      'req-error',
      'admin.ops.requestDetails.requestIdCopied'
    )

    const viewError = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('admin.ops.requestDetails.viewError')
    )
    viewError?.click()
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(wrapper.emitted('openErrorDetail')).toEqual([[9]])

    const pagination = wrapper.getComponent(UiPagination)
    await pagination.vm.$emit('update:pageSize', 33)
    await flushPromises()
    expect(localStorage.getItem('table-page-size')).toBe('50')
    expect(listRequestDetails).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1,
      page_size: 50,
    }))

    wrapper.unmount()
  })
})
