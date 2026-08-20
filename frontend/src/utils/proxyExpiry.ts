// 代理有效期展示逻辑(ProxiesView 与 AccountsView 共用)。
// 到期紧迫度固定两档:剩余 ≤3 天红、≤7 天黄(不读 per-proxy expiry_warn_days)。
export const EXPIRY_WARN_DAYS = 7
export const EXPIRY_DANGER_DAYS = 3

// 距今整天数(向上取整)。
export const daysUntil = (iso: string): number =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)

// 倒计时状态色(纯函数,无 i18n 依赖)。
export type ProxyExpiryTone = 'neutral' | 'warning' | 'danger'

export function proxyExpiryTone(expiresAt: string | null, status?: string): ProxyExpiryTone {
  if (status === 'expired') return 'danger'
  const d = expiresAt ? daysUntil(expiresAt) : Infinity
  if (d <= EXPIRY_DANGER_DAYS) return 'danger'
  if (d <= EXPIRY_WARN_DAYS) return 'warning'
  return 'neutral'
}

// 倒计时文案的 i18n key + 参数(返回 key 而非已翻译文本,便于单测且不耦合 i18n)。
export function proxyExpiryLabelKey(
  expiresAt: string | null,
  status?: string,
): { key: string; params?: { days: number } } {
  if (status === 'expired') return { key: 'admin.proxies.expired' }
  const d = expiresAt ? daysUntil(expiresAt) : Infinity
  if (d < 0) return { key: 'admin.proxies.overdueDays', params: { days: Math.abs(d) } }
  if (d <= EXPIRY_WARN_DAYS) return { key: 'admin.proxies.expiringInDays', params: { days: d } }
  return { key: 'admin.proxies.remainingDays', params: { days: d } }
}
