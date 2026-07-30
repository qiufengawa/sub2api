const toNonNegativeFinite = (value: unknown): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

/**
 * Token-weighted cache reuse across mutually exclusive prompt-token buckets.
 * The backend normalizes provider totals before aggregation, so output tokens
 * and cached tokens already counted as regular input must not enter twice.
 */
export const calculateCacheTokenReuseRate = (
  inputTokens: unknown,
  cacheCreationTokens: unknown,
  cacheReadTokens: unknown
): number => {
  const input = toNonNegativeFinite(inputTokens)
  const cacheCreation = toNonNegativeFinite(cacheCreationTokens)
  const cacheRead = toNonNegativeFinite(cacheReadTokens)
  const totalPromptTokens = input + cacheCreation + cacheRead

  if (totalPromptTokens === 0) return 0

  return Math.min(100, Math.max(0, (cacheRead / totalPromptTokens) * 100))
}
