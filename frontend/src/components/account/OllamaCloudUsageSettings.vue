<template>
  <section v-if="state?.eligible" class="ollama-usage" data-testid="ollama-cloud-usage-settings">
    <div class="ollama-usage__header">
      <div>
        <h3>
          {{ t('admin.accounts.ollamaCloud.title') }}
        </h3>
        <p>
          {{ t('admin.accounts.ollamaCloud.sessionSecurityHint') }}
        </p>
      </div>
      <UiBadge
        :tone="state.configured ? 'success' : 'neutral'"
        :label="state.configured ? t('admin.accounts.ollamaCloud.configured') : t('admin.accounts.ollamaCloud.notConfigured')"
        dot
      />
    </div>

    <div v-if="loading" class="ollama-usage__loading">
      <UiSpinner :label="t('common.loading')" />
    </div>
    <AppStack v-else :gap="14">
      <UiAlert v-if="!state.encryption_key_configured" tone="warning">
        {{ t('admin.accounts.ollamaCloud.encryptionKeyRequired') }}
      </UiAlert>

      <div
        v-if="snapshot"
        data-testid="ollama-cloud-usage-details"
      >
        <UiDescriptionList :items="detailItems" :columns="1">
          <template #status>
            <UiStatusBadge :status="statusTone" :label="statusLabel" />
          </template>
        </UiDescriptionList>
        <UiAlert v-if="snapshot.last_error" class="ollama-usage__error" tone="warning">
          {{ t(`admin.accounts.ollamaCloud.errors.${snapshot.last_error}`, snapshot.last_error) }}
        </UiAlert>
      </div>

      <UiTextArea
        id="ollama-cloud-session"
        v-model="session"
        :rows="3"
        :label="t('admin.accounts.ollamaCloud.sessionLabel')"
        :description="t('admin.accounts.ollamaCloud.writeOnlyHint')"
        :placeholder="t('admin.accounts.ollamaCloud.sessionPlaceholder')"
        autocomplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        data-bwignore="true"
        monospace
      />

      <AppInline :gap="8">
        <UiButton
          variant="primary"
          density="compact"
          :loading="saving"
          :disabled="saving || !session.trim() || !state.encryption_key_configured"
          data-testid="ollama-cloud-session-save"
          @click="saveSession"
        >
          <template #icon><Icon name="check" size="xs" /></template>
          {{ t('common.save') }}
        </UiButton>
        <UiButton
          v-if="state.configured"
          variant="danger"
          density="compact"
          :disabled="saving"
          data-testid="ollama-cloud-session-delete"
          @click="showDeleteConfirm = true"
        >
          <template #icon><Icon name="trash" size="xs" /></template>
          {{ t('admin.accounts.ollamaCloud.deleteSession') }}
        </UiButton>
        <UiButton
          v-if="state.configured"
          density="compact"
          :loading="refreshing"
          data-testid="ollama-cloud-refresh"
          @click="refreshUsage"
        >
          <template #icon><Icon v-if="!refreshing" name="refresh" size="xs" /></template>
          {{ t('admin.accounts.ollamaCloud.refreshNow') }}
        </UiButton>
      </AppInline>

      <div v-if="state.configured" class="ollama-usage__switch-row">
        <div>
          <strong>
            {{ t('admin.accounts.ollamaCloud.autoRefresh') }}
          </strong>
          <p>
            {{ t('admin.accounts.ollamaCloud.autoRefreshHint') }}
          </p>
        </div>
        <UiSwitch
          :model-value="state.auto_refresh_enabled"
          :label="t('admin.accounts.ollamaCloud.autoRefresh')"
          :disabled="saving"
          data-testid="ollama-cloud-auto-refresh"
          @update:model-value="setAutoRefresh"
        />
      </div>
    </AppStack>

    <UiConfirmDialog
      :show="showDeleteConfirm"
      :title="t('admin.accounts.ollamaCloud.deleteSession')"
      :message="t('admin.accounts.ollamaCloud.deleteConfirm')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :danger="true"
      :pending="saving"
      @confirm="deleteSession"
      @cancel="cancelDeleteSession"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage, extractI18nErrorMessage } from '@/utils/apiError'
import type { Account, OllamaCloudUsageState, OllamaCloudUsageWindow } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import {
  AppInline,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiConfirmDialog,
  UiDescriptionList,
  UiSpinner,
  UiStatusBadge,
  UiSwitch,
  UiTextArea
} from '@/components/ui'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ updated: [state: OllamaCloudUsageState] }>()
const { t } = useI18n()
const appStore = useAppStore()
const state = ref<OllamaCloudUsageState | null>(props.account.ollama_cloud_usage ?? null)
const session = ref('')
const loading = ref(false)
const saving = ref(false)
const refreshing = ref(false)
const showDeleteConfirm = ref(false)
const snapshot = computed(() => state.value?.snapshot)
const statusLabel = computed(() => {
  if (!snapshot.value) return t('admin.accounts.ollamaCloud.notRefreshed')
  if (snapshot.value.status === 'unauthorized') return t('admin.accounts.ollamaCloud.unauthorized')
  if (snapshot.value.status === 'failed') return t('admin.accounts.ollamaCloud.failed')
  return t('admin.accounts.ollamaCloud.ok')
})
const statusTone = computed(() => {
  if (!snapshot.value) return 'neutral'
  if (snapshot.value.status === 'ok') return 'success'
  if (snapshot.value.status === 'unauthorized') return 'warning'
  if (snapshot.value.status === 'failed') return 'failed'
  return 'neutral'
})
const modelSummary = computed(() => snapshot.value?.data?.models?.map(model => {
  const window = model.window === 'five_hour'
    ? t('admin.accounts.ollamaCloud.fiveHourShort')
    : t('admin.accounts.ollamaCloud.sevenDayShort')
  return `${window} ${model.model}: ${model.requests}`
}).join(', ') || '-')

const formatPercent = (value?: number) => typeof value === 'number' && Number.isFinite(value)
  ? `${value.toFixed(value % 1 ? 1 : 0)}%`
  : '-'
const formatDate = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
const windowSummary = (window?: OllamaCloudUsageWindow) => {
  if (!window) return '-'
  const reset = window.reset_at ? formatDate(window.reset_at) : window.reset_text
  return reset
    ? t('admin.accounts.ollamaCloud.windowWithReset', { percent: formatPercent(window.used_percent), reset })
    : formatPercent(window.used_percent)
}
const detailItems = computed(() => [
  { key: 'plan', label: t('admin.accounts.ollamaCloud.plan'), value: snapshot.value?.data?.plan || '-' },
  { key: 'fiveHour', label: t('admin.accounts.ollamaCloud.fiveHour'), value: windowSummary(snapshot.value?.data?.five_hour) },
  { key: 'sevenDay', label: t('admin.accounts.ollamaCloud.sevenDay'), value: windowSummary(snapshot.value?.data?.seven_day) },
  { key: 'balance', label: t('admin.accounts.ollamaCloud.balance'), value: snapshot.value?.data?.balance || '-' },
  { key: 'models', label: t('admin.accounts.ollamaCloud.models'), value: modelSummary.value },
  { key: 'status', label: t('admin.accounts.ollamaCloud.status'), value: statusLabel.value },
  { key: 'updatedAt', label: t('admin.accounts.ollamaCloud.updatedAt'), value: formatDate(snapshot.value?.fetched_at || snapshot.value?.last_attempt_at) }
])

const applyState = (next: OllamaCloudUsageState) => {
  state.value = next
  emit('updated', next)
}

const load = async () => {
  loading.value = true
  try {
    applyState(await adminAPI.accounts.getOllamaCloudUsage(props.account.id))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.accounts.ollamaCloud.loadFailed')))
  } finally {
    loading.value = false
  }
}

const saveSession = async () => {
  if (!session.value.trim()) return
  saving.value = true
  try {
    applyState(await adminAPI.accounts.saveOllamaCloudUsageSession(props.account.id, session.value))
    session.value = ''
    appStore.showSuccess(t('admin.accounts.ollamaCloud.sessionSaved'))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.accounts.ollamaCloud.sessionSaveFailed')))
  } finally {
    saving.value = false
  }
}

const deleteSession = async () => {
  if (saving.value) return
  saving.value = true
  try {
    applyState(await adminAPI.accounts.deleteOllamaCloudUsageSession(props.account.id))
    session.value = ''
    appStore.showSuccess(t('admin.accounts.ollamaCloud.sessionDeleted'))
    showDeleteConfirm.value = false
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.accounts.ollamaCloud.sessionDeleteFailed')))
  } finally {
    saving.value = false
  }
}

const cancelDeleteSession = () => {
  if (saving.value) return
  showDeleteConfirm.value = false
}

const setAutoRefresh = async (enabled: boolean) => {
  saving.value = true
  try {
    applyState(await adminAPI.accounts.setOllamaCloudUsageAutoRefresh(props.account.id, enabled))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.accounts.ollamaCloud.autoRefreshFailed')))
  } finally {
    saving.value = false
  }
}

const refreshUsage = async () => {
  refreshing.value = true
  try {
    applyState(await adminAPI.accounts.refreshOllamaCloudUsage(props.account.id))
    appStore.showSuccess(t('admin.accounts.ollamaCloud.refreshSuccess'))
  } catch (error) {
    appStore.showError(extractI18nErrorMessage(
      error,
      t,
      'admin.accounts.ollamaCloud.errors',
      t('admin.accounts.ollamaCloud.refreshFailed')
    ))
  } finally {
    refreshing.value = false
  }
}

watch(() => props.account.id, () => {
  state.value = props.account.ollama_cloud_usage ?? null
  session.value = ''
  if (!state.value) void load()
})

onMounted(() => {
  if (!state.value) void load()
})
</script>

<style scoped>
.ollama-usage{display:flex;min-width:0;flex-direction:column;gap:14px;padding-top:16px;border-top:1px solid var(--ui-border-soft)}
.ollama-usage__header,.ollama-usage__switch-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.ollama-usage__header h3,.ollama-usage__switch-row strong{margin:0;color:var(--ui-text);font-size:13px;font-weight:600;line-height:20px}
.ollama-usage__header p,.ollama-usage__switch-row p{margin:2px 0 0;color:var(--ui-text-muted);font-size:12px;line-height:20px}
.ollama-usage__loading{display:flex;min-height:80px;align-items:center;justify-content:center;color:var(--ui-text-soft)}
.ollama-usage__error{margin-top:10px}
.ollama-usage__switch-row{align-items:center;padding-top:14px;border-top:1px solid var(--ui-border-soft)}
@media(max-width:520px){.ollama-usage__header{align-items:flex-start}.ollama-usage__switch-row{gap:12px}}
</style>
