import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import QuotaLimitCard from '../QuotaLimitCard.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const props = {
  totalLimit: 100,
  dailyLimit: 10,
  weeklyLimit: 40,
  dailyResetMode: 'fixed' as const,
  dailyResetHour: 0,
  weeklyResetMode: 'fixed' as const,
  weeklyResetDay: 1,
  weeklyResetHour: 0,
  resetTimezone: 'UTC'
}

describe('QuotaLimitCard', () => {
  it('collapses without clearing quota values', async () => {
    const wrapper = mount(QuotaLimitCard, {
      props,
      global: { stubs: { teleport: true } }
    })

    expect(wrapper.findAllComponents({ name: 'QuotaDimensionRow' })).toHaveLength(3)
    await wrapper.get('button[aria-expanded="true"]').trigger('click')

    expect(wrapper.findAllComponents({ name: 'QuotaDimensionRow' })).toHaveLength(0)
    expect(wrapper.emitted('update:totalLimit')).toBeUndefined()
  })

  it('clears all quota and reset fields when disabled', async () => {
    const wrapper = mount(QuotaLimitCard, {
      props,
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('button[role="switch"]').trigger('click')

    expect(wrapper.emitted('update:totalLimit')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:dailyLimit')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:weeklyLimit')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:dailyResetMode')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:dailyResetHour')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:weeklyResetMode')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:weeklyResetDay')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:weeklyResetHour')?.at(-1)).toEqual([null])
    expect(wrapper.emitted('update:resetTimezone')?.at(-1)).toEqual([null])
  })
})
