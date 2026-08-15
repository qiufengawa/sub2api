import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UiDateRangePicker from '../UiDateRangePicker.vue'

const messages: Record<string, string> = {
  'dates.today': 'Today',
  'dates.last24Hours': 'Last 24 Hours',
  'dates.yesterday': 'Yesterday',
  'dates.last7Days': 'Last 7 Days',
  'dates.last14Days': 'Last 14 Days',
  'dates.last30Days': 'Last 30 Days',
  'dates.thisMonth': 'This Month',
  'dates.lastMonth': 'Last Month',
  'dates.startDate': 'Start Date',
  'dates.endDate': 'End Date',
  'dates.apply': 'Apply',
  'dates.selectDateRange': 'Select date range'
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => messages[key] ?? key, locale: 'en' })
}))

describe('UiDateRangePicker', () => {
  it('keeps today as a local calendar-day pair', async () => {
    const today = new Date()
    const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const wrapper = mount(UiDateRangePicker, { props: { startDate: value, endDate: value } })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Today')
    await wrapper.get('.date-picker-trigger').trigger('click')
    await wrapper.get('.date-picker-preset').trigger('click')
    await wrapper.get('.date-picker-apply').trigger('click')
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toMatchObject({ startDate: value, endDate: value, preset: 'today' })
  })

  it('does not emit draft changes before Apply and supports Escape', async () => {
    const wrapper = mount(UiDateRangePicker, { props: { startDate: '2026-08-01', endDate: '2026-08-02' } })
    await wrapper.get('.date-picker-trigger').trigger('click')
    const start = wrapper.get('input[type="date"]')
    await start.setValue('2026-08-03')
    expect(wrapper.emitted('update:startDate')).toBeUndefined()
    await wrapper.get('.date-picker-trigger').trigger('keydown', { key: 'Escape' })
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(wrapper.find('.date-picker-dropdown').exists()).toBe(false)
  })
})
