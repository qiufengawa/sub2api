<template>
  <form class="pending-oauth-form" @submit.prevent="handleSubmit">
    <AuthTextField
      :id="`${testIdPrefix}-create-account-email`"
      v-model="email"
      :test-id="`${testIdPrefix}-create-account-email`"
      :label="t('auth.emailLabel')"
      icon="mail"
      type="email"
      :placeholder="t('auth.emailPlaceholder')"
      :disabled="isSubmitting || isSendingCode"
    />
    <AuthTextField
      :id="`${testIdPrefix}-create-account-password`"
      v-model="password"
      :test-id="`${testIdPrefix}-create-account-password`"
      :label="t('auth.passwordLabel')"
      icon="lock"
      type="password"
      revealable
      autocomplete="new-password"
      :help-text="t('auth.passwordHint')"
      :placeholder="t('auth.passwordPlaceholder')"
      :disabled="isSubmitting"
    />
    <div v-if="captchaEnabled" class="pending-oauth-form__captcha">
      <TurnstileWidget
        ref="turnstileRef"
        :site-key="turnstileSiteKey"
        :turnstile-enabled="turnstileEnabled"
        :turnstile-site-key="turnstileSiteKey"
        :tencent-enabled="tencentCaptchaEnabled"
        :tencent-app-id="tencentCaptchaAppId"
        :tencent-region="tencentCaptchaRegion"
        :aliyun-enabled="aliyunCaptchaEnabled"
        :aliyun-scene-id="aliyunCaptchaSceneId"
        :aliyun-prefix="aliyunCaptchaPrefix"
        :aliyun-region="aliyunCaptchaRegion"
        @verify="onTurnstileVerify"
        @expire="onTurnstileExpire"
        @error="onTurnstileError"
      />
    </div>
    <div v-if="emailVerifyEnabled" class="pending-oauth-form__verification">
      <AuthTextField
        :id="`${testIdPrefix}-create-account-verify-code`"
        v-model="verifyCode"
        :test-id="`${testIdPrefix}-create-account-verify-code`"
        :label="t('auth.verificationCode')"
        icon="key"
        type="text"
        inputmode="numeric"
        :maxlength="6"
        autocomplete="one-time-code"
        monospace
        text-align="center"
        placeholder="123456"
        :disabled="isSubmitting"
      />
      <UiButton
        :data-testid="`${testIdPrefix}-create-account-send-code`"
        type="button"
        variant="secondary"
        density="compact"
        :disabled="isSubmitting || isSendingCode || countdown > 0 || !email.trim() || (turnstileEnabled && !turnstileToken)"
        :loading="isSendingCode"
        @click="handleSendCode"
      >
        {{
          isSendingCode
            ? t('auth.sendingCode')
            : countdown > 0
              ? t('auth.resendCountdown', { countdown })
              : t('auth.sendCode')
        }}
      </UiButton>
    </div>
    <p v-if="emailVerifyEnabled && sendCodeSuccess" class="pending-oauth-form__status pending-oauth-form__status--success">
      {{ t('auth.codeSentSuccess') }}
    </p>
    <p v-else-if="emailVerifyEnabled" class="pending-oauth-form__status">
      {{ t('auth.verificationCodeHint') }}
    </p>
    <AuthTextField
      v-if="invitationCodeEnabled"
      :id="`${testIdPrefix}-create-account-invitation-code`"
      v-model="invitationCode"
      :test-id="`${testIdPrefix}-create-account-invitation-code`"
      :label="t('auth.invitationCodeLabel')"
      icon="gift"
      type="text"
      :placeholder="t('auth.invitationCodePlaceholder')"
      :disabled="isSubmitting"
    />
    <UiButton
      :data-testid="`${testIdPrefix}-create-account-submit`"
      type="button"
      variant="primary"
      density="compact"
      block
      :disabled="isSubmitting || !email.trim() || password.length < 6 || (invitationCodeEnabled && !invitationCode.trim()) || (turnstileEnabled && !turnstileToken)"
      :loading="isSubmitting"
      @click="handleSubmit"
    >
      {{ isSubmitting ? t('common.processing') : t('auth.createAccount') }}
    </UiButton>
    <UiButton
      type="button"
      variant="secondary"
      density="compact"
      block
      :disabled="isSubmitting"
      @click="emitSwitchToBind"
    >
      {{ t('auth.alreadyHaveAccount') }}
    </UiButton>
  </form>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import TurnstileWidget from '@/components/CaptchaChallenge.vue'
import { UiButton } from '@/components/ui'
import { getPublicSettings, sendPendingOAuthVerifyCode } from '@/api/auth'
import { useAppStore } from '@/stores'

export type PendingOAuthCreateAccountPayload = {
  email: string
  password: string
  verifyCode: string
  turnstileToken?: string
  tencentCaptchaTicket?: string
  tencentCaptchaRandstr?: string
  invitationCode?: string
}

const props = defineProps<{
  initialEmail: string
  testIdPrefix: string
  isSubmitting: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  submit: [payload: PendingOAuthCreateAccountPayload]
  switchToBind: [email: string]
}>()

const { t } = useI18n()
const appStore = useAppStore()

const email = ref('')
const password = ref('')
const verifyCode = ref('')
const invitationCode = ref('')
const isSendingCode = ref(false)
const sendCodeError = ref('')
const sendCodeSuccess = ref(false)
const countdown = ref(0)
const invitationCodeEnabled = ref(false)
const emailVerifyEnabled = ref(true)
const turnstileEnabled = ref(false)
const turnstileSiteKey = ref('')
const tencentCaptchaEnabled = ref(false)
const tencentCaptchaAppId = ref('')
const tencentCaptchaRegion = ref('cn')
const aliyunCaptchaEnabled = ref(false)
const aliyunCaptchaSceneId = ref('')
const aliyunCaptchaPrefix = ref('')
const aliyunCaptchaRegion = ref('cn')
const turnstileToken = ref('')
const tencentCaptchaRandstr = ref('')
const turnstileRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const aliyunCaptchaReady = computed(
  () =>
    aliyunCaptchaEnabled.value &&
    Boolean(aliyunCaptchaSceneId.value) &&
    Boolean(aliyunCaptchaPrefix.value)
)
// 动作触发式验证码（腾讯/阿里云）：发送验证码、提交时弹窗验证
const actionCaptchaEnabled = computed(
  () =>
    (tencentCaptchaEnabled.value && Boolean(tencentCaptchaAppId.value)) ||
    aliyunCaptchaReady.value
)
const captchaEnabled = computed(
  () =>
    (turnstileEnabled.value && Boolean(turnstileSiteKey.value)) || actionCaptchaEnabled.value
)

let countdownTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.initialEmail,
  value => {
    email.value = value || ''
  },
  { immediate: true }
)

watch(sendCodeError, value => {
  if (value) {
    appStore.showError(value)
  }
})

watch(
  () => props.errorMessage,
  value => {
    if (value) {
      appStore.showError(value)
      if (captchaEnabled.value) {
        resetTurnstile()
      }
    }
  }
)

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown(seconds: number) {
  clearCountdown()
  countdown.value = Math.max(0, seconds)

  if (countdown.value <= 0) {
    return
  }

  countdownTimer = setInterval(() => {
    if (countdown.value <= 1) {
      countdown.value = 0
      clearCountdown()
      return
    }

    countdown.value -= 1
  }, 1000)
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  const err = error as { message?: string; response?: { data?: { detail?: string; message?: string } } }
  return err.response?.data?.detail || err.response?.data?.message || err.message || fallback
}

function resetTurnstile() {
  turnstileToken.value = ''
  tencentCaptchaRandstr.value = ''
  turnstileRef.value?.reset()
}

function onTurnstileVerify(token: string, randstr = '') {
  turnstileToken.value = token
  tencentCaptchaRandstr.value = randstr
  sendCodeError.value = ''
}

function onTurnstileExpire() {
  turnstileToken.value = ''
  tencentCaptchaRandstr.value = ''
  sendCodeError.value = t('auth.turnstileExpired')
}

function onTurnstileError() {
  turnstileToken.value = ''
  tencentCaptchaRandstr.value = ''
  sendCodeError.value = t('auth.turnstileFailed')
}

async function acquireActionProof(): Promise<boolean> {
  if (!actionCaptchaEnabled.value) return true

  const proof = await turnstileRef.value?.verifyAction()
  if (!proof) return false

  turnstileToken.value = proof.token
  tencentCaptchaRandstr.value = proof.randstr
  return true
}

async function handleSendCode() {
  const trimmedEmail = email.value.trim()
  if (!trimmedEmail) {
    return
  }

  if (turnstileEnabled.value && !turnstileToken.value) {
    sendCodeError.value = t('auth.completeVerification')
    return
  }

  if (!(await acquireActionProof())) {
    return
  }

  isSendingCode.value = true
  sendCodeError.value = ''
  sendCodeSuccess.value = false

  try {
    const response = await sendPendingOAuthVerifyCode({
      email: trimmedEmail,
      turnstile_token:
        turnstileEnabled.value || aliyunCaptchaEnabled.value ? turnstileToken.value : undefined,
      tencent_captcha_ticket: tencentCaptchaEnabled.value ? turnstileToken.value : undefined,
      tencent_captcha_randstr: tencentCaptchaEnabled.value ? tencentCaptchaRandstr.value : undefined
    })
    sendCodeSuccess.value = true
    startCountdown(response.countdown)
  } catch (error: unknown) {
    sendCodeError.value = getRequestErrorMessage(error, t('auth.sendCodeFailed'))
  } finally {
    if (captchaEnabled.value) {
      resetTurnstile()
    }
    isSendingCode.value = false
  }
}

async function handleSubmit() {
  const trimmedEmail = email.value.trim()
  if (!trimmedEmail || password.value.length < 6) {
    return
  }

  // Turnstile 票据一次性：发送验证码已消耗上一枚，reset 后要等新票据回调。
  // 缺票时不能提交——create-account 端点会校验验证码，空 token 直接被判失败。
  // 表单的隐式提交（输入框回车）绕得过按钮的 disabled，所以这里必须再挡一次。
  if (turnstileEnabled.value && !turnstileToken.value) {
    sendCodeError.value = t('auth.completeVerification')
    return
  }

  if (!(await acquireActionProof())) {
    return
  }

  emit('submit', {
    email: trimmedEmail,
    password: password.value,
    verifyCode: emailVerifyEnabled.value ? verifyCode.value.trim() : '',
    ...((turnstileEnabled.value || aliyunCaptchaEnabled.value) && turnstileToken.value
      ? { turnstileToken: turnstileToken.value }
      : {}),
    ...(tencentCaptchaEnabled.value && turnstileToken.value
      ? {
          tencentCaptchaTicket: turnstileToken.value,
          tencentCaptchaRandstr: tencentCaptchaRandstr.value
        }
      : {}),
    invitationCode: invitationCode.value.trim() || undefined
  })

  if (actionCaptchaEnabled.value) {
    resetTurnstile()
  }
}

function emitSwitchToBind() {
  emit('switchToBind', email.value.trim())
}

onMounted(async () => {
  try {
    const settings = await getPublicSettings()
    invitationCodeEnabled.value = settings.invitation_code_enabled === true
    emailVerifyEnabled.value = settings.email_verify_enabled !== false
    turnstileEnabled.value = settings.turnstile_enabled === true
    turnstileSiteKey.value = settings.turnstile_site_key || ''
    tencentCaptchaEnabled.value = settings.tencent_captcha_enabled === true
    tencentCaptchaAppId.value = settings.tencent_captcha_app_id || ''
    tencentCaptchaRegion.value = settings.tencent_captcha_region || 'cn'
    aliyunCaptchaEnabled.value = settings.aliyun_captcha_enabled === true
    aliyunCaptchaSceneId.value = settings.aliyun_captcha_scene_id || ''
    aliyunCaptchaPrefix.value = settings.aliyun_captcha_prefix || ''
    aliyunCaptchaRegion.value = settings.aliyun_captcha_region || 'cn'
  } catch {
    invitationCodeEnabled.value = false
    emailVerifyEnabled.value = true
    turnstileEnabled.value = false
    turnstileSiteKey.value = ''
    tencentCaptchaEnabled.value = false
    tencentCaptchaAppId.value = ''
    tencentCaptchaRegion.value = 'cn'
    aliyunCaptchaEnabled.value = false
    aliyunCaptchaSceneId.value = ''
    aliyunCaptchaPrefix.value = ''
    aliyunCaptchaRegion.value = 'cn'
  }
})

onUnmounted(() => {
  clearCountdown()
})
</script>

<style scoped>
.pending-oauth-form { display: grid; gap: 12px; }
.pending-oauth-form__captcha { display: grid; gap: 8px; }
.pending-oauth-form__verification { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.pending-oauth-form__status { margin: -4px 0 0; color: var(--ui-text-soft); font-size: 11px; line-height: 18px; }
.pending-oauth-form__status--success { color: var(--ui-success); }
@media (max-width: 420px) {
  .pending-oauth-form__verification { grid-template-columns: 1fr; }
}
</style>
