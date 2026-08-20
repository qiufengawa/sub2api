<template>
  <div ref="containerRef" class="fast-user-picker">
    <div v-if="selectedUserIds.length > 0" class="fast-user-picker__selection">
      <span
        v-for="userId in selectedUserIds"
        :key="userId"
        class="fast-user-picker__chip"
      >
        <span class="fast-user-picker__chip-label" :title="selectedUserLabel(userId)">
          {{ selectedUserLabel(userId) }}
        </span>
        <span class="fast-user-picker__id">#{{ userId }}</span>
        <UiBadge v-if="selectedUsers[userId]?.deleted">
          {{ t("admin.settings.openaiFastPolicy.userDeleted") }}
        </UiBadge>
        <UiIconButton
          density="mini"
          variant="danger"
          icon="x"
          :label="t('admin.settings.openaiFastPolicy.removeUser')"
          @click="removeUser(userId)"
        />
      </span>
    </div>

    <UiTextField
      v-model="searchQuery"
      type="text"
      density="compact"
      autocomplete="off"
      :placeholder="t('admin.settings.openaiFastPolicy.userSearchPlaceholder')"
      @input="debounceSearch"
      @focus="showDropdown = true"
    >
      <template #prefix><Icon name="search" size="sm" /></template>
    </UiTextField>

    <div
      v-if="showDropdown && searchQuery.trim()"
      class="fast-user-picker__dropdown"
      role="listbox"
      :aria-label="t('admin.settings.openaiFastPolicy.userSearchPlaceholder')"
    >
      <div v-if="searchLoading" class="fast-user-picker__status" aria-live="polite">
        <UiSpinner size="sm" :label="t('common.loading')" />
        <span>{{ t("common.loading") }}</span>
      </div>
      <div v-else-if="availableResults.length === 0" class="fast-user-picker__status">
        {{ t("admin.settings.openaiFastPolicy.userSearchEmpty") }}
      </div>
      <template v-else>
        <button
          v-for="user in availableResults"
          :key="user.id"
          type="button"
          class="fast-user-picker__option ui-focus-ring"
          role="option"
          aria-selected="false"
          @click="selectUser(user)"
        >
          <span class="fast-user-picker__option-label">
            <span>{{ user.email }}</span>
            <UiBadge v-if="user.deleted">
              {{ t("admin.settings.openaiFastPolicy.userDeleted") }}
            </UiBadge>
          </span>
          <span class="fast-user-picker__id">#{{ user.id }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { adminAPI } from "@/api/admin";
import type { SimpleUser } from "@/api/admin/usage";
import Icon from "@/components/icons/Icon.vue";
import { UiBadge, UiIconButton, UiSpinner, UiTextField } from "@/components/ui";

const props = defineProps<{
  modelValue: number[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number[]];
}>();

const { t } = useI18n();
const containerRef = ref<HTMLElement | null>(null);
const searchQuery = ref("");
const searchResults = ref<SimpleUser[]>([]);
const searchLoading = ref(false);
const showDropdown = ref(false);
const selectedUsers = ref<Record<number, SimpleUser>>({});
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchSequence = 0;

const selectedUserIds = computed(() =>
  Array.from(new Set(props.modelValue.filter((id) => Number.isInteger(id) && id > 0))),
);

const availableResults = computed(() => {
  const selected = new Set(selectedUserIds.value);
  return searchResults.value
    .filter((user) => !selected.has(user.id))
    .sort((a, b) => Number(a.deleted) - Number(b.deleted));
});

function selectedUserLabel(userId: number): string {
  return selectedUsers.value[userId]?.email ||
    t("admin.settings.openaiFastPolicy.userIdFallback", { id: userId });
}

function clearPendingSearch(): void {
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  searchSequence += 1;
}

function debounceSearch(): void {
  clearPendingSearch();
  const query = searchQuery.value.trim();
  showDropdown.value = true;
  if (!query) {
    searchResults.value = [];
    searchLoading.value = false;
    return;
  }

  const sequence = searchSequence;
  searchTimer = setTimeout(async () => {
    searchLoading.value = true;
    try {
      const results = await adminAPI.usage.searchUsers(query);
      if (sequence === searchSequence) {
        searchResults.value = results;
      }
    } catch {
      if (sequence === searchSequence) {
        searchResults.value = [];
      }
    } finally {
      if (sequence === searchSequence) {
        searchLoading.value = false;
      }
    }
  }, 300);
}

function selectUser(user: SimpleUser): void {
  selectedUsers.value = { ...selectedUsers.value, [user.id]: user };
  emit("update:modelValue", [...selectedUserIds.value, user.id]);
  clearPendingSearch();
  searchQuery.value = "";
  searchResults.value = [];
  searchLoading.value = false;
  showDropdown.value = false;
}

function removeUser(userId: number): void {
  emit(
    "update:modelValue",
    selectedUserIds.value.filter((id) => id !== userId),
  );
}

async function hydrateSelectedUsers(userIds: number[]): Promise<void> {
  const missing = userIds.filter((id) => !selectedUsers.value[id]);
  if (missing.length === 0) return;

  const users = await Promise.all(
    missing.map(async (id) => {
      try {
        const user = await adminAPI.users.getById(id, true);
        return {
          id: user.id,
          email: user.email,
          deleted: Boolean(user.deleted_at),
        } satisfies SimpleUser;
      } catch {
        return null;
      }
    }),
  );

  const next = { ...selectedUsers.value };
  for (const user of users) {
    if (user && props.modelValue.includes(user.id)) {
      next[user.id] = user;
    }
  }
  selectedUsers.value = next;
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target as Node | null;
  if (target && !containerRef.value?.contains(target)) {
    showDropdown.value = false;
  }
}

watch(
  selectedUserIds,
  (userIds) => {
    void hydrateSelectedUsers(userIds);
  },
  { immediate: true },
);

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onUnmounted(() => {
  clearPendingSearch();
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<style scoped>
.fast-user-picker {
  position: relative;
  min-width: 0;
}

.fast-user-picker__selection {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.fast-user-picker__chip {
  display: inline-flex;
  max-width: 100%;
  min-height: 28px;
  align-items: center;
  gap: 6px;
  padding: 2px 3px 2px 8px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-dense);
  color: var(--ui-text-muted);
  background: var(--ui-surface-muted);
  font-size: 12px;
}

.fast-user-picker__chip-label,
.fast-user-picker__option-label {
  min-width: 0;
  overflow: hidden;
  color: var(--ui-text);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fast-user-picker__chip-label {
  max-width: 256px;
}

.fast-user-picker__id {
  flex: 0 0 auto;
  color: var(--ui-text-soft);
  font-family: var(--ui-font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.fast-user-picker__dropdown {
  position: absolute;
  z-index: 40;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: 0 8px 24px rgb(31 35 41 / 10%);
}

.fast-user-picker__status {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  color: var(--ui-text-soft);
  font-size: 12px;
}

.fast-user-picker__option {
  display: flex;
  width: 100%;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px;
  border: 0;
  border-bottom: 1px solid var(--ui-border-soft);
  color: var(--ui-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-motion-fast);
}

.fast-user-picker__option:last-child {
  border-bottom: 0;
}

.fast-user-picker__option:hover,
.fast-user-picker__option:focus-visible {
  background: var(--ui-surface-muted);
}

.fast-user-picker__option-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}

@media (max-width: 520px) {
  .fast-user-picker__chip {
    width: 100%;
  }

  .fast-user-picker__chip-label {
    max-width: none;
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fast-user-picker__option {
    transition: none;
  }
}
</style>
