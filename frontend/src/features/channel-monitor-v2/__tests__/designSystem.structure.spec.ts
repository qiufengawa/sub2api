/**
 * Structure contracts: channel-monitor-v2 + studio shells must use project
 * design-system utility classes rather than isolated flat RGB skins.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')

function read(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8')
}

describe('channel-monitor-v2 design system structure', () => {
  it('user ChannelStatus V1 shell and detail flow use the shared page contracts', () => {
    const view = read('views/user/ChannelStatusV1View.vue')
    const hero = read('components/user/monitor/MonitorHero.vue')
    const grid = read('components/user/monitor/MonitorCardGrid.vue')
    const detail = read('components/user/MonitorDetailDialog.vue')

    expect(view).toContain('<AppPage')
    expect(view).toContain('<AppSection')
    expect(hero).toContain('<AppPageHeader')
    expect(hero).toContain('<UiSegmentedControl')
    expect(hero).toContain('<UiStatusBadge')
    expect(hero).toContain('<UiIconButton')
    expect(grid).toContain('<UiSkeleton')
    expect(grid).toContain('<UiEmptyState')
    expect(detail).toContain('<UiDialog')
    expect(detail).toContain('<UiMobileTableScroller')
    expect(detail).toContain('<UiDataTable')
    expect(detail).toContain('requestSequence')

    for (const source of [view, hero, grid, detail]) {
      expect(source).not.toMatch(/class="[^"]*\b(?:btn|card)\b/)
      expect(source).not.toContain('dark:')
      expect(source).not.toContain('!important')
    }
    expect(detail).not.toContain('components/common/BaseDialog')
  })

  it('user ChannelStatus V2 shell uses the shared page, filter, metric, and table contracts', () => {
    const src = read('views/user/ChannelStatusV2View.vue')
    expect(src).toContain('<AppPageHeader')
    expect(src).toContain('<AppToolbar')
    expect(src).toContain('<UiFilterBar')
    expect(src).toContain('<UiMultiCombobox')
    expect(src).toContain('<UiSegmentedControl')
    expect(src).toContain('<UiStatMetric')
    expect(src).toContain('<UiTabs')
    expect(src).toContain('<UiMobileTableScroller')
    expect(src).toContain('<UiProgressBar')
    expect(src).toContain('clearFilters')
    expect(src).toContain('healthModeOptions')
    expect(src).toContain("'cache'")
    expect(src.indexOf('summaryAria')).toBeLessThan(src.indexOf('MonitorTrendChart'))
    expect(src).not.toMatch(/min-width:\s*980px/)
    expect(src).not.toMatch(/min-w-\[980px\]/)
    expect(src).toContain('max-height: min(56vh, 560px)')
    expect(src).toContain("trendView")
    expect(src).toContain("'platform_group'")
    expect(src).toContain('MonitorTrendChart')
    expect(src).not.toContain('components/common/Select')
    expect(src).not.toContain('FilterMultiSelect')
    expect(src).not.toContain('MetricCell')
    expect(src).not.toMatch(/class="[^"]*\b(?:btn|card)\b/)
    expect(src).not.toContain('dark:')
    expect(src).not.toContain('!important')
  })

  it('RelayPulseMatrix uses the shared chart frame, matrix scroll, and hover tooltips', () => {
    const src = read('features/channel-monitor-v2/RelayPulseMatrix.vue')
    expect(src).toContain('<UiChartFrame')
    expect(src).toContain('<UiBadge')
    expect(src).toContain('<UiButton')
    expect(src).toContain('matrix-scroll')
    expect(src).toContain('max-height: min(42vh, 420px)')
    expect(src).toContain('overflow: auto')
    expect(src).toContain('pulse-tooltip')
    expect(src).not.toMatch(/class="[^"]*\bcard\b/)
    expect(src).not.toContain('rounded-3xl')
    expect(src).not.toContain('dark:')
    expect(src).not.toContain('!important')
    expect(src).not.toContain('modal-overlay')
    expect(src).not.toContain('modal-content')
  })

  it('MonitorTrendChart uses the shared chart contracts without legacy card chrome', () => {
    const src = read('features/channel-monitor-v2/MonitorTrendChart.vue')
    expect(src).toContain('<UiChartFrame')
    expect(src).toContain('<UiChartLegend')
    expect(src).toContain('<UiBadge')
    expect(src).toContain('<UiButton')
    expect(src).toContain('density="dense"')
    expect(src).not.toMatch(/class="[^"]*\bcard\b/)
    expect(src).not.toContain('components/common/EmptyState')
    expect(src).not.toContain('rounded-3xl')
    expect(src).not.toContain('dark:')
    expect(src).not.toContain('!important')
  })

  it('MonitorSettingsPanel uses the shared settings primitives', () => {
    const src = read('features/channel-monitor-v2/MonitorSettingsPanel.vue')
    expect(src).toContain('<AppSection')
    expect(src).toContain('<UiSwitch')
    expect(src).toContain('<UiSegmentedControl')
    expect(src).toContain('<UiMultiCombobox')
    expect(src).not.toContain('class="card')
    expect(src).not.toContain('tab-active')
  })

  it('admin ChannelMonitorView uses the shared page and table workspace', () => {
    const src = read('views/admin/ChannelMonitorView.vue')
    expect(src).toContain('<AppPageHeader')
    expect(src).toContain('<UiTabs')
    expect(src).toContain('<UiServerTableWorkspace')
    expect(src).toContain('<UiDataTable')
    expect(src).toContain('mobile-table')
    expect(src).not.toContain('<UiMobileTableScroller')
    expect(src).toContain('MonitorSettingsPanel')
  })
})
