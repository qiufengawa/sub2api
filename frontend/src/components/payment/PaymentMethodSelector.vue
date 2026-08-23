<template>
  <fieldset class="payment-methods">
    <legend>{{ t('payment.paymentMethod') }}</legend>
    <div
      data-testid="payment-method-grid"
      class="payment-methods__grid"
    >
      <button
        v-for="method in sortedMethods"
        :key="method.type"
        type="button"
        :disabled="!method.available"
        :title="methodLabel(method)"
        :aria-pressed="selected === method.type"
        class="payment-methods__option ui-focus-ring ui-motion"
        :class="{ 'is-selected': selected === method.type }"
        @click="method.available && emit('select', method.type)"
      >
        <img :src="methodIcon(method.type)" :alt="methodLabel(method)" />
        <span class="payment-methods__copy">
            <span data-testid="payment-method-label" class="payment-methods__label">
              {{ methodLabel(method) }}
            </span>
            <span
              v-if="method.fee_rate > 0"
              class="payment-methods__fee"
            >
              {{ t('payment.fee') }} {{ method.fee_rate }}%
            </span>
        </span>
      </button>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { METHOD_ORDER, isBuiltInAlipayMethod, isBuiltInWxpayMethod } from './providerConfig'
import alipayIcon from '@/assets/icons/alipay.svg'
import wxpayIcon from '@/assets/icons/wxpay.svg'
import stripeIcon from '@/assets/icons/stripe.svg'
import airwallexIcon from '@/assets/icons/airwallex.svg'
import paymentIcon from '@/assets/icons/payment.svg'

export interface PaymentMethodOption {
  type: string
  display_name?: string
  fee_rate: number
  available: boolean
}

const props = defineProps<{
  methods: PaymentMethodOption[]
  selected: string
}>()

const emit = defineEmits<{
  select: [type: string]
}>()

const { t } = useI18n()

const METHOD_ICONS: Record<string, string> = {
  alipay: alipayIcon,
  wxpay: wxpayIcon,
  stripe: stripeIcon,
  airwallex: airwallexIcon,
  credit_card: paymentIcon,
}

const sortedMethods = computed(() => {
  const order: readonly string[] = METHOD_ORDER
  return [...props.methods].sort((a, b) => {
    const ai = order.indexOf(a.type)
    const bi = order.indexOf(b.type)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
})

function methodIcon(type: string): string {
  if (isBuiltInAlipayMethod(type)) return METHOD_ICONS.alipay
  if (isBuiltInWxpayMethod(type)) return METHOD_ICONS.wxpay
  if (type === 'airwallex') return METHOD_ICONS.airwallex
  return METHOD_ICONS[type] || paymentIcon
}

function methodLabel(method: PaymentMethodOption): string {
  return method.display_name || t(`payment.methods.${method.type}`, method.type)
}

</script>

<style scoped>
.payment-methods { min-width:0; margin:0; padding:0; border:0; }
.payment-methods legend { margin:0 0 8px; color:var(--ui-text); font-size:12px; font-weight:500; }
.payment-methods__grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,156px),1fr)); gap:8px; }
.payment-methods__option { display:grid; min-width:0; min-height:48px; grid-template-columns:24px minmax(0,1fr); align-items:center; gap:9px; padding:7px 10px; border:1px solid var(--ui-border); border-radius:var(--ui-radius); color:var(--ui-text); background:var(--ui-surface); text-align:left; cursor:pointer; }
.payment-methods__option:hover { border-color:var(--ui-text-soft); background:var(--ui-surface-muted); }
.payment-methods__option.is-selected { border-color:var(--ui-text); background:var(--ui-surface-muted); }
.payment-methods__option:disabled { cursor:not-allowed; opacity:.45; }
.payment-methods__option img { width:24px; height:24px; object-fit:contain; }
.payment-methods__copy { display:flex; min-width:0; flex-direction:column; gap:4px; }
.payment-methods__label { overflow:hidden; font-size:12px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.payment-methods__fee { color:var(--ui-text-muted); font-size:10px; font-variant-numeric:tabular-nums; }
</style>
