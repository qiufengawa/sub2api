<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('admin.promo.title')" :description="t('admin.promo.description')">
        <template #actions>
          <UiButton density="dense" variant="primary" @click="showCreateDialog = true">
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('admin.promo.createCode') }}
          </UiButton>
        </template>
      </AppPageHeader>

      <UiServerTableWorkspace :loading="loading" :empty="false">
        <UiAlert
          v-if="loadError && codes.length"
          tone="danger"
          :message="t('admin.promo.failedToLoad')"
        />
        <template #toolbar>
          <UiFilterBar :active-count="filters.status ? 1 : 0" @clear="clearFilters">
            <UiSearchInput v-model="searchQuery" density="dense" :placeholder="t('admin.promo.searchCodes')" @search="handleSearch" />
            <UiSelect v-model="filters.status" density="dense" :options="filterStatusOptions" :aria-label="t('admin.promo.status')" @change="loadCodes" />
            <template #actions><UiIconButton icon="refresh" density="dense" :label="t('common.refresh')" :disabled="loading" @click="loadCodes" /></template>
          </UiFilterBar>
        </template>

        <UiMobileTableScroller :label="t('admin.promo.title')" min-width="880px">
          <UiDataTable :columns="columns" :data="codes" :loading="loading" :mobile-table="true" :aria-label="t('admin.promo.title')" :server-side-sort="true" default-sort-key="created_at" default-sort-order="desc" @sort="handleSort">
            <template #cell-code="{ value }"><AppInline :wrap="false"><UiDataCell :value="String(value)" mono /><UiIconButton :icon="copiedCode === value ? 'check' : 'copy'" density="mini" variant="ghost" :label="copiedCode === value ? t('admin.promo.copied') : t('keys.copyToClipboard')" @click="copyToClipboard(value)" /></AppInline></template>
            <template #cell-bonus_amount="{ value }"><UiDataCell :value="`$${value.toFixed(2)}`" mono /></template>
            <template #cell-usage="{ row }"><UiDataCell :value="`${row.used_count} / ${row.max_uses === 0 ? '∞' : row.max_uses}`" mono /></template>
            <template #cell-status="{ value, row }"><UiBadge :tone="getStatusTone(value, row)" :label="getStatusLabel(value, row)" /></template>
            <template #cell-expires_at="{ value }"><UiDataCell :value="value ? formatDateTime(value) : t('admin.promo.neverExpires')" /></template>
            <template #cell-created_at="{ value }"><UiDataCell :value="formatDateTime(value)" /></template>
            <template #cell-actions="{ row }"><UiButtonGroup :label="t('admin.promo.columns.actions')"><UiIconButton icon="link" density="dense" variant="ghost" :label="t('admin.promo.copyRegisterLink')" @click="copyRegisterLink(row)" /><UiIconButton icon="eye" density="dense" variant="ghost" :label="t('admin.promo.viewUsages')" @click="handleViewUsages(row)" /><UiIconButton icon="edit" density="dense" variant="ghost" :label="t('common.edit')" @click="handleEdit(row)" /><UiIconButton icon="trash" density="dense" variant="danger" :label="t('common.delete')" @click="handleDelete(row)" /></UiButtonGroup></template>
            <template #empty>
              <UiErrorState v-if="loadError" :title="t('admin.promo.failedToLoad')" :retry-text="t('common.retry')" @retry="loadCodes" />
              <UiEmptyState v-else :title="t('admin.promo.noCodesYet')" :description="t('admin.promo.createFirstCode')"><template #action><UiButton density="dense" variant="primary" @click="showCreateDialog = true">{{ t('admin.promo.createCode') }}</UiButton></template></UiEmptyState>
            </template>
          </UiDataTable>
        </UiMobileTableScroller>
        <template #pagination><UiPagination v-if="pagination.total > 0" :page="pagination.page" :total="pagination.total" :page-size="pagination.page_size" :reset-page-on-page-size-change="false" @update:page="handlePageChange" @update:pageSize="handlePageSizeChange" /></template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Create Dialog -->
    <UiDialog
      :show="showCreateDialog"
      :title="t('admin.promo.createCode')"
      width="normal"
      @close="showCreateDialog = false"
    >
      <form id="create-promo-form" @submit.prevent="handleCreate">
        <AppStack :gap="12">
          <UiTextField v-model="createForm.code" :label="t('admin.promo.code')" :description="t('admin.promo.autoGenerate')" :placeholder="t('admin.promo.codePlaceholder')" monospace />
          <UiTextField :model-value="createForm.bonus_amount" type="number" :label="t('admin.promo.bonusAmount')" min="0" step="0.01" required @update:model-value="createForm.bonus_amount = Number($event)" />
          <UiTextField :model-value="createForm.max_uses" type="number" :label="t('admin.promo.maxUses')" :description="t('admin.promo.zeroUnlimited')" min="0" @update:model-value="createForm.max_uses = Number($event)" />
          <UiTextField v-model="createForm.expires_at_str" type="datetime-local" :label="t('admin.promo.expiresAt')" :description="t('common.optional')" />
          <UiTextArea v-model="createForm.notes" :label="t('admin.promo.notes')" :description="t('common.optional')" :placeholder="t('admin.promo.notesPlaceholder')" :rows="2" />
        </AppStack>
      </form>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton type="button" density="dense" @click="showCreateDialog = false">{{ t('common.cancel') }}</UiButton>
          <UiButton type="submit" form="create-promo-form" density="dense" variant="primary" :loading="creating">{{ t('common.create') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Edit Dialog -->
    <UiDialog
      :show="showEditDialog"
      :title="t('admin.promo.editCode')"
      width="normal"
      @close="closeEditDialog"
    >
      <form id="edit-promo-form" @submit.prevent="handleUpdate">
        <AppStack :gap="12">
          <UiTextField v-model="editForm.code" :label="t('admin.promo.code')" monospace />
          <UiTextField :model-value="editForm.bonus_amount" type="number" :label="t('admin.promo.bonusAmount')" min="0" step="0.01" required @update:model-value="editForm.bonus_amount = Number($event)" />
          <UiTextField :model-value="editForm.max_uses" type="number" :label="t('admin.promo.maxUses')" :description="t('admin.promo.zeroUnlimited')" min="0" @update:model-value="editForm.max_uses = Number($event)" />
          <UiSelect v-model="editForm.status" :label="t('admin.promo.status')" :options="statusOptions" />
          <UiTextField v-model="editForm.expires_at_str" type="datetime-local" :label="t('admin.promo.expiresAt')" :description="t('common.optional')" />
          <UiTextArea v-model="editForm.notes" :label="t('admin.promo.notes')" :description="t('common.optional')" :rows="2" />
        </AppStack>
      </form>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton type="button" density="dense" @click="closeEditDialog">{{ t('common.cancel') }}</UiButton>
          <UiButton type="submit" form="edit-promo-form" density="dense" variant="primary" :loading="updating">{{ t('common.save') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Usages Dialog -->
    <UiDialog
      :show="showUsagesDialog"
      :title="t('admin.promo.usageRecords')"
      width="wide"
      @close="closeUsagesDialog"
    >
      <AppStack :gap="12">
        <UiMobileTableScroller :label="t('admin.promo.usageRecords')" min-width="520px">
          <UiDataTable :columns="usageColumns" :data="usages" :loading="usagesLoading" :mobile-table="true" :aria-label="t('admin.promo.usageRecords')">
            <template #cell-user="{ row }"><UiDataCell :value="row.user?.email || t('admin.promo.userPrefix', { id: row.user_id })" :meta="formatDateTime(row.used_at)" /></template>
            <template #cell-bonus_amount="{ value }"><UiBadge tone="success" :label="`+$${value.toFixed(2)}`" /></template>
            <template #empty><UiErrorState v-if="usagesError" :title="t('admin.promo.failedToLoadUsages')" :retry-text="t('common.retry')" @retry="loadUsages" /><UiEmptyState v-else :title="t('admin.promo.noUsages')" /></template>
          </UiDataTable>
        </UiMobileTableScroller>
        <UiPagination
          v-if="usagesTotal > usagesPageSize"
          :page="usagesPage"
          :total="usagesTotal"
          :page-size="usagesPageSize"
          :reset-page-on-page-size-change="false"
          @update:page="handleUsagesPageChange"
          @update:page-size="handleUsagesPageSizeChange"
        />
      </AppStack>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton type="button" density="dense" @click="closeUsagesDialog">{{ t('common.close') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Delete Confirmation Dialog -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.promo.deleteCode')"
      :message="t('admin.promo.deleteCodeConfirm')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :pending="deleting"
      danger
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import { adminAPI } from '@/api/admin'
import { formatDateTime, formatDateTimeLocalInput } from '@/utils/format'
import type { PromoCode, PromoCodeUsage } from '@/types'
import type { Column } from '@/components/ui'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppInline,
  AppPage,
  AppPageHeader,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiButtonGroup,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiMobileTableScroller,
  UiPagination,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiTextArea,
  UiTextField,
} from '@/components/ui'

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard: clipboardCopy } = useClipboard()

// State
const codes = ref<PromoCode[]>([])
const loading = ref(true)
const loadError = ref(false)
const creating = ref(false)
const updating = ref(false)
const deleting = ref(false)
const searchQuery = ref('')
const copiedCode = ref<string | null>(null)

const filters = reactive({
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0
})
const sortState = reactive({
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc'
})

// Dialogs
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const showUsagesDialog = ref(false)

const editingCode = ref<PromoCode | null>(null)
const deletingCode = ref<PromoCode | null>(null)

// Usages
const usages = ref<PromoCodeUsage[]>([])
const usagesLoading = ref(false)
const usagesError = ref(false)
const currentViewingCode = ref<PromoCode | null>(null)
const usagesPage = ref(1)
const usagesPageSize = ref(20)
const usagesTotal = ref(0)

// Forms
const createForm = reactive({
  code: '',
  bonus_amount: 1,
  max_uses: 0,
  expires_at_str: '',
  notes: ''
})

const editForm = reactive({
  code: '',
  bonus_amount: 0,
  max_uses: 0,
  status: 'active' as 'active' | 'disabled',
  expires_at_str: '',
  notes: ''
})

// Options
const filterStatusOptions = computed(() => [
  { value: '', label: t('admin.promo.allStatus') },
  { value: 'active', label: t('admin.promo.statusActive') },
  { value: 'disabled', label: t('admin.promo.statusDisabled') }
])

const statusOptions = computed(() => [
  { value: 'active', label: t('admin.promo.statusActive') },
  { value: 'disabled', label: t('admin.promo.statusDisabled') }
])

const columns = computed<Column[]>(() => [
  { key: 'code', label: t('admin.promo.columns.code') },
  { key: 'bonus_amount', label: t('admin.promo.columns.bonusAmount'), sortable: true },
  { key: 'usage', label: t('admin.promo.columns.usage') },
  { key: 'status', label: t('admin.promo.columns.status'), sortable: true },
  { key: 'expires_at', label: t('admin.promo.columns.expiresAt'), sortable: true },
  { key: 'created_at', label: t('admin.promo.columns.createdAt'), sortable: true },
  { key: 'actions', label: t('admin.promo.columns.actions') }
])

const usageColumns = computed<Column[]>(() => [
  { key: 'user', label: t('admin.promo.usageColumns.user') },
  { key: 'bonus_amount', label: t('admin.promo.usageColumns.bonusAmount'), align: 'right' }
])

// Helpers
const getStatusLabel = (status: string, row: PromoCode) => {
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return t('admin.promo.statusExpired')
  }
  if (row.max_uses > 0 && row.used_count >= row.max_uses) {
    return t('admin.promo.statusMaxUsed')
  }
  return status === 'active' ? t('admin.promo.statusActive') : t('admin.promo.statusDisabled')
}

const getStatusTone = (status: string, row: PromoCode): 'neutral' | 'success' | 'warning' | 'danger' => {
  if (row.expires_at && new Date(row.expires_at) < new Date()) return 'danger'
  if (row.max_uses > 0 && row.used_count >= row.max_uses) return 'neutral'
  return status === 'active' ? 'success' : 'neutral'
}

// API calls
let abortController: AbortController | null = null

const loadCodes = async () => {
  if (abortController) {
    abortController.abort()
  }
  const currentController = new AbortController()
  abortController = currentController
  loading.value = true
  loadError.value = false

  try {
    const response = await adminAPI.promo.list(
      pagination.page,
      pagination.page_size,
      {
        status: filters.status || undefined,
        search: searchQuery.value || undefined,
        sort_by: sortState.sort_by,
        sort_order: sortState.sort_order
      },
      { signal: currentController.signal }
    )
    if (currentController.signal.aborted || abortController !== currentController) return

    codes.value = response.items
    pagination.total = response.total
    loadError.value = false
  } catch (error: any) {
    if (
      currentController.signal.aborted ||
      abortController !== currentController ||
      error?.name === 'AbortError' ||
      error?.code === 'ERR_CANCELED'
    ) {
      return
    }
    loadError.value = true
    appStore.showError(t('admin.promo.failedToLoad'))
  } finally {
    if (abortController === currentController) {
      loading.value = false
      abortController = null
    }
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadCodes()
}

const clearFilters = () => {
  filters.status = ''
  pagination.page = 1
  loadCodes()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadCodes()
}

const handlePageSizeChange = (pageSize: number) => {
  pagination.page_size = pageSize
  pagination.page = 1
  loadCodes()
}

const handleSort = (key: string, order: 'asc' | 'desc') => {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  loadCodes()
}

const copyToClipboard = async (text: string) => {
  const success = await clipboardCopy(text, t('admin.promo.copied'))
  if (success) {
    copiedCode.value = text
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      copiedCode.value = null
      copyResetTimer = null
    }, 2000)
  }
}

// Create
const handleCreate = async () => {
  if (creating.value) return
  creating.value = true
  try {
    await adminAPI.promo.create({
      code: createForm.code || undefined,
      bonus_amount: createForm.bonus_amount,
      max_uses: createForm.max_uses,
      expires_at: createForm.expires_at_str ? Math.floor(new Date(createForm.expires_at_str).getTime() / 1000) : undefined,
      notes: createForm.notes || undefined
    })
    appStore.showSuccess(t('admin.promo.codeCreated'))
    showCreateDialog.value = false
    resetCreateForm()
    loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.promo.failedToCreate'))
  } finally {
    creating.value = false
  }
}

const resetCreateForm = () => {
  createForm.code = ''
  createForm.bonus_amount = 1
  createForm.max_uses = 0
  createForm.expires_at_str = ''
  createForm.notes = ''
}

// Edit
const handleEdit = (code: PromoCode) => {
  editingCode.value = code
  editForm.code = code.code
  editForm.bonus_amount = code.bonus_amount
  editForm.max_uses = code.max_uses
  editForm.status = code.status
  editForm.expires_at_str = code.expires_at
    ? formatDateTimeLocalInput(Math.floor(new Date(code.expires_at).getTime() / 1000))
    : ''
  editForm.notes = code.notes || ''
  showEditDialog.value = true
}

const closeEditDialog = () => {
  showEditDialog.value = false
  editingCode.value = null
}

const handleUpdate = async () => {
  if (!editingCode.value || updating.value) return

  updating.value = true
  try {
    await adminAPI.promo.update(editingCode.value.id, {
      code: editForm.code,
      bonus_amount: editForm.bonus_amount,
      max_uses: editForm.max_uses,
      status: editForm.status,
      expires_at: editForm.expires_at_str ? Math.floor(new Date(editForm.expires_at_str).getTime() / 1000) : 0,
      notes: editForm.notes
    })
    appStore.showSuccess(t('admin.promo.codeUpdated'))
    closeEditDialog()
    loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.promo.failedToUpdate'))
  } finally {
    updating.value = false
  }
}

// Copy Register Link
const copyRegisterLink = async (code: PromoCode) => {
  const baseUrl = window.location.origin
  const registerLink = `${baseUrl}/register?promo=${encodeURIComponent(code.code)}`

  try {
    await navigator.clipboard.writeText(registerLink)
    appStore.showSuccess(t('admin.promo.registerLinkCopied'))
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = registerLink
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    appStore.showSuccess(t('admin.promo.registerLinkCopied'))
  }
}

// Delete
const handleDelete = (code: PromoCode) => {
  deletingCode.value = code
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (!deletingCode.value || deleting.value) return

  deleting.value = true
  try {
    await adminAPI.promo.delete(deletingCode.value.id)
    appStore.showSuccess(t('admin.promo.codeDeleted'))
    showDeleteDialog.value = false
    deletingCode.value = null
    await loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.promo.failedToDelete'))
  } finally {
    deleting.value = false
  }
}

// View Usages
const handleViewUsages = async (code: PromoCode) => {
  currentViewingCode.value = code
  showUsagesDialog.value = true
  usagesPage.value = 1
  await loadUsages()
}

let usagesRequestId = 0
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

const loadUsages = async () => {
  if (!currentViewingCode.value) return
  const requestId = ++usagesRequestId
  const codeId = currentViewingCode.value.id
  usagesLoading.value = true
  usagesError.value = false

  try {
    const response = await adminAPI.promo.getUsages(
      codeId,
      usagesPage.value,
      usagesPageSize.value
    )
    if (requestId !== usagesRequestId || currentViewingCode.value?.id !== codeId) return
    usages.value = response.items
    usagesTotal.value = response.total
  } catch (error: any) {
    if (requestId !== usagesRequestId || currentViewingCode.value?.id !== codeId) return
    usagesError.value = true
    appStore.showError(error.response?.data?.detail || t('admin.promo.failedToLoadUsages'))
  } finally {
    if (requestId === usagesRequestId) usagesLoading.value = false
  }
}

const handleUsagesPageChange = (page: number) => {
  usagesPage.value = page
  loadUsages()
}

const handleUsagesPageSizeChange = (pageSize: number) => {
  usagesPageSize.value = pageSize
  usagesPage.value = 1
  loadUsages()
}

const closeUsagesDialog = () => {
  usagesRequestId += 1
  usagesLoading.value = false
  showUsagesDialog.value = false
  currentViewingCode.value = null
}

onMounted(() => {
  loadCodes()
})

onUnmounted(() => {
  abortController?.abort()
  usagesRequestId += 1
  if (copyResetTimer) clearTimeout(copyResetTimer)
})
</script>
