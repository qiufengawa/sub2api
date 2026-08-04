import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { normalizePlaygroundImageAssets, playgroundAPI, type PlaygroundStreamUpdate } from '@/api/playground'
import type {
  PlaygroundChatRequest,
  PlaygroundChatMessage,
  PlaygroundConfig,
  PlaygroundImageFormat,
  PlaygroundImageQuality,
  PlaygroundImageRequest,
  PlaygroundImageSize,
  PlaygroundKeyOption,
  PlaygroundMessage,
  PlaygroundModelOption,
  PlaygroundUsage,
} from '@/types/playground'

const MAX_STORED_MESSAGES = 100
const MAX_STORED_MESSAGE_CHARS = 200_000
const MAX_STORED_SESSION_CHARS = 1_500_000
const MAX_SYSTEM_PROMPT_CHARS = 200_000
const SESSION_PERSIST_DELAY_MS = 200
const STREAM_RENDER_DELAY_MS = 50
const IMAGE_SIZES: PlaygroundImageSize[] = ['1024x1024', '1536x1024', '1024x1536']
const IMAGE_QUALITIES: PlaygroundImageQuality[] = ['auto', 'low', 'medium', 'high']
const IMAGE_FORMATS: PlaygroundImageFormat[] = ['png', 'jpeg', 'webp']

export function isPlaygroundImageModel(model: string): boolean {
  return /(^|[/:])gpt-image(?:-|$)/i.test(model.trim())
}

const defaultConfig = (): PlaygroundConfig => ({
  keyId: null,
  model: '',
  systemPrompt: '',
  stream: true,
  temperature: 0.7,
  top_p: 1,
  max_tokens: 4096,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  imageSize: '1024x1024',
  imageQuality: 'auto',
  imageFormat: 'png',
  imageCount: 1,
  parameterEnabled: {
    temperature: false,
    top_p: false,
    max_tokens: false,
    frequency_penalty: false,
    presence_penalty: false,
    seed: false,
  },
})

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function storageSuffix(userId: number): string {
  return Number.isInteger(userId) && userId > 0 ? String(userId) : 'unknown'
}

function configStorageKey(userId: number): string {
  return `playground.config.v1.${storageSuffix(userId)}`
}

function sessionStorageKey(userId: number): string {
  return `playground.session.v1.${storageSuffix(userId)}`
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function finiteNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback
}

function integerNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : fallback
}

function optionalInteger(value: unknown): number | null {
  if (value === null) return null
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

function monotonicNow(): number {
  const value = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return Number.isFinite(value) ? value : Date.now()
}

function loadStoredConfig(userId: number): PlaygroundConfig {
  const fallback = defaultConfig()
  try {
    const parsed = JSON.parse(localStorage.getItem(configStorageKey(userId)) || '{}') as Record<string, unknown>
    const enabled = typeof parsed.parameterEnabled === 'object' && parsed.parameterEnabled !== null
      ? parsed.parameterEnabled as Record<string, unknown>
      : {}

    return {
      ...fallback,
      keyId: typeof parsed.keyId === 'number' && Number.isSafeInteger(parsed.keyId) && parsed.keyId > 0
        ? parsed.keyId
        : null,
      model: cleanString(parsed.model, 512),
      stream: typeof parsed.stream === 'boolean' ? parsed.stream : fallback.stream,
      temperature: finiteNumber(parsed.temperature, 0, 2, fallback.temperature),
      top_p: finiteNumber(parsed.top_p, 0, 1, fallback.top_p),
      max_tokens: integerNumber(parsed.max_tokens, 1, 131_072, fallback.max_tokens),
      frequency_penalty: finiteNumber(parsed.frequency_penalty, -2, 2, fallback.frequency_penalty),
      presence_penalty: finiteNumber(parsed.presence_penalty, -2, 2, fallback.presence_penalty),
      seed: optionalInteger(parsed.seed),
      imageSize: oneOf(parsed.imageSize, IMAGE_SIZES, fallback.imageSize),
      imageQuality: oneOf(parsed.imageQuality, IMAGE_QUALITIES, fallback.imageQuality),
      imageFormat: oneOf(parsed.imageFormat, IMAGE_FORMATS, fallback.imageFormat),
      imageCount: integerNumber(parsed.imageCount, 1, 4, fallback.imageCount),
      parameterEnabled: {
        temperature: enabled.temperature === true,
        top_p: enabled.top_p === true,
        max_tokens: enabled.max_tokens === true,
        frequency_penalty: enabled.frequency_penalty === true,
        presence_penalty: enabled.presence_penalty === true,
        seed: enabled.seed === true,
      },
    }
  } catch {
    return fallback
  }
}

function cleanUsage(value: unknown): PlaygroundUsage | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Record<string, unknown>
  const usage: PlaygroundUsage = {}
  for (const field of ['prompt_tokens', 'completion_tokens', 'input_tokens', 'output_tokens', 'total_tokens'] as const) {
    const tokenCount = source[field]
    if (typeof tokenCount === 'number' && Number.isSafeInteger(tokenCount) && tokenCount >= 0) {
      usage[field] = tokenCount
    }
  }
  return Object.keys(usage).length > 0 ? usage : undefined
}

function cleanStoredMessage(value: unknown): PlaygroundMessage | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  if (source.role !== 'user' && source.role !== 'assistant') return null
  if (source.kind === 'image' || Array.isArray(source.images)) return null
  if (typeof source.content !== 'string' || source.content.length > MAX_STORED_MESSAGE_CHARS) return null
  if (typeof source.reasoning === 'string' && source.reasoning.length > MAX_STORED_MESSAGE_CHARS) return null

  const rawStatus = source.status
  const status = rawStatus === 'error' || rawStatus === 'stopped'
    ? rawStatus
    : rawStatus === 'streaming'
      ? 'stopped'
      : 'complete'
  const createdAt = typeof source.createdAt === 'number' && Number.isFinite(source.createdAt)
    ? source.createdAt
    : Date.now()
  const message: PlaygroundMessage = {
    id: cleanString(source.id, 128) || makeId(),
    role: source.role,
    kind: 'chat',
    content: source.content,
    status,
    createdAt,
  }

  const reasoning = cleanString(source.reasoning, MAX_STORED_MESSAGE_CHARS)
  if (reasoning) message.reasoning = reasoning
  const model = cleanString(source.model, 512)
  if (model) message.model = model
  const requestId = cleanString(source.requestId, 256)
  if (requestId) message.requestId = requestId
  const responseId = cleanString(source.responseId, 256)
  if (responseId) message.responseId = responseId
  const finishReason = cleanString(source.finishReason, 128)
  if (finishReason) message.finishReason = finishReason
  const error = cleanString(source.error, 2_000)
  if (error) message.error = error
  const usage = cleanUsage(source.usage)
  if (usage) message.usage = usage

  if (typeof source.completedAt === 'number' && Number.isFinite(source.completedAt)) {
    message.completedAt = source.completedAt
  }
  if (typeof source.requestStartedAt === 'number' && Number.isFinite(source.requestStartedAt) && source.requestStartedAt >= 0) {
    message.requestStartedAt = source.requestStartedAt
  }
  if (typeof source.durationMs === 'number' && Number.isFinite(source.durationMs) && source.durationMs >= 0) {
    message.durationMs = source.durationMs
  }
  if (typeof source.firstTokenMs === 'number' && Number.isFinite(source.firstTokenMs) && source.firstTokenMs >= 0) {
    message.firstTokenMs = source.firstTokenMs
  }
  if (typeof source.tokensPerSecond === 'number' && Number.isFinite(source.tokensPerSecond) && source.tokensPerSecond >= 0) {
    message.tokensPerSecond = source.tokensPerSecond
  }
  return message
}

function loadStoredSession(userId: number): { messages: PlaygroundMessage[]; systemPrompt: string } {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey(userId)) || ''
    if (!raw || raw.length > MAX_STORED_SESSION_CHARS) return { messages: [], systemPrompt: '' }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const sourceMessages = Array.isArray(parsed.messages) ? parsed.messages.slice(-MAX_STORED_MESSAGES) : []
    const messages: PlaygroundMessage[] = []
    let restoredChars = 0
    for (const source of sourceMessages) {
      const message = cleanStoredMessage(source)
      if (!message) continue
      const nextChars = message.content.length + (message.reasoning?.length || 0)
      if (restoredChars + nextChars > MAX_STORED_SESSION_CHARS) break
      restoredChars += nextChars
      messages.push(message)
    }
    return {
      messages,
      systemPrompt: cleanString(parsed.systemPrompt, MAX_SYSTEM_PROMPT_CHARS),
    }
  } catch {
    return { messages: [], systemPrompt: '' }
  }
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const source = error as {
      error?: unknown
      detail?: unknown
      message?: unknown
      response?: { data?: { detail?: unknown; message?: unknown; error?: unknown } }
    }
    const nested = source.error ?? source.response?.data?.error
    if (typeof nested === 'string' && nested.trim()) return nested
    if (typeof nested === 'object' && nested !== null && 'message' in nested) {
      const message = (nested as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message
    }
    const detail = source.detail ?? source.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    const message = source.message ?? source.response?.data?.message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Request failed'
}

function validParameter(value: number | null, min: number, max: number, integer = false): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isSafeInteger(value))
}

export function usePlayground(userId: number) {
  const storedSession = loadStoredSession(userId)
  const config = ref<PlaygroundConfig>({
    ...loadStoredConfig(userId),
    systemPrompt: storedSession.systemPrompt,
  })
  const messages = ref<PlaygroundMessage[]>(storedSession.messages)
  const keys = ref<PlaygroundKeyOption[]>([])
  const keysTruncated = ref(false)
  const models = ref<PlaygroundModelOption[]>([])
  const isLoadingKeys = ref(false)
  const isLoadingModels = ref(false)
  const isGenerating = ref(false)
  const optionsError = ref('')
  const storageWarning = ref(false)

  let controller: AbortController | null = null
  let activeMessageId: string | null = null
  let activeRequestStartedAtMonotonic: number | null = null
  let activeRequestIsStream = false
  let generation = 0
  let keyRequestSequence = 0
  let modelRequestSequence = 0
  let sessionPersistTimer: ReturnType<typeof setTimeout> | null = null
  let streamRenderTimer: ReturnType<typeof setTimeout> | null = null
  let pendingStreamUpdate: (PlaygroundStreamUpdate & { token: number; messageId: string }) | null = null

  const selectedKey = computed(() => keys.value.find((key) => key.id === config.value.keyId) || null)
  const isImageMode = computed(() => isPlaygroundImageModel(config.value.model))
  const parameterErrors = computed(() => {
    const errors: string[] = []
    if (isImageMode.value) {
      if (!IMAGE_SIZES.includes(config.value.imageSize)) errors.push('imageSize')
      if (!IMAGE_QUALITIES.includes(config.value.imageQuality)) errors.push('imageQuality')
      if (!IMAGE_FORMATS.includes(config.value.imageFormat)) errors.push('imageFormat')
      if (!validParameter(config.value.imageCount, 1, 4, true)) errors.push('imageCount')
      return errors
    }
    const enabled = config.value.parameterEnabled
    if (enabled.temperature && !validParameter(config.value.temperature, 0, 2)) errors.push('temperature')
    if (enabled.top_p && !validParameter(config.value.top_p, 0, 1)) errors.push('top_p')
    if (enabled.max_tokens && !validParameter(config.value.max_tokens, 1, 131_072, true)) errors.push('max_tokens')
    if (enabled.frequency_penalty && !validParameter(config.value.frequency_penalty, -2, 2)) errors.push('frequency_penalty')
    if (enabled.presence_penalty && !validParameter(config.value.presence_penalty, -2, 2)) errors.push('presence_penalty')
    if (enabled.seed && !validParameter(config.value.seed, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)) errors.push('seed')
    return errors
  })
  const canSend = computed(() => Boolean(
    selectedKey.value &&
    selectedKey.value.status === 'active' &&
    selectedKey.value.group_id !== null &&
    config.value.model &&
    models.value.some((model) => model.id === config.value.model) &&
    parameterErrors.value.length === 0 &&
    !isGenerating.value &&
    !isLoadingModels.value,
  ))

  function persistConfig(): void {
    try {
      const { systemPrompt: _systemPrompt, ...persisted } = config.value
      localStorage.setItem(configStorageKey(userId), JSON.stringify(persisted))
    } catch {
      storageWarning.value = true
    }
  }

  function persistSession(): void {
    if (sessionPersistTimer) {
      clearTimeout(sessionPersistTimer)
      sessionPersistTimer = null
    }
    try {
      sessionStorage.setItem(sessionStorageKey(userId), JSON.stringify({
        systemPrompt: config.value.systemPrompt.slice(0, MAX_SYSTEM_PROMPT_CHARS),
        messages: messages.value
          .filter((message) => message.kind !== 'image' && !message.images?.length)
          .slice(-MAX_STORED_MESSAGES),
      }))
    } catch {
      storageWarning.value = true
    }
  }

  function scheduleSessionPersist(): void {
    if (sessionPersistTimer) return
    sessionPersistTimer = setTimeout(persistSession, SESSION_PERSIST_DELAY_MS)
  }

  watch(config, persistConfig, { deep: true })
  watch([messages, () => config.value.systemPrompt], scheduleSessionPersist, { deep: true })

  async function loadKeys(): Promise<void> {
    const requestSequence = ++keyRequestSequence
    isLoadingKeys.value = true
    optionsError.value = ''
    try {
      const result = await playgroundAPI.listKeys()
      if (requestSequence !== keyRequestSequence) return
      keys.value = result.items
      keysTruncated.value = result.truncated
      const persisted = keys.value.find((key) => key.id === config.value.keyId)
      const fallback = keys.value.find((key) => key.status === 'active' && key.group_id !== null)
      const next = persisted?.status === 'active' && persisted.group_id !== null ? persisted : fallback
      if (next) await selectKey(next.id)
      else {
        config.value.keyId = null
        config.value.model = ''
        models.value = []
      }
    } catch (error) {
      if (requestSequence !== keyRequestSequence) return
      keys.value = []
      keysTruncated.value = false
      models.value = []
      optionsError.value = errorMessage(error)
    } finally {
      if (requestSequence === keyRequestSequence) isLoadingKeys.value = false
    }
  }

  async function selectKey(keyId: number): Promise<void> {
    if (isGenerating.value) stop()
    const requestSequence = ++modelRequestSequence
    const preferredModel = config.value.model
    config.value.keyId = keyId
    config.value.model = ''
    models.value = []
    optionsError.value = ''

    const key = keys.value.find((item) => item.id === keyId)
    if (!key || key.status !== 'active' || key.group_id === null) {
      isLoadingModels.value = false
      return
    }

    isLoadingModels.value = true
    try {
      const available = await playgroundAPI.listModels(keyId)
      if (requestSequence !== modelRequestSequence || config.value.keyId !== keyId) return
      const unique = new Map<string, PlaygroundModelOption>()
      for (const model of available) {
        const id = cleanString(model?.id, 512).trim()
        if (id) unique.set(id, { ...model, id })
      }
      models.value = Array.from(unique.values()).sort((a, b) => a.id.localeCompare(b.id))
      config.value.model = models.value.some((model) => model.id === preferredModel)
        ? preferredModel
        : models.value[0]?.id || ''
    } catch (error) {
      if (requestSequence !== modelRequestSequence || config.value.keyId !== keyId) return
      models.value = []
      config.value.model = ''
      optionsError.value = errorMessage(error)
    } finally {
      if (requestSequence === modelRequestSequence) isLoadingModels.value = false
    }
  }

  function buildRequest(): PlaygroundChatRequest {
    const requestMessages: PlaygroundChatMessage[] = messages.value
      .filter((message) => message.kind !== 'image' && !message.images?.length)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }))
    const systemPrompt = config.value.systemPrompt.trim()
    if (systemPrompt) requestMessages.unshift({ role: 'system', content: systemPrompt })

    const payload: PlaygroundChatRequest = {
      model: config.value.model,
      messages: requestMessages,
      stream: config.value.stream,
    }
    const enabled = config.value.parameterEnabled
    if (enabled.temperature && validParameter(config.value.temperature, 0, 2)) payload.temperature = config.value.temperature
    if (enabled.top_p && validParameter(config.value.top_p, 0, 1)) payload.top_p = config.value.top_p
    if (enabled.max_tokens && validParameter(config.value.max_tokens, 1, 131_072, true)) payload.max_tokens = config.value.max_tokens
    if (enabled.frequency_penalty && validParameter(config.value.frequency_penalty, -2, 2)) payload.frequency_penalty = config.value.frequency_penalty
    if (enabled.presence_penalty && validParameter(config.value.presence_penalty, -2, 2)) payload.presence_penalty = config.value.presence_penalty
    if (enabled.seed && validParameter(config.value.seed, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true)) payload.seed = config.value.seed as number
    return payload
  }

  function buildImageRequest(prompt: string): PlaygroundImageRequest {
    return {
      model: config.value.model,
      prompt: prompt.trim(),
      n: config.value.imageCount,
      size: config.value.imageSize,
      quality: config.value.imageQuality,
      output_format: config.value.imageFormat,
      response_format: 'b64_json',
    }
  }

  function applyStreamUpdate(update: PlaygroundStreamUpdate & { token: number; messageId: string }): void {
    if (update.token !== generation) return
    const message = messages.value.find((item) => item.id === update.messageId)
    if (!message || message.status !== 'streaming') return
    if (update.content) message.content += update.content
    if (update.reasoning) message.reasoning = `${message.reasoning || ''}${update.reasoning}`
    if (update.responseId) message.responseId = update.responseId
    if (update.model) message.model = update.model
    if (update.finishReason !== undefined) message.finishReason = update.finishReason
    if (update.usage) message.usage = update.usage
  }

  function flushStreamUpdate(): void {
    if (streamRenderTimer) {
      clearTimeout(streamRenderTimer)
      streamRenderTimer = null
    }
    if (!pendingStreamUpdate) return
    const update = pendingStreamUpdate
    pendingStreamUpdate = null
    applyStreamUpdate(update)
  }

  function queueStreamUpdate(update: PlaygroundStreamUpdate, token: number, messageId: string): void {
    if (token !== generation) return
    if (!pendingStreamUpdate || pendingStreamUpdate.token !== token || pendingStreamUpdate.messageId !== messageId) {
      pendingStreamUpdate = { ...update, token, messageId }
    } else {
      if (update.content) pendingStreamUpdate.content = `${pendingStreamUpdate.content || ''}${update.content}`
      if (update.reasoning) pendingStreamUpdate.reasoning = `${pendingStreamUpdate.reasoning || ''}${update.reasoning}`
      for (const field of ['responseId', 'model', 'finishReason', 'usage'] as const) {
        if (update[field] !== undefined) Object.assign(pendingStreamUpdate, { [field]: update[field] })
      }
    }
    if (!streamRenderTimer) streamRenderTimer = setTimeout(flushStreamUpdate, STREAM_RENDER_DELAY_MS)
  }

  function finalizeMetrics(
    message: PlaygroundMessage,
    requestStartedAtMonotonic: number,
    completedAtMonotonic: number,
    isStream: boolean,
  ): void {
    message.completedAt = Date.now()
    message.durationMs = Math.max(0, completedAtMonotonic - requestStartedAtMonotonic)
    delete message.tokensPerSecond

    const outputTokens = message.usage?.completion_tokens
    const generationMs = message.firstTokenMs === undefined
      ? 0
      : message.durationMs - message.firstTokenMs
    if (
      isStream &&
      typeof outputTokens === 'number' &&
      Number.isSafeInteger(outputTokens) &&
      outputTokens > 0 &&
      generationMs > 0
    ) {
      message.tokensPerSecond = outputTokens / (generationMs / 1000)
    }
  }

  async function submit(text: string): Promise<void> {
    const content = text.trim()
    if (!content || !canSend.value) return
    messages.value.push({
      id: makeId(),
      role: 'user',
      kind: isImageMode.value ? 'image' : 'chat',
      content,
      status: 'complete',
      createdAt: Date.now(),
    })
    if (isImageMode.value) await generateImage(content)
    else await generateAssistant()
  }

  async function generateAssistant(): Promise<void> {
    const keyId = config.value.keyId
    if (!keyId || !canSend.value) return

    const assistant: PlaygroundMessage = {
      id: makeId(),
      role: 'assistant',
      kind: 'chat',
      content: '',
      reasoning: '',
      status: 'streaming',
      createdAt: Date.now(),
      model: config.value.model,
    }
    const payload = buildRequest()
    messages.value.push(assistant)

    const requestGeneration = ++generation
    const requestController = new AbortController()
    controller = requestController
    activeMessageId = assistant.id
    isGenerating.value = true
    const requestStartedAtMonotonic = monotonicNow()
    assistant.requestStartedAt = Date.now()
    activeRequestStartedAtMonotonic = requestStartedAtMonotonic
    activeRequestIsStream = payload.stream

    try {
      if (payload.stream) {
        await playgroundAPI.streamChat(keyId, payload, {
          onResponse(metadata) {
            if (requestGeneration === generation && metadata.requestId) assistant.requestId = metadata.requestId
          },
          onUpdate(update) {
            if (
              requestGeneration === generation &&
              assistant.firstTokenMs === undefined &&
              (Boolean(update.content) || Boolean(update.reasoning))
            ) {
              const receivedAt = update.receivedAtMonotonicMs ?? monotonicNow()
              assistant.firstTokenMs = Math.max(0, receivedAt - requestStartedAtMonotonic)
            }
            queueStreamUpdate(update, requestGeneration, assistant.id)
          },
          onComplete() {
            flushStreamUpdate()
            if (requestGeneration === generation) assistant.status = 'complete'
          },
        }, requestController.signal)
      } else {
        const result = await playgroundAPI.sendChat(keyId, payload, requestController.signal)
        if (requestGeneration !== generation) return
        const response = result.response
        const choice = response.choices?.[0]
        assistant.content = choice?.message?.content || ''
        assistant.reasoning = choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? ''
        assistant.requestId = result.requestId
        assistant.responseId = response.id
        assistant.model = response.model || assistant.model
        assistant.finishReason = choice?.finish_reason
        assistant.usage = response.usage
        assistant.status = 'complete'
      }
    } catch (error) {
      flushStreamUpdate()
      if (requestGeneration !== generation) return
      if (requestController.signal.aborted) {
        assistant.status = 'stopped'
      } else {
        assistant.status = 'error'
        assistant.error = errorMessage(error)
      }
    } finally {
      if (requestGeneration === generation) {
        finalizeMetrics(assistant, requestStartedAtMonotonic, monotonicNow(), payload.stream)
        controller = null
        activeMessageId = null
        activeRequestStartedAtMonotonic = null
        activeRequestIsStream = false
        isGenerating.value = false
      }
    }
  }

  async function generateImage(prompt: string): Promise<void> {
    const keyId = config.value.keyId
    const trimmedPrompt = prompt.trim()
    if (!keyId || !trimmedPrompt || !canSend.value || !isImageMode.value) return

    const assistant: PlaygroundMessage = {
      id: makeId(),
      role: 'assistant',
      kind: 'image',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
      model: config.value.model,
      imageCount: config.value.imageCount,
      imageSize: config.value.imageSize,
      imageQuality: config.value.imageQuality,
      imageFormat: config.value.imageFormat,
    }
    const payload = buildImageRequest(trimmedPrompt)
    messages.value.push(assistant)

    const requestGeneration = ++generation
    const requestController = new AbortController()
    controller = requestController
    activeMessageId = assistant.id
    isGenerating.value = true
    const requestStartedAtMonotonic = monotonicNow()
    assistant.requestStartedAt = Date.now()
    activeRequestStartedAtMonotonic = requestStartedAtMonotonic
    activeRequestIsStream = false

    try {
      const result = await playgroundAPI.sendImage(keyId, payload, requestController.signal)
      if (requestGeneration !== generation) return
      const assets = normalizePlaygroundImageAssets(result.response, payload.output_format)
      if (assets.length === 0) throw new Error('The image response did not contain a supported image')
      assistant.images = assets
      assistant.requestId = result.requestId
      assistant.usage = result.response.usage
      assistant.status = 'complete'
    } catch (error) {
      if (requestGeneration !== generation) return
      if (requestController.signal.aborted) assistant.status = 'stopped'
      else {
        assistant.status = 'error'
        assistant.error = errorMessage(error)
      }
    } finally {
      if (requestGeneration === generation) {
        finalizeMetrics(assistant, requestStartedAtMonotonic, monotonicNow(), false)
        controller = null
        activeMessageId = null
        activeRequestStartedAtMonotonic = null
        activeRequestIsStream = false
        isGenerating.value = false
      }
    }
  }

  function stop(): void {
    if (!isGenerating.value) return
    flushStreamUpdate()
    const message = messages.value.find((item) => item.id === activeMessageId)
    const requestStartedAtMonotonic = activeRequestStartedAtMonotonic
    if (message && requestStartedAtMonotonic !== null) {
      message.status = 'stopped'
      finalizeMetrics(message, requestStartedAtMonotonic, monotonicNow(), activeRequestIsStream)
    }
    generation += 1
    const activeController = controller
    controller = null
    activeMessageId = null
    activeRequestStartedAtMonotonic = null
    activeRequestIsStream = false
    isGenerating.value = false
    activeController?.abort()
  }

  async function regenerate(index: number): Promise<void> {
    if (isGenerating.value || messages.value[index]?.role !== 'assistant') return
    messages.value = messages.value.slice(0, index)
    const previousUser = [...messages.value].reverse().find((message) => message.role === 'user')
    if (!previousUser) return
    previousUser.kind = isImageMode.value ? 'image' : 'chat'
    if (isImageMode.value) await generateImage(previousUser.content)
    else await generateAssistant()
  }

  async function editAndResend(index: number, content: string): Promise<void> {
    const message = messages.value[index]
    const trimmed = content.trim()
    if (isGenerating.value || message?.role !== 'user' || !trimmed) return
    messages.value = [
      ...messages.value.slice(0, index),
      { ...message, kind: isImageMode.value ? 'image' as const : 'chat' as const, content: trimmed, createdAt: Date.now() },
    ]
    if (isImageMode.value) await generateImage(trimmed)
    else await generateAssistant()
  }

  function deleteMessage(index: number): void {
    if (isGenerating.value) return
    messages.value.splice(index, 1)
  }

  function clearMessages(): void {
    stop()
    messages.value = []
    config.value.systemPrompt = ''
    try {
      sessionStorage.removeItem(sessionStorageKey(userId))
    } catch {
      storageWarning.value = true
    }
  }

  const requestPreview = computed(() => {
    if (!isImageMode.value) return JSON.stringify(buildRequest(), null, 2)
    const prompt = [...messages.value].reverse().find((message) => message.role === 'user')?.content || ''
    return JSON.stringify(buildImageRequest(prompt), null, 2)
  })

  onBeforeUnmount(() => {
    stop()
    flushStreamUpdate()
    persistSession()
  })

  return {
    config,
    messages,
    keys,
    keysTruncated,
    models,
    selectedKey,
    isImageMode,
    canSend,
    parameterErrors,
    isLoadingKeys,
    isLoadingModels,
    isGenerating,
    optionsError,
    storageWarning,
    requestPreview,
    loadKeys,
    selectKey,
    submit,
    stop,
    regenerate,
    editAndResend,
    deleteMessage,
    clearMessages,
  }
}
