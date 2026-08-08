<template>
  <div class="w-[184px] min-w-[184px]">
    <div v-if="loading && !status" class="space-y-1.5" aria-busy="true">
      <div class="h-3 w-20 animate-pulse rounded-[3px] bg-gray-200 dark:bg-dark-700"></div>
      <div class="flex h-5 w-[179px] items-stretch gap-px">
        <span
          v-for="index in BUCKET_COUNT"
          :key="index"
          class="h-5 w-[2px] flex-none animate-pulse rounded-[1px] bg-gray-200 dark:bg-dark-700"
        ></span>
      </div>
    </div>

    <div v-else-if="error" class="flex h-8 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span class="h-2 w-2 flex-none rounded-full bg-gray-300 dark:bg-dark-600"></span>
      <span>{{ t('admin.accounts.serviceStatus.unavailable') }}</span>
    </div>

    <HelpTooltip v-else class="!ml-0" width-class="w-72" trigger="hover">
      <template #trigger>
        <div class="w-[184px] cursor-help" data-test="account-service-status">
          <div class="mb-1 flex min-w-0 items-center justify-between gap-2 text-[11px] leading-4">
            <span class="flex min-w-0 items-center gap-1.5 font-medium" :class="summaryTextClass">
              <span class="h-2 w-2 flex-none rounded-full" :class="summaryDotClass"></span>
              <span class="truncate">{{ summaryLabel }}</span>
            </span>
            <span class="flex-none tabular-nums text-gray-400 dark:text-gray-500">
              {{ requestSummary }}
            </span>
          </div>

          <div class="space-y-0.5">
            <div
              class="flex h-5 w-[179px] items-stretch gap-px"
              :aria-label="t('admin.accounts.serviceStatus.historyLabel')"
              @mousemove="handleTimelinePointerMove"
              @mouseleave="activeBucket = null"
            >
              <span
                v-for="(bucket, index) in displayBuckets"
                :key="`${bucket.start_time}-${index}`"
                class="h-5 w-[2px] flex-none rounded-[1px] transition-opacity"
                :class="[
                  bucketColorClass(bucket.status),
                  activeBucket === bucket ? 'opacity-70' : ''
                ]"
                :title="bucketTitle(bucket)"
                :data-status="bucket.status"
                :data-current="index === displayBuckets.length - 1 ? 'true' : undefined"
                @mouseenter="activeBucket = bucket"
              ></span>
            </div>
            <div class="flex w-[179px] justify-between text-[9px] leading-3 text-gray-400 dark:text-gray-500">
              <span>{{ t('admin.accounts.serviceStatus.hourAgo') }}</span>
              <span>{{ t('admin.accounts.serviceStatus.now') }}</span>
            </div>
          </div>
        </div>
      </template>

      <div class="space-y-2 text-left">
        <div>
          <div class="font-semibold text-white">{{ tooltipTitle }}</div>
          <div class="mt-0.5 text-[11px] text-gray-300">
            {{ t('admin.accounts.serviceStatus.passiveHint') }}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/10 pt-2 tabular-nums">
          <span class="text-gray-300">{{ tooltipStatusTitle }}</span>
          <span class="text-right font-medium text-white">{{ tooltipStatusLabel }}</span>
          <span class="text-gray-300">{{ t('admin.accounts.serviceStatus.successRate') }}</span>
          <span class="text-right font-medium text-white">{{ tooltipSuccessRate }}</span>
          <span class="text-gray-300">{{ t('admin.accounts.serviceStatus.requests') }}</span>
          <span class="text-right font-medium text-white">{{ tooltipMetrics?.request_count ?? 0 }}</span>
          <span class="text-gray-300">{{ t('admin.accounts.serviceStatus.successFailure') }}</span>
          <span class="text-right font-medium text-white">
            {{ tooltipMetrics?.success_count ?? 0 }} / {{ tooltipMetrics?.failure_count ?? 0 }}
          </span>
          <span class="text-gray-300">{{ t('admin.accounts.serviceStatus.averageFirstToken') }}</span>
          <span class="text-right font-medium text-white">{{ formatLatency(tooltipMetrics?.average_first_token_ms) }}</span>
          <span class="text-gray-300">{{ t('admin.accounts.serviceStatus.averageSpeed') }}</span>
          <span class="text-right font-medium text-white">{{ formatSpeed(tooltipMetrics?.average_tokens_per_second) }}</span>
          <span class="text-gray-300">{{ t('admin.accounts.serviceStatus.lastCall') }}</span>
          <span class="text-right font-medium text-white">{{ formatTimestamp(tooltipMetrics?.last_call_at) }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[10px] text-gray-300">
          <span v-for="item in legendItems" :key="item.status" class="inline-flex items-center gap-1">
            <span class="h-1.5 w-1.5 rounded-full" :class="bucketColorClass(item.status)"></span>
            {{ item.label }}
          </span>
        </div>
      </div>
    </HelpTooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import HelpTooltip from '@/components/common/HelpTooltip.vue'
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

const summaryDotClass = computed(() => bucketColorClass(props.status?.status ?? 'unknown'))
const summaryTextClass = computed(() => {
  switch (props.status?.status) {
    case 'operational':
      return 'text-emerald-700 dark:text-emerald-400'
    case 'degraded':
      return 'text-amber-700 dark:text-amber-400'
    case 'failed':
      return 'text-red-700 dark:text-red-400'
    default:
      return 'text-gray-500 dark:text-gray-400'
  }
})

const legendItems = computed(() => ([
  { status: 'operational' as const, label: t('admin.accounts.serviceStatus.operational') },
  { status: 'degraded' as const, label: t('admin.accounts.serviceStatus.degraded') },
  { status: 'failed' as const, label: t('admin.accounts.serviceStatus.failed') },
  { status: 'unknown' as const, label: t('admin.accounts.serviceStatus.noSamples') }
]))

function bucketColorClass(status: AccountServiceStatusLevel): string {
  switch (status) {
    case 'operational':
      return 'bg-emerald-500'
    case 'degraded':
      return 'bg-amber-500'
    case 'failed':
      return 'bg-red-500'
    default:
      return 'bg-gray-300 dark:bg-dark-600'
  }
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
