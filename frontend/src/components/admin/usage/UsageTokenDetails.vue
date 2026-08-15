<template>
  <UiTooltip width-class="usage-token-tooltip">
    <UiIconButton
      data-testid="token-details-trigger"
      icon="infoCircle"
      variant="ghost"
      density="mini"
      :label="t('usage.tokenDetails')"
    />
    <template #content>
      <div class="usage-token-details">
        <strong>{{ t('usage.tokenDetails') }}</strong>
        <div v-if="row.input_tokens > 0 && !hasImageInputTokens(row)" class="usage-token-details__row">
          <span>{{ t('admin.usage.inputTokens') }}</span>
          <b>{{ row.input_tokens.toLocaleString() }}</b>
        </div>
        <div v-if="hasImageInputTokens(row) && textInputTokens(row) > 0" class="usage-token-details__row">
          <span>{{ t('admin.usage.inputTokens') }}</span>
          <b>{{ textInputTokens(row).toLocaleString() }}</b>
        </div>
        <div v-if="hasImageInputTokens(row)" class="usage-token-details__row">
          <span>{{ t('usage.imageInputTokens') }}</span>
          <b>{{ row.image_input_tokens.toLocaleString() }}</b>
        </div>
        <div v-if="row.output_tokens > 0 && !hasImageOutputTokens(row)" class="usage-token-details__row">
          <span>{{ t('admin.usage.outputTokens') }}</span>
          <b>{{ row.output_tokens.toLocaleString() }}</b>
        </div>
        <div v-if="hasImageOutputTokens(row) && textOutputTokens(row) > 0" class="usage-token-details__row">
          <span>{{ t('admin.usage.outputTokens') }}</span>
          <b>{{ textOutputTokens(row).toLocaleString() }}</b>
        </div>
        <div v-if="hasImageOutputTokens(row)" class="usage-token-details__row">
          <span>{{ t('usage.imageOutputTokens') }}</span>
          <b>{{ row.image_output_tokens.toLocaleString() }}</b>
        </div>
        <template v-if="row.cache_creation_tokens > 0">
          <div v-if="row.cache_creation_5m_tokens > 0" class="usage-token-details__row">
            <span>{{ t('admin.usage.cacheCreation5mTokens') }} <UiBadge tone="warning">5m</UiBadge></span>
            <b>{{ row.cache_creation_5m_tokens.toLocaleString() }}</b>
          </div>
          <div v-if="row.cache_creation_1h_tokens > 0" class="usage-token-details__row">
            <span>{{ t('admin.usage.cacheCreation1hTokens') }} <UiBadge tone="warning">1h</UiBadge></span>
            <b>{{ row.cache_creation_1h_tokens.toLocaleString() }}</b>
          </div>
          <div
            v-if="row.cache_creation_5m_tokens <= 0 && row.cache_creation_1h_tokens <= 0"
            class="usage-token-details__row"
          >
            <span>{{ t('admin.usage.cacheCreationTokens') }}</span>
            <b>{{ row.cache_creation_tokens.toLocaleString() }}</b>
          </div>
        </template>
        <div v-if="row.cache_ttl_overridden" class="usage-token-details__row usage-token-details__row--warning">
          <span>
            {{ t('usage.cacheTtlOverriddenLabel') }}
            <UiBadge tone="danger">R-{{ row.cache_creation_1h_tokens > 0 ? '5m' : '1H' }}</UiBadge>
          </span>
          <b>{{ row.cache_creation_1h_tokens > 0 ? t('usage.cacheTtlOverridden1h') : t('usage.cacheTtlOverridden5m') }}</b>
        </div>
        <div v-if="row.cache_read_tokens > 0" class="usage-token-details__row">
          <span>{{ t('admin.usage.cacheReadTokens') }}</span>
          <b>{{ row.cache_read_tokens.toLocaleString() }}</b>
        </div>
        <div class="usage-token-details__row usage-token-details__total">
          <span>{{ t('usage.totalTokens') }}</span>
          <b>{{ totalTokens.toLocaleString() }}</b>
        </div>
      </div>
    </template>
  </UiTooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiBadge, UiIconButton, UiTooltip } from '@/components/ui'
import type { AdminUsageLog } from '@/types'
import {
  hasImageInputTokens,
  hasImageOutputTokens,
  textInputTokens,
  textOutputTokens,
} from '@/utils/imageUsage'

const props = defineProps<{ row: AdminUsageLog }>()
const { t } = useI18n()
const totalTokens = computed(() =>
  (props.row.input_tokens || 0)
  + (props.row.output_tokens || 0)
  + (props.row.cache_creation_tokens || 0)
  + (props.row.cache_read_tokens || 0)
)
</script>

<style scoped>
.usage-token-details {
  display: grid;
  min-width: 250px;
  gap: 5px;
}

.usage-token-details > strong {
  margin-bottom: 2px;
  color: #fff;
  font-weight: 600;
}

.usage-token-details__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: #c8c6c1;
}

.usage-token-details__row > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.usage-token-details__row b {
  color: #fff;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.usage-token-details__row--warning b {
  color: #ffb9b1;
}

.usage-token-details__total {
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px solid rgb(255 255 255 / 0.14);
}
</style>
