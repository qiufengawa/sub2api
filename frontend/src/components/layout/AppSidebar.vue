<template>
  <aside
    id="app-sidebar"
    ref="sidebarRef"
    tabindex="-1"
    class="app-sidebar"
    :class="{
      'app-sidebar--collapsed': sidebarCollapsed,
      'app-sidebar--mobile-closed': !mobileOpen
    }"
    :inert="isMobileViewport && !mobileOpen ? true : undefined"
    :aria-hidden="isMobileViewport && !mobileOpen ? 'true' : undefined"
  >
    <!-- Brand -->
    <div class="sidebar-header" :class="{ 'sidebar-header-collapsed': sidebarCollapsed }">
      <div
        class="sidebar-brand"
        :class="{ 'sidebar-brand-collapsed': sidebarCollapsed }"
        :aria-hidden="sidebarCollapsed ? 'true' : 'false'"
      >
        <router-link
          v-show="!sidebarCollapsed"
          :to="homePath"
          class="sidebar-brand-title ui-focus-ring"
          :title="siteName"
          :tabindex="sidebarCollapsed ? -1 : undefined"
          @click="handleMenuItemClick(homePath)"
        >
          <img
            v-if="siteLogo"
            :src="siteLogo"
            :alt="siteName"
            class="sidebar-brand-logo"
          />
          <span v-else>{{ siteName }}</span>
        </router-link>
      </div>
    </div>

    <!-- Navigation -->
    <nav ref="sidebarNavRef" class="sidebar-nav scrollbar-hide">
      <!-- Admin View: Admin menu first, then personal menu -->
      <template v-if="isAdmin">
        <!-- Admin Section -->
        <div class="sidebar-section">
          <template v-for="item in adminNavItems" :key="item.path">
            <!-- Collapsible group (has children) -->
            <template v-if="item.children?.length">
              <button
                type="button"
                class="sidebar-link sidebar-link--button"
                :class="{
                  'sidebar-link-active': isGroupActive(item) && !isGroupExpanded(item),
                  'sidebar-link-collapsed': sidebarCollapsed
                }"
                :title="sidebarCollapsed ? item.label : undefined"
                :aria-label="item.label"
                :aria-expanded="isGroupExpanded(item)"
                @click="handleGroupClick(item)"
              >
                <Icon :name="item.icon" size="sm" />
                <span
                  class="sidebar-label sidebar-label-flex"
                  :class="{ 'sidebar-label-collapsed': sidebarCollapsed }"
                  :aria-hidden="sidebarCollapsed ? 'true' : 'false'"
                >
                  <span class="sidebar-label__text">{{ item.label }}</span>
                  <Icon
                    name="chevronDown"
                    size="xs"
                    class="sidebar-group-chevron"
                    :class="{ 'is-expanded': isGroupExpanded(item) }"
                  />
                </span>
              </button>
              <!-- Children -->
              <div v-if="!sidebarCollapsed && isGroupExpanded(item)" class="sidebar-children">
                <UiNavItem
                  v-for="child in item.children"
                  :key="child.path"
                  :to="navTarget(child)"
                  class="sidebar-child-item"
                  :label="child.label"
                  :active="route.path === child.path"
                  @click="handleMenuItemClick(child.path)"
                >
                  <template #icon><Icon :name="child.icon" size="xs" /></template>
                </UiNavItem>
              </div>
            </template>
            <!-- Normal item (no children) -->
            <UiNavItem
              v-else
              :to="navTarget(item)"
              class="sidebar-nav-item"
              :label="item.label"
              :active="isActive(item.path)"
              :collapsed="sidebarCollapsed"
              :id="
                item.path === '/admin/accounts'
                  ? 'sidebar-channel-manage'
                  : item.path === '/admin/groups'
                    ? 'sidebar-group-manage'
                    : item.path === '/admin/redeem'
                      ? 'sidebar-wallet'
                      : undefined
              "
              @click="handleMenuItemClick(item.path)"
            >
              <template #icon><Icon :name="item.icon" size="sm" /></template>
            </UiNavItem>
          </template>
        </div>

        <!-- Personal Section for Admin (hidden in simple mode) -->
        <div v-if="!authStore.isSimpleMode" class="sidebar-section">
          <div class="sidebar-section-title" :class="{ 'sidebar-section-title-collapsed': sidebarCollapsed }" :aria-hidden="sidebarCollapsed ? 'true' : 'false'">
            <span class="sidebar-section-title-text" :class="{ 'sidebar-section-title-text-collapsed': sidebarCollapsed }">
              {{ t('nav.myAccount') }}
            </span>
          </div>

          <UiNavItem
            v-for="item in personalNavItems"
            :key="item.path"
            :to="navTarget(item)"
            class="sidebar-nav-item"
            :label="item.label"
            :active="isActive(item.path)"
            :collapsed="sidebarCollapsed"
            :data-tour="item.path === '/keys' ? 'sidebar-my-keys' : undefined"
            @click="handleMenuItemClick(item.path)"
          >
            <template #icon><Icon :name="item.icon" size="sm" /></template>
          </UiNavItem>
        </div>
      </template>

      <!-- Regular User View -->
      <template v-else-if="!appStore.backendModeEnabled">
        <div class="sidebar-section">
          <UiNavItem
            v-for="item in userNavItems"
            :key="item.path"
            :to="navTarget(item)"
            class="sidebar-nav-item"
            :label="item.label"
            :active="isActive(item.path)"
            :collapsed="sidebarCollapsed"
            :data-tour="item.path === '/keys' ? 'sidebar-my-keys' : undefined"
            @click="handleMenuItemClick(item.path)"
          >
            <template #icon><Icon :name="item.icon" size="sm" /></template>
          </UiNavItem>
        </div>
      </template>
    </nav>

    <!-- Bottom Section -->
    <div class="sidebar-footer">
      <div
        v-if="!sidebarCollapsed"
        class="sidebar-version"
      >
        <span>
          {{ t('version.currentVersion') }}
        </span>
        <VersionBadge :version="siteVersion" placement="top" />
      </div>

      <!-- Theme Toggle -->
      <UiNavItem
        class="sidebar-footer-item"
        :label="isDark ? t('nav.lightMode') : t('nav.darkMode')"
        :collapsed="sidebarCollapsed"
        @click="toggleTheme"
      >
        <template #icon><Icon :name="isDark ? 'sun' : 'moon'" size="sm" /></template>
      </UiNavItem>

      <!-- Collapse Button -->
      <UiNavItem
        class="sidebar-footer-item"
        :label="sidebarCollapsed ? t('nav.expand') : t('nav.collapse')"
        :collapsed="sidebarCollapsed"
        @click="toggleSidebar"
      >
        <template #icon><Icon :name="sidebarCollapsed ? 'arrowRight' : 'arrowLeft'" size="sm" /></template>
      </UiNavItem>
    </div>
  </aside>

  <!-- Mobile Overlay -->
  <transition name="fade">
    <div
      v-if="mobileOpen"
      class="sidebar-backdrop"
      aria-hidden="true"
      @click="closeMobile"
    ></div>
  </transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminSettingsStore, useAppStore, useAuthStore, useOnboardingStore } from '@/stores'
import VersionBadge from '@/components/common/VersionBadge.vue'
import Icon from '@/components/icons/Icon.vue'
import { UiNavItem } from '@/components/ui'
import { FeatureFlags, makeSidebarFlag } from '@/utils/featureFlags'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'

type SidebarIconName = InstanceType<typeof Icon>['$props']['name']

interface NavItem {
  path: string
  label: string
  icon: SidebarIconName
  query?: Record<string, string>
  hideInSimpleMode?: boolean
  children?: NavItem[]
  /**
   * When true, the parent item only toggles the expand/collapse state and
   * does NOT navigate to its `path`. The `path` is purely a stable key.
   */
  expandOnly?: boolean
  /**
   * 可选的功能开关 getter。返回 false 时菜单项被隐藏；返回 undefined/true 时显示。
   * 宽容策略（undefined → 显示）避免 public settings 未加载完成时菜单闪烁消失。
   * Getter 里访问的 reactive 来源（store / composable）会被 computed 自动追踪，
   * 开关切换时菜单自动更新。
   */
  featureFlag?: () => boolean | undefined
}

// applyFeatureFlags 递归过滤掉 featureFlag() === false 的节点（含子节点）。
// 使用 `!== false` 宽容语义：undefined（设置未加载）或 true 都视为显示。
function applyFeatureFlags(items: NavItem[]): NavItem[] {
  const out: NavItem[] = []
  for (const item of items) {
    if (item.featureFlag && item.featureFlag() === false) continue
    if (item.children) {
      out.push({ ...item, children: applyFeatureFlags(item.children) })
    } else {
      out.push(item)
    }
  }
  return out
}

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const onboardingStore = useOnboardingStore()
const adminSettingsStore = useAdminSettingsStore()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const mobileOpen = computed(() => appStore.mobileOpen)
const isMobileViewport = ref(
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 1023px)').matches
    : false,
)
const isAdmin = computed(() => authStore.isAdmin)
const sidebarNavRef = ref<HTMLElement | null>(null)
const sidebarRef = ref<HTMLElement | null>(null)
const isDark = ref(document.documentElement.classList.contains('dark'))
let mobileViewportMediaQuery: MediaQueryList | null = null
let mobileReturnFocus: HTMLElement | null = null
let mobileFocusRequest = 0

function syncMobileViewport(event?: MediaQueryListEvent): void {
  const next = event?.matches ?? mobileViewportMediaQuery?.matches ?? false
  const wasMobile = isMobileViewport.value
  isMobileViewport.value = next

  // A mobile drawer can remain open while the viewport is resized to desktop.
  // Clear the mobile focus transaction and close the drawer at that boundary so
  // a later mobile reopen never restores focus to a stale desktop element.
  if (wasMobile && !next) {
    mobileFocusRequest += 1
    mobileReturnFocus = null
    if (mobileOpen.value) appStore.setMobileOpen(false)
  }
}

const homePath = computed(() => (isAdmin.value ? '/admin/dashboard' : '/dashboard'))

// Track which parent nav groups are expanded
const expandedGroups = ref<Set<string>>(new Set())

// Site settings from appStore (cached, no flicker)
const siteName = computed(() => appStore.siteName)
const siteLogo = computed(() => appStore.siteLogo)
const siteVersion = computed(() => appStore.siteVersion)

// Navigation icons use the shared Lucide registry.
// Public-settings flags go through the registry in utils/featureFlags.ts,
// which handles the opt-in vs opt-out fallback when settings haven't loaded
// yet. Admin-only flags (not in public settings) stay inline below.
const flagChannelMonitor = makeSidebarFlag(FeatureFlags.channelMonitor)
const flagPayment = makeSidebarFlag(FeatureFlags.payment)
const flagAvailableChannels = makeSidebarFlag(FeatureFlags.availableChannels)
const flagModelPlaza = makeSidebarFlag(FeatureFlags.modelPlaza)
const flagPlayground = makeSidebarFlag(FeatureFlags.playground)
const flagAffiliate = makeSidebarFlag(FeatureFlags.affiliate)
const flagRiskControl = makeSidebarFlag(FeatureFlags.riskControl)
const flagOpsMonitoring = () => adminSettingsStore.opsMonitoringEnabled
const flagAdminPayment = () => adminSettingsStore.paymentEnabled
const flagBatchImageAccess = () => canUseBatchImage.value

function createModelPlazaNavItem(): NavItem {
  return {
    path: '/model-plaza',
    label: t('nav.modelPlaza'),
    icon: 'cube',
    query: { embedded: '1' },
    featureFlag: flagModelPlaza
  }
}

// buildSelfNavItems 构造用户自己的导航项（用户端主菜单和管理员的"我的账户"子菜单共享这组声明）。
// withDashboard=true 时仅包含用户仪表盘；管理员主菜单有独立的后台仪表盘入口。
//
// 条目顺序：密钥 → 操练场 → 批量生图 → 用量 → 可用渠道 → 模型广场 → 渠道状态 → 订阅/支付 → 兑换/资料。
// 模型广场属于用户侧的模型选择工具，放在渠道能力与渠道状态之间，不混入后台运维导航。
function buildSelfNavItems(withDashboard: boolean): NavItem[] {
  const items: NavItem[] = []
  if (withDashboard) {
    items.push({ path: '/dashboard', label: t('nav.dashboard'), icon: 'home' })
  }
  items.push(
    { path: '/keys', label: t('nav.apiKeys'), icon: 'key' },
    { path: '/playground', label: t('nav.playground'), icon: 'beaker', featureFlag: flagPlayground },
    { path: '/batch-image', label: t('nav.batchImage'), icon: 'sparkles', hideInSimpleMode: true, featureFlag: flagBatchImageAccess },
    { path: '/usage', label: t('nav.usage'), icon: 'chart', hideInSimpleMode: true },
    { path: '/available-channels', label: t('nav.availableChannels'), icon: 'server', hideInSimpleMode: true, featureFlag: flagAvailableChannels },
    createModelPlazaNavItem(),
    { path: '/monitor', label: t('nav.channelStatus'), icon: 'bolt', featureFlag: flagChannelMonitor },
    { path: '/subscriptions', label: t('nav.mySubscriptions'), icon: 'creditCard', hideInSimpleMode: true },
    { path: '/purchase', label: t('nav.buySubscription'), icon: 'dollar', hideInSimpleMode: true, featureFlag: flagPayment },
    { path: '/orders', label: t('nav.myOrders'), icon: 'document', hideInSimpleMode: true, featureFlag: flagPayment },
    { path: '/redeem', label: t('nav.redeem'), icon: 'gift', hideInSimpleMode: true },
    { path: '/affiliate', label: t('nav.affiliate'), icon: 'users', hideInSimpleMode: true, featureFlag: flagAffiliate },
    { path: '/profile', label: t('nav.profile'), icon: 'user' },
    ...customMenuItemsForUser.value.map((item): NavItem => ({
      path: `/custom/${item.id}`,
      label: item.label,
      icon: 'link',
    })),
  )
  return items
}

// finalizeNav 合并三重过滤：featureFlag 过滤 + simple 模式过滤。
function finalizeNav(items: NavItem[]): NavItem[] {
  const visible = applyFeatureFlags(items)
  return authStore.isSimpleMode ? visible.filter(item => !item.hideInSimpleMode) : visible
}

// User navigation items (for regular users)
const userNavItems = computed((): NavItem[] => finalizeNav(buildSelfNavItems(true)))

// Personal navigation items (for admin's "My Account" section, without Dashboard).
// 可用渠道、模型广场和渠道状态都是用户侧工具，因此管理员也从这个区域访问。
const personalNavItems = computed((): NavItem[] => finalizeNav(buildSelfNavItems(false)))

// Custom menu items filtered by visibility
const customMenuItemsForUser = computed(() => {
  const items = appStore.cachedPublicSettings?.custom_menu_items ?? []
  return items
    .filter((item) => item.visibility === 'user')
    .sort((a, b) => a.sort_order - b.sort_order)
})

const customMenuItemsForAdmin = computed(() => {
  return adminSettingsStore.customMenuItems
    .filter((item) => item.visibility === 'admin')
    .sort((a, b) => a.sort_order - b.sort_order)
})

// Admin navigation items
const adminNavItems = computed((): NavItem[] => {
  const baseItems: NavItem[] = [
    { path: '/admin/dashboard', label: t('nav.dashboard'), icon: 'home' },
    { path: '/admin/ops', label: t('nav.ops'), icon: 'chart', featureFlag: flagOpsMonitoring },
    { path: '/admin/users', label: t('nav.users'), icon: 'users', hideInSimpleMode: true },
    { path: '/admin/groups', label: t('nav.groups'), icon: 'grid', hideInSimpleMode: true },
    {
      path: '/admin/channels',
      label: t('nav.channelManagement'),
      icon: 'server',
      hideInSimpleMode: true,
      expandOnly: true,
      children: [
        { path: '/admin/channels/pricing', label: t('nav.channelPricing'), icon: 'dollar' },
        { path: '/admin/channels/monitor', label: t('nav.channelMonitor'), icon: 'bolt', featureFlag: flagChannelMonitor },
      ],
    },
    { path: '/admin/subscriptions', label: t('nav.subscriptions'), icon: 'creditCard', hideInSimpleMode: true },
    { path: '/admin/accounts', label: t('nav.accounts'), icon: 'globe' },
    { path: '/admin/announcements', label: t('nav.announcements'), icon: 'bell' },
    { path: '/admin/proxies', label: t('nav.proxies'), icon: 'server' },
    {
      path: '/admin/security-audit',
      label: t('nav.securityAudit'),
      icon: 'shield',
      expandOnly: true,
      featureFlag: flagRiskControl,
      children: [
        { path: '/admin/risk-control', label: t('nav.contentModeration'), icon: 'shield' },
        { path: '/admin/prompt-audit', label: t('nav.promptAudit'), icon: 'shield' },
      ],
    },
    { path: '/admin/redeem', label: t('nav.redeemCodes'), icon: 'badge', hideInSimpleMode: true },
    { path: '/admin/promo-codes', label: t('nav.promoCodes'), icon: 'gift', hideInSimpleMode: true },
    {
      path: '/admin/affiliates',
      label: t('nav.affiliateManagement'),
      icon: 'users',
      hideInSimpleMode: true,
      expandOnly: true,
      featureFlag: flagAffiliate,
      children: [
        { path: '/admin/affiliates/invites', label: t('nav.affiliateInviteRecords'), icon: 'users' },
        { path: '/admin/affiliates/rebates', label: t('nav.affiliateRebateRecords'), icon: 'clipboard' },
        { path: '/admin/affiliates/transfers', label: t('nav.affiliateTransferRecords'), icon: 'creditCard' },
      ],
    },
    {
      path: '/admin/orders',
      label: t('nav.orderManagement'),
      icon: 'clipboard',
      hideInSimpleMode: true,
      expandOnly: true,
      featureFlag: flagAdminPayment,
      children: [
        { path: '/admin/orders/dashboard', label: t('nav.paymentDashboard'), icon: 'chart' },
        { path: '/admin/orders', label: t('nav.orderManagement'), icon: 'clipboard' },
        { path: '/admin/orders/plans', label: t('nav.paymentPlans'), icon: 'creditCard' },
      ],
    },
    { path: '/admin/usage', label: t('nav.usage'), icon: 'chart' },
    { path: '/admin/audit-logs', label: t('nav.auditLogs'), icon: 'shield', hideInSimpleMode: true }
  ]

  const visible = applyFeatureFlags(baseItems)

  // 简单模式会隐藏"我的账户"分组，因此在底部用户入口区补充模型广场、API 密钥和操练场。
  if (authStore.isSimpleMode) {
    const filtered = visible.filter(item => !item.hideInSimpleMode)
    filtered.push(...applyFeatureFlags([createModelPlazaNavItem()]))
    filtered.push({ path: '/keys', label: t('nav.apiKeys'), icon: 'key' })
    filtered.push(...applyFeatureFlags([{ path: '/playground', label: t('nav.playground'), icon: 'beaker', featureFlag: flagPlayground }]))
    filtered.push({ path: '/admin/settings', label: t('nav.settings'), icon: 'cog' })
    for (const cm of customMenuItemsForAdmin.value) {
      filtered.push({ path: `/custom/${cm.id}`, label: cm.label, icon: 'link' })
    }
    return filtered
  }

  visible.push({ path: '/admin/settings', label: t('nav.settings'), icon: 'cog' })
  for (const cm of customMenuItemsForAdmin.value) {
    visible.push({ path: `/custom/${cm.id}`, label: cm.label, icon: 'link' })
  }
  return visible
})

function toggleSidebar() {
  appStore.toggleSidebar()
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function closeMobile() {
  appStore.setMobileOpen(false)
}

function focusableSidebarElements(): HTMLElement[] {
  const root = sidebarRef.value
  if (!root) return []
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false
    if (element.closest('[aria-hidden="true"]')) return false
    if (element.hidden) return false
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

function queueMobileFocus(open: boolean): void {
  if (!isMobileViewport.value) return
  const request = ++mobileFocusRequest
  if (open) {
    if (!mobileReturnFocus) {
      const active = document.activeElement
      if (active instanceof HTMLElement && active !== document.body) {
        mobileReturnFocus = active
      } else {
        const trigger = document.getElementById('app-mobile-menu-trigger')
        if (trigger instanceof HTMLElement) mobileReturnFocus = trigger
      }
    }
    void nextTick(() => {
      if (request !== mobileFocusRequest || !mobileOpen.value || !isMobileViewport.value) return
      const first = focusableSidebarElements()[0]
      const target = first || sidebarRef.value
      target?.focus()
    })
    return
  }

  const target = mobileReturnFocus?.isConnected
    ? mobileReturnFocus
    : document.getElementById('app-mobile-menu-trigger')
  mobileReturnFocus = null
  void nextTick(() => {
    if (request !== mobileFocusRequest || mobileOpen.value) return
    if (target instanceof HTMLElement && !target.hasAttribute('disabled')) target.focus()
  })
}

function handleMenuItemClick(itemPath: string) {
  if (mobileOpen.value) {
    setTimeout(() => {
      appStore.setMobileOpen(false)
    }, 150)
  }

  // Map paths to tour selectors
  const pathToSelector: Record<string, string> = {
    '/admin/groups': '#sidebar-group-manage',
    '/admin/accounts': '#sidebar-channel-manage',
    '/keys': '[data-tour="sidebar-my-keys"]'
  }

  const selector = pathToSelector[itemPath]
  if (selector && onboardingStore.isCurrentStep(selector)) {
    onboardingStore.nextStep(500)
  }
}

function navTarget(item: NavItem): string | { path: string; query: Record<string, string> } {
  return item.query ? { path: item.path, query: item.query } : item.path
}

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}

function isGroupActive(item: NavItem): boolean {
  if (!item.children) return false
  return item.children.some(child => route.path === child.path)
}

function isGroupExpanded(item: NavItem): boolean {
  return expandedGroups.value.has(item.path) || isGroupActive(item)
}

function toggleGroup(item: NavItem) {
  if (expandedGroups.value.has(item.path)) {
    expandedGroups.value.delete(item.path)
  } else {
    expandedGroups.value.add(item.path)
  }
}

/**
 * Click handler for collapsible parent items.
 * - When sidebar is collapsed: do nothing (children are not visible).
 * - When `expandOnly` is true: only toggle expand state.
 * - Otherwise (default, e.g. /admin/orders): navigate to the parent path
 *   (router-link semantics) and ensure the group is expanded.
 */
function handleGroupClick(item: NavItem) {
  if (sidebarCollapsed.value) return
  if (item.expandOnly) {
    toggleGroup(item)
    return
  }
  // Push to path and ensure expanded
  if (route.path !== item.path) {
    router.push(item.path)
  }
  if (!expandedGroups.value.has(item.path)) {
    expandedGroups.value.add(item.path)
  }
}

// Initialize theme
const savedTheme = localStorage.getItem('theme')
if (
  savedTheme === 'dark' ||
  (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
) {
  isDark.value = true
  document.documentElement.classList.add('dark')
}

// Fetch admin settings (for feature-gated nav items like Ops).
watch(
  isAdmin,
  (v) => {
    if (v) {
      adminSettingsStore.fetch()
    }
  },
  { immediate: true }
)

watch(
  mobileOpen,
  (isOpen) => {
    document.body.classList.toggle('sidebar-open', isOpen)
  },
  { immediate: true }
)

function handleGlobalKeydown(event: KeyboardEvent) {
  if (!mobileOpen.value || !isMobileViewport.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMobile()
    return
  }
  if (event.key !== 'Tab') return

  const focusable = focusableSidebarElements()
  if (focusable.length === 0) {
    event.preventDefault()
    sidebarRef.value?.focus()
    return
  }
  const current = document.activeElement
  const index = current instanceof HTMLElement ? focusable.indexOf(current) : -1
  if (index < 0) {
    event.preventDefault()
    const target = event.shiftKey ? focusable[focusable.length - 1] : focusable[0]
    target.focus()
  } else if (event.shiftKey && index === 0) {
    event.preventDefault()
    focusable[focusable.length - 1].focus()
  } else if (!event.shiftKey && index === focusable.length - 1) {
    event.preventDefault()
    focusable[0].focus()
  }
}

watch(
  () => [mobileOpen.value, isMobileViewport.value] as const,
  ([open, mobile]) => {
    if (mobile && open) queueMobileFocus(true)
    else if (!open) queueMobileFocus(false)
  },
  { flush: 'post' },
)

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  if (typeof window.matchMedia === 'function') {
    mobileViewportMediaQuery = window.matchMedia('(max-width: 1023px)')
    syncMobileViewport()
    if (mobileViewportMediaQuery.addEventListener) {
      mobileViewportMediaQuery.addEventListener('change', syncMobileViewport)
    } else {
      mobileViewportMediaQuery.addListener?.(syncMobileViewport)
    }
  }
  if (mobileOpen.value && isMobileViewport.value) queueMobileFocus(true)
  void refreshBatchImageAccess()
  if (isAdmin.value) {
    adminSettingsStore.fetch()
  }
  // Restore sidebar scroll position after route change re-mounts the component
  if (appStore.sidebarScrollTop > 0 && sidebarNavRef.value) {
    void nextTick(() => {
      if (sidebarNavRef.value) {
        sidebarNavRef.value.scrollTop = appStore.sidebarScrollTop
      }
    })
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  if (mobileViewportMediaQuery?.removeEventListener) {
    mobileViewportMediaQuery.removeEventListener('change', syncMobileViewport)
  } else {
    mobileViewportMediaQuery?.removeListener?.(syncMobileViewport)
  }
  mobileViewportMediaQuery = null
  mobileFocusRequest += 1
  mobileReturnFocus = null
  document.body.classList.remove('sidebar-open')
  if (sidebarNavRef.value) {
    appStore.sidebarScrollTop = sidebarNavRef.value.scrollTop
  }
})
</script>

<style scoped>
.app-sidebar{position:fixed;z-index:40;inset:0 auto 0 0;display:flex;width:240px;min-width:240px;flex-direction:column;border-right:1px solid var(--ui-border-soft);color:var(--ui-text);background:var(--ui-surface);transition:width var(--ui-motion-base) var(--ui-ease-standard),min-width var(--ui-motion-base) var(--ui-ease-standard),transform var(--ui-motion-base) var(--ui-ease-standard);padding-bottom:env(safe-area-inset-bottom)}
.app-sidebar--collapsed{width:64px;min-width:64px}.sidebar-header{display:flex;min-height:54px;align-items:center;padding:6px 12px;border-bottom:1px solid var(--ui-border-soft)}.sidebar-header-collapsed{padding-inline:8px}.sidebar-brand{display:flex;width:100%;min-width:0;align-items:center;justify-content:center}.sidebar-brand-title{display:flex;width:100%;min-width:0;align-items:center;justify-content:center;color:var(--ui-text);font-size:14px;font-weight:600;text-decoration:none}.sidebar-brand-title:hover{color:var(--ui-text-muted)}.sidebar-brand-logo{display:block;width:min(168px,100%);height:32px;object-fit:contain;object-position:center}.sidebar-brand-collapsed{max-width:0;overflow:hidden;opacity:0;transform:translateX(-4px);pointer-events:none}
.sidebar-nav{min-height:0;flex:1;padding:8px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}.sidebar-section{display:grid;gap:2px;padding:2px 0 8px}.sidebar-section+.sidebar-section{margin-top:4px;padding-top:10px;border-top:1px solid var(--ui-border-soft)}.sidebar-section-title{display:flex;min-height:24px;align-items:center;padding:0 10px;color:var(--ui-text-soft);font-size:10px;font-weight:600;line-height:16px}.sidebar-link{display:flex;min-width:0;min-height:32px;align-items:center;gap:9px;padding:0 10px;border:0;border-radius:var(--ui-radius);color:var(--ui-text-muted);background:transparent;font:inherit;font-size:13px;font-weight:500;line-height:20px;text-align:left;text-decoration:none;cursor:pointer;transition:color var(--ui-motion-fast),background-color var(--ui-motion-fast)}.sidebar-link:hover{color:var(--ui-text);background:var(--ui-surface-muted)}.sidebar-link-active{color:var(--ui-text);background:var(--ui-surface-strong)}.sidebar-link--button{width:100%;margin-top:2px}.sidebar-link-collapsed{justify-content:center;gap:0;padding-inline:0}.sidebar-label{display:block;min-width:0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sidebar-label-flex{display:flex;flex:1;align-items:center;justify-content:space-between;gap:8px}.sidebar-label-collapsed{max-width:0;opacity:0;pointer-events:none}.sidebar-group-chevron{transition:transform var(--ui-motion-fast)}.sidebar-group-chevron.is-expanded{transform:rotate(180deg)}.sidebar-children{display:grid;gap:2px;margin:2px 0 4px 18px;padding-left:7px;border-left:1px solid var(--ui-border)}
:deep(.ui-nav-item.sidebar-nav-item),:deep(.ui-nav-item.sidebar-child-item){
  min-height:32px;
  font-size:13px;
  line-height:20px;
}
.sidebar-child-item{min-height:32px}
.sidebar-label__text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sidebar-footer{margin-top:auto;padding:8px;border-top:1px solid var(--ui-border-soft)}.sidebar-version{display:flex;min-height:30px;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;padding:0 6px 6px;border-bottom:1px solid var(--ui-border-soft);color:var(--ui-text-soft);font-size:10px;font-weight:500}.sidebar-backdrop{position:fixed;z-index:35;inset:0;background:rgb(0 0 0/.34)}
@media(min-width:1024px){.sidebar-backdrop{display:none}}
@media(max-width:1023px){.app-sidebar{box-shadow:12px 0 32px rgb(31 35 41/.12)}.app-sidebar--mobile-closed{transform:translateX(-100%)}}
@media(prefers-reduced-motion:reduce){.app-sidebar,.sidebar-link,.sidebar-group-chevron,.sidebar-label,.sidebar-brand{transition:none}}

</style>
