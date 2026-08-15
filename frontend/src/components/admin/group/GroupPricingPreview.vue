<template>
  <AppStack :gap="6">
    <UiBadge tone="neutral" :label="title" />
    <UiDescriptionList :items="normalizedItems" :columns="columns" />
  </AppStack>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AppStack, UiBadge, UiDescriptionList } from "@/components/ui";

const props = withDefaults(
  defineProps<{
    title: string;
    items: Array<{ label: string; value: string | number }>;
    columns?: 1 | 2 | 3;
  }>(),
  { columns: 3 },
);

const normalizedItems = computed(() =>
  props.items.map((item, index) => ({
    key: String(index),
    label: item.label,
    value: item.value,
    numeric: true,
  })),
);
</script>
