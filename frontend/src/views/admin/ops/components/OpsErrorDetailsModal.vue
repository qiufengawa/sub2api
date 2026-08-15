<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiButton, UiDialog, UiFilterBar, UiSearchInput, UiSelect } from '@/components/ui'
import OpsErrorLogTable from './OpsErrorLogTable.vue'
import { opsAPI, type OpsErrorLog } from '@/api/admin/ops'
import { buildOpsErrorTimeParams } from '../utils/opsErrorParams'

interface Props {
  show: boolean
  timeRange: string
  customStartTime?: string | null
  customEndTime?: string | null
  platform?: string
  groupId?: number | null
  errorType: 'request' | 'upstream'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'openErrorDetail', errorId: number): void
}>()

const { t } = useI18n()


const loading = ref(false)
const rows = ref<OpsErrorLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

const q = ref('')
const statusCode = ref<number | 'other' | null>(null)
const phase = ref<string>('')
const errorOwner = ref<string>('')
const viewMode = ref<'errors' | 'excluded' | 'all'>('errors')


const modalTitle = computed(() => {
  return props.errorType === 'upstream' ? t('admin.ops.errorDetails.upstreamErrors') : t('admin.ops.errorDetails.requestErrors')
})

const statusCodeSelectOptions = computed(() => {
  const codes = [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504, 529]
  return [
    { value: null, label: t('common.all') },
    ...codes.map((c) => ({ value: c, label: String(c) })),
    { value: 'other', label: t('admin.ops.errorDetails.statusCodeOther') || 'Other' }
  ]
})

const ownerSelectOptions = computed(() => {
  return [
    { value: '', label: t('common.all') },
    { value: 'provider', label: t('admin.ops.errorDetails.owner.provider') || 'provider' },
    { value: 'client', label: t('admin.ops.errorDetails.owner.client') || 'client' },
    { value: 'platform', label: t('admin.ops.errorDetails.owner.platform') || 'platform' }
  ]
})


const viewModeSelectOptions = computed(() => {
  return [
    { value: 'errors', label: t('admin.ops.errorDetails.viewErrors') || 'errors' },
    { value: 'excluded', label: t('admin.ops.errorDetails.viewExcluded') || 'excluded' },
    { value: 'all', label: t('common.all') }
  ]
})

const phaseSelectOptions = computed(() => {
  const options = [
    { value: '', label: t('common.all') },
    { value: 'request', label: t('admin.ops.errorDetails.phase.request') || 'request' },
    { value: 'auth', label: t('admin.ops.errorDetails.phase.auth') || 'auth' },
    { value: 'account_auth', label: t('admin.ops.errorDetails.phase.account_auth') || 'account_auth' },
    { value: 'routing', label: t('admin.ops.errorDetails.phase.routing') || 'routing' },
    { value: 'upstream', label: t('admin.ops.errorDetails.phase.upstream') || 'upstream' },
    { value: 'network', label: t('admin.ops.errorDetails.phase.network') || 'network' },
    { value: 'internal', label: t('admin.ops.errorDetails.phase.internal') || 'internal' }
  ]
  return options
})

function close() {
  emit('update:show', false)
}

const sortBy = ref('created_at')
const sortOrder = ref<'asc' | 'desc'>('desc')

function onSort(nextSortBy: string, nextSortOrder: 'asc' | 'desc') {
  sortBy.value = nextSortBy
  sortOrder.value = nextSortOrder
  page.value = 1
  void fetchErrorLogs()
}

async function fetchErrorLogs() {
  if (!props.show) return

  loading.value = true
  try {
    const params: Record<string, any> = {
      page: page.value,
      page_size: pageSize.value,
      view: viewMode.value,
      sort_by: sortBy.value,
      sort_order: sortOrder.value
    }
    Object.assign(params, buildOpsErrorTimeParams(props.timeRange, props.customStartTime, props.customEndTime))

    const platform = String(props.platform || '').trim()
    if (platform) params.platform = platform
    if (typeof props.groupId === 'number' && props.groupId > 0) params.group_id = props.groupId

    if (q.value.trim()) params.q = q.value.trim()
    if (statusCode.value === 'other') params.status_codes_other = '1'
    else if (typeof statusCode.value === 'number') params.status_codes = String(statusCode.value)

    const phaseVal = String(phase.value || '').trim()
    if (phaseVal) params.phase = phaseVal

    const ownerVal = String(errorOwner.value || '').trim()
    if (ownerVal) params.error_owner = ownerVal


    const res = props.errorType === 'upstream'
      ? await opsAPI.listUpstreamErrors(params)
      : await opsAPI.listRequestErrors(params)
    rows.value = res.items || []
    total.value = res.total || 0
  } catch (err) {
    console.error('[OpsErrorDetailsModal] Failed to fetch error logs', err)
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

  function resetFilters() {
    q.value = ''
    statusCode.value = null
    phase.value = props.errorType === 'upstream' ? 'upstream' : ''
    errorOwner.value = ''
    viewMode.value = 'errors'
    page.value = 1
    fetchErrorLogs()
  }


watch(
  () => props.show,
  (open) => {
    if (!open) return
    page.value = 1
    pageSize.value = 10
    resetFilters()
  }
)

watch(
  () => [props.timeRange, props.customStartTime, props.customEndTime, props.platform, props.groupId] as const,
  () => {
    if (!props.show) return
    page.value = 1
    fetchErrorLogs()
  }
)

watch(
  () => [page.value, pageSize.value] as const,
  () => {
    if (!props.show) return
    fetchErrorLogs()
  }
)

function handleSearch() {
  if (!props.show) return
  page.value = 1
  void fetchErrorLogs()
}

watch(
  () => [statusCode.value, phase.value, errorOwner.value, viewMode.value] as const,
  () => {
    if (!props.show) return
    page.value = 1
    fetchErrorLogs()
  }
)
</script>

<template>
  <UiDialog :show="show" :title="modalTitle" width="full" @close="close">
    <div class="ops-error-details">
      <UiFilterBar>
        <UiSearchInput
          v-model="q"
          class="ops-error-details__search"
          density="compact"
          :debounce-ms="350"
          :placeholder="t('admin.ops.errorDetails.searchPlaceholder')"
          @search="handleSearch"
        />
        <UiSelect
          v-model="statusCode"
          class="ops-error-details__filter"
          density="compact"
          :options="statusCodeSelectOptions"
        />
        <UiSelect
          v-model="phase"
          class="ops-error-details__filter"
          density="compact"
          :options="phaseSelectOptions"
        />
        <UiSelect
          v-model="errorOwner"
          class="ops-error-details__filter"
          density="compact"
          :options="ownerSelectOptions"
        />
        <UiSelect
          v-model="viewMode"
          class="ops-error-details__filter"
          density="compact"
          :options="viewModeSelectOptions"
        />
        <template #actions>
          <UiButton density="compact" variant="secondary" @click="resetFilters">
            {{ t('common.reset') }}
          </UiButton>
        </template>
      </UiFilterBar>

      <div class="ops-error-details__body">
        <div class="ops-error-details__total">
          {{ t('admin.ops.errorDetails.total') }} {{ total }}
        </div>

        <OpsErrorLogTable
          class="ops-error-details__table"
          :rows="rows"
          :total="total"
          :loading="loading"
          :page="page"
          :page-size="pageSize"
          @open-error-detail="emit('openErrorDetail', $event)"
          @sort="onSort"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </div>
    </div>
  </UiDialog>
</template>

<style scoped>
.ops-error-details {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
}

.ops-error-details__search {
  width: min(100%, 280px);
}

.ops-error-details__filter {
  width: 148px;
}

.ops-error-details__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding-top: 10px;
}

.ops-error-details__total {
  flex-shrink: 0;
  padding: 0 2px 8px;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.ops-error-details__table {
  min-height: 0;
  flex: 1;
}

@media (max-width: 640px) {
  .ops-error-details__search,
  .ops-error-details__filter {
    width: 100%;
  }
}
</style>
