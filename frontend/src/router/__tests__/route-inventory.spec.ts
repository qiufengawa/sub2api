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
    expect(productionRecords).toHaveLength(66)
    expect(previewRecords).toHaveLength(import.meta.env.DEV ? 1 : 0)
    expect(productionRecords.filter((record) => record.component)).toHaveLength(62)
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
})
