<template>
  <ol class="ui-steps" :aria-label="ariaLabel" role="list">
    <li
      v-for="(step, index) in steps"
      :key="step.key"
      :class="{ done: index < current, active: index === current }"
      :aria-current="index === current ? 'step' : undefined"
      :aria-label="`${index + 1}. ${step.label}`"
    >
      <span aria-hidden="true">
        <Icon v-if="index < current" name="check" size="xs" />
        <template v-else>{{ index + 1 }}</template>
      </span>
      <div>
        <b>{{ step.label }}</b>
        <small v-if="step.description">{{ step.description }}</small>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'

withDefaults(defineProps<{
  steps: Array<{ key: string; label: string; description?: string }>
  current: number
  ariaLabel?: string
}>(), {
  ariaLabel: 'Progress'
})
</script>

<style scoped>
.ui-steps { display: flex; overflow-x: auto; margin: 0; padding: 0 0 2px; list-style: none; }
.ui-steps li { position: relative; display: flex; min-width: 0; flex: 1; gap: 8px; color: var(--ui-text-soft); }
.ui-steps li:not(:last-child)::after { position: absolute; top: 13px; right: 8px; left: 34px; height: 1px; background: var(--ui-border); content: ""; }
.ui-steps li > span { z-index: 1; display: grid; width: 26px; height: 26px; flex: none; place-items: center; border: 1px solid var(--ui-border); border-radius: 50%; background: var(--ui-surface); font-size: 11px; }
.ui-steps b, .ui-steps small { display: block; }
.ui-steps b { color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.ui-steps small { font-size: 11px; }
.ui-steps li.done > span, .ui-steps li.active > span { border-color: var(--ui-text); color: var(--ui-inverse); background: var(--ui-text); }
.ui-steps li.active b { color: var(--ui-text); }
@media (max-width: 640px) {
  .ui-steps li { flex: 0 0 auto; }
  .ui-steps li:not(.active) > div { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .ui-steps li:not(:last-child) { padding-right: 34px; }
}
</style>
