import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AvailableChannelsView from '@/views/user/AvailableChannelsView.vue'
import type { UserAvailableChannel } from '@/api/channels'

const { getAvailableMock, getUserGroupRatesMock, showErrorMock } = vi.hoisted(() => ({
  getAvailableMock: vi.fn(),
  getUserGroupRatesMock: vi.fn(),
  showErrorMock: vi.fn()
}))

vi.mock('@/api/channels', () => ({
  default: { getAvailable: (...args: unknown[]) => getAvailableMock(...args) }
}))

vi.mock('@/api/groups', () => ({
  default: { getUserGroupRates: (...args: unknown[]) => getUserGroupRatesMock(...args) }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: showErrorMock })
}))

vi.mock('@/utils/apiError', () => ({
  extractApiErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        key === 'availableChannels.resultCount' ? `${params?.count} channels` : key
    })
  }
})

const rows: UserAvailableChannel[] = [
  {
    name: 'Primary channel',
    description: 'Reliable',
    platforms: [
      {
        platform: 'anthropic',
        groups: [{ id: 1, name: 'Claude Pro', platform: 'anthropic', subscription_type: 'standard', rate_multiplier: 1, is_exclusive: true }],
        supported_models: [{ name: 'claude-sonnet', platform: 'anthropic', pricing: null }]
      },
      {
        platform: 'openai',
        groups: [{ id: 2, name: 'GPT Fast', platform: 'openai', subscription_type: 'standard', rate_multiplier: 1, is_exclusive: false }],
        supported_models: [{ name: 'gpt-5', platform: 'openai', pricing: null }]
      }
    ]
  }
]

const TableStub = defineComponent({
  name: 'AvailableChannelsTable',
  props: ['rows', 'loading', 'userGroupRates'],
  setup(props) {
    return () => h('div', {
      'data-testid': 'table-stub',
      'data-row-count': props.rows.length,
      'data-platform-count': props.rows[0]?.platforms?.length ?? 0,
      'data-rates': JSON.stringify(props.userGroupRates)
    })
  }
})

function mountView() {
  return mount(AvailableChannelsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        AvailableChannelsTable: TableStub,
        Icon: true
      }
    }
  })
}

describe('AvailableChannelsView', () => {
  beforeEach(() => {
    getAvailableMock.mockReset()
    getUserGroupRatesMock.mockReset()
    showErrorMock.mockReset()
    getAvailableMock.mockResolvedValue(rows)
    getUserGroupRatesMock.mockResolvedValue({ 1: 0.8 })
  })

  it('loads channels and user-specific rates concurrently', async () => {
    const wrapper = mountView()
    expect(getAvailableMock).toHaveBeenCalledOnce()
    expect(getUserGroupRatesMock).toHaveBeenCalledOnce()

    await flushPromises()

    expect(wrapper.get('[data-testid="table-stub"]').attributes('data-row-count')).toBe('1')
    expect(wrapper.get('[data-testid="table-stub"]').attributes('data-rates')).toBe('{"1":0.8}')
    expect(wrapper.get('[data-testid="available-channel-count"]').text()).toContain('1 channels')
  })

  it('keeps all platform sections for a channel-level match and narrows section-level matches', async () => {
    const wrapper = mountView()
    await flushPromises()
    const search = wrapper.get('input[type="search"]')

    await search.setValue('primary')
    await nextTick()
    expect(wrapper.get('[data-testid="table-stub"]').attributes('data-platform-count')).toBe('2')

    await search.setValue('gpt-5')
    await nextTick()
    expect(wrapper.get('[data-testid="table-stub"]').attributes('data-platform-count')).toBe('1')

    await search.setValue('missing')
    await nextTick()
    expect(wrapper.get('[data-testid="table-stub"]').attributes('data-row-count')).toBe('0')
  })

  it('degrades to default rates when the rates request fails', async () => {
    getUserGroupRatesMock.mockRejectedValueOnce(new Error('rates unavailable'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="table-stub"]').attributes('data-row-count')).toBe('1')
    expect(wrapper.get('[data-testid="table-stub"]').attributes('data-rates')).toBe('{}')
    expect(showErrorMock).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('shows an inline retry state and a toast when the channel request fails', async () => {
    getAvailableMock.mockRejectedValueOnce(new Error('channel load failed'))
    const wrapper = mountView()
    await flushPromises()

    expect(showErrorMock).toHaveBeenCalledWith('channel load failed')
    expect(wrapper.text()).toContain('channel load failed')
    expect(wrapper.find('[data-testid="table-stub"]').exists()).toBe(false)
  })
})
