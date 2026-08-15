import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import QuotaDimensionRow from '../QuotaDimensionRow.vue'
import QuotaNotifyToggle from '../QuotaNotifyToggle.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const baseProps = {
  dim: 'weekly' as const,
  label: 'Weekly limit',
  limit: 10,
  quotaNotifyGlobalEnabled: true,
  notifyEnabled: false,
  notifyThreshold: null,
  notifyThresholdType: null,
  resetMode: 'rolling' as const,
  resetHour: null,
  resetDay: null,
  resetTimezone: null,
  hintRolling: 'Rolling hint',
  hintFixed: 'Fixed hint',
  hourOptions: [0, 12],
  dayOptions: [{ value: 1, key: 'monday' }],
  timezoneOptions: ['UTC']
}

describe('QuotaDimensionRow', () => {
  it('preserves numeric limit updates and fixed-window defaults', async () => {
    const wrapper = mount(QuotaDimensionRow, {
      props: baseProps,
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('input[type="number"]').setValue('25.5')
    expect(wrapper.emitted('update:limit')?.at(-1)).toEqual([25.5])

    const resetMode = wrapper.findAll('button[role="combobox"]')[0]
    await resetMode.trigger('click')
    const fixed = wrapper.findAll('[role="option"]').find(option =>
      option.text().includes('admin.accounts.quotaResetModeFixed')
    )
    await fixed!.trigger('click')

    expect(wrapper.emitted('update:resetMode')?.at(-1)).toEqual(['fixed'])
    expect(wrapper.emitted('update:resetHour')?.at(-1)).toEqual([0])
    expect(wrapper.emitted('update:resetDay')?.at(-1)).toEqual([1])
    expect(wrapper.emitted('update:resetTimezone')?.at(-1)).toEqual(['UTC'])
  })

  it('emits null when the limit is cleared', async () => {
    const wrapper = mount(QuotaDimensionRow, {
      props: baseProps,
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('input[type="number"]').setValue('')
    expect(wrapper.emitted('update:limit')?.at(-1)).toEqual([null])
  })
})

describe('QuotaNotifyToggle', () => {
  it('keeps nullable enablement and threshold semantics', async () => {
    const wrapper = mount(QuotaNotifyToggle, {
      props: {
        enabled: true,
        threshold: 50,
        thresholdType: 'percentage'
      },
      global: { stubs: { teleport: true } }
    })

    expect(wrapper.get('input[type="number"]').attributes('max')).toBe('100')
    await wrapper.get('input[type="number"]').setValue('0')
    expect(wrapper.emitted('update:threshold')?.at(-1)).toEqual([null])

    await wrapper.get('button[role="switch"]').trigger('click')
    expect(wrapper.emitted('update:enabled')?.at(-1)).toEqual([false])
  })
})
