<template>
  <AppSection :title="t('admin.promptAudit.events.title')" :description="t('admin.promptAudit.events.description')">
    <template #actions>
      <div class="prompt-events__header-actions">
        <UiButton density="dense" :disabled="selectedIds.length === 0" @click="emit('batch-delete')">
          {{ t('admin.promptAudit.events.deleteSelected', { count: selectedIds.length }) }}
        </UiButton>
        <UiButton data-test="filter-delete" density="dense" variant="danger" @click="emit('preview-delete')">
          {{ t('admin.promptAudit.events.deleteByFilter') }}
        </UiButton>
      </div>
    </template>

    <form @submit.prevent="applyFilters">
      <UiFilterBar :active-count="activeFilterCount" :clear-label="t('admin.promptAudit.events.clearFilters')" @clear="resetFilters">
        <UiSelect v-model="localFilters.decision" class="prompt-events__filter" density="dense" :label="t('admin.promptAudit.events.decision')" :options="decisionOptions" @change="filtersChanged" />
        <UiSelect v-model="localFilters.risk_level" class="prompt-events__filter" density="dense" :label="t('admin.promptAudit.events.risk')" :options="riskOptions" @change="filtersChanged" />
        <UiTextField v-model="localFilters.endpoint" class="prompt-events__filter" density="dense" :label="t('admin.promptAudit.events.endpoint')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.group_id" class="prompt-events__filter prompt-events__filter--short" type="number" density="dense" :label="t('admin.promptAudit.events.groupId')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.user_id" class="prompt-events__filter prompt-events__filter--short" type="number" density="dense" :label="t('admin.promptAudit.events.userId')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.api_key_id" class="prompt-events__filter prompt-events__filter--short" type="number" density="dense" :label="t('admin.promptAudit.events.apiKeyId')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.request_id" class="prompt-events__filter" density="dense" monospace :label="t('admin.promptAudit.events.requestId')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.prompt_hash" class="prompt-events__filter" density="dense" monospace :label="t('admin.promptAudit.events.promptHash')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.keyword" class="prompt-events__filter" density="dense" :label="t('admin.promptAudit.events.keyword')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.start_at" class="prompt-events__filter" type="datetime-local" density="dense" :label="t('admin.promptAudit.events.startAt')" @change="filtersChanged" />
        <UiTextField v-model="localFilters.end_at" class="prompt-events__filter" type="datetime-local" density="dense" :label="t('admin.promptAudit.events.endAt')" @change="filtersChanged" />
        <template #actions>
          <UiButton type="submit" density="dense" variant="primary">{{ t('common.search') }}</UiButton>
        </template>
      </UiFilterBar>
    </form>

    <UiAlert v-if="error" class="prompt-events__error" tone="danger" :message="error" />

    <div class="prompt-events__table-shell">
      <UiMobileTableScroller
        :label="t('admin.promptAudit.events.tableRegion')"
        min-width="1120px"
      >
        <UiDataTable
        :columns="columns"
        :data="events"
        :loading="loading"
        mobile-table
        selectable
        row-key="id"
        :selected-keys="selectedIds"
        :selection-label="selectionLabel"
        :aria-label="t('admin.promptAudit.events.tableRegion')"
        @update:selected-keys="emit('selection', $event.map(Number))"
      >
        <template #empty>
          <UiEmptyState :title="t('admin.promptAudit.events.empty')" />
        </template>
        <template #cell-created_at="{ row: event }">
          <time class="prompt-events__time" :datetime="event.created_at">{{ formatDate(event.created_at) }}</time>
        </template>
        <template #cell-identity="{ row: event }">
          <div v-for="identity in identityRows(event)" :key="identity.label" class="prompt-events__identity">
            <span>{{ identity.label }}</span><b :title="identity.value">{{ identity.value || '—' }}</b>
            <UiCopyButton v-if="identity.value" :value="identity.value" :label="`${t('common.copy')} ${identity.label}`" :success-text="t('common.copied')" density="mini" variant="ghost" @error="appStore.showError(t('common.copyFailed'))" />
          </div>
        </template>
        <template #cell-group="{ row: event }">{{ event.snapshot.group_name || '—' }}</template>
        <template #cell-route="{ row: event }">
          <strong class="prompt-events__route">{{ event.snapshot.endpoint }}</strong>
          <small class="prompt-events__metadata">{{ event.snapshot.model }} · {{ event.snapshot.protocol }} · {{ event.snapshot.stage || 'http' }}</small>
        </template>
        <template #cell-result="{ row: event }">
          <UiBadge :tone="decisionTone(event.decision)">{{ formatDecisionRisk(event.decision, event.risk_level) }}</UiBadge>
          <small class="prompt-events__categories" :title="formatCategories(event.categories)">{{ formatCategories(event.categories) }}</small>
        </template>
        <template #cell-preview="{ row: event }">
          <p class="prompt-events__preview">{{ event.snapshot.redacted_preview || '—' }}</p>
        </template>
        <template #cell-actions="{ row: event }">
          <div class="prompt-events__row-actions">
            <UiButton density="mini" variant="quiet" @click="emit('view', event.id)">{{ t('common.view') }}</UiButton>
            <UiButton density="mini" variant="danger" @click="emit('delete', event.id)">{{ t('common.delete') }}</UiButton>
          </div>
        </template>
        </UiDataTable>
      </UiMobileTableScroller>
      <UiPagination
        :total="total"
        :page="page"
        :page-size="pageSize"
        :reset-page-on-page-size-change="false"
        :summary-label="t('admin.promptAudit.events.paginationSummary')"
        :page-size-label="t('admin.promptAudit.events.pageSize')"
        :previous-label="t('admin.promptAudit.events.previousPage')"
        :next-label="t('admin.promptAudit.events.nextPage')"
        @update:page="emit('page', $event)"
        @update:page-size="emit('page-size', $event)"
      />
    </div>
  </AppSection>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  AppSection,
  UiAlert,
  UiBadge,
  UiButton,
  UiCopyButton,
  UiDataTable,
  UiEmptyState,
  UiFilterBar,
  UiMobileTableScroller,
  UiPagination,
  UiSelect,
  UiTextField,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { useAppStore } from '@/stores/app'
import type { PromptAuditEvent, PromptEventFilters } from '../types'
import { cloneData, emptyEventFilters, eventQueryParams, SCANNER_CATALOG } from '../viewModel'

const props = defineProps<{
  events: PromptAuditEvent[]
  total: number
  page: number
  pageSize: number
  filters: PromptEventFilters
  selectedIds: number[]
  loading: boolean
  error: string
}>()
const emit = defineEmits<{
  (event: 'filters-change', value: PromptEventFilters): void
  (event: 'search', value: PromptEventFilters): void
  (event: 'selection', value: number[]): void
  (event: 'page', value: number): void
  (event: 'page-size', value: number): void
  (event: 'view', id: number): void
  (event: 'delete', id: number): void
  (event: 'batch-delete'): void
  (event: 'preview-delete'): void
}>()
const { t, locale } = useI18n()
const appStore = useAppStore()
const localFilters = reactive<PromptEventFilters>(cloneData(props.filters))
watch(() => props.filters, (value) => Object.assign(localFilters, cloneData(value)), { deep: true })
const activeFilterCount = computed(() => Object.keys(eventQueryParams(localFilters)).length)
const columns = computed<Column[]>(() => [
  { key: 'created_at', label: t('admin.promptAudit.events.time'), class: 'prompt-events__column-time' },
  { key: 'identity', label: t('admin.promptAudit.events.identity'), class: 'prompt-events__column-identity' },
  { key: 'group', label: t('admin.promptAudit.events.group') },
  { key: 'route', label: t('admin.promptAudit.events.route'), class: 'prompt-events__column-route' },
  { key: 'result', label: t('admin.promptAudit.events.result') },
  { key: 'preview', label: t('admin.promptAudit.events.preview'), class: 'prompt-events__column-preview' },
  { key: 'actions', label: t('admin.promptAudit.common.actions'), class: 'prompt-events__column-actions' },
])
const decisionOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'pass', label: t('admin.promptAudit.decisions.pass') },
  { value: 'flag', label: t('admin.promptAudit.decisions.flag') },
  { value: 'critical', label: t('admin.promptAudit.decisions.critical') },
])
const riskOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'low', label: t('admin.promptAudit.riskLevels.low') },
  { value: 'medium', label: t('admin.promptAudit.riskLevels.medium') },
  { value: 'high', label: t('admin.promptAudit.riskLevels.high') },
  { value: 'critical', label: t('admin.promptAudit.riskLevels.critical') },
])

function filtersChanged() { emit('filters-change', cloneData(localFilters)) }
function applyFilters() {
  const value = cloneData(localFilters)
  emit('filters-change', value)
  emit('search', value)
}
function resetFilters() {
  Object.assign(localFilters, emptyEventFilters())
  applyFilters()
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
}
function selectionLabel(event: PromptAuditEvent): string {
  return t('admin.promptAudit.events.selectEvent', { id: event.id })
}
function identityRows(event: PromptAuditEvent) {
  return [
    { label: t('admin.promptAudit.events.user'), value: event.snapshot.username },
    { label: t('admin.promptAudit.events.email'), value: event.snapshot.user_email },
    { label: t('admin.promptAudit.events.apiKey'), value: event.snapshot.api_key_name },
  ]
}
function decisionTone(decision: string): 'success' | 'warning' | 'danger' {
  if (decision === 'critical') return 'danger'
  if (decision === 'flag') return 'warning'
  return 'success'
}
const DECISIONS = new Set(['pass', 'flag', 'critical'])
const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical'])
function translateDecision(decision: string): string { return DECISIONS.has(decision) ? t(`admin.promptAudit.decisions.${decision}`) : decision }
function translateRiskLevel(riskLevel: string): string { return RISK_LEVELS.has(riskLevel) ? t(`admin.promptAudit.riskLevels.${riskLevel}`) : riskLevel }
function translateCategory(category: string): string { return SCANNER_CATALOG.some((scanner) => scanner.id === category) ? t(`admin.promptAudit.scanners.${category}`) : category }
function formatDecisionRisk(decision: string, riskLevel: string): string { return `${translateDecision(decision)} · ${translateRiskLevel(riskLevel)}` }
function formatCategories(categories: string[]): string { return categories.length ? categories.map(translateCategory).join(', ') : '—' }
</script>

<style scoped>
.prompt-events__header-actions,.prompt-events__row-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.prompt-events__filter{width:170px}.prompt-events__filter--short{width:124px}
.prompt-events__error{margin-top:12px}
.prompt-events__table-shell{min-width:0;margin-top:12px;border-block:1px solid var(--ui-border-soft)}
.prompt-events__time{color:var(--ui-text-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.prompt-events__identity{display:grid;max-width:240px;grid-template-columns:58px minmax(0,1fr) 28px;align-items:center;gap:5px;min-height:24px}
.prompt-events__identity>span{color:var(--ui-text-soft)}.prompt-events__identity>b{min-width:0;overflow:hidden;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
.prompt-events__route{display:block;font-weight:600}.prompt-events__metadata,.prompt-events__categories{display:block;max-width:240px;margin-top:4px;overflow:hidden;color:var(--ui-text-soft);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.prompt-events__preview{display:-webkit-box;max-width:300px;margin:0;overflow:hidden;color:var(--ui-text-muted);line-height:18px;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2}
@media(max-width:640px){.prompt-events__header-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.prompt-events__filter,.prompt-events__filter--short{width:auto}}
</style>
