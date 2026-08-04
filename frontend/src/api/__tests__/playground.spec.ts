import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clientMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  apiClient: {
    get: clientMocks.get,
    post: clientMocks.post,
  },
  refreshAccessToken: clientMocks.refreshAccessToken,
}))

vi.mock('@/api/url', () => ({ buildApiUrl: (path: string) => `/api/v1${path}` }))
vi.mock('@/i18n', () => ({ getLocale: () => 'zh-CN' }))

import {
  PlaygroundStreamInterruptedError,
  SSEDataDecoder,
  listPlaygroundKeys,
  listPlaygroundModels,
  normalizePlaygroundImageAssets,
  sendPlaygroundChat,
  sendPlaygroundImage,
  streamPlaygroundChat,
} from '@/api/playground'

function streamResponse(chunks: string[], options: { status?: number; requestId?: string; onCancel?: () => void } = {}): Response {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
    cancel() {
      options.onCancel?.()
    },
  }), {
    status: options.status ?? 200,
    headers: {
      'Content-Type': 'text/event-stream',
      ...(options.requestId ? { 'X-Request-ID': options.requestId } : {}),
    },
  })
}

describe('Playground API', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('decodes split CRLF events, comments, and multiple data lines', () => {
    const decoder = new SSEDataDecoder()
    expect(decoder.push(': ping\r\nda')).toEqual([])
    expect(decoder.push('ta: first\r\ndata: second\r\n\r\n')).toEqual(['first\nsecond'])
    expect(decoder.push('data: tail')).toEqual([])
    expect(decoder.finish()).toEqual(['tail'])
  })

  it('uses the bounded key-list response contract', async () => {
    clientMocks.get.mockResolvedValue({ data: { items: [{ id: 1, name: 'Key' }], truncated: true } })
    await expect(listPlaygroundKeys()).resolves.toEqual({ items: [{ id: 1, name: 'Key' }], truncated: true })
  })

  it('normalizes the model-list response and missing data', async () => {
    clientMocks.get
      .mockResolvedValueOnce({ data: { data: [{ id: 'gpt-test' }] } })
      .mockResolvedValueOnce({ data: { object: 'list' } })

    await expect(listPlaygroundModels(7)).resolves.toEqual([{ id: 'gpt-test' }])
    await expect(listPlaygroundModels(7)).resolves.toEqual([])
    expect(clientMocks.get).toHaveBeenNthCalledWith(1, '/playground/keys/7/models')
  })

  it('keeps the response id separate from the request id for JSON responses', async () => {
    clientMocks.post.mockResolvedValue({
      data: { id: 'chatcmpl-response', choices: [] },
      headers: { 'x-request-id': 'request-123' },
    })
    const result = await sendPlaygroundChat(3, { model: 'model', messages: [], stream: false })
    expect(result.requestId).toBe('request-123')
    expect(result.response.id).toBe('chatcmpl-response')
    expect(clientMocks.post.mock.calls[0][2].headers['X-Request-ID']).toBeTruthy()
  })

  it('sends image requests through the protected Playground endpoint', async () => {
    localStorage.setItem('auth_token', 'access-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      created: 1,
      data: [{ url: 'https://cdn.example.com/image.png' }],
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': 'image-request-1',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const payload = {
      model: 'gpt-image-2',
      prompt: 'a quiet workspace',
      n: 2,
      size: '1536x1024' as const,
      quality: 'high' as const,
      output_format: 'webp' as const,
      response_format: 'b64_json' as const,
    }

    const result = await sendPlaygroundImage(9, payload)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    const headers = new Headers(init.headers)
    expect(url).toBe('/api/v1/playground/keys/9/images/generations')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(init).not.toHaveProperty('timeout')
    expect(JSON.parse(String(init.body))).toEqual(payload)
    expect(headers.get('Authorization')).toBe('Bearer access-token')
    expect(headers.get('X-User-UI-Request')).toBe('1')
    expect(headers.get('X-Request-ID')).toBeTruthy()
    expect(result.requestId).toBe('image-request-1')
  })

  it('preserves structured image gateway errors instead of reporting a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { type: 'permission_error', message: 'Image generation is not enabled for this group' },
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(sendPlaygroundImage(9, {
      model: 'gpt-image-2',
      prompt: 'a quiet workspace',
      n: 1,
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      response_format: 'b64_json',
    })).rejects.toThrow('Image generation is not enabled for this group')
  })

  it('keeps slow image generation alive beyond 30 seconds but still has a bounded deadline', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const request = sendPlaygroundImage(9, {
      model: 'gpt-image-2',
      prompt: 'a quiet workspace',
      n: 1,
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      response_format: 'b64_json',
    })
    const rejection = expect(request).rejects.toMatchObject({ name: 'TimeoutError' })
    await Promise.resolve()

    const requestSignal = fetchMock.mock.calls[0][1]?.signal as AbortSignal
    await vi.advanceTimersByTimeAsync(30_000)
    expect(requestSignal.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(30 * 60_000 + 30_000)
    expect(requestSignal.aborted).toBe(true)
    await rejection
  })

  it('accepts safe image assets and rejects unsafe or malformed sources', () => {
    const assets = normalizePlaygroundImageAssets({
      created: 7,
      data: [
        { url: 'https://cdn.example.com/result.png', revised_prompt: 'refined prompt' },
        { b64_json: 'aGVsbG8=' },
        { url: 'javascript:alert(1)' },
        { url: 'data:image/svg+xml;base64,PHN2Zz4=' },
        { b64_json: 'not valid base64!' },
      ],
    }, 'png')

    expect(assets).toHaveLength(2)
    expect(assets[0]).toMatchObject({
      url: 'https://cdn.example.com/result.png',
      sourceUrl: 'https://cdn.example.com/result.png',
      revisedPrompt: 'refined prompt',
    })
    expect(assets[1].url).toBe('data:image/png;base64,aGVsbG8=')
    expect(assets.map((asset) => asset.url).join(' ')).not.toContain('javascript:')
    expect(assets.map((asset) => asset.url).join(' ')).not.toContain('svg+xml')
  })

  it('streams updates and completes only after DONE', async () => {
    localStorage.setItem('auth_token', 'access-token')
    vi.spyOn(performance, 'now').mockReturnValue(321.5)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'data: {"id":"chatcmpl-1","model":"gpt-test","choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ], { requestId: 'request-1' })))
    const onResponse = vi.fn()
    const onUpdate = vi.fn()
    const onComplete = vi.fn()

    await streamPlaygroundChat(7, { model: 'gpt-test', messages: [], stream: true }, {
      onResponse,
      onUpdate,
      onComplete,
    })

    expect(onResponse).toHaveBeenCalledWith({ requestId: 'request-1' })
    expect(onUpdate.mock.calls[0][0]).toMatchObject({
      content: 'Hel',
      responseId: 'chatcmpl-1',
      receivedAtMonotonicMs: 321.5,
    })
    expect(onUpdate.mock.calls[1][0]).toMatchObject({ content: 'lo', finishReason: 'stop' })
    expect(onComplete).toHaveBeenCalledTimes(1)
    const request = vi.mocked(fetch).mock.calls[0]
    expect(new Headers(request[1]?.headers).get('Authorization')).toBe('Bearer access-token')
  })

  it('accepts a clean EOF after a non-empty finish reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}\n\n',
    ])))
    const onComplete = vi.fn()
    await streamPlaygroundChat(1, { model: 'm', messages: [], stream: true }, {
      onUpdate: vi.fn(),
      onComplete,
    })
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('treats EOF without DONE or finish_reason as an interrupted response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
    ])))
    const onComplete = vi.fn()
    await expect(streamPlaygroundChat(1, { model: 'm', messages: [], stream: true }, {
      onUpdate: vi.fn(),
      onComplete,
    })).rejects.toBeInstanceOf(PlaygroundStreamInterruptedError)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('refreshes a 401 once and retries with the rotated token', async () => {
    localStorage.setItem('auth_token', 'old-token')
    localStorage.setItem('refresh_token', 'refresh-token')
    clientMocks.refreshAccessToken.mockImplementation(async () => {
      localStorage.setItem('auth_token', 'new-token')
      return 'new-token'
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(streamResponse(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    await streamPlaygroundChat(1, { model: 'm', messages: [], stream: true }, {
      onUpdate: vi.fn(),
      onComplete: vi.fn(),
    })

    expect(clientMocks.refreshAccessToken).toHaveBeenCalledOnce()
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer old-token')
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer new-token')
  })

  it('cancels the stream reader when DONE arrives before transport EOF', async () => {
    const cancelled = vi.fn()
    const encoder = new TextEncoder()
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      },
      cancel: cancelled,
    }), { status: 200 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await streamPlaygroundChat(1, { model: 'm', messages: [], stream: true }, {
      onUpdate: vi.fn(),
      onComplete: vi.fn(),
    })
    expect(cancelled).toHaveBeenCalledOnce()
  })

  it('surfaces structured non-success errors without completing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Usage limit reached' } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )))
    const onComplete = vi.fn()

    await expect(streamPlaygroundChat(1, { model: 'm', messages: [], stream: true }, {
      onUpdate: vi.fn(),
      onComplete,
    })).rejects.toThrow('Usage limit reached')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('propagates an AbortSignal interruption without completing', async () => {
    const abortController = new AbortController()
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        abortController.signal.addEventListener('abort', () => {
          controller.error(new DOMException('aborted', 'AbortError'))
        }, { once: true })
      },
    }), { status: 200 })
    const fetchMock = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(abortController.signal)
      return Promise.resolve(response)
    })
    vi.stubGlobal('fetch', fetchMock)
    const onComplete = vi.fn()

    const request = streamPlaygroundChat(1, { model: 'm', messages: [], stream: true }, {
      onUpdate: vi.fn(),
      onComplete,
    }, abortController.signal)
    await Promise.resolve()
    abortController.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(onComplete).not.toHaveBeenCalled()
  })
})
