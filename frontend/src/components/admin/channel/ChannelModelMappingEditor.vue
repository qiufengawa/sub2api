<template>
  <AppSection :title="t('admin.channels.form.modelMapping', 'Model Mapping')" divided>
    <template #actions>
      <UiButton type="button" density="mini" variant="quiet" @click="emit('add')">
        <template #icon><Icon name="plus" size="xs" /></template>
        {{ t('common.add', 'Add') }}
      </UiButton>
    </template>

    <UiEmptyState
      v-if="entries.length === 0"
      :title="t('admin.channels.form.noMappingRules', 'No mapping rules. Click Add to create one.')"
    />
    <AppStack v-else :gap="4">
      <div v-for="entry in entries" :key="entry.source" class="channel-mapping-row">
        <AppGrid min="180px" :gap="8">
          <UiTextField
            density="mini"
            :model-value="entry.source"
            :label="t('admin.channels.form.mappingSource', 'Source model')"
            :placeholder="t('admin.channels.form.mappingSource', 'Source model')"
            monospace
            @change="emit('rename', entry.source, $event)"
          />
          <UiTextField
            density="mini"
            :model-value="entry.target"
            :label="t('admin.channels.form.mappingTarget', 'Target model')"
            :placeholder="t('admin.channels.form.mappingTarget', 'Target model')"
            monospace
            @update:model-value="emit('updateTarget', entry.source, $event)"
          />
        </AppGrid>
        <UiIconButton icon="trash" :label="t('common.delete')" variant="danger" density="mini" @click="emit('remove', entry.source)" />
      </div>
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/icons/Icon.vue";
import {
  AppGrid,
  AppSection,
  AppStack,
  UiButton,
  UiEmptyState,
  UiIconButton,
  UiTextField,
} from "@/components/ui";

const props = defineProps<{ mapping: Record<string, string> }>();
const emit = defineEmits<{
  add: [];
  remove: [source: string];
  rename: [source: string, nextSource: string];
  updateTarget: [source: string, target: string];
}>();
const { t } = useI18n();
const entries = computed(() =>
  Object.entries(props.mapping).map(([source, target]) => ({ source, target })),
);
</script>

<style scoped>
.channel-mapping-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}
</style>
