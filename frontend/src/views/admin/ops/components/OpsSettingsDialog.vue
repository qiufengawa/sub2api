<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { opsAPI } from '@/api/admin/ops'
import {
  UiAlert,
  UiButton,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiSelect,
  UiSpinner,
  UiSwitch,
  UiTextField,
} from '@/components/ui'
import type { OpsAlertRuntimeSettings, EmailNotificationConfig, AlertSeverity, OpsAdvancedSettings, OpsMetricThresholds } from '../types'

const { t } = useI18n()
const appStore = useAppStore()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const loading = ref(false)
const saving = ref(false)
const loadSucceeded = ref(false)
let loadRequestId = 0

// 运行时设置
const runtimeSettings = ref<OpsAlertRuntimeSettings | null>(null)
// 邮件通知配置
const emailConfig = ref<EmailNotificationConfig | null>(null)
// 高级设置
const advancedSettings = ref<OpsAdvancedSettings | null>(null)
// 指标阈值配置
const metricThresholds = ref<OpsMetricThresholds | null>(null)

// 加载所有配置
async function loadAllSettings() {
  const requestId = ++loadRequestId
  loading.value = true
  loadSucceeded.value = false
  runtimeSettings.value = null
  emailConfig.value = null
  advancedSettings.value = null
  metricThresholds.value = null
  alertRecipientInput.value = ''
  reportRecipientInput.value = ''
  try {
    const [runtime, email, advanced, thresholds] = await Promise.all([
      opsAPI.getAlertRuntimeSettings(),
      opsAPI.getEmailNotificationConfig(),
      opsAPI.getAdvancedSettings(),
      opsAPI.getMetricThresholds()
    ])
    if (requestId !== loadRequestId || !props.show) return
    runtimeSettings.value = runtime
    emailConfig.value = email
    advancedSettings.value = advanced
    // 兼容旧 payload：后端未返回该字段时补默认值，保证表单可绑定
    if (advancedSettings.value && !advancedSettings.value.openai_account_quota_auto_pause) {
      advancedSettings.value.openai_account_quota_auto_pause = { default_threshold_5h: 0, default_threshold_7d: 0 }
    }
    metricThresholds.value = { ...(thresholds || {}) }
    loadSucceeded.value = true
  } catch (err: any) {
    if (requestId !== loadRequestId) return
    console.error('[OpsSettingsDialog] Failed to load settings', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.settings.loadFailed'))
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

// 监听弹窗打开
watch(() => props.show, (show) => {
  if (show) {
    loadAllSettings()
  } else {
    loadRequestId += 1
    loading.value = false
    loadSucceeded.value = false
    runtimeSettings.value = null
    emailConfig.value = null
    advancedSettings.value = null
    metricThresholds.value = null
    alertRecipientInput.value = ''
    reportRecipientInput.value = ''
  }
})

// 邮件输入
const alertRecipientInput = ref('')
const reportRecipientInput = ref('')

// 严重级别选项
const severityOptions: Array<{ value: AlertSeverity | ''; label: string }> = [
  { value: '', label: t('admin.ops.email.minSeverityAll') },
  { value: 'critical', label: t('common.critical') },
  { value: 'warning', label: t('common.warning') },
  { value: 'info', label: t('common.info') }
]

// 验证邮箱
function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// 添加收件人
function addRecipient(target: 'alert' | 'report') {
  if (!emailConfig.value) return
  const raw = (target === 'alert' ? alertRecipientInput.value : reportRecipientInput.value).trim()
  if (!raw) return

  if (!isValidEmailAddress(raw)) {
    appStore.showError(t('common.invalidEmail'))
    return
  }

  const normalized = raw.toLowerCase()
  const list = target === 'alert' ? emailConfig.value.alert.recipients : emailConfig.value.report.recipients
  if (!list.includes(normalized)) {
    list.push(normalized)
  }
  if (target === 'alert') alertRecipientInput.value = ''
  else reportRecipientInput.value = ''
}

// 移除收件人
function removeRecipient(target: 'alert' | 'report', email: string) {
  if (!emailConfig.value) return
  const list = target === 'alert' ? emailConfig.value.alert.recipients : emailConfig.value.report.recipients
  const idx = list.indexOf(email)
  if (idx >= 0) list.splice(idx, 1)
}

// OpenAI 账号配额自动暂停：后端按 0~1 分数存储，UI 按百分比(0~100)展示
const quotaAutoPause5hPercent = computed<number | null>({
  get() {
    const v = advancedSettings.value?.openai_account_quota_auto_pause?.default_threshold_5h
    return v && v > 0 ? Math.round(v * 1000) / 10 : null
  },
  set(val) {
    if (!advancedSettings.value?.openai_account_quota_auto_pause) return
    advancedSettings.value.openai_account_quota_auto_pause.default_threshold_5h = val != null && val > 0 ? val / 100 : 0
  }
})
const quotaAutoPause7dPercent = computed<number | null>({
  get() {
    const v = advancedSettings.value?.openai_account_quota_auto_pause?.default_threshold_7d
    return v && v > 0 ? Math.round(v * 1000) / 10 : null
  },
  set(val) {
    if (!advancedSettings.value?.openai_account_quota_auto_pause) return
    advancedSettings.value.openai_account_quota_auto_pause.default_threshold_7d = val != null && val > 0 ? val / 100 : 0
  }
})

// 验证
const validation = computed(() => {
  const errors: string[] = []

  // 验证运行时设置
  if (runtimeSettings.value) {
    const evalSeconds = runtimeSettings.value.evaluation_interval_seconds
    if (!Number.isFinite(evalSeconds) || evalSeconds < 1 || evalSeconds > 86400) {
      errors.push(t('admin.ops.runtime.validation.evalIntervalRange'))
    }
  }

  // 邮件配置: 启用但无收件人时不阻断保存, 保存时会自动禁用

  // 验证高级设置
  if (advancedSettings.value) {
    const { error_log_retention_days, minute_metrics_retention_days, hourly_metrics_retention_days } = advancedSettings.value.data_retention
    if (!Number.isFinite(error_log_retention_days) || error_log_retention_days < 0 || error_log_retention_days > 365) {
      errors.push(t('admin.ops.settings.validation.retentionDaysRange'))
    }
    if (!Number.isFinite(minute_metrics_retention_days) || minute_metrics_retention_days < 0 || minute_metrics_retention_days > 365) {
      errors.push(t('admin.ops.settings.validation.retentionDaysRange'))
    }
    if (!Number.isFinite(hourly_metrics_retention_days) || hourly_metrics_retention_days < 0 || hourly_metrics_retention_days > 365) {
      errors.push(t('admin.ops.settings.validation.retentionDaysRange'))
    }

    const { default_threshold_5h, default_threshold_7d } = advancedSettings.value.openai_account_quota_auto_pause
    if (!Number.isFinite(default_threshold_5h) || !Number.isFinite(default_threshold_7d) || default_threshold_5h < 0 || default_threshold_5h > 1 || default_threshold_7d < 0 || default_threshold_7d > 1) {
      errors.push(t('admin.ops.settings.validation.openaiQuotaAutoPauseRange'))
    }
  }

  // 验证指标阈值
  if (metricThresholds.value?.sla_percent_min != null && (!Number.isFinite(metricThresholds.value.sla_percent_min) || metricThresholds.value.sla_percent_min < 0 || metricThresholds.value.sla_percent_min > 100)) {
    errors.push(t('admin.ops.settings.validation.slaMinPercentRange'))
  }
  if (metricThresholds.value?.ttft_p99_ms_max != null && (!Number.isFinite(metricThresholds.value.ttft_p99_ms_max) || metricThresholds.value.ttft_p99_ms_max < 0)) {
    errors.push(t('admin.ops.settings.validation.ttftP99MaxRange'))
  }
  if (metricThresholds.value?.request_error_rate_percent_max != null && (!Number.isFinite(metricThresholds.value.request_error_rate_percent_max) || metricThresholds.value.request_error_rate_percent_max < 0 || metricThresholds.value.request_error_rate_percent_max > 100)) {
    errors.push(t('admin.ops.settings.validation.requestErrorRateMaxRange'))
  }
  if (metricThresholds.value?.upstream_error_rate_percent_max != null && (!Number.isFinite(metricThresholds.value.upstream_error_rate_percent_max) || metricThresholds.value.upstream_error_rate_percent_max < 0 || metricThresholds.value.upstream_error_rate_percent_max > 100)) {
    errors.push(t('admin.ops.settings.validation.upstreamErrorRateMaxRange'))
  }

  return { valid: errors.length === 0, errors }
})

// 保存所有配置
async function saveAllSettings() {
  if (!loadSucceeded.value || !runtimeSettings.value || !emailConfig.value || !advancedSettings.value || !metricThresholds.value) {
    appStore.showError(t('admin.ops.settings.loadFailed'))
    return
  }
  if (!validation.value.valid) {
    appStore.showError(validation.value.errors[0])
    return
  }

  saving.value = true
  try {
    // 无收件人时自动禁用邮件通知
    if (emailConfig.value) {
      if (emailConfig.value.alert.enabled && emailConfig.value.alert.recipients.length === 0) {
        emailConfig.value.alert.enabled = false
      }
      if (emailConfig.value.report.enabled && emailConfig.value.report.recipients.length === 0) {
        emailConfig.value.report.enabled = false
      }
    }
    const results = await Promise.allSettled([
      opsAPI.updateAlertRuntimeSettings(runtimeSettings.value),
      opsAPI.updateEmailNotificationConfig(emailConfig.value),
      opsAPI.updateAdvancedSettings(advancedSettings.value),
      opsAPI.updateMetricThresholds(metricThresholds.value)
    ])
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failure) throw failure.reason
    appStore.showSuccess(t('admin.ops.settings.saveSuccess'))
    emit('saved')
    emit('close')
  } catch (err: any) {
    console.error('[OpsSettingsDialog] Failed to save settings', err)
    appStore.showError(err?.response?.data?.message || err?.response?.data?.detail || t('admin.ops.settings.saveFailed'))
    await loadAllSettings()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog :show="show" :title="t('admin.ops.settings.title')" width="extra-wide" @close="emit('close')">
    <div v-if="loading" class="ops-settings__state"><UiSpinner :label="t('common.loading')" /></div>

    <div v-else-if="loadSucceeded && runtimeSettings && emailConfig && advancedSettings && metricThresholds" class="ops-settings">
      <!-- 验证错误 -->
      <UiAlert v-if="!validation.valid" tone="warning" :title="t('admin.ops.settings.validation.title')">
        <ul class="ops-settings__errors">
          <li v-for="msg in validation.errors" :key="msg">{{ msg }}</li>
        </ul>
      </UiAlert>

      <!-- 数据采集频率 -->
      <div class="ops-settings__section">
        <h4 class="ops-settings__section-title">{{ t('admin.ops.settings.dataCollection') }}</h4>
        <UiTextField v-model.number="runtimeSettings.evaluation_interval_seconds" type="number" density="compact" :min="1" :max="86400" :label="t('admin.ops.settings.evaluationInterval')" :description="t('admin.ops.settings.evaluationIntervalHint')" />
      </div>

      <!-- 预警配置 -->
      <div class="ops-settings__section">
        <h4 class="ops-settings__section-title">{{ t('admin.ops.settings.alertConfig') }}</h4>

        <div class="ops-settings__stack">
          <div class="ops-settings__switch-row">
            <div>
              <label class="ops-settings__switch-label">{{ t('admin.ops.settings.enableAlert') }}</label>
            </div>
            <UiSwitch v-model="emailConfig.alert.enabled" :label="t('admin.ops.settings.enableAlert')" />
          </div>

          <div v-if="emailConfig.alert.enabled">
            <div class="ops-settings__input-action">
              <UiTextField v-model="alertRecipientInput" type="email" density="compact" :label="t('admin.ops.settings.alertRecipients')" :placeholder="t('admin.ops.settings.emailPlaceholder')" @enter="addRecipient('alert')" />
              <UiButton density="compact" @click="addRecipient('alert')">{{ t('common.add') }}</UiButton>
            </div>
            <div class="ops-settings__recipients">
              <span
                v-for="email in emailConfig.alert.recipients"
                :key="email"
                class="ops-settings__recipient"
              >
                {{ email }}
                <UiIconButton icon="x" density="mini" variant="ghost" :label="t('common.delete')" @click="removeRecipient('alert', email)" />
              </span>
            </div>
            <p class="ops-settings__hint">
              {{ t('admin.ops.settings.recipientsHint') }}
            </p>
          </div>

          <div v-if="emailConfig.alert.enabled">
            <UiSelect v-model="emailConfig.alert.min_severity" density="compact" :label="t('admin.ops.settings.minSeverity')" :options="severityOptions" />
          </div>
        </div>
      </div>

      <!-- 评估报告配置 -->
      <div class="ops-settings__section">
        <h4 class="ops-settings__section-title">{{ t('admin.ops.settings.reportConfig') }}</h4>

        <div class="ops-settings__stack">
          <div class="ops-settings__switch-row">
            <div>
              <label class="ops-settings__switch-label">{{ t('admin.ops.settings.enableReport') }}</label>
            </div>
            <UiSwitch v-model="emailConfig.report.enabled" :label="t('admin.ops.settings.enableReport')" />
          </div>

          <div v-if="emailConfig.report.enabled">
            <div class="ops-settings__input-action">
              <UiTextField v-model="reportRecipientInput" type="email" density="compact" :label="t('admin.ops.settings.reportRecipients')" :placeholder="t('admin.ops.settings.emailPlaceholder')" @enter="addRecipient('report')" />
              <UiButton density="compact" @click="addRecipient('report')">{{ t('common.add') }}</UiButton>
            </div>
            <div class="ops-settings__recipients">
              <span
                v-for="email in emailConfig.report.recipients"
                :key="email"
                class="ops-settings__recipient"
              >
                {{ email }}
                <UiIconButton icon="x" density="mini" variant="ghost" :label="t('common.delete')" @click="removeRecipient('report', email)" />
              </span>
            </div>
            <p class="ops-settings__hint">
              {{ t('admin.ops.settings.recipientsHint') }}
            </p>
          </div>

          <div v-if="emailConfig.report.enabled" class="ops-settings__grid ops-settings__grid--2">
            <div class="ops-settings__switch-row">
              <label class="ops-settings__switch-label">{{ t('admin.ops.settings.dailySummary') }}</label>
              <UiSwitch v-model="emailConfig.report.daily_summary_enabled" :label="t('admin.ops.settings.dailySummary')" />
            </div>
            <div v-if="emailConfig.report.daily_summary_enabled">
              <UiTextField v-model="emailConfig.report.daily_summary_schedule" density="compact" monospace placeholder="0 9 * * *" />
            </div>
            <div class="ops-settings__switch-row">
              <label class="ops-settings__switch-label">{{ t('admin.ops.settings.weeklySummary') }}</label>
              <UiSwitch v-model="emailConfig.report.weekly_summary_enabled" :label="t('admin.ops.settings.weeklySummary')" />
            </div>
            <div v-if="emailConfig.report.weekly_summary_enabled">
              <UiTextField v-model="emailConfig.report.weekly_summary_schedule" density="compact" monospace placeholder="0 9 * * 1" />
            </div>
          </div>
        </div>
      </div>

      <!-- 指标阈值配置 -->
      <div class="ops-settings__section">
        <h4 class="ops-settings__section-title">{{ t('admin.ops.settings.metricThresholds') }}</h4>
        <p class="ops-settings__section-description">{{ t('admin.ops.settings.metricThresholdsHint') }}</p>

        <div class="ops-settings__stack">
          <UiTextField v-model.number="metricThresholds.sla_percent_min" type="number" density="compact" :min="0" :max="100" :step="0.1" :label="t('admin.ops.settings.slaMinPercent')" :description="t('admin.ops.settings.slaMinPercentHint')" />


          <UiTextField v-model.number="metricThresholds.ttft_p99_ms_max" type="number" density="compact" :min="0" :step="50" :label="t('admin.ops.settings.ttftP99MaxMs')" :description="t('admin.ops.settings.ttftP99MaxMsHint')" />

          <UiTextField v-model.number="metricThresholds.request_error_rate_percent_max" type="number" density="compact" :min="0" :max="100" :step="0.1" :label="t('admin.ops.settings.requestErrorRateMaxPercent')" :description="t('admin.ops.settings.requestErrorRateMaxPercentHint')" />

          <UiTextField v-model.number="metricThresholds.upstream_error_rate_percent_max" type="number" density="compact" :min="0" :max="100" :step="0.1" :label="t('admin.ops.settings.upstreamErrorRateMaxPercent')" :description="t('admin.ops.settings.upstreamErrorRateMaxPercentHint')" />
        </div>
      </div>

      <!-- 高级设置 -->
      <details class="ops-settings__advanced">
        <summary class="ops-settings__advanced-summary">
          {{ t('admin.ops.settings.advancedSettings') }}
        </summary>
        <div class="ops-settings__advanced-body">
          <!-- 数据保留策略 -->
          <div class="ops-settings__group">
            <h5 class="ops-settings__group-title">{{ t('admin.ops.settings.dataRetention') }}</h5>

            <div class="ops-settings__switch-row">
              <label class="ops-settings__switch-label">{{ t('admin.ops.settings.enableCleanup') }}</label>
              <UiSwitch v-model="advancedSettings.data_retention.cleanup_enabled" :label="t('admin.ops.settings.enableCleanup')" />
            </div>

            <div v-if="advancedSettings.data_retention.cleanup_enabled">
              <UiTextField v-model="advancedSettings.data_retention.cleanup_schedule" density="compact" monospace :label="t('admin.ops.settings.cleanupSchedule')" :description="t('admin.ops.settings.cleanupScheduleHint')" placeholder="0 2 * * *" />
            </div>

            <div class="ops-settings__grid ops-settings__grid--3">
              <UiTextField v-model.number="advancedSettings.data_retention.error_log_retention_days" type="number" density="compact" :min="0" :max="365" :label="t('admin.ops.settings.errorLogRetentionDays')" />
              <UiTextField v-model.number="advancedSettings.data_retention.minute_metrics_retention_days" type="number" density="compact" :min="0" :max="365" :label="t('admin.ops.settings.minuteMetricsRetentionDays')" />
              <UiTextField v-model.number="advancedSettings.data_retention.hourly_metrics_retention_days" type="number" density="compact" :min="0" :max="365" :label="t('admin.ops.settings.hourlyMetricsRetentionDays')" />
            </div>
            <p class="ops-settings__hint">{{ t('admin.ops.settings.retentionDaysHint') }}</p>
          </div>

          <!-- 预聚合任务 -->
          <div class="ops-settings__group">
            <h5 class="ops-settings__group-title">{{ t('admin.ops.settings.aggregation') }}</h5>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.enableAggregation') }}</label>
                <p class="ops-settings__hint">{{ t('admin.ops.settings.aggregationHint') }}</p>
              </div>
              <UiSwitch v-model="advancedSettings.aggregation.aggregation_enabled" :label="t('admin.ops.settings.enableAggregation')" />
            </div>
          </div>

          <!-- OpenAI 账号配额自动暂停（全局默认阈值） -->
          <div class="ops-settings__group">
            <h5 class="ops-settings__group-title">{{ t('admin.ops.settings.openaiQuotaAutoPause') }}</h5>
            <p class="ops-settings__hint">{{ t('admin.ops.settings.openaiQuotaAutoPauseHint') }}</p>

            <div class="ops-settings__grid ops-settings__grid--2">
              <UiTextField v-model.number="quotaAutoPause5hPercent" type="number" density="compact" :min="0" :max="100" :step="0.1" :label="t('admin.ops.settings.openaiQuotaAutoPauseDefault5h')" test-id="ops-quota-auto-pause-5h" />
              <UiTextField v-model.number="quotaAutoPause7dPercent" type="number" density="compact" :min="0" :max="100" :step="0.1" :label="t('admin.ops.settings.openaiQuotaAutoPauseDefault7d')" test-id="ops-quota-auto-pause-7d" />
            </div>
            <p class="ops-settings__hint">{{ t('admin.ops.settings.openaiQuotaAutoPauseThresholdHint') }}</p>
          </div>

          <!-- Error Filtering -->
          <div class="ops-settings__group">
            <h5 class="ops-settings__group-title">{{ t('admin.ops.settings.errorFiltering') }}</h5>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.ignoreCountTokensErrors') }}</label>
                <p class="ops-settings__hint">
                  {{ t('admin.ops.settings.ignoreCountTokensErrorsHint') }}
                </p>
              </div>
              <UiSwitch v-model="advancedSettings.ignore_count_tokens_errors" :label="t('admin.ops.settings.ignoreCountTokensErrors')" />
            </div>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.ignoreContextCanceled') }}</label>
                <p class="ops-settings__hint">
                  {{ t('admin.ops.settings.ignoreContextCanceledHint') }}
                </p>
              </div>
              <UiSwitch v-model="advancedSettings.ignore_context_canceled" :label="t('admin.ops.settings.ignoreContextCanceled')" />
            </div>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.ignoreNoAvailableAccounts') }}</label>
                <p class="ops-settings__hint">
                  {{ t('admin.ops.settings.ignoreNoAvailableAccountsHint') }}
                </p>
              </div>
              <UiSwitch v-model="advancedSettings.ignore_no_available_accounts" :label="t('admin.ops.settings.ignoreNoAvailableAccounts')" />
            </div>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.ignoreInsufficientBalanceErrors') }}</label>
                <p class="ops-settings__hint">
                  {{ t('admin.ops.settings.ignoreInsufficientBalanceErrorsHint') }}
                </p>
              </div>
              <UiSwitch v-model="advancedSettings.ignore_insufficient_balance_errors" :label="t('admin.ops.settings.ignoreInsufficientBalanceErrors')" />
            </div>
          </div>

          <!-- Auto Refresh -->
          <div class="ops-settings__group">
            <h5 class="ops-settings__group-title">{{ t('admin.ops.settings.autoRefresh') }}</h5>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.enableAutoRefresh') }}</label>
                <p class="ops-settings__hint">
                  {{ t('admin.ops.settings.enableAutoRefreshHint') }}
                </p>
              </div>
              <UiSwitch v-model="advancedSettings.auto_refresh_enabled" :label="t('admin.ops.settings.enableAutoRefresh')" />
            </div>

            <div v-if="advancedSettings.auto_refresh_enabled">
              <UiSelect
                v-model="advancedSettings.auto_refresh_interval_seconds"
                density="compact"
                :label="t('admin.ops.settings.refreshInterval')"
                :options="[
                  { value: 15, label: t('admin.ops.settings.refreshInterval15s') },
                  { value: 30, label: t('admin.ops.settings.refreshInterval30s') },
                  { value: 60, label: t('admin.ops.settings.refreshInterval60s') }
                ]"
              />
            </div>
          </div>

          <!-- Dashboard Cards -->
          <div class="ops-settings__group">
            <h5 class="ops-settings__group-title">{{ t('admin.ops.settings.dashboardCards') }}</h5>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.displayAlertEvents') }}</label>
                <p class="ops-settings__hint">
                  {{ t('admin.ops.settings.displayAlertEventsHint') }}
                </p>
              </div>
              <UiSwitch v-model="advancedSettings.display_alert_events" :label="t('admin.ops.settings.displayAlertEvents')" />
            </div>

            <div class="ops-settings__switch-row">
              <div>
                <label class="ops-settings__switch-label">{{ t('admin.ops.settings.displayOpenAITokenStats') }}</label>
                <p class="ops-settings__hint">
                  {{ t('admin.ops.settings.displayOpenAITokenStatsHint') }}
                </p>
              </div>
              <UiSwitch v-model="advancedSettings.display_openai_token_stats" :label="t('admin.ops.settings.displayOpenAITokenStats')" />
            </div>
          </div>
        </div>
      </details>
    </div>

    <UiEmptyState v-else :title="t('admin.ops.settings.loadFailed')" />

    <template #footer>
      <div class="ops-settings__footer">
        <UiButton @click="emit('close')">{{ t('common.cancel') }}</UiButton>
        <UiButton variant="primary" :loading="saving" :disabled="loading || !loadSucceeded || !validation.valid" @click="saveAllSettings">{{ t('common.save') }}</UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.ops-settings { display: grid; gap: 0; }.ops-settings__state { display: grid; min-height: 280px; place-items: center; }.ops-settings__errors { margin: 0; padding-left: 18px; }.ops-settings__section { padding: 18px 0; border-bottom: 1px solid var(--ui-border-soft); }.ops-settings__section-title,.ops-settings__group-title { margin: 0 0 12px; color: var(--ui-text); font-size: 14px; line-height: 22px; }.ops-settings__section-description { margin: -7px 0 14px; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }.ops-settings__stack,.ops-settings__group,.ops-settings__advanced-body { display: grid; gap: 12px; }.ops-settings__switch-row { display: flex; min-height: 36px; align-items: center; justify-content: space-between; gap: 16px; }.ops-settings__switch-label { color: var(--ui-text); font-size: 12px; font-weight: 500; line-height: 19px; }.ops-settings__input-action { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 6px; }.ops-settings__recipients { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }.ops-settings__recipient { display: inline-flex; min-height: 28px; align-items: center; gap: 3px; padding-left: 8px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); color: var(--ui-text-muted); background: var(--ui-surface-muted); font-size: 11px; }.ops-settings__hint { margin: 3px 0 0; color: var(--ui-text-muted); font-size: 11px; line-height: 17px; }.ops-settings__grid { display: grid; gap: 12px; }.ops-settings__grid--2 { grid-template-columns: repeat(2,minmax(0,1fr)); }.ops-settings__grid--3 { grid-template-columns: repeat(3,minmax(0,1fr)); }.ops-settings__advanced { border-bottom: 1px solid var(--ui-border-soft); }.ops-settings__advanced-summary { padding: 15px 0; color: var(--ui-text); font-size: 14px; font-weight: 600; cursor: pointer; }.ops-settings__advanced-body { padding: 0 0 18px; }.ops-settings__group { padding-top: 14px; border-top: 1px solid var(--ui-border-soft); }.ops-settings__group-title { margin-bottom: 0; font-size: 12px; }.ops-settings__footer { display: flex; width: 100%; justify-content: flex-end; gap: 6px; }
@media(max-width:700px){.ops-settings__grid--2,.ops-settings__grid--3{grid-template-columns:1fr}.ops-settings__switch-row{align-items:flex-start}.ops-settings__input-action{grid-template-columns:1fr}.ops-settings__footer{display:grid;grid-template-columns:1fr 1fr}}
</style>
