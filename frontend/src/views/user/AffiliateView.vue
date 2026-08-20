<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader
        :title="t('affiliate.title')"
        :description="t('affiliate.description')"
      />

      <div v-if="loading" class="affiliate-skeleton" data-testid="affiliate-skeleton">
        <section class="affiliate-metrics">
          <UiSkeleton v-for="index in 4" :key="index" height="96px" />
        </section>
        <UiSkeleton height="360px" />
      </div>

      <template v-else-if="detail">
        <UiLoadingOverlay :show="refreshing" :label="t('common.loading')">
        <div v-if="loadError" class="affiliate-retry-banner">
          <UiBanner tone="danger" :message="loadError" />
          <UiButton density="dense" @click="loadAffiliateDetail()">{{ t('common.retry') }}</UiButton>
        </div>
        <section class="affiliate-metrics">
          <UiStatMetric
            :label="t('affiliate.stats.rebateRate')"
            :value="formattedRebateRate"
            unit="%"
            :context="t('affiliate.stats.rebateRateHint')"
          />
          <UiStatMetric :label="t('affiliate.stats.invitedUsers')" :value="formatCount(detail.aff_count)" />
          <UiStatMetric :label="t('affiliate.stats.availableQuota')" :value="formatCurrency(detail.aff_quota)" />
          <UiStatMetric
            :label="t('affiliate.stats.totalQuota')"
            :value="formatCurrency(detail.aff_history_quota)"
            :context="detail.aff_frozen_quota > 0 ? t('affiliate.stats.frozenQuota') + ': ' + formatCurrency(detail.aff_frozen_quota) : undefined"
          />
        </section>

        <section data-testid="affiliate-workspace" class="affiliate-workspace">
          <AppSection :title="t('affiliate.yourCode')" divided>
            <div class="affiliate-value-row">
              <code class="affiliate-value" :title="detail.aff_code">{{ detail.aff_code }}</code>
              <UiButton density="compact" variant="secondary" @click="copyCode">
                <template #icon><Icon name="copy" size="sm" /></template>
                {{ t('affiliate.copyCode') }}
              </UiButton>
            </div>
            <div class="affiliate-value-row">
              <code class="affiliate-value" :title="inviteLink">{{ inviteLink }}</code>
              <UiButton density="compact" variant="secondary" @click="copyInviteLink">
                <template #icon><Icon name="copy" size="sm" /></template>
                {{ t('affiliate.copyLink') }}
              </UiButton>
            </div>
          </AppSection>

          <AppSection :title="t('affiliate.tips.title')" divided>
            <ol class="affiliate-tips">
              <li>{{ t('affiliate.tips.line1') }}</li>
              <li>{{ t('affiliate.tips.line2', { rate: formattedRebateRate + '%' }) }}</li>
              <li>{{ t('affiliate.tips.line3') }}</li>
              <li v-if="detail.aff_frozen_quota > 0">{{ t('affiliate.tips.line4') }}</li>
            </ol>
          </AppSection>

          <AppSection divided>
          <div class="affiliate-transfer">
            <div>
              <h2>{{ t('affiliate.transfer.title') }}</h2>
              <p>{{ t('affiliate.transfer.description') }}</p>
              <UiBadge v-if="detail.aff_quota <= 0" :label="t('affiliate.transfer.empty')" tone="warning" />
            </div>
            <UiButton
              variant="primary"
              density="compact"
              :disabled="transferring || detail.aff_quota <= 0"
              :loading="transferring"
              @click="requestTransferQuota"
            >
              <template v-if="!transferring" #icon><Icon name="dollar" size="sm" /></template>
              {{ transferring ? t('affiliate.transfer.transferring') : t('affiliate.transfer.button') }}
            </UiButton>
          </div>
          </AppSection>

          <AppSection :title="t('affiliate.invitees.title')">
            <UiEmptyState
              v-if="detail.invitees.length === 0"
              :title="t('affiliate.invitees.empty')"
              icon="users"
            />
            <UiMobileTableScroller v-else min-width="560px" :label="t('affiliate.invitees.title')">
              <UiDataTable
                :columns="inviteeColumns"
                :data="detail.invitees"
                mobile-table
                :aria-label="t('affiliate.invitees.title')"
              >
                <template #cell-email="{ row }">
                  <span>{{ row.email || '-' }}</span>
                </template>
                <template #cell-username="{ row }">
                  <span>{{ row.username || '-' }}</span>
                </template>
                <template #cell-total_rebate="{ row }">
                  <span class="affiliate-number">{{ formatCurrency(row.total_rebate) }}</span>
                </template>
                <template #cell-created_at="{ row }">
                  <span>{{ formatDateTime(row.created_at) || '-' }}</span>
                </template>
              </UiDataTable>
            </UiMobileTableScroller>
          </AppSection>
        </section>
        </UiLoadingOverlay>
      </template>

      <UiErrorState
        v-else
        data-testid="affiliate-load-error"
        :title="t('affiliate.loadFailed')"
        :description="t('common.retryLater')"
        :retry-text="t('common.retry')"
        @retry="loadAffiliateDetail()"
      />
    </AppPage>

    <UiConfirmDialog
      :show="showTransferConfirm"
      :title="t('affiliate.transfer.confirmTitle')"
      :message="t('affiliate.transfer.confirmMessage', { amount: transferConfirmAmount })"
      :confirm-text="t('affiliate.transfer.confirmButton')"
      :cancel-text="t('common.cancel')"
      danger
      :pending="transferring"
      @confirm="transferQuota"
      @cancel="showTransferConfirm = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  UiBadge,
  UiBanner,
  UiButton,
  UiConfirmDialog,
  UiDataTable,
  UiEmptyState,
  UiErrorState,
  UiLoadingOverlay,
  UiMobileTableScroller,
  UiSkeleton,
  UiStatMetric,
  type Column,
} from '@/components/ui'
import userAPI from '@/api/user'
import type { UserAffiliateDetail } from '@/types'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useClipboard } from '@/composables/useClipboard'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const { copyToClipboard } = useClipboard()

const loading = ref(true)
const refreshing = ref(false)
const loadError = ref<string | null>(null)
const transferring = ref(false)
const showTransferConfirm = ref(false)
const detail = ref<UserAffiliateDetail | null>(null)

const inviteeColumns = computed<Column[]>(() => [
  { key: 'email', label: t('affiliate.invitees.columns.email') },
  { key: 'username', label: t('affiliate.invitees.columns.username') },
  { key: 'total_rebate', label: t('affiliate.invitees.columns.rebate') },
  { key: 'created_at', label: t('affiliate.invitees.columns.joinedAt') },
])

const transferConfirmAmount = computed(() => formatCurrency(detail.value?.aff_quota ?? 0))

const inviteLink = computed(() => {
  if (!detail.value) return ''
  if (typeof window === 'undefined') return `/register?aff=${encodeURIComponent(detail.value.aff_code)}`
  return `${window.location.origin}/register?aff=${encodeURIComponent(detail.value.aff_code)}`
})

// Rebate rate is a percentage in the range [0, 100]; backend already clamps it.
// We trim trailing zeros (e.g. 20.00 → "20", 12.50 → "12.5") for a cleaner UI.
const formattedRebateRate = computed(() => {
  const v = detail.value?.effective_rebate_rate_percent ?? 0
  const rounded = Math.round(v * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString()
})

function formatCount(value: number): string {
  return value.toLocaleString()
}

async function loadAffiliateDetail(silent = false): Promise<void> {
  if (!silent) {
    loading.value = true
  } else {
    refreshing.value = true
  }
  loadError.value = null
  try {
    detail.value = await userAPI.getAffiliateDetail()
  } catch (error) {
    loadError.value = extractApiErrorMessage(error, t('affiliate.loadFailed'))
    appStore.showError(loadError.value)
  } finally {
    if (!silent) {
      loading.value = false
    }
    refreshing.value = false
  }
}

async function copyCode(): Promise<void> {
  if (!detail.value?.aff_code) return
  await copyToClipboard(detail.value.aff_code, t('affiliate.codeCopied'))
}

async function copyInviteLink(): Promise<void> {
  if (!inviteLink.value) return
  await copyToClipboard(inviteLink.value, t('affiliate.linkCopied'))
}

function requestTransferQuota(): void {
  if (!detail.value || detail.value.aff_quota <= 0 || transferring.value) return
  showTransferConfirm.value = true
}

async function transferQuota(): Promise<void> {
  if (!detail.value || detail.value.aff_quota <= 0 || transferring.value) return
  transferring.value = true
  try {
    const resp = await userAPI.transferAffiliateQuota()
    appStore.showSuccess(t('affiliate.transfer.success', { amount: formatCurrency(resp.transferred_quota) }))
    await Promise.all([
      loadAffiliateDetail(true),
      authStore.refreshUser().catch(() => undefined),
    ])
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('affiliate.transferFailed')))
  } finally {
    transferring.value = false
    showTransferConfirm.value = false
  }
}

onMounted(() => {
  void loadAffiliateDetail()
})
</script>

<style scoped>
.affiliate-skeleton { display: grid; gap: 16px; }
.affiliate-retry-banner { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding-top: 16px; }
.affiliate-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding-top: 16px; }
.affiliate-workspace { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; gap: 0; margin-top: 8px; }
.affiliate-value-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; min-width: 0; padding-top: 4px; }
.affiliate-value { min-width: 0; overflow: hidden; color: var(--ui-text); font-family: var(--ui-font-mono); font-size: 12px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.affiliate-tips { display: grid; gap: 6px; margin: 0; padding-left: 18px; color: var(--ui-text-muted); font-size: 13px; line-height: 20px; }
.affiliate-transfer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.affiliate-transfer > div { display: grid; min-width: 0; gap: 4px; }
.affiliate-transfer h2, .affiliate-transfer p { margin: 0; }
.affiliate-transfer h2 { color: var(--ui-text); font-size: 14px; font-weight: 600; line-height: 22px; }
.affiliate-transfer p { color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.affiliate-number { font-variant-numeric: tabular-nums; }
@media (max-width: 900px) { .affiliate-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .affiliate-metrics { grid-template-columns: 1fr; } .affiliate-retry-banner { grid-template-columns: minmax(0, 1fr); } .affiliate-transfer { align-items: stretch; flex-direction: column; } .affiliate-transfer .ui-button { align-self: flex-start; } .affiliate-value-row { grid-template-columns: minmax(0, 1fr); } }
</style>
