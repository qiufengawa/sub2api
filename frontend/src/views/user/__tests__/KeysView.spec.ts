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

const createSubscriptionGroup = (): Group => ({
  id: 11,
  name: 'OpenAI Subscription',
  description: 'Subscription group',
  platform: 'openai',
  rate_multiplier: 1,
  is_exclusive: true,
  status: 'active',
  subscription_type: 'subscription',
} as Group)

const AppLayoutStub = {
  template: '<div><slot /></div>',
}

const TablePageLayoutStub = {
  template: `
    <div>
      <slot name="filters" />
      <slot name="actions" />
      <slot name="table" />
      <slot name="pagination" />
    </div>
  `,
}

const DataTableStub = {
  name: 'DataTable',
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
  name: 'Select',
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"></select>',
}

const SearchInputStub = {
  name: 'SearchInput',
  props: ['modelValue'],
  emits: ['update:modelValue', 'search'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const PaginationStub = {
  name: 'Pagination',
  props: ['page', 'total', 'pageSize'],
  emits: ['update:page', 'update:pageSize'],
  template: `
    <div>
      <button data-test="page-size-50" @click="$emit('update:pageSize', 50)">50</button>
    </div>
  `,
}

const IconStub = {
  props: ['name'],
  template: '<span data-test="icon">{{ name }}</span>',
}

const BaseDialogStub = {
  name: 'BaseDialog',
  props: ['show', 'title'],
  emits: ['close'],
  template: `
    <section v-if="show" data-test="base-dialog">
      <h2>{{ title }}</h2>
      <slot />
      <slot name="footer" />
    </section>
  `,
}

const ConfirmDialogStub = {
  name: 'ConfirmDialog',
  props: ['show', 'title', 'message', 'confirmText', 'cancelText', 'pending'],
  emits: ['confirm', 'cancel'],
  template: `
    <section v-if="show" data-test="confirm-dialog">
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <button data-test="confirm-dialog-confirm" :disabled="pending" @click="$emit('confirm')">{{ confirmText }}</button>
      <button data-test="confirm-dialog-cancel" :disabled="pending" @click="$emit('cancel')">{{ cancelText }}</button>
    </section>
  `,
}

const mountView = async () => {
  const wrapper = mount(KeysView, {
    global: {
      stubs: {
        AppLayout: AppLayoutStub,
        TablePageLayout: TablePageLayoutStub,
        DataTable: DataTableStub,
        Pagination: PaginationStub,
        BaseDialog: BaseDialogStub,
        ConfirmDialog: ConfirmDialogStub,
        EmptyState: true,
        Select: SelectStub,
        SearchInput: SearchInputStub,
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

const getButtonByText = (wrapper: VueWrapper, text: string) => {
  const button = wrapper.findAll('button').find((item) => item.text().includes(text))
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
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

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await getButtonByText(wrapper, 'Rate Limit').trigger('click')
    await nextTick()

    expect(visibleColumnKeys(wrapper)).toContain('rate_limit')
    expect(localStorage.getItem('api-key-hidden-columns')).toBe(
      JSON.stringify(['id', 'last_used_at', 'last_used_ip'])
    )
    expect(localStorage.getItem('api-key-column-settings-version')).toBe('3')
  })

  it('shows the API key ID column when toggled', async () => {
    const wrapper = await mountView()

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await getButtonByText(wrapper, 'ID').trigger('click')
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

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await getButtonByText(wrapper, 'Last Used IP').trigger('click')
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

  it('does not include always-visible columns in the toggleable menu', async () => {
    const wrapper = await mountView()

    await wrapper.get('button[title="Column Settings"]').trigger('click')
    await nextTick()

    const columnMenuText = wrapper.text()
    expect(columnMenuText).toContain('API Key')
    expect(columnMenuText).toContain('ID')
    expect(columnMenuText).toContain('Current Concurrency')
    expect(columnMenuText).toContain('Rate Limit')
    expect(columnMenuText).toContain('Last Used IP')
    expect(columnMenuText).not.toContain('Name')
    expect(columnMenuText).not.toContain('Actions')
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

    await wrapper.get('[data-test="page-size-50"]').trigger('click')
    await flushPromises()

    await wrapper.findComponent({ name: 'SearchInput' }).vm.$emit('update:modelValue', 'target')
    await wrapper.findComponent({ name: 'SearchInput' }).vm.$emit('search')
    await flushPromises()

    const selects = wrapper.findAllComponents({ name: 'Select' })
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
    const group = createSubscriptionGroup()
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
      wrapper.findAllComponents({ name: 'Select' }).some((select) => select.props('modelValue') === group.id)
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
    getAvailableGroups.mockResolvedValue([createSubscriptionGroup()])

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
    const group = createSubscriptionGroup()
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
    expect(wrapper.get('[data-test="confirm-dialog"]').exists()).toBe(true)

    await wrapper.get('[data-test="confirm-dialog-cancel"]').trigger('click')
    expect(updateKey).not.toHaveBeenCalled()

    await bindButton.trigger('click')
    await wrapper.get('[data-test="confirm-dialog-confirm"]').trigger('click')
    await flushPromises()

    expect(updateKey).toHaveBeenCalledWith(1, { group_id: group.id })
    expect(Object.keys(updateKey.mock.calls[0][1])).toEqual(['group_id'])
    expect(showSuccess).toHaveBeenCalledWith('Binding succeeded')
    expect(wrapper.find('[data-testid="subscription-bind-banner"]').exists()).toBe(false)
  })

  it('disables binding when a key already uses the target subscription group', async () => {
    const group = createSubscriptionGroup()
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
})
