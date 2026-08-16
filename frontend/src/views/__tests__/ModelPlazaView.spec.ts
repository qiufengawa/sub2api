import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ModelPlazaView from '../ModelPlazaView.vue'
import type { ModelPlazaResponse } from '@/api/modelPlaza'

const mocks = vi.hoisted(() => ({
  getModelPlaza: vi.fn(),
  fetchPublicSettings: vi.fn(),
  routeQuery: {} as Record<string, string | undefined>,
  authStore: { isAuthenticated: false },
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...actual, useRoute: () => ({ query: mocks.routeQuery }) }
})

vi.mock('@/api/modelPlaza', async () => {
  const actual = await vi.importActual<typeof import('@/api/modelPlaza')>('@/api/modelPlaza')
  return { ...actual, getModelPlaza: mocks.getModelPlaza }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ fetchPublicSettings: mocks.fetchPublicSettings }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mocks.authStore,
}))

const response: ModelPlazaResponse = { description: '', groups: [] }

function mountView() {
  return mount(ModelPlazaView, {
    global: {
      stubs: {
        AppLayout: { template: '<div data-testid="app-layout"><slot /></div>' },
        AppPage: { template: '<main data-testid="app-page"><slot /></main>' },
        PlazaNavBar: { template: '<nav data-testid="plaza-nav" />' },
        ModelPlazaContent: {
          name: 'ModelPlazaContent',
          props: {
            response: Object,
            loading: Boolean,
            error: Boolean,
            embedded: Boolean,
          },
          emits: ['retry'],
          template: '<div data-testid="plaza-content" />',
        },
      },
    },
  })
}

describe('ModelPlazaView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete mocks.routeQuery.embedded
    mocks.authStore.isAuthenticated = false
    mocks.getModelPlaza.mockResolvedValue(response)
  })

  it('公开形态渲染独立导航和页面壳', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="plaza-nav"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-layout"]').exists()).toBe(false)
    expect(wrapper.getComponent({ name: 'ModelPlazaContent' }).props('response')).toEqual(response)
  })

  it('已登录且 embedded=1 时复用控制台布局', async () => {
    mocks.routeQuery.embedded = '1'
    mocks.authStore.isAuthenticated = true
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="app-layout"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="plaza-nav"]').exists()).toBe(false)
    expect(wrapper.getComponent({ name: 'ModelPlazaContent' }).props('embedded')).toBe(true)
  })

  it('匿名 embedded 链接自动降级为公开形态', async () => {
    mocks.routeQuery.embedded = '1'
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="plaza-nav"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-layout"]').exists()).toBe(false)
  })

  it('失败后可从页面内重试并恢复数据', async () => {
    mocks.getModelPlaza.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response)
    const wrapper = mountView()
    await flushPromises()
    const content = wrapper.getComponent({ name: 'ModelPlazaContent' })

    expect(content.props('error')).toBe(true)
    content.vm.$emit('retry')
    await flushPromises()

    expect(mocks.getModelPlaza).toHaveBeenCalledTimes(2)
    expect(content.props('error')).toBe(false)
    expect(content.props('response')).toEqual(response)
  })
})
