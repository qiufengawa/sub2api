<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import {
  AppInline,
  AppStack,
  AppToolbar,
  UiAlert,
  UiButton,
  UiDialog,
  UiEmptyState,
  UiFieldHelp,
  UiIconButton,
  UiLiveMetric,
  UiPopover,
  UiProgressBar,
  UiProgressRing,
  UiPulseIndicator,
  UiSegmentedControl,
  UiSelect,
  UiStatMetric,
  UiStatusBadge,
  UiTextField,
  UiThresholdMetric,
} from '@/components/ui'
import { adminAPI } from '@/api'
import { opsAPI, type OpsDashboardOverview, type OpsMetricThresholds, type OpsRealtimeTrafficSummary } from '@/api/admin/ops'
import type { OpsRequestDetailsPreset } from './OpsRequestDetailsModal.vue'
import { useAdminSettingsStore } from '@/stores'
import { formatNumber } from '@/utils/format'
import { formatMemorySizeMB } from '../utils/opsFormatters'

type RealtimeWindow = '1min' | '5min' | '30min' | '1h'

interface Props {
  overview?: OpsDashboardOverview | null
  platform: string
  groupId: number | null
  timeRange: string
  queryMode: string
  loading: boolean
  lastUpdated: Date | null
  thresholds?: OpsMetricThresholds | null // 阈值配置
  autoRefreshEnabled?: boolean
  autoRefreshCountdown?: number
  fullscreen?: boolean
  customStartTime?: string | null
  customEndTime?: string | null
}

interface Emits {
  (e: 'update:platform', value: string): void
  (e: 'update:group', value: number | null): void
  (e: 'update:timeRange', value: string): void
  (e: 'update:queryMode', value: string): void
  (e: 'update:customTimeRange', startTime: string, endTime: string): void
  (e: 'refresh'): void
  (e: 'openRequestDetails', preset?: OpsRequestDetailsPreset): void
  (e: 'openErrorDetails', kind: 'request' | 'upstream'): void
  (e: 'openSettings'): void
  (e: 'openAlertRules'): void
  (e: 'enterFullscreen'): void
  (e: 'exitFullscreen'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const adminSettingsStore = useAdminSettingsStore()

const realtimeWindow = ref<RealtimeWindow>('1min')

const overview = computed(() => props.overview ?? null)
const systemMetrics = computed(() => overview.value?.system_metrics ?? null)

const REALTIME_WINDOW_MINUTES: Record<RealtimeWindow, number> = {
  '1min': 1,
  '5min': 5,
  '30min': 30,
  '1h': 60
}

const TOOLBAR_RANGE_MINUTES: Record<string, number> = {
  '5m': 5,
  '30m': 30,
  '1h': 60,
  '6h': 6 * 60,
  '24h': 24 * 60
}

const availableRealtimeWindows = computed(() => {
  const toolbarMinutes = TOOLBAR_RANGE_MINUTES[props.timeRange] ?? 60
  return (['1min', '5min', '30min', '1h'] as const).filter((w) => REALTIME_WINDOW_MINUTES[w] <= toolbarMinutes)
})

const realtimeWindowOptions = computed(() =>
  availableRealtimeWindows.value.map((window) => ({ value: window, label: window }))
)

function handleRealtimeWindowChange(value: string | number) {
  if (availableRealtimeWindows.value.includes(value as RealtimeWindow)) {
    realtimeWindow.value = value as RealtimeWindow
  }
}

watch(
  () => props.timeRange,
  () => {
    // The realtime window must be inside the toolbar window; reset to keep UX predictable.
    realtimeWindow.value = '1min'
    // Keep realtime traffic consistent with toolbar changes even when the window is already 1min.
    loadRealtimeTrafficSummary()
  }
)

// --- Filters ---

const showCustomTimeRangeDialog = ref(false)
const customStartTimeInput = ref('')
const customEndTimeInput = ref('')

function formatCustomTimeRangeLabel(startTime: string, endTime: string): string {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const formatDate = (d: Date) => {
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  }
  return `${formatDate(start)} ~ ${formatDate(end)}`
}

const groups = ref<Array<{ id: number; name: string; platform: string }>>([])

const platformOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'grok', label: 'Grok' }
])

const timeRangeOptions = computed(() => [
  { value: '5m', label: t('admin.ops.timeRange.5m') },
  { value: '30m', label: t('admin.ops.timeRange.30m') },
  { value: '1h', label: t('admin.ops.timeRange.1h') },
  { value: '6h', label: t('admin.ops.timeRange.6h') },
  { value: '24h', label: t('admin.ops.timeRange.24h') },
  {
    value: 'custom',
    label: props.timeRange === 'custom' && props.customStartTime && props.customEndTime
      ? `${t('admin.ops.timeRange.custom')} (${formatCustomTimeRangeLabel(props.customStartTime, props.customEndTime)})`
      : t('admin.ops.timeRange.custom')
  }
])

const queryModeOptions = computed(() => [
  { value: 'auto', label: t('admin.ops.queryMode.auto') },
  { value: 'raw', label: t('admin.ops.queryMode.raw') },
  { value: 'preagg', label: t('admin.ops.queryMode.preagg') }
])

const groupOptions = computed(() => {
  const filtered = props.platform ? groups.value.filter((g) => g.platform === props.platform) : groups.value
  return [{ value: null, label: t('common.all') }, ...filtered.map((g) => ({ value: g.id, label: g.name }))]
})

watch(
  () => props.platform,
  (newPlatform) => {
    if (!newPlatform) return
    const currentGroup = groups.value.find((g) => g.id === props.groupId)
    if (currentGroup && currentGroup.platform !== newPlatform) {
      emit('update:group', null)
    }
  }
)

onMounted(async () => {
  try {
    const list = await adminAPI.groups.getAll()
    groups.value = list.map((g) => ({ id: g.id, name: g.name, platform: g.platform }))
  } catch (e) {
    console.error('[OpsDashboardHeader] Failed to load groups', e)
    groups.value = []
  }
})

function handlePlatformChange(val: string | number | boolean | null) {
  emit('update:platform', String(val || ''))
}

function handleGroupChange(val: string | number | boolean | null) {
  if (val === null || val === '' || typeof val === 'boolean') {
    emit('update:group', null)
    return
  }
  const id = typeof val === 'number' ? val : Number.parseInt(String(val), 10)
  emit('update:group', Number.isFinite(id) && id > 0 ? id : null)
}

function handleTimeRangeChange(val: string | number | boolean | null) {
  const newValue = String(val || '1h')
  if (newValue === 'custom') {
    // 初始化为最近1小时
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    customStartTimeInput.value = oneHourAgo.toISOString().slice(0, 16)
    customEndTimeInput.value = now.toISOString().slice(0, 16)
    showCustomTimeRangeDialog.value = true
  } else {
    emit('update:timeRange', newValue)
  }
}

function handleCustomTimeRangeConfirm() {
  if (!customStartTimeInput.value || !customEndTimeInput.value) return
  const startTime = new Date(customStartTimeInput.value).toISOString()
  const endTime = new Date(customEndTimeInput.value).toISOString()
  // Emit custom time range first so the parent can build correct API params
  // when it reacts to timeRange switching to "custom".
  emit('update:customTimeRange', startTime, endTime)
  emit('update:timeRange', 'custom')
  showCustomTimeRangeDialog.value = false
}

function handleCustomTimeRangeCancel() {
  showCustomTimeRangeDialog.value = false
  // 如果当前不是 custom，不需要做任何事
  // 如果当前是 custom，保持不变
}

function handleQueryModeChange(val: string | number | boolean | null) {
  emit('update:queryMode', String(val || 'auto'))
}

function openDetails(preset?: OpsRequestDetailsPreset) {
  emit('openRequestDetails', preset)
}

function openErrorDetails(kind: 'request' | 'upstream') {
  emit('openErrorDetails', kind)
}

// --- Realtime / Overview labels ---

const totalRequestsLabel = computed(() => formatNumber(overview.value?.request_count_total ?? 0))
const totalTokensLabel = computed(() => formatNumber(overview.value?.token_consumed ?? 0))

const realtimeTrafficSummary = ref<OpsRealtimeTrafficSummary | null>(null)
const realtimeTrafficLoading = ref(false)

function makeZeroRealtimeTrafficSummary(): OpsRealtimeTrafficSummary {
  const now = new Date().toISOString()
  return {
    window: realtimeWindow.value,
    start_time: now,
    end_time: now,
    platform: props.platform,
    group_id: props.groupId,
    qps: { current: 0, peak: 0, avg: 0 },
    tps: { current: 0, peak: 0, avg: 0 }
  }
}

async function loadRealtimeTrafficSummary() {
  if (realtimeTrafficLoading.value) return
  if (!adminSettingsStore.opsRealtimeMonitoringEnabled) {
    realtimeTrafficSummary.value = makeZeroRealtimeTrafficSummary()
    return
  }
  realtimeTrafficLoading.value = true
  try {
    const res = await opsAPI.getRealtimeTrafficSummary(realtimeWindow.value, props.platform, props.groupId)
    if (res && res.enabled === false) {
      adminSettingsStore.setOpsRealtimeMonitoringEnabledLocal(false)
    }
    realtimeTrafficSummary.value = res?.summary ?? null
  } catch (err) {
    console.error('[OpsDashboardHeader] Failed to load realtime traffic summary', err)
    realtimeTrafficSummary.value = null
  } finally {
    realtimeTrafficLoading.value = false
  }
}

watch(
  () => [realtimeWindow.value, props.platform, props.groupId] as const,
  () => {
    loadRealtimeTrafficSummary()
  },
  { immediate: true }
)

watch(
  () => adminSettingsStore.opsRealtimeMonitoringEnabled,
  (enabled) => {
    if (!enabled) {
      // Keep UI stable when realtime monitoring is turned off.
      realtimeTrafficSummary.value = makeZeroRealtimeTrafficSummary()
    } else {
      loadRealtimeTrafficSummary()
    }
  },
  { immediate: true }
)

// Realtime traffic refresh follows the parent (OpsDashboard) refresh cadence.
watch(
  () => [props.autoRefreshEnabled, props.autoRefreshCountdown, props.loading] as const,
  ([enabled, countdown, loading]) => {
    if (!enabled) return
    if (loading) return
    // Treat countdown reset (or reaching 0) as a refresh boundary.
    if (countdown === 0) {
      loadRealtimeTrafficSummary()
    }
  }
)

// no-op: parent controls refresh cadence

const displayRealTimeQps = computed(() => {
  const v = realtimeTrafficSummary.value?.qps?.current
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
})

const displayRealTimeTps = computed(() => {
  const v = realtimeTrafficSummary.value?.tps?.current
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
})

const realtimeQpsPeakLabel = computed(() => {
  const v = realtimeTrafficSummary.value?.qps?.peak
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : '-'
})
const realtimeTpsPeakLabel = computed(() => {
  const v = realtimeTrafficSummary.value?.tps?.peak
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : '-'
})
const realtimeQpsAvgLabel = computed(() => {
  const v = realtimeTrafficSummary.value?.qps?.avg
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : '-'
})
const realtimeTpsAvgLabel = computed(() => {
  const v = realtimeTrafficSummary.value?.tps?.avg
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : '-'
})

const qpsAvgLabel = computed(() => {
  const v = overview.value?.qps?.avg
  if (typeof v !== 'number') return '-'
  return v.toFixed(1)
})

const tpsAvgLabel = computed(() => {
  const v = overview.value?.tps?.avg
  if (typeof v !== 'number') return '-'
  return v.toFixed(1)
})

const slaPercent = computed(() => {
  const v = overview.value?.sla
  if (typeof v !== 'number') return null
  return v * 100
})

const errorRatePercent = computed(() => {
  const v = overview.value?.error_rate
  if (typeof v !== 'number') return null
  return v * 100
})

const upstreamErrorRatePercent = computed(() => {
  const v = overview.value?.upstream_error_rate
  if (typeof v !== 'number') return null
  return v * 100
})

const durationP99Ms = computed(() => overview.value?.duration?.p99_ms ?? null)
const durationP95Ms = computed(() => overview.value?.duration?.p95_ms ?? null)
const durationP90Ms = computed(() => overview.value?.duration?.p90_ms ?? null)
const durationP50Ms = computed(() => overview.value?.duration?.p50_ms ?? null)
const durationAvgMs = computed(() => overview.value?.duration?.avg_ms ?? null)
const durationMaxMs = computed(() => overview.value?.duration?.max_ms ?? null)

const ttftP99Ms = computed(() => overview.value?.ttft?.p99_ms ?? null)
const ttftP95Ms = computed(() => overview.value?.ttft?.p95_ms ?? null)
const ttftP90Ms = computed(() => overview.value?.ttft?.p90_ms ?? null)
const ttftP50Ms = computed(() => overview.value?.ttft?.p50_ms ?? null)
const ttftAvgMs = computed(() => overview.value?.ttft?.avg_ms ?? null)
const ttftMaxMs = computed(() => overview.value?.ttft?.max_ms ?? null)

// --- Health Score & Diagnosis (primary) ---

const isSystemIdle = computed(() => {
  const ov = overview.value
  if (!ov) return true
  const qps = ov.qps?.current
  const errorRate = ov.error_rate ?? 0
  return (qps ?? 0) === 0 && errorRate === 0
})

const healthScoreValue = computed<number | null>(() => {
  const v = overview.value?.health_score
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

interface DiagnosisItem {
  type: 'critical' | 'warning' | 'info'
  message: string
  impact: string
  action?: string
}

const diagnosisReport = computed<DiagnosisItem[]>(() => {
  const ov = overview.value
  if (!ov) return []

  const report: DiagnosisItem[] = []

  if (isSystemIdle.value) {
    report.push({
      type: 'info',
      message: t('admin.ops.diagnosis.idle'),
      impact: t('admin.ops.diagnosis.idleImpact')
    })
    return report
  }

  // Resource diagnostics (highest priority)
  const sm = ov.system_metrics
  if (sm) {
    if (sm.db_ok === false) {
      report.push({
        type: 'critical',
        message: t('admin.ops.diagnosis.dbDown'),
        impact: t('admin.ops.diagnosis.dbDownImpact'),
        action: t('admin.ops.diagnosis.dbDownAction')
      })
    }
    if (sm.redis_ok === false) {
      report.push({
        type: 'warning',
        message: t('admin.ops.diagnosis.redisDown'),
        impact: t('admin.ops.diagnosis.redisDownImpact'),
        action: t('admin.ops.diagnosis.redisDownAction')
      })
    }

    const cpuPct = sm.cpu_usage_percent ?? 0
    if (cpuPct > 90) {
      report.push({
        type: 'critical',
        message: t('admin.ops.diagnosis.cpuCritical', { usage: cpuPct.toFixed(1) }),
        impact: t('admin.ops.diagnosis.cpuCriticalImpact'),
        action: t('admin.ops.diagnosis.cpuCriticalAction')
      })
    } else if (cpuPct > 80) {
      report.push({
        type: 'warning',
        message: t('admin.ops.diagnosis.cpuHigh', { usage: cpuPct.toFixed(1) }),
        impact: t('admin.ops.diagnosis.cpuHighImpact'),
        action: t('admin.ops.diagnosis.cpuHighAction')
      })
    }

    const memPct = sm.memory_usage_percent ?? 0
    if (memPct > 90) {
      report.push({
        type: 'critical',
        message: t('admin.ops.diagnosis.memoryCritical', { usage: memPct.toFixed(1) }),
        impact: t('admin.ops.diagnosis.memoryCriticalImpact'),
        action: t('admin.ops.diagnosis.memoryCriticalAction')
      })
    } else if (memPct > 85) {
      report.push({
        type: 'warning',
        message: t('admin.ops.diagnosis.memoryHigh', { usage: memPct.toFixed(1) }),
        impact: t('admin.ops.diagnosis.memoryHighImpact'),
        action: t('admin.ops.diagnosis.memoryHighAction')
      })
    }
  }

  const ttftP99 = ov.ttft?.p99_ms ?? 0
  if (ttftP99 > 500) {
    report.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.ttftHigh', { ttft: ttftP99.toFixed(0) }),
      impact: t('admin.ops.diagnosis.ttftHighImpact'),
      action: t('admin.ops.diagnosis.ttftHighAction')
    })
  }

  // Error rate diagnostics (adjusted thresholds)
  const upstreamRatePct = (ov.upstream_error_rate ?? 0) * 100
  if (upstreamRatePct > 5) {
    report.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.upstreamCritical', { rate: upstreamRatePct.toFixed(2) }),
      impact: t('admin.ops.diagnosis.upstreamCriticalImpact'),
      action: t('admin.ops.diagnosis.upstreamCriticalAction')
    })
  } else if (upstreamRatePct > 2) {
    report.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.upstreamHigh', { rate: upstreamRatePct.toFixed(2) }),
      impact: t('admin.ops.diagnosis.upstreamHighImpact'),
      action: t('admin.ops.diagnosis.upstreamHighAction')
    })
  }

  const errorPct = (ov.error_rate ?? 0) * 100
  if (errorPct > 3) {
    report.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.errorHigh', { rate: errorPct.toFixed(2) }),
      impact: t('admin.ops.diagnosis.errorHighImpact'),
      action: t('admin.ops.diagnosis.errorHighAction')
    })
  } else if (errorPct > 0.5) {
    report.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.errorElevated', { rate: errorPct.toFixed(2) }),
      impact: t('admin.ops.diagnosis.errorElevatedImpact'),
      action: t('admin.ops.diagnosis.errorElevatedAction')
    })
  }

  // SLA diagnostics
  const slaPct = (ov.sla ?? 0) * 100
  if (slaPct < 90) {
    report.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.slaCritical', { sla: slaPct.toFixed(2) }),
      impact: t('admin.ops.diagnosis.slaCriticalImpact'),
      action: t('admin.ops.diagnosis.slaCriticalAction')
    })
  } else if (slaPct < 98) {
    report.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.slaLow', { sla: slaPct.toFixed(2) }),
      impact: t('admin.ops.diagnosis.slaLowImpact'),
      action: t('admin.ops.diagnosis.slaLowAction')
    })
  }

  // Health score diagnostics (lowest priority)
  if (healthScoreValue.value != null) {
    if (healthScoreValue.value < 60) {
      report.push({
        type: 'critical',
        message: t('admin.ops.diagnosis.healthCritical', { score: healthScoreValue.value }),
        impact: t('admin.ops.diagnosis.healthCriticalImpact'),
        action: t('admin.ops.diagnosis.healthCriticalAction')
      })
    } else if (healthScoreValue.value < 90) {
      report.push({
        type: 'warning',
        message: t('admin.ops.diagnosis.healthLow', { score: healthScoreValue.value }),
        impact: t('admin.ops.diagnosis.healthLowImpact'),
        action: t('admin.ops.diagnosis.healthLowAction')
      })
    }
  }

  if (report.length === 0) {
    report.push({
      type: 'info',
      message: t('admin.ops.diagnosis.healthy'),
      impact: t('admin.ops.diagnosis.healthyImpact')
    })
  }

  return report
})

// --- System health (secondary) ---

function formatTimeShort(ts?: string | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString()
}

const cpuPercentValue = computed<number | null>(() => {
  const v = systemMetrics.value?.cpu_usage_percent
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const memPercentValue = computed<number | null>(() => {
  const v = systemMetrics.value?.memory_usage_percent
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const dbConnActiveValue = computed<number | null>(() => {
  const v = systemMetrics.value?.db_conn_active
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const dbConnIdleValue = computed<number | null>(() => {
  const v = systemMetrics.value?.db_conn_idle
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const dbConnWaitingValue = computed<number | null>(() => {
  const v = systemMetrics.value?.db_conn_waiting
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const dbConnOpenValue = computed<number | null>(() => {
  if (dbConnActiveValue.value == null || dbConnIdleValue.value == null) return null
  return dbConnActiveValue.value + dbConnIdleValue.value
})

const dbMaxOpenConnsValue = computed<number | null>(() => {
  const v = systemMetrics.value?.db_max_open_conns
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const dbUsagePercent = computed<number | null>(() => {
  if (dbConnOpenValue.value == null || dbMaxOpenConnsValue.value == null || dbMaxOpenConnsValue.value <= 0) return null
  return Math.min(100, Math.max(0, (dbConnOpenValue.value / dbMaxOpenConnsValue.value) * 100))
})

const dbMiddleLabel = computed(() => {
  if (systemMetrics.value?.db_ok === false) return 'FAIL'
  if (dbUsagePercent.value != null) return `${dbUsagePercent.value.toFixed(0)}%`
  if (systemMetrics.value?.db_ok === true) return t('admin.ops.ok')
  return t('admin.ops.noData')
})

const redisConnTotalValue = computed<number | null>(() => {
  const v = systemMetrics.value?.redis_conn_total
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const redisConnIdleValue = computed<number | null>(() => {
  const v = systemMetrics.value?.redis_conn_idle
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const redisConnActiveValue = computed<number | null>(() => {
  if (redisConnTotalValue.value == null || redisConnIdleValue.value == null) return null
  return Math.max(redisConnTotalValue.value - redisConnIdleValue.value, 0)
})

const redisPoolSizeValue = computed<number | null>(() => {
  const v = systemMetrics.value?.redis_pool_size
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const redisUsagePercent = computed<number | null>(() => {
  if (redisConnTotalValue.value == null || redisPoolSizeValue.value == null || redisPoolSizeValue.value <= 0) return null
  return Math.min(100, Math.max(0, (redisConnTotalValue.value / redisPoolSizeValue.value) * 100))
})

const redisMiddleLabel = computed(() => {
  if (systemMetrics.value?.redis_ok === false) return 'FAIL'
  if (redisUsagePercent.value != null) return `${redisUsagePercent.value.toFixed(0)}%`
  if (systemMetrics.value?.redis_ok === true) return t('admin.ops.ok')
  return t('admin.ops.noData')
})

const goroutineCountValue = computed<number | null>(() => {
  const v = systemMetrics.value?.goroutine_count
  return typeof v === 'number' && Number.isFinite(v) ? v : null
})

const goroutinesWarnThreshold = 8_000
const goroutinesCriticalThreshold = 15_000

const goroutineStatus = computed<'ok' | 'warning' | 'critical' | 'unknown'>(() => {
  const n = goroutineCountValue.value
  if (n == null) return 'unknown'
  if (n >= goroutinesCriticalThreshold) return 'critical'
  if (n >= goroutinesWarnThreshold) return 'warning'
  return 'ok'
})

const goroutineStatusLabel = computed(() => {
  switch (goroutineStatus.value) {
    case 'ok':
      return t('admin.ops.ok')
    case 'warning':
      return t('common.warning')
    case 'critical':
      return t('common.critical')
    default:
      return t('admin.ops.noData')
  }
})

const jobHeartbeats = computed(() => overview.value?.job_heartbeats ?? [])

const jobsStatus = computed<'ok' | 'warn' | 'unknown'>(() => {
  const list = jobHeartbeats.value
  if (!list.length) return 'unknown'
  for (const hb of list) {
    if (!hb) continue
    if (hb.last_error_at && (!hb.last_success_at || hb.last_error_at > hb.last_success_at)) return 'warn'
  }
  return 'ok'
})

const jobsWarnCount = computed(() => {
  let warn = 0
  for (const hb of jobHeartbeats.value) {
    if (!hb) continue
    if (hb.last_error_at && (!hb.last_success_at || hb.last_error_at > hb.last_success_at)) warn++
  }
  return warn
})

const jobsStatusLabel = computed(() => {
  switch (jobsStatus.value) {
    case 'ok':
      return t('admin.ops.ok')
    case 'warn':
      return t('common.warning')
    default:
      return t('admin.ops.noData')
  }
})

const showJobsDetails = ref(false)

function openJobsDetails() {
  showJobsDetails.value = true
}

function handleToolbarRefresh() {
  loadRealtimeTrafficSummary()
  emit('refresh')
}
</script>

<template>
  <section class="ops-command" :class="{ 'ops-command--fullscreen': props.fullscreen }">
    <AppToolbar class="ops-toolbar">
      <div class="ops-toolbar__status">
        <h1 v-if="props.fullscreen"><Icon name="chart" size="lg" />{{ t('admin.ops.title') }}</h1>
        <div v-else class="ops-toolbar__status-line">
          <UiPulseIndicator
            :label="props.loading ? t('admin.ops.loadingText') : t('admin.ops.ready')"
            :tone="props.loading ? 'info' : 'success'"
            :animated="props.loading"
          />
          <span>{{ props.lastUpdated ? props.lastUpdated.toLocaleString() : t('common.unknown') }}</span>
          <span v-if="props.autoRefreshEnabled && props.autoRefreshCountdown !== undefined">
            {{ t('admin.ops.autoRefreshRemaining', { seconds: props.autoRefreshCountdown }) }}
          </span>
        </div>
      </div>
      <template #actions>
        <div class="ops-toolbar__controls">
          <template v-if="!props.fullscreen">
            <UiSelect class="ops-filter" :model-value="platform" :options="platformOptions" density="compact" @update:model-value="handlePlatformChange" />
            <UiSelect class="ops-filter ops-filter--group" :model-value="groupId" :options="groupOptions" density="compact" @update:model-value="handleGroupChange" />
            <UiSelect class="ops-filter" :model-value="timeRange" :options="timeRangeOptions" density="compact" @update:model-value="handleTimeRangeChange" />
          </template>
          <UiSelect v-if="false" :model-value="queryMode" :options="queryModeOptions" density="compact" @update:model-value="handleQueryModeChange" />
          <UiIconButton v-if="!props.fullscreen" data-testid="ops-toolbar-refresh" :label="t('common.refresh')" icon="refresh" variant="ghost" :disabled="loading" @click="handleToolbarRefresh" />
          <UiButton v-if="!props.fullscreen" data-testid="ops-toolbar-alert-rules" density="compact" :aria-label="t('admin.ops.alertRules.manage')" :title="t('admin.ops.alertRules.manage')" @click="emit('openAlertRules')">
            <template #icon><Icon name="bell" size="sm" /></template><span class="ops-toolbar__button-label">{{ t('admin.ops.alertRules.manage') }}</span>
          </UiButton>
          <UiButton v-if="!props.fullscreen" data-testid="ops-toolbar-settings" density="compact" :aria-label="t('common.settings')" :title="t('common.settings')" @click="emit('openSettings')">
            <template #icon><Icon name="cog" size="sm" /></template><span class="ops-toolbar__button-label">{{ t('common.settings') }}</span>
          </UiButton>
          <UiIconButton v-if="!props.fullscreen" data-testid="ops-toolbar-fullscreen" icon="grid" variant="ghost" :label="t('admin.ops.fullscreen.enter')" @click="emit('enterFullscreen')" />
          <UiIconButton v-else data-testid="ops-toolbar-exit-fullscreen" icon="x" variant="ghost" :label="t('common.close')" @click="emit('exitFullscreen')" />
        </div>
      </template>
    </AppToolbar>

    <UiAlert
      v-if="overview && !props.fullscreen && diagnosisReport[0]"
      data-testid="ops-primary-diagnosis"
      :tone="diagnosisReport[0].type === 'critical' ? 'danger' : diagnosisReport[0].type === 'warning' ? 'warning' : 'success'"
      :title="diagnosisReport[0].message"
    >
      {{ diagnosisReport[0].impact }}
      <span v-if="diagnosisReport[0].action" class="ops-diagnosis__action">
        {{ diagnosisReport[0].action }}<b v-if="diagnosisReport.length > 1">+{{ diagnosisReport.length - 1 }}</b>
      </span>
    </UiAlert>

    <div v-if="overview" class="ops-overview">
      <UiPopover placement="bottom-start" panel-role="dialog" :aria-label="t('admin.ops.diagnosis.title')" width="320px">
        <template #trigger>
          <button type="button" class="ops-health ui-focus-ring" data-overview-section="health">
            <UiProgressRing
              :value="isSystemIdle ? 0 : healthScoreValue ?? 0"
              :size="props.fullscreen ? 132 : 104"
              :display-value="isSystemIdle ? t('admin.ops.idleStatus') : healthScoreValue == null ? '-' : String(Math.round(healthScoreValue))"
              :label="t('admin.ops.health')"
              :tone="isSystemIdle || healthScoreValue == null ? 'neutral' : healthScoreValue >= 90 ? 'success' : healthScoreValue >= 60 ? 'warning' : 'danger'"
              :aria-label="t('admin.ops.healthScoreAria', { value: isSystemIdle ? t('admin.ops.idleStatus') : healthScoreValue == null ? t('admin.ops.noData') : Math.round(healthScoreValue), description: t('admin.ops.healthHelp') })"
            />
            <span class="ops-health__copy"><strong>{{ t('admin.ops.healthCondition') }}</strong><small>{{ t('admin.ops.healthHelp') }}</small></span>
          </button>
        </template>
        <div class="ops-diagnosis">
          <header><Icon name="brain" size="sm" /><strong>{{ t('admin.ops.diagnosis.title') }}</strong></header>
          <div v-for="(item, index) in diagnosisReport" :key="[item.type, index].join('-')" class="ops-diagnosis__item">
            <Icon :name="item.type === 'critical' ? 'exclamationCircle' : item.type === 'warning' ? 'exclamationTriangle' : 'infoCircle'" size="sm" />
            <div><strong>{{ item.message }}</strong><p>{{ item.impact }}</p><small v-if="item.action">{{ item.action }}</small></div>
          </div>
          <footer>{{ t('admin.ops.diagnosis.footer') }}</footer>
        </div>
      </UiPopover>

      <div class="ops-traffic" data-overview-section="traffic">
        <header class="ops-section-heading">
          <div><strong>{{ t('admin.ops.overviewSections.traffic') }}</strong><small>{{ t('admin.ops.window') }}</small></div>
          <UiSegmentedControl :model-value="realtimeWindow" :options="realtimeWindowOptions" :label="t('admin.ops.window')" @update:model-value="handleRealtimeWindowChange" />
        </header>
        <div class="ops-traffic__grid">
          <UiLiveMetric label="QPS" :value="displayRealTimeQps.toFixed(1)" :live="adminSettingsStore.opsRealtimeMonitoringEnabled" :stale="realtimeTrafficLoading">
            <template #context><span>{{ t('admin.ops.peak') }} {{ realtimeQpsPeakLabel }}</span><span>{{ t('admin.ops.average') }} {{ realtimeQpsAvgLabel }}</span></template>
          </UiLiveMetric>
          <UiLiveMetric label="TPS" :value="displayRealTimeTps.toFixed(1)" :live="adminSettingsStore.opsRealtimeMonitoringEnabled" :stale="realtimeTrafficLoading">
            <template #context><span>{{ t('admin.ops.peak') }} {{ realtimeTpsPeakLabel }}</span><span>{{ t('admin.ops.average') }} {{ realtimeTpsAvgLabel }}</span></template>
          </UiLiveMetric>
          <UiStatMetric :label="t('admin.ops.totalRequests')" :value="totalRequestsLabel" :context="t('admin.ops.avgQps') + ' ' + qpsAvgLabel" />
          <UiStatMetric :label="t('admin.ops.tokens')" :value="totalTokensLabel" :context="t('admin.ops.avgTps') + ' ' + tpsAvgLabel" />
        </div>
        <UiButton v-if="!props.fullscreen" data-testid="ops-traffic-details" density="dense" variant="quiet" @click="openDetails()">
          <template #icon><Icon name="eye" size="sm" /></template>{{ t('admin.ops.requestDetails.details') }}
        </UiButton>
      </div>
    </div>

    <div v-if="overview" class="ops-quality">
      <section data-overview-section="stability">
        <header class="ops-section-heading"><strong>{{ t('admin.ops.overviewSections.stability') }}</strong></header>
        <div class="ops-quality__grid">
          <div class="ops-metric-with-action">
            <UiThresholdMetric
              data-testid="ops-sla-metric"
              :label="t('admin.ops.sla')" :value="(overview.request_count_sla ?? 0) > 0 ? slaPercent : null" :threshold="props.thresholds?.sla_percent_min ?? 99" :max="100" unit="%" inverse
              :context="formatNumber(overview.success_count ?? 0) + ' / ' + formatNumber(overview.request_count_sla ?? 0)"
              :threshold-label="t('admin.ops.metricStatus.threshold')" :normal-label="t('admin.ops.metricStatus.normal')"
              :near-label="t('admin.ops.metricStatus.near')" :breached-label="t('admin.ops.metricStatus.breached')" :no-data-label="t('admin.ops.noData')"
            />
            <UiIconButton v-if="!props.fullscreen" data-testid="ops-sla-details" icon="eye" density="mini" variant="ghost" :label="t('admin.ops.requestDetails.details')" @click="openDetails({ title: t('admin.ops.requestDetails.title'), kind: 'error' })" />
          </div>
          <div data-overview-metric="stability" class="ops-metric-with-action">
            <UiThresholdMetric
              data-testid="ops-request-error-metric"
              :label="t('admin.ops.requestErrors')" :value="errorRatePercent" :threshold="props.thresholds?.request_error_rate_percent_max ?? 3"
              :max="Math.max(10, props.thresholds?.request_error_rate_percent_max ?? 3)" unit="%"
              :context="t('admin.ops.errorCount') + ' ' + formatNumber(overview.error_count_sla ?? 0)"
              :threshold-label="t('admin.ops.metricStatus.threshold')" :normal-label="t('admin.ops.metricStatus.normal')"
              :near-label="t('admin.ops.metricStatus.near')" :breached-label="t('admin.ops.metricStatus.breached')" :no-data-label="t('admin.ops.noData')"
            />
            <UiIconButton v-if="!props.fullscreen" icon="eye" density="mini" variant="ghost" :label="t('admin.ops.requestDetails.details')" @click="openErrorDetails('request')" />
          </div>
          <div data-overview-metric="stability" class="ops-metric-with-action">
            <UiThresholdMetric
              data-testid="ops-upstream-error-metric"
              :label="t('admin.ops.upstreamErrors')" :value="upstreamErrorRatePercent" :threshold="props.thresholds?.upstream_error_rate_percent_max ?? 5"
              :max="Math.max(10, props.thresholds?.upstream_error_rate_percent_max ?? 5)" unit="%"
              :context="t('admin.ops.errorCountExcl429529') + ' ' + formatNumber(overview.upstream_error_count_excl_429_529 ?? 0)"
              :threshold-label="t('admin.ops.metricStatus.threshold')" :normal-label="t('admin.ops.metricStatus.normal')"
              :near-label="t('admin.ops.metricStatus.near')" :breached-label="t('admin.ops.metricStatus.breached')" :no-data-label="t('admin.ops.noData')"
            />
            <UiIconButton v-if="!props.fullscreen" icon="eye" density="mini" variant="ghost" :label="t('admin.ops.requestDetails.details')" @click="openErrorDetails('upstream')" />
          </div>
        </div>
      </section>

      <section data-overview-section="latency">
        <header class="ops-section-heading"><strong>{{ t('admin.ops.overviewSections.latency') }}</strong></header>
        <div class="ops-latency-grid">
          <div data-overview-metric="latency" class="ops-latency ops-metric-with-action">
            <UiStatMetric :label="t('admin.ops.latencyDuration')" :value="durationP99Ms ?? '-'" unit="ms" :context="'P99 · ' + t('admin.ops.avg') + ' ' + (durationAvgMs ?? '-') + ' ms'" />
            <UiIconButton v-if="!props.fullscreen" data-testid="ops-duration-details" icon="eye" density="mini" variant="ghost" :label="t('admin.ops.requestDetails.details')" @click="openDetails({ title: t('admin.ops.latencyDuration'), sort: 'duration_desc' })" />
            <div class="ops-percentiles"><span>P95 <b>{{ durationP95Ms ?? '-' }}</b></span><span>P90 <b>{{ durationP90Ms ?? '-' }}</b></span><span>P50 <b>{{ durationP50Ms ?? '-' }}</b></span><span>Max <b>{{ durationMaxMs ?? '-' }}</b></span></div>
          </div>
          <div class="ops-latency ops-metric-with-action">
            <UiThresholdMetric
              data-testid="ops-ttft-metric"
              :label="t('admin.ops.ttftLabel')" :value="ttftP99Ms" :threshold="props.thresholds?.ttft_p99_ms_max ?? 500"
              :max="Math.max(1000, props.thresholds?.ttft_p99_ms_max ?? 500)" unit="ms"
              :context="'P99 · ' + t('admin.ops.avg') + ' ' + (ttftAvgMs ?? '-') + ' ms'"
              :threshold-label="t('admin.ops.metricStatus.threshold')" :normal-label="t('admin.ops.metricStatus.normal')"
              :near-label="t('admin.ops.metricStatus.near')" :breached-label="t('admin.ops.metricStatus.breached')" :no-data-label="t('admin.ops.noData')"
            />
            <UiIconButton v-if="!props.fullscreen" data-testid="ops-ttft-details" icon="eye" density="mini" variant="ghost" :label="t('admin.ops.requestDetails.details')" @click="openDetails({ title: t('admin.ops.ttftLabel'), sort: 'duration_desc' })" />
            <div class="ops-percentiles"><span>P95 <b>{{ ttftP95Ms ?? '-' }}</b></span><span>P90 <b>{{ ttftP90Ms ?? '-' }}</b></span><span>P50 <b>{{ ttftP50Ms ?? '-' }}</b></span><span>Max <b>{{ ttftMaxMs ?? '-' }}</b></span></div>
          </div>
        </div>
      </section>
    </div>

    <section v-if="overview" class="ops-resources">
      <header class="ops-section-heading">
        <div><strong>{{ t('admin.ops.systemHealth') }}</strong><small>{{ t('admin.ops.collectedAt') }}{{ systemMetrics?.created_at ? formatTimeShort(systemMetrics.created_at) : '-' }}</small></div>
        <UiStatusBadge :status="systemMetrics ? 'healthy' : 'neutral'" :label="systemMetrics ? t('admin.ops.ok') : t('admin.ops.noData')" />
      </header>
      <div class="ops-resources__grid">
        <article data-resource-kind="cpu" class="ops-resource">
          <header><span>CPU</span><UiFieldHelp v-if="!props.fullscreen" :content="t('admin.ops.tooltips.cpu')" /></header>
          <UiProgressBar :value="cpuPercentValue ?? 0" :tone="cpuPercentValue == null ? 'neutral' : cpuPercentValue >= 95 ? 'danger' : cpuPercentValue >= 80 ? 'warning' : 'success'" label="CPU" test-id="ops-resource-cpu-progress" />
          <small>{{ t('common.warning') }} 80% · {{ t('common.critical') }} 95%</small>
        </article>
        <article data-resource-kind="memory" class="ops-resource">
          <header><span>{{ t('admin.ops.memory') }}</span><UiFieldHelp v-if="!props.fullscreen" :content="t('admin.ops.tooltips.memory')" /></header>
          <UiProgressBar :value="memPercentValue ?? 0" :tone="memPercentValue == null ? 'neutral' : memPercentValue >= 95 ? 'danger' : memPercentValue >= 85 ? 'warning' : 'success'" :label="t('admin.ops.memory')" test-id="ops-resource-memory-progress" />
          <small>{{ systemMetrics?.memory_used_mb == null || systemMetrics?.memory_total_mb == null ? '-' : formatMemorySizeMB(systemMetrics.memory_used_mb) + ' / ' + formatMemorySizeMB(systemMetrics.memory_total_mb) }}</small>
        </article>
        <article data-resource-kind="database" class="ops-resource">
          <header><span>{{ t('admin.ops.db') }}</span><UiStatusBadge :status="systemMetrics?.db_ok === false ? 'offline' : systemMetrics?.db_ok === true ? 'healthy' : 'neutral'" :label="dbMiddleLabel" /></header>
          <UiProgressBar :value="dbUsagePercent ?? 0" :tone="systemMetrics?.db_ok === false ? 'danger' : dbUsagePercent == null ? 'neutral' : dbUsagePercent >= 90 ? 'danger' : dbUsagePercent >= 70 ? 'warning' : 'success'" :label="t('admin.ops.conns')" test-id="ops-resource-database-progress" />
          <small>{{ t('admin.ops.active') }} {{ dbConnActiveValue ?? '-' }} · {{ t('admin.ops.idle') }} {{ dbConnIdleValue ?? '-' }} · {{ t('admin.ops.waiting') }} {{ dbConnWaitingValue ?? '-' }}</small>
        </article>
        <article data-resource-kind="redis" class="ops-resource">
          <header><span>Redis</span><UiStatusBadge :status="systemMetrics?.redis_ok === false ? 'offline' : systemMetrics?.redis_ok === true ? 'healthy' : 'neutral'" :label="redisMiddleLabel" /></header>
          <UiProgressBar :value="redisUsagePercent ?? 0" :tone="systemMetrics?.redis_ok === false ? 'danger' : redisUsagePercent == null ? 'neutral' : redisUsagePercent >= 90 ? 'danger' : redisUsagePercent >= 70 ? 'warning' : 'success'" :label="t('admin.ops.conns')" test-id="ops-resource-redis-progress" />
          <small>{{ t('admin.ops.active') }} {{ redisConnActiveValue ?? '-' }} · {{ t('admin.ops.idle') }} {{ redisConnIdleValue ?? '-' }}</small>
        </article>
        <article data-resource-kind="goroutines" class="ops-resource ops-resource--status">
          <header><span>{{ t('admin.ops.goroutines') }}</span><UiStatusBadge :status="goroutineStatus === 'ok' ? 'healthy' : goroutineStatus === 'critical' ? 'danger' : goroutineStatus" :label="goroutineStatusLabel" /></header>
          <strong class="ui-numeric">{{ goroutineCountValue ?? '-' }}</strong>
          <small>{{ t('common.warning') }} {{ goroutinesWarnThreshold }} · {{ t('common.critical') }} {{ goroutinesCriticalThreshold }} · {{ t('admin.ops.queue') }} {{ systemMetrics?.concurrency_queue_depth ?? '-' }}</small>
        </article>
        <article data-resource-kind="jobs" class="ops-resource ops-resource--status">
          <header><span>{{ t('admin.ops.jobs') }}</span><UiIconButton v-if="!props.fullscreen" icon="eye" density="mini" variant="ghost" :label="t('admin.ops.requestDetails.details')" @click="openJobsDetails" /></header>
          <div class="ops-resource__status-value"><strong class="ui-numeric">{{ jobHeartbeats.length }}</strong><UiStatusBadge :status="jobsStatus === 'ok' ? 'healthy' : jobsStatus === 'warn' ? 'warning' : 'neutral'" :label="jobsStatusLabel" /></div>
          <small>{{ t('common.warning') }} {{ jobsWarnCount }}</small>
        </article>
      </div>
    </section>

    <UiDialog :show="showJobsDetails" :title="t('admin.ops.jobs')" width="wide" @close="showJobsDetails = false">
      <UiEmptyState v-if="!jobHeartbeats.length" :title="t('admin.ops.noData')" icon="inbox" />
      <AppStack v-else :gap="8">
        <article v-for="heartbeat in jobHeartbeats" :key="heartbeat.job_name" class="ops-job">
          <header><strong>{{ heartbeat.job_name }}</strong><UiStatusBadge :status="heartbeat.last_error_at && (!heartbeat.last_success_at || heartbeat.last_error_at > heartbeat.last_success_at) ? 'warning' : 'healthy'" :label="heartbeat.last_error_at && (!heartbeat.last_success_at || heartbeat.last_error_at > heartbeat.last_success_at) ? t('common.warning') : t('admin.ops.ok')" /></header>
          <dl>
            <div><dt>{{ t('admin.ops.lastSuccess') }}</dt><dd>{{ formatTimeShort(heartbeat.last_success_at) }}</dd></div>
            <div><dt>{{ t('admin.ops.lastError') }}</dt><dd>{{ formatTimeShort(heartbeat.last_error_at) }}</dd></div>
            <div><dt>{{ t('admin.ops.result') }}</dt><dd>{{ heartbeat.last_result || '-' }}</dd></div>
            <div><dt>{{ t('admin.ops.lastRun') }}</dt><dd>{{ formatTimeShort(heartbeat.updated_at) }}</dd></div>
          </dl>
          <UiAlert v-if="heartbeat.last_error" tone="danger">{{ heartbeat.last_error }}</UiAlert>
        </article>
      </AppStack>
    </UiDialog>

    <UiDialog :show="showCustomTimeRangeDialog" :title="t('admin.ops.timeRange.custom')" width="narrow" @close="handleCustomTimeRangeCancel">
      <AppStack :gap="16">
        <UiTextField v-model="customStartTimeInput" type="datetime-local" density="compact" test-id="ops-custom-start-time" :label="t('admin.ops.customTimeRange.startTime')" />
        <UiTextField v-model="customEndTimeInput" type="datetime-local" density="compact" test-id="ops-custom-end-time" :label="t('admin.ops.customTimeRange.endTime')" />
      </AppStack>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton data-testid="ops-custom-time-cancel" density="compact" @click="handleCustomTimeRangeCancel">{{ t('common.cancel') }}</UiButton>
          <UiButton data-testid="ops-custom-time-confirm" density="compact" variant="primary" :disabled="!customStartTimeInput || !customEndTimeInput" @click="handleCustomTimeRangeConfirm">{{ t('common.confirm') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.ops-command{display:grid;min-width:0;gap:16px;color:var(--ui-text)}
.ops-command--fullscreen{min-height:100%;padding:24px;background:var(--ui-bg)}
.ops-toolbar{border-bottom:1px solid var(--ui-border-soft)}
.ops-toolbar__status,.ops-toolbar__status-line,.ops-toolbar__controls,.ops-toolbar h1{display:flex;min-width:0;align-items:center;gap:8px}
.ops-toolbar h1{margin:0;font-size:20px;line-height:28px}
.ops-toolbar__status-line{flex-wrap:wrap;color:var(--ui-text-soft);font-size:11px}
.ops-toolbar__controls{justify-content:flex-end}.ops-filter{min-width:132px}.ops-filter--group{min-width:156px}
.ops-diagnosis__action{display:block;margin-top:4px;color:var(--ui-text)}.ops-diagnosis__action b{margin-left:6px}
.ops-overview{display:grid;min-width:0;grid-template-columns:minmax(180px,.45fr) minmax(0,1.55fr);gap:12px}
.ops-health{display:flex;width:100%;min-height:196px;align-items:center;justify-content:center;gap:18px;padding:20px;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius-panel);color:var(--ui-text);background:var(--ui-surface);text-align:left;cursor:pointer}
.ops-health:hover{border-color:var(--ui-border);background:var(--ui-surface-muted)}
.ops-health__copy{display:grid;max-width:150px;gap:4px}.ops-health__copy strong{font-size:14px}.ops-health__copy small{color:var(--ui-text-soft);font-size:11px;line-height:17px}
.ops-diagnosis{display:grid;gap:10px;padding:6px}.ops-diagnosis>header{display:flex;align-items:center;gap:8px;padding:4px 4px 10px;border-bottom:1px solid var(--ui-border-soft)}
.ops-diagnosis__item{display:grid;grid-template-columns:16px minmax(0,1fr);gap:9px;padding:4px}.ops-diagnosis__item strong{display:block;font-size:12px;line-height:18px}
.ops-diagnosis__item p,.ops-diagnosis__item small{display:block;margin:2px 0 0;color:var(--ui-text-muted);font-size:11px;line-height:17px}.ops-diagnosis__item small{color:var(--ui-text)}
.ops-diagnosis footer{padding:8px 4px 2px;border-top:1px solid var(--ui-border-soft);color:var(--ui-text-soft);font-size:10px}
.ops-traffic{display:grid;min-width:0;gap:10px}.ops-section-heading{display:flex;min-height:32px;align-items:center;justify-content:space-between;gap:12px}
.ops-section-heading>div{display:flex;min-width:0;align-items:baseline;gap:8px}.ops-section-heading strong{font-size:13px;font-weight:600}.ops-section-heading small{color:var(--ui-text-soft);font-size:10px}
.ops-traffic__grid{display:grid;min-width:0;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.ops-traffic>.ui-button{justify-self:end}
.ops-quality{display:grid;min-width:0;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:16px;padding-top:4px;border-top:1px solid var(--ui-border-soft)}
.ops-quality>section{display:grid;min-width:0;gap:8px}.ops-quality__grid{display:grid;min-width:0;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ops-metric-with-action{position:relative;min-width:0}.ops-metric-with-action>.ui-icon-button{position:absolute;z-index:1;top:6px;right:6px}
.ops-latency-grid{display:grid;min-width:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ops-latency{display:grid;min-width:0;gap:6px}
.ops-percentiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;color:var(--ui-text-soft);font-size:10px}.ops-percentiles span{display:flex;min-width:0;justify-content:space-between;gap:4px;padding:0 4px}.ops-percentiles b{color:var(--ui-text);font-weight:500;font-variant-numeric:tabular-nums}
.ops-resources{display:grid;min-width:0;gap:8px;padding-top:4px;border-top:1px solid var(--ui-border-soft)}.ops-resources__grid{display:grid;min-width:0;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.ops-resource{display:grid;min-width:0;min-height:112px;align-content:start;gap:9px;padding:10px;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius);background:var(--ui-surface)}
.ops-resource>header,.ops-resource__status-value{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:8px}.ops-resource>header>span{color:var(--ui-text-muted);font-size:11px;font-weight:600}
.ops-resource>small{overflow:hidden;color:var(--ui-text-soft);font-size:10px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}.ops-resource--status>strong,.ops-resource__status-value>strong{font-size:22px;font-weight:500;line-height:28px}
.ops-job{display:grid;gap:10px;padding:12px 0;border-bottom:1px solid var(--ui-border-soft)}.ops-job:last-child{border-bottom:0}.ops-job>header{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ops-job dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:0;gap:8px 16px}.ops-job dl>div{display:grid;grid-template-columns:minmax(80px,.6fr) minmax(0,1fr);gap:8px}
.ops-job dt{color:var(--ui-text-soft);font-size:11px}.ops-job dd{min-width:0;margin:0;overflow-wrap:anywhere;font-family:var(--ui-font-mono);font-size:11px}
@media(max-width:1199px){.ops-overview{grid-template-columns:minmax(160px,.4fr) minmax(0,1.6fr)}.ops-traffic__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ops-quality{grid-template-columns:1fr}.ops-resources__grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:767px){.ops-toolbar__controls{width:100%;flex-wrap:wrap}.ops-filter{min-width:min(100%,140px);flex:1 1 140px}.ops-overview{grid-template-columns:1fr}.ops-health{min-height:150px}.ops-quality__grid{grid-template-columns:1fr}.ops-resources__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:479px){.ops-command{gap:12px}.ops-command--fullscreen{padding:16px}.ops-toolbar__button-label{display:none}.ops-health{justify-content:flex-start}.ops-traffic__grid,.ops-latency-grid,.ops-resources__grid{grid-template-columns:1fr}.ops-percentiles{grid-template-columns:repeat(2,minmax(0,1fr))}.ops-job dl{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.ops-health{transition:none}}
</style>
