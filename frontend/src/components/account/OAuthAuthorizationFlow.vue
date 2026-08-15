<template>
  <section class="oauth-flow">
    <header class="oauth-flow__header">
      <Icon name="link" size="sm" />
      <h4>{{ oauthTitle }}</h4>
    </header>

    <UiRadioGroup
      v-if="showMethodSelection"
      :model-value="inputMethod"
      :options="methodOptions"
      name="oauth-input-method"
      :label="methodLabel"
      layout="grid"
      @update:model-value="setInputMethod"
    />

    <AppStack v-if="activeCredentialConfig" class="oauth-flow__credentials" :gap="12">
      <p class="oauth-flow__description">{{ activeCredentialConfig.description }}</p>
      <UiTextArea
        v-model="activeCredentialValue"
        :rows="activeCredentialConfig.rows"
        :description="activeCredentialConfig.hint"
        :placeholder="activeCredentialConfig.placeholder"
        autocomplete="off"
        spellcheck="false"
        data-1p-ignore
        data-lpignore="true"
        data-bwignore="true"
        monospace
      >
        <template #label>
          <span class="oauth-flow__field-label">
            {{ activeCredentialConfig.label }}
            <UiBadge
              v-if="activeCredentialConfig.count > 1"
              :label="t('admin.accounts.oauth.keysCount', { count: activeCredentialConfig.count })"
              tone="info"
            />
          </span>
        </template>
      </UiTextArea>

      <UiButton
        v-if="inputMethod === 'cookie' && showHelp"
        density="dense"
        variant="quiet"
        @click="showHelpDialog = !showHelpDialog"
      >
        <template #icon><Icon name="questionCircle" size="xs" /></template>
        {{ t('admin.accounts.oauth.howToGetSessionKey') }}
      </UiButton>

      <UiAlert v-if="showHelpDialog && showHelp && inputMethod === 'cookie'" tone="warning">
        <strong>{{ t('admin.accounts.oauth.howToGetSessionKey') }}</strong>
        <ol class="oauth-flow__help-list">
          <li v-for="step in 6" :key="step">{{ t(`admin.accounts.oauth.step${step}`) }}</li>
        </ol>
        <span>{{ t('admin.accounts.oauth.sessionKeyFormat') }}</span>
      </UiAlert>

      <UiAlert v-if="error" tone="danger"><span class="oauth-flow__error">{{ error }}</span></UiAlert>

      <UiButton
        variant="primary"
        density="compact"
        block
        :loading="loading"
        :disabled="loading || !activeCredentialValue.trim()"
        @click="submitActiveCredential"
      >
        <template #icon><Icon v-if="!loading" name="sparkles" size="sm" /></template>
        {{ loading ? activeCredentialConfig.loadingText : activeCredentialConfig.submitText }}
      </UiButton>
    </AppStack>

    <AppStack v-if="inputMethod === 'manual'" class="oauth-flow__manual" :gap="16">
      <p class="oauth-flow__description">{{ oauthFollowSteps }}</p>
      <UiSteps :steps="manualSteps" :current="manualStepCurrent" :aria-label="oauthFollowSteps" />

      <section class="oauth-flow__step">
        <h5>{{ oauthStep1GenerateUrl }}</h5>
        <AppStack :gap="10">
          <div v-if="showProjectId && platform === 'gemini'">
            <UiTextField
              v-model="projectId"
              :label="t('admin.accounts.oauth.gemini.projectIdLabel')"
              :description="t('admin.accounts.oauth.gemini.projectIdHint')"
              :placeholder="t('admin.accounts.oauth.gemini.projectIdPlaceholder')"
              monospace
            />
            <UiLink href="https://console.cloud.google.com/" external>
              {{ t('admin.accounts.oauth.gemini.howToGetProjectId') }}
            </UiLink>
          </div>

          <UiButton v-if="!authUrl" variant="primary" density="compact" :loading="loading" @click="handleGenerateUrl">
            <template #icon><Icon v-if="!loading" name="link" size="sm" /></template>
            {{ loading ? t('admin.accounts.oauth.generating') : oauthGenerateAuthUrl }}
          </UiButton>
          <AppStack v-else :gap="6">
            <AppInline :gap="6" :wrap="false">
              <UiTextField :model-value="authUrl" readonly monospace />
              <UiIconButton
                :label="copied ? t('common.copied') : t('common.copy')"
                :icon="copied ? 'check' : 'copy'"
                :variant="copied ? 'success' : 'outlined'"
                @click="handleCopyUrl"
              />
            </AppInline>
            <UiButton variant="quiet" density="dense" @click="handleRegenerate">
              <template #icon><Icon name="refresh" size="xs" /></template>
              {{ t('admin.accounts.oauth.regenerate') }}
            </UiButton>
          </AppStack>
        </AppStack>
      </section>

      <section class="oauth-flow__step">
        <h5>{{ oauthStep2OpenUrl }}</h5>
        <p>{{ oauthOpenUrlDesc }}</p>
        <UiAlert v-if="showLocalCallbackNotice" tone="warning">{{ oauthImportantNotice }}</UiAlert>
        <UiAlert v-else-if="showProxyWarning" tone="warning">{{ t('admin.accounts.oauth.proxyWarning') }}</UiAlert>
      </section>

      <section class="oauth-flow__step">
        <h5>{{ oauthStep3EnterCode }}</h5>
        <p>{{ oauthAuthCodeDesc }}</p>
        <UiTextArea
          v-model="authCodeInput"
          :label="oauthAuthCode"
          :description="oauthAuthCodeHint"
          :placeholder="oauthAuthCodePlaceholder"
          :rows="3"
          monospace
        />
        <UiAlert
          v-if="platform === 'gemini'"
          tone="warning"
          :title="t('admin.accounts.oauth.gemini.stateWarningTitle')"
        >
          {{ t('admin.accounts.oauth.gemini.stateWarningDesc') }}
        </UiAlert>
        <UiAlert v-if="error" tone="danger"><span class="oauth-flow__error">{{ error }}</span></UiAlert>
      </section>
    </AppStack>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@/composables/useClipboard'
import Icon from '@/components/icons/Icon.vue'
import type { AddMethod, AuthInputMethod } from '@/composables/useAccountOAuth'
import type { AccountPlatform } from '@/types'
import { adminAPI } from '@/api/admin'
import {
  AppInline,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiIconButton,
  UiLink,
  UiRadioGroup,
  UiSteps,
  UiTextArea,
  UiTextField
} from '@/components/ui'
import type { UiChoiceOption } from '@/components/ui'

interface CredentialConfig {
  label: string
  description: string
  placeholder: string
  hint: string
  rows: number
  count: number
  loadingText: string
  submitText: string
}

interface Props {
  addMethod: AddMethod
  authUrl?: string
  sessionId?: string
  loading?: boolean
  error?: string
  showHelp?: boolean
  showProxyWarning?: boolean
  allowMultiple?: boolean
  methodLabel?: string
  showCookieOption?: boolean // Whether to show cookie auto-auth option
  showRefreshTokenOption?: boolean // Whether to show refresh token input option (OpenAI only)
  showMobileRefreshTokenOption?: boolean // Whether to show mobile refresh token option (OpenAI only)
  showSessionTokenOption?: boolean
  showAccessTokenOption?: boolean
  showCodexSessionImportOption?: boolean
  showAgentIdentityOption?: boolean
  showCodexPatOption?: boolean
  showSsoOption?: boolean
  /** Grok email----password login (admin; password never persisted). */
  showEmailPasswordOption?: boolean
  showManualOption?: boolean
  initialInputMethod?: AuthInputMethod
  /**
   * Prefill for Grok email----password reauth. Password is never stored;
   * pass only the email (or "email----") so the operator types the password.
   */
  initialEmailPassword?: string
  platform?: AccountPlatform // Platform type for different UI/text
  showProjectId?: boolean // New prop to control project ID visibility
}

const props = withDefaults(defineProps<Props>(), {
  authUrl: '',
  sessionId: '',
  loading: false,
  error: '',
  showHelp: true,
  showProxyWarning: true,
  allowMultiple: false,
  methodLabel: 'Authorization Method',
  showCookieOption: true,
  showRefreshTokenOption: false,
  showMobileRefreshTokenOption: false,
  showSessionTokenOption: false,
  showAccessTokenOption: false,
  showCodexSessionImportOption: false,
  showAgentIdentityOption: false,
  showCodexPatOption: false,
  showSsoOption: false,
  showEmailPasswordOption: false,
  showManualOption: true,
  initialInputMethod: 'manual',
  initialEmailPassword: '',
  platform: 'anthropic',
  showProjectId: true
})

const emit = defineEmits<{
  'generate-url': []
  'exchange-code': [code: string]
  'cookie-auth': [sessionKey: string]
  'validate-refresh-token': [refreshToken: string]
  'validate-mobile-refresh-token': [refreshToken: string]
  'validate-session-token': [sessionToken: string]
  'import-access-token': [accessToken: string]
  'import-codex-session': [content: string]
  'import-codex-pat': [accessToken: string]
  'import-sso': [content: string]
  'authorize-password': [emailPasswordInput: string]
  'update:inputMethod': [method: AuthInputMethod]
}>()

const { t } = useI18n()
const passwordAuthEnabled = ref(false)
const emailPasswordOptionEnabled = computed(
  () => props.showEmailPasswordOption && props.platform === 'grok' && passwordAuthEnabled.value
)

const showLocalCallbackNotice = computed(() => props.platform === 'openai' || props.platform === 'grok')

// Get translation key based on platform
const getOAuthKey = (key: string) => {
  if (props.platform === 'openai') return `admin.accounts.oauth.openai.${key}`
  if (props.platform === 'gemini') return `admin.accounts.oauth.gemini.${key}`
  if (props.platform === 'antigravity') return `admin.accounts.oauth.antigravity.${key}`
  if (props.platform === 'grok') return `admin.accounts.oauth.grok.${key}`
  return `admin.accounts.oauth.${key}`
}

// Computed translations for current platform
const oauthTitle = computed(() => t(getOAuthKey('title')))
const oauthFollowSteps = computed(() => t(getOAuthKey('followSteps')))
const oauthStep1GenerateUrl = computed(() => t(getOAuthKey('step1GenerateUrl')))
const oauthGenerateAuthUrl = computed(() => t(getOAuthKey('generateAuthUrl')))
const oauthStep2OpenUrl = computed(() => t(getOAuthKey('step2OpenUrl')))
const oauthOpenUrlDesc = computed(() => t(getOAuthKey('openUrlDesc')))
const oauthStep3EnterCode = computed(() => t(getOAuthKey('step3EnterCode')))
const oauthAuthCodeDesc = computed(() => t(getOAuthKey('authCodeDesc')))
const oauthAuthCode = computed(() => t(getOAuthKey('authCode')))
const oauthAuthCodePlaceholder = computed(() => t(getOAuthKey('authCodePlaceholder')))
const oauthAuthCodeHint = computed(() => t(getOAuthKey('authCodeHint')))
const oauthImportantNotice = computed(() => {
  if (props.platform === 'openai') return t('admin.accounts.oauth.openai.importantNotice')
  if (props.platform === 'antigravity') return t('admin.accounts.oauth.antigravity.importantNotice')
  if (props.platform === 'grok') return t('admin.accounts.oauth.grok.importantNotice')
  return ''
})

// Local state
const inputMethod = ref<AuthInputMethod>(props.initialInputMethod)
const isAgentIdentityInput = computed(() => inputMethod.value === 'agent_identity')
const authCodeInput = ref('')
const sessionKeyInput = ref('')
const refreshTokenInput = ref('')
const sessionTokenInput = ref('')
const codexSessionInput = ref('')
const codexPATInput = ref('')
const ssoCookieInput = ref('')
const emailPasswordInput = ref(props.initialEmailPassword || '')
const showHelpDialog = ref(false)
const oauthState = ref('')
const projectId = ref('')

watch(
  () => [props.platform, props.showEmailPasswordOption] as const,
  async ([platform, requested]) => {
    passwordAuthEnabled.value = false
    if (platform !== 'grok' || !requested) return
    try {
      const capabilities = await adminAPI.grok.getCapabilities()
      passwordAuthEnabled.value = capabilities.password_auth_enabled
    } catch {
      // Fail closed; the backend enforces the same capability.
    }
  },
  { immediate: true }
)

watch(emailPasswordOptionEnabled, (enabled) => {
  if (!enabled && inputMethod.value === 'email_password') inputMethod.value = 'manual'
})

// Computed: show method selection only when there is something to choose.
const methodOptionCount = computed(() => [
  props.showManualOption,
  props.showCookieOption,
  props.showRefreshTokenOption,
  props.showMobileRefreshTokenOption,
  props.showSessionTokenOption,
  props.showAccessTokenOption,
  props.showCodexSessionImportOption,
  props.showAgentIdentityOption,
  props.showCodexPatOption,
  props.showSsoOption,
  emailPasswordOptionEnabled.value
].filter(Boolean).length)
const showMethodSelection = computed(() => methodOptionCount.value > 1)
const methodOptions = computed<UiChoiceOption[]>(() => {
  const options: UiChoiceOption[] = []
  if (props.showManualOption) options.push({ value: 'manual', label: t('admin.accounts.oauth.manualAuth') })
  if (props.showCookieOption) options.push({ value: 'cookie', label: t('admin.accounts.oauth.cookieAutoAuth') })
  if (props.showRefreshTokenOption) options.push({ value: 'refresh_token', label: t(getOAuthKey('refreshTokenAuth')) })
  if (props.showSsoOption) options.push({ value: 'sso_cookie', label: t(getOAuthKey('ssoCookieAuth')) })
  if (emailPasswordOptionEnabled.value) options.push({ value: 'email_password', label: t(getOAuthKey('emailPasswordAuth')) })
  if (props.showMobileRefreshTokenOption) options.push({ value: 'mobile_refresh_token', label: t('admin.accounts.oauth.openai.mobileRefreshTokenAuth') })
  if (props.showSessionTokenOption) options.push({ value: 'session_token', label: t(getOAuthKey('sessionTokenAuth')) })
  if (props.showAccessTokenOption) options.push({ value: 'access_token', label: t('admin.accounts.oauth.openai.accessTokenAuth') })
  if (props.showCodexSessionImportOption) options.push({ value: 'codex_session', label: t('admin.accounts.oauth.openai.codexSessionAuth') })
  if (props.showAgentIdentityOption) options.push({ value: 'agent_identity', label: t('admin.accounts.oauth.openai.agentIdentityAuth') })
  if (props.showCodexPatOption) options.push({ value: 'codex_pat', label: t('admin.accounts.oauth.openai.codexPatAuth') })
  return options
})
const setInputMethod = (method: string | number) => {
  inputMethod.value = method as AuthInputMethod
}

// Clipboard
const { copied, copyToClipboard } = useClipboard()

// Computed
const parsedKeyCount = computed(() => {
  return sessionKeyInput.value
    .split('\n')
    .map((k) => k.trim())
    .filter((k) => k).length
})

// Computed: count of refresh tokens entered
const parsedRefreshTokenCount = computed(() => {
  return refreshTokenInput.value
    .split('\n')
    .map((rt) => rt.trim())
    .filter((rt) => rt).length
})

const parsedCodexSessionCount = computed(() => {
  const trimmed = codexSessionInput.value.trim()
  if (!trimmed) return 0
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 1
  return trimmed
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item).length
})

const parsedSSOCount = computed(() => {
  return ssoCookieInput.value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item).length
})

const parsedEmailPasswordCount = computed(() => {
  return emailPasswordInput.value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item && item.includes('----')).length
})

const activeCredentialValue = computed({
  get: () => {
    if (inputMethod.value === 'refresh_token' || inputMethod.value === 'mobile_refresh_token') return refreshTokenInput.value
    if (inputMethod.value === 'sso_cookie') return ssoCookieInput.value
    if (inputMethod.value === 'email_password') return emailPasswordInput.value
    if (inputMethod.value === 'codex_session' || inputMethod.value === 'agent_identity') return codexSessionInput.value
    if (inputMethod.value === 'codex_pat') return codexPATInput.value
    if (inputMethod.value === 'cookie') return sessionKeyInput.value
    return ''
  },
  set: (value: string) => {
    if (inputMethod.value === 'refresh_token' || inputMethod.value === 'mobile_refresh_token') refreshTokenInput.value = value
    else if (inputMethod.value === 'sso_cookie') ssoCookieInput.value = value
    else if (inputMethod.value === 'email_password') emailPasswordInput.value = value
    else if (inputMethod.value === 'codex_session' || inputMethod.value === 'agent_identity') codexSessionInput.value = value
    else if (inputMethod.value === 'codex_pat') codexPATInput.value = value
    else if (inputMethod.value === 'cookie') sessionKeyInput.value = value
  }
})

const activeCredentialConfig = computed<CredentialConfig | null>(() => {
  if (inputMethod.value === 'refresh_token' || inputMethod.value === 'mobile_refresh_token') {
    return {
      label: 'Refresh Token',
      description: t(getOAuthKey('refreshTokenDesc')),
      placeholder: t(getOAuthKey('refreshTokenPlaceholder')),
      hint: parsedRefreshTokenCount.value > 1 ? t('admin.accounts.oauth.batchCreateAccounts', { count: parsedRefreshTokenCount.value }) : '',
      rows: 3,
      count: parsedRefreshTokenCount.value,
      loadingText: t(getOAuthKey('validating')),
      submitText: t(getOAuthKey('validateAndCreate'))
    }
  }
  if (inputMethod.value === 'sso_cookie') {
    return {
      label: t(getOAuthKey('ssoCookieLabel')),
      description: t(getOAuthKey('ssoCookieDesc')),
      placeholder: t(getOAuthKey('ssoCookiePlaceholder')),
      hint: t(getOAuthKey('ssoCookieHint')),
      rows: 5,
      count: parsedSSOCount.value,
      loadingText: t(getOAuthKey('convertingSSO')),
      submitText: t(getOAuthKey('convertSSOAndCreate'))
    }
  }
  if (inputMethod.value === 'email_password') {
    return {
      label: t(getOAuthKey('emailPasswordInputLabel')),
      description: t(getOAuthKey('emailPasswordDesc')),
      placeholder: t(getOAuthKey('emailPasswordPlaceholder')),
      hint: t(getOAuthKey('emailPasswordHint')),
      rows: 4,
      count: parsedEmailPasswordCount.value,
      loadingText: t(getOAuthKey('validating')),
      submitText: t(getOAuthKey('validateAndCreate'))
    }
  }
  if (inputMethod.value === 'codex_session' || inputMethod.value === 'agent_identity') {
    return {
      label: t(isAgentIdentityInput.value ? 'admin.accounts.oauth.openai.agentIdentityInputLabel' : 'admin.accounts.oauth.openai.codexSessionInputLabel'),
      description: t(isAgentIdentityInput.value ? 'admin.accounts.oauth.openai.agentIdentityDesc' : 'admin.accounts.oauth.openai.codexSessionDesc'),
      placeholder: t(isAgentIdentityInput.value ? 'admin.accounts.oauth.openai.agentIdentityPlaceholder' : 'admin.accounts.oauth.openai.codexSessionPlaceholder'),
      hint: t(isAgentIdentityInput.value ? 'admin.accounts.oauth.openai.agentIdentityHint' : 'admin.accounts.oauth.openai.codexSessionHint'),
      rows: 8,
      count: parsedCodexSessionCount.value,
      loadingText: t('admin.accounts.oauth.openai.validating'),
      submitText: t('admin.accounts.oauth.openai.codexSessionImportAndCreate')
    }
  }
  if (inputMethod.value === 'codex_pat') {
    return {
      label: t('admin.accounts.oauth.openai.codexPatInputLabel'),
      description: t('admin.accounts.oauth.openai.codexPatDesc'),
      placeholder: t('admin.accounts.oauth.openai.codexPatPlaceholder'),
      hint: t('admin.accounts.oauth.openai.codexPatHint'),
      rows: 3,
      count: 0,
      loadingText: t('admin.accounts.oauth.openai.validating'),
      submitText: t('admin.accounts.oauth.openai.codexPatImportAndCreate')
    }
  }
  if (inputMethod.value === 'cookie') {
    return {
      label: t('admin.accounts.oauth.sessionKey'),
      description: t('admin.accounts.oauth.cookieAutoAuthDesc'),
      placeholder: props.allowMultiple ? t('admin.accounts.oauth.sessionKeyPlaceholder') : t('admin.accounts.oauth.sessionKeyPlaceholderSingle'),
      hint: parsedKeyCount.value > 1 && props.allowMultiple ? t('admin.accounts.oauth.batchCreateAccounts', { count: parsedKeyCount.value }) : '',
      rows: 3,
      count: props.allowMultiple ? parsedKeyCount.value : 0,
      loadingText: t('admin.accounts.oauth.authorizing'),
      submitText: t('admin.accounts.oauth.startAutoAuth')
    }
  }
  return null
})

const submitActiveCredential = () => {
  if (inputMethod.value === 'refresh_token' || inputMethod.value === 'mobile_refresh_token') handleValidateRefreshToken()
  else if (inputMethod.value === 'sso_cookie') handleImportSSO()
  else if (inputMethod.value === 'email_password') handleAuthorizePassword()
  else if (inputMethod.value === 'codex_session' || inputMethod.value === 'agent_identity') handleImportCodexSession()
  else if (inputMethod.value === 'codex_pat') handleImportCodexPAT()
  else if (inputMethod.value === 'cookie') handleCookieAuth()
}

const manualSteps = computed(() => [
  { key: 'generate', label: oauthStep1GenerateUrl.value },
  { key: 'authorize', label: oauthStep2OpenUrl.value },
  { key: 'callback', label: oauthStep3EnterCode.value }
])
const manualStepCurrent = computed(() => authCodeInput.value.trim() ? 2 : props.authUrl ? 1 : 0)

const handleAuthorizePassword = () => {
  if (emailPasswordInput.value.trim()) {
    emit('authorize-password', emailPasswordInput.value)
  }
}

// Watchers
watch(() => props.initialInputMethod, (newVal) => {
  inputMethod.value = newVal
})

watch(
  () => props.initialEmailPassword,
  (newVal) => {
    // Only prefill when the field is empty so we never overwrite operator input.
    if (newVal && !emailPasswordInput.value.trim()) {
      emailPasswordInput.value = newVal
    }
  }
)

watch(inputMethod, (newVal) => {
  emit('update:inputMethod', newVal)
})

// Auto-extract code from callback URL (OpenAI/Gemini/Antigravity/Grok)
// e.g., http://localhost:8085/callback?code=xxx...&state=...
watch(authCodeInput, (newVal) => {
  if (props.platform !== 'openai' && props.platform !== 'gemini' && props.platform !== 'antigravity' && props.platform !== 'grok') return

  const trimmed = newVal.trim()
  // Check if it looks like a URL with code parameter
  if (trimmed.includes('code=')) {
    try {
      // Try to parse as URL
      const url = trimmed.includes('?') ? new URL(trimmed) : new URL(`http://localhost/callback?${trimmed.replace(/^\?/, '')}`)
      const code = url.searchParams.get('code')
      const stateParam = url.searchParams.get('state')
      if ((props.platform === 'openai' || props.platform === 'gemini' || props.platform === 'antigravity' || props.platform === 'grok') && stateParam) {
        oauthState.value = stateParam
      }
      if (code && code !== trimmed) {
        // Replace the input with just the code
        authCodeInput.value = code
      }
    } catch {
      // If URL parsing fails, try regex extraction
      const match = trimmed.match(/[?&]code=([^&]+)/)
      const stateMatch = trimmed.match(/[?&]state=([^&]+)/)
      if ((props.platform === 'openai' || props.platform === 'gemini' || props.platform === 'antigravity' || props.platform === 'grok') && stateMatch && stateMatch[1]) {
        oauthState.value = stateMatch[1]
      }
      if (match && match[1] && match[1] !== trimmed) {
        authCodeInput.value = match[1]
      }
    }
  }
})

// Methods
const handleGenerateUrl = () => {
  emit('generate-url')
}

const handleCopyUrl = () => {
  if (props.authUrl) {
    copyToClipboard(props.authUrl, 'URL copied to clipboard')
  }
}

const handleRegenerate = () => {
  authCodeInput.value = ''
  emit('generate-url')
}

const handleCookieAuth = () => {
  if (sessionKeyInput.value.trim()) {
    emit('cookie-auth', sessionKeyInput.value)
  }
}

const handleValidateRefreshToken = () => {
  if (refreshTokenInput.value.trim()) {
    if (inputMethod.value === 'mobile_refresh_token') {
      emit('validate-mobile-refresh-token', refreshTokenInput.value.trim())
    } else {
      emit('validate-refresh-token', refreshTokenInput.value.trim())
    }
  }
}

const handleImportCodexSession = () => {
  if (codexSessionInput.value.trim()) {
    emit('import-codex-session', codexSessionInput.value.trim())
  }
}

const handleImportCodexPAT = () => {
  if (codexPATInput.value.trim()) {
    emit('import-codex-pat', codexPATInput.value.trim())
  }
}

const handleImportSSO = () => {
  if (ssoCookieInput.value.trim()) {
    emit('import-sso', ssoCookieInput.value.trim())
  }
}

// Expose methods and state
defineExpose({
  authCode: authCodeInput,
  oauthState,
  projectId,
  sessionKey: sessionKeyInput,
  refreshToken: refreshTokenInput,
  sessionToken: sessionTokenInput,
  codexSession: codexSessionInput,
  codexPAT: codexPATInput,
  ssoCookie: ssoCookieInput,
  emailPassword: emailPasswordInput,
  inputMethod,
  reset: () => {
    authCodeInput.value = ''
    oauthState.value = ''
    projectId.value = ''
    sessionKeyInput.value = ''
    refreshTokenInput.value = ''
    sessionTokenInput.value = ''
    codexSessionInput.value = ''
    codexPATInput.value = ''
    ssoCookieInput.value = ''
    emailPasswordInput.value = ''
    inputMethod.value = props.initialInputMethod
    showHelpDialog.value = false
  }
})
</script>

<style scoped>
.oauth-flow{display:flex;min-width:0;flex-direction:column;gap:16px;padding:2px 0}
.oauth-flow__header{display:flex;align-items:center;gap:8px;color:var(--ui-text)}
.oauth-flow__header h4{margin:0;font-size:14px;font-weight:600;line-height:22px}
.oauth-flow__credentials,.oauth-flow__manual{min-width:0;padding-top:14px;border-top:1px solid var(--ui-border-soft)}
.oauth-flow__description,.oauth-flow__step>p{margin:0;color:var(--ui-text-muted);font-size:13px;line-height:21px}
.oauth-flow__field-label{display:inline-flex;align-items:center;gap:7px}
.oauth-flow__error{white-space:pre-line}
.oauth-flow__help-list{margin:6px 0;padding-left:18px;color:var(--ui-text-muted);font-size:12px;line-height:20px}
.oauth-flow__step{display:flex;min-width:0;flex-direction:column;gap:10px;padding-top:14px;border-top:1px solid var(--ui-border-soft)}
.oauth-flow__step h5{margin:0;color:var(--ui-text);font-size:13px;font-weight:600;line-height:21px}
.oauth-flow__step :deep(.ui-text-shell){flex:1}
@media(max-width:560px){.oauth-flow{gap:14px}.oauth-flow__credentials,.oauth-flow__manual,.oauth-flow__step{padding-top:12px}}
</style>
