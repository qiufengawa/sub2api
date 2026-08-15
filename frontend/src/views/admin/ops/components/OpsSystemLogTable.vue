<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { opsAPI, type OpsRuntimeLogConfig, type OpsSystemLog, type OpsSystemLogSinkHealth } from '@/api/admin/ops'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  UiBadge,
  UiButton,
  UiConfirmDialog,
  UiDataTable,
  UiEmptyState,
  UiFilterBar,
  UiIconButton,
  UiNumberStepper,
  UiPagination,
  UiProgressBar,
  UiSelect,
  UiSpinner,
  UiSwitch,
  UiTextField,
  type Column,
} from '@/components/ui'
import { useAppStore } from '@/stores'
import { extractApiErrorMessage } from '@/utils/apiError'

const appStore = useAppStore()
const { t } = useI18n()

const props = withDefaults(defineProps<{
  platformFilter?: string
  refreshToken?: number
}>(), {
  platformFilter: '',
  refreshToken: 0
})

const loading = ref(false)
const logs = ref<OpsSystemLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const health = ref<OpsSystemLogSinkHealth>({
  queue_depth: 0,
  queue_capacity: 0,
  dropped_count: 0,
  write_failed_count: 0,
  written_count: 0,
  avg_write_delay_ms: 0
})

const runtimeLoading = ref(false)
const runtimeSaving = ref(false)
const cleanupLoading = ref(false)
const showRuntimeConfig = ref(false)
const showAdvancedFilters = ref(false)
const confirmAction = ref<'cleanup' | 'reset-runtime' | null>(null)
const runtimeConfig = reactive<OpsRuntimeLogConfig>({
  level: 'info',
  enable_sampling: false,
  sampling_initial: 100,
  sampling_thereafter: 100,
  caller: true,
  stacktrace_level: 'error',
  retention_days: 30
})

const filters = reactive({
  time_range: '1h' as '5m' | '30m' | '1h' | '6h' | '24h' | '7d' | '30d',
  start_time: '',
  end_time: '',
  host: '',
  level: '',
  component: '',
  request_id: '',
  client_request_id: '',
  user_id: '',
  api_key_id: '',
  account_id: '',
  platform: '',
  model: '',
  q: ''
})

const queueUsagePercent = computed(() => {
  const capacity = Number(health.value.queue_capacity || 0)
  if (capacity <= 0) return 0
  return Math.min(100, Math.max(0, (Number(health.value.queue_depth || 0) / capacity) * 100))
})

const advancedFilterCount = computed(() => [
  filters.start_time,
  filters.end_time,
  filters.host,
  filters.request_id,
  filters.client_request_id,
  filters.user_id,
  filters.api_key_id,
  filters.account_id,
  filters.platform,
  filters.model
].filter((value) => String(value || '').trim().length > 0).length)

const runtimeLevelOptions = [
  { value: 'debug', label: 'debug' },
  { value: 'info', label: 'info' },
  { value: 'warn', label: 'warn' },
  { value: 'error', label: 'error' }
]

const stacktraceLevelOptions = [
  { value: 'none', label: 'none' },
  { value: 'error', label: 'error' },
  { value: 'fatal', label: 'fatal' }
]

const timeRangeOptions = [
  { value: '5m', label: '5m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' }
]

const filterLevelOptions = computed(() => [
  { value: '', label: t('admin.ops.systemLogs.all') },
  { value: 'debug', label: 'debug' },
  { value: 'info', label: 'info' },
  { value: 'warn', label: 'warn' },
  { value: 'error', label: 'error' }
])

const levelBadgeTone = (level: string): 'danger' | 'warning' | 'neutral' | 'info' => {
  const v = String(level || '').toLowerCase()
  if (v === 'error' || v === 'fatal') return 'danger'
  if (v === 'warn' || v === 'warning') return 'warning'
  if (v === 'debug') return 'neutral'
  return 'info'
}

const columns = computed<Column[]>(() => [
  { key: 'created_at', label: t('admin.ops.systemLogs.time'), width: '170px' },
  { key: 'host', label: t('admin.ops.systemLogs.host'), width: '160px' },
  { key: 'level', label: t('admin.ops.systemLogs.level'), width: '90px' },
  { key: 'details', label: t('admin.ops.systemLogs.logDetails') },
])

const formatTime = (value: string) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

const getExtraString = (extra: Record<string, any> | undefined, key: string) => {
  if (!extra) return ''
  const v = extra[key]
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

const formatSystemLogDetail = (row: OpsSystemLog) => {
  const parts: string[] = []
  const msg = String(row.message || '').trim()
  if (msg) parts.push(msg)

  const extra = row.extra || {}
  const statusCode = getExtraString(extra, 'status_code')
  const latencyMs = getExtraString(extra, 'latency_ms')
  const method = getExtraString(extra, 'method')
  const path = getExtraString(extra, 'path')
  const clientIP = getExtraString(extra, 'client_ip')
  const protocol = getExtraString(extra, 'protocol')

  const accessParts: string[] = []
  if (statusCode) accessParts.push(`status=${statusCode}`)
  if (latencyMs) accessParts.push(`latency_ms=${latencyMs}`)
  if (method) accessParts.push(`method=${method}`)
  if (path) accessParts.push(`path=${path}`)
  if (clientIP) accessParts.push(`ip=${clientIP}`)
  if (protocol) accessParts.push(`proto=${protocol}`)
  if (accessParts.length > 0) parts.push(accessParts.join(' '))

  const corrParts: string[] = []
  if (row.request_id) corrParts.push(`req=${row.request_id}`)
  if (row.client_request_id) corrParts.push(`client_req=${row.client_request_id}`)
  if (row.user_id != null) corrParts.push(`user=${row.user_id}`)
  if (row.api_key_id != null) corrParts.push(`key=${row.api_key_id}`)
  if (row.account_id != null) corrParts.push(`acc=${row.account_id}`)
  if (row.platform) corrParts.push(`platform=${row.platform}`)
  if (row.model) corrParts.push(`model=${row.model}`)
  if (corrParts.length > 0) parts.push(corrParts.join(' '))

  const errors = getExtraString(extra, 'errors')
  if (errors) parts.push(`errors=${errors}`)
  const err = getExtraString(extra, 'err') || getExtraString(extra, 'error')
  if (err) parts.push(`error=${err}`)

  // 用空格拼接，交给 CSS 自动换行，尽量“填满再换行”。
  return parts.join('  ')
}

const toRFC3339 = (value: string) => {
  if (!value) return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

const buildQuery = () => {
  const query: Record<string, any> = {
    page: page.value,
    page_size: pageSize.value,
    time_range: filters.time_range
  }

  if (filters.time_range === '30d') {
    query.time_range = '30d'
  }
  if (filters.start_time) query.start_time = toRFC3339(filters.start_time)
  if (filters.end_time) query.end_time = toRFC3339(filters.end_time)
  if (filters.host.trim()) query.host = filters.host.trim()
  if (filters.level.trim()) query.level = filters.level.trim()
  if (filters.component.trim()) query.component = filters.component.trim()
  if (filters.request_id.trim()) query.request_id = filters.request_id.trim()
  if (filters.client_request_id.trim()) query.client_request_id = filters.client_request_id.trim()
  if (filters.user_id.trim()) {
    const v = Number.parseInt(filters.user_id.trim(), 10)
    if (Number.isFinite(v) && v > 0) query.user_id = v
  }
  if (filters.api_key_id.trim()) {
    const v = Number.parseInt(filters.api_key_id.trim(), 10)
    if (Number.isFinite(v) && v > 0) query.api_key_id = v
  }
  if (filters.account_id.trim()) {
    const v = Number.parseInt(filters.account_id.trim(), 10)
    if (Number.isFinite(v) && v > 0) query.account_id = v
  }
  if (filters.platform.trim()) query.platform = filters.platform.trim()
  if (filters.model.trim()) query.model = filters.model.trim()
  if (filters.q.trim()) query.q = filters.q.trim()
  return query
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const res = await opsAPI.listSystemLogs(buildQuery())
    logs.value = res.items || []
    total.value = res.total || 0
  } catch (err: any) {
    console.error('[OpsSystemLogTable] Failed to fetch logs', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.systemLogs.loadFailed'))
  } finally {
    loading.value = false
  }
}

const fetchHealth = async () => {
  try {
    health.value = await opsAPI.getSystemLogSinkHealth()
  } catch {
    // 忽略健康数据读取失败，不影响主流程。
  }
}

const loadRuntimeConfig = async () => {
  runtimeLoading.value = true
  try {
    const cfg = await opsAPI.getRuntimeLogConfig()
    runtimeConfig.level = cfg.level
    runtimeConfig.enable_sampling = cfg.enable_sampling
    runtimeConfig.sampling_initial = cfg.sampling_initial
    runtimeConfig.sampling_thereafter = cfg.sampling_thereafter
    runtimeConfig.caller = cfg.caller
    runtimeConfig.stacktrace_level = cfg.stacktrace_level
    runtimeConfig.retention_days = cfg.retention_days
  } catch (err: any) {
    console.error('[OpsSystemLogTable] Failed to load runtime log config', err)
  } finally {
    runtimeLoading.value = false
  }
}

const saveRuntimeConfig = async () => {
  runtimeSaving.value = true
  try {
    const saved = await opsAPI.updateRuntimeLogConfig({ ...runtimeConfig })
    runtimeConfig.level = saved.level
    runtimeConfig.enable_sampling = saved.enable_sampling
    runtimeConfig.sampling_initial = saved.sampling_initial
    runtimeConfig.sampling_thereafter = saved.sampling_thereafter
    runtimeConfig.caller = saved.caller
    runtimeConfig.stacktrace_level = saved.stacktrace_level
    runtimeConfig.retention_days = saved.retention_days
    appStore.showSuccess(t('admin.ops.systemLogs.runtimeConfigActive'))
  } catch (err: any) {
    console.error('[OpsSystemLogTable] Failed to save runtime log config', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.systemLogs.runtimeConfigSaveFailed'))
  } finally {
    runtimeSaving.value = false
  }
}

const resetRuntimeConfig = async () => {
  runtimeSaving.value = true
  try {
    const saved = await opsAPI.resetRuntimeLogConfig()
    runtimeConfig.level = saved.level
    runtimeConfig.enable_sampling = saved.enable_sampling
    runtimeConfig.sampling_initial = saved.sampling_initial
    runtimeConfig.sampling_thereafter = saved.sampling_thereafter
    runtimeConfig.caller = saved.caller
    runtimeConfig.stacktrace_level = saved.stacktrace_level
    runtimeConfig.retention_days = saved.retention_days
    appStore.showSuccess(t('admin.ops.systemLogs.runtimeConfigReset'))
    await fetchHealth()
  } catch (err: any) {
    console.error('[OpsSystemLogTable] Failed to reset runtime log config', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.systemLogs.runtimeConfigResetFailed'))
  } finally {
    runtimeSaving.value = false
  }
}

const cleanupCurrentFilter = async () => {
  cleanupLoading.value = true
  try {
    const payload = {
      start_time: toRFC3339(filters.start_time),
      end_time: toRFC3339(filters.end_time),
      host: filters.host.trim() || undefined,
      level: filters.level.trim() || undefined,
      component: filters.component.trim() || undefined,
      request_id: filters.request_id.trim() || undefined,
      client_request_id: filters.client_request_id.trim() || undefined,
      user_id: filters.user_id.trim() ? Number.parseInt(filters.user_id.trim(), 10) : undefined,
      api_key_id: filters.api_key_id.trim() ? Number.parseInt(filters.api_key_id.trim(), 10) : undefined,
      account_id: filters.account_id.trim() ? Number.parseInt(filters.account_id.trim(), 10) : undefined,
      platform: filters.platform.trim() || undefined,
      model: filters.model.trim() || undefined,
      q: filters.q.trim() || undefined
    }
    const res = await opsAPI.cleanupSystemLogs(payload)
    appStore.showSuccess(t('admin.ops.systemLogs.cleanupSuccess', { count: res.deleted || 0 }))
    page.value = 1
    await Promise.all([fetchLogs(), fetchHealth()])
  } catch (err: any) {
    console.error('[OpsSystemLogTable] Failed to cleanup logs', err)
    appStore.showError(
      extractApiErrorMessage(err, t('admin.ops.systemLogs.cleanupFailed'), {
        OPS_SYSTEM_LOG_CLEANUP_FILTER_REQUIRED: t('admin.ops.systemLogs.cleanupFilterRequired')
      })
    )
  } finally {
    cleanupLoading.value = false
  }
}

const requestCleanup = () => {
  confirmAction.value = 'cleanup'
}

const requestRuntimeReset = () => {
  confirmAction.value = 'reset-runtime'
}

const closeConfirm = () => {
  if (!cleanupLoading.value && !runtimeSaving.value) confirmAction.value = null
}

const confirmPending = computed(() =>
  confirmAction.value === 'cleanup' ? cleanupLoading.value : runtimeSaving.value
)

const confirmTitle = computed(() =>
  confirmAction.value === 'cleanup'
    ? t('admin.ops.systemLogs.cleanCurrentFilters')
    : t('admin.ops.systemLogs.resetDefaults')
)

const confirmMessage = computed(() =>
  confirmAction.value === 'cleanup'
    ? t('admin.ops.systemLogs.cleanupConfirm')
    : t('admin.ops.systemLogs.resetRuntimeConfigConfirm')
)

const handleConfirm = async () => {
  const action = confirmAction.value
  if (!action) return
  if (action === 'cleanup') await cleanupCurrentFilter()
  else await resetRuntimeConfig()
  confirmAction.value = null
}

const resetFilters = () => {
  filters.time_range = '1h'
  filters.start_time = ''
  filters.end_time = ''
  filters.host = ''
  filters.level = ''
  filters.component = ''
  filters.request_id = ''
  filters.client_request_id = ''
  filters.user_id = ''
  filters.api_key_id = ''
  filters.account_id = ''
  filters.platform = props.platformFilter || ''
  filters.model = ''
  filters.q = ''
  page.value = 1
  fetchLogs()
}

watch(() => props.platformFilter, (v) => {
  if (v && !filters.platform) {
    filters.platform = v
    page.value = 1
    fetchLogs()
  }
})

watch(() => props.refreshToken, () => {
  fetchLogs()
  fetchHealth()
})

const onPageChange = (next: number) => {
  page.value = next
  fetchLogs()
}

const onPageSizeChange = (next: number) => {
  pageSize.value = next
  page.value = 1
  fetchLogs()
}

const applyFilters = () => {
  page.value = 1
  fetchLogs()
}

onMounted(async () => {
  if (props.platformFilter) {
    filters.platform = props.platformFilter
  }
  await Promise.all([fetchLogs(), fetchHealth(), loadRuntimeConfig()])
})
</script>

<template>
  <section class="ops-system-log">
    <header class="ops-system-log__header">
      <div class="ops-system-log__heading">
        <h3>{{ t('admin.ops.systemLogs.title') }}</h3>
        <p>{{ t('admin.ops.systemLogs.description') }}</p>
      </div>
      <div class="ops-system-log__health">
        <div class="ops-system-log__metric ops-system-log__metric--queue">
          <span>{{ t('admin.ops.systemLogs.queue') }}</span>
          <strong>{{ health.queue_depth }}/{{ health.queue_capacity }}</strong>
          <UiProgressBar class="ops-system-log__queue-progress" :value="queueUsagePercent" :show-value="false" />
        </div>
        <div class="ops-system-log__metric"><span>{{ t('admin.ops.systemLogs.written') }}</span><strong>{{ health.written_count }}</strong></div>
        <div class="ops-system-log__metric"><span>{{ t('admin.ops.systemLogs.dropped') }}</span><strong :class="{ 'is-warning': health.dropped_count > 0 }">{{ health.dropped_count }}</strong></div>
        <div class="ops-system-log__metric"><span>{{ t('admin.ops.systemLogs.failed') }}</span><strong :class="{ 'is-danger': health.write_failed_count > 0 }">{{ health.write_failed_count }}</strong></div>
        <div class="ops-system-log__metric"><span>{{ t('admin.ops.systemLogs.avgWriteDelay') }}</span><strong>{{ health.avg_write_delay_ms }} ms</strong></div>
      </div>
    </header>

    <p v-if="health.last_error" class="ops-system-log__health-error">
      <strong>{{ t('admin.ops.systemLogs.latestWriteError') }}</strong> {{ health.last_error }}
    </p>

    <div class="ops-system-log__controls">
      <UiFilterBar :active-count="advancedFilterCount" @clear="resetFilters">
        <UiSelect class="ops-system-log__filter" v-model="filters.time_range" density="compact" :label="t('admin.ops.systemLogs.timeRange')" :options="timeRangeOptions" />
        <UiSelect class="ops-system-log__filter" v-model="filters.level" density="compact" :label="t('admin.ops.systemLogs.level')" :options="filterLevelOptions" />
        <UiTextField class="ops-system-log__filter" v-model="filters.component" density="compact" :label="t('admin.ops.systemLogs.component')" :placeholder="t('admin.ops.systemLogs.componentPlaceholder')" />
        <UiTextField class="ops-system-log__filter ops-system-log__filter--wide" v-model="filters.q" density="compact" :label="t('admin.ops.systemLogs.keyword')" :placeholder="t('admin.ops.systemLogs.keywordPlaceholder')" @enter="applyFilters" />
        <template #actions>
          <UiButton variant="primary" density="compact" @click="applyFilters">
            <template #icon><Icon name="search" size="sm" /></template>
            {{ t('admin.ops.systemLogs.search') }}
          </UiButton>
        </template>
      </UiFilterBar>

      <div class="ops-system-log__actions">
        <UiButton density="dense" :aria-expanded="showAdvancedFilters" @click="showAdvancedFilters = !showAdvancedFilters">
          <template #icon><Icon name="filter" size="sm" /></template>
          {{ t('admin.ops.systemLogs.advancedFilters') }}
          <UiBadge v-if="advancedFilterCount" :label="String(advancedFilterCount)" />
        </UiButton>
        <UiButton density="dense" :aria-expanded="showRuntimeConfig" @click="showRuntimeConfig = !showRuntimeConfig">
          <template #icon><Icon name="cog" size="sm" /></template>
          {{ t('admin.ops.systemLogs.runtimeConfigShort') }}
        </UiButton>
        <UiButton density="dense" @click="resetFilters">{{ t('common.reset') }}</UiButton>
        <UiIconButton icon="refresh" density="dense" variant="ghost" :label="t('admin.ops.systemLogs.refreshHealth')" @click="fetchHealth" />
        <UiButton variant="danger" density="dense" class="ops-system-log__cleanup" @click="requestCleanup">
          <template #icon><Icon name="trash" size="sm" /></template>
          {{ t('admin.ops.systemLogs.cleanCurrentFilters') }}
        </UiButton>
      </div>

      <section v-if="showAdvancedFilters" class="ops-system-log__expandable">
        <h4>{{ t('admin.ops.systemLogs.advancedFilters') }}</h4>
        <AppGrid min="180px" :gap="10">
          <UiTextField v-model="filters.start_time" type="datetime-local" density="compact" :label="t('admin.ops.systemLogs.startTime')" />
          <UiTextField v-model="filters.end_time" type="datetime-local" density="compact" :label="t('admin.ops.systemLogs.endTime')" />
          <UiTextField v-model="filters.host" density="compact" :label="t('admin.ops.systemLogs.host')" />
          <UiTextField v-model="filters.request_id" density="compact" monospace label="request_id" />
          <UiTextField v-model="filters.client_request_id" density="compact" monospace label="client_request_id" />
          <UiTextField v-model="filters.user_id" density="compact" monospace label="user_id" />
          <UiTextField v-model="filters.api_key_id" density="compact" monospace :label="t('admin.ops.systemLogs.keyId')" />
          <UiTextField v-model="filters.account_id" density="compact" monospace label="account_id" />
          <UiTextField v-model="filters.platform" density="compact" :label="t('admin.ops.systemLogs.platform')" />
          <UiTextField v-model="filters.model" density="compact" :label="t('admin.ops.systemLogs.model')" />
        </AppGrid>
      </section>

      <section v-if="showRuntimeConfig" class="ops-system-log__expandable">
        <header class="ops-system-log__subheading">
          <div><h4>{{ t('admin.ops.systemLogs.runtimeConfig') }}</h4><p>{{ t('admin.ops.systemLogs.runtimeConfigDescription') }}</p></div>
          <UiSpinner v-if="runtimeLoading" size="sm" :label="t('common.loading')" />
        </header>
        <AppGrid min="180px" :gap="10">
          <UiSelect v-model="runtimeConfig.level" density="compact" :label="t('admin.ops.systemLogs.level')" :options="runtimeLevelOptions" />
          <UiSelect v-model="runtimeConfig.stacktrace_level" density="compact" :label="t('admin.ops.systemLogs.stacktraceThreshold')" :options="stacktraceLevelOptions" />
          <UiNumberStepper v-model="runtimeConfig.sampling_initial" :label="t('admin.ops.systemLogs.samplingInitial')" :min="1" />
          <UiNumberStepper v-model="runtimeConfig.sampling_thereafter" :label="t('admin.ops.systemLogs.samplingThereafter')" :min="1" />
          <UiNumberStepper v-model="runtimeConfig.retention_days" :label="t('admin.ops.systemLogs.retentionDays')" :min="1" :max="3650" />
        </AppGrid>
        <div class="ops-system-log__runtime-footer">
          <div class="ops-system-log__switches">
            <label><UiSwitch v-model="runtimeConfig.caller" :label="t('admin.ops.systemLogs.caller')" /><span>{{ t('admin.ops.systemLogs.caller') }}</span></label>
            <label><UiSwitch v-model="runtimeConfig.enable_sampling" :label="t('admin.ops.systemLogs.sampling')" /><span>{{ t('admin.ops.systemLogs.sampling') }}</span></label>
          </div>
          <div class="ops-system-log__runtime-actions">
            <UiButton variant="primary" density="dense" :loading="runtimeSaving" @click="saveRuntimeConfig">{{ t('admin.ops.systemLogs.saveAndApply') }}</UiButton>
            <UiButton density="dense" :disabled="runtimeSaving" @click="requestRuntimeReset">{{ t('admin.ops.systemLogs.resetDefaults') }}</UiButton>
          </div>
        </div>
      </section>
    </div>

    <div class="ops-system-log__table">
      <UiDataTable class="ops-system-log__data" :columns="columns" :data="logs" :loading="loading" :mobile-table="true" :aria-label="t('admin.ops.systemLogs.title')">
        <template #cell-created_at="{ row }"><span class="ops-system-log__time">{{ formatTime(row.created_at) }}</span></template>
        <template #cell-host="{ row }"><span class="ops-system-log__host" :title="row.host || '-'">{{ row.host || '-' }}</span></template>
        <template #cell-level="{ row }"><UiBadge :tone="levelBadgeTone(row.level)" :label="row.level" /></template>
        <template #cell-details="{ row }"><span class="ops-system-log__detail">{{ formatSystemLogDetail(row) }}</span></template>
        <template #empty><UiEmptyState :title="t('admin.ops.systemLogs.empty')" /></template>
      </UiDataTable>
      <div class="ops-system-log__pagination">
        <UiPagination :total="total" :page="page" :page-size="pageSize" @update:page="onPageChange" @update:page-size="onPageSizeChange" />
      </div>
    </div>

    <UiConfirmDialog
      :show="confirmAction !== null"
      :title="confirmTitle"
      :message="confirmMessage"
      danger
      :pending="confirmPending"
      @confirm="handleConfirm"
      @cancel="closeConfirm"
    />
  </section>
</template>

<style scoped>
.ops-system-log { overflow: hidden; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-panel); background: var(--ui-surface); }
.ops-system-log__header { display: grid; grid-template-columns: minmax(180px,.7fr) minmax(0,1.5fr); align-items: center; gap: 24px; padding: 16px; border-bottom: 1px solid var(--ui-border-soft); }
.ops-system-log__heading h3,.ops-system-log__expandable h4 { margin: 0; color: var(--ui-text); font-size: 14px; line-height: 22px; }
.ops-system-log__heading p,.ops-system-log__subheading p { margin: 2px 0 0; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.ops-system-log__health { display: grid; grid-template-columns: minmax(150px,1.5fr) repeat(4,minmax(84px,1fr)); }
.ops-system-log__metric { min-width: 0; padding: 2px 12px; border-left: 1px solid var(--ui-border-soft); }
.ops-system-log__metric > span { display: block; overflow: hidden; color: var(--ui-text-soft); font-size: 10px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.ops-system-log__metric strong { display: block; margin-top: 2px; overflow: hidden; color: var(--ui-text); font-size: 13px; font-variant-numeric: tabular-nums; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.ops-system-log__metric--queue { display: grid; grid-template-columns: 1fr auto; column-gap: 8px; }
.ops-system-log__queue-progress { grid-column: 1 / -1; gap: 0; margin-top: 4px; }
.is-warning { color: var(--ui-warning) !important; }.is-danger { color: var(--ui-danger) !important; }
.ops-system-log__health-error { margin: 0; padding: 8px 16px; border-bottom: 1px solid color-mix(in srgb,var(--ui-danger) 20%,var(--ui-border)); color: var(--ui-danger); background: color-mix(in srgb,var(--ui-danger) 6%,var(--ui-surface)); font-size: 12px; line-height: 18px; }
.ops-system-log__controls { padding: 8px 16px 14px; border-bottom: 1px solid var(--ui-border-soft); }
.ops-system-log__filter { min-width: 140px; flex: 1; }.ops-system-log__filter--wide { min-width: 220px; flex: 1.5; }
.ops-system-log__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 8px; }.ops-system-log__cleanup { margin-left: auto; }
.ops-system-log__expandable { margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--ui-border-soft); }.ops-system-log__expandable > h4 { margin-bottom: 10px; }
.ops-system-log__subheading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.ops-system-log__runtime-footer,.ops-system-log__switches,.ops-system-log__runtime-actions { display: flex; align-items: center; gap: 12px; }.ops-system-log__runtime-footer { justify-content: space-between; margin-top: 12px; }.ops-system-log__switches label { display: flex; align-items: center; gap: 7px; color: var(--ui-text-muted); font-size: 12px; }
.ops-system-log__table { min-height: 360px; }.ops-system-log__data { max-height: 640px; overflow: auto; }.ops-system-log__time,.ops-system-log__host { color: var(--ui-text-muted); white-space: nowrap; }.ops-system-log__host { display: block; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }.ops-system-log__detail { display: block; min-width: 360px; max-width: 760px; overflow-wrap: anywhere; color: var(--ui-text-muted); font-family: var(--ui-font-mono); font-size: 12px; line-height: 18px; }.ops-system-log__pagination { border-top: 1px solid var(--ui-border-soft); }
@media (max-width: 900px) { .ops-system-log__header { grid-template-columns: 1fr; }.ops-system-log__health { grid-template-columns: repeat(3,1fr); }.ops-system-log__metric--queue { grid-column: span 2; }.ops-system-log__runtime-footer { align-items: stretch; flex-direction: column; }.ops-system-log__runtime-actions { justify-content: flex-end; } }
@media (max-width: 640px) { .ops-system-log__header,.ops-system-log__controls { padding-inline: 12px; }.ops-system-log__health { grid-template-columns: repeat(2,minmax(0,1fr)); }.ops-system-log__metric--queue { grid-column: 1 / -1; }.ops-system-log__metric { padding-block: 7px; }.ops-system-log__cleanup { margin-left: 0; }.ops-system-log__switches { align-items: flex-start; flex-direction: column; }.ops-system-log__runtime-actions { display: grid; width: 100%; grid-template-columns: 1fr 1fr; }}
</style>
