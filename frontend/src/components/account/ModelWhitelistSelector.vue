<template>
  <div class="model-whitelist">
    <div v-if="modelValue.length" class="model-whitelist__chips">
      <span v-for="model in modelValue" :key="model" class="model-whitelist__chip">
        <span class="model-whitelist__chip-name">
          <ModelIcon :model="model" size="14px" />
          <span>{{ model }}</span>
        </span>
        <UiIconButton
          :label="`${t('common.delete')} ${model}`"
          variant="danger"
          density="mini"
          @click="removeModel(model)"
        >
          <Icon name="x" size="xs" />
        </UiIconButton>
      </span>
    </div>
    <UiPopover
      class="model-whitelist__popover"
      placement="bottom-start"
      panel-role="dialog"
      :aria-label="t('admin.accounts.searchModels')"
      width="min(420px, calc(100vw - 16px))"
      @open-change="handlePopoverOpenChange"
    >
      <template #trigger="{ open }">
        <button
          type="button"
          data-testid="model-select-trigger"
          class="model-whitelist__trigger"
          :aria-expanded="open"
          aria-haspopup="dialog"
          :aria-label="t('admin.accounts.modelRestriction')"
        >
          <span>{{ t('admin.accounts.modelCount', { count: modelValue.length }) }}</span>
          <Icon name="chevronDown" size="sm" />
        </button>
      </template>
      <template #default>
        <div class="model-whitelist__panel" @click.stop>
          <UiSearchInput
            v-model="searchQuery"
            density="compact"
            :placeholder="t('admin.accounts.searchModels')"
            :aria-label="t('admin.accounts.searchModels')"
          />
          <div class="model-whitelist__options">
            <div v-for="model in filteredModels" :key="model.value" data-testid="model-option" class="model-whitelist__option">
              <button type="button" data-testid="select-model" class="model-whitelist__option-select" @click="toggleModel(model.value)">
                <span class="model-whitelist__check" :class="{ 'model-whitelist__check--selected': modelValue.includes(model.value) }">
                  <Icon v-if="modelValue.includes(model.value)" name="check" size="xs" />
                </span>
                <ModelIcon :model="model.value" size="18px" />
                <span class="model-whitelist__option-name">{{ model.value }}</span>
              </button>
              <UiIconButton
                data-testid="copy-model-id"
                :label="`${t('common.copy')} ${model.value}`"
                icon="copy"
                variant="ghost"
                density="mini"
                @click.stop="copyModelId(model.value)"
              />
            </div>
            <div v-if="filteredModels.length === 0" class="model-whitelist__empty">
              {{ t('admin.accounts.noMatchingModels') }}
            </div>
          </div>
        </div>
      </template>
    </UiPopover>

    <div class="model-whitelist__actions">
      <UiButton density="dense" variant="quiet" @click="fillRelated">
        <template #icon><Icon name="sparkles" size="sm" /></template>
        {{ t('admin.accounts.fillRelatedModels') }}
      </UiButton>
      <UiButton v-if="canSyncUpstream" density="dense" variant="quiet" :loading="isSyncingUpstream" :disabled="isSyncingUpstream" @click="syncUpstreamModels">
        <template #icon><Icon name="refresh" size="sm" /></template>
        {{ isSyncingUpstream ? t('admin.accounts.syncUpstreamModelsLoading') : t('admin.accounts.syncUpstreamModels') }}
      </UiButton>
      <UiButton density="dense" variant="danger" @click="clearAll">
        <template #icon><Icon name="trash" size="sm" /></template>
        {{ t('admin.accounts.clearAllModels') }}
      </UiButton>
    </div>

    <div class="model-whitelist__custom">
      <UiTextField
        v-model="customModel"
        density="compact"
        :label="t('admin.accounts.customModelName')"
        :placeholder="t('admin.accounts.enterCustomModelName')"
        :prevent-enter-default="true"
        @enter="handleEnter"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
      />
      <UiButton density="compact" variant="primary" @click="addCustom">
        <template #icon><Icon name="plus" size="sm" /></template>
        {{ t('admin.accounts.addModel') }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { accountsAPI } from '@/api/admin/accounts'
import type { SyncUpstreamPreviewParams } from '@/api/admin/accounts'
import { useClipboard } from '@/composables/useClipboard'
import ModelIcon from '@/components/common/ModelIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiIconButton, UiPopover, UiSearchInput, UiTextField } from '@/components/ui'
import { allModels, getModelsByPlatform } from '@/composables/useModelWhitelist'

const { t } = useI18n()

const props = defineProps<{
  modelValue: string[]
  platform?: string
  platforms?: string[]
  accountId?: number
  syncCredentials?: {
    platform: string
    type: string
    base_url?: string
    api_key: string
  }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

const searchQuery = ref('')
const customModel = ref('')
const isComposing = ref(false)
const isSyncingUpstream = ref(false)
const normalizedPlatforms = computed(() => {
  const rawPlatforms =
    props.platforms && props.platforms.length > 0
      ? props.platforms
      : props.platform
        ? [props.platform]
        : []

  return Array.from(
    new Set(
      rawPlatforms
        .map(platform => platform?.trim())
        .filter((platform): platform is string => Boolean(platform))
    )
  )
})

const upstreamSyncPlatforms = new Set([
  'anthropic',
  'openai',
  'gemini',
  'antigravity',
  'grok',
  'kimi',
  'zhipu',
  'deepseek'
])
const canSyncUpstream = computed(() => {
  if (props.accountId) {
    if (normalizedPlatforms.value.length === 0) return true
    return normalizedPlatforms.value.some(platform => upstreamSyncPlatforms.has(platform.toLowerCase()))
  }
  if (props.syncCredentials) {
    return upstreamSyncPlatforms.has(props.syncCredentials.platform.toLowerCase())
  }
  return false
})

const availableOptions = computed(() => {
  if (normalizedPlatforms.value.length === 0) {
    return allModels
  }

  const allowedModels = new Set<string>()
  for (const platform of normalizedPlatforms.value) {
    for (const model of getModelsByPlatform(platform)) {
      allowedModels.add(model)
    }
  }

  return allModels.filter(model => allowedModels.has(model.value))
})

const filteredModels = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return availableOptions.value
  return availableOptions.value.filter(
    m => m.value.toLowerCase().includes(query) || m.label.toLowerCase().includes(query)
  )
})

const handlePopoverOpenChange = (open: boolean) => {
  if (!open) searchQuery.value = ''
}

const removeModel = (model: string) => {
  emit('update:modelValue', props.modelValue.filter(m => m !== model))
}

const toggleModel = (model: string) => {
  if (props.modelValue.includes(model)) {
    removeModel(model)
  } else {
    emit('update:modelValue', [...props.modelValue, model])
  }
}

const copyModelId = async (model: string) => {
  await copyToClipboard(model)
}

const addCustom = () => {
  const model = customModel.value.trim()
  if (!model) return
  if (props.modelValue.includes(model)) {
    appStore.showInfo(t('admin.accounts.modelExists'))
    return
  }
  emit('update:modelValue', [...props.modelValue, model])
  customModel.value = ''
}

const handleEnter = (event: KeyboardEvent) => {
  if (!isComposing.value && !event.isComposing) addCustom()
}

const fillRelated = () => {
  const newModels = [...props.modelValue]
  for (const platform of normalizedPlatforms.value) {
    for (const model of getModelsByPlatform(platform)) {
      if (!newModels.includes(model)) {
        newModels.push(model)
      }
    }
  }
  emit('update:modelValue', newModels)
}

const syncUpstreamModels = async () => {
  if (isSyncingUpstream.value) return
  if (!props.accountId && !props.syncCredentials) return

  isSyncingUpstream.value = true
  try {
    let result
    if (props.accountId) {
      result = await accountsAPI.syncUpstreamModels(props.accountId)
    } else if (props.syncCredentials) {
      result = await accountsAPI.syncUpstreamModelsPreview(props.syncCredentials as SyncUpstreamPreviewParams)
    } else {
      return
    }

    const upstreamModels = result.models.map(model => model.trim()).filter(Boolean)
    if (upstreamModels.length === 0) {
      appStore.showInfo(t('admin.accounts.syncUpstreamModelsEmpty'))
      return
    }

    const newModels = [...props.modelValue]
    let addedCount = 0
    for (const model of upstreamModels) {
      if (!newModels.includes(model)) {
        newModels.push(model)
        addedCount += 1
      }
    }

    emit('update:modelValue', newModels)
    if (addedCount > 0) {
      appStore.showSuccess(t('admin.accounts.syncUpstreamModelsSuccess', { count: addedCount, total: upstreamModels.length }))
    } else {
      appStore.showInfo(t('admin.accounts.syncUpstreamModelsNoChanges', { count: upstreamModels.length }))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : t('admin.accounts.syncUpstreamModelsFailed')
    appStore.showError(t('admin.accounts.syncUpstreamModelsError', { message }))
  } finally {
    isSyncingUpstream.value = false
  }
}

const clearAll = () => {
  emit('update:modelValue', [])
}

</script>

<style scoped>
.model-whitelist{display:grid;gap:12px;min-width:0}
.model-whitelist__chips{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
.model-whitelist__chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:2px 4px 2px 6px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);background:var(--ui-surface-muted);font-size:12px}
.model-whitelist__chip-name{display:inline-flex;align-items:center;gap:4px;min-width:0}
.model-whitelist__chip-name>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ui-font-mono)}
:deep(.model-whitelist__popover){display:flex;width:100%}
.model-whitelist__trigger{display:flex;width:100%;height:var(--ui-control-compact);align-items:center;justify-content:space-between;padding:0 10px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text-muted);background:var(--ui-surface);font-size:12px;cursor:pointer;transition:border-color var(--ui-motion-fast),background var(--ui-motion-fast)}
.model-whitelist__trigger:hover{border-color:var(--ui-text-soft);background:var(--ui-surface-muted)}
.model-whitelist__trigger:focus-visible{border-color:var(--ui-focus);outline:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-focus) 16%,transparent)}
.model-whitelist__panel{display:grid;gap:8px;min-width:0;padding:2px}
.model-whitelist__options{max-height:260px;overflow:auto;border-top:1px solid var(--ui-border)}
.model-whitelist__option{display:flex;align-items:center;gap:4px;min-width:0;border-bottom:1px solid var(--ui-border);padding:2px 0}
.model-whitelist__option-select{display:flex;align-items:center;gap:8px;min-width:0;flex:1;padding:7px 6px;border:0;color:var(--ui-text);background:transparent;text-align:left;cursor:pointer}
.model-whitelist__option-select:hover{background:var(--ui-surface-muted)}
.model-whitelist__check{display:grid;width:16px;height:16px;flex:none;place-items:center;border:1px solid var(--ui-border);border-radius:4px;color:transparent}
.model-whitelist__check--selected{border-color:var(--ui-text);color:var(--ui-inverse);background:var(--ui-text)}
.model-whitelist__option-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ui-font-mono);font-size:12px}
.model-whitelist__empty{padding:16px 8px;color:var(--ui-text-soft);font-size:12px;text-align:center}
.model-whitelist__actions{display:flex;flex-wrap:wrap;gap:4px}
.model-whitelist__custom{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px}
@media(max-width:540px){.model-whitelist__custom{grid-template-columns:1fr}.model-whitelist__custom>:last-child{width:100%}}
@media(prefers-reduced-motion:reduce){.model-whitelist__trigger{transition:none}}
</style>
