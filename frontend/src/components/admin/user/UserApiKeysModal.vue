<template>
  <UiDialog :show="show" :title="t('admin.users.userApiKeys')" width="wide" @close="handleClose">
    <div v-if="user" class="user-api-keys">
      <header class="user-api-keys__header">
        <strong>{{ user.email }}</strong>
        <span v-if="user.username">{{ user.username }}</span>
      </header>

      <UiErrorState
        v-if="loadError"
        :title="t('admin.users.failedToLoadApiKeys')"
        :retry-text="t('common.retry')"
        @retry="load"
      />
      <template v-else>
        <UiDataTable
          :columns="columns"
          :data="apiKeys"
          :loading="loading"
          :mobile-table="true"
          row-key="id"
          :aria-label="t('admin.users.userApiKeys')"
        >
          <template #cell-name="{ row }">
            <div class="user-api-keys__name">
              <strong>{{ row.name }}</strong>
              <code>{{ maskKey(row.key) }}</code>
            </div>
          </template>
          <template #cell-status="{ row }">
            <UiStatusBadge :status="row.status" :label="row.status" />
          </template>
          <template #cell-group="{ row }">
            <UiSelect
              :model-value="row.group_id ?? null"
              :options="groupOptionsFor(row)"
              density="dense"
              :disabled="loading || !!loadError || updatingKeyIds.has(row.id)"
              :aria-label="t('admin.users.group')"
              @change="(value) => changeGroup(row, value === null ? null : Number(value))"
            />
          </template>
          <template #cell-created_at="{ row }">
            <span class="user-api-keys__date">{{ formatDateTime(row.created_at) }}</span>
          </template>
          <template #empty>
            <UiEmptyState :title="t('admin.users.noApiKeys')" />
          </template>
        </UiDataTable>

        <UiPagination
          v-if="total > pageSize"
          :total="total"
          :page="page"
          :page-size="pageSize"
          :reset-page-on-page-size-change="false"
          @update:page="changePage"
          @update:page-size="changePageSize"
        />
      </template>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { useAppStore } from '@/stores/app'
import type { AdminGroup, AdminUser, ApiKey } from '@/types'
import { formatDateTime } from '@/utils/format'
import {
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  type Column,
  type SelectOptionLike,
} from '@/components/ui'

const props = defineProps<{ show: boolean; user: AdminUser | null }>()
const emit = defineEmits<{ close: []; success: [] }>()
const { t } = useI18n()
const appStore = useAppStore()

const apiKeys = ref<ApiKey[]>([])
const allGroups = ref<AdminGroup[]>([])
const loading = ref(false)
const loadError = ref<unknown>(null)
const updatingKeyIds = ref(new Set<number>())
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
let loadSequence = 0

const columns = computed<Column[]>(() => [
  { key: 'name', label: t('admin.users.apiKeys'), class: 'min-w-[220px]' },
  { key: 'status', label: t('admin.users.columns.status'), class: 'min-w-[100px]' },
  { key: 'group', label: t('admin.users.group'), class: 'min-w-[280px]' },
  { key: 'created_at', label: t('admin.users.columns.created'), class: 'min-w-[160px]' },
])

watch(
  [() => props.show, () => props.user?.id],
  ([show, userId], previous) => {
    if (show && userId) {
      if (!previous || previous[1] !== userId) page.value = 1
      load()
    } else if (!show) {
      loadSequence += 1
      clearState()
    }
  },
  { immediate: true },
)

function clearState() {
  apiKeys.value = []
  allGroups.value = []
  total.value = 0
  loadError.value = null
  updatingKeyIds.value = new Set()
}

async function load() {
  const userId = props.user?.id
  if (!userId) return
  const sequence = ++loadSequence
  clearState()
  loading.value = true
  try {
    const [keysResponse, groupsResponse] = await Promise.all([
      adminAPI.users.getUserApiKeys(userId, page.value, pageSize.value),
      adminAPI.groups.getAll(),
    ])
    if (sequence !== loadSequence || !props.show || props.user?.id !== userId) return
    apiKeys.value = keysResponse.items || []
    total.value = keysResponse.total || 0
    allGroups.value = groupsResponse
  } catch (error) {
    if (sequence !== loadSequence) return
    loadError.value = error
    appStore.showError(t('admin.users.failedToLoadApiKeys'))
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function groupOptionsFor(key: ApiKey): SelectOptionLike[] {
  const options: SelectOptionLike[] = [
    { value: null, label: t('admin.users.none') },
    ...allGroups.value.map((group) => ({
      value: group.id,
      label: `${group.name} · ${group.platform} · ${group.rate_multiplier}x`,
    })),
  ]
  if (key.group_id && key.group && !allGroups.value.some((group) => group.id === key.group_id)) {
    options.splice(1, 0, {
      value: key.group_id,
      label: `${key.group.name} · ${key.group.platform} · ${key.group.rate_multiplier}x`,
      disabled: true,
    })
  }
  return options
}

function maskKey(value: string): string {
  if (value.length <= 16) return value
  return `${value.slice(0, 12)}...${value.slice(-6)}`
}

async function changeGroup(key: ApiKey, newGroupId: number | null) {
  if (key.group_id === newGroupId || (!key.group_id && newGroupId === null)) return
  updatingKeyIds.value.add(key.id)
  try {
    const result = await adminAPI.apiKeys.updateApiKeyGroup(key.id, newGroupId)
    const index = apiKeys.value.findIndex((item) => item.id === key.id)
    if (index !== -1) apiKeys.value[index] = result.api_key
    if (result.auto_granted_group_access && result.granted_group_name) {
      appStore.showSuccess(t('admin.users.groupChangedWithGrant', { group: result.granted_group_name }))
    } else {
      appStore.showSuccess(t('admin.users.groupChangedSuccess'))
    }
    emit('success')
  } catch (error: any) {
    appStore.showError(error?.message || t('admin.users.groupChangeFailed'))
  } finally {
    updatingKeyIds.value.delete(key.id)
  }
}

function changePage(value: number) {
  page.value = value
  load()
}

function changePageSize(value: number) {
  pageSize.value = value
  page.value = 1
  load()
}

function handleClose() {
  if (updatingKeyIds.value.size > 0) return
  emit('close')
}
</script>

<style scoped>
.user-api-keys{display:grid;gap:16px}.user-api-keys__header{display:flex;align-items:baseline;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--ui-border-soft)}.user-api-keys__header strong{font-size:14px;font-weight:600}.user-api-keys__header span{color:var(--ui-text-muted);font-size:12px}.user-api-keys__name{display:grid;gap:2px}.user-api-keys__name strong{font-size:13px;font-weight:600}.user-api-keys__name code{color:var(--ui-text-muted);font-family:var(--ui-font-mono);font-size:11px}.user-api-keys__date{color:var(--ui-text-muted);font-size:12px;white-space:nowrap}
</style>
