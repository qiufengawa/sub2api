import { describe, expect, it } from 'vitest'

import en from '../locales/en/admin/accounts'
import zh from '../locales/zh/admin/accounts'

const sourceModules = import.meta.glob('../../**/*.{ts,vue}', {
  eager: true,
  import: 'default',
  query: '?raw'
}) as Record<string, string>

const literalKeyPattern =
  /(?:\b(?:i18n\.global\.)?t|\$t)\(\s*['"]admin\.accounts\.([A-Za-z0-9_.-]+)['"]/g

function collectUsedKeys(): string[] {
  const keys = new Set<string>()
  for (const source of Object.values(sourceModules)) {
    if (typeof source !== 'string') continue
    for (const match of source.matchAll(literalKeyPattern)) {
      if (!match[1].endsWith('.')) keys.add(match[1])
    }
  }
  return [...keys].sort()
}

function hasPath(root: unknown, path: string): boolean {
  let node = root
  for (const segment of path.split('.')) {
    if (!node || typeof node !== 'object' || !(segment in node)) return false
    node = (node as Record<string, unknown>)[segment]
  }
  return typeof node === 'string'
}

describe('admin account locale keys', () => {
  it.each([
    ['zh', zh.accounts],
    ['en', en.accounts]
  ] as const)('%s defines every literal admin.accounts translation key', (_locale, messages) => {
    const missing = collectUsedKeys().filter((key) => !hasPath(messages, key))
    expect(missing).toEqual([])
  })
})
