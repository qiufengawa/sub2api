import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'

import RiskControlView from '../RiskControlView.vue'
import type { ContentModerationConfig, UpdateContentModerationConfig } from '@/api/admin/riskControl'

const {
  getConfig,
  updateConfig,
  getStatus,
  listLogs,
  getGroups,
  getProxies,
  clearFlaggedHashes,
  showError,
  showSuccess,
} = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getStatus: vi.fn(),
  listLogs: vi.fn(),
  getGroups: vi.fn(),
  getProxies: vi.fn(),
  clearFlaggedHashes: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    riskControl: {
      getConfig,
      updateConfig,
      getStatus,
      listLogs,
      testAPIKeys: vi.fn(),
      deleteFlaggedHash: vi.fn(),
      clearFlaggedHashes,
      unbanUser: vi.fn(),
    },
    groups: {
      getAll: getGroups,
    },
    proxies: {
      getAll: getProxies,
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showSuccess,
  }),
}))

vi.mock('@/utils/apiError', () => ({
  extractApiErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) => {
        if (key === 'admin.riskControl.preBlockAPIKeyLoadSummary') {
          return `同步并发 ${params?.active} / 可用 Key ${params?.available}，累计 ${params?.total} 次，worker：${params?.workerActive} / ${params?.workerTotal}`
        }
        return key.replace(/\{(\w+)\}/g, (_, token) => String(params?.[token] ?? `{${token}}`))
      },
    }),
  }
})

const baseConfig = (): ContentModerationConfig => ({
  enabled: true,
  mode: 'pre_block',
  base_url: 'https://api.openai.com',
  model: 'omni-moderation-latest',
  proxy_id: null,
  api_key_configured: false,
  api_key_masked: '',
  api_key_count: 0,
  api_key_masks: [],
  api_key_statuses: [],
  timeout_ms: 3000,
  sample_rate: 100,
  all_groups: true,
  group_ids: [],
  record_non_hits: false,
  worker_count: 4,
  queue_size: 32768,
  block_status: 403,
  block_message: '内容审计命中风险规则，请调整输入后重试',
  email_on_hit: true,
  auto_ban_enabled: true,
  ban_threshold: 10,
  violation_window_hours: 720,
  retry_count: 2,
  hit_retention_days: 180,
  non_hit_retention_days: 3,
  pre_hash_check_enabled: false,
  blocked_keywords: [],
  keyword_blocking_mode: 'keyword_and_api',
  thresholds: {
    harassment: 0.98,
    sexual: 0.65,
  },
  model_filter: {
    type: 'all',
    models: [],
  },
})

const runtimeStatus = () => ({
  enabled: true,
  risk_control_enabled: true,
  mode: 'pre_block',
  worker_count: 4,
  max_workers: 32,
  active_workers: 0,
  idle_workers: 4,
  queue_size: 32768,
  queue_length: 0,
  queue_usage_percent: 0,
  enqueued: 0,
  dropped: 0,
  processed: 0,
  errors: 0,
  pre_block_active: 0,
  pre_block_checked: 0,
  pre_block_allowed: 0,
  pre_block_blocked: 0,
  pre_block_errors: 0,
  pre_block_avg_latency_ms: 0,
  pre_block_api_key_active: 0,
  pre_block_api_key_available_count: 0,
  pre_block_api_key_total_calls: 0,
  pre_block_api_key_loads: [],
  api_key_statuses: [],
  flagged_hash_count: 0,
  last_cleanup_deleted_hit: 0,
  last_cleanup_deleted_non_hit: 0,
})

const AppLayoutStub = { template: '<div><slot /></div>' }
const BaseDialogStub = defineComponent({
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
})
const ModelWhitelistSelectorStub = defineComponent({
  props: {
    modelValue: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const onInput = (event: Event) => {
      const value = (event.target as HTMLInputElement).value
      emit(
        'update:modelValue',
        value
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    }
    return () =>
      h('input', {
        'data-test': 'model-filter-input',
        value: (props.modelValue as string[]).join('\n'),
        onInput,
      })
  },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function findButtonByText(wrapper: VueWrapper, text: string): DOMWrapper<HTMLButtonElement> {
  const button = wrapper.findAll<HTMLButtonElement>('button').find((item) => item.text().includes(text))
  if (!button) {
    throw new Error(`button not found: ${text}`)
  }
  return button
}

describe('admin RiskControlView', () => {
  beforeEach(() => {
    getConfig.mockReset()
    updateConfig.mockReset()
    getStatus.mockReset()
    listLogs.mockReset()
    getGroups.mockReset()
    getProxies.mockReset()
    clearFlaggedHashes.mockReset()
    showError.mockReset()
    showSuccess.mockReset()

    getConfig.mockResolvedValue(baseConfig())
    getStatus.mockResolvedValue(runtimeStatus())
    listLogs.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, pages: 1 })
    getGroups.mockResolvedValue([])
    getProxies.mockResolvedValue([])
    clearFlaggedHashes.mockResolvedValue({ deleted: 3 })
    updateConfig.mockImplementation(async (payload: UpdateContentModerationConfig) => ({
      ...baseConfig(),
      ...payload,
      model_filter: payload.model_filter ?? baseConfig().model_filter,
      api_key_configured: false,
      api_key_masked: '',
      api_key_count: 0,
      api_key_masks: [],
      api_key_statuses: [],
    }))
  })

  it('renders stable loading skeleton geometry', () => {
    getConfig.mockReturnValue(new Promise(() => {}))

    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          Icon: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    const loading = wrapper.get('.risk-loading')
    const skeletons = wrapper.findAll('.ui-skeleton')
    expect(loading.attributes('role')).toBe('status')
    expect(loading.attributes('aria-busy')).toBe('true')
    expect(loading.attributes('aria-label')).toBe('common.loading')
    expect(skeletons).toHaveLength(7)
    expect(skeletons.map((item) => item.attributes('style'))).toEqual([
      'width: 100%; height: 72px;',
      'width: 100%; height: 88px;',
      'width: 100%; height: 88px;',
      'width: 100%; height: 88px;',
      'width: 100%; height: 88px;',
      'width: 100%; height: 280px;',
      'width: 100%; height: 360px;',
    ])
    expect(loading.get('.risk-loading__metrics').findAll('.ui-skeleton')).toHaveLength(4)
  })

  it('keeps the newest runtime status when refresh responses resolve out of order', async () => {
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })
    await flushPromises()

    const first = deferred<ReturnType<typeof runtimeStatus>>()
    const second = deferred<ReturnType<typeof runtimeStatus>>()
    getStatus.mockReset()
    getStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const vm = wrapper.vm as any
    const staleRequest = vm.loadStatus()
    const newestRequest = vm.loadStatus()

    second.resolve({ ...runtimeStatus(), processed: 22 })
    await newestRequest
    first.resolve({ ...runtimeStatus(), processed: 11 })
    await staleRequest

    expect(vm.status.processed).toBe(22)
    expect(vm.statusLoading).toBe(false)
    wrapper.unmount()
  })

  it('completes initial proxy loading when a manual status refresh supersedes it', async () => {
    const initialConfig = deferred<ContentModerationConfig>()
    const initialGroups = deferred<never[]>()
    const initialStatus = deferred<ReturnType<typeof runtimeStatus>>()
    const initialProxies = deferred<any[]>()
    const newestStatus = deferred<ReturnType<typeof runtimeStatus>>()
    getConfig.mockReturnValueOnce(initialConfig.promise)
    getGroups.mockReturnValueOnce(initialGroups.promise)
    getStatus.mockReset().mockReturnValueOnce(initialStatus.promise).mockReturnValueOnce(newestStatus.promise)
    getProxies.mockReturnValueOnce(initialProxies.promise)

    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })
    const vm = wrapper.vm as any
    const manualStatus = vm.loadStatus()
    newestStatus.resolve({ ...runtimeStatus(), processed: 30 })
    await manualStatus

    initialConfig.resolve(baseConfig())
    initialGroups.resolve([])
    initialStatus.resolve({ ...runtimeStatus(), processed: 20 })
    initialProxies.resolve([{ id: 7, name: 'fixture proxy' }])
    await flushPromises()

    expect(vm.status.processed).toBe(30)
    expect(vm.proxies).toEqual([{ id: 7, name: 'fixture proxy' }])
    wrapper.unmount()
  })

  it('does not let an older loadAll overwrite a newer page load', async () => {
    const firstConfig = deferred<ContentModerationConfig>()
    const firstGroups = deferred<never[]>()
    const firstStatus = deferred<ReturnType<typeof runtimeStatus>>()
    const firstProxies = deferred<any[]>()
    getConfig.mockReset().mockReturnValueOnce(firstConfig.promise)
    getGroups.mockReset().mockReturnValueOnce(firstGroups.promise)
    getStatus.mockReset().mockReturnValueOnce(firstStatus.promise)
    getProxies.mockReset().mockReturnValueOnce(firstProxies.promise)

    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })
    const secondConfig = deferred<ContentModerationConfig>()
    const secondGroups = deferred<never[]>()
    const secondStatus = deferred<ReturnType<typeof runtimeStatus>>()
    const secondProxies = deferred<any[]>()
    getConfig.mockReturnValueOnce(secondConfig.promise)
    getGroups.mockReturnValueOnce(secondGroups.promise)
    getStatus.mockReturnValueOnce(secondStatus.promise)
    getProxies.mockReturnValueOnce(secondProxies.promise)

    const vm = wrapper.vm as any
    const newerLoad = vm.loadAll()
    const newerConfig = { ...baseConfig(), base_url: 'https://newer.example' }
    secondConfig.resolve(newerConfig)
    secondGroups.resolve([{ id: 2, name: 'newer group' }] as never[])
    secondStatus.resolve({ ...runtimeStatus(), processed: 22 })
    secondProxies.resolve([{ id: 2, name: 'newer proxy' }])
    await newerLoad

    firstConfig.resolve({ ...baseConfig(), base_url: 'https://older.example' })
    firstGroups.resolve([{ id: 1, name: 'older group' }] as never[])
    firstStatus.resolve({ ...runtimeStatus(), processed: 11 })
    firstProxies.resolve([{ id: 1, name: 'older proxy' }])
    await flushPromises()

    expect(vm.configForm.base_url).toBe('https://newer.example')
    expect(vm.groups).toEqual([{ id: 2, name: 'newer group' }])
    expect(vm.proxies).toEqual([{ id: 2, name: 'newer proxy' }])
    expect(vm.status.processed).toBe(22)
    wrapper.unmount()
  })

  it('does not surface a stale loadAll rejection after a newer page load starts', async () => {
    const firstConfig = deferred<ContentModerationConfig>()
    const firstGroups = deferred<never[]>()
    const firstStatus = deferred<ReturnType<typeof runtimeStatus>>()
    const firstProxies = deferred<any[]>()
    getConfig.mockReset().mockReturnValueOnce(firstConfig.promise)
    getGroups.mockReset().mockReturnValueOnce(firstGroups.promise)
    getStatus.mockReset().mockReturnValueOnce(firstStatus.promise)
    getProxies.mockReset().mockReturnValueOnce(firstProxies.promise)

    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    // The initial onMounted load is still waiting.  A newer load resolves
    // successfully before the older request rejects.
    getConfig.mockReturnValueOnce(Promise.resolve(baseConfig()))
    getGroups.mockReturnValueOnce(Promise.resolve([]))
    getStatus.mockReturnValueOnce(Promise.resolve(runtimeStatus()))
    getProxies.mockReturnValueOnce(Promise.resolve([]))
    const newerLoad = (wrapper.vm as any).loadAll()
    await newerLoad
    showError.mockClear()

    firstConfig.reject(new Error('stale network failure'))
    firstGroups.resolve([])
    firstStatus.resolve(runtimeStatus())
    firstProxies.resolve([])
    await flushPromises()

    expect(showError).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ignores duplicate risk-control saves while the first request is pending', async () => {
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Select: true,
          Toggle: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })
    await flushPromises()

    const pending = deferred<ContentModerationConfig>()
    updateConfig.mockReset()
    updateConfig.mockReturnValueOnce(pending.promise)
    const vm = wrapper.vm as any
    const firstSave = vm.saveConfig()
    const duplicateSave = vm.saveConfig()
    expect(updateConfig).toHaveBeenCalledTimes(1)
    expect(vm.saving).toBe(true)

    pending.resolve(baseConfig())
    await Promise.all([firstSave, duplicateSave])
    expect(vm.saving).toBe(false)
    wrapper.unmount()
  })

  it('clears every log filter and reloads page one', async () => {
    listLogs.mockImplementation(async (params: { page: number; page_size: number }) => ({
      items: [],
      total: 40,
      page: params.page,
      page_size: params.page_size,
      pages: 2,
    }))

    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()
    wrapper.getComponent({ name: 'UiPagination' }).vm.$emit('update:page', 2)
    await flushPromises()

    const selects = wrapper.findAllComponents({ name: 'UiSelect' })
    selects[0].vm.$emit('update:modelValue', 'hit')
    selects[1].vm.$emit('update:modelValue', 7)
    selects[2].vm.$emit('update:modelValue', '/v1/messages')
    wrapper.getComponent({ name: 'UiSearchInput' }).vm.$emit('update:modelValue', 'needle')
    const dateFields = wrapper.findAllComponents({ name: 'UiTextField' }).filter((item) => item.props('type') === 'datetime-local')
    dateFields[0].vm.$emit('update:modelValue', '2026-08-16T00:00')
    dateFields[1].vm.$emit('update:modelValue', '2026-08-16T23:59')
    await wrapper.vm.$nextTick()

    listLogs.mockClear()
    await findButtonByText(wrapper, 'admin.riskControl.filters.clear').trigger('click')
    await flushPromises()

    expect(listLogs).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 20,
      result: undefined,
      group_id: undefined,
      endpoint: undefined,
      search: undefined,
      from: undefined,
      to: undefined,
    })
    expect(wrapper.findAll('button').some((item) => item.text().includes('admin.riskControl.filters.clear'))).toBe(false)
  })

  it('keeps audit records in a keyboard-scrollable mobile table region', async () => {
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()

    const scroller = wrapper.get('.ui-table-scroller')
    expect(scroller.attributes('role')).toBe('region')
    expect(scroller.attributes('tabindex')).toBe('0')
    expect(scroller.attributes('aria-label')).toBe('admin.riskControl.records')
    expect(scroller.get(':scope > div').attributes('style')).toContain('min-width: 1180px')
    expect(scroller.find('.ui-data-table').exists()).toBe(true)
  })

  it('uses one settings surface with divider-based sections', async () => {
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Select: true,
          Toggle: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
        },
      },
    })

    await flushPromises()
    await findButtonByText(wrapper, 'admin.riskControl.openSettings').trigger('click')

    const apiKeysSection = wrapper.get('[data-test="risk-api-keys-section"]')
    expect(wrapper.findAll('[data-test="risk-settings-surface"]')).toHaveLength(1)
    expect(apiKeysSection.classes()).not.toContain('rounded-xl')
    expect(apiKeysSection.classes()).not.toContain('shadow-sm')

    await findButtonByText(wrapper, 'admin.riskControl.tabs.scope').trigger('click')
    const modelFilterSection = wrapper.get('[data-test="risk-model-filter-section"]')
    expect(modelFilterSection.classes()).toContain('risk-settings__section')
    expect(modelFilterSection.classes()).not.toContain('rounded-lg')

    await findButtonByText(wrapper, 'admin.riskControl.tabs.response').trigger('click')
    const responseOptions = wrapper.findAll('[data-test="risk-response-option"]')
    expect(responseOptions).toHaveLength(3)
    expect(responseOptions.every((option) => !option.classes().includes('rounded-lg'))).toBe(true)
  })

  it('saves the selected model filter mode and models', async () => {
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Select: true,
          Toggle: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()

    await findButtonByText(wrapper, 'admin.riskControl.openSettings').trigger('click')
    await findButtonByText(wrapper, 'admin.riskControl.tabs.scope').trigger('click')
    await wrapper.get('input[name="risk-model-filter"][value="include"]').setValue(true)
    await wrapper.get('[data-test="model-filter-input"]').setValue('gpt-5.5, gpt-5.4')
    await findButtonByText(wrapper, 'admin.riskControl.saveConfig').trigger('click')
    await flushPromises()

    expect(updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      model_filter: {
        type: 'include',
        models: ['gpt-5.5', 'gpt-5.4'],
      },
    }))
    expect(showError).not.toHaveBeenCalled()
  })

  it('keeps API key write mode disabled while stored keys are marked for clearing', async () => {
    getConfig.mockResolvedValue({
      ...baseConfig(),
      api_key_configured: true,
      api_key_count: 1,
      api_key_masks: ['sk-...test'],
    })
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()
    await findButtonByText(wrapper, 'admin.riskControl.openSettings').trigger('click')
    await findButtonByText(wrapper, 'admin.riskControl.clearApiKey').trigger('click')

    const writeModeButtons = wrapper.findAll('[role="radio"]').filter((item) =>
      item.text().includes('admin.riskControl.apiKeysMode')
    )
    expect(writeModeButtons).toHaveLength(2)
    expect(writeModeButtons.every((item) => item.attributes('disabled') !== undefined)).toBe(true)
  })

  it('clears all flagged hashes only after confirmation', async () => {
    getStatus.mockResolvedValue({ ...runtimeStatus(), flagged_hash_count: 3 })
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()
    await findButtonByText(wrapper, 'admin.riskControl.openSettings').trigger('click')
    await findButtonByText(wrapper, 'admin.riskControl.tabs.runtime').trigger('click')
    await findButtonByText(wrapper, 'admin.riskControl.clearFlaggedHashes').trigger('click')
    expect(clearFlaggedHashes).not.toHaveBeenCalled()

    const confirmButtons = wrapper.findAll<HTMLButtonElement>('button').filter((item) =>
      item.text().includes('admin.riskControl.clearFlaggedHashes')
    )
    await confirmButtons.at(-1)!.trigger('click')
    await flushPromises()

    expect(clearFlaggedHashes).toHaveBeenCalledTimes(1)
    expect(showSuccess).toHaveBeenCalledWith('admin.riskControl.flaggedHashesCleared')
  })

  it('closes the clear confirmation after success even when status refresh fails', async () => {
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })
    await flushPromises()

    getStatus.mockRejectedValueOnce(new Error('refresh after clear failed'))
    const vm = wrapper.vm as any
    vm.clearHashesConfirmOpen = true
    await vm.clearFlaggedHashes()
    await flushPromises()

    expect(clearFlaggedHashes).toHaveBeenCalledTimes(1)
    expect(vm.clearHashesConfirmOpen).toBe(false)
    expect(showSuccess).toHaveBeenCalledWith('admin.riskControl.flaggedHashesCleared')
    wrapper.unmount()
  })

  it('submits edited risk control thresholds when saving moderation config', async () => {
    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Select: true,
          Toggle: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()

    await findButtonByText(wrapper, 'admin.riskControl.openSettings').trigger('click')
    await findButtonByText(wrapper, 'admin.riskControl.tabs.riskThresholds').trigger('click')
    await wrapper.get('[data-test="risk-threshold-sexual"]').setValue('72')
    await wrapper.get('[data-test="risk-threshold-harassment"]').setValue('99')
    await findButtonByText(wrapper, 'admin.riskControl.saveConfig').trigger('click')
    await flushPromises()

    expect(updateConfig).toHaveBeenCalledWith(expect.objectContaining({
      thresholds: expect.objectContaining({
        sexual: 0.72,
        harassment: 0.99,
      }),
    }))
    expect(showError).not.toHaveBeenCalled()
  })

  it('describes worker runtime as async audit and pre-block record processing', async () => {
    getStatus.mockResolvedValue({
      ...runtimeStatus(),
      mode: 'observe',
      processed: 12,
      queue_length: 2,
    })

    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Select: true,
          Toggle: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('admin.riskControl.workerStatusHint')
    expect(wrapper.text()).not.toContain('admin.riskControl.preBlockSyncStatus')
    expect(wrapper.text()).toContain('admin.riskControl.records')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('2 / 32,768')
  })

  it('shows pre-block synchronous moderation metrics separately from worker queue', async () => {
    getStatus.mockResolvedValue({
      ...runtimeStatus(),
      pre_block_active: 2,
      pre_block_checked: 128,
      pre_block_allowed: 120,
      pre_block_blocked: 8,
      pre_block_errors: 1,
      pre_block_avg_latency_ms: 86,
      pre_block_api_key_active: 2,
      pre_block_api_key_available_count: 2,
      pre_block_api_key_total_calls: 128,
      active_workers: 3,
      worker_count: 7,
      pre_block_api_key_loads: [
        {
          index: 0,
          key_hash: 'hash-one',
          masked: 'sk-...one',
          status: 'ok',
          active: 1,
          total: 72,
          success: 70,
          errors: 2,
          avg_latency_ms: 84,
          last_latency_ms: 80,
          last_http_status: 200,
        },
        {
          index: 1,
          key_hash: 'hash-two',
          masked: 'sk-...two',
          status: 'ok',
          active: 1,
          total: 56,
          success: 56,
          errors: 0,
          avg_latency_ms: 90,
          last_latency_ms: 92,
          last_http_status: 200,
        },
      ],
    })

    const wrapper = mount(RiskControlView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          UiDialog: BaseDialogStub,
          Icon: true,
          Select: true,
          Toggle: true,
          Pagination: true,
          ModelWhitelistSelector: ModelWhitelistSelectorStub,
          ProxySelector: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('admin.riskControl.preBlockSyncStatus')
    expect(wrapper.text()).toContain('admin.riskControl.preBlockSyncHint')
    expect(wrapper.text()).not.toContain('admin.riskControl.workerStatus')
    expect(wrapper.text()).toContain('admin.riskControl.records')
    expect(wrapper.text()).toContain('128')
    expect(wrapper.text()).toContain('120')
    expect(wrapper.text()).toContain('8')
    expect(wrapper.text()).toContain('86 ms')
    expect(wrapper.text()).toContain('admin.riskControl.preBlockAPIKeyLoad')
    expect(wrapper.text()).toContain('sk-...one')
    expect(wrapper.text()).toContain('sk-...two')
    expect(wrapper.text()).toContain('72')
    expect(wrapper.text()).toContain('56')
    expect(wrapper.text()).toContain('同步并发 2 / 可用 Key 2，累计 128 次，worker：3 / 7')

    const runtimeCards = wrapper.get('[data-test="pre-block-runtime-cards"]')
    const syncCard = wrapper.get('[data-test="pre-block-sync-card"]')
    const apiKeyLoadCard = wrapper.get('[data-test="pre-block-api-key-load-card"]')

    expect(runtimeCards.classes()).toContain('risk-runtime-grid')
    expect(syncCard.element.parentElement).toBe(runtimeCards.element)
    expect(apiKeyLoadCard.element.parentElement).toBe(runtimeCards.element)
    expect(syncCard.element.tagName).toBe('SECTION')
    expect(apiKeyLoadCard.element.tagName).toBe('SECTION')
    expect(syncCard.classes()).toContain('risk-runtime-panel')
    expect(apiKeyLoadCard.classes()).toContain('risk-runtime-panel')
    expect(syncCard.get('h2').text()).toBe('admin.riskControl.preBlockSyncStatus')
    expect(syncCard.text()).toContain('admin.riskControl.preBlockSyncHint')
    expect(apiKeyLoadCard.get('h2').text()).toBe('admin.riskControl.preBlockAPIKeyLoad')
    expect(apiKeyLoadCard.text()).toContain('admin.riskControl.preBlockAPIKeyLoadHint')
    expect(wrapper.get('[data-test="pre-block-api-key-load-list"]').classes()).toContain('risk-key-loads')
  })
})
