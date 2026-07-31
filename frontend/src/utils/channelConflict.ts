import type { Channel } from '@/api/admin/channels'

interface ChannelPage {
  items: Channel[]
  total: number
}

type ChannelPageLoader = (page: number, pageSize: number) => Promise<ChannelPage>

export async function fetchAllChannels(
  loadPage: ChannelPageLoader,
  pageSize = 1000
): Promise<Channel[]> {
  const channels: Channel[] = []
  let page = 1
  let total = 0

  do {
    const response = await loadPage(page, pageSize)
    const items = response.items || []
    channels.push(...items)
    total = Math.max(response.total || 0, channels.length)

    if (items.length === 0) break
    page += 1
  } while (channels.length < total)

  return channels
}

export function buildChannelGroupMap(
  channels: Channel[],
  editingChannelId?: number
): Map<number, Channel> {
  const map = new Map<number, Channel>()

  for (const channel of channels) {
    if (channel.id === editingChannelId) continue
    for (const groupId of channel.group_ids || []) {
      map.set(groupId, channel)
    }
  }

  return map
}
