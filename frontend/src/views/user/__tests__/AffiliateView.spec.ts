import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AffiliateView from '../AffiliateView.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const { copyToClipboard, getAffiliateDetail, transferAffiliateQuota } = vi.hoisted(() => ({
  copyToClipboard: vi.fn(),
  getAffiliateDetail: vi.fn(),
  transferAffiliateQuota: vi.fn(),
}))

vi.mock('@/api/user', () => ({
  default: {
    getAffiliateDetail,
    transferAffiliateQuota,
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    refreshUser: vi.fn(),
  }),
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params?.amount ? `${key} ${String(params.amount)}` : key,
    }),
  }
})

describe('AffiliateView', () => {
  const affiliateCode = 'affiliate-code-that-is-long-enough-to-overflow-a-mobile-viewport'

  beforeEach(() => {
    vi.clearAllMocks()
    copyToClipboard.mockResolvedValue(true)
    getAffiliateDetail.mockResolvedValue({
      user_id: 1,
      aff_code: affiliateCode,
      inviter_id: null,
      aff_count: 0,
      aff_quota: 0,
      aff_frozen_quota: 0,
      aff_history_quota: 0,
      effective_rebate_rate_percent: 10,
      invitees: [],
    })
  })

  it('keeps long values truncated in one workspace while copying the complete values', async () => {
    const wrapper = mount(AffiliateView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })

    await flushPromises()

    const values = wrapper.findAll('code')
    expect(values).toHaveLength(2)
    for (const value of values) {
      expect(value.classes()).toEqual(expect.arrayContaining([
        'min-w-0',
        'truncate',
      ]))
      expect(value.attributes('title')).toBe(value.text())
    }

    expect(wrapper.findAll('[data-testid="affiliate-workspace"]')).toHaveLength(1)

    const copyButtons = wrapper.findAll('button').filter((button) =>
      ['affiliate.copyCode', 'affiliate.copyLink'].includes(button.text()),
    )
    expect(copyButtons).toHaveLength(2)
    for (const button of copyButtons) {
      expect(button.classes()).toEqual(expect.arrayContaining([
        'shrink-0',
      ]))
    }

    await copyButtons[0].trigger('click')
    await copyButtons[1].trigger('click')
    await flushPromises()

    expect(copyToClipboard).toHaveBeenNthCalledWith(1, affiliateCode, 'affiliate.codeCopied')
    expect(copyToClipboard).toHaveBeenNthCalledWith(
      2,
      `${window.location.origin}/register?aff=${encodeURIComponent(affiliateCode)}`,
      'affiliate.linkCopied',
    )
  })

  it('requires a second confirmation before transferring rebate quota', async () => {
    getAffiliateDetail.mockResolvedValue({
      user_id: 1,
      aff_code: affiliateCode,
      inviter_id: null,
      aff_count: 2,
      aff_quota: 25,
      aff_frozen_quota: 0,
      aff_history_quota: 50,
      effective_rebate_rate_percent: 10,
      invitees: [],
    })
    transferAffiliateQuota.mockResolvedValue({ transferred_quota: 25 })

    const wrapper = mount(AffiliateView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
          BaseDialog: {
            props: ['show'],
            template: '<div v-if="show"><slot /><slot name="footer" /></div>',
          },
        },
      },
    })
    await flushPromises()

    const transferButton = wrapper.findAll('button').find((button) =>
      button.text().includes('affiliate.transfer.button'),
    )
    expect(transferButton).toBeDefined()
    await transferButton!.trigger('click')

    const dialog = wrapper.findComponent(ConfirmDialog)
    expect(dialog.props('show')).toBe(true)
    expect(dialog.props('danger')).toBe(true)
    expect(dialog.props('message')).toContain('$25.00')
    expect(transferAffiliateQuota).not.toHaveBeenCalled()

    dialog.vm.$emit('confirm')
    await flushPromises()

    expect(transferAffiliateQuota).toHaveBeenCalledTimes(1)
  })

  it('keeps the confirmation pending and blocks duplicate transfers until the request settles', async () => {
    getAffiliateDetail.mockResolvedValue({
      user_id: 1,
      aff_code: affiliateCode,
      inviter_id: null,
      aff_count: 2,
      aff_quota: 25,
      aff_frozen_quota: 0,
      aff_history_quota: 50,
      effective_rebate_rate_percent: 10,
      invitees: [],
    })
    let resolveTransfer!: (value: { transferred_quota: number }) => void
    transferAffiliateQuota.mockReturnValue(new Promise((resolve) => {
      resolveTransfer = resolve
    }))

    const wrapper = mount(AffiliateView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
          BaseDialog: {
            props: ['show'],
            template: '<div v-if="show"><slot /><slot name="footer" /></div>',
          },
        },
      },
    })
    await flushPromises()

    const transferButton = wrapper.findAll('button').find((button) =>
      button.text().includes('affiliate.transfer.button'),
    )
    await transferButton!.trigger('click')
    const dialog = wrapper.findComponent(ConfirmDialog)
    dialog.vm.$emit('confirm')
    dialog.vm.$emit('confirm')
    await flushPromises()

    expect(dialog.props('show')).toBe(true)
    expect(dialog.props('pending')).toBe(true)
    expect(transferAffiliateQuota).toHaveBeenCalledTimes(1)

    resolveTransfer({ transferred_quota: 25 })
    await flushPromises()
    expect(dialog.props('show')).toBe(false)
  })
})
