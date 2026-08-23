/**
 * Mask a username/email for ranking and aggregate views.
 *
 * Ranking endpoints already return masked values; the idempotence check keeps
 * the UI safe when it receives a cached response from an older server while
 * avoiding a second layer of masking on current responses.
 */
export function maskUserIdentity(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  if (text.includes('***')) return text

  const runes = Array.from(text)
  if (runes.length === 1) return '***'
  if (runes.length === 2) return `${runes[0]}***`
  return `${runes[0]}***${runes[runes.length - 1]}`
}

