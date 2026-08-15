<template>
  <UiFilterBar>
    <UiAsyncEntityPicker
      class="usage-filter-field"
      :model-value="filters.user_id ?? null"
      :items="userItems"
      :selected-label="userKeyword"
      :loading="userLoading"
      :label="t('admin.usage.userFilter')"
      :placeholder="t('admin.usage.searchUserPlaceholder')"
      :empty-text="t('common.noOptionsFound')"
      @search="handleUserSearch"
      @select="handleUserSelect"
      @update:model-value="handleUserValue"
    />

    <UiAsyncEntityPicker
      class="usage-filter-field"
      :model-value="filters.api_key_id ?? null"
      :items="apiKeyItems"
      :selected-label="apiKeyKeyword"
      :loading="apiKeyLoading"
      :label="t('usage.apiKeyFilter')"
      :placeholder="t('admin.usage.searchApiKeyPlaceholder')"
      :empty-text="t('common.noOptionsFound')"
      search-on-focus
      show-results-without-query
      @search="handleApiKeySearch"
      @select="handleApiKeySelect"
      @update:model-value="handleApiKeyValue"
    />

    <UiCombobox
      v-model="filters.model"
      class="usage-filter-field"
      :options="modelOptions"
      :label="t('usage.model')"
      :placeholder="t('admin.usage.allModels')"
      density="compact"
      clearable
      @change="emitChange"
    />

    <UiAsyncEntityPicker
      class="usage-filter-field"
      :model-value="filters.account_id ?? null"
      :items="accountItems"
      :selected-label="accountKeyword"
      :loading="accountLoading"
      :label="t('admin.usage.account')"
      :placeholder="t('admin.usage.searchAccountPlaceholder')"
      :empty-text="t('common.noOptionsFound')"
      @search="handleAccountSearch"
      @select="handleAccountSelect"
      @update:model-value="handleAccountValue"
    />

    <UiSelect
      v-if="mode !== 'errors'"
      v-model="filters.request_type"
      class="usage-filter-field"
      :options="requestTypeOptions"
      :label="t('usage.type')"
      density="compact"
      @change="emitChange"
    />

    <UiSelect
      v-if="mode !== 'errors'"
      v-model="filters.billing_type"
      class="usage-filter-field"
      :options="billingTypeOptions"
      :label="t('admin.usage.billingType')"
      density="compact"
      @change="emitChange"
    />

    <UiSelect
      v-if="mode === 'usage'"
      v-model="filters.billing_mode"
      class="usage-filter-field"
      :options="billingModeOptions"
      :label="t('admin.usage.billingMode')"
      density="compact"
      @change="emitChange"
    />

    <UiSelect
      v-if="mode === 'usage'"
      v-model="filters.upstream_model_mismatch"
      class="usage-filter-field"
      :options="upstreamModelMismatchOptions"
      :label="t('admin.usage.upstreamModelAudit')"
      density="compact"
      @change="emitChange"
    />

    <UiSelect
      v-if="mode === 'errors'"
      v-model="filters.error_phase"
      class="usage-filter-field"
      :options="errorPhaseOptions"
      :label="t('admin.ops.errorLog.type')"
      density="compact"
      @change="emitChange"
    />

    <UiSelect
      v-if="mode === 'errors'"
      v-model="filters.error_category"
      class="usage-filter-field"
      :options="errorCategoryOptions"
      :label="t('usage.errors.category')"
      density="compact"
      @change="emitChange"
    />

    <UiSelect
      v-if="mode === 'errors'"
      v-model="filters.status_code"
      class="usage-filter-field"
      :options="statusCodeOptions"
      :label="t('admin.ops.errorLog.status')"
      density="compact"
      @change="emitChange"
    />

    <UiCombobox
      v-model="filters.group_id"
      class="usage-filter-field"
      :options="groupOptions"
      :label="t('admin.usage.group')"
      :placeholder="t('admin.usage.allGroups')"
      density="compact"
      clearable
      @change="emitChange"
    />

    <template v-if="showActions" #actions>
      <UiIconButton icon="refresh" density="compact" :label="t('common.refresh')" @click="emit('refresh')" />
      <UiButton density="compact" @click="emit('reset')">{{ t('common.reset') }}</UiButton>
      <slot name="after-reset" />
      <template v-if="mode === 'usage'">
        <UiButton density="compact" variant="danger" @click="emit('cleanup')">
          {{ t('admin.usage.cleanup.button') }}
        </UiButton>
        <UiButton density="compact" variant="primary" :loading="exporting" @click="emit('export')">
          {{ t('usage.exportExcel') }}
        </UiButton>
      </template>
    </template>
  </UiFilterBar>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import {
  UiAsyncEntityPicker,
  UiButton,
  UiCombobox,
  UiFilterBar,
  UiIconButton,
  UiSelect,
  type SelectOption,
  type UiEntityOption,
} from '@/components/ui'
import { COMMON_ERROR_STATUS_CODES } from '@/utils/errorBadges'
import type { SimpleApiKey, SimpleUser } from '@/api/admin/usage'

type ModelValue = Record<string, any>

interface Props {
  modelValue: ModelValue
  exporting: boolean
  startDate: string
  endDate: string
  showActions?: boolean
  modelOptions?: string[]
  mode?: 'usage' | 'errors' | 'ranking'
  flat?: boolean
}

interface SimpleAccount {
  id: number
  name: string
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  mode: 'usage',
  flat: false,
})
const emit = defineEmits<{
  'update:modelValue': [ModelValue]
  change: []
  refresh: []
  reset: []
  export: []
  cleanup: []
}>()

const { t } = useI18n()
const filters = toRef(props, 'modelValue')

const userKeyword = ref('')
const userResults = ref<SimpleUser[]>([])
const userLoading = ref(false)
let userSearchTimeout: ReturnType<typeof setTimeout> | null = null
let userSearchSequence = 0

const apiKeyKeyword = ref('')
const apiKeyResults = ref<SimpleApiKey[]>([])
const apiKeyLoading = ref(false)
let apiKeySearchTimeout: ReturnType<typeof setTimeout> | null = null
let apiKeySearchSequence = 0

const accountKeyword = ref('')
const accountResults = ref<SimpleAccount[]>([])
const accountLoading = ref(false)
let accountSearchTimeout: ReturnType<typeof setTimeout> | null = null
let accountSearchSequence = 0

const userItems = computed<UiEntityOption[]>(() => userResults.value.map((user) => ({
  value: user.id,
  label: user.email,
  description: `#${user.id}${user.deleted ? ` · ${t('admin.usage.userDeletedBadge')}` : ''}`,
})))
const apiKeyItems = computed<UiEntityOption[]>(() => apiKeyResults.value.map((key) => ({
  value: key.id,
  label: key.name || `#${key.id}`,
  description: `#${key.id}`,
})))
const accountItems = computed<UiEntityOption[]>(() => accountResults.value.map((account) => ({
  value: account.id,
  label: account.name,
  description: `#${account.id}`,
})))

const modelOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allModels') },
  ...(props.modelOptions ?? []).map((model) => ({ value: model, label: model })),
])
const groupOptions = ref<SelectOption[]>([{ value: null, label: t('admin.usage.allGroups') }])
const requestTypeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allTypes') },
  { value: 'ws_v2', label: t('usage.ws') },
  { value: 'live', label: t('usage.live') },
  { value: 'stream', label: t('usage.stream') },
  { value: 'sync', label: t('usage.sync') },
  { value: 'cyber', label: t('usage.cyber') },
])
const billingTypeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allBillingTypes') },
  { value: 0, label: t('admin.usage.billingTypeBalance') },
  { value: 1, label: t('admin.usage.billingTypeSubscription') },
])
const billingModeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allBillingModes') },
  { value: 'token', label: t('admin.usage.billingModeToken') },
  { value: 'per_request', label: t('admin.usage.billingModePerRequest') },
  { value: 'image', label: t('admin.usage.billingModeImage') },
  { value: 'video', label: t('admin.usage.billingModeVideo') },
])
const upstreamModelMismatchOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allUpstreamModelAudit') },
  { value: true, label: t('admin.usage.upstreamModelMismatchOnly') },
  { value: false, label: t('admin.usage.upstreamModelMatchedOnly') },
])
const errorPhaseOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allTypes') },
  ...['upstream', 'account_auth', 'request', 'auth', 'routing', 'internal'].map((value) => ({
    value,
    label: t(`admin.ops.errorLog.type${value === 'account_auth' ? 'AccountAuth' : value[0].toUpperCase() + value.slice(1)}`),
  })),
])
const errorCategoryOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.errors.allCategories') },
  ...['auth', 'rate_limit', 'quota', 'invalid_request', 'service_unavailable', 'upstream', 'internal', 'cyber']
    .map((value) => ({ value, label: t(`usage.errors.categories.${value}`) })),
])
const statusCodeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.errors.allStatuses') },
  ...COMMON_ERROR_STATUS_CODES.map((code) => ({ value: code, label: String(code) })),
])

const emitChange = () => emit('change')

function clearUserTimer() {
  if (userSearchTimeout) clearTimeout(userSearchTimeout)
  userSearchTimeout = null
  userSearchSequence += 1
}

function handleUserSearch(value: string) {
  userKeyword.value = value
  if (filters.value.user_id && !userResults.value.some((user) => user.id === filters.value.user_id && user.email === value)) {
    filters.value.user_id = undefined
    clearApiKey(false)
  }
  clearUserTimer()
  const query = value.trim()
  if (!query) {
    userResults.value = []
    userLoading.value = false
    return
  }
  const sequence = userSearchSequence
  userLoading.value = true
  userSearchTimeout = setTimeout(async () => {
    userSearchTimeout = null
    try {
      const results = await adminAPI.usage.searchUsers(query)
      if (sequence === userSearchSequence) {
        userResults.value = results.sort((a, b) => Number(a.deleted) - Number(b.deleted))
      }
    } catch {
      if (sequence === userSearchSequence) userResults.value = []
    } finally {
      if (sequence === userSearchSequence) userLoading.value = false
    }
  }, 300)
}

async function loadApiKeys(userId: number | undefined, keyword: string) {
  const sequence = ++apiKeySearchSequence
  apiKeyLoading.value = true
  try {
    const results = await adminAPI.usage.searchApiKeys(userId, keyword)
    if (sequence === apiKeySearchSequence) apiKeyResults.value = results
  } catch {
    if (sequence === apiKeySearchSequence) apiKeyResults.value = []
  } finally {
    if (sequence === apiKeySearchSequence) apiKeyLoading.value = false
  }
}

function handleUserSelect(option: UiEntityOption) {
  const user = userResults.value.find((item) => item.id === Number(option.value))
  if (!user) return
  clearUserTimer()
  userKeyword.value = user.email
  filters.value.user_id = user.id
  clearApiKey(false)
  void loadApiKeys(user.id, '')
  emitChange()
}

function handleUserValue(value: string | number | null) {
  if (value === null && filters.value.user_id != null) clearUser()
}

function clearUser() {
  clearUserTimer()
  userKeyword.value = ''
  userResults.value = []
  userLoading.value = false
  filters.value.user_id = undefined
  clearApiKey(false)
  emitChange()
}

function handleApiKeySearch(value: string) {
  apiKeyKeyword.value = value
  if (filters.value.api_key_id && !apiKeyResults.value.some((key) => key.id === filters.value.api_key_id && (key.name || String(key.id)) === value)) {
    filters.value.api_key_id = undefined
  }
  if (apiKeySearchTimeout) clearTimeout(apiKeySearchTimeout)
  const sequence = ++apiKeySearchSequence
  apiKeySearchTimeout = setTimeout(async () => {
    apiKeySearchTimeout = null
    apiKeyLoading.value = true
    try {
      const results = await adminAPI.usage.searchApiKeys(filters.value.user_id, value.trim())
      if (sequence === apiKeySearchSequence) apiKeyResults.value = results
    } catch {
      if (sequence === apiKeySearchSequence) apiKeyResults.value = []
    } finally {
      if (sequence === apiKeySearchSequence) apiKeyLoading.value = false
    }
  }, 300)
}

function handleApiKeySelect(option: UiEntityOption) {
  const key = apiKeyResults.value.find((item) => item.id === Number(option.value))
  if (!key) return
  apiKeySearchSequence += 1
  apiKeyKeyword.value = key.name || String(key.id)
  filters.value.api_key_id = key.id
  emitChange()
}

function handleApiKeyValue(value: string | number | null) {
  if (value === null && filters.value.api_key_id != null) clearApiKey(true)
}

function clearApiKey(notify = false) {
  if (apiKeySearchTimeout) clearTimeout(apiKeySearchTimeout)
  apiKeySearchTimeout = null
  apiKeySearchSequence += 1
  apiKeyKeyword.value = ''
  apiKeyResults.value = []
  apiKeyLoading.value = false
  filters.value.api_key_id = undefined
  if (notify) emitChange()
}

function handleAccountSearch(value: string) {
  accountKeyword.value = value
  if (filters.value.account_id && !accountResults.value.some((account) => account.id === filters.value.account_id && account.name === value)) {
    filters.value.account_id = undefined
  }
  if (accountSearchTimeout) clearTimeout(accountSearchTimeout)
  const sequence = ++accountSearchSequence
  const query = value.trim()
  if (!query) {
    accountResults.value = []
    accountLoading.value = false
    return
  }
  accountLoading.value = true
  accountSearchTimeout = setTimeout(async () => {
    accountSearchTimeout = null
    try {
      const response = await adminAPI.accounts.list(1, 20, { search: query })
      if (sequence === accountSearchSequence) {
        accountResults.value = response.items.map((account) => ({ id: account.id, name: account.name }))
      }
    } catch {
      if (sequence === accountSearchSequence) accountResults.value = []
    } finally {
      if (sequence === accountSearchSequence) accountLoading.value = false
    }
  }, 300)
}

function handleAccountSelect(option: UiEntityOption) {
  const account = accountResults.value.find((item) => item.id === Number(option.value))
  if (!account) return
  accountSearchSequence += 1
  accountKeyword.value = account.name
  filters.value.account_id = account.id
  emitChange()
}

function handleAccountValue(value: string | number | null) {
  if (value === null && filters.value.account_id != null) clearAccount()
}

function clearAccount() {
  if (accountSearchTimeout) clearTimeout(accountSearchTimeout)
  accountSearchTimeout = null
  accountSearchSequence += 1
  accountKeyword.value = ''
  accountResults.value = []
  accountLoading.value = false
  filters.value.account_id = undefined
  emitChange()
}

watch(() => props.startDate, (value) => { filters.value.start_date = value }, { immediate: true })
watch(() => props.endDate, (value) => { filters.value.end_date = value }, { immediate: true })
watch(() => filters.value.user_id, (value) => {
  if (value) return
  clearUserTimer()
  userKeyword.value = ''
  userResults.value = []
  userLoading.value = false
})
watch(() => filters.value.api_key_id, (value) => {
  if (value) return
  apiKeyKeyword.value = ''
  apiKeyResults.value = []
  apiKeyLoading.value = false
})
watch(() => filters.value.account_id, (value) => {
  if (value) return
  accountKeyword.value = ''
  accountResults.value = []
  accountLoading.value = false
})

onMounted(async () => {
  try {
    const response = await adminAPI.groups.list(1, 1000)
    groupOptions.value.push(...response.items.map((group: any) => ({ value: group.id, label: group.name })))
  } catch {
    // Group filtering remains optional when the option request fails.
  }
})

onUnmounted(() => {
  clearUserTimer()
  if (apiKeySearchTimeout) clearTimeout(apiKeySearchTimeout)
  if (accountSearchTimeout) clearTimeout(accountSearchTimeout)
  apiKeySearchSequence += 1
  accountSearchSequence += 1
})

function setUserKeyword(email: string) {
  clearUserTimer()
  userKeyword.value = email
  userResults.value = []
}

const getUserSearchRevision = () => userSearchSequence

defineExpose({ getUserSearchRevision, setUserKeyword })
</script>

<style scoped>
.usage-filter-field {
  width: min(240px, 100%);
  flex: 1 1 180px;
}
</style>
