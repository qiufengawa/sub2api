<template>
  <div v-if="loading" class="group-usage-summary is-loading">-</div>
  <div v-else class="group-usage-summary">
    <div>
      <span>{{ t("admin.groups.usageToday") }}</span>
      <strong>${{ formatCost(todayCost) }}</strong>
    </div>
    <div>
      <span>{{ t("admin.groups.usageTotal") }}</span>
      <strong>${{ formatCost(totalCost) }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

withDefaults(
  defineProps<{
    loading?: boolean;
    todayCost?: number;
    totalCost?: number;
  }>(),
  {
    loading: false,
    todayCost: 0,
    totalCost: 0,
  },
);

const { t } = useI18n();
const formatCost = (value: number) => value.toFixed(4);
</script>

<style scoped>
.group-usage-summary {
  display: grid;
  min-width: 118px;
  gap: 4px;
}

.group-usage-summary > div {
  display: flex;
  min-height: 20px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ui-text-soft);
  font-size: 11px;
}

.group-usage-summary strong {
  color: var(--ui-text);
  font-family: var(--ui-font-mono);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.group-usage-summary.is-loading {
  color: var(--ui-text-soft);
}
</style>
