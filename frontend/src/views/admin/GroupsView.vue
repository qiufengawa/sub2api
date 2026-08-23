<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('admin.groups.title')" :description="t('admin.groups.description')">
        <template #actions>
          <UiButton
            type="button"
            variant="primary"
            density="compact"
            data-tour="groups-create-btn"
            @click="openCreateModal"
          >
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t("admin.groups.createGroup") }}
          </UiButton>
        </template>
      </AppPageHeader>
      <UiServerTableWorkspace :loading="loading" :loading-text="t('common.loading')">
        <template #toolbar>
          <UiTableToolbar>
            <div class="groups-filter-fields">
              <UiSearchInput
                v-model="searchQuery"
                density="compact"
                :placeholder="t('admin.groups.searchGroups')"
                @search="handleSearch"
              />
            <UiSelect
              v-model="filters.platform"
              density="compact"
              :options="platformFilterOptions"
              :placeholder="t('admin.groups.allPlatforms')"
              @change="loadGroups"
            />
            <UiSelect
              v-model="filters.status"
              density="compact"
              :options="statusOptions"
              :placeholder="t('admin.groups.allStatus')"
              @change="loadGroups"
            />
            <UiSelect
              v-model="filters.is_exclusive"
              density="compact"
              :options="exclusiveOptions"
                :placeholder="t('admin.groups.allGroups')"
                @change="loadGroups"
              />
            </div>
            <template #actions>
              <UiIconButton
                icon="refresh"
                density="compact"
                :disabled="loading"
                :label="t('common.refresh')"
                @click="loadGroups"
              />
              <UiColumnPicker
                :model-value="visibleColumnKeys"
                :columns="columnPickerOptions"
                :label="t('admin.groups.columnSettings')"
                @update:model-value="updateVisibleColumns"
              />
              <UiButton
                type="button"
                variant="secondary"
                density="compact"
                :title="t('admin.groups.sortOrder')"
                :aria-label="t('admin.groups.sortOrder')"
                @click="openSortModal"
              >
                <template #icon><Icon name="arrowsUpDown" size="sm" /></template>
                {{ t("admin.groups.sortOrder") }}
              </UiButton>
            </template>
          </UiTableToolbar>
        </template>

        <UiMobileTableScroller class="groups-table-scroller" :label="t('admin.groups.title')" min-width="1120px">
          <UiDataTable
          :columns="columns"
          :data="groups"
          :loading="false"
          mobile-table
          :server-side-sort="true"
          default-sort-key="sort_order"
          default-sort-order="asc"
          @sort="handleSort"
        >
          <template #cell-name="{ value }">
            <UiDataCell :value="String(value)" />
          </template>

          <template #cell-id="{ value }">
            <UiDataCell :value="`#${value}`" mono />
          </template>

          <template #cell-platform="{ value }">
            <UiBadge tone="info" :label="t('admin.groups.platforms.' + value, value)" />
          </template>

          <template #cell-rate_multiplier="{ value }">
            <UiDataCell :value="`${value}x`" mono />
          </template>

          <template #cell-is_exclusive="{ value }">
            <UiBadge :tone="value ? 'info' : 'neutral'" :label="value ? t('admin.groups.exclusive') : t('admin.groups.public')" />
          </template>

          <template #cell-account_count="{ row }">
            <GroupAccountSummary
              :active="row.active_account_count || 0"
              :rate-limited="row.rate_limited_account_count || 0"
              :total="row.account_count || 0"
            />
          </template>

          <template #cell-capacity="{ row }">
            <GroupCapacitySummary
              v-if="capacityMap.get(row.id)"
              :concurrency-used="capacityMap.get(row.id)!.concurrencyUsed"
              :concurrency-max="capacityMap.get(row.id)!.concurrencyMax"
              :sessions-used="capacityMap.get(row.id)!.sessionsUsed"
              :sessions-max="capacityMap.get(row.id)!.sessionsMax"
              :rpm-used="capacityMap.get(row.id)!.rpmUsed"
              :rpm-max="capacityMap.get(row.id)!.rpmMax"
            />
            <UiDataCell v-else value="-" />
          </template>

          <template #cell-usage="{ row }">
            <GroupUsageSummaryCell
              :loading="usageLoading"
              :today-cost="usageMap.get(row.id)?.today_cost ?? 0"
              :total-cost="usageMap.get(row.id)?.total_cost ?? 0"
            />
          </template>

          <template #cell-status="{ value }">
            <UiStatusBadge :status="value" :label="t('admin.accounts.status.' + value, value)" />
          </template>

          <template #cell-actions="{ row }">
            <UiButtonGroup>
              <UiIconButton icon="edit" density="compact" variant="ghost" :label="t('common.edit')" @click="handleEdit(row)" />
              <UiIconButton
                data-testid="group-duplicate"
                :title="
                  duplicatingGroupIds.has(row.id)
                    ? t('admin.groups.duplicating')
                    : t('admin.groups.duplicate')
                "
                :disabled="duplicatingGroupIds.has(row.id)"
                variant="ghost"
                density="compact"
                icon="copy"
                :label="duplicatingGroupIds.has(row.id) ? t('admin.groups.duplicating') : t('admin.groups.duplicate')"
                @click="handleDuplicate(row)"
                :aria-label="duplicatingGroupIds.has(row.id) ? t('admin.groups.duplicating') : t('admin.groups.duplicate')"
              />
              <UiIconButton
                v-if="row.platform === 'composite'"
                icon="swap" variant="ghost" density="compact" :label="t('admin.groups.compositeRoutes.action')" @click="handleCompositeRoutes(row)" />
              <UiIconButton icon="dollar" variant="ghost" density="compact" :label="t('admin.groups.rateMultipliers')" @click="handleRateMultipliers(row)" />
              <UiIconButton icon="bolt" variant="ghost" density="compact" :label="t('admin.groups.rpmOverrides')" @click="handleRPMOverrides(row)" />
              <UiIconButton icon="trash" variant="danger" density="compact" :label="t('common.delete')" @click="handleDelete(row)" />
            </UiButtonGroup>
          </template>

          <template #empty>
            <UiEmptyState :title="t('admin.groups.noGroupsYet')" :description="t('admin.groups.createFirstGroup')"><template #action><UiButton density="compact" variant="primary" @click="openCreateModal">{{ t('admin.groups.createGroup') }}</UiButton></template></UiEmptyState>
          </template>
          </UiDataTable>
        </UiMobileTableScroller>

      <template #pagination>
        <UiPagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
        </template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Create Group Modal -->
    <UiDialog
      :show="showCreateModal"
      :title="t('admin.groups.createGroup')"
      width="normal"
      @close="closeCreateModal"
    >
      <form
        id="create-group-form"
        @submit.prevent="handleCreateGroup"
      >
        <AppStack :gap="12">
        <UiTextField
            v-model="createForm.name"
            type="text"
            required
            density="compact"
            :label="t('admin.groups.form.name')"
            :placeholder="t('admin.groups.enterGroupName')"
            data-tour="group-form-name"
          />
        <UiTextArea
            v-model="createForm.description"
            :label="t('admin.groups.form.description')"
            :rows="3"
            :placeholder="t('admin.groups.optionalDescription')"
          />
        <UiSelect
            v-model="createForm.platform"
            :options="platformOptions"
            density="compact"
            :label="t('admin.groups.form.platform')"
            :description="t('admin.groups.platformHint')"
            data-tour="group-form-platform"
            @change="createForm.copy_accounts_from_group_ids = []"
          />
        <GroupCopyAccountsPicker
          v-if="copyAccountsGroupOptions.length"
          :selected-ids="createForm.copy_accounts_from_group_ids"
          :options="copyAccountsGroupOptions"
          :label="t('admin.groups.copyAccounts.title')"
          :tooltip="t('admin.groups.copyAccounts.tooltip')"
          :placeholder="t('admin.groups.copyAccounts.selectPlaceholder')"
          :hint="t('admin.groups.copyAccounts.hint')"
          :remove-label="t('common.remove')"
          @update:selected-ids="createForm.copy_accounts_from_group_ids = $event"
        />
        <UiTextField
            v-model.number="createForm.rate_multiplier"
            type="number"
            step="0.001"
            min="0.001"
            required
            density="compact"
            :label="t('admin.groups.form.rateMultiplier')"
            :description="t('admin.groups.rateMultiplierHint')"
            data-tour="group-form-multiplier"
          />
        <UiTextField
            v-model.number="createForm.rpm_limit"
            type="number"
            min="0"
            step="1"
            density="compact"
            :label="t('admin.groups.form.rpmLimit')"
            :description="t('admin.groups.form.rpmLimitHint')"
            :placeholder="t('admin.groups.form.rpmLimitPlaceholder')"
          />
        <ReasoningEffortPolicyFields
          v-if="supportsReasoningEffortPolicyPlatform(createForm.platform)"
          ref="createReasoningEffortPolicyRef"
          id-prefix="create-group-reasoning"
          :platform="createForm.platform"
          v-model:max-effort="createForm.max_reasoning_effort"
          v-model:mappings="createForm.reasoning_effort_mappings"
        />
        <GroupExclusiveField
          v-model="createForm.is_exclusive"
          data-tour="group-form-exclusive"
        />

        <GroupModelsListEditor
          :state="createModelsListState"
          :loading="createModelsListLoading"
          @update:state="applyModelsListState(createModelsListState, $event)"
        />

        <!-- 图片生成计费配置 -->
        <GroupImagePricingFields
          v-if="supportsImagePricingPlatform(createForm.platform)"
          :platform="createForm.platform"
          v-model:allow-image-generation="createForm.allow_image_generation"
          v-model:allow-batch-image-generation="createForm.allow_batch_image_generation"
          v-model:image-rate-independent="createForm.image_rate_independent"
          v-model:image-rate-multiplier="createForm.image_rate_multiplier"
          v-model:batch-discount-multiplier="createForm.batch_image_discount_multiplier"
          v-model:batch-hold-multiplier="createForm.batch_image_hold_multiplier"
          v-model:price-1k="createForm.image_price_1k"
          v-model:price-2k="createForm.image_price_2k"
          v-model:price-4k="createForm.image_price_4k"
          :preview="createImageFinalPricePreview"
        />
        <!-- 视频生成计费配置（仅 Grok 平台） -->
        <GroupVideoPricingFields
          v-if="supportsVideoPricingPlatform(createForm.platform)"
          :platform="createForm.platform"
          v-model:video-rate-independent="createForm.video_rate_independent"
          v-model:video-rate-multiplier="createForm.video_rate_multiplier"
          v-model:price-480p="createForm.video_price_480p"
          v-model:price-720p="createForm.video_price_720p"
          v-model:price-1080p="createForm.video_price_1080p"
          :preview="createVideoFinalPricePreview"
        >
          <template #model-overrides>
            <AppSection
              :title="t('admin.groups.videoPricing.modelOverridesTitle')"
              :description="t('admin.groups.videoPricing.modelOverridesDescription')"
              divided
              data-testid="create-grok-video-model-prices"
            >
              <AppStack :gap="8">
                <AppGrid
                  v-for="family in videoModelPriceFamilyRows(createForm.video_model_prices)"
                  :key="family.key"
                  min="120px"
                  :gap="8"
                >
                  <UiBadge tone="neutral" :label="family.label" />
                  <UiTextField
                    v-for="resolution in grokVideoPriceResolutions"
                    :key="resolution.key"
                    v-model.number="createForm.video_model_prices[family.key][resolution.key]"
                    type="number"
                    step="0.001"
                    min="0"
                    density="compact"
                    :label="`${resolution.label} ($/s)`"
                    :test-id="`create-grok-video-price-${family.key}-${resolution.key}`"
                  />
                </AppGrid>
              </AppStack>
            </AppSection>
          </template>
        </GroupVideoPricingFields>
        <!-- 高峰倍率与利润控制 -->
        <GroupPeakProfitFields
          :platform="createForm.platform"
          v-model:peak-enabled="createForm.peak_rate_enabled"
          v-model:peak-start="createForm.peak_start"
          v-model:peak-end="createForm.peak_end"
          v-model:peak-multiplier="createForm.peak_rate_multiplier"
          v-model:profit-enabled="createForm.profit_control_enabled"
          v-model:min-margin="createForm.profit_min_margin_percent"
          v-model:safety-buffer="createForm.profit_safety_buffer_percent"
        />
        <!-- 平台专属策略 -->
        <GroupProviderPolicyFields
          :platform="createForm.platform"
          v-model:supported-scopes="createForm.supported_model_scopes"
          v-model:mcp-xml-inject="createForm.mcp_xml_inject"
          v-model:claude-code-only="createForm.claude_code_only"
          v-model:fallback-group-id="createForm.fallback_group_id"
          :fallback-options="fallbackGroupOptions"
        />
        <!-- Codex 网页搜索按次计费（仅 openai 平台） -->
        <AppSection
          v-if="createForm.platform === 'openai'"
          :title="t('admin.groups.webSearchPricing.title')"
          divided
        >
          <AppStack :gap="10">
            <UiTextField v-model.number="createForm.web_search_price_per_call" type="number" step="0.001" min="0" density="compact" :label="t('admin.groups.webSearchPricing.pricePerCall')" :description="t('admin.groups.webSearchPricing.pricePerCallHint')" placeholder="0.01" />
            <GroupPricingPreview
              :title="t('admin.groups.webSearchPricing.finalPricePreview', { price: createWebSearchFinalPricePreview })"
              :items="[{ label: t('admin.groups.webSearchPricing.pricePerCall'), value: createWebSearchFinalPricePreview }]"
              :columns="1"
            />
          </AppStack>
        </AppSection>

        <AppSection :title="t('admin.groups.modelPricing.title')" :description="t('admin.groups.modelPricing.description')" divided>
          <template #actions>
            <UiButton type="button" density="compact" variant="secondary" @click="addGroupPricing(createForm.model_pricing)">
              <template #icon><Icon name="plus" size="sm" /></template>{{ t("admin.groups.modelPricing.add") }}
            </UiButton>
          </template>
          <AppStack :gap="10">
            <UiCheckbox v-model="createForm.long_context_pricing_enabled" :label="t('admin.groups.modelPricing.longContext')" />
            <UiAlert tone="info" :message="t('admin.groups.modelPricing.longContextHint')" />
            <PricingEntryCard v-for="(entry, index) in createForm.model_pricing" :key="index" :entry="entry" :platform="createForm.platform" hide-token-intervals @update="createForm.model_pricing[index] = $event" @remove="createForm.model_pricing.splice(index, 1)" />
          </AppStack>
        </AppSection>

        <AppSection v-if="createForm.platform === 'grok'" :title="t('admin.groups.explicitPricing.title')" :description="t('admin.groups.explicitPricing.description')" divided>
          <AppGrid min="180px" :gap="12">
            <UiTextField v-model.number="createForm.search_price_per_1k" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.explicitPricing.searchPricePer1k')" :placeholder="t('admin.groups.explicitPricing.pricePlaceholder')" test-id="create-search-price" />
            <UiTextField v-model.number="createForm.audio_realtime_price_per_min" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.voicePricing.audioRealtimePerMin')" :placeholder="t('admin.groups.voicePricing.pricePlaceholder')" test-id="create-audio-realtime-price" />
            <UiTextField v-model.number="createForm.audio_tts_price_per_million_chars" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.voicePricing.audioTtsPerMillionChars')" :placeholder="t('admin.groups.voicePricing.pricePlaceholder')" test-id="create-audio-tts-price" />
            <UiTextField v-model.number="createForm.audio_stt_price_per_hour" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.voicePricing.audioSttPerHour')" :placeholder="t('admin.groups.voicePricing.pricePlaceholder')" test-id="create-audio-stt-price" />
          </AppGrid>
        </AppSection>

        <!-- OpenAI Live 开关（仅 openai 平台） -->
        <AppSection
          v-if="createForm.platform === 'openai'"
          :title="t('admin.groups.openaiLive.title')"
          :description="t('admin.groups.openaiLive.hint')"
          divided
        >
          <template #actions>
            <UiSwitch
              :model-value="createForm.allow_live"
              :label="t('admin.groups.openaiLive.allow')"
              @update:model-value="toggleLive('create')"
            />
          </template>
        </AppSection>

        <!-- OpenAI Messages 调度配置（仅 openai 平台） -->
        <GroupMessagesDispatchFields
          v-if="createForm.platform === 'openai'"
          v-model:allow-dispatch="createForm.allow_messages_dispatch"
          v-model:opus-model="createForm.opus_mapped_model"
          v-model:sonnet-model="createForm.sonnet_mapped_model"
          v-model:haiku-model="createForm.haiku_mapped_model"
          :mappings="createForm.exact_model_mappings"
          :row-key="getCreateMessagesDispatchRowKey"
          @add="addCreateMessagesDispatchMapping"
          @remove="removeCreateMessagesDispatchMapping"
        />
        <!-- 账号过滤控制 (OpenAI/Antigravity/Anthropic/Gemini) -->
        <GroupAccountFiltersFields
          v-if="['openai', 'antigravity', 'anthropic', 'gemini'].includes(createForm.platform)"
          v-model:oauth-only="createForm.require_oauth_only"
          v-model:privacy-set-only="createForm.require_privacy_set"
        />
        <!-- 无效请求兜底（仅 anthropic/antigravity 平台） -->
        <AppSection
          v-if="['anthropic', 'antigravity'].includes(createForm.platform)"
          divided
        >
          <UiSelect
            v-model="createForm.fallback_group_id_on_invalid_request"
            :options="invalidRequestFallbackOptions"
            :label="t('admin.groups.invalidRequestFallback.title')"
            :description="t('admin.groups.invalidRequestFallback.hint')"
            :placeholder="t('admin.groups.invalidRequestFallback.noFallback')"
            density="compact"
          />
        </AppSection>

        <!-- 模型路由配置（仅 anthropic 平台） -->
        <GroupModelRoutingFields
          v-if="createForm.platform === 'anthropic'"
          v-model:enabled="createForm.model_routing_enabled"
          :rules="createModelRoutingRules"
          :row-key="getCreateRuleRenderKey"
          :search-key="getCreateRuleSearchKey"
          :account-options="createAccountPickerOptions"
          @add="addCreateRoutingRule"
          @remove-rule="removeCreateRoutingRule"
          @remove-account="removeSelectedAccount"
          @search="searchCreateRoutingAccounts"
          @select="selectCreateRoutingAccount"
        />
        </AppStack>
      </form>

      <template #footer>
        <AppInline justify="flex-end">
          <UiButton
            type="button"
            density="compact"
            variant="secondary"
            @click="closeCreateModal"
          >
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton
            type="submit"
            form="create-group-form"
            density="compact"
            variant="primary"
            :loading="submitting"
            data-tour="group-form-submit"
          >
            {{ submitting ? t("admin.groups.creating") : t("common.create") }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Edit Group Modal -->
    <UiDialog
      :show="showEditModal"
      :title="t('admin.groups.editGroup')"
      width="normal"
      @close="closeEditModal"
    >
      <form
        v-if="editingGroup"
        id="edit-group-form"
        @submit.prevent="handleUpdateGroup"
      >
        <AppStack :gap="12">
        <UiTextField
            v-model="editForm.name"
            type="text"
            required
            density="compact"
            :label="t('admin.groups.form.name')"
            data-tour="edit-group-form-name"
          />
        <UiTextArea
            v-model="editForm.description"
            :label="t('admin.groups.form.description')"
            :rows="3"
          />
        <UiSelect
            v-model="editForm.platform"
            :options="platformOptions"
            :disabled="true"
            density="compact"
            :label="t('admin.groups.form.platform')"
            :description="t('admin.groups.platformNotEditable')"
            data-tour="group-form-platform"
          />
        <GroupCopyAccountsPicker
          v-if="copyAccountsGroupOptionsForEdit.length"
          :selected-ids="editForm.copy_accounts_from_group_ids"
          :options="copyAccountsGroupOptionsForEdit"
          :label="t('admin.groups.copyAccounts.title')"
          :tooltip="t('admin.groups.copyAccounts.tooltipEdit')"
          :placeholder="t('admin.groups.copyAccounts.selectPlaceholder')"
          :hint="t('admin.groups.copyAccounts.hintEdit')"
          :remove-label="t('common.remove')"
          @update:selected-ids="editForm.copy_accounts_from_group_ids = $event"
        />
        <UiTextField
            v-model.number="editForm.rate_multiplier"
            type="number"
            step="0.001"
            min="0.001"
            required
            density="compact"
            :label="t('admin.groups.form.rateMultiplier')"
            data-tour="group-form-multiplier"
          />
        <UiTextField
            v-model.number="editForm.rpm_limit"
            type="number"
            min="0"
            step="1"
            density="compact"
            :label="t('admin.groups.form.rpmLimit')"
            :description="t('admin.groups.form.rpmLimitHint')"
            :placeholder="t('admin.groups.form.rpmLimitPlaceholder')"
          />
        <ReasoningEffortPolicyFields
          v-if="supportsReasoningEffortPolicyPlatform(editForm.platform)"
          ref="editReasoningEffortPolicyRef"
          id-prefix="edit-group-reasoning"
          :platform="editForm.platform"
          v-model:max-effort="editForm.max_reasoning_effort"
          v-model:mappings="editForm.reasoning_effort_mappings"
        />
        <GroupExclusiveField v-model="editForm.is_exclusive" />
        <UiSelect
          v-model="editForm.status"
          :options="editStatusOptions"
          density="compact"
          :label="t('admin.groups.form.status')"
        />

        <GroupModelsListEditor
          :state="editModelsListState"
          :loading="editModelsListLoading"
          @update:state="applyModelsListState(editModelsListState, $event)"
        />

        <!-- 图片生成计费配置 -->
        <GroupImagePricingFields
          v-if="supportsImagePricingPlatform(editForm.platform)"
          :platform="editForm.platform"
          v-model:allow-image-generation="editForm.allow_image_generation"
          v-model:allow-batch-image-generation="editForm.allow_batch_image_generation"
          v-model:image-rate-independent="editForm.image_rate_independent"
          v-model:image-rate-multiplier="editForm.image_rate_multiplier"
          v-model:batch-discount-multiplier="editForm.batch_image_discount_multiplier"
          v-model:batch-hold-multiplier="editForm.batch_image_hold_multiplier"
          v-model:price-1k="editForm.image_price_1k"
          v-model:price-2k="editForm.image_price_2k"
          v-model:price-4k="editForm.image_price_4k"
          :preview="editImageFinalPricePreview"
        />
        <!-- 视频生成计费配置（仅 Grok 平台） -->
        <GroupVideoPricingFields
          v-if="supportsVideoPricingPlatform(editForm.platform)"
          :platform="editForm.platform"
          v-model:video-rate-independent="editForm.video_rate_independent"
          v-model:video-rate-multiplier="editForm.video_rate_multiplier"
          v-model:price-480p="editForm.video_price_480p"
          v-model:price-720p="editForm.video_price_720p"
          v-model:price-1080p="editForm.video_price_1080p"
          :preview="editVideoFinalPricePreview"
        >
          <template #model-overrides>
            <AppSection
              :title="t('admin.groups.videoPricing.modelOverridesTitle')"
              :description="t('admin.groups.videoPricing.modelOverridesDescription')"
              divided
              data-testid="edit-grok-video-model-prices"
            >
              <AppStack :gap="8">
                <AppGrid
                  v-for="family in videoModelPriceFamilyRows(editForm.video_model_prices)"
                  :key="family.key"
                  min="120px"
                  :gap="8"
                >
                  <UiBadge tone="neutral" :label="family.label" />
                  <UiTextField
                    v-for="resolution in grokVideoPriceResolutions"
                    :key="resolution.key"
                    v-model.number="editForm.video_model_prices[family.key][resolution.key]"
                    type="number"
                    step="0.001"
                    min="0"
                    density="compact"
                    :label="`${resolution.label} ($/s)`"
                    :test-id="`edit-grok-video-price-${family.key}-${resolution.key}`"
                  />
                </AppGrid>
              </AppStack>
            </AppSection>
          </template>
        </GroupVideoPricingFields>
        <!-- 高峰倍率与利润控制 -->
        <GroupPeakProfitFields
          :platform="editForm.platform"
          v-model:peak-enabled="editForm.peak_rate_enabled"
          v-model:peak-start="editForm.peak_start"
          v-model:peak-end="editForm.peak_end"
          v-model:peak-multiplier="editForm.peak_rate_multiplier"
          v-model:profit-enabled="editForm.profit_control_enabled"
          v-model:min-margin="editForm.profit_min_margin_percent"
          v-model:safety-buffer="editForm.profit_safety_buffer_percent"
        />
        <!-- 平台专属策略 -->
        <GroupProviderPolicyFields
          :platform="editForm.platform"
          v-model:supported-scopes="editForm.supported_model_scopes"
          v-model:mcp-xml-inject="editForm.mcp_xml_inject"
          v-model:claude-code-only="editForm.claude_code_only"
          v-model:fallback-group-id="editForm.fallback_group_id"
          :fallback-options="fallbackGroupOptionsForEdit"
        />
        <!-- Codex 网页搜索按次计费（仅 openai 平台） -->
        <AppSection
          v-if="editForm.platform === 'openai'"
          :title="t('admin.groups.webSearchPricing.title')"
          divided
        >
          <AppStack :gap="10">
            <UiTextField v-model.number="editForm.web_search_price_per_call" type="number" step="0.001" min="0" density="compact" :label="t('admin.groups.webSearchPricing.pricePerCall')" :description="t('admin.groups.webSearchPricing.pricePerCallHint')" placeholder="0.01" />
            <GroupPricingPreview
              :title="t('admin.groups.webSearchPricing.finalPricePreview', { price: editWebSearchFinalPricePreview })"
              :items="[{ label: t('admin.groups.webSearchPricing.pricePerCall'), value: editWebSearchFinalPricePreview }]"
              :columns="1"
            />
          </AppStack>
        </AppSection>

        <AppSection :title="t('admin.groups.modelPricing.title')" :description="t('admin.groups.modelPricing.description')" divided>
          <template #actions>
            <UiButton type="button" density="compact" variant="secondary" @click="addGroupPricing(editForm.model_pricing)">
              <template #icon><Icon name="plus" size="sm" /></template>{{ t("admin.groups.modelPricing.add") }}
            </UiButton>
          </template>
          <AppStack :gap="10">
            <UiCheckbox v-model="editForm.long_context_pricing_enabled" :label="t('admin.groups.modelPricing.longContext')" />
            <UiAlert tone="info" :message="t('admin.groups.modelPricing.longContextHint')" />
            <PricingEntryCard v-for="(entry, index) in editForm.model_pricing" :key="index" :entry="entry" :platform="editForm.platform" hide-token-intervals @update="editForm.model_pricing[index] = $event" @remove="editForm.model_pricing.splice(index, 1)" />
          </AppStack>
        </AppSection>

        <AppSection v-if="editForm.platform === 'grok'" :title="t('admin.groups.explicitPricing.title')" :description="t('admin.groups.explicitPricing.description')" divided>
          <AppGrid min="180px" :gap="12">
            <UiTextField v-model.number="editForm.search_price_per_1k" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.explicitPricing.searchPricePer1k')" :placeholder="t('admin.groups.explicitPricing.pricePlaceholder')" test-id="edit-search-price" />
            <UiTextField v-model.number="editForm.audio_realtime_price_per_min" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.voicePricing.audioRealtimePerMin')" :placeholder="t('admin.groups.voicePricing.pricePlaceholder')" test-id="edit-audio-realtime-price" />
            <UiTextField v-model.number="editForm.audio_tts_price_per_million_chars" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.voicePricing.audioTtsPerMillionChars')" :placeholder="t('admin.groups.voicePricing.pricePlaceholder')" test-id="edit-audio-tts-price" />
            <UiTextField v-model.number="editForm.audio_stt_price_per_hour" type="number" step="0.000001" min="0" density="compact" :label="t('admin.groups.voicePricing.audioSttPerHour')" :placeholder="t('admin.groups.voicePricing.pricePlaceholder')" test-id="edit-audio-stt-price" />
          </AppGrid>
        </AppSection>

        <!-- OpenAI Live 开关（仅 openai 平台） -->
        <AppSection
          v-if="editForm.platform === 'openai'"
          :title="t('admin.groups.openaiLive.title')"
          :description="t('admin.groups.openaiLive.hint')"
          divided
        >
          <template #actions>
            <UiSwitch
              :model-value="editForm.allow_live"
              :label="t('admin.groups.openaiLive.allow')"
              @update:model-value="toggleLive('edit')"
            />
          </template>
        </AppSection>

        <!-- OpenAI Messages 调度配置（仅 openai 平台） -->
        <GroupMessagesDispatchFields
          v-if="editForm.platform === 'openai'"
          v-model:allow-dispatch="editForm.allow_messages_dispatch"
          v-model:opus-model="editForm.opus_mapped_model"
          v-model:sonnet-model="editForm.sonnet_mapped_model"
          v-model:haiku-model="editForm.haiku_mapped_model"
          :mappings="editForm.exact_model_mappings"
          :row-key="getEditMessagesDispatchRowKey"
          @add="addEditMessagesDispatchMapping"
          @remove="removeEditMessagesDispatchMapping"
        />
        <!-- 账号过滤控制 (OpenAI/Antigravity/Anthropic/Gemini) -->
        <GroupAccountFiltersFields
          v-if="['openai', 'antigravity', 'anthropic', 'gemini'].includes(editForm.platform)"
          v-model:oauth-only="editForm.require_oauth_only"
          v-model:privacy-set-only="editForm.require_privacy_set"
        />
        <!-- 无效请求兜底（仅 anthropic/antigravity 平台） -->
        <AppSection
          v-if="['anthropic', 'antigravity'].includes(editForm.platform)"
          divided
        >
          <UiSelect
            v-model="editForm.fallback_group_id_on_invalid_request"
            :options="invalidRequestFallbackOptionsForEdit"
            :label="t('admin.groups.invalidRequestFallback.title')"
            :description="t('admin.groups.invalidRequestFallback.hint')"
            :placeholder="t('admin.groups.invalidRequestFallback.noFallback')"
            density="compact"
          />
        </AppSection>

        <!-- 模型路由配置（仅 anthropic 平台） -->
        <GroupModelRoutingFields
          v-if="editForm.platform === 'anthropic'"
          v-model:enabled="editForm.model_routing_enabled"
          :rules="editModelRoutingRules"
          :row-key="getEditRuleRenderKey"
          :search-key="getEditRuleSearchKey"
          :account-options="editAccountPickerOptions"
          @add="addEditRoutingRule"
          @remove-rule="removeEditRoutingRule"
          @remove-account="removeSelectedAccount"
          @search="searchEditRoutingAccounts"
          @select="selectEditRoutingAccount"
        />
        </AppStack>
      </form>

      <template #footer>
        <AppInline justify="flex-end">
          <UiButton
            type="button"
            density="compact"
            variant="secondary"
            @click="closeEditModal"
          >
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton
            type="submit"
            form="edit-group-form"
            density="compact"
            variant="primary"
            :loading="submitting"
            data-tour="group-form-submit"
          >
            {{ submitting ? t("admin.groups.updating") : t("common.update") }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Delete Confirmation Dialog -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.groups.deleteGroup')"
      :message="deleteConfirmMessage"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="deletePending"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <UiConfirmDialog
      :show="showUnsupportedLiveConfirm"
      :title="t('admin.groups.openaiLive.unsupportedTitle')"
      :message="t('admin.groups.openaiLive.unsupportedMessage')"
      :confirm-text="t('admin.groups.openaiLive.enableAnyway')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      @confirm="confirmUnsupportedLive"
      @cancel="cancelUnsupportedLive"
    />

    <!-- Sort Order Modal -->
    <UiDialog
      :show="showSortModal"
      :title="t('admin.groups.sortOrder')"
      width="normal"
      @close="closeSortModal"
    >
      <GroupSortList
        v-model="sortableGroups"
        :hint="t('admin.groups.sortOrderHint')"
      />

      <template #footer>
        <AppInline justify="flex-end">
          <UiButton
            type="button"
            density="compact"
            variant="secondary"
            @click="closeSortModal"
          >
            {{ t("common.cancel") }}
          </UiButton>
          <UiButton
            type="button"
            density="compact"
            variant="primary"
            @click="saveSortOrder"
            :loading="sortSubmitting"
          >
            {{ sortSubmitting ? t("common.saving") : t("common.save") }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Composite Routes Modal -->
    <UiDialog
      :show="showCompositeRoutesModal"
      :title="
        compositeRoutesGroup
          ? t('admin.groups.compositeRoutes.titleWithGroup', {
              name: compositeRoutesGroup.name,
            })
          : t('admin.groups.compositeRoutes.title')
      "
      width="wide"
      @close="closeCompositeRoutesModal"
    >
      <AppGrid min="360px" :gap="20">
        <AppSection :title="t('admin.groups.compositeRoutes.routes')">
          <template #actions>
            <UiIconButton
              icon="refresh"
              density="compact"
              :label="t('common.refresh')"
              :disabled="compositeRoutesLoading"
              @click="loadCompositeRoutes"
            />
          </template>

          <UiMobileTableScroller
            :label="t('admin.groups.compositeRoutes.routes')"
            min-width="560px"
          >
            <UiDataTable
              :columns="compositeRouteColumns"
              :data="compositeRoutes"
              :loading="compositeRoutesLoading"
              row-key="id"
              mobile-table
              :aria-label="t('admin.groups.compositeRoutes.routes')"
            >
              <template #cell-public_model="{ row: route }">
                <UiDataCell
                  :value="route.public_model"
                  :meta="compositeRouteMatchLabel(route.match_type)"
                  mono
                />
                <UiBadge
                  v-if="!route.enabled"
                  tone="danger"
                  :label="t('admin.accounts.status.inactive')"
                />
              </template>
              <template #cell-target="{ row: route }">
                <UiDataCell
                  :value="formatCompositePlatform(route.target_platform)"
                  :meta="route.upstream_model || route.public_model"
                />
              </template>
              <template #cell-scope="{ row: route }">
                <UiDataCell
                  :value="formatCompositeEndpoint(route.endpoint)"
                  :meta="`${t('admin.groups.compositeRoutes.priority')}: ${route.priority}`"
                />
              </template>
              <template #cell-actions="{ row: route }">
                <UiButtonGroup>
                  <UiIconButton
                    icon="edit"
                    variant="ghost"
                    density="mini"
                    :label="t('common.edit')"
                    @click="editCompositeRoute(route)"
                  />
                  <UiIconButton
                    icon="trash"
                    variant="danger"
                    density="mini"
                    :label="t('common.delete')"
                    @click="deleteCompositeRoute(route)"
                  />
                </UiButtonGroup>
              </template>
              <template #empty>
                <UiEmptyState :title="t('admin.groups.compositeRoutes.empty')" />
              </template>
            </UiDataTable>
          </UiMobileTableScroller>
        </AppSection>

        <AppStack :gap="8">
          <AppSection
            :title="
              compositeRouteEditingId
                ? t('admin.groups.compositeRoutes.editRoute')
                : t('admin.groups.compositeRoutes.addRoute')
            "
            divided
          >
            <template #actions>
              <UiButton
                v-if="compositeRouteEditingId"
                type="button"
                density="mini"
                variant="quiet"
                @click="resetCompositeRouteForm"
              >
                {{ t("common.cancel") }}
              </UiButton>
            </template>

            <form @submit.prevent="saveCompositeRoute">
              <AppStack :gap="12">

            <UiTextField
              v-model="compositeRouteForm.public_model"
              :label="t('admin.groups.compositeRoutes.publicModel')"
              required
              density="compact"
              placeholder="openrouter/gpt-5"
            />

            <AppGrid min="150px" :gap="12">
              <UiSelect
                v-model="compositeRouteForm.match_type"
                :label="t('admin.groups.compositeRoutes.matchType')"
                :options="compositeRouteMatchOptions"
                density="compact"
              />
              <UiSelect
                v-model="compositeRouteForm.endpoint"
                :label="t('admin.groups.compositeRoutes.endpoint')"
                :options="compositeRouteEndpointOptions"
                density="compact"
              />
            </AppGrid>

            <AppGrid min="150px" :gap="12">
              <UiSelect
                v-model="compositeRouteForm.target_platform"
                :label="t('admin.groups.compositeRoutes.targetPlatform')"
                :options="compositeRoutePlatformOptions"
                density="compact"
              />
              <UiTextField
                v-model="compositeRouteForm.priority"
                :label="t('admin.groups.compositeRoutes.priority')"
                type="number"
                min="1"
                step="1"
                density="compact"
              />
            </AppGrid>

            <UiTextField
              v-model="compositeRouteForm.upstream_model"
              :label="t('admin.groups.compositeRoutes.upstreamModel')"
              :description="t('admin.groups.compositeRoutes.upstreamModelHint')"
              density="compact"
              placeholder="gpt-5"
            />

            <UiTextArea
              v-model="compositeRouteForm.notes"
              :label="t('admin.groups.compositeRoutes.notes')"
              :rows="2"
            />

            <AppInline justify="space-between">
              <UiCheckbox
                v-model="compositeRouteForm.enabled"
                :label="t('admin.groups.compositeRoutes.enabled')"
              />
              <UiButton
                type="submit"
                variant="primary"
                density="compact"
                :loading="compositeRouteSaving"
              >
                {{ compositeRouteEditingId ? t("common.update") : t("common.create") }}
              </UiButton>
            </AppInline>
              </AppStack>
          </form>
          </AppSection>

          <AppSection :title="t('admin.groups.compositeRoutes.preview')">
            <AppStack :gap="12">
              <UiTextField
                v-model="compositePreviewModel"
                density="compact"
                placeholder="openrouter/gpt-5"
                @enter="previewCompositeRoute"
              />
              <AppInline :wrap="false">
                <UiSelect
                  v-model="compositePreviewEndpoint"
                  :options="compositeRouteEndpointOptions"
                  density="compact"
                />
                <UiIconButton
                  icon="play"
                  density="compact"
                  :label="t('admin.groups.compositeRoutes.preview')"
                  :disabled="compositePreviewLoading || !compositePreviewModel"
                  @click="previewCompositeRoute"
                />
              </AppInline>

              <AppStack v-if="compositePreviewDecision" :gap="8">
                <AppInline>
                  <UiBadge
                    :tone="compositePreviewDecision.matched ? 'success' : 'danger'"
                  >
                    {{
                      compositePreviewDecision.matched
                        ? t("admin.groups.compositeRoutes.matched")
                        : t("admin.groups.compositeRoutes.notMatched")
                    }}
                  </UiBadge>
                  <UiBadge tone="neutral">
                    {{
                      compositeRouteSourceLabel(
                        compositePreviewDecision.source,
                      )
                    }}
                  </UiBadge>
                </AppInline>
                <UiDescriptionList :items="compositePreviewItems" :columns="1" />
              </AppStack>
            </AppStack>
          </AppSection>
        </AppStack>
      </AppGrid>

      <template #footer>
        <AppInline justify="flex-end">
          <UiButton
            type="button"
            density="compact"
            variant="secondary"
            @click="closeCompositeRoutesModal"
          >
            {{ t("common.close") }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <UiConfirmDialog
      :show="Boolean(compositeRoutePendingDelete)"
      :title="t('common.delete')"
      :message="t('admin.groups.compositeRoutes.deleteConfirm')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="compositeRouteDeleting"
      @confirm="confirmDeleteCompositeRoute"
      @cancel="compositeRoutePendingDelete = null"
    />

    <!-- Group Rate Multipliers Modal -->
    <GroupRateMultipliersModal
      :show="showRateMultipliersModal"
      :group="rateMultipliersGroup"
      @close="showRateMultipliersModal = false"
      @success="loadGroups"
    />

    <!-- Group RPM Overrides Modal -->
    <GroupRPMOverridesModal
      :show="showRPMOverridesModal"
      :group="rpmOverridesGroup"
      @close="showRPMOverridesModal = false"
      @success="loadGroups"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { adminAPI } from "@/api/admin";
import type {
  AdminGroup,
  CompositeModelRoute,
  CompositeModelRouteInput,
  CompositeRouteDecision,
  CompositeRouteEndpoint,
  CompositeRouteMatchType,
  GroupPlatform,
} from "@/types";
import type { Column, UiEntityOption } from "@/components/ui";
import AppLayout from "@/components/layout/AppLayout.vue";
import Icon from "@/components/icons/Icon.vue";
import {
  AppGrid,
  AppInline,
  AppPage,
  AppPageHeader,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiButtonGroup,
  UiCheckbox,
  UiColumnPicker,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiMobileTableScroller,
  UiPagination,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiStatusBadge,
  UiSwitch,
  UiTableToolbar,
  UiTextArea,
  UiTextField,
} from '@/components/ui';
import GroupRateMultipliersModal from "@/components/admin/group/GroupRateMultipliersModal.vue";
import GroupRPMOverridesModal from "@/components/admin/group/GroupRPMOverridesModal.vue";
import GroupModelsListEditor from "@/components/admin/group/GroupModelsListEditor.vue";
import GroupCopyAccountsPicker from "@/components/admin/group/GroupCopyAccountsPicker.vue";
import GroupExclusiveField from "@/components/admin/group/GroupExclusiveField.vue";
import GroupAccountSummary from "@/components/admin/group/GroupAccountSummary.vue";
import GroupCapacitySummary from "@/components/admin/group/GroupCapacitySummary.vue";
import GroupUsageSummaryCell from "@/components/admin/group/GroupUsageSummary.vue";
import GroupSortList from "@/components/admin/group/GroupSortList.vue";
import GroupMessagesDispatchFields from "@/components/admin/group/GroupMessagesDispatchFields.vue";
import GroupPricingPreview from "@/components/admin/group/GroupPricingPreview.vue";
import GroupAccountFiltersFields from "@/components/admin/group/GroupAccountFiltersFields.vue";
import GroupModelRoutingFields from "@/components/admin/group/GroupModelRoutingFields.vue";
import GroupImagePricingFields from "@/components/admin/group/GroupImagePricingFields.vue";
import GroupVideoPricingFields from "@/components/admin/group/GroupVideoPricingFields.vue";
import GroupPeakProfitFields from "@/components/admin/group/GroupPeakProfitFields.vue";
import GroupProviderPolicyFields from "@/components/admin/group/GroupProviderPolicyFields.vue";
import type {
  GroupModelRoutingRule as ModelRoutingRule,
  GroupRoutingAccount as SimpleAccount,
} from "@/components/admin/group/groupModelRoutingTypes";
import ReasoningEffortPolicyFields from "@/components/admin/group/ReasoningEffortPolicyFields.vue";
import PricingEntryCard from "@/components/admin/channel/PricingEntryCard.vue";
import type { PricingFormEntry } from "@/components/admin/channel/types";
import {
  apiIntervalsToForm,
  formIntervalsToAPI,
  mTokToPerToken,
  perTokenToMTok,
  toNullableNumber,
} from "@/components/admin/channel/types";
import type { ChannelModelPricing } from "@/api/admin/channels";
import { createStableObjectKeyResolver } from "@/utils/stableObjectKey";
import { extractApiErrorMessage } from "@/utils/apiError";
import { useKeyedDebouncedSearch } from "@/composables/useKeyedDebouncedSearch";
import { getPersistedPageSize } from "@/composables/usePersistedPageSize";
import {
  createDefaultMessagesDispatchFormState,
  messagesDispatchConfigToFormState,
  messagesDispatchFormStateToConfig,
  resetMessagesDispatchFormState,
  type MessagesDispatchMappingRow,
} from "./groupsMessagesDispatch";
import {
  buildModelsListConfig,
  createModelsListState as createInitialModelsListState,
  setModelsListCandidates,
  type ModelsListState,
} from "./groupsModelsList";
import { createModelsListCandidatesTracker } from "./groupsModelsListCandidates";
import { normalizeSupportedModelScopesForPlatform } from "./groupsSupportedModelScopes";
import {
  isProfitControlPlatform,
  profitPercentToDecimal,
  profitDecimalToPercent,
  validateProfitControlFormState,
  type ProfitControlFormState,
} from "./groupsProfitControl";
import {
  normalizeReasoningEffortForPlatform,
  reasoningEffortMappingsToAPI,
  reasoningEffortMappingsToRows,
  supportsReasoningEffortPolicyPlatform,
  type ReasoningEffortMappingRow,
} from "./groupsReasoningEffort";
import {
  getDefaultImagePreviewPrice,
  getDefaultVideoPreviewPrice,
  supportsImagePricingPlatform,
  supportsVideoPricingPlatform,
} from "./groupsImagePricing";
import {
  createVideoModelPricesForm,
  grokVideoPriceResolutions,
  serializeVideoModelPrices,
  videoModelPriceFamilyRows,
} from "./groupsVideoModelPricing";

const emptyGroupPricing = (): PricingFormEntry => ({
  models: [],
  billing_mode: "token",
  input_price: null,
  output_price: null,
  cache_write_price: null,
  cache_read_price: null,
  image_input_price: null,
  image_output_price: null,
  per_request_price: null,
  intervals: [],
});

const addGroupPricing = (entries: PricingFormEntry[]) =>
  entries.push(emptyGroupPricing());

const groupPricingFromAPI = (
  pricing: ChannelModelPricing[] | undefined,
): PricingFormEntry[] =>
  (pricing || []).map((entry) => ({
    models: entry.models || [],
    billing_mode: entry.billing_mode || "token",
    input_price: perTokenToMTok(entry.input_price),
    output_price: perTokenToMTok(entry.output_price),
    cache_write_price: perTokenToMTok(entry.cache_write_price),
    cache_read_price: perTokenToMTok(entry.cache_read_price),
    image_input_price: perTokenToMTok(entry.image_input_price),
    image_output_price: perTokenToMTok(entry.image_output_price),
    per_request_price: entry.per_request_price,
    intervals: apiIntervalsToForm(entry.intervals || []),
  }));

const groupPricingToAPI = (
  pricing: PricingFormEntry[],
  platform: string,
): ChannelModelPricing[] =>
  pricing
    .filter((entry) => entry.models.length > 0)
    .map((entry) => ({
      platform,
      models: entry.models,
      billing_mode: entry.billing_mode,
      input_price: mTokToPerToken(entry.input_price),
      output_price: mTokToPerToken(entry.output_price),
      cache_write_price: mTokToPerToken(entry.cache_write_price),
      cache_read_price: mTokToPerToken(entry.cache_read_price),
      image_input_price: mTokToPerToken(entry.image_input_price),
      image_output_price: mTokToPerToken(entry.image_output_price),
      per_request_price: toNullableNumber(entry.per_request_price),
      intervals:
        entry.billing_mode === "token"
          ? []
          : formIntervalsToAPI(entry.intervals || []),
    }));

const { t } = useI18n();
const appStore = useAppStore();

const ALWAYS_VISIBLE_COLUMNS = new Set(["name", "actions"]);
// Default hidden columns (hidden on first load / after schema bumps).
const DEFAULT_HIDDEN_COLUMNS = ["id"];
const HIDDEN_COLUMNS_KEY = "group-hidden-columns";
// Bump when adding new default-hidden columns so existing admins pick them up once.
const COLUMN_SETTINGS_VERSION_KEY = "group-column-settings-version";
const COLUMN_SETTINGS_VERSION = 2;
const VERSION_NEW_HIDDEN_COLUMNS: Record<number, string[]> = {
  2: ["id"],
};

const allColumns = computed<Column[]>(() => [
  { key: "name", label: t("admin.groups.columns.name"), sortable: true },
  { key: "id", label: t("admin.groups.columns.id"), sortable: true },
  {
    key: "platform",
    label: t("admin.groups.columns.platform"),
    sortable: true,
  },
  {
    key: "rate_multiplier",
    label: t("admin.groups.columns.rateMultiplier"),
    sortable: true,
  },
  {
    key: "is_exclusive",
    label: t("admin.groups.columns.type"),
    sortable: true,
  },
  {
    key: "account_count",
    label: t("admin.groups.columns.accounts"),
    sortable: true,
  },
  {
    key: "capacity",
    label: t("admin.groups.columns.capacity"),
    sortable: false,
  },
  { key: "usage", label: t("admin.groups.columns.usage"), sortable: false },
  { key: "status", label: t("admin.groups.columns.status"), sortable: true },
  { key: "actions", label: t("admin.groups.columns.actions"), sortable: false },
]);

const toggleableColumns = computed(() =>
  allColumns.value.filter((col) => !ALWAYS_VISIBLE_COLUMNS.has(col.key)),
);
const hiddenColumns = reactive<Set<string>>(new Set());
const visibleColumnKeys = computed(() =>
  toggleableColumns.value.filter((column) => !hiddenColumns.has(column.key)).map((column) => column.key),
);
const columnPickerOptions = computed(() =>
  toggleableColumns.value.map((column) => ({ key: column.key, label: column.label })),
);

const getValidHiddenColumnKeys = () =>
  new Set(toggleableColumns.value.map((col) => col.key));

const loadSavedColumns = () => {
  hiddenColumns.clear();
  try {
    const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY);
    const validKeys = getValidHiddenColumnKeys();

    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed
          .filter(
            (key): key is string =>
              typeof key === "string" && validKeys.has(key),
          )
          .forEach((key) => hiddenColumns.add(key));
      }

      // Existing admins: auto-hide columns newly added as default-hidden.
      const storedVersion = Number(
        localStorage.getItem(COLUMN_SETTINGS_VERSION_KEY) ?? "1",
      );
      if (storedVersion < COLUMN_SETTINGS_VERSION) {
        let mutated = false;
        for (let v = storedVersion + 1; v <= COLUMN_SETTINGS_VERSION; v++) {
          for (const key of VERSION_NEW_HIDDEN_COLUMNS[v] ?? []) {
            if (validKeys.has(key) && !hiddenColumns.has(key)) {
              hiddenColumns.add(key);
              mutated = true;
            }
          }
        }
        if (mutated) {
          saveColumnsToStorage();
        } else {
          localStorage.setItem(
            COLUMN_SETTINGS_VERSION_KEY,
            String(COLUMN_SETTINGS_VERSION),
          );
        }
      }
    } else {
      DEFAULT_HIDDEN_COLUMNS.forEach((key) => {
        if (validKeys.has(key)) hiddenColumns.add(key);
      });
      saveColumnsToStorage();
    }
  } catch (error) {
    console.error("Failed to load group column settings:", error);
    DEFAULT_HIDDEN_COLUMNS.forEach((key) => hiddenColumns.add(key));
  }
};

const saveColumnsToStorage = () => {
  try {
    const validKeys = getValidHiddenColumnKeys();
    const keys = [...hiddenColumns].filter((key) => validKeys.has(key));
    localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(keys));
    localStorage.setItem(
      COLUMN_SETTINGS_VERSION_KEY,
      String(COLUMN_SETTINGS_VERSION),
    );
  } catch (error) {
    console.error("Failed to save group column settings:", error);
  }
};

const isColumnVisible = (key: string) => !hiddenColumns.has(key);
const hasVisibleUsageSummaryConsumer = computed(() => isColumnVisible("usage"));
const hasVisibleCapacityColumn = computed(() => isColumnVisible("capacity"));

const toggleColumn = (key: string) => {
  const validKeys = getValidHiddenColumnKeys();
  if (!validKeys.has(key)) return;

  const wasHidden = hiddenColumns.has(key);
  if (wasHidden) {
    hiddenColumns.delete(key);
  } else {
    hiddenColumns.add(key);
  }
  saveColumnsToStorage();

  if (wasHidden && key === "usage") {
    loadUsageSummary();
  }
  if (wasHidden && key === "capacity") {
    loadCapacitySummary();
  }
};

const updateVisibleColumns = (keys: string[]) => {
  const next = new Set(keys);
  for (const column of toggleableColumns.value) {
    if (isColumnVisible(column.key) !== next.has(column.key)) toggleColumn(column.key);
  }
};

const columns = computed<Column[]>(() =>
  allColumns.value.filter(
    (col) => ALWAYS_VISIBLE_COLUMNS.has(col.key) || !hiddenColumns.has(col.key),
  ),
);

if (typeof window !== "undefined") {
  loadSavedColumns();
}

// Filter options
const statusOptions = computed(() => [
  { value: "", label: t("admin.groups.allStatus") },
  { value: "active", label: t("admin.accounts.status.active") },
  { value: "inactive", label: t("admin.accounts.status.inactive") },
]);

const exclusiveOptions = computed(() => [
  { value: "", label: t("admin.groups.allGroups") },
  { value: "true", label: t("admin.groups.exclusive") },
  { value: "false", label: t("admin.groups.nonExclusive") },
]);

const platformOptions = computed(() => [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "antigravity", label: "Antigravity" },
  { value: "grok", label: "Grok" },
  { value: "composite", label: "Composite" },
]);

const platformFilterOptions = computed(() => [
  { value: "", label: t("admin.groups.allPlatforms") },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "antigravity", label: "Antigravity" },
  { value: "grok", label: "Grok" },
  { value: "composite", label: "Composite" },
]);

const compositeRoutePlatformOptions = computed(() => [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "antigravity", label: "Antigravity" },
  { value: "grok", label: "Grok" },
]);

const compositeRouteEndpointOptions = computed(() => [
  { value: "any", label: t("admin.groups.compositeRoutes.endpoints.any") },
  {
    value: "messages",
    label: t("admin.groups.compositeRoutes.endpoints.messages"),
  },
  {
    value: "count_tokens",
    label: t("admin.groups.compositeRoutes.endpoints.countTokens"),
  },
  {
    value: "responses",
    label: t("admin.groups.compositeRoutes.endpoints.responses"),
  },
  {
    value: "chat_completions",
    label: t("admin.groups.compositeRoutes.endpoints.chatCompletions"),
  },
  {
    value: "embeddings",
    label: t("admin.groups.compositeRoutes.endpoints.embeddings"),
  },
  { value: "images", label: t("admin.groups.compositeRoutes.endpoints.images") },
  { value: "gemini", label: t("admin.groups.compositeRoutes.endpoints.gemini") },
]);

const compositeRouteMatchOptions = computed(() => [
  { value: "exact", label: t("admin.groups.compositeRoutes.match.exact") },
  { value: "prefix", label: t("admin.groups.compositeRoutes.match.prefix") },
]);

const editStatusOptions = computed(() => [
  { value: "active", label: t("admin.accounts.status.active") },
  { value: "inactive", label: t("admin.accounts.status.inactive") },
]);

// 降级分组选项（创建时）- 仅包含 anthropic 平台且未启用 claude_code_only 的分组
const fallbackGroupOptions = computed(() => {
  const options: { value: number | null; label: string }[] = [
    { value: null, label: t("admin.groups.claudeCode.noFallback") },
  ];
  const eligibleGroups = groups.value.filter(
    (g) =>
      g.platform === "anthropic" &&
      !g.claude_code_only &&
      g.status === "active",
  );
  eligibleGroups.forEach((g) => {
    options.push({ value: g.id, label: g.name });
  });
  return options;
});

// 降级分组选项（编辑时）- 排除自身
const fallbackGroupOptionsForEdit = computed(() => {
  const options: { value: number | null; label: string }[] = [
    { value: null, label: t("admin.groups.claudeCode.noFallback") },
  ];
  const currentId = editingGroup.value?.id;
  const eligibleGroups = groups.value.filter(
    (g) =>
      g.platform === "anthropic" &&
      !g.claude_code_only &&
      g.status === "active" &&
      g.id !== currentId,
  );
  eligibleGroups.forEach((g) => {
    options.push({ value: g.id, label: g.name });
  });
  return options;
});

// 无效请求兜底分组选项（创建时）- 仅包含 anthropic 平台且未配置兜底的分组
const invalidRequestFallbackOptions = computed(() => {
  const options: { value: number | null; label: string }[] = [
    { value: null, label: t("admin.groups.invalidRequestFallback.noFallback") },
  ];
  const eligibleGroups = groups.value.filter(
    (g) =>
      g.platform === "anthropic" &&
      g.status === "active" &&
      g.fallback_group_id_on_invalid_request === null,
  );
  eligibleGroups.forEach((g) => {
    options.push({ value: g.id, label: g.name });
  });
  return options;
});

// 无效请求兜底分组选项（编辑时）- 排除自身
const invalidRequestFallbackOptionsForEdit = computed(() => {
  const options: { value: number | null; label: string }[] = [
    { value: null, label: t("admin.groups.invalidRequestFallback.noFallback") },
  ];
  const currentId = editingGroup.value?.id;
  const eligibleGroups = groups.value.filter(
    (g) =>
      g.platform === "anthropic" &&
      g.status === "active" &&
      g.fallback_group_id_on_invalid_request === null &&
      g.id !== currentId,
  );
  eligibleGroups.forEach((g) => {
    options.push({ value: g.id, label: g.name });
  });
  return options;
});

const canCopyAccountsFromGroup = (targetPlatform: GroupPlatform, sourcePlatform: GroupPlatform) =>
  targetPlatform === "composite" || sourcePlatform === targetPlatform;

const copyAccountsGroupLabel = (g: AdminGroup) => {
  const count = g.account_count || 0;
  const platform = t("admin.groups.platforms." + g.platform);
  return `${g.name} - ${platform} (${t("admin.groups.accountsCount", { count })})`;
};

// 复制账号的源分组选项（创建时）- 相同平台；composite 分组可汇总各平台账号
const copyAccountsGroupOptions = computed(() => {
  const eligibleGroups = groups.value.filter(
    (g) =>
      canCopyAccountsFromGroup(createForm.platform, g.platform) &&
      (g.account_count || 0) > 0,
  );
  return eligibleGroups.map((g) => ({
    value: g.id,
    label: copyAccountsGroupLabel(g),
  }));
});

// 复制账号的源分组选项（编辑时）- 相同平台；composite 分组可汇总各平台账号，排除自身
const copyAccountsGroupOptionsForEdit = computed(() => {
  const currentId = editingGroup.value?.id;
  const eligibleGroups = groups.value.filter(
    (g) =>
      canCopyAccountsFromGroup(editForm.platform, g.platform) &&
      (g.account_count || 0) > 0 &&
      g.id !== currentId,
  );
  return eligibleGroups.map((g) => ({
    value: g.id,
    label: copyAccountsGroupLabel(g),
  }));
});

const groups = ref<AdminGroup[]>([]);
const loading = ref(false);
type GroupUsageSummary = {
  today_cost: number;
  total_cost: number;
};

const usageMap = ref<Map<number, GroupUsageSummary>>(new Map());
const usageLoading = ref(false);
const capacityMap = ref<
  Map<
    number,
    {
      concurrencyUsed: number;
      concurrencyMax: number;
      sessionsUsed: number;
      sessionsMax: number;
      rpmUsed: number;
      rpmMax: number;
    }
  >
>(new Map());
const searchQuery = ref("");
const filters = reactive({
  platform: "",
  status: "",
  is_exclusive: "",
});
const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
  pages: 0,
});
const sortState = reactive({
  sort_by: "sort_order",
  sort_order: "asc" as "asc" | "desc",
});

let abortController: AbortController | null = null;

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteDialog = ref(false);
const pendingLiveForm = ref<"create" | "edit" | null>(null);
const showUnsupportedLiveConfirm = computed(
  () => pendingLiveForm.value !== null,
);
const liveCapability = ref<{ supported: boolean; reason?: string } | null>(null);
let liveCapabilityRequest: Promise<{
  supported: boolean;
  reason?: string;
}> | null = null;
const showSortModal = ref(false);
const submitting = ref(false);
const sortSubmitting = ref(false);
const editingGroup = ref<AdminGroup | null>(null);
const deletingGroup = ref<AdminGroup | null>(null);
const deletePending = ref(false);
const duplicatingGroupIds = reactive(new Set<number>());
const showRateMultipliersModal = ref(false);
const rateMultipliersGroup = ref<AdminGroup | null>(null);
const showRPMOverridesModal = ref(false);
const rpmOverridesGroup = ref<AdminGroup | null>(null);
const sortableGroups = ref<AdminGroup[]>([]);
type ConcreteGroupPlatform = Exclude<GroupPlatform, "composite">;
type CompositeRouteFormState = {
  public_model: string;
  match_type: CompositeRouteMatchType;
  target_platform: ConcreteGroupPlatform;
  upstream_model: string;
  endpoint: CompositeRouteEndpoint;
  priority: number;
  enabled: boolean;
  notes: string;
};

const showCompositeRoutesModal = ref(false);
const compositeRoutesGroup = ref<AdminGroup | null>(null);
const compositeRoutes = ref<CompositeModelRoute[]>([]);
const compositeRoutesLoading = ref(false);
const compositeRouteColumns = computed<Column[]>(() => [
  { key: "public_model", label: t("admin.groups.compositeRoutes.publicModel") },
  { key: "target", label: t("admin.groups.compositeRoutes.target") },
  { key: "scope", label: t("admin.groups.compositeRoutes.scope") },
  { key: "actions", label: t("admin.groups.columns.actions") },
]);
const compositeRouteSaving = ref(false);
const compositeRouteEditingId = ref<number | null>(null);
const compositeRoutePendingDelete = ref<CompositeModelRoute | null>(null);
const compositeRouteDeleting = ref(false);
let compositeRoutesRequestId = 0;
let compositeRouteDeleteRequestId = 0;
let compositeRouteMutationRequestId = 0;
let compositePreviewRequestId = 0;
const compositePreviewModel = ref("");
const compositePreviewEndpoint = ref<CompositeRouteEndpoint>("any");
const compositePreviewLoading = ref(false);
const compositePreviewDecision = ref<CompositeRouteDecision | null>(null);
const compositeRouteForm = reactive<CompositeRouteFormState>({
  public_model: "",
  match_type: "exact",
  target_platform: "openai",
  upstream_model: "",
  endpoint: "any",
  priority: 100,
  enabled: true,
  notes: "",
});
const createMessagesDispatchDefaults = createDefaultMessagesDispatchFormState();
const editMessagesDispatchDefaults = createDefaultMessagesDispatchFormState();
const createModelsListState = reactive(createInitialModelsListState());
const editModelsListState = reactive(createInitialModelsListState());
const createModelsListLoading = ref(false);
const editModelsListLoading = ref(false);
type ReasoningEffortPolicyFieldsExpose = {
  validate: () => boolean;
  resetValidation: () => void;
};
const createReasoningEffortPolicyRef = ref<ReasoningEffortPolicyFieldsExpose | null>(null);
const editReasoningEffortPolicyRef = ref<ReasoningEffortPolicyFieldsExpose | null>(null);
const modelsListCandidatesTracker = createModelsListCandidatesTracker();
const createForm = reactive({
  name: "",
  description: "",
  platform: "anthropic" as GroupPlatform,
  rate_multiplier: 1.0,
  is_exclusive: false,
  long_context_pricing_enabled: true,
  model_pricing: [] as PricingFormEntry[],
  // 图片生成计费配置
  allow_image_generation: false,
  allow_batch_image_generation: false,
  image_rate_independent: false,
  image_rate_multiplier: 1,
  batch_image_discount_multiplier: 0.5,
  batch_image_hold_multiplier: 0.6,
  image_price_1k: null as number | null,
  image_price_2k: null as number | null,
  image_price_4k: null as number | null,
  // 视频生成计费配置（仅 Grok 平台）
  video_rate_independent: false,
  video_rate_multiplier: 1,
  video_price_480p: null as number | null,
  video_price_720p: null as number | null,
  video_price_1080p: null as number | null,
  video_model_prices: createVideoModelPricesForm(),
  search_price_per_1k: null as number | null,
  audio_realtime_price_per_min: null as number | null,
  audio_tts_price_per_million_chars: null as number | null,
  audio_stt_price_per_hour: null as number | null,
  // Codex 网页搜索按次计费（仅 openai 平台使用）；null = 使用默认价 0.01
  web_search_price_per_call: null as number | null,
  // 高峰时段倍率配置
  peak_rate_enabled: false,
  peak_start: "",
  peak_end: "",
  peak_rate_multiplier: 1.0,
  // 分组利润控制（五个 token 平台）；界面按百分比输入，提交时转小数
  profit_control_enabled: false,
  profit_min_margin_percent: 0,
  profit_safety_buffer_percent: 0,
  // Claude Code 客户端限制（仅 anthropic 平台使用）
  claude_code_only: false,
  fallback_group_id: null as number | null,
  fallback_group_id_on_invalid_request: null as number | null,
  // OpenAI Messages 调度配置（仅 openai 平台使用）
  allow_messages_dispatch: false,
  allow_live: false,
  opus_mapped_model: createMessagesDispatchDefaults.opus_mapped_model,
  sonnet_mapped_model: createMessagesDispatchDefaults.sonnet_mapped_model,
  haiku_mapped_model: createMessagesDispatchDefaults.haiku_mapped_model,
  exact_model_mappings: [] as MessagesDispatchMappingRow[],
  // 账号过滤控制（OpenAI/Antigravity 平台）
  require_oauth_only: false,
  require_privacy_set: false,
  // 模型路由开关
  model_routing_enabled: false,
  // 支持的模型系列（仅 antigravity 平台）
  supported_model_scopes: ["claude", "gemini_text", "gemini_image"] as string[],
  // MCP XML 协议注入开关（仅 antigravity 平台）
  mcp_xml_inject: true,
  // 从分组复制账号
  copy_accounts_from_group_ids: [] as number[],
  // 分组级 RPM 限制（每用户每分钟最大请求数；0 = 不限制）
  rpm_limit: 0 as number,
  max_reasoning_effort: "",
  reasoning_effort_mappings: [] as ReasoningEffortMappingRow[],
});

// 创建表单的模型路由规则
const createModelRoutingRules = ref<ModelRoutingRule[]>([]);

// 编辑表单的模型路由规则
const editModelRoutingRules = ref<ModelRoutingRule[]>([]);

// 规则对象稳定 key（避免使用 index 导致状态错位）
const resolveCreateRuleKey =
  createStableObjectKeyResolver<ModelRoutingRule>("create-rule");
const resolveEditRuleKey =
  createStableObjectKeyResolver<ModelRoutingRule>("edit-rule");
const resolveCreateMessagesDispatchRowKey =
  createStableObjectKeyResolver<MessagesDispatchMappingRow>(
    "create-messages-dispatch-row",
  );
const resolveEditMessagesDispatchRowKey =
  createStableObjectKeyResolver<MessagesDispatchMappingRow>(
    "edit-messages-dispatch-row",
  );

const getCreateRuleRenderKey = (rule: ModelRoutingRule) =>
  resolveCreateRuleKey(rule);
const getEditRuleRenderKey = (rule: ModelRoutingRule) =>
  resolveEditRuleKey(rule);
const getCreateMessagesDispatchRowKey = (row: MessagesDispatchMappingRow) =>
  resolveCreateMessagesDispatchRowKey(row);
const getEditMessagesDispatchRowKey = (row: MessagesDispatchMappingRow) =>
  resolveEditMessagesDispatchRowKey(row);

const getCreateRuleSearchKey = (rule: ModelRoutingRule) =>
  `create-${resolveCreateRuleKey(rule)}`;
const getEditRuleSearchKey = (rule: ModelRoutingRule) =>
  `edit-${resolveEditRuleKey(rule)}`;

const getRuleSearchKey = (rule: ModelRoutingRule, isEdit: boolean = false) => {
  return isEdit ? getEditRuleSearchKey(rule) : getCreateRuleSearchKey(rule);
};

// 账号搜索相关状态
const accountSearchKeyword = ref<Record<string, string>>({});
const accountSearchResults = ref<Record<string, SimpleAccount[]>>({});

const clearAccountSearchStateByKey = (key: string) => {
  delete accountSearchKeyword.value[key];
  delete accountSearchResults.value[key];
};

const clearAllAccountSearchState = () => {
  accountSearchKeyword.value = {};
  accountSearchResults.value = {};
};

const accountSearchRunner = useKeyedDebouncedSearch<SimpleAccount[]>({
  delay: 300,
  search: async (keyword, { signal }) => {
    const res = await adminAPI.accounts.list(
      1,
      20,
      {
        search: keyword,
        platform: "anthropic",
      },
      { signal },
    );
    return res.items.map((account) => ({ id: account.id, name: account.name }));
  },
  onSuccess: (key, result) => {
    accountSearchResults.value[key] = result;
  },
  onError: (key) => {
    accountSearchResults.value[key] = [];
  },
});

// 搜索账号（仅限 anthropic 平台）
const searchAccounts = (key: string) => {
  accountSearchRunner.trigger(key, accountSearchKeyword.value[key] || "");
};

const searchAccountsByRule = (
  rule: ModelRoutingRule,
  isEdit: boolean = false,
  keyword: string = "",
) => {
  const key = getRuleSearchKey(rule, isEdit);
  accountSearchKeyword.value[key] = keyword;
  searchAccounts(key);
};

const accountPickerOptions = (
  rule: ModelRoutingRule,
  isEdit: boolean,
): UiEntityOption[] => {
  const selected = new Set(rule.accounts.map((account) => account.id));
  return (accountSearchResults.value[getRuleSearchKey(rule, isEdit)] || [])
    .filter((account) => !selected.has(account.id))
    .map((account) => ({
      value: account.id,
      label: account.name,
      description: `#${account.id}`,
    }));
};

const createAccountPickerOptions = (rule: ModelRoutingRule) =>
  accountPickerOptions(rule, false);
const editAccountPickerOptions = (rule: ModelRoutingRule) =>
  accountPickerOptions(rule, true);

const searchCreateRoutingAccounts = (
  rule: ModelRoutingRule,
  query: string,
) => searchAccountsByRule(rule, false, query);
const searchEditRoutingAccounts = (
  rule: ModelRoutingRule,
  query: string,
) => searchAccountsByRule(rule, true, query);

// 选择账号
const selectAccount = (
  rule: ModelRoutingRule,
  account: SimpleAccount,
  isEdit: boolean = false,
) => {
  if (!rule) return;

  // 检查是否已选择
  if (!rule.accounts.some((a) => a.id === account.id)) {
    rule.accounts.push(account);
  }

  // 清空搜索
  const key = getRuleSearchKey(rule, isEdit);
  accountSearchKeyword.value[key] = "";
};

const selectAccountOption = (
  rule: ModelRoutingRule,
  option: UiEntityOption,
  isEdit: boolean,
) => {
  selectAccount(
    rule,
    { id: Number(option.value), name: option.label },
    isEdit,
  );
};

const selectCreateRoutingAccount = (
  rule: ModelRoutingRule,
  option: UiEntityOption,
) => selectAccountOption(rule, option, false);
const selectEditRoutingAccount = (
  rule: ModelRoutingRule,
  option: UiEntityOption,
) => selectAccountOption(rule, option, true);

// 移除已选账号
const removeSelectedAccount = (
  rule: ModelRoutingRule,
  accountId: number,
  _isEdit: boolean = false,
) => {
  if (!rule) return;

  rule.accounts = rule.accounts.filter((a) => a.id !== accountId);
};

// 添加创建表单的路由规则
const addCreateRoutingRule = () => {
  createModelRoutingRules.value.push({ pattern: "", accounts: [] });
};

// 删除创建表单的路由规则
const removeCreateRoutingRule = (rule: ModelRoutingRule) => {
  const index = createModelRoutingRules.value.indexOf(rule);
  if (index === -1) return;

  const key = getCreateRuleSearchKey(rule);
  accountSearchRunner.clearKey(key);
  clearAccountSearchStateByKey(key);
  createModelRoutingRules.value.splice(index, 1);
};

// 添加编辑表单的路由规则
const addEditRoutingRule = () => {
  editModelRoutingRules.value.push({ pattern: "", accounts: [] });
};

// 删除编辑表单的路由规则
const removeEditRoutingRule = (rule: ModelRoutingRule) => {
  const index = editModelRoutingRules.value.indexOf(rule);
  if (index === -1) return;

  const key = getEditRuleSearchKey(rule);
  accountSearchRunner.clearKey(key);
  clearAccountSearchStateByKey(key);
  editModelRoutingRules.value.splice(index, 1);
};

const resetModelsListState = (
  state: typeof createModelsListState,
  config?: Parameters<typeof createInitialModelsListState>[0],
) => {
  const fresh = createInitialModelsListState(config);
  state.enabled = fresh.enabled;
  state.savedModels = fresh.savedModels;
  state.items = fresh.items;
};

const applyModelsListState = (
  target: ModelsListState,
  source: ModelsListState,
) => {
  target.enabled = source.enabled;
  target.savedModels = [...source.savedModels];
  target.items = source.items.map((item) => ({ ...item }));
};

const loadModelsListCandidates = async (
  mode: "create" | "edit",
  groupID: number,
  platform: GroupPlatform,
) => {
  const request = { mode, groupID, platform };
  const requestID = modelsListCandidatesTracker.next(request);
  const state = mode === "create" ? createModelsListState : editModelsListState;
  const loadingRef = mode === "create" ? createModelsListLoading : editModelsListLoading;
  loadingRef.value = true;
  try {
    const models = await adminAPI.groups.getModelsListCandidates(groupID, platform);
    if (!modelsListCandidatesTracker.isCurrent(requestID, request)) {
      return;
    }
    setModelsListCandidates(state, models);
  } catch (error) {
    if (!modelsListCandidatesTracker.isCurrent(requestID, request)) {
      return;
    }
    console.error("Error loading group models list candidates:", error);
  } finally {
    if (modelsListCandidatesTracker.isCurrent(requestID, request)) {
      loadingRef.value = false;
    }
  }
};

// 将 UI 格式的路由规则转换为 API 格式
const convertRoutingRulesToApiFormat = (
  rules: ModelRoutingRule[],
): Record<string, number[]> | null => {
  const result: Record<string, number[]> = {};
  let hasValidRules = false;

  for (const rule of rules) {
    const pattern = rule.pattern.trim();
    if (!pattern) continue;

    const accountIds = rule.accounts.map((a) => a.id).filter((id) => id > 0);

    if (accountIds.length > 0) {
      result[pattern] = accountIds;
      hasValidRules = true;
    }
  }

  return hasValidRules ? result : null;
};

// 将 API 格式的路由规则转换为 UI 格式（需要加载账号名称）
const convertApiFormatToRoutingRules = async (
  apiFormat: Record<string, number[]> | null,
): Promise<ModelRoutingRule[]> => {
  if (!apiFormat) return [];

  const rules: ModelRoutingRule[] = [];
  for (const [pattern, accountIds] of Object.entries(apiFormat)) {
    // 加载账号信息
    const accounts: SimpleAccount[] = [];
    for (const id of accountIds) {
      try {
        const account = await adminAPI.accounts.getById(id);
        accounts.push({ id: account.id, name: account.name });
      } catch {
        // 如果账号不存在，仍然显示 ID
        accounts.push({ id, name: `#${id}` });
      }
    }
    rules.push({ pattern, accounts });
  }
  return rules;
};

const editForm = reactive({
  name: "",
  description: "",
  platform: "anthropic" as GroupPlatform,
  rate_multiplier: 1.0,
  is_exclusive: false,
  status: "active" as "active" | "inactive",
  long_context_pricing_enabled: true,
  model_pricing: [] as PricingFormEntry[],
  // 图片生成计费配置
  allow_image_generation: false,
  allow_batch_image_generation: false,
  image_rate_independent: false,
  image_rate_multiplier: 1,
  batch_image_discount_multiplier: 0.5,
  batch_image_hold_multiplier: 0.6,
  image_price_1k: null as number | null,
  image_price_2k: null as number | null,
  image_price_4k: null as number | null,
  // 视频生成计费配置（仅 Grok 平台）
  video_rate_independent: false,
  video_rate_multiplier: 1,
  video_price_480p: null as number | null,
  video_price_720p: null as number | null,
  video_price_1080p: null as number | null,
  video_model_prices: createVideoModelPricesForm(),
  search_price_per_1k: null as number | null,
  audio_realtime_price_per_min: null as number | null,
  audio_tts_price_per_million_chars: null as number | null,
  audio_stt_price_per_hour: null as number | null,
  // Codex 网页搜索按次计费（仅 openai 平台使用）；null = 使用默认价 0.01
  web_search_price_per_call: null as number | null,
  // 高峰时段倍率配置
  peak_rate_enabled: false,
  peak_start: "",
  peak_end: "",
  peak_rate_multiplier: 1.0,
  // 分组利润控制（五个 token 平台）；界面按百分比输入，提交时转小数
  profit_control_enabled: false,
  profit_min_margin_percent: 0,
  profit_safety_buffer_percent: 0,
  // Claude Code 客户端限制（仅 anthropic 平台使用）
  claude_code_only: false,
  fallback_group_id: null as number | null,
  fallback_group_id_on_invalid_request: null as number | null,
  // OpenAI Messages 调度配置（仅 openai 平台使用）
  allow_messages_dispatch: false,
  allow_live: false,
  default_mapped_model: '',
  opus_mapped_model: editMessagesDispatchDefaults.opus_mapped_model,
  sonnet_mapped_model: editMessagesDispatchDefaults.sonnet_mapped_model,
  haiku_mapped_model: editMessagesDispatchDefaults.haiku_mapped_model,
  exact_model_mappings: [] as MessagesDispatchMappingRow[],
  // 账号过滤控制（OpenAI/Antigravity 平台）
  require_oauth_only: false,
  require_privacy_set: false,
  // 模型路由开关
  model_routing_enabled: false,
  // 支持的模型系列（仅 antigravity 平台）
  supported_model_scopes: ["claude", "gemini_text", "gemini_image"] as string[],
  // MCP XML 协议注入开关（仅 antigravity 平台）
  mcp_xml_inject: true,
  // 从分组复制账号
  copy_accounts_from_group_ids: [] as number[],
  // 分组级 RPM 限制（每用户每分钟最大请求数；0 = 不限制）
  rpm_limit: 0 as number,
  max_reasoning_effort: "",
  reasoning_effort_mappings: [] as ReasoningEffortMappingRow[],
});

type ImagePricingFormState = {
  platform: GroupPlatform;
  allow_image_generation: boolean;
  allow_batch_image_generation: boolean;
  rate_multiplier: number;
  image_rate_independent: boolean;
  image_rate_multiplier: number;
  batch_image_discount_multiplier: number;
  batch_image_hold_multiplier: number;
  image_price_1k: number | string | null;
  image_price_2k: number | string | null;
  image_price_4k: number | string | null;
  peak_rate_enabled: boolean;
  peak_start: string;
  peak_end: string;
  peak_rate_multiplier: number;
};

type VideoPricingFormState = {
  platform: GroupPlatform;
  rate_multiplier: number;
  video_rate_independent: boolean;
  video_rate_multiplier: number;
  video_price_480p: number | string | null;
  video_price_720p: number | string | null;
  video_price_1080p: number | string | null;
};

const imagePricingTiers = [
  { key: "image_price_1k", label: "1K" },
  { key: "image_price_2k", label: "2K" },
  { key: "image_price_4k", label: "4K" },
] as const;

const videoPricingTiers = [
  { key: "video_price_480p", label: "480p" },
  { key: "video_price_720p", label: "720p" },
  { key: "video_price_1080p", label: "1080p" },
] as const;

const normalizePreviewNumber = (value: number | string | null | undefined, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePreviewPrice = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const formatImagePricePreview = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return t("admin.groups.imagePricing.notConfigured");
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    return t("admin.groups.imagePricing.notConfigured");
  }
  return `$${price.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
};

const formatVideoPricePreview = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return t("admin.groups.videoPricing.notConfigured");
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    return t("admin.groups.videoPricing.notConfigured");
  }
  return `$${price.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
};

const buildImageFinalPricePreview = (form: ImagePricingFormState) => {
  const imageMultiplier = form.image_rate_independent
    ? normalizePreviewNumber(form.image_rate_multiplier, 1)
    : normalizePreviewNumber(form.rate_multiplier, 1);
  const multiplier = imageMultiplier;
  return imagePricingTiers.map((tier) => {
    const basePrice =
      parsePreviewPrice(form[tier.key]) ??
      getDefaultImagePreviewPrice(form.platform, tier.key);
    return {
      label: tier.label,
      value: basePrice !== null
        ? formatImagePricePreview(basePrice * multiplier)
        : t("admin.groups.imagePricing.notConfigured"),
    };
  });
};

const buildVideoFinalPricePreview = (form: VideoPricingFormState) => {
  const multiplier = form.video_rate_independent
    ? normalizePreviewNumber(form.video_rate_multiplier, 1)
    : normalizePreviewNumber(form.rate_multiplier, 1);
  return videoPricingTiers.map((tier) => {
    const basePrice =
      parsePreviewPrice(form[tier.key]) ??
      getDefaultVideoPreviewPrice(form.platform, tier.key);
    return {
      label: tier.label,
      value: basePrice !== null
        ? formatVideoPricePreview(basePrice * multiplier)
        : t("admin.groups.videoPricing.notConfigured"),
    };
  });
};

const createImageFinalPricePreview = computed(() =>
  buildImageFinalPricePreview(createForm),
);
const editImageFinalPricePreview = computed(() =>
  buildImageFinalPricePreview(editForm),
);
const createVideoFinalPricePreview = computed(() =>
  buildVideoFinalPricePreview(createForm),
);
const editVideoFinalPricePreview = computed(() =>
  buildVideoFinalPricePreview(editForm),
);

// Codex 网页搜索单次默认价（与后端 defaultWebSearchPricePerCall 一致，官方 $10/1000 次）
const DEFAULT_WEB_SEARCH_PRICE_PER_CALL = 0.01;

const buildWebSearchFinalPricePreview = (form: {
  web_search_price_per_call: number | string | null;
  rate_multiplier: number | string | null;
}) => {
  const basePrice =
    parsePreviewPrice(form.web_search_price_per_call) ??
    DEFAULT_WEB_SEARCH_PRICE_PER_CALL;
  const multiplier = normalizePreviewNumber(form.rate_multiplier, 1);
  return formatImagePricePreview(basePrice * multiplier);
};

const createWebSearchFinalPricePreview = computed(() =>
  buildWebSearchFinalPricePreview(createForm),
);
const editWebSearchFinalPricePreview = computed(() =>
  buildWebSearchFinalPricePreview(editForm),
);

const resetDisabledBatchImagePricing = (
  form: Pick<
    ImagePricingFormState,
    "platform" | "allow_image_generation" | "allow_batch_image_generation" | "batch_image_discount_multiplier" | "batch_image_hold_multiplier"
  >,
) => {
  if (form.platform !== "gemini" || !form.allow_image_generation) {
    form.allow_batch_image_generation = false;
  }
  if (!form.allow_batch_image_generation) {
    form.batch_image_discount_multiplier = 0.5;
    form.batch_image_hold_multiplier = 0.6;
  }
};

const deleteConfirmMessage = computed(() => {
  if (!deletingGroup.value) {
    return "";
  }
  return t("admin.groups.deleteConfirm", { name: deletingGroup.value.name });
});

const loadLiveCapability = async () => {
  if (liveCapability.value) return liveCapability.value;
  if (!liveCapabilityRequest) {
    liveCapabilityRequest = adminAPI.groups
      .getLiveCapability()
      .catch(() => ({ supported: false }))
      .finally(() => {
        liveCapabilityRequest = null;
      });
  }
  liveCapability.value = await liveCapabilityRequest;
  return liveCapability.value ?? { supported: false };
};

const toggleLive = async (target: "create" | "edit") => {
  const form = target === "create" ? createForm : editForm;
  if (form.allow_live) {
    form.allow_live = false;
    return;
  }
  const capability = await loadLiveCapability();
  if (capability.supported) {
    form.allow_live = true;
    return;
  }
  pendingLiveForm.value = target;
};

const confirmUnsupportedLive = () => {
  if (pendingLiveForm.value === "create") createForm.allow_live = true;
  if (pendingLiveForm.value === "edit") editForm.allow_live = true;
  pendingLiveForm.value = null;
};

const cancelUnsupportedLive = () => {
  pendingLiveForm.value = null;
};

const loadGroups = async () => {
  if (abortController) {
    abortController.abort();
  }
  const currentController = new AbortController();
  abortController = currentController;
  const { signal } = currentController;
  loading.value = true;
  try {
    const response = await adminAPI.groups.list(
      pagination.page,
      pagination.page_size,
      {
        platform: (filters.platform as GroupPlatform) || undefined,
        status: filters.status as any,
        is_exclusive: filters.is_exclusive
          ? filters.is_exclusive === "true"
          : undefined,
        search: searchQuery.value.trim() || undefined,
        sort_by: sortState.sort_by,
        sort_order: sortState.sort_order,
      },
      { signal },
    );
    if (signal.aborted) return;
    groups.value = response.items;
    pagination.total = response.total;
    pagination.pages = response.pages;
    if (hasVisibleUsageSummaryConsumer.value) {
      loadUsageSummary();
    } else {
      usageLoading.value = false;
    }
    if (hasVisibleCapacityColumn.value) {
      loadCapacitySummary();
    }
  } catch (error: any) {
    if (
      signal.aborted ||
      error?.name === "AbortError" ||
      error?.code === "ERR_CANCELED"
    ) {
      return;
    }
    appStore.showError(t("admin.groups.failedToLoad"));
    console.error("Error loading groups:", error);
  } finally {
    if (abortController === currentController && !signal.aborted) {
      loading.value = false;
    }
  }
};

const loadUsageSummary = async () => {
  if (!hasVisibleUsageSummaryConsumer.value) {
    usageLoading.value = false;
    return;
  }
  usageLoading.value = true;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const data = await adminAPI.groups.getUsageSummary(tz);
    const map = new Map<number, GroupUsageSummary>();
    for (const item of data) {
      map.set(item.group_id, {
        today_cost: item.today_cost,
        total_cost: item.total_cost,
      });
    }
    usageMap.value = map;
  } catch (error) {
    console.error("Error loading group usage summary:", error);
  } finally {
    usageLoading.value = false;
  }
};

const loadCapacitySummary = async () => {
  if (!hasVisibleCapacityColumn.value) {
    return;
  }
  try {
    const data = await adminAPI.groups.getCapacitySummary();
    const map = new Map<
      number,
      {
        concurrencyUsed: number;
        concurrencyMax: number;
        sessionsUsed: number;
        sessionsMax: number;
        rpmUsed: number;
        rpmMax: number;
      }
    >();
    for (const item of data) {
      map.set(item.group_id, {
        concurrencyUsed: item.concurrency_used,
        concurrencyMax: item.concurrency_max,
        sessionsUsed: item.sessions_used,
        sessionsMax: item.sessions_max,
        rpmUsed: item.rpm_used,
        rpmMax: item.rpm_max,
      });
    }
    capacityMap.value = map;
  } catch (error) {
    console.error("Error loading group capacity summary:", error);
  }
};

let searchTimeout: ReturnType<typeof setTimeout>;
const handleSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    pagination.page = 1;
    loadGroups();
  }, 300);
};

const handlePageChange = (page: number) => {
  pagination.page = page;
  loadGroups();
};

const handlePageSizeChange = (pageSize: number) => {
  pagination.page_size = pageSize;
  pagination.page = 1;
  loadGroups();
};

const handleSort = (key: string, order: 'asc' | 'desc') => {
  sortState.sort_by = key;
  sortState.sort_order = order;
  pagination.page = 1;
  loadGroups();
};

const openCreateModal = () => {
  showCreateModal.value = true;
  loadModelsListCandidates("create", 0, createForm.platform);
};

const closeCreateModal = () => {
  showCreateModal.value = false;
  createModelRoutingRules.value.forEach((rule) => {
    accountSearchRunner.clearKey(getCreateRuleSearchKey(rule));
  });
  clearAllAccountSearchState();
  createForm.name = "";
  createForm.description = "";
  createForm.platform = "anthropic";
  createForm.rate_multiplier = 1.0;
  createForm.is_exclusive = false;
  createForm.long_context_pricing_enabled = true;
  createForm.model_pricing = [];
  createForm.allow_image_generation = false;
  createForm.allow_batch_image_generation = false;
  createForm.image_rate_independent = false;
  createForm.image_rate_multiplier = 1;
  createForm.batch_image_discount_multiplier = 0.5;
  createForm.batch_image_hold_multiplier = 0.6;
  createForm.image_price_1k = null;
  createForm.image_price_2k = null;
  createForm.image_price_4k = null;
  createForm.video_rate_independent = false;
  createForm.video_rate_multiplier = 1;
  createForm.video_price_480p = null;
  createForm.video_price_720p = null;
  createForm.video_price_1080p = null;
  createForm.video_model_prices = createVideoModelPricesForm();
  createForm.search_price_per_1k = null;
  createForm.audio_realtime_price_per_min = null;
  createForm.audio_tts_price_per_million_chars = null;
  createForm.audio_stt_price_per_hour = null;
  createForm.web_search_price_per_call = null;
  createForm.peak_rate_enabled = false;
  createForm.peak_start = "";
  createForm.peak_end = "";
  createForm.peak_rate_multiplier = 1.0;
  createForm.profit_control_enabled = false;
  createForm.profit_min_margin_percent = 0;
  createForm.profit_safety_buffer_percent = 0;
  createForm.claude_code_only = false;
  createForm.fallback_group_id = null;
  createForm.fallback_group_id_on_invalid_request = null;
  resetMessagesDispatchFormState(createForm);
  createForm.allow_live = false;
  createForm.require_oauth_only = false;
  createForm.require_privacy_set = false;
  createForm.supported_model_scopes = ["claude", "gemini_text", "gemini_image"];
  createForm.mcp_xml_inject = true;
  createForm.copy_accounts_from_group_ids = [];
  createForm.rpm_limit = 0;
  createForm.max_reasoning_effort = "";
  createForm.reasoning_effort_mappings = [];
  createReasoningEffortPolicyRef.value?.resetValidation();
  resetModelsListState(createModelsListState);
  createModelRoutingRules.value = [];
};

const normalizeRateMultiplier = (
  value: number | string | null | undefined,
): number => {
  if (value === null || value === undefined || value === "") {
    return 1;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
};

// 利润控制表单辅助（换算与校验逻辑见 groupsProfitControl.ts，便于单测）。
const percentToDecimal = profitPercentToDecimal;
const decimalToPercent = profitDecimalToPercent;

const validateProfitControlForm = (form: ProfitControlFormState): boolean => {
  const errorKey = validateProfitControlFormState(form);
  if (errorKey) {
    appStore.showError(t(`admin.groups.profitControl.${errorKey}`));
    return false;
  }
  return true;
};

const handleCreateGroup = async () => {
  if (submitting.value) return;
  if (!createForm.name.trim()) {
    appStore.showError(t("admin.groups.nameRequired"));
    return;
  }
  if (
    supportsReasoningEffortPolicyPlatform(createForm.platform) &&
    createReasoningEffortPolicyRef.value &&
    !createReasoningEffortPolicyRef.value.validate()
  ) {
    return;
  }
  if (!validateProfitControlForm(createForm)) {
    return;
  }
  submitting.value = true;
  try {
    // 构建请求数据，包含模型路由配置
    const requestData = {
      ...createForm,
      subscription_type: "standard" as const,
      daily_limit_usd: null,
      weekly_limit_usd: null,
      monthly_limit_usd: null,
      model_pricing: groupPricingToAPI(
        createForm.model_pricing,
        createForm.platform,
      ),
      video_model_prices: serializeVideoModelPrices(
        createForm.video_model_prices,
      ),
      model_routing: convertRoutingRulesToApiFormat(
        createModelRoutingRules.value,
      ),
      models_list_config: buildModelsListConfig(createModelsListState),
      supported_model_scopes: normalizeSupportedModelScopesForPlatform(
        createForm.platform,
        createForm.supported_model_scopes,
      ),
      messages_dispatch_model_config:
        createForm.platform === "openai"
          ? messagesDispatchFormStateToConfig({
              allow_messages_dispatch: createForm.allow_messages_dispatch,
              opus_mapped_model: createForm.opus_mapped_model,
              sonnet_mapped_model: createForm.sonnet_mapped_model,
              haiku_mapped_model: createForm.haiku_mapped_model,
              exact_model_mappings: createForm.exact_model_mappings,
            })
          : undefined,
      reasoning_effort_mappings: reasoningEffortMappingsToAPI(
        createForm.reasoning_effort_mappings,
      ),
      // 利润控制：界面百分比转小数提交；仅五个 token 平台可启用
      profit_control_enabled:
        isProfitControlPlatform(createForm.platform) &&
        createForm.profit_control_enabled,
      profit_min_margin: percentToDecimal(createForm.profit_min_margin_percent),
      profit_safety_buffer: percentToDecimal(
        createForm.profit_safety_buffer_percent,
      ),
    };
    delete (requestData as Record<string, unknown>).profit_min_margin_percent;
    delete (requestData as Record<string, unknown>).profit_safety_buffer_percent;
    // v-model.number 清空输入框时产生 ""，转为 null 让后端设为无限制
    const emptyToNull = (v: any) => (v === "" ? null : v);
    requestData.image_rate_multiplier = normalizeRateMultiplier(
      requestData.image_rate_multiplier,
    );
    resetDisabledBatchImagePricing(requestData);
    requestData.batch_image_discount_multiplier = normalizeRateMultiplier(
      requestData.batch_image_discount_multiplier,
    );
    requestData.batch_image_hold_multiplier = normalizeRateMultiplier(
      requestData.batch_image_hold_multiplier,
    );
    requestData.video_rate_multiplier = normalizeRateMultiplier(
      requestData.video_rate_multiplier,
    );
    // 媒体价格输入清空时 v-model.number 产生 ""，直接提交会被后端 *float64 反序列化拒绝（400），
    // 创建时按"未配置"（null）处理。
    requestData.image_price_1k = emptyToNull(requestData.image_price_1k);
    requestData.image_price_2k = emptyToNull(requestData.image_price_2k);
    requestData.image_price_4k = emptyToNull(requestData.image_price_4k);
    requestData.video_price_480p = emptyToNull(requestData.video_price_480p);
    requestData.video_price_720p = emptyToNull(requestData.video_price_720p);
    requestData.video_price_1080p = emptyToNull(requestData.video_price_1080p);
    requestData.web_search_price_per_call = emptyToNull(
      requestData.web_search_price_per_call,
    );
    requestData.search_price_per_1k = emptyToNull(requestData.search_price_per_1k);
    requestData.audio_realtime_price_per_min = emptyToNull(requestData.audio_realtime_price_per_min);
    requestData.audio_tts_price_per_million_chars = emptyToNull(requestData.audio_tts_price_per_million_chars);
    requestData.audio_stt_price_per_hour = emptyToNull(requestData.audio_stt_price_per_hour);
    requestData.peak_rate_enabled = createForm.peak_rate_enabled;
    requestData.peak_start = createForm.peak_start;
    requestData.peak_end = createForm.peak_end;
    requestData.peak_rate_multiplier = normalizeRateMultiplier(
      createForm.peak_rate_multiplier,
    );
    await adminAPI.groups.create(requestData);
    appStore.showSuccess(t("admin.groups.groupCreated"));
    closeCreateModal();
    loadGroups();
  } catch (error: any) {
    appStore.showError(
      error.response?.data?.detail || t("admin.groups.failedToCreate"),
    );
    console.error("Error creating group:", error);
    // Don't advance tour on error
  } finally {
    submitting.value = false;
  }
};

const handleEdit = async (group: AdminGroup) => {
  editingGroup.value = group;
  editForm.name = group.name;
  editForm.description = group.description || "";
  editForm.platform = group.platform;
  editForm.rate_multiplier = group.rate_multiplier;
  editForm.is_exclusive = group.is_exclusive;
  editForm.status = group.status;
  editForm.long_context_pricing_enabled =
    group.long_context_pricing_enabled ?? true;
  editForm.model_pricing = groupPricingFromAPI(group.model_pricing);
  editForm.allow_image_generation = group.allow_image_generation ?? false;
  editForm.allow_batch_image_generation =
    group.allow_batch_image_generation ?? false;
  editForm.image_rate_independent = group.image_rate_independent ?? false;
  editForm.image_rate_multiplier = group.image_rate_multiplier ?? 1;
  editForm.batch_image_discount_multiplier =
    group.batch_image_discount_multiplier ?? 0.5;
  editForm.batch_image_hold_multiplier = group.batch_image_hold_multiplier ?? 0.6;
  editForm.image_price_1k = group.image_price_1k;
  editForm.image_price_2k = group.image_price_2k;
  editForm.image_price_4k = group.image_price_4k;
  editForm.video_rate_independent = group.video_rate_independent ?? false;
  editForm.video_rate_multiplier = group.video_rate_multiplier ?? 1;
  editForm.video_price_480p = group.video_price_480p;
  editForm.video_price_720p = group.video_price_720p;
  editForm.video_price_1080p = group.video_price_1080p;
  editForm.video_model_prices = createVideoModelPricesForm(group.video_model_prices);
  editForm.search_price_per_1k = group.search_price_per_1k ?? null;
  editForm.audio_realtime_price_per_min = group.audio_realtime_price_per_min ?? null;
  editForm.audio_tts_price_per_million_chars = group.audio_tts_price_per_million_chars ?? null;
  editForm.audio_stt_price_per_hour = group.audio_stt_price_per_hour ?? null;
  editForm.web_search_price_per_call = group.web_search_price_per_call ?? null;
  editForm.peak_rate_enabled = group.peak_rate_enabled ?? false;
  editForm.peak_start = group.peak_start ?? "";
  editForm.peak_end = group.peak_end ?? "";
  editForm.peak_rate_multiplier = group.peak_rate_multiplier ?? 1.0;
  editForm.profit_control_enabled = group.profit_control_enabled ?? false;
  editForm.profit_min_margin_percent = decimalToPercent(
    group.profit_min_margin ?? 0,
  );
  editForm.profit_safety_buffer_percent = decimalToPercent(
    group.profit_safety_buffer ?? 0,
  );
  editForm.claude_code_only = group.claude_code_only || false;
  editForm.fallback_group_id = group.fallback_group_id;
  editForm.fallback_group_id_on_invalid_request =
    group.fallback_group_id_on_invalid_request;
  const messagesDispatchFormState = messagesDispatchConfigToFormState(
    group.messages_dispatch_model_config,
  );
  editForm.allow_messages_dispatch =
    group.allow_messages_dispatch ||
    messagesDispatchFormState.allow_messages_dispatch;
  editForm.allow_live = group.allow_live ?? false;
  editForm.opus_mapped_model = messagesDispatchFormState.opus_mapped_model;
  editForm.sonnet_mapped_model = messagesDispatchFormState.sonnet_mapped_model;
  editForm.haiku_mapped_model = messagesDispatchFormState.haiku_mapped_model;
  editForm.exact_model_mappings =
    messagesDispatchFormState.exact_model_mappings;
  editForm.require_oauth_only = group.require_oauth_only ?? false;
  editForm.require_privacy_set = group.require_privacy_set ?? false;
  editForm.model_routing_enabled = group.model_routing_enabled || false;
  editForm.supported_model_scopes = group.supported_model_scopes || [
    "claude",
    "gemini_text",
    "gemini_image",
  ];
  editForm.mcp_xml_inject = group.mcp_xml_inject ?? true;
  editForm.copy_accounts_from_group_ids = []; // 复制账号字段每次编辑时重置为空
  editForm.rpm_limit = group.rpm_limit ?? 0;
  editForm.max_reasoning_effort = normalizeReasoningEffortForPlatform(
    group.platform,
    group.max_reasoning_effort,
  );
  editForm.reasoning_effort_mappings = reasoningEffortMappingsToRows(
    group.reasoning_effort_mappings,
    group.platform,
  );
  resetModelsListState(editModelsListState, group.models_list_config);
  // 加载模型路由规则（异步加载账号名称）
  editModelRoutingRules.value = await convertApiFormatToRoutingRules(
    group.model_routing,
  );
  loadModelsListCandidates("edit", group.id, group.platform);
  showEditModal.value = true;
};

const closeEditModal = () => {
  editModelRoutingRules.value.forEach((rule) => {
    accountSearchRunner.clearKey(getEditRuleSearchKey(rule));
  });
  clearAllAccountSearchState();
  showEditModal.value = false;
  editingGroup.value = null;
  editForm.max_reasoning_effort = "";
  editForm.reasoning_effort_mappings = [];
  editReasoningEffortPolicyRef.value?.resetValidation();
  editModelRoutingRules.value = [];
  editForm.copy_accounts_from_group_ids = [];
  editForm.peak_rate_enabled = false;
  editForm.peak_start = "";
  editForm.peak_end = "";
  editForm.peak_rate_multiplier = 1.0;
  editForm.profit_control_enabled = false;
  editForm.profit_min_margin_percent = 0;
  editForm.profit_safety_buffer_percent = 0;
  editForm.video_rate_independent = false;
  editForm.video_rate_multiplier = 1;
  editForm.video_price_480p = null;
  editForm.video_price_720p = null;
  editForm.video_price_1080p = null;
  editForm.video_model_prices = createVideoModelPricesForm();
  editForm.search_price_per_1k = null;
  editForm.audio_realtime_price_per_min = null;
  editForm.audio_tts_price_per_million_chars = null;
  editForm.audio_stt_price_per_hour = null;
  editForm.long_context_pricing_enabled = true;
  editForm.model_pricing = [];
  editForm.web_search_price_per_call = null;
  resetMessagesDispatchFormState(editForm);
  editForm.allow_live = false;
  resetModelsListState(editModelsListState);
};

const handleUpdateGroup = async () => {
  if (submitting.value) return;
  if (!editingGroup.value) return;
  if (!editForm.name.trim()) {
    appStore.showError(t("admin.groups.nameRequired"));
    return;
  }
  if (
    supportsReasoningEffortPolicyPlatform(editForm.platform) &&
    editReasoningEffortPolicyRef.value &&
    !editReasoningEffortPolicyRef.value.validate()
  ) {
    return;
  }
  if (!validateProfitControlForm(editForm)) {
    return;
  }

  submitting.value = true;
  try {
    // 转换 fallback_group_id: null -> 0 (后端使用 0 表示清除)
    const payload = {
      ...editForm,
      subscription_type: "standard" as const,
      daily_limit_usd: null,
      weekly_limit_usd: null,
      monthly_limit_usd: null,
      model_pricing: groupPricingToAPI(
        editForm.model_pricing,
        editForm.platform,
      ),
      video_model_prices: serializeVideoModelPrices(
        editForm.video_model_prices,
      ),
      fallback_group_id:
        editForm.fallback_group_id === null ? 0 : editForm.fallback_group_id,
      fallback_group_id_on_invalid_request:
        editForm.fallback_group_id_on_invalid_request === null
          ? 0
          : editForm.fallback_group_id_on_invalid_request,
      model_routing: convertRoutingRulesToApiFormat(
        editModelRoutingRules.value,
      ),
      models_list_config: buildModelsListConfig(editModelsListState),
      supported_model_scopes: normalizeSupportedModelScopesForPlatform(
        editForm.platform,
        editForm.supported_model_scopes,
      ),
      messages_dispatch_model_config:
        editForm.platform === "openai"
          ? messagesDispatchFormStateToConfig({
              allow_messages_dispatch: editForm.allow_messages_dispatch,
              opus_mapped_model: editForm.opus_mapped_model,
              sonnet_mapped_model: editForm.sonnet_mapped_model,
              haiku_mapped_model: editForm.haiku_mapped_model,
              exact_model_mappings: editForm.exact_model_mappings,
            })
          : undefined,
      reasoning_effort_mappings: reasoningEffortMappingsToAPI(
        editForm.reasoning_effort_mappings,
      ),
      // 利润控制：界面百分比转小数提交；仅五个 token 平台可启用
      profit_control_enabled:
        isProfitControlPlatform(editForm.platform) &&
        editForm.profit_control_enabled,
      profit_min_margin: percentToDecimal(editForm.profit_min_margin_percent),
      profit_safety_buffer: percentToDecimal(
        editForm.profit_safety_buffer_percent,
      ),
    };
    delete (payload as Record<string, unknown>).profit_min_margin_percent;
    delete (payload as Record<string, unknown>).profit_safety_buffer_percent;
    // v-model.number 清空输入框时产生 ""，转为 null 让后端设为无限制
    const emptyToNull = (v: any) => (v === "" ? null : v);
    payload.daily_limit_usd = emptyToNull(payload.daily_limit_usd);
    payload.weekly_limit_usd = emptyToNull(payload.weekly_limit_usd);
    payload.monthly_limit_usd = emptyToNull(payload.monthly_limit_usd);
    payload.image_rate_multiplier = normalizeRateMultiplier(
      payload.image_rate_multiplier,
    );
    resetDisabledBatchImagePricing(payload);
    payload.batch_image_discount_multiplier = normalizeRateMultiplier(
      payload.batch_image_discount_multiplier,
    );
    payload.batch_image_hold_multiplier = normalizeRateMultiplier(
      payload.batch_image_hold_multiplier,
    );
    payload.video_rate_multiplier = normalizeRateMultiplier(
      payload.video_rate_multiplier,
    );
    // 媒体价格输入清空时 v-model.number 产生 ""，直接提交会被后端 *float64 反序列化拒绝（400）。
    // 更新语义中 null 表示"不修改"，因此清空后的字段发送 -1：后端 normalizePrice 将负价归一为
    // NULL，从而真正清除已配置的价格。
    const emptyPriceToClear = (v: any) => (v === "" || v === null ? -1 : v);
    payload.image_price_1k = emptyPriceToClear(payload.image_price_1k);
    payload.image_price_2k = emptyPriceToClear(payload.image_price_2k);
    payload.image_price_4k = emptyPriceToClear(payload.image_price_4k);
    payload.video_price_480p = emptyPriceToClear(payload.video_price_480p);
    payload.video_price_720p = emptyPriceToClear(payload.video_price_720p);
    payload.video_price_1080p = emptyPriceToClear(payload.video_price_1080p);
    payload.web_search_price_per_call = emptyPriceToClear(
      payload.web_search_price_per_call,
    );
    payload.search_price_per_1k = emptyPriceToClear(payload.search_price_per_1k);
    payload.audio_realtime_price_per_min = emptyPriceToClear(payload.audio_realtime_price_per_min);
    payload.audio_tts_price_per_million_chars = emptyPriceToClear(payload.audio_tts_price_per_million_chars);
    payload.audio_stt_price_per_hour = emptyPriceToClear(payload.audio_stt_price_per_hour);
    payload.peak_rate_enabled = editForm.peak_rate_enabled;
    payload.peak_start = editForm.peak_start;
    payload.peak_end = editForm.peak_end;
    payload.peak_rate_multiplier = normalizeRateMultiplier(
      editForm.peak_rate_multiplier,
    );
    await adminAPI.groups.update(editingGroup.value.id, payload);
    appStore.showSuccess(t("admin.groups.groupUpdated"));
    closeEditModal();
    loadGroups();
  } catch (error: any) {
    appStore.showError(
      error.response?.data?.detail || t("admin.groups.failedToUpdate"),
    );
    console.error("Error updating group:", error);
  } finally {
    submitting.value = false;
  }
};

const addCreateMessagesDispatchMapping = () => {
  createForm.exact_model_mappings.push({ claude_model: "", target_model: "" });
};

const removeCreateMessagesDispatchMapping = (
  row: MessagesDispatchMappingRow,
) => {
  const index = createForm.exact_model_mappings.indexOf(row);
  if (index !== -1) {
    createForm.exact_model_mappings.splice(index, 1);
  }
};

const addEditMessagesDispatchMapping = () => {
  editForm.exact_model_mappings.push({ claude_model: "", target_model: "" });
};

const removeEditMessagesDispatchMapping = (row: MessagesDispatchMappingRow) => {
  const index = editForm.exact_model_mappings.indexOf(row);
  if (index !== -1) {
    editForm.exact_model_mappings.splice(index, 1);
  }
};

const handleRateMultipliers = (group: AdminGroup) => {
  rateMultipliersGroup.value = group;
  showRateMultipliersModal.value = true;
};

const handleRPMOverrides = (group: AdminGroup) => {
  rpmOverridesGroup.value = group;
  showRPMOverridesModal.value = true;
};

const handleDuplicate = async (group: AdminGroup) => {
  if (duplicatingGroupIds.has(group.id)) return;

  duplicatingGroupIds.add(group.id);
  try {
    const duplicate = await adminAPI.groups.duplicate(group.id);
    appStore.showSuccess(
      t("admin.groups.duplicateSuccess", { name: duplicate.name }),
    );
    await loadGroups();
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(error, t("admin.groups.duplicateFailed")),
    );
  } finally {
    duplicatingGroupIds.delete(group.id);
  }
};

const compositeRouteMatchLabel = (matchType: CompositeRouteMatchType) =>
  compositeRouteMatchOptions.value.find((option) => option.value === matchType)
    ?.label || matchType;

const formatCompositeEndpoint = (endpoint: CompositeRouteEndpoint) =>
  compositeRouteEndpointOptions.value.find((option) => option.value === endpoint)
    ?.label || endpoint;

const formatCompositePlatform = (platform: string) => {
  if (!platform) return "—";
  return t(`admin.groups.platforms.${platform}`);
};

const compositeRouteSourceLabel = (source: string) => {
  if (source === "route") return t("admin.groups.compositeRoutes.sources.route");
  if (source === "detector") {
    return t("admin.groups.compositeRoutes.sources.detector");
  }
  return source || "—";
};

const compositePreviewItems = computed(() => {
  const decision = compositePreviewDecision.value;
  if (!decision) return [];
  if (!decision.matched) {
    return [
      {
        key: "reason",
        label: t("admin.groups.compositeRoutes.preview"),
        value: decision.reason || "-",
      },
    ];
  }
  return [
    {
      key: "target-platform",
      label: t("admin.groups.compositeRoutes.targetPlatform"),
      value: formatCompositePlatform(decision.target_platform),
    },
    {
      key: "upstream-model",
      label: t("admin.groups.compositeRoutes.upstreamModel"),
      value: decision.upstream_model || "-",
    },
  ];
});

const resetCompositeRouteForm = () => {
  compositeRouteEditingId.value = null;
  compositeRouteForm.public_model = "";
  compositeRouteForm.match_type = "exact";
  compositeRouteForm.target_platform = "openai";
  compositeRouteForm.upstream_model = "";
  compositeRouteForm.endpoint = "any";
  compositeRouteForm.priority = 100;
  compositeRouteForm.enabled = true;
  compositeRouteForm.notes = "";
};

const toCompositeRouteInput = (): CompositeModelRouteInput => ({
  public_model: compositeRouteForm.public_model.trim(),
  match_type: compositeRouteForm.match_type,
  target_platform: compositeRouteForm.target_platform,
  upstream_model: compositeRouteForm.upstream_model.trim(),
  endpoint: compositeRouteForm.endpoint,
  priority: Number(compositeRouteForm.priority) || 100,
  enabled: compositeRouteForm.enabled,
  notes: compositeRouteForm.notes.trim(),
});

const loadCompositeRoutes = async () => {
  const groupId = compositeRoutesGroup.value?.id;
  if (groupId == null) return;
  const requestId = ++compositeRoutesRequestId;
  compositeRoutesLoading.value = true;
  try {
    const routes = await adminAPI.groups.listCompositeRoutes(groupId);
    if (
      requestId !== compositeRoutesRequestId ||
      !showCompositeRoutesModal.value ||
      compositeRoutesGroup.value?.id !== groupId
    ) return;
    compositeRoutes.value = routes.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id - b.id;
    });
  } catch (error: any) {
    if (requestId !== compositeRoutesRequestId || compositeRoutesGroup.value?.id !== groupId) return;
    appStore.showError(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        t("admin.groups.compositeRoutes.failedToLoad"),
    );
    console.error("Error loading composite routes:", error);
  } finally {
    if (requestId === compositeRoutesRequestId) compositeRoutesLoading.value = false;
  }
};

const handleCompositeRoutes = async (group: AdminGroup) => {
  compositeRoutesRequestId += 1;
  compositeRouteMutationRequestId += 1;
  compositePreviewRequestId += 1;
  compositeRoutesGroup.value = group;
  compositePreviewModel.value = "";
  compositePreviewEndpoint.value = "any";
  compositePreviewDecision.value = null;
  compositeRouteSaving.value = false;
  compositePreviewLoading.value = false;
  resetCompositeRouteForm();
  showCompositeRoutesModal.value = true;
  await loadCompositeRoutes();
};

const closeCompositeRoutesModal = () => {
  compositeRoutesRequestId += 1;
  compositeRouteDeleteRequestId += 1;
  compositeRouteMutationRequestId += 1;
  compositePreviewRequestId += 1;
  compositeRoutesLoading.value = false;
  compositeRouteDeleting.value = false;
  compositeRouteSaving.value = false;
  compositePreviewLoading.value = false;
  showCompositeRoutesModal.value = false;
  compositeRoutesGroup.value = null;
  compositeRoutes.value = [];
  compositePreviewDecision.value = null;
  compositeRoutePendingDelete.value = null;
  resetCompositeRouteForm();
};

const editCompositeRoute = (route: CompositeModelRoute) => {
  compositeRouteEditingId.value = route.id;
  compositeRouteForm.public_model = route.public_model;
  compositeRouteForm.match_type = route.match_type;
  compositeRouteForm.target_platform = route.target_platform;
  compositeRouteForm.upstream_model = route.upstream_model;
  compositeRouteForm.endpoint = route.endpoint;
  compositeRouteForm.priority = route.priority || 100;
  compositeRouteForm.enabled = route.enabled;
  compositeRouteForm.notes = route.notes || "";
};

const saveCompositeRoute = async () => {
  if (!compositeRoutesGroup.value) return;
  if (!compositeRouteForm.public_model.trim()) {
    appStore.showError(t("admin.groups.compositeRoutes.publicModelRequired"));
    return;
  }
  const groupId = compositeRoutesGroup.value.id;
  const editingId = compositeRouteEditingId.value;
  const requestId = ++compositeRouteMutationRequestId;
  compositeRouteSaving.value = true;
  const isCurrent = () =>
    requestId === compositeRouteMutationRequestId &&
    showCompositeRoutesModal.value &&
    compositeRoutesGroup.value?.id === groupId;
  try {
    const payload = toCompositeRouteInput();
    if (editingId) {
      await adminAPI.groups.updateCompositeRoute(
        groupId,
        editingId,
        payload,
      );
      if (!isCurrent()) return;
      appStore.showSuccess(t("admin.groups.compositeRoutes.routeUpdated"));
    } else {
      await adminAPI.groups.createCompositeRoute(
        groupId,
        payload,
      );
      if (!isCurrent()) return;
      appStore.showSuccess(t("admin.groups.compositeRoutes.routeCreated"));
    }
    if (!isCurrent()) return;
    resetCompositeRouteForm();
    await loadCompositeRoutes();
  } catch (error: any) {
    if (!isCurrent()) return;
    appStore.showError(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        t("admin.groups.compositeRoutes.failedToSave"),
    );
    console.error("Error saving composite route:", error);
  } finally {
    if (requestId === compositeRouteMutationRequestId) {
      compositeRouteSaving.value = false;
    }
  }
};

const deleteCompositeRoute = (route: CompositeModelRoute) => {
  if (compositeRouteDeleting.value) return;
  compositeRoutePendingDelete.value = route;
};

const confirmDeleteCompositeRoute = async () => {
  const route = compositeRoutePendingDelete.value;
  const groupId = compositeRoutesGroup.value?.id;
  if (groupId == null || !route || compositeRouteDeleting.value) return;
  const requestId = ++compositeRouteDeleteRequestId;
  compositeRouteDeleting.value = true;
  try {
    await adminAPI.groups.deleteCompositeRoute(groupId, route.id);
    if (requestId !== compositeRouteDeleteRequestId) return;
    if (compositeRouteEditingId.value === route.id) {
      resetCompositeRouteForm();
    }
    appStore.showSuccess(t("admin.groups.compositeRoutes.routeDeleted"));
    if (compositeRoutesGroup.value?.id === groupId) compositeRoutePendingDelete.value = null;
    await loadCompositeRoutes();
  } catch (error: any) {
    if (
      requestId !== compositeRouteDeleteRequestId ||
      !showCompositeRoutesModal.value ||
      compositeRoutesGroup.value?.id !== groupId
    ) return;
    appStore.showError(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        t("admin.groups.compositeRoutes.failedToDelete"),
    );
    console.error("Error deleting composite route:", error);
  } finally {
    if (requestId === compositeRouteDeleteRequestId) compositeRouteDeleting.value = false;
  }
};

const previewCompositeRoute = async () => {
  if (!compositeRoutesGroup.value || !compositePreviewModel.value.trim()) {
    return;
  }
  const groupId = compositeRoutesGroup.value.id;
  const requestId = ++compositePreviewRequestId;
  compositePreviewLoading.value = true;
  try {
    const decision = await adminAPI.groups.previewCompositeRoute(
      groupId,
      {
        model: compositePreviewModel.value.trim(),
        endpoint: compositePreviewEndpoint.value,
      },
    );
    if (
      requestId !== compositePreviewRequestId ||
      !showCompositeRoutesModal.value ||
      compositeRoutesGroup.value?.id !== groupId
    ) return;
    compositePreviewDecision.value = decision;
  } catch (error: any) {
    if (
      requestId !== compositePreviewRequestId ||
      !showCompositeRoutesModal.value ||
      compositeRoutesGroup.value?.id !== groupId
    ) return;
    appStore.showError(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        t("admin.groups.compositeRoutes.failedToPreview"),
    );
    console.error("Error previewing composite route:", error);
  } finally {
    if (requestId === compositePreviewRequestId) {
      compositePreviewLoading.value = false;
    }
  }
};

const handleDelete = (group: AdminGroup) => {
  if (deletePending.value) return;
  deletingGroup.value = group;
  showDeleteDialog.value = true;
};

const confirmDelete = async () => {
  const target = deletingGroup.value;
  if (!target || deletePending.value) return;
  deletePending.value = true;

  try {
    await adminAPI.groups.delete(target.id);
    appStore.showSuccess(t("admin.groups.groupDeleted"));
    showDeleteDialog.value = false;
    deletingGroup.value = null;
    loadGroups();
  } catch (error: any) {
    appStore.showError(
      error.response?.data?.detail || t("admin.groups.failedToDelete"),
    );
    console.error("Error deleting group:", error);
  } finally {
    deletePending.value = false;
  }
};

watch(
  () => createForm.platform,
  (newVal) => {
    if (!["anthropic", "antigravity"].includes(newVal)) {
      createForm.fallback_group_id_on_invalid_request = null;
    }
    if (newVal !== "openai") {
      resetMessagesDispatchFormState(createForm);
      createForm.allow_live = false;
    }
    if (!isProfitControlPlatform(newVal)) {
      createForm.profit_control_enabled = false;
      createForm.profit_min_margin_percent = 0;
      createForm.profit_safety_buffer_percent = 0;
    }
    createForm.max_reasoning_effort = normalizeReasoningEffortForPlatform(
      newVal,
      createForm.max_reasoning_effort,
    );
    createForm.reasoning_effort_mappings = reasoningEffortMappingsToRows(
      reasoningEffortMappingsToAPI(createForm.reasoning_effort_mappings),
      newVal,
    );
    createReasoningEffortPolicyRef.value?.resetValidation();
    if (!["openai", "antigravity", "anthropic", "gemini"].includes(newVal)) {
      createForm.require_oauth_only = false;
      createForm.require_privacy_set = false;
    }
    resetDisabledBatchImagePricing(createForm);
    resetModelsListState(createModelsListState);
    loadModelsListCandidates("create", 0, newVal);
  },
);

watch(
  () => createForm.allow_image_generation,
  () => {
    resetDisabledBatchImagePricing(createForm);
  },
);

watch(
  () => createForm.allow_batch_image_generation,
  () => {
    resetDisabledBatchImagePricing(createForm);
  },
);

watch(
  () => editForm.platform,
  (newVal) => {
    if (!["anthropic", "antigravity"].includes(newVal)) {
      editForm.fallback_group_id_on_invalid_request = null;
    }
    if (newVal !== "openai") {
      resetMessagesDispatchFormState(editForm);
      editForm.allow_live = false;
    }
    if (!isProfitControlPlatform(newVal)) {
      editForm.profit_control_enabled = false;
      editForm.profit_min_margin_percent = 0;
      editForm.profit_safety_buffer_percent = 0;
    }
    editForm.max_reasoning_effort = normalizeReasoningEffortForPlatform(
      newVal,
      editForm.max_reasoning_effort,
    );
    editForm.reasoning_effort_mappings = reasoningEffortMappingsToRows(
      reasoningEffortMappingsToAPI(editForm.reasoning_effort_mappings),
      newVal,
    );
    editReasoningEffortPolicyRef.value?.resetValidation();
    if (!["openai", "antigravity", "anthropic", "gemini"].includes(newVal)) {
      editForm.require_oauth_only = false;
      editForm.require_privacy_set = false;
    }
    resetDisabledBatchImagePricing(editForm);
    if (editingGroup.value) {
      resetModelsListState(editModelsListState, editForm.platform === editingGroup.value.platform ? editingGroup.value.models_list_config : undefined);
      loadModelsListCandidates("edit", editingGroup.value.id, newVal);
    }
  },
);

watch(
  () => editForm.allow_image_generation,
  () => {
    resetDisabledBatchImagePricing(editForm);
  },
);

watch(
  () => editForm.allow_batch_image_generation,
  () => {
    resetDisabledBatchImagePricing(editForm);
  },
);

watch(
  () => editForm.platform,
  (newVal) => {
    if (!['anthropic', 'antigravity'].includes(newVal)) {
      editForm.fallback_group_id_on_invalid_request = null
    }
    if (newVal !== 'openai') {
      editForm.allow_messages_dispatch = false
      editForm.allow_live = false
      editForm.default_mapped_model = ''
    }
  }
)

// 打开排序弹窗
const openSortModal = async () => {
  try {
    // 获取所有分组（不分页）
    const allGroups = await adminAPI.groups.getAll();
    // 按 sort_order 排序
    sortableGroups.value = [...allGroups].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    showSortModal.value = true;
  } catch (error) {
    appStore.showError(t("admin.groups.failedToLoad"));
    console.error("Error loading groups for sorting:", error);
  }
};

// 关闭排序弹窗
const closeSortModal = () => {
  showSortModal.value = false;
  sortableGroups.value = [];
};

// 保存排序
const saveSortOrder = async () => {
  if (sortSubmitting.value) return;
  sortSubmitting.value = true;
  try {
    const updates = sortableGroups.value.map((g, index) => ({
      id: g.id,
      sort_order: index * 10,
    }));
    await adminAPI.groups.updateSortOrder(updates);
    appStore.showSuccess(t("admin.groups.sortOrderUpdated"));
    closeSortModal();
    loadGroups();
  } catch (error: any) {
    appStore.showError(
      error.response?.data?.detail || t("admin.groups.failedToUpdateSortOrder"),
    );
    console.error("Error updating sort order:", error);
  } finally {
    sortSubmitting.value = false;
  }
};

onMounted(() => {
  loadGroups();
  void loadLiveCapability();
  loadModelsListCandidates("create", 0, createForm.platform);
});

onUnmounted(() => {
  abortController?.abort();
  abortController = null;
  compositeRoutesRequestId += 1;
  compositeRouteDeleteRequestId += 1;
  compositeRouteMutationRequestId += 1;
  compositePreviewRequestId += 1;
  accountSearchRunner.clearAll();
  clearAllAccountSearchState();
});
</script>

<style scoped>
.groups-table-scroller { width: 100%; max-width: 100%; overflow-x: auto; }
.groups-table-scroller :deep(.ui-table-scroller__content) { width: max-content; min-width: 1120px !important; }
.groups-table-scroller :deep(.ui-data-table),
.groups-table-scroller :deep(.table-wrapper),
.groups-table-scroller :deep(table) { width: max-content; min-width: 1120px !important; }

.groups-filter-fields {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.groups-filter-fields > :deep(.ui-form-field),
.groups-filter-fields > :deep(.ui-search) {
  min-width: 0;
  flex: 0 1 160px;
}

.groups-filter-fields > :deep(.ui-search) {
  flex-basis: 256px;
}

@media (max-width: 640px) {
  .groups-filter-fields {
    width: 100%;
  }

  .groups-filter-fields > :deep(.ui-form-field),
  .groups-filter-fields > :deep(.ui-search) {
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
