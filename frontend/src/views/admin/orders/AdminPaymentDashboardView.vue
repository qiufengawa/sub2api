<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader
        :title="t('payment.admin.dashboardTitle')"
        :description="t('payment.admin.dashboardDesc')"
      >
        <template #actions>
          <UiSegmentedControl
            v-model="days"
            :options="dayOptions"
            :label="t('payment.admin.dashboardTitle')"
          />
          <UiIconButton
            icon="refresh"
            :label="t('common.refresh')"
            :disabled="loading"
            @click="loadDashboard"
          />
        </template>
      </AppPageHeader>

      <AppGrid v-if="loading && !stats" min="220px" :gap="12" role="status" :aria-label="t('common.loading')">
        <UiSkeleton v-for="index in 4" :key="index" variant="rect" height="76px" />
      </AppGrid>
      <UiErrorState
        v-else-if="loadError && !stats"
        :title="t('common.error')"
        :description="loadError"
        :retry-text="t('common.retry')"
        @retry="loadDashboard"
      />
      <AppStack v-else-if="stats" :gap="16">
        <UiAlert v-if="loadError" tone="danger" :message="loadError" />
        <OrderStatsCards :stats="stats" />
        <DailyRevenueChart :data="stats.daily_series || []" :loading="loading" />
        <AppGrid min="320px" :gap="24">
          <AppSection :title="t('payment.admin.paymentDistribution')" divided>
            <UiEmptyState v-if="!paymentMethodFacts.length" :title="t('payment.admin.noData')" />
            <UiDescriptionList v-else :items="paymentMethodFacts" :columns="1" />
          </AppSection>
          <AppSection :title="t('payment.admin.topUsers')" divided>
            <UiEmptyState v-if="!topUserFacts.length" :title="t('payment.admin.noData')" />
            <UiDescriptionList v-else :items="topUserFacts" :columns="1" />
          </AppSection>
        </AppGrid>
      </AppStack>
      <UiEmptyState v-else :title="t('payment.admin.noData')" />
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminPaymentAPI } from '@/api/admin/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import type { CurrencyAmounts, DashboardStats } from '@/types/payment'
import AppLayout from '@/components/layout/AppLayout.vue'
import OrderStatsCards from '@/components/admin/payment/OrderStatsCards.vue'
import DailyRevenueChart from '@/components/admin/payment/DailyRevenueChart.vue'
import {
  AppPage,
  AppPageHeader,
  AppGrid,
  AppSection,
  AppStack,
  UiAlert,
  UiDescriptionList,
  UiEmptyState,
  UiErrorState,
  UiIconButton,
  UiSegmentedControl,
  UiSkeleton,
} from '@/components/ui'

const { t } = useI18n()
const appStore = useAppStore()

const DAYS_OPTIONS = [7, 30, 90] as const
const days = ref<number>(30)
const loading = ref(false)
const stats = ref<DashboardStats | null>(null)
const loadError = ref('')
let dashboardRequestId = 0

const dayOptions = computed(() => DAYS_OPTIONS.map(value => ({
  value,
  label: `${value}${t('payment.admin.daySuffix')}`,
})))

function sortedAmounts(amounts: CurrencyAmounts): [string, number][] {
  return Object.entries(amounts).sort(([left], [right]) => left.localeCompare(right))
}

function formatMoney(currency: string, amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

const paymentMethodFacts = computed(() => (stats.value?.payment_methods || []).map(method => ({
  key: method.type,
  label: t('payment.methods.' + method.type, method.type),
  value: `${sortedAmounts(method.amount).map(([currency, amount]) => formatMoney(currency, amount)).join(' · ')} · ${method.count} ${t('payment.admin.orders')}`,
})))

const topUserFacts = computed(() => Object.entries(stats.value?.top_users || {})
  .sort(([left], [right]) => left.localeCompare(right))
  .flatMap(([currency, users]) => users.map((user, index) => ({
    key: `${currency}-${user.user_id}`,
    label: `${index + 1}. ${user.email}`,
    value: formatMoney(currency, user.amount),
    numeric: true,
  }))))

async function loadDashboard() {
  const requestId = ++dashboardRequestId
  loading.value = true
  loadError.value = ''
  try {
    const res = await adminPaymentAPI.getDashboard(days.value)
    if (requestId === dashboardRequestId) stats.value = res.data
  } catch (err: unknown) {
    if (requestId !== dashboardRequestId) return
    loadError.value = extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))
    appStore.showError(loadError.value)
  } finally {
    if (requestId === dashboardRequestId) loading.value = false
  }
}

watch(days, () => loadDashboard())
onMounted(() => loadDashboard())
</script>
