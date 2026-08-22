<template>
  <header class="app-header">
    <div class="app-header__inner">
      <div class="app-header__identity">
        <UiIconButton
          class="app-header__menu-trigger"
          icon="menu"
          variant="ghost"
          density="compact"
          id="app-mobile-menu-trigger"
          aria-controls="app-sidebar"
          :aria-expanded="appStore.mobileOpen"
          :label="t('common.toggleMenu')"
          @click="toggleMobileSidebar"
        />
        <div class="app-header__heading">
          <h1>{{ pageTitle }}</h1>
          <p v-if="pageDescription">{{ pageDescription }}</p>
        </div>
      </div>

      <div class="app-header__actions">
        <AnnouncementBell v-if="user" />

        <a
          v-if="docUrl"
          class="app-header__action-link ui-focus-ring"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="book" size="sm" />
          <span>{{ t('nav.docs') }}</span>
        </a>

        <LocaleSwitcher compact />

        <div v-if="user" class="app-header__account-summary">
          <UiPopover
            placement="bottom-end"
            panel-role="dialog"
            :aria-label="balanceAvailableText"
            width="224px"
          >
            <template #trigger="{ open }">
              <button
                type="button"
                class="app-header__balance-trigger ui-focus-ring"
                :aria-expanded="open"
                :aria-label="balanceAvailableText"
                aria-haspopup="dialog"
              >
                <Icon name="dollar" size="sm" />
                <span class="app-header__balance-copy">
                  <strong>{{ formatHeaderMoney(availableBalance) }}</strong>
                  <small>
                    {{ balanceAvailableText }}
                    <i v-if="frozenBalance > 0" :title="balanceFrozenLabel" />
                  </small>
                </span>
              </button>
            </template>

            <template #default>
              <div class="app-header__balance-panel">
                <dl>
                  <div>
                    <dt>{{ balanceAvailableText }}</dt>
                    <dd>{{ formatHeaderMoney(availableBalance) }}</dd>
                  </div>
                  <div>
                    <dt>{{ balanceFrozenText }}</dt>
                    <dd class="is-warning">{{ formatHeaderMoney(frozenBalance) }}</dd>
                  </div>
                  <div class="is-total">
                    <dt>{{ balanceTotalText }}</dt>
                    <dd>{{ formatHeaderMoney(totalBalance) }}</dd>
                  </div>
                </dl>
              </div>
            </template>
          </UiPopover>

          <SubscriptionProgressMini />
        </div>

        <UiPopover
          v-if="user"
          placement="bottom-end"
          panel-role="menu"
          :aria-label="t('common.userMenu')"
          width="240px"
        >
          <template #trigger="{ open }">
            <button
              type="button"
              class="app-header__user-trigger ui-focus-ring"
              :aria-label="t('common.userMenu')"
              :aria-expanded="open"
              aria-haspopup="menu"
            >
              <UiAvatar :name="displayName" :src="avatarUrl || undefined" size="md" />
              <span class="app-header__user-copy">
                <strong :title="displayName">{{ displayName }}</strong>
                <small>{{ roleLabel }}</small>
              </span>
              <Icon name="chevronDown" size="xs" />
            </button>
          </template>

          <template #default="{ close }">
            <div class="app-header__user-menu">
              <div class="app-header__user-summary">
                <strong>{{ displayName }}</strong>
                <span>{{ user.email }}</span>
              </div>

              <RouterLink
                to="/subscriptions"
                class="app-header__mobile-fact"
                role="menuitem"
                @click="close"
              >
                <span><Icon name="creditCard" size="sm" />{{ t('nav.mySubscriptions') }}</span>
                <strong>{{ activeSubscriptionCount }}</strong>
              </RouterLink>

              <div class="app-header__mobile-balance">
                <span>{{ t('common.balance') }}</span>
                <strong>{{ formatHeaderMoney(availableBalance) }}</strong>
                <small v-if="frozenBalance > 0">{{ balanceFrozenText }} {{ formatHeaderMoney(frozenBalance) }}</small>
              </div>

              <nav class="app-header__menu-group" :aria-label="t('common.userMenu')">
                <RouterLink to="/profile" role="menuitem" @click="close">
                  <Icon name="user" size="sm" />{{ t('nav.profile') }}
                </RouterLink>
                <RouterLink to="/keys" role="menuitem" @click="close">
                  <Icon name="key" size="sm" />{{ t('nav.apiKeys') }}
                </RouterLink>
                <a
                  v-if="authStore.isAdmin"
                  href="https://github.com/qiufengawa/sub2api"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  @click="close"
                >
                  <Icon name="github" size="sm" />{{ t('nav.github') }}
                </a>
              </nav>

              <div v-if="contactInfo" class="app-header__support">
                <Icon name="headphones" size="sm" />
                <span>{{ t('common.contactSupport') }}</span>
                <strong>{{ contactInfo }}</strong>
              </div>

              <div v-if="showOnboardingButton" class="app-header__menu-group app-header__menu-group--separated">
                <button type="button" role="menuitem" @click="handleReplayGuide(close)">
                  <Icon name="questionCircle" size="sm" />{{ $t('onboarding.restartTour') }}
                </button>
              </div>

              <div class="app-header__menu-group app-header__menu-group--separated">
                <button type="button" class="is-danger" role="menuitem" @click="handleLogout(close)">
                  <Icon name="logout" size="sm" />{{ t('nav.logout') }}
                </button>
              </div>
            </div>
          </template>
        </UiPopover>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore, useOnboardingStore, useSubscriptionStore } from '@/stores'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import AnnouncementBell from '@/components/common/AnnouncementBell.vue'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import SubscriptionProgressMini from '@/components/common/SubscriptionProgressMini.vue'
import Icon from '@/components/icons/Icon.vue'
import { UiAvatar, UiIconButton, UiPopover } from '@/components/ui'
import { sanitizeUrl } from '@/utils/url'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const adminSettingsStore = useAdminSettingsStore()
const onboardingStore = useOnboardingStore()
const subscriptionStore = useSubscriptionStore()

const user = computed(() => authStore.user)
const contactInfo = computed(() => appStore.contactInfo)
const docUrl = computed(() => sanitizeUrl(appStore.docUrl))
const avatarUrl = computed(() => user.value?.avatar_url?.trim() || '')
const availableBalance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))
const totalBalance = computed(() => availableBalance.value + frozenBalance.value)
const balanceAvailableText = computed(() => t('common.availableBalance') === 'common.availableBalance' ? '可用余额' : t('common.availableBalance'))
const balanceFrozenText = computed(() => t('common.frozenBalance') === 'common.frozenBalance' ? '冻结金额' : t('common.frozenBalance'))
const balanceTotalText = computed(() => t('common.totalBalance') === 'common.totalBalance' ? '总余额' : t('common.totalBalance'))
const balanceFrozenLabel = computed(() => `${balanceFrozenText.value} ${formatHeaderMoney(frozenBalance.value)}`)
const activeSubscriptionCount = computed(() => subscriptionStore.activeSubscriptions.length)
const roleLabel = computed(() => authStore.isAdmin ? t('profile.administrator') : t('profile.user'))
const showOnboardingButton = computed(() => !authStore.isSimpleMode && user.value?.role === 'admin')
const displayName = computed(() => user.value?.username || user.value?.email?.split('@')[0] || '')

const pageTitle = computed(() => {
  if (route.name === 'CustomPage') {
    const id = route.params.id as string
    const publicItems = appStore.cachedPublicSettings?.custom_menu_items ?? []
    const menuItem = publicItems.find(item => item.id === id)
      ?? (authStore.isAdmin ? adminSettingsStore.customMenuItems.find(item => item.id === id) : undefined)
    if (menuItem?.label) return menuItem.label
  }
  const titleKey = route.meta.titleKey as string
  return titleKey ? t(titleKey) : (route.meta.title as string) || ''
})

const pageDescription = computed(() => {
  const descriptionKey = route.meta.descriptionKey as string
  return descriptionKey ? t(descriptionKey) : (route.meta.description as string) || ''
})

function toggleMobileSidebar() {
  appStore.toggleMobileSidebar()
}

async function handleLogout(closeMenu: () => void) {
  closeMenu()
  try {
    await authStore.logout()
  } catch (error) {
    console.error('Logout error:', error)
  }
  await router.push('/login')
}

function handleReplayGuide(closeMenu: () => void) {
  closeMenu()
  onboardingStore.replay()
}

function formatHeaderMoney(value: number) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : '$0.00'
}

</script>

<style scoped>
.app-header{position:sticky;z-index:30;top:0;border-bottom:1px solid var(--ui-border-soft);background:color-mix(in srgb,var(--ui-bg) 92%,transparent);backdrop-filter:blur(12px)}
.app-header__inner{display:flex;min-height:54px;align-items:center;justify-content:space-between;gap:16px;padding:0 20px}
.app-header__identity,.app-header__actions,.app-header__account-summary,.app-header__user-trigger,.app-header__balance-trigger,.app-header__action-link{display:flex;align-items:center}
.app-header__identity{min-width:0;flex:1 1 0;gap:8px}.app-header__menu-trigger{display:none}.app-header__heading{min-width:0}.app-header__heading h1{margin:0;overflow:hidden;color:var(--ui-text);font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}.app-header__heading p{margin:1px 0 0;overflow:hidden;color:var(--ui-text-muted);font-size:11px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}
.app-header__actions{min-width:0;gap:6px}.app-header__action-link{height:32px;gap:6px;padding:0 8px;border-radius:var(--ui-radius);color:var(--ui-text-muted);font-size:12px;text-decoration:none}.app-header__action-link:hover{color:var(--ui-text);background:var(--ui-surface-muted)}
.app-header__account-summary{gap:4px}.app-header__balance-trigger,.app-header__user-trigger{min-height:36px;padding:2px 7px;border:0;border-radius:var(--ui-radius);color:var(--ui-text);background:transparent;text-align:left;cursor:pointer}.app-header__balance-trigger:hover,.app-header__user-trigger:hover{background:var(--ui-surface-muted)}
.app-header__balance-trigger{gap:8px}.app-header__balance-trigger>svg{color:var(--ui-text-muted)}.app-header__balance-copy,.app-header__user-copy{display:grid;min-width:0}.app-header__balance-copy strong,.app-header__user-copy strong{overflow:hidden;font-size:12px;font-weight:600;line-height:16px;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}.app-header__balance-copy small,.app-header__user-copy small{display:flex;align-items:center;gap:4px;color:var(--ui-text-muted);font-size:10px;line-height:14px;white-space:nowrap}.app-header__balance-copy i{width:5px;height:5px;border-radius:50%;background:var(--ui-warning)}
.app-header__user-trigger{max-width:190px;gap:7px}.app-header__user-copy{max-width:116px}.app-header__user-copy small{text-transform:capitalize}.app-header__user-trigger>svg{color:var(--ui-text-soft)}
.app-header__balance-panel{padding:4px 6px}.app-header__balance-panel dl{display:grid;margin:0;gap:8px}.app-header__balance-panel dl>div{display:flex;align-items:center;justify-content:space-between;gap:16px}.app-header__balance-panel dt{color:var(--ui-text-muted);font-size:11px}.app-header__balance-panel dd{margin:0;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}.app-header__balance-panel dd.is-warning{color:var(--ui-warning)}.app-header__balance-panel .is-total{padding-top:8px;border-top:1px solid var(--ui-border-soft)}
.app-header__user-menu{display:grid;min-width:0}.app-header__user-summary{display:grid;gap:2px;padding:8px 9px 10px;border-bottom:1px solid var(--ui-border-soft)}.app-header__user-summary strong{overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.app-header__user-summary span{overflow:hidden;color:var(--ui-text-muted);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.app-header__menu-group{display:grid;padding:5px 0}.app-header__menu-group--separated{border-top:1px solid var(--ui-border-soft)}.app-header__menu-group a,.app-header__menu-group button{display:flex;width:100%;height:32px;align-items:center;gap:8px;padding:0 9px;border:0;border-radius:var(--ui-radius-dense);color:var(--ui-text);background:transparent;font:inherit;font-size:12px;text-align:left;text-decoration:none;cursor:pointer}.app-header__menu-group a:hover,.app-header__menu-group button:hover{background:var(--ui-surface-muted)}.app-header__menu-group .is-danger{color:var(--ui-danger)}
.app-header__support{display:grid;grid-template-columns:16px auto minmax(0,1fr);align-items:center;gap:6px;padding:8px 9px;border-top:1px solid var(--ui-border-soft);color:var(--ui-text-muted);font-size:11px}.app-header__support strong{overflow:hidden;color:var(--ui-text);font-weight:500;text-align:right;text-overflow:ellipsis;white-space:nowrap}
.app-header__mobile-fact,.app-header__mobile-balance{display:none}
@media(max-width:1023px){.app-header__menu-trigger{display:inline-grid}.app-header__inner{padding-inline:12px}}
@media(max-width:767px){.app-header__heading p,.app-header__action-link span,.app-header__account-summary,.app-header__user-copy,.app-header__user-trigger>svg{display:none}.app-header__actions{gap:2px}.app-header__user-trigger{min-width:36px;padding:2px}.app-header__mobile-fact{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px;color:var(--ui-text);font-size:12px;text-decoration:none}.app-header__mobile-fact span{display:flex;align-items:center;gap:7px}.app-header__mobile-fact strong{font-variant-numeric:tabular-nums}.app-header__mobile-balance{display:grid;gap:2px;padding:8px 9px;border-top:1px solid var(--ui-border-soft);color:var(--ui-text-muted);font-size:10px}.app-header__mobile-balance strong{color:var(--ui-text);font-size:13px;font-variant-numeric:tabular-nums}.app-header__mobile-balance small{color:var(--ui-warning)}}
@media(max-width:480px){.app-header__inner{gap:8px;padding-inline:8px}.app-header__heading h1{max-width:118px}.app-header__action-link{display:none}}
</style>
