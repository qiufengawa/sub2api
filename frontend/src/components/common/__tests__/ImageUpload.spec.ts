import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageUpload from '../ImageUpload.vue'

const { sanitizeSvgMock } = vi.hoisted(() => ({
  sanitizeSvgMock: vi.fn(() => '<svg data-sanitized="true"></svg>')
}))

vi.mock('@/utils/sanitize', () => ({
  sanitizeSvg: sanitizeSvgMock
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const originalFileReader = globalThis.FileReader

function mountUpload(props: Partial<InstanceType<typeof ImageUpload>['$props']> = {}) {
  return mount(ImageUpload, {
    props: {
      modelValue: '',
      ...props
    },
    global: {
      stubs: { Icon: true }
    }
  })
}

function setFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files
  })
}

function installFileReader(options: { dataUrl?: string; text?: string; fail?: boolean } = {}) {
  class MockFileReader {
    result: string | ArrayBuffer | null = null
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null

    readAsDataURL() {
      if (options.fail) {
        queueMicrotask(() => this.onerror?.call(this as unknown as FileReader, new ProgressEvent('error')))
        return
      }
      this.result = options.dataUrl ?? 'data:image/png;base64,cGl4ZWw='
      this.onload?.call(this as unknown as FileReader, {
        target: this
      } as unknown as ProgressEvent<FileReader>)
    }

    readAsText() {
      if (options.fail) {
        queueMicrotask(() => this.onerror?.call(this as unknown as FileReader, new ProgressEvent('error')))
        return
      }
      this.result = options.text ?? '<svg></svg>'
      this.onload?.call(this as unknown as FileReader, {
        target: this
      } as unknown as ProgressEvent<FileReader>)
    }
  }

  globalThis.FileReader = MockFileReader as unknown as typeof FileReader
}

afterEach(() => {
  globalThis.FileReader = originalFileReader
  sanitizeSvgMock.mockClear()
  vi.restoreAllMocks()
})

describe('ImageUpload', () => {
  it('opens the hidden native picker and exposes mode-specific accept values', async () => {
    const imageWrapper = mountUpload()
    const imageInput = imageWrapper.get('input[type="file"]')
    const clickSpy = vi.spyOn(imageInput.element as HTMLInputElement, 'click')

    expect(imageInput.attributes('accept')).toBe('image/*')
    await imageWrapper.get('button').trigger('click')
    expect(clickSpy).toHaveBeenCalledOnce()

    const svgWrapper = mountUpload({ mode: 'svg' })
    expect(svgWrapper.get('input[type="file"]').attributes('accept')).toBe('.svg')
  })

  it('rejects oversized and non-image files without emitting a value', async () => {
    const oversizedWrapper = mountUpload({ maxSize: 4 })
    const oversizedInput = oversizedWrapper.get('input[type="file"]')
    setFiles(oversizedInput.element as HTMLInputElement, [
      new File(['too large'], 'large.png', { type: 'image/png' })
    ])

    await oversizedInput.trigger('change')
    expect(oversizedWrapper.text()).toContain('common.fileTooLargeKb')
    expect(oversizedWrapper.emitted('update:modelValue')).toBeUndefined()

    const wrongTypeWrapper = mountUpload()
    const wrongTypeInput = wrongTypeWrapper.get('input[type="file"]')
    setFiles(wrongTypeInput.element as HTMLInputElement, [
      new File(['plain text'], 'notes.txt', { type: 'text/plain' })
    ])

    await wrongTypeInput.trigger('change')
    expect(wrongTypeWrapper.text()).toContain('common.selectImageFile')
    expect(wrongTypeWrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('reads an image data URL, renders its preview, and clears the value', async () => {
    const dataUrl = 'data:image/png;base64,cGl4ZWw='
    installFileReader({ dataUrl })
    const wrapper = mountUpload()
    const input = wrapper.get('input[type="file"]')
    setFiles(input.element as HTMLInputElement, [
      new File(['pixel'], 'pixel.png', { type: 'image/png' })
    ])

    await input.trigger('change')
    expect(wrapper.emitted('update:modelValue')).toEqual([[dataUrl]])

    await wrapper.setProps({ modelValue: dataUrl })
    expect(wrapper.get('img').attributes('src')).toBe(dataUrl)
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })

  it('trims uploaded SVG text and renders only the sanitizer result', async () => {
    const rawSvg = '  <svg><script>unsafe()</script></svg>  '
    installFileReader({ text: rawSvg })
    const wrapper = mountUpload({ mode: 'svg' })
    const input = wrapper.get('input[type="file"]')
    setFiles(input.element as HTMLInputElement, [
      new File([rawSvg], 'logo.svg', { type: 'image/svg+xml' })
    ])

    await input.trigger('change')
    expect(wrapper.emitted('update:modelValue')).toEqual([[rawSvg.trim()]])

    await wrapper.setProps({ modelValue: rawSvg.trim() })
    expect(sanitizeSvgMock).toHaveBeenLastCalledWith(rawSvg.trim())
    expect(wrapper.find('[data-sanitized="true"]').exists()).toBe(true)
    expect(wrapper.html()).not.toContain('unsafe()')
  })

  it('reports file-reader failures without emitting a value', async () => {
    installFileReader({ fail: true })
    const wrapper = mountUpload()
    const input = wrapper.get('input[type="file"]')
    setFiles(input.element as HTMLInputElement, [
      new File(['pixel'], 'pixel.png', { type: 'image/png' })
    ])

    await input.trigger('change')
    await Promise.resolve()
    expect(wrapper.text()).toContain('common.fileReadFailed')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
