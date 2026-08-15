<template>
  <AppSection
    :title="t('admin.groups.openaiMessages.title')"
    :description="t('admin.groups.openaiMessages.allowDispatchHint')"
    divided
  >
    <AppStack :gap="12">
      <UiSwitch
        :model-value="allowDispatch"
        :label="t('admin.groups.openaiMessages.allowDispatch')"
        @update:model-value="emit('update:allowDispatch', $event)"
      />

      <template v-if="allowDispatch">
        <AppSection
          :title="t('admin.groups.openaiMessages.familyMappingTitle')"
          :description="t('admin.groups.openaiMessages.familyMappingHint')"
          divided
        >
          <AppGrid min="180px" :gap="12">
            <UiTextField
              :model-value="opusModel"
              :label="t('admin.groups.openaiMessages.opusModel')"
              :placeholder="t('admin.groups.openaiMessages.opusModelPlaceholder')"
              density="compact"
              monospace
              @update:model-value="emit('update:opusModel', $event)"
            />
            <UiTextField
              :model-value="sonnetModel"
              :label="t('admin.groups.openaiMessages.sonnetModel')"
              :placeholder="t('admin.groups.openaiMessages.sonnetModelPlaceholder')"
              density="compact"
              monospace
              @update:model-value="emit('update:sonnetModel', $event)"
            />
            <UiTextField
              :model-value="haikuModel"
              :label="t('admin.groups.openaiMessages.haikuModel')"
              :placeholder="t('admin.groups.openaiMessages.haikuModelPlaceholder')"
              density="compact"
              monospace
              @update:model-value="emit('update:haikuModel', $event)"
            />
          </AppGrid>
        </AppSection>

        <AppSection
          :title="t('admin.groups.openaiMessages.exactMappingTitle')"
          :description="t('admin.groups.openaiMessages.exactMappingHint')"
        >
          <template #actions>
            <UiButton type="button" density="compact" variant="secondary" @click="emit('add')">
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('admin.groups.openaiMessages.addExactMapping') }}
            </UiButton>
          </template>

          <UiEmptyState
            v-if="mappings.length === 0"
            :title="t('admin.groups.openaiMessages.noExactMappings')"
          >
            <template #action>
              <UiButton type="button" density="compact" variant="quiet" @click="emit('add')">
                {{ t('admin.groups.openaiMessages.addExactMapping') }}
              </UiButton>
            </template>
          </UiEmptyState>

          <AppStack v-else :gap="4">
            <div v-for="row in mappings" :key="rowKey(row)" class="group-message-mapping-row">
              <AppGrid min="180px" :gap="12">
                <UiTextField
                  v-model="row.claude_model"
                  :label="t('admin.groups.openaiMessages.claudeModel')"
                  :placeholder="t('admin.groups.openaiMessages.claudeModelPlaceholder')"
                  density="compact"
                  monospace
                />
                <UiTextField
                  v-model="row.target_model"
                  :label="t('admin.groups.openaiMessages.targetModel')"
                  :placeholder="t('admin.groups.openaiMessages.targetModelPlaceholder')"
                  density="compact"
                  monospace
                />
              </AppGrid>
              <UiIconButton
                icon="trash"
                variant="danger"
                density="compact"
                :label="t('admin.groups.openaiMessages.removeExactMapping')"
                type="button"
                @click="emit('remove', row)"
              />
            </div>
          </AppStack>
        </AppSection>
      </template>
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { MessagesDispatchMappingRow } from "@/views/admin/groupsMessagesDispatch";
import Icon from "@/components/icons/Icon.vue";
import {
  AppGrid,
  AppSection,
  AppStack,
  UiButton,
  UiEmptyState,
  UiIconButton,
  UiSwitch,
  UiTextField,
} from "@/components/ui";

defineProps<{
  allowDispatch: boolean;
  opusModel: string;
  sonnetModel: string;
  haikuModel: string;
  mappings: MessagesDispatchMappingRow[];
  rowKey: (row: MessagesDispatchMappingRow) => string;
}>();

const emit = defineEmits<{
  "update:allowDispatch": [value: boolean];
  "update:opusModel": [value: string];
  "update:sonnetModel": [value: string];
  "update:haikuModel": [value: string];
  add: [];
  remove: [row: MessagesDispatchMappingRow];
}>();

const { t } = useI18n();
</script>

<style scoped>
.group-message-mapping-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}
</style>
