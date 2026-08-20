<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { opsAPI, type OpsAccountAvailabilityStatsResponse, type OpsConcurrencyStatsResponse, type OpsUserConcurrencyStatsResponse } from '@/api/admin/ops'
import Icon from '@/components/icons/Icon.vue'
import { UiAlert, UiBadge, UiButton, UiEmptyState, UiIconButton, UiProgressBar } from '@/components/ui'

interface Props {
  platformFilter?: string
  groupIdFilter?: number | null
  refreshToken: number
}

const props = withDefaults(defineProps<Props>(), {
  platformFilter: '',
  groupIdFilter: null
})

const { t } = useI18n()

const loading = ref(false)
const errorMessage = ref('')
const concurrency = ref<OpsConcurrencyStatsResponse | null>(null)
const availability = ref<OpsAccountAvailabilityStatsResponse | null>(null)
const userConcurrency = ref<OpsUserConcurrencyStatsResponse | null>(null)
let loadRequestId = 0

// 用户视图开关
const showByUser = ref(false)

const realtimeEnabled = computed(() => {
  return (concurrency.value?.enabled ?? true) && (availability.value?.enabled ?? true)
})

function safeNumber(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

// 计算显示维度
const displayDimension = computed<'platform' | 'group' | 'account' | 'user'>(() => {
  if (showByUser.value) {
    return 'user'
  }
  if (typeof props.groupIdFilter === 'number' && props.groupIdFilter > 0) {
    return 'account'
  }
  if (props.platformFilter) {
    return 'group'
  }
  return 'platform'
})

// 平台/分组汇总行数据
interface SummaryRow {
  key: string
  name: string
  platform?: string
  // 账号统计
  total_accounts: number
  available_accounts: number
  rate_limited_accounts: number
  error_accounts: number
  // 并发统计
  total_concurrency: number
  used_concurrency: number
  waiting_in_queue: number
  // 计算字段
  availability_percentage: number
  concurrency_percentage: number
}

// 账号详细行数据
interface AccountRow {
  key: string
  name: string
  platform: string
  group_name: string
  // 并发
  current_in_use: number
  max_capacity: number
  waiting_in_queue: number
  load_percentage: number
  // 状态
  is_available: boolean
  is_rate_limited: boolean
  rate_limit_remaining_sec?: number
  is_overloaded: boolean
  overload_remaining_sec?: number
  has_error: boolean
  error_message?: string
}

// 用户行数据
interface UserRow {
  key: string
  user_id: number
  user_email: string
  username: string
  current_in_use: number
  max_capacity: number
  waiting_in_queue: number
  load_percentage: number
}

// 平台维度汇总
const platformRows = computed((): SummaryRow[] => {
  const concStats = concurrency.value?.platform || {}
  const availStats = availability.value?.platform || {}

  const platforms = new Set([...Object.keys(concStats), ...Object.keys(availStats)])

  return Array.from(platforms).map(platform => {
    const conc = concStats[platform] || {}
    const avail = availStats[platform] || {}

    const totalAccounts = safeNumber(avail.total_accounts)
    const availableAccounts = safeNumber(avail.available_count)
    const totalConcurrency = safeNumber(conc.max_capacity)
    const usedConcurrency = safeNumber(conc.current_in_use)

    return {
      key: platform,
      name: platform.toUpperCase(),
      total_accounts: totalAccounts,
      available_accounts: availableAccounts,
      rate_limited_accounts: safeNumber(avail.rate_limit_count),

      error_accounts: safeNumber(avail.error_count),
      total_concurrency: totalConcurrency,
      used_concurrency: usedConcurrency,
      waiting_in_queue: safeNumber(conc.waiting_in_queue),
      availability_percentage: totalAccounts > 0 ? Math.round((availableAccounts / totalAccounts) * 100) : 0,
      concurrency_percentage: totalConcurrency > 0 ? Math.round((usedConcurrency / totalConcurrency) * 100) : 0
    }
  }).sort((a, b) => b.concurrency_percentage - a.concurrency_percentage)
})

// 分组维度汇总
const groupRows = computed((): SummaryRow[] => {
  const concStats = concurrency.value?.group || {}
  const availStats = availability.value?.group || {}

  const groupIds = new Set([...Object.keys(concStats), ...Object.keys(availStats)])

  const rows = Array.from(groupIds)
    .map(gid => {
      const conc = concStats[gid] || {}
      const avail = availStats[gid] || {}

      // 只显示匹配的平台
      if (props.platformFilter && conc.platform !== props.platformFilter && avail.platform !== props.platformFilter) {
        return null
      }

      const totalAccounts = safeNumber(avail.total_accounts)
      const availableAccounts = safeNumber(avail.available_count)
      const totalConcurrency = safeNumber(conc.max_capacity)
      const usedConcurrency = safeNumber(conc.current_in_use)

      return {
        key: gid,
        name: String(conc.group_name || avail.group_name || `Group ${gid}`),
        platform: String(conc.platform || avail.platform || ''),
        total_accounts: totalAccounts,
        available_accounts: availableAccounts,
        rate_limited_accounts: safeNumber(avail.rate_limit_count),
  
        error_accounts: safeNumber(avail.error_count),
        total_concurrency: totalConcurrency,
        used_concurrency: usedConcurrency,
        waiting_in_queue: safeNumber(conc.waiting_in_queue),
        availability_percentage: totalAccounts > 0 ? Math.round((availableAccounts / totalAccounts) * 100) : 0,
        concurrency_percentage: totalConcurrency > 0 ? Math.round((usedConcurrency / totalConcurrency) * 100) : 0
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  return rows.sort((a, b) => b.concurrency_percentage - a.concurrency_percentage)
})

// 账号维度详细
const accountRows = computed((): AccountRow[] => {
  const concStats = concurrency.value?.account || {}
  const availStats = availability.value?.account || {}

  const accountIds = new Set([...Object.keys(concStats), ...Object.keys(availStats)])

  const rows = Array.from(accountIds)
    .map(aid => {
      const conc = concStats[aid] || {}
      const avail = availStats[aid] || {}

      // 只显示匹配的分组
      if (typeof props.groupIdFilter === 'number' && props.groupIdFilter > 0) {
        if (conc.group_id !== props.groupIdFilter && avail.group_id !== props.groupIdFilter) {
          return null
        }
      }

      return {
        key: aid,
        name: String(conc.account_name || avail.account_name || `Account ${aid}`),
        platform: String(conc.platform || avail.platform || ''),
        group_name: String(conc.group_name || avail.group_name || ''),
        current_in_use: safeNumber(conc.current_in_use),
        max_capacity: safeNumber(conc.max_capacity),
        waiting_in_queue: safeNumber(conc.waiting_in_queue),
        load_percentage: safeNumber(conc.load_percentage),
        is_available: avail.is_available || false,
        is_rate_limited: avail.is_rate_limited || false,
        rate_limit_remaining_sec: avail.rate_limit_remaining_sec,
        is_overloaded: avail.is_overloaded || false,
        overload_remaining_sec: avail.overload_remaining_sec,
        has_error: avail.has_error || false,
        error_message: avail.error_message || ''
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  return rows.sort((a, b) => {
    // 优先显示异常账号
    if (a.has_error !== b.has_error) return a.has_error ? -1 : 1
    if (a.is_rate_limited !== b.is_rate_limited) return a.is_rate_limited ? -1 : 1
    // 然后按负载排序
    return b.load_percentage - a.load_percentage
  })
})

// 用户维度详细
const userRows = computed((): UserRow[] => {
  const userStats = userConcurrency.value?.user || {}

  return Object.keys(userStats)
    .map(uid => {
      const u = userStats[uid] || {}
      return {
        key: uid,
        user_id: safeNumber(u.user_id),
        user_email: u.user_email || `User ${uid}`,
        username: u.username || '',
        current_in_use: safeNumber(u.current_in_use),
        max_capacity: safeNumber(u.max_capacity),
        waiting_in_queue: safeNumber(u.waiting_in_queue),
        load_percentage: safeNumber(u.load_percentage)
      }
    })
    .sort((a, b) => b.current_in_use - a.current_in_use || b.load_percentage - a.load_percentage)
})

// 根据维度选择数据
const displayRows = computed(() => {
  if (displayDimension.value === 'user') return userRows.value
  if (displayDimension.value === 'account') return accountRows.value
  if (displayDimension.value === 'group') return groupRows.value
  return platformRows.value
})

const displayTitle = computed(() => {
  if (displayDimension.value === 'user') return t('admin.ops.concurrency.byUser')
  if (displayDimension.value === 'account') return t('admin.ops.concurrency.byAccount')
  if (displayDimension.value === 'group') return t('admin.ops.concurrency.byGroup')
  return t('admin.ops.concurrency.byPlatform')
})

async function loadData() {
  const requestId = ++loadRequestId
  loading.value = true
  errorMessage.value = ''
  try {
    if (showByUser.value) {
      // 用户视图模式只加载用户并发数据
      const userData = await opsAPI.getUserConcurrencyStats()
      if (requestId !== loadRequestId) return
      userConcurrency.value = userData
    } else {
      // 常规模式加载账号/平台/分组数据
      const [concData, availData] = await Promise.all([
        opsAPI.getConcurrencyStats(props.platformFilter, props.groupIdFilter),
        opsAPI.getAccountAvailabilityStats(props.platformFilter, props.groupIdFilter)
      ])
      if (requestId !== loadRequestId) return
      concurrency.value = concData
      availability.value = availData
    }
  } catch (err: any) {
    if (requestId !== loadRequestId) return
    console.error('[OpsConcurrencyCard] Failed to load data', err)
    errorMessage.value = err?.response?.data?.detail || t('admin.ops.concurrency.loadFailed')
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

// 刷新节奏由父组件统一控制（OpsDashboard Header 的刷新状态/倒计时）
watch(
  () => props.refreshToken,
  () => {
    if (!realtimeEnabled.value) return
    loadData()
  }
)

// 切换用户视图时重新加载数据
watch(
  () => showByUser.value,
  () => {
    loadData()
  }
)

function getLoadTone(loadPct: number): 'success' | 'warning' | 'danger' {
  if (loadPct >= 90) return 'danger'
  if (loadPct >= 70) return 'warning'
  return 'success'
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}


watch(
  () => realtimeEnabled.value,
  async (enabled) => {
    if (enabled) {
      await loadData()
    }
  },
  { immediate: true }
)
</script>

<template>
  <section class="ops-concurrency">
    <!-- 头部 -->
    <div class="ops-concurrency__header">
      <h3 class="ops-concurrency__title">
        <Icon name="bolt" size="sm" />
        {{ t('admin.ops.concurrency.title') }}
      </h3>
      <div class="ops-concurrency__actions">
        <UiButton
          variant="quiet"
          density="dense"
          @click="showByUser = !showByUser"
        >
          <template #icon><Icon :name="showByUser ? 'server' : 'users'" size="sm" /></template>
          {{ showByUser ? t('admin.ops.concurrency.switchToPlatform') : t('admin.ops.concurrency.switchToUser') }}
        </UiButton>
        <UiIconButton
          icon="refresh"
          density="dense"
          variant="ghost"
          :disabled="loading"
          :label="t('common.refresh')"
          @click="loadData"
        />
      </div>
    </div>

    <!-- 错误提示 -->
    <UiAlert v-if="errorMessage" tone="danger" :message="errorMessage" />

    <!-- 禁用状态 -->
    <div
      v-if="!realtimeEnabled"
      class="ops-concurrency__disabled"
    >
      <UiEmptyState :title="t('admin.ops.concurrency.disabledHint')" />
    </div>

    <!-- 数据展示区域 -->
    <div v-else class="ops-concurrency__body">
      <!-- 维度标题栏 -->
      <div class="ops-concurrency__subheader">
        <strong>
          {{ displayTitle }}
        </strong>
        <span>
          {{ t('admin.ops.concurrency.totalRows', { count: displayRows.length }) }}
        </span>
      </div>

      <!-- 空状态 -->
      <div v-if="displayRows.length === 0" class="ops-concurrency__empty">
        <UiEmptyState :title="t('admin.ops.concurrency.empty')" />
      </div>

      <!-- 用户视图 -->
      <div v-else-if="displayDimension === 'user'" class="ops-concurrency__list">
        <div v-for="row in (displayRows as UserRow[])" :key="row.key" class="ops-concurrency__row">
          <!-- 用户信息和并发 -->
          <div class="ops-concurrency__row-main">
            <div class="ops-concurrency__identity">
              <strong :title="row.username || row.user_email">
                {{ row.username || row.user_email }}
              </strong>
              <span v-if="row.username" :title="row.user_email">
                {{ row.user_email }}
              </span>
            </div>
            <div class="ops-concurrency__numbers">
              <strong> {{ row.current_in_use }}/{{ row.max_capacity }} </strong>
              <span> {{ Math.round(row.load_percentage) }}% </span>
            </div>
          </div>

          <!-- 进度条 -->
          <UiProgressBar :value="row.load_percentage" :tone="getLoadTone(row.load_percentage)" :show-value="false" :aria-label="`${row.username || row.user_email} ${Math.round(row.load_percentage)}%`" />

          <!-- 等待队列 -->
          <div v-if="row.waiting_in_queue > 0" class="ops-concurrency__queue">
            <UiBadge tone="warning" :label="t('admin.ops.concurrency.queued', { count: row.waiting_in_queue })" />
          </div>
        </div>
      </div>

      <!-- 汇总视图（平台/分组） -->
      <div v-else-if="displayDimension === 'platform' || displayDimension === 'group'" class="ops-concurrency__list">
        <div v-for="row in (displayRows as SummaryRow[])" :key="row.key" class="ops-concurrency__row">
          <!-- 标题行 -->
          <div class="ops-concurrency__row-main">
            <div class="ops-concurrency__identity">
              <strong :title="row.name">
                {{ row.name }}
              </strong>
              <span v-if="displayDimension === 'group' && row.platform">
                {{ row.platform.toUpperCase() }}
              </span>
            </div>
            <div class="ops-concurrency__numbers">
              <strong> {{ row.used_concurrency }}/{{ row.total_concurrency }} </strong>
              <span> {{ row.concurrency_percentage }}% </span>
            </div>
          </div>

          <!-- 进度条 -->
          <UiProgressBar :value="row.concurrency_percentage" :tone="getLoadTone(row.concurrency_percentage)" :show-value="false" :aria-label="`${row.name} ${row.concurrency_percentage}%`" />

          <!-- 统计信息 -->
          <div class="ops-concurrency__row-meta">
            <!-- 账号统计 -->
            <div class="ops-concurrency__availability">
              <Icon name="users" size="xs" />
              <strong>{{ row.available_accounts }}/{{ row.total_accounts }}</strong>
              <span>{{ row.availability_percentage }}%</span>
            </div>

            <!-- 限流账号 -->
            <UiBadge v-if="row.rate_limited_accounts > 0" tone="warning" :label="t('admin.ops.concurrency.rateLimited', { count: row.rate_limited_accounts })" />

            <!-- 异常账号 -->
            <UiBadge v-if="row.error_accounts > 0" tone="danger" :label="t('admin.ops.concurrency.errorAccounts', { count: row.error_accounts })" />

            <!-- 等待队列 -->
            <UiBadge v-if="row.waiting_in_queue > 0" tone="warning" :label="t('admin.ops.concurrency.queued', { count: row.waiting_in_queue })" />
          </div>
        </div>
      </div>

      <!-- 账号详细视图 -->
      <div v-else class="ops-concurrency__list">
        <div v-for="row in (displayRows as AccountRow[])" :key="row.key" class="ops-concurrency__row">
          <!-- 账号名称和并发 -->
          <div class="ops-concurrency__row-main">
            <div class="ops-concurrency__identity ops-concurrency__identity--stacked">
              <strong :title="row.name">
                {{ row.name }}
              </strong>
              <span>
                {{ row.group_name }}
              </span>
            </div>
            <div class="ops-concurrency__badges">
              <!-- 并发使用 -->
              <strong class="ops-concurrency__capacity"> {{ row.current_in_use }}/{{ row.max_capacity }} </strong>
              <!-- 状态徽章 -->
              <UiBadge v-if="row.is_available" tone="success" :label="t('admin.ops.accountAvailability.available')" />
              <UiBadge v-else-if="row.is_rate_limited" tone="warning" :label="formatDuration(row.rate_limit_remaining_sec || 0)" />
              <UiBadge v-else-if="row.is_overloaded" tone="danger" :label="formatDuration(row.overload_remaining_sec || 0)" />
              <UiBadge v-else-if="row.has_error" tone="danger" :label="t('admin.ops.accountAvailability.accountError')" />
              <UiBadge v-else tone="neutral" :label="t('admin.ops.accountAvailability.unavailable')" />
            </div>
          </div>

          <!-- 进度条 -->
          <UiProgressBar :value="row.load_percentage" :tone="getLoadTone(row.load_percentage)" :show-value="false" :aria-label="`${row.name} ${Math.round(row.load_percentage)}%`" />

          <!-- 等待队列 -->
          <div v-if="row.waiting_in_queue > 0" class="ops-concurrency__queue">
            <UiBadge tone="warning" :label="t('admin.ops.concurrency.queued', { count: row.waiting_in_queue })" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ops-concurrency { display: flex; height: 100%; min-height: 0; flex-direction: column; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-panel); overflow: hidden; background: var(--ui-surface); }
.ops-concurrency__header { display: flex; min-height: 48px; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--ui-border-soft); }
.ops-concurrency__title,.ops-concurrency__actions { display: flex; align-items: center; }.ops-concurrency__title { gap: 7px; margin: 0; color: var(--ui-text); font-size: 14px; line-height: 22px; }.ops-concurrency__actions { gap: 4px; }
.ops-concurrency__disabled,.ops-concurrency__empty { display: grid; min-height: 180px; flex: 1; place-items: center; }.ops-concurrency__body { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }.ops-concurrency__subheader { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 12px; border-bottom: 1px solid var(--ui-border-soft); color: var(--ui-text-muted); background: var(--ui-surface-muted); font-size: 11px; line-height: 18px; }
.ops-concurrency__list { min-height: 0; flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--ui-border) transparent; }.ops-concurrency__row { padding: 10px 12px; border-bottom: 1px solid var(--ui-border-soft); transition: background var(--ui-motion-fast); }.ops-concurrency__row:hover { background: var(--ui-surface-muted); }
.ops-concurrency__row-main,.ops-concurrency__numbers,.ops-concurrency__row-meta,.ops-concurrency__availability,.ops-concurrency__badges { display: flex; align-items: center; }.ops-concurrency__row-main { min-width: 0; justify-content: space-between; gap: 12px; margin-bottom: 7px; }.ops-concurrency__identity { display: flex; min-width: 0; flex: 1; align-items: baseline; gap: 7px; }.ops-concurrency__identity--stacked { align-items: flex-start; flex-direction: column; gap: 0; }.ops-concurrency__identity strong,.ops-concurrency__identity span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.ops-concurrency__identity strong { color: var(--ui-text); font-size: 12px; line-height: 18px; }.ops-concurrency__identity span { color: var(--ui-text-soft); font-size: 11px; line-height: 17px; }.ops-concurrency__numbers { flex: 0 0 auto; gap: 8px; color: var(--ui-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }.ops-concurrency__numbers strong,.ops-concurrency__capacity { color: var(--ui-text); font-family: var(--ui-font-mono); font-size: 11px; }.ops-concurrency__row-meta { flex-wrap: wrap; gap: 5px 10px; margin-top: 8px; }.ops-concurrency__availability { gap: 4px; color: var(--ui-text-muted); font-size: 11px; }.ops-concurrency__availability strong { color: var(--ui-success); }.ops-concurrency__badges { flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }.ops-concurrency__queue { display: flex; justify-content: flex-end; margin-top: 6px; }
@media (max-width:640px) { .ops-concurrency__header { align-items: flex-start; }.ops-concurrency__actions :first-child span:last-child { display: none; }.ops-concurrency__row-main { align-items: flex-start; flex-direction: column; }.ops-concurrency__badges { justify-content: flex-start; } }
</style>
