<template>
  <div class="min-w-0 space-y-4">
    <header class="min-w-0">
      <div v-if="!embedded">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('modelPlaza.title') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">{{ t('modelPlaza.description') }}</p>
      </div>

      <div class="mt-4 flex min-w-0 flex-col gap-3 border-b border-gray-200 pb-4 dark:border-dark-700 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <p
            data-testid="model-plaza-summary"
            class="text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            {{ t('modelPlaza.summary', { models: modelCount, groups: groupCount, platforms: platformCount }) }}
          </p>
          <p
            v-if="!isAuthenticated"
            class="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-dark-500"
          >
            <Icon name="infoCircle" size="xs" class="h-3.5 w-3.5 flex-shrink-0" />
            {{ t('modelPlaza.anonymousHint') }}
          </p>
        </div>

        <div class="relative w-full min-w-0 lg:w-[400px]">
          <Icon
            name="search"
            size="sm"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-500"
          />
          <input
            :value="searchQuery"
            type="search"
            :aria-label="t('modelPlaza.filters.modelLabel')"
            :placeholder="t('modelPlaza.filters.searchPlaceholder')"
            class="input h-10 w-full pl-9 pr-9"
            @input="searchQuery = ($event.target as HTMLInputElement).value"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="absolute right-2.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[3px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-dark-500 dark:hover:bg-dark-800 dark:hover:text-gray-300"
            :aria-label="t('common.reset')"
            :title="t('common.reset')"
            @click="searchQuery = ''"
          >
            <Icon name="x" size="xs" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>

    <!-- 全局价格说明(管理员配置,Markdown) -->
    <div
      v-if="descriptionHtml"
      class="plaza-description border-y border-gray-200 py-3 text-sm dark:border-dark-700"
      v-html="descriptionHtml"
    ></div>

    <div
      v-if="loading"
      class="overflow-hidden border-y border-gray-200 dark:border-dark-700"
      role="status"
      :aria-label="t('common.loading')"
    >
      <div class="h-12 animate-pulse border-b border-gray-100 bg-gray-100/70 dark:border-dark-700 dark:bg-dark-800/70"></div>
      <div
        v-for="index in 5"
        :key="index"
        class="h-14 animate-pulse border-b border-gray-100 bg-white last:border-b-0 dark:border-dark-700 dark:bg-dark-900/30"
      ></div>
    </div>
    <div
      v-else-if="error"
      class="rounded-[4px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      role="alert"
    >
      {{ t('modelPlaza.loadFailed') }}
    </div>
    <div v-else class="plaza-browser">
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

      <div class="min-w-0">
        <div v-if="filteredGroups.length > 0" class="plaza-group-list">
          <PlazaGroupSection v-for="g in filteredGroups" :key="g.id" :group="g" />
        </div>
        <div
          v-else
          class="border-y border-dashed border-gray-300 px-5 py-10 text-center text-sm text-gray-500 dark:border-dark-600 dark:text-dark-400"
        >
          {{ searchActive ? t('modelPlaza.noSearchResult') : t('modelPlaza.empty') }}
        </div>
      </div>
    </div>
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

const props = defineProps<{
  response: ModelPlazaResponse | null
  loading: boolean
  error?: boolean
  /** 后台内嵌形态(AppLayout 内):隐藏页头。 */
  embedded?: boolean
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

const selectedPlatform = ref<string>('all')
const selectedGroupId = ref<number | 'all'>('all')
const selectedRate = ref<number | 'all'>('all')
const searchQuery = ref('')

const searchActive = computed(() => searchQuery.value.trim() !== '')

const descriptionHtml = computed(() => {
  const md = props.response?.description?.trim()
  if (!md) return ''
  return DOMPurify.sanitize(marked.parse(md) as string)
})

const modelCount = computed(
  () => new Set((props.response?.groups ?? []).flatMap((group) => group.models.map((model) => model.name))).size
)
const groupCount = computed(() => props.response?.groups.length ?? 0)
const platformCount = computed(
  () => new Set((props.response?.groups ?? []).map((group) => group.platform).filter(Boolean)).size
)

/** 生效倍率 = 用户专属倍率 ?? 分组默认倍率。 */
function effectiveRate(g: ModelPlazaGroup): number {
  return g.user_rate_multiplier ?? g.rate_multiplier
}

const platforms = computed(() =>
  [...new Set((props.response?.groups ?? []).map((g) => g.platform).filter(Boolean))].sort()
)

const groupOptions = computed(() =>
  (props.response?.groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    platform: g.platform,
    rate: effectiveRate(g)
  }))
)

/** 全量生效倍率;当前组合下不可用的项由 FilterBar 置灰而非隐藏。 */
const rates = computed(() =>
  [...new Set((props.response?.groups ?? []).map(effectiveRate))].sort((a, b) => a - b)
)

/** 数据刷新后选中的倍率可能不复存在,重置为全部。 */
watch(rates, (list) => {
  if (selectedRate.value !== 'all' && !list.includes(selectedRate.value)) {
    selectedRate.value = 'all'
  }
})

const filteredGroups = computed(() => {
  let groups = props.response?.groups ?? []
  if (selectedPlatform.value !== 'all') {
    groups = groups.filter((g) => g.platform === selectedPlatform.value)
  }
  if (selectedGroupId.value !== 'all') {
    groups = groups.filter((g) => g.id === selectedGroupId.value)
  }
  if (selectedRate.value !== 'all') {
    groups = groups.filter((g) => effectiveRate(g) === selectedRate.value)
  }
  // 模型名搜索:分组内只留命中的模型,整组无命中则隐藏该分组。
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    groups = groups
      .map((g) => ({ ...g, models: g.models.filter((m) => m.name.toLowerCase().includes(q)) }))
      .filter((g) => g.models.length > 0)
  }
  // 专属倍率会改变生效值,不能只依赖后端按默认倍率的排序。
  return [...groups].sort(
    (a, b) => effectiveRate(a) - effectiveRate(b) || a.name.localeCompare(b.name)
  )
})
</script>

<style scoped>
.plaza-description {
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.plaza-browser {
  @apply grid min-w-0 gap-4;
}

.plaza-group-list {
  @apply min-w-0 border-y border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-900/20;
}

@media (min-width: 1280px) {
  .plaza-browser {
    grid-template-columns: minmax(168px, 196px) minmax(0, 1fr);
    @apply items-start gap-6;
  }
}

.plaza-description :deep(h1),
.plaza-description :deep(h2),
.plaza-description :deep(h3) {
  @apply mb-2 mt-3 font-semibold text-gray-900 first:mt-0 dark:text-white;
}

.plaza-description :deep(p) {
  @apply mb-2 text-gray-700 last:mb-0 dark:text-dark-200;
}

.plaza-description :deep(a) {
  @apply text-primary-600 underline underline-offset-4 hover:text-primary-700 dark:text-primary-300;
}

.plaza-description :deep(ul) {
  @apply mb-2 list-disc pl-5;
}

.plaza-description :deep(ol) {
  @apply mb-2 list-decimal pl-5;
}

.plaza-description :deep(li) {
  @apply mb-0.5 text-gray-700 dark:text-dark-200;
}

.plaza-description :deep(code) {
  @apply rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-dark-800;
}

.plaza-description :deep(blockquote) {
  @apply my-2 border-l-4 border-gray-300 pl-3 text-gray-600 dark:border-dark-600 dark:text-dark-300;
}
</style>
