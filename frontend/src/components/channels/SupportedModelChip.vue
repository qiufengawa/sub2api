<template>
  <div class="model-chip">
    <span
      ref="triggerEl"
      class="model-chip__trigger"
      :data-platform="effectivePlatform || undefined"
      @mouseenter="onEnter"
      @mouseleave="onLeave"
      @focusin="onEnter"
      @focusout="onLeave"
      tabindex="0"
    >
      <PlatformIcon
        v-if="effectivePlatform"
        :platform="effectivePlatform as GroupPlatform"
        size="xs"
      />
      <span
        v-if="showPlatform && model.platform"
        class="model-chip__platform"
      >
        {{ model.platform }}
      </span>
      {{ model.name }}
    </span>

    <!-- Teleport to body so the popover is not clipped by card/overflow-hidden
         ancestors. Fixed-position coords are computed from the trigger's
         bounding rect; re-measured on enter / scroll / resize. -->
    <Teleport to="body">
      <div
        v-show="show"
        ref="popoverEl"
        role="tooltip"
        class="model-chip__popover"
        :style="popoverStyle"
      >
        <!-- Header：平台主题色背景，含模型名 + 平台徽章 -->
        <div
          class="model-chip__popover-header"
          :class="[popoverHeaderClass, popoverBorderClass]"
        >
          <span class="model-chip__popover-title">{{ model.name }}</span>
          <span
            v-if="model.platform"
            class="model-chip__popover-platform"
          >
            {{ model.platform }}
          </span>
        </div>

        <div class="model-chip__popover-body">
          <div v-if="!model.pricing" class="model-chip__muted">
            {{ noPricingLabel }}
          </div>

          <div v-else class="model-chip__pricing">
            <div class="model-chip__row">
              <span class="model-chip__muted">{{ t(prefixKey('billingMode')) }}</span>
              <span class="model-chip__value">{{ billingModeLabel }}</span>
            </div>

            <template v-if="model.pricing.billing_mode === BILLING_MODE_TOKEN">
              <PricingRow
                :label="t(prefixKey('inputPrice'))"
                :value="model.pricing.input_price"
                :unit="t(prefixKey('unitPerMillion'))"
                :scale="perMillionScale"
              />
              <PricingRow
                :label="t(prefixKey('outputPrice'))"
                :value="model.pricing.output_price"
                :unit="t(prefixKey('unitPerMillion'))"
                :scale="perMillionScale"
              />
              <PricingRow
                :label="t(prefixKey('cacheWritePrice'))"
                :value="model.pricing.cache_write_price"
                :unit="t(prefixKey('unitPerMillion'))"
                :scale="perMillionScale"
              />
              <PricingRow
                :label="t(prefixKey('cacheReadPrice'))"
                :value="model.pricing.cache_read_price"
                :unit="t(prefixKey('unitPerMillion'))"
                :scale="perMillionScale"
              />
              <PricingRow
                v-if="model.pricing.image_input_price != null && model.pricing.image_input_price > 0"
                :label="t(prefixKey('imageInputPrice'))"
                :value="model.pricing.image_input_price"
                :unit="t(prefixKey('unitPerMillion'))"
                :scale="perMillionScale"
              />
              <PricingRow
                v-if="model.pricing.image_output_price != null && model.pricing.image_output_price > 0"
                :label="t(prefixKey('imageOutputPrice'))"
                :value="model.pricing.image_output_price"
                :unit="t(prefixKey('unitPerMillion'))"
                :scale="perMillionScale"
              />
            </template>

            <PricingRow
              v-if="
                model.pricing.billing_mode === BILLING_MODE_PER_REQUEST &&
                model.pricing.per_request_price != null
              "
              :label="t(prefixKey('perRequestPrice'))"
              :value="model.pricing.per_request_price"
              :unit="t(prefixKey('unitPerRequest'))"
              :scale="1"
            />

            <PricingRow
              v-if="
                model.pricing.billing_mode === BILLING_MODE_IMAGE &&
                model.pricing.image_output_price != null
              "
              :label="t(prefixKey('imageOutputPrice'))"
              :value="model.pricing.image_output_price"
              :unit="t(prefixKey('unitPerRequest'))"
              :scale="1"
            />

            <div
              v-if="model.pricing.intervals && model.pricing.intervals.length > 0"
              class="model-chip__intervals"
            >
              <div class="model-chip__interval-title">
                {{ t(prefixKey('intervals')) }}
              </div>
              <div class="model-chip__interval-list">
                <div
                  v-for="(iv, idx) in model.pricing.intervals"
                  :key="idx"
                  class="model-chip__row model-chip__interval-row"
                >
                  <span class="model-chip__muted">
                    <template v-if="iv.tier_label">{{ iv.tier_label }}</template>
                    <template v-else>{{ formatRange(iv.min_tokens, iv.max_tokens) }}</template>
                  </span>
                  <span class="model-chip__value">{{ formatInterval(iv, model.pricing.billing_mode) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PricingRow from './PricingRow.vue'
import { formatScaled } from '@/utils/pricing'
import {
  BILLING_MODE_TOKEN,
  BILLING_MODE_PER_REQUEST,
  BILLING_MODE_IMAGE,
  type BillingMode
} from '@/constants/channel'
// 复用 api/channels.ts 的用户侧最小形态 DTO。
// admin 侧 ChannelModelPricing 字段更多，但结构上是用户 DTO 的超集，admin 视图传入可直接通过结构化子类型检查。
import type { UserPricingInterval, UserSupportedModel } from '@/api/channels'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import type { GroupPlatform } from '@/types'

const props = withDefaults(
  defineProps<{
    model: UserSupportedModel
    /** i18n 前缀：管理端传 `admin.availableChannels.pricing`，用户端传 `availableChannels.pricing`。 */
    pricingKeyPrefix?: string
    noPricingLabel?: string
    showPlatform?: boolean
    /**
     * 当 model.platform 缺失（如 admin 聚合场景）时，用父行的平台作为兜底着色。
     * 仅用于视觉，不影响业务逻辑。
     */
    platformHint?: string
  }>(),
  {
    pricingKeyPrefix: 'availableChannels.pricing',
    noPricingLabel: '',
    showPlatform: true,
    platformHint: ''
  }
)

const effectivePlatform = computed<string>(() => props.model.platform || props.platformHint || '')

const { t } = useI18n()

/** 按 token 定价展示时的换算单位：每百万 token。 */
const perMillionScale = 1_000_000

const popoverBorderClass = 'model-chip__popover-header--border'
const popoverHeaderClass = 'model-chip__popover-header--platform'

function prefixKey(k: string): string {
  return `${props.pricingKeyPrefix}.${k}`
}

const billingModeLabel = computed(() => {
  const mode = props.model.pricing?.billing_mode
  switch (mode) {
    case BILLING_MODE_TOKEN:
      return t(prefixKey('billingModeToken'))
    case BILLING_MODE_PER_REQUEST:
      return t(prefixKey('billingModePerRequest'))
    case BILLING_MODE_IMAGE:
      return t(prefixKey('billingModeImage'))
    default:
      return '-'
  }
})

function formatRange(min: number, max: number | null): string {
  const maxLabel = max == null ? '∞' : String(max)
  return `(${min}, ${maxLabel}]`
}

function formatInterval(iv: UserPricingInterval, mode: BillingMode): string {
  if (mode === BILLING_MODE_PER_REQUEST || mode === BILLING_MODE_IMAGE) {
    return formatScaled(iv.per_request_price, 1)
  }
  const input = formatScaled(iv.input_price, perMillionScale)
  const output = formatScaled(iv.output_price, perMillionScale)
  return `${input} / ${output}`
}

// ── Popover positioning ─────────────────────────────────────────────
// Teleport-to-body + fixed positioning avoids being clipped by
// overflow-hidden ancestors (the parent table card). We re-measure on
// hover enter, scroll, and resize. Pinning to the trigger's top-center
// with a flip when the viewport edge is near keeps it aligned without a
// full-blown positioning lib.
const show = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const popoverEl = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({ top: '0px', left: '0px' })

function updatePosition() {
  const trigger = triggerEl.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const margin = 8
  const popover = popoverEl.value
  const popWidth = popover?.offsetWidth ?? 320
  const popHeight = popover?.offsetHeight ?? 240
  const vw = window.innerWidth
  const vh = window.innerHeight

  let top = rect.bottom + margin
  // Flip upward if it would overflow below.
  if (top + popHeight > vh - margin) {
    top = Math.max(margin, rect.top - popHeight - margin)
  }

  let left = rect.left + rect.width / 2 - popWidth / 2
  if (left < margin) left = margin
  if (left + popWidth > vw - margin) left = vw - margin - popWidth

  popoverStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  }
}

function onEnter() {
  show.value = true
  nextTick(() => {
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
  })
}

function onLeave() {
  show.value = false
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
}

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<style scoped>
.model-chip { position: relative; display: inline-block; min-width: 0; }
.model-chip__trigger {
  display: inline-flex;
  max-width: 100%;
  min-height: 24px;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  padding: 2px 7px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  color: var(--ui-text-muted);
  background: var(--ui-surface-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
  transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
}
.model-chip__trigger:hover,
.model-chip__trigger:focus-visible { border-color: var(--ui-text-soft); color: var(--ui-text); background: var(--ui-surface); outline: none; }
.model-chip__platform,
.model-chip__popover-platform { flex: none; padding: 1px 4px; border-radius: 3px; color: var(--ui-text-soft); background: var(--ui-border-soft); font-size: 9px; font-weight: 700; letter-spacing: .04em; line-height: 14px; text-transform: uppercase; }
.model-chip__popover { position: fixed; z-index: 99999; width: 320px; max-width: calc(100vw - 16px); overflow: hidden; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-panel); color: var(--ui-text); background: var(--ui-surface); box-shadow: 0 12px 30px color-mix(in srgb, var(--ui-text) 16%, transparent); font-size: 12px; pointer-events: none; }
.model-chip__popover-header { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--ui-border-soft); }
.model-chip__popover-header--platform { color: var(--ui-text); background: var(--ui-surface-muted); }
.model-chip__popover-header--border { border-color: var(--ui-border-soft); }
.model-chip__popover-title { min-width: 0; overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.model-chip__popover-body { padding: 12px; }
.model-chip__pricing { display: grid; gap: 8px; color: var(--ui-text); }
.model-chip__row { display: flex; min-width: 0; align-items: baseline; justify-content: space-between; gap: 12px; }
.model-chip__muted { color: var(--ui-text-muted); }
.model-chip__value { min-width: 0; color: var(--ui-text); font-family: var(--ui-font-mono); font-variant-numeric: tabular-nums; text-align: right; }
.model-chip__intervals { display: grid; gap: 6px; margin-top: 4px; padding-top: 8px; border-top: 1px solid var(--ui-border-soft); }
.model-chip__interval-title { color: var(--ui-text-muted); font-weight: 600; }
.model-chip__interval-list { display: grid; gap: 5px; }
.model-chip__interval-row { font-size: 11px; }
@media (prefers-reduced-motion: reduce) { .model-chip__trigger { transition: none; } }
</style>
