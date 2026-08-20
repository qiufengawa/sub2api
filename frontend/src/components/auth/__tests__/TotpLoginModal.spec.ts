import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TotpLoginModal from '@/components/auth/TotpLoginModal.vue'

const { showErrorMock } = vi.hoisted(() => ({
  showErrorMock: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showError: (...args: any[]) => showErrorMock(...args),
  }),
}))

const DialogStub = defineComponent({
  emits: ['close'],
  setup(_, { slots }) {
    return () => h('section', { 'data-testid': 'dialog' }, [slots.default?.(), slots.footer?.()])
  }
})

function mountDialog() {
  return mount(TotpLoginModal, {
    props: {
      tempToken: 'temp-token',
      userEmailMasked: 'u***@example.com',
    },
    global: {
      stubs: {
        UiDialog: DialogStub,
        Icon: true,
      },
    },
    attachTo: document.body,
  })
}

describe('TotpLoginModal', () => {
  beforeEach(() => {
    showErrorMock.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('sends verification errors to toast and does not render inline red text', async () => {
    const wrapper = mountDialog()
    expect(wrapper.get('.auth-totp__cells').attributes('role')).toBe('group')
    expect(wrapper.findAll('.auth-totp__cell')[0].attributes('aria-label')).toBe('profile.totp.enterCode 1')

    ;(wrapper.vm as unknown as { setError: (message: string) => void }).setError('Invalid code')
    await wrapper.vm.$nextTick()

    expect(showErrorMock).toHaveBeenCalledWith('Invalid code')
    expect(wrapper.text()).not.toContain('Invalid code')
    expect(wrapper.find('.bg-red-50').exists()).toBe(false)
    expect(wrapper.findAll('.auth-totp__cell').every((cell) => cell.element.value === '')).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('.auth-totp__cell').element)
  })

  it('auto-submits exactly once after six sanitized cell values', async () => {
    const wrapper = mountDialog()
    const cells = wrapper.findAll('.auth-totp__cell')

    for (const [index, value] of ['1a', '2', '3', '4', '5', '6'].entries()) {
      await cells[index].setValue(value)
    }
    await flushPromises()

    expect(wrapper.emitted('verify')).toEqual([['123456']])
    expect(wrapper.emitted('verify')).toHaveLength(1)
  })

  it('fills six cells from one-time-code autofill and paste, then focuses the next cell', async () => {
    const wrapper = mountDialog()
    const cells = wrapper.findAll('.auth-totp__cell')
    const hidden = wrapper.get('input[autocomplete="one-time-code"]')

    await hidden.setValue('a1-2b3456')
    expect(cells.map((cell) => cell.element.value)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(wrapper.emitted('verify')).toEqual([['123456']])

    await cells[0].trigger('paste', {
      clipboardData: { getData: () => '9x8-7' },
    })
    await wrapper.vm.$nextTick()
    expect(cells.map((cell) => cell.element.value)).toEqual(['9', '8', '7', '', '', ''])
    expect(document.activeElement).toBe(cells[3].element)
  })

  it('moves focus back on empty-cell Backspace and blocks verification while pending', async () => {
    const wrapper = mountDialog()
    const cells = wrapper.findAll('.auth-totp__cell')

    await cells[1].setValue('4')
    await cells[2].trigger('keydown', { key: 'Backspace' })
    expect(document.activeElement).toBe(cells[1].element)

    ;(wrapper.vm as unknown as { setVerifying: (value: boolean) => void }).setVerifying(true)
    for (const [index, value] of ['1', '2', '3', '4', '5', '6'].entries()) {
      await cells[index].setValue(value)
    }
    await flushPromises()
    expect(wrapper.emitted('verify')).toBeUndefined()
    expect(cells.every((cell) => cell.attributes('disabled') !== undefined)).toBe(true)
  })
})
