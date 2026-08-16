<template>
  <AppLayout>
    <AppPage width="full" density="compact" class="risk-page">
      <div v-if="loading" class="risk-loading" role="status" aria-busy="true" :aria-label="t('common.loading')">
        <UiSkeleton height="72px" />
        <div class="risk-loading__metrics">
          <UiSkeleton v-for="index in 4" :key="index" height="88px" />
        </div>
        <UiSkeleton height="280px" />
        <UiSkeleton height="360px" />
      </div>

      <AppStack v-else :gap="24">
        <AppPageHeader :title="t('admin.riskControl.title')" :description="t('admin.riskControl.description')">
          <template #actions>
            <UiButton density="compact" :loading="statusLoading" :disabled="statusLoading" @click="loadStatus(false)">
              <template #icon><Icon name="refresh" size="sm" /></template>
              {{ t('admin.riskControl.refreshStatus') }}
            </UiButton>
            <UiButton density="compact" variant="primary" @click="openSettings">
              <template #icon><Icon name="cog" size="sm" /></template>
              {{ t('admin.riskControl.openSettings') }}
            </UiButton>
          </template>
        </AppPageHeader>

        <AppGrid min="190px" :gap="12">
          <UiStatMetric
            v-for="item in overviewItems"
            :key="item.key"
            :label="item.label"
            :value="item.value"
            :context="item.meta"
          >
            <template v-if="item.badge" #status><UiBadge :label="item.badge" /></template>
          </UiStatMetric>
        </AppGrid>

        <div
          v-if="showPreBlockRuntimeCard"
          data-test="pre-block-runtime-cards"
          class="risk-runtime-grid"
        >
          <section data-test="pre-block-sync-card" class="risk-runtime-panel">
            <header class="risk-runtime-panel__header">
              <div>
                <h2>{{ t('admin.riskControl.preBlockSyncStatus') }}</h2>
                <p>{{ t('admin.riskControl.preBlockSyncHint') }}</p>
              </div>
              <UiBadge :label="modeLabel(status?.mode ?? configForm.mode)" />
            </header>

            <AppGrid data-test="pre-block-metric-grid" class="risk-runtime-panel__body" min="150px" :gap="10">
              <UiStatMetric
                v-for="item in preBlockMetricItems"
                :key="item.key"
                :label="item.label"
                :value="item.value"
                :context="item.meta"
              />
            </AppGrid>
          </section>

          <section data-test="pre-block-api-key-load-card" class="risk-runtime-panel">
            <header class="risk-runtime-panel__header">
              <div>
                <h2>{{ t('admin.riskControl.preBlockAPIKeyLoad') }}</h2>
                <p>
                  {{ t('admin.riskControl.preBlockAPIKeyLoadHint') }}
                </p>
              </div>
              <span class="risk-runtime-panel__summary">{{ preBlockAPIKeyLoadSummaryText }}</span>
            </header>

            <div class="risk-runtime-panel__body">
              <div
                v-if="preBlockAPIKeyLoads.length > 0"
                data-test="pre-block-api-key-load-list"
                class="risk-key-loads"
              >
                <div
                  v-for="item in preBlockAPIKeyLoads"
                  :key="item.key_hash || item.index"
                  class="risk-key-loads__row"
                >
                  <div class="risk-key-loads__summary">
                    <div class="risk-key-loads__identity">
                      <div class="risk-key-loads__name">
                        <span class="risk-mono">#{{ item.index + 1 }}</span>
                        <span class="risk-mono">{{ item.masked || '-' }}</span>
                        <UiStatusBadge :status="apiKeyStatusTone(item.status)" :label="apiKeyStatusLabel(item.status)" />
                      </div>
                      <p>
                        {{ t('admin.riskControl.preBlockAPIKeyTotals', { total: formatNumber(item.total), success: formatNumber(item.success), errors: formatNumber(item.errors) }) }}
                      </p>
                    </div>
                    <div class="risk-key-loads__metrics">
                      <div>
                        <p>{{ t('admin.riskControl.preBlockKeyActiveShort') }}</p>
                        <strong>{{ formatNumber(item.active) }}</strong>
                      </div>
                      <div>
                        <p>{{ t('admin.riskControl.preBlockKeyTotalShort') }}</p>
                        <strong>{{ formatNumber(item.total) }}</strong>
                      </div>
                      <div>
                        <p>{{ t('admin.riskControl.preBlockKeyAvgShort') }}</p>
                        <strong>{{ formatNumber(item.avg_latency_ms) }} ms</strong>
                      </div>
                      <div>
                        <p>{{ t('admin.riskControl.preBlockKeyLastShort') }}</p>
                        <strong>{{ formatNumber(item.last_latency_ms) }} ms</strong>
                      </div>
                    </div>
                  </div>
                  <UiProgressBar
                    :value="preBlockAPIKeyLoadValue(item.total)"
                    :aria-label="`${t('admin.riskControl.preBlockAPIKeyLoad')} ${item.masked || `#${item.index + 1}`}`"
                    :show-value="false"
                    tone="info"
                  />
                </div>
              </div>
              <UiEmptyState v-else :title="t('admin.riskControl.preBlockAPIKeyLoadEmpty')" />
            </div>
          </section>
        </div>

        <section v-if="showWorkerRuntimeCard" class="risk-runtime-panel">
          <header class="risk-runtime-panel__header">
            <div>
              <h2>{{ t('admin.riskControl.workerStatus') }}</h2>
              <p>{{ t('admin.riskControl.workerStatusHint') }}</p>
            </div>
            <div class="risk-runtime-panel__meta">
              <span>{{ t('admin.riskControl.autoRefresh') }}</span>
              <span v-if="status?.last_cleanup_at">
                {{ t('admin.riskControl.lastCleanup', { time: formatDateTime(status.last_cleanup_at) }) }}
              </span>
            </div>
          </header>

          <div class="risk-worker-layout">
            <div class="risk-worker-summary">
              <div class="risk-queue">
                <div class="risk-queue__meta">
                  <div>
                    <strong>{{ t('admin.riskControl.queueUsage') }}</strong>
                    <p>
                      {{ formatNumber(status?.queue_length ?? 0) }} / {{ formatNumber(status?.queue_size ?? configForm.queue_size) }}
                    </p>
                  </div>
                  <span class="ui-numeric">{{ queueUsagePercent }}</span>
                </div>
                <UiProgressBar :value="queueUsageValue" :aria-label="t('admin.riskControl.queueUsage')" :show-value="false" />
              </div>

              <AppGrid min="140px" :gap="10">
                <UiStatMetric
                  v-for="item in workerMetricItems"
                  :key="item.key"
                  :label="item.label"
                  :value="item.value"
                />
              </AppGrid>
            </div>

            <div class="risk-worker-pool">
              <div class="risk-worker-pool__header">
                <div>
                  <strong>{{ t('admin.riskControl.workerPool') }}</strong>
                  <p>
                    {{ t('admin.riskControl.workerPoolMeta', { active: status?.active_workers ?? 0, idle: status?.idle_workers ?? configForm.worker_count, total: status?.worker_count ?? configForm.worker_count }) }}
                  </p>
                </div>
                <UiBadge :label="modeLabel(status?.mode ?? configForm.mode)" />
              </div>
              <div class="risk-worker-slots">
                <div
                  v-for="worker in workerSlots"
                  :key="worker.id"
                  class="risk-worker-slot"
                  :data-state="worker.state"
                  :title="worker.label"
                >
                  <span>#{{ worker.id }}</span>
                  <i aria-hidden="true"></i>
                </div>
              </div>
            </div>
          </div>
        </section>

        <AppSection :title="t('admin.riskControl.records')" :description="t('admin.riskControl.recordsHint')" divided>
          <template #actions>
            <UiButton density="compact" :loading="logsLoading" :disabled="logsLoading" @click="loadLogs">
              <template #icon><Icon name="refresh" size="sm" /></template>
              {{ t('admin.riskControl.refresh') }}
            </UiButton>
          </template>

          <div class="risk-records__model-filter">
              <div class="risk-records__model-summary">
                <Icon name="filter" size="sm" />
                <strong>{{ t('admin.riskControl.modelFilter') }}</strong>
                <span>{{ modelFilterSummary }}</span>
              </div>
              <div v-if="modelFilterPreviewModels.length > 0" class="flex flex-wrap gap-1.5">
                <UiBadge
                  v-for="model in modelFilterPreviewModels"
                  :key="model"
                  class="max-w-[180px] truncate font-mono"
                >
                  {{ model }}
                </UiBadge>
                <UiBadge v-if="hiddenModelFilterModelCount > 0">
                  +{{ hiddenModelFilterModelCount }}
                </UiBadge>
              </div>
          </div>

          <UiFilterBar class="risk-records__filters" :active-count="activeLogFilterCount" :clear-label="t('admin.riskControl.filters.clear')" @clear="clearLogFilters">
            <UiSelect v-model="filters.result" :options="resultOptions" density="compact" @change="reloadLogsFromFirstPage" />
            <UiSelect v-model="filters.group_id" :options="groupFilterOptions" density="compact" @change="reloadLogsFromFirstPage" />
            <UiSelect v-model="filters.endpoint" :options="endpointOptions" density="compact" @change="reloadLogsFromFirstPage" />
            <UiSearchInput v-model="filters.search" density="compact" :debounce-ms="0" :placeholder="t('admin.riskControl.filters.search')" @search="reloadLogsFromFirstPage" />
            <UiTextField v-model="filters.from" type="datetime-local" density="compact" :label="t('admin.riskControl.filters.from')" @change="reloadLogsFromFirstPage" />
            <UiTextField v-model="filters.to" type="datetime-local" density="compact" :label="t('admin.riskControl.filters.to')" @change="reloadLogsFromFirstPage" />
          </UiFilterBar>

          <UiMobileTableScroller :label="t('admin.riskControl.records')" min-width="1180px">
            <UiDataTable
              :columns="riskLogColumns"
              :data="logs"
              :loading="logsLoading"
              row-key="id"
              :aria-label="t('admin.riskControl.records')"
            >
              <template #cell-created_at="{ value }">{{ formatDateTime(value) }}</template>
              <template #cell-group_name="{ value }">{{ value || '-' }}</template>
              <template #cell-user="{ row }">
                <div>{{ row.user_email || '-' }}</div>
                <div v-if="row.user_id" class="risk-table-cell__meta">UID {{ row.user_id }}</div>
              </template>
              <template #cell-api_key_name="{ value }">{{ value || '-' }}</template>
              <template #cell-endpoint="{ row }">
                <div>{{ row.endpoint || '-' }}</div>
                <div class="risk-table-cell__meta">{{ row.provider || '-' }} / {{ row.model || '-' }}</div>
              </template>
              <template #cell-result="{ row }">
                <UiStatusBadge :status="resultStatusTone(row)" :label="resultLabel(row)" />
              </template>
              <template #cell-highest="{ row }">
                <div>{{ row.highest_category || '-' }} · {{ percent(row.highest_score) }}</div>
                <div v-if="row.matched_keyword" class="risk-table-cell__meta risk-table-cell__meta--danger">
                  {{ t('admin.riskControl.matchedKeyword') }}: {{ row.matched_keyword }}
                </div>
              </template>
              <template #cell-action_meta="{ row }">
                <div>{{ violationCountText(row) }}</div>
                <div class="risk-table-cell__meta">
                  {{ row.email_sent ? t('admin.riskControl.emailSent') : t('admin.riskControl.emailNotSent') }}
                  <span v-if="row.auto_banned"> / {{ t('admin.riskControl.autoBanned') }}</span>
                </div>
                <UiButton
                  v-if="canUnbanRow(row)"
                  density="mini"
                  variant="quiet"
                  :loading="unbanningUserID === row.user_id"
                  :disabled="unbanningUserID === row.user_id"
                  @click="unbanUser(row)"
                >
                  {{ unbanningUserID === row.user_id ? t('common.processing') : t('admin.riskControl.unbanUser') }}
                </UiButton>
              </template>
              <template #cell-latency="{ row }">
                <div>{{ latencyText(row.upstream_latency_ms) }}</div>
                <div v-if="row.queue_delay_ms !== null && row.queue_delay_ms !== undefined" class="risk-table-cell__meta">
                  {{ t('admin.riskControl.queueDelay', { ms: row.queue_delay_ms }) }}
                </div>
              </template>
              <template #cell-input="{ row }">
                <UiButton density="dense" variant="quiet" @click="openInputDetail(row)">
                  <span class="risk-table-cell__input">{{ inputSummaryText(row) }}</span>
                </UiButton>
              </template>
              <template #empty><UiEmptyState :title="t('admin.riskControl.emptyLogs')" /></template>
            </UiDataTable>
          </UiMobileTableScroller>

          <UiPagination
            v-if="pagination.total > 0"
            class="risk-records__pagination"
            :page="pagination.page"
            :total="pagination.total"
            :page-size="pagination.page_size"
            @update:page="onPageChange"
            @update:pageSize="onPageSizeChange"
          />
        </AppSection>
      </AppStack>

      <UiDialog :show="settingsOpen" :title="t('admin.riskControl.settingsTitle')" width="extra-wide" @close="settingsOpen = false">
        <div data-test="risk-settings-surface" class="risk-settings">
          <UiTabs
            :model-value="activeSettingsTab"
            :tabs="settingsTabOptions"
            :label="t('admin.riskControl.settingsTitle')"
            @update:model-value="setSettingsTab"
          />

          <div v-if="activeSettingsTab === 'basic'" class="risk-settings__tab">
            <AppGrid min="280px" :gap="16">
              <div class="risk-setting-row">
                <div class="risk-setting-row__copy">
                  <strong>{{ t('admin.riskControl.enabled') }}</strong>
                  <p>{{ t('admin.riskControl.enabledHint') }}</p>
                </div>
                <UiSwitch v-model="configForm.enabled" :label="t('admin.riskControl.enabled')" />
              </div>
              <UiSelect v-model="configForm.mode" :options="modeOptions" density="compact" :label="t('admin.riskControl.mode')" :description="modeDescription(configForm.mode)" />
              <UiTextField v-model.trim="configForm.base_url" type="url" density="compact" :label="t('admin.riskControl.baseUrl')" placeholder="https://api.openai.com" />
              <UiTextField v-model.trim="configForm.model" density="compact" :label="t('admin.riskControl.model')" placeholder="omni-moderation-latest" />
              <UiTextField v-model.number="configForm.timeout_ms" type="number" min="500" max="30000" density="compact" :label="t('admin.riskControl.timeoutMs')" />
              <UiTextField v-model.number="configForm.retry_count" type="number" min="0" max="5" density="compact" :label="t('admin.riskControl.retryCount')" />
              <UiTextField v-model.number="configForm.sample_rate" type="number" min="0" max="100" step="1" density="compact" :label="t('admin.riskControl.sampleRate')" />
              <UiFormField :label="t('admin.riskControl.proxy')" :description="t('admin.riskControl.proxyHint')">
                <ProxySelector v-model="configForm.proxy_id" :proxies="proxies" />
              </UiFormField>
            </AppGrid>

            <section data-test="risk-api-keys-section" class="risk-settings__section">
              <header class="risk-section-heading">
                <div class="risk-section-heading__copy">
                  <Icon name="key" size="md" class="risk-section-heading__icon" />
                  <div>
                    <strong>{{ t('admin.riskControl.apiKeys') }}</strong>
                    <p>
                      {{ t('admin.riskControl.apiKeysHint', { count: configForm.api_key_count }) }}
                    </p>
                  </div>
                </div>
                <div class="risk-section-heading__actions">
                  <UiButton
                    density="compact"
                    :loading="apiKeyTesting"
                    :disabled="apiKeyTesting || inputApiKeyCount === 0 || configForm.clear_api_key"
                    @click="testApiKeys(true)"
                  >
                    <template #icon><Icon name="beaker" size="sm" /></template>
                    {{ apiKeyTesting ? t('admin.riskControl.testingApiKeys') : t('admin.riskControl.testInputApiKeys') }}
                  </UiButton>
                  <UiButton
                    density="compact"
                    :disabled="apiKeyTesting || effectiveStoredApiKeyCount === 0 || pendingDeletedApiKeyCount > 0 || configForm.clear_api_key || configForm.api_keys_mode === 'replace'"
                    @click="testApiKeys(false)"
                  >
                    <template #icon><Icon name="shield" size="sm" /></template>
                    {{ storedApiKeyTestButtonText }}
                  </UiButton>
                  <UiButton
                    v-if="configForm.api_key_configured"
                    density="compact"
                    @click="toggleClearApiKey"
                  >
                    <template #icon><Icon :name="configForm.clear_api_key ? 'x' : 'trash'" size="sm" /></template>
                    {{ configForm.clear_api_key ? t('admin.riskControl.keepApiKey') : t('admin.riskControl.clearApiKey') }}
                  </UiButton>
                </div>
              </header>

              <div class="risk-api-key-editor">
                <div class="risk-api-key-editor__input">
                  <div class="risk-api-key-editor__mode">
                    <div>
                      <strong>{{ t('admin.riskControl.apiKeysWriteMode') }}</strong>
                      <span>{{ apiKeysModeHint }}</span>
                    </div>
                    <UiSegmentedControl
                      :model-value="configForm.api_keys_mode"
                      :options="apiKeyModeOptions"
                      :label="t('admin.riskControl.apiKeysWriteMode')"
                      @update:model-value="setAPIKeysModeValue"
                    />
                  </div>
                  <UiTextArea
                    v-model="configForm.api_keys_text"
                    :rows="7"
                    monospace
                    :label="t('admin.riskControl.apiKeys')"
                    :description="apiKeysModeHint"
                    :placeholder="apiKeysPlaceholder"
                    :disabled="configForm.clear_api_key"
                  />
                  <div class="risk-badges">
                    <UiBadge :label="t('admin.riskControl.inputApiKeyCount', { count: inputApiKeyCount })" />
                    <UiBadge v-if="configForm.api_key_configured" :label="t('admin.riskControl.storedApiKeyCount', { count: configForm.api_key_count })" />
                    <UiBadge v-if="configForm.clear_api_key" tone="danger" :label="t('admin.riskControl.apiKeyWillClear')" />
                    <UiBadge v-else-if="pendingDeletedApiKeyCount > 0" tone="warning" :label="t('admin.riskControl.apiKeyPendingDeleteCount', { count: pendingDeletedApiKeyCount })" />
                    <UiBadge v-if="configForm.api_keys_mode === 'replace'" tone="warning" :label="t('admin.riskControl.apiKeysReplaceWarning')" />
                  </div>

                  <div class="risk-audit-test" @paste="handleModerationImagePaste">
                    <div class="risk-audit-test__header">
                      <div>
                        <strong>{{ t('admin.riskControl.auditTestInput') }}</strong>
                        <p>{{ t('admin.riskControl.auditTestInputHint') }}</p>
                      </div>
                      <UiButton
                        v-if="moderationTestPrompt || moderationTestImages.length > 0 || moderationTestResult"
                        density="mini"
                        variant="quiet"
                        @click="clearModerationTestInput"
                      >
                        <template #icon><Icon name="x" size="xs" /></template>
                        {{ t('admin.riskControl.clearAuditTest') }}
                      </UiButton>
                    </div>
                    <UiTextArea
                      v-model="moderationTestPrompt"
                      :rows="4"
                      :placeholder="t('admin.riskControl.auditTestPromptPlaceholder')"
                    />
                    <div class="risk-audit-test__upload">
                      <UiFileUpload
                        accept="image/*"
                        multiple
                        :label="t('admin.riskControl.auditTestImages')"
                        :description="t('admin.riskControl.auditTestImagesHint')"
                        :button-text="t('admin.riskControl.addAuditTestImage')"
                        @select="addModerationTestFiles"
                      />
                      <div v-if="moderationTestImages.length > 0" class="risk-audit-images">
                        <div
                          v-for="(image, index) in moderationTestImages"
                          :key="image.slice(0, 64) + index"
                          class="risk-audit-image"
                        >
                          <img :src="image" alt="" />
                          <UiIconButton
                            class="risk-audit-image__remove"
                            variant="danger"
                            density="dense"
                            :label="t('common.delete')"
                            @click="removeModerationTestImage(index)"
                          ><Icon name="x" size="xs" /></UiIconButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="risk-api-health">
                  <div class="risk-api-health__header">
                    <div>
                      <strong>{{ t('admin.riskControl.apiKeyHealth') }}</strong>
                      <p>{{ t('admin.riskControl.apiKeyFreezeRule') }}</p>
                    </div>
                    <UiBadge :label="t('admin.riskControl.apiKeyRows', { count: apiKeyRows.length })" />
                  </div>

                  <UiEmptyState v-if="apiKeyRows.length === 0" :title="t('admin.riskControl.apiKeyHealthEmpty')" :description="t('admin.riskControl.apiKeyHealthEmptyHint')" />
                  <div v-else class="risk-api-health__content">
                    <div class="risk-api-health__list" :class="{ 'risk-api-health__list--expanded': apiKeyRowsExpanded }">
                      <div
                        v-for="(row, index) in visibleApiKeyRows"
                        :key="apiKeyRowKey(row, index)"
                        class="risk-api-health__row"
                        :class="{ 'risk-api-health__row--pending': isStoredApiKeyPendingDelete(row) }"
                      >
                        <div class="risk-api-health__row-main">
                          <div class="risk-api-health__identity">
                            <div class="risk-api-health__name">
                              <span class="risk-mono">{{ row.masked || '-' }}</span>
                              <UiBadge
                                :tone="isStoredApiKeyPendingDelete(row) ? 'warning' : row.configured ? 'info' : 'neutral'"
                                :label="isStoredApiKeyPendingDelete(row) ? t('admin.riskControl.apiKeyPendingDelete') : row.configured ? t('admin.riskControl.apiKeyConfigured') : t('admin.riskControl.apiKeyTemporary')"
                              />
                            </div>
                            <p>{{ apiKeyStatusMeta(row) }}</p>
                          </div>
                          <div class="risk-api-health__actions">
                            <UiStatusBadge :status="apiKeyStatusTone(row.status)" :label="apiKeyStatusLabel(row.status)" />
                            <UiIconButton
                              v-if="row.configured && !configForm.clear_api_key"
                              density="dense"
                              :variant="isStoredApiKeyPendingDelete(row) ? 'ghost' : 'danger'"
                              :label="isStoredApiKeyPendingDelete(row) ? t('admin.riskControl.undoDeleteApiKey') : t('admin.riskControl.deleteApiKey')"
                              @click="toggleDeleteStoredApiKey(row)"
                            >
                              <Icon :name="isStoredApiKeyPendingDelete(row) ? 'refresh' : 'trash'" size="xs" />
                            </UiIconButton>
                          </div>
                        </div>
                        <UiAlert v-if="row.last_error" tone="warning" :message="row.last_error" />
                      </div>
                    </div>

                    <div v-if="canToggleApiKeyRows" class="risk-api-health__toggle">
                      <span>
                        {{ apiKeyRowsExpanded ? t('admin.riskControl.apiKeyRowsExpanded', { count: apiKeyRows.length }) : t('admin.riskControl.apiKeyRowsCollapsed', { count: hiddenApiKeyRowCount }) }}
                      </span>
                      <UiButton
                        density="mini"
                        variant="quiet"
                        @click="apiKeyRowsExpanded = !apiKeyRowsExpanded"
                      >
                        <template #icon><Icon :name="apiKeyRowsExpanded ? 'chevronUp' : 'chevronDown'" size="xs" /></template>
                        {{ apiKeyRowsExpanded ? t('admin.riskControl.collapseApiKeyRows') : t('admin.riskControl.expandApiKeyRows') }}
                      </UiButton>
                    </div>
                  </div>

                  <div v-if="moderationTestResult" class="risk-audit-result">
                    <div class="risk-audit-result__header">
                      <div>
                        <strong>{{ t('admin.riskControl.auditTestResult') }}</strong>
                        <p>
                          {{ t('admin.riskControl.auditTestHighest', { category: moderationTestResult.highest_category || '-', score: percent(moderationTestResult.highest_score) }) }}
                        </p>
                      </div>
                      <UiBadge
                        :tone="moderationTestResult.flagged ? 'danger' : 'success'"
                        :label="moderationTestResult.flagged ? t('admin.riskControl.auditTestFlagged') : t('admin.riskControl.auditTestPassed')"
                      />
                    </div>
                    <div class="risk-audit-result__score">
                      <div class="risk-audit-result__score-meta">
                        <span>{{ t('admin.riskControl.auditTestComposite') }}</span>
                        <strong>{{ percent(moderationTestResult.composite_score) }}</strong>
                      </div>
                      <UiProgressBar :value="percentValue(moderationTestResult.composite_score)" :aria-label="t('admin.riskControl.auditTestComposite')" :show-value="false" :tone="moderationTestResult.flagged ? 'danger' : 'success'" />
                    </div>
                    <div class="risk-audit-result__categories">
                      <div v-for="score in moderationScoreRows" :key="score.category">
                        <div class="risk-audit-result__score-meta">
                          <span>{{ score.category }}</span>
                          <span class="risk-mono">{{ percent(score.score) }} / {{ percent(score.threshold) }}</span>
                        </div>
                        <UiProgressBar :value="percentValue(score.score)" :aria-label="score.category" :show-value="false" :tone="score.hit ? 'danger' : 'info'" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div v-else-if="activeSettingsTab === 'scope'" class="risk-settings__tab">
            <div class="risk-section-heading">
              <div class="risk-section-heading__copy">
                <div>
                  <strong>{{ t('admin.riskControl.groupScope') }}</strong>
                  <p>{{ t('admin.riskControl.groupScopeHint') }}</p>
                </div>
              </div>
              <UiSegmentedControl
                :model-value="configForm.all_groups ? 'all' : 'selected'"
                :options="groupScopeOptions"
                :label="t('admin.riskControl.groupScope')"
                @update:model-value="setGroupScope"
              />
            </div>

            <div v-if="!configForm.all_groups" class="risk-group-scope">
              <UiSearchInput
                v-model="groupSearch"
                density="compact"
                :debounce-ms="0"
                :placeholder="t('admin.riskControl.searchGroups')"
                :aria-label="t('admin.riskControl.searchGroups')"
              />
              <div class="risk-group-list">
                <div
                  v-for="group in filteredGroups"
                  :key="group.id"
                  class="risk-group-list__row"
                >
                  <span class="risk-group-list__identity">
                    <strong>{{ group.name }}</strong>
                    <UiBadge :label="group.platform" />
                  </span>
                  <UiCheckbox
                    :model-value="isGroupSelected(group.id)"
                    :label="group.name"
                    @update:model-value="toggleGroup(group.id)"
                  ><span class="sr-only">{{ group.name }}</span></UiCheckbox>
                </div>
                <UiEmptyState v-if="filteredGroups.length === 0" :title="t('admin.riskControl.noGroups')" />
              </div>
            </div>

            <section data-test="risk-model-filter-section" class="risk-settings__section">
              <div class="risk-section-heading">
                <div class="risk-section-heading__copy">
                  <div>
                    <strong>{{ t('admin.riskControl.modelFilter') }}</strong>
                    <p>{{ t('admin.riskControl.modelFilterHint') }}</p>
                  </div>
                </div>
                <UiBadge :label="modelFilterSummary" />
              </div>

              <UiRadioGroup
                :model-value="configForm.model_filter_type"
                :options="modelFilterOptions"
                name="risk-model-filter"
                layout="grid"
                :label="t('admin.riskControl.modelFilter')"
                @update:model-value="setModelFilterTypeValue"
              />

              <UiFormField
                v-if="configForm.model_filter_type !== 'all'"
                :label="t('admin.riskControl.modelFilterModels')"
                :description="t('admin.riskControl.modelFilterModelCount', { count: modelFilterModelCount })"
              >
                <ModelWhitelistSelector v-model="configForm.model_filter_models" />
              </UiFormField>
            </section>
          </div>

          <div v-else-if="activeSettingsTab === 'runtime'" class="risk-settings__tab">
            <AppGrid min="280px" :gap="16">
              <UiTextField v-model.number="configForm.worker_count" type="number" min="1" max="32" density="compact" :label="t('admin.riskControl.workerCount')" />
              <UiTextField v-model.number="configForm.queue_size" type="number" min="100" max="100000" density="compact" :label="t('admin.riskControl.queueSize')" />
            </AppGrid>
            <div class="risk-setting-row risk-setting-row--divided">
              <div class="risk-setting-row__copy">
                <strong>{{ t('admin.riskControl.recordNonHits') }}</strong>
                <p>{{ t('admin.riskControl.recordNonHitsHint') }}</p>
              </div>
              <UiSwitch v-model="configForm.record_non_hits" :label="t('admin.riskControl.recordNonHits')" />
            </div>
            <section class="risk-settings__section">
              <div class="risk-setting-row">
                <div class="risk-setting-row__copy">
                  <strong>{{ t('admin.riskControl.preHashCheck') }}</strong>
                  <p>{{ t('admin.riskControl.preHashCheckHint') }}</p>
                </div>
                <UiSwitch v-model="configForm.pre_hash_check_enabled" :label="t('admin.riskControl.preHashCheck')" />
              </div>
              <div class="risk-hash-tools">
                <div class="risk-section-heading">
                  <div>
                    <strong>
                      {{ t('admin.riskControl.flaggedHashCount', { count: formatNumber(status?.flagged_hash_count ?? 0) }) }}
                    </strong>
                    <p>{{ t('admin.riskControl.flaggedHashHint') }}</p>
                  </div>
                  <UiButton
                    variant="danger"
                    density="compact"
                    :disabled="hashActionLoading || (status?.flagged_hash_count ?? 0) === 0"
                    @click="clearHashesConfirmOpen = true"
                  >
                    <template #icon><Icon name="trash" size="sm" /></template>
                    {{ t('admin.riskControl.clearFlaggedHashes') }}
                  </UiButton>
                </div>
                <div class="risk-hash-tools__delete">
                  <UiTextField
                    v-model.trim="flaggedHashInput"
                    monospace
                    density="compact"
                    :label="t('admin.riskControl.deleteFlaggedHash')"
                    :placeholder="t('admin.riskControl.flaggedHashPlaceholder')"
                  />
                  <UiButton
                    density="compact"
                    :disabled="hashActionLoading || !isFlaggedHashInputValid"
                    @click="deleteFlaggedHash"
                  >
                    <template #icon><Icon name="trash" size="sm" /></template>
                    {{ t('admin.riskControl.deleteFlaggedHash') }}
                  </UiButton>
                </div>
              </div>
            </section>
          </div>

          <div v-else-if="activeSettingsTab === 'response'" class="risk-settings__tab">
            <AppGrid min="280px" :gap="16">
              <UiTextField v-model.number="configForm.block_status" type="number" min="400" max="599" density="compact" :label="t('admin.riskControl.blockStatus')" />
              <UiTextField v-model.trim="configForm.block_message" density="compact" :label="t('admin.riskControl.blockMessage')" />
              <UiTextField v-model.number="configForm.ban_threshold" type="number" min="1" max="1000" density="compact" :label="t('admin.riskControl.banThreshold')" />
              <UiTextField v-model.number="configForm.violation_window_hours" type="number" min="1" max="8760" density="compact" :label="t('admin.riskControl.violationWindowHours')" />
            </AppGrid>
            <div data-test="risk-response-option" class="risk-setting-row risk-setting-row--divided">
              <div class="risk-setting-row__copy"><strong>{{ t('admin.riskControl.emailOnHit') }}</strong><p>{{ t('admin.riskControl.emailOnHitHint') }}</p></div>
              <UiSwitch v-model="configForm.email_on_hit" :label="t('admin.riskControl.emailOnHit')" />
            </div>
            <div data-test="risk-response-option" class="risk-setting-row risk-setting-row--divided">
              <div class="risk-setting-row__copy"><strong>{{ t('admin.riskControl.autoBan') }}</strong><p>{{ t('admin.riskControl.autoBanHint') }}</p></div>
              <UiSwitch v-model="configForm.auto_ban_enabled" :label="t('admin.riskControl.autoBan')" />
            </div>
            <div data-test="risk-response-option" class="risk-setting-row risk-setting-row--divided">
              <div class="risk-setting-row__copy"><strong>{{ t('admin.riskControl.cyberPolicyExcludeBan') }}</strong><p>{{ t('admin.riskControl.cyberPolicyExcludeBanHint') }}</p></div>
              <UiSwitch v-model="configForm.cyber_policy_exclude_from_ban_count" :label="t('admin.riskControl.cyberPolicyExcludeBan')" />
            </div>
          </div>

          <div v-else-if="activeSettingsTab === 'riskThresholds'" class="risk-settings__tab">
            <div class="risk-section-heading">
              <div class="risk-section-heading__copy">
                <div>
                  <strong>{{ t('admin.riskControl.riskThresholds') }}</strong>
                  <p>{{ t('admin.riskControl.riskThresholdsHint') }}</p>
                </div>
              </div>
              <UiButton
                density="compact"
                @click="resetRiskThresholds"
              >
                <template #icon><Icon name="refresh" size="sm" /></template>
                {{ t('admin.riskControl.riskThresholdReset') }}
              </UiButton>
            </div>

            <div class="risk-thresholds">
              <div
                v-for="row in riskThresholdRows"
                :key="row.category"
                class="risk-thresholds__row"
              >
                <div class="risk-thresholds__label">
                    <label :for="`risk-threshold-${row.category}`">
                      {{ row.category }}
                    </label>
                    <p>
                      {{ t('admin.riskControl.riskThresholdDefault', { value: formatThresholdPercent(row.defaultValue) }) }}
                    </p>
                </div>
                  <UiTextField
                    :id="`risk-threshold-${row.category}`"
                    v-model.number="configForm.thresholds[row.category]"
                    :data-test="`risk-threshold-${row.category}`"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    monospace
                    density="compact"
                  ><template #suffix>%</template></UiTextField>
              </div>
            </div>
          </div>

          <div v-else-if="activeSettingsTab === 'keywords'" class="risk-settings__tab">
            <UiAlert :tone="keywordNotice.tone" :title="keywordNotice.title" :message="keywordNotice.description" />

            <UiRadioGroup
              :model-value="configForm.keyword_blocking_mode"
              :options="keywordBlockingModeOptions"
              name="risk-keyword-mode"
              layout="grid"
              :label="t('admin.riskControl.keywordBlockingMode')"
              @update:model-value="setKeywordBlockingMode"
            />

            <div class="risk-keywords">
              <div class="risk-keywords__header">
                <strong>{{ t('admin.riskControl.blockedKeywords') }}</strong>
                <UiBadge :label="t('admin.riskControl.blockedKeywordCount', { count: blockedKeywordCount })" />
              </div>
              <UiTextArea
                v-model="configForm.blocked_keywords_text"
                :rows="9"
                monospace
                :label="t('admin.riskControl.blockedKeywords')"
                :placeholder="t('admin.riskControl.blockedKeywordsPlaceholder')"
                :disabled="configForm.keyword_blocking_mode === 'api_only'"
              />
              <p class="risk-keywords__limit">
                {{ t('admin.riskControl.blockedKeywordsLimit', { max: blockedKeywordMax }) }}
              </p>
            </div>
          </div>

          <div v-else class="risk-settings__tab">
            <AppGrid min="280px" :gap="16">
              <UiTextField v-model.number="configForm.hit_retention_days" type="number" min="1" max="3650" density="compact" :label="t('admin.riskControl.hitRetentionDays')" />
              <UiTextField v-model.number="configForm.non_hit_retention_days" type="number" min="1" max="3" density="compact" :label="t('admin.riskControl.nonHitRetentionDays')" />
            </AppGrid>
            <UiAlert tone="info" :message="t('admin.riskControl.cleanupStats', { hit: status?.last_cleanup_deleted_hit ?? 0, nonHit: status?.last_cleanup_deleted_non_hit ?? 0 })" />
          </div>
        </div>

        <template #footer>
          <div class="risk-dialog-actions">
            <UiButton density="compact" @click="settingsOpen = false">{{ t('common.cancel') }}</UiButton>
            <UiButton density="compact" variant="primary" :loading="saving" :disabled="saving" @click="saveConfig">
              {{ saving ? t('common.saving') : t('admin.riskControl.saveConfig') }}
            </UiButton>
          </div>
        </template>
      </UiDialog>

      <UiConfirmDialog
        :show="clearHashesConfirmOpen"
        :title="t('admin.riskControl.clearFlaggedHashes')"
        :message="t('admin.riskControl.clearFlaggedHashesConfirm')"
        :confirm-text="t('admin.riskControl.clearFlaggedHashes')"
        :cancel-text="t('common.cancel')"
        danger
        :pending="hashActionLoading"
        @confirm="clearFlaggedHashes"
        @cancel="clearHashesConfirmOpen = false"
      />

      <UiDialog
        :show="inputDetailRow !== null"
        :title="t('admin.riskControl.inputDetailTitle')"
        width="wide"
        @close="closeInputDetail"
      >
        <div v-if="inputDetailRow" class="risk-input-detail">
          <UiStatusBadge :status="resultStatusTone(inputDetailRow)" :label="resultLabel(inputDetailRow)" />
          <UiDescriptionList :items="inputDetailFacts" :columns="2" />
          <UiCodeBlock :label="t('admin.riskControl.inputDetailContent')" :code="inputDetailText" />
        </div>

        <template #footer>
          <div class="risk-dialog-actions">
            <UiButton density="compact" @click="closeInputDetail">{{ t('common.close') }}</UiButton>
          </div>
        </template>
      </UiDialog>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import ModelWhitelistSelector from '@/components/account/ModelWhitelistSelector.vue'
import ProxySelector from '@/components/common/ProxySelector.vue'
import type { Column } from '@/components/ui'
import {
  AppGrid,
  AppPage,
  AppPageHeader,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiCheckbox,
  UiCodeBlock,
  UiConfirmDialog,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiFileUpload,
  UiFilterBar,
  UiFormField,
  UiIconButton,
  UiMobileTableScroller,
  UiPagination,
  UiProgressBar,
  UiRadioGroup,
  UiSearchInput,
  UiSegmentedControl,
  UiSelect,
  UiSkeleton,
  UiStatMetric,
  UiStatusBadge,
  UiSwitch,
  UiTabs,
  UiTextArea,
  UiTextField
} from '@/components/ui'
import { adminAPI } from '@/api/admin'
import type {
  ContentModerationAPIKeyLoad,
  ContentModerationAPIKeyStatus,
  ContentModerationConfig,
  ContentModerationLog,
  ContentModerationModelFilter,
  ContentModerationModelFilterType,
  ContentModerationRuntimeStatus,
  ContentModerationTestAuditResult,
  KeywordBlockingMode,
  ModerationMode,
  UpdateContentModerationConfig,
} from '@/api/admin/riskControl'
import type { AdminGroup, Proxy, SelectOption } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime as formatDateTimeValue } from '@/utils/format'

type SettingsTab = 'basic' | 'scope' | 'runtime' | 'response' | 'riskThresholds' | 'retention' | 'keywords'
type WorkerSlotState = 'active' | 'idle' | 'disabled'
type APIKeysWriteMode = 'append' | 'replace'
type OverviewItem = {
  key: string
  label: string
  value: string
  meta: string
  badge?: string
}
type ModerationScoreRow = {
  category: string
  score: number
  threshold: number
  hit: boolean
}
type RiskThresholdRow = {
  category: string
  value: number
  defaultValue: number
}

const maxModerationTestImages = 1
const maxModerationTestImageSize = 8 * 1024 * 1024
const maxVisibleApiKeyRows: number = 3
const blockedKeywordMax = 10000
const riskThresholdDefaults: Record<string, number> = {
  harassment: 98,
  'harassment/threatening': 90,
  hate: 65,
  'hate/threatening': 65,
  illicit: 95,
  'illicit/violent': 95,
  'self-harm': 65,
  'self-harm/intent': 85,
  'self-harm/instructions': 65,
  sexual: 65,
  'sexual/minors': 65,
  violence: 95,
  'violence/graphic': 95,
}
const riskThresholdCategories = Object.keys(riskThresholdDefaults)

const { t } = useI18n()
const appStore = useAppStore()
const defaultBlockMessage = () => t('admin.riskControl.defaultBlockMessage')

const loading = ref(true)
const saving = ref(false)
const logsLoading = ref(false)
const statusLoading = ref(false)
const apiKeyTesting = ref(false)
const hashActionLoading = ref(false)
const clearHashesConfirmOpen = ref(false)
const unbanningUserID = ref<number | null>(null)
const settingsOpen = ref(false)
const activeSettingsTab = ref<SettingsTab>('basic')
const groupSearch = ref('')
const flaggedHashInput = ref('')
const groups = ref<AdminGroup[]>([])
const proxies = ref<Proxy[]>([])
const logs = ref<ContentModerationLog[]>([])
const status = ref<ContentModerationRuntimeStatus | null>(null)
const testedApiKeyStatuses = ref<ContentModerationAPIKeyStatus[]>([])
const pendingDeleteApiKeyHashes = ref<string[]>([])
const apiKeyRowsExpanded = ref<boolean>(false)
const moderationTestPrompt = ref('')
const moderationTestImages = ref<string[]>([])
const moderationTestResult = ref<ContentModerationTestAuditResult | null>(null)
const inputDetailRow = ref<ContentModerationLog | null>(null)
let statusTimer: number | null = null

const configForm = reactive({
  enabled: false,
  mode: 'pre_block' as ModerationMode,
  base_url: 'https://api.openai.com',
  model: 'omni-moderation-latest',
  proxy_id: null as number | null,
  api_keys_text: '',
  api_key_configured: false,
  api_key_masked: '',
  api_key_count: 0,
  api_key_masks: [] as string[],
  api_key_statuses: [] as ContentModerationAPIKeyStatus[],
  api_keys_mode: 'append' as APIKeysWriteMode,
  clear_api_key: false,
  timeout_ms: 3000,
  retry_count: 2,
  sample_rate: 100,
  all_groups: true,
  group_ids: [] as number[],
  record_non_hits: false,
  worker_count: 4,
  queue_size: 32768,
  block_status: 403,
  block_message: defaultBlockMessage(),
  email_on_hit: true,
  auto_ban_enabled: true,
  cyber_policy_exclude_from_ban_count: false,
  ban_threshold: 10,
  violation_window_hours: 720,
  hit_retention_days: 180,
  non_hit_retention_days: 3,
  pre_hash_check_enabled: false,
  thresholds: { ...riskThresholdDefaults } as Record<string, number>,
  blocked_keywords_text: '',
  keyword_blocking_mode: 'keyword_and_api' as KeywordBlockingMode,
  model_filter_type: 'all' as ContentModerationModelFilterType,
  model_filter_models: [] as string[],
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  pages: 1,
})

const filters = reactive({
  result: '',
  group_id: 0,
  endpoint: '',
  search: '',
  from: '',
  to: '',
})
const activeLogFilterCount = computed(() => Object.values(filters).filter((value) => value !== '' && value !== 0).length)

const settingsTabs = computed<Array<{ id: SettingsTab; label: string }>>(() => [
  { id: 'basic', label: t('admin.riskControl.tabs.basic') },
  { id: 'scope', label: t('admin.riskControl.tabs.scope') },
  { id: 'runtime', label: t('admin.riskControl.tabs.runtime') },
  { id: 'response', label: t('admin.riskControl.tabs.response') },
  { id: 'riskThresholds', label: t('admin.riskControl.tabs.riskThresholds') },
  { id: 'keywords', label: t('admin.riskControl.tabs.keywords') },
  { id: 'retention', label: t('admin.riskControl.tabs.retention') },
])
const settingsTabOptions = computed(() =>
  settingsTabs.value.map((tab) => ({ value: tab.id, label: tab.label }))
)
const setSettingsTab = (value: string | number) => {
  if (settingsTabs.value.some((tab) => tab.id === value)) {
    activeSettingsTab.value = value as SettingsTab
  }
}

const modeOptions = computed<SelectOption[]>(() => [
  { value: 'pre_block', label: t('admin.riskControl.modePreBlock') },
  { value: 'observe', label: t('admin.riskControl.modeObserve') },
  { value: 'off', label: t('admin.riskControl.modeOff') },
])
const apiKeyModeOptions = computed(() => [
  { value: 'append', label: t('admin.riskControl.apiKeysModeAppend'), disabled: configForm.clear_api_key },
  { value: 'replace', label: t('admin.riskControl.apiKeysModeReplace'), disabled: configForm.clear_api_key }
])
const groupScopeOptions = computed(() => [
  { value: 'all', label: t('admin.riskControl.allGroups') },
  { value: 'selected', label: t('admin.riskControl.selectedGroups') }
])

const keywordBlockingModeOptions = computed<Array<{ value: KeywordBlockingMode; label: string; description: string }>>(() => [
  {
    value: 'keyword_and_api',
    label: t('admin.riskControl.keywordModeKeywordAndApi'),
    description: t('admin.riskControl.keywordModeKeywordAndApiDesc'),
  },
  {
    value: 'keyword_only',
    label: t('admin.riskControl.keywordModeKeywordOnly'),
    description: t('admin.riskControl.keywordModeKeywordOnlyDesc'),
  },
  {
    value: 'api_only',
    label: t('admin.riskControl.keywordModeApiOnly'),
    description: t('admin.riskControl.keywordModeApiOnlyDesc'),
  },
])

const modelFilterOptions = computed<Array<{ value: ContentModerationModelFilterType; label: string; description: string }>>(() => [
  {
    value: 'all',
    label: t('admin.riskControl.modelFilterAll'),
    description: t('admin.riskControl.modelFilterAllDesc'),
  },
  {
    value: 'include',
    label: t('admin.riskControl.modelFilterInclude'),
    description: t('admin.riskControl.modelFilterIncludeDesc'),
  },
  {
    value: 'exclude',
    label: t('admin.riskControl.modelFilterExclude'),
    description: t('admin.riskControl.modelFilterExcludeDesc'),
  },
])

type KeywordNoticeView = {
  title: string
  description: string
  tone: 'info' | 'warning'
}

const keywordNoticeTones = {
  info: { tone: 'info' as const },
  warning: { tone: 'warning' as const },
}

const keywordNotice = computed<KeywordNoticeView>(() => {
  const strategy = configForm.keyword_blocking_mode
  if (strategy === 'api_only') {
    return {
      ...keywordNoticeTones.info,
      title: t('admin.riskControl.keywordModeApiOnlyNotice'),
      description: t('admin.riskControl.keywordModeApiOnlyDesc'),
    }
  }
  if (configForm.mode !== 'pre_block') {
    return {
      ...keywordNoticeTones.warning,
      title: t('admin.riskControl.blockedKeywordsModeWarning', { mode: modeLabel(configForm.mode) }),
      description: t('admin.riskControl.blockedKeywordsDescription'),
    }
  }
  if (strategy === 'keyword_only') {
    return {
      ...keywordNoticeTones.info,
      title: t('admin.riskControl.keywordModeKeywordOnlyNotice'),
      description: t('admin.riskControl.keywordModeKeywordOnlyDesc'),
    }
  }
  return {
    ...keywordNoticeTones.info,
    title: t('admin.riskControl.blockedKeywordsPreBlockHint'),
    description: t('admin.riskControl.blockedKeywordsDescription'),
  }
})

const resultOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('admin.riskControl.result.all') },
  { value: 'hit', label: t('admin.riskControl.result.hit') },
  { value: 'blocked', label: t('admin.riskControl.result.blocked') },
  { value: 'pass', label: t('admin.riskControl.result.pass') },
  { value: 'error', label: t('admin.riskControl.result.error') },
])

const riskLogColumns = computed<Column[]>(() => [
  { key: 'created_at', label: t('admin.riskControl.table.time') },
  { key: 'group_name', label: t('admin.riskControl.table.group') },
  { key: 'user', label: t('admin.riskControl.table.user') },
  { key: 'api_key_name', label: t('admin.riskControl.table.apiKey') },
  { key: 'endpoint', label: t('admin.riskControl.table.endpoint') },
  { key: 'result', label: t('admin.riskControl.table.result') },
  { key: 'highest', label: t('admin.riskControl.table.highest') },
  { key: 'action_meta', label: t('admin.riskControl.table.actionMeta') },
  { key: 'latency', label: t('admin.riskControl.table.latency') },
  { key: 'input', label: t('admin.riskControl.table.input') }
])

const endpointOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('admin.riskControl.filters.allEndpoints') },
  { value: '/v1/messages', label: '/v1/messages' },
  { value: '/v1/responses', label: '/v1/responses' },
  { value: '/v1/chat/completions', label: '/v1/chat/completions' },
  { value: '/v1beta/models', label: '/v1beta/models' },
  { value: '/v1/images/generations', label: '/v1/images/generations' },
  { value: '/v1/images/edits', label: '/v1/images/edits' },
])

const groupFilterOptions = computed<SelectOption[]>(() => [
  { value: 0, label: t('admin.riskControl.filters.allGroups') },
  ...groups.value.map((group) => ({
    value: group.id,
    label: `${group.name} (${group.platform})`,
  })),
])

const selectedGroupCount = computed(() => String(configForm.group_ids.length))

const modelFilterModelCount = computed(() => configForm.model_filter_models.length)

const modelFilterSummary = computed(() => {
  if (configForm.model_filter_type === 'include') {
    return t('admin.riskControl.modelFilterIncludeSummary', { count: modelFilterModelCount.value })
  }
  if (configForm.model_filter_type === 'exclude') {
    return t('admin.riskControl.modelFilterExcludeSummary', { count: modelFilterModelCount.value })
  }
  return t('admin.riskControl.modelFilterAllSummary')
})

const modelFilterPreviewModels = computed(() => configForm.model_filter_models.slice(0, 6))

const hiddenModelFilterModelCount = computed(() => Math.max(0, configForm.model_filter_models.length - modelFilterPreviewModels.value.length))

const filteredGroups = computed(() => {
  const keyword = groupSearch.value.trim().toLowerCase()
  if (!keyword) return groups.value
  return groups.value.filter((group) => {
    return group.name.toLowerCase().includes(keyword) || String(group.platform).toLowerCase().includes(keyword)
  })
})

const inputApiKeyCount = computed(() => parseApiKeys(configForm.api_keys_text).length)

const blockedKeywordList = computed(() => parseBlockedKeywords(configForm.blocked_keywords_text))

const blockedKeywordCount = computed(() => blockedKeywordList.value.length)

const pendingDeletedApiKeyCount = computed(() => pendingDeleteApiKeyHashes.value.length)

const effectiveStoredApiKeyCount = computed(() => Math.max(0, configForm.api_key_count - pendingDeletedApiKeyCount.value))

const apiKeysPlaceholder = computed(() => (
  configForm.api_keys_mode === 'replace'
    ? t('admin.riskControl.apiKeysPlaceholderReplace')
    : t('admin.riskControl.apiKeysPlaceholder')
))

const apiKeysModeHint = computed(() => (
  configForm.api_keys_mode === 'replace'
    ? t('admin.riskControl.apiKeysModeReplaceHint')
    : t('admin.riskControl.apiKeysModeAppendHint')
))

const hasModerationAuditInput = computed(() => {
  return moderationTestPrompt.value.trim() !== '' || moderationTestImages.value.length > 0
})

const isFlaggedHashInputValid = computed(() => /^[a-fA-F0-9]{64}$/.test(flaggedHashInput.value.trim()))

const storedApiKeyTestButtonText = computed(() => {
  if (apiKeyTesting.value) return t('admin.riskControl.testingApiKeys')
  if (hasModerationAuditInput.value) return t('admin.riskControl.testContentWithStoredApiKey')
  return t('admin.riskControl.testStoredApiKeys')
})

const savedApiKeyRows = computed<ContentModerationAPIKeyStatus[]>(() => {
  const rows = status.value?.api_key_statuses?.length
    ? status.value.api_key_statuses
    : configForm.api_key_statuses
  return Array.isArray(rows) ? rows : []
})

const apiKeyRows = computed<ContentModerationAPIKeyStatus[]>(() => [
  ...savedApiKeyRows.value,
  ...testedApiKeyStatuses.value,
])

const visibleApiKeyRows = computed<ContentModerationAPIKeyStatus[]>(() => {
  if (apiKeyRowsExpanded.value) return apiKeyRows.value
  return apiKeyRows.value.slice(0, maxVisibleApiKeyRows)
})

const hiddenApiKeyRowCount = computed<number>(() => Math.max(0, apiKeyRows.value.length - visibleApiKeyRows.value.length))

const canToggleApiKeyRows = computed<boolean>(() => apiKeyRows.value.length > maxVisibleApiKeyRows)

const activeSavedApiKeyRows = computed<ContentModerationAPIKeyStatus[]>(() => (
  savedApiKeyRows.value.filter((row) => !isStoredApiKeyPendingDelete(row))
))

const apiKeyHealthBadges = computed<Array<{ status: ContentModerationAPIKeyStatus['status']; count: number }>>(() => {
  const counts: Record<ContentModerationAPIKeyStatus['status'], number> = {
    ok: 0,
    error: 0,
    frozen: 0,
    unknown: 0,
  }
  for (const row of activeSavedApiKeyRows.value) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  if (activeSavedApiKeyRows.value.length === 0 && effectiveStoredApiKeyCount.value > 0) {
    counts.unknown = effectiveStoredApiKeyCount.value
  }
  return (['ok', 'frozen', 'error', 'unknown'] as Array<ContentModerationAPIKeyStatus['status']>)
    .map((item) => ({ status: item, count: counts[item] }))
    .filter((item) => item.count > 0)
})

const apiKeyHealthSummary = computed(() => {
  if (!configForm.api_key_configured) return ''
  if (apiKeyHealthBadges.value.length === 0) return t('admin.riskControl.apiKeyStatusUnknown')
  return apiKeyHealthBadges.value
    .map((badge) => `${apiKeyStatusLabel(badge.status)} ${badge.count}`)
    .join(' · ')
})

const overviewItems = computed<OverviewItem[]>(() => [
  {
    key: 'status',
    label: t('admin.riskControl.overview.status'),
    value: configForm.enabled ? t('admin.riskControl.overview.enabled') : t('admin.riskControl.overview.disabled'),
    meta: modeLabel(configForm.mode),
    badge: runtimeBadgeText.value,
  },
  {
    key: 'api-key',
    label: t('admin.riskControl.overview.apiKey'),
    value: configForm.api_key_configured ? t('admin.riskControl.apiKeyCount', { count: configForm.api_key_count }) : t('admin.riskControl.notConfigured'),
    meta: configForm.api_key_configured ? apiKeyHealthSummary.value || configForm.model || '-' : configForm.model || '-',
  },
  {
    key: 'scope',
    label: t('admin.riskControl.overview.groupScope'),
    value: configForm.all_groups ? t('admin.riskControl.allGroups') : selectedGroupCount.value,
    meta: modelFilterSummary.value,
  },
  {
    key: 'logs',
    label: t('admin.riskControl.overview.logs'),
    value: formatNumber(pagination.total),
    meta: t('admin.riskControl.overview.currentFilter'),
  },
])

const moderationScoreRows = computed<ModerationScoreRow[]>(() => {
  const result = moderationTestResult.value
  if (!result) return []
  return Object.entries(result.category_scores || {})
    .map(([category, score]) => {
      const threshold = result.thresholds?.[category] ?? 1
      return {
        category,
        score,
        threshold,
        hit: score >= threshold,
      }
    })
    .sort((a, b) => b.score - a.score)
})

const riskThresholdRows = computed<RiskThresholdRow[]>(() => (
  riskThresholdCategories.map((category) => ({
    category,
    value: configForm.thresholds[category] ?? riskThresholdDefaults[category],
    defaultValue: riskThresholdDefaults[category],
  }))
))

const inputDetailText = computed(() => {
  if (!inputDetailRow.value) return '-'
  return inputDetailRow.value.input_excerpt || inputDetailRow.value.error || '-'
})
const inputDetailFacts = computed(() => {
  const row = inputDetailRow.value
  if (!row) return []
  return [
    { label: t('admin.riskControl.table.time'), value: formatDateTime(row.created_at) },
    { label: t('admin.riskControl.table.user'), value: row.user_email || '-' },
    { label: t('admin.riskControl.table.group'), value: row.group_name || '-' },
    { label: t('admin.riskControl.table.endpoint'), value: `${row.endpoint || '-'} · ${row.provider || '-'} / ${row.model || '-'}` },
    { label: t('admin.riskControl.table.highest'), value: `${row.highest_category || '-'} / ${percent(row.highest_score)}` },
    { label: t('admin.riskControl.matchedKeyword'), value: row.matched_keyword || '-' }
  ]
})

const queueUsagePercent = computed(() => `${Math.min(100, Math.max(0, status.value?.queue_usage_percent ?? 0)).toFixed(1)}%`)
const queueUsageValue = computed(() => Math.min(100, Math.max(0, status.value?.queue_usage_percent ?? 0)))

const runtimeMode = computed<ModerationMode>(() => status.value?.mode ?? configForm.mode)

const showPreBlockRuntimeCard = computed(() => runtimeMode.value === 'pre_block')

const showWorkerRuntimeCard = computed(() => runtimeMode.value === 'observe')

const preBlockMetricItems = computed(() => [
  {
    key: 'active',
    label: t('admin.riskControl.preBlockActive'),
    value: formatNumber(status.value?.pre_block_active ?? 0),
    meta: t('admin.riskControl.preBlockActiveHint'),
  },
  {
    key: 'checked',
    label: t('admin.riskControl.preBlockChecked'),
    value: formatNumber(status.value?.pre_block_checked ?? 0),
    meta: t('admin.riskControl.preBlockCheckedHint'),
  },
  {
    key: 'allowed',
    label: t('admin.riskControl.preBlockAllowed'),
    value: formatNumber(status.value?.pre_block_allowed ?? 0),
    meta: t('admin.riskControl.preBlockAllowedHint'),
  },
  {
    key: 'blocked',
    label: t('admin.riskControl.preBlockBlocked'),
    value: formatNumber(status.value?.pre_block_blocked ?? 0),
    meta: t('admin.riskControl.preBlockBlockedHint'),
  },
  {
    key: 'errors',
    label: t('admin.riskControl.preBlockErrors'),
    value: formatNumber(status.value?.pre_block_errors ?? 0),
    meta: t('admin.riskControl.preBlockErrorsHint'),
  },
  {
    key: 'latency',
    label: t('admin.riskControl.preBlockAvgLatency'),
    value: `${formatNumber(status.value?.pre_block_avg_latency_ms ?? 0)} ms`,
    meta: t('admin.riskControl.preBlockAvgLatencyHint'),
  },
])

const preBlockAPIKeyLoads = computed<ContentModerationAPIKeyLoad[]>(() => (
  [...(status.value?.pre_block_api_key_loads ?? [])].sort((a, b) => a.index - b.index)
))

const preBlockAPIKeyMaxTotal = computed(() => Math.max(1, ...preBlockAPIKeyLoads.value.map((item) => item.total || 0)))

const preBlockAPIKeyLoadSummaryText = computed(() => t('admin.riskControl.preBlockAPIKeyLoadSummary', {
  active: formatNumber(status.value?.pre_block_api_key_active ?? 0),
  available: formatNumber(status.value?.pre_block_api_key_available_count ?? 0),
  total: formatNumber(status.value?.pre_block_api_key_total_calls ?? 0),
  workerActive: formatNumber(status.value?.active_workers ?? 0),
  workerTotal: formatNumber(status.value?.worker_count ?? configForm.worker_count),
}))

function preBlockAPIKeyLoadValue(total: number): number {
  return Math.min(100, Math.max(0, (total / preBlockAPIKeyMaxTotal.value) * 100))
}

const workerSlots = computed(() => {
  const total = Math.max(0, status.value?.worker_count ?? configForm.worker_count)
  const active = Math.max(0, status.value?.active_workers ?? 0)
  const enabled = Boolean(status.value?.risk_control_enabled && status.value?.enabled && status.value?.mode !== 'off')
  return Array.from({ length: total }, (_, index) => ({
    id: index + 1,
    state: (!enabled ? 'disabled' : index < active ? 'active' : 'idle') as WorkerSlotState,
    label: !enabled
      ? t('admin.riskControl.workerDisabled')
      : index < active
        ? t('admin.riskControl.workerActive')
        : t('admin.riskControl.workerIdle'),
  }))
})

const workerMetricItems = computed(() => [
  { key: 'active', label: t('admin.riskControl.activeWorkers'), value: status.value?.active_workers ?? 0 },
  { key: 'idle', label: t('admin.riskControl.idleWorkers'), value: status.value?.idle_workers ?? configForm.worker_count },
  { key: 'processed', label: t('admin.riskControl.processed'), value: formatNumber(status.value?.processed ?? 0) },
  { key: 'errors', label: t('admin.riskControl.droppedErrors'), value: formatNumber((status.value?.dropped ?? 0) + (status.value?.errors ?? 0)) },
])

const runtimeBadgeText = computed(() => {
  if (!status.value?.risk_control_enabled) return t('admin.riskControl.riskSwitchOff')
  if (!configForm.enabled || configForm.mode === 'off') return t('admin.riskControl.overview.disabled')
  return t('admin.riskControl.overview.enabled')
})

function applyConfig(config: ContentModerationConfig) {
  configForm.enabled = config.enabled
  configForm.mode = config.mode
  configForm.base_url = config.base_url || 'https://api.openai.com'
  configForm.model = config.model || 'omni-moderation-latest'
  configForm.proxy_id = config.proxy_id || null
  configForm.api_keys_text = ''
  configForm.api_key_configured = config.api_key_configured
  configForm.api_key_masked = config.api_key_masked || ''
  configForm.api_key_count = config.api_key_count || 0
  configForm.api_key_masks = Array.isArray(config.api_key_masks) ? [...config.api_key_masks] : []
  configForm.api_key_statuses = Array.isArray(config.api_key_statuses) ? [...config.api_key_statuses] : []
  configForm.api_keys_mode = 'append'
  configForm.clear_api_key = false
  pendingDeleteApiKeyHashes.value = []
  testedApiKeyStatuses.value = []
  apiKeyRowsExpanded.value = false
  configForm.timeout_ms = config.timeout_ms || 3000
  configForm.retry_count = config.retry_count ?? 2
  configForm.sample_rate = config.sample_rate ?? 100
  configForm.all_groups = config.all_groups
  configForm.group_ids = Array.isArray(config.group_ids) ? [...config.group_ids] : []
  configForm.record_non_hits = config.record_non_hits
  configForm.worker_count = config.worker_count || 4
  configForm.queue_size = config.queue_size || 32768
  configForm.block_status = config.block_status || 403
  configForm.block_message = config.block_message || defaultBlockMessage()
  configForm.email_on_hit = config.email_on_hit ?? true
  configForm.auto_ban_enabled = config.auto_ban_enabled ?? true
  configForm.cyber_policy_exclude_from_ban_count = config.cyber_policy_exclude_from_ban_count ?? false
  configForm.ban_threshold = config.ban_threshold || 10
  configForm.violation_window_hours = config.violation_window_hours || 720
  configForm.hit_retention_days = config.hit_retention_days || 180
  configForm.non_hit_retention_days = Math.min(Math.max(config.non_hit_retention_days || 3, 1), 3)
  configForm.pre_hash_check_enabled = config.pre_hash_check_enabled ?? false
  configForm.thresholds = riskThresholdsFromConfig(config.thresholds)
  configForm.blocked_keywords_text = Array.isArray(config.blocked_keywords) ? config.blocked_keywords.join('\n') : ''
  configForm.keyword_blocking_mode = normalizeKeywordBlockingMode(config.keyword_blocking_mode)
  const modelFilter = normalizeModelFilter(config.model_filter)
  configForm.model_filter_type = modelFilter.type
  configForm.model_filter_models = modelFilter.models
}

async function loadAll() {
  loading.value = true
  try {
    const [config, groupItems, runtimeStatus, proxyItems] = await Promise.all([
      adminAPI.riskControl.getConfig(),
      adminAPI.groups.getAll(),
      adminAPI.riskControl.getStatus(),
      // 代理列表加载失败不阻塞风控页面（仅影响下拉可选项）
      adminAPI.proxies.getAll().catch(() => [] as Proxy[]),
    ])
    applyConfig(config)
    groups.value = groupItems
    status.value = runtimeStatus
    proxies.value = proxyItems
    if (Array.isArray(runtimeStatus.api_key_statuses)) {
      configForm.api_key_statuses = [...runtimeStatus.api_key_statuses]
      prunePendingDeleteAPIKeyHashes()
    }
    await loadLogs()
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.loadFailed')))
  } finally {
    loading.value = false
  }
}

async function loadStatus(silent = true) {
  statusLoading.value = true
  try {
    const runtimeStatus = await adminAPI.riskControl.getStatus()
    status.value = runtimeStatus
    if (Array.isArray(runtimeStatus.api_key_statuses)) {
      configForm.api_key_statuses = [...runtimeStatus.api_key_statuses]
      prunePendingDeleteAPIKeyHashes()
    }
  } catch (err: unknown) {
    if (!silent) {
      appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.statusFailed')))
    }
  } finally {
    statusLoading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const modelFilterPayload = buildModelFilterPayload()
    if (modelFilterPayload.type !== 'all' && modelFilterPayload.models.length === 0) {
      appStore.showError(t('admin.riskControl.modelFilterModelsRequired'))
      return
    }
    const payload: UpdateContentModerationConfig = {
      enabled: configForm.enabled,
      mode: configForm.mode,
      base_url: configForm.base_url,
      model: configForm.model,
      // 后端语义：0 清除代理（直连），>0 指定代理
      proxy_id: configForm.proxy_id ?? 0,
      timeout_ms: Number(configForm.timeout_ms) || 3000,
      retry_count: Number(configForm.retry_count) || 0,
      sample_rate: Number(configForm.sample_rate) || 0,
      all_groups: configForm.all_groups,
      group_ids: configForm.all_groups ? [] : [...configForm.group_ids],
      record_non_hits: configForm.record_non_hits,
      clear_api_key: configForm.clear_api_key,
      worker_count: Number(configForm.worker_count) || 4,
      queue_size: Number(configForm.queue_size) || 32768,
      block_status: Number(configForm.block_status) || 403,
      block_message: configForm.block_message || defaultBlockMessage(),
      email_on_hit: configForm.email_on_hit,
      auto_ban_enabled: configForm.auto_ban_enabled,
      cyber_policy_exclude_from_ban_count: configForm.cyber_policy_exclude_from_ban_count,
      ban_threshold: Number(configForm.ban_threshold) || 10,
      violation_window_hours: Number(configForm.violation_window_hours) || 720,
      hit_retention_days: Number(configForm.hit_retention_days) || 180,
      non_hit_retention_days: Math.min(Math.max(Number(configForm.non_hit_retention_days) || 3, 1), 3),
      pre_hash_check_enabled: configForm.pre_hash_check_enabled,
      thresholds: buildRiskThresholdPayload(),
      blocked_keywords: blockedKeywordList.value,
      keyword_blocking_mode: configForm.keyword_blocking_mode,
      model_filter: modelFilterPayload,
    }
    const keys = parseApiKeys(configForm.api_keys_text)
    if (!payload.clear_api_key && configForm.api_keys_mode === 'replace' && keys.length === 0) {
      appStore.showError(t('admin.riskControl.apiKeysReplaceNoInput'))
      return
    }
    if (keys.length > 0) {
      payload.api_keys = keys
      payload.api_keys_mode = configForm.api_keys_mode
      payload.clear_api_key = false
    }
    if (!payload.clear_api_key && configForm.api_keys_mode !== 'replace' && pendingDeleteApiKeyHashes.value.length > 0) {
      payload.delete_api_key_hashes = [...pendingDeleteApiKeyHashes.value]
    }

    const updated = await adminAPI.riskControl.updateConfig(payload)
    applyConfig(updated)
    settingsOpen.value = false
    appStore.showSuccess(t('admin.riskControl.saved'))
    await Promise.all([loadStatus(true), loadLogs()])
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.saveFailed')))
  } finally {
    saving.value = false
  }
}

let logsRequestId = 0

async function loadLogs() {
  const requestId = ++logsRequestId
  logsLoading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.page_size,
      result: filters.result || undefined,
      group_id: filters.group_id || undefined,
      endpoint: filters.endpoint || undefined,
      search: filters.search || undefined,
      from: normalizeDateTimeLocal(filters.from),
      to: normalizeDateTimeLocal(filters.to),
    }
    const result = await adminAPI.riskControl.listLogs(params)
    if (requestId !== logsRequestId) return
    logs.value = result.items
    pagination.total = result.total
    pagination.page = result.page
    pagination.page_size = result.page_size
    pagination.pages = result.pages
  } catch (err: unknown) {
    if (requestId !== logsRequestId) return
    appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.logsFailed')))
  } finally {
    if (requestId === logsRequestId) logsLoading.value = false
  }
}

function canUnbanRow(row: ContentModerationLog): boolean {
  return Boolean(row.auto_banned && row.user_id && row.user_status === 'disabled')
}

function inputSummaryText(row: ContentModerationLog): string {
  return row.input_excerpt || row.error || '-'
}

function openInputDetail(row: ContentModerationLog) {
  inputDetailRow.value = row
}

function closeInputDetail() {
  inputDetailRow.value = null
}

async function unbanUser(row: ContentModerationLog) {
  if (!row.user_id || unbanningUserID.value !== null) return
  unbanningUserID.value = row.user_id
  try {
    const result = await adminAPI.riskControl.unbanUser(row.user_id)
    logs.value = logs.value.map((item) => {
      if (item.user_id !== row.user_id) return item
      return { ...item, user_status: result.status }
    })
    appStore.showSuccess(t('admin.riskControl.unbanSuccess'))
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.unbanFailed')))
  } finally {
    unbanningUserID.value = null
  }
}

async function deleteFlaggedHash() {
  if (!isFlaggedHashInputValid.value || hashActionLoading.value) return
  hashActionLoading.value = true
  try {
    const result = await adminAPI.riskControl.deleteFlaggedHash(flaggedHashInput.value)
    flaggedHashInput.value = ''
    await loadStatus(true)
    appStore.showSuccess(result.deleted ? t('admin.riskControl.flaggedHashDeleted') : t('admin.riskControl.flaggedHashNotFound'))
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.flaggedHashDeleteFailed')))
  } finally {
    hashActionLoading.value = false
  }
}

async function clearFlaggedHashes() {
  if (hashActionLoading.value) return
  hashActionLoading.value = true
  try {
    const result = await adminAPI.riskControl.clearFlaggedHashes()
    await loadStatus(true)
    clearHashesConfirmOpen.value = false
    appStore.showSuccess(t('admin.riskControl.flaggedHashesCleared', { count: result.deleted }))
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.flaggedHashesClearFailed')))
  } finally {
    hashActionLoading.value = false
  }
}

function openSettings() {
  activeSettingsTab.value = 'basic'
  settingsOpen.value = true
}

function reloadLogsFromFirstPage() {
  pagination.page = 1
  void loadLogs()
}

function clearLogFilters() {
  Object.assign(filters, { result: '', group_id: 0, endpoint: '', search: '', from: '', to: '' })
  reloadLogsFromFirstPage()
}

function onPageChange(page: number) {
  pagination.page = page
  void loadLogs()
}

function onPageSizeChange(pageSize: number) {
  pagination.page = 1
  pagination.page_size = pageSize
  void loadLogs()
}

function toggleClearApiKey() {
  configForm.clear_api_key = !configForm.clear_api_key
  if (configForm.clear_api_key) {
    configForm.api_keys_text = ''
    configForm.api_keys_mode = 'append'
    testedApiKeyStatuses.value = []
    pendingDeleteApiKeyHashes.value = []
  }
}

function setAPIKeysMode(mode: APIKeysWriteMode) {
  if (configForm.clear_api_key) return
  configForm.api_keys_mode = mode
  if (mode === 'replace') {
    pendingDeleteApiKeyHashes.value = []
  }
}

function setAPIKeysModeValue(value: string | number) {
  if (value === 'append' || value === 'replace') {
    setAPIKeysMode(value)
  }
}

function setGroupScope(value: string | number) {
  if (value === 'all' || value === 'selected') {
    configForm.all_groups = value === 'all'
  }
}

function setModelFilterType(type: ContentModerationModelFilterType) {
  configForm.model_filter_type = type
  if (type === 'all') {
    configForm.model_filter_models = []
  }
}

function setModelFilterTypeValue(value: string | number) {
  if (value === 'all' || value === 'include' || value === 'exclude') {
    setModelFilterType(value)
  }
}

function setKeywordBlockingMode(value: string | number) {
  if (value === 'keyword_and_api' || value === 'keyword_only' || value === 'api_only') {
    configForm.keyword_blocking_mode = value
  }
}

async function testApiKeys(useInputKeys: boolean) {
  const keys = useInputKeys ? parseApiKeys(configForm.api_keys_text) : []
  if (useInputKeys && keys.length === 0) {
    appStore.showError(t('admin.riskControl.apiKeyTestNoInput'))
    return
  }
  apiKeyTesting.value = true
  try {
    const result = await adminAPI.riskControl.testAPIKeys({
      api_keys: keys,
      base_url: configForm.base_url,
      model: configForm.model,
      timeout_ms: Number(configForm.timeout_ms) || 3000,
      // 与保存语义一致：0 强制直连，>0 指定代理，确保测试与实际审计走同一条链路
      proxy_id: configForm.proxy_id ?? 0,
      prompt: moderationTestPrompt.value,
      images: moderationTestImages.value,
    })
    moderationTestResult.value = result.audit_result ?? null
    if (useInputKeys) {
      testedApiKeyStatuses.value = result.items.map((item) => ({ ...item, configured: false }))
    } else {
      mergeConfiguredAPIKeyStatuses(result.items)
      testedApiKeyStatuses.value = []
      await loadStatus(true)
    }
    appStore.showSuccess(t('admin.riskControl.apiKeyTestDone', { count: result.items.length }))
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('admin.riskControl.apiKeyTestFailed')))
  } finally {
    apiKeyTesting.value = false
  }
}

function mergeConfiguredAPIKeyStatuses(items: ContentModerationAPIKeyStatus[]) {
  if (!hasModerationAuditInput.value || configForm.api_key_statuses.length === 0) {
    configForm.api_key_statuses = items
    return
  }
  const updates = new Map(items.map((item) => [item.key_hash, item]))
  configForm.api_key_statuses = configForm.api_key_statuses.map((item) => updates.get(item.key_hash) ?? item)
}

function toggleDeleteStoredApiKey(row: ContentModerationAPIKeyStatus) {
  if (!row.configured || !row.key_hash) return
  const index = pendingDeleteApiKeyHashes.value.indexOf(row.key_hash)
  if (index >= 0) {
    pendingDeleteApiKeyHashes.value.splice(index, 1)
    return
  }
  pendingDeleteApiKeyHashes.value.push(row.key_hash)
}

function isStoredApiKeyPendingDelete(row: ContentModerationAPIKeyStatus): boolean {
  return row.configured && row.key_hash !== '' && pendingDeleteApiKeyHashes.value.includes(row.key_hash)
}

function prunePendingDeleteAPIKeyHashes() {
  const currentHashes = new Set(savedApiKeyRows.value.map((row) => row.key_hash).filter(Boolean))
  pendingDeleteApiKeyHashes.value = pendingDeleteApiKeyHashes.value.filter((hash) => currentHashes.has(hash))
}

function clearModerationTestInput() {
  moderationTestPrompt.value = ''
  moderationTestImages.value = []
  moderationTestResult.value = null
}

function removeModerationTestImage(index: number) {
  moderationTestImages.value.splice(index, 1)
}

async function handleModerationImagePaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
  if (files.length === 0) return
  event.preventDefault()
  await addModerationTestFiles(files)
}

async function addModerationTestFiles(files: FileList | File[] | null) {
  if (!files) return
  const items = Array.from(files).filter((file) => file.type.startsWith('image/'))
  for (const file of items) {
    if (moderationTestImages.value.length >= maxModerationTestImages) {
      appStore.showError(t('admin.riskControl.auditTestImageLimit', { count: maxModerationTestImages }))
      return
    }
    if (file.size > maxModerationTestImageSize) {
      appStore.showError(t('admin.riskControl.auditTestImageTooLarge'))
      continue
    }
    try {
      moderationTestImages.value.push(await fileToDataURL(file))
    } catch {
      appStore.showError(t('admin.riskControl.auditTestImageReadFailed'))
    }
  }
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function toggleGroup(groupID: number) {
  const index = configForm.group_ids.indexOf(groupID)
  if (index >= 0) {
    configForm.group_ids.splice(index, 1)
  } else {
    configForm.group_ids.push(groupID)
  }
}

function isGroupSelected(groupID: number): boolean {
  return configForm.group_ids.includes(groupID)
}

function modeLabel(mode: ModerationMode): string {
  const found = modeOptions.value.find((option) => option.value === mode)
  return found?.label ?? mode
}

function modeDescription(mode: ModerationMode): string {
  const descriptions: Record<ModerationMode, string> = {
    pre_block: t('admin.riskControl.modePreBlockDesc'),
    observe: t('admin.riskControl.modeObserveDesc'),
    off: t('admin.riskControl.modeOffDesc'),
  }
  return descriptions[mode] ?? ''
}

function resultLabel(row: ContentModerationLog): string {
  if (row.action === 'cyber_policy') return t('admin.riskControl.action.cyberPolicy')
  if (row.action === 'keyword_block') return t('admin.riskControl.action.keywordBlock')
  if (row.action === 'block') return t('admin.riskControl.action.block')
  if (row.action === 'error' || row.error) return t('admin.riskControl.action.error')
  if (row.flagged) return t('admin.riskControl.result.hit')
  return t('admin.riskControl.result.pass')
}

function resultStatusTone(row: ContentModerationLog): 'success' | 'warning' | 'danger' {
  if (row.action === 'block' || row.action === 'keyword_block' || row.action === 'cyber_policy') return 'danger'
  if (row.action === 'error' || row.error || row.flagged) return 'warning'
  return 'success'
}

function percent(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(1)}%`
}

function percentValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value * 100))
}

function latencyText(value: number | null): string {
  if (value === null || value === undefined) return '-'
  return `${value} ms`
}

function apiKeyRowKey(row: ContentModerationAPIKeyStatus, index: number): string {
  return `${row.configured ? 'saved' : 'test'}-${row.key_hash || index}`
}

function apiKeyStatusLabel(statusValue: ContentModerationAPIKeyStatus['status']): string {
  const labels: Record<ContentModerationAPIKeyStatus['status'], string> = {
    ok: t('admin.riskControl.apiKeyStatusOk'),
    error: t('admin.riskControl.apiKeyStatusError'),
    frozen: t('admin.riskControl.apiKeyStatusFrozen'),
    unknown: t('admin.riskControl.apiKeyStatusUnknown'),
  }
  return labels[statusValue] ?? labels.unknown
}

function apiKeyStatusTone(statusValue: ContentModerationAPIKeyStatus['status']): string {
  if (statusValue === 'ok') return 'success'
  if (statusValue === 'error') return 'warning'
  if (statusValue === 'frozen') return 'danger'
  return 'neutral'
}

function apiKeyStatusMeta(row: ContentModerationAPIKeyStatus): string {
  const parts: string[] = []
  parts.push(t('admin.riskControl.apiKeyFailureCount', { count: row.failure_count || 0 }))
  if (row.last_latency_ms > 0) {
    parts.push(t('admin.riskControl.apiKeyLatency', { ms: row.last_latency_ms }))
  }
  if (row.last_http_status > 0) {
    parts.push(t('admin.riskControl.apiKeyHTTPStatus', { status: row.last_http_status }))
  }
  if (row.frozen_until) {
    parts.push(t('admin.riskControl.apiKeyFrozenUntil', { time: formatDateTime(row.frozen_until) }))
  } else if (row.last_checked_at) {
    parts.push(t('admin.riskControl.apiKeyLastChecked', { time: formatDateTime(row.last_checked_at) }))
  } else {
    parts.push(t('admin.riskControl.apiKeyNotTested'))
  }
  return parts.join(' / ')
}

function parseApiKeys(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item, index, arr) => item && arr.indexOf(item) === index)
}

function normalizeKeywordBlockingMode(value: unknown): KeywordBlockingMode {
  if (value === 'keyword_only' || value === 'api_only' || value === 'keyword_and_api') {
    return value
  }
  return 'keyword_and_api'
}

function normalizeModelFilter(value: unknown): ContentModerationModelFilter {
  if (!value || typeof value !== 'object') {
    return { type: 'all', models: [] }
  }
  const raw = value as Partial<ContentModerationModelFilter>
  const type = normalizeModelFilterType(raw.type)
  const models = type === 'all' ? [] : normalizeModelNames(raw.models)
  return { type, models }
}

function normalizeModelFilterType(value: unknown): ContentModerationModelFilterType {
  if (value === 'include' || value === 'exclude' || value === 'all') {
    return value
  }
  return 'all'
}

function normalizeModelNames(models: unknown): string[] {
  if (!Array.isArray(models)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of models) {
    const model = String(item ?? '').trim()
    if (!model) continue
    const key = model.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(model)
  }
  return out
}

function buildModelFilterPayload(): ContentModerationModelFilter {
  const type = normalizeModelFilterType(configForm.model_filter_type)
  if (type === 'all') {
    return { type: 'all', models: [] }
  }
  return {
    type,
    models: normalizeModelNames(configForm.model_filter_models),
  }
}

function riskThresholdsFromConfig(thresholds: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = { ...riskThresholdDefaults }
  for (const category of riskThresholdCategories) {
    const value = thresholds?.[category]
    if (Number.isFinite(value)) {
      out[category] = clampPercent(Number(value) * 100)
    }
  }
  return out
}

function buildRiskThresholdPayload(): Record<string, number> {
  const payload: Record<string, number> = {}
  for (const category of riskThresholdCategories) {
    payload[category] = Number((clampPercent(configForm.thresholds[category]) / 100).toFixed(4))
  }
  return payload
}

function resetRiskThresholds() {
  configForm.thresholds = { ...riskThresholdDefaults }
}

function clampPercent(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return 0
  }
  return Math.min(100, Math.max(0, numeric))
}

function formatThresholdPercent(value: number): string {
  return `${clampPercent(value).toFixed(1)}%`
}

function parseBlockedKeywords(value: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of value.split(/\r?\n/)) {
    const kw = line.trim()
    if (!kw) continue
    const key = kw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(kw)
  }
  return out
}

function violationCountText(row: ContentModerationLog): string {
  if (!row.flagged) return '-'
  if (row.violation_count === 0) return t('admin.riskControl.violationNotCounted')
  return t('admin.riskControl.violationCount', { count: row.violation_count || 1 })
}

function normalizeDateTimeLocal(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function formatDateTime(value: string): string {
  return formatDateTimeValue(value) || '-'
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

onMounted(() => {
  void loadAll()
  statusTimer = window.setInterval(() => {
    void loadStatus(true)
  }, 15000)
})

onUnmounted(() => {
  logsRequestId++
  if (statusTimer !== null) {
    window.clearInterval(statusTimer)
    statusTimer = null
  }
})
</script>

<style scoped>
.risk-page {
  min-width: 0;
}

.risk-loading {
  display: grid;
  gap: 18px;
}

.risk-loading__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.risk-runtime-grid {
  display: grid;
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 24px;
}

.risk-runtime-panel {
  min-width: 0;
  border-block: 1px solid var(--ui-border-soft);
}

.risk-runtime-panel__header,
.risk-section-heading,
.risk-api-health__header,
.risk-audit-result__header,
.risk-audit-test__header,
.risk-worker-pool__header,
.risk-queue__meta,
.risk-keywords__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.risk-runtime-panel__header {
  padding: 16px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-runtime-panel__header h2,
.risk-section-heading strong,
.risk-api-health__header strong,
.risk-audit-result__header strong,
.risk-audit-test__header strong,
.risk-worker-pool__header strong,
.risk-queue__meta strong,
.risk-setting-row__copy strong,
.risk-keywords__header strong,
.risk-group-list__identity strong {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
}

.risk-runtime-panel__header h2 {
  margin: 0;
  font-size: 18px;
  line-height: 28px;
}

.risk-runtime-panel__header p,
.risk-section-heading p,
.risk-api-health__header p,
.risk-audit-result__header p,
.risk-audit-test__header p,
.risk-worker-pool__header p,
.risk-queue__meta p,
.risk-setting-row__copy p,
.risk-group-list__identity p {
  margin: 2px 0 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.risk-runtime-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 20px;
}

.risk-runtime-panel__summary {
  max-width: 440px;
  color: var(--ui-text-muted);
  font-size: 11px;
  line-height: 18px;
  text-align: right;
}

.risk-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.risk-runtime-panel__body {
  padding: 16px 0;
}

.risk-key-loads {
  display: grid;
  max-height: 360px;
  overflow-y: auto;
}

.risk-key-loads__row {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-key-loads__row:last-child {
  border-bottom: 0;
}

.risk-key-loads__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.risk-key-loads__identity {
  min-width: 0;
}

.risk-key-loads__name,
.risk-api-health__name,
.risk-badges,
.risk-section-heading__copy,
.risk-section-heading__actions,
.risk-api-health__actions {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.risk-key-loads__name > span:nth-child(2),
.risk-api-health__name > span:first-child {
  overflow: hidden;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-key-loads__identity > p,
.risk-api-health__identity > p {
  margin: 3px 0 0;
  color: var(--ui-text-muted);
  font-size: 11px;
  line-height: 18px;
}

.risk-key-loads__metrics {
  display: grid;
  min-width: 300px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  text-align: right;
}

.risk-key-loads__metrics p {
  margin: 0;
  color: var(--ui-text-soft);
  font-size: 10px;
}

.risk-key-loads__metrics strong {
  display: block;
  margin-top: 2px;
  color: var(--ui-text);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.risk-worker-layout {
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  gap: 24px;
  padding: 16px 0;
}

.risk-worker-summary {
  display: grid;
  align-content: start;
  gap: 12px;
}

.risk-queue {
  display: grid;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-queue__meta > span {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
}

.risk-worker-pool {
  min-width: 0;
}

.risk-worker-pool__header {
  margin-bottom: 12px;
}

.risk-worker-slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
}

.risk-worker-slot {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid var(--ui-border-soft);
  border-radius: 4px;
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  font-size: 12px;
  font-weight: 600;
}

.risk-worker-slot i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ui-text-soft);
}

.risk-worker-slot[data-state='active'] {
  color: var(--ui-info);
  background: color-mix(in srgb, var(--ui-info) 6%, var(--ui-surface));
}

.risk-worker-slot[data-state='active'] i {
  background: var(--ui-info);
}

.risk-worker-slot[data-state='idle'] {
  color: var(--ui-success);
  background: color-mix(in srgb, var(--ui-success) 6%, var(--ui-surface));
}

.risk-worker-slot[data-state='idle'] i {
  background: var(--ui-success);
}

.risk-records__model-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-records__model-summary {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.risk-records__model-summary > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-records__filters {
  margin-bottom: 12px;
}

.risk-records__pagination {
  margin-top: 10px;
}

.risk-table-cell__meta {
  margin-top: 2px;
  color: var(--ui-text-soft);
  font-size: 11px;
  line-height: 16px;
}

.risk-table-cell__meta--danger {
  color: var(--ui-danger);
}

.risk-table-cell__input {
  display: block;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-settings {
  min-width: 0;
}

.risk-settings__tab {
  display: grid;
  gap: 20px;
  padding-top: 20px;
}

.risk-settings__section {
  display: grid;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid var(--ui-border-soft);
}

.risk-setting-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.risk-setting-row--divided {
  padding-top: 14px;
  border-top: 1px solid var(--ui-border-soft);
}

.risk-setting-row__copy {
  min-width: 0;
}

.risk-section-heading__copy {
  align-items: flex-start;
}

.risk-section-heading__icon {
  flex: 0 0 auto;
  color: var(--ui-info);
}

.risk-section-heading__actions {
  justify-content: flex-end;
}

.risk-api-key-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 440px);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border-soft);
}

.risk-api-key-editor__input {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
}

.risk-api-key-editor__mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-api-key-editor__mode strong,
.risk-api-key-editor__mode span {
  display: block;
}

.risk-api-key-editor__mode strong {
  color: var(--ui-text);
  font-size: 12px;
  line-height: 20px;
}

.risk-api-key-editor__mode span {
  margin-top: 2px;
  color: var(--ui-text-muted);
  font-size: 11px;
}

.risk-audit-test {
  padding-top: 16px;
  border-top: 1px solid var(--ui-border-soft);
}

.risk-audit-test__header {
  margin-bottom: 12px;
}

.risk-audit-test__upload {
  margin-top: 12px;
}

.risk-audit-images {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.risk-audit-image {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  border: 1px solid var(--ui-border-soft);
  border-radius: 6px;
  background: var(--ui-surface-muted);
}

.risk-audit-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}

.risk-audit-image__remove {
  position: absolute;
  top: 6px;
  right: 6px;
}

.risk-api-health {
  min-width: 0;
  padding-left: 16px;
  border-left: 1px solid var(--ui-border-soft);
}

.risk-api-health__header {
  margin-bottom: 12px;
}

.risk-api-health__content,
.risk-api-health__list,
.risk-audit-result__categories {
  display: grid;
  gap: 8px;
}

.risk-api-health__list--expanded {
  max-height: 288px;
  overflow-y: auto;
  padding-right: 4px;
}

.risk-api-health__row {
  display: grid;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-api-health__row--pending {
  opacity: .7;
}

.risk-api-health__row-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.risk-api-health__identity {
  min-width: 0;
}

.risk-api-health__actions {
  flex: 0 0 auto;
  flex-wrap: nowrap;
}

.risk-api-health__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--ui-text-muted);
  font-size: 11px;
}

.risk-api-health__toggle > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-audit-result {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border-soft);
}

.risk-audit-result__score {
  display: grid;
  gap: 6px;
}

.risk-audit-result__score-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--ui-text-muted);
  font-size: 11px;
}

.risk-audit-result__score-meta > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-audit-result__categories {
  max-height: 208px;
  overflow-y: auto;
}

.risk-group-scope {
  display: grid;
  gap: 16px;
}

.risk-group-list {
  display: grid;
  max-height: 420px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 16px;
  overflow-y: auto;
}

.risk-group-list__row {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-group-list__identity {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 4px;
}

.risk-group-list__identity strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-hash-tools {
  display: grid;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 0 0 12px;
  border-left: 2px solid var(--ui-border);
}

.risk-hash-tools__delete {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}

.risk-thresholds {
  display: grid;
  border-top: 1px solid var(--ui-border-soft);
}

.risk-thresholds__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  align-items: center;
  gap: 20px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.risk-thresholds__label {
  min-width: 0;
}

.risk-thresholds__label label {
  display: block;
  overflow: hidden;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-thresholds__label p,
.risk-keywords__limit {
  margin: 2px 0 0;
  color: var(--ui-text-muted);
  font-size: 11px;
  line-height: 18px;
}

.risk-keywords {
  min-width: 0;
}

.risk-keywords__header {
  margin-bottom: 8px;
}

.risk-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.risk-input-detail {
  display: grid;
  gap: 20px;
}

@media (max-width: 1000px) {
  .risk-loading__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .risk-runtime-grid,
  .risk-worker-layout,
  .risk-api-key-editor {
    grid-template-columns: 1fr;
  }

  .risk-api-health {
    padding: 16px 0 0;
    border-top: 1px solid var(--ui-border-soft);
    border-left: 0;
  }

  .risk-group-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .risk-loading__metrics,
  .risk-group-list {
    grid-template-columns: 1fr;
  }

  .risk-runtime-panel__header,
  .risk-section-heading,
  .risk-api-health__header,
  .risk-audit-result__header,
  .risk-worker-pool__header,
  .risk-key-loads__summary,
  .risk-api-key-editor__mode,
  .risk-records__model-filter {
    align-items: flex-start;
    flex-direction: column;
  }

  .risk-runtime-panel__summary {
    max-width: none;
    text-align: left;
  }

  .risk-section-heading__actions,
  .risk-section-heading__actions > * {
    width: 100%;
  }

  .risk-key-loads__metrics {
    width: 100%;
    min-width: 0;
    text-align: left;
  }

  .risk-setting-row,
  .risk-api-health__row-main {
    align-items: flex-start;
  }

  .risk-hash-tools__delete,
  .risk-thresholds__row {
    grid-template-columns: 1fr;
  }

  .risk-audit-images {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
