<template>
  <UiDialog
    :show="show"
    :title="t('admin.accounts.dataImportTitle')"
    width="normal"
    close-on-click-outside
    @close="handleClose"
  >
    <form
      id="import-data-form"
      class="space-y-4"
      @submit.prevent="handleImport"
    >
      <div class="text-sm text-gray-600 dark:text-dark-300">
        {{ t("admin.accounts.dataImportHint") }}
      </div>
      <div
        class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
      >
        {{ t("admin.accounts.dataImportWarning") }}
      </div>
      <div
        class="rounded-lg border border-primary-200 bg-primary-50 p-3 text-xs text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300"
      >
        {{ t("admin.accounts.dataImportPriorityCompatibility") }}
      </div>
      <div
        v-if="legacyPreview"
        class="border-l-2 border-amber-400 pl-3 text-xs text-amber-700 dark:text-amber-300"
      >
        {{ t("admin.accounts.dataImportLegacyPriorityPreview") }}
      </div>

      <div>
        <label class="input-label">{{
          t("admin.accounts.dataImportFile")
        }}</label>
        <div
          class="flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors"
          :class="
            dragActive
              ? 'border-primary-400 bg-primary-50/70 dark:border-primary-500 dark:bg-primary-900/20'
              : 'border-gray-300 bg-gray-50 dark:border-dark-600 dark:bg-dark-800'
          "
          @dragenter.prevent="handleDragEnter"
          @dragover.prevent
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <div class="min-w-0">
            <div
              class="truncate text-sm text-gray-700 dark:text-dark-200"
              :title="fileListTitle"
            >
              {{
                selectedFilesLabel || t("admin.accounts.dataImportSelectFile")
              }}
            </div>
            <div class="text-xs text-gray-500 dark:text-dark-400">
              JSON (.json)
              <span v-if="files.length > 1"> · {{ fileListTitle }}</span>
            </div>
          </div>
          <UiButton
            type="button"
            variant="secondary"
            class="shrink-0"
            @click="openFilePicker"
          >
            {{ t("common.chooseFile") }}
          </UiButton>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept="application/json,.json"
          multiple
          @change="handleFileChange"
        />
      </div>

      <div
        v-if="result"
        class="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-dark-700"
      >
        <div class="text-sm font-medium text-gray-900 dark:text-white">
          {{ t("admin.accounts.dataImportResult") }}
        </div>
        <div class="text-sm text-gray-700 dark:text-dark-300">
          {{ t("admin.accounts.dataImportResultSummary", result) }}
        </div>
        <div
          v-if="result.legacy_priority_migrated"
          class="rounded-lg border border-primary-200 bg-primary-50 p-3 text-xs text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300"
        >
          {{ t("admin.accounts.dataImportLegacyPriorityMigrated") }}
        </div>

        <div v-if="errorItems.length" class="mt-2">
          <div class="text-sm font-medium text-red-600 dark:text-red-400">
            {{ t("admin.accounts.dataImportErrors") }}
          </div>
          <div
            class="mt-2 max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-dark-800"
          >
            <div
              v-for="(item, idx) in errorItems"
              :key="idx"
              class="whitespace-pre-wrap"
            >
              {{ item.kind }} {{ item.name || item.proxy_key || "-" }} —
              {{ item.message }}
            </div>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton
          type="button"
          :disabled="importing"
          @click="handleClose"
        >
          {{ t("common.cancel") }}
        </UiButton>
        <UiButton
          variant="primary"
          type="submit"
          form="import-data-form"
          :loading="importing"
        >
          {{
            importing
              ? t("admin.accounts.dataImporting")
              : t("admin.accounts.dataImportButton")
          }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { UiButton, UiDialog } from "@/components/ui";
import { adminAPI } from "@/api/admin";
import { useAppStore } from "@/stores/app";
import type { AdminDataImportResult, AdminDataPayload } from "@/types";

interface Props {
  show: boolean;
}

interface Emits {
  (e: "close"): void;
  (e: "imported"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const appStore = useAppStore();

const importing = ref(false);
const files = ref<File[]>([]);
const dragDepth = ref(0);
const dragActive = computed(() => dragDepth.value > 0);
const hasCreatedData = ref(false);
const result = ref<AdminDataImportResult | null>(null);
const legacyPreview = ref(false);

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFilesLabel = computed(() => {
  if (files.value.length === 0) return "";
  if (files.value.length === 1) return files.value[0]?.name || "";
  return t("admin.accounts.selectedCount", { count: files.value.length });
});
const fileListTitle = computed(() =>
  files.value.map((item) => item.name).join(", "),
);

const errorItems = computed(() => result.value?.errors || []);

watch(
  () => props.show,
  (open) => {
    if (open) {
      files.value = [];
      dragDepth.value = 0;
      hasCreatedData.value = false;
      result.value = null;
      legacyPreview.value = false;
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    }
  },
);

const openFilePicker = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  setSelectedFiles(target.files);
  target.value = "";
};

const handleClose = () => {
  if (importing.value) return;
  if (hasCreatedData.value) {
    hasCreatedData.value = false;
    emit("imported");
  }
  emit("close");
};

const isJsonFile = (sourceFile: File) => {
  const name = sourceFile.name.toLowerCase();
  return name.endsWith(".json") || sourceFile.type === "application/json";
};

const setSelectedFiles = (
  sourceFiles: FileList | File[] | null | undefined,
) => {
  if (importing.value) return;
  const incoming = Array.from(sourceFiles || []);
  const picked = incoming.filter(isJsonFile);
  if (!picked.length) {
    appStore.showError(t("admin.accounts.dataImportSelectFile"));
    return;
  }
  if (picked.length < incoming.length) {
    appStore.showWarning(
      t("admin.accounts.dataImportIgnoredFiles", {
        count: incoming.length - picked.length,
      }),
    );
  }
  files.value = picked;
  result.value = null;
};

const handleDragEnter = () => {
  if (importing.value) return;
  dragDepth.value += 1;
};

const handleDragLeave = () => {
  dragDepth.value = Math.max(0, dragDepth.value - 1);
};

const handleDrop = (event: DragEvent) => {
  dragDepth.value = 0;
  if (importing.value) return;
  setSelectedFiles(event.dataTransfer?.files);
};

const readFileAsText = async (sourceFile: File): Promise<string> => {
  if (typeof sourceFile.text === "function") {
    return sourceFile.text();
  }

  if (typeof sourceFile.arrayBuffer === "function") {
    const buffer = await sourceFile.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read file"));
    reader.readAsText(sourceFile);
  });
};

const SUPPORTED_DATA_TYPES = ["sub2api-data", "sub2api-bundle"];
const SUPPORTED_DATA_VERSION = 2;
const HIGHER_WINS_PRIORITY_SEMANTICS = "higher_wins";
const LOWER_WINS_PRIORITY_SEMANTICS = "lower_wins";
const ACCOUNT_PRIORITY_MAX = 2_147_483_647;
const PRIORITY_TOKEN_PATTERN = /"(?:priority|priority_pivot)"\s*:\s*([^,}\]\s]+)/g;

const hasCanonicalPriorityTokens = (raw: string): boolean => {
  for (const match of raw.matchAll(PRIORITY_TOKEN_PATTERN)) {
    const token = match[1] || "";
    if (!/^(?:0|[1-9]\d*)$/.test(token)) return false;
    const value = Number(token);
    if (!Number.isSafeInteger(value) || value > ACCOUNT_PRIORITY_MAX) return false;
  }
  return true;
};

const hasValidAccountPriorities = (candidate: Record<string, unknown>): boolean => {
  const accounts = candidate.accounts as Array<Record<string, unknown>>;
  return accounts.every((account) => {
    if (!("priority" in account)) return true;
    const value = account.priority;
    return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= ACCOUNT_PRIORITY_MAX;
  });
};

// 与后端 validateDataHeader 对齐:合并前逐文件校验,避免坏文件混入合并 payload 后
// 报错无法定位来源,或绕过后端本会对单文件做的 type/version 检查。
const isValidDataPayload = (payload: unknown): payload is AdminDataPayload => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return false;
  const candidate = payload as Record<string, unknown>;
  if (
    candidate.type !== undefined &&
    candidate.type !== "" &&
    !SUPPORTED_DATA_TYPES.includes(candidate.type as string)
  ) {
    return false;
  }
  if (candidate.version !== 1 && candidate.version !== SUPPORTED_DATA_VERSION) {
    return false;
  }
  const version = Number(candidate.version);
  const semantics = candidate.priority_semantics;
  if (version >= SUPPORTED_DATA_VERSION) {
    if (semantics !== HIGHER_WINS_PRIORITY_SEMANTICS) return false;
  } else {
    if (semantics !== LOWER_WINS_PRIORITY_SEMANTICS) return false;
    if (!Number.isInteger(candidate.priority_pivot) || Number(candidate.priority_pivot) < 0 || Number(candidate.priority_pivot) > ACCOUNT_PRIORITY_MAX) {
      return false;
    }
  }
  return Array.isArray(candidate.proxies) && Array.isArray(candidate.accounts) && hasValidAccountPriorities(candidate);
};

const mergeDataPayloads = (payloads: AdminDataPayload[]): AdminDataPayload => {
  const [firstPayload] = payloads;
  if (payloads.length === 1 && firstPayload) return firstPayload;

  return {
    type: payloads.find((item) => typeof item.type === "string")?.type,
    version: payloads.find((item) => typeof item.version === "number")?.version,
    priority_semantics: firstPayload?.priority_semantics,
    priority_pivot: firstPayload?.priority_pivot,
    exported_at: new Date().toISOString(),
    proxies: payloads.flatMap((item) => item.proxies),
    accounts: payloads.flatMap((item) => item.accounts),
    skipped_shadows: payloads.reduce((sum, item) => {
      const count = Number(item.skipped_shadows || 0);
      return Number.isFinite(count) ? sum + count : sum;
    }, 0),
  };
};

const handleImport = async () => {
  if (files.value.length === 0) {
    appStore.showError(t("admin.accounts.dataImportSelectFile"));
    return;
  }

  importing.value = true;
  try {
    const dataPayloads: AdminDataPayload[] = [];
    legacyPreview.value = false;
    for (const sourceFile of files.value) {
      let parsed: unknown;
      try {
        const raw = await readFileAsText(sourceFile);
        if (!hasCanonicalPriorityTokens(raw)) {
          appStore.showError(t("admin.accounts.dataImportInvalidPriorityFile", { name: sourceFile.name }));
          return;
        }
        parsed = JSON.parse(raw);
      } catch {
        appStore.showError(
          t("admin.accounts.dataImportParseFailedFile", {
            name: sourceFile.name,
          }),
        );
        return;
      }
      if (!isValidDataPayload(parsed)) {
        appStore.showError(
          t("admin.accounts.dataImportInvalidFile", { name: sourceFile.name }),
        );
        return;
      }
      dataPayloads.push(parsed);
      if (Number(parsed.version) === 1) legacyPreview.value = true;
    }
    const versions = new Set(
      dataPayloads.map((payload) => Number(payload.version || 0)),
    );
    if (versions.size > 1) {
      appStore.showError(t("admin.accounts.dataImportMixedVersions"));
      return;
    }
    const prioritySemantics = new Set(
      dataPayloads.map((payload) =>
        Number(payload.version || 0) >= SUPPORTED_DATA_VERSION
          ? payload.priority_semantics
          : payload.priority_semantics || LOWER_WINS_PRIORITY_SEMANTICS,
      ),
    );
    if (prioritySemantics.size > 1) {
      appStore.showError(t("admin.accounts.dataImportMixedPrioritySemantics"));
      return;
    }
    if (Number(dataPayloads[0]?.version) === 1) {
      const priorityPivots = new Set(dataPayloads.map((payload) => payload.priority_pivot));
      if (priorityPivots.size > 1) {
        appStore.showError(t("admin.accounts.dataImportMixedPriorityPivots"));
        return;
      }
    }
    const dataPayload = mergeDataPayloads(dataPayloads);

    const res = await adminAPI.accounts.importData({
      data: dataPayload,
      skip_default_group_bind: true,
    });

    result.value = res;

    const msgParams: Record<string, unknown> = {
      account_created: res.account_created,
      account_failed: res.account_failed,
      proxy_created: res.proxy_created,
      proxy_reused: res.proxy_reused,
      proxy_failed: res.proxy_failed,
    };
    if (res.account_failed > 0 || res.proxy_failed > 0) {
      // 部分成功也创建了数据;弹窗关闭时通过 imported 通知父组件刷新列表
      if (res.account_created > 0 || res.proxy_created > 0) {
        hasCreatedData.value = true;
      }
      appStore.showError(
        t("admin.accounts.dataImportCompletedWithErrors", msgParams),
      );
    } else {
      appStore.showSuccess(t("admin.accounts.dataImportSuccess", msgParams));
      emit("imported");
    }
  } catch (error: any) {
    appStore.showError(error?.message || t("admin.accounts.dataImportFailed"));
  } finally {
    importing.value = false;
  }
};
</script>
