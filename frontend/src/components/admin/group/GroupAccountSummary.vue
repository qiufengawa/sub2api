<template>
  <div class="group-account-summary">
    <div>
      <span>{{ t("admin.groups.accountsAvailable") }}</span>
      <UiBadge tone="success" :label="formatCount(active)" />
    </div>
    <div v-if="rateLimited > 0">
      <span>{{ t("admin.groups.accountsRateLimited") }}</span>
      <UiBadge tone="warning" :label="formatCount(rateLimited)" />
    </div>
    <div>
      <span>{{ t("admin.groups.accountsTotal") }}</span>
      <strong>{{ formatCount(total) }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { UiBadge } from "@/components/ui";

withDefaults(
  defineProps<{
    active?: number;
    rateLimited?: number;
    total?: number;
  }>(),
  {
    active: 0,
    rateLimited: 0,
    total: 0,
  },
);

const { t } = useI18n();
const formatCount = (value: number) => value.toLocaleString();
</script>

<style scoped>
.group-account-summary {
  display: grid;
  min-width: 116px;
  gap: 4px;
}

.group-account-summary > div {
  display: flex;
  min-height: 20px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--ui-text-soft);
  font-size: 11px;
}

.group-account-summary strong {
  color: var(--ui-text);
  font-family: var(--ui-font-mono);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>
