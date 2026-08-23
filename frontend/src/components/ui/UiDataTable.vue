<template>
  <div class="ui-data-table" role="region" tabindex="0" :aria-label="ariaLabel" :aria-busy="loading || undefined">
    <UiDataTableCore
      ref="coreRef"
      v-bind="$attrs"
      :columns="columns"
      :data="data"
      :loading="loading"
      :mobile-table="mobileTable"
      @sort="(key, order) => emit('sort', key, order)"
      @row-click="row => emit('rowClick', row)"
      @update:selected-keys="keys => emit('update:selectedKeys', keys)"
      @selection-change="keys => emit('selectionChange', keys)"
    >
      <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope || {}" /></template>
    </UiDataTableCore>
  </div>
</template>

<script setup lang="ts">
import UiDataTableCore from './internal/UiDataTableCore.vue'
import type { Column } from './dataTableTypes'

defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  columns: Column[]
  data: any[]
  loading?: boolean
  mobileTable?: boolean
  ariaLabel?: string
}>(), { loading: false, mobileTable: true, ariaLabel: '数据表格，可横向滚动' })
import { ref } from 'vue'
const coreRef = ref<any>(null)
const emit = defineEmits<{
  sort: [key: string, order: 'asc' | 'desc']
  rowClick: [row: any]
  'update:selectedKeys': [keys: Array<string | number>]
  selectionChange: [keys: Array<string | number>]
}>()
defineExpose({
  get virtualizer() { return coreRef.value?.virtualizer },
  get shouldVirtualize() { return coreRef.value?.shouldVirtualize ?? false },
  get sortedData() { return coreRef.value?.sortedData ?? [] },
  get resolveRowKey() { return coreRef.value?.resolveRowKey },
  get tableWrapperEl() { return coreRef.value?.tableWrapperEl }
})
</script>

<style scoped>
.ui-data-table{overflow-x:auto;background:var(--ui-surface)}
.ui-data-table :deep(.table-wrapper){border:0!important;border-radius:0!important;tab-size:4}
.ui-data-table :deep(thead){background:var(--ui-surface-muted)!important}
.ui-data-table :deep(tbody){background:var(--ui-surface)!important}
.ui-data-table :deep(table),.ui-data-table :deep(th),.ui-data-table :deep(td){font-family:var(--ui-font-sans)!important}
.ui-data-table :deep(th){color:var(--ui-text-soft)!important;letter-spacing:0!important;font-size:12px!important;font-weight:500!important}
.ui-data-table :deep(td){color:var(--ui-text)!important;font-size:13px!important;font-variant-numeric:tabular-nums}
</style>
