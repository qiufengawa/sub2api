import { describe, expect, it, vi } from 'vitest'
import type { Channel } from '@/api/admin/channels'
import { buildChannelGroupMap, fetchAllChannels } from '../channelConflict'

function channel(id: number, groupIds: number[]): Channel {
  return { id, name: `Channel ${id}`, group_ids: groupIds } as Channel
}

describe('channel conflict helpers', () => {
  it('loads every page and includes conflicts beyond the first 1000 channels', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => channel(index + 1, [index + 1]))
    const finalChannel = channel(1001, [9001])
    const loadPage = vi.fn()
      .mockResolvedValueOnce({ items: firstPage, total: 1001 })
      .mockResolvedValueOnce({ items: [finalChannel], total: 1001 })

    const channels = await fetchAllChannels(loadPage)
    const conflicts = buildChannelGroupMap(channels)

    expect(loadPage).toHaveBeenNthCalledWith(1, 1, 1000)
    expect(loadPage).toHaveBeenNthCalledWith(2, 2, 1000)
    expect(channels).toHaveLength(1001)
    expect(conflicts.get(9001)).toBe(finalChannel)
  })

  it('excludes the channel currently being edited', () => {
    const editing = channel(12, [44])
    const other = channel(13, [45])

    const conflicts = buildChannelGroupMap([editing, other], editing.id)

    expect(conflicts.has(44)).toBe(false)
    expect(conflicts.get(45)).toBe(other)
  })
})
