<template>
  <UiChartFrame
    :title="t('channelMonitorV2.matrix.title')"
    :description="t('channelMonitorV2.matrix.description')"
    :empty="rows.length === 0"
    :empty-title="t('channelMonitorV2.matrix.emptyTitle')"
    :empty-description="t('channelMonitorV2.empty.description')"
    :height="320"
  >
    <template #actions>
      <UiBadge>{{ bucketLabel }}</UiBadge>
      <UiButton
        density="dense"
        variant="quiet"
        :disabled="!zoomed"
        @click="resetMatrixZoom"
      >
        {{ t('channelMonitorV2.matrix.resetZoom') }}
      </UiButton>
    </template>

    <div
      v-if="rows.length"
      ref="scrollRef"
      class="matrix-scroll"
      @wheel="onMatrixWheel"
    >
      <div class="matrix-table" role="grid" :aria-label="t('channelMonitorV2.matrix.title')" :style="tableStyle">
        <div
          class="matrix-header matrix-row"
          role="row"
          :class="{ 'matrix-row--with-tps': showThroughput }"
        >
          <span role="columnheader">{{ t('channelMonitorV2.matrix.dimension') }}</span>
          <span role="columnheader">{{ t('channelMonitorV2.metrics.successRate') }}</span>
          <span role="columnheader">{{ t('channelMonitorV2.metrics.ttft') }}</span>
          <span v-if="showThroughput" role="columnheader">{{ t('channelMonitorV2.metrics.tps') }}</span>
          <span role="columnheader">{{ t('channelMonitorV2.metrics.cacheRate') }}</span>
          <span role="columnheader" class="pulse-axis">
            <i>{{ axisStart }}</i>
            <i>{{ axisEnd }}</i>
          </span>
        </div>

        <div
          v-for="(entry, rowIndex) in alignedRows"
          :key="rowKey(entry.row)"
          class="matrix-row matrix-data-row"
          role="row"
          :aria-rowindex="rowIndex + 2"
          :class="{ 'matrix-row--with-tps': showThroughput }"
        >
          <div class="dimension-cell" role="gridcell" :title="rowLabel(entry.row)">
            <span :class="['status-dot', cellClass(entry.row.health, entry.row.metrics.request_count)]" />
            <strong>{{ rowLabel(entry.row) }}</strong>
          </div>
          <strong class="summary-value" role="gridcell">{{ successRate(entry.row.metrics) }}</strong>
          <strong class="summary-value" role="gridcell" :title="latencyPrivacy(entry.row.metrics.ttft)">
            {{ formatMs(entry.row.metrics.ttft.p50_ms) }}
          </strong>
          <strong
            v-if="showThroughput"
            class="summary-value"
            role="gridcell"
            :title="exactTps(entry.row.metrics.tpm)"
          >
            {{ formatTps(entry.row.metrics.tpm) }}
          </strong>
          <strong class="summary-value" role="gridcell">{{ formatPercent(entry.row.metrics.cache_rate) }}</strong>
          <div class="pulse-track" role="gridcell" :style="pulseStyle">
            <span
              v-for="(slot, columnIndex) in entry.slots"
              :key="slot.start"
              class="pulse-cell"
              :class="[
                slot.bucket ? cellClass(slot.bucket.health, slot.bucket.metrics.request_count) : 'health-unknown',
                slot.bucket ? 'has-data' : 'is-empty'
              ]"
              :tabindex="rowIndex === activeCell.row && columnIndex === activeCell.column ? 0 : -1"
              :data-row="rowIndex"
              :data-column="columnIndex"
              role="img"
              :title="
                slot.bucket
                  ? bucketTooltip(slot.bucket)
                  : t('channelMonitorV2.matrix.noTrafficAt', { time: formatBucketRange(slot.start) })
              "
              :aria-label="
                slot.bucket
                  ? bucketTooltip(slot.bucket)
                  : t('channelMonitorV2.matrix.noTrafficAt', { time: formatBucketRange(slot.start) })
              "
              @mouseenter="showTooltip($event, slot)"
              @mousemove="moveTooltip($event)"
              @mouseleave="hideTooltip"
              @focus="focusCell(rowIndex, columnIndex, $event, slot)"
              @blur="hideTooltip"
              @keydown="onCellKeydown($event, rowIndex, columnIndex)"
            >
              <span class="pulse-tooltip" role="tooltip">
                <template v-if="slot.bucket">
                  <span class="pulse-tooltip-line pulse-tooltip-title">{{ formatBucketRange(slot.start) }}</span>
                  <span class="pulse-tooltip-line">{{ t('channelMonitorV2.matrix.scoreLine', { score: formatScore(slot.bucket.health) }) }}</span>
                  <span class="pulse-tooltip-line">{{ t('channelMonitorV2.metrics.successRateValue', { value: successRate(slot.bucket.metrics) }) }}</span>
                  <span class="pulse-tooltip-line">{{ t('channelMonitorV2.metrics.ttftValue', { value: latencyPrivacy(slot.bucket.metrics.ttft) }) }}</span>
                  <span v-if="showThroughput" class="pulse-tooltip-line">{{ t('channelMonitorV2.metrics.tpsValue', { value: formatTps(slot.bucket.metrics.tpm) }) }}</span>
                  <span class="pulse-tooltip-line">{{ t('channelMonitorV2.metrics.cacheRateValue', { value: formatPercent(slot.bucket.metrics.cache_rate) }) }}</span>
                  <span class="pulse-tooltip-line">{{ t('channelMonitorV2.metrics.errorRateValue', { value: formatPercent(slot.bucket.metrics.error_rate) }) }}</span>
                  <span v-if="showThroughput" class="pulse-tooltip-line">{{ t('channelMonitorV2.metrics.rpmValue', { value: formatRate(slot.bucket.metrics.rpm) }) }}</span>
                  <span class="pulse-tooltip-line">{{ t('channelMonitorV2.metrics.durationValue', { value: latencyPrivacy(slot.bucket.metrics.duration) }) }}</span>
                </template>
                <template v-else>
                  <span class="pulse-tooltip-line pulse-tooltip-title">{{ formatBucketRange(slot.start) }}</span>
                  <span class="pulse-tooltip-line">{{ t('channelMonitorV2.matrix.noTraffic') }}</span>
                </template>
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="matrix-legend" :aria-label="t('channelMonitorV2.matrix.legendAria')">
        <span><i class="status-dot health-score10" />{{ t('channelMonitorV2.matrix.healthyLegend') }}</span>
        <span><i class="status-dot health-score6" />{{ t('channelMonitorV2.matrix.warningLegend') }}</span>
        <span><i class="status-dot health-score2" />{{ t('channelMonitorV2.matrix.criticalLegend') }}</span>
        <span><i class="status-dot health-unknown" />{{ t('channelMonitorV2.matrix.unknownLegend') }}</span>
      </div>
    </template>
  </UiChartFrame>

  <Teleport to="body">
    <div
      v-if="floatingTooltip.visible"
      class="matrix-floating-tooltip"
      :style="{ left: `${floatingTooltip.x}px`, top: `${floatingTooltip.y}px` }"
      role="tooltip"
    >
      <span
        v-for="(line, index) in floatingTooltip.lines"
        :key="`${index}:${line}`"
        class="matrix-floating-tooltip-line"
        :class="{ 'matrix-floating-tooltip-title': index === 0 }"
      >
        {{ line }}
      </span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, reactive, ref, watch } from 'vue'
import type {
  LatencyMetric,
  MonitorCoverage,
  MonitorHealth,
  MonitorMatrixBucket,
  MonitorMatrixRow,
  MonitorMetric,
} from '@/api/channelMonitorV2'
import { UiBadge, UiButton, UiChartFrame } from '@/components/ui'
import {
  formatLatencyPrivacy,
  formatMonitorMs,
  formatMonitorPercent,
  formatMonitorSuccessRateFromError,
  formatMonitorThroughput,
  formatMonitorTokensPerSecond,
  tokensPerSecondFromTpm,
  healthModeScore,
  healthScoreClass,
} from '@/features/channel-monitor-v2/monitorFormat'
import {
  applyWheelZoom,
  clientXRatio,
  isZoomed,
  resetZoom,
  sliceByZoom,
  type ZoomState,
} from '@/features/channel-monitor-v2/monitorZoom'

type HealthMode = 'overall' | 'success' | 'ttft' | 'cache'
const { t, locale } = useI18n()

const props = withDefaults(
  defineProps<{
    rows: MonitorMatrixRow[]
    coverage: MonitorCoverage
    healthMode: HealthMode
    /** When false, RPM/TPM are omitted from tooltips (user scale privacy). */
    showThroughput?: boolean
  }>(),
  { showThroughput: true },
)

type AlignedSlot = { start: string; bucket?: MonitorMatrixBucket }

const floatingTooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  lines: [] as string[],
})

const scrollRef = ref<HTMLElement | null>(null)
const activeCell = reactive({ row: 0, column: 0 })
const zoom = ref<ZoomState>(resetZoom())
const zoomed = computed(() => isZoomed(zoom.value))

const allBucketStarts = computed(() => {
  // X-axis always spans the UI-selected range [requested_start, requested_end).
  // Partial backfill leaves empty cells until coverage_start/data_through fill in.
  const step = Math.max(60, props.coverage.bucket_seconds) * 1000
  const requestedStart = new Date(props.coverage.requested_start).getTime()
  const requestedEndRaw = props.coverage.requested_end
    ? new Date(props.coverage.requested_end).getTime()
    : NaN
  // Fallback for older payloads without requested_end.
  const dataThrough = new Date(props.coverage.data_through).getTime()
  const end = Number.isFinite(requestedEndRaw) && requestedEndRaw > requestedStart
    ? requestedEndRaw
    : dataThrough
  if (![requestedStart, end].every(Number.isFinite) || requestedStart >= end) return []
  const starts: string[] = []
  for (let cursor = Math.floor(requestedStart / step) * step; cursor < end; cursor += step) {
    starts.push(new Date(cursor).toISOString())
  }
  return starts
})
/** Visible bucket window after X zoom (cursor-centered), not always the tail. */
const bucketStarts = computed(() => sliceByZoom(allBucketStarts.value, zoom.value))
const tableStyle = computed(() => ({
  '--bucket-count': String(Math.max(1, bucketStarts.value.length)),
  minWidth: zoomed.value ? `calc(260px + ${pulseMinWidth.value})` : '720px',
}))
const pulseMinWidth = computed(() => {
  const count = Math.max(1, bucketStarts.value.length)
  if (!zoomed.value) return '0px'
  // Zoom in = fewer columns + wider min cell (span shrinks → intensity grows).
  const intensity = Math.min(12, Math.round((1 - zoom.value.span) / 0.08))
  const width = 6 + intensity * 4
  const gap = intensity >= 4 ? 3 : 2
  return `${count * width + Math.max(0, count - 1) * gap}px`
})
const pulseStyle = computed(() => {
  const count = Math.max(1, bucketStarts.value.length)
  const intensity = zoomed.value ? Math.min(12, Math.round((1 - zoom.value.span) / 0.08)) : 0
  const gapPx = !zoomed.value ? (count > 24 ? 1 : 2) : intensity >= 4 ? 3 : 2
  const heightPx = 16
  // Unzoomed: equal flex fractions. Zoomed: enforce growing min width so blocks lengthen.
  const minCell = !zoomed.value ? '0' : `${6 + intensity * 4}px`
  return {
    gridTemplateColumns: `repeat(${count}, minmax(${minCell}, 1fr))`,
    gap: `${gapPx}px`,
    height: `${heightPx}px`,
    minWidth: pulseMinWidth.value,
  }
})
const axisStart = computed(() =>
  bucketStarts.value.length ? formatAxisTime(bucketStarts.value[0]) : '时间脉冲'
)
const axisEnd = computed(() =>
  bucketStarts.value.length ? formatAxisTime(bucketStarts.value[bucketStarts.value.length - 1]) : ''
)
const bucketLabel = computed(() => {
  const minutes = props.coverage.bucket_seconds / 60
  if (minutes < 60) return t('channelMonitorV2.bucket.minutes', { count: minutes })
  const hours = minutes / 60
  if (hours < 24) return t('channelMonitorV2.bucket.hours', { count: hours })
  return t('channelMonitorV2.bucket.days', { count: hours / 24 })
})

/** Shared ISO start → column index for the visible window (rebuilt when zoom/coverage changes). */
const bucketStartIndex = computed(() => {
  const map = new Map<string, number>()
  bucketStarts.value.forEach((start, index) => map.set(start, index))
  return map
})

/** Pre-aligned sparse slots per row so wheel zoom does not rebuild Maps every paint. */
const alignedRows = computed(() => {
  const starts = bucketStarts.value
  const indexByStart = bucketStartIndex.value
  return props.rows.map((row) => {
    const slots: AlignedSlot[] = starts.map((start) => ({ start }))
    for (const bucket of row.buckets || []) {
      const key = new Date(bucket.bucket_start).toISOString()
      const index = indexByStart.get(key)
      if (index != null) slots[index] = { start: starts[index], bucket }
    }
    return { row, slots }
  })
})

function onMatrixWheel(event: WheelEvent) {
  const track = scrollRef.value
  const target = event.target as HTMLElement | null
  const pulse = target?.closest('.pulse-track') as HTMLElement | null
  const overMatrix = Boolean(target?.closest('.matrix-scroll'))
  // Plain vertical wheel over the matrix zooms X (narrower range → wider cells).
  // Shift+wheel or horizontal delta pans; leave non-matrix page scroll alone.
  const isPan = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
  if (!overMatrix && !pulse) return
  // When not zoomed and user scrolls vertically outside pulse, still zoom if over matrix body.
  if (!overMatrix && !isPan) return
  event.preventDefault()
  const ratioEl = pulse || track
  const ratio = clientXRatio(event.clientX, ratioEl)
  zoom.value = applyWheelZoom(zoom.value, event, ratio)
}

function resetMatrixZoom() {
  zoom.value = resetZoom()
}

watch(
  () => [
    props.coverage.requested_start,
    props.coverage.requested_end,
    props.coverage.coverage_start,
    props.coverage.data_through,
    props.coverage.bucket_seconds,
  ],
  () => {
    zoom.value = resetZoom()
  },
)

watch(
  [() => alignedRows.value.length, () => bucketStarts.value.length],
  ([rowCount, columnCount]) => {
    activeCell.row = Math.min(activeCell.row, Math.max(0, rowCount - 1))
    activeCell.column = Math.min(activeCell.column, Math.max(0, columnCount - 1))
  },
)

function focusCell(row: number, column: number, event: FocusEvent, slot: AlignedSlot) {
  activeCell.row = row
  activeCell.column = column
  showTooltip(event, slot)
}

function moveCell(row: number, column: number) {
  const rowCount = alignedRows.value.length
  const columnCount = bucketStarts.value.length
  if (!rowCount || !columnCount) return
  activeCell.row = Math.min(Math.max(row, 0), rowCount - 1)
  activeCell.column = Math.min(Math.max(column, 0), columnCount - 1)
  const selector = `.pulse-cell[data-row="${activeCell.row}"][data-column="${activeCell.column}"]`
  scrollRef.value?.querySelector<HTMLElement>(selector)?.focus()
}

function onCellKeydown(event: KeyboardEvent, row: number, column: number) {
  let nextRow = row
  let nextColumn = column
  if (event.key === 'ArrowLeft') nextColumn -= 1
  else if (event.key === 'ArrowRight') nextColumn += 1
  else if (event.key === 'ArrowUp') nextRow -= 1
  else if (event.key === 'ArrowDown') nextRow += 1
  else if (event.key === 'Home') nextColumn = 0
  else if (event.key === 'End') nextColumn = bucketStarts.value.length - 1
  else return
  event.preventDefault()
  moveCell(nextRow, nextColumn)
}

function cellClass(health: MonitorHealth, requestCount: number): string {
  return healthScoreClass(health, props.healthMode, requestCount)
}

function rowLabel(row: MonitorMatrixRow): string {
  const parts = [row.platform]
  if (row.group_name || row.group_id) parts.push(row.group_name || `#${row.group_id}`)
  if (row.model) parts.push(row.model === '__other__' ? t('channelMonitorV2.otherModels') : row.model)
  return parts.join(' / ')
}

function rowKey(row: MonitorMatrixRow): string {
  return [row.platform, row.group_id || 0, row.model || ''].join(':')
}

function successRate(metrics: MonitorMetric): string {
  // Empty traffic: no request count and no throughput signal.
  // When throughput is hidden for privacy, still show success from error_rate.
  const noCount = metrics.request_count <= 0
  const noTP = (metrics.rpm || 0) <= 0 && (metrics.tpm || 0) <= 0
  if (noCount && noTP && props.showThroughput) return '-'
  return formatMonitorSuccessRateFromError(metrics.error_rate)
}

function formatScore(health: MonitorHealth): string {
  const score = healthModeScore(health, props.healthMode)
  if (score == null) return '—'
  return `${Math.round(score)}`
}

function bucketTooltip(bucket: MonitorMatrixBucket): string {
  return bucketTooltipLines(bucket).join('\n')
}

function bucketTooltipLines(bucket: MonitorMatrixBucket): string[] {
  const metrics = bucket.metrics
  const lines = [
    formatBucketRange(bucket.bucket_start),
    t('channelMonitorV2.matrix.scoreLine', { score: formatScore(bucket.health) }),
    t('channelMonitorV2.metrics.successRateValue', { value: successRate(metrics) }),
    t('channelMonitorV2.metrics.ttftValue', { value: latencyPrivacy(metrics.ttft) }),
  ]
  if (props.showThroughput) {
    lines.push(t('channelMonitorV2.metrics.tpsValue', { value: formatTps(metrics.tpm) }))
  }
  lines.push(
    t('channelMonitorV2.metrics.cacheRateValue', { value: formatPercent(metrics.cache_rate) }),
    t('channelMonitorV2.metrics.errorRateValue', { value: formatPercent(metrics.error_rate) }),
  )
  if (props.showThroughput) {
    lines.push(t('channelMonitorV2.metrics.rpmValue', { value: formatRate(metrics.rpm) }))
  }
  lines.push(t('channelMonitorV2.metrics.durationValue', { value: latencyPrivacy(metrics.duration) }))
  return lines
}
function emptyTooltipLines(start: string): string[] {
  return [formatBucketRange(start), t('channelMonitorV2.matrix.noTraffic')]
}

function showTooltip(event: MouseEvent | FocusEvent, slot: AlignedSlot) {
  floatingTooltip.lines = slot.bucket ? bucketTooltipLines(slot.bucket) : emptyTooltipLines(slot.start)
  floatingTooltip.visible = true
  positionTooltip(event)
}

function moveTooltip(event: MouseEvent) {
  if (!floatingTooltip.visible) return
  positionTooltip(event)
}

function hideTooltip() {
  floatingTooltip.visible = false
}

function positionTooltip(event: MouseEvent | FocusEvent) {
  if ('clientX' in event) {
    floatingTooltip.x = Math.min(window.innerWidth - 12, Math.max(12, event.clientX))
    floatingTooltip.y = Math.min(window.innerHeight - 12, Math.max(12, event.clientY)) - 12
    return
  }
  const target = event.target as HTMLElement | null
  const rect = target?.getBoundingClientRect()
  if (!rect) return
  floatingTooltip.x = rect.left + rect.width / 2
  floatingTooltip.y = rect.top - 10
}

function latencyPrivacy(metric: LatencyMetric) {
  return formatLatencyPrivacy(metric.p50_ms, metric.p90_ms, metric.avg_ms, metric.p95_ms)
}

function formatPercent(value: number) {
  return formatMonitorPercent(value)
}

function formatRate(value: number) {
  return formatMonitorThroughput(value)
}

function formatTps(tpm: number | null | undefined) {
  return formatMonitorTokensPerSecond(tpm)
}

function exactTps(tpm: number | null | undefined) {
  const tps = tokensPerSecondFromTpm(tpm)
  return Intl.NumberFormat(locale.value || undefined, { maximumFractionDigits: 3 }).format(tps)
}

function formatMs(value: number | null) {
  return formatMonitorMs(value)
}

function formatAxisTime(value: string) {
  return new Intl.DateTimeFormat(locale.value || undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatBucketRange(value: string) {
  const start = new Date(value)
  const end = new Date(start.getTime() + props.coverage.bucket_seconds * 1000)
  return `${formatAxisTime(start.toISOString())} - ${new Intl.DateTimeFormat(locale.value || undefined, { hour: '2-digit', minute: '2-digit' }).format(end)}`
}
</script>

<style scoped>
.matrix-scroll {
  max-width: 100%;
  max-height: min(42vh, 420px);
  padding: 2px;
  overflow: auto;
  overscroll-behavior: contain;
}

.matrix-table,
.pulse-track {
  min-width: 0;
}

.matrix-row {
  display: grid;
  min-height: 36px;
  grid-template-columns:
    minmax(120px, 1.2fr)
    minmax(52px, .34fr)
    minmax(58px, .36fr)
    minmax(52px, .34fr)
    minmax(120px, 2.8fr);
  align-items: center;
  gap: 6px 10px;
}

.matrix-row--with-tps {
  grid-template-columns:
    minmax(110px, 1.15fr)
    minmax(48px, .3fr)
    minmax(54px, .32fr)
    minmax(58px, .36fr)
    minmax(48px, .3fr)
    minmax(120px, 2.6fr);
}

.matrix-header {
  position: sticky;
  z-index: 3;
  top: 0;
  padding: 0 8px;
  color: var(--ui-text-soft);
  background: var(--ui-surface-muted);
  font-size: 10px;
  font-weight: 600;
}

.matrix-data-row {
  padding: 0 8px;
  border-bottom: 1px solid var(--ui-border-soft);
  background: var(--ui-surface);
}

.dimension-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.dimension-cell strong {
  overflow: hidden;
  color: var(--ui-text);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-value {
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.pulse-axis {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.pulse-axis i {
  font-style: normal;
}

.pulse-track {
  display: grid;
  align-items: stretch;
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
}

.health-score10,
.health-score9,
.health-score8,
.health-healthy { background: var(--ui-success); }

.health-score7,
.health-score6,
.health-score5,
.health-score4,
.health-warning { background: var(--ui-warning); }

.health-score3,
.health-score2,
.health-score1,
.health-score0,
.health-critical { background: var(--ui-danger); }

.health-unknown { background: var(--ui-text-soft); }

.pulse-cell {
  position: relative;
  min-width: 0;
  border-radius: 2px;
}

.pulse-cell.has-data {
  cursor: help;
}

.pulse-cell.is-empty {
  cursor: default;
  opacity: .38;
}

.pulse-cell.has-data:hover,
.pulse-cell.has-data:focus-visible {
  z-index: 5;
  outline: 2px solid color-mix(in srgb, var(--ui-focus) 44%, transparent);
  outline-offset: 1px;
}

.pulse-tooltip {
  display: none;
}

.matrix-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--ui-text-muted);
  font-size: 10px;
}

.matrix-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.matrix-floating-tooltip {
  position: fixed;
  z-index: 9999;
  min-width: 184px;
  max-width: min(288px, calc(100vw - 24px));
  padding: 8px 10px;
  transform: translate(-50%, -100%);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  box-shadow: 0 12px 30px rgb(31 35 41 / .14);
  pointer-events: none;
  white-space: nowrap;
}

.matrix-floating-tooltip-line {
  display: block;
  font-size: 11px;
  line-height: 16px;
}

.matrix-floating-tooltip-title {
  margin-bottom: 3px;
  color: var(--ui-text);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .pulse-cell {
    transition: none;
  }
}
</style>
