/**
 * Payment System Type Definitions
 */

// ==================== Enums / Union Types ====================

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'RECHARGING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUNDING'
  | 'REFUND_PENDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REFUND_FAILED'

export type PaymentType = 'alipay' | 'wxpay' | 'alipay_direct' | 'wxpay_direct' | 'stripe' | 'easypay' | 'airwallex'

export type OrderType = 'balance' | 'subscription'

// ==================== Configuration ====================

export interface PaymentConfig {
  payment_enabled: boolean
  min_amount: number
  max_amount: number
  daily_limit: number
  max_pending_orders: number
  order_timeout_minutes: number
  balance_disabled: boolean
  balance_recharge_multiplier: number
  subscription_usd_to_cny_rate: number
  enabled_payment_types: PaymentType[]
  help_image_url: string
  help_text: string
  stripe_publishable_key: string
}

export interface MethodLimit {
  currency?: string
  display_name?: string
  daily_limit: number
  daily_used: number
  daily_remaining: number
  single_min: number
  single_max: number
  fee_rate: number
  available: boolean
}

/** Response from /payment/limits API */
export interface MethodLimitsResponse {
  methods: Record<string, MethodLimit>
  global_min: number  // widest min across all methods; 0 = no minimum
  global_max: number  // widest max across all methods; 0 = no maximum
}

/** Response from /payment/checkout-info API — single call for the payment page */
export interface CheckoutInfoResponse {
  methods: Record<string, MethodLimit>
  global_min: number
  global_max: number
  plans: SubscriptionPlan[]
  balance_disabled: boolean
  balance_recharge_multiplier: number
  /** Subscription CNY conversion rate (1 USD = X CNY); 0 = disabled, plan price is charged as-is */
  subscription_usd_to_cny_rate: number
  recharge_fee_rate: number
  help_text: string
  help_image_url: string
  stripe_publishable_key: string
  /** When true, Alipay payments on mobile always show the QR code instead of redirecting */
  alipay_force_qrcode?: boolean
  /** When true, official Alipay mobile orders use precreate plus an Alipay app deep link */
  alipay_mobile_precreate_deep_link?: boolean
}

// ==================== Orders ====================

export interface PaymentOrder {
  id: number
  user_id: number
  amount: number
  pay_amount: number
  currency?: string
  fee_rate: number
  payment_type: string
  out_trade_no: string
  status: OrderStatus
  order_type: OrderType
  created_at: string
  expires_at: string
  paid_at?: string
  completed_at?: string
  refund_amount: number
  refund_reason?: string
  refund_requested_at?: string
  refund_requested_by?: number
  refund_request_reason?: string
  plan_id?: number
  provider_instance_id?: string
}

// ==================== Plans & Channels ====================

export interface SubscriptionPlanGroup {
  id: number
  platform: string
  name: string
  rate_multiplier: number
  peak_rate_enabled?: boolean
  peak_start?: string
  peak_end?: string
  peak_rate_multiplier?: number
  daily_limit_usd?: number | null
  weekly_limit_usd?: number | null
  monthly_limit_usd?: number | null
  supported_model_scopes?: string[]
}

export interface SubscriptionPlan {
  id: number
  included_groups: SubscriptionPlanGroup[]
  cycle_quota_usd?: number | null
  total_quota_usd?: number | null
  reset_interval_seconds?: number
  wallet_fallback_enabled?: boolean
  name: string
  description: string
  price: number
  original_price?: number
  /** Display-only ISO 4217 currency label (e.g. "NZD"); empty means no label */
  currency?: string
  validity_days: number
  validity_unit: string
  /** Stored as JSON string in backend; API layer should parse before use */
  features: string[]
  for_sale: boolean
  sort_order: number
}

export interface PaymentCatalogPaymentSettings {
  balance_recharge_multiplier?: number
  subscription_usd_to_cny_rate?: number
}

export interface PaymentCatalogDefaults {
  platform?: string
  subscription_type?: string
  rate_multiplier?: number
  is_exclusive?: boolean
  status?: string
  validity_days?: number
  validity_unit?: string
  currency?: string
  for_sale?: boolean
}

export interface PaymentCatalogRoute {
  public_model: string
  match_type?: string
  target_platform: string
  upstream_model?: string
  endpoint?: string
  priority?: number
  enabled?: boolean
  notes?: string
}

export interface PaymentCatalogGroup {
  key: string
  name: string
  description?: string
  platform?: string
  subscription_type?: string
  rate_multiplier?: number
  is_exclusive?: boolean
  status?: string
  daily_limit_usd?: number | null
  weekly_limit_usd?: number | null
  monthly_limit_usd?: number | null
  default_validity_days?: number
  sort_order?: number
  copy_accounts_from?: string[]
  routes?: PaymentCatalogRoute[]
}

export interface PaymentCatalogPlan {
  included_group_keys?: string[]
  included_group_ids?: number[]
  cycle_quota_usd?: number | null
  total_quota_usd?: number | null
  reset_interval_seconds?: number
  wallet_fallback_enabled?: boolean
  name: string
  description?: string
  price: number
  original_price?: number | null
  currency?: string
  validity_days?: number
  validity_unit?: string
  features?: string[]
  product_name?: string
  for_sale?: boolean
  sort_order?: number
}

export interface PaymentCatalogImportRequest {
  schema_version: number
  mode: string
  payment_settings?: PaymentCatalogPaymentSettings
  defaults: PaymentCatalogDefaults
  groups: PaymentCatalogGroup[]
  plans: PaymentCatalogPlan[]
}

export interface PaymentCatalogImportIssue {
  severity: 'error' | 'warning'
  code: string
  path?: string
  message: string
}

export interface PaymentCatalogFieldDiff {
  field: string
  before: unknown
  after: unknown
}

export interface PaymentCatalogImportChange {
  kind: 'group' | 'plan' | 'route' | 'account_binding' | 'setting'
  action: 'create' | 'update' | 'unchanged'
  key: string
  name: string
  fields?: PaymentCatalogFieldDiff[]
  affected_subscriptions?: number
}

export interface PaymentCatalogImportSummary {
  groups_created: number
  groups_updated: number
  groups_unchanged: number
  plans_created: number
  plans_updated: number
  plans_unchanged: number
  routes_created: number
  routes_updated: number
  routes_unchanged: number
  bindings_added: number
  settings_updated: number
}

export interface PaymentCatalogImportPreview {
  preview_token: string
  can_apply: boolean
  summary: PaymentCatalogImportSummary
  changes: PaymentCatalogImportChange[]
  issues: PaymentCatalogImportIssue[]
}

export interface PaymentCatalogImportResult {
  summary: PaymentCatalogImportSummary
  changes?: PaymentCatalogImportChange[]
}

export interface PaymentChannel {
  id: number
  group_id?: number
  name: string
  platform: string
  rate_multiplier: number
  description: string
  models: string[]
  features: string[]
  enabled: boolean
}

// ==================== Providers ====================

export interface ProviderInstance {
  id: number
  provider_key: string
  name: string
  config: Record<string, string>
  supported_types: string[]
  enabled: boolean
  payment_mode: string
  refund_enabled: boolean
  allow_user_refund: boolean
  limits: string
  sort_order: number
}

// ==================== Request / Response ====================

export interface CreateOrderRequest {
  amount: number
  payment_type: string
  order_type: string
  plan_id?: number
  return_url?: string
  payment_source?: string
  openid?: string
  wechat_resume_token?: string
  is_mobile?: boolean
}

export type CreateOrderResultType = 'order_created' | 'oauth_required' | 'jsapi_ready'

export interface WechatOAuthInfo {
  authorize_url?: string
  appid?: string
  openid?: string
  scope?: string
  state?: string
  redirect_url?: string
}

export interface WechatJSAPIPayload {
  appId?: string
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
}

export interface CreateOrderResult {
  order_id: number
  amount: number
  pay_url?: string
  qr_code?: string
  client_secret?: string
  intent_id?: string
  currency?: string
  country_code?: string
  payment_env?: string
  pay_amount: number
  fee_rate: number
  expires_at: string
  result_type?: CreateOrderResultType
  payment_type?: string
  out_trade_no?: string
  payment_mode?: string
  resume_token?: string
  alipay_mobile_precreate_deep_link?: boolean
  oauth?: WechatOAuthInfo
  jsapi?: WechatJSAPIPayload
  jsapi_payload?: WechatJSAPIPayload
}

export type CurrencyAmounts = Record<string, number>

export interface DailyPaymentStats {
  date: string
  amount: CurrencyAmounts
  count: number
}

export interface PaymentMethodStats {
  type: string
  amount: CurrencyAmounts
  count: number
}

export interface TopUserPaymentStats {
  user_id: number
  email: string
  amount: number
}

export interface DashboardStats {
  today_amount: CurrencyAmounts
  total_amount: CurrencyAmounts
  today_count: number
  total_count: number
  avg_amount: CurrencyAmounts
  daily_series: DailyPaymentStats[]
  payment_methods: PaymentMethodStats[]
  top_users: Record<string, TopUserPaymentStats[]>
}
