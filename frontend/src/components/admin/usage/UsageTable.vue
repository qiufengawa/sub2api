<template>
  <section class="usage-table" :class="{ 'usage-table--framed': !flat }">
    <div
      v-if="showIpGeoToolbar"
      class="usage-table__toolbar"
    >
      <span v-if="pendingIpCount > 0" class="usage-table__pending">
        {{ t('usage.ipGeo.pending', { count: pendingIpCount }) }}
      </span>
      <UiButton
        density="dense"
        :disabled="ipGeoBatchLoading || pendingIpCount === 0"
        @click="handleBatchFetchIpGeo"
      >
        {{ ipGeoBatchLoading ? t('usage.ipGeo.batchFetching') : t('usage.ipGeo.batchFetch') }}
      </UiButton>
    </div>
    <UiMobileTableScroller class="usage-table__scroller" min-width="760px" :label="t('usage.noRecords')">
      <UiDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :mobile-table="mobileTable"
        :server-side-sort="serverSideSort"
        :default-sort-key="defaultSortKey"
        :default-sort-order="defaultSortOrder"
        @sort="(key, order) => $emit('sort', key, order)"
      >
        <template #cell-user="{ row }">
          <div class="text-sm">
            <UiButton
              v-if="row.user?.email"
              density="mini"
              variant="quiet"
              @click="$emit('userClick', row.user_id, row.user?.email)"
              :title="t('admin.usage.clickToViewBalance')"
            >
              {{ row.user.email }}
            </UiButton>
            <span v-else class="font-medium text-gray-900 dark:text-white">-</span>
            <UiBadge v-if="row.user?.deleted_at" tone="danger">
              {{ t('admin.usage.userDeletedBadge') }}
            </UiBadge>
            <span class="ml-1 text-gray-500 dark:text-gray-400">#{{ row.user_id }}</span>
          </div>
        </template>

        <template #cell-api_key="{ row }">
          <span class="text-sm text-gray-900 dark:text-white">{{ row.api_key?.name || '-' }}</span>
        </template>

        <template #cell-account="{ row }">
          <span class="text-sm text-gray-900 dark:text-white">{{ row.account?.name || '-' }}</span>
        </template>

        <template #cell-model="{ row }">
          <div class="usage-model-cell">
            <div v-if="row.model_mapping_chain && row.model_mapping_chain.includes('→')" class="space-y-0.5">
              <div v-for="(step, i) in row.model_mapping_chain.split('→')" :key="i" class="usage-model-line" :class="i === 0 ? 'usage-model-line--primary' : 'usage-model-line--upstream'">
                <span class="usage-model-role">{{ i === 0 ? t('usage.requestedModel') : t('usage.sentUpstreamModel') }}</span>
                <span v-if="i > 0" class="usage-model-arrow" aria-hidden="true">↳</span>
                <span class="usage-model-name">{{ step.trim() }}</span>
              </div>
            </div>
            <div v-else-if="row.upstream_model && row.upstream_model !== row.model" class="space-y-0.5">
              <div class="usage-model-line usage-model-line--primary">
                <span class="usage-model-role">{{ t('usage.requestedModel') }}</span>
                <span class="usage-model-name">{{ row.model }}</span>
              </div>
              <div class="usage-model-line usage-model-line--upstream">
                <span class="usage-model-role">{{ t('usage.sentUpstreamModel') }}</span>
                <span class="usage-model-arrow" aria-hidden="true">↳</span>
                <span class="usage-model-name">{{ row.upstream_model }}</span>
              </div>
            </div>
            <div v-else class="usage-model-line usage-model-line--primary">
              <span class="usage-model-role">{{ t('usage.requestedModel') }}</span>
              <span class="usage-model-name">{{ row.model }}</span>
            </div>
            <div
              v-if="row.upstream_model_mismatch === true && row.upstream_response_model"
              class="break-all pl-3 text-[11px]"
              :class="isLikelyModelVariant(row) ? 'text-amber-600 dark:text-amber-400' : 'text-orange-600 dark:text-orange-400'"
              :title="modelAuditTitle(row)"
            >
              <span class="mr-1">↳ {{ t('usage.upstreamResponseModel') }}:</span>{{ row.upstream_response_model }}
              <UiBadge :tone="isLikelyModelVariant(row) ? 'warning' : 'danger'">
                {{ isLikelyModelVariant(row) ? t('usage.modelVariant') : t('usage.modelMismatch') }}
              </UiBadge>
            </div>
          </div>
        </template>

        <template #cell-reasoning_effort="{ row }">
          <span class="text-sm text-gray-900 dark:text-white">
            {{ formatReasoningEffort(row.reasoning_effort) }}
          </span>
        </template>

        <template #cell-endpoint="{ row }">
          <div class="max-w-[320px] space-y-1 text-xs">
            <div class="break-all text-gray-700 dark:text-gray-300">
              <span class="font-medium text-gray-500 dark:text-gray-400">{{ t('usage.inbound') }}:</span>
              <span class="ml-1">{{ row.inbound_endpoint?.trim() || '-' }}</span>
            </div>
            <div v-if="showUpstreamEndpoint" class="break-all text-gray-700 dark:text-gray-300">
              <span class="font-medium text-gray-500 dark:text-gray-400">{{ t('usage.upstream') }}:</span>
              <span class="ml-1">{{ row.upstream_endpoint?.trim() || '-' }}</span>
            </div>
          </div>
        </template>

        <template #cell-group="{ row }">
          <UiBadge v-if="row.group" tone="neutral">
            {{ row.group.name }}
          </UiBadge>
          <span v-else class="text-sm text-gray-400 dark:text-gray-500">-</span>
        </template>

        <template #cell-stream="{ row }">
          <UiBadge :tone="getRequestTypeTone(row)">
            {{ getRequestTypeLabel(row) }}
          </UiBadge>
        </template>

        <template #cell-billing_mode="{ row }">
          <UiBadge :tone="getBillingModeTone(getDisplayBillingMode(row))">
            {{ getBillingModeLabel(getDisplayBillingMode(row), t) }}
          </UiBadge>
        </template>

        <template #cell-billing_source="{ row }">
          <div class="min-w-[112px] space-y-0.5 text-xs">
            <UiBadge :tone="getBillingSourceTone(row.billing_source)">
              {{ getBillingSourceLabel(row.billing_source) }}
            </UiBadge>
            <div
              v-if="getBillingSubscriptionLabel(row)"
              class="max-w-[180px] truncate font-medium text-violet-700 dark:text-violet-300"
              :title="getBillingSubscriptionLabel(row)"
            >
              {{ getBillingSubscriptionLabel(row) }}
            </div>
            <div v-if="row.billing_preference" class="text-gray-500 dark:text-gray-400">
              {{ getBillingPreferenceLabel(row.billing_preference) }}
            </div>
            <div
              v-if="row.billing_fallback_reason"
              class="max-w-[180px] truncate text-orange-600 dark:text-orange-400"
              :title="getBillingFallbackReasonLabel(row.billing_fallback_reason)"
            >
              {{ getBillingFallbackReasonLabel(row.billing_fallback_reason) }}
            </div>
          </div>
        </template>

        <template #cell-tokens="{ row }">
          <!-- 图片生成请求（仅按次计费时显示图片格式） -->
          <div v-if="isImageUsage(row)" class="flex items-center gap-1.5">
            <Icon name="cube" size="sm" />
            <span class="font-medium text-gray-900 dark:text-white">{{ row.image_count }}{{ t('usage.imageUnit') }}</span>
            <span class="text-gray-400">({{ formatImageBillingSize(row, t) }})</span>
          </div>
          <!-- Token 请求 -->
          <div v-else class="flex items-center gap-1.5">
            <div class="space-y-1 text-sm">
              <div class="flex items-center gap-2">
                <div class="inline-flex items-center gap-1">
                  <Icon name="arrowDown" size="sm" class="h-3.5 w-3.5 text-emerald-500" />
                  <span class="font-medium text-gray-900 dark:text-white">{{ row.input_tokens?.toLocaleString() || 0 }}</span>
                </div>
                <div class="inline-flex items-center gap-1">
                  <Icon name="arrowUp" size="sm" class="h-3.5 w-3.5 text-violet-500" />
                  <span class="font-medium text-gray-900 dark:text-white">{{ row.output_tokens?.toLocaleString() || 0 }}</span>
                </div>
              </div>
              <div v-if="row.cache_read_tokens > 0 || row.cache_creation_tokens > 0" class="flex items-center gap-2">
                <div v-if="row.cache_read_tokens > 0" class="inline-flex items-center gap-1">
                  <Icon name="database" size="sm" />
                  <span class="font-medium text-sky-600 dark:text-sky-400">{{ formatCacheTokens(row.cache_read_tokens) }}</span>
                </div>
                <div v-if="row.cache_creation_tokens > 0" class="inline-flex items-center gap-1">
                  <Icon name="edit" size="sm" />
                  <span class="font-medium text-amber-600 dark:text-amber-400">{{ formatCacheTokens(row.cache_creation_tokens) }}</span>
                  <UiBadge v-if="row.cache_creation_1h_tokens > 0" tone="warning">1h</UiBadge>
                  <UiBadge v-if="row.cache_ttl_overridden" tone="danger" :title="t('usage.cacheTtlOverriddenHint')">R</UiBadge>
                </div>
              </div>
              <div v-if="hasImageInputTokens(row)" class="flex items-center gap-2">
                <div class="inline-flex items-center gap-1">
                  <Icon name="arrowDown" size="sm" />
                  <span class="font-medium text-fuchsia-600 dark:text-fuchsia-400">{{ row.image_input_tokens.toLocaleString() }}</span>
                </div>
              </div>
              <div v-if="hasImageOutputTokens(row)" class="flex items-center gap-2">
                <div class="inline-flex items-center gap-1">
                  <Icon name="arrowUp" size="sm" />
                  <span class="font-medium text-pink-600 dark:text-pink-400">{{ row.image_output_tokens.toLocaleString() }}</span>
                </div>
              </div>
            </div>
            <UsageTokenDetails :row="row" />
          </div>
        </template>

        <template #cell-cost="{ row }">
          <div class="text-sm">
            <div class="flex items-center gap-1.5">
              <span class="font-medium text-green-600 dark:text-green-400">${{ row.actual_cost?.toFixed(6) || '0.000000' }}</span>
              <UiBadge
                v-if="row.long_context_billing_applied"
                data-testid="long-context-billing-marker"
                tone="warning"
              >x2</UiBadge>
              <UsageCostDetails :row="row" :show-account-billing="showAccountBilling" />
            </div>
            <div v-if="showAccountBilling && row.account_rate_multiplier != null" class="mt-0.5 text-[11px] text-orange-500 dark:text-orange-400">
              A ${{ accountBilled(row).toFixed(6) }}
            </div>
            <div
              v-if="embedLatencyInCost"
              class="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] leading-4"
            >
              <template v-if="row.first_token_ms != null">
                <span class="text-gray-400 dark:text-gray-500">{{ t('usage.latencyFirstToken') }}</span>
                <span class="usage-latency__value" :data-tone="latencyTone(firstTokenSeverity(row.first_token_ms))">
                  {{ formatDuration(row.first_token_ms) }}
                </span>
                <span class="text-gray-300 dark:text-dark-600">·</span>
              </template>
              <span class="text-gray-400 dark:text-gray-500">{{ t('usage.latencyDuration') }}</span>
              <span class="usage-latency__value" :data-tone="latencyTone(durationSeverity(row.duration_ms ?? 0))">
                {{ formatDuration(row.duration_ms) }}
              </span>
            </div>
          </div>
        </template>

        <!-- 合并首字/总耗时的健康度列：左侧色条上端随首字档、下端随总耗时档，中段(40%-60%)短渐变过渡，便于纵向扫视整体健康状况 -->
        <template #cell-latency="{ row }">
          <div class="usage-latency">
            <span class="usage-latency__bar" aria-hidden="true">
              <i
                v-if="row.first_token_ms != null"
                :data-tone="latencyTone(firstTokenSeverity(row.first_token_ms))"
              />
              <i :data-tone="latencyTone(durationSeverity(row.duration_ms ?? 0))" />
            </span>
            <div class="grid grid-cols-[max-content_max-content] items-baseline gap-x-2 gap-y-0.5 text-xs">
              <span class="text-gray-400 dark:text-gray-500">{{ t('usage.latencyFirstToken') }}</span>
              <span v-if="row.first_token_ms != null" class="usage-latency__value" :data-tone="latencyTone(firstTokenSeverity(row.first_token_ms))">{{ formatDuration(row.first_token_ms) }}</span>
              <span v-else class="text-gray-400 dark:text-gray-500">-</span>
              <span class="text-gray-400 dark:text-gray-500">{{ t('usage.latencyDuration') }}</span>
              <span class="usage-latency__value" :data-tone="latencyTone(durationSeverity(row.duration_ms ?? 0))">{{ formatDuration(row.duration_ms) }}</span>
            </div>
          </div>
        </template>

        <template #cell-created_at="{ value }">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ formatDateTime(value) }}</span>
        </template>

        <template #cell-request_id="{ row }">
          <div v-if="row.request_id" class="flex max-w-[160px] items-center gap-1.5">
            <span class="truncate font-mono text-xs text-gray-500 dark:text-gray-400" :title="row.request_id">
              {{ row.request_id }}
            </span>
            <UiIconButton
              density="mini"
              :variant="copiedRequestId === row.request_id ? 'success' : 'ghost'"
              :icon="copiedRequestId === row.request_id ? 'check' : 'copy'"
              :label="copiedRequestId === row.request_id ? t('keys.copied') : t('keys.copyToClipboard')"
              @click="copyRequestId(row.request_id)"
            />
          </div>
          <span v-else class="text-sm text-gray-400 dark:text-gray-500">-</span>
        </template>

        <template #cell-user_agent="{ row }">
          <span v-if="row.user_agent" class="text-sm text-gray-600 dark:text-gray-400 block max-w-[320px] truncate" :title="row.user_agent">{{ formatUserAgent(row.user_agent) }}</span>
          <span v-else class="text-sm text-gray-400 dark:text-gray-500">-</span>
        </template>

        <template #cell-ip_address="{ row }">
          <div v-if="row.ip_address">
            <span class="text-sm font-mono text-gray-600 dark:text-gray-400">{{ row.ip_address }}</span>
            <IpGeoCell :ip="row.ip_address" />
          </div>
          <span v-else class="text-sm text-gray-400 dark:text-gray-500">-</span>
        </template>

        <template #empty><UiEmptyState :title="t('usage.noRecords')" /></template>
      </UiDataTable>
    </UiMobileTableScroller>
  </section>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { formatDateTime, formatReasoningEffort } from '@/utils/format'
import { formatCacheTokens } from '@/utils/formatters'
import { resolveUsageRequestType } from '@/utils/usageRequestType'
import { durationSeverity, firstTokenSeverity, type LatencySeverity } from '@/utils/latencyHealth'
import {
  getBillingModeLabel,
  isImageUsage,
  getDisplayBillingMode,
} from '@/utils/billingMode'
import {
  formatImageBillingSize,
  hasImageOutputTokens,
  hasImageInputTokens,
} from '@/utils/imageUsage'

/** Compute the account-billed cost for display: (account_stats_cost ?? total_cost) * rate_multiplier */
function accountBilled(row: { total_cost?: number | null; account_stats_cost?: number | null; account_rate_multiplier?: number | null }): number {
  const base = row.account_stats_cost != null ? row.account_stats_cost : (row.total_cost ?? 0)
  const result = base * (row.account_rate_multiplier ?? 1)
  return Number.isNaN(result) ? 0 : result
}


import IpGeoCell from '@/components/common/IpGeoCell.vue'
import Icon from '@/components/icons/Icon.vue'
import { UiBadge, UiButton, UiDataTable, UiEmptyState, UiIconButton, UiMobileTableScroller } from '@/components/ui'
import UsageCostDetails from './UsageCostDetails.vue'
import UsageTokenDetails from './UsageTokenDetails.vue'
import { fetchBatch, getEntry } from '@/utils/ipGeoLookup'
import type { AdminUsageLog } from '@/types'
import type { Column } from '@/components/ui'

interface Props {
  data: AdminUsageLog[]
  loading?: boolean
  columns: Column[]
  serverSideSort?: boolean
  defaultSortKey?: string
  defaultSortOrder?: 'asc' | 'desc'
  showAccountBilling?: boolean
  showUpstreamEndpoint?: boolean
  embedLatencyInCost?: boolean
  /** 嵌入统一卡片内使用：去掉自身卡片外观 */
  flat?: boolean
  /** 在窄屏继续使用表格，并通过横向滚动查看完整列。 */
  mobileTable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  serverSideSort: false,
  defaultSortKey: '',
  defaultSortOrder: 'asc',
  showAccountBilling: true,
  showUpstreamEndpoint: true,
  embedLatencyInCost: false,
  flat: false,
  mobileTable: false
})
const emit = defineEmits<{
  userClick: [userID: number, email?: string]
  sort: [key: string, order: 'asc' | 'desc']
  ipGeoBatchFailed: []
}>()
const { t } = useI18n()
const appStore = useAppStore()
const copiedRequestId = ref<string | null>(null)
const showAccountBilling = props.showAccountBilling
const showUpstreamEndpoint = props.showUpstreamEndpoint
const embedLatencyInCost = props.embedLatencyInCost
const ipGeoBatchLoading = ref(false)

const showIpGeoToolbar = computed(() => props.columns.some((col) => col.key === 'ip_address'))

const sentUpstreamModel = (row: AdminUsageLog): string => row.upstream_model?.trim() || row.model?.trim() || ''

const normalizeModelVariant = (model: string): string => model
  .trim()
  .toLowerCase()
  .replace(/-latest$/, '')
  .replace(/-\d{4}-\d{2}-\d{2}$/, '')
  .replace(/-\d{8}$/, '')

const isLikelyModelVariant = (row: AdminUsageLog): boolean => {
  const sent = sentUpstreamModel(row)
  const response = row.upstream_response_model?.trim() || ''
  return sent !== '' && response !== '' && normalizeModelVariant(sent) === normalizeModelVariant(response)
}

const modelAuditTitle = (row: AdminUsageLog): string => [
  `${t('usage.requestedModel')}: ${row.model || '-'}`,
  `${t('usage.sentUpstreamModel')}: ${sentUpstreamModel(row) || '-'}`,
  `${t('usage.upstreamResponseModel')}: ${row.upstream_response_model || '-'}`,
].join('\n')

const currentPageIps = computed(() =>
  Array.from(new Set(props.data.map((row) => row.ip_address).filter((ip): ip is string => Boolean(ip))))
)

const pendingIpCount = computed(() => {
  if (!showIpGeoToolbar.value) return 0
  return currentPageIps.value.filter((ip) => {
    const status = getEntry(ip).status
    return status === 'idle' || status === 'error'
  }).length
})

const handleBatchFetchIpGeo = async () => {
  ipGeoBatchLoading.value = true
  try {
    const ok = await fetchBatch(currentPageIps.value)
    if (!ok) emit('ipGeoBatchFailed')
  } finally {
    ipGeoBatchLoading.value = false
  }
}

const copyRequestId = async (requestId: string) => {
  try {
    await navigator.clipboard.writeText(requestId)
    copiedRequestId.value = requestId
    appStore.showSuccess(t('admin.usage.requestIdCopied'))
    window.setTimeout(() => {
      if (copiedRequestId.value === requestId) copiedRequestId.value = null
    }, 2000)
  } catch {
    appStore.showError(t('common.copyFailed'))
  }
}

const getRequestTypeLabel = (row: AdminUsageLog): string => {
  const requestType = resolveUsageRequestType(row)
  if (requestType === 'cyber') return t('usage.cyber')
  if (requestType === 'live') return t('usage.live')
  if (requestType === 'ws_v2') return t('usage.ws')
  if (requestType === 'stream') return t('usage.stream')
  if (requestType === 'sync') return t('usage.sync')
  return t('usage.unknown')
}

const getRequestTypeTone = (row: AdminUsageLog): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  const requestType = resolveUsageRequestType(row)
  if (requestType === 'cyber') return 'danger'
  if (requestType === 'live') return 'success'
  if (requestType === 'ws_v2' || requestType === 'stream') return 'info'
  if (requestType === 'sync') return 'neutral'
  return 'warning'
}

const getBillingModeTone = (mode?: string | null): 'neutral' | 'warning' | 'info' => {
  if (mode === 'video') return 'warning'
  if (mode === 'token') return 'neutral'
  return 'info'
}

const getBillingSourceLabel = (source?: string | null): string => {
  if (source === 'subscription') return t('usage.billingSourceSubscription')
  if (source === 'wallet') return t('usage.billingSourceWallet')
  return t('usage.billingSourceLegacy')
}

const getBillingSourceTone = (source?: string | null): 'neutral' | 'success' | 'info' => {
  if (source === 'subscription') return 'info'
  if (source === 'wallet') return 'success'
  return 'neutral'
}

const getBillingSubscriptionLabel = (row: AdminUsageLog): string => {
  if (row.billing_source !== 'subscription') return ''
  const planName = row.subscription?.plan_name?.trim()
  if (planName) return planName
  if (row.subscription?.plan_id) return `#${row.subscription.plan_id}`
  return row.subscription_id ? `#${row.subscription_id}` : ''
}

const getBillingPreferenceLabel = (preference?: string | null): string => {
  if (preference === 'wallet_first') return t('usage.billingPreferenceWalletFirst')
  if (preference === 'subscription_only') return t('usage.billingPreferenceSubscriptionOnly')
  if (preference === 'wallet_only') return t('usage.billingPreferenceWalletOnly')
  return t('usage.billingPreferenceSubscriptionFirst')
}

const getBillingFallbackReasonLabel = (reason?: string | null): string => {
  if (reason === 'wallet_insufficient') return t('usage.billingFallbackWalletInsufficient')
  if (reason === 'wallet_insufficient_subscription_unavailable') return t('usage.billingFallbackBothUnavailable')
  if (reason === 'subscription_quota_exhausted') return t('usage.billingFallbackSubscriptionExhausted')
  if (reason === 'subscription_unavailable') return t('usage.billingFallbackSubscriptionUnavailable')
  return reason || ''
}



const formatUserAgent = (ua: string): string => {
  return ua
}

const latencyTone = (severity: LatencySeverity): 'success' | 'warning' | 'danger' => {
  if (severity === 'good') return 'success'
  if (severity === 'critical') return 'danger'
  return 'warning'
}

// 超过 1 分钟简化为 "Xm Ys"，免去人工换算（超过 1 小时再进位为 "Xh Ym"）
const formatDuration = (ms: number | null | undefined): string => {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 3600) return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`
  return `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`
}

</script>

<style scoped>
.usage-table {
  min-width: 0;
}

/* Keep one horizontal scroll owner (the data-table's table-wrapper).  The
 * outer accessibility scroller must not force a second 760px viewport on
 * narrow phones, otherwise sticky columns move with the outer container. */
.usage-table__scroller :deep(> div) {
  width: 100%;
  min-width: 0 !important;
}

.usage-table--framed {
  overflow: hidden;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
}

.usage-table__toolbar {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.usage-table__pending {
  color: var(--ui-text-soft);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.usage-model-cell { display: grid; min-width: 180px; gap: 3px; font-size: 12px; }
.usage-model-line { display: flex; min-width: 0; align-items: center; gap: 5px; line-height: 18px; }
.usage-model-role { flex: none; border-radius: 999px; padding: 1px 5px; font-size: 10px; font-weight: 600; line-height: 15px; }
.usage-model-line--primary .usage-model-role { color: var(--ui-text-muted); background: var(--ui-surface-muted); }
.usage-model-line--upstream .usage-model-role { color: var(--ui-info); background: color-mix(in srgb, var(--ui-info) 12%, transparent); }
.usage-model-arrow { flex: none; color: var(--ui-info); font-weight: 600; }
.usage-model-name { min-width: 0; overflow-wrap: anywhere; color: var(--ui-text); font-family: var(--ui-font-mono); font-size: 11px; }
.usage-model-line--upstream .usage-model-name { color: var(--ui-info); }

.usage-latency {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.usage-latency__bar {
  display: grid;
  width: 3px;
  flex: none;
  overflow: hidden;
  border-radius: 2px;
}

.usage-latency__bar i {
  min-height: 50%;
  background: var(--ui-text-soft);
}

.usage-latency__bar i[data-tone='success'] { background: var(--ui-success); }
.usage-latency__bar i[data-tone='warning'] { background: var(--ui-warning); }
.usage-latency__bar i[data-tone='danger'] { background: var(--ui-danger); }

.usage-latency__value {
  color: var(--ui-text-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.usage-latency__value[data-tone='success'] { color: var(--ui-success); }
.usage-latency__value[data-tone='warning'] { color: var(--ui-warning); }
.usage-latency__value[data-tone='danger'] { color: var(--ui-danger); }
</style>
