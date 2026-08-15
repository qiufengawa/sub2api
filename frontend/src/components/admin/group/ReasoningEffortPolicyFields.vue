<template>
  <div class="space-y-4">
    <div>
      <label :for="`${idPrefix}-max-effort`" class="group-field-label">
        {{ t("admin.groups.form.maxReasoningEffort") }}
      </label>
      <UiSelect
        :id="`${idPrefix}-max-effort`"
        :model-value="maxEffort"
        :options="reasoningEffortOptions"
        :placeholder="t('admin.groups.form.maxReasoningEffortUnlimited')"
        :aria-label="t('admin.groups.form.maxReasoningEffort')"
        :searchable="false"
        clearable
        @update:model-value="updateMaxEffort"
      />
      <p class="group-field-hint">{{ t("admin.groups.form.maxReasoningEffortHint") }}</p>
    </div>

    <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
      <div class="mb-3 flex items-center justify-between gap-3">
        <label class="group-field-label">
          {{ t("admin.groups.form.reasoningEffortMappings") }}
        </label>
        <UiButton
          type="button"
          density="compact"
          variant="quiet"
          @click="addMapping"
        >
          <template #icon><Icon name="plus" size="sm" /></template>
          {{ t("admin.groups.form.addReasoningEffortMapping") }}
        </UiButton>
      </div>

      <div v-if="mappings.length > 0" class="space-y-2">
        <div
          v-for="row in mappings"
          :key="row.id"
          class="rounded-lg border border-gray-200 bg-gray-50/40 p-3 dark:border-dark-600 dark:bg-dark-800/40"
        >
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-start">
            <div>
              <label :for="`${idPrefix}-${row.id}-from`" class="group-field-label">
                {{ t("admin.groups.form.reasoningEffortFrom") }}
              </label>
              <UiSelect
                :id="`${idPrefix}-${row.id}-from`"
                :model-value="row.from"
                :options="reasoningEffortOptions"
                :placeholder="t('admin.groups.form.reasoningEffortFromPlaceholder')"
                :error="showValidation && validationErrors[row.id]?.from ? mappingErrorText(validationErrors[row.id]?.from) : undefined"
                :aria-label="t('admin.groups.form.reasoningEffortFrom')"
                :aria-describedby="showValidation && validationErrors[row.id]?.from ? `${idPrefix}-${row.id}-from-error` : undefined"
                :searchable="false"
                clearable
                @update:model-value="updateMapping(row.id, 'from', $event)"
              />
              <p
                v-if="showValidation && validationErrors[row.id]?.from"
                :id="`${idPrefix}-${row.id}-from-error`"
                class="mt-1 text-xs text-red-600 dark:text-red-400"
                role="alert"
              >
                {{ mappingErrorText(validationErrors[row.id]?.from) }}
              </p>
            </div>

            <div class="hidden pt-8 text-gray-400 md:block dark:text-dark-400">
              <Icon name="arrowRight" size="sm" />
            </div>

            <div>
              <label :for="`${idPrefix}-${row.id}-to`" class="group-field-label">
                {{ t("admin.groups.form.reasoningEffortTo") }}
              </label>
              <UiSelect
                :id="`${idPrefix}-${row.id}-to`"
                :model-value="row.to"
                :options="reasoningEffortOptions"
                :placeholder="t('admin.groups.form.reasoningEffortToPlaceholder')"
                :error="showValidation && validationErrors[row.id]?.to ? mappingErrorText(validationErrors[row.id]?.to) : undefined"
                :aria-label="t('admin.groups.form.reasoningEffortTo')"
                :aria-describedby="showValidation && validationErrors[row.id]?.to ? `${idPrefix}-${row.id}-to-error` : undefined"
                :searchable="false"
                clearable
                @update:model-value="updateMapping(row.id, 'to', $event)"
              />
              <p
                v-if="showValidation && validationErrors[row.id]?.to"
                :id="`${idPrefix}-${row.id}-to-error`"
                class="mt-1 text-xs text-red-600 dark:text-red-400"
                role="alert"
              >
                {{ mappingErrorText(validationErrors[row.id]?.to) }}
              </p>
            </div>

            <UiIconButton icon="trash" variant="danger" density="compact" :label="t('admin.groups.form.removeReasoningEffortMapping')" @click="removeMapping(row.id)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import Icon from "@/components/icons/Icon.vue";
import { UiButton, UiIconButton, UiSelect } from '@/components/ui';
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
.group-field-label{display:block;color:var(--ui-text-muted);font-size:13px;font-weight:500;line-height:22px}.group-field-hint{margin:4px 0 0;color:var(--ui-text-soft);font-size:12px;line-height:18px}
</style>
