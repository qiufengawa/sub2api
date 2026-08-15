<template>
  <template v-if="platform === 'antigravity'">
    <AppSection
      :title="t('admin.groups.supportedScopes.title')"
      :description="t('admin.groups.supportedScopes.hint')"
      divided
    >
      <template #actions>
        <UiFieldHelp :content="t('admin.groups.supportedScopes.tooltip')" />
      </template>
      <AppStack :gap="8">
        <UiCheckbox :model-value="supportedScopes.includes('claude')" :label="t('admin.groups.supportedScopes.claude')" @update:model-value="toggleScope('claude')" />
        <UiCheckbox :model-value="supportedScopes.includes('gemini_text')" :label="t('admin.groups.supportedScopes.geminiText')" @update:model-value="toggleScope('gemini_text')" />
        <UiCheckbox :model-value="supportedScopes.includes('gemini_image')" :label="t('admin.groups.supportedScopes.geminiImage')" @update:model-value="toggleScope('gemini_image')" />
      </AppStack>
    </AppSection>

    <AppSection :title="t('admin.groups.mcpXml.title')" divided>
      <template #actions>
        <AppInline>
          <UiFieldHelp :content="t('admin.groups.mcpXml.tooltip')" />
          <UiSwitch :model-value="mcpXmlInject" :label="t('admin.groups.mcpXml.title')" @update:model-value="emit('update:mcpXmlInject', $event)" />
        </AppInline>
      </template>
      <UiAlert tone="info" :message="mcpXmlInject ? t('admin.groups.mcpXml.enabled') : t('admin.groups.mcpXml.disabled')" />
    </AppSection>
  </template>

  <AppSection v-if="platform === 'anthropic'" :title="t('admin.groups.claudeCode.title')" divided>
    <template #actions>
      <AppInline>
        <UiFieldHelp :content="t('admin.groups.claudeCode.tooltip')" />
        <UiSwitch :model-value="claudeCodeOnly" :label="t('admin.groups.claudeCode.title')" @update:model-value="emit('update:claudeCodeOnly', $event)" />
      </AppInline>
    </template>
    <AppStack :gap="10">
      <UiAlert tone="info" :message="claudeCodeOnly ? t('admin.groups.claudeCode.enabled') : t('admin.groups.claudeCode.disabled')" />
      <UiSelect
        v-if="claudeCodeOnly"
        :model-value="fallbackGroupId"
        :options="fallbackOptions"
        :label="t('admin.groups.claudeCode.fallbackGroup')"
        :description="t('admin.groups.claudeCode.fallbackHint')"
        :placeholder="t('admin.groups.claudeCode.noFallback')"
        density="compact"
        @update:model-value="emit('update:fallbackGroupId', normalizeGroupId($event))"
      />
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import type { SelectOption, SelectValue } from "@/components/ui";
import {
  AppInline,
  AppSection,
  AppStack,
  UiAlert,
  UiCheckbox,
  UiFieldHelp,
  UiSelect,
  UiSwitch,
} from "@/components/ui";

const props = defineProps<{
  platform: GroupPlatform;
  supportedScopes: string[];
  mcpXmlInject: boolean;
  claudeCodeOnly: boolean;
  fallbackGroupId: number | null;
  fallbackOptions: SelectOption[];
}>();

const emit = defineEmits<{
  "update:supportedScopes": [value: string[]];
  "update:mcpXmlInject": [value: boolean];
  "update:claudeCodeOnly": [value: boolean];
  "update:fallbackGroupId": [value: number | null];
}>();

const { t } = useI18n();

function toggleScope(scope: string) {
  const next = props.supportedScopes.includes(scope)
    ? props.supportedScopes.filter((item) => item !== scope)
    : [...props.supportedScopes, scope];
  emit("update:supportedScopes", next);
}

function normalizeGroupId(value: SelectValue) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
</script>
