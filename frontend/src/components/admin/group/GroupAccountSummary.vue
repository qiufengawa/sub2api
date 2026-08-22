<template>
  <div class="group-account-summary">
    <span
      class="is-success"
      :title="t('admin.groups.accountsAvailable')"
      :aria-label="t('admin.groups.accountsAvailable')"
    >
      <Icon name="userPlus" size="xs" />
      <strong>{{ formatCount(active) }}</strong>
    </span>
    <span
      v-if="rateLimited > 0"
      class="is-warning"
      :title="t('admin.groups.accountsRateLimited')"
      :aria-label="t('admin.groups.accountsRateLimited')"
    >
      <Icon name="clock" size="xs" />
      <strong>{{ formatCount(rateLimited) }}</strong>
    </span>
    <span
      :title="t('admin.groups.accountsTotal')"
      :aria-label="t('admin.groups.accountsTotal')"
    >
      <Icon name="users" size="xs" />
      <strong>{{ formatCount(total) }}</strong>
    </span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Icon from "@/components/icons/Icon.vue";

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
  min-width: 88px;
  gap: 4px;
}

.group-account-summary > span {
  display: flex;
  min-height: 20px;
  align-items: center;
  gap: 2px;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-sans);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.group-account-summary strong {
  color: var(--ui-text);
  font-weight: 600;
}

.group-account-summary .is-success {
  color: var(--ui-success);
}

.group-account-summary .is-warning {
  color: var(--ui-warning);
}
</style>
