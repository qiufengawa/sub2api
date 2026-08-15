import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  listAlertEvents: vi.fn(),
  getAlertEvent: vi.fn(),
  createAlertSilence: vi.fn(),
  updateAlertEventStatus: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    listAlertEvents: mocks.listAlertEvents,
    getAlertEvent: mocks.getAlertEvent,
    createAlertSilence: mocks.createAlertSilence,
    updateAlertEventStatus: mocks.updateAlertEventStatus,
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: mocks.showError, showSuccess: mocks.showSuccess }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import OpsAlertEventsCard from '../OpsAlertEventsCard.vue'

function event(id: number, title: string) {
  return {
    id,
    rule_id: id * 10,
    severity: 'P1',
    status: 'firing',
    title,
    fired_at: '2026-08-16T00:00:00Z',
    created_at: '2026-08-16T00:00:00Z',
    email_sent: false,
    dimensions: { platform: 'openai', group_id: 1 },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('OpsAlertEventsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the latest detail when an earlier detail request resolves last', async () => {
    const firstDetail = deferred<any>()
    const first = event(1, 'Event A')
    const second = event(2, 'Event B')

    mocks.listAlertEvents.mockResolvedValueOnce([first, second]).mockResolvedValue([])
    mocks.getAlertEvent
      .mockImplementationOnce(() => firstDetail.promise)
      .mockResolvedValueOnce({ ...second, title: 'Event B detail' })

    const wrapper = mount(OpsAlertEventsCard)
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    await rows[0].trigger('click')
    await rows[1].trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('Event B detail')

    firstDetail.resolve({ ...first, title: 'Event A stale detail' })
    await flushPromises()

    expect(document.body.textContent).toContain('Event B detail')
    expect(document.body.textContent).not.toContain('Event A stale detail')
  })
})
