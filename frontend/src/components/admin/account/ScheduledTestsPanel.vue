<template>
  <UiDialog
    :show="show"
    :title="t('admin.scheduledTests.title')"
    width="wide"
    @close="emit('close')"
  >
    <AppStack :gap="16">
      <div class="scheduled-tests__toolbar">
        <p>
          {{ t('admin.scheduledTests.title') }}
        </p>
        <UiButton
          variant="primary"
          density="compact"
          @click="showAddForm = !showAddForm"
        >
          <template #icon><Icon name="plus" size="sm" /></template>
          {{ t('admin.scheduledTests.addPlan') }}
        </UiButton>
      </div>

      <section v-if="showAddForm" class="scheduled-tests__form">
        <h3>{{ t('admin.scheduledTests.addPlan') }}</h3>
        <div class="scheduled-tests__form-grid">
            <UiSelect
              v-model="newPlan.model_id"
              :options="modelOptions"
              :label="t('admin.scheduledTests.model')"
              :placeholder="t('admin.scheduledTests.model')"
              :searchable="modelOptions.length > 5 ? true : 'auto'"
            />
            <UiTextField
              v-model="newPlan.cron_expression"
              :label="t('admin.scheduledTests.cronExpression')"
              :placeholder="'*/30 * * * *'"
              :description="t('admin.scheduledTests.cronHelp')"
              :help="t('admin.scheduledTests.cronTooltipMeaning')"
              monospace
            />
            <UiTextField
              v-model="newPlan.max_results"
              type="number"
              :label="t('admin.scheduledTests.maxResults')"
              :help="t('admin.scheduledTests.maxResultsTooltipMeaning')"
              :min="1"
              placeholder="100"
            />
          <div class="scheduled-tests__switch-field">
            <span>{{ t('admin.scheduledTests.enabled') }}</span>
            <UiSwitch v-model="newPlan.enabled" :label="t('admin.scheduledTests.enabled')" />
          </div>
          <div class="scheduled-tests__switch-field">
            <div>
              <span>{{ t('admin.scheduledTests.autoRecover') }}</span>
              <small>{{ t('admin.scheduledTests.autoRecoverHelp') }}</small>
            </div>
            <UiSwitch v-model="newPlan.auto_recover" :label="t('admin.scheduledTests.autoRecover')" />
          </div>
        </div>
        <div class="scheduled-tests__form-actions">
          <UiButton density="compact" @click="showAddForm = false; resetNewPlan()">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="primary"
            density="compact"
            :loading="creating"
            :disabled="!newPlan.model_id || !newPlan.cron_expression || creating"
            @click="handleCreate"
          >
            {{ t('common.save') }}
          </UiButton>
        </div>
      </section>

      <div v-if="loading" class="scheduled-tests__loading">
        <UiSpinner :label="t('common.loading')" />
        <span>{{ t('common.loading') }}...</span>
      </div>

      <UiEmptyState v-else-if="plans.length === 0" icon="calendar" :title="t('admin.scheduledTests.noPlans')" />

      <div v-else class="scheduled-tests__list">
        <section v-for="plan in plans" :key="plan.id" class="scheduled-tests__plan">
          <div class="scheduled-tests__plan-header">
            <button
              type="button"
              class="scheduled-tests__plan-trigger"
              :aria-expanded="expandedPlanId === plan.id"
              :aria-controls="`scheduled-test-results-${plan.id}`"
              @click="toggleExpand(plan.id)"
            >
              <span>
                <strong>{{ plan.model_id }}</strong>
                <code>{{ plan.cron_expression }}</code>
              </span>
              <Icon name="chevronDown" size="sm" :class="{ 'is-open': expandedPlanId === plan.id }" />
            </button>
            <div class="scheduled-tests__plan-meta">
              <UiSwitch
                  :model-value="plan.enabled"
                  :label="t('admin.scheduledTests.enabled')"
                  :disabled="updatingEnabledPlanIds.has(plan.id)"
                  @update:model-value="(val: boolean) => handleToggleEnabled(plan, val)"
                />
              <UiBadge v-if="plan.auto_recover" tone="success" :label="t('admin.scheduledTests.autoRecover')" />
              <span v-if="plan.last_run_at">{{ t('admin.scheduledTests.lastRun') }} {{ formatDateTime(plan.last_run_at) }}</span>
              <span v-if="plan.next_run_at">{{ t('admin.scheduledTests.nextRun') }} {{ formatDateTime(plan.next_run_at) }}</span>
              <UiIconButton :label="t('admin.scheduledTests.editPlan')" icon="edit" variant="ghost" density="dense" @click="startEdit(plan)" />
              <UiIconButton :label="t('admin.scheduledTests.deletePlan')" icon="trash" variant="danger" density="dense" @click="confirmDeletePlan(plan)" />
            </div>
          </div>

          <section v-if="editingPlanId === plan.id" class="scheduled-tests__form scheduled-tests__form--edit">
            <h3>{{ t('admin.scheduledTests.editPlan') }}</h3>
            <div class="scheduled-tests__form-grid">
                <UiSelect
                  v-model="editForm.model_id"
                  :options="modelOptions"
                  :label="t('admin.scheduledTests.model')"
                  :placeholder="t('admin.scheduledTests.model')"
                  :searchable="modelOptions.length > 5 ? true : 'auto'"
                />
                <UiTextField
                  v-model="editForm.cron_expression"
                  :label="t('admin.scheduledTests.cronExpression')"
                  :placeholder="'*/30 * * * *'"
                  :description="t('admin.scheduledTests.cronHelp')"
                  :help="t('admin.scheduledTests.cronTooltipMeaning')"
                  monospace
                />
                <UiTextField
                  v-model="editForm.max_results"
                  type="number"
                  :label="t('admin.scheduledTests.maxResults')"
                  :help="t('admin.scheduledTests.maxResultsTooltipMeaning')"
                  :min="1"
                  placeholder="100"
                />
              <div class="scheduled-tests__switch-field">
                <span>{{ t('admin.scheduledTests.enabled') }}</span>
                <UiSwitch v-model="editForm.enabled" :label="t('admin.scheduledTests.enabled')" />
              </div>
              <div class="scheduled-tests__switch-field">
                <div>
                  <span>{{ t('admin.scheduledTests.autoRecover') }}</span>
                  <small>{{ t('admin.scheduledTests.autoRecoverHelp') }}</small>
                </div>
                <UiSwitch v-model="editForm.auto_recover" :label="t('admin.scheduledTests.autoRecover')" />
              </div>
            </div>
            <div class="scheduled-tests__form-actions">
              <UiButton density="compact" @click="cancelEdit">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                variant="primary"
                density="compact"
                :loading="updating"
                :disabled="!editForm.model_id || !editForm.cron_expression || updating"
                @click="handleEdit"
              >
                {{ t('common.save') }}
              </UiButton>
            </div>
          </section>

          <section
            v-if="expandedPlanId === plan.id"
            :id="`scheduled-test-results-${plan.id}`"
            class="scheduled-tests__results"
          >
            <h3>{{ t('admin.scheduledTests.results') }}</h3>
            <div v-if="loadingResults" class="scheduled-tests__loading scheduled-tests__loading--small">
              <UiSpinner size="sm" :label="t('common.loading')" />
              <span>{{ t('common.loading') }}...</span>
            </div>
            <UiEmptyState v-else-if="results.length === 0" :title="t('admin.scheduledTests.noResults')" />
            <div v-else class="scheduled-tests__result-list">
              <article v-for="result in results" :key="result.id" class="scheduled-tests__result">
                <div class="scheduled-tests__result-header">
                  <div>
                    <UiStatusBadge :status="result.status" :label="resultStatusLabel(result.status)" />
                    <span v-if="result.latency_ms > 0" class="ui-numeric">{{ result.latency_ms }}ms</span>
                  </div>
                  <time>{{ formatDateTime(result.started_at) }}</time>
                </div>
                <UiButton v-if="result.error_message || result.response_text" variant="quiet" density="dense" @click="toggleResultDetail(result.id)">
                  <template #icon><Icon name="chevronDown" size="xs" :class="{ 'is-open': expandedResultIds.has(result.id) }" /></template>
                  {{ result.error_message ? t('admin.scheduledTests.errorMessage') : t('admin.scheduledTests.responseText') }}
                </UiButton>
                <UiCodeBlock
                  v-if="expandedResultIds.has(result.id)"
                  :code="result.error_message || result.response_text || ''"
                  :label="result.error_message ? t('admin.scheduledTests.errorMessage') : t('admin.scheduledTests.responseText')"
                />
              </article>
            </div>
          </section>
        </section>
      </div>
    </AppStack>

    <UiConfirmDialog
      :show="showDeleteConfirm"
      :title="t('admin.scheduledTests.deletePlan')"
      :message="t('admin.scheduledTests.confirmDelete')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="deleting"
      @confirm="handleDelete"
      @cancel="cancelDelete"
    />
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SelectOption } from '@/components/ui'
import { Icon } from '@/components/icons'
import {
  AppStack,
  UiBadge,
  UiButton,
  UiCodeBlock,
  UiConfirmDialog,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiSelect,
  UiSpinner,
  UiStatusBadge,
  UiSwitch,
  UiTextField
} from '@/components/ui'
import { adminAPI } from '@/api/admin'
import { useAppStore } from '@/stores/app'
import { formatDateTime } from '@/utils/format'
import type { ScheduledTestPlan, ScheduledTestResult } from '@/types'

const { t } = useI18n()
const appStore = useAppStore()

const props = defineProps<{
  show: boolean
  accountId: number | null
  modelOptions: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

// State
const loading = ref(false)
const plansRequestSeq = ref(0)
const creating = ref(false)
const deleting = ref(false)
const loadingResults = ref(false)
const resultsRequestSeq = ref(0)
const updatingEnabledPlanIds = reactive(new Set<number>())
const plans = ref<ScheduledTestPlan[]>([])
const results = ref<ScheduledTestResult[]>([])
const expandedPlanId = ref<number | null>(null)
const expandedResultIds = reactive(new Set<number>())
const showAddForm = ref(false)
const showDeleteConfirm = ref(false)
const deletingPlan = ref<ScheduledTestPlan | null>(null)
const editingPlanId = ref<number | null>(null)
const updating = ref(false)
const editForm = reactive({
  model_id: '' as string,
  cron_expression: '' as string,
  max_results: '100' as string,
  enabled: true,
  auto_recover: false
})

const newPlan = reactive({
  model_id: '' as string,
  cron_expression: '' as string,
  max_results: '100' as string,
  enabled: true,
  auto_recover: false
})

const resetNewPlan = () => {
  newPlan.model_id = ''
  newPlan.cron_expression = ''
  newPlan.max_results = '100'
  newPlan.enabled = true
  newPlan.auto_recover = false
}

// Load plans when dialog opens
watch(
  [() => props.show, () => props.accountId],
  async ([visible]) => {
    resultsRequestSeq.value += 1
    if (visible && props.accountId) {
      await loadPlans()
    } else {
      plans.value = []
      results.value = []
      expandedPlanId.value = null
      expandedResultIds.clear()
      showAddForm.value = false
      showDeleteConfirm.value = false
      loadingResults.value = false
    }
  }
)

const loadPlans = async () => {
  if (!props.accountId) return
  const accountId = props.accountId
  const requestSeq = ++plansRequestSeq.value
  loading.value = true
  try {
    const nextPlans = await adminAPI.scheduledTests.listByAccount(accountId)
    if (requestSeq === plansRequestSeq.value && props.accountId === accountId) {
      plans.value = nextPlans
    }
  } catch (error: any) {
    if (requestSeq === plansRequestSeq.value && props.accountId === accountId) {
      appStore.showError(error?.message || 'Failed to load plans')
    }
  } finally {
    if (requestSeq === plansRequestSeq.value && props.accountId === accountId) {
      loading.value = false
    }
  }
}

const handleCreate = async () => {
  if (creating.value || !props.accountId || !newPlan.model_id || !newPlan.cron_expression) return
  creating.value = true
  try {
    const maxResults = Number(newPlan.max_results) || 100
    await adminAPI.scheduledTests.create({
      account_id: props.accountId,
      model_id: newPlan.model_id,
      cron_expression: newPlan.cron_expression,
      enabled: newPlan.enabled,
      max_results: maxResults,
      auto_recover: newPlan.auto_recover
    })
    appStore.showSuccess(t('admin.scheduledTests.createSuccess'))
    showAddForm.value = false
    resetNewPlan()
    await loadPlans()
  } catch (error: any) {
    appStore.showError(error?.message || 'Failed to create plan')
  } finally {
    creating.value = false
  }
}

const handleToggleEnabled = async (plan: ScheduledTestPlan, enabled: boolean) => {
  if (updatingEnabledPlanIds.has(plan.id)) return
  updatingEnabledPlanIds.add(plan.id)
  try {
    const updated = await adminAPI.scheduledTests.update(plan.id, { enabled })
    const index = plans.value.findIndex((p) => p.id === plan.id)
    if (index !== -1) {
      plans.value[index] = updated
    }
    appStore.showSuccess(t('admin.scheduledTests.updateSuccess'))
  } catch (error: any) {
    appStore.showError(error?.message || 'Failed to update plan')
  } finally {
    updatingEnabledPlanIds.delete(plan.id)
  }
}

const startEdit = (plan: ScheduledTestPlan) => {
  editingPlanId.value = plan.id
  editForm.model_id = plan.model_id
  editForm.cron_expression = plan.cron_expression
  editForm.max_results = String(plan.max_results)
  editForm.enabled = plan.enabled
  editForm.auto_recover = plan.auto_recover
}

const cancelEdit = () => {
  editingPlanId.value = null
}

const handleEdit = async () => {
  if (updating.value || !editingPlanId.value || !editForm.model_id || !editForm.cron_expression) return
  updating.value = true
  try {
    const updated = await adminAPI.scheduledTests.update(editingPlanId.value, {
      model_id: editForm.model_id,
      cron_expression: editForm.cron_expression,
      max_results: Number(editForm.max_results) || 100,
      enabled: editForm.enabled,
      auto_recover: editForm.auto_recover
    })
    const index = plans.value.findIndex((p) => p.id === editingPlanId.value)
    if (index !== -1) {
      plans.value[index] = updated
    }
    appStore.showSuccess(t('admin.scheduledTests.updateSuccess'))
    editingPlanId.value = null
  } catch (error: any) {
    appStore.showError(error?.message || 'Failed to update plan')
  } finally {
    updating.value = false
  }
}

const confirmDeletePlan = (plan: ScheduledTestPlan) => {
  if (deleting.value) return
  deletingPlan.value = plan
  showDeleteConfirm.value = true
}

const cancelDelete = () => {
  if (deleting.value) return
  showDeleteConfirm.value = false
  deletingPlan.value = null
}

const handleDelete = async () => {
  if (deleting.value || !deletingPlan.value) return
  const plan = deletingPlan.value
  deleting.value = true
  try {
    await adminAPI.scheduledTests.delete(plan.id)
    appStore.showSuccess(t('admin.scheduledTests.deleteSuccess'))
    plans.value = plans.value.filter((item) => item.id !== plan.id)
    if (expandedPlanId.value === plan.id) {
      expandedPlanId.value = null
      results.value = []
    }
    showDeleteConfirm.value = false
    deletingPlan.value = null
  } catch (error: any) {
    appStore.showError(error?.message || 'Failed to delete plan')
  } finally {
    deleting.value = false
  }
}

const toggleExpand = async (planId: number) => {
  const requestSeq = ++resultsRequestSeq.value
  if (expandedPlanId.value === planId) {
    expandedPlanId.value = null
    results.value = []
    expandedResultIds.clear()
    return
  }

  expandedPlanId.value = planId
  expandedResultIds.clear()
  loadingResults.value = true
  try {
    const nextResults = await adminAPI.scheduledTests.listResults(planId, 20)
    if (requestSeq === resultsRequestSeq.value && expandedPlanId.value === planId) {
      results.value = nextResults
    }
  } catch (error: any) {
    if (requestSeq === resultsRequestSeq.value && expandedPlanId.value === planId) {
      appStore.showError(error?.message || 'Failed to load results')
      results.value = []
    }
  } finally {
    if (requestSeq === resultsRequestSeq.value && expandedPlanId.value === planId) {
      loadingResults.value = false
    }
  }
}

const toggleResultDetail = (resultId: number) => {
  if (expandedResultIds.has(resultId)) {
    expandedResultIds.delete(resultId)
  } else {
    expandedResultIds.add(resultId)
  }
}

const resultStatusLabel = (status: ScheduledTestResult['status']) => {
  if (status === 'success') return t('admin.scheduledTests.success')
  if (status === 'running') return t('admin.scheduledTests.running')
  return t('admin.scheduledTests.failed')
}
</script>

<style scoped>
.scheduled-tests__toolbar,.scheduled-tests__plan-header,.scheduled-tests__plan-meta,.scheduled-tests__result-header,.scheduled-tests__result-header>div,.scheduled-tests__switch-field{display:flex;align-items:center}
.scheduled-tests__toolbar{justify-content:space-between;gap:12px}.scheduled-tests__toolbar p{margin:0;color:var(--ui-text-muted);font-size:13px}
.scheduled-tests__form{display:grid;gap:12px;padding:14px 0;border-block:1px solid var(--ui-border-soft)}.scheduled-tests__form--edit{padding-inline:12px;background:var(--ui-surface-muted)}
.scheduled-tests__form h3,.scheduled-tests__results h3{margin:0;color:var(--ui-text);font-size:13px;font-weight:600}.scheduled-tests__form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.scheduled-tests__switch-field{min-height:36px;align-self:end;justify-content:space-between;gap:12px}.scheduled-tests__switch-field>div{display:grid;gap:1px}.scheduled-tests__switch-field span{color:var(--ui-text);font-size:12px}.scheduled-tests__switch-field small{color:var(--ui-text-soft);font-size:11px}.scheduled-tests__form-actions{display:flex;justify-content:flex-end;gap:8px}
.scheduled-tests__loading{display:flex;min-height:112px;align-items:center;justify-content:center;gap:8px;color:var(--ui-text-soft);font-size:12px}.scheduled-tests__loading--small{min-height:64px}
.scheduled-tests__list{border-top:1px solid var(--ui-border-soft)}.scheduled-tests__plan{border-bottom:1px solid var(--ui-border-soft)}.scheduled-tests__plan-header{min-height:58px;justify-content:space-between;gap:14px}.scheduled-tests__plan-trigger{display:flex;min-width:0;flex:1;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border:0;color:var(--ui-text);background:transparent;text-align:left}.scheduled-tests__plan-trigger>span{display:grid;min-width:0;gap:2px}.scheduled-tests__plan-trigger strong,.scheduled-tests__plan-trigger code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.scheduled-tests__plan-trigger strong{font-size:13px}.scheduled-tests__plan-trigger code{color:var(--ui-text-muted);font-family:var(--ui-font-mono);font-size:11px}.scheduled-tests__plan-trigger svg,.scheduled-tests__result .ui-button svg{transition:transform var(--ui-motion-fast)}.scheduled-tests__plan-trigger svg.is-open,.scheduled-tests__result .ui-button svg.is-open{transform:rotate(180deg)}.scheduled-tests__plan-meta{justify-content:flex-end;gap:7px;color:var(--ui-text-soft);font-size:11px}
.scheduled-tests__results{display:grid;gap:10px;padding:12px 0;border-top:1px solid var(--ui-border-soft)}.scheduled-tests__result-list{display:grid;max-height:320px;gap:8px;overflow-y:auto}.scheduled-tests__result{display:grid;gap:7px;padding:9px 0;border-bottom:1px solid var(--ui-border-soft)}.scheduled-tests__result-header{justify-content:space-between;gap:10px}.scheduled-tests__result-header>div{gap:10px}.scheduled-tests__result-header span,.scheduled-tests__result-header time{color:var(--ui-text-soft);font-size:11px}.scheduled-tests__result :deep(.ui-button){justify-self:start}
@media(max-width:720px){.scheduled-tests__form-grid{grid-template-columns:1fr}.scheduled-tests__plan-header{align-items:flex-start;flex-direction:column}.scheduled-tests__plan-trigger{width:100%}.scheduled-tests__plan-meta{width:100%;justify-content:flex-start;flex-wrap:wrap}.scheduled-tests__plan-meta>span{display:none}}
@media(prefers-reduced-motion:reduce){.scheduled-tests__plan-trigger svg,.scheduled-tests__result .ui-button svg{transition:none}}
</style>
