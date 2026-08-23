<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('nav.apiKeys')" :description="t('keys.createFirstKey')" />
      <UiServerTableWorkspace :loading="loading" :empty="false" :aria-busy="loading">
      <template #filters>
        <div class="keys-filter-layout">
          <div class="keys-filter-controls">
            <UiSearchInput
              v-model="filterSearch"
              :placeholder="t('keys.searchPlaceholder')"
              density="compact"
              @search="onFilterChange"
            />
            <UiSelect
              :model-value="filterGroupId"
              :options="groupFilterOptions"
              @update:model-value="onGroupFilterChange"
            />
            <UiSelect
              :model-value="filterStatus"
              :options="statusFilterOptions"
              @update:model-value="onStatusFilterChange"
            />
          </div>
          <EndpointPopover
            v-if="publicSettings?.api_base_url || (publicSettings?.custom_endpoints?.length ?? 0) > 0"
            :api-base-url="publicSettings?.api_base_url || ''"
            :custom-endpoints="publicSettings?.custom_endpoints || []"
          />
        </div>
      </template>

      <template #actions>
        <div class="keys-actions">
          <UiIconButton
            icon="refresh"
            density="compact"
            :label="t('common.refresh')"
            :disabled="loading"
            @click="loadApiKeys"
          />
          <UiColumnPicker
            :model-value="visibleColumnKeys"
            :columns="columnPickerColumns"
            :label="t('keys.columnSettings')"
            @update:model-value="updateVisibleColumns"
          />
          <UiButton @click="openCreateModal(subscriptionIntentGroup)" variant="primary" density="compact" data-tour="keys-create-btn">
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ isSubscriptionBindMode ? t('keys.subscriptionIntent.createKey') : t('keys.createKey') }}
          </UiButton>
        </div>
      </template>

      <template #default>
        <div
          v-if="isSubscriptionBindMode && subscriptionIntentGroup"
          class="keys-subscription-banner"
          data-testid="subscription-bind-banner"
        >
          <div class="keys-subscription-banner__content">
            <Icon name="link" size="md" class="keys-subscription-banner__icon" />
            <div>
              <p class="keys-subscription-banner__title">
                {{ t('keys.subscriptionIntent.bindTitle') }}
              </p>
              <p class="keys-subscription-banner__description">
                {{ t('keys.subscriptionIntent.bindDescription', { group: subscriptionIntentGroup.name }) }}
              </p>
            </div>
          </div>
          <UiButton
            type="button"
            variant="secondary"
            density="compact"
            class="keys-subscription-banner__cancel"
            :disabled="bindingSubscriptionKey"
            data-testid="cancel-subscription-bind"
            @click="clearSubscriptionBindingMode"
          >
            {{ t('common.cancel') }}
          </UiButton>
        </div>

        <UiErrorState
          v-if="loadError && apiKeys.length === 0"
          :title="t('keys.failedToLoad')"
          :description="t('keys.failedToLoad')"
          :retry-text="t('common.retry')"
          data-testid="keys-load-error"
          @retry="loadApiKeys"
        />
        <template v-else>
        <UiAlert
          v-if="loadError"
          tone="danger"
          :title="t('keys.failedToLoad')"
          data-testid="keys-refresh-error"
        />
        <UiDataTable
          :columns="columns"
          :data="apiKeys"
          :loading="loading"
          :mobile-table="true"
          :aria-label="t('nav.apiKeys')"
          :server-side-sort="true"
          default-sort-key="created_at"
          default-sort-order="desc"
          @sort="handleSort"
        >
          <template #cell-id="{ value }">
            <span class="keys-cell-id">#{{ value }}</span>
          </template>

          <template #cell-key="{ value, row }">
            <div class="keys-cell-key">
              <code>
                {{ maskApiKey(value) }}
              </code>
              <UiIconButton
                :icon="copiedKeyId === row.id ? 'check' : 'clipboard'"
                :variant="copiedKeyId === row.id ? 'success' : 'ghost'"
                density="mini"
                :label="copiedKeyId === row.id ? t('keys.copied') : t('keys.copyToClipboard')"
                @click="copyToClipboard(value, row.id)"
              />
            </div>
          </template>

          <template #cell-name="{ value, row }">
            <div class="keys-cell-name">
              <span>{{ value }}</span>
              <Icon
                v-if="row.ip_whitelist?.length > 0 || row.ip_blacklist?.length > 0"
                name="shield"
                size="sm"
                class="keys-cell-name__restricted"
                :title="t('keys.ipRestrictionEnabled')"
              />
            </div>
          </template>

          <template #cell-group="{ row }">
            <div v-if="isSubscriptionBindMode" class="keys-group-value">
              <GroupBadge
                v-if="row.group"
                :name="row.group.name"
                :platform="row.group.platform"
                :rate-multiplier="row.group.rate_multiplier"
                :user-rate-multiplier="userGroupRates[row.group.id]"
                :peak-rate-enabled="row.group.peak_rate_enabled"
                :peak-start="row.group.peak_start"
                :peak-end="row.group.peak_end"
                :peak-rate-multiplier="row.group.peak_rate_multiplier"
              />
              <span v-else class="keys-cell-muted">{{ t('keys.noGroup') }}</span>
            </div>
            <UiPopover
              v-else
              placement="bottom-start"
              panel-role="dialog"
              :aria-label="t('keys.selectGroup')"
              width="380px"
              @open-change="(open) => prepareGroupSelector(row, open)"
            >
              <template #trigger="{ open }">
                <button
                  type="button"
                  class="keys-group-trigger"
                  :disabled="groupChangePendingKeys.has(row.id)"
                  :aria-expanded="open"
                  aria-haspopup="dialog"
                  :title="t('keys.clickToChangeGroup')"
                >
                <GroupBadge
                  v-if="row.group"
                  :name="row.group.name"
                  :platform="row.group.platform"
                  :rate-multiplier="row.group.rate_multiplier"
                  :user-rate-multiplier="userGroupRates[row.group.id]"
                  :peak-rate-enabled="row.group.peak_rate_enabled"
                  :peak-start="row.group.peak_start"
                  :peak-end="row.group.peak_end"
                  :peak-rate-multiplier="row.group.peak_rate_multiplier"
                />
                  <span v-else class="keys-cell-muted">{{ t('keys.noGroup') }}</span>
                  <span class="keys-group-trigger__hint">{{ t('keys.selectGroup') }}</span>
                  <Icon name="chevronDown" size="xs" />
                </button>
              </template>
              <template #default="{ close }">
                <div class="keys-group-picker">
                  <UiTextField
                    v-model="groupSearchQuery"
                    :placeholder="t('keys.searchGroup')"
                    density="compact"
                    :label="t('keys.searchGroup')"
                  >
                    <template #prefix><Icon name="search" size="sm" /></template>
                  </UiTextField>
                  <div
                    class="keys-group-picker__list"
                    role="listbox"
                    :aria-label="t('keys.selectGroup')"
                  >
                    <button
                      v-for="option in filteredGroupOptions"
                      :key="option.value ?? 'null'"
                      type="button"
                      role="option"
                      class="keys-group-picker__option"
                      :disabled="groupChangePendingKeys.has(row.id)"
                      :aria-selected="row.group_id === option.value || (!row.group_id && option.value === null)"
                      :title="option.description || undefined"
                      @click="changeGroup(row, option.value); close()"
                    >
                      <GroupOptionItem
                        :name="option.label"
                        :platform="option.platform"
                        :rate-multiplier="option.rate"
                        :user-rate-multiplier="option.userRate"
                        :peak-rate-enabled="option.peakRateEnabled"
                        :peak-start="option.peakStart"
                        :peak-end="option.peakEnd"
                        :peak-rate-multiplier="option.peakRateMultiplier"
                        :description="option.description"
                        :selected="row.group_id === option.value || (!row.group_id && option.value === null)"
                      />
                    </button>
                    <UiEmptyState
                      v-if="filteredGroupOptions.length === 0"
                      icon="search"
                      :title="t('keys.noGroupFound')"
                    />
                  </div>
                </div>
              </template>
            </UiPopover>
          </template>

          <template #cell-current_concurrency="{ value }">
            <UiBadge :tone="(value ?? 0) > 0 ? 'success' : 'neutral'" :label="String(value ?? 0)" />
          </template>

          <template #cell-usage="{ row }">
            <div class="keys-usage-cell">
              <div class="keys-metric-line">
                <span>{{ t('keys.today') }}:</span>
                <strong>
                  ${{ (usageStats[row.id]?.today_actual_cost ?? 0).toFixed(4) }}
                </strong>
              </div>
              <div class="keys-metric-line">
                <span>{{ t('keys.total') }}:</span>
                <strong>
                  ${{ (usageStats[row.id]?.total_actual_cost ?? 0).toFixed(4) }}
                </strong>
              </div>
              <div v-if="row.quota > 0" class="keys-usage-cell__quota">
                <div class="keys-metric-line">
                  <span>{{ t('keys.quota') }}:</span>
                  <span :class="[
                    'keys-cost-value',
                    row.quota_used >= row.quota ? 'keys-cost-value--danger' :
                    row.quota_used >= row.quota * 0.8 ? 'keys-cost-value--warning' : ''
                  ]">
                    ${{ row.quota_used?.toFixed(2) || '0.00' }} / ${{ row.quota?.toFixed(2) }}
                  </span>
                </div>
                <UiProgressBar
                  :value="usagePercent(row.quota_used, row.quota)"
                  :show-value="false"
                  :tone="usageTone(row.quota_used, row.quota)"
                  :label="t('keys.quota')"
                />
              </div>
            </div>
          </template>

          <template #cell-rate_limit="{ row }">
            <div v-if="row.rate_limit_5h > 0 || row.rate_limit_1d > 0 || row.rate_limit_7d > 0" class="keys-rate-limits">
              <div v-if="row.rate_limit_5h > 0" class="keys-rate-window">
                <div class="keys-rate-window__head">
                  <span>5h</span>
                  <span :class="[
                    'keys-cost-value',
                    row.usage_5h >= row.rate_limit_5h ? 'keys-cost-value--danger' :
                    row.usage_5h >= row.rate_limit_5h * 0.8 ? 'keys-cost-value--warning' : ''
                  ]">
                    ${{ row.usage_5h?.toFixed(2) || '0.00' }}/${{ row.rate_limit_5h?.toFixed(2) }}
                  </span>
                </div>
                <UiProgressBar
                  :value="usagePercent(row.usage_5h, row.rate_limit_5h)"
                  :show-value="false"
                  :tone="usageTone(row.usage_5h, row.rate_limit_5h)"
                  label="5h"
                />
                <div v-if="row.reset_5h_at && formatResetTime(row.reset_5h_at)" class="keys-rate-window__reset">
                  <Icon name="clock" size="xs" />
                  {{ formatResetTime(row.reset_5h_at) }}
                </div>
              </div>
              <div v-if="row.rate_limit_1d > 0" class="keys-rate-window">
                <div class="keys-rate-window__head">
                  <span>1d</span>
                  <span :class="[
                    'keys-cost-value',
                    row.usage_1d >= row.rate_limit_1d ? 'keys-cost-value--danger' :
                    row.usage_1d >= row.rate_limit_1d * 0.8 ? 'keys-cost-value--warning' : ''
                  ]">
                    ${{ row.usage_1d?.toFixed(2) || '0.00' }}/${{ row.rate_limit_1d?.toFixed(2) }}
                  </span>
                </div>
                <UiProgressBar
                  :value="usagePercent(row.usage_1d, row.rate_limit_1d)"
                  :show-value="false"
                  :tone="usageTone(row.usage_1d, row.rate_limit_1d)"
                  label="1d"
                />
                <div v-if="row.reset_1d_at && formatResetTime(row.reset_1d_at)" class="keys-rate-window__reset">
                  <Icon name="clock" size="xs" />
                  {{ formatResetTime(row.reset_1d_at) }}
                </div>
              </div>
              <div v-if="row.rate_limit_7d > 0" class="keys-rate-window">
                <div class="keys-rate-window__head">
                  <span>7d</span>
                  <span :class="[
                    'keys-cost-value',
                    row.usage_7d >= row.rate_limit_7d ? 'keys-cost-value--danger' :
                    row.usage_7d >= row.rate_limit_7d * 0.8 ? 'keys-cost-value--warning' : ''
                  ]">
                    ${{ row.usage_7d?.toFixed(2) || '0.00' }}/${{ row.rate_limit_7d?.toFixed(2) }}
                  </span>
                </div>
                <UiProgressBar
                  :value="usagePercent(row.usage_7d, row.rate_limit_7d)"
                  :show-value="false"
                  :tone="usageTone(row.usage_7d, row.rate_limit_7d)"
                  label="7d"
                />
                <div v-if="row.reset_7d_at && formatResetTime(row.reset_7d_at)" class="keys-rate-window__reset">
                  <Icon name="clock" size="xs" />
                  {{ formatResetTime(row.reset_7d_at) }}
                </div>
              </div>
              <UiButton
                v-if="row.usage_5h > 0 || row.usage_1d > 0 || row.usage_7d > 0"
                variant="quiet"
                density="dense"
                @click.stop="confirmResetRateLimitFromTable(row)"
                :title="t('keys.resetRateLimitUsage')"
              >
                <template #icon><Icon name="refresh" size="xs" /></template>
                {{ t('keys.resetUsage') }}
              </UiButton>
            </div>
            <span v-else class="keys-cell-muted">-</span>
          </template>

          <template #cell-expires_at="{ value }">
            <span v-if="value" :class="[
              'keys-date-value',
              new Date(value) < new Date() ? 'keys-date-value--expired' : ''
            ]">
              {{ formatDateTime(value) }}
            </span>
            <span v-else class="keys-cell-muted">{{ t('keys.noExpiration') }}</span>
          </template>

          <template #cell-status="{ value }">
            <UiStatusBadge :status="value" :label="t('keys.status.' + value)" />
          </template>

          <template #cell-last_used_at="{ value }">
            <span v-if="value" class="keys-date-value">
              {{ formatDateTime(value) }}
            </span>
            <span v-else class="keys-cell-muted">-</span>
          </template>

          <template #cell-last_used_ip="{ value }">
            <code v-if="value" class="keys-ip-value">
              {{ value }}
            </code>
            <span v-else class="keys-cell-muted">-</span>
          </template>

          <template #cell-created_at="{ value }">
            <span class="keys-date-value">{{ formatDateTime(value) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="keys-row-actions">
              <UiButton
                v-if="isSubscriptionBindMode"
                type="button"
                variant="secondary"
                density="dense"
                :disabled="row.group_id === subscriptionIntentGroup?.id"
                data-testid="bind-key-action"
                @click="requestSubscriptionBinding(row)"
              >
                <Icon :name="row.group_id === subscriptionIntentGroup?.id ? 'check' : 'link'" size="xs" />
                {{ row.group_id === subscriptionIntentGroup?.id
                  ? t('keys.subscriptionIntent.alreadyBound')
                  : t('keys.subscriptionIntent.bindAction') }}
              </UiButton>
              <template v-else>
              <UiIconButton icon="terminal" variant="success" density="mini" :label="t('keys.useKey')" @click="openUseKeyModal(row)" />
              <UiIconButton
                v-if="!publicSettings?.hide_ccs_import_button"
                icon="upload"
                density="mini"
                :label="t('keys.importToCcSwitch')"
                @click="importToCcswitch(row)"
              />
              <UiIconButton
                :icon="row.status === 'active' ? 'ban' : 'checkCircle'"
                :variant="row.status === 'active' ? 'danger' : 'success'"
                density="mini"
                :disabled="statusChangePendingKeys.has(row.id)"
                :label="row.status === 'active' ? t('keys.disable') : t('keys.enable')"
                @click="toggleKeyStatus(row)"
              />
              <UiIconButton icon="edit" density="mini" :label="t('common.edit')" @click="editKey(row)" />
              <UiIconButton icon="trash" variant="danger" density="mini" :label="t('common.delete')" @click="confirmDelete(row)" />
              </template>
            </div>
          </template>

          <template #empty>
            <UiEmptyState
              :title="isSubscriptionBindMode ? t('keys.subscriptionIntent.noKeys') : t('keys.noKeysYet')"
              :description="isSubscriptionBindMode ? t('keys.subscriptionIntent.noKeysDescription') : t('keys.createFirstKey')"
            >
              <template #action>
                <UiButton variant="primary" density="compact" @click="openCreateModal(subscriptionIntentGroup)">
                  {{ isSubscriptionBindMode ? t('keys.subscriptionIntent.createKey') : t('keys.createKey') }}
                </UiButton>
              </template>
            </UiEmptyState>
          </template>
        </UiDataTable>
        </template>
      </template>

      <template #pagination>
        <UiPagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          :page-size-options="paginationPageSizeOptions"
          :reset-page-on-page-size-change="false"
          :summary-label="t('pagination.showing')"
          :page-size-label="t('pagination.perPage')"
          :previous-label="t('pagination.previous')"
          :next-label="t('pagination.next')"
          :jump-label="t('pagination.jumpTo')"
          :jump-action-label="t('pagination.jumpAction')"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </template>
      </UiServerTableWorkspace>
    </AppPage>

    <UiDialog
      :show="showCreateModal || showEditModal"
      :title="showEditModal
        ? t('keys.editKey')
        : subscriptionCreateGroup
          ? t('keys.subscriptionIntent.createTitle')
          : t('keys.createKey')"
      width="wide"
      :close-on-escape="!submitting"
      :show-close-button="!submitting"
      @close="closeModals"
    >
      <form id="key-form" class="key-form" @submit.prevent="handleSubmit">
        <div
          v-if="subscriptionCreateGroup && !showEditModal"
          class="key-form__context"
          data-testid="subscription-create-context"
        >
          {{ t('keys.subscriptionIntent.createDescription', { group: subscriptionCreateGroup.name }) }}
        </div>

        <div class="key-form__grid">
          <UiTextField
            v-model="formData.name"
            :label="t('keys.nameLabel')"
            :placeholder="t('keys.namePlaceholder')"
            required
            density="compact"
            test-id="key-form-name"
            data-tour="key-form-name"
          />

          <UiSelect
            v-model="formData.group_id"
            :label="t('keys.groupLabel')"
            :options="groupOptions"
            :placeholder="t('keys.selectGroup')"
            :searchable="true"
            :search-placeholder="t('keys.searchGroup')"
            required
            density="compact"
            data-tour="key-form-group"
          >
            <template #selected="{ option }">
              <GroupBadge
                v-if="option"
                :name="(option as unknown as GroupOption).label"
                :platform="(option as unknown as GroupOption).platform"
                :rate-multiplier="(option as unknown as GroupOption).rate"
                :user-rate-multiplier="(option as unknown as GroupOption).userRate"
                :peak-rate-enabled="(option as unknown as GroupOption).peakRateEnabled"
                :peak-start="(option as unknown as GroupOption).peakStart"
                :peak-end="(option as unknown as GroupOption).peakEnd"
                :peak-rate-multiplier="(option as unknown as GroupOption).peakRateMultiplier"
              />
              <span v-else class="keys-cell-muted">{{ t('keys.selectGroup') }}</span>
            </template>
            <template #option="{ option, selected }">
              <GroupOptionItem
                :name="(option as unknown as GroupOption).label"
                :platform="(option as unknown as GroupOption).platform"
                :rate-multiplier="(option as unknown as GroupOption).rate"
                :user-rate-multiplier="(option as unknown as GroupOption).userRate"
                :peak-rate-enabled="(option as unknown as GroupOption).peakRateEnabled"
                :peak-start="(option as unknown as GroupOption).peakStart"
                :peak-end="(option as unknown as GroupOption).peakEnd"
                :peak-rate-multiplier="(option as unknown as GroupOption).peakRateMultiplier"
                :description="(option as unknown as GroupOption).description"
                :selected="selected"
              />
            </template>
          </UiSelect>

          <section v-if="!showEditModal" class="key-form__control-group">
            <div class="key-form__section-head">
              <h3>{{ t('keys.customKeyLabel') }}</h3>
              <UiSwitch
                v-model="formData.use_custom_key"
                :label="t('keys.customKeyLabel')"
              />
            </div>
            <UiTextField
              v-if="formData.use_custom_key"
              v-model="formData.custom_key"
              :placeholder="t('keys.customKeyPlaceholder')"
              :description="customKeyError ? undefined : t('keys.customKeyHint')"
              :error="customKeyError"
              monospace
              density="compact"
            />
          </section>

          <UiSelect
            v-if="showEditModal"
            v-model="formData.status"
            :label="t('keys.statusLabel')"
            :options="statusOptions"
            :placeholder="t('keys.selectStatus')"
            density="compact"
          />
        </div>

        <section class="key-form__section">
          <div class="key-form__section-head">
            <div>
              <h3>{{ t('keys.ipRestriction') }}</h3>
            </div>
            <UiSwitch
              v-model="formData.enable_ip_restriction"
              :label="t('keys.ipRestriction')"
            />
          </div>

          <div v-if="formData.enable_ip_restriction" class="key-form__subgrid">
            <UiTextArea
              v-model="formData.ip_whitelist"
              :label="t('keys.ipWhitelist')"
              :placeholder="t('keys.ipWhitelistPlaceholder')"
              :description="t('keys.ipWhitelistHint')"
              :rows="3"
            />
            <UiTextArea
              v-model="formData.ip_blacklist"
              :label="t('keys.ipBlacklist')"
              :placeholder="t('keys.ipBlacklistPlaceholder')"
              :description="t('keys.ipBlacklistHint')"
              :rows="3"
            />
          </div>
        </section>

        <div class="key-form__columns">
          <section class="key-form__section">
            <div class="key-form__section-head">
              <h3>{{ t('keys.quotaLimit') }}</h3>
            </div>
            <UiTextField
              :model-value="formData.quota"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              :placeholder="t('keys.quotaAmountPlaceholder')"
              :description="t('keys.quotaAmountHint')"
              density="compact"
              @update:model-value="setOptionalNumberField('quota', $event)"
            >
              <template #prefix>$</template>
            </UiTextField>

            <div v-if="showEditModal && selectedKey && selectedKey.quota > 0" class="key-form__usage">
              <div class="key-form__usage-head">
                <span>{{ t('keys.quotaUsed') }}</span>
                <strong>${{ selectedKey.quota_used?.toFixed(4) || '0.0000' }} / ${{ selectedKey.quota.toFixed(2) }}</strong>
              </div>
              <UiProgressBar
                :value="usagePercent(selectedKey.quota_used, selectedKey.quota)"
                :show-value="false"
                :tone="usageTone(selectedKey.quota_used, selectedKey.quota)"
                :label="t('keys.quotaUsed')"
              />
              <UiButton density="dense" @click="confirmResetQuota">
                {{ t('keys.reset') }}
              </UiButton>
            </div>
          </section>

          <section class="key-form__section">
            <div class="key-form__section-head">
              <div>
                <h3>{{ t('keys.rateLimitSection') }}</h3>
                <p>{{ t('keys.rateLimitHint') }}</p>
              </div>
              <UiSwitch
                v-model="formData.enable_rate_limit"
                :label="t('keys.rateLimitSection')"
              />
            </div>

            <div v-if="formData.enable_rate_limit" class="key-form__rate-grid">
              <div v-for="field in rateLimitFields" :key="field.key" class="key-form__rate-field">
                <UiTextField
                  :model-value="field.value"
                  type="number"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  :label="field.label"
                  placeholder="0"
                  density="compact"
                  @update:model-value="setOptionalNumberField(field.key, $event)"
                >
                  <template #prefix>$</template>
                </UiTextField>
                <div v-if="showEditModal && field.limit > 0" class="key-form__usage">
                  <div class="key-form__usage-head">
                    <span>{{ field.label }}</span>
                    <strong>${{ field.used.toFixed(4) }} / ${{ field.limit.toFixed(2) }}</strong>
                  </div>
                  <UiProgressBar
                    :value="usagePercent(field.used, field.limit)"
                    :show-value="false"
                    :tone="usageTone(field.used, field.limit)"
                    :label="field.label"
                  />
                </div>
              </div>
            </div>

            <UiButton
              v-if="showEditModal && selectedKey && hasConfiguredRateLimit(selectedKey)"
              density="dense"
              @click="confirmResetRateLimit"
            >
              {{ t('keys.resetRateLimitUsage') }}
            </UiButton>
          </section>

          <section class="key-form__section">
            <div class="key-form__section-head">
              <h3>{{ t('keys.expiration') }}</h3>
              <UiSwitch
                v-model="formData.enable_expiration"
                :label="t('keys.expiration')"
              />
            </div>

            <div v-if="formData.enable_expiration" class="key-form__expiration">
              <UiSegmentedControl
                :model-value="formData.expiration_preset"
                :options="expirationPresetOptions"
                :label="t('keys.expiration')"
                @update:model-value="handleExpirationPresetChange"
              />
              <UiTextField
                v-model="formData.expiration_date"
                type="datetime-local"
                :label="t('keys.expirationDate')"
                :description="t('keys.expirationDateHint')"
                density="compact"
              />
              <p v-if="showEditModal && selectedKey?.expires_at" class="key-form__current-value">
                <span>{{ t('keys.currentExpiration') }}</span>
                <strong>{{ formatDateTime(selectedKey.expires_at) }}</strong>
              </p>
            </div>
          </section>
        </div>
      </form>
      <template #footer>
        <div class="key-form__actions">
          <UiButton density="compact" :disabled="submitting" @click="closeModals">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            form="key-form"
            type="submit"
            variant="primary"
            density="compact"
            :loading="submitting"
            data-tour="key-form-submit"
          >
            {{
              submitting
                ? t('keys.saving')
                : showEditModal
                  ? t('common.update')
                  : t('common.create')
            }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <UiConfirmDialog
      :show="pendingSubscriptionBindingKey !== null"
      :title="t('keys.subscriptionIntent.confirmTitle')"
      :message="subscriptionBindingConfirmMessage"
      :confirm-text="t('keys.subscriptionIntent.confirmAction')"
      :cancel-text="t('common.cancel')"
      :pending="bindingSubscriptionKey"
      @confirm="confirmSubscriptionBinding"
      @cancel="cancelSubscriptionBinding"
    />

    <!-- Delete Confirmation Dialog -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('keys.deleteKey')"
      :message="t('keys.deleteConfirmMessage', { name: selectedKey?.name })"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="deletingKeyId !== null"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- Reset Quota Confirmation Dialog -->
    <UiConfirmDialog
      :show="showResetQuotaDialog"
      :title="t('keys.resetQuotaTitle')"
      :message="t('keys.resetQuotaConfirmMessage', { name: selectedKey?.name, used: selectedKey?.quota_used?.toFixed(4) })"
      :confirm-text="t('keys.reset')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="resetQuotaPending"
      @confirm="resetQuotaUsed"
      @cancel="showResetQuotaDialog = false"
    />

    <!-- Reset Rate Limit Confirmation Dialog -->
    <UiConfirmDialog
      :show="showResetRateLimitDialog"
      :title="t('keys.resetRateLimitTitle')"
      :message="t('keys.resetRateLimitConfirmMessage', { name: selectedKey?.name })"
      :confirm-text="t('keys.reset')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="resetRateLimitPending"
      @confirm="resetRateLimitUsage"
      @cancel="showResetRateLimitDialog = false"
    />

    <!-- Use Key Modal -->
    <UseKeyModal
      :show="showUseKeyModal"
      :api-key="selectedKey?.key || ''"
      :base-url="publicSettings?.api_base_url || ''"
      :platform="selectedKey?.group?.platform || null"
      :allow-messages-dispatch="selectedKey?.group?.allow_messages_dispatch || false"
      @close="closeUseKeyModal"
    />

    <UiDialog
      :show="showCcsClientSelect"
      :title="t('keys.ccsClientSelect.title')"
      width="narrow"
      @close="closeCcsClientSelect"
    >
      <div class="ccs-client-picker">
        <p>
          {{ t('keys.ccsClientSelect.description') }}
        </p>
        <div class="ccs-client-picker__options">
          <button type="button" class="ccs-client-picker__option" @click="handleCcsClientSelect('claude')">
            <Icon name="terminal" size="lg" />
            <strong>{{ t('keys.ccsClientSelect.claudeCode') }}</strong>
            <span>{{ t('keys.ccsClientSelect.claudeCodeDesc') }}</span>
          </button>
          <button type="button" class="ccs-client-picker__option" @click="handleCcsClientSelect('gemini')">
            <Icon name="sparkles" size="lg" />
            <strong>{{ t('keys.ccsClientSelect.geminiCli') }}</strong>
            <span>{{ t('keys.ccsClientSelect.geminiCliDesc') }}</span>
          </button>
        </div>
      </div>
      <template #footer>
        <UiButton density="compact" @click="closeCcsClientSelect">
          {{ t('common.cancel') }}
        </UiButton>
      </template>
    </UiDialog>

  </AppLayout>
</template>

<script setup lang="ts">
	import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
	import { useI18n } from 'vue-i18n'
	import { useRoute, useRouter } from 'vue-router'
	import { useAppStore } from '@/stores/app'
	import { useClipboard } from '@/composables/useClipboard'
import { getPersistedPageSize, setPersistedPageSize } from '@/composables/usePersistedPageSize'
import {
  getConfiguredTablePageSizeOptions,
  normalizeTablePageSize,
} from '@/utils/tablePreferences'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
import { keysAPI, authAPI, usageAPI, userGroupsAPI } from '@/api'
import AppLayout from '@/components/layout/AppLayout.vue'
	import {
		  AppPage,
		  AppPageHeader,
		  UiAlert,
		  UiBadge,
		  UiButton,
		  UiColumnPicker,
		  UiConfirmDialog,
		  UiDataTable,
		  UiDialog,
		  UiEmptyState,
		  UiErrorState,
		  UiIconButton,
		  UiPagination,
		  UiPopover,
		  UiProgressBar,
		  UiSearchInput,
		  UiSegmentedControl,
		  UiSelect,
		  UiServerTableWorkspace,
		  UiStatusBadge,
		  UiSwitch,
		  UiTextArea,
		  UiTextField,
		} from '@/components/ui'
	import Icon from '@/components/icons/Icon.vue'
	import UseKeyModal from '@/components/keys/UseKeyModal.vue'
	import EndpointPopover from '@/components/keys/EndpointPopover.vue'
	import GroupBadge from '@/components/common/GroupBadge.vue'
	import GroupOptionItem from '@/components/common/GroupOptionItem.vue'
	import type { ApiKey, Group, PublicSettings, GroupPlatform, UpdateApiKeyRequest } from '@/types'
import type { Column } from '@/components/ui'
import type { BatchApiKeyUsageStats } from '@/api/usage'
import { formatDateTime } from '@/utils/format'
import { maskApiKey } from '@/utils/maskApiKey'
import {
  buildCcSwitchImportDeeplink,
  type CcSwitchClientType
} from '@/utils/ccswitchImport'

// Helper to format date for datetime-local input
const formatDateTimeLocal = (isoDate: string): string => {
  const date = new Date(isoDate)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface GroupOption {
  value: number
  label: string
  description: string | null
  rate: number
  userRate: number | null
  peakRateEnabled: boolean
  peakStart: string
  peakEnd: string
  peakRateMultiplier: number
  platform: GroupPlatform
}

const appStore = useAppStore()
const { copyToClipboard: clipboardCopy } = useClipboard()

const allColumns = computed<Column[]>(() => [
  { key: 'name', label: t('common.name'), sortable: true },
  { key: 'id', label: t('keys.id'), sortable: true },
  { key: 'key', label: t('keys.apiKey'), sortable: false },
  { key: 'group', label: t('keys.group'), sortable: false },
  { key: 'current_concurrency', label: t('keys.currentConcurrency'), sortable: true },
  { key: 'usage', label: t('keys.usage'), sortable: false },
  { key: 'rate_limit', label: t('keys.rateLimitColumn'), sortable: false },
  { key: 'expires_at', label: t('keys.expiresAt'), sortable: true },
  { key: 'status', label: t('common.status'), sortable: true },
  { key: 'last_used_at', label: t('keys.lastUsedAt'), sortable: true },
  { key: 'last_used_ip', label: t('keys.lastUsedIP'), sortable: false },
  { key: 'created_at', label: t('keys.created'), sortable: true },
  { key: 'actions', label: t('common.actions'), sortable: false }
])

const ALWAYS_VISIBLE_COLUMNS = new Set(['name', 'actions'])
const DEFAULT_HIDDEN_COLUMNS = ['id', 'rate_limit', 'last_used_at', 'last_used_ip']
const HIDDEN_COLUMNS_KEY = 'api-key-hidden-columns'
const COLUMN_SETTINGS_VERSION_KEY = 'api-key-column-settings-version'
const COLUMN_SETTINGS_VERSION = 3
const VERSION_NEW_HIDDEN_COLUMNS: Record<number, string[]> = {
  2: ['last_used_ip'],
  3: ['id']
}

const toggleableColumns = computed(() =>
  allColumns.value.filter((col) => !ALWAYS_VISIBLE_COLUMNS.has(col.key))
)

const hiddenColumns = reactive<Set<string>>(new Set())

const saveColumnsToStorage = () => {
  try {
    localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...hiddenColumns]))
    localStorage.setItem(COLUMN_SETTINGS_VERSION_KEY, String(COLUMN_SETTINGS_VERSION))
  } catch (error) {
    console.error('Failed to save API key table columns:', error)
  }
}

const loadSavedColumns = () => {
  hiddenColumns.clear()
  try {
    const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as string[]
      const validColumnKeys = new Set(allColumns.value.map((col) => col.key))
      parsed
        .filter((key) =>
          typeof key === 'string' &&
          validColumnKeys.has(key) &&
          !ALWAYS_VISIBLE_COLUMNS.has(key)
        )
        .forEach((key) => hiddenColumns.add(key))
      const storedVersion = Number(localStorage.getItem(COLUMN_SETTINGS_VERSION_KEY) ?? '1')
      if (storedVersion < COLUMN_SETTINGS_VERSION) {
        for (let v = storedVersion + 1; v <= COLUMN_SETTINGS_VERSION; v++) {
          for (const key of VERSION_NEW_HIDDEN_COLUMNS[v] ?? []) {
            if (validColumnKeys.has(key) && !ALWAYS_VISIBLE_COLUMNS.has(key)) {
              hiddenColumns.add(key)
            }
          }
        }
        saveColumnsToStorage()
      } else {
        localStorage.setItem(COLUMN_SETTINGS_VERSION_KEY, String(COLUMN_SETTINGS_VERSION))
      }
    } else {
      DEFAULT_HIDDEN_COLUMNS.forEach((key) => hiddenColumns.add(key))
      localStorage.setItem(COLUMN_SETTINGS_VERSION_KEY, String(COLUMN_SETTINGS_VERSION))
    }
  } catch (error) {
    console.error('Failed to load API key table columns:', error)
    DEFAULT_HIDDEN_COLUMNS.forEach((key) => hiddenColumns.add(key))
  }
}

const visibleColumnKeys = computed(() =>
  allColumns.value
    .filter((column) => ALWAYS_VISIBLE_COLUMNS.has(column.key) || !hiddenColumns.has(column.key))
    .map((column) => column.key)
)

const columnPickerColumns = computed(() =>
  allColumns.value.map((column) => ({
    key: column.key,
    label: column.label,
    required: ALWAYS_VISIBLE_COLUMNS.has(column.key),
  }))
)

const updateVisibleColumns = (keys: string[]) => {
  const visibleKeys = new Set(keys)
  for (const column of toggleableColumns.value) {
    if (visibleKeys.has(column.key)) {
      hiddenColumns.delete(column.key)
    } else {
      hiddenColumns.add(column.key)
    }
  }
  saveColumnsToStorage()
}

const columns = computed<Column[]>(() =>
  allColumns.value.filter((col) => ALWAYS_VISIBLE_COLUMNS.has(col.key) || !hiddenColumns.has(col.key))
)

const apiKeys = ref<ApiKey[]>([])
const groups = ref<Group[]>([])
const loading = ref(false)
const loadError = ref(false)
const submitting = ref(false)
const now = ref(new Date())
let resetTimer: ReturnType<typeof setInterval> | null = null
let ccsImportTimer: ReturnType<typeof setTimeout> | null = null
let ccsImportSeq = 0
const usageStats = ref<Record<string, BatchApiKeyUsageStats>>({})
const userGroupRates = ref<Record<number, number>>({})

const pagination = ref({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
  pages: 0
})
const paginationPageSizeOptions = computed(() => Array.from(new Set([
  ...getConfiguredTablePageSizeOptions(),
  normalizeTablePageSize(pagination.value.page_size),
])).sort((a, b) => a - b))
const sortState = ref({
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc'
})

// Filter state
const filterSearch = ref('')
const filterStatus = ref('')
const filterGroupId = ref<string | number>('')

const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteDialog = ref(false)
const showResetQuotaDialog = ref(false)
const showResetRateLimitDialog = ref(false)
const showUseKeyModal = ref(false)
const showCcsClientSelect = ref(false)
const pendingCcsRow = ref<ApiKey | null>(null)
const selectedKey = ref<ApiKey | null>(null)
const deletingKeyId = ref<number | null>(null)
const resetQuotaPending = ref(false)
const resetRateLimitPending = ref(false)
const statusChangePendingKeys = ref(new Set<number>())
const groupChangePendingKeys = ref(new Set<number>())
let keyMutationSeq = 0
const subscriptionIntentGroup = ref<Group | null>(null)
const subscriptionCreateGroup = ref<Group | null>(null)
const pendingSubscriptionBindingKey = ref<ApiKey | null>(null)
const bindingSubscriptionKey = ref(false)
const copiedKeyId = ref<number | null>(null)
const publicSettings = ref<PublicSettings | null>(null)
let abortController: AbortController | null = null

const isSubscriptionBindMode = computed(() => subscriptionIntentGroup.value !== null)

const subscriptionBindingConfirmMessage = computed(() => {
  const key = pendingSubscriptionBindingKey.value
  const targetGroup = subscriptionIntentGroup.value
  if (!key || !targetGroup) return ''

  return t('keys.subscriptionIntent.confirmMessage', {
    key: key.name,
    current: key.group?.name || t('keys.noGroup'),
    target: targetGroup.name,
  })
})

const createEmptyFormData = () => ({
  name: '',
  group_id: null as number | null,
  status: 'active' as 'active' | 'inactive',
  use_custom_key: false,
  custom_key: '',
  enable_ip_restriction: false,
  ip_whitelist: '',
  ip_blacklist: '',
  // Quota settings (empty = unlimited)
  enable_quota: false,
  quota: null as number | null,
  // Rate limit settings
  enable_rate_limit: false,
  rate_limit_5h: null as number | null,
  rate_limit_1d: null as number | null,
  rate_limit_7d: null as number | null,
  enable_expiration: false,
  expiration_preset: '30' as '7' | '30' | '90' | 'custom',
  expiration_date: ''
})

const formData = ref(createEmptyFormData())

type OptionalNumberField = 'quota' | 'rate_limit_5h' | 'rate_limit_1d' | 'rate_limit_7d'
type RateLimitField = Exclude<OptionalNumberField, 'quota'>

const setOptionalNumberField = (field: OptionalNumberField, value: string) => {
  const normalized = value.trim()
  if (!normalized) {
    formData.value[field] = null
    return
  }
  const parsed = Number(normalized)
  formData.value[field] = Number.isFinite(parsed) ? parsed : null
}

const rateLimitFields = computed<Array<{
  key: RateLimitField
  label: string
  value: number | null
  used: number
  limit: number
}>>(() => [
  {
    key: 'rate_limit_5h',
    label: t('keys.rateLimit5h'),
    value: formData.value.rate_limit_5h,
    used: selectedKey.value?.usage_5h ?? 0,
    limit: selectedKey.value?.rate_limit_5h ?? 0,
  },
  {
    key: 'rate_limit_1d',
    label: t('keys.rateLimit1d'),
    value: formData.value.rate_limit_1d,
    used: selectedKey.value?.usage_1d ?? 0,
    limit: selectedKey.value?.rate_limit_1d ?? 0,
  },
  {
    key: 'rate_limit_7d',
    label: t('keys.rateLimit7d'),
    value: formData.value.rate_limit_7d,
    used: selectedKey.value?.usage_7d ?? 0,
    limit: selectedKey.value?.rate_limit_7d ?? 0,
  },
])

const expirationPresetOptions = computed(() => [
  ...['7', '30', '90'].map((days) => ({
    value: days,
    label: showEditModal.value
      ? t('keys.extendDays', { days })
      : t('keys.expiresInDays', { days }),
  })),
  { value: 'custom', label: t('keys.customDate') },
])

const handleExpirationPresetChange = (value: string | number) => {
  if (value === 'custom') {
    formData.value.expiration_preset = 'custom'
    return
  }
  setExpirationDays(Number(value))
}

const usagePercent = (used: number | null | undefined, limit: number | null | undefined) => {
  if (!limit || limit <= 0) return 0
  return Math.min(((used ?? 0) / limit) * 100, 100)
}

const usageTone = (
  used: number | null | undefined,
  limit: number | null | undefined
): 'neutral' | 'warning' | 'danger' => {
  const percent = usagePercent(used, limit)
  if (percent >= 100) return 'danger'
  if (percent >= 80) return 'warning'
  return 'neutral'
}

const hasConfiguredRateLimit = (key: ApiKey) =>
  key.rate_limit_5h > 0 || key.rate_limit_1d > 0 || key.rate_limit_7d > 0

// 自定义Key验证
const customKeyError = computed(() => {
  if (!formData.value.use_custom_key || !formData.value.custom_key) {
    return ''
  }
  const key = formData.value.custom_key
  if (key.length < 16) {
    return t('keys.customKeyTooShort')
  }
  // 检查字符：只允许字母、数字、下划线、连字符
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return t('keys.customKeyInvalidChars')
  }
  return ''
})

const statusOptions = computed(() => [
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') }
])

const shouldSubmitEditStatus = (key: ApiKey, status: 'active' | 'inactive') => {
  if (key.status === 'quota_exhausted' || key.status === 'expired') {
    return status === 'active'
  }
  return true
}

// Filter dropdown options
const groupFilterOptions = computed(() => [
  { value: '', label: t('keys.allGroups') },
  { value: 0, label: t('keys.noGroup') },
  ...groups.value.map((g) => ({ value: g.id, label: g.name }))
])

const statusFilterOptions = computed(() => [
  { value: '', label: t('keys.allStatus') },
  { value: 'active', label: t('keys.status.active') },
  { value: 'inactive', label: t('keys.status.inactive') },
  { value: 'quota_exhausted', label: t('keys.status.quota_exhausted') },
  { value: 'expired', label: t('keys.status.expired') }
])

const onFilterChange = () => {
  pagination.value.page = 1
  loadApiKeys()
}

const onGroupFilterChange = (value: string | number | boolean | null) => {
  filterGroupId.value = value as string | number
  onFilterChange()
}

const onStatusFilterChange = (value: string | number | boolean | null) => {
  filterStatus.value = value as string
  onFilterChange()
}

// Convert groups to Select options format with rate multiplier and subscription type
const groupOptions = computed(() =>
  groups.value.map((group) => ({
    value: group.id,
    label: group.name,
    description: group.description,
    rate: group.rate_multiplier,
    userRate: userGroupRates.value[group.id] ?? null,
    peakRateEnabled: group.peak_rate_enabled,
    peakStart: group.peak_start,
    peakEnd: group.peak_end,
    peakRateMultiplier: group.peak_rate_multiplier,
    platform: group.platform
  }))
)

// Group dropdown search
const groupSearchQuery = ref('')
const filteredGroupOptions = computed(() => {
  const query = groupSearchQuery.value.trim().toLowerCase()
  if (!query) return groupOptions.value
  return groupOptions.value.filter((opt) => {
    return opt.label.toLowerCase().includes(query) ||
      (opt.description && opt.description.toLowerCase().includes(query))
  })
})

const copyToClipboard = async (text: string, keyId: number) => {
  const success = await clipboardCopy(text, t('keys.copied'))
  if (success) {
    copiedKeyId.value = keyId
    setTimeout(() => {
      copiedKeyId.value = null
    }, 800)
  }
}

const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const { name, code } = error as { name?: string; code?: string }
  return name === 'AbortError' || code === 'ERR_CANCELED'
}

const loadApiKeys = async () => {
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  const { signal } = controller
  loading.value = true
  loadError.value = false
  try {
    // Build filters
    const filters: {
      search?: string
      status?: string
      group_id?: number | string
      sort_by?: string
      sort_order?: 'asc' | 'desc'
    } = {}
    if (filterSearch.value) filters.search = filterSearch.value
    if (filterStatus.value) filters.status = filterStatus.value
    if (filterGroupId.value !== '') filters.group_id = filterGroupId.value
    filters.sort_by = sortState.value.sort_by
    filters.sort_order = sortState.value.sort_order

    const response = await keysAPI.list(pagination.value.page, pagination.value.page_size, filters, {
      signal
    })
    if (signal.aborted) return
    apiKeys.value = response.items
    loadError.value = false
    pagination.value.total = response.total
    pagination.value.pages = response.pages

    // Load usage stats for all API keys in the list
    if (response.items.length > 0) {
      const keyIds = response.items.map((k) => k.id)
      try {
        const usageResponse = await usageAPI.getDashboardApiKeysUsage(keyIds, { signal })
        if (signal.aborted) return
        usageStats.value = usageResponse.stats
      } catch (e) {
        if (!isAbortError(e)) {
          console.error('Failed to load usage stats:', e)
        }
      }
    }
  } catch (error) {
    if (isAbortError(error)) {
      return
    }
    loadError.value = true
    appStore.showError(t('keys.failedToLoad'))
  } finally {
    if (abortController === controller) {
      loading.value = false
    }
  }
}

const loadGroups = async (): Promise<boolean> => {
  try {
    groups.value = await userGroupsAPI.getAvailable()
    return true
  } catch (error) {
    console.error('Failed to load groups:', error)
    return false
  }
}

const loadUserGroupRates = async () => {
  try {
    userGroupRates.value = await userGroupsAPI.getUserGroupRates()
  } catch (error) {
    console.error('Failed to load user group rates:', error)
  }
}

const loadPublicSettings = async () => {
  try {
    publicSettings.value = await authAPI.getPublicSettings()
  } catch (error) {
    console.error('Failed to load public settings:', error)
  }
}

const openCreateModal = (group: Group | null = null) => {
  showEditModal.value = false
  selectedKey.value = null
  formData.value = createEmptyFormData()
  subscriptionCreateGroup.value = group
  formData.value.group_id = group?.id ?? null
  showCreateModal.value = true
}

const clearSubscriptionBindingMode = () => {
  if (bindingSubscriptionKey.value) return
  pendingSubscriptionBindingKey.value = null
  subscriptionIntentGroup.value = null
}

const requestSubscriptionBinding = (key: ApiKey) => {
  const targetGroup = subscriptionIntentGroup.value
  if (!targetGroup || key.group_id === targetGroup.id) return
  pendingSubscriptionBindingKey.value = key
}

const cancelSubscriptionBinding = () => {
  if (bindingSubscriptionKey.value) return
  pendingSubscriptionBindingKey.value = null
}

const confirmSubscriptionBinding = async () => {
  const key = pendingSubscriptionBindingKey.value
  const targetGroup = subscriptionIntentGroup.value
  if (!key || !targetGroup || bindingSubscriptionKey.value) return

  bindingSubscriptionKey.value = true
  try {
    await keysAPI.update(key.id, { group_id: targetGroup.id })
    appStore.showSuccess(t('keys.subscriptionIntent.bindSuccess', { key: key.name, group: targetGroup.name }))
    pendingSubscriptionBindingKey.value = null
    subscriptionIntentGroup.value = null
    await loadApiKeys()
  } catch (error) {
    appStore.showError(t('keys.subscriptionIntent.bindFailed'))
  } finally {
    bindingSubscriptionKey.value = false
  }
}

const queryScalar = (value: unknown): string | null => typeof value === 'string' ? value : null

const clearSubscriptionIntentQuery = async () => {
  const query = { ...route.query }
  delete query.action
  delete query.group_id
  delete query.source

  try {
    await router.replace({ query })
  } catch (error) {
    console.error('Failed to clear subscription key intent:', error)
  }
}

const consumeSubscriptionKeyIntent = async (groupsLoaded: boolean) => {
  const source = queryScalar(route.query.source)
  if (source !== 'subscription') return

  const action = queryScalar(route.query.action)
  const rawGroupId = queryScalar(route.query.group_id)
  await clearSubscriptionIntentQuery()

  const groupId = rawGroupId === null ? Number.NaN : Number(rawGroupId)
  if ((action !== 'create' && action !== 'bind') || !Number.isSafeInteger(groupId) || groupId <= 0) {
    appStore.showError(t('keys.subscriptionIntent.invalid'))
    return
  }

  if (!groupsLoaded) {
    appStore.showError(t('keys.subscriptionIntent.groupsLoadFailed'))
    return
  }

  const targetGroup = groups.value.find((group) =>
    group.id === groupId &&
    group.status === 'active'
  )

  if (!targetGroup) {
    appStore.showError(t('keys.subscriptionIntent.unavailable'))
    return
  }

  if (action === 'create') {
    openCreateModal(targetGroup)
    return
  }

  subscriptionIntentGroup.value = targetGroup
}

const openUseKeyModal = (key: ApiKey) => {
  selectedKey.value = key
  showUseKeyModal.value = true
}

const closeUseKeyModal = () => {
  showUseKeyModal.value = false
  selectedKey.value = null
}

const handlePageChange = (page: number) => {
  pagination.value.page = page
  loadApiKeys()
}

const handlePageSizeChange = (pageSize: number) => {
  const normalized = normalizeTablePageSize(pageSize)
  setPersistedPageSize(normalized)
  pagination.value.page_size = normalized
  pagination.value.page = 1
  loadApiKeys()
}

const handleSort = (key: string, order: 'asc' | 'desc') => {
  sortState.value.sort_by = key
  sortState.value.sort_order = order
  pagination.value.page = 1
  loadApiKeys()
}

const editKey = (key: ApiKey) => {
  subscriptionCreateGroup.value = null
  selectedKey.value = key
  const hasIPRestriction = (key.ip_whitelist?.length > 0) || (key.ip_blacklist?.length > 0)
  const hasExpiration = !!key.expires_at
  formData.value = {
    name: key.name,
    group_id: key.group_id,
    status: key.status === 'quota_exhausted' || key.status === 'expired' ? 'inactive' : key.status,
    use_custom_key: false,
    custom_key: '',
    enable_ip_restriction: hasIPRestriction,
    ip_whitelist: (key.ip_whitelist || []).join('\n'),
    ip_blacklist: (key.ip_blacklist || []).join('\n'),
    enable_quota: key.quota > 0,
    quota: key.quota > 0 ? key.quota : null,
    enable_rate_limit: (key.rate_limit_5h > 0) || (key.rate_limit_1d > 0) || (key.rate_limit_7d > 0),
    rate_limit_5h: key.rate_limit_5h || null,
    rate_limit_1d: key.rate_limit_1d || null,
    rate_limit_7d: key.rate_limit_7d || null,
    enable_expiration: hasExpiration,
    expiration_preset: 'custom',
    expiration_date: key.expires_at ? formatDateTimeLocal(key.expires_at) : ''
  }
  showEditModal.value = true
}

const toggleKeyStatus = async (key: ApiKey) => {
  if (statusChangePendingKeys.value.has(key.id)) return
  const newStatus = key.status === 'active' ? 'inactive' : 'active'
  statusChangePendingKeys.value = new Set(statusChangePendingKeys.value).add(key.id)
  try {
    await keysAPI.toggleStatus(key.id, newStatus)
    appStore.showSuccess(
      newStatus === 'active' ? t('keys.keyEnabledSuccess') : t('keys.keyDisabledSuccess')
    )
    loadApiKeys()
  } catch (error) {
    appStore.showError(t('keys.failedToUpdateStatus'))
  } finally {
    const pending = new Set(statusChangePendingKeys.value)
    pending.delete(key.id)
    statusChangePendingKeys.value = pending
  }
}

const prepareGroupSelector = (_key: ApiKey, open: boolean) => {
  if (open) groupSearchQuery.value = ''
}

const changeGroup = async (key: ApiKey, newGroupId: number | null) => {
  if (key.group_id === newGroupId || groupChangePendingKeys.value.has(key.id)) return

  groupChangePendingKeys.value = new Set(groupChangePendingKeys.value).add(key.id)
  try {
    await keysAPI.update(key.id, { group_id: newGroupId })
    appStore.showSuccess(t('keys.groupChangedSuccess'))
    loadApiKeys()
  } catch (error) {
    appStore.showError(t('keys.failedToChangeGroup'))
  } finally {
    const pending = new Set(groupChangePendingKeys.value)
    pending.delete(key.id)
    groupChangePendingKeys.value = pending
  }
}

const confirmDelete = (key: ApiKey) => {
  selectedKey.value = key
  showDeleteDialog.value = true
}

const handleSubmit = async () => {
  if (submitting.value) return
  // Validate group_id is required
  if (formData.value.group_id === null) {
    appStore.showError(t('keys.groupRequired'))
    return
  }

  // Validate custom key if enabled
  if (!showEditModal.value && formData.value.use_custom_key) {
    if (!formData.value.custom_key) {
      appStore.showError(t('keys.customKeyRequired'))
      return
    }
    if (customKeyError.value) {
      appStore.showError(customKeyError.value)
      return
    }
  }

  // Parse IP lists only if IP restriction is enabled
  const parseIPList = (text: string): string[] =>
    text.split('\n').map(ip => ip.trim()).filter(ip => ip.length > 0)
  const ipWhitelist = formData.value.enable_ip_restriction ? parseIPList(formData.value.ip_whitelist) : []
  const ipBlacklist = formData.value.enable_ip_restriction ? parseIPList(formData.value.ip_blacklist) : []

  // Calculate quota value (null/empty/0 = unlimited, stored as 0)
  const quota = formData.value.quota && formData.value.quota > 0 ? formData.value.quota : 0

  // Calculate expiration
  let expiresInDays: number | undefined
  let expiresAt: string | null | undefined
  if (formData.value.enable_expiration && formData.value.expiration_date) {
    if (!showEditModal.value) {
      // Create mode: calculate days from date
      const expDate = new Date(formData.value.expiration_date)
      const now = new Date()
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expiresInDays = diffDays > 0 ? diffDays : 1
    } else {
      // Edit mode: use custom date directly
      expiresAt = new Date(formData.value.expiration_date).toISOString()
    }
  } else if (showEditModal.value) {
    // Edit mode: if expiration disabled or date cleared, send empty string to clear
    expiresAt = ''
  }

  // Calculate rate limit values (send 0 when toggle is off)
  const rateLimitData = formData.value.enable_rate_limit ? {
    rate_limit_5h: formData.value.rate_limit_5h && formData.value.rate_limit_5h > 0 ? formData.value.rate_limit_5h : 0,
    rate_limit_1d: formData.value.rate_limit_1d && formData.value.rate_limit_1d > 0 ? formData.value.rate_limit_1d : 0,
    rate_limit_7d: formData.value.rate_limit_7d && formData.value.rate_limit_7d > 0 ? formData.value.rate_limit_7d : 0,
  } : { rate_limit_5h: 0, rate_limit_1d: 0, rate_limit_7d: 0 }

  const operationId = ++keyMutationSeq
  const editingKeyId = showEditModal.value ? selectedKey.value?.id ?? null : null
  const wasEditing = editingKeyId !== null
  submitting.value = true
  try {
    const createdForSubscription = !showEditModal.value &&
      subscriptionCreateGroup.value !== null &&
      formData.value.group_id === subscriptionCreateGroup.value.id
    if (showEditModal.value && selectedKey.value && editingKeyId !== null) {
      const updates: UpdateApiKeyRequest = {
        name: formData.value.name,
        group_id: formData.value.group_id,
        ip_whitelist: ipWhitelist,
        ip_blacklist: ipBlacklist,
        quota: quota,
        expires_at: expiresAt,
        rate_limit_5h: rateLimitData.rate_limit_5h,
        rate_limit_1d: rateLimitData.rate_limit_1d,
        rate_limit_7d: rateLimitData.rate_limit_7d,
      }
      if (shouldSubmitEditStatus(selectedKey.value, formData.value.status)) {
        updates.status = formData.value.status
      }
      await keysAPI.update(editingKeyId, updates)
    } else {
      const customKey = formData.value.use_custom_key ? formData.value.custom_key : undefined
      await keysAPI.create(
        formData.value.name,
        formData.value.group_id,
        customKey,
        ipWhitelist,
        ipBlacklist,
        quota,
        expiresInDays,
        rateLimitData
      )
    }
    if (operationId !== keyMutationSeq) return
    if (wasEditing) {
      appStore.showSuccess(t('keys.keyUpdatedSuccess'))
    } else {
      appStore.showSuccess(t('keys.keyCreatedSuccess'))
    }
    if (createdForSubscription) {
      clearSubscriptionBindingMode()
    }
    closeModals()
    loadApiKeys()
  } catch (error: any) {
    if (operationId !== keyMutationSeq) return
    const errorMsg = error.response?.data?.detail || t('keys.failedToSave')
    appStore.showError(errorMsg)
    // Don't advance tour on error
  } finally {
    if (operationId === keyMutationSeq) submitting.value = false
  }
}

/**
 * 处理删除 API Key 的操作
 * 优化：错误处理改进，优先显示后端返回的具体错误消息（如权限不足等），
 * 若后端未返回消息则显示默认的国际化文本
 */
const handleDelete = async () => {
  if (!selectedKey.value) return
  if (deletingKeyId.value !== null) return

  const keyId = selectedKey.value.id
  const operationId = ++keyMutationSeq
  deletingKeyId.value = keyId

  try {
    await keysAPI.delete(keyId)
    if (operationId !== keyMutationSeq) return
    appStore.showSuccess(t('keys.keyDeletedSuccess'))
    if (showDeleteDialog.value && selectedKey.value?.id === keyId) {
      showDeleteDialog.value = false
    }
    loadApiKeys()
  } catch (error: any) {
    if (operationId !== keyMutationSeq) return
    // 优先使用后端返回的错误消息，提供更具体的错误信息给用户
    const errorMsg = error?.message || t('keys.failedToDelete')
    appStore.showError(errorMsg)
  } finally {
    if (operationId === keyMutationSeq) deletingKeyId.value = null
  }
}

const closeModals = () => {
  keyMutationSeq += 1
  submitting.value = false
  showCreateModal.value = false
  showEditModal.value = false
  selectedKey.value = null
  subscriptionCreateGroup.value = null
  formData.value = createEmptyFormData()
}

// Show reset quota confirmation dialog
const confirmResetQuota = () => {
  if (resetQuotaPending.value) return
  showResetQuotaDialog.value = true
}

// Set expiration date based on quick select days
const setExpirationDays = (days: number) => {
  formData.value.expiration_preset = days.toString() as '7' | '30' | '90'
  const expDate = new Date()
  expDate.setDate(expDate.getDate() + days)
  formData.value.expiration_date = formatDateTimeLocal(expDate.toISOString())
}

// Reset quota used for an API key
const resetQuotaUsed = async () => {
  if (!selectedKey.value || resetQuotaPending.value) return
  const keyId = selectedKey.value.id
  let succeeded = false
  resetQuotaPending.value = true
  try {
    await keysAPI.update(keyId, { reset_quota: true })
    appStore.showSuccess(t('keys.quotaResetSuccess'))
    const refreshedIndex = apiKeys.value.findIndex(key => key.id === keyId)
    if (refreshedIndex >= 0) {
      apiKeys.value[refreshedIndex] = { ...apiKeys.value[refreshedIndex], quota_used: 0 }
    }
    if (selectedKey.value?.id === keyId) {
      selectedKey.value = { ...selectedKey.value, quota_used: 0 }
    }
    succeeded = true
  } catch (error: any) {
    const errorMsg = error.response?.data?.detail || t('keys.failedToResetQuota')
    appStore.showError(errorMsg)
  } finally {
    resetQuotaPending.value = false
    if (succeeded && selectedKey.value?.id === keyId) {
      showResetQuotaDialog.value = false
    }
  }
}

// Show reset rate limit confirmation dialog (from edit modal)
const confirmResetRateLimit = () => {
  if (resetRateLimitPending.value) return
  showResetRateLimitDialog.value = true
}

// Show reset rate limit confirmation dialog (from table row)
const confirmResetRateLimitFromTable = (row: ApiKey) => {
  if (resetRateLimitPending.value) return
  selectedKey.value = row
  showResetRateLimitDialog.value = true
}

// Reset rate limit usage for an API key
const resetRateLimitUsage = async () => {
  if (!selectedKey.value || resetRateLimitPending.value) return
  const keyId = selectedKey.value.id
  let succeeded = false
  resetRateLimitPending.value = true
  try {
    await keysAPI.update(keyId, { reset_rate_limit_usage: true })
    appStore.showSuccess(t('keys.rateLimitResetSuccess'))
    // Refresh key data
    await loadApiKeys()
    // Keep the refreshed target tied to the key that initiated the request.
    const refreshedKey = apiKeys.value.find(key => key.id === keyId)
    if (refreshedKey && selectedKey.value?.id === keyId) {
      selectedKey.value = refreshedKey
    }
    succeeded = true
  } catch (error: any) {
    const errorMsg = error.response?.data?.detail || t('keys.failedToResetRateLimit')
    appStore.showError(errorMsg)
  } finally {
    resetRateLimitPending.value = false
    if (succeeded && selectedKey.value?.id === keyId) showResetRateLimitDialog.value = false
  }
}

const importToCcswitch = (row: ApiKey) => {
  const platform = row.group?.platform || 'anthropic'

  // For antigravity platform, show client selection dialog
  if (platform === 'antigravity') {
    pendingCcsRow.value = row
    showCcsClientSelect.value = true
    return
  }

  // For other platforms, execute directly
  executeCcsImport(row, platform === 'gemini' ? 'gemini' : 'claude')
}

const executeCcsImport = (row: ApiKey, clientType: CcSwitchClientType) => {
  if (ccsImportTimer) {
    clearTimeout(ccsImportTimer)
    ccsImportTimer = null
  }
  const importSeq = ++ccsImportSeq
  const baseUrl = publicSettings.value?.api_base_url || window.location.origin
  const platform = row.group?.platform || 'anthropic'

  const usageScript = `({
    request: {
      url: "{{baseUrl}}/v1/usage",
      method: "GET",
      headers: { "Authorization": "Bearer {{apiKey}}" }
    },
    extractor: function(response) {
      const remaining = response?.remaining ?? response?.quota?.remaining ?? response?.balance;
      const unit = response?.unit ?? response?.quota?.unit ?? "USD";
      return {
        isValid: response?.is_active ?? response?.isValid ?? true,
        remaining,
        unit
      };
    }
  })`
  const providerName = (publicSettings.value?.site_name || 'sub2api').trim() || 'sub2api'
  const deeplink = buildCcSwitchImportDeeplink({
    baseUrl,
    platform,
    clientType,
    providerName,
    apiKey: row.key,
    usageScript
  })

  try {
    window.open(deeplink, '_self')

    // Check if the protocol handler worked by detecting if we're still focused
    ccsImportTimer = setTimeout(() => {
      ccsImportTimer = null
      if (importSeq === ccsImportSeq && document.hasFocus()) {
        // Still focused means the protocol handler likely failed
        appStore.showError(t('keys.ccSwitchNotInstalled'))
      }
    }, 100)
  } catch (error) {
    appStore.showError(t('keys.ccSwitchNotInstalled'))
  }
}

const handleCcsClientSelect = (clientType: CcSwitchClientType) => {
  if (pendingCcsRow.value) {
    executeCcsImport(pendingCcsRow.value, clientType)
  }
  showCcsClientSelect.value = false
  pendingCcsRow.value = null
}

const closeCcsClientSelect = () => {
  showCcsClientSelect.value = false
  pendingCcsRow.value = null
}

function formatResetTime(resetAt: string | null): string {
  if (!resetAt) return ''
  const diff = new Date(resetAt).getTime() - now.value.getTime()
  if (diff <= 0) return t('keys.resetNow')
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

onMounted(() => {
  loadSavedColumns()
  loadApiKeys()
  const groupsLoaded = loadGroups()
  loadUserGroupRates()
  loadPublicSettings()
  void groupsLoaded.then(consumeSubscriptionKeyIntent)
  resetTimer = setInterval(() => { now.value = new Date() }, 60000)
})

onUnmounted(() => {
  ccsImportSeq += 1
  if (ccsImportTimer) clearTimeout(ccsImportTimer)
  ccsImportTimer = null
  abortController?.abort()
  abortController = null
  if (resetTimer) clearInterval(resetTimer)
})
</script>

<style scoped>
.keys-filter-layout,
.keys-filter-controls,
.keys-actions,
.keys-subscription-banner,
.keys-subscription-banner__content,
.keys-cell-key,
.keys-cell-name,
.keys-group-trigger,
.keys-row-actions,
.keys-metric-line,
.keys-rate-window__head,
.keys-rate-window__reset {
  display: flex;
  min-width: 0;
  align-items: center;
}

.keys-filter-layout {
  justify-content: space-between;
  gap: 12px;
}

.keys-filter-controls {
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 8px;
}

.keys-filter-controls > :first-child {
  width: min(100%, 280px);
}

.keys-filter-controls > :not(:first-child) {
  width: min(100%, 180px);
}

.keys-actions,
.keys-row-actions {
  justify-content: flex-end;
  gap: 4px;
}

.keys-subscription-banner {
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.keys-subscription-banner__content {
  gap: 10px;
}

.keys-subscription-banner__icon {
  flex: 0 0 auto;
  color: var(--ui-info);
}

.keys-subscription-banner__title,
.keys-subscription-banner__description {
  margin: 0;
}

.keys-subscription-banner__title {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.keys-subscription-banner__description {
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.keys-subscription-banner__cancel {
  flex: 0 0 auto;
}

.keys-cell-id,
.keys-cell-key code,
.keys-ip-value {
  font-family: var(--ui-font-mono);
  font-variant-numeric: tabular-nums;
}

.keys-cell-id,
.keys-date-value,
.keys-ip-value {
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.keys-cell-key,
.keys-cell-name {
  gap: 6px;
}

.keys-cell-key code {
  color: var(--ui-text);
  font-size: 12px;
}

.keys-cell-name {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 500;
}

.keys-cell-name__restricted {
  flex: 0 0 auto;
  color: var(--ui-warning);
}

.keys-cell-muted {
  color: var(--ui-text-soft);
  font-size: 12px;
}

.keys-group-value,
.keys-group-trigger {
  min-width: 0;
}

.keys-group-trigger {
  width: 100%;
  gap: 6px;
  padding: 2px 0;
  border: 0;
  color: var(--ui-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.keys-group-trigger:focus-visible,
.keys-group-picker__option:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--ui-focus) 22%, transparent);
  outline-offset: 2px;
}

.keys-group-trigger__hint {
  margin-left: auto;
  color: var(--ui-text-soft);
  font-size: 11px;
}

.keys-group-picker {
  display: grid;
  gap: 8px;
  padding: 8px;
}

.keys-group-picker__list {
  display: grid;
  max-height: min(320px, calc(100vh - 180px));
  overflow-y: auto;
}

.keys-group-picker__option {
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-bottom: 1px solid var(--ui-border-soft);
  color: var(--ui-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ui-motion-fast) var(--ui-ease-standard);
}

.keys-group-picker__option:last-child {
  border-bottom: 0;
}

.keys-group-picker__option:hover,
.keys-group-picker__option[aria-selected='true'] {
  background: var(--ui-surface-muted);
}

.keys-usage-cell,
.keys-rate-limits,
.keys-rate-window {
  display: grid;
  min-width: 0;
}

.keys-usage-cell {
  min-width: 148px;
  gap: 2px;
  font-size: 12px;
}

.keys-metric-line,
.keys-rate-window__head {
  justify-content: space-between;
  gap: 8px;
}

.keys-metric-line > span:first-child,
.keys-rate-window__head > span:first-child {
  color: var(--ui-text-muted);
}

.keys-metric-line strong,
.keys-cost-value {
  color: var(--ui-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.keys-cost-value--warning {
  color: var(--ui-warning);
}

.keys-cost-value--danger,
.keys-date-value--expired {
  color: var(--ui-danger);
}

.keys-usage-cell__quota {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}

.keys-rate-limits {
  min-width: 148px;
  gap: 8px;
}

.keys-rate-window {
  gap: 4px;
}

.keys-rate-window__head {
  color: var(--ui-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.keys-rate-window__reset {
  gap: 4px;
  color: var(--ui-text-soft);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.key-form {
  display: grid;
  gap: 20px;
}

.key-form__context {
  padding: 10px 12px;
  border: 1px solid var(--ui-info-border, var(--ui-border));
  border-radius: var(--ui-radius);
  color: var(--ui-text);
  background: var(--ui-surface-muted);
  font-size: 12px;
  line-height: 20px;
}

.key-form__grid,
.key-form__columns,
.key-form__subgrid,
.key-form__rate-grid {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.key-form__grid,
.key-form__subgrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.key-form__columns {
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr);
}

.key-form__columns > :last-child {
  grid-column: 1 / -1;
}

.key-form__rate-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.key-form__control-group,
.key-form__section,
.key-form__expiration,
.key-form__rate-field,
.key-form__usage {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.key-form__control-group {
  align-content: start;
}

.key-form__section {
  align-content: start;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border-soft);
}

.key-form__section-head,
.key-form__usage-head,
.key-form__current-value,
.key-form__actions {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.key-form__section-head h3,
.key-form__section-head p,
.key-form__current-value,
.ccs-client-picker p {
  margin: 0;
}

.key-form__section-head h3 {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0;
}

.key-form__section-head p,
.key-form__current-value span,
.ccs-client-picker p,
.ccs-client-picker__option span {
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.key-form__usage {
  padding: 10px 12px;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius);
  background: var(--ui-surface-muted);
}

.key-form__usage-head {
  color: var(--ui-text-muted);
  font-size: 11px;
}

.key-form__usage-head strong,
.key-form__current-value strong {
  color: var(--ui-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.key-form__actions {
  justify-content: flex-end;
}

.ccs-client-picker {
  display: grid;
  gap: 16px;
}

.ccs-client-picker__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ccs-client-picker__option {
  display: grid;
  min-height: 112px;
  place-items: center;
  align-content: center;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  color: var(--ui-text);
  background: var(--ui-surface);
  text-align: center;
  cursor: pointer;
  transition: background var(--ui-motion-fast), border-color var(--ui-motion-fast);
}

.ccs-client-picker__option:hover,
.ccs-client-picker__option:focus-visible {
  border-color: var(--ui-text-soft);
  background: var(--ui-surface-muted);
}

.ccs-client-picker__option:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--ui-focus) 18%, transparent);
  outline-offset: 2px;
}

.ccs-client-picker__option strong {
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 720px) {
  .keys-filter-layout,
  .keys-subscription-banner {
    align-items: stretch;
    flex-direction: column;
  }

  .keys-actions {
    flex-wrap: wrap;
  }

  .key-form__grid,
  .key-form__columns,
  .key-form__subgrid,
  .key-form__rate-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .key-form__columns > :last-child {
    grid-column: auto;
  }

  .key-form__section-head {
    align-items: flex-start;
  }
}

@media (max-width: 420px) {
  .ccs-client-picker__options {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .keys-group-picker__option,
  .ccs-client-picker__option {
    transition: none;
  }
}
</style>
