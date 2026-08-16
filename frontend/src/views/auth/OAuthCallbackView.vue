<template>
  <AuthFormPanel
      v-if="isProcessing"
      :title="t('auth.oauth.callbackTitle')"
      :subtitle="t('auth.oauth.callbackHint')"
    >
      <div class="oauth-callback__processing" role="status" aria-live="polite">
        <UiSpinner size="lg" />
      </div>
    </AuthFormPanel>

    <AuthFormPanel
      v-else-if="needsRegistrationCompletion"
      :title="t('auth.oidc.callbackTitle', { providerName })"
      :subtitle="registrationHint"
    >
      <form class="oauth-callback__form" @submit.prevent="handleSubmitRegistration">
        <AuthTextField id="oauth-registration-email" :model-value="registrationEmail" icon="mail" type="email" :label="t('auth.emailLabel')" readonly disabled />
        <AuthTextField id="oauth-registration-password" v-model="password" icon="lock" type="password" revealable :label="t('auth.passwordLabel')" :help-text="t('auth.passwordHint')" :placeholder="t('auth.createPasswordPlaceholder')" :disabled="isSubmitting" autocomplete="new-password" />
        <AuthTextField id="oauth-registration-password-confirm" v-model="confirmPassword" icon="lock" type="password" revealable :label="t('auth.confirmPassword')" :placeholder="t('auth.confirmPasswordPlaceholder')" :disabled="isSubmitting" autocomplete="new-password" />
        <AuthTextField v-if="invitationRequired" id="oauth-registration-invitation" v-model="invitationCode" icon="gift" type="text" :label="t('auth.invitationCodeLabel')" :placeholder="t('auth.invitationCodePlaceholder')" :disabled="isSubmitting" />
        <UiAlert v-if="registrationError" tone="danger" :message="registrationError" />
        <UiButton data-testid="oauth-registration-submit" type="button" variant="primary" density="compact" block :loading="isSubmitting" :disabled="isSubmitting || !canSubmitRegistration" @click="handleSubmitRegistration">
          {{ isSubmitting ? t('common.processing') : t('auth.oidc.completeRegistration') }}
        </UiButton>
      </form>
    </AuthFormPanel>

    <AuthFormPanel
      v-else-if="invalidCallback"
      :title="t('auth.oauth.invalidCallbackTitle')"
      :subtitle="t('auth.oauth.invalidCallbackHint')"
    >
      <UiAlert tone="warning" :message="t('auth.oauth.invalidCallbackHint')" />
      <UiButton class="oauth-callback__return" variant="primary" density="compact" block @click="router.replace('/login')">
        {{ t('auth.backToLogin') }}
      </UiButton>
    </AuthFormPanel>

    <AuthFormPanel v-else :title="t('auth.oauth.callbackTitle')" :subtitle="t('auth.oauth.callbackHint')">
      <div class="oauth-callback__values">
        <div class="oauth-callback__value">
          <AuthTextField id="oauth-callback-code" :model-value="code" icon="key" :label="t('auth.oauth.code')" readonly monospace />
          <UiButton density="compact" :disabled="!code" @click="copy(code)">{{ t('common.copy') }}</UiButton>
        </div>
        <div class="oauth-callback__value">
          <AuthTextField id="oauth-callback-state" :model-value="state" icon="key" :label="t('auth.oauth.state')" readonly monospace />
          <UiButton density="compact" :disabled="!state" @click="copy(state)">{{ t('common.copy') }}</UiButton>
        </div>
        <div class="oauth-callback__value">
          <AuthTextField id="oauth-callback-url" :model-value="fullUrl" icon="link" :label="t('auth.oauth.fullUrl')" readonly monospace />
          <UiButton density="compact" :disabled="!fullUrl" @click="copy(fullUrl)">{{ t('common.copy') }}</UiButton>
        </div>
      </div>
  </AuthFormPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AuthFormPanel from '@/components/auth/AuthFormPanel.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import { UiAlert, UiButton, UiSpinner } from '@/components/ui'
import { useClipboard } from '@/composables/useClipboard'
import { useAppStore, useAuthStore } from '@/stores'
import { apiClient } from '@/api/client'
import { buildApiUrl } from '@/api/url'
import {
  exchangePendingOAuthCompletion,
  persistOAuthTokenContext,
  type OAuthTokenResponse
} from '@/api/auth'
import {
  clearAllAffiliateReferralCodes,
  loadOAuthAffiliateCode,
  oauthAffiliatePayload
} from '@/utils/oauthAffiliate'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { copyToClipboard } = useClipboard()
const appStore = useAppStore()
const authStore = useAuthStore()
const isProcessing = ref(false)
const isSubmitting = ref(false)
const needsRegistrationCompletion = ref(false)
const invitationRequired = ref(false)
const registrationEmail = ref('')
const password = ref('')
const confirmPassword = ref('')
const invitationCode = ref('')
const registrationError = ref('')
const pendingProvider = ref<'github' | 'google'>('github')
const redirectTo = ref('/dashboard')
const invalidCallback = ref(false)
const EMAIL_OAUTH_PENDING_PROVIDER_KEY = 'email_oauth_pending_provider'

type EmailOAuthPendingCompletion = Partial<OAuthTokenResponse> & {
  error?: string
  provider?: string
  redirect?: string
  email?: string
  resolved_email?: string
  invitation_required?: boolean
}

const code = computed(() => (route.query.code as string) || '')
const state = computed(() => (route.query.state as string) || '')
const error = computed(
  () => (route.query.error as string) || (route.query.error_description as string) || ''
)

const fullUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return window.location.href
})
const providerName = computed(() =>
  pendingProvider.value === 'google' ? 'Google' : 'GitHub'
)
const registrationHint = computed(() =>
  invitationRequired.value
    ? t('auth.oidc.invitationRequired', { providerName: providerName.value })
    : t('auth.oidc.completeRegistration')
)
const canSubmitRegistration = computed(() => {
  if (!registrationEmail.value.trim()) return false
  if (password.value.length < 6) return false
  if (password.value !== confirmPassword.value) return false
  if (invitationRequired.value && !invitationCode.value.trim()) return false
  return true
})

function parseFragmentParams(): URLSearchParams {
  const raw = typeof window !== 'undefined' ? window.location.hash : ''
  const hash = raw.startsWith('#') ? raw.slice(1) : raw
  return new URLSearchParams(hash)
}

function readTokenResponse(params: URLSearchParams): OAuthTokenResponse | null {
  const accessToken = params.get('access_token')?.trim() || ''
  if (!accessToken) return null

  const response: OAuthTokenResponse = { access_token: accessToken }
  const refreshToken = params.get('refresh_token')?.trim() || ''
  if (refreshToken) response.refresh_token = refreshToken
  const expiresIn = Number.parseInt(params.get('expires_in')?.trim() || '', 10)
  if (Number.isFinite(expiresIn) && expiresIn > 0) response.expires_in = expiresIn
  const tokenType = params.get('token_type')?.trim() || ''
  if (tokenType) response.token_type = tokenType
  return response
}

function sanitizeRedirectPath(path: string | null | undefined): string {
  if (!path) return '/dashboard'
  if (!path.startsWith('/')) return '/dashboard'
  if (path.startsWith('//')) return '/dashboard'
  if (path.includes('://')) return '/dashboard'
  if (path.includes('\n') || path.includes('\r')) return '/dashboard'
  return path
}

function readPendingEmailOAuthProvider(): 'github' | 'google' | null {
  if (typeof window === 'undefined') return null
  const provider = window.sessionStorage.getItem(EMAIL_OAUTH_PENDING_PROVIDER_KEY)
  if (provider === 'github' || provider === 'google') return provider
  return null
}

function redirectProviderCallbackToBackend(provider: 'github' | 'google'): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null) params.append(key, String(item))
      })
    } else if (value != null) {
      params.set(key, String(value))
    }
  }
  const suffix = params.toString() ? `?${params.toString()}` : ''
  window.location.href = buildApiUrl(`/auth/oauth/${provider}/callback${suffix}`)
}

async function finalizeTokenResponse(tokenResponse: OAuthTokenResponse, redirect: string) {
  persistOAuthTokenContext(tokenResponse)
  await authStore.setToken(tokenResponse.access_token)
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(EMAIL_OAUTH_PENDING_PROVIDER_KEY)
  }
  clearAllAffiliateReferralCodes()
  appStore.showSuccess(t('auth.loginSuccess'))
  await router.replace(sanitizeRedirectPath(redirect))
}

function hasOAuthTokenResponse(value: Partial<OAuthTokenResponse>): value is OAuthTokenResponse {
  return typeof value.access_token === 'string' && value.access_token.trim() !== ''
}

async function resumePendingEmailOAuth() {
  isProcessing.value = true
  try {
    const completion = await exchangePendingOAuthCompletion() as EmailOAuthPendingCompletion
    const completionRedirect = completion.redirect || '/dashboard'
    if (hasOAuthTokenResponse(completion)) {
      await finalizeTokenResponse(completion, completionRedirect)
      return
    }

    const provider = String(completion.provider || '').toLowerCase()
    if (provider === 'github' || provider === 'google') {
      pendingProvider.value = provider
    }
    redirectTo.value = sanitizeRedirectPath(completionRedirect)

    if (completion.error === 'invitation_required' || completion.error === 'registration_completion_required') {
      invitationRequired.value = completion.error === 'invitation_required' || completion.invitation_required === true
      registrationEmail.value = String(completion.resolved_email || completion.email || '').trim()
      needsRegistrationCompletion.value = true
      isProcessing.value = false
      return
    }

    appStore.showError(completion.error || t('auth.loginFailed'))
  } catch (e: unknown) {
    const err = e as { message?: string; response?: { data?: { message?: string } } }
    const message = err.response?.data?.message || err.message || t('auth.loginFailed')
    appStore.showError(message)
    invalidCallback.value = true
  } finally {
    if (!needsRegistrationCompletion.value) {
      isProcessing.value = false
    }
  }
}

async function handleSubmitRegistration() {
  registrationError.value = ''
  if (!registrationEmail.value.trim()) {
    registrationError.value = t('auth.emailRequired')
    return
  }
  if (password.value.length < 6) {
    registrationError.value = t('auth.passwordMinLength')
    return
  }
  if (password.value !== confirmPassword.value) {
    registrationError.value = t('auth.passwordsDoNotMatch')
    return
  }
  const code = invitationCode.value.trim()
  if (invitationRequired.value && !code) return

  isSubmitting.value = true
  try {
    const payload: { password: string; invitation_code?: string; aff_code?: string } = {
      password: password.value,
      ...oauthAffiliatePayload(loadOAuthAffiliateCode())
    }
    if (invitationRequired.value) {
      payload.invitation_code = code
    }
    const { data } = await apiClient.post<OAuthTokenResponse>(
      `/auth/oauth/${pendingProvider.value}/complete-registration`,
      payload
    )
    await finalizeTokenResponse(data, redirectTo.value)
  } catch (e: unknown) {
    const err = e as { message?: string; response?: { data?: { message?: string } } }
    registrationError.value =
      err.response?.data?.message || err.message || t('auth.oidc.completeRegistrationFailed')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  const params = parseFragmentParams()
  const tokenResponse = readTokenResponse(params)
  const fragmentError = params.get('error') || ''
  const fragmentErrorDescription =
    params.get('error_description') || params.get('error_message') || ''

  if (fragmentError) {
    appStore.showError(fragmentErrorDescription || fragmentError)
    return
  }
  if (!tokenResponse) {
    if (route.path === '/auth/oauth/callback') {
      const pendingEmailOAuthProvider = readPendingEmailOAuthProvider()
      if (pendingEmailOAuthProvider && code.value && state.value) {
        redirectProviderCallbackToBackend(pendingEmailOAuthProvider)
        return
      }
      await resumePendingEmailOAuth()
    }
    return
  }

  isProcessing.value = true
  try {
    await finalizeTokenResponse(tokenResponse, params.get('redirect') || '/dashboard')
  } catch (error: unknown) {
    const message = (error as { message?: string })?.message || t('auth.loginFailed')
    appStore.showError(message)
    isProcessing.value = false
  }
})

watch(
  error,
  (message) => {
    if (message) {
      appStore.showError(message)
    }
  },
  { immediate: true }
)

const copy = (value: string) => {
  if (!value) return
  copyToClipboard(value)
}
</script>

<style scoped>
.oauth-callback__processing { display: grid; min-height: 120px; place-items: center; }
.oauth-callback__form,.oauth-callback__values { display: grid; gap: 14px; }
.oauth-callback__return { margin-top: 14px; }
.oauth-callback__value { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 8px; }
@media (max-width: 520px) { .oauth-callback__value { grid-template-columns: 1fr; } }
</style>
