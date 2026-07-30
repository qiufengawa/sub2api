<template>
  <div
    class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] leading-4 text-gray-500 dark:text-gray-400"
  >
    <span class="inline-flex items-center gap-1" :title="t('admin.accounts.usageWindow.requests')">
      <Icon name="chartBar" size="xs" :stroke-width="1.8" class="text-blue-500 dark:text-blue-400" />
      <span>{{ t('admin.accounts.usageWindow.requests') }}</span>
      <span class="font-medium tabular-nums text-gray-700 dark:text-gray-200">{{ formattedRequests }}</span>
    </span>
    <span class="inline-flex items-center gap-1" :title="t('admin.accounts.usageWindow.tokens')">
      <Icon name="database" size="xs" :stroke-width="1.8" class="text-violet-500 dark:text-violet-400" />
      <span>{{ t('admin.accounts.usageWindow.tokens') }}</span>
      <span class="font-medium tabular-nums text-gray-700 dark:text-gray-200">{{ formattedTokens }}</span>
    </span>
    <span class="inline-flex items-center gap-1" :title="t('usage.accountBilled')">
      <Icon name="dollar" size="xs" :stroke-width="1.8" class="text-emerald-500 dark:text-emerald-400" />
      <span>{{ t('admin.accounts.usageWindow.accountCost') }}</span>
      <span class="font-medium tabular-nums text-gray-700 dark:text-gray-200">${{ formattedAccountCost }}</span>
    </span>
    <span
      v-if="stats.user_cost != null"
      class="inline-flex items-center gap-1"
      :title="t('usage.userBilled')"
    >
      <Icon name="creditCard" size="xs" :stroke-width="1.8" class="text-cyan-500 dark:text-cyan-400" />
      <span>{{ t('admin.accounts.usageWindow.userCost') }}</span>
      <span class="font-medium tabular-nums text-gray-700 dark:text-gray-200">${{ formattedUserCost }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WindowStats } from '@/types'
import { formatCompactNumber } from '@/utils/format'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{
  stats: WindowStats
}>()

const { t } = useI18n()

const formattedRequests = computed(() =>
  formatCompactNumber(props.stats.requests, { allowBillions: false })
)
const formattedTokens = computed(() => formatCompactNumber(props.stats.tokens))
const formattedAccountCost = computed(() => props.stats.cost.toFixed(2))
const formattedUserCost = computed(() => (props.stats.user_cost ?? 0).toFixed(2))
</script>
