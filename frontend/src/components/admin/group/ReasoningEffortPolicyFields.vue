<template>
  <AppStack :gap="12">
    <UiSelect
      :id="`${idPrefix}-max-effort`"
      :model-value="maxEffort"
      :options="reasoningEffortOptions"
      :label="t('admin.groups.form.maxReasoningEffort')"
      :description="t('admin.groups.form.maxReasoningEffortHint')"
      :placeholder="t('admin.groups.form.maxReasoningEffortUnlimited')"
      :searchable="false"
      density="compact"
      clearable
      @update:model-value="updateMaxEffort"
    />

    <AppSection :title="t('admin.groups.form.reasoningEffortMappings')" divided>
      <template #actions>
        <UiButton type="button" density="compact" variant="quiet" @click="addMapping">
          <template #icon><Icon name="plus" size="sm" /></template>
          {{ t("admin.groups.form.addReasoningEffortMapping") }}
        </UiButton>
      </template>

      <UiEmptyState
        v-if="mappings.length === 0"
        :title="t('admin.groups.form.reasoningEffortMappings')"
      >
        <template #action>
          <UiButton type="button" density="compact" variant="quiet" @click="addMapping">
            {{ t("admin.groups.form.addReasoningEffortMapping") }}
          </UiButton>
        </template>
      </UiEmptyState>

      <AppStack v-else :gap="4">
        <div v-for="row in mappings" :key="row.id" class="reasoning-mapping-row">
          <AppGrid min="180px" :gap="12">
            <UiSelect
              :id="`${idPrefix}-${row.id}-from`"
              :model-value="row.from"
              :options="reasoningEffortOptions"
              :label="t('admin.groups.form.reasoningEffortFrom')"
              :placeholder="t('admin.groups.form.reasoningEffortFromPlaceholder')"
              :error="showValidation && validationErrors[row.id]?.from ? mappingErrorText(validationErrors[row.id]?.from) : undefined"
              :searchable="false"
              density="compact"
              clearable
              @update:model-value="updateMapping(row.id, 'from', $event)"
            />
            <UiSelect
              :id="`${idPrefix}-${row.id}-to`"
              :model-value="row.to"
              :options="reasoningEffortOptions"
              :label="t('admin.groups.form.reasoningEffortTo')"
              :placeholder="t('admin.groups.form.reasoningEffortToPlaceholder')"
              :error="showValidation && validationErrors[row.id]?.to ? mappingErrorText(validationErrors[row.id]?.to) : undefined"
              :searchable="false"
              density="compact"
              clearable
              @update:model-value="updateMapping(row.id, 'to', $event)"
            />
          </AppGrid>
          <UiIconButton
            icon="trash"
            variant="danger"
            density="compact"
            :label="t('admin.groups.form.removeReasoningEffortMapping')"
            @click="removeMapping(row.id)"
          />
        </div>
      </AppStack>
    </AppSection>
  </AppStack>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import Icon from "@/components/icons/Icon.vue";
import {
  AppGrid,
  AppSection,
  AppStack,
  UiButton,
  UiEmptyState,
  UiIconButton,
  UiSelect,
} from "@/components/ui";
import {
  createReasoningEffortMappingRow,
  reasoningEffortOptionsForPlatform,
  validateReasoningEffortMappings,
  type ReasoningEffortMappingErrorCode,
  type ReasoningEffortMappingRow,
} from "@/views/admin/groupsReasoningEffort";

const props = defineProps<{
  idPrefix: string;
  platform: GroupPlatform;
  maxEffort: string;
  mappings: ReasoningEffortMappingRow[];
}>();

const emit = defineEmits<{
  (event: "update:maxEffort", value: string): void;
  (event: "update:mappings", value: ReasoningEffortMappingRow[]): void;
}>();

const { t } = useI18n();
const showValidation = ref(false);
const reasoningEffortOptions = computed(() =>
  reasoningEffortOptionsForPlatform(props.platform),
);
const validationErrors = computed(() =>
  validateReasoningEffortMappings(props.mappings, props.platform),
);

const asString = (value: string | number | boolean | null): string =>
  value == null ? "" : String(value);

const updateMaxEffort = (value: string | number | boolean | null) => {
  emit("update:maxEffort", asString(value));
};

const updateMapping = (
  id: string,
  field: "from" | "to",
  value: string | number | boolean | null,
) => {
  emit(
    "update:mappings",
    props.mappings.map((row) =>
      row.id === id ? { ...row, [field]: asString(value) } : row,
    ),
  );
};

const addMapping = () => {
  emit("update:mappings", [
    ...props.mappings,
    createReasoningEffortMappingRow(),
  ]);
};

const removeMapping = (id: string) => {
  emit(
    "update:mappings",
    props.mappings.filter((row) => row.id !== id),
  );
};

const mappingErrorText = (
  code: ReasoningEffortMappingErrorCode | undefined,
): string => (code ? t(`admin.groups.form.${code}`) : "");

const validate = (): boolean => {
  showValidation.value = true;
  return Object.keys(validationErrors.value).length === 0;
};

const resetValidation = () => {
  showValidation.value = false;
};

defineExpose({ validate, resetValidation });
</script>

<style scoped>
.reasoning-mapping-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}
</style>
