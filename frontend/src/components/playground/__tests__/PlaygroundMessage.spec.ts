import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PlaygroundMessage from '../PlaygroundMessage.vue'
import { useAppStore } from '@/stores/app'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const assistantMessage = (content: string) => ({
  id: 'message-1',
  role: 'assistant' as const,
  content,
  status: 'complete' as const,
  createdAt: 1,
})

describe('PlaygroundMessage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sanitizes active content and hardens safe external links', async () => {
    const wrapper = mount(PlaygroundMessage, {
      props: {
        message: assistantMessage('[safe](https://example.com) [bad](javascript:alert(1)) <img src=x onerror="alert(1)"><svg onload="alert(1)"></svg>'),
      },
    })
    await flushPromises()
    const html = wrapper.find('.playground-markdown').html()
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('javascript:')
    const safe = wrapper.find('a[href="https://example.com"]')
    expect(safe.attributes('target')).toBe('_blank')
    expect(safe.attributes('rel')).toBe('noopener noreferrer')
  })

  it('reports clipboard permission failures without an unhandled rejection', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const appStore = useAppStore()
    const wrapper = mount(PlaygroundMessage, {
      props: { message: assistantMessage('copy me') },
    })

    await wrapper.find('button[aria-label="playground.actions.copy"]').trigger('click')
    await flushPromises()

    expect(appStore.toasts.at(-1)?.type).toBe('error')
    expect(appStore.toasts.at(-1)?.message).toBe('playground.errors.clipboard')
  })

  it('labels request and response ids independently', () => {
    const wrapper = mount(PlaygroundMessage, {
      props: {
        message: {
          ...assistantMessage('done'),
          requestId: 'request-1',
          responseId: 'chatcmpl-1',
        },
      },
    })
    expect(wrapper.text()).toContain('request-1')
    expect(wrapper.text()).toContain('chatcmpl-1')
    expect(wrapper.text()).toContain('playground.message.requestId')
    expect(wrapper.text()).toContain('playground.message.responseId')
  })

  it('shows the model, first-token latency, duration, speed, timestamp, and token breakdown', () => {
    const wrapper = mount(PlaygroundMessage, {
      props: {
        message: {
          ...assistantMessage('done'),
          model: 'provider/a-very-long-model-id',
          requestStartedAt: new Date(2026, 7, 4, 9, 36, 21).getTime(),
          firstTokenMs: 800,
          durationMs: 2000,
          tokensPerSecond: 20,
          usage: { prompt_tokens: 1200, completion_tokens: 40, total_tokens: 1240 },
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('provider/a-very-long-model-id')
    expect(text).toContain('800ms')
    expect(text).toContain('2.00s')
    expect(text).toContain('20.0 tok/s')
    expect(text).toContain('2026-08-04 09:36:21')
    expect(text).toContain('1,200')
    expect(text).toContain('40')
    expect(text).toContain('1,240')
    expect(wrapper.findAll('code').filter((node) => node.attributes('title') === 'provider/a-very-long-model-id')).toHaveLength(2)
  })

  it('shows unavailable timing values without estimating them', () => {
    const wrapper = mount(PlaygroundMessage, {
      props: { message: assistantMessage('done') },
    })

    expect(wrapper.text().match(/playground\.message\.unavailable/g)).toHaveLength(4)
  })

  it('renders image results, opens a preview, and downloads without exposing unsafe markup', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(PlaygroundMessage, {
      attachTo: document.body,
      props: {
        message: {
          ...assistantMessage(''),
          kind: 'image',
          model: 'gpt-image-2',
          imageSize: '1024x1024',
          imageFormat: 'png',
          images: [{
            id: 'image-1',
            url: 'data:image/png;base64,aGVsbG8=',
            mimeType: 'image/png',
            revisedPrompt: 'refined',
          }],
        },
      },
    })

    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,aGVsbG8=')
    await wrapper.get('button[aria-label="playground.image.preview"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('playground.image.previewTitle')

    await wrapper.get('button[aria-label="playground.image.download"]').trigger('click')
    expect(clickSpy).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('downloads a remote image through a local blob URL when CORS allows it', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' }), { status: 200 }))
    const createObjectURL = vi.fn().mockReturnValue('blob:playground-image')
    const revokeObjectURL = vi.fn()
    class MockURL extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    }
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', MockURL)
    const wrapper = mount(PlaygroundMessage, {
      props: {
        message: {
          ...assistantMessage(''),
          kind: 'image',
          imageFormat: 'png',
          images: [{
            id: 'image-remote',
            url: 'https://cdn.example.com/result.png',
            sourceUrl: 'https://cdn.example.com/result.png',
            mimeType: 'image/png',
          }],
        },
      },
    })

    await wrapper.get('button[aria-label="playground.image.download"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/result.png', { credentials: 'omit' })
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
