import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  getRuntime: vi.fn(), getEmail: vi.fn(), getAdvanced: vi.fn(), getThresholds: vi.fn(),
  updateRuntime: vi.fn(), updateEmail: vi.fn(), updateAdvanced: vi.fn(), updateThresholds: vi.fn(),
  showError: vi.fn(), showSuccess: vi.fn(),
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    getAlertRuntimeSettings: mocks.getRuntime,
    getEmailNotificationConfig: mocks.getEmail,
    getAdvancedSettings: mocks.getAdvanced,
    getMetricThresholds: mocks.getThresholds,
    updateAlertRuntimeSettings: mocks.updateRuntime,
    updateEmailNotificationConfig: mocks.updateEmail,
    updateAdvancedSettings: mocks.updateAdvanced,
    updateMetricThresholds: mocks.updateThresholds,
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: mocks.showError, showSuccess: mocks.showSuccess }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import OpsSettingsDialog from '../OpsSettingsDialog.vue'

const runtime = { evaluation_interval_seconds: 60 }
const email = {
  alert: { enabled: false, recipients: [], min_severity: '', rate_limit_per_hour: 10, batching_window_seconds: 60, include_resolved_alerts: false },
  report: { enabled: false, recipients: [], daily_summary_enabled: false, daily_summary_schedule: '0 9 * * *', weekly_summary_enabled: false, weekly_summary_schedule: '0 9 * * 1' },
}
const advanced = {
  data_retention: { cleanup_enabled: false, cleanup_schedule: '0 2 * * *', error_log_retention_days: 30, minute_metrics_retention_days: 30, hourly_metrics_retention_days: 30 },
  aggregation: { aggregation_enabled: false },
  openai_account_quota_auto_pause: { default_threshold_5h: 0, default_threshold_7d: 0 },
  ignore_count_tokens_errors: false,
  ignore_context_canceled: false,
  ignore_no_available_accounts: false,
  ignore_insufficient_balance_errors: false,
  auto_refresh_enabled: false,
  auto_refresh_interval_seconds: 30,
  display_alert_events: true,
  display_openai_token_stats: true,
}

function saveButton(): HTMLButtonElement {
  return Array.from(document.body.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'common.save'
  ) as HTMLButtonElement
}

describe('OpsSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRuntime.mockResolvedValue(structuredClone(runtime))
    mocks.getEmail.mockResolvedValue(structuredClone(email))
    mocks.getAdvanced.mockResolvedValue(structuredClone(advanced))
    mocks.updateRuntime.mockResolvedValue({})
    mocks.updateEmail.mockResolvedValue({})
    mocks.updateAdvanced.mockResolvedValue({})
    mocks.updateThresholds.mockResolvedValue({})
  })

  afterEach(() => { document.body.innerHTML = '' })

  it('preserves nullable metric thresholds instead of replacing them with defaults', async () => {
    const thresholds = {
      sla_percent_min: null,
      ttft_p99_ms_max: null,
      request_error_rate_percent_max: null,
      upstream_error_rate_percent_max: null,
    }
    mocks.getThresholds.mockResolvedValue(thresholds)
    const wrapper = mount(OpsSettingsDialog, { props: { show: false } })
    await wrapper.setProps({ show: true })
    await flushPromises()

    saveButton().click()
    await flushPromises()

    expect(mocks.updateThresholds).toHaveBeenCalledWith(thresholds)
  })

  it('keeps save disabled and sends no updates after a load failure', async () => {
    mocks.getThresholds.mockRejectedValue(new Error('load failed'))
    const wrapper = mount(OpsSettingsDialog, { props: { show: false } })
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(saveButton().disabled).toBe(true)
    saveButton().click()

    expect(mocks.updateRuntime).not.toHaveBeenCalled()
    expect(mocks.updateEmail).not.toHaveBeenCalled()
    expect(mocks.updateAdvanced).not.toHaveBeenCalled()
    expect(mocks.updateThresholds).not.toHaveBeenCalled()
  })
})
