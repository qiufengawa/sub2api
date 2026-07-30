import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import MonitorCardGrid from '../MonitorCardGrid.vue'
import type { UserMonitorView } from '@/api/channelMonitor'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

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
  timeline: [],
}

const MonitorCardStub = {
  name: 'MonitorCard',
  props: ['item'],
  emits: ['click'],
  template: '<button data-testid="monitor-row" @click="$emit(\'click\')">{{ item.name }}</button>',
}

const mountGrid = (props: Record<string, unknown>) => mount(MonitorCardGrid, {
  props: {
    items: [item],
    window: '7d',
    countdownSeconds: 20,
    loading: false,
    detailCache: {},
    ...props,
  },
  global: {
    stubs: {
      EmptyState: true,
      MonitorCard: MonitorCardStub,
    },
  },
})

describe('MonitorCardGrid list layout', () => {
  it('renders one bordered list surface instead of a multi-column card grid', async () => {
    const wrapper = mountGrid({})

    const list = wrapper.get('[data-testid="monitor-row"]').element.parentElement
    expect(list?.className).toContain('overflow-hidden')
    expect(list?.className).not.toContain('xl:grid-cols-3')

    await wrapper.get('[data-testid="monitor-row"]').trigger('click')
    expect(wrapper.emitted('cardClick')?.[0]).toEqual([item])
  })

  it('uses compact list-row skeletons', () => {
    const wrapper = mountGrid({ items: [], loading: true })

    expect(wrapper.findAll('.animate-pulse')).toHaveLength(6)
    expect(wrapper.html()).not.toContain('min-h-[220px]')
  })
})

