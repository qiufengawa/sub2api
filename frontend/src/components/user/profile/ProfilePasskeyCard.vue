<template>
  <div :class="props.embedded ? 'border-t border-gray-100 dark:border-dark-700' : 'ui-panel'">
    <div :class="props.embedded ? 'flex items-start justify-between gap-3 px-4 pt-3' : 'flex items-start justify-between border-b border-gray-100 px-6 py-4 dark:border-dark-700'">
      <div>
        <h2 :class="props.embedded ? 'text-sm font-medium text-gray-900 dark:text-white' : 'text-lg font-medium text-gray-900 dark:text-white'">
          {{ t('profile.passkey.title') }}
        </h2>
        <p :class="props.embedded ? 'mt-0.5 text-xs text-gray-500 dark:text-dark-400' : 'mt-1 text-sm text-gray-500 dark:text-gray-400'">
          {{ t('profile.passkey.description') }}
        </p>
      </div>
      <UiButton
        v-if="enabled && supported && !showAddForm"
        type="button"
        variant="primary"
        :density="props.embedded ? 'compact' : 'default'"
        :disabled="busy"
        @click="showAddForm = true"
      >
        {{ t('profile.passkey.add') }}
      </UiButton>
    </div>

    <div :class="props.embedded ? 'px-4 pb-3 pt-2' : 'px-6 py-6'">
      <div v-if="!enabled" :class="props.embedded ? 'text-xs text-gray-500 dark:text-dark-400' : 'mb-5 text-sm text-gray-500 dark:text-gray-400'">
        {{ t('profile.passkey.featureDisabled') }}
      </div>
      <div v-if="enabled && !supported" :class="props.embedded ? 'text-xs text-amber-600 dark:text-amber-400' : 'mb-5 text-sm text-amber-600 dark:text-amber-400'">
        {{ t('profile.passkey.unsupported') }}
      </div>
      <div>
        <form
          v-if="enabled && supported && showAddForm"
          :class="props.embedded ? 'mb-3 flex flex-col gap-3 rounded border border-gray-200 p-3 dark:border-dark-700' : 'mb-5 flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-dark-700'"
          @submit.prevent="addPasskey"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <UiTextField
                id="passkey-name"
                v-model="newName"
                :maxlength="100"
                autofocus
                :density="props.embedded ? 'compact' : 'default'"
                :label="t('profile.passkey.name')"
                :placeholder="t('profile.passkey.namePlaceholder')"
            />
            <UiPasswordField
                id="passkey-add-password"
                v-model="newPassword"
                autocomplete="current-password"
                :density="props.embedded ? 'compact' : 'default'"
                :label="t('profile.currentPassword')"
                :reveal-label="t('common.showPassword')"
                :hide-label="t('common.hidePassword')"
                :placeholder="t('profile.passkey.passwordPlaceholder')"
            />
          </div>
          <div class="flex justify-end gap-2">
            <UiButton type="button" density="compact" :disabled="busy" @click="cancelAdd">
              {{ t('common.cancel') }}
            </UiButton>
            <UiButton
              type="submit"
              variant="primary"
              density="compact"
              :loading="busy"
              :disabled="newPassword.length === 0"
            >
              {{ t('profile.passkey.continue') }}
            </UiButton>
          </div>
        </form>

        <div v-if="enabled && supported && loading" :class="props.embedded ? 'flex justify-center py-3' : 'flex justify-center py-6'">
          <UiSpinner :size="props.embedded ? 'sm' : 'md'" :label="t('common.loading')" />
        </div>

        <div
          v-else-if="enabled && supported && credentials.length === 0"
          :class="props.embedded ? 'rounded border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-500 dark:border-dark-700 dark:text-dark-400' : 'rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-dark-700 dark:text-gray-400'"
        >
          {{ t('profile.passkey.empty') }}
        </div>

        <div v-else-if="enabled && supported" class="divide-y divide-gray-100 dark:divide-dark-700">
          <div
            v-for="credential in credentials"
            :key="credential.id"
            :class="props.embedded ? 'flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0' : 'flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0'"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <Icon name="key" size="md" class="shrink-0 text-primary-500" />
                <p class="truncate font-medium text-gray-900 dark:text-white">
                  {{ credential.name }}
                </p>
                <span
                  v-if="credential.backup"
                  class="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300"
                >
                  {{ t('profile.passkey.synced') }}
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('profile.passkey.createdAt', { date: formatDate(credential.created_at) }) }}
                <template v-if="credential.last_used_at">
                  · {{ t('profile.passkey.lastUsed', { date: formatDate(credential.last_used_at) }) }}
                </template>
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <UiButton
                type="button"
                density="compact"
                :disabled="busy"
                @click="renamePasskey(credential)"
              >
                {{ t('common.edit') }}
              </UiButton>
              <UiButton
                type="button"
                variant="danger"
                density="compact"
                :disabled="busy"
                @click="deletePasskey(credential)"
              >
                {{ t('common.delete') }}
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认：吊销凭据需验证当前密码，防止被窃会话静默移除 Passkey -->
    <UiDialog
      :show="Boolean(deleteTarget)"
      :title="t('profile.passkey.deleteTitle')"
      width="narrow"
      :show-close-button="false"
      :close-on-click-outside="true"
      @close="closeDeleteDialog"
    >
      <p class="passkey-delete__description">
        {{ t('profile.passkey.deleteConfirm', { name: deleteTarget?.name || '' }) }}
      </p>
      <form class="passkey-delete__form" @submit.prevent="confirmDelete">
        <UiPasswordField
          id="passkey-delete-password"
          v-model="deletePassword"
          autocomplete="current-password"
          :density="props.embedded ? 'compact' : 'default'"
          :label="t('profile.currentPassword')"
          :reveal-label="t('common.showPassword')"
          :hide-label="t('common.hidePassword')"
          :placeholder="t('profile.passkey.passwordPlaceholder')"
          autofocus
        />
        <div class="passkey-delete__actions">
          <UiButton type="button" density="compact" :disabled="busy" @click="closeDeleteDialog">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            type="submit"
            variant="danger"
            density="compact"
            :loading="busy"
            :disabled="deletePassword.length === 0"
          >
            {{ t('common.delete') }}
          </UiButton>
        </div>
      </form>
    </UiDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { passkeyAPI, type PasskeyCredentialSummary } from '@/api'
import { Icon } from '@/components/icons'
import { useAppStore } from '@/stores/app'
import { UiButton, UiDialog, UiPasswordField, UiSpinner, UiTextField } from '@/components/ui'

const props = withDefaults(defineProps<{
  enabled: boolean
  embedded?: boolean
}>(), {
  embedded: false,
})

const { t } = useI18n()
const appStore = useAppStore()
const supported = passkeyAPI.isSupported()
const loading = ref(false)
const busy = ref(false)
const showAddForm = ref(false)
const newName = ref('')
const newPassword = ref('')
const deleteTarget = ref<PasskeyCredentialSummary | null>(null)
const deletePassword = ref('')
const credentials = ref<PasskeyCredentialSummary[]>([])

// apiClient 拦截器把错误规范化为 { code, reason, message }；
// 透出后端消息（如密码错误），否则回退到通用文案。
function extractErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: string }).message
  return typeof message === 'string' && message.length > 0 ? message : fallback
}

async function loadCredentials(): Promise<void> {
  if (!props.enabled) {
    credentials.value = []
    return
  }
  loading.value = true
  try {
    credentials.value = await passkeyAPI.list()
  } catch (error) {
    // 字符串错误码在 reason 字段（code 是数字状态码）；
    // 设置变更竞态下后端仍可能返回 PASSKEY_DISABLED，静默处理
    const reason = (error as { reason?: string }).reason
    if (reason !== 'PASSKEY_DISABLED') {
      appStore.showError(t('profile.passkey.loadFailed'))
    }
  } finally {
    loading.value = false
  }
}

async function addPasskey(): Promise<void> {
  if (newPassword.value.length === 0) return
  busy.value = true
  try {
    await passkeyAPI.register(newName.value.trim(), newPassword.value)
    appStore.showSuccess(t('profile.passkey.added'))
    cancelAdd()
    await loadCredentials()
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
      appStore.showError(extractErrorMessage(error, t('profile.passkey.addFailed')))
    }
  } finally {
    busy.value = false
  }
}

function cancelAdd(): void {
  showAddForm.value = false
  newName.value = ''
  newPassword.value = ''
}

async function renamePasskey(credential: PasskeyCredentialSummary): Promise<void> {
  const name = window.prompt(t('profile.passkey.renamePrompt'), credential.name)?.trim()
  if (!name || name === credential.name) return
  busy.value = true
  try {
    await passkeyAPI.rename(credential.id, name)
    credential.name = name
    appStore.showSuccess(t('profile.passkey.renamed'))
  } catch {
    appStore.showError(t('profile.passkey.renameFailed'))
  } finally {
    busy.value = false
  }
}

function deletePasskey(credential: PasskeyCredentialSummary): void {
  deleteTarget.value = credential
  deletePassword.value = ''
}

function closeDeleteDialog(): void {
  deleteTarget.value = null
  deletePassword.value = ''
}

async function confirmDelete(): Promise<void> {
  const credential = deleteTarget.value
  if (!credential || deletePassword.value.length === 0) return
  busy.value = true
  try {
    await passkeyAPI.remove(credential.id, deletePassword.value)
    credentials.value = credentials.value.filter((item) => item.id !== credential.id)
    appStore.showSuccess(t('profile.passkey.deleted'))
    closeDeleteDialog()
  } catch (error) {
    // 密码错误等失败保持对话框打开，允许重试
    appStore.showError(extractErrorMessage(error, t('profile.passkey.deleteFailed')))
  } finally {
    busy.value = false
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(value))
}

watch(
  () => props.enabled,
  () => {
    void loadCredentials()
  },
  { immediate: true }
)
</script>

<style scoped>
.passkey-delete__description{margin:0;color:var(--ui-text-muted);font-size:13px;line-height:20px}
.passkey-delete__form{display:grid;gap:16px;margin-top:16px}
.passkey-delete__actions{display:flex;justify-content:flex-end;gap:8px}
</style>
