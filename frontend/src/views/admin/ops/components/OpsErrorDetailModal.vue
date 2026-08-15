<template>
  <UiDialog :show="show" :title="title" width="full" :close-on-click-outside="true" @close="close">
    <UiLoadingOverlay class="ops-error-detail" :show="loading" :label="t('admin.ops.errorDetail.loading')">
      <UiEmptyState v-if="!detail && !loading" :title="emptyText" />

      <AppStack v-else-if="detail" :gap="20">
        <UiDescriptionList :items="summaryItems" :columns="3">
          <template #requestId>
            <AppInline :wrap="false">
              <span class="ops-error-detail__mono">{{ requestId || '—' }}</span>
              <UiCopyButton v-if="requestId" :value="requestId" variant="ghost" />
            </AppInline>
          </template>
          <template #model>
            <span v-if="hasModelMapping(detail)" class="ops-error-detail__mono">
              {{ detail.requested_model }} -> {{ detail.upstream_model }}
            </span>
            <span v-else>{{ displayModel(detail) || '—' }}</span>
          </template>
          <template #status>
            <UiBadge :tone="statusTone" :label="String(detail.status_code)" />
          </template>
        </UiDescriptionList>

        <AppSection :title="t('admin.ops.errorDetail.responseBody')">
          <UiCodeBlock :code="prettyJSON(primaryResponseBody || '')" />
        </AppSection>

        <AppSection v-if="showUpstreamList" :title="t('admin.ops.errorDetails.upstreamErrors')">
          <template #actions>
            <AppInline v-if="correlatedUpstreamLoading" :wrap="false">
              <UiSpinner />
              <span class="ops-error-detail__loading-label">{{ t('common.loading') }}</span>
            </AppInline>
          </template>

          <UiEmptyState
            v-if="!correlatedUpstreamLoading && !correlatedUpstreamErrors.length"
            :title="t('common.noData')"
          />

          <div v-else class="ops-error-detail__events">
            <article v-for="(ev, idx) in correlatedUpstreamErrors" :key="ev.id" class="ops-error-detail__event">
              <header>
                <AppInline :wrap="false">
                  <strong>#{{ idx + 1 }}</strong>
                  <UiBadge v-if="ev.type" tone="neutral" :label="ev.type" />
                  <UiBadge :tone="statusToneFor(ev.status_code)" :label="String(ev.status_code ?? '—')" />
                </AppInline>
                <UiButton
                  density="dense"
                  variant="quiet"
                  :disabled="!getUpstreamResponsePreview(ev)"
                  :title="getUpstreamResponsePreview(ev) ? '' : t('common.noData')"
                  @click="toggleUpstreamDetail(ev.id)"
                >
                  <template #icon>
                    <Icon
                      :name="expandedUpstreamDetailIds.has(ev.id) ? 'chevronDown' : 'chevronRight'"
                      size="xs"
                    />
                  </template>
                  {{
                    expandedUpstreamDetailIds.has(ev.id)
                      ? t('admin.ops.errorDetail.responsePreview.collapse')
                      : t('admin.ops.errorDetail.responsePreview.expand')
                  }}
                </UiButton>
              </header>
              <UiDescriptionList
                :items="[
                  { label: t('admin.ops.errorDetail.upstreamEvent.status'), value: ev.status_code ?? '—', numeric: true },
                  { label: t('admin.ops.errorDetail.upstreamEvent.requestId'), value: ev.request_id || ev.client_request_id || '—' },
                ]"
                :columns="2"
              />
              <p v-if="ev.message">{{ ev.message }}</p>
              <UiCodeBlock
                v-if="expandedUpstreamDetailIds.has(ev.id)"
                :code="prettyJSON(getUpstreamResponsePreview(ev))"
              />
            </article>
          </div>
        </AppSection>
      </AppStack>
    </UiLoadingOverlay>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import {
  AppInline,
  AppSection,
  AppStack,
  UiBadge,
  UiButton,
  UiCodeBlock,
  UiCopyButton,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiLoadingOverlay,
  UiSpinner,
} from '@/components/ui'
import { useAppStore } from '@/stores'
import { opsAPI, type OpsErrorDetail } from '@/api/admin/ops'
import { formatDateTime } from '@/utils/format'
import { resolvePrimaryResponseBody, resolveUpstreamPayload } from '../utils/errorDetailResponse'

interface Props {
  show: boolean
  errorId: number | null
  errorType?: 'request' | 'upstream'
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const detail = ref<OpsErrorDetail | null>(null)

const showUpstreamList = computed(() => props.errorType === 'request')

const requestId = computed(() => detail.value?.request_id || detail.value?.client_request_id || '')

const primaryResponseBody = computed(() => {
  return resolvePrimaryResponseBody(detail.value, props.errorType)
})




const title = computed(() => {
  if (!props.errorId) return t('admin.ops.errorDetail.title')
  return t('admin.ops.errorDetail.titleWithId', { id: String(props.errorId) })
})

const emptyText = computed(() => t('admin.ops.errorDetail.noErrorSelected'))

const summaryItems = computed(() => {
  const current = detail.value
  if (!current) return []
  const identityLabel = isUpstreamError(current)
    ? t('admin.ops.errorDetail.account')
    : t('admin.ops.errorDetail.user')
  const identityValue = isUpstreamError(current)
    ? current.account_name || (current.account_id != null ? String(current.account_id) : '—')
    : current.user_email || (current.user_id != null ? String(current.user_id) : '—')

  const items = [
    { key: 'requestId', label: t('admin.ops.errorDetail.requestId'), value: requestId.value || '—' },
    { label: t('admin.ops.errorDetail.time'), value: formatDateTime(current.created_at) },
    { label: identityLabel, value: identityValue },
    { label: t('admin.ops.errorDetail.platform'), value: current.platform || '—' },
    { label: t('admin.ops.errorDetail.group'), value: current.group_name || (current.group_id != null ? String(current.group_id) : '—') },
    { key: 'model', label: t('admin.ops.errorDetail.model'), value: displayModel(current) || '—' },
    { label: t('admin.ops.errorDetail.inboundEndpoint'), value: current.inbound_endpoint || '—' },
    { label: t('admin.ops.errorDetail.upstreamEndpoint'), value: current.upstream_endpoint || '—' },
    { key: 'status', label: t('admin.ops.errorDetail.status'), value: current.status_code, numeric: true },
    { label: t('admin.ops.errorDetail.requestType'), value: formatRequestTypeLabel(current.request_type) },
    { label: t('admin.ops.errorDetail.message'), value: current.message || '—' },
  ]
  if (current.api_key_prefix) {
    items.push({ label: t('admin.ops.errorDetail.apiKeyPrefix'), value: current.api_key_prefix })
  }
  return items
})

function isUpstreamError(d: OpsErrorDetail | null): boolean {
  if (!d) return false
  const phase = String(d.phase || '').toLowerCase()
  const owner = String(d.error_owner || '').toLowerCase()
  return phase === 'upstream' && owner === 'provider'
}

function formatRequestTypeLabel(type: number | null | undefined): string {
  switch (type) {
    case 1: return t('admin.ops.errorDetail.requestTypeSync')
    case 2: return t('admin.ops.errorDetail.requestTypeStream')
    case 3: return t('admin.ops.errorDetail.requestTypeWs')
    default: return t('admin.ops.errorDetail.requestTypeUnknown')
  }
}

function hasModelMapping(d: OpsErrorDetail | null): boolean {
  if (!d) return false
  const requested = String(d.requested_model || '').trim()
  const upstream = String(d.upstream_model || '').trim()
  return !!requested && !!upstream && requested !== upstream
}

function displayModel(d: OpsErrorDetail | null): string {
  if (!d) return ''
  const upstream = String(d.upstream_model || '').trim()
  if (upstream) return upstream
  const requested = String(d.requested_model || '').trim()
  if (requested) return requested
  return String(d.model || '').trim()
}

const correlatedUpstream = ref<OpsErrorDetail[]>([])
const correlatedUpstreamLoading = ref(false)

const correlatedUpstreamErrors = computed<OpsErrorDetail[]>(() => correlatedUpstream.value)

const expandedUpstreamDetailIds = ref(new Set<number>())

function getUpstreamResponsePreview(ev: OpsErrorDetail): string {
  const upstreamPayload = resolveUpstreamPayload(ev)
  if (upstreamPayload) return upstreamPayload
  return String(ev.error_body || '').trim()
}

function toggleUpstreamDetail(id: number) {
  const next = new Set(expandedUpstreamDetailIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedUpstreamDetailIds.value = next
}

async function fetchCorrelatedUpstreamErrors(requestErrorId: number) {
  correlatedUpstreamLoading.value = true
  try {
    const res = await opsAPI.listRequestErrorUpstreamErrors(
      requestErrorId,
      { page: 1, page_size: 100, view: 'all' },
      { include_detail: true }
    )
    correlatedUpstream.value = res.items || []
  } catch (err) {
    console.error('[OpsErrorDetailModal] Failed to load correlated upstream errors', err)
    correlatedUpstream.value = []
  } finally {
    correlatedUpstreamLoading.value = false
  }
}

function close() {
  emit('update:show', false)
}

function prettyJSON(raw?: string): string {
  if (!raw) return 'N/A'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

async function fetchDetail(id: number) {
  loading.value = true
  try {
    const kind = props.errorType || (detail.value?.phase === 'upstream' ? 'upstream' : 'request')
    const d = kind === 'upstream' ? await opsAPI.getUpstreamErrorDetail(id) : await opsAPI.getRequestErrorDetail(id)
    detail.value = d
  } catch (err: any) {
    detail.value = null
    appStore.showError(err?.message || t('admin.ops.failedToLoadErrorDetail'))
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.show, props.errorId] as const,
  ([show, id]) => {
    if (!show) {
      detail.value = null
      return
    }
    if (typeof id === 'number' && id > 0) {
      expandedUpstreamDetailIds.value = new Set()
      fetchDetail(id)
      if (props.errorType === 'request') {
        fetchCorrelatedUpstreamErrors(id)
      } else {
        correlatedUpstream.value = []
      }
    }
  },
  { immediate: true }
)

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

function statusToneFor(code: number | null | undefined): BadgeTone {
  if (typeof code !== 'number') return 'neutral'
  if (code >= 500) return 'danger'
  if (code === 429) return 'info'
  if (code >= 400) return 'warning'
  if (code >= 200 && code < 300) return 'success'
  return 'neutral'
}

const statusTone = computed(() => statusToneFor(detail.value?.status_code))

</script>

<style scoped>
.ops-error-detail {
  min-height: 220px;
}

.ops-error-detail__mono {
  font-family: var(--ui-font-mono);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.ops-error-detail__loading-label {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.ops-error-detail__events {
  border-top: 1px solid var(--ui-border-soft);
}

.ops-error-detail__event {
  display: grid;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}

.ops-error-detail__event > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ops-error-detail__event p {
  margin: 0;
  color: var(--ui-text);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
</style>
