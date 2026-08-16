<template>
  <section class="ui-table-workspace" :aria-busy="loading">
    <header v-if="title || $slots.header || $slots.actions">
      <div>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
        <slot name="header" />
      </div>
      <div v-if="$slots.actions"><slot name="actions" /></div>
    </header>
    <slot name="toolbar" />
    <slot name="filters" />
    <div class="ui-table-workspace__body">
      <UiLoadingOverlay
        class="ui-table-workspace__loading-host"
        :show="loading"
        :label="loadingText"
      >
        <slot v-if="!empty" />
        <UiEmptyState v-else :title="emptyTitle" :description="emptyDescription">
          <template v-if="$slots.emptyAction" #action><slot name="emptyAction" /></template>
        </UiEmptyState>
      </UiLoadingOverlay>
    </div>
    <footer v-if="$slots.pagination || $slots.footer">
      <slot name="footer" />
      <slot name="pagination" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import UiEmptyState from './UiEmptyState.vue'
import UiLoadingOverlay from './UiLoadingOverlay.vue'

withDefaults(defineProps<{
  title?: string
  description?: string
  loading?: boolean
  loadingText?: string
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
}>(), {
  loading: false,
  loadingText: '正在加载数据',
  empty: false,
  emptyTitle: '暂无数据',
})
</script>

<style scoped>
.ui-table-workspace {
  min-width: 0;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-surface);
}

.ui-table-workspace > header,
.ui-table-workspace > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
}

.ui-table-workspace > header {
  border-bottom: 1px solid var(--ui-border-soft);
}

.ui-table-workspace > footer {
  border-top: 1px solid var(--ui-border-soft);
}

.ui-table-workspace h2,
.ui-table-workspace p {
  margin: 0;
}

.ui-table-workspace h2 {
  font-size: 14px;
  font-weight: 600;
}

.ui-table-workspace p {
  margin-top: 2px;
  color: var(--ui-text-soft);
  font-size: 11px;
}

.ui-table-workspace__body {
  position: relative;
  min-height: 80px;
}

.ui-table-workspace__loading-host {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

@media (max-width: 640px) {
  .ui-table-workspace > header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
