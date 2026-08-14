<template>
  <Teleport to="body">
    <Transition name="playground-panel">
      <div
        v-if="show"
        class="playground-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <button
          type="button"
          class="playground-panel__backdrop"
          :aria-label="t('common.close')"
          @click="emit('close')"
        ></button>
        <aside
          ref="panelRef"
          class="playground-panel__sheet"
          tabindex="-1"
        >
          <header class="playground-panel__header">
            <div class="playground-panel__heading">
              <h2 :id="titleId">
                {{ imageMode ? t('playground.image.parametersTitle') : t('playground.parameters.title') }}
              </h2>
              <p>
                {{ imageMode ? t('playground.image.parametersDescription') : t('playground.parameters.description') }}
              </p>
            </div>
            <UiIconButton
              icon="x"
              variant="ghost"
              density="compact"
              :label="t('common.close')"
              data-panel-close
              @click="emit('close')"
            />
          </header>

          <div v-if="imageMode" class="playground-panel__body">
            <div class="playground-panel__hint">
              <Icon name="sparkles" size="sm" />
              <p>
                  {{ t('playground.image.parametersHint') }}
              </p>
            </div>

            <div class="playground-panel__grid">
              <UiSelect v-model="model.imageSize" :label="t('playground.image.size')" :options="imageSizeOptions" density="compact" />
              <UiSelect v-model="model.imageQuality" :label="t('playground.image.quality')" :options="imageQualityOptions" density="compact" />
              <UiSelect v-model="model.imageFormat" :label="t('playground.image.format')" :options="imageFormatOptions" density="compact" />
            <UiSelect :model-value="model.imageCount" :label="t('playground.image.count')" :options="imageCountOptions" density="compact" @update:model-value="model.imageCount = Number($event)" />
            </div>
          </div>

          <div v-else class="playground-panel__body">
            <UiTextArea
                id="playground-system-prompt"
                v-model="model.systemPrompt"
                :label="t('playground.parameters.systemPrompt')"
                :placeholder="t('playground.parameters.systemPromptPlaceholder')"
                :rows="5"
            />

            <ParameterField v-model:enabled="model.parameterEnabled.temperature" :label="t('playground.parameters.temperature')">
              <div class="parameter-range">
                <UiSlider :model-value="model.temperature" :min="0" :max="2" :step="0.1" @update:model-value="model.temperature = $event" />
                <UiTextField :model-value="model.temperature" type="number" min="0" max="2" step="0.1" density="dense" text-align="right" @update:model-value="model.temperature = Number($event)" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.top_p" :label="t('playground.parameters.topP')">
              <div class="parameter-range">
                <UiSlider :model-value="model.top_p" :min="0" :max="1" :step="0.05" @update:model-value="model.top_p = $event" />
                <UiTextField :model-value="model.top_p" type="number" min="0" max="1" step="0.05" density="dense" text-align="right" @update:model-value="model.top_p = Number($event)" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.max_tokens" :label="t('playground.parameters.maxTokens')">
              <UiTextField :model-value="model.max_tokens" type="number" min="1" max="131072" step="1" density="dense" text-align="right" @update:model-value="model.max_tokens = Number($event)" />
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.frequency_penalty" :label="t('playground.parameters.frequencyPenalty')">
              <div class="parameter-range">
                <UiSlider :model-value="model.frequency_penalty" :min="-2" :max="2" :step="0.1" @update:model-value="model.frequency_penalty = $event" />
                <UiTextField :model-value="model.frequency_penalty" type="number" min="-2" max="2" step="0.1" density="dense" text-align="right" @update:model-value="model.frequency_penalty = Number($event)" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.presence_penalty" :label="t('playground.parameters.presencePenalty')">
              <div class="parameter-range">
                <UiSlider :model-value="model.presence_penalty" :min="-2" :max="2" :step="0.1" @update:model-value="model.presence_penalty = $event" />
                <UiTextField :model-value="model.presence_penalty" type="number" min="-2" max="2" step="0.1" density="dense" text-align="right" @update:model-value="model.presence_penalty = Number($event)" />
              </div>
            </ParameterField>
            <ParameterField v-model:enabled="model.parameterEnabled.seed" :label="t('playground.parameters.seed')">
              <UiTextField :model-value="model.seed ?? ''" type="number" step="1" density="dense" text-align="right" @update:model-value="model.seed = $event === '' ? null : Number($event)" />
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
import { UiIconButton, UiSelect, UiSlider, UiTextArea, UiTextField } from '@/components/ui'
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
const imageSizeOptions = [
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1536x1024', label: '1536 × 1024' },
  { value: '1024x1536', label: '1024 × 1536' },
]
const imageQualityOptions = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]
const imageFormatOptions = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
]
const imageCountOptions = [1, 2, 3, 4].map((value) => ({ value, label: String(value) }))
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
  panelRef.value?.querySelector<HTMLButtonElement>('[data-panel-close]')?.focus()
}, { immediate: true })

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  closeRegistration()
})
</script>

<style scoped>
.playground-panel {
  position: fixed;
  inset: 0;
  z-index: 100000010;
}

.playground-panel__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgb(20 18 16 / 35%);
  cursor: default;
}

.playground-panel__sheet {
  position: absolute;
  inset: 0 0 0 auto;
  display: flex;
  width: min(100%, 360px);
  flex-direction: column;
  overflow-y: auto;
  border-left: 1px solid var(--ui-border);
  color: var(--ui-text);
  background: var(--ui-surface);
  box-shadow: -10px 0 28px rgb(31 35 41 / 10%);
}

.playground-panel__header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ui-border-soft);
  background: var(--ui-surface);
}

.playground-panel__heading {
  min-width: 0;
}

.playground-panel__heading h2 {
  margin: 0;
  color: var(--ui-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.playground-panel__heading p {
  margin: 2px 0 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.playground-panel__body {
  display: grid;
  gap: 20px;
  padding: 16px 16px max(16px, env(safe-area-inset-bottom));
}

.playground-panel__hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--ui-border-soft);
  color: var(--ui-info);
}

.playground-panel__hint p {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.playground-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}

.parameter-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  gap: 12px;
  align-items: center;
}

.playground-panel-enter-active,
.playground-panel-leave-active {
  transition: opacity var(--ui-motion-base) var(--ui-ease-standard);
}

.playground-panel-enter-active .playground-panel__sheet,
.playground-panel-leave-active .playground-panel__sheet {
  transition: transform var(--ui-motion-base) var(--ui-ease-enter);
}

.playground-panel-enter-from,
.playground-panel-leave-to {
  opacity: 0;
}

.playground-panel-enter-from .playground-panel__sheet,
.playground-panel-leave-to .playground-panel__sheet {
  transform: translateX(16px);
}

@media (max-width: 560px) {
  .playground-panel__sheet {
    inset: auto 0 0;
    width: 100%;
    max-height: 82dvh;
    border-top: 1px solid var(--ui-border);
    border-left: 0;
    border-radius: var(--ui-radius-panel) var(--ui-radius-panel) 0 0;
    box-shadow: 0 -10px 28px rgb(31 35 41 / 10%);
  }

  .playground-panel-enter-from .playground-panel__sheet,
  .playground-panel-leave-to .playground-panel__sheet {
    transform: translateY(16px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .playground-panel-enter-active,
  .playground-panel-leave-active,
  .playground-panel-enter-active .playground-panel__sheet,
  .playground-panel-leave-active .playground-panel__sheet {
    transition: none;
  }
}
</style>
