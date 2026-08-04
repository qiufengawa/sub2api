<template>
  <section class="playground-composer-shell flex-none">
    <div class="mx-auto w-full max-w-5xl px-3 pb-3 pt-1 sm:px-5 sm:pb-4 sm:pt-1.5">
      <div class="playground-composer-surface overflow-hidden rounded-[4px] border border-gray-300 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.06)] transition-colors focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/10 dark:border-dark-600 dark:bg-dark-800 dark:focus-within:border-primary-500">
        <div class="grid min-w-0 grid-cols-1 gap-1.5 border-b border-gray-100 px-2.5 py-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_auto] lg:items-center dark:border-dark-700">
          <Select
            :model-value="keyId"
            class="min-w-0"
            :options="keyOptions"
            value-key="value"
            label-key="label"
            :disabled="generating || loadingKeys"
            :placeholder="loadingKeys ? t('common.loading') : t('playground.composer.selectKey')"
            :empty-text="t('playground.empty.noKeys')"
            :aria-label="t('playground.composer.selectKey')"
            @update:model-value="emit('selectKey', $event)"
          >
            <template #selected="{ option }">
              <span class="flex min-w-0 items-center gap-1.5">
                <Icon name="key" size="xs" class="flex-none text-gray-400" />
                <span class="min-w-0 flex-1 truncate" :title="keyTitle(option)">{{ option?.label }}</span>
                <span v-if="option?.group" class="hidden max-w-32 flex-none truncate text-[10px] text-gray-400 xl:block dark:text-dark-400" :title="String(option.group)">
                  {{ option.group }}
                </span>
              </span>
            </template>
            <template #option="{ option, selected }">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm" :title="String(option.label || '')">{{ option.label }}</div>
                <div v-if="option.group" class="mt-0.5 truncate text-[11px] text-gray-400" :title="keyMeta(option)">
                  {{ keyMeta(option) }}
                </div>
              </div>
              <Icon v-if="selected" name="check" size="sm" class="flex-none text-primary-500" />
            </template>
          </Select>

          <Select
            :model-value="model"
            class="min-w-0"
            :options="modelOptions"
            value-key="value"
            label-key="label"
            :disabled="generating || loadingModels || !selectedKey"
            :placeholder="loadingModels ? t('common.loading') : t('playground.composer.selectModel')"
            :empty-text="t('playground.empty.noModels')"
            :aria-label="t('playground.composer.selectModel')"
            searchable
            @update:model-value="selectModel"
          >
            <template #selected="{ option }">
              <span class="flex min-w-0 items-center gap-1.5">
                <Icon v-if="option?.image" name="sparkles" size="xs" class="flex-none text-primary-500" />
                <span class="block min-w-0 truncate font-mono text-xs" :title="String(option?.label || '')">{{ option?.label }}</span>
              </span>
            </template>
            <template #option="{ option, selected }">
              <Icon v-if="option.image" name="sparkles" size="xs" class="flex-none text-primary-500" />
              <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="String(option.label || '')">{{ option.label }}</span>
              <Icon v-if="selected" name="check" size="sm" class="flex-none text-primary-500" />
            </template>
          </Select>

          <div class="flex min-w-0 items-center justify-between gap-3 px-0.5 text-[11px] text-gray-500 sm:col-span-2 lg:col-span-1 lg:min-w-44 lg:justify-end dark:text-dark-400">
            <span class="min-w-0 truncate" :title="selectedKeyMeta">
              {{ selectedKeyMeta || t('playground.composer.noGroup') }}
            </span>
            <span v-if="imageMode" class="inline-flex flex-none items-center gap-1.5 whitespace-nowrap font-medium text-primary-600 dark:text-primary-300">
              <Icon name="sparkles" size="xs" />
              {{ t('playground.image.mode') }}
            </span>
            <label v-else class="inline-flex flex-none items-center gap-2 whitespace-nowrap">
              <Toggle
                :model-value="stream"
                :disabled="generating"
                :aria-label="t('playground.composer.stream')"
                @update:model-value="emit('updateStream', $event)"
              />
              <span>{{ stream ? t('playground.composer.stream') : t('playground.composer.nonStream') }}</span>
            </label>
          </div>
        </div>

        <textarea
          ref="inputRef"
          v-model="draft"
          rows="1"
          class="block max-h-44 min-h-14 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2.5 text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-dark-500"
          :placeholder="placeholder"
          :aria-label="placeholder"
          @input="resizeInput"
          @keydown.enter="handleEnter"
        ></textarea>

        <div class="flex min-w-0 items-center justify-between gap-2 border-t border-gray-100 px-2.5 py-1.5 dark:border-dark-700">
          <div class="flex min-w-0 items-center gap-1">
            <span class="mr-1 inline-flex flex-none items-center gap-1.5 text-[11px] text-gray-500 dark:text-dark-400" aria-live="polite">
              <span
                class="h-1.5 w-1.5 flex-none rounded-full"
                :class="generating ? 'bg-primary-500' : optionsError ? 'bg-red-500' : 'bg-green-500'"
              ></span>
              <span class="sr-only">{{ sessionStatus }}</span>
              <span class="hidden sm:inline" aria-hidden="true">{{ sessionStatus }}</span>
            </span>
            <button
              type="button"
              class="relative flex h-8 w-8 flex-none items-center justify-center rounded-[3px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-dark-700 dark:hover:text-primary-300"
              :disabled="generating"
              :title="parameterTitle"
              :aria-label="parameterTitle"
              @click="emit('openParameters')"
            >
              <Icon name="cog" size="sm" />
              <span
                v-if="enabledParameterCount"
                class="absolute -right-0.5 -top-0.5 min-w-3.5 rounded-[3px] bg-primary-100 px-0.5 text-center text-[9px] font-medium leading-3.5 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
              >
                {{ enabledParameterCount }}
              </span>
            </button>
            <button
              type="button"
              class="flex h-8 w-8 flex-none items-center justify-center rounded-[3px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-dark-700 dark:hover:text-primary-300"
              :title="t('playground.actions.requestJson')"
              :aria-label="t('playground.actions.requestJson')"
              @click="emit('openPreview')"
            >
              <Icon name="document" size="sm" />
            </button>
            <button
              type="button"
              class="flex h-8 w-8 flex-none items-center justify-center rounded-[3px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-dark-700 dark:hover:text-primary-300"
              :disabled="!hasMessages"
              :title="t('playground.actions.newConversation')"
              :aria-label="t('playground.actions.newConversation')"
              @click="emit('newConversation')"
            >
              <Icon name="plus" size="sm" />
            </button>
            <span v-if="imageMode" class="ml-1 hidden min-w-0 truncate border-l border-gray-200 pl-2 text-[11px] text-gray-500 sm:block dark:border-dark-600 dark:text-dark-400" :title="imageSummary">
              {{ imageSummary }}
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
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Icon from '@/components/icons/Icon.vue'
import type {
  PlaygroundImageFormat,
  PlaygroundImageQuality,
  PlaygroundImageSize,
  PlaygroundKeyOption,
} from '@/types/playground'

interface ComposerKeyOption {
  [key: string]: unknown
  value: number
  label: string
  group?: string
  platform?: string
  disabled?: boolean
}

interface ComposerModelOption {
  [key: string]: unknown
  value: string
  label: string
  image?: boolean
}

const props = defineProps<{
  keyId: number | null
  keyOptions: ComposerKeyOption[]
  modelOptions: ComposerModelOption[]
  selectedKey: PlaygroundKeyOption | null
  model: string
  stream: boolean
  loadingKeys: boolean
  loadingModels: boolean
  generating: boolean
  canSend: boolean
  hasMessages: boolean
  optionsError: boolean
  sessionStatus: string
  parameterTitle: string
  enabledParameterCount: number
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
  (event: 'selectKey', value: string | number | boolean | null): void
  (event: 'selectModel', value: string): void
  (event: 'updateStream', value: boolean): void
  (event: 'openParameters'): void
  (event: 'openPreview'): void
  (event: 'newConversation'): void
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
const selectedKeyMeta = computed(() => {
  if (!props.selectedKey) return ''
  return [props.selectedKey.group_name, props.selectedKey.platform].filter(Boolean).join(' / ')
})

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function keyMeta(option: Partial<ComposerKeyOption> | null | undefined): string {
  return [option?.group, option?.platform].filter(Boolean).join(' / ')
}

function keyTitle(option: Partial<ComposerKeyOption> | null | undefined): string {
  return [option?.label, keyMeta(option)].filter(Boolean).join(' / ')
}

function selectModel(value: string | number | boolean | null): void {
  emit('selectModel', typeof value === 'string' ? value : '')
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
