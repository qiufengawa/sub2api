import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import OpsDashboardHeader from '../OpsDashboardHeader.vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/api', () => ({
  adminAPI: {
    groups: { getAll: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    getRealtimeTrafficSummary: vi.fn().mockResolvedValue({
      enabled: true,
      summary: {
        qps: { current: 2, peak: 4, avg: 1 },
        tps: { current: 200, peak: 400, avg: 100 },
      },
    }),
  },
}))

vi.mock('@/stores', () => ({
  useAdminSettingsStore: () => ({
    opsRealtimeMonitoringEnabled: true,
    setOpsRealtimeMonitoringEnabledLocal: vi.fn(),
  }),
}))

const SelectStub = defineComponent({
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: '<div class="select-stub" />',
})

const overview = {
  start_time: '2026-07-31T00:00:00Z',
  end_time: '2026-07-31T01:00:00Z',
  platform: '',
  group_id: null,
  health_score: 98,
  system_metrics: {
    id: 1,
    created_at: '2026-07-31T01:00:00Z',
    window_minutes: 5,
    cpu_usage_percent: 44,
    memory_used_mb: 12000,
    memory_total_mb: 16000,
    memory_usage_percent: 75,
    db_ok: true,
    db_max_open_conns: 64,
    db_conn_active: 8,
    db_conn_idle: 8,
    db_conn_waiting: 0,
    redis_ok: true,
    redis_pool_size: 64,
    redis_conn_total: 16,
    redis_conn_idle: 12,
    goroutine_count: 167,
    concurrency_queue_depth: 2,
  },
  job_heartbeats: [
    {
      job_name: 'usage-aggregation',
      last_success_at: '2026-07-31T00:59:00Z',
      updated_at: '2026-07-31T01:00:00Z',
    },
  ],
  success_count: 980,
  error_count_total: 20,
  business_limited_count: 2,
  error_count_sla: 8,
  request_count_total: 1000,
  request_count_sla: 988,
  token_consumed: 500000,
  sla: 0.992,
  error_rate: 0.008,
  upstream_error_rate: 0.002,
  upstream_error_count_excl_429_529: 2,
  upstream_429_count: 1,
  upstream_529_count: 0,
  qps: { current: 2, peak: 4, avg: 1 },
  tps: { current: 200, peak: 400, avg: 100 },
  duration: { p50_ms: 120, p95_ms: 380, p99_ms: 800, avg_ms: 180 },
  ttft: { p50_ms: 80, p95_ms: 220, p99_ms: 460, avg_ms: 110 },
}

function mountHeader(fullscreen = false) {
  return mount(OpsDashboardHeader, {
    props: {
      overview,
      platform: '',
      groupId: null,
      timeRange: '1h',
      queryMode: 'auto',
      loading: false,
      lastUpdated: new Date('2026-07-31T01:00:00Z'),
      fullscreen,
    },
    global: {
      stubs: {
        Select: SelectStub,
        HelpTooltip: true,
        BaseDialog: true,
        Icon: true,
      },
    },
  })
}

describe('OpsDashboardHeader information hierarchy', () => {
  it('uses the global page header outside fullscreen and exposes four overview regions', async () => {
    const wrapper = mountHeader()
    await flushPromises()

    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.findAll('[data-overview-section="health"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-overview-section="traffic"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-overview-section="stability"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-overview-section="latency"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-overview-metric="stability"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-overview-metric="latency"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="ops-primary-diagnosis"]').text()).not.toBe('')
  })

  it('renders percentage resources as accessible progress meters and keeps status resources compact', async () => {
    const wrapper = mountHeader()
    await flushPromises()

    expect(wrapper.findAll('[data-resource-kind]')).toHaveLength(6)
    expect(wrapper.get('[data-testid="ops-resource-cpu-progress"]').attributes('aria-valuenow')).toBe('44')
    expect(wrapper.get('[data-testid="ops-resource-memory-progress"]').attributes('aria-valuenow')).toBe('75')
    expect(wrapper.get('[data-testid="ops-resource-database-progress"]').attributes('aria-valuenow')).toBe('25')
    expect(wrapper.get('[data-testid="ops-resource-redis-progress"]').attributes('aria-valuenow')).toBe('25')

    expect(wrapper.get('[data-testid="ops-resource-cpu-progress"] > div').attributes('style')).toContain('width: 44%')
    expect(wrapper.get('[data-testid="ops-resource-memory-progress"] > div').attributes('style')).toContain('width: 75%')
  })

  it('keeps the traffic detail action connected to the existing event', async () => {
    const wrapper = mountHeader()
    await wrapper.get('[data-testid="ops-traffic-details"]').trigger('click')

    expect(wrapper.emitted('openRequestDetails')).toHaveLength(1)
  })

  it('shows a local title only in fullscreen mode', () => {
    const wrapper = mountHeader(true)
    expect(wrapper.get('h1').text()).toContain('admin.ops.title')
  })
})
