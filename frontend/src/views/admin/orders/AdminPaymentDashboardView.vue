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

      <div v-if="loading && !stats" class="payment-dashboard-loading" role="status" :aria-label="t('common.loading')">
        <UiSkeleton v-for="index in 4" :key="index" variant="rect" height="76px" />
      </div>
      <template v-else-if="stats">
        <OrderStatsCards :stats="stats" />
        <DailyRevenueChart :data="stats.daily_series || []" :loading="loading" />
        <div class="payment-dashboard__grid">
          <section class="payment-dashboard__section">
            <header><h2>{{ t('payment.admin.paymentDistribution') }}</h2></header>
            <UiEmptyState v-if="!stats.payment_methods?.length" :title="t('payment.admin.noData')" />
            <div v-else class="payment-dashboard__rows">
              <div v-for="method in stats.payment_methods" :key="method.type" class="payment-dashboard__row">
                <div class="payment-dashboard__row-label">
                  <UiBadge tone="info" dot />
                  <span :title="t('payment.methods.' + method.type, method.type)">{{ t('payment.methods.' + method.type, method.type) }}</span>
                </div>
                <div class="payment-dashboard__row-value">
                  <strong v-for="[currency, amount] in sortedAmounts(method.amount)" :key="currency">{{ formatMoney(currency, amount) }}</strong>
                  <span>{{ method.count }} {{ t('payment.admin.orders') }}</span>
                </div>
              </div>
            </div>
          </section>
          <section class="payment-dashboard__section">
            <header><h2>{{ t('payment.admin.topUsers') }}</h2></header>
            <UiEmptyState v-if="!hasTopUsers(stats.top_users)" :title="t('payment.admin.noData')" />
            <div v-else class="payment-dashboard__rows">
              <div v-for="[currency, users] in sortedTopUsers(stats.top_users)" :key="currency">
                <div class="payment-dashboard__currency">{{ currency }}</div>
                <div v-for="(user, idx) in users" :key="user.user_id" class="payment-dashboard__row">
                  <div class="payment-dashboard__row-label">
                    <UiBadge :label="String(idx + 1)" :tone="idx === 0 ? 'warning' : 'neutral'" />
                    <span :title="user.email">{{ user.email }}</span>
                  </div>
                  <strong class="ui-numeric">{{ formatMoney(currency, user.amount) }}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
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
import type { CurrencyAmounts, DashboardStats, TopUserPaymentStats } from '@/types/payment'
import AppLayout from '@/components/layout/AppLayout.vue'
import OrderStatsCards from '@/components/admin/payment/OrderStatsCards.vue'
import DailyRevenueChart from '@/components/admin/payment/DailyRevenueChart.vue'
import {
  AppPage,
  AppPageHeader,
  UiBadge,
  UiEmptyState,
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

const dayOptions = computed(() => DAYS_OPTIONS.map(value => ({
  value,
  label: `${value}${t('payment.admin.daySuffix')}`,
})))

function sortedAmounts(amounts: CurrencyAmounts): [string, number][] {
  return Object.entries(amounts).sort(([left], [right]) => left.localeCompare(right))
}

function sortedTopUsers(usersByCurrency: Record<string, TopUserPaymentStats[]>): [string, TopUserPaymentStats[]][] {
  return Object.entries(usersByCurrency).sort(([left], [right]) => left.localeCompare(right))
}

function hasTopUsers(usersByCurrency: Record<string, TopUserPaymentStats[]>): boolean {
  return Object.values(usersByCurrency).some(users => users.length > 0)
}

function formatMoney(currency: string, amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

async function loadDashboard() {
  loading.value = true
  try {
    const res = await adminPaymentAPI.getDashboard(days.value)
    stats.value = res.data
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    loading.value = false
  }
}

watch(days, () => loadDashboard())
onMounted(() => loadDashboard())
</script>

<style scoped>
.payment-dashboard__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.payment-dashboard__section {
  min-width: 0;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-surface);
}

.payment-dashboard__section > header {
  padding: 11px 14px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.payment-dashboard__section h2 {
  margin: 0;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.payment-dashboard__rows {
  display: grid;
  gap: 2px;
  padding: 8px 14px 12px;
}

.payment-dashboard__row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
  padding: 4px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.payment-dashboard__row:last-child {
  border-bottom: 0;
}

.payment-dashboard__row-label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.payment-dashboard__row-label > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payment-dashboard__row-value {
  display: grid;
  flex: none;
  justify-items: end;
  gap: 1px;
}

.payment-dashboard__row-value strong,
.payment-dashboard__row > strong {
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 600;
}

.payment-dashboard__row-value span {
  color: var(--ui-text-soft);
  font-size: 10px;
}

.payment-dashboard__currency {
  padding: 8px 0 2px;
  color: var(--ui-text-soft);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.payment-dashboard-loading {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .payment-dashboard__grid,
  .payment-dashboard-loading {
    grid-template-columns: 1fr;
  }
}
</style>
