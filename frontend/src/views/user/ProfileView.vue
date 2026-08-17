<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader
        :title="t('profile.title')"
        :description="t('profile.description')"
      />

      <div v-if="initialLoading && !user" class="profile-skeleton" data-testid="profile-skeleton">
        <UiSkeleton height="116px" />
        <UiSkeleton height="220px" />
        <UiSkeleton height="280px" />
      </div>

      <UiErrorState
        v-else-if="!user"
        data-testid="profile-load-error"
        :title="t('profile.loadFailed')"
        :description="t('profile.loadFailedDescription')"
        :retry-text="t('common.retry')"
        @retry="loadProfile"
      />

      <UiLoadingOverlay v-else :show="initialLoading || refreshing" :label="t('common.loading')">
      <div data-testid="profile-shell" class="profile-workspace">
        <div v-if="profileError || settingsError" class="profile-retry-banner">
          <UiBanner
            tone="danger"
            :message="settingsError ? t('profile.settingsLoadFailed') : t('profile.loadFailedDescription')"
          />
          <UiButton density="dense" @click="loadProfile">{{ t('common.retry') }}</UiButton>
        </div>

        <ProfileInfoCard
          :user="user"
          :linuxdo-enabled="linuxdoOAuthEnabled"
          :dingtalk-enabled="dingtalkOAuthEnabled"
          :oidc-enabled="oidcOAuthEnabled"
          :oidc-provider-name="oidcOAuthProviderName"
          :wechat-enabled="wechatOAuthEnabled"
          :wechat-open-enabled="wechatOAuthOpenEnabled"
          :wechat-mp-enabled="wechatOAuthMPEnabled"
        />

        <AppSection
          data-testid="profile-settings-panel"
          :title="t('profile.basicsTitle')"
          :description="t('profile.basicsDescription')"
          divided
        >
          <div data-testid="profile-basics-panel" class="profile-basics-grid">
            <div class="profile-basics-grid__avatar">
              <ProfileAvatarCard :user="user" embedded />
            </div>
            <ProfileEditForm :initial-username="user?.username || ''" embedded />
          </div>
        </AppSection>

        <AppSection data-testid="profile-auth-bindings-panel" divided>
          <ProfileIdentityBindingsSection
            :user="user"
            :linuxdo-enabled="linuxdoOAuthEnabled"
            :dingtalk-enabled="dingtalkOAuthEnabled"
            :oidc-enabled="oidcOAuthEnabled"
            :oidc-provider-name="oidcOAuthProviderName"
            :wechat-enabled="wechatOAuthEnabled"
            :wechat-open-enabled="wechatOAuthOpenEnabled"
            :wechat-mp-enabled="wechatOAuthMPEnabled"
            embedded
            compact
          />
        </AppSection>

        <AppSection
          data-testid="profile-security-panel"
          :title="t('profile.securityTitle')"
          :description="t('profile.securityDescription')"
          divided
        >

          <div class="profile-security-row">
            <span class="profile-security-row__icon" aria-hidden="true"><Icon name="lock" size="sm" /></span>
            <div class="profile-security-row__copy">
              <strong>{{ t('profile.changePassword') }}</strong>
              <span>{{ t('profile.passwordHint') }}</span>
            </div>
            <UiButton
              data-testid="profile-password-toggle"
              variant="secondary"
              density="compact"
              :aria-expanded="passwordFormExpanded"
              aria-controls="profile-password-form-panel"
              @click="passwordFormExpanded = !passwordFormExpanded"
            >
              {{ passwordFormExpanded ? t('common.collapse') : t('profile.changePassword') }}
            </UiButton>
          </div>

          <div
            v-if="passwordFormExpanded"
            id="profile-password-form-panel"
            class="profile-password-panel"
            data-testid="profile-password-form-panel"
          >
            <ProfilePasswordForm embedded />
          </div>

          <ProfileTotpCard embedded />
          <ProfilePasskeyCard :enabled="passkeyEnabled" embedded />
        </AppSection>

        <AppSection v-if="user" divided data-testid="profile-billing-preference-panel">
          <ProfileBillingPreferenceSection :value="user.billing_preference" />
        </AppSection>

        <AppSection v-if="user && balanceLowNotifyEnabled" divided>
          <ProfileBalanceNotifyCard
            :enabled="user.balance_notify_enabled ?? true"
            :threshold="user.balance_notify_threshold"
            :extra-emails="user.balance_notify_extra_emails ?? []"
            :system-default-threshold="systemDefaultThreshold"
            :user-email="user.email"
            embedded
            flat
          />
        </AppSection>

        <AppSection v-if="contactInfo" class="profile-support" :title="t('common.contactSupport')">
          <span class="profile-support__icon" aria-hidden="true"><Icon name="chat" size="sm" /></span>
          <p>{{ contactInfo }}</p>
        </AppSection>
      </div>
      </UiLoadingOverlay>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@/components/icons'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  UiBanner,
  UiButton,
  UiErrorState,
  UiLoadingOverlay,
  UiSkeleton,
} from '@/components/ui'
import ProfileBalanceNotifyCard from '@/components/user/profile/ProfileBalanceNotifyCard.vue'
import ProfileAvatarCard from '@/components/user/profile/ProfileAvatarCard.vue'
import ProfileEditForm from '@/components/user/profile/ProfileEditForm.vue'
import ProfileInfoCard from '@/components/user/profile/ProfileInfoCard.vue'
import ProfileIdentityBindingsSection from '@/components/user/profile/ProfileIdentityBindingsSection.vue'
import ProfilePasswordForm from '@/components/user/profile/ProfilePasswordForm.vue'
import ProfileTotpCard from '@/components/user/profile/ProfileTotpCard.vue'
import ProfilePasskeyCard from '@/components/user/profile/ProfilePasskeyCard.vue'
import ProfileBillingPreferenceSection from '@/components/user/profile/ProfileBillingPreferenceSection.vue'
import { isWeChatWebOAuthEnabled } from '@/api/auth'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const user = computed(() => authStore.user)

const contactInfo = ref('')
const balanceLowNotifyEnabled = ref(false)
const systemDefaultThreshold = ref(0)
const linuxdoOAuthEnabled = ref(false)
const dingtalkOAuthEnabled = ref(false)
const wechatOAuthEnabled = ref(false)
const wechatOAuthOpenEnabled = ref<boolean | undefined>(undefined)
const wechatOAuthMPEnabled = ref<boolean | undefined>(undefined)
const oidcOAuthEnabled = ref(false)
const oidcOAuthProviderName = ref('OIDC')
const passkeyEnabled = ref(false)
const passwordFormExpanded = ref(false)
const initialLoading = ref(true)
const refreshing = ref(false)
const profileError = ref(false)
const settingsError = ref(false)
const hasLoaded = ref(false)

const applySettings = (settings: Awaited<ReturnType<typeof appStore.fetchPublicSettings>>) => {
  if (!settings) return false
  contactInfo.value = settings.contact_info || ''
  balanceLowNotifyEnabled.value = settings.balance_low_notify_enabled ?? false
  systemDefaultThreshold.value = settings.balance_low_notify_threshold ?? 0
  linuxdoOAuthEnabled.value = settings.linuxdo_oauth_enabled ?? false
  dingtalkOAuthEnabled.value = settings.dingtalk_oauth_enabled ?? false
  wechatOAuthEnabled.value = isWeChatWebOAuthEnabled(settings)
  wechatOAuthOpenEnabled.value = typeof settings.wechat_oauth_open_enabled === 'boolean'
    ? settings.wechat_oauth_open_enabled
    : undefined
  wechatOAuthMPEnabled.value = typeof settings.wechat_oauth_mp_enabled === 'boolean'
    ? settings.wechat_oauth_mp_enabled
    : undefined
  oidcOAuthEnabled.value = settings.oidc_oauth_enabled ?? false
  oidcOAuthProviderName.value = settings.oidc_oauth_provider_name || 'OIDC'
  passkeyEnabled.value = settings.passkey_enabled === true
  return true
}

const loadProfile = async () => {
  const firstLoad = !hasLoaded.value
  if (firstLoad) initialLoading.value = true
  else refreshing.value = true
  profileError.value = false
  settingsError.value = false

  const [profileResult, settingsResult] = await Promise.allSettled([
    authStore.refreshUser(),
    appStore.fetchPublicSettings(),
  ])

  if (profileResult.status === 'rejected') {
    profileError.value = true
    console.error('Failed to refresh profile:', profileResult.reason)
  }
  if (settingsResult.status === 'rejected' || !applySettings(settingsResult.value)) {
    settingsError.value = true
    if (settingsResult.status === 'rejected') {
      console.error('Failed to load settings:', settingsResult.reason)
    }
  }

  hasLoaded.value = true
  initialLoading.value = false
  refreshing.value = false
}

onMounted(() => {
  void loadProfile()
})
</script>

<style scoped>
.profile-workspace,
.profile-skeleton {
  display: grid;
  gap: 16px;
  padding-top: 16px;
}

.profile-retry-banner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.profile-basics-grid { display: grid; grid-template-columns: minmax(240px, .8fr) minmax(0, 1.2fr); gap: 20px; }
.profile-basics-grid__avatar { min-width: 0; padding-right: 20px; border-right: 1px solid var(--ui-border-soft); }
.profile-security-row { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--ui-border-soft); }
.profile-security-row__icon, .profile-support__icon { display: grid; width: 20px; height: 20px; place-items: center; color: var(--ui-info); }
.profile-security-row__copy { display: grid; min-width: 0; gap: 2px; }
.profile-security-row__copy strong { color: var(--ui-text); font-size: 13px; font-weight: 600; line-height: 20px; }
.profile-security-row__copy span { overflow: hidden; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.profile-password-panel { padding: 12px 0; border-bottom: 1px solid var(--ui-border-soft); }
.profile-support { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: start; gap: 10px; }
.profile-support p { margin: 0; }
.profile-support p { margin-top: 2px; color: var(--ui-text-muted); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
@media (max-width: 800px) { .profile-basics-grid { grid-template-columns: 1fr; gap: 16px; } .profile-basics-grid__avatar { padding-right: 0; padding-bottom: 16px; border-right: 0; border-bottom: 1px solid var(--ui-border-soft); } }
@media (max-width: 520px) {
  .profile-retry-banner { grid-template-columns: minmax(0, 1fr); }
  .profile-security-row { grid-template-columns: 20px minmax(0, 1fr); }
  .profile-security-row .ui-button { grid-column: 2; justify-self: start; }
}
</style>
