<template>
  <div class="plaza-filter-bar">
    <div class="sm:hidden">
      <button
        type="button"
        class="flex w-full min-w-0 items-center justify-between gap-3 py-0.5 text-left"
        :aria-expanded="mobileFiltersOpen"
        @click="mobileFiltersOpen = !mobileFiltersOpen"
      >
        <span class="flex min-w-0 items-center gap-2">
          <span class="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[3px] bg-gray-100 text-gray-500 dark:bg-dark-800 dark:text-dark-300">
            <Icon name="filter" size="sm" />
          </span>
          <span class="min-w-0">
            <span class="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
              {{ t('modelPlaza.filters.filterButton') }}
              <span
                v-if="activeFilterCount"
                class="inline-flex min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] leading-none text-white"
              >
                {{ activeFilterCount }}
              </span>
            </span>
            <span class="mt-0.5 block truncate text-xs text-gray-400 dark:text-dark-500">
              {{ activeSummary }}
            </span>
          </span>
        </span>
        <Icon
          name="chevronDown"
          size="sm"
          class="flex-shrink-0 text-gray-400 transition-transform dark:text-dark-500"
          :class="mobileFiltersOpen && 'rotate-180'"
        />
      </button>

      <div v-if="mobileFiltersOpen" class="mobile-filter-controls">
        <div class="mobile-filter-field">
          <span>{{ t('modelPlaza.filters.platformLabel') }}</span>
          <Select
            :model-value="platform"
            :options="platformSelectOptions"
            :aria-label="t('modelPlaza.filters.platformLabel')"
            @update:model-value="updatePlatform"
          />
        </div>
        <div class="mobile-filter-field">
          <span>{{ t('modelPlaza.filters.groupLabel') }}</span>
          <Select
            :model-value="groupId"
            :options="groupSelectOptions"
            :aria-label="t('modelPlaza.filters.groupLabel')"
            searchable="auto"
            @update:model-value="updateGroup"
          />
        </div>
        <div class="mobile-filter-field">
          <span>{{ t('modelPlaza.filters.rateLabel') }}</span>
          <Select
            :model-value="rate"
            :options="rateSelectOptions"
            :aria-label="t('modelPlaza.filters.rateLabel')"
            :searchable="false"
            @update:model-value="updateRate"
          />
        </div>
      </div>
    </div>

    <div class="desktop-filter-list">
      <div class="filter-row">
        <span class="filter-label">{{ t('modelPlaza.filters.platformLabel') }}</span>
        <div class="filter-options">
          <button
            v-for="p in ['all', ...platforms]"
            :key="`platform-${p}`"
            type="button"
            class="filter-chip inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
            :class="p === 'all' ? chipClass(platform === 'all') : platform === p ? 'chip-tinted-active' : 'chip-tinted'"
            :style="p === 'all' ? undefined : { '--chip-accent': platformAccentColor(p) }"
            :disabled="p !== 'all' && !platformEnabled(p)"
            @click="$emit('update:platform', p)"
          >
            <PlatformIcon v-if="p !== 'all'" :platform="p as GroupPlatform" size="xs" />
            {{ p === 'all' ? t('modelPlaza.filters.all') : p }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">{{ t('modelPlaza.filters.groupLabel') }}</span>
        <div class="filter-options">
          <button
            type="button"
            class="filter-chip"
            :class="chipClass(groupId === 'all')"
            @click="$emit('update:groupId', 'all')"
          >
            {{ t('modelPlaza.filters.all') }}
          </button>
          <button
            v-for="g in groups"
            :key="`group-${g.id}`"
            type="button"
            class="filter-chip max-w-56 truncate disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
            :class="groupId === g.id ? 'chip-tinted-active' : 'chip-tinted'"
            :style="{ '--chip-accent': platformAccentColor(g.platform) }"
            :title="g.name"
            :disabled="!groupEnabled(g)"
            @click="$emit('update:groupId', g.id)"
          >
            {{ g.name }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">{{ t('modelPlaza.filters.rateLabel') }}</span>
        <div class="filter-options">
          <button
            type="button"
            class="filter-chip"
            :class="chipClass(rate === 'all')"
            @click="$emit('update:rate', 'all')"
          >
            {{ t('modelPlaza.filters.all') }}
          </button>
          <button
            v-for="r in rates"
            :key="`rate-${r}`"
            type="button"
            class="filter-chip font-mono disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
            :class="chipClass(rate === r)"
            :disabled="!rateEnabled(r)"
            @click="$emit('update:rate', r)"
          >
            {{ r }}x
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import { platformAccentColor } from '@/utils/platformColors'
import type { GroupPlatform } from '@/types'

const props = defineProps<{
  platforms: string[]
  groups: Array<{ id: number; name: string; platform: string; rate: number }>
  rates: number[]
  platform: string
  groupId: number | 'all'
  rate: number | 'all'
}>()

const emit = defineEmits<{
  'update:platform': [value: string]
  'update:groupId': [value: number | 'all']
  'update:rate': [value: number | 'all']
}>()

const { t } = useI18n()
const mobileFiltersOpen = ref(false)

const activeFilterCount = computed(
  () => Number(props.platform !== 'all') + Number(props.groupId !== 'all') + Number(props.rate !== 'all')
)

const activeSummary = computed(() => {
  const selected: string[] = []
  if (props.platform !== 'all') selected.push(props.platform)
  if (props.groupId !== 'all') {
    const group = props.groups.find((item) => item.id === props.groupId)
    if (group) selected.push(group.name)
  }
  if (props.rate !== 'all') selected.push(`${props.rate}x`)
  return selected.length ? selected.join(' · ') : t('modelPlaza.filters.allModels')
})

const platformSelectOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('modelPlaza.filters.all') },
  ...props.platforms.map((value) => ({
    value,
    label: value,
    disabled: !platformEnabled(value)
  }))
])

const groupSelectOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('modelPlaza.filters.all') },
  ...props.groups.map((group) => ({
    value: group.id,
    label: group.name,
    disabled: !groupEnabled(group)
  }))
])

const rateSelectOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('modelPlaza.filters.all') },
  ...props.rates.map((value) => ({
    value,
    label: `${value}x`,
    disabled: !rateEnabled(value)
  }))
])

function updatePlatform(value: string | number | boolean | null): void {
  if (typeof value === 'string') emit('update:platform', value)
}

function updateGroup(value: string | number | boolean | null): void {
  if (value === 'all' || typeof value === 'number') emit('update:groupId', value)
}

function updateRate(value: string | number | boolean | null): void {
  if (value === 'all' || typeof value === 'number') emit('update:rate', value)
}

function platformEnabled(platform: string): boolean {
  return props.groups.some(
    (group) =>
      group.platform === platform &&
      (props.groupId === 'all' || group.id === props.groupId) &&
      (props.rate === 'all' || group.rate === props.rate)
  )
}

function groupEnabled(group: { platform: string; rate: number }): boolean {
  return (
    (props.platform === 'all' || group.platform === props.platform) &&
    (props.rate === 'all' || group.rate === props.rate)
  )
}

function rateEnabled(rate: number): boolean {
  return props.groups.some(
    (group) =>
      group.rate === rate &&
      (props.platform === 'all' || group.platform === props.platform) &&
      (props.groupId === 'all' || group.id === props.groupId)
  )
}

function chipClass(active: boolean): string {
  return active ? 'filter-chip-active' : 'filter-chip-default'
}
</script>

<style scoped>
.plaza-filter-bar {
  @apply border-y border-gray-200 py-3 dark:border-dark-700;
}

.desktop-filter-list {
  @apply hidden space-y-2 sm:block;
}

.mobile-filter-controls {
  @apply mt-3 grid gap-3 border-t border-gray-100 pt-3 dark:border-dark-800;
}

.mobile-filter-field {
  @apply grid gap-1.5 text-xs font-semibold text-gray-500 dark:text-dark-400;
}

.filter-row {
  @apply grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-start gap-2;
}

.filter-label {
  @apply pt-1 text-xs font-semibold text-gray-400 dark:text-dark-500;
}

.filter-options {
  @apply flex min-w-0 flex-wrap gap-1.5;
}

.filter-chip {
  @apply min-w-0 flex-shrink-0 rounded-[3px] border border-transparent px-2.5 py-1 text-xs font-medium transition-colors;
}

.filter-chip-default {
  @apply border-gray-200 bg-white text-gray-600 enabled:hover:border-gray-300 enabled:hover:bg-gray-50 enabled:hover:text-gray-900 dark:border-dark-700 dark:bg-dark-800/60 dark:text-dark-300 dark:enabled:hover:bg-dark-800 dark:enabled:hover:text-white;
}

.filter-chip-active {
  @apply border-primary-600 bg-primary-600 text-white;
}

.chip-tinted {
  color: var(--chip-accent);
  color: color-mix(in srgb, var(--chip-accent) 78%, black);
  background-color: color-mix(in srgb, var(--chip-accent) 9%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-accent) 25%, transparent);
}

.chip-tinted:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--chip-accent) 16%, transparent);
}

.dark .chip-tinted {
  color: color-mix(in srgb, var(--chip-accent) 72%, white);
  background-color: color-mix(in srgb, var(--chip-accent) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-accent) 30%, transparent);
}

.dark .chip-tinted:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--chip-accent) 18%, transparent);
}

.chip-tinted-active {
  color: #fff;
  background-color: var(--chip-accent);
  background-color: color-mix(in srgb, var(--chip-accent) 85%, black);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-accent) 75%, black);
}

.chip-tinted-active:not(:disabled):hover {
  background-color: color-mix(in srgb, var(--chip-accent) 75%, black);
}

.dark .chip-tinted-active {
  background-color: color-mix(in srgb, var(--chip-accent) 80%, transparent);
}

.dark .chip-tinted-active:not(:disabled):hover {
  background-color: var(--chip-accent);
}

@media (min-width: 1280px) {
  .plaza-filter-bar {
    @apply border-y-0 border-r border-gray-200 py-0 pr-5 dark:border-dark-700;
  }

  .desktop-filter-list {
    @apply space-y-5;
  }

  .filter-row {
    @apply block;
  }

  .filter-label {
    @apply mb-2 block pt-0 text-[11px] text-gray-500 dark:text-dark-400;
  }

  .filter-options {
    @apply flex-col items-stretch gap-1;
  }

  .filter-chip {
    @apply flex w-full max-w-none items-center justify-start overflow-hidden px-2 py-1.5 text-left;
  }

  .filter-chip-default {
    @apply border-transparent bg-transparent text-gray-600 enabled:hover:border-transparent enabled:hover:bg-gray-100 enabled:hover:text-gray-900 dark:border-transparent dark:bg-transparent dark:text-dark-300 dark:enabled:hover:bg-dark-800 dark:enabled:hover:text-white;
  }

  .filter-chip-active {
    @apply border-transparent bg-primary-50 text-primary-700 dark:border-transparent dark:bg-primary-500/10 dark:text-primary-300;
  }

  .chip-tinted,
  .chip-tinted-active {
    border-color: transparent;
    box-shadow: none;
  }

  .chip-tinted {
    background-color: transparent;
  }

  .chip-tinted:not(:disabled):hover {
    background-color: color-mix(in srgb, var(--chip-accent) 8%, transparent);
  }

  .chip-tinted-active,
  .dark .chip-tinted-active {
    color: color-mix(in srgb, var(--chip-accent) 78%, black);
    background-color: color-mix(in srgb, var(--chip-accent) 11%, transparent);
  }

  .chip-tinted-active:not(:disabled):hover,
  .dark .chip-tinted-active:not(:disabled):hover {
    background-color: color-mix(in srgb, var(--chip-accent) 16%, transparent);
  }

  .dark .chip-tinted-active {
    color: color-mix(in srgb, var(--chip-accent) 70%, white);
  }
}
</style>
