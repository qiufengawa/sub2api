<template>
  <UiFilterBar :active-count="activeFilterCount" @clear="clearFilters">
    <UiSearchInput
      v-model="search"
      density="compact"
      :debounce-ms="0"
      :placeholder="t('admin.channelMonitor.searchPlaceholder')"
      @search="emit('search-input')"
    />
    <UiSelect
      v-model="provider"
      :options="providerFilterOptions"
      density="compact"
      :aria-label="t('admin.channelMonitor.allProviders')"
      @change="emit('filter-change')"
    />
    <UiSelect
      v-model="enabled"
      :options="enabledFilterOptions"
      density="compact"
      :aria-label="t('admin.channelMonitor.enabledFilter')"
      @change="emit('filter-change')"
    />

    <template #actions>
      <AppInline>
        <UiIconButton icon="refresh" density="compact" :label="t('common.refresh')" :disabled="loading" @click="emit('reload')" />
        <UiButton density="compact" @click="emit('manage-templates')">
          <template #icon><Icon name="cog" size="sm" /></template>
          {{ t('admin.channelMonitor.template.manageButton') }}
        </UiButton>
        <UiButton density="compact" variant="primary" @click="emit('create')">
          <template #icon><Icon name="plus" size="sm" /></template>
          {{ t('admin.channelMonitor.createButton') }}
        </UiButton>
      </AppInline>
    </template>
  </UiFilterBar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Provider } from '@/api/admin/channelMonitor'
import Icon from '@/components/icons/Icon.vue'
import { AppInline, UiButton, UiFilterBar, UiIconButton, UiSearchInput, UiSelect } from '@/components/ui'
import {
  PROVIDER_OPENAI,
  PROVIDER_ANTHROPIC,
  PROVIDER_GEMINI,
  PROVIDER_GROK,
  PROVIDER_ANTIGRAVITY,
  PROVIDER_KIMI,
  PROVIDER_ZHIPU,
  PROVIDER_DEEPSEEK,
} from '@/constants/channelMonitor'

defineProps<{ loading: boolean }>()

const emit = defineEmits<{
  (e: 'reload'): void
  (e: 'filter-change'): void
  (e: 'create'): void
  (e: 'manage-templates'): void
  (e: 'search-input'): void
}>()

const search = defineModel<string>('search', { required: true })
const provider = defineModel<Provider | ''>('provider', { required: true })
const enabled = defineModel<'' | 'true' | 'false'>('enabled', { required: true })

const { t } = useI18n()
const activeFilterCount = computed(() =>
  Number(Boolean(search.value.trim())) + Number(Boolean(provider.value)) + Number(Boolean(enabled.value)),
)

const providerFilterOptions = computed(() => [
  { value: '', label: t('admin.channelMonitor.allProviders') },
  { value: PROVIDER_OPENAI, label: t('monitorCommon.providers.openai') },
  { value: PROVIDER_ANTHROPIC, label: t('monitorCommon.providers.anthropic') },
  { value: PROVIDER_GEMINI, label: t('monitorCommon.providers.gemini') },
  { value: PROVIDER_GROK, label: t('monitorCommon.providers.grok') },
  { value: PROVIDER_ANTIGRAVITY, label: t('monitorCommon.providers.antigravity') },
  { value: PROVIDER_KIMI, label: t('monitorCommon.providers.kimi') },
  { value: PROVIDER_ZHIPU, label: t('monitorCommon.providers.zhipu') },
  { value: PROVIDER_DEEPSEEK, label: t('monitorCommon.providers.deepseek') },
])

const enabledFilterOptions = computed(() => [
  { value: '', label: t('admin.channelMonitor.allStatus') },
  { value: 'true', label: t('admin.channelMonitor.onlyEnabled') },
  { value: 'false', label: t('admin.channelMonitor.onlyDisabled') },
])

function clearFilters() {
  search.value = ''
  provider.value = ''
  enabled.value = ''
  emit('filter-change')
}
</script>
