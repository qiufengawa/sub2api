<template>
  <AppLayout>
    <div
      data-testid="profile-shell"
      class="space-y-4"
    >
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

      <section
        data-testid="profile-settings-panel"
        class="overflow-hidden rounded border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800"
      >
        <header class="border-b border-gray-100 px-4 py-3 dark:border-dark-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('profile.title') }}
          </h2>
          <p class="mt-0.5 text-sm text-gray-500 dark:text-dark-400">
            {{ t('profile.description') }}
          </p>
        </header>

        <div class="divide-y divide-gray-100 dark:divide-dark-700">
          <section data-testid="profile-basics-panel" class="p-4">
            <header>
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ t('profile.basicsTitle') }}
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">
                {{ t('profile.basicsDescription') }}
              </p>
            </header>

            <div class="mt-4 grid gap-4 lg:grid-cols-2">
              <div class="border-b border-gray-100 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4 dark:border-dark-700">
                <ProfileAvatarCard :user="user" embedded />
              </div>
              <ProfileEditForm :initial-username="user?.username || ''" embedded />
            </div>
          </section>

          <section
            data-testid="profile-auth-bindings-panel"
            class="p-4"
          >
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
          </section>

          <section data-testid="profile-security-panel">
            <header class="px-4 py-3">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ t('profile.securityTitle') }}
              </h2>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">
                {{ t('profile.securityDescription') }}
              </p>
            </header>

            <div class="border-t border-gray-100 dark:border-dark-700">
              <div class="flex items-center justify-between gap-3 px-4 py-3">
                <div class="flex min-w-0 items-center gap-3">
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                    <Icon name="lock" size="sm" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ t('profile.changePassword') }}
                    </p>
                    <p class="truncate text-xs text-gray-500 dark:text-dark-400">
                      {{ t('profile.passwordHint') }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm shrink-0"
                  data-testid="profile-password-toggle"
                  @click="passwordFormExpanded = !passwordFormExpanded"
                >
                  {{ passwordFormExpanded ? t('common.collapse') : t('profile.changePassword') }}
                </button>
              </div>

              <div
                v-if="passwordFormExpanded"
                class="border-t border-gray-100 bg-gray-50/60 p-4 dark:border-dark-700 dark:bg-dark-900/30"
                data-testid="profile-password-form-panel"
              >
                <ProfilePasswordForm embedded />
              </div>
            </div>

            <ProfileTotpCard embedded />
            <ProfilePasskeyCard :enabled="passkeyEnabled" embedded />
          </section>

          <section v-if="user && subscriptionGroupBillingEnabled" class="p-4" data-testid="profile-billing-preference-panel">
            <ProfileBillingPreferenceSection :value="user.billing_preference" />
          </section>

          <section v-if="user && balanceLowNotifyEnabled" class="p-4">
            <ProfileBalanceNotifyCard
              :enabled="user.balance_notify_enabled ?? true"
              :threshold="user.balance_notify_threshold"
              :extra-emails="user.balance_notify_extra_emails ?? []"
              :system-default-threshold="systemDefaultThreshold"
              :user-email="user.email"
              embedded
              flat
            />
          </section>

          <section
            v-if="contactInfo"
            class="flex items-center gap-3 px-4 py-3"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
              <Icon name="chat" size="sm" />
            </span>
            <div class="min-w-0">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                {{ t('common.contactSupport') }}
              </h3>
              <p class="mt-0.5 break-words text-sm text-gray-700 dark:text-gray-200">
                {{ contactInfo }}
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@/components/icons'
import AppLayout from '@/components/layout/AppLayout.vue'
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
const subscriptionGroupBillingEnabled = ref(false)
const passwordFormExpanded = ref(false)

onMounted(async () => {
  const profileRefresh = authStore.refreshUser().catch((error) => {
    console.error('Failed to refresh profile:', error)
  })

  const settingsLoad = appStore.fetchPublicSettings()
    .then((settings) => {
      if (!settings) {
        return
      }
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
      subscriptionGroupBillingEnabled.value = settings.subscription_group_billing_enabled === true
    })
    .catch((error) => {
      console.error('Failed to load settings:', error)
    })

  await Promise.all([profileRefresh, settingsLoad])
})
</script>
