<template>
  <AppSection :title="t('admin.channels.form.accountStatsPricingRules')" divided>
    <template #actions>
      <UiButton type="button" density="mini" variant="quiet" @click="emit('addRule')">
        <template #icon><Icon name="plus" size="xs" /></template>
        {{ t('admin.channels.form.addRule') }}
      </UiButton>
    </template>

    <UiEmptyState
      v-if="rules.length === 0"
      :title="t('admin.channels.form.noRulesConfigured')"
    />

    <AppStack v-else :gap="8">
      <div v-for="(rule, ruleIndex) in rules" :key="ruleIndex" class="channel-stats-rule">
        <AppInline :wrap="false">
          <UiTextField
            density="mini"
            :model-value="rule.name"
            :placeholder="t('admin.channels.form.ruleName')"
            @update:model-value="emit('updateName', ruleIndex, $event)"
          />
          <UiIconButton icon="trash" :label="t('common.delete')" variant="danger" density="mini" @click="emit('removeRule', ruleIndex)" />
        </AppInline>

        <AppSection :title="t('admin.channels.form.ruleGroups')" divided>
          <UiAlert v-if="groupIds.length === 0" tone="info" :message="t('admin.channels.form.noGroupsInChannel')" />
          <AppInline v-else>
            <UiCheckbox
              v-for="groupId in groupIds"
              :key="groupId"
              :model-value="rule.group_ids.includes(groupId)"
              :label="getGroupName(groupId)"
              @update:model-value="emit('toggleGroup', ruleIndex, groupId)"
            />
          </AppInline>
        </AppSection>

        <AppSection
          :title="t('admin.channels.form.ruleAccounts')"
          :description="t('admin.channels.form.ruleAccountsHint')"
          divided
        >
          <AppStack :gap="8">
            <AppInline v-if="rule.account_ids.length > 0">
              <UiBadge v-for="accountId in rule.account_ids" :key="accountId" tone="neutral">
                {{ getAccountLabel(accountId) }}
                <UiIconButton icon="x" :label="t('common.remove')" variant="danger" density="mini" @click="emit('removeAccount', ruleIndex, accountId)" />
              </UiBadge>
            </AppInline>
            <UiAsyncEntityPicker
              :key="`${platform}-${ruleIndex}-${rule.account_ids.length}`"
              :model-value="null"
              :items="accountOptions(ruleIndex)"
              :placeholder="t('admin.channels.form.searchAccountPlaceholder')"
              clear-after-select
              @search="emit('searchAccount', ruleIndex, $event)"
              @select="emit('selectAccount', ruleIndex, $event)"
            />
          </AppStack>
        </AppSection>

        <AppSection :title="t('admin.channels.form.ruleModelPricing')">
          <template #actions>
            <UiButton type="button" density="mini" variant="quiet" @click="emit('addPricing', ruleIndex)">
              <template #icon><Icon name="plus" size="xs" /></template>
              {{ t('common.add') }}
            </UiButton>
          </template>
          <UiEmptyState v-if="rule.pricing.length === 0" :title="t('admin.channels.form.noPricingRules')" />
          <AppStack v-else :gap="8">
            <PricingEntryCard
              v-for="(entry, pricingIndex) in rule.pricing"
              :key="pricingIndex"
              :entry="entry"
              :platform="platform"
              @update="emit('updatePricing', ruleIndex, pricingIndex, $event)"
              @remove="emit('removePricing', ruleIndex, pricingIndex)"
            />
          </AppStack>
        </AppSection>
      </div>
    </AppStack>
  </AppSection>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { GroupPlatform } from "@/types";
import type { UiEntityOption } from "@/components/ui";
import type { PricingFormEntry } from "./types";
import Icon from "@/components/icons/Icon.vue";
import PricingEntryCard from "./PricingEntryCard.vue";
import {
  AppInline,
  AppSection,
  AppStack,
  UiAlert,
  UiAsyncEntityPicker,
  UiBadge,
  UiButton,
  UiCheckbox,
  UiEmptyState,
  UiIconButton,
  UiTextField,
} from "@/components/ui";

export interface ChannelStatsPricingRuleForm {
  name: string;
  group_ids: number[];
  account_ids: number[];
  pricing: PricingFormEntry[];
}

defineProps<{
  rules: ChannelStatsPricingRuleForm[];
  groupIds: number[];
  platform: GroupPlatform;
  getGroupName: (groupId: number) => string;
  getAccountLabel: (accountId: number) => string;
  accountOptions: (ruleIndex: number) => UiEntityOption[];
}>();

const emit = defineEmits<{
  addRule: [];
  removeRule: [ruleIndex: number];
  updateName: [ruleIndex: number, name: string];
  toggleGroup: [ruleIndex: number, groupId: number];
  removeAccount: [ruleIndex: number, accountId: number];
  searchAccount: [ruleIndex: number, query: string];
  selectAccount: [ruleIndex: number, option: UiEntityOption];
  addPricing: [ruleIndex: number];
  updatePricing: [ruleIndex: number, pricingIndex: number, entry: PricingFormEntry];
  removePricing: [ruleIndex: number, pricingIndex: number];
}>();
const { t } = useI18n();
</script>

<style scoped>
.channel-stats-rule {
  display: grid;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-border-soft);
}
</style>
