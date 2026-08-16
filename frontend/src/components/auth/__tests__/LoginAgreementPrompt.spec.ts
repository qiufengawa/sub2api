import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginAgreementPrompt from '../LoginAgreementPrompt.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const documents = [
  { id: 'terms', title: 'Terms of Service' },
  { id: 'privacy', title: 'Privacy Policy' }
]

function mountPrompt(props: Partial<InstanceType<typeof LoginAgreementPrompt>['$props']> = {}) {
  return mount(LoginAgreementPrompt, {
    props: {
      accepted: false,
      documents,
      mode: 'modal',
      visible: false,
      ...props
    },
    global: {
      stubs: {
        Icon: true,
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>'
        },
        Teleport: true
      }
    }
  })
}

describe('LoginAgreementPrompt', () => {
  it('uses the shared checkbox and emits the consent decision', async () => {
    const wrapper = mountPrompt({ mode: 'checkbox' })
    const checkbox = wrapper.get('input[type="checkbox"]')

    await checkbox.setValue(true)
    await checkbox.setValue(false)

    expect(wrapper.emitted('accept')).toHaveLength(1)
    expect(wrapper.emitted('reject')).toHaveLength(1)
  })

  it('opens the shared dialog and preserves accept and reject actions', async () => {
    const wrapper = mountPrompt({ visible: true, updatedAt: '2026-08-14' })
    const buttons = wrapper.findAll('button')
    const acceptButton = buttons.find((button) => button.text().includes('accept'))
    const rejectButton = buttons.find((button) => button.text().includes('reject'))

    expect(wrapper.get('[role="dialog"]').text()).toContain('2026-08-14')
    expect(wrapper.findAll('.agreement-document')).toHaveLength(2)

    await acceptButton?.trigger('click')
    await rejectButton?.trigger('click')

    expect(wrapper.emitted('accept')).toHaveLength(1)
    expect(wrapper.emitted('reject')).toHaveLength(1)
  })
})
