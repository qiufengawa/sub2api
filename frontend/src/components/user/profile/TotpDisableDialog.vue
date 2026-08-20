<template>
  <UiDialog
    :show="true"
    :title="t('profile.totp.disableTitle')"
    width="narrow"
    :show-close-button="false"
    :close-on-click-outside="true"
    @close="$emit('close')"
  >
    <div class="totp-disable__intro">
      <div class="totp-disable__warning" aria-hidden="true">
        <Icon name="exclamationTriangle" size="md" />
      </div>
      <p>{{ t('profile.totp.disableWarning') }}</p>
    </div>

    <div v-if="methodLoading" class="totp-disable__loading">
      <UiSpinner size="lg" :label="t('common.loading')" />
    </div>

    <form v-else class="totp-disable__form" @submit.prevent="handleDisable">
      <div v-if="verificationMethod === 'email'" class="totp-disable__email-row">
        <UiTextField
          v-model="form.emailCode"
          type="text"
          :maxlength="6"
          inputmode="numeric"
          density="compact"
          class="totp-disable__email-field"
          :label="t('profile.totp.emailCode')"
          :placeholder="t('profile.totp.enterEmailCode')"
        />
        <UiButton
          type="button"
          density="compact"
          class="totp-disable__send"
          :disabled="sendingCode || codeCooldown > 0"
          @click="handleSendCode"
        >
          {{ codeCooldown > 0 ? `${codeCooldown}s` : (sendingCode ? t('common.sending') : t('profile.totp.sendCode')) }}
        </UiButton>
      </div>

      <UiPasswordField
        v-else
        id="password"
        v-model="form.password"
        autocomplete="current-password"
        density="compact"
        :label="t('profile.currentPassword')"
        :reveal-label="t('common.showPassword')"
        :hide-label="t('common.hidePassword')"
        :placeholder="t('profile.totp.enterPassword')"
      />

      <div class="totp-disable__actions">
        <UiButton type="button" density="compact" @click="$emit('close')">
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          type="submit"
          variant="danger"
          density="compact"
          :disabled="!canSubmit"
          :loading="loading"
        >
          {{ loading ? t('common.processing') : t('profile.totp.confirmDisable') }}
        </UiButton>
      </div>
    </form>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { totpAPI } from '@/api'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiDialog, UiPasswordField, UiSpinner, UiTextField } from '@/components/ui'

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const appStore = useAppStore()

const methodLoading = ref(true)
const verificationMethod = ref<'email' | 'password'>('password')
const loading = ref(false)
const sendingCode = ref(false)
const codeCooldown = ref(0)
const cooldownTimer = ref<ReturnType<typeof setInterval> | null>(null)
const form = ref({
  emailCode: '',
  password: ''
})

const canSubmit = computed(() => {
  if (verificationMethod.value === 'email') {
    return form.value.emailCode.length === 6
  }
  return form.value.password.length > 0
})

const loadVerificationMethod = async () => {
  methodLoading.value = true
  try {
    const method = await totpAPI.getVerificationMethod()
    verificationMethod.value = method.method
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('common.error'))
    emit('close')
  } finally {
    methodLoading.value = false
  }
}

const handleSendCode = async () => {
  sendingCode.value = true
  try {
    await totpAPI.sendVerifyCode()
    appStore.showSuccess(t('profile.totp.codeSent'))
    // Start cooldown
    codeCooldown.value = 60
    if (cooldownTimer.value) {
      clearInterval(cooldownTimer.value)
      cooldownTimer.value = null
    }
    cooldownTimer.value = setInterval(() => {
      codeCooldown.value--
      if (codeCooldown.value <= 0) {
        if (cooldownTimer.value) {
          clearInterval(cooldownTimer.value)
          cooldownTimer.value = null
        }
      }
    }, 1000)
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('profile.totp.sendCodeFailed'))
  } finally {
    sendingCode.value = false
  }
}

const handleDisable = async () => {
  if (!canSubmit.value) return

  loading.value = true

  try {
    const request = verificationMethod.value === 'email'
      ? { email_code: form.value.emailCode }
      : { password: form.value.password }

    await totpAPI.disable(request)
    appStore.showSuccess(t('profile.totp.disableSuccess'))
    emit('success')
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('profile.totp.disableFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadVerificationMethod()
})

onUnmounted(() => {
  if (cooldownTimer.value) {
    clearInterval(cooldownTimer.value)
    cooldownTimer.value = null
  }
})
</script>

<style scoped>
.totp-disable__intro{display:grid;justify-items:center;gap:10px;margin-bottom:20px;text-align:center;color:var(--ui-text-muted)}
.totp-disable__intro p{margin:0;font-size:13px;line-height:20px}
.totp-disable__warning{display:grid;width:40px;height:40px;place-items:center;border-radius:50%;color:var(--ui-danger);background:color-mix(in srgb,var(--ui-danger) 10%,transparent)}
.totp-disable__loading{display:flex;justify-content:center;padding:28px 0}
.totp-disable__form{display:grid;gap:16px}
.totp-disable__email-row{display:flex;align-items:end;gap:8px}
.totp-disable__email-field{min-width:0;flex:1}
.totp-disable__send{white-space:nowrap}
.totp-disable__actions{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
@media(max-width:420px){.totp-disable__email-row{align-items:stretch;flex-direction:column}.totp-disable__send{align-self:flex-end}}
</style>
