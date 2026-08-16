<template>
  <div class="plaza-filter-bar">
    <div class="plaza-filter-mobile">
      <UiButton
        variant="secondary"
        density="compact"
        block
        :aria-expanded="mobileFiltersOpen"
        @click="mobileFiltersOpen = true"
      >
        <template #icon><Icon name="filter" size="sm" aria-hidden="true" /></template>
        {{ t('modelPlaza.filters.filterButton') }}
        <UiBadge v-if="activeFilterCount" :label="String(activeFilterCount)" />
        <span class="plaza-filter-mobile__summary">{{ activeSummary }}</span>
      </UiButton>

      <UiSheet
        :show="mobileFiltersOpen"
        :title="t('modelPlaza.filters.filterButton')"
        @close="mobileFiltersOpen = false"
      >
        <AppStack :gap="12">
          <UiSelect
            :model-value="platform"
            :options="platformSelectOptions"
            :label="t('modelPlaza.filters.platformLabel')"
            density="compact"
            @update:model-value="updatePlatform"
          />
          <UiSelect
            :model-value="groupId"
            :options="groupSelectOptions"
            :label="t('modelPlaza.filters.groupLabel')"
            searchable="auto"
            density="compact"
            @update:model-value="updateGroup"
          />
          <UiSelect
            :model-value="rate"
            :options="rateSelectOptions"
            :label="t('modelPlaza.filters.rateLabel')"
            :searchable="false"
            density="compact"
            @update:model-value="updateRate"
          />
        </AppStack>

        <template #footer>
          <AppInline justify="space-between">
            <UiButton variant="quiet" density="compact" :disabled="activeFilterCount === 0" @click="clearFilters">
              {{ t('modelPlaza.filters.clear') }}
            </UiButton>
            <UiButton variant="primary" density="compact" @click="mobileFiltersOpen = false">
              {{ t('modelPlaza.filters.apply') }}
            </UiButton>
          </AppInline>
        </template>
      </UiSheet>
    </div>

    <UiFilterBar
      class="plaza-filter-desktop"
      :active-count="activeFilterCount"
      :clear-label="t('modelPlaza.filters.clear')"
      @clear="clearFilters"
    >
      <div class="filter-row">
        <span class="filter-label">{{ t('modelPlaza.filters.platformLabel') }}</span>
        <div class="filter-options">
          <UiButton
            v-for="item in ['all', ...platforms]"
            :key="`platform-${item}`"
            class="filter-chip"
            :variant="platform === item ? 'primary' : 'quiet'"
            density="dense"
            :disabled="item !== 'all' && !platformEnabled(item)"
            :aria-pressed="platform === item"
            @click="emit('update:platform', item)"
          >
            <template v-if="item !== 'all'" #icon>
              <PlatformIcon :platform="item as GroupPlatform" size="xs" />
            </template>
            {{ item === 'all' ? t('modelPlaza.filters.all') : item }}
          </UiButton>
        </div>
      </div>

      <div class="filter-row filter-row--wide">
        <span class="filter-label">{{ t('modelPlaza.filters.groupLabel') }}</span>
        <div class="filter-options">
          <UiButton
            class="filter-chip"
            :variant="groupId === 'all' ? 'primary' : 'quiet'"
            density="dense"
            :aria-pressed="groupId === 'all'"
            @click="emit('update:groupId', 'all')"
          >{{ t('modelPlaza.filters.all') }}</UiButton>
          <UiButton
            v-for="group in groups"
            :key="group.id"
            class="filter-chip"
            :variant="groupId === group.id ? 'primary' : 'quiet'"
            density="dense"
            :disabled="!groupEnabled(group)"
            :aria-pressed="groupId === group.id"
            :title="group.name"
            @click="emit('update:groupId', group.id)"
          >{{ group.name }}</UiButton>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">{{ t('modelPlaza.filters.rateLabel') }}</span>
        <div class="filter-options">
          <UiButton
            class="filter-chip"
            :variant="rate === 'all' ? 'primary' : 'quiet'"
            density="dense"
            :aria-pressed="rate === 'all'"
            @click="emit('update:rate', 'all')"
          >{{ t('modelPlaza.filters.all') }}</UiButton>
          <UiButton
            v-for="value in rates"
            :key="value"
            class="filter-chip"
            :variant="rate === value ? 'primary' : 'quiet'"
            density="dense"
            :disabled="!rateEnabled(value)"
            :aria-pressed="rate === value"
            @click="emit('update:rate', value)"
          >{{ value }}x</UiButton>
        </div>
      </div>
    </UiFilterBar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import type { GroupPlatform } from '@/types'
import {
  AppInline,
  AppStack,
  UiBadge,
  UiButton,
  UiFilterBar,
  UiSelect,
  UiSheet,
  type SelectOption,
} from '@/components/ui'

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
const activeFilterCount = computed(() => Number(props.platform !== 'all') + Number(props.groupId !== 'all') + Number(props.rate !== 'all'))
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
  ...props.platforms.map((value) => ({ value, label: value, disabled: !platformEnabled(value) })),
])
const groupSelectOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('modelPlaza.filters.all') },
  ...props.groups.map((group) => ({ value: group.id, label: group.name, disabled: !groupEnabled(group) })),
])
const rateSelectOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('modelPlaza.filters.all') },
  ...props.rates.map((value) => ({ value, label: `${value}x`, disabled: !rateEnabled(value) })),
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

function clearFilters(): void {
  emit('update:platform', 'all')
  emit('update:groupId', 'all')
  emit('update:rate', 'all')
}

function platformEnabled(platform: string): boolean {
  return props.groups.some((group) => group.platform === platform && (props.groupId === 'all' || group.id === props.groupId) && (props.rate === 'all' || group.rate === props.rate))
}

function groupEnabled(group: { platform: string; rate: number }): boolean {
  return (props.platform === 'all' || group.platform === props.platform) && (props.rate === 'all' || group.rate === props.rate)
}

function rateEnabled(rate: number): boolean {
  return props.groups.some((group) => group.rate === rate && (props.platform === 'all' || group.platform === props.platform) && (props.groupId === 'all' || group.id === props.groupId))
}
</script>

<style scoped>
.plaza-filter-bar { min-width: 0; }
.plaza-filter-mobile { display: none; }
.filter-row { display: grid; min-width: 180px; gap: 5px; }
.filter-row--wide { flex: 1 1 360px; }
.filter-label { color: var(--ui-text-soft); font-size: 11px; font-weight: 600; }
.filter-options { display: flex; min-width: 0; flex-wrap: wrap; gap: 4px; }
.filter-chip { min-width: 0; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plaza-filter-mobile__summary { min-width: 0; flex: 1; overflow: hidden; color: var(--ui-text-soft); font-size: 12px; font-weight: 400; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 767px) {
  .plaza-filter-mobile { display: block; }
  .plaza-filter-desktop { display: none; }
}
</style>
