<template>
  <div class="group-capacity-summary">
    <span :class="tone(concurrencyUsed, concurrencyMax)">
      <Icon name="grid" size="xs" />
      <strong>{{ concurrencyUsed }}</strong>/<span>{{ concurrencyMax }}</span>
    </span>
    <span v-if="sessionsMax > 0" :class="tone(sessionsUsed, sessionsMax)">
      <Icon name="users" size="xs" />
      <strong>{{ sessionsUsed }}</strong>/<span>{{ sessionsMax }}</span>
    </span>
    <span v-if="rpmMax > 0" :class="tone(rpmUsed, rpmMax)">
      <Icon name="clock" size="xs" />
      <strong>{{ rpmUsed }}</strong>/<span>{{ rpmMax }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/icons/Icon.vue";

withDefaults(
  defineProps<{
    concurrencyUsed?: number;
    concurrencyMax?: number;
    sessionsUsed?: number;
    sessionsMax?: number;
    rpmUsed?: number;
    rpmMax?: number;
  }>(),
  {
    concurrencyUsed: 0,
    concurrencyMax: 0,
    sessionsUsed: 0,
    sessionsMax: 0,
    rpmUsed: 0,
    rpmMax: 0,
  },
);

function tone(used: number, max: number) {
  if (max > 0 && used >= max) return "is-danger";
  if (used > 0) return "is-warning";
  return "is-neutral";
}
</script>

<style scoped>
.group-capacity-summary {
  display: grid;
  min-width: 88px;
  gap: 4px;
}

.group-capacity-summary > span {
  display: flex;
  min-height: 20px;
  align-items: center;
  gap: 3px;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.group-capacity-summary strong {
  color: var(--ui-text);
  font-weight: 600;
}

.group-capacity-summary .is-warning {
  color: var(--ui-warning);
}

.group-capacity-summary .is-danger {
  color: var(--ui-danger);
}
</style>
