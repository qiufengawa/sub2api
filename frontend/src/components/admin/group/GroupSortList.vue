<template>
  <div class="group-sort-list">
    <p>{{ hint }}</p>
    <VueDraggable v-model="items" :animation="180" class="group-sort-list__items">
      <div v-for="group in items" :key="group.id" class="group-sort-list__row">
        <Icon name="menu" size="sm" />
        <div>
          <strong>{{ group.name }}</strong>
          <UiBadge
            tone="neutral"
            :label="t(`admin.groups.platforms.${group.platform}`, group.platform)"
          />
        </div>
        <span>#{{ group.id }}</span>
      </div>
    </VueDraggable>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { VueDraggable } from "vue-draggable-plus";
import type { AdminGroup } from "@/types";
import Icon from "@/components/icons/Icon.vue";
import { UiBadge } from "@/components/ui";

const props = defineProps<{
  modelValue: AdminGroup[];
  hint: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: AdminGroup[]];
}>();

const { t } = useI18n();
const items = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
</script>

<style scoped>
.group-sort-list {
  display: grid;
  gap: 12px;
}

.group-sort-list > p {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.group-sort-list__items {
  display: grid;
  gap: 4px;
}

.group-sort-list__row {
  display: grid;
  min-height: 44px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--ui-border-soft);
  cursor: grab;
  transition: background var(--ui-motion-fast);
}

.group-sort-list__row:hover {
  background: var(--ui-surface-muted);
}

.group-sort-list__row:active {
  cursor: grabbing;
}

.group-sort-list__row > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.group-sort-list__row strong {
  overflow: hidden;
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-sort-list__row > span {
  color: var(--ui-text-soft);
  font-family: var(--ui-font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .group-sort-list__row {
    transition: none;
  }
}
</style>
