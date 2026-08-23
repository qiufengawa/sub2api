<template>
  <AppLayout>
    <UiServerTableWorkspace>
      <template #filters>
        <UiFilterBar class="proxies-filter-bar">
          <div class="proxies-filter-grid">
            <UiSearchInput
              v-model="searchQuery"
              density="compact"
              :debounce-ms="0"
              :placeholder="t('admin.proxies.searchProxies')"
              @search="handleSearch"
            />

            <UiSelect
              v-model="filters.protocol"
              :options="protocolOptions"
              density="compact"
              :placeholder="t('admin.proxies.allProtocols')"
              @change="loadProxies"
            />
            <UiSelect
              v-model="filters.status"
              :options="statusOptions"
              density="compact"
              :placeholder="t('admin.proxies.allStatus')"
              @change="loadProxies"
            />
          </div>

          <template #actions>
            <div class="proxies-toolbar-actions">
            <UiIconButton
              @click="loadProxies"
              :disabled="loading"
              :label="t('common.refresh')"
              density="compact"
            >
              <Icon name="refresh" size="sm" :class="{ 'proxies-spin': loading }" />
            </UiIconButton>
            <UiButton
              @click="handleBatchTest"
              :disabled="batchTesting || loading"
              :loading="batchTesting"
              density="compact"
            >
              <template #icon><Icon name="play" size="sm" /></template>
              {{ t('admin.proxies.testConnection') }}
            </UiButton>
            <UiButton
              @click="handleBatchQualityCheck"
              :disabled="batchQualityChecking || loading"
              :loading="batchQualityChecking"
              density="compact"
            >
              <template #icon><Icon name="shield" size="sm" /></template>
              {{ t('admin.proxies.batchQualityCheck') }}
            </UiButton>
            <UiButton
              data-test="batch-delete-proxies"
              @click="openBatchDelete"
              :disabled="selectedCount === 0"
              variant="danger"
              density="compact"
            >
              <template #icon><Icon name="trash" size="sm" /></template>
              {{ t('admin.proxies.batchDeleteAction') }}
            </UiButton>
            <UiButton density="compact" @click="showImportData = true">
              <template #icon><Icon name="upload" size="sm" /></template>
              {{ t('admin.proxies.dataImport') }}
            </UiButton>
            <UiButton density="compact" @click="showExportDataDialog = true">
              <template #icon><Icon name="download" size="sm" /></template>
              {{ selectedCount > 0 ? t('admin.proxies.dataExportSelected') : t('admin.proxies.dataExport') }}
            </UiButton>
            <UiButton data-test="create-proxy" density="compact" variant="primary" @click="showCreateModal = true">
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('admin.proxies.createProxy') }}
            </UiButton>
            </div>
          </template>
        </UiFilterBar>
      </template>

      <div ref="proxyTableRef" class="proxies-table-shell">
        <UiDataTable
          :columns="columns"
          :data="proxies"
          :loading="loading"
          :server-side-sort="true"
          default-sort-key="id"
          default-sort-order="desc"
          @sort="handleSort"
        >
          <template #header-select>
            <UiCheckbox
              :model-value="allVisibleSelected"
              :aria-label="t('common.selectAll')"
              @update:model-value="toggleSelectAllVisible"
            />
          </template>

          <template #cell-select="{ row }">
            <UiCheckbox
              :model-value="selectedProxyIds.has(row.id)"
              :aria-label="t('admin.proxies.selectProxy', { name: row.name })"
              @update:model-value="toggleSelectRow(row.id, $event)"
            />
          </template>

          <template #cell-name="{ value }">
            <span class="proxy-cell-strong">{{ value }}</span>
          </template>

          <template #cell-protocol="{ value }">
            <UiBadge v-if="value" :tone="value.startsWith('socks5') ? 'info' : 'neutral'">
              {{ value.toUpperCase() }}
            </UiBadge>
            <span v-else class="proxy-cell-empty">-</span>
          </template>

          <template #cell-address="{ row }">
            <div class="proxy-cell-inline">
              <code class="proxy-cell-code">{{ row.host }}:{{ row.port }}</code>
              <div class="proxy-cell-inline">
                <UiIconButton
                  type="button"
                  variant="ghost"
                  density="mini"
                  :label="t('admin.proxies.copyProxyUrl')"
                  @click.stop="copyProxyUrl(row)"
                >
                  <Icon name="copy" size="sm" />
                </UiIconButton>
                <UiDropdownMenu
                  :items="getCopyFormats(row).map((format) => ({ key: format.value, label: format.label }))"
                  placement="bottom-start"
                  @select="copyFormat($event.key)"
                >
                  <template #trigger>
                    <UiIconButton
                      type="button"
                      variant="ghost"
                      density="mini"
                      :label="t('admin.proxies.copyFormats')"
                      aria-haspopup="menu"
                    >
                      <Icon name="chevronDown" size="xs" />
                    </UiIconButton>
                  </template>
                </UiDropdownMenu>
              </div>
            </div>
          </template>

          <template #cell-auth="{ row }">
            <div v-if="row.username || row.password" class="proxy-cell-inline">
              <div class="proxy-auth-value">
                <span v-if="row.username">{{ row.username }}</span>
                <span v-if="row.password" class="proxy-auth-password">
                  {{ visiblePasswordIds.has(row.id) ? row.password : '••••••' }}
                </span>
              </div>
              <UiIconButton
                v-if="row.password"
                type="button"
                variant="ghost"
                density="mini"
                :label="t(visiblePasswordIds.has(row.id) ? 'admin.proxies.hidePassword' : 'admin.proxies.showPassword')"
                @click.stop="visiblePasswordIds.has(row.id) ? visiblePasswordIds.delete(row.id) : visiblePasswordIds.add(row.id)"
              >
                <Icon :name="visiblePasswordIds.has(row.id) ? 'eyeOff' : 'eye'" size="sm" />
              </UiIconButton>
            </div>
            <span v-else class="proxy-cell-empty">-</span>
          </template>

          <template #cell-location="{ row }">
            <div class="proxy-cell-inline proxy-location">
              <img
                v-if="row.country_code"
                :src="flagUrl(row.country_code)"
                :alt="row.country || row.country_code"
                class="proxy-location-flag"
              />
              <span v-if="formatLocation(row)" class="proxy-location-value">
                {{ formatLocation(row) }}
              </span>
              <span v-else class="proxy-cell-empty">-</span>
            </div>
          </template>

          <template #cell-account_count="{ row, value }">
            <UiButton
              v-if="(value || 0) > 0"
              type="button"
              variant="quiet"
              density="dense"
              @click="openAccountsModal(row)"
            >
              {{ t('admin.groups.accountsCount', { count: value || 0 }) }}
            </UiButton>
            <UiBadge v-else>
              {{ t('admin.groups.accountsCount', { count: 0 }) }}
            </UiBadge>
          </template>

          <template #cell-latency="{ row }">
            <div class="proxy-cell-stack">
              <UiStatusBadge
                v-if="row.latency_status === 'failed'"
                status="failed"
                :label="t('admin.proxies.latencyFailed')"
                :title="row.latency_message || undefined"
              />
              <UiBadge
                v-else-if="typeof row.latency_ms === 'number'"
                :tone="row.latency_ms < 200 ? 'success' : 'warning'"
              >
                {{ row.latency_ms }}ms
              </UiBadge>
              <span v-else class="proxy-cell-empty">-</span>
              <div
                v-if="typeof row.quality_checked === 'number'"
                class="proxy-quality-inline"
                :title="row.quality_summary || undefined"
              >
                <span>{{ t('admin.proxies.qualityInline', { grade: row.quality_grade || '-', score: row.quality_score ?? '-' }) }}</span>
                <UiStatusBadge :status="qualityStatusTone(row.quality_status)" :label="qualityOverallLabel(row.quality_status)" />
              </div>
            </div>
          </template>

          <template #cell-expiry="{ row }">
            <span v-if="!row.expires_at" class="proxy-cell-empty">{{ t('admin.proxies.neverExpires') }}</span>
            <div v-else class="proxy-cell-stack">
              <span class="proxy-expiry-value">{{ formatDateTime(row.expires_at) }}</span>
              <UiBadge :tone="expiryBadgeTone(row)">{{ expiryLabel(row) }}</UiBadge>
            </div>
          </template>

          <template #cell-created_at="{ row }">
            <span class="proxy-created-at">{{ formatDateTime(row.created_at) }}</span>
          </template>

          <template #cell-status="{ value }">
            <UiStatusBadge :status="value" :label="t('admin.accounts.status.' + value)" />
          </template>

          <template #cell-actions="{ row }">
            <div class="proxy-row-actions">
              <UiIconButton
                @click="handleTestConnection(row)"
                :disabled="testingProxyIds.has(row.id)"
                :label="t('admin.proxies.testConnection')"
                variant="success"
                density="compact"
              >
                <Icon v-if="testingProxyIds.has(row.id)" name="refresh" size="sm" class="proxies-spin" />
                <Icon v-else name="checkCircle" size="sm" />
              </UiIconButton>
              <UiIconButton
                @click="handleQualityCheck(row)"
                :disabled="qualityCheckingProxyIds.has(row.id)"
                :label="t('admin.proxies.qualityCheck')"
                variant="ghost"
                density="compact"
              >
                <Icon v-if="qualityCheckingProxyIds.has(row.id)" name="refresh" size="sm" class="proxies-spin" />
                <Icon v-else name="shield" size="sm" />
              </UiIconButton>
              <UiIconButton
                @click="handleEdit(row)"
                :label="t('common.edit')"
                icon="edit"
                variant="ghost"
                density="compact"
              />
              <UiIconButton
                @click="handleDelete(row)"
                :label="t('common.delete')"
                icon="trash"
                variant="danger"
                density="compact"
              >
              </UiIconButton>
            </div>
          </template>

          <template #empty>
            <UiEmptyState
              :title="t('admin.proxies.noProxiesYet')"
              :description="t('admin.proxies.createFirstProxy')"
            >
              <template #action>
                <UiButton density="compact" variant="primary" @click="showCreateModal = true">
                  {{ t('admin.proxies.createProxy') }}
                </UiButton>
              </template>
            </UiEmptyState>
          </template>
        </UiDataTable>
      </div>

      <template #pagination>
        <UiPagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          :summary-label="t('pagination.showing')"
          :page-size-label="t('pagination.perPage')"
          :previous-label="t('pagination.previous')"
          :next-label="t('pagination.next')"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </template>
    </UiServerTableWorkspace>

    <!-- Create Proxy Modal -->
    <UiDialog
      :show="showCreateModal"
      :title="t('admin.proxies.createProxy')"
      width="normal"
      @close="closeCreateModal"
    >
      <div class="proxy-form-tabs">
        <UiTabs
          :model-value="createMode"
          :tabs="createModeTabs"
          :label="t('admin.proxies.createProxy')"
          @update:model-value="setCreateMode"
        />
      </div>

      <!-- Standard Add Form -->
      <form
        v-if="createMode === 'standard'"
        id="create-proxy-form"
        @submit.prevent="handleCreateProxy"
        class="proxy-form"
      >
        <UiTextField v-model="createForm.name" required density="compact" :label="t('admin.proxies.name')" :placeholder="t('admin.proxies.enterProxyName')" />
        <UiSelect v-model="createForm.protocol" :options="protocolSelectOptions" density="compact" :label="t('admin.proxies.protocol')" />
        <div class="proxy-form-grid">
          <UiTextField v-model="createForm.host" required density="compact" :label="t('admin.proxies.host')" :placeholder="t('admin.proxies.form.hostPlaceholder')" />
          <UiTextField v-model.number="createForm.port" type="number" required min="1" max="65535" density="compact" :label="t('admin.proxies.port')" :placeholder="t('admin.proxies.form.portPlaceholder')" />
        </div>
        <UiTextField v-model="createForm.username" density="compact" :label="t('admin.proxies.username')" :placeholder="t('admin.proxies.optionalAuth')" />
        <UiPasswordField v-model="createForm.password" density="compact" :label="t('admin.proxies.password')" :placeholder="t('admin.proxies.optionalAuth')" />
        <div class="proxy-form-section">
          <div class="proxy-form-label">{{ t('admin.proxies.expiresAt') }}</div>
          <UiSegmentedControl
            :model-value="createExpiresDays ?? -1"
            :options="expiryPresetOptions"
            :label="t('admin.proxies.expiresAt')"
            @update:model-value="createExpiresDays = Number($event)"
          />
          <div class="proxy-expiry-grid">
            <UiTextField v-model.number="createExpiresDays" type="number" min="0" density="compact" :label="t('admin.proxies.expiryDaysPlaceholder')" />
            <UiDateInput v-model="createForm.expires_at" :label="t('admin.proxies.expiresAt')" />
          </div>
        </div>
        <UiSelect v-model="createForm.fallback_mode" density="compact" :label="t('admin.proxies.fallbackMode')" :options="[
            { label: t('admin.proxies.fallbackNone'), value: 'none' },
            { label: t('admin.proxies.fallbackProxy'), value: 'proxy' },
            { label: t('admin.proxies.fallbackDirect'), value: 'direct' },
          ]" />
        <UiSelect v-if="createForm.fallback_mode === 'proxy'" v-model="createForm.backup_proxy_id" density="compact" :label="t('admin.proxies.backupProxy')" :options="backupProxyOptions()" />

      </form>

      <!-- Batch Add Form -->
      <div v-else class="proxy-form">
        <UiTextArea
          :model-value="batchInput"
          :rows="10"
          monospace
          :label="t('admin.proxies.batchInput')"
          :description="t('admin.proxies.batchInputHint')"
          :placeholder="t('admin.proxies.batchInputPlaceholder')"
          @update:model-value="batchInput = $event; parseBatchInput()"
        />

        <!-- Parse Result -->
        <div v-if="batchParseResult.total > 0" class="proxy-batch-summary">
            <div class="proxy-batch-summary__rows">
              <div class="proxy-batch-summary__row proxy-batch-summary__row--success">
              <Icon name="checkCircle" size="sm" :stroke-width="2" />
              <span>
                {{ t('admin.proxies.parsedCount', { count: batchParseResult.valid }) }}
              </span>
            </div>
            <div v-if="batchParseResult.invalid > 0" class="proxy-batch-summary__row proxy-batch-summary__row--warning">
              <Icon
                name="exclamationCircle"
                size="sm"
                :stroke-width="2"
              />
              <span>
                {{ t('admin.proxies.invalidCount', { count: batchParseResult.invalid }) }}
              </span>
            </div>
            <div v-if="batchParseResult.duplicate > 0" class="proxy-batch-summary__row">
              <Icon name="copy" size="sm" />
              <span>
                {{ t('admin.proxies.duplicateCount', { count: batchParseResult.duplicate }) }}
              </span>
            </div>
          </div>
        </div>

      </div>

      <template #footer>
        <div class="proxy-dialog-actions">
          <UiButton @click="closeCreateModal" type="button" density="compact">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            v-if="createMode === 'standard'"
            type="submit"
            form="create-proxy-form"
            :disabled="submitting"
            :loading="submitting"
            variant="primary"
            density="compact"
          >
            {{ submitting ? t('admin.proxies.creating') : t('common.create') }}
          </UiButton>
          <UiButton
            v-else
            @click="handleBatchCreate"
            type="button"
            :disabled="submitting || batchParseResult.valid === 0"
            :loading="submitting"
            variant="primary"
            density="compact"
          >
            {{
              submitting
                ? t('admin.proxies.importing')
                : t('admin.proxies.importProxies', { count: batchParseResult.valid })
            }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <!-- Edit Proxy Modal -->
    <UiDialog
      :show="showEditModal"
      :title="t('admin.proxies.editProxy')"
      width="normal"
      @close="closeEditModal"
    >
      <form
        v-if="editingProxy"
        id="edit-proxy-form"
        @submit.prevent="handleUpdateProxy"
        class="proxy-form"
      >
        <UiTextField v-model="editForm.name" required density="compact" :label="t('admin.proxies.name')" />
        <UiSelect v-model="editForm.protocol" :options="protocolSelectOptions" density="compact" :label="t('admin.proxies.protocol')" />
        <div class="proxy-form-grid">
          <UiTextField v-model="editForm.host" required density="compact" :label="t('admin.proxies.host')" />
          <UiTextField v-model.number="editForm.port" type="number" required min="1" max="65535" density="compact" :label="t('admin.proxies.port')" />
        </div>
        <UiTextField v-model="editForm.username" density="compact" :label="t('admin.proxies.username')" />
        <UiPasswordField
          :model-value="editForm.password"
          density="compact"
          :label="t('admin.proxies.password')"
          :placeholder="t('admin.proxies.leaveEmptyToKeep')"
          @update:model-value="editForm.password = $event; editPasswordDirty = true"
        />
        <UiSelect v-model="editForm.status" :options="editStatusOptions" density="compact" :label="t('admin.proxies.status')" />
        <div class="proxy-form-section">
          <div class="proxy-form-label">{{ t('admin.proxies.expiresAt') }}</div>
          <UiSegmentedControl
            :model-value="editExpiresDays ?? -1"
            :options="expiryPresetOptions"
            :label="t('admin.proxies.expiresAt')"
            @update:model-value="editExpiresDays = Number($event)"
          />
          <div class="proxy-expiry-grid">
            <UiTextField v-model.number="editExpiresDays" type="number" min="0" density="compact" :label="t('admin.proxies.expiryDaysPlaceholder')" />
            <UiDateInput v-model="editForm.expires_at" :label="t('admin.proxies.expiresAt')" />
          </div>
        </div>
        <UiSelect v-model="editForm.fallback_mode" density="compact" :label="t('admin.proxies.fallbackMode')" :options="[
            { label: t('admin.proxies.fallbackNone'), value: 'none' },
            { label: t('admin.proxies.fallbackProxy'), value: 'proxy' },
            { label: t('admin.proxies.fallbackDirect'), value: 'direct' },
          ]" />
        <UiSelect v-if="editForm.fallback_mode === 'proxy'" v-model="editForm.backup_proxy_id" density="compact" :label="t('admin.proxies.backupProxy')" :options="backupProxyOptions(editingProxy?.id)" />

      </form>

      <template #footer>
        <div class="proxy-dialog-actions">
          <UiButton @click="closeEditModal" type="button" density="compact">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            v-if="editingProxy"
            type="submit"
            form="edit-proxy-form"
            :disabled="submitting"
            :loading="submitting"
            variant="primary"
            density="compact"
          >
            {{ submitting ? t('admin.proxies.updating') : t('common.update') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <!-- Delete Confirmation Dialog -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.proxies.deleteProxy')"
      :message="t('admin.proxies.deleteConfirm', { name: deletingProxy?.name })"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="deletingProxyPending"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Batch Delete Confirmation Dialog -->
    <UiConfirmDialog
      :show="showBatchDeleteDialog"
      :title="t('admin.proxies.batchDelete')"
      :message="t('admin.proxies.batchDeleteConfirm', { count: selectedCount })"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="batchDeletingPending"
      @confirm="confirmBatchDelete"
      @cancel="showBatchDeleteDialog = false"
    />
    <UiConfirmDialog
      :show="showExportDataDialog"
      :title="t('admin.proxies.dataExport')"
      :message="t('admin.proxies.dataExportConfirmMessage')"
      :confirm-text="t('admin.proxies.dataExportConfirm')"
      :cancel-text="t('common.cancel')"
      :pending="exportingData"
      @confirm="handleExportData"
      @cancel="showExportDataDialog = false"
    />

    <ImportDataModal
      :show="showImportData"
      @close="showImportData = false"
      @imported="handleDataImported"
    />

    <UiDialog
      :show="showQualityReportDialog"
      :title="t('admin.proxies.qualityReportTitle')"
      width="normal"
      @close="closeQualityReportDialog"
    >
      <div v-if="qualityReport" class="proxy-dialog-stack">
        <UiDescriptionList :items="qualityReportFacts" :columns="2" />
        <UiDataTable
          :columns="qualityReportColumns"
          :data="qualityReport.items"
          row-key="target"
          :aria-label="t('admin.proxies.qualityReportTitle')"
        >
          <template #cell-target="{ value }">{{ qualityTargetLabel(value) }}</template>
          <template #cell-status="{ row }">
            <UiStatusBadge :status="qualityCheckStatus(row.status)" :label="qualityStatusLabel(row.status)" />
          </template>
          <template #cell-http_status="{ value }">{{ value ?? '-' }}</template>
          <template #cell-latency_ms="{ value }">{{ typeof value === 'number' ? `${value}ms` : '-' }}</template>
          <template #cell-message="{ row }">
            <span>{{ row.message || '-' }}</span>
            <span v-if="row.cf_ray" class="proxy-cf-ray">(cf-ray: {{ row.cf_ray }})</span>
          </template>
        </UiDataTable>
      </div>
      <template #footer>
        <div class="proxy-dialog-actions">
          <UiButton density="compact" @click="closeQualityReportDialog">
            {{ t('common.close') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <!-- Proxy Accounts Dialog -->
    <UiDialog
      :show="showAccountsModal"
      :title="t('admin.proxies.accountsTitle', { name: accountsProxy?.name || '' })"
      width="normal"
      @close="closeAccountsModal"
    >
      <div v-if="accountsLoading" class="proxy-dialog-state">
        <Icon name="refresh" size="md" class="proxies-spin" />
        {{ t('common.loading') }}
      </div>
      <div v-else-if="proxyAccounts.length === 0" class="proxy-dialog-state">
        {{ t('admin.proxies.accountsEmpty') }}
      </div>
      <UiDataTable
        v-else
        :columns="proxyAccountColumns"
        :data="proxyAccounts"
        row-key="id"
        :aria-label="t('admin.proxies.accountsTitle', { name: accountsProxy?.name || '' })"
      >
        <template #cell-name="{ value }"><span class="proxy-cell-strong">{{ value }}</span></template>
        <template #cell-platform="{ row }"><PlatformTypeBadge :platform="row.platform" :type="row.type" /></template>
        <template #cell-notes="{ value }">{{ value || '-' }}</template>
      </UiDataTable>
      <template #footer>
        <div class="proxy-dialog-actions">
          <UiButton density="compact" @click="closeAccountsModal">
            {{ t('common.close') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { Proxy, ProxyAccountSummary, ProxyProtocol, ProxyQualityCheckResult } from '@/types'
import type { Column } from '@/components/ui'
import AppLayout from '@/components/layout/AppLayout.vue'
import ImportDataModal from '@/components/admin/proxy/ImportDataModal.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  UiBadge,
  UiButton,
  UiCheckbox,
  UiConfirmDialog,
  UiDateInput,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiDropdownMenu,
  UiEmptyState,
  UiFilterBar,
  UiIconButton,
  UiPasswordField,
  UiPagination,
  UiSearchInput,
  UiSegmentedControl,
  UiServerTableWorkspace,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTextArea,
  UiTextField
} from '@/components/ui'
import PlatformTypeBadge from '@/components/common/PlatformTypeBadge.vue'
import { useClipboard } from '@/composables/useClipboard'
import { useSwipeSelect } from '@/composables/useSwipeSelect'
import { useTableSelection } from '@/composables/useTableSelection'
import { getPersistedPageSize, setPersistedPageSize } from '@/composables/usePersistedPageSize'
import { formatDateTime } from '@/utils/format'
import {
  daysUntil,
  EXPIRY_DANGER_DAYS,
  EXPIRY_WARN_DAYS,
  proxyExpiryLabelKey
} from '@/utils/proxyExpiry'

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

const columns = computed<Column[]>(() => [
  { key: 'select', label: '', sortable: false },
  { key: 'name', label: t('admin.proxies.columns.name'), sortable: true },
  { key: 'protocol', label: t('admin.proxies.columns.protocol'), sortable: true },
  { key: 'address', label: t('admin.proxies.columns.address'), sortable: false },
  { key: 'auth', label: t('admin.proxies.columns.auth'), sortable: false },
  { key: 'location', label: t('admin.proxies.columns.location'), sortable: false },
  { key: 'account_count', label: t('admin.proxies.columns.accounts'), sortable: true },
  { key: 'latency', label: t('admin.proxies.columns.latency'), sortable: false },
  { key: 'expiry', label: t('admin.proxies.columns.expiry'), sortable: true },
  { key: 'created_at', label: t('admin.proxies.columns.createdAt'), sortable: true },
  { key: 'status', label: t('admin.proxies.columns.status'), sortable: true },
  { key: 'actions', label: t('admin.proxies.columns.actions'), sortable: false }
])

const qualityReportColumns = computed<Column[]>(() => [
  { key: 'target', label: t('admin.proxies.qualityTableTarget') },
  { key: 'status', label: t('admin.proxies.qualityTableStatus') },
  { key: 'http_status', label: 'HTTP' },
  { key: 'latency_ms', label: t('admin.proxies.qualityTableLatency') },
  { key: 'message', label: t('admin.proxies.qualityTableMessage') }
])

const proxyAccountColumns = computed<Column[]>(() => [
  { key: 'name', label: t('admin.proxies.accountName') },
  { key: 'platform', label: t('admin.accounts.columns.platformType') },
  { key: 'notes', label: t('admin.proxies.accountNotes') }
])

// Filter options
const protocolOptions = computed(() => [
  { value: '', label: t('admin.proxies.allProtocols') },
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'socks5h', label: 'SOCKS5H' }
])

const statusOptions = computed(() => [
  { value: '', label: t('admin.proxies.allStatus') },
  { value: 'active', label: t('admin.accounts.status.active') },
  { value: 'inactive', label: t('admin.accounts.status.inactive') },
  { value: 'expired', label: t('admin.proxies.expired') }
])

// Form options
const protocolSelectOptions = computed(() => [
  { value: 'http', label: t('admin.proxies.protocols.http') },
  { value: 'https', label: t('admin.proxies.protocols.https') },
  { value: 'socks5', label: t('admin.proxies.protocols.socks5') },
  { value: 'socks5h', label: t('admin.proxies.protocols.socks5h') }
])

const editStatusOptions = computed(() => [
  { value: 'active', label: t('admin.accounts.status.active') },
  { value: 'inactive', label: t('admin.accounts.status.inactive') }
])

const proxies = ref<Proxy[]>([])
const visiblePasswordIds = reactive(new Set<number>())
const loading = ref(false)
const searchQuery = ref('')
const filters = reactive({
  protocol: '',
  status: ''
})
const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
  pages: 0
})
const sortState = reactive({
  sort_by: 'id',
  sort_order: 'desc' as 'asc' | 'desc'
})

const showCreateModal = ref(false)
const showEditModal = ref(false)
const editPasswordDirty = ref(false)
const showImportData = ref(false)
const showDeleteDialog = ref(false)
const showBatchDeleteDialog = ref(false)
const showExportDataDialog = ref(false)
const showAccountsModal = ref(false)
const submitting = ref(false)
const deletingProxyPending = ref(false)
const batchDeletingPending = ref(false)
const exportingData = ref(false)
const testingProxyIds = ref<Set<number>>(new Set())
const qualityCheckingProxyIds = ref<Set<number>>(new Set())
const batchTesting = ref(false)
const batchQualityChecking = ref(false)
const proxyTableRef = ref<HTMLElement | null>(null)
const {
  selectedSet: selectedProxyIds,
  selectedCount,
  allVisibleSelected,
  isSelected,
  setSelectedIds,
  select,
  deselect,
  clear: clearSelectedProxies,
  removeMany: removeSelectedProxies,
  toggleVisible,
  batchUpdate
} = useTableSelection<Proxy>({
  rows: proxies,
  getId: (proxy) => proxy.id
})
useSwipeSelect(proxyTableRef, {
  isSelected,
  select,
  deselect,
  batchUpdate
})
const accountsProxy = ref<Proxy | null>(null)
const proxyAccounts = ref<ProxyAccountSummary[]>([])
const accountsLoading = ref(false)
const editingProxy = ref<Proxy | null>(null)
const deletingProxy = ref<Proxy | null>(null)
const showQualityReportDialog = ref(false)
const qualityReportProxy = ref<Proxy | null>(null)
const qualityReport = ref<ProxyQualityCheckResult | null>(null)
const qualityReportFacts = computed(() => {
  const report = qualityReport.value
  if (!report) return []
  return [
    { label: t('admin.proxies.name'), value: qualityReportProxy.value?.name || '-' },
    { label: t('admin.proxies.qualityTableMessage'), value: report.summary || '-' },
    { label: t('admin.proxies.qualityScoreGrade'), value: `${report.score} / ${report.grade}`, numeric: true },
    { label: t('admin.proxies.qualityExitIP'), value: report.exit_ip || '-' },
    { label: t('admin.proxies.qualityCountry'), value: report.country || '-' },
    {
      label: t('admin.proxies.qualityBaseLatency'),
      value: typeof report.base_latency_ms === 'number' ? `${report.base_latency_ms}ms` : '-',
      numeric: true
    },
    {
      label: t('admin.proxies.qualityCheckedAt'),
      value: new Date(report.checked_at * 1000).toLocaleString()
    }
  ]
})

// Batch import state
const createMode = ref<'standard' | 'batch'>('standard')
const createModeTabs = computed(() => [
  { value: 'standard', label: t('admin.proxies.standardAdd'), icon: 'plus' as const },
  { value: 'batch', label: t('admin.proxies.batchAdd'), icon: 'document' as const }
])
const setCreateMode = (value: string | number) => {
  if (value === 'standard' || value === 'batch') createMode.value = value
}
const batchInput = ref('')
const batchParseResult = reactive({
  total: 0,
  valid: 0,
  invalid: 0,
  duplicate: 0,
  proxies: [] as Array<{
    protocol: ProxyProtocol
    host: string
    port: number
    username: string
    password: string
  }>
})

const createForm = reactive({
  name: '',
  protocol: 'http' as ProxyProtocol,
  host: '',
  port: 8080,
  username: '',
  password: '',
  expires_at: '' as string,
  fallback_mode: 'none' as 'none' | 'proxy' | 'direct',
  backup_proxy_id: null as number | null,
  expiry_warn_days: 7 as number,
})

const editForm = reactive({
  name: '',
  protocol: 'http' as ProxyProtocol,
  host: '',
  port: 8080,
  username: '',
  password: '',
  status: 'active' as 'active' | 'inactive' | 'expired',
  expires_at: '' as string,
  fallback_mode: 'none' as 'none' | 'proxy' | 'direct',
  backup_proxy_id: null as number | null,
  expiry_warn_days: 7 as number,
})

const allProxiesForBackup = ref<Proxy[]>([])
const loadBackupProxyOptions = async () => {
  allProxiesForBackup.value = await adminAPI.proxies.getAllWithCount()
}
const backupProxyOptions = (excludeId?: number) =>
  allProxiesForBackup.value
    .filter(p => p.id !== excludeId)
    .map(p => ({ label: `${p.name} (${p.host}:${p.port})`, value: p.id }))

let abortController: AbortController | null = null

const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as { name?: string; code?: string }
  return maybeError.name === 'AbortError' || maybeError.code === 'ERR_CANCELED'
}

const toggleSelectRow = (id: number, checked: boolean) => {
  if (checked) {
    select(id)
    return
  }
  deselect(id)
}

const toggleSelectAllVisible = (checked: boolean) => toggleVisible(checked)

const buildProxyQueryFilters = () => ({
  protocol: filters.protocol || undefined,
  status: (filters.status || undefined) as 'active' | 'inactive' | 'expired' | undefined,
  search: searchQuery.value || undefined,
  sort_by: sortState.sort_by,
  sort_order: sortState.sort_order
})

const loadProxies = async () => {
  if (abortController) {
    abortController.abort()
  }
  const currentAbortController = new AbortController()
  abortController = currentAbortController
  loading.value = true
  try {
    const response = await adminAPI.proxies.list(
      pagination.page,
      pagination.page_size,
      buildProxyQueryFilters(),
      { signal: currentAbortController.signal }
    )
    if (currentAbortController.signal.aborted || abortController !== currentAbortController) {
      return
    }
    proxies.value = response.items
    pagination.total = response.total
    pagination.pages = response.pages
  } catch (error) {
    if (currentAbortController.signal.aborted || abortController !== currentAbortController || isAbortError(error)) {
      return
    }
    appStore.showError(t('admin.proxies.failedToLoad'))
    console.error('Error loading proxies:', error)
  } finally {
    if (abortController === currentAbortController) {
      loading.value = false
      abortController = null
    }
  }
}

let searchTimeout: ReturnType<typeof setTimeout>
const handleSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.page = 1
    loadProxies()
  }, 300)
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadProxies()
}

const handlePageSizeChange = (pageSize: number) => {
  setPersistedPageSize(pageSize)
  pagination.page_size = pageSize
  pagination.page = 1
  loadProxies()
}

const handleSort = (key: string, order: 'asc' | 'desc') => {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  loadProxies()
}

const closeCreateModal = () => {
  showCreateModal.value = false
  createMode.value = 'standard'
  createForm.name = ''
  createForm.protocol = 'http'
  createForm.host = ''
  createForm.port = 8080
  createForm.username = ''
  createForm.password = ''
  createForm.expires_at = ''
  createForm.fallback_mode = 'none'
  createForm.backup_proxy_id = null
  createForm.expiry_warn_days = 7
  batchInput.value = ''
  batchParseResult.total = 0
  batchParseResult.valid = 0
  batchParseResult.invalid = 0
  batchParseResult.duplicate = 0
  batchParseResult.proxies = []
}

const handleDataImported = () => {
  showImportData.value = false
  loadProxies()
}

// Parse proxy URL: protocol://user:pass@host:port or protocol://host:port
const parseProxyUrl = (
  line: string
): {
  protocol: ProxyProtocol
  host: string
  port: number
  username: string
  password: string
} | null => {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Regex to parse proxy URL (supports http, https, socks5, socks5h)
  const regex = /^(https?|socks5h?):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)$/i
  const match = trimmed.match(regex)

  if (!match) return null

  const [, protocol, username, password, host, port] = match
  const portNum = parseInt(port, 10)

  if (portNum < 1 || portNum > 65535) return null

  return {
    protocol: protocol.toLowerCase() as ProxyProtocol,
    host: host.trim(),
    port: portNum,
    username: username?.trim() || '',
    password: password?.trim() || ''
  }
}

const parseBatchInput = () => {
  const lines = batchInput.value.split('\n').filter((l) => l.trim())
  const seen = new Set<string>()
  const proxies: typeof batchParseResult.proxies = []
  let invalid = 0
  let duplicate = 0

  for (const line of lines) {
    const parsed = parseProxyUrl(line)
    if (!parsed) {
      invalid++
      continue
    }

    // Check for duplicates (same host:port:username:password)
    const key = `${parsed.host}:${parsed.port}:${parsed.username}:${parsed.password}`
    if (seen.has(key)) {
      duplicate++
      continue
    }
    seen.add(key)
    proxies.push(parsed)
  }

  batchParseResult.total = lines.length
  batchParseResult.valid = proxies.length
  batchParseResult.invalid = invalid
  batchParseResult.duplicate = duplicate
  batchParseResult.proxies = proxies
}

const handleBatchCreate = async () => {
  if (submitting.value) return
  if (batchParseResult.valid === 0) return

  submitting.value = true
  try {
    const result = await adminAPI.proxies.batchCreate(batchParseResult.proxies)
    const created = result.created || 0
    const skipped = result.skipped || 0

    if (created > 0) {
      appStore.showSuccess(t('admin.proxies.batchImportSuccess', { created, skipped }))
    } else {
      appStore.showInfo(t('admin.proxies.batchImportAllSkipped', { skipped }))
    }

    closeCreateModal()
    loadProxies()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.failedToImport'))
    console.error('Error batch creating proxies:', error)
  } finally {
    submitting.value = false
  }
}

const handleCreateProxy = async () => {
  if (submitting.value) return
  if (!createForm.name.trim()) {
    appStore.showError(t('admin.proxies.nameRequired'))
    return
  }
  if (!createForm.host.trim()) {
    appStore.showError(t('admin.proxies.hostRequired'))
    return
  }
  if (createForm.port < 1 || createForm.port > 65535) {
    appStore.showError(t('admin.proxies.portInvalid'))
    return
  }
  submitting.value = true
  try {
    await adminAPI.proxies.create({
      name: createForm.name.trim(),
      protocol: createForm.protocol,
      host: createForm.host.trim(),
      port: createForm.port,
      username: createForm.username.trim() || null,
      password: createForm.password.trim() || null,
      expires_at: createForm.expires_at ? Math.floor(new Date(createForm.expires_at).getTime() / 1000) : null,
      fallback_mode: createForm.fallback_mode,
      backup_proxy_id: createForm.fallback_mode === 'proxy' ? createForm.backup_proxy_id : null,
      expiry_warn_days: createForm.expiry_warn_days,
    })
    appStore.showSuccess(t('admin.proxies.proxyCreated'))
    closeCreateModal()
    loadProxies()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.failedToCreate'))
    console.error('Error creating proxy:', error)
  } finally {
    submitting.value = false
  }
}

const handleEdit = (proxy: Proxy) => {
  editingProxy.value = proxy
  editForm.name = proxy.name
  editForm.protocol = proxy.protocol
  editForm.host = proxy.host
  editForm.port = proxy.port
  editForm.username = proxy.username || ''
  editForm.password = proxy.password || ''
  editForm.status = proxy.status === 'expired' ? 'inactive' : proxy.status
  editForm.expires_at = proxy.expires_at ? proxy.expires_at.slice(0, 10) : ''
  editForm.fallback_mode = proxy.fallback_mode || 'none'
  editForm.backup_proxy_id = proxy.backup_proxy_id ?? null
  editForm.expiry_warn_days = proxy.expiry_warn_days ?? 7
  editPasswordDirty.value = false
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingProxy.value = null
  editPasswordDirty.value = false
}

const handleUpdateProxy = async () => {
  if (submitting.value) return
  if (!editingProxy.value) return
  if (!editForm.name.trim()) {
    appStore.showError(t('admin.proxies.nameRequired'))
    return
  }
  if (!editForm.host.trim()) {
    appStore.showError(t('admin.proxies.hostRequired'))
    return
  }
  if (editForm.port < 1 || editForm.port > 65535) {
    appStore.showError(t('admin.proxies.portInvalid'))
    return
  }

  submitting.value = true
  try {
    const updateData: any = {
      name: editForm.name.trim(),
      protocol: editForm.protocol,
      host: editForm.host.trim(),
      port: editForm.port,
      username: editForm.username.trim() || null,
      status: editForm.status,
      expires_at: editForm.expires_at ? Math.floor(new Date(editForm.expires_at).getTime() / 1000) : null,
      fallback_mode: editForm.fallback_mode,
      backup_proxy_id: editForm.fallback_mode === 'proxy' ? editForm.backup_proxy_id : null,
      expiry_warn_days: editForm.expiry_warn_days,
    }

    // Only include password if user actually modified the field
    if (editPasswordDirty.value) {
      updateData.password = editForm.password.trim() || null
    }

    await adminAPI.proxies.update(editingProxy.value.id, updateData)
    appStore.showSuccess(t('admin.proxies.proxyUpdated'))
    closeEditModal()
    loadProxies()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.failedToUpdate'))
    console.error('Error updating proxy:', error)
  } finally {
    submitting.value = false
  }
}

const applyLatencyResult = (
  proxyId: number,
  result: {
    success: boolean
    latency_ms?: number
    message?: string
    ip_address?: string
    country?: string
    country_code?: string
    region?: string
    city?: string
  }
) => {
  const target = proxies.value.find((proxy) => proxy.id === proxyId)
  if (!target) return
  if (result.success) {
    target.latency_status = 'success'
    target.latency_ms = result.latency_ms
    target.ip_address = result.ip_address
    target.country = result.country
    target.country_code = result.country_code
    target.region = result.region
    target.city = result.city
  } else {
    target.latency_status = 'failed'
    target.latency_ms = undefined
    target.ip_address = undefined
    target.country = undefined
    target.country_code = undefined
    target.region = undefined
    target.city = undefined
  }
  target.latency_message = result.message
}

const summarizeQualityStatus = (result: ProxyQualityCheckResult): Proxy['quality_status'] => {
  if (result.challenge_count > 0) return 'challenge'
  if (result.failed_count > 0) return 'failed'
  if (result.warn_count > 0) return 'warn'
  return 'healthy'
}

const applyQualityResult = (proxyId: number, result: ProxyQualityCheckResult) => {
  const target = proxies.value.find((proxy) => proxy.id === proxyId)
  if (!target) return
  target.quality_status = summarizeQualityStatus(result)
  target.quality_score = result.score
  target.quality_grade = result.grade
  target.quality_summary = result.summary
  target.quality_checked = result.checked_at
}

const formatLocation = (proxy: Proxy) => {
  const parts = [proxy.country, proxy.city].filter(Boolean) as string[]
  return parts.join(' · ')
}

const flagUrl = (code: string) =>
  `https://unpkg.com/flag-icons/flags/4x3/${code.toLowerCase()}.svg`

const startTestingProxy = (proxyId: number) => {
  testingProxyIds.value = new Set([...testingProxyIds.value, proxyId])
}

const stopTestingProxy = (proxyId: number) => {
  const next = new Set(testingProxyIds.value)
  next.delete(proxyId)
  testingProxyIds.value = next
}

const startQualityCheckingProxy = (proxyId: number) => {
  qualityCheckingProxyIds.value = new Set([...qualityCheckingProxyIds.value, proxyId])
}

const stopQualityCheckingProxy = (proxyId: number) => {
  const next = new Set(qualityCheckingProxyIds.value)
  next.delete(proxyId)
  qualityCheckingProxyIds.value = next
}

const runProxyTest = async (proxyId: number, notify: boolean) => {
  startTestingProxy(proxyId)
  try {
    const result = await adminAPI.proxies.testProxy(proxyId)
    applyLatencyResult(proxyId, result)
    if (notify) {
      if (result.success) {
        const message = result.latency_ms
          ? t('admin.proxies.proxyWorkingWithLatency', { latency: result.latency_ms })
          : t('admin.proxies.proxyWorking')
        appStore.showSuccess(message)
      } else {
        appStore.showError(result.message || t('admin.proxies.proxyTestFailed'))
      }
    }
    return result
  } catch (error: any) {
    const message = error.response?.data?.detail || t('admin.proxies.failedToTest')
    applyLatencyResult(proxyId, { success: false, message })
    if (notify) {
      appStore.showError(message)
    }
    console.error('Error testing proxy:', error)
    return null
  } finally {
    stopTestingProxy(proxyId)
  }
}

const handleTestConnection = async (proxy: Proxy) => {
  await runProxyTest(proxy.id, true)
}

const handleQualityCheck = async (proxy: Proxy) => {
  startQualityCheckingProxy(proxy.id)
  try {
    const result = await adminAPI.proxies.checkProxyQuality(proxy.id)
    qualityReportProxy.value = proxy
    qualityReport.value = result
    showQualityReportDialog.value = true

    const baseStep = result.items.find((item) => item.target === 'base_connectivity')
    if (baseStep && baseStep.status === 'pass') {
      applyLatencyResult(proxy.id, {
        success: true,
        latency_ms: result.base_latency_ms,
        message: result.summary,
        ip_address: result.exit_ip,
        country: result.country,
        country_code: result.country_code
      })
    }
    applyQualityResult(proxy.id, result)

    appStore.showSuccess(
      t('admin.proxies.qualityCheckDone', { score: result.score, grade: result.grade })
    )
  } catch (error: any) {
    const message = error.response?.data?.detail || t('admin.proxies.qualityCheckFailed')
    appStore.showError(message)
    console.error('Error checking proxy quality:', error)
  } finally {
    stopQualityCheckingProxy(proxy.id)
  }
}

const runBatchProxyQualityChecks = async (ids: number[]) => {
  if (ids.length === 0) return { total: 0, healthy: 0, warn: 0, challenge: 0, failed: 0 }

  const concurrency = 3
  let index = 0
  let healthy = 0
  let warn = 0
  let challenge = 0
  let failed = 0

  const worker = async () => {
    while (index < ids.length) {
      const current = ids[index]
      index++
      startQualityCheckingProxy(current)
      try {
        const result = await adminAPI.proxies.checkProxyQuality(current)
        const target = proxies.value.find((proxy) => proxy.id === current)
        if (target) {
          const baseStep = result.items.find((item) => item.target === 'base_connectivity')
          if (baseStep && baseStep.status === 'pass') {
            applyLatencyResult(current, {
              success: true,
              latency_ms: result.base_latency_ms,
              message: result.summary,
              ip_address: result.exit_ip,
              country: result.country,
              country_code: result.country_code
            })
          }
        }
        applyQualityResult(current, result)
        if (result.challenge_count > 0) {
          challenge++
        } else if (result.failed_count > 0) {
          failed++
        } else if (result.warn_count > 0) {
          warn++
        } else {
          healthy++
        }
      } catch {
        failed++
      } finally {
        stopQualityCheckingProxy(current)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker())
  await Promise.all(workers)
  return {
    total: ids.length,
    healthy,
    warn,
    challenge,
    failed
  }
}

const closeQualityReportDialog = () => {
  showQualityReportDialog.value = false
  qualityReportProxy.value = null
  qualityReport.value = null
}

const qualityCheckStatus = (status: string) => {
  if (status === 'pass') return 'success'
  if (status === 'warn') return 'warning'
  if (status === 'challenge') return 'danger'
  return 'failed'
}

const qualityStatusLabel = (status: string) => {
  if (status === 'pass') return t('admin.proxies.qualityStatusPass')
  if (status === 'warn') return t('admin.proxies.qualityStatusWarn')
  if (status === 'challenge') return t('admin.proxies.qualityStatusChallenge')
  return t('admin.proxies.qualityStatusFail')
}

// 有效期「选天数」⇄ 日历联动:天数自 base 起算(创建=今天;编辑=代理创建日),本地日历日 round-trip 稳定;canonical 仍是 expires_at 日期串
const EXPIRY_PRESETS = [7, 30, 90, 180]
const expiryPresetOptions = computed(() => EXPIRY_PRESETS.map(days => ({
  value: days,
  label: t('admin.proxies.nDays', { days })
})))
const toLocalDateStr = (dt: Date): string => {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
// base 为空 → 今天本地 00:00;否则该日期本地 00:00
const baseDateOrToday = (baseDateStr: string): Date => {
  const base = baseDateStr ? new Date(`${baseDateStr}T00:00:00`) : new Date()
  base.setHours(0, 0, 0, 0)
  return base
}
// base + N 天 → 本地 YYYY-MM-DD;N≤0/空 → '' 表示永不过期
const addDaysToBase = (baseDateStr: string, n: number | null): string => {
  const days = Number(n)
  if (!days || days <= 0) return ''
  const dt = baseDateOrToday(baseDateStr)
  dt.setDate(dt.getDate() + days)
  return toLocalDateStr(dt)
}
// target 相对 base 的整天数(本地日历差,避免时区/时刻抖动)
const daysFromBase = (baseDateStr: string, targetDateStr: string): number | null => {
  if (!targetDateStr) return null
  const target = new Date(`${targetDateStr}T00:00:00`)
  return Math.round((target.getTime() - baseDateOrToday(baseDateStr).getTime()) / 86400000)
}
// 编辑时有效期自「代理创建日」起算;创建时无 created_at → base='' 用今天
const editBaseDate = computed(() =>
  editingProxy.value?.created_at ? editingProxy.value.created_at.slice(0, 10) : '',
)
const createExpiresDays = computed<number | null>({
  get: () => daysFromBase('', createForm.expires_at),
  set: (v) => {
    createForm.expires_at = addDaysToBase('', v)
  },
})
const editExpiresDays = computed<number | null>({
  get: () => daysFromBase(editBaseDate.value, editForm.expires_at),
  set: (v) => {
    editForm.expires_at = addDaysToBase(editBaseDate.value, v)
  },
})

const expiryLabel = (row: Proxy): string => {
  const { key, params } = proxyExpiryLabelKey(row.expires_at, row.status)
  return params ? t(key, params) : t(key)
}

const expiryBadgeTone = (row: Proxy): 'neutral' | 'warning' | 'danger' => {
  if (row.status === 'expired') return 'danger'
  const remainingDays = row.expires_at ? daysUntil(row.expires_at) : Number.POSITIVE_INFINITY
  if (remainingDays <= EXPIRY_DANGER_DAYS) return 'danger'
  if (remainingDays <= EXPIRY_WARN_DAYS) return 'warning'
  return 'neutral'
}

const qualityStatusTone = (status?: string) => {
  if (status === 'healthy') return 'healthy'
  if (status === 'warn') return 'warning'
  if (status === 'challenge') return 'danger'
  return 'failed'
}

const qualityOverallLabel = (status?: string) => {
  if (status === 'healthy') return t('admin.proxies.qualityStatusHealthy')
  if (status === 'warn') return t('admin.proxies.qualityStatusWarn')
  if (status === 'challenge') return t('admin.proxies.qualityStatusChallenge')
  return t('admin.proxies.qualityStatusFail')
}

const qualityTargetLabel = (target: string) => {
  switch (target) {
    case 'base_connectivity':
      return t('admin.proxies.qualityTargetBase')
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'gemini':
      return 'Gemini'
    case 'grok':
      return 'Grok'
    default:
      return target
  }
}

const fetchAllProxiesForBatch = async (): Promise<Proxy[]> => {
  const pageSize = 200
  const result: Proxy[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const response = await adminAPI.proxies.list(
      page,
      pageSize,
      {
        protocol: filters.protocol || undefined,
        status: filters.status as any,
        search: searchQuery.value || undefined,
        sort_by: sortState.sort_by,
        sort_order: sortState.sort_order
      }
    )
    result.push(...response.items)
    totalPages = response.pages || 1
    page++
  }

  return result
}

const runBatchProxyTests = async (ids: number[]) => {
  if (ids.length === 0) return
  const concurrency = 5
  let index = 0

  const worker = async () => {
    while (index < ids.length) {
      const current = ids[index]
      index++
      await runProxyTest(current, false)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker())
  await Promise.all(workers)
}

const handleBatchTest = async () => {
  if (batchTesting.value) return

  batchTesting.value = true
  try {
    let ids: number[] = []
    if (selectedCount.value > 0) {
      ids = Array.from(selectedProxyIds.value)
    } else {
      const allProxies = await fetchAllProxiesForBatch()
      ids = allProxies.map((proxy) => proxy.id)
    }

    if (ids.length === 0) {
      appStore.showInfo(t('admin.proxies.batchTestEmpty'))
      return
    }

    await runBatchProxyTests(ids)
    appStore.showSuccess(t('admin.proxies.batchTestDone', { count: ids.length }))
    loadProxies()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.batchTestFailed'))
    console.error('Error batch testing proxies:', error)
  } finally {
    batchTesting.value = false
  }
}

const handleBatchQualityCheck = async () => {
  if (batchQualityChecking.value) return

  batchQualityChecking.value = true
  try {
    let ids: number[] = []
    if (selectedCount.value > 0) {
      ids = Array.from(selectedProxyIds.value)
    } else {
      const allProxies = await fetchAllProxiesForBatch()
      ids = allProxies.map((proxy) => proxy.id)
    }

    if (ids.length === 0) {
      appStore.showInfo(t('admin.proxies.batchQualityEmpty'))
      return
    }

    const summary = await runBatchProxyQualityChecks(ids)
    appStore.showSuccess(
      t('admin.proxies.batchQualityDone', {
        count: summary.total,
        healthy: summary.healthy,
        warn: summary.warn,
        challenge: summary.challenge,
        failed: summary.failed
      })
    )
    loadProxies()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.batchQualityFailed'))
    console.error('Error batch checking quality:', error)
  } finally {
    batchQualityChecking.value = false
  }
}

const formatExportTimestamp = () => {
  const now = new Date()
  const pad2 = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
}

const handleExportData = async () => {
  if (exportingData.value) return
  exportingData.value = true
  try {
    const dataPayload = await adminAPI.proxies.exportData(
      selectedCount.value > 0
        ? { ids: Array.from(selectedProxyIds.value) }
        : {
            filters: buildProxyQueryFilters()
          }
    )
    const timestamp = formatExportTimestamp()
    const filename = `sub2api-proxy-${timestamp}.json`
    const blob = new Blob([JSON.stringify(dataPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.setTimeout(() => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
    }, 0)
    appStore.showSuccess(t('admin.proxies.dataExported'))
    showExportDataDialog.value = false
  } catch (error: any) {
    appStore.showError(error?.message || t('admin.proxies.dataExportFailed'))
  } finally {
    exportingData.value = false
  }
}

const handleDelete = (proxy: Proxy) => {
  if ((proxy.account_count || 0) > 0) {
    appStore.showError(t('admin.proxies.deleteBlockedInUse'))
    return
  }
  deletingProxy.value = proxy
  showDeleteDialog.value = true
}

const openBatchDelete = () => {
  if (selectedCount.value === 0) {
    return
  }
  showBatchDeleteDialog.value = true
}

const confirmDelete = async () => {
  const target = deletingProxy.value
  if (!target || deletingProxyPending.value) return
  deletingProxyPending.value = true

  try {
    await adminAPI.proxies.delete(target.id)
    appStore.showSuccess(t('admin.proxies.proxyDeleted'))
    showDeleteDialog.value = false
    removeSelectedProxies([target.id])
    deletingProxy.value = null
    loadProxies()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.failedToDelete'))
    console.error('Error deleting proxy:', error)
  } finally {
    deletingProxyPending.value = false
  }
}

const confirmBatchDelete = async () => {
  if (batchDeletingPending.value) return
  const ids = Array.from(selectedProxyIds.value)
  if (ids.length === 0) {
    showBatchDeleteDialog.value = false
    return
  }
  batchDeletingPending.value = true

  try {
    const result = await adminAPI.proxies.batchDelete(ids)
    const deleted = result.deleted_ids?.length || 0
    const skipped = result.skipped?.length || 0

    if (deleted > 0) {
      appStore.showSuccess(t('admin.proxies.batchDeleteDone', { deleted, skipped }))
    } else if (skipped > 0) {
      appStore.showInfo(t('admin.proxies.batchDeleteSkipped', { skipped }))
    }

    const skippedIds = (result.skipped || []).map((item) => item.id)
    if (skippedIds.length > 0) {
      // Keep only recoverable targets selected after a partial delete. This
      // avoids asking the user to reselect skipped/in-use proxies and prevents
      // a retry from repeating already successful deletions.
      setSelectedIds(skippedIds)
    } else {
      clearSelectedProxies()
    }
    showBatchDeleteDialog.value = false
    loadProxies()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.batchDeleteFailed'))
    console.error('Error batch deleting proxies:', error)
  } finally {
    batchDeletingPending.value = false
  }
}

const openAccountsModal = async (proxy: Proxy) => {
  accountsProxy.value = proxy
  proxyAccounts.value = []
  accountsLoading.value = true
  showAccountsModal.value = true

  try {
    proxyAccounts.value = await adminAPI.proxies.getProxyAccounts(proxy.id)
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.proxies.accountsFailed'))
    console.error('Error loading proxy accounts:', error)
  } finally {
    accountsLoading.value = false
  }
}

const closeAccountsModal = () => {
  showAccountsModal.value = false
  accountsProxy.value = null
  proxyAccounts.value = []
}

// ── Proxy URL copy ──
function buildAuthPart(row: any): string {
  const user = row.username ? encodeURIComponent(row.username) : ''
  const pass = row.password ? encodeURIComponent(row.password) : ''
  if (user && pass) return `${user}:${pass}@`
  if (user) return `${user}@`
  if (pass) return `:${pass}@`
  return ''
}

function buildProxyUrl(row: any): string {
  return `${row.protocol}://${buildAuthPart(row)}${row.host}:${row.port}`
}

function getCopyFormats(row: any) {
  const hasAuth = row.username || row.password
  const fullUrl = buildProxyUrl(row)
  const formats = [
    { label: fullUrl, value: fullUrl },
  ]
  if (hasAuth) {
    const withoutProtocol = fullUrl.replace(/^[^:]+:\/\//, '')
    formats.push({ label: withoutProtocol, value: withoutProtocol })
  }
  formats.push({ label: `${row.host}:${row.port}`, value: `${row.host}:${row.port}` })
  return formats
}

function copyProxyUrl(row: any) {
  copyToClipboard(buildProxyUrl(row), t('admin.proxies.urlCopied'))
}

function copyFormat(value: string) {
  copyToClipboard(value, t('admin.proxies.urlCopied'))
}

onMounted(() => {
  loadProxies()
  loadBackupProxyOptions()
})

onUnmounted(() => {
  clearTimeout(searchTimeout)
  abortController?.abort()
})
</script>

<style scoped>
.proxies-filter-grid { display: grid; min-width: 0; flex: 1; grid-template-columns: minmax(240px, 1fr) 160px 144px; gap: 8px; }
.proxies-toolbar-actions { display: flex; width: 100%; flex-wrap: wrap; align-items: center; gap: 8px; overflow: visible; padding-bottom: 1px; }
.proxies-toolbar-actions > * { flex: 0 0 auto; }
.proxies-filter-bar { flex-wrap: wrap; align-items: center; }
.proxies-filter-bar :deep(.ui-filter-bar__fields) { flex: 1 1 100%; width: 100%; }
.proxies-filter-bar :deep(.ui-filter-bar__actions) {
  flex: 1 1 100%;
  justify-content: flex-end;
  min-width: 0;
  padding-top: 6px;
  border-top: 1px solid var(--ui-border-soft);
}
.proxies-table-shell { min-width: 0; overflow: hidden; }
.proxy-cell-strong { color: var(--ui-text); font-weight: 600; }
.proxy-cell-empty { color: var(--ui-text-soft); font-size: 12px; }
.proxy-cell-inline { display: inline-flex; min-width: 0; align-items: center; gap: 6px; }
.proxy-cell-code { color: var(--ui-text); font-family: var(--ui-font-mono); font-size: 11px; }
.proxy-auth-value { display: grid; min-width: 0; gap: 2px; color: var(--ui-text-muted); font-size: 12px; }
.proxy-auth-password { color: var(--ui-text-soft); font-family: var(--ui-font-mono); }
.proxy-location { gap: 8px; }
.proxy-location-flag { width: 24px; height: 16px; border-radius: 3px; object-fit: cover; }
.proxy-location-value { color: var(--ui-text-muted); font-size: 12px; }
.proxy-cell-stack { display: grid; min-width: 0; gap: 4px; }
.proxy-quality-inline { display: inline-flex; align-items: center; gap: 5px; color: var(--ui-text-muted); font-size: 11px; }
.proxy-expiry-value, .proxy-created-at { color: var(--ui-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.proxy-row-actions { display: inline-flex; align-items: center; gap: 4px; }
.proxies-spin { animation: proxies-spin 900ms linear infinite; }
.proxy-form-tabs { margin-bottom: 18px; }
.proxy-form { display: grid; gap: 16px; }
.proxy-form-grid, .proxy-expiry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.proxy-form-section { display: grid; gap: 8px; }
.proxy-form-label { color: var(--ui-text-muted); font-size: 11px; font-weight: 600; }
.proxy-batch-summary { padding: 12px; border: 1px solid var(--ui-border-soft); border-radius: var(--ui-radius-panel); background: var(--ui-surface-muted); }
.proxy-batch-summary__rows { display: flex; flex-wrap: wrap; gap: 14px; color: var(--ui-text-muted); font-size: 12px; }
.proxy-batch-summary__row { display: inline-flex; align-items: center; gap: 6px; }
.proxy-batch-summary__row--success { color: var(--ui-success); }
.proxy-batch-summary__row--warning { color: var(--ui-warning); }
.proxy-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.proxy-dialog-stack { display: grid; gap: 16px; }
.proxy-dialog-state { display: flex; min-height: 112px; align-items: center; justify-content: center; gap: 8px; color: var(--ui-text-muted); font-size: 12px; text-align: center; }
.proxy-cf-ray { margin-left: 4px; color: var(--ui-text-soft); font-size: 10px; }
@keyframes proxies-spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) {
  .proxies-filter-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .proxies-filter-bar :deep(.ui-filter-bar__actions) { justify-content: flex-start; }
  .proxies-toolbar-actions { flex-wrap: wrap; overflow: visible; }
  .proxy-form-grid, .proxy-expiry-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) { .proxies-spin { animation: none; } }
</style>
