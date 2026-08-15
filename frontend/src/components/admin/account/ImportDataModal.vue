<template>
  <UiDialog
    :show="show"
    :title="t('admin.accounts.dataImportTitle')"
    width="normal"
    close-on-click-outside
    @close="handleClose"
  >
    <form id="import-data-form" class="import-data" @submit.prevent="handleImport">
      <p class="import-data__intro">
        {{ t("admin.accounts.dataImportHint") }}
      </p>
      <UiAlert tone="warning">
        {{ t("admin.accounts.dataImportWarning") }}
      </UiAlert>
      <UiAlert tone="info">
        {{ t("admin.accounts.dataImportPriorityCompatibility") }}
      </UiAlert>
      <UiAlert v-if="legacyPreview" tone="warning">
        {{ t("admin.accounts.dataImportLegacyPriorityPreview") }}
      </UiAlert>

      <UiFileUpload
        :label="t('admin.accounts.dataImportFile')"
        :description="selectedFilesLabel || t('admin.accounts.dataImportSelectFile')"
        :button-text="t('common.chooseFile')"
        accept="application/json,.json"
        accept-text="JSON (.json)"
        multiple
        :disabled="importing"
        @select="setSelectedFiles"
      />
      <UiDescriptionList
        v-if="files.length"
        :columns="1"
        :items="[{ label: t('admin.accounts.dataImportFile'), value: fileListTitle }]"
      />

      <AppStack v-if="result" :gap="10">
        <UiReviewSummary
          :title="t('admin.accounts.dataImportResult')"
          :description="t('admin.accounts.dataImportResultSummary', result)"
          :valid="errorItems.length === 0"
          :items="resultSummaryItems"
        />
        <UiAlert v-if="result.legacy_priority_migrated" tone="info">
          {{ t("admin.accounts.dataImportLegacyPriorityMigrated") }}
        </UiAlert>

        <UiCodeBlock v-if="errorItems.length" :label="t('admin.accounts.dataImportErrors')" :code="errorDetails" />
      </AppStack>
    </form>

    <template #footer>
      <div class="import-data__actions">
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
import {
  AppStack,
  UiAlert,
  UiButton,
  UiCodeBlock,
  UiDescriptionList,
  UiDialog,
  UiFileUpload,
  UiReviewSummary,
} from "@/components/ui";
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
const hasCreatedData = ref(false);
const result = ref<AdminDataImportResult | null>(null);
const legacyPreview = ref(false);

const selectedFilesLabel = computed(() => {
  if (files.value.length === 0) return "";
  if (files.value.length === 1) return files.value[0]?.name || "";
  return t("admin.accounts.selectedCount", { count: files.value.length });
});
const fileListTitle = computed(() =>
  files.value.map((item) => item.name).join(", "),
);

const errorItems = computed(() => result.value?.errors || []);
const resultSummaryItems = computed(() => result.value ? [
  { label: "account_created", value: result.value.account_created, numeric: true },
  { label: "account_failed", value: result.value.account_failed, numeric: true },
  { label: "proxy_created", value: result.value.proxy_created, numeric: true },
  { label: "proxy_reused", value: result.value.proxy_reused, numeric: true },
] : []);
const errorDetails = computed(() => errorItems.value.map((item) =>
  `${item.kind} ${item.name || item.proxy_key || "-"} - ${item.message}`,
).join("\n"));

watch(
  () => props.show,
  (open) => {
    if (open) {
      files.value = [];
      hasCreatedData.value = false;
      result.value = null;
      legacyPreview.value = false;
    }
  },
);

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

<style scoped>
.import-data{display:flex;min-width:0;flex-direction:column;gap:12px}.import-data__intro{margin:0;color:var(--ui-text-muted);font-size:13px;line-height:21px}.import-data__actions{display:flex;width:100%;justify-content:flex-end;gap:8px}
@media(max-width:520px){.import-data__actions{display:grid;grid-template-columns:1fr 1fr}.import-data__actions :deep(.ui-button){width:100%}}
</style>
