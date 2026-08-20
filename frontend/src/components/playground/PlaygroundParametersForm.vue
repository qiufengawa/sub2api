<template>
  <AppStack :gap="20">
    <UiAlert
      tone="info"
      :message="imageMode
        ? t('playground.image.parametersHint')
        : t('playground.parameters.description')"
    />

    <template v-if="imageMode">
      <AppGrid min="150px" :gap="12">
        <UiSelect v-model="model.imageSize" :label="t('playground.image.size')" :options="imageSizeOptions" density="compact" />
        <UiSelect v-model="model.imageQuality" :label="t('playground.image.quality')" :options="imageQualityOptions" density="compact" />
        <UiSelect v-model="model.imageFormat" :label="t('playground.image.format')" :options="imageFormatOptions" density="compact" />
        <UiSelect :model-value="model.imageCount" :label="t('playground.image.count')" :options="imageCountOptions" density="compact" @update:model-value="model.imageCount = Number($event)" />
      </AppGrid>
    </template>

    <template v-else>
      <UiTextArea
        id="playground-system-prompt"
        v-model="model.systemPrompt"
        :label="t('playground.parameters.systemPrompt')"
        :placeholder="t('playground.parameters.systemPromptPlaceholder')"
        :rows="5"
      />

      <AppStack :gap="16">
        <ParameterField v-model:enabled="model.parameterEnabled.temperature" :label="t('playground.parameters.temperature')">
          <div class="parameter-range">
            <UiSlider :model-value="model.temperature" :aria-label="t('playground.parameters.temperature')" :min="0" :max="2" :step="0.1" @update:model-value="model.temperature = $event" />
            <UiTextField :model-value="model.temperature" type="number" min="0" max="2" step="0.1" density="dense" text-align="right" @update:model-value="model.temperature = Number($event)" />
          </div>
        </ParameterField>
        <ParameterField v-model:enabled="model.parameterEnabled.top_p" :label="t('playground.parameters.topP')">
          <div class="parameter-range">
            <UiSlider :model-value="model.top_p" :aria-label="t('playground.parameters.topP')" :min="0" :max="1" :step="0.05" @update:model-value="model.top_p = $event" />
            <UiTextField :model-value="model.top_p" type="number" min="0" max="1" step="0.05" density="dense" text-align="right" @update:model-value="model.top_p = Number($event)" />
          </div>
        </ParameterField>
        <ParameterField v-model:enabled="model.parameterEnabled.max_tokens" :label="t('playground.parameters.maxTokens')">
          <UiTextField :model-value="model.max_tokens" type="number" min="1" max="131072" step="1" density="dense" text-align="right" @update:model-value="model.max_tokens = Number($event)" />
        </ParameterField>
        <ParameterField v-model:enabled="model.parameterEnabled.frequency_penalty" :label="t('playground.parameters.frequencyPenalty')">
          <div class="parameter-range">
            <UiSlider :model-value="model.frequency_penalty" :aria-label="t('playground.parameters.frequencyPenalty')" :min="-2" :max="2" :step="0.1" @update:model-value="model.frequency_penalty = $event" />
            <UiTextField :model-value="model.frequency_penalty" type="number" min="-2" max="2" step="0.1" density="dense" text-align="right" @update:model-value="model.frequency_penalty = Number($event)" />
          </div>
        </ParameterField>
        <ParameterField v-model:enabled="model.parameterEnabled.presence_penalty" :label="t('playground.parameters.presencePenalty')">
          <div class="parameter-range">
            <UiSlider :model-value="model.presence_penalty" :aria-label="t('playground.parameters.presencePenalty')" :min="-2" :max="2" :step="0.1" @update:model-value="model.presence_penalty = $event" />
            <UiTextField :model-value="model.presence_penalty" type="number" min="-2" max="2" step="0.1" density="dense" text-align="right" @update:model-value="model.presence_penalty = Number($event)" />
          </div>
        </ParameterField>
        <ParameterField v-model:enabled="model.parameterEnabled.seed" :label="t('playground.parameters.seed')">
          <UiTextField :model-value="model.seed ?? ''" type="number" step="1" density="dense" text-align="right" @update:model-value="model.seed = $event === '' ? null : Number($event)" />
        </ParameterField>
      </AppStack>
    </template>
  </AppStack>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AppGrid,
  AppStack,
  UiAlert,
  UiSelect,
  UiSlider,
  UiTextArea,
  UiTextField,
  type SelectOption,
} from '@/components/ui'
import ParameterField from './PlaygroundParameterField.vue'
import type { PlaygroundConfig } from '@/types/playground'

defineProps<{ imageMode?: boolean }>()
const model = defineModel<PlaygroundConfig>({ required: true })
const { t } = useI18n()

const imageSizeOptions: SelectOption[] = [
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1536x1024', label: '1536 × 1024' },
  { value: '1024x1536', label: '1024 × 1536' },
]
const imageQualityOptions = computed<SelectOption[]>(() => [
  { value: 'auto', label: t('playground.image.qualityAuto') },
  { value: 'low', label: t('playground.image.qualityLow') },
  { value: 'medium', label: t('playground.image.qualityMedium') },
  { value: 'high', label: t('playground.image.qualityHigh') },
])
const imageFormatOptions: SelectOption[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
]
const imageCountOptions: SelectOption[] = [1, 2, 3, 4].map((value) => ({ value, label: String(value) }))
</script>

<style scoped>
.parameter-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  align-items: center;
  gap: 12px;
}
</style>
