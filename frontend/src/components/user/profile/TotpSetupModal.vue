<template>
  <UiDialog
    :show="true"
    :title="t('profile.totp.setupTitle')"
    width="narrow"
    :show-close-button="false"
    :close-on-click-outside="true"
    @close="$emit('close')"
  >
    <p class="totp-setup__description">{{ stepDescription }}</p>

        <!-- Step 0: Identity Verification -->
    <div v-if="step === 0" class="totp-setup__step">
          <!-- Loading verification method -->
          <div v-if="methodLoading" class="flex items-center justify-center py-8">
            <UiSpinner size="md" :label="t('common.loading')" />
          </div>

          <template v-else>
            <!-- Email verification -->
            <div v-if="verificationMethod === 'email'">
              <div class="totp-setup__email-row">
                <UiTextField
                  v-model="verifyForm.emailCode"
                  type="text"
                  :maxlength="6"
                  inputmode="numeric"
                  density="compact"
                  class="flex-1"
                  :label="t('profile.totp.emailCode')"
                  :placeholder="t('profile.totp.enterEmailCode')"
                />
                <UiButton
                  type="button"
                  density="compact"
                  :disabled="sendingCode || codeCooldown > 0"
                  @click="handleSendCode"
                >
                  {{ codeCooldown > 0 ? `${codeCooldown}s` : (sendingCode ? t('common.sending') : t('profile.totp.sendCode')) }}
                </UiButton>
              </div>
            </div>

            <!-- Password verification -->
            <div v-else>
              <UiPasswordField
                v-model="verifyForm.password"
                autocomplete="current-password"
                density="compact"
                :label="t('profile.currentPassword')"
                :reveal-label="t('common.showPassword')"
                :hide-label="t('common.hidePassword')"
                :placeholder="t('profile.totp.enterPassword')"
              />
            </div>

            <div class="flex justify-end gap-3 pt-4">
              <UiButton type="button" density="compact" @click="$emit('close')">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                type="button"
                variant="primary"
                density="compact"
                :disabled="!canProceedFromVerify || setupLoading"
                :loading="setupLoading"
                @click="handleVerifyAndSetup"
              >
                {{ t('common.next') }}
              </UiButton>
            </div>
          </template>
        </div>

        <!-- Step 1: Show QR Code -->
    <div v-if="step === 1" class="totp-setup__step">
          <!-- QR Code and Secret -->
          <template v-if="setupData">
            <div class="flex justify-center">
              <div class="rounded-lg border border-gray-200 p-4 bg-white dark:border-dark-600 dark:bg-white">
                <img :src="qrCodeDataUrl" alt="QR Code" class="h-48 w-48" />
              </div>
            </div>

            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {{ t('profile.totp.manualEntry') }}
              </p>
              <div class="flex items-center justify-center gap-2">
                <code class="rounded bg-gray-100 px-3 py-2 font-mono text-sm dark:bg-dark-700">
                  {{ setupData.secret }}
                </code>
                <UiIconButton
                  icon="copy"
                  density="mini"
                  variant="ghost"
                  :label="t('common.copy')"
                  @click="copySecret"
                />
              </div>
            </div>
          </template>

          <div class="flex justify-end gap-3 pt-4">
            <UiButton type="button" density="compact" @click="$emit('close')">
              {{ t('common.cancel') }}
            </UiButton>
            <UiButton
              type="button"
              variant="primary"
              density="compact"
              :disabled="!setupData"
              @click="step = 2"
            >
              {{ t('common.next') }}
            </UiButton>
          </div>
        </div>

        <!-- Step 2: Verify Code -->
    <div v-if="step === 2" class="totp-setup__step">
          <form @submit.prevent="handleVerify">
            <div class="mb-6">
              <label class="ui-field-label text-center block mb-3">
                {{ t('profile.totp.enterCode') }}
              </label>
              <div class="totp-setup__code" role="group" :aria-label="t('profile.totp.enterCode')">
                <input
                  v-for="(_, index) in 6"
                  :key="index"
                  :ref="(el) => setInputRef(el, index)"
                  type="text"
                  maxlength="1"
                  inputmode="numeric"
                  pattern="[0-9]"
                  :autocomplete="index === 0 ? 'one-time-code' : 'off'"
                  :aria-label="`${t('profile.totp.enterCode')} ${index + 1}`"
                  class="totp-setup__digit ui-focus-ring"
                  @input="handleCodeInput($event, index)"
                  @keydown="handleKeydown($event, index)"
                  @paste="handlePaste"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3">
              <UiButton type="button" density="compact" @click="step = 1">
                {{ t('common.back') }}
              </UiButton>
              <UiButton
                type="submit"
                variant="primary"
                density="compact"
                :disabled="verifying || code.join('').length !== 6"
                :loading="verifying"
              >
                {{ t('profile.totp.verify') }}
              </UiButton>
            </div>
          </form>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { totpAPI } from '@/api'
import type { TotpSetupResponse } from '@/types'
import QRCode from 'qrcode'
import { UiButton, UiDialog, UiIconButton, UiPasswordField, UiSpinner, UiTextField } from '@/components/ui'

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const appStore = useAppStore()

// Step: 0 = verify identity, 1 = QR code, 2 = verify TOTP code
const step = ref(0)
const methodLoading = ref(true)
const verificationMethod = ref<'email' | 'password'>('password')
const verifyForm = ref({ emailCode: '', password: '' })
const sendingCode = ref(false)
const codeCooldown = ref(0)
const cooldownTimer = ref<ReturnType<typeof setInterval> | null>(null)

const setupLoading = ref(false)
const setupData = ref<TotpSetupResponse | null>(null)
const verifying = ref(false)
const code = ref<string[]>(['', '', '', '', '', ''])
const inputRefs = ref<(HTMLInputElement | null)[]>([])
const qrCodeDataUrl = ref('')

const stepDescription = computed(() => {
  switch (step.value) {
    case 0:
      return verificationMethod.value === 'email'
        ? t('profile.totp.verifyEmailFirst')
        : t('profile.totp.verifyPasswordFirst')
    case 1:
      return t('profile.totp.setupStep1')
    case 2:
      return t('profile.totp.setupStep2')
    default:
      return ''
  }
})

const canProceedFromVerify = computed(() => {
  if (verificationMethod.value === 'email') {
    return verifyForm.value.emailCode.length === 6
  }
  return verifyForm.value.password.length > 0
})

// Generate QR code as base64 when setupData changes
watch(
  () => setupData.value?.qr_code_url,
  async (url) => {
    if (url) {
      try {
        qrCodeDataUrl.value = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        })
      } catch (err) {
        console.error('Failed to generate QR code:', err)
      }
    }
  },
  { immediate: true }
)

const setInputRef = (el: any, index: number) => {
  inputRefs.value[index] = el as HTMLInputElement | null
}

const handleCodeInput = (event: Event, index: number) => {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/[^0-9]/g, '')
  code.value[index] = value

  if (value && index < 5) {
    nextTick(() => {
      inputRefs.value[index + 1]?.focus()
    })
  }
}

const handleKeydown = (event: KeyboardEvent, index: number) => {
  if (event.key === 'Backspace') {
    const input = event.target as HTMLInputElement
    // If current cell is empty and not the first, move to previous cell
    if (!input.value && index > 0) {
      event.preventDefault()
      inputRefs.value[index - 1]?.focus()
    }
    // Otherwise, let the browser handle the backspace naturally
    // The input event will sync code.value via handleCodeInput
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 6).split('')

  // Update both the ref and the input elements
  digits.forEach((digit, index) => {
    code.value[index] = digit
    if (inputRefs.value[index]) {
      inputRefs.value[index]!.value = digit
    }
  })

  // Clear remaining inputs if pasted less than 6 digits
  for (let i = digits.length; i < 6; i++) {
    code.value[i] = ''
    if (inputRefs.value[i]) {
      inputRefs.value[i]!.value = ''
    }
  }

  const focusIndex = Math.min(digits.length, 5)
  nextTick(() => {
    inputRefs.value[focusIndex]?.focus()
  })
}

const copySecret = async () => {
  if (setupData.value) {
    try {
      await navigator.clipboard.writeText(setupData.value.secret)
      appStore.showSuccess(t('common.copied'))
    } catch {
      appStore.showError(t('common.copyFailed'))
    }
  }
}

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

const handleVerifyAndSetup = async () => {
  setupLoading.value = true

  try {
    const request = verificationMethod.value === 'email'
      ? { email_code: verifyForm.value.emailCode }
      : { password: verifyForm.value.password }

    setupData.value = await totpAPI.initiateSetup(request)
    step.value = 1
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('profile.totp.setupFailed'))
  } finally {
    setupLoading.value = false
  }
}

const handleVerify = async () => {
  const totpCode = code.value.join('')
  if (totpCode.length !== 6 || !setupData.value) return

  verifying.value = true

  try {
    await totpAPI.enable({
      totp_code: totpCode,
      setup_token: setupData.value.setup_token
    })
    appStore.showSuccess(t('profile.totp.enableSuccess'))
    emit('success')
  } catch (err: any) {
    appStore.showError(err.response?.data?.message || t('profile.totp.verifyFailed'))
    code.value = ['', '', '', '', '', '']
    nextTick(() => {
      inputRefs.value[0]?.focus()
    })
  } finally {
    verifying.value = false
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
.totp-setup__description{margin:0 0 20px;text-align:center;font-size:13px;line-height:20px;color:var(--ui-text-muted)}
.totp-setup__step{display:grid;gap:20px}
.totp-setup__email-row{display:flex;align-items:end;gap:8px}
.totp-setup__code{display:flex;justify-content:center;gap:8px}
.totp-setup__digit{width:34px;height:var(--ui-control-default);border:1px solid var(--ui-border);border-radius:var(--ui-radius-control);color:var(--ui-text);background:var(--ui-surface);font-size:16px;font-weight:600;text-align:center;font-variant-numeric:tabular-nums}
.totp-setup__digit:focus{border-color:var(--ui-focus);outline:0}
@media(max-width:420px){.totp-setup__email-row{align-items:stretch;flex-direction:column}.totp-setup__email-row .ui-button{align-self:flex-end}}
@media(max-width:360px){.totp-setup__code{gap:5px}.totp-setup__digit{width:30px}}
</style>
