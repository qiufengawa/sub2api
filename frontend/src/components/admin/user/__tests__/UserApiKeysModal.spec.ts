import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import UserApiKeysModal from '../UserApiKeysModal.vue'

const { getUserApiKeys, getGroups, updateApiKeyGroup, showError, showSuccess } = vi.hoisted(() => ({
  getUserApiKeys: vi.fn(),
  getGroups: vi.fn(),
  updateApiKeyGroup: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    users: { getUserApiKeys },
    groups: { getAll: getGroups },
    apiKeys: { updateApiKeyGroup },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const group = {
  id: 2,
  name: 'GPT Fast',
  platform: 'openai',
  rate_multiplier: 0.2,
}

const apiKey = (id: number, name = `Key ${id}`) => ({
  id,
  name,
  key: `sk-${'a'.repeat(24)}-${id}`,
  status: 'active',
  group_id: null,
  group: null,
  created_at: '2026-08-15T12:00:00Z',
})

function mountModal(userId = 7) {
  return mount(UserApiKeysModal, {
    props: {
      show: true,
      user: { id: userId, email: `user-${userId}@example.com`, username: '' } as any,
    },
    global: {
      stubs: {
        UiDialog: {
          props: ['show', 'title'],
          emits: ['close'],
          template: '<div v-if="show"><slot /></div>',
        },
        UiSelect: {
          props: ['modelValue', 'options', 'disabled'],
          emits: ['change'],
          template: '<button data-test="group-select" :disabled="disabled" @click="$emit(\'change\', 2)">select group</button>',
        },
      },
    },
  })
}

describe('UserApiKeysModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserApiKeys.mockResolvedValue({ items: [apiKey(11)], total: 1, page: 1, page_size: 20 })
    getGroups.mockResolvedValue([group])
    updateApiKeyGroup.mockResolvedValue({
      api_key: { ...apiKey(11), group_id: 2, group },
      auto_granted_group_access: true,
      granted_group_name: group.name,
    })
  })

  it('loads the requested user page and changes a key group through the shared select', async () => {
    const wrapper = mountModal()
    await flushPromises()

    expect(getUserApiKeys).toHaveBeenCalledWith(7, 1, 20)
    expect(wrapper.text()).toContain('Key 11')

    await wrapper.get('[data-test="group-select"]').trigger('click')
    await flushPromises()

    expect(updateApiKeyGroup).toHaveBeenCalledWith(11, 2)
    expect(wrapper.emitted('success')).toEqual([[]])
    expect(showSuccess).toHaveBeenCalledWith('admin.users.groupChangedWithGrant')
  })

  it('requests subsequent pages instead of truncating after the first page', async () => {
    getUserApiKeys.mockResolvedValue({ items: [apiKey(11)], total: 25, page: 1, page_size: 20 })
    const wrapper = mountModal()
    await flushPromises()

    await wrapper.get('button[aria-label="下一页"]').trigger('click')
    await flushPromises()

    expect(getUserApiKeys).toHaveBeenLastCalledWith(7, 2, 20)
  })

  it('clears the previous user rows and disables editing when the next load fails', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain('Key 11')

    getUserApiKeys.mockRejectedValueOnce(new Error('network'))
    await wrapper.setProps({
      user: { id: 8, email: 'user-8@example.com', username: '' } as any,
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Key 11')
    expect(wrapper.text()).toContain('admin.users.failedToLoadApiKeys')
    expect(wrapper.find('[data-test="group-select"]').exists()).toBe(false)
    expect(showError).toHaveBeenCalledWith('admin.users.failedToLoadApiKeys')
  })
})
