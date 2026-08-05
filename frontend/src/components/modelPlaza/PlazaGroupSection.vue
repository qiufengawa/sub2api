<template>
  <section class="plaza-group" :style="accentStyle">
    <header class="plaza-group-header">
      <div class="flex min-w-0 items-start gap-2.5">
        <span class="group-accent" aria-hidden="true"></span>
        <div class="flex min-w-0 items-start gap-2.5">
          <PlatformIcon
            :platform="group.platform as GroupPlatform"
            size="md"
            class="mt-0.5 flex-shrink-0"
            :style="{ color: platformAccentColor(group.platform) }"
          />
          <div class="min-w-0">
            <div class="flex min-w-0 items-baseline gap-2">
              <h2 class="group-title" :title="group.name">{{ group.name }}</h2>
              <span class="hidden flex-shrink-0 text-xs text-gray-400 dark:text-dark-500 sm:inline">
                {{ platformLabel(group.platform) }}
              </span>
            </div>
            <p
              v-if="group.description"
              class="plaza-group-description mt-1 text-sm leading-5 text-gray-500 dark:text-dark-400"
              :title="group.description"
            >
              {{ group.description }}
            </p>
            <p
              v-if="peakNote"
              class="mt-1 inline-flex items-start gap-1 text-xs leading-5 text-amber-600 dark:text-amber-400"
            >
              <Icon name="clock" size="xs" class="mt-0.5 h-3 w-3 flex-shrink-0" />
              {{ peakNote }}
            </p>
          </div>
        </div>
      </div>

      <div class="group-meta">
        <span class="rate-label">
          <span class="text-[10px] font-medium text-gray-400 dark:text-dark-500">
            {{ t('modelPlaza.table.rate') }}
          </span>
          <template v-if="hasCustomRate">
            <span class="text-xs text-gray-400 line-through dark:text-dark-500">{{ group.rate_multiplier }}x</span>
            <span class="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">{{ effectiveRate }}x</span>
          </template>
          <span v-else class="font-mono text-sm font-bold text-gray-800 dark:text-gray-100">
            {{ effectiveRate }}x
          </span>
        </span>
        <span v-if="group.is_exclusive" class="group-flag text-purple-600 dark:text-purple-400">
          <Icon name="shield" size="xs" class="h-3 w-3" />
          {{ t('modelPlaza.badges.exclusive') }}
        </span>
      </div>
    </header>

    <!-- 模型价格表:整行(含 hover 底色/分区底色)顶到卡片边缘,左右留白由表格首列/末列的 padding 提供 -->
    <div>
      <PlazaModelPricingTable
        v-if="group.models.length > 0"
        :models="group.models"
        :platform="group.platform"
        :rate-multiplier="group.rate_multiplier"
        :user-rate-multiplier="group.user_rate_multiplier ?? null"
        :image-rate-independent="group.image_rate_independent"
        :image-rate-multiplier="group.image_rate_multiplier"
      />
      <p v-else class="px-5 py-4 text-center text-sm text-gray-400 dark:text-dark-500">
        {{ t('modelPlaza.detail.noModels') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import PlazaModelPricingTable from './PlazaModelPricingTable.vue'
import type { ModelPlazaGroup } from '@/api/modelPlaza'
import type { GroupPlatform } from '@/types'
import { platformAccentColor, platformLabel } from '@/utils/platformColors'
import { hasPeakRate, formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  group: ModelPlazaGroup
}>()

const { t } = useI18n()
const appStore = useAppStore()

const effectiveRate = computed(() => props.group.user_rate_multiplier ?? props.group.rate_multiplier)
const hasCustomRate = computed(
  () =>
    props.group.user_rate_multiplier != null &&
    props.group.user_rate_multiplier !== props.group.rate_multiplier
)
const accentStyle = computed(() => ({ '--plaza-accent': platformAccentColor(props.group.platform) }))

const peakNote = computed(() => {
  if (!hasPeakRate(props.group)) return ''
  const window = formatPeakRateWindow(
    props.group,
    serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  )
  return t('modelPlaza.detail.peakNote', {
    window,
    multiplier: props.group.peak_rate_multiplier
  })
})
</script>

<style scoped>
.plaza-group {
  @apply min-w-0;
}

.plaza-group + .plaza-group {
  @apply border-t border-gray-200 dark:border-dark-700;
}

.plaza-group-header {
  @apply flex min-w-0 flex-col gap-2.5 border-b border-gray-200 bg-gray-50/70 px-3 py-3 dark:border-dark-700 dark:bg-dark-800/45 sm:flex-row sm:items-start sm:justify-between sm:px-4;
}

.group-accent {
  @apply mt-0.5 h-8 w-0.5 flex-shrink-0 rounded-[2px];
  background-color: var(--plaza-accent);
}

.group-title {
  @apply min-w-0 truncate text-sm font-semibold leading-5 text-gray-900 dark:text-white sm:text-base;
}

.group-meta {
  @apply flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 sm:flex-shrink-0 sm:justify-end sm:pl-0;
}

.rate-label {
  @apply inline-flex min-h-5 items-center gap-1.5;
}

.group-flag {
  @apply inline-flex items-center gap-1 text-xs font-medium;
}

.plaza-group-description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
}
</style>
