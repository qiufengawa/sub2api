<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('payment.admin.plansPageTitle')" :description="t('payment.admin.plansPageDesc')">
        <template #actions>
          <AppInline justify="flex-end">
            <UiButton density="compact" variant="secondary" type="button" @click="showImportDialog = true">
              <template #icon><Icon name="upload" size="sm" /></template>
              {{ t('payment.admin.catalogImport.openButton') }}
            </UiButton>
            <UiButton density="compact" variant="secondary" type="button" :loading="catalogTemplateDownloading" :disabled="catalogTemplateDownloading" @click="downloadCatalogTemplate">
              <template #icon><Icon :name="catalogTemplateDownloading ? 'refresh' : 'document'" size="sm" /></template>
              {{ t('payment.admin.catalogImport.downloadTemplate') }}
            </UiButton>
            <UiButton density="compact" variant="secondary" type="button" :loading="catalogExporting" :disabled="catalogExporting" @click="exportCatalog">
              <template #icon><Icon :name="catalogExporting ? 'refresh' : 'download'" size="sm" /></template>
              {{ t('payment.admin.catalogImport.exportCurrent') }}
            </UiButton>
            <UiIconButton icon="refresh" variant="ghost" density="compact" :disabled="plansLoading" :label="t('common.refresh')" @click="loadPlans" />
            <UiButton density="compact" type="button" variant="primary" @click="openPlanEdit(null)">
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('payment.admin.createPlan') }}
            </UiButton>
          </AppInline>
        </template>
      </AppPageHeader>

      <UiServerTableWorkspace :loading="refreshingPlans">
        <UiAlert
          v-if="plansLoadError && plans.length"
          tone="danger"
          :message="t('payment.admin.plansLoadFailed')"
        />
        <UiMobileTableScroller :label="t('payment.admin.plansPageTitle')" min-width="1120px">
        <UiDataTable :columns="planColumns" :data="plans" :loading="initialPlansLoading" mobile-table :aria-label="t('payment.admin.plansPageTitle')">
        <template #cell-name="{ value }">
          <UiDataCell :value="String(value)" />
        </template>
        <template #cell-included_groups="{ value }">
          <AppInline>
            <UiBadge
              v-for="group in value || []"
              :key="group.id"
              :label="`${group.name} · ${group.rate_multiplier}x`"
            />
            <UiBadge v-if="!(value || []).length" tone="danger" :label="t('payment.admin.groupMissing')" />
          </AppInline>
        </template>
        <template #cell-cycle_quota_usd="{ value, row }">
          <UiDataCell v-if="Number(value) > 0" :value="`$${Number(value).toFixed(2)}`" :meta="formatResetInterval(row.reset_interval_seconds)" mono />
          <UiBadge v-else :label="t('payment.admin.unlimitedCycleQuota')" />
        </template>
        <template #cell-five_hour_quota_usd="{ value }">
          <UiDataCell v-if="Number(value) > 0" :value="`$${Number(value).toFixed(2)}`" mono />
          <UiBadge v-else :label="t('payment.admin.unlimitedFiveHourQuota')" />
        </template>
        <template #cell-total_quota_usd="{ value }">
          <UiDataCell v-if="Number(value) > 0" :value="`$${Number(value).toFixed(2)}`" mono />
          <UiBadge v-else :label="t('payment.admin.unlimitedTotalQuota')" />
        </template>
        <template #cell-price="{ value, row }">
          <UiDataCell :value="`${planCurrencySymbol(row.currency)}${(value ?? 0).toFixed(2)}${row.currency || ''}`" :meta="row.original_price ? `${planCurrencySymbol(row.currency)}${row.original_price.toFixed(2)}` : undefined" mono />
        </template>
        <template #cell-validity_days="{ value, row }">
          <UiDataCell :value="`${value} ${t(`payment.admin.${validityUnitKey(row.validity_unit)}`)}`" />
        </template>
        <template #cell-max_subscriptions_per_user="{ value }">
          <UiDataCell :value="value || 1" mono />
        </template>
        <template #cell-for_sale="{ value, row }">
          <UiSwitch
            :model-value="Boolean(value)"
            :label="t('payment.admin.forSale')"
            :disabled="updatingPlanIds.includes(row.id)"
            @update:model-value="toggleForSale(row)"
          />
        </template>
        <template #cell-actions="{ row }">
          <UiButtonGroup :label="t('common.actions')">
            <UiIconButton icon="edit" variant="ghost" density="compact" :label="t('common.edit')" @click="openPlanEdit(row)" />
            <UiIconButton icon="trash" variant="danger" density="compact" :label="t('common.delete')" @click="confirmDeletePlan(row)" />
          </UiButtonGroup>
        </template>
        <template #empty>
          <UiErrorState
            v-if="plansLoadError"
            :title="t('payment.admin.plansLoadFailed')"
            :retry-text="t('common.retry')"
            @retry="loadPlans"
          />
          <UiEmptyState v-else :title="t('empty.noData')" />
        </template>
        </UiDataTable>
        </UiMobileTableScroller>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Plan Edit Dialog -->
    <PlanEditDialog :show="showPlanDialog" :plan="editingPlan" :groups="groups" :payment-config="paymentConfig" @close="showPlanDialog = false" @saved="loadPlans" />

    <PlanImportDialog
      :show="showImportDialog"
      :groups="groups"
      @close="showImportDialog = false"
      @imported="handleCatalogImported"
    />

    <UiConfirmDialog :show="showDeletePlanDialog" :title="t('payment.admin.deletePlan')" :message="t('payment.admin.deletePlanConfirm')" :confirm-text="t('common.delete')" :pending="deletingPlan" danger @confirm="handleDeletePlan" @cancel="showDeletePlanDialog = false" />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminPaymentAPI } from '@/api/admin/payment'
import type { AdminPaymentConfig } from '@/api/admin/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import adminAPI from '@/api/admin'
import type { SubscriptionPlan } from '@/types/payment'
import type { AdminGroup } from '@/types'
import type { Column } from '@/components/ui'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppInline,
  AppPage,
  AppPageHeader,
  UiAlert,
  UiBadge,
  UiButton,
  UiButtonGroup,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiEmptyState,
  UiErrorState,
  UiIconButton,
  UiMobileTableScroller,
  UiServerTableWorkspace,
  UiSwitch,
} from '@/components/ui'
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

const plansLoading = ref(true)
const plansLoadError = ref(false)
const plans = ref<SubscriptionPlan[]>([])
const showPlanDialog = ref(false)
const showImportDialog = ref(false)
const showDeletePlanDialog = ref(false)
const catalogExporting = ref(false)
const catalogTemplateDownloading = ref(false)
const deletingPlan = ref(false)
const updatingPlanIds = ref<number[]>([])
const editingPlan = ref<SubscriptionPlan | null>(null)
const deletingPlanId = ref<number | null>(null)
const initialPlansLoading = computed(() => plansLoading.value && plans.value.length === 0)
const refreshingPlans = computed(() => plansLoading.value && plans.value.length > 0)

let plansRequestController: AbortController | null = null
let plansRequestSequence = 0

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const requestError = error as { name?: string; code?: string }
  return requestError.name === 'AbortError' || requestError.code === 'ERR_CANCELED'
}

const planColumns = computed((): Column[] => [
  { key: 'name', label: t('payment.admin.planName') },
  { key: 'included_groups', label: t('payment.admin.includedGroups') },
  { key: 'five_hour_quota_usd', label: t('payment.admin.fiveHourQuota') },
  { key: 'cycle_quota_usd', label: t('payment.admin.cycleQuota') },
  { key: 'total_quota_usd', label: t('payment.admin.totalQuota') },
  { key: 'price', label: t('payment.admin.price') },
  { key: 'validity_days', label: t('payment.admin.validity') },
  { key: 'max_subscriptions_per_user', label: t('payment.admin.maxSubscriptionsPerUser') },
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
  plansRequestController?.abort()
  const controller = new AbortController()
  const sequence = ++plansRequestSequence
  plansRequestController = controller
  plansLoading.value = true
  plansLoadError.value = false
  try {
    const res = await adminPaymentAPI.getPlans({ signal: controller.signal })
    if (controller.signal.aborted || sequence !== plansRequestSequence) return
    // Backend returns features as newline-separated string; parse to array
    plans.value = (res.data || []).map((p: Omit<SubscriptionPlan, 'features'> & { features: string | string[] }) => ({
      ...p,
      features: typeof p.features === 'string'
        ? p.features.split('\n').map((f: string) => f.trim()).filter(Boolean)
        : (p.features || []),
    }))
  }
  catch (err: unknown) {
    if (controller.signal.aborted || sequence !== plansRequestSequence || isAbortError(err)) return
    plansLoadError.value = true
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  }
  finally {
    if (plansRequestController === controller) {
      plansLoading.value = false
      plansRequestController = null
    }
  }
}

function openPlanEdit(plan: SubscriptionPlan | null) {
  editingPlan.value = plan
  showPlanDialog.value = true
}


/** Quick toggle for_sale from the list */
async function toggleForSale(plan: SubscriptionPlan) {
  if (updatingPlanIds.value.includes(plan.id)) return
  updatingPlanIds.value = [...updatingPlanIds.value, plan.id]
  const nextValue = !plan.for_sale
  try {
    await adminPaymentAPI.updatePlan(plan.id, { for_sale: nextValue })
    plan.for_sale = nextValue
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    updatingPlanIds.value = updatingPlanIds.value.filter(id => id !== plan.id)
  }
}

function confirmDeletePlan(plan: SubscriptionPlan) { deletingPlanId.value = plan.id; showDeletePlanDialog.value = true }
async function handleDeletePlan() {
  if (!deletingPlanId.value || deletingPlan.value) return
  deletingPlan.value = true
  try {
    await adminPaymentAPI.deletePlan(deletingPlanId.value)
    appStore.showSuccess(t('common.deleted'))
    showDeletePlanDialog.value = false
    deletingPlanId.value = null
    await loadPlans()
  }
  catch (err: unknown) { appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))) }
  finally { deletingPlan.value = false }
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

onBeforeUnmount(() => {
  plansRequestSequence += 1
  plansRequestController?.abort()
  plansRequestController = null
})
</script>
