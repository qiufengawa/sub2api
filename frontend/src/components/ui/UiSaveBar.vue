<template>
  <Transition name="ui-save">
    <div v-if="dirty || saving || savedAt || $slots.controls" class="ui-save" role="status">
      <div v-if="$slots.controls" class="ui-save__controls"><slot name="controls" /></div>
      <div class="ui-save__status">
        <span class="ui-save__dot" :class="{ saved: !dirty && !saving }" />
        <strong>{{ saving ? savingLabel : dirty ? dirtyLabel : savedLabel }}</strong>
        <small v-if="savedAt && !dirty">{{ savedAt }}</small>
      </div>
      <div class="ui-save__actions">
        <UiButton v-if="dirty" :data-test="discardDataTest" density="dense" variant="quiet" :disabled="saving" @click="emit('discard')">
          {{ discardLabel }}
        </UiButton>
        <UiButton :data-test="saveDataTest" density="dense" variant="primary" :disabled="!dirty" :loading="saving" @click="emit('save')">
          {{ saveLabel }}
        </UiButton>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import UiButton from './UiButton.vue'

withDefaults(defineProps<{
  dirty: boolean
  saving?: boolean
  savedAt?: string
  dirtyLabel?: string
  savingLabel?: string
  savedLabel?: string
  discardLabel?: string
  saveLabel?: string
  discardDataTest?: string
  saveDataTest?: string
}>(), {
  saving: false,
  dirtyLabel: '有未保存的修改',
  savingLabel: '正在保存',
  savedLabel: '更改已保存',
  discardLabel: '放弃',
  saveLabel: '保存更改'
})

const emit = defineEmits<{ save: []; discard: [] }>()
</script>

<style scoped>
.ui-save{display:flex;min-height:46px;align-items:center;gap:16px;padding:7px 10px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);background:color-mix(in srgb,var(--ui-surface) 94%,transparent);box-shadow:0 8px 24px rgb(31 35 41/.08);backdrop-filter:blur(10px)}
.ui-save__controls{display:flex;min-width:0;flex:1;flex-wrap:wrap;align-items:center;gap:10px 16px}
.ui-save__status,.ui-save__actions{display:flex;flex:none;align-items:center;gap:8px}
.ui-save__dot{width:7px;height:7px;border-radius:50%;background:var(--ui-warning)}
.ui-save__dot.saved{background:var(--ui-success)}
.ui-save strong{font-size:12px}.ui-save small{color:var(--ui-text-soft);font-size:11px}
.ui-save-enter-active,.ui-save-leave-active{transition:opacity var(--ui-motion-base),transform var(--ui-motion-base)}
.ui-save-enter-from,.ui-save-leave-to{opacity:0;transform:translateY(6px)}
@media(max-width:860px){.ui-save{align-items:stretch;flex-wrap:wrap}.ui-save__controls{width:100%;flex-basis:100%}.ui-save__status{flex:1}.ui-save__actions{margin-left:auto}}
@media(max-width:520px){.ui-save__controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.ui-save__status{min-width:0}.ui-save__status small{display:none}.ui-save__actions{display:grid;width:100%;grid-template-columns:repeat(2,minmax(0,1fr))}.ui-save__actions>:only-child{grid-column:1/-1}}
@media(prefers-reduced-motion:reduce){.ui-save-enter-active,.ui-save-leave-active{transition:none}}
</style>
