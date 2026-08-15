import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  listAlertRules: vi.fn(),
  deleteAlertRule: vi.fn(),
  createAlertRule: vi.fn(),
  updateAlertRule: vi.fn(),
  getGroups: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api', () => ({
  adminAPI: { groups: { getAll: mocks.getGroups } },
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    listAlertRules: mocks.listAlertRules,
    deleteAlertRule: mocks.deleteAlertRule,
    createAlertRule: mocks.createAlertRule,
    updateAlertRule: mocks.updateAlertRule,
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: mocks.showError, showSuccess: mocks.showSuccess }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import OpsAlertRulesCard from '../OpsAlertRulesCard.vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('OpsAlertRulesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getGroups.mockResolvedValue([])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('submits a delete request only once while confirmation is pending', async () => {
    const deletion = deferred<void>()
    mocks.listAlertRules
      .mockResolvedValueOnce([{
        id: 7,
        name: 'Error rate',
        enabled: true,
        metric_type: 'error_rate',
        operator: '>',
        threshold: 1,
        window_minutes: 1,
        sustained_minutes: 2,
        severity: 'P1',
        cooldown_minutes: 10,
        notify_email: true,
      }])
      .mockResolvedValueOnce([])
    mocks.deleteAlertRule.mockImplementation(() => deletion.promise)

    const wrapper = mount(OpsAlertRulesCard)
    await flushPromises()

    const deleteButton = wrapper.findAll('button').find((button) => button.text() === 'common.delete')
    expect(deleteButton).toBeDefined()
    await deleteButton!.trigger('click')

    const confirmButton = document.body.querySelector('.ui-confirm__actions button:last-child') as HTMLButtonElement
    expect(confirmButton).toBeTruthy()
    confirmButton.click()
    confirmButton.click()
    await flushPromises()

    expect(mocks.deleteAlertRule).toHaveBeenCalledTimes(1)
    expect(mocks.deleteAlertRule).toHaveBeenCalledWith(7)

    deletion.resolve()
    await flushPromises()
  })
})
