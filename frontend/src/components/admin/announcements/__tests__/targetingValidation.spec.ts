import { describe, expect, it } from 'vitest'

import { getAnnouncementTargetingValidationKey } from '../targetingValidation'

describe('announcement targeting validation', () => {
  it('accepts all users and complete custom conditions', () => {
    expect(getAnnouncementTargetingValidationKey({ any_of: [] })).toBe('')
    expect(getAnnouncementTargetingValidationKey({
      any_of: [{
        all_of: [
          { type: 'subscription', operator: 'in', group_ids: [2] },
          { type: 'balance', operator: 'gte', value: 10 },
        ],
      }],
    })).toBe('')
  })

  it('matches backend constraints for empty and malformed conditions', () => {
    expect(getAnnouncementTargetingValidationKey({ any_of: [{ all_of: [] }] }))
      .toBe('admin.announcements.form.addAndCondition')
    expect(getAnnouncementTargetingValidationKey({
      any_of: [{ all_of: [{ type: 'subscription', operator: 'in', group_ids: [] }] }],
    })).toBe('admin.announcements.form.selectPackages')
    expect(getAnnouncementTargetingValidationKey({
      any_of: [{ all_of: [{ type: 'subscription', operator: 'in', group_ids: [0] }] }],
    })).toBe('admin.announcements.form.invalidTargeting')
    expect(getAnnouncementTargetingValidationKey({
      any_of: [{ all_of: [{ type: 'balance', operator: 'in', value: 1 }] }],
    })).toBe('admin.announcements.form.invalidTargeting')
  })
})
