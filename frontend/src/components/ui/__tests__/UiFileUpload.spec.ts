import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import UiFileUpload from '../UiFileUpload.vue'

describe('UiFileUpload', () => {
  it('resets the native input after emitting selected files', async () => {
    const wrapper = mount(UiFileUpload, { props: { label: 'Upload' } })
    const input = wrapper.get('input[type="file"]')
    const file = new File(['{}'], 'config.json', { type: 'application/json' })

    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    Object.defineProperty(input.element, 'value', { configurable: true, writable: true, value: 'config.json' })
    await input.trigger('change')

    expect(wrapper.emitted('select')).toEqual([[[file]]])
    expect((input.element as HTMLInputElement).value).toBe('')
  })
})
