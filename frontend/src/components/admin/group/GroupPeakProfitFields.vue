<template>
  <AppSection divided>
    <AppStack :gap="12">
      <UiCheckbox
        :model-value="peakEnabled"
        :label="t('admin.groups.peakRate.enable')"
        @update:model-value="emit('update:peakEnabled', $event)"
      />
      <AppGrid v-if="peakEnabled" min="150px" :gap="12">
        <UiTextField :model-value="peakStart" type="time" density="compact" :label="t('admin.groups.peakRate.peakStart')" @update:model-value="emit('update:peakStart', $event)" />
        <UiTextField :model-value="peakEnd" type="time" density="compact" :label="t('admin.groups.peakRate.peakEnd')" @update:model-value="emit('update:peakEnd', $event)" />
        <UiTextField :model-value="peakMultiplier" type="number" step="0.001" min="0" density="compact" :label="t('admin.groups.peakRate.peakMultiplier')" :help="t('admin.groups.peakRate.multiplierHint')" placeholder="1" @update:model-value="emitNumber('update:peakMultiplier', $event)" />
      </AppGrid>
    </AppStack>
  </AppSection>

  <AppSection v-if="isProfitControlPlatform(platform)" divided>
    <AppStack :gap="12">
      <UiCheckbox
        :model-value="profitEnabled"
        :label="t('admin.groups.profitControl.enable')"
        @update:model-value="emit('update:profitEnabled', $event)"
      />
      <UiAlert
        tone="info"
        :message="profitEnabled ? t('admin.groups.profitControl.enabledHint') : t('admin.groups.profitControl.disabledHint')"
      />
      <AppGrid v-if="profitEnabled" min="180px" :gap="12">
        <UiTextField :model-value="minMargin" type="number" step="0.1" min="0" max="99.99" density="compact" :label="t('admin.groups.profitControl.minMargin')" :help="t('admin.groups.profitControl.minMarginHint')" placeholder="0" @update:model-value="emitNumber('update:minMargin', $event)" />
        <UiTextField :model-value="safetyBuffer" type="number" step="0.1" min="0" max="99.99" density="compact" :label="t('admin.groups.profitControl.safetyBuffer')" :help="t('admin.groups.profitControl.safetyBufferHint')" placeholder="0" @update:model-value="emitNumber('update:safetyBuffer', $event)" />
      </AppGrid>
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import { AppGrid, AppSection, AppStack, UiAlert, UiCheckbox, UiTextField } from "@/components/ui";
import { isProfitControlPlatform } from "@/views/admin/groupsProfitControl";

defineProps<{
  platform: GroupPlatform;
  peakEnabled: boolean;
  peakStart: string;
  peakEnd: string;
  peakMultiplier: number;
  profitEnabled: boolean;
  minMargin: number;
  safetyBuffer: number;
}>();

const emit = defineEmits<{
  "update:peakEnabled": [value: boolean];
  "update:peakStart": [value: string];
  "update:peakEnd": [value: string];
  "update:peakMultiplier": [value: number];
  "update:profitEnabled": [value: boolean];
  "update:minMargin": [value: number];
  "update:safetyBuffer": [value: number];
}>();

const { t } = useI18n();
type NumberEvent = "update:peakMultiplier" | "update:minMargin" | "update:safetyBuffer";
function emitNumber(event: NumberEvent, value: string) {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) ? parsed : 0;
  if (event === "update:peakMultiplier") emit("update:peakMultiplier", normalized);
  else if (event === "update:minMargin") emit("update:minMargin", normalized);
  else emit("update:safetyBuffer", normalized);
}
</script>
