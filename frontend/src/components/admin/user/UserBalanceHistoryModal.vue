<template>
  <UiDialog
    :show="show"
    :title="t('admin.users.balanceHistoryTitle')"
    width="wide"
    :close-on-click-outside="true"
    @close="emit('close')"
  >
    <div v-if="user" class="balance-history">
      <UiDescriptionList :items="summaryItems" :columns="2" />

      <div class="balance-history__toolbar">
        <UiSelect
          v-model="typeFilter"
          :options="typeOptions"
          density="compact"
          @change="loadHistory(1)"
        />
        <div v-if="!hideActions" class="balance-history__actions">
          <UiButton density="compact" @click="emit('deposit')">
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('admin.users.deposit') }}
          </UiButton>
          <UiButton density="compact" @click="emit('withdraw')">
            <template #icon><Icon name="minus" size="sm" /></template>
            {{ t('admin.users.withdraw') }}
          </UiButton>
        </div>
      </div>

      <UiErrorState
        v-if="loadError"
        :title="t('admin.users.failedToLoadBalanceHistory')"
        :retry-text="t('common.retry')"
        @retry="loadHistory(currentPage)"
      />
      <UiDataTable
        v-else
        :columns="columns"
        :data="history"
        :loading="loading"
        :mobile-table="true"
        row-key="id"
        :aria-label="t('admin.users.balanceHistoryTitle')"
      >
        <template #cell-type="{ row }">
          <div class="balance-history__event">
            <strong>{{ getItemTitle(row) }}</strong>
            <span v-if="row.notes" :title="row.notes">{{ truncate(row.notes) }}</span>
          </div>
        </template>
        <template #cell-value="{ row }">
          <span
            class="balance-history__value"
            :class="row.value >= 0 ? 'is-positive' : 'is-negative'"
          >
            {{ formatValue(row) }}
          </span>
        </template>
        <template #cell-source="{ row }">
          <UiBadge v-if="isAdminType(row.type)">{{ t('redeem.adminAdjustment') }}</UiBadge>
          <code v-else>{{ row.code ? `${row.code.slice(0, 8)}...` : '-' }}</code>
        </template>
        <template #cell-created_at="{ row }">
          <span class="balance-history__date">{{ formatDateTime(row.used_at || row.created_at) }}</span>
        </template>
        <template #empty>
          <UiEmptyState :title="t('admin.users.noBalanceHistory')" />
        </template>
      </UiDataTable>

      <UiPagination
        v-if="total > pageSize"
        :total="total"
        :page="currentPage"
        :page-size="pageSize"
        :show-page-size-selector="false"
        @update:page="loadHistory"
      />
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI, type BalanceHistoryItem } from '@/api/admin'
import type { AdminUser } from '@/types'
import { formatDateTime } from '@/utils/format'
import Icon from '@/components/icons/Icon.vue'
import {
  UiBadge,
  UiButton,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiPagination,
  UiSelect,
  type Column,
} from '@/components/ui'

const props = defineProps<{ show: boolean; user: AdminUser | null; hideActions?: boolean }>()
const emit = defineEmits<{ close: []; deposit: []; withdraw: [] }>()
const { t } = useI18n()

const history = ref<BalanceHistoryItem[]>([])
const loading = ref(false)
const loadError = ref<unknown>(null)
const currentPage = ref(1)
const total = ref(0)
const totalRecharged = ref(0)
const pageSize = 15
const typeFilter = ref('')
let loadSequence = 0

const columns = computed<Column[]>(() => [
  { key: 'type', label: t('admin.users.balanceHistoryColumns.type'), class: 'min-w-[240px]' },
  { key: 'value', label: t('admin.users.balanceHistoryColumns.value'), class: 'min-w-[140px]' },
  { key: 'source', label: t('admin.users.balanceHistoryColumns.source'), class: 'min-w-[150px]' },
  { key: 'created_at', label: t('admin.users.balanceHistoryColumns.time'), class: 'min-w-[170px]' },
])

const summaryItems = computed(() => [
  { label: t('admin.users.email'), value: props.user?.email || '' },
  { label: t('admin.users.currentBalance'), value: `$${(props.user?.balance || 0).toFixed(2)}`, numeric: true },
  { label: t('admin.users.createdAt'), value: props.user?.created_at ? formatDateTime(props.user.created_at) : '-' },
  { label: t('admin.users.totalRecharged'), value: `$${totalRecharged.value.toFixed(2)}`, numeric: true },
  ...(props.user?.notes ? [{ label: t('admin.users.notes'), value: props.user.notes }] : []),
])

const typeOptions = computed(() => [
  { value: '', label: t('admin.users.allTypes') },
  { value: 'balance', label: t('admin.users.typeBalance') },
  { value: 'affiliate_balance', label: t('admin.users.typeAffiliateBalance') },
  { value: 'admin_balance', label: t('admin.users.typeAdminBalance') },
  { value: 'concurrency', label: t('admin.users.typeConcurrency') },
  { value: 'admin_concurrency', label: t('admin.users.typeAdminConcurrency') },
  { value: 'subscription', label: t('admin.users.typeSubscription') },
])

watch(
  [() => props.show, () => props.user?.id],
  ([show, userId], previous) => {
    if (show && userId) {
      if (!previous || previous[1] !== userId) typeFilter.value = ''
      loadHistory(1)
    } else if (!show) {
      loadSequence += 1
      history.value = []
    }
  },
  { immediate: true },
)

async function loadHistory(page: number) {
  const userId = props.user?.id
  if (!userId) return
  const sequence = ++loadSequence
  loading.value = true
  loadError.value = null
  currentPage.value = page
  try {
    const response = await adminAPI.users.getUserBalanceHistory(
      userId,
      page,
      pageSize,
      typeFilter.value || undefined,
    )
    if (sequence !== loadSequence || !props.show || props.user?.id !== userId) return
    history.value = response.items || []
    total.value = response.total || 0
    totalRecharged.value = response.total_recharged || 0
  } catch (error) {
    if (sequence !== loadSequence) return
    history.value = []
    loadError.value = error
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function isAdminType(type: string): boolean {
  return type === 'admin_balance' || type === 'admin_concurrency'
}

function isBalanceType(type: string): boolean {
  return type === 'balance' || type === 'admin_balance' || type === 'affiliate_balance'
}

function isSubscriptionType(type: string): boolean {
  return type === 'subscription'
}

function getItemTitle(item: BalanceHistoryItem): string {
  switch (item.type) {
    case 'balance': return t('redeem.balanceAddedRedeem')
    case 'affiliate_balance': return t('redeem.balanceAddedAffiliate')
    case 'admin_balance': return item.value >= 0 ? t('redeem.balanceAddedAdmin') : t('redeem.balanceDeductedAdmin')
    case 'concurrency': return t('redeem.concurrencyAddedRedeem')
    case 'admin_concurrency': return item.value >= 0 ? t('redeem.concurrencyAddedAdmin') : t('redeem.concurrencyReducedAdmin')
    case 'subscription': return t('redeem.subscriptionAssigned')
    default: return t('common.unknown')
  }
}

function formatValue(item: BalanceHistoryItem): string {
  if (isBalanceType(item.type)) {
    return `${item.value >= 0 ? '+' : ''}$${item.value.toFixed(2)}`
  }
  if (isSubscriptionType(item.type)) {
    const days = item.validity_days || Math.round(item.value)
    const groupName = item.group?.name || ''
    return groupName ? `${days}d - ${groupName}` : `${days}d`
  }
  return `${item.value >= 0 ? '+' : ''}${item.value}`
}

function truncate(value: string): string {
  return value.length > 60 ? `${value.slice(0, 55)}...` : value
}
</script>

<style scoped>
.balance-history{display:grid;gap:16px}.balance-history__toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px}.balance-history__toolbar>.ui-form-field{width:min(260px,100%)}.balance-history__actions{display:flex;gap:8px}.balance-history__event{display:grid;gap:2px}.balance-history__event strong{font-size:13px;font-weight:600}.balance-history__event span{max-width:320px;color:var(--ui-text-muted);font-size:11px}.balance-history__value{font-family:var(--font-mono);font-size:12px;font-weight:600}.balance-history__value.is-positive{color:var(--ui-success)}.balance-history__value.is-negative{color:var(--ui-danger)}.balance-history code,.balance-history__date{color:var(--ui-text-muted);font-family:var(--font-mono);font-size:11px;white-space:nowrap}@media(max-width:640px){.balance-history__toolbar{align-items:stretch;flex-direction:column}.balance-history__actions{width:100%}}
</style>
