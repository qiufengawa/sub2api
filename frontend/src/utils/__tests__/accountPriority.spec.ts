import { describe, expect, it } from 'vitest'

import { ACCOUNT_PRIORITY_MAX, parseAccountPriority } from '../accountPriority'

describe('parseAccountPriority', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['1000', 1000],
    [String(ACCOUNT_PRIORITY_MAX), ACCOUNT_PRIORITY_MAX],
  ])('accepts canonical integer %s', (raw, expected) => {
    expect(parseAccountPriority(raw)).toBe(expected)
  })

  it.each([
    '',
    '-0',
    '-1',
    '01',
    '1.0',
    '1e3',
    'true',
    String(ACCOUNT_PRIORITY_MAX + 1),
  ])('rejects invalid value %s', (raw) => {
    expect(parseAccountPriority(raw)).toBeNull()
  })
})
