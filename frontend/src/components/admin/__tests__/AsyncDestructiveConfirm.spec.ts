import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  listAttributes: vi.fn(),
  deleteAttribute: vi.fn(),
  listProfiles: vi.fn(),
  deleteProfile: vi.fn(),
  listRules: vi.fn(),
  deleteRule: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    userAttributes: {
      listDefinitions: apiMocks.listAttributes,
      deleteDefinition: apiMocks.deleteAttribute,
    },
    tlsFingerprintProfiles: {
      list: apiMocks.listProfiles,
      delete: apiMocks.deleteProfile,
    },
    errorPassthrough: {
      list: apiMocks.listRules,
      delete: apiMocks.deleteRule,
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: apiMocks.showError, showSuccess: apiMocks.showSuccess }),
}))

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({ t: (key: string) => key }),
}))

import UserAttributesConfigModal from '@/components/user/UserAttributesConfigModal.vue'
import TLSFingerprintProfilesModal from '@/components/admin/TLSFingerprintProfilesModal.vue'
import ErrorPassthroughRulesModal from '@/components/admin/ErrorPassthroughRulesModal.vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const stubs = {
  UiDialog: true,
  UiConfirmDialog: true,
  UiBadge: true,
  UiButton: true,
  UiCheckbox: true,
  UiIconButton: true,
  UiSelect: true,
  UiSpinner: true,
  UiSwitch: true,
  UiTextArea: true,
  UiTextField: true,
  UiRadioGroup: true,
  Icon: true,
}

describe('async destructive confirmation contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listAttributes.mockResolvedValue([])
    apiMocks.listProfiles.mockResolvedValue([])
    apiMocks.listRules.mockResolvedValue([])
  })

  it.each([
    ['user attributes', UserAttributesConfigModal, 'confirmDelete', 'handleDelete', 'deletingAttribute', 'deletePending', 'deleteAttribute', { id: 1, name: 'Region' }],
    ['TLS profiles', TLSFingerprintProfilesModal, 'handleDelete', 'confirmDelete', 'deletingProfile', 'deletePending', 'deleteProfile', { id: 2, name: 'Chrome' }],
    ['error passthrough rules', ErrorPassthroughRulesModal, 'handleDelete', 'confirmDelete', 'deletingRule', 'deletePending', 'deleteRule', { id: 3, name: 'Gateway' }],
  ] as const)('%s rejects duplicate confirmation while the delete is pending', async (_label, component, openMethod, submitMethod, targetKey, pendingKey, apiKey, target) => {
    const wrapper = mount(component, { props: { show: false }, global: { stubs } })
    const vm = wrapper.vm as any
    vm[openMethod](target)
    const request = deferred<void>()
    ;(apiMocks as any)[apiKey].mockReturnValueOnce(request.promise)

    const first = vm[submitMethod]()
    const second = vm[submitMethod]()
    await flushPromises()

    expect((apiMocks as any)[apiKey]).toHaveBeenCalledTimes(1)
    expect(vm[pendingKey]).toBe(true)
    expect(vm[targetKey]).toEqual(target)

    request.resolve()
    await Promise.all([first, second])
    expect(vm[pendingKey]).toBe(false)
    expect(vm[targetKey]).toBeNull()
    wrapper.unmount()
  })

  it('keeps the TLS delete confirmation target after a failed request', async () => {
    const wrapper = mount(TLSFingerprintProfilesModal, { props: { show: false }, global: { stubs } })
    const vm = wrapper.vm as any
    const target = { id: 4, name: 'Firefox' }
    vm.handleDelete(target)
    apiMocks.deleteProfile.mockRejectedValueOnce(new Error('offline'))

    await vm.confirmDelete()

    expect(vm.showDeleteDialog).toBe(true)
    expect(vm.deletingProfile).toEqual(target)
    expect(vm.deletePending).toBe(false)
    expect(apiMocks.showError).toHaveBeenCalled()
    wrapper.unmount()
  })
})
