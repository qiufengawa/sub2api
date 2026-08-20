import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TotpStepUpDialog from '@/components/auth/TotpStepUpDialog.vue'

const { stepUpMock, showErrorMock } = vi.hoisted(() => ({
  stepUpMock: vi.fn(),
  showErrorMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/api', () => ({
  totpAPI: {
    stepUp: (...args: unknown[]) => stepUpMock(...args)
  }
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showError: (...args: unknown[]) => showErrorMock(...args)
  })
}))

const DialogStub = defineComponent({
  emits: ['close'],
  setup(_, { emit, slots }) {
    return () => h('section', { 'data-testid': 'dialog' }, [
      slots.default?.(),
      slots.footer?.(),
      h('button', {
        type: 'button',
        'data-testid': 'dialog-close',
        onClick: () => emit('close')
      })
    ])
  }
})

function makeController() {
  return {
    visible: ref(true),
    blockedReason: ref(''),
    prompt: vi.fn(),
    onVerified: vi.fn(),
    onCancel: vi.fn(),
    run: vi.fn()
  }
}

function mountDialog(controller = makeController()) {
  return {
    controller,
    wrapper: mount(TotpStepUpDialog, {
      props: { controller },
      global: {
        stubs: {
          UiDialog: DialogStub,
          Icon: true
        }
      }
    })
  }
}

async function enterCode(wrapper: VueWrapper, code: string) {
  const cells = wrapper.findAll('.auth-totp__cell')
  for (const [index, digit] of [...code].entries()) {
    await cells[index].setValue(digit)
  }
  await flushPromises()
}

describe('TotpStepUpDialog', () => {
  beforeEach(() => {
    stepUpMock.mockReset()
    showErrorMock.mockReset()
  })

  it('submits once after six digits and completes the controller', async () => {
    stepUpMock.mockResolvedValue({})
    const { controller, wrapper } = mountDialog()
    expect(wrapper.get('.auth-totp__cells').attributes('role')).toBe('group')
    expect(wrapper.findAll('.auth-totp__cell')[0].attributes('aria-label')).toBe('stepUp.title 1')

    await enterCode(wrapper, '123456')

    expect(stepUpMock).toHaveBeenCalledTimes(1)
    expect(stepUpMock).toHaveBeenCalledWith('123456')
    expect(controller.onVerified).toHaveBeenCalledTimes(1)
    expect(showErrorMock).not.toHaveBeenCalled()
  })

  it('keeps the dialog retryable after verification failure', async () => {
    stepUpMock.mockRejectedValueOnce(new Error('Invalid code'))
    const { controller, wrapper } = mountDialog()

    await enterCode(wrapper, '654321')

    expect(controller.onVerified).not.toHaveBeenCalled()
    expect(showErrorMock).toHaveBeenCalledWith('Invalid code')
    expect(wrapper.findAll('.auth-totp__cell').every((cell) => !cell.attributes('disabled'))).toBe(true)
  })

  it('cancels from the dialog close event when no verification is running', async () => {
    const { controller, wrapper } = mountDialog()

    await wrapper.get('[data-testid="dialog-close"]').trigger('click')

    expect(controller.onCancel).toHaveBeenCalledTimes(1)
  })

  it('ignores close requests while verification is running', async () => {
    let resolveStepUp!: () => void
    stepUpMock.mockImplementation(() => new Promise<void>((resolve) => {
      resolveStepUp = resolve
    }))
    const { controller, wrapper } = mountDialog()

    await enterCode(wrapper, '123456')
    await wrapper.get('[data-testid="dialog-close"]').trigger('click')
    expect(controller.onCancel).not.toHaveBeenCalled()

    resolveStepUp()
    await flushPromises()
  })
})
