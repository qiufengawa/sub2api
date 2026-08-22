<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('admin.channels.title', 'Channels')" :description="t('admin.channels.description', 'Manage upstream channel pricing and routing')">
        <template #actions>
          <UiButton density="dense" variant="primary" @click="openCreateDialog">
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('admin.channels.createChannel', 'Create Channel') }}
          </UiButton>
        </template>
      </AppPageHeader>

      <UiServerTableWorkspace :loading="loading" :empty="false">
        <template #toolbar>
          <UiTableToolbar>
            <UiFilterBar>
              <UiSearchInput v-model="searchQuery" density="dense" :placeholder="t('admin.channels.searchChannels', 'Search channels...')" @search="handleSearch" />
              <UiSelect v-model="filters.status" density="dense" :options="statusFilterOptions" :aria-label="t('admin.channels.columns.status', 'Status')" @change="loadChannels" />
            </UiFilterBar>
            <template #actions><UiIconButton icon="refresh" density="dense" :label="t('common.refresh', 'Refresh')" :disabled="loading" @click="loadChannels" /></template>
          </UiTableToolbar>
        </template>

        <UiMobileTableScroller :label="t('admin.channels.title', 'Channels')" min-width="760px">
          <UiDataTable :columns="columns" :data="channels" :loading="loading" :mobile-table="true" :aria-label="t('admin.channels.title', 'Channels')" :server-side-sort="true" default-sort-key="created_at" default-sort-order="desc" @sort="handleSort">
          <template #cell-name="{ value }"><UiDataCell :value="String(value)" /></template>
          <template #cell-description="{ value }"><UiDataCell :value="value || '-'" /></template>
          <template #cell-status="{ row }"><UiSwitch :model-value="row.status === 'active'" :label="row.name" :disabled="channelStatusPendingIds.has(row.id)" @update:model-value="toggleChannelStatus(row)" /></template>
          <template #cell-group_count="{ row }"><UiBadge :label="`${(row.group_ids || []).length} ${t('admin.channels.groupsUnit', 'groups')}`" /></template>
          <template #cell-pricing_count="{ row }"><UiBadge :label="`${(row.model_pricing || []).length} ${t('admin.channels.pricingUnit', 'pricing rules')}`" /></template>
          <template #cell-created_at="{ value }"><UiDataCell :value="formatDate(value)" mono /></template>
          <template #cell-actions="{ row }"><UiButtonGroup><UiIconButton icon="edit" density="dense" variant="ghost" :label="t('common.edit', 'Edit')" @click="openEditDialog(row)" /><UiIconButton icon="trash" density="dense" variant="danger" :label="t('common.delete', 'Delete')" @click="handleDelete(row)" /></UiButtonGroup></template>
          <template #empty><UiEmptyState :title="t('admin.channels.noChannelsYet', 'No Channels Yet')" :description="t('admin.channels.createFirstChannel', 'Create your first channel to manage model pricing')"><template #action><UiButton density="dense" variant="primary" @click="openCreateDialog">{{ t('admin.channels.createChannel', 'Create Channel') }}</UiButton></template></UiEmptyState></template>
          </UiDataTable>
        </UiMobileTableScroller>
        <template #pagination><UiPagination v-if="pagination.total > 0" :page="pagination.page" :total="pagination.total" :page-size="pagination.page_size" :reset-page-on-page-size-change="false" @update:page="handlePageChange" @update:pageSize="handlePageSizeChange" /></template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Create/Edit Dialog -->
    <UiDialog
      :show="showDialog"
      :title="editingChannel ? t('admin.channels.editChannel', 'Edit Channel') : t('admin.channels.createChannel', 'Create Channel')"
      width="extra-wide"
      :close-label="t('common.close')"
      @close="closeDialog"
    >
      <div class="channel-dialog-body">
        <UiTabs v-model="activeTab" :tabs="channelTabOptions" :label="t('admin.channels.form.basicSettings', 'Channel settings')" />

        <!-- Tab Content -->
        <form id="channel-form" @submit.prevent="handleSubmit" class="channel-dialog-form">
          <!-- Basic Settings Tab -->
          <AppStack v-show="activeTab === 'basic'" :gap="12">
            <!-- Name -->
            <UiTextField v-model="form.name" :label="t('admin.channels.form.name', 'Name')" :placeholder="t('admin.channels.form.namePlaceholder', 'Enter channel name')" required />

            <!-- Description -->
            <UiTextArea v-model="form.description" :label="t('admin.channels.form.description', 'Description')" :placeholder="t('admin.channels.form.descriptionPlaceholder', 'Optional description')" :rows="2" />

            <!-- Status (edit only) -->
            <template v-if="editingChannel">
              <UiSelect v-model="form.status" :options="statusEditOptions" :label="t('admin.channels.form.status', 'Status')" />
            </template>

            <!-- Model Restriction -->
            <AppStack :gap="8">
              <UiCheckbox v-model="form.restrict_models" :label="t('admin.channels.form.restrictModels', 'Restrict Models')" />
              <UiAlert tone="info" :message="t('admin.channels.form.restrictModelsHint', 'When enabled, only models in the pricing list are allowed. Others will be rejected.')" />
            </AppStack>

            <!-- Billing Basis -->
            <UiSelect v-model="form.billing_model_source" :options="billingModelSourceOptions" :label="t('admin.channels.form.billingModelSource', 'Billing Basis')" :description="t('admin.channels.form.billingModelSourceHint', 'Controls which model name is used for pricing lookup')" />

            <!-- Platform Management -->
            <AppSection :title="t('admin.channels.form.platformConfig')" divided>
              <AppGrid min="160px" :gap="8">
                <UiCheckbox v-for="p in platformOrder" :key="p" :model-value="activePlatforms.includes(p)" :label="t('admin.groups.platforms.' + p, p)" @update:model-value="togglePlatform(p)" />
              </AppGrid>
            </AppSection>

            <!-- Apply Pricing to Account Stats (toggle only in basic settings) -->
            <AppSection :title="t('admin.channels.form.applyPricingToAccountStats')" :description="t('admin.channels.form.applyPricingToAccountStatsDesc')" divided>
              <template #actions>
                <UiSwitch
                  :label="t('admin.channels.form.applyPricingToAccountStats')"
                  :modelValue="form.apply_pricing_to_account_stats"
                  @update:modelValue="form.apply_pricing_to_account_stats = $event"
                />
              </template>
            </AppSection>
          </AppStack>

          <!-- Platform Tab Content -->
          <AppStack
            v-for="(section, sIdx) in form.platforms"
            :key="'tab-' + section.platform"
            v-show="section.enabled && activeTab === section.platform"
            :gap="12"
          >
            <!-- Groups -->
            <ChannelGroupSelector
              :groups="getGroupsForPlatform(section.platform)"
              :selected-ids="section.group_ids"
              :loading="groupsLoading"
              :is-disabled="isGroupInOtherChannel"
              :disabled-label="getGroupInOtherChannelLabel"
              @toggle="toggleGroupInSection(sIdx, $event)"
            />
            <ChannelPlatformToggles
              :platform="section.platform"
              :web-search-global-enabled="webSearchGlobalEnabled"
              v-model:web-search-emulation="section.web_search_emulation"
              v-model:codex-image-generation-bridge="section.codex_image_generation_bridge"
              v-model:bedrock-cc-compat="section.bedrock_cc_compat"
            />
            <!-- Model Mapping -->
            <ChannelModelMappingEditor
              :mapping="section.model_mapping"
              @add="addMappingEntry(sIdx)"
              @remove="removeMappingEntry(sIdx, $event)"
              @rename="(source, nextSource) => renameMappingKey(sIdx, source, nextSource)"
              @update-target="(source, target) => updateMappingTarget(sIdx, source, target)"
            />
            <!-- Model Pricing -->
            <ChannelModelPricingEditor
              :entries="section.model_pricing"
              :platform="section.platform"
              :syncing="syncingPlatform === section.platform"
              @sync="syncLatestModels(sIdx)"
              @add="addPricingEntry(sIdx)"
              @update="(index, entry) => updatePricingEntry(sIdx, index, entry)"
              @remove="removePricingEntry(sIdx, $event)"
            />
            <!-- Account Stats Pricing Rules -->
            <ChannelAccountStatsRulesEditor
              :rules="section.account_stats_pricing_rules"
              :group-ids="section.group_ids"
              :platform="section.platform"
              :get-group-name="getGroupNameById"
              :get-account-label="getRuleAccountLabel"
              :account-options="(ruleIndex) => getRuleAccountOptions(section.platform, ruleIndex)"
              @add-rule="addAccountStatsRule(sIdx)"
              @remove-rule="removeAccountStatsRule(sIdx, $event)"
              @update-name="(ruleIndex, name) => section.account_stats_pricing_rules[ruleIndex].name = name"
              @toggle-group="(ruleIndex, groupId) => toggleRuleGroup(section.account_stats_pricing_rules[ruleIndex], groupId)"
              @remove-account="(ruleIndex, accountId) => removeRuleAccount(section.account_stats_pricing_rules[ruleIndex], accountId)"
              @search-account="(ruleIndex, query) => onRuleAccountSearchInput(section.platform, ruleIndex, query)"
              @select-account="(ruleIndex, option) => selectRuleAccountOption(section, ruleIndex, option)"
              @add-pricing="addRulePricingEntry(sIdx, $event)"
              @update-pricing="(ruleIndex, pricingIndex, entry) => section.account_stats_pricing_rules[ruleIndex].pricing.splice(pricingIndex, 1, entry)"
              @remove-pricing="(ruleIndex, pricingIndex) => removeRulePricingEntry(sIdx, ruleIndex, pricingIndex)"
            />
          </AppStack>
        </form>
      </div>

      <template #footer>
        <AppInline justify="flex-end">
          <UiButton type="button" density="dense" @click="closeDialog">{{ t('common.cancel', 'Cancel') }}</UiButton>
          <UiButton type="submit" form="channel-form" density="dense" variant="primary" :loading="submitting">
            {{ editingChannel ? t('common.update', 'Update') : t('common.create', 'Create') }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Delete Confirmation -->
    <UiConfirmDialog
      :show="showDeleteDialog"
      :title="t('admin.channels.deleteChannel', 'Delete Channel')"
      :message="deleteConfirmMessage"
      :confirm-text="t('common.delete', 'Delete')"
      :cancel-text="t('common.cancel', 'Cancel')"
      :danger="true"
      :pending="deletePending"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { adminAPI } from '@/api/admin'
import type { Channel, ChannelModelPricing, CreateChannelRequest, UpdateChannelRequest, AccountStatsPricingRule } from '@/api/admin/channels'
import type { PricingFormEntry } from '@/components/admin/channel/types'
import { mTokToPerToken, perTokenToMTok, apiIntervalsToForm, formIntervalsToAPI, findModelConflict, validateIntervals } from '@/components/admin/channel/types'
import type { AdminGroup, GroupPlatform } from '@/types'
import type { Column, UiEntityOption } from '@/components/ui'
import { buildChannelGroupMap, fetchAllChannels } from '@/utils/channelConflict'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import ChannelAccountStatsRulesEditor from '@/components/admin/channel/ChannelAccountStatsRulesEditor.vue'
import ChannelGroupSelector from '@/components/admin/channel/ChannelGroupSelector.vue'
import ChannelModelMappingEditor from '@/components/admin/channel/ChannelModelMappingEditor.vue'
import ChannelModelPricingEditor from '@/components/admin/channel/ChannelModelPricingEditor.vue'
import ChannelPlatformToggles from '@/components/admin/channel/ChannelPlatformToggles.vue'
import {
  AppGrid,
  AppInline,
  AppPage,
  AppPageHeader,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiButtonGroup,
  UiCheckbox,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiFilterBar,
  UiIconButton,
  UiPagination,
  UiMobileTableScroller,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiSwitch,
  UiTableToolbar,
  UiTabs,
  UiTextArea,
  UiTextField,
} from '@/components/ui'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import { useKeyedDebouncedSearch } from '@/composables/useKeyedDebouncedSearch'

const { t } = useI18n()
const appStore = useAppStore()

// Web Search global enabled state (loaded once on mount)
const webSearchGlobalEnabled = ref(false)
async function loadWebSearchGlobalState() {
  try {
    const cfg = await adminAPI.settings.getWebSearchEmulationConfig()
    webSearchGlobalEnabled.value = cfg?.enabled === true && (cfg?.providers?.length ?? 0) > 0
  } catch (err: unknown) {
    console.warn('Failed to load web search global state:', err)
    webSearchGlobalEnabled.value = false
  }
}

// ── Form-level pricing rule type (per-platform) ──
interface FormPricingRule {
  name: string
  group_ids: number[]
  account_ids: number[]
  pricing: PricingFormEntry[]
}

// ── Platform Section type ──
interface PlatformSection {
  platform: GroupPlatform
  enabled: boolean
  collapsed: boolean
  group_ids: number[]
  model_mapping: Record<string, string>
  model_pricing: PricingFormEntry[]
  web_search_emulation: boolean
  codex_image_generation_bridge: boolean
  bedrock_cc_compat: boolean
  account_stats_pricing_rules: FormPricingRule[]
}

// ── Table columns ──
const columns = computed<Column[]>(() => [
  { key: 'name', label: t('admin.channels.columns.name', 'Name'), sortable: true },
  { key: 'description', label: t('admin.channels.columns.description', 'Description'), sortable: false },
  { key: 'status', label: t('admin.channels.columns.status', 'Status'), sortable: true },
  { key: 'group_count', label: t('admin.channels.columns.groups', 'Groups'), sortable: false },
  { key: 'pricing_count', label: t('admin.channels.columns.pricing', 'Pricing'), sortable: false },
  { key: 'created_at', label: t('admin.channels.columns.createdAt', 'Created'), sortable: true },
  { key: 'actions', label: t('admin.channels.columns.actions', 'Actions'), sortable: false }
])

const statusFilterOptions = computed(() => [
  { value: '', label: t('admin.channels.allStatus', 'All Status') },
  { value: 'active', label: t('admin.channels.statusActive', 'Active') },
  { value: 'disabled', label: t('admin.channels.statusDisabled', 'Disabled') }
])

const statusEditOptions = computed(() => [
  { value: 'active', label: t('admin.channels.statusActive', 'Active') },
  { value: 'disabled', label: t('admin.channels.statusDisabled', 'Disabled') }
])

const billingModelSourceOptions = computed(() => [
  { value: 'channel_mapped', label: t('admin.channels.form.billingModelSourceChannelMapped', 'Bill by channel-mapped model') },
  { value: 'requested', label: t('admin.channels.form.billingModelSourceRequested', 'Bill by requested model') },
  { value: 'upstream', label: t('admin.channels.form.billingModelSourceUpstream', 'Bill by final upstream model') },
  { value: 'response_model', label: t('admin.channels.form.billingModelSourceResponse', 'Bill by upstream response model') }
])

// ── State ──
const channels = ref<Channel[]>([])
const loading = ref(false)
const searchQuery = ref('')
const filters = reactive({ status: '' })
const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0
})
const sortState = reactive({
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc'
})

// Dialog state
const showDialog = ref(false)
const editingChannel = ref<Channel | null>(null)
const submitting = ref(false)
const channelStatusPendingIds = ref(new Set<number>())
const showDeleteDialog = ref(false)
const deletingChannel = ref<Channel | null>(null)
const deletePending = ref(false)
const activeTab = ref<string>('basic')

const channelTabOptions = computed(() => [
  { value: 'basic', label: t('admin.channels.form.basicSettings', 'Basic settings') },
  ...form.platforms.filter(section => section.enabled).map(section => ({
    value: section.platform,
    label: t(`admin.groups.platforms.${section.platform}`, section.platform),
  })),
])

// Groups
const allGroups = ref<AdminGroup[]>([])
const groupsLoading = ref(false)

// All channels for group-conflict detection (independent of current page)
const allChannelsForConflict = ref<Channel[]>([])

// Form data
const form = reactive({
  name: '',
  description: '',
  status: 'active',
  restrict_models: false,
  billing_model_source: 'channel_mapped' as string,
  platforms: [] as PlatformSection[],
  apply_pricing_to_account_stats: false,
})

let abortController: AbortController | null = null

// ── Platform config ──
const platformOrder: GroupPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok']

// ── Helpers ──
function formatDate(value: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

// ── Platform section helpers ──
const activePlatforms = computed(() => form.platforms.filter(s => s.enabled).map(s => s.platform))

function addPlatformSection(platform: GroupPlatform) {
  form.platforms.push({
    platform,
    enabled: true,
    collapsed: false,
    group_ids: [],
    model_mapping: {},
    model_pricing: [],
    web_search_emulation: false,
    codex_image_generation_bridge: false,
    bedrock_cc_compat: false,
    account_stats_pricing_rules: [],
  })
}

function togglePlatform(platform: GroupPlatform) {
  const section = form.platforms.find(s => s.platform === platform)
  if (section) {
    section.enabled = !section.enabled
    if (!section.enabled && activeTab.value === platform) {
      activeTab.value = 'basic'
    }
  } else {
    addPlatformSection(platform)
  }
}

function getGroupsForPlatform(platform: GroupPlatform): AdminGroup[] {
  return allGroups.value.filter(g => g.platform === platform || g.platform === 'composite')
}

// ── Group helpers ──
const groupToChannelMap = computed(() => {
  return buildChannelGroupMap(allChannelsForConflict.value, editingChannel.value?.id)
})

function isGroupInOtherChannel(groupId: number, _platform?: string): boolean {
  return groupToChannelMap.value.has(groupId)
}

function getGroupChannelName(groupId: number): string {
  return groupToChannelMap.value.get(groupId)?.name || ''
}

function getGroupInOtherChannelLabel(groupId: number): string {
  const name = getGroupChannelName(groupId)
  return t('admin.channels.form.inOtherChannel', { name }, `In "${name}"`)
}

const deleteConfirmMessage = computed(() => {
  const name = deletingChannel.value?.name || ''
  return t(
    'admin.channels.deleteConfirm',
    { name },
    `Are you sure you want to delete channel "${name}"? This action cannot be undone.`
  )
})

function toggleGroupInSection(sectionIdx: number, groupId: number) {
  const section = form.platforms[sectionIdx]
  const idx = section.group_ids.indexOf(groupId)
  if (idx >= 0) {
    section.group_ids.splice(idx, 1)
  } else {
    section.group_ids.push(groupId)
  }
}

// ── Pricing helpers ──
function addPricingEntry(sectionIdx: number) {
  form.platforms[sectionIdx].model_pricing.push({
    models: [],
    billing_mode: 'token',
    input_price: null,
    output_price: null,
    cache_write_price: null,
    cache_read_price: null,
    image_input_price: null,
    image_output_price: null,
    per_request_price: null,
    intervals: []
  })
}

const syncingPlatform = ref<string | null>(null)

async function syncLatestModels(sectionIdx: number) {
  const platform = form.platforms[sectionIdx].platform
  if (syncingPlatform.value) return
  syncingPlatform.value = platform
  try {
    const result = await adminAPI.channels.syncPricingModels(platform)
    // Collect all model names already present in this platform's pricing entries
    const existingModels = new Set<string>()
    for (const entry of form.platforms[sectionIdx].model_pricing) {
      for (const m of entry.models) existingModels.add(m)
    }
    const newModels = result.models.filter(m => !existingModels.has(m))
    if (newModels.length === 0) {
      appStore.showSuccess(t('admin.channels.form.syncModelsAlreadyUpToDate'))
      return
    }
    // Add new models as a single new pricing entry (user fills in prices)
    form.platforms[sectionIdx].model_pricing.push({
      models: newModels,
      billing_mode: 'token',
      input_price: null,
      output_price: null,
      cache_write_price: null,
      cache_read_price: null,
      image_input_price: null,
      image_output_price: null,
      per_request_price: null,
      intervals: []
    })
    appStore.showSuccess(t('admin.channels.form.syncModelsSuccess', { count: newModels.length }))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.channels.form.syncModelsError')))
  } finally {
    syncingPlatform.value = null
  }
}

function updatePricingEntry(sectionIdx: number, idx: number, updated: PricingFormEntry) {
  form.platforms[sectionIdx].model_pricing.splice(idx, 1, updated)
}

function removePricingEntry(sectionIdx: number, idx: number) {
  form.platforms[sectionIdx].model_pricing.splice(idx, 1)
}

// ── Model Mapping helpers ──
function addMappingEntry(sectionIdx: number) {
  const mapping = form.platforms[sectionIdx].model_mapping
  let key = ''
  let i = 1
  while (key === '' || key in mapping) {
    key = `model-${i}`
    i++
  }
  mapping[key] = ''
}

function removeMappingEntry(sectionIdx: number, key: string) {
  delete form.platforms[sectionIdx].model_mapping[key]
}

function renameMappingKey(sectionIdx: number, oldKey: string, newKey: string) {
  newKey = newKey.trim()
  if (!newKey || newKey === oldKey) return
  const mapping = form.platforms[sectionIdx].model_mapping
  if (newKey in mapping) return
  const value = mapping[oldKey]
  delete mapping[oldKey]
  mapping[newKey] = value
}

function updateMappingTarget(sectionIdx: number, source: string, target: string) {
  form.platforms[sectionIdx].model_mapping[source] = target
}

// ── Account Stats Pricing helpers ──
function addAccountStatsRule(sectionIdx: number) {
  form.platforms[sectionIdx].account_stats_pricing_rules.push({
    name: '',
    group_ids: [],
    account_ids: [],
    pricing: []
  })
}

function addRulePricingEntry(sectionIdx: number, ruleIndex: number) {
  form.platforms[sectionIdx].account_stats_pricing_rules[ruleIndex].pricing.push({
    models: [],
    billing_mode: 'token',
    input_price: null,
    output_price: null,
    cache_write_price: null,
    cache_read_price: null,
    image_input_price: null,
    image_output_price: null,
    per_request_price: null,
    intervals: []
  })
}

function removeAccountStatsRule(sectionIdx: number, ruleIndex: number) {
  form.platforms[sectionIdx].account_stats_pricing_rules.splice(ruleIndex, 1)
  // Clear all search state since indices shift after removal
  ruleAccountSearchRunner.clearAll()
  clearAllRuleAccountSearchState()
}

function removeRulePricingEntry(sectionIdx: number, ruleIndex: number, pricingIndex: number) {
  form.platforms[sectionIdx].account_stats_pricing_rules[ruleIndex].pricing.splice(pricingIndex, 1)
}

function getGroupNameById(groupId: number): string {
  const group = allGroups.value.find(g => g.id === groupId)
  return group ? group.name : `#${groupId}`
}

function toggleRuleGroup(rule: { group_ids: number[] }, groupId: number) {
  const index = rule.group_ids.indexOf(groupId)
  if (index >= 0) rule.group_ids.splice(index, 1)
  else rule.group_ids.push(groupId)
}

// ── Account search for pricing rules ──
interface SimpleAccount { id: number; name: string; platform: string }

const ruleAccountSearchKeyword = ref<Record<string, string>>({})
const ruleAccountSearchResults = ref<Record<string, SimpleAccount[]>>({})
// Cache: account ID → name, populated when search results are selected
const ruleAccountNameCache = ref<Record<number, string>>({})

const ruleAccountSearchRunner = useKeyedDebouncedSearch<SimpleAccount[]>({
  delay: 300,
  search: async (keyword, { key, signal }) => {
    const platform = key.split('-')[0]
    const res = await adminAPI.accounts.list(1, 20, { platform, search: keyword }, { signal })
    return res.items.map(a => ({ id: a.id, name: a.name, platform: a.platform }))
  },
  onSuccess: (key, result) => { ruleAccountSearchResults.value[key] = result },
  onError: (key) => { ruleAccountSearchResults.value[key] = [] },
})

function onRuleAccountSearchInput(platform: string, ruleIndex: number, keyword: string) {
  const key = `${platform}-${ruleIndex}`
  ruleAccountSearchKeyword.value[key] = keyword
  ruleAccountSearchRunner.trigger(key, keyword)
}

function selectRuleAccount(
  rule: { account_ids: number[] },
  account: SimpleAccount,
  platform: string,
  ruleIndex: number,
) {
  if (!rule.account_ids.includes(account.id)) {
    rule.account_ids.push(account.id)
    ruleAccountNameCache.value[account.id] = account.name
  }
  const key = `${platform}-${ruleIndex}`
  ruleAccountSearchKeyword.value[key] = ''
}

function removeRuleAccount(rule: { account_ids: number[] }, accountId: number) {
  const idx = rule.account_ids.indexOf(accountId)
  if (idx !== -1) rule.account_ids.splice(idx, 1)
}

function getRuleAccountLabel(accountId: number): string {
  const name = ruleAccountNameCache.value[accountId]
  return name ? `${name} #${accountId}` : `#${accountId}`
}

function getRuleAccountOptions(platform: string, ruleIndex: number): UiEntityOption[] {
  return (ruleAccountSearchResults.value[`${platform}-${ruleIndex}`] || []).map(account => ({
    value: account.id,
    label: account.name,
    description: `#${account.id}`,
  }))
}

function selectRuleAccountOption(
  section: PlatformSection,
  ruleIndex: number,
  option: UiEntityOption,
) {
  const rule = section.account_stats_pricing_rules[ruleIndex]
  if (!rule) return
  selectRuleAccount(
    rule,
    { id: Number(option.value), name: option.label, platform: section.platform },
    section.platform,
    ruleIndex,
  )
}

function clearAllRuleAccountSearchState() {
  ruleAccountSearchKeyword.value = {}
  ruleAccountSearchResults.value = {}
}

function accountStatsRulesToAPI(): AccountStatsPricingRule[] {
  const rules: AccountStatsPricingRule[] = []
  for (const section of form.platforms) {
    if (!section.enabled) continue
    for (const rule of section.account_stats_pricing_rules) {
      rules.push({
        name: rule.name,
        group_ids: rule.group_ids,
        account_ids: rule.account_ids,
        pricing: rule.pricing
          .filter(p => p.models.length > 0)
          .map(p => ({
            platform: section.platform,
            models: p.models,
            billing_mode: p.billing_mode,
            input_price: mTokToPerToken(p.input_price),
            output_price: mTokToPerToken(p.output_price),
            cache_write_price: mTokToPerToken(p.cache_write_price),
            cache_read_price: mTokToPerToken(p.cache_read_price),
            image_input_price: mTokToPerToken(p.image_input_price),
            image_output_price: mTokToPerToken(p.image_output_price),
            per_request_price: p.per_request_price != null && p.per_request_price !== '' ? Number(p.per_request_price) : null,
            intervals: formIntervalsToAPI(p.intervals || [])
          }))
      })
    }
  }
  return rules
}

// ── Form  API conversion ──
function formToAPI(): { group_ids: number[], model_pricing: ChannelModelPricing[], model_mapping: Record<string, Record<string, string>>, features_config: Record<string, unknown> } {
  const group_ids: number[] = []
  const model_pricing: ChannelModelPricing[] = []
  const model_mapping: Record<string, Record<string, string>> = {}
  // Preserve existing features_config fields not managed by the form
  const featuresConfig: Record<string, unknown> = editingChannel.value?.features_config
    ? { ...editingChannel.value.features_config }
    : {}

  for (const section of form.platforms) {
    if (!section.enabled) continue
    group_ids.push(...section.group_ids)

    // Model mapping per platform
    if (Object.keys(section.model_mapping).length > 0) {
      model_mapping[section.platform] = { ...section.model_mapping }
    }

    // Model pricing with platform tag
    for (const entry of section.model_pricing) {
      if (entry.models.length === 0) continue
      model_pricing.push({
        platform: section.platform,
        models: entry.models,
        billing_mode: entry.billing_mode,
        input_price: mTokToPerToken(entry.input_price),
        output_price: mTokToPerToken(entry.output_price),
        cache_write_price: mTokToPerToken(entry.cache_write_price),
        cache_read_price: mTokToPerToken(entry.cache_read_price),
        image_input_price: mTokToPerToken(entry.image_input_price),
        image_output_price: mTokToPerToken(entry.image_output_price),
        per_request_price: entry.per_request_price != null && entry.per_request_price !== '' ? Number(entry.per_request_price) : null,
        intervals: formIntervalsToAPI(entry.intervals || [])
      })
    }
  }
  const uniqueGroupIds = Array.from(new Set(group_ids))

  // Collect web_search_emulation (only anthropic platform supports it)
  // Always write the key so that disabling in the UI correctly sets platform to false,
  // rather than leaving a stale true value from the cloned features_config.
  const wsEmulation: Record<string, boolean> = {}
  for (const section of form.platforms) {
    if (!section.enabled) continue
    if (section.platform === 'anthropic') {
      wsEmulation[section.platform] = !!section.web_search_emulation
    }
  }
  if (Object.keys(wsEmulation).length > 0) {
    featuresConfig.web_search_emulation = wsEmulation
  } else {
    delete featuresConfig.web_search_emulation
  }

  const codexImageGenerationBridge: Record<string, boolean> = {}
  for (const section of form.platforms) {
    if (!section.enabled) continue
    if (section.platform === 'openai') {
      codexImageGenerationBridge[section.platform] = !!section.codex_image_generation_bridge
    }
  }
  if (Object.keys(codexImageGenerationBridge).length > 0) {
    featuresConfig.codex_image_generation_bridge = codexImageGenerationBridge
  } else {
    delete featuresConfig.codex_image_generation_bridge
  }

  const bedrockCCCompat: Record<string, boolean> = {}
  for (const section of form.platforms) {
    if (!section.enabled) continue
    if (section.platform === 'anthropic') {
      bedrockCCCompat[section.platform] = !!section.bedrock_cc_compat
    }
  }
  if (Object.keys(bedrockCCCompat).length > 0) {
    featuresConfig.bedrock_cc_compat = bedrockCCCompat
  } else {
    delete featuresConfig.bedrock_cc_compat
  }

  return { group_ids: uniqueGroupIds, model_pricing, model_mapping, features_config: featuresConfig }
}

function apiToForm(channel: Channel): PlatformSection[] {
  // Build a map: groupID → platform
  const groupPlatformMap = new Map<number, GroupPlatform>()
  for (const g of allGroups.value) {
    groupPlatformMap.set(g.id, g.platform)
  }

  // Determine which platforms are active (from groups + pricing + mapping)
  const activePlatforms = new Set<GroupPlatform>()
  for (const gid of channel.group_ids || []) {
    const p = groupPlatformMap.get(gid)
    if (p === 'composite') {
      platformOrder.forEach(platform => activePlatforms.add(platform))
    } else if (p) {
      activePlatforms.add(p)
    }
  }
  for (const p of channel.model_pricing || []) {
    if (p.platform) activePlatforms.add(p.platform as GroupPlatform)
  }
  for (const p of Object.keys(channel.model_mapping || {})) {
    if (platformOrder.includes(p as GroupPlatform)) activePlatforms.add(p as GroupPlatform)
  }

  // Build sections in platform order
  const sections: PlatformSection[] = []
  for (const platform of platformOrder) {
    if (!activePlatforms.has(platform)) continue

    const groupIds = (channel.group_ids || []).filter(gid => {
      const groupPlatform = groupPlatformMap.get(gid)
      return groupPlatform === platform || groupPlatform === 'composite'
    })
    const mapping = (channel.model_mapping || {})[platform] || {}
    const pricing = (channel.model_pricing || [])
      .filter(p => (p.platform || 'anthropic') === platform)
      .map(p => ({
        models: p.models || [],
        billing_mode: p.billing_mode,
        input_price: perTokenToMTok(p.input_price),
        output_price: perTokenToMTok(p.output_price),
        cache_write_price: perTokenToMTok(p.cache_write_price),
        cache_read_price: perTokenToMTok(p.cache_read_price),
        image_input_price: perTokenToMTok(p.image_input_price),
        image_output_price: perTokenToMTok(p.image_output_price),
        per_request_price: p.per_request_price,
        intervals: apiIntervalsToForm(p.intervals || [])
      } as PricingFormEntry))

    // Read web_search_emulation from features_config
    const fc = channel.features_config
    const wsEmulation = fc?.web_search_emulation as Record<string, boolean> | undefined
    const webSearchEnabled = wsEmulation?.[platform] === true
    const codexImageGenerationBridge = fc?.codex_image_generation_bridge as Record<string, boolean> | undefined
    const codexImageGenerationBridgeEnabled = codexImageGenerationBridge?.[platform] === true
    const bedrockCCCompat = fc?.bedrock_cc_compat
    const bedrockCCCompatEnabled = typeof bedrockCCCompat === 'boolean'
      ? bedrockCCCompat
      : (bedrockCCCompat as Record<string, boolean> | undefined)?.[platform] === true

    sections.push({
      platform,
      enabled: true,
      collapsed: false,
      group_ids: groupIds,
      model_mapping: { ...mapping },
      model_pricing: pricing,
      web_search_emulation: webSearchEnabled,
      codex_image_generation_bridge: codexImageGenerationBridgeEnabled,
      bedrock_cc_compat: bedrockCCCompatEnabled,
      account_stats_pricing_rules: [],
    })
  }

  return sections
}

// ── Load data ──
async function loadChannels() {
  if (abortController) abortController.abort()
  const ctrl = new AbortController()
  abortController = ctrl
  loading.value = true

  try {
    const response = await adminAPI.channels.list(pagination.page, pagination.page_size, {
      status: filters.status || undefined,
      search: searchQuery.value || undefined,
      sort_by: sortState.sort_by,
      sort_order: sortState.sort_order
    }, { signal: ctrl.signal })

    if (ctrl.signal.aborted || abortController !== ctrl) return
    channels.value = response.items || []
    pagination.total = response.total
  } catch (error: unknown) {
    const e = error as { name?: string; code?: string }
    if (ctrl.signal.aborted || abortController !== ctrl || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') return
    appStore.showError(extractApiErrorMessage(error, t('admin.channels.loadError', 'Failed to load channels')))
  } finally {
    if (abortController === ctrl) {
      loading.value = false
      abortController = null
    }
  }
}

async function loadGroups() {
  groupsLoading.value = true
  try {
    allGroups.value = await adminAPI.groups.getAll()
  } catch (error) {
    console.error('Error loading groups:', error)
  } finally {
    groupsLoading.value = false
  }
}

async function loadAllChannelsForConflict(): Promise<boolean> {
  try {
    allChannelsForConflict.value = await fetchAllChannels((page, pageSize) => (
      adminAPI.channels.list(page, pageSize)
    ))
    return true
  } catch (error) {
    allChannelsForConflict.value = []
    appStore.showError(
      extractApiErrorMessage(error, t('admin.channels.loadError', 'Failed to load channels'))
    )
    return false
  }
}

let searchTimeout: ReturnType<typeof setTimeout>
function handleSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    pagination.page = 1
    loadChannels()
  }, 300)
}

function handlePageChange(page: number) {
  pagination.page = page
  loadChannels()
}

function handlePageSizeChange(pageSize: number) {
  pagination.page_size = pageSize
  pagination.page = 1
  loadChannels()
}

function handleSort(key: string, order: 'asc' | 'desc') {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  loadChannels()
}

// ── Dialog ──
function resetForm() {
  form.name = ''
  form.description = ''
  form.status = 'active'
  form.restrict_models = false
  form.billing_model_source = 'channel_mapped'
  form.platforms = []
  form.apply_pricing_to_account_stats = false
  activeTab.value = 'basic'
  ruleAccountSearchRunner.clearAll()
  clearAllRuleAccountSearchState()
  ruleAccountNameCache.value = {}
}

async function openCreateDialog() {
  editingChannel.value = null
  resetForm()
  const [, conflictsLoaded] = await Promise.all([loadGroups(), loadAllChannelsForConflict()])
  if (!conflictsLoaded) return
  showDialog.value = true
}

async function openEditDialog(channel: Channel) {
  editingChannel.value = channel
  form.name = channel.name
  form.description = channel.description || ''
  form.status = channel.status
  form.restrict_models = channel.restrict_models || false
  form.billing_model_source = channel.billing_model_source || 'channel_mapped'
  form.apply_pricing_to_account_stats = channel.apply_pricing_to_account_stats || false
  // Must load groups first so apiToForm can map groupID → platform
  const [, conflictsLoaded] = await Promise.all([loadGroups(), loadAllChannelsForConflict()])
  if (!conflictsLoaded) return
  form.platforms = apiToForm(channel)

  // Distribute channel-level rules into per-platform sections
  distributeRulesToPlatforms(channel.account_stats_pricing_rules || [])

  // Populate ruleAccountNameCache for existing rule accounts
  await populateRuleAccountNameCache()

  showDialog.value = true
}

/** Distribute flat channel-level rules into the matching platform section based on group_ids */
function distributeRulesToPlatforms(apiRules: AccountStatsPricingRule[]) {
  // Build groupID → platform lookup
  const groupPlatformMap = new Map<number, GroupPlatform>()
  for (const g of allGroups.value) {
    groupPlatformMap.set(g.id, g.platform)
  }

  for (const apiRule of apiRules) {
    // Infer platform from group_ids
    const platforms = new Set<GroupPlatform>()
    for (const gid of apiRule.group_ids || []) {
      const p = groupPlatformMap.get(gid)
      if (p && p !== 'composite') platforms.add(p)
    }
    // If pricing has a platform field, use that as fallback
    if (platforms.size === 0 && apiRule.pricing?.length > 0) {
      const p = apiRule.pricing[0].platform as GroupPlatform | undefined
      if (p) platforms.add(p)
    }
    const targetPlatform = platforms.size >= 1 ? [...platforms][0] : null
    if (!targetPlatform) continue

    const section = form.platforms.find(s => s.platform === targetPlatform)
    if (!section) continue

    const formRule: FormPricingRule = {
      name: apiRule.name || '',
      group_ids: [...(apiRule.group_ids || [])],
      account_ids: [...(apiRule.account_ids || [])],
      pricing: (apiRule.pricing || []).map(p => ({
        models: [...(p.models || [])],
        billing_mode: p.billing_mode,
        input_price: perTokenToMTok(p.input_price),
        output_price: perTokenToMTok(p.output_price),
        cache_write_price: perTokenToMTok(p.cache_write_price),
        cache_read_price: perTokenToMTok(p.cache_read_price),
        image_input_price: perTokenToMTok(p.image_input_price),
        image_output_price: perTokenToMTok(p.image_output_price),
        per_request_price: p.per_request_price,
        intervals: apiIntervalsToForm(p.intervals || [])
      } as PricingFormEntry))
    }
    section.account_stats_pricing_rules.push(formRule)
  }
}

/** Populate ruleAccountNameCache by fetching account details for all account_ids in rules */
async function populateRuleAccountNameCache() {
  const allAccountIds = new Set<number>()
  for (const section of form.platforms) {
    for (const rule of section.account_stats_pricing_rules) {
      for (const id of rule.account_ids) {
        allAccountIds.add(id)
      }
    }
  }
  if (allAccountIds.size === 0) return

  // Fetch account details in parallel (batch of individual getById calls)
  const ids = [...allAccountIds]
  const results = await Promise.allSettled(
    ids.map(id => adminAPI.accounts.getById(id))
  )
  for (let i = 0; i < ids.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      ruleAccountNameCache.value[ids[i]] = result.value.name
    }
    // If rejected, the cache won't have the name, so it'll show "#ID" which is acceptable
  }
}

function closeDialog() {
  showDialog.value = false
  editingChannel.value = null
  resetForm()
}

async function handleSubmit() {
  if (submitting.value) return
  if (!form.name.trim()) {
    appStore.showError(t('admin.channels.nameRequired', 'Please enter a channel name'))
    return
  }

  // Check for pricing entries with empty models (would be silently skipped)
  for (const section of form.platforms.filter(s => s.enabled)) {
    if (section.group_ids.length === 0) {
      const platformLabel = t('admin.groups.platforms.' + section.platform, section.platform)
      appStore.showError(t('admin.channels.noGroupsSelected', { platform: platformLabel }))
      activeTab.value = section.platform
      return
    }
    for (const entry of section.model_pricing) {
      if (entry.models.length === 0) {
        const platformLabel = t('admin.groups.platforms.' + section.platform, section.platform)
        appStore.showError(t('admin.channels.emptyModelsInPricing', { platform: platformLabel }))
        activeTab.value = section.platform
        return
      }
    }
  }

  // Check model pattern conflicts per platform (duplicate / wildcard overlap)
  for (const section of form.platforms.filter(s => s.enabled)) {
    // Collect all pricing models for this platform
    const allModels: string[] = []
    for (const entry of section.model_pricing) {
      allModels.push(...entry.models)
    }
    const pricingConflict = findModelConflict(allModels)
    if (pricingConflict) {
      appStore.showError(
        t('admin.channels.modelConflict',
          { model1: pricingConflict[0], model2: pricingConflict[1] })
      )
      activeTab.value = section.platform
      return
    }
    // Check model mapping source pattern conflicts
    const mappingKeys = Object.keys(section.model_mapping)
    if (mappingKeys.length > 0) {
      const mappingConflict = findModelConflict(mappingKeys)
      if (mappingConflict) {
        appStore.showError(
          t('admin.channels.mappingConflict',
            { model1: mappingConflict[0], model2: mappingConflict[1] })
        )
        activeTab.value = section.platform
        return
      }
    }
  }

  // 校验 per_request/image 模式必须有价格 (只校验启用的平台)
  for (const section of form.platforms.filter(s => s.enabled)) {
    for (const entry of section.model_pricing) {
      if (entry.models.length === 0) continue
      if ((entry.billing_mode === 'per_request' || entry.billing_mode === 'image') &&
          (entry.per_request_price == null || entry.per_request_price === '') &&
          (!entry.intervals || entry.intervals.length === 0)) {
        appStore.showError(t('admin.channels.form.perRequestPriceRequired'))
        return
      }
    }
  }

  // 校验区间合法性（范围、重叠等）
  for (const section of form.platforms.filter(s => s.enabled)) {
    for (const entry of section.model_pricing) {
      if (!entry.intervals || entry.intervals.length === 0) continue
      const intervalErr = validateIntervals(entry.intervals, entry.billing_mode, t)
      if (intervalErr) {
        const platformLabel = t('admin.groups.platforms.' + section.platform, section.platform)
        const modelLabel = entry.models.join(', ') || t('admin.channels.form.unnamed')
        appStore.showError(`${platformLabel} - ${modelLabel}: ${intervalErr}`)
        activeTab.value = section.platform
        return
      }
    }
  }

  const { group_ids, model_pricing, model_mapping, features_config } = formToAPI()

  submitting.value = true
  try {
    if (editingChannel.value) {
      const req: UpdateChannelRequest = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
        group_ids,
        model_pricing,
        model_mapping: Object.keys(model_mapping).length > 0 ? model_mapping : {},
        billing_model_source: form.billing_model_source,
        restrict_models: form.restrict_models,
        features_config,
        apply_pricing_to_account_stats: form.apply_pricing_to_account_stats,
        account_stats_pricing_rules: accountStatsRulesToAPI()
      }
      await adminAPI.channels.update(editingChannel.value.id, req)
      appStore.showSuccess(t('admin.channels.updateSuccess', 'Channel updated'))
    } else {
      const req: CreateChannelRequest = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        group_ids,
        model_pricing,
        model_mapping: Object.keys(model_mapping).length > 0 ? model_mapping : {},
        billing_model_source: form.billing_model_source,
        restrict_models: form.restrict_models,
        features_config,
        apply_pricing_to_account_stats: form.apply_pricing_to_account_stats,
        account_stats_pricing_rules: accountStatsRulesToAPI()
      }
      await adminAPI.channels.create(req)
      appStore.showSuccess(t('admin.channels.createSuccess', 'Channel created'))
    }
    closeDialog()
    loadChannels()
  } catch (error: unknown) {
    appStore.showError(extractApiErrorMessage(error, editingChannel.value
      ? t('admin.channels.updateError', 'Failed to update channel')
      : t('admin.channels.createError', 'Failed to create channel')))
  } finally {
    submitting.value = false
  }
}

// ── Toggle status ──
async function toggleChannelStatus(channel: Channel) {
  if (channelStatusPendingIds.value.has(channel.id)) return
  const newStatus = channel.status === 'active' ? 'disabled' : 'active'
  channelStatusPendingIds.value = new Set([...channelStatusPendingIds.value, channel.id])
  try {
    await adminAPI.channels.update(channel.id, { status: newStatus })
    if (filters.status && filters.status !== newStatus) {
      // Item no longer matches the active filter — reload list
      await loadChannels()
    } else {
      channel.status = newStatus
    }
  } catch (error) {
    appStore.showError(t('admin.channels.updateError', 'Failed to update channel'))
    console.error('Error toggling channel status:', error)
  } finally {
    const next = new Set(channelStatusPendingIds.value)
    next.delete(channel.id)
    channelStatusPendingIds.value = next
  }
}

// ── Delete ──
function handleDelete(channel: Channel) {
  deletingChannel.value = channel
  showDeleteDialog.value = true
}

async function confirmDelete() {
  const target = deletingChannel.value
  if (!target || deletePending.value) return
  deletePending.value = true

  try {
    await adminAPI.channels.remove(target.id)
    appStore.showSuccess(t('admin.channels.deleteSuccess', 'Channel deleted'))
    showDeleteDialog.value = false
    deletingChannel.value = null
    loadChannels()
  } catch (error: unknown) {
    appStore.showError(extractApiErrorMessage(error, t('admin.channels.deleteError', 'Failed to delete channel')))
  } finally {
    deletePending.value = false
  }
}

// ── Lifecycle ──
onMounted(() => {
  loadChannels()
  loadGroups()
  loadWebSearchGlobalState()
})

onUnmounted(() => {
  clearTimeout(searchTimeout)
  abortController?.abort()
  ruleAccountSearchRunner.clearAll()
  clearAllRuleAccountSearchState()
})
</script>

<style scoped>
.channel-dialog-body {
  display: flex;
  flex-direction: column;
  height: min(70dvh, 720px);
  min-height: 400px;
}

.channel-dialog-form {
  min-height: 0;
  flex: 1;
  padding-top: 12px;
  overflow-y: auto;
}

</style>
