<template>
  <UiDialog
    :show="show"
    :title="editing ? t('admin.channelMonitor.editTitle') : t('admin.channelMonitor.createTitle')"
    width="wide"
    @close="emit('close')"
  >
    <form id="channel-monitor-form" @submit.prevent="handleSubmit">
      <AppStack :gap="14">
        <UiTextField v-model="form.name" :label="t('admin.channelMonitor.form.name')" :placeholder="t('admin.channelMonitor.form.namePlaceholder')" required />

        <UiRadioGroup
          :model-value="form.provider"
          :options="providerOptions"
          name="channel-monitor-provider"
          layout="grid"
          :label="t('admin.channelMonitor.form.provider')"
          @update:model-value="selectProvider($event as Provider)"
        />

        <UiRadioGroup
          v-if="form.provider === PROVIDER_OPENAI"
          :model-value="form.api_mode"
          :options="apiModeOptions"
          name="channel-monitor-api-mode"
          layout="grid"
          :label="t('admin.channelMonitor.form.apiMode')"
          @update:model-value="form.api_mode = $event as APIMode"
        />

        <div class="monitor-form-command">
          <UiTextField v-model="form.endpoint" test-id="monitor-endpoint" :label="t('admin.channelMonitor.form.endpoint')" :placeholder="t('admin.channelMonitor.form.endpointPlaceholder')" required />
          <UiButton type="button" density="compact" @click="useCurrentDomain">{{ t('admin.channelMonitor.form.useCurrentDomain') }}</UiButton>
        </div>

        <div class="monitor-form-command">
          <UiTextField
            v-model="form.api_key"
            type="password"
            :label="t('admin.channelMonitor.form.apiKey')"
            :description="editing?.api_key_masked || undefined"
            :required="!editing"
            :placeholder="editing ? t('admin.channelMonitor.form.apiKeyEditPlaceholder') : t('admin.channelMonitor.form.apiKeyPlaceholder')"
          />
          <UiButton type="button" density="compact" @click="openMyKeyPicker">{{ t('admin.channelMonitor.form.useMyKey') }}</UiButton>
        </div>

        <UiTextField v-model="form.primary_model" test-id="monitor-primary-model" :label="t('admin.channelMonitor.form.primaryModel')" :placeholder="t('admin.channelMonitor.form.primaryModelPlaceholder')" monospace required />

        <UiFormField :label="t('admin.channelMonitor.form.extraModels')">
        <ModelTagInput
          :models="form.extra_models"
          :platform="form.provider"
          :placeholder="t('admin.channelMonitor.form.extraModelsPlaceholder')"
          @update:models="form.extra_models = $event"
        />
        </UiFormField>

        <UiTextField v-model="form.group_name" :label="t('admin.channelMonitor.form.groupName')" :placeholder="t('admin.channelMonitor.form.groupNamePlaceholder')" />

        <AppGrid min="200px" :gap="12">
          <UiTextField v-model.number="form.interval_seconds" type="number" min="15" max="3600" required :label="t('admin.channelMonitor.form.intervalSeconds')" :description="t('admin.channelMonitor.form.intervalSecondsHint')" />
          <UiTextField v-model.number="form.jitter_seconds" type="number" min="0" :max="maxJitterSeconds" :label="t('admin.channelMonitor.form.jitterSeconds')" :description="t('admin.channelMonitor.form.jitterSecondsHint')" />
        </AppGrid>

        <UiSwitch v-model="form.enabled" :label="t('admin.channelMonitor.form.enabled')" />

        <UiAccordion :items="advancedSections">
          <template #advanced>
            <AppStack :gap="12">
              <UiSelect
              v-model="templateSelectValue"
              :options="templateOptions"
              :label="t('admin.channelMonitor.templateField.label')"
              :description="t('admin.channelMonitor.templateField.applyHint')"
              :placeholder="t('admin.channelMonitor.templateField.placeholder')"
            />

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
          </template>
        </UiAccordion>
      </AppStack>
    </form>

    <template #footer>
      <AppInline justify="flex-end">
        <UiButton type="button" density="compact" @click="emit('close')">{{ t('common.cancel') }}</UiButton>
        <UiButton type="submit" form="channel-monitor-form" density="compact" variant="primary" :loading="submitting" :disabled="submitting">
          {{ submitting
            ? t('common.submitting')
            : editing ? t('common.update') : t('common.create') }}
        </UiButton>
      </AppInline>
    </template>
  </UiDialog>

  <MonitorKeyPickerDialog
    :show="showKeyPicker"
    :loading="myKeysLoading"
    :keys="myActiveKeys"
    :provider="form.provider"
    :user-group-rates="userGroupRates"
    @close="showKeyPicker = false"
    @pick="pickMyKey"
  />
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { adminAPI } from '@/api/admin'
import { keysAPI } from '@/api/keys'
import { userGroupsAPI } from '@/api/groups'
import type {
  BodyOverrideMode,
  ChannelMonitor,
  CreateParams,
  APIMode,
  Provider,
  UpdateParams,
} from '@/api/admin/channelMonitor'
import type { ChannelMonitorTemplate } from '@/api/admin/channelMonitorTemplate'
import type { ApiKey } from '@/types'
import ModelTagInput from '@/components/admin/channel/ModelTagInput.vue'
import MonitorKeyPickerDialog from '@/components/admin/monitor/MonitorKeyPickerDialog.vue'
import MonitorAdvancedRequestConfig from '@/components/admin/monitor/MonitorAdvancedRequestConfig.vue'
import {
  AppGrid,
  AppInline,
  AppStack,
  UiAccordion,
  UiButton,
  UiDialog,
  UiFormField,
  UiRadioGroup,
  UiSelect,
  UiSwitch,
  UiTextField,
} from '@/components/ui'
import {
  PROVIDER_OPENAI,
  PROVIDER_ANTHROPIC,
  PROVIDER_GEMINI,
  PROVIDER_GROK,
  API_MODE_CHAT_COMPLETIONS,
  API_MODE_RESPONSES,
  DEFAULT_GROK_ENDPOINT,
  DEFAULT_GROK_MODEL,
  DEFAULT_INTERVAL_SECONDS,
} from '@/constants/channelMonitor'

const props = defineProps<{
  show: boolean
  monitor: ChannelMonitor | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()

// System-configured default interval for new monitors. Falls back to the static
// constant when public settings haven't loaded yet or store the legacy 0 value.
const systemDefaultInterval = computed<number>(() => {
  const configured = appStore.cachedPublicSettings?.channel_monitor_default_interval_seconds
  return configured && configured > 0 ? configured : DEFAULT_INTERVAL_SECONDS
})

// editing is true when we have an existing monitor
const editing = computed<ChannelMonitor | null>(() => props.monitor)

const submitting = ref(false)

// API key picker
const showKeyPicker = ref(false)
const myKeysLoading = ref(false)
const myActiveKeys = ref<ApiKey[]>([])
const userGroupRates = ref<Record<number, number>>({})

interface MonitorForm {
  name: string
  provider: Provider
  api_mode: APIMode
  endpoint: string
  api_key: string
  primary_model: string
  extra_models: string[]
  group_name: string
  interval_seconds: number
  jitter_seconds: number
  enabled: boolean
  // 高级设置快照
  template_id: number | null
  extra_headers: Record<string, string>
  body_override_mode: BodyOverrideMode
  body_override: Record<string, unknown> | null
}

const form = reactive<MonitorForm>({
  name: '',
  provider: PROVIDER_ANTHROPIC,
  api_mode: API_MODE_CHAT_COMPLETIONS,
  endpoint: '',
  api_key: '',
  primary_model: '',
  extra_models: [],
  group_name: '',
  interval_seconds: systemDefaultInterval.value,
  jitter_seconds: 0,
  enabled: true,
  template_id: null,
  extra_headers: {},
  body_override_mode: 'off',
  body_override: null,
})

// jitter 上限与后端校验一致：interval - jitter 不得低于最小检测间隔 15 秒。
const maxJitterSeconds = computed<number>(() => Math.max(0, (form.interval_seconds || 0) - 15))

let suppressFormWatchers = false

// 可用模板列表（进入 dialog 时一次性拉取 cache；按 provider / api mode 过滤）。
const templatesCache = ref<ChannelMonitorTemplate[]>([])
const templatesLoading = ref(false)

const templateOptions = computed(() => {
  const items = templatesCache.value.filter((t) => {
    if (t.provider !== form.provider) return false
    if (form.provider !== PROVIDER_OPENAI) return true
    return normalizeAPIMode(t.api_mode) === form.api_mode
  })
  return [
    { value: '', label: t('admin.channelMonitor.templateField.none') },
    ...items.map((t) => ({ value: String(t.id), label: templateOptionLabel(t) })),
  ]
})

async function loadTemplates() {
  if (templatesCache.value.length > 0) return
  templatesLoading.value = true
  try {
    const { items } = await adminAPI.channelMonitorTemplate.list()
    templatesCache.value = items
  } catch (err: unknown) {
    // 模板拉取失败不阻塞监控表单，用户可以不选模板
    console.warn('load monitor templates failed', err)
  } finally {
    templatesLoading.value = false
  }
}

// 模板下拉绑定：value 是 string（Select 组件约束），需要与 number | null 互转。
const templateSelectValue = computed<string>({
  get: () => (form.template_id == null ? '' : String(form.template_id)),
  set: (raw: string) => {
    if (raw === '') {
      form.template_id = null
      return
    }
    const id = Number(raw)
    if (!Number.isFinite(id)) return
    form.template_id = id
    // 应用模板 = 拷贝快照
    const tpl = templatesCache.value.find((t) => t.id === id)
    if (tpl) {
      suppressFormWatchers = true
      form.api_mode = normalizeAPIMode(tpl.api_mode)
      form.template_id = id
      form.extra_headers = { ...(tpl.extra_headers || {}) }
      form.body_override_mode = tpl.body_override_mode
      form.body_override = tpl.body_override ? { ...tpl.body_override } : null
      suppressFormWatchers = false
    }
  },
})

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

function normalizeAPIMode(mode: APIMode | undefined | null): APIMode {
  return mode === API_MODE_RESPONSES ? API_MODE_RESPONSES : API_MODE_CHAT_COMPLETIONS
}

function templateOptionLabel(tpl: ChannelMonitorTemplate): string {
  if (tpl.provider !== PROVIDER_OPENAI) return tpl.name
  const labelKey = normalizeAPIMode(tpl.api_mode) === API_MODE_RESPONSES
    ? 'admin.channelMonitor.form.apiModeResponses'
    : 'admin.channelMonitor.form.apiModeChatCompletions'
  return `${tpl.name} · ${t(labelKey)}`
}

function clearRequestSnapshot() {
  form.template_id = null
  form.extra_headers = {}
  form.body_override_mode = 'off'
  form.body_override = null
}

interface ProviderOption {
  value: Provider
  label: string
}

const providerOptions = computed<ProviderOption[]>(() => [
  { value: PROVIDER_ANTHROPIC, label: t('monitorCommon.providers.anthropic') },
  { value: PROVIDER_OPENAI, label: t('monitorCommon.providers.openai') },
  { value: PROVIDER_GEMINI, label: t('monitorCommon.providers.gemini') },
  { value: PROVIDER_GROK, label: t('monitorCommon.providers.grok') },
])

const advancedSections = computed(() => [{
  key: 'advanced',
  title: t('admin.channelMonitor.advanced.section'),
  content: t('admin.channelMonitor.advanced.sectionHint'),
}])

function selectProvider(provider: Provider) {
  if (form.provider === provider) return
  const previousProvider = form.provider
  const clearGrokEndpoint =
    previousProvider === PROVIDER_GROK && form.endpoint === DEFAULT_GROK_ENDPOINT
  const clearGrokModel =
    previousProvider === PROVIDER_GROK && form.primary_model === DEFAULT_GROK_MODEL
  form.provider = provider
  if (provider === PROVIDER_GROK) {
    if (!form.endpoint.trim()) form.endpoint = DEFAULT_GROK_ENDPOINT
    if (!form.primary_model.trim()) form.primary_model = DEFAULT_GROK_MODEL
    return
  }
  if (clearGrokEndpoint) form.endpoint = ''
  if (clearGrokModel) form.primary_model = ''
}

// Clear api_key whenever provider changes to avoid cross-provider key mismatch.
// Editing mode loads api_key='' via loadFromMonitor and only sets it on user
// typing, so clearing on provider change is always a safe no-op until the user
// picks a new key.
// 同时清空 template_id（模板有 provider 归属，跨平台不通用）。
watch(() => form.provider, () => {
  if (suppressFormWatchers) return
  form.api_key = ''
  if (form.provider !== PROVIDER_OPENAI) {
    form.api_mode = API_MODE_CHAT_COMPLETIONS
  }
  clearRequestSnapshot()
}, { flush: 'sync' })

watch(() => form.api_mode, () => {
  if (suppressFormWatchers) return
  if (form.provider === PROVIDER_OPENAI) {
    clearRequestSnapshot()
  }
}, { flush: 'sync' })

function resetForm() {
  suppressFormWatchers = true
  form.name = ''
  form.provider = PROVIDER_ANTHROPIC
  form.api_mode = API_MODE_CHAT_COMPLETIONS
  form.endpoint = ''
  form.api_key = ''
  form.primary_model = ''
  form.extra_models = []
  form.group_name = ''
  form.interval_seconds = systemDefaultInterval.value
  form.jitter_seconds = 0
  form.enabled = true
  form.template_id = null
  form.extra_headers = {}
  form.body_override_mode = 'off'
  form.body_override = null
  suppressFormWatchers = false
}

function loadFromMonitor(m: ChannelMonitor) {
  suppressFormWatchers = true
  form.name = m.name
  form.provider = m.provider
  form.api_mode = normalizeAPIMode(m.api_mode)
  form.endpoint = m.endpoint
  form.api_key = ''
  form.primary_model = m.primary_model
  form.extra_models = [...(m.extra_models || [])]
  form.group_name = m.group_name || ''
  form.interval_seconds = m.interval_seconds || systemDefaultInterval.value
  form.jitter_seconds = m.jitter_seconds || 0
  form.enabled = m.enabled
  form.template_id = m.template_id ?? null
  form.extra_headers = { ...(m.extra_headers || {}) }
  form.body_override_mode = m.body_override_mode || 'off'
  form.body_override = m.body_override ? { ...m.body_override } : null
  suppressFormWatchers = false
}

// Re-sync form whenever the dialog is opened or the target monitor changes.
// 同时拉取模板列表（cache 过的话一次性返回）。
watch(
  () => [props.show, props.monitor] as const,
  ([show, m]) => {
    if (!show) return
    void loadTemplates()
    if (m) loadFromMonitor(m)
    else resetForm()
  },
  { immediate: true },
)

function useCurrentDomain() {
  form.endpoint = window.location.origin
}

async function openMyKeyPicker() {
  showKeyPicker.value = true
  if (myActiveKeys.value.length > 0) return
  myKeysLoading.value = true
  try {
    const [res, rates] = await Promise.all([
      keysAPI.list(1, 100, { status: 'active' }),
      userGroupsAPI.getUserGroupRates(),
    ])
    const items = res.items || []
    const now = Date.now()
    myActiveKeys.value = items.filter(k => {
      if (k.status !== 'active') return false
      if (!k.expires_at) return true
      return new Date(k.expires_at).getTime() > now
    })
    userGroupRates.value = rates
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('admin.channelMonitor.form.noActiveKey')))
  } finally {
    myKeysLoading.value = false
  }
}

function pickMyKey(k: ApiKey) {
  form.api_key = k.key
  showKeyPicker.value = false
}

function buildPayload(): CreateParams {
  return {
    name: form.name.trim(),
    provider: form.provider,
    api_mode: form.provider === PROVIDER_OPENAI ? form.api_mode : API_MODE_CHAT_COMPLETIONS,
    endpoint: form.endpoint.trim(),
    api_key: form.api_key.trim(),
    primary_model: form.primary_model.trim(),
    extra_models: form.extra_models,
    group_name: form.group_name.trim(),
    enabled: form.enabled,
    interval_seconds: form.interval_seconds,
    jitter_seconds: form.jitter_seconds || 0,
    template_id: form.template_id,
    extra_headers: form.extra_headers,
    body_override_mode: form.body_override_mode,
    body_override: form.body_override,
  }
}

async function handleSubmit() {
  if (submitting.value) return
  if (!form.name.trim()) {
    appStore.showError(t('admin.channelMonitor.nameRequired'))
    return
  }
  if (!form.primary_model.trim()) {
    appStore.showError(t('admin.channelMonitor.primaryModelRequired'))
    return
  }

  submitting.value = true
  try {
    const target = editing.value
    if (target) {
      const { api_key, ...rest } = buildPayload()
      const req: UpdateParams = { ...rest }
      // Only send api_key if user typed a new value
      if (api_key) req.api_key = api_key
      // template_id=null 用 clear_template=true 明确告诉后端清空（pointer 语义）
      if (form.template_id == null) {
        req.clear_template = true
        delete req.template_id
      }
      await adminAPI.channelMonitor.update(target.id, req)
      appStore.showSuccess(t('admin.channelMonitor.updateSuccess'))
    } else {
      await adminAPI.channelMonitor.create(buildPayload())
      appStore.showSuccess(t('admin.channelMonitor.createSuccess'))
    }
    emit('saved')
    emit('close')
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.monitor-form-command {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
  min-width: 0;
}

@media (max-width: 520px) {
  .monitor-form-command {
    grid-template-columns: 1fr;
  }

  .monitor-form-command > :last-child {
    justify-self: stretch;
  }
}
</style>
