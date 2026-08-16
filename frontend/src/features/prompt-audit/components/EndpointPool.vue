<template>
  <AppSection :title="t('admin.promptAudit.pool.title')" :description="t('admin.promptAudit.pool.description')" divided>
    <template #actions>
      <UiButton data-test="add-endpoint" density="dense" variant="primary" @click="openCreate">
        {{ t('admin.promptAudit.pool.add') }}
      </UiButton>
    </template>

    <UiEmptyState v-if="endpoints.length === 0" :title="t('admin.promptAudit.pool.empty')" />
    <div v-else class="prompt-pool">
      <div class="prompt-pool__head" aria-hidden="true">
        <span>{{ t('admin.promptAudit.pool.node') }}</span>
        <span>{{ t('admin.promptAudit.pool.model') }}</span>
        <span>{{ t('admin.promptAudit.pool.limits') }}</span>
        <span>{{ t('admin.promptAudit.pool.credential') }}</span>
        <span>{{ t('admin.promptAudit.common.actions') }}</span>
      </div>
      <article v-for="endpoint in endpoints" :key="endpoint.id" :data-test="`endpoint-${endpoint.id}`" class="prompt-pool__row">
        <div class="prompt-pool__identity">
          <UiSwitch
            :model-value="endpoint.enabled"
            :label="t('admin.promptAudit.pool.toggleNode', { name: endpoint.name })"
            @update:model-value="toggleEndpoint(endpoint.id)"
          />
          <div>
            <strong>{{ endpoint.name }}</strong>
            <span :title="endpoint.base_url">{{ endpoint.base_url }}</span>
          </div>
        </div>
        <div class="prompt-pool__cell" :data-label="t('admin.promptAudit.pool.model')">
          <span :title="endpoint.model">{{ endpoint.model || '—' }}</span>
        </div>
        <div class="prompt-pool__cell" :data-label="t('admin.promptAudit.pool.limits')">
          <div class="prompt-pool__badges">
            <UiBadge>{{ endpoint.timeout_ms }} ms</UiBadge>
            <UiBadge>{{ endpoint.input_limit }} chars</UiBadge>
          </div>
        </div>
        <div class="prompt-pool__cell" :data-label="t('admin.promptAudit.pool.credential')">
          <UiStatusBadge
            :status="credentialInvalid(endpoint) ? 'failed' : hasCredential(endpoint) ? 'healthy' : 'neutral'"
            :label="credentialInvalid(endpoint) ? t('admin.promptAudit.pool.invalid') : hasCredential(endpoint) ? t('admin.promptAudit.pool.configured') : t('admin.promptAudit.pool.missing')"
          />
          <p v-if="probingIds.includes(endpoint.id)" class="prompt-pool__probe">{{ t('admin.promptAudit.pool.probeProgress') }}</p>
          <p v-if="probeResults[endpoint.id]" class="prompt-pool__probe" :class="probeResults[endpoint.id].ok ? 'is-success' : 'is-danger'">
            {{ t('admin.promptAudit.pool.probeResult', { status: probeResults[endpoint.id].status, http: probeResults[endpoint.id].http_status || '—', latency: probeResults[endpoint.id].latency_ms }) }}
            · {{ probeResults[endpoint.id].message }}
          </p>
        </div>
        <div class="prompt-pool__actions">
          <UiButton density="mini" :loading="probingIds.includes(endpoint.id)" @click="emit('probe', endpoint)">
            {{ probingIds.includes(endpoint.id) ? t('admin.promptAudit.pool.probing') : t('admin.promptAudit.pool.probe') }}
          </UiButton>
          <UiButton density="mini" variant="quiet" @click="openEdit(endpoint)">{{ t('common.edit') }}</UiButton>
          <UiButton density="mini" variant="danger" @click="requestRemove(endpoint)">{{ t('common.delete') }}</UiButton>
        </div>
      </article>
    </div>

    <UiDialog
      :show="Boolean(editing)"
      :title="editingIndex < 0 ? t('admin.promptAudit.pool.add') : t('admin.promptAudit.pool.edit')"
      :close-label="t('common.close')"
      width="wide"
      @close="closeEditor"
    >
      <form v-if="editing" class="prompt-pool__editor" @submit.prevent="saveEditor">
        <UiTextField v-model="editing.name" required density="compact" :label="t('admin.promptAudit.pool.name')" :input-attrs="{ 'aria-label': t('admin.promptAudit.pool.name') }" />
        <UiTextField v-model="editing.id" required density="compact" :disabled="editingIndex >= 0" :label="t('admin.promptAudit.pool.id')" :input-attrs="{ 'aria-label': t('admin.promptAudit.pool.id') }" />
        <UiTextField v-model="editing.base_url" class="prompt-pool__editor-wide" required density="compact" inputmode="url" :label="t('admin.promptAudit.pool.baseUrl')" :input-attrs="{ 'aria-label': t('admin.promptAudit.pool.baseUrl') }" />
        <UiPasswordField
          v-model="editing.token"
          class="prompt-pool__editor-wide"
          density="compact"
          autocomplete="new-password"
          :label="t('admin.promptAudit.pool.apiKey')"
          :rules="t('admin.promptAudit.pool.secretHint')"
          :placeholder="editing.has_token ? (editing.token_status === 'invalid' ? t('admin.promptAudit.pool.reenterSecret') : t('admin.promptAudit.pool.keepSecret')) : ''"
          :input-attrs="{ 'aria-label': t('admin.promptAudit.pool.apiKey') }"
        />
        <UiCheckbox
          v-if="editing.has_token"
          v-model="editing.clear_token"
          class="prompt-pool__editor-wide prompt-pool__clear"
          :aria-label="t('admin.promptAudit.pool.clearSecret')"
        >
          {{ t('admin.promptAudit.pool.clearSecret') }}
        </UiCheckbox>
        <UiTextField v-model="editing.model" class="prompt-pool__editor-wide" density="compact" :label="t('admin.promptAudit.pool.model')" :input-attrs="{ 'aria-label': t('admin.promptAudit.pool.model') }" />
        <UiTextField v-model.number="editing.timeout_ms" type="number" required density="compact" :min="100" :max="30000" :label="t('admin.promptAudit.pool.timeout')" :input-attrs="{ 'aria-label': t('admin.promptAudit.pool.timeout') }" />
        <UiTextField v-model.number="editing.input_limit" type="number" required density="compact" :min="128" :max="100000" :label="t('admin.promptAudit.pool.inputLimit')" :input-attrs="{ 'aria-label': t('admin.promptAudit.pool.inputLimit') }" />
      </form>
      <template #footer>
        <UiButton @click="closeEditor">{{ t('common.cancel') }}</UiButton>
        <UiButton data-test="save-endpoint" variant="primary" @click="saveEditor">{{ t('common.save') }}</UiButton>
      </template>
    </UiDialog>

    <UiConfirmDialog
      :show="Boolean(pendingRemoval)"
      :title="t('common.delete')"
      :message="pendingRemoval ? t('admin.promptAudit.pool.deleteConfirm', { name: pendingRemoval.name }) : ''"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      danger
      @confirm="confirmRemove"
      @cancel="pendingRemoval = null"
    />
  </AppSection>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AppSection,
  UiBadge,
  UiButton,
  UiCheckbox,
  UiConfirmDialog,
  UiDialog,
  UiEmptyState,
  UiPasswordField,
  UiStatusBadge,
  UiSwitch,
  UiTextField,
} from '@/components/ui'
import type { PromptAuditEndpointDraft, PromptProbeResult } from '../types'
import { cloneData, createDefaultEndpoint } from '../viewModel'

const props = defineProps<{
  endpoints: PromptAuditEndpointDraft[]
  probeResults: Record<string, PromptProbeResult>
  probingIds: string[]
}>()
const emit = defineEmits<{
  (event: 'update:endpoints', value: PromptAuditEndpointDraft[]): void
  (event: 'probe', endpoint: PromptAuditEndpointDraft): void
}>()
const { t } = useI18n()
const editing = ref<PromptAuditEndpointDraft | null>(null)
const editingIndex = ref(-1)
const pendingRemoval = ref<PromptAuditEndpointDraft | null>(null)

function openCreate() {
  editingIndex.value = -1
  editing.value = createDefaultEndpoint(props.endpoints.length + 1)
}
function openEdit(endpoint: PromptAuditEndpointDraft) {
  editingIndex.value = props.endpoints.findIndex((item) => item.id === endpoint.id)
  editing.value = cloneData(endpoint)
}
function closeEditor() {
  editing.value = null
  editingIndex.value = -1
}
function saveEditor() {
  if (!editing.value?.id.trim() || !editing.value.name.trim() || !editing.value.base_url.trim()) return
  const next = props.endpoints.map((item) => cloneData(item))
  const value = cloneData(editing.value)
  if (value.token.trim()) value.clear_token = false
  if (editingIndex.value < 0) next.push(value)
  else next.splice(editingIndex.value, 1, value)
  emit('update:endpoints', next)
  closeEditor()
}
function toggleEndpoint(id: string) {
  emit('update:endpoints', props.endpoints.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : cloneData(item)))
}
function requestRemove(endpoint: PromptAuditEndpointDraft) {
  pendingRemoval.value = endpoint
}
function confirmRemove() {
  const endpoint = pendingRemoval.value
  if (!endpoint) return
  emit('update:endpoints', props.endpoints.filter((item) => item.id !== endpoint.id).map((item) => cloneData(item)))
  pendingRemoval.value = null
}
function hasCredential(endpoint: PromptAuditEndpointDraft): boolean {
  return Boolean(endpoint.token.trim() || (endpoint.has_token && !endpoint.clear_token))
}
function credentialInvalid(endpoint: PromptAuditEndpointDraft): boolean {
  return endpoint.token_status === 'invalid' && !endpoint.token.trim() && !endpoint.clear_token
}
</script>

<style scoped>
.prompt-pool{border-block:1px solid var(--ui-border-soft)}
.prompt-pool__head,.prompt-pool__row{display:grid;grid-template-columns:minmax(240px,1.4fr) minmax(150px,.8fr) minmax(160px,.8fr) minmax(210px,1fr) auto;gap:16px;align-items:center}
.prompt-pool__head{min-height:34px;padding:5px 12px;color:var(--ui-text-soft);background:var(--ui-surface-muted);font-size:10px;font-weight:600;text-transform:uppercase}.prompt-pool__head span:last-child{text-align:right}
.prompt-pool__row{min-height:68px;padding:10px 12px;border-top:1px solid var(--ui-border-soft)}.prompt-pool__row:first-of-type{border-top:0}.prompt-pool__row:hover{background:var(--ui-surface-muted)}
.prompt-pool__identity{display:flex;min-width:0;align-items:center;gap:10px}.prompt-pool__identity>div{display:grid;min-width:0;gap:2px}.prompt-pool__identity strong{overflow:hidden;color:var(--ui-text);font-size:13px;text-overflow:ellipsis;white-space:nowrap}.prompt-pool__identity span{overflow:hidden;color:var(--ui-text-soft);font-family:var(--ui-font-mono);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.prompt-pool__cell{min-width:0;color:var(--ui-text-muted);font-size:12px}.prompt-pool__cell>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.prompt-pool__badges,.prompt-pool__actions{display:flex;flex-wrap:wrap;gap:5px}.prompt-pool__actions{justify-content:flex-end}.prompt-pool__probe{margin:4px 0 0;color:var(--ui-info);font-size:10px;line-height:15px}.prompt-pool__probe.is-success{color:var(--ui-success)}.prompt-pool__probe.is-danger{color:var(--ui-danger)}
.prompt-pool__editor{display:grid;grid-template-columns:1fr 1fr;gap:16px}.prompt-pool__editor-wide{grid-column:1/-1}.prompt-pool__clear{color:var(--ui-danger)}
@media(max-width:1050px){.prompt-pool__head{display:none}.prompt-pool__row{grid-template-columns:minmax(230px,1.3fr) 1fr auto}.prompt-pool__cell:nth-of-type(3),.prompt-pool__cell:nth-of-type(4){display:none}}
@media(max-width:680px){.prompt-pool__row{grid-template-columns:1fr;gap:10px}.prompt-pool__cell:nth-of-type(3),.prompt-pool__cell:nth-of-type(4){display:block}.prompt-pool__cell:before{display:block;margin-bottom:3px;color:var(--ui-text-soft);font-size:9px;font-weight:600;text-transform:uppercase;content:attr(data-label)}.prompt-pool__actions{justify-content:flex-start}.prompt-pool__editor{grid-template-columns:1fr}.prompt-pool__editor-wide{grid-column:auto}}
</style>
