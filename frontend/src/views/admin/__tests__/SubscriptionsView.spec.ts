import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SubscriptionsView from '../SubscriptionsView.vue'

const {
  list,
  assign,
  extend,
  revoke,
  restore,
  resetQuota,
  getAllGroups,
  getPlans,
  searchUsers,
  showError,
  showSuccess,
} = vi.hoisted(() => ({
  list: vi.fn(),
  assign: vi.fn(),
  extend: vi.fn(),
  revoke: vi.fn(),
  restore: vi.fn(),
  resetQuota: vi.fn(),
  getAllGroups: vi.fn(),
  getPlans: vi.fn(),
  searchUsers: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    subscriptions: { list, assign, extend, revoke, restore, resetQuota },
    groups: { getAll: getAllGroups },
    payment: { getPlans },
    usage: { searchUsers },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => params
        ? `${key}:${JSON.stringify(params)}`
        : key,
    }),
  }
})

vi.mock('@/utils/format', () => ({
  formatDateTimeToMinute: (value: string) => `date:${value}`,
}))

vi.mock('@/utils/subscriptionQuota', () => ({
  getRemainingExpiryDuration: () => ({ unit: 'days', days: 12 }),
}))

const group = { id: 7, name: 'GPT primary', platform: 'openai', rate_multiplier: 0.2 }
const makeSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  user_id: 42,
  plan_id: 101,
  plan_name: 'Standard',
  status: 'active',
  starts_at: '2026-08-01T00:00:00Z',
  expires_at: '2026-09-01T00:00:00Z',
  daily_usage_usd: 0,
  weekly_usage_usd: 0,
  monthly_usage_usd: 0,
  five_hour_quota_usd: 10,
  five_hour_usage_usd: 7,
  five_hour_reserved_usd: 2,
  cycle_quota_usd: 20,
  cycle_usage_usd: 4,
  cycle_reserved_usd: 0,
  total_quota_usd: 100,
  total_usage_usd: 30,
  total_reserved_usd: 0,
  reset_interval_seconds: 604800,
  cycle_started_at: '2026-08-01T00:00:00Z',
  daily_window_start: null,
  weekly_window_start: null,
  monthly_window_start: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  user: { id: 42, email: 'user@example.com', username: 'scoped-user' },
  included_groups: [group],
  ...overrides,
})

const makePlan = () => ({
  id: 101,
  name: 'Standard',
  description: '',
  price: 10,
  validity_days: 30,
  validity_unit: 'day',
  features: [],
  for_sale: true,
  sort_order: 1,
  max_subscriptions_per_user: 2,
  included_groups: [group],
})

const DataTableStub = {
  props: ['columns', 'data'],
  emits: ['sort'],
  template: `<div data-test="subscription-table">
    <output data-test="columns">{{ columns.map(column => column.key).join(',') }}</output>
    <button data-test="sort-status" @click="$emit('sort', 'status', 'asc')">sort</button>
    <div v-for="row in data" :key="row.id" :data-test="'row-' + row.id">
      <template v-for="column in columns" :key="column.key">
        <slot :name="'cell-' + column.key" :row="row" :value="row[column.key]" />
      </template>
    </div>
    <slot v-if="!data.length" name="empty" />
  </div>`,
}

const EntityPickerStub = {
  props: ['items', 'selectedLabel', 'modelValue', 'loading'],
  emits: ['search', 'update:modelValue', 'select'],
  template: `<div data-test="entity-picker">
    <input data-test="entity-input" :value="selectedLabel || ''" @input="$emit('search', $event.target.value)" />
    <button v-for="item in items" :key="item.value" :data-test="'user-' + item.value" @click="$emit('select', item); $emit('update:modelValue', item.value)">{{ item.label }}</button>
    <button data-test="entity-clear" @click="$emit('search', ''); $emit('update:modelValue', null)">clear</button>
  </div>`,
}

const SelectStub = {
  props: ['modelValue', 'options'],
  emits: ['update:modelValue', 'change'],
  template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value); $emit('change')"><option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>`,
}

function mountView() {
  return mount(SubscriptionsView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        AppPage: { template: '<section><slot /></section>' },
        AppPageHeader: { template: '<header><slot name="actions" /></header>' },
        UiServerTableWorkspace: { template: '<div><slot name="toolbar" /><slot name="filters" /><slot /><slot name="pagination" /></div>' },
        UiTableToolbar: { template: '<div><slot /><slot name="actions" /></div>' },
        UiDataTable: DataTableStub,
        UiAsyncEntityPicker: EntityPickerStub,
        UiSelect: SelectStub,
        UiColumnPicker: { props: ['modelValue', 'columns'], template: '<div data-test="column-picker" />' },
        UiSegmentedControl: true,
        UiPagination: true,
        UiDialog: { props: ['show'], template: '<section v-if="show"><slot /><slot name="footer" /></section>' },
        UiConfirmDialog: { props: ['show'], emits: ['confirm', 'cancel'], template: '<button v-if="show" data-test="confirm" @click="$emit(\'confirm\')">confirm</button>' },
        UiButton: { props: ['form'], template: '<button :form="form"><slot /></button>' },
        UiIconButton: { props: ['icon', 'label'], template: '<button :aria-label="label" :data-icon="icon"><slot /></button>' },
        UiNumberStepper: { props: ['modelValue'], template: '<input :value="modelValue" />' },
        UiTextField: { props: ['modelValue'], template: '<input :value="modelValue" />' },
        UiDescriptionList: { template: '<dl><slot /></dl>' },
        UiEmptyState: { template: '<div data-test="empty"><slot name="action" /></div>' },
        UiProgressBar: { props: ['value', 'tone'], template: '<div role="progressbar" :data-value="value" :data-tone="tone" />' },
        UiStatusBadge: { props: ['label'], template: '<span data-test="status">{{ label }}</span>' },
        UiBadge: { props: ['label'], template: '<span data-test="badge">{{ label }}<slot /></span>' },
        UiAvatar: true,
        UiAlert: true,
        UiLink: true,
        Icon: true,
      },
    },
  })
}

beforeEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  for (const fn of [list, assign, extend, revoke, restore, resetQuota, getAllGroups, getPlans, searchUsers, showError, showSuccess]) fn.mockReset()
  list.mockResolvedValue({ items: [makeSubscription()], total: 1, page: 1, page_size: 20, pages: 1 })
  getAllGroups.mockResolvedValue([group])
  getPlans.mockResolvedValue({ data: [makePlan()] })
  searchUsers.mockResolvedValue([{ id: 42, email: 'user@example.com', deleted: false }])
})

describe('admin SubscriptionsView', () => {
  it('loads active subscriptions with server-side created_at descending defaults', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(list).toHaveBeenCalledWith(1, 20, expect.objectContaining({
      status: 'active',
      sort_by: 'created_at',
      sort_order: 'desc',
    }), expect.any(Object))
    expect(wrapper.get('[data-test="columns"]').text()).toContain('user,plan,usage,expires_at,status,actions')
  })

  it('migrates the legacy group column key and preserves required columns', async () => {
    localStorage.setItem('subscription-user-column-mode', 'username')
    localStorage.setItem('subscription-hidden-columns', JSON.stringify(['group', 'usage']))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-test="columns"]').text()).toBe('user,expires_at,status,actions')
    expect(localStorage.getItem('subscription-hidden-columns')).toBe(JSON.stringify(['group', 'usage']))
  })

  it('debounces user search and reloads when a user is selected or cleared', async () => {
    vi.useFakeTimers()
    const wrapper = mountView()
    await flushPromises()
    const input = wrapper.get('[data-test="entity-input"]')

    await input.setValue('user@')
    await vi.advanceTimersByTimeAsync(299)
    expect(searchUsers).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(searchUsers).toHaveBeenCalledWith('user@')

    const user = wrapper.get('[data-test="user-42"]')
    await user.trigger('click')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ user_id: 42 }), expect.any(Object))

    await wrapper.get('[data-test="entity-clear"]').trigger('click')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ user_id: undefined }), expect.any(Object))
  })

  it('keeps usage plus reserved in the progress percentage and caps at 100', async () => {
    list.mockResolvedValue({
      items: [makeSubscription({ five_hour_quota_usd: 10, five_hour_usage_usd: 9, five_hour_reserved_usd: 3 })],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    const wrapper = mountView()
    await flushPromises()

    const progress = wrapper.get('[role="progressbar"]')
    expect(progress.attributes('data-value')).toBe('100')
    expect(progress.attributes('data-tone')).toBe('danger')
  })

  it('uses the status action matrix for active and revoked rows', async () => {
    list.mockResolvedValue({
      items: [makeSubscription({ id: 1, status: 'active' }), makeSubscription({ id: 2, status: 'revoked' })],
      total: 2,
      page: 1,
      page_size: 20,
      pages: 1,
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-test="row-1"]').findAll('button[data-icon]').map(button => button.attributes('data-icon'))).toEqual(['calendar', 'refresh', 'ban'])
    expect(wrapper.get('[data-test="row-2"]').findAll('button[data-icon]').map(button => button.attributes('data-icon'))).toEqual(['refresh'])
  })

  it('requests the selected server sort and resets to page one', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-test="sort-status"]').trigger('click')
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ sort_by: 'status', sort_order: 'asc' }), expect.any(Object))
  })
})
