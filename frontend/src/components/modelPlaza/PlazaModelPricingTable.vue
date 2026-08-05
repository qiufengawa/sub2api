<template>
  <div
    class="plaza-pricing-table min-w-0 overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/25"
    :style="accentStyle"
    role="region"
    :aria-label="t('modelPlaza.table.pricingTableLabel')"
    tabindex="0"
    data-testid="pricing-responsive"
  >
    <div class="pricing-head" aria-hidden="true" data-testid="pricing-desktop-head">
      <div class="head-model">{{ t('modelPlaza.table.model') }}</div>
      <div class="head-paid">
        {{ t('modelPlaza.table.paidPrice') }}
        <span>{{ t('modelPlaza.table.unitPerMillion') }}</span>
      </div>
      <div class="head-official">
        {{ t('modelPlaza.table.officialPrice') }}
        <span>{{ t('modelPlaza.table.unitPerMillion') }}</span>
      </div>
      <div class="head-rate">{{ t('modelPlaza.table.rate') }}</div>
      <div class="head-sub paid-col">{{ t('modelPlaza.table.input') }}</div>
      <div class="head-sub paid-col">{{ t('modelPlaza.table.output') }}</div>
      <div class="head-sub paid-col">{{ t('modelPlaza.table.cache') }}</div>
      <div class="head-sub official-col">{{ t('modelPlaza.table.input') }}</div>
      <div class="head-sub official-col">{{ t('modelPlaza.table.output') }}</div>
      <div class="head-sub official-col">{{ t('modelPlaza.table.cache') }}</div>
    </div>

    <div
      v-for="m in sortedModels"
      :key="m.name"
      class="plaza-model-row"
      role="group"
      :aria-label="m.name"
      data-testid="pricing-row"
      :data-model="m.name"
    >
      <div class="model-cell">
        <ModelIcon :model="m.name" size="20px" class="mt-0.5 flex-shrink-0" />
        <div class="min-w-0">
          <span class="model-name min-w-0" :title="m.name">{{ m.name }}</span>
          <span
            v-if="billingMode(m) !== BILLING_MODE_TOKEN"
            class="mt-1 inline-flex rounded-[3px] bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-dark-700/70 dark:text-dark-300"
          >
            {{ billingModeLabel(m) }}
          </span>
        </div>
      </div>

      <div
        class="price-band paid-band"
        role="group"
        :aria-label="paidPriceLabel(m)"
        data-testid="paid-price-band"
      >
        <div class="band-title">
          <span>{{ paidPriceLabel(m) }}</span>
          <span v-if="billingMode(m) === BILLING_MODE_TOKEN" class="band-unit">
            {{ t('modelPlaza.table.unitPerMillion') }}
          </span>
        </div>

        <template v-if="billingMode(m) === BILLING_MODE_TOKEN">
          <div
            v-if="tokenIntervals(m).length"
            class="token-tier-list"
            data-testid="token-tier-list"
          >
            <div v-for="(iv, idx) in tokenIntervals(m)" :key="idx" class="token-tier-row">
              <span class="token-tier-label">{{ tierLabel(iv) }}</span>
              <span class="token-tier-price">
                <small>{{ t('modelPlaza.table.input') }}</small>
                <strong>{{ paidPerMillion(iv.input_price) }}</strong>
              </span>
              <span class="token-tier-price">
                <small>{{ t('modelPlaza.table.output') }}</small>
                <strong>{{ paidPerMillion(iv.output_price) }}</strong>
              </span>
            </div>
          </div>

          <div class="price-value paid-input" :class="tokenIntervals(m).length && 'tier-price-column'">
            <span class="price-label">{{ t('modelPlaza.table.input') }}</span>
            <template v-if="tokenIntervals(m).length">
              <div v-for="(iv, idx) in tokenIntervals(m)" :key="idx" class="tier-value">
                <span>{{ tierLabel(iv) }}</span>
                <strong>{{ paidPerMillion(iv.input_price) }}</strong>
              </div>
            </template>
            <strong v-else>{{ paidPerMillion(m.pricing?.input_price) }}</strong>
          </div>
          <div class="price-value paid-output" :class="tokenIntervals(m).length && 'tier-price-column'">
            <span class="price-label">{{ t('modelPlaza.table.output') }}</span>
            <template v-if="tokenIntervals(m).length">
              <div v-for="(iv, idx) in tokenIntervals(m)" :key="idx" class="tier-value">
                <span>{{ tierLabel(iv) }}</span>
                <strong>{{ paidPerMillion(iv.output_price) }}</strong>
              </div>
            </template>
            <strong v-else>{{ paidPerMillion(m.pricing?.output_price) }}</strong>
          </div>
          <div class="price-value paid-cache" :class="tokenIntervals(m).length && 'tier-cache-cell'">
            <span class="price-label">{{ t('modelPlaza.table.cache') }}</span>
            <div v-if="hasCachePricing(m)" class="cache-values">
              <div>
                <span>{{ t('modelPlaza.table.cacheWrite') }}</span>
                <strong>{{ paidPerMillion(m.pricing?.cache_write_price) }}</strong>
              </div>
              <div>
                <span>{{ t('modelPlaza.table.cacheRead') }}</span>
                <strong>{{ paidPerMillion(m.pricing?.cache_read_price) }}</strong>
              </div>
            </div>
            <strong v-else class="missing-price">-</strong>
          </div>
        </template>

        <div v-else class="paid-wide">
          <span class="special-price-label">{{ paidPriceLabel(m) }}</span>
          <div v-if="requestIntervals(m).length" class="request-tiers">
            <span v-for="(iv, idx) in requestIntervals(m)" :key="idx" class="request-tier">
              <span>{{ tierLabel(iv) }}</span>
              <strong>{{ paidRequestPrice(m, iv.per_request_price) }}</strong>
              <small>{{ perUnitSuffix(m) }}</small>
            </span>
          </div>
          <template v-else-if="m.pricing?.per_request_price != null">
            <strong class="font-mono text-sm text-gray-900 dark:text-gray-50">
              {{ paidRequestPrice(m, m.pricing.per_request_price) }}
            </strong>
            <span class="ml-1 text-xs text-gray-400 dark:text-dark-500">{{ perUnitSuffix(m) }}</span>
          </template>
          <strong v-else class="missing-price">-</strong>
        </div>
      </div>

      <div
        class="price-band official-band"
        role="group"
        :aria-label="t('modelPlaza.table.officialPrice')"
        data-testid="official-price-band"
      >
        <div class="band-title">
          <span>{{ t('modelPlaza.table.officialPrice') }}</span>
        </div>
        <template v-if="billingMode(m) === BILLING_MODE_TOKEN">
          <div class="price-value official-input">
            <span class="price-label">{{ t('modelPlaza.table.input') }}</span>
            <strong>{{ official(m.official_pricing?.input_price) }}</strong>
          </div>
          <div class="price-value official-output">
            <span class="price-label">{{ t('modelPlaza.table.output') }}</span>
            <strong>{{ official(m.official_pricing?.output_price) }}</strong>
          </div>
          <div class="price-value official-cache">
            <span class="price-label">{{ t('modelPlaza.table.cache') }}</span>
            <div v-if="m.official_pricing && hasOfficialCache(m.official_pricing)" class="cache-values">
              <div>
                <span>{{ t('modelPlaza.table.cacheWrite') }}</span>
                <strong>
                  {{ official(m.official_pricing.cache_write_price) }}
                  <template v-if="m.official_pricing.cache_write_1h_price != null">
                    <small>(1h {{ official(m.official_pricing.cache_write_1h_price) }})</small>
                  </template>
                </strong>
              </div>
              <div>
                <span>{{ t('modelPlaza.table.cacheRead') }}</span>
                <strong>{{ official(m.official_pricing.cache_read_price) }}</strong>
              </div>
            </div>
            <strong v-else class="missing-price">-</strong>
          </div>
        </template>
        <div v-else class="price-value official-wide">
          <strong class="missing-price">-</strong>
        </div>
      </div>

      <div class="rate-cell" data-testid="rate-cell">
        <span class="rate-caption xl:hidden">{{ t('modelPlaza.table.rate') }}</span>
        <strong v-if="usesIndependentImageRate(m)">{{ requestRate(m) }}x</strong>
        <template v-else-if="hasCustomRate">
          <span class="text-gray-400 line-through dark:text-dark-500">{{ rateMultiplier }}x</span>
          <strong class="text-primary-600 dark:text-primary-400">{{ effectiveRate }}x</strong>
        </template>
        <strong v-else>{{ effectiveRate }}x</strong>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelIcon from '@/components/common/ModelIcon.vue'
import { formatScaled } from '@/utils/pricing'
import { platformAccentColor } from '@/utils/platformColors'
import {
  BILLING_MODE_TOKEN,
  BILLING_MODE_IMAGE,
  type BillingMode
} from '@/constants/channel'
import type { PlazaModel } from '@/api/modelPlaza'
import type { UserPricingInterval } from '@/api/channels'

const props = defineProps<{
  models: PlazaModel[]
  platform?: string
  rateMultiplier: number
  userRateMultiplier?: number | null
  imageRateIndependent?: boolean
  imageRateMultiplier?: number | null
}>()

const { t } = useI18n()
const accentStyle = computed(() => ({ '--plaza-accent': platformAccentColor(props.platform ?? '') }))
const PER_MILLION = 1_000_000
const MIN_DECIMALS = 2

/**
 * Token-priced models stay ahead of per-image/per-request models because their
 * prices use different units. Within each billing mode, keep the newest and
 * highest official output price first so the order remains stable on refresh.
 */
const sortedModels = computed(() => {
  return [...props.models].sort((a, b) => {
    const aIsToken = billingMode(a) === BILLING_MODE_TOKEN
    const bIsToken = billingMode(b) === BILLING_MODE_TOKEN
    if (aIsToken !== bIsToken) return aIsToken ? -1 : 1
    const aPrice = a.official_pricing?.output_price ?? null
    const bPrice = b.official_pricing?.output_price ?? null
    if (aPrice != null && bPrice != null && aPrice !== bPrice) return bPrice - aPrice
    if (aPrice != null && bPrice == null) return -1
    if (aPrice == null && bPrice != null) return 1
    return b.name.localeCompare(a.name)
  })
})

const effectiveRate = computed(() => props.userRateMultiplier ?? props.rateMultiplier)
const hasCustomRate = computed(
  () => props.userRateMultiplier != null && props.userRateMultiplier !== props.rateMultiplier
)

function billingMode(model: PlazaModel): BillingMode {
  return (model.pricing?.billing_mode || BILLING_MODE_TOKEN) as BillingMode
}

function billingModeLabel(model: PlazaModel): string {
  return billingMode(model) === BILLING_MODE_IMAGE
    ? t('modelPlaza.table.perImage')
    : t('modelPlaza.table.perRequest')
}

function paidPriceLabel(model: PlazaModel): string {
  if (billingMode(model) === BILLING_MODE_IMAGE) return t('modelPlaza.table.perImagePrice')
  if (billingMode(model) !== BILLING_MODE_TOKEN) return t('modelPlaza.table.perRequestPrice')
  return t('modelPlaza.table.paidPrice')
}

function paidPerMillion(value: number | null | undefined): string {
  if (value == null) return '-'
  return formatScaled(value * effectiveRate.value, PER_MILLION, MIN_DECIMALS)
}

function usesIndependentImageRate(model: PlazaModel): boolean {
  return billingMode(model) === BILLING_MODE_IMAGE && props.imageRateIndependent === true
}

function requestRate(model: PlazaModel): number {
  return usesIndependentImageRate(model)
    ? (props.imageRateMultiplier ?? 1)
    : effectiveRate.value
}

function paidRequestPrice(model: PlazaModel, value: number | null | undefined): string {
  if (value == null) return '-'
  return formatScaled(value * requestRate(model), 1, MIN_DECIMALS)
}

function official(value: number | null | undefined): string {
  if (value == null) return '-'
  return formatScaled(value, PER_MILLION, MIN_DECIMALS)
}

function perUnitSuffix(model: PlazaModel): string {
  return billingMode(model) === BILLING_MODE_IMAGE
    ? t('modelPlaza.table.perUnitImage')
    : t('modelPlaza.table.perUnitRequest')
}

function hasCachePricing(model: PlazaModel): boolean {
  return model.pricing?.cache_write_price != null || model.pricing?.cache_read_price != null
}

function hasOfficialCache(pricing: NonNullable<PlazaModel['official_pricing']>): boolean {
  return pricing.cache_write_price != null || pricing.cache_read_price != null || pricing.cache_write_1h_price != null
}

function tokenIntervals(model: PlazaModel): UserPricingInterval[] {
  return model.pricing?.intervals ?? []
}

function requestIntervals(model: PlazaModel): UserPricingInterval[] {
  return (model.pricing?.intervals ?? []).filter((interval) => interval.per_request_price != null)
}

function tierLabel(interval: UserPricingInterval): string {
  if (interval.tier_label) return interval.tier_label
  const { min_tokens: min, max_tokens: max } = interval
  if (max == null) return `>${formatTokenCount(min)}`
  if (min === 0) return `≤${formatTokenCount(max)}`
  return `${formatTokenCount(min)}–${formatTokenCount(max)}`
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${trimZero(value / 1_000_000)}M`
  if (value >= 1_000) return `${trimZero(value / 1_000)}K`
  return String(value)
}

function trimZero(value: number): string {
  return String(Math.round(value * 100) / 100)
}
</script>

<style scoped>
.plaza-pricing-table {
  --pz-title: color-mix(in srgb, var(--plaza-accent) 82%, black);
}

.dark .plaza-pricing-table {
  --pz-title: color-mix(in srgb, var(--plaza-accent) 70%, white);
}

.dark .plaza-pricing-table :deep(.model-icon path[fill='#000000']),
.dark .plaza-pricing-table :deep(.model-icon path[fill='#16191E']),
.dark .plaza-pricing-table :deep(.model-icon path[fill='#003425']) {
  fill: #e5e7eb;
}

.pricing-head {
  display: none;
}

.plaza-model-row {
  @apply grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0 border-b border-gray-100 px-3 py-2.5 last:border-b-0 dark:border-dark-700/60 sm:px-4 sm:py-3;
}

.model-cell {
  @apply flex min-w-0 items-start gap-2.5;
  grid-column: 1;
  grid-row: 1;
}

.model-name {
  @apply block min-w-0 font-medium leading-5 text-gray-900 dark:text-white;
  overflow-wrap: anywhere;
}

.rate-cell {
  @apply flex flex-shrink-0 items-center justify-end gap-1 font-mono text-xs text-gray-700 dark:text-gray-300;
  grid-column: 2;
  grid-row: 1;
}

.rate-caption {
  @apply mr-0.5 font-sans text-[10px] text-gray-400 dark:text-dark-500;
}

.price-band {
  @apply grid min-w-0 grid-cols-3 gap-x-2 gap-y-2 px-0 py-2.5;
  grid-column: 1 / -1;
}

.paid-band {
  @apply mt-2.5 border-t border-gray-100 dark:border-dark-700/60;
}

.official-band {
  @apply border-t border-gray-100 dark:border-dark-700/60;
}

.band-title {
  @apply col-span-3 flex min-w-0 items-center justify-between gap-2 text-xs font-semibold;
}

.paid-band .band-title {
  color: var(--plaza-accent);
  color: var(--pz-title);
}

.official-band .band-title {
  @apply text-gray-500 dark:text-dark-400;
}

.band-unit {
  @apply flex-shrink-0 font-normal text-gray-400 dark:text-dark-500;
}

.price-value {
  @apply min-w-0 font-mono text-xs text-gray-600 dark:text-dark-300;
}

.paid-band .price-value > strong,
.paid-wide > strong {
  @apply text-sm font-semibold text-gray-900 dark:text-gray-50;
  overflow-wrap: anywhere;
}

.price-label {
  @apply mb-1 block font-sans text-[10px] font-medium text-gray-400 dark:text-dark-500;
}

.tier-value {
  @apply mb-1 min-w-0 last:mb-0;
}

.tier-value > span {
  @apply block overflow-hidden text-ellipsis whitespace-nowrap font-sans text-[10px] text-gray-400 dark:text-dark-500;
}

.tier-value > strong {
  @apply block text-xs font-semibold text-gray-900 dark:text-gray-100;
}

.token-tier-list {
  @apply col-span-3 min-w-0 divide-y divide-gray-200/70 dark:divide-dark-700/70;
}

.token-tier-row {
  @apply grid min-w-0 grid-cols-[minmax(3.5rem,0.8fr)_repeat(2,minmax(0,1fr))] items-start gap-2 py-2 first:pt-0 last:pb-0;
}

.token-tier-label {
  @apply break-words text-xs font-medium text-gray-500 dark:text-dark-300;
}

.token-tier-price {
  @apply flex min-w-0 flex-col gap-0.5 font-mono;
}

.token-tier-price small {
  @apply font-sans text-[10px] text-gray-400 dark:text-dark-500;
}

.token-tier-price strong {
  @apply break-words text-xs font-semibold text-gray-900 dark:text-gray-100;
}

.tier-price-column {
  display: none;
}

.paid-cache.tier-cache-cell {
  @apply col-span-3 border-t border-gray-200/70 pt-2 dark:border-dark-700/70;
}

.paid-cache.tier-cache-cell .cache-values {
  @apply grid grid-cols-2 gap-2 space-y-0;
}

.cache-values {
  @apply space-y-1;
}

.cache-values > div {
  @apply min-w-0;
}

.cache-values span {
  @apply mr-1 font-sans text-[10px] text-gray-400 dark:text-dark-500;
}

.cache-values strong {
  @apply min-w-0 break-words font-mono text-xs font-medium;
  overflow-wrap: anywhere;
}

.cache-values small {
  @apply block font-sans text-[9px] font-normal text-gray-400 dark:text-dark-500;
}

.missing-price {
  @apply font-mono text-xs font-normal text-gray-400 dark:text-dark-500;
}

.paid-wide {
  @apply col-span-3 min-w-0;
}

.special-price-label {
  @apply hidden flex-shrink-0 text-xs font-medium xl:inline;
  color: var(--plaza-accent);
  color: var(--pz-title);
}

.official-wide {
  @apply col-span-3;
}

.request-tiers {
  @apply grid min-w-0 divide-y divide-gray-200/70 dark:divide-dark-700/70;
}

.request-tier {
  @apply grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-2 py-1.5 font-mono text-xs;
}

.request-tier > span {
  @apply min-w-0 break-words font-sans text-[10px] text-gray-400 dark:text-dark-500;
}

.request-tier > small {
  @apply whitespace-nowrap font-sans text-[10px] text-gray-400 dark:text-dark-500;
}

.request-tier > strong {
  @apply min-w-0 text-gray-900 dark:text-gray-100;
  overflow-wrap: anywhere;
}

@media (max-width: 767px) {
  .plaza-pricing-table {
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  .pricing-head,
  .plaza-model-row {
    min-width: 920px;
    grid-template-columns: minmax(200px, 1.45fr) repeat(3, minmax(108px, 0.8fr)) repeat(3, minmax(108px, 0.8fr)) minmax(72px, 0.55fr);
  }

  .pricing-head {
    @apply grid border-b border-gray-200 bg-gray-50/40 text-[11px] text-gray-500 dark:border-dark-700 dark:bg-dark-800/20 dark:text-dark-400;
    grid-template-rows: auto auto;
  }

  .head-model,
  .head-rate {
    @apply flex items-center px-3 py-2 font-semibold;
    grid-row: 1 / span 2;
  }

  .head-model {
    grid-column: 1;
  }

  .head-rate {
    @apply justify-end border-l border-gray-100 dark:border-dark-700/60;
    grid-column: 8;
  }

  .head-paid,
  .head-official {
    @apply flex items-center justify-center gap-1 border-b px-2 py-1.5 font-semibold;
  }

  .head-paid {
    color: var(--plaza-accent);
    color: var(--pz-title);
    border-color: color-mix(in srgb, var(--plaza-accent) 24%, transparent);
    grid-column: 2 / span 3;
  }

  .head-official {
    @apply border-l border-gray-200 text-gray-400 dark:border-dark-600 dark:text-dark-500;
    grid-column: 5 / span 3;
  }

  .head-paid span,
  .head-official span {
    @apply font-normal;
  }

  .head-sub {
    @apply px-2 py-1.5 text-[9px] font-medium text-gray-400 dark:text-dark-500;
    grid-row: 2;
  }

  .head-sub.paid-col {
    color: var(--pz-title);
  }

  .plaza-model-row {
    @apply gap-0 px-0 py-0;
    grid-template-rows: minmax(56px, auto);
  }

  .model-cell {
    @apply items-center px-3 py-2.5;
    grid-column: 1;
    grid-row: 1;
  }

  .model-name {
    @apply truncate;
    display: block;
    white-space: nowrap;
  }

  .price-band {
    display: contents;
  }

  .band-title,
  .price-label {
    display: none;
  }

  .price-value {
    @apply flex min-w-0 flex-col justify-center rounded-none px-2 py-2.5 text-[11px];
    grid-row: 1;
  }

  .token-tier-list {
    display: none;
  }

  .tier-price-column {
    display: flex;
  }

  .paid-input { grid-column: 2; }
  .paid-output { grid-column: 3; }
  .paid-cache { grid-column: 4; }

  .paid-cache.tier-cache-cell {
    @apply col-span-1 border-t-0 pt-2.5;
    grid-column: 4;
  }

  .paid-cache.tier-cache-cell .cache-values {
    @apply block space-y-1;
  }

  .official-input {
    @apply border-l border-gray-100 dark:border-dark-700/60;
    grid-column: 5;
  }
  .official-output { grid-column: 6; }
  .official-cache { grid-column: 7; }

  .paid-wide {
    @apply flex min-w-0 items-center gap-2 px-2 py-2.5;
    grid-column: 2 / span 3;
    grid-row: 1;
  }

  .official-wide {
    @apply flex min-w-0 items-center border-l border-gray-100 px-2 py-2.5 dark:border-dark-700/60;
    grid-column: 5 / span 3;
    grid-row: 1;
  }

  .rate-cell {
    @apply border-l border-gray-100 px-2 py-2.5 text-right dark:border-dark-700/60;
    grid-column: 8;
    grid-row: 1;
  }

  .rate-caption {
    display: none;
  }

  .tier-value > span {
    @apply whitespace-normal;
  }
}

@media (min-width: 768px) and (max-width: 1279px) {
  .price-band {
    grid-template-columns: minmax(7rem, 0.72fr) repeat(3, minmax(0, 1fr));
    @apply items-start gap-x-3 px-3;
  }

  .band-title {
    grid-column: 1;
    @apply col-span-1 block pt-0.5;
  }

  .band-unit {
    @apply mt-1 block;
  }

  .paid-wide {
    grid-column: 2 / -1;
    @apply col-span-1;
  }

  .official-wide {
    grid-column: 2 / -1;
    @apply col-span-1;
  }

  .token-tier-list {
    display: none;
  }

  .tier-price-column {
    display: block;
  }

  .paid-cache.tier-cache-cell {
    @apply col-span-1 border-t-0 pt-0;
  }

  .paid-cache.tier-cache-cell .cache-values {
    @apply block space-y-1;
  }
}

@media (min-width: 1280px) {
  .pricing-head,
  .plaza-model-row {
    grid-template-columns: minmax(220px, 1.65fr) repeat(3, minmax(88px, 0.82fr)) repeat(3, minmax(88px, 0.82fr)) minmax(76px, 0.55fr);
  }

  .pricing-head {
    @apply grid min-w-0 border-b border-gray-200 bg-gray-50/40 text-xs text-gray-500 dark:border-dark-700 dark:bg-dark-800/20 dark:text-dark-400;
    grid-template-rows: auto auto;
  }

  .head-model,
  .head-rate {
    @apply flex items-center px-4 py-2.5 font-semibold;
    grid-row: 1 / span 2;
  }

  .head-model {
    grid-column: 1;
  }

  .head-rate {
    @apply justify-end border-l border-gray-100 dark:border-dark-700/60;
    grid-column: 8;
  }

  .head-paid,
  .head-official {
    @apply flex items-center justify-center gap-1.5 border-b px-3 py-1.5 font-semibold;
  }

  .head-paid {
    color: var(--plaza-accent);
    color: var(--pz-title);
    border-color: color-mix(in srgb, var(--plaza-accent) 24%, transparent);
    grid-column: 2 / span 3;
  }

  .head-official {
    @apply border-l border-gray-200 text-gray-400 dark:border-dark-600 dark:text-dark-500;
    grid-column: 5 / span 3;
  }

  .head-paid span,
  .head-official span {
    @apply font-normal;
  }

  .head-sub {
    @apply px-3 py-1.5 text-[10px] font-medium text-gray-400 dark:text-dark-500;
    grid-row: 2;
  }

  .head-sub.paid-col {
    color: var(--pz-title);
  }

  .head-sub.official-col:first-of-type {
    @apply border-l border-gray-100 dark:border-dark-700/60;
  }

  .plaza-model-row {
    @apply gap-0 px-0 py-0 transition-colors hover:bg-gray-50/70 dark:hover:bg-dark-800/40;
    grid-template-rows: minmax(58px, auto);
  }

  .model-cell {
    @apply items-center px-4 py-3;
    grid-column: 1;
    grid-row: 1;
  }

  .model-name {
    @apply truncate;
    display: block;
    white-space: nowrap;
  }

  .price-band {
    display: contents;
  }

  .band-title,
  .price-label {
    display: none;
  }

  .price-value {
    @apply flex min-w-0 flex-col justify-center rounded-none px-3 py-3;
    grid-row: 1;
  }

  .token-tier-list {
    display: none;
  }

  .tier-price-column {
    display: flex;
  }

  .paid-input { grid-column: 2; }
  .paid-output { grid-column: 3; }
  .paid-cache { grid-column: 4; }
  .paid-cache.tier-cache-cell {
    @apply col-span-1 border-t-0 pt-3;
    grid-column: 4;
  }
  .paid-cache.tier-cache-cell .cache-values {
    @apply block space-y-1;
  }
  .official-input {
    grid-column: 5;
    @apply border-l border-gray-100 dark:border-dark-700/60;
  }
  .official-output { grid-column: 6; }
  .official-cache { grid-column: 7; }

  .paid-wide {
    @apply flex min-w-0 items-center gap-2 px-3 py-3;
    grid-column: 2 / span 3;
    grid-row: 1;
  }

  .official-wide {
    @apply flex min-w-0 items-center border-l border-gray-100 px-3 py-3 dark:border-dark-700/60;
    grid-column: 5 / span 3;
    grid-row: 1;
  }

  .rate-cell {
    @apply border-l border-gray-100 px-3 py-3 text-right dark:border-dark-700/60;
    grid-column: 8;
    grid-row: 1;
  }

  .tier-value > span {
    @apply whitespace-normal;
  }
}
</style>
