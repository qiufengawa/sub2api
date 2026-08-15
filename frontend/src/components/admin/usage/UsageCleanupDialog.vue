<template>
  <UiDialog
    :show="show"
    :title="t('admin.usage.cleanup.title')"
    width="wide"
    :close-label="t('common.close')"
    :z-index="50"
    @close="handleClose"
  >
    <div class="usage-cleanup">
      <UsageFilters
        v-model="localFilters"
        v-model:startDate="localStartDate"
        v-model:endDate="localEndDate"
        :exporting="false"
        :show-actions="false"
        @change="noop"
      />

      <UiAlert tone="warning">
        {{ t('admin.usage.cleanup.warning') }}
      </UiAlert>

      <section class="usage-cleanup__tasks">
        <header class="usage-cleanup__tasks-header">
          <h3>
            {{ t('admin.usage.cleanup.recentTasks') }}
          </h3>
          <UiIconButton
            icon="refresh"
            variant="ghost"
            density="dense"
            :label="t('common.refresh')"
            :disabled="tasksLoading"
            @click="loadTasks"
          />
        </header>

        <UiMobileTableScroller min-width="720px" :label="t('admin.usage.cleanup.recentTasks')">
          <UiDataTable
            :columns="taskColumns"
            :data="tasks"
            :loading="tasksLoading"
            row-key="id"
            mobile-table
          >
            <template #cell-status="{ row }">
              <UiBadge :tone="statusTone(row.status)">{{ statusLabel(row.status) }}</UiBadge>
            </template>
            <template #cell-id="{ row }">
              <UiDataCell :value="`#${row.id}`" mono />
            </template>
            <template #cell-range="{ row }">
              <span class="usage-cleanup__range">{{ formatRange(row) }}</span>
            </template>
            <template #cell-deleted_rows="{ row }">
              <span class="ui-numeric">{{ row.deleted_rows.toLocaleString() }}</span>
            </template>
            <template #cell-created_at="{ row }">
              <span class="usage-cleanup__date">{{ formatDateTime(row.created_at) }}</span>
            </template>
            <template #cell-error_message="{ row }">
              <span v-if="row.error_message" class="usage-cleanup__error">{{ row.error_message }}</span>
              <span v-else>-</span>
            </template>
            <template #cell-actions="{ row }">
              <UiButton
                v-if="canCancel(row)"
                density="mini"
                variant="danger"
                @click="openCancelConfirm(row)"
              >
                {{ t('admin.usage.cleanup.cancel') }}
              </UiButton>
            </template>
            <template #empty>
              <UiEmptyState :title="t('admin.usage.cleanup.noTasks')" />
            </template>
          </UiDataTable>
        </UiMobileTableScroller>

        <UiPagination
          v-if="tasksTotal > tasksPageSize"
          :total="tasksTotal"
          :page="tasksPage"
          :page-size="tasksPageSize"
          :page-size-options="[5]"
          :show-page-size-selector="false"
          :show-jump="true"
          :reset-page-on-page-size-change="false"
          @update:page="handleTaskPageChange"
          @update:pageSize="handleTaskPageSizeChange"
        />
      </section>
    </div>

    <template #footer>
      <UiButton density="compact" @click="handleClose">{{ t('common.cancel') }}</UiButton>
      <UiButton density="compact" variant="danger" :loading="submitting" @click="openConfirm">
        {{ t('admin.usage.cleanup.submit') }}
      </UiButton>
    </template>
  </UiDialog>

  <UiConfirmDialog
    :show="confirmVisible"
    :title="t('admin.usage.cleanup.confirmTitle')"
    :message="t('admin.usage.cleanup.confirmMessage')"
    :confirm-text="t('admin.usage.cleanup.confirmSubmit')"
    danger
    @confirm="submitCleanup"
    @cancel="confirmVisible = false"
  />

  <UiConfirmDialog
    :show="cancelConfirmVisible"
    :title="t('admin.usage.cleanup.cancelConfirmTitle')"
    :message="t('admin.usage.cleanup.cancelConfirmMessage')"
    :confirm-text="t('admin.usage.cleanup.cancelConfirm')"
    danger
    @confirm="cancelTask"
    @cancel="cancelConfirmVisible = false"
  />
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import UsageFilters from '@/components/admin/usage/UsageFilters.vue'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiMobileTableScroller,
  UiPagination,
  type Column,
} from '@/components/ui'
import { adminUsageAPI } from '@/api/admin/usage'
import type { AdminUsageQueryParams, UsageCleanupTask, CreateUsageCleanupTaskRequest } from '@/api/admin/usage'
import { requestTypeToLegacyStream } from '@/utils/usageRequestType'

interface Props {
  show: boolean
  filters: AdminUsageQueryParams
  startDate: string
  endDate: string
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

const { t } = useI18n()
const appStore = useAppStore()

const localFilters = ref<AdminUsageQueryParams>({})
const localStartDate = ref('')
const localEndDate = ref('')

const tasks = ref<UsageCleanupTask[]>([])
const tasksLoading = ref(false)
const tasksPage = ref(1)
const tasksPageSize = ref(5)
const tasksTotal = ref(0)
const submitting = ref(false)
const confirmVisible = ref(false)
const cancelConfirmVisible = ref(false)
const canceling = ref(false)
const cancelTarget = ref<UsageCleanupTask | null>(null)
let pollTimer: number | null = null
let taskRequestSequence = 0

const taskColumns: Column[] = [
  { key: 'status', label: t('admin.usage.cleanup.statusLabel') },
  { key: 'id', label: 'ID' },
  { key: 'range', label: t('admin.usage.cleanup.range') },
  { key: 'deleted_rows', label: t('admin.usage.cleanup.deletedRows') },
  { key: 'created_at', label: t('admin.usage.cleanup.createdAt') },
  { key: 'error_message', label: t('admin.usage.cleanup.error') },
  { key: 'actions', label: t('common.actions') },
]

const noop = () => {}

const resetFilters = () => {
  localFilters.value = { ...props.filters }
  localStartDate.value = props.startDate
  localEndDate.value = props.endDate
  localFilters.value.start_date = localStartDate.value
  localFilters.value.end_date = localEndDate.value
  tasksPage.value = 1
  tasksTotal.value = 0
}

const startPolling = () => {
  stopPolling()
  pollTimer = window.setInterval(() => {
    loadTasks()
  }, 10000)
}

const stopPolling = () => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

const handleClose = () => {
  taskRequestSequence += 1
  tasksLoading.value = false
  stopPolling()
  confirmVisible.value = false
  cancelConfirmVisible.value = false
  canceling.value = false
  cancelTarget.value = null
  submitting.value = false
  emit('close')
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: t('admin.usage.cleanup.status.pending'),
    running: t('admin.usage.cleanup.status.running'),
    succeeded: t('admin.usage.cleanup.status.succeeded'),
    failed: t('admin.usage.cleanup.status.failed'),
    canceled: t('admin.usage.cleanup.status.canceled')
  }
  return map[status] || status
}

const statusTone = (status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  if (status === 'pending') return 'warning'
  if (status === 'running') return 'info'
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const formatRange = (task: UsageCleanupTask) => {
  const start = formatDateTime(task.filters.start_time)
  const end = formatDateTime(task.filters.end_time)
  return `${start} ~ ${end}`
}

const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

const loadTasks = async () => {
  if (!props.show) return
  const sequence = ++taskRequestSequence
  tasksLoading.value = true
  try {
    const res = await adminUsageAPI.listCleanupTasks({
      page: tasksPage.value,
      page_size: tasksPageSize.value
    })
    if (sequence !== taskRequestSequence || !props.show) return
    tasks.value = res.items || []
    tasksTotal.value = res.total || 0
    if (res.page) {
      tasksPage.value = res.page
    }
    if (res.page_size) {
      tasksPageSize.value = res.page_size
    }
  } catch (error) {
    if (sequence !== taskRequestSequence || !props.show) return
    console.error('Failed to load cleanup tasks:', error)
    appStore.showError(t('admin.usage.cleanup.loadFailed'))
  } finally {
    if (sequence === taskRequestSequence) tasksLoading.value = false
  }
}

const handleTaskPageChange = (page: number) => {
  tasksPage.value = page
  loadTasks()
}

const handleTaskPageSizeChange = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return
  tasksPageSize.value = size
  tasksPage.value = 1
  loadTasks()
}

const openConfirm = () => {
  confirmVisible.value = true
}

const canCancel = (task: UsageCleanupTask) => {
  return task.status === 'pending' || task.status === 'running'
}

const openCancelConfirm = (task: UsageCleanupTask) => {
  cancelTarget.value = task
  cancelConfirmVisible.value = true
}

const buildPayload = (): CreateUsageCleanupTaskRequest | null => {
  if (!localStartDate.value || !localEndDate.value) {
    appStore.showError(t('admin.usage.cleanup.missingRange'))
    return null
  }

  const payload: CreateUsageCleanupTaskRequest = {
    start_date: localStartDate.value,
    end_date: localEndDate.value,
    timezone: getUserTimezone()
  }

  if (localFilters.value.user_id && localFilters.value.user_id > 0) {
    payload.user_id = localFilters.value.user_id
  }
  if (localFilters.value.api_key_id && localFilters.value.api_key_id > 0) {
    payload.api_key_id = localFilters.value.api_key_id
  }
  if (localFilters.value.account_id && localFilters.value.account_id > 0) {
    payload.account_id = localFilters.value.account_id
  }
  if (localFilters.value.group_id && localFilters.value.group_id > 0) {
    payload.group_id = localFilters.value.group_id
  }
  if (localFilters.value.model) {
    payload.model = localFilters.value.model
  }
  if (localFilters.value.request_type) {
    payload.request_type = localFilters.value.request_type
    const legacyStream = requestTypeToLegacyStream(localFilters.value.request_type)
    if (legacyStream !== null && legacyStream !== undefined) {
      payload.stream = legacyStream
    }
  } else if (localFilters.value.stream !== null && localFilters.value.stream !== undefined) {
    payload.stream = localFilters.value.stream
  }
  if (localFilters.value.billing_type !== null && localFilters.value.billing_type !== undefined) {
    payload.billing_type = localFilters.value.billing_type
  }

  return payload
}

const submitCleanup = async () => {
  const payload = buildPayload()
  if (!payload) {
    confirmVisible.value = false
    return
  }
  submitting.value = true
  confirmVisible.value = false
  try {
    await adminUsageAPI.createCleanupTask(payload)
    appStore.showSuccess(t('admin.usage.cleanup.submitSuccess'))
    loadTasks()
  } catch (error) {
    console.error('Failed to create cleanup task:', error)
    appStore.showError(t('admin.usage.cleanup.submitFailed'))
  } finally {
    submitting.value = false
  }
}

const cancelTask = async () => {
  const task = cancelTarget.value
  if (!task) {
    cancelConfirmVisible.value = false
    return
  }
  canceling.value = true
  cancelConfirmVisible.value = false
  try {
    await adminUsageAPI.cancelCleanupTask(task.id)
    appStore.showSuccess(t('admin.usage.cleanup.cancelSuccess'))
    loadTasks()
  } catch (error) {
    console.error('Failed to cancel cleanup task:', error)
    appStore.showError(t('admin.usage.cleanup.cancelFailed'))
  } finally {
    canceling.value = false
    cancelTarget.value = null
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      resetFilters()
      loadTasks()
      startPolling()
    } else {
      taskRequestSequence += 1
      tasksLoading.value = false
      stopPolling()
    }
  }
)

onUnmounted(() => {
  taskRequestSequence += 1
  stopPolling()
})
</script>

<style scoped>
.usage-cleanup {
  display: grid;
  gap: 16px;
}

.usage-cleanup__tasks {
  min-width: 0;
  border-top: 1px solid var(--ui-border-soft);
}

.usage-cleanup__tasks-header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.usage-cleanup__tasks-header h3 {
  margin: 0;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
}

.usage-cleanup__range,
.usage-cleanup__date {
  color: var(--ui-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.usage-cleanup__error {
  display: block;
  max-width: 220px;
  overflow: hidden;
  color: var(--ui-danger);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
