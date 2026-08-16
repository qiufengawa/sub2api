import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { UiEmptyState, UiTabs } from '@/components/ui'
import ChannelMonitorView from '@/views/admin/ChannelMonitorView.vue'

const { listMonitors } = vi.hoisted(() => ({ listMonitors: vi.fn() }))

vi.mock('@/utils/featureFlags', () => ({
  isChannelMonitorRouteEnabled: () => false,
  isChannelMonitorV1Mode: () => false,
  isChannelMonitorV2Mode: () => false,
  getChannelMonitorMode: () => 'v1' as const,
}))

vi.mock('@/features/channel-monitor-v2/MonitorSettingsPanel.vue', () => ({
  default: { name: 'MonitorSettingsPanel', template: '<div data-testid="v2-settings" />' },
}))

vi.mock('@/api/admin', () => ({
  adminAPI: { channelMonitor: { list: listMonitors } },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

describe('ChannelMonitorView disabled state', () => {
  it('shows a stable disabled state without mounting either monitor implementation', async () => {
    const wrapper = mount(ChannelMonitorView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          MonitorFormDialog: true,
          MonitorTemplateManagerDialog: true,
          MonitorRunResultDialog: true,
          UiConfirmDialog: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.getComponent(UiEmptyState).props('title')).toBe('admin.channelMonitor.featureDisabledTitle')
    expect(wrapper.findComponent(UiTabs).exists()).toBe(false)
    expect(wrapper.find('[data-testid="v2-settings"]').exists()).toBe(false)
    expect(listMonitors).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
