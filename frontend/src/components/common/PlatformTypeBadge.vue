<template>
  <AppStack class="platform-type-badge" :gap="3">
    <AppInline :gap="4">
      <UiBadge tone="info">
        <Icon :name="platformIconName" size="xs" />
        {{ platformLabel }}
      </UiBadge>
      <UiBadge tone="neutral">
        <Icon :name="typeIconName" size="xs" />
        {{ typeLabel }}
      </UiBadge>
    </AppInline>

    <AppInline v-if="planLabel || privacyBadge" :gap="4">
      <UiBadge v-if="planLabel" :tone="planTone">
        <Icon
          v-if="planIconName"
          :name="planIconName"
          size="xs"
          :data-testid="isGrokFreePlan ? 'grok-free-plan-icon' : 'grok-plan-icon'"
        />
        {{ planLabel }}
      </UiBadge>
      <UiTooltip v-if="privacyBadge" :content="privacyBadge.title">
        <UiBadge :tone="privacyBadge.tone">
          <Icon :name="privacyBadge.icon" size="xs" />
          {{ privacyBadge.label }}
        </UiBadge>
      </UiTooltip>
    </AppInline>

    <UiTooltip v-if="expiresLabel" :content="subscriptionExpiresAt">
      <span class="platform-type-badge__expiry">{{ expiresLabel }}</span>
    </UiTooltip>
  </AppStack>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AccountPlatform, AccountType } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import { AppInline, AppStack, UiBadge, UiTooltip } from '@/components/ui'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'
type PrivacyBadge = {
  label: string
  icon: 'shield' | 'exclamationTriangle'
  title: string
  tone: 'success' | 'warning' | 'danger'
}

interface Props {
  platform: AccountPlatform
  type: AccountType
  authMode?: string
  planType?: string
  privacyMode?: string
  subscriptionExpiresAt?: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const platformLabel = computed(() => {
  if (props.platform === 'anthropic') return 'Anthropic'
  if (props.platform === 'openai') return 'OpenAI'
  if (props.platform === 'antigravity') return 'Antigravity'
  if (props.platform === 'grok') return 'Grok'
  return 'Gemini'
})

const platformIconName = computed<'brain' | 'chatBubble' | 'sparkles' | 'bolt'>(() => {
  if (props.platform === 'anthropic') return 'brain'
  if (props.platform === 'openai') return 'chatBubble'
  if (props.platform === 'grok') return 'bolt'
  return 'sparkles'
})

const normalizedAuthMode = computed(() =>
  (props.authMode || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
)

const typeLabel = computed(() => {
  if (props.platform === 'openai' && props.type === 'oauth') {
    if (normalizedAuthMode.value === 'agentidentity') return 'Agent Identity'
    if (normalizedAuthMode.value === 'personalaccesstoken') return 'PAT'
  }
  switch (props.type) {
    case 'oauth': return 'OAuth'
    case 'setup-token': return 'Token'
    case 'apikey': return 'Key'
    case 'bedrock': return 'AWS'
    case 'service_account': return 'Vertex'
    default: return props.type
  }
})

const typeIconName = computed<'key' | 'shield' | 'cloud'>(() => {
  if (props.type === 'setup-token') return 'shield'
  if (props.type === 'service_account') return 'cloud'
  return 'key'
})

const normalizedPlanType = computed(() =>
  (props.planType || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
)

const planLabel = computed(() => {
  if (!normalizedPlanType.value) return ''
  switch (normalizedPlanType.value) {
    case 'plus': return 'Plus'
    case 'team': return 'Team'
    case 'chatgptpro':
    case 'pro': return 'Pro'
    case 'free':
    case 'basic': return props.platform === 'grok' ? 'Grok Free' : 'Free'
    case 'supergrok': return 'SuperGrok'
    case 'supergroklite': return 'SuperGrok Lite'
    case 'supergrokplus': return 'SuperGrok Plus'
    case 'supergrokheavy': return 'SuperGrok Heavy'
    case 'heavy': return 'Heavy'
    case 'xbasic': return 'X Basic'
    case 'abnormal': return t('admin.accounts.subscriptionAbnormal')
    default: return props.planType || ''
  }
})

const isGrokFreePlan = computed(() =>
  props.platform === 'grok' && ['free', 'basic', 'xbasic'].includes(normalizedPlanType.value)
)

const planIconName = computed<'sparkles' | 'bolt' | null>(() => {
  if (isGrokFreePlan.value) return 'sparkles'
  if (props.platform === 'grok' && normalizedPlanType.value) return 'bolt'
  return null
})

const planTone = computed<BadgeTone>(() => {
  if (normalizedPlanType.value === 'abnormal') return 'danger'
  if (['free', 'basic', 'xbasic'].includes(normalizedPlanType.value)) return 'neutral'
  if (props.platform === 'grok' && normalizedPlanType.value.includes('heavy')) return 'warning'
  if (normalizedPlanType.value) return 'info'
  return 'neutral'
})

const expiresLabel = computed(() => {
  if (!props.subscriptionExpiresAt || !props.planType) return ''
  if (['free', 'basic', 'xbasic'].includes(normalizedPlanType.value)) return ''
  const date = new Date(props.subscriptionExpiresAt)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${t('admin.accounts.subscriptionExpires')} ${yyyy}-${mm}-${dd}`
})

const privacyBadge = computed<PrivacyBadge | null>(() => {
  if (props.type !== 'oauth' || !props.privacyMode) return null
  if (props.platform !== 'openai' && props.platform !== 'antigravity') return null

  switch (props.privacyMode) {
    case 'training_off':
      return { label: 'Private', icon: 'shield', title: t('admin.accounts.privacyTrainingOff'), tone: 'success' }
    case 'training_set_cf_blocked':
      return { label: 'CF', icon: 'exclamationTriangle', title: t('admin.accounts.privacyCfBlocked'), tone: 'warning' }
    case 'training_set_failed':
      return { label: 'Fail', icon: 'exclamationTriangle', title: t('admin.accounts.privacyFailed'), tone: 'danger' }
    case 'privacy_set':
      return { label: 'Private', icon: 'shield', title: t('admin.accounts.privacyAntigravitySet'), tone: 'success' }
    case 'privacy_set_failed':
      return { label: 'Fail', icon: 'exclamationTriangle', title: t('admin.accounts.privacyAntigravityFailed'), tone: 'danger' }
    default:
      return null
  }
})
</script>

<style scoped>
.platform-type-badge{display:inline-flex;align-items:flex-start;font-size:11px}.platform-type-badge__expiry{display:inline-flex;color:var(--ui-text-soft);font-size:10px;line-height:14px;font-variant-numeric:tabular-nums}
</style>
