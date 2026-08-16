import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import AnnouncementReadStatusDialog from '../AnnouncementReadStatusDialog.vue'

const { getReadStatus, showError } = vi.hoisted(() => ({
  getReadStatus: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    announcements: {
      getReadStatus,
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@/composables/usePersistedPageSize', () => ({
  getPersistedPageSize: () => 20,
}))

const UiDrawerStub = {
  props: ['show', 'title', 'width'],
  emits: ['close'],
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
}

const UiDataTableStub = {
  props: ['data'],
  template: '<div><slot v-if="!data?.length" name="empty" /></div>',
}

const UiErrorStateStub = {
  props: ['title'],
  emits: ['retry'],
  template: '<div>{{ title }}<button @click="$emit(\'retry\')">retry</button></div>',
}

describe('AnnouncementReadStatusDialog', () => {
  beforeEach(() => {
    getReadStatus.mockReset()
    showError.mockReset()
    vi.useFakeTimers()
  })

  it('closes by aborting active requests and clearing debounced reloads', async () => {
    let activeSignal: AbortSignal | undefined
    getReadStatus.mockImplementation(async (...args: any[]) => {
      activeSignal = args[4]?.signal
      return new Promise(() => {})
    })

    const wrapper = mount(AnnouncementReadStatusDialog, {
      props: {
        show: false,
        announcementId: 1,
      },
      global: {
        stubs: {
          UiDrawer: UiDrawerStub,
          UiDataTable: true,
          UiPagination: true,
          Icon: true,
        },
      },
    })

    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(getReadStatus).toHaveBeenCalledTimes(1)
    expect(activeSignal?.aborted).toBe(false)

    const setupState = (wrapper.vm as any).$?.setupState
    setupState.search = 'alice'
    setupState.handleSearch()

    setupState.handleClose()
    await flushPromises()

    expect(activeSignal?.aborted).toBe(true)
    expect(wrapper.emitted('close')).toHaveLength(1)

    vi.advanceTimersByTime(350)
    await flushPromises()

    expect(getReadStatus).toHaveBeenCalledTimes(1)
  })

  it('keeps a retryable error state when read-status loading fails', async () => {
    getReadStatus.mockRejectedValueOnce(new Error('network'))
    const wrapper = mount(AnnouncementReadStatusDialog, {
      props: {
        show: false,
        announcementId: 1,
      },
      global: {
        stubs: {
          UiDrawer: UiDrawerStub,
          UiDataTable: UiDataTableStub,
          UiErrorState: UiErrorStateStub,
          UiPagination: true,
          Icon: true,
        },
      },
    })
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect((wrapper.vm as any).loadError).toBe(true)
    expect(wrapper.text()).toContain('admin.announcements.failedToLoadReadStatus')
    expect(showError).toHaveBeenCalledWith('admin.announcements.failedToLoadReadStatus')
    wrapper.unmount()
  })
})
