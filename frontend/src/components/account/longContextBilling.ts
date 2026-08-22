import type { AdminGroup } from '@/types'

/**
 * The account-level OpenAI long-context switch is only needed when at least
 * one selected group leaves the group ladder disabled. When every selected
 * group enables its official/channel ladder, the group policy already turns
 * the feature on and the per-account control is intentionally hidden.
 */
export function allSelectedGroupsEnableLongContextPricing(
  groupIds: number[],
  groups: AdminGroup[]
): boolean {
  if (groupIds.length === 0) return false
  const selectedGroups = groups.filter(group => groupIds.includes(group.id))
  return selectedGroups.length === groupIds.length &&
    selectedGroups.every(group => group.long_context_pricing_enabled === true)
}
