import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  getConcurrencyStats: vi.fn(),
  getAccountAvailabilityStats: vi.fn(),
  getUserConcurrencyStats: vi.fn(),
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    getConcurrencyStats: mocks.getConcurrencyStats,
    getAccountAvailabilityStats: mocks.getAccountAvailabilityStats,
    getUserConcurrencyStats: mocks.getUserConcurrencyStats,
  },
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import OpsConcurrencyCard from '../OpsConcurrencyCard.vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function concurrency(platform: string, used: number) {
  return {
    enabled: true,
    platform: {
      [platform]: { max_capacity: 10, current_in_use: used, waiting_in_queue: 0 },
    },
  }
}

function availability(platform: string) {
  return {
    enabled: true,
    platform: {
      [platform]: {
        total_accounts: 2,
        available_count: 2,
        rate_limit_count: 0,
        error_count: 0,
      },
    },
  }
}

describe('OpsConcurrencyCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserConcurrencyStats.mockResolvedValue({ enabled: true, user: {} })
  })

  it('keeps the newest refresh result when an older request resolves last', async () => {
    const oldConcurrency = deferred<any>()
    const oldAvailability = deferred<any>()
    mocks.getConcurrencyStats
      .mockImplementationOnce(() => oldConcurrency.promise)
      .mockResolvedValueOnce(concurrency('fresh', 4))
    mocks.getAccountAvailabilityStats
      .mockImplementationOnce(() => oldAvailability.promise)
      .mockResolvedValueOnce(availability('fresh'))

    const wrapper = mount(OpsConcurrencyCard, { props: { refreshToken: 1 } })
    await wrapper.setProps({ refreshToken: 2 })
    await flushPromises()

    expect(wrapper.text()).toContain('FRESH')
    expect(wrapper.findAll('[role="progressbar"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[role="progressbar"]').every((bar) => Boolean(bar.attributes('aria-label')))).toBe(true)

    oldConcurrency.resolve(concurrency('stale', 9))
    oldAvailability.resolve(availability('stale'))
    await flushPromises()

    expect(wrapper.text()).toContain('FRESH')
    expect(wrapper.text()).not.toContain('STALE')
  })
})
