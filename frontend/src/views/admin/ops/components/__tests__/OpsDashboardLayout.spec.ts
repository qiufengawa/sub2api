import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import dashboardSource from '../../OpsDashboard.vue?raw'
import OpsDashboardSkeleton from '../OpsDashboardSkeleton.vue'

describe('OpsDashboard command-center layout contract', () => {
  it('keeps the main monitoring modules in operational reading order', () => {
    const traffic = dashboardSource.indexOf('data-ops-section="traffic"')
    const quality = dashboardSource.indexOf('data-ops-section="quality"')
    const alerts = dashboardSource.indexOf('data-ops-section="alerts"')
    const tokens = dashboardSource.indexOf('data-ops-section="tokens"')
    const logs = dashboardSource.indexOf('data-ops-section="logs"')

    expect(traffic).toBeGreaterThan(-1)
    expect(quality).toBeGreaterThan(traffic)
    expect(alerts).toBeGreaterThan(quality)
    expect(tokens).toBeGreaterThan(alerts)
    expect(logs).toBeGreaterThan(tokens)
    expect(dashboardSource).toContain('xl:col-span-7')
    expect(dashboardSource).toContain('xl:col-span-5')
  })

  it('mirrors alert, token and log structures in skeleton order', () => {
    const wrapper = mount(OpsDashboardSkeleton)
    const sections = wrapper.findAll('[data-testid]').map((node) => node.attributes('data-testid'))

    expect(sections).toEqual([
      'ops-skeleton-alerts',
      'ops-skeleton-tokens',
      'ops-skeleton-logs',
    ])
  })
})
