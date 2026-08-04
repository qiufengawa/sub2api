import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  listKeys: vi.fn(),
  listModels: vi.fn(),
  sendChat: vi.fn(),
  sendImage: vi.fn(),
  streamChat: vi.fn(),
}))

vi.mock('@/api/playground', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/playground')>(),
  playgroundAPI: apiMocks,
}))

import { isPlaygroundImageModel, usePlayground } from '@/composables/usePlayground'

type PlaygroundState = ReturnType<typeof usePlayground>
let wrapper: VueWrapper | null = null

function mountComposable(userId = 7): PlaygroundState {
  let state: PlaygroundState | undefined
  wrapper = mount(defineComponent({
    setup() {
      state = usePlayground(userId)
      return () => h('div')
    },
  }))
  return state as PlaygroundState
}

function activeKey(id = 1) {
  return {
    id,
    name: `Key ${id}`,
    status: 'active',
    group_id: 10,
    group_name: 'OpenAI',
    platform: 'openai',
  }
}

describe('usePlayground', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    apiMocks.listKeys.mockResolvedValue({ items: [activeKey()], truncated: false })
    apiMocks.listModels.mockResolvedValue([{ id: 'gpt-test' }])
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('isolates storage by user and sanitizes persisted values', () => {
    localStorage.setItem('playground.config.v1.7', JSON.stringify({
      keyId: 4,
      model: 'saved-model',
      stream: false,
      temperature: 99,
      top_p: Number.NaN,
      max_tokens: -1,
      parameterEnabled: { temperature: true, top_p: 'yes' },
      systemPrompt: 'must-not-load-from-local-storage',
    }))
    sessionStorage.setItem('playground.session.v1.7', JSON.stringify({
      systemPrompt: 'session prompt',
      messages: [{ id: 'm1', role: 'assistant', content: 'partial', status: 'streaming', createdAt: 1 }],
    }))
    localStorage.setItem('playground.config.v1.8', JSON.stringify({ keyId: 999 }))

    const state = mountComposable(7)
    expect(state.config.value.keyId).toBe(4)
    expect(state.config.value.systemPrompt).toBe('session prompt')
    expect(state.config.value.temperature).toBe(0.7)
    expect(state.config.value.top_p).toBe(1)
    expect(state.config.value.max_tokens).toBe(4096)
    expect(state.config.value.parameterEnabled.temperature).toBe(true)
    expect(state.config.value.parameterEnabled.top_p).toBe(false)
    expect(state.messages.value[0].status).toBe('stopped')
  })

  it('loads the persisted key and only keeps a model returned for that key', async () => {
    localStorage.setItem('playground.config.v1.7', JSON.stringify({ keyId: 1, model: 'missing-model' }))
    apiMocks.listModels.mockResolvedValue([{ id: 'gpt-b' }, { id: 'gpt-a' }, { id: 'gpt-a' }])
    const state = mountComposable()

    await state.loadKeys()

    expect(state.config.value.keyId).toBe(1)
    expect(state.models.value.map((item) => item.id)).toEqual(['gpt-a', 'gpt-b'])
    expect(state.config.value.model).toBe('gpt-a')
    expect(state.canSend.value).toBe(true)
  })

  it('detects GPT Image model ids without classifying unrelated chat models', () => {
    expect(isPlaygroundImageModel('gpt-image-2')).toBe(true)
    expect(isPlaygroundImageModel('openai/gpt-image-2')).toBe(true)
    expect(isPlaygroundImageModel('gpt-4.1')).toBe(false)
    expect(isPlaygroundImageModel('my-gpt-image-proxy')).toBe(false)
  })

  it('generates structured image messages and excludes image payloads from session storage', async () => {
    vi.useFakeTimers()
    apiMocks.listModels.mockResolvedValue([{ id: 'gpt-image-2' }])
    apiMocks.sendImage.mockResolvedValue({
      requestId: 'image-request-1',
      response: {
        created: 12,
        data: [{ b64_json: 'aGVsbG8=', revised_prompt: 'a refined prompt' }],
        usage: { input_tokens: 8, output_tokens: 12, total_tokens: 20 },
      },
    })
    const state = mountComposable()
    await state.loadKeys()
    state.config.value.imageSize = '1024x1536'
    state.config.value.imageQuality = 'high'
    state.config.value.imageFormat = 'png'
    state.config.value.imageCount = 1

    await state.submit('draw a lighthouse')

    expect(apiMocks.sendImage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        model: 'gpt-image-2',
        prompt: 'draw a lighthouse',
        size: '1024x1536',
        quality: 'high',
        output_format: 'png',
        response_format: 'b64_json',
      }),
      expect.any(AbortSignal),
    )
    const assistant = state.messages.value[1]
    expect(assistant.kind).toBe('image')
    expect(assistant.images?.[0]).toMatchObject({
      url: 'data:image/png;base64,aGVsbG8=',
      revisedPrompt: 'a refined prompt',
    })
    expect(assistant.requestId).toBe('image-request-1')

    await vi.advanceTimersByTimeAsync(250)
    expect(sessionStorage.getItem('playground.session.v1.7')).not.toContain('aGVsbG8=')
    expect(sessionStorage.getItem('playground.session.v1.7')).not.toContain('draw a lighthouse')
  })

  it('aborts an active image request and marks the result as stopped', async () => {
    apiMocks.listModels.mockResolvedValue([{ id: 'gpt-image-2' }])
    const state = mountComposable()
    await state.loadKeys()
    apiMocks.sendImage.mockImplementation((_keyId, _payload, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))

    const request = state.submit('draw a city')
    await nextTick()
    state.stop()
    await request

    expect(state.messages.value[1].status).toBe('stopped')
    expect(state.isGenerating.value).toBe(false)
  })

  it('shows the gateway error message nested in an image error envelope', async () => {
    apiMocks.listModels.mockResolvedValue([{ id: 'gpt-image-2' }])
    apiMocks.sendImage.mockRejectedValue({
      status: 403,
      error: { type: 'permission_error', message: 'Image generation is not enabled for this group' },
      message: 'Request failed with status code 403',
    })
    const state = mountComposable()
    await state.loadKeys()

    await state.submit('draw a city')

    expect(state.messages.value[1]).toMatchObject({
      status: 'error',
      error: 'Image generation is not enabled for this group',
    })
  })

  it('does not let a late model response overwrite a newer key selection', async () => {
    let resolveFirst!: (value: Array<{ id: string }>) => void
    let resolveSecond!: (value: Array<{ id: string }>) => void
    const first = new Promise<Array<{ id: string }>>((resolve) => { resolveFirst = resolve })
    const second = new Promise<Array<{ id: string }>>((resolve) => { resolveSecond = resolve })
    apiMocks.listModels.mockImplementation((keyId: number) => keyId === 1 ? first : second)
    const state = mountComposable()
    state.keys.value = [activeKey(1), activeKey(2)]

    const firstSelection = state.selectKey(1)
    const secondSelection = state.selectKey(2)
    resolveSecond([{ id: 'model-b' }])
    await secondSelection
    resolveFirst([{ id: 'model-a' }])
    await firstSelection

    expect(state.config.value.keyId).toBe(2)
    expect(state.models.value.map((item) => item.id)).toEqual(['model-b'])
    expect(state.config.value.model).toBe('model-b')
  })

  it('sends only enabled parameters and separates request and response ids', async () => {
    const state = mountComposable()
    await state.loadKeys()
    state.config.value.parameterEnabled.temperature = true
    state.config.value.parameterEnabled.top_p = false
    state.config.value.temperature = 0.4
    apiMocks.streamChat.mockImplementation(async (_keyId, _payload, handlers) => {
      handlers.onResponse?.({ requestId: 'request-1' })
      handlers.onUpdate({ content: 'answer', responseId: 'chatcmpl-1', finishReason: 'stop' })
      handlers.onComplete()
    })

    await state.submit('hello')

    const payload = apiMocks.streamChat.mock.calls[0][1]
    expect(payload).toMatchObject({ model: 'gpt-test', temperature: 0.4, stream: true })
    expect(payload).not.toHaveProperty('top_p')
    expect(payload).not.toHaveProperty('max_tokens')
    const assistant = state.messages.value[1]
    expect(assistant.content).toBe('answer')
    expect(assistant.requestId).toBe('request-1')
    expect(assistant.responseId).toBe('chatcmpl-1')
    expect(assistant.status).toBe('complete')
  })

  it('records first-token latency before render batching and calculates output speed from usage', async () => {
    const performanceNow = vi.fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(1100)
    vi.stubGlobal('performance', { now: performanceNow })
    const state = mountComposable()
    await state.loadKeys()
    apiMocks.streamChat.mockImplementation(async (_keyId, _payload, handlers) => {
      handlers.onUpdate({
        content: 'answer',
        receivedAtMonotonicMs: 300,
        usage: { prompt_tokens: 10, completion_tokens: 40, total_tokens: 50 },
      })
      handlers.onComplete()
    })

    await state.submit('hello')

    const assistant = state.messages.value[1]
    expect(assistant.requestStartedAt).toEqual(expect.any(Number))
    expect(assistant.firstTokenMs).toBe(200)
    expect(assistant.durationMs).toBe(1000)
    expect(assistant.tokensPerSecond).toBe(50)
  })

  it('does not fabricate first-token latency or generation speed for non-stream responses', async () => {
    const performanceNow = vi.fn()
      .mockReturnValueOnce(50)
      .mockReturnValueOnce(550)
    vi.stubGlobal('performance', { now: performanceNow })
    const state = mountComposable()
    await state.loadKeys()
    state.config.value.stream = false
    apiMocks.sendChat.mockResolvedValue({
      requestId: 'request-json',
      response: {
        id: 'response-json',
        model: 'gpt-test',
        choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    })

    await state.submit('hello')

    const assistant = state.messages.value[1]
    expect(assistant.durationMs).toBe(500)
    expect(assistant.firstTokenMs).toBeUndefined()
    expect(assistant.tokensPerSecond).toBeUndefined()
  })

  it('marks an aborted generation as stopped and ignores late chunks', async () => {
    const state = mountComposable()
    await state.loadKeys()
    let streamHandlers: any
    apiMocks.streamChat.mockImplementation((_keyId, _payload, handlers, signal: AbortSignal) => {
      streamHandlers = handlers
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      })
    })

    const request = state.submit('hello')
    await nextTick()
    state.stop()
    await request
    streamHandlers.onUpdate({ content: 'late' })
    streamHandlers.onComplete()

    const assistant = state.messages.value[1]
    expect(assistant.status).toBe('stopped')
    expect(assistant.content).toBe('')
    expect(state.isGenerating.value).toBe(false)
  })

  it('throttles streaming session writes instead of writing every token', async () => {
    vi.useFakeTimers()
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    const state = mountComposable()
    await state.loadKeys()
    apiMocks.streamChat.mockImplementation(async (_keyId, _payload, handlers) => {
      handlers.onUpdate({ content: 'a' })
      handlers.onUpdate({ content: 'b' })
      handlers.onUpdate({ content: 'c', finishReason: 'stop' })
      handlers.onComplete()
    })

    await state.submit('hello')
    await flushPromises()
    const sessionWritesBeforeTimer = storageSpy.mock.calls.filter(([key]) => String(key).includes('playground.session')).length
    expect(sessionWritesBeforeTimer).toBe(0)
    await vi.advanceTimersByTimeAsync(250)
    const sessionWritesAfterTimer = storageSpy.mock.calls.filter(([key]) => String(key).includes('playground.session')).length
    expect(sessionWritesAfterTimer).toBe(1)
  })
})
