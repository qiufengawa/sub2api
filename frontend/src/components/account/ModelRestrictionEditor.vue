<template>
  <AppStack :gap="12">
    <UiAlert v-if="disabled" tone="warning">
      {{ disabledMessage }}
    </UiAlert>

    <template v-else>
      <UiSegmentedControl
        v-model="mode"
        :label="t('admin.accounts.modelRestriction')"
        :options="modeOptions"
      />

      <div v-if="mode === 'whitelist'">
        <ModelWhitelistSelector
          v-model="allowedModels"
          :platform="platform"
          :account-id="accountId"
          :sync-credentials="syncCredentials"
        />
        <p class="model-restriction__summary">
          {{ t('admin.accounts.selectedModels', { count: allowedModels.length }) }}
          <span v-if="supportsAll">{{ t('admin.accounts.supportsAllModels') }}</span>
        </p>
      </div>

      <AppStack v-else :gap="10">
        <UiAlert tone="info">{{ t('admin.accounts.mapRequestModels') }}</UiAlert>

        <div
          v-for="(mapping, index) in modelMappings"
          :key="mappingKey(mapping)"
          class="model-restriction__row"
        >
          <UiTextField
            v-model="mapping.from"
            :placeholder="fromPlaceholder || t('admin.accounts.requestModel')"
          />
          <Icon name="arrowRight" size="sm" class="model-restriction__arrow" />
          <UiTextField
            v-model="mapping.to"
            :placeholder="toPlaceholder || t('admin.accounts.actualModel')"
          />
          <UiIconButton
            :label="t('common.delete')"
            variant="danger"
            density="dense"
            @click="removeMapping(index)"
          >
            <Icon name="trash" size="sm" />
          </UiIconButton>
        </div>

        <UiButton block variant="secondary" @click="addMapping">
          <template #icon><Icon name="plus" size="sm" /></template>
          {{ t('admin.accounts.addMapping') }}
        </UiButton>

        <div v-if="presets.length" class="model-restriction__presets">
          <UiButton
            v-for="preset in presets"
            :key="`${preset.from}:${preset.to}`"
            density="dense"
            variant="quiet"
            @click="addPreset(preset)"
          >
            <template #icon><Icon name="plus" size="xs" /></template>
            {{ preset.label }}
          </UiButton>
        </div>
      </AppStack>
    </template>
  </AppStack>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import ModelWhitelistSelector from '@/components/account/ModelWhitelistSelector.vue'
import {
  AppStack,
  UiAlert,
  UiButton,
  UiIconButton,
  UiSegmentedControl,
  UiTextField
} from '@/components/ui'

export interface ModelMappingDraft {
  from: string
  to: string
}

export interface ModelMappingPreset extends ModelMappingDraft {
  label: string
}

withDefaults(defineProps<{
  platform: string
  accountId?: number
  syncCredentials?: {
    platform: string
    type: string
    base_url?: string
    api_key: string
  }
  disabled?: boolean
  disabledMessage?: string
  supportsAll?: boolean
  presets?: ModelMappingPreset[]
  fromPlaceholder?: string
  toPlaceholder?: string
}>(), {
  disabled: false,
  disabledMessage: '',
  supportsAll: false,
  presets: () => [],
  fromPlaceholder: '',
  toPlaceholder: ''
})

const mode = defineModel<'whitelist' | 'mapping'>('mode', { required: true })
const allowedModels = defineModel<string[]>('allowedModels', { required: true })
const modelMappings = defineModel<ModelMappingDraft[]>('modelMappings', { required: true })
const emit = defineEmits<{
  duplicatePreset: [preset: ModelMappingPreset]
}>()
const { t } = useI18n()
const modeOptions = computed(() => [
  { value: 'whitelist', label: t('admin.accounts.modelWhitelist') },
  { value: 'mapping', label: t('admin.accounts.modelMapping') }
])
const mappingKeys = new WeakMap<ModelMappingDraft, number>()
let nextMappingKey = 0

function mappingKey(mapping: ModelMappingDraft): number {
  const existing = mappingKeys.get(mapping)
  if (existing !== undefined) return existing
  const key = ++nextMappingKey
  mappingKeys.set(mapping, key)
  return key
}

function addMapping(): void {
  modelMappings.value = [...modelMappings.value, { from: '', to: '' }]
}

function removeMapping(index: number): void {
  modelMappings.value = modelMappings.value.filter((_, itemIndex) => itemIndex !== index)
}

function addPreset(preset: ModelMappingPreset): void {
  if (modelMappings.value.some((mapping) => mapping.from === preset.from)) {
    emit('duplicatePreset', preset)
    return
  }

  modelMappings.value = [
    ...modelMappings.value,
    { from: preset.from, to: preset.to }
  ]
}
</script>

<style scoped>
.model-restriction__summary{margin:8px 0 0;color:var(--ui-text-muted);font-size:12px;line-height:20px}
.model-restriction__row{display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr) 28px;align-items:center;gap:8px}
.model-restriction__arrow{color:var(--ui-text-soft)}
.model-restriction__presets{display:flex;flex-wrap:wrap;gap:4px}
@media(max-width:540px){.model-restriction__row{grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr) 28px;gap:5px}}
</style>
