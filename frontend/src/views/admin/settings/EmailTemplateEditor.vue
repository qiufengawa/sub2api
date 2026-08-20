<template>
  <section class="email-editor" aria-labelledby="email-template-title">
    <header class="email-editor__header">
      <div class="email-editor__heading">
        <h2 id="email-template-title">{{ t("admin.settings.emailTemplates.title") }}</h2>
        <p>{{ t("admin.settings.emailTemplates.description") }}</p>
      </div>
      <div class="email-editor__actions">
        <UiButton
          density="compact"
          :loading="previewing"
          :disabled="loadingTemplate || !canPreview"
          @click="refreshPreview"
        >
          {{ t("admin.settings.emailTemplates.preview") }}
        </UiButton>
        <UiButton
          density="compact"
          :loading="restoring"
          :disabled="loadingTemplate || !selectedEvent || !selectedLocale"
          @click="requestRestoreOfficial"
        >
          {{ t("admin.settings.emailTemplates.restoreOfficial") }}
        </UiButton>
        <UiButton
          variant="primary"
          density="compact"
          :loading="saving"
          :disabled="loadingTemplate || !canSave"
          @click="saveTemplate"
        >
          {{ t("admin.settings.emailTemplates.save") }}
        </UiButton>
      </div>
    </header>

    <div v-if="loadingList" class="email-editor__loading" aria-live="polite">
      <UiSpinner size="sm" :label="t('common.loading')" />
      <span>{{ t("common.loading") }}</span>
    </div>

    <div v-else class="email-editor__body">
      <div class="email-editor__selectors">
        <UiSelect
          id="email-template-event"
          v-model="selectedEvent"
          :label="t('admin.settings.emailTemplates.event')"
          :options="eventSelectOptions"
          density="compact"
          :disabled="loadingTemplate || eventOptions.length === 0"
        />
        <UiSelect
          id="email-template-locale"
          v-model="selectedLocale"
          :label="t('admin.settings.emailTemplates.locale')"
          :options="localeSelectOptions"
          density="compact"
          :disabled="loadingTemplate || localeOptions.length === 0"
        />
      </div>

      <div v-if="selectedEventMeta" class="email-editor__meta">
        <div class="email-editor__meta-title">
          <strong>{{ selectedEventMeta.label }}</strong>
          <UiBadge>{{ selectedEventMeta.categoryLabel }}</UiBadge>
          <UiBadge :tone="selectedEventMeta.optional ? 'warning' : 'success'">
            {{ selectedEventMeta.optional ? localText("可退订通知", "Optional") : localText("事务邮件", "Transactional") }}
          </UiBadge>
        </div>
        <p>{{ selectedEventMeta.timing }}</p>
        <small v-if="selectedEventDescription">{{ selectedEventDescription }}</small>
      </div>

      <UiAlert
        v-if="!eventOptions.length || !localeOptions.length"
        tone="warning"
        :message="t('admin.settings.emailTemplates.empty')"
      />

      <div v-else class="email-editor__workspace">
        <div class="email-editor__form">
          <UiTextField
            id="email-template-subject"
            v-model="subject"
            :label="t('admin.settings.emailTemplates.subject')"
            :disabled="loadingTemplate"
            :placeholder="t('admin.settings.emailTemplates.subjectPlaceholder')"
          />

          <UiTextArea
            id="email-template-html"
            v-model="html"
            :label="t('admin.settings.emailTemplates.html')"
            :disabled="loadingTemplate"
            :placeholder="t('admin.settings.emailTemplates.htmlPlaceholder')"
            :rows="20"
            monospace
          />

          <section class="email-editor__placeholders" aria-labelledby="email-template-placeholders">
            <div>
              <h3 id="email-template-placeholders">{{ t("admin.settings.emailTemplates.placeholders") }}</h3>
              <p>{{ t("admin.settings.emailTemplates.placeholdersHelp") }}</p>
            </div>
            <div class="email-editor__placeholder-list">
              <UiButton
                v-for="placeholder in placeholderList"
                :key="placeholder"
                type="button"
                variant="quiet"
                density="dense"
                class="email-editor__placeholder ui-focus-ring"
                @click="copyPlaceholder(placeholder)"
              >
                {{ placeholder }}
              </UiButton>
            </div>
          </section>
        </div>

        <aside class="email-editor__preview" aria-labelledby="email-template-preview">
          <header class="email-editor__preview-header">
            <div>
              <h3 id="email-template-preview">{{ t("admin.settings.emailTemplates.livePreview") }}</h3>
              <p>{{ previewSubject || t("admin.settings.emailTemplates.noPreview") }}</p>
            </div>
            <UiBadge v-if="isCustomTemplate" tone="info">
              {{ t("admin.settings.emailTemplates.customized") }}
            </UiBadge>
          </header>
          <div class="email-editor__preview-stage">
            <iframe
              sandbox=""
              :srcdoc="previewHtml"
              :title="t('admin.settings.emailTemplates.livePreview')"
            />
          </div>
          <p class="email-editor__security-hint">
            {{ t("admin.settings.emailTemplates.previewSecurityHint") }}
          </p>
        </aside>
      </div>
    </div>

    <UiConfirmDialog
      :show="restoreConfirmOpen"
      :title="t('admin.settings.emailTemplates.restoreOfficial')"
      :message="t('admin.settings.emailTemplates.restoreConfirm')"
      :confirm-text="t('admin.settings.emailTemplates.restoreOfficial')"
      :pending="restoring"
      danger
      @confirm="restoreOfficial"
      @cancel="restoreConfirmOpen = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { adminAPI } from "@/api";
import type {
  EmailTemplateEventOption,
  EmailTemplateOption,
} from "@/api/admin/settings";
import { useAppStore } from "@/stores";
import { extractApiErrorMessage } from "@/utils/apiError";
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiConfirmDialog,
  UiSelect,
  UiSpinner,
  UiTextArea,
  UiTextField,
} from "@/components/ui";

const { t, locale } = useI18n();
const appStore = useAppStore();

const fallbackPlaceholders = [
  "{{site_name}}",
  "{{recipient_name}}",
  "{{recipient_email}}",
  "{{verification_code}}",
  "{{expires_in_minutes}}",
  "{{reset_url}}",
  "{{subscription_group}}",
  "{{subscription_days}}",
  "{{expiry_time}}",
  "{{days_remaining}}",
  "{{current_balance}}",
  "{{threshold}}",
  "{{recharge_url}}",
  "{{recharge_amount}}",
  "{{order_id}}",
  "{{unsubscribe_url}}",
  "{{account_id}}",
  "{{account_name}}",
  "{{platform}}",
  "{{quota_dimension}}",
  "{{quota_used}}",
  "{{quota_limit}}",
  "{{quota_remaining}}",
  "{{quota_threshold}}",
  "{{triggered_at}}",
  "{{group_name}}",
  "{{moderation_category}}",
  "{{moderation_score}}",
  "{{violation_count}}",
  "{{ban_threshold}}",
  "{{rule_name}}",
  "{{severity}}",
  "{{alert_status}}",
  "{{metric_type}}",
  "{{operator}}",
  "{{metric_value}}",
  "{{threshold_value}}",
  "{{alert_description}}",
  "{{report_name}}",
  "{{report_type}}",
  "{{report_start_time}}",
  "{{report_end_time}}",
  "{{report_summary_display}}",
  "{{report_detail_display}}",
  "{{report_total_requests}}",
  "{{report_success_count}}",
  "{{report_sla_error_count}}",
  "{{report_business_limited_count}}",
  "{{report_sla}}",
  "{{report_error_rate}}",
  "{{report_upstream_error_rate}}",
  "{{report_upstream_error_count_excl_429_529}}",
  "{{report_upstream_429_count}}",
  "{{report_upstream_529_count}}",
  "{{report_latency_p50}}",
  "{{report_latency_p99}}",
  "{{report_ttft_p50}}",
  "{{report_ttft_p99}}",
  "{{report_tokens}}",
  "{{report_qps_current}}",
  "{{report_qps_peak}}",
  "{{report_qps_avg}}",
  "{{report_tps_current}}",
  "{{report_tps_peak}}",
  "{{report_tps_avg}}",
  "{{report_html}}",
];

const loadingList = ref(true);
const loadingTemplate = ref(false);
const saving = ref(false);
const previewing = ref(false);
const restoring = ref(false);
const restoreConfirmOpen = ref(false);
const eventOptions = ref<EmailTemplateOption[]>([]);
const localeOptions = ref<string[]>([]);
const selectedEvent = ref("");
const selectedLocale = ref("");
const subject = ref("");
const html = ref("");
const isCustomTemplate = ref(false);
const placeholders = ref<string[]>([]);
const previewSubject = ref("");
const previewHtml = ref("");
const initializingSelection = ref(false);

// CID references belong to MIME email parts and cannot be resolved by the
// standalone browser iframe used for the admin preview. Keep the preview
// renderable without changing the HTML sent by the backend.
const previewImagePlaceholder =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

function normalizePreviewHtml(document: string): string {
  return document.replace(/cid:[^\"' )]+/g, previewImagePlaceholder);
}

interface EventDisplayMeta {
  label: string;
  timing: string;
  categoryLabel: string;
}

function localText(zh: string, en: string): string {
  return locale.value.toLowerCase().startsWith("zh") ? zh : en;
}

const eventDisplayMeta: Record<string, EventDisplayMeta> = {
  "auth.verify_code": {
    label: "邮箱验证码",
    timing: "注册、绑定邮箱、OAuth 补全邮箱或 TOTP 邮箱校验时发送。",
    categoryLabel: "认证安全",
  },
  "auth.password_reset": {
    label: "密码重置",
    timing: "用户请求密码重置链接时发送。",
    categoryLabel: "认证安全",
  },
  "notification_email.verify_code": {
    label: "通知邮箱验证码",
    timing: "用户添加并验证额外通知邮箱时发送。",
    categoryLabel: "认证安全",
  },
  "subscription.purchase_success": {
    label: "订阅开通成功",
    timing: "订阅订单完成支付并成功开通或续期后发送。",
    categoryLabel: "订阅",
  },
  "subscription.expiry_reminder": {
    label: "订阅到期提醒",
    timing: "后台任务在订阅仍有效且距离到期剩余 7 天、3 天、1 天时各发送一次，可通过邮件设置中的开关关闭。",
    categoryLabel: "订阅",
  },
  "balance.low": {
    label: "余额不足提醒",
    timing: "用户余额低于全局或个人配置的提醒阈值时发送。",
    categoryLabel: "计费",
  },
  "balance.recharge_success": {
    label: "余额充值成功",
    timing: "余额充值订单支付完成并入账后发送。",
    categoryLabel: "计费",
  },
  "account.quota_alert": {
    label: "账号限额告警",
    timing: "上游账号的用量达到配置的额度告警阈值时发送给管理员通知邮箱。",
    categoryLabel: "管理告警",
  },
  "content_moderation.violation_notice": {
    label: "内容审计违规提醒",
    timing: "用户请求命中内容审计或风控规则、但尚未被禁用时发送。",
    categoryLabel: "风控",
  },
  "content_moderation.account_disabled": {
    label: "内容审计禁用账号",
    timing: "内容审计违规次数达到封禁阈值并自动禁用用户账号时发送。",
    categoryLabel: "风控",
  },
  "ops.alert": {
    label: "运维告警",
    timing: "运维监控规则触发告警并满足邮件通知配置时发送给运维收件人。",
    categoryLabel: "运维",
  },
  "ops.scheduled_report": {
    label: "运维定时报表",
    timing: "运维日报、周报、错误摘要或账号健康报表到达配置的发送时间时发送；日报和周报的完整指标均可在模板中编辑。",
    categoryLabel: "运维",
  },
};

const eventDisplayMetaEn: Record<string, EventDisplayMeta> = {
  "auth.verify_code": {
    label: "Email Verification Code",
    timing: "Sent for registration, email binding, OAuth pending email completion, or TOTP email verification.",
    categoryLabel: "Auth",
  },
  "auth.password_reset": {
    label: "Password Reset",
    timing: "Sent when a user requests a password reset link.",
    categoryLabel: "Auth",
  },
  "notification_email.verify_code": {
    label: "Notification Email Verification",
    timing: "Sent when a user adds and verifies an extra notification email address.",
    categoryLabel: "Auth",
  },
  "subscription.purchase_success": {
    label: "Subscription Activated",
    timing: "Sent after a subscription order is paid and the subscription is activated or extended.",
    categoryLabel: "Subscription",
  },
  "subscription.expiry_reminder": {
    label: "Subscription Expiry Reminder",
    timing: "Sent by the background job when an active subscription has 7, 3, or 1 day remaining. It can be disabled in Email settings.",
    categoryLabel: "Subscription",
  },
  "balance.low": {
    label: "Low Balance Alert",
    timing: "Sent when a user's balance drops below the global or personal reminder threshold.",
    categoryLabel: "Billing",
  },
  "balance.recharge_success": {
    label: "Balance Recharge Success",
    timing: "Sent after a balance recharge order is paid and credited.",
    categoryLabel: "Billing",
  },
  "account.quota_alert": {
    label: "Account Quota Alert",
    timing: "Sent to admin notification emails when an upstream account reaches the configured quota alert threshold.",
    categoryLabel: "Admin",
  },
  "content_moderation.violation_notice": {
    label: "Risk Control Violation Notice",
    timing: "Sent when a user request triggers content moderation or risk-control rules but the account is not disabled yet.",
    categoryLabel: "Risk Control",
  },
  "content_moderation.account_disabled": {
    label: "Risk Control Account Disabled",
    timing: "Sent when content moderation reaches the ban threshold and automatically disables the user account.",
    categoryLabel: "Risk Control",
  },
  "ops.alert": {
    label: "Ops Alert",
    timing: "Sent to ops recipients when an ops monitoring rule fires and email notification settings allow it.",
    categoryLabel: "Ops",
  },
  "ops.scheduled_report": {
    label: "Ops Scheduled Report",
    timing: "Sent when a configured daily, weekly, error digest, or account health report reaches its scheduled send time. Every daily and weekly summary metric is editable in this template.",
    categoryLabel: "Ops",
  },
};

function normalizeEventOption(option: EmailTemplateEventOption): EmailTemplateOption {
  if (typeof option === "string") {
    return { value: option };
  }
  return option;
}

function eventMetaFor(option?: EmailTemplateOption | null) {
  if (!option) return null;
  const displayMeta = (
    locale.value.toLowerCase().startsWith("zh")
      ? eventDisplayMeta
      : eventDisplayMetaEn
  )[option.value];
  const label = displayMeta?.label || option.label || option.value;
  const timing = displayMeta?.timing || option.description || "";
  const categoryLabel =
    displayMeta?.categoryLabel || formatCategory(option.category || "");
  return {
    label,
    timing,
    categoryLabel,
    optional: option.optional === true,
  };
}

function formatEventOptionLabel(option: EmailTemplateOption): string {
  const meta = eventMetaFor(option);
  if (!meta) return option.label || option.value;
  return meta.label;
}

function formatCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return localText("通知", "Notification");
  const labels: Record<string, { zh: string; en: string }> = {
    auth: { zh: "认证安全", en: "Auth" },
    subscription: { zh: "订阅", en: "Subscription" },
    billing: { zh: "计费", en: "Billing" },
    admin: { zh: "管理告警", en: "Admin" },
    risk_control: { zh: "风控", en: "Risk Control" },
    ops: { zh: "运维", en: "Ops" },
  };
  const item = labels[normalized];
  return item ? localText(item.zh, item.en) : category;
}

const selectedEventOption = computed(() => {
  return (
    eventOptions.value.find((option) => option.value === selectedEvent.value) ||
    null
  );
});

const selectedEventMeta = computed(() => eventMetaFor(selectedEventOption.value));

const selectedEventDescription = computed(() => {
  return (
    selectedEventOption.value?.description || ""
  );
});

const eventSelectOptions = computed(() =>
  eventOptions.value.map((option) => ({
    value: option.value,
    label: formatEventOptionLabel(option),
  })),
);

const localeSelectOptions = computed(() =>
  localeOptions.value.map((value) => ({
    value,
    label: formatLocale(value),
  })),
);

const placeholderList = computed(() => {
  const combined = placeholders.value.length
    ? placeholders.value
    : fallbackPlaceholders;
  return Array.from(
    new Set(
      combined
        .map((item) => formatPlaceholder(item))
        .filter((item) => item.length > 0),
    ),
  );
});

function formatPlaceholder(placeholder: string): string {
  const trimmed = placeholder.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) return trimmed;
  return `{{${trimmed}}}`;
}

const canSave = computed(
  () =>
    Boolean(selectedEvent.value && selectedLocale.value) &&
    subject.value.trim().length > 0 &&
    html.value.trim().length > 0,
);

const canPreview = computed(
  () => Boolean(selectedEvent.value && selectedLocale.value) && html.value.trim().length > 0,
);

function formatLocale(locale: string): string {
  const lower = locale.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-")) {
    return t("admin.settings.emailTemplates.localeZh");
  }
  if (lower === "en" || lower.startsWith("en-")) {
    return t("admin.settings.emailTemplates.localeEn");
  }
  return locale;
}

function selectInitialLocale(locales: string[]): string {
  const currentLocale = locale.value.toLowerCase();
  const exactMatch = locales.find(
    (availableLocale) => availableLocale.toLowerCase() === currentLocale,
  );
  if (exactMatch) return exactMatch;

  const currentLanguage = currentLocale.split("-")[0];
  const languageMatch = locales.find(
    (availableLocale) => availableLocale.toLowerCase().split("-")[0] === currentLanguage,
  );
  if (languageMatch) return languageMatch;

  return locales[0] || "";
}

function applyTemplate(template: {
  subject: string;
  html: string;
  is_custom?: boolean;
  placeholders?: string[];
}) {
  subject.value = template.subject;
  html.value = template.html;
  isCustomTemplate.value = template.is_custom === true;
  placeholders.value = template.placeholders || [];
}

async function loadTemplate() {
  if (!selectedEvent.value || !selectedLocale.value) return;
  loadingTemplate.value = true;
  try {
    const template = await adminAPI.settings.getEmailTemplate(
      selectedEvent.value,
      selectedLocale.value,
    );
    applyTemplate(template);
    await refreshPreview();
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    loadingTemplate.value = false;
  }
}

async function loadTemplateList() {
  loadingList.value = true;
  try {
    const response = await adminAPI.settings.getEmailTemplates();
    eventOptions.value = response.events.map(normalizeEventOption);
    localeOptions.value = response.locales;
    placeholders.value = response.placeholders || [];
    initializingSelection.value = true;
    selectedEvent.value = eventOptions.value[0]?.value || "";
    selectedLocale.value = selectInitialLocale(response.locales);
    await loadTemplate();
    initializingSelection.value = false;
  } catch (err: unknown) {
    initializingSelection.value = false;
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    loadingList.value = false;
  }
}

async function saveTemplate() {
  if (!canSave.value) {
    appStore.showError(t("admin.settings.emailTemplates.validationRequired"));
    return;
  }
  saving.value = true;
  try {
    const template = await adminAPI.settings.updateEmailTemplate(
      selectedEvent.value,
      selectedLocale.value,
      {
        subject: subject.value,
        html: html.value,
      },
    );
    applyTemplate(template);
    await refreshPreview();
    appStore.showSuccess(t("admin.settings.emailTemplates.saveSuccess"));
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    saving.value = false;
  }
}

async function refreshPreview() {
  if (!canPreview.value) {
    previewSubject.value = "";
    previewHtml.value = "";
    return;
  }
  previewing.value = true;
  try {
    const preview = await adminAPI.settings.previewEmailTemplate({
      event: selectedEvent.value,
      locale: selectedLocale.value,
      subject: subject.value,
      html: html.value,
    });
    previewSubject.value = preview.subject;
    previewHtml.value = normalizePreviewHtml(preview.html);
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    previewing.value = false;
  }
}

function requestRestoreOfficial() {
  if (!selectedEvent.value || !selectedLocale.value) return;
  restoreConfirmOpen.value = true;
}

async function restoreOfficial() {
  if (!selectedEvent.value || !selectedLocale.value || restoring.value) return;
  restoring.value = true;
  try {
    const template = await adminAPI.settings.restoreOfficialEmailTemplate(
      selectedEvent.value,
      selectedLocale.value,
    );
    applyTemplate(template);
    await refreshPreview();
    appStore.showSuccess(t("admin.settings.emailTemplates.restoreSuccess"));
    restoreConfirmOpen.value = false;
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    restoring.value = false;
  }
}

async function copyPlaceholder(placeholder: string) {
  try {
    await navigator.clipboard.writeText(placeholder);
    appStore.showSuccess(t("admin.settings.emailTemplates.placeholderCopied"));
  } catch {
    appStore.showError(t("common.error"));
  }
}

watch([selectedEvent, selectedLocale], ([eventValue, localeValue], [oldEvent, oldLocale]) => {
  if (initializingSelection.value) return;
  if (!eventValue || !localeValue) return;
  if (eventValue === oldEvent && localeValue === oldLocale) return;
  void loadTemplate();
});

onMounted(() => {
  void loadTemplateList();
});
</script>

<style scoped>
.email-editor {
  min-width: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
}

.email-editor__header,
.email-editor__preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.email-editor__header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--ui-border);
}

.email-editor__heading,
.email-editor__preview-header > div,
.email-editor__meta,
.email-editor__placeholders > div:first-child {
  min-width: 0;
}

.email-editor h2,
.email-editor h3,
.email-editor p {
  margin: 0;
}

.email-editor h2 {
  color: var(--ui-text);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.email-editor h3,
.email-editor__meta strong {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.email-editor__heading p,
.email-editor__preview-header p,
.email-editor__placeholders p,
.email-editor__security-hint,
.email-editor__meta small {
  color: var(--ui-text-soft);
  font-size: 12px;
  line-height: 18px;
}

.email-editor__actions,
.email-editor__meta-title,
.email-editor__placeholder-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.email-editor__loading {
  display: flex;
  min-height: 240px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ui-text-muted);
  font-size: 13px;
}

.email-editor__body {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.email-editor__selectors {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.email-editor__meta {
  padding: 12px 0 14px;
  border-bottom: 1px solid var(--ui-border);
}

.email-editor__meta p {
  margin-top: 6px;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: 21px;
}

.email-editor__meta small {
  display: block;
  margin-top: 3px;
}

.email-editor__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.email-editor__form,
.email-editor__preview {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.email-editor__placeholders {
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--ui-border);
}

.email-editor__placeholder {
  min-height: 24px;
  padding: 2px 8px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-dense);
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  font-family: var(--ui-font-mono);
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
  transition: border-color var(--ui-motion-fast), color var(--ui-motion-fast), background var(--ui-motion-fast);
}

.email-editor__placeholder:hover {
  border-color: var(--ui-text-soft);
  color: var(--ui-text);
  background: var(--ui-surface-muted);
}

.email-editor__preview {
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  overflow: hidden;
}

.email-editor__preview-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--ui-border);
}

.email-editor__preview-stage {
  padding: 10px;
  background: var(--ui-surface-muted);
}

.email-editor__preview iframe {
  display: block;
  width: 100%;
  height: 576px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-dense);
  background: var(--ui-surface);
}

.email-editor__security-hint {
  padding: 0 14px 12px;
}

@media (max-width: 1080px) {
  .email-editor__workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .email-editor__header {
    flex-direction: column;
    padding: 16px;
  }

  .email-editor__actions {
    width: 100%;
  }

  .email-editor__actions > * {
    flex: 1 1 auto;
  }

  .email-editor__body {
    padding: 16px;
  }

  .email-editor__selectors {
    grid-template-columns: 1fr;
  }

  .email-editor__preview iframe {
    height: 460px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .email-editor__placeholder {
    transition: none;
  }
}
</style>
