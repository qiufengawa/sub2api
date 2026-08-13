/**
 * Account priority is an ordinal integer. There is no product-level ceiling;
 * this value only mirrors PostgreSQL's signed INTEGER storage boundary.
 */
export const ACCOUNT_PRIORITY_MAX = 2_147_483_647

const ACCOUNT_PRIORITY_PATTERN = /^(0|[1-9][0-9]*)$/

export function parseAccountPriority(raw: string): number | null {
  const value = raw.trim()
  if (!ACCOUNT_PRIORITY_PATTERN.test(value)) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > ACCOUNT_PRIORITY_MAX) {
    return null
  }
  return parsed
}
