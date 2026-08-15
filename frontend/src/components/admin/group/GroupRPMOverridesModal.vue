<template>
  <UiDialog :show="show" :title="t('admin.groups.rpmOverridesTitle')" width="wide" @close="handleClose">
    <AppStack v-if="group" :gap="12">
      <UiDescriptionList :items="groupFacts" :columns="3" />

      <AppSection :title="t('admin.groups.addUserRpm')" divided>
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
            :model-value="newRpm ?? ''"
            @update:model-value="newRpm = parseNullableNumber($event)"
            type="number"
            step="1"
            min="0"
            autocomplete="off"
            density="default"
            text-align="center"
            placeholder="100"
          />
          <UiButton
            type="button"
            variant="primary"
            density="default"
            :disabled="!selectedUser || newRpm == null || newRpm < 0"
            @click="handleAddLocal"
          >
            {{ t('common.add') }}
          </UiButton>
        </AppGrid>

        <AppInline v-if="localEntries.length > 0" justify="flex-end">
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
        </AppInline>
      </AppSection>

      <AppSection :title="`${t('admin.groups.rpmOverrides')} (${localEntries.length})`">
        <UiLoadingOverlay v-if="loading" :show="true" :label="t('common.loading')" />
        <UiEmptyState
          v-else-if="localEntries.length === 0"
          :title="t('admin.groups.noRpmOverrides')"
        />
        <AppStack v-else :gap="8">
          <UiMobileTableScroller
            :label="t('admin.groups.rpmOverrides')"
            min-width="720px"
          >
          <UiDataTable
            :columns="rpmColumns"
            :data="paginatedLocalEntries"
            row-key="user_id"
            mobile-table
            :aria-label="t('admin.groups.rpmOverrides')"
          >
            <template #cell-user_name="{ row }">{{ row.user_name || '-' }}</template>
            <template #cell-user_notes="{ row }">
              <UiDataCell :value="row.user_notes || '-'" />
            </template>
            <template #cell-user_status="{ row }">
              <UiStatusBadge :status="row.user_status" :label="row.user_status" />
            </template>
            <template #cell-rpm_override="{ row }">
                <UiTextField
                  type="number"
                  step="1"
                  min="0"
                  autocomplete="off"
                  :model-value="row.rpm_override"
                  density="dense"
                  text-align="center"
                  @change="updateLocalRpm(row.user_id, $event)"
                />
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
import type { GroupRPMOverrideEntry } from '@/api/admin/groups'
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
const selectedUser = ref<AdminUser | null>(null)
const newRpm = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)

const rpmColumns = computed<Column[]>(() => [
  { key: 'user_email', label: t('admin.groups.columns.userEmail') },
  { key: 'user_id', label: 'ID' },
  { key: 'user_name', label: t('admin.groups.columns.userName') },
  { key: 'user_notes', label: t('admin.groups.columns.userNotes') },
  { key: 'user_status', label: t('admin.groups.columns.userStatus') },
  { key: 'rpm_override', label: t('admin.groups.columns.rpmOverride') },
  { key: 'actions', label: '' },
])

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
    key: 'rpm',
    label: t('admin.groups.groupRpmDefault'),
    value: props.group.rpm_limit || 0,
    numeric: true,
  },
] : [])

const searchUserOptions = computed<UiEntityOption[]>(() => searchResults.value.map(user => ({
  value: user.id,
  label: user.username || user.email,
  description: user.username ? user.email : `#${user.id}`,
})))

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

onUnmounted(() => {
  loadRequestId += 1
  clearTimeout(searchTimeout)
})
</script>
