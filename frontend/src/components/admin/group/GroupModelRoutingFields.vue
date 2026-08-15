<template>
  <AppSection
    :title="t('admin.groups.modelRouting.title')"
    :description="
      enabled
        ? t('admin.groups.modelRouting.noRulesHint')
        : t('admin.groups.modelRouting.disabledHint')
    "
    divided
  >
    <template #actions>
      <AppInline>
        <UiFieldHelp :content="t('admin.groups.modelRouting.tooltip')" />
        <UiSwitch
          :model-value="enabled"
          :label="t('admin.groups.modelRouting.title')"
          @update:model-value="emit('update:enabled', $event)"
        />
      </AppInline>
    </template>

    <template v-if="enabled">
      <UiEmptyState
        v-if="rules.length === 0"
        :title="t('admin.groups.modelRouting.noRulesHint')"
      >
        <template #action>
          <UiButton type="button" density="compact" variant="quiet" @click="emit('add')">
            {{ t('admin.groups.modelRouting.addRule') }}
          </UiButton>
        </template>
      </UiEmptyState>

      <AppStack v-else :gap="4">
        <div v-for="rule in rules" :key="rowKey(rule)" class="group-routing-rule">
          <AppStack :gap="8">
            <UiTextField
              v-model="rule.pattern"
              :label="t('admin.groups.modelRouting.modelPattern')"
              :placeholder="t('admin.groups.modelRouting.modelPatternPlaceholder')"
              density="compact"
              monospace
            />

            <AppInline v-if="rule.accounts.length > 0">
              <UiBadge v-for="account in rule.accounts" :key="account.id" tone="neutral">
                {{ account.name }}
                <UiIconButton
                  icon="x"
                  variant="danger"
                  density="mini"
                  :label="t('common.remove')"
                  type="button"
                  @click="emit('removeAccount', rule, account.id)"
                />
              </UiBadge>
            </AppInline>

            <UiAsyncEntityPicker
              :key="`${searchKey(rule)}-${rule.accounts.length}`"
              :model-value="null"
              :items="accountOptions(rule)"
              :placeholder="t('admin.groups.modelRouting.searchAccountPlaceholder')"
              :empty-text="t('common.noData')"
              :loading-text="t('common.loading')"
              search-on-focus
              show-results-without-query
              clear-after-select
              @search="emit('search', rule, $event)"
              @select="emit('select', rule, $event)"
            />
          </AppStack>
          <UiIconButton
            icon="trash"
            variant="danger"
            density="compact"
            :label="t('admin.groups.modelRouting.removeRule')"
            type="button"
            @click="emit('removeRule', rule)"
          />
        </div>
      </AppStack>

      <UiButton type="button" density="compact" variant="secondary" @click="emit('add')">
        <template #icon><Icon name="plus" size="sm" /></template>
        {{ t('admin.groups.modelRouting.addRule') }}
      </UiButton>
    </template>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { UiEntityOption } from "@/components/ui";
import Icon from "@/components/icons/Icon.vue";
import {
  AppInline,
  AppSection,
  AppStack,
  UiAsyncEntityPicker,
  UiBadge,
  UiButton,
  UiEmptyState,
  UiFieldHelp,
  UiIconButton,
  UiSwitch,
  UiTextField,
} from "@/components/ui";
import type { GroupModelRoutingRule } from "./groupModelRoutingTypes";

defineProps<{
  enabled: boolean;
  rules: GroupModelRoutingRule[];
  rowKey: (rule: GroupModelRoutingRule) => string;
  searchKey: (rule: GroupModelRoutingRule) => string;
  accountOptions: (rule: GroupModelRoutingRule) => UiEntityOption[];
}>();

const emit = defineEmits<{
  "update:enabled": [value: boolean];
  add: [];
  removeRule: [rule: GroupModelRoutingRule];
  removeAccount: [rule: GroupModelRoutingRule, accountId: number];
  search: [rule: GroupModelRoutingRule, query: string];
  select: [rule: GroupModelRoutingRule, option: UiEntityOption];
}>();

const { t } = useI18n();
</script>

<style scoped>
.group-routing-rule {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}
</style>
