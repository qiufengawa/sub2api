import { describe, expect, it } from 'vitest'

const expectedComponents = [
  'AppGrid', 'AppInline', 'AppPage', 'AppPageHeader', 'AppSection', 'AppSplitPane',
  'AppStack', 'AppToolbar', 'UiAccordion', 'UiAlert', 'UiAnnouncementDialog', 'UiBadge',
  'UiBreadcrumb', 'UiButton', 'UiButtonGroup', 'UiCheckbox', 'UiCodeBlock', 'UiColumnPicker',
  'UiCombobox', 'UiCommandMenu', 'UiConfirmDialog', 'UiConnectionStatus', 'UiContextMenu',
  'UiCopyButton', 'UiDataCell', 'UiDataTable', 'UiDateInput', 'UiDateRangePicker',
  'UiDescriptionList', 'UiDialog', 'UiDrawer', 'UiDropdownMenu', 'UiEmptyState',
  'UiErrorDetailDialog', 'UiErrorState', 'UiFieldError', 'UiFieldHelp', 'UiFileUpload',
  'UiFilterBar', 'UiFormField', 'UiFullscreenPanel', 'UiIconButton', 'UiImagePreview',
  'UiLink', 'UiLoadingOverlay', 'UiMetricTrend', 'UiMobileTableScroller', 'UiNavItem',
  'UiNumberStepper', 'UiPagination', 'UiPasswordField', 'UiPopover', 'UiProgressBar',
  'UiProgressRing', 'UiRadioGroup', 'UiSearchInput', 'UiSegmentedControl', 'UiSelect',
  'UiSheet', 'UiSkeleton', 'UiSortableHeader', 'UiSpinner', 'UiStatMetric', 'UiStatusBadge',
  'UiSwitch', 'UiTableToolbar', 'UiTabs', 'UiTextArea', 'UiTextField', 'UiTimeline',
  'UiToast', 'UiTooltip',
  'UiAvatar', 'UiAvatarGroup', 'UiSlider', 'UiTagInput', 'UiTimeInput',
  'UiColorSwatch', 'UiKbd', 'UiDivider', 'UiSteps', 'UiPageNav',
  'UiSideNavGroup', 'UiBackToTop', 'UiBanner', 'UiSnackbar',
  'UiNotificationDot', 'UiPulseIndicator', 'UiKeyValue', 'UiList', 'UiTree',
  'UiChartLegend', 'UiSparkline', 'UiQuotaSummary', 'UiLogLine', 'UiScoreBar',
  'UiMultiCombobox', 'UiAsyncEntityPicker', 'UiDateTimeRangePicker', 'UiSecretField',
  'UiKeyValueEditor', 'UiStructuredEditor', 'UiServerTableWorkspace', 'UiBulkActionBar',
  'UiExportJob', 'UiSaveBar', 'UiChangeSet', 'UiFilterChips', 'UiChartFrame',
  'UiThresholdMetric', 'UiLiveMetric', 'UiInlineEdit', 'UiTransferList', 'UiReviewSummary'
] as const

describe('Qiu UI component inventory', () => {
  it('ships exactly the 114 documented component contracts', () => {
    const modules = import.meta.glob('../*.vue', { eager: true })
    const names = Object.keys(modules).map(path => path.split('/').pop()?.replace('.vue', '')).sort()
    expect(names).toEqual([...expectedComponents].sort())
    expect(names).toHaveLength(114)
  })

  it('exports every component from the public UI entry', async () => {
    const exports = await import('../index')
    for (const name of expectedComponents) expect(exports).toHaveProperty(name)
  })
})
