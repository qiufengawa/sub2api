<template>
  <Teleport to="body">
    <Transition name="account-action-menu">
      <div v-if="show && position" class="account-action-menu__layer">
      <div class="account-action-menu__backdrop" aria-hidden="true" @click="emit('close')"></div>
      <div
        class="account-action-menu__panel"
        :style="{ top: position.top + 'px', left: position.left + 'px' }"
        role="menu"
        :aria-label="t('common.more')"
        @click.stop
      >
        <div class="account-action-menu__items">
          <template v-if="account">
            <UiButton role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('test', account); $emit('close')">
              <template #icon><Icon name="play" size="sm" :stroke-width="2" /></template>
              {{ t('admin.accounts.testConnection') }}
            </UiButton>
            <UiButton role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('stats', account); $emit('close')">
              <template #icon><Icon name="chart" size="sm" /></template>
              {{ t('admin.accounts.viewStats') }}
            </UiButton>
            <UiButton role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('schedule', account); $emit('close')">
              <template #icon><Icon name="clock" size="sm" /></template>
              {{ t('admin.scheduledTests.schedule') }}
            </UiButton>
            <UiButton v-if="canDuplicate" role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('duplicate', account); $emit('close')">
              <template #icon><Icon name="copy" size="sm" /></template>
              {{ t('admin.accounts.duplicateAccount') }}
            </UiButton>
            <!-- 影子账号不持凭据:重授权/刷新 token 对其无效(后端拒绝),故隐藏(外审 G4)。 -->
            <template v-if="(account.type === 'oauth' || account.type === 'setup-token') && !isShadow">
              <UiButton role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('reauth', account); $emit('close')">
                <template #icon><Icon name="link" size="sm" /></template>
                {{ t('admin.accounts.reAuthorize') }}
              </UiButton>
              <UiButton role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('refresh-token', account); $emit('close')">
                <template #icon><Icon name="refresh" size="sm" /></template>
                {{ t('admin.accounts.refreshToken') }}
              </UiButton>
            </template>
            <UiButton v-if="isOpenAIOAuthParent" role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('create-spark-shadow', account); $emit('close')">
              <template #icon><Icon name="sparkles" size="sm" /></template>
              {{ t('admin.accounts.createSparkShadow') }}
            </UiButton>
            <UiButton v-if="supportsPrivacy" role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('set-privacy', account); $emit('close')">
              <template #icon><Icon name="shield" size="sm" /></template>
              {{ t('admin.accounts.setPrivacy') }}
            </UiButton>
            <div v-if="hasRecoverableState" class="account-action-menu__divider"></div>
            <UiButton v-if="hasRecoverableState" role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('recover-state', account); $emit('close')">
              <template #icon><Icon name="sync" size="sm" /></template>
              {{ t('admin.accounts.recoverState') }}
            </UiButton>
            <UiButton v-if="hasQuotaLimit" role="menuitem" block density="compact" variant="quiet" class="account-action-menu__button" @click="$emit('reset-quota', account); $emit('close')">
              <template #icon><Icon name="refresh" size="sm" /></template>
              {{ t('admin.accounts.resetQuota') }}
            </UiButton>
          </template>
        </div>
      </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@/components/icons'
import type { Account } from '@/types'
import { UiButton } from '@/components/ui'

const props = defineProps<{ show: boolean; account: Account | null; position: { top: number; left: number } | null }>()
const emit = defineEmits(['close', 'test', 'stats', 'schedule', 'duplicate', 'reauth', 'refresh-token', 'recover-state', 'reset-quota', 'set-privacy', 'create-spark-shadow'])
const { t } = useI18n()
const canDuplicate = computed(() => {
  if (!props.account || props.account.parent_account_id != null) return false
  return ['apikey', 'upstream', 'bedrock', 'service_account'].includes(props.account.type)
})
const isRateLimited = computed(() => {
  if (props.account?.rate_limit_reset_at && new Date(props.account.rate_limit_reset_at) > new Date()) {
    return true
  }
  const modelLimits = (props.account?.extra as Record<string, unknown> | undefined)?.model_rate_limits as
    | Record<string, { rate_limit_reset_at: string }>
    | undefined
  if (modelLimits) {
    const now = new Date()
    return Object.values(modelLimits).some(info => new Date(info.rate_limit_reset_at) > now)
  }
  return false
})
const isOverloaded = computed(() => props.account?.overload_until && new Date(props.account.overload_until) > new Date())
const isTempUnschedulable = computed(() => props.account?.temp_unschedulable_until && new Date(props.account.temp_unschedulable_until) > new Date())
const hasRecoverableState = computed(() => {
  return props.account?.status === 'error' || Boolean(isRateLimited.value) || Boolean(isOverloaded.value) || Boolean(isTempUnschedulable.value)
})
const isAntigravityOAuth = computed(() => props.account?.platform === 'antigravity' && props.account?.type === 'oauth')
const isOpenAIOAuth = computed(() => props.account?.platform === 'openai' && props.account?.type === 'oauth')
// 影子账号(链接型,持 parent_account_id)不持凭据、type 不可变,凭据/隐私类操作对其无效。
const isShadow = computed(() => props.account?.parent_account_id != null)
// A "parent" OpenAI OAuth account is one that is NOT itself a shadow (parent_account_id == null)
const isOpenAIOAuthParent = computed(() => isOpenAIOAuth.value && !isShadow.value)
const supportsPrivacy = computed(() => (isAntigravityOAuth.value || isOpenAIOAuth.value) && !isShadow.value)
const hasQuotaLimit = computed(() => {
  return (props.account?.type === 'apikey' || props.account?.type === 'bedrock') && (
    (props.account?.quota_limit ?? 0) > 0 ||
    (props.account?.quota_daily_limit ?? 0) > 0 ||
    (props.account?.quota_weekly_limit ?? 0) > 0
  )
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      window.addEventListener('keydown', handleKeydown)
    } else {
      window.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.account-action-menu__layer{position:fixed;inset:0;z-index:9998;pointer-events:none}.account-action-menu__backdrop{position:absolute;inset:0;pointer-events:auto}.account-action-menu__panel{position:fixed;z-index:1;width:208px;max-height:calc(100dvh - 16px);overflow-y:auto;padding:6px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);box-shadow:0 8px 24px rgb(31 35 41/.08);pointer-events:auto}.account-action-menu__items{display:grid;gap:2px}.account-action-menu__button{justify-content:flex-start}.account-action-menu__divider{height:1px;margin:4px 2px;background:var(--ui-border-soft)}.account-action-menu-enter-active,.account-action-menu-leave-active{transition:opacity var(--ui-motion-fast) var(--ui-ease-standard)}.account-action-menu-enter-from,.account-action-menu-leave-to{opacity:0}@media(prefers-reduced-motion:reduce){.account-action-menu-enter-active,.account-action-menu-leave-active{transition:none}}
</style>
