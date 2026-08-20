import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAnnouncementStore } from '@/stores/announcements'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  markRead: vi.fn(),
}))

vi.mock('@/api', () => ({
  announcementsAPI: {
    list: (...args: unknown[]) => mocks.list(...args),
    markRead: (...args: unknown[]) => mocks.markRead(...args),
  },
}))

function makeAnnouncement(id: number) {
  return {
    id,
    title: `Announcement ${id}`,
    content: `Content ${id}`,
    notify_mode: 'popup' as const,
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    read_at: null,
  }
}

describe('announcement store read recovery', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a failed read unread and propagates the API error to callers', async () => {
    const store = useAnnouncementStore()
    store.announcements = [makeAnnouncement(1)]
    const failure = new Error('read unavailable')
    mocks.markRead.mockRejectedValueOnce(failure)

    await expect(store.markAsRead(1)).rejects.toBe(failure)
    expect(store.announcements[0].read_at).toBeNull()
    expect(store.unreadCount).toBe(1)
  })

  it('restores a popup after a failed read and preserves the queued popup order', async () => {
    vi.useFakeTimers()
    const store = useAnnouncementStore()
    mocks.list.mockResolvedValueOnce([makeAnnouncement(1), makeAnnouncement(2)])
    mocks.markRead.mockRejectedValueOnce(new Error('read unavailable'))

    await store.fetchAnnouncements(true)
    expect(store.currentPopup?.id).toBe(1)

    await store.dismissPopup()
    expect(store.currentPopup?.id).toBe(1)
    expect(store.unreadCount).toBe(2)

    mocks.markRead.mockResolvedValueOnce(undefined)
    await store.dismissPopup()
    expect(store.currentPopup).toBeNull()
    await vi.advanceTimersByTimeAsync(300)
    expect(store.currentPopup?.id).toBe(2)
  })

  it('ignores an older forced fetch when responses resolve out of order', async () => {
    const store = useAnnouncementStore()
    let resolveFirst!: (value: ReturnType<typeof makeAnnouncement>[]) => void
    let resolveSecond!: (value: ReturnType<typeof makeAnnouncement>[]) => void
    mocks.list
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

    const first = store.fetchAnnouncements(true)
    const second = store.fetchAnnouncements(true)
    resolveSecond([makeAnnouncement(2)])
    await second
    resolveFirst([makeAnnouncement(1)])
    await first

    expect(store.announcements.map((announcement) => announcement.id)).toEqual([2])
  })

  it('ignores a fetch response that arrives after reset', async () => {
    const store = useAnnouncementStore()
    let resolveList!: (value: ReturnType<typeof makeAnnouncement>[]) => void
    mocks.list.mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve }))

    const pending = store.fetchAnnouncements(true)
    store.reset()
    resolveList([makeAnnouncement(1)])
    await pending

    expect(store.announcements).toEqual([])
    expect(store.currentPopup).toBeNull()
  })
})
