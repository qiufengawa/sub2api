<template>
  <BaseDialog :show="show" :title="t('admin.groups.rpmOverridesTitle')" width="wide" @close="handleClose">
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
          {{ t('admin.groups.groupRpmDefault') }}: {{ group.rpm_limit || 0 }}
        </span>
      </div>

      <!-- 操作区：添加用户 -->
      <div class="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
        <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('admin.groups.addUserRpm') }}
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
              :model-value="newRpm ?? ''"
              @update:model-value="newRpm = parseNullableNumber($event)"
              type="number"
              step="1"
              min="0"
              autocomplete="off"
              density="compact"
              text-align="center"
              placeholder="100"
            />
          </div>
          <UiButton
            type="button"
            variant="primary"
            density="compact"
            :disabled="!selectedUser || newRpm == null || newRpm < 0"
            @click="handleAddLocal"
          >
            {{ t('common.add') }}
          </UiButton>
        </div>

        <div v-if="localEntries.length > 0" class="mt-3 flex items-center justify-end border-t border-gray-100 pt-3 dark:border-dark-600">
          <UiButton
            type="button"
            :disabled="clearing"
            variant="danger"
            density="compact"
            :loading="clearing"
            @click="clearAllLocal"
          >
            {{ t('admin.groups.clearAll') }}
          </UiButton>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex justify-center py-6">
        <UiSpinner :label="t('common.loading')" />
      </div>

      <!-- 列表 -->
      <div v-else>
        <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('admin.groups.rpmOverrides') }} ({{ localEntries.length }})
        </h4>

        <div v-if="localEntries.length === 0" class="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          {{ t('admin.groups.noRpmOverrides') }}
        </div>

        <div v-else>
          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-dark-600">
            <div class="max-h-[420px] overflow-auto">
              <table class="w-full min-w-max text-sm">
                <thead class="sticky top-0 z-[1]">
                  <tr class="border-b border-gray-200 bg-gray-50 dark:border-dark-600 dark:bg-dark-700">
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('admin.groups.columns.userEmail') }}</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">ID</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('admin.groups.columns.userName') }}</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('admin.groups.columns.userNotes') }}</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('admin.groups.columns.userStatus') }}</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400" :title="t('admin.groups.columns.rpmOverrideHint')">{{ t('admin.groups.columns.rpmOverride') }}</th>
                    <th class="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-dark-600">
                  <tr
                    v-for="entry in paginatedLocalEntries"
                    :key="entry.user_id"
                    class="hover:bg-gray-50 dark:hover:bg-dark-700/50"
                  >
                    <td class="px-3 py-2 text-gray-600 dark:text-gray-400">{{ entry.user_email }}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-gray-400 dark:text-gray-500">{{ entry.user_id }}</td>
                    <td class="whitespace-nowrap px-3 py-2 text-gray-900 dark:text-white">{{ entry.user_name || '-' }}</td>
                    <td class="max-w-[160px] truncate px-3 py-2 text-gray-500 dark:text-gray-400" :title="entry.user_notes">{{ entry.user_notes || '-' }}</td>
                    <td class="whitespace-nowrap px-3 py-2">
                      <UiStatusBadge :status="entry.user_status" :label="entry.user_status" />
                    </td>
                    <td class="whitespace-nowrap px-3 py-2">
                      <UiTextField
                        type="number"
                        step="1"
                        min="0"
                        autocomplete="off"
                        :model-value="entry.rpm_override"
                        density="dense"
                        text-align="center"
                        @change="updateLocalRpm(entry.user_id, $event)"
                      />
                    </td>
                    <td class="px-2 py-2">
                      <UiIconButton
                        :label="t('common.delete')"
                        variant="danger"
                        density="dense"
                        @click="removeLocal(entry.user_id)"
                      >
                        <Icon name="trash" size="sm" />
                      </UiIconButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <UiPagination
            :total="localEntries.length"
            :page="currentPage"
            :page-size="pageSize"
            @update:page="currentPage = $event"
            @update:pageSize="handlePageSizeChange"
          />
        </div>
      </div>

      <!-- 底部 -->
      <div class="flex items-center gap-3 border-t border-gray-200 pt-4 dark:border-dark-600">
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
        <div class="ml-auto flex items-center gap-3">
          <UiButton type="button" density="compact" @click="handleClose">
            {{ t('common.close') }}
          </UiButton>
          <UiButton
            v-if="isDirty"
            data-test="save-rpm-overrides"
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
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { GroupRPMOverrideEntry } from '@/api/admin/groups'
import type { AdminGroup, AdminUser } from '@/types'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import {
  UiButton,
  UiIconButton,
  UiPagination,
  UiSpinner,
  UiStatusBadge,
  UiTextField
} from '@/components/ui'

interface LocalEntry extends GroupRPMOverrideEntry {}

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
const serverEntries = ref<GroupRPMOverrideEntry[]>([])
const localEntries = ref<LocalEntry[]>([])
const searchQuery = ref('')
const searchResults = ref<AdminUser[]>([])
const showDropdown = ref(false)
const selectedUser = ref<AdminUser | null>(null)
const newRpm = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)

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

const isDirty = computed(() => {
  if (localEntries.value.length !== serverEntries.value.length) return true
  const serverMap = new Map(serverEntries.value.map(e => [e.user_id, e.rpm_override]))
  return localEntries.value.some(e => serverMap.get(e.user_id) !== e.rpm_override)
})

const paginatedLocalEntries = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return localEntries.value.slice(start, start + pageSize.value)
})

const cloneEntries = (entries: GroupRPMOverrideEntry[]): LocalEntry[] => {
  return entries.map(e => ({ ...e }))
}

const loadEntries = async () => {
  const groupId = props.group?.id
  if (!groupId) return
  const requestId = ++loadRequestId
  loading.value = true
  try {
    const entries = await adminAPI.groups.getGroupRPMOverrides(groupId)
    if (requestId !== loadRequestId) return
    serverEntries.value = entries
    localEntries.value = cloneEntries(serverEntries.value)
    adjustPage()
  } catch (error) {
    if (requestId !== loadRequestId) return
    appStore.showError(t('admin.groups.failedToLoad'))
    console.error('Error loading RPM overrides:', error)
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

const adjustPage = () => {
  const totalPages = Math.max(1, Math.ceil(localEntries.value.length / pageSize.value))
  if (currentPage.value > totalPages) currentPage.value = totalPages
}

watch([() => props.show, () => props.group?.id], ([val]) => {
  if (val && props.group) {
    currentPage.value = 1
    searchQuery.value = ''
    searchResults.value = []
    selectedUser.value = null
    newRpm.value = null
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

const handleAddLocal = () => {
  if (!selectedUser.value || newRpm.value == null || newRpm.value < 0) return
  const user = selectedUser.value
  const idx = localEntries.value.findIndex(e => e.user_id === user.id)
  const entry: LocalEntry = {
    user_id: user.id,
    user_name: user.username || '',
    user_email: user.email,
    user_notes: user.notes || '',
    user_status: user.status || 'active',
    rpm_override: newRpm.value
  }
  if (idx >= 0) {
    localEntries.value[idx] = entry
  } else {
    localEntries.value.push(entry)
  }
  searchQuery.value = ''
  selectedUser.value = null
  newRpm.value = null
  adjustPage()
}

const updateLocalRpm = (userId: number, value: string) => {
  const num = parseInt(value, 10)
  if (isNaN(num) || num < 0) return
  const entry = localEntries.value.find(e => e.user_id === userId)
  if (entry) entry.rpm_override = num
}

const removeLocal = (userId: number) => {
  localEntries.value = localEntries.value.filter(e => e.user_id !== userId)
  adjustPage()
}

const clearing = ref(false)
const clearAllLocal = async () => {
  if (!props.group || clearing.value) return
  clearing.value = true
  try {
    await adminAPI.groups.clearGroupRPMOverrides(props.group.id)
    localEntries.value = []
    serverEntries.value = []
    appStore.showSuccess(t('admin.groups.rpmSaved'))
  } catch (error) {
    appStore.showError(t('admin.groups.failedToSave'))
    console.error('Error clearing RPM overrides:', error)
  } finally {
    clearing.value = false
  }
}

const handleCancel = () => {
  localEntries.value = cloneEntries(serverEntries.value)
  adjustPage()
}

const handleSave = async () => {
  if (!props.group) return
  saving.value = true
  try {
    const entries = localEntries.value.map(e => ({
      user_id: e.user_id,
      rpm_override: e.rpm_override
    }))
    await adminAPI.groups.batchSetGroupRPMOverrides(props.group.id, entries)
    appStore.showSuccess(t('admin.groups.rpmSaved'))
    emit('success')
    emit('close')
  } catch (error) {
    appStore.showError(t('admin.groups.failedToSave'))
    console.error('Error saving RPM overrides:', error)
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  if (isDirty.value) {
    localEntries.value = cloneEntries(serverEntries.value)
  }
  emit('close')
}

const handleClickOutside = () => { showDropdown.value = false }
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
