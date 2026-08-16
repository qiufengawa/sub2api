<template>
  <div class="auth-oauth-section">
    <UiButton type="button" :disabled="disabled" variant="secondary" density="compact" block @click="startLogin">
      <template #icon><Icon name="shield" size="sm" /></template>
      {{ t('auth.oidc.signIn', { providerName: normalizedProviderName }) }}
    </UiButton>

    <UiDivider v-if="showDivider">{{ t('auth.oauthOrContinue') }}</UiDivider>
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

const props = withDefaults(defineProps<{
  disabled?: boolean
  affCode?: string
  providerName?: string
  showDivider?: boolean
}>(), {
  providerName: 'OIDC',
  showDivider: true
})
const emit = defineEmits<{
  start: [request: OAuthLoginStart]
}>()

const route = useRoute()
const { t } = useI18n()

const normalizedProviderName = computed(() => {
  const name = props.providerName?.trim()
  return name || 'OIDC'
})

function startLogin(): void {
  const redirectTo = (route.query.redirect as string) || '/dashboard'
  storeOAuthAffiliateCode(resolveAffiliateReferralCode(props.affCode, route.query.aff, route.query.aff_code))
  emit('start', { provider: 'oidc', params: { redirect: redirectTo } })
}
</script>

<style scoped>
.auth-oauth-section { display: grid; gap: 12px; }
</style>
