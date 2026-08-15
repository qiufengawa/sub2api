import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Account } from '@/types'
import AccountCapacityCell from '../AccountCapacityCell.vue'
import CapacityBadge from '../CapacityBadge.vue'
import QuotaBadge from '../QuotaBadge.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('zh'),
      t: (key: string) => key,
    }),
  }
})

const UiTooltipStub = {
  props: ['content'],
  template: '<span class="tooltip-stub" :data-content="content"><slot /></span>',
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'Account',
    platform: 'anthropic',
    type: 'oauth',
    proxy_id: null,
    concurrency: 10,
    current_concurrency: 1,
    priority: 0,
    status: 'active',
    error_message: null,
    last_used_at: null,
    expires_at: null,
    auto_pause_on_expired: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    schedulable: true,
    rate_limited_at: null,
    rate_limit_reset_at: null,
    overload_until: null,
    temp_unschedulable_until: null,
    temp_unschedulable_reason: null,
    session_window_start: null,
    session_window_end: null,
    session_window_status: null,
    ...overrides,
  }
}

function mountCell(value: Account) {
  return mount(AccountCapacityCell, {
    props: { account: value },
    global: { stubs: { UiTooltip: UiTooltipStub } },
  })
}

describe('AccountCapacityCell', () => {
  it('renders Anthropic window, session, and RPM limits with semantic tones', () => {
    const wrapper = mountCell(account({
      window_cost_limit: 10,
      current_window_cost: 8,
      max_sessions: 5,
      active_sessions: 4,
      base_rpm: 100,
      current_rpm: 80,
      rpm_strategy: 'tiered',
    }))
    const badges = wrapper.findAllComponents(CapacityBadge)

    expect(badges).toHaveLength(4)
    expect(badges.map((badge) => badge.props('tone'))).toEqual([
      'warning', 'warning', 'warning', 'warning',
    ])
    expect(badges[3].props('suffix')).toBe('[T]')
    expect(wrapper.text()).toContain('$8.00')
  })

  it('uses danger at hard limits and preserves sticky RPM semantics', () => {
    const wrapper = mountCell(account({
      current_concurrency: 10,
      window_cost_limit: 10,
      window_cost_sticky_reserve: 10,
      current_window_cost: 20,
      max_sessions: 5,
      active_sessions: 5,
      base_rpm: 100,
      rpm_sticky_buffer: 20,
      current_rpm: 120,
      rpm_strategy: 'tiered',
    }))

    expect(wrapper.findAllComponents(CapacityBadge).map((badge) => badge.props('tone'))).toEqual([
      'danger', 'danger', 'danger', 'danger',
    ])
  })

  it('shows quota limits only for eligible account types', () => {
    const wrapper = mountCell(account({
      platform: 'openai',
      type: 'apikey',
      quota_daily_limit: 5,
      quota_daily_used: 1,
      quota_weekly_limit: 10,
      quota_weekly_used: 8,
      quota_limit: 20,
      quota_used: 20,
    }))
    const quotas = wrapper.findAllComponents(QuotaBadge)

    expect(quotas).toHaveLength(3)
    expect(quotas.map((badge) => badge.props('label'))).toEqual(['D', 'W', undefined])
    expect(wrapper.html()).toContain('ui-badge--success')
    expect(wrapper.html()).toContain('ui-badge--warning')
    expect(wrapper.html()).toContain('ui-badge--danger')
  })
})
