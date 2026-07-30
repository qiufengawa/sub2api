<template>
  <section class="card flex h-full min-h-[360px] flex-col xl:h-[470px] xl:min-h-[470px]" data-testid="dashboard-model-breakdown">
    <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700">
      <div>
        <h2 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('dashboard.overview.costBreakdown') }}</h2>
        <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.costBreakdownDescription') }}</p>
      </div>
      <router-link to="/usage" class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
        {{ t('dashboard.overview.details') }}
      </router-link>
    </div>

    <div class="min-h-[268px] flex-1 p-4">
      <div v-if="loading" class="flex min-h-[236px] items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
      <div v-else-if="rows.length === 0" class="flex min-h-[236px] flex-col items-center justify-center text-center">
        <div class="flex h-9 w-9 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Icon name="chartBar" size="md" />
        </div>
        <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('dashboard.overview.noCostTitle') }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.noCostDescription') }}</p>
        <router-link to="/available-channels" class="btn btn-secondary btn-sm mt-3">
          {{ t('dashboard.overview.viewAvailableModels') }}
        </router-link>
      </div>
      <div v-else class="space-y-3.5">
        <div v-for="row in rows" :key="row.model" data-testid="model-cost-row" :data-model="row.model">
          <div class="mb-1.5 flex items-center gap-3 text-xs">
            <span class="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-200" :title="row.model">{{ row.model }}</span>
            <span class="shrink-0 font-mono text-gray-600 dark:text-dark-300">{{ formatMoney(row.actualCost) }}</span>
            <span class="w-11 shrink-0 text-right font-medium text-primary-600 dark:text-primary-400">{{ row.percent }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-[2px] bg-gray-100 dark:bg-dark-700">
            <div class="h-full rounded-[2px] bg-primary-500" :style="{ width: `${row.percent > 0 ? Math.max(1, row.percent) : 0}%`, opacity: row.opacity }" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import type { ModelStat } from '@/types'

const props = defineProps<{ models: ModelStat[]; loading: boolean }>()
const { t } = useI18n()

interface ModelRow {
  model: string
  actualCost: number
  percent: number
  opacity: number
}

const rows = computed(() => {
  const sorted = [...props.models]
    .filter((item) => item.actual_cost > 0)
    .sort((a, b) => b.actual_cost - a.actual_cost)
  const allCost = sorted.reduce((sum, item) => sum + item.actual_cost, 0)
  const visible = sorted.length > 5 ? sorted.slice(0, 4) : sorted.slice(0, 5)
  const result: ModelRow[] = visible.map((item, index) => ({
    model: item.model,
    actualCost: item.actual_cost,
    percent: allCost > 0 ? Math.round((item.actual_cost / allCost) * 100) : 0,
    opacity: Math.max(0.55, 1 - index * 0.09),
  }))
  if (sorted.length > 5) {
    const other = sorted.slice(4)
    const otherCost = other.reduce((sum, item) => sum + item.actual_cost, 0)
    result.push({
      model: t('dashboard.overview.otherModels'),
      actualCost: otherCost,
      percent: allCost > 0 ? Math.round((otherCost / allCost) * 100) : 0,
      opacity: 0.5,
    })
  }
  return result
})

const formatMoney = (value: number) => `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`
</script>
