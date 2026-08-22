<template>
  <AppLayout>
    <AppPage width="full" density="compact" class="prompt-audit-page" :class="{ 'prompt-audit-page--save-visible': activeTab === 'config' && draft }">
      <AppPageHeader :title="t('admin.promptAudit.title')" :description="t('admin.promptAudit.description')">
        <template #status>
          <UiBadge v-if="draft" :label="t('admin.promptAudit.configVersion', { version: draft.config_version })" />
        </template>
        <template v-if="draft?.updated_at" #actions>
          <span class="prompt-audit-updated">{{ formatDate(draft.updated_at) }}</span>
        </template>
      </AppPageHeader>

      <div v-if="loadErrors.config && !draft" class="prompt-audit-load-error">
        <UiAlert tone="danger" :message="loadErrors.config" />
        <UiButton density="compact" @click="loadConfig">{{ t('admin.promptAudit.actions.retry') }}</UiButton>
      </div>

      <template v-else>
        <UiTabs :model-value="activeTab" class="prompt-audit-tabs" :tabs="pageTabs" :label="t('admin.promptAudit.title')" @update:model-value="handleTabChange" />

        <div class="prompt-audit-panel">
          <section v-show="activeTab === 'config'" data-test="tab-panel-config" class="prompt-audit-tab-panel">
            <RuntimeOverview :runtime="runtime" :loading="loading.runtime" :error="loadErrors.runtime" @refresh="loadRuntime" />

            <template v-if="draft">
              <EndpointPool
                :endpoints="draft.endpoints"
                :probe-results="probeResults"
                :probing-ids="probingIds"
                @update:endpoints="updateEndpoints"
                @probe="runProbe"
              />
              <UiAlert v-if="loadErrors.groups" class="prompt-audit-groups-error" tone="warning" :message="loadErrors.groups" />
              <PolicyPanel :draft="draft" :groups="groups" @update:draft="replaceDraft" />
            </template>
          </section>

          <section v-show="activeTab === 'events'" data-test="tab-panel-events" class="prompt-audit-tab-panel">
            <div v-if="draft?.enabled && !draft.store_pass_events" data-test="pass-events-disabled-notice" class="prompt-audit-notice">
              <UiAlert tone="warning" :message="t('admin.promptAudit.events.passEventsDisabled')" />
              <UiButton density="dense" @click="activeTab = 'config'">
                {{ t('admin.promptAudit.events.openConfiguration') }}
              </UiButton>
            </div>
            <EventWorkspace
              :events="events.items"
              :total="events.total"
              :page="events.page"
              :page-size="events.page_size"
              :filters="filters"
              :selected-ids="selectedEventIds"
              :loading="loading.events"
              :error="loadErrors.events"
              @filters-change="handleFiltersChanged"
              @search="applyEventFilters"
              @selection="selectedEventIds = $event"
              @page="changePage"
              @page-size="changePageSize"
              @view="openEvent"
              @delete="requestSingleDelete"
              @batch-delete="requestBatchDelete"
              @preview-delete="requestFilterDeletePreview"
            />
          </section>
        </div>
      </template>

    <div v-if="draft && activeTab === 'config'" class="prompt-audit-save">
      <UiSaveBar
        :dirty="dirty"
        :saving="loading.saving"
        :saved-at="draft.updated_at ? formatDate(draft.updated_at) : undefined"
        :dirty-label="t('admin.promptAudit.saveBar.dirty')"
        :saving-label="t('common.saving')"
        :saved-label="t('admin.promptAudit.saveBar.synced')"
        :discard-label="t('common.reset')"
        :save-label="t('common.save')"
        save-data-test="save-config"
        @discard="resetDraft"
        @save="saveConfig"
      >
        <template #controls>
          <div class="prompt-audit-toggle"><UiSwitch :label="t('admin.promptAudit.saveBar.enabled')" :model-value="draft.enabled" data-test="enabled-toggle" @update:model-value="setEnabled" /><span>{{ t('admin.promptAudit.saveBar.enabled') }}</span></div>
          <div class="prompt-audit-toggle"><UiSwitch :label="t('admin.promptAudit.saveBar.blocking')" :model-value="draft.blocking_enabled" :disabled="!draft.enabled" data-test="blocking-toggle" @update:model-value="setBlocking" /><span>{{ t('admin.promptAudit.saveBar.blocking') }}</span></div>
          <div class="prompt-audit-toggle"><UiSwitch :label="t('admin.promptAudit.saveBar.blockingLatestTurnOnly')" :model-value="draft.blocking_latest_turn_only" :disabled="!draft.enabled || !draft.blocking_enabled" data-test="blocking-latest-turn-only-toggle" @update:model-value="replaceDraft({ ...draft!, blocking_latest_turn_only: $event })" /><span>{{ t('admin.promptAudit.saveBar.blockingLatestTurnOnly') }}</span></div>
          <div class="prompt-audit-toggle"><UiSwitch :label="t('admin.promptAudit.saveBar.storePass')" :model-value="draft.store_pass_events" data-test="store-pass-toggle" @update:model-value="replaceDraft({ ...draft!, store_pass_events: $event })" /><span>{{ t('admin.promptAudit.saveBar.storePass') }}</span></div>
        </template>
      </UiSaveBar>
    </div>

    <UiConfirmDialog
      :show="showBlockingConfirmation"
      :title="t('admin.promptAudit.blockingConfirm.title')"
      :message="t('admin.promptAudit.blockingConfirm.message')"
      :confirm-text="t('admin.promptAudit.blockingConfirm.confirm')"
      :cancel-text="t('common.cancel')"
      danger
      @confirm="confirmBlocking"
      @cancel="showBlockingConfirmation = false"
    />
    <UiConfirmDialog
      :show="deleteRequest.mode !== ''"
      :title="t('admin.promptAudit.events.deleteConfirmTitle')"
      :message="t('admin.promptAudit.events.deleteConfirmMessage', { count: deleteRequest.ids.length })"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :pending="loading.deleting"
      danger
      @confirm="confirmIDDelete"
      @cancel="clearDeleteRequest"
    />
    <FilterDeleteDialog
      :show="showFilterDelete"
      :initial-filters="filters"
      :preview="deletePreview"
      :previewing="loading.previewing"
      :deleting="loading.deleting"
      @close="closeFilterDelete"
      @preview="runFilterDeletePreview"
      @confirm="confirmFilterDelete"
      @criteria-change="handleFilterCriteriaChange"
    />
    <EventDetailDialog :show="showEventDetail" :event="activeEvent" :loading="loading.detail" @close="closeEventDetail" />
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  AppPage,
  AppPageHeader,
  UiAlert,
  UiBadge,
  UiButton,
  UiConfirmDialog,
  UiSaveBar,
  UiSwitch,
  UiTabs,
} from '@/components/ui'
import { useAppStore } from '@/stores/app'
import { extractApiErrorCode, extractApiErrorMessage } from '@/utils/apiError'
import RuntimeOverview from './components/RuntimeOverview.vue'
import EndpointPool from './components/EndpointPool.vue'
import PolicyPanel from './components/PolicyPanel.vue'
import EventWorkspace from './components/EventWorkspace.vue'
import EventDetailDialog from './components/EventDetailDialog.vue'
import FilterDeleteDialog from './components/FilterDeleteDialog.vue'
import promptAuditAPI from './api'
import type {
  PromptAuditDraft,
  PromptAuditEndpointDraft,
  PromptAuditEvent,
  PromptAuditGroup,
  PromptAuditRuntime,
  PromptDeletePreview,
  PromptEventFilters,
  PromptEventPage,
  PromptLoadErrors,
  PromptProbeResult,
} from './types'
import { buildUpdateRequest, cloneData, configToDraft, draftFingerprint, emptyEventFilters, eventQueryParams } from './viewModel'

const { t, locale } = useI18n()
const appStore = useAppStore()
type PromptAuditPageTab = 'config' | 'events'
const activeTab = ref<PromptAuditPageTab>('events')
const pageTabs = computed(() => [
  { value: 'events' as const, label: t('admin.promptAudit.tabs.events'), dataTest: 'tab-events' },
  { value: 'config' as const, label: t('admin.promptAudit.tabs.config'), dataTest: 'tab-config' },
])
const serverConfig = ref<PromptAuditDraft | null>(null)
const draft = ref<PromptAuditDraft | null>(null)
const runtime = ref<PromptAuditRuntime | null>(null)
const groups = ref<PromptAuditGroup[]>([])
const events = reactive<PromptEventPage>({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
const filters = ref<PromptEventFilters>(emptyEventFilters())
const appliedFilters = ref<PromptEventFilters>(emptyEventFilters())
const selectedEventIds = ref<number[]>([])
const activeEvent = ref<PromptAuditEvent | null>(null)
const showEventDetail = ref(false)
const probeResults = reactive<Record<string, PromptProbeResult>>({})
const probingIds = ref<string[]>([])
const showFilterDelete = ref(false)
const deletePreview = ref<PromptDeletePreview | null>(null)
const deletePreviewFilters = ref<PromptEventFilters | null>(null)
const showBlockingConfirmation = ref(false)
const deleteRequest = reactive<{ mode: '' | 'single' | 'batch'; ids: number[] }>({ mode: '', ids: [] })
const loading = reactive({ config: false, runtime: false, groups: false, events: false, saving: false, detail: false, deleting: false, previewing: false })
const deletingOwner = ref<'id' | 'filter' | null>(null)
const loadErrors = reactive<PromptLoadErrors>({ config: '', runtime: '', groups: '', events: '' })
const dirty = computed(() => draftFingerprint(draft.value) !== draftFingerprint(serverConfig.value))
let configRequestSequence = 0
let runtimeRequestSequence = 0
let groupsRequestSequence = 0
let eventsRequestSequence = 0
let detailRequestSequence = 0
let previewRequestSequence = 0
let filterDeleteSessionSequence = 0

function errorMessage(error: unknown, fallbackKey: string): string {
  const code = extractApiErrorCode(error)
  if (code) {
    const key = `admin.promptAudit.errors.${code}`
    const translated = t(key)
    if (translated !== key) return translated
  }
  return extractApiErrorMessage(error, t(fallbackKey))
}

function handleTabChange(value: string | number) {
  activeTab.value = value === 'config' ? 'config' : 'events'
}

async function loadConfig() {
  const requestSequence = ++configRequestSequence
  loading.config = true
  loadErrors.config = ''
  try {
    const config = await promptAuditAPI.getConfig()
    if (requestSequence !== configRequestSequence) return
    serverConfig.value = configToDraft(config)
    draft.value = configToDraft(config)
  } catch (error) {
    if (requestSequence !== configRequestSequence) return
    loadErrors.config = errorMessage(error, 'admin.promptAudit.errors.loadConfig')
  } finally {
    if (requestSequence === configRequestSequence) loading.config = false
  }
}
async function loadRuntime() {
  const requestSequence = ++runtimeRequestSequence
  loading.runtime = true
  loadErrors.runtime = ''
  try {
    const result = await promptAuditAPI.getRuntime()
    if (requestSequence === runtimeRequestSequence) runtime.value = result
  }
  catch (error) {
    if (requestSequence === runtimeRequestSequence) loadErrors.runtime = errorMessage(error, 'admin.promptAudit.errors.loadRuntime')
  }
  finally { if (requestSequence === runtimeRequestSequence) loading.runtime = false }
}
async function loadGroups() {
  const requestSequence = ++groupsRequestSequence
  loading.groups = true
  loadErrors.groups = ''
  try {
    const result = await promptAuditAPI.listGroups()
    if (requestSequence === groupsRequestSequence) groups.value = result
  }
  catch (error) {
    if (requestSequence === groupsRequestSequence) loadErrors.groups = errorMessage(error, 'admin.promptAudit.errors.loadGroups')
  }
  finally { if (requestSequence === groupsRequestSequence) loading.groups = false }
}
async function loadEvents() {
  const requestSequence = ++eventsRequestSequence
  const requestFilters = cloneData(appliedFilters.value)
  const requestPage = events.page
  const requestPageSize = events.page_size
  loading.events = true
  loadErrors.events = ''
  try {
    const result = await promptAuditAPI.listEvents(requestFilters, requestPage, requestPageSize)
    if (requestSequence !== eventsRequestSequence) return
    Object.assign(events, result)
    selectedEventIds.value = []
  } catch (error) {
    if (requestSequence !== eventsRequestSequence) return
    loadErrors.events = errorMessage(error, 'admin.promptAudit.errors.loadEvents')
  } finally {
    if (requestSequence === eventsRequestSequence) loading.events = false
  }
}
async function loadInitial() {
  await Promise.allSettled([loadConfig(), loadRuntime(), loadGroups(), loadEvents()])
}

function replaceDraft(value: PromptAuditDraft) { draft.value = cloneData(value) }
function updateEndpoints(value: PromptAuditEndpointDraft[]) {
  if (!draft.value) return
  replaceDraft({ ...draft.value, endpoints: value })
}
function setEnabled(value: boolean) {
  if (!draft.value) return
  replaceDraft({ ...draft.value, enabled: value, blocking_enabled: value ? draft.value.blocking_enabled : false })
}
function setBlocking(value: boolean) {
  if (!draft.value || !draft.value.enabled) return
  if (value && !draft.value.blocking_enabled) { showBlockingConfirmation.value = true; return }
  replaceDraft({ ...draft.value, blocking_enabled: value })
}
function confirmBlocking() {
  showBlockingConfirmation.value = false
  if (draft.value) replaceDraft({ ...draft.value, blocking_enabled: true })
}
function resetDraft() {
  if (serverConfig.value) draft.value = cloneData(serverConfig.value)
}
async function saveConfig() {
  if (!draft.value || !dirty.value || loading.saving) return
  ++configRequestSequence
  const submittedDraft = cloneData(draft.value)
  const submittedFingerprint = draftFingerprint(submittedDraft)
  loading.saving = true
  try {
    const saved = await promptAuditAPI.updateConfig(buildUpdateRequest(submittedDraft))
    const savedDraft = configToDraft(saved)
    serverConfig.value = savedDraft
    if (draftFingerprint(draft.value) === submittedFingerprint) {
      draft.value = cloneData(savedDraft)
    } else if (draft.value) {
      const submittedTokens = new Map(submittedDraft.endpoints.map((endpoint) => [endpoint.id, endpoint.token]))
      const currentDraft = cloneData(draft.value)
      currentDraft.config_version = savedDraft.config_version
      currentDraft.updated_at = savedDraft.updated_at
      currentDraft.updated_by = savedDraft.updated_by
      currentDraft.change_summary = savedDraft.change_summary
      currentDraft.endpoints = currentDraft.endpoints.map((endpoint) => ({
        ...endpoint,
        token: endpoint.token && endpoint.token === submittedTokens.get(endpoint.id) ? '' : endpoint.token,
      }))
      draft.value = currentDraft
    }
    appStore.showSuccess(t('admin.promptAudit.messages.saved'))
    await loadRuntime()
  } catch (error) {
    const code = extractApiErrorCode(error)
    appStore.showError(errorMessage(error, code === 'prompt_audit_config_conflict' ? 'admin.promptAudit.errors.prompt_audit_config_conflict' : 'admin.promptAudit.errors.saveConfig'))
  } finally {
    loading.saving = false
  }
}
async function runProbe(endpoint: PromptAuditEndpointDraft) {
  if (probingIds.value.includes(endpoint.id)) return
  probingIds.value = [...probingIds.value, endpoint.id]
  try {
    const result = await promptAuditAPI.probeEndpoint(endpoint)
    probeResults[endpoint.id] = result
    if (result.ok) appStore.showSuccess(t('admin.promptAudit.messages.probeSucceeded'))
    else appStore.showError(`${result.error_code || result.status}: ${result.message}`)
  } catch (error) {
    appStore.showError(errorMessage(error, 'admin.promptAudit.errors.probe'))
  } finally {
    probingIds.value = probingIds.value.filter((id) => id !== endpoint.id)
  }
}

function handleFiltersChanged(value: PromptEventFilters) {
  filters.value = cloneData(value)
  clearDeletePreview()
}
function applyEventFilters(value: PromptEventFilters) {
  filters.value = cloneData(value)
  appliedFilters.value = cloneData(value)
  events.page = 1
  clearDeletePreview()
  void loadEvents()
}
function changePage(value: number) { events.page = value; void loadEvents() }
function changePageSize(value: number) { events.page_size = value; events.page = 1; void loadEvents() }
async function openEvent(id: number) {
  const requestSequence = ++detailRequestSequence
  showEventDetail.value = true
  loading.detail = true
  activeEvent.value = null
  try {
    const result = await promptAuditAPI.getEvent(id)
    if (requestSequence === detailRequestSequence && showEventDetail.value) activeEvent.value = result
  }
  catch (error) {
    if (requestSequence === detailRequestSequence) {
      appStore.showError(errorMessage(error, 'admin.promptAudit.errors.loadDetail'))
      showEventDetail.value = false
    }
  }
  finally { if (requestSequence === detailRequestSequence) loading.detail = false }
}
function closeEventDetail() { ++detailRequestSequence; showEventDetail.value = false; activeEvent.value = null; loading.detail = false }
function requestSingleDelete(id: number) { deleteRequest.mode = 'single'; deleteRequest.ids = [id] }
function requestBatchDelete() { if (selectedEventIds.value.length) { deleteRequest.mode = 'batch'; deleteRequest.ids = [...selectedEventIds.value] } }
function clearDeleteRequest() { deleteRequest.mode = ''; deleteRequest.ids = [] }
async function confirmIDDelete() {
  if (loading.deleting) return
  const mode = deleteRequest.mode
  const ids = [...deleteRequest.ids]
  if (!mode || ids.length === 0) return
  loading.deleting = true
  deletingOwner.value = 'id'
  try {
    const result = mode === 'single' ? await promptAuditAPI.deleteEvent(ids[0]) : await promptAuditAPI.batchDeleteEvents(ids)
    clearDeleteRequest()
    appStore.showSuccess(t('admin.promptAudit.messages.deleted', { count: result.deleted_events }))
    await Promise.allSettled([loadEvents(), loadRuntime()])
  } catch (error) { appStore.showError(errorMessage(error, 'admin.promptAudit.errors.delete')) }
  finally {
    if (deletingOwner.value === 'id') {
      deletingOwner.value = null
      loading.deleting = false
    }
  }
}
function clearDeletePreview() {
  ++previewRequestSequence
  deletePreview.value = null
  deletePreviewFilters.value = null
  loading.previewing = false
}
function handleFilterCriteriaChange() {
  // Editing filters starts a new destructive-operation generation. Any
  // preview/delete response for the previous criteria must be ignored.
  ++filterDeleteSessionSequence
  clearDeletePreview()
  if (deletingOwner.value === 'filter') {
    deletingOwner.value = null
    loading.deleting = false
  }
}
function requestFilterDeletePreview() {
  ++filterDeleteSessionSequence
  clearDeletePreview()
  showFilterDelete.value = true
}
function closeFilterDelete() {
  ++filterDeleteSessionSequence
  showFilterDelete.value = false
  clearDeletePreview()
  // The in-flight request is fenced by the session sequence.  Release the
  // view-level busy state immediately so a newly opened dialog is independent
  // of the old request's eventual completion.
  if (deletingOwner.value === 'filter') {
    deletingOwner.value = null
    loading.deleting = false
  }
}
async function runFilterDeletePreview(value: PromptEventFilters) {
  const requestSequence = ++previewRequestSequence
  const sessionSequence = filterDeleteSessionSequence
  const requestFilters = cloneData(value)
  loading.previewing = true
  try {
    const result = await promptAuditAPI.previewDelete(requestFilters)
    if (requestSequence !== previewRequestSequence || sessionSequence !== filterDeleteSessionSequence || !showFilterDelete.value) return
    deletePreview.value = result
    deletePreviewFilters.value = requestFilters
  } catch (error) {
    if (requestSequence !== previewRequestSequence || sessionSequence !== filterDeleteSessionSequence || !showFilterDelete.value) return
    clearDeletePreview()
    appStore.showError(errorMessage(error, 'admin.promptAudit.errors.previewDelete'))
  } finally {
    if (requestSequence === previewRequestSequence && sessionSequence === filterDeleteSessionSequence) loading.previewing = false
  }
}
async function confirmFilterDelete(filters?: PromptEventFilters) {
  if (loading.deleting) return
  const sessionSequence = filterDeleteSessionSequence
  const requestedFilters = filters ? cloneData(filters) : null
  loading.deleting = true
  deletingOwner.value = 'filter'
  try {
    let preview = deletePreview.value
    let previewFilters = deletePreviewFilters.value ? cloneData(deletePreviewFilters.value) : null
    if (preview && previewFilters && requestedFilters && filterFingerprint(previewFilters) !== filterFingerprint(requestedFilters)) {
      preview = null
      previewFilters = null
    }
    // One-click path: no fresh preview (never requested, or cleared by a
    // criteria change) — mint the confirmation token on the fly from the
    // criteria the dialog just emitted, then delete in the same action.
    if ((!preview || !previewFilters) && requestedFilters) {
      preview = await promptAuditAPI.previewDelete(requestedFilters)
      if (sessionSequence !== filterDeleteSessionSequence || !showFilterDelete.value) return
      previewFilters = requestedFilters
      deletePreview.value = preview
      deletePreviewFilters.value = cloneData(previewFilters)
    }
    if (!preview || !previewFilters) return
    if (preview.matched_count === 0) return
    const result = await promptAuditAPI.deleteEventsByFilter(previewFilters, preview)
    if (sessionSequence !== filterDeleteSessionSequence || !showFilterDelete.value) return
    closeFilterDelete()
    appStore.showSuccess(t('admin.promptAudit.messages.deleted', { count: result.deleted_events }))
    await Promise.allSettled([loadEvents(), loadRuntime()])
  } catch (error) {
    // A dialog can be closed or replaced while the destructive request is in
    // flight.  Do not surface a stale error or clear the next session's
    // preview when that older request rejects.
    if (sessionSequence !== filterDeleteSessionSequence || !showFilterDelete.value) return
    clearDeletePreview()
    appStore.showError(errorMessage(error, 'admin.promptAudit.errors.deleteConfirmation'))
  } finally {
    if (sessionSequence === filterDeleteSessionSequence && deletingOwner.value === 'filter') {
      deletingOwner.value = null
      loading.deleting = false
    }
  }
}
function filterFingerprint(value: PromptEventFilters): string {
  return JSON.stringify(eventQueryParams(value))
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}

onMounted(loadInitial)
</script>

<style scoped>
.prompt-audit-page{min-width:0}
.prompt-audit-page--save-visible{padding-bottom:116px}
.prompt-audit-updated{color:var(--ui-text-soft);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}
.prompt-audit-load-error{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 0}
.prompt-audit-load-error>.ui-alert{min-width:0;flex:1}
.prompt-audit-tabs{margin-top:12px}
.prompt-audit-panel{min-width:0}
.prompt-audit-tab-panel{min-width:0;padding:8px 0 24px}
.prompt-audit-groups-error{margin-top:16px}
.prompt-audit-notice{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;margin:12px 0}
.prompt-audit-save{position:fixed;z-index:30;right:16px;bottom:max(12px,env(safe-area-inset-bottom));left:calc(var(--app-sidebar-width) + 16px)}
.prompt-audit-toggle{display:flex;min-width:0;align-items:center;gap:7px;color:var(--ui-text-muted);font-size:11px;line-height:16px}
.prompt-audit-toggle span{min-width:0;overflow-wrap:anywhere}
:global(.app-shell--collapsed) .prompt-audit-save{left:calc(var(--app-sidebar-collapsed-width) + 16px)}
@media(max-width:1023px){.prompt-audit-save{left:12px;right:12px}.prompt-audit-page--save-visible{padding-bottom:166px}}
@media(max-width:520px){.prompt-audit-page--save-visible{padding-bottom:244px}.prompt-audit-load-error,.prompt-audit-notice{align-items:stretch;grid-template-columns:1fr}.prompt-audit-load-error{flex-direction:column}.prompt-audit-load-error>.ui-button{align-self:flex-end}.prompt-audit-save{right:8px;bottom:max(8px,env(safe-area-inset-bottom));left:8px}}
</style>
