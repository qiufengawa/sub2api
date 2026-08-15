<template>
  <AppStack :gap="14">
    <UiFormField :label="t('admin.channelMonitor.advanced.headers')" :description="t('admin.channelMonitor.advanced.headersHint')" :error="headersError">
      <UiKeyValueEditor
        :model-value="headerEditorRows"
        :key-placeholder="t('admin.channelMonitor.advanced.headerNamePlaceholder')"
        :value-placeholder="t('admin.channelMonitor.advanced.headerValuePlaceholder')"
        :add-label="t('admin.channelMonitor.advanced.headerAddRow')"
        @update:model-value="updateHeaderRows"
      />
    </UiFormField>

    <!-- Body mode radio -->
    <UiRadioGroup
      :model-value="bodyOverrideMode"
      :options="bodyModeOptions"
      name="channel-monitor-body-mode"
      layout="grid"
      :label="t('admin.channelMonitor.advanced.bodyMode')"
      @update:model-value="updateBodyMode($event as BodyOverrideMode)"
    />
    <UiAlert :message="bodyModeHint" />

    <!-- Body JSON (仅当 mode != off) -->
    <UiStructuredEditor
      v-if="bodyOverrideMode !== 'off'"
      :model-value="bodyText"
      :label="t('admin.channelMonitor.advanced.bodyJson')"
      :description="t('admin.channelMonitor.advanced.bodyJsonHint')"
      :error="bodyError"
      :rows="10"
      @update:model-value="updateBodyText"
      @valid="commitParsedBody"
      @invalid="handleBodyInvalid"
    />
  </AppStack>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { APIMode, BodyOverrideMode, Provider } from '@/api/admin/channelMonitor'
import { AppStack, UiAlert, UiFormField, UiKeyValueEditor, UiRadioGroup, UiStructuredEditor, type UiKeyValueRow } from '@/components/ui'

const props = defineProps<{
  provider?: Provider
  apiMode?: APIMode
  extraHeaders: Record<string, string>
  bodyOverrideMode: BodyOverrideMode
  bodyOverride: Record<string, unknown> | null
}>()

const emit = defineEmits<{
  (e: 'update:extraHeaders', value: Record<string, string>): void
  (e: 'update:bodyOverrideMode', value: BodyOverrideMode): void
  (e: 'update:bodyOverride', value: Record<string, unknown> | null): void
}>()

const { t } = useI18n()

// ---- Headers key-value rows ----
interface HeaderRow {
  name: string
  value: string
}

const headerRows = ref<HeaderRow[]>(toRows(props.extraHeaders))
const headersError = ref('')
const headerEditorRows = computed<UiKeyValueRow[]>(() => headerRows.value.map((row, index) => ({ id: index, key: row.name, value: row.value })))

watch(
  () => props.extraHeaders,
  (v) => {
    // 外部重置时（切换平台 / 应用模板）同步行。
    // 同值不回写，避免每次 commit 都把行重排。
    if (!isSameHeaderMap(toMap(headerRows.value), v)) {
      headerRows.value = toRows(v)
    }
    headersError.value = ''
  },
)

function toRows(h: Record<string, string>): HeaderRow[] {
  const entries = Object.entries(h || {})
  if (entries.length === 0) return [{ name: '', value: '' }]
  return entries.map(([name, value]) => ({ name, value }))
}

function toMap(rows: HeaderRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (name === '') continue
    out[name] = row.value
  }
  return out
}

function isSameHeaderMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b || {})
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function commitHeaders() {
  // 空白 name + 空白 value 的行允许保留作为"占位新行"，不报错；
  // name 非空但 value 为空（或反之）都视为用户正在编辑，同样不报错。
  // 只在 name 里含冒号这种明显不合法时兜一下。
  for (const row of headerRows.value) {
    const name = row.name.trim()
    if (name === '') continue
    if (name.includes(':') || /\s/.test(name)) {
      headersError.value = t('admin.channelMonitor.advanced.headerNameInvalid', { name })
      return
    }
  }
  headersError.value = ''
  emit('update:extraHeaders', toMap(headerRows.value))
}

function updateHeaderRows(rows: UiKeyValueRow[]) {
  headerRows.value = rows.length > 0
    ? rows.map((row) => ({ name: row.key, value: row.value }))
    : [{ name: '', value: '' }]
  commitHeaders()
}

// ---- Body mode + JSON ----
const bodyText = ref(serializeBody(props.bodyOverride))
const bodyError = ref('')

watch(
  () => props.bodyOverride,
  (v) => {
    bodyText.value = serializeBody(v)
    bodyError.value = ''
  },
)

function updateBodyText(value: string) {
  bodyText.value = value
  const trimmed = value.trim()
  if (trimmed === '') {
    emit('update:bodyOverride', null)
    bodyError.value = ''
  }
}

function commitParsedBody(parsed: unknown) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    bodyError.value = t('admin.channelMonitor.advanced.bodyJsonObjectError')
    return
  }
  emit('update:bodyOverride', parsed as Record<string, unknown>)
  bodyError.value = ''
}

function handleBodyInvalid(message: string) {
  bodyError.value = bodyText.value.trim() ? `${t('admin.channelMonitor.advanced.bodyJsonError')}: ${message}` : ''
}

function serializeBody(body: Record<string, unknown> | null): string {
  if (!body || Object.keys(body).length === 0) return ''
  return JSON.stringify(body, null, 2)
}

function updateBodyMode(mode: BodyOverrideMode) {
  emit('update:bodyOverrideMode', mode)
  // 切换到 off 时清掉 body（提示用户）
  if (mode === 'off') {
    emit('update:bodyOverride', null)
  }
}

const bodyModeOptions = computed<{ value: BodyOverrideMode; label: string }[]>(() => [
  { value: 'off', label: t('admin.channelMonitor.advanced.bodyModeOff') },
  { value: 'merge', label: t('admin.channelMonitor.advanced.bodyModeMerge') },
  { value: 'replace', label: t('admin.channelMonitor.advanced.bodyModeReplace') },
])

const bodyModeHint = computed(() => {
  switch (props.bodyOverrideMode) {
    case 'merge':
      return t('admin.channelMonitor.advanced.bodyModeHintMerge')
    case 'replace':
      return t('admin.channelMonitor.advanced.bodyModeHintReplace')
    default:
      return t('admin.channelMonitor.advanced.bodyModeHintOff')
  }
})

</script>
