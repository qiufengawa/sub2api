import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'

import type { ApiKey, Group } from '@/types'
import KeysView from '../KeysView.vue'

const {
  listKeys,
  getPublicSettings,
  getDashboardApiKeysUsage,
  getAvailableGroups,
  getUserGroupRates,
  createKey,
  updateKey,
  showError,
  showSuccess,
  routerReplace,
  routeState,
  copyToClipboard,
  isCurrentStep,
  nextStep,
} = vi.hoisted(() => ({
  listKeys: vi.fn(),
  getPublicSettings: vi.fn(),
  getDashboardApiKeysUsage: vi.fn(),
  getAvailableGroups: vi.fn(),
  getUserGroupRates: vi.fn(),
  createKey: vi.fn(),
  updateKey: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  routerReplace: vi.fn(),
  routeState: { query: {} as Record<string, string | string[] | undefined> },
  copyToClipboard: vi.fn(),
  isCurrentStep: vi.fn(),
  nextStep: vi.fn(),
}))

const messages: Record<string, string> = {
  'common.actions': 'Actions',
  'common.name': 'Name',
  'common.refresh': 'Refresh',
  'common.status': 'Status',
  'keys.apiKey': 'API Key',
  'keys.allGroups': 'All Groups',
  'keys.allStatus': 'All Status',
  'keys.columnSettings': 'Column Settings',
  'keys.createKey': 'Create API Key',
  'keys.created': 'Created',
  'keys.expiresAt': 'Expires',
  'keys.group': 'Group',
  'keys.id': 'ID',
  'keys.currentConcurrency': 'Current Concurrency',
  'keys.lastUsedAt': 'Last Used',
  'keys.lastUsedIP': 'Last Used IP',
  'keys.rateLimitColumn': 'Rate Limit',
  'keys.searchPlaceholder': 'Search name or key...',
  'keys.subscriptionIntent.alreadyBound': 'Bound',
  'keys.subscriptionIntent.bindAction': 'Bind',
  'keys.subscriptionIntent.bindDescription': 'Choose a key to bind',
  'keys.subscriptionIntent.bindFailed': 'Binding failed',
  'keys.subscriptionIntent.bindSuccess': 'Binding succeeded',
  'keys.subscriptionIntent.bindTitle': 'Bind an existing key',
  'keys.subscriptionIntent.confirmAction': 'Confirm binding',
  'keys.subscriptionIntent.confirmMessage': 'Confirm this key group change',
  'keys.subscriptionIntent.confirmTitle': 'Confirm key group change',
  'keys.subscriptionIntent.createDescription': 'Subscription group preselected',
  'keys.subscriptionIntent.createKey': 'Create subscription key',
  'keys.subscriptionIntent.createTitle': 'Create subscription key',
  'keys.subscriptionIntent.groupsLoadFailed': 'Groups failed to load',
  'keys.subscriptionIntent.invalid': 'Invalid subscription key request',
  'keys.subscriptionIntent.noKeys': 'No keys available',
  'keys.subscriptionIntent.noKeysDescription': 'Create a key instead',
  'keys.subscriptionIntent.unavailable': 'Subscription group unavailable',
  'keys.status.active': 'Active',
  'keys.status.expired': 'Expired',
  'keys.status.inactive': 'Inactive',
  'keys.status.quota_exhausted': 'Quota exhausted',
  'keys.usage': 'Usage',
}

vi.mock('@/api', () => ({
  keysAPI: {
    list: listKeys,
    create: createKey,
    update: updateKey,
    delete: vi.fn(),
    toggleStatus: vi.fn(),
  },
  authAPI: {
    getPublicSettings,
  },
  usageAPI: {
    getDashboardApiKeysUsage,
  },
  userGroupsAPI: {
    getAvailable: getAvailableGroups,
    getUserGroupRates,
  },
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({ replace: routerReplace }),
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showSuccess,
  }),
}))

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    isCurrentStep,
    nextStep,
  }),
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard,
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => messages[key] ?? key,
    }),
  }
})

const createApiKey = (): ApiKey => ({
  id: 1,
  user_id: 1,
  key: 'sk-test-key',
  name: 'test-key',
  group_id: null,
  status: 'active',
  ip_whitelist: [],
  ip_blacklist: [],
  last_used_at: null,
  last_used_ip: null,
  quota: 0,
  quota_used: 0,
  expires_at: null,
  created_at: '2026-06-27T00:00:00Z',
  updated_at: '2026-06-27T00:00:00Z',
  current_concurrency: 3,
  rate_limit_5h: 0,
  rate_limit_1d: 0,
  rate_limit_7d: 0,
  usage_5h: 0,
  usage_1d: 0,
  usage_7d: 0,
  window_5h_start: null,
  window_1d_start: null,
  window_7d_start: null,
  reset_5h_at: null,
  reset_1d_at: null,
  reset_7d_at: null,
})

const createCoveredGroup = (): Group => ({
  id: 11,
  name: 'OpenAI Route',
  description: 'Route covered by the subscription plan',
  platform: 'openai',
  rate_multiplier: 1,
  is_exclusive: true,
  status: 'active',
  subscription_type: 'standard',
} as Group)

const AppLayoutStub = {
  template: '<div><slot /></div>',
}

const DataTableStub = {
  name: 'UiDataTable',
  props: ['columns', 'data'],
  emits: ['sort'],
  template: `
    <div>
      <div data-test="columns">{{ columns.map((col) => col.key).join(',') }}</div>
      <div data-test="columns-meta">{{ JSON.stringify(columns.map((col) => ({ key: col.key, sortable: !!col.sortable }))) }}</div>
      <button data-test="sort-current-concurrency" @click="$emit('sort', 'current_concurrency', 'asc')">
        Sort Current Concurrency
      </button>
      <div v-for="row in data" :key="row.id">
        <div
          v-if="columns.some((col) => col.key === 'id')"
          data-test="key-id"
        >
          <slot name="cell-id" :value="row.id" :row="row" />
        </div>
        <slot name="cell-name" :value="row.name" :row="row" />
        <div data-test="current-concurrency">
          <slot name="cell-current_concurrency" :value="row.current_concurrency" :row="row" />
        </div>
        <div data-test="key-actions">
          <slot name="cell-actions" :row="row" />
        </div>
        <div
          v-if="columns.some((col) => col.key === 'last_used_ip')"
          data-test="last-used-ip"
        >
          <slot name="cell-last_used_ip" :value="row.last_used_ip" :row="row" />
        </div>
      </div>
      <slot v-if="data.length === 0" name="empty" />
    </div>
  `,
}

const SelectStub = {
  name: 'UiSelect',
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"></select>',
}

const SearchInputStub = {
  name: 'UiSearchInput',
  props: ['modelValue'],
  emits: ['update:modelValue', 'search'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const ColumnPickerStub = {
  name: 'UiColumnPicker',
  props: ['modelValue', 'columns', 'label'],
  emits: ['update:modelValue'],
  template: '<div data-test="column-picker" />',
}

const IconStub = {
  props: ['name'],
  template: '<span data-test="icon">{{ name }}</span>',
}

const UiDialogStub = {
  name: 'UiDialog',
  props: ['show', 'title'],
  emits: ['close'],
  template: `
    <section v-if="show" data-test="ui-dialog">
      <h2>{{ title }}</h2>
      <slot />
      <slot name="footer" />
    </section>
  `,
}

const UiConfirmDialogStub = {
  name: 'UiConfirmDialog',
  props: ['show', 'title', 'message', 'confirmText', 'cancelText', 'pending'],
  emits: ['confirm', 'cancel'],
  template: `
    <section v-if="show" data-test="ui-confirm-dialog">
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <button data-test="ui-confirm-dialog-confirm" :disabled="pending" @click="$emit('confirm')">{{ confirmText }}</button>
      <button data-test="ui-confirm-dialog-cancel" :disabled="pending" @click="$emit('cancel')">{{ cancelText }}</button>
    </section>
  `,
}

const mountView = async () => {
  const wrapper = mount(KeysView, {
    global: {
      stubs: {
        AppLayout: AppLayoutStub,
        UiDataTable: DataTableStub,
        UiDialog: UiDialogStub,
        UiConfirmDialog: UiConfirmDialogStub,
        UiColumnPicker: ColumnPickerStub,
        EmptyState: true,
        UiSelect: SelectStub,
        UiSearchInput: SearchInputStub,
        Icon: IconStub,
        UseKeyModal: true,
        EndpointPopover: true,
        GroupBadge: true,
        GroupOptionItem: true,
        Teleport: true,
      },
    },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

const visibleColumnKeys = (wrapper: VueWrapper) =>
  wrapper.get('[data-test="columns"]').text().split(',').filter(Boolean)

const visibleColumnMeta = (wrapper: VueWrapper): Array<{ key: string; sortable: boolean }> =>
  JSON.parse(wrapper.get('[data-test="columns-meta"]').text())

const setFormGroup = async (wrapper: VueWrapper, groupId: number) => {
  const groupSelect = wrapper.findAllComponents({ name: 'UiSelect' }).find(
    (select) => select.attributes('data-tour') === 'key-form-group'
  )
  expect(groupSelect).toBeDefined()
  await groupSelect!.vm.$emit('update:modelValue', groupId)
}

describe('user KeysView column settings', () => {
  beforeEach(() => {
    localStorage.clear()

    listKeys.mockReset()
    getPublicSettings.mockReset()
    getDashboardApiKeysUsage.mockReset()
    getAvailableGroups.mockReset()
    getUserGroupRates.mockReset()
    createKey.mockReset()
    updateKey.mockReset()
    showError.mockReset()
    showSuccess.mockReset()
    routerReplace.mockReset()
    routeState.query = {}
    copyToClipboard.mockReset()
    isCurrentStep.mockReset()
    nextStep.mockReset()

    listKeys.mockResolvedValue({
      items: [createApiKey()],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    getPublicSettings.mockResolvedValue({})
    getDashboardApiKeysUsage.mockResolvedValue({ stats: {} })
    getAvailableGroups.mockResolvedValue([])
    getUserGroupRates.mockResolvedValue({})
    createKey.mockResolvedValue(createApiKey())
    updateKey.mockResolvedValue(createApiKey())
    routerReplace.mockResolvedValue(undefined)
    isCurrentStep.mockReturnValue(false)
  })

  it('uses the default API key columns with low-frequency columns hidden', async () => {
    const wrapper = await mountView()

    expect(visibleColumnKeys(wrapper)).toEqual([
      'name',
      'key',
      'group',
      'current_concurrency',
      'usage',
      'expires_at',
      'status',
      'created_at',
      'actions',
    ])
    expect(visibleColumnKeys(wrapper)).not.toContain('rate_limit')
    expect(visibleColumnKeys(wrapper)).not.toContain('last_used_at')
    expect(visibleColumnKeys(wrapper)).not.toContain('last_used_ip')
    expect(visibleColumnKeys(wrapper)).not.toContain('id')
  })

  it('shows a hidden column when toggled and persists the preference', async () => {
    const wrapper = await mountView()

    const picker = wrapper.getComponent({ name: 'UiColumnPicker' })
    await picker.vm.$emit('update:modelValue', [...picker.props('modelValue'), 'rate_limit'])
    await nextTick()

    expect(visibleColumnKeys(wrapper)).toContain('rate_limit')
    expect(localStorage.getItem('api-key-hidden-columns')).toBe(
      JSON.stringify(['id', 'last_used_at', 'last_used_ip'])
    )
    expect(localStorage.getItem('api-key-column-settings-version')).toBe('3')
  })

  it('shows the API key ID column when toggled', async () => {
    const wrapper = await mountView()

    const picker = wrapper.getComponent({ name: 'UiColumnPicker' })
    await picker.vm.$emit('update:modelValue', [...picker.props('modelValue'), 'id'])
    await nextTick()

    expect(visibleColumnKeys(wrapper)).toContain('id')
    expect(wrapper.get('[data-test="key-id"]').text()).toBe('#1')
    expect(visibleColumnMeta(wrapper).find((column) => column.key === 'id')?.sortable).toBe(true)
  })

  it('shows the last used IP column when toggled', async () => {
    listKeys.mockResolvedValueOnce({
      items: [{ ...createApiKey(), last_used_ip: '203.0.113.10' }],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    const wrapper = await mountView()

    const picker = wrapper.getComponent({ name: 'UiColumnPicker' })
    await picker.vm.$emit('update:modelValue', [...picker.props('modelValue'), 'last_used_ip'])
    await nextTick()

    expect(visibleColumnKeys(wrapper)).toContain('last_used_ip')
    expect(wrapper.get('[data-test="last-used-ip"]').text()).toBe('203.0.113.10')
  })

  it('restores column preferences from localStorage on mount', async () => {
    localStorage.setItem('api-key-hidden-columns', JSON.stringify(['group', 'created_at']))
    localStorage.setItem('api-key-column-settings-version', '1')

    const wrapper = await mountView()

    expect(visibleColumnKeys(wrapper)).toEqual([
      'name',
      'key',
      'current_concurrency',
      'usage',
      'rate_limit',
      'expires_at',
      'status',
      'last_used_at',
      'actions',
    ])
    expect(localStorage.getItem('api-key-hidden-columns')).toBe(
      JSON.stringify(['group', 'created_at', 'last_used_ip', 'id'])
    )
    expect(localStorage.getItem('api-key-column-settings-version')).toBe('3')
  })

  it('marks always-visible columns as required in the column picker', async () => {
    const wrapper = await mountView()

    const picker = wrapper.getComponent({ name: 'UiColumnPicker' })
    const pickerColumns = picker.props('columns') as Array<{
      key: string
      label: string
      required?: boolean
    }>

    expect(pickerColumns.find((column) => column.key === 'name')?.required).toBe(true)
    expect(pickerColumns.find((column) => column.key === 'actions')?.required).toBe(true)
    expect(pickerColumns.find((column) => column.key === 'id')?.required).toBe(false)
    expect(pickerColumns.find((column) => column.key === 'rate_limit')?.required).toBe(false)
  })

  it('renders the current concurrency value', async () => {
    const wrapper = await mountView()

    expect(wrapper.get('[data-test="current-concurrency"]').text()).toBe('3')
  })

  it('marks current concurrency as sortable', async () => {
    const wrapper = await mountView()

    const currentConcurrencyColumn = visibleColumnMeta(wrapper).find(
      (column) => column.key === 'current_concurrency'
    )
    expect(currentConcurrencyColumn?.sortable).toBe(true)
  })

  it('keeps filters and selected page size when sorting by current concurrency', async () => {
    getAvailableGroups.mockResolvedValue([{ id: 42, name: 'OpenAI' }])
    const wrapper = await mountView()

    listKeys.mockClear()
    await wrapper.get('.ui-pagination__size select').setValue('50')
    await flushPromises()

    expect(listKeys).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('table-page-size')).toBe('50')

    await wrapper.findComponent({ name: 'UiSearchInput' }).vm.$emit('update:modelValue', 'target')
    await wrapper.findComponent({ name: 'UiSearchInput' }).vm.$emit('search')
    await flushPromises()

    const selects = wrapper.findAllComponents({ name: 'UiSelect' })
    await selects[0].vm.$emit('update:modelValue', 42)
    await flushPromises()
    await selects[1].vm.$emit('update:modelValue', 'active')
    await flushPromises()

    listKeys.mockClear()

    await wrapper.get('[data-test="sort-current-concurrency"]').trigger('click')
    await flushPromises()

    expect(listKeys).toHaveBeenLastCalledWith(
      1,
      50,
      {
        search: 'target',
        status: 'active',
        group_id: 42,
        sort_by: 'current_concurrency',
        sort_order: 'asc',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('keeps ordinary key-page visits unchanged', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="subscription-bind-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="subscription-create-context"]').exists()).toBe(false)
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('waits for available groups before opening a preselected subscription key form', async () => {
    const group = createCoveredGroup()
    let resolveGroups!: (groups: Group[]) => void
    getAvailableGroups.mockReturnValue(new Promise<Group[]>((resolve) => {
      resolveGroups = resolve
    }))
    routeState.query = {
      action: 'create',
      group_id: String(group.id),
      source: 'subscription',
      keep: 'filter',
    }

    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="subscription-create-context"]').exists()).toBe(false)

    resolveGroups([group])
    await flushPromises()
    await nextTick()

    expect(wrapper.get('[data-testid="subscription-create-context"]').text()).toContain(
      'Subscription group preselected'
    )
    expect(
      wrapper.findAllComponents({ name: 'UiSelect' }).some((select) => select.props('modelValue') === group.id)
    ).toBe(true)
    expect(routerReplace).toHaveBeenCalledWith({ query: { keep: 'filter' } })

    await wrapper.get('input[data-tour="key-form-name"]').setValue('subscription-key')
    await wrapper.get('#key-form').trigger('submit')
    await flushPromises()

    expect(createKey.mock.calls[0].slice(0, 2)).toEqual(['subscription-key', group.id])
  })

  it('rejects a subscription group that is not currently available', async () => {
    routeState.query = {
      action: 'create',
      group_id: '999',
      source: 'subscription',
    }
    getAvailableGroups.mockResolvedValue([createCoveredGroup()])

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="subscription-create-context"]').exists()).toBe(false)
    expect(showError).toHaveBeenCalledWith('Subscription group unavailable')
    expect(routerReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('rejects malformed subscription key intent parameters', async () => {
    routeState.query = {
      action: 'create',
      group_id: 'not-a-number',
      source: 'subscription',
      keep: 'filter',
    }

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="subscription-create-context"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="subscription-bind-banner"]').exists()).toBe(false)
    expect(showError).toHaveBeenCalledWith('Invalid subscription key request')
    expect(routerReplace).toHaveBeenCalledWith({ query: { keep: 'filter' } })
  })

  it('reports a group loading failure without opening a subscription flow', async () => {
    routeState.query = {
      action: 'bind',
      group_id: '11',
      source: 'subscription',
    }
    getAvailableGroups.mockRejectedValueOnce(new Error('network unavailable'))

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="subscription-bind-banner"]').exists()).toBe(false)
    expect(showError).toHaveBeenCalledWith('Groups failed to load')
    expect(routerReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('binds an existing key only after confirmation and only updates group_id', async () => {
    const group = createCoveredGroup()
    getAvailableGroups.mockResolvedValue([group])
    routeState.query = {
      action: 'bind',
      group_id: String(group.id),
      source: 'subscription',
    }

    const wrapper = await mountView()

    expect(wrapper.get('[data-testid="subscription-bind-banner"]').exists()).toBe(true)
    const bindButton = wrapper.get('[data-testid="bind-key-action"]')
    await bindButton.trigger('click')
    expect(wrapper.get('[data-test="ui-confirm-dialog"]').exists()).toBe(true)

    await wrapper.get('[data-test="ui-confirm-dialog-cancel"]').trigger('click')
    expect(updateKey).not.toHaveBeenCalled()

    await bindButton.trigger('click')
    await wrapper.get('[data-test="ui-confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(updateKey).toHaveBeenCalledWith(1, { group_id: group.id })
    expect(Object.keys(updateKey.mock.calls[0][1])).toEqual(['group_id'])
    expect(showSuccess).toHaveBeenCalledWith('Binding succeeded')
    expect(wrapper.find('[data-testid="subscription-bind-banner"]').exists()).toBe(false)
  })

  it('disables binding when a key already uses the target subscription group', async () => {
    const group = createCoveredGroup()
    listKeys.mockResolvedValueOnce({
      items: [{ ...createApiKey(), group_id: group.id, group }],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    getAvailableGroups.mockResolvedValue([group])
    routeState.query = {
      action: 'bind',
      group_id: String(group.id),
      source: 'subscription',
    }

    const wrapper = await mountView()
    const bindButton = wrapper.get('[data-testid="bind-key-action"]')

    expect(bindButton.attributes()).toHaveProperty('disabled')
    expect(bindButton.text()).toContain('Bound')
  })

  it('keeps the group requirement in the new dialog form', async () => {
    const wrapper = await mountView()

    await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')
    await wrapper.get('#key-form').trigger('submit')

    expect(showError).toHaveBeenCalledWith('keys.groupRequired')
    expect(createKey).not.toHaveBeenCalled()
  })

  it('validates custom keys before sending the create payload', async () => {
    const group = createCoveredGroup()
    getAvailableGroups.mockResolvedValue([group])
    const wrapper = await mountView()

    await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')
    await setFormGroup(wrapper, group.id)
    await wrapper.get('[role="switch"][aria-label="keys.customKeyLabel"]').trigger('click')
    const customKeyInput = wrapper.get('input.ui-text-input--mono')
    await customKeyInput.setValue('too-short')
    await wrapper.get('#key-form').trigger('submit')

    expect(showError).toHaveBeenCalledWith('keys.customKeyTooShort')
    expect(createKey).not.toHaveBeenCalled()
  })

  it('converts quota, rate limits, and IP lists without changing the create contract', async () => {
    const group = createCoveredGroup()
    getAvailableGroups.mockResolvedValue([group])
    const wrapper = await mountView()

    await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')
    await wrapper.get('input[data-tour="key-form-name"]').setValue('contract-key')
    await setFormGroup(wrapper, group.id)

    await wrapper.get('[role="switch"][aria-label="keys.ipRestriction"]').trigger('click')
    const textareas = wrapper.findAll('textarea')
    await textareas[0].setValue(' 203.0.113.10\n\n198.51.100.7 ')
    await textareas[1].setValue('192.0.2.4')

    const quotaField = wrapper.findAllComponents({ name: 'UiTextField' }).find(
      (field) => field.props('description') === 'keys.quotaAmountHint'
    )
    expect(quotaField).toBeDefined()
    await quotaField!.vm.$emit('update:modelValue', '12.5')

    await wrapper.get('[role="switch"][aria-label="keys.rateLimitSection"]').trigger('click')
    const rateField = wrapper.findAllComponents({ name: 'UiTextField' }).find(
      (field) => field.props('label') === 'keys.rateLimit5h'
    )
    expect(rateField).toBeDefined()
    await rateField!.vm.$emit('update:modelValue', '3.25')

    await wrapper.get('#key-form').trigger('submit')
    await flushPromises()

    expect(createKey).toHaveBeenCalledWith(
      'contract-key',
      group.id,
      undefined,
      ['203.0.113.10', '198.51.100.7'],
      ['192.0.2.4'],
      12.5,
      undefined,
      { rate_limit_5h: 3.25, rate_limit_1d: 0, rate_limit_7d: 0 }
    )
  })

  it('converts a custom expiration date to a positive create duration', async () => {
    const group = createCoveredGroup()
    getAvailableGroups.mockResolvedValue([group])
    const wrapper = await mountView()

    await wrapper.get('[data-tour="keys-create-btn"]').trigger('click')
    await wrapper.get('input[data-tour="key-form-name"]').setValue('expiring-key')
    await setFormGroup(wrapper, group.id)
    await wrapper.get('[role="switch"][aria-label="keys.expiration"]').trigger('click')

    const target = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const pad = (value: number) => String(value).padStart(2, '0')
    const localDate = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`
    await wrapper.get('input[type="datetime-local"]').setValue(localDate)
    await wrapper.get('#key-form').trigger('submit')
    await flushPromises()

    const expiresInDays = createKey.mock.calls[0]?.[6]
    expect(expiresInDays).toBeGreaterThanOrEqual(2)
    expect(expiresInDays).toBeLessThanOrEqual(4)
  })
})
