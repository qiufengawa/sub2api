<template>
  <!-- .table-wrapper 是 TablePageLayout 滚动链的挂载点：外层 .table-scroll-container
       负责卡片外观并 overflow-hidden，本层接收 overflow-y-auto 才能在内容超高时滚动。 -->
  <div class="table-wrapper">
    <table
      data-testid="desktop-channels"
      class="!hidden w-full table-fixed border-collapse text-sm lg:!table"
    >
      <thead>
        <tr class="border-b border-gray-100 bg-gray-50/50 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-dark-700 dark:bg-dark-800/50 dark:text-gray-400">
          <th class="w-[32%] px-3 py-2 text-left">{{ columns.channelInfo }}</th>
          <th class="w-[18%] px-3 py-2 text-left">{{ columns.platform }}</th>
          <th class="w-[22%] px-3 py-2 text-left">{{ columns.groups }}</th>
          <th class="w-[28%] px-3 py-2 text-left">{{ columns.supportedModels }}</th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr>
          <td colspan="4" class="py-10 text-center">
            <Icon name="refresh" size="lg" class="inline-block animate-spin text-gray-400" />
          </td>
        </tr>
      </tbody>
      <tbody v-else-if="rows.length === 0">
        <tr>
          <td colspan="4" class="py-12 text-center">
            <Icon name="inbox" size="xl" class="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ emptyLabel }}</p>
          </td>
        </tr>
      </tbody>
      <!-- 桌面端先给出可快速扫描的渠道摘要，按需展开完整分组、倍率和模型信息。 -->
      <tbody
        v-else
        v-for="(channel, chIdx) in rows"
        :key="`${channel.name}-${chIdx}`"
        class="border-b border-gray-100 last:border-b-0 dark:border-dark-700"
      >
        <tr
          class="cursor-pointer transition-colors hover:bg-primary-50/40 dark:hover:bg-primary-950/10"
          tabindex="0"
          :aria-expanded="isExpanded(channelKey(channel, chIdx))"
          @click="toggleChannel(channelKey(channel, chIdx))"
          @keydown.enter.prevent="toggleChannel(channelKey(channel, chIdx))"
          @keydown.space.prevent="toggleChannel(channelKey(channel, chIdx))"
        >
          <td class="px-3 py-2.5 align-middle">
            <div class="flex min-w-0 items-start gap-1.5">
              <Icon
                name="chevronRight"
                size="xs"
                class="mt-0.5 shrink-0 text-gray-400 transition-transform"
                :class="isExpanded(channelKey(channel, chIdx)) ? 'rotate-90' : ''"
              />
              <div class="min-w-0">
                <p class="truncate font-medium text-gray-900 dark:text-white" :title="channel.name">
                  {{ channel.name }}
                </p>
                <p
                  class="mt-0.5 line-clamp-2 text-xs leading-4 text-gray-500 dark:text-gray-400"
                  :title="channel.description || '-'"
                >
                  {{ channel.description || '-' }}
                </p>
              </div>
            </div>
          </td>
          <td class="px-3 py-2.5">
            <div class="flex flex-wrap gap-1">
            <span
              v-for="section in channel.platforms"
              :key="`${channel.name}-${section.platform}-summary`"
              :class="[
                'inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[11px] font-medium uppercase',
                platformBadgeClass(section.platform),
              ]"
            >
              <PlatformIcon :platform="section.platform as GroupPlatform" size="xs" />
              {{ section.platform }}
            </span>
            </div>
          </td>
          <td class="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300">
            {{ groupCount(channel) }}
          </td>
          <td class="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300">
            {{ modelCount(channel) }}
          </td>
        </tr>

        <tr v-if="isExpanded(channelKey(channel, chIdx))">
          <td colspan="4" class="bg-gray-50/60 px-3 py-3 dark:bg-dark-900/30">
            <div class="grid gap-2 xl:grid-cols-2">
              <section
                v-for="section in channel.platforms"
                :key="`${channel.name}-${section.platform}-detail`"
                class="rounded border border-gray-200 bg-white p-3 dark:border-dark-700 dark:bg-dark-800"
              >
                <div class="mb-2 flex items-center justify-between gap-2">
                  <span :class="['inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[11px] font-medium uppercase', platformBadgeClass(section.platform)]">
                    <PlatformIcon :platform="section.platform as GroupPlatform" size="xs" />
                    {{ section.platform }}
                  </span>
                  <span class="text-[11px] text-gray-400">
                    {{ section.supported_models.length }} {{ columns.supportedModels }}
                  </span>
                </div>
                <div class="grid gap-2 2xl:grid-cols-2">
                  <div class="min-w-0">
                    <p class="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ columns.groups }}</p>
                    <div class="flex flex-wrap gap-1">
                      <div
                        v-for="g in section.groups"
                        :key="`detail-${g.id}`"
                        class="inline-flex flex-wrap items-center gap-1"
                      >
                        <Icon
                          :name="g.is_exclusive ? 'shield' : 'globe'"
                          size="xs"
                          :class="g.is_exclusive ? 'text-primary-500' : 'text-gray-400'"
                        />
                        <GroupBadge
                          :name="g.name"
                          :platform="g.platform as GroupPlatform"
                          :subscription-type="(g.subscription_type || 'standard') as SubscriptionType"
                          :rate-multiplier="g.rate_multiplier"
                          :user-rate-multiplier="userGroupRates[g.id] ?? null"
                          always-show-rate
                        />
                        <span
                          v-if="hasPeakRate(g)"
                          class="inline-flex items-center gap-1 rounded-[3px] bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                          :title="peakRateTitle(g)"
                        >
                          <Icon name="clock" size="xs" class="h-3 w-3" />
                          {{ peakRateLabel(g) }}
                        </span>
                      </div>
                      <span v-if="section.groups.length === 0" class="text-xs text-gray-400">-</span>
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ columns.supportedModels }}</p>
                    <div class="flex flex-wrap gap-1">
                      <SupportedModelChip
                        v-for="m in section.supported_models"
                        :key="`detail-${section.platform}-${m.name}`"
                        :model="m"
                        :pricing-key-prefix="pricingKeyPrefix"
                        :no-pricing-label="noPricingLabel"
                        :show-platform="false"
                        :platform-hint="section.platform"
                      />
                      <span v-if="section.supported_models.length === 0" class="text-xs text-gray-400">{{ noModelsLabel }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div data-testid="mobile-channels" class="w-full min-w-0 divide-y divide-gray-100 overflow-x-hidden lg:hidden dark:divide-dark-700">
      <div v-if="loading" data-testid="mobile-loading" class="py-10 text-center">
        <Icon name="refresh" size="lg" class="inline-block animate-spin text-gray-400" />
      </div>
      <div v-else-if="rows.length === 0" data-testid="mobile-empty" class="py-12 text-center">
        <Icon name="inbox" size="xl" class="mx-auto mb-3 h-12 w-12 text-gray-400" />
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ emptyLabel }}</p>
      </div>
      <section
        v-else
        v-for="(channel, chIdx) in rows"
        :key="`mobile-${channel.name}-${chIdx}`"
        class="px-3 py-3"
      >
        <header class="mb-2 min-w-0">
          <h3 class="break-words text-sm font-semibold text-gray-900 dark:text-white">
            {{ channel.name }}
          </h3>
          <p class="mt-1 break-words text-xs leading-5 text-gray-500 dark:text-gray-400">
            {{ channel.description || '-' }}
          </p>
        </header>

        <div class="divide-y divide-gray-100 dark:divide-dark-700/60">
          <div
            v-for="section in channel.platforms"
            :key="`mobile-${channel.name}-${section.platform}`"
            class="min-w-0 py-2.5 first:pt-0 last:pb-0"
          >
            <span
              :class="[
                'inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[11px] font-medium uppercase',
                platformBadgeClass(section.platform),
              ]"
            >
              <PlatformIcon :platform="section.platform as GroupPlatform" size="xs" />
              {{ section.platform }}
            </span>

            <dl class="mt-2.5 space-y-2.5">
              <div class="min-w-0">
                <dt class="mb-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {{ columns.groups }}
                </dt>
                <dd class="flex min-w-0 flex-col gap-2">
                  <div
                    v-if="exclusiveGroups(section).length > 0"
                    class="flex min-w-0 flex-wrap items-center gap-1.5"
                  >
                    <span
                      class="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase text-purple-600 dark:text-purple-400"
                      :title="t('availableChannels.exclusiveTooltip')"
                    >
                      <Icon name="shield" size="xs" class="h-3 w-3" />
                      {{ t('availableChannels.exclusive') }}
                    </span>
                    <div
                      v-for="g in exclusiveGroups(section)"
                      :key="`mobile-ex-${g.id}`"
                      class="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1"
                    >
                      <GroupBadge
                        class="max-w-full"
                        :name="g.name"
                        :platform="g.platform as GroupPlatform"
                        :subscription-type="(g.subscription_type || 'standard') as SubscriptionType"
                        :rate-multiplier="g.rate_multiplier"
                        :user-rate-multiplier="userGroupRates[g.id] ?? null"
                        always-show-rate
                      />
                      <span
                        v-if="hasPeakRate(g)"
                        class="inline-flex items-center gap-1 rounded-[3px] bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                        :title="peakRateTitle(g)"
                      >
                        <Icon name="clock" size="xs" class="h-3 w-3" />
                        {{ peakRateLabel(g) }}
                      </span>
                    </div>
                  </div>
                  <div
                    v-if="publicGroups(section).length > 0"
                    class="flex min-w-0 flex-wrap items-center gap-1.5"
                  >
                    <span
                      class="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase text-gray-500 dark:text-gray-400"
                      :title="t('availableChannels.publicTooltip')"
                    >
                      <Icon name="globe" size="xs" class="h-3 w-3" />
                      {{ t('availableChannels.public') }}
                    </span>
                    <div
                      v-for="g in publicGroups(section)"
                      :key="`mobile-pub-${g.id}`"
                      class="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1"
                    >
                      <GroupBadge
                        class="max-w-full"
                        :name="g.name"
                        :platform="g.platform as GroupPlatform"
                        :subscription-type="(g.subscription_type || 'standard') as SubscriptionType"
                        :rate-multiplier="g.rate_multiplier"
                        :user-rate-multiplier="userGroupRates[g.id] ?? null"
                        always-show-rate
                      />
                      <span
                        v-if="hasPeakRate(g)"
                        class="inline-flex items-center gap-1 rounded-[3px] bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                        :title="peakRateTitle(g)"
                      >
                        <Icon name="clock" size="xs" class="h-3 w-3" />
                        {{ peakRateLabel(g) }}
                      </span>
                    </div>
                  </div>
                  <span v-if="section.groups.length === 0" class="text-xs text-gray-400">-</span>
                </dd>
              </div>

              <div class="min-w-0">
                <dt class="mb-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {{ columns.supportedModels }}
                </dt>
                <dd class="flex min-w-0 flex-wrap gap-1">
                  <SupportedModelChip
                    v-for="m in section.supported_models"
                    :key="`mobile-${section.platform}-${m.name}`"
                    class="max-w-full [&>span]:max-w-full [&>span]:truncate"
                    :model="m"
                    :pricing-key-prefix="pricingKeyPrefix"
                    :no-pricing-label="noPricingLabel"
                    :show-platform="false"
                    :platform-hint="section.platform"
                  />
                  <span v-if="section.supported_models.length === 0" class="text-xs text-gray-400">
                    {{ noModelsLabel }}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import GroupBadge from '@/components/common/GroupBadge.vue'
import SupportedModelChip from './SupportedModelChip.vue'
import type { UserAvailableChannel, UserAvailableGroup, UserChannelPlatformSection } from '@/api/channels'
import type { GroupPlatform, SubscriptionType } from '@/types'
import { platformBadgeClass } from '@/utils/platformColors'
import { useAppStore } from '@/stores/app'
import { hasPeakRate as groupHasPeakRate, formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'

const props = defineProps<{
  columns: {
    channelInfo: string
    name: string
    description: string
    platform: string
    groups: string
    supportedModels: string
  }
  rows: UserAvailableChannel[]
  loading: boolean
  pricingKeyPrefix: string
  noPricingLabel: string
  noModelsLabel: string
  emptyLabel: string
  /** 用户专属倍率（group_id → multiplier）；无专属时由 GroupBadge 仅显示默认倍率。 */
  userGroupRates: Record<number, number>
}>()

// Suppress unused warning — props is accessed via template automatically but
// the explicit reference here keeps the linter from flagging userGroupRates.
void props.userGroupRates

const { t } = useI18n()

const expandedChannels = ref<Set<string>>(new Set())

function channelKey(channel: UserAvailableChannel, index: number): string {
  return `${channel.name}-${index}`
}

function isExpanded(key: string): boolean {
  return expandedChannels.value.has(key)
}

function toggleChannel(key: string): void {
  const next = new Set(expandedChannels.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedChannels.value = next
}

function groupCount(channel: UserAvailableChannel): number {
  return channel.platforms.reduce((total, section) => total + section.groups.length, 0)
}

function modelCount(channel: UserAvailableChannel): number {
  return new Set(channel.platforms.flatMap((section) => section.supported_models.map((model) => model.name))).size
}

function exclusiveGroups(section: UserChannelPlatformSection): UserAvailableGroup[] {
  return section.groups.filter((g) => g.is_exclusive)
}

function publicGroups(section: UserChannelPlatformSection): UserAvailableGroup[] {
  return section.groups.filter((g) => !g.is_exclusive)
}

const appStore = useAppStore()

function hasPeakRate(group: UserAvailableGroup): boolean {
  return groupHasPeakRate(group)
}

function peakRateLabel(group: UserAvailableGroup): string {
  return formatPeakRateWindow(group, serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset))
}

function peakRateTitle(group: UserAvailableGroup): string {
  return t('common.peakRateTooltip', { window: peakRateLabel(group) }) + t('common.peakRateImageNote')
}
</script>
