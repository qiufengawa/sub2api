<template>
  <UiDialog :show="show" :title="dialogTitle" width="extra-wide" @close="emit('close')">
    <UiServerTableWorkspace :loading="refreshing">
      <template #filters>
        <UiFilterBar>
          <UiSelect
            v-model="selectedModel"
            :options="modelOptions"
            density="compact"
            :aria-label="t('admin.channelMonitor.history.modelFilter')"
            @change="applyFilters"
          />
          <UiSelect
            v-model="limit"
            :options="limitOptions"
            density="compact"
            :aria-label="t('admin.channelMonitor.history.limit')"
            @change="applyFilters"
          />
          <template #actions>
            <UiIconButton
              icon="refresh"
              density="compact"
              :disabled="loading"
              :label="t('common.refresh')"
              @click="loadHistory"
            />
          </template>
        </UiFilterBar>
      </template>

      <UiAlert
        v-if="loadError && items.length"
        tone="danger"
        :message="t('admin.channelMonitor.history.loadError')"
      />

      <UiDataTable
        :columns="columns"
        :data="items"
        :loading="initialLoading"
        row-key="id"
        mobile-table
        :aria-label="dialogTitle"
      >
        <template #cell-checked_at="{ value }"><time class="ui-numeric">{{ formatCheckedAt(String(value)) }}</time></template>
        <template #cell-model="{ value }"><UiDataCell :value="String(value)" mono /></template>
        <template #cell-status="{ value }"><UiStatusBadge :status="String(value)" :label="historyStatusLabel(value)" /></template>
        <template #cell-latency_ms="{ value }"><UiDataCell :value="latencyLabel(value)" mono /></template>
        <template #cell-ping_latency_ms="{ value }"><UiDataCell :value="latencyLabel(value)" mono /></template>
        <template #cell-message="{ value }"><UiDataCell :value="String(value || '-')" /></template>
        <template #empty>
          <UiErrorState
            v-if="loadError"
            :title="t('admin.channelMonitor.history.loadError')"
            :retry-text="t('common.retry')"
            @retry="loadHistory"
          />
          <UiEmptyState v-else :title="t('admin.channelMonitor.history.empty')" />
        </template>
      </UiDataTable>
    </UiServerTableWorkspace>

    <template #footer>
      <AppInline justify="flex-end">
        <UiButton density="compact" @click="emit('close')">{{ t('common.close') }}</UiButton>
      </AppInline>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { ChannelMonitor, HistoryItem, MonitorStatus } from '@/api/admin/channelMonitor'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { useChannelMonitorFormat } from '@/composables/useChannelMonitorFormat'
import type { Column } from '@/components/ui'
import {
  AppInline,
  UiAlert,
  UiButton,
  UiDataCell,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiSelect,
  UiServerTableWorkspace,
  UiStatusBadge,
} from '@/components/ui'

const props = defineProps<{ show: boolean; monitor: ChannelMonitor | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const appStore = useAppStore()
const { formatLatency, statusLabel } = useChannelMonitorFormat()

const items = ref<HistoryItem[]>([])
const selectedModel = ref('')
const limit = ref(50)
const loading = ref(false)
const hasLoaded = ref(false)
const loadError = ref(false)
const initialLoading = computed(() => !hasLoaded.value || (loading.value && items.value.length === 0))
const refreshing = computed(() => loading.value && hasLoaded.value)
let requestId = 0
let requestController: AbortController | null = null

const dialogTitle = computed(() => t('admin.channelMonitor.history.title', {
  name: props.monitor?.name || '',
}))
const modelOptions = computed(() => {
  const models = props.monitor
    ? [props.monitor.primary_model, ...(props.monitor.extra_models || [])]
    : []
  return [
    { value: '', label: t('admin.channelMonitor.history.allModels') },
    ...Array.from(new Set(models.filter(Boolean))).map(model => ({ value: model, label: model })),
  ]
})
const limitOptions = computed(() => [25, 50, 100].map(value => ({
  value,
  label: t('admin.channelMonitor.history.limitOption', { count: value }),
})))
const columns = computed<Column[]>(() => [
  { key: 'checked_at', label: t('admin.channelMonitor.history.columns.checkedAt') },
  { key: 'model', label: t('admin.channelMonitor.history.columns.model') },
  { key: 'status', label: t('admin.channelMonitor.history.columns.status') },
  { key: 'latency_ms', label: t('admin.channelMonitor.history.columns.latency') },
  { key: 'ping_latency_ms', label: t('admin.channelMonitor.history.columns.pingLatency') },
  { key: 'message', label: t('admin.channelMonitor.history.columns.message') },
])

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const requestError = error as { name?: string; code?: string }
  return requestError.name === 'AbortError' || requestError.code === 'ERR_CANCELED'
}

async function loadHistory() {
  const monitorId = props.monitor?.id
  if (!props.show || monitorId == null) return
  requestController?.abort()
  const controller = new AbortController()
  const generation = ++requestId
  requestController = controller
  loading.value = true
  loadError.value = false
  try {
    const response = await adminAPI.channelMonitor.listHistory(
      monitorId,
      { model: selectedModel.value || undefined, limit: limit.value },
      { signal: controller.signal },
    )
    if (controller.signal.aborted || generation !== requestId || !props.show) return
    items.value = response.items || []
  } catch (error: unknown) {
    if (controller.signal.aborted || generation !== requestId || isAbortError(error)) return
    loadError.value = true
    appStore.showError(extractApiErrorMessage(error, t('admin.channelMonitor.history.loadError')))
  } finally {
    if (requestController === controller) {
      loading.value = false
      hasLoaded.value = true
      requestController = null
    }
  }
}

function applyFilters() {
  void loadHistory()
}

function cancelRequest() {
  requestId++
  requestController?.abort()
  requestController = null
  loading.value = false
}

function latencyLabel(value: unknown): string {
  const latency = typeof value === 'number' ? value : null
  return latency == null ? formatLatency(latency) : `${formatLatency(latency)} ms`
}

function historyStatusLabel(value: unknown): string {
  return statusLabel(String(value || '') as MonitorStatus | '')
}

function formatCheckedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

watch(
  () => [props.show, props.monitor?.id] as const,
  ([show, monitorId], previous) => {
    if (!show || monitorId == null) {
      cancelRequest()
      return
    }
    if (monitorId !== previous?.[1]) {
      selectedModel.value = ''
      limit.value = 50
      items.value = []
      hasLoaded.value = false
      loadError.value = false
    }
    void loadHistory()
  },
  { immediate: true },
)

onBeforeUnmount(cancelRequest)
</script>
