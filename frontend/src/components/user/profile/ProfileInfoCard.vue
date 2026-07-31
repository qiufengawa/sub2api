<template>
  <section
    data-testid="profile-overview-hero"
    class="grid overflow-hidden rounded border border-gray-200 bg-white md:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)] dark:border-dark-700 dark:bg-dark-800"
  >
    <div class="flex min-w-0 items-center gap-3 border-b border-gray-100 px-4 py-3 md:border-b-0 md:border-r dark:border-dark-700">
      <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-primary-500 text-base font-semibold text-white">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="displayName"
          class="h-full w-full object-cover"
        >
        <span v-else>{{ avatarInitial }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <h2 class="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ displayName }}
          </h2>
          <span :class="['badge shrink-0', user?.role === 'admin' ? 'badge-primary' : 'badge-gray']">
            {{ user?.role === 'admin' ? t('profile.administrator') : t('profile.user') }}
          </span>
          <span :class="['badge shrink-0', user?.status === 'active' ? 'badge-success' : 'badge-danger']">
            {{ user?.status === 'active' ? t('common.active') : t('common.disabled') }}
          </span>
        </div>
        <p class="mt-1 truncate text-xs text-gray-500 dark:text-dark-400">
          {{ primaryEmailDisplay || '-' }}
        </p>
        <p
          v-if="sourceHints.length"
          class="mt-1 truncate text-[10px] text-gray-400 dark:text-dark-500"
          :title="sourceHints.map((hint) => hint.text).join(' · ')"
        >
          {{ sourceHints.map((hint) => hint.text).join(' · ') }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3" data-testid="profile-overview-metrics">
      <div
        data-testid="profile-overview-metric-balance"
        class="min-w-0 border-r border-gray-100 px-3 py-3 sm:px-4 dark:border-dark-700"
      >
        <p class="truncate text-[10px] text-gray-500 sm:text-xs dark:text-dark-400">
          {{ t('profile.accountBalance') }}
        </p>
        <p class="mt-1 truncate text-base font-semibold tabular-nums text-gray-900 dark:text-white">
          {{ formatCurrency(user?.balance || 0) }}
        </p>
      </div>
      <div
        data-testid="profile-overview-metric-concurrency"
        class="min-w-0 px-3 py-3 sm:border-r sm:border-gray-100 sm:px-4 sm:dark:border-dark-700"
      >
        <p class="truncate text-[10px] text-gray-500 sm:text-xs dark:text-dark-400">
          {{ t('profile.concurrencyLimit') }}
        </p>
        <p class="mt-1 truncate text-base font-semibold tabular-nums text-gray-900 dark:text-white">
          {{ user?.concurrency || 0 }}
        </p>
      </div>
      <div
        data-testid="profile-overview-metric-member-since"
        class="col-span-2 min-w-0 border-t border-gray-100 px-3 py-3 sm:col-span-1 sm:border-t-0 sm:px-4 dark:border-dark-700"
      >
        <p class="truncate text-[10px] text-gray-500 sm:text-xs dark:text-dark-400">
          {{ t('profile.memberSince') }}
        </p>
        <p class="mt-1 truncate text-base font-semibold text-gray-900 dark:text-white">
          {{ memberSinceLabel }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { User, UserAuthBindingStatus, UserAuthProvider, UserProfileSourceContext } from '@/types'

const props = withDefaults(defineProps<{
  user: User | null
  linuxdoEnabled?: boolean
  dingtalkEnabled?: boolean
  oidcEnabled?: boolean
  oidcProviderName?: string
  wechatEnabled?: boolean
  wechatOpenEnabled?: boolean
  wechatMpEnabled?: boolean
}>(), {
  linuxdoEnabled: false,
  dingtalkEnabled: false,
  oidcEnabled: false,
  oidcProviderName: 'OIDC',
  wechatEnabled: false,
  wechatOpenEnabled: undefined,
  wechatMpEnabled: undefined,
})

const { t } = useI18n()

function normalizeBindingStatus(binding: boolean | UserAuthBindingStatus | undefined): boolean | null {
  if (typeof binding === 'boolean') {
    return binding
  }
  if (!binding) {
    return null
  }
  if (typeof binding.bound === 'boolean') {
    return binding.bound
  }
  return Boolean(binding.provider_subject || binding.issuer || binding.provider_key)
}

function isEmailBound(user: User | null | undefined): boolean {
  if (typeof user?.email_bound === 'boolean') {
    return user.email_bound
  }

  const nested = user?.auth_bindings?.email ?? user?.identity_bindings?.email
  const normalized = normalizeBindingStatus(nested)
  return normalized ?? false
}

const avatarUrl = computed(() => props.user?.avatar_url?.trim() || '')
const displayName = computed(() => props.user?.username?.trim() || props.user?.email?.trim() || t('profile.user'))
const primaryEmailDisplay = computed(() => {
  const email = props.user?.email?.trim() || ''
  if (!email) {
    return ''
  }
  if (email.endsWith('.invalid') && !isEmailBound(props.user)) {
    return ''
  }
  return email
})
const avatarInitial = computed(() => displayName.value.charAt(0).toUpperCase() || 'U')
const memberSinceLabel = computed(() => {
  const raw = props.user?.created_at?.trim()
  if (!raw) {
    return '-'
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
  }).format(date)
})

const providerLabels = computed<Record<UserAuthProvider, string>>(() => ({
  email: t('profile.authBindings.providers.email'),
  linuxdo: t('profile.authBindings.providers.linuxdo'),
  dingtalk: t('profile.authBindings.providers.dingtalk'),
  oidc: t('profile.authBindings.providers.oidc', { providerName: props.oidcProviderName }),
  wechat: t('profile.authBindings.providers.wechat'),
  github: 'GitHub',
  google: 'Google'
}))

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

function normalizeProvider(value: string): UserAuthProvider | null {
  const normalized = value.trim().toLowerCase()
  if (
    normalized === 'email' ||
    normalized === 'linuxdo' ||
    normalized === 'wechat' ||
    normalized === 'github' ||
    normalized === 'google'
  ) {
    return normalized
  }
  if (normalized === 'oidc' || normalized.startsWith('oidc:') || normalized.startsWith('oidc/')) {
    return 'oidc'
  }
  return null
}

function readObjectString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function resolveThirdPartySource(
  rawSource: string | UserProfileSourceContext | null | undefined
): { provider: UserAuthProvider; label: string } | null {
  if (!rawSource) {
    return null
  }

  if (typeof rawSource === 'string') {
    const provider = normalizeProvider(rawSource)
    if (!provider || provider === 'email') {
      return null
    }
    return {
      provider,
      label: providerLabels.value[provider]
    }
  }

  const sourceRecord = rawSource as Record<string, unknown>
  const provider = normalizeProvider(
    readObjectString(sourceRecord, 'provider', 'source', 'provider_type', 'auth_provider')
  )
  if (!provider || provider === 'email') {
    return null
  }

  const explicitLabel = readObjectString(
    sourceRecord,
    'provider_label',
    'label',
    'provider_name',
    'providerName'
  )

  return {
    provider,
    label: explicitLabel || providerLabels.value[provider]
  }
}

const sourceHints = computed(() => {
  const currentUser = props.user
  if (!currentUser) {
    return []
  }

  const hints: Array<{ key: string; text: string }> = []
  const avatarSource = resolveThirdPartySource(
    currentUser.profile_sources?.avatar ?? currentUser.avatar_source
  )
  const usernameSource = resolveThirdPartySource(
    currentUser.profile_sources?.username ??
      currentUser.profile_sources?.display_name ??
      currentUser.profile_sources?.nickname ??
      currentUser.display_name_source ??
      currentUser.username_source ??
      currentUser.nickname_source
  )

  if (avatarSource) {
    hints.push({
      key: 'avatar',
      text: t('profile.authBindings.source.avatar', { providerName: avatarSource.label })
    })
  }

  if (usernameSource) {
    hints.push({
      key: 'username',
      text: t('profile.authBindings.source.username', { providerName: usernameSource.label })
    })
  }

  return hints
})
</script>
