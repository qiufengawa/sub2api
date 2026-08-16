<template>
  <div class="key-usage-page">
    <HomeSiteHeader
      :site-name="siteName"
      :site-logo="siteLogo"
      :doc-url="docUrl"
      :is-dark="isDark"
      :is-authenticated="false"
      dashboard-path="/dashboard"
      :model-plaza-enabled="false"
      compact
      @toggle-theme="toggleTheme"
    />

    <AppPage width="wide" density="comfortable" class="key-usage-content">
      <AppPageHeader :title="t('keyUsage.title')" :description="t('keyUsage.subtitle')">
        <template #actions>
          <UiBadge tone="info" :label="t('keyUsage.privacyNote')" />
        </template>
      </AppPageHeader>

      <AppSection class="key-usage-query" :title="t('keyUsage.query')">
        <div class="key-usage-query__row" data-testid="key-query-row">
          <UiTextField
            id="key-usage-api-key"
            v-model="apiKey"
            :type="keyVisible ? 'text' : 'password'"
            :input-attrs="{ 'aria-label': t('keyUsage.title') }"
            :placeholder="t('keyUsage.placeholder')"
            autocomplete="off"
            inputmode="text"
            monospace
            density="compact"
            @enter="queryKey"
          >
            <template #prefix><Icon name="lock" size="sm" /></template>
            <template #suffix>
              <UiIconButton
                :icon="keyVisible ? 'eyeOff' : 'eye'"
                variant="ghost"
                density="mini"
                :label="keyVisible ? t('keyUsage.hideApiKey') : t('keyUsage.showApiKey')"
                data-testid="key-visibility-toggle"
                @click="keyVisible = !keyVisible"
              />
            </template>
          </UiTextField>
          <UiButton
            variant="primary"
            density="compact"
            :loading="isQuerying"
            :disabled="isQuerying"
            :aria-busy="isQuerying"
            @click="queryKey"
          >
            <template #icon><Icon name="search" size="sm" /></template>
            {{ isQuerying ? t('keyUsage.querying') : t('keyUsage.query') }}
          </UiButton>
        </div>

        <div v-if="showDatePicker" class="key-usage-range">
          <span class="key-usage-range__label">{{ t('keyUsage.dateRange') }}</span>
          <div class="key-usage-range__controls">
            <UiButton
              v-for="range in dateRanges"
              :key="range.key"
              :variant="currentRange === range.key ? 'primary' : 'secondary'"
              density="dense"
              :aria-pressed="currentRange === range.key"
              @click="setDateRange(range.key)"
            >{{ range.label }}</UiButton>
          </div>
          <div v-if="currentRange === 'custom'" class="key-usage-custom-range" data-testid="custom-date-range">
            <UiDateInput
              v-model="customStartDate"
              :label="t('keyUsage.customStartDate')"
              :max="customEndDate || undefined"
              :error="customStartDateError || undefined"
              density="compact"
            />
            <UiDateInput
              v-model="customEndDate"
              :label="t('keyUsage.customEndDate')"
              :min="customStartDate || undefined"
              :error="customEndDateError || undefined"
              density="compact"
            />
            <UiButton variant="primary" density="compact" @click="applyCustomRange">{{ t('keyUsage.apply') }}</UiButton>
          </div>
        </div>
      </AppSection>

      <div v-if="showResults" class="key-usage-results" :aria-busy="showLoading" aria-live="polite">
        <div v-if="showLoading" class="key-usage-loading" role="status">
          <span class="sr-only">{{ t('keyUsage.querying') }}</span>
          <div class="key-usage-loading__quotas">
            <div v-for="i in 3" :key="i" class="key-usage-loading__quota">
              <UiSkeleton variant="text" width="34%" height="14px" />
              <UiSkeleton variant="rect" width="100%" height="7px" />
              <UiSkeleton variant="text" width="52%" height="12px" />
            </div>
          </div>
          <div class="key-usage-loading__rows">
            <UiSkeleton v-for="i in 6" :key="i" variant="text" :width="`${55 + (i % 3) * 12}%`" height="14px" />
          </div>
        </div>

        <div v-else-if="resultData" class="key-usage-results__content">
          <div v-if="statusInfo" class="key-usage-status">
            <span class="key-usage-status__mode">{{ statusInfo.label }}</span>
            <UiStatusBadge :status="statusInfo.status" :label="statusInfo.statusText" dot />
          </div>

          <div v-if="ringItems.length > 0" class="key-usage-quota-grid">
            <template v-for="ring in ringItems" :key="ring.title">
              <UiStatMetric
                v-if="ring.isBalance"
                :label="ring.title"
                :value="ring.amount"
              />
              <UiQuotaSummary
                v-else
                :label="ring.title"
                :used="ring.used"
                :total="ring.total"
                :reset-text="ring.resetAt && formatResetTime(ring.resetAt)
                  ? t('keyUsage.resetsIn', { time: formatResetTime(ring.resetAt) })
                  : undefined"
              />
            </template>
          </div>

          <section v-if="detailRows.length > 0" class="key-usage-section">
            <header class="key-usage-section__header"><h3>{{ t('keyUsage.detailInfo') }}</h3></header>
            <UiDescriptionList :items="detailRows" :columns="2" />
          </section>

          <section v-if="usageStatCells.length > 0" class="key-usage-section">
            <header class="key-usage-section__header"><h3>{{ t('keyUsage.tokenStats') }}</h3></header>
            <div class="key-usage-stat-grid">
              <UiStatMetric v-for="cell in usageStatCells" :key="cell.label" :label="cell.label" :value="cell.value" />
            </div>
          </section>

          <section v-if="showDailyUsage" class="key-usage-section">
            <header class="key-usage-section__header">
              <h3>{{ t('keyUsage.dailyDetail') }}</h3>
              <UiSegmentedControl
                :model-value="dailyUsageDays"
                :options="dailyUsageOptions"
                :label="t('keyUsage.dailyDetail')"
                @update:model-value="handleDailyUsageDays"
              />
            </header>
            <UiDataTable
              :columns="dailyColumns"
              :data="dailyUsageRows"
              :mobile-table="false"
              :aria-label="t('keyUsage.dailyDetail')"
            >
              <template #empty><div class="key-usage-empty">{{ t('keyUsage.noDailyUsage') }}</div></template>
            </UiDataTable>
          </section>

          <section v-if="modelStats.length > 0" class="key-usage-section">
            <header class="key-usage-section__header"><h3>{{ t('keyUsage.modelStats') }}</h3></header>
            <UiDataTable
              :columns="modelColumns"
              :data="modelStats"
              :mobile-table="false"
              :aria-label="t('keyUsage.modelStats')"
            />
          </section>
        </div>
      </div>
    </AppPage>

    <footer class="key-usage-footer">
      <span>&copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}</span>
      <span class="key-usage-footer__links">
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ t('home.docs') }}</a>
        <a :href="githubUrl" target="_blank" rel="noopener noreferrer">{{ t('nav.github') }}</a>
      </span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import Icon from '@/components/icons/Icon.vue'
import HomeSiteHeader from '@/components/home/HomeSiteHeader.vue'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  UiBadge,
  UiButton,
  UiDataTable,
  UiDateInput,
  UiDescriptionList,
  UiIconButton,
  UiQuotaSummary,
  UiSegmentedControl,
  UiSkeleton,
  UiStatMetric,
  UiStatusBadge,
  UiTextField,
} from '@/components/ui'
import { buildGatewayUrl } from '@/api/client'
import { formatDateLocalInput } from '@/utils/format'
import { sanitizeUrl } from '@/utils/url'

const { t, locale } = useI18n()
const appStore = useAppStore()

// ==================== Site Settings (same as HomeView) ====================

const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const githubUrl = 'https://github.com/qiufengawa/sub2api'

// ==================== Theme (same as HomeView) ====================

const isDark = ref(document.documentElement.classList.contains('dark'))

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const currentYear = computed(() => new Date().getFullYear())

// ==================== Key Query State ====================

const apiKey = ref('')
const keyVisible = ref(false)
const isQuerying = ref(false)
const showResults = ref(false)
const showLoading = ref(false)
const showDatePicker = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resultData = ref<any>(null)
const now = ref(new Date())
let resetTimer: ReturnType<typeof setInterval> | null = null

// ==================== Date Range State ====================

type DateRangeKey = 'today' | '7d' | '30d' | 'custom'
const currentRange = ref<DateRangeKey>('today')
const customStartDate = ref('')
const customEndDate = ref('')
const customRangeTouched = ref(false)
const dailyUsageDays = ref<7 | 30 | 90>(30)

const customStartDateError = computed(() => {
  if (!customRangeTouched.value || currentRange.value !== 'custom') return ''
  if (!customStartDate.value) return t('keyUsage.customRangeRequired')
  if (customEndDate.value && customStartDate.value > customEndDate.value) {
    return t('keyUsage.customRangeInvalid')
  }
  return ''
})

const customEndDateError = computed(() => {
  if (!customRangeTouched.value || currentRange.value !== 'custom') return ''
  return customEndDate.value ? '' : t('keyUsage.customRangeRequired')
})

const customRangeValid = computed(() => Boolean(
  customStartDate.value
  && customEndDate.value
  && customStartDate.value <= customEndDate.value
))

const dateRanges = computed(() => [
  { key: 'today' as const, label: t('keyUsage.dateRangeToday') },
  { key: '7d' as const, label: t('keyUsage.dateRange7d') },
  { key: '30d' as const, label: t('keyUsage.dateRange30d') },
  { key: 'custom' as const, label: t('keyUsage.dateRangeCustom') },
])

const dailyUsageOptions = computed(() => [
  { value: 7 as const, label: t('keyUsage.dateRange7d') },
  { value: 30 as const, label: t('keyUsage.dateRange30d') },
  { value: 90 as const, label: t('keyUsage.dateRange90d') },
])

function setDateRange(key: DateRangeKey) {
  currentRange.value = key
  customRangeTouched.value = false
  if (key !== 'custom') {
    void queryKey()
  }
}

function applyCustomRange() {
  customRangeTouched.value = true
  if (!customRangeValid.value) return
  void queryKey()
}

function getDateParams(): string {
  const now = new Date()
  const params = new URLSearchParams()

  if (currentRange.value === 'custom') {
    params.set('start_date', customStartDate.value)
    params.set('end_date', customEndDate.value)
  } else {
    const end = formatDateLocalInput(now)
    let start: string
    switch (currentRange.value) {
      case 'today': start = end; break
      case '7d': start = formatDateLocalInput(new Date(now.getTime() - 7 * 86400000)); break
      case '30d': start = formatDateLocalInput(new Date(now.getTime() - 30 * 86400000)); break
      default: start = formatDateLocalInput(new Date(now.getTime() - 30 * 86400000))
    }
    params.set('start_date', start)
    params.set('end_date', end)
  }
  params.set('days', String(dailyUsageDays.value))
  params.set('timezone', getBrowserTimezone())
  return params.toString()
}

function setDailyUsageDays(days: 7 | 30 | 90) {
  if (dailyUsageDays.value === days) return
  dailyUsageDays.value = days
  if (resultData.value && apiKey.value.trim()) {
    queryKey()
  }
}

interface RingItem {
  title: string
  pct: number
  amount: string
  used: number
  total: number
  isBalance?: boolean
  iconType: 'clock' | 'calendar' | 'dollar'
  resetAt?: string | null
}

// ==================== Computed Data ====================

const statusInfo = computed(() => {
  const data = resultData.value
  if (!data) return null

  if (data.mode === 'quota_limited') {
    const isValid = data.isValid !== false
    const statusMap: Record<string, string> = {
      active: t('keyUsage.statusActive'),
      quota_exhausted: t('keyUsage.statusQuotaExhausted'),
      expired: t('keyUsage.statusExpired'),
    }
    return {
      label: t('keyUsage.quotaMode'),
      statusText: statusMap[data.status] || data.status || t('keyUsage.statusUnknown'),
      status: data.status || 'unknown',
      isActive: isValid && data.status === 'active',
    }
  }

  return {
    label: data.planName || t('keyUsage.walletBalance'),
    statusText: t('keyUsage.statusActive'),
    status: 'active',
    isActive: true,
  }
})

const ringItems = computed<RingItem[]>(() => {
  const data = resultData.value
  if (!data) return []

  const items: RingItem[] = []

  if (data.mode === 'quota_limited') {
    if (data.quota) {
      const pct = data.quota.limit > 0 ? Math.min(Math.round((data.quota.used / data.quota.limit) * 100), 100) : 0
      items.push({
        title: t('keyUsage.totalQuota'),
        pct,
        used: data.quota.used,
        total: data.quota.limit,
        amount: `${usd(data.quota.used)} / ${usd(data.quota.limit)}`,
        iconType: 'dollar',
      })
    }
    if (data.rate_limits) {
      const windowLabels: Record<string, string> = { '5h': t('keyUsage.limit5h'), '1d': t('keyUsage.limitDaily'), '7d': t('keyUsage.limit7d') }
      const windowIcons: Record<string, 'clock' | 'calendar'> = { '5h': 'clock', '1d': 'calendar', '7d': 'calendar' }
      for (const rl of data.rate_limits) {
        const pct = rl.limit > 0 ? Math.min(Math.round((rl.used / rl.limit) * 100), 100) : 0
        items.push({
          title: windowLabels[rl.window] || rl.window,
          pct,
          used: rl.used,
          total: rl.limit,
          amount: `${usd(rl.used)} / ${usd(rl.limit)}`,
          iconType: windowIcons[rl.window] || 'clock',
          resetAt: rl.reset_at,
        })
      }
    }
  } else {
    if (data.subscription) {
      const sub = data.subscription
      const limits = [
        { label: t('keyUsage.limitDaily'), usage: sub.daily_usage_usd, limit: sub.daily_limit_usd },
        { label: t('keyUsage.limitWeekly'), usage: sub.weekly_usage_usd, limit: sub.weekly_limit_usd },
        { label: t('keyUsage.limitMonthly'), usage: sub.monthly_usage_usd, limit: sub.monthly_limit_usd },
      ]
      for (const l of limits) {
        if (l.limit != null && l.limit > 0) {
          const pct = Math.min(Math.round((l.usage / l.limit) * 100), 100)
        items.push({
          title: l.label,
          pct,
          used: l.usage,
          total: l.limit,
          amount: `${usd(l.usage)} / ${usd(l.limit)}`,
          iconType: 'calendar',
        })
        }
      }
    }
    if (!data.subscription && data.balance != null) {
      items.push({
        title: t('keyUsage.walletBalance'),
        pct: 0,
        used: 0,
        total: 0,
        amount: usd(data.balance),
        isBalance: true,
        iconType: 'dollar',
      })
    }
  }

  return items
})

interface DetailRow {
  label: string
  value: string
}

const detailRows = computed<DetailRow[]>(() => {
  const data = resultData.value
  if (!data) return []

  const rows: DetailRow[] = []
  if (data.mode === 'quota_limited') {
    if (data.quota) {
      rows.push({
        label: t('keyUsage.remainingQuota'),
        value: usd(data.quota.remaining),
      })
    }
    if (data.expires_at) {
      const daysLeft = data.days_until_expiry
      let expiryStr = formatDate(data.expires_at)
      if (daysLeft != null) {
        expiryStr += daysLeft > 0 ? ` ${t('keyUsage.daysLeft', { days: daysLeft })}` : daysLeft === 0 ? ` ${t('keyUsage.todayExpires')}` : ''
      }
      rows.push({
        label: t('keyUsage.expiresAt'),
        value: expiryStr,
      })
    }
    if (data.rate_limits) {
      const windowMap: Record<string, string> = { '5h': '5H', '1d': locale.value === 'zh' ? '日' : 'D', '7d': '7D' }
      for (const rl of data.rate_limits) {
        let valueStr = `${usd(rl.used)} / ${usd(rl.limit)}`
        const resetStr = formatResetTime(rl.reset_at)
        if (resetStr) {
          valueStr += ` (${t('keyUsage.resetsIn', { time: resetStr })})`
        }
        rows.push({
          label: `${t('keyUsage.usedQuota')} (${windowMap[rl.window] || rl.window})`,
          value: valueStr,
        })
      }
    }
  } else {
    rows.push({
      label: t('keyUsage.subscriptionType'),
      value: data.planName || t('keyUsage.walletBalance'),
    })

    if (data.subscription) {
      const sub = data.subscription
      if (sub.daily_limit_usd > 0) {
        rows.push({
          label: `${t('keyUsage.usedQuota')} (${locale.value === 'zh' ? '日' : 'D'})`,
          value: `${usd(sub.daily_usage_usd)} / ${usd(sub.daily_limit_usd)}`,
        })
      }
      if (sub.weekly_limit_usd > 0) {
        rows.push({
          label: `${t('keyUsage.usedQuota')} (${locale.value === 'zh' ? '周' : 'W'})`,
          value: `${usd(sub.weekly_usage_usd)} / ${usd(sub.weekly_limit_usd)}`,
        })
      }
      if (sub.monthly_limit_usd > 0) {
        rows.push({
          label: `${t('keyUsage.usedQuota')} (${locale.value === 'zh' ? '月' : 'M'})`,
          value: `${usd(sub.monthly_usage_usd)} / ${usd(sub.monthly_limit_usd)}`,
        })
      }
      if (sub.expires_at) {
        rows.push({
          label: t('keyUsage.subscriptionExpires'),
          value: formatDate(sub.expires_at),
        })
      }
    }

    rows.push({
      label: t('keyUsage.remainingQuota'),
      value: data.remaining != null ? usd(data.remaining) : '-',
    })
  }

  return rows
})

interface StatCell {
  label: string
  value: string
}

const usageStatCells = computed<StatCell[]>(() => {
  const usage = resultData.value?.usage
  if (!usage) return []

  const today = usage.today || {}
  const total = usage.total || {}

  return [
    { label: t('keyUsage.todayRequests'), value: fmtNum(today.requests) },
    { label: t('keyUsage.todayInputTokens'), value: fmtNum(today.input_tokens) },
    { label: t('keyUsage.todayOutputTokens'), value: fmtNum(today.output_tokens) },
    { label: t('keyUsage.todayTokens'), value: fmtNum(today.total_tokens) },
    { label: t('keyUsage.todayCacheCreation'), value: fmtNum(today.cache_creation_tokens) },
    { label: t('keyUsage.todayCacheRead'), value: fmtNum(today.cache_read_tokens) },
    { label: t('keyUsage.todayCost'), value: usd(today.actual_cost) },
    { label: t('keyUsage.rpmTpm'), value: `${usage.rpm || 0} / ${usage.tpm || 0}` },
    { label: t('keyUsage.totalRequests'), value: fmtNum(total.requests) },
    { label: t('keyUsage.totalInputTokens'), value: fmtNum(total.input_tokens) },
    { label: t('keyUsage.totalOutputTokens'), value: fmtNum(total.output_tokens) },
    { label: t('keyUsage.totalTokensLabel'), value: fmtNum(total.total_tokens) },
    { label: t('keyUsage.totalCacheCreation'), value: fmtNum(total.cache_creation_tokens) },
    { label: t('keyUsage.totalCacheRead'), value: fmtNum(total.cache_read_tokens) },
    { label: t('keyUsage.totalCost'), value: usd(total.actual_cost) },
    { label: t('keyUsage.avgDuration'), value: usage.average_duration_ms ? `${Math.round(usage.average_duration_ms)} ms` : '-' },
  ]
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelStats = computed<any[]>(() => resultData.value?.model_stats || [])

interface DailyUsageRow {
  date: string
  requests: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost: number
  actual_cost?: number
}

const dailyUsageRows = computed<DailyUsageRow[]>(() => {
  const rows = resultData.value?.daily_usage
  return Array.isArray(rows) ? rows : []
})

const showDailyUsage = computed(() => Boolean(resultData.value && Array.isArray(resultData.value.daily_usage)))

const dailyColumns = computed(() => [
  { key: 'date', label: t('keyUsage.date'), sortable: false },
  { key: 'requests', label: t('keyUsage.requests'), formatter: (value: number) => fmtNum(value) },
  { key: 'input_tokens', label: t('keyUsage.inputTokens'), formatter: (value: number) => fmtNum(value) },
  { key: 'output_tokens', label: t('keyUsage.outputTokens'), formatter: (value: number) => fmtNum(value) },
  { key: 'cache_read_tokens', label: t('keyUsage.cacheReadTokens'), formatter: (value: number) => fmtNum(value) },
  { key: 'cache_write_tokens', label: t('keyUsage.cacheWriteTokens'), formatter: (value: number) => fmtNum(value) },
  {
    key: 'cost',
    label: t('keyUsage.cost'),
    formatter: (_value: number, row: DailyUsageRow) => usd(row.actual_cost != null ? row.actual_cost : row.cost),
  },
])

const modelColumns = computed(() => [
  { key: 'model', label: t('keyUsage.model'), formatter: (value: string) => value || '-' },
  { key: 'requests', label: t('keyUsage.requests'), formatter: (value: number) => fmtNum(value) },
  { key: 'input_tokens', label: t('keyUsage.inputTokens'), formatter: (value: number) => fmtNum(value) },
  { key: 'output_tokens', label: t('keyUsage.outputTokens'), formatter: (value: number) => fmtNum(value) },
  { key: 'cache_creation_tokens', label: t('keyUsage.cacheCreationTokens'), formatter: (value: number) => fmtNum(value) },
  { key: 'cache_read_tokens', label: t('keyUsage.cacheReadTokens'), formatter: (value: number) => fmtNum(value) },
  { key: 'total_tokens', label: t('keyUsage.totalTokens'), formatter: (value: number) => fmtNum(value) },
  {
    key: 'cost',
    label: t('keyUsage.cost'),
    formatter: (_value: number, row: Record<string, number>) => usd(row.actual_cost != null ? row.actual_cost : row.cost),
  },
])

function handleDailyUsageDays(value: string | number) {
  const days = Number(value)
  if (days === 7 || days === 30 || days === 90) {
    setDailyUsageDays(days)
  }
}

// ==================== Utility Functions ====================

function usd(value: number | null | undefined): string {
  if (value == null || value < 0) return '-'
  return '$' + Number(value).toFixed(2)
}

function fmtNum(val: number | null | undefined): string {
  if (val == null) return '-'
  return val.toLocaleString()
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const loc = locale.value === 'zh' ? 'zh-CN' : 'en-US'
  return d.toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric' })
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// ==================== API Query ====================

async function fetchUsage(key: string) {
  const dateParams = getDateParams()
  const url = buildGatewayUrl('/v1/usage') + (dateParams ? '?' + dateParams : '')
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + key },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.error?.message || body?.message || `${t('keyUsage.queryFailed')} (${res.status})`
    throw new Error(msg)
  }
  return await res.json()
}

async function queryKey() {
  if (isQuerying.value) return
  const key = apiKey.value.trim()
  if (!key) {
    appStore.showInfo(t('keyUsage.enterApiKey'))
    return
  }
  if (currentRange.value === 'custom') {
    customRangeTouched.value = true
    if (!customRangeValid.value) return
  }

  isQuerying.value = true
  showResults.value = true
  showLoading.value = true
  resultData.value = null

  try {
    const data = await fetchUsage(key)
    resultData.value = data
    showLoading.value = false
    showDatePicker.value = true

    appStore.showSuccess(t('keyUsage.querySuccess'))
  } catch (err) {
    showResults.value = false
    showLoading.value = false
    appStore.showError((err as Error).message || t('keyUsage.queryFailedRetry'))
  } finally {
    isQuerying.value = false
  }
}

// ==================== Lifecycle ====================

function initTheme() {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
}

function formatResetTime(resetAt: string | null | undefined): string {
  if (!resetAt) return ''
  const diff = new Date(resetAt).getTime() - now.value.getTime()
  if (diff <= 0) return t('keyUsage.resetNow')
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

onMounted(() => {
  initTheme()
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
  resetTimer = setInterval(() => { now.value = new Date() }, 60000)
})

onUnmounted(() => {
  if (resetTimer) clearInterval(resetTimer)
})
</script>

<style scoped>
 .key-usage-page {
  min-height: 100vh;
  color: var(--ui-text);
  background: var(--ui-page);
}
.key-usage-content {
  max-width: 1080px;
  margin: 0 auto;
}
.key-usage-query {
  max-width: 760px;
  margin: 0 auto;
}
.key-usage-query__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}
.key-usage-range {
  display: grid;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--ui-border-soft);
}
.key-usage-range__label {
  color: var(--ui-text-muted);
  font-size: 12px;
}
.key-usage-range__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.key-usage-custom-range {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 8px;
}
.key-usage-footer {
  display: flex;
  max-width: 1080px;
  margin: 0 auto;
  padding: 18px 16px 28px;
  justify-content: space-between;
  gap: 12px;
  color: var(--ui-text-soft);
  font-size: 12px;
}
.key-usage-footer__links { display: inline-flex; gap: 12px; }
.key-usage-footer a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
.key-usage-results { display: grid; gap: 16px; }
.key-usage-results__content { display: grid; gap: 16px; }
.key-usage-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-block: 10px;
  border-block: 1px solid var(--ui-border-soft);
}
.key-usage-status__mode { color: var(--ui-text-muted); font-size: 12px; }
.key-usage-quota-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.key-usage-section {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border-soft);
}
.key-usage-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.key-usage-section__header h3 { margin: 0; color: var(--ui-text); font-size: 14px; font-weight: 600; }
.key-usage-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.key-usage-empty { padding: 32px 16px; color: var(--ui-text-muted); text-align: center; font-size: 13px; }
.key-usage-loading { display: grid; gap: 16px; }
.key-usage-loading__quotas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.key-usage-loading__quota,
.key-usage-loading__rows {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
}
.key-usage-loading__rows { gap: 14px; }
@media (max-width: 640px) {
  .key-usage-query__row,
  .key-usage-custom-range { grid-template-columns: 1fr; }
  .key-usage-footer { flex-direction: column; }
  .key-usage-quota-grid,
  .key-usage-loading__quotas { grid-template-columns: 1fr; }
  .key-usage-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .key-usage-section__header { align-items: flex-start; flex-direction: column; }
}
</style>
