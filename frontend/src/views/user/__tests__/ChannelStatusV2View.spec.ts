import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ChannelStatusV2View from '../ChannelStatusV2View.vue'

const { apiMocks, showErrorMock } = vi.hoisted(() => ({
  apiMocks: {
    getDimensions: vi.fn(),
    getSnapshot: vi.fn(),
    getMatrix: vi.fn(),
    getModels: vi.fn(),
    getErrors: vi.fn(),
    getUsers: vi.fn(),
  },
  showErrorMock: vi.fn(),
}))

vi.mock('@/api/channelMonitorV2', () => apiMocks)
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAdmin: false }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: showErrorMock }) }))
vi.mock('@/utils/featureFlags', () => ({ isChannelMonitorThroughputHidden: () => false }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      te: () => false,
      locale: { value: 'en' },
    }),
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function mountView() {
  return shallowMount(ChannelStatusV2View, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        AppPage: { template: '<div><slot /></div>' },
        AppPageHeader: { template: '<header><slot name="status" /><slot name="actions" /></header>' },
        AppSection: { template: '<section data-testid="monitor-section"><slot /></section>' },
        UiErrorState: { props: ['title'], template: '<div data-testid="monitor-load-error">{{ title }}</div>' },
      },
    },
  })
}

describe('ChannelStatusV2View request lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a retryable page error instead of online empty data after initial failure', async () => {
    apiMocks.getDimensions.mockRejectedValue(new Error('monitor offline'))
    apiMocks.getSnapshot.mockRejectedValue(new Error('monitor offline'))
    apiMocks.getMatrix.mockRejectedValue(new Error('monitor offline'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="monitor-load-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="monitor-section"]').exists()).toBe(false)
    expect(showErrorMock).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('ignores a normal late error from a request superseded by reload', async () => {
    const firstDimensions = deferred<never>()
    const firstSnapshot = deferred<never>()
    const firstMatrix = deferred<never>()
    const secondDimensions = deferred<never>()
    const secondSnapshot = deferred<never>()
    const secondMatrix = deferred<never>()
    apiMocks.getDimensions
      .mockReturnValueOnce(firstDimensions.promise)
      .mockReturnValueOnce(secondDimensions.promise)
    apiMocks.getSnapshot
      .mockReturnValueOnce(firstSnapshot.promise)
      .mockReturnValueOnce(secondSnapshot.promise)
    apiMocks.getMatrix
      .mockReturnValueOnce(firstMatrix.promise)
      .mockReturnValueOnce(secondMatrix.promise)

    const wrapper = mountView()
    await flushPromises()
    void (wrapper.vm as unknown as { reload: (silent: boolean) => Promise<void> }).reload(false)
    await flushPromises()

    firstDimensions.reject(new Error('late network failure'))
    firstSnapshot.reject(new Error('late network failure'))
    firstMatrix.reject(new Error('late network failure'))
    await flushPromises()

    expect(showErrorMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="monitor-load-error"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
