<template>
  <div class="ui-export" :class="`is-${status}`">
    <div class="ui-export__icon"><Icon :name="statusIcon" size="sm" /></div>
    <div class="ui-export__content">
      <div>
        <strong>{{ title }}</strong>
        <UiBadge :tone="statusTone" :label="resolvedStatusLabel" />
      </div>
      <UiProgressBar
        v-if="status === 'running'"
        :value="progress"
        :label="progressLabel"
        :show-value="true"
      />
      <p v-if="message">{{ message }}</p>
      <dl v-if="status === 'completed' && fileName">
        <dt>{{ fileLabel }}</dt>
        <dd>{{ fileName }}<span v-if="fileSize"> · {{ fileSize }}</span></dd>
      </dl>
    </div>
    <div class="ui-export__actions">
      <UiButton v-if="status === 'running' && cancellable" density="dense" @click="emit('cancel')">
        {{ cancelLabel }}
      </UiButton>
      <UiButton v-if="status === 'failed'" density="dense" @click="emit('retry')">
        <template #icon><Icon name="refresh" size="sm" /></template>{{ retryLabel }}
      </UiButton>
      <UiButton v-if="status === 'completed'" density="dense" variant="primary" @click="emit('download')">
        <template #icon><Icon name="download" size="sm" /></template>{{ downloadLabel }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiBadge from './UiBadge.vue'
import UiButton from './UiButton.vue'
import UiProgressBar from './UiProgressBar.vue'

const props = withDefaults(defineProps<{
  status: 'idle' | 'running' | 'completed' | 'failed'
  title?: string
  message?: string
  progress?: number
  progressLabel?: string
  statusLabel?: string
  fileName?: string
  fileSize?: string
  fileLabel?: string
  cancellable?: boolean
  cancelLabel?: string
  retryLabel?: string
  downloadLabel?: string
}>(), {
  title: '导出任务',
  progress: 0,
  progressLabel: '导出进度',
  statusLabel: '',
  fileLabel: '文件',
  cancellable: true,
  cancelLabel: '取消',
  retryLabel: '重试',
  downloadLabel: '下载',
})

const emit = defineEmits<{ cancel: []; retry: []; download: [] }>()
const resolvedStatusLabel = computed(() => props.statusLabel || ({
  idle: '等待中',
  running: '生成中',
  completed: '已完成',
  failed: '失败',
})[props.status])
const statusTone = computed(() => ({
  idle: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
} as const)[props.status])
const statusIcon = computed(() => (
  props.status === 'completed'
    ? 'checkCircle'
    : props.status === 'failed'
      ? 'exclamationCircle'
      : props.status === 'running'
        ? 'refresh'
        : 'download'
))
</script>

<style scoped>
.ui-export{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;padding:10px;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius);background:var(--ui-surface)}.ui-export__icon{display:grid;width:20px;height:30px;place-items:center;color:var(--ui-text-muted)}.ui-export__content{display:grid;gap:6px;min-width:0}.ui-export__content>div{display:flex;align-items:center;gap:7px}.ui-export strong{font-size:13px}.ui-export p,.ui-export dl{margin:0;color:var(--ui-text-soft);font-size:11px}.ui-export dl{display:flex;gap:6px}.ui-export dd{margin:0;color:var(--ui-text-muted)}.ui-export__actions{display:flex;align-items:center}.ui-export.is-completed .ui-export__icon{color:var(--ui-success)}.ui-export.is-failed .ui-export__icon{color:var(--ui-danger)}@media(max-width:520px){.ui-export{grid-template-columns:auto 1fr}.ui-export__actions{grid-column:2}}
</style>
