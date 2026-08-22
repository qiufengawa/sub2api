<template>
  <AppLayout>
    <AppPage width="full" density="compact" class="monitor-page">
      <AppPageHeader
        :title="t('channelMonitorV2.title')"
        :description="
          refreshing
            ? t('channelMonitorV2.updating')
            : loadError && !snapshot
              ? t('channelMonitorV2.loadFailed')
            : snapshot?.coverage.data_through
              ? t('channelMonitorV2.updatedTo', { time: formatTime(snapshot.coverage.data_through) })
              : t('common.loading')
        "
      >
        <template #status>
          <UiStatusBadge
            :status="loadError ? (snapshot ? 'stale' : 'error') : loading || refreshing ? 'pending' : 'online'"
            :label="loadError ? (snapshot ? t('channelMonitorV2.staleData') : t('channelMonitorV2.loadFailed')) : loading || refreshing ? t('channelMonitorV2.updating') : t('channelMonitorV2.title')"
          />
          <UiBadge
            v-if="snapshot && !snapshot.coverage.coverage_complete && !bootstrapActive"
            tone="warning"
          >
            {{ t('channelMonitorV2.partialCoverage') }}
          </UiBadge>
        </template>
        <template #actions>
          <UiIconButton
            icon="refresh"
            :label="t('common.refresh')"
            :disabled="loading"
            @click="reload(false)"
          />
        </template>
      </AppPageHeader>

      <UiErrorState
        v-if="loadError && !snapshot"
        :title="t('channelMonitorV2.loadFailed')"
        :retry-text="t('common.retry')"
        @retry="reload(false)"
      />

      <UiBanner
        v-else-if="loadError"
        tone="danger"
        :title="t('channelMonitorV2.loadFailed')"
        :message="t('channelMonitorV2.refreshFailed')"
      />

      <UiBanner
        v-if="bootstrapActive"
        tone="info"
        :title="t('channelMonitorV2.bootstrap.title')"
      >
        <div class="monitor-bootstrap">
          <span>{{ t('channelMonitorV2.bootstrap.description') }}</span>
          <UiProgressBar
            :value="bootstrapPercent"
            :label="t('channelMonitorV2.bootstrap.working')"
            :aria-label="t('channelMonitorV2.bootstrap.working')"
          />
        </div>
      </UiBanner>

      <AppToolbar v-if="!loadError || snapshot" sticky>
        <UiSegmentedControl
          :model-value="filter.range"
          :options="ranges"
          :label="t('channelMonitorV2.timeRange')"
          @update:model-value="setRange($event as MonitorRange)"
        />
        <template #actions>
          <div class="monitor-toolbar-modes">
            <UiSegmentedControl
              v-model="trendView"
              :options="trendViewOptions"
              :label="t('channelMonitorV2.trendView.label')"
            />
            <UiSegmentedControl
              v-if="trendView === 'pulse'"
              v-model="healthMode"
              :options="healthModeOptions"
              :label="t('channelMonitorV2.healthMode.label')"
            />
          </div>
        </template>
      </AppToolbar>

      <UiFilterBar
        v-if="!loadError || snapshot"
        :active-count="filter.platforms.length + filter.groupIds.length + filter.models.length"
        :clear-label="t('channelMonitorV2.clearFilters')"
        @clear="clearDimensions"
      >
        <UiMultiCombobox
          v-model="filter.platforms"
          class="monitor-filter"
          :options="platformOptions"
          :aria-label="t('channelMonitorV2.filters.platform')"
          :placeholder="t('channelMonitorV2.filters.allPlatforms')"
          :search-placeholder="t('channelMonitorV2.filters.platform')"
        />
        <UiMultiCombobox
          v-model="selectedGroupIds"
          class="monitor-filter"
          :options="groupOptions"
          :aria-label="t('channelMonitorV2.filters.group')"
          :placeholder="t('channelMonitorV2.filters.allGroups')"
          :search-placeholder="t('channelMonitorV2.filters.group')"
        />
        <UiMultiCombobox
          v-model="filter.models"
          class="monitor-filter"
          :options="modelOptions"
          :aria-label="t('channelMonitorV2.filters.model')"
          :placeholder="t('channelMonitorV2.filters.allModels')"
          :search-placeholder="t('channelMonitorV2.filters.model')"
        />
        <UiSelect
          v-model="matrixGroupBy"
          class="monitor-group-select"
          :options="matrixGroupOptions"
          :aria-label="t('channelMonitorV2.groupBy.label')"
          :placeholder="t('channelMonitorV2.groupBy.label')"
          density="compact"
        />
      </UiFilterBar>

      <AppSection v-if="!loadError || snapshot">
        <AppGrid
          v-if="snapshot"
          :min="showThroughput ? '180px' : '210px'"
          :gap="10"
          :aria-label="t('channelMonitorV2.summaryAria')"
        >
          <UiStatMetric
            :label="t('channelMonitorV2.metrics.successRate')"
            :value="formatPercent(1 - snapshot.metrics.error_rate)"
            :context="t('channelMonitorV2.metrics.errorRateValue', { value: formatPercent(snapshot.metrics.error_rate) })"
          >
            <template #status>
              <UiBadge :tone="healthTone(snapshot.health.error_rate)" dot :aria-label="snapshot.health.error_rate" />
            </template>
          </UiStatMetric>
          <UiStatMetric
            :label="t('channelMonitorV2.metrics.ttftP50')"
            :value="formatMs(snapshot.metrics.ttft.p50_ms)"
            :context="latencyKpiSecondary(snapshot.metrics.ttft)"
            :title="latencyDetail(snapshot.metrics.ttft)"
          >
            <template #status>
              <UiBadge :tone="healthTone(snapshot.health.ttft)" dot :aria-label="snapshot.health.ttft" />
            </template>
          </UiStatMetric>
          <UiStatMetric
            v-if="showThroughput"
            :label="t('channelMonitorV2.metrics.tps')"
            :value="formatTps(snapshot.metrics.tpm)"
            :context="t('channelMonitorV2.metrics.tpsDetail')"
            :title="exactTps(snapshot.metrics.tpm)"
          />
          <UiStatMetric
            :label="t('channelMonitorV2.metrics.cacheRate')"
            :value="formatPercent(snapshot.metrics.cache_rate)"
            :context="t('channelMonitorV2.metrics.cacheDetail')"
          >
            <template #status>
              <UiBadge
                :tone="healthTone(snapshot.health.cache || snapshot.health.overall)"
                dot
                :aria-label="snapshot.health.cache || snapshot.health.overall"
              />
            </template>
          </UiStatMetric>
          <UiStatMetric
            v-if="showThroughput"
            :label="t('channelMonitorV2.metrics.rpm')"
            :value="formatRate(snapshot.metrics.rpm)"
            :context="t('channelMonitorV2.metrics.rpmDetail')"
            :title="exactRate(snapshot.metrics.rpm)"
          />
        </AppGrid>
        <AppGrid v-else-if="loading" :min="showThroughput ? '180px' : '210px'" :gap="10" aria-hidden="true">
          <UiSkeleton
            v-for="index in (showThroughput ? 5 : 4)"
            :key="index"
            variant="rect"
            width="100%"
            height="92px"
          />
        </AppGrid>
      </AppSection>

      <AppSection
        v-if="(!loadError || snapshot) && (trendView === 'line' || matrix || loading)"
        class="monitor-chart-section"
      >
        <MonitorTrendChart
          v-if="trendView === 'line'"
          :trend="snapshot?.trend || []"
          :coverage="snapshot?.coverage || null"
          :loading="loading && !snapshot"
        />
        <RelayPulseMatrix
          v-else-if="matrix"
          :rows="matrixRows"
          :coverage="matrix.coverage"
          :health-mode="healthMode"
          :show-throughput="showThroughput"
        />
        <UiSkeleton v-else-if="loading" variant="rect" width="100%" height="320px" />
      </AppSection>

      <AppSection v-if="!loadError || snapshot" class="monitor-records">
        <UiTabs
          v-model="activeTab"
          :tabs="tabs"
          :label="t('channelMonitorV2.tabs.aria')"
        />

        <div class="monitor-records__body">
          <div v-if="tabLoading" class="monitor-records__loading" aria-hidden="true">
            <UiSkeleton v-for="index in 5" :key="index" variant="text" width="100%" />
          </div>

          <UiEmptyState
            v-else-if="activeRowsEmpty"
            :title="
              bootstrapActive
                ? t('channelMonitorV2.bootstrap.title')
                : t('channelMonitorV2.empty.title')
            "
            :description="
              bootstrapActive
                ? t('channelMonitorV2.bootstrap.description')
                : t('channelMonitorV2.empty.description')
            "
          />

          <UiMobileTableScroller
            v-else-if="activeTab === 'models'"
            min-width="760px"
            :label="t('channelMonitorV2.tabs.models')"
          >
            <table class="monitor-table">
              <thead>
                <tr>
                  <th>{{ t('channelMonitorV2.table.platformModel') }}</th>
                  <th>{{ t('channelMonitorV2.metrics.successRate') }}</th>
                  <th>{{ t('channelMonitorV2.metrics.ttftP50') }}</th>
                  <th v-if="showThroughput">{{ t('channelMonitorV2.metrics.tps') }}</th>
                  <th>{{ t('channelMonitorV2.metrics.cacheRate') }}</th>
                  <th v-if="showThroughput">{{ t('channelMonitorV2.metrics.rpm') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in modelRows" :key="`${row.platform}:${row.model}`">
                  <td>
                    <UiButton variant="quiet" density="compact" @click="drillModel(row)">
                      <span class="monitor-model-identity">
                        <span :class="statusDot(row.health)" aria-hidden="true" />
                        <span>
                          <small>{{ row.platform }}</small>
                          <strong>
                            {{ row.model === '__other__' ? t('channelMonitorV2.otherModels') : row.model }}
                          </strong>
                        </span>
                      </span>
                    </UiButton>
                  </td>
                  <td>
                    <span>{{ formatPercent(1 - row.metrics.error_rate) }}</span>
                    <small>{{ t('channelMonitorV2.metrics.errorRateValue', { value: formatPercent(row.metrics.error_rate) }) }}</small>
                  </td>
                  <td>
                    <span>{{ formatMs(row.metrics.ttft.p50_ms) }}</span>
                    <small>{{ latencyDetail(row.metrics.ttft) }}</small>
                  </td>
                  <td v-if="showThroughput" :title="exactTps(row.metrics.tpm)">{{ formatTps(row.metrics.tpm) }}</td>
                  <td>{{ formatPercent(row.metrics.cache_rate) }}</td>
                  <td v-if="showThroughput">{{ formatRate(row.metrics.rpm) }}</td>
                </tr>
              </tbody>
            </table>
          </UiMobileTableScroller>

          <div v-else-if="activeTab === 'errors'" class="monitor-errors">
            <article
              v-for="row in errorRows"
              :key="row.category"
              class="monitor-error"
              :class="{ 'monitor-error--ignored': row.ignored }"
            >
              <button
                type="button"
                class="monitor-error__trigger ui-focus-ring"
                :aria-expanded="expandedErrors.has(row.category)"
                :aria-controls="expandedErrors.has(row.category) ? `monitor-error-details-${encodeURIComponent(row.category)}` : undefined"
                @click="toggleError(row.category)"
              >
                <span class="monitor-error__name">
                  <strong>{{ errorLabel(row.category) }}</strong>
                  <UiBadge v-if="row.ignored">{{ t('channelMonitorV2.ignored') }}</UiBadge>
                </span>
                <UiProgressBar
                  :value="row.rate * 100"
                  :show-value="false"
                  :tone="row.ignored ? 'neutral' : 'danger'"
                  :aria-label="errorLabel(row.category)"
                />
                <small>{{ formatPercent(row.rate) }}</small>
                <Icon
                  name="chevronDown"
                  size="sm"
                  :class="{ 'is-open': expandedErrors.has(row.category) }"
                />
              </button>
              <div
                v-if="expandedErrors.has(row.category)"
                :id="`monitor-error-details-${encodeURIComponent(row.category)}`"
                class="monitor-error__details"
              >
                <template v-if="isAdmin && (row.details || []).length">
                  <div
                    v-for="(detail, index) in row.details || []"
                    :key="`${row.category}:${index}:${detail.message}`"
                    class="monitor-error-detail"
                  >
                    <div>
                      <UiBadge>{{ detail.platform || '-' }}</UiBadge>
                      <strong>{{ detail.model || '-' }}</strong>
                      <span v-if="detail.status_code">
                        {{ t('channelMonitorV2.errorDetail.http', { code: detail.status_code }) }}
                      </span>
                      <span v-if="detail.upstream_status_code">
                        {{ t('channelMonitorV2.errorDetail.upstream', { code: detail.upstream_status_code }) }}
                      </span>
                      <span>×{{ detail.count }}</span>
                    </div>
                    <p>{{ detail.message || detail.error_type || t('channelMonitorV2.errorDetail.noMessage') }}</p>
                  </div>
                </template>
                <p v-else>{{ t('channelMonitorV2.errorDetail.empty') }}</p>
              </div>
            </article>
          </div>

          <UiMobileTableScroller
            v-else
            min-width="680px"
            :label="t('channelMonitorV2.tabs.users')"
          >
            <table class="monitor-table">
              <thead>
                <tr>
                  <th>{{ t('channelMonitorV2.table.rank') }}</th>
                  <th>{{ t('channelMonitorV2.table.user') }}</th>
                  <th>{{ t('channelMonitorV2.metrics.successRate') }}</th>
                  <th>{{ t('channelMonitorV2.metrics.ttftP50') }}</th>
                  <th v-if="showThroughput">{{ t('channelMonitorV2.metrics.tps') }}</th>
                  <th>{{ t('channelMonitorV2.metrics.cacheRate') }}</th>
                  <th v-if="showThroughput">{{ t('channelMonitorV2.metrics.rpm') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in userRows"
                  :key="row.user_id || row.display_label"
                  :class="{ 'monitor-table__current': row.is_self }"
                >
                  <td><MonitorRankBadge :rank="row.rank" /></td>
                  <td>
                    <strong>{{ row.display_label }}</strong>
                    <UiBadge v-if="row.is_self" tone="info">{{ t('channelMonitorV2.currentUser') }}</UiBadge>
                  </td>
                  <td>
                    <span>{{ formatPercent(1 - row.metrics.error_rate) }}</span>
                    <small>{{ t('channelMonitorV2.metrics.errorRateValue', { value: formatPercent(row.metrics.error_rate) }) }}</small>
                  </td>
                  <td>
                    <span>{{ formatMs(row.metrics.ttft.p50_ms) }}</span>
                    <small>{{ latencyDetail(row.metrics.ttft) }}</small>
                  </td>
                  <td v-if="showThroughput" :title="exactTps(row.metrics.tpm)">{{ formatTps(row.metrics.tpm) }}</td>
                  <td>{{ formatPercent(row.metrics.cache_rate) }}</td>
                  <td v-if="showThroughput">{{ formatRate(row.metrics.rpm) }}</td>
                </tr>
              </tbody>
            </table>
          </UiMobileTableScroller>
        </div>
      </AppSection>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  AppPage,
  AppPageHeader,
  AppSection,
  AppToolbar,
  UiBadge,
  UiBanner,
  UiButton,
  UiEmptyState,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiMobileTableScroller,
  UiMultiCombobox,
  UiProgressBar,
  UiSegmentedControl,
  UiSelect,
  UiSkeleton,
  UiStatMetric,
  UiStatusBadge,
  UiTabs
} from '@/components/ui'
import MonitorRankBadge from '@/features/channel-monitor-v2/MonitorRankBadge.vue'
import MonitorTrendChart from '@/features/channel-monitor-v2/MonitorTrendChart.vue'
import RelayPulseMatrix from '@/features/channel-monitor-v2/RelayPulseMatrix.vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { isChannelMonitorThroughputHidden } from '@/utils/featureFlags'
import * as api from '@/api/channelMonitorV2'
import type {
  HealthState,
  MonitorDimensions,
  MonitorErrorRow,
  MonitorFilter,
  MonitorHealth,
  MonitorMatrixGroupBy,
  MonitorMatrixResponse,
  MonitorModelRow,
  MonitorRange,
  MonitorSnapshot,
  MonitorUserRow,
} from '@/api/channelMonitorV2'
import {
  formatLatencyKpiSecondary,
  formatLatencyPrivacy,
  formatMonitorMs,
  formatMonitorPercent,
  formatMonitorThroughput,
  formatMonitorTokensPerSecond,
  tokensPerSecondFromTpm,
  healthScoreClass,
  monitorErrorCategoryLabel,
} from '@/features/channel-monitor-v2/monitorFormat'

type Tab = 'models' | 'errors' | 'users'
type HealthMode = 'overall' | 'success' | 'ttft' | 'cache'
type TrendView = 'pulse' | 'line'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()
const { t, te, locale } = useI18n()
const isAdmin = computed(() => authStore.isAdmin)
/** Admins always see RPM/TPM; users honor the hide-throughput system setting. */
const showThroughput = computed(() => isAdmin.value || !isChannelMonitorThroughputHidden())

const ranges = computed(() => [
  { value: '90m' as MonitorRange, label: t('channelMonitorV2.ranges.90m') },
  { value: '24h' as MonitorRange, label: t('channelMonitorV2.ranges.24h') },
  { value: '7d' as MonitorRange, label: t('channelMonitorV2.ranges.7d') },
  { value: '30d' as MonitorRange, label: t('channelMonitorV2.ranges.30d') },
])
const tabs = computed(() => [
  { value: 'models' as Tab, label: t('channelMonitorV2.tabs.models') },
  { value: 'errors' as Tab, label: t('channelMonitorV2.tabs.errors') },
  { value: 'users' as Tab, label: t('channelMonitorV2.tabs.users') },
])
const matrixGroupOptions = computed(() => [
  { value: 'platform' as MonitorMatrixGroupBy, label: t('channelMonitorV2.groupBy.platform') },
  { value: 'platform_group' as MonitorMatrixGroupBy, label: t('channelMonitorV2.groupBy.platformGroup') },
  { value: 'platform_model' as MonitorMatrixGroupBy, label: t('channelMonitorV2.groupBy.platformModel') },
  { value: 'platform_group_model' as MonitorMatrixGroupBy, label: t('channelMonitorV2.groupBy.platformGroupModel') },
])
const healthModeOptions = computed(() => [
  { value: 'overall' as HealthMode, label: t('channelMonitorV2.healthMode.overall') },
  { value: 'success' as HealthMode, label: t('channelMonitorV2.healthMode.success') },
  { value: 'ttft' as HealthMode, label: t('channelMonitorV2.healthMode.ttft') },
  { value: 'cache' as HealthMode, label: t('channelMonitorV2.healthMode.cache') },
])
const trendViewOptions = computed(() => [
  { value: 'pulse' as TrendView, label: t('channelMonitorV2.trendView.pulse') },
  { value: 'line' as TrendView, label: t('channelMonitorV2.trendView.line') }
])

const filter = ref<MonitorFilter>({
  range: parseRange(route.query.range),
  platforms: csv(route.query.platform),
  groupIds: csv(route.query.group).map(Number).filter(Boolean),
  models: csv(route.query.model),
})
const activeTab = ref<Tab>(
  (['models', 'errors', 'users'].includes(String(route.query.tab)) ? route.query.tab : 'models') as Tab
)
const matrixGroupBy = ref<MonitorMatrixGroupBy>(parseMatrixGroupBy(route.query.group_by))
const healthMode = ref<HealthMode>(parseHealthMode(route.query.health_mode))
const trendView = ref<TrendView>(parseTrendView(route.query.trend_view))
const dimensions = ref<MonitorDimensions>({ platforms: [], groups: [], models: [] })
const snapshot = ref<MonitorSnapshot | null>(null)
const matrix = ref<MonitorMatrixResponse | null>(null)
const modelRows = ref<MonitorModelRow[]>([])
const errorRows = ref<MonitorErrorRow[]>([])
const userRows = ref<MonitorUserRow[]>([])
const loading = ref(false)
const tabLoading = ref(false)
const refreshing = ref(false)
const loadError = ref(false)
const expandedErrors = ref(new Set<string>())
let controller: AbortController | null = null
let sequence = 0
let tabSequence = 0
let autoRefreshTimer: number | null = null
// Full platform catalog (never pruned). Groups/models cascade by selected platforms
// so choosing a platform narrows the other pickers without collapsing platforms.
const platformOptions = computed(() =>
  (dimensions.value.platforms || []).map((item) => ({
    value: item.value,
    label: item.label,
  }))
)
const selectedPlatforms = computed(() => new Set(filter.value.platforms))
const groupOptions = computed(() =>
  (dimensions.value.groups || [])
    .filter(
      (item) =>
        selectedPlatforms.value.size === 0 ||
        !item.platform ||
        selectedPlatforms.value.has(item.platform),
    )
    .map((item) => ({
      value: String(item.id),
      label: item.platform ? `${item.platform} / ${item.name || `#${item.id}`}` : item.name || `#${item.id}`,
    }))
)
const modelOptions = computed(() =>
  (dimensions.value.models || [])
    .filter(
      (item) =>
        selectedPlatforms.value.size === 0 ||
        !item.platform ||
        selectedPlatforms.value.has(item.platform),
    )
    .map((item) => ({
      value: item.value,
      label:
        item.platform && !item.label.includes(item.platform)
          ? `${item.platform} / ${item.label}`
          : item.label,
    }))
)
const selectedGroupIds = computed({
  get: () => filter.value.groupIds.map(String),
  set: (value: string[]) => {
    filter.value.groupIds = value.map(Number).filter((id) => Number.isInteger(id) && id > 0)
  },
})
// Soft-prune group/model selections that fall outside the platform cascade.
// Do NOT wipe when options are temporarily empty (loading); only drop invalid ids.
watch(
  [groupOptions, modelOptions],
  () => {
    if (groupOptions.value.length > 0) {
      const allowed = new Set(groupOptions.value.map((item) => item.value))
      const next = filter.value.groupIds.filter((id) => allowed.has(String(id)))
      if (next.length !== filter.value.groupIds.length) {
        filter.value.groupIds = next
      }
    }
    if (modelOptions.value.length > 0) {
      const allowed = new Set(modelOptions.value.map((item) => item.value))
      const next = filter.value.models.filter((model) => allowed.has(model))
      if (next.length !== filter.value.models.length) {
        filter.value.models = next
      }
    }
  },
  { flush: 'post' },
)
const activeRowsEmpty = computed(() =>
  activeTab.value === 'models'
    ? modelRows.value.length === 0
    : activeTab.value === 'errors'
      ? errorRows.value.length === 0
      : userRows.value.length === 0
)
/** First-upgrade backfill toward 90m/24h/7d/30d; banner hides when backend omits bootstrap. */
const bootstrapActive = computed(() => Boolean(snapshot.value?.coverage?.bootstrap?.active))
const bootstrapPercent = computed(() => {
  const raw = snapshot.value?.coverage?.bootstrap?.progress_percent
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0
  return Math.min(100, Math.max(0, Math.round(raw)))
})
const matrixRows = computed(() => {
  const items = matrix.value?.items || []
  // platform_group views should only show real groups, never bare platform placeholders.
  if (matrixGroupBy.value === 'platform_group' || matrixGroupBy.value === 'platform_group_model') {
    return items.filter((row) => row.group_id != null && Number(row.group_id) > 0)
  }
  return items
})

function csv(value: unknown) {
  return typeof value === 'string' ? value.split(',').filter(Boolean) : []
}
function parseRange(value: unknown): MonitorRange {
  return ['90m', '24h', '7d', '30d'].includes(String(value)) ? (value as MonitorRange) : '90m'
}
function parseMatrixGroupBy(value: unknown): MonitorMatrixGroupBy {
  const allowed: MonitorMatrixGroupBy[] = [
    'platform',
    'platform_group',
    'platform_model',
    'platform_group_model',
  ]
  return allowed.includes(value as MonitorMatrixGroupBy)
    ? (value as MonitorMatrixGroupBy)
    : 'platform_group'
}
function parseHealthMode(value: unknown): HealthMode {
  const allowed: HealthMode[] = ['overall', 'success', 'ttft', 'cache']
  return allowed.includes(value as HealthMode) ? (value as HealthMode) : 'overall'
}
function parseTrendView(value: unknown): TrendView {
  return value === 'line' ? 'line' : 'pulse'
}
function syncQuery() {
  void router.replace({
    query: {
      range: filter.value.range,
      platform: filter.value.platforms.join(',') || undefined,
      group: filter.value.groupIds.join(',') || undefined,
      model: filter.value.models.join(',') || undefined,
      group_by: matrixGroupBy.value,
      health_mode: healthMode.value,
      trend_view: trendView.value === 'line' ? 'line' : undefined,
      tab: activeTab.value,
    },
  })
}
/** Dimensions catalog: range only — never re-filtered by platform/group/model selection. */
async function loadDimensions(signal?: AbortSignal, id = sequence) {
  const rangeOnly: MonitorFilter = {
    range: filter.value.range,
    platforms: [],
    groupIds: [],
    models: [],
  }
  const next = await api.getDimensions(rangeOnly, isAdmin.value, signal)
  if (id !== sequence) return
  dimensions.value = next
}

async function loadMetrics(signal?: AbortSignal, id = sequence) {
  const [nextSnapshot, nextMatrix] = await Promise.all([
    api.getSnapshot(filter.value, isAdmin.value, signal),
    api.getMatrix(filter.value, matrixGroupBy.value, isAdmin.value, signal),
  ])
  if (id !== sequence) return
  snapshot.value = nextSnapshot
  matrix.value = nextMatrix
  scheduleAutoRefresh()
  await loadTab(signal, id)
}

function isAbortError(error: unknown): boolean {
  const candidate = error as { name?: string; code?: string }
  return candidate?.name === 'AbortError' || candidate?.name === 'CanceledError' || candidate?.code === 'ERR_CANCELED'
}

async function reload(silent = true) {
  controller?.abort()
  const request = new AbortController()
  controller = request
  const id = ++sequence
  refreshing.value = true
  loadError.value = false
  if (!silent) loading.value = true
  try {
    // Catalog + metrics in parallel; catalog ignores dimension filters so options never shrink.
    await Promise.all([
      loadDimensions(request.signal, id),
      loadMetrics(request.signal, id),
    ])
  } catch (error) {
    if (id !== sequence || request.signal.aborted || isAbortError(error)) return
    loadError.value = true
    appStore.showError(extractApiErrorMessage(error, t('channelMonitorV2.loadFailed')))
  } finally {
    if (id === sequence) {
      loading.value = false
      tabLoading.value = false
      refreshing.value = false
    }
  }
}

/** When only range changes, still refresh dimensions; dimension filters only re-load metrics. */
async function reloadMetricsOnly(silent = true) {
  controller?.abort()
  const request = new AbortController()
  controller = request
  const id = ++sequence
  refreshing.value = true
  loadError.value = false
  if (!silent) loading.value = true
  try {
    await loadMetrics(request.signal, id)
  } catch (error) {
    if (id !== sequence || request.signal.aborted || isAbortError(error)) return
    loadError.value = true
    appStore.showError(extractApiErrorMessage(error, t('channelMonitorV2.loadFailed')))
  } finally {
    if (id === sequence) {
      loading.value = false
      tabLoading.value = false
      refreshing.value = false
    }
  }
}
async function loadTab(signal?: AbortSignal, id = sequence) {
  const tabRequestId = ++tabSequence
  const requestedTab = activeTab.value
  tabLoading.value = true
  try {
    if (requestedTab === 'models') {
      const next = (await api.getModels(filter.value, isAdmin.value, signal)).items || []
      if (id !== sequence || tabRequestId !== tabSequence || activeTab.value !== requestedTab) return
      modelRows.value = next
    } else if (requestedTab === 'errors') {
      const next = (await api.getErrors(filter.value, isAdmin.value, signal)).items || []
      if (id !== sequence || tabRequestId !== tabSequence || activeTab.value !== requestedTab) return
      errorRows.value = next
    } else {
      const next = (await api.getUsers(filter.value, isAdmin.value, signal)).items || []
      if (id !== sequence || tabRequestId !== tabSequence || activeTab.value !== requestedTab) return
      userRows.value = next
    }
  } catch (error) {
    if (isAbortError(error)) return
    appStore.showError(extractApiErrorMessage(error, t('channelMonitorV2.detailLoadFailed')))
  } finally {
    if (id === sequence && tabRequestId === tabSequence) tabLoading.value = false
  }
}
function setRange(value: MonitorRange) {
  filter.value.range = value
}
function clearDimensions() {
  // Replace arrays so deep watch always fires and metrics reload full window.
  filter.value = {
    ...filter.value,
    platforms: [],
    groupIds: [],
    models: [],
  }
}
function scheduleAutoRefresh() {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  // Poll faster while first-upgrade bootstrap is filling 90m→30d so the progress bar moves.
  const seconds = bootstrapActive.value
    ? 10
    : snapshot.value?.config?.refresh_interval_seconds || 300
  autoRefreshTimer = window.setInterval(() => {
    if (!loading.value && !refreshing.value) {
      void reload(true)
    }
  }, Math.max(bootstrapActive.value ? 10 : 60, seconds) * 1000)
}
function drillModel(row: MonitorModelRow) {
  filter.value.platforms = [row.platform]
  filter.value.models = [row.model]
}
function formatRate(value: number) {
  return formatMonitorThroughput(value)
}
function exactRate(value: number) {
  return Intl.NumberFormat(locale.value || undefined, { maximumFractionDigits: 2 }).format(value || 0)
}
function formatTps(tpm: number | null | undefined) {
  return formatMonitorTokensPerSecond(tpm)
}
function exactTps(tpm: number | null | undefined) {
  return Intl.NumberFormat(locale.value || undefined, { maximumFractionDigits: 3 }).format(
    tokensPerSecondFromTpm(tpm),
  )
}
function formatPercent(value: number) {
  return formatMonitorPercent(value)
}
function formatMs(value: number | null) {
  return formatMonitorMs(value)
}
function latencyDetail(metric: {
  p50_ms: number | null
  p90_ms?: number | null
  p95_ms: number | null
  avg_ms?: number | null
}) {
  return formatLatencyPrivacy(metric.p50_ms, metric.p90_ms, metric.avg_ms, metric.p95_ms)
}
/** KPI secondary: AVG · P90 under the P50 primary value. */
function latencyKpiSecondary(metric: {
  p90_ms?: number | null
  p95_ms: number | null
  avg_ms?: number | null
}) {
  return formatLatencyKpiSecondary(metric.avg_ms, metric.p90_ms, metric.p95_ms)
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat(locale.value || undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
function healthTone(state?: HealthState): 'neutral' | 'success' | 'warning' | 'danger' {
  if (state === 'healthy') return 'success'
  if (state === 'warning') return 'warning'
  if (state === 'critical') return 'danger'
  return 'neutral'
}
function statusDot(health?: MonitorHealth | HealthState) {
  if (!health || typeof health === 'string') {
    return `status-dot health-${health || 'unknown'}`
  }
  // Prefer multi-band score when available; otherwise fall back to the coarse
  // overall state for mixed-version/older payloads.
  const klass =
    health.score != null
      ? healthScoreClass(health, 'overall', 0)
      : `health-${health.overall || 'unknown'}`
  return `status-dot ${klass}`
}
function errorLabel(value: string) {
  const key = `channelMonitorV2.errorCategories.${value}`
  return te(key) ? t(key) : monitorErrorCategoryLabel(value)
}
function toggleError(category: string) {
  const next = new Set(expandedErrors.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  expandedErrors.value = next
}

let lastRange: MonitorRange = filter.value.range
watch(
  filter,
  () => {
    syncQuery()
    const rangeChanged = filter.value.range !== lastRange
    lastRange = filter.value.range
    if (rangeChanged) void reload(true)
    else void reloadMetricsOnly(true)
  },
  { deep: true }
)
watch(matrixGroupBy, () => {
  syncQuery()
  void reloadMetricsOnly(true)
})
watch(healthMode, syncQuery)
watch(trendView, syncQuery)
watch(activeTab, () => {
  syncQuery()
  void loadTab()
})
onMounted(() => void reload(false))
onBeforeUnmount(() => {
  sequence += 1
  tabSequence += 1
  controller?.abort()
  controller = null
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
})
</script>

<style scoped>
.monitor-page {
  min-width: 0;
  padding-bottom: 36px;
}

.monitor-bootstrap {
  display: grid;
  width: 100%;
  gap: 8px;
}

.monitor-bootstrap > span {
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.monitor-filter {
  width: min(100%, 230px);
}

.monitor-group-select {
  width: min(100%, 210px);
}

.monitor-chart-section {
  height: 340px;
  min-height: 340px;
  overflow: hidden;
}

.monitor-toolbar-modes {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.monitor-records {
  min-width: 0;
  padding-top: 4px;
}

.monitor-records__body {
  max-height: min(56vh, 560px);
  min-height: 180px;
  padding-top: 12px;
  overflow-y: auto;
}

.monitor-records__loading {
  display: grid;
  gap: 16px;
  padding: 20px 8px;
}

.monitor-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--ui-text);
  background: var(--ui-surface);
}

.monitor-table th,
.monitor-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--ui-border-soft);
  text-align: left;
  vertical-align: middle;
}

.monitor-table th {
  color: var(--ui-text-soft);
  background: var(--ui-surface-muted);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.monitor-table td {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.monitor-table td > span,
.monitor-table td > small {
  display: block;
}

.monitor-table td > small,
.monitor-model-identity small {
  margin-top: 2px;
  color: var(--ui-text-soft);
  font-size: 10px;
  line-height: 16px;
}

.monitor-table__current {
  background: var(--ui-surface-muted);
}

.monitor-table td > strong {
  margin-right: 6px;
  font-weight: 600;
}

.monitor-model-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  text-align: left;
}

.monitor-model-identity > span:last-child {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.monitor-model-identity strong {
  max-width: 260px;
  overflow: hidden;
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monitor-errors {
  border-top: 1px solid var(--ui-border-soft);
}

.monitor-error {
  border-bottom: 1px solid var(--ui-border-soft);
}

.monitor-error--ignored {
  opacity: .62;
}

.monitor-error__trigger {
  display: grid;
  width: 100%;
  min-height: 48px;
  grid-template-columns: minmax(150px, 220px) minmax(140px, 1fr) 64px 20px;
  align-items: center;
  gap: 12px;
  padding: 8px 4px;
  border: 0;
  color: var(--ui-text);
  background: transparent;
  text-align: left;
}

.monitor-error__name {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.monitor-error__name strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monitor-error__trigger > small {
  color: var(--ui-text-muted);
  font-family: var(--ui-font-latin);
  font-size: 11px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.monitor-error__trigger > svg {
  color: var(--ui-text-soft);
  transition: transform var(--ui-motion-fast);
}

.monitor-error__trigger > svg.is-open {
  transform: rotate(180deg);
}

.monitor-error__details {
  display: grid;
  gap: 8px;
  padding: 0 4px 14px;
}

.monitor-error__details > p {
  margin: 0;
  color: var(--ui-text-soft);
  font-size: 11px;
}

.monitor-error-detail {
  padding: 10px 0;
  border-top: 1px solid var(--ui-border-soft);
}

.monitor-error-detail > div {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--ui-text-soft);
  font-size: 10px;
}

.monitor-error-detail > div strong {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ui-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monitor-error-detail p {
  margin: 6px 0 0;
  color: var(--ui-text-muted);
  font-family: var(--ui-font-mono);
  font-size: 11px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
}

.health-score10,
.health-score9,
.health-score8,
.health-healthy { background: var(--ui-success); }

.health-score7,
.health-score6,
.health-score5,
.health-score4,
.health-warning { background: var(--ui-warning); }

.health-score3,
.health-score2,
.health-score1,
.health-score0,
.health-critical { background: var(--ui-danger); }

.health-unknown { background: var(--ui-text-soft); }

@media (max-width: 640px) {
  .monitor-page {
    padding-bottom: 24px;
  }

  .monitor-filter,
  .monitor-group-select {
    width: 100%;
  }

  .monitor-toolbar-modes {
    display: grid;
    width: 100%;
    grid-template-columns: 1fr;
  }

  .monitor-toolbar-modes > * {
    width: 100%;
  }

  .monitor-records__body {
    max-height: none;
  }

  .monitor-error__trigger {
    grid-template-columns: minmax(120px, 1fr) 72px 20px;
  }

  .monitor-error__trigger > .ui-progress {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .monitor-error__trigger > svg {
    transition: none;
  }
}
</style>
