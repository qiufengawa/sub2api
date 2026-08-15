<template>
  <UiDialog
    :show="show"
    :title="t('admin.channelMonitor.template.managerTitle')"
    width="wide"
    @close="emit('close')"
  >
    <UiTabs v-model="activeProvider" :tabs="providerTabOptions" :label="t('admin.channelMonitor.form.provider')" />

    <AppStack v-if="!editing" :gap="10">
      <AppInline justify="flex-end"><UiButton density="dense" variant="primary" @click="openCreateForm"><template #icon><Icon name="plus" size="sm" /></template>{{ t('admin.channelMonitor.template.createButton') }}</UiButton></AppInline>

      <UiSkeleton v-if="loading" height="180px" />
      <UiEmptyState v-else-if="templatesForActiveProvider.length === 0" :title="t('admin.channelMonitor.template.emptyState')" />

      <AppInline
        v-for="tpl in templatesForActiveProvider"
        v-else
        :key="tpl.id"
        justify="space-between"
        :wrap="false"
      >
        <AppStack :gap="4">
          <UiDataCell :value="tpl.name" :meta="tpl.description || t('admin.channelMonitor.template.headersSummary', { n: Object.keys(tpl.extra_headers || {}).length })" />
          <AppInline>
            <UiBadge :tone="modeTone(tpl.body_override_mode)" :label="modeLabel(tpl.body_override_mode)" />
            <UiBadge v-if="tpl.provider === PROVIDER_OPENAI" :tone="apiModeTone(tpl.api_mode)" :label="apiModeLabel(tpl.api_mode)" />
            <UiBadge v-if="tpl.associated_monitors > 0" :label="t('admin.channelMonitor.template.associatedCount', { n: tpl.associated_monitors })" />
          </AppInline>
        </AppStack>
        <UiButtonGroup :label="t('common.actions')">
          <UiIconButton icon="refresh" density="dense" variant="ghost" :label="t('admin.channelMonitor.template.applyButton')" :disabled="tpl.associated_monitors === 0" @click="confirmApply(tpl)" />
          <UiIconButton icon="edit" density="dense" variant="ghost" :label="t('common.edit')" @click="openEditForm(tpl)" />
          <UiIconButton icon="trash" density="dense" variant="danger" :label="t('common.delete')" @click="handleDelete(tpl)" />
        </UiButtonGroup>
      </AppInline>
    </AppStack>

    <AppStack v-else :gap="14">
      <UiTextField v-model="form.name" required :label="t('admin.channelMonitor.template.form.name')" :placeholder="t('admin.channelMonitor.template.form.namePlaceholder')" />

      <UiRadioGroup v-if="editing === 'new'" :model-value="form.provider" :options="providerTabs" name="monitor-template-provider" layout="grid" :label="t('admin.channelMonitor.form.provider')" @update:model-value="form.provider = $event as Provider" />

      <UiRadioGroup v-if="form.provider === PROVIDER_OPENAI" :model-value="form.api_mode" :options="apiModeOptions" name="monitor-template-api-mode" layout="grid" :label="t('admin.channelMonitor.form.apiMode')" @update:model-value="form.api_mode = $event as APIMode" />

      <UiTextField v-model="form.description" :label="t('admin.channelMonitor.template.form.description')" :placeholder="t('admin.channelMonitor.template.form.descriptionPlaceholder')" />

      <MonitorAdvancedRequestConfig
        :provider="form.provider"
        :api-mode="form.api_mode"
        :extra-headers="form.extra_headers"
        :body-override-mode="form.body_override_mode"
        :body-override="form.body_override"
        @update:extra-headers="form.extra_headers = $event"
        @update:body-override-mode="form.body_override_mode = $event"
        @update:body-override="form.body_override = $event"
      />
    </AppStack>

    <template #footer>
      <AppInline justify="space-between">
        <UiButton v-if="editing" density="compact" @click="backToList">{{ t('common.back') }}</UiButton>
        <AppInline>
          <UiButton density="compact" @click="emit('close')">{{ t('common.close') }}</UiButton>
          <UiButton v-if="editing" density="compact" variant="primary" :loading="submitting" :disabled="submitting" @click="handleSubmit">{{ submitting ? t('common.submitting') : editing === 'new' ? t('common.create') : t('common.update') }}</UiButton>
        </AppInline>
      </AppInline>
    </template>
  </UiDialog>

  <MonitorTemplateApplyPickerDialog
    :show="applyPicker.show"
    :template-id="applyPicker.tpl ? applyPicker.tpl.id : null"
    :template-name="applyPicker.tpl ? applyPicker.tpl.name : ''"
    @close="applyPicker.show = false"
    @applied="onApplied"
  />

  <UiConfirmDialog
    :show="confirmDelete.show"
    :title="t('common.delete')"
    :message="confirmDeleteMessage"
    :confirm-text="t('common.delete')"
    :cancel-text="t('common.cancel')"
    :danger="true"
    @confirm="doDelete"
    @cancel="confirmDelete.show = false"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { adminAPI } from '@/api/admin'
import type {
  APIMode,
  BodyOverrideMode,
  Provider,
} from '@/api/admin/channelMonitor'
import type { ChannelMonitorTemplate } from '@/api/admin/channelMonitorTemplate'
import Icon from '@/components/icons/Icon.vue'
import MonitorAdvancedRequestConfig from '@/components/admin/monitor/MonitorAdvancedRequestConfig.vue'
import MonitorTemplateApplyPickerDialog from '@/components/admin/monitor/MonitorTemplateApplyPickerDialog.vue'
import {
  AppInline,
  AppStack,
  UiBadge,
  UiButton,
  UiButtonGroup,
  UiConfirmDialog,
  UiDataCell,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiRadioGroup,
  UiSkeleton,
  UiTabs,
  UiTextField,
} from '@/components/ui'
import {
  PROVIDER_ANTHROPIC,
  PROVIDER_OPENAI,
  PROVIDER_GEMINI,
  PROVIDER_GROK,
  API_MODE_CHAT_COMPLETIONS,
  API_MODE_RESPONSES,
} from '@/constants/channelMonitor'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  /** Fired when any template changed (create / update / delete / apply). */
  (e: 'updated'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()

const providerTabs = computed<{ value: Provider; label: string }[]>(() => [
  { value: PROVIDER_ANTHROPIC, label: t('monitorCommon.providers.anthropic') },
  { value: PROVIDER_OPENAI, label: t('monitorCommon.providers.openai') },
  { value: PROVIDER_GEMINI, label: t('monitorCommon.providers.gemini') },
  { value: PROVIDER_GROK, label: t('monitorCommon.providers.grok') },
])

const activeProvider = ref<Provider>(PROVIDER_ANTHROPIC)
const templates = ref<ChannelMonitorTemplate[]>([])
const loading = ref(false)

const templatesForActiveProvider = computed(() =>
  templates.value.filter((t) => t.provider === activeProvider.value),
)

const countByProvider = computed<Record<Provider, number>>(() => {
  const out: Record<Provider, number> = {
    anthropic: 0,
    openai: 0,
    gemini: 0,
    grok: 0,
  }
  for (const t of templates.value) out[t.provider]++
  return out
})

const providerTabOptions = computed(() => providerTabs.value.map((tab) => ({
  ...tab,
  count: countByProvider.value[tab.value],
})))

// --- form state ---
interface TemplateForm {
  id: number | null
  name: string
  provider: Provider
  api_mode: APIMode
  description: string
  extra_headers: Record<string, string>
  body_override_mode: BodyOverrideMode
  body_override: Record<string, unknown> | null
}

const editing = ref<null | 'new' | number>(null) // null = list view; 'new' = create; <id> = edit
const submitting = ref(false)
const form = reactive<TemplateForm>(emptyForm(PROVIDER_ANTHROPIC))

function emptyForm(provider: Provider): TemplateForm {
  return {
    id: null,
    name: '',
    provider,
    api_mode: API_MODE_CHAT_COMPLETIONS,
    description: '',
    extra_headers: {},
    body_override_mode: 'off',
    body_override: null,
  }
}

function loadForm(tpl: ChannelMonitorTemplate) {
  form.id = tpl.id
  form.name = tpl.name
  form.provider = tpl.provider
  form.api_mode = normalizeAPIMode(tpl.api_mode)
  form.description = tpl.description
  form.extra_headers = { ...(tpl.extra_headers || {}) }
  form.body_override_mode = tpl.body_override_mode
  form.body_override = tpl.body_override ? { ...tpl.body_override } : null
}

function openCreateForm() {
  Object.assign(form, emptyForm(activeProvider.value))
  editing.value = 'new'
}

function openEditForm(tpl: ChannelMonitorTemplate) {
  loadForm(tpl)
  editing.value = tpl.id
}

function backToList() {
  editing.value = null
}

// --- data fetch ---
async function fetchTemplates() {
  loading.value = true
  try {
    const { items } = await adminAPI.channelMonitorTemplate.list()
    templates.value = items
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      editing.value = null
      fetchTemplates()
    }
  },
  { immediate: true },
)

// --- submit ---
async function handleSubmit() {
  if (submitting.value) return
  if (!form.name.trim()) {
    appStore.showError(t('admin.channelMonitor.template.missingName'))
    return
  }
  submitting.value = true
  try {
    if (editing.value === 'new') {
      await adminAPI.channelMonitorTemplate.create({
        name: form.name.trim(),
        provider: form.provider,
        api_mode: form.provider === PROVIDER_OPENAI ? form.api_mode : API_MODE_CHAT_COMPLETIONS,
        description: form.description.trim(),
        extra_headers: form.extra_headers,
        body_override_mode: form.body_override_mode,
        body_override: form.body_override,
      })
      appStore.showSuccess(t('admin.channelMonitor.template.createSuccess'))
    } else if (typeof editing.value === 'number') {
      await adminAPI.channelMonitorTemplate.update(editing.value, {
        name: form.name.trim(),
        api_mode: form.provider === PROVIDER_OPENAI ? form.api_mode : API_MODE_CHAT_COMPLETIONS,
        description: form.description.trim(),
        extra_headers: form.extra_headers,
        body_override_mode: form.body_override_mode,
        body_override: form.body_override,
      })
      appStore.showSuccess(t('admin.channelMonitor.template.updateSuccess'))
    }
    await fetchTemplates()
    emit('updated')
    editing.value = null
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    submitting.value = false
  }
}

// --- apply to monitors (picker 流程) ---
const applyPicker = reactive<{ show: boolean; tpl: ChannelMonitorTemplate | null }>({
  show: false,
  tpl: null,
})

function confirmApply(tpl: ChannelMonitorTemplate) {
  applyPicker.tpl = tpl
  applyPicker.show = true
}

// picker 提交后触发：刷新模板列表（拿最新 associated_monitors）+ 通知父组件
async function onApplied(_affected: number) {
  await fetchTemplates()
  emit('updated')
}

// --- delete ---
const confirmDelete = reactive<{ show: boolean; tpl: ChannelMonitorTemplate | null }>({
  show: false,
  tpl: null,
})

function handleDelete(tpl: ChannelMonitorTemplate) {
  confirmDelete.tpl = tpl
  confirmDelete.show = true
}

const confirmDeleteMessage = computed(() => {
  const tpl = confirmDelete.tpl
  if (!tpl) return ''
  return t('admin.channelMonitor.template.deleteConfirm', {
    name: tpl.name,
    n: tpl.associated_monitors,
  })
})

async function doDelete() {
  const tpl = confirmDelete.tpl
  confirmDelete.show = false
  if (!tpl) return
  try {
    await adminAPI.channelMonitorTemplate.del(tpl.id)
    appStore.showSuccess(t('admin.channelMonitor.template.deleteSuccess'))
    await fetchTemplates()
    emit('updated')
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  }
}

// --- misc ---
function modeTone(mode: BodyOverrideMode): 'neutral' | 'warning' | 'info' {
  switch (mode) {
    case 'merge':
      return 'warning'
    case 'replace':
      return 'info'
    default:
      return 'neutral'
  }
}

function modeLabel(mode: BodyOverrideMode): string {
  return t(`admin.channelMonitor.advanced.bodyMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)
}

const apiModeOptions = computed<{ value: APIMode; label: string; description: string }[]>(() => [
  {
    value: API_MODE_CHAT_COMPLETIONS,
    label: t('admin.channelMonitor.form.apiModeChatCompletions'),
    description: t('admin.channelMonitor.form.apiModeChatCompletionsHint'),
  },
  {
    value: API_MODE_RESPONSES,
    label: t('admin.channelMonitor.form.apiModeResponses'),
    description: t('admin.channelMonitor.form.apiModeResponsesHint'),
  },
])

watch(() => form.provider, (provider) => {
  if (provider !== PROVIDER_OPENAI) {
    form.api_mode = API_MODE_CHAT_COMPLETIONS
  }
})

function normalizeAPIMode(mode: APIMode | undefined | null): APIMode {
  return mode === API_MODE_RESPONSES ? API_MODE_RESPONSES : API_MODE_CHAT_COMPLETIONS
}

function apiModeLabel(mode: APIMode): string {
  return normalizeAPIMode(mode) === API_MODE_RESPONSES
    ? t('admin.channelMonitor.form.apiModeResponses')
    : t('admin.channelMonitor.form.apiModeChatCompletions')
}

function apiModeTone(mode: APIMode): 'info' | 'success' {
  return normalizeAPIMode(mode) === API_MODE_RESPONSES ? 'info' : 'success'
}
</script>
