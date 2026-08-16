import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthFormPanel from '../AuthFormPanel.vue'
import AuthTextField from '../AuthTextField.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('shared authentication form components', () => {
  it('renders the shared heading structure', () => {
    const wrapper = mount(AuthFormPanel, {
      props: { title: 'Welcome', subtitle: 'Continue to your account' }
    })

    expect(wrapper.get('.auth-form-panel__heading h1').text()).toBe('Welcome')
    expect(wrapper.get('.auth-form-panel__heading p').text()).toBe('Continue to your account')
  })

  it('emits field input and reveals passwords without page-specific controls', async () => {
    const wrapper = mount(AuthTextField, {
      props: {
        id: 'password',
        modelValue: '',
        label: 'Password',
        icon: 'lock',
        type: 'password',
        revealable: true
      },
      global: {
        stubs: { Icon: true }
      }
    })

    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('password')
    await input.setValue('secret')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['secret'])

    await wrapper.get('.auth-text-field__toggle').trigger('click')
    expect(input.attributes('type')).toBe('text')
  })

  it('does not reserve metadata space unless requested', () => {
    const wrapper = mount(AuthTextField, {
      props: {
        id: 'email',
        modelValue: '',
        label: 'Email',
        icon: 'mail'
      },
      slots: { meta: '<a>Forgot password</a>' },
      global: {
        stubs: { Icon: true }
      }
    })

    expect(wrapper.find('.auth-text-field__meta').exists()).toBe(false)
  })

  it('exposes optional field guidance without rendering a persistent hint row', () => {
    const wrapper = mount(AuthTextField, {
      props: {
        id: 'password',
        modelValue: '',
        label: 'Password',
        icon: 'lock',
        helpText: 'At least 6 characters'
      },
      global: {
        stubs: { Icon: true }
      }
    })

    expect(wrapper.get('.ui-field-help').attributes('aria-label')).toBe('At least 6 characters')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    expect(wrapper.find('.auth-text-field__hint').exists()).toBe(false)
  })

  it('forwards authentication field semantics and keyboard submission', async () => {
    const wrapper = mount(AuthTextField, {
      props: {
        id: 'verification-code',
        testId: 'verification-code',
        modelValue: '',
        label: 'Verification code',
        description: 'Enter the six digit code',
        icon: 'key',
        inputmode: 'numeric',
        maxlength: 6,
        monospace: true,
        textAlign: 'center',
        error: true,
        errorMessage: 'Code is required'
      },
      global: {
        stubs: { Icon: true }
      }
    })

    const input = wrapper.get('input')
    expect(input.attributes('data-testid')).toBe('verification-code')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('maxlength')).toBe('6')
    expect(input.classes()).toContain('ui-text-input--mono')
    expect(input.classes()).toContain('ui-text-input--center')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Code is required')

    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('enter')).toHaveLength(1)
  })
})
