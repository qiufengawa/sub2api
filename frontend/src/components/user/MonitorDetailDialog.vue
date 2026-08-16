<template>
  <UiDialog
    :show="show"
    :title="title"
    width="extra-wide"
    @close="emit('close')"
  >
    <UiSkeleton v-if="loading" width="100%" height="240px" />
    <UiEmptyState
      v-else-if="!detail"
      :title="t('channelStatus.detailLoadError')"
    />
    <UiMobileTableScroller v-else min-width="920px" :label="title">
      <UiDataTable :columns="columns" :data="detail.models" mobile-table :aria-label="title">
        <template #cell-model="{ value }"><UiDataCell :value="String(value)" mono /></template>
        <template #cell-latest_status="{ value }">
          <UiStatusBadge :status="statusTone(String(value))" :label="statusLabel(value)" />
        </template>
        <template #cell-latest_latency_ms="{ value }"><UiDataCell :value="formatLatency(value)" mono /></template>
        <template #cell-availability_7d="{ value }"><UiDataCell :value="formatPercent(value)" mono /></template>
        <template #cell-availability_15d="{ value }"><UiDataCell :value="formatPercent(value)" mono /></template>
        <template #cell-availability_30d="{ value }"><UiDataCell :value="formatPercent(value)" mono /></template>
        <template #cell-avg_latency_7d_ms="{ value }"><UiDataCell :value="formatLatency(value)" mono /></template>
      </UiDataTable>
    </UiMobileTableScroller>

    <template #footer>
      <AppInline justify="flex-end">
        <UiButton density="compact" @click="emit('close')">
          {{ t('channelStatus.closeDetail') }}
        </UiButton>
      </AppInline>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import {
  status as fetchChannelMonitorDetail,
  type UserMonitorDetail,
} from '@/api/channelMonitor'
import type { Column } from '@/components/ui'
import {
  AppInline,
  UiButton,
  UiDataCell,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiMobileTableScroller,
  UiSkeleton,
  UiStatusBadge,
} from '@/components/ui'
import { useChannelMonitorFormat } from '@/composables/useChannelMonitorFormat'

const props = defineProps<{
  show: boolean
  monitorId: number | null
  title: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()
const { statusLabel, formatLatency, formatPercent } = useChannelMonitorFormat()

const detail = ref<UserMonitorDetail | null>(null)
const loading = ref(false)
let requestSequence = 0

const columns = computed<Column[]>(() => [
  { key: 'model', label: t('channelStatus.detailColumns.model') },
  { key: 'latest_status', label: t('channelStatus.detailColumns.latestStatus') },
  { key: 'latest_latency_ms', label: t('channelStatus.detailColumns.latestLatency') },
  { key: 'availability_7d', label: t('channelStatus.detailColumns.availability7d') },
  { key: 'availability_15d', label: t('channelStatus.detailColumns.availability15d') },
  { key: 'availability_30d', label: t('channelStatus.detailColumns.availability30d') },
  { key: 'avg_latency_7d_ms', label: t('channelStatus.detailColumns.avgLatency7d') },
])

function statusTone(status: string): string {
  if (status === 'operational') return 'online'
  if (status === 'degraded') return 'warning'
  if (status === 'failed') return 'failed'
  return 'error'
}

async function load(id: number) {
  const sequence = ++requestSequence
  detail.value = null
  loading.value = true
  try {
    const result = await fetchChannelMonitorDetail(id)
    if (sequence !== requestSequence) return
    detail.value = result
  } catch (err: unknown) {
    if (sequence !== requestSequence) return
    appStore.showError(extractApiErrorMessage(err, t('channelStatus.detailLoadError')))
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

watch(
  () => [props.show, props.monitorId] as const,
  ([show, id]) => {
    if (!show) {
      requestSequence += 1
      detail.value = null
      loading.value = false
      return
    }
    if (id != null) void load(id)
  },
  { immediate: true },
)
</script>
