<template>
  <div
    v-if="uniqueIps.length > 0"
    class="ip-geo-batch-toolbar"
  >
    <span v-if="pendingCount > 0" class="ip-geo-batch-toolbar__count">
      {{ t('usage.ipGeo.pending', { count: pendingCount }) }}
    </span>
    <UiButton
      variant="quiet"
      density="dense"
      :disabled="loading || pendingCount === 0"
      :loading="loading"
      @click="run"
    >
      {{ loading ? t('usage.ipGeo.batchFetching') : t('usage.ipGeo.batchFetch') }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiButton } from '@/components/ui'
import { fetchBatch, getEntry } from '@/utils/ipGeoLookup'

// 当前页 IP 批量地理查询工具条:传入原始 IP 列表(可含空值),内部去重;
// 无 IP 时自身不渲染。批量失败 emit failed,由使用方弹提示。
const props = defineProps<{
  ips: Array<string | null | undefined>
}>()

const emit = defineEmits<{
  (e: 'failed'): void
}>()

const { t } = useI18n()

const uniqueIps = computed(() =>
  Array.from(new Set(props.ips.filter((ip): ip is string => Boolean(ip))))
)

const pendingCount = computed(() =>
  uniqueIps.value.filter((ip) => {
    const status = getEntry(ip).status
    return status === 'idle' || status === 'error'
  }).length
)

const loading = ref(false)

const run = async () => {
  loading.value = true
  try {
    const ok = await fetchBatch(uniqueIps.value)
    if (!ok) emit('failed')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.ip-geo-batch-toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 40px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--ui-border-soft);
  background: var(--ui-surface);
}

.ip-geo-batch-toolbar__count {
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}
</style>
