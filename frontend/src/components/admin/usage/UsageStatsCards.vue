<template>
  <AppGrid
    class="usage-stats"
    min="170px"
    :gap="compact ? 12 : 16"
    :data-variant="userVariant ? 'user' : 'admin'"
  >
    <UiStatMetric
      :label="t('usage.totalRequests')"
      :value="stats?.total_requests?.toLocaleString() || '0'"
      :context="t('usage.inSelectedRange')"
    />

    <UiStatMetric :label="t('usage.totalTokens')" :value="formatTokens(stats?.total_tokens || 0)">
      <template #context>
        <div class="usage-stats__details">
          <span>{{ t('usage.in') }}: {{ formatTokens(stats?.total_input_tokens || 0) }}</span>
          <span>{{ t('usage.out') }}: {{ formatTokens(stats?.total_output_tokens || 0) }}</span>
          <UiTooltip width-class="usage-stats__tooltip">
            <span class="usage-stats__cache-trigger" tabindex="0">
              {{ t('usage.cacheTotal') }}: {{ formatTokens(stats?.total_cache_tokens || 0) }}
              <Icon name="infoCircle" size="xs" />
            </span>
            <template #content>
              <div class="usage-stats__breakdown">
                <strong>{{ t('usage.cacheBreakdown') }}</strong>
                <span>
                  <span>{{ t('usage.cacheCreationTokensLabel') }}</span>
                  <b>{{ formatTokens(stats?.total_cache_creation_tokens || 0) }}</b>
                </span>
                <span>
                  <span>{{ t('usage.cacheReadTokensLabel') }}</span>
                  <b>{{ formatTokens(stats?.total_cache_read_tokens || 0) }}</b>
                </span>
                <span>
                  <span>{{ t('usage.cacheTotal') }}</span>
                  <b>{{ formatTokens(stats?.total_cache_tokens || 0) }}</b>
                </span>
                <span v-if="showCacheHitRate" class="usage-stats__breakdown-total">
                  <span>{{ t('usage.cacheHitRate') }}</span>
                  <b>{{ cacheTokenReuseRate.toFixed(1) }}%</b>
                </span>
                <small v-if="showCacheHitRate">{{ t('usage.cacheHitRateFormula') }}</small>
              </div>
            </template>
          </UiTooltip>
          <UiBadge v-if="showCacheHitRate" tone="info">
            {{ t('usage.cacheHitRateShort') }} {{ cacheTokenReuseRate.toFixed(1) }}%
          </UiBadge>
        </div>
      </template>
    </UiStatMetric>

    <UiStatMetric
      :label="t('usage.totalCost')"
      :value="`$${(stats?.total_actual_cost || 0).toFixed(4)}`"
    >
      <template #context>
        <div class="usage-stats__details">
          <span v-if="showAccountCost && totalAccountCost != null">
            {{ t('usage.accountCost') }} ${{ totalAccountCost.toFixed(4) }}
          </span>
          <span>
            {{ t('usage.standardCost') }}
            <span :class="{ 'usage-stats__struck': strikeStandardCost }">
              ${{ (stats?.total_cost || 0).toFixed(4) }}
            </span>
          </span>
        </div>
      </template>
    </UiStatMetric>

    <UiStatMetric
      :label="t('usage.avgDuration')"
      :value="formatDuration(stats?.average_duration_ms || 0)"
    />
  </AppGrid>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AdminUsageStatsResponse } from '@/api/admin/usage'
import type { UsageStatsResponse } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import { AppGrid, UiBadge, UiStatMetric, UiTooltip } from '@/components/ui'
import { calculateCacheTokenReuseRate } from '@/utils/usageMetrics'

const props = withDefaults(defineProps<{
  stats: (AdminUsageStatsResponse | UsageStatsResponse) | null
  showAccountCost?: boolean
  strikeStandardCost?: boolean
  compact?: boolean
  userVariant?: boolean
  showCacheHitRate?: boolean
}>(), {
  showAccountCost: true,
  strikeStandardCost: false,
  compact: false,
  userVariant: false,
  showCacheHitRate: false,
})

const { t } = useI18n()

const totalAccountCost = computed(() => {
  const stats = props.stats as (AdminUsageStatsResponse & { total_account_cost?: number }) | null
  return stats?.total_account_cost ?? null
})
const showAccountCost = computed(() => props.showAccountCost)
const strikeStandardCost = computed(() => props.strikeStandardCost)
const compact = computed(() => props.compact)
const userVariant = computed(() => props.userVariant)
const showCacheHitRate = computed(() => props.showCacheHitRate)
const cacheTokenReuseRate = computed(() => calculateCacheTokenReuseRate(
  props.stats?.total_input_tokens,
  props.stats?.total_cache_creation_tokens,
  props.stats?.total_cache_read_tokens
))

const formatDuration = (ms: number) =>
  ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`

const formatTokens = (value: number) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toLocaleString()
}
</script>

<style scoped>
.usage-stats__details {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 8px;
  font-variant-numeric: tabular-nums;
}

.usage-stats__cache-trigger {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--ui-text-muted);
  cursor: help;
}

.usage-stats__breakdown {
  display: grid;
  min-width: 210px;
  gap: 5px;
}

.usage-stats__breakdown > span {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}

.usage-stats__breakdown strong,
.usage-stats__breakdown b {
  color: #fff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.usage-stats__breakdown-total {
  margin-top: 2px;
  padding-top: 5px;
  border-top: 1px solid rgb(255 255 255 / 0.14);
}

.usage-stats__breakdown small {
  color: #b9b7b1;
}

.usage-stats__struck {
  text-decoration: line-through;
}
</style>
