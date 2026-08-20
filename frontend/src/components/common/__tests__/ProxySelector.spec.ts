import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ProxySelector from '../ProxySelector.vue'
import UiCombobox from '@/components/ui/UiCombobox.vue'
import type { Proxy } from '@/types'

const { testProxyMock } = vi.hoisted(() => ({
  testProxyMock: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    proxies: {
      testProxy: testProxyMock
    }
  }
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const wrappers: VueWrapper[] = []

function proxy(id: number, overrides: Partial<Proxy> = {}): Proxy {
  return {
    id,
    name: `Proxy ${id}`,
    protocol: 'https',
    host: `proxy-${id}.example.com`,
    port: 8443,
    username: null,
    status: 'active',
    account_count: id,
    expires_at: null,
    fallback_mode: 'none',
    expiry_warn_days: 7,
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    ...overrides
  }
}

function mountSelector(overrides: Partial<InstanceType<typeof ProxySelector>['$props']> = {}) {
  const wrapper = mount(ProxySelector, {
    attachTo: document.body,
    props: {
      modelValue: 1,
      proxies: [proxy(1), proxy(2)],
      ...overrides
    },
    global: {
      stubs: { Icon: true }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function openOptions(wrapper: VueWrapper) {
  await wrapper.get('[role="combobox"]').trigger('click')
  await flushPromises()
}

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  document.body.innerHTML = ''
  testProxyMock.mockReset()
  vi.restoreAllMocks()
})

describe('ProxySelector', () => {
  it('preserves the shared combobox contract and normalizes selected values', async () => {
    const wrapper = mountSelector({ 'data-testid': 'proxy-picker' })
    const combobox = wrapper.getComponent(UiCombobox)
    const options = combobox.props('options') as Array<Record<string, unknown>>

    expect(wrapper.get('[role="combobox"]').attributes('aria-label')).toBe('admin.accounts.proxy')
    expect(wrapper.get('[role="combobox"]').attributes('data-testid')).toBe('proxy-picker')
    expect(combobox.props('clearable')).toBe(true)
    expect(combobox.props('density')).toBe('compact')
    expect(options[0]).toMatchObject({ value: null, alwaysVisible: true })
    expect(options[1]).toMatchObject({
      value: 1,
      endpoint: 'https://proxy-1.example.com:8443',
      account_count: 1
    })
    expect(wrapper.text()).toContain('Proxy 1 (https://proxy-1.example.com:8443)')

    combobox.vm.$emit('update:modelValue', 2)
    combobox.vm.$emit('update:modelValue', '2')
    expect(wrapper.emitted('update:modelValue')).toEqual([[2], [null]])
  })

  it('renders accessible test actions and records a successful proxy test', async () => {
    const pending = deferred<{ success: boolean; message: string; country: string; latency_ms: number }>()
    testProxyMock.mockReturnValueOnce(pending.promise)
    const wrapper = mountSelector()
    await openOptions(wrapper)

    const singleAction = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="admin.proxies.testConnection"]'
    )
    const batchAction = wrapper.get('button[aria-label="admin.proxies.batchTest"]')
    expect(singleAction).not.toBeNull()
    expect(batchAction.attributes('title')).toBe('admin.proxies.batchTest')

    singleAction!.click()
    await wrapper.vm.$nextTick()
    expect(testProxyMock).toHaveBeenCalledWith(1)
    expect(singleAction!.disabled).toBe(true)

    pending.resolve({ success: true, message: '', country: 'US', latency_ms: 42 })
    await flushPromises()
    expect(document.body.textContent).toContain('US · 42ms')
    expect(singleAction!.disabled).toBe(false)
  })

  it('shows a failed result and allows the proxy to be tested again', async () => {
    testProxyMock
      .mockRejectedValueOnce({ response: { data: { detail: 'timeout' } } })
      .mockResolvedValueOnce({ success: true, message: '', latency_ms: 8 })
    const wrapper = mountSelector()
    await openOptions(wrapper)
    const action = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="admin.proxies.testConnection"]'
    )!

    action.click()
    await flushPromises()
    expect(document.body.textContent).toContain('admin.proxies.testFailed')
    expect(action.disabled).toBe(false)

    action.click()
    await flushPromises()
    expect(testProxyMock).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('8ms')
  })

  it('runs one concurrent batch and restores the action after every test settles', async () => {
    const first = deferred<{ success: boolean; message: string }>()
    const second = deferred<{ success: boolean; message: string }>()
    testProxyMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = mountSelector()
    const batchAction = wrapper.get<HTMLButtonElement>('button[aria-label="admin.proxies.batchTest"]')

    await batchAction.trigger('click')
    expect(testProxyMock.mock.calls).toEqual([[1], [2]])
    expect(batchAction.element.disabled).toBe(true)
    await batchAction.trigger('click')
    expect(testProxyMock).toHaveBeenCalledTimes(2)

    first.resolve({ success: true, message: '' })
    second.resolve({ success: true, message: '' })
    await flushPromises()
    expect(batchAction.element.disabled).toBe(false)
  })
})
