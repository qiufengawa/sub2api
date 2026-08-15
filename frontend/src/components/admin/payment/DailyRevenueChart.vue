<template>
  <UiChartFrame
    :title="t('payment.admin.dailyRevenue')"
    :loading="loading"
    :empty="!chartData"
    :height="240"
  >
    <Line v-if="chartData" :data="chartData" :options="chartOptions" />
  </UiChartFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { DailyPaymentStats } from '@/types/payment'
import { UiChartFrame } from '@/components/ui'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const { t } = useI18n()
const props = withDefaults(defineProps<{ data: DailyPaymentStats[]; loading?: boolean }>(), { loading: false })

const colors = [
  ['rgb(36, 154, 255)', 'rgba(36, 154, 255, 0.08)'],
  ['rgb(48, 149, 59)', 'rgba(48, 149, 59, 0.08)'],
  ['rgb(167, 100, 8)', 'rgba(167, 100, 8, 0.08)'],
  ['rgb(213, 37, 21)', 'rgba(213, 37, 21, 0.08)'],
]

const chartData = computed(() => {
  if (!props.data.length) return null
  const currencies = [...new Set(props.data.flatMap(day => Object.keys(day.amount)))].sort()
  return {
    labels: props.data.map(day => day.date),
    datasets: [
      ...currencies.map((currency, index) => {
        const [borderColor, backgroundColor] = colors[index % colors.length]
        return {
          label: `${currency} ${t('payment.admin.revenue')}`,
          data: props.data.map(day => day.amount[currency] || 0),
          borderColor,
          backgroundColor,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        }
      }),
      {
        label: t('payment.admin.orderCount'),
        data: props.data.map(day => day.count),
        borderColor: 'rgb(48, 149, 59)',
        backgroundColor: 'rgba(48, 149, 59, 0.08)',
        fill: false,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 4,
        yAxisID: 'y1',
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  animation: { duration: 180 },
  scales: {
    y: { type: 'linear' as const, display: true, position: 'left' as const, title: { display: true, text: t('payment.admin.revenue') } },
    y1: { type: 'linear' as const, display: true, position: 'right' as const, title: { display: true, text: t('payment.admin.orderCount') }, grid: { drawOnChartArea: false } },
  },
  plugins: { legend: { position: 'top' as const } },
}
</script>
