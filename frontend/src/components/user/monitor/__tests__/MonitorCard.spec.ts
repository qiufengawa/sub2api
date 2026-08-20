import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MonitorCard from '../MonitorCard.vue'
import type { UserMonitorView } from '@/api/channelMonitor'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/useChannelMonitorFormat', () => ({
  useChannelMonitorFormat: () => ({
    statusLabel: (status: string) => `status:${status}`,
    providerLabel: (provider: string) => `provider:${provider}`,
    formatLatency: (value: number | null | undefined) => value == null ? '—' : String(value)
  })
}))

const item: UserMonitorView = {
  id: 1,
  name: 'OpenAI primary channel',
  provider: 'openai',
  group_name: 'default',
  primary_model: 'gpt-5.4',
  primary_status: 'operational',
  primary_latency_ms: 420,
  primary_ping_latency_ms: 80,
  availability_7d: 99.9,
  extra_models: [],
  timeline: []
}

function mountCard() {
  return mount(MonitorCard, {
    props: {
      item,
      window: '7d',
      availabilityValue: 99.9,
      countdownSeconds: 20
    },
    global: {
      stubs: {
        Icon: true,
        ProviderIcon: true,
        MonitorMetricPair: true,
        MonitorAvailabilityRow: true,
        MonitorTimeline: true
      }
    }
  })
}

describe('MonitorCard compound trigger', () => {
  it('keeps a named native button with the monitor summary visible', () => {
    const wrapper = mountCard()
    const button = wrapper.get('button.monitor-list-row')

    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toContain('OpenAI primary channel')
    expect(button.text()).toContain('gpt-5.4')
    expect(button.text()).toContain('provider:openai')
    expect(button.attributes('aria-label')).toBeUndefined()
  })

  it('emits one detail click for the compound row action', async () => {
    const wrapper = mountCard()
    await wrapper.get('button.monitor-list-row').trigger('click')

    expect(wrapper.emitted('click')).toEqual([[]])
  })

  it('retains native button keyboard semantics instead of a div click target', () => {
    const wrapper = mountCard()
    const button = wrapper.get('button.monitor-list-row')

    expect(button.element instanceof HTMLButtonElement).toBe(true)
    expect(button.attributes('tabindex')).toBeUndefined()
  })
})
