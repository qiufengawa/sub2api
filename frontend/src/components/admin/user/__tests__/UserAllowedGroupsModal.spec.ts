import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import UserAllowedGroupsModal from '../UserAllowedGroupsModal.vue'

const { listGroups, getUserById, updateUser, showError, showSuccess } = vi.hoisted(() => ({
  listGroups: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    groups: { list: listGroups },
    users: { getById: getUserById, update: updateUser },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

const groups = [
  {
    id: 1,
    name: 'GPT Primary',
    platform: 'openai',
    is_exclusive: true,
    rate_multiplier: 0.1,
    subscription_type: 'standard',
    status: 'active',
  },
  {
    id: 2,
    name: 'Public',
    platform: 'anthropic',
    is_exclusive: false,
    rate_multiplier: 1,
    subscription_type: 'standard',
    status: 'active',
  },
  {
    id: 3,
    name: 'Disabled Exclusive',
    platform: 'gemini',
    is_exclusive: true,
    rate_multiplier: 0.3,
    subscription_type: 'standard',
    status: 'disabled',
  },
]

const user = (id: number, allowedGroups: number[] = []) => ({
  id,
  email: `user-${id}@example.com`,
  allowed_groups: allowedGroups,
  group_rates: {},
})

function mountModal(currentUser = user(7, [1, 3])) {
  return mount(UserAllowedGroupsModal, {
    props: { show: true, user: currentUser as any },
    global: {
      stubs: {
        UiDialog: {
          props: ['show', 'title'],
          emits: ['close'],
          template: '<div v-if="show"><slot /><slot name="footer" /></div>',
        },
        PlatformIcon: true,
      },
    },
  })
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

describe('UserAllowedGroupsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listGroups.mockResolvedValue({ items: groups })
    getUserById.mockResolvedValue(user(7, [1, 3]))
    updateUser.mockResolvedValue(user(7, [1, 3]))
  })

  it('loads a fresh user snapshot and preserves hidden allowed group ids on save', async () => {
    const wrapper = mountModal()
    await flushPromises()

    expect(getUserById).toHaveBeenCalledWith(7)
    expect(wrapper.text()).toContain('GPT Primary')
    expect(wrapper.text()).not.toContain('Disabled Exclusive')

    const save = wrapper.findAll('button').find((button) => button.text() === 'common.save')
    expect(save).toBeTruthy()
    await save!.trigger('click')
    await flushPromises()

    expect(updateUser).toHaveBeenCalledWith(7, expect.objectContaining({
      allowed_groups: [3, 1],
    }))
  })

  it('blocks saving after a load failure and allows retry', async () => {
    listGroups.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.users.failedToLoadGroups')
    const save = wrapper.findAll('button').find((button) => button.text() === 'common.save')
    expect(save?.attributes('disabled')).toBeDefined()

    const retry = wrapper.findAll('button').find((button) => button.text() === 'common.retry')
    await retry!.trigger('click')
    await flushPromises()

    expect(listGroups).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('GPT Primary')
    expect(save?.attributes('disabled')).toBeUndefined()
  })

  it('ignores an older user response after the dialog target changes', async () => {
    const first = deferred<ReturnType<typeof user>>()
    const second = deferred<ReturnType<typeof user>>()
    getUserById.mockImplementation((id: number) => id === 7 ? first.promise : second.promise)

    const wrapper = mountModal(user(7, [1]))
    await wrapper.setProps({ user: user(8, []) as any })
    second.resolve(user(8, []))
    await flushPromises()

    let exclusiveCheckbox = wrapper.find('input[type="checkbox"]')
    expect((exclusiveCheckbox.element as HTMLInputElement).checked).toBe(false)

    first.resolve(user(7, [1]))
    await flushPromises()

    exclusiveCheckbox = wrapper.find('input[type="checkbox"]')
    expect((exclusiveCheckbox.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.text()).toContain('user-8@example.com')
  })
})
