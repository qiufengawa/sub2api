<template>
  <div class="space-y-4">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UiSpinner size="lg" :label="t('common.loading')" />
    </div>
    <div v-else-if="initError" class="ui-panel p-6 text-center">
      <p class="text-sm text-red-600 dark:text-red-400">{{ initError }}</p>
      <UiButton type="button" density="compact" class="mt-4" @click="$emit('back')">{{ t('payment.result.backToRecharge') }}</UiButton>
    </div>
    <!-- Success -->
    <template v-else-if="success">
      <div class="ui-panel p-6">
        <div class="flex flex-col items-center space-y-4 py-4">
          <div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Icon name="check" size="lg" class="text-green-500" />
          </div>
          <p class="text-lg font-bold text-gray-900 dark:text-white">{{ t('payment.result.success') }}</p>
          <div class="w-full rounded-xl bg-gray-50 p-4 dark:bg-dark-800">
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">{{ t('payment.orders.orderId') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">#{{ orderId }}</span>
              </div>
              <div v-if="amount > 0" class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">{{ t('payment.orders.amount') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ creditedAmountSymbol }}{{ amount.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">{{ t('payment.orders.payAmount') }}</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ paymentAmountSymbol }}{{ payAmount.toFixed(2) }}</span>
              </div>
            </div>
          </div>
          <UiButton type="button" variant="primary" @click="$emit('done')">{{ t('common.confirm') }}</UiButton>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- Amount -->
      <div class="ui-panel overflow-hidden">
        <div class="bg-gradient-to-br from-[#635bff] to-[#4f46e5] px-6 py-5 text-center">
          <p class="text-sm font-medium text-indigo-200">{{ t('payment.actualPay') }}</p>
          <p class="mt-1 text-3xl font-bold text-white">{{ paymentAmountSymbol }}{{ payAmount.toFixed(2) }}</p>
        </div>
      </div>
      <!-- Stripe Payment Element -->
      <div class="ui-panel p-6">
        <div ref="stripeMount" class="min-h-[200px]"></div>
        <p v-if="error" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <UiButton
          type="button"
          variant="primary"
          block
          class="mt-6"
          :disabled="!ready"
          :loading="submitting"
          @click="handlePay"
        >{{ t('payment.stripePay') }}</UiButton>
      </div>
      <!-- Cancel order -->
      <UiButton type="button" block :loading="cancelling" @click="handleCancel">
        {{ t('payment.qr.cancelOrder') }}
      </UiButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { paymentAPI } from '@/api/payment'
import { useAppStore } from '@/stores'
import { getPaymentPopupFeatures } from '@/components/payment/providerConfig'
import { currencySymbol } from '@/components/payment/currency'
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiSpinner } from '@/components/ui'

// Stripe payment methods that open a popup (redirect or QR code)
const POPUP_METHODS = new Set(['alipay', 'wechat_pay'])

const props = defineProps<{
  orderId: number
  amount: number
  clientSecret: string
  orderType?: 'balance' | 'subscription'
  publishableKey: string
  payAmount: number
  currency?: string
  outTradeNo?: string
  resumeToken?: string
}>()

const emit = defineEmits<{ success: []; done: []; back: []; redirect: [orderId: number, payUrl: string] }>()

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const stripeMount = ref<HTMLElement | null>(null)
const loading = ref(true)
const initError = ref('')
const error = ref('')
const submitting = ref(false)
const cancelling = ref(false)
const success = ref(false)
const ready = ref(false)
const selectedType = ref('')
const creditedAmountSymbol = currencySymbol('USD')
const paymentAmountSymbol = computed(() => currencySymbol(props.currency))

let stripeInstance: Stripe | null = null
let elementsInstance: StripeElements | null = null
let paymentElement: StripePaymentElement | null = null
let disposed = false
let popupReadyHandler: ((event: MessageEvent) => void) | null = null

function buildResultUrl(): string {
  const query = new URLSearchParams({
    order_id: String(props.orderId),
    status: 'success',
  })
  if (props.outTradeNo) query.set('out_trade_no', props.outTradeNo)
  if (props.resumeToken) query.set('resume_token', props.resumeToken)
  return `${window.location.origin}/payment/result?${query.toString()}`
}

onMounted(async () => {
  disposed = false
  try {
    const { loadStripe } = await import('@stripe/stripe-js/pure')
    const stripe = await loadStripe(props.publishableKey)
    if (disposed) return
    if (!stripe) { initError.value = t('payment.stripeLoadFailed'); return }

    stripeInstance = stripe
    loading.value = false
    await nextTick()
    if (disposed || !stripeMount.value) return

    const isDark = document.documentElement.classList.contains('dark')
    const elements = stripe.elements({
      clientSecret: props.clientSecret,
      appearance: { theme: isDark ? 'night' : 'stripe', variables: { borderRadius: '8px' } },
    })
    elementsInstance = elements
    paymentElement = elements.create('payment', {
      layout: 'tabs',
      paymentMethodOrder: ['alipay', 'wechat_pay', 'card', 'link'],
    } as Record<string, unknown>)
    paymentElement.mount(stripeMount.value)
    paymentElement.on('ready', () => { if (!disposed) ready.value = true })
    paymentElement.on('change', (event: { value: { type: string } }) => {
      if (disposed) return
      selectedType.value = event.value.type
    })
  } catch (err: unknown) {
    initError.value = extractI18nErrorMessage(err, t, 'payment.errors', t('payment.stripeLoadFailed'))
  } finally {
    loading.value = false
  }
})

async function handlePay() {
  if (!stripeInstance || !elementsInstance || submitting.value) return

  // Alipay / WeChat Pay: open popup for redirect or QR display
  if (POPUP_METHODS.has(selectedType.value)) {
    const popupUrl = router.resolve({
      path: '/payment/stripe-popup',
      query: {
        order_id: String(props.orderId),
        method: selectedType.value,
        amount: String(props.payAmount),
        currency: props.currency || undefined,
        out_trade_no: props.outTradeNo || undefined,
        resume_token: props.resumeToken || undefined,
      },
    }).href
    const popup = window.open(popupUrl, 'paymentPopup', getPaymentPopupFeatures())

    const onReady = (event: MessageEvent) => {
      if (event.source !== popup || event.data?.type !== 'STRIPE_POPUP_READY') return
      window.removeEventListener('message', onReady)
      popupReadyHandler = null
      popup?.postMessage({
        type: 'STRIPE_POPUP_INIT',
        clientSecret: props.clientSecret,
        publishableKey: props.publishableKey,
      }, window.location.origin)
    }
    window.addEventListener('message', onReady)
    popupReadyHandler = onReady

    emit('redirect', props.orderId, popupUrl)
    return
  }

  // Card / Link: confirm inline
  submitting.value = true
  error.value = ''
  try {
    const { error: stripeError } = await stripeInstance.confirmPayment({
      elements: elementsInstance,
      confirmParams: {
        return_url: buildResultUrl(),
      },
      redirect: 'if_required',
    })
    if (stripeError) {
      error.value = stripeError.message || t('payment.result.failed')
    } else {
      success.value = true
      emit('success')
    }
  } catch (err: unknown) {
    error.value = extractI18nErrorMessage(err, t, 'payment.errors', t('payment.result.failed'))
  } finally {
    submitting.value = false
  }
}

onUnmounted(() => {
  disposed = true
  if (popupReadyHandler) {
    window.removeEventListener('message', popupReadyHandler)
    popupReadyHandler = null
  }
  paymentElement?.unmount()
  paymentElement = null
  elementsInstance = null
  stripeInstance = null
})

async function handleCancel() {
  if (!props.orderId || cancelling.value) return
  cancelling.value = true
  try {
    await paymentAPI.cancelOrder(props.orderId)
    emit('back')
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    cancelling.value = false
  }
}
</script>
