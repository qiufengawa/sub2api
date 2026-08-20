<template>
  <UiMobileTableScroller
    min-width="860px"
    :label="columns.channelInfo"
    data-testid="available-channels-scroller"
  >
    <table class="channels-table" data-testid="desktop-channels">
      <colgroup>
        <col class="channels-table__identity" />
        <col class="channels-table__platform" />
        <col class="channels-table__count" />
        <col class="channels-table__count" />
        <col class="channels-table__action" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">{{ columns.channelInfo }}</th>
          <th scope="col">{{ columns.platform }}</th>
          <th scope="col">{{ columns.groups }}</th>
          <th scope="col">{{ columns.supportedModels }}</th>
          <th scope="col"><span class="sr-only">{{ t('common.actions') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="index in 5" :key="`skeleton-${index}`" data-testid="channel-skeleton-row">
            <td><UiSkeleton variant="text" width="72%" /></td>
            <td><UiSkeleton variant="text" width="58%" /></td>
            <td><UiSkeleton variant="text" width="32px" /></td>
            <td><UiSkeleton variant="text" width="32px" /></td>
            <td><UiSkeleton variant="rect" width="28px" height="28px" /></td>
          </tr>
        </template>

        <tr v-else-if="rows.length === 0">
          <td colspan="5" class="channels-table__state">
            <UiEmptyState :title="emptyLabel" icon="inbox" />
          </td>
        </tr>

        <template v-else v-for="(channel, channelIndex) in rows" :key="channelKey(channel, channelIndex)">
          <tr class="channels-table__summary">
            <td>
              <div class="channel-identity">
                <strong :title="channel.name">{{ channel.name }}</strong>
                <span :title="channel.description || '-'">{{ channel.description || '-' }}</span>
              </div>
            </td>
            <td>
              <div class="channel-chip-list">
                <UiBadge
                  v-for="section in channel.platforms"
                  :key="`${channel.name}-${section.platform}-summary`"
                >
                  <PlatformIcon :platform="section.platform as GroupPlatform" size="xs" />
                  {{ section.platform }}
                </UiBadge>
              </div>
            </td>
            <td class="channels-table__number">{{ groupCount(channel) }}</td>
            <td class="channels-table__number">{{ modelCount(channel) }}</td>
            <td class="channels-table__action-cell">
              <UiIconButton
                :icon="isExpanded(channelKey(channel, channelIndex)) ? 'chevronUp' : 'chevronDown'"
                variant="ghost"
                density="dense"
                :label="
                  isExpanded(channelKey(channel, channelIndex))
                    ? t('availableChannels.collapseDetails')
                    : t('availableChannels.expandDetails')
                "
                :aria-expanded="isExpanded(channelKey(channel, channelIndex))"
                :aria-controls="`available-channel-details-${channelIndex}`"
                @click="toggleChannel(channelKey(channel, channelIndex))"
              />
            </td>
          </tr>

          <tr v-if="isExpanded(channelKey(channel, channelIndex))" class="channels-table__details">
            <td :id="`available-channel-details-${channelIndex}`" colspan="5">
              <section
                v-for="section in channel.platforms"
                :key="`${channel.name}-${section.platform}-detail`"
                class="channel-platform-section"
              >
                <header class="channel-platform-section__header">
                  <UiBadge>
                    <PlatformIcon :platform="section.platform as GroupPlatform" size="xs" />
                    {{ section.platform }}
                  </UiBadge>
                  <span>
                    {{ section.supported_models.length }} {{ columns.supportedModels }}
                  </span>
                </header>

                <div class="channel-platform-section__content">
                  <div class="channel-detail-block">
                    <h3>{{ columns.groups }}</h3>
                    <div v-if="section.groups.length > 0" class="channel-group-sections">
                      <div v-if="exclusiveGroups(section).length > 0" class="channel-group-section">
                        <p :title="t('availableChannels.exclusiveTooltip')">
                          <Icon name="shield" size="xs" />
                          {{ t('availableChannels.exclusive') }}
                        </p>
                        <div class="channel-chip-list">
                          <template v-for="group in exclusiveGroups(section)" :key="`exclusive-${group.id}`">
                            <UiBadge :title="group.name">
                              <span class="channel-group-name">{{ group.name }}</span>
                              <span v-if="hasCustomRate(group)" class="channel-rate">
                                <s>{{ formatRate(group.rate_multiplier) }}</s>
                                {{ formatRate(userGroupRates[group.id]) }}
                              </span>
                              <span v-else class="channel-rate">{{ formatRate(group.rate_multiplier) }}</span>
                            </UiBadge>
                            <UiBadge
                              v-if="hasPeakRate(group)"
                              tone="warning"
                              :title="peakRateTitle(group)"
                            >
                              <Icon name="clock" size="xs" />
                              {{ peakRateLabel(group) }}
                            </UiBadge>
                          </template>
                        </div>
                      </div>

                      <div v-if="publicGroups(section).length > 0" class="channel-group-section">
                        <p :title="t('availableChannels.publicTooltip')">
                          <Icon name="globe" size="xs" />
                          {{ t('availableChannels.public') }}
                        </p>
                        <div class="channel-chip-list">
                          <template v-for="group in publicGroups(section)" :key="`public-${group.id}`">
                            <UiBadge :title="group.name">
                              <span class="channel-group-name">{{ group.name }}</span>
                              <span v-if="hasCustomRate(group)" class="channel-rate">
                                <s>{{ formatRate(group.rate_multiplier) }}</s>
                                {{ formatRate(userGroupRates[group.id]) }}
                              </span>
                              <span v-else class="channel-rate">{{ formatRate(group.rate_multiplier) }}</span>
                            </UiBadge>
                            <UiBadge
                              v-if="hasPeakRate(group)"
                              tone="warning"
                              :title="peakRateTitle(group)"
                            >
                              <Icon name="clock" size="xs" />
                              {{ peakRateLabel(group) }}
                            </UiBadge>
                          </template>
                        </div>
                      </div>
                    </div>
                    <span v-else class="channel-placeholder">-</span>
                  </div>

                  <div class="channel-detail-block">
                    <h3>{{ columns.supportedModels }}</h3>
                    <div v-if="section.supported_models.length > 0" class="channel-chip-list">
                      <SupportedModelChip
                        v-for="model in section.supported_models"
                        :key="`${section.platform}-${model.name}`"
                        :model="model"
                        :pricing-key-prefix="pricingKeyPrefix"
                        :no-pricing-label="noPricingLabel"
                        :show-platform="false"
                        :platform-hint="section.platform"
                      />
                    </div>
                    <span v-else class="channel-placeholder">{{ noModelsLabel }}</span>
                  </div>
                </div>
              </section>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </UiMobileTableScroller>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { UiBadge, UiEmptyState, UiIconButton, UiMobileTableScroller, UiSkeleton } from '@/components/ui'
import SupportedModelChip from './SupportedModelChip.vue'
import type {
  UserAvailableChannel,
  UserAvailableGroup,
  UserChannelPlatformSection
} from '@/api/channels'
import type { GroupPlatform } from '@/types'
import { useAppStore } from '@/stores/app'
import {
  formatPeakRateWindow,
  hasPeakRate as groupHasPeakRate,
  serverTimezoneLabel
} from '@/utils/peak-rate'

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
  userGroupRates: Record<number, number>
}>()

const { t } = useI18n()
const appStore = useAppStore()
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
  return new Set(
    channel.platforms.flatMap((section) => section.supported_models.map((model) => model.name))
  ).size
}

function exclusiveGroups(section: UserChannelPlatformSection): UserAvailableGroup[] {
  return section.groups.filter((group) => group.is_exclusive)
}

function publicGroups(section: UserChannelPlatformSection): UserAvailableGroup[] {
  return section.groups.filter((group) => !group.is_exclusive)
}

function hasCustomRate(group: UserAvailableGroup): boolean {
  const customRate = props.userGroupRates[group.id]
  return customRate !== undefined && customRate !== group.rate_multiplier
}

function formatRate(rate: number): string {
  return `${rate}x`
}

function hasPeakRate(group: UserAvailableGroup): boolean {
  return groupHasPeakRate(group)
}

function peakRateLabel(group: UserAvailableGroup): string {
  return formatPeakRateWindow(
    group,
    serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  )
}

function peakRateTitle(group: UserAvailableGroup): string {
  return t('common.peakRateTooltip', { window: peakRateLabel(group) }) + t('common.peakRateImageNote')
}
</script>

<style scoped>
.channels-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--ui-text);
  background: var(--ui-surface);
}

.channels-table__identity { width: 32%; }
.channels-table__platform { width: 20%; }
.channels-table__count { width: 20%; }
.channels-table__action { width: 52px; }

.channels-table th {
  height: 36px;
  padding: 0 12px;
  border-bottom: 1px solid var(--ui-border);
  color: var(--ui-text-soft);
  background: var(--ui-surface-muted);
  font-size: 11px;
  font-weight: 600;
  text-align: left;
}

.channels-table td {
  min-width: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ui-border-soft);
  font-size: 12px;
  vertical-align: middle;
}

.channels-table__summary:hover {
  background: var(--ui-surface-muted);
}

.channels-table__number {
  color: var(--ui-text-muted);
  font-family: var(--ui-font-latin);
  font-variant-numeric: tabular-nums;
}

.channels-table__action-cell {
  text-align: right;
}

.channels-table__state {
  padding: 0;
}

.channel-identity {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.channel-identity strong,
.channel-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-identity strong {
  font-size: 13px;
  font-weight: 600;
}

.channel-identity span,
.channel-placeholder {
  color: var(--ui-text-soft);
  font-size: 11px;
}

.channel-chip-list {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.channels-table__details > td {
  padding: 0 14px;
  background: var(--ui-surface-muted);
}

.channel-platform-section {
  padding: 14px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.channel-platform-section:last-child {
  border-bottom: 0;
}

.channel-platform-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.channel-platform-section__header > span {
  color: var(--ui-text-soft);
  font-size: 11px;
}

.channel-platform-section__content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  margin-top: 12px;
}

.channel-detail-block,
.channel-group-sections,
.channel-group-section {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.channel-detail-block h3,
.channel-group-section p {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.channel-group-section p {
  display: flex;
  align-items: center;
  gap: 5px;
}

.channel-group-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.channel-rate {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--ui-font-latin);
  font-variant-numeric: tabular-nums;
}

.channel-rate s {
  color: var(--ui-text-soft);
}

.sr-only {
  position: static;
  display: block;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
