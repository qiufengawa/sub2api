<template>
  <AppSection
    :title="t(videoPricingI18nKey('title'))"
    :description="t(videoPricingI18nKey('description'))"
    divided
  >
    <AppStack :gap="12">
      <UiCheckbox
        :model-value="videoRateIndependent"
        :label="t(videoPricingI18nKey('independentMultiplier'))"
        @update:model-value="emit('update:videoRateIndependent', $event)"
      />
      <UiTextField
        v-if="videoRateIndependent"
        :model-value="videoRateMultiplier"
        type="number"
        step="0.0001"
        min="0"
        density="compact"
        :label="t(videoPricingI18nKey('videoMultiplier'))"
        placeholder="1"
        @update:model-value="emitNumber($event)"
      />
      <AppGrid min="120px" :gap="12">
        <UiTextField :model-value="price480p" type="number" step="0.001" min="0" density="compact" label="480p ($/s)" :placeholder="getVideoPricePlaceholder(platform, 'video_price_480p')" @update:model-value="emitNullable('update:price480p', $event)" />
        <UiTextField :model-value="price720p" type="number" step="0.001" min="0" density="compact" label="720p ($/s)" :placeholder="getVideoPricePlaceholder(platform, 'video_price_720p')" @update:model-value="emitNullable('update:price720p', $event)" />
        <UiTextField :model-value="price1080p" type="number" step="0.001" min="0" density="compact" label="1080p ($/s)" :placeholder="getVideoPricePlaceholder(platform, 'video_price_1080p')" @update:model-value="emitNullable('update:price1080p', $event)" />
      </AppGrid>
      <slot name="model-overrides" />
      <UiAlert tone="info" :message="t(videoPricingI18nKey('modeHint'))" />
      <GroupPricingPreview
        :title="t(videoPricingI18nKey('finalPricePreview'))"
        :items="preview"
      />
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import { AppGrid, AppSection, AppStack, UiAlert, UiCheckbox, UiTextField } from "@/components/ui";
import GroupPricingPreview from "./GroupPricingPreview.vue";
import { getVideoPricePlaceholder, videoPricingI18nKey } from "@/views/admin/groupsImagePricing";

defineProps<{
  platform: GroupPlatform;
  videoRateIndependent: boolean;
  videoRateMultiplier: number;
  price480p: number | null;
  price720p: number | null;
  price1080p: number | null;
  preview: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  "update:videoRateIndependent": [value: boolean];
  "update:videoRateMultiplier": [value: number];
  "update:price480p": [value: number | null];
  "update:price720p": [value: number | null];
  "update:price1080p": [value: number | null];
}>();

const { t } = useI18n();
type NullableEvent = "update:price480p" | "update:price720p" | "update:price1080p";

function emitNumber(value: string) {
  const parsed = Number(value);
  emit("update:videoRateMultiplier", Number.isFinite(parsed) ? parsed : 0);
}

function emitNullable(event: NullableEvent, value: string) {
  const parsed = value.trim() === "" ? null : Number(value);
  const normalized = parsed !== null && Number.isFinite(parsed) ? parsed : null;
  if (event === "update:price480p") emit("update:price480p", normalized);
  else if (event === "update:price720p") emit("update:price720p", normalized);
  else emit("update:price1080p", normalized);
}
</script>
