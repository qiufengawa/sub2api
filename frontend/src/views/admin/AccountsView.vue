<template>
  <AppLayout>
    <AppPage class="accounts-page" density="compact">
      <AppPageHeader
        :title="t('admin.accounts.title')"
        :description="t('admin.accounts.description')"
      />
      <UiServerTableWorkspace class="accounts-workspace">
        <template #toolbar>
          <UiTableToolbar>
            <AccountTableFilters
              v-model:searchQuery="params.search"
              :filters="params"
              :groups="groups"
              @update:filters="(newFilters) => Object.assign(params, newFilters)"
              @change="debouncedReload"
              @update:searchQuery="debouncedReload"
            />
            <template #actions>
              <AccountTableActions
                :loading="loading"
                @refresh="handleManualRefresh"
                @create="showCreate = true"
              >
            <template #after>
              <!-- Auto Refresh Dropdown -->
              <UiPopover
                placement="bottom-end"
                panel-role="dialog"
                :aria-label="t('admin.accounts.autoRefresh')"
                width="min(280px, calc(100vw - 16px))"
                @open-change="showAutoRefreshDropdown = $event"
              >
                <template #trigger="{ open }">
                  <UiButton
                    density="compact"
                    variant="secondary"
                    :title="t('admin.accounts.autoRefresh')"
                    :aria-expanded="open"
                    aria-haspopup="dialog"
                  >
                    <template #icon>
                      <Icon name="refresh" size="sm" :class="{ 'accounts-spin': autoRefreshEnabled }" />
                    </template>
                    <span class="accounts-action-label">
                      {{
                        autoRefreshEnabled
                          ? t('admin.accounts.autoRefreshCountdown', { seconds: autoRefreshCountdown })
                          : t('admin.accounts.autoRefresh')
                      }}
                    </span>
                  </UiButton>
                </template>
                <div class="accounts-auto-refresh-popover" @click.stop>
                  <UiSwitch
                    :model-value="autoRefreshEnabled"
                    :label="t('admin.accounts.enableAutoRefresh')"
                    @update:model-value="setAutoRefreshEnabled"
                  />
                  <UiDivider />
                  <UiRadioGroup
                    :model-value="autoRefreshIntervalSeconds"
                    :options="autoRefreshIntervalOptions"
                    name="account-auto-refresh-interval"
                    :label="t('admin.accounts.autoRefresh')"
                    layout="stacked"
                    @update:model-value="handleAutoRefreshIntervalChange"
                  />
                </div>
              </UiPopover>

              <!-- More Tools Dropdown -->
              <UiPopover
                placement="bottom-end"
                panel-role="dialog"
                :aria-label="t('admin.accounts.moreActions')"
                width="min(320px, calc(100vw - 16px))"
                @open-change="showAccountToolsDropdown = $event"
              >
                <template #trigger="{ open }">
                  <UiButton
                    density="compact"
                    variant="secondary"
                    :title="t('admin.accounts.moreActions')"
                    :aria-expanded="open"
                    aria-haspopup="dialog"
                  >
                    <template #icon><Icon name="more" size="sm" /></template>
                    <span class="accounts-action-label">{{ t('admin.accounts.moreActions') }}</span>
                    <Icon name="chevronDown" size="xs" class="accounts-action-label" />
                  </UiButton>
                </template>
                <template #default="{ close }">
                  <div class="accounts-tools-popover" @click.stop>
                    <UiDivider>{{ t('admin.accounts.dataActions') }}</UiDivider>
                    <UiButton block density="compact" variant="quiet" @click="close(); openSyncFromCrs()">
                      <template #icon><Icon name="sync" size="sm" /></template>
                      {{ t('admin.accounts.syncFromCrs') }}
                    </UiButton>
                    <UiButton block density="compact" variant="quiet" @click="close(); openImportData()">
                      <template #icon><Icon name="upload" size="sm" /></template>
                      {{ t('admin.accounts.dataImport') }}
                    </UiButton>
                    <UiButton block density="compact" variant="quiet" @click="close(); openExportDataDialogFromMenu()">
                      <template #icon><Icon name="download" size="sm" /></template>
                      <span class="accounts-tools-popover__label">
                        {{ selIds.length ? t('admin.accounts.dataExportSelected') : t('admin.accounts.dataExport') }}
                        <UiBadge v-if="selIds.length" tone="info">
                          {{ t('admin.accounts.selectedCount', { count: selIds.length }) }}
                        </UiBadge>
                      </span>
                    </UiButton>

                    <UiDivider>{{ t('admin.accounts.toolActions') }}</UiDivider>
                    <UiButton block density="compact" variant="quiet" @click="close(); openErrorPassthrough()">
                      <template #icon><Icon name="shield" size="sm" /></template>
                      {{ t('admin.errorPassthrough.title') }}
                    </UiButton>
                    <UiButton block density="compact" variant="quiet" @click="close(); openTLSFingerprintProfiles()">
                      <template #icon><Icon name="lock" size="sm" /></template>
                      {{ t('admin.tlsFingerprintProfiles.title') }}
                    </UiButton>

                    <UiDivider>{{ t('admin.accounts.viewColumns') }}</UiDivider>
                    <div class="accounts-tools-popover__columns">
                      <UiCheckbox
                        v-for="col in toggleableColumns"
                        :key="col.key"
                        :model-value="isColumnVisible(col.key)"
                        :label="col.label"
                        @update:model-value="toggleColumn(col.key)"
                      />
                    </div>
                  </div>
                </template>
              </UiPopover>
            </template>
              </AccountTableActions>
            </template>
          </UiTableToolbar>
          <UiBanner
            v-if="hasPendingListSync"
            class="accounts-sync-banner"
            tone="warning"
          >
            <div class="accounts-sync-banner__content">
              <span>{{ t("admin.accounts.listPendingSyncHint") }}</span>
              <UiButton
                density="dense"
                variant="secondary"
                @click="syncPendingListChanges"
              >
                {{ t("admin.accounts.listPendingSyncAction") }}
              </UiButton>
            </div>
          </UiBanner>
        </template>
        <AccountBulkActionsBar
          :selected-ids="selIds"
          :total-results="pagination.total"
          :selecting-all="selectingAllResults"
          :all-results-selected="allResultsSelected"
          :pending="bulkActionPending"
          @delete="handleBulkDelete"
          @reset-status="handleBulkResetStatus"
          @refresh-token="handleBulkRefreshToken"
          @probe-upstream-billing="handleBulkProbeUpstreamBilling"
          @edit-selected="openBulkEditSelected"
          @edit-filtered="openBulkEditFiltered"
          @clear="clearSelection"
          @select-page="selectPage"
          @select-all-results="handleSelectAllResults"
          @toggle-schedulable="handleBulkToggleSchedulable"
        />
        <div
          ref="accountTableRef"
          class="accounts-table-host"
        >
          <UiDataTable
            ref="dataTableRef"
            :columns="cols"
            :data="accounts"
            :loading="loading"
            row-key="id"
            :server-side-sort="true"
            @sort="handleSort"
            default-sort-key="priority"
            default-sort-order="desc"
            :sort-storage-key="ACCOUNT_SORT_STORAGE_KEY"
            :sticky-first-column="false"
            :estimate-row-height="156"
            :overscan="5"
            :virtualize-threshold="50"
            :mobile-table="true"
          >
            <template #header-select>
              <UiCheckbox
                class="accounts-checkbox"
                :model-value="allVisibleSelected"
                :aria-label="t('common.selectAll')"
                @click.stop
                @update:model-value="toggleVisible"
              />
            </template>
            <template #cell-select="{ row }">
              <UiCheckbox
                class="accounts-checkbox"
                :model-value="isSelected(row.id)"
                :aria-label="t('common.selectOption')"
                @click.stop
                @update:model-value="toggleSel(row.id)"
              />
            </template>
            <template #cell-id="{ value }">
              <span class="accounts-id"
                >#{{ value }}</span
              >
            </template>
            <template #cell-name="{ row, value }">
              <div class="accounts-cell-stack">
                <UiTooltip
                  v-if="accountHomepageUrl(row)"
                  :content="accountHomepageUrl(row)"
                  width-class="accounts-tooltip-wide accounts-tooltip-break"
                >
                    <a
                      :href="accountHomepageUrl(row)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ value }}
                    </a>
                </UiTooltip>
                <span
                  v-else
                  class="accounts-cell-primary"
                  >{{ value }}</span
                >
                <span
                  v-if="accountDisplayEmail(row)"
                  class="accounts-cell-meta accounts-cell-meta--truncate"
                  :title="
                    accountDisplayEmail(row) +
                    (row.parent_chatgpt_account_id
                      ? ' · ' + row.parent_chatgpt_account_id
                      : '')
                  "
                >
                  {{ accountDisplayEmail(row) }}
                </span>
              </div>
            </template>
            <template #header-service_status="{ column }">
              <div class="accounts-header-label">
                <span>{{ column.label }}</span>
                <UiTooltip
                  :content="t('admin.accounts.serviceStatus.passiveHint')"
                  width-class="accounts-tooltip-medium"
                >
                  <span tabindex="0" :aria-label="t('admin.accounts.serviceStatus.passiveHint')"><Icon name="infoCircle" size="sm" /></span>
                </UiTooltip>
              </div>
            </template>
            <template #cell-service_status="{ row }">
              <AccountServiceStatusCell
                :status="serviceStatusByAccountId[String(row.id)] ?? null"
                :loading="serviceStatusLoading"
                :error="serviceStatusError"
              />
            </template>
            <template #header-priority="{ column }">
              <div class="accounts-header-label">
                <span>{{ column.label }}</span>
                <UiTooltip
                  :content="t('admin.accounts.priorityColumnHint')"
                  width-class="accounts-tooltip-wide"
                >
                  <span tabindex="0" :aria-label="t('admin.accounts.priorityColumnHint')"><Icon name="infoCircle" size="sm" /></span>
                </UiTooltip>
              </div>
            </template>
            <template #cell-priority="{ row }">
              <UiNumberStepper
                :model-value="row.priority"
                :input-value="priorityDrafts[row.id] ?? String(row.priority)"
                input-type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                :min="0"
                :max="ACCOUNT_PRIORITY_MAX"
                :aria-label="t('admin.accounts.priority')"
                :decrease-label="t('admin.accounts.priorityDecrease')"
                :increase-label="t('admin.accounts.priorityIncrease')"
                :aria-busy="prioritySavingIds.has(row.id)"
                :disabled="prioritySavingIds.has(row.id)"
                :title="t('admin.accounts.priorityColumnHint')"
                @click.stop
                @input="handlePriorityDraftInput(row.id, $event)"
                @blur="commitPriorityDraft(row)"
                @enter="commitPriorityDraft(row, $event)"
                @escape="resetPriorityDraft(row)"
                @change="saveAccountPriority(row, $event)"
              />
              <span class="sr-only" aria-live="polite">
                {{ prioritySavingIds.has(row.id) ? t('admin.accounts.prioritySaving') : '' }}
              </span>
            </template>
            <template #cell-notes="{ value }">
              <span
                v-if="value"
                :title="value"
                class="accounts-notes"
                >{{ value }}</span
              >
              <span v-else class="accounts-cell-empty"
                >-</span
              >
            </template>
            <template #cell-platform_type="{ row }">
              <div class="accounts-platform-cell">
                <div class="accounts-badge-row">
                  <PlatformTypeBadge
                    :platform="row.platform"
                    :type="row.type"
                    :auth-mode="getOpenAIAuthMode(row)"
                    :plan-type="getAccountPlanType(row)"
                    :privacy-mode="
                      row.extra?.privacy_mode || row.parent_privacy_mode
                    "
                    :subscription-expires-at="
                      row.credentials?.subscription_expires_at ||
                      row.parent_subscription_expires_at
                    "
                  />
                  <span
                    v-if="getAntigravityTierLabel(row)"
                    :class="['accounts-tier', getAntigravityTierClass(row)]"
                  >
                    {{ getAntigravityTierLabel(row) }}
                  </span>
                </div>
                <div
                  v-if="getOpenAICompactMeta(row)"
                  :class="['accounts-compact', getOpenAICompactMeta(row)?.className]"
                  :title="getOpenAICompactTitle(row)"
                >
                  <span
                    :class="['accounts-compact__dot', getOpenAICompactMeta(row)?.dotClass]"
                  />
                  <span>{{ getOpenAICompactMeta(row)?.label }}</span>
                </div>
              </div>
            </template>
            <template #cell-capacity="{ row }">
              <AccountCapacityCell :account="row" />
            </template>
            <template #cell-status="{ row }">
              <div class="accounts-status-cell">
                <AccountStatusIndicator
                  :account="row"
                  @show-temp-unsched="handleShowTempUnsched"
                />
              </div>
            </template>
            <template #cell-schedulable="{ row }">
              <UiSwitch
                :model-value="row.schedulable === true"
                :disabled="togglingSchedulable === row.id"
                :label="
                  row.schedulable
                    ? t('admin.accounts.schedulableEnabled')
                    : t('admin.accounts.schedulableDisabled')
                "
                @update:model-value="handleToggleSchedulable(row)"
              />
            </template>
            <template #cell-today_stats="{ row }">
              <AccountTodayStatsCell
                :stats="todayStatsByAccountId[String(row.id)] ?? null"
                :loading="todayStatsLoading"
                :error="todayStatsError"
              />
            </template>
            <template #cell-groups="{ row }">
              <AccountGroupsCell :groups="row.groups" :max-display="4" />
            </template>
            <template #header-usage="{ column }">
              <div class="accounts-header-label">
                <span>{{ column.label }}</span>
                  <UiTooltip
                    :content="t('admin.accounts.usageWindowsHint')"
                    width-class="accounts-tooltip-medium"
                >
                  <span tabindex="0" :aria-label="t('admin.accounts.usageWindowsHint')"><Icon name="infoCircle" size="sm" /></span>
                </UiTooltip>
              </div>
            </template>
            <template #cell-usage="{ row }">
              <AccountUsageCell
                :account="row"
                :today-stats="todayStatsByAccountId[String(row.id)] ?? null"
                :today-stats-loading="todayStatsLoading"
                :manual-refresh-token="usageManualRefreshToken"
                @account-updated="handleAccountUpdated"
              />
            </template>
            <template #cell-proxy="{ row }">
              <div class="accounts-cell-stack">
                <div v-if="row.proxy" class="accounts-proxy-line">
                  <span class="accounts-cell-primary">{{
                    row.proxy.name
                  }}</span>
                  <span
                    v-if="row.proxy.country_code"
                    class="accounts-cell-meta"
                  >
                    ({{ row.proxy.country_code }})
                  </span>
                </div>
                <span v-else class="accounts-cell-empty"
                  >-</span
                >
                <div
                  v-if="row.proxy && row.proxy.expires_at"
                  class="accounts-proxy-line accounts-cell-meta"
                >
                  <span>{{
                    formatDateTime(row.proxy.expires_at)
                  }}</span>
                  <UiBadge :tone="proxyExpiryTone(row.proxy)">{{
                    proxyExpiryText(row.proxy)
                  }}</UiBadge>
                </div>
                <div
                  v-if="row.proxy_fallback_origin_id"
                  class="accounts-fallback-actions"
                >
                  <span
                    class="accounts-status-label accounts-status-label--warning"
                    :title="
                      t('admin.accounts.fallbackActiveTip', {
                        origin: row.proxy_fallback_origin_name,
                      })
                    "
                  >
                    {{ t("admin.accounts.fallbackActive") }}
                  </span>
                  <UiButton
                    density="dense"
                    variant="secondary"
                    :disabled="accountOperationPendingIds.has(row.id)"
                    @click="onRevertFallback(row)"
                  >
                    {{ t("admin.accounts.revertProxy") }}
                  </UiButton>
                </div>
              </div>
            </template>
            <template #cell-rate_multiplier="{ row }">
              <span
                class="accounts-rate"
              >
                <span>{{ formatMultiplier(row.rate_multiplier ?? 1) }}x</span>
                <span
                  v-if="row.extra?.upstream_billing_rate_sync_enabled === true"
                  class="accounts-rate-sync"
                  :aria-label="
                    t('admin.accounts.upstreamBilling.syncedRateTooltip')
                  "
                  :title="t('admin.accounts.upstreamBilling.syncedRateTooltip')"
                  data-testid="account-rate-sync-indicator"
                >
                  <Icon name="sync" size="xs" />
                </span>
              </span>
            </template>
            <template #header-upstream_billing_rate="{ column }">
              <div class="accounts-header-label">
                <span>{{ column.label }}</span>
                <span @click.stop>
                  <UiTooltip
                    :content="t('admin.accounts.upstreamBilling.trustWarning')"
                    width-class="accounts-tooltip-wide"
                  >
                    <span tabindex="0" :aria-label="t('admin.accounts.upstreamBilling.trustWarning')"><Icon name="infoCircle" size="sm" /></span>
                  </UiTooltip>
                </span>
              </div>
            </template>
            <template #cell-upstream_billing_rate="{ row }">
              <UpstreamBillingRateCell
                :account="row"
                :global-probe-enabled="upstreamBillingProbeGloballyEnabled"
                :now="upstreamBillingNow"
                :probing="probingUpstreamBilling.has(row.id)"
                @probe="handleProbeUpstreamBilling(row)"
              />
            </template>
            <template #header-scheduler_score="{ column }">
              <div class="accounts-header-label">
                <span>{{ column.label }}</span>
                <UiTooltip
                  :content="t('admin.accounts.schedulerScore.hint')"
                  width-class="accounts-tooltip-wide"
                >
                  <span tabindex="0" :aria-label="t('admin.accounts.schedulerScore.hint')"><Icon name="infoCircle" size="sm" /></span>
                </UiTooltip>
              </div>
            </template>
            <template #cell-scheduler_score="{ row }">
              <div
                v-if="getSchedulerScoreRows(row).length"
                class="accounts-score-list"
              >
                <div
                  v-for="score in getSchedulerScoreRows(row)"
                  :key="String(score.group_id)"
                  class="accounts-score-row"
                  :title="`${formatSchedulerScoreGroup(score)} / ${formatSchedulerScore(score.base_score)} / ${formatStickySchedulerScore(score)}`"
                >
                  <span
                    class="accounts-score-group"
                    >{{ formatSchedulerScoreGroup(score) }}</span
                  >
                  <span class="accounts-score-separator">/</span>
                  <span>{{ formatSchedulerScore(score.base_score) }}</span>
                  <span class="accounts-score-separator">/</span>
                  <span class="accounts-score-sticky">{{
                    formatStickySchedulerScore(score)
                  }}</span>
                </div>
              </div>
              <span v-else class="accounts-cell-empty"
                >-</span
              >
            </template>
            <template #cell-last_used_at="{ value }">
              <span class="accounts-cell-meta">{{
                formatRelativeTime(value)
              }}</span>
            </template>
            <template #cell-created_at="{ value }">
              <span class="accounts-cell-meta">{{
                formatDateTime(value)
              }}</span>
            </template>
            <template #cell-expires_at="{ row, value }">
              <div class="accounts-expiry-cell">
                <span class="accounts-cell-meta">{{
                  formatExpiresAt(value)
                }}</span>
                <div
                  v-if="
                    isExpired(value) || (row.auto_pause_on_expired && value)
                  "
                  class="accounts-badge-row"
                >
                  <span
                    v-if="isExpired(value)"
                    class="accounts-status-label accounts-status-label--warning"
                  >
                    {{ t("admin.accounts.expired") }}
                  </span>
                  <span
                    v-if="row.auto_pause_on_expired && value"
                    class="accounts-status-label accounts-status-label--success"
                  >
                    {{ t("admin.accounts.autoPauseOnExpired") }}
                  </span>
                </div>
              </div>
            </template>
            <template #cell-actions="{ row }">
              <div class="accounts-row-actions">
                <UiIconButton
                  type="button"
                  @click="handleEdit(row)"
                  variant="ghost"
                  density="dense"
                  icon="edit"
                  :label="t('common.edit')"
                />
                <UiIconButton
                  type="button"
                  @click="handleDelete(row)"
                  variant="danger"
                  density="dense"
                  icon="trash"
                  :label="t('common.delete')"
                />
                <UiIconButton
                  type="button"
                  @click="openMenu(row, $event)"
                  variant="ghost"
                  density="dense"
                  icon="more"
                  :label="t('common.more')"
                />
              </div>
            </template>
          </UiDataTable>
        </div>
      <template #pagination
        ><UiPagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
      /></template>
      </UiServerTableWorkspace>
    </AppPage>
    <CreateAccountModal
      :show="showCreate"
      :proxies="proxies"
      :groups="groups"
      @close="showCreate = false"
      @created="reload"
    />
    <EditAccountModal
      :show="showEdit"
      :account="edAcc"
      :proxies="proxies"
      :groups="groups"
      @close="showEdit = false"
      @updated="handleAccountUpdated"
    />
    <ReAuthAccountModal
      :show="showReAuth"
      :account="reAuthAcc"
      @close="closeReAuthModal"
      @reauthorized="handleAccountUpdated"
    />
    <AccountTestModal
      :show="showTest"
      :account="testingAcc"
      @close="closeTestModal"
    />
    <AccountStatsModal
      :show="showStats"
      :account="statsAcc"
      @close="closeStatsModal"
    />
    <ScheduledTestsPanel
      :show="showSchedulePanel"
      :account-id="scheduleAcc?.id ?? null"
      :model-options="scheduleModelOptions"
      @close="closeSchedulePanel"
    />
    <AccountActionMenu
      :show="menu.show"
      :account="menu.acc"
      :position="menu.pos"
      :pending="menu.acc != null && accountOperationPendingIds.has(menu.acc.id)"
      @close="menu.show = false"
      @test="handleTest"
      @stats="handleViewStats"
      @schedule="handleSchedule"
      @duplicate="handleDuplicateAccount"
      @reauth="handleReAuth"
      @refresh-token="handleRefresh"
      @recover-state="handleRecoverState"
      @reset-quota="handleResetQuota"
      @set-privacy="handleSetPrivacy"
      @create-spark-shadow="handleCreateSparkShadow"
    />
    <SyncFromCrsModal
      :show="showSync"
      @close="showSync = false"
      @synced="reload"
    />
    <ImportDataModal
      :show="showImportData"
      @close="showImportData = false"
      @imported="handleDataImported"
    />
    <BulkEditAccountModal
      :show="showBulkEdit"
      :account-ids="selIds"
      :selected-platforms="selPlatforms"
      :selected-types="selTypes"
      :target="bulkEditTarget ?? undefined"
      :proxies="proxies"
      :groups="groups"
      @close="showBulkEdit = false"
      @updated="handleBulkUpdated"
    />
    <TempUnschedStatusModal
      :show="showTempUnsched"
      :account="tempUnschedAcc"
      @close="showTempUnsched = false"
      @reset="handleTempUnschedReset"
    />
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.accounts.deleteAccount')"
      :message="t('admin.accounts.deleteConfirm', { name: deletingAcc?.name })"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="deletePending"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false; deletingAcc = null"
    />
    <UiConfirmDialog
      :show="showCreateShadowDialog"
      :title="t('admin.accounts.createSparkShadow')"
      :message="
        t('admin.accounts.createSparkShadowConfirm', {
          name: creatingShadowAcc?.name,
        })
      "
      :pending="creatingShadowAcc != null && accountOperationPendingIds.has(creatingShadowAcc.id)"
      @confirm="confirmCreateSparkShadow"
      @cancel="showCreateShadowDialog = false"
    />
    <UiConfirmDialog
      :show="showExportDataDialog"
      :title="t('admin.accounts.dataExport')"
      :message="t('admin.accounts.dataExportConfirmMessage')"
      :confirm-text="t('admin.accounts.dataExportConfirm')"
      :cancel-text="t('common.cancel')"
      :pending="exportingData"
      @confirm="handleExportData"
      @cancel="closeExportDataDialog"
    >
      <UiCheckbox
        v-model="includeProxyOnExport"
        :label="t('admin.accounts.dataExportIncludeProxies')"
      />
    </UiConfirmDialog>
    <UiConfirmDialog
      :show="bulkConfirmation !== null"
      :title="bulkConfirmationTitle"
      :message="bulkConfirmationMessage"
      :confirm-text="bulkConfirmationConfirmText"
      :cancel-text="t('common.cancel')"
      :danger="bulkConfirmation?.kind === 'delete'"
      :pending="bulkActionPending"
      @confirm="confirmBulkAction"
      @cancel="bulkConfirmation = null"
    />
    <ErrorPassthroughRulesModal
      :show="showErrorPassthrough"
      @close="showErrorPassthrough = false"
    />
    <TLSFingerprintProfilesModal
      :show="showTLSFingerprintProfiles"
      @close="showTLSFingerprintProfiles = false"
    />
    <TotpStepUpDialog :controller="accountExportStepUp" />
  </AppLayout>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  onMounted,
  onUnmounted,
  toRaw,
  watch,
} from "vue";
import { useDebounceFn, useIntervalFn } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { adminAPI } from "@/api/admin";
import { useTableLoader } from "@/composables/useTableLoader";
import {
  useSwipeSelect,
  type SwipeSelectVirtualContext,
} from "@/composables/useSwipeSelect";
import { useTableSelection } from "@/composables/useTableSelection";
import {
  useStepUp,
  isStepUpBlocked,
  isStepUpCancelled,
  stepUpBlockReason,
} from "@/composables/useStepUp";
import TotpStepUpDialog from "@/components/auth/TotpStepUpDialog.vue";
import AppLayout from "@/components/layout/AppLayout.vue";
import {
  AppPage,
  AppPageHeader,
  UiBadge,
  UiButton,
  UiBanner,
  UiCheckbox,
  UiConfirmDialog,
  UiDataTable,
  UiDivider,
  UiIconButton,
  UiNumberStepper,
  UiPagination,
  UiPopover,
  UiRadioGroup,
  UiServerTableWorkspace,
  UiSwitch,
  UiTableToolbar,
  UiTooltip,
} from "@/components/ui";
import {
  CreateAccountModal,
  EditAccountModal,
  BulkEditAccountModal,
  SyncFromCrsModal,
  TempUnschedStatusModal,
} from "@/components/account";
import AccountTableActions from "@/components/admin/account/AccountTableActions.vue";
import AccountTableFilters from "@/components/admin/account/AccountTableFilters.vue";
import AccountBulkActionsBar from "@/components/admin/account/AccountBulkActionsBar.vue";
import AccountActionMenu from "@/components/admin/account/AccountActionMenu.vue";
import ImportDataModal from "@/components/admin/account/ImportDataModal.vue";
import ReAuthAccountModal from "@/components/admin/account/ReAuthAccountModal.vue";
import AccountTestModal from "@/components/admin/account/AccountTestModal.vue";
import AccountStatsModal from "@/components/admin/account/AccountStatsModal.vue";
import ScheduledTestsPanel from "@/components/admin/account/ScheduledTestsPanel.vue";
import type { SelectOption } from "@/components/ui";
import AccountStatusIndicator from "@/components/account/AccountStatusIndicator.vue";
import AccountUsageCell from "@/components/account/AccountUsageCell.vue";
import AccountTodayStatsCell from "@/components/account/AccountTodayStatsCell.vue";
import AccountServiceStatusCell from "@/components/account/AccountServiceStatusCell.vue";
import AccountGroupsCell from "@/components/account/AccountGroupsCell.vue";
import AccountCapacityCell from "@/components/account/AccountCapacityCell.vue";
import UpstreamBillingRateCell from "@/components/account/UpstreamBillingRateCell.vue";
import PlatformTypeBadge from "@/components/common/PlatformTypeBadge.vue";
import Icon from "@/components/icons/Icon.vue";
import ErrorPassthroughRulesModal from "@/components/admin/ErrorPassthroughRulesModal.vue";
import TLSFingerprintProfilesModal from "@/components/admin/TLSFingerprintProfilesModal.vue";
import { fetchAllAccountIds } from "@/utils/accountSelection";
import {
  buildGrokUsageRefreshKey,
  buildOpenAIUsageRefreshKey,
} from "@/utils/accountUsageRefresh";
import { formatDateTime, formatRelativeTime } from "@/utils/format";
import {
  daysUntil,
  EXPIRY_DANGER_DAYS,
  EXPIRY_WARN_DAYS,
  proxyExpiryLabelKey,
} from "@/utils/proxyExpiry";
import { extractApiErrorMessage } from "@/utils/apiError";
import { sanitizeUrl } from "@/utils/url";
import { formatMultiplier } from "@/utils/formatters";
import {
  ACCOUNT_PRIORITY_MAX,
  parseAccountPriority,
} from "@/utils/accountPriority";
import type { AccountServiceStatus } from "@/api/admin/accounts";
import type {
  Account,
  AccountPlatform,
  AccountSchedulerGroupScore,
  AccountType,
  Proxy as AccountProxy,
  AdminGroup,
  WindowStats,
  ClaudeModel,
  UpstreamBillingProbeSnapshot,
} from "@/types";

const { t } = useI18n();
const appStore = useAppStore();
const authStore = useAuthStore();

const proxies = ref<AccountProxy[]>([]);
const groups = ref<AdminGroup[]>([]);
const accountTableRef = ref<HTMLElement | null>(null);
const dataTableRef = ref<InstanceType<typeof UiDataTable> | null>(null);
type AccountBulkEditTarget =
  | {
      mode: "selected";
      accountIds: number[];
      selectedPlatforms: AccountPlatform[];
      selectedTypes: AccountType[];
    }
  | {
      mode: "filtered";
      filters: {
        platform?: string;
        type?: string;
        status?: string;
        group?: string;
        search?: string;
        privacy_mode?: string;
        sort_by?: string;
        sort_order?: AccountSortOrder;
      };
      previewCount: number;
      selectedPlatforms: AccountPlatform[];
      selectedTypes: AccountType[];
    };
const selPlatforms = computed<AccountPlatform[]>(() => {
  const platforms = new Set(
    accounts.value.filter((a) => isSelected(a.id)).map((a) => a.platform),
  );
  return [...platforms];
});
const selTypes = computed<AccountType[]>(() => {
  const types = new Set(
    accounts.value.filter((a) => isSelected(a.id)).map((a) => a.type),
  );
  return [...types];
});
const showCreate = ref(false);
const showEdit = ref(false);
const showSync = ref(false);
const showImportData = ref(false);
const showExportDataDialog = ref(false);
const includeProxyOnExport = ref(true);
const showBulkEdit = ref(false);
const bulkEditTarget = ref<AccountBulkEditTarget | null>(null);
const showTempUnsched = ref(false);
const showDeleteDialog = ref(false);
const showCreateShadowDialog = ref(false);
const showReAuth = ref(false);
const showTest = ref(false);
const showStats = ref(false);
const showErrorPassthrough = ref(false);
const showTLSFingerprintProfiles = ref(false);
const edAcc = ref<Account | null>(null);
const tempUnschedAcc = ref<Account | null>(null);
const deletingAcc = ref<Account | null>(null);
const deletePending = ref(false);
const creatingShadowAcc = ref<Account | null>(null);
const accountOperationPendingIds = reactive(new Set<number>());
const reAuthAcc = ref<Account | null>(null);
const testingAcc = ref<Account | null>(null);
const statsAcc = ref<Account | null>(null);
const showSchedulePanel = ref(false);
const scheduleAcc = ref<Account | null>(null);
const scheduleModelOptions = ref<SelectOption[]>([]);
const scheduleModelsRequestSeq = ref(0);
const togglingSchedulable = ref<number | null>(null);
const bulkActionPending = ref(false);
const bulkConfirmation = ref<{
  kind: "delete" | "reset-status" | "refresh-token";
  ids: number[];
} | null>(null);
const bulkConfirmationTitle = computed(() => {
  switch (bulkConfirmation.value?.kind) {
    case "delete":
      return t("admin.accounts.bulkActions.delete");
    case "reset-status":
      return t("admin.accounts.bulkActions.resetStatus");
    case "refresh-token":
      return t("admin.accounts.bulkActions.refreshToken");
    default:
      return "";
  }
});
const bulkConfirmationMessage = computed(() => {
  if (!bulkConfirmation.value) return "";
  if (bulkConfirmation.value.kind === "delete") {
    return t("admin.accounts.bulkActions.confirmDelete", {
      count: bulkConfirmation.value.ids.length,
    });
  }
  return t("common.confirm");
});
const bulkConfirmationConfirmText = computed(() =>
  bulkConfirmation.value?.kind === "delete"
    ? t("common.delete")
    : t("common.confirm"),
);
const menu = reactive<{
  show: boolean;
  acc: Account | null;
  pos: { top: number; left: number } | null;
}>({ show: false, acc: null, pos: null });
const exportingData = ref(false);
const probingUpstreamBilling = reactive(new Set<number>());
const upstreamBillingProbeGloballyEnabled = ref<boolean | undefined>(undefined);
const upstreamBillingNow = ref(Date.now());
let lastUpstreamBillingSortRefreshMinute = -1;
useIntervalFn(() => {
  upstreamBillingNow.value = Date.now();
}, 60_000);

const showAccountToolsDropdown = ref(false);
const hiddenColumns = reactive<Set<string>>(new Set());
const DEFAULT_HIDDEN_COLUMNS = [
  "today_stats",
  "proxy",
  "notes",
  "scheduler_score",
  "rate_multiplier",
];
const HIDDEN_COLUMNS_KEY = "account-hidden-columns";
// One-time migration: hide scheduler score for existing admins too, because showing it opt-ins to heavy backend scoring.
const HIDDEN_COLUMNS_VERSION_KEY = "account-hidden-columns-version";
const HIDDEN_COLUMNS_CURRENT_VERSION =
  "priority-visible-scheduler-score-hidden";

// Sorting settings
const ACCOUNT_SORT_STORAGE_KEY = "account-table-sort";
const ACCOUNT_SORT_VERSION_KEY = "account-table-sort-version";
const ACCOUNT_SORT_CURRENT_VERSION = "priority-desc-v1";
type AccountSortOrder = "asc" | "desc";
type AccountSortState = {
  sort_by: string;
  sort_order: AccountSortOrder;
};
const ACCOUNT_SORTABLE_KEYS = new Set([
  "id",
  "name",
  "status",
  "schedulable",
  "priority",
  "rate_multiplier",
  "upstream_billing_rate",
  "last_used_at",
  "created_at",
  "expires_at",
]);
const loadInitialAccountSortState = (): AccountSortState => {
  const fallback: AccountSortState = {
    sort_by: "priority",
    sort_order: "desc",
  };
  try {
    const raw = localStorage.getItem(ACCOUNT_SORT_STORAGE_KEY);
    const storedVersion = localStorage.getItem(ACCOUNT_SORT_VERSION_KEY);
    if (!raw || storedVersion !== ACCOUNT_SORT_CURRENT_VERSION) {
      localStorage.setItem(
        ACCOUNT_SORT_STORAGE_KEY,
        JSON.stringify({ key: fallback.sort_by, order: fallback.sort_order }),
      );
      localStorage.setItem(
        ACCOUNT_SORT_VERSION_KEY,
        ACCOUNT_SORT_CURRENT_VERSION,
      );
      return fallback;
    }
    const parsed = JSON.parse(raw) as { key?: string; order?: string };
    const key = typeof parsed.key === "string" ? parsed.key : "";
    if (!ACCOUNT_SORTABLE_KEYS.has(key)) return fallback;
    return {
      sort_by: key,
      sort_order: parsed.order === "desc" ? "desc" : "asc",
    };
  } catch {
    return fallback;
  }
};
const sortState = reactive<AccountSortState>(loadInitialAccountSortState());

// Auto refresh settings
const showAutoRefreshDropdown = ref(false);
const AUTO_REFRESH_STORAGE_KEY = "account-auto-refresh";
const autoRefreshIntervals = [5, 10, 15, 30] as const;
const autoRefreshIntervalOptions = computed(() =>
  autoRefreshIntervals.map((seconds) => ({
    value: seconds,
    label: autoRefreshIntervalLabel(seconds),
  })),
);
const autoRefreshEnabled = ref(false);
const autoRefreshIntervalSeconds =
  ref<(typeof autoRefreshIntervals)[number]>(30);
const autoRefreshCountdown = ref(0);
const autoRefreshETag = ref<string | null>(null);
const autoRefreshFetching = ref(false);
const AUTO_REFRESH_SILENT_WINDOW_MS = 15000;
const autoRefreshSilentUntil = ref(0);
const hasPendingListSync = ref(false);
const todayStatsByAccountId = ref<Record<string, WindowStats>>({});
const todayStatsLoading = ref(false);
const todayStatsError = ref<string | null>(null);
const todayStatsReqSeq = ref(0);
const serviceStatusByAccountId = ref<Record<string, AccountServiceStatus>>({});
const serviceStatusLoading = ref(false);
const serviceStatusError = ref<string | null>(null);
const serviceStatusReqSeq = ref(0);
const pendingAccountMetricsRefresh = ref(false);
const usageManualRefreshToken = ref(0);
const priorityDrafts = reactive<Record<number, string>>({});
const prioritySavingIds = reactive(new Set<number>());

const resetPriorityDraft = (account: Account) => {
  delete priorityDrafts[account.id];
};

const handlePriorityDraftInput = (accountId: number, event: Event) => {
  priorityDrafts[accountId] = (event.target as HTMLInputElement).value;
};

const saveAccountPriority = async (account: Account, priority: number) => {
  if (prioritySavingIds.has(account.id) || priority === account.priority) {
    resetPriorityDraft(account);
    return;
  }

  const previous = account.priority;
  prioritySavingIds.add(account.id);
  enterAutoRefreshSilentWindow();
  account.priority = priority;
  priorityDrafts[account.id] = String(priority);
  try {
    const updated = await adminAPI.accounts.update(account.id, { priority });
    Object.assign(account, updated);
    delete priorityDrafts[account.id];
    hasPendingListSync.value = true;
  } catch (error) {
    account.priority = previous;
    delete priorityDrafts[account.id];
    appStore.showError(
      extractApiErrorMessage(error, t("admin.accounts.priorityUpdateFailed")),
    );
  } finally {
    prioritySavingIds.delete(account.id);
  }
  void reload().catch((error) => {
    hasPendingListSync.value = true;
    console.error("Failed to sync priority-sorted account list:", error);
  });
};

const commitPriorityDraft = (account: Account, event?: Event) => {
  const parsed = parseAccountPriority(
    priorityDrafts[account.id] ?? String(account.priority),
  );
  if (parsed == null) {
    resetPriorityDraft(account);
    appStore.showError(t("admin.accounts.priorityInvalid"));
    return;
  }
  if (event?.target instanceof HTMLInputElement) event.target.blur();
  void saveAccountPriority(account, parsed);
};

const buildDefaultTodayStats = (): WindowStats => ({
  requests: 0,
  tokens: 0,
  cost: 0,
  standard_cost: 0,
  user_cost: 0,
});

const refreshTodayStatsBatch = async () => {
  // Why this checks both columns:
  // - today_stats column shows dedicated today's metrics.
  // - usage column also embeds today's stats for Key/Bedrock rows.
  // So we only skip fetching when BOTH columns are hidden.
  if (hiddenColumns.has("today_stats") && hiddenColumns.has("usage")) {
    todayStatsLoading.value = false;
    todayStatsError.value = null;
    return;
  }

  const accountIDs = accounts.value.map((account) => account.id);
  const reqSeq = ++todayStatsReqSeq.value;
  if (accountIDs.length === 0) {
    todayStatsByAccountId.value = {};
    todayStatsError.value = null;
    todayStatsLoading.value = false;
    return;
  }

  todayStatsLoading.value = true;
  todayStatsError.value = null;

  try {
    const result = await adminAPI.accounts.getBatchTodayStats(accountIDs);
    if (reqSeq !== todayStatsReqSeq.value) return;
    const serverStats = result.stats ?? {};
    const nextStats: Record<string, WindowStats> = {};
    for (const accountID of accountIDs) {
      const key = String(accountID);
      nextStats[key] = serverStats[key] ?? buildDefaultTodayStats();
    }
    todayStatsByAccountId.value = nextStats;
  } catch (error) {
    if (reqSeq !== todayStatsReqSeq.value) return;
    todayStatsError.value = "Failed";
    console.error("Failed to load account today stats:", error);
  } finally {
    if (reqSeq === todayStatsReqSeq.value) {
      todayStatsLoading.value = false;
    }
  }
};

const refreshServiceStatusBatch = async () => {
  const accountIDs = accounts.value.map((account) => account.id);
  const reqSeq = ++serviceStatusReqSeq.value;
  if (accountIDs.length === 0) {
    serviceStatusByAccountId.value = {};
    serviceStatusError.value = null;
    serviceStatusLoading.value = false;
    return;
  }

  serviceStatusLoading.value = true;
  serviceStatusError.value = null;

  try {
    const result = await adminAPI.accounts.getServiceStatus(accountIDs);
    if (reqSeq !== serviceStatusReqSeq.value) return;
    if (!result.enabled) {
      serviceStatusByAccountId.value = {};
      serviceStatusError.value = "Unavailable";
      return;
    }

    const nextStatus: Record<string, AccountServiceStatus> = {};
    for (const accountID of accountIDs) {
      const key = String(accountID);
      const accountStatus = result.accounts?.[key];
      if (accountStatus) nextStatus[key] = accountStatus;
    }
    serviceStatusByAccountId.value = nextStatus;
  } catch (error) {
    if (reqSeq !== serviceStatusReqSeq.value) return;
    serviceStatusByAccountId.value = {};
    serviceStatusError.value = "Unavailable";
    console.error("Failed to load account service status:", error);
  } finally {
    if (reqSeq === serviceStatusReqSeq.value) {
      serviceStatusLoading.value = false;
    }
  }
};

const refreshAccountPageMetrics = async () => {
  await Promise.all([refreshTodayStatsBatch(), refreshServiceStatusBatch()]);
};

const autoRefreshIntervalLabel = (sec: number) => {
  if (sec === 5) return t("admin.accounts.refreshInterval5s");
  if (sec === 10) return t("admin.accounts.refreshInterval10s");
  if (sec === 15) return t("admin.accounts.refreshInterval15s");
  if (sec === 30) return t("admin.accounts.refreshInterval30s");
  return `${sec}s`;
};

const formatSchedulerScore = (value: unknown): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(6).replace(/\.?0+$/, "");
};

const formatStickySchedulerScore = (
  score: AccountSchedulerGroupScore,
): string => {
  if (!score) return "-";
  if (score.sticky_score_infinity) return "+∞";
  return formatSchedulerScore(score.sticky_score);
};

const getSchedulerScoreRows = (
  account: Account,
): AccountSchedulerGroupScore[] => {
  const groupRows = Array.isArray(account.scheduler_scores)
    ? account.scheduler_scores.filter((score) => score.group_id != null)
    : [];
  if (groupRows.length) return groupRows;
  // 未分组账号没有分组维度分数，回退展示后端返回的基础分
  if (account.scheduler_score) {
    return [{ group_id: null, ...account.scheduler_score }];
  }
  return [];
};

const formatSchedulerScoreGroup = (
  score: AccountSchedulerGroupScore,
): string => {
  if ("group_name" in score && score.group_name) return score.group_name;
  if ("group_id" in score && score.group_id != null)
    return `#${score.group_id}`;
  return t("admin.accounts.schedulerScore.ungrouped");
};

const loadSavedColumns = () => {
  try {
    const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      parsed.forEach((key) => {
        hiddenColumns.add(key);
      });
      // Migrate older layouts without overriding the user's scheduler-score choice.
      if (
        localStorage.getItem(HIDDEN_COLUMNS_VERSION_KEY) !==
        HIDDEN_COLUMNS_CURRENT_VERSION
      ) {
        hiddenColumns.delete("priority");
        localStorage.setItem(
          HIDDEN_COLUMNS_KEY,
          JSON.stringify([...hiddenColumns]),
        );
        localStorage.setItem(
          HIDDEN_COLUMNS_VERSION_KEY,
          HIDDEN_COLUMNS_CURRENT_VERSION,
        );
      }
    } else {
      DEFAULT_HIDDEN_COLUMNS.forEach((key) => {
        hiddenColumns.add(key);
      });
      localStorage.setItem(
        HIDDEN_COLUMNS_VERSION_KEY,
        HIDDEN_COLUMNS_CURRENT_VERSION,
      );
    }
  } catch (e) {
    console.error("Failed to load saved columns:", e);
    DEFAULT_HIDDEN_COLUMNS.forEach((key) => {
      hiddenColumns.add(key);
    });
  }
};

const saveColumnsToStorage = () => {
  try {
    localStorage.setItem(
      HIDDEN_COLUMNS_KEY,
      JSON.stringify([...hiddenColumns]),
    );
    localStorage.setItem(
      HIDDEN_COLUMNS_VERSION_KEY,
      HIDDEN_COLUMNS_CURRENT_VERSION,
    );
  } catch (e) {
    console.error("Failed to save columns:", e);
  }
};

const loadSavedAutoRefresh = () => {
  try {
    const saved = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as {
      enabled?: boolean;
      interval_seconds?: number;
    };
    autoRefreshEnabled.value = parsed.enabled === true;
    const interval = Number(parsed.interval_seconds);
    if (autoRefreshIntervals.includes(interval as any)) {
      autoRefreshIntervalSeconds.value = interval as any;
    }
  } catch (e) {
    console.error("Failed to load saved auto refresh settings:", e);
  }
};

const saveAutoRefreshToStorage = () => {
  try {
    localStorage.setItem(
      AUTO_REFRESH_STORAGE_KEY,
      JSON.stringify({
        enabled: autoRefreshEnabled.value,
        interval_seconds: autoRefreshIntervalSeconds.value,
      }),
    );
  } catch (e) {
    console.error("Failed to save auto refresh settings:", e);
  }
};

if (typeof window !== "undefined") {
  loadSavedColumns();
  loadSavedAutoRefresh();
}

const setAutoRefreshEnabled = (enabled: boolean) => {
  autoRefreshEnabled.value = enabled;
  saveAutoRefreshToStorage();
  if (enabled) {
    autoRefreshCountdown.value = autoRefreshIntervalSeconds.value;
    resumeAutoRefresh();
  } else {
    pauseAutoRefresh();
    autoRefreshCountdown.value = 0;
  }
};

const setAutoRefreshInterval = (
  seconds: (typeof autoRefreshIntervals)[number],
) => {
  autoRefreshIntervalSeconds.value = seconds;
  saveAutoRefreshToStorage();
  if (autoRefreshEnabled.value) {
    autoRefreshCountdown.value = seconds;
  }
};

const handleAutoRefreshIntervalChange = (value: string | number) => {
  const seconds = Number(value);
  if (!autoRefreshIntervals.includes(seconds as (typeof autoRefreshIntervals)[number])) return;
  setAutoRefreshInterval(seconds as (typeof autoRefreshIntervals)[number]);
};

const toggleColumn = (key: string) => {
  const wasHidden = hiddenColumns.has(key);
  if (hiddenColumns.has(key)) {
    hiddenColumns.delete(key);
  } else {
    hiddenColumns.add(key);
  }
  saveColumnsToStorage();
  if ((key === "today_stats" || key === "usage") && wasHidden) {
    refreshTodayStatsBatch().catch((error) => {
      console.error(
        "Failed to load account today stats after showing column:",
        error,
      );
    });
  }
  if (key === "scheduler_score") {
    // The server only returns scheduler scores when this column is visible, so reload the current page immediately.
    syncAccountListDerivedParams();
    load().catch((error) => {
      console.error(
        "Failed to reload accounts after toggling scheduler score column:",
        error,
      );
    });
  }
};

const isColumnVisible = (key: string) => !hiddenColumns.has(key);
const shouldIncludeSchedulerScore = () => isColumnVisible("scheduler_score");
const syncAccountListDerivedParams = () => {
  // Keep every load path, including auto-refresh and sorting, aligned with the current column visibility.
  const requestParams = params as any;
  requestParams.include_scheduler_score = shouldIncludeSchedulerScore()
    ? "1"
    : "0";
};

const {
  items: accounts,
  loading,
  params,
  pagination,
  load: baseLoad,
  reload: baseReload,
  handlePageChange: baseHandlePageChange,
  handlePageSizeChange: baseHandlePageSizeChange,
} = useTableLoader<Account, any>({
  fetchFn: adminAPI.accounts.list,
  initialParams: {
    platform: "",
    type: "",
    status: "",
    privacy_mode: "",
    group: "",
    search: "",
    include_scheduler_score: shouldIncludeSchedulerScore() ? "1" : "0",
    sort_by: sortState.sort_by,
    sort_order: sortState.sort_order,
  },
});

const {
  selectedSet,
  selectedIds: selIds,
  allVisibleSelected,
  isSelected,
  setSelectedIds,
  select,
  deselect,
  toggle: toggleSel,
  clear: clearSelectedIds,
  removeMany: removeSelectedAccounts,
  toggleVisible,
  selectVisible: selectCurrentPage,
  batchUpdate,
} = useTableSelection<Account>({
  rows: accounts,
  getId: (account) => account.id,
});

const selectingAllResults = ref(false);
const selectedAllResultIDs = ref<Set<number> | null>(null);
const selectionRequestVersion = ref(0);
const allResultsSelected = computed(() => {
  const snapshot = selectedAllResultIDs.value;
  if (
    !snapshot ||
    snapshot.size === 0 ||
    snapshot.size !== selectedSet.value.size
  )
    return false;
  return Array.from(snapshot).every((id) => selectedSet.value.has(id));
});

const clearSelection = () => {
  selectionRequestVersion.value++;
  selectingAllResults.value = false;
  selectedAllResultIDs.value = null;
  clearSelectedIds();
};

const selectPage = () => {
  selectCurrentPage();
};

const swipeVirtualContext: SwipeSelectVirtualContext = {
  getVirtualizer: () => dataTableRef.value?.virtualizer ?? null,
  getSortedData: () => dataTableRef.value?.sortedData ?? accounts.value,
  getRowId: (row: any) => row.id,
};

useSwipeSelect(
  accountTableRef,
  {
    isSelected,
    select,
    deselect,
    batchUpdate,
  },
  swipeVirtualContext,
);

const resetAutoRefreshCache = () => {
  autoRefreshETag.value = null;
};

const isFirstLoad = ref(true);
let accountLoadSequence = 0;

function markUpstreamBillingSortRefresh() {
  if (sortState.sort_by === "upstream_billing_rate") {
    lastUpstreamBillingSortRefreshMinute = Math.floor(Date.now() / 60_000);
  }
}

const load = async () => {
  const loadSequence = ++accountLoadSequence;
  const shouldUseLite = isFirstLoad.value;
  const requestParams = params as any;
  markUpstreamBillingSortRefresh();
  syncAccountListDerivedParams();
  hasPendingListSync.value = false;
  resetAutoRefreshCache();
  pendingAccountMetricsRefresh.value = false;
  if (shouldUseLite) {
    requestParams.lite = "1";
  }
  try {
    await baseLoad();
    if (shouldUseLite && loadSequence === accountLoadSequence) {
      isFirstLoad.value = false;
      delete requestParams.lite;
    }
    await refreshAccountPageMetrics();
  } catch (error) {
    if (shouldUseLite && loadSequence === accountLoadSequence) {
      delete requestParams.lite;
    }
    throw error;
  }
};

const handleAccountListLoadError = (error: unknown) => {
  console.error("Failed to load accounts:", error);
  appStore.showError(
    extractApiErrorMessage(error, t("admin.accounts.failedToLoad")),
  );
};

const reload = async () => {
  markUpstreamBillingSortRefresh();
  syncAccountListDerivedParams();
  hasPendingListSync.value = false;
  resetAutoRefreshCache();
  pendingAccountMetricsRefresh.value = false;
  await baseReload();
  await refreshAccountPageMetrics();
};

const scheduleAccountReload = useDebounceFn(() => {
  void reload().catch(handleAccountListLoadError);
}, 300);

const refreshUpstreamBillingSortedList = async (force = false) => {
  if (sortState.sort_by !== "upstream_billing_rate") return;

  const minute = Math.floor(upstreamBillingNow.value / 60_000);
  if (!force && lastUpstreamBillingSortRefreshMinute === minute) return;
  lastUpstreamBillingSortRefreshMinute = minute;
  try {
    await reload();
  } catch (error) {
    console.error("Failed to refresh upstream billing sort:", error);
  }
};

const debouncedReload = () => {
  clearSelection();
  syncAccountListDerivedParams();
  hasPendingListSync.value = false;
  resetAutoRefreshCache();
  pendingAccountMetricsRefresh.value = true;
  scheduleAccountReload();
};

const handlePageChange = (page: number) => {
  syncAccountListDerivedParams();
  hasPendingListSync.value = false;
  resetAutoRefreshCache();
  pendingAccountMetricsRefresh.value = true;
  void baseHandlePageChange(page).catch(handleAccountListLoadError);
};

const handlePageSizeChange = (size: number) => {
  syncAccountListDerivedParams();
  hasPendingListSync.value = false;
  resetAutoRefreshCache();
  pendingAccountMetricsRefresh.value = true;
  void baseHandlePageSizeChange(size).catch(handleAccountListLoadError);
};

const handleSort = (key: string, order: AccountSortOrder) => {
  sortState.sort_by = key;
  sortState.sort_order = order;
  const requestParams = params as any;
  requestParams.sort_by = key;
  requestParams.sort_order = order;
  syncAccountListDerivedParams();
  pagination.page = 1;
  hasPendingListSync.value = false;
  resetAutoRefreshCache();
  pendingAccountMetricsRefresh.value = true;
  void load().catch(handleAccountListLoadError);
};

watch(loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading) {
    upstreamBillingNow.value = Date.now();
  }
  if (wasLoading && !isLoading && pendingAccountMetricsRefresh.value) {
    pendingAccountMetricsRefresh.value = false;
    refreshAccountPageMetrics().catch((error) => {
      console.error(
        "Failed to refresh account metrics after table load:",
        error,
      );
    });
  }
});

watch(upstreamBillingNow, () => {
  if (sortState.sort_by !== "upstream_billing_rate" || loading.value) return;
  if (typeof document !== "undefined" && document.hidden) return;
  void refreshUpstreamBillingSortedList();
});

const isAnyModalOpen = computed(() => {
  return (
    showCreate.value ||
    showEdit.value ||
    showSync.value ||
    showImportData.value ||
    showExportDataDialog.value ||
    showBulkEdit.value ||
    showTempUnsched.value ||
    showDeleteDialog.value ||
    bulkConfirmation.value !== null ||
    showReAuth.value ||
    showTest.value ||
    showStats.value ||
    showSchedulePanel.value ||
    showErrorPassthrough.value ||
    showTLSFingerprintProfiles.value
  );
});

const enterAutoRefreshSilentWindow = () => {
  autoRefreshSilentUntil.value = Date.now() + AUTO_REFRESH_SILENT_WINDOW_MS;
  autoRefreshCountdown.value = autoRefreshIntervalSeconds.value;
};

const inAutoRefreshSilentWindow = () => {
  return Date.now() < autoRefreshSilentUntil.value;
};

const shouldReplaceAutoRefreshRow = (current: Account, next: Account) => {
  return (
    current.updated_at !== next.updated_at ||
    current.current_concurrency !== next.current_concurrency ||
    current.current_window_cost !== next.current_window_cost ||
    current.active_sessions !== next.active_sessions ||
    current.schedulable !== next.schedulable ||
    current.status !== next.status ||
    current.rate_limit_reset_at !== next.rate_limit_reset_at ||
    current.overload_until !== next.overload_until ||
    current.temp_unschedulable_until !== next.temp_unschedulable_until ||
    buildOpenAIUsageRefreshKey(current) !== buildOpenAIUsageRefreshKey(next) ||
    buildGrokUsageRefreshKey(current) !== buildGrokUsageRefreshKey(next)
  );
};

const syncAccountRefs = (nextAccount: Account) => {
  if (edAcc.value?.id === nextAccount.id) edAcc.value = nextAccount;
  if (reAuthAcc.value?.id === nextAccount.id) reAuthAcc.value = nextAccount;
  if (tempUnschedAcc.value?.id === nextAccount.id)
    tempUnschedAcc.value = nextAccount;
  if (deletingAcc.value?.id === nextAccount.id) deletingAcc.value = nextAccount;
  if (menu.acc?.id === nextAccount.id) menu.acc = nextAccount;
};

const mergeAccountsIncrementally = (nextRows: Account[]): boolean => {
  if (prioritySavingIds.size > 0) {
    return false;
  }
  const currentRows = accounts.value;
  const currentByID = new Map(currentRows.map((row) => [row.id, row]));
  let changed = nextRows.length !== currentRows.length;
  const mergedRows = nextRows.map((nextRow) => {
    const currentRow = currentByID.get(nextRow.id);
    if (!currentRow) {
      changed = true;
      return nextRow;
    }
    if (shouldReplaceAutoRefreshRow(currentRow, nextRow)) {
      changed = true;
      syncAccountRefs(nextRow);
      return nextRow;
    }
    return currentRow;
  });
  if (!changed) {
    for (let i = 0; i < mergedRows.length; i += 1) {
      if (mergedRows[i].id !== currentRows[i]?.id) {
        changed = true;
        break;
      }
    }
  }
  if (changed) {
    accounts.value = mergedRows;
  }
  return true;
};

const refreshAccountsIncrementally = async () => {
  if (autoRefreshFetching.value) return;
  syncAccountListDerivedParams();
  autoRefreshFetching.value = true;
  try {
    const result = await adminAPI.accounts.listWithEtag(
      pagination.page,
      pagination.page_size,
      toRaw(params) as {
        platform?: string;
        type?: string;
        status?: string;
        privacy_mode?: string;
        group?: string;
        search?: string;
        sort_by?: string;
        sort_order?: AccountSortOrder;
      },
      { etag: autoRefreshETag.value },
    );

    if (result.etag) {
      autoRefreshETag.value = result.etag;
    }
    if (!result.notModified && result.data) {
      const merged = mergeAccountsIncrementally(result.data.items || []);
      hasPendingListSync.value = !merged;
      if (merged) {
        pagination.total = result.data.total || 0;
        pagination.pages = result.data.pages || 0;
        markUpstreamBillingSortRefresh();
      } else {
        autoRefreshETag.value = null;
      }
    }
    upstreamBillingNow.value = Date.now();

    await refreshAccountPageMetrics();
  } catch (error) {
    console.error("Auto refresh failed:", error);
  } finally {
    autoRefreshFetching.value = false;
  }
};

const handleManualRefresh = async () => {
  try {
    await Promise.all([load(), loadUpstreamBillingProbeGlobalState()]);
    // Force usage cells to refetch /usage on explicit user refresh.
    usageManualRefreshToken.value += 1;
  } catch (error) {
    handleAccountListLoadError(error);
  }
};

const loadUpstreamBillingProbeGlobalState = async () => {
  try {
    const settings = await adminAPI.accounts.getUpstreamBillingProbeSettings();
    upstreamBillingProbeGloballyEnabled.value = settings.enabled;
  } catch (error) {
    console.error("Failed to load upstream billing probe settings:", error);
  }
};

const openSyncFromCrs = () => {
  showSync.value = true;
};

const openImportData = () => {
  showImportData.value = true;
};

const openExportDataDialogFromMenu = () => {
  openExportDataDialog();
};

const openErrorPassthrough = () => {
  showErrorPassthrough.value = true;
};

const openTLSFingerprintProfiles = () => {
  showTLSFingerprintProfiles.value = true;
};

const syncPendingListChanges = async () => {
  hasPendingListSync.value = false;
  await load();
  // Keep behavior consistent with manual refresh.
  usageManualRefreshToken.value += 1;
};

const { pause: pauseAutoRefresh, resume: resumeAutoRefresh } = useIntervalFn(
  async () => {
    if (!autoRefreshEnabled.value) return;
    if (document.hidden) return;
    if (loading.value || autoRefreshFetching.value) return;
    if (isAnyModalOpen.value) return;
    if (
      menu.show ||
      showAccountToolsDropdown.value ||
      showAutoRefreshDropdown.value
    )
      return;
    if (inAutoRefreshSilentWindow()) {
      autoRefreshCountdown.value = Math.max(
        0,
        Math.ceil((autoRefreshSilentUntil.value - Date.now()) / 1000),
      );
      return;
    }

    if (autoRefreshCountdown.value <= 0) {
      autoRefreshCountdown.value = autoRefreshIntervalSeconds.value;
      await refreshAccountsIncrementally();
      return;
    }

    autoRefreshCountdown.value -= 1;
  },
  1000,
  { immediate: false },
);

const GROK_QUOTA_SIGNAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GROK_QUOTA_SIGNAL_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function firstNonBlankString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

function normalizeGrokPlanKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function grokPersistedQuotaSnapshot(
  extra: Record<string, any>,
): Record<string, any> | undefined {
  const usage = extra.grok_usage_snapshot;
  if (usage && typeof usage === "object" && !Array.isArray(usage)) return usage;
  const legacy = extra.grok_quota_snapshot;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) return legacy;
  return undefined;
}

function isGrokQuotaTimestampFresh(raw: unknown): boolean {
  const value = String(raw || "").trim();
  if (!value) return false;
  const observedAt = Date.parse(value);
  if (!Number.isFinite(observedAt)) return false;
  const age = Date.now() - observedAt;
  return (
    age <= GROK_QUOTA_SIGNAL_MAX_AGE_MS &&
    age >= -GROK_QUOTA_SIGNAL_MAX_FUTURE_SKEW_MS
  );
}

function isGrok45ResponsesQuotaModel(model: unknown): boolean {
  const value = String(model || "")
    .trim()
    .toLowerCase()
    .replace(/^(x-ai|xai)\//, "");
  return value === "grok-4.5" || value.startsWith("grok-4.5-");
}

function grokQuotaLooksHeavy(snapshot: Record<string, any> | undefined): boolean {
  const requests = Number(snapshot?.requests?.limit ?? 0);
  const tokens = Number(snapshot?.tokens?.limit ?? 0);
  return requests >= 8300 || tokens >= 53_000_000;
}

function grok45ResponsesPlanIsHeavy(
  snapshot: Record<string, any> | undefined,
): boolean {
  if (!snapshot) return false;
  const hint = normalizeGrokPlanKey(snapshot.plan_from_45_responses);
  if (
    hint === "supergrokheavy" &&
    isGrokQuotaTimestampFresh(snapshot.plan_from_45_responses_at)
  ) {
    return true;
  }
  const observedAt = snapshot.last_headers_seen_at || snapshot.updated_at;
  return (
    isGrok45ResponsesQuotaModel(snapshot.model) &&
    isGrokQuotaTimestampFresh(observedAt) &&
    grokQuotaLooksHeavy(snapshot)
  );
}

function getAccountPlanType(row: any): string | undefined {
  if (!row) return undefined;
  if (row.platform === "grok") {
    const extra = (row.extra || {}) as Record<string, any>;
    const billing = extra.grok_billing_snapshot as
      Record<string, any> | undefined;
    const usage = extra.grok_usage_snapshot as Record<string, any> | undefined;
    const legacyQuota = extra.grok_quota_snapshot as Record<string, any> | undefined;
    const quota = grokPersistedQuotaSnapshot(extra);
    const credentialTier = firstNonBlankString(row.credentials?.subscription_tier);
    const credentialKey = normalizeGrokPlanKey(credentialTier);
    if (credentialKey && credentialKey !== "supergrokpro") return credentialTier;
    if (
      grok45ResponsesPlanIsHeavy(quota) &&
      (credentialKey === "supergrokpro" ||
        ["supergrok", "supergrokpro"].includes(normalizeGrokPlanKey(billing?.plan)))
    ) {
      return "SuperGrok Heavy";
    }
    if (credentialKey === "supergrokpro") {
      return firstNonBlankString(billing?.plan) || "SuperGrok";
    }
    return firstNonBlankString(
      billing?.plan,
      usage?.subscription_tier,
      legacyQuota?.subscription_tier,
      extra.subscription_tier,
      row.credentials?.plan_type,
      row.parent_plan_type,
    );
  }
  return firstNonBlankString(row.credentials?.plan_type, row.parent_plan_type);
}

function getOpenAIAuthMode(row: any): string | undefined {
  if (!row || row.platform !== "openai" || row.type !== "oauth")
    return undefined;
  const authMode = row.credentials?.auth_mode;
  return typeof authMode === "string" && authMode.trim() ? authMode : undefined;
}

// Antigravity 订阅等级辅助函数
function getAntigravityTierFromRow(row: any): string | null {
  if (row.platform !== "antigravity") return null;
  const extra = row.extra as Record<string, unknown> | undefined;
  if (!extra) return null;
  const lca = extra.load_code_assist as Record<string, unknown> | undefined;
  if (!lca) return null;
  const paid = lca.paidTier as Record<string, unknown> | undefined;
  if (paid && typeof paid.id === "string") return paid.id;
  const current = lca.currentTier as Record<string, unknown> | undefined;
  if (current && typeof current.id === "string") return current.id;
  return null;
}

function getAntigravityTierLabel(row: any): string | null {
  const tier = getAntigravityTierFromRow(row);
  switch (tier) {
    case "free-tier":
      return t("admin.accounts.tier.free");
    case "g1-pro-tier":
      return t("admin.accounts.tier.pro");
    case "g1-ultra-tier":
      return t("admin.accounts.tier.ultra");
    default:
      return null;
  }
}

// 账号显示邮箱:优先账号自身(extra/credentials),影子账号回退母账号 parent_email。
// 供名称单元格 v-if/标题/文本三处共用,避免同一回退链在模板里重复三次。
function accountDisplayEmail(row: any): string {
  return (
    row.extra?.email_address ||
    row.extra?.email ||
    row.credentials?.email ||
    row.parent_email ||
    ""
  );
}

function accountHomepageUrl(row: Account): string {
  if (row.type !== "apikey" || typeof row.credentials?.base_url !== "string")
    return "";
  const baseUrl = sanitizeUrl(row.credentials.base_url);
  return baseUrl ? new URL(baseUrl).origin : "";
}

type OpenAICompactBadgeState = "active" | "blocked" | "auto";

function getOpenAICompactState(row: any): OpenAICompactBadgeState | null {
  if (
    row.platform !== "openai" ||
    (row.type !== "oauth" && row.type !== "apikey")
  )
    return null;
  const extra = row.extra as Record<string, unknown> | undefined;
  const mode =
    typeof extra?.openai_compact_mode === "string"
      ? extra.openai_compact_mode
      : "auto";
  if (mode === "force_on") return "active";
  if (mode === "force_off") return "blocked";
  if (typeof extra?.openai_compact_supported === "boolean") {
    return extra.openai_compact_supported ? "active" : "blocked";
  }
  return "auto";
}

function getOpenAICompactMeta(
  row: any,
): { label: string; className: string; dotClass: string } | null {
  const state = getOpenAICompactState(row);
  if (!state) return null;
  switch (state) {
    case "active":
      return {
        label: t("admin.accounts.openai.compactSupported"),
        className: "accounts-compact--active",
        dotClass: "accounts-compact__dot--active",
      };
    case "blocked":
      return {
        label: t("admin.accounts.openai.compactUnsupported"),
        className: "accounts-compact--blocked",
        dotClass: "accounts-compact__dot--blocked",
      };
    case "auto":
      return {
        label: t("admin.accounts.openai.compactAuto"),
        className: "accounts-compact--auto",
        dotClass: "accounts-compact__dot--auto",
      };
  }
}

function getOpenAICompactTitle(row: any): string {
  const extra = row.extra as Record<string, unknown> | undefined;
  const checkedAt =
    typeof extra?.openai_compact_checked_at === "string"
      ? extra.openai_compact_checked_at
      : "";
  const label = getOpenAICompactMeta(row)?.label || "";
  if (!checkedAt) return label;
  return `${label} | ${t("admin.accounts.openai.compactLastChecked")}: ${formatDateTime(new Date(checkedAt))}`;
}

function getAntigravityTierClass(row: any): string {
  const tier = getAntigravityTierFromRow(row);
  switch (tier) {
    case "free-tier":
      return "accounts-tier--free";
    case "g1-pro-tier":
      return "accounts-tier--pro";
    case "g1-ultra-tier":
      return "accounts-tier--ultra";
    default:
      return "";
  }
}

// All available columns
const allColumns = computed(() => {
  const c = [
    { key: "select", label: "", sortable: false },
    { key: "name", label: t("admin.accounts.columns.name"), sortable: true },
    {
      key: "service_status",
      label: t("admin.accounts.columns.serviceStatus"),
      sortable: false,
      class: "accounts-column-service",
    },
    {
      key: "priority",
      label: t("admin.accounts.columns.priority"),
      sortable: true,
      class: "accounts-column-priority",
    },
    { key: "id", label: t("admin.accounts.columns.id"), sortable: true },
    {
      key: "platform_type",
      label: t("admin.accounts.columns.platformType"),
      sortable: false,
    },
    {
      key: "capacity",
      label: t("admin.accounts.columns.capacity"),
      sortable: false,
    },
    {
      key: "status",
      label: t("admin.accounts.columns.status"),
      sortable: true,
    },
    {
      key: "schedulable",
      label: t("admin.accounts.columns.schedulable"),
      sortable: true,
    },
    {
      key: "today_stats",
      label: t("admin.accounts.columns.todayStats"),
      sortable: false,
    },
  ];
  if (!authStore.isSimpleMode) {
    c.push({
      key: "groups",
      label: t("admin.accounts.columns.groups"),
      sortable: false,
    });
  }
  c.push({
    key: "usage",
    label: t("admin.accounts.columns.usageWindows"),
    sortable: false,
  });
  c.push(
    { key: "proxy", label: t("admin.accounts.columns.proxy"), sortable: false },
    {
      key: "scheduler_score",
      label: t("admin.accounts.columns.schedulerScore"),
      sortable: false,
    },
    {
      key: "rate_multiplier",
      label: t("admin.accounts.columns.billingRateMultiplier"),
      sortable: true,
    },
    {
      key: "upstream_billing_rate",
      label: t("admin.accounts.columns.upstreamBillingRate"),
      sortable: true,
    },
    {
      key: "last_used_at",
      label: t("admin.accounts.columns.lastUsed"),
      sortable: true,
    },
    {
      key: "created_at",
      label: t("admin.accounts.columns.createdAt"),
      sortable: true,
    },
    {
      key: "expires_at",
      label: t("admin.accounts.columns.expiresAt"),
      sortable: true,
    },
    { key: "notes", label: t("admin.accounts.columns.notes"), sortable: false },
    {
      key: "actions",
      label: t("admin.accounts.columns.actions"),
      sortable: false,
    },
  );
  return c;
});

// Identity and passive service health remain fixed so the two always read as one row summary.
const toggleableColumns = computed(() =>
  allColumns.value.filter(
    (col) => !["select", "name", "service_status", "actions"].includes(col.key),
  ),
);

// Filtered columns based on visibility
const cols = computed(() =>
  allColumns.value.filter(
    (col) =>
      col.key === "select" ||
      col.key === "name" ||
      col.key === "service_status" ||
      col.key === "actions" ||
      !hiddenColumns.has(col.key),
  ),
);

const handleEdit = (a: Account) => {
  edAcc.value = a;
  showEdit.value = true;
};
const openMenu = (a: Account, e: MouseEvent) => {
  menu.acc = a;

  const target = e.currentTarget as HTMLElement;
  if (target) {
    const rect = target.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = Math.min(360, Math.max(0, window.innerHeight - 16));
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left: number;
    let top: number;

    if (viewportWidth < 768) {
      // 居中显示,水平位置
      left = Math.max(
        padding,
        Math.min(
          rect.left + rect.width / 2 - menuWidth / 2,
          viewportWidth - menuWidth - padding,
        ),
      );

      // 优先显示在按钮下方
      top = rect.bottom + 4;

      // 如果下方空间不够,显示在上方
      if (top + menuHeight > viewportHeight - padding) {
        top = rect.top - menuHeight - 4;
        // 如果上方也不够,就贴在视口顶部
        if (top < padding) {
          top = padding;
        }
      }
    } else {
      left = Math.max(
        padding,
        Math.min(e.clientX - menuWidth, viewportWidth - menuWidth - padding),
      );
      top = e.clientY;
      if (top + menuHeight > viewportHeight - padding) {
        top = viewportHeight - menuHeight - padding;
      }
    }

    menu.pos = { top, left };
  } else {
    menu.pos = { top: e.clientY, left: e.clientX - 200 };
  }

  menu.show = true;
};
const handleBulkDelete = async () => {
  if (bulkActionPending.value) return;
  const accountIds = [...selIds.value];
  bulkConfirmation.value = { kind: "delete", ids: accountIds };
};
const handleBulkResetStatus = async () => {
  if (bulkActionPending.value) return;
  bulkConfirmation.value = { kind: "reset-status", ids: [...selIds.value] };
};
const handleBulkRefreshToken = async () => {
  if (bulkActionPending.value) return;
  bulkConfirmation.value = { kind: "refresh-token", ids: [...selIds.value] };
};

type BulkAccountActionResult = {
  failed_ids?: number[];
  errors?: Array<{ account_id?: number }>;
  results?: Array<{ account_id?: number; success?: boolean }>;
};

function failedAccountIds(
  result: BulkAccountActionResult,
  actionIds: number[],
): number[] {
  const allowed = new Set(actionIds);
  const collect = (ids: Array<number | undefined>): number[] =>
    Array.from(new Set(ids.filter((id): id is number => id != null && allowed.has(id))));

  // Newer endpoints return an explicit failed_ids list.  Older batch-clear and
  // batch-refresh responses expose the same information through errors/results,
  // so prefer those details before falling back to the original selection.
  const explicit = collect(result.failed_ids ?? []);
  if (explicit.length > 0) return explicit;

  const detailIds = collect([
    ...(result.errors ?? []).map((entry) => entry.account_id),
    ...(result.results ?? [])
      .filter((entry) => entry.success === false)
      .map((entry) => entry.account_id),
  ]);
  return detailIds.length > 0 ? detailIds : [...actionIds];
}

const confirmBulkAction = async () => {
  if (bulkActionPending.value || !bulkConfirmation.value) return;
  const action = bulkConfirmation.value;
  bulkActionPending.value = true;
  let keepConfirmation = false;
  try {
    if (action.kind === "delete") {
      const result = await adminAPI.accounts.batchDelete(action.ids);
      if (result.failed > 0) {
        appStore.showError(
          t("admin.accounts.bulkActions.partialSuccess", {
            success: result.success,
            failed: result.failed,
          }),
        );
        const failedIds = failedAccountIds(result, action.ids);
        setSelectedIds(failedIds);
        bulkConfirmation.value = { ...action, ids: failedIds };
        keepConfirmation = true;
      } else {
        appStore.showSuccess(t("admin.accounts.bulkActions.deleteSuccess", { count: result.success }));
        clearSelection();
      }
    } else if (action.kind === "reset-status") {
      const result = await adminAPI.accounts.batchClearError(action.ids);
      if (result.failed > 0) {
        appStore.showError(t("admin.accounts.bulkActions.partialSuccess", { success: result.success, failed: result.failed }));
        const failedIds = failedAccountIds(result, action.ids);
        setSelectedIds(failedIds);
        bulkConfirmation.value = { ...action, ids: failedIds };
        keepConfirmation = true;
      } else {
        appStore.showSuccess(t("admin.accounts.bulkActions.resetStatusSuccess", { count: result.success }));
        clearSelection();
      }
    } else {
      const result = await adminAPI.accounts.batchRefresh(action.ids);
      if (result.failed > 0) {
        appStore.showError(t("admin.accounts.bulkActions.partialSuccess", { success: result.success, failed: result.failed }));
        const failedIds = failedAccountIds(result, action.ids);
        setSelectedIds(failedIds);
        bulkConfirmation.value = { ...action, ids: failedIds };
        keepConfirmation = true;
      } else {
        appStore.showSuccess(t("admin.accounts.bulkActions.refreshTokenSuccess", { count: result.success }));
        clearSelection();
      }
    }
    if (!keepConfirmation) bulkConfirmation.value = null;
    await reload();
  } catch (error) {
    console.error("Failed to complete bulk account action:", error);
    appStore.showError(String(error));
  } finally {
    bulkActionPending.value = false;
  }
};
const handleBulkProbeUpstreamBilling = async () => {
  if (bulkActionPending.value) return;
  const accountIDs = [...selIds.value];
  if (accountIDs.length === 0) {
    appStore.showError(t("admin.accounts.upstreamBilling.noEligibleAccounts"));
    return;
  }
  if (accountIDs.length > 20) {
    appStore.showError(t("admin.accounts.upstreamBilling.batchLimit"));
    return;
  }
  bulkActionPending.value = true;
  accountIDs.forEach((id) => probingUpstreamBilling.add(id));
  try {
    const results =
      await adminAPI.accounts.probeUpstreamBillingBatch(accountIDs);
    let patched = false;
    results.forEach((result) => {
      if (result.snapshot) {
        patchUpstreamBillingSnapshot(result.account_id, result.snapshot);
        patched = true;
      }
    });
    if (patched) await refreshAccountsAfterUpstreamBillingProbe();
    const failed = results.filter((result) => result.error).length;
    if (failed > 0) {
      appStore.showError(
        t("admin.accounts.upstreamBilling.batchPartial", {
          success: results.length - failed,
          failed,
        }),
      );
    } else {
      appStore.showSuccess(
        t("admin.accounts.upstreamBilling.batchCompleted", {
          count: results.length,
        }),
      );
    }
  } catch (error) {
    console.error("Failed to probe upstream billing in batch:", error);
    appStore.showError(
      extractApiErrorMessage(
        error,
        t("admin.accounts.upstreamBilling.probeFailed"),
      ),
    );
  } finally {
    accountIDs.forEach((id) => probingUpstreamBilling.delete(id));
    bulkActionPending.value = false;
  }
};
const updateSchedulableInList = (
  accountIds: number[],
  schedulable: boolean,
) => {
  if (accountIds.length === 0) return;
  const idSet = new Set(accountIds);
  accounts.value = accounts.value.map((account) =>
    idSet.has(account.id) ? { ...account, schedulable } : account,
  );
};
const normalizeBulkSchedulableResult = (
  result: {
    success?: number;
    failed?: number;
    success_ids?: number[];
    failed_ids?: number[];
    results?: Array<{ account_id: number; success: boolean }>;
  },
  accountIds: number[],
) => {
  const responseSuccessIds = Array.isArray(result.success_ids)
    ? result.success_ids
    : [];
  const responseFailedIds = Array.isArray(result.failed_ids)
    ? result.failed_ids
    : [];
  if (responseSuccessIds.length > 0 || responseFailedIds.length > 0) {
    return {
      successIds: responseSuccessIds,
      failedIds: responseFailedIds,
      successCount:
        typeof result.success === "number"
          ? result.success
          : responseSuccessIds.length,
      failedCount:
        typeof result.failed === "number"
          ? result.failed
          : responseFailedIds.length,
      hasIds: true,
      hasCounts: true,
    };
  }

  const results = Array.isArray(result.results) ? result.results : [];
  if (results.length > 0) {
    const successIds = results
      .filter((item) => item.success)
      .map((item) => item.account_id);
    const failedIds = results
      .filter((item) => !item.success)
      .map((item) => item.account_id);
    return {
      successIds,
      failedIds,
      successCount:
        typeof result.success === "number" ? result.success : successIds.length,
      failedCount:
        typeof result.failed === "number" ? result.failed : failedIds.length,
      hasIds: true,
      hasCounts: true,
    };
  }

  const hasExplicitCounts =
    typeof result.success === "number" || typeof result.failed === "number";
  const successCount = typeof result.success === "number" ? result.success : 0;
  const failedCount = typeof result.failed === "number" ? result.failed : 0;
  if (
    hasExplicitCounts &&
    failedCount === 0 &&
    successCount === accountIds.length &&
    accountIds.length > 0
  ) {
    return {
      successIds: accountIds,
      failedIds: [],
      successCount,
      failedCount,
      hasIds: true,
      hasCounts: true,
    };
  }

  return {
    successIds: [],
    failedIds: [],
    successCount,
    failedCount,
    hasIds: false,
    hasCounts: hasExplicitCounts,
  };
};
const handleBulkToggleSchedulable = async (schedulable: boolean) => {
  if (bulkActionPending.value) return;
  const accountIds = [...selIds.value];
  bulkActionPending.value = true;
  try {
    const result = await adminAPI.accounts.bulkUpdate(accountIds, {
      schedulable,
    });
    const {
      successIds,
      failedIds,
      successCount,
      failedCount,
      hasIds,
      hasCounts,
    } = normalizeBulkSchedulableResult(result, accountIds);
    if (!hasIds && !hasCounts) {
      appStore.showError(t("admin.accounts.bulkSchedulableResultUnknown"));
      setSelectedIds(accountIds);
      load().catch((error) => {
        console.error("Failed to refresh accounts:", error);
      });
      return;
    }
    if (successIds.length > 0) {
      updateSchedulableInList(successIds, schedulable);
    }
    if (successCount > 0 && failedCount === 0) {
      const message = schedulable
        ? t("admin.accounts.bulkSchedulableEnabled", { count: successCount })
        : t("admin.accounts.bulkSchedulableDisabled", { count: successCount });
      appStore.showSuccess(message);
    }
    if (failedCount > 0) {
      const message =
        hasCounts || hasIds
          ? t("admin.accounts.bulkSchedulablePartial", {
              success: successCount,
              failed: failedCount,
            })
          : t("admin.accounts.bulkSchedulableResultUnknown");
      appStore.showError(message);
      setSelectedIds(failedIds.length > 0 ? failedIds : accountIds);
    } else {
      if (hasIds) clearSelection();
      else setSelectedIds(accountIds);
    }
  } catch (error) {
    console.error("Failed to bulk toggle schedulable:", error);
    appStore.showError(t("common.error"));
  } finally {
    bulkActionPending.value = false;
  }
};
const buildBulkEditFilterSnapshot = () => {
  const rawParams = toRaw(params) as Record<string, unknown>;
  const sortOrder: AccountSortOrder =
    rawParams.sort_order === "desc" ? "desc" : "asc";
  return {
    platform: typeof rawParams.platform === "string" ? rawParams.platform : "",
    type: typeof rawParams.type === "string" ? rawParams.type : "",
    status: typeof rawParams.status === "string" ? rawParams.status : "",
    group: typeof rawParams.group === "string" ? rawParams.group : "",
    search: typeof rawParams.search === "string" ? rawParams.search : "",
    privacy_mode:
      typeof rawParams.privacy_mode === "string" ? rawParams.privacy_mode : "",
    sort_by: typeof rawParams.sort_by === "string" ? rawParams.sort_by : "",
    sort_order: sortOrder,
  };
};

const handleSelectAllResults = async () => {
  if (selectingAllResults.value || pagination.total === 0) return;

  const requestVersion = ++selectionRequestVersion.value;
  const filters = buildBulkEditFilterSnapshot();
  selectingAllResults.value = true;
  try {
    const ids = await fetchAllAccountIds(
      (page, pageSize, requestFilters) =>
        adminAPI.accounts.list(page, pageSize, requestFilters),
      filters,
    );
    if (requestVersion !== selectionRequestVersion.value) return;

    setSelectedIds(ids);
    selectedAllResultIDs.value = new Set(ids);
  } catch (error) {
    if (requestVersion !== selectionRequestVersion.value) return;
    console.error("Failed to select all account results:", error);
    appStore.showError(t("admin.accounts.bulkActions.selectAllFailed"));
  } finally {
    if (requestVersion === selectionRequestVersion.value) {
      selectingAllResults.value = false;
    }
  }
};

const collectSelectionMetadata = (rows: Account[]) => {
  const selectedPlatforms = Array.from(
    new Set(rows.map((account) => account.platform)),
  );
  const selectedTypes = Array.from(
    new Set(rows.map((account) => account.type)),
  );
  return { selectedPlatforms, selectedTypes };
};

const openBulkEditSelected = () => {
  bulkEditTarget.value = {
    mode: "selected",
    accountIds: [...selIds.value],
    selectedPlatforms: [...selPlatforms.value],
    selectedTypes: [...selTypes.value],
  };
  showBulkEdit.value = true;
};

const openBulkEditFiltered = async () => {
  const filters = buildBulkEditFilterSnapshot();
  const preview = await adminAPI.accounts.list(1, 100, filters);
  const { selectedPlatforms, selectedTypes } = collectSelectionMetadata(
    preview.items,
  );
  bulkEditTarget.value = {
    mode: "filtered",
    filters,
    previewCount: preview.total,
    selectedPlatforms,
    selectedTypes,
  };
  showBulkEdit.value = true;
};

const handleBulkUpdated = () => {
  showBulkEdit.value = false;
  bulkEditTarget.value = null;
  clearSelection();
  reload();
};
const handleDataImported = () => {
  showImportData.value = false;
  reload();
};
const ACCOUNT_UNGROUPED_GROUP_QUERY_VALUE = "ungrouped";
const ACCOUNT_PRIVACY_MODE_UNSET_QUERY_VALUE = "__unset__";
const buildAccountQueryFilters = () => ({
  platform: params.platform || "",
  type: params.type || "",
  status: params.status || "",
  group: params.group || "",
  privacy_mode: params.privacy_mode || "",
  search: params.search || "",
  sort_by: sortState.sort_by,
  sort_order: sortState.sort_order,
});
const accountMatchesCurrentFilters = (account: Account) => {
  const filters = buildAccountQueryFilters();
  if (filters.platform && account.platform !== filters.platform) return false;
  if (filters.type && account.type !== filters.type) return false;
  if (filters.status) {
    const now = Date.now();
    const rateLimitResetAt = account.rate_limit_reset_at
      ? new Date(account.rate_limit_reset_at).getTime()
      : Number.NaN;
    const isRateLimited =
      Number.isFinite(rateLimitResetAt) && rateLimitResetAt > now;
    const tempUnschedUntil = account.temp_unschedulable_until
      ? new Date(account.temp_unschedulable_until).getTime()
      : Number.NaN;
    const isTempUnschedulable =
      Number.isFinite(tempUnschedUntil) && tempUnschedUntil > now;

    if (filters.status === "active") {
      if (
        account.status !== "active" ||
        isRateLimited ||
        isTempUnschedulable ||
        !account.schedulable
      )
        return false;
    } else if (filters.status === "rate_limited") {
      if (account.status !== "active" || !isRateLimited || isTempUnschedulable)
        return false;
    } else if (filters.status === "temp_unschedulable") {
      if (account.status !== "active" || !isTempUnschedulable) return false;
    } else if (filters.status === "unschedulable") {
      if (
        account.status !== "active" ||
        account.schedulable ||
        isRateLimited ||
        isTempUnschedulable
      )
        return false;
    } else if (account.status !== filters.status) {
      return false;
    }
  }
  if (filters.group) {
    const groupIds =
      account.group_ids ?? account.groups?.map((group) => group.id) ?? [];
    if (filters.group === ACCOUNT_UNGROUPED_GROUP_QUERY_VALUE) {
      if (groupIds.length > 0) return false;
    } else if (!groupIds.includes(Number(filters.group))) {
      return false;
    }
  }
  const privacyMode =
    typeof account.extra?.privacy_mode === "string"
      ? account.extra.privacy_mode
      : "";
  if (filters.privacy_mode) {
    if (filters.privacy_mode === ACCOUNT_PRIVACY_MODE_UNSET_QUERY_VALUE) {
      if (privacyMode.trim() !== "") return false;
    } else if (privacyMode !== filters.privacy_mode) {
      return false;
    }
  }
  const search = String(filters.search || "")
    .trim()
    .toLowerCase();
  if (search && !account.name.toLowerCase().includes(search)) return false;
  return true;
};
const mergeRuntimeFields = (
  oldAccount: Account,
  updatedAccount: Account,
): Account => ({
  ...updatedAccount,
  current_concurrency:
    updatedAccount.current_concurrency ?? oldAccount.current_concurrency,
  current_window_cost:
    updatedAccount.current_window_cost ?? oldAccount.current_window_cost,
  active_sessions: updatedAccount.active_sessions ?? oldAccount.active_sessions,
});

const syncPaginationAfterLocalRemoval = () => {
  const nextTotal = Math.max(0, pagination.total - 1);
  pagination.total = nextTotal;
  pagination.pages =
    nextTotal > 0 ? Math.ceil(nextTotal / pagination.page_size) : 0;

  const maxPage = Math.max(1, pagination.pages || 1);

  if (pagination.page > maxPage) {
    pagination.page = maxPage;
  }
  // 行被本地移除后不立刻全量补页，改为提示用户手动同步。
  hasPendingListSync.value = nextTotal > 0;
};

const patchAccountInList = (updatedAccount: Account) => {
  const index = accounts.value.findIndex(
    (account) => account.id === updatedAccount.id,
  );
  if (index === -1) return;
  const mergedAccount = mergeRuntimeFields(
    accounts.value[index],
    updatedAccount,
  );
  if (!accountMatchesCurrentFilters(mergedAccount)) {
    accounts.value = accounts.value.filter(
      (account) => account.id !== mergedAccount.id,
    );
    syncPaginationAfterLocalRemoval();
    removeSelectedAccounts([mergedAccount.id]);
    if (menu.acc?.id === mergedAccount.id) {
      menu.show = false;
      menu.acc = null;
    }
    return;
  }
  const nextAccounts = [...accounts.value];
  nextAccounts[index] = mergedAccount;
  accounts.value = nextAccounts;
  syncAccountRefs(mergedAccount);
};
const patchUpstreamBillingSnapshot = (
  accountID: number,
  snapshot: UpstreamBillingProbeSnapshot,
) => {
  const account = accounts.value.find((item) => item.id === accountID);
  if (!account) return;
  markUpstreamBillingSortRefresh();
  upstreamBillingNow.value = Date.now();
  patchAccountInList({
    ...account,
    extra: { ...account.extra, upstream_billing_probe: snapshot },
  });
};
const refreshAccountsAfterUpstreamBillingProbe = async () => {
  try {
    await load();
  } catch (error) {
    console.error(
      "Failed to refresh accounts after upstream billing probe:",
      error,
    );
  }
};
const handleProbeUpstreamBilling = async (account: Account) => {
  if (probingUpstreamBilling.has(account.id)) return;
  probingUpstreamBilling.add(account.id);
  try {
    const result = await adminAPI.accounts.probeUpstreamBilling(account.id);
    if (result.snapshot) {
      patchUpstreamBillingSnapshot(account.id, result.snapshot);
      await refreshAccountsAfterUpstreamBillingProbe();
    }
  } catch (error) {
    console.error("Failed to probe upstream billing:", error);
    appStore.showError(
      extractApiErrorMessage(
        error,
        t("admin.accounts.upstreamBilling.probeFailed"),
      ),
    );
  } finally {
    probingUpstreamBilling.delete(account.id);
  }
};
const handleAccountUpdated = (updatedAccount: Account) => {
  patchAccountInList(updatedAccount);
  enterAutoRefreshSilentWindow();
};
const formatExportTimestamp = () => {
  const now = new Date();
  const pad2 = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
};
const openExportDataDialog = () => {
  includeProxyOnExport.value = true;
  showExportDataDialog.value = true;
};
const closeExportDataDialog = () => {
  if (exportingData.value) return;
  showExportDataDialog.value = false;
};
const handleExportData = async () => {
  if (exportingData.value) return;
  exportingData.value = true;
  try {
    const dataPayload = await accountExportStepUp.run(() =>
      adminAPI.accounts.exportData(
        selIds.value.length > 0
          ? { ids: selIds.value, includeProxies: includeProxyOnExport.value }
          : {
              includeProxies: includeProxyOnExport.value,
              filters: buildAccountQueryFilters(),
            },
      ),
    );
    const timestamp = formatExportTimestamp();
    const filename = `sub2api-account-${timestamp}.json`;
    const blob = new Blob([JSON.stringify(dataPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    }, 0);
    // spark 影子账号被后端排除出备份(其凭据透传母账号、调度配置不可经凭据型导入重建);
    // 跳过非零时明确提示用户,避免「下载成功但少了账号」的静默丢失。
    if (dataPayload.skipped_shadows && dataPayload.skipped_shadows > 0) {
      appStore.showWarning(
        t("admin.accounts.dataExportedSkippedShadows", {
          count: dataPayload.skipped_shadows,
        }),
      );
    } else {
      appStore.showSuccess(t("admin.accounts.dataExported"));
    }
    showExportDataDialog.value = false;
  } catch (error: any) {
    if (isStepUpCancelled(error)) {
      // 用户主动取消 step-up 验证，静默返回，不弹错误提示。
      showExportDataDialog.value = false;
    } else if (isStepUpBlocked(error)) {
      appStore.showError(
        stepUpBlockReason(error) === "STEP_UP_ADMIN_API_KEY_FORBIDDEN"
          ? t("stepUp.adminApiKeyForbidden")
          : t("stepUp.notEnabled"),
      );
    } else {
      appStore.showError(
        error?.message || t("admin.accounts.dataExportFailed"),
      );
    }
  } finally {
    exportingData.value = false;
  }
};
const accountExportStepUp = useStepUp();
const closeTestModal = () => {
  showTest.value = false;
  testingAcc.value = null;
};
const closeStatsModal = () => {
  showStats.value = false;
  statsAcc.value = null;
};
const closeReAuthModal = () => {
  showReAuth.value = false;
  reAuthAcc.value = null;
};
const handleTest = (a: Account) => {
  testingAcc.value = a;
  showTest.value = true;
};
const handleViewStats = (a: Account) => {
  statsAcc.value = a;
  showStats.value = true;
};
const handleSchedule = async (a: Account) => {
  const requestSeq = ++scheduleModelsRequestSeq.value;
  scheduleAcc.value = a;
  scheduleModelOptions.value = [];
  showSchedulePanel.value = true;
  try {
    const models = await adminAPI.accounts.getAvailableModels(a.id);
    if (requestSeq === scheduleModelsRequestSeq.value && scheduleAcc.value?.id === a.id) {
      scheduleModelOptions.value = models.map((m: ClaudeModel) => ({
        value: m.id,
        label: m.display_name || m.id,
      }));
    }
  } catch {
    if (requestSeq === scheduleModelsRequestSeq.value && scheduleAcc.value?.id === a.id) {
      scheduleModelOptions.value = [];
    }
  }
};
const closeSchedulePanel = () => {
  scheduleModelsRequestSeq.value += 1;
  showSchedulePanel.value = false;
  scheduleAcc.value = null;
  scheduleModelOptions.value = [];
};
const handleReAuth = (a: Account) => {
  reAuthAcc.value = a;
  showReAuth.value = true;
};
const duplicatingAccountIDs = new Set<number>();
const handleDuplicateAccount = async (a: Account) => {
  if (duplicatingAccountIDs.has(a.id)) return;
  duplicatingAccountIDs.add(a.id);
  try {
    const duplicate = await adminAPI.accounts.duplicate(a.id);
    appStore.showSuccess(
      t("admin.accounts.duplicateSuccess", { name: duplicate.name }),
    );
    reload();
  } catch (error: any) {
    console.error("Failed to duplicate account:", error);
    appStore.showError(error?.message || t("admin.accounts.duplicateFailed"));
  } finally {
    duplicatingAccountIDs.delete(a.id);
  }
};
const handleRefresh = async (a: Account) => {
  if (accountOperationPendingIds.has(a.id)) return;
  accountOperationPendingIds.add(a.id);
  try {
    const updated = await adminAPI.accounts.refreshCredentials(a.id);
    patchAccountInList(updated);
    enterAutoRefreshSilentWindow();
  } catch (error) {
    console.error("Failed to refresh credentials:", error);
    appStore.showError(extractApiErrorMessage(error, t("common.error")));
  } finally {
    accountOperationPendingIds.delete(a.id);
  }
};
const handleRecoverState = async (a: Account) => {
  if (accountOperationPendingIds.has(a.id)) return;
  accountOperationPendingIds.add(a.id);
  try {
    const updated = await adminAPI.accounts.recoverState(a.id);
    patchAccountInList(updated);
    enterAutoRefreshSilentWindow();
    appStore.showSuccess(t("admin.accounts.recoverStateSuccess"));
  } catch (error: any) {
    console.error("Failed to recover account state:", error);
    appStore.showError(
      error?.message || t("admin.accounts.recoverStateFailed"),
    );
  } finally {
    accountOperationPendingIds.delete(a.id);
  }
};
const handleResetQuota = async (a: Account) => {
  if (accountOperationPendingIds.has(a.id)) return;
  accountOperationPendingIds.add(a.id);
  try {
    const updated = await adminAPI.accounts.resetAccountQuota(a.id);
    patchAccountInList(updated);
    enterAutoRefreshSilentWindow();
    appStore.showSuccess(t("common.success"));
  } catch (error) {
    console.error("Failed to reset quota:", error);
    appStore.showError(extractApiErrorMessage(error, t("common.error")));
  } finally {
    accountOperationPendingIds.delete(a.id);
  }
};

const privacyResultMessageKey = (
  account: Account,
): { type: "success" | "error"; key: string } => {
  const mode =
    typeof account.extra?.privacy_mode === "string"
      ? account.extra.privacy_mode
      : "";
  if (account.platform === "openai") {
    switch (mode) {
      case "training_off":
        return { type: "success", key: "admin.accounts.privacyTrainingOff" };
      case "training_set_cf_blocked":
        return { type: "error", key: "admin.accounts.privacyCfBlocked" };
      default:
        return { type: "error", key: "admin.accounts.privacyFailed" };
    }
  }
  if (account.platform === "antigravity") {
    if (mode === "privacy_set") {
      return { type: "success", key: "admin.accounts.privacyAntigravitySet" };
    }
    return { type: "error", key: "admin.accounts.privacyAntigravityFailed" };
  }
  return { type: "error", key: "admin.accounts.privacyFailed" };
};

const handleSetPrivacy = async (a: Account) => {
  if (accountOperationPendingIds.has(a.id)) return;
  accountOperationPendingIds.add(a.id);
  try {
    const updated = await adminAPI.accounts.setPrivacy(a.id);
    patchAccountInList(updated);
    enterAutoRefreshSilentWindow();
    const result = privacyResultMessageKey(updated);
    if (result.type === "success") {
      appStore.showSuccess(t(result.key));
    } else {
      appStore.showError(t(result.key));
    }
  } catch (error: any) {
    console.error("Failed to set privacy:", error);
    appStore.showError(
      error?.response?.data?.message || t("admin.accounts.privacyFailed"),
    );
  } finally {
    accountOperationPendingIds.delete(a.id);
  }
};
const onRevertFallback = async (a: Account) => {
  if (accountOperationPendingIds.has(a.id)) return;
  accountOperationPendingIds.add(a.id);
  try {
    await adminAPI.accounts.revertProxyFallback(a.id);
    appStore.showSuccess(t("admin.accounts.revertProxySuccess"));
    reload();
  } catch (error: any) {
    console.error("Failed to revert proxy fallback:", error);
    appStore.showError(
      error?.response?.data?.message || t("admin.accounts.revertProxyFailed"),
    );
  } finally {
    accountOperationPendingIds.delete(a.id);
  }
};
const handleCreateSparkShadow = (a: Account) => {
  creatingShadowAcc.value = a;
  showCreateShadowDialog.value = true;
};
const confirmCreateSparkShadow = async () => {
  const a = creatingShadowAcc.value;
  if (!a || accountOperationPendingIds.has(a.id)) return;
  accountOperationPendingIds.add(a.id);
  try {
    await adminAPI.accounts.createSparkShadow(a.id, {
      name: `${a.name} (Spark)`,
    });
    showCreateShadowDialog.value = false;
    creatingShadowAcc.value = null;
    appStore.showSuccess(t("admin.accounts.createSparkShadowSuccess"));
    reload();
  } catch (error: any) {
    console.error("Failed to create spark shadow:", error);
    appStore.showError(
      error?.response?.data?.message ||
        t("admin.accounts.createSparkShadowFailed"),
    );
  } finally {
    accountOperationPendingIds.delete(a.id);
  }
};
const handleDelete = (a: Account) => {
  deletingAcc.value = a;
  showDeleteDialog.value = true;
};
const confirmDelete = async () => {
  if (deletePending.value || !deletingAcc.value) return;
  const account = deletingAcc.value;
  deletePending.value = true;
  try {
    await adminAPI.accounts.delete(account.id);
    showDeleteDialog.value = false;
    deletingAcc.value = null;
    await reload();
  } catch (error) {
    console.error("Failed to delete account:", error);
    appStore.showError(extractApiErrorMessage(error, t("common.error")));
  } finally {
    deletePending.value = false;
  }
};
const handleToggleSchedulable = async (a: Account) => {
  if (togglingSchedulable.value !== null) return;
  const nextSchedulable = !a.schedulable;
  togglingSchedulable.value = a.id;
  try {
    const updated = await adminAPI.accounts.setSchedulable(
      a.id,
      nextSchedulable,
    );
    updateSchedulableInList([a.id], updated?.schedulable ?? nextSchedulable);
    enterAutoRefreshSilentWindow();
  } catch (error) {
    console.error("Failed to toggle schedulable:", error);
    appStore.showError(t("admin.accounts.failedToToggleSchedulable"));
  } finally {
    togglingSchedulable.value = null;
  }
};
const handleShowTempUnsched = (a: Account) => {
  tempUnschedAcc.value = a;
  showTempUnsched.value = true;
};
const handleTempUnschedReset = async (updated: Account) => {
  showTempUnsched.value = false;
  tempUnschedAcc.value = null;
  patchAccountInList(updated);
  enterAutoRefreshSilentWindow();
};
const formatExpiresAt = (value: number | null) => {
  if (!value) return "-";
  return formatDateTime(
    new Date(value * 1000),
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
    "sv-SE",
  );
};
const isExpired = (value: number | null) => {
  if (!value) return false;
  return value * 1000 <= Date.now();
};
// 所绑定代理的有效期(逻辑同 /admin/proxies,见 utils/proxyExpiry)
const proxyExpiryTone = (p: AccountProxy): "neutral" | "warning" | "danger" => {
  if (p.status === "expired") return "danger";
  const days = p.expires_at ? daysUntil(p.expires_at) : Number.POSITIVE_INFINITY;
  if (days <= EXPIRY_DANGER_DAYS) return "danger";
  if (days <= EXPIRY_WARN_DAYS) return "warning";
  return "neutral";
};
const proxyExpiryText = (p: AccountProxy): string => {
  const { key, params } = proxyExpiryLabelKey(p.expires_at, p.status);
  return params ? t(key, params) : t(key);
};

// 表格滚动时关闭行操作菜单。
const handleScroll = () => {
  menu.show = false;
};

onMounted(async () => {
  void load().catch(handleAccountListLoadError);
  loadUpstreamBillingProbeGlobalState();
  try {
    const [p, g] = await Promise.all([
      adminAPI.proxies.getAll(),
      adminAPI.groups.getAll(),
    ]);
    proxies.value = p;
    groups.value = g;
  } catch (error) {
    console.error("Failed to load proxies/groups:", error);
  }
  window.addEventListener("scroll", handleScroll, true);

  if (autoRefreshEnabled.value) {
    autoRefreshCountdown.value = autoRefreshIntervalSeconds.value;
    resumeAutoRefresh();
  } else {
    pauseAutoRefresh();
  }
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll, true);
});
</script>

<style scoped>
.accounts-page {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.accounts-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.accounts-workspace :deep(.ui-table-workspace__body),
.accounts-workspace :deep(.ui-data-table) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.accounts-checkbox :deep(span:last-child) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.accounts-auto-refresh-popover,
.accounts-tools-popover {
  display: grid;
  min-width: 0;
  gap: 4px;
  padding: 2px;
}

.accounts-tools-popover :deep(.ui-button) {
  justify-content: flex-start;
}

.accounts-tools-popover__label {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.accounts-tools-popover__columns {
  display: grid;
  gap: 4px;
  padding: 2px 6px 6px;
}

.accounts-action-label { display: inline-flex; align-items: center; gap: 4px; }
.accounts-sync-banner { margin-top: 8px; }
.accounts-sync-banner__content { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.accounts-table-host { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; }
.accounts-id { color: var(--ui-text-muted); font-family: var(--ui-font-mono); font-size: 11px; }
.accounts-cell-stack { display: grid; min-width: 0; gap: 4px; }
.accounts-cell-primary { color: var(--ui-text); font-weight: 600; }
.accounts-cell-meta { color: var(--ui-text-muted); font-size: 11px; }
.accounts-cell-meta--truncate { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.accounts-cell-empty { color: var(--ui-text-soft); font-size: 12px; }
.accounts-header-label { display: inline-flex; align-items: center; gap: 5px; }
.accounts-platform-cell { display: grid; min-width: 0; gap: 5px; }
.accounts-badge-row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.accounts-status-cell { display: inline-flex; align-items: center; gap: 6px; }
.accounts-proxy-line { display: inline-flex; align-items: center; gap: 8px; }
.accounts-fallback-actions { display: inline-flex; align-items: center; gap: 6px; }
.accounts-status-label { display: inline-flex; min-height: 20px; align-items: center; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; line-height: 14px; }
.accounts-status-label--warning { color: var(--ui-warning); background: color-mix(in srgb, var(--ui-warning) 10%, var(--ui-surface)); }
.accounts-status-label--success { color: var(--ui-success); background: color-mix(in srgb, var(--ui-success) 10%, var(--ui-surface)); }
.accounts-rate { display: inline-flex; align-items: center; gap: 5px; color: var(--ui-text-muted); font-family: var(--ui-font-mono); font-size: 12px; font-variant-numeric: tabular-nums; }
.accounts-rate-sync { display: inline-flex; color: var(--ui-success); }
.accounts-score-list { display: grid; min-width: 7rem; gap: 2px; color: var(--ui-text-muted); font-family: var(--ui-font-mono); font-size: 11px; line-height: 16px; }
.accounts-score-row { display: inline-flex; align-items: center; gap: 5px; overflow: hidden; white-space: nowrap; }
.accounts-score-group { max-width: 76px; overflow: hidden; color: var(--ui-text-muted); text-overflow: ellipsis; }
.accounts-score-separator { color: var(--ui-text-soft); }
.accounts-score-sticky { color: var(--ui-info); }
.accounts-expiry-cell { display: grid; justify-items: start; gap: 5px; }
.accounts-row-actions { display: inline-flex; align-items: center; gap: 5px; }
.accounts-tier { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
.accounts-tier--free { color: var(--ui-text-muted); background: var(--ui-surface-muted); }
.accounts-tier--pro { color: var(--ui-info); background: color-mix(in srgb, var(--ui-info) 10%, var(--ui-surface)); }
.accounts-tier--ultra { color: var(--ui-warning); background: color-mix(in srgb, var(--ui-warning) 10%, var(--ui-surface)); }
.accounts-compact { display: inline-flex; align-items: center; gap: 6px; padding-left: 2px; font-size: 11px; font-weight: 600; line-height: 16px; }
.accounts-compact__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ui-text-soft); }
.accounts-compact--active { color: var(--ui-success); }
.accounts-compact--blocked { color: var(--ui-danger); }
.accounts-compact--auto { color: var(--ui-text-muted); }
.accounts-compact__dot--active { background: var(--ui-success); }
.accounts-compact__dot--blocked { background: var(--ui-danger); }
.accounts-compact__dot--auto { background: var(--ui-text-soft); }
.accounts-spin { animation: accounts-spin 900ms linear infinite; }
.accounts-column-service { width: 200px; min-width: 200px; }
.accounts-column-priority { width: 128px; min-width: 128px; }
:global(.accounts-tooltip-wide) { width: min(320px, calc(100vw - 16px)); }
:global(.accounts-tooltip-medium) { width: min(288px, calc(100vw - 16px)); }
:global(.accounts-tooltip-break) { overflow-wrap: anywhere; white-space: normal; }
@keyframes accounts-spin { to { transform: rotate(360deg); } }
@media (max-width: 767px) { .accounts-action-label { display: none; } .accounts-sync-banner__content { align-items: flex-start; flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { .accounts-spin { animation: none; } }
</style>
