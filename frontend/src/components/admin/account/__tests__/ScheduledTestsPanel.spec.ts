import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScheduledTestsPanel from '../ScheduledTestsPanel.vue'
import type { ScheduledTestPlan, ScheduledTestResult } from '@/types'

const api = vi.hoisted(() => ({
  listByAccount: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listResults: vi.fn()
}))
const notifications = vi.hoisted(() => ({ showSuccess: vi.fn(), showError: vi.fn() }))

vi.mock('@/api/admin', () => ({ adminAPI: { scheduledTests: api } }))
vi.mock('@/stores/app', () => ({ useAppStore: () => notifications }))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const plan = (overrides: Partial<ScheduledTestPlan> = {}): ScheduledTestPlan => ({
  id: 12,
  account_id: 7,
  model_id: 'gpt-5.6-sol',
  cron_expression: '*/30 * * * *',
  enabled: true,
  max_results: 100,
  auto_recover: true,
  last_run_at: null,
  next_run_at: null,
  created_at: '2026-08-15T00:00:00Z',
  updated_at: '2026-08-15T00:00:00Z',
  ...overrides
})

const result = (overrides: Partial<ScheduledTestResult> = {}): ScheduledTestResult => ({
  id: 31,
  plan_id: 12,
  status: 'success',
  response_text: 'ok',
  error_message: '',
  latency_ms: 240,
  started_at: '2026-08-15T00:00:00Z',
  finished_at: '2026-08-15T00:00:01Z',
  created_at: '2026-08-15T00:00:01Z',
  ...overrides
})

const mountPanel = () => mount(ScheduledTestsPanel, {
  props: {
    show: false,
    accountId: 7,
    modelOptions: [{ value: 'gpt-5.6-sol', label: 'GPT 5.6 Sol' }]
  },
  global: { stubs: { Teleport: true } }
})

const openPanel = async () => {
  const wrapper = mountPanel()
  await wrapper.setProps({ show: true })
  await flushPromises()
  return wrapper
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('ScheduledTestsPanel', () => {
  beforeEach(() => {
    Object.values(api).forEach(mock => mock.mockReset())
    notifications.showSuccess.mockReset()
    notifications.showError.mockReset()
    api.listByAccount.mockResolvedValue([plan()])
  })

  it('loads plans and updates the enabled state through the plan endpoint', async () => {
    api.update.mockResolvedValue(plan({ enabled: false }))
    const wrapper = await openPanel()

    expect(api.listByAccount).toHaveBeenCalledWith(7)
    expect(wrapper.text()).toContain('gpt-5.6-sol')

    await wrapper.get('button[role="switch"]').trigger('click')
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith(12, { enabled: false })
    expect(notifications.showSuccess).toHaveBeenCalled()
  })

  it('loads and expands result details without changing the plan', async () => {
    api.listResults.mockResolvedValue([result()])
    const wrapper = await openPanel()

    const trigger = wrapper.get('.scheduled-tests__plan-trigger')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    const controlledId = trigger.attributes('aria-controls')
    expect(controlledId).toBe('scheduled-test-results-12')

    await trigger.trigger('click')
    await flushPromises()
    expect(api.listResults).toHaveBeenCalledWith(12, 20)
    expect(wrapper.text()).toContain('240ms')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get(`#${controlledId}`).exists()).toBe(true)

    const detailButton = wrapper.findAll('button').find(button => button.text().includes('admin.scheduledTests.responseText'))
    expect(detailButton).toBeDefined()
    await detailButton!.trigger('click')
    expect(wrapper.get('.ui-code-block').text()).toContain('ok')
  })

  it('deletes a confirmed plan and removes it from the visible list', async () => {
    api.delete.mockResolvedValue(undefined)
    const wrapper = await openPanel()

    await wrapper.get('button[aria-label="admin.scheduledTests.deletePlan"]').trigger('click')
    const confirm = wrapper.findAll('button').find(button => button.text().includes('common.delete'))
    expect(confirm).toBeDefined()
    await confirm!.trigger('click')
    await flushPromises()

    expect(api.delete).toHaveBeenCalledWith(12)
    expect(wrapper.text()).not.toContain('gpt-5.6-sol')
  })

  it('prevents duplicate enabled updates for the same plan', async () => {
    const pending = deferred<ScheduledTestPlan>()
    api.update.mockReturnValueOnce(pending.promise)
    const wrapper = await openPanel()
    const vm = wrapper.vm as unknown as {
      handleToggleEnabled: (value: ScheduledTestPlan, enabled: boolean) => Promise<void>
    }

    const first = vm.handleToggleEnabled(plan(), false)
    const second = vm.handleToggleEnabled(plan(), false)
    await flushPromises()

    expect(api.update).toHaveBeenCalledTimes(1)
    expect(api.update).toHaveBeenCalledWith(12, { enabled: false })

    pending.resolve(plan({ enabled: false }))
    await Promise.all([first, second])
  })

  it('prevents duplicate plan deletion while confirmation is pending', async () => {
    const pending = deferred<void>()
    api.delete.mockReturnValueOnce(pending.promise)
    const wrapper = await openPanel()
    const vm = wrapper.vm as unknown as {
      confirmDeletePlan: (value: ScheduledTestPlan) => void
      handleDelete: () => Promise<void>
    }
    vm.confirmDeletePlan(plan())

    const first = vm.handleDelete()
    const second = vm.handleDelete()
    await flushPromises()

    expect(api.delete).toHaveBeenCalledTimes(1)
    expect(api.delete).toHaveBeenCalledWith(12)

    pending.resolve()
    await Promise.all([first, second])
  })

  it('keeps a failed plan deletion confirmation open for retry', async () => {
    api.delete.mockRejectedValueOnce(new Error('delete fixture failure'))
    const wrapper = await openPanel()
    await wrapper.get('button[aria-label="admin.scheduledTests.deletePlan"]').trigger('click')
    const confirm = wrapper.findAll('button').find(button => button.text().includes('common.delete'))
    expect(confirm).toBeDefined()
    await confirm!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('button').some(button => button.text().includes('common.delete'))).toBe(true)
    expect(notifications.showError).toHaveBeenCalled()

    api.delete.mockResolvedValueOnce(undefined)
    const retry = wrapper.findAll('button').find(button => button.text().includes('common.delete'))
    await retry!.trigger('click')
    await flushPromises()
    expect(api.delete).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('gpt-5.6-sol')
  })
})
