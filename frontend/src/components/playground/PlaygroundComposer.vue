<template>
  <section class="playground-composer">
    <div class="playground-composer__inner">
      <div class="playground-composer__surface">
        <div class="playground-composer__controls">
          <UiSelect
            :model-value="keyId"
            class="playground-composer__select"
            density="compact"
            :options="keyOptions"
            :disabled="generating || loadingKeys"
            :placeholder="loadingKeys ? t('common.loading') : t('playground.composer.selectKey')"
            :empty-text="t('playground.empty.noKeys')"
            @update:model-value="emit('selectKey', $event)"
          >
            <template #selected="{ option }">
              <span class="composer-option composer-option--selected">
                <Icon name="key" size="xs" />
                <span class="composer-option__label" :title="keyTitle(keyOption(option))">{{ keyOption(option)?.label }}</span>
                <span v-if="keyOption(option)?.group" class="composer-option__meta" :title="String(keyOption(option)?.group)">
                  {{ keyOption(option)?.group }}
                </span>
              </span>
            </template>
            <template #option="{ option, selected }">
              <div class="composer-option__body">
                <div class="composer-option__label" :title="String(keyOption(option)?.label || '')">{{ keyOption(option)?.label }}</div>
                <div v-if="keyOption(option)?.group" class="composer-option__detail" :title="keyMeta(keyOption(option))">
                  {{ keyMeta(keyOption(option)) }}
                </div>
              </div>
              <Icon v-if="selected" name="check" size="sm" class="composer-option__check" />
            </template>
          </UiSelect>

          <UiSelect
            :model-value="model"
            class="playground-composer__select"
            density="compact"
            :options="modelOptions"
            :disabled="generating || loadingModels || !selectedKey"
            :placeholder="loadingModels ? t('common.loading') : t('playground.composer.selectModel')"
            :empty-text="t('playground.empty.noModels')"
            searchable
            @update:model-value="selectModel"
          >
            <template #selected="{ option }">
              <span class="composer-option composer-option--selected">
                <Icon v-if="modelOption(option)?.image" name="sparkles" size="xs" />
                <span class="composer-option__label composer-option__label--mono" :title="String(modelOption(option)?.label || '')">{{ modelOption(option)?.label }}</span>
              </span>
            </template>
            <template #option="{ option, selected }">
              <Icon v-if="modelOption(option)?.image" name="sparkles" size="xs" />
              <span class="composer-option__label composer-option__label--mono" :title="String(modelOption(option)?.label || '')">{{ modelOption(option)?.label }}</span>
              <Icon v-if="selected" name="check" size="sm" class="composer-option__check" />
            </template>
          </UiSelect>

          <div class="playground-composer__context">
            <span class="playground-composer__context-text" :title="selectedKeyMeta">
              {{ selectedKeyMeta || t('playground.composer.noGroup') }}
            </span>
            <UiBadge v-if="imageMode" tone="info" :label="t('playground.image.mode')">
              <template #default>
                <Icon name="sparkles" size="xs" />
                {{ t('playground.image.mode') }}
              </template>
            </UiBadge>
            <label v-else class="playground-composer__stream">
              <UiSwitch
                :model-value="stream"
                :disabled="generating"
                :label="t('playground.composer.stream')"
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
          class="playground-composer__input"
          :placeholder="placeholder"
          :aria-label="placeholder"
          @input="resizeInput"
          @keydown.enter="handleEnter"
        ></textarea>

        <div class="playground-composer__footer">
          <div class="playground-composer__tools">
            <UiStatusBadge
              :status="generating ? 'running' : optionsError ? 'error' : 'ready'"
              :label="sessionStatus"
            />
            <UiIconButton
              :label="parameterTitle"
              icon="cog"
              variant="ghost"
              density="compact"
              :disabled="generating"
              @click="emit('openParameters')"
            />
            <span v-if="enabledParameterCount" class="playground-composer__count" aria-label="parameter count">
              {{ enabledParameterCount }}
            </span>
            <UiIconButton
              :label="t('playground.actions.requestJson')"
              icon="document"
              variant="ghost"
              density="compact"
              @click="emit('openPreview')"
            />
            <UiIconButton
              :label="t('playground.actions.newConversation')"
              icon="plus"
              variant="ghost"
              density="compact"
              :disabled="!hasMessages"
              @click="emit('newConversation')"
            />
            <span v-if="imageMode" class="playground-composer__summary" :title="imageSummary">
              {{ imageSummary }}
            </span>
          </div>

          <UiIconButton
            v-if="generating"
            :label="t('playground.actions.stop')"
            icon="x"
            variant="danger"
            density="compact"
            @click="emit('stop')"
          />
          <UiButton
            v-else
            :aria-label="t('playground.actions.send')"
            :title="t('playground.actions.send')"
            variant="primary"
            density="compact"
            :disabled="!canSend || !draft.trim()"
            @click="send"
          >
            <template #icon><Icon :name="imageMode ? 'sparkles' : 'arrowUp'" size="sm" :stroke-width="2" /></template>
            <span class="sr-only">{{ t('playground.actions.send') }}</span>
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import {
  UiBadge,
  UiButton,
  UiIconButton,
  UiSelect,
  UiStatusBadge,
  UiSwitch,
} from '@/components/ui'
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

function keyOption(option: unknown): Partial<ComposerKeyOption> | null {
  return option && typeof option === 'object' ? option as Partial<ComposerKeyOption> : null
}

function modelOption(option: unknown): Partial<ComposerModelOption> | null {
  return option && typeof option === 'object' ? option as Partial<ComposerModelOption> : null
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

<style scoped>
.playground-composer {
  flex: none;
}

.playground-composer__inner {
  width: min(100%, 1024px);
  margin: 0 auto;
  padding: 4px 12px 16px;
}

.playground-composer__surface {
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-surface);
  box-shadow: 0 4px 18px rgb(31 35 41 / 7%);
  transition: border-color var(--ui-motion-fast) var(--ui-ease-standard),
    box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
}

.playground-composer__surface:focus-within {
  border-color: var(--ui-text-soft);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-focus) 12%, transparent),
    0 4px 18px rgb(31 35 41 / 7%);
}

.playground-composer__controls {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.15fr) minmax(9rem, auto);
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.playground-composer__select {
  min-width: 0;
}

.composer-option {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.composer-option > :first-child {
  flex: none;
  color: var(--ui-text-soft);
}

.composer-option__body {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.composer-option__label {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-text);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-option__label--mono {
  font-family: var(--ui-font-mono);
  font-size: 12px;
}

.composer-option__meta,
.composer-option__detail {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-text-soft);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-option__meta {
  display: none;
  max-width: 10rem;
  flex: none;
}

.composer-option__check {
  flex: none;
  color: var(--ui-success);
}

.playground-composer__context {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.playground-composer__context-text {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playground-composer__stream {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  color: var(--ui-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.playground-composer__input {
  display: block;
  width: 100%;
  min-height: 56px;
  max-height: 176px;
  padding: 10px 12px;
  resize: none;
  overflow-y: auto;
  border: 0;
  outline: 0;
  color: var(--ui-text);
  background: transparent;
  font: 400 13px/22px var(--ui-font-sans);
}

.playground-composer__input::placeholder {
  color: var(--ui-text-soft);
}

.playground-composer__footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid var(--ui-border-soft);
}

.playground-composer__tools {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.playground-composer__count {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  margin-left: -8px;
  align-self: flex-start;
  border: 1px solid color-mix(in srgb, var(--ui-info) 28%, var(--ui-border));
  border-radius: 999px;
  color: var(--ui-info);
  background: var(--ui-surface);
  font-size: 10px;
  line-height: 14px;
}

.playground-composer__summary {
  min-width: 0;
  max-width: 20rem;
  margin-left: 4px;
  padding-left: 8px;
  overflow: hidden;
  border-left: 1px solid var(--ui-border-soft);
  color: var(--ui-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 1280px) {
  .composer-option__meta {
    display: block;
  }
}

@media (max-width: 760px) {
  .playground-composer__inner {
    padding-inline: 8px;
    padding-bottom: 10px;
  }

  .playground-composer__controls {
    grid-template-columns: 1fr 1fr;
  }

  .playground-composer__context {
    grid-column: 1 / -1;
    justify-content: space-between;
  }

  .playground-composer__summary {
    max-width: 10rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .playground-composer__surface {
    transition: none;
  }
}
</style>
