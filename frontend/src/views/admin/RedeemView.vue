<template>
  <AppLayout>
    <UiServerTableWorkspace :loading="loading">
      <template #filters>
        <div class="flex flex-col gap-2 p-3 xl:flex-row xl:items-center">
          <div class="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(240px,1fr)_144px_144px]">
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
          </div>

          <div class="flex items-center gap-2 overflow-x-auto pb-1 xl:overflow-visible xl:pb-0">
            <UiIconButton
              @click="loadCodes"
              :disabled="loading"
              :label="t('common.refresh')"
              density="compact"
            >
              <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />
            </UiIconButton>
            <UiButton density="compact" @click="handleExportCodes">
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
          </div>
        </div>
      </template>

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
            <div class="flex max-w-[18rem] min-w-0 items-center gap-2">
              <code class="min-w-0 flex-1 truncate font-mono text-sm text-gray-900 dark:text-gray-100" :title="String(value)">{{ value }}</code>
              <UiIconButton
                variant="ghost"
                density="mini"
                :label="copiedCode === value ? t('admin.redeem.copied') : t('keys.copyToClipboard')"
                @click="copyToClipboard(value)"
              >
                <Icon v-if="copiedCode !== value" name="copy" size="sm" :stroke-width="2" />
                <Icon v-else name="check" size="sm" :stroke-width="2" />
              </UiIconButton>
            </div>
          </template>

          <template #cell-type="{ value }">
            <UiBadge :tone="redeemTypeTone(value)">
              {{ t('admin.redeem.types.' + value) }}
            </UiBadge>
          </template>

          <template #cell-value="{ value, row }">
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              <template v-if="row.type === 'balance'">${{ value.toFixed(2) }}</template>
              <template v-else-if="row.type === 'subscription'">
                {{ row.validity_days || 30 }} {{ t('admin.redeem.days') }}
                <span v-if="row.plan_name" class="ml-1 text-xs text-gray-500 dark:text-gray-400"
                  >({{ row.plan_name }})</span
                >
              </template>
              <template v-else>{{ value }}</template>
            </span>
          </template>

          <template #cell-status="{ value }">
            <UiStatusBadge :status="redeemStatusTone(value)" :label="t('admin.redeem.status.' + value)" />
          </template>

          <template #cell-used_by="{ value, row }">
            <span class="block max-w-[16rem] truncate text-sm text-gray-500 dark:text-dark-400" :title="row.user?.email || ''">
              {{ row.user?.email || (value ? t('admin.redeem.userPrefix', { id: value }) : '-') }}
            </span>
          </template>

          <template #cell-used_at="{ value }">
            <span class="text-sm text-gray-500 dark:text-dark-400">{{
              value ? formatDateTime(value) : '-'
            }}</span>
          </template>

          <template #cell-expires_at="{ value, row }">
            <span
              :class="[
                'text-sm',
                row.status === 'expired'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-dark-400'
              ]"
            >
              {{ value ? formatDateTime(value) : t('admin.redeem.neverExpires') }}
            </span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex items-center space-x-2">
              <UiIconButton
                v-if="row.status === 'unused'"
                icon="trash"
                variant="danger"
                density="compact"
                :label="t('common.delete')"
                @click="handleDelete(row)"
              />
              <span v-else class="text-gray-400 dark:text-dark-500">-</span>
            </div>
          </template>
        </UiDataTable>

      <template #pagination>
        <div
          v-if="selectedCount > 0"
          class="mb-2 flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-gray-50 p-2 dark:border-dark-600 dark:bg-dark-800"
        >
          <span class="text-sm font-medium">
            {{ t('admin.redeem.selectedCount', { count: selectedCount }) }}
          </span>
          <div class="flex flex-wrap items-center gap-2">
            <UiButton density="dense" variant="quiet" @click="clearSelectedCodes">
              {{ t('admin.redeem.clearSelection') }}
            </UiButton>
            <UiButton density="dense" variant="primary" @click="openBatchUpdateDialog">
              {{ t('admin.redeem.batchUpdate') }}
            </UiButton>
          </div>
        </div>

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
        <div v-if="filters.status === 'unused'" class="flex justify-end">
          <UiButton density="compact" variant="danger" @click="showDeleteUnusedDialog = true">
            {{ t('admin.redeem.deleteAllUnused') }}
          </UiButton>
        </div>
      </template>
    </UiServerTableWorkspace>

    <!-- Delete Confirmation Dialog -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.redeem.deleteCode')"
      :message="t('admin.redeem.deleteCodeConfirm')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
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
          <form @submit.prevent="handleGenerateCodes" class="space-y-4">
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
              <div>
                <UiSelect
                  v-model="generateForm.plan_id"
                  :options="planOptions"
                  density="compact"
                  :label="t('admin.redeem.selectPlan')"
                  :placeholder="t('admin.redeem.selectPlanPlaceholder')"
                >
                  <template #selected="{ option }">
                    <span v-if="option" class="font-medium text-gray-900 dark:text-white">
                      {{ (option as unknown as PlanOption).label }}
                    </span>
                    <span v-else class="text-gray-400">{{
                      t('admin.redeem.selectPlanPlaceholder')
                    }}</span>
                  </template>
                  <template #option="{ option }">
                    <div class="min-w-0 py-0.5">
                      <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {{ (option as unknown as PlanOption).label }}
                      </p>
                      <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        {{ (option as unknown as PlanOption).groupSummary }}
                      </p>
                    </div>
                  </template>
                </UiSelect>
              </div>
              <UiTextField v-model.number="generateForm.validity_days" type="number" min="1" max="365" required density="compact" :label="t('admin.redeem.validityDays')" />
            </template>
            <div>
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
                class="mt-2"
                density="compact"
                :placeholder="t('admin.redeem.customExpiryDays')"
              />
            </div>
            <UiTextField v-model.number="generateForm.count" type="number" min="1" max="100" required density="compact" :label="t('admin.redeem.count')" />
            <div class="flex justify-end gap-3 pt-2">
              <UiButton density="compact" @click="showGenerateDialog = false">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton type="submit" density="compact" variant="primary" :loading="generating" :disabled="generating">
                {{ generating ? t('admin.redeem.generating') : t('admin.redeem.generate') }}
              </UiButton>
            </div>
          </form>
    </UiDialog>

    <!-- Batch Update Dialog -->
    <UiDialog
      :show="showBatchUpdateDialog"
      :title="t('admin.redeem.batchUpdateTitle')"
      width="normal"
      @close="closeBatchUpdateDialog"
    >
          <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">{{ t('admin.redeem.selectedCount', { count: selectedCount }) }}</p>

          <form data-test="batch-update-form" class="space-y-4" @submit.prevent="handleBatchUpdate">
            <div class="space-y-2">
              <UiCheckbox data-test="batch-field-status" v-model="batchUpdateForm.update_status" :label="t('admin.redeem.batchFields.status')" />
              <UiSelect
                v-if="batchUpdateForm.update_status"
                v-model="batchUpdateForm.status"
                data-test="batch-status-select"
                :options="batchStatusOptions"
                density="compact"
              />
            </div>

            <div class="space-y-2">
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
            </div>

            <div class="space-y-2">
              <UiCheckbox data-test="batch-field-notes" v-model="batchUpdateForm.update_notes" :label="t('admin.redeem.batchFields.notes')" />
              <UiTextArea
                v-if="batchUpdateForm.update_notes"
                data-test="batch-notes-input"
                v-model="batchUpdateForm.notes"
                :rows="3"
                :placeholder="t('admin.redeem.batchNotesPlaceholder')"
              />
            </div>

            <div v-if="selectedCodesAreSubscription" class="space-y-2">
              <UiCheckbox v-model="batchUpdateForm.update_plan_id" :label="t('admin.redeem.batchFields.plan')" />
              <UiSelect
                v-if="batchUpdateForm.update_plan_id"
                v-model="batchUpdateForm.plan_id"
                :options="planOptions"
                density="compact"
                :placeholder="t('admin.redeem.selectPlanPlaceholder')"
              />
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <UiButton density="compact" @click="closeBatchUpdateDialog">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                data-test="batch-update-submit"
                type="submit"
                density="compact"
                variant="primary"
                :loading="batchUpdating"
                :disabled="batchUpdating"
              >
                {{ batchUpdating ? t('common.submitting') : t('admin.redeem.batchUpdate') }}
              </UiButton>
            </div>
          </form>
    </UiDialog>

    <!-- Generated Codes Result Dialog -->
    <UiDialog
      :show="showResultDialog"
      :title="t('admin.redeem.generatedSuccessfully')"
      width="normal"
      @close="closeResultDialog"
    >
      <UiAlert tone="success" :message="t('admin.redeem.codesCreated', { count: generatedCodes.length })" />
      <UiTextArea
        class="mt-3"
        :model-value="generatedCodesText"
        :rows="Math.min(Math.max(generatedCodes.length, 3), 10)"
        readonly
        monospace
      />
      <template #footer>
        <UiButton density="compact" @click="copyGeneratedCodes">
          <template #icon><Icon :name="copiedAll ? 'check' : 'copy'" size="sm" /></template>
          {{ copiedAll ? t('admin.redeem.copied') : t('admin.redeem.copyAll') }}
        </UiButton>
        <UiButton density="compact" variant="primary" @click="downloadGeneratedCodes">
          <template #icon><Icon name="download" size="sm" /></template>
          {{ t('admin.redeem.download') }}
        </UiButton>
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
  UiAlert,
  UiBadge,
  UiButton,
  UiCheckbox,
  UiConfirmDialog,
  UiDataTable,
  UiDialog,
  UiIconButton,
  UiPagination,
  UiSearchInput,
  UiSegmentedControl,
  UiSelect,
  UiServerTableWorkspace,
  UiStatusBadge,
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

const closeResultDialog = () => {
  showResultDialog.value = false
  generatedCodes.value = []
  copiedAll.value = false
}

const copyGeneratedCodes = async () => {
  const success = await clipboardCopy(generatedCodesText.value, t('admin.redeem.copied'))
  if (success) {
    copiedAll.value = true
    setTimeout(() => {
      copiedAll.value = false
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

const batchStatusOptions = computed(() => [
  { value: 'unused', label: t('admin.redeem.status.unused') },
  { value: 'disabled', label: t('admin.redeem.status.disabled') }
])

const batchExpiryModeOptions = computed(() => [
  { value: 'clear', label: t('admin.redeem.neverExpires') },
  { value: 'custom', label: t('admin.redeem.customExpiry') }
])

const codes = ref<RedeemCode[]>([])
const loading = ref(false)
const generating = ref(false)
const batchUpdating = ref(false)
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
    appStore.showError(t('admin.redeem.failedToLoad'))
    console.error('Error loading redeem codes:', error)
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
    console.error('Error generating codes:', error)
  } finally {
    generating.value = false
  }
}

const copyToClipboard = async (text: string) => {
  const success = await clipboardCopy(text, t('admin.redeem.copied'))
  if (success) {
    copiedCode.value = text
    setTimeout(() => {
      copiedCode.value = null
    }, 2000)
  }
}

const handleExportCodes = async () => {
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
    console.error('Error exporting codes:', error)
  }
}

const handleDelete = (code: RedeemCode) => {
  deletingCode.value = code
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (!deletingCode.value) return

  try {
    await adminAPI.redeem.delete(deletingCode.value.id)
    appStore.showSuccess(t('admin.redeem.codeDeleted'))
    showDeleteDialog.value = false
    deletingCode.value = null
    loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.redeem.failedToDelete'))
    console.error('Error deleting code:', error)
  }
}

const confirmDeleteUnused = async () => {
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
    loadCodes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.redeem.failedToDeleteUnused'))
    console.error('Error deleting unused codes:', error)
  }
}

const handleBatchUpdate = async () => {
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
    console.error('Error batch updating codes:', error)
  } finally {
    batchUpdating.value = false
  }
}

const loadSubscriptionPlans = async () => {
  try {
    const response = await adminAPI.payment.getPlans()
    subscriptionPlans.value = response.data
  } catch (error) {
    console.error('Error loading subscription plans:', error)
  }
}

onMounted(() => {
  loadCodes()
  loadSubscriptionPlans()
})

onUnmounted(() => {
  clearTimeout(searchTimeout)
  abortController?.abort()
})
</script>
