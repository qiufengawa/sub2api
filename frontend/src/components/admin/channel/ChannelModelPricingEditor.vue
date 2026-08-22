<template>
  <AppSection :title="t('admin.channels.form.modelPricing', 'Model Pricing')" divided>
    <template #actions>
      <AppInline>
        <UiButton type="button" density="mini" variant="quiet" :loading="syncing" @click="emit('sync')">
          <template #icon><Icon name="refresh" size="xs" /></template>
          {{ syncing ? t('admin.channels.form.syncingModels') : t('admin.channels.form.syncLatestModels') }}
        </UiButton>
        <UiButton type="button" density="mini" variant="quiet" @click="emit('add')">
          <template #icon><Icon name="plus" size="xs" /></template>
          {{ t('common.add', 'Add') }}
        </UiButton>
      </AppInline>
    </template>

    <UiEmptyState
      v-if="entries.length === 0"
      :title="t('admin.channels.form.noPricingRules', 'No pricing rules yet. Click Add to create one.')"
    />
    <AppStack v-else :gap="8">
      <PricingEntryCard
        v-for="(entry, index) in entries"
        :key="index"
        :entry="entry"
        :platform="platform"
        enable-tier-multipliers
        @update="emit('update', index, $event)"
        @remove="emit('remove', index)"
      />
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import type { PricingFormEntry } from "./types";
import Icon from "@/components/icons/Icon.vue";
import PricingEntryCard from "./PricingEntryCard.vue";
import { AppInline, AppSection, AppStack, UiButton, UiEmptyState } from "@/components/ui";

defineProps<{
  entries: PricingFormEntry[];
  platform: GroupPlatform;
  syncing: boolean;
}>();
const emit = defineEmits<{
  sync: [];
  add: [];
  update: [index: number, entry: PricingFormEntry];
  remove: [index: number];
}>();
const { t } = useI18n();
</script>
