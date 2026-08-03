import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

import PlanEditDialog from '../PlanEditDialog.vue'
import type { AdminGroup } from '@/types'
import type { SubscriptionPlan } from '@/types/payment'

const { createPlan, updatePlan, showError, showSuccess } = vi.hoisted(() => ({
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'payment.admin.subscriptionCnyPayPreview') return `preview ${params?.amount}`
      if (key === 'payment.admin.subscriptionCnyPayPreviewWithFee') return `fee ${params?.feeRate} ${params?.total}`
      if (key === 'payment.admin.confirmGroupRemovalAffected') return `affected ${params?.count}`
      return key
    },
  }),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showSuccess,
  }),
}))

vi.mock('@/api/admin/payment', () => ({
  adminPaymentAPI: {
    createPlan,
    updatePlan,
  },
}))

const BaseDialogStub = defineComponent({
  name: 'BaseDialog',
  props: {
    show: Boolean,
    title: String,
    width: String,
  },
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
})

const SelectStub = defineComponent({
  name: 'SelectStub',
  props: {
    modelValue: [String, Number],
    options: {
      type: Array,
      default: () => [],
    },
    placeholder: String,
  },
  emits: ['update:modelValue'],
  setup(_props, { emit }) {
    const onChange = (event: Event) => {
      const value = (event.target as HTMLSelectElement).value
      emit('update:modelValue', value === '' ? null : Number(value))
    }
    return { onChange }
  },
  template: `
    <select
      :value="modelValue ?? ''"
      @change="onChange"
    >
      <option value="">{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :data-platform="option.platform"
      >
        {{ option.label }}
      </option>
    </select>
  `,
})

const groupFixture = (overrides: Partial<AdminGroup>): AdminGroup => ({
  id: 1,
  name: 'OpenAI',
  description: null,
  platform: 'openai',
  rate_multiplier: 1,
  rpm_limit: 0,
  is_exclusive: false,
  status: 'active',
	  subscription_type: 'standard',
  daily_limit_usd: null,
  weekly_limit_usd: null,
  monthly_limit_usd: null,
  allow_image_generation: false,
  image_rate_independent: false,
  image_rate_multiplier: 1,
  image_price_1k: null,
  image_price_2k: null,
  image_price_4k: null,
  peak_rate_enabled: false,
  peak_start: '',
  peak_end: '',
  peak_rate_multiplier: 1,
  claude_code_only: false,
  fallback_group_id: null,
  fallback_group_id_on_invalid_request: null,
  allow_messages_dispatch: false,
  require_oauth_only: false,
  require_privacy_set: false,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  model_routing: null,
  model_routing_enabled: false,
  mcp_xml_inject: false,
  sort_order: 0,
  ...overrides,
})

function mountDialog({
  groups = [],
  paymentConfig = null,
  plan = null,
}: {
  groups?: AdminGroup[]
  paymentConfig?: Record<string, unknown> | null
  plan?: SubscriptionPlan | null
} = {}) {
  return mount(PlanEditDialog, {
    props: {
      show: true,
      plan,
      groups,
      paymentConfig,
    },
    global: {
      stubs: {
        BaseDialog: BaseDialogStub,
        Select: SelectStub,
        Icon: true,
        GroupBadge: true,
      },
    },
  })
}

describe('PlanEditDialog', () => {
  it('does not expose a separate primary-group field', () => {
    const wrapper = mountDialog()

    expect(wrapper.get('[data-testid="plan-primary-fields"]').text()).toContain('payment.admin.planName')
    expect(wrapper.text()).not.toContain('payment.admin.primaryGroup')
  })

  it('shows CNY channel charge using the configured subscription rate and fee', async () => {
    const wrapper = mountDialog({
      paymentConfig: {
        subscription_usd_to_cny_rate: 7.15,
        recharge_fee_rate: 2.5,
      },
    })

    await wrapper.find('input[type="number"]').setValue('9.99')

    expect(wrapper.text()).toContain('preview')
    expect(wrapper.text()).toContain('¥71.43')
    expect(wrapper.text()).toContain('fee 2.5')
    expect(wrapper.text()).toContain('¥73.22')
  })

  it('hides the preview when the subscription rate is not configured', async () => {
    const wrapper = mountDialog({
      paymentConfig: {
        subscription_usd_to_cny_rate: 0,
        recharge_fee_rate: 2.5,
      },
    })

    await wrapper.find('input[type="number"]').setValue('9.99')

    expect(wrapper.text()).not.toContain('preview')
    expect(wrapper.text()).not.toContain('¥71.43')
  })

	  it('only shows active standard routing groups as selectable choices', () => {
    const wrapper = mountDialog({
      groups: [
        groupFixture({
          id: 10,
          name: 'OpenAI + Claude + Gemini + Grok',
          platform: 'composite',
          rate_multiplier: 1.2,
          subscription_type: 'subscription',
        }),
		  groupFixture({
			id: 11,
			name: 'Standard OpenAI',
			platform: 'openai',
			subscription_type: 'standard',
		  }),
		  groupFixture({
			id: 12,
			name: 'Inactive OpenAI',
			platform: 'openai',
			subscription_type: 'standard',
			status: 'inactive',
		  }),
		],
	  })

	  const groupInputs = wrapper.findAll('[data-testid="plan-included-groups"] input[type="checkbox"]')
	  expect(groupInputs).toHaveLength(1)
    expect(groupInputs.every(input => input.attributes('disabled') === undefined)).toBe(true)
  })

  it('requires at least one applicable group', async () => {
    createPlan.mockClear()
    showError.mockClear()
    const wrapper = mountDialog()
    const vm = wrapper.vm as any
    Object.assign(vm.planForm, {
      name: 'Standard',
      description: 'Weekly credits',
      price: 103.9,
      validity_days: 28,
      validity_unit: 'days',
    })

    await wrapper.get('form').trigger('submit')

    expect(createPlan).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('payment.admin.groupRequired')
  })

  it('sends real included groups, cycle seconds, and wallet fallback in the create payload', async () => {
    createPlan.mockResolvedValue({})
    const groups = [
      groupFixture({ id: 10, name: 'Subscription', subscription_type: 'subscription' }),
      groupFixture({ id: 11, name: 'GPT-1', subscription_type: 'standard', rate_multiplier: 0.1 }),
    ]
    const wrapper = mountDialog({ groups })
    const vm = wrapper.vm as any
    Object.assign(vm.planForm, {
      name: 'Standard',
      included_group_ids: [10, 11],
		  five_hour_quota_usd: 5,
      cycle_quota_usd: 40,
      total_quota_usd: 160,
      reset_interval_days: 7,
      wallet_fallback_enabled: false,
      description: 'Weekly credits',
      price: 103.9,
      currency: ' cny ',
      validity_days: 28,
      validity_unit: 'days',
    })
    vm.planFeaturesText = 'First\n\n Second '

    await wrapper.get('form').trigger('submit')

		  expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({
			included_group_ids: [11],
			five_hour_quota_usd: 5,
      cycle_quota_usd: 40,
      total_quota_usd: 160,
      reset_interval_seconds: 604800,
      wallet_fallback_enabled: false,
      currency: 'CNY',
      features: 'First\nSecond',
    }))
    expect(createPlan.mock.calls[0][0]).not.toHaveProperty('group_id')
  })

	it('normalizes zero quota inputs to unlimited values', async () => {
		createPlan.mockReset().mockResolvedValue({})
		const wrapper = mountDialog({
			groups: [groupFixture({ id: 11, name: 'GPT-1', subscription_type: 'standard' })],
		})
		const vm = wrapper.vm as any
		Object.assign(vm.planForm, {
			name: 'Unlimited windows',
			included_group_ids: [11],
			five_hour_quota_usd: 0,
			cycle_quota_usd: 0,
			total_quota_usd: 0,
			reset_interval_days: 7,
			description: 'Unlimited quota dimensions',
			price: 10,
			validity_days: 30,
			validity_unit: 'days',
		})

		await wrapper.get('form').trigger('submit')

		expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({
			five_hour_quota_usd: null,
			cycle_quota_usd: null,
			total_quota_usd: null,
			reset_interval_seconds: 0,
		}))
	})

  it('preflights a covered-group removal and confirms with the affected subscription count', async () => {
	updatePlan.mockReset()
	updatePlan
	  .mockRejectedValueOnce({
		reason: 'PLAN_GROUP_REMOVAL_CONFIRMATION_REQUIRED',
		metadata: { affected_subscriptions: '23' },
	  })
	  .mockResolvedValueOnce({})
	  const groups = [
		groupFixture({ id: 10, name: 'GPT-1', subscription_type: 'standard' }),
		groupFixture({ id: 11, name: 'GPT-2', subscription_type: 'standard' }),
	  ]
	  const plan: SubscriptionPlan = {
		id: 99,
		name: 'Standard',
      description: 'Weekly credits',
      price: 103.9,
      currency: 'CNY',
      validity_days: 28,
      validity_unit: 'days',
      features: [],
      for_sale: true,
      sort_order: 0,
		included_groups: [
		  { id: 10, name: 'GPT-1', platform: 'openai', rate_multiplier: 0.1 },
		  { id: 11, name: 'GPT-2', platform: 'openai', rate_multiplier: 0.2 },
      ],
    }
    const wrapper = mountDialog({ groups, plan })
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })

    const includedInputs = wrapper.findAll('[data-testid="plan-included-groups"] input[type="checkbox"]')
    await includedInputs[0].setValue(false)
    await wrapper.get('form').trigger('submit')
	expect(updatePlan).toHaveBeenNthCalledWith(1, 99, expect.objectContaining({
	  included_group_ids: [11],
	  confirm_group_removal: false,
	}))
	expect(showError).toHaveBeenCalledWith('affected 23')
	expect(wrapper.text()).toContain('affected 23')

	await wrapper.get('form').trigger('submit')
	expect(updatePlan).toHaveBeenCalledTimes(1)
	expect(showError).toHaveBeenCalledWith('payment.admin.confirmGroupRemovalRequired')

    const confirmation = wrapper.findAll('input[type="checkbox"]').at(-1)
    expect(confirmation).toBeDefined()
    await confirmation!.setValue(true)
	await wrapper.get('form').trigger('submit')
	expect(updatePlan).toHaveBeenNthCalledWith(2, 99, expect.objectContaining({
      included_group_ids: [11],
      confirm_group_removal: true,
    }))
  })
})
