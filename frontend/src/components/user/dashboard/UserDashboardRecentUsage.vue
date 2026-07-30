<template>
  <section class="card flex h-full min-h-[360px] flex-col xl:h-[470px] xl:min-h-[470px]" data-testid="dashboard-activity-card">
    <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700">
      <div>
        <h2 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('dashboard.overview.recentActivity') }}</h2>
        <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.recentActivityDescription') }}</p>
      </div>
    </div>

    <div class="min-h-[268px] flex-1 px-4 py-2">
      <div v-if="loading" class="flex min-h-[252px] items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
      <div v-else-if="activities.length === 0" class="flex min-h-[252px] flex-col items-center justify-center text-center">
        <div class="flex h-9 w-9 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Icon name="clock" size="md" />
        </div>
        <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('dashboard.overview.noActivityTitle') }}</p>
        <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.noActivityDescription') }}</p>
      </div>
      <div v-else class="divide-y divide-gray-100 dark:divide-dark-700">
        <div v-for="item in activities" :key="item.key" class="flex items-start gap-3 py-3">
          <div
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px]"
            :class="item.kind === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400'"
          >
            <Icon :name="item.kind === 'success' ? 'checkCircle' : 'xCircle'" size="sm" :stroke-width="1.8" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="item.model">{{ item.model || '-' }}</p>
              <span class="shrink-0 text-[11px] text-gray-400 dark:text-dark-500">{{ formatRelativeTime(item.createdAt) }}</span>
            </div>
            <p v-if="item.kind === 'success'" class="mt-1 text-xs text-gray-500 dark:text-dark-400">
              {{ t('dashboard.overview.successActivityMeta', { cost: formatCost(item.cost), duration: formatDuration(item.duration) }) }}
            </p>
            <p v-else class="mt-1 truncate text-xs text-red-600 dark:text-red-400" :title="item.message">
              {{ item.statusCode }} · {{ item.message || t('dashboard.overview.requestFailed') }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-xs dark:border-dark-700">
      <router-link to="/usage" class="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
        {{ t('dashboard.viewAllUsage') }}
      </router-link>
      <router-link
        v-if="showErrors"
        :to="{ path: '/usage', query: { tab: 'errors' } }"
        class="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
      >
        {{ t('dashboard.overview.viewFailedRequests') }}
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import { formatRelativeTime } from '@/utils/format'
import type { UsageLog, UserErrorRequest } from '@/types'

const props = withDefaults(defineProps<{
  data: UsageLog[]
  errors?: UserErrorRequest[]
  showErrors?: boolean
  loading: boolean
}>(), {
  errors: () => [],
  showErrors: false,
})

const { t } = useI18n()

type Activity =
  | { key: string; kind: 'success'; model: string; createdAt: string; cost: number; duration: number | null }
  | { key: string; kind: 'error'; model: string; createdAt: string; statusCode: number; message: string }

const activities = computed<Activity[]>(() => {
  const successes: Activity[] = props.data.map((item) => ({
    key: `success-${item.id}`,
    kind: 'success',
    model: item.model,
    createdAt: item.created_at,
    cost: item.actual_cost,
    duration: item.duration_ms,
  }))
  const failures: Activity[] = props.errors.map((item) => ({
    key: `error-${item.id}`,
    kind: 'error',
    model: item.model,
    createdAt: item.created_at,
    statusCode: item.status_code,
    message: item.message,
  }))
  return [...successes, ...failures]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
})

const formatCost = (value: number) => `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`
const formatDuration = (value: number | null) => {
  if (value === null || value < 0) return '-'
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`
}
</script>
