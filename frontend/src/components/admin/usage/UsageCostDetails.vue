<template>
  <UiTooltip width-class="usage-cost-tooltip">
    <UiIconButton
      data-testid="cost-details-trigger"
      icon="infoCircle"
      variant="ghost"
      density="mini"
      :label="t('usage.costDetails')"
    />
    <template #content>
      <div class="usage-cost-details">
        <strong>{{ t('usage.costDetails') }}</strong>
        <div v-if="row.input_cost > 0" class="usage-cost-details__row">
          <span>{{ t('admin.usage.inputCost') }}</span><b>${{ row.input_cost.toFixed(6) }}</b>
        </div>
        <div v-if="hasImageInputCost(row)" class="usage-cost-details__row">
          <span>{{ t('usage.imageInputCost') }}</span><b>${{ row.image_input_cost.toFixed(6) }}</b>
        </div>
        <div v-if="row.output_cost > 0" class="usage-cost-details__row">
          <span>{{ t('admin.usage.outputCost') }}</span><b>${{ row.output_cost.toFixed(6) }}</b>
        </div>
        <div v-if="hasImageOutputCost(row)" class="usage-cost-details__row">
          <span>{{ t('usage.imageOutputCost') }}</span><b>${{ row.image_output_cost.toFixed(6) }}</b>
        </div>

        <template v-if="!isImageUsage(row) && (!row.billing_mode || row.billing_mode === BILLING_MODE_TOKEN)">
          <div v-if="textInputTokens(row) > 0" class="usage-cost-details__row">
            <span>{{ t('usage.inputTokenPrice') }}</span>
            <b>{{ formatTokenPricePerMillion(row.input_cost, textInputTokens(row)) }} {{ t('usage.perMillionTokens') }}</b>
          </div>
          <div v-if="hasImageInputTokens(row)" class="usage-cost-details__row">
            <span>{{ t('usage.imageInputTokenPrice') }}</span>
            <b>{{ formatTokenPricePerMillion(row.image_input_cost ?? 0, row.image_input_tokens) }} {{ t('usage.perMillionTokens') }}</b>
          </div>
          <div v-if="row.output_cost > 0 && textOutputTokens(row) > 0" class="usage-cost-details__row">
            <span>{{ t('usage.outputTokenPrice') }}</span>
            <b>{{ formatTokenPricePerMillion(row.output_cost, textOutputTokens(row)) }} {{ t('usage.perMillionTokens') }}</b>
          </div>
          <div v-if="hasImageOutputTokens(row)" class="usage-cost-details__row">
            <span>{{ t('usage.imageOutputTokenPrice') }}</span>
            <b>{{ formatTokenPricePerMillion(row.image_output_cost ?? 0, row.image_output_tokens) }} {{ t('usage.perMillionTokens') }}</b>
          </div>
        </template>

        <template v-else-if="isImageUsage(row)">
          <div class="usage-cost-details__row"><span>{{ t('usage.imageCount') }}</span><b>{{ row.image_count }}{{ t('usage.imageUnit') }}</b></div>
          <div class="usage-cost-details__row"><span>{{ t('usage.imageBillingSize') }}</span><b>{{ formatImageBillingSize(row, t) }}</b></div>
          <div class="usage-cost-details__row"><span>{{ t('usage.imageSizeSource') }}</span><b>{{ formatImageSizeSource(row, t) }}</b></div>
          <div class="usage-cost-details__row"><span>{{ t('usage.imageInputSize') }}</span><b>{{ formatImageInputSize(row, t) }}</b></div>
          <div class="usage-cost-details__row"><span>{{ t('usage.imageOutputSize') }}</span><b>{{ formatImageOutputSize(row, t) }}</b></div>
          <div v-if="formatImageSizeBreakdown(row)" class="usage-cost-details__row">
            <span>{{ t('usage.imageSizeBreakdown') }}</span><b>{{ formatImageSizeBreakdown(row) }}</b>
          </div>
          <div class="usage-cost-details__row"><span>{{ t('usage.imageUnitPrice') }}</span><b>${{ imageUnitPrice(row).toFixed(6) }}</b></div>
          <div class="usage-cost-details__row"><span>{{ t('usage.imageTotalPrice') }}</span><b>${{ row.total_cost?.toFixed(6) || '0.000000' }}</b></div>
        </template>

        <div v-else class="usage-cost-details__row">
          <span>{{ t('usage.unitPrice') }}</span><b>${{ row.total_cost?.toFixed(6) || '0.000000' }}</b>
        </div>
        <div v-if="row.cache_creation_cost > 0" class="usage-cost-details__row">
          <span>{{ t('admin.usage.cacheCreationCost') }}</span><b>${{ row.cache_creation_cost.toFixed(6) }}</b>
        </div>
        <div v-if="row.cache_read_cost > 0" class="usage-cost-details__row">
          <span>{{ t('admin.usage.cacheReadCost') }}</span><b>${{ row.cache_read_cost.toFixed(6) }}</b>
        </div>

        <div class="usage-cost-details__row usage-cost-details__summary">
          <span>{{ t('usage.serviceTier') }}</span><b>{{ getUsageServiceTierLabel(row.service_tier, t) }}</b>
        </div>
        <div class="usage-cost-details__row"><span>{{ t('usage.rate') }}</span><b>{{ formatMultiplier(row.rate_multiplier || 1) }}x</b></div>
        <div class="usage-cost-details__row"><span>{{ t('usage.original') }}</span><b>${{ row.total_cost?.toFixed(6) || '0.000000' }}</b></div>
        <div class="usage-cost-details__row"><span>{{ t('usage.userBilled') }}</span><b>${{ row.actual_cost?.toFixed(6) || '0.000000' }}</b></div>
        <template v-if="showAccountBilling">
          <div class="usage-cost-details__row usage-cost-details__summary">
            <span>{{ t('usage.accountMultiplier') }}</span><b>{{ formatMultiplier(row.account_rate_multiplier ?? 1) }}x</b>
          </div>
          <div class="usage-cost-details__row"><span>{{ t('usage.accountBilled') }}</span><b>${{ accountBilled.toFixed(6) }}</b></div>
        </template>
      </div>
    </template>
  </UiTooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiIconButton, UiTooltip } from '@/components/ui'
import type { AdminUsageLog } from '@/types'
import { BILLING_MODE_TOKEN, imageUnitPrice, isImageUsage } from '@/utils/billingMode'
import { formatMultiplier } from '@/utils/formatters'
import {
  formatImageBillingSize,
  formatImageInputSize,
  formatImageOutputSize,
  formatImageSizeBreakdown,
  formatImageSizeSource,
  hasImageInputCost,
  hasImageInputTokens,
  hasImageOutputCost,
  hasImageOutputTokens,
  textInputTokens,
  textOutputTokens,
} from '@/utils/imageUsage'
import { formatTokenPricePerMillion } from '@/utils/usagePricing'
import { getUsageServiceTierLabel } from '@/utils/usageServiceTier'

const props = defineProps<{
  row: AdminUsageLog
  showAccountBilling?: boolean
}>()
const { t } = useI18n()
const accountBilled = computed(() => {
  const base = props.row.account_stats_cost != null ? props.row.account_stats_cost : (props.row.total_cost ?? 0)
  const result = base * (props.row.account_rate_multiplier ?? 1)
  return Number.isNaN(result) ? 0 : result
})
</script>

<style scoped>
.usage-cost-details {
  display: grid;
  min-width: 300px;
  gap: 5px;
}

.usage-cost-details > strong {
  color: #fff;
  font-weight: 600;
}

.usage-cost-details__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  color: #c8c6c1;
}

.usage-cost-details__row b {
  color: #fff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.usage-cost-details__summary {
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px solid rgb(255 255 255 / 0.14);
}
</style>
