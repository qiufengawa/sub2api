<template>
  <div class="proxy-selector" :class="{ 'proxy-selector--with-batch': proxies.length > 0 }">
    <UiCombobox
      v-bind="$attrs"
      :model-value="modelValue"
      :options="proxyOptions"
      :placeholder="t('admin.accounts.noProxy')"
      :search-placeholder="t('admin.proxies.searchProxies')"
      :empty-text="t('common.noOptionsFound')"
      searchable
      clearable
      :disabled="disabled"
      density="compact"
      :aria-label="t('admin.accounts.proxy')"
      @update:model-value="selectOption"
    >
      <template #selected>
        <span class="proxy-selector__selected">{{ selectedLabel }}</span>
      </template>
      <template #option="{ option, selected }">
        <div v-if="toProxyOption(option).value === null" class="proxy-selector__option proxy-selector__option--empty">
          <span>{{ t('admin.accounts.noProxy') }}</span>
          <Icon v-if="selected" name="check" size="sm" class="proxy-selector__check" />
        </div>
        <div v-else class="proxy-selector__option">
          <div class="proxy-selector__option-main">
            <div class="proxy-selector__option-title">
              <span class="proxy-selector__name">{{ toProxyOption(option).name }}</span>
              <UiBadge v-if="toProxyOption(option).account_count !== undefined" tone="neutral">
                {{ toProxyOption(option).account_count }}
              </UiBadge>
              <template v-if="testResults[toProxyOption(option).value as number]">
                <UiBadge v-if="testResults[toProxyOption(option).value as number].success" tone="success">
                  {{ formatTestResult(testResults[toProxyOption(option).value as number]) }}
                </UiBadge>
                <UiBadge v-else tone="danger">
                  {{ t('admin.proxies.testFailed') }}
                </UiBadge>
              </template>
            </div>
            <span class="proxy-selector__endpoint">{{ toProxyOption(option).endpoint }}</span>
          </div>
          <UiIconButton
            :icon="testingProxyIds.has(toProxyOption(option).value as number) ? undefined : 'play'"
            :label="t('admin.proxies.testConnection')"
            variant="ghost"
            density="mini"
            :disabled="testingProxyIds.has(toProxyOption(option).value as number)"
            @click.stop="handleTestProxy(toProxyOption(option).proxy as Proxy)"
          >
            <UiSpinner v-if="testingProxyIds.has(toProxyOption(option).value as number)" size="sm" />
          </UiIconButton>
          <Icon v-if="selected" name="check" size="sm" class="proxy-selector__check" />
        </div>
      </template>
    </UiCombobox>

    <UiIconButton
      v-if="proxies.length > 0"
      :icon="batchTesting ? undefined : 'play'"
      :label="t('admin.proxies.batchTest')"
      :tooltip="t('admin.proxies.batchTest')"
      variant="ghost"
      density="mini"
      :disabled="batchTesting"
      class="proxy-selector__batch"
      @click="handleBatchTest"
    >
      <UiSpinner v-if="batchTesting" size="sm" />
    </UiIconButton>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import Icon from '@/components/icons/Icon.vue'
import { UiBadge, UiCombobox, UiIconButton, UiSpinner } from '@/components/ui'
import type { Proxy } from '@/types'

defineOptions({ inheritAttrs: false })

interface ProxyTestResult {
  success: boolean
  message: string
  latency_ms?: number
  country?: string
}

interface ProxyOption {
  value: number | null
  label: string
  name?: string
  endpoint?: string
  account_count?: number
  proxy?: Proxy
}

const props = withDefaults(defineProps<{
  modelValue: number | null
  proxies: Proxy[]
  disabled?: boolean
}>(), { disabled: false })

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()
const { t } = useI18n()
const testResults = reactive<Record<number, ProxyTestResult>>({})
const testingProxyIds = reactive(new Set<number>())
const batchTesting = ref(false)

const selectedProxy = computed(() => props.proxies.find((proxy) => proxy.id === props.modelValue) || null)
const selectedLabel = computed(() => {
  if (!selectedProxy.value) return t('admin.accounts.noProxy')
  return `${selectedProxy.value.name} (${selectedProxy.value.protocol}://${selectedProxy.value.host}:${selectedProxy.value.port})`
})

const proxyOptions = computed(() => [
  { value: null, label: t('admin.accounts.noProxy'), alwaysVisible: true },
  ...props.proxies.map((proxy) => ({
    value: proxy.id,
    label: `${proxy.name} ${proxy.host}`,
    name: proxy.name,
    endpoint: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
    account_count: proxy.account_count,
    proxy,
  }))
])

function toProxyOption(option: unknown): ProxyOption {
  if (option && typeof option === 'object' && 'value' in option) {
    return option as ProxyOption
  }
  return { value: null, label: t('admin.accounts.noProxy') }
}

function selectOption(value: string | number | boolean | null) {
  emit('update:modelValue', typeof value === 'number' ? value : null)
}

function formatTestResult(result: ProxyTestResult): string {
  return [result.country, result.latency_ms ? `${result.latency_ms}ms` : undefined].filter(Boolean).join(' · ') || 'OK'
}

async function handleTestProxy(proxy: Proxy) {
  if (testingProxyIds.has(proxy.id)) return
  testingProxyIds.add(proxy.id)
  try {
    testResults[proxy.id] = await adminAPI.proxies.testProxy(proxy.id)
  } catch (error: any) {
    testResults[proxy.id] = { success: false, message: error.response?.data?.detail || 'Test failed' }
  } finally {
    testingProxyIds.delete(proxy.id)
  }
}

async function handleBatchTest() {
  if (batchTesting.value || props.proxies.length === 0) return
  batchTesting.value = true
  await Promise.all(props.proxies.map((proxy) => handleTestProxy(proxy)))
  batchTesting.value = false
}
</script>

<style scoped>
.proxy-selector{display:flex;align-items:center;gap:6px;min-width:0}
.proxy-selector :deep(.ui-combobox),.proxy-selector :deep(.ui-select){min-width:0;flex:1}
.proxy-selector__selected{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.proxy-selector__option{display:flex;align-items:center;gap:8px;min-width:0;width:100%;padding:2px 0}
.proxy-selector__option-main{min-width:0;flex:1}
.proxy-selector__option-title{display:flex;align-items:center;gap:6px;min-width:0}
.proxy-selector__name,.proxy-selector__endpoint{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.proxy-selector__name{font-weight:600;color:var(--ui-text)}
.proxy-selector__endpoint{margin-top:2px;color:var(--ui-text-muted);font:12px/1.3 var(--ui-font-mono)}
.proxy-selector__check{flex:none;color:var(--ui-success)}
.proxy-selector__batch{flex:none}
@media(max-width:480px){.proxy-selector{align-items:stretch}.proxy-selector__batch{align-self:center}.proxy-selector__endpoint{max-width:42vw}}
</style>
