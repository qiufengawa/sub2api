<template>
  <AppStack :gap="12">
    <AppSection :title="t('channelMonitorV2.settings.title')" :description="t('channelMonitorV2.settings.description')" divided>
      <template #actions><UiButton density="dense" variant="primary" :loading="saving" :disabled="saving || !dirty" @click="save"><template #icon><Icon name="check" size="sm" /></template>{{ t('channelMonitorV2.settings.save') }}</UiButton></template>
    </AppSection>

    <AppGrid v-if="!systemModeV2" min="220px" :gap="8">
      <UiAlert tone="warning" :message="t('channelMonitorV2.settings.modeBanner', { mode: systemModeLabel, modeV2: t('channelMonitorV2.settings.modeV2') })" />
      <UiButton density="dense" to="/admin/settings">{{ t('admin.settings.tabs.features') }}</UiButton>
    </AppGrid>

    <UiSkeleton v-if="loading" height="220px" />

    <template v-else-if="draft">
      <AppSection :title="t('channelMonitorV2.settings.enableTitle')" :description="t('channelMonitorV2.settings.enableHint')" divided>
        <AppGrid min="240px" :gap="16">
          <UiSwitch v-model="draft.enabled" :label="t('channelMonitorV2.settings.enableTitle')" />
          <UiSegmentedControl :model-value="draft.refresh_interval_seconds" :options="refreshOptions" :label="t('channelMonitorV2.settings.refreshAria')" @update:model-value="setRefreshInterval" />
        </AppGrid>
      </AppSection>

      <AppSection :title="t('channelMonitorV2.settings.platformsTitle')" :description="t('channelMonitorV2.settings.platformsHint')" divided>
        <AppStack :gap="10">
          <AppGrid v-for="platform in draft.platforms" :key="platform.platform" min="180px" :gap="10">
            <UiSwitch v-model="platform.enabled" :label="platformLabel(platform.platform)" />
            <UiTextField :model-value="platform.models.join(', ')" :label="platformLabel(platform.platform)" :placeholder="t('channelMonitorV2.settings.modelsPlaceholder')" @change="setModels(platform, $event)" />
            <UiBadge :tone="platform.models.length ? 'neutral' : 'info'" :label="platform.models.length ? t('channelMonitorV2.settings.badgeOther') : t('channelMonitorV2.settings.badgeAllModels')" />
          </AppGrid>
        </AppStack>
      </AppSection>

      <AppSection :title="t('channelMonitorV2.settings.groupsTitle')" :description="draft.group_ids.length ? t('channelMonitorV2.settings.groupsSelected', { count: draft.group_ids.length }) : t('channelMonitorV2.settings.groupsAll')" divided>
        <UiMultiCombobox :model-value="draft.group_ids" :options="groupOptions" :placeholder="t('channelMonitorV2.settings.groupsAll')" :empty-text="t('channelMonitorV2.settings.groupsEmpty')" @update:model-value="setGroupIds" />
      </AppSection>

      <AppSection :title="t('channelMonitorV2.settings.errorsTitle')" :description="t('channelMonitorV2.settings.ignoredSummary', { ignored: draft.ignored_error_categories?.length || 0, counted: countedErrorCategoryCount })" divided>
        <UiMultiCombobox :model-value="draft.ignored_error_categories || []" :options="errorCategoryOptions" :placeholder="t('channelMonitorV2.settings.errorsHint')" @update:model-value="setIgnoredCategories" />
      </AppSection>

      <AppSection :title="t('channelMonitorV2.settings.healthTitle')" :description="t('channelMonitorV2.settings.healthHint')" divided>
        <AppGrid min="180px" :gap="12">
          <UiTextField v-model.number="draft.health_thresholds.minimum_sample" type="number" min="1" max="10000" :label="t('channelMonitorV2.settings.fields.minimumSample')" />
          <UiTextField v-model.number="warningErrorPercent" type="number" min="0" max="100" step="0.1" :label="t('channelMonitorV2.settings.fields.warningError')" />
          <UiTextField v-model.number="criticalErrorPercent" type="number" min="0" max="100" step="0.1" :label="t('channelMonitorV2.settings.fields.criticalError')" />
          <UiTextField v-model.number="draft.health_thresholds.target_ttft_ms" type="number" min="1" step="100" :label="t('channelMonitorV2.settings.fields.targetTtft')" />
          <UiTextField v-model.number="draft.health_thresholds.warning_ttft_ms" type="number" min="1" step="100" :label="t('channelMonitorV2.settings.fields.warningTtft')" />
          <UiTextField v-model.number="draft.health_thresholds.critical_ttft_ms" type="number" min="1" step="100" :label="t('channelMonitorV2.settings.fields.criticalTtft')" />
          <UiTextField v-model.number="warningCachePercent" type="number" min="0" max="100" step="0.1" :label="t('channelMonitorV2.settings.fields.warningCache')" />
          <UiTextField v-model.number="criticalCachePercent" type="number" min="0" max="100" step="0.1" :label="t('channelMonitorV2.settings.fields.criticalCache')" />
        </AppGrid>
      </AppSection>

      <UiAlert tone="info" :message="namedModelCount === 0 ? t('channelMonitorV2.settings.namedModelsEmpty') : t('channelMonitorV2.settings.namedModelsCount', { count: namedModelCount })" />
      <UiDescriptionList :items="userContractItems" :columns="2" />
    </template>
  </AppStack>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiDescriptionList,
  UiMultiCombobox,
  UiSegmentedControl,
  UiSkeleton,
  UiSwitch,
  UiTextField,
} from '@/components/ui'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { getChannelMonitorMode, isChannelMonitorV2Mode } from '@/utils/featureFlags'
import {
  getConfig,
  updateConfig,
  MONITOR_ERROR_CATEGORIES,
  type MonitorConfig,
} from '@/api/channelMonitorV2'
import { adminAPI } from '@/api/admin'
import type { AdminGroup } from '@/types'

const { t, te } = useI18n()
const appStore = useAppStore()
const loading = ref(true)
const saving = ref(false)
const draft = ref<MonitorConfig | null>(null)
const original = ref('')
const groups = ref<AdminGroup[]>([])

const dirty = computed(() => (draft.value ? JSON.stringify(draft.value) !== original.value : false))
const namedModelCount = computed(
  () => draft.value?.platforms.filter((p) => p.enabled).reduce((sum, p) => sum + p.models.length, 0) || 0
)
const errorCategories = MONITOR_ERROR_CATEGORIES
const countedErrorCategoryCount = computed(
  () => errorCategories.length - (draft.value?.ignored_error_categories?.length || 0)
)
const refreshOptions = computed(() => [
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
])

function setRefreshInterval(value: string | number) {
  if (!draft.value) return
  const interval = Number(value)
  if (interval === 60 || interval === 300) draft.value.refresh_interval_seconds = interval
}
const groupOptions = computed(() => groups.value.map((group) => ({
  value: group.id,
  label: `${group.name} · ${platformLabel(group.platform)} · #${group.id}`,
})))
const errorCategoryOptions = computed(() => errorCategories.map((category) => ({
  value: category,
  label: `${categoryLabel(category)} · ${category}`,
})))
const userContractItems = computed(() => [
  { label: t('channelMonitorV2.settings.userContractTitle'), value: t('channelMonitorV2.settings.userContract.health') },
  { label: t('channelMonitorV2.settings.userContractTitle'), value: t('channelMonitorV2.settings.userContract.trend') },
  { label: t('channelMonitorV2.settings.userContractTitle'), value: t('channelMonitorV2.settings.userContract.latency') },
  { label: t('channelMonitorV2.settings.userContractTitle'), value: t('channelMonitorV2.settings.userContract.models') },
])
/** System settings mode must be v2 for aggregation to run; config remains editable for prep. */
const systemModeV2 = computed(() => isChannelMonitorV2Mode())
const systemModeLabel = computed(() => {
  if (!appStore.cachedPublicSettings?.channel_monitor_enabled) {
    return t('channelMonitorV2.settings.modeClosed')
  }
  return getChannelMonitorMode() === 'v1'
    ? t('channelMonitorV2.settings.modeV1')
    : t('channelMonitorV2.settings.modeV2')
})
const defaultThresholds = {
  minimum_sample: 50,
  warning_error_rate: 0.05,
  critical_error_rate: 0.20,
  target_ttft_ms: 3000,
  warning_ttft_ms: 3000,
  critical_ttft_ms: 10000,
  // Higher is better: below 85% watch, below 60% critical.
  warning_cache_rate: 0.85,
  critical_cache_rate: 0.60,
  error_weight: 0.60,
  ttft_weight: 0.20,
  cache_weight: 0.20,
}

/** Factory ignored categories (matches backend DefaultChannelMonitorV2IgnoredErrorCategories). */
const defaultIgnoredErrorCategories = [
  'authentication',
  'client_cancelled',
  'content_policy',
  'context_limit',
  'group_access',
  'model_unsupported',
  'not_found',
  'quota_or_balance',
] as const
function percentModel(key: 'warning_error_rate' | 'critical_error_rate' | 'warning_cache_rate' | 'critical_cache_rate') {
  return computed({
    get: () => ((draft.value?.health_thresholds?.[key] ?? defaultThresholds[key]) * 100),
    set: (value: number) => {
      if (!draft.value) return
      draft.value.health_thresholds[key] = Math.max(0, Math.min(100, Number(value) || 0)) / 100
    },
  })
}
const warningErrorPercent = percentModel('warning_error_rate')
const criticalErrorPercent = percentModel('critical_error_rate')
const warningCachePercent = percentModel('warning_cache_rate')
const criticalCachePercent = percentModel('critical_cache_rate')

function setModels(platform: MonitorConfig['platforms'][number], value: string) {
  platform.models = [
    ...new Set(
      value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    ),
  ].sort()
}

function setGroupIds(values: (string | number)[]) {
  if (!draft.value) return
  draft.value.group_ids = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
}

function setIgnoredCategories(values: (string | number)[]) {
  if (!draft.value) return
  draft.value.ignored_error_categories = values.map(String).sort()
}

function categoryLabel(category: string) {
  const key = `channelMonitorV2.errorCategories.${category}`
  return te(key) ? t(key) : category
}

function platformLabel(value: string) {
  return (
    {
      anthropic: 'Claude',
      openai: 'OpenAI',
      grok: 'Grok',
      kiro: 'Kiro',
      gemini: 'Gemini',
      antigravity: 'Antigravity',
      composite: 'Composite',
    } as Record<string, string>
  )[value] || value
}

function normalizeConfig(value: MonitorConfig): MonitorConfig {
  const ignored = value.ignored_error_categories
  return {
    ...value,
    health_thresholds: { ...defaultThresholds, ...(value.health_thresholds || {}) },
    // Preserve explicit empty arrays from the server (operator cleared all).
    ignored_error_categories: [
      ...(ignored == null ? [...defaultIgnoredErrorCategories] : ignored),
    ].sort(),
  }
}

async function load() {
  loading.value = true
  try {
    const [value, groupRows] = await Promise.all([getConfig(), adminAPI.groups.getAllIncludingInactive()])
    const normalized = normalizeConfig(value)
    draft.value = structuredClone(normalized)
    groups.value = groupRows
    original.value = JSON.stringify(normalized)
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('channelMonitorV2.settings.loadFailed')))
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!draft.value) return
  saving.value = true
  try {
    const payload = normalizeConfig(draft.value)
    const value = await updateConfig(payload)
    const normalized = normalizeConfig(value)
    draft.value = structuredClone(normalized)
    original.value = JSON.stringify(normalized)
    appStore.showSuccess(t('channelMonitorV2.settings.saveSuccess'))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('channelMonitorV2.settings.saveFailed')))
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
