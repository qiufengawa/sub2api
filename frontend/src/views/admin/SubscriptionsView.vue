<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader
        :title="t('admin.subscriptions.title')"
        :description="t('admin.subscriptions.description')"
      />

      <UiServerTableWorkspace
        class="subscriptions-workspace"
        :loading="refreshing"
        :loading-text="t('common.loading')"
        :empty="false"
      >
        <template #toolbar>
          <UiTableToolbar>
            <UiFilterBar>
              <UiAsyncEntityPicker
                :model-value="filters.user_id"
                :items="filterUserOptions"
                :selected-label="selectedFilterUser?.email"
                :loading="filterUserLoading"
                :placeholder="t('admin.users.searchUsers')"
                :empty-text="t('common.noOptionsFound')"
                @search="handleFilterUserSearch"
                @update:model-value="handleFilterUserValue"
                @select="handleFilterUserSelect"
              />
              <UiSelect
                v-model="filters.status"
                :options="statusOptions"
                :placeholder="t('admin.subscriptions.allStatus')"
                density="compact"
                @change="applyFilters"
              />
              <UiButton
                type="button"
                variant="secondary"
                density="compact"
                :aria-expanded="advancedFiltersExpanded"
                aria-controls="subscription-advanced-filters"
                data-testid="subscription-advanced-toggle"
                @click="advancedFiltersExpanded = !advancedFiltersExpanded"
              >
                <template #icon><Icon name="filter" size="sm" /></template>
                {{ t('admin.subscriptions.advancedFilters') }}
                <UiBadge v-if="advancedFilterCount > 0" :label="String(advancedFilterCount)" />
              </UiButton>
            </UiFilterBar>

            <template #actions>
              <UiSegmentedControl
                :model-value="userColumnMode"
                :options="userColumnModeOptions"
                :label="t('admin.subscriptions.columns.user')"
                @update:model-value="setUserColumnMode($event as 'email' | 'username')"
              />
              <UiIconButton
                icon="refresh"
                density="compact"
                :disabled="loading"
                :label="t('common.refresh')"
                @click="loadSubscriptions"
              />
              <UiColumnPicker
                :model-value="visibleColumnKeys"
                :columns="columnPickerColumns"
                :label="t('admin.users.columnSettings')"
                @update:model-value="updateVisibleColumns"
              />
              <UiIconButton
                icon="questionCircle"
                density="compact"
                :label="t('admin.subscriptions.guide.showGuide')"
                @click="showGuideModal = true"
              />
              <UiButton variant="primary" density="compact" @click="showAssignModal = true">
                <template #icon><Icon name="plus" size="sm" /></template>
                {{ t('admin.subscriptions.assignSubscription') }}
              </UiButton>
            </template>
          </UiTableToolbar>
        </template>

        <template #filters>
          <UiFilterBar
            v-if="advancedFiltersExpanded || advancedFilterCount > 0"
            id="subscription-advanced-filters"
            data-testid="subscription-advanced-filters"
          >
            <UiSelect
              v-model="filters.group_id"
              :options="groupOptions"
              :label="t('admin.subscriptions.columns.plan')"
              :placeholder="t('admin.subscriptions.allGroups')"
              density="compact"
              @change="applyFilters"
            />
            <UiSelect
              v-model="filters.platform"
              :options="platformFilterOptions"
              :label="t('admin.subscriptions.allPlatforms')"
              :placeholder="t('admin.subscriptions.allPlatforms')"
              density="compact"
              @change="applyFilters"
            />
          </UiFilterBar>
        </template>

      <!-- Subscriptions Table -->
        <template #default>
        <UiAlert
          v-if="loadError && subscriptions.length"
          tone="danger"
          :message="t('admin.subscriptions.failedToLoad')"
        />
        <UiMobileTableScroller :label="t('admin.subscriptions.title')" min-width="1040px">
        <UiDataTable
          :columns="columns"
          :data="subscriptions"
          :loading="initialLoading"
          :mobile-table="true"
          :aria-label="t('admin.subscriptions.title')"
          :server-side-sort="true"
          default-sort-key="created_at"
          default-sort-order="desc"
          @sort="handleSort"
        >
          <template #cell-user="{ row }">
            <div class="subscription-user-cell">
              <UiAvatar :name="getUserDisplayName(row)" size="md" />
              <div>
                <strong>{{ getUserDisplayName(row) }}</strong>
                <span>#{{ row.user_id }}</span>
              </div>
            </div>
          </template>

          <template #cell-plan="{ row }">
            <div class="subscription-plan-cell">
              <p :title="row.plan_name">
                {{ row.plan_name || `#${row.plan_id}` }}
              </p>
              <div v-if="row.included_groups?.length" class="subscription-plan-cell__groups">
                <UiBadge
                  v-for="group in row.included_groups"
                  :key="group.id"
                  :title="`${group.name} · ×${group.rate_multiplier}`"
                >
                  {{ group.name }} · <span class="ui-numeric">×{{ group.rate_multiplier }}</span>
                </UiBadge>
              </div>
              <span v-else class="subscription-plan-cell__empty">
                {{ t('admin.subscriptions.noIncludedGroups') }}
              </span>
            </div>
          </template>

          <template #cell-usage="{ row }">
            <div class="subscription-quota-cell">
              <div v-if="hasAnySubscriptionQuota(row)" class="subscription-quota-list">
                <div
                  v-if="row.five_hour_quota_usd != null && row.five_hour_quota_usd > 0"
                  class="subscription-quota"
                >
                  <div class="subscription-quota__summary">
                    <span>{{ t('admin.subscriptions.fiveHour') }}</span>
                    <strong class="ui-numeric">${{ getFiveHourCommitted(row).toFixed(2) }} / ${{ row.five_hour_quota_usd.toFixed(2) }}</strong>
                  </div>
                  <UiProgressBar
                    :value="getProgressPercent(getFiveHourCommitted(row), row.five_hour_quota_usd)"
                    :tone="getProgressTone(getFiveHourCommitted(row), row.five_hour_quota_usd)"
                    :aria-label="t('admin.subscriptions.fiveHour')"
                    :show-value="false"
                  />
                  <div class="subscription-quota__meta">
                    <Icon name="clock" size="xs" />
                    <span>{{ t('admin.subscriptions.resetEveryHours', { hours: 5 }) }}</span>
                    <span v-if="(row.five_hour_reserved_usd || 0) > 0">
                      · {{ t('admin.subscriptions.reserved', { amount: Number(row.five_hour_reserved_usd).toFixed(2) }) }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="row.cycle_quota_usd != null && row.cycle_quota_usd > 0"
                  class="subscription-quota"
                >
                  <div class="subscription-quota__summary">
                    <span>{{ t('admin.subscriptions.cycle') }}</span>
                    <strong class="ui-numeric">${{ getCycleCommitted(row).toFixed(2) }} / ${{ row.cycle_quota_usd.toFixed(2) }}</strong>
                  </div>
                  <UiProgressBar
                    :value="getProgressPercent(getCycleCommitted(row), row.cycle_quota_usd)"
                    :tone="getProgressTone(getCycleCommitted(row), row.cycle_quota_usd)"
                    :aria-label="t('admin.subscriptions.cycle')"
                    :show-value="false"
                  />
                  <div v-if="row.reset_interval_seconds" class="subscription-quota__meta">
                    <Icon name="clock" size="xs" />
                    <span>{{ formatCycleInterval(row.reset_interval_seconds) }}</span>
                    <span v-if="!(row.five_hour_quota_usd != null && row.five_hour_quota_usd > 0) && (row.cycle_reserved_usd || 0) > 0">
                      · {{ t('admin.subscriptions.reserved', { amount: Number(row.cycle_reserved_usd).toFixed(2) }) }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="row.total_quota_usd != null && row.total_quota_usd > 0"
                  class="subscription-quota"
                >
                  <div class="subscription-quota__summary">
                    <span>{{ t('admin.subscriptions.total') }}</span>
                    <strong class="ui-numeric">${{ getTotalCommitted(row).toFixed(2) }} / ${{ row.total_quota_usd.toFixed(2) }}</strong>
                  </div>
                  <UiProgressBar
                    :value="getProgressPercent(getTotalCommitted(row), row.total_quota_usd)"
                    :tone="getProgressTone(getTotalCommitted(row), row.total_quota_usd)"
                    :aria-label="t('admin.subscriptions.total')"
                    :show-value="false"
                  />
                  <div class="subscription-quota__meta">
                    <Icon name="calendar" size="xs" />
                    <span>{{ t('admin.subscriptions.validUntil', { date: row.expires_at ? formatDateTimeToMinute(row.expires_at) : '-' }) }}</span>
                    <span
                      v-if="
                        !(row.five_hour_quota_usd != null && row.five_hour_quota_usd > 0) &&
                        !(row.cycle_quota_usd != null && row.cycle_quota_usd > 0) &&
                        (row.total_reserved_usd || 0) > 0
                      "
                    >
                      · {{ t('admin.subscriptions.reserved', { amount: Number(row.total_reserved_usd).toFixed(2) }) }}
                    </span>
                  </div>
                </div>
              </div>
              <UiBadge v-else tone="success" :label="`∞ ${t('admin.subscriptions.unlimited')}`" />
            </div>
          </template>

          <template #cell-expires_at="{ value }">
            <div v-if="value" class="subscription-expiry" :class="{ 'is-soon': isExpiringSoon(value) }">
              <strong class="ui-numeric">{{ formatDateTimeToMinute(value) }}</strong>
              <template
                v-for="remainingExpiry in [formatRemainingExpiry(value)]"
                :key="remainingExpiry ?? 'expired'"
              >
                <span v-if="remainingExpiry">{{ remainingExpiry }}</span>
              </template>
            </div>
            <span v-else class="subscription-muted">{{ t('admin.subscriptions.noExpiration') }}</span>
          </template>

          <template #cell-status="{ value }">
            <UiStatusBadge
              :status="getSubscriptionStatusTone(value)"
              :label="t(`admin.subscriptions.status.${value}`)"
            />
          </template>

          <template #cell-actions="{ row }">
            <UiButtonGroup>
              <UiIconButton
                v-if="row.status === 'active' || row.status === 'expired'"
                icon="calendar"
                density="mini"
                :label="t('admin.subscriptions.adjust')"
                @click="handleExtend(row)"
              />
              <UiIconButton
                v-if="row.status === 'active'"
                icon="refresh"
                variant="ghost"
                density="mini"
                :label="t('admin.subscriptions.resetQuota')"
                :disabled="resettingQuota && resettingSubscription?.id === row.id"
                @click="handleResetQuota(row)"
              />
              <UiIconButton
                v-if="row.status === 'active'"
                icon="ban"
                variant="danger"
                density="mini"
                :label="t('admin.subscriptions.revoke')"
                @click="handleRevoke(row)"
              />
              <UiIconButton
                v-if="row.status === 'revoked'"
                icon="refresh"
                variant="success"
                density="mini"
                :label="t('admin.subscriptions.restore')"
                @click="handleRestore(row)"
              />
            </UiButtonGroup>
          </template>

          <template #empty>
            <UiErrorState
              v-if="loadError"
              data-testid="subscriptions-list-error"
              :title="t('admin.subscriptions.failedToLoad')"
              :retry-text="t('common.retry')"
              @retry="loadSubscriptions"
            />
            <UiEmptyState
              v-else
              :title="t('admin.subscriptions.noSubscriptionsYet')"
              :description="t('admin.subscriptions.assignFirstSubscription')"
            >
              <template #action>
                <UiButton variant="primary" density="compact" @click="showAssignModal = true">
                  {{ t('admin.subscriptions.assignSubscription') }}
                </UiButton>
              </template>
            </UiEmptyState>
          </template>
        </UiDataTable>
        </UiMobileTableScroller>
      </template>

      <!-- Pagination -->
      <template #pagination>
        <UiPagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          :reset-page-on-page-size-change="false"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Assign Subscription Modal -->
    <UiDialog
      :show="showAssignModal"
      :title="t('admin.subscriptions.assignSubscription')"
      :close-label="t('common.close')"
      width="normal"
      @close="closeAssignModal"
    >
      <form
        id="assign-subscription-form"
        @submit.prevent="handleAssignSubscription"
        class="subscription-dialog-form"
      >
        <UiAsyncEntityPicker
          :model-value="assignForm.user_id"
          :items="assignUserOptions"
          :selected-label="selectedUser?.email"
          :loading="userSearchLoading"
          :label="t('admin.subscriptions.form.user')"
          :placeholder="t('admin.usage.searchUserPlaceholder')"
          :empty-text="t('common.noOptionsFound')"
          @search="handleAssignUserSearch"
          @update:model-value="handleAssignUserValue"
          @select="handleAssignUserSelect"
        />
        <UiSelect
          v-model="assignForm.plan_id"
          :options="planOptions"
          :label="t('admin.subscriptions.form.plan')"
          :description="t('admin.subscriptions.planHint')"
          :placeholder="t('admin.subscriptions.selectPlan')"
        >
          <template #selected="{ option }">
            <span v-if="option">{{ (option as unknown as PlanOption).label }}</span>
            <span v-else>{{ t('admin.subscriptions.selectPlan') }}</span>
          </template>
          <template #option="{ option }">
            <div class="subscription-plan-option">
              <strong>{{ (option as unknown as PlanOption).label }}</strong>
              <span>{{ (option as unknown as PlanOption).groupSummary }}</span>
            </div>
          </template>
        </UiSelect>
        <UiNumberStepper
          v-model="assignForm.validity_days"
          :label="t('admin.subscriptions.form.validityDays')"
          :min="1"
          :description="t('admin.subscriptions.validityHint')"
        />
      </form>
      <template #footer>
        <UiButton density="compact" @click="closeAssignModal">{{ t('common.cancel') }}</UiButton>
        <UiButton
          type="submit"
          form="assign-subscription-form"
          :disabled="submitting"
          :loading="submitting"
          variant="primary"
          density="compact"
        >
          {{ t('admin.subscriptions.assign') }}
        </UiButton>
      </template>
    </UiDialog>

    <!-- Adjust Subscription Modal -->
    <UiDialog
      :show="showExtendModal"
      :title="t('admin.subscriptions.adjustSubscription')"
      :close-label="t('common.close')"
      width="narrow"
      @close="closeExtendModal"
    >
      <form
        v-if="extendingSubscription"
        id="extend-subscription-form"
        @submit.prevent="handleExtendSubscription"
        class="subscription-dialog-form"
      >
        <UiDescriptionList :items="extendSummaryItems" :columns="1" />
        <UiTextField
          :model-value="extendForm.days"
          type="number"
          :label="t('admin.subscriptions.form.adjustDays')"
          :description="t('admin.subscriptions.adjustHint')"
          :placeholder="t('admin.subscriptions.adjustDaysPlaceholder')"
          required
          @update:model-value="setExtendDays"
        />
      </form>
      <template #footer>
        <template v-if="extendingSubscription">
          <UiButton density="compact" @click="closeExtendModal">{{ t('common.cancel') }}</UiButton>
          <UiButton
            type="submit"
            form="extend-subscription-form"
            :disabled="submitting"
            :loading="submitting"
            variant="primary"
            density="compact"
          >
            {{ t('admin.subscriptions.adjust') }}
          </UiButton>
        </template>
      </template>
    </UiDialog>

    <!-- Revoke Confirmation Dialog -->
    <UiConfirmDialog
      :show="showRevokeDialog"
      :title="t('admin.subscriptions.revokeSubscription')"
      :message="t('admin.subscriptions.revokeConfirm', { user: revokingSubscription?.user?.email })"
      :confirm-text="t('admin.subscriptions.revoke')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="revokePending"
      @confirm="confirmRevoke"
      @cancel="showRevokeDialog = false"
    />

    <!-- Restore Confirmation Dialog -->
    <UiConfirmDialog
      :show="showRestoreDialog"
      :title="t('admin.subscriptions.restoreSubscription')"
      :message="t('admin.subscriptions.restoreConfirm', { user: restoringSubscription?.user?.email })"
      :confirm-text="t('admin.subscriptions.restore')"
      :cancel-text="t('common.cancel')"
      :pending="restorePending"
      @confirm="confirmRestore"
      @cancel="showRestoreDialog = false"
    />

    <!-- Reset Quota Confirmation Dialog -->
    <UiConfirmDialog
      :show="showResetQuotaConfirm"
      :title="t('admin.subscriptions.resetQuotaTitle')"
      :message="t('admin.subscriptions.resetQuotaConfirm', { user: resettingSubscription?.user?.email })"
      :confirm-text="t('admin.subscriptions.resetQuota')"
      :cancel-text="t('common.cancel')"
      :pending="resettingQuota"
      @confirm="confirmResetQuota"
      @cancel="showResetQuotaConfirm = false"
    />
    <UiDialog
      :show="showGuideModal"
      :title="t('admin.subscriptions.guide.title')"
      :close-label="t('common.close')"
      :close-on-click-outside="true"
      width="wide"
      @close="showGuideModal = false"
    >
      <div class="subscription-guide">
        <p class="subscription-guide__intro">{{ t('admin.subscriptions.guide.subtitle') }}</p>
        <section class="subscription-guide__step">
          <h3>{{ t('admin.subscriptions.guide.step1.title') }}</h3>
          <ul>
            <li>{{ t('admin.subscriptions.guide.step1.line1') }}</li>
            <li>{{ t('admin.subscriptions.guide.step1.line2') }}</li>
            <li>{{ t('admin.subscriptions.guide.step1.line3') }}</li>
          </ul>
          <UiLink to="/admin/orders/plans" @click="showGuideModal = false">
            {{ t('admin.subscriptions.guide.step1.link') }}
          </UiLink>
        </section>
        <section class="subscription-guide__step">
          <h3>{{ t('admin.subscriptions.guide.step2.title') }}</h3>
          <ul>
            <li>{{ t('admin.subscriptions.guide.step2.line1') }}</li>
            <li>{{ t('admin.subscriptions.guide.step2.line2') }}</li>
            <li>{{ t('admin.subscriptions.guide.step2.line3') }}</li>
          </ul>
        </section>
        <section class="subscription-guide__step">
          <h3>{{ t('admin.subscriptions.guide.step3.title') }}</h3>
          <UiDescriptionList :items="guideDescriptionItems" :columns="1" />
        </section>
        <UiAlert tone="info">{{ t('admin.subscriptions.guide.tip') }}</UiAlert>
      </div>
      <template #footer>
        <UiButton type="button" variant="primary" density="compact" @click="showGuideModal = false">
          {{ t('common.close') }}
        </UiButton>
      </template>
    </UiDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { UserSubscription, Group } from '@/types'
import type { SubscriptionPlan } from '@/types/payment'
import type { SimpleUser } from '@/api/admin/usage'
import { formatDateTimeToMinute } from '@/utils/format'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppPage,
  AppPageHeader,
  UiAlert,
  UiAsyncEntityPicker,
  UiAvatar,
  UiBadge,
  UiButton,
  UiButtonGroup,
  UiColumnPicker,
  UiConfirmDialog,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiLink,
  UiNumberStepper,
  UiMobileTableScroller,
  UiPagination,
  UiProgressBar,
  UiSegmentedControl,
  UiServerTableWorkspace,
  UiSelect,
  UiStatusBadge,
  UiTableToolbar,
  UiTextField,
} from '@/components/ui'
import type { Column, UiEntityOption } from '@/components/ui'
import { getRemainingExpiryDuration } from '@/utils/subscriptionQuota'

const { t } = useI18n()
const appStore = useAppStore()

interface PlanOption {
  value: number
  label: string
  groupSummary: string
  [key: string]: unknown
}

// Guide modal state
const showGuideModal = ref(false)

const guideDescriptionItems = computed(() => [
  { key: 'adjust', label: t('admin.subscriptions.guide.actions.adjust'), value: t('admin.subscriptions.guide.actions.adjustDesc') },
  { key: 'reset', label: t('admin.subscriptions.guide.actions.resetQuota'), value: t('admin.subscriptions.guide.actions.resetQuotaDesc') },
  { key: 'revoke', label: t('admin.subscriptions.guide.actions.revoke'), value: t('admin.subscriptions.guide.actions.revokeDesc') }
])

// User column display mode: 'email' or 'username'
const userColumnMode = ref<'email' | 'username'>('email')
const USER_COLUMN_MODE_KEY = 'subscription-user-column-mode'

const loadUserColumnMode = () => {
  try {
    const saved = localStorage.getItem(USER_COLUMN_MODE_KEY)
    if (saved === 'email' || saved === 'username') {
      userColumnMode.value = saved
    }
  } catch (e) {
    console.error('Failed to load user column mode:', e)
  }
}

const saveUserColumnMode = () => {
  try {
    localStorage.setItem(USER_COLUMN_MODE_KEY, userColumnMode.value)
  } catch (e) {
    console.error('Failed to save user column mode:', e)
  }
}

const setUserColumnMode = (mode: 'email' | 'username') => {
  userColumnMode.value = mode
  saveUserColumnMode()
}

const userColumnModeOptions = computed(() => [
  { value: 'email', label: t('admin.users.columns.email') },
  { value: 'username', label: t('admin.users.columns.username') }
])

// All available columns
const allColumns = computed<Column[]>(() => [
  {
    key: 'user',
    label: userColumnMode.value === 'email'
      ? t('admin.subscriptions.columns.user')
      : t('admin.users.columns.username'),
    sortable: false
  },
  { key: 'plan', label: t('admin.subscriptions.columns.plan'), sortable: false },
  { key: 'usage', label: t('admin.subscriptions.columns.usage'), sortable: false },
  { key: 'expires_at', label: t('admin.subscriptions.columns.expires'), sortable: true },
  { key: 'status', label: t('admin.subscriptions.columns.status'), sortable: true },
  { key: 'actions', label: t('admin.subscriptions.columns.actions'), sortable: false }
])

// Columns that can be toggled (exclude user and actions which are always visible)
const toggleableColumns = computed(() =>
  allColumns.value.filter(col => col.key !== 'user' && col.key !== 'actions')
)

// Hidden columns set
const hiddenColumns = reactive<Set<string>>(new Set())

// Default hidden columns
const DEFAULT_HIDDEN_COLUMNS: string[] = []

// localStorage key
const HIDDEN_COLUMNS_KEY = 'subscription-hidden-columns'

// Load saved column settings
const loadSavedColumns = () => {
  try {
    const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as string[]
      parsed.forEach(key => hiddenColumns.add(key === 'group' ? 'plan' : key))
    } else {
      DEFAULT_HIDDEN_COLUMNS.forEach(key => hiddenColumns.add(key))
    }
  } catch (e) {
    console.error('Failed to load saved columns:', e)
    DEFAULT_HIDDEN_COLUMNS.forEach(key => hiddenColumns.add(key))
  }
}

// Save column settings to localStorage
const saveColumnsToStorage = () => {
  try {
    localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...hiddenColumns]))
  } catch (e) {
    console.error('Failed to save columns:', e)
  }
}

// Filtered columns for display
const columns = computed<Column[]>(() =>
  allColumns.value.filter(col =>
    col.key === 'user' || col.key === 'actions' || !hiddenColumns.has(col.key)
  )
)

const visibleColumnKeys = computed(() => columns.value.map(column => column.key))

const columnPickerColumns = computed(() => allColumns.value.map(column => ({
  key: column.key,
  label: column.label,
  required: column.key === 'user' || column.key === 'actions'
})))

const updateVisibleColumns = (keys: string[]) => {
  const selected = new Set(keys)
  toggleableColumns.value.forEach(column => {
    if (selected.has(column.key)) hiddenColumns.delete(column.key)
    else hiddenColumns.add(column.key)
  })
  saveColumnsToStorage()
}

// Filter options
const statusOptions = computed(() => [
  { value: '', label: t('admin.subscriptions.allStatus') },
  { value: 'active', label: t('admin.subscriptions.status.active') },
  { value: 'expired', label: t('admin.subscriptions.status.expired') },
  { value: 'revoked', label: t('admin.subscriptions.status.revoked') }
])

const subscriptions = ref<UserSubscription[]>([])
const groups = ref<Group[]>([])
const plans = ref<SubscriptionPlan[]>([])
const loading = ref(false)
const loadError = ref(false)
const initialLoading = computed(() => loading.value && subscriptions.value.length === 0)
const refreshing = computed(() => loading.value && subscriptions.value.length > 0)
let abortController: AbortController | null = null

// Toolbar user filter (fuzzy search -> select user_id)
const filterUserKeyword = ref('')
const filterUserResults = ref<SimpleUser[]>([])
const filterUserLoading = ref(false)
const selectedFilterUser = ref<SimpleUser | null>(null)
let filterUserSearchTimeout: ReturnType<typeof setTimeout> | null = null
let filterUserSearchSequence = 0

// User search state
const userSearchKeyword = ref('')
const userSearchResults = ref<SimpleUser[]>([])
const userSearchLoading = ref(false)
const selectedUser = ref<SimpleUser | null>(null)
let userSearchTimeout: ReturnType<typeof setTimeout> | null = null
let userSearchSequence = 0

const filters = reactive({
  status: 'active',
  group_id: '',
  platform: '',
  user_id: null as number | null
})
const advancedFiltersExpanded = ref(false)
const advancedFilterCount = computed(() => [filters.group_id, filters.platform].filter(Boolean).length)

const toUserOption = (user: SimpleUser): UiEntityOption => ({
  value: user.id,
  label: user.email,
  description: `#${user.id}${user.deleted ? ' · deleted' : ''}`
})

const filterUserOptions = computed(() => filterUserResults.value.map(toUserOption))
const assignUserOptions = computed(() => userSearchResults.value.map(toUserOption))

// Sorting state
const sortState = reactive({
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc'
})

const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
  pages: 0
})

const showAssignModal = ref(false)
const showExtendModal = ref(false)
const showRevokeDialog = ref(false)
const showRestoreDialog = ref(false)
const showResetQuotaConfirm = ref(false)
const submitting = ref(false)
const revokePending = ref(false)
const restorePending = ref(false)
const resettingSubscription = ref<UserSubscription | null>(null)
const resettingQuota = ref(false)
const extendingSubscription = ref<UserSubscription | null>(null)
const revokingSubscription = ref<UserSubscription | null>(null)
const restoringSubscription = ref<UserSubscription | null>(null)

const assignForm = reactive({
  user_id: null as number | null,
  plan_id: null as number | null,
  validity_days: 30
})

const extendForm = reactive({
  days: 30
})

const extendSummaryItems = computed(() => {
  const subscription = extendingSubscription.value
  if (!subscription) return []
  return [
    { key: 'user', label: t('admin.subscriptions.adjustingFor'), value: subscription.user?.email || `#${subscription.user_id}` },
    {
      key: 'expiration',
      label: t('admin.subscriptions.currentExpiration'),
      value: subscription.expires_at ? formatDateTimeToMinute(subscription.expires_at) : t('admin.subscriptions.noExpiration'),
    },
    ...(subscription.expires_at
      ? [{ key: 'remaining', label: t('admin.subscriptions.remainingDays'), value: String(getDaysRemaining(subscription.expires_at) ?? 0), numeric: true }]
      : []),
  ]
})

// Group options for filter (all groups)
const groupOptions = computed(() => [
  { value: '', label: t('admin.subscriptions.allGroups') },
  ...groups.value.map((g) => ({ value: g.id.toString(), label: g.name }))
])

const platformFilterOptions = computed(() => [
  { value: '', label: t('admin.subscriptions.allPlatforms') },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'antigravity', label: 'Antigravity' }
])

const planOptions = computed<PlanOption[]>(() =>
  plans.value.map((plan) => ({
    value: plan.id,
    label: plan.name,
    groupSummary: plan.included_groups.length > 0
      ? plan.included_groups.map((group) => group.name).join(' / ')
      : t('admin.subscriptions.noIncludedGroups')
  }))
)

const applyFilters = () => {
  pagination.page = 1
  loadSubscriptions()
}

const loadSubscriptions = async () => {
  if (abortController) {
    abortController.abort()
  }
  const requestController = new AbortController()
  abortController = requestController
  const { signal } = requestController

  loading.value = true
  loadError.value = false
  try {
    const response = await adminAPI.subscriptions.list(
      pagination.page,
      pagination.page_size,
      {
        status: (filters.status as any) || undefined,
        group_id: filters.group_id ? parseInt(filters.group_id) : undefined,
        platform: filters.platform || undefined,
        user_id: filters.user_id || undefined,
        sort_by: sortState.sort_by,
        sort_order: sortState.sort_order
      },
      {
        signal
      }
    )
    if (signal.aborted || abortController !== requestController) return
    subscriptions.value = response.items
    pagination.total = response.total
    pagination.pages = response.pages
    loadError.value = false
  } catch (error: any) {
    if (signal.aborted || error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
      return
    }
    loadError.value = true
    appStore.showError(t('admin.subscriptions.failedToLoad'))
    console.error('Error loading subscriptions:', error)
  } finally {
    if (abortController === requestController) {
      loading.value = false
      abortController = null
    }
  }
}

const loadGroups = async () => {
  try {
    groups.value = await adminAPI.groups.getAll()
  } catch (error) {
    console.error('Error loading groups:', error)
  }
}

const loadPlans = async () => {
  try {
    const response = await adminAPI.payment.getPlans()
    plans.value = response.data
  } catch (error) {
    console.error('Error loading subscription plans:', error)
  }
}

const handleFilterUserSearch = (value: string) => {
  filterUserKeyword.value = value
  const keyword = value.trim()

  if (selectedFilterUser.value && keyword !== selectedFilterUser.value.email) {
    selectedFilterUser.value = null
    filters.user_id = null
    applyFilters()
  }

  if (filterUserSearchTimeout) {
    clearTimeout(filterUserSearchTimeout)
  }
  filterUserSearchSequence += 1
  if (!keyword) {
    filterUserResults.value = []
    filterUserLoading.value = false
    return
  }
  filterUserSearchTimeout = setTimeout(searchFilterUsers, 300)
}

const searchFilterUsers = async () => {
  const keyword = filterUserKeyword.value.trim()
  if (!keyword) return
  const sequence = ++filterUserSearchSequence
  filterUserLoading.value = true
  try {
    const results = await adminAPI.usage.searchUsers(keyword)
    if (sequence !== filterUserSearchSequence) return
    filterUserResults.value = results
  } catch (error) {
    if (sequence !== filterUserSearchSequence) return
    console.error('Failed to search users:', error)
    filterUserResults.value = []
  } finally {
    if (sequence === filterUserSearchSequence) filterUserLoading.value = false
  }
}

const selectFilterUser = (user: SimpleUser) => {
  selectedFilterUser.value = user
  filterUserKeyword.value = user.email
  filters.user_id = user.id
  filterUserSearchSequence += 1
  applyFilters()
}

const handleFilterUserSelect = (option: UiEntityOption) => {
  const user = filterUserResults.value.find(item => item.id === Number(option.value))
  if (user) selectFilterUser(user)
}

const handleFilterUserValue = (value: string | number | null) => {
  if (value == null && (selectedFilterUser.value || filters.user_id != null)) clearFilterUser()
}

const clearFilterUser = () => {
  filterUserSearchSequence += 1
  if (filterUserSearchTimeout) clearTimeout(filterUserSearchTimeout)
  selectedFilterUser.value = null
  filterUserKeyword.value = ''
  filterUserResults.value = []
  filterUserLoading.value = false
  filters.user_id = null
  applyFilters()
}

const handleAssignUserSearch = (value: string) => {
  userSearchKeyword.value = value
  const keyword = value.trim()

  if (selectedUser.value && keyword !== selectedUser.value.email) {
    selectedUser.value = null
    assignForm.user_id = null
  }

  if (userSearchTimeout) {
    clearTimeout(userSearchTimeout)
  }
  userSearchSequence += 1
  if (!keyword) {
    userSearchResults.value = []
    userSearchLoading.value = false
    return
  }
  userSearchTimeout = setTimeout(searchUsers, 300)
}

const searchUsers = async () => {
  const keyword = userSearchKeyword.value.trim()
  if (!keyword) return
  const sequence = ++userSearchSequence
  userSearchLoading.value = true
  try {
    const results = await adminAPI.usage.searchUsers(keyword)
    if (sequence !== userSearchSequence) return
    userSearchResults.value = results
  } catch (error) {
    if (sequence !== userSearchSequence) return
    console.error('Failed to search users:', error)
    userSearchResults.value = []
  } finally {
    if (sequence === userSearchSequence) userSearchLoading.value = false
  }
}

const selectUser = (user: SimpleUser) => {
  selectedUser.value = user
  userSearchKeyword.value = user.email
  assignForm.user_id = user.id
  userSearchSequence += 1
}

const handleAssignUserSelect = (option: UiEntityOption) => {
  const user = userSearchResults.value.find(item => item.id === Number(option.value))
  if (user) selectUser(user)
}

const handleAssignUserValue = (value: string | number | null) => {
  if (value == null && (selectedUser.value || assignForm.user_id != null)) clearUserSelection()
}

const clearUserSelection = () => {
  userSearchSequence += 1
  if (userSearchTimeout) clearTimeout(userSearchTimeout)
  selectedUser.value = null
  userSearchKeyword.value = ''
  userSearchResults.value = []
  userSearchLoading.value = false
  assignForm.user_id = null
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadSubscriptions()
}

const handlePageSizeChange = (pageSize: number) => {
  pagination.page_size = pageSize
  pagination.page = 1
  loadSubscriptions()
}

const handleSort = (key: string, order: 'asc' | 'desc') => {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  loadSubscriptions()
}

const closeAssignModal = () => {
  showAssignModal.value = false
  assignForm.user_id = null
  assignForm.plan_id = null
  assignForm.validity_days = 30
  // Clear user search state
  selectedUser.value = null
  userSearchKeyword.value = ''
  userSearchResults.value = []
  userSearchLoading.value = false
  userSearchSequence += 1
}

const handleAssignSubscription = async () => {
  if (submitting.value) return
  if (!assignForm.user_id) {
    appStore.showError(t('admin.subscriptions.pleaseSelectUser'))
    return
  }
  if (!assignForm.plan_id) {
    appStore.showError(t('admin.subscriptions.pleaseSelectPlan'))
    return
  }
  if (!assignForm.validity_days || assignForm.validity_days < 1) {
    appStore.showError(t('admin.subscriptions.validityDaysRequired'))
    return
  }

  submitting.value = true
  try {
    await adminAPI.subscriptions.assign({
      user_id: assignForm.user_id,
      plan_id: assignForm.plan_id,
      validity_days: assignForm.validity_days
    })
    appStore.showSuccess(t('admin.subscriptions.subscriptionAssigned'))
    closeAssignModal()
    loadSubscriptions()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.subscriptions.failedToAssign'))
    console.error('Error assigning subscription:', error)
  } finally {
    submitting.value = false
  }
}

const handleExtend = (subscription: UserSubscription) => {
  extendingSubscription.value = subscription
  extendForm.days = 30
  showExtendModal.value = true
}

const setExtendDays = (value: string) => {
  const days = Number(value)
  extendForm.days = Number.isFinite(days) ? days : 0
}

const closeExtendModal = () => {
  showExtendModal.value = false
  extendingSubscription.value = null
}

const handleExtendSubscription = async () => {
  if (submitting.value) return
  if (!extendingSubscription.value) return

  // 前端验证：调整后的过期时间必须在未来
  if (extendingSubscription.value.expires_at) {
    const expiresAt = new Date(extendingSubscription.value.expires_at)
    const newExpiresAt = new Date(expiresAt.getTime() + extendForm.days * 24 * 60 * 60 * 1000)
    if (newExpiresAt <= new Date()) {
      appStore.showError(t('admin.subscriptions.adjustWouldExpire'))
      return
    }
  }

  submitting.value = true
  try {
    await adminAPI.subscriptions.extend(extendingSubscription.value.id, {
      days: extendForm.days
    })
    appStore.showSuccess(t('admin.subscriptions.subscriptionAdjusted'))
    closeExtendModal()
    loadSubscriptions()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.subscriptions.failedToAdjust'))
    console.error('Error adjusting subscription:', error)
  } finally {
    submitting.value = false
  }
}

const handleRevoke = (subscription: UserSubscription) => {
  revokingSubscription.value = subscription
  showRevokeDialog.value = true
}

const confirmRevoke = async () => {
  if (!revokingSubscription.value) return
  if (revokePending.value) return

  revokePending.value = true
  try {
    await adminAPI.subscriptions.revoke(revokingSubscription.value.id)
    appStore.showSuccess(t('admin.subscriptions.subscriptionRevoked'))
    showRevokeDialog.value = false
    revokingSubscription.value = null
    loadSubscriptions()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.subscriptions.failedToRevoke'))
    console.error('Error revoking subscription:', error)
  } finally {
    revokePending.value = false
  }
}

const handleRestore = (subscription: UserSubscription) => {
  restoringSubscription.value = subscription
  showRestoreDialog.value = true
}

const confirmRestore = async () => {
  if (!restoringSubscription.value) return
  if (restorePending.value) return

  restorePending.value = true
  try {
    await adminAPI.subscriptions.restore(restoringSubscription.value.id)
    appStore.showSuccess(t('admin.subscriptions.subscriptionRestored'))
    showRestoreDialog.value = false
    restoringSubscription.value = null
    loadSubscriptions()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.subscriptions.failedToRestore'))
    console.error('Error restoring subscription:', error)
  } finally {
    restorePending.value = false
  }
}

const handleResetQuota = (subscription: UserSubscription) => {
  if (resettingQuota.value) return
  resettingSubscription.value = subscription
  showResetQuotaConfirm.value = true
}

const confirmResetQuota = async () => {
  const target = resettingSubscription.value
  if (!target || resettingQuota.value) return
  resettingQuota.value = true
  try {
    await adminAPI.subscriptions.resetQuota(target.id, { daily: true, weekly: true, monthly: true })
    appStore.showSuccess(t('admin.subscriptions.quotaResetSuccess'))
    if (resettingSubscription.value?.id === target.id) {
      showResetQuotaConfirm.value = false
      resettingSubscription.value = null
    }
    await loadSubscriptions()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.subscriptions.failedToResetQuota'))
    console.error('Error resetting quota:', error)
  } finally {
    resettingQuota.value = false
  }
}

// Helper functions
const getDaysRemaining = (expiresAt: string): number | null => {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diff = expires.getTime() - now.getTime()
  if (diff < 0) return null
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const formatRemainingExpiry = (expiresAt: string): string | null => {
  const duration = getRemainingExpiryDuration(expiresAt)
  if (!duration) return null
  if (duration.unit === 'days') {
    return t('admin.subscriptions.daysRemaining', { days: duration.days })
  }
  if (duration.hours) {
    return t('admin.subscriptions.hoursMinutesRemaining', {
      hours: duration.hours,
      minutes: duration.minutes
    })
  }
  return t('admin.subscriptions.minutesRemaining', { minutes: duration.minutes })
}

const isExpiringSoon = (expiresAt: string): boolean => {
  const days = getDaysRemaining(expiresAt)
  return days !== null && days <= 7
}

const getUserDisplayName = (subscription: UserSubscription): string => {
  if (userColumnMode.value === 'username') return subscription.user?.username || '-'
  return subscription.user?.email || t('admin.redeem.userPrefix', { id: subscription.user_id })
}

const getProgressPercent = (used: number | null | undefined, limit: number | null): number => {
  if (!limit || limit === 0) return 0
  const usedValue = used ?? 0
  return Math.min((usedValue / limit) * 100, 100)
}

const getProgressTone = (
  used: number | null | undefined,
  limit: number | null
): 'neutral' | 'success' | 'warning' | 'danger' => {
  if (!limit || limit === 0) return 'neutral'
  const percentage = ((used ?? 0) / limit) * 100
  if (percentage >= 90) return 'danger'
  if (percentage >= 70) return 'warning'
  return 'success'
}

const getSubscriptionStatusTone = (status: string): string => {
  if (status === 'active') return 'active'
  if (status === 'expired') return 'warning'
  if (status === 'revoked') return 'danger'
  return status
}

const getCycleCommitted = (subscription: UserSubscription): number =>
  Math.max(0, Number(subscription.cycle_usage_usd || 0) + Number(subscription.cycle_reserved_usd || 0))

const getFiveHourCommitted = (subscription: UserSubscription): number =>
  Math.max(0, Number(subscription.five_hour_usage_usd || 0) + Number(subscription.five_hour_reserved_usd || 0))

const getTotalCommitted = (subscription: UserSubscription): number =>
  Math.max(0, Number(subscription.total_usage_usd || 0) + Number(subscription.total_reserved_usd || 0))

const hasAnySubscriptionQuota = (subscription: UserSubscription): boolean =>
  Number(subscription.five_hour_quota_usd || 0) > 0 ||
  Number(subscription.cycle_quota_usd || 0) > 0 ||
  Number(subscription.total_quota_usd || 0) > 0

const formatCycleInterval = (seconds: number): string => {
  const days = Number((seconds / 86400).toFixed(2))
  return t('admin.subscriptions.resetEveryDays', { days })
}

onMounted(() => {
  loadUserColumnMode()
  loadSavedColumns()
  loadSubscriptions()
  loadGroups()
  loadPlans()
})

onUnmounted(() => {
  abortController?.abort()
  filterUserSearchSequence += 1
  userSearchSequence += 1
  if (filterUserSearchTimeout) {
    clearTimeout(filterUserSearchTimeout)
  }
  if (userSearchTimeout) {
    clearTimeout(userSearchTimeout)
  }
})
</script>

<style scoped>
.subscriptions-workspace {
  min-width: 0;
}

.subscription-user-cell {
  display: flex;
  min-width: 180px;
  align-items: center;
  gap: 9px;
}

.subscription-user-cell > div {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.subscription-user-cell strong,
.subscription-plan-cell > p {
  margin: 0;
  overflow: hidden;
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-user-cell span,
.subscription-plan-cell__empty,
.subscription-muted {
  color: var(--ui-text-soft);
  font-size: 11px;
  line-height: 17px;
}

.subscription-plan-cell {
  width: min(320px, 30vw);
  min-width: 220px;
}

.subscription-plan-cell__groups {
  display: flex;
  max-height: 48px;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 5px;
  overflow: hidden;
}

.subscription-quota-cell {
  width: min(360px, 34vw);
  min-width: 280px;
}

.subscription-quota-list,
.subscription-dialog-form,
.subscription-guide {
  display: grid;
  gap: 14px;
}

.subscription-quota {
  display: grid;
  gap: 5px;
}

.subscription-quota__summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.subscription-quota__summary strong {
  flex: none;
  color: var(--ui-text);
  font-size: 11px;
  font-weight: 600;
}

.subscription-quota__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ui-text-soft);
  font-size: 10px;
  line-height: 15px;
}

.subscription-expiry {
  display: grid;
  gap: 2px;
  min-width: 128px;
}

.subscription-expiry strong {
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 500;
}

.subscription-expiry span {
  color: var(--ui-text-soft);
  font-size: 11px;
}

.subscription-expiry.is-soon strong,
.subscription-expiry.is-soon span {
  color: var(--ui-warning);
}

.subscription-plan-option {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.subscription-plan-option strong {
  overflow: hidden;
  color: var(--ui-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-plan-option span {
  overflow: hidden;
  color: var(--ui-text-soft);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-guide__intro {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: 21px;
}

.subscription-guide__step {
  display: grid;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--ui-border-soft);
}

.subscription-guide__step h3 {
  margin: 0;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.subscription-guide__step ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 18px;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 19px;
}

@media (max-width: 900px) {
  .subscription-plan-cell,
  .subscription-quota-cell {
    width: auto;
  }
}

@media (max-width: 640px) {
  .subscription-quota-cell {
    min-width: 260px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .subscription-quota-cell * {
    transition: none;
  }
}
</style>
