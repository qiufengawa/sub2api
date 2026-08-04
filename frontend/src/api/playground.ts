import { apiClient, refreshAccessToken } from './client'
import { buildApiUrl } from './url'
import { getLocale } from '@/i18n'
import type {
  PlaygroundChatChunk,
  PlaygroundChatRequest,
  PlaygroundChatResponse,
  PlaygroundChatResult,
  PlaygroundImageAsset,
  PlaygroundImageFormat,
  PlaygroundImageRequest,
  PlaygroundImageResponse,
  PlaygroundImageResult,
  PlaygroundKeyList,
  PlaygroundModelOption,
  PlaygroundUsage,
} from '@/types/playground'
import { sanitizeUrl } from '@/utils/url'

interface ModelListResponse {
  data?: PlaygroundModelOption[]
}

export interface PlaygroundStreamUpdate {
  content?: string
  reasoning?: string
  receivedAtMonotonicMs?: number
  responseId?: string
  model?: string
  finishReason?: string | null
  usage?: PlaygroundUsage
}

export interface PlaygroundStreamHandlers {
  onResponse?: (metadata: { requestId?: string }) => void
  onUpdate: (update: PlaygroundStreamUpdate) => void
  onComplete: () => void
}

export class PlaygroundStreamInterruptedError extends Error {
  constructor() {
    super('Streaming response ended before completion')
    this.name = 'PlaygroundStreamInterruptedError'
  }
}

export class SSEDataDecoder {
  private buffer = ''
  private dataLines: string[] = []

  push(chunk: string): string[] {
    this.buffer += chunk
    const events: string[] = []
    let newline = this.buffer.indexOf('\n')
    while (newline >= 0) {
      let line = this.buffer.slice(0, newline)
      this.buffer = this.buffer.slice(newline + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      this.consumeLine(line, events)
      newline = this.buffer.indexOf('\n')
    }
    return events
  }

  finish(): string[] {
    const events: string[] = []
    if (this.buffer.length > 0) {
      const line = this.buffer.endsWith('\r') ? this.buffer.slice(0, -1) : this.buffer
      this.consumeLine(line, events)
      this.buffer = ''
    }
    this.emit(events)
    return events
  }

  private consumeLine(line: string, events: string[]): void {
    if (line === '') {
      this.emit(events)
      return
    }
    if (line.startsWith(':')) return
    if (line === 'data') {
      this.dataLines.push('')
      return
    }
    if (line.startsWith('data:')) {
      this.dataLines.push(line.slice(5).replace(/^ /, ''))
    }
  }

  private emit(events: string[]): void {
    if (this.dataLines.length === 0) return
    events.push(this.dataLines.join('\n'))
    this.dataLines = []
  }
}

export async function listPlaygroundKeys(): Promise<PlaygroundKeyList> {
  const { data } = await apiClient.get<PlaygroundKeyList>('/playground/keys')
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    truncated: data?.truncated === true,
  }
}

export async function listPlaygroundModels(keyId: number): Promise<PlaygroundModelOption[]> {
  const { data } = await apiClient.get<ModelListResponse>(`/playground/keys/${keyId}/models`)
  return Array.isArray(data?.data) ? data.data : []
}

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function monotonicNow(): number {
  const value = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return Number.isFinite(value) ? value : Date.now()
}

function responseRequestId(headers: Headers | Record<string, unknown>): string | undefined {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('X-Request-ID')?.trim() || undefined
  }
  const headerRecord = headers as Record<string, unknown>
  const value = headerRecord['x-request-id'] ?? headerRecord['X-Request-ID']
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function sendPlaygroundChat(
  keyId: number,
  payload: PlaygroundChatRequest,
  signal?: AbortSignal,
): Promise<PlaygroundChatResult> {
  const requestId = makeRequestId()
  const result = await apiClient.post<PlaygroundChatResponse>(
    `/playground/keys/${keyId}/chat/completions`,
    payload,
    {
      signal,
      headers: { 'X-Request-ID': requestId },
    },
  )
  return {
    response: result.data,
    requestId: responseRequestId(result.headers as Record<string, unknown>) || requestId,
  }
}

const imageMimeTypes: Record<PlaygroundImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function normalizeInlineImage(value: string): { url: string; mimeType: string } | null {
  const match = value.trim().match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/i)
  if (!match) return null
  const encoded = match[2].replace(/\s/g, '')
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null
  return { url: `data:${match[1].toLowerCase()};base64,${encoded}`, mimeType: match[1].toLowerCase() }
}

function normalizeBase64Image(value: string, format: PlaygroundImageFormat): { url: string; mimeType: string } | null {
  const encoded = value.replace(/\s/g, '')
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null
  const mimeType = imageMimeTypes[format]
  return { url: `data:${mimeType};base64,${encoded}`, mimeType }
}

export function normalizePlaygroundImageAssets(
  response: PlaygroundImageResponse,
  format: PlaygroundImageFormat,
): PlaygroundImageAsset[] {
  if (!Array.isArray(response?.data)) return []
  const assets: PlaygroundImageAsset[] = []
  for (const [index, item] of response.data.entries()) {
    if (!item || typeof item !== 'object') continue
    const rawUrl = typeof item.url === 'string' ? item.url : ''
    const remoteUrl = rawUrl ? sanitizeUrl(rawUrl) : ''
    const inlineUrl = !remoteUrl && rawUrl ? normalizeInlineImage(rawUrl) : null
    const base64Image = !remoteUrl && !inlineUrl && typeof item.b64_json === 'string'
      ? normalizeBase64Image(item.b64_json, format)
      : null
    const normalized = remoteUrl
      ? { url: remoteUrl, mimeType: imageMimeTypes[format], sourceUrl: remoteUrl }
      : inlineUrl || base64Image
    if (!normalized) continue
    assets.push({
      id: `image-${response.created || Date.now()}-${index}`,
      ...normalized,
      revisedPrompt: typeof item.revised_prompt === 'string' ? item.revised_prompt.slice(0, 20_000) : undefined,
    })
  }
  return assets
}

export async function sendPlaygroundImage(
  keyId: number,
  payload: PlaygroundImageRequest,
  signal?: AbortSignal,
): Promise<PlaygroundImageResult> {
  const requestId = makeRequestId()
  const result = await apiClient.post<PlaygroundImageResponse>(
    `/playground/keys/${keyId}/images/generations`,
    payload,
    {
      signal,
      headers: { 'X-Request-ID': requestId },
    },
  )
  return {
    response: result.data,
    requestId: responseRequestId(result.headers as Record<string, unknown>) || requestId,
  }
}

function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('The request was aborted', 'AbortError')
  const error = new Error('The request was aborted')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : abortError()
}

async function waitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  throwIfAborted(signal)

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    throwIfAborted(signal)
    const headers = new Headers(init.headers)
    const token = localStorage.getItem('auth_token')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    else headers.delete('Authorization')

    const response = await fetch(input, { ...init, headers, signal })
    if (response.status !== 401 || attempt === 1) return response

    await waitWithAbort(refreshAccessToken(), signal)
  }
  throw new Error('Authentication retry failed')
}

export async function streamPlaygroundChat(
  keyId: number,
  payload: PlaygroundChatRequest,
  handlers: PlaygroundStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const clientRequestId = makeRequestId()
  const response = await authenticatedFetch(
    buildApiUrl(`/playground/keys/${keyId}/chat/completions`),
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Accept-Language': getLocale(),
        'X-User-UI-Request': '1',
        'X-Request-ID': clientRequestId,
      },
      body: JSON.stringify(payload),
    },
    signal,
  )

  if (!response.ok) {
    throw new Error(await readPlaygroundError(response))
  }
  if (!response.body) {
    throw new Error('Streaming response body is unavailable')
  }

  handlers.onResponse?.({ requestId: responseRequestId(response.headers) || clientRequestId })

  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()
  const eventDecoder = new SSEDataDecoder()
  let sawDone = false
  let sawFinishReason = false
  let readerEnded = false

  const handleData = (data: string): void => {
    if (data.trim() === '[DONE]') {
      sawDone = true
      return
    }

    let chunk: PlaygroundChatChunk
    try {
      chunk = JSON.parse(data) as PlaygroundChatChunk
    } catch {
      throw new Error('Unable to parse streaming response')
    }
    if (chunk.error?.message) throw new Error(chunk.error.message)

    const choice = chunk.choices?.[0]
    if (choice?.finish_reason) sawFinishReason = true
    handlers.onUpdate({
      content: choice?.delta?.content,
      reasoning: choice?.delta?.reasoning_content ?? choice?.delta?.reasoning,
      receivedAtMonotonicMs: monotonicNow(),
      responseId: chunk.id,
      model: chunk.model,
      finishReason: choice?.finish_reason,
      usage: chunk.usage,
    })
  }

  try {
    while (!sawDone) {
      const { value, done } = await reader.read()
      if (done) {
        readerEnded = true
        break
      }
      for (const data of eventDecoder.push(textDecoder.decode(value, { stream: true }))) {
        handleData(data)
        if (sawDone) break
      }
    }

    if (!sawDone) {
      for (const data of eventDecoder.push(textDecoder.decode())) handleData(data)
      for (const data of eventDecoder.finish()) handleData(data)
    }

    if (!sawDone && !sawFinishReason) throw new PlaygroundStreamInterruptedError()
    handlers.onComplete()
  } finally {
    if (!readerEnded) {
      try {
        await reader.cancel()
      } catch {
        // The underlying stream may already be closed after an abort.
      }
    }
    reader.releaseLock()
  }
}

async function readPlaygroundError(response: Response): Promise<string> {
  try {
    const body = await response.json() as Record<string, any>
    return String(body?.error?.message || body?.message || body?.detail || `Request failed (${response.status})`)
  } catch {
    return `Request failed (${response.status})`
  }
}

export const playgroundAPI = {
  listKeys: listPlaygroundKeys,
  listModels: listPlaygroundModels,
  sendChat: sendPlaygroundChat,
  streamChat: streamPlaygroundChat,
  sendImage: sendPlaygroundImage,
}
