<template>
  <AppGrid min="220px" :gap="12">
    <UiStatMetric
      class="payment-stat"
      :label="t('payment.admin.todayRevenue')"
      :value="formatAmounts(props.stats.today_amount)"
      :context="`${props.stats.today_count} ${t('payment.admin.orders')}`"
    />
    <UiStatMetric
      class="payment-stat"
      :label="t('payment.admin.totalRevenue')"
      :value="formatAmounts(props.stats.total_amount)"
      :context="`${props.stats.total_count} ${t('payment.admin.orders')}`"
    />
    <UiStatMetric
      :label="t('payment.admin.todayOrders')"
      :value="props.stats.today_count"
    />
    <UiStatMetric
      :label="t('payment.admin.avgAmount')"
      :value="formatAmounts(props.stats.avg_amount)"
      class="payment-stat"
    />
  </AppGrid>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CurrencyAmounts, DashboardStats } from '@/types/payment'
import { AppGrid, UiStatMetric } from '@/components/ui'

const { t } = useI18n()
const props = defineProps<{ stats: DashboardStats }>()

function formatAmounts(amounts: CurrencyAmounts): string {
  return Object.entries(amounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount))
    .join('\n') || '-'
}
</script>

<style scoped>
.payment-stat :deep(.ui-stat > strong) {
  overflow-wrap: anywhere;
  white-space: pre-line;
}
</style>
