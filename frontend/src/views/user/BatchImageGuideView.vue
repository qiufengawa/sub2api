<template>
  <AppLayout>
    <AppPage width="full" density="compact" class="batch-image-page">
      <AppPageHeader :title="t('nav.batchImage')" :description="t('batchImage.pageDescription')">
        <template #actions>
          <UiButton density="compact" @click="showGuideModal = true">
            <template #icon><Icon name="book" size="sm" /></template>
            {{ t('batchImage.actions.usageGuide') }}
          </UiButton>
          <UiButton variant="primary" density="compact" @click="openCreateModal">
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('batchImage.actions.createJob') }}
          </UiButton>
        </template>
      </AppPageHeader>

      <UiServerTableWorkspace
        :loading="loadingKeys || loadingJobs"
        :empty="!loadingKeys && !loadingJobs && !initialListError && visibleBatchJobs.length === 0"
        :loading-text="t('common.loading')"
        :empty-title="t('batchImage.list.empty')"
        :empty-description="t('batchImage.list.emptyHint')"
      >
        <template #toolbar>
          <UiTableToolbar>
            <UiSearchInput
              v-model="filters.taskName"
              density="compact"
              :placeholder="t('batchImage.filters.searchTaskName')"
              :aria-label="t('batchImage.filters.searchTaskName')"
              @search="applyFilters"
            />
            <template #actions>
              <UiIconButton
                icon="refresh"
                density="compact"
                :label="t('common.refresh')"
                :disabled="loadingKeys || loadingJobs"
                @click="refreshPage"
              />
            </template>
          </UiTableToolbar>
        </template>

        <template #filters>
          <UiFilterBar
            :active-count="activeFilterCount"
            :clear-label="t('common.reset')"
            @clear="resetFilters"
          >
            <UiSelect
              v-model="filters.apiKeyId"
              density="compact"
              :aria-label="t('batchImage.columns.apiKey')"
              :options="apiKeyFilterOptions"
              @change="applyFilters"
            />
            <UiSelect
              v-model="filters.status"
              density="compact"
              :aria-label="t('common.status')"
              :options="statusFilterOptions"
              @change="applyFilters"
            />
            <UiSelect
              v-model="filters.downloaded"
              density="compact"
              :aria-label="t('batchImage.columns.downloadStatus')"
              :options="downloadFilterOptions"
              @change="applyFilters"
            />
          </UiFilterBar>
        </template>

        <UiBulkActionBar
          v-if="selectedJobIds.size"
          :selected-count="selectedJobIds.size"
          :all-selected="allVisibleSelected"
          :indeterminate="someVisibleSelected"
          :selection-label="t('batchImage.list.selectedJobs', { count: selectedJobIds.size }, selectedJobIds.size)"
          @clear="selectedJobIds = new Set()"
          @toggle-all="toggleAllVisible"
        >
          <UiButton
            density="dense"
            :loading="bulkDownloading"
            :disabled="selectedDownloadableRows.length === 0"
            @click="downloadSelectedJobs"
          >
            <template #icon><Icon name="download" size="sm" /></template>
            {{ t('batchImage.actions.downloadSelected') }}
          </UiButton>
          <UiButton
            variant="danger"
            density="dense"
            :loading="bulkDeleting"
            @click="requestDeleteSelectedJobs"
          >
            <template #icon><Icon name="trash" size="sm" /></template>
            {{ t('batchImage.actions.deleteRecords') }}
          </UiButton>
        </UiBulkActionBar>

        <UiErrorState
          v-if="initialListError"
          :title="listErrorTitle"
          :description="initialListError"
          :retry-text="t('common.retry')"
          data-testid="batch-image-list-error"
          @retry="refreshPage"
        />
        <template v-else>
        <UiAlert
          v-if="listRefreshError"
          tone="danger"
          :title="listErrorTitle"
          :message="listRefreshError"
          data-testid="batch-image-refresh-error"
        />
        <UiDataTable
          :columns="columns"
          :data="visibleBatchJobs"
          :loading="loadingKeys || loadingJobs"
          :aria-label="t('nav.batchImage')"
          :expandable-actions="false"
          row-key="id"
          mobile-table
        >
          <template #header-select>
            <UiCheckbox
              :model-value="allVisibleSelected"
              :indeterminate="someVisibleSelected"
              :aria-label="t('batchImage.list.selectAll')"
              @update:model-value="toggleAllVisible"
            />
          </template>

          <template #cell-select="{ row }">
            <UiCheckbox
              :model-value="selectedJobIds.has(row.id)"
              :aria-label="t('batchImage.list.selectJob', { name: row.task_name || row.id })"
              @update:model-value="checked => toggleJobSelection(row.id, checked)"
              @click.stop
            />
          </template>

          <template #cell-id="{ row }">
            <div class="batch-job-name" :class="{ 'batch-job-name--child': row.is_child }">
              <UiIconButton
                v-if="row.child_count > 0 && !row.is_child"
                variant="ghost"
                density="mini"
                :icon="expandedParentIds.has(row.id) ? 'chevronDown' : 'chevronRight'"
                :label="expandedParentIds.has(row.id) ? t('batchImage.list.collapseChildren') : t('batchImage.list.expandChildren', { n: row.child_count }, row.child_count)"
                @click.stop="toggleChildRows(row.id)"
              />
              <span v-else class="batch-job-name__indent" aria-hidden="true" />
              <button type="button" class="batch-job-name__button" @click="selectJob(row.id)">
                <span class="batch-job-name__title">
                  <span :title="row.task_name || defaultTaskName(row.created_at)">{{ row.task_name || defaultTaskName(row.created_at) }}</span>
                  <UiBadge v-if="row.child_count > 0 && !row.is_child" :label="t('batchImage.list.childCount', { n: row.child_count }, row.child_count)" />
                  <UiBadge v-if="row.is_child" tone="warning" :label="t('batchImage.list.childBadge')" />
                </span>
                <time :datetime="new Date(row.created_at * 1000).toISOString()">{{ formatDate(row.created_at) }}</time>
              </button>
            </div>
          </template>

          <template #cell-model="{ row }">
            <span class="batch-cell-ellipsis" :title="row.model">{{ row.model }}</span>
          </template>

          <template #cell-api_key_name="{ value }">
            <span class="batch-cell-ellipsis" :title="value || t('batchImage.list.keyNotRecorded')">
              {{ value || t('batchImage.list.keyNotRecorded') }}
            </span>
          </template>

          <template #cell-status="{ row }">
            <UiBadge :tone="statusTone(displayJob(row))" :label="statusLabel(displayJob(row))" dot />
          </template>

          <template #cell-counts="{ row }">
            <span class="batch-result-count ui-numeric">
              <strong class="is-success">{{ displayJob(row).success_count }}</strong>
              <span>/</span>
              <strong :class="{ 'is-danger': displayJob(row).fail_count > 0 }">{{ displayJob(row).fail_count }}</strong>
              <small>{{ t('batchImage.list.totalCount', { n: displayJob(row).item_count }) }}</small>
            </span>
          </template>

          <template #cell-cost="{ row }">
            <span class="batch-cell-ellipsis ui-numeric" :title="costLabel(displayJob(row))">{{ costLabel(displayJob(row)) }}</span>
          </template>

          <template #cell-downloaded="{ row }">
            <UiStatusBadge
              :status="row.downloaded_at ? 'success' : 'pending'"
              :label="row.downloaded_at ? formatDate(row.downloaded_at) : t('batchImage.list.notDownloaded')"
            />
          </template>

          <template #cell-actions="{ row }">
            <div class="batch-row-actions">
              <UiIconButton
                variant="ghost"
                density="dense"
                icon="eye"
                :label="t('batchImage.actions.viewDetail')"
                @click="selectJob(row.id)"
              />
              <UiIconButton
                variant="ghost"
                density="dense"
                icon="download"
                :label="t('batchImage.actions.downloadZip')"
                :disabled="!canDownload(row) || downloading"
                @click="downloadJob(row)"
              />
              <UiIconButton
                v-if="canRetry(row)"
                variant="ghost"
                density="dense"
                icon="refresh"
                :label="t('batchImage.actions.retryFailedItems')"
                :disabled="retryingBatchId === row.id"
                @click="retryFailedJob(row)"
              />
              <UiIconButton
                v-if="canDeleteRecord(row)"
                variant="danger"
                density="dense"
                icon="trash"
                :label="t('batchImage.actions.deleteRecords')"
                :disabled="deletingBatchId === row.id"
                @click="requestDeleteJob(row)"
              />
            </div>
          </template>
        </UiDataTable>
        </template>

        <template #pagination>
          <div v-if="visibleBatchJobs.length > 0 || pagination.page > 1" class="batch-pagination">
            <div class="batch-pagination__summary">
              <span>{{ t('batchImage.pagination.pageNumber', { page: pagination.page }) }}</span>
              <span>{{ t('batchImage.pagination.pageItems', { count: visibleBatchJobs.length }) }}</span>
              <UiSelect
                :model-value="pagination.page_size"
                density="dense"
                :aria-label="t('pagination.perPage')"
                :options="batchPageSizeOptions"
                @change="handlePageSizeChange"
              />
            </div>
            <div class="batch-pagination__actions">
              <UiButton density="dense" :disabled="pagination.page <= 1 || loadingJobs" @click="handlePageChange(pagination.page - 1)">
                <template #icon><Icon name="chevronLeft" size="sm" /></template>
                {{ t('pagination.previous') }}
              </UiButton>
              <UiButton density="dense" :disabled="!pagination.has_more || loadingJobs" @click="handlePageChange(pagination.page + 1)">
                {{ t('pagination.next') }}
                <template #icon><Icon name="chevronRight" size="sm" /></template>
              </UiButton>
            </div>
          </div>
        </template>
      </UiServerTableWorkspace>
    </AppPage>

    <UiDialog :show="!!currentJob" :title="t('batchImage.detail.title')" width="extra-wide" @close="closeDetail">
      <div v-if="currentJob" class="batch-detail">
        <header class="batch-detail__header">
          <div>
            <strong :title="currentJob.task_name || currentJob.id">{{ currentJob.task_name || defaultTaskName(currentJob.created_at) }}</strong>
            <span class="ui-mono" :title="currentJob.id">{{ currentJob.id }}</span>
          </div>
          <div>
            <UiBadge :label="currentJob.provider" />
            <UiBadge tone="info" :label="currentJob.model" />
          </div>
        </header>

        <div class="batch-detail__metrics">
          <UiStatMetric :label="t('common.status')" :value="statusLabel(currentDisplayJob || currentJob)">
            <template #status><UiBadge :tone="statusTone(currentDisplayJob || currentJob)" dot /></template>
          </UiStatMetric>
          <UiStatMetric
            :label="hasChildJobs(currentJob.id) ? t('batchImage.detail.aggregatedResult') : t('batchImage.detail.result')"
            :value="`${(currentDisplayJob || currentJob).success_count} / ${(currentDisplayJob || currentJob).fail_count}`"
          />
          <UiStatMetric :label="t('batchImage.detail.cost')" :value="costLabel(currentDisplayJob || currentJob)" />
          <UiStatMetric
            :label="t('batchImage.detail.downloadStatus')"
            :value="currentJob.downloaded_at ? formatDate(currentJob.downloaded_at) : t('batchImage.list.notDownloaded')"
          />
        </div>

        <UiAlert
          v-if="detailFailedItems.length"
          tone="danger"
          :title="`${t('batchImage.status.failed')} · ${detailFailedItems.length}`"
          :message="detailFailedItems[0]?.error?.message || ''"
        />

        <AppSection :title="t('batchImage.detail.items')" divided>
          <template #actions>
            <UiButton density="dense" :loading="refreshing || loadingItems" @click="refreshDetail">
              <template #icon><Icon name="refresh" size="sm" /></template>
              {{ t('common.refresh') }}
            </UiButton>
          </template>

          <UiMobileTableScroller v-if="items.length" :label="t('batchImage.detail.items')" min-width="920px">
            <table class="batch-detail-table">
              <thead>
                <tr>
                  <th>{{ t('batchImage.detail.customId') }}</th>
                  <th>{{ t('batchImage.detail.prompt') }}</th>
                  <th>{{ t('common.status') }}</th>
                  <th>{{ t('batchImage.detail.preview') }}</th>
                  <th>{{ t('batchImage.detail.result') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in items" :key="itemPreviewKey(item)" :class="{ 'is-recovered': isRecoveredOriginalFailure(item) }">
                  <td><span class="ui-mono" :title="item.custom_id">{{ item.custom_id }}</span></td>
                  <td>
                    <UiTooltip :content="item.prompt_preview || '-'">
                      <span class="batch-prompt-cell" tabindex="0">{{ item.prompt_preview || '-' }}</span>
                    </UiTooltip>
                  </td>
                  <td><UiBadge :tone="itemStatusTone(item)" :label="itemDisplayStatusLabel(item)" dot /></td>
                  <td>
                    <button
                      v-if="itemPreviewUrls[itemPreviewKey(item)] && !previewErrorIds.has(itemPreviewKey(item))"
                      type="button"
                      class="batch-thumbnail"
                      :title="t('batchImage.detail.previewZoom', { id: item.custom_id })"
                      @click="openImagePreview(item)"
                    >
                      <img :src="itemPreviewUrls[itemPreviewKey(item)]" alt="" draggable="false" @error="handlePreviewError(itemPreviewKey(item))" />
                    </button>
                    <UiIconButton
                      v-else-if="canLoadItemPreview(item)"
                      variant="ghost"
                      density="dense"
                      :icon="previewLoadingIds.has(itemPreviewKey(item)) ? 'refresh' : 'eye'"
                      :label="previewErrorIds.has(itemPreviewKey(item)) ? t('batchImage.detail.previewReload') : t('batchImage.detail.previewLoad')"
                      :disabled="previewLoadingIds.has(itemPreviewKey(item))"
                      @click="loadItemPreview(item)"
                    />
                    <span v-else class="batch-preview-unavailable" :title="item.image_count > 0 ? t('batchImage.detail.previewUnavailable') : t('batchImage.detail.noImage')">
                      <Icon name="document" size="sm" />
                    </span>
                  </td>
                  <td><UiBadge :tone="itemResultTone(item)" :label="itemResultLabel(item)" /></td>
                </tr>
              </tbody>
            </table>
          </UiMobileTableScroller>
          <UiEmptyState
            v-else
            :icon="loadingItems ? 'refresh' : 'inbox'"
            :title="loadingItems ? t('batchImage.detail.loadingItems') : t('batchImage.detail.noItems')"
            :description="loadingItems ? undefined : t('batchImage.detail.noItemsHint')"
          />
        </AppSection>
      </div>

      <template #footer>
        <div class="batch-dialog-actions">
          <UiButton
            :disabled="!currentJob || !canCancel(currentJob)"
            :loading="cancelling"
            @click="requestCancelSelected"
          >
            {{ t('batchImage.actions.cancelJob') }}
          </UiButton>
          <UiButton
            v-if="currentJob && currentDisplayJob && canRetry(currentDisplayJob)"
            :loading="retryingBatchId === currentJob.id"
            @click="retrySelected"
          >
            <template #icon><Icon name="refresh" size="sm" /></template>
            {{ t('batchImage.actions.retryFailedItems') }}
          </UiButton>
          <UiButton
            variant="primary"
            :disabled="!currentDisplayJob || !canDownload(currentDisplayJob)"
            :loading="downloading"
            @click="downloadSelected"
          >
            <template #icon><Icon name="download" size="sm" /></template>
            {{ t('batchImage.actions.downloadZip') }}
          </UiButton>
          <UiButton
            v-if="currentJob && canDeleteOutputs(currentJob)"
            variant="danger"
            :loading="deletingOutputs"
            :disabled="deletingOutputs"
            @click="requestDeleteOutputs"
          >
            <template #icon><Icon name="trash" size="sm" /></template>
            {{ t('batchImage.actions.deleteOutputs') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <UiImagePreview
      :show="!!previewImageItem"
      :src="previewImageUrl"
      :alt="previewImageItem?.custom_id || t('batchImage.imagePreview.title')"
      :filename="previewImageItem?.custom_id || 'batch-image-preview'"
      @close="closeImagePreview"
    />

    <UiDialog :show="showCreateModal" :title="t('batchImage.create.title')" width="extra-wide" @close="closeCreateModal">
      <form class="batch-create" @submit.prevent="submitJob">
        <section class="batch-create__settings">
          <UiTextField
            v-model="form.taskName"
            density="compact"
            :label="t('batchImage.create.taskName')"
            :placeholder="t('batchImage.create.taskNamePlaceholder')"
            :maxlength="255"
          />
          <UiSelect
            :model-value="form.apiKeyId"
            density="compact"
            label="API Key"
            :placeholder="loadingKeys ? t('batchImage.create.loadingKeys') : t('batchImage.create.selectKeyPlaceholder')"
            :options="createApiKeyOptions"
            :disabled="loadingKeys"
            :description="!loadingKeys && geminiApiKeys.length === 0 ? t('batchImage.create.noKeysHint') : undefined"
            @change="value => form.apiKeyId = Number(value || 0)"
          />
          <UiSelect
            v-model="form.model"
            density="compact"
            :label="t('batchImage.create.model')"
            :placeholder="loadingModels ? batchImageText('loadingModels') : batchImageText('noModels')"
            :options="availableBatchImageModels"
            :disabled="loadingModels || availableBatchImageModels.length === 0"
            :error="modelLoadError || undefined"
            :description="selectedApiKey && !loadingModels && availableBatchImageModels.length === 0 ? batchImageText('noModelsHint') : undefined"
          />
          <UiTextField
            model-value="1K"
            density="compact"
            :label="t('batchImage.create.imageSize')"
            :description="t('batchImage.create.imageSizeHint')"
            readonly
          />
          <UiSelect
            v-model="form.responseMimeType"
            density="compact"
            :label="t('batchImage.create.outputFormat')"
            :options="outputFormatOptions"
          />
          <UiTextField
            :model-value="t('batchImage.create.estimatedOutputValue', { images: estimatedOutputCount, prompts: promptRows.length })"
            density="compact"
            :label="t('batchImage.create.estimatedOutput')"
            readonly
          />
        </section>

        <section class="batch-create__prompts">
          <div class="batch-create__prompt-heading">
            <span>Prompt</span>
            <UiBadge :label="t('batchImage.create.promptAdded', { count: promptRows.length })" />
          </div>
          <UiTextArea v-model="promptDraft" :rows="3" :placeholder="t('batchImage.create.promptPlaceholder')" />
          <div class="batch-create__prompt-fields">
            <UiTextField
              v-model="customIdDraft"
              density="compact"
              monospace
              :maxlength="255"
              :placeholder="t('batchImage.create.customIdPlaceholder')"
            />
            <UiSelect
              :model-value="outputCountDraft"
              density="compact"
              :aria-label="t('batchImage.create.outputCountPerPrompt')"
              :options="outputCountSelectOptions"
              @change="value => outputCountDraft = Number(value || 1)"
            />
            <UiButton density="compact" :disabled="!promptDraft.trim()" @click="addPromptRow">
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('common.add') }}
            </UiButton>
          </div>

          <UiFileUpload
            :label="t('batchImage.create.referenceImage')"
            :description="t('batchImage.create.limitsHint', { maxPerItem: BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM, maxPerJob: BATCH_IMAGE_MAX_OUTPUTS_PER_JOB, refLimit: selectedModelReferenceLimit })"
            accept="image/png,image/jpeg,image/webp"
            multiple
            :disabled="selectedModelReferenceLimit <= 0 || referenceImageDrafts.length >= selectedModelReferenceLimit"
            @select="handleReferenceImageFiles"
          />

          <div v-if="referenceImageDrafts.length" class="batch-reference-list">
              <UiBadge v-for="(ref, refIndex) in referenceImageDrafts" :key="`${ref.name}-${refIndex}`" :label="ref.name">
              <template #default>
                <span :title="ref.name">{{ ref.name }}</span>
                <UiIconButton
                  icon="x"
                  variant="ghost"
                  density="mini"
                  :label="t('batchImage.create.removeReferenceImage')"
                  @click="removeReferenceImageDraft(refIndex)"
                />
              </template>
            </UiBadge>
          </div>

          <div v-if="promptRows.length" class="batch-prompt-list">
            <div v-for="(row, index) in promptRows" :key="row.localId" class="batch-prompt-list__row">
              <span class="ui-mono" :title="row.custom_id">{{ row.custom_id }}</span>
              <span :title="row.prompt">{{ row.prompt }}</span>
              <UiBadge v-if="row.output_count > 1" :label="`×${row.output_count}`" />
              <UiBadge v-if="row.reference_images.length" :label="t('batchImage.create.referenceCount', { n: row.reference_images.length }, row.reference_images.length)" />
              <UiIconButton variant="danger" density="dense" icon="trash" :label="t('common.delete')" @click="removePromptRow(index)" />
            </div>
          </div>
          <UiEmptyState v-else :title="t('batchImage.create.noPrompts')" icon="sparkles" />
        </section>

        <UiAlert class="batch-create__notice" tone="warning" :message="t('batchImage.create.cancelNotice')" />
        <UiAlert v-if="submitting" class="batch-create__notice" tone="info" :message="t('batchImage.create.submittingNotice')" />
      </form>

      <template #footer>
        <div class="batch-dialog-actions">
          <UiButton :disabled="submitting" @click="closeCreateModal">{{ t('common.cancel') }}</UiButton>
          <UiButton
            variant="primary"
            :loading="submitting"
            :disabled="loadingModels || (parsedItems.length === 0 && !promptDraft.trim()) || !selectedApiKey || !form.model"
            @click="submitJob"
          >
            {{ t('batchImage.actions.submitJob') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog :show="showGuideModal" :title="t('batchImage.guide.title')" width="wide" @close="showGuideModal = false">
      <div class="batch-guide">
        <AppSection :title="t('batchImage.guide.uiTitle')" divided>
          <ol>
            <li>{{ t('batchImage.guide.step1') }}</li>
            <li>{{ t('batchImage.guide.step2') }}</li>
            <li>{{ t('batchImage.guide.step3') }}</li>
            <li>{{ t('batchImage.guide.step4') }}</li>
          </ol>
        </AppSection>
        <AppSection :title="t('batchImage.guide.skillTitle')" :description="t('batchImage.guide.skillDesc')" divided>
          <UiCodeBlock :code="agentInstruction" :label="t('batchImage.guide.skillTitle')" />
        </AppSection>
      </div>
      <template #footer>
        <div class="batch-dialog-actions">
          <UiButton @click="showGuideModal = false">{{ t('common.close') }}</UiButton>
          <UiButton variant="primary" @click="copyInstruction">
            <template #icon><Icon name="copy" size="sm" /></template>
            {{ t('batchImage.actions.copyInstruction') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <UiConfirmDialog
      :show="!!pendingConfirmation"
      :title="confirmationTitle"
      :message="confirmationMessage"
      :confirm-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      :danger="pendingConfirmation?.kind !== 'cancel'"
      :pending="confirmationPending"
      @confirm="confirmPendingAction"
      @cancel="cancelPendingConfirmation"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  UiAlert,
  UiBadge,
  UiBulkActionBar,
  UiButton,
  UiCheckbox,
  UiCodeBlock,
  UiConfirmDialog,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiFileUpload,
  UiFilterBar,
  UiIconButton,
  UiImagePreview,
  UiMobileTableScroller,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiStatMetric,
  UiStatusBadge,
  UiTableToolbar,
  UiTextArea,
  UiTextField,
  UiTooltip,
  type Column,
  type SelectOption,
} from '@/components/ui'
import { useClipboard } from '@/composables/useClipboard'
import { getPersistedPageSize, setPersistedPageSize } from '@/composables/usePersistedPageSize'
import { useAppStore } from '@/stores/app'
import { keysAPI } from '@/api'
import {
  cancelBatchImageJob,
  deleteBatchImageJobRecord,
  deleteBatchImageOutputs,
  downloadBatchImageZip,
  getBatchImageItemContent,
  getBatchImageJob,
  listBatchImageJobs,
  listBatchImageItems,
  listBatchImageModels,
  saveBlob,
  submitBatchImageJob,
  type BatchImageItem,
  type BatchImageJob,
  type BatchImageJobsListOptions,
  type BatchImageReferenceImage,
  type BatchImageStatus,
  type BatchImageSubmitItem,
} from '@/api/batchImage'
import type { ApiKey } from '@/types'

type BatchImageJobRow = Pick<BatchImageJob, 'id' | 'task_name' | 'parent_batch_id' | 'status' | 'model' | 'provider' | 'item_count' | 'success_count' | 'fail_count' | 'estimated_cost' | 'hold_amount' | 'actual_cost' | 'created_at' | 'downloaded_at' | 'output_deleted_at'> & {
  api_key_id: number
  api_key_name: string
  child_count: number
  is_child?: boolean
}

type CachedBatchImageJobRow = {
  row: BatchImageJobRow
  apiKeyOrder: number
  sourceRank: number
}

type BatchImageKeyJobState = {
  rows: CachedBatchImageJobRow[]
  rawOffset: number
  exhausted: boolean
}

type BatchImageDetailItem = BatchImageItem & {
  batch_id: string
  source_task_name: string
}

type PromptRow = {
  localId: string
  custom_id: string
  prompt: string
  output_count: number
  reference_images: BatchImageReferenceImage[]
}

type ReferenceImageDraft = BatchImageReferenceImage & {
  name: string
  size: number
}

type PreviewCacheRecord = {
  key: string
  blob: Blob
  size: number
  createdAt: number
  lastAccessedAt: number
}

type PreviewImageSource = ImageBitmap | HTMLImageElement

type PendingConfirmation =
  | { kind: 'cancel'; batchId: string; apiKeyId: number }
  | { kind: 'delete-outputs'; batchId: string; apiKeyId: number }
  | { kind: 'delete'; job: BatchImageJobRow }
  | { kind: 'delete-selected'; jobs: BatchImageJobRow[] }

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'output_deleted'])
const PREVIEW_CACHE_DB_NAME = 'sub2api-batch-image-preview-cache'
const PREVIEW_CACHE_STORE_NAME = 'thumbnails'
const PREVIEW_THUMBNAIL_MAX_EDGE = 360
const PREVIEW_THUMBNAIL_QUALITY = 0.72
const PREVIEW_CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const PREVIEW_CACHE_MAX_ENTRIES = 120
const PREVIEW_CACHE_MAX_BYTES = 48 * 1024 * 1024
const BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM = 4
const BATCH_IMAGE_MAX_OUTPUTS_PER_JOB = 200
const batchPageSizeOptions: SelectOption[] = [20, 50, 100].map(size => ({ value: size, label: String(size) }))

const appStore = useAppStore()
const { copyToClipboard } = useClipboard()
const { t, locale } = useI18n()

const columns = computed<Column[]>(() => [
  { key: 'select', label: '', sortable: false, class: 'w-10 text-center' },
  { key: 'id', label: t('batchImage.columns.taskName'), sortable: false, class: 'w-[200px] max-w-[200px]' },
  { key: 'model', label: t('batchImage.columns.model'), sortable: false, class: 'w-[140px] max-w-[140px] text-center' },
  { key: 'api_key_name', label: t('batchImage.columns.apiKey'), sortable: false, class: 'w-[130px] max-w-[130px] text-center' },
  { key: 'status', label: t('common.status'), sortable: false, class: 'w-[90px] text-center' },
  { key: 'counts', label: t('batchImage.columns.result'), sortable: false, class: 'w-[100px] text-center' },
  { key: 'cost', label: t('batchImage.columns.cost'), sortable: false, class: 'w-[100px] text-center' },
  { key: 'downloaded', label: t('batchImage.columns.downloadStatus'), sortable: false, class: 'w-[120px] text-center' },
  { key: 'actions', label: t('common.actions'), sortable: false, class: 'w-[100px] text-center' },
])

const statusFilterOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('batchImage.filters.allStatuses') },
  { value: 'queued', label: t('batchImage.status.queued') },
  { value: 'running', label: t('batchImage.status.running') },
  { value: 'processing_results', label: t('batchImage.status.processingResults') },
  { value: 'settling', label: t('batchImage.status.settling') },
  { value: 'completed', label: t('batchImage.status.completed') },
  { value: 'failed', label: t('batchImage.status.failed') },
  { value: 'cancelled', label: t('batchImage.status.cancelled') },
  { value: 'output_deleted', label: t('batchImage.status.outputDeleted') },
])

const downloadFilterOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('batchImage.filters.allDownloadStates') },
  { value: 'true', label: t('batchImage.filters.downloaded') },
  { value: 'false', label: t('batchImage.filters.notDownloaded') },
])

const form = reactive({
  apiKeyId: 0,
  taskName: '',
  model: '',
  responseMimeType: 'image/png',
})

const filters = reactive({
  taskName: '',
  apiKeyId: '',
  status: '',
  downloaded: '',
})

const pagination = reactive({
  page: 1,
  page_size: Math.min(getPersistedPageSize(20), 100),
  has_more: false,
})

const apiKeys = ref<ApiKey[]>([])
const loadingKeys = ref(false)
const loadingJobs = ref(false)
const apiKeysLoadError = ref('')
const jobsLoadError = ref('')
const submitting = ref(false)
const refreshing = ref(false)
const cancelling = ref(false)
const downloading = ref(false)
const downloadingBatchId = ref('')
const retryingBatchId = ref('')
const deletingOutputs = ref(false)
const bulkDownloading = ref(false)
const bulkDeleting = ref(false)
const deletingBatchId = ref('')
const loadingItems = ref(false)
const loadingModels = ref(false)
const showCreateModal = ref(false)
const showGuideModal = ref(false)
const currentJob = ref<BatchImageJob | null>(null)
const selectedBatchId = ref('')
const selectedBatchApiKeyId = ref(0)
// Children can fall outside the currently visible global page (or belong to a
// different API-key partition). Keep discovered children separate from the
// paginated list so detail aggregation can be complete without changing page
// ordering or selection semantics.
const detailRelatedJobs = ref<BatchImageJobRow[]>([])
const items = ref<BatchImageDetailItem[]>([])
const detailFailedItems = computed(() => items.value.filter(item => item.status === 'failed' || !!item.error))
const batchJobs = ref<BatchImageJobRow[]>([])
const initialListError = computed(() => visibleBatchJobs.value.length === 0
  ? apiKeysLoadError.value || jobsLoadError.value
  : '')
const listRefreshError = computed(() => visibleBatchJobs.value.length > 0
  ? apiKeysLoadError.value || jobsLoadError.value
  : '')
const listErrorTitle = computed(() => apiKeysLoadError.value
  ? batchImageText('loadKeysFailed')
  : batchImageText('loadJobsFailed'))
const selectedJobIds = ref(new Set<string>())
const expandedParentIds = ref(new Set<string>())
const promptRows = ref<PromptRow[]>([])
const promptDraft = ref('')
const customIdDraft = ref('')
const outputCountDraft = ref(1)
const referenceImageDrafts = ref<ReferenceImageDraft[]>([])
const itemPreviewUrls = reactive<Record<string, string>>({})
const previewLoadingIds = ref(new Set<string>())
const previewErrorIds = ref(new Set<string>())
const previewImageItem = ref<BatchImageItem | null>(null)
const availableBatchImageModels = ref<Array<{ value: string; label: string }>>([])
const modelLoadError = ref('')
const pendingConfirmation = ref<PendingConfirmation | null>(null)
let modelRequestSeq = 0
let jobsRequestSeq = 0
let detailRequestSeq = 0
let itemsRequestSeq = 0
let detailRelatedRequestSeq = 0
let apiKeysRequestSeq = 0
let apiKeysRequestController: AbortController | null = null
let apiKeysLoadPromise: Promise<void> | null = null
let jobsCacheGeneration = 0
let jobsCacheSignature = ''
let jobsCacheByKey = new Map<number, BatchImageKeyJobState>()
const retrySourceByGeneratedID = new Map<string, string>()
let previewSessionSeq = 0
const previewInvalidationGeneration = new Map<string, number>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let previewCacheDBPromise: Promise<IDBDatabase | null> | null = null
let previewCacheCleanupTimer: ReturnType<typeof setInterval> | null = null
let disposed = false

const geminiApiKeys = computed(() =>
  apiKeys.value.filter((key) =>
    key.status === 'active' &&
    key.group?.platform === 'gemini' &&
    key.group?.allow_batch_image_generation === true,
  ),
)

const selectedApiKey = computed(() =>
  geminiApiKeys.value.find((key) => key.id === Number(form.apiKeyId)) || null,
)

const filteredApiKeys = computed(() => {
  const selectedFilterID = Number(filters.apiKeyId || 0)
  if (!selectedFilterID) return geminiApiKeys.value
  return geminiApiKeys.value.filter(key => key.id === selectedFilterID)
})

const apiKeyFilterOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('batchImage.filters.allApiKeys') },
  ...geminiApiKeys.value.map(key => ({
    value: String(key.id),
    label: key.name || `API Key #${key.id}`,
  })),
])

const createApiKeyOptions = computed<SelectOption[]>(() => geminiApiKeys.value.map(key => ({
  value: key.id,
  label: `${key.name || `API Key #${key.id}`} · ${key.group?.name || 'Gemini'}`,
})))

const outputFormatOptions: SelectOption[] = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
]

const outputCountSelectOptions = computed<SelectOption[]>(() =>
  Array.from({ length: BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM }, (_, index) => {
    const count = index + 1
    return { value: count, label: t('batchImage.create.outputCountOption', { n: count }, count) }
  }),
)

const activeFilterCount = computed(() => [
  filters.taskName.trim(),
  filters.apiKeyId,
  filters.status,
  filters.downloaded,
].filter(Boolean).length)

const confirmationPending = computed(() =>
  cancelling.value || deletingOutputs.value || bulkDeleting.value || Boolean(deletingBatchId.value),
)

const confirmationTitle = computed(() => {
  if (pendingConfirmation.value?.kind === 'cancel') return t('batchImage.actions.cancelJob')
  if (pendingConfirmation.value?.kind === 'delete-outputs') return t('batchImage.actions.deleteOutputs')
  return t('batchImage.actions.deleteRecords')
})

const confirmationMessage = computed(() => {
  if (pendingConfirmation.value?.kind === 'cancel') return batchImageText('cancelConfirm')
  if (pendingConfirmation.value?.kind === 'delete-outputs') return batchImageText('deleteOutputsConfirm')
  if (pendingConfirmation.value?.kind === 'delete-selected') return batchImageText('deleteSelectedConfirm')
  return batchImageText('deleteConfirm')
})

const childrenByParent = computed(() => {
  const groups = new Map<string, BatchImageJobRow[]>()
  for (const job of batchJobs.value) {
    if (!job.parent_batch_id) continue
    const rows = groups.get(job.parent_batch_id) || []
    rows.push(job)
    groups.set(job.parent_batch_id, rows)
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.created_at - b.created_at)
  }
  return groups
})

function childrenForParent(batchId: string): BatchImageJobRow[] {
  const seen = new Set<string>()
  const rows: BatchImageJobRow[] = []
  const candidates = [
    ...(childrenByParent.value.get(batchId) || []),
    ...detailRelatedJobs.value.filter(job => job.parent_batch_id === batchId),
  ]
  for (const row of candidates) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }
  return rows.sort((a, b) => a.created_at - b.created_at)
}

const visibleBatchJobs = computed(() => {
  const rows: BatchImageJobRow[] = []
  const pageIds = new Set(batchJobs.value.map(job => job.id))
  for (const job of batchJobs.value.filter(item => !item.parent_batch_id)) {
    rows.push(job)
    if (expandedParentIds.value.has(job.id)) {
      rows.push(...childrenForParent(job.id).map(child => ({ ...child, is_child: true })))
    }
  }
  for (const job of batchJobs.value.filter(item => item.parent_batch_id && !pageIds.has(item.parent_batch_id))) {
    rows.push({ ...job, is_child: true })
  }
  return rows
})

// Action selection must use the same expanded row set rendered by the table.
// Retry children discovered outside the current page live in
// detailRelatedJobs/visibleBatchJobs rather than batchJobs; filtering only the
// paginated root array made their checked rows look selected while bulk
// download/delete silently ignored them.
const selectedRows = computed(() => {
  const seen = new Set<string>()
  return visibleBatchJobs.value.filter((job) => {
    if (!selectedJobIds.value.has(job.id) || seen.has(job.id)) return false
    seen.add(job.id)
    return true
  })
})

const selectedDownloadableRows = computed(() =>
  selectedRows.value.filter(job => canDownload(job)),
)

const allVisibleSelected = computed(() =>
  visibleBatchJobs.value.length > 0 && visibleBatchJobs.value.every(job => selectedJobIds.value.has(job.id)),
)

const someVisibleSelected = computed(() =>
  visibleBatchJobs.value.some(job => selectedJobIds.value.has(job.id)) && !allVisibleSelected.value,
)

const previewImageUrl = computed(() => {
  const item = previewImageItem.value
  if (!item) return ''
  return itemPreviewUrls[itemPreviewKey(item)] || ''
})

const recoveredOriginalCustomIds = computed(() => {
  const rootBatchId = detailRootBatchId()
  if (!rootBatchId) return new Set<string>()
  const ids = new Set<string>()
  for (const item of items.value) {
    if (!isChildDetailItem(item) || !isSuccessfulImageItem(item)) continue
    const sourceCustomID = retrySourceCustomID(item.custom_id)
    if (sourceCustomID) ids.add(sourceCustomID)
  }
  return ids
})

const currentDisplayJob = computed(() => {
  if (!currentJob.value) return null
  return displayJob(currentJob.value)
})

const endpointBase = computed(() => {
  const configured = appStore.apiBaseUrl?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '')
  return '<你的 Sub2API API 端点>'
})

const selectedModelReferenceLimit = computed(() => referenceImageLimitForModel(form.model))

const estimatedOutputCount = computed(() =>
  promptRows.value.reduce((sum, row) => sum + normalizeOutputCount(row.output_count), 0),
)

const parsedItems = computed<BatchImageSubmitItem[]>(() => {
  const used = new Set<string>()
  return promptRows.value
    .map((row, index) => {
      const customID = uniqueCustomID(row.custom_id || `img_${String(index + 1).padStart(3, '0')}`, used, index)
      const item: BatchImageSubmitItem = { custom_id: customID, prompt: row.prompt.trim() }
      const outputCount = normalizeOutputCount(row.output_count)
      if (outputCount > 1) {
        item.output_count = outputCount
      }
      if (row.reference_images.length) {
        item.reference_images = row.reference_images
      }
      return item
    })
    .filter(item => item.prompt)
})

function referenceImageLimitForModel(model: string) {
  const normalized = String(model || '').toLowerCase()
  if (normalized.includes('pro-image')) return 14
  if (normalized.includes('flash-image')) return 3
  return 0
}

const agentInstruction = computed(() => `---
name: sub2api-batch-image
description: 当用户希望用 Gemini/Vertex 批量生成图片、批量跑提示词、下载批量生图结果、重试失败图片时使用。
---

你是 Codex 中的批量生图执行 Agent。用户不需要手动填写页面表单；你应从当前聊天、用户给的文件、目录或上下文中整理任务名称、prompt 列表和输出目录，只有缺少关键决策时才向用户提问。

默认端点：
${endpointBase.value}

你需要自己完成：
1. 从用户聊天或附件中提取 prompt。每条 prompt 保留完整文本，按顺序生成稳定 custom_id，例如 img_001、img_002。
2. 从用户要求或上下文推断任务名称；没有明确名称时用当前时间生成任务名。
3. 从用户要求或上下文推断输出目录；如果用户没有说保存到哪里，才询问用户。
4. 提交前必须先计算 expected_output_count = 所有 item 的 output_count 之和。单个批量任务硬性最多 200 张输出图；超过 200 张必须拆成多组任务，不能提交一个超大任务，也不能把参考图附件上限当成生成张数上限。
5. 如果用户提供参考图，把参考图按用途绑定到具体 item。参考图只是输入附件，不是输出图数量。模型单条限制必须按模型执行：Gemini 2.5 Flash Image 每条最多 3 张参考图；Gemini 3 Pro Image 每条最多 14 张参考图。不要把后端附件风控理解成 Pro 单条能力：按 output_count 展开后，所有 item 的参考图附件总数还有内部保护阈值 1000 个，inline base64 参考图解码后总量最多 128MB。这个 1000 只是服务器拒绝异常请求的保护阈值，不是推荐规模；参考图很多或总请求体较大时应主动拆分任务。
6. 参考图会按 output_count 重复消耗输入 token；大量任务、重复复用同一张参考图或参考图总体积较大时，优先使用 gs:// file_uri 或拆分成多组任务。
7. 选择 API Key 和模型：先获取当前可用的批量生图 Key/模型；如果用户指定模型且该 Key 支持，则使用用户指定模型；否则使用该 Key 可用模型中的默认/第一个。不要展示或询问内部 provider 名称。
8. 调用批量生图 API 提交、轮询、下载，不要求用户去页面里手填。

API 调用规范：
- 模型：GET ${joinEndpointPath(endpointBase.value, '/v1/images/batches/models')}
- 提交：POST ${joinEndpointPath(endpointBase.value, '/v1/images/batches')}
- 查询：GET ${joinEndpointPath(endpointBase.value, '/v1/images/batches/{id}')}
- 明细：GET ${joinEndpointPath(endpointBase.value, '/v1/images/batches/{id}/items')}
- 单项预览：GET ${joinEndpointPath(endpointBase.value, '/v1/images/batches/{id}/items/{custom_id}/content?image_index=0')}
- 下载：GET ${joinEndpointPath(endpointBase.value, '/v1/images/batches/{id}/download')}
- 取消：POST ${joinEndpointPath(endpointBase.value, '/v1/images/batches/{id}/cancel')}
- 删除记录：DELETE ${joinEndpointPath(endpointBase.value, '/v1/images/batches/{id}')}
- 删除输出：DELETE ${joinEndpointPath(endpointBase.value, '/v1/images/batches/{id}/outputs')}

轮询与恢复：提交或重试后页面每 8 秒刷新一次当前任务；这是 UI 刷新节流，
不是服务端 SLA。长时间 queued/running 时应尊重服务端 Retry-After（若返回），
并按恢复记录中的 status_url 继续查询，不要高频并发请求。

提交请求体：
{
  "model": "<按所选 Key 可用模型填写>",
  "task_name": "<从聊天推断；为空则用当前时间>",
  "image_size": "1K",
  "response_mime_type": "image/png",
  "items": [
    {
      "custom_id": "img_001",
      "prompt": "<第一条完整 prompt>",
      "output_count": 1,
      "reference_images": [
        {
          "id": "face",
          "type": "subject",
          "mime_type": "image/png",
          "data": "<base64，不含 data:image/png;base64, 前缀>"
        }
      ]
    }
  ]
}

必须遵守：
- 不要把 API Key 写入仓库、日志、提交记录或最终回复。
- 不要把参考图 base64 写入最终回复、日志或公开文件。恢复记录中只保存参考图文件名、用途、数量和请求 JSON 文件路径；若请求 JSON 文件包含 base64，应保存在用户指定输出目录且不要提交到仓库。
- output_count 表示同一 prompt 和参考图重复生成几张，默认 1，每条最多 4；这不是依赖 Gemini 单次请求返回多图，而是系统展开成多个真实任务项。提交前必须确认预计输出图总数不超过 200，超过就拆分成多组任务。绝不能因为参考图附件有更高的内部保护阈值，就提交会生成超过 200 张图的任务。
- 当前对用户的批量生图计费仍按成功输出图片数量结算，不单独对参考图加价。可以向用户说明：参考图会产生少量上游输入 token 和临时存储成本，且会随 output_count 重复计算；页面显示的冻结/结算金额按输出图片数量计算。
- 提交成功后，必须立刻在输出目录写入本地恢复记录，例如 batch-image-resume.json。不要在恢复记录里保存 API Key。
- 恢复记录至少包含：endpoint、task_name、batch_id、model、output_dir、request_file、submitted_at、last_status、status_url、items_url、download_url、prompt_count、expected_output_count，以及可用于失败重试的 custom_id 到 prompt 映射或请求 JSON 文件路径。
- 每次查询状态后更新恢复记录，写入 last_checked_at、last_status、成功数、失败数、实际扣费和失败摘要。会话中断或暂停后，下次必须能凭该文件继续查询、下载或重试。
- 不要高频轮询。首次查询等待约 20 到 30 秒；queued 状态每 60 到 120 秒查询一次；如果连续 3 次仍是 queued，就先停止主动查询，告诉用户任务仍在排队，并保留恢复记录，之后可继续其他任务或等待用户稍后让你恢复。
- running 状态每约 60 秒查询一次，服务器压力大或大批量任务时可以更久；processing_results 等接近完成的状态可每 20 到 45 秒查询一次。
- 任务完成后报告任务名、任务 id、成功数、失败数、实际扣费和保存路径。
- 只下载成功图片。部分失败时，先展示失败 custom_id、错误码、错误来源和简要原因。
- 重试只能重试失败项，不能重复提交已成功项。若历史任务没有保存失败项 prompt，必须告诉用户无法自动重试，并询问用户是否提供原 prompt。
- 重试流程先读取 /items，只提交 status=failed 且仍有 prompt_preview 的项，
  使用新的 custom_id 和 parent_batch_id 指向原任务；成功项不会被再次提交。
- 删除记录前必须确认任务已进入终态；删除输出是独立操作，不能把它当作删除任务记录。
- 取消任务前必须提醒：已被系统索引为成功的图片仍会按成功项结算扣费，其余冻结金额会释放。
- 图片预览按需加载；不要为了查看列表自动批量加载图片内容。`)

function joinEndpointPath(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function uniqueCustomID(raw: string, used: Set<string>, index: number): string {
  const base = raw.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || `img_${String(index + 1).padStart(3, '0')}`
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

function normalizeOutputCount(value: unknown): number {
  const parsed = Math.floor(Number(value || 1))
  if (!Number.isFinite(parsed)) return 1
  return Math.min(BATCH_IMAGE_MAX_OUTPUTS_PER_ITEM, Math.max(1, parsed))
}

function addPromptRow() {
  const prompt = promptDraft.value.trim()
  if (!prompt) return
  const outputCount = normalizeOutputCount(outputCountDraft.value)
  const used = new Set(promptRows.value.map(row => row.custom_id))
  const customID = uniqueCustomID(customIdDraft.value || `img_${String(promptRows.value.length + 1).padStart(3, '0')}`, used, promptRows.value.length)
  promptRows.value = [
    ...promptRows.value,
    {
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      custom_id: customID,
      prompt,
      output_count: outputCount,
      reference_images: referenceImageDrafts.value.map(({ name: _name, size: _size, ...ref }) => ref),
    },
  ]
  promptDraft.value = ''
  customIdDraft.value = ''
  outputCountDraft.value = 1
  referenceImageDrafts.value = []
}

function removePromptRow(index: number) {
  promptRows.value = promptRows.value.filter((_, currentIndex) => currentIndex !== index)
}

function removeReferenceImageDraft(index: number) {
  referenceImageDrafts.value = referenceImageDrafts.value.filter((_, currentIndex) => currentIndex !== index)
}

async function handleReferenceImageFiles(files: File[]) {
  if (files.length === 0) return
  const limit = selectedModelReferenceLimit.value
  if (limit <= 0) {
    appStore.showError(t('batchImage.create.modelNoReferenceImages'))
    return
  }
  const slots = Math.max(0, limit - referenceImageDrafts.value.length)
  if (slots <= 0) {
    appStore.showError(t('batchImage.create.refLimitReached', { limit }))
    return
  }
  const accepted = files.slice(0, slots)
  if (accepted.length < files.length) {
    appStore.showError(t('batchImage.create.refLimitExceededIgnored', { limit }))
  }
  const next: ReferenceImageDraft[] = []
  for (const file of accepted) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      appStore.showError(t('batchImage.create.refFormatUnsupported'))
      continue
    }
    if (file.size > 10 * 1024 * 1024) {
      appStore.showError(t('batchImage.create.refFileTooLarge', { name: file.name }))
      continue
    }
    const data = await readFileAsBase64(file)
    next.push({
      id: file.name,
      type: 'reference',
      mime_type: file.type,
      data,
      name: file.name,
      size: file.size,
    })
  }
  const currentLimit = selectedModelReferenceLimit.value
  const currentSlots = Math.max(0, currentLimit - referenceImageDrafts.value.length)
  const currentAccepted = next.slice(0, currentSlots)
  if (currentAccepted.length < next.length) {
    appStore.showError(t('batchImage.create.refLimitExceededIgnored', { limit: currentLimit }))
  }
  referenceImageDrafts.value = [...referenceImageDrafts.value, ...currentAccepted]
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

function isApiKeysAbortError(error: unknown): boolean {
  const candidate = error as { name?: string; code?: string } | null
  return candidate?.name === 'AbortError' || candidate?.name === 'CanceledError' || candidate?.code === 'ERR_CANCELED'
}

function loadApiKeys(): Promise<void> {
  if (apiKeysLoadPromise) return apiKeysLoadPromise

  const requestID = ++apiKeysRequestSeq
  const controller = new AbortController()
  apiKeysRequestController = controller
  loadingKeys.value = true
  apiKeysLoadError.value = ''

  const request = (async () => {
    try {
      const loadedKeys: ApiKey[] = []
      let page = 1
      for (;;) {
        const response = await keysAPI.list(
          page,
          100,
          { status: 'active', sort_by: 'created_at', sort_order: 'desc' },
          { signal: controller.signal },
        )
        if (requestID !== apiKeysRequestSeq || controller.signal.aborted) return
        const pageItems = response.items || []
        loadedKeys.push(...pageItems)
        const pages = Math.max(1, Number(response.pages || 1))
        if (page >= pages || pageItems.length === 0) break
        page += 1
      }
      const seen = new Set<number>()
      apiKeys.value = loadedKeys.filter((key) => {
        if (seen.has(key.id)) return false
        seen.add(key.id)
        return true
      })
      apiKeysLoadError.value = ''
      if (!selectedApiKey.value && geminiApiKeys.value.length > 0) {
        form.apiKeyId = geminiApiKeys.value[0].id
      }
      if (filters.apiKeyId && !geminiApiKeys.value.some(key => String(key.id) === filters.apiKeyId)) {
        filters.apiKeyId = ''
      }
      if (!selectedApiKey.value) {
        availableBatchImageModels.value = []
        form.model = ''
      }
    } catch (error: unknown) {
      if (requestID !== apiKeysRequestSeq || controller.signal.aborted || isApiKeysAbortError(error)) return
      apiKeysLoadError.value = batchImageErrorMessage(error, batchImageText('loadKeysFailed'))
      appStore.showError(apiKeysLoadError.value)
    } finally {
      if (requestID === apiKeysRequestSeq && apiKeysRequestController === controller) {
        loadingKeys.value = false
        apiKeysRequestController = null
        apiKeysLoadPromise = null
      }
    }
  })()
  apiKeysLoadPromise = request
  return request
}

async function loadAvailableModels() {
  const key = selectedApiKey.value
  const requestID = ++modelRequestSeq
  modelLoadError.value = ''
  availableBatchImageModels.value = []
  form.model = ''
  if (!key) return

  loadingModels.value = true
  try {
    const result = await listBatchImageModels(key.key)
    if (requestID !== modelRequestSeq) return
    const seen = new Set<string>()
    availableBatchImageModels.value = (result.data || [])
      .map(model => String(model.id || '').trim())
      .filter((model) => {
        if (!model || seen.has(model)) return false
        seen.add(model)
        return true
      })
      .map(model => ({ value: model, label: model }))
    form.model = availableBatchImageModels.value[0]?.value || ''
  } catch (error: any) {
    if (requestID !== modelRequestSeq) return
    modelLoadError.value = batchImageErrorMessage(error, batchImageText('loadModelsFailed'))
  } finally {
    if (requestID === modelRequestSeq) {
      loadingModels.value = false
    }
  }
}

async function refreshPage() {
  await loadApiKeys()
  if (disposed) return
  invalidateJobsCache()
  await loadBatchJobs()
}

function applyFilters() {
  pagination.page = 1
  selectedJobIds.value = new Set()
  invalidateJobsCache()
  void loadBatchJobs()
}

function resetFilters() {
  filters.taskName = ''
  filters.apiKeyId = ''
  filters.status = ''
  filters.downloaded = ''
  applyFilters()
}

function listOptions(cursor: number, limit: number): BatchImageJobsListOptions {
  const options: BatchImageJobsListOptions = {
    limit,
    cursor: String(cursor),
  }
  if (filters.taskName.trim()) options.taskName = filters.taskName.trim()
  if (filters.status) options.status = filters.status
  if (filters.downloaded) options.downloaded = filters.downloaded
  return options
}

function invalidateJobsCache() {
  jobsCacheGeneration += 1
  jobsCacheSignature = ''
  jobsCacheByKey = new Map()
}

function currentJobsCacheSignature(keys: ApiKey[]): string {
  return JSON.stringify({
    keys: keys.map(key => key.id),
    taskName: filters.taskName.trim(),
    status: filters.status,
    downloaded: filters.downloaded,
    pageSize: pagination.page_size,
  })
}

function cloneJobsCache(keys: ApiKey[]): Map<number, BatchImageKeyJobState> {
  return new Map(keys.map(key => {
    const current = jobsCacheByKey.get(key.id)
    return [key.id, current
      ? { rows: [...current.rows], rawOffset: current.rawOffset, exhausted: current.exhausted }
      : { rows: [], rawOffset: 0, exhausted: false }]
  }))
}

async function extendKeyJobState(
  key: ApiKey,
  keyOrder: number,
  state: BatchImageKeyJobState,
  targetCount: number,
) {
  while (!state.exhausted && state.rows.length < targetCount) {
    const limit = Math.min(100, targetCount - state.rows.length)
    const result = await listBatchImageJobs(key.key, listOptions(state.rawOffset, limit))
    const jobs = result.data || []
    const sourceStart = state.rawOffset
    state.rows.push(...jobs.map((job, index) => ({
      row: toJobRow(job, key),
      apiKeyOrder: keyOrder,
      sourceRank: sourceStart + index,
    })))
    state.rawOffset += jobs.length
    if (!result.has_more || jobs.length === 0) state.exhausted = true
  }
}

function mergedCachedJobs(cache: Map<number, BatchImageKeyJobState>) {
  return [...cache.values()]
    .flatMap(state => state.rows)
    .sort((a, b) =>
      b.row.created_at - a.row.created_at
      || a.apiKeyOrder - b.apiKeyOrder
      || a.sourceRank - b.sourceRank)
}

function toJobRow(job: BatchImageJob, key = selectedApiKey.value): BatchImageJobRow {
  return {
    id: job.id,
    task_name: job.task_name || defaultTaskName(job.created_at),
    parent_batch_id: job.parent_batch_id || null,
    status: job.status,
    model: job.model,
    provider: job.provider,
    item_count: job.item_count,
    success_count: job.success_count,
    fail_count: job.fail_count,
    estimated_cost: job.estimated_cost,
    hold_amount: job.hold_amount,
    actual_cost: job.actual_cost,
    created_at: job.created_at,
    downloaded_at: job.downloaded_at,
    output_deleted_at: job.output_deleted_at,
    api_key_id: key?.id || 0,
    api_key_name: key?.name || '',
    child_count: 0,
  }
}

function applyChildCounts(rows: BatchImageJobRow[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!row.parent_batch_id) continue
    counts.set(row.parent_batch_id, (counts.get(row.parent_batch_id) || 0) + 1)
  }
  return rows.map(row => ({ ...row, child_count: counts.get(row.id) || 0 }))
}

function displayJob<T extends Pick<BatchImageJob, 'id' | 'parent_batch_id' | 'status' | 'item_count' | 'success_count' | 'fail_count' | 'estimated_cost' | 'hold_amount' | 'actual_cost'>>(job: T): T {
  if (job.parent_batch_id) return job
  const children = childrenForParent(job.id)
  if (!children.length) return job

  const childSuccess = children.reduce((sum, child) => sum + child.success_count, 0)
  const childEstimated = children.reduce((sum, child) => sum + child.estimated_cost, 0)
  const childHold = children.reduce((sum, child) => sum + child.hold_amount, 0)
  const childActual = children.reduce((sum, child) => sum + (child.actual_cost || 0), 0)
  const childActualReady = children.every(child => child.actual_cost !== null)
  const successCount = Math.min(job.item_count, job.success_count + childSuccess)
  const failCount = Math.max(0, job.item_count - successCount)
  const actualCost = job.actual_cost === null
    ? (childActualReady ? childActual : null)
    : job.actual_cost + childActual

  return {
    ...job,
    success_count: successCount,
    fail_count: failCount,
    status: failCount === 0 && TERMINAL_STATUSES.has(job.status) ? 'completed' : job.status,
    estimated_cost: job.estimated_cost + childEstimated,
    hold_amount: job.hold_amount + childHold,
    actual_cost: actualCost,
  }
}

function hasChildJobs(batchId: string) {
  return childrenForParent(batchId).length > 0
}

function toggleChildRows(batchId: string) {
  const next = new Set(expandedParentIds.value)
  if (next.has(batchId)) next.delete(batchId)
  else next.add(batchId)
  expandedParentIds.value = next
}


async function loadBatchJobs() {
  if (disposed) return
  const requestID = ++jobsRequestSeq
  jobsLoadError.value = ''
  const keys = filteredApiKeys.value
  if (!keys.length) {
    batchJobs.value = []
    pagination.has_more = false
    loadingJobs.value = false
    return
  }
  const signature = currentJobsCacheSignature(keys)
  if (signature !== jobsCacheSignature) {
    invalidateJobsCache()
    jobsCacheSignature = signature
  }
  const generation = jobsCacheGeneration
  const targetCount = pagination.page * pagination.page_size + 1
  const stagedCache = cloneJobsCache(keys)
  loadingJobs.value = true
  try {
    await Promise.all(keys.map((key, keyOrder) =>
      extendKeyJobState(key, keyOrder, stagedCache.get(key.id)!, targetCount)))
    if (requestID !== jobsRequestSeq || generation !== jobsCacheGeneration) return
    jobsCacheByKey = stagedCache
    const merged = mergedCachedJobs(stagedCache)
    const start = (pagination.page - 1) * pagination.page_size
    const end = start + pagination.page_size
    batchJobs.value = applyChildCounts(merged.slice(start, end).map(item => item.row))
    pagination.has_more = merged.length > end
    selectedJobIds.value = new Set([...selectedJobIds.value].filter(id => visibleBatchJobs.value.some(job => job.id === id)))
  } catch (error: any) {
    if (requestID !== jobsRequestSeq) return
    jobsLoadError.value = batchImageErrorMessage(error, batchImageText('loadJobsFailed'))
    appStore.showError(jobsLoadError.value)
  } finally {
    if (requestID === jobsRequestSeq) loadingJobs.value = false
  }
}

function upsertJob(job: BatchImageJob, key?: ApiKey | null) {
  invalidateJobsCache()
  const index = batchJobs.value.findIndex(item => item.id === job.id)
  const existing = index >= 0 ? batchJobs.value[index] : null
  const existingKey = existing?.api_key_id
    ? geminiApiKeys.value.find(item => item.id === existing.api_key_id) || null
    : null
  const next = toJobRow(job, key || existingKey || selectedApiKey.value)
  if (index >= 0) {
    const rows = [...batchJobs.value]
    rows[index] = { ...next, is_child: rows[index].is_child }
    batchJobs.value = applyChildCounts(rows)
    return
  }
  batchJobs.value = applyChildCounts([next, ...batchJobs.value].slice(0, pagination.page_size))
}

function handlePageChange(page: number) {
  if (page < 1 || page === pagination.page) return
  pagination.page = page
  selectedJobIds.value = new Set()
  void loadBatchJobs()
}

function handlePageSizeChange(value: string | number | boolean | null) {
  if (value === null || typeof value === 'boolean') return
  const nextSize = Math.min(Math.max(Number(value) || 20, 1), 100)
  pagination.page_size = nextSize
  pagination.page = 1
  setPersistedPageSize(nextSize)
  selectedJobIds.value = new Set()
  invalidateJobsCache()
  void loadBatchJobs()
}

function openCreateModal() {
  showCreateModal.value = true
  if (!apiKeys.value.length) {
    void loadApiKeys()
  }
}

function closeCreateModal() {
  if (submitting.value) return
  showCreateModal.value = false
  resetCreateDraft()
}

function resetCreateDraft() {
  form.taskName = ''
  form.responseMimeType = 'image/png'
  promptRows.value = []
  promptDraft.value = ''
  customIdDraft.value = ''
  outputCountDraft.value = 1
  referenceImageDrafts.value = []
}

function closeDetail() {
  detailRequestSeq += 1
  itemsRequestSeq += 1
  detailRelatedRequestSeq += 1
  currentJob.value = null
  selectedBatchId.value = ''
  selectedBatchApiKeyId.value = 0
  detailRelatedJobs.value = []
  items.value = []
  clearItemPreviews()
}

function keyForSelectedBatch(): ApiKey | null {
  if (selectedBatchApiKeyId.value) {
    const key = geminiApiKeys.value.find(item => item.id === selectedBatchApiKeyId.value)
    if (key) return key
  }
  return selectedApiKey.value
}

function requireApiKey(): ApiKey | null {
  if (!selectedApiKey.value) {
    appStore.showError(batchImageText('selectApiKey'))
    return null
  }
  return selectedApiKey.value
}

function validateForm(): boolean {
  if (!requireApiKey()) return false
  if (!form.model) {
    appStore.showError(availableBatchImageModels.value.length === 0 ? batchImageText('noModelsForKey') : batchImageText('selectModel'))
    return false
  }
  if (parsedItems.value.length === 0) {
    appStore.showError(batchImageText('promptRequired'))
    return false
  }
  if (estimatedOutputCount.value > BATCH_IMAGE_MAX_OUTPUTS_PER_JOB) {
    appStore.showError(batchImageText('tooManyOutputImages'))
    return false
  }
  const refLimit = selectedModelReferenceLimit.value
  if (promptRows.value.some(row => row.reference_images.length > refLimit)) {
    appStore.showError(batchImageText('tooManyReferenceImages'))
    return false
  }
  return true
}

async function submitJob() {
  if (submitting.value) return
  if (promptDraft.value.trim()) addPromptRow()
  if (!validateForm()) return
  const key = requireApiKey()
  if (!key) return
  submitting.value = true
  const detailSequenceAtSubmit = detailRequestSeq
  try {
    const job = await submitBatchImageJob(
      key.key,
      {
        model: form.model,
        task_name: form.taskName.trim() || defaultTaskName(),
        image_size: '1K',
        response_mime_type: form.responseMimeType,
        items: parsedItems.value,
      },
      `sub2api-ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    )
    // Keep the key used for submission attached to the row even if the
    // create-form selection changes before the list refresh completes.
    upsertJob(job, key)
    if (detailRequestSeq === detailSequenceAtSubmit) {
      currentJob.value = job
      selectedBatchId.value = job.id
      selectedBatchApiKeyId.value = key.id
      items.value = []
    }
    showCreateModal.value = false
    resetCreateDraft()
    appStore.showSuccess(batchImageText('submitted'))
    if (detailRequestSeq === detailSequenceAtSubmit) {
      void loadItems()
      startPolling()
    }
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, batchImageText('submitFailed')))
  } finally {
    submitting.value = false
  }
}

async function refreshSelected() {
  const batchId = selectedBatchId.value
  if (!batchId) return
  const requestID = ++detailRequestSeq
  const key = keyForSelectedBatch() || requireApiKey()
  if (!key) return
  refreshing.value = true
  try {
    const job = await getBatchImageJob(key.key, batchId)
    if (requestID !== detailRequestSeq || selectedBatchId.value !== batchId) return
    currentJob.value = job
    upsertJob(job, key)
    if (TERMINAL_STATUSES.has(job.status)) stopPolling()
  } catch (error: any) {
    if (requestID !== detailRequestSeq || selectedBatchId.value !== batchId) return
    appStore.showError(batchImageErrorMessage(error, batchImageText('refreshFailed')))
  } finally {
    if (requestID === detailRequestSeq) refreshing.value = false
  }
}

async function refreshDetail() {
  await Promise.all([
    refreshSelected(),
    loadItems(),
  ])
}

function selectJob(batchId: string) {
  detailRequestSeq += 1
  itemsRequestSeq += 1
  detailRelatedRequestSeq += 1
  const row = batchJobs.value.find(job => job.id === batchId)
    || detailRelatedJobs.value.find(job => job.id === batchId)
  if (row?.api_key_id && geminiApiKeys.value.some(key => key.id === row.api_key_id)) {
    form.apiKeyId = row.api_key_id
    selectedBatchApiKeyId.value = row.api_key_id
  } else {
    selectedBatchApiKeyId.value = 0
  }
  selectedBatchId.value = batchId
  currentJob.value = null
  // Keep a discovered child row as a temporary detail anchor until its full
  // GET response arrives.  Clearing it here made loadItems() race with
  // refreshSelected(): detailJobsForBatch saw neither batchJobs nor a current
  // job, so an out-of-page child opened with no items (and could fall back to
  // the mutable create-form API key).
  detailRelatedJobs.value = row?.parent_batch_id ? [row] : []
  items.value = []
  void refreshSelected().then(() => {
    if (
      selectedBatchId.value === batchId &&
      currentJob.value &&
      !TERMINAL_STATUSES.has(currentJob.value.status)
    ) {
      startPolling()
    }
  })
  void loadItems()
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (!currentJob.value || TERMINAL_STATUSES.has(currentJob.value.status)) {
      stopPolling()
      return
    }
    void refreshSelected()
  }, 8000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function canCancel(job: Pick<BatchImageJob, 'status'>) {
  return !TERMINAL_STATUSES.has(job.status)
}

type AggregateActionJob = Pick<BatchImageJob, 'id' | 'parent_batch_id' | 'status' | 'item_count' | 'success_count' | 'output_deleted_at'>

function aggregateActionJob(job: AggregateActionJob): AggregateActionJob | null {
  // Once a source is output-deleted the backend must return a typed Gone
  // response, even if a stale retry-child count would make the display row look
  // completed.  The same applies to a child or to any pending child source.
  if (job.status === 'output_deleted' || ('output_deleted_at' in job && job.output_deleted_at)) return null
  if (job.parent_batch_id) return job

  const children = childrenForParent(job.id)
  if (children.some(child => child.status === 'output_deleted' || !TERMINAL_STATUSES.has(child.status))) {
    return null
  }
  return displayJob(job as BatchImageJob) as AggregateActionJob
}

function canDownload(job: AggregateActionJob) {
  const effective = aggregateActionJob(job)
  if (!effective || effective.status !== 'completed' || effective.success_count <= 0) return false
  const children = childrenForParent(job.id)
  return children.length === 0 || effective.success_count >= effective.item_count
}

function canDeleteOutputs(job: AggregateActionJob) {
  const effective = aggregateActionJob(job)
  if (effective && effective.status === 'completed' && effective.success_count > 0) {
    const children = childrenForParent(job.id)
    if (children.length === 0 || effective.success_count >= effective.item_count) return true
  }
  // Failed/cancelled roots can retain a successful provider subset.  The
  // backend now accepts output cleanup for that terminal source, so expose the
  // action when it has data instead of leaking an unreachable provider ref.
  return Boolean(
    !('output_deleted_at' in job && job.output_deleted_at)
      && (job.status === 'failed' || job.status === 'cancelled')
      && job.success_count > 0,
  )
}

function canRetry(job: Pick<BatchImageJob, 'status' | 'fail_count'>) {
  if ('output_deleted_at' in job && job.output_deleted_at) return false
  const display = 'id' in job ? displayJob(job as BatchImageJob) : job
  return TERMINAL_STATUSES.has(display.status) && display.fail_count > 0
}

function applyJobApiKey(job: BatchImageJobRow | Pick<BatchImageJob, 'id'>) {
  if ('api_key_id' in job && job.api_key_id && geminiApiKeys.value.some(key => key.id === job.api_key_id)) {
    form.apiKeyId = job.api_key_id
  }
}

function apiKeyForJob(job: BatchImageJobRow | Pick<BatchImageJob, 'id'>): ApiKey | null {
  if ('api_key_id' in job && job.api_key_id) {
    return geminiApiKeys.value.find(key => key.id === job.api_key_id) || null
  }
  // Detail jobs do not carry api_key_id in the API payload. Once a row is
  // selected, keep using the key captured for that batch instead of the
  // mutable create-form selection (which may have changed in the meantime).
  if (selectedBatchId.value === job.id) {
    return keyForSelectedBatch()
  }
  return selectedApiKey.value
}

function toggleJobSelection(batchId: string, checked: boolean) {
  const next = new Set(selectedJobIds.value)
  if (checked) next.add(batchId)
  else next.delete(batchId)
  selectedJobIds.value = next
}

function toggleAllVisible(checked: boolean) {
  const next = new Set(selectedJobIds.value)
  for (const job of visibleBatchJobs.value) {
    if (checked) next.add(job.id)
    else next.delete(job.id)
  }
  selectedJobIds.value = next
}

function canDeleteRecord(job: Pick<BatchImageJob, 'status'>) {
  return TERMINAL_STATUSES.has(job.status)
}

function requestCancelSelected() {
  const job = currentJob.value
  if (!job || !canCancel(job) || cancelling.value) return
  // Snapshot both identifiers.  The detail view can change while a dialog is
  // open (for example through a route transition or a scripted keyboard
  // action); a retry must never cancel whichever job happens to be current
  // later.
  pendingConfirmation.value = {
    kind: 'cancel',
    batchId: job.id,
    apiKeyId: selectedBatchApiKeyId.value || selectedApiKey.value?.id || 0,
  }
}

function requestDeleteOutputs() {
  const job = currentJob.value
  if (!job || !canDeleteOutputs(job) || deletingOutputs.value) return
  pendingConfirmation.value = {
    kind: 'delete-outputs',
    batchId: job.id,
    apiKeyId: selectedBatchApiKeyId.value || selectedApiKey.value?.id || 0,
  }
}

function requestDeleteJob(job: BatchImageJobRow) {
  if (!canDeleteRecord(job) || deletingBatchId.value) return
  pendingConfirmation.value = { kind: 'delete', job }
}

function requestDeleteSelectedJobs() {
  if (bulkDeleting.value) return
  const jobs = selectedRows.value
    .filter(job => canDeleteRecord(job))
    .map(job => ({ ...job }))
  if (!jobs.length) return
  // Snapshot the exact rows/API-key IDs shown in the confirmation.  A user can
  // change selection or pagination while the dialog is open; the eventual
  // destructive request must not retarget a different batch.
  pendingConfirmation.value = { kind: 'delete-selected', jobs }
}

function cancelPendingConfirmation() {
  if (confirmationPending.value) return
  pendingConfirmation.value = null
}

async function confirmPendingAction() {
  const action = pendingConfirmation.value
  if (!action || confirmationPending.value) return
  let succeeded = false
  try {
    if (action.kind === 'cancel') succeeded = await cancelSelected(action.batchId, action.apiKeyId)
    else if (action.kind === 'delete-outputs') succeeded = await deleteOutputs(action.batchId, action.apiKeyId)
    else if (action.kind === 'delete') succeeded = await deleteJob(action.job)
    else succeeded = await deleteSelectedJobs(action.jobs)
  } finally {
    if (succeeded) pendingConfirmation.value = null
  }
}

async function deleteOutputs(batchId: string, apiKeyId: number): Promise<boolean> {
  if (!batchId || deletingOutputs.value) return false
  const detailSequenceAtDelete = detailRequestSeq
  const key = apiKeyId
    ? geminiApiKeys.value.find(item => item.id === apiKeyId) || null
    : keyForSelectedBatch()
  if (!key) {
    appStore.showError(batchImageText('selectApiKey'))
    return false
  }
  deletingOutputs.value = true
  try {
    await deleteBatchImageOutputs(key.key, batchId)
    previewInvalidationGeneration.set(batchId, (previewInvalidationGeneration.get(batchId) || 0) + 1)
    const deletedAt = Math.floor(Date.now() / 1000)
    invalidateJobsCache()
    batchJobs.value = batchJobs.value.map(row => row.id === batchId
      ? { ...row, status: 'output_deleted', downloaded_at: row.downloaded_at }
      : row)
    if (currentJob.value?.id === batchId) {
      currentJob.value = { ...currentJob.value, status: 'output_deleted', output_deleted_at: deletedAt }
    }
    // A delete can finish after the user has navigated to another detail.
    // Never revoke the newly selected batch's preview URLs in that case.
    if (detailRequestSeq === detailSequenceAtDelete && selectedBatchId.value === batchId) {
      clearItemPreviews()
    }
    await deleteCachedPreviewsForBatch(batchId)
    appStore.showSuccess(batchImageText('outputsDeleted'))
    return true
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, batchImageText('deleteOutputsFailed')))
    return false
  } finally {
    deletingOutputs.value = false
  }
}

async function cancelSelected(batchId: string, apiKeyId: number): Promise<boolean> {
  if (!batchId) return false
  const requestID = ++detailRequestSeq
  const key = apiKeyId
    ? geminiApiKeys.value.find(item => item.id === apiKeyId) || null
    : keyForSelectedBatch()
  if (!key) {
    appStore.showError(batchImageText('selectApiKey'))
    return false
  }
  cancelling.value = true
  try {
    const job = await cancelBatchImageJob(key.key, batchId)
    if (requestID === detailRequestSeq && selectedBatchId.value === batchId) {
      currentJob.value = job
      upsertJob(job, key)
      appStore.showSuccess(batchImageText('cancelled'))
    }
    return true
  } catch (error: any) {
    if (requestID === detailRequestSeq && selectedBatchId.value === batchId) {
      appStore.showError(batchImageErrorMessage(error, batchImageText('cancelFailed')))
    }
    return false
  } finally {
    cancelling.value = false
  }
}

async function downloadSelected() {
  if (!currentJob.value) return
  await downloadJob(currentJob.value)
}

async function retrySelected() {
  if (!currentJob.value) return
  await retryFailedJob(currentJob.value)
}

async function retryFailedJob(job: BatchImageJobRow | BatchImageJob) {
  if (!canRetry(job) || retryingBatchId.value) return
  const key = apiKeyForJob(job) || keyForSelectedBatch() || requireApiKey()
  if (!key) return
  const detailSequenceAtStart = detailRequestSeq
  const rootBatchId = rootBatchIdForRetry(job)
  retryingBatchId.value = job.id
  try {
    const retryContext = await ensureRetryContext(key.key, job)
    const sourceItems = retryContext.sourceItems
    const failedItems = sourceItems
      .filter(item => item.status === 'failed' && !retryContext.recoveredOriginalCustomIds.has(item.custom_id))
      .map((item, index) => ({ custom_id: retryCustomID(item.custom_id, index), prompt: String(item.prompt_preview || '').trim() }))
      .filter(item => item.prompt)
    if (failedItems.length === 0) {
      appStore.showError(batchImageText('retryMissingPrompts'))
      return
    }
    const retryJob = await submitBatchImageJob(
      key.key,
      {
        model: job.model,
        task_name: `${job.task_name || defaultTaskName()} ${t('batchImage.messages.retryTaskNameSuffix')}`,
        parent_batch_id: rootBatchId,
        provider: job.provider,
        image_size: '1K',
        response_mime_type: form.responseMimeType,
        items: failedItems,
      },
      `sub2api-ui-retry-${job.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    )
    upsertJob(retryJob, key)
    if (retryJob.parent_batch_id) {
      expandedParentIds.value = new Set([...expandedParentIds.value, retryJob.parent_batch_id])
    }
    // A retry may outlive a detail navigation. Keep the late response in the
    // list, but do not steal the user's newly selected detail panel.
    const selectionStillMatches = detailRequestSeq === detailSequenceAtStart
    if (selectionStillMatches) {
      currentJob.value = retryJob
      selectedBatchId.value = retryJob.id
      selectedBatchApiKeyId.value = key.id
      items.value = []
      void loadItems()
      startPolling()
    }
    appStore.showSuccess(batchImageText('retrySubmitted'))
  } catch (error: any) {
    // A retry request can finish after the user has selected another batch.
    // Do not surface a stale error toast in the new detail context.
    if (detailRequestSeq === detailSequenceAtStart) {
      appStore.showError(batchImageErrorMessage(error, batchImageText('retryFailed')))
    }
  } finally {
    retryingBatchId.value = ''
  }
}

async function ensureItemsForRetry(apiKey: string, batchId: string) {
  return listAllBatchImageItems(apiKey, batchId, 'failed')
}

async function ensureRetryContext(apiKey: string, job: BatchImageJobRow | BatchImageJob) {
  const sourceBatchId = job.parent_batch_id ? job.id : rootBatchIdForRetry(job)
  // Snapshot detail items before the first await. A retry may remain in
  // flight while the user navigates to another batch; reading the mutable
  // `items` ref later would mix that batch's child IDs into this request.
  const detailItemsAtStart = selectedBatchId.value === sourceBatchId ? [...items.value] : []
  const sourceItems = await ensureItemsForRetry(apiKey, sourceBatchId)
  const recoveredOriginalCustomIds = new Set<string>()
  if (job.parent_batch_id) return { sourceItems, recoveredOriginalCustomIds }

  // Retry children can be outside the currently visible table page. Discover
  // all child jobs before constructing the payload so a successful earlier
  // retry is never submitted again.
  const allJobs = await listAllBatchImageJobsForRetry(apiKey)
  const childIDs = new Set(
    allJobs
      .filter(candidate => candidate.parent_batch_id === sourceBatchId)
      .map(candidate => candidate.id),
  )
  for (const item of detailItemsAtStart) {
    if (item.batch_id && item.batch_id !== sourceBatchId) childIDs.add(item.batch_id)
  }
  await Promise.all([...childIDs].map(async (childID) => {
    const childItems = await listAllBatchImageItems(apiKey, childID)
    for (const item of childItems) {
      if (!isSuccessfulImageItem(item)) continue
      const sourceCustomID = retrySourceCustomID(item.custom_id)
      if (sourceCustomID) recoveredOriginalCustomIds.add(sourceCustomID)
    }
  }))
  return { sourceItems, recoveredOriginalCustomIds }
}

async function listAllBatchImageJobsForRetry(apiKey: string) {
  const allJobs: BatchImageJob[] = []
  const seenCursors = new Set<string>()
  const seenPages = new Set<string>()
  let cursor = ''
  for (let pageIndex = 0; pageIndex < 1000; pageIndex += 1) {
    if (seenCursors.has(cursor)) break
    seenCursors.add(cursor)
    const result = await listBatchImageJobs(apiKey, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })
    const page = result.data || []
    const signature = page.map(job => job.id).join('\u0000')
    if (signature && seenPages.has(signature)) break
    if (signature) seenPages.add(signature)
    allJobs.push(...page)
    if (!result.has_more || page.length === 0) break
    cursor = String(allJobs.length)
  }
  return allJobs
}

async function listAllBatchImageItems(apiKey: string, batchId: string, status = '') {
  const allItems: BatchImageItem[] = []
  let cursor = ''
  const seenCursors = new Set<string>()
  const seenPages = new Set<string>()

  // The backend defaults to 100 items. Walk every page for both detail views
  // and retries so large batches do not silently lose rows or failed inputs.
  for (let pageIndex = 0; pageIndex < 1000; pageIndex += 1) {
    if (seenCursors.has(cursor)) break
    seenCursors.add(cursor)
    const result = await listBatchImageItems(apiKey, batchId, {
      ...(status ? { status } : {}),
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })
    const page = result.data || []
    const signature = page.map(item => `${item.custom_id}:${item.status}`).join('\u0000')
    if (signature && seenPages.has(signature)) break
    if (signature) seenPages.add(signature)
    allItems.push(...page)
    if (!result.has_more || page.length === 0) break

    // Guard against a malformed fixture/server repeating a cursor so a retry
    // or detail refresh cannot spin forever.
    cursor = String(allItems.length)
  }

  return allItems
}

function retryCustomID(customID: string, index = 0) {
  const source = String(customID || 'item')
  const base = source.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'item'
  const suffix = `_retry_${Date.now().toString(36)}_${index.toString(36)}`
  // Reserve room for the generated suffix under the 255-character API/DB
  // custom_id limit so long source IDs remain retryable.
  const boundedBase = base.slice(0, Math.max(1, 255 - suffix.length)) || 'item'
  const generated = `${boundedBase}${suffix}`
  retrySourceByGeneratedID.set(generated, source)
  if (retrySourceByGeneratedID.size > 5000) {
    const oldest = retrySourceByGeneratedID.keys().next().value
    if (oldest) retrySourceByGeneratedID.delete(oldest)
  }
  return generated
}

function rootBatchIdForRetry(job: BatchImageJobRow | BatchImageJob) {
  return job.parent_batch_id || job.id
}

async function downloadJob(job: (BatchImageJobRow | Pick<BatchImageJob, 'id'>)) {
  if (downloading.value) return
  applyJobApiKey(job)
  const key = apiKeyForJob(job) || requireApiKey()
  if (!key) return
  downloading.value = true
  downloadingBatchId.value = job.id
  try {
    const blob = await downloadBatchImageZip(key.key, job.id)
    saveBlob(blob, `${job.id}.zip`)
    markJobDownloaded(job.id)
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, batchImageText('downloadFailed')))
  } finally {
    downloading.value = false
    downloadingBatchId.value = ''
  }
}

async function downloadSelectedJobs() {
  if (bulkDownloading.value || selectedDownloadableRows.value.length === 0) return
  bulkDownloading.value = true
  let completed = 0
  let failed = 0
  try {
    for (const row of selectedDownloadableRows.value) {
      const key = apiKeyForJob(row)
      if (!key) {
        failed += 1
        continue
      }
      downloading.value = true
      downloadingBatchId.value = row.id
      try {
        const blob = await downloadBatchImageZip(key.key, row.id)
        saveBlob(blob, `${row.id}.zip`)
        markJobDownloaded(row.id)
        completed += 1
      } catch {
        failed += 1
      } finally {
        downloading.value = false
        downloadingBatchId.value = ''
      }
    }
    if (failed > 0) {
      appStore.showError(batchImageText('batchDownloadPartial', { completed, failed }))
    } else if (completed > 0) {
      appStore.showSuccess(batchImageText('batchDownloadStarted'))
    }
  } finally {
    bulkDownloading.value = false
    downloading.value = false
    downloadingBatchId.value = ''
  }
}

async function deleteJob(job: BatchImageJobRow): Promise<boolean> {
  if (!canDeleteRecord(job) || deletingBatchId.value) return false
  const key = apiKeyForJob(job)
  if (!key) return false
  deletingBatchId.value = job.id
  try {
    await deleteBatchImageJobRecord(key.key, job.id)
    removeJobFromList(job.id)
    appStore.showSuccess(batchImageText('deleted'))
    return true
  } catch (error: any) {
    appStore.showError(batchImageErrorMessage(error, batchImageText('deleteFailed')))
    return false
  } finally {
    deletingBatchId.value = ''
  }
}

async function deleteSelectedJobs(snapshot?: BatchImageJobRow[]): Promise<boolean> {
  const rows = (snapshot || selectedRows.value).filter(job => canDeleteRecord(job))
  if (bulkDeleting.value || rows.length === 0) return false
  bulkDeleting.value = true
  let deletedCount = 0
  const failedIds: string[] = []
  try {
    for (const row of rows) {
      const key = apiKeyForJob(row)
      if (!key) {
        failedIds.push(row.id)
        continue
      }
      deletingBatchId.value = row.id
      try {
        await deleteBatchImageJobRecord(key.key, row.id)
        removeJobFromList(row.id)
        deletedCount += 1
      } catch {
        failedIds.push(row.id)
      }
    }
    selectedJobIds.value = new Set(failedIds)
    if (failedIds.length > 0) {
      appStore.showError(batchImageText('deletePartial', { deleted: deletedCount, failed: failedIds.length }))
    } else if (deletedCount > 0) {
      appStore.showSuccess(batchImageText('deleted'))
    }
    // Close the confirmation after at least one destructive request
    // succeeded; failed IDs remain selected so the user can retry only them.
    return deletedCount > 0
  } finally {
    bulkDeleting.value = false
    deletingBatchId.value = ''
  }
}

function markJobDownloaded(batchId: string) {
  invalidateJobsCache()
  const downloadedAt = Math.floor(Date.now() / 1000)
  batchJobs.value = batchJobs.value.map(job => job.id === batchId ? { ...job, downloaded_at: job.downloaded_at || downloadedAt } : job)
  if (currentJob.value?.id === batchId && !currentJob.value.downloaded_at) {
    currentJob.value = { ...currentJob.value, downloaded_at: downloadedAt }
  }
}

function removeJobFromList(batchId: string) {
  invalidateJobsCache()
  batchJobs.value = batchJobs.value.filter(job => job.id !== batchId)
  const removedRelated = detailRelatedJobs.value.some(job => job.id === batchId)
  if (removedRelated) {
    detailRelatedJobs.value = detailRelatedJobs.value.filter(job => job.id !== batchId)
  }
  toggleJobSelection(batchId, false)
  if (currentJob.value?.id === batchId) closeDetail()
  else if (removedRelated && currentJob.value) void loadItems()
}

function canLoadItemPreview(item: BatchImageItem) {
  return currentJob.value?.status !== 'output_deleted'
    && (item.status === 'succeeded' || item.status === 'success')
    && item.image_count > 0
}

function isSuccessfulImageItem(item: Pick<BatchImageItem, 'status' | 'image_count'>) {
  return (item.status === 'succeeded' || item.status === 'success') && item.image_count > 0
}

function detailRootBatchId() {
  return currentJob.value?.parent_batch_id || selectedBatchId.value || currentJob.value?.id || ''
}

function isChildDetailItem(item: Pick<BatchImageDetailItem, 'batch_id'>) {
  const rootBatchId = detailRootBatchId()
  return Boolean(rootBatchId && item.batch_id && item.batch_id !== rootBatchId)
}

function retrySourceCustomID(customID: string) {
  const generated = String(customID || '')
  const mapped = retrySourceByGeneratedID.get(generated)
  if (mapped) return mapped
  // Strip exactly the suffix generated by retryCustomID.  A user supplied
  // route-safe ID may itself contain `_retry_`; a repeated-group regex would
  // erase that legitimate source segment after a reload when the in-memory
  // mapping is unavailable.
  return generated.replace(/_retry_[a-z0-9]+(?:_[a-z0-9]+)?$/i, '')
}

function isRecoveredOriginalFailure(item: BatchImageDetailItem) {
  const rootBatchId = detailRootBatchId()
  return Boolean(
    rootBatchId
    && item.batch_id === rootBatchId
    && item.status === 'failed'
    && recoveredOriginalCustomIds.value.has(item.custom_id),
  )
}

function previewCacheSupported() {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

function previewCacheKey(batchId: string, customID: string, imageIndex = 0) {
  return [batchId, customID, imageIndex].map(part => encodeURIComponent(String(part))).join(':')
}

function itemPreviewKey(item: Pick<BatchImageItem, 'batch_id' | 'custom_id'>) {
  return previewCacheKey(item.batch_id || selectedBatchId.value || currentJob.value?.id || '', item.custom_id, 0)
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openPreviewCacheDB(): Promise<IDBDatabase | null> {
  if (!previewCacheSupported()) return Promise.resolve(null)
  if (previewCacheDBPromise) return previewCacheDBPromise

  previewCacheDBPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(PREVIEW_CACHE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PREVIEW_CACHE_STORE_NAME)) {
        const store = db.createObjectStore(PREVIEW_CACHE_STORE_NAME, { keyPath: 'key' })
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return previewCacheDBPromise
}

async function getCachedPreviewBlob(cacheKey: string): Promise<Blob | null> {
  const db = await openPreviewCacheDB()
  if (!db) return null
  const record = await idbRequest<PreviewCacheRecord | undefined>(
    db.transaction(PREVIEW_CACHE_STORE_NAME, 'readonly').objectStore(PREVIEW_CACHE_STORE_NAME).get(cacheKey),
  ).catch(() => undefined)
  if (!record?.blob) return null

  const now = Date.now()
  if (now - record.createdAt > PREVIEW_CACHE_MAX_AGE_MS) {
    void deleteCachedPreview(cacheKey)
    return null
  }
  void touchCachedPreview(cacheKey, now)
  return record.blob
}

async function hydrateCachedItemPreviews(detailItems: BatchImageDetailItem[]) {
  const sessionID = previewSessionSeq
  const previewableItems = detailItems.filter(item => canLoadItemPreview(item))
  if (!previewableItems.length || !previewCacheSupported()) return

  await Promise.all(previewableItems.map(async (item) => {
    const batchId = item.batch_id || selectedBatchId.value || currentJob.value?.id || ''
    const previewKey = itemPreviewKey(item)
    if (!batchId || itemPreviewUrls[previewKey] || previewErrorIds.value.has(previewKey)) return
    const invalidationGeneration = previewInvalidationGeneration.get(batchId) || 0
    const cached = await getCachedPreviewBlob(previewCacheKey(batchId, item.custom_id, 0)).catch(() => null)
    if (!cached || itemPreviewUrls[previewKey] || sessionID !== previewSessionSeq || invalidationGeneration !== (previewInvalidationGeneration.get(batchId) || 0)) return
    itemPreviewUrls[previewKey] = URL.createObjectURL(cached)
  }))
}

async function putCachedPreviewBlob(cacheKey: string, blob: Blob, batchId = '', generation = 0) {
  if (batchId && generation !== (previewInvalidationGeneration.get(batchId) || 0)) return
  const db = await openPreviewCacheDB()
  if (!db) return
  if (batchId && generation !== (previewInvalidationGeneration.get(batchId) || 0)) return
  const now = Date.now()
  const record: PreviewCacheRecord = {
    key: cacheKey,
    blob,
    size: blob.size,
    createdAt: now,
    lastAccessedAt: now,
  }
  await idbRequest(db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME).put(record)).catch(() => null)
  void cleanupPreviewCache()
}

async function touchCachedPreview(cacheKey: string, lastAccessedAt: number) {
  const db = await openPreviewCacheDB()
  if (!db) return
  const record = await idbRequest<PreviewCacheRecord | undefined>(
    db.transaction(PREVIEW_CACHE_STORE_NAME, 'readonly').objectStore(PREVIEW_CACHE_STORE_NAME).get(cacheKey),
  ).catch(() => undefined)
  if (!record) return
  record.lastAccessedAt = lastAccessedAt
  await idbRequest(db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME).put(record)).catch(() => null)
}

async function deleteCachedPreview(cacheKey: string) {
  const db = await openPreviewCacheDB()
  if (!db) return
  await idbRequest(db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME).delete(cacheKey)).catch(() => null)
}

async function deleteCachedPreviewsForBatch(batchId: string) {
  const db = await openPreviewCacheDB()
  if (!db) return
  const records = await idbRequest<PreviewCacheRecord[]>(
    db.transaction(PREVIEW_CACHE_STORE_NAME, 'readonly').objectStore(PREVIEW_CACHE_STORE_NAME).getAll(),
  ).catch(() => [])
  const prefix = `${encodeURIComponent(batchId)}:`
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
    transaction.onabort = () => resolve()
    const store = transaction.objectStore(PREVIEW_CACHE_STORE_NAME)
    for (const record of records) {
      if (record.key.startsWith(prefix)) store.delete(record.key)
    }
  })
}

async function cleanupPreviewCache() {
  const db = await openPreviewCacheDB()
  if (!db) return
  const records = await idbRequest<PreviewCacheRecord[]>(
    db.transaction(PREVIEW_CACHE_STORE_NAME, 'readonly').objectStore(PREVIEW_CACHE_STORE_NAME).getAll(),
  ).catch(() => [])
  if (!records.length) return

  const now = Date.now()
  const sorted = [...records].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
  const deleteKeys = new Set<string>()
  let totalBytes = 0
  let keptCount = 0

  for (const record of sorted) {
    if (now - record.createdAt > PREVIEW_CACHE_MAX_AGE_MS) {
      deleteKeys.add(record.key)
      continue
    }
    totalBytes += record.size || record.blob?.size || 0
    keptCount += 1
  }

  for (const record of sorted) {
    if (deleteKeys.has(record.key)) continue
    if (keptCount <= PREVIEW_CACHE_MAX_ENTRIES && totalBytes <= PREVIEW_CACHE_MAX_BYTES) break
    deleteKeys.add(record.key)
    totalBytes -= record.size || record.blob?.size || 0
    keptCount -= 1
  }

  if (!deleteKeys.size) return
  const store = db.transaction(PREVIEW_CACHE_STORE_NAME, 'readwrite').objectStore(PREVIEW_CACHE_STORE_NAME)
  for (const key of deleteKeys) {
    store.delete(key)
  }
}

async function createThumbnailBlob(blob: Blob): Promise<Blob> {
  const source = await loadPreviewImageSource(blob)
  const width = source.width
  const height = source.height
  const scale = Math.min(1, PREVIEW_THUMBNAIL_MAX_EDGE / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(source.image, 0, 0, targetWidth, targetHeight)
  source.close()
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((thumbnail) => {
      if (thumbnail) resolve(thumbnail)
      else reject(new Error('thumbnail unavailable'))
    }, 'image/webp', PREVIEW_THUMBNAIL_QUALITY)
  })
}

async function loadPreviewImageSource(blob: Blob): Promise<{ image: PreviewImageSource, width: number, height: number, close: () => void }> {
  if ('createImageBitmap' in window) {
    const bitmap = await window.createImageBitmap(blob)
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('image unavailable'))
      img.src = url
    })
    return {
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

async function loadItems() {
  const batchId = selectedBatchId.value || currentJob.value?.id || ''
  if (!batchId) return
  const requestID = ++itemsRequestSeq
  const key = keyForSelectedBatch() || requireApiKey()
  if (!key) return
  loadingItems.value = true
  try {
    const jobs = await resolveDetailJobsForBatch(batchId, key, requestID)
    if (requestID !== itemsRequestSeq || selectedBatchId.value !== batchId) return
    const results = await Promise.all(jobs.map(async (job) => {
      const detailItems = await listAllBatchImageItems(key.key, job.id)
      return detailItems.map(item => ({
        ...item,
        batch_id: job.id,
        source_task_name: detailSourceName(job, batchId),
      }))
    }))
    if (requestID !== itemsRequestSeq || selectedBatchId.value !== batchId) return
    const detailItems = results.flat()
    clearItemPreviews()
    items.value = detailItems
    void hydrateCachedItemPreviews(detailItems)
  } catch (error: any) {
    if (requestID !== itemsRequestSeq || selectedBatchId.value !== batchId) return
    appStore.showError(batchImageErrorMessage(error, batchImageText('loadItemsFailed')))
  } finally {
    if (requestID === itemsRequestSeq) loadingItems.value = false
  }
}

async function resolveDetailJobsForBatch(batchId: string, key: ApiKey, itemsRequestID: number): Promise<BatchImageJobRow[]> {
  const jobs = detailJobsForBatch(batchId)
  const base = jobs[0]
  if (!base || base.parent_batch_id) return jobs

  const relatedRequestID = ++detailRelatedRequestSeq
  try {
    // The visible table is intentionally paginated. Discover all jobs for the
    // selected key so a retry child on a later page is included in detail
    // aggregation and item loading.
    const allJobs = await listAllBatchImageJobsForRetry(key.key)
    if (
      relatedRequestID !== detailRelatedRequestSeq
      || itemsRequestID !== itemsRequestSeq
      || selectedBatchId.value !== batchId
    ) {
      return jobs
    }
    const discovered = allJobs
      .filter(job => job.parent_batch_id === batchId)
      .map(job => toJobRow(job, key))
    const existing = detailRelatedJobs.value.filter(job => job.parent_batch_id === batchId)
    const merged = new Map<string, BatchImageJobRow>()
    for (const child of [...existing, ...discovered]) merged.set(child.id, child)
    detailRelatedJobs.value = [...merged.values()].sort((a, b) => a.created_at - b.created_at)
    const childCount = detailRelatedJobs.value.filter(job => job.parent_batch_id === batchId).length
    batchJobs.value = batchJobs.value.map(row => row.id === batchId
      ? { ...row, child_count: Math.max(row.child_count, childCount) }
      : row)
    return detailJobsForBatch(batchId)
  } catch {
    // The root detail remains useful when the optional cross-page discovery
    // request fails; the normal item request below still reports its own error.
    return jobs
  }
}

function detailJobsForBatch(batchId: string): BatchImageJobRow[] {
  // A child discovered while resolving a root can live outside the current
  // page. Keep that temporary detail row as a valid base as well; otherwise a
  // direct click on the child briefly has neither a paginated row nor a
  // currentJob anchor and loadItems() resolves to an empty list.
  const row = batchJobs.value.find(job => job.id === batchId)
    || detailRelatedJobs.value.find(job => job.id === batchId)
  const base = row || (currentJob.value && currentJob.value.id === batchId ? toJobRow(currentJob.value, keyForSelectedBatch() || selectedApiKey.value) : null)
  if (!base) return []
  if (base.parent_batch_id) return [base]
  return [base, ...childrenForParent(base.id)]
}

function detailSourceName(job: Pick<BatchImageJobRow, 'id' | 'task_name' | 'parent_batch_id'>, rootBatchId: string) {
  const name = job.task_name || job.id
  if (job.id === rootBatchId) return t('batchImage.detail.mainTask', { name })
  return t('batchImage.detail.childTask', { name })
}

async function loadItemPreview(item: BatchImageItem) {
  const batchId = item.batch_id || selectedBatchId.value || currentJob.value?.id || ''
  const previewKey = itemPreviewKey(item)
  if (!batchId || !canLoadItemPreview(item) || (itemPreviewUrls[previewKey] && !previewErrorIds.value.has(previewKey))) return
  const key = keyForSelectedBatch() || requireApiKey()
  if (!key) return
  const sessionID = previewSessionSeq
  const invalidationGeneration = previewInvalidationGeneration.get(batchId) || 0
  const cacheKey = previewCacheKey(batchId, item.custom_id, 0)
  previewLoadingIds.value = new Set([...previewLoadingIds.value, previewKey])
  try {
    previewErrorIds.value = new Set([...previewErrorIds.value].filter(id => id !== previewKey))
    if (itemPreviewUrls[previewKey]) {
      URL.revokeObjectURL(itemPreviewUrls[previewKey])
      delete itemPreviewUrls[previewKey]
    }
    const cached = await getCachedPreviewBlob(cacheKey)
    if (cached) {
      if (sessionID !== previewSessionSeq || selectedBatchId.value !== batchId || invalidationGeneration !== (previewInvalidationGeneration.get(batchId) || 0)) return
      itemPreviewUrls[previewKey] = URL.createObjectURL(cached)
      return
    }
    const blob = await getBatchImageItemContent(key.key, batchId, item.custom_id, 0)
    const thumbnail = await createThumbnailBlob(blob).catch(() => blob)
    if (sessionID !== previewSessionSeq || selectedBatchId.value !== batchId || invalidationGeneration !== (previewInvalidationGeneration.get(batchId) || 0)) return
    itemPreviewUrls[previewKey] = URL.createObjectURL(thumbnail)
    if (thumbnail !== blob || thumbnail.size <= 1024 * 1024) {
      void putCachedPreviewBlob(cacheKey, thumbnail, batchId, invalidationGeneration)
    }
  } catch (error: any) {
    if (
      sessionID !== previewSessionSeq
      || selectedBatchId.value !== batchId
      || invalidationGeneration !== (previewInvalidationGeneration.get(batchId) || 0)
    ) return
    previewErrorIds.value = new Set([...previewErrorIds.value, previewKey])
    appStore.showError(batchImageErrorMessage(error, batchImageText('loadPreviewFailed')))
  } finally {
    if (sessionID === previewSessionSeq) {
      const next = new Set(previewLoadingIds.value)
      next.delete(previewKey)
      previewLoadingIds.value = next
    }
  }
}

function openImagePreview(item: BatchImageItem) {
  const previewKey = itemPreviewKey(item)
  if (!itemPreviewUrls[previewKey] || previewErrorIds.value.has(previewKey)) return
  previewImageItem.value = item
}

function closeImagePreview() {
  previewImageItem.value = null
}

function handlePreviewError(customID: string) {
  if (itemPreviewUrls[customID]) {
    URL.revokeObjectURL(itemPreviewUrls[customID])
    delete itemPreviewUrls[customID]
  }
  previewErrorIds.value = new Set([...previewErrorIds.value, customID])
}

function clearItemPreviews() {
  previewSessionSeq += 1
  for (const url of Object.values(itemPreviewUrls)) {
    if (url) URL.revokeObjectURL(url)
  }
  for (const key of Object.keys(itemPreviewUrls)) {
    delete itemPreviewUrls[key]
  }
  previewLoadingIds.value = new Set()
  previewErrorIds.value = new Set()
  previewImageItem.value = null
}

function copyInstruction() {
  void copyToClipboard(agentInstruction.value, batchImageText('copiedInstruction'))
}

function statusLabel(jobOrStatus: BatchImageStatus | Pick<BatchImageJob, 'status' | 'success_count' | 'fail_count'>) {
  const status = typeof jobOrStatus === 'string' ? jobOrStatus : jobOrStatus.status
  if (typeof jobOrStatus !== 'string' && status === 'completed' && jobOrStatus.fail_count > 0) {
    if (jobOrStatus.success_count > 0) return t('batchImage.status.partialSuccess')
    return t('batchImage.status.allFailed')
  }
  const statusKeys: Record<string, string> = {
    queued: 'queued',
    running: 'running',
    indexing: 'processingResults',
    processing_results: 'processingResults',
    settling: 'settling',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
    output_deleted: 'outputDeleted',
  }
  const key = statusKeys[status]
  return key ? t(`batchImage.status.${key}`) : status
}

function statusTone(jobOrStatus: BatchImageStatus | Pick<BatchImageJob, 'status' | 'success_count' | 'fail_count'>): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  const status = typeof jobOrStatus === 'string' ? jobOrStatus : jobOrStatus.status
  if (typeof jobOrStatus !== 'string' && status === 'completed' && jobOrStatus.fail_count > 0) {
    if (jobOrStatus.success_count > 0) return 'warning'
    return 'danger'
  }
  if (status === 'completed') return 'success'
  if (status === 'failed' || status === 'cancelled') return 'danger'
  if (status === 'output_deleted') return 'neutral'
  return 'info'
}

function itemStatusLabel(status: string) {
  const statusKeys: Record<string, string> = {
    pending: 'pending',
    succeeded: 'succeeded',
    success: 'succeeded',
    failed: 'failed',
    cancelled: 'cancelled',
  }
  const key = statusKeys[status]
  return key ? t(`batchImage.itemStatus.${key}`) : status
}

function itemDisplayStatusLabel(item: BatchImageDetailItem) {
  if (isRecoveredOriginalFailure(item)) return t('batchImage.itemStatus.recovered')
  return itemStatusLabel(item.status)
}

function itemStatusTone(item: BatchImageDetailItem): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (isRecoveredOriginalFailure(item)) return 'neutral'
  if (item.status === 'succeeded' || item.status === 'success') return 'success'
  if (item.status === 'failed' || item.status === 'cancelled') return 'danger'
  return 'info'
}

function itemResultLabel(item: BatchImageDetailItem) {
  if (isRecoveredOriginalFailure(item)) return t('batchImage.itemResult.recoveredByRetry')
  if (item.error) return friendlyItemError(item.error)
  if (item.status === 'succeeded' || item.status === 'success') {
    return itemPreviewUrls[itemPreviewKey(item)] ? t('batchImage.itemResult.readyPreview') : t('batchImage.itemResult.readyDownload')
  }
  if (item.status === 'failed') return t('batchImage.itemResult.noUsableImage')
  if (item.status === 'cancelled') return t('batchImage.itemResult.cancelled')
  return t('batchImage.itemResult.waiting')
}

function itemResultTone(item: BatchImageDetailItem): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (isRecoveredOriginalFailure(item)) return 'neutral'
  if (item.error || item.status === 'failed' || item.status === 'cancelled') return 'danger'
  if (item.status === 'succeeded' || item.status === 'success') return 'success'
  return 'neutral'
}

function friendlyItemError(error: BatchImageItem['error']) {
  if (!error) return '-'
  if (error.code === 'EMPTY_IMAGE_OUTPUT') return t('batchImage.itemResult.emptyImageOutput')
  if (error.code === 'PROVIDER_ITEM_FAILED') return t('batchImage.itemResult.providerItemFailed')
  return error.message || error.code || '-'
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '$0.00'
  return `$${Number(value).toFixed(2)}`
}

function terminalZeroCost(job: Pick<BatchImageJob, 'status' | 'actual_cost'>) {
  return job.actual_cost === null && (job.status === 'failed' || job.status === 'cancelled')
}

function costLabel(job: Pick<BatchImageJob, 'status' | 'hold_amount' | 'actual_cost'>) {
  if (job.actual_cost !== null) return formatMoney(job.actual_cost)
  if (terminalZeroCost(job)) return formatMoney(0)
  return t('batchImage.detail.holdCost', { amount: formatMoney(job.hold_amount) })
}

type BatchImageTextKey =
  | 'loadKeysFailed'
  | 'loadModelsFailed'
  | 'loadJobsFailed'
  | 'selectApiKey'
  | 'noModelsForKey'
  | 'selectModel'
  | 'promptRequired'
  | 'submitted'
  | 'submitFailed'
  | 'refreshFailed'
  | 'cancelConfirm'
  | 'deleteOutputsConfirm'
  | 'cancelled'
  | 'cancelFailed'
  | 'outputsDeleted'
  | 'deleteOutputsFailed'
  | 'batchDownloadStarted'
	  | 'batchDownloadPartial'
	  | 'downloadFailed'
	  | 'retrySubmitted'
	  | 'retryFailed'
	  | 'retryMissingPrompts'
  | 'deleteConfirm'
  | 'deleteSelectedConfirm'
  | 'deleted'
  | 'deleteFailed'
	  | 'deletePartial'
	  | 'loadItemsFailed'
	  | 'loadPreviewFailed'
  | 'copiedInstruction'
  | 'loadingModels'
  | 'noModels'
  | 'noModelsHint'
  | 'noCompatibleAccount'
  | 'unsupportedProvider'
  | 'providerSubmitFailed'
  | 'vertexGcsBucketMissing'
  | 'queueFailed'
  | 'billingHoldFailed'
  | 'groupDisabled'
  | 'pricingMissing'
  | 'insufficientBalance'
  | 'invalidModel'
  | 'invalidItems'
  | 'duplicateCustomId'
  | 'promptTooLong'
  | 'invalidReferenceImage'
  | 'tooManyReferenceImages'
  | 'referenceImagesTooLarge'
  | 'tooManyOutputImages'
  | 'idempotencyConflict'
  | 'notReady'
  | 'outputDeleted'
  | 'resultMissing'
  | 'itemFailed'
  | 'itemImageIndexOutOfRange'
  | 'downloadLimited'
  | 'downloadTooLarge'
  | 'deleteNotReady'
  | 'disabled'
  | 'authRequired'
  | 'adminReference'
  | 'errorReference'

function isZhLocale() {
  return String(locale.value || '').toLowerCase().startsWith('zh')
}

function batchImageText(key: BatchImageTextKey, params?: Record<string, unknown>) {
	return t(`batchImage.messages.${key}`, params || {})
}

function batchImageErrorReference(error: any) {
  const parts: string[] = []
  const code = String(error?.code || '').trim()
  const requestId = String(error?.requestId || '').trim()
  const status = String(error?.status || '').trim()
  if (code) parts.push(t('batchImage.messages.errorCodeRef', { code }))
  if (requestId) parts.push(t('batchImage.messages.requestIdRef', { id: requestId }))
  if (!code && status) parts.push(t('batchImage.messages.httpStatusRef', { status }))
  return parts.length ? `（${parts.join(isZhLocale() ? '，' : ', ')}）` : ''
}

function batchImageAdminError(base: string, error: any) {
  const reference = batchImageErrorReference(error)
  return `${base}${reference ? ` ${reference}` : ''} ${batchImageText('adminReference')}`
}

function batchImagePlainError(base: string) {
  return base
}

function batchImageErrorMessage(error: any, fallback: string) {
  const code = String(error?.code || '').trim()
  const message = String(error?.message || '').trim()
  if (code === 'API_KEY_REQUIRED' || code === '401') {
    return batchImagePlainError(batchImageText('authRequired'))
  }
  if (code === 'BATCH_IMAGE_NO_ACCOUNT_AVAILABLE' || /no compatible batch image account/i.test(message)) {
    return batchImageAdminError(batchImageText('noCompatibleAccount'), error)
  }
  if (code === 'BATCH_IMAGE_UNSUPPORTED_PROVIDER' || /unsupported batch image provider/i.test(message)) {
    return batchImageAdminError(batchImageText('unsupportedProvider'), error)
  }
  if (code === 'BATCH_IMAGE_VERTEX_GCS_BUCKET_MISSING' || code === 'VERTEX_MANAGED_GCS_BUCKET_MISSING') {
    return batchImageAdminError(batchImageText('vertexGcsBucketMissing'), error)
  }
  if (
    code === 'BATCH_IMAGE_PROVIDER_SUBMIT_FAILED' ||
    code === 'BATCH_IMAGE_PROVIDER_MISSING_API_KEY' ||
    code === 'BATCH_IMAGE_PROVIDER_MISSING_SERVICE_ACCOUNT' ||
    code === 'BATCH_IMAGE_PROVIDER_UNSUPPORTED_ACCOUNT'
  ) {
    return batchImageAdminError(batchImageText('providerSubmitFailed'), error)
  }
  if (code === 'BATCH_IMAGE_QUEUE_FAILED' || code === 'BATCH_IMAGE_QUEUE_NOT_CONFIGURED') {
    return batchImageAdminError(batchImageText('queueFailed'), error)
  }
  if (code === 'BATCH_IMAGE_BILLING_HOLD_FAILED') {
    return batchImageAdminError(batchImageText('billingHoldFailed'), error)
  }
  if (code === 'BATCH_IMAGE_GROUP_DISABLED') {
    return batchImagePlainError(batchImageText('groupDisabled'))
  }
  if (code === 'BATCH_IMAGE_SETTLEMENT_PRICING_MISSING') {
    return batchImageAdminError(batchImageText('pricingMissing'), error)
  }
  if (code === 'BATCH_IMAGE_INSUFFICIENT_BALANCE') {
    return batchImagePlainError(batchImageText('insufficientBalance'))
  }
  if (code === 'BATCH_IMAGE_INVALID_MODEL') {
    return batchImageText('invalidModel')
  }
  if (code === 'BATCH_IMAGE_INVALID_ITEMS') {
    return batchImageText('invalidItems')
  }
  if (code === 'BATCH_IMAGE_DUPLICATE_CUSTOM_ID') {
    return batchImageText('duplicateCustomId')
  }
  if (code === 'BATCH_IMAGE_PROMPT_TOO_LONG') {
    return batchImageText('promptTooLong')
  }
  if (code === 'BATCH_IMAGE_INVALID_REFERENCE_IMAGE') {
    return batchImageText('invalidReferenceImage')
  }
  if (code === 'BATCH_IMAGE_TOO_MANY_REFERENCE_IMAGES') {
    return batchImageText('tooManyReferenceImages')
  }
  if (code === 'BATCH_IMAGE_REFERENCE_IMAGES_TOO_LARGE') {
    return batchImageText('referenceImagesTooLarge')
  }
  if (code === 'BATCH_IMAGE_TOO_MANY_OUTPUT_IMAGES') {
    return batchImageText('tooManyOutputImages')
  }
  if (code === 'BATCH_IMAGE_IDEMPOTENCY_CONFLICT') {
    return batchImagePlainError(batchImageText('idempotencyConflict'))
  }
  if (code === 'BATCH_IMAGE_NOT_READY') {
    return batchImageText('notReady')
  }
  if (code === 'BATCH_IMAGE_OUTPUT_DELETED') {
    return batchImageText('outputDeleted')
  }
  if (code === 'BATCH_IMAGE_RESULT_MISSING') {
    return batchImageAdminError(batchImageText('resultMissing'), error)
  }
  if (code === 'BATCH_IMAGE_ITEM_FAILED') {
    return batchImagePlainError(batchImageText('itemFailed'))
  }
  if (code === 'BATCH_IMAGE_ITEM_IMAGE_INDEX_OUT_OF_RANGE') {
    return batchImagePlainError(batchImageText('itemImageIndexOutOfRange'))
  }
  if (code === 'BATCH_IMAGE_DOWNLOAD_LIMITED') {
    return batchImageText('downloadLimited')
  }
  if (code === 'BATCH_IMAGE_DOWNLOAD_TOO_LARGE') {
    return batchImageText('downloadTooLarge')
  }
  if (code === 'BATCH_IMAGE_RECORD_DELETE_NOT_READY') {
    return batchImagePlainError(batchImageText('deleteNotReady'))
  }
  if (code === 'BATCH_IMAGE_DISABLED') {
    return batchImageAdminError(batchImageText('disabled'), error)
  }
  if (code === 'INTERNAL_ERROR' || code === '500') {
    return batchImageAdminError(fallback, error)
  }
  if (isZhLocale()) {
    const detail = message ? `${batchImageText('errorReference')}：${message}` : batchImageText('adminReference')
    return `${fallback}。${detail} ${batchImageErrorReference(error)}`
  }
  return message || fallback
}

function formatDate(timestamp: number) {
  if (!timestamp) return ''
  return new Date(timestamp * 1000).toLocaleString()
}

function defaultTaskName(timestamp?: number) {
  const date = timestamp ? new Date(timestamp * 1000) : new Date()
  return date.toLocaleString()
}

onMounted(() => {
  void appStore.fetchPublicSettings()
  void refreshPage()
  void cleanupPreviewCache()
  previewCacheCleanupTimer = setInterval(() => {
    void cleanupPreviewCache()
  }, 60 * 60 * 1000)
})

watch(
  () => form.apiKeyId,
  () => {
    void loadAvailableModels()
  },
)

watch(
  () => form.model,
  () => {
    const limit = selectedModelReferenceLimit.value
    if (limit <= 0) {
      referenceImageDrafts.value = []
      return
    }
    if (referenceImageDrafts.value.length > limit) {
      referenceImageDrafts.value = referenceImageDrafts.value.slice(0, limit)
    }
  },
)

onBeforeUnmount(() => {
  disposed = true
  modelRequestSeq += 1
  jobsRequestSeq += 1
  detailRequestSeq += 1
  itemsRequestSeq += 1
  apiKeysRequestSeq += 1
  apiKeysRequestController?.abort()
  apiKeysRequestController = null
  apiKeysLoadPromise = null
  stopPolling()
  if (previewCacheCleanupTimer) {
    clearInterval(previewCacheCleanupTimer)
    previewCacheCleanupTimer = null
  }
  clearItemPreviews()
})
</script>

<style scoped>
.batch-image-page{display:grid;gap:18px}.batch-job-name{display:flex;width:210px;align-items:flex-start;gap:4px}.batch-job-name--child{padding-left:18px}.batch-job-name__indent{width:24px;flex:0 0 24px}.batch-job-name__button{display:grid;min-width:0;flex:1;gap:3px;padding:2px 4px;border:0;border-radius:var(--ui-radius);color:var(--ui-text);background:transparent;text-align:left}.batch-job-name__button:hover{background:var(--ui-surface-muted)}.batch-job-name__button:focus-visible{outline:2px solid color-mix(in srgb,var(--ui-focus) 24%,transparent);outline-offset:1px}.batch-job-name__title{display:flex;min-width:0;align-items:center;gap:6px}.batch-job-name__title>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.batch-job-name time{color:var(--ui-text-soft);font-size:11px;line-height:16px}.batch-cell-ellipsis{display:block;max-width:150px;overflow:hidden;color:var(--ui-text-muted);text-align:center;text-overflow:ellipsis;white-space:nowrap}.batch-result-count{display:inline-flex;align-items:center;gap:6px;color:var(--ui-text-soft)}.batch-result-count strong{color:var(--ui-text-muted);font-weight:600}.batch-result-count .is-success{color:var(--ui-success)}.batch-result-count .is-danger{color:var(--ui-danger)}.batch-result-count small{font-size:10px}.batch-row-actions{display:flex;align-items:center;justify-content:center;gap:2px}.batch-pagination{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px}.batch-pagination__summary,.batch-pagination__actions{display:flex;align-items:center;gap:10px}.batch-pagination__summary{color:var(--ui-text-muted);font-size:12px}.batch-pagination__summary>*:last-child{width:82px}.batch-detail{display:grid;gap:18px}.batch-detail__header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid var(--ui-border-soft)}.batch-detail__header>div{display:grid;min-width:0;gap:4px}.batch-detail__header>div:last-child{display:flex;max-width:48%;flex-wrap:wrap;justify-content:flex-end;gap:6px}.batch-detail__header strong,.batch-detail__header span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.batch-detail__header strong{font-size:14px}.batch-detail__header .ui-mono{color:var(--ui-text-soft);font-size:11px}.batch-detail__metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.batch-detail-table{width:100%;border-collapse:collapse;color:var(--ui-text);background:var(--ui-surface);font-size:12px;table-layout:fixed}.batch-detail-table th,.batch-detail-table td{padding:9px 10px;border-bottom:1px solid var(--ui-border-soft);text-align:center;vertical-align:middle}.batch-detail-table th{color:var(--ui-text-soft);background:var(--ui-surface-muted);font-weight:500}.batch-detail-table th:nth-child(1){width:17%}.batch-detail-table th:nth-child(2){width:34%;text-align:left}.batch-detail-table th:nth-child(3){width:13%}.batch-detail-table th:nth-child(4){width:10%}.batch-detail-table th:nth-child(5){width:26%}.batch-detail-table td:nth-child(2){text-align:left}.batch-detail-table tr.is-recovered{color:var(--ui-text-soft);background:var(--ui-surface-muted)}.batch-detail-table .ui-mono,.batch-prompt-cell{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.batch-prompt-cell{max-width:100%;border-radius:var(--ui-radius);line-height:24px}.batch-prompt-cell:focus-visible{outline:2px solid color-mix(in srgb,var(--ui-focus) 24%,transparent);outline-offset:1px}.batch-thumbnail{display:block;width:44px;height:44px;margin:auto;padding:0;overflow:hidden;border:1px solid var(--ui-border);border-radius:var(--ui-radius);background:var(--ui-surface-muted)}.batch-thumbnail img{display:block;width:100%;height:100%;object-fit:cover;user-select:none}.batch-preview-unavailable{display:grid;width:28px;height:28px;margin:auto;place-items:center;color:var(--ui-text-soft)}.batch-dialog-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.batch-create{display:grid;grid-template-columns:minmax(240px,.72fr) minmax(0,1.28fr);gap:20px}.batch-create__settings,.batch-create__prompts{display:grid;align-content:start;gap:12px}.batch-create__settings{padding-right:20px;border-right:1px solid var(--ui-border-soft)}.batch-create__prompt-heading{display:flex;min-height:24px;align-items:center;justify-content:space-between;gap:10px;color:var(--ui-text-muted);font-size:13px}.batch-create__prompt-fields{display:grid;grid-template-columns:minmax(130px,1fr) 132px auto;gap:8px;align-items:end}.batch-reference-list{display:flex;flex-wrap:wrap;gap:6px}.batch-reference-list span{display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.batch-reference-list button{display:grid;width:16px;height:16px;padding:0;place-items:center;border:0;color:var(--ui-text-soft);background:transparent}.batch-reference-list button:hover{color:var(--ui-danger)}.batch-prompt-list{border-top:1px solid var(--ui-border-soft)}.batch-prompt-list__row{display:grid;grid-template-columns:90px minmax(0,1fr) auto auto 28px;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--ui-border-soft)}.batch-prompt-list__row>span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.batch-prompt-list__row>.ui-mono{color:var(--ui-text-soft);font-size:11px}.batch-create__notice{grid-column:1/-1}.batch-guide{display:grid;gap:20px}.batch-guide ol{display:grid;gap:8px;margin:0;padding-left:20px;color:var(--ui-text-muted);font-size:13px;line-height:21px}@media(max-width:900px){.batch-detail__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.batch-create{grid-template-columns:1fr}.batch-create__settings{padding-right:0;padding-bottom:18px;border-right:0;border-bottom:1px solid var(--ui-border-soft)}}@media(max-width:640px){.batch-pagination{align-items:flex-start;flex-direction:column}.batch-pagination__summary{width:100%;flex-wrap:wrap}.batch-pagination__actions{width:100%;justify-content:flex-end}.batch-detail__header{flex-direction:column}.batch-detail__header>div:last-child{max-width:100%;justify-content:flex-start}.batch-detail__metrics{grid-template-columns:1fr}.batch-create__prompt-fields{grid-template-columns:1fr 1fr}.batch-create__prompt-fields>*:last-child{grid-column:1/-1}.batch-prompt-list__row{grid-template-columns:72px minmax(0,1fr) 28px}.batch-prompt-list__row>*:nth-child(3),.batch-prompt-list__row>*:nth-child(4){display:none}}
</style>
