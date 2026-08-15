<template>
  <AppSection :title="t('admin.groups.accountFilters.title')" divided>
    <div class="group-account-filter-row">
      <div>
        <strong>{{ t('admin.groups.accountFilters.oauthOnly') }}</strong>
        <small>{{ oauthOnly ? t('admin.groups.accountFilters.oauthOnlyEnabled') : t('admin.groups.accountFilters.disabled') }}</small>
      </div>
      <UiSwitch
        :model-value="oauthOnly"
        :label="t('admin.groups.accountFilters.oauthOnly')"
        @update:model-value="emit('update:oauthOnly', $event)"
      />
    </div>
    <div class="group-account-filter-row">
      <div>
        <strong>{{ t('admin.groups.accountFilters.privacySetOnly') }}</strong>
        <small>{{ privacySetOnly ? t('admin.groups.accountFilters.privacySetOnlyEnabled') : t('admin.groups.accountFilters.disabled') }}</small>
      </div>
      <UiSwitch
        :model-value="privacySetOnly"
        :label="t('admin.groups.accountFilters.privacySetOnly')"
        @update:model-value="emit('update:privacySetOnly', $event)"
      />
    </div>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { AppSection, UiSwitch } from "@/components/ui";

defineProps<{
  oauthOnly: boolean;
  privacySetOnly: boolean;
}>();

const emit = defineEmits<{
  "update:oauthOnly": [value: boolean];
  "update:privacySetOnly": [value: boolean];
}>();

const { t } = useI18n();
</script>

<style scoped>
.group-account-filter-row {
  display: grid;
  min-height: 52px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.group-account-filter-row strong,
.group-account-filter-row small {
  display: block;
}

.group-account-filter-row strong {
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 500;
}

.group-account-filter-row small {
  margin-top: 2px;
  color: var(--ui-text-soft);
  font-size: 11px;
  line-height: 16px;
}
</style>
