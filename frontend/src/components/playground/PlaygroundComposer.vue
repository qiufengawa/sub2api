<template>
  <section class="flex-none border-t border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-900">
    <div class="mx-auto w-full max-w-5xl px-3 py-3 sm:px-5 sm:py-4">
      <div class="overflow-hidden rounded-[4px] border border-gray-300 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.06)] transition-colors focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/10 dark:border-dark-600 dark:bg-dark-800 dark:focus-within:border-primary-500">
        <div v-if="imageMode" class="flex min-w-0 items-center gap-2 bg-primary-50/60 px-3 py-2 text-[11px] text-gray-500 dark:bg-primary-950/20 dark:text-dark-400">
          <span class="inline-flex flex-none items-center gap-1.5 font-medium text-primary-700 dark:text-primary-300">
            <Icon name="sparkles" size="sm" />
            {{ t('playground.image.mode') }}
          </span>
          <span class="h-3 w-px flex-none bg-gray-200 dark:bg-dark-600"></span>
          <span class="min-w-0 flex-1 truncate" :title="imageSummary">{{ imageSummary }}</span>
          <button
            type="button"
            class="flex h-7 w-7 flex-none items-center justify-center rounded-[3px] text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-dark-700 dark:hover:text-primary-300"
            :title="t('playground.image.parametersTitle')"
            :aria-label="t('playground.image.parametersTitle')"
            @click="emit('openParameters')"
          >
            <Icon name="cog" size="sm" />
          </button>
        </div>
        <textarea
          ref="inputRef"
          v-model="draft"
          rows="1"
          class="block max-h-44 min-h-14 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-3 text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-dark-500"
          :placeholder="placeholder"
          :aria-label="placeholder"
          @input="resizeInput"
          @keydown.enter="handleEnter"
        ></textarea>
        <div class="flex min-w-0 items-center justify-between gap-3 border-t border-gray-100 px-2.5 py-2 dark:border-dark-700">
          <div class="flex min-w-0 items-center gap-2 text-[11px] text-gray-500 dark:text-dark-400">
            <span class="inline-flex flex-none items-center gap-1.5 whitespace-nowrap">
              <span class="h-1.5 w-1.5 flex-none rounded-full" :class="imageMode || stream ? 'bg-green-500' : 'bg-gray-400'"></span>
              <span>{{ imageMode ? t('playground.image.requestMode') : stream ? t('playground.composer.stream') : t('playground.composer.nonStream') }}</span>
            </span>
            <span v-if="model" class="hidden min-w-0 truncate border-l border-gray-200 pl-2 font-mono sm:block dark:border-dark-600" :title="model">
              {{ model }}
            </span>
          </div>
          <button
            v-if="generating"
            type="button"
            class="flex h-8 w-8 flex-none items-center justify-center rounded-[3px] bg-orange-500 text-white transition-colors hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
            :title="t('playground.actions.stop')"
            :aria-label="t('playground.actions.stop')"
            @click="emit('stop')"
          >
            <Icon name="x" size="sm" :stroke-width="2" />
          </button>
          <button
            v-else
            type="button"
            class="flex h-8 w-8 flex-none items-center justify-center rounded-[3px] bg-primary-600 text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-dark-600"
            :disabled="!canSend || !draft.trim()"
            :title="t('playground.actions.send')"
            :aria-label="t('playground.actions.send')"
            @click="send"
          >
            <Icon :name="imageMode ? 'sparkles' : 'arrowUp'" size="sm" :stroke-width="2" />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { PlaygroundImageFormat, PlaygroundImageQuality, PlaygroundImageSize } from '@/types/playground'

const props = defineProps<{
  model: string
  stream: boolean
  generating: boolean
  canSend: boolean
  imageMode?: boolean
  imageSize?: PlaygroundImageSize
  imageQuality?: PlaygroundImageQuality
  imageFormat?: PlaygroundImageFormat
  imageCount?: number
}>()
const draft = defineModel<string>({ required: true })
const emit = defineEmits<{
  (event: 'submit', content: string): void
  (event: 'stop'): void
  (event: 'openParameters'): void
}>()
const { t } = useI18n()
const inputRef = ref<HTMLTextAreaElement | null>(null)
const placeholder = computed(() => props.imageMode
  ? t('playground.image.placeholder')
  : t('playground.composer.placeholder'))
const imageSummary = computed(() => t('playground.image.summary', {
  size: props.imageSize || '1024x1024',
  quality: t(`playground.image.quality${capitalize(props.imageQuality || 'auto')}`),
  format: (props.imageFormat || 'png').toUpperCase(),
  count: props.imageCount || 1,
}))

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function send(): void {
  const content = draft.value.trim()
  if (!content || !props.canSend || props.generating) return
  emit('submit', content)
  draft.value = ''
  void nextTick(resizeInput)
}

function handleEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  send()
}

function resizeInput(): void {
  const input = inputRef.value
  if (!input) return
  input.style.height = 'auto'
  input.style.height = `${Math.min(input.scrollHeight, 176)}px`
}

watch(draft, () => void nextTick(resizeInput))
</script>
