import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaygroundRequestPreview from '../PlaygroundRequestPreview.vue'

const appStoreMocks = vi.hoisted(() => ({ showError: vi.fn() }))

vi.mock('@/stores/app', () => ({ useAppStore: () => appStoreMocks }))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

describe('PlaygroundRequestPreview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the request in the shared code block and forwards close', async () => {
    const wrapper = mount(PlaygroundRequestPreview, {
      props: { show: true, content: '{\n  "model": "gpt-test"\n}' },
      global: {
        stubs: {
          UiDialog: {
            name: 'UiDialog',
            props: ['show', 'title', 'width'],
            emits: ['close'],
            template: '<section data-test="dialog"><slot /></section>',
          },
          UiCodeBlock: {
            name: 'UiCodeBlock',
            props: ['code', 'label', 'copyLabel', 'copySuccessText'],
            emits: ['copyError'],
            template: '<pre data-test="code">{{ code }}</pre>',
          },
        },
      },
    })

    const dialog = wrapper.getComponent({ name: 'UiDialog' })
    const code = wrapper.getComponent({ name: 'UiCodeBlock' })
    expect(dialog.props()).toMatchObject({ show: true, title: 'playground.preview.title', width: 'wide' })
    expect(code.props()).toMatchObject({
      code: '{\n  "model": "gpt-test"\n}',
      label: 'JSON',
      copyLabel: 'playground.actions.copy',
      copySuccessText: 'playground.actions.copied',
    })

    code.vm.$emit('copyError', new Error('denied'))
    expect(appStoreMocks.showError).toHaveBeenCalledWith('playground.errors.clipboard')

    dialog.vm.$emit('close')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
