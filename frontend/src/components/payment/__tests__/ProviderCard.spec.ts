import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProviderCard from '@/components/payment/ProviderCard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('ProviderCard shared actions', () => {
  const provider = {
    id: 1,
    provider_key: 'stripe',
    name: 'Stripe',
    config: {},
    supported_types: ['stripe'],
    enabled: true,
    payment_mode: '',
    refund_enabled: false,
    allow_user_refund: false,
    limits: '',
    sort_order: 0,
  }

  it('keeps type selection semantics and emits shared edit/delete actions', async () => {
    const wrapper = mount(ProviderCard, {
      props: {
        provider,
        enabled: true,
        availableTypes: [
          { value: 'stripe', label: 'Stripe' },
          { value: 'card', label: 'Card' },
        ],
      },
      global: {
        stubs: {
          Icon: true,
          ToggleSwitch: true,
        },
      },
    })

    const typeButtons = wrapper.findAll('button[aria-pressed]')
    expect(typeButtons).toHaveLength(2)
    expect(typeButtons[0].attributes('aria-pressed')).toBe('true')
    expect(typeButtons[1].attributes('aria-pressed')).toBe('false')

    await typeButtons[1].trigger('click')
    expect(wrapper.emitted('toggleType')).toEqual([['card']])

    const edit = wrapper.get('button.ui-button--quiet')
    const remove = wrapper.get('button.ui-button--danger')
    await edit.trigger('click')
    await remove.trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('names provider switches with the provider identity for screen readers', () => {
    const wrapper = mount(ProviderCard, {
      props: {
        provider: { ...provider, refund_enabled: true, allow_user_refund: true },
        enabled: true,
        availableTypes: [],
      },
      global: {
        stubs: {
          Icon: true,
          ToggleSwitch: {
            props: ['label', 'accessibleLabel', 'checked'],
            template: '<button class="provider-toggle" :aria-label="accessibleLabel" />',
          },
        },
      },
    })

    expect(wrapper.findAll('.provider-toggle').map((toggle) => toggle.attributes('aria-label'))).toEqual([
      'Stripe: common.enabled',
      'Stripe: admin.settings.payment.refundEnabled',
      'Stripe: admin.settings.payment.allowUserRefund',
    ])
  })

  it('locks provider controls while a field or type mutation is pending', () => {
    const wrapper = mount(ProviderCard, {
      props: {
        provider: { ...provider, refund_enabled: true, allow_user_refund: true },
        enabled: true,
        pending: true,
        availableTypes: [{ value: 'stripe', label: 'Stripe' }],
      },
      global: {
        stubs: {
          Icon: true,
          ToggleSwitch: {
            props: ['label', 'accessibleLabel', 'checked', 'disabled'],
            template: '<button class="provider-toggle" :disabled="disabled" />',
          },
        },
      },
    })

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.findAll('.provider-toggle').every((toggle) => toggle.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('button[aria-pressed]').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.get('button.ui-button--quiet').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.ui-button--danger').attributes('disabled')).toBeDefined()
  })
})
