<template>
  <section class="ui-chart-frame" :aria-busy="loading || undefined">
    <header>
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
      <div class="ui-chart-frame__tools">
        <slot name="legend" />
        <slot name="actions" />
      </div>
    </header>
    <div class="ui-chart-frame__body" :style="{ minHeight: `${height}px` }">
      <UiLoadingOverlay v-if="loading" :show="true" :label="loadingLabel" />
      <UiErrorState
        v-else-if="error"
        :title="errorTitle"
        :description="error"
        @retry="emit('retry')"
      />
      <UiEmptyState
        v-else-if="empty"
        :title="emptyTitle"
        :description="emptyDescription"
      />
      <slot v-else />
    </div>
    <footer v-if="updatedAt || $slots.footer">
      <span v-if="updatedAt">{{ updatedLabel }} {{ updatedAt }}</span>
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import UiEmptyState from './UiEmptyState.vue'
import UiErrorState from './UiErrorState.vue'
import UiLoadingOverlay from './UiLoadingOverlay.vue'

withDefaults(defineProps<{
  title: string
  description?: string
  loading?: boolean
  loadingLabel?: string
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  error?: string
  errorTitle?: string
  updatedAt?: string
  updatedLabel?: string
  height?: number
}>(), {
  loading: false,
  loadingLabel: '正在加载图表',
  empty: false,
  emptyTitle: '暂无趋势数据',
  emptyDescription: '',
  errorTitle: '图表加载失败',
  updatedLabel: '更新于',
  height: 220,
})

const emit = defineEmits<{ retry: [] }>()
</script>

<style scoped>
.ui-chart-frame{display:flex;min-width:0;height:100%;flex-direction:column;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius-panel);background:var(--ui-surface)}.ui-chart-frame>header,.ui-chart-frame>footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px}.ui-chart-frame>header{flex:none;border-bottom:1px solid var(--ui-border-soft)}.ui-chart-frame h3,.ui-chart-frame p{margin:0}.ui-chart-frame h3{font-size:13px;font-weight:600}.ui-chart-frame p,.ui-chart-frame footer{margin-top:2px;color:var(--ui-text-soft);font-size:10px}.ui-chart-frame__tools{display:flex;align-items:center;gap:8px}.ui-chart-frame__body{position:relative;min-width:0;flex:1;padding:10px}.ui-chart-frame>footer{flex:none;border-top:1px solid var(--ui-border-soft)}
</style>
