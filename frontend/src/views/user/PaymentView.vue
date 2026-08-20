<template>
  <AppLayout>
    <AppPage data-testid="payment-page" density="compact" width="wide">
      <AppPageHeader :title="t('payment.title')">
        <template #status>
          <UiStatusBadge
            v-if="paymentPhase === 'paying'"
            status="pending"
            :label="t('common.processing')"
          />
        </template>
      </AppPageHeader>

      <div v-if="loading" class="payment-loading" role="status" aria-live="polite" aria-busy="true">
        <UiSkeleton variant="text" width="220px" height="28px" />
        <UiSkeleton variant="rect" width="100%" height="260px" />
      </div>
      <template v-else>
        <UiAlert
          v-if="errorMessage && paymentPhase === 'select'"
          tone="danger"
          :title="errorMessage"
          :message="errorHintMessage || undefined"
          data-testid="payment-error"
        />
        <UiTabs
          v-if="tabs.length > 1 && paymentPhase === 'select' && !selectedPlan"
          :model-value="activeTab"
          :tabs="tabs.map(tab => ({
            value: tab.key,
            label: tab.label,
            id: `payment-tab-${tab.key}`,
            controls: `payment-tabpanel-${tab.key}`,
          }))"
          :label="t('payment.title')"
          class="payment-tabs"
          @update:model-value="activeTab = $event as 'recharge' | 'subscription'"
        />

        <template v-if="paymentPhase === 'paying'">
          <PaymentStatusPanel
            :order-id="paymentState.orderId"
            :amount="paymentState.amount"
            :pay-amount="paymentState.payAmount"
            :qr-code="paymentState.qrCode"
            :expires-at="paymentState.expiresAt"
            :payment-type="paymentState.paymentType"
            :pay-url="paymentState.payUrl"
            :order-type="paymentState.orderType"
            :currency="paymentState.currency || selectedCurrency"
            :out-trade-no="paymentState.outTradeNo"
            :mobile-alipay-deep-link="paymentState.alipayMobilePrecreateDeepLink"
            @done="onPaymentDone"
            @success="onPaymentSuccess"
            @settled="onPaymentSettled"
          />
        </template>
        <template v-else>
          <div
            v-if="activeTab === 'recharge'"
            id="payment-tabpanel-recharge"
            role="tabpanel"
            aria-labelledby="payment-tab-recharge"
          >
            <div data-testid="recharge-layout" class="payment-checkout-grid">
              <AppSection
                data-testid="recharge-main-surface"
                :title="t('payment.rechargeAccount')"
                divided
              >
                <template #actions>
                  <div class="payment-account-balance">
                    <span>{{ user?.username || '' }}</span>
                    <strong>${{ user?.balance?.toFixed(2) || '0.00' }}</strong>
                  </div>
                </template>
                <UiEmptyState
                  v-if="enabledMethods.length === 0"
                  icon="creditCard"
                  :title="t('payment.notAvailable')"
                />
                <AppStack v-else :gap="20">
                  <div data-testid="recharge-amount-section" class="payment-form-section">
                  <AmountInput
                    v-model="amount"
                    :amounts="[10, 20, 50, 100, 200, 500, 1000, 2000, 5000]"
                    :min="globalMinAmount"
                    :max="globalMaxAmount"
                  />
                    <UiAlert v-if="amountError" tone="warning" :message="amountError" />
                  </div>
                  <div data-testid="recharge-method-section" class="payment-form-section payment-form-section--divided">
                    <PaymentMethodSelector
                      :methods="methodOptions"
                      :selected="selectedMethod"
                      @select="selectedMethod = $event"
                    />
                  </div>
                </AppStack>
              </AppSection>

              <aside
                v-if="enabledMethods.length >= 1"
                data-testid="recharge-checkout-panel"
                class="payment-order-summary"
              >
                <AppSection :title="t('payment.orderSummary')" data-testid="recharge-order-summary">
                  <UiDescriptionList
                    :columns="1"
                    :items="[
                      { label: t('payment.paymentAmount'), value: formatSelectedPaymentAmount(validAmount), numeric: true },
                      { label: `${t('payment.fee')} (${feeRate}%)`, value: formatSelectedPaymentAmount(feeAmount), numeric: true },
                      { label: t('payment.actualPay'), value: formatSelectedPaymentAmount(totalAmount), numeric: true },
                      ...(balanceRechargeMultiplier !== 1 ? [{ label: t('payment.creditedBalance'), value: `$${creditedAmount.toFixed(2)}`, numeric: true }] : []),
                      { label: t('payment.currentBalance'), value: `$${user?.balance?.toFixed(2) || '0.00'}`, numeric: true },
                    ]"
                  />
                  <p v-if="balanceRechargeMultiplier !== 1" class="payment-summary-note">
                    {{ t('payment.rechargeRatePreview', { usd: balanceRechargeMultiplier.toFixed(2) }) }}
                  </p>
                </AppSection>
                <UiButton
                  variant="primary"
                  density="compact"
                  block
                  :disabled="!canSubmit"
                  :loading="submitting"
                  @click="handleSubmitRecharge"
                >
                  {{ t('payment.createOrder') }} {{ formatSelectedPaymentAmount(totalAmount) }}
                </UiButton>
              </aside>
            </div>
          </div>
          <div
            v-else-if="activeTab === 'subscription'"
            id="payment-tabpanel-subscription"
            role="tabpanel"
            aria-labelledby="payment-tab-subscription"
          >
            <template v-if="selectedPlan">
              <div class="payment-checkout-grid">
                <AppSection :title="selectedPlan.name" :description="selectedPlan.description || undefined" divided>
                  <template #actions>
                    <UiBadge>{{ platformLabel(selectedPlanPlatform) }}</UiBadge>
                  </template>
                  <div class="payment-plan-price">
                    <del v-if="selectedPlan.original_price">{{ formatSelectedSubscriptionPaymentAmount(selectedPlan.original_price) }}</del>
                    <strong>{{ formatSelectedSubscriptionPaymentAmount(selectedPlan.price) }}</strong>
                    <span>/ {{ planValiditySuffix }}</span>
                  </div>
                  <UiAlert
                    v-if="selectedPurchaseMode === 'renew_instance' && selectedRenewalSubscription"
                    data-testid="renewal-target"
                    tone="info"
                    :title="t('payment.renewalTarget')"
                  >
                    {{ t('payment.subscriptionInstance', { id: selectedRenewalSubscription.id }) }} ·
                    {{ t('payment.currentExpiration') }}:
                    {{ formatRenewalExpiration(selectedRenewalSubscription.expires_at) }}
                  </UiAlert>
                  <AppSection :title="t('payment.planCard.includedGroups')" divided>
                    <div class="payment-group-list">
                      <div v-for="group in selectedPlan.included_groups" :key="group.id" class="payment-group-row">
                        <PlatformIcon :platform="group.platform as GroupPlatform" size="sm" />
                        <span :title="group.name">{{ group.name }}</span>
                        <code>×{{ normalizedPlanRate(group.rate_multiplier) }}</code>
                        <UiBadge v-if="group.peak_rate_enabled" tone="warning">
                          {{ t('payment.planCard.peakRateShort', { rate: normalizedPlanRate(group.peak_rate_multiplier ?? 1) }) }}
                        </UiBadge>
                      </div>
                    </div>
                  </AppSection>
                  <UiDescriptionList
                    :columns="1"
                    :items="[
                      { label: selectedPlan.cycle_quota_usd != null ? t('payment.planCard.cycleQuota') : t('payment.planCard.quota'), value: selectedPlan.cycle_quota_usd != null ? `$${Number(selectedPlan.cycle_quota_usd).toFixed(2)} · ${selectedPlanResetLabel}` : t('payment.planCard.unlimited'), numeric: selectedPlan.cycle_quota_usd != null },
                      ...(selectedPlan.total_quota_usd != null ? [{ label: t('payment.planCard.totalQuota'), value: `$${Number(selectedPlan.total_quota_usd).toFixed(2)} · ${t('payment.planCard.validForPlanTerm')}`, numeric: true }] : []),
                    ]"
                  />
                  <div v-if="enabledMethods.length >= 1" class="payment-form-section payment-form-section--divided">
                    <PaymentMethodSelector
                      :methods="subMethodOptions"
                      :selected="selectedMethod"
                      @select="selectedMethod = $event"
                    />
                  </div>
                  <UiEmptyState v-else icon="creditCard" :title="t('payment.notAvailable')" />
                </AppSection>

                <aside class="payment-order-summary">
                  <AppSection :title="t('payment.orderSummary')">
                    <UiDescriptionList
                      :columns="1"
                      :items="[
                        { label: t('payment.amountLabel'), value: formatSelectedPaymentAmount(subPaymentAmount), numeric: true },
                        ...(feeRate > 0 ? [{ label: `${t('payment.fee')} (${feeRate}%)`, value: formatSelectedPaymentAmount(subFeeAmount), numeric: true }] : []),
                        { label: t('payment.actualPay'), value: formatSelectedPaymentAmount(subTotalAmount), numeric: true },
                        { label: t('payment.currentBalance'), value: `$${user?.balance?.toFixed(2) || '0.00'}`, numeric: true },
                      ]"
                    />
                  </AppSection>
                  <UiButton variant="primary" density="compact" block :disabled="!canSubmitSubscription" :loading="submitting" @click="confirmSubscribe">
                    {{ t('payment.createOrder') }} {{ formatSelectedPaymentAmount(subTotalAmount) }}
                  </UiButton>
                  <UiButton variant="secondary" density="compact" block @click="selectedPlan = null">{{ t('common.cancel') }}</UiButton>
                </aside>
              </div>
            </template>
            <template v-else>
              <AppSection v-if="activeSubscriptions.length > 0" :title="t('payment.activeSubscription')" divided>
                <div class="payment-subscription-list">
                  <div
                    v-for="sub in activeSubscriptions"
                    :key="sub.id"
                    class="payment-subscription-row"
                  >
                    <div class="payment-subscription-row__title">
                      <strong>{{ sub.plan_name || `Plan #${sub.plan_id}` }}</strong>
                      <UiBadge><PlatformIcon :platform="subscriptionPlatform(sub)" size="xs" />{{ platformLabel(subscriptionPlatform(sub)) }}</UiBadge>
                    </div>
                    <div class="payment-subscription-row__meta">
                      <span v-for="group in sub.included_groups" :key="group.id" :title="subscriptionGroupTitle(group)">
                        {{ group.name }} ×{{ normalizedPlanRate(group.rate_multiplier) }}
                      </span>
                      <span v-if="sub.expires_at">{{ t('userSubscriptions.daysRemaining', { days: getDaysRemaining(sub.expires_at) }) }}</span>
                      <span v-else>{{ t('userSubscriptions.noExpiration') }}</span>
                    </div>
                  </div>
                </div>
              </AppSection>
              <UiEmptyState v-if="checkout.plans.length === 0" icon="gift" :title="t('payment.noPlans')" />
              <div v-else class="payment-plan-grid">
                <SubscriptionPlanCard v-for="plan in checkout.plans" :key="plan.id" :plan="plan" :active-subscriptions="activeSubscriptions" @select="selectPlan" />
              </div>
            </template>
          </div>
        </template>
        <AppSection v-if="(checkout.help_text || checkout.help_image_url) && paymentPhase === 'select' && !selectedPlan" divided>
          <div class="payment-help">
            <button
              v-if="checkout.help_image_url"
              type="button"
              class="payment-help__preview ui-focus-ring"
              :aria-label="t('payment.previewHelpImage')"
              :title="t('payment.previewHelpImage')"
              @click="previewImage = checkout.help_image_url"
            >
              <img
                :src="checkout.help_image_url"
                :alt="t('payment.helpImageAlt')"
                class="payment-help__image"
              />
            </button>
            <p v-if="checkout.help_text">{{ checkout.help_text }}</p>
          </div>
        </AppSection>
      </template>
    </AppPage>
    <UiDialog
      :show="Boolean(previewImage)"
      :title="t('payment.helpImageTitle')"
      width="full"
      :z-index="60"
      @close="previewImage = ''"
    >
      <div class="payment-help-dialog" data-testid="payment-help-image-preview">
        <img
          v-if="previewImage"
          :src="previewImage"
          :alt="t('payment.helpImageAlt')"
          class="payment-help-dialog__image"
        />
      </div>
    </UiDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePaymentStore } from '@/stores/payment'
import { useAppStore } from '@/stores'
import { paymentAPI } from '@/api/payment'
import subscriptionsAPI from '@/api/subscriptions'
import { extractApiErrorMessage, extractI18nErrorMessage } from '@/utils/apiError'
import { isMobileDevice } from '@/utils/device'
import { formatPeakRateWindow, serverTimezoneLabel, type PeakRateFields } from '@/utils/peak-rate'
import { formatDateTimeToMinute } from '@/utils/format'
import type { SubscriptionPlan, CheckoutInfoResponse, CreateOrderResult, OrderType, SubscriptionPurchaseMode } from '@/types/payment'
import type { GroupPlatform, UserSubscription } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import AmountInput from '@/components/payment/AmountInput.vue'
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector.vue'
import { METHOD_ORDER, getPaymentPopupFeatures } from '@/components/payment/providerConfig'
import {
  PAYMENT_RECOVERY_STORAGE_KEY,
  buildCreateOrderPayload,
  clearPaymentRecoverySnapshot,
  clearPaymentRecoverySnapshotForIdentity,
  decidePaymentLaunch,
  getVisibleMethods,
  normalizePaymentNavigationUrl,
  normalizeVisibleMethod,
  readPaymentRecoverySnapshotFromStorage,
  type PaymentRecoveryIdentity,
  type PaymentRecoverySnapshot,
  writePaymentRecoverySnapshot,
} from '@/components/payment/paymentFlow'
import { platformLabel } from '@/utils/platformColors'
import SubscriptionPlanCard from '@/components/payment/SubscriptionPlanCard.vue'
import PaymentStatusPanel from '@/components/payment/PaymentStatusPanel.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { DEFAULT_PAYMENT_CURRENCY, formatPaymentAmount, normalizePaymentCurrency } from '@/components/payment/currency'
import { planValiditySuffix as validitySuffixOf } from '@/components/payment/validity'
import type { PaymentMethodOption } from '@/components/payment/PaymentMethodSelector.vue'
import { buildPaymentErrorToastMessage, describePaymentScenarioError } from './paymentUx'
import { hasWechatResumeQuery, parseWechatResumeRoute, stripWechatResumeQuery } from './paymentWechatResume'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiSkeleton,
  UiStatusBadge,
  UiTabs,
} from '@/components/ui'

const i18n = useI18n()
const { t } = i18n
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const paymentStore = usePaymentStore()
const appStore = useAppStore()
let lifecycleEpoch = 0

function isLifecycleActive(epoch: number): boolean {
  return epoch === lifecycleEpoch
}

const user = computed(() => authStore.user)
const activeSubscriptions = ref<UserSubscription[]>([])

async function refreshPurchaseSubscriptions(epoch = lifecycleEpoch) {
  const subscriptions = await subscriptionsAPI.getMySubscriptions()
  if (!isLifecycleActive(epoch)) return
  const now = Date.now()
  activeSubscriptions.value = subscriptions.filter(subscription =>
    (subscription.status === 'active' || subscription.status === 'suspended') &&
    (!subscription.expires_at || new Date(subscription.expires_at).getTime() > now)
  )
}

function getDaysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function subscriptionPlatform(sub: { included_groups: Array<{ platform?: string }> }): GroupPlatform {
  const platforms = [...new Set(
    sub.included_groups
      .map(group => group.platform)
      .filter((platform): platform is GroupPlatform => Boolean(platform))
  )]
  if (platforms.length === 1) return platforms[0] || ''
  return 'composite'
}

function subscriptionGroupTitle(group: PeakRateFields & { name: string; rate_multiplier: number }): string {
  const peak = formatPeakRateWindow(group, serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset))
  return peak ? `${group.name} · ×${normalizedPlanRate(group.rate_multiplier)} · ${peak}` : `${group.name} · ×${normalizedPlanRate(group.rate_multiplier)}`
}

const loading = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const errorHintMessage = ref('')
const activeTab = ref<'recharge' | 'subscription'>('recharge')
const amount = ref<number | null>(null)
const selectedMethod = ref('')
const selectedPlan = ref<SubscriptionPlan | null>(null)
const selectedPurchaseMode = ref<SubscriptionPurchaseMode | undefined>()
const selectedTargetSubscriptionId = ref<number | undefined>()
const previewImage = ref('')

const selectedRenewalSubscription = computed(() => {
  if (selectedPurchaseMode.value !== 'renew_instance' || !selectedTargetSubscriptionId.value) return null
  return activeSubscriptions.value.find(subscription => subscription.id === selectedTargetSubscriptionId.value) ?? null
})

function formatRenewalExpiration(expiresAt: string | null): string {
  return expiresAt ? formatDateTimeToMinute(new Date(expiresAt)) : t('userSubscriptions.noExpiration')
}

const paymentPhase = ref<'select' | 'paying'>('select')

interface CreateOrderOptions {
  openid?: string
  wechatResumeToken?: string
  paymentType?: string
  isResume?: boolean
  mobileQrFallbackAttempted?: boolean
	purchaseMode?: SubscriptionPurchaseMode
	targetSubscriptionId?: number
}

interface WeixinJSBridgeLike {
  invoke(
    action: string,
    payload: Record<string, unknown>,
    callback: (result: Record<string, unknown>) => void,
  ): void
}

function emptyPaymentState(): PaymentRecoverySnapshot {
  return {
    orderId: 0,
    amount: 0,
    qrCode: '',
    expiresAt: '',
    paymentType: '',
    payUrl: '',
    outTradeNo: '',
    clientSecret: '',
    intentId: '',
    currency: '',
    countryCode: '',
    paymentEnv: '',
    payAmount: 0,
    orderType: '',
    paymentMode: '',
    resumeToken: '',
    alipayMobilePrecreateDeepLink: false,
    createdAt: 0,
  }
}

function getWeixinJSBridge(): WeixinJSBridgeLike | undefined {
  return (window as Window & { WeixinJSBridge?: WeixinJSBridgeLike }).WeixinJSBridge
}

function waitForWeixinJSBridge(timeoutMs = 4000): Promise<WeixinJSBridgeLike | null> {
  const existing = getWeixinJSBridge()
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false
    const finish = (bridge: WeixinJSBridgeLike | null) => {
      if (settled) return
      settled = true
      document.removeEventListener('WeixinJSBridgeReady', handleReady)
      document.removeEventListener('onWeixinJSBridgeReady', handleReady)
      window.clearTimeout(timer)
      resolve(bridge)
    }
    const handleReady = () => finish(getWeixinJSBridge() ?? null)
    const timer = window.setTimeout(() => finish(getWeixinJSBridge() ?? null), timeoutMs)
    document.addEventListener('WeixinJSBridgeReady', handleReady, false)
    document.addEventListener('onWeixinJSBridgeReady', handleReady, false)
  })
}

async function invokeWechatJsapiPayment(payload: Record<string, unknown>, epoch: number): Promise<Record<string, unknown> | null> {
  const bridge = await waitForWeixinJSBridge()
  if (!isLifecycleActive(epoch)) return null
  if (!bridge) {
    throw new Error('WECHAT_JSAPI_UNAVAILABLE')
  }
  return new Promise((resolve) => {
    bridge.invoke('getBrandWCPayRequest', payload, (result) => resolve(result || {}))
  })
}

const paymentState = ref<PaymentRecoverySnapshot>(emptyPaymentState())

function persistRecoverySnapshot(snapshot: PaymentRecoverySnapshot) {
  if (typeof window === 'undefined' || !snapshot.orderId) return
  writePaymentRecoverySnapshot(window.localStorage, snapshot)
}

function removeRecoverySnapshot(identity: PaymentRecoveryIdentity = paymentState.value) {
  if (typeof window === 'undefined') return
  if (identity.resumeToken || identity.orderId || identity.outTradeNo) {
    clearPaymentRecoverySnapshotForIdentity(window.localStorage, identity)
    return
  }
  clearPaymentRecoverySnapshot(window.localStorage, PAYMENT_RECOVERY_STORAGE_KEY)
}

function resetPayment() {
  const recoveryIdentity: PaymentRecoveryIdentity = { ...paymentState.value }
  removeRecoverySnapshot(recoveryIdentity)
  paymentPhase.value = 'select'
  paymentState.value = emptyPaymentState()
}

async function redirectToPaymentResult(state: PaymentRecoverySnapshot, epoch = lifecycleEpoch): Promise<void> {
  if (!isLifecycleActive(epoch)) return
  const query: Record<string, string | undefined> = {}
  if (state.orderId > 0) {
    query.order_id = String(state.orderId)
  }
  if (state.outTradeNo) {
    query.out_trade_no = state.outTradeNo
  }
  if (state.resumeToken) {
    query.resume_token = state.resumeToken
  }
  await router.push({
    path: '/payment/result',
    query,
  })
}

function buildWechatOAuthAuthorizeUrl(
  authorizeUrl: string,
  context: { paymentType: string; orderType: OrderType; planId?: number; orderAmount: number; purchaseMode?: SubscriptionPurchaseMode; targetSubscriptionId?: number },
): string {
  const normalizedUrl = normalizePaymentNavigationUrl(authorizeUrl)
  if (!normalizedUrl || typeof window === 'undefined') {
    return normalizedUrl
  }

  try {
    const targetUrl = new URL(normalizedUrl, window.location.origin)
    const redirectPath = targetUrl.searchParams.get('redirect') || '/purchase'
    const redirectUrl = new URL(redirectPath, window.location.origin)
    const paymentType = normalizeVisibleMethod(context.paymentType) || context.paymentType.trim() || 'wxpay'

    redirectUrl.searchParams.set('payment_type', paymentType)
    redirectUrl.searchParams.set('order_type', context.orderType)

    if (context.planId) {
      redirectUrl.searchParams.set('plan_id', String(context.planId))
    } else {
      redirectUrl.searchParams.delete('plan_id')
    }
	if (context.purchaseMode) redirectUrl.searchParams.set('purchase_mode', context.purchaseMode)
	else redirectUrl.searchParams.delete('purchase_mode')
	if (context.targetSubscriptionId) redirectUrl.searchParams.set('target_subscription_id', String(context.targetSubscriptionId))
	else redirectUrl.searchParams.delete('target_subscription_id')

    if (context.orderAmount > 0) {
      redirectUrl.searchParams.set('amount', String(context.orderAmount))
    } else {
      redirectUrl.searchParams.delete('amount')
    }

    targetUrl.searchParams.set('redirect', `${redirectUrl.pathname}${redirectUrl.search}`)
    return targetUrl.toString()
  } catch {
    return normalizedUrl
  }
}

function onPaymentDone() {
  const wasSubscription = paymentState.value.orderType === 'subscription'
  resetPayment()
  selectedPlan.value = null
  if (wasSubscription) {
    refreshPurchaseSubscriptions().catch(() => {})
  }
}

async function onPaymentSuccess() {
  const completedPayment = { ...paymentState.value }
  removeRecoverySnapshot()
  authStore.refreshUser()
  if (paymentState.value.orderType === 'subscription') {
    refreshPurchaseSubscriptions().catch(() => {})
  }
  await redirectToPaymentResult(completedPayment)
}

function onPaymentSettled() {
  removeRecoverySnapshot()
}

// All checkout data from single API call
const checkout = ref<CheckoutInfoResponse>({
  methods: {}, global_min: 0, global_max: 0,
  plans: [], balance_disabled: false, balance_recharge_multiplier: 1, subscription_usd_to_cny_rate: 0, recharge_fee_rate: 0, help_text: '', help_image_url: '', stripe_publishable_key: '',
})

const tabs = computed(() => {
  const result: { key: 'recharge' | 'subscription'; label: string }[] = []
  if (!checkout.value.balance_disabled) result.push({ key: 'recharge', label: t('payment.tabTopUp') })
  result.push({ key: 'subscription', label: t('payment.tabSubscribe') })
  return result
})

const visibleMethods = computed(() => getVisibleMethods(checkout.value.methods))
const enabledMethods = computed(() => Object.keys(visibleMethods.value))
const validAmount = computed(() => amount.value ?? 0)
const balanceRechargeMultiplier = computed(() => {
  const multiplier = checkout.value.balance_recharge_multiplier
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
})
// 订阅 CNY 换算汇率（1 USD = X CNY）。0 = 未配置，订阅保持 price 直付（与后端 opt-in 条件严格镜像）。
const subscriptionUsdToCnyRate = computed(() => {
  const rate = checkout.value.subscription_usd_to_cny_rate
  return Number.isFinite(rate) && rate > 0 ? rate : 0
})
const creditedAmount = computed(() => Math.round((validAmount.value * balanceRechargeMultiplier.value) * 100) / 100)

// Check if an amount fits a method's [min, max]. 0 = no limit.
function amountFitsMethod(amt: number, methodType: string): boolean {
  if (amt <= 0) return true
  const ml = visibleMethods.value[methodType]
  if (!ml) return false
  if (ml.single_min > 0 && amt < ml.single_min) return false
  if (ml.single_max > 0 && amt > ml.single_max) return false
  return true
}

// Visible methods decide the amount range shown to users.
const globalMinAmount = computed(() => {
  const limits = Object.values(visibleMethods.value)
  if (limits.length === 0) return 0
  if (limits.some(limit => limit.single_min <= 0)) return 0
  return Math.min(...limits.map(limit => limit.single_min))
})
const globalMaxAmount = computed(() => {
  const limits = Object.values(visibleMethods.value)
  if (limits.length === 0) return 0
  if (limits.some(limit => limit.single_max <= 0)) return 0
  return Math.max(...limits.map(limit => limit.single_max))
})

// Selected method's limits (for validation and error messages)
const selectedLimit = computed(() => visibleMethods.value[selectedMethod.value])
const selectedCurrency = computed(() => normalizePaymentCurrency(selectedLimit.value?.currency))
const localeCode = computed(() => {
  const raw = i18n.locale as unknown
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'value' in raw) {
    return String((raw as { value?: string }).value || '')
  }
  return undefined
})

function currencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

function roundPaymentAmount(value: number, currency: string): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** currencyFractionDigits(currency)
  return Math.round(value * factor) / factor
}

function ceilPaymentAmount(value: number, currency: string): number {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** currencyFractionDigits(currency)
  return Math.ceil(value * factor) / factor
}

function subscriptionPaymentAmountForCurrency(value: number, currency: string): number {
  const rate = subscriptionUsdToCnyRate.value
  if (rate <= 0 || currency !== DEFAULT_PAYMENT_CURRENCY) return roundPaymentAmount(value, currency)
  return roundPaymentAmount(value * rate, currency)
}

function formatSelectedPaymentAmount(value: number): string {
  return formatPaymentAmount(value, selectedCurrency.value, localeCode.value)
}

function formatSelectedSubscriptionPaymentAmount(value: number): string {
  return formatSelectedPaymentAmount(subscriptionPaymentAmountForCurrency(value, selectedCurrency.value))
}

const methodOptions = computed<PaymentMethodOption[]>(() =>
  enabledMethods.value.map((type) => {
    const ml = visibleMethods.value[type]
    return {
      type,
      display_name: ml?.display_name,
      fee_rate: ml?.fee_rate ?? 0,
      available: ml?.available !== false && amountFitsMethod(validAmount.value, type),
    }
  })
)

const feeRate = computed(() => checkout.value?.recharge_fee_rate ?? 0)
const feeAmount = computed(() =>
  feeRate.value > 0 && validAmount.value > 0
    ? Math.ceil(((validAmount.value * feeRate.value) / 100) * 100) / 100
    : 0
)
const totalAmount = computed(() =>
  feeRate.value > 0 && validAmount.value > 0
    ? Math.round((validAmount.value + feeAmount.value) * 100) / 100
    : validAmount.value
)

const amountError = computed(() => {
  if (validAmount.value <= 0) return ''
  // No method can handle this amount
  if (!enabledMethods.value.some((m) => amountFitsMethod(validAmount.value, m))) {
    return t('payment.amountNoMethod')
  }
  // Selected method can't handle this amount (but others can)
  const ml = selectedLimit.value
  if (ml) {
    if (ml.single_min > 0 && validAmount.value < ml.single_min) return t('payment.amountTooLow', { min: formatSelectedPaymentAmount(ml.single_min) })
    if (ml.single_max > 0 && validAmount.value > ml.single_max) return t('payment.amountTooHigh', { max: formatSelectedPaymentAmount(ml.single_max) })
  }
  return ''
})

const canSubmit = computed(() =>
  validAmount.value > 0
    && amountFitsMethod(validAmount.value, selectedMethod.value)
    && selectedLimit.value?.available !== false
)

const subPaymentAmount = computed(() => {
  const price = selectedPlan.value?.price ?? 0
  return subscriptionPaymentAmountForCurrency(price, selectedCurrency.value)
})

const subFeeAmount = computed(() => {
  if (feeRate.value <= 0 || subPaymentAmount.value <= 0) return 0
  return ceilPaymentAmount((subPaymentAmount.value * feeRate.value) / 100, selectedCurrency.value)
})

const subTotalAmount = computed(() => {
  if (feeRate.value <= 0 || subPaymentAmount.value <= 0) return subPaymentAmount.value
  return roundPaymentAmount(subPaymentAmount.value + subFeeAmount.value, selectedCurrency.value)
})

function subscriptionTotalAmountForCurrency(value: number, currency: string): number {
  const paymentAmount = subscriptionPaymentAmountForCurrency(value, currency)
  if (feeRate.value <= 0 || paymentAmount <= 0) return paymentAmount
  const fee = ceilPaymentAmount((paymentAmount * feeRate.value) / 100, currency)
  return roundPaymentAmount(paymentAmount + fee, currency)
}

// Subscription-specific: method options based on gateway pay amount
const subMethodOptions = computed<PaymentMethodOption[]>(() => {
  const price = selectedPlan.value?.price ?? 0
  return enabledMethods.value.map((type) => {
    const ml = visibleMethods.value[type]
    const currency = normalizePaymentCurrency(ml?.currency)
    return {
      type,
      display_name: ml?.display_name,
      fee_rate: ml?.fee_rate ?? 0,
      available: ml?.available !== false && amountFitsMethod(subscriptionTotalAmountForCurrency(price, currency), type),
    }
  })
})

const canSubmitSubscription = computed(() =>
  selectedPlan.value !== null
    && amountFitsMethod(subTotalAmount.value, selectedMethod.value)
    && selectedLimit.value?.available !== false
)

// Auto-switch to first available method when current selection can't handle the amount
watch(() => [validAmount.value, selectedMethod.value] as const, ([amt, method]) => {
  if (amt <= 0 || amountFitsMethod(amt, method)) return
  const available = enabledMethods.value.find((m) => amountFitsMethod(amt, m))
  if (available) selectedMethod.value = available
})

watch(() => [activeTab.value, selectedPlan.value?.id, subTotalAmount.value, selectedMethod.value] as const, ([tab, _planId, total, method]) => {
  if (tab !== 'subscription' || !selectedPlan.value || total <= 0) return
  const current = subMethodOptions.value.find(option => option.type === method)
  if (current?.available) return
  const available = subMethodOptions.value.find(option => option.available)
  if (available && available.type !== method) selectedMethod.value = available.type
})

// Subscription confirm: platform accent colors (clean card, no gradient)
const selectedPlanPlatform = computed(() => {
  const plan = selectedPlan.value
  if (!plan) return ''
  const platforms = [...new Set((plan.included_groups ?? []).map(group => group.platform).filter(Boolean))]
  if (platforms.length === 1) return platforms[0]
  if (platforms.length > 1) return 'composite'
  return ''
})
function normalizedPlanRate(rate: number): number {
  return Number((rate ?? 1).toPrecision(10))
}

const selectedPlanResetLabel = computed(() => {
  const seconds = Number(selectedPlan.value?.reset_interval_seconds) || 0
  if (seconds <= 0) return t('payment.planCard.noReset')
  return t('payment.planCard.resetEveryDays', { days: Number((seconds / 86400).toFixed(2)) })
})

const planValiditySuffix = computed(() => {
  if (!selectedPlan.value) return ''
  return validitySuffixOf(selectedPlan.value, t)
})

function selectPlan(plan: SubscriptionPlan) {
  selectedPlan.value = plan
	const owned = activeSubscriptions.value.filter(sub =>
		sub.plan_id === plan.id &&
		(sub.status === 'active' || sub.status === 'suspended') &&
		(!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now())
	)
	if ((Number(plan.max_subscriptions_per_user) || 1) === 1 && owned.length > 0) {
		selectedPurchaseMode.value = 'renew_instance'
		selectedTargetSubscriptionId.value = owned[0].id
	} else {
		selectedPurchaseMode.value = 'new_instance'
		selectedTargetSubscriptionId.value = undefined
	}
  errorMessage.value = ''
}

async function handleSubmitRecharge() {
  if (!canSubmit.value || submitting.value) return
  await createOrder(validAmount.value, 'balance')
}

async function confirmSubscribe() {
  if (!selectedPlan.value || submitting.value) return
  await createOrder(selectedPlan.value.price, 'subscription', selectedPlan.value.id, {
	  purchaseMode: selectedPurchaseMode.value,
	  targetSubscriptionId: selectedTargetSubscriptionId.value,
	})
}

async function createOrder(orderAmount: number, orderType: OrderType, planId?: number, options: CreateOrderOptions = {}) {
  const epoch = lifecycleEpoch
  if (!isLifecycleActive(epoch)) return
  submitting.value = true
  errorMessage.value = ''
  errorHintMessage.value = ''
  const requestType = normalizeVisibleMethod(options.paymentType || selectedMethod.value) || options.paymentType || selectedMethod.value
  try {
    const payload = buildCreateOrderPayload({
      amount: orderAmount,
      paymentType: requestType,
      orderType,
      planId,
	  purchaseMode: options.purchaseMode,
	  targetSubscriptionId: options.targetSubscriptionId,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      isMobile: isMobileDevice(),
      isWechatBrowser: typeof window !== 'undefined' && /MicroMessenger/i.test(window.navigator.userAgent),
      forceQRCode: !!(checkout.value.alipay_force_qrcode && normalizeVisibleMethod(requestType) === 'alipay'),
      mobilePrecreateDeepLink: checkout.value.alipay_mobile_precreate_deep_link === true,
    })
    if (options.openid) {
      payload.openid = options.openid
    }
    if (options.wechatResumeToken) {
      payload.wechat_resume_token = options.wechatResumeToken
    }

    const result = await paymentStore.createOrder(payload) as CreateOrderResult & { resume_token?: string }
    if (!isLifecycleActive(epoch)) return
    const openWindow = (url: string) => {
      const win = window.open(url, 'paymentPopup', getPaymentPopupFeatures())
      if (!win || win.closed) {
        window.location.href = url
      }
    }
    const visibleMethod = normalizeVisibleMethod(requestType) || requestType
    // When user clicks the dedicated Stripe button, leave method blank so the
    // landing page renders Stripe's full Payment Element (card/link/alipay/wxpay).
    const stripeMethod = visibleMethod === 'stripe'
      ? ''
      : visibleMethod === 'wxpay' ? 'wechat_pay' : 'alipay'
    const stripeRouteUrl = result.client_secret && visibleMethod !== 'airwallex'
      ? router.resolve({
        path: '/payment/stripe',
        query: {
          order_id: String(result.order_id),
          client_secret: result.client_secret,
          method: stripeMethod || undefined,
          resume_token: result.resume_token || undefined,
        },
      }).href
      : ''
    const airwallexRouteUrl = result.client_secret && result.intent_id
      ? router.resolve({
        path: '/payment/airwallex',
        query: {
          order_id: String(result.order_id),
          out_trade_no: result.out_trade_no || undefined,
          resume_token: result.resume_token || undefined,
        },
      }).href
      : ''
    const decision = decidePaymentLaunch(result, {
      visibleMethod,
      orderType,
      isMobile: isMobileDevice(),
      isWechatBrowser: typeof window !== 'undefined' && /MicroMessenger/i.test(window.navigator.userAgent),
      forceQRCode: !!(checkout.value.alipay_force_qrcode && visibleMethod === 'alipay'),
      mobilePrecreateDeepLink: checkout.value.alipay_mobile_precreate_deep_link === true,
      stripePopupUrl: stripeRouteUrl,
      stripeRouteUrl,
      airwallexRouteUrl,
    })

    if (decision.kind === 'wechat_oauth' && decision.oauth?.authorize_url) {
      window.location.href = buildWechatOAuthAuthorizeUrl(decision.oauth.authorize_url, {
        paymentType: visibleMethod,
        orderType,
        planId,
        orderAmount,
		purchaseMode: options.purchaseMode,
		targetSubscriptionId: options.targetSubscriptionId,
      })
      return
    }

    if (decision.kind === 'unhandled') {
      applyScenarioError({ reason: 'UNHANDLED_PAYMENT_SCENARIO' }, visibleMethod)
      return
    }

    paymentState.value = decision.paymentState
    paymentPhase.value = 'paying'
    persistRecoverySnapshot(decision.recovery)

    if (decision.kind === 'stripe_popup') {
      openWindow(decision.paymentState.payUrl)
      return
    }
    if (decision.kind === 'stripe_route') {
      window.location.href = decision.paymentState.payUrl
      return
    }
    if (decision.kind === 'airwallex_route') {
      window.location.href = decision.paymentState.payUrl
      return
    }
    if (decision.kind === 'wechat_jsapi' && decision.jsapi) {
      try {
        const jsapiResult = await invokeWechatJsapiPayment(decision.jsapi as Record<string, unknown>, epoch)
        if (!isLifecycleActive(epoch) || !jsapiResult) return
        const errMsg = String(jsapiResult.err_msg || '').toLowerCase()
        if (errMsg.includes('cancel')) {
          appStore.showInfo(t('payment.qr.cancelled'))
          resetPayment()
        } else if (errMsg && !errMsg.includes('ok')) {
          resetPayment()
          const fallbackApplied = await attemptMobileQrFallback(
            { reason: 'WECHAT_JSAPI_FAILED', message: errMsg },
            {
              orderAmount,
              orderType,
              planId,
			  purchaseMode: options.purchaseMode,
			  targetSubscriptionId: options.targetSubscriptionId,
              wechatResumeToken: options.wechatResumeToken,
              paymentType: visibleMethod,
              attempted: options.mobileQrFallbackAttempted === true,
            },
            epoch,
          )
          if (!isLifecycleActive(epoch)) return
          if (!fallbackApplied) {
            applyScenarioError({ reason: 'WECHAT_JSAPI_FAILED', message: errMsg }, visibleMethod)
          }
        } else {
          const resultState = { ...decision.paymentState }
          resetPayment()
          await redirectToPaymentResult(resultState, epoch)
        }
      } catch (err: unknown) {
        resetPayment()
        const fallbackApplied = await attemptMobileQrFallback(err, {
          orderAmount,
          orderType,
          planId,
		  purchaseMode: options.purchaseMode,
		  targetSubscriptionId: options.targetSubscriptionId,
          wechatResumeToken: options.wechatResumeToken,
          paymentType: visibleMethod,
          attempted: options.mobileQrFallbackAttempted === true,
        }, epoch)
        if (!isLifecycleActive(epoch)) return
        if (!fallbackApplied) {
          throw err
        }
      }
      return
    }
    if (decision.kind === 'redirect_waiting' && decision.paymentState.payUrl) {
      if (isMobileDevice()) {
        window.location.href = decision.paymentState.payUrl
        return
      }
      openWindow(decision.paymentState.payUrl)
    }
  } catch (err: unknown) {
    if (!isLifecycleActive(epoch)) return
    const apiErr = err as Record<string, unknown>
    if (apiErr.reason === 'TOO_MANY_PENDING') {
      const metadata = apiErr.metadata as Record<string, unknown> | undefined
      errorMessage.value = t('payment.errors.tooManyPending', { max: metadata?.max || '' })
      errorHintMessage.value = ''
    } else if (apiErr.reason === 'CANCEL_RATE_LIMITED') {
      errorMessage.value = t('payment.errors.cancelRateLimited')
      errorHintMessage.value = ''
    } else {
      const fallbackApplied = await attemptMobileQrFallback(err, {
        orderAmount,
        orderType,
        planId,
	    purchaseMode: options.purchaseMode,
	    targetSubscriptionId: options.targetSubscriptionId,
        wechatResumeToken: options.wechatResumeToken,
        paymentType: requestType,
        attempted: options.mobileQrFallbackAttempted === true,
      }, epoch)
      if (!isLifecycleActive(epoch)) return
      if (fallbackApplied) return
      const handled = applyScenarioError(
        err,
        normalizeVisibleMethod(options.paymentType || selectedMethod.value) || selectedMethod.value,
      )
      if (!handled) {
        errorMessage.value = extractI18nErrorMessage(err, t, 'payment.errors', extractApiErrorMessage(err, t('payment.result.failed')))
        errorHintMessage.value = ''
      }
      if (handled) {
        return
      }
    }
    appStore.showError(buildPaymentErrorToastMessage(errorMessage.value, errorHintMessage.value))
  } finally {
    if (isLifecycleActive(epoch)) submitting.value = false
  }
}

interface MobileQrFallbackContext {
  orderAmount: number
  orderType: OrderType
  planId?: number
	purchaseMode?: SubscriptionPurchaseMode
	targetSubscriptionId?: number
  wechatResumeToken?: string
  paymentType: string
  attempted: boolean
}

function shouldFallbackToDesktopQr(err: unknown, paymentMethod: string, attempted: boolean): boolean {
  if (attempted || !isMobileDevice()) {
    return false
  }

  const normalizedMethod = normalizeVisibleMethod(paymentMethod) || paymentMethod
  const reason = typeof err === 'object' && err && 'reason' in err && typeof err.reason === 'string'
    ? err.reason
    : ''
  const message = err instanceof Error
    ? err.message
    : (typeof err === 'object' && err && 'message' in err && typeof err.message === 'string'
      ? err.message
      : '')
  const normalizedMessage = message.toLowerCase()

  if (normalizedMethod === 'wxpay') {
    return reason === 'WECHAT_H5_NOT_AUTHORIZED'
      || reason === 'WECHAT_PAYMENT_MP_NOT_CONFIGURED'
      || reason === 'WECHAT_JSAPI_FAILED'
      || reason === 'PAYMENT_GATEWAY_ERROR'
      || reason === 'UNHANDLED_PAYMENT_SCENARIO'
      || normalizedMessage.includes('weixinjsbridge is unavailable')
      || normalizedMessage.includes('wechat_jsapi_unavailable')
  }

  if (normalizedMethod === 'alipay') {
    return reason === 'PAYMENT_GATEWAY_ERROR' || reason === 'UNHANDLED_PAYMENT_SCENARIO'
  }

  return false
}

async function attemptMobileQrFallback(err: unknown, context: MobileQrFallbackContext, epoch = lifecycleEpoch): Promise<boolean> {
  if (!isLifecycleActive(epoch)) return false
  if (!shouldFallbackToDesktopQr(err, context.paymentType, context.attempted)) {
    return false
  }

  try {
    const visibleMethod = normalizeVisibleMethod(context.paymentType) || context.paymentType
    const payload = buildCreateOrderPayload({
      amount: context.orderAmount,
      paymentType: visibleMethod,
      orderType: context.orderType,
      planId: context.planId,
	  purchaseMode: context.purchaseMode,
	  targetSubscriptionId: context.targetSubscriptionId,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      isMobile: false,
      isWechatBrowser: false,
    })
    if (context.wechatResumeToken) {
      payload.wechat_resume_token = context.wechatResumeToken
    }
    const result = await paymentStore.createOrder(payload) as CreateOrderResult & { resume_token?: string }
    if (!isLifecycleActive(epoch)) return false
    const stripeMethod = visibleMethod === 'wxpay' ? 'wechat_pay' : 'alipay'
    const stripeRouteUrl = result.client_secret
      ? router.resolve({
        path: '/payment/stripe',
        query: {
          order_id: String(result.order_id),
          client_secret: result.client_secret,
          method: stripeMethod,
          resume_token: result.resume_token || undefined,
        },
      }).href
      : ''
    const decision = decidePaymentLaunch(result, {
      visibleMethod,
      orderType: context.orderType,
      isMobile: false,
      isWechatBrowser: false,
      stripePopupUrl: stripeRouteUrl,
      stripeRouteUrl,
    })

    if (decision.kind !== 'qr_waiting' || !decision.paymentState.qrCode) {
      return false
    }

    errorMessage.value = ''
    errorHintMessage.value = ''
    paymentState.value = decision.paymentState
    paymentPhase.value = 'paying'
    persistRecoverySnapshot(decision.recovery)
    appStore.showWarning(t('payment.errors.mobilePaymentFallbackToQr'))
    return true
  } catch {
    return false
  }
}

function applyScenarioError(err: unknown, paymentMethod: string): boolean {
  const descriptor = describePaymentScenarioError(err, {
    paymentMethod,
    isMobile: isMobileDevice(),
    isWechatBrowser: typeof window !== 'undefined' && /MicroMessenger/i.test(window.navigator.userAgent),
  })
  if (!descriptor) {
    errorMessage.value = ''
    errorHintMessage.value = ''
    return false
  }
  errorMessage.value = t(descriptor.messageKey)
  errorHintMessage.value = descriptor.hintKey ? t(descriptor.hintKey) : ''
  appStore.showError(buildPaymentErrorToastMessage(errorMessage.value, errorHintMessage.value))
  return true
}

async function resumeWechatPaymentFromQuery(epoch: number) {
  const resume = parseWechatResumeRoute(route.query, checkout.value.plans, validAmount.value)
  if (!resume) {
    return
  }

  selectedMethod.value = resume.paymentType
  if (resume.orderType === 'balance' && resume.orderAmount > 0) {
    amount.value = resume.orderAmount
  }
  if (resume.orderType === 'subscription' && resume.planId) {
    selectedPlan.value = checkout.value.plans.find(plan => plan.id === resume.planId) ?? null
  }
	selectedPurchaseMode.value = resume.purchaseMode
	selectedTargetSubscriptionId.value = resume.targetSubscriptionId

  await router.replace({ path: route.path, query: stripWechatResumeQuery(route.query) })
  if (!isLifecycleActive(epoch)) return

  if (resume.wechatResumeToken) {
    await createOrder(0, resume.orderType, resume.planId, {
      wechatResumeToken: resume.wechatResumeToken,
      paymentType: resume.paymentType,
      isResume: true,
	  purchaseMode: resume.purchaseMode,
	  targetSubscriptionId: resume.targetSubscriptionId,
    })
    return
  }

  if (resume.orderAmount > 0 && resume.openid) {
    await createOrder(resume.orderAmount, resume.orderType, resume.planId, {
      openid: resume.openid,
      paymentType: resume.paymentType,
      isResume: true,
	  purchaseMode: resume.purchaseMode,
	  targetSubscriptionId: resume.targetSubscriptionId,
    })
  }
}

onMounted(async () => {
  const epoch = ++lifecycleEpoch
  try {
    const res = await paymentAPI.getCheckoutInfo()
    if (!isLifecycleActive(epoch)) return
    checkout.value = res.data
    if (enabledMethods.value.length) {
      const order: readonly string[] = METHOD_ORDER
      const sorted = [...enabledMethods.value].sort((a, b) => {
        const ai = order.indexOf(a)
        const bi = order.indexOf(b)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      selectedMethod.value = sorted[0]
    }
    if (typeof window !== 'undefined') {
      const routeResumeToken = typeof route.query.resume_token === 'string'
        ? route.query.resume_token
        : typeof route.query.wechat_resume_token === 'string'
          ? route.query.wechat_resume_token
          : undefined
      const isWechatResume = hasWechatResumeQuery(route.query)
      if (isWechatResume) {
        if (routeResumeToken) {
          removeRecoverySnapshot({ resumeToken: routeResumeToken })
        }
      } else {
        const restored = readPaymentRecoverySnapshotFromStorage(window.localStorage, {
          resumeToken: routeResumeToken,
        })
        if (restored) {
          paymentState.value = restored
          paymentPhase.value = 'paying'
          const restoredMethod = normalizeVisibleMethod(restored.paymentType)
            || (visibleMethods.value[restored.paymentType] ? restored.paymentType : '')
          if (restoredMethod) {
            selectedMethod.value = restoredMethod
          }
        } else {
          removeRecoverySnapshot({ resumeToken: routeResumeToken })
        }
      }
    }
    await resumeWechatPaymentFromQuery(epoch)
    if (!isLifecycleActive(epoch)) return
	await refreshPurchaseSubscriptions(epoch).catch(() => {})
    if (!isLifecycleActive(epoch)) return
    if (checkout.value.balance_disabled) {
      activeTab.value = 'subscription'
    }
    // Handle renewal navigation: ?tab=subscription&plan_id=123
    if (route.query.tab === 'subscription') {
      activeTab.value = 'subscription'
      if (route.query.plan_id) {
        const planId = Number(route.query.plan_id)
        selectedPlan.value = checkout.value.plans.find(plan => plan.id === planId) || null
        const subscriptionId = Number(route.query.subscription_id)
        const hasRenewalTarget = Number.isInteger(subscriptionId) && subscriptionId > 0
        const renewal = hasRenewalTarget
          ? activeSubscriptions.value.find(subscription => subscription.id === subscriptionId && subscription.plan_id === planId)
          : undefined
        if (renewal) {
          selectedPurchaseMode.value = 'renew_instance'
          selectedTargetSubscriptionId.value = renewal.id
        } else if (hasRenewalTarget) {
          selectedPlan.value = null
          selectedPurchaseMode.value = undefined
          selectedTargetSubscriptionId.value = undefined
          errorMessage.value = t('payment.errors.renewalTargetUnavailable')
        } else if (selectedPlan.value) {
          selectPlan(selectedPlan.value)
        }
      }
    }
  } catch (err: unknown) {
    if (!isLifecycleActive(epoch)) return
    errorMessage.value = extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))
    appStore.showError(errorMessage.value)
  }
  finally {
    if (isLifecycleActive(epoch)) loading.value = false
  }
})

onBeforeUnmount(() => {
  lifecycleEpoch += 1
})
</script>

<style scoped>
.payment-loading { display:flex; flex-direction:column; gap:16px; padding-top:20px; }
.payment-loading :deep(.ui-skeleton:last-child) { min-height:280px; }
.payment-tabs { margin-bottom:20px; }
.payment-checkout-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:24px; align-items:start; }
.payment-checkout-grid > :deep(.app-section),.payment-order-summary { min-width:0; }
.payment-order-summary { display:flex; flex-direction:column; gap:12px; }
.payment-account-balance { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:flex-end; gap:10px; }
.payment-account-balance span { color:var(--ui-text-muted); font-size:12px; }
.payment-account-balance strong { color:var(--ui-text); font-size:18px; font-variant-numeric:tabular-nums; }
.payment-form-section--divided { padding-top:16px; border-top:1px solid var(--ui-border-soft); }
.payment-summary-note { margin:12px 0 0; color:var(--ui-text-muted); font-size:12px; line-height:18px; }
.payment-plan-price { display:flex; align-items:baseline; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
.payment-plan-price del { color:var(--ui-text-soft); font-size:13px; }
.payment-plan-price strong { color:var(--ui-text); font-size:28px; font-variant-numeric:tabular-nums; }
.payment-plan-price span { color:var(--ui-text-muted); font-size:12px; }
.payment-group-list { display:flex; flex-direction:column; gap:8px; }
.payment-group-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:8px; min-width:0; font-size:12px; }
.payment-group-row > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.payment-group-row code { color:var(--ui-text-muted); font-size:11px; }
.payment-subscription-list { display:flex; flex-direction:column; gap:0; border-top:1px solid var(--ui-border-soft); }
.payment-subscription-row { display:flex; flex-direction:column; gap:5px; padding:12px 0; border-bottom:1px solid var(--ui-border-soft); }
.payment-subscription-row__title { display:flex; min-width:0; align-items:center; gap:8px; }
.payment-subscription-row__title strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
.payment-subscription-row__title :deep(.ui-badge) { flex:none; }
.payment-subscription-row__meta { display:flex; flex-wrap:wrap; gap:6px 12px; color:var(--ui-text-muted); font-size:11px; }
.payment-subscription-row__meta span { max-width:100%; overflow-wrap:anywhere; }
.payment-plan-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; margin-top:20px; }
.payment-help { display:flex; flex-direction:column; align-items:center; gap:12px; text-align:center; }
.payment-help__preview { border:0; background:transparent; cursor:pointer; }
.payment-help__image { display:block; width:auto; max-width:100%; height:160px; object-fit:contain; transition:opacity var(--ui-motion-fast); }
.payment-help__preview:hover .payment-help__image { opacity:.78; }
.payment-help p { max-width:680px; margin:0; color:var(--ui-text-muted); font-size:13px; line-height:20px; }
.payment-help-dialog { display:grid; min-height:0; place-items:center; }
.payment-help-dialog__image { max-width:100%; max-height:calc(100dvh - 160px); object-fit:contain; }
@media (min-width:1100px) { .payment-checkout-grid { grid-template-columns:minmax(0,1fr) 320px; } .payment-order-summary { position:sticky; top:16px; } }
@media (max-width:1099px) { .payment-plan-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:700px) { .payment-plan-grid { grid-template-columns:1fr; } .payment-account-balance { justify-content:flex-start; } }
</style>
