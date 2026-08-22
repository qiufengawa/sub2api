<template>
  <div class="channel-interval-row" :class="{ 'channel-interval-row--invalid': isEmpty }">
    <template v-if="mode === 'token'">
      <UiTextField density="mini" :label="t('admin.channels.form.minTokens')" :model-value="interval.min_tokens" type="number" min="0" @update:model-value="emitField('min_tokens', toInt(String($event)))" />
      <UiTextField density="mini" :label="t('admin.channels.form.maxTokens')" :model-value="interval.max_tokens ?? ''" type="number" min="0" placeholder="∞" @update:model-value="emitField('max_tokens', toIntOrNull(String($event)))" />
      <UiTextField density="mini" :label="`${t('admin.channels.form.inputPrice')} $/M`" :model-value="interval.input_price ?? ''" type="number" min="0" step="any" :invalid="isEmpty && !interval.input_price" @update:model-value="emitField('input_price', String($event))" />
      <UiTextField density="mini" :label="`${t('admin.channels.form.outputPrice')} $/M`" :model-value="interval.output_price ?? ''" type="number" min="0" step="any" :invalid="isEmpty && !interval.output_price" @update:model-value="emitField('output_price', String($event))" />
      <UiTextField density="mini" :label="`${t('admin.channels.form.cacheWritePriceShort')} $/M`" :model-value="interval.cache_write_price ?? ''" type="number" min="0" step="any" @update:model-value="emitField('cache_write_price', String($event))" />
      <UiTextField density="mini" :label="`${t('admin.channels.form.cacheReadPriceShort')} $/M`" :model-value="interval.cache_read_price ?? ''" type="number" min="0" step="any" @update:model-value="emitField('cache_read_price', String($event))" />
      <template v-if="enableMultipliers">
        <UiTextField density="mini" :label="t('admin.channels.form.inputMultiplier')" :model-value="interval.input_multiplier ?? ''" type="number" min="0.000001" step="any" @update:model-value="emitField('input_multiplier', String($event))" />
        <UiTextField density="mini" :label="t('admin.channels.form.outputMultiplier')" :model-value="interval.output_multiplier ?? ''" type="number" min="0.000001" step="any" @update:model-value="emitField('output_multiplier', String($event))" />
        <UiTextField density="mini" :label="t('admin.channels.form.cacheWriteMultiplier')" :model-value="interval.cache_write_multiplier ?? ''" type="number" min="0.000001" step="any" @update:model-value="emitField('cache_write_multiplier', String($event))" />
        <UiTextField density="mini" :label="t('admin.channels.form.cacheReadMultiplier')" :model-value="interval.cache_read_multiplier ?? ''" type="number" min="0.000001" step="any" @update:model-value="emitField('cache_read_multiplier', String($event))" />
      </template>
    </template>
    <template v-else>
      <UiTextField density="mini" :label="mode === 'image' ? t('admin.channels.form.resolution') : t('admin.channels.form.tierLabel')" :model-value="interval.tier_label" :placeholder="mode === 'image' ? '1K / 2K / 4K' : ''" @update:model-value="emitField('tier_label', String($event))" />
      <UiTextField density="mini" :label="t('admin.channels.form.minTokens')" :model-value="interval.min_tokens" type="number" min="0" @update:model-value="emitField('min_tokens', toInt(String($event)))" />
      <UiTextField density="mini" :label="t('admin.channels.form.maxTokens')" :model-value="interval.max_tokens ?? ''" type="number" min="0" placeholder="∞" @update:model-value="emitField('max_tokens', toIntOrNull(String($event)))" />
      <UiTextField density="mini" :label="`${t('admin.channels.form.perRequestPrice')} $`" :model-value="interval.per_request_price ?? ''" type="number" min="0" step="any" :invalid="isEmpty && !interval.per_request_price" @update:model-value="emitField('per_request_price', String($event))" />
    </template>
    <UiIconButton icon="x" :label="t('common.delete')" variant="danger" density="mini" @click="emit('remove')" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IntervalFormEntry } from './types'
import type { BillingMode } from '@/api/admin/channels'
import { UiIconButton, UiTextField } from '@/components/ui'

const { t } = useI18n()
const props = defineProps<{ interval: IntervalFormEntry; mode: BillingMode; enableMultipliers?: boolean }>()
const emit = defineEmits<{ update: [interval: IntervalFormEntry]; remove: [] }>()

const isEmpty = computed(() => {
  const iv = props.interval
  return (iv.input_price == null || iv.input_price === '') &&
    (iv.output_price == null || iv.output_price === '') &&
    (iv.cache_write_price == null || iv.cache_write_price === '') &&
    (iv.cache_read_price == null || iv.cache_read_price === '') &&
    (iv.input_multiplier == null || iv.input_multiplier === '') &&
    (iv.output_multiplier == null || iv.output_multiplier === '') &&
    (iv.cache_write_multiplier == null || iv.cache_write_multiplier === '') &&
    (iv.cache_read_multiplier == null || iv.cache_read_multiplier === '') &&
    (iv.per_request_price == null || iv.per_request_price === '')
})

function emitField(field: keyof IntervalFormEntry, value: string | number | null) {
  emit('update', { ...props.interval, [field]: value === '' ? null : value })
}
function toInt(value: string): number { const n = parseInt(value, 10); return Number.isNaN(n) ? 0 : n }
function toIntOrNull(value: string): number | null { if (value === '') return null; const n = parseInt(value, 10); return Number.isNaN(n) ? null : n }
</script>

<style scoped>
.channel-interval-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr)) auto;align-items:end;gap:8px;padding:10px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);background:var(--ui-surface)}
.channel-interval-row--invalid{border-color:var(--ui-danger);background:color-mix(in srgb,var(--ui-danger) 5%,var(--ui-surface))}
@media(max-width:900px){.channel-interval-row{grid-template-columns:repeat(2,minmax(0,1fr))}.channel-interval-row>.ui-icon-button{justify-self:end}}
</style>
