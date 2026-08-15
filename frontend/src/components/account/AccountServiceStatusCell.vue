<template>
  <div class="service-status-cell">
    <div v-if="loading && !status" class="service-status-cell__loading" aria-busy="true">
      <UiSkeleton variant="text" width="80px" />
      <UiSkeleton variant="rect" width="179px" height="20px" />
    </div>

    <UiStatusBadge v-else-if="error" status="neutral" :label="t('admin.accounts.serviceStatus.unavailable')" />

    <UiTooltip v-else width-class="w-72" trigger="hover">
      <div class="service-status-cell__trigger" data-test="account-service-status">
          <AppInline justify="space-between" :wrap="false">
            <UiStatusBadge :status="summaryStatus" :label="summaryLabel" />
            <UiBadge :label="requestSummary" />
          </AppInline>

          <div class="service-status-cell__history">
            <div
              class="service-status-cell__timeline"
              :aria-label="t('admin.accounts.serviceStatus.historyLabel')"
              @mousemove="handleTimelinePointerMove"
              @mouseleave="activeBucket = null"
            >
              <span
                v-for="(bucket, index) in displayBuckets"
                :key="`${bucket.start_time}-${index}`"
                class="service-status-cell__bucket"
                :class="[
                  `is-${bucket.status}`,
                  { 'is-active': activeBucket === bucket }
                ]"
                :title="bucketTitle(bucket)"
                :data-status="bucket.status"
                :data-current="index === displayBuckets.length - 1 ? 'true' : undefined"
                @mouseenter="activeBucket = bucket"
              ></span>
            </div>
            <AppInline class="service-status-cell__axis" justify="space-between" :wrap="false">
              <span>{{ t('admin.accounts.serviceStatus.hourAgo') }}</span>
              <span>{{ t('admin.accounts.serviceStatus.now') }}</span>
            </AppInline>
          </div>
      </div>

      <template #content>
        <AppStack class="service-status-cell__tooltip" :gap="8">
          <div><strong>{{ tooltipTitle }}</strong><small>{{ t('admin.accounts.serviceStatus.passiveHint') }}</small></div>
          <dl class="service-status-cell__metrics">
            <template v-for="item in tooltipFacts" :key="item.label">
              <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
            </template>
          </dl>
          <AppInline :gap="6">
            <UiBadge v-for="item in legendItems" :key="item.status" :tone="legendTone(item.status)" :label="item.label" />
          </AppInline>
        </AppStack>
      </template>
    </UiTooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppInline, AppStack, UiBadge, UiSkeleton, UiStatusBadge, UiTooltip } from '@/components/ui'
import type {
  AccountServiceStatus,
  AccountServiceStatusBucket,
  AccountServiceStatusLevel
} from '@/api/admin/accounts'

const props = withDefaults(defineProps<{
  status?: AccountServiceStatus | null
  loading?: boolean
  error?: string | null
}>(), {
  status: null,
  loading: false,
  error: null
})

const { t, locale } = useI18n()
const BUCKET_COUNT = 60
const activeBucket = ref<AccountServiceStatusBucket | null>(null)

const statusLabels = computed<Record<AccountServiceStatusLevel, string>>(() => ({
  operational: t('admin.accounts.serviceStatus.operational'),
  degraded: t('admin.accounts.serviceStatus.degraded'),
  failed: t('admin.accounts.serviceStatus.failed'),
  unknown: t('admin.accounts.serviceStatus.noSamples')
}))

const displayBuckets = computed<AccountServiceStatusBucket[]>(() => {
  const buckets = Array.isArray(props.status?.buckets) ? props.status.buckets.slice(-BUCKET_COUNT) : []
  if (buckets.length >= BUCKET_COUNT) return buckets
  const placeholders = Array.from({ length: BUCKET_COUNT - buckets.length }, (_, index) => ({
    start_time: `empty-${index}`,
    end_time: '',
    status: 'unknown' as const,
    success_rate: null,
    success_count: 0,
    failure_count: 0,
    request_count: 0,
    average_first_token_ms: null,
    average_tokens_per_second: null,
    last_call_at: null
  }))
  return [...placeholders, ...buckets]
})

const summaryLabel = computed(() => {
  if (!props.status || props.status.request_count === 0) {
    return statusLabels.value.unknown
  }
  const label = statusLabels.value[props.status.status] ?? statusLabels.value.unknown
  return `${label} ${formatPercent(props.status.success_rate)}`
})

const requestSummary = computed(() =>
  t('admin.accounts.serviceStatus.requestCountShort', { count: props.status?.request_count ?? 0 })
)

const tooltipMetrics = computed<AccountServiceStatus | AccountServiceStatusBucket | null>(() =>
  activeBucket.value ?? props.status ?? null
)

const tooltipTitle = computed(() =>
  activeBucket.value
    ? formatBucketRange(activeBucket.value)
    : t('admin.accounts.serviceStatus.title')
)

const tooltipStatusLabel = computed(() => {
  const status = tooltipMetrics.value?.status ?? 'unknown'
  return statusLabels.value[status] ?? statusLabels.value.unknown
})

const tooltipStatusTitle = computed(() =>
  activeBucket.value
    ? t('admin.accounts.serviceStatus.intervalStatus')
    : t('admin.accounts.serviceStatus.overallStatus')
)

const tooltipSuccessRate = computed(() => formatPercent(tooltipMetrics.value?.success_rate))

const summaryStatus = computed(() => ({
  operational: 'active',
  degraded: 'warning',
  failed: 'error',
  unknown: 'neutral',
})[props.status?.status ?? 'unknown'])

const legendItems = computed(() => ([
  { status: 'operational' as const, label: t('admin.accounts.serviceStatus.operational') },
  { status: 'degraded' as const, label: t('admin.accounts.serviceStatus.degraded') },
  { status: 'failed' as const, label: t('admin.accounts.serviceStatus.failed') },
  { status: 'unknown' as const, label: t('admin.accounts.serviceStatus.noSamples') }
]))

const tooltipFacts = computed(() => [
  { label: tooltipStatusTitle.value, value: tooltipStatusLabel.value },
  { label: t('admin.accounts.serviceStatus.successRate'), value: tooltipSuccessRate.value },
  { label: t('admin.accounts.serviceStatus.requests'), value: tooltipMetrics.value?.request_count ?? 0 },
  { label: t('admin.accounts.serviceStatus.successFailure'), value: `${tooltipMetrics.value?.success_count ?? 0} / ${tooltipMetrics.value?.failure_count ?? 0}` },
  { label: t('admin.accounts.serviceStatus.averageFirstToken'), value: formatLatency(tooltipMetrics.value?.average_first_token_ms) },
  { label: t('admin.accounts.serviceStatus.averageSpeed'), value: formatSpeed(tooltipMetrics.value?.average_tokens_per_second) },
  { label: t('admin.accounts.serviceStatus.lastCall'), value: formatTimestamp(tooltipMetrics.value?.last_call_at) },
])

function legendTone(status: AccountServiceStatusLevel): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'operational') return 'success'
  if (status === 'degraded') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(value >= 0.995 ? 0 : 1)}%`
}

function formatLatency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`
  return `${Math.round(value)}ms`
}

function formatSpeed(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${value.toFixed(1)} tok/s`
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return t('admin.accounts.serviceStatus.never')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat(locale.value.startsWith('zh') ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

function bucketTitle(bucket: AccountServiceStatusBucket): string {
  if (!bucket.end_time || bucket.start_time.startsWith('empty-')) return ''
  const range = formatBucketRange(bucket)
  if (bucket.request_count === 0) {
    return `${range} · ${t('admin.accounts.serviceStatus.noSamples')}`
  }
  return [
    range,
    statusLabels.value[bucket.status] ?? statusLabels.value.unknown,
    `${t('admin.accounts.serviceStatus.successRate')} ${formatPercent(bucket.success_rate)}`,
    `${t('admin.accounts.serviceStatus.successFailure')} ${bucket.success_count}/${bucket.failure_count}`,
    `${t('admin.accounts.serviceStatus.averageFirstToken')} ${formatLatency(bucket.average_first_token_ms)}`,
    `${t('admin.accounts.serviceStatus.averageSpeed')} ${formatSpeed(bucket.average_tokens_per_second)}`
  ].join(' · ')
}

function formatBucketRange(bucket: AccountServiceStatusBucket): string {
  if (!bucket.end_time || bucket.start_time.startsWith('empty-')) {
    return t('admin.accounts.serviceStatus.noSamples')
  }
  return `${formatTimestamp(bucket.start_time)} - ${formatTimestamp(bucket.end_time)}`
}

function handleTimelinePointerMove(event: MouseEvent): void {
  const timeline = event.currentTarget as HTMLElement | null
  if (!timeline || displayBuckets.value.length === 0) return
  const rect = timeline.getBoundingClientRect()
  if (rect.width <= 0) return
  const relativeX = Math.min(rect.width - Number.EPSILON, Math.max(0, event.clientX - rect.left))
  const index = Math.floor((relativeX / rect.width) * displayBuckets.value.length)
  activeBucket.value = displayBuckets.value[index] ?? null
}
</script>

<style scoped>
.service-status-cell{width:184px;min-width:184px}.service-status-cell__loading{display:grid;gap:6px}.service-status-cell__trigger{width:184px;cursor:help}.service-status-cell__history{display:grid;gap:2px;margin-top:4px}.service-status-cell__timeline{display:flex;width:179px;height:20px;align-items:stretch;gap:1px}.service-status-cell__bucket{width:2px;height:20px;flex:none;border-radius:1px;background:var(--ui-surface-strong);transition:opacity var(--ui-motion-fast)}.service-status-cell__bucket.is-operational{background:var(--ui-success)}.service-status-cell__bucket.is-degraded{background:var(--ui-warning)}.service-status-cell__bucket.is-failed{background:var(--ui-danger)}.service-status-cell__bucket.is-active{opacity:.65}.service-status-cell__axis{width:179px;color:var(--ui-text-soft);font-size:9px;line-height:12px}.service-status-cell__tooltip{text-align:left}.service-status-cell__tooltip strong,.service-status-cell__tooltip small{display:block}.service-status-cell__tooltip small{margin-top:2px;color:#d4d4d4;font-size:11px}.service-status-cell__metrics{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;margin:0;padding-top:8px;border-top:1px solid rgb(255 255 255/.12);font-variant-numeric:tabular-nums}.service-status-cell__metrics dt,.service-status-cell__metrics dd{margin:0}.service-status-cell__metrics dt{color:#d4d4d4}.service-status-cell__metrics dd{color:#fff;font-weight:500;text-align:right}
</style>
