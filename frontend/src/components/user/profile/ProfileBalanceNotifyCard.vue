<template>
  <div :class="props.embedded ? (props.flat ? '' : 'overflow-hidden rounded border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800') : 'ui-panel'">
    <div :class="props.embedded ? (props.flat ? 'pb-3' : 'border-b border-gray-100 px-4 py-3 dark:border-dark-700') : 'border-b border-gray-100 px-6 py-4 dark:border-dark-700'">
      <h2 :class="props.embedded ? 'text-sm font-semibold text-gray-900 dark:text-white' : 'text-lg font-medium text-gray-900 dark:text-white'">
        {{ t('profile.balanceNotify.title') }}
      </h2>
      <p :class="props.embedded ? 'mt-0.5 text-xs text-gray-500 dark:text-dark-400' : 'mt-1 text-sm text-gray-500 dark:text-gray-400'">
        {{ t('profile.balanceNotify.description') }}
      </p>
    </div>
    <div :class="props.embedded ? (props.flat ? 'space-y-4' : 'space-y-4 px-4 py-4') : 'space-y-6 px-6 py-6'">
      <!-- Enable toggle -->
      <div class="flex items-center justify-between">
        <label class="ui-field-label mb-0">{{ t('profile.balanceNotify.enabled') }}</label>
        <UiSwitch
          :model-value="notifyEnabled"
          data-testid="profile-balance-notify-toggle"
          :label="t('profile.balanceNotify.enabled')"
          @update:model-value="handleToggle"
        />
      </div>

      <template v-if="notifyEnabled">
        <!-- Custom threshold with save button -->
        <div>
          <label for="profile-balance-notify-threshold" class="ui-field-label">
            {{ t('profile.balanceNotify.threshold') }}
            <span class="text-xs text-gray-400 ml-2">{{ t('profile.balanceNotify.thresholdHint') }}</span>
          </label>
          <div class="flex items-center gap-2">
            <UiTextField
              id="profile-balance-notify-threshold"
              v-model.number="customThreshold"
              test-id="profile-balance-notify-threshold"
              type="number"
              min="0"
              step="0.01"
              density="compact"
              class="flex-1"
              :placeholder="systemDefaultThreshold > 0 ? `${t('profile.balanceNotify.systemDefault')} $${systemDefaultThreshold}` : t('profile.balanceNotify.thresholdPlaceholder')"
            >
              <template #prefix>$</template>
            </UiTextField>
            <UiButton
              data-testid="profile-balance-notify-threshold-save"
              type="button"
              variant="primary"
              density="compact"
              @click="handleThresholdUpdate"
              :loading="savingThreshold"
              class="whitespace-nowrap"
            >
              {{ savingThreshold ? t('common.saving') : t('common.save') }}
            </UiButton>
          </div>
        </div>

        <!-- Email list with toggles -->
        <div>
          <label class="ui-field-label">{{ t('profile.balanceNotify.extraEmails') }}</label>
          <p class="mb-2 text-xs text-yellow-600 dark:text-yellow-400">{{ t('profile.balanceNotify.extraEmailsHint') }}</p>

          <!-- Saved email entries -->
          <div v-if="emailEntries.length > 0" class="space-y-2 mb-3">
            <div v-for="(entry, idx) in emailEntries" :key="idx"
              class="flex items-center justify-between rounded bg-gray-50 px-3 py-2 dark:bg-dark-700">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <UiSwitch
                  :model-value="!entry.disabled"
                  :label="entry.email"
                  @update:model-value="handleEmailToggle(entry)"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ entry.email }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <template v-if="!entry.verified">
                  <!-- Inline verify flow for saved unverified emails -->
                  <template v-if="verifyingEmail === entry.email">
                    <UiTextField
                      v-model="verifyCode"
                      type="text"
                      :maxlength="6"
                      inputmode="numeric"
                      density="mini"
                      class="w-24"
                      :input-attrs="{ 'aria-label': t('profile.balanceNotify.enterCode') }"
                      :placeholder="t('profile.balanceNotify.codePlaceholder')"
                    />
                    <UiButton
                      type="button"
                      variant="quiet"
                      density="mini"
                      :disabled="!verifyCode || verifyCode.length !== 6"
                      :loading="verifyingSaved"
                      @click="verifySavedEmail(entry.email)"
                    >
                      {{ t('profile.balanceNotify.verify') }}
                    </UiButton>
                    <span v-if="verifyCountdown > 0" class="text-xs text-gray-400">{{ verifyCountdown }}s</span>
                    <UiButton
                      v-else
                      type="button"
                      variant="quiet"
                      density="mini"
                      :loading="sendingSavedCode"
                      @click="sendCodeForSaved(entry.email)"
                    >
                      {{ t('profile.balanceNotify.resend') }}
                    </UiButton>
                    <UiButton type="button" variant="quiet" density="mini" @click="verifyingEmail = ''">
                      {{ t('common.cancel') }}
                    </UiButton>
                  </template>
                  <template v-else>
                    <UiButton
                      type="button"
                      variant="quiet"
                      density="mini"
                      :loading="sendingSavedCode"
                      @click="sendCodeForSaved(entry.email)"
                    >
                      {{ t('profile.balanceNotify.verify') }}
                    </UiButton>
                    <span class="text-xs text-yellow-500">{{ t('profile.balanceNotify.unverified') }}</span>
                  </template>
                </template>
                <span v-else class="text-xs text-green-500">{{ t('profile.balanceNotify.verified') }}</span>
                <UiIconButton
                  type="button"
                  icon="trash"
                  variant="danger"
                  density="mini"
                  :label="t('profile.balanceNotify.removeEmail')"
                  @click="handleRemoveEmail(entry.email)"
                />
              </div>
            </div>
          </div>

          <!-- Pending (unverified) emails in verification flow -->
          <div v-if="pendingEmails.length > 0" class="space-y-2 mb-3">
            <div v-for="(pe, idx) in pendingEmails" :key="pe.email"
              class="flex items-center gap-2 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 dark:border-yellow-800 dark:bg-yellow-900/10">
              <span class="flex-1 text-sm text-gray-700 dark:text-gray-300">{{ pe.email }}</span>
              <div v-if="!pe.codeSent" class="flex items-center gap-1">
                <UiButton
                  type="button"
                  variant="quiet"
                  density="mini"
                  :loading="pe.sending"
                  @click="sendCodeFor(idx)"
                >
                  {{ t('profile.balanceNotify.sendCode') }}
                </UiButton>
                <UiIconButton
                  type="button"
                  icon="trash"
                  variant="danger"
                  density="mini"
                  :label="t('profile.balanceNotify.removeEmail')"
                  @click="pendingEmails.splice(idx, 1)"
                />
              </div>
              <div v-else class="flex items-center gap-1">
                <UiTextField
                  v-model="pe.code"
                  type="text"
                  :maxlength="6"
                  inputmode="numeric"
                  density="mini"
                  class="w-24"
                  :input-attrs="{ 'aria-label': t('profile.balanceNotify.enterCode') }"
                  :placeholder="t('profile.balanceNotify.codePlaceholder')"
                />
                <UiButton
                  type="button"
                  variant="quiet"
                  density="mini"
                  :disabled="!pe.code || pe.code.length !== 6"
                  :loading="pe.verifying"
                  @click="verifyPending(idx)"
                >
                  {{ t('profile.balanceNotify.verify') }}
                </UiButton>
                <span v-if="pe.countdown > 0" class="text-xs text-gray-400">{{ pe.countdown }}s</span>
                <UiButton
                  v-else
                  type="button"
                  variant="quiet"
                  density="mini"
                  :loading="pe.sending"
                  @click="sendCodeFor(idx)"
                >
                  {{ t('profile.balanceNotify.resend') }}
                </UiButton>
              </div>
            </div>
          </div>

          <!-- Add new email input (hidden when at limit) -->
          <div v-if="canAddMore" class="flex gap-2">
            <UiTextField
              v-model="newEmail"
              test-id="profile-balance-notify-new-email"
              type="email"
              density="compact"
              class="flex-1"
              :placeholder="t('profile.balanceNotify.emailPlaceholder')"
              :input-attrs="{ 'aria-label': t('profile.balanceNotify.enterEmail') }"
              prevent-enter-default
              @enter="addPendingEmail"
            />
            <UiButton
              data-testid="profile-balance-notify-add-email"
              type="button"
              density="compact"
              @click="addPendingEmail"
              :disabled="!newEmail"
              class="whitespace-nowrap"
            >
              {{ t('common.add') }}
            </UiButton>
          </div>
          <p v-else class="text-xs text-gray-400">
            {{ t('profile.balanceNotify.maxEmailsReached') }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { userAPI } from '@/api'
import { extractApiErrorMessage } from '@/utils/apiError'
import type { NotifyEmailEntry } from '@/types'
import { UiButton, UiIconButton, UiSwitch, UiTextField } from '@/components/ui'

const maxTotalEmails = 3

interface PendingEmail {
  email: string
  codeSent: boolean
  code: string
  sending: boolean
  verifying: boolean
  countdown: number
  timer: ReturnType<typeof setInterval> | null
}

const props = defineProps<{
  enabled: boolean
  threshold: number | null
  extraEmails: NotifyEmailEntry[]
  systemDefaultThreshold: number
  userEmail: string
  embedded?: boolean
  flat?: boolean
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()

const notifyEnabled = ref(props.enabled)
const customThreshold = ref<number | null>(props.threshold)
const emailEntries = ref<NotifyEmailEntry[]>([...props.extraEmails])
const pendingEmails = ref<PendingEmail[]>([])
const newEmail = ref('')
const savingThreshold = ref(false)

// State for verifying saved unverified emails
const verifyingEmail = ref('')
const verifyCode = ref('')
const verifyingSaved = ref(false)
const sendingSavedCode = ref(false)
const verifyCountdown = ref(0)
let verifyTimer: ReturnType<typeof setInterval> | null = null

const canAddMore = computed(() => {
  return emailEntries.value.length + pendingEmails.value.length < maxTotalEmails
})

watch(() => props.enabled, (val) => { notifyEnabled.value = val })
watch(() => props.threshold, (val) => { customThreshold.value = val })
watch(() => props.extraEmails, (val) => { emailEntries.value = [...val] })

// When list is empty on mount, pre-fill the add input with user's email
onMounted(() => {
  if (emailEntries.value.length === 0 && props.userEmail) {
    newEmail.value = props.userEmail
  }
})

onUnmounted(() => {
  for (const pe of pendingEmails.value) {
    if (pe.timer) clearInterval(pe.timer)
  }
  if (verifyTimer) clearInterval(verifyTimer)
})

const handleToggle = async (enabled: boolean) => {
  notifyEnabled.value = enabled
  try {
    const updated = await userAPI.updateProfile({ balance_notify_enabled: enabled })
    authStore.user = updated
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
    notifyEnabled.value = !enabled
  }
}

const handleThresholdUpdate = async () => {
  savingThreshold.value = true
  try {
    const threshold = customThreshold.value && customThreshold.value > 0 ? customThreshold.value : 0
    const updated = await userAPI.updateProfile({ balance_notify_threshold: threshold })
    authStore.user = updated
    appStore.showSuccess(t('common.saved'))
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    savingThreshold.value = false
  }
}

async function handleEmailToggle(entry: NotifyEmailEntry) {
  const newDisabled = !entry.disabled
  try {
    const updated = await userAPI.toggleNotifyEmail(entry.email, newDisabled)
    authStore.user = updated
    emailEntries.value = [...updated.balance_notify_extra_emails]
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  }
}

function addPendingEmail() {
  const email = newEmail.value.trim()
  if (!email) return
  // Check duplicates
  const isDuplicate = emailEntries.value.some(e => e.email.toLowerCase() === email.toLowerCase())
    || pendingEmails.value.some(p => p.email.toLowerCase() === email.toLowerCase())
  if (isDuplicate) {
    appStore.showError(t('profile.balanceNotify.emailDuplicate'))
    return
  }
  pendingEmails.value.push({ email, codeSent: false, code: '', sending: false, verifying: false, countdown: 0, timer: null })
  newEmail.value = ''
}

async function sendCodeFor(idx: number) {
  const pe = pendingEmails.value[idx]
  if (!pe) return
  pe.sending = true
  try {
    await userAPI.sendNotifyEmailCode(pe.email)
    pe.codeSent = true
    pe.countdown = 60
    pe.timer = setInterval(() => {
      pe.countdown--
      if (pe.countdown <= 0 && pe.timer) {
        clearInterval(pe.timer)
        pe.timer = null
      }
    }, 1000)
    appStore.showSuccess(t('profile.balanceNotify.codeSent'))
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    pe.sending = false
  }
}

async function verifyPending(idx: number) {
  const pe = pendingEmails.value[idx]
  if (!pe || !pe.code || pe.code.length !== 6) return
  pe.verifying = true
  try {
    await userAPI.verifyNotifyEmail(pe.email, pe.code)
    if (pe.timer) clearInterval(pe.timer)
    pendingEmails.value.splice(idx, 1)
    appStore.showSuccess(t('profile.balanceNotify.verifySuccess'))
    const updated = await userAPI.getProfile()
    authStore.user = updated
    emailEntries.value = [...updated.balance_notify_extra_emails]
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    pe.verifying = false
  }
}

const handleRemoveEmail = async (email: string) => {
  try {
    await userAPI.removeNotifyEmail(email)
    appStore.showSuccess(t('profile.balanceNotify.removeSuccess'))
    const updated = await userAPI.getProfile()
    authStore.user = updated
    emailEntries.value = [...updated.balance_notify_extra_emails]
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  }
}

// Verify saved unverified emails
async function sendCodeForSaved(email: string) {
  sendingSavedCode.value = true
  try {
    await userAPI.sendNotifyEmailCode(email)
    verifyingEmail.value = email
    verifyCode.value = ''
    verifyCountdown.value = 60
    if (verifyTimer) clearInterval(verifyTimer)
    verifyTimer = setInterval(() => {
      verifyCountdown.value--
      if (verifyCountdown.value <= 0 && verifyTimer) {
        clearInterval(verifyTimer)
        verifyTimer = null
      }
    }, 1000)
    appStore.showSuccess(t('profile.balanceNotify.codeSent'))
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    sendingSavedCode.value = false
  }
}

async function verifySavedEmail(email: string) {
  if (!verifyCode.value || verifyCode.value.length !== 6) return
  verifyingSaved.value = true
  try {
    await userAPI.verifyNotifyEmail(email, verifyCode.value)
    verifyingEmail.value = ''
    verifyCode.value = ''
    if (verifyTimer) { clearInterval(verifyTimer); verifyTimer = null }
    appStore.showSuccess(t('profile.balanceNotify.verifySuccess'))
    const updated = await userAPI.getProfile()
    authStore.user = updated
    emailEntries.value = [...updated.balance_notify_extra_emails]
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t('common.error')))
  } finally {
    verifyingSaved.value = false
  }
}
</script>
