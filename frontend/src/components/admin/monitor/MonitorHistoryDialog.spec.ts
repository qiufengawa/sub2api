import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelMonitor, HistoryItem } from '@/api/admin/channelMonitor'
import { UiAlert, UiDataTable, UiErrorState } from '@/components/ui'
import MonitorHistoryDialog from './MonitorHistoryDialog.vue'

const { listHistory, showError } = vi.hoisted(() => ({
  listHistory: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: { channelMonitor: { listHistory } },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const monitor: ChannelMonitor = {
  id: 42,
  name: 'Primary relay',
  provider: 'openai',
  api_mode: 'chat_completions',
  endpoint: 'https://api.example.com',
  api_key_masked: 'sk-t***',
  primary_model: 'gpt-primary',
  extra_models: ['gpt-fast'],
  group_name: '',
  enabled: true,
  interval_seconds: 60,
  jitter_seconds: 0,
  last_checked_at: null,
  created_by: 1,
  created_at: '2026-08-16T00:00:00Z',
  updated_at: '2026-08-16T00:00:00Z',
  primary_status: 'operational',
  primary_latency_ms: 128,
  availability_7d: 99.9,
  extra_models_status: [],
  template_id: null,
  extra_headers: {},
  body_override_mode: 'off',
  body_override: null,
}

const historyItem = (id: number, model = 'gpt-primary'): HistoryItem => ({
  id,
  model,
  status: 'operational',
  latency_ms: 128,
  ping_latency_ms: 24,
  message: 'ok',
  checked_at: '2026-08-16T00:00:00Z',
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function mountDialog() {
  return mount(MonitorHistoryDialog, {
    props: { show: true, monitor },
    global: {
      stubs: {
        UiDialog: { props: ['show'], template: '<section v-if="show"><slot/><slot name="footer"/></section>' },
      },
    },
  })
}

describe('MonitorHistoryDialog', () => {
  beforeEach(() => {
    listHistory.mockReset().mockResolvedValue({ items: [historyItem(1)] })
    showError.mockReset()
  })

  it('loads the selected monitor with the default limit and keeps a mobile comparison table', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    expect(listHistory).toHaveBeenCalledWith(
      monitor.id,
      { model: undefined, limit: 50 },
      { signal: expect.any(AbortSignal) },
    )
    expect(wrapper.getComponent(UiDataTable).props('mobileTable')).toBe(true)
    expect(wrapper.text()).toContain('gpt-primary')
    wrapper.unmount()
  })

  it('renders a retryable initial error instead of an empty history', async () => {
    listHistory.mockRejectedValueOnce(new Error('history failed'))
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.getComponent(UiErrorState).props('title')).toBe('admin.channelMonitor.history.loadError')
    expect(showError).toHaveBeenCalledWith('history failed')
    wrapper.unmount()
  })

  it('preserves current rows and an inline alert after a refresh failure', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    listHistory.mockRejectedValueOnce(new Error('refresh failed'))

    await (wrapper.vm as any).loadHistory()
    await flushPromises()

    expect((wrapper.vm as any).items[0].id).toBe(1)
    expect(wrapper.getComponent(UiAlert).props('message')).toBe('admin.channelMonitor.history.loadError')
    wrapper.unmount()
  })

  it('aborts a stale filtered request and ignores its late response', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const stale = deferred<{ items: HistoryItem[] }>()
    listHistory.mockReturnValueOnce(stale.promise)
    const vm = wrapper.vm as any

    vm.selectedModel = 'gpt-fast'
    const staleRequest = vm.loadHistory()
    const staleSignal = listHistory.mock.calls.at(-1)?.[2]?.signal as AbortSignal
    listHistory.mockResolvedValueOnce({ items: [historyItem(2, 'gpt-fast')] })
    await vm.loadHistory()

    expect(staleSignal.aborted).toBe(true)
    expect(vm.items[0].id).toBe(2)
    stale.resolve({ items: [historyItem(1)] })
    await staleRequest
    expect(vm.items[0].id).toBe(2)
    wrapper.unmount()
  })

  it('aborts the active request when the dialog closes', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const pending = deferred<{ items: HistoryItem[] }>()
    listHistory.mockReturnValueOnce(pending.promise)
    const request = (wrapper.vm as any).loadHistory()
    const signal = listHistory.mock.calls.at(-1)?.[2]?.signal as AbortSignal

    await wrapper.setProps({ show: false })
    expect(signal.aborted).toBe(true)
    pending.resolve({ items: [] })
    await request
    expect((wrapper.vm as any).items[0].id).toBe(1)
    wrapper.unmount()
  })
})
