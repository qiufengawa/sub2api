<template>
  <UiDialog
    :show="show"
    :title="t('admin.users.platformQuota.title')"
    width="wide"
    @close="$emit('close')"
  >
    <div v-if="user" class="platform-quota">
      <UiAlert v-if="hasActiveSubscription" tone="warning">
        {{ t('admin.users.platformQuota.subscriptionWarning') }}
      </UiAlert>
      <p class="platform-quota__subtitle">
        {{ t('admin.users.platformQuota.subtitle', { email: user.email }) }}
      </p>
      <UiDataTable
        :columns="columns"
        :data="quotas"
        :loading="loading"
        :mobile-table="true"
        row-key="platform"
        :aria-label="t('admin.users.platformQuota.title')"
      >
        <template #cell-platform="{ row }">
          <span class="platform-quota__platform">{{ row.platform }}</span>
        </template>
        <template #cell-daily="{ row }">
          <PlatformQuotaLimitControl
            :model-value="row.daily_limit_usd"
            :placeholder="t('admin.users.platformQuota.placeholder')"
            :reset-label="t('admin.users.platformQuota.reset.button')"
            :resetting="!!resetting[`${row.platform}.daily`]"
            @update:model-value="updateLimit(row, 'daily', String($event))"
            @reset="onReset(row.platform, 'daily')"
          />
        </template>
        <template #cell-weekly="{ row }">
          <PlatformQuotaLimitControl
            :model-value="row.weekly_limit_usd"
            :placeholder="t('admin.users.platformQuota.placeholder')"
            :reset-label="t('admin.users.platformQuota.reset.button')"
            :resetting="!!resetting[`${row.platform}.weekly`]"
            @update:model-value="updateLimit(row, 'weekly', String($event))"
            @reset="onReset(row.platform, 'weekly')"
          />
        </template>
        <template #cell-monthly="{ row }">
          <PlatformQuotaLimitControl
            :model-value="row.monthly_limit_usd"
            :placeholder="t('admin.users.platformQuota.placeholder')"
            :reset-label="t('admin.users.platformQuota.reset.button')"
            :resetting="!!resetting[`${row.platform}.monthly`]"
            @update:model-value="updateLimit(row, 'monthly', String($event))"
            @reset="onReset(row.platform, 'monthly')"
          />
        </template>
        <template #cell-usage="{ row }">
          <span class="platform-quota__usage">
            {{ formatUsage(row.daily_usage_usd) }} / {{ formatUsage(row.weekly_usage_usd) }} / {{ formatUsage(row.monthly_usage_usd) }}
          </span>
        </template>
      </UiDataTable>
      <div class="platform-quota__tools">
        <p>{{ t('admin.users.platformQuota.hint') }}</p>
        <UiButton type="button" density="compact" variant="danger" @click="onClearAll">
          {{ t('admin.users.platformQuota.clearAll') }}
        </UiButton>
      </div>
    </div>
    <template #footer>
      <UiButton density="compact" type="button" @click="$emit('close')">{{ t('admin.users.platformQuota.cancel') }}</UiButton>
      <UiButton density="compact" type="button" variant="primary" :loading="submitting" :disabled="loading" @click="onSave">
        {{ submitting ? t('admin.users.platformQuota.saving') : t('admin.users.platformQuota.save') }}
      </UiButton>
    </template>
  </UiDialog>

  <UiConfirmDialog
    :show="confirmOpen"
    :title="t('admin.users.platformQuota.title')"
    :message="confirmMessage"
    :confirm-text="t('common.confirm')"
    :cancel-text="t('common.cancel')"
    :pending="confirmPending"
    danger
    @confirm="confirmAction"
    @cancel="cancelConfirmation"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser, PlatformQuotaItem, PlatformQuotaPlatform, PlatformQuotaWindow } from '@/types'
import {
  UiAlert,
  UiButton,
  UiConfirmDialog,
  UiDataTable,
  UiDialog,
  type Column,
} from '@/components/ui'
import PlatformQuotaLimitControl from './PlatformQuotaLimitControl.vue'

const props = defineProps<{ show: boolean; user: AdminUser | null }>()
const emit = defineEmits(['close', 'success'])

const { t } = useI18n()
const appStore = useAppStore()

const PLATFORMS: PlatformQuotaPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok']

interface QuotaRow {
  platform: PlatformQuotaPlatform
  daily_limit_usd: number | null
  weekly_limit_usd: number | null
  monthly_limit_usd: number | null
  daily_usage_usd: number
  weekly_usage_usd: number
  monthly_usage_usd: number
}

const hasActiveSubscription = computed(() =>
  props.user?.subscriptions?.some((s) => s.status === 'active') ?? false
)

const loading = ref(false)
const submitting = ref(false)
const resetting = reactive<Record<string, boolean>>({})
const quotas = ref<QuotaRow[]>([])
const confirmOpen = ref(false)
const confirmMessage = ref('')
const pendingAction = ref<
  | { type: 'clear-all' }
  | { type: 'reset'; platform: PlatformQuotaPlatform; quotaWindow: PlatformQuotaWindow; windowLabel: string }
  | null
>(null)
const confirmPending = computed(() => {
  const action = pendingAction.value
  return action?.type === 'reset' && !!resetting[`${action.platform}.${action.quotaWindow}`]
})

const columns = computed<Column[]>(() => [
  { key: 'platform', label: t('admin.users.platformQuota.columns.platform'), class: 'min-w-[128px]' },
  { key: 'daily', label: t('admin.users.platformQuota.columns.daily'), class: 'min-w-[190px]' },
  { key: 'weekly', label: t('admin.users.platformQuota.columns.weekly'), class: 'min-w-[190px]' },
  { key: 'monthly', label: t('admin.users.platformQuota.columns.monthly'), class: 'min-w-[190px]' },
  { key: 'usage', label: t('admin.users.platformQuota.columns.usage'), class: 'min-w-[210px]' },
])

function emptyRow(p: PlatformQuotaPlatform): QuotaRow {
  return {
    platform: p,
    daily_limit_usd: null,
    weekly_limit_usd: null,
    monthly_limit_usd: null,
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
  }
}

function normalize(items: PlatformQuotaItem[]): QuotaRow[] {
  const byPlatform = new Map<PlatformQuotaPlatform, PlatformQuotaItem>()
  for (const it of items) byPlatform.set(it.platform, it)
  return PLATFORMS.map((p) => {
    const it = byPlatform.get(p)
    if (!it) return emptyRow(p)
    return {
      platform: p,
      daily_limit_usd: it.daily_limit_usd ?? null,
      weekly_limit_usd: it.weekly_limit_usd ?? null,
      monthly_limit_usd: it.monthly_limit_usd ?? null,
      daily_usage_usd: it.daily_usage_usd ?? 0,
      weekly_usage_usd: it.weekly_usage_usd ?? 0,
      monthly_usage_usd: it.monthly_usage_usd ?? 0,
    }
  })
}

function formatUsage(n: number): string {
  if (n == null || Number.isNaN(n)) return '-'
  return n.toFixed(2)
}

function updateLimit(row: QuotaRow, window: 'daily' | 'weekly' | 'monthly', value: string) {
  row[`${window}_limit_usd`] = value.trim() === '' ? null : Number(value)
}

async function load() {
  if (!props.user) return
  loading.value = true
  try {
    const data = await adminAPI.users.getPlatformQuotas(props.user.id)
    quotas.value = normalize(data.platform_quotas || [])
  } catch {
    appStore.showError(t('admin.users.platformQuota.loadFailed'))
    quotas.value = PLATFORMS.map(emptyRow)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (s) => { if (s && props.user) load() },
)

function onClearAll() {
  pendingAction.value = { type: 'clear-all' }
  confirmMessage.value = t('admin.users.platformQuota.clearAllConfirm')
  confirmOpen.value = true
}

function clearAllLimits() {
  for (const row of quotas.value) {
    row.daily_limit_usd = null
    row.weekly_limit_usd = null
    row.monthly_limit_usd = null
  }
}

async function onSave() {
  if (!props.user) return
  // 校验所有 input：v-model.number 在用户输入"0."等中间状态时会写回 NaN，
  // 之前的 normalizeLimit(NaN) 静默返回 null（"无限制"），把"有限额"配置悄悄改成"无限制"。
  // 这里在 save 前显式检测 NaN，提示用户修正后再提交。
  const invalid: string[] = []
  for (const row of quotas.value) {
    for (const win of ['daily', 'weekly', 'monthly'] as const) {
      const v = row[`${win}_limit_usd` as const]
      if (typeof v === 'number' && Number.isNaN(v)) {
        invalid.push(`${row.platform}.${win}`)
      }
    }
  }
  if (invalid.length > 0) {
    appStore.showError(t('admin.users.platformQuota.invalidNumber', { fields: invalid.join(', ') }))
    return
  }

  submitting.value = true
  try {
    const payload = quotas.value.map((r) => ({
      platform: r.platform,
      daily_limit_usd: normalizeLimit(r.daily_limit_usd),
      weekly_limit_usd: normalizeLimit(r.weekly_limit_usd),
      monthly_limit_usd: normalizeLimit(r.monthly_limit_usd),
    }))
    await adminAPI.users.updatePlatformQuotas(props.user.id, payload)
    appStore.showSuccess(t('admin.users.platformQuota.updateSuccess'))
    emit('success')
    emit('close')
  } catch (e: any) {
    appStore.showError(e?.response?.data?.message || t('admin.users.platformQuota.updateFailed'))
  } finally {
    submitting.value = false
  }
}

// 仅在合法输入下返回数字：null/undefined/NaN/±Inf/负数 → null（视为"无限额"）。
// 调用方负责在 NaN 路径上做单独的用户提示（见 onSave）。
function normalizeLimit(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
  return null
}

async function onReset(platform: PlatformQuotaPlatform, quotaWindow: PlatformQuotaWindow) {
  if (!props.user) return
  const windowLabel = t(`admin.users.platformQuota.window${quotaWindow.charAt(0).toUpperCase() + quotaWindow.slice(1)}`)
  pendingAction.value = { type: 'reset', platform, quotaWindow, windowLabel }
  confirmMessage.value = t('admin.users.platformQuota.reset.confirm', { platform, window: windowLabel })
  confirmOpen.value = true
}

function cancelConfirmation() {
  if (confirmPending.value) return
  confirmOpen.value = false
  confirmMessage.value = ''
  pendingAction.value = null
}

async function confirmAction() {
  const action = pendingAction.value
  if (!action || confirmPending.value) return
  if (action.type === 'clear-all') {
    clearAllLimits()
    cancelConfirmation()
    return
  }
  await resetQuotaWindow(action.platform, action.quotaWindow, action.windowLabel)
}

async function resetQuotaWindow(
  platform: PlatformQuotaPlatform,
  quotaWindow: PlatformQuotaWindow,
  windowLabel: string,
) {
  if (!props.user) return
  const key = `${platform}.${quotaWindow}`
  resetting[key] = true
  try {
    const data = await adminAPI.users.resetPlatformQuotaWindow(props.user.id, platform, quotaWindow)
    quotas.value = normalize(data.platform_quotas || [])
    appStore.showSuccess(t('admin.users.platformQuota.reset.success', { platform, window: windowLabel }))
    resetting[key] = false
    cancelConfirmation()
  } catch (e: any) {
    appStore.showError(e?.response?.data?.message || t('admin.users.platformQuota.reset.failed'))
  } finally {
    resetting[key] = false
  }
}
</script>

<style scoped>
.platform-quota{display:grid;gap:16px}.platform-quota__subtitle{margin:0;color:var(--ui-text-muted);font-size:13px;line-height:20px}.platform-quota__platform{font-family:var(--ui-font-mono);font-size:12px}.platform-quota__usage{color:var(--ui-text-muted);font-family:var(--ui-font-mono);font-size:12px;white-space:nowrap}.platform-quota__tools{display:flex;align-items:center;justify-content:space-between;gap:12px}.platform-quota__tools p{margin:0;color:var(--ui-text-soft);font-size:12px;line-height:18px}@media(max-width:640px){.platform-quota__tools{align-items:stretch;flex-direction:column}.platform-quota__tools :deep(button){align-self:flex-start}}
</style>
