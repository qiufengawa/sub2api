<template>
  <section class="plaza-group">
    <header class="plaza-group-header">
      <div class="plaza-group-header__identity">
        <div class="plaza-group-header__content">
          <PlatformIcon
            :platform="group.platform as GroupPlatform"
            size="md"
            class="plaza-group-platform"
            :style="{ color: platformAccentColor(group.platform) }"
          />
          <div class="plaza-group-header__copy">
            <div class="plaza-group-title-line">
              <h2 class="group-title" :title="group.name">{{ group.name }}</h2>
              <span class="plaza-group-platform-label">{{ platformLabel(group.platform) }}</span>
            </div>
            <p
              v-if="group.description"
              class="plaza-group-description"
              :title="group.description"
            >
              {{ group.description }}
            </p>
            <p
              v-if="peakNote"
              class="plaza-group-peak"
            >
              <Icon name="clock" size="xs" aria-hidden="true" />
              {{ peakNote }}
            </p>
          </div>
        </div>
      </div>

      <div class="group-meta">
        <span class="rate-label">
          <span class="rate-caption">{{ t('modelPlaza.table.rate') }}</span>
          <template v-if="hasCustomRate">
            <span class="rate-original">{{ group.rate_multiplier }}x</span>
            <UiBadge tone="neutral" :label="`${effectiveRate}x`" />
          </template>
          <UiBadge v-else tone="neutral" :label="`${effectiveRate}x`" />
        </span>
        <UiBadge v-if="group.is_exclusive" tone="warning" :label="t('modelPlaza.badges.exclusive')">
          <template #default><Icon name="shield" size="xs" aria-hidden="true" /> {{ t('modelPlaza.badges.exclusive') }}</template>
        </UiBadge>
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
      <p v-else class="plaza-group-empty">{{ t('modelPlaza.detail.noModels') }}</p>
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
import { UiBadge } from '@/components/ui'

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
.plaza-group { min-width: 0; }
.plaza-group + .plaza-group { border-top: 1px solid var(--ui-border-soft); }
.plaza-group-header { display: flex; min-width: 0; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid var(--ui-border-soft); background: var(--ui-surface-muted); }
.plaza-group-header__identity { display: flex; min-width: 0; align-items: flex-start; gap: 10px; }
.plaza-group-header__content { display: flex; min-width: 0; align-items: flex-start; gap: 9px; }
.plaza-group-platform { flex: 0 0 auto; margin-top: 2px; }
.plaza-group-header__copy { min-width: 0; }
.plaza-group-title-line { display: flex; min-width: 0; align-items: baseline; gap: 8px; }
.group-title { min-width: 0; margin: 0; color: var(--ui-text); font-size: 15px; font-weight: 650; line-height: 22px; overflow-wrap: anywhere; }
.plaza-group-platform-label { flex: 0 0 auto; color: var(--ui-text-soft); font-size: 11px; }
.plaza-group-description { margin: 3px 0 0; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.plaza-group-peak { display: inline-flex; align-items: flex-start; gap: 5px; margin: 4px 0 0; color: var(--ui-warning); font-size: 11px; line-height: 17px; }
.group-meta { display: flex; flex: 0 0 auto; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.rate-label { display: inline-flex; align-items: center; gap: 6px; }
.rate-caption { color: var(--ui-text-soft); font-size: 10px; }
.rate-original { color: var(--ui-text-soft); font-family: var(--ui-font-mono); font-size: 11px; text-decoration: line-through; }
.plaza-group-empty { margin: 0; padding: 24px 16px; color: var(--ui-text-soft); text-align: center; font-size: 12px; }
@media (max-width: 640px) { .plaza-group-header { flex-direction: column; gap: 10px; padding: 12px; } .group-meta { justify-content: flex-start; } }
</style>
