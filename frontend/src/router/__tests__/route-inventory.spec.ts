import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'

import { routes } from '../index'

function flattenRoutes(records: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return records.flatMap((record) => [record, ...flattenRoutes(record.children ?? [])])
}

describe('production route inventory', () => {
  const allRecords = flattenRoutes(routes)
  const previewRecords = allRecords.filter((record) => record.name === 'UiSystemPreview')
  const productionRecords = allRecords.filter((record) => record.name !== 'UiSystemPreview')

  it('keeps the documented production and preview route counts stable', () => {
    expect(productionRecords).toHaveLength(67)
    expect(previewRecords).toHaveLength(import.meta.env.DEV ? 1 : 0)
    expect(productionRecords.filter((record) => record.component)).toHaveLength(63)
    expect(productionRecords.filter((record) => record.redirect)).toHaveLength(5)
  })

  it('keeps route paths, names, and aliases unambiguous', () => {
    const paths = productionRecords.map((record) => record.path)
    const names = productionRecords
      .map((record) => record.name)
      .filter((name): name is NonNullable<RouteRecordRaw['name']> => name != null)
      .map(String)
    const aliases = productionRecords.flatMap((record) => {
      if (!record.alias) return []
      return Array.isArray(record.alias) ? record.alias : [record.alias]
    })

    expect(new Set(paths).size).toBe(paths.length)
    expect(new Set(names).size).toBe(names.length)
    expect(aliases).toEqual(['/auth/oauth/callback', '/docs/batch-image'])
    expect(new Set([...paths, ...aliases]).size).toBe(paths.length + aliases.length)
  })

  it('keeps the UI system preview development-only and public', () => {
    if (!import.meta.env.DEV) {
      expect(previewRecords).toHaveLength(0)
      return
    }

    expect(previewRecords[0]).toMatchObject({
      path: '/ui-system-preview',
      meta: { requiresAuth: false },
    })
  })

  it('keeps privileged admin feature gates attached to current page routes', () => {
    const expectations = [
      { path: '/admin/ui-system', meta: { requiresAuth: true, requiresAdmin: true } },
      { path: '/admin/promo-codes', meta: { requiresAuth: true, requiresAdmin: true } },
      { path: '/admin/risk-control', meta: { requiresAuth: true, requiresAdmin: true, requiresRiskControl: true } },
      { path: '/admin/prompt-audit', meta: { requiresAuth: true, requiresAdmin: true, requiresRiskControl: true } },
      { path: '/admin/orders/dashboard', meta: { requiresAuth: true, requiresAdmin: true, requiresPayment: true } },
      { path: '/admin/orders', meta: { requiresAuth: true, requiresAdmin: true, requiresPayment: true } },
    ]

    for (const expectation of expectations) {
      const route = productionRecords.find((record) => record.path === expectation.path)
      expect(route, expectation.path).toBeDefined()
      expect(route?.meta).toMatchObject(expectation.meta)
    }
  })

  it('keeps every current admin page behind the admin auth boundary', () => {
    const adminPagePaths = [
      '/admin/dashboard',
      '/admin/ui-system',
      '/admin/ops',
      '/admin/audit-logs',
      '/admin/users',
      '/admin/groups',
      '/admin/channels/pricing',
      '/admin/channels/monitor',
      '/admin/subscriptions',
      '/admin/accounts',
      '/admin/plugins',
      '/admin/announcements',
      '/admin/proxies',
      '/admin/redeem',
      '/admin/promo-codes',
      '/admin/settings',
      '/admin/risk-control',
      '/admin/prompt-audit',
      '/admin/usage',
      '/admin/affiliates/invites',
      '/admin/affiliates/rebates',
      '/admin/affiliates/transfers',
      '/admin/orders/dashboard',
      '/admin/orders',
      '/admin/orders/plans',
    ]

    for (const path of adminPagePaths) {
      const route = productionRecords.find((record) => record.path === path)
      expect(route, path).toBeDefined()
      expect(route?.component, `${path} should be a page route`).toBeDefined()
      expect(route?.meta).toMatchObject({ requiresAuth: true, requiresAdmin: true })
    }
  })
})
