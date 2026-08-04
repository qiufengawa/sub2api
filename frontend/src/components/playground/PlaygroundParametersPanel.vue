<template>
  <Teleport to="body">
    <Transition name="playground-panel">
      <div
        v-if="show"
        class="fixed inset-0 z-[100000010]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/35"
          :aria-label="t('common.close')"
          @click="emit('close')"
        ></button>
        <aside
          ref="panelRef"
          class="absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-[4px] border border-gray-200 bg-white sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[360px] sm:rounded-none dark:border-dark-700 dark:bg-dark-800"
          tabindex="-1"
        >
          <header class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 dark:border-dark-700 dark:bg-dark-800">
            <div class="min-w-0">
              <h2 :id="titleId" class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ imageMode ? t('playground.image.parametersTitle') : t('playground.parameters.title') }}
              </h2>
              <p class="mt-0.5 text-xs leading-5 text-gray-500 dark:text-dark-400">
                {{ imageMode ? t('playground.image.parametersDescription') : t('playground.parameters.description') }}
              </p>
            </div>
            <button
              ref="closeButtonRef"
              type="button"
              class="btn btn-ghost btn-icon flex-none"
              :title="t('common.close')"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              <Icon name="x" size="md" />
            </button>
          </header>

          <div v-if="imageMode" class="space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div class="border-b border-gray-100 pb-4 dark:border-dark-700">
              <div class="flex items-start gap-2.5">
                <Icon name="sparkles" size="sm" class="mt-0.5 flex-none text-primary-600 dark:text-primary-300" />
                <p class="text-xs leading-5 text-gray-600 dark:text-dark-300">
                  {{ t('playground.image.parametersHint') }}
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label class="block min-w-0">
                <span class="input-label">{{ t('playground.image.size') }}</span>
                <select v-model="model.imageSize" class="input h-10 text-sm">
                  <option value="1024x1024">1024 × 1024</option>
                  <option value="1536x1024">1536 × 1024</option>
                  <option value="1024x1536">1024 × 1536</option>
                </select>
              </label>
              <label class="block min-w-0">
                <span class="input-label">{{ t('playground.image.quality') }}</span>
                <select v-model="model.imageQuality" class="input h-10 text-sm">
                  <option value="auto">{{ t('playground.image.qualityAuto') }}</option>
                  <option value="low">{{ t('playground.image.qualityLow') }}</option>
                  <option value="medium">{{ t('playground.image.qualityMedium') }}</option>
                  <option value="high">{{ t('playground.image.qualityHigh') }}</option>
                </select>
              </label>
              <label class="block min-w-0">
                <span class="input-label">{{ t('playground.image.format') }}</span>
                <select v-model="model.imageFormat" class="input h-10 text-sm">
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
              <label class="block min-w-0">
                <span class="input-label">{{ t('playground.image.count') }}</span>
                <select v-model.number="model.imageCount" class="input h-10 text-sm">
                  <option :value="1">1</option>
                  <option :value="2">2</option>
                  <option :value="3">3</option>
                  <option :value="4">4</option>
                </select>
              </label>
            </div>
          </div>

          <div v-else class="space-y-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div>
              <label class="input-label" for="playground-system-prompt">
                {{ t('playground.parameters.systemPrompt') }}
              </label>
              <textarea
                id="playground-system-prompt"
                v-model="model.systemPrompt"
                rows="5"
                class="input min-h-28 resize-y text-sm leading-6"
                :placeholder="t('playground.parameters.systemPromptPlaceholder')"
              ></textarea>
            </div>

            <ParameterField v-model:enabled="model.parameterEnabled.temperature" :label="t('playground.parameters.temperature')">
              <div class="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
                <input v-model.number="model.temperature" type="range" min="0" max="2" step="0.1" class="w-full accent-primary-600" />
                <input v-model.number="model.temperature" type="number" min="0" max="2" step="0.1" class="input h-9 text-sm" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.top_p" :label="t('playground.parameters.topP')">
              <div class="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
                <input v-model.number="model.top_p" type="range" min="0" max="1" step="0.05" class="w-full accent-primary-600" />
                <input v-model.number="model.top_p" type="number" min="0" max="1" step="0.05" class="input h-9 text-sm" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.max_tokens" :label="t('playground.parameters.maxTokens')">
              <input v-model.number="model.max_tokens" type="number" min="1" max="131072" step="1" class="input h-9 text-sm" />
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.frequency_penalty" :label="t('playground.parameters.frequencyPenalty')">
              <div class="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
                <input v-model.number="model.frequency_penalty" type="range" min="-2" max="2" step="0.1" class="w-full accent-primary-600" />
                <input v-model.number="model.frequency_penalty" type="number" min="-2" max="2" step="0.1" class="input h-9 text-sm" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.presence_penalty" :label="t('playground.parameters.presencePenalty')">
              <div class="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3">
                <input v-model.number="model.presence_penalty" type="range" min="-2" max="2" step="0.1" class="w-full accent-primary-600" />
                <input v-model.number="model.presence_penalty" type="number" min="-2" max="2" step="0.1" class="input h-9 text-sm" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.seed" :label="t('playground.parameters.seed')">
              <input v-model.number="model.seed" type="number" step="1" class="input h-9 text-sm" />
            </ParameterField>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { isTopDialog, registerDialog, unregisterDialog } from '@/utils/modalStack'
import ParameterField from './PlaygroundParameterField.vue'
import type { PlaygroundConfig } from '@/types/playground'

const props = defineProps<{ show: boolean; imageMode?: boolean }>()
const model = defineModel<PlaygroundConfig>({ required: true })
const emit = defineEmits<{ (event: 'close'): void }>()
const { t } = useI18n()
const titleId = `playground-parameters-${Math.random().toString(36).slice(2)}`
const dialogId = Symbol(titleId)
const panelRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
let previousActiveElement: HTMLElement | null = null
let registered = false

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(): HTMLElement[] {
  return Array.from(panelRef.value?.querySelectorAll<HTMLElement>(focusableSelector) || [])
    .filter((element) => element.getAttribute('aria-hidden') !== 'true')
}

function closeRegistration(): void {
  if (!registered) return
  const wasTop = unregisterDialog(dialogId)
  registered = false
  if (wasTop && previousActiveElement?.isConnected) previousActiveElement.focus()
  previousActiveElement = null
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.show || !isTopDialog(dialogId)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const elements = focusableElements()
  if (elements.length === 0) {
    event.preventDefault()
    panelRef.value?.focus()
    return
  }
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (event.shiftKey && (document.activeElement === first || !panelRef.value?.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !panelRef.value?.contains(document.activeElement))) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.show, async (show) => {
  if (!show) {
    closeRegistration()
    return
  }
  previousActiveElement = document.activeElement as HTMLElement
  registerDialog(dialogId, 100000010)
  registered = true
  await nextTick()
  closeButtonRef.value?.focus()
}, { immediate: true })

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  closeRegistration()
})
</script>

<style scoped>
.playground-panel-enter-active, .playground-panel-leave-active { transition: opacity 160ms ease; }
.playground-panel-enter-from, .playground-panel-leave-to { opacity: 0; }
</style>
