<template>
  <div class="model-plaza-content">
    <AppPageHeader :title="t('modelPlaza.title')" :description="t('modelPlaza.description')" />

    <section class="model-plaza-toolbar" :aria-label="t('modelPlaza.controlsLabel')">
      <div class="model-plaza-toolbar__summary">
        <p data-testid="model-plaza-summary">
          {{ t('modelPlaza.summary', { models: modelCount, groups: groupCount, platforms: platformCount }) }}
        </p>
        <p v-if="!isAuthenticated" class="model-plaza-toolbar__hint">
          <Icon name="infoCircle" size="xs" aria-hidden="true" />
          {{ t('modelPlaza.anonymousHint') }}
        </p>
      </div>

      <UiSearchInput
        v-model="searchQuery"
        class="model-plaza-search"
        :placeholder="t('modelPlaza.filters.searchPlaceholder')"
        :aria-label="t('modelPlaza.filters.modelLabel')"
        density="compact"
      />
    </section>

    <section v-if="descriptionHtml" class="model-plaza-description" v-html="descriptionHtml"></section>

    <section v-if="loading" class="model-plaza-loading" role="status" :aria-label="t('common.loading')" aria-busy="true">
      <UiSkeleton variant="text" width="180px" height="18px" />
      <UiSkeleton v-for="index in 5" :key="index" variant="rect" width="100%" height="56px" />
    </section>

    <UiErrorState
      v-else-if="error"
      :title="t('modelPlaza.loadFailed')"
      :description="t('modelPlaza.loadFailedHint')"
      :retry-text="t('common.retry')"
      @retry="emit('retry')"
    />

    <section v-else class="plaza-browser">
      <PlazaFilterBar
        :platforms="platforms"
        :groups="groupOptions"
        :rates="rates"
        :platform="selectedPlatform"
        :group-id="selectedGroupId"
        :rate="selectedRate"
        @update:platform="selectedPlatform = $event"
        @update:group-id="selectedGroupId = $event"
        @update:rate="selectedRate = $event"
      />

      <div class="plaza-group-list">
        <PlazaGroupSection v-for="group in filteredGroups" :key="group.id" :group="group" />
        <UiEmptyState
          v-if="filteredGroups.length === 0"
          icon="search"
          :title="searchActive ? t('modelPlaza.noSearchResult') : t('modelPlaza.empty')"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Icon from '@/components/icons/Icon.vue'
import PlazaFilterBar from './PlazaFilterBar.vue'
import PlazaGroupSection from './PlazaGroupSection.vue'
import type { ModelPlazaGroup, ModelPlazaResponse } from '@/api/modelPlaza'
import { useAuthStore } from '@/stores/auth'
import {
  AppPageHeader,
  UiEmptyState,
  UiErrorState,
  UiSearchInput,
  UiSkeleton,
} from '@/components/ui'

const props = defineProps<{
  response: ModelPlazaResponse | null
  loading: boolean
  error?: boolean
  embedded?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const selectedPlatform = ref<string>('all')
const selectedGroupId = ref<number | 'all'>('all')
const selectedRate = ref<number | 'all'>('all')
const searchQuery = ref('')
const searchActive = computed(() => searchQuery.value.trim() !== '')

const descriptionHtml = computed(() => {
  const markdown = props.response?.description?.trim()
  return markdown ? DOMPurify.sanitize(marked.parse(markdown) as string) : ''
})

const modelCount = computed(() => new Set((props.response?.groups ?? []).flatMap((group) => group.models.map((model) => model.name))).size)
const groupCount = computed(() => props.response?.groups.length ?? 0)
const platformCount = computed(() => new Set((props.response?.groups ?? []).map((group) => group.platform).filter(Boolean)).size)

function effectiveRate(group: ModelPlazaGroup): number {
  return group.user_rate_multiplier ?? group.rate_multiplier
}

const platforms = computed(() => [...new Set((props.response?.groups ?? []).map((group) => group.platform).filter(Boolean))].sort())
const groupOptions = computed(() => (props.response?.groups ?? []).map((group) => ({
  id: group.id,
  name: group.name,
  platform: group.platform,
  rate: effectiveRate(group),
})))
const rates = computed(() => [...new Set((props.response?.groups ?? []).map(effectiveRate))].sort((a, b) => a - b))

watch(platforms, (list) => {
  if (selectedPlatform.value !== 'all' && !list.includes(selectedPlatform.value)) selectedPlatform.value = 'all'
})

watch(groupOptions, (list) => {
  if (selectedGroupId.value !== 'all' && !list.some((group) => group.id === selectedGroupId.value)) selectedGroupId.value = 'all'
})

watch(rates, (list) => {
  if (selectedRate.value !== 'all' && !list.includes(selectedRate.value)) selectedRate.value = 'all'
})

const filteredGroups = computed(() => {
  let groups = props.response?.groups ?? []
  if (selectedPlatform.value !== 'all') groups = groups.filter((group) => group.platform === selectedPlatform.value)
  if (selectedGroupId.value !== 'all') groups = groups.filter((group) => group.id === selectedGroupId.value)
  if (selectedRate.value !== 'all') groups = groups.filter((group) => effectiveRate(group) === selectedRate.value)
  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    groups = groups
      .map((group) => ({ ...group, models: group.models.filter((model) => model.name.toLowerCase().includes(query)) }))
      .filter((group) => group.models.length > 0)
  }
  return [...groups].sort((a, b) => effectiveRate(a) - effectiveRate(b) || a.name.localeCompare(b.name))
})
</script>

<style scoped>
.model-plaza-content { min-width: 0; }
.model-plaza-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 400px); align-items: end; gap: 16px; padding: 18px 0; border-bottom: 1px solid var(--ui-border-soft); }
.model-plaza-toolbar__summary { min-width: 0; }
.model-plaza-toolbar__summary p { margin: 0; color: var(--ui-text); font-size: 13px; font-weight: 600; line-height: 20px; }
.model-plaza-toolbar__summary .model-plaza-toolbar__hint { display: flex; align-items: center; gap: 6px; margin-top: 5px; color: var(--ui-text-soft); font-size: 12px; font-weight: 400; }
.model-plaza-search { min-width: 0; }
.model-plaza-description { padding: 14px 0; border-bottom: 1px solid var(--ui-border-soft); color: var(--ui-text-muted); font-size: 13px; line-height: 22px; overflow-wrap: anywhere; }
.model-plaza-description :deep(h1), .model-plaza-description :deep(h2), .model-plaza-description :deep(h3) { margin: 12px 0 6px; color: var(--ui-text); font-size: 15px; font-weight: 600; }
.model-plaza-description :deep(p) { margin: 0 0 7px; }
.model-plaza-description :deep(a) { color: var(--ui-link); text-decoration: underline; text-underline-offset: 3px; }
.model-plaza-description :deep(ul), .model-plaza-description :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.model-plaza-description :deep(code) { padding: 2px 4px; border-radius: 3px; color: var(--ui-text); background: var(--ui-surface-muted); font-family: var(--ui-font-mono); font-size: 12px; }
.model-plaza-description :deep(blockquote) { margin: 8px 0; padding-left: 12px; border-left: 2px solid var(--ui-border); }
.model-plaza-loading { display: grid; gap: 10px; padding: 20px 0; }
.plaza-browser { display: grid; min-width: 0; gap: 16px; padding-top: 16px; }
.plaza-group-list { min-width: 0; border-top: 1px solid var(--ui-border-soft); }
@media (max-width: 767px) { .model-plaza-toolbar { grid-template-columns: 1fr; align-items: stretch; gap: 10px; } }
</style>
