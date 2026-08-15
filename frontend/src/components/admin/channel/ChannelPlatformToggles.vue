<template>
  <AppSection
    v-if="platform === 'anthropic' && webSearchGlobalEnabled"
    :title="t('admin.channels.form.webSearchEmulation')"
    :description="t('admin.channels.form.webSearchEmulationHint')"
    divided
  >
    <template #actions>
      <UiSwitch :model-value="webSearchEmulation" :label="t('admin.channels.form.webSearchEmulation')" @update:model-value="emit('update:webSearchEmulation', $event)" />
    </template>
  </AppSection>

  <AppSection
    v-if="platform === 'openai'"
    :title="t('admin.channels.form.codexImageGenerationBridge')"
    :description="t('admin.channels.form.codexImageGenerationBridgeHint')"
    divided
  >
    <template #actions>
      <UiSwitch :model-value="codexImageGenerationBridge" :label="t('admin.channels.form.codexImageGenerationBridge')" @update:model-value="emit('update:codexImageGenerationBridge', $event)" />
    </template>
  </AppSection>

  <AppSection
    v-if="platform === 'anthropic'"
    :title="t('admin.channels.form.bedrockCCCompat')"
    :description="t('admin.channels.form.bedrockCCCompatHint')"
    divided
  >
    <template #actions>
      <UiSwitch :model-value="bedrockCcCompat" :label="t('admin.channels.form.bedrockCCCompat')" @update:model-value="emit('update:bedrockCcCompat', $event)" />
    </template>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import { AppSection, UiSwitch } from "@/components/ui";

defineProps<{
  platform: GroupPlatform;
  webSearchGlobalEnabled: boolean;
  webSearchEmulation: boolean;
  codexImageGenerationBridge: boolean;
  bedrockCcCompat: boolean;
}>();

const emit = defineEmits<{
  "update:webSearchEmulation": [value: boolean];
  "update:codexImageGenerationBridge": [value: boolean];
  "update:bedrockCcCompat": [value: boolean];
}>();
const { t } = useI18n();
</script>
