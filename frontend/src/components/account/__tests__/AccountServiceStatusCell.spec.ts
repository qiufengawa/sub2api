import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import AccountServiceStatusCell from '../AccountServiceStatusCell.vue'
import type {
  AccountServiceStatus,
  AccountServiceStatusBucket,
  AccountServiceStatusLevel
} from '@/api/admin/accounts'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('zh'),
      t: (key: string, params?: Record<string, unknown>) =>
        key.endsWith('requestCountShort') ? `${params?.count ?? 0} 次` : key
    })
  }
})

const HelpTooltipStub = {
  template: '<div><slot name="trigger" /><div data-test="service-tooltip"><slot /></div></div>'
}

function makeBucket(index: number, status: AccountServiceStatusLevel): AccountServiceStatusBucket {
  const start = new Date(Date.UTC(2026, 7, 7, 11, 31 + index, 0))
  const end = new Date(start.getTime() + 60 * 1000)
  const hasSamples = status !== 'unknown'
  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status,
    success_rate: hasSamples ? (status === 'operational' ? 0.99 : status === 'degraded' ? 0.9 : 0.5) : null,
    success_count: hasSamples ? 9 : 0,
    failure_count: hasSamples ? 1 : 0,
    request_count: hasSamples ? 10 : 0,
    average_first_token_ms: hasSamples ? 250 : null,
    average_tokens_per_second: hasSamples ? 42.5 : null,
    last_call_at: hasSamples ? end.toISOString() : null
  }
}

function makeStatus(): AccountServiceStatus {
  const states = Array.from<AccountServiceStatusLevel>({ length: 60 }, (_, index) =>
    (['operational', 'degraded', 'failed', 'unknown'] as const)[index % 4]
  )
  return {
    account_id: 7,
    status: 'degraded',
    success_rate: 0.9,
    success_count: 90,
    failure_count: 10,
    request_count: 100,
    average_first_token_ms: 250,
    average_tokens_per_second: 42.5,
    last_call_at: '2026-08-07T11:42:00Z',
    buckets: states.map((status, index) => makeBucket(index, status))
  }
}

function mountCell(props: { status?: AccountServiceStatus | null; loading?: boolean; error?: string | null }) {
  return mount(AccountServiceStatusCell, {
    props,
    global: {
      stubs: {
        HelpTooltip: HelpTooltipStub
      }
    }
  })
}

describe('AccountServiceStatusCell', () => {
  it('renders a stable 60-minute timeline with narrow equal-height bars', () => {
    const wrapper = mountCell({ status: makeStatus() })
    const buckets = wrapper.findAll('[data-status]')

    expect(buckets).toHaveLength(60)
    expect(buckets[0].classes()).toContain('bg-emerald-500')
    expect(buckets[1].classes()).toContain('bg-amber-500')
    expect(buckets[2].classes()).toContain('bg-red-500')
    expect(buckets[3].classes()).toContain('bg-gray-300')
    expect(buckets[0].classes()).toContain('w-[2px]')
    expect(buckets[0].classes()).toContain('h-5')
    expect(buckets[59].attributes('data-current')).toBe('true')
    expect(wrapper.text()).toContain('admin.accounts.serviceStatus.degraded 90.0%')
    expect(wrapper.text()).toContain('100 次')
  })

  it('shows the passive metrics in the tooltip', () => {
    const wrapper = mountCell({ status: makeStatus() })
    const tooltip = wrapper.get('[data-test="service-tooltip"]')

    expect(tooltip.text()).toContain('admin.accounts.serviceStatus.passiveHint')
    expect(tooltip.text()).toContain('90.0%')
    expect(tooltip.text()).toContain('90 / 10')
    expect(tooltip.text()).toContain('250ms')
    expect(tooltip.text()).toContain('42.5 tok/s')
  })

  it('switches the tooltip to the hovered minute without changing its layout', async () => {
    const wrapper = mountCell({ status: makeStatus() })
    await wrapper.findAll('[data-status]')[0].trigger('mouseenter')
    const tooltip = wrapper.get('[data-test="service-tooltip"]')

    expect(tooltip.text()).toContain('admin.accounts.serviceStatus.intervalStatus')
    expect(tooltip.text()).toContain('99.0%')
    expect(tooltip.text()).toContain('9 / 1')
  })

  it('keeps loading, unavailable, and no-sample states distinct', () => {
    const loading = mountCell({ loading: true })
    expect(loading.get('[aria-busy="true"]').exists()).toBe(true)

    const unavailable = mountCell({ error: 'Unavailable' })
    expect(unavailable.text()).toContain('admin.accounts.serviceStatus.unavailable')
    expect(unavailable.find('[data-status]').exists()).toBe(false)

    const noSamples = mountCell({ status: null })
    expect(noSamples.findAll('[data-status]')).toHaveLength(60)
    expect(noSamples.text()).toContain('admin.accounts.serviceStatus.noSamples')
    expect(noSamples.text()).not.toContain('100%')
  })
})
