<template>
  <div v-if="hasProviders" class="auth-oauth-section">
    <UiDivider v-if="showDivider">{{ t('auth.oauthOrContinue') }}</UiDivider>

    <div class="auth-oauth-section__grid" :class="{ 'auth-oauth-section__grid--split': hasMultipleProviders }">
      <UiButton
        v-for="provider in visibleProviders"
        :key="provider"
        type="button"
        :disabled="disabled"
        variant="secondary"
        density="compact"
        block
        @click="startLogin(provider)"
      >
        <template #icon><Icon :name="provider === 'github' ? 'github' : 'globe'" size="sm" /></template>
        {{ providerLabel(provider) }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiDivider } from '@/components/ui'
import type { OAuthLoginStart } from '@/api/auth'
import { resolveAffiliateReferralCode, storeOAuthAffiliateCode } from '@/utils/oauthAffiliate'

type EmailOAuthProvider = 'github' | 'google'
const EMAIL_OAUTH_PENDING_PROVIDER_KEY = 'email_oauth_pending_provider'

const props = withDefaults(defineProps<{
  disabled?: boolean
  affCode?: string
  githubEnabled?: boolean
  googleEnabled?: boolean
  showDivider?: boolean
}>(), {
  showDivider: true
})
const emit = defineEmits<{
  start: [request: OAuthLoginStart]
}>()

const route = useRoute()
const { t } = useI18n()

const visibleProviders = computed<EmailOAuthProvider[]>(() => {
  const providers: EmailOAuthProvider[] = []
  if (props.githubEnabled) providers.push('github')
  if (props.googleEnabled) providers.push('google')
  return providers
})

const hasProviders = computed(() => visibleProviders.value.length > 0)
const hasMultipleProviders = computed(() => visibleProviders.value.length > 1)
function providerLabel(provider: EmailOAuthProvider): string {
  const name = provider === 'github' ? 'GitHub' : 'Google'
  return hasMultipleProviders.value ? name : t('auth.emailOAuth.signIn', { providerName: name })
}

function startLogin(provider: EmailOAuthProvider): void {
  const redirectTo = (route.query.redirect as string) || '/dashboard'
  const affiliateCode = resolveAffiliateReferralCode(props.affCode, route.query.aff, route.query.aff_code)
  storeOAuthAffiliateCode(affiliateCode)
  window.sessionStorage.setItem(EMAIL_OAUTH_PENDING_PROVIDER_KEY, provider)
  const params: Record<string, string> = { redirect: redirectTo }
  if (affiliateCode) {
    params.aff_code = affiliateCode
  }
  emit('start', { provider, params })
}
</script>

<style scoped>
.auth-oauth-section { display: grid; gap: 12px; }
.auth-oauth-section__grid { display: grid; gap: 8px; }
.auth-oauth-section__grid--split { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 420px) {
  .auth-oauth-section__grid--split { grid-template-columns: 1fr; }
}
</style>
