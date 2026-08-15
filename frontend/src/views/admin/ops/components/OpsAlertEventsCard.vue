<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import Icon from '@/components/icons/Icon.vue'
import {
  UiBadge,
  UiButton,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiLink,
  UiSelect,
  UiSpinner,
  type Column,
} from '@/components/ui'
import { opsAPI, type AlertEventsQuery } from '@/api/admin/ops'
import type { AlertEvent } from '../types'
import { formatDateTime } from '../utils/opsFormatters'

const { t } = useI18n()
const appStore = useAppStore()

const PAGE_SIZE = 10

const loading = ref(false)
const loadingMore = ref(false)
const events = ref<AlertEvent[]>([])
const hasMore = ref(true)
let listRequestId = 0
let detailRequestId = 0
let historyRequestId = 0

// Detail modal
const showDetail = ref(false)
const selected = ref<AlertEvent | null>(null)
const detailLoading = ref(false)
const detailActionLoading = ref(false)
const historyLoading = ref(false)
const history = ref<AlertEvent[]>([])
const historyRange = ref('7d')
const historyRangeOptions = computed(() => [
  { value: '7d', label: t('admin.ops.timeRange.7d') },
  { value: '30d', label: t('admin.ops.timeRange.30d') }
])

const silenceDuration = ref('1h')
const silenceDurationOptions = computed(() => [
  { value: '1h', label: t('admin.ops.timeRange.1h') },
  { value: '24h', label: t('admin.ops.timeRange.24h') },
  { value: '7d', label: t('admin.ops.timeRange.7d') }
])

// Filters
const timeRange = ref('24h')
const timeRangeOptions = computed(() => [
  { value: '5m', label: t('admin.ops.timeRange.5m') },
  { value: '30m', label: t('admin.ops.timeRange.30m') },
  { value: '1h', label: t('admin.ops.timeRange.1h') },
  { value: '6h', label: t('admin.ops.timeRange.6h') },
  { value: '24h', label: t('admin.ops.timeRange.24h') },
  { value: '7d', label: t('admin.ops.timeRange.7d') },
  { value: '30d', label: t('admin.ops.timeRange.30d') }
])

const severity = ref<string>('')
const severityOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'P0', label: 'P0' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
  { value: 'P3', label: 'P3' }
])

const status = ref<string>('')
const statusOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'firing', label: t('admin.ops.alertEvents.status.firing') },
  { value: 'resolved', label: t('admin.ops.alertEvents.status.resolved') },
  { value: 'manual_resolved', label: t('admin.ops.alertEvents.status.manualResolved') }
])

const emailSent = ref<string>('')
const emailSentOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'true', label: t('admin.ops.alertEvents.table.emailSent') },
  { value: 'false', label: t('admin.ops.alertEvents.table.emailIgnored') }
])

function buildQuery(overrides: Partial<AlertEventsQuery> = {}): AlertEventsQuery {
  const q: AlertEventsQuery = {
    limit: PAGE_SIZE,
    time_range: timeRange.value
  }
  if (severity.value) q.severity = severity.value
  if (status.value) q.status = status.value
  if (emailSent.value === 'true') q.email_sent = true
  if (emailSent.value === 'false') q.email_sent = false
  return { ...q, ...overrides }
}

async function loadFirstPage() {
  const requestId = ++listRequestId
  loading.value = true
  loadingMore.value = false
  try {
    const data = await opsAPI.listAlertEvents(buildQuery())
    if (requestId !== listRequestId) return
    events.value = data
    hasMore.value = data.length === PAGE_SIZE
  } catch (err: any) {
    if (requestId !== listRequestId) return
    console.error('[OpsAlertEventsCard] Failed to load alert events', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.alertEvents.loadFailed'))
    events.value = []
    hasMore.value = false
  } finally {
    if (requestId === listRequestId) loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || loading.value) return
  if (!hasMore.value) return
  const last = events.value[events.value.length - 1]
  if (!last) return

  const requestId = listRequestId
  loadingMore.value = true
  try {
    const data = await opsAPI.listAlertEvents(
      buildQuery({ before_fired_at: last.fired_at || last.created_at, before_id: last.id })
    )
    if (requestId !== listRequestId) return
    if (!data.length) {
      hasMore.value = false
      return
    }
    events.value = [...events.value, ...data]
    if (data.length < PAGE_SIZE) hasMore.value = false
  } catch (err: any) {
    if (requestId !== listRequestId) return
    console.error('[OpsAlertEventsCard] Failed to load more alert events', err)
    hasMore.value = false
  } finally {
    if (requestId === listRequestId) loadingMore.value = false
  }
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement | null
  if (!el) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120
  if (nearBottom) loadMore()
}

function getDimensionString(event: AlertEvent | null | undefined, key: string): string {
  const v = event?.dimensions?.[key]
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

function formatDurationMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms))
  const sec = Math.floor(safe / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  return `${day}d`
}

function formatDurationLabel(event: AlertEvent): string {
  const firedAt = new Date(event.fired_at || event.created_at)
  if (Number.isNaN(firedAt.getTime())) return '-'
  const resolvedAtStr = event.resolved_at || null
  const status = String(event.status || '').trim().toLowerCase()

  if (resolvedAtStr) {
    const resolvedAt = new Date(resolvedAtStr)
    if (!Number.isNaN(resolvedAt.getTime())) {
      const ms = resolvedAt.getTime() - firedAt.getTime()
      const prefix = status === 'manual_resolved'
        ? t('admin.ops.alertEvents.status.manualResolved')
        : t('admin.ops.alertEvents.status.resolved')
      return `${prefix} ${formatDurationMs(ms)}`
    }
  }

  const now = Date.now()
  const ms = now - firedAt.getTime()
  return `${t('admin.ops.alertEvents.status.firing')} ${formatDurationMs(ms)}`
}

function formatDimensionsSummary(event: AlertEvent): string {
  const parts: string[] = []
  const platform = getDimensionString(event, 'platform')
  if (platform) parts.push(`platform=${platform}`)
  const groupId = event.dimensions?.group_id
  if (groupId != null && groupId !== '') parts.push(`group_id=${String(groupId)}`)
  const region = getDimensionString(event, 'region')
  if (region) parts.push(`region=${region}`)
  return parts.length ? parts.join(' ') : '-'
}

function closeDetail() {
  detailRequestId += 1
  historyRequestId += 1
  showDetail.value = false
  selected.value = null
  history.value = []
  detailLoading.value = false
  historyLoading.value = false
}

async function openDetail(row: AlertEvent) {
  const requestId = ++detailRequestId
  historyRequestId += 1
  showDetail.value = true
  selected.value = row
  detailLoading.value = true
  historyLoading.value = true

  try {
    const detail = await opsAPI.getAlertEvent(row.id)
    if (requestId !== detailRequestId || !showDetail.value || selected.value?.id !== row.id) return
    selected.value = detail
  } catch (err: any) {
    if (requestId !== detailRequestId || !showDetail.value) return
    console.error('[OpsAlertEventsCard] Failed to load alert detail', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.alertEvents.detail.loadFailed'))
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
  }

  if (requestId === detailRequestId && showDetail.value) await loadHistory()
}

async function loadHistory() {
  const ev = selected.value
  if (!ev) {
    history.value = []
    historyLoading.value = false
    return
  }

  const eventId = ev.id
  const requestId = ++historyRequestId
  historyLoading.value = true
  try {
    const platform = getDimensionString(ev, 'platform')
    const groupIdRaw = ev.dimensions?.group_id
    const groupId = typeof groupIdRaw === 'number' ? groupIdRaw : undefined

    const items = await opsAPI.listAlertEvents({
      limit: 20,
      time_range: historyRange.value,
      platform: platform || undefined,
      group_id: groupId,
      status: ''
    })
    if (requestId !== historyRequestId || !showDetail.value || selected.value?.id !== eventId) return

    // Best-effort: narrow to same rule_id + dimensions
    history.value = items.filter((it) => {
      if (it.rule_id !== ev.rule_id) return false
      const p1 = getDimensionString(it, 'platform')
      const p2 = getDimensionString(ev, 'platform')
      if ((p1 || '') !== (p2 || '')) return false
      const g1 = it.dimensions?.group_id
      const g2 = ev.dimensions?.group_id
      return (g1 ?? null) === (g2 ?? null)
    })
  } catch (err: any) {
    if (requestId !== historyRequestId || !showDetail.value) return
    console.error('[OpsAlertEventsCard] Failed to load alert history', err)
    history.value = []
  } finally {
    if (requestId === historyRequestId) historyLoading.value = false
  }
}

function durationToUntilRFC3339(duration: string): string {
  const now = Date.now()
  if (duration === '1h') return new Date(now + 60 * 60 * 1000).toISOString()
  if (duration === '24h') return new Date(now + 24 * 60 * 60 * 1000).toISOString()
  if (duration === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()
  return new Date(now + 60 * 60 * 1000).toISOString()
}

async function silenceAlert() {
  const ev = selected.value
  if (!ev) return
  if (detailActionLoading.value) return
  detailActionLoading.value = true
  try {
    const platform = getDimensionString(ev, 'platform')
    const groupIdRaw = ev.dimensions?.group_id
    const groupId = typeof groupIdRaw === 'number' ? groupIdRaw : null
    const region = getDimensionString(ev, 'region') || null

    await opsAPI.createAlertSilence({
      rule_id: ev.rule_id,
      platform: platform || '',
      group_id: groupId ?? undefined,
      region: region ?? undefined,
      until: durationToUntilRFC3339(silenceDuration.value),
      reason: `silence from UI (${silenceDuration.value})`
    })

    appStore.showSuccess(t('admin.ops.alertEvents.detail.silenceSuccess'))
  } catch (err: any) {
    console.error('[OpsAlertEventsCard] Failed to silence alert', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.alertEvents.detail.silenceFailed'))
  } finally {
    detailActionLoading.value = false
  }
}

async function manualResolve() {
  if (!selected.value) return
  if (detailActionLoading.value) return
  detailActionLoading.value = true
  try {
    await opsAPI.updateAlertEventStatus(selected.value.id, 'manual_resolved')
    appStore.showSuccess(t('admin.ops.alertEvents.detail.manualResolvedSuccess'))

    // Refresh detail + first page to reflect new status
    const detail = await opsAPI.getAlertEvent(selected.value.id)
    selected.value = detail
    await loadFirstPage()
    await loadHistory()
  } catch (err: any) {
    console.error('[OpsAlertEventsCard] Failed to resolve alert', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.alertEvents.detail.manualResolvedFailed'))
  } finally {
    detailActionLoading.value = false
  }
}

onMounted(() => {
  loadFirstPage()
})

watch([timeRange, severity, status, emailSent], () => {
  events.value = []
  hasMore.value = true
  loadFirstPage()
})

watch(historyRange, () => {
  if (showDetail.value) loadHistory()
})

onBeforeUnmount(() => {
  listRequestId += 1
  detailRequestId += 1
  historyRequestId += 1
})

function severityBadgeTone(severity: string | undefined): 'danger' | 'warning' | 'info' | 'neutral' {
  const s = String(severity || '').trim().toLowerCase()
  if (s === 'p0' || s === 'critical') return 'danger'
  if (s === 'p1' || s === 'warning') return 'warning'
  if (s === 'p2' || s === 'info') return 'info'
  return 'neutral'
}

function statusBadgeTone(status: string | undefined): 'danger' | 'success' | 'neutral' {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'firing') return 'danger'
  if (s === 'resolved') return 'success'
  return 'neutral'
}

function formatStatusLabel(status: string | undefined): string {
  const s = String(status || '').trim().toLowerCase()
  if (!s) return '-'
  if (s === 'firing') return t('admin.ops.alertEvents.status.firing')
  if (s === 'resolved') return t('admin.ops.alertEvents.status.resolved')
  if (s === 'manual_resolved') return t('admin.ops.alertEvents.status.manualResolved')
  return s.toUpperCase()
}

const empty = computed(() => events.value.length === 0 && !loading.value)

const columns = computed<Column[]>(() => [
  { key: 'time', label: t('admin.ops.alertEvents.table.time') },
  { key: 'severity', label: t('admin.ops.alertEvents.table.severity') },
  { key: 'platform', label: t('admin.ops.alertEvents.table.platform') },
  { key: 'rule', label: t('admin.ops.alertEvents.table.ruleId') },
  { key: 'title', label: t('admin.ops.alertEvents.table.title') },
  { key: 'duration', label: t('admin.ops.alertEvents.table.duration') },
  { key: 'dimensions', label: t('admin.ops.alertEvents.table.dimensions') },
  { key: 'email', label: t('admin.ops.alertEvents.table.email') },
])

const historyColumns = computed<Column[]>(() => [
  { key: 'time', label: t('admin.ops.alertEvents.table.time') },
  { key: 'status', label: t('admin.ops.alertEvents.table.status') },
  { key: 'metric', label: t('admin.ops.alertEvents.table.metric') },
])
</script>

<template>
  <section class="ops-alert-events">
    <header class="ops-alert-events__header">
      <div class="ops-alert-events__heading">
        <h3>{{ t('admin.ops.alertEvents.title') }}</h3>
        <p>{{ t('admin.ops.alertEvents.description') }}</p>
      </div>

      <div class="ops-alert-events__filters">
        <UiSelect :model-value="timeRange" :options="timeRangeOptions" density="dense" @change="timeRange = String($event || '24h')" />
        <UiSelect :model-value="severity" :options="severityOptions" density="dense" @change="severity = String($event || '')" />
        <UiSelect :model-value="status" :options="statusOptions" density="dense" @change="status = String($event || '')" />
        <UiSelect :model-value="emailSent" :options="emailSentOptions" density="dense" @change="emailSent = String($event || '')" />
        <UiButton density="dense" :loading="loading" @click="loadFirstPage">
          <template #icon><Icon name="refresh" size="sm" /></template>
          {{ t('common.refresh') }}
        </UiButton>
      </div>
    </header>

    <div v-if="loading" class="ops-alert-events__loading"><UiSpinner :label="t('admin.ops.alertEvents.loading')" /></div>

    <UiEmptyState v-else-if="empty" :title="t('admin.ops.alertEvents.empty')" />

    <div v-else class="ops-alert-events__table">
      <div class="ops-alert-events__scroll" @scroll="onScroll">
        <UiDataTable
          :columns="columns"
          :data="events"
          :mobile-table="true"
          clickable-rows
          :aria-label="t('admin.ops.alertEvents.title')"
          @row-click="openDetail"
        >
          <template #cell-time="{ row }"><span class="ops-alert-events__nowrap">{{ formatDateTime(row.fired_at || row.created_at) }}</span></template>
          <template #cell-severity="{ row }"><span class="ops-alert-events__badges"><UiBadge :tone="severityBadgeTone(row.severity)" :label="row.severity || '-'" /><UiBadge :tone="statusBadgeTone(row.status)" :label="formatStatusLabel(row.status)" /></span></template>
          <template #cell-platform="{ row }"><span class="ops-alert-events__nowrap">{{ getDimensionString(row, 'platform') || '-' }}</span></template>
          <template #cell-rule="{ row }"><span class="ops-alert-events__mono">#{{ row.rule_id }}</span></template>
          <template #cell-title="{ row }"><span class="ops-alert-events__title-cell"><strong>{{ row.title || '-' }}</strong><small v-if="row.description">{{ row.description }}</small></span></template>
          <template #cell-duration="{ row }"><span class="ops-alert-events__nowrap">{{ formatDurationLabel(row) }}</span></template>
          <template #cell-dimensions="{ row }"><span class="ops-alert-events__mono">{{ formatDimensionsSummary(row) }}</span></template>
          <template #cell-email="{ row }"><UiBadge :tone="row.email_sent ? 'success' : 'neutral'" :label="row.email_sent ? t('admin.ops.alertEvents.table.emailSent') : t('admin.ops.alertEvents.table.emailIgnored')" /></template>
        </UiDataTable>
        <div v-if="loadingMore" class="ops-alert-events__loading-more"><UiSpinner size="sm" :label="t('admin.ops.alertEvents.loading')" /></div>
        <div v-else-if="!hasMore && events.length > 0" class="ops-alert-events__end">
          -
        </div>
      </div>
    </div>

    <UiDialog
      :show="showDetail"
      :title="t('admin.ops.alertEvents.detail.title')"
      width="wide"
      :close-on-click-outside="true"
      @close="closeDetail"
    >
      <div v-if="detailLoading" class="ops-alert-events__detail-state"><UiSpinner :label="t('admin.ops.alertEvents.detail.loading')" /></div>

      <UiEmptyState v-else-if="!selected" :title="t('admin.ops.alertEvents.detail.empty')" />

      <div v-else class="ops-alert-events__detail">
        <section class="ops-alert-events__summary">
          <div class="ops-alert-events__summary-row">
            <div class="ops-alert-events__summary-copy">
              <div class="ops-alert-events__badges">
                <UiBadge :tone="severityBadgeTone(selected.severity)" :label="selected.severity || '-'" />
                <UiBadge :tone="statusBadgeTone(selected.status)" :label="formatStatusLabel(selected.status)" />
              </div>
              <h4>{{ selected.title || '-' }}</h4>
              <p v-if="selected.description">{{ selected.description }}</p>
            </div>

            <div class="ops-alert-events__detail-actions">
              <div class="ops-alert-events__silence">
                <span>{{ t('admin.ops.alertEvents.detail.silence') }}</span>
                <UiSelect
                  :model-value="silenceDuration"
                  :options="silenceDurationOptions"
                  density="dense"
                  @change="silenceDuration = String($event || '1h')"
                />
                <UiButton density="dense" :disabled="detailActionLoading" @click="silenceAlert">
                  <template #icon><Icon name="ban" size="sm" /></template>
                  {{ t('common.apply') }}
                </UiButton>
              </div>

              <UiButton density="dense" :disabled="detailActionLoading" @click="manualResolve">
                <template #icon><Icon name="checkCircle" size="sm" /></template>
                {{ t('admin.ops.alertEvents.detail.manualResolve') }}
              </UiButton>
            </div>
          </div>
        </section>

          <dl class="ops-alert-events__facts">
            <div><dt>{{ t('admin.ops.alertEvents.detail.firedAt') }}</dt><dd>{{ formatDateTime(selected.fired_at || selected.created_at) }}</dd></div>
            <div><dt>{{ t('admin.ops.alertEvents.detail.resolvedAt') }}</dt><dd>{{ selected.resolved_at ? formatDateTime(selected.resolved_at) : '-' }}</dd></div>
            <div>
              <dt>{{ t('admin.ops.alertEvents.detail.ruleId') }}</dt>
              <dd class="ops-alert-events__fact-actions">
                <strong class="ops-alert-events__mono">#{{ selected.rule_id }}</strong>
                <UiLink
                  :href="`/admin/ops?open_alert_rules=1&alert_rule_id=${selected.rule_id}`"
                >
                  {{ t('admin.ops.alertEvents.detail.viewRule') }}
                </UiLink>
                <UiLink
                  :href="`/admin/ops?platform=${encodeURIComponent(getDimensionString(selected,'platform')||'')}&group_id=${selected.dimensions?.group_id || ''}&error_type=request&open_error_details=1`"
                >
                  {{ t('admin.ops.alertEvents.detail.viewLogs') }}
                </UiLink>
              </dd>
            </div>
            <div>
              <dt>{{ t('admin.ops.alertEvents.detail.dimensions') }}</dt>
              <dd class="ops-alert-events__mono">
                <div v-if="getDimensionString(selected, 'platform')">platform={{ getDimensionString(selected, 'platform') }}</div>
                <div v-if="selected.dimensions?.group_id">group_id={{ selected.dimensions.group_id }}</div>
                <div v-if="getDimensionString(selected, 'region')">region={{ getDimensionString(selected, 'region') }}</div>
              </dd>
            </div>
          </dl>


        <section class="ops-alert-events__history">
          <header>
            <div>
              <h4>{{ t('admin.ops.alertEvents.detail.historyTitle') }}</h4>
              <p>{{ t('admin.ops.alertEvents.detail.historyHint') }}</p>
            </div>
            <UiSelect :model-value="historyRange" :options="historyRangeOptions" density="dense" @change="historyRange = String($event || '7d')" />
          </header>

          <div v-if="historyLoading" class="ops-alert-events__detail-state"><UiSpinner size="sm" :label="t('admin.ops.alertEvents.detail.historyLoading')" /></div>
          <UiEmptyState v-else-if="history.length === 0" :title="t('admin.ops.alertEvents.detail.historyEmpty')" />
          <UiDataTable v-else :columns="historyColumns" :data="history" :mobile-table="true">
            <template #cell-time="{ row }"><span class="ops-alert-events__nowrap">{{ formatDateTime(row.fired_at || row.created_at) }}</span></template>
            <template #cell-status="{ row }"><UiBadge :tone="statusBadgeTone(row.status)" :label="formatStatusLabel(row.status)" /></template>
            <template #cell-metric="{ row }"><span class="ops-alert-events__mono">{{ typeof row.metric_value === 'number' && typeof row.threshold_value === 'number' ? `${row.metric_value.toFixed(2)} / ${row.threshold_value.toFixed(2)}` : '-' }}</span></template>
          </UiDataTable>
        </section>
      </div>
    </UiDialog>
  </section>
</template>

<style scoped>
.ops-alert-events { overflow: hidden; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-panel); background: var(--ui-surface); }
.ops-alert-events__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 14px 16px; border-bottom: 1px solid var(--ui-border-soft); }.ops-alert-events__heading h3 { margin: 0; color: var(--ui-text); font-size: 14px; line-height: 22px; }.ops-alert-events__heading p { margin: 2px 0 0; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }.ops-alert-events__filters { display: grid; grid-template-columns: repeat(4,minmax(92px,auto)) auto; align-items: end; gap: 6px; }
.ops-alert-events__loading { display: grid; min-height: 160px; place-items: center; }.ops-alert-events__table { min-width: 0; }.ops-alert-events__scroll { max-height: 600px; overflow: auto; }.ops-alert-events__badges { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }.ops-alert-events__nowrap { color: var(--ui-text-muted); white-space: nowrap; }.ops-alert-events__mono { color: var(--ui-text-muted); font-family: var(--ui-font-mono); font-size: 11px; white-space: nowrap; }.ops-alert-events__title-cell { display: grid; min-width: 240px; max-width: 380px; gap: 2px; }.ops-alert-events__title-cell strong,.ops-alert-events__title-cell small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.ops-alert-events__title-cell strong { color: var(--ui-text); font-size: 12px; }.ops-alert-events__title-cell small { color: var(--ui-text-muted); font-size: 11px; }.ops-alert-events__loading-more { display: flex; justify-content: center; padding: 10px; border-top: 1px solid var(--ui-border-soft); }.ops-alert-events__end { padding: 8px; color: var(--ui-text-soft); text-align: center; }
.ops-alert-events__detail { display: grid; gap: 18px; }.ops-alert-events__detail-state { display: grid; min-height: 160px; place-items: center; }.ops-alert-events__summary { padding-bottom: 16px; border-bottom: 1px solid var(--ui-border-soft); }.ops-alert-events__summary-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }.ops-alert-events__summary-copy { min-width: 0; }.ops-alert-events__summary-copy h4,.ops-alert-events__history h4 { margin: 8px 0 0; color: var(--ui-text); font-size: 14px; line-height: 22px; }.ops-alert-events__summary-copy p,.ops-alert-events__history p { margin: 2px 0 0; color: var(--ui-text-muted); font-size: 12px; line-height: 19px; white-space: pre-wrap; }.ops-alert-events__detail-actions,.ops-alert-events__silence,.ops-alert-events__fact-actions { display: flex; align-items: center; gap: 6px; }.ops-alert-events__detail-actions { flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; }.ops-alert-events__silence > span { color: var(--ui-text-muted); font-size: 11px; }.ops-alert-events__facts { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); margin: 0; border-top: 1px solid var(--ui-border-soft); }.ops-alert-events__facts > div { min-width: 0; padding: 10px 0; border-bottom: 1px solid var(--ui-border-soft); }.ops-alert-events__facts > div:nth-child(odd) { padding-right: 16px; }.ops-alert-events__facts > div:nth-child(even) { padding-left: 16px; border-left: 1px solid var(--ui-border-soft); }.ops-alert-events__facts dt { color: var(--ui-text-soft); font-size: 11px; line-height: 18px; }.ops-alert-events__facts dd { margin: 3px 0 0; color: var(--ui-text); font-size: 12px; line-height: 19px; overflow-wrap: anywhere; }.ops-alert-events__fact-actions { flex-wrap: wrap; }.ops-alert-events__history { border-top: 1px solid var(--ui-border-soft); padding-top: 16px; }.ops-alert-events__history > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }.ops-alert-events__history h4 { margin-top: 0; }
@media (max-width:900px) { .ops-alert-events__header { flex-direction: column; }.ops-alert-events__filters { width: 100%; grid-template-columns: repeat(2,minmax(0,1fr)); }.ops-alert-events__filters > :last-child { grid-column: 1 / -1; } }
@media (max-width:640px) { .ops-alert-events__summary-row { flex-direction: column; }.ops-alert-events__detail-actions { justify-content: flex-start; }.ops-alert-events__facts { grid-template-columns: 1fr; }.ops-alert-events__facts > div:nth-child(n) { padding-inline: 0; border-left: 0; } }
@media (max-width:520px) { .ops-alert-events__header { padding-inline: 12px; }.ops-alert-events__filters { grid-template-columns: 1fr 1fr; }.ops-alert-events__silence { align-items: stretch; flex-direction: column; }.ops-alert-events__detail-actions { align-items: stretch; flex-direction: column; } }
</style>
