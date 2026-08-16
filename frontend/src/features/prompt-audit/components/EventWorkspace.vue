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
      <UiMobileTableScroller :label="t('admin.promptAudit.events.tableRegion')" min-width="1120px">
        <table class="prompt-events__table">
          <thead>
            <tr>
              <th class="prompt-events__select"><UiCheckbox :model-value="allSelected" :aria-label="t('admin.promptAudit.events.selectAll')" @update:model-value="toggleAll" /></th>
              <th>{{ t('admin.promptAudit.events.time') }}</th>
              <th>{{ t('admin.promptAudit.events.identity') }}</th>
              <th>{{ t('admin.promptAudit.events.group') }}</th>
              <th>{{ t('admin.promptAudit.events.route') }}</th>
              <th>{{ t('admin.promptAudit.events.result') }}</th>
              <th>{{ t('admin.promptAudit.events.preview') }}</th>
              <th class="prompt-events__actions-heading">{{ t('admin.promptAudit.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" aria-busy="true">
                <div class="prompt-events__loading"><UiSkeleton v-for="index in 6" :key="index" variant="text" height="14px" /></div>
              </td>
            </tr>
            <tr v-else-if="events.length === 0">
              <td colspan="8"><UiEmptyState :title="t('admin.promptAudit.events.empty')" /></td>
            </tr>
            <tr v-for="event in events" v-else :key="event.id" :data-test="`event-${event.id}`">
              <td class="prompt-events__select"><UiCheckbox :model-value="selectedIds.includes(event.id)" :aria-label="t('admin.promptAudit.events.selectEvent', { id: event.id })" @update:model-value="toggleOne(event.id)" /></td>
              <td class="prompt-events__time">{{ formatDate(event.created_at) }}</td>
              <td>
                <div v-for="identity in identityRows(event)" :key="identity.label" class="prompt-events__identity">
                  <span>{{ identity.label }}</span><b :title="identity.value">{{ identity.value || '—' }}</b>
                  <UiCopyButton v-if="identity.value" :value="identity.value" :label="`${t('common.copy')} ${identity.label}`" :success-text="t('common.copied')" density="mini" variant="ghost" @error="appStore.showError(t('common.copyFailed'))" />
                </div>
              </td>
              <td>{{ event.snapshot.group_name || '—' }}</td>
              <td>
                <strong class="prompt-events__route">{{ event.snapshot.endpoint }}</strong>
                <small class="prompt-events__metadata">{{ event.snapshot.model }} · {{ event.snapshot.protocol }} · {{ event.snapshot.stage || 'http' }}</small>
              </td>
              <td>
                <UiBadge :tone="decisionTone(event.decision)">{{ formatDecisionRisk(event.decision, event.risk_level) }}</UiBadge>
                <small class="prompt-events__categories" :title="formatCategories(event.categories)">{{ formatCategories(event.categories) }}</small>
              </td>
              <td><p class="prompt-events__preview">{{ event.snapshot.redacted_preview || '—' }}</p></td>
              <td>
                <div class="prompt-events__row-actions">
                  <UiButton density="mini" variant="quiet" @click="emit('view', event.id)">{{ t('common.view') }}</UiButton>
                  <UiButton density="mini" variant="danger" @click="emit('delete', event.id)">{{ t('common.delete') }}</UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
  UiCheckbox,
  UiCopyButton,
  UiEmptyState,
  UiFilterBar,
  UiMobileTableScroller,
  UiPagination,
  UiSelect,
  UiSkeleton,
  UiTextField,
} from '@/components/ui'
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
const allSelected = computed(() => props.events.length > 0 && props.events.every((event) => props.selectedIds.includes(event.id)))
const activeFilterCount = computed(() => Object.keys(eventQueryParams(localFilters)).length)
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
function toggleOne(id: number) {
  const selected = new Set(props.selectedIds)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  emit('selection', [...selected])
}
function toggleAll() { emit('selection', allSelected.value ? [] : props.events.map((event) => event.id)) }
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
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
.prompt-events__table{width:100%;border-collapse:collapse;color:var(--ui-text);font-size:12px;text-align:left}
.prompt-events__table th{height:34px;padding:6px 10px;border-bottom:1px solid var(--ui-border);color:var(--ui-text-soft);background:var(--ui-surface-muted);font-size:11px;font-weight:600;white-space:nowrap}
.prompt-events__table td{padding:9px 10px;border-bottom:1px solid var(--ui-border-soft);vertical-align:top}
.prompt-events__table tbody tr:hover{background:var(--ui-surface-muted)}
.prompt-events__select{width:36px}.prompt-events__time{color:var(--ui-text-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.prompt-events__actions-heading{text-align:right}
.prompt-events__identity{display:grid;max-width:240px;grid-template-columns:58px minmax(0,1fr) 28px;align-items:center;gap:5px;min-height:24px}
.prompt-events__identity>span{color:var(--ui-text-soft)}.prompt-events__identity>b{min-width:0;overflow:hidden;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
.prompt-events__route{display:block;font-weight:600}.prompt-events__metadata,.prompt-events__categories{display:block;max-width:240px;margin-top:4px;overflow:hidden;color:var(--ui-text-soft);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.prompt-events__preview{display:-webkit-box;max-width:300px;margin:0;overflow:hidden;color:var(--ui-text-muted);line-height:18px;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.prompt-events__loading{display:grid;gap:10px;padding:22px 8px}
@media(max-width:640px){.prompt-events__header-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.prompt-events__filter,.prompt-events__filter--short{width:auto}}
</style>
