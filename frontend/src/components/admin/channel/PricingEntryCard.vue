<template>
  <section class="channel-pricing-entry">
    <header class="channel-pricing-entry__header" @click="collapsed = !collapsed">
      <Icon :name="collapsed ? 'chevronRight' : 'chevronDown'" size="sm" class="channel-pricing-entry__chevron" />
      <div class="channel-pricing-entry__summary">
        <div v-if="collapsed" class="channel-pricing-entry__models">
          <span v-for="model in entry.models.slice(0, 3)" :key="model" class="channel-pricing-entry__model">{{ model }}</span>
          <span v-if="entry.models.length > 3" class="channel-pricing-entry__more">+{{ entry.models.length - 3 }}</span>
          <span v-if="entry.models.length === 0" class="channel-pricing-entry__more">{{ t('admin.channels.form.noModels') }}</span>
        </div>
        <span v-else class="channel-pricing-entry__title">{{ t('admin.channels.form.pricingEntry') }}</span>
        <UiBadge :label="billingModeLabel" tone="neutral" />
      </div>
      <UiIconButton icon="trash" :label="t('common.delete')" variant="danger" density="mini" @click.stop="emit('remove')" />
    </header>

    <Transition name="ui-collapse"><div v-if="!collapsed" class="channel-pricing-entry__body">
      <div class="channel-pricing-entry__topline">
        <ModelTagInput :models="entry.models" :platform="platform" :placeholder="t('admin.channels.form.modelsPlaceholder')" @update:models="onModelsUpdate" />
        <UiSelect :model-value="entry.billing_mode" :label="t('admin.channels.form.billingMode')" :options="billingModeOptions" density="compact" @update:model-value="emit('update', { ...entry, billing_mode: $event as BillingMode, intervals: [] })" />
      </div>

      <template v-if="entry.billing_mode === 'token'">
        <div class="channel-pricing-entry__section-title">{{ t('admin.channels.form.defaultPrices') }} <span>$/MTok</span></div>
        <div class="channel-pricing-entry__price-grid">
          <UiTextField v-for="field in tokenPriceFields" :key="field.key" density="mini" :label="field.label" type="number" min="0" step="any" :model-value="entry[field.key] ?? ''" @update:model-value="emitField(field.key, String($event))" />
        </div>
        <div v-if="!hideTokenIntervals" class="channel-pricing-entry__subsection">
          <div class="channel-pricing-entry__subhead"><span>{{ t('admin.channels.form.intervals') }} <small>(min, max]</small></span><UiButton density="mini" variant="quiet" type="button" @click="addInterval"><template #icon><Icon name="plus" size="xs" /></template>{{ t('admin.channels.form.addInterval') }}</UiButton></div>
          <div v-if="entry.intervals?.length" class="channel-pricing-entry__intervals"><IntervalRow v-for="(iv, idx) in entry.intervals" :key="idx" :interval="iv" :mode="entry.billing_mode" @update="updateInterval(idx, $event)" @remove="removeInterval(idx)" /></div>
        </div>
      </template>

      <template v-else-if="entry.billing_mode === 'per_request'">
        <UiTextField density="compact" :label="`${t('admin.channels.form.defaultPerRequestPrice')} $`" type="number" min="0" step="any" :model-value="entry.per_request_price ?? ''" @update:model-value="emitField('per_request_price', String($event))" />
        <div class="channel-pricing-entry__subsection"><div class="channel-pricing-entry__subhead"><span>{{ t('admin.channels.form.requestTiers') }}</span><UiButton density="mini" variant="quiet" type="button" @click="addInterval"><template #icon><Icon name="plus" size="xs" /></template>{{ t('admin.channels.form.addTier') }}</UiButton></div><div v-if="entry.intervals?.length" class="channel-pricing-entry__intervals"><IntervalRow v-for="(iv, idx) in entry.intervals" :key="idx" :interval="iv" :mode="entry.billing_mode" @update="updateInterval(idx, $event)" @remove="removeInterval(idx)" /></div><UiEmptyState v-else compact :title="t('admin.channels.form.noTiersYet')" /></div>
      </template>

      <template v-else>
        <UiTextField density="compact" :label="`${entry.billing_mode === 'video' ? t('admin.channels.form.defaultVideoPrice') : t('admin.channels.form.defaultImagePrice')} $`" type="number" min="0" step="any" :model-value="entry.per_request_price ?? ''" @update:model-value="emitField('per_request_price', String($event))" />
        <div class="channel-pricing-entry__subsection"><div class="channel-pricing-entry__subhead"><span>{{ entry.billing_mode === 'video' ? t('admin.channels.form.videoTiers') : t('admin.channels.form.imageTiers') }}</span><UiButton density="mini" variant="quiet" type="button" @click="addMediaTier"><template #icon><Icon name="plus" size="xs" /></template>{{ t('admin.channels.form.addTier') }}</UiButton></div><div v-if="entry.intervals?.length" class="channel-pricing-entry__intervals"><IntervalRow v-for="(iv, idx) in entry.intervals" :key="idx" :interval="iv" :mode="entry.billing_mode" @update="updateInterval(idx, $event)" @remove="removeInterval(idx)" /></div></div>
      </template>
    </div></Transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import IntervalRow from './IntervalRow.vue'
import ModelTagInput from './ModelTagInput.vue'
import type { PricingFormEntry, IntervalFormEntry } from './types'
import { perTokenToMTok } from './types'
import type { BillingMode } from '@/api/admin/channels'
import channelsAPI from '@/api/admin/channels'
import { UiBadge, UiButton, UiEmptyState, UiIconButton, UiSelect, UiTextField } from '@/components/ui'

const { t } = useI18n()
const props = withDefaults(defineProps<{ entry: PricingFormEntry; platform?: string; hideTokenIntervals?: boolean }>(), { hideTokenIntervals: false })
const emit = defineEmits<{ update: [entry: PricingFormEntry]; remove: [] }>()
const collapsed = ref(props.entry.models.length > 0)
const billingModeOptions = computed(() => [
  { value: 'token', label: t('admin.channels.billingMode.token') },
  { value: 'per_request', label: t('admin.channels.billingMode.perRequest') },
  { value: 'image', label: t('admin.channels.billingMode.image') },
  { value: 'video', label: t('admin.channels.billingMode.video') },
])
const billingModeLabel = computed(() => billingModeOptions.value.find(option => option.value === props.entry.billing_mode)?.label || props.entry.billing_mode)
const tokenPriceFields = computed(() => [
  { key: 'input_price' as const, label: t('admin.channels.form.inputPrice') },
  { key: 'output_price' as const, label: t('admin.channels.form.outputPrice') },
  { key: 'cache_write_price' as const, label: t('admin.channels.form.cacheWritePrice') },
  { key: 'cache_read_price' as const, label: t('admin.channels.form.cacheReadPrice') },
  { key: 'image_input_price' as const, label: t('admin.channels.form.imageInputPrice') },
  { key: 'image_output_price' as const, label: t('admin.channels.form.imageTokenPrice') },
])

function emitField(field: keyof PricingFormEntry, value: string) { emit('update', { ...props.entry, [field]: value === '' ? null : value }) }
function addInterval() { emit('update', { ...props.entry, intervals: [...(props.entry.intervals || []), { min_tokens: 0, max_tokens: null, tier_label: '', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null, per_request_price: null, sort_order: props.entry.intervals?.length || 0 }] }) }
function addMediaTier() { const labels = props.entry.billing_mode === 'video' ? ['480p', '720p', '1080p'] : ['1K', '2K', '4K', 'HD']; const index = props.entry.intervals?.length || 0; emit('update', { ...props.entry, intervals: [...(props.entry.intervals || []), { min_tokens: 0, max_tokens: null, tier_label: labels[index] || '', input_price: null, output_price: null, cache_write_price: null, cache_read_price: null, per_request_price: null, sort_order: index }] }) }
function updateInterval(index: number, updated: IntervalFormEntry) { const intervals = [...(props.entry.intervals || [])]; intervals[index] = updated; emit('update', { ...props.entry, intervals }) }
function removeInterval(index: number) { const intervals = [...(props.entry.intervals || [])]; intervals.splice(index, 1); emit('update', { ...props.entry, intervals }) }
async function onModelsUpdate(models: string[]) {
  const added = models.filter(model => !props.entry.models.includes(model)); emit('update', { ...props.entry, models }); if (!added.length) return
  const e = props.entry; if (e.input_price != null || e.output_price != null || e.cache_write_price != null || e.cache_read_price != null) return
  try { const result = await channelsAPI.getModelDefaultPricing(added[0]); if (result.found) emit('update', { ...props.entry, models, input_price: perTokenToMTok(result.input_price ?? null), output_price: perTokenToMTok(result.output_price ?? null), cache_write_price: perTokenToMTok(result.cache_write_price ?? null), cache_read_price: perTokenToMTok(result.cache_read_price ?? null), image_input_price: perTokenToMTok(result.image_input_price ?? null), image_output_price: perTokenToMTok(result.image_output_price ?? null) }) } catch { /* pricing lookup is optional */ }
}
</script>

<style scoped>
.channel-pricing-entry{border:1px solid var(--ui-border);border-radius:var(--ui-radius-panel);background:var(--ui-surface);overflow:hidden}.channel-pricing-entry__header{display:flex;align-items:center;gap:8px;min-height:38px;padding:6px 8px;cursor:pointer}.channel-pricing-entry__header:hover{background:var(--ui-surface-muted)}.channel-pricing-entry__chevron{color:var(--ui-text-soft)}.channel-pricing-entry__summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;flex:1}.channel-pricing-entry__models{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden}.channel-pricing-entry__model{max-width:180px;overflow:hidden;padding:2px 6px;border-radius:4px;background:var(--ui-surface-muted);font-family:var(--ui-font-mono);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.channel-pricing-entry__more,.channel-pricing-entry__title{color:var(--ui-text-soft);font-size:12px}.channel-pricing-entry__body{display:grid;gap:14px;padding:12px;border-top:1px solid var(--ui-border);background:var(--ui-surface-muted)}.channel-pricing-entry__topline{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:10px}.channel-pricing-entry__section-title,.channel-pricing-entry__subhead{display:flex;align-items:center;justify-content:space-between;color:var(--ui-text-soft);font-size:12px;font-weight:600}.channel-pricing-entry__section-title span,.channel-pricing-entry__subhead small{font-weight:400}.channel-pricing-entry__price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.channel-pricing-entry__subsection{display:grid;gap:8px}.channel-pricing-entry__intervals{display:grid;gap:8px}@media(max-width:720px){.channel-pricing-entry__topline,.channel-pricing-entry__price-grid{grid-template-columns:1fr}.channel-pricing-entry__model{max-width:120px}}
</style>
