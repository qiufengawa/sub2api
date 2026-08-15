<template>
  <AppSection
    :title="t(imagePricingI18nKey(platform, 'title'))"
    :description="t(imagePricingI18nKey(platform, 'description'))"
    divided
  >
    <AppStack :gap="12">
      <AppGrid min="220px" :gap="8">
        <UiCheckbox
          :model-value="allowImageGeneration"
          :label="t(imagePricingI18nKey(platform, 'allowImageGeneration'))"
          @update:model-value="emit('update:allowImageGeneration', $event)"
        />
        <UiCheckbox
          :model-value="imageRateIndependent"
          :label="t(imagePricingI18nKey(platform, 'independentMultiplier'))"
          @update:model-value="emit('update:imageRateIndependent', $event)"
        />
      </AppGrid>

      <UiTextField
        v-if="imageRateIndependent"
        :model-value="imageRateMultiplier"
        type="number"
        step="0.0001"
        min="0"
        density="compact"
        :label="t(imagePricingI18nKey(platform, 'imageMultiplier'))"
        placeholder="1"
        @update:model-value="emitNumber('update:imageRateMultiplier', $event)"
      />

      <AppGrid min="120px" :gap="12">
        <UiTextField :model-value="price1k" type="number" step="0.001" min="0" density="compact" label="1K ($)" :placeholder="getImagePricePlaceholder(platform, 'image_price_1k')" @update:model-value="emitNullable('update:price1k', $event)" />
        <UiTextField :model-value="price2k" type="number" step="0.001" min="0" density="compact" label="2K ($)" :placeholder="getImagePricePlaceholder(platform, 'image_price_2k')" @update:model-value="emitNullable('update:price2k', $event)" />
        <UiTextField :model-value="price4k" type="number" step="0.001" min="0" density="compact" label="4K ($)" :placeholder="getImagePricePlaceholder(platform, 'image_price_4k')" @update:model-value="emitNullable('update:price4k', $event)" />
      </AppGrid>

      <UiAlert tone="info" :message="t(imagePricingI18nKey(platform, 'modeHint'))" />
      <GroupPricingPreview
        :title="t(imagePricingI18nKey(platform, 'finalPricePreview'))"
        :items="preview"
      />

      <AppSection v-if="platform === 'gemini' && allowImageGeneration" divided>
        <AppStack :gap="10">
          <UiCheckbox
            :model-value="allowBatchImageGeneration"
            :label="t('admin.groups.imagePricing.allowBatchImageGeneration')"
            @update:model-value="emit('update:allowBatchImageGeneration', $event)"
          />
          <UiAlert tone="info" :message="t('admin.groups.imagePricing.batchSectionHint')" />
          <AppGrid v-if="allowBatchImageGeneration" min="180px" :gap="12">
            <UiTextField :model-value="batchDiscountMultiplier" type="number" step="0.0001" min="0" density="compact" :label="t('admin.groups.imagePricing.batchDiscountMultiplier')" placeholder="0.5" @update:model-value="emitNumber('update:batchDiscountMultiplier', $event)" />
            <UiTextField :model-value="batchHoldMultiplier" type="number" step="0.0001" min="0" density="compact" :label="t('admin.groups.imagePricing.batchHoldMultiplier')" placeholder="0.6" @update:model-value="emitNumber('update:batchHoldMultiplier', $event)" />
          </AppGrid>
        </AppStack>
      </AppSection>
      <UiAlert
        v-else-if="platform !== 'gemini'"
        tone="info"
        :message="t('admin.groups.imagePricing.batchGeminiOnlyHint')"
      />
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import { AppGrid, AppSection, AppStack, UiAlert, UiCheckbox, UiTextField } from "@/components/ui";
import GroupPricingPreview from "./GroupPricingPreview.vue";
import { getImagePricePlaceholder, imagePricingI18nKey } from "@/views/admin/groupsImagePricing";

defineProps<{
  platform: GroupPlatform;
  allowImageGeneration: boolean;
  allowBatchImageGeneration: boolean;
  imageRateIndependent: boolean;
  imageRateMultiplier: number;
  batchDiscountMultiplier: number;
  batchHoldMultiplier: number;
  price1k: number | null;
  price2k: number | null;
  price4k: number | null;
  preview: Array<{ label: string; value: string }>;
}>();

const emit = defineEmits<{
  "update:allowImageGeneration": [value: boolean];
  "update:allowBatchImageGeneration": [value: boolean];
  "update:imageRateIndependent": [value: boolean];
  "update:imageRateMultiplier": [value: number];
  "update:batchDiscountMultiplier": [value: number];
  "update:batchHoldMultiplier": [value: number];
  "update:price1k": [value: number | null];
  "update:price2k": [value: number | null];
  "update:price4k": [value: number | null];
}>();

const { t } = useI18n();
type NumberEvent = "update:imageRateMultiplier" | "update:batchDiscountMultiplier" | "update:batchHoldMultiplier";
type NullableEvent = "update:price1k" | "update:price2k" | "update:price4k";

function emitNumber(event: NumberEvent, value: string) {
  const parsed = Number(value);
  const normalized = Number.isFinite(parsed) ? parsed : 0;
  if (event === "update:imageRateMultiplier") {
    emit("update:imageRateMultiplier", normalized);
  } else if (event === "update:batchDiscountMultiplier") {
    emit("update:batchDiscountMultiplier", normalized);
  } else {
    emit("update:batchHoldMultiplier", normalized);
  }
}

function emitNullable(event: NullableEvent, value: string) {
  const parsed = value.trim() === "" ? null : Number(value);
  const normalized = parsed !== null && Number.isFinite(parsed) ? parsed : null;
  if (event === "update:price1k") {
    emit("update:price1k", normalized);
  } else if (event === "update:price2k") {
    emit("update:price2k", normalized);
  } else {
    emit("update:price4k", normalized);
  }
}
</script>
