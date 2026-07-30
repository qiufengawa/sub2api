import { describe, expect, it } from 'vitest'

import { calculateCacheTokenReuseRate } from '../usageMetrics'

describe('calculateCacheTokenReuseRate', () => {
  it('uses aggregate prompt-side tokens and excludes output tokens', () => {
    expect(calculateCacheTokenReuseRate(200, 300, 500)).toBe(50)
  })

  it('returns zero for an empty denominator', () => {
    expect(calculateCacheTokenReuseRate(0, 0, 0)).toBe(0)
  })

  it('normalizes negative and non-finite inputs', () => {
    expect(calculateCacheTokenReuseRate(-100, Number.NaN, 50)).toBe(100)
    expect(calculateCacheTokenReuseRate(Number.POSITIVE_INFINITY, 20, 20)).toBe(50)
  })
})
