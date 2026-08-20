<template>
  <span class="ui-switch-shell">
    <button
      v-bind="buttonAttrs"
      type="button"
      class="ui-switch"
      :class="{ 'ui-switch--on': modelValue, 'ui-switch--disabled': disabled }"
      role="switch"
      :aria-label="label"
      :aria-checked="modelValue"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="ui-switch__track" aria-hidden="true"><i /></span>
    </button>
    <input
      v-if="shouldRenderNativeInput"
      v-bind="inputAttrs"
      class="ui-switch__input"
      type="checkbox"
      :checked="modelValue"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      tabindex="-1"
      aria-hidden="true"
      @click.stop.prevent="toggle"
      @change="syncNativeInput"
    />
  </span>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const buttonAttrs = computed(() => {
  const { ['data-testid']: _testId, ...rest } = attrs
  return rest
})
const inputAttrs = computed(() => ({
  'data-testid': attrs['data-testid'],
  'data-tour': attrs['data-tour'],
}))

const props = withDefaults(defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
  nativeInput?: boolean
}>(), {
  label: '切换',
  disabled: false,
  nativeInput: true,
})

const shouldRenderNativeInput = computed(() => props.nativeInput || Boolean(attrs['data-testid']))

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}

function syncNativeInput(event: Event) {
  if (props.disabled) return
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.ui-switch-shell{position:relative;display:inline-flex;width:34px;height:20px;flex:none;align-items:center;justify-content:center}
.ui-switch{position:relative;display:inline-flex;width:34px;height:20px;flex:none;align-items:center;justify-content:center;padding:0;border:0;border-radius:999px;background:transparent;cursor:pointer}
.ui-switch__input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.ui-switch__track{display:block;width:34px;height:20px;padding:2px;border:1px solid var(--ui-border);border-radius:999px;background:var(--ui-surface-strong);transition:background var(--ui-motion-fast),border-color var(--ui-motion-fast),box-shadow var(--ui-motion-fast)}
.ui-switch__track i{display:block;width:14px;height:14px;border-radius:50%;background:var(--ui-surface);box-shadow:0 1px 2px rgb(0 0 0 / 16%);transition:transform var(--ui-motion-fast)}
.ui-switch:focus-visible{outline:0}
.ui-switch:focus-visible .ui-switch__track{border-color:var(--ui-focus);box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-focus) 16%,transparent)}
.ui-switch--on .ui-switch__track{border-color:var(--ui-text);background:var(--ui-text)}
.ui-switch--on .ui-switch__track i{transform:translateX(14px)}
.ui-switch--disabled{cursor:not-allowed;opacity:.45}
@media(prefers-reduced-motion:reduce){.ui-switch__track,.ui-switch__track i{transition:none}}
</style>
