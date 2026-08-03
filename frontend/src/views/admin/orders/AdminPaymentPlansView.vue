<template>
  <AppLayout>
    <TablePageLayout>
      <template #actions>
        <div class="flex flex-col gap-3 border-b border-gray-200 pb-3 dark:border-dark-700 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('payment.admin.plansPageTitle') }}</h1>
            <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('payment.admin.plansPageDesc') }}</p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 self-stretch sm:self-auto">
            <button type="button" @click="showImportDialog = true" class="btn btn-secondary whitespace-nowrap">
              <Icon name="upload" size="sm" class="mr-1.5" />
              {{ t('payment.admin.catalogImport.openButton') }}
            </button>
            <button type="button" @click="downloadCatalogTemplate" :disabled="catalogTemplateDownloading" class="btn btn-secondary whitespace-nowrap">
              <Icon :name="catalogTemplateDownloading ? 'refresh' : 'document'" size="sm" class="mr-1.5" :class="catalogTemplateDownloading ? 'animate-spin' : ''" />
              {{ t('payment.admin.catalogImport.downloadTemplate') }}
            </button>
            <button type="button" @click="exportCatalog" :disabled="catalogExporting" class="btn btn-secondary whitespace-nowrap">
              <Icon :name="catalogExporting ? 'refresh' : 'download'" size="sm" class="mr-1.5" :class="catalogExporting ? 'animate-spin' : ''" />
              {{ t('payment.admin.catalogImport.exportCurrent') }}
            </button>
            <button type="button" @click="loadPlans" :disabled="plansLoading" class="btn btn-secondary btn-icon" :title="t('common.refresh')" :aria-label="t('common.refresh')">
              <Icon name="refresh" size="md" :class="plansLoading ? 'animate-spin' : ''" />
            </button>
            <button type="button" @click="openPlanEdit(null)" class="btn btn-primary">
              <Icon name="plus" size="sm" class="mr-1.5" />
              {{ t('payment.admin.createPlan') }}
            </button>
          </div>
        </div>
      </template>

      <!-- Plans Table -->
      <template #table>
      <DataTable :columns="planColumns" :data="plans" :loading="plansLoading">
        <template #cell-name="{ value }">
          <span class="block max-w-[16rem] truncate text-sm font-medium text-gray-900 dark:text-white" :title="String(value)">{{ value }}</span>
        </template>
        <template #cell-included_groups="{ value }">
          <div class="flex max-w-[28rem] flex-wrap gap-1.5">
            <GroupBadge
              v-for="group in value || []"
              :key="group.id"
              :name="group.name"
              :platform="group.platform"
              :rate-multiplier="group.rate_multiplier"
            />
            <span v-if="!(value || []).length" class="badge badge-danger text-sm">
              {{ t('payment.admin.groupMissing') }}
            </span>
          </div>
        </template>
        <template #cell-cycle_quota_usd="{ value, row }">
          <div v-if="Number(value) > 0" class="whitespace-nowrap text-sm">
            <p class="font-medium tabular-nums text-gray-900 dark:text-white">${{ Number(value).toFixed(2) }}</p>
            <p class="text-xs text-gray-400">{{ formatResetInterval(row.reset_interval_seconds) }}</p>
          </div>
          <span v-else class="text-xs text-gray-400">{{ t('payment.admin.unlimitedCycleQuota') }}</span>
        </template>
        <template #cell-five_hour_quota_usd="{ value }">
          <span v-if="Number(value) > 0" class="whitespace-nowrap text-sm font-medium tabular-nums text-gray-900 dark:text-white">
            ${{ Number(value).toFixed(2) }}
          </span>
          <span v-else class="text-xs text-gray-400">{{ t('payment.admin.unlimitedFiveHourQuota') }}</span>
        </template>
        <template #cell-total_quota_usd="{ value }">
          <span v-if="Number(value) > 0" class="whitespace-nowrap text-sm font-medium tabular-nums text-gray-900 dark:text-white">
            ${{ Number(value).toFixed(2) }}
          </span>
          <span v-else class="text-xs text-gray-400">{{ t('payment.admin.unlimitedTotalQuota') }}</span>
        </template>
        <template #cell-price="{ value, row }">
          <div class="whitespace-nowrap text-sm">
            <span class="font-medium text-gray-900 dark:text-white">{{ planCurrencySymbol(row.currency) }}{{ (value ?? 0).toFixed(2) }}</span>
            <span v-if="row.currency" class="ml-1 text-xs text-gray-400">{{ row.currency }}</span>
            <span v-if="row.original_price" class="ml-1 text-xs text-gray-400 line-through">{{ planCurrencySymbol(row.currency) }}{{ row.original_price.toFixed(2) }}</span>
          </div>
        </template>
        <template #cell-validity_days="{ value, row }">
          <span class="text-sm">{{ value }} {{ t(`payment.admin.${validityUnitKey(row.validity_unit)}`) }}</span>
        </template>
        <template #cell-for_sale="{ value, row }">
          <button
            type="button"
            :aria-label="t('payment.admin.forSale')"
            :aria-pressed="Boolean(value)"
            :class="[
              'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
            ]"
            @click="toggleForSale(row)"
          >
            <span :class="[
              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              value ? 'translate-x-4' : 'translate-x-0'
            ]" />
          </button>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex items-center gap-1">
            <button type="button" @click="openPlanEdit(row)" class="btn btn-ghost btn-icon text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400" :title="t('common.edit')" :aria-label="t('common.edit')">
              <Icon name="edit" size="sm" />
            </button>
            <button type="button" @click="confirmDeletePlan(row)" class="btn btn-ghost btn-icon text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400" :title="t('common.delete')" :aria-label="t('common.delete')">
              <Icon name="trash" size="sm" />
            </button>
          </div>
        </template>
      </DataTable>
      </template>
    </TablePageLayout>

    <!-- Plan Edit Dialog -->
    <PlanEditDialog :show="showPlanDialog" :plan="editingPlan" :groups="groups" :payment-config="paymentConfig" @close="showPlanDialog = false" @saved="loadPlans" />

    <PlanImportDialog
      :show="showImportDialog"
      :groups="groups"
      @close="showImportDialog = false"
      @imported="handleCatalogImported"
    />

    <ConfirmDialog :show="showDeletePlanDialog" :title="t('payment.admin.deletePlan')" :message="t('payment.admin.deletePlanConfirm')" :confirm-text="t('common.delete')" danger @confirm="handleDeletePlan" @cancel="showDeletePlanDialog = false" />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminPaymentAPI } from '@/api/admin/payment'
import type { AdminPaymentConfig } from '@/api/admin/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import adminAPI from '@/api/admin'
import type { SubscriptionPlan } from '@/types/payment'
import type { AdminGroup } from '@/types'
import type { Column } from '@/components/common/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import TablePageLayout from '@/components/layout/TablePageLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import GroupBadge from '@/components/common/GroupBadge.vue'
import PlanEditDialog from './PlanEditDialog.vue'
import PlanImportDialog from './PlanImportDialog.vue'
import { currencySymbol } from '@/components/payment/currency'
import { isPaymentCatalogTemplate } from './catalogTemplate'

const { t } = useI18n()
const appStore = useAppStore()

function planCurrencySymbol(currency?: string): string {
  return currencySymbol(currency || 'USD')
}

function validityUnitKey(unit?: string): 'days' | 'weeks' | 'months' {
  const normalized = String(unit || 'day').trim().toLowerCase().replace(/s$/, '')
  if (normalized === 'week') return 'weeks'
  if (normalized === 'month') return 'months'
  return 'days'
}

// ==================== Groups ====================

const groups = ref<AdminGroup[]>([])
const paymentConfig = ref<AdminPaymentConfig | null>(null)

async function loadGroups() {
  try {
    groups.value = await adminAPI.groups.getAll()
  } catch { /* ignore */ }
}

async function loadPaymentConfig() {
  try {
    const res = await adminPaymentAPI.getConfig()
    paymentConfig.value = res.data
  } catch { /* preview only */ }
}

// ==================== Plans ====================

const plansLoading = ref(false)
const plans = ref<SubscriptionPlan[]>([])
const showPlanDialog = ref(false)
const showImportDialog = ref(false)
const showDeletePlanDialog = ref(false)
const catalogExporting = ref(false)
const catalogTemplateDownloading = ref(false)
const editingPlan = ref<SubscriptionPlan | null>(null)
const deletingPlanId = ref<number | null>(null)

const planColumns = computed((): Column[] => [
  { key: 'name', label: t('payment.admin.planName') },
  { key: 'included_groups', label: t('payment.admin.includedGroups') },
	{ key: 'five_hour_quota_usd', label: t('payment.admin.fiveHourQuota') },
  { key: 'cycle_quota_usd', label: t('payment.admin.cycleQuota') },
  { key: 'total_quota_usd', label: t('payment.admin.totalQuota') },
  { key: 'price', label: t('payment.admin.price') },
  { key: 'validity_days', label: t('payment.admin.validity') },
  { key: 'for_sale', label: t('payment.admin.forSale') },
  { key: 'sort_order', label: t('payment.admin.sortOrder') },
  { key: 'actions', label: t('common.actions') },
])

function formatResetInterval(seconds?: number): string {
  if (!seconds || seconds <= 0) return t('payment.admin.noReset')
  const days = seconds / 86400
  return t('payment.admin.resetEveryDays', { days: Number(days.toFixed(2)) })
}

async function loadPlans() {
  plansLoading.value = true
  try {
    const res = await adminPaymentAPI.getPlans()
    // Backend returns features as newline-separated string; parse to array
    plans.value = (res.data || []).map((p: Omit<SubscriptionPlan, 'features'> & { features: string | string[] }) => ({
      ...p,
      features: typeof p.features === 'string'
        ? p.features.split('\n').map((f: string) => f.trim()).filter(Boolean)
        : (p.features || []),
    }))
  }
  catch (err: unknown) { appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))) }
  finally { plansLoading.value = false }
}

function openPlanEdit(plan: SubscriptionPlan | null) {
  editingPlan.value = plan
  showPlanDialog.value = true
}


/** Quick toggle for_sale from the list */
async function toggleForSale(plan: SubscriptionPlan) {
  try {
    await adminPaymentAPI.updatePlan(plan.id, { for_sale: !plan.for_sale })
    plan.for_sale = !plan.for_sale
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  }
}

function confirmDeletePlan(plan: SubscriptionPlan) { deletingPlanId.value = plan.id; showDeletePlanDialog.value = true }
async function handleDeletePlan() {
  if (!deletingPlanId.value) return
  try { await adminPaymentAPI.deletePlan(deletingPlanId.value); appStore.showSuccess(t('common.deleted')); showDeletePlanDialog.value = false; loadPlans() }
  catch (err: unknown) { appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))) }
}

function saveCatalogFile(catalog: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(catalog, null, 2) + '\n'], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function downloadCatalogTemplate() {
  if (catalogTemplateDownloading.value) return
  catalogTemplateDownloading.value = true
  try {
    const base = String(import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
    const response = await fetch(`${base}templates/qiuapi-subscription-catalog-v1.json`, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`template request failed with status ${response.status}`)
    const rawTemplate: unknown = await response.json()
    if (!isPaymentCatalogTemplate(rawTemplate)) throw new Error('invalid catalog template')

    saveCatalogFile(rawTemplate, 'qiuapi-subscription-template-v3.json')
    appStore.showSuccess(t('payment.admin.catalogImport.templateDownloadSuccess'))
  } catch {
    appStore.showError(t('payment.admin.catalogImport.templateFailed'))
  } finally {
    catalogTemplateDownloading.value = false
  }
}

async function exportCatalog() {
  if (catalogExporting.value) return
  catalogExporting.value = true
  try {
    const response = await adminPaymentAPI.exportCatalog()
    const date = new Date().toISOString().slice(0, 10)
    saveCatalogFile(response.data, `qiuapi-payment-catalog-${date}.json`)
    appStore.showSuccess(t('payment.admin.catalogImport.exportSuccess'))
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('payment.admin.catalogImport.exportFailed')))
  } finally {
    catalogExporting.value = false
  }
}

function handleCatalogImported() {
  showImportDialog.value = false
  void Promise.all([loadPlans(), loadGroups(), loadPaymentConfig()])
}

// ==================== Lifecycle ====================

onMounted(() => {
  loadGroups()
  loadPaymentConfig()
  loadPlans()
})
</script>
