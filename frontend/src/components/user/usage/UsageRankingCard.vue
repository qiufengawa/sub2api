<template>
  <section class="rounded border border-gray-200 bg-white p-3 dark:border-dark-700 dark:bg-dark-800">
    <header class="mb-3 flex items-center justify-between gap-3">
      <h3 class="truncate text-sm font-semibold text-gray-900 dark:text-white">
        {{ title }}
      </h3>
      <div class="inline-flex shrink-0 rounded-[3px] border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-700 dark:bg-dark-900">
        <button
          type="button"
          class="rounded-[3px] px-2 py-1 text-[11px] font-medium transition-colors"
          :class="metric === 'tokens' ? activeMetricClass : inactiveMetricClass"
          @click="emit('update:metric', 'tokens')"
        >
          {{ t('admin.dashboard.metricTokens') }}
        </button>
        <button
          type="button"
          class="rounded-[3px] px-2 py-1 text-[11px] font-medium transition-colors"
          :class="metric === 'actual_cost' ? activeMetricClass : inactiveMetricClass"
          @click="emit('update:metric', 'actual_cost')"
        >
          {{ t('admin.dashboard.metricActualCost') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="flex h-40 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div v-else-if="items.length" class="space-y-2.5">
      <div v-for="(item, index) in items" :key="item.key" class="space-y-1">
        <div class="flex items-center justify-between gap-3 text-xs">
          <div class="flex min-w-0 items-center gap-2">
            <span class="w-4 shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-dark-500">
              {{ index + 1 }}
            </span>
            <span class="truncate font-medium text-gray-700 dark:text-gray-200" :title="item.label">
              {{ item.label }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-2 tabular-nums">
            <span class="text-[10px] text-gray-400 dark:text-dark-500">{{ item.meta }}</span>
            <span class="font-medium text-gray-800 dark:text-gray-100">{{ item.valueLabel }}</span>
          </div>
        </div>
        <div class="ml-6 h-1.5 overflow-hidden rounded-sm bg-primary-50 dark:bg-dark-700">
          <div
            class="h-full rounded-sm bg-primary-500"
            :style="{ width: `${Math.max(item.percentage, 2)}%`, opacity: String(Math.max(0.48, 1 - index * 0.09)) }"
          ></div>
        </div>
      </div>
    </div>
    <div v-else class="flex h-40 items-center justify-center text-xs text-gray-500 dark:text-dark-400">
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

export interface UsageRankingItem {
  key: string
  label: string
  value: number
  valueLabel: string
  meta: string
  percentage: number
}

withDefaults(defineProps<{
  title: string
  items: UsageRankingItem[]
  metric: 'tokens' | 'actual_cost'
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:metric': [value: 'tokens' | 'actual_cost']
}>()

const { t } = useI18n()
const activeMetricClass = 'bg-white text-primary-700 shadow-sm dark:bg-dark-700 dark:text-primary-300'
const inactiveMetricClass = 'text-gray-500 hover:text-gray-700 dark:text-dark-400 dark:hover:text-gray-200'
</script>
