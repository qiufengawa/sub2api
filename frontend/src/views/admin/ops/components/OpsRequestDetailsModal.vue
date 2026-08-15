<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import {
  AppInline,
  UiBadge,
  UiButton,
  UiDataCell,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiLoadingOverlay,
  UiPagination,
  type Column,
} from '@/components/ui'
import { useClipboard } from '@/composables/useClipboard'
import { setPersistedPageSize } from '@/composables/usePersistedPageSize'
import { useAppStore } from '@/stores'
import { opsAPI, type OpsRequestDetailsParams, type OpsRequestDetail } from '@/api/admin/ops'
import { getConfiguredTablePageSizeOptions, normalizeTablePageSize } from '@/utils/tablePreferences'
import { parseTimeRangeMinutes, formatDateTime } from '../utils/opsFormatters'

export interface OpsRequestDetailsPreset {
  title: string
  kind?: OpsRequestDetailsParams['kind']
  sort?: OpsRequestDetailsParams['sort']
  min_duration_ms?: number
  max_duration_ms?: number
}

interface Props {
  modelValue: boolean
  timeRange: string
  preset: OpsRequestDetailsPreset
  platform?: string
  groupId?: number | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'openErrorDetail', errorId: number): void
}>()

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

const loading = ref(false)
const items = ref<OpsRequestDetail[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const pageSizeOptions = computed(() => Array.from(new Set([
  ...getConfiguredTablePageSizeOptions(),
  normalizeTablePageSize(pageSize.value),
])).sort((a, b) => a - b))

const columns = computed<Column[]>(() => [
  { key: 'created_at', label: t('admin.ops.requestDetails.table.time') },
  { key: 'kind', label: t('admin.ops.requestDetails.table.kind') },
  { key: 'platform', label: t('admin.ops.requestDetails.table.platform') },
  { key: 'model', label: t('admin.ops.requestDetails.table.model') },
  { key: 'duration_ms', label: t('admin.ops.requestDetails.table.duration') },
  { key: 'status_code', label: t('admin.ops.requestDetails.table.status') },
  { key: 'request_id', label: t('admin.ops.requestDetails.table.requestId') },
  { key: 'actions', label: t('admin.ops.requestDetails.table.actions') },
])

const close = () => emit('update:modelValue', false)

const rangeLabel = computed(() => {
  const minutes = parseTimeRangeMinutes(props.timeRange)
  if (minutes >= 60) return t('admin.ops.requestDetails.rangeHours', { n: Math.round(minutes / 60) })
  return t('admin.ops.requestDetails.rangeMinutes', { n: minutes })
})

function buildTimeParams(): Pick<OpsRequestDetailsParams, 'start_time' | 'end_time'> {
  const minutes = parseTimeRangeMinutes(props.timeRange)
  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - minutes * 60 * 1000)
  return {
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString()
  }
}

const fetchData = async () => {
  if (!props.modelValue) return
  loading.value = true
  try {
    const params: OpsRequestDetailsParams = {
      ...buildTimeParams(),
      page: page.value,
      page_size: pageSize.value,
      kind: props.preset.kind ?? 'all',
      sort: props.preset.sort ?? 'created_at_desc'
    }

    const platform = (props.platform || '').trim()
    if (platform) params.platform = platform
    if (typeof props.groupId === 'number' && props.groupId > 0) params.group_id = props.groupId

    if (typeof props.preset.min_duration_ms === 'number') params.min_duration_ms = props.preset.min_duration_ms
    if (typeof props.preset.max_duration_ms === 'number') params.max_duration_ms = props.preset.max_duration_ms

    const res = await opsAPI.listRequestDetails(params)
    items.value = res.items || []
    total.value = res.total || 0
  } catch (e: any) {
    console.error('[OpsRequestDetailsModal] Failed to fetch request details', e)
    appStore.showError(e?.message || t('admin.ops.requestDetails.failedToLoad'))
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      page.value = 1
      pageSize.value = 10
      fetchData()
    }
  }
)

watch(
  () => [
    props.timeRange,
    props.platform,
    props.groupId,
    props.preset.kind,
    props.preset.sort,
    props.preset.min_duration_ms,
    props.preset.max_duration_ms
  ],
  () => {
    if (!props.modelValue) return
    page.value = 1
    fetchData()
  }
)

function handlePageChange(next: number) {
  page.value = next
  fetchData()
}

function handlePageSizeChange(next: number) {
  const normalized = normalizeTablePageSize(next)
  setPersistedPageSize(normalized)
  pageSize.value = normalized
  page.value = 1
  fetchData()
}

async function handleCopyRequestId(requestId: string) {
  const ok = await copyToClipboard(requestId, t('admin.ops.requestDetails.requestIdCopied'))
  if (ok) return
  // `useClipboard` already shows toast on failure; this keeps UX consistent with older ops modal.
  appStore.showWarning(t('admin.ops.requestDetails.copyFailed'))
}

function openErrorDetail(errorId: number | null | undefined) {
  if (!errorId) return
  close()
  emit('openErrorDetail', errorId)
}

function statusTone(statusCode: number | null | undefined) {
  if (typeof statusCode !== 'number') return 'neutral'
  if (statusCode >= 500) return 'danger'
  if (statusCode >= 400) return 'warning'
  if (statusCode >= 200 && statusCode < 300) return 'success'
  return 'neutral'
}
</script>

<template>
  <UiDialog :show="modelValue" :title="props.preset.title || t('admin.ops.requestDetails.title')" width="full" @close="close">
      <div class="ops-request-details">
        <AppInline class="ops-request-details__toolbar" justify="space-between">
          <div class="ops-request-details__range">
            {{ t('admin.ops.requestDetails.rangeLabel', { range: rangeLabel }) }}
          </div>
          <UiButton density="compact" variant="secondary" :loading="loading" @click="fetchData">
            <template #icon><Icon name="refresh" size="sm" /></template>
            {{ t('common.refresh') }}
          </UiButton>
        </AppInline>

        <UiLoadingOverlay class="ops-request-details__body" :show="loading" :label="t('common.loading')">
          <UiEmptyState
            v-if="!items.length && !loading"
            :title="t('admin.ops.requestDetails.empty')"
            :description="t('admin.ops.requestDetails.emptyHint')"
          />
          <UiDataTable
            v-else
            :columns="columns"
            :data="items"
            :loading="false"
            :mobile-table="true"
            row-key="request_id"
            :aria-label="props.preset.title || t('admin.ops.requestDetails.title')"
          >
            <template #cell-created_at="{ row }">{{ formatDateTime(row.created_at) }}</template>
            <template #cell-kind="{ row }">
              <UiBadge
                :tone="row.kind === 'error' ? 'danger' : 'success'"
                :label="row.kind === 'error' ? t('admin.ops.requestDetails.kind.error') : t('admin.ops.requestDetails.kind.success')"
              />
            </template>
            <template #cell-platform="{ row }">{{ (row.platform || 'unknown').toUpperCase() }}</template>
            <template #cell-model="{ row }"><UiDataCell :value="row.model || '-'" /></template>
            <template #cell-duration_ms="{ row }">{{ typeof row.duration_ms === 'number' ? `${row.duration_ms} ms` : '-' }}</template>
            <template #cell-status_code="{ row }">
              <UiBadge :tone="statusTone(row.status_code)" :label="String(row.status_code ?? '-')" />
            </template>
            <template #cell-request_id="{ row }">
              <AppInline v-if="row.request_id" :wrap="false">
                <UiDataCell :value="row.request_id" mono />
                <UiIconButton
                  icon="copy"
                  density="dense"
                  variant="ghost"
                  :label="t('admin.ops.requestDetails.copy')"
                  @click="handleCopyRequestId(row.request_id)"
                />
              </AppInline>
              <span v-else>-</span>
            </template>
            <template #cell-actions="{ row }">
              <UiButton
                v-if="row.kind === 'error' && row.error_id"
                density="dense"
                variant="danger"
                @click="openErrorDetail(row.error_id)"
              >
                {{ t('admin.ops.requestDetails.viewError') }}
              </UiButton>
              <span v-else>-</span>
            </template>
          </UiDataTable>
        </UiLoadingOverlay>

        <UiPagination
          v-if="total > 0"
          :total="total"
          :page="page"
          :page-size="pageSize"
          :page-size-options="pageSizeOptions"
          :reset-page-on-page-size-change="false"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>
  </UiDialog>
</template>

<style scoped>
.ops-request-details {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

.ops-request-details__toolbar {
  flex-shrink: 0;
  padding-bottom: 10px;
}

.ops-request-details__range {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.ops-request-details__body {
  min-height: 160px;
  flex: 1;
  overflow: auto;
}
</style>
