<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('admin.redeem.title')" :description="t('admin.redeem.description')" />
      <UiServerTableWorkspace :loading="loading">
      <UiAlert
        v-if="loadError && codes.length"
        tone="danger"
        :message="t('admin.redeem.failedToLoad')"
      />
      <template #filters>
        <UiFilterBar :active-count="activeFilterCount" @clear="clearFilters">
          <UiSearchInput
            v-model="searchQuery"
            density="compact"
            :debounce-ms="0"
            :placeholder="t('admin.redeem.searchCodes')"
            @search="handleSearch"
          />
          <UiSelect
            v-model="filters.type"
            :options="filterTypeOptions"
            density="compact"
            @change="applyFilters"
          />
          <UiSelect
            v-model="filters.status"
            :options="filterStatusOptions"
            density="compact"
            @change="applyFilters"
          />
          <template #actions>
            <AppInline>
            <UiIconButton
              icon="refresh"
              @click="loadCodes"
              :disabled="loading"
              :label="t('common.refresh')"
              density="compact"
            />
            <UiButton density="compact" :loading="exporting" :disabled="exporting" @click="handleExportCodes">
              <template #icon><Icon name="download" size="sm" /></template>
              {{ t('admin.redeem.exportCsv') }}
            </UiButton>
            <UiButton
              v-if="selectedCount > 0"
              data-test="batch-update-open"
              :disabled="selectedCount === 0 || batchUpdating"
              density="compact"
              @click="openBatchUpdateDialog"
            >
              <template #icon><Icon name="edit" size="sm" /></template>
              {{ t('admin.redeem.batchUpdate') }}
            </UiButton>
            <UiButton density="compact" variant="primary" @click="showGenerateDialog = true">
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('admin.redeem.generateCodes') }}
            </UiButton>
            </AppInline>
          </template>
        </UiFilterBar>
      </template>

        <UiMobileTableScroller :label="t('admin.redeem.title')" min-width="980px">
          <UiDataTable
          :columns="columns"
          :data="codes"
          :loading="loading"
          :server-side-sort="true"
          default-sort-key="id"
          default-sort-order="desc"
          @sort="handleSort"
        >
          <template #header-select>
            <UiCheckbox
              data-test="select-all-codes"
              :model-value="allVisibleSelected"
              :label="t('common.selectAll')"
              @update:model-value="toggleSelectAllVisible"
            />
          </template>

          <template #cell-select="{ row }">
            <UiCheckbox
              data-test="select-code"
              :model-value="selectedCodeIds.has(row.id)"
              :label="t('admin.redeem.selectCode', { code: row.code })"
              @update:model-value="toggleSelectRow(row, $event)"
            />
          </template>

          <template #cell-code="{ value }">
            <AppInline :wrap="false">
              <UiDataCell :value="String(value)" mono />
              <UiIconButton
                variant="ghost"
                density="mini"
                :label="copiedCode === value ? t('admin.redeem.copied') : t('keys.copyToClipboard')"
                @click="copyToClipboard(value)"
              >
                <Icon v-if="copiedCode !== value" name="copy" size="sm" :stroke-width="2" />
                <Icon v-else name="check" size="sm" :stroke-width="2" />
              </UiIconButton>
            </AppInline>
          </template>

          <template #cell-type="{ value }">
            <UiBadge :tone="redeemTypeTone(value)">
              {{ t('admin.redeem.types.' + value) }}
            </UiBadge>
          </template>

          <template #cell-value="{ value, row }">
            <UiDataCell
              v-if="row.type === 'balance'"
              :value="`$${value.toFixed(2)}`"
              mono
            />
            <UiDataCell
              v-else-if="row.type === 'subscription'"
              :value="`${row.validity_days || 30} ${t('admin.redeem.days')}`"
              :meta="row.plan_name || undefined"
            />
            <UiDataCell v-else :value="String(value)" />
          </template>

          <template #cell-status="{ value }">
            <UiStatusBadge :status="redeemStatusTone(value)" :label="t('admin.redeem.status.' + value)" />
          </template>

          <template #cell-used_by="{ value, row }">
            <UiDataCell :value="row.user?.email || (value ? t('admin.redeem.userPrefix', { id: value }) : '-')" />
          </template>

          <template #cell-used_at="{ value }">
            <UiDataCell :value="value ? formatDateTime(value) : '-'" />
          </template>

          <template #cell-expires_at="{ value, row }">
            <UiStatusBadge
              v-if="row.status === 'expired'"
              status="danger"
              :label="value ? formatDateTime(value) : t('admin.redeem.neverExpires')"
            />
            <UiDataCell v-else :value="value ? formatDateTime(value) : t('admin.redeem.neverExpires')" />
          </template>

          <template #cell-actions="{ row }">
            <UiButtonGroup :label="t('admin.redeem.columns.actions')">
              <UiIconButton v-if="row.status === 'unused'" icon="trash" variant="danger" density="compact" :label="t('common.delete')" @click="handleDelete(row)" />
            </UiButtonGroup>
          </template>
          <template #empty>
            <UiErrorState
              v-if="loadError"
              :title="t('admin.redeem.failedToLoad')"
              :retry-text="t('common.retry')"
              @retry="loadCodes"
            />
            <UiEmptyState
              v-else
              :title="t('admin.redeem.noCodes')"
              :description="t('admin.redeem.noCodesDescription')"
            />
          </template>
          </UiDataTable>
        </UiMobileTableScroller>

      <template #pagination>
        <UiBulkActionBar
          :selected-count="selectedCount"
          :all-selected="allVisibleSelected"
          :selection-label="t('admin.redeem.selectedCount', { count: selectedCount })"
          :clear-label="t('admin.redeem.clearSelection')"
          @clear="clearSelectedCodes"
          @toggle-all="toggleSelectAllVisible"
        >
          <UiButton density="dense" variant="primary" @click="openBatchUpdateDialog">
            {{ t('admin.redeem.batchUpdate') }}
          </UiButton>
        </UiBulkActionBar>

        <UiPagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          :summary-label="t('pagination.showing')"
          :page-size-label="t('pagination.perPage')"
          :previous-label="t('pagination.previous')"
          :next-label="t('pagination.next')"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />

        <!-- Batch Actions -->
        <AppInline v-if="filters.status === 'unused'" justify="flex-end">
          <UiButton density="compact" variant="danger" @click="showDeleteUnusedDialog = true">
            {{ t('admin.redeem.deleteAllUnused') }}
          </UiButton>
        </AppInline>
      </template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Delete Confirmation Dialog -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.redeem.deleteCode')"
      :message="t('admin.redeem.deleteCodeConfirm')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :pending="deleting"
      danger
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Delete Unused Codes Dialog -->
    <UiConfirmDialog
      :show="showDeleteUnusedDialog"
      :title="t('admin.redeem.deleteAllUnused')"
      :message="t('admin.redeem.deleteAllUnusedConfirm')"
      :confirm-text="t('admin.redeem.deleteAll')"
      :cancel-text="t('common.cancel')"
      :pending="deletingUnused"
      danger
      @confirm="confirmDeleteUnused"
      @cancel="showDeleteUnusedDialog = false"
    />

    <!-- Generate Codes Dialog -->
    <UiDialog
      :show="showGenerateDialog"
      :title="t('admin.redeem.generateCodesTitle')"
      width="normal"
      @close="showGenerateDialog = false"
    >
      <form id="generate-redeem-form" @submit.prevent="handleGenerateCodes">
        <AppStack :gap="12">
            <UiSelect v-model="generateForm.type" :options="typeOptions" density="compact" :label="t('admin.redeem.codeType')" />
            <!-- 余额/并发类型：显示数值输入 -->
            <UiTextField
              v-if="generateForm.type !== 'subscription' && generateForm.type !== 'invitation'"
              v-model.number="generateForm.value"
              type="number"
              density="compact"
              :label="
                  generateForm.type === 'balance'
                    ? t('admin.redeem.amount')
                    : t('admin.redeem.columns.value')
              "
              :step="generateForm.type === 'balance' ? '0.01' : '1'"
              :min="generateForm.type === 'balance' ? '0.01' : '1'"
              required
            />
            <!-- 邀请码类型：显示提示信息 -->
            <UiAlert v-if="generateForm.type === 'invitation'" :message="t('admin.redeem.invitationHint')" />
            <!-- Subscription codes bind to a plan; routing groups remain plan metadata. -->
            <template v-if="generateForm.type === 'subscription'">
              <UiSelect
                  v-model="generateForm.plan_id"
                  :options="planOptions"
                  density="compact"
                  :label="t('admin.redeem.selectPlan')"
                  :placeholder="t('admin.redeem.selectPlanPlaceholder')"
                >
                  <template #selected="{ option }">
                    <UiDataCell v-if="option" :value="(option as unknown as PlanOption).label" />
                    <span v-else>{{ t('admin.redeem.selectPlanPlaceholder') }}</span>
                  </template>
                  <template #option="{ option }">
                    <UiDataCell :value="(option as unknown as PlanOption).label" :meta="(option as unknown as PlanOption).groupSummary" />
                  </template>
                </UiSelect>
              <UiTextField v-model.number="generateForm.validity_days" type="number" min="1" max="365" required density="compact" :label="t('admin.redeem.validityDays')" />
            </template>
            <AppStack :gap="8">
              <UiSegmentedControl
                :model-value="generateForm.expiry_option"
                :options="redeemCodeExpiryOptions"
                :label="t('admin.redeem.codeExpiry')"
                @update:model-value="setExpiryOption"
              />
              <UiTextField
                v-if="generateForm.expiry_option === 'custom'"
                v-model.number="generateForm.custom_expiry_days"
                type="number"
                min="1"
                max="3650"
                required
                density="compact"
                :placeholder="t('admin.redeem.customExpiryDays')"
              />
            </AppStack>
            <UiTextField v-model.number="generateForm.count" type="number" min="1" max="100" required density="compact" :label="t('admin.redeem.count')" />
        </AppStack>
      </form>
      <template #footer>
            <AppInline justify="flex-end">
              <UiButton density="compact" @click="showGenerateDialog = false">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton type="submit" form="generate-redeem-form" density="compact" variant="primary" :loading="generating" :disabled="generating">
                {{ generating ? t('admin.redeem.generating') : t('admin.redeem.generate') }}
              </UiButton>
            </AppInline>
      </template>
    </UiDialog>

    <!-- Batch Update Dialog -->
    <UiDialog
      :show="showBatchUpdateDialog"
      :title="t('admin.redeem.batchUpdateTitle')"
      width="normal"
      @close="closeBatchUpdateDialog"
    >
      <AppStack :gap="12">
          <UiAlert :message="t('admin.redeem.selectedCount', { count: selectedCount })" />

          <form id="batch-update-redeem-form" data-test="batch-update-form" @submit.prevent="handleBatchUpdate">
            <AppStack :gap="12">
            <AppStack :gap="8">
              <UiCheckbox data-test="batch-field-status" v-model="batchUpdateForm.update_status" :label="t('admin.redeem.batchFields.status')" />
              <UiSelect
                v-if="batchUpdateForm.update_status"
                v-model="batchUpdateForm.status"
                data-test="batch-status-select"
                :options="batchStatusOptions"
                density="compact"
              />
            </AppStack>

            <AppStack :gap="8">
              <UiCheckbox v-model="batchUpdateForm.update_expires_at" :label="t('admin.redeem.batchFields.expiresAt')" />
              <template v-if="batchUpdateForm.update_expires_at">
                <UiSelect v-model="batchUpdateForm.expires_mode" :options="batchExpiryModeOptions" density="compact" />
                <UiTextField
                  v-if="batchUpdateForm.expires_mode === 'custom'"
                  v-model="batchUpdateForm.expires_at_local"
                  type="datetime-local"
                  density="compact"
                />
              </template>
            </AppStack>

            <AppStack :gap="8">
              <UiCheckbox data-test="batch-field-notes" v-model="batchUpdateForm.update_notes" :label="t('admin.redeem.batchFields.notes')" />
              <UiTextArea
                v-if="batchUpdateForm.update_notes"
                data-test="batch-notes-input"
                v-model="batchUpdateForm.notes"
                :rows="3"
                :placeholder="t('admin.redeem.batchNotesPlaceholder')"
              />
            </AppStack>

            <AppStack v-if="selectedCodesAreSubscription" :gap="8">
              <UiCheckbox v-model="batchUpdateForm.update_plan_id" :label="t('admin.redeem.batchFields.plan')" />
              <UiSelect
                v-if="batchUpdateForm.update_plan_id"
                v-model="batchUpdateForm.plan_id"
                :options="planOptions"
                density="compact"
                :placeholder="t('admin.redeem.selectPlanPlaceholder')"
              />
            </AppStack>
            </AppStack>
          </form>
      </AppStack>
      <template #footer>
            <AppInline justify="flex-end">
              <UiButton density="compact" @click="closeBatchUpdateDialog">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                data-test="batch-update-submit"
                type="submit"
                form="batch-update-redeem-form"
                density="compact"
                variant="primary"
                :loading="batchUpdating"
                :disabled="batchUpdating"
              >
                {{ batchUpdating ? t('common.submitting') : t('admin.redeem.batchUpdate') }}
              </UiButton>
            </AppInline>
      </template>
    </UiDialog>

    <!-- Generated Codes Result Dialog -->
    <UiDialog
      :show="showResultDialog"
      :title="t('admin.redeem.generatedSuccessfully')"
      width="normal"
      @close="closeResultDialog"
    >
      <AppStack :gap="12">
        <UiAlert tone="success" :message="t('admin.redeem.codesCreated', { count: generatedCodes.length })" />
        <UiTextArea :model-value="generatedCodesText" :rows="Math.min(Math.max(generatedCodes.length, 3), 10)" readonly monospace />
      </AppStack>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton density="compact" @click="copyGeneratedCodes">
            <template #icon><Icon :name="copiedAll ? 'check' : 'copy'" size="sm" /></template>
            {{ copiedAll ? t('admin.redeem.copied') : t('admin.redeem.copyAll') }}
          </UiButton>
          <UiButton density="compact" variant="primary" @click="downloadGeneratedCodes">
            <template #icon><Icon name="download" size="sm" /></template>
            {{ t('admin.redeem.download') }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { useTableSelection } from '@/composables/useTableSelection'
import { getPersistedPageSize, setPersistedPageSize } from '@/composables/usePersistedPageSize'
import { adminAPI } from '@/api/admin'
import { formatDateTime } from '@/utils/format'
import type {
  RedeemCode,
  RedeemCodeType,
  BatchUpdateRedeemCodeFields
} from '@/types'
import type { SubscriptionPlan } from '@/types/payment'
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
  UiBulkActionBar,
  UiCheckbox,
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
  UiSegmentedControl,
  UiSelect,
  UiServerTableWorkspace,
  UiStatusBadge,
  UiButtonGroup,
  UiTextArea,
  UiTextField
} from '@/components/ui'

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard: clipboardCopy } = useClipboard()

interface PlanOption {
  value: number
  label: string
  groupSummary: string
  [key: string]: unknown
}

const showGenerateDialog = ref(false)
const showResultDialog = ref(false)
const generatedCodes = ref<RedeemCode[]>([])
const subscriptionPlans = ref<SubscriptionPlan[]>([])

const planOptions = computed<PlanOption[]>(() =>
  subscriptionPlans.value.map((plan) => ({
    value: plan.id,
    label: plan.name,
    groupSummary: plan.included_groups.length > 0
      ? plan.included_groups.map((group) => group.name).join(' / ')
      : t('admin.redeem.noIncludedGroups')
  }))
)

const generatedCodesText = computed(() => {
  return generatedCodes.value.map((code) => code.code).join('\n')
})

const copiedAll = ref(false)
let copyAllResetTimer: ReturnType<typeof setTimeout> | null = null
let copyCodeResetTimer: ReturnType<typeof setTimeout> | null = null

const closeResultDialog = () => {
  showResultDialog.value = false
  generatedCodes.value = []
  copiedAll.value = false
}

const copyGeneratedCodes = async () => {
  const success = await clipboardCopy(generatedCodesText.value, t('admin.redeem.copied'))
  if (success) {
    copiedAll.value = true
    if (copyAllResetTimer) clearTimeout(copyAllResetTimer)
    copyAllResetTimer = setTimeout(() => {
      copiedAll.value = false
      copyAllResetTimer = null
    }, 2000)
  }
}

const downloadGeneratedCodes = () => {
  const blob = new Blob([generatedCodesText.value], { type: 'text/plain' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `redeem-codes-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const columns = computed<Column[]>(() => [
  { key: 'select', label: '' },
  { key: 'code', label: t('admin.redeem.columns.code') },
  { key: 'type', label: t('admin.redeem.columns.type'), sortable: true },
  { key: 'value', label: t('admin.redeem.columns.value'), sortable: true },
  { key: 'status', label: t('admin.redeem.columns.status'), sortable: true },
  { key: 'used_by', label: t('admin.redeem.columns.usedBy') },
  { key: 'used_at', label: t('admin.redeem.columns.usedAt'), sortable: true },
  { key: 'expires_at', label: t('admin.redeem.columns.expiresAt'), sortable: true },
  { key: 'actions', label: t('admin.redeem.columns.actions') }
])

const redeemTypeTone = (type: RedeemCodeType): 'neutral' | 'success' | 'warning' | 'info' => {
  if (type === 'balance') return 'success'
  if (type === 'subscription') return 'warning'
  if (type === 'concurrency') return 'info'
  return 'neutral'
}

const redeemStatusTone = (status: string): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'unused' || status === 'active') return 'success'
  if (status === 'used') return 'neutral'
  if (status === 'disabled') return 'warning'
  return 'danger'
}

const typeOptions = computed(() => [
  { value: 'balance', label: t('admin.redeem.balance') },
  { value: 'concurrency', label: t('admin.redeem.concurrency') },
  { value: 'subscription', label: t('admin.redeem.subscription') },
  { value: 'invitation', label: t('admin.redeem.invitation') }
])

const filterTypeOptions = computed(() => [
  { value: '', label: t('admin.redeem.allTypes') },
  { value: 'balance', label: t('admin.redeem.balance') },
  { value: 'concurrency', label: t('admin.redeem.concurrency') },
  { value: 'subscription', label: t('admin.redeem.subscription') },
  { value: 'invitation', label: t('admin.redeem.invitation') }
])

const filterStatusOptions = computed(() => [
  { value: '', label: t('admin.redeem.allStatus') },
  { value: 'active', label: t('admin.redeem.status.active') },
  { value: 'unused', label: t('admin.redeem.unused') },
  { value: 'used', label: t('admin.redeem.used') },
  { value: 'expired', label: t('admin.redeem.status.expired') },
  { value: 'disabled', label: t('admin.redeem.status.disabled') }
])

const activeFilterCount = computed(() => Number(Boolean(filters.type)) + Number(Boolean(filters.status)))

const batchStatusOptions = computed(() => [
  { value: 'unused', label: t('admin.redeem.status.unused') },
  { value: 'disabled', label: t('admin.redeem.status.disabled') }
])

const batchExpiryModeOptions = computed(() => [
  { value: 'clear', label: t('admin.redeem.neverExpires') },
  { value: 'custom', label: t('admin.redeem.customExpiry') }
])

const codes = ref<RedeemCode[]>([])
const loading = ref(true)
const loadError = ref(false)
const generating = ref(false)
const batchUpdating = ref(false)
const deleting = ref(false)
const deletingUnused = ref(false)
const exporting = ref(false)
const searchQuery = ref('')
const filters = reactive({
  type: '',
  status: ''
})
const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
  pages: 0
})
const sortState = reactive({
  sort_by: 'id',
  sort_order: 'desc' as 'asc' | 'desc'
})

let abortController: AbortController | null = null

const showDeleteDialog = ref(false)
const showDeleteUnusedDialog = ref(false)
const showBatchUpdateDialog = ref(false)
const deletingCode = ref<RedeemCode | null>(null)
const copiedCode = ref<string | null>(null)

const {
  selectedSet: selectedCodeIds,
  selectedCount,
  allVisibleSelected,
  select,
  deselect,
  clear: clearSelection,
  toggleVisible
} = useTableSelection<RedeemCode>({
  rows: codes,
  getId: (code) => code.id
})
const selectedCodeTypes = reactive(new Map<number, RedeemCodeType>())

const clearSelectedCodes = () => {
  clearSelection()
  selectedCodeTypes.clear()
}

const selectedCodesAreSubscription = computed(() => {
  if (selectedCodeIds.value.size === 0) return false
  return Array.from(selectedCodeIds.value).every(
    (id) => selectedCodeTypes.get(id) === 'subscription'
  )
})

const batchUpdateForm = reactive({
  update_status: false,
  status: 'disabled' as 'unused' | 'disabled',
  update_expires_at: false,
  expires_mode: 'clear' as 'clear' | 'custom',
  expires_at_local: '',
  update_notes: false,
  notes: '',
  update_plan_id: false,
  plan_id: null as number | null
})

type RedeemCodeExpiryOption = 'never' | '1' | '3' | '7' | 'custom'

const redeemCodeExpiryOptions = computed<{ value: RedeemCodeExpiryOption; label: string }[]>(() => [
  { value: 'never', label: t('admin.redeem.neverExpires') },
  { value: '1', label: t('admin.redeem.expiryPresetDays', { days: 1 }) },
  { value: '3', label: t('admin.redeem.expiryPresetDays', { days: 3 }) },
  { value: '7', label: t('admin.redeem.expiryPresetDays', { days: 7 }) },
  { value: 'custom', label: t('admin.redeem.customExpiry') }
])

const setExpiryOption = (value: string | number) => {
  if (['never', '1', '3', '7', 'custom'].includes(String(value))) {
    generateForm.expiry_option = String(value) as RedeemCodeExpiryOption
  }
}

const generateForm = reactive({
  type: 'balance' as RedeemCodeType,
  value: 10,
  count: 1,
  plan_id: null as number | null,
  validity_days: 30,
  expiry_option: 'never' as RedeemCodeExpiryOption,
  custom_expiry_days: 7
})

// 监听类型变化，邀请码类型时自动设置 value 为 0
watch(
  () => generateForm.type,
  (newType) => {
    if (newType === 'invitation') {
      generateForm.value = 0
    } else if (generateForm.value === 0) {
      generateForm.value = 10
    }
  }
)

const buildRedeemQueryFilters = () => ({
  type: (filters.type || undefined) as RedeemCodeType | undefined,
  status: (filters.status || undefined) as 'active' | 'used' | 'expired' | 'unused' | 'disabled' | undefined,
  search: searchQuery.value.trim() || undefined,
  sort_by: sortState.sort_by,
  sort_order: sortState.sort_order
})

const loadCodes = async () => {
  if (abortController) {
    abortController.abort()
  }
  const currentController = new AbortController()
  abortController = currentController
  loading.value = true
  loadError.value = false
  try {
    const response = await adminAPI.redeem.list(
      pagination.page,
      pagination.page_size,
      buildRedeemQueryFilters(),
      {
        signal: currentController.signal
      }
    )
    if (currentController.signal.aborted) {
      return
    }
    if (response.items.length === 0 && response.total > 0 && pagination.page > 1) {
      pagination.page = Math.max(1, response.pages)
      await loadCodes()
      return
    }
    codes.value = response.items
    pagination.total = response.total
    pagination.pages = response.pages
  } catch (error: any) {
    if (
      currentController.signal.aborted ||
      error?.name === 'AbortError' ||
      error?.code === 'ERR_CANCELED'
    ) {
      return
    }
    loadError.value = true
    appStore.showError(t('admin.redeem.failedToLoad'))
  } finally {
    if (abortController === currentController && !currentController.signal.aborted) {
      loading.value = false
      abortController = null
    }
  }
}

let searchTimeout: ReturnType<typeof setTimeout>
const handleSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.page = 1
    loadCodes()
  }, 300)
}

const applyFilters = () => {
  pagination.page = 1
  loadCodes()
}

const clearFilters = () => {
  filters.type = ''
  filters.status = ''
  pagination.page = 1
  loadCodes()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadCodes()
}

const handlePageSizeChange = (pageSize: number) => {
  setPersistedPageSize(pageSize)
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

const toggleSelectRow = (code: RedeemCode, checked: boolean) => {
  if (checked) {
    selectedCodeTypes.set(code.id, code.type)
    select(code.id)
    return
  }
  selectedCodeTypes.delete(code.id)
  deselect(code.id)
}

const toggleSelectAllVisible = (checked: boolean) => {
  for (const code of codes.value) {
    if (checked) selectedCodeTypes.set(code.id, code.type)
    else selectedCodeTypes.delete(code.id)
  }
  toggleVisible(checked)
}

const getRedeemCodeExpiresInDays = () => {
  if (generateForm.expiry_option === 'never') {
    return undefined
  }
  if (generateForm.expiry_option === 'custom') {
    if (
      !Number.isFinite(generateForm.custom_expiry_days) ||
      generateForm.custom_expiry_days < 1
    ) {
      return null
    }
    return Math.floor(generateForm.custom_expiry_days)
  }
  return Number(generateForm.expiry_option)
}

const toDatetimeLocalInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

const resetBatchUpdateForm = () => {
  batchUpdateForm.update_status = false
  batchUpdateForm.status = 'disabled'
  batchUpdateForm.update_expires_at = false
  batchUpdateForm.expires_mode = 'clear'
  batchUpdateForm.expires_at_local = toDatetimeLocalInputValue(
    new Date(Date.now() + 24 * 60 * 60 * 1000)
  )
  batchUpdateForm.update_notes = false
  batchUpdateForm.notes = ''
  batchUpdateForm.update_plan_id = false
  batchUpdateForm.plan_id = null
}

const openBatchUpdateDialog = () => {
  if (selectedCount.value === 0) {
    appStore.showInfo(t('admin.redeem.selectCodesFirst'))
    return
  }
  resetBatchUpdateForm()
  showBatchUpdateDialog.value = true
}

const closeBatchUpdateDialog = () => {
  showBatchUpdateDialog.value = false
}

const buildBatchUpdateFields = (): BatchUpdateRedeemCodeFields | null => {
  const fields: BatchUpdateRedeemCodeFields = {}

  if (batchUpdateForm.update_status) {
    fields.status = batchUpdateForm.status
  }
  if (batchUpdateForm.update_expires_at) {
    if (batchUpdateForm.expires_mode === 'clear') {
      fields.expires_at = null
    } else {
      const expiresAt = new Date(batchUpdateForm.expires_at_local)
      if (!batchUpdateForm.expires_at_local || Number.isNaN(expiresAt.getTime())) {
        appStore.showError(t('admin.redeem.expiryDaysRequired'))
        return null
      }
      fields.expires_at = expiresAt.toISOString()
    }
  }
  if (batchUpdateForm.update_notes) {
    fields.notes = batchUpdateForm.notes
  }
  if (batchUpdateForm.update_plan_id) {
    if (!batchUpdateForm.plan_id) {
      appStore.showError(t('admin.redeem.planRequired'))
      return null
    }
    fields.plan_id = Number(batchUpdateForm.plan_id)
  }

  return Object.keys(fields).length > 0 ? fields : null
}

const handleGenerateCodes = async () => {
  if (generating.value) return
  if (generateForm.type === 'subscription' && !generateForm.plan_id) {
    appStore.showError(t('admin.redeem.planRequired'))
    return
  }

  const expiresInDays = getRedeemCodeExpiresInDays()
  if (expiresInDays === null) {
    appStore.showError(t('admin.redeem.expiryDaysRequired'))
    return
  }

  generating.value = true
  try {
    const result = await adminAPI.redeem.generate(
      generateForm.count,
      generateForm.type,
      generateForm.value,
      generateForm.type === 'subscription' ? generateForm.plan_id : undefined,
      generateForm.type === 'subscription' ? generateForm.validity_days : undefined,
      expiresInDays
    )
    showGenerateDialog.value = false
    generatedCodes.value = result
    showResultDialog.value = true
    // 重置表单
    generateForm.plan_id = null
    generateForm.validity_days = 30
    generateForm.expiry_option = 'never'
    generateForm.custom_expiry_days = 7
    loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.redeem.failedToGenerate'))
  } finally {
    generating.value = false
  }
}

const copyToClipboard = async (text: string) => {
  const success = await clipboardCopy(text, t('admin.redeem.copied'))
  if (success) {
    copiedCode.value = text
    if (copyCodeResetTimer) clearTimeout(copyCodeResetTimer)
    copyCodeResetTimer = setTimeout(() => {
      copiedCode.value = null
      copyCodeResetTimer = null
    }, 2000)
  }
}

const handleExportCodes = async () => {
  if (exporting.value) return
  exporting.value = true
  try {
    const blob = await adminAPI.redeem.exportCodes(buildRedeemQueryFilters())

    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `redeem-codes-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    appStore.showSuccess(t('admin.redeem.codesExported'))
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.redeem.failedToExport'))
  } finally {
    exporting.value = false
  }
}

const handleDelete = (code: RedeemCode) => {
  deletingCode.value = code
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (!deletingCode.value || deleting.value) return

  deleting.value = true
  try {
    await adminAPI.redeem.delete(deletingCode.value.id)
    appStore.showSuccess(t('admin.redeem.codeDeleted'))
    showDeleteDialog.value = false
    deletingCode.value = null
    await loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.redeem.failedToDelete'))
  } finally {
    deleting.value = false
  }
}

const confirmDeleteUnused = async () => {
  if (deletingUnused.value) return
  deletingUnused.value = true
  try {
    const unusedCodeIds: number[] = []
    let currentPage = 1
    let totalPages = 1
    do {
      const response = await adminAPI.redeem.list(currentPage, 200, { status: 'unused' })
      unusedCodeIds.push(...response.items.map((code) => code.id))
      totalPages = response.pages || 1
      currentPage++
    } while (currentPage <= totalPages)

    if (unusedCodeIds.length === 0) {
      appStore.showInfo(t('admin.redeem.noUnusedCodes'))
      showDeleteUnusedDialog.value = false
      return
    }

    let deleted = 0
    for (let index = 0; index < unusedCodeIds.length; index += 1000) {
      const result = await adminAPI.redeem.batchDelete(unusedCodeIds.slice(index, index + 1000))
      deleted += result.deleted
    }
    appStore.showSuccess(t('admin.redeem.codesDeleted', { count: deleted }))
    showDeleteUnusedDialog.value = false
    await loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.redeem.failedToDeleteUnused'))
  } finally {
    deletingUnused.value = false
  }
}

const handleBatchUpdate = async () => {
  if (batchUpdating.value) return
  const ids = Array.from(selectedCodeIds.value)
  if (ids.length === 0) {
    appStore.showInfo(t('admin.redeem.selectCodesFirst'))
    return
  }

  const hasSelectedFields =
    batchUpdateForm.update_status ||
    batchUpdateForm.update_expires_at ||
    batchUpdateForm.update_notes ||
    batchUpdateForm.update_plan_id
  if (!hasSelectedFields) {
    appStore.showError(t('admin.redeem.noBatchFieldsSelected'))
    return
  }

  const fields = buildBatchUpdateFields()
  if (!fields) {
    return
  }

  batchUpdating.value = true
  try {
    const result = await adminAPI.redeem.batchUpdate(ids, fields)
    appStore.showSuccess(t('admin.redeem.batchUpdateSuccess', { count: result.updated }))
    showBatchUpdateDialog.value = false
    clearSelectedCodes()
    loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.redeem.failedToBatchUpdate'))
  } finally {
    batchUpdating.value = false
  }
}

const loadSubscriptionPlans = async () => {
  try {
    const response = await adminAPI.payment.getPlans()
    subscriptionPlans.value = response.data
  } catch {
    appStore.showError(t('admin.redeem.failedToLoadPlans'))
  }
}

onMounted(() => {
  loadCodes()
  loadSubscriptionPlans()
})

onUnmounted(() => {
  clearTimeout(searchTimeout)
  abortController?.abort()
  if (copyAllResetTimer) clearTimeout(copyAllResetTimer)
  if (copyCodeResetTimer) clearTimeout(copyCodeResetTimer)
})
</script>
