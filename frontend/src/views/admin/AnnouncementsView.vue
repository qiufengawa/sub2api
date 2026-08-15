<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('admin.announcements.title')" :description="t('admin.announcements.description')">
        <template #actions>
          <UiButton density="dense" variant="primary" @click="openCreateDialog">
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('admin.announcements.createAnnouncement') }}
          </UiButton>
        </template>
      </AppPageHeader>

      <UiServerTableWorkspace :loading="loading" :empty="false">
        <template #toolbar>
          <UiFilterBar :active-count="filters.status ? 1 : 0" @clear="clearFilters">
            <UiSearchInput v-model="searchQuery" density="dense" :placeholder="t('admin.announcements.searchAnnouncements')" @search="handleSearch" />
            <UiSelect v-model="filters.status" density="dense" :options="statusFilterOptions" :aria-label="t('admin.announcements.columns.status')" @change="handleStatusChange" />
            <template #actions>
              <UiIconButton icon="refresh" density="dense" :label="t('common.refresh')" :disabled="loading" @click="loadAnnouncements" />
            </template>
          </UiFilterBar>
        </template>

        <UiMobileTableScroller :label="t('admin.announcements.title')" min-width="940px">
          <UiDataTable :columns="columns" :data="announcements" :loading="loading" :mobile-table="true" :aria-label="t('admin.announcements.title')" :server-side-sort="true" default-sort-key="created_at" default-sort-order="desc" @sort="handleSort">
            <template #cell-title="{ value, row }"><UiDataCell :value="String(value)" :meta="`#${row.id} · ${formatDateTime(row.created_at)}`" /></template>
            <template #cell-status="{ value }"><UiStatusBadge :status="String(value)" :label="statusLabel(String(value))" /></template>
            <template #cell-notify_mode="{ row }"><UiBadge :tone="row.notify_mode === 'popup' ? 'warning' : 'neutral'" :label="row.notify_mode === 'popup' ? t('admin.announcements.notifyModeLabels.popup') : t('admin.announcements.notifyModeLabels.silent')" /></template>
            <template #cell-targeting="{ row }"><UiDataCell :value="targetingSummary(row.targeting)" /></template>
            <template #cell-timeRange="{ row }"><UiDataCell :value="`${t('admin.announcements.form.startsAt')}: ${row.starts_at ? formatDateTime(row.starts_at) : t('admin.announcements.timeImmediate')}`" :meta="`${t('admin.announcements.form.endsAt')}: ${row.ends_at ? formatDateTime(row.ends_at) : t('admin.announcements.timeNever')}`" /></template>
            <template #cell-created_at="{ value }"><UiDataCell :value="formatDateTime(value)" /></template>
            <template #cell-actions="{ row }"><UiButtonGroup :label="t('admin.announcements.columns.actions')"><UiIconButton icon="eye" density="dense" variant="ghost" :label="t('admin.announcements.preview')" @click="openPreview(row)" /><UiIconButton icon="chartBar" density="dense" variant="ghost" :label="t('admin.announcements.readStatus')" @click="openReadStatus(row)" /><UiIconButton icon="edit" density="dense" variant="ghost" :label="t('common.edit')" @click="openEditDialog(row)" /><UiIconButton icon="trash" density="dense" variant="danger" :label="t('common.delete')" @click="handleDelete(row)" /></UiButtonGroup></template>
            <template #empty><UiEmptyState :title="t('empty.noData')" :description="t('admin.announcements.failedToLoad')"><template #action><UiButton density="dense" variant="primary" @click="openCreateDialog">{{ t('admin.announcements.createAnnouncement') }}</UiButton></template></UiEmptyState></template>
          </UiDataTable>
        </UiMobileTableScroller>

        <template #pagination>
          <UiPagination v-if="pagination.total > 0" :page="pagination.page" :total="pagination.total" :page-size="pagination.page_size" :reset-page-on-page-size-change="false" @update:page="handlePageChange" @update:pageSize="handlePageSizeChange" />
        </template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Create/Edit Dialog -->
    <UiDialog
      :show="showEditDialog"
      :title="isEditing ? t('admin.announcements.editAnnouncement') : t('admin.announcements.createAnnouncement')"
      width="wide"
      :close-label="t('common.close')"
      @close="closeEdit"
    >
      <form id="announcement-form" @submit.prevent="handleSave">
        <AppStack :gap="16">
          <UiTextField v-model="form.title" :label="t('admin.announcements.form.title')" required />

        <UiTextArea v-model="form.content" :label="t('admin.announcements.form.content')" :rows="6" required />

        <AppGrid min="220px" :gap="12">
          <UiSelect v-model="form.status" :label="t('admin.announcements.form.status')" :options="statusOptions" />
          <UiSelect v-model="form.notify_mode" :label="t('admin.announcements.form.notifyMode')" :description="t('admin.announcements.form.notifyModeHint')" :options="notifyModeOptions" />
        </AppGrid>

        <AppGrid min="220px" :gap="12">
          <UiTextField v-model="form.starts_at_str" type="datetime-local" :label="t('admin.announcements.form.startsAt')" :description="t('admin.announcements.form.startsAtHint')" />
          <UiTextField v-model="form.ends_at_str" type="datetime-local" :label="t('admin.announcements.form.endsAt')" :description="t('admin.announcements.form.endsAtHint')" />
        </AppGrid>

          <AnnouncementTargetingEditor
            v-model="form.targeting"
            :groups="targetGroups"
          />
        </AppStack>
      </form>

      <template #footer>
        <AppInline justify="flex-end">
          <UiButton type="button" density="dense" @click="closeEdit">{{ t('common.cancel') }}</UiButton>
          <UiButton type="submit" form="announcement-form" density="dense" variant="primary" :loading="saving">{{ t('common.save') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Delete Confirmation -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.announcements.deleteAnnouncement')"
      :message="t('admin.announcements.deleteConfirm')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      danger
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Read Status Dialog -->
    <AnnouncementReadStatusDialog
      :show="showReadStatusDialog"
      :announcement-id="readStatusAnnouncementId"
      @close="showReadStatusDialog = false"
    />

    <UiAnnouncementDialog
      :show="Boolean(previewAnnouncement)"
      :title="previewAnnouncement?.title || t('announcements.title')"
      @close="previewAnnouncement = null"
    >
      <AnnouncementDetail v-if="previewAnnouncement" :announcement="previewAnnouncement" />
      <template #footer>
        <UiButton type="button" density="compact" variant="primary" @click="previewAnnouncement = null">
          <template #icon><Icon name="x" size="sm" /></template>
          {{ t('common.close') }}
        </UiButton>
      </template>
    </UiAnnouncementDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import { adminAPI } from '@/api/admin'
import { formatDateTime, formatDateTimeLocalInput, parseDateTimeLocalInput } from '@/utils/format'
import type { AdminGroup, Announcement, AnnouncementTargeting } from '@/types'
import type { Column } from '@/components/ui'

import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  AppInline,
  AppPage,
  AppPageHeader,
  AppStack,
  UiAnnouncementDialog,
  UiBadge,
  UiButton,
  UiButtonGroup,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiFilterBar,
  UiIconButton,
  UiMobileTableScroller,
  UiPagination,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiStatusBadge,
  UiTextArea,
  UiTextField,
} from '@/components/ui'

import AnnouncementTargetingEditor from '@/components/admin/announcements/AnnouncementTargetingEditor.vue'
import AnnouncementReadStatusDialog from '@/components/admin/announcements/AnnouncementReadStatusDialog.vue'
import AnnouncementDetail from '@/components/common/AnnouncementDetail.vue'

const { t } = useI18n()
const appStore = useAppStore()

const announcements = ref<Announcement[]>([])
const loading = ref(false)

const filters = reactive({
  status: '',
})
const searchQuery = ref('')

const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
  pages: 0
})

const sortState = reactive({
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc'
})

const statusFilterOptions = computed(() => [
  { value: '', label: t('admin.announcements.allStatus') },
  { value: 'draft', label: t('admin.announcements.statusLabels.draft') },
  { value: 'active', label: t('admin.announcements.statusLabels.active') },
  { value: 'archived', label: t('admin.announcements.statusLabels.archived') }
])

const statusOptions = computed(() => [
  { value: 'draft', label: t('admin.announcements.statusLabels.draft') },
  { value: 'active', label: t('admin.announcements.statusLabels.active') },
  { value: 'archived', label: t('admin.announcements.statusLabels.archived') }
])

const notifyModeOptions = computed(() => [
  { value: 'silent', label: t('admin.announcements.notifyModeLabels.silent') },
  { value: 'popup', label: t('admin.announcements.notifyModeLabels.popup') }
])

const columns = computed<Column[]>(() => [
  { key: 'title', label: t('admin.announcements.columns.title'), sortable: true },
  { key: 'status', label: t('admin.announcements.columns.status'), sortable: true },
  { key: 'notify_mode', label: t('admin.announcements.columns.notifyMode'), sortable: true },
  { key: 'targeting', label: t('admin.announcements.columns.targeting') },
  { key: 'timeRange', label: t('admin.announcements.columns.timeRange') },
  { key: 'created_at', label: t('admin.announcements.columns.createdAt'), sortable: true },
  { key: 'actions', label: t('admin.announcements.columns.actions') }
])

const statusLabel = (status: string) => {
  if (status === 'draft') return t('admin.announcements.statusLabels.draft')
  if (status === 'active') return t('admin.announcements.statusLabels.active')
  if (status === 'archived') return t('admin.announcements.statusLabels.archived')
  return status
}

const targetingSummary = (targeting: AnnouncementTargeting) => {
  const anyOf = targeting?.any_of ?? []
  if (!anyOf || anyOf.length === 0) return t('admin.announcements.targetingSummaryAll')
  return t('admin.announcements.targetingSummaryCustom', { groups: anyOf.length })
}

// ===== CRUD / list =====
let currentController: AbortController | null = null

async function loadAnnouncements() {
  currentController?.abort()
  const requestController = new AbortController()
  currentController = requestController
  const { signal } = requestController

  try {
    loading.value = true
    const res = await adminAPI.announcements.list(pagination.page, pagination.page_size, {
      status: filters.status || undefined,
      search: searchQuery.value || undefined,
      sort_by: sortState.sort_by,
      sort_order: sortState.sort_order
    }, { signal })

    if (signal.aborted || currentController !== requestController) return

    announcements.value = res.items
    pagination.total = res.total
    pagination.pages = res.pages
    pagination.page = res.page
    pagination.page_size = res.page_size
  } catch (error: any) {
    if (
      signal.aborted ||
      currentController !== requestController ||
      error?.name === 'AbortError' ||
      error?.code === 'ERR_CANCELED'
    ) {
      return
    }
    console.error('Error loading announcements:', error)
    appStore.showError(error.response?.data?.detail || t('admin.announcements.failedToLoad'))
  } finally {
    if (currentController === requestController) {
      loading.value = false
      currentController = null
    }
  }
}

function handlePageChange(page: number) {
  pagination.page = page
  loadAnnouncements()
}

function handlePageSizeChange(pageSize: number) {
  pagination.page_size = pageSize
  pagination.page = 1
  loadAnnouncements()
}

function handleStatusChange() {
  pagination.page = 1
  loadAnnouncements()
}

function clearFilters() {
  filters.status = ''
  pagination.page = 1
  loadAnnouncements()
}

function handleSort(key: string, order: 'asc' | 'desc') {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  loadAnnouncements()
}

function handleSearch() {
  pagination.page = 1
  loadAnnouncements()
}

// ===== Create/Edit dialog =====
const showEditDialog = ref(false)
const saving = ref(false)
const editingAnnouncement = ref<Announcement | null>(null)

const isEditing = computed(() => !!editingAnnouncement.value)

const form = reactive({
  title: '',
  content: '',
  status: 'draft',
  notify_mode: 'silent',
  starts_at_str: '',
  ends_at_str: '',
  targeting: { any_of: [] } as AnnouncementTargeting
})

const targetGroups = ref<AdminGroup[]>([])

async function loadTargetGroups() {
  try {
    const all = await adminAPI.groups.getAll()
    targetGroups.value = (all || []).filter(
      (group) => group.status === 'active' && group.subscription_type === 'standard'
    )
  } catch (error: any) {
    console.error('Error loading groups:', error)
    // not fatal
  }
}

function resetForm() {
  form.title = ''
  form.content = ''
  form.status = 'draft'
  form.notify_mode = 'silent'
  form.starts_at_str = ''
  form.ends_at_str = ''
  form.targeting = { any_of: [] }
}

function fillFormFromAnnouncement(a: Announcement) {
  form.title = a.title
  form.content = a.content
  form.status = a.status
  form.notify_mode = a.notify_mode || 'silent'

  // Backend returns RFC3339 strings
  form.starts_at_str = a.starts_at ? formatDateTimeLocalInput(Math.floor(new Date(a.starts_at).getTime() / 1000)) : ''
  form.ends_at_str = a.ends_at ? formatDateTimeLocalInput(Math.floor(new Date(a.ends_at).getTime() / 1000)) : ''

  form.targeting = a.targeting ?? { any_of: [] }
}

function openCreateDialog() {
  editingAnnouncement.value = null
  resetForm()
  showEditDialog.value = true
}

function openEditDialog(row: Announcement) {
  editingAnnouncement.value = row
  fillFormFromAnnouncement(row)
  showEditDialog.value = true
}

function closeEdit() {
  showEditDialog.value = false
  editingAnnouncement.value = null
}

function buildCreatePayload() {
  const startsAt = parseDateTimeLocalInput(form.starts_at_str)
  const endsAt = parseDateTimeLocalInput(form.ends_at_str)

  return {
    title: form.title,
    content: form.content,
    status: form.status as any,
    notify_mode: form.notify_mode as any,
    targeting: form.targeting,
    starts_at: startsAt ?? undefined,
    ends_at: endsAt ?? undefined
  }
}

function buildUpdatePayload(original: Announcement) {
  const payload: any = {}

  if (form.title !== original.title) payload.title = form.title
  if (form.content !== original.content) payload.content = form.content
  if (form.status !== original.status) payload.status = form.status
  if (form.notify_mode !== (original.notify_mode || 'silent')) payload.notify_mode = form.notify_mode

  // starts_at / ends_at: distinguish unchanged vs clear(0) vs set
  const originalStarts = original.starts_at ? Math.floor(new Date(original.starts_at).getTime() / 1000) : null
  const originalEnds = original.ends_at ? Math.floor(new Date(original.ends_at).getTime() / 1000) : null

  const newStarts = parseDateTimeLocalInput(form.starts_at_str)
  const newEnds = parseDateTimeLocalInput(form.ends_at_str)

  if (newStarts !== originalStarts) {
    payload.starts_at = newStarts === null ? 0 : newStarts
  }
  if (newEnds !== originalEnds) {
    payload.ends_at = newEnds === null ? 0 : newEnds
  }

  // targeting: do shallow compare by JSON
  if (JSON.stringify(form.targeting ?? {}) !== JSON.stringify(original.targeting ?? {})) {
    payload.targeting = form.targeting
  }

  return payload
}

async function handleSave() {
  // Frontend validation for targeting (to avoid ANNOUNCEMENT_INVALID_TARGET)
  const anyOf = form.targeting?.any_of ?? []
  if (anyOf.length > 50) {
    appStore.showError(t('admin.announcements.failedToCreate'))
    return
  }
  for (const g of anyOf) {
    const allOf = g?.all_of ?? []
    if (allOf.length > 50) {
      appStore.showError(t('admin.announcements.failedToCreate'))
      return
    }
  }

  saving.value = true
  try {
    if (!editingAnnouncement.value) {
      const payload = buildCreatePayload()
      await adminAPI.announcements.create(payload)
      appStore.showSuccess(t('common.success'))
      showEditDialog.value = false
      await loadAnnouncements()
      return
    }

    const original = editingAnnouncement.value
    const payload = buildUpdatePayload(original)
    await adminAPI.announcements.update(original.id, payload)
    appStore.showSuccess(t('common.success'))
    showEditDialog.value = false
    editingAnnouncement.value = null
    await loadAnnouncements()
  } catch (error: any) {
    console.error('Failed to save announcement:', error)
    appStore.showError(error.response?.data?.detail || (editingAnnouncement.value ? t('admin.announcements.failedToUpdate') : t('admin.announcements.failedToCreate')))
  } finally {
    saving.value = false
  }
}

// ===== Delete =====
const showDeleteDialog = ref(false)
const deletingAnnouncement = ref<Announcement | null>(null)

function handleDelete(row: Announcement) {
  deletingAnnouncement.value = row
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingAnnouncement.value) return

  try {
    await adminAPI.announcements.delete(deletingAnnouncement.value.id)
    appStore.showSuccess(t('common.success'))
    showDeleteDialog.value = false
    deletingAnnouncement.value = null
    await loadAnnouncements()
  } catch (error: any) {
    console.error('Failed to delete announcement:', error)
    appStore.showError(error.response?.data?.detail || t('admin.announcements.failedToDelete'))
  }
}

// ===== Read status =====
const showReadStatusDialog = ref(false)
const readStatusAnnouncementId = ref<number | null>(null)
const previewAnnouncement = ref<Announcement | null>(null)

function openPreview(row: Announcement) {
  previewAnnouncement.value = row
}

function openReadStatus(row: Announcement) {
  readStatusAnnouncementId.value = row.id
  showReadStatusDialog.value = true
}

onMounted(async () => {
  await loadTargetGroups()
  await loadAnnouncements()
})

onUnmounted(() => {
  currentController?.abort()
})
</script>
