import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AnnouncementBell from '../AnnouncementBell.vue'
import { useAnnouncementStore } from '@/stores/announcements'

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const UiDialogStub = {
  props: ['show', 'title'],
  emits: ['close'],
  template: '<section v-if="show"><h2>{{ title }}</h2><slot/><slot name="footer"/></section>',
}

describe('AnnouncementBell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the unread indicator and marks an opened announcement as read', async () => {
    const store = useAnnouncementStore()
    store.announcements = [{
      id: 9,
      title: 'Maintenance notice',
      content: 'Scheduled maintenance',
      notify_mode: 'silent',
      created_at: '2026-08-15T12:00:00Z',
      updated_at: '2026-08-15T12:00:00Z',
      read_at: null,
    } as any]
    const markAsRead = vi.spyOn(store, 'markAsRead').mockResolvedValue()
    const wrapper = mount(AnnouncementBell, {
      global: {
        stubs: {
          UiDialog: UiDialogStub,
          AnnouncementDetail: true,
          Icon: true,
        },
      },
    })

    expect(wrapper.get('.ui-notification-dot i').attributes('aria-label')).toBe('有新通知')

    await wrapper.get('button[aria-label="announcements.title"]').trigger('click')
    expect(wrapper.text()).toContain('Maintenance notice')

    await wrapper.get('.announcement-center__item').trigger('click')
    expect(markAsRead).toHaveBeenCalledWith(9)
  })
})
