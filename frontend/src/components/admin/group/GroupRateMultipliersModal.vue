<template>
  <UiDialog :show="show" :title="t('admin.groups.rateMultipliersTitle')" width="wide" @close="handleClose">
    <AppStack v-if="group" :gap="12">
      <UiDescriptionList :items="groupFacts" :columns="3" />

      <AppSection :title="t('admin.groups.addUserRate')" divided>
        <AppGrid min="160px" :gap="8">
          <UiAsyncEntityPicker
            :model-value="selectedUser?.id ?? null"
            :selected-label="selectedUser?.email || searchQuery"
            :items="searchUserOptions"
            :placeholder="t('admin.groups.searchUserPlaceholder')"
            :empty-text="t('common.noData')"
            @search="handleSearchUsers"
            @select="selectUserOption"
          />
          <UiTextField
            :model-value="newRate ?? ''"
            @update:model-value="newRate = parseNullableNumber($event)"
            type="number"
            step="0.001"
            min="0.001"
            autocomplete="off"
            density="default"
            text-align="center"
            placeholder="1.0"
          />
          <UiButton
            type="button"
            variant="primary"
            density="default"
            :disabled="!selectedUser || newRate == null || newRate <= 0"
            @click="handleAddLocal"
          >
            {{ t('common.add') }}
          </UiButton>
        </AppGrid>

        <AppInline v-if="localEntries.length > 0" justify="space-between">
          <AppInline>
            <UiBadge tone="neutral" :label="t('admin.groups.batchAdjust')" />
            <UiTextField
              :model-value="batchFactor ?? ''"
              @update:model-value="batchFactor = parseNullableNumber($event)"
              type="number"
              step="0.1"
              min="0"
              autocomplete="off"
              density="compact"
              text-align="center"
              placeholder="0.5"
            />
            <UiButton
              type="button"
              variant="primary"
              density="dense"
              :disabled="!batchFactor || batchFactor <= 0"
              @click="applyBatchFactor"
            >
              {{ t('admin.groups.applyMultiplier') }}
            </UiButton>
          </AppInline>
          <UiButton
            type="button"
            variant="danger"
            density="compact"
            @click="clearAllLocal"
          >
            {{ t('admin.groups.clearAll') }}
          </UiButton>
        </AppInline>
      </AppSection>

      <AppSection :title="`${t('admin.groups.rateMultipliers')} (${localEntries.length})`">
        <UiLoadingOverlay v-if="loading" :show="true" :label="t('common.loading')" />
        <UiEmptyState
          v-else-if="localEntries.length === 0"
          :title="t('admin.groups.noRateMultipliers')"
        />
        <AppStack v-else :gap="8">
          <UiMobileTableScroller
            :label="t('admin.groups.rateMultipliers')"
            min-width="760px"
          >
          <UiDataTable
            :columns="rateColumns"
            :data="paginatedLocalEntries"
            row-key="user_id"
            mobile-table
            :aria-label="t('admin.groups.rateMultipliers')"
          >
            <template #cell-user_name="{ row }">{{ row.user_name || '-' }}</template>
            <template #cell-user_notes="{ row }">
              <UiDataCell :value="row.user_notes || '-'" />
            </template>
            <template #cell-user_status="{ row }">
              <UiStatusBadge :status="row.user_status" :label="row.user_status" />
            </template>
            <template #cell-rate_multiplier="{ row }">
                <UiTextField
                  type="number"
                  step="0.001"
                  min="0.001"
                  autocomplete="off"
                  :model-value="row.rate_multiplier ?? ''"
                  :placeholder="String(props.group?.rate_multiplier ?? 1)"
                  density="dense"
                  text-align="center"
                  @change="updateLocalRate(row.user_id, $event)"
                />
            </template>
            <template #cell-final_rate="{ row }">
              <UiDataCell :value="computeFinalRate(row.rate_multiplier)" mono />
            </template>
            <template #cell-actions="{ row }">
              <UiIconButton
                icon="trash"
                :label="t('common.delete')"
                variant="danger"
                density="dense"
                @click="removeLocal(row.user_id)"
              />
            </template>
          </UiDataTable>
          </UiMobileTableScroller>

          <UiPagination
            :total="localEntries.length"
            :page="currentPage"
            :page-size="pageSize"
            @update:page="currentPage = $event"
            @update:pageSize="handlePageSizeChange"
          />
        </AppStack>
      </AppSection>
    </AppStack>

    <template v-if="group" #footer>
      <AppInline justify="space-between">
        <AppInline>
        <template v-if="isDirty">
          <UiBadge tone="warning" :label="t('admin.groups.unsavedChanges')" />
          <UiButton
            type="button"
            variant="quiet"
            density="dense"
            @click="handleCancel"
          >
            {{ t('admin.groups.revertChanges') }}
          </UiButton>
        </template>
        </AppInline>
        <AppInline>
          <UiButton type="button" density="compact" @click="handleClose">
            {{ t('common.close') }}
          </UiButton>
          <UiButton
            v-if="isDirty"
            data-test="save-rate-overrides"
            type="button"
            variant="primary"
            density="compact"
            :disabled="saving"
            :loading="saving"
            @click="handleSave"
          >
            {{ t('common.save') }}
          </UiButton>
        </AppInline>
      </AppInline>
    </template>
  </UiDialog>

</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { GroupRateMultiplierEntry } from '@/api/admin/groups'
import type { AdminGroup, AdminUser } from '@/types'
import {
  AppGrid,
  AppInline,
  AppSection,
  AppStack,
  UiAsyncEntityPicker,
  UiBadge,
  UiButton,
  UiDataCell,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiLoadingOverlay,
  UiMobileTableScroller,
  UiPagination,
  UiStatusBadge,
  UiTextField,
  type Column,
  type UiEntityOption,
} from '@/components/ui'

interface LocalEntry extends GroupRateMultiplierEntry {}

const props = defineProps<{
  show: boolean
  group: AdminGroup | null
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const saving = ref(false)
const serverEntries = ref<GroupRateMultiplierEntry[]>([])
const localEntries = ref<LocalEntry[]>([])
const searchQuery = ref('')
const searchResults = ref<AdminUser[]>([])
const selectedUser = ref<AdminUser | null>(null)
const newRate = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const batchFactor = ref<number | null>(null)

let searchTimeout: ReturnType<typeof setTimeout>
let loadRequestId = 0

const groupFacts = computed(() => props.group ? [
  {
    key: 'platform',
    label: t('admin.groups.form.platform'),
    value: t(`admin.groups.platforms.${props.group.platform}`),
  },
  { key: 'name', label: t('admin.groups.form.name'), value: props.group.name },
  {
    key: 'rate',
    label: t('admin.groups.columns.rateMultiplier'),
    value: `${props.group.rate_multiplier}x`,
    numeric: true,
  },
] : [])

const searchUserOptions = computed<UiEntityOption[]>(() => searchResults.value.map(user => ({
  value: user.id,
  label: user.username || user.email,
  description: user.username ? user.email : `#${user.id}`,
})))

// 是否显示"最终倍率"预览列
const showFinalRate = computed(() => {
  return batchFactor.value != null && batchFactor.value > 0 && batchFactor.value !== 1
})

const rateColumns = computed<Column[]>(() => [
  { key: 'user_email', label: t('admin.groups.columns.userEmail') },
  { key: 'user_id', label: 'ID' },
  { key: 'user_name', label: t('admin.groups.columns.userName') },
  { key: 'user_notes', label: t('admin.groups.columns.userNotes') },
  { key: 'user_status', label: t('admin.groups.columns.userStatus') },
  { key: 'rate_multiplier', label: t('admin.groups.columns.rateMultiplier') },
  ...(showFinalRate.value ? [{ key: 'final_rate', label: t('admin.groups.finalRate') }] : []),
  { key: 'actions', label: '' },
])

// 计算最终倍率预览
const computeFinalRate = (rate: number | null | undefined) => {
  const base = rate ?? props.group?.rate_multiplier ?? 1
  if (!batchFactor.value) return base
  return parseFloat((base * batchFactor.value).toFixed(6))
}

// 检测是否有未保存的修改
const isDirty = computed(() => {
  if (localEntries.value.length !== serverEntries.value.length) return true
  const serverMap = new Map(serverEntries.value.map(e => [e.user_id, e.rate_multiplier ?? null]))
  return localEntries.value.some(e => serverMap.get(e.user_id) !== (e.rate_multiplier ?? null))
})

const paginatedLocalEntries = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return localEntries.value.slice(start, start + pageSize.value)
})

const cloneEntries = (entries: GroupRateMultiplierEntry[]): LocalEntry[] => {
  return entries.map(e => ({ ...e }))
}

const loadEntries = async () => {
  const groupId = props.group?.id
  if (!groupId) return
  const requestId = ++loadRequestId
  loading.value = true
  try {
    const raw = await adminAPI.groups.getGroupRateMultipliers(groupId)
    if (requestId !== loadRequestId) return
    // 仅显示已设置 rate_multiplier 的条目；rpm_override 在另一个弹窗管理，保留不动
    serverEntries.value = raw.filter(e => e.rate_multiplier != null)
    localEntries.value = cloneEntries(serverEntries.value)
    adjustPage()
  } catch (error) {
    if (requestId !== loadRequestId) return
    appStore.showError(t('admin.groups.failedToLoad'))
    console.error('Error loading group rate multipliers:', error)
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

const adjustPage = () => {
  const totalPages = Math.max(1, Math.ceil(localEntries.value.length / pageSize.value))
  if (currentPage.value > totalPages) {
    currentPage.value = totalPages
  }
}

watch([() => props.show, () => props.group?.id], ([val]) => {
  if (val && props.group) {
    currentPage.value = 1
    batchFactor.value = null
    searchQuery.value = ''
    searchResults.value = []
    selectedUser.value = null
    newRate.value = null
    loadEntries()
  } else {
    loadRequestId += 1
    loading.value = false
  }
}, { immediate: true })

const handlePageSizeChange = (newSize: number) => {
  pageSize.value = newSize
  currentPage.value = 1
}

const handleSearchUsers = (query: string) => {
  clearTimeout(searchTimeout)
  searchQuery.value = query
  selectedUser.value = null
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    try {
      const res = await adminAPI.users.list(1, 10, { search: searchQuery.value.trim() })
      searchResults.value = res.items
    } catch {
      searchResults.value = []
    }
  }, 300)
}

const selectUserOption = (option: UiEntityOption) => {
  const user = searchResults.value.find(item => item.id === Number(option.value))
  if (!user) return
  selectedUser.value = user
  searchQuery.value = user.email
  searchResults.value = []
}

const parseNullableNumber = (value: string): number | null => {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// 本地添加（或覆盖已有用户）
const handleAddLocal = () => {
  if (!selectedUser.value || newRate.value == null || newRate.value <= 0) return
  const user = selectedUser.value
  const idx = localEntries.value.findIndex(e => e.user_id === user.id)
  const entry: LocalEntry = {
    user_id: user.id,
    user_name: user.username || '',
    user_email: user.email,
    user_notes: user.notes || '',
    user_status: user.status || 'active',
    rate_multiplier: newRate.value,
    rpm_override: null
  }
  if (idx >= 0) {
    localEntries.value[idx] = entry
  } else {
    localEntries.value.push(entry)
  }
  searchQuery.value = ''
  selectedUser.value = null
  newRate.value = null
  adjustPage()
}

// 本地修改倍率
const updateLocalRate = (userId: number, value: string) => {
  const entry = localEntries.value.find(e => e.user_id === userId)
  if (!entry) return
  if (value.trim() === '') {
    entry.rate_multiplier = null
    return
  }
  const num = parseFloat(value)
  if (isNaN(num) || num <= 0) return
  entry.rate_multiplier = num
}

// 本地删除
const removeLocal = (userId: number) => {
  localEntries.value = localEntries.value.filter(e => e.user_id !== userId)
  adjustPage()
}

// 批量乘数应用到本地
const applyBatchFactor = () => {
  if (!batchFactor.value || batchFactor.value <= 0) return
  for (const entry of localEntries.value) {
    if (entry.rate_multiplier != null) {
      entry.rate_multiplier = parseFloat((entry.rate_multiplier * batchFactor.value).toFixed(6))
    }
  }
  batchFactor.value = null
}

// 本地清空
const clearAllLocal = () => {
  localEntries.value = []
}

// 取消：恢复到服务器数据
const handleCancel = () => {
  localEntries.value = cloneEntries(serverEntries.value)
  batchFactor.value = null
  adjustPage()
}

// 保存：一次性提交所有数据（只提交 rate_multiplier；rpm_override 由独立弹窗管理）
const handleSave = async () => {
  if (!props.group) return
  saving.value = true
  try {
    const entries = localEntries.value
      .filter(e => e.rate_multiplier != null)
      .map(e => ({
        user_id: e.user_id,
        rate_multiplier: e.rate_multiplier as number
      }))
    await adminAPI.groups.batchSetGroupRateMultipliers(props.group.id, entries)
    appStore.showSuccess(t('admin.groups.rateSaved'))
    emit('success')
    emit('close')
  } catch (error) {
    appStore.showError(t('admin.groups.failedToSave'))
    console.error('Error saving rate multipliers:', error)
  } finally {
    saving.value = false
  }
}

// 关闭时如果有未保存修改，先恢复
const handleClose = () => {
  if (isDirty.value) {
    localEntries.value = cloneEntries(serverEntries.value)
  }
  emit('close')
}

onUnmounted(() => {
  loadRequestId += 1
  clearTimeout(searchTimeout)
})
</script>
