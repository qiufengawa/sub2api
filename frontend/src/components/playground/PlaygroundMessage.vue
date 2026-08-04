<template>
  <article class="group px-3 py-3 sm:px-5 sm:py-4">
    <div class="mx-auto flex w-full max-w-5xl" :class="message.role === 'user' ? 'justify-end' : 'items-start gap-2.5 sm:gap-3'">
      <div
        v-if="message.role === 'assistant'"
        class="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-[4px] border border-primary-100 bg-primary-50 text-primary-600 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300"
      >
        <Icon name="sparkles" size="sm" aria-hidden="true" />
      </div>

      <div
        class="flex min-w-0 flex-col"
        :class="message.role === 'user'
          ? 'w-auto max-w-[min(86%,44rem)] items-end'
          : wideAssistantMessage
            ? messageImageCount > 1
              ? 'w-full max-w-[min(92%,54rem)] items-start'
              : 'w-full max-w-[min(92%,36rem)] items-start'
            : 'w-auto max-w-[min(92%,54rem)] items-start'"
      >
        <div class="mb-1.5 flex min-h-4 items-center gap-2 px-0.5" :class="message.role === 'user' ? 'justify-end' : 'justify-between'">
          <span class="text-[11px] font-semibold text-gray-500 dark:text-dark-400">
            {{ message.role === 'user' ? t('playground.roles.user') : t('playground.roles.assistant') }}
          </span>
          <span v-if="message.kind === 'image'" class="inline-flex items-center gap-1 text-[10px] font-medium text-primary-600 dark:text-primary-300">
            <Icon name="sparkles" size="xs" />
            {{ t('playground.image.mode') }}
          </span>
        </div>

        <div
          class="message-bubble min-w-0 max-w-full rounded-[4px]"
          :class="message.role === 'user'
            ? 'user-bubble inline-block rounded-tr-[1px] bg-primary-600 px-3.5 py-2.5 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:bg-primary-700'
            : [
              'assistant-bubble rounded-tl-[1px] border border-gray-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.035)] sm:px-4 dark:border-dark-700 dark:bg-dark-800',
              wideAssistantMessage ? 'block w-full' : 'inline-block w-auto',
            ]"
        >
          <div v-if="editing" class="space-y-2">
            <textarea
              v-model="editValue"
              rows="4"
              class="input min-h-24 resize-y text-sm leading-6"
              :aria-label="t('playground.actions.edit')"
            ></textarea>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn btn-secondary btn-sm" @click="editing = false">{{ t('common.cancel') }}</button>
              <button type="button" class="btn btn-primary btn-sm" :disabled="!editValue.trim()" @click="saveEdit">{{ t('playground.actions.saveAndSend') }}</button>
            </div>
          </div>

          <template v-else>
            <details v-if="message.reasoning" class="border-l-2 border-slate-300 pl-3 dark:border-slate-600">
              <summary class="cursor-pointer select-none text-xs font-medium text-slate-600 dark:text-slate-300">
                {{ t('playground.message.reasoning') }}
              </summary>
              <div class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 dark:text-dark-300">{{ message.reasoning }}</div>
            </details>

            <div
              v-if="message.content"
              ref="markdownRef"
              class="playground-markdown prose prose-sm max-w-none break-words"
              :class="[
                message.reasoning ? 'mt-2.5' : '',
                message.role === 'user' ? 'prose-invert text-white' : 'text-gray-800 dark:prose-invert dark:text-dark-100',
              ]"
              @click="handleMarkdownClick"
              v-html="renderedContent"
            ></div>

            <div
              v-if="message.kind === 'image' && message.images?.length"
              class="mt-1 grid grid-cols-1 gap-2.5"
              :class="message.images.length > 1 ? 'sm:grid-cols-2' : 'max-w-[34rem]'"
            >
              <figure
                v-for="(image, imageIndex) in message.images"
                :key="image.id"
                class="relative min-w-0 overflow-hidden rounded-[4px] border border-gray-200 bg-gray-50 dark:border-dark-600 dark:bg-dark-900"
                :style="{ aspectRatio: imageAspectRatio }"
              >
                <button
                  type="button"
                  class="block h-full w-full cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  :aria-label="t('playground.image.previewLabel', { index: imageIndex + 1 })"
                  @click="previewImage = image"
                >
                  <img
                    :src="image.url"
                    :alt="t('playground.image.resultAlt', { index: imageIndex + 1 })"
                    class="h-full w-full object-contain"
                    loading="lazy"
                  />
                </button>
                <div class="absolute bottom-2 right-2 flex items-center gap-1 rounded-[3px] bg-gray-950/75 p-1 text-white shadow-sm">
                  <button type="button" class="image-action" :title="t('playground.image.preview')" :aria-label="t('playground.image.preview')" @click="previewImage = image">
                    <Icon name="eye" size="sm" />
                  </button>
                  <button v-if="image.sourceUrl" type="button" class="image-action" :title="t('playground.image.copyUrl')" :aria-label="t('playground.image.copyUrl')" @click="copyImageUrl(image.sourceUrl)">
                    <Icon :name="copiedValue === image.sourceUrl ? 'check' : 'copy'" size="sm" />
                  </button>
                  <button type="button" class="image-action" :title="t('playground.image.download')" :aria-label="t('playground.image.download')" @click="downloadImage(image, imageIndex)">
                    <Icon name="download" size="sm" />
                  </button>
                </div>
              </figure>
            </div>

            <div
              v-else-if="message.kind === 'image' && message.status === 'streaming'"
              class="grid grid-cols-1 gap-2.5"
              :class="imagePlaceholderCount > 1 ? 'sm:grid-cols-2' : 'max-w-[34rem]'"
              aria-live="polite"
            >
              <div
                v-for="index in imagePlaceholderCount"
                :key="index"
                class="image-skeleton relative overflow-hidden rounded-[4px] border border-gray-200 bg-gray-100 dark:border-dark-600 dark:bg-dark-700"
                :style="{ aspectRatio: imageAspectRatio }"
              >
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-dark-400">
                  <Icon name="sparkles" size="lg" class="animate-pulse" />
                  <span class="text-xs">{{ t('playground.image.generating') }}</span>
                </div>
              </div>
            </div>

            <div v-else-if="message.status === 'streaming'" class="flex items-center gap-2 py-1 text-sm text-gray-500 dark:text-dark-400">
              <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500"></span>
              {{ t('playground.message.generating') }}
            </div>

            <div v-if="message.error" class="flex items-start gap-2 border-l-2 border-red-400 bg-red-50/70 px-3 py-2 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
              <Icon name="exclamationCircle" size="sm" class="mt-0.5 flex-none" />
              <span class="min-w-0 break-words">{{ message.error }}</span>
            </div>
          </template>
        </div>

        <div v-if="message.role === 'assistant'" class="mt-2 w-full min-w-0 px-0.5">
            <div v-if="message.kind === 'image'" class="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-dark-500">
              <span v-if="message.imageSize">{{ message.imageSize.replace('x', ' × ') }}</span>
              <span v-if="message.imageQuality">{{ t(`playground.image.quality${capitalize(message.imageQuality)}`) }}</span>
              <span v-if="message.imageFormat">{{ message.imageFormat.toUpperCase() }}</span>
              <span v-if="message.images?.length">{{ t('playground.image.resultCount', { count: message.images.length }) }}</span>
            </div>
            <div class="grid min-w-0 grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-gray-500 sm:flex sm:flex-wrap sm:items-center dark:text-dark-400">
              <span v-if="message.model" class="metric-item w-full max-w-full sm:w-auto">
                <span class="metric-label">{{ t('playground.message.model') }}</span>
                <code class="min-w-0 flex-1 max-w-[min(24rem,70vw)] truncate sm:flex-none" :title="message.model">{{ message.model }}</code>
              </span>
              <span class="metric-item"><span class="metric-label">{{ t('playground.message.firstToken') }}</span>{{ formatDuration(message.firstTokenMs) }}</span>
              <span class="metric-item"><span class="metric-label">{{ t('playground.message.duration') }}</span>{{ formatDuration(message.durationMs) }}</span>
              <span class="metric-item"><span class="metric-label">{{ t('playground.message.speed') }}</span>{{ formatSpeed(message.tokensPerSecond) }}</span>
              <span class="metric-item"><span class="metric-label">{{ t('playground.message.requestedAt') }}</span>{{ formatTimestamp(message.requestStartedAt) }}</span>
            </div>

            <div class="mt-1.5 flex flex-wrap items-start justify-between gap-2">
              <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-dark-500">
                <span v-if="inputTokens !== undefined">{{ t('playground.message.inputTokens') }} {{ formatTokens(inputTokens) }}</span>
                <span v-if="outputTokens !== undefined">{{ t('playground.message.outputTokens') }} {{ formatTokens(outputTokens) }}</span>
                <span v-if="message.usage?.total_tokens !== undefined">{{ t('playground.message.totalTokens') }} {{ formatTokens(message.usage.total_tokens) }}</span>
                <span v-if="message.status === 'stopped'" class="text-orange-600 dark:text-orange-400">{{ t('playground.message.stopped') }}</span>
              </div>

              <details v-if="hasTechnicalDetails" class="w-full min-w-0 max-w-full text-[11px] text-gray-500 sm:w-auto dark:text-dark-400">
                <summary class="flex cursor-pointer list-none items-center gap-1 select-none hover:text-primary-600 dark:hover:text-primary-300">
                  <Icon name="chevronDown" size="sm" class="details-chevron" />
                  {{ t('playground.message.details') }}
                </summary>
                <dl class="mt-2 grid min-w-0 gap-1 border-l border-gray-200 pl-2.5 dark:border-dark-600">
                  <div v-if="message.model" class="flex min-w-0 items-center gap-2">
                    <dt class="flex-none">{{ t('playground.message.model') }}</dt>
                    <dd class="flex min-w-0 items-center gap-1">
                      <code class="min-w-0 truncate" :title="message.model">{{ message.model }}</code>
                      <button type="button" class="metadata-copy" :title="copyValueLabel(t('playground.message.model'))" :aria-label="copyValueLabel(t('playground.message.model'))" @click="copyValue(message.model)">
                        <Icon :name="copiedValue === message.model ? 'check' : 'copy'" size="sm" />
                      </button>
                    </dd>
                  </div>
                  <div v-if="message.finishReason" class="flex min-w-0 gap-2">
                    <dt class="flex-none">{{ t('playground.message.finishReason') }}</dt>
                    <dd class="min-w-0 break-words">{{ message.finishReason }}</dd>
                  </div>
                  <div v-if="message.requestId" class="flex min-w-0 items-center gap-2">
                    <dt class="flex-none">{{ t('playground.message.requestId') }}</dt>
                    <dd class="flex min-w-0 items-center gap-1">
                      <code class="min-w-0 truncate" :title="message.requestId">{{ message.requestId }}</code>
                      <button type="button" class="metadata-copy" :title="copyValueLabel(t('playground.message.requestId'))" :aria-label="copyValueLabel(t('playground.message.requestId'))" @click="copyValue(message.requestId)">
                        <Icon :name="copiedValue === message.requestId ? 'check' : 'copy'" size="sm" />
                      </button>
                    </dd>
                  </div>
                  <div v-if="message.responseId" class="flex min-w-0 items-center gap-2">
                    <dt class="flex-none">{{ t('playground.message.responseId') }}</dt>
                    <dd class="flex min-w-0 items-center gap-1">
                      <code class="min-w-0 truncate" :title="message.responseId">{{ message.responseId }}</code>
                      <button type="button" class="metadata-copy" :title="copyValueLabel(t('playground.message.responseId'))" :aria-label="copyValueLabel(t('playground.message.responseId'))" @click="copyValue(message.responseId)">
                        <Icon :name="copiedValue === message.responseId ? 'check' : 'copy'" size="sm" />
                      </button>
                    </dd>
                  </div>
                </dl>
              </details>
            </div>
        </div>

        <div class="message-actions mt-1 flex justify-end gap-0.5">
            <button v-if="message.content" type="button" class="message-action" :title="t('playground.actions.copy')" :aria-label="t('playground.actions.copy')" @click="copyMessage">
              <Icon :name="copied ? 'check' : 'copy'" size="sm" />
            </button>
            <button v-if="message.role === 'user'" type="button" class="message-action" :disabled="disabled" :title="t('playground.actions.edit')" :aria-label="t('playground.actions.edit')" @click="startEdit">
              <Icon name="edit" size="sm" />
            </button>
            <button v-else type="button" class="message-action" :disabled="disabled" :title="t('playground.actions.regenerate')" :aria-label="t('playground.actions.regenerate')" @click="emit('regenerate')">
              <Icon name="refresh" size="sm" />
            </button>
            <button type="button" class="message-action message-action-danger" :disabled="disabled" :title="t('playground.actions.delete')" :aria-label="t('playground.actions.delete')" @click="emit('delete')">
              <Icon name="trash" size="sm" />
            </button>
        </div>
      </div>
    </div>

    <BaseDialog
      :show="Boolean(previewImage)"
      :title="t('playground.image.previewTitle')"
      width="wide"
      close-on-click-outside
      @close="previewImage = null"
    >
      <div v-if="previewImage" class="space-y-3">
        <div class="flex max-h-[76dvh] min-h-48 items-center justify-center overflow-hidden rounded-[4px] border border-gray-200 bg-gray-50 dark:border-dark-600 dark:bg-dark-900">
          <img :src="previewImage.url" :alt="t('playground.image.previewTitle')" class="max-h-[76dvh] max-w-full object-contain" />
        </div>
        <p v-if="previewImage.revisedPrompt" class="text-sm leading-6 text-gray-600 dark:text-dark-300">{{ previewImage.revisedPrompt }}</p>
        <div class="flex justify-end gap-2">
          <button v-if="previewImage.sourceUrl" type="button" class="btn btn-secondary btn-sm" @click="copyImageUrl(previewImage.sourceUrl)">
            <Icon name="copy" size="sm" class="mr-1.5" />
            {{ t('playground.image.copyUrl') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" @click="downloadImage(previewImage, previewImageIndex)">
            <Icon name="download" size="sm" class="mr-1.5" />
            {{ t('playground.image.download') }}
          </button>
        </div>
      </div>
    </BaseDialog>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import type { PlaygroundImageAsset, PlaygroundMessage } from '@/types/playground'

const props = defineProps<{ message: PlaygroundMessage; disabled?: boolean }>()
const emit = defineEmits<{
  (event: 'edit', value: string): void
  (event: 'regenerate'): void
  (event: 'delete'): void
}>()
const { t } = useI18n()
const appStore = useAppStore()
const editing = ref(false)
const editValue = ref('')
const copied = ref(false)
const copiedValue = ref('')
const markdownRef = ref<HTMLElement | null>(null)
const previewImage = ref<PlaygroundImageAsset | null>(null)

marked.setOptions({ breaks: true, gfm: true })

const hasTechnicalDetails = computed(() => Boolean(props.message.model || props.message.finishReason || props.message.requestId || props.message.responseId))
const inputTokens = computed(() => props.message.usage?.prompt_tokens ?? props.message.usage?.input_tokens)
const outputTokens = computed(() => props.message.usage?.completion_tokens ?? props.message.usage?.output_tokens)
const imagePlaceholderCount = computed(() => Math.min(4, Math.max(1, props.message.imageCount || 1)))
const messageImageCount = computed(() => props.message.images?.length || imagePlaceholderCount.value)
const wideAssistantMessage = computed(() => props.message.role === 'assistant'
  && props.message.kind === 'image'
  && (Boolean(props.message.images?.length) || props.message.status === 'streaming'))
const imageAspectRatio = computed(() => {
  if (props.message.imageSize === '1536x1024') return '3 / 2'
  if (props.message.imageSize === '1024x1536') return '2 / 3'
  return '1 / 1'
})
const previewImageIndex = computed(() => Math.max(0, props.message.images?.findIndex((image) => image.id === previewImage.value?.id) ?? 0))

function isSafeLink(value: string): boolean {
  const href = value.trim()
  if (!href) return false
  if ((href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#')) return true
  try {
    const parsed = new URL(href, window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

const renderedContent = computed(() => {
  const sanitized = DOMPurify.sanitize(marked.parse(props.message.content || '') as string, {
    FORBID_TAGS: ['style', 'svg', 'math', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  })
  const template = document.createElement('template')
  template.innerHTML = sanitized
  for (const anchor of template.content.querySelectorAll<HTMLAnchorElement>('a')) {
    const href = anchor.getAttribute('href') || ''
    if (!isSafeLink(href)) {
      anchor.removeAttribute('href')
      anchor.removeAttribute('target')
      anchor.removeAttribute('rel')
      continue
    }
    if (!href.startsWith('#')) {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    }
  }
  return template.innerHTML
})

function decorateCodeBlocks(): void {
  for (const pre of markdownRef.value?.querySelectorAll('pre') || []) {
    if (pre.querySelector('[data-copy-code]')) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.copyCode = '1'
    button.className = 'playground-code-copy'
    button.textContent = t('playground.actions.copyCode')
    button.setAttribute('aria-label', t('playground.actions.copyCode'))
    pre.appendChild(button)
  }
}

watch(renderedContent, () => void nextTick(decorateCodeBlocks), { immediate: true })

async function handleMarkdownClick(event: MouseEvent): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-code]')
  if (!button) return
  const code = button.parentElement?.querySelector('code')?.textContent || ''
  try {
    await navigator.clipboard.writeText(code)
    button.textContent = t('playground.actions.copied')
    window.setTimeout(() => { button.textContent = t('playground.actions.copyCode') }, 1200)
  } catch {
    appStore.showError(t('playground.errors.clipboard'))
  }
}

async function copyMessage(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.message.content || props.message.reasoning || '')
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 1200)
  } catch {
    appStore.showError(t('playground.errors.clipboard'))
  }
}

function copyValueLabel(label: string): string {
  return t('playground.actions.copyValue', { label })
}

async function copyValue(value: string | undefined): Promise<void> {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copiedValue.value = value
    window.setTimeout(() => { if (copiedValue.value === value) copiedValue.value = '' }, 1200)
  } catch {
    appStore.showError(t('playground.errors.clipboard'))
  }
}

function copyImageUrl(value: string): void {
  void copyValue(value)
}

function triggerImageDownload(href: string, filename: string, openInNewTab = false): void {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener noreferrer'
  if (openInNewTab) link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadImage(image: PlaygroundImageAsset, index: number): Promise<void> {
  const extension = props.message.imageFormat || (image.mimeType === 'image/jpeg' ? 'jpeg' : image.mimeType.split('/')[1]) || 'png'
  const filename = `playground-${Date.now()}-${index + 1}.${extension}`
  if (!image.sourceUrl) {
    triggerImageDownload(image.url, filename)
    return
  }

  try {
    const response = await fetch(image.url, { credentials: 'omit' })
    if (!response.ok) throw new Error(`Image download failed (${response.status})`)
    const objectUrl = URL.createObjectURL(await response.blob())
    const revokeObjectUrl = typeof URL.revokeObjectURL === 'function'
      ? URL.revokeObjectURL.bind(URL)
      : null
    triggerImageDownload(objectUrl, filename)
    if (revokeObjectUrl) window.setTimeout(() => revokeObjectUrl(objectUrl), 0)
  } catch {
    triggerImageDownload(image.url, filename, true)
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function startEdit(): void {
  editValue.value = props.message.content
  editing.value = true
}

function saveEdit(): void {
  if (!editValue.value.trim()) return
  editing.value = false
  emit('edit', editValue.value)
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms)) return t('playground.message.unavailable')
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
}

function formatSpeed(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return t('playground.message.unavailable')
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} tok/s`
}

function formatTokens(value: number): string {
  return value.toLocaleString()
}

function formatTimestamp(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return t('playground.message.unavailable')
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>

<style scoped>
.message-action { @apply flex h-7 w-7 items-center justify-center rounded-[3px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-dark-500 dark:hover:bg-dark-700 dark:hover:text-dark-200; }
.message-action-danger { @apply hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400; }
.image-action { @apply flex h-7 w-7 items-center justify-center rounded-[3px] text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50; }
.image-skeleton { animation: playground-image-pulse 1.6s ease-in-out infinite; }
.metric-item { @apply inline-flex min-w-0 items-center gap-1; }
.metric-label { @apply flex-none whitespace-nowrap text-gray-400 dark:text-dark-500; }
.metadata-copy { @apply flex h-5 w-5 flex-none items-center justify-center rounded-[3px] text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-dark-700 dark:hover:text-primary-300; }
.details-chevron { transition: transform 140ms ease; }
details[open] .details-chevron { transform: rotate(180deg); }
:deep(.playground-markdown > :first-child) { margin-top: 0; }
:deep(.playground-markdown > :last-child) { margin-bottom: 0; }
:deep(.playground-markdown pre) { @apply relative overflow-x-auto rounded-[3px] border border-gray-200 bg-gray-950 p-4 pt-9 text-gray-100 dark:border-dark-600; }
:deep(.playground-markdown code:not(pre code)) { @apply rounded-[3px] bg-gray-100 px-1 py-0.5 text-[0.9em] text-primary-700 dark:bg-dark-700 dark:text-primary-300; }
:deep(.playground-code-copy) { @apply absolute right-2 top-2 rounded-[3px] border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-gray-200 hover:bg-white/20; }
@media (hover: hover) and (pointer: fine) {
  .message-actions { opacity: 0; transition: opacity 140ms ease; }
  article:hover .message-actions,
  article:focus-within .message-actions { opacity: 1; }
}
@keyframes playground-image-pulse { 0%, 100% { opacity: 0.72; } 50% { opacity: 1; } }
</style>
