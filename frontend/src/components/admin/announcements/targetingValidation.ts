import type { AnnouncementTargeting } from '@/types'

export type AnnouncementTargetingValidationKey =
  | 'admin.announcements.form.addAndCondition'
  | 'admin.announcements.form.invalidTargeting'
  | 'admin.announcements.form.selectPackages'
  | ''

const balanceOperators = new Set(['gt', 'gte', 'lt', 'lte', 'eq'])

export function getAnnouncementTargetingValidationKey(
  targeting: AnnouncementTargeting | null | undefined,
): AnnouncementTargetingValidationKey {
  const groups = targeting?.any_of ?? []
  if (groups.length === 0) return ''
  if (groups.length > 50) return 'admin.announcements.form.invalidTargeting'

  for (const group of groups) {
    const conditions = group?.all_of ?? []
    if (conditions.length === 0) return 'admin.announcements.form.addAndCondition'
    if (conditions.length > 50) return 'admin.announcements.form.invalidTargeting'

    for (const condition of conditions) {
      if (condition.type === 'subscription') {
        const groupIds = condition.group_ids ?? []
        if (condition.operator !== 'in') return 'admin.announcements.form.invalidTargeting'
        if (groupIds.length === 0) return 'admin.announcements.form.selectPackages'
        if (groupIds.some((id) => !Number.isInteger(id) || id <= 0)) {
          return 'admin.announcements.form.invalidTargeting'
        }
        continue
      }

      if (condition.type === 'balance') {
        if (!balanceOperators.has(condition.operator)) {
          return 'admin.announcements.form.invalidTargeting'
        }
        if (typeof condition.value !== 'number' || !Number.isFinite(condition.value)) {
          return 'admin.announcements.form.invalidTargeting'
        }
        continue
      }

      return 'admin.announcements.form.invalidTargeting'
    }
  }

  return ''
}
