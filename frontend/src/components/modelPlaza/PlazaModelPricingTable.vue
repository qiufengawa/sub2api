<template>
  <div
    class="plaza-pricing-table ui-focus-ring"
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
      :key="`${m.platform ?? ''}:${m.name}`"
      class="plaza-model-row"
      role="group"
      :aria-label="m.name"
      data-testid="pricing-row"
      :data-model="m.name"
    >
      <div class="model-cell">
        <ModelIcon :model="m.name" size="20px" class="model-icon-placement" />
        <div class="model-copy">
          <span class="model-name" :title="m.name">{{ m.name }}</span>
          <UiBadge
            v-if="platform && m.platform !== platform"
            class="model-badge"
            :label="platformLabel(m.platform)"
          />
          <UiBadge
            v-if="billingMode(m) !== BILLING_MODE_TOKEN"
            class="model-badge"
            :label="billingModeLabel(m)"
          />
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
            <strong class="special-price-value">
              {{ paidRequestPrice(m, m.pricing.per_request_price) }}
            </strong>
            <span class="price-suffix">{{ perUnitSuffix(m) }}</span>
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
        <span class="rate-caption">{{ t('modelPlaza.table.rate') }}</span>
        <strong v-if="usesIndependentImageRate(m)">{{ requestRate(m) }}x</strong>
        <template v-else-if="hasCustomRate">
          <span class="rate-original">{{ rateMultiplier }}x</span>
          <strong class="rate-effective">{{ effectiveRate }}x</strong>
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
import { platformLabel } from '@/utils/platformColors'
import {
  BILLING_MODE_TOKEN,
  BILLING_MODE_IMAGE,
  type BillingMode
} from '@/constants/channel'
import type { PlazaModel } from '@/api/modelPlaza'
import type { UserPricingInterval } from '@/api/channels'
import { UiBadge } from '@/components/ui'

const props = defineProps<{
  models: PlazaModel[]
  platform?: string
  rateMultiplier: number
  userRateMultiplier?: number | null
  imageRateIndependent?: boolean
  imageRateMultiplier?: number | null
}>()

const { t } = useI18n()
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
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
}

.pricing-head {
  display: none;
}

.plaza-model-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ui-border-soft);
  transition: background-color var(--ui-motion-fast) var(--ui-ease-standard);
}

.plaza-model-row:last-child {
  border-bottom: 0;
}

.plaza-model-row:hover {
  background: var(--ui-surface-muted);
}

.model-cell {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
  grid-column: 1;
  grid-row: 1;
}

.model-icon-placement {
  flex: 0 0 auto;
  margin-top: 2px;
}

.model-copy {
  min-width: 0;
}

.model-name {
  display: block;
  min-width: 0;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.model-badge {
  margin-top: 4px;
  margin-right: 4px;
}

.rate-cell {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: var(--ui-text-muted);
  font-family: var(--ui-font-mono);
  font-size: 12px;
  grid-column: 2;
  grid-row: 1;
}

.rate-caption {
  margin-right: 2px;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
}

.rate-original {
  color: var(--ui-text-soft);
  text-decoration: line-through;
}

.rate-effective {
  color: var(--ui-text);
}

.price-band {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px 0;
  grid-column: 1 / -1;
}

.paid-band {
  margin-top: 10px;
  border-top: 1px solid var(--ui-border-soft);
}

.official-band {
  border-top: 1px solid var(--ui-border-soft);
}

.band-title {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 600;
  grid-column: 1 / -1;
}

.paid-band .band-title {
  color: var(--ui-text);
}

.official-band .band-title {
  color: var(--ui-text-soft);
}

.band-unit {
  flex: 0 0 auto;
  color: var(--ui-text-soft);
  font-weight: 400;
}

.price-value {
  min-width: 0;
  color: var(--ui-text-muted);
  font-family: var(--ui-font-mono);
  font-size: 12px;
}

.paid-band .price-value > strong,
.paid-wide > strong {
  color: var(--ui-text);
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.price-label {
  display: block;
  margin-bottom: 4px;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
  font-weight: 500;
}

.tier-value {
  min-width: 0;
  margin-bottom: 4px;
}

.tier-value:last-child {
  margin-bottom: 0;
}

.tier-value > span {
  display: block;
  overflow: hidden;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tier-value > strong {
  display: block;
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 600;
}

.token-tier-list {
  min-width: 0;
  grid-column: 1 / -1;
}

.token-tier-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(56px, .8fr) repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.token-tier-row:first-child {
  padding-top: 0;
}

.token-tier-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.token-tier-label {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.token-tier-price {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  font-family: var(--ui-font-mono);
}

.token-tier-price small {
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
}

.token-tier-price strong {
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.tier-price-column {
  display: none;
}

.paid-cache.tier-cache-cell {
  padding-top: 8px;
  border-top: 1px solid var(--ui-border-soft);
  grid-column: 1 / -1;
}

.paid-cache.tier-cache-cell .cache-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.cache-values {
  display: grid;
  gap: 4px;
}

.cache-values > div {
  min-width: 0;
}

.cache-values span {
  margin-right: 4px;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
}

.cache-values strong {
  min-width: 0;
  font-family: var(--ui-font-mono);
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.cache-values small {
  display: block;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 9px;
  font-weight: 400;
}

.missing-price {
  color: var(--ui-text-soft);
  font-family: var(--ui-font-mono);
  font-size: 12px;
  font-weight: 400;
}

.paid-wide {
  min-width: 0;
  grid-column: 1 / -1;
}

.special-price-label {
  display: none;
  flex: 0 0 auto;
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 500;
}

.special-price-value {
  color: var(--ui-text);
  font-family: var(--ui-font-mono);
  font-size: 14px;
  font-weight: 600;
}

.price-suffix {
  margin-left: 4px;
  color: var(--ui-text-soft);
  font-size: 12px;
}

.official-wide {
  grid-column: 1 / -1;
}

.request-tiers {
  display: grid;
  min-width: 0;
}

.request-tier {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: baseline;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--ui-border-soft);
  font-family: var(--ui-font-mono);
  font-size: 12px;
}

.request-tier:last-child {
  border-bottom: 0;
}

.request-tier > span {
  min-width: 0;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
  overflow-wrap: anywhere;
}

.request-tier > small {
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
  white-space: nowrap;
}

.request-tier > strong {
  min-width: 0;
  color: var(--ui-text);
  overflow-wrap: anywhere;
}

@media (max-width: 767px) {
  .plaza-pricing-table {
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  .pricing-head,
  .plaza-model-row {
    min-width: 1064px;
    grid-template-columns: minmax(200px, 1.45fr) repeat(6, minmax(132px, 0.8fr)) minmax(72px, 0.55fr);
  }

  .pricing-head {
    display: grid;
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text-muted);
    background: var(--ui-surface-muted);
    font-size: 11px;
    grid-template-rows: auto auto;
  }

  .head-model,
  .head-rate {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    font-weight: 600;
    grid-row: 1 / span 2;
  }

  .head-model {
    grid-column: 1;
  }

  .head-rate {
    justify-content: flex-end;
    border-left: 1px solid var(--ui-border-soft);
    grid-column: 8;
  }

  .head-paid,
  .head-official {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--ui-border-soft);
    font-weight: 600;
  }

  .head-paid {
    color: var(--ui-text);
    grid-column: 2 / span 3;
  }

  .head-official {
    border-left: 1px solid var(--ui-border);
    color: var(--ui-text-soft);
    grid-column: 5 / span 3;
  }

  .head-paid span,
  .head-official span {
    font-weight: 400;
  }

  .head-sub {
    padding: 6px 8px;
    color: var(--ui-text-soft);
    font-size: 9px;
    font-weight: 500;
    grid-row: 2;
  }

  .head-sub.paid-col {
    color: var(--ui-text-muted);
  }

  .plaza-model-row {
    gap: 0;
    padding: 0;
    grid-template-rows: minmax(56px, auto);
  }

  .model-cell {
    align-items: center;
    padding: 10px 12px;
    grid-column: 1;
    grid-row: 1;
  }

  .model-name {
    display: block;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .price-band {
    display: contents;
  }

  .band-title,
  .price-label {
    display: none;
  }

  .price-value {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    padding: 10px 8px;
    font-size: 11px;
    grid-row: 1;
  }

  .price-value > strong,
  .cache-values strong {
    white-space: nowrap;
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
    padding-top: 10px;
    border-top: 0;
    grid-column: 4;
  }

  .paid-cache.tier-cache-cell .cache-values {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .official-input {
    border-left: 1px solid var(--ui-border-soft);
    grid-column: 5;
  }
  .official-output { grid-column: 6; }
  .official-cache { grid-column: 7; }

  .paid-wide {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    padding: 10px 8px;
    grid-column: 2 / span 3;
    grid-row: 1;
  }

  .official-wide {
    display: flex;
    min-width: 0;
    align-items: center;
    padding: 10px 8px;
    border-left: 1px solid var(--ui-border-soft);
    grid-column: 5 / span 3;
    grid-row: 1;
  }

  .rate-cell {
    padding: 10px 8px;
    border-left: 1px solid var(--ui-border-soft);
    text-align: right;
    grid-column: 8;
    grid-row: 1;
  }

  .rate-caption {
    display: none;
  }

  .tier-value > span {
    white-space: normal;
  }
}

@media (min-width: 768px) and (max-width: 1279px) {
  .price-band {
    grid-template-columns: minmax(7rem, 0.72fr) repeat(3, minmax(0, 1fr));
    align-items: start;
    column-gap: 12px;
    padding-inline: 12px;
  }

  .band-title {
    grid-column: 1;
    display: block;
    padding-top: 2px;
  }

  .band-unit {
    display: block;
    margin-top: 4px;
  }

  .paid-wide {
    grid-column: 2 / -1;
  }

  .official-wide {
    grid-column: 2 / -1;
  }

  .token-tier-list {
    display: none;
  }

  .tier-price-column {
    display: block;
  }

  .paid-cache.tier-cache-cell {
    padding-top: 0;
    border-top: 0;
    grid-column: auto;
  }

  .paid-cache.tier-cache-cell .cache-values {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
}

@media (min-width: 1280px) {
  .pricing-head,
  .plaza-model-row {
    grid-template-columns: minmax(220px, 1.65fr) repeat(3, minmax(88px, 0.82fr)) repeat(3, minmax(88px, 0.82fr)) minmax(76px, 0.55fr);
  }

  .pricing-head {
    display: grid;
    min-width: 0;
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text-muted);
    background: var(--ui-surface-muted);
    font-size: 12px;
    grid-template-rows: auto auto;
  }

  .head-model,
  .head-rate {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    font-weight: 600;
    grid-row: 1 / span 2;
  }

  .head-model {
    grid-column: 1;
  }

  .head-rate {
    justify-content: flex-end;
    border-left: 1px solid var(--ui-border-soft);
    grid-column: 8;
  }

  .head-paid,
  .head-official {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--ui-border-soft);
    font-weight: 600;
  }

  .head-paid {
    color: var(--ui-text);
    grid-column: 2 / span 3;
  }

  .head-official {
    border-left: 1px solid var(--ui-border);
    color: var(--ui-text-soft);
    grid-column: 5 / span 3;
  }

  .head-paid span,
  .head-official span {
    font-weight: 400;
  }

  .head-sub {
    padding: 6px 12px;
    color: var(--ui-text-soft);
    font-size: 10px;
    font-weight: 500;
    grid-row: 2;
  }

  .head-sub.paid-col {
    color: var(--ui-text-muted);
  }

  .head-sub.official-col:first-of-type {
    border-left: 1px solid var(--ui-border-soft);
  }

  .plaza-model-row {
    gap: 0;
    padding: 0;
    grid-template-rows: minmax(58px, auto);
  }

  .model-cell {
    align-items: center;
    padding: 12px 16px;
    grid-column: 1;
    grid-row: 1;
  }

  .model-name {
    overflow: hidden;
    text-overflow: ellipsis;
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
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    padding: 12px;
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
    padding-top: 12px;
    border-top: 0;
    grid-column: 4;
  }
  .paid-cache.tier-cache-cell .cache-values {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .official-input {
    grid-column: 5;
    border-left: 1px solid var(--ui-border-soft);
  }
  .official-output { grid-column: 6; }
  .official-cache { grid-column: 7; }

  .paid-wide {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
    padding: 12px;
    grid-column: 2 / span 3;
    grid-row: 1;
  }

  .official-wide {
    display: flex;
    min-width: 0;
    align-items: center;
    padding: 12px;
    border-left: 1px solid var(--ui-border-soft);
    grid-column: 5 / span 3;
    grid-row: 1;
  }

  .rate-cell {
    padding: 12px;
    border-left: 1px solid var(--ui-border-soft);
    text-align: right;
    grid-column: 8;
    grid-row: 1;
  }

  .tier-value > span {
    white-space: normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .plaza-model-row {
    transition: none;
  }
}
</style>
