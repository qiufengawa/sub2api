export const CATEGORICAL_COLORS = [
  '#366ef4',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#a855f7',
] as const

export const OTHER_CATEGORY_COLOR = '#94a3b8'

const normalizeCategoryKey = (value: unknown): string =>
  String(value ?? '').trim().toLocaleLowerCase()

export const stableCategoryIndex = (value: unknown): number => {
  const key = normalizeCategoryKey(value)
  let hash = 2166136261

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) % CATEGORICAL_COLORS.length
}

export const getStableCategoryColor = (value: unknown, isOther = false): string =>
  isOther ? OTHER_CATEGORY_COLOR : CATEGORICAL_COLORS[stableCategoryIndex(value)]

