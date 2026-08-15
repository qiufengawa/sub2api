import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import type { AdminGroup } from '@/types'
import UiAsyncEntityPicker from '@/components/ui/UiAsyncEntityPicker.vue'
import GroupRateMultipliersModal from '../GroupRateMultipliersModal.vue'
import GroupRPMOverridesModal from '../GroupRPMOverridesModal.vue'

const {
  batchSetGroupRateMultipliers,
  batchSetGroupRPMOverrides,
  clearGroupRPMOverrides,
  getGroupRateMultipliers,
  getGroupRPMOverrides,
  listUsers,
  showError,
  showSuccess
} = vi.hoisted(() => ({
  batchSetGroupRateMultipliers: vi.fn(),
  batchSetGroupRPMOverrides: vi.fn(),
  clearGroupRPMOverrides: vi.fn(),
  getGroupRateMultipliers: vi.fn(),
  getGroupRPMOverrides: vi.fn(),
  listUsers: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    groups: {
      batchSetGroupRateMultipliers,
      batchSetGroupRPMOverrides,
      clearGroupRPMOverrides,
      getGroupRateMultipliers,
      getGroupRPMOverrides
    },
    users: { list: listUsers }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const group = {
  id: 7,
  name: 'OpenAI Primary',
  platform: 'openai',
  rate_multiplier: 1,
  rpm_limit: 120
} as AdminGroup

const UiDialogStub = {
  props: ['show', 'title'],
  emits: ['close'],
  template: '<section v-if="show"><slot /><slot name="footer" /></section>'
}

const mountRateModal = () => mount(GroupRateMultipliersModal, {
  props: { show: true, group },
  global: { stubs: { UiDialog: UiDialogStub, PlatformIcon: true } }
})

const mountRpmModal = () => mount(GroupRPMOverridesModal, {
  props: { show: true, group },
  global: { stubs: { UiDialog: UiDialogStub, PlatformIcon: true } }
})

describe('group user override dialogs', () => {
  beforeEach(() => {
    for (const mock of [
      batchSetGroupRateMultipliers,
      batchSetGroupRPMOverrides,
      clearGroupRPMOverrides,
      getGroupRateMultipliers,
      getGroupRPMOverrides,
      listUsers,
      showError,
      showSuccess
    ]) mock.mockReset()

    getGroupRateMultipliers.mockResolvedValue([{
      user_id: 11,
      user_name: 'alice',
      user_email: 'alice@example.com',
      user_notes: '',
      user_status: 'active',
      rate_multiplier: 1.5,
      rpm_override: 80
    }])
    getGroupRPMOverrides.mockResolvedValue([{
      user_id: 11,
      user_name: 'alice',
      user_email: 'alice@example.com',
      user_notes: '',
      user_status: 'active',
      rpm_override: 80
    }])
    batchSetGroupRateMultipliers.mockResolvedValue({ message: 'ok' })
    batchSetGroupRPMOverrides.mockResolvedValue({ message: 'ok' })
    clearGroupRPMOverrides.mockResolvedValue({ message: 'ok' })
  })

  it('saves only rate multipliers and leaves RPM outside the payload', async () => {
    const wrapper = mountRateModal()
    await flushPromises()

    const inputs = wrapper.findAll('input[type="number"]')
    await inputs[inputs.length - 1].setValue('2.25')
    await wrapper.get('[data-test="save-rate-overrides"]').trigger('click')
    await flushPromises()

    expect(batchSetGroupRateMultipliers).toHaveBeenCalledWith(7, [
      { user_id: 11, rate_multiplier: 2.25 }
    ])
    expect(batchSetGroupRPMOverrides).not.toHaveBeenCalled()
  })

  it('saves only RPM overrides and leaves rate multipliers outside the payload', async () => {
    const wrapper = mountRpmModal()
    await flushPromises()

    const inputs = wrapper.findAll('input[type="number"]')
    await inputs[inputs.length - 1].setValue('240')
    await wrapper.get('[data-test="save-rpm-overrides"]').trigger('click')
    await flushPromises()

    expect(batchSetGroupRPMOverrides).toHaveBeenCalledWith(7, [
      { user_id: 11, rpm_override: 240 }
    ])
    expect(batchSetGroupRateMultipliers).not.toHaveBeenCalled()
  })

  it('cancels a pending user search when unmounted', async () => {
    vi.useFakeTimers()
    const wrapper = mountRateModal()
    await flushPromises()

    wrapper.getComponent(UiAsyncEntityPicker).vm.$emit('search', 'alice')

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(350)

    expect(listUsers).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
