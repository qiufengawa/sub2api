/**
 * Shared utility functions for payment order display.
 * Used by AdminOrderDetail, AdminOrderTable, AdminRefundDialog, AdminOrdersView, etc.
 */

export type OrderStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const STATUS_BADGE_MAP: Record<string, OrderStatusTone> = {
  PENDING: 'warning',
  PAID: 'info',
  RECHARGING: 'info',
  COMPLETED: 'success',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  FAILED: 'danger',
  REFUND_REQUESTED: 'warning',
  REFUNDING: 'warning',
  REFUND_PENDING: 'warning',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'info',
  REFUND_FAILED: 'danger',
}

const REFUNDABLE_STATUSES = ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUND_REQUESTED', 'REFUND_FAILED']

export function statusBadgeTone(status: string): OrderStatusTone {
  return STATUS_BADGE_MAP[status] || 'neutral'
}

export function canRefund(status: string): boolean {
  return REFUNDABLE_STATUSES.includes(status)
}

export function formatOrderDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}
