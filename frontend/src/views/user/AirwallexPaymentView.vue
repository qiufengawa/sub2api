<template>
  <AppLayout>
    <AppPage density="compact" width="wide">
      <AppPageHeader :title="'Airwallex'">
        <template #status><UiStatusBadge :status="errorMessage ? 'failed' : 'pending'" :label="errorMessage ? t('payment.result.failed') : t('payment.result.processing')" /></template>
      </AppPageHeader>
      <UiSkeleton v-if="loading" variant="rect" width="100%" height="260px" />
      <UiAlert v-else-if="errorMessage" tone="danger" :title="t('payment.airwallexLoadFailed')" :message="errorMessage" />
      <div v-else class="airwallex-payment__grid">
        <AppSection class="airwallex-payment__waiting">
          <UiSpinner size="lg" />
          <h2>Airwallex</h2>
          <p>{{ t('payment.qr.payInNewWindowHint') }}</p>
          <UiButton variant="secondary" density="compact" @click="router.push('/purchase')">{{ t('payment.result.backToRecharge') }}</UiButton>
        </AppSection>
        <AppSection :title="t('payment.actualPay')">
          <UiDescriptionList :columns="1" :items="[
            { label: t('payment.orders.orderId'), value: `#${recoverySnapshot?.orderId || '-'}`, numeric: true },
            { label: t('payment.orders.orderNo'), value: recoverySnapshot?.outTradeNo || '-' },
            { label: t('payment.orders.paymentMethod'), value: 'Airwallex' },
            { label: t('payment.orders.status'), value: t('payment.result.processing') },
          ]" />
        </AppSection>
      </div>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { AppPage, AppPageHeader, AppSection, UiAlert, UiButton, UiDescriptionList, UiSkeleton, UiSpinner, UiStatusBadge } from '@/components/ui'
import {
  readPaymentRecoverySnapshotFromStorage,
  type PaymentRecoverySnapshot,
} from '@/components/payment/paymentFlow'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMessage = ref('')
const recoverySnapshot = ref<PaymentRecoverySnapshot | null>(null)
let disposed = false

function queryString(key: string): string {
  const value = route.query[key]
  if (Array.isArray(value)) return value[0] || ''
  return typeof value === 'string' ? value : ''
}

function buildSuccessUrl(snapshot: PaymentRecoverySnapshot): string {
  const url = new URL('/payment/result', window.location.origin)
  const orderId = queryString('order_id')
  const outTradeNo = queryString('out_trade_no')
  const resumeToken = queryString('resume_token')

  if (orderId || snapshot.orderId > 0) url.searchParams.set('order_id', orderId || String(snapshot.orderId))
  if (outTradeNo || snapshot.outTradeNo) url.searchParams.set('out_trade_no', outTradeNo || snapshot.outTradeNo)
  if (resumeToken || snapshot.resumeToken) url.searchParams.set('resume_token', resumeToken || snapshot.resumeToken)
  return url.toString()
}

function restoreAirwallexSnapshot(): PaymentRecoverySnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  const orderId = Number(queryString('order_id')) || 0
  const outTradeNo = queryString('out_trade_no')
  const resumeToken = queryString('resume_token')
  const snapshot = readPaymentRecoverySnapshotFromStorage(window.localStorage, {
    resumeToken,
    orderId,
    outTradeNo,
  })

  if (!snapshot || snapshot.paymentType !== 'airwallex') {
    return null
  }
  if (orderId > 0 && snapshot.orderId !== orderId) {
    return null
  }
  if (outTradeNo && snapshot.outTradeNo !== outTradeNo) {
    return null
  }
  if (!snapshot.intentId || !snapshot.clientSecret) {
    return null
  }
  return snapshot
}

onMounted(async () => {
  const snapshot = restoreAirwallexSnapshot()
  recoverySnapshot.value = snapshot
  const checkoutLocale = locale.value.toLowerCase().startsWith('zh') ? 'zh' : 'en'

  if (!snapshot) {
    loading.value = false
    errorMessage.value = t('payment.airwallexMissingParams')
    return
  }

  try {
    const airwallex = await import('@airwallex/components-sdk')
    if (disposed) return
    const result = await airwallex.init({
      env: snapshot.paymentEnv === 'prod' ? 'prod' : 'demo',
      enabledElements: ['payments'],
      locale: checkoutLocale,
    })
    if (disposed) return

    loading.value = false
    const checkoutOptions = {
      intent_id: snapshot.intentId,
      client_secret: snapshot.clientSecret,
      currency: snapshot.currency || 'CNY',
      country_code: snapshot.countryCode || 'CN',
      successUrl: buildSuccessUrl(snapshot),
    }
    if (!result.payments) {
      throw new Error(t('payment.airwallexLoadFailed'))
    }
    const redirectResult = result.payments.redirectToCheckout(checkoutOptions)

    if (!disposed && typeof redirectResult === 'string' && redirectResult) {
      window.location.assign(redirectResult)
    }
  } catch (err: unknown) {
    if (disposed) return
    loading.value = false
    errorMessage.value = err instanceof Error && err.message
      ? err.message
      : t('payment.airwallexLoadFailed')
  }
})

onBeforeUnmount(() => {
  disposed = true
})
</script>

<style scoped>
.airwallex-payment__grid { display:grid; grid-template-columns:minmax(0,1fr); gap:20px; align-items:start; }
.airwallex-payment__waiting { display:flex; min-height:260px; flex-direction:column; align-items:center; justify-content:center; gap:12px; text-align:center; }
.airwallex-payment__waiting h2 { margin:0; font-size:18px; }
.airwallex-payment__waiting p { margin:0; color:var(--ui-text-muted); font-size:13px; }
@media(min-width:900px){.airwallex-payment__grid{grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr)}}
</style>
