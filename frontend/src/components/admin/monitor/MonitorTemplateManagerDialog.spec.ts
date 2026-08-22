import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelMonitorTemplate } from '@/api/admin/channelMonitorTemplate'
import { UiAlert, UiErrorState } from '@/components/ui'
import MonitorTemplateManagerDialog from './MonitorTemplateManagerDialog.vue'

const { listTemplates, deleteTemplate, showError, showSuccess } = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  deleteTemplate: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    channelMonitorTemplate: {
      list: listTemplates,
      create: vi.fn(),
      update: vi.fn(),
      del: deleteTemplate,
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const template: ChannelMonitorTemplate = {
  id: 3,
  name: 'Default headers',
  provider: 'anthropic',
  api_mode: 'chat_completions',
  description: 'Shared request headers',
  extra_headers: {},
  body_override_mode: 'off',
  body_override: null,
  created_at: '2026-08-16T00:00:00Z',
  updated_at: '2026-08-16T00:00:00Z',
  associated_monitors: 1,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function mountDialog() {
  return mount(MonitorTemplateManagerDialog, {
    props: { show: true },
    global: {
      stubs: {
        UiDialog: { props: ['show'], template: '<section v-if="show"><slot/><slot name="footer"/></section>' },
        MonitorAdvancedRequestConfig: true,
        MonitorTemplateApplyPickerDialog: true,
        UiConfirmDialog: true,
      },
    },
  })
}

describe('MonitorTemplateManagerDialog state handling', () => {
  beforeEach(() => {
    listTemplates.mockReset().mockResolvedValue({ items: [template] })
    deleteTemplate.mockReset().mockResolvedValue(undefined)
    showError.mockReset()
    showSuccess.mockReset()
  })

  it('renders a retryable error instead of an empty state, then recovers in place', async () => {
    listTemplates.mockRejectedValueOnce(new Error('template network error'))
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.getComponent(UiErrorState).props('title')).toBe('admin.channelMonitor.template.loadError')
    expect(showError).toHaveBeenCalledWith('template network error')

    wrapper.getComponent(UiErrorState).vm.$emit('retry')
    await flushPromises()
    expect(wrapper.findComponent(UiErrorState).exists()).toBe(false)
    expect(wrapper.text()).toContain('Default headers')
    wrapper.unmount()
  })

  it('keeps loaded templates and a persistent alert when refresh fails', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    listTemplates.mockRejectedValueOnce(new Error('refresh failed'))

    await (wrapper.vm as any).fetchTemplates()
    await flushPromises()

    expect(wrapper.text()).toContain('Default headers')
    expect(wrapper.getComponent(UiAlert).props('message')).toBe('admin.channelMonitor.template.loadError')
    wrapper.unmount()
  })

  it('keeps loaded templates visible while a refresh is pending', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const pending = deferred<{ items: ChannelMonitorTemplate[] }>()
    listTemplates.mockReturnValueOnce(pending.promise)

    const request = (wrapper.vm as any).fetchTemplates()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Default headers')

    pending.resolve({ items: [template] })
    await request
    wrapper.unmount()
  })

  it('aborts a stale template request and ignores its late response', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const stale = deferred<{ items: ChannelMonitorTemplate[] }>()
    listTemplates.mockReturnValueOnce(stale.promise)
    const vm = wrapper.vm as any

    const staleRequest = vm.fetchTemplates()
    const staleSignal = listTemplates.mock.calls.at(-1)?.[1]?.signal as AbortSignal
    const latest = { ...template, id: 4, name: 'Latest template' }
    listTemplates.mockResolvedValueOnce({ items: [latest] })
    await vm.fetchTemplates()

    expect(staleSignal.aborted).toBe(true)
    expect(vm.templates[0].id).toBe(4)
    stale.resolve({ items: [template] })
    await staleRequest
    expect(vm.templates[0].id).toBe(4)
    wrapper.unmount()
  })

  it('aborts the active template request when the dialog closes', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const pending = deferred<{ items: ChannelMonitorTemplate[] }>()
    listTemplates.mockReturnValueOnce(pending.promise)
    const request = (wrapper.vm as any).fetchTemplates()
    const signal = listTemplates.mock.calls.at(-1)?.[1]?.signal as AbortSignal

    await wrapper.setProps({ show: false })
    expect(signal.aborted).toBe(true)
    pending.resolve({ items: [] })
    await request
    expect((wrapper.vm as any).templates).toEqual([template])
    wrapper.unmount()
  })

  it('prevents repeated template deletion while the first request is pending', async () => {
    const pending = deferred<void>()
    deleteTemplate.mockReturnValueOnce(pending.promise)
    const wrapper = mountDialog()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.handleDelete(template)

    const first = vm.doDelete()
    const second = vm.doDelete()
    expect(deleteTemplate).toHaveBeenCalledOnce()
    expect(vm.deleting).toBe(true)

    pending.resolve()
    await Promise.all([first, second])
    expect(vm.deleting).toBe(false)
    expect(vm.confirmDelete.show).toBe(false)
    wrapper.unmount()
  })

  it('clears a successful delete target before a list refresh failure', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    listTemplates.mockRejectedValueOnce(new Error('refresh after delete failed'))
    const vm = wrapper.vm as any
    vm.handleDelete(template)

    await vm.doDelete()
    await flushPromises()

    expect(deleteTemplate).toHaveBeenCalledWith(template.id)
    expect(vm.confirmDelete.show).toBe(false)
    expect(vm.confirmDelete.tpl).toBeNull()
    expect(vm.templates).toEqual([])
    expect(wrapper.text()).not.toContain('Default headers')
    expect(showError).toHaveBeenCalledWith('refresh after delete failed')
    wrapper.unmount()
  })
})
