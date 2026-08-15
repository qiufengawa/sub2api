<template>
  <UiDialog :show="show" :title="t('admin.groups.rateMultipliersTitle')" width="wide" @close="handleClose">
    <div v-if="group" class="space-y-4">
      <!-- 分组信息 -->
      <div class="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-4 py-2.5 text-sm dark:bg-dark-700">
        <span class="inline-flex items-center gap-1.5" :class="platformColorClass">
          <PlatformIcon :platform="group.platform" size="sm" />
          {{ t('admin.groups.platforms.' + group.platform) }}
        </span>
        <span class="text-gray-400">|</span>
        <span class="font-medium text-gray-900 dark:text-white">{{ group.name }}</span>
        <span class="text-gray-400">|</span>
        <span class="text-gray-600 dark:text-gray-400">
          {{ t('admin.groups.columns.rateMultiplier') }}: {{ group.rate_multiplier }}x
        </span>
      </div>

      <!-- 操作区 -->
      <div class="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
        <!-- 添加用户 -->
        <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('admin.groups.addUserRate') }}
        </h4>
        <div class="flex items-end gap-2">
          <div class="relative flex-1">
            <UiTextField
              v-model="searchQuery"
              type="text"
              autocomplete="off"
              density="compact"
              :placeholder="t('admin.groups.searchUserPlaceholder')"
              @input="handleSearchUsers"
              @focus="showDropdown = true"
            />
            <div
              v-if="showDropdown && searchResults.length > 0"
              class="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-dark-500 dark:bg-dark-700"
            >
              <UiButton
                v-for="user in searchResults"
                :key="user.id"
                type="button"
                variant="quiet"
                density="compact"
                block
                @click="selectUser(user)"
              >
                <span class="text-gray-400">#{{ user.id }}</span>
                <span class="text-gray-900 dark:text-white">{{ user.username || user.email }}</span>
                <span v-if="user.username" class="text-xs text-gray-400">{{ user.email }}</span>
              </UiButton>
            </div>
          </div>
          <div class="w-24">
            <UiTextField
              :model-value="newRate ?? ''"
              @update:model-value="newRate = parseNullableNumber($event)"
              type="number"
              step="0.001"
              min="0.001"
              autocomplete="off"
              density="compact"
              text-align="center"
              placeholder="1.0"
            />
          </div>
          <UiButton
            type="button"
            variant="primary"
            density="compact"
            :disabled="!selectedUser || newRate == null || newRate <= 0"
            @click="handleAddLocal"
          >
            {{ t('common.add') }}
          </UiButton>
        </div>

        <!-- 批量调整 + 全部清空 -->
        <div v-if="localEntries.length > 0" class="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3 dark:border-dark-600">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('admin.groups.batchAdjust') }}</span>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-gray-400">×</span>
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
          </div>
          <div class="ml-auto">
            <UiButton
              type="button"
              variant="danger"
              density="compact"
              @click="clearAllLocal"
            >
              {{ t('admin.groups.clearAll') }}
            </UiButton>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex justify-center py-6">
        <UiSpinner :label="t('common.loading')" />
      </div>

      <!-- 已设置的用户列表 -->
      <div v-else>
        <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('admin.groups.rateMultipliers') }} ({{ localEntries.length }})
        </h4>

        <div v-if="localEntries.length === 0" class="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          {{ t('admin.groups.noRateMultipliers') }}
        </div>

        <div v-else>
          <UiDataTable
            :columns="rateColumns"
            :data="paginatedLocalEntries"
            row-key="user_id"
            mobile-table
            :aria-label="t('admin.groups.rateMultipliers')"
          >
            <template #cell-user_name="{ row }">{{ row.user_name || '-' }}</template>
            <template #cell-user_notes="{ row }">
              <span class="block max-w-[160px] truncate" :title="row.user_notes">{{ row.user_notes || '-' }}</span>
            </template>
            <template #cell-user_status="{ row }">
              <UiStatusBadge :status="row.user_status" :label="row.user_status" />
            </template>
            <template #cell-rate_multiplier="{ row }">
              <div class="w-24">
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
              </div>
            </template>
            <template #cell-final_rate="{ row }">
              <strong class="text-primary-600 dark:text-primary-400">{{ computeFinalRate(row.rate_multiplier) }}</strong>
            </template>
            <template #cell-actions="{ row }">
              <UiIconButton
                :label="t('common.delete')"
                variant="danger"
                density="dense"
                @click="removeLocal(row.user_id)"
              >
                <Icon name="trash" size="sm" />
              </UiIconButton>
            </template>
          </UiDataTable>

          <!-- 分页 -->
          <UiPagination
            :total="localEntries.length"
            :page="currentPage"
            :page-size="pageSize"
            @update:page="currentPage = $event"
            @update:pageSize="handlePageSizeChange"
          />
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="flex items-center gap-3 border-t border-gray-200 pt-4 dark:border-dark-600">
        <!-- 左侧：未保存提示 + 撤销 -->
        <template v-if="isDirty">
          <span class="text-xs text-amber-600 dark:text-amber-400">{{ t('admin.groups.unsavedChanges') }}</span>
          <UiButton
            type="button"
            variant="quiet"
            density="dense"
            @click="handleCancel"
          >
            {{ t('admin.groups.revertChanges') }}
          </UiButton>
        </template>
        <!-- 右侧：关闭 / 保存 -->
        <div class="ml-auto flex items-center gap-3">
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
        </div>
      </div>
    </div>
  </UiDialog>

</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { GroupRateMultiplierEntry } from '@/api/admin/groups'
import type { AdminGroup, AdminUser } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import {
  UiButton,
  UiDataTable,
  UiDialog,
  UiIconButton,
  UiPagination,
  UiSpinner,
  UiStatusBadge,
  UiTextField,
  type Column,
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
const showDropdown = ref(false)
const selectedUser = ref<AdminUser | null>(null)
const newRate = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const batchFactor = ref<number | null>(null)

let searchTimeout: ReturnType<typeof setTimeout>
let loadRequestId = 0

const platformColorClass = computed(() => {
  switch (props.group?.platform) {
    case 'anthropic': return 'text-orange-700 dark:text-orange-400'
    case 'openai': return 'text-emerald-700 dark:text-emerald-400'
    case 'antigravity': return 'text-purple-700 dark:text-purple-400'
    default: return 'text-blue-700 dark:text-blue-400'
  }
})

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

const handleSearchUsers = () => {
  clearTimeout(searchTimeout)
  selectedUser.value = null
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    showDropdown.value = false
    return
  }
  searchTimeout = setTimeout(async () => {
    try {
      const res = await adminAPI.users.list(1, 10, { search: searchQuery.value.trim() })
      searchResults.value = res.items
      showDropdown.value = true
    } catch {
      searchResults.value = []
    }
  }, 300)
}

const selectUser = (user: AdminUser) => {
  selectedUser.value = user
  searchQuery.value = user.email
  showDropdown.value = false
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

// 点击外部关闭下拉
const handleClickOutside = () => {
  showDropdown.value = false
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', handleClickOutside)
}

onUnmounted(() => {
  loadRequestId += 1
  clearTimeout(searchTimeout)
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>
