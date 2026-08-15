<template>
  <AppSection
    :title="t('admin.channels.form.groups', 'Associated Groups')"
    :description="selectedIds.length ? t('admin.channels.form.selectedCount', { count: selectedIds.length }) : undefined"
    divided
  >
    <UiLoadingOverlay v-if="loading" :show="true" :label="t('common.loading', 'Loading...')" />
    <UiEmptyState
      v-else-if="groups.length === 0"
      :title="t('admin.channels.form.noGroupsAvailable', 'No groups available')"
    />
    <AppGrid v-else min="220px" :gap="8">
      <div v-for="group in groups" :key="group.id" class="channel-group-choice">
        <UiCheckbox
          :model-value="selectedIds.includes(group.id)"
          :disabled="isDisabled(group.id)"
          :label="group.name"
          @update:model-value="emit('toggle', group.id)"
        />
        <AppInline>
          <UiBadge tone="info" :label="`${group.rate_multiplier}x`" />
          <UiBadge tone="neutral" :label="String(group.account_count || 0)" />
          <UiBadge v-if="isDisabled(group.id)" tone="warning" :label="disabledLabel(group.id)" />
        </AppInline>
      </div>
    </AppGrid>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { AdminGroup } from "@/types";
import {
  AppGrid,
  AppInline,
  AppSection,
  UiBadge,
  UiCheckbox,
  UiEmptyState,
  UiLoadingOverlay,
} from "@/components/ui";

defineProps<{
  groups: AdminGroup[];
  selectedIds: number[];
  loading: boolean;
  isDisabled: (groupId: number) => boolean;
  disabledLabel: (groupId: number) => string;
}>();

const emit = defineEmits<{ toggle: [groupId: number] }>();
const { t } = useI18n();
</script>

<style scoped>
.channel-group-choice {
  display: grid;
  min-height: 44px;
  align-content: center;
  gap: 5px;
  padding: 6px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}
</style>
