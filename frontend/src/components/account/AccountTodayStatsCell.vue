<template>
  <div class="account-today-stats">
    <div v-if="props.loading && !props.stats" class="account-today-stats__loading" aria-busy="true">
      <UiSkeleton variant="text" width="48px" />
      <UiSkeleton variant="text" width="64px" />
      <UiSkeleton variant="text" width="40px" />
    </div>

    <div v-else-if="props.error && !props.stats" class="account-today-stats__error">
      {{ props.error }}
    </div>

    <dl v-else-if="props.stats" class="account-today-stats__metrics">
      <div>
        <dt>{{ t('admin.accounts.stats.requests') }}</dt>
        <dd>{{ formatNumber(props.stats.requests) }}</dd>
      </div>
      <div>
        <dt>{{ t('admin.accounts.stats.tokens') }}</dt>
        <dd>{{ formatTokens(props.stats.tokens) }}</dd>
      </div>
      <div>
        <dt>{{ t('usage.accountBilled') }}</dt>
        <dd class="is-positive">{{ formatCurrency(props.stats.cost) }}</dd>
      </div>
      <div v-if="props.stats.user_cost != null">
        <dt>{{ t('usage.userBilled') }}</dt>
        <dd>{{ formatCurrency(props.stats.user_cost) }}</dd>
      </div>
    </dl>

    <div v-else class="account-today-stats__empty">-</div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { WindowStats } from '@/types'
import { formatNumber, formatCurrency } from '@/utils/format'
import { UiSkeleton } from '@/components/ui'

const props = withDefaults(
  defineProps<{
    stats?: WindowStats | null
    loading?: boolean
    error?: string | null
  }>(),
  {
    stats: null,
    loading: false,
    error: null
  }
)

const { t } = useI18n()

// Format large token numbers (e.g., 1234567 -> 1.23M)
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}
</script>

<style scoped>
.account-today-stats{min-width:112px;font-size:11px;line-height:16px}.account-today-stats__loading{display:grid;gap:3px}.account-today-stats__error{color:var(--ui-danger)}.account-today-stats__metrics{display:grid;gap:2px;margin:0}.account-today-stats__metrics>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.account-today-stats__metrics dt,.account-today-stats__metrics dd{margin:0}.account-today-stats__metrics dt{color:var(--ui-text-muted)}.account-today-stats__metrics dd{color:var(--ui-text);font-weight:600;font-variant-numeric:tabular-nums}.account-today-stats__metrics dd.is-positive{color:var(--ui-success)}.account-today-stats__empty{color:var(--ui-text-soft)}
</style>
