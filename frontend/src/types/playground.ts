export type PlaygroundRole = 'system' | 'user' | 'assistant'
export type PlaygroundMessageStatus = 'complete' | 'streaming' | 'error' | 'stopped'
export type PlaygroundMessageKind = 'chat' | 'image'
export type PlaygroundImageSize = '1024x1024' | '1536x1024' | '1024x1536'
export type PlaygroundImageQuality = 'auto' | 'low' | 'medium' | 'high'
export type PlaygroundImageFormat = 'png' | 'jpeg' | 'webp'

export interface PlaygroundKeyOption {
  id: number
  name: string
  status: string
  group_id: number | null
  group_name: string
  platform: string
}

export interface PlaygroundKeyList {
  items: PlaygroundKeyOption[]
  truncated: boolean
}

export interface PlaygroundModelOption {
  id: string
  object?: string
  owned_by?: string
}

export interface PlaygroundUsage {
  prompt_tokens?: number
  completion_tokens?: number
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

export interface PlaygroundImageAsset {
  id: string
  url: string
  sourceUrl?: string
  mimeType: string
  revisedPrompt?: string
}

export interface PlaygroundMessage {
  id: string
  role: 'user' | 'assistant'
  kind?: PlaygroundMessageKind
  content: string
  reasoning?: string
  status: PlaygroundMessageStatus
  createdAt: number
  requestStartedAt?: number
  completedAt?: number
  durationMs?: number
  firstTokenMs?: number
  tokensPerSecond?: number
  model?: string
  requestId?: string
  responseId?: string
  finishReason?: string | null
  usage?: PlaygroundUsage
  images?: PlaygroundImageAsset[]
  imageCount?: number
  imageSize?: PlaygroundImageSize
  imageQuality?: PlaygroundImageQuality
  imageFormat?: PlaygroundImageFormat
  error?: string
}

export interface PlaygroundParameterEnabled {
  temperature: boolean
  top_p: boolean
  max_tokens: boolean
  frequency_penalty: boolean
  presence_penalty: boolean
  seed: boolean
}

export interface PlaygroundConfig {
  keyId: number | null
  model: string
  systemPrompt: string
  stream: boolean
  temperature: number
  top_p: number
  max_tokens: number
  frequency_penalty: number
  presence_penalty: number
  seed: number | null
  imageSize: PlaygroundImageSize
  imageQuality: PlaygroundImageQuality
  imageFormat: PlaygroundImageFormat
  imageCount: number
  parameterEnabled: PlaygroundParameterEnabled
}

export interface PlaygroundChatMessage {
  role: PlaygroundRole
  content: string
}

export interface PlaygroundChatRequest {
  model: string
  messages: PlaygroundChatMessage[]
  stream: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
}

export interface PlaygroundChatChunk {
  id?: string
  model?: string
  choices?: Array<{
    delta?: {
      content?: string
      reasoning_content?: string
      reasoning?: string
    }
    finish_reason?: string | null
  }>
  usage?: PlaygroundUsage
  error?: {
    message?: string
    code?: string
    type?: string
  }
}

export interface PlaygroundChatResponse {
  id?: string
  model?: string
  choices?: Array<{
    message?: {
      content?: string
      reasoning_content?: string
      reasoning?: string
    }
    finish_reason?: string | null
  }>
  usage?: PlaygroundUsage
}

export interface PlaygroundChatResult {
  response: PlaygroundChatResponse
  requestId?: string
}

export interface PlaygroundImageRequest {
  model: string
  prompt: string
  n: number
  size: PlaygroundImageSize
  quality: PlaygroundImageQuality
  output_format: PlaygroundImageFormat
  response_format: 'b64_json'
}

export interface PlaygroundImageData {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface PlaygroundImageResponse {
  created?: number
  data?: PlaygroundImageData[]
  usage?: PlaygroundUsage
}

export interface PlaygroundImageResult {
  response: PlaygroundImageResponse
  requestId?: string
}
