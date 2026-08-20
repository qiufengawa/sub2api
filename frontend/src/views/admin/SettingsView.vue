<template>
  <AppLayout>
    <div class="mx-auto w-full min-w-0 max-w-6xl space-y-6">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <UiSpinner size="lg" :label="t('common.loading')" />
      </div>

      <!-- Settings Form -->
      <form v-else @submit.prevent="saveSettings" class="min-w-0 space-y-6" novalidate>
        <!-- Tab Navigation -->
        <div class="settings-tabs-shell">
          <UiTabs
            :model-value="activeTab"
            :tabs="settingsTabOptions"
            :label="t('admin.settings.title')"
            @update:model-value="selectSettingsTab(String($event) as SettingsTab)"
          />
        </div>

        <!-- Tab: Security — Admin API Key -->
        <div
          id="settings-panel-security"
          v-show="activeTab === 'security'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-security"
        >
          <!-- Admin API Key Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.adminApiKey.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.adminApiKey.description") }}
              </p>
            </div>
            <div class="space-y-4 p-6">
              <!-- Security Warning -->
              <div
                class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <div class="flex items-start">
                  <Icon
                    name="exclamationTriangle"
                    size="md"
                    class="mt-0.5 flex-shrink-0 text-amber-500"
                  />
                  <p class="ml-3 text-sm text-amber-700 dark:text-amber-300">
                    {{ t("admin.settings.adminApiKey.securityWarning") }}
                  </p>
                </div>
              </div>

              <!-- Loading State -->
              <div
                v-if="adminApiKeyLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <UiSpinner size="sm" :label="t('common.loading')" />
                {{ t("common.loading") }}
              </div>

              <!-- No Key Configured -->
              <div
                v-else-if="!adminApiKeyExists"
                class="flex items-center justify-between"
              >
                <span class="text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.adminApiKey.notConfigured") }}
                </span>
                <UiButton
                  type="button"
                  variant="primary"
                  density="compact"
                  :loading="adminApiKeyOperating"
                  data-testid="admin-api-key-create"
                  @click="createAdminApiKey"
                >
                  {{
                    adminApiKeyOperating
                      ? t("admin.settings.adminApiKey.creating")
                      : t("admin.settings.adminApiKey.create")
                  }}
                </UiButton>
              </div>

              <!-- Key Exists -->
              <div v-else class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <label
                      class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {{ t("admin.settings.adminApiKey.currentKey") }}
                    </label>
                    <code
                      class="rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-900 dark:bg-dark-700 dark:text-gray-100"
                    >
                      {{ adminApiKeyMasked }}
                    </code>
                  </div>
                  <div class="flex gap-2">
                    <UiButton
                      type="button"
                      variant="secondary"
                      density="compact"
                      :loading="adminApiKeyOperating"
                      data-testid="admin-api-key-regenerate"
                      @click="regenerateAdminApiKey"
                    >
                      {{
                        adminApiKeyOperating
                          ? t("admin.settings.adminApiKey.regenerating")
                          : t("admin.settings.adminApiKey.regenerate")
                      }}
                    </UiButton>
                    <UiButton
                      type="button"
                      variant="danger"
                      density="compact"
                      :loading="adminApiKeyOperating"
                      data-testid="admin-api-key-delete"
                      @click="deleteAdminApiKey"
                    >
                      {{ t("admin.settings.adminApiKey.delete") }}
                    </UiButton>
                  </div>
                </div>

                <!-- Newly Generated Key Display -->
                <div
                  v-if="newAdminApiKey"
                  class="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
                >
                  <p
                    class="text-sm font-medium text-green-700 dark:text-green-300"
                  >
                    {{ t("admin.settings.adminApiKey.keyWarning") }}
                  </p>
                  <div class="flex items-center gap-2">
                    <code
                      class="flex-1 select-all break-all rounded border border-green-300 bg-white px-3 py-2 font-mono text-sm dark:border-green-700 dark:bg-dark-800"
                    >
                      {{ newAdminApiKey }}
                    </code>
                    <UiButton
                      type="button"
                      variant="primary"
                      density="compact"
                      class="flex-shrink-0"
                      data-testid="admin-api-key-copy"
                      @click="copyNewKey"
                    >
                      {{ t("admin.settings.adminApiKey.copyKey") }}
                    </UiButton>
                  </div>
                  <p class="text-xs text-green-600 dark:text-green-400">
                    {{ t("admin.settings.adminApiKey.usage") }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- /Tab: Security — Admin API Key -->

        <!-- Tab: Gateway -->
        <div
          id="settings-panel-gateway"
          v-show="activeTab === 'gateway'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-gateway"
        >
          <!-- Overload Cooldown (529) Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.overloadCooldown.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.overloadCooldown.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div
                v-if="overloadCooldownLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <UiSpinner size="sm" :label="t('common.loading')" />
                {{ t("common.loading") }}
              </div>

              <template v-else>
                <div class="flex items-center justify-between">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">{{
                      t("admin.settings.overloadCooldown.enabled")
                    }}</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.overloadCooldown.enabledHint") }}
                    </p>
                  </div>
                  <Toggle v-model="overloadCooldownForm.enabled" />
                </div>

                <div
                  v-if="overloadCooldownForm.enabled"
                  class="space-y-4 border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiTextField
                    v-model.number="overloadCooldownForm.cooldown_minutes"
                    type="number"
                    min="1"
                    max="120"
                    density="compact"
                    class="w-32"
                    :label="t('admin.settings.overloadCooldown.cooldownMinutes')"
                    :description="t('admin.settings.overloadCooldown.cooldownMinutesHint')"
                  />
                </div>

                <div
                  class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiButton
                    type="button"
                    @click="saveOverloadCooldownSettings"
                    :disabled="overloadCooldownSaving"
                    variant="primary"
                    density="compact"
                    :loading="overloadCooldownSaving"
                  >
                    {{
                      overloadCooldownSaving
                        ? t("common.saving")
                        : t("common.save")
                    }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>

          <!-- Rate Limit Cooldown (429) Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.rateLimit429Cooldown.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.rateLimit429Cooldown.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div
                v-if="rateLimit429CooldownLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <UiSpinner size="sm" :label="t('common.loading')" />
                {{ t("common.loading") }}
              </div>

              <template v-else>
                <div class="flex items-center justify-between">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">{{
                      t("admin.settings.rateLimit429Cooldown.enabled")
                    }}</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.rateLimit429Cooldown.enabledHint") }}
                    </p>
                  </div>
                  <Toggle v-model="rateLimit429CooldownForm.enabled" />
                </div>

                <div
                  v-if="rateLimit429CooldownForm.enabled"
                  class="space-y-4 border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiTextField
                    v-model.number="rateLimit429CooldownForm.cooldown_seconds"
                    type="number"
                    min="1"
                    max="7200"
                    density="compact"
                    class="w-32"
                    :label="t('admin.settings.rateLimit429Cooldown.cooldownSeconds')"
                    :description="t('admin.settings.rateLimit429Cooldown.cooldownSecondsHint')"
                  />
                </div>

                <div
                  class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiButton
                    type="button"
                    @click="saveRateLimit429CooldownSettings"
                    :disabled="rateLimit429CooldownSaving"
                    variant="primary"
                    density="compact"
                    :loading="rateLimit429CooldownSaving"
                  >
                    {{
                      rateLimit429CooldownSaving
                        ? t("common.saving")
                        : t("common.save")
                    }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>

          <!-- Stream Timeout Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.streamTimeout.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.streamTimeout.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <!-- Loading State -->
              <div
                v-if="streamTimeoutLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <div
                  class="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-600"
                ></div>
                {{ t("common.loading") }}
              </div>

              <template v-else>
                <!-- Enable Stream Timeout -->
                <div class="flex items-center justify-between">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">{{
                      t("admin.settings.streamTimeout.enabled")
                    }}</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.streamTimeout.enabledHint") }}
                    </p>
                  </div>
                  <Toggle v-model="streamTimeoutForm.enabled" />
                </div>

                <!-- Settings - Only show when enabled -->
                <div
                  v-if="streamTimeoutForm.enabled"
                  class="space-y-4 border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <!-- Action -->
                  <Select
                    v-model="streamTimeoutForm.action"
                    :options="streamTimeoutActionOptions"
                    density="compact"
                    class="w-64"
                    :label="t('admin.settings.streamTimeout.action')"
                    :description="t('admin.settings.streamTimeout.actionHint')"
                  />

                  <!-- Temp Unsched Minutes (only show when action is temp_unsched) -->
                  <UiTextField
                    v-if="streamTimeoutForm.action === 'temp_unsched'"
                    v-model.number="streamTimeoutForm.temp_unsched_minutes"
                    type="number"
                    min="1"
                    max="60"
                    density="compact"
                    class="w-32"
                    :label="t('admin.settings.streamTimeout.tempUnschedMinutes')"
                    :description="t('admin.settings.streamTimeout.tempUnschedMinutesHint')"
                  />

                  <!-- Threshold Count -->
                  <UiTextField
                    v-model.number="streamTimeoutForm.threshold_count"
                    type="number"
                    min="1"
                    max="10"
                    density="compact"
                    class="w-32"
                    :label="t('admin.settings.streamTimeout.thresholdCount')"
                    :description="t('admin.settings.streamTimeout.thresholdCountHint')"
                  />

                  <!-- Threshold Window Minutes -->
                  <UiTextField
                    v-model.number="streamTimeoutForm.threshold_window_minutes"
                    type="number"
                    min="1"
                    max="60"
                    density="compact"
                    class="w-32"
                    :label="t('admin.settings.streamTimeout.thresholdWindowMinutes')"
                    :description="t('admin.settings.streamTimeout.thresholdWindowMinutesHint')"
                  />
                </div>

                <!-- Save Button -->
                <div
                  class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiButton
                    type="button"
                    @click="saveStreamTimeoutSettings"
                    :disabled="streamTimeoutSaving"
                    variant="primary"
                    density="compact"
                    :loading="streamTimeoutSaving"
                  >
                    {{
                      streamTimeoutSaving
                        ? t("common.saving")
                        : t("common.save")
                    }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>

          <!-- Request Rectifier Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.rectifier.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.rectifier.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <!-- Loading State -->
              <div
                v-if="rectifierLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <div
                  class="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-600"
                ></div>
                {{ t("common.loading") }}
              </div>

              <template v-else>
                <!-- Master Toggle -->
                <div class="flex items-center justify-between">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">{{
                      t("admin.settings.rectifier.enabled")
                    }}</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.rectifier.enabledHint") }}
                    </p>
                  </div>
                  <Toggle v-model="rectifierForm.enabled" />
                </div>

                <!-- Sub-toggles (only show when master is enabled) -->
                <div
                  v-if="rectifierForm.enabled"
                  class="space-y-4 border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <!-- Thinking Signature Rectifier -->
                  <div class="flex items-center justify-between">
                    <div>
                      <label
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{
                          t("admin.settings.rectifier.thinkingSignature")
                        }}</label
                      >
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{
                          t("admin.settings.rectifier.thinkingSignatureHint")
                        }}
                      </p>
                    </div>
                    <Toggle
                      v-model="rectifierForm.thinking_signature_enabled"
                    />
                  </div>

                  <!-- Thinking Budget Rectifier -->
                  <div class="flex items-center justify-between">
                    <div>
                      <label
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{
                          t("admin.settings.rectifier.thinkingBudget")
                        }}</label
                      >
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.rectifier.thinkingBudgetHint") }}
                      </p>
                    </div>
                    <Toggle v-model="rectifierForm.thinking_budget_enabled" />
                  </div>

                  <!-- API Key Signature Rectifier -->
                  <div class="flex items-center justify-between">
                    <div>
                      <label
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{
                          t("admin.settings.rectifier.apikeySignature")
                        }}</label
                      >
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.rectifier.apikeySignatureHint") }}
                      </p>
                    </div>
                    <Toggle v-model="rectifierForm.apikey_signature_enabled" />
                  </div>

                  <!-- Custom Patterns (only when apikey_signature_enabled) -->
                  <div
                    v-if="rectifierForm.apikey_signature_enabled"
                    class="ml-4 space-y-3 border-l-2 border-gray-200 pl-4 dark:border-dark-600"
                  >
                    <div>
                      <label
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >{{
                          t("admin.settings.rectifier.apikeyPatterns")
                        }}</label
                      >
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.rectifier.apikeyPatternsHint") }}
                      </p>
                    </div>
                    <div
                      v-for="(
                        _, index
                      ) in rectifierForm.apikey_signature_patterns"
                      :key="index"
                      class="flex items-center gap-2"
                    >
                      <UiTextField
                        v-model="rectifierForm.apikey_signature_patterns[index]"
                        density="compact"
                        class="flex-1"
                        :label="t('admin.settings.rectifier.apikeyPatternPlaceholder')"
                        :placeholder="t('admin.settings.rectifier.apikeyPatternPlaceholder')"
                      />
                      <UiIconButton
                        icon="x"
                        variant="danger"
                        density="compact"
                        :label="t('common.remove')"
                        @click="
                          rectifierForm.apikey_signature_patterns.splice(
                            index,
                            1,
                          )
                        "
                      />
                    </div>
                    <UiButton
                      type="button"
                      @click="rectifierForm.apikey_signature_patterns.push('')"
                      variant="quiet"
                      density="dense"
                    >
                      + {{ t("admin.settings.rectifier.addPattern") }}
                    </UiButton>
                  </div>
                </div>

                <!-- Save Button -->
                <div
                  class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiButton
                    type="button"
                    @click="saveRectifierSettings"
                    :disabled="rectifierSaving"
                    variant="primary"
                    density="compact"
                    :loading="rectifierSaving"
                  >
                    {{
                      rectifierSaving ? t("common.saving") : t("common.save")
                    }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>
          <!-- Beta Policy Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.betaPolicy.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.betaPolicy.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <!-- Loading State -->
              <div
                v-if="betaPolicyLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <UiSpinner size="sm" :label="t('common.loading')" />
                {{ t("common.loading") }}
              </div>

              <template v-else>
                <!-- Rule Cards -->
                <div
                  v-for="rule in betaPolicyForm.rules"
                  :key="rule.beta_token"
                  class="rounded-lg border border-gray-200 p-4 dark:border-dark-600"
                >
                  <div class="mb-3 flex items-center gap-2">
                    <span
                      class="text-sm font-medium text-gray-900 dark:text-white"
                    >
                      {{ getBetaDisplayName(rule.beta_token) }}
                    </span>
                    <span
                      class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-dark-700 dark:text-gray-400"
                    >
                      {{ rule.beta_token }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <!-- Action -->
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                      >
                        {{ t("admin.settings.betaPolicy.action") }}
                      </label>
                      <Select
                        :modelValue="rule.action"
                        @update:modelValue="rule.action = $event as any"
                        :options="betaPolicyActionOptions"
                        density="compact"
                      />
                    </div>

                    <!-- Scope -->
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                      >
                        {{ t("admin.settings.betaPolicy.scope") }}
                      </label>
                      <Select
                        :modelValue="rule.scope"
                        @update:modelValue="rule.scope = $event as any"
                        :options="betaPolicyScopeOptions"
                        density="compact"
                      />
                    </div>
                  </div>

                  <!-- Error Message (only when action=block) -->
                  <div v-if="rule.action === 'block'" class="mt-3">
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.betaPolicy.errorMessage") }}
                    </label>
                    <UiTextField
                      v-model="rule.error_message"
                      density="compact"
                      :placeholder="t('admin.settings.betaPolicy.errorMessagePlaceholder')"
                    />
                    <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {{ t("admin.settings.betaPolicy.errorMessageHint") }}
                    </p>
                  </div>

                  <!-- Quick Presets (only for tokens with presets) -->
                  <div v-if="betaPresets[rule.beta_token]?.length" class="mt-3">
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.betaPolicy.quickPresets") }}
                    </label>
                    <div class="flex flex-wrap gap-2">
                      <UiButton
                        v-for="preset in betaPresets[rule.beta_token]"
                        :key="preset.label"
                        type="button"
                        variant="quiet"
                        density="mini"
                        @click="applyBetaPreset(rule, preset)"
                        :title="preset.description"
                      >
                        {{ preset.label }}
                      </UiButton>
                    </div>
                  </div>

                  <!-- Model Whitelist -->
                  <div class="mt-3">
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.betaPolicy.modelWhitelist") }}
                    </label>
                    <p class="mb-2 text-xs text-gray-400 dark:text-gray-500">
                      {{ t("admin.settings.betaPolicy.modelWhitelistHint") }}
                    </p>
                    <!-- Existing patterns -->
                    <div
                      v-for="(_, index) in rule.model_whitelist || []"
                      :key="index"
                      class="mb-1.5 flex items-center gap-2"
                    >
                      <UiTextField
                        v-model="rule.model_whitelist![index]"
                        density="compact"
                        class="flex-1"
                        :placeholder="t('admin.settings.betaPolicy.modelPatternPlaceholder')"
                      />
                      <UiIconButton
                        type="button"
                        icon="x"
                        variant="danger"
                        density="mini"
                        :label="t('common.delete')"
                        @click="rule.model_whitelist!.splice(index, 1)"
                      />
                    </div>
                    <!-- Add pattern button -->
                    <UiButton
                      type="button"
                      variant="quiet"
                      density="mini"
                      @click="
                        if (!rule.model_whitelist) rule.model_whitelist = [];
                        rule.model_whitelist.push('');
                      "
                    >
                      <template #icon><Icon name="plus" size="xs" /></template>
                      {{ t("admin.settings.betaPolicy.addModelPattern") }}
                    </UiButton>
                    <!-- Common pattern chips -->
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span class="text-xs text-gray-400 dark:text-gray-500"
                        >{{
                          t("admin.settings.betaPolicy.commonPatterns")
                        }}:</span
                      >
                      <UiButton
                        v-for="pattern in commonModelPatterns"
                        :key="pattern"
                        type="button"
                        variant="quiet"
                        density="mini"
                        @click="addQuickPattern(rule, pattern)"
                      >
                        {{ pattern }}
                      </UiButton>
                    </div>
                  </div>

                  <!-- Fallback Action (only when model_whitelist is non-empty) -->
                  <div
                    v-if="
                      rule.model_whitelist && rule.model_whitelist.length > 0
                    "
                    class="mt-3"
                  >
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.betaPolicy.fallbackAction") }}
                    </label>
                    <Select
                      :modelValue="rule.fallback_action || 'pass'"
                      @update:modelValue="rule.fallback_action = $event as any"
                      :options="betaPolicyActionOptions"
                      density="compact"
                    />
                    <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {{ t("admin.settings.betaPolicy.fallbackActionHint") }}
                    </p>
                    <!-- Fallback Error Message (only when fallback_action=block) -->
                    <div v-if="rule.fallback_action === 'block'" class="mt-2">
                      <UiTextField
                        v-model="rule.fallback_error_message"
                        density="compact"
                        :placeholder="t('admin.settings.betaPolicy.fallbackErrorMessagePlaceholder')"
                      />
                      <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {{ t("admin.settings.betaPolicy.errorMessageHint") }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Save Button -->
                <div
                  class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiButton
                    type="button"
                    variant="primary"
                    density="compact"
                    :loading="betaPolicySaving"
                    @click="saveBetaPolicySettings"
                  >
                    {{
                      betaPolicySaving ? t("common.saving") : t("common.save")
                    }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>
          <!-- OpenAI Fast/Flex Policy Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.openaiFastPolicy.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.openaiFastPolicy.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <!-- Empty state -->
              <div
                v-if="openaiFastPolicyForm.rules.length === 0"
                class="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-dark-600 dark:text-gray-400"
              >
                {{ t("admin.settings.openaiFastPolicy.empty") }}
              </div>

              <!-- Rule Cards -->
              <div
                v-for="(rule, ruleIndex) in openaiFastPolicyForm.rules"
                :key="ruleIndex"
                class="rounded-lg border border-gray-200 p-4 dark:border-dark-600"
              >
                <div class="mb-3 flex items-center justify-between">
                  <span
                    class="text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {{
                      t("admin.settings.openaiFastPolicy.ruleHeader", {
                        index: ruleIndex + 1,
                      })
                    }}
                  </span>
                  <UiIconButton
                    type="button"
                    icon="x"
                    variant="danger"
                    density="mini"
                    :label="t('admin.settings.openaiFastPolicy.removeRule')"
                    @click="removeOpenAIFastPolicyRule(ruleIndex)"
                  />
                </div>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <!-- Service Tier -->
                  <div>
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.openaiFastPolicy.serviceTier") }}
                    </label>
                    <Select
                      :modelValue="rule.service_tier"
                      @update:modelValue="
                        rule.service_tier = $event as
                          | 'all'
                          | 'priority'
                          | 'flex'
                      "
                      :options="openaiFastPolicyTierOptions"
                      density="compact"
                    />
                  </div>

                  <!-- Action -->
                  <div>
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.openaiFastPolicy.action") }}
                    </label>
                    <Select
                      :modelValue="rule.action"
                      @update:modelValue="
                        rule.action = $event as
                          | 'pass'
                          | 'filter'
                          | 'block'
                          | 'force_priority'
                      "
                      :options="openaiFastPolicyActionOptions"
                      density="compact"
                    />
                  </div>

                  <!-- Scope -->
                  <div>
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.openaiFastPolicy.scope") }}
                    </label>
                    <Select
                      :modelValue="rule.scope"
                      @update:modelValue="
                        rule.scope = $event as
                          | 'all'
                          | 'oauth'
                          | 'apikey'
                          | 'bedrock'
                      "
                      :options="openaiFastPolicyScopeOptions"
                      density="compact"
                    />
                  </div>
                </div>

                <!-- User Scope -->
                <div class="mt-3">
                  <label
                    class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    {{ t("admin.settings.openaiFastPolicy.userIds") }}
                  </label>
                  <p class="mb-2 text-xs text-gray-400 dark:text-gray-500">
                    {{ t("admin.settings.openaiFastPolicy.userIdsHint") }}
                  </p>
                  <OpenAIFastPolicyUserSelector
                    :model-value="rule.user_ids || []"
                    @update:model-value="rule.user_ids = $event"
                  />
                </div>

                <!-- Error Message (only when action=block) -->
                <div v-if="rule.action === 'block'" class="mt-3">
                  <label
                    class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    {{ t("admin.settings.openaiFastPolicy.errorMessage") }}
                  </label>
                  <UiTextField
                    v-model="rule.error_message"
                    density="compact"
                    :placeholder="t('admin.settings.openaiFastPolicy.errorMessagePlaceholder')"
                  />
                  <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {{ t("admin.settings.openaiFastPolicy.errorMessageHint") }}
                  </p>
                </div>

                <!-- Model Whitelist -->
                <div class="mt-3">
                  <label
                    class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    {{ t("admin.settings.openaiFastPolicy.modelWhitelist") }}
                  </label>
                  <p class="mb-2 text-xs text-gray-400 dark:text-gray-500">
                    {{
                      t("admin.settings.openaiFastPolicy.modelWhitelistHint")
                    }}
                  </p>
                  <div
                    v-for="(_, patternIdx) in rule.model_whitelist || []"
                    :key="patternIdx"
                    class="mb-1.5 flex items-center gap-2"
                  >
                    <UiTextField
                      v-model="rule.model_whitelist![patternIdx]"
                      density="compact"
                      class="flex-1"
                      :placeholder="t('admin.settings.openaiFastPolicy.modelPatternPlaceholder')"
                    />
                    <UiIconButton
                      type="button"
                      icon="x"
                      variant="danger"
                      density="mini"
                      :label="t('common.delete')"
                      @click="removeOpenAIFastPolicyModelPattern(rule, patternIdx)"
                    />
                  </div>
                  <UiButton
                    type="button"
                    variant="quiet"
                    density="mini"
                    @click="addOpenAIFastPolicyModelPattern(rule)"
                  >
                    <template #icon><Icon name="plus" size="xs" /></template>
                    {{ t("admin.settings.openaiFastPolicy.addModelPattern") }}
                  </UiButton>
                </div>

                <!-- Fallback Action (only when model_whitelist is non-empty) -->
                <div
                  v-if="
                    rule.model_whitelist && rule.model_whitelist.length > 0
                  "
                  class="mt-3"
                >
                  <label
                    class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    {{ t("admin.settings.openaiFastPolicy.fallbackAction") }}
                  </label>
                  <Select
                    :modelValue="rule.fallback_action || 'pass'"
                    @update:modelValue="
                      rule.fallback_action = $event as
                        | 'pass'
                        | 'filter'
                        | 'block'
                        | 'force_priority'
                    "
                    :options="openaiFastPolicyActionOptions"
                    density="compact"
                  />
                  <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {{
                      t("admin.settings.openaiFastPolicy.fallbackActionHint")
                    }}
                  </p>
                  <div v-if="rule.fallback_action === 'block'" class="mt-2">
                    <UiTextField
                      v-model="rule.fallback_error_message"
                      density="compact"
                      :placeholder="t('admin.settings.openaiFastPolicy.fallbackErrorMessagePlaceholder')"
                    />
                  </div>
                </div>
              </div>

              <!-- Add Rule Button -->
              <div>
                <UiButton
                  type="button"
                  variant="secondary"
                  density="compact"
                  @click="addOpenAIFastPolicyRule"
                >
                  <template #icon><Icon name="plus" size="sm" /></template>
                  {{ t("admin.settings.openaiFastPolicy.addRule") }}
                </UiButton>
                <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  {{ t("admin.settings.openaiFastPolicy.saveHint") }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <!-- /Tab: Gateway -->

        <!-- Tab: Security — Registration, Turnstile, LinuxDo -->
        <div
          id="settings-panel-security-details"
          v-show="activeTab === 'security'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-security"
        >
          <!-- Registration Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.registration.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.registration.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <!-- Enable Registration -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.registration.enableRegistration")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{
                      t("admin.settings.registration.enableRegistrationHint")
                    }}
                  </p>
                </div>
                <Toggle v-model="form.registration_enabled" />
              </div>

              <!-- Email Verification -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.registration.emailVerification")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.registration.emailVerificationHint") }}
                  </p>
                </div>
                <Toggle v-model="form.email_verify_enabled" />
              </div>

              <!-- Email Suffix Whitelist -->
              <div class="border-t border-gray-100 pt-4 dark:border-dark-700">
                <label class="font-medium text-gray-900 dark:text-white">{{
                  t("admin.settings.registration.emailSuffixWhitelist")
                }}</label>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {{
                    t("admin.settings.registration.emailSuffixWhitelistHint")
                  }}
                </p>
                <div
                  class="mt-3 rounded-lg border border-gray-300 bg-white p-2 dark:border-dark-500 dark:bg-dark-700"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      v-for="suffix in registrationEmailSuffixWhitelistTags"
                      :key="suffix"
                      class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700 dark:bg-dark-600 dark:text-gray-200"
                    >
                      <span>{{ suffix }}</span>
                      <UiIconButton
                        type="button"
                        icon="x"
                        variant="ghost"
                        density="mini"
                        :label="t('common.remove')"
                        @click="removeRegistrationEmailSuffixWhitelistTag(suffix)"
                      />
                    </span>

                    <div class="min-w-[220px] flex-1">
                      <UiTextField
                        v-model="registrationEmailSuffixWhitelistDraft"
                        type="text"
                        density="compact"
                        monospace
                        :placeholder="t('admin.settings.registration.emailSuffixWhitelistPlaceholder')"
                        :input-attrs="{ 'aria-label': t('admin.settings.registration.emailSuffixWhitelist') }"
                        @input="handleRegistrationEmailSuffixWhitelistDraftInput"
                        @keydown="handleRegistrationEmailSuffixWhitelistDraftKeydown"
                        @blur="commitRegistrationEmailSuffixWhitelistDraft"
                        @paste="handleRegistrationEmailSuffixWhitelistPaste"
                      />
                    </div>
                  </div>
                </div>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    t(
                      "admin.settings.registration.emailSuffixWhitelistInputHint",
                    )
                  }}
                </p>
              </div>

              <!-- Email Domain Quota -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.registration.emailDomainQuota")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.registration.emailDomainQuotaHint") }}
                  </p>
                </div>
                <Toggle
                  v-model="form.registration_email_domain_quota_enabled"
                />
              </div>

              <!-- Promo Code -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.registration.promoCode")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.registration.promoCodeHint") }}
                  </p>
                </div>
                <Toggle v-model="form.promo_code_enabled" />
              </div>

              <!-- Invitation Code -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.registration.invitationCode")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.registration.invitationCodeHint") }}
                  </p>
                </div>
                <Toggle v-model="form.invitation_code_enabled" />
              </div>
              <!-- Password Reset - Only show when email verification is enabled -->
              <div
                v-if="form.email_verify_enabled"
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.registration.passwordReset")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.registration.passwordResetHint") }}
                  </p>
                </div>
                <Toggle v-model="form.password_reset_enabled" />
              </div>
              <!-- Frontend URL - Only show when password reset is enabled -->
              <div
                v-if="form.email_verify_enabled && form.password_reset_enabled"
                class="border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <UiTextField
                  v-model="form.frontend_url"
                  type="url"
                  density="compact"
                  :label="t('admin.settings.registration.frontendUrl')"
                  :description="t('admin.settings.registration.frontendUrlHint')"
                  :placeholder="
                    t('admin.settings.registration.frontendUrlPlaceholder')
                  "
                />
              </div>

              <!-- TOTP 2FA -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div class="min-w-0">
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.registration.totp")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.registration.totpHint") }}
                  </p>
                  <!-- Warning when encryption key not configured -->
                  <p
                    v-if="!form.totp_encryption_key_configured"
                    class="mt-2 text-sm text-amber-600 dark:text-amber-400"
                  >
                    {{ t("admin.settings.registration.totpKeyNotConfigured") }}
                  </p>
                </div>
                <Toggle
                  v-model="form.totp_enabled"
                  :disabled="!form.totp_encryption_key_configured"
                />
              </div>

              <!-- Passkey sign-in -->
              <div
                class="border-t border-gray-100 pt-4 dark:border-dark-700"
                data-testid="passkey-settings"
              >
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">{{
                      t("admin.settings.security.passkey")
                    }}</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.security.passkeyHint") }}
                    </p>
                  </div>
                  <Toggle
                    v-model="form.passkey_enabled"
                    data-testid="passkey-toggle"
                    :disabled="!form.passkey_configured"
                  />
                </div>
                <div
                  class="mt-3 rounded-lg border px-3 py-2 text-sm"
                  :class="
                    form.passkey_configured
                      ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300'
                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                  "
                  data-testid="passkey-config-status"
                >
                  <p class="font-medium">
                    {{
                      form.passkey_configured
                        ? t("admin.settings.security.passkeyConfigured")
                        : t("admin.settings.security.passkeyNotConfigured")
                    }}
                  </p>
                  <p class="mt-1 break-all">
                    {{ t("admin.settings.security.passkeyRPID") }}:
                    {{
                      form.passkey_rp_id ||
                      t("admin.settings.security.passkeyValueNotConfigured")
                    }}
                  </p>
                  <p class="mt-1 break-all">
                    {{ t("admin.settings.security.passkeyOrigins") }}:
                    {{
                      form.passkey_rp_origins.length > 0
                        ? form.passkey_rp_origins.join(", ")
                        : t(
                            "admin.settings.security.passkeyValueNotConfigured",
                          )
                    }}
                  </p>
                  <p v-if="!form.passkey_configured" class="mt-2">
                    {{ t("admin.settings.security.passkeyDeploymentHint") }}
                  </p>
                </div>
              </div>

              <!-- 敏感操作 step-up 2FA -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.security.stepUp")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.security.stepUpHint") }}
                  </p>
                </div>
                <Toggle v-model="form.step_up_enabled" />
              </div>

              <!-- 会话 IP/UA 绑定 -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.security.sessionBinding")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.security.sessionBindingHint") }}
                  </p>
                </div>
                <Toggle v-model="form.session_binding_enabled" />
              </div>

              <!-- 审计日志保留天数 -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <UiTextField
                  v-model.number="form.audit_log_retention_days"
                  type="number"
                  min="0"
                  density="compact"
                  class="w-28"
                  text-align="right"
                  :label="t('admin.settings.security.auditRetention')"
                  :description="t('admin.settings.security.auditRetentionHint')"
                />
              </div>
            </div>
          </div>

          <!-- API Key IP ACL Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.apiKeyAcl.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.apiKeyAcl.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">
                    {{ t("admin.settings.apiKeyAcl.trustForwardedIp") }}
                  </label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.apiKeyAcl.trustForwardedIpHint") }}
                  </p>
                </div>
                <Toggle v-model="form.api_key_acl_trust_forwarded_ip" />
              </div>

              <div
                v-if="form.api_key_acl_trust_forwarded_ip"
                class="border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <label
                  for="forwarded-client-ip-headers"
                  class="font-medium text-gray-900 dark:text-white"
                >
                  {{ t("admin.settings.apiKeyAcl.forwardedClientIpHeaders") }}
                </label>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.apiKeyAcl.forwardedClientIpHeadersHint") }}
                </p>
                <div
                  class="mt-3 rounded-lg border border-gray-300 bg-white p-2 dark:border-dark-500 dark:bg-dark-700"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      v-for="header in form.forwarded_client_ip_headers"
                      :key="header"
                      data-testid="forwarded-client-ip-header-tag"
                      class="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700 dark:bg-dark-600 dark:text-gray-200"
                    >
                      <span>{{ header }}</span>
                      <UiIconButton
                        type="button"
                        icon="x"
                        variant="ghost"
                        density="mini"
                        :label="t('admin.settings.apiKeyAcl.removeForwardedClientIpHeader', { header })"
                        @click="removeForwardedClientIpHeader(header)"
                      />
                    </span>
                    <div class="min-w-[220px] flex-1">
                      <UiTextField
                        id="forwarded-client-ip-headers"
                        v-model="forwardedClientIpHeaderDraft"
                        test-id="forwarded-client-ip-headers-input"
                        type="text"
                        density="compact"
                        monospace
                        :placeholder="t('admin.settings.apiKeyAcl.forwardedClientIpHeadersPlaceholder')"
                        :input-attrs="{ 'aria-label': t('admin.settings.apiKeyAcl.forwardedClientIpHeaders') }"
                        @keydown="handleForwardedClientIpHeaderKeydown"
                        @blur="commitForwardedClientIpHeaderDraft"
                        @paste="handleForwardedClientIpHeaderPaste"
                      />
                    </div>
                  </div>
                </div>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.apiKeyAcl.forwardedClientIpHeadersRiskHint") }}
                </p>
              </div>
            </div>
          </div>

          <!-- Panel API Rate Limit Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <div class="flex items-center gap-2">
                <Icon
                  name="shield"
                  size="md"
                  class="text-primary-500"
                />
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t("admin.settings.panelRateLimit.title") }}
                </h2>
              </div>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.panelRateLimit.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div
                v-if="panelRateLimitLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <UiSpinner size="sm" :label="t('common.loading')" />
                {{ t("common.loading") }}
              </div>

              <template v-else>
                <!-- 计数维度说明：按账号计数，反代部署无误伤 -->
                <div
                  class="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20"
                >
                  <div class="flex items-start">
                    <Icon
                      name="infoCircle"
                      size="md"
                      class="mt-0.5 flex-shrink-0 text-sky-500"
                    />
                    <p class="ml-3 text-sm text-sky-700 dark:text-sky-300">
                      {{ t("admin.settings.panelRateLimit.proxySafeNote") }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">{{
                      t("admin.settings.panelRateLimit.enabled")
                    }}</label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.panelRateLimit.enabledHint") }}
                    </p>
                  </div>
                  <Toggle v-model="panelRateLimitForm.enabled" />
                </div>

                <div
                  v-if="panelRateLimitForm.enabled"
                  class="space-y-5 border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model.number="panelRateLimitForm.user_rpm"
                          type="number"
                          min="0"
                          max="100000"
                          density="compact"
                          class="w-32"
                          :test-id="'panel-rate-limit-user-rpm'"
                          :label="t('admin.settings.panelRateLimit.userRpm')"
                        />
                        <span class="text-sm text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.panelRateLimit.perMinute") }}
                        </span>
                      </div>
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.panelRateLimit.userRpmHint") }}
                      </p>
                    </div>

                    <div>
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model.number="panelRateLimitForm.heavy_rpm"
                          type="number"
                          min="0"
                          max="100000"
                          density="compact"
                          class="w-32"
                          :label="t('admin.settings.panelRateLimit.heavyRpm')"
                        />
                        <span class="text-sm text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.panelRateLimit.perMinute") }}
                        </span>
                      </div>
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.panelRateLimit.heavyRpmHint") }}
                      </p>
                    </div>

                    <div>
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model.number="panelRateLimitForm.public_ip_rpm"
                          type="number"
                          min="0"
                          max="100000"
                          density="compact"
                          class="w-32"
                          :label="t('admin.settings.panelRateLimit.publicIpRpm')"
                        />
                        <span class="text-sm text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.panelRateLimit.perMinute") }}
                        </span>
                      </div>
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.panelRateLimit.publicIpRpmHint") }}
                      </p>
                    </div>
                  </div>

                  <div
                    class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
                  >
                    <div>
                      <label class="font-medium text-gray-900 dark:text-white">{{
                        t("admin.settings.panelRateLimit.exemptAdmin")
                      }}</label>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.panelRateLimit.exemptAdminHint") }}
                      </p>
                    </div>
                    <Toggle v-model="panelRateLimitForm.exempt_admin" />
                  </div>
                </div>

                <div
                  class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiButton
                    type="button"
                    data-testid="panel-rate-limit-save"
                    @click="savePanelRateLimitSettings"
                    variant="primary"
                    density="compact"
                    :loading="panelRateLimitSaving"
                  >
                    {{
                      panelRateLimitSaving
                        ? t("common.saving")
                        : t("common.save")
                    }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>

          <!-- 人机验证 Settings -->
          <div class="settings-section" data-testid="captcha-settings">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.captcha.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.captcha.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <!-- Enable Captcha -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.captcha.enable")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.captcha.enableHint") }}
                  </p>
                </div>
                <Toggle
                  v-model="captchaMasterEnabled"
                  data-testid="captcha-enabled-toggle"
                />
              </div>

              <!-- Provider fields - Only show when enabled -->
              <div
                v-if="captchaMasterEnabled"
                class="border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <!-- Provider Selector -->
                <div class="mb-6">
                  <label
                    class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.captcha.provider") }}
                  </label>
                  <div
                    class="grid grid-cols-3 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-dark-700"
                  >
                    <UiButton
                      type="button"
                      data-testid="captcha-provider-turnstile"
                      :aria-pressed="captchaProviderSelection === 'turnstile'"
                      :variant="captchaProviderSelection === 'turnstile' ? 'primary' : 'secondary'"
                      density="compact"
                      @click="selectCaptchaProvider('turnstile')"
                    >
                      {{ t("admin.settings.captcha.providerTurnstile") }}
                    </UiButton>
                    <UiButton
                      type="button"
                      data-testid="captcha-provider-tencent"
                      :aria-pressed="captchaProviderSelection === 'tencent'"
                      :variant="captchaProviderSelection === 'tencent' ? 'primary' : 'secondary'"
                      density="compact"
                      @click="selectCaptchaProvider('tencent')"
                    >
                      {{ t("admin.settings.captcha.providerTencent") }}
                    </UiButton>
                    <UiButton
                      type="button"
                      data-testid="captcha-provider-aliyun"
                      :aria-pressed="captchaProviderSelection === 'aliyun'"
                      :variant="captchaProviderSelection === 'aliyun' ? 'primary' : 'secondary'"
                      density="compact"
                      @click="selectCaptchaProvider('aliyun')"
                    >
                      {{ t("admin.settings.captcha.providerAliyun") }}
                    </UiButton>
                  </div>
                </div>

                <!-- Cloudflare Turnstile fields -->
                <div
                  v-if="captchaProviderSelection === 'turnstile'"
                  class="grid grid-cols-1 gap-6"
                >
                  <div>
                    <UiTextField
                      v-model="form.turnstile_site_key"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.turnstile.siteKey')"
                      placeholder="0x4AAAAAAA..."
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.turnstile.siteKeyHint") }}
                      <a
                        href="https://dash.cloudflare.com/"
                        target="_blank"
                        class="text-primary-600 hover:text-primary-500"
                        >{{
                          t("admin.settings.turnstile.cloudflareDashboard")
                        }}</a
                      >
                    </p>
                  </div>
                  <div>
                    <UiPasswordField
                      v-model="form.turnstile_secret_key"
                      density="compact"
                      monospace
                      :label="t('admin.settings.turnstile.secretKey')"
                      placeholder="0x4AAAAAAA..."
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        form.turnstile_secret_key_configured
                          ? t(
                              "admin.settings.turnstile.secretKeyConfiguredHint",
                            )
                          : t("admin.settings.turnstile.secretKeyHint")
                      }}
                    </p>
                  </div>
                </div>

                <!-- Tencent Captcha fields -->
                <div v-else-if="captchaProviderSelection === 'tencent'">
                  <div class="mb-6 max-w-sm">
                    <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ t("admin.settings.tencentCaptcha.region") }}
                    </label>
                    <div class="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-dark-700">
                      <UiButton
                        type="button"
                        data-testid="tencent-captcha-region-cn"
                        :aria-pressed="form.tencent_captcha_region !== 'intl'"
                        :variant="form.tencent_captcha_region !== 'intl' ? 'primary' : 'secondary'"
                        density="compact"
                        @click="form.tencent_captcha_region = 'cn'"
                      >
                        {{ t("admin.settings.tencentCaptcha.regionCn") }}
                      </UiButton>
                      <UiButton
                        type="button"
                        data-testid="tencent-captcha-region-intl"
                        :aria-pressed="form.tencent_captcha_region === 'intl'"
                        :variant="form.tencent_captcha_region === 'intl' ? 'primary' : 'secondary'"
                        density="compact"
                        @click="form.tencent_captcha_region = 'intl'"
                      >
                        {{ t("admin.settings.tencentCaptcha.regionIntl") }}
                      </UiButton>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.tencentCaptcha.regionHint") }}
                    </p>
                  </div>
                  <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div class="md:col-span-2">
                      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ t("admin.settings.tencentCaptcha.appCredentialsTitle") }}
                      </h3>
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.tencentCaptcha.appCredentialsHint") }}
                      </p>
                    </div>
                    <div>
                      <UiTextField
                        v-model="form.tencent_captcha_app_id"
                        type="text"
                        inputmode="numeric"
                        density="compact"
                        monospace
                        :label="t('admin.settings.tencentCaptcha.appId')"
                        placeholder="123456789"
                      />
                    </div>
                    <div>
                      <UiPasswordField
                        v-model="form.tencent_captcha_app_secret_key"
                        density="compact"
                        monospace
                        :label="t('admin.settings.tencentCaptcha.appSecretKey')"
                        autocomplete="new-password"
                        :placeholder="t('admin.settings.tencentCaptcha.keepExisting')"
                      />
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ form.tencent_captcha_app_secret_key_configured ? t("admin.settings.tencentCaptcha.configured") : t("admin.settings.tencentCaptcha.required") }}
                      </p>
                    </div>
                    <div class="border-t border-gray-100 pt-5 md:col-span-2 dark:border-dark-700">
                      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                        {{ t("admin.settings.tencentCaptcha.cloudCredentialsTitle") }}
                      </h3>
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.tencentCaptcha.cloudCredentialsHint") }}
                      </p>
                    </div>
                    <div>
                      <UiPasswordField
                        v-model="form.tencent_captcha_cloud_secret_id"
                        density="compact"
                        monospace
                        :label="t('admin.settings.tencentCaptcha.cloudSecretId')"
                        autocomplete="new-password"
                        :placeholder="t('admin.settings.tencentCaptcha.keepExisting')"
                      />
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ form.tencent_captcha_cloud_secret_id_configured ? t("admin.settings.tencentCaptcha.configured") : t("admin.settings.tencentCaptcha.required") }}
                      </p>
                    </div>
                    <div>
                      <UiPasswordField
                        v-model="form.tencent_captcha_cloud_secret_key"
                        density="compact"
                        monospace
                        :label="t('admin.settings.tencentCaptcha.cloudSecretKey')"
                        autocomplete="new-password"
                        :placeholder="t('admin.settings.tencentCaptcha.keepExisting')"
                      />
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ form.tencent_captcha_cloud_secret_key_configured ? t("admin.settings.tencentCaptcha.configured") : t("admin.settings.tencentCaptcha.required") }}
                      </p>
                    </div>
                  </div>
                  <p class="mt-5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.tencentCaptcha.camPermissionHint") }}
                  </p>
                  <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.tencentCaptcha.aidEncryptedHint") }}
                  </p>
                  <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <a
                      :href="tencentCaptchaLinks.console"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 hover:text-primary-500"
                    >
                      {{ t("admin.settings.tencentCaptcha.openCaptchaConsole") }}
                    </a>
                    <a
                      :href="tencentCaptchaLinks.cloudKeys"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 hover:text-primary-500"
                    >
                      {{ t("admin.settings.tencentCaptcha.createCloudKeys") }}
                    </a>
                    <a
                      :href="tencentCaptchaLinks.webDocs"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 hover:text-primary-500"
                    >
                      {{ t("admin.settings.tencentCaptcha.openWebDocs") }}
                    </a>
                  </div>
                </div>

                <!-- Aliyun Captcha 2.0 fields -->
                <div v-else class="grid grid-cols-1 gap-6">
                  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label
                        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {{ t("admin.settings.aliyunCaptcha.region") }}
                      </label>
                      <div
                        class="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-dark-700"
                      >
                        <UiButton
                          type="button"
                          :aria-pressed="form.aliyun_captcha_region !== 'sgp'"
                          :variant="form.aliyun_captcha_region !== 'sgp' ? 'primary' : 'secondary'"
                          density="compact"
                          @click="form.aliyun_captcha_region = 'cn'"
                        >
                          {{ t("admin.settings.aliyunCaptcha.regionCn") }}
                        </UiButton>
                        <UiButton
                          type="button"
                          :aria-pressed="form.aliyun_captcha_region === 'sgp'"
                          :variant="form.aliyun_captcha_region === 'sgp' ? 'primary' : 'secondary'"
                          density="compact"
                          @click="form.aliyun_captcha_region = 'sgp'"
                        >
                          {{ t("admin.settings.aliyunCaptcha.regionSgp") }}
                        </UiButton>
                      </div>
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.aliyunCaptcha.regionHint") }}
                      </p>
                    </div>
                    <div>
                      <UiTextField
                        v-model="form.aliyun_captcha_prefix"
                        type="text"
                        density="compact"
                        monospace
                        :label="t('admin.settings.aliyunCaptcha.prefix')"
                        placeholder="14xxxxx"
                      />
                      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.aliyunCaptcha.prefixHint") }}
                      </p>
                    </div>
                  </div>
                  <div>
                    <UiTextField
                      v-model="form.aliyun_captcha_scene_id"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.aliyunCaptcha.sceneId')"
                      placeholder="1cxxxxxx"
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.aliyunCaptcha.sceneIdHint") }}
                    </p>
                  </div>
                  <div>
                    <UiTextField
                      v-model="form.aliyun_captcha_access_key_id"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.aliyunCaptcha.accessKeyId')"
                      placeholder="LTAI..."
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.aliyunCaptcha.accessKeyIdHint") }}
                    </p>
                  </div>
                  <div>
                    <UiPasswordField
                      v-model="form.aliyun_captcha_access_key_secret"
                      density="compact"
                      monospace
                      :label="t('admin.settings.aliyunCaptcha.accessKeySecret')"
                      autocomplete="new-password"
                      placeholder="••••••••"
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        form.aliyun_captcha_access_key_secret_configured
                          ? t(
                              "admin.settings.aliyunCaptcha.accessKeySecretConfiguredHint",
                            )
                          : t("admin.settings.aliyunCaptcha.accessKeySecretHint")
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- LinuxDo Connect OAuth 登录 -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.linuxdo.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.linuxdo.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.linuxdo.enable")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.linuxdo.enableHint") }}
                  </p>
                </div>
                <Toggle v-model="form.linuxdo_connect_enabled" />
              </div>

              <div
                v-if="form.linuxdo_connect_enabled"
                class="border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div class="grid grid-cols-1 gap-6">
                  <div>
                    <UiTextField
                      v-model="form.linuxdo_connect_client_id"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.linuxdo.clientId')"
                      :placeholder="
                        t('admin.settings.linuxdo.clientIdPlaceholder')
                      "
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.linuxdo.clientIdHint") }}
                    </p>
                  </div>

                  <div>
                    <UiPasswordField
                      v-model="form.linuxdo_connect_client_secret"
                      density="compact"
                      monospace
                      :label="t('admin.settings.linuxdo.clientSecret')"
                      :placeholder="
                        form.linuxdo_connect_client_secret_configured
                          ? t(
                              'admin.settings.linuxdo.clientSecretConfiguredPlaceholder',
                            )
                          : t('admin.settings.linuxdo.clientSecretPlaceholder')
                      "
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        form.linuxdo_connect_client_secret_configured
                          ? t(
                              "admin.settings.linuxdo.clientSecretConfiguredHint",
                            )
                          : t("admin.settings.linuxdo.clientSecretHint")
                      }}
                    </p>
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.linuxdo_connect_redirect_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.linuxdo.redirectUrl')"
                      :placeholder="
                        t('admin.settings.linuxdo.redirectUrlPlaceholder')
                      "
                    />
                    <div
                      class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <UiButton
                        type="button"
                        variant="secondary"
                        density="compact"
                        @click="setAndCopyLinuxdoRedirectUrl"
                      >
                        {{ t("admin.settings.linuxdo.quickSetCopy") }}
                      </UiButton>
                      <code
                        v-if="linuxdoRedirectUrlSuggestion"
                        class="select-all break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300"
                      >
                        {{ linuxdoRedirectUrlSuggestion }}
                      </code>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.linuxdo.redirectUrlHint") }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- GitHub / Google 邮箱快捷登录 -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ localText("邮箱快捷登录", "Email OAuth Sign-in") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{
                  localText(
                    "开启 GitHub 或 Google 邮箱授权登录后，系统会读取已验证邮箱，存在则直接登录，不存在则自动注册。",
                    "After GitHub or Google email OAuth is enabled, the system reads a verified email, signs in matching users, and auto-registers missing users.",
                  )
                }}
              </p>
            </div>
            <div class="space-y-6 p-6">
              <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-700">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h3 class="font-medium text-gray-900 dark:text-white">
                        GitHub
                      </h3>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{
                          localText(
                            "GitHub OAuth App 需要 read:user user:email 权限，回调地址填写下方后端地址。",
                            "GitHub OAuth App needs read:user user:email scopes. Use the backend callback URL below.",
                          )
                        }}
                      </p>
                    </div>
                    <Toggle v-model="form.github_oauth_enabled" />
                  </div>

                  <div v-if="form.github_oauth_enabled" class="mt-4 space-y-4">
                    <div class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300">
                      <template v-if="isZhLocale">
                        开通引导：GitHub Settings → Developer settings →
                        <a
                          data-testid="github-oauth-apps-guide-link"
                          href="https://github.com/settings/developers"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                        >OAuth Apps</a>
                        → New OAuth App；Homepage URL 填站点域名，Authorization callback URL 填下面的后端回调地址。
                      </template>
                      <template v-else>
                        Setup guide: GitHub Settings → Developer settings →
                        <a
                          data-testid="github-oauth-apps-guide-link"
                          href="https://github.com/settings/developers"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="font-medium text-primary-600 hover:underline dark:text-primary-400"
                        >OAuth Apps</a>
                        → New OAuth App. Use your site origin as Homepage URL and the backend callback URL below as Authorization callback URL.
                      </template>
                    </div>

                    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <UiTextField
                          v-model="form.github_oauth_client_id"
                          type="text"
                          density="compact"
                          monospace
                          label="Client ID"
                          placeholder="GitHub OAuth Client ID"
                        />
                      </div>
                      <div>
                        <UiPasswordField
                          v-model="form.github_oauth_client_secret"
                          density="compact"
                          monospace
                          label="Client Secret"
                          :placeholder="
                            form.github_oauth_client_secret_configured
                              ? localText('密钥已配置，留空以保留当前值。', 'Secret configured. Leave empty to keep the current value.')
                              : 'GitHub OAuth Client Secret'
                          "
                        />
                      </div>
                    </div>

                    <div>
                      <UiTextField
                        v-model="form.github_oauth_redirect_url"
                        type="url"
                        density="compact"
                        monospace
                        :label="localText('后端回调地址', 'Backend Callback URL')"
                        placeholder="https://your-domain.com/api/v1/auth/oauth/github/callback"
                      />
                      <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <UiButton
                          type="button"
                          variant="secondary"
                          density="compact"
                          @click="setAndCopyEmailOAuthRedirectUrl('github')"
                        >
                          {{ localText("生成并复制", "Generate and copy") }}
                        </UiButton>
                        <code
                          v-if="githubOAuthRedirectUrlSuggestion"
                          class="select-all break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300"
                        >
                          {{ githubOAuthRedirectUrlSuggestion }}
                        </code>
                      </div>
                    </div>

                    <div>
                      <UiTextField
                        v-model="form.github_oauth_frontend_redirect_url"
                        type="text"
                        density="compact"
                        monospace
                        :label="localText('前端回跳地址', 'Frontend Callback URL')"
                        placeholder="/auth/oauth/callback"
                      />
                    </div>
                  </div>
                </div>

                <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-700">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h3 class="font-medium text-gray-900 dark:text-white">
                        Google
                      </h3>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{
                          localText(
                            "Google OAuth 客户端需要 openid email profile 范围，并在凭据里登记后端回调地址。",
                            "Google OAuth client needs openid email profile scopes and the backend callback URL registered in credentials.",
                          )
                        }}
                      </p>
                    </div>
                    <Toggle v-model="form.google_oauth_enabled" />
                  </div>

                  <div v-if="form.google_oauth_enabled" class="mt-4 space-y-4">
                    <div class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300">
                      {{
                        localText(
                          "开通引导：Google Cloud Console → APIs & Services → OAuth consent screen 完成同意屏幕；Credentials → Create Credentials → OAuth client ID，类型选择 Web application，并把下面地址加入 Authorized redirect URIs。",
                          "Setup guide: Google Cloud Console → APIs & Services → OAuth consent screen, then Credentials → Create Credentials → OAuth client ID, choose Web application, and add the URL below to Authorized redirect URIs.",
                        )
                      }}
                    </div>

                    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <UiTextField
                          v-model="form.google_oauth_client_id"
                          type="text"
                          density="compact"
                          monospace
                          label="Client ID"
                          placeholder="Google OAuth Client ID"
                        />
                      </div>
                      <div>
                        <UiPasswordField
                          v-model="form.google_oauth_client_secret"
                          density="compact"
                          monospace
                          label="Client Secret"
                          :placeholder="
                            form.google_oauth_client_secret_configured
                              ? localText('密钥已配置，留空以保留当前值。', 'Secret configured. Leave empty to keep the current value.')
                              : 'Google OAuth Client Secret'
                          "
                        />
                      </div>
                    </div>

                    <div>
                      <UiTextField
                        v-model="form.google_oauth_redirect_url"
                        type="url"
                        density="compact"
                        monospace
                        :label="localText('后端回调地址', 'Backend Callback URL')"
                        placeholder="https://your-domain.com/api/v1/auth/oauth/google/callback"
                      />
                      <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <UiButton
                          type="button"
                          variant="secondary"
                          density="compact"
                          @click="setAndCopyEmailOAuthRedirectUrl('google')"
                        >
                          {{ localText("生成并复制", "Generate and copy") }}
                        </UiButton>
                        <code
                          v-if="googleOAuthRedirectUrlSuggestion"
                          class="select-all break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300"
                        >
                          {{ googleOAuthRedirectUrlSuggestion }}
                        </code>
                      </div>
                    </div>

                    <div>
                      <UiTextField
                        v-model="form.google_oauth_frontend_redirect_url"
                        type="text"
                        density="compact"
                        monospace
                        :label="localText('前端回跳地址', 'Frontend Callback URL')"
                        placeholder="/auth/oauth/callback"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- WeChat Connect OAuth 登录 -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.wechatConnect.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.wechatConnect.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.wechatConnect.enabledLabel")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.wechatConnect.enabledHint") }}
                  </p>
                </div>
                <Toggle
                  v-model="form.wechat_connect_enabled"
                  data-testid="wechat-connect-enabled"
                />
              </div>

              <div
                v-if="form.wechat_connect_enabled"
                class="space-y-6 border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div class="space-y-4">
                  <div
                    class="rounded-lg border border-gray-200 p-4 dark:border-dark-700"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h3 class="font-medium text-gray-900 dark:text-white">
                          {{ localText("PC 应用", "PC App") }}
                        </h3>
                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {{
                            localText(
                              "桌面浏览器通过微信开放平台扫码登录。可与公众号或移动应用同时存在。",
                              "Desktop browsers sign in through WeChat Open Platform QR login. This can coexist with Official Account or Mobile App.",
                            )
                          }}
                        </p>
                      </div>
                      <Toggle
                        :model-value="form.wechat_connect_open_enabled"
                        data-testid="wechat-connect-open-enabled"
                        @update:model-value="handleWeChatOpenEnabledChange"
                      />
                    </div>
                    <div
                      v-if="form.wechat_connect_open_enabled"
                      class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2"
                    >
                      <div>
                        <UiTextField
                          v-model="form.wechat_connect_open_app_id"
                          test-id="wechat-connect-open-app-id"
                          type="text"
                          density="compact"
                          monospace
                          :label="localText('PC AppID', 'PC App ID')"
                          :placeholder="
                            localText(
                              '微信开放平台 PC 应用 AppID',
                              'WeChat Open Platform PC App ID',
                            )
                          "
                        />
                      </div>
                      <div>
                        <UiPasswordField
                          v-model="form.wechat_connect_open_app_secret"
                          test-id="wechat-connect-open-app-secret"
                          density="compact"
                          monospace
                          :label="localText('PC AppSecret', 'PC App Secret')"
                          :placeholder="
                            form.wechat_connect_open_app_secret_configured
                              ? localText(
                                  '密钥已配置，留空以保留当前值。',
                                  'Secret configured. Leave empty to keep the current value.',
                                )
                              : localText(
                                  '微信开放平台 PC 应用 AppSecret',
                                  'WeChat Open Platform PC App Secret',
                                )
                          "
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    class="rounded-lg border border-gray-200 p-4 dark:border-dark-700"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h3 class="font-medium text-gray-900 dark:text-white">
                          {{ localText("公众号", "Official Account") }}
                        </h3>
                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {{
                            localText(
                              "仅在微信内浏览器可用；非微信环境下会显示不可用。",
                              "Only available inside the WeChat browser. It is shown as unavailable outside WeChat.",
                            )
                          }}
                        </p>
                      </div>
                      <Toggle
                        :model-value="form.wechat_connect_mp_enabled"
                        data-testid="wechat-connect-mp-enabled"
                        @update:model-value="handleWeChatMPEnabledChange"
                      />
                    </div>
                    <div
                      v-if="form.wechat_connect_mp_enabled"
                      class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2"
                    >
                      <div>
                        <UiTextField
                          v-model="form.wechat_connect_mp_app_id"
                          test-id="wechat-connect-mp-app-id"
                          type="text"
                          density="compact"
                          monospace
                          :label="localText('公众号 AppID', 'Official Account App ID')"
                          :placeholder="
                            localText(
                              '公众号 AppID',
                              'Official Account App ID',
                            )
                          "
                        />
                      </div>
                      <div>
                        <UiPasswordField
                          v-model="form.wechat_connect_mp_app_secret"
                          test-id="wechat-connect-mp-app-secret"
                          density="compact"
                          monospace
                          :label="localText('公众号 AppSecret', 'Official Account App Secret')"
                          :placeholder="
                            form.wechat_connect_mp_app_secret_configured
                              ? localText(
                                  '密钥已配置，留空以保留当前值。',
                                  'Secret configured. Leave empty to keep the current value.',
                                )
                              : localText(
                                  '公众号 AppSecret',
                                  'Official Account App Secret',
                                )
                          "
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    class="rounded-lg border border-gray-200 p-4 dark:border-dark-700"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h3 class="font-medium text-gray-900 dark:text-white">
                          {{ localText("移动应用", "Mobile App") }}
                        </h3>
                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {{
                            localText(
                              "原生移动端通过微信 SDK 唤起授权，网页端不会直接发起该流程。",
                              "Native mobile clients start authorization through the WeChat SDK. The web UI does not launch this flow directly.",
                            )
                          }}
                        </p>
                      </div>
                      <Toggle
                        :model-value="form.wechat_connect_mobile_enabled"
                        data-testid="wechat-connect-mobile-enabled"
                        @update:model-value="handleWeChatMobileEnabledChange"
                      />
                    </div>
                    <div
                      v-if="form.wechat_connect_mobile_enabled"
                      class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2"
                    >
                      <div>
                        <UiTextField
                          v-model="form.wechat_connect_mobile_app_id"
                          test-id="wechat-connect-mobile-app-id"
                          type="text"
                          density="compact"
                          monospace
                          :label="localText('移动应用 AppID', 'Mobile App ID')"
                          :placeholder="
                            localText(
                              '移动应用 AppID',
                              'Mobile App ID',
                            )
                          "
                        />
                      </div>
                      <div>
                        <UiPasswordField
                          v-model="form.wechat_connect_mobile_app_secret"
                          test-id="wechat-connect-mobile-app-secret"
                          density="compact"
                          monospace
                          :label="localText('移动应用 AppSecret', 'Mobile App Secret')"
                          :placeholder="
                            form.wechat_connect_mobile_app_secret_configured
                              ? localText(
                                  '密钥已配置，留空以保留当前值。',
                                  'Secret configured. Leave empty to keep the current value.',
                                )
                              : localText(
                                  '移动应用 AppSecret',
                                  'Mobile App Secret',
                                )
                          "
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="
                    form.wechat_connect_open_enabled &&
                    (form.wechat_connect_mp_enabled ||
                      form.wechat_connect_mobile_enabled)
                  "
                  class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300"
                >
                  {{
                    localText(
                      "如果同时启用 PC 应用和公众号/移动应用，这些应用需要挂在同一个微信开放平台主体下，否则 UnionID 无法稳定归并账号。",
                      "When PC App is enabled together with Official Account or Mobile App, they should belong to the same WeChat Open Platform account so UnionID can merge identities reliably.",
                    )
                  }}
                </div>

                <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <UiTextField
                      test-id="wechat-connect-redirect-url"
                      v-model="form.wechat_connect_redirect_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="localText('浏览器回调地址', 'Browser Redirect URL')"
                      :placeholder="t('admin.settings.wechatConnect.redirectUrlPlaceholder')"
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        localText(
                          "用于 PC 应用和公众号的网页回调。移动应用走原生 SDK 时不直接使用这个浏览器回调。",
                          "Used by PC App and Official Account browser callbacks. Native mobile SDK flows do not start from this browser callback directly.",
                        )
                      }}
                    </p>
                    <div
                      class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <UiButton
                        type="button"
                        variant="secondary"
                        density="compact"
                        class="w-fit"
                        @click="setAndCopyWeChatRedirectUrl"
                      >
                        {{ t("admin.settings.wechatConnect.generateAndCopy") }}
                      </UiButton>
                      <code
                        v-if="wechatRedirectUrlSuggestion"
                        class="select-all break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300"
                      >
                        {{ wechatRedirectUrlSuggestion }}
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <UiTextField
                    test-id="wechat-connect-frontend-redirect-url"
                    v-model="form.wechat_connect_frontend_redirect_url"
                    type="text"
                    density="compact"
                    monospace
                    :label="t('admin.settings.wechatConnect.frontendRedirectUrlLabel')"
                    :placeholder="t('admin.settings.wechatConnect.frontendRedirectUrlPlaceholder')"
                  />
                  <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.wechatConnect.frontendRedirectUrlHint") }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- DingTalk Connect OAuth 登录 -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.dingtalk.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.dingtalk.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.dingtalk.enable")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.dingtalk.enableHint") }}
                  </p>
                </div>
                <Toggle v-model="form.dingtalk_connect_enabled" />
              </div>

              <div
                v-if="form.dingtalk_connect_enabled"
                class="border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div class="grid grid-cols-1 gap-6">
                  <div>
                    <UiTextField
                      v-model="form.dingtalk_connect_client_id"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.dingtalk.clientId')"
                      :placeholder="
                        t('admin.settings.dingtalk.clientIdPlaceholder')
                      "
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.dingtalk.clientIdHint") }}
                    </p>
                  </div>

                  <div>
                    <UiPasswordField
                      v-model="form.dingtalk_connect_client_secret"
                      inputmode="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.dingtalk.clientSecret')"
                      :input-attrs="{ class: 'font-mono' }"
                      :placeholder="
                        form.dingtalk_connect_client_secret_configured
                          ? t(
                              'admin.settings.dingtalk.clientSecretConfiguredPlaceholder',
                            )
                          : t('admin.settings.dingtalk.clientSecretPlaceholder')
                      "
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        form.dingtalk_connect_client_secret_configured
                          ? t(
                              "admin.settings.dingtalk.clientSecretConfiguredHint",
                            )
                          : t("admin.settings.dingtalk.clientSecretHint")
                      }}
                    </p>
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.dingtalk_connect_redirect_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.dingtalk.redirectUrl')"
                      :placeholder="
                        t('admin.settings.dingtalk.redirectUrlPlaceholder')
                      "
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.dingtalk.redirectUrlHint") }}
                    </p>
                  </div>

                  <!-- Corp Restriction Policy -->
                  <div class="border-t border-gray-100 pt-4 dark:border-dark-700">
                    <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.dingtalk.corpPolicy.hint") }}
                    </p>
                    <UiRadioGroup
                      v-model="form.dingtalk_connect_corp_restriction_policy"
                      name="dingtalk-corp-restriction-policy"
                      :label="t('admin.settings.dingtalk.corpPolicy.label')"
                      layout="stacked"
                      :options="[
                        { value: 'none', label: t('admin.settings.dingtalk.corpPolicy.none') },
                        { value: 'internal_only', label: t('admin.settings.dingtalk.corpPolicy.internalOnly') },
                      ]"
                    />
                  </div>

                  <!-- bypass_registration toggle（仅 internal_only 模式下可见可用） -->
                  <div
                    v-if="form.dingtalk_connect_corp_restriction_policy === 'internal_only'"
                    class="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-dark-700"
                  >
                    <div>
                      <label class="font-medium text-gray-900 dark:text-white">{{
                        t("admin.settings.dingtalk.bypassRegistration")
                      }}</label>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ t("admin.settings.dingtalk.bypassRegistrationHint") }}
                      </p>
                    </div>
                    <Toggle v-model="form.dingtalk_connect_bypass_registration" />
                  </div>

                  <!-- 身份同步开关（仅 internal_only 模式下可见） -->
                  <div
                    v-if="form.dingtalk_connect_corp_restriction_policy === 'internal_only'"
                    class="pt-4 border-t border-gray-100 dark:border-dark-700 space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <label class="font-medium text-gray-900 dark:text-white">{{
                          t("admin.settings.dingtalk.syncDisplayName")
                        }}</label>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.dingtalk.syncDisplayNameHint") }}
                        </p>
                      </div>
                      <Toggle v-model="form.dingtalk_connect_sync_display_name" />
                    </div>
                    <div v-if="form.dingtalk_connect_sync_display_name" class="space-y-2">
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model="form.dingtalk_connect_sync_display_name_attr_key"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.dingtalk.syncDisplayNameTarget')"
                          placeholder="dingtalk_name"
                          class="max-w-xs flex-1"
                        />
                      </div>
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model="form.dingtalk_connect_sync_display_name_attr_name"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.dingtalk.syncAttrDisplayName')"
                          :placeholder="localText('钉钉姓名', 'DingTalk Name')"
                          class="max-w-xs flex-1"
                        />
                      </div>
                    </div>
                    <p v-if="form.dingtalk_connect_sync_display_name" class="text-xs text-gray-400 dark:text-gray-500">
                      {{ t("admin.settings.dingtalk.syncDisplayNameTargetHint") }}
                    </p>
                  </div>
                  <div
                    v-if="form.dingtalk_connect_corp_restriction_policy === 'internal_only'"
                    class="pt-4 border-t border-gray-100 dark:border-dark-700 space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <label class="font-medium text-gray-900 dark:text-white">{{
                          t("admin.settings.dingtalk.syncCorpEmail")
                        }}</label>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.dingtalk.syncCorpEmailHint") }}
                        </p>
                        <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {{ t("admin.settings.dingtalk.syncCorpEmailPermissionHint") }}
                        </p>
                      </div>
                      <Toggle v-model="form.dingtalk_connect_sync_corp_email" />
                    </div>
                    <div v-if="form.dingtalk_connect_sync_corp_email" class="space-y-2">
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model="form.dingtalk_connect_sync_corp_email_attr_key"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.dingtalk.syncCorpEmailTarget')"
                          placeholder="dingtalk_email"
                          class="max-w-xs flex-1"
                        />
                      </div>
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model="form.dingtalk_connect_sync_corp_email_attr_name"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.dingtalk.syncAttrDisplayName')"
                          :placeholder="localText('钉钉企业邮箱', 'DingTalk Corporate Email')"
                          class="max-w-xs flex-1"
                        />
                      </div>
                    </div>
                    <p v-if="form.dingtalk_connect_sync_corp_email" class="text-xs text-gray-400 dark:text-gray-500">
                      {{ t("admin.settings.dingtalk.syncCorpEmailTargetHint") }}
                    </p>
                  </div>
                  <div
                    v-if="form.dingtalk_connect_corp_restriction_policy === 'internal_only'"
                    class="pt-4 border-t border-gray-100 dark:border-dark-700 space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <label class="font-medium text-gray-900 dark:text-white">{{
                          t("admin.settings.dingtalk.syncDept")
                        }}</label>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.dingtalk.syncDeptHint") }}
                        </p>
                        <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {{ t("admin.settings.dingtalk.syncDeptPermissionHint") }}
                        </p>
                      </div>
                      <Toggle v-model="form.dingtalk_connect_sync_dept" />
                    </div>
                    <div v-if="form.dingtalk_connect_sync_dept" class="space-y-2">
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model="form.dingtalk_connect_sync_dept_attr_key"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.dingtalk.syncDeptTarget')"
                          placeholder="dingtalk_department"
                          class="max-w-xs flex-1"
                        />
                      </div>
                      <div class="flex items-center gap-2">
                        <UiTextField
                          v-model="form.dingtalk_connect_sync_dept_attr_name"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.dingtalk.syncAttrDisplayName')"
                          :placeholder="localText('钉钉部门', 'DingTalk Department')"
                          class="max-w-xs flex-1"
                        />
                      </div>
                    </div>
                    <p v-if="form.dingtalk_connect_sync_dept" class="text-xs text-gray-400 dark:text-gray-500">
                      {{ t("admin.settings.dingtalk.syncDeptTargetHint") }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Generic OIDC OAuth 登录 -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.oidc.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.oidc.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.oidc.enable")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.oidc.enableHint") }}
                  </p>
                </div>
                <Toggle v-model="form.oidc_connect_enabled" />
              </div>

              <div
                v-if="form.oidc_connect_enabled"
                class="space-y-6 border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_provider_name"
                      type="text"
                      density="compact"
                      :label="t('admin.settings.oidc.providerName')"
                      :placeholder="
                        t('admin.settings.oidc.providerNamePlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_client_id"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.clientId')"
                      :placeholder="
                        t('admin.settings.oidc.clientIdPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiPasswordField
                      v-model="form.oidc_connect_client_secret"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.clientSecret')"
                      :placeholder="
                        form.oidc_connect_client_secret_configured
                          ? t(
                              'admin.settings.oidc.clientSecretConfiguredPlaceholder',
                            )
                          : t('admin.settings.oidc.clientSecretPlaceholder')
                      "
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        form.oidc_connect_client_secret_configured
                          ? t("admin.settings.oidc.clientSecretConfiguredHint")
                          : t("admin.settings.oidc.clientSecretHint")
                      }}
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_issuer_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.issuerUrl')"
                      :placeholder="
                        t('admin.settings.oidc.issuerUrlPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_discovery_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.discoveryUrl')"
                      :placeholder="
                        t('admin.settings.oidc.discoveryUrlPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_authorize_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.authorizeUrl')"
                      :placeholder="
                        t('admin.settings.oidc.authorizeUrlPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_token_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.tokenUrl')"
                      :placeholder="
                        t('admin.settings.oidc.tokenUrlPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_userinfo_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.userinfoUrl')"
                      :placeholder="
                        t('admin.settings.oidc.userinfoUrlPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_jwks_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.jwksUrl')"
                      :placeholder="t('admin.settings.oidc.jwksUrlPlaceholder')"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_scopes"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.scopes')"
                      :placeholder="t('admin.settings.oidc.scopesPlaceholder')"
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.oidc.scopesHint") }}
                    </p>
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_redirect_url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.redirectUrl')"
                      :placeholder="
                        t('admin.settings.oidc.redirectUrlPlaceholder')
                      "
                    />
                    <div
                      class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <UiButton
                        type="button"
                        variant="secondary"
                        density="compact"
                        class="w-fit"
                        @click="setAndCopyOIDCRedirectUrl"
                      >
                        {{ t("admin.settings.oidc.quickSetCopy") }}
                      </UiButton>
                      <code
                        v-if="oidcRedirectUrlSuggestion"
                        class="select-all break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 dark:bg-dark-800 dark:text-gray-300"
                      >
                        {{ oidcRedirectUrlSuggestion }}
                      </code>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.oidc.redirectUrlHint") }}
                    </p>
                  </div>

                  <div class="lg:col-span-2">
                    <UiTextField
                      v-model="form.oidc_connect_frontend_redirect_url"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.frontendRedirectUrl')"
                      :placeholder="
                        t('admin.settings.oidc.frontendRedirectUrlPlaceholder')
                      "
                    />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.oidc.frontendRedirectUrlHint") }}
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div>
                    <Select
                      v-model="form.oidc_connect_token_auth_method"
                      density="compact"
                      :label="t('admin.settings.oidc.tokenAuthMethod')"
                      :options="[
                        { value: 'client_secret_post', label: 'client_secret_post' },
                        { value: 'client_secret_basic', label: 'client_secret_basic' },
                        { value: 'none', label: 'none' },
                      ]"
                    >
                    </Select>
                  </div>

                  <div>
                    <UiTextField
                      v-model.number="form.oidc_connect_clock_skew_seconds"
                      type="number"
                      min="0"
                      max="600"
                      density="compact"
                      :label="t('admin.settings.oidc.clockSkewSeconds')"
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_allowed_signing_algs"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.allowedSigningAlgs')"
                      :placeholder="
                        t('admin.settings.oidc.allowedSigningAlgsPlaceholder')
                      "
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div
                    class="flex items-center justify-between rounded border border-gray-200 px-4 py-3 dark:border-dark-700"
                  >
                    <div>
                      <label class="font-medium text-gray-900 dark:text-white">
                        {{ t("admin.settings.oidc.usePkce") }}
                      </label>
                    </div>
                    <Toggle
                      v-model="form.oidc_connect_use_pkce"
                      data-testid="oidc-connect-use-pkce"
                    />
                  </div>

                  <div
                    class="flex items-center justify-between rounded border border-gray-200 px-4 py-3 dark:border-dark-700"
                  >
                    <div>
                      <label class="font-medium text-gray-900 dark:text-white">
                        {{ t("admin.settings.oidc.validateIdToken") }}
                      </label>
                    </div>
                    <Toggle
                      v-model="form.oidc_connect_validate_id_token"
                      data-testid="oidc-connect-validate-id-token"
                    />
                  </div>

                  <div
                    class="flex items-center justify-between rounded border border-gray-200 px-4 py-3 dark:border-dark-700"
                  >
                    <div>
                      <label class="font-medium text-gray-900 dark:text-white">
                        {{ t("admin.settings.oidc.requireEmailVerified") }}
                      </label>
                    </div>
                    <Toggle
                      v-model="form.oidc_connect_require_email_verified"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_userinfo_email_path"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.userinfoEmailPath')"
                      :placeholder="
                        t('admin.settings.oidc.userinfoEmailPathPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_userinfo_id_path"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.userinfoIdPath')"
                      :placeholder="
                        t('admin.settings.oidc.userinfoIdPathPlaceholder')
                      "
                    />
                  </div>

                  <div>
                    <UiTextField
                      v-model="form.oidc_connect_userinfo_username_path"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.oidc.userinfoUsernamePath')"
                      :placeholder="
                        t('admin.settings.oidc.userinfoUsernamePathPlaceholder')
                      "
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- /Tab: Security — Registration, Turnstile, LinuxDo, OIDC -->

        <!-- Tab: Users -->
        <div
          id="settings-panel-users"
          v-show="activeTab === 'users'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-users"
        >
          <!-- Default Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.defaults.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.defaults.description") }}
              </p>
            </div>
            <div class="space-y-6 p-6">
              <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <UiTextField
                    v-model.number="form.default_balance"
                    type="number"
                    step="0.01"
                    min="0"
                    density="compact"
                    :label="t('admin.settings.defaults.defaultBalance')"
                    :description="t('admin.settings.defaults.defaultBalanceHint')"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <UiTextField
                    v-model.number="form.default_concurrency"
                    type="number"
                    min="1"
                    density="compact"
                    :label="t('admin.settings.defaults.defaultConcurrency')"
                    :description="t('admin.settings.defaults.defaultConcurrencyHint')"
                    placeholder="1"
                  />
                </div>
                <div>
                  <UiTextField
                    v-model.number="form.default_user_rpm_limit"
                    type="number"
                    min="0"
                    step="1"
                    density="compact"
                    :label="t('admin.settings.defaults.defaultUserRpmLimit')"
                    :description="t('admin.settings.defaults.defaultUserRpmLimitHint')"
                    placeholder="0"
                  />
                </div>
              </div>

              <div class="border-t border-gray-100 pt-4 dark:border-dark-700">
                <div class="mb-3 flex items-center justify-between">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">
                      {{ t("admin.settings.defaults.defaultSubscriptions") }}
                    </label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{
                        t("admin.settings.defaults.defaultSubscriptionsHint")
                      }}
                    </p>
                  </div>
                  <UiButton
                    type="button"
                    density="compact"
                    @click="addDefaultSubscription"
                    :disabled="subscriptionPlans.length === 0"
                  >
                    {{ t("admin.settings.defaults.addDefaultSubscription") }}
                  </UiButton>
                </div>

                <div
                  v-if="form.default_subscriptions.length === 0"
                  class="rounded border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-dark-600 dark:text-gray-400"
                >
                  {{ t("admin.settings.defaults.defaultSubscriptionsEmpty") }}
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="(item, index) in form.default_subscriptions"
                    :key="`default-sub-${index}`"
                    class="grid grid-cols-1 gap-3 rounded border border-gray-200 p-3 md:grid-cols-[1fr_160px_auto] dark:border-dark-600"
                  >
                    <div>
                      <label
                        class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                      >
                        {{ t("admin.settings.defaults.subscriptionPlan") }}
                      </label>
                      <Select
                        v-model="item.plan_id"
                        :options="defaultSubscriptionPlanOptions"
                        density="compact"
                        :placeholder="
                          t('admin.settings.defaults.subscriptionPlan')
                        "
                      >
                        <template #selected="{ option }">
                          <span
                            v-if="option"
                            class="block min-w-0 truncate font-medium text-gray-800 dark:text-gray-100"
                            :title="
                              (option as unknown as DefaultSubscriptionPlanOption)
                                .label
                            "
                          >
                            {{
                              (option as unknown as DefaultSubscriptionPlanOption)
                                .label
                            }}
                          </span>
                          <span v-else class="text-gray-400">
                            {{ t("admin.settings.defaults.subscriptionPlan") }}
                          </span>
                        </template>
                        <template #option="{ option, selected }">
                          <div class="flex min-w-0 flex-1 items-start gap-3">
                            <div class="min-w-0 flex-1">
                              <p class="truncate font-medium text-gray-900 dark:text-white">
                                {{
                                  (option as unknown as DefaultSubscriptionPlanOption)
                                    .label
                                }}
                              </p>
                              <p
                                class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400"
                                :title="
                                  (option as unknown as DefaultSubscriptionPlanOption)
                                    .groupSummary
                                "
                              >
                                {{
                                  (option as unknown as DefaultSubscriptionPlanOption)
                                    .groupSummary
                                }}
                              </p>
                            </div>
                            <Icon
                              v-if="selected"
                              name="check"
                              size="sm"
                              class="mt-0.5 flex-shrink-0 text-primary-500"
                            />
                          </div>
                        </template>
                      </Select>
                    </div>
                    <div>
                      <UiTextField
                        v-model.number="item.validity_days"
                        type="number"
                        min="1"
                        max="36500"
                        density="compact"
                        :label="t('admin.settings.defaults.subscriptionValidityDays')"
                      />
                    </div>
                    <div class="flex items-end">
                      <UiIconButton
                        type="button"
                        icon="trash"
                        variant="danger"
                        density="compact"
                        :label="t('common.delete')"
                        @click="removeDefaultSubscription(index)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!--  新增：系统全局默认平台限额矩阵 -->
              <div class="border-t border-gray-100 pt-4 dark:border-dark-700">
                <div class="mb-3">
                  <label class="font-medium text-gray-900 dark:text-white">
                    {{ t("admin.settings.defaults.defaultPlatformQuotas") }}
                  </label>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.defaults.defaultPlatformQuotasHint") }}
                  </p>
                  <p class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    {{ t("admin.settings.defaults.platformQuotaNotice") }}
                  </p>
                </div>
                <div class="overflow-x-auto">
                  <table class="min-w-full text-sm">
                    <thead>
                      <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                        <th class="pb-2 pr-4 font-medium">{{ t("admin.settings.platformQuota.platform") }}</th>
                        <th class="pb-2 pr-4 font-medium">{{ t("admin.settings.platformQuota.daily") }}</th>
                        <th class="pb-2 pr-4 font-medium">{{ t("admin.settings.platformQuota.weekly") }}</th>
                        <th class="pb-2 font-medium">{{ t("admin.settings.platformQuota.monthly") }}</th>
                      </tr>
                    </thead>
                    <tbody class="space-y-2">
                      <tr v-for="p in (['anthropic', 'openai', 'gemini', 'antigravity', 'grok'] as const)" :key="p" class="align-top">
                        <td class="pr-4 py-1">
                          <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ p }}</span>
                        </td>
                        <td class="pr-4 py-1">
                          <UiTextField
                            v-model.number="form.default_platform_quotas[p]!.daily"
                            type="number"
                            step="0.01"
                            min="0"
                            density="mini"
                            class="w-28"
                            :input-attrs="{ 'aria-label': `${p} ${t('admin.settings.platformQuota.daily')}` }"
                            :placeholder="t('admin.settings.platformQuota.placeholder')"
                          />
                        </td>
                        <td class="pr-4 py-1">
                          <UiTextField
                            v-model.number="form.default_platform_quotas[p]!.weekly"
                            type="number"
                            step="0.01"
                            min="0"
                            density="mini"
                            class="w-28"
                            :input-attrs="{ 'aria-label': `${p} ${t('admin.settings.platformQuota.weekly')}` }"
                            :placeholder="t('admin.settings.platformQuota.placeholder')"
                          />
                        </td>
                        <td class="py-1">
                          <UiTextField
                            v-model.number="form.default_platform_quotas[p]!.monthly"
                            type="number"
                            step="0.01"
                            min="0"
                            density="mini"
                            class="w-28"
                            :input-attrs="{ 'aria-label': `${p} ${t('admin.settings.platformQuota.monthly')}` }"
                            :placeholder="t('admin.settings.platformQuota.placeholder')"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <!-- /全局平台限额矩阵 -->
            </div>
          </div>

          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.authSourceDefaults.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.authSourceDefaults.description") }}
              </p>
            </div>
            <div class="space-y-6 p-6">
              <div
                class="flex items-center justify-between rounded border border-gray-200 px-4 py-3 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">
                    {{ t("admin.settings.authSourceDefaults.requireEmailLabel") }}
                  </label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.authSourceDefaults.requireEmailHint") }}
                  </p>
                </div>
                <Toggle v-model="form.force_email_on_third_party_signup" />
              </div>

              <div class="space-y-4">
                <div
                  v-for="authSource in authSourceDefaultsMeta"
                  :key="authSource.source"
                  class="rounded-xl border border-gray-200 p-4 dark:border-dark-700"
                >
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <div class="font-medium text-gray-900 dark:text-white">
                        {{ authSource.title }}
                      </div>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ authSource.description }}
                      </p>
                    </div>
                    <Toggle
                      v-model="
                        authSourceDefaults[authSource.source].grant_on_signup
                      "
                      :data-testid="`auth-source-${authSource.source}-enabled`"
                    />
                  </div>

                  <div
                    v-if="authSourceDefaults[authSource.source].grant_on_signup"
                    :data-testid="`auth-source-${authSource.source}-panel`"
                    class="mt-4 space-y-4 border-t border-gray-100 pt-4 dark:border-dark-700"
                  >
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.authSourceDefaults.enabledHint") }}
                    </p>

                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <UiTextField
                          v-model.number="
                            authSourceDefaults[authSource.source].balance
                          "
                          type="number"
                          step="0.01"
                          min="0"
                          density="compact"
                          :label="t('admin.settings.defaults.defaultBalance')"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <UiTextField
                          v-model.number="
                            authSourceDefaults[authSource.source].concurrency
                          "
                          type="number"
                          min="1"
                          density="compact"
                          :label="t('admin.settings.defaults.defaultConcurrency')"
                          placeholder="5"
                        />
                      </div>
                    </div>

                    <div
                      class="flex items-center justify-between rounded border border-gray-200 px-4 py-3 dark:border-dark-700"
                    >
                      <div>
                        <label
                          class="font-medium text-gray-900 dark:text-white"
                        >
                          {{ t("admin.settings.authSourceDefaults.grantOnFirstBindLabel") }}
                        </label>
                        <p
                          class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                        >
                          {{ t("admin.settings.authSourceDefaults.grantOnFirstBindHint") }}
                        </p>
                      </div>
                      <Toggle
                        v-model="
                          authSourceDefaults[authSource.source]
                            .grant_on_first_bind
                        "
                      />
                    </div>

                    <div class="mb-3 flex items-center justify-between">
                      <div>
                        <label
                          class="font-medium text-gray-900 dark:text-white"
                        >
                          {{ t("admin.settings.authSourceDefaults.defaultSubscriptionsLabel") }}
                        </label>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.authSourceDefaults.defaultSubscriptionsHint") }}
                        </p>
                      </div>
                      <UiButton
                        type="button"
                        variant="secondary"
                        density="compact"
                        @click="
                          addAuthSourceDefaultSubscription(authSource.source)
                        "
                        :disabled="subscriptionPlans.length === 0"
                      >
                        {{
                          t("admin.settings.defaults.addDefaultSubscription")
                        }}
                      </UiButton>
                    </div>

                    <div
                      v-if="
                        authSourceDefaults[authSource.source].subscriptions
                          .length === 0
                      "
                      class="rounded border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-dark-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.authSourceDefaults.noSourceSubscriptions") }}
                    </div>

                    <div v-else class="space-y-3">
                      <div
                        v-for="(item, index) in authSourceDefaults[
                          authSource.source
                        ].subscriptions"
                        :key="`${authSource.source}-sub-${index}`"
                        class="grid grid-cols-1 gap-3 rounded border border-gray-200 p-3 md:grid-cols-[1fr_160px_auto] dark:border-dark-600"
                      >
                        <div>
                          <label
                            class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                          >
                            {{ t("admin.settings.defaults.subscriptionPlan") }}
                          </label>
                          <Select
                            v-model="item.plan_id"
                            :options="defaultSubscriptionPlanOptions"
                            density="compact"
                            :placeholder="
                              t('admin.settings.defaults.subscriptionPlan')
                            "
                          >
                            <template #selected="{ option }">
                              <span
                                v-if="option"
                                class="block min-w-0 truncate font-medium text-gray-800 dark:text-gray-100"
                                :title="
                                  (option as unknown as DefaultSubscriptionPlanOption)
                                    .label
                                "
                              >
                                {{
                                  (option as unknown as DefaultSubscriptionPlanOption)
                                    .label
                                }}
                              </span>
                              <span v-else class="text-gray-400">
                                {{
                                  t("admin.settings.defaults.subscriptionPlan")
                                }}
                              </span>
                            </template>
                            <template #option="{ option, selected }">
                              <div class="flex min-w-0 flex-1 items-start gap-3">
                                <div class="min-w-0 flex-1">
                                  <p class="truncate font-medium text-gray-900 dark:text-white">
                                    {{
                                      (option as unknown as DefaultSubscriptionPlanOption)
                                        .label
                                    }}
                                  </p>
                                  <p
                                    class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400"
                                    :title="
                                      (option as unknown as DefaultSubscriptionPlanOption)
                                        .groupSummary
                                    "
                                  >
                                    {{
                                      (option as unknown as DefaultSubscriptionPlanOption)
                                        .groupSummary
                                    }}
                                  </p>
                                </div>
                                <Icon
                                  v-if="selected"
                                  name="check"
                                  size="sm"
                                  class="mt-0.5 flex-shrink-0 text-primary-500"
                                />
                              </div>
                            </template>
                          </Select>
                        </div>
                        <div>
                          <label
                            class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                          >
                            {{
                              t(
                                "admin.settings.defaults.subscriptionValidityDays",
                              )
                            }}
                          </label>
                          <UiTextField
                            v-model.number="item.validity_days"
                            type="number"
                            min="1"
                            max="36500"
                            density="compact"
                            :label="t('admin.settings.defaults.subscriptionValidityDays')"
                          />
                        </div>
                        <div class="flex items-end">
                          <UiButton
                            type="button"
                            variant="danger"
                            density="compact"
                            block
                            @click="
                              removeAuthSourceDefaultSubscription(
                                authSource.source,
                                index,
                              )
                            "
                          >
                            {{ t("common.delete") }}
                          </UiButton>
                        </div>
                      </div>
                    </div>

                    <!--  新增：auth source 平台限额覆盖区块 -->
                    <div class="border-t border-gray-100 pt-4 dark:border-dark-700">
                      <div class="mb-3">
                        <label class="font-medium text-gray-900 dark:text-white">
                          {{ t("admin.settings.authSourceDefaults.platformQuotasOverride") }}
                        </label>
                        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {{ t("admin.settings.authSourceDefaults.platformQuotasOverrideHint") }}
                        </p>
                      </div>
                      <div class="overflow-x-auto">
                        <table class="min-w-full text-sm">
                          <thead>
                            <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                              <th class="pb-2 pr-4 font-medium">{{ t("admin.settings.platformQuota.platform") }}</th>
                              <th class="pb-2 pr-4 font-medium">{{ t("admin.settings.platformQuota.daily") }}</th>
                              <th class="pb-2 pr-4 font-medium">{{ t("admin.settings.platformQuota.weekly") }}</th>
                              <th class="pb-2 font-medium">{{ t("admin.settings.platformQuota.monthly") }}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="p in (['anthropic', 'openai', 'gemini', 'antigravity', 'grok'] as const)" :key="`${authSource.source}-pq-${p}`" class="align-top">
                              <td class="pr-4 py-1">
                                <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ p }}</span>
                              </td>
                              <td class="pr-4 py-1">
                                <UiTextField
                                  v-model.number="authSourceDefaults[authSource.source].platform_quotas[p]!.daily"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  density="compact"
                                  class="w-28"
                                  :input-attrs="{ 'aria-label': `${p} ${t('admin.settings.platformQuota.daily')}` }"
                                  :placeholder="t('admin.settings.platformQuota.placeholder')"
                                />
                              </td>
                              <td class="pr-4 py-1">
                                <UiTextField
                                  v-model.number="authSourceDefaults[authSource.source].platform_quotas[p]!.weekly"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  density="compact"
                                  class="w-28"
                                  :input-attrs="{ 'aria-label': `${p} ${t('admin.settings.platformQuota.weekly')}` }"
                                  :placeholder="t('admin.settings.platformQuota.placeholder')"
                                />
                              </td>
                              <td class="py-1">
                                <UiTextField
                                  v-model.number="authSourceDefaults[authSource.source].platform_quotas[p]!.monthly"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  density="compact"
                                  class="w-28"
                                  :input-attrs="{ 'aria-label': `${p} ${t('admin.settings.platformQuota.monthly')}` }"
                                  :placeholder="t('admin.settings.platformQuota.placeholder')"
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <!-- /auth source 平台限额覆盖区块 -->
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- /Tab: Users -->

        <!-- Tab: Gateway — Claude Code, Scheduling -->
        <div
          id="settings-panel-gateway-details"
          v-show="activeTab === 'gateway'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-gateway"
        >
          <!-- Claude Code Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.claudeCode.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.claudeCode.description") }}
              </p>
            </div>
            <div class="p-6">
              <div>
                <UiTextField
                  v-model="form.min_claude_code_version"
                  type="text"
                  density="compact"
                  class="max-w-xs"
                  monospace
                  :label="t('admin.settings.claudeCode.minVersion')"
                  :placeholder="
                    t('admin.settings.claudeCode.minVersionPlaceholder')
                  "
                />
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t("admin.settings.claudeCode.minVersionHint") }}</p>
              </div>
              <div class="mt-4">
                <UiTextField
                  v-model="form.max_claude_code_version"
                  type="text"
                  density="compact"
                  class="max-w-xs"
                  monospace
                  :label="t('admin.settings.claudeCode.maxVersion')"
                  :placeholder="
                    t('admin.settings.claudeCode.maxVersionPlaceholder')
                  "
                />
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.claudeCode.maxVersionHint") }}
                </p>
              </div>
            </div>
          </div>

          <!-- Codex Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.gatewayForwarding.codexHardeningTitle") }}
              </h2>
            </div>
            <div class="p-6 space-y-4">
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ t("admin.settings.gatewayForwarding.codexClientRestrictionTitle") }}
                  </h3>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.gatewayForwarding.codexHardeningDesc") }}
                  </p>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {{ t("admin.settings.gatewayForwarding.minCodexVersion") }}
                    </label>
                    <UiTextField
                      v-model="form.min_codex_version"
                      type="text"
                      density="compact"
                      monospace
                      :placeholder="
                        t(
                          'admin.settings.gatewayForwarding.minCodexVersionPlaceholder',
                        )
                      "
                    />
                  </div>
                  <div>
                    <label
                      class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {{ t("admin.settings.gatewayForwarding.maxCodexVersion") }}
                    </label>
                    <UiTextField
                      v-model="form.max_codex_version"
                      type="text"
                      density="compact"
                      monospace
                      :placeholder="
                        t(
                          'admin.settings.gatewayForwarding.maxCodexVersionPlaceholder',
                        )
                      "
                    />
                  </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.gatewayForwarding.codexVersionHint") }}
                </p>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t("admin.settings.gatewayForwarding.codexFingerprintSignals") }}
                  </label>
                  <p class="mb-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.gatewayForwarding.codexFingerprintSignalsDesc") }}
                  </p>
                  <div
                    v-for="(row, i) in codexFingerprintRows"
                    :key="`codex-fp-${i}`"
                    class="mb-2 flex items-center gap-2"
                  >
                    <Select
                      v-model="row.type"
                      density="compact"
                      class="w-32"
                      aria-label="Codex fingerprint signal type"
                      :options="[
                        { value: 'header_exact', label: t('admin.settings.gatewayForwarding.codexFpTypeHeaderExact') },
                        { value: 'header_prefix', label: t('admin.settings.gatewayForwarding.codexFpTypeHeaderPrefix') },
                        { value: 'body_path', label: t('admin.settings.gatewayForwarding.codexFpTypeBodyPath') },
                      ]"
                    />
                    <UiTextField
                      v-model="row.match"
                      type="text"
                      density="compact"
                      class="flex-1"
                      monospace
                      :placeholder="t('admin.settings.gatewayForwarding.codexFpMatchPlaceholder')"
                    />
                    <UiCheckbox
                      v-model="row.required"
                      class="shrink-0"
                      :label="t('admin.settings.gatewayForwarding.codexFpRequired')"
                    />
                    <UiButton
                      type="button"
                      variant="secondary"
                      density="compact"
                      class="shrink-0"
                      @click="removeCodexFingerprintRow(i)"
                    >
                      {{ t("admin.settings.gatewayForwarding.codexRemoveRow") }}
                    </UiButton>
                  </div>
                  <UiButton type="button" variant="secondary" density="compact" @click="addCodexFingerprintRow">
                    {{ t("admin.settings.gatewayForwarding.codexAddRow") }}
                  </UiButton>
                  <p
                    v-if="codexFingerprintNoRequired"
                    class="mt-2 text-xs text-amber-600 dark:text-amber-500"
                  >
                    {{ t("admin.settings.gatewayForwarding.codexFingerprintNoRequiredWarn") }}
                  </p>
                </div>

                <div class="flex items-center justify-between">
                  <div class="pr-4">
                    <label
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      {{
                        t("admin.settings.gatewayForwarding.codexAllowAppServer")
                      }}
                    </label>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        t(
                          "admin.settings.gatewayForwarding.codexAllowAppServerDesc",
                        )
                      }}
                    </p>
                  </div>
                  <Toggle
                    v-model="form.codex_cli_only_allow_app_server_clients"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.gatewayForwarding.codexBlacklist") }}
                  </label>
                  <p class="mb-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.gatewayForwarding.codexBlacklistDesc") }}
                  </p>
                  <div
                    v-for="(row, i) in codexBlacklistRows"
                    :key="`codex-bl-${i}`"
                    class="mb-2 flex gap-2"
                  >
                    <UiTextField
                      v-model="row.originator"
                      type="text"
                      density="compact"
                      class="w-1/3"
                      monospace
                      :placeholder="
                        t(
                          'admin.settings.gatewayForwarding.codexOriginatorPlaceholder',
                        )
                      "
                    />
                    <UiTextField
                      v-model="row.uaContains"
                      type="text"
                      density="compact"
                      class="flex-1"
                      monospace
                      :placeholder="
                        t(
                          'admin.settings.gatewayForwarding.codexUaContainsPlaceholder',
                        )
                      "
                    />
                    <UiButton
                      type="button"
                      variant="secondary"
                      density="compact"
                      class="shrink-0"
                      @click="removeCodexBlacklistRow(i)"
                    >
                      {{ t("admin.settings.gatewayForwarding.codexRemoveRow") }}
                    </UiButton>
                  </div>
                  <UiButton
                    type="button"
                    variant="secondary"
                    density="compact"
                    @click="addCodexBlacklistRow"
                  >
                    {{ t("admin.settings.gatewayForwarding.codexAddRow") }}
                  </UiButton>
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.gatewayForwarding.codexWhitelist") }}
                  </label>
                  <p class="mb-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.gatewayForwarding.codexWhitelistDesc") }}
                  </p>
                  <div
                    v-for="(row, i) in codexWhitelistRows"
                    :key="`codex-wl-${i}`"
                    class="mb-2 flex gap-2"
                  >
                    <UiTextField
                      v-model="row.originator"
                      type="text"
                      density="compact"
                      class="w-1/3"
                      monospace
                      :placeholder="
                        t(
                          'admin.settings.gatewayForwarding.codexOriginatorPlaceholder',
                        )
                      "
                    />
                    <UiTextField
                      v-model="row.uaContains"
                      type="text"
                      density="compact"
                      class="flex-1"
                      monospace
                      :placeholder="
                        t(
                          'admin.settings.gatewayForwarding.codexUaContainsPlaceholder',
                        )
                      "
                    />
                    <UiCheckbox
                      :model-value="!!row.skipEngineFingerprint"
                      @update:model-value="row.skipEngineFingerprint = $event"
                      class="shrink-0"
                      :title="t('admin.settings.gatewayForwarding.codexWhitelistSkipFingerprintTooltip')"
                      :label="t('admin.settings.gatewayForwarding.codexWhitelistSkipFingerprint')"
                    />
                    <UiButton
                      type="button"
                      variant="secondary"
                      density="compact"
                      class="shrink-0"
                      @click="removeCodexWhitelistRow(i)"
                    >
                      {{ t("admin.settings.gatewayForwarding.codexRemoveRow") }}
                    </UiButton>
                  </div>
                  <UiButton
                    type="button"
                    variant="secondary"
                    density="compact"
                    @click="addCodexWhitelistRow"
                  >
                    {{ t("admin.settings.gatewayForwarding.codexAddRow") }}
                  </UiButton>
                </div>
            </div>
          </div>

          <!-- Upstream Billing Probe Settings -->
          <div class="settings-section" data-testid="upstream-billing-probe-settings">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.upstreamBillingProbe.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.upstreamBillingProbe.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div
                v-if="upstreamBillingProbeLoading"
                class="flex items-center gap-2 text-gray-500"
              >
                <UiSpinner size="sm" :label="t('common.loading')" />
                {{ t("common.loading") }}
              </div>

              <template v-else>
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">
                      {{ t("admin.settings.upstreamBillingProbe.enabled") }}
                    </label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.upstreamBillingProbe.enabledHint") }}
                    </p>
                  </div>
                  <Toggle
                    v-model="upstreamBillingProbeForm.enabled"
                    :aria-label="t('admin.settings.upstreamBillingProbe.enabled')"
                    data-testid="upstream-billing-probe-enabled"
                  />
                </div>

                <div v-if="upstreamBillingProbeForm.enabled" class="border-t border-gray-100 pt-4 dark:border-dark-700">
                  <UiTextField
                    id="upstream-billing-probe-interval"
                    v-model.number="upstreamBillingProbeForm.interval_minutes"
                    type="number"
                    min="5"
                    max="1440"
                    density="compact"
                    :label="t('admin.settings.upstreamBillingProbe.intervalMinutes')"
                    :test-id="'upstream-billing-probe-interval'"
                    prevent-enter-default
                    class="w-32"
                    @enter="saveUpstreamBillingProbeSettings"
                  />
                  <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.upstreamBillingProbe.intervalHint") }}
                  </p>
                </div>

                <div
                  class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700"
                >
                  <UiButton
                    type="button"
                    variant="primary"
                    density="compact"
                    :loading="upstreamBillingProbeSaving"
                    data-testid="upstream-billing-probe-save"
                    @click="saveUpstreamBillingProbeSettings"
                  >
                    {{ t("common.save") }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>

          <!-- Ollama Cloud Usage Settings -->
          <div class="settings-section" data-testid="ollama-cloud-usage-global-settings">
            <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.ollamaCloudUsage.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.ollamaCloudUsage.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div v-if="ollamaCloudUsageLoading" class="flex items-center gap-2 text-gray-500">
                <UiSpinner size="sm" :label="t('common.loading')" />
                {{ t("common.loading") }}
              </div>
              <template v-else>
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <label class="font-medium text-gray-900 dark:text-white">
                      {{ t("admin.settings.ollamaCloudUsage.enabled") }}
                    </label>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.ollamaCloudUsage.enabledHint") }}
                    </p>
                  </div>
                  <Toggle
                    v-model="ollamaCloudUsageForm.enabled"
                    :aria-label="t('admin.settings.ollamaCloudUsage.enabled')"
                    data-testid="ollama-cloud-usage-global-enabled"
                  />
                </div>
                <div v-if="ollamaCloudUsageForm.enabled" class="space-y-4 border-t border-gray-100 pt-4 dark:border-dark-700">
                  <UiTextField
                      id="ollama-cloud-usage-debounce"
                      v-model.number="ollamaCloudUsageForm.debounce_minutes"
                      type="number"
                      min="1"
                      max="60"
                      density="compact"
                      :label="t('admin.settings.ollamaCloudUsage.debounceMinutes')"
                      :test-id="'ollama-cloud-usage-global-debounce'"
                      prevent-enter-default
                      class="w-32"
                      @enter="saveOllamaCloudUsageSettings"
                  />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.ollamaCloudUsage.debounceHint") }}
                    </p>
                  <UiTextField
                      id="ollama-cloud-usage-interval"
                      v-model.number="ollamaCloudUsageForm.interval_minutes"
                      type="number"
                      min="15"
                      max="1440"
                      density="compact"
                      :label="t('admin.settings.ollamaCloudUsage.intervalMinutes')"
                      :test-id="'ollama-cloud-usage-global-interval'"
                      prevent-enter-default
                      class="w-32"
                      @enter="saveOllamaCloudUsageSettings"
                  />
                    <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.ollamaCloudUsage.intervalHint") }}
                    </p>
                </div>
                <div class="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700">
                  <UiButton
                    type="button"
                    variant="primary"
                    density="compact"
                    :loading="ollamaCloudUsageSaving"
                    data-testid="ollama-cloud-usage-global-save"
                    @click="saveOllamaCloudUsageSettings"
                  >
                    {{ t("common.save") }}
                  </UiButton>
                </div>
              </template>
            </div>
          </div>

          <!-- Gateway Scheduling Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.scheduling.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.scheduling.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.scheduling.allowUngroupedKey") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.scheduling.allowUngroupedKeyHint") }}
                  </p>
                </div>
                <Toggle v-model="form.allow_ungrouped_key_scheduling" />
              </div>

              <div class="border-t border-gray-100 pt-4 dark:border-dark-700">
                <div class="mb-3">
                  <label class="font-medium text-gray-900 dark:text-white">
                    {{
                      t(
                        "admin.settings.scheduling.accountSchedulingThresholdsTitle",
                      )
                    }}
                  </label>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.scheduling.accountSchedulingThresholdsDescription",
                      )
                    }}
                  </p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.scheduling.accountSchedulingThresholdsGlobalHint",
                      )
                    }}
                  </p>
                  <p class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    {{
                      t(
                        "admin.settings.scheduling.accountSchedulingThresholdsDisabledHint",
                      )
                    }}
                  </p>
                </div>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <UiTextField
                    v-for="platform in schedulingThresholdPlatforms"
                    :key="platform"
                    v-model.number="form.account_scheduling_thresholds[platform]"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    density="compact"
                    monospace
                    :label="platform"
                    :description="t('admin.settings.scheduling.accountSchedulingThresholdsRangeHint')"
                    :test-id="`account-scheduling-threshold-${platform}`"
                    placeholder="100"
                  >
                    <template #suffix>%</template>
                  </UiTextField>
                </div>
              </div>

              <div
                v-if="!form.openai_advanced_scheduler_enabled"
                class="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-dark-700"
              >
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.openaiExperimentalScheduler.lowRatePriorityTitle") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t("admin.settings.openaiExperimentalScheduler.lowRatePriorityDescription")
                    }}
                  </p>
                </div>
                <Toggle
                  v-model="form.openai_low_upstream_rate_priority_enabled"
                  data-testid="openai-low-rate-priority-toggle"
                />
              </div>

              <div
                v-if="!form.openai_advanced_scheduler_enabled && form.openai_low_upstream_rate_priority_enabled"
                class="flex flex-col items-stretch gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 dark:border-dark-700"
              >
                <div class="min-w-0">
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.openaiExperimentalScheduler.oauthRatePriorityDescription") }}
                  </p>
                </div>
                <UiTextField
                  id="openai-oauth-scheduling-rate-multiplier"
                  v-model.number="form.openai_oauth_scheduling_rate_multiplier"
                  test-id="openai-oauth-scheduling-rate-multiplier"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  density="compact"
                  class="w-full shrink-0 sm:w-32"
                  :label="t('admin.settings.openaiExperimentalScheduler.oauthRateTitle')"
                >
                  <template #suffix>x</template>
                </UiTextField>
              </div>

              <div class="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-dark-700">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.openaiExperimentalScheduler.title") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t("admin.settings.openaiExperimentalScheduler.description")
                    }}
                  </p>
                </div>
                <Toggle
                  v-model="form.openai_advanced_scheduler_enabled"
                  data-testid="openai-advanced-scheduler-toggle"
                />
              </div>

              <div
                v-if="form.openai_advanced_scheduler_enabled"
                class="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-dark-700"
              >
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.openaiExperimentalScheduler.stickyWeightedTitle") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t("admin.settings.openaiExperimentalScheduler.stickyWeightedDescription")
                    }}
                  </p>
                </div>
                <Toggle v-model="form.openai_advanced_scheduler_sticky_weighted_enabled" />
              </div>

              <div
                v-if="form.openai_advanced_scheduler_enabled"
                class="flex items-center justify-between border-t border-gray-100 pt-5 dark:border-dark-700"
              >
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.openaiExperimentalScheduler.subscriptionPriorityTitle") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t("admin.settings.openaiExperimentalScheduler.subscriptionPriorityDescription")
                    }}
                  </p>
                </div>
                <Toggle v-model="form.openai_advanced_scheduler_subscription_priority_enabled" />
              </div>

              <div
                v-if="form.openai_advanced_scheduler_enabled"
                class="flex flex-col items-stretch gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 dark:border-dark-700"
              >
                <div class="min-w-0">
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    for="openai-oauth-scheduling-rate-multiplier"
                  >
                    {{ t("admin.settings.openaiExperimentalScheduler.oauthRateTitle") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.openaiExperimentalScheduler.oauthRateWeightedDescription") }}
                  </p>
                </div>
                <div class="w-full shrink-0 sm:w-32">
                  <UiTextField
                    id="openai-oauth-scheduling-rate-multiplier"
                    test-id="openai-oauth-scheduling-rate-multiplier"
                    v-model.number="form.openai_oauth_scheduling_rate_multiplier"
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    density="compact"
                    :label="t('admin.settings.openaiExperimentalScheduler.oauthRateTitle')"
                  >
                    <template #suffix>x</template>
                  </UiTextField>
                </div>
              </div>

              <div
                v-if="form.openai_advanced_scheduler_enabled"
                class="border-t border-gray-100 pt-5 dark:border-dark-700"
              >
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.openaiExperimentalScheduler.weightsTitle") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t("admin.settings.openaiExperimentalScheduler.weightsDescription")
                    }}
                  </p>
                </div>

                <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <div
                    v-for="field in openAIAdvancedSchedulerWeightFields"
                    :key="field.key"
                    class="block"
                  >
                    <UiTextField
                      v-model="form[field.key]"
                      density="compact"
                      :label="field.label"
                      inputmode="decimal"
                      :placeholder="field.placeholder"
                      type="text"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Gateway Forwarding Behavior -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.gatewayForwarding.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.gatewayForwarding.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <div class="grid gap-5 border-b border-gray-100 pb-5 dark:border-dark-700 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                  <UiTextField
                    id="grok-default-text-model"
                    test-id="grok-default-text-model"
                    v-model.trim="form.grok_default_text_model"
                    type="text"
                    density="compact"
                    class="mt-2"
                    :label="t('admin.settings.gatewayForwarding.grokDefaultTextModel')"
                    :input-attrs="{ list: 'grok-default-text-model-options' }"
                    placeholder="grok-4.5"
                  />
                  <datalist id="grok-default-text-model-options">
                    <option value="grok-4.5" />
                    <option value="grok-4.1-fast" />
                    <option value="grok-4" />
                  </datalist>
                  <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.gatewayForwarding.grokDefaultTextModelHint") }}
                  </p>
                </div>
                <div class="flex items-center justify-between gap-5 md:min-w-72">
                  <div>
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ t("admin.settings.gatewayForwarding.grokCrossClientMap") }}
                    </label>
                    <p class="mt-0.5 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                      {{ t("admin.settings.gatewayForwarding.grokCrossClientMapHint") }}
                    </p>
                  </div>
                  <Toggle
                    v-model="form.grok_cross_client_model_map_enabled"
                    data-testid="grok-cross-client-model-map-toggle"
                  />
                </div>
                </div>
                <div class="md:col-span-2">
                  <Select
                    id="grok-default-base-url-mode"
                    v-model="form.grok_default_base_url_mode"
                    data-testid="grok-default-base-url-mode"
                    density="compact"
                    :label="t('admin.settings.gatewayForwarding.grokDefaultBaseURLMode')"
                    :options="[
                      { value: 'cli', label: t('admin.settings.gatewayForwarding.grokBaseURLModeCLI') },
                      { value: 'api', label: t('admin.settings.gatewayForwarding.grokBaseURLModeAPI') },
                      { value: 'us-east-1', label: t('admin.settings.gatewayForwarding.grokBaseURLModeUSEast1') },
                      { value: 'us-west-2', label: t('admin.settings.gatewayForwarding.grokBaseURLModeUSWest2') },
                      { value: 'eu-west-1', label: t('admin.settings.gatewayForwarding.grokBaseURLModeEUWest1') },
                    ]"
                  >
                  </Select>
                  <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.gatewayForwarding.grokDefaultBaseURLModeHint") }}
                  </p>
                </div>

              <!-- Fingerprint Unification -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t(
                        "admin.settings.gatewayForwarding.fingerprintUnification",
                      )
                    }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.gatewayForwarding.fingerprintUnificationHint",
                      )
                    }}
                  </p>
                </div>
                <Toggle v-model="form.enable_fingerprint_unification" />
              </div>

              <!-- Metadata Passthrough -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t("admin.settings.gatewayForwarding.metadataPassthrough")
                    }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.gatewayForwarding.metadataPassthroughHint",
                      )
                    }}
                  </p>
                </div>
                <Toggle v-model="form.enable_metadata_passthrough" />
              </div>

              <!-- CCH Signing -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.gatewayForwarding.cchSigning") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.gatewayForwarding.cchSigningHint") }}
                  </p>
                </div>
                <Toggle v-model="form.enable_cch_signing" />
              </div>

              <!-- Claude OAuth System Prompt Injection -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t(
                        "admin.settings.gatewayForwarding.claudeOAuthSystemPromptInjection",
                      )
                    }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.gatewayForwarding.claudeOAuthSystemPromptInjectionHint",
                      )
                    }}
                  </p>
                </div>
                <Toggle
                  v-model="form.enable_claude_oauth_system_prompt_injection"
                />
              </div>

              <div>
                <label
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{
                    t(
                      "admin.settings.gatewayForwarding.claudeOAuthSystemPromptBlocks",
                    )
                  }}
                </label>
                <div class="space-y-3">
                  <div
                    v-for="(block, index) in claudeOAuthSystemPromptBlocks"
                    :key="block.id"
                    class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-dark-700 dark:bg-dark-800/60"
                  >
                    <div
                      :class="[
                        'flex flex-wrap items-center justify-between gap-3',
                        block.expanded && 'mb-3',
                      ]"
                    >
                      <div class="min-w-0">
                        <div
                          class="text-sm font-medium text-gray-900 dark:text-white"
                        >
                          {{
                            t(
                              "admin.settings.gatewayForwarding.systemBlockTitle",
                              { index: index + 1 },
                            )
                          }}
                        </div>
                        <div
                          class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                        >
                          {{ getClaudeOAuthPresetLabel(block.preset) }}
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <UiIconButton
                          type="button"
                          variant="ghost"
                          density="compact"
                          :icon="block.expanded ? 'eyeOff' : 'eye'"
                          :label="
                            block.expanded
                              ? t('admin.settings.gatewayForwarding.systemBlockHide')
                              : t('admin.settings.gatewayForwarding.systemBlockShow')
                          "
                          :title="
                            block.expanded
                              ? t(
                                  'admin.settings.gatewayForwarding.systemBlockHide',
                                )
                              : t(
                                  'admin.settings.gatewayForwarding.systemBlockShow',
                                )
                          "
                          @click="toggleClaudeOAuthSystemPromptBlock(index)"
                        />
                        <UiIconButton
                          type="button"
                          variant="ghost"
                          density="compact"
                          icon="arrowUp"
                          :label="localText('上移 block', 'Move block up')"
                          :disabled="index === 0"
                          @click="moveClaudeOAuthSystemPromptBlock(index, -1)"
                        />
                        <UiIconButton
                          type="button"
                          variant="ghost"
                          density="compact"
                          icon="arrowDown"
                          :label="localText('下移 block', 'Move block down')"
                          :disabled="
                            index === claudeOAuthSystemPromptBlocks.length - 1
                          "
                          @click="moveClaudeOAuthSystemPromptBlock(index, 1)"
                        />
                        <Toggle v-model="block.enabled" />
                        <UiIconButton
                          type="button"
                          variant="danger"
                          density="compact"
                          icon="trash"
                          :label="t('common.delete')"
                          @click="removeClaudeOAuthSystemPromptBlock(index)"
                        />
                      </div>
                    </div>

                    <div v-show="block.expanded">
                      <div class="grid gap-3 md:grid-cols-2">
                        <div>
                          <label
                            class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
                          >
                            {{
                              t(
                                "admin.settings.gatewayForwarding.systemBlockPreset",
                              )
                            }}
                          </label>
                          <Select
                            v-model="block.preset"
                            :options="claudeOAuthSystemPromptPresetOptions"
                            density="compact"
                            @change="
                              (value) =>
                                applyClaudeOAuthSystemPromptPreset(index, value)
                            "
                          />
                        </div>
                        <div>
                          <label
                            class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300"
                          >
                            {{
                              t(
                                "admin.settings.gatewayForwarding.systemBlockType",
                              )
                            }}
                          </label>
                          <Select
                            v-model="block.type"
                            :options="claudeOAuthSystemPromptBlockTypeOptions"
                            density="compact"
                          />
                        </div>
                      </div>

                      <div class="mt-3">
                        <UiTextArea
                          v-model="block.text"
                          :rows="6"
                          monospace
                          :label="t('admin.settings.gatewayForwarding.systemBlockText')"
                          @input="markClaudeOAuthSystemPromptBlockCustom(block)"
                        />
                      </div>

                      <div
                        class="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]"
                      >
                        <div class="flex items-center justify-between gap-4">
                          <div>
                            <label
                              class="text-xs font-medium text-gray-600 dark:text-gray-300"
                            >
                              {{
                                t(
                                  "admin.settings.gatewayForwarding.systemBlockCacheControl",
                                )
                              }}
                            </label>
                          </div>
                          <Toggle v-model="block.cacheControlEnabled" />
                        </div>
                        <div v-if="block.cacheControlEnabled">
                          <Select
                            v-model="block.cacheControlTTL"
                            :options="claudeOAuthSystemPromptCacheTTLOptions"
                            density="compact"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <UiButton
                    type="button"
                    variant="secondary"
                    density="compact"
                    @click="addClaudeOAuthSystemPromptBlock"
                  >
                    <template #icon><Icon name="plus" size="xs" /></template>
                    {{ t("admin.settings.gatewayForwarding.addSystemBlock") }}
                  </UiButton>
                  <UiButton
                    type="button"
                    variant="secondary"
                    density="compact"
                    @click="resetClaudeOAuthSystemPromptBlocks"
                  >
                    <template #icon><Icon name="refresh" size="xs" /></template>
                    {{
                      t("admin.settings.gatewayForwarding.resetSystemBlocks")
                    }}
                  </UiButton>
                </div>
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    t(
                      "admin.settings.gatewayForwarding.claudeOAuthSystemPromptBlocksHint",
                    )
                  }}
                </p>
              </div>

              <!-- Anthropic Cache TTL 1h Injection -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t(
                        "admin.settings.gatewayForwarding.anthropicCacheTTL1hInjection",
                      )
                    }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.gatewayForwarding.anthropicCacheTTL1hInjectionHint",
                      )
                    }}
                  </p>
                </div>
                <Toggle
                  v-model="form.enable_anthropic_cache_ttl_1h_injection"
                />
              </div>

              <!-- messages cache_control 改写 -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t(
                        "admin.settings.gatewayForwarding.rewriteMessageCacheControl",
                      )
                    }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.gatewayForwarding.rewriteMessageCacheControlHint",
                      )
                    }}
                  </p>
                </div>
                <Toggle v-model="form.rewrite_message_cache_control" />
              </div>

              <!-- 客户端 dateline 归一化（仅 Anthropic OAuth/SetupToken） -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t(
                        "admin.settings.gatewayForwarding.clientDatelineNormalization",
                      )
                    }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.gatewayForwarding.clientDatelineNormalizationHint",
                      )
                    }}
                  </p>
                </div>
                <Toggle
                  v-model="form.enable_client_dateline_normalization"
                />
              </div>

              <!-- Antigravity UA 版本 -->
              <div>
                <label
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{
                    t(
                      "admin.settings.gatewayForwarding.antigravityUserAgentVersion",
                    )
                  }}
                </label>
                <UiTextField
                  v-model="form.antigravity_user_agent_version"
                  type="text"
                  density="compact"
                  monospace
                  class="max-w-xs"
                  :placeholder="
                    t(
                      'admin.settings.gatewayForwarding.antigravityUserAgentVersionPlaceholder',
                    )
                  "
                />
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    t(
                      "admin.settings.gatewayForwarding.antigravityUserAgentVersionHint",
                    )
                  }}
                </p>
              </div>

              <!-- OpenAI Codex UA -->
              <div>
                <label
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{
                    t(
                      "admin.settings.gatewayForwarding.openaiCodexUserAgent",
                    )
                  }}
                </label>
                <UiTextField
                  v-model="form.openai_codex_user_agent"
                  type="text"
                  density="compact"
                  monospace
                  :placeholder="
                    t(
                      'admin.settings.gatewayForwarding.openaiCodexUserAgentPlaceholder',
                    )
                  "
                />
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    t(
                      "admin.settings.gatewayForwarding.openaiCodexUserAgentHint",
                    )
                  }}
                </p>
              </div>

              <!-- Codex 客户端版本号 -->
              <div>
                <label
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{
                    t(
                      "admin.settings.gatewayForwarding.openaiCodexClientVersion",
                    )
                  }}
                </label>
                <UiTextField
                  v-model="form.openai_codex_client_version"
                  type="text"
                  density="compact"
                  monospace
                  :placeholder="
                    t(
                      'admin.settings.gatewayForwarding.openaiCodexClientVersionPlaceholder',
                    )
                  "
                />
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    t(
                      "admin.settings.gatewayForwarding.openaiCodexClientVersionHint",
                    )
                  }}
                </p>
              </div>

              <!-- Codex 版本号自动同步 -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t(
                        "admin.settings.gatewayForwarding.openaiCodexVersionAutoSync",
                      )
                    }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      t(
                        "admin.settings.gatewayForwarding.openaiCodexVersionAutoSyncHint",
                      )
                    }}
                  </p>
                  <p
                    v-if="codexSyncedVersionLabel"
                    class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ codexSyncedVersionLabel }}
                  </p>
                </div>
                <Toggle v-model="form.openai_codex_version_auto_sync_enabled" />
              </div>

            </div>
          </div>

          <!-- Web Search Emulation -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.webSearchEmulation.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.webSearchEmulation.description") }}
              </p>
            </div>
            <div class="space-y-5 p-6">
              <!-- Global Toggle -->
              <div class="flex items-center justify-between">
                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.webSearchEmulation.enabled") }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.webSearchEmulation.enabledHint") }}
                  </p>
                </div>
                <Toggle v-model="webSearchConfig.enabled" />
              </div>

              <!-- Providers -->
              <div v-if="webSearchConfig.enabled" class="space-y-4">
                <div class="flex items-center justify-between">
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.webSearchEmulation.providers") }}
                  </label>
                  <UiButton
                    type="button"
                    variant="secondary"
                    density="compact"
                    @click="addWebSearchProvider"
                  >
                    {{ t("admin.settings.webSearchEmulation.addProvider") }}
                  </UiButton>
                </div>

                <div
                  v-if="webSearchConfig.providers.length === 0"
                  class="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400 dark:border-dark-600"
                >
                  {{ t("admin.settings.webSearchEmulation.noProviders") }}
                </div>

                <div
                  v-for="(provider, pIdx) in webSearchConfig.providers"
                  :key="pIdx"
                  class="rounded-lg border border-gray-200 dark:border-dark-600"
                >
                  <!-- Collapsible header -->
                  <div class="flex items-center justify-between px-4 py-3">
                    <div class="flex items-center gap-3">
                      <UiIconButton
                        type="button"
                        variant="ghost"
                        density="mini"
                        :aria-expanded="expandedProviders[pIdx]"
                        :aria-controls="`web-search-provider-panel-${pIdx}`"
                        :label="`${provider.type} ${t('admin.settings.webSearchEmulation.providers')}`"
                        @click="toggleProviderExpand(pIdx)"
                      >
                        <Icon
                          name="chevronRight"
                          size="sm"
                          class="text-gray-400 motion-safe:transition-transform"
                          :class="{ 'rotate-90': expandedProviders[pIdx] }"
                        />
                      </UiIconButton>
                      <Select
                        v-model="provider.type"
                        :options="[
                          { value: 'brave', label: 'Brave Search' },
                          { value: 'tavily', label: 'Tavily' },
                        ]"
                        class="w-36"
                        @click.stop
                      />
                      <!-- Quota summary (always visible) -->
                      <span class="text-xs text-gray-400">
                        {{ provider.quota_used ?? 0 }} /
                        {{
                          provider.quota_limit != null &&
                          provider.quota_limit > 0
                            ? provider.quota_limit
                            : "∞"
                        }}
                      </span>
                      <span
                        v-if="
                          !expandedProviders[pIdx] &&
                          provider.api_key_configured
                        "
                        class="text-xs text-green-500"
                      >
                        {{
                          t(
                            "admin.settings.webSearchEmulation.apiKeyConfigured",
                          )
                        }}
                      </span>
                    </div>
                    <UiButton
                      type="button"
                      variant="danger"
                      density="compact"
                      @click="removeWebSearchProvider(pIdx)"
                    >
                      {{
                        t("admin.settings.webSearchEmulation.removeProvider")
                      }}
                    </UiButton>
                  </div>

                  <!-- Expanded content -->
                  <div
                    v-show="expandedProviders[pIdx]"
                    :id="`web-search-provider-panel-${pIdx}`"
                    class="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3 dark:border-dark-700"
                  >
                    <!-- API Key with inline show/copy -->
                    <UiTextField
                      v-model="provider.api_key"
                      :type="apiKeyVisible[pIdx] ? 'text' : 'password'"
                      density="compact"
                      :label="t('admin.settings.webSearchEmulation.apiKey')"
                      :placeholder="
                        provider.api_key_configured
                          ? '••••••••'
                          : t('admin.settings.webSearchEmulation.apiKeyPlaceholder')
                      "
                    >
                      <template v-if="provider.api_key || provider.api_key_configured" #suffix>
                        <span class="flex items-center gap-1">
                          <UiIconButton
                            type="button"
                            variant="ghost"
                            density="mini"
                            :icon="apiKeyVisible[pIdx] ? 'eyeOff' : 'eye'"
                            :label="
                              apiKeyVisible[pIdx]
                                ? t('admin.settings.webSearchEmulation.hideApiKey')
                                : t('admin.settings.webSearchEmulation.showApiKey')
                            "
                            @click="apiKeyVisible[pIdx] = !apiKeyVisible[pIdx]"
                          />
                          <UiIconButton
                            type="button"
                            variant="ghost"
                            density="mini"
                            icon="copy"
                            :label="t('admin.settings.webSearchEmulation.copyApiKey')"
                            :disabled="!provider.api_key"
                            @click="copyApiKey(pIdx)"
                          />
                        </span>
                      </template>
                    </UiTextField>

                    <!-- Quota + Subscription in compact row -->
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <UiTextField
                          v-model="provider.quota_limit"
                          type="number"
                          min="1"
                          density="compact"
                          :label="t('admin.settings.webSearchEmulation.quotaLimit')"
                          :placeholder="'∞'"
                        />
                        <p class="mt-0.5 text-xs text-gray-400">
                          {{
                            t(
                              "admin.settings.webSearchEmulation.quotaLimitHint",
                            )
                          }}
                        </p>
                      </div>
                      <div>
                        <UiTextField
                          :model-value="formatSubscribedAt(provider.subscribed_at)"
                          type="date"
                          density="compact"
                          :label="t('admin.settings.webSearchEmulation.subscribedAt')"
                          :description="t('admin.settings.webSearchEmulation.subscribedAtHint')"
                          @update:model-value="provider.subscribed_at = parseSubscribedAt(String($event))"
                        />
                      </div>
                    </div>

                    <!-- Usage display -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500"
                        >{{
                          t("admin.settings.webSearchEmulation.quotaUsage")
                        }}:</span
                      >
                      <UiProgressBar
                        v-if="
                          provider.quota_limit != null &&
                          provider.quota_limit > 0
                        "
                        class="flex-1"
                        :value="Math.min(quotaPercentage(provider), 100)"
                        :show-value="false"
                        :tone="quotaPercentage(provider) > 90 ? 'danger' : quotaPercentage(provider) > 70 ? 'warning' : 'success'"
                        :aria-label="t('admin.settings.webSearchEmulation.quotaUsage')"
                      />
                      <div v-else class="flex-1" />
                      <span class="text-xs text-gray-500"
                        >{{ provider.quota_used ?? 0 }} /
                        {{
                          provider.quota_limit != null &&
                          provider.quota_limit > 0
                            ? provider.quota_limit
                            : "∞"
                        }}</span
                      >
                      <UiButton
                        v-if="(provider.quota_used ?? 0) > 0"
                        type="button"
                        variant="quiet"
                        density="mini"
                        @click="resetWebSearchUsage(pIdx)"
                      >
                        {{ t("admin.settings.webSearchEmulation.resetUsage") }}
                      </UiButton>
                    </div>

                    <!-- Proxy + Test on same row -->
                    <div class="flex items-end gap-3">
                      <div class="flex-1">
                        <label class="text-xs text-gray-500">{{
                          t("admin.settings.webSearchEmulation.proxy")
                        }}</label>
                        <ProxySelector
                          v-model="provider.proxy_id"
                          :proxies="webSearchProxies"
                        />
                      </div>
                      <UiButton
                        type="button"
                        variant="secondary"
                        density="compact"
                        @click="openTestDialog()"
                      >
                        {{ t("admin.settings.webSearchEmulation.test") }}
                      </UiButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Web Search Test Dialog -->
          <UiDialog
            :show="wsTestDialogOpen"
            :title="t('admin.settings.webSearchEmulation.testResultTitle')"
            width="normal"
            :close-on-click-outside="true"
            @close="wsTestDialogOpen = false"
          >
              <div class="flex items-center gap-2">
                <UiTextField
                  v-model="wsTestQuery"
                  type="text"
                  density="compact"
                  class="flex-1"
                  :label="t('admin.settings.webSearchEmulation.testDefaultQuery')"
                  :placeholder="
                    t('admin.settings.webSearchEmulation.testDefaultQuery')
                  "
                  prevent-enter-default
                  @enter="testWebSearchProvider()"
                />
                <UiButton
                  type="button"
                  variant="primary"
                  density="compact"
                  :loading="wsTestLoading"
                  :disabled="wsTestLoading"
                  @click="testWebSearchProvider()"
                >
                  {{
                    wsTestLoading
                      ? t("admin.settings.webSearchEmulation.testing")
                      : t("admin.settings.webSearchEmulation.test")
                  }}
                </UiButton>
              </div>
              <!-- Test results -->
              <div
                v-if="wsTestResult"
                class="mt-4 max-h-80 overflow-y-auto rounded-lg bg-gray-50 p-4 dark:bg-dark-700"
              >
                <p
                  class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{
                    t("admin.settings.webSearchEmulation.testResultProvider")
                  }}: {{ wsTestResult.provider }}
                </p>
                <div
                  v-if="wsTestResult.results.length === 0"
                  class="text-sm text-gray-400"
                >
                  {{ t("admin.settings.webSearchEmulation.testNoResults") }}
                </div>
                <div
                  v-for="(r, rIdx) in wsTestResult.results"
                  :key="rIdx"
                  class="mt-2 border-t border-gray-200 pt-2 first:mt-0 first:border-0 first:pt-0 dark:border-dark-600"
                >
                  <a
                    :href="r.url"
                    target="_blank"
                    class="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >{{ r.title }}</a
                  >
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ r.snippet }}
                  </p>
                </div>
              </div>
              <template #footer>
                <UiButton
                  type="button"
                  variant="secondary"
                  density="compact"
                  @click="wsTestDialogOpen = false"
                >
                  {{ t("common.close") }}
                </UiButton>
              </template>
          </UiDialog>

        <!-- Usage Records Settings -->
        <div class="settings-section">
          <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.settings.usageRecords.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.settings.usageRecords.description') }}
            </p>
          </div>
          <div class="space-y-4 p-6">
            <!-- User error requests visibility -->
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.user_error_view.label') }}
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.user_error_view.description') }}
                </p>
              </div>
              <Toggle
                v-model="form.allow_user_view_error_requests"
                :aria-label="t('admin.settings.user_error_view.label')"
              />
            </div>
          </div>
        </div>
        </div>
        <!-- /Tab: Gateway — Claude Code, Scheduling -->

        <!-- Tab: General -->
        <div
          id="settings-panel-general"
          v-show="activeTab === 'general'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-general"
        >
          <!-- Site Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.site.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.site.description") }}
              </p>
            </div>
            <div class="space-y-6 p-6">
              <!-- Backend Mode -->
              <div
                class="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <div>
                  <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ t("admin.settings.site.backendMode") }}
                  </h3>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.site.backendModeDescription") }}
                  </p>
	                </div>
	                <Toggle v-model="form.backend_mode_enabled" />
	              </div>

	              <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <UiTextField
                    v-model="form.site_name"
                    type="text"
                    density="compact"
                    :label="t('admin.settings.site.siteName')"
                    :description="t('admin.settings.site.siteNameHint')"
                    :placeholder="t('admin.settings.site.siteNamePlaceholder')"
                  />
                <UiTextField
                    v-model="form.site_subtitle"
                    type="text"
                    density="compact"
                    :label="t('admin.settings.site.siteSubtitle')"
                    :description="t('admin.settings.site.siteSubtitleHint')"
                    :placeholder="
                      t('admin.settings.site.siteSubtitlePlaceholder')
                    "
                  />
              </div>

              <!-- API Base URL -->
              <UiTextField
                  v-model="form.api_base_url"
                  type="text"
                  density="compact"
                  monospace
                  :label="t('admin.settings.site.apiBaseUrl')"
                  :description="t('admin.settings.site.apiBaseUrlHint')"
                  :placeholder="t('admin.settings.site.apiBaseUrlPlaceholder')"
                />

              <!-- Global Table Preferences -->
              <div class="border-t border-gray-100 pt-4 dark:border-dark-700">
                <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ t("admin.settings.site.tablePreferencesTitle") }}
                </h3>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.site.tablePreferencesDescription") }}
                </p>
                <div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <UiTextField
                      v-model.number="form.table_default_page_size"
                      type="number"
                      min="5"
                      max="1000"
                      step="1"
                      density="compact"
                      :label="t('admin.settings.site.tableDefaultPageSize')"
                      :description="t('admin.settings.site.tableDefaultPageSizeHint')"
                    />
                  <UiTextField
                      v-model="tablePageSizeOptionsInput"
                      type="text"
                      density="compact"
                      monospace
                      :label="t('admin.settings.site.tablePageSizeOptions')"
                      :description="t('admin.settings.site.tablePageSizeOptionsHint')"
                      :placeholder="
                        t('admin.settings.site.tablePageSizeOptionsPlaceholder')
                      "
                    />
                </div>
              </div>

              <!-- Custom Endpoints -->
              <div>
                <label
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ t("admin.settings.site.customEndpoints.title") }}
                </label>
                <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.site.customEndpoints.description") }}
                </p>

                <div class="space-y-3">
                  <div
                    v-for="(ep, index) in form.custom_endpoints"
                    :key="index"
                    class="rounded-lg border border-gray-200 p-4 dark:border-dark-600"
                  >
                    <div class="mb-3 flex items-center justify-between">
                      <span
                        class="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {{
                          t("admin.settings.site.customEndpoints.itemLabel", {
                            n: index + 1,
                          })
                        }}
                      </span>
                      <UiIconButton
                        type="button"
                        variant="danger"
                        density="mini"
                        icon="trash"
                        :label="t('common.delete')"
                        @click="removeEndpoint(index)"
                      />
                    </div>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <UiTextField
                          v-model="ep.name"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.site.customEndpoints.name')"
                          :placeholder="
                            t(
                              'admin.settings.site.customEndpoints.namePlaceholder',
                            )
                          "
                        />
                      <UiTextField
                          v-model="ep.endpoint"
                          type="url"
                          density="compact"
                          monospace
                          :label="t('admin.settings.site.customEndpoints.endpointUrl')"
                          :placeholder="
                            t(
                              'admin.settings.site.customEndpoints.endpointUrlPlaceholder',
                            )
                          "
                        />
                      <UiTextField
                          class="sm:col-span-2"
                          v-model="ep.description"
                          type="text"
                          density="compact"
                          :label="t('admin.settings.site.customEndpoints.descriptionLabel')"
                          :placeholder="
                            t(
                              'admin.settings.site.customEndpoints.descriptionPlaceholder',
                            )
                          "
                        />
                    </div>
                  </div>
                </div>

                <UiButton
                  type="button"
                  variant="quiet"
                  density="compact"
                  block
                  class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-dark-600 dark:text-gray-400 dark:hover:border-primary-500 dark:hover:text-primary-400"
                  @click="addEndpoint"
                >
                  <Icon name="plus" size="sm" />
                  {{ t("admin.settings.site.customEndpoints.add") }}
                </UiButton>
              </div>

              <!-- Contact Info -->
              <div>
                <UiTextField
                  v-model="form.contact_info"
                  type="text"
                  density="compact"
                  :label="t('admin.settings.site.contactInfo')"
                  :placeholder="t('admin.settings.site.contactInfoPlaceholder')"
                  :description="t('admin.settings.site.contactInfoHint')"
                />
              </div>

              <!-- Doc URL -->
              <div>
                <UiTextField
                  v-model="form.doc_url"
                  type="url"
                  density="compact"
                  monospace
                  :label="t('admin.settings.site.docUrl')"
                  :placeholder="t('admin.settings.site.docUrlPlaceholder')"
                  :description="t('admin.settings.site.docUrlHint')"
                />
              </div>

              <!-- Brand Assets -->
              <div class="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
                <div>
                <label
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {{ t("admin.settings.site.siteLogo") }}
                </label>
                <ImageUpload
                  v-model="form.site_logo"
                  mode="image"
                  aspect="wide"
                  :upload-label="t('admin.settings.site.uploadImage')"
                  :remove-label="t('admin.settings.site.remove')"
                  :hint="t('admin.settings.site.logoHint')"
                  :max-size="500 * 1024"
                />
                </div>
                <div>
                  <label
                    class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.site.siteIcon") }}
                  </label>
                  <ImageUpload
                    v-model="form.site_icon"
                    mode="image"
                    aspect="square"
                    :upload-label="t('admin.settings.site.uploadIcon')"
                    :remove-label="t('admin.settings.site.remove')"
                    :hint="t('admin.settings.site.iconHint')"
                    :max-size="300 * 1024"
                  />
                </div>
              </div>

              <!-- Home Content -->
              <div>
                <UiTextArea
                  v-model="form.home_content"
                  :rows="6"
                  monospace
                  :label="t('admin.settings.site.homeContent')"
                  :placeholder="t('admin.settings.site.homeContentPlaceholder')"
                  :description="t('admin.settings.site.homeContentHint')"
                />
                <!-- iframe CSP Warning -->
                <p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {{ t("admin.settings.site.homeContentIframeWarning") }}
                </p>
              </div>

              <!-- Compact Home Page -->
              <div class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.site.compactHome")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.site.compactHomeHint") }}
                  </p>
                </div>
                <Toggle v-model="form.compact_home_enabled" data-testid="compact-home-toggle" />
              </div>

              <!-- Hide CCS Import Button -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.site.hideCcsImportButton")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.site.hideCcsImportButtonHint") }}
                  </p>
                </div>
                <Toggle v-model="form.hide_ccs_import_button" />
              </div>
            </div>
          </div>

          <!-- Custom Menu Items -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.customMenu.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.customMenu.description") }}
              </p>
            </div>
            <div class="space-y-4 p-6">
              <!-- Existing menu items -->
              <div
                v-for="(item, index) in form.custom_menu_items"
                :key="item.id || index"
                class="rounded-lg border border-gray-200 p-4 dark:border-dark-600"
              >
                <div class="mb-3 flex items-center justify-between">
                  <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{
                      t("admin.settings.customMenu.itemLabel", { n: index + 1 })
                    }}
                  </span>
                  <div class="flex items-center gap-2">
                    <!-- Move up -->
                    <UiIconButton
                      v-if="index > 0"
                      type="button"
                      variant="ghost"
                      density="mini"
                      icon="arrowUp"
                      :label="t('admin.settings.customMenu.moveUp')"
                      :title="t('admin.settings.customMenu.moveUp')"
                      @click="moveMenuItem(index, -1)"
                    />
                    <!-- Move down -->
                    <UiIconButton
                      v-if="index < form.custom_menu_items.length - 1"
                      type="button"
                      variant="ghost"
                      density="mini"
                      icon="arrowDown"
                      :label="t('admin.settings.customMenu.moveDown')"
                      :title="t('admin.settings.customMenu.moveDown')"
                      @click="moveMenuItem(index, 1)"
                    />
                    <!-- Delete -->
                    <UiIconButton
                      type="button"
                      variant="danger"
                      density="mini"
                      icon="trash"
                      :label="t('admin.settings.customMenu.remove')"
                      :title="t('admin.settings.customMenu.remove')"
                      @click="removeMenuItem(index)"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <!-- Label -->
                  <UiTextField
                      v-model="item.label"
                      type="text"
                      density="compact"
                      :label="t('admin.settings.customMenu.name')"
                      :placeholder="
                        t('admin.settings.customMenu.namePlaceholder')
                      "
                    />

                  <!-- Visibility -->
                  <Select
                    v-model="item.visibility"
                    :label="t('admin.settings.customMenu.visibility')"
                    :options="[
                      { value: 'user', label: t('admin.settings.customMenu.visibilityUser') },
                      { value: 'admin', label: t('admin.settings.customMenu.visibilityAdmin') },
                    ]"
                  />

                  <!-- URL (full width) -->
                  <UiTextField
                      class="sm:col-span-2"
                      v-model="item.url"
                      type="url"
                      density="compact"
                      monospace
                      :label="t('admin.settings.customMenu.url')"
                      :placeholder="
                        t('admin.settings.customMenu.urlPlaceholder')
                      "
                    />

                  <!-- SVG Icon (full width) -->
                  <div class="sm:col-span-2">
                    <label
                      class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
                    >
                      {{ t("admin.settings.customMenu.iconSvg") }}
                    </label>
                    <ImageUpload
                      :model-value="item.icon_svg"
                      mode="svg"
                      size="sm"
                      :upload-label="t('admin.settings.customMenu.uploadSvg')"
                      :remove-label="t('admin.settings.customMenu.removeSvg')"
                      @update:model-value="(v: string) => (item.icon_svg = v)"
                    />
                  </div>
                </div>
              </div>

              <!-- Add button -->
              <UiButton
                type="button"
                variant="quiet"
                density="compact"
                block
                class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-600 dark:border-dark-600 dark:text-gray-400 dark:hover:border-primary-500 dark:hover:text-primary-400"
                @click="addMenuItem"
              >
                <Icon name="plus" size="sm" />
                {{ t("admin.settings.customMenu.add") }}
              </UiButton>
            </div>
          </div>
	        </div>
	        <!-- /Tab: General -->

	        <!-- Tab: Login Agreement -->
        <div
          id="settings-panel-agreement"
          v-show="activeTab === 'agreement'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-agreement"
        >
	          <div class="settings-section">
	            <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
	              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
	                <div>
	                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
	                    {{ localText("登录条款确认", "Login agreement") }}
	                  </h2>
	                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
	                    {{
	                      localText(
	                        "控制登录页是否要求用户先阅读并同意服务条款、隐私政策或其他 Markdown 文档。",
	                        "Control whether the login page requires users to accept Markdown policy documents first.",
	                      )
	                    }}
	                  </p>
	                </div>
	                <div class="flex items-center gap-3">
	                  <span class="text-sm text-gray-600 dark:text-gray-300">
	                    {{ form.login_agreement_enabled ? localText("已启用", "Enabled") : localText("未启用", "Disabled") }}
	                  </span>
	                  <Toggle v-model="form.login_agreement_enabled" />
	                </div>
	              </div>
	            </div>

	            <div class="space-y-6 p-6">
	              <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
	                <div>
	                  <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
	                    {{ localText("展示形式", "Display mode") }}
	                  </label>
	                  <div class="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-dark-700">
                    <UiButton
                      type="button"
                      :aria-pressed="form.login_agreement_mode === 'modal'"
                      :variant="form.login_agreement_mode === 'modal' ? 'primary' : 'secondary'"
                      density="compact"
                      @click="form.login_agreement_mode = 'modal'"
                    >
                      <template #icon><Icon name="shield" size="sm" /></template>
                      {{ localText("弹窗", "Modal") }}
                    </UiButton>
                    <UiButton
                      type="button"
                      :aria-pressed="form.login_agreement_mode === 'checkbox'"
                      :variant="form.login_agreement_mode === 'checkbox' ? 'primary' : 'secondary'"
                      density="compact"
                      @click="form.login_agreement_mode = 'checkbox'"
                    >
                      <template #icon><Icon name="checkCircle" size="sm" /></template>
                      {{ localText("复选框", "Checkbox") }}
                    </UiButton>
                  </div>
                  <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      form.login_agreement_mode === "checkbox"
                        ? localText("复选框会显示在登录按钮下方，未勾选前所有登录入口禁用。", "The checkbox appears below the login button and gates all login actions.")
                        : localText("弹窗会在登录页打开，用户拒绝后所有登录入口保持禁用。", "The modal opens on the login page and gates all login actions until accepted.")
                    }}
                  </p>
                </div>

                <div>
                  <UiTextField
                    v-model="form.login_agreement_updated_at"
                    type="date"
                    density="compact"
                    :label="localText('条款更新日期', 'Updated date')"
                    :description="localText('日期或文档内容变化后，用户需要重新同意。', 'Changing the date or content requires fresh consent.')"
                  />
                </div>
              </div>

              <div>
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ localText("协议文档", "Agreement documents") }}
                    </h3>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{
                        localText(
                          "文档名称可自定义，内容按 Markdown 保存。可参考：服务条款、使用政策、支持的国家和地区、服务特定条款。",
                          "Document titles are customizable and content is saved as Markdown.",
                        )
                      }}
                    </p>
                  </div>
                  <UiButton
                    type="button"
                    variant="primary"
                    density="compact"
                    @click="addLoginAgreementDocument"
                  >
                    <template #icon><Icon name="plus" size="sm" /></template>
                    {{ localText("添加文档", "Add document") }}
                  </UiButton>
                </div>

                <div class="mt-4 space-y-3">
                  <div
                    v-for="(doc, index) in form.login_agreement_documents"
                    :key="doc.id || index"
                    class="rounded-lg border border-gray-200 bg-white p-4 dark:border-dark-700 dark:bg-dark-800/60"
                  >
                    <div class="mb-3 flex items-center justify-between gap-3">
                      <div class="flex min-w-0 items-center gap-3">
                        <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-dark-200">
                          <Icon
                            :name="
                              index === 1
                                ? 'shield'
                                : index === 2
                                  ? 'globe'
                                  : index === 3
                                    ? 'cog'
                                    : 'document'
                            "
                            size="sm"
                          />
                        </span>
                        <div class="min-w-0">
                          <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {{ doc.title || localText("未命名文档", "Untitled document") }}
                          </p>
                          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                            {{ loginAgreementRoutePath(doc, index) }}
                          </p>
                        </div>
                      </div>
                      <UiIconButton
                        type="button"
                        variant="danger"
                        density="compact"
                        icon="trash"
                        :label="localText('删除文档', 'Remove document')"
                        :disabled="
                          form.login_agreement_enabled &&
                          form.login_agreement_documents.length <= 1
                        "
                        @click="removeLoginAgreementDocument(index)"
                      />
                    </div>

                    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <UiTextField
                          v-model="doc.title"
                          type="text"
                          density="compact"
                          :label="localText('文档名称', 'Document title')"
                          :placeholder="localText('例如：服务条款', 'Example: Terms of Service')"
                        />
                      <UiTextField
                            v-model="doc.id"
                            type="text"
                            density="compact"
                            monospace
                            :label="localText('路由标识', 'Route slug')"
                            placeholder="usage-policy"
                          >
                            <template #prefix>/legal/</template>
                          </UiTextField>
                    </div>
                    <div class="mt-3">
                      <UiTextArea
                          v-model="doc.content_md"
                          :rows="8"
                          monospace
                          :label="localText('Markdown 内容', 'Markdown content')"
                          :placeholder="localText('在这里填写正式 Markdown 内容。', 'Write the final Markdown content here.')"
                        />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- /Tab: Login Agreement -->

	        <!-- Tab: Features (功能开关) -->
        <div
          id="settings-panel-features"
          v-show="activeTab === 'features'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-features"
        >

        <div class="settings-section">
          <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.settings.features.channelMonitor.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.settings.features.channelMonitor.description') }}
            </p>
            <p class="mt-1.5 text-xs">
              <router-link
                to="/admin/channels/monitor"
                class="inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400"
              >
                {{ t('admin.settings.features.channelMonitor.configureLink') }}
                <span aria-hidden="true">→</span>
              </router-link>
            </p>
          </div>
          <div class="space-y-5 p-6">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.channelMonitor.enabled') }}
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.channelMonitor.enabledHint') }}
                </p>
              </div>
              <Toggle v-model="form.channel_monitor_enabled" />
            </div>

            <div v-if="form.channel_monitor_enabled" class="space-y-5">
              <div>
                <label class="ui-field-label">
                  {{ t('admin.settings.features.channelMonitor.mode') }}
                </label>
                <div class="mt-1.5 inline-flex w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-dark-600 dark:bg-dark-900/40">
                  <UiButton
                    type="button"
                    :aria-pressed="form.channel_monitor_mode === 'v2'"
                    class="flex-1"
                    :variant="form.channel_monitor_mode === 'v2' ? 'primary' : 'secondary'"
                    density="compact"
                    @click="form.channel_monitor_mode = 'v2'"
                  >
                    {{ t('admin.settings.features.channelMonitor.modeV2') }}
                  </UiButton>
                  <UiButton
                    type="button"
                    :aria-pressed="form.channel_monitor_mode === 'v1'"
                    class="flex-1"
                    :variant="form.channel_monitor_mode === 'v1' ? 'primary' : 'secondary'"
                    density="compact"
                    @click="form.channel_monitor_mode = 'v1'"
                  >
                    {{ t('admin.settings.features.channelMonitor.modeV1') }}
                  </UiButton>
                </div>
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {{
                    form.channel_monitor_mode === 'v1'
                      ? t('admin.settings.features.channelMonitor.modeV1Hint')
                      : t('admin.settings.features.channelMonitor.modeV2Hint')
                  }}
                </p>
                <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {{ t('admin.settings.features.channelMonitor.modeHint') }}
                </p>
              </div>

              <div v-if="form.channel_monitor_mode === 'v1'">
                <UiTextField
                  v-model.number="form.channel_monitor_default_interval_seconds"
                  type="number"
                  min="15"
                  max="3600"
                  required
                  density="compact"
                  :label="t('admin.settings.features.channelMonitor.defaultInterval')"
                />
                <p class="mt-1 text-xs text-gray-400">
                  {{ t('admin.settings.features.channelMonitor.defaultIntervalHint') }}
                </p>
              </div>

              <div v-if="form.channel_monitor_mode === 'v2'" class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ t('admin.settings.features.channelMonitor.hideThroughput') }}
                  </p>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('admin.settings.features.channelMonitor.hideThroughputHint') }}
                  </p>
                </div>
                <Toggle v-model="form.channel_monitor_hide_throughput" />
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.settings.features.availableChannels.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.settings.features.availableChannels.description') }}
            </p>
            <p class="mt-1.5 text-xs">
              <router-link
                to="/admin/channels/pricing"
                class="inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400"
              >
                {{ t('admin.settings.features.availableChannels.configureLink') }}
                <span aria-hidden="true">→</span>
              </router-link>
            </p>
          </div>
          <div class="space-y-5 p-6">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.availableChannels.enabled') }}
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.availableChannels.enabledHint') }}
                </p>
              </div>
              <Toggle v-model="form.available_channels_enabled" />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.settings.features.modelPlaza.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.settings.features.modelPlaza.description') }}
            </p>
          </div>
          <div class="space-y-5 p-6">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.modelPlaza.enabled') }}
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.modelPlaza.enabledHint') }}
                </p>
              </div>
              <Toggle v-model="form.model_plaza_enabled" />
            </div>

            <div v-if="form.model_plaza_enabled" class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.modelPlaza.requireAuth') }}
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.modelPlaza.requireAuthHint') }}
                </p>
              </div>
              <Toggle v-model="form.model_plaza_require_auth" />
            </div>

            <div v-if="form.model_plaza_enabled">
              <UiTextArea
                v-model="form.model_plaza_description"
                :rows="6"
                monospace
                :label="t('admin.settings.features.modelPlaza.priceDescription')"
                :description="t('admin.settings.features.modelPlaza.priceDescriptionHint')"
              />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.settings.features.playground.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.settings.features.playground.description') }}
            </p>
          </div>
          <div class="p-6">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.playground.enabled') }}
                </label>
                <p class="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.playground.enabledHint') }}
                </p>
              </div>
              <Toggle v-model="form.playground_enabled" data-testid="playground-enabled-toggle" />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.settings.features.riskControl.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.settings.features.riskControl.description') }}
            </p>
            <p class="mt-1.5 text-xs">
              <router-link
                to="/admin/risk-control"
                class="inline-flex items-center gap-1 text-primary-600 hover:underline dark:text-primary-400"
              >
                {{ t('admin.settings.features.riskControl.configureLink') }}
                <span aria-hidden="true">→</span>
              </router-link>
            </p>
          </div>
          <div class="space-y-5 p-6">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.riskControl.enabled') }}
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.riskControl.enabledHint') }}
                </p>
              </div>
              <Toggle v-model="form.risk_control_enabled" />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.riskControl.cyberSessionBlock') }}
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.riskControl.cyberSessionBlockHint') }}
                </p>
              </div>
              <Toggle v-model="form.cyber_session_block_enabled" />
            </div>

            <div v-if="form.cyber_session_block_enabled">
              <UiTextField
                v-model.number="form.cyber_session_block_ttl_seconds"
                type="number"
                min="1"
                density="compact"
                required
                :label="t('admin.settings.features.riskControl.cyberSessionBlockTTL')"
              />
            </div>
          </div>
        </div>

        <!-- Affiliate (邀请返利) feature card -->
        <div class="settings-section">
          <div class="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('admin.settings.features.affiliate.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.settings.features.affiliate.description') }}
            </p>
          </div>
          <div class="space-y-5 p-6">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('admin.settings.features.affiliate.enabled') }}
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.settings.features.affiliate.enabledHint') }}
                </p>
              </div>
              <Toggle v-model="form.affiliate_enabled" />
            </div>

            <div v-if="form.affiliate_enabled" class="space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('admin.settings.features.affiliate.adminRechargeRebate') }}
                  </label>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('admin.settings.features.affiliate.adminRechargeRebateHint') }}
                  </p>
                </div>
                <Toggle v-model="form.affiliate_admin_recharge_enabled" />
              </div>

              <div>
                <UiTextField
                  v-model.number="form.affiliate_rebate_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  density="compact"
                  :label="t('admin.settings.features.affiliate.rebateRate')"
                  placeholder="20"
                  :description="t('admin.settings.features.affiliate.rebateRateHint')"
                >
                  <template #suffix>%</template>
                </UiTextField>
              </div>

              <div>
                <UiTextField
                  v-model.number="form.affiliate_rebate_freeze_hours"
                  type="number"
                  step="1"
                  min="0"
                  max="720"
                  density="compact"
                  :label="t('admin.settings.features.affiliate.freezeHours')"
                  :description="t('admin.settings.features.affiliate.freezeHoursDesc')"
                />
              </div>

              <div>
                <UiTextField
                  v-model.number="form.affiliate_rebate_duration_days"
                  type="number"
                  step="1"
                  min="0"
                  max="3650"
                  density="compact"
                  :label="t('admin.settings.features.affiliate.durationDays')"
                  :description="t('admin.settings.features.affiliate.durationDaysDesc')"
                />
              </div>

              <div>
                <UiTextField
                  v-model.number="form.affiliate_rebate_per_invitee_cap"
                  type="number"
                  step="0.01"
                  min="0"
                  density="compact"
                  :label="t('admin.settings.features.affiliate.perInviteeCap')"
                  :description="t('admin.settings.features.affiliate.perInviteeCapDesc')"
                />
              </div>

              <!-- 专属用户管理 -->
              <div class="border-t border-gray-100 pt-6 dark:border-dark-700">
                <div class="mb-3 flex items-center justify-between">
                  <div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                      {{ t('admin.settings.features.affiliate.customUsers.title') }}
                    </h3>
                    <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t('admin.settings.features.affiliate.customUsers.description') }}
                    </p>
                  </div>
                  <UiButton
                    type="button"
                    variant="primary"
                    density="compact"
                    @click="openAffiliateModal(null)"
                  >
                    + {{ t('admin.settings.features.affiliate.customUsers.addButton') }}
                  </UiButton>
                </div>

                <div class="mb-3 flex items-center gap-2">
                  <UiTextField
                    v-model="affiliateState.search"
                    type="text"
                    density="compact"
                    class="flex-1"
                    :label="t('admin.settings.features.affiliate.customUsers.searchPlaceholder')"
                    :placeholder="t('admin.settings.features.affiliate.customUsers.searchPlaceholder')"
                    @input="onAffiliateSearchInput"
                  />
                  <UiButton
                    v-if="affiliateState.selected.length > 0"
                    type="button"
                    variant="secondary"
                    density="compact"
                    @click="openAffiliateBatchModal"
                  >
                    {{ t('admin.settings.features.affiliate.customUsers.batchButton', { count: affiliateState.selected.length }) }}
                  </UiButton>
                </div>

                <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-700">
                  <table class="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                    <thead class="bg-gray-50 dark:bg-dark-800">
                      <tr>
                        <th class="px-3 py-2 text-left">
                          <UiCheckbox
                            :model-value="affiliateState.entries.length > 0 && affiliateState.selected.length === affiliateState.entries.length"
                            :aria-label="t('common.selectAll')"
                            @update:model-value="toggleAffiliateSelectAll"
                          />
                        </th>
                        <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('admin.settings.features.affiliate.customUsers.col.email') }}</th>
                        <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('admin.settings.features.affiliate.customUsers.col.username') }}</th>
                        <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('admin.settings.features.affiliate.customUsers.col.code') }}</th>
                        <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('admin.settings.features.affiliate.customUsers.col.rate') }}</th>
                        <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{{ t('admin.settings.features.affiliate.customUsers.col.actions') }}</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white dark:divide-dark-700 dark:bg-dark-900">
                      <tr v-if="affiliateState.loading">
                        <td colspan="6" class="px-3 py-6 text-center text-sm text-gray-500">
                          {{ t('common.loading') }}
                        </td>
                      </tr>
                      <tr v-else-if="affiliateState.entries.length === 0">
                        <td colspan="6" class="px-3 py-6 text-center text-sm text-gray-500">
                          {{ t('admin.settings.features.affiliate.customUsers.empty') }}
                        </td>
                      </tr>
                      <tr v-for="entry in affiliateState.entries" :key="entry.user_id">
                        <td class="px-3 py-2">
                          <UiCheckbox
                            :model-value="affiliateState.selected.includes(entry.user_id)"
                            :aria-label="entry.email"
                            @update:model-value="toggleAffiliateSelect(entry.user_id)"
                          />
                        </td>
                        <td class="px-3 py-2 text-sm text-gray-900 dark:text-white">{{ entry.email }}</td>
                        <td class="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{{ entry.username }}</td>
                        <td class="px-3 py-2 text-sm font-mono">
                          {{ entry.aff_code }}
                          <span
                            v-if="entry.aff_code_custom"
                            class="ml-1 inline-block rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                          >{{ t('admin.settings.features.affiliate.customUsers.customBadge') }}</span>
                        </td>
                        <td class="px-3 py-2 text-sm">
                          <span v-if="entry.aff_rebate_rate_percent != null">{{ entry.aff_rebate_rate_percent }}%</span>
                          <span v-else class="text-gray-400">{{ t('admin.settings.features.affiliate.customUsers.useGlobal') }}</span>
                        </td>
                        <td class="px-3 py-2 text-sm">
                          <div class="flex items-center gap-2">
                            <UiButton type="button" variant="quiet" density="mini" @click="openAffiliateModal(entry)">
                              {{ t('common.edit') }}
                            </UiButton>
                            <UiButton
                              type="button"
                              variant="danger"
                              density="mini"
                              @click="askResetAffiliateUser(entry)"
                            >
                              {{ t('common.delete') }}
                            </UiButton>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-if="affiliateState.total > affiliateState.pageSize" class="mt-3 flex items-center justify-between text-sm">
                  <span class="text-gray-500">
                    {{ t('admin.settings.features.affiliate.customUsers.totalLabel', { total: affiliateState.total }) }}
                  </span>
                  <div class="flex items-center gap-2">
                    <UiButton
                      type="button"
                      variant="secondary"
                      density="compact"
                      :disabled="affiliateState.page <= 1"
                      @click="changeAffiliatePage(affiliateState.page - 1)"
                    >
                      {{ t('pagination.previous') }}
                    </UiButton>
                    <span class="text-gray-500">{{ affiliateState.page }} / {{ Math.max(1, Math.ceil(affiliateState.total / affiliateState.pageSize)) }}</span>
                    <UiButton
                      type="button"
                      variant="secondary"
                      density="compact"
                      :disabled="affiliateState.page >= Math.ceil(affiliateState.total / affiliateState.pageSize)"
                      @click="changeAffiliatePage(affiliateState.page + 1)"
                    >
                      {{ t('pagination.next') }}
                    </UiButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Affiliate add/edit modal -->
        <UiDialog
          :show="affiliateModal.open"
          :title="affiliateModal.mode === 'add' ? t('admin.settings.features.affiliate.modal.addTitle') : t('admin.settings.features.affiliate.modal.editTitle')"
          width="narrow"
          :close-on-click-outside="true"
          @close="closeAffiliateModal"
        >
            <div class="space-y-4">
              <div v-if="affiliateModal.mode === 'add'">
                <!-- Chip showing the picked user; clicking it re-opens the search -->
                <div
                  v-if="affiliateModal.selectedUser"
                  class="flex items-center justify-between rounded-md border border-primary-200 bg-primary-50 px-3 py-2 dark:border-primary-700/50 dark:bg-primary-900/20"
                >
                  <div class="text-sm">
                    <span class="font-medium text-gray-900 dark:text-white">{{ affiliateModal.selectedUser.email }}</span>
                    <span class="ml-1 text-xs text-gray-500">({{ affiliateModal.selectedUser.username }})</span>
                  </div>
                  <UiIconButton
                    type="button"
                    variant="ghost"
                    density="mini"
                    icon="x"
                    :label="t('admin.settings.features.affiliate.modal.changeUser')"
                    @click="clearSelectedAffiliateUser"
                  />
                </div>
                <!-- Search input + result dropdown — hidden once a selection is made -->
                <template v-else>
                  <UiTextField
                    v-model="affiliateModal.userQuery"
                    type="text"
                    density="compact"
                    :label="t('admin.settings.features.affiliate.modal.userLabel')"
                    :placeholder="t('admin.settings.features.affiliate.modal.userPlaceholder')"
                    @input="onAffiliateUserSearchInput"
                  />
                  <div
                    v-if="affiliateModal.userResults.length > 0"
                    class="mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 dark:border-dark-700"
                  >
                    <UiButton
                      v-for="u in affiliateModal.userResults"
                      :key="u.id"
                      type="button"
                      variant="quiet"
                      density="compact"
                      block
                      class="justify-start rounded-none px-3 text-left text-sm"
                      @click="selectAffiliateUser(u)"
                    >
                      {{ u.email }} <span class="text-xs text-gray-500">({{ u.username }})</span>
                    </UiButton>
                  </div>
                </template>
              </div>
              <div v-else>
                <UiTextField
                  type="text"
                  density="compact"
                  :label="t('admin.settings.features.affiliate.modal.userLabel')"
                  :model-value="affiliateModal.editingEntry ? affiliateModal.editingEntry.email : ''"
                  disabled
                />
              </div>

              <div>
                <UiTextField
                  v-model="affiliateModal.code"
                  type="text"
                  density="compact"
                  monospace
                  :label="t('admin.settings.features.affiliate.modal.codeLabel')"
                  :placeholder="t('admin.settings.features.affiliate.modal.codePlaceholder')"
                  :maxlength="32"
                />
                <p class="mt-1 text-xs text-gray-400">
                  {{ t('admin.settings.features.affiliate.modal.codeHint') }}
                </p>
              </div>

              <div>
                <UiTextField
                  v-model="affiliateModal.rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  density="compact"
                  :label="t('admin.settings.features.affiliate.modal.rateLabel')"
                  :placeholder="t('admin.settings.features.affiliate.modal.ratePlaceholder')"
                >
                  <template #suffix>%</template>
                </UiTextField>
                <p class="mt-1 text-xs text-gray-400">
                  {{ t('admin.settings.features.affiliate.modal.rateHint') }}
                </p>
              </div>
            </div>

            <template #footer>
            <div class="flex w-full items-center justify-between gap-3">
              <p
                v-if="!affiliateModalCanSubmit"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('admin.settings.features.affiliate.modal.errorEmpty') }}
              </p>
              <span v-else></span>
              <div class="flex gap-2">
                <UiButton type="button" variant="secondary" density="compact" @click="closeAffiliateModal">
                  {{ t('common.cancel') }}
                </UiButton>
                <UiButton
                  type="button"
                  variant="primary"
                  density="compact"
                  :loading="affiliateModal.saving"
                  :disabled="affiliateModal.saving || !affiliateModalCanSubmit"
                  @click="submitAffiliateModal"
                >
                  {{ affiliateModal.saving ? t('common.saving') : t('common.save') }}
                </UiButton>
              </div>
            </div>
            </template>
        </UiDialog>

        <!-- Affiliate batch rate modal -->
        <UiDialog
          :show="affiliateBatchModal.open"
          :title="t('admin.settings.features.affiliate.batchModal.title', { count: affiliateState.selected.length })"
          width="narrow"
          :close-on-click-outside="true"
          @close="affiliateBatchModal.open = false"
        >
            <p class="mb-4 text-sm text-gray-500">
              {{ t('admin.settings.features.affiliate.batchModal.hint') }}
            </p>
            <div class="relative">
              <UiTextField
                v-model="affiliateBatchModal.rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                density="compact"
                :label="t('admin.settings.features.affiliate.batchModal.title', { count: affiliateState.selected.length })"
                :placeholder="t('admin.settings.features.affiliate.batchModal.placeholder')"
              >
                <template #suffix>%</template>
              </UiTextField>
            </div>
            <p class="mt-2 text-xs text-gray-400">
              {{ t('admin.settings.features.affiliate.batchModal.clearHint') }}
            </p>
            <template #footer>
              <UiButton type="button" variant="secondary" density="compact" @click="affiliateBatchModal.open = false">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                type="button"
                variant="primary"
                density="compact"
                :loading="affiliateBatchModal.saving"
                :disabled="affiliateBatchModal.saving"
                @click="submitAffiliateBatchModal"
              >
                {{ affiliateBatchModal.saving ? t('common.saving') : t('common.save') }}
              </UiButton>
            </template>
        </UiDialog>

        </div><!-- /Tab: Features -->

        <!-- Tab: Email -->
        <!-- Tab: Payment -->
        <div
          id="settings-panel-payment"
          v-show="activeTab === 'payment'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-payment"
        >
          <!-- Payment System Settings -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.payment.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.payment.description") }}
                <a
                  :href="paymentGuideHref"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-2 inline-flex items-center text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  <Icon name="externalLink" size="xs" class="mr-0.5" />
                  {{ t("admin.settings.payment.configGuide") }}
                </a>
              </p>
            </div>
            <div class="space-y-4 p-6">
              <!-- Enable toggle -->
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.payment.enabled")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.payment.enabledHint") }}
                  </p>
                </div>
                <Toggle v-model="form.payment_enabled" />
              </div>
              <template v-if="form.payment_enabled">
                <!-- Row 1: Product name -->
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <UiTextField
                      v-model="form.payment_product_name_prefix"
                      type="text"
                      density="compact"
                      :label="t('admin.settings.payment.productNamePrefix')"
                      placeholder="Sub2API"
                    />
                  </div>
                  <div>
                    <UiTextField
                      v-model="form.payment_product_name_suffix"
                      type="text"
                      density="compact"
                      :label="t('admin.settings.payment.productNameSuffix')"
                      placeholder="CNY"
                    />
                  </div>
                  <div>
                    <label class="ui-field-label">{{
                      t("admin.settings.payment.preview")
                    }}</label>
                    <div
                      class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-300"
                    >
                      {{
                        (form.payment_product_name_prefix || "Sub2API") +
                        " 100 " +
                        (form.payment_product_name_suffix || "CNY")
                      }}
                    </div>
                  </div>
                </div>
                <!-- Row 2: Balance toggle + amounts -->
                <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div>
                    <UiTextField
                      :model-value="form.payment_min_amount || ''"
                      @input="
                        form.payment_min_amount =
                          parseFloat(
                            ($event.target as HTMLInputElement).value,
                          ) || 0
                      "
                      type="number"
                      step="0.01"
                      min="0"
                      density="compact"
                      :label="t('admin.settings.payment.minAmount')"
                      :placeholder="t('admin.settings.payment.noLimit')"
                    />
                  </div>
                  <div>
                    <UiTextField
                      :model-value="form.payment_max_amount || ''"
                      @input="
                        form.payment_max_amount =
                          parseFloat(
                            ($event.target as HTMLInputElement).value,
                          ) || 0
                      "
                      type="number"
                      step="0.01"
                      min="0"
                      density="compact"
                      :label="t('admin.settings.payment.maxAmount')"
                      :placeholder="t('admin.settings.payment.noLimit')"
                    />
                  </div>
                  <div>
                    <UiTextField
                      :model-value="form.payment_daily_limit || ''"
                      @input="
                        form.payment_daily_limit =
                          parseFloat(
                            ($event.target as HTMLInputElement).value,
                          ) || 0
                      "
                      type="number"
                      step="0.01"
                      min="0"
                      density="compact"
                      :label="t('admin.settings.payment.dailyLimit')"
                      :placeholder="t('admin.settings.payment.noLimit')"
                    />
                  </div>
                  <div>
                    <UiTextField
                      :model-value="form.payment_balance_recharge_multiplier || ''"
                      @input="
                        form.payment_balance_recharge_multiplier =
                          parseFloat(
                            ($event.target as HTMLInputElement).value,
                          ) || 1
                      "
                      type="number"
                      step="0.01"
                      min="0.01"
                      density="compact"
                      :label="t('admin.settings.payment.balanceRechargeMultiplier')"
                    />
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{
                        t(
                          "admin.settings.payment.balanceRechargeMultiplierHint",
                        )
                      }}
                    </p>
                    <p
                      class="mt-1 text-xs font-medium text-primary-600 dark:text-primary-400"
                    >
                      {{
                        t("admin.settings.payment.balanceRechargePreview", {
                          usd: (
                            Number(form.payment_balance_recharge_multiplier) ||
                            1
                          ).toFixed(2),
                        })
                      }}
                    </p>
                  </div>
                  <div>
                    <UiTextField
                      :model-value="form.payment_subscription_usd_to_cny_rate || ''"
                      @input="
                        form.payment_subscription_usd_to_cny_rate =
                          parseFloat(
                            ($event.target as HTMLInputElement).value,
                          ) || 0
                      "
                      type="number"
                      step="0.01"
                      min="0"
                      density="compact"
                      :label="t('admin.settings.payment.subscriptionUsdToCnyRate')"
                      :placeholder="
                        t(
                          'admin.settings.payment.subscriptionUsdToCnyRateDisabled',
                        )
                      "
                    />
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{
                        t("admin.settings.payment.subscriptionUsdToCnyRateHint")
                      }}
                    </p>
                  </div>
                  <div>
                    <UiTextField
                      :model-value="form.payment_recharge_fee_rate ?? ''"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      density="compact"
                      :label="t('admin.settings.payment.rechargeFeeRate')"
                      @input="
                        form.payment_recharge_fee_rate = Math.min(
                          100,
                          Math.max(
                            0,
                            Math.round(
                              parseFloat(
                                ($event.target as HTMLInputElement).value ||
                                  '0',
                              ) * 100,
                            ) / 100,
                          ),
                        )
                      "
                    >
                      <template #suffix>%</template>
                    </UiTextField>
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{ t("admin.settings.payment.rechargeFeeRateHint") }}
                    </p>
                    <p
                      v-if="(Number(form.payment_recharge_fee_rate) || 0) > 0"
                      class="mt-1 text-xs font-medium text-primary-600 dark:text-primary-400"
                    >
                      {{
                        t("admin.settings.payment.rechargeFeePreview", {
                          fee: (
                            Number(form.payment_recharge_fee_rate) || 0
                          ).toFixed(2),
                        })
                      }}
                    </p>
                  </div>
                  <div>
                    <UiTextField
                      v-model.number="form.payment_order_timeout_minutes"
                      type="number"
                      min="1"
                      density="compact"
                      required
                      :label="t('admin.settings.payment.orderTimeout')"
                    />
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{ t("admin.settings.payment.orderTimeoutHint") }}
                    </p>
                  </div>
                </div>
                <!-- Row 3: Pending orders + load balance + cancel rate limit (all in one row) -->
                <div class="flex flex-wrap items-end gap-4">
                  <div class="w-28">
                    <UiTextField
                      v-model.number="form.payment_max_pending_orders"
                      type="number"
                      min="1"
                      density="compact"
                      :label="t('admin.settings.payment.maxPendingOrders')"
                    />
                  </div>
                  <div>
                    <label class="ui-field-label">{{
                      t("admin.settings.payment.loadBalanceStrategy")
                    }}</label>
                    <Select
                      v-model="form.payment_load_balance_strategy"
                      :options="loadBalanceOptions"
                      density="compact"
                      class="w-40"
                    />
                  </div>
                  <div>
                    <label class="ui-field-label">{{
                      t("admin.settings.payment.cancelRateLimit")
                    }}</label>
                    <div class="flex items-center gap-2">
                      <Toggle
                        v-model="form.payment_cancel_rate_limit_enabled"
                        :label="t('admin.settings.payment.cancelRateLimit')"
                        :native-input="false"
                      />
                      <Select
                        v-model="form.payment_cancel_rate_limit_window_mode"
                        :options="cancelRateLimitModeOptions"
                        density="compact"
                        class="w-24"
                        :disabled="!form.payment_cancel_rate_limit_enabled"
                      />
                      <span
                        :class="[
                          'text-sm whitespace-nowrap',
                          form.payment_cancel_rate_limit_enabled
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600',
                        ]"
                        >{{
                          t("admin.settings.payment.cancelRateLimitEvery")
                        }}</span
                      >
                      <UiTextField
                        v-model.number="form.payment_cancel_rate_limit_window"
                        type="number"
                        min="1"
                        required
                        class="w-14"
                        density="compact"
                        text-align="center"
                        :disabled="!form.payment_cancel_rate_limit_enabled"
                        :input-attrs="{ 'aria-label': t('admin.settings.payment.cancelRateLimitEvery') }"
                      />
                      <Select
                        v-model="form.payment_cancel_rate_limit_unit"
                        :options="cancelRateLimitUnitOptions"
                        density="compact"
                        class="w-28"
                        :disabled="!form.payment_cancel_rate_limit_enabled"
                      />
                      <span
                        :class="[
                          'text-sm whitespace-nowrap',
                          form.payment_cancel_rate_limit_enabled
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600',
                        ]"
                        >{{
                          t("admin.settings.payment.cancelRateLimitAllowMax")
                        }}</span
                      >
                      <UiTextField
                        v-model.number="form.payment_cancel_rate_limit_max"
                        type="number"
                        min="1"
                        required
                        class="w-14"
                        density="compact"
                        text-align="center"
                        :disabled="!form.payment_cancel_rate_limit_enabled"
                        :input-attrs="{ 'aria-label': t('admin.settings.payment.cancelRateLimitAllowMax') }"
                      />
                      <span
                        :class="[
                          'text-sm whitespace-nowrap',
                          form.payment_cancel_rate_limit_enabled
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600',
                        ]"
                        >{{
                          t("admin.settings.payment.cancelRateLimitTimes")
                        }}</span
                      >
                    </div>
                  </div>
                  <div>
                    <label class="ui-field-label">{{
                      t("admin.settings.payment.alipayForceQRCode")
                    }}</label>
                    <div class="flex items-center gap-2">
                      <Toggle
                        :model-value="!!form.payment_alipay_force_qrcode"
                        @update:model-value="form.payment_alipay_force_qrcode = $event"
                        :label="t('admin.settings.payment.alipayForceQRCode')"
                        :native-input="false"
                      />
                      <span class="text-sm text-gray-500 dark:text-gray-400">{{
                        t("admin.settings.payment.alipayForceQRCodeHint")
                      }}</span>
                    </div>
                  </div>
                  <div>
                    <label class="ui-field-label">{{
                      t("admin.settings.payment.alipayMobilePrecreateDeepLink")
                    }}</label>
                    <div class="flex items-center gap-2">
                      <Toggle
                        :model-value="!!form.payment_alipay_mobile_precreate_deep_link"
                        @update:model-value="form.payment_alipay_mobile_precreate_deep_link = $event"
                        :label="t('admin.settings.payment.alipayMobilePrecreateDeepLink')"
                        :native-input="false"
                      />
                      <span class="text-sm text-gray-500 dark:text-gray-400">{{
                        t("admin.settings.payment.alipayMobilePrecreateDeepLinkHint")
                      }}</span>
                    </div>
                  </div>
                </div>
                <!-- Row 4: Enabled payment types (provider badges like sub2apipay) -->
                <div>
                  <label class="ui-field-label">{{
                    t("admin.settings.payment.enabledPaymentTypes")
                  }}</label>
                  <div class="mt-1.5 flex flex-wrap gap-2">
                    <UiButton
                      v-for="pt in allPaymentTypes"
                      :key="pt.value"
                      type="button"
                      :aria-pressed="isPaymentTypeEnabled(pt.value)"
                      :variant="isPaymentTypeEnabled(pt.value) ? 'primary' : 'secondary'"
                      density="compact"
                      @click="togglePaymentType(pt.value)"
                    >
                      {{ pt.label }}
                    </UiButton>
                  </div>
                  <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {{ t("admin.settings.payment.enabledPaymentTypesHint") }}
                    <a
                      :href="paymentMethodsHref"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ml-1 text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      {{ t("admin.settings.payment.findProvider") }}
                      <Icon name="externalLink" size="xs" class="mb-0.5 ml-0.5 inline" />
                    </a>
                  </p>
                </div>
                <!-- Row 5: Help image + text -->
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label class="ui-field-label">{{
                      t("admin.settings.payment.helpImage")
                    }}</label>
                    <ImageUpload
                      v-model="form.payment_help_image_url"
                      :upload-label="t('admin.settings.site.uploadImage')"
                      :remove-label="t('admin.settings.site.remove')"
                      :placeholder="
                        t('admin.settings.payment.helpImagePlaceholder')
                      "
                    />
                  </div>
                  <div>
                    <UiTextArea
                      v-model="form.payment_help_text"
                      :rows="3"
                      :label="t('admin.settings.payment.helpText')"
                      :placeholder="
                        t('admin.settings.payment.helpTextPlaceholder')
                      "
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Provider Management -->
          <PaymentProviderList
            v-if="form.payment_enabled"
            :providers="providers"
            :loading="providersLoading"
            :can-create="hasAnyPaymentTypeEnabled"
            :enabled-payment-types="form.payment_enabled_types"
            :all-payment-types="allPaymentTypes"
            :redirect-label="t('admin.settings.payment.easypayRedirect')"
            @refresh="loadProviders"
            @create="openCreateProvider"
            @edit="openEditProvider"
            @delete="confirmDeleteProvider"
            @toggle-field="handleToggleField"
            @toggle-type="handleToggleType"
            @reorder="handleReorderProviders"
          />
        </div>

        <div
          id="settings-panel-email"
          v-show="activeTab === 'email'"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-tab-email"
        >
          <!-- Email disabled hint - show when email_verify_enabled is off -->
          <div v-if="!form.email_verify_enabled" class="settings-section">
            <div class="p-6">
              <div class="flex items-start gap-3">
                <Icon
                  name="mail"
                  size="md"
                  class="mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500"
                />
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ t("admin.settings.emailTabDisabledTitle") }}
                  </h3>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.emailTabDisabledHint") }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- SMTP Settings - Only show when email verification is enabled -->
          <div v-if="form.email_verify_enabled" class="settings-section">
            <div
              class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t("admin.settings.smtp.title") }}
                </h2>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.smtp.description") }}
                </p>
              </div>
              <UiButton
                type="button"
                @click="testSmtpConnection"
                :disabled="loadFailed"
                :loading="testingSmtp"
                variant="secondary"
                density="compact"
              >
                {{
                  testingSmtp
                    ? t("admin.settings.smtp.testing")
                    : t("admin.settings.smtp.testConnection")
                }}
              </UiButton>
            </div>
            <div class="space-y-6 p-6">
              <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <UiTextField
                    v-model="form.smtp_host"
                    density="compact"
                    :label="t('admin.settings.smtp.host')"
                    :placeholder="t('admin.settings.smtp.hostPlaceholder')"
                  />
                </div>
                <div>
                  <UiTextField
                    v-model.number="form.smtp_port"
                    type="number"
                    density="compact"
                    min="1"
                    max="65535"
                    :label="t('admin.settings.smtp.port')"
                    :placeholder="t('admin.settings.smtp.portPlaceholder')"
                  />
                </div>
                <div>
                  <UiTextField
                    v-model="form.smtp_username"
                    density="compact"
                    :label="t('admin.settings.smtp.username')"
                    :placeholder="t('admin.settings.smtp.usernamePlaceholder')"
                  />
                </div>
                <div>
                  <UiPasswordField
                    :model-value="form.smtp_password"
                    autocomplete="new-password"
                    :label="t('admin.settings.smtp.password')"
                    :input-attrs="{ autocapitalize: 'off', spellcheck: false }"
                    :placeholder="form.smtp_password_configured ? t('admin.settings.smtp.passwordConfiguredPlaceholder') : t('admin.settings.smtp.passwordPlaceholder')"
                    @update:model-value="form.smtp_password = $event; smtpPasswordManuallyEdited = true"
                  />
                  <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {{
                      form.smtp_password_configured
                        ? t("admin.settings.smtp.passwordConfiguredHint")
                        : t("admin.settings.smtp.passwordHint")
                    }}
                  </p>
                </div>
                <div>
                  <UiTextField
                    v-model="form.smtp_from_email"
                    type="email"
                    density="compact"
                    :label="t('admin.settings.smtp.fromEmail')"
                    :placeholder="t('admin.settings.smtp.fromEmailPlaceholder')"
                  />
                </div>
                <div>
                  <UiTextField
                    v-model="form.smtp_from_name"
                    density="compact"
                    :label="t('admin.settings.smtp.fromName')"
                    :placeholder="t('admin.settings.smtp.fromNamePlaceholder')"
                  />
                </div>
              </div>

              <!-- Use TLS Toggle -->
              <div
                class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700"
              >
                <div>
                  <label class="font-medium text-gray-900 dark:text-white">{{
                    t("admin.settings.smtp.useTls")
                  }}</label>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.smtp.useTlsHint") }}
                  </p>
                </div>
                <Toggle v-model="form.smtp_use_tls" />
              </div>
            </div>
          </div>

          <!-- Send Test Email - Only show when email verification is enabled -->
          <div v-if="form.email_verify_enabled" class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t("admin.settings.testEmail.title") }}
              </h2>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.testEmail.description") }}
              </p>
            </div>
            <div class="p-6">
              <div class="flex items-end gap-4">
                <div class="flex-1">
                  <UiTextField
                    v-model="testEmailAddress"
                    type="email"
                    density="compact"
                    :label="t('admin.settings.testEmail.recipientEmail')"
                    :placeholder="t('admin.settings.testEmail.recipientEmailPlaceholder')"
                  />
                </div>
                <UiButton
                  type="button"
                  @click="sendTestEmail"
                  :disabled="!testEmailAddress || loadFailed"
                  :loading="sendingTestEmail"
                  variant="secondary"
                  density="compact"
                >
                  {{
                    sendingTestEmail
                      ? t("admin.settings.testEmail.sending")
                      : t("admin.settings.testEmail.sendTestEmail")
                  }}
                </UiButton>
              </div>
            </div>
          </div>

          <!-- 订阅到期提醒 -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h3 class="text-base font-medium text-gray-900 dark:text-white">
                {{ t("admin.settings.subscriptionExpiryNotify.title") }}
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.subscriptionExpiryNotify.description") }}
              </p>
            </div>
            <div class="px-6 py-6">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <label
                    class="mb-0 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {{ t("admin.settings.subscriptionExpiryNotify.enabled") }}
                  </label>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ t("admin.settings.subscriptionExpiryNotify.enabledHint") }}
                  </p>
                </div>
                <Toggle v-model="form.subscription_expiry_notify_enabled" />
              </div>
            </div>
          </div>

          <EmailTemplateEditor />

          <!-- Balance Low Notification -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h3 class="text-base font-medium text-gray-900 dark:text-white">
                {{ t("admin.settings.balanceNotify.title") }}
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.balanceNotify.description") }}
              </p>
            </div>
            <div class="px-6 py-6 space-y-4">
              <div class="flex items-center justify-between">
                <label
                  class="mb-0 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >{{ t("admin.settings.balanceNotify.enabled") }}</label
                >
                <Toggle v-model="form.balance_low_notify_enabled" />
              </div>
              <div v-if="form.balance_low_notify_enabled">
                <UiTextField
                  v-model.number="form.balance_low_notify_threshold"
                  type="number"
                  min="0"
                  step="0.01"
                  density="compact"
                  :label="t('admin.settings.balanceNotify.threshold')"
                  :description="t('admin.settings.balanceNotify.thresholdHint')"
                >
                  <template #prefix>$</template>
                </UiTextField>
              </div>
              <div>
                <UiTextField
                  v-model="form.balance_low_notify_recharge_url"
                  type="url"
                  density="compact"
                  :label="t('admin.settings.balanceNotify.rechargeUrl')"
                  :description="t('admin.settings.balanceNotify.rechargeUrlHint')"
                  :placeholder="currentOrigin"
                />
              </div>
            </div>
          </div>

          <!-- Account Quota Notification -->
          <div class="settings-section">
            <div
              class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
            >
              <h3 class="text-base font-medium text-gray-900 dark:text-white">
                {{ t("admin.settings.quotaNotify.title") }}
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t("admin.settings.quotaNotify.description") }}
              </p>
            </div>
            <div class="px-6 py-6 space-y-4">
              <div class="flex items-center justify-between">
                <label
                  class="mb-0 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >{{ t("admin.settings.quotaNotify.enabled") }}</label
                >
                <Toggle v-model="form.account_quota_notify_enabled" />
              </div>
              <div v-if="form.account_quota_notify_enabled">
                <label
                  class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >{{ t("admin.settings.quotaNotify.emails") }}</label
                >
                <div class="space-y-2">
                  <div
                    v-for="(entry, index) in form.account_quota_notify_emails ||
                    []"
                    :key="index"
                    class="flex items-center gap-2"
                  >
                    <Toggle
                      :model-value="!entry.disabled"
                      :label="t('admin.settings.quotaNotify.enabled')"
                      @update:model-value="entry.disabled = !$event"
                    />
                    <UiTextField
                      v-model="entry.email"
                      type="email"
                      density="compact"
                      class="flex-1"
                      :input-attrs="{
                        'aria-label': t('admin.settings.quotaNotify.emailPlaceholder'),
                      }"
                      :placeholder="
                        t('admin.settings.quotaNotify.emailPlaceholder')
                      "
                    />
                    <UiIconButton
                      @click="form.account_quota_notify_emails.splice(index, 1)"
                      variant="danger"
                      density="compact"
                      :label="t('common.delete')"
                      icon="x"
                      type="button"
                    />
                  </div>
                  <UiButton
                    @click="addQuotaNotifyEmail"
                    variant="secondary"
                    density="compact"
                    type="button"
                  >
                    + {{ t("admin.settings.quotaNotify.addEmail") }}
                  </UiButton>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t("admin.settings.quotaNotify.emailsHint") }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <!-- /Tab: Email -->

        <!-- Tab: Backup -->
        <div
          id="settings-panel-backup"
          v-show="activeTab === 'backup'"
          class="settings-panel settings-panel-embedded"
          role="tabpanel"
          aria-labelledby="settings-tab-backup"
        >
          <BackupSettings />
        </div>

        <!-- Save Button -->
        <div v-show="activeTab !== 'backup'" class="flex justify-end">
          <UiButton
            type="submit"
            :disabled="saving || loadFailed"
            variant="primary"
            :loading="saving"
          >
            {{
              saving
                ? t("admin.settings.saving")
                : t("admin.settings.saveSettings")
            }}
          </UiButton>
        </div>
      </form>

      <!-- Provider dialogs placed outside the settings form to prevent form submission bubbling -->
      <PaymentProviderDialog
        ref="providerDialogRef"
        :show="showProviderDialog"
        :saving="providerSaving"
        :editing="editingProvider"
        :all-key-options="providerKeyOptions"
        :enabled-key-options="enabledProviderKeyOptions"
        :all-payment-types="allPaymentTypes"
        :redirect-label="t('admin.settings.payment.easypayRedirect')"
        @close="showProviderDialog = false"
        @save="handleSaveProvider"
      />
      <ConfirmDialog
        :show="showDeleteProviderDialog"
        :title="t('admin.settings.payment.deleteProvider')"
        :message="t('admin.settings.payment.deleteProviderConfirm')"
        :confirm-text="t('common.delete')"
        danger
        @confirm="handleDeleteProvider"
        @cancel="showDeleteProviderDialog = false"
      />
      <ConfirmDialog
        :show="affiliateConfirmDialog.show"
        :title="affiliateConfirmDialog.title"
        :message="affiliateConfirmDialog.message"
        :confirm-text="affiliateConfirmDialog.confirmText"
        danger
        @confirm="handleAffiliateConfirm"
        @cancel="cancelAffiliateConfirm"
      />
      <ConfirmDialog
        :show="settingsConfirmDialog.show"
        :title="settingsConfirmDialog.title"
        :message="settingsConfirmDialog.message"
        :confirm-text="settingsConfirmDialog.confirmText"
        :danger="settingsConfirmDialog.danger"
        :pending="settingsConfirmDialog.pending"
        @confirm="handleSettingsConfirm"
        @cancel="cancelSettingsConfirm"
      />
      <!-- 关闭 step-up 开关等敏感保存操作触发的 TOTP 二次验证 -->
      <TotpStepUpDialog :controller="settingsStepUp" />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { adminAPI } from "@/api";
import {
  appendAuthSourceDefaultsToUpdateRequest,
  buildAuthSourceDefaultsState,
  normalizeAccountSchedulingThresholdsMap,
  normalizePlatformQuotasMap,
  sanitizeAccountSchedulingThresholdsMap,
  sanitizePlatformQuotasMap,
  SCHEDULING_THRESHOLD_PLATFORMS,
  defaultWeChatConnectScopesForMode,
  deriveWeChatConnectStoredMode,
  normalizeDefaultSubscriptionSettings,
  resolveWeChatConnectModeCapabilities,
} from "@/api/admin/settings";
import type {
  AuthSourceDefaultsState,
  AuthSourceType,
  SystemSettings,
  UpdateSettingsRequest,
  DefaultSubscriptionSetting,
  DefaultPlatformQuotasMap,
  OpenAIFastPolicyRule,
  WeChatConnectMode,
  WebSearchEmulationConfig,
  WebSearchProviderConfig,
  WebSearchTestResult,
} from "@/api/admin/settings";
import type {
  LoginAgreementDocument,
  NotifyEmailEntry,
  Proxy,
} from "@/types";
import type { ProviderInstance, SubscriptionPlan } from "@/types/payment";
import AppLayout from "@/components/layout/AppLayout.vue";
import Icon from "@/components/icons/Icon.vue";
import {
  UiButton,
  UiCheckbox,
  UiConfirmDialog as ConfirmDialog,
  UiDialog,
  UiIconButton,
  UiPasswordField,
  UiProgressBar,
  UiRadioGroup,
  UiSelect as Select,
  UiSpinner,
  UiSwitch as Toggle,
  UiTabs,
  UiTextArea,
  UiTextField,
} from "@/components/ui";
import PaymentProviderList from "@/components/payment/PaymentProviderList.vue";
import PaymentProviderDialog from "@/components/payment/PaymentProviderDialog.vue";
import ProxySelector from "@/components/common/ProxySelector.vue";
import ImageUpload from "@/components/common/ImageUpload.vue";
import BackupSettings from "@/views/admin/BackupView.vue";
import EmailTemplateEditor from "@/views/admin/settings/EmailTemplateEditor.vue";
import OpenAIFastPolicyUserSelector from "@/views/admin/settings/OpenAIFastPolicyUserSelector.vue";
import { useClipboard } from "@/composables/useClipboard";
import {
  useStepUp,
  isStepUpCancelled,
  isStepUpBlocked,
  stepUpBlockReason,
} from "@/composables/useStepUp";
import TotpStepUpDialog from "@/components/auth/TotpStepUpDialog.vue";
import { affiliatesAPI, type AffiliateAdminEntry, type SimpleUser as AffiliateSimpleUser } from "@/api/admin/affiliates";
import { extractApiErrorMessage, extractI18nErrorMessage } from "@/utils/apiError";
import { useAppStore } from "@/stores";
import { useAdminSettingsStore } from "@/stores/adminSettings";
import { normalizeVisibleMethod } from "@/components/payment/paymentFlow";
import {
  isRegistrationEmailSuffixDomainValid,
  normalizeRegistrationEmailSuffixDomain,
  normalizeRegistrationEmailSuffixDomains,
  parseRegistrationEmailSuffixWhitelistInput,
} from "@/utils/registrationEmailPolicy";
import {
  parseFingerprintSignalsToRows,
  serializeFingerprintRowsToJSON,
  defaultFingerprintSignalRows,
  type FingerprintSignalRow,
} from "./codexFingerprintSignals";

const { t, locale } = useI18n();
const appStore = useAppStore();
// 关闭 step-up 开关是敏感操作：后端返回 STEP_UP_REQUIRED 时弹 TOTP 码重试
const settingsStepUp = useStepUp();
const adminSettingsStore = useAdminSettingsStore();
const isZhLocale = computed(() => locale.value.startsWith("zh"));

function localText(zh: string, en: string): string {
  return isZhLocale.value ? zh : en;
}

const paymentGuideHref = computed(() =>
  locale.value.startsWith("zh")
    ? "https://github.com/Wei-Shaw/sub2api/blob/main/docs/PAYMENT_CN.md"
    : "https://github.com/Wei-Shaw/sub2api/blob/main/docs/PAYMENT.md",
);

const paymentMethodsHref = computed(() =>
  locale.value.startsWith("zh")
    ? "https://github.com/Wei-Shaw/sub2api/blob/main/docs/PAYMENT_CN.md#支持的支付方式"
    : "https://github.com/Wei-Shaw/sub2api/blob/main/docs/PAYMENT.md#supported-payment-methods",
);

type SettingsTab =
  | "general"
  | "agreement"
  | "features"
  | "security"
  | "users"
  | "gateway"
  | "payment"
  | "email"
  | "backup";
const activeTab = ref<SettingsTab>("general");
const settingsTabs = [
  { key: "general" as SettingsTab, icon: "home" as const },
  { key: "agreement" as SettingsTab, icon: "document" as const },
  { key: "features" as SettingsTab, icon: "bolt" as const },
  { key: "security" as SettingsTab, icon: "shield" as const },
  { key: "users" as SettingsTab, icon: "user" as const },
  { key: "gateway" as SettingsTab, icon: "server" as const },
  { key: "payment" as SettingsTab, icon: "creditCard" as const },
  { key: "email" as SettingsTab, icon: "mail" as const },
  { key: "backup" as SettingsTab, icon: "database" as const },
];
const settingsTabOptions = computed(() =>
  settingsTabs.map((tab) => ({
    value: tab.key,
    label: t(`admin.settings.tabs.${tab.key}`),
    icon: tab.icon,
    id: `settings-tab-${tab.key}`,
    controls:
      tab.key === "security"
        ? "settings-panel-security settings-panel-security-details"
        : tab.key === "gateway"
          ? "settings-panel-gateway settings-panel-gateway-details"
          : `settings-panel-${tab.key}`,
  })),
);

function selectSettingsTab(tab: SettingsTab): void {
  activeTab.value = tab;
  window.requestAnimationFrame(() => {
    document
      .getElementById(`settings-tab-${tab}`)
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  });
}

const { copyToClipboard } = useClipboard();

const loading = ref(true);
const loadFailed = ref(false);
const saving = ref(false);
const testingSmtp = ref(false);
const sendingTestEmail = ref(false);
const smtpPasswordManuallyEdited = ref(false);
const testEmailAddress = ref("");
const registrationEmailSuffixWhitelistTags = ref<string[]>([]);
const registrationEmailSuffixWhitelistDraft = ref("");
const forwardedClientIpHeaderDraft = ref("");
const tablePageSizeOptionsInput = ref("10, 20, 50, 100");

// Admin API Key 状态
const adminApiKeyLoading = ref(true);
const adminApiKeyExists = ref(false);
const adminApiKeyMasked = ref("");
const adminApiKeyOperating = ref(false);
const newAdminApiKey = ref("");
const subscriptionPlans = ref<SubscriptionPlan[]>([]);

type SettingsConfirmAction = () => Promise<boolean>;
const settingsConfirmDialog = reactive<{
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  danger: boolean;
  pending: boolean;
  action: SettingsConfirmAction | null;
}>({
  show: false,
  title: "",
  message: "",
  confirmText: "",
  danger: true,
  pending: false,
  action: null,
});

function openSettingsConfirm(
  title: string,
  message: string,
  confirmText: string,
  action: SettingsConfirmAction,
  danger = true,
) {
  settingsConfirmDialog.title = title;
  settingsConfirmDialog.message = message;
  settingsConfirmDialog.confirmText = confirmText;
  settingsConfirmDialog.action = action;
  settingsConfirmDialog.danger = danger;
  settingsConfirmDialog.pending = false;
  settingsConfirmDialog.show = true;
}

function cancelSettingsConfirm() {
  if (settingsConfirmDialog.pending) return;
  settingsConfirmDialog.show = false;
  settingsConfirmDialog.action = null;
}

async function handleSettingsConfirm() {
  const action = settingsConfirmDialog.action;
  if (!action || settingsConfirmDialog.pending) return;
  settingsConfirmDialog.pending = true;
  try {
    const succeeded = await action();
    if (succeeded) {
      settingsConfirmDialog.show = false;
      settingsConfirmDialog.action = null;
    }
  } finally {
    settingsConfirmDialog.pending = false;
  }
}

// Upstream billing probe state
const upstreamBillingProbeLoading = ref(true);
const upstreamBillingProbeSaving = ref(false);
const upstreamBillingProbeForm = reactive({
  enabled: true,
  interval_minutes: 30,
});

const ollamaCloudUsageLoading = ref(true);
const ollamaCloudUsageSaving = ref(false);
const ollamaCloudUsageForm = reactive({
  enabled: false,
  interval_minutes: 60,
  debounce_minutes: 1,
});

// Overload Cooldown (529) 状态
const overloadCooldownLoading = ref(true);
const overloadCooldownSaving = ref(false);
const overloadCooldownForm = reactive({
  enabled: true,
  cooldown_minutes: 10,
});

// Rate Limit Cooldown (429) 状态
const rateLimit429CooldownLoading = ref(true);
const rateLimit429CooldownSaving = ref(false);
const rateLimit429CooldownForm = reactive({
  enabled: true,
  cooldown_seconds: 5,
});

// Panel API Rate Limit 状态
const panelRateLimitLoading = ref(true);
const panelRateLimitSaving = ref(false);
const panelRateLimitForm = reactive({
  enabled: true,
  user_rpm: 240,
  heavy_rpm: 60,
  exempt_admin: true,
  public_ip_rpm: 300,
});

// Stream Timeout 状态
const streamTimeoutLoading = ref(true);
const streamTimeoutSaving = ref(false);
const streamTimeoutForm = reactive({
  enabled: true,
  action: "temp_unsched" as "temp_unsched" | "error" | "none",
  temp_unsched_minutes: 5,
  threshold_count: 3,
  threshold_window_minutes: 10,
});
const streamTimeoutActionOptions = computed(() => [
  { value: "temp_unsched", label: t("admin.settings.streamTimeout.actionTempUnsched") },
  { value: "error", label: t("admin.settings.streamTimeout.actionError") },
  { value: "none", label: t("admin.settings.streamTimeout.actionNone") },
]);

// Rectifier 状态
const rectifierLoading = ref(true);
const rectifierSaving = ref(false);
const rectifierForm = reactive({
  enabled: true,
  thinking_signature_enabled: true,
  thinking_budget_enabled: true,
  apikey_signature_enabled: false,
  apikey_signature_patterns: [] as string[],
});

// Beta Policy 状态
const betaPolicyLoading = ref(true);
const betaPolicySaving = ref(false);
const betaPolicyForm = reactive({
  rules: [] as Array<{
    beta_token: string;
    action: "pass" | "filter" | "block";
    scope: "all" | "oauth" | "apikey" | "bedrock";
    error_message?: string;
    model_whitelist?: string[];
    fallback_action?: "pass" | "filter" | "block";
    fallback_error_message?: string;
  }>,
});

// OpenAI Fast/Flex Policy 状态
const openaiFastPolicyForm = reactive({
  rules: [] as OpenAIFastPolicyRule[],
});
// 标记 openai_fast_policy_settings 是否已成功从后端加载，
// 避免后端 GET 出错或字段缺失时，保存把默认规则覆盖成空数组。
const openaiFastPolicyLoaded = ref(false);

const tablePageSizeMin = 5;
const tablePageSizeMax = 1000;
const tablePageSizeDefault = 20;

function defaultLoginAgreementDocuments(): LoginAgreementDocument[] {
  return [
    {
      id: "terms",
      title: localText("服务条款", "Terms of Service"),
      content_md: "",
    },
    {
      id: "usage-policy",
      title: localText("使用政策", "Usage Policy"),
      content_md: "",
    },
    {
      id: "supported-regions",
      title: localText("支持的国家和地区", "Supported Countries and Regions"),
      content_md: "",
    },
    {
      id: "service-specific-terms",
      title: localText("服务特定条款", "Service-Specific Terms"),
      content_md: "",
    },
  ];
}

function normalizeLoginAgreementDocumentId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/[-_]{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function loginAgreementRoutePath(
  doc: LoginAgreementDocument,
  index: number,
): string {
  const id =
    normalizeLoginAgreementDocumentId(doc.id || doc.title) || `doc-${index + 1}`;
  return `/legal/${id}`;
}

type ClaudeOAuthSystemPromptPreset =
  | "billing"
  | "system"
  | "expansion"
  | "custom";

interface ClaudeOAuthSystemPromptBlock {
  id: string;
  enabled: boolean;
  expanded: boolean;
  type: "text";
  preset: ClaudeOAuthSystemPromptPreset;
  text: string;
  cacheControlEnabled: boolean;
  cacheControlTTL: string;
}

interface ClaudeOAuthSystemPromptRawBlock {
  enabled?: boolean;
  type?: string;
  text?: string;
  cache_control?: unknown;
}

const defaultClaudeCodeSystemPrompt =
  "You are Claude Code, Anthropic's official CLI for Claude.";

const defaultClaudeCodeExpansionPrompt = `You are an interactive agent that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools (C2 frameworks, credential testing, exploit development) require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.
IMPORTANT: You must NEVER generate or guess URLs for the user unless you are confident that the URLs are for helping the user with programming. You may use URLs provided by the user in their messages or local files.

# Tone and style
 - Only use emojis if the user explicitly requests it. Avoid using emojis in all communication unless asked.
 - Your responses should be short and concise.
 - When referencing specific functions or pieces of code include the pattern file_path:line_number to allow the user to easily navigate to the source code location.
 - When referencing GitHub issues or pull requests, use the owner/repo#123 format (e.g. anthropics/claude-code#100) so they render as clickable links.
 - Do not use a colon before tool calls. Your tool calls may not be shown directly in the output, so text like "Let me read the file:" followed by a read tool call should just be "Let me read the file." with a period.`;

let claudeOAuthSystemPromptBlockID = 0;

function nextClaudeOAuthSystemPromptBlockID(): string {
  claudeOAuthSystemPromptBlockID += 1;
  return `claude-oauth-system-prompt-block-${claudeOAuthSystemPromptBlockID}`;
}

function normalizeClaudeOAuthSystemPromptCacheTTL(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "5m";
}

function detectClaudeOAuthSystemPromptPreset(
  text: string,
): ClaudeOAuthSystemPromptPreset {
  const trimmed = text.trim();
  if (trimmed === "{billing_header}") {
    return "billing";
  }
  if (
    trimmed === "{claude_code_system_prompt}" ||
    trimmed === defaultClaudeCodeSystemPrompt
  ) {
    return "system";
  }
  if (
    trimmed === "{claude_code_expansion_prompt}" ||
    trimmed === defaultClaudeCodeExpansionPrompt
  ) {
    return "expansion";
  }
  return "custom";
}

function normalizeClaudeOAuthSystemPromptBlockText(
  text: string,
  expansionPrompt = "",
): string {
  const trimmed = text.trim();
  if (trimmed === "{claude_code_system_prompt}") {
    return defaultClaudeCodeSystemPrompt;
  }
  if (trimmed === "{claude_code_expansion_prompt}") {
    return expansionPrompt.trim() || defaultClaudeCodeExpansionPrompt;
  }
  return text;
}

function createClaudeOAuthSystemPromptBlock(
  overrides: Partial<ClaudeOAuthSystemPromptBlock> = {},
): ClaudeOAuthSystemPromptBlock {
  const text = overrides.text ?? "";
  return {
    id: nextClaudeOAuthSystemPromptBlockID(),
    enabled: overrides.enabled ?? true,
    expanded: overrides.expanded ?? true,
    type: "text",
    preset: overrides.preset ?? detectClaudeOAuthSystemPromptPreset(text),
    text,
    cacheControlEnabled: overrides.cacheControlEnabled ?? false,
    cacheControlTTL: overrides.cacheControlTTL ?? "5m",
  };
}

function createDefaultClaudeOAuthSystemPromptBlocks(
  expansionPrompt = "",
): ClaudeOAuthSystemPromptBlock[] {
  const normalizedExpansionPrompt = expansionPrompt.trim();
  const expansionText =
    normalizedExpansionPrompt || defaultClaudeCodeExpansionPrompt;

  return [
    createClaudeOAuthSystemPromptBlock({
      preset: "billing",
      text: "{billing_header}",
    }),
    createClaudeOAuthSystemPromptBlock({
      preset: "system",
      text: defaultClaudeCodeSystemPrompt,
    }),
    createClaudeOAuthSystemPromptBlock({
      preset:
        expansionText === defaultClaudeCodeExpansionPrompt
          ? "expansion"
          : "custom",
      text: expansionText,
      cacheControlEnabled: true,
      cacheControlTTL: "5m",
    }),
  ];
}

function parseClaudeOAuthSystemPromptCacheControl(cacheControl: unknown): {
  enabled: boolean;
  ttl: string;
} {
  if (cacheControl === true) {
    return { enabled: true, ttl: "5m" };
  }
  if (
    cacheControl &&
    typeof cacheControl === "object" &&
    !Array.isArray(cacheControl)
  ) {
    return {
      enabled: true,
      ttl: normalizeClaudeOAuthSystemPromptCacheTTL(
        (cacheControl as Record<string, unknown>).ttl,
      ),
    };
  }
  return { enabled: false, ttl: "5m" };
}

function parseClaudeOAuthSystemPromptBlocks(
  raw: string,
  expansionPrompt = "",
): ClaudeOAuthSystemPromptBlock[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return createDefaultClaudeOAuthSystemPromptBlocks(expansionPrompt);
  }

  try {
    const parsed = JSON.parse(trimmed) as
      | ClaudeOAuthSystemPromptRawBlock[]
      | { blocks?: ClaudeOAuthSystemPromptRawBlock[] };
    const rawBlocks = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.blocks)
        ? parsed.blocks
        : [];

    if (rawBlocks.length === 0) {
      return createDefaultClaudeOAuthSystemPromptBlocks(expansionPrompt);
    }

    return rawBlocks.map((block) => {
      const cacheControl = parseClaudeOAuthSystemPromptCacheControl(
        block.cache_control,
      );
      const text = normalizeClaudeOAuthSystemPromptBlockText(
        typeof block.text === "string" ? block.text : "",
        expansionPrompt,
      );
      return createClaudeOAuthSystemPromptBlock({
        enabled: block.enabled !== false,
        type: "text",
        text,
        preset: detectClaudeOAuthSystemPromptPreset(text),
        cacheControlEnabled: cacheControl.enabled,
        cacheControlTTL: cacheControl.ttl,
      });
    });
  } catch (_error) {
    return createDefaultClaudeOAuthSystemPromptBlocks(expansionPrompt);
  }
}

function serializeClaudeOAuthSystemPromptBlocksToJSON(
  blocks: ClaudeOAuthSystemPromptBlock[],
): string {
  const source =
    blocks.length > 0
      ? blocks
      : [
          createClaudeOAuthSystemPromptBlock({
            enabled: false,
            preset: "custom",
            text: "",
          }),
        ];

  const rawBlocks = source.map((block) => {
    const raw: ClaudeOAuthSystemPromptRawBlock = {
      enabled: block.enabled,
      type: block.type || "text",
      text: block.text,
    };
    if (block.cacheControlEnabled) {
      raw.cache_control = {
        type: "ephemeral",
        ttl: normalizeClaudeOAuthSystemPromptCacheTTL(block.cacheControlTTL),
      };
    }
    return raw;
  });

  return JSON.stringify(rawBlocks, null, 2);
}

const defaultClaudeOAuthSystemPromptBlocks =
  serializeClaudeOAuthSystemPromptBlocksToJSON(
    createDefaultClaudeOAuthSystemPromptBlocks(),
  );

const claudeOAuthSystemPromptBlocks = ref<ClaudeOAuthSystemPromptBlock[]>(
  createDefaultClaudeOAuthSystemPromptBlocks(),
);

const claudeOAuthSystemPromptPresetOptions = computed(() => [
  {
    value: "billing",
    label: t("admin.settings.gatewayForwarding.systemBlockPresetBilling"),
  },
  {
    value: "system",
    label: t("admin.settings.gatewayForwarding.systemBlockPresetIdentity"),
  },
  {
    value: "expansion",
    label: t("admin.settings.gatewayForwarding.systemBlockPresetExpansion"),
  },
  {
    value: "custom",
    label: t("admin.settings.gatewayForwarding.systemBlockPresetCustom"),
  },
]);

const claudeOAuthSystemPromptBlockTypeOptions = computed(() => [
  {
    value: "text",
    label: t("admin.settings.gatewayForwarding.systemBlockTypeText"),
  },
]);

const claudeOAuthSystemPromptCacheTTLOptions = computed(() => [
  { value: "5m", label: t("admin.settings.gatewayForwarding.cacheTTL5m") },
  { value: "1h", label: t("admin.settings.gatewayForwarding.cacheTTL1h") },
]);

function getClaudeOAuthPresetLabel(
  preset: ClaudeOAuthSystemPromptPreset,
): string {
  return (
    claudeOAuthSystemPromptPresetOptions.value.find(
      (option) => option.value === preset,
    )?.label || t("admin.settings.gatewayForwarding.systemBlockPresetCustom")
  );
}

function syncClaudeOAuthSystemPromptBlocksFormField(): void {
  form.claude_oauth_system_prompt_blocks =
    serializeClaudeOAuthSystemPromptBlocksToJSON(
      claudeOAuthSystemPromptBlocks.value,
    );
}

function addClaudeOAuthSystemPromptBlock(): void {
  claudeOAuthSystemPromptBlocks.value.push(
    createClaudeOAuthSystemPromptBlock({
      expanded: true,
      preset: "custom",
      text: "",
    }),
  );
  syncClaudeOAuthSystemPromptBlocksFormField();
}

function toggleClaudeOAuthSystemPromptBlock(index: number): void {
  const block = claudeOAuthSystemPromptBlocks.value[index];
  if (!block) {
    return;
  }
  block.expanded = !block.expanded;
}

function removeClaudeOAuthSystemPromptBlock(index: number): void {
  claudeOAuthSystemPromptBlocks.value.splice(index, 1);
  syncClaudeOAuthSystemPromptBlocksFormField();
}

function moveClaudeOAuthSystemPromptBlock(
  index: number,
  direction: -1 | 1,
): void {
  const targetIndex = index + direction;
  if (
    targetIndex < 0 ||
    targetIndex >= claudeOAuthSystemPromptBlocks.value.length
  ) {
    return;
  }
  const blocks = claudeOAuthSystemPromptBlocks.value;
  const current = blocks[index];
  blocks[index] = blocks[targetIndex];
  blocks[targetIndex] = current;
  syncClaudeOAuthSystemPromptBlocksFormField();
}

function applyClaudeOAuthSystemPromptPreset(
  index: number,
  value: string | number | boolean | null,
): void {
  const block = claudeOAuthSystemPromptBlocks.value[index];
  if (!block) {
    return;
  }
  const preset = String(value || "custom") as ClaudeOAuthSystemPromptPreset;
  block.preset = preset;
  block.type = "text";
  if (preset === "billing") {
    block.text = "{billing_header}";
    block.cacheControlEnabled = false;
    block.cacheControlTTL = "5m";
  } else if (preset === "system") {
    block.text = defaultClaudeCodeSystemPrompt;
    block.cacheControlEnabled = false;
    block.cacheControlTTL = "5m";
  } else if (preset === "expansion") {
    block.text =
      form.claude_oauth_system_prompt.trim() ||
      defaultClaudeCodeExpansionPrompt;
    block.cacheControlEnabled = true;
    block.cacheControlTTL = "5m";
  }
  syncClaudeOAuthSystemPromptBlocksFormField();
}

function markClaudeOAuthSystemPromptBlockCustom(
  block: ClaudeOAuthSystemPromptBlock,
): void {
  block.preset = detectClaudeOAuthSystemPromptPreset(block.text);
  syncClaudeOAuthSystemPromptBlocksFormField();
}

function resetClaudeOAuthSystemPromptBlocks(): void {
  claudeOAuthSystemPromptBlocks.value = createDefaultClaudeOAuthSystemPromptBlocks(
    form.claude_oauth_system_prompt,
  );
  syncClaudeOAuthSystemPromptBlocksFormField();
}


interface DefaultSubscriptionPlanOption {
  value: number;
  label: string;
  groupSummary: string;
  [key: string]: unknown;
}

type SettingsForm = Omit<
  SystemSettings,
  | "wechat_connect_open_enabled"
  | "wechat_connect_mp_enabled"
  | "wechat_connect_mobile_enabled"
> & {
  /** Form always binds a concrete boolean (SystemSettings marks this optional). */
  channel_monitor_hide_throughput: boolean;
  smtp_password: string;
  turnstile_secret_key: string;
  tencent_captcha_app_secret_key: string;
  tencent_captcha_cloud_secret_id: string;
  tencent_captcha_cloud_secret_key: string;
  aliyun_captcha_access_key_secret: string;
  linuxdo_connect_client_secret: string;
  dingtalk_connect_client_secret: string;
  wechat_connect_app_secret: string;
  wechat_connect_open_app_secret: string;
  wechat_connect_mp_app_secret: string;
  wechat_connect_mobile_app_secret: string;
  wechat_connect_open_enabled: boolean;
  wechat_connect_mp_enabled: boolean;
  wechat_connect_mobile_enabled: boolean;
  oidc_connect_client_secret: string;
  github_oauth_client_secret: string;
  google_oauth_client_secret: string;
  force_email_on_third_party_signup: boolean;
  openai_low_upstream_rate_priority_enabled: boolean;
  openai_oauth_scheduling_rate_multiplier: number;
  openai_advanced_scheduler_enabled: boolean;
  openai_advanced_scheduler_sticky_weighted_enabled: boolean;
  openai_advanced_scheduler_subscription_priority_enabled: boolean;
  openai_advanced_scheduler_lb_top_k: string;
  openai_advanced_scheduler_weight_priority: string;
  openai_advanced_scheduler_weight_load: string;
  openai_advanced_scheduler_weight_queue: string;
  openai_advanced_scheduler_weight_error_rate: string;
  openai_advanced_scheduler_weight_ttft: string;
  openai_advanced_scheduler_weight_reset: string;
  openai_advanced_scheduler_weight_quota_headroom: string;
  openai_advanced_scheduler_weight_upstream_cost: string;
  openai_advanced_scheduler_weight_previous_response: string;
  openai_advanced_scheduler_weight_session_sticky: string;
  // 系统全局平台限额 map；form 内始终归一化为全 4 平台对象（模板非空绑定依赖此不变量）
  default_platform_quotas: DefaultPlatformQuotasMap;
  account_scheduling_thresholds: ReturnType<typeof normalizeAccountSchedulingThresholdsMap>;
};

const schedulingThresholdPlatforms = SCHEDULING_THRESHOLD_PLATFORMS;

const form = reactive<SettingsForm>({
  registration_enabled: true,
  email_verify_enabled: false,
  registration_email_suffix_whitelist: [],
  registration_email_domain_quota_enabled: false,
  promo_code_enabled: true,
  invitation_code_enabled: false,
  password_reset_enabled: false,
  totp_enabled: false,
  totp_encryption_key_configured: false,
  passkey_enabled: false,
  passkey_configured: false,
  passkey_rp_id: "",
  passkey_rp_origins: [],
  session_binding_enabled: false,
  step_up_enabled: false,
  audit_log_retention_days: 180,
  login_agreement_enabled: false,
  login_agreement_mode: "modal",
  login_agreement_updated_at: "2026-03-31",
  login_agreement_documents: defaultLoginAgreementDocuments(),
  default_balance: 0,
  default_platform_quotas: normalizePlatformQuotasMap() as DefaultPlatformQuotasMap,
  account_scheduling_thresholds: normalizeAccountSchedulingThresholdsMap(),
  affiliate_rebate_rate: 20,
  affiliate_rebate_freeze_hours: 0,
  affiliate_rebate_duration_days: 0,
  affiliate_rebate_per_invitee_cap: 0,
  affiliate_admin_recharge_enabled: false,
  default_concurrency: 1,
  default_subscriptions: [],
  force_email_on_third_party_signup: false,
  default_user_rpm_limit: 0,
  site_name: "Sub2API",
  site_logo: "",
  site_icon: "",
  site_subtitle: "Subscription to API Conversion Platform",
  api_base_url: "",
  contact_info: "",
  doc_url: "",
  home_content: "",
  compact_home_enabled: false,
  backend_mode_enabled: false,
  hide_ccs_import_button: false,
  payment_enabled: false,
  risk_control_enabled: false,
  cyber_session_block_enabled: false,
  cyber_session_block_ttl_seconds: 3600,
  payment_min_amount: 1,
  payment_max_amount: 10000,
  payment_daily_limit: 50000,
  payment_max_pending_orders: 3,
  payment_order_timeout_minutes: 30,
  payment_balance_disabled: false,
  payment_balance_recharge_multiplier: 1,
  payment_subscription_usd_to_cny_rate: 0,
  payment_recharge_fee_rate: 0,
  payment_enabled_types: [],
  payment_help_image_url: "",
  payment_help_text: "",
  payment_product_name_prefix: "",
  payment_product_name_suffix: "",
  payment_load_balance_strategy: "round-robin",
  payment_cancel_rate_limit_enabled: false,
  payment_cancel_rate_limit_max: 10,
  payment_cancel_rate_limit_window: 1,
  payment_cancel_rate_limit_unit: "day",
  payment_cancel_rate_limit_window_mode: "rolling",
  payment_alipay_force_qrcode: false,
  payment_alipay_mobile_precreate_deep_link: false,
  table_default_page_size: tablePageSizeDefault,
  table_page_size_options: [10, 20, 50, 100],
  custom_menu_items: [] as Array<{
    id: string;
    label: string;
    icon_svg: string;
    url: string;
    visibility: "user" | "admin";
    sort_order: number;
  }>,
  custom_endpoints: [] as Array<{
    name: string;
    endpoint: string;
    description: string;
  }>,
  frontend_url: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_password_configured: false,
  smtp_from_email: "",
  smtp_from_name: "",
  smtp_use_tls: true,
  // Cloudflare Turnstile
  turnstile_enabled: false,
  turnstile_site_key: "",
  turnstile_secret_key: "",
  turnstile_secret_key_configured: false,
  tencent_captcha_enabled: false,
  tencent_captcha_app_id: "",
  tencent_captcha_app_secret_key: "",
  tencent_captcha_app_secret_key_configured: false,
  tencent_captcha_cloud_secret_id: "",
  tencent_captcha_cloud_secret_id_configured: false,
  tencent_captcha_cloud_secret_key: "",
  tencent_captcha_cloud_secret_key_configured: false,
  tencent_captcha_region: "cn",
  aliyun_captcha_enabled: false,
  aliyun_captcha_access_key_id: "",
  aliyun_captcha_access_key_secret: "",
  aliyun_captcha_access_key_secret_configured: false,
  aliyun_captcha_scene_id: "",
  aliyun_captcha_prefix: "",
  aliyun_captcha_region: "cn",
  api_key_acl_trust_forwarded_ip: true,
  forwarded_client_ip_headers: [],
  // LinuxDo Connect OAuth 登录
  linuxdo_connect_enabled: false,
  linuxdo_connect_client_id: "",
  linuxdo_connect_client_secret: "",
  linuxdo_connect_client_secret_configured: false,
  linuxdo_connect_redirect_url: "",
  // DingTalk Connect OAuth 登录
  dingtalk_connect_enabled: false,
  dingtalk_connect_client_id: "",
  dingtalk_connect_client_secret: "",
  dingtalk_connect_client_secret_configured: false,
  dingtalk_connect_redirect_url: "",
  dingtalk_connect_corp_restriction_policy: "none",
  dingtalk_connect_internal_corp_id: "",
  dingtalk_connect_bypass_registration: false,
  dingtalk_connect_sync_corp_email: false,
  dingtalk_connect_sync_display_name: false,
  dingtalk_connect_sync_dept: false,
  dingtalk_connect_sync_corp_email_attr_key: "dingtalk_email",
  dingtalk_connect_sync_display_name_attr_key: "dingtalk_name",
  dingtalk_connect_sync_dept_attr_key: "dingtalk_department",
  dingtalk_connect_sync_corp_email_attr_name: localText("钉钉企业邮箱", "DingTalk Corporate Email"),
  dingtalk_connect_sync_display_name_attr_name: localText("钉钉姓名", "DingTalk Name"),
  dingtalk_connect_sync_dept_attr_name: localText("钉钉部门", "DingTalk Department"),
  wechat_connect_enabled: false,
  wechat_connect_app_id: "",
  wechat_connect_app_secret: "",
  wechat_connect_app_secret_configured: false,
  wechat_connect_open_app_id: "",
  wechat_connect_open_app_secret: "",
  wechat_connect_open_app_secret_configured: false,
  wechat_connect_mp_app_id: "",
  wechat_connect_mp_app_secret: "",
  wechat_connect_mp_app_secret_configured: false,
  wechat_connect_mobile_app_id: "",
  wechat_connect_mobile_app_secret: "",
  wechat_connect_mobile_app_secret_configured: false,
  wechat_connect_open_enabled: false,
  wechat_connect_mp_enabled: false,
  wechat_connect_mobile_enabled: false,
  wechat_connect_mode: "open",
  wechat_connect_scopes: "snsapi_login",
  wechat_connect_redirect_url: "",
  wechat_connect_frontend_redirect_url: "/auth/wechat/callback",
  // Generic OIDC OAuth 登录
  oidc_connect_enabled: false,
  oidc_connect_provider_name: "OIDC",
  oidc_connect_client_id: "",
  oidc_connect_client_secret: "",
  oidc_connect_client_secret_configured: false,
  oidc_connect_issuer_url: "",
  oidc_connect_discovery_url: "",
  oidc_connect_authorize_url: "",
  oidc_connect_token_url: "",
  oidc_connect_userinfo_url: "",
  oidc_connect_jwks_url: "",
  oidc_connect_scopes: "openid email profile",
  oidc_connect_redirect_url: "",
  oidc_connect_frontend_redirect_url: "/auth/oidc/callback",
  oidc_connect_token_auth_method: "client_secret_post",
  oidc_connect_use_pkce: false,
  oidc_connect_validate_id_token: false,
  oidc_connect_allowed_signing_algs: "RS256,ES256,PS256",
  oidc_connect_clock_skew_seconds: 120,
  oidc_connect_require_email_verified: false,
  oidc_connect_userinfo_email_path: "",
  oidc_connect_userinfo_id_path: "",
  oidc_connect_userinfo_username_path: "",
  // GitHub / Google 邮箱快捷登录
  github_oauth_enabled: false,
  github_oauth_client_id: "",
  github_oauth_client_secret: "",
  github_oauth_client_secret_configured: false,
  github_oauth_redirect_url: "",
  github_oauth_frontend_redirect_url: "/auth/oauth/callback",
  google_oauth_enabled: false,
  google_oauth_client_id: "",
  google_oauth_client_secret: "",
  google_oauth_client_secret_configured: false,
  google_oauth_redirect_url: "",
  google_oauth_frontend_redirect_url: "/auth/oauth/callback",
  // Model fallback
  enable_model_fallback: false,
  fallback_model_anthropic: "claude-3-5-sonnet-20241022",
  fallback_model_openai: "gpt-4o",
  fallback_model_gemini: "gemini-2.5-pro",
  fallback_model_antigravity: "gemini-2.5-pro",
  grok_default_text_model: "grok-4.5",
  grok_cross_client_model_map_enabled: false,
  grok_default_base_url_mode: "cli",
  // Identity patch (Claude -> Gemini)
  enable_identity_patch: true,
  identity_patch_prompt: "",
  // Ops monitoring (vNext)
  ops_monitoring_enabled: true,
  ops_realtime_monitoring_enabled: true,
  ops_query_mode_default: "auto",
  ops_metrics_interval_seconds: 60,
  // Claude Code version check
  min_claude_code_version: "",
  max_claude_code_version: "",
  // 分组隔离
  allow_ungrouped_key_scheduling: false,
  openai_low_upstream_rate_priority_enabled: false,
  openai_oauth_scheduling_rate_multiplier: 1,
  openai_advanced_scheduler_enabled: false,
  openai_advanced_scheduler_sticky_weighted_enabled: false,
  openai_advanced_scheduler_subscription_priority_enabled: false,
  openai_advanced_scheduler_lb_top_k: "",
  openai_advanced_scheduler_weight_priority: "",
  openai_advanced_scheduler_weight_load: "",
  openai_advanced_scheduler_weight_queue: "",
  openai_advanced_scheduler_weight_error_rate: "",
  openai_advanced_scheduler_weight_ttft: "",
  openai_advanced_scheduler_weight_reset: "",
  openai_advanced_scheduler_weight_quota_headroom: "",
  openai_advanced_scheduler_weight_upstream_cost: "",
  openai_advanced_scheduler_weight_previous_response: "",
  openai_advanced_scheduler_weight_session_sticky: "",
  // Gateway forwarding behavior
  enable_fingerprint_unification: true,
  enable_metadata_passthrough: false,
  enable_cch_signing: false,
  enable_claude_oauth_system_prompt_injection: true,
  claude_oauth_system_prompt: "",
  claude_oauth_system_prompt_blocks: defaultClaudeOAuthSystemPromptBlocks,
  enable_anthropic_cache_ttl_1h_injection: false,
  rewrite_message_cache_control: false,
  enable_client_dateline_normalization: true,
  antigravity_user_agent_version: "",
  openai_codex_user_agent: "",
  openai_codex_client_version: "",
  // 只读展示：自动同步任务写入的官方最新稳定版，不参与提交（提交载荷按字段显式构造）
  openai_codex_client_version_synced: "",
  openai_codex_version_auto_sync_enabled: true,
  // codex_cli_only 加固
  min_codex_version: "",
  max_codex_version: "",
  codex_cli_only_blacklist: "",
  codex_cli_only_whitelist: "",
  codex_cli_only_allow_app_server_clients: false,
  codex_cli_only_engine_fingerprint_signals: "",
  // 余额、订阅到期与账号限额通知
  balance_low_notify_enabled: false,
  balance_low_notify_threshold: 0,
  balance_low_notify_recharge_url: "",
  subscription_expiry_notify_enabled: true,
  account_quota_notify_enabled: false,
  account_quota_notify_emails: [] as NotifyEmailEntry[],
  // Channel Monitor feature switch
  channel_monitor_enabled: true,
  channel_monitor_mode: 'v1' as 'v1' | 'v2',
  channel_monitor_default_interval_seconds: 60,
  channel_monitor_hide_throughput: false,
  // Available Channels feature switch
  available_channels_enabled: false,
  // Model Plaza feature switches + description
  model_plaza_enabled: false,
  model_plaza_require_auth: false,
  model_plaza_description: '',
  playground_enabled: true,
  // Affiliate (邀请返利) feature switch
  affiliate_enabled: false,
  // Allow user view error requests
  allow_user_view_error_requests: false,
});

// 人机验证 UI 状态：单卡片「总开关 + 服务商单选」，落库仍是三个独立
// enabled 键（与上游一致），由下面的映射保证同一时间至多一家启用。
type CaptchaProviderSelection = "turnstile" | "tencent" | "aliyun";

const captchaProviderSelection = ref<CaptchaProviderSelection>("turnstile");

function applyCaptchaSelection(provider: CaptchaProviderSelection | null): void {
  form.turnstile_enabled = provider === "turnstile";
  form.tencent_captcha_enabled = provider === "tencent";
  form.aliyun_captcha_enabled = provider === "aliyun";
}

const captchaMasterEnabled = computed({
  get: () =>
    form.turnstile_enabled ||
    form.tencent_captcha_enabled ||
    form.aliyun_captcha_enabled,
  set: (enabled: boolean) =>
    applyCaptchaSelection(enabled ? captchaProviderSelection.value : null),
});

function selectCaptchaProvider(provider: CaptchaProviderSelection): void {
  captchaProviderSelection.value = provider;
  applyCaptchaSelection(provider);
}

// 天御中国站与国际站是两套独立账号体系，控制台与文档入口不通用，
// 按当前选择的站点给出对应链接，避免管理员在错误的控制台里找不到 CaptchaAppId。
const tencentCaptchaLinks = computed(() =>
  form.tencent_captcha_region === "intl"
    ? {
        console: "https://console.tencentcloud.com/captcha/graphical",
        cloudKeys: "https://console.tencentcloud.com/cam/capi",
        webDocs: "https://www.tencentcloud.com/document/product/1159/49680",
      }
    : {
        console: "https://console.cloud.tencent.com/captcha",
        cloudKeys: "https://console.cloud.tencent.com/cam/capi",
        webDocs: "https://cloud.tencent.com/document/product/1110/36841",
      },
);

function syncCaptchaProviderSelection(): void {
  if (form.tencent_captcha_enabled) {
    captchaProviderSelection.value = "tencent";
  } else if (form.aliyun_captcha_enabled) {
    captchaProviderSelection.value = "aliyun";
  } else if (form.turnstile_enabled) {
    captchaProviderSelection.value = "turnstile";
  }
}

type OpenAIAdvancedSchedulerOverrideKey =
  | "openai_advanced_scheduler_lb_top_k"
  | "openai_advanced_scheduler_weight_priority"
  | "openai_advanced_scheduler_weight_load"
  | "openai_advanced_scheduler_weight_queue"
  | "openai_advanced_scheduler_weight_error_rate"
  | "openai_advanced_scheduler_weight_ttft"
  | "openai_advanced_scheduler_weight_reset"
  | "openai_advanced_scheduler_weight_quota_headroom"
  | "openai_advanced_scheduler_weight_upstream_cost"
  | "openai_advanced_scheduler_weight_previous_response"
  | "openai_advanced_scheduler_weight_session_sticky";

type OpenAIAdvancedSchedulerEffectiveKey =
  | "openai_advanced_scheduler_effective_lb_top_k"
  | "openai_advanced_scheduler_effective_weight_priority"
  | "openai_advanced_scheduler_effective_weight_load"
  | "openai_advanced_scheduler_effective_weight_queue"
  | "openai_advanced_scheduler_effective_weight_error_rate"
  | "openai_advanced_scheduler_effective_weight_ttft"
  | "openai_advanced_scheduler_effective_weight_reset"
  | "openai_advanced_scheduler_effective_weight_quota_headroom"
  | "openai_advanced_scheduler_effective_weight_upstream_cost"
  | "openai_advanced_scheduler_effective_weight_previous_response"
  | "openai_advanced_scheduler_effective_weight_session_sticky";

const openAIAdvancedSchedulerWeightFields = computed<
  Array<{
    key: OpenAIAdvancedSchedulerOverrideKey;
    label: string;
    placeholder: string;
  }>
>(() => {
  const placeholder = (
    effectiveKey: OpenAIAdvancedSchedulerEffectiveKey,
    fallbackValue: string,
  ) => {
    const effectiveValue = String(
      (form as Record<string, unknown>)[effectiveKey] ?? "",
    ).trim();
    return t("admin.settings.openaiExperimentalScheduler.defaultPlaceholder", {
      value: effectiveValue || fallbackValue,
    });
  };

  return [
    {
      key: "openai_advanced_scheduler_lb_top_k",
      label: t("admin.settings.openaiExperimentalScheduler.topKLabel"),
      placeholder: placeholder("openai_advanced_scheduler_effective_lb_top_k", "7"),
    },
    {
      key: "openai_advanced_scheduler_weight_priority",
      label: t("admin.settings.openaiExperimentalScheduler.priorityWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_priority", "1"),
    },
    {
      key: "openai_advanced_scheduler_weight_load",
      label: t("admin.settings.openaiExperimentalScheduler.loadWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_load", "1"),
    },
    {
      key: "openai_advanced_scheduler_weight_queue",
      label: t("admin.settings.openaiExperimentalScheduler.queueWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_queue", "0.7"),
    },
    {
      key: "openai_advanced_scheduler_weight_error_rate",
      label: t("admin.settings.openaiExperimentalScheduler.errorRateWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_error_rate", "0.8"),
    },
    {
      key: "openai_advanced_scheduler_weight_ttft",
      label: t("admin.settings.openaiExperimentalScheduler.ttftWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_ttft", "0.5"),
    },
    {
      key: "openai_advanced_scheduler_weight_reset",
      label: t("admin.settings.openaiExperimentalScheduler.resetWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_reset", "0"),
    },
    {
      key: "openai_advanced_scheduler_weight_quota_headroom",
      label: t("admin.settings.openaiExperimentalScheduler.quotaHeadroomWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_quota_headroom", "0"),
    },
    {
      key: "openai_advanced_scheduler_weight_upstream_cost",
      label: t("admin.settings.openaiExperimentalScheduler.upstreamCostWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_upstream_cost", "0"),
    },
    {
      key: "openai_advanced_scheduler_weight_previous_response",
      label: t("admin.settings.openaiExperimentalScheduler.previousResponseWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_previous_response", "5"),
    },
    {
      key: "openai_advanced_scheduler_weight_session_sticky",
      label: t("admin.settings.openaiExperimentalScheduler.sessionStickyWeight"),
      placeholder: placeholder("openai_advanced_scheduler_effective_weight_session_sticky", "3"),
    },
  ];
});

const authSourceDefaults = reactive<AuthSourceDefaultsState>(
  buildAuthSourceDefaultsState({}),
);

const authSourceDefaultsMeta = computed(() => [
  {
    source: "email" as AuthSourceType,
    title: t("admin.settings.authSourceDefaults.sources.email.title"),
    description: t("admin.settings.authSourceDefaults.sources.email.description"),
  },
  {
    source: "linuxdo" as AuthSourceType,
    title: t("admin.settings.authSourceDefaults.sources.linuxdo.title"),
    description: t("admin.settings.authSourceDefaults.sources.linuxdo.description"),
  },
  {
    source: "oidc" as AuthSourceType,
    title: t("admin.settings.authSourceDefaults.sources.oidc.title"),
    description: t("admin.settings.authSourceDefaults.sources.oidc.description"),
  },
  {
    source: "wechat" as AuthSourceType,
    title: t("admin.settings.authSourceDefaults.sources.wechat.title"),
    description: t("admin.settings.authSourceDefaults.sources.wechat.description"),
  },
  {
    source: "github" as AuthSourceType,
    title: "GitHub",
    description: localText(
      "通过 GitHub 已验证邮箱首次注册或首次绑定时应用。",
      "Applied on first signup or first bind through a verified GitHub email.",
    ),
  },
  {
    source: "google" as AuthSourceType,
    title: "Google",
    description: localText(
      "通过 Google 已验证邮箱首次注册或首次绑定时应用。",
      "Applied on first signup or first bind through a verified Google email.",
    ),
  },
  {
    source: "dingtalk" as AuthSourceType,
    title: t("auth.dingtalkProviderName"),
    description: localText(
      "通过钉钉首次注册或首次绑定时应用。",
      "Applied on first signup or first bind through DingTalk.",
    ),
  },
]);

// Proxies for web search emulation ProxySelector
const webSearchProxies = ref<Proxy[]>([]);

// Web Search Emulation config (loaded/saved separately)
const DEFAULT_WEB_SEARCH_QUOTA_LIMIT = 1000;

const webSearchConfig = reactive<WebSearchEmulationConfig>({
  enabled: false,
  providers: [],
});

const expandedProviders = reactive<Record<number, boolean>>({});
const apiKeyVisible = reactive<Record<number, boolean>>({});
const wsTestQuery = ref("");
const wsTestLoading = ref(false);
const wsTestResult = ref<WebSearchTestResult | null>(null);
const wsTestDialogOpen = ref(false);

function openTestDialog() {
  wsTestResult.value = null;
  wsTestDialogOpen.value = true;
}

function toggleProviderExpand(idx: number) {
  expandedProviders[idx] = !expandedProviders[idx];
}

function removeWebSearchProvider(idx: number) {
  webSearchConfig.providers.splice(idx, 1);
  // Re-index expandedProviders and apiKeyVisible after removal
  const newExpanded: Record<number, boolean> = {};
  const newVisible: Record<number, boolean> = {};
  for (let i = 0; i < webSearchConfig.providers.length; i++) {
    const oldIdx = i >= idx ? i + 1 : i;
    newExpanded[i] = expandedProviders[oldIdx] ?? false;
    newVisible[i] = apiKeyVisible[oldIdx] ?? false;
  }
  Object.keys(expandedProviders).forEach(
    (k) => delete expandedProviders[Number(k)],
  );
  Object.keys(apiKeyVisible).forEach((k) => delete apiKeyVisible[Number(k)]);
  Object.assign(expandedProviders, newExpanded);
  Object.assign(apiKeyVisible, newVisible);
}

function addWebSearchProvider() {
  const idx = webSearchConfig.providers.length;
  webSearchConfig.providers.push({
    type: "brave",
    api_key: "",
    api_key_configured: false,
    quota_limit: DEFAULT_WEB_SEARCH_QUOTA_LIMIT,
    subscribed_at: null,
    proxy_id: null,
    expires_at: null,
  } as WebSearchProviderConfig);
  expandedProviders[idx] = true;
}

function formatSubscribedAt(ts: number | null): string {
  if (!ts) return "";
  // Use UTC to avoid timezone drift on repeated edits
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseSubscribedAt(dateStr: string): number | null {
  if (!dateStr) return null;
  // Parse as UTC to match formatSubscribedAt
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

function quotaPercentage(provider: WebSearchProviderConfig): number {
  if (!provider.quota_limit || provider.quota_limit <= 0) return 0;
  return ((provider.quota_used ?? 0) / provider.quota_limit) * 100;
}

function resetWebSearchUsage(idx: number) {
  const provider = webSearchConfig.providers[idx];
  if (!provider) return;
  openSettingsConfirm(
    t("admin.settings.webSearchEmulation.title"),
    t("admin.settings.webSearchEmulation.resetUsageConfirm"),
    t("admin.settings.webSearchEmulation.resetUsage"),
    () => performResetWebSearchUsage(idx),
  );
}

async function performResetWebSearchUsage(idx: number) {
  const provider = webSearchConfig.providers[idx];
  if (!provider) return false;
  try {
    await adminAPI.settings.resetWebSearchUsage({
      provider_type: provider.type,
    });
    provider.quota_used = 0;
    appStore.showSuccess(
      t("admin.settings.webSearchEmulation.resetUsageSuccess"),
    );
    return true;
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
    return false;
  }
}

async function copyApiKey(idx: number) {
  const key = webSearchConfig.providers[idx]?.api_key;
  if (!key) {
    appStore.showError(
      t("admin.settings.webSearchEmulation.apiKeyPlaceholder"),
    );
    return;
  }
  try {
    await navigator.clipboard.writeText(key);
    appStore.showSuccess(t("admin.settings.webSearchEmulation.copied"));
  } catch {
    appStore.showError(t("common.error"));
  }
}

async function testWebSearchProvider() {
  wsTestLoading.value = true;
  wsTestResult.value = null;
  try {
    const query =
      wsTestQuery.value.trim() ||
      t("admin.settings.webSearchEmulation.testDefaultQuery");
    wsTestResult.value = await adminAPI.settings.testWebSearchEmulation(query);
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    wsTestLoading.value = false;
  }
}

async function loadWebSearchConfig() {
  try {
    const [resp, proxiesResp] = await Promise.all([
      adminAPI.settings.getWebSearchEmulationConfig(),
      adminAPI.proxies.list().catch(() => ({ items: [] as Proxy[] })),
    ]);
    if (resp) {
      webSearchConfig.enabled = resp.enabled || false;
      webSearchConfig.providers = resp.providers || [];
    }
    webSearchProxies.value = proxiesResp.items || [];
  } catch (err: unknown) {
    // 404 is expected when config hasn't been created yet; show error for other failures
    const status = (err as { status?: number })?.status;
    if (status !== 404 && status !== undefined) {
      appStore.showError(extractApiErrorMessage(err, t("common.error")));
    }
  }
}

async function saveWebSearchConfig(): Promise<boolean> {
  try {
    for (const p of webSearchConfig.providers) {
      const raw = p.quota_limit;
      if (raw != null && Number(raw) !== 0 && Number(raw) < 1) {
        appStore.showError(
          t("admin.settings.webSearchEmulation.quotaLimitMustBePositive"),
        );
        return false;
      }
    }
    const providers = webSearchConfig.providers.map(
      (p: WebSearchProviderConfig) => ({
        ...p,
        quota_limit: Number(p.quota_limit) > 0 ? Number(p.quota_limit) : null,
      }),
    );
    await adminAPI.settings.updateWebSearchEmulationConfig({
      enabled: webSearchConfig.enabled,
      providers,
    });
    return true;
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
    return false;
  }
}

const defaultSubscriptionPlanOptions = computed<
  DefaultSubscriptionPlanOption[]
>(() =>
  subscriptionPlans.value.map((plan) => ({
    value: plan.id,
    label: plan.name,
    groupSummary:
      plan.included_groups.map((group) => group.name).join(" / ") ||
      localText("未配置可用分组", "No included groups"),
  })),
);

const registrationEmailSuffixWhitelistSeparatorKeys = new Set([
  " ",
  ",",
  "，",
  "Enter",
  "Tab",
]);

function removeRegistrationEmailSuffixWhitelistTag(suffix: string) {
  registrationEmailSuffixWhitelistTags.value =
    registrationEmailSuffixWhitelistTags.value.filter(
      (item) => item !== suffix,
    );
}

function addRegistrationEmailSuffixWhitelistTag(raw: string) {
  const suffix = normalizeRegistrationEmailSuffixDomain(raw);
  if (
    !isRegistrationEmailSuffixDomainValid(suffix) ||
    registrationEmailSuffixWhitelistTags.value.includes(suffix)
  ) {
    return;
  }
  registrationEmailSuffixWhitelistTags.value = [
    ...registrationEmailSuffixWhitelistTags.value,
    suffix,
  ];
}

function commitRegistrationEmailSuffixWhitelistDraft() {
  if (!registrationEmailSuffixWhitelistDraft.value) {
    return;
  }
  addRegistrationEmailSuffixWhitelistTag(
    registrationEmailSuffixWhitelistDraft.value,
  );
  registrationEmailSuffixWhitelistDraft.value = "";
}

function handleRegistrationEmailSuffixWhitelistDraftInput() {
  registrationEmailSuffixWhitelistDraft.value =
    normalizeRegistrationEmailSuffixDomain(
      registrationEmailSuffixWhitelistDraft.value,
    );
}

function handleRegistrationEmailSuffixWhitelistDraftKeydown(
  event: KeyboardEvent,
) {
  if (event.isComposing) {
    return;
  }

  if (registrationEmailSuffixWhitelistSeparatorKeys.has(event.key)) {
    event.preventDefault();
    commitRegistrationEmailSuffixWhitelistDraft();
    return;
  }

  if (
    event.key === "Backspace" &&
    !registrationEmailSuffixWhitelistDraft.value &&
    registrationEmailSuffixWhitelistTags.value.length > 0
  ) {
    registrationEmailSuffixWhitelistTags.value.pop();
  }
}

function handleRegistrationEmailSuffixWhitelistPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text") || "";
  if (!text.trim()) {
    return;
  }
  event.preventDefault();
  const tokens = parseRegistrationEmailSuffixWhitelistInput(text);
  for (const token of tokens) {
    addRegistrationEmailSuffixWhitelistTag(token);
  }
}

const forwardedClientIpHeaderSeparatorKeys = new Set([
  " ",
  ",",
  "，",
  "Enter",
  "Tab",
]);
const forwardedClientIpHeaderTokenPattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const maxForwardedClientIpHeaders = 16;

type ForwardedClientIpHeaderResult = "added" | "duplicate" | "invalid" | "full";

function normalizeForwardedClientIpHeader(raw: string): string {
  const header = raw.trim();
  if (!forwardedClientIpHeaderTokenPattern.test(header)) {
    return "";
  }

  return header
    .toLowerCase()
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("-");
}

function normalizeForwardedClientIpHeaders(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const headers: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") {
      continue;
    }
    const header = normalizeForwardedClientIpHeader(raw);
    const key = header.toLowerCase();
    if (!header || seen.has(key) || headers.length >= maxForwardedClientIpHeaders) {
      continue;
    }
    seen.add(key);
    headers.push(header);
  }
  return headers;
}

function removeForwardedClientIpHeader(header: string) {
  form.forwarded_client_ip_headers = form.forwarded_client_ip_headers.filter(
    (item) => item !== header,
  );
}

function addForwardedClientIpHeader(raw: string): ForwardedClientIpHeaderResult {
  const header = normalizeForwardedClientIpHeader(raw);
  if (!header) {
    return "invalid";
  }
  if (
    form.forwarded_client_ip_headers.some(
      (item) => item.toLowerCase() === header.toLowerCase(),
    )
  ) {
    return "duplicate";
  }
  if (form.forwarded_client_ip_headers.length >= maxForwardedClientIpHeaders) {
    return "full";
  }
  form.forwarded_client_ip_headers = [
    ...form.forwarded_client_ip_headers,
    header,
  ];
  return "added";
}

function showForwardedClientIpHeaderError(result: ForwardedClientIpHeaderResult) {
  if (result === "invalid") {
    appStore.showError(t("admin.settings.apiKeyAcl.forwardedClientIpHeaderInvalid"));
  } else if (result === "full") {
    appStore.showError(
      t("admin.settings.apiKeyAcl.forwardedClientIpHeadersLimit", {
        max: maxForwardedClientIpHeaders,
      }),
    );
  }
}

function commitForwardedClientIpHeaderDraft() {
  const draft = forwardedClientIpHeaderDraft.value;
  if (!draft) {
    return;
  }
  const result = addForwardedClientIpHeader(draft);
  showForwardedClientIpHeaderError(result);
  forwardedClientIpHeaderDraft.value = "";
}

function handleForwardedClientIpHeaderKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }
  if (forwardedClientIpHeaderSeparatorKeys.has(event.key)) {
    event.preventDefault();
    commitForwardedClientIpHeaderDraft();
    return;
  }
  if (
    event.key === "Backspace" &&
    !forwardedClientIpHeaderDraft.value &&
    form.forwarded_client_ip_headers.length > 0
  ) {
    form.forwarded_client_ip_headers.pop();
  }
}

function handleForwardedClientIpHeaderPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text") || "";
  if (!text.trim()) {
    return;
  }
  event.preventDefault();

  let error: ForwardedClientIpHeaderResult | undefined;
  for (const token of text.split(/[,，;\r\n]+/)) {
    if (!token.trim()) {
      continue;
    }
    const result = addForwardedClientIpHeader(token);
    if (result === "invalid" || result === "full") {
      error = result;
    }
  }
  if (error) {
    showForwardedClientIpHeaderError(error);
  }
}

// Quota notify email helpers
const addQuotaNotifyEmail = () => {
  if (!form.account_quota_notify_emails) {
    form.account_quota_notify_emails = [];
  }
  form.account_quota_notify_emails.push({
    email: "",
    disabled: false,
    verified: true,
  });
};

const currentOrigin =
  typeof window !== "undefined" ? window.location.origin : "";

function buildApiCallbackUrl(path: string): string {
  const base = (form.api_base_url || currentOrigin).replace(/\/+$/, "");
  const apiRoot = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  return `${apiRoot}${path.startsWith("/") ? path : `/${path}`}`;
}

// LinuxDo OAuth redirect URL suggestion
const linuxdoRedirectUrlSuggestion = computed(() => {
  return buildApiCallbackUrl("/auth/oauth/linuxdo/callback");
});

async function setAndCopyLinuxdoRedirectUrl() {
  const url = linuxdoRedirectUrlSuggestion.value;
  if (!url) return;

  form.linuxdo_connect_redirect_url = url;
  await copyToClipboard(
    url,
    t("admin.settings.linuxdo.redirectUrlSetAndCopied"),
  );
}

type EmailOAuthProvider = "github" | "google";

const githubOAuthRedirectUrlSuggestion = computed(() => {
  return buildApiCallbackUrl("/auth/oauth/github/callback");
});

const googleOAuthRedirectUrlSuggestion = computed(() => {
  return buildApiCallbackUrl("/auth/oauth/google/callback");
});

async function setAndCopyEmailOAuthRedirectUrl(provider: EmailOAuthProvider) {
  const url =
    provider === "github"
      ? githubOAuthRedirectUrlSuggestion.value
      : googleOAuthRedirectUrlSuggestion.value;
  if (!url) return;

  if (provider === "github") {
    form.github_oauth_redirect_url = url;
  } else {
    form.google_oauth_redirect_url = url;
  }
  await copyToClipboard(
    url,
    localText("回调地址已写入并复制。", "Callback URL set and copied."),
  );
}

const wechatRedirectUrlSuggestion = computed(() => {
  return buildApiCallbackUrl("/auth/oauth/wechat/callback");
});

function syncWeChatConnectMode(preferredMode?: WeChatConnectMode) {
  if (form.wechat_connect_mp_enabled && form.wechat_connect_mobile_enabled) {
    if (preferredMode === "mobile") {
      form.wechat_connect_mp_enabled = false;
    } else {
      form.wechat_connect_mobile_enabled = false;
    }
  }

  const capabilities = resolveWeChatConnectModeCapabilities(
    form.wechat_connect_open_enabled,
    form.wechat_connect_mp_enabled,
    form.wechat_connect_mobile_enabled,
    form.wechat_connect_mode,
  );
  form.wechat_connect_open_enabled = capabilities.openEnabled;
  form.wechat_connect_mp_enabled = capabilities.mpEnabled;
  form.wechat_connect_mobile_enabled = capabilities.mobileEnabled;
  form.wechat_connect_mode = deriveWeChatConnectStoredMode(
    capabilities.openEnabled,
    capabilities.mpEnabled,
    capabilities.mobileEnabled,
    form.wechat_connect_mode,
  );
  form.wechat_connect_scopes = defaultWeChatConnectScopesForMode(
    form.wechat_connect_mode,
  );
}

function handleWeChatOpenEnabledChange(value: boolean) {
  form.wechat_connect_open_enabled = value;
  syncWeChatConnectMode(value ? "open" : undefined);
}

function handleWeChatMPEnabledChange(value: boolean) {
  form.wechat_connect_mp_enabled = value;
  if (value) {
    form.wechat_connect_mobile_enabled = false;
  }
  syncWeChatConnectMode(value ? "mp" : undefined);
}

function handleWeChatMobileEnabledChange(value: boolean) {
  form.wechat_connect_mobile_enabled = value;
  if (value) {
    form.wechat_connect_mp_enabled = false;
  }
  syncWeChatConnectMode(value ? "mobile" : undefined);
}

async function setAndCopyWeChatRedirectUrl() {
  const url = wechatRedirectUrlSuggestion.value;
  if (!url) return;

  form.wechat_connect_redirect_url = url;
  await copyToClipboard(
    url,
    t("admin.settings.wechatConnect.redirectUrlSetAndCopied"),
  );
}

const oidcRedirectUrlSuggestion = computed(() => {
  return buildApiCallbackUrl("/auth/oauth/oidc/callback");
});

async function setAndCopyOIDCRedirectUrl() {
  const url = oidcRedirectUrlSuggestion.value;
  if (!url) return;

  form.oidc_connect_redirect_url = url;
  await copyToClipboard(url, t("admin.settings.oidc.redirectUrlSetAndCopied"));
}

// Custom menu item management
function addMenuItem() {
  form.custom_menu_items.push({
    id: "",
    label: "",
    icon_svg: "",
    url: "",
    visibility: "user",
    sort_order: form.custom_menu_items.length,
  });
}

function removeMenuItem(index: number) {
  form.custom_menu_items.splice(index, 1);
  // Re-index sort_order
  form.custom_menu_items.forEach((item, i) => {
    item.sort_order = i;
  });
}

function moveMenuItem(index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= form.custom_menu_items.length) return;
  const items = form.custom_menu_items;
  const temp = items[index];
  items[index] = items[targetIndex];
  items[targetIndex] = temp;
  // Re-index sort_order
  items.forEach((item, i) => {
    item.sort_order = i;
  });
}

// Custom endpoint management
function addEndpoint() {
  form.custom_endpoints.push({ name: "", endpoint: "", description: "" });
}

function removeEndpoint(index: number) {
  form.custom_endpoints.splice(index, 1);
}

function addLoginAgreementDocument() {
  form.login_agreement_documents.push({
    id: `custom-${Date.now().toString(36)}`,
    title: "",
    content_md: "",
  });
}

function removeLoginAgreementDocument(index: number) {
  form.login_agreement_documents.splice(index, 1);
}

function normalizeLoginAgreementDocumentsForSave(): LoginAgreementDocument[] {
  return form.login_agreement_documents
    .map((doc, index) => ({
      id:
        normalizeLoginAgreementDocumentId(doc.id || doc.title) ||
        `doc-${index + 1}`,
      title: doc.title.trim(),
      content_md: doc.content_md.trim(),
    }))
    .filter((doc) => doc.title || doc.content_md);
}

function findDuplicateLoginAgreementDocumentId(
  documents: LoginAgreementDocument[],
): string | null {
  const seen = new Set<string>();
  for (const doc of documents) {
    if (seen.has(doc.id)) {
      return doc.id;
    }
    seen.add(doc.id);
  }
  return null;
}

function formatTablePageSizeOptions(options: number[]): string {
  return options.join(", ");
}

function parseTablePageSizeOptionsInput(raw: string): number[] | null {
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return null;
  }

  const parsed = tokens.map((token) => Number(token));
  if (parsed.some((value) => !Number.isInteger(value))) {
    return null;
  }

  const deduped = Array.from(new Set(parsed)).sort((a, b) => a - b);
  if (
    deduped.some(
      (value) => value < tablePageSizeMin || value > tablePageSizeMax,
    )
  ) {
    return null;
  }

  return deduped;
}

// ── codex_cli_only 黑/白名单结构化编辑（行  JSON）──
interface CodexClientRow {
  originator: string;
  uaContains: string; // 逗号分隔，序列化时拆成 ua_contains 数组
  skipEngineFingerprint?: boolean; // 仅白名单：命中即跳过引擎指纹门
}
const codexBlacklistRows = ref<CodexClientRow[]>([]);
const codexWhitelistRows = ref<CodexClientRow[]>([]);
const codexFingerprintRows = ref<FingerprintSignalRow[]>([]);
const codexFingerprintNoRequired = computed(
  () => !codexFingerprintRows.value.some((r) => r.required),
);
function addCodexFingerprintRow(): void {
  codexFingerprintRows.value.push({ type: "header_exact", match: "", required: false });
}
function removeCodexFingerprintRow(i: number): void {
  codexFingerprintRows.value.splice(i, 1);
}

function parseCodexEntriesToRows(raw: string): CodexClientRow[] {
  if (!raw || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((e) => ({
      originator: typeof e?.originator === "string" ? e.originator : "",
      uaContains: Array.isArray(e?.ua_contains)
        ? e.ua_contains
            .filter((x: unknown) => typeof x === "string")
            .join(", ")
        : "",
      skipEngineFingerprint: e?.skip_engine_fingerprint === true,
    }));
  } catch {
    return [];
  }
}

function serializeCodexRowsToJSON(rows: CodexClientRow[]): string {
  const entries = rows
    .map((r) => {
      const entry: {
        originator: string;
        ua_contains: string[];
        skip_engine_fingerprint?: boolean;
      } = {
        originator: r.originator.trim(),
        ua_contains: r.uaContains
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      };
      if (r.skipEngineFingerprint) entry.skip_engine_fingerprint = true;
      return entry;
    })
    .filter((e) => e.originator !== "" || e.ua_contains.length > 0);
  return entries.length > 0 ? JSON.stringify(entries) : "";
}

function addCodexBlacklistRow(): void {
  codexBlacklistRows.value.push({ originator: "", uaContains: "" });
}
function removeCodexBlacklistRow(i: number): void {
  codexBlacklistRows.value.splice(i, 1);
}
function addCodexWhitelistRow(): void {
  codexWhitelistRows.value.push({
    originator: "",
    uaContains: "",
    skipEngineFingerprint: false,
  });
}
function removeCodexWhitelistRow(i: number): void {
  codexWhitelistRows.value.splice(i, 1);
}

const codexSyncedVersionLabel = computed(() => {
  const synced = form.openai_codex_client_version_synced?.trim();
  if (!synced) return "";
  return t("admin.settings.gatewayForwarding.openaiCodexVersionSyncedValue", {
    version: synced,
  });
});

async function loadSettings() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const settings = await adminAPI.settings.getSettings();
    settings.payment_load_balance_strategy =
      settings.payment_load_balance_strategy || "round-robin";
    // Only assign non-null values from backend (null means unconfigured, keep defaults)
    for (const [key, value] of Object.entries(settings)) {
      if (value !== null && value !== undefined) {
        (form as Record<string, unknown>)[key] = value;
      }
    }
    syncCaptchaProviderSelection();
    if (!form.claude_oauth_system_prompt_blocks?.trim()) {
      form.claude_oauth_system_prompt_blocks =
        defaultClaudeOAuthSystemPromptBlocks;
    }
    claudeOAuthSystemPromptBlocks.value = parseClaudeOAuthSystemPromptBlocks(
      form.claude_oauth_system_prompt_blocks,
      form.claude_oauth_system_prompt,
    );
    syncClaudeOAuthSystemPromptBlocksFormField();
    codexBlacklistRows.value = parseCodexEntriesToRows(
      form.codex_cli_only_blacklist,
    );
    codexWhitelistRows.value = parseCodexEntriesToRows(
      form.codex_cli_only_whitelist,
    );
    codexFingerprintRows.value = form.codex_cli_only_engine_fingerprint_signals
      ? parseFingerprintSignalsToRows(form.codex_cli_only_engine_fingerprint_signals)
      : defaultFingerprintSignalRows();
    form.login_agreement_mode =
      settings.login_agreement_mode === "checkbox" ? "checkbox" : "modal";
    form.channel_monitor_mode =
      settings.channel_monitor_mode === "v2" ? "v2" : "v1";
    form.channel_monitor_hide_throughput = Boolean(
      settings.channel_monitor_hide_throughput
    );
    form.login_agreement_updated_at =
      settings.login_agreement_updated_at || "2026-03-31";
    form.login_agreement_documents =
      Array.isArray(settings.login_agreement_documents) &&
      settings.login_agreement_documents.length > 0
        ? settings.login_agreement_documents.map((doc) => ({
            id: doc.id || "",
            title: doc.title || "",
            content_md: doc.content_md || "",
          }))
        : defaultLoginAgreementDocuments();
    Object.assign(authSourceDefaults, buildAuthSourceDefaultsState(settings));
    form.default_platform_quotas = normalizePlatformQuotasMap(settings.default_platform_quotas);
    form.account_scheduling_thresholds = normalizeAccountSchedulingThresholdsMap(
      settings.account_scheduling_thresholds,
    );
    form.backend_mode_enabled = settings.backend_mode_enabled;
    form.default_subscriptions = normalizeDefaultSubscriptionSettings(
      settings.default_subscriptions,
    );
    registrationEmailSuffixWhitelistTags.value =
      normalizeRegistrationEmailSuffixDomains(
        settings.registration_email_suffix_whitelist,
      );
    form.forwarded_client_ip_headers = normalizeForwardedClientIpHeaders(
      settings.forwarded_client_ip_headers,
    );
    forwardedClientIpHeaderDraft.value = "";
    tablePageSizeOptionsInput.value = formatTablePageSizeOptions(
      Array.isArray(settings.table_page_size_options)
        ? settings.table_page_size_options
        : [10, 20, 50, 100],
    );
    registrationEmailSuffixWhitelistDraft.value = "";
    form.smtp_password = "";
    smtpPasswordManuallyEdited.value = false;
    form.turnstile_secret_key = "";
    form.tencent_captcha_app_secret_key = "";
    form.tencent_captcha_cloud_secret_id = "";
    form.tencent_captcha_cloud_secret_key = "";
    form.aliyun_captcha_access_key_secret = "";
    form.linuxdo_connect_client_secret = "";
    form.dingtalk_connect_client_secret = "";
    form.github_oauth_client_secret = "";
    form.google_oauth_client_secret = "";
    form.wechat_connect_app_secret = "";
    form.wechat_connect_open_app_secret = "";
    form.wechat_connect_mp_app_secret = "";
    form.wechat_connect_mobile_app_secret = "";
    const wechatCapabilities = resolveWeChatConnectModeCapabilities(
      settings.wechat_connect_open_enabled,
      settings.wechat_connect_mp_enabled,
      settings.wechat_connect_mobile_enabled,
      settings.wechat_connect_mode,
    );
    form.wechat_connect_open_enabled = wechatCapabilities.openEnabled;
    form.wechat_connect_mp_enabled = wechatCapabilities.mpEnabled;
    form.wechat_connect_mobile_enabled = wechatCapabilities.mobileEnabled;
    form.wechat_connect_mode = deriveWeChatConnectStoredMode(
      wechatCapabilities.openEnabled,
      wechatCapabilities.mpEnabled,
      wechatCapabilities.mobileEnabled,
      settings.wechat_connect_mode,
    );
    const legacyWeChatAppID = String(settings.wechat_connect_app_id || "").trim();
    const legacyWeChatSecretConfigured = Boolean(
      settings.wechat_connect_app_secret_configured,
    );
    if (!form.wechat_connect_open_app_id && wechatCapabilities.openEnabled) {
      form.wechat_connect_open_app_id = legacyWeChatAppID;
    }
    if (!form.wechat_connect_mp_app_id && wechatCapabilities.mpEnabled) {
      form.wechat_connect_mp_app_id = legacyWeChatAppID;
    }
    if (!form.wechat_connect_mobile_app_id && wechatCapabilities.mobileEnabled) {
      form.wechat_connect_mobile_app_id = legacyWeChatAppID;
    }
    if (
      !form.wechat_connect_open_app_secret_configured &&
      wechatCapabilities.openEnabled
    ) {
      form.wechat_connect_open_app_secret_configured =
        legacyWeChatSecretConfigured;
    }
    if (
      !form.wechat_connect_mp_app_secret_configured &&
      wechatCapabilities.mpEnabled
    ) {
      form.wechat_connect_mp_app_secret_configured = legacyWeChatSecretConfigured;
    }
    if (
      !form.wechat_connect_mobile_app_secret_configured &&
      wechatCapabilities.mobileEnabled
    ) {
      form.wechat_connect_mobile_app_secret_configured =
        legacyWeChatSecretConfigured;
    }
    form.wechat_connect_scopes = defaultWeChatConnectScopesForMode(
      form.wechat_connect_mode,
    );
    form.oidc_connect_client_secret = "";

    // Load OpenAI fast/flex policy rules from bulk settings.
    // 仅当 payload 真的包含该字段时填充并标记为已加载；否则保持表单空值，
    // 让 saveSettings 在未加载时跳过该字段，防止覆盖后端默认规则。
    if (
      settings.openai_fast_policy_settings &&
      Array.isArray(settings.openai_fast_policy_settings.rules)
    ) {
      openaiFastPolicyForm.rules =
        settings.openai_fast_policy_settings.rules.map((rule) => ({
          ...rule,
          user_ids: rule.user_ids ? [...rule.user_ids] : [],
          model_whitelist: rule.model_whitelist
            ? [...rule.model_whitelist]
            : [],
        }));
      openaiFastPolicyLoaded.value = true;
    }

    // Load web search emulation config separately
    await loadWebSearchConfig();
  } catch (error: unknown) {
    loadFailed.value = true;
    appStore.showError(
      extractApiErrorMessage(error, t("admin.settings.failedToLoad")),
    );
  } finally {
    loading.value = false;
  }
}

async function loadSubscriptionPlans() {
  try {
    const response = await adminAPI.payment.getPlans();
    subscriptionPlans.value = response.data ?? [];
  } catch (_error: unknown) {
    subscriptionPlans.value = [];
  }
}

function findNextAvailableSubscriptionPlan(
  existingPlanIDs: number[],
): SubscriptionPlan | undefined {
  const existing = new Set(existingPlanIDs);
  return subscriptionPlans.value.find((plan) => !existing.has(plan.id));
}

function addDefaultSubscription() {
  if (subscriptionPlans.value.length === 0) return;
  const candidate = findNextAvailableSubscriptionPlan(
    form.default_subscriptions.map((item) => item.plan_id),
  );
  if (!candidate) return;
  form.default_subscriptions.push({
    plan_id: candidate.id,
    validity_days: candidate.validity_days,
  });
}

function removeDefaultSubscription(index: number) {
  form.default_subscriptions.splice(index, 1);
}

function addAuthSourceDefaultSubscription(source: AuthSourceType) {
  if (subscriptionPlans.value.length === 0) return;
  const candidate = findNextAvailableSubscriptionPlan(
    authSourceDefaults[source].subscriptions.map((item) => item.plan_id),
  );
  if (!candidate) return;
  authSourceDefaults[source].subscriptions.push({
    plan_id: candidate.id,
    validity_days: candidate.validity_days,
  });
}

function removeAuthSourceDefaultSubscription(
  source: AuthSourceType,
  index: number,
) {
  authSourceDefaults[source].subscriptions.splice(index, 1);
}

function findDuplicateDefaultSubscription(
  subscriptions: DefaultSubscriptionSetting[],
): DefaultSubscriptionSetting | undefined {
  const seenPlanIDs = new Set<number>();

  return subscriptions.find((item) => {
    if (seenPlanIDs.has(item.plan_id)) {
      return true;
    }
    seenPlanIDs.add(item.plan_id);
    return false;
  });
}

async function saveSettings() {
  if (saving.value) return;
  saving.value = true;
  try {
    const normalizedTableDefaultPageSize = Math.floor(
      Number(form.table_default_page_size),
    );
    if (
      !Number.isInteger(normalizedTableDefaultPageSize) ||
      normalizedTableDefaultPageSize < tablePageSizeMin ||
      normalizedTableDefaultPageSize > tablePageSizeMax
    ) {
      appStore.showError(
        t("admin.settings.site.tableDefaultPageSizeRangeError", {
          min: tablePageSizeMin,
          max: tablePageSizeMax,
        }),
      );
      return;
    }

    const normalizedTablePageSizeOptions = parseTablePageSizeOptionsInput(
      tablePageSizeOptionsInput.value,
    );
    if (!normalizedTablePageSizeOptions) {
      appStore.showError(
        t("admin.settings.site.tablePageSizeOptionsFormatError", {
          min: tablePageSizeMin,
          max: tablePageSizeMax,
        }),
      );
      return;
    }

    form.table_default_page_size = normalizedTableDefaultPageSize;
    form.table_page_size_options = normalizedTablePageSizeOptions;

    const normalizedLoginAgreementDocuments =
      normalizeLoginAgreementDocumentsForSave();
    if (form.login_agreement_enabled && normalizedLoginAgreementDocuments.length === 0) {
      appStore.showError(
        localText(
          "启用登录条款确认时，至少需要保留一份文档。",
          "At least one document is required when login agreement is enabled.",
        ),
      );
      return;
    }
    const emptyTitleDocument = normalizedLoginAgreementDocuments.find(
      (doc) => !doc.title,
    );
    if (emptyTitleDocument) {
      appStore.showError(
        localText(
          "登录条款文档名称不能为空。",
          "Login agreement document title cannot be empty.",
        ),
      );
      return;
    }
    const duplicateLoginAgreementDocumentId =
      findDuplicateLoginAgreementDocumentId(normalizedLoginAgreementDocuments);
    if (duplicateLoginAgreementDocumentId) {
      appStore.showError(
        localText(
          `登录条款文档路由不能重复：/legal/${duplicateLoginAgreementDocumentId}`,
          `Login agreement document routes cannot be duplicated: /legal/${duplicateLoginAgreementDocumentId}`,
        ),
      );
      return;
    }
    form.login_agreement_mode =
      form.login_agreement_mode === "checkbox" ? "checkbox" : "modal";
    form.login_agreement_documents = normalizedLoginAgreementDocuments;
    form.forwarded_client_ip_headers = normalizeForwardedClientIpHeaders(
      form.forwarded_client_ip_headers,
    );

    const normalizedDefaultSubscriptions = normalizeDefaultSubscriptionSettings(
      form.default_subscriptions,
    );
    const duplicateDefaultSubscription = findDuplicateDefaultSubscription(
      normalizedDefaultSubscriptions,
    );
    if (duplicateDefaultSubscription) {
      appStore.showError(
        t("admin.settings.defaults.defaultSubscriptionsDuplicate", {
          planId: duplicateDefaultSubscription.plan_id,
        }),
      );
      return;
    }

    for (const authSource of authSourceDefaultsMeta.value) {
      authSourceDefaults[authSource.source].subscriptions =
        normalizeDefaultSubscriptionSettings(
          authSourceDefaults[authSource.source].subscriptions,
        );
      const duplicate = findDuplicateDefaultSubscription(
        authSourceDefaults[authSource.source].subscriptions,
      );
      if (duplicate) {
        appStore.showError(
          `${authSource.title}: ${t(
            "admin.settings.defaults.defaultSubscriptionsDuplicate",
            {
              planId: duplicate.plan_id,
            },
          )}`,
        );
        return;
      }
    }

    if (form.wechat_connect_mp_enabled && form.wechat_connect_mobile_enabled) {
      appStore.showError(
        localText(
          "公众号和移动应用不能同时启用。",
          "Official Account and Mobile App cannot be enabled at the same time.",
        ),
      );
      return;
    }
    // Validate URL fields — novalidate disables browser-native checks, so we validate here
    const isValidHttpUrl = (url: string): boolean => {
      if (!url) return true;
      try {
        const u = new URL(url);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    };
    // Optional URL fields: auto-clear invalid values so they don't cause backend 400 errors
    if (!isValidHttpUrl(form.frontend_url)) form.frontend_url = "";
    if (!isValidHttpUrl(form.doc_url)) form.doc_url = "";
    syncWeChatConnectMode();
    const wechatStoredMode = deriveWeChatConnectStoredMode(
      form.wechat_connect_open_enabled,
      form.wechat_connect_mp_enabled,
      form.wechat_connect_mobile_enabled,
      form.wechat_connect_mode,
    );
    const claudeOAuthSystemPromptBlocksJSON =
      serializeClaudeOAuthSystemPromptBlocksToJSON(
        claudeOAuthSystemPromptBlocks.value,
      );
    form.claude_oauth_system_prompt_blocks =
      claudeOAuthSystemPromptBlocksJSON;

    const payload: UpdateSettingsRequest = {
      registration_enabled: form.registration_enabled,
      email_verify_enabled: form.email_verify_enabled,
      registration_email_suffix_whitelist:
        registrationEmailSuffixWhitelistTags.value.map((suffix) =>
          suffix.startsWith("*.") ? suffix : `@${suffix}`,
        ),
      registration_email_domain_quota_enabled:
        form.registration_email_domain_quota_enabled,
      promo_code_enabled: form.promo_code_enabled,
      invitation_code_enabled: form.invitation_code_enabled,
      password_reset_enabled: form.password_reset_enabled,
      totp_enabled: form.totp_enabled,
      passkey_enabled: form.passkey_enabled,
      session_binding_enabled: form.session_binding_enabled,
      step_up_enabled: form.step_up_enabled,
      // 清空数字框时 v-model.number 会得到空串，后端 int 字段解析空串会 400 拒绝整次保存；
      // 空/非法值回退默认 180（与后端 parseAuditLogRetentionDays("") 语义一致，0 仍表示永久保留）。
      audit_log_retention_days: Number.isFinite(form.audit_log_retention_days)
        ? form.audit_log_retention_days
        : 180,
      login_agreement_enabled: form.login_agreement_enabled,
      login_agreement_mode: form.login_agreement_mode,
      login_agreement_updated_at: form.login_agreement_updated_at,
      login_agreement_documents: form.login_agreement_documents,
      default_balance: form.default_balance,
      affiliate_rebate_rate: Math.min(
        100,
        Math.max(0, Number(form.affiliate_rebate_rate) || 0),
      ),
      affiliate_rebate_freeze_hours: Math.max(0, Math.min(720, Number(form.affiliate_rebate_freeze_hours) || 0)),
      affiliate_rebate_duration_days: Math.max(0, Math.min(3650, Math.floor(Number(form.affiliate_rebate_duration_days) || 0))),
      affiliate_rebate_per_invitee_cap: Math.max(0, Number(form.affiliate_rebate_per_invitee_cap) || 0),
      affiliate_admin_recharge_enabled: form.affiliate_admin_recharge_enabled,
      default_concurrency: form.default_concurrency,
      default_subscriptions: normalizedDefaultSubscriptions,
      force_email_on_third_party_signup: form.force_email_on_third_party_signup,
      default_user_rpm_limit: form.default_user_rpm_limit,
      site_name: form.site_name,
      site_logo: form.site_logo,
      site_icon: form.site_icon,
      site_subtitle: form.site_subtitle,
      api_base_url: form.api_base_url,
      contact_info: form.contact_info,
      doc_url: form.doc_url,
      home_content: form.home_content,
      compact_home_enabled: form.compact_home_enabled,
      backend_mode_enabled: form.backend_mode_enabled,
      hide_ccs_import_button: form.hide_ccs_import_button,
      table_default_page_size: form.table_default_page_size,
      table_page_size_options: form.table_page_size_options,
      custom_menu_items: form.custom_menu_items,
      custom_endpoints: form.custom_endpoints,
      frontend_url: form.frontend_url,
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_username: form.smtp_username,
      smtp_password: form.smtp_password || undefined,
      smtp_from_email: form.smtp_from_email,
      smtp_from_name: form.smtp_from_name,
      smtp_use_tls: form.smtp_use_tls,
      turnstile_enabled: form.turnstile_enabled,
      turnstile_site_key: form.turnstile_site_key,
      turnstile_secret_key: form.turnstile_secret_key || undefined,
      tencent_captcha_enabled: form.tencent_captcha_enabled,
      tencent_captcha_app_id: form.tencent_captcha_app_id,
      tencent_captcha_app_secret_key:
        form.tencent_captcha_app_secret_key || undefined,
      tencent_captcha_cloud_secret_id:
        form.tencent_captcha_cloud_secret_id || undefined,
      tencent_captcha_cloud_secret_key:
        form.tencent_captcha_cloud_secret_key || undefined,
      tencent_captcha_region: form.tencent_captcha_region,
      aliyun_captcha_enabled: form.aliyun_captcha_enabled,
      aliyun_captcha_access_key_id: form.aliyun_captcha_access_key_id,
      aliyun_captcha_access_key_secret:
        form.aliyun_captcha_access_key_secret || undefined,
      aliyun_captcha_scene_id: form.aliyun_captcha_scene_id,
      aliyun_captcha_prefix: form.aliyun_captcha_prefix,
      aliyun_captcha_region: form.aliyun_captcha_region,
      api_key_acl_trust_forwarded_ip: form.api_key_acl_trust_forwarded_ip,
      forwarded_client_ip_headers: form.forwarded_client_ip_headers,
      linuxdo_connect_enabled: form.linuxdo_connect_enabled,
      linuxdo_connect_client_id: form.linuxdo_connect_client_id,
      linuxdo_connect_client_secret:
        form.linuxdo_connect_client_secret || undefined,
      linuxdo_connect_redirect_url: form.linuxdo_connect_redirect_url,
      dingtalk_connect_enabled: form.dingtalk_connect_enabled,
      dingtalk_connect_client_id: form.dingtalk_connect_client_id,
      dingtalk_connect_client_secret:
        form.dingtalk_connect_client_secret || undefined,
      dingtalk_connect_redirect_url: form.dingtalk_connect_redirect_url,
      dingtalk_connect_corp_restriction_policy:
        form.dingtalk_connect_corp_restriction_policy,
      dingtalk_connect_internal_corp_id: form.dingtalk_connect_internal_corp_id,
      dingtalk_connect_bypass_registration: form.dingtalk_connect_bypass_registration,
      dingtalk_connect_sync_corp_email: form.dingtalk_connect_sync_corp_email,
      dingtalk_connect_sync_display_name: form.dingtalk_connect_sync_display_name,
      dingtalk_connect_sync_dept: form.dingtalk_connect_sync_dept,
      dingtalk_connect_sync_corp_email_attr_key: form.dingtalk_connect_sync_corp_email_attr_key,
      dingtalk_connect_sync_display_name_attr_key: form.dingtalk_connect_sync_display_name_attr_key,
      dingtalk_connect_sync_dept_attr_key: form.dingtalk_connect_sync_dept_attr_key,
      dingtalk_connect_sync_corp_email_attr_name: form.dingtalk_connect_sync_corp_email_attr_name,
      dingtalk_connect_sync_display_name_attr_name: form.dingtalk_connect_sync_display_name_attr_name,
      dingtalk_connect_sync_dept_attr_name: form.dingtalk_connect_sync_dept_attr_name,
      wechat_connect_enabled: form.wechat_connect_enabled,
      wechat_connect_app_id:
        form.wechat_connect_open_app_id ||
        form.wechat_connect_mp_app_id ||
        form.wechat_connect_mobile_app_id ||
        form.wechat_connect_app_id,
      wechat_connect_app_secret: form.wechat_connect_app_secret || undefined,
      wechat_connect_open_app_id: form.wechat_connect_open_app_id,
      wechat_connect_open_app_secret:
        form.wechat_connect_open_app_secret || undefined,
      wechat_connect_mp_app_id: form.wechat_connect_mp_app_id,
      wechat_connect_mp_app_secret:
        form.wechat_connect_mp_app_secret || undefined,
      wechat_connect_mobile_app_id: form.wechat_connect_mobile_app_id,
      wechat_connect_mobile_app_secret:
        form.wechat_connect_mobile_app_secret || undefined,
      wechat_connect_open_enabled: form.wechat_connect_open_enabled,
      wechat_connect_mp_enabled: form.wechat_connect_mp_enabled,
      wechat_connect_mobile_enabled: form.wechat_connect_mobile_enabled,
      wechat_connect_mode: wechatStoredMode,
      wechat_connect_scopes:
        defaultWeChatConnectScopesForMode(wechatStoredMode),
      wechat_connect_redirect_url: form.wechat_connect_redirect_url,
      wechat_connect_frontend_redirect_url:
        form.wechat_connect_frontend_redirect_url,
      oidc_connect_enabled: form.oidc_connect_enabled,
      oidc_connect_provider_name: form.oidc_connect_provider_name,
      oidc_connect_client_id: form.oidc_connect_client_id,
      oidc_connect_client_secret: form.oidc_connect_client_secret || undefined,
      oidc_connect_issuer_url: form.oidc_connect_issuer_url,
      oidc_connect_discovery_url: form.oidc_connect_discovery_url,
      oidc_connect_authorize_url: form.oidc_connect_authorize_url,
      oidc_connect_token_url: form.oidc_connect_token_url,
      oidc_connect_userinfo_url: form.oidc_connect_userinfo_url,
      oidc_connect_jwks_url: form.oidc_connect_jwks_url,
      oidc_connect_scopes: form.oidc_connect_scopes,
      oidc_connect_redirect_url: form.oidc_connect_redirect_url,
      oidc_connect_frontend_redirect_url:
        form.oidc_connect_frontend_redirect_url,
      oidc_connect_token_auth_method: form.oidc_connect_token_auth_method,
      oidc_connect_use_pkce: form.oidc_connect_use_pkce,
      oidc_connect_validate_id_token: form.oidc_connect_validate_id_token,
      oidc_connect_allowed_signing_algs: form.oidc_connect_allowed_signing_algs,
      oidc_connect_clock_skew_seconds: form.oidc_connect_clock_skew_seconds,
      oidc_connect_require_email_verified:
        form.oidc_connect_require_email_verified,
      oidc_connect_userinfo_email_path: form.oidc_connect_userinfo_email_path,
      oidc_connect_userinfo_id_path: form.oidc_connect_userinfo_id_path,
      oidc_connect_userinfo_username_path:
        form.oidc_connect_userinfo_username_path,
      github_oauth_enabled: form.github_oauth_enabled,
      github_oauth_client_id: form.github_oauth_client_id,
      github_oauth_client_secret:
        form.github_oauth_client_secret || undefined,
      github_oauth_redirect_url: form.github_oauth_redirect_url,
      github_oauth_frontend_redirect_url:
        form.github_oauth_frontend_redirect_url,
      google_oauth_enabled: form.google_oauth_enabled,
      google_oauth_client_id: form.google_oauth_client_id,
      google_oauth_client_secret:
        form.google_oauth_client_secret || undefined,
      google_oauth_redirect_url: form.google_oauth_redirect_url,
      google_oauth_frontend_redirect_url:
        form.google_oauth_frontend_redirect_url,
      enable_model_fallback: form.enable_model_fallback,
      fallback_model_anthropic: form.fallback_model_anthropic,
      fallback_model_openai: form.fallback_model_openai,
      fallback_model_gemini: form.fallback_model_gemini,
      fallback_model_antigravity: form.fallback_model_antigravity,
      grok_default_text_model:
        form.grok_default_text_model.trim() || "grok-4.5",
      grok_cross_client_model_map_enabled:
        form.grok_cross_client_model_map_enabled,
      grok_default_base_url_mode: form.grok_default_base_url_mode,
      enable_identity_patch: form.enable_identity_patch,
      identity_patch_prompt: form.identity_patch_prompt,
      min_claude_code_version: form.min_claude_code_version,
      max_claude_code_version: form.max_claude_code_version,
      allow_ungrouped_key_scheduling: form.allow_ungrouped_key_scheduling,
      enable_fingerprint_unification: form.enable_fingerprint_unification,
      enable_metadata_passthrough: form.enable_metadata_passthrough,
      enable_cch_signing: form.enable_cch_signing,
      enable_claude_oauth_system_prompt_injection:
        form.enable_claude_oauth_system_prompt_injection,
      claude_oauth_system_prompt: form.claude_oauth_system_prompt?.trim()
        ? form.claude_oauth_system_prompt
        : "",
      claude_oauth_system_prompt_blocks: claudeOAuthSystemPromptBlocksJSON,
      enable_anthropic_cache_ttl_1h_injection:
        form.enable_anthropic_cache_ttl_1h_injection,
      rewrite_message_cache_control: form.rewrite_message_cache_control,
      enable_client_dateline_normalization:
        form.enable_client_dateline_normalization,
      antigravity_user_agent_version:
        form.antigravity_user_agent_version?.trim() || "",
      openai_codex_user_agent:
        form.openai_codex_user_agent?.trim() || "",
      openai_codex_client_version:
        form.openai_codex_client_version?.trim() || "",
      openai_codex_version_auto_sync_enabled:
        form.openai_codex_version_auto_sync_enabled,
      min_codex_version: form.min_codex_version?.trim() || "",
      max_codex_version: form.max_codex_version?.trim() || "",
      codex_cli_only_allow_app_server_clients:
        form.codex_cli_only_allow_app_server_clients,
      codex_cli_only_engine_fingerprint_signals: serializeFingerprintRowsToJSON(
        codexFingerprintRows.value,
      ),
      codex_cli_only_blacklist: serializeCodexRowsToJSON(
        codexBlacklistRows.value,
      ),
      codex_cli_only_whitelist: serializeCodexRowsToJSON(
        codexWhitelistRows.value,
      ),
      // Payment configuration
      payment_enabled: form.payment_enabled,
      risk_control_enabled: form.risk_control_enabled,
      cyber_session_block_enabled: form.cyber_session_block_enabled,
      cyber_session_block_ttl_seconds:
        Number(form.cyber_session_block_ttl_seconds) || 3600,
      payment_min_amount: Number(form.payment_min_amount) || 0,
      payment_max_amount: Number(form.payment_max_amount) || 0,
      payment_daily_limit: Number(form.payment_daily_limit) || 0,
      payment_max_pending_orders: Number(form.payment_max_pending_orders) || 0,
      payment_order_timeout_minutes:
        Number(form.payment_order_timeout_minutes) || 0,
      payment_balance_disabled: form.payment_balance_disabled,
      payment_balance_recharge_multiplier:
        Number(form.payment_balance_recharge_multiplier) || 1,
      payment_subscription_usd_to_cny_rate:
        Number(form.payment_subscription_usd_to_cny_rate) || 0,
      payment_recharge_fee_rate: Number(form.payment_recharge_fee_rate) || 0,
      payment_enabled_types: form.payment_enabled_types,
      payment_load_balance_strategy: form.payment_load_balance_strategy,
      payment_product_name_prefix: form.payment_product_name_prefix,
      payment_product_name_suffix: form.payment_product_name_suffix,
      payment_help_image_url: form.payment_help_image_url,
      payment_help_text: form.payment_help_text,
      payment_cancel_rate_limit_enabled: form.payment_cancel_rate_limit_enabled,
      payment_cancel_rate_limit_max:
        Number(form.payment_cancel_rate_limit_max) || 10,
      payment_cancel_rate_limit_window:
        Number(form.payment_cancel_rate_limit_window) || 1,
      payment_cancel_rate_limit_unit: form.payment_cancel_rate_limit_unit,
      payment_cancel_rate_limit_window_mode:
        form.payment_cancel_rate_limit_window_mode,
      payment_alipay_force_qrcode: form.payment_alipay_force_qrcode,
      payment_alipay_mobile_precreate_deep_link:
        form.payment_alipay_mobile_precreate_deep_link,
      openai_low_upstream_rate_priority_enabled:
        form.openai_low_upstream_rate_priority_enabled,
      openai_oauth_scheduling_rate_multiplier:
        form.openai_oauth_scheduling_rate_multiplier,
      openai_advanced_scheduler_enabled: form.openai_advanced_scheduler_enabled,
      openai_advanced_scheduler_sticky_weighted_enabled:
        form.openai_advanced_scheduler_sticky_weighted_enabled,
      openai_advanced_scheduler_subscription_priority_enabled:
        form.openai_advanced_scheduler_subscription_priority_enabled,
      openai_advanced_scheduler_lb_top_k:
        form.openai_advanced_scheduler_lb_top_k.trim(),
      openai_advanced_scheduler_weight_priority:
        form.openai_advanced_scheduler_weight_priority.trim(),
      openai_advanced_scheduler_weight_load:
        form.openai_advanced_scheduler_weight_load.trim(),
      openai_advanced_scheduler_weight_queue:
        form.openai_advanced_scheduler_weight_queue.trim(),
      openai_advanced_scheduler_weight_error_rate:
        form.openai_advanced_scheduler_weight_error_rate.trim(),
      openai_advanced_scheduler_weight_ttft:
        form.openai_advanced_scheduler_weight_ttft.trim(),
      openai_advanced_scheduler_weight_reset:
        form.openai_advanced_scheduler_weight_reset.trim(),
      openai_advanced_scheduler_weight_quota_headroom:
        form.openai_advanced_scheduler_weight_quota_headroom.trim(),
      openai_advanced_scheduler_weight_upstream_cost:
        form.openai_advanced_scheduler_weight_upstream_cost.trim(),
      openai_advanced_scheduler_weight_previous_response:
        form.openai_advanced_scheduler_weight_previous_response.trim(),
      openai_advanced_scheduler_weight_session_sticky:
        form.openai_advanced_scheduler_weight_session_sticky.trim(),
      // 余额、订阅到期与账号限额通知
      balance_low_notify_enabled: form.balance_low_notify_enabled,
      balance_low_notify_threshold:
        Number(form.balance_low_notify_threshold) || 0,
      balance_low_notify_recharge_url: (form.balance_low_notify_recharge_url =
        form.balance_low_notify_recharge_url || currentOrigin),
      subscription_expiry_notify_enabled:
        form.subscription_expiry_notify_enabled,
      account_quota_notify_enabled: form.account_quota_notify_enabled,
      account_quota_notify_emails: (
        form.account_quota_notify_emails || []
      ).filter((e) => e.email.trim() !== ""),
      // Channel Monitor feature switch
      channel_monitor_enabled: form.channel_monitor_enabled,
      channel_monitor_mode: form.channel_monitor_mode === 'v1' ? 'v1' : 'v2',
      channel_monitor_default_interval_seconds:
        Number(form.channel_monitor_default_interval_seconds) || 60,
      channel_monitor_hide_throughput: Boolean(form.channel_monitor_hide_throughput),
      // Available Channels feature switch
      available_channels_enabled: form.available_channels_enabled,
      // Model Plaza feature switches + description
      model_plaza_enabled: form.model_plaza_enabled,
      model_plaza_require_auth: form.model_plaza_require_auth,
      model_plaza_description: form.model_plaza_description,
      playground_enabled: form.playground_enabled,
      // Affiliate (邀请返利) feature switch
      affiliate_enabled: form.affiliate_enabled,
      allow_user_view_error_requests: form.allow_user_view_error_requests,
    };

    // 仅当 openai_fast_policy_settings 已成功从后端加载时才回写，
    // 否则省略整个字段，让后端保留既有规则（含默认值）。
    if (openaiFastPolicyLoaded.value) {
      payload.openai_fast_policy_settings = {
        rules: openaiFastPolicyForm.rules.map((rule) => {
          const whitelist = (rule.model_whitelist || [])
            .map((p) => p.trim())
            .filter((p) => p !== "");
          const hasWhitelist = whitelist.length > 0;
          return {
            service_tier: rule.service_tier,
            action: rule.action,
            scope: rule.scope,
            user_ids:
              rule.user_ids && rule.user_ids.length > 0
                ? [...rule.user_ids]
                : undefined,
            error_message:
              rule.action === "block" ? rule.error_message : undefined,
            model_whitelist: hasWhitelist ? whitelist : undefined,
            fallback_action: hasWhitelist
              ? rule.fallback_action || "pass"
              : undefined,
            fallback_error_message:
              hasWhitelist && rule.fallback_action === "block"
                ? rule.fallback_error_message
                : undefined,
          };
        }),
      };
    }

    payload.default_platform_quotas = sanitizePlatformQuotasMap(form.default_platform_quotas);
    payload.account_scheduling_thresholds = sanitizeAccountSchedulingThresholdsMap(
      form.account_scheduling_thresholds,
    );
    appendAuthSourceDefaultsToUpdateRequest(payload, authSourceDefaults);

    const updated = await settingsStepUp.run(() =>
      adminAPI.settings.updateSettings(payload),
    );
    for (const [key, value] of Object.entries(updated)) {
      if (key === "openai_fast_policy_settings") continue;
      if (value !== null && value !== undefined) {
        (form as Record<string, unknown>)[key] = value;
      }
    }
    Object.assign(authSourceDefaults, buildAuthSourceDefaultsState(updated));
    form.default_platform_quotas = normalizePlatformQuotasMap(updated.default_platform_quotas);
    form.account_scheduling_thresholds = normalizeAccountSchedulingThresholdsMap(
      updated.account_scheduling_thresholds,
    );
    registrationEmailSuffixWhitelistTags.value =
      normalizeRegistrationEmailSuffixDomains(
        updated.registration_email_suffix_whitelist,
      );
    form.forwarded_client_ip_headers = normalizeForwardedClientIpHeaders(
      updated.forwarded_client_ip_headers,
    );
    forwardedClientIpHeaderDraft.value = "";
    tablePageSizeOptionsInput.value = formatTablePageSizeOptions(
      Array.isArray(updated.table_page_size_options)
        ? updated.table_page_size_options
        : [10, 20, 50, 100],
    );
    registrationEmailSuffixWhitelistDraft.value = "";
    form.smtp_password = "";
    smtpPasswordManuallyEdited.value = false;
    form.turnstile_secret_key = "";
    form.aliyun_captcha_access_key_secret = "";
    form.linuxdo_connect_client_secret = "";
    form.dingtalk_connect_client_secret = "";
    form.github_oauth_client_secret = "";
    form.google_oauth_client_secret = "";
    form.wechat_connect_app_secret = "";
    form.wechat_connect_open_app_secret = "";
    form.wechat_connect_mp_app_secret = "";
    form.wechat_connect_mobile_app_secret = "";
    const updatedWechatCapabilities = resolveWeChatConnectModeCapabilities(
      updated.wechat_connect_open_enabled,
      updated.wechat_connect_mp_enabled,
      updated.wechat_connect_mobile_enabled,
      updated.wechat_connect_mode,
    );
    form.wechat_connect_open_enabled = updatedWechatCapabilities.openEnabled;
    form.wechat_connect_mp_enabled = updatedWechatCapabilities.mpEnabled;
    form.wechat_connect_mobile_enabled =
      updatedWechatCapabilities.mobileEnabled;
    form.wechat_connect_mode = deriveWeChatConnectStoredMode(
      updatedWechatCapabilities.openEnabled,
      updatedWechatCapabilities.mpEnabled,
      updatedWechatCapabilities.mobileEnabled,
      updated.wechat_connect_mode,
    );
    form.wechat_connect_scopes = defaultWeChatConnectScopesForMode(
      form.wechat_connect_mode,
    );
    form.oidc_connect_client_secret = "";
    // Refresh OpenAI fast/flex policy from server response
    if (
      updated.openai_fast_policy_settings &&
      Array.isArray(updated.openai_fast_policy_settings.rules)
    ) {
      openaiFastPolicyForm.rules =
        updated.openai_fast_policy_settings.rules.map((rule) => ({
          ...rule,
          user_ids: rule.user_ids ? [...rule.user_ids] : [],
          model_whitelist: rule.model_whitelist
            ? [...rule.model_whitelist]
            : [],
        }));
      openaiFastPolicyLoaded.value = true;
    }
    // Save web search emulation config separately (errors handled internally)
    const wsOk = await saveWebSearchConfig();
    // Refresh cached settings so sidebar/header update immediately
    await appStore.fetchPublicSettings(true);
    await adminSettingsStore.fetch(true);
    if (wsOk) {
      appStore.showSuccess(t("admin.settings.settingsSaved"));
    }
  } catch (error: unknown) {
    // 用户取消 step-up 验证：静默返回，不弹错误
    if (isStepUpCancelled(error)) {
      return;
    }
    if (isStepUpBlocked(error)) {
      appStore.showError(
        stepUpBlockReason(error) === "STEP_UP_ADMIN_API_KEY_FORBIDDEN"
          ? t("stepUp.adminApiKeyForbidden")
          : t("stepUp.notEnabled"),
      );
      return;
    }
    // 开启 step-up 开关但本人未启用 2FA：给出可操作的专用提示
    if (
      (error as { reason?: string })?.reason === "STEP_UP_ENABLE_REQUIRES_TOTP"
    ) {
      appStore.showError(t("admin.settings.security.stepUpEnableRequiresTotp"));
      return;
    }
    appStore.showError(
      extractApiErrorMessage(error, t("admin.settings.failedToSave")),
    );
  } finally {
    saving.value = false;
  }
}

async function testSmtpConnection() {
  testingSmtp.value = true;
  try {
    const smtpPasswordForTest = smtpPasswordManuallyEdited.value
      ? form.smtp_password
      : "";
    const result = await adminAPI.settings.testSmtpConnection({
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_username: form.smtp_username,
      smtp_password: smtpPasswordForTest,
      smtp_use_tls: form.smtp_use_tls,
    });
    // API returns { message: "..." } on success, errors are thrown as exceptions
    appStore.showSuccess(
      result.message || t("admin.settings.smtpConnectionSuccess"),
    );
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(error, t("admin.settings.failedToTestSmtp")),
    );
  } finally {
    testingSmtp.value = false;
  }
}

async function sendTestEmail() {
  if (!testEmailAddress.value) {
    appStore.showError(t("admin.settings.testEmail.enterRecipientHint"));
    return;
  }

  sendingTestEmail.value = true;
  try {
    const smtpPasswordForSend = smtpPasswordManuallyEdited.value
      ? form.smtp_password
      : "";
    const result = await adminAPI.settings.sendTestEmail({
      email: testEmailAddress.value,
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_username: form.smtp_username,
      smtp_password: smtpPasswordForSend,
      smtp_from_email: form.smtp_from_email,
      smtp_from_name: form.smtp_from_name,
      smtp_use_tls: form.smtp_use_tls,
    });
    // API returns { message: "..." } on success, errors are thrown as exceptions
    appStore.showSuccess(result.message || t("admin.settings.testEmailSent"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(error, t("admin.settings.failedToSendTestEmail")),
    );
  } finally {
    sendingTestEmail.value = false;
  }
}

// Admin API Key 方法
async function loadAdminApiKey() {
  adminApiKeyLoading.value = true;
  try {
    const status = await adminAPI.settings.getAdminApiKey();
    adminApiKeyExists.value = status.exists;
    adminApiKeyMasked.value = status.masked_key;
  } catch (_error: unknown) {
    // Silent fail - admin API key status is non-critical
  } finally {
    adminApiKeyLoading.value = false;
  }
}

async function createAdminApiKey() {
  adminApiKeyOperating.value = true;
  try {
    const result = await adminAPI.settings.regenerateAdminApiKey();
    newAdminApiKey.value = result.key;
    adminApiKeyExists.value = true;
    adminApiKeyMasked.value =
      result.key.substring(0, 10) + "..." + result.key.slice(-4);
    appStore.showSuccess(t("admin.settings.adminApiKey.keyGenerated"));
    return true;
  } catch (error: unknown) {
    appStore.showError(extractApiErrorMessage(error, t("common.error")));
    return false;
  } finally {
    adminApiKeyOperating.value = false;
  }
}

function regenerateAdminApiKey() {
  openSettingsConfirm(
    t("admin.settings.adminApiKey.title"),
    t("admin.settings.adminApiKey.regenerateConfirm"),
    t("admin.settings.adminApiKey.regenerate"),
    createAdminApiKey,
  );
}

function deleteAdminApiKey() {
  openSettingsConfirm(
    t("admin.settings.adminApiKey.title"),
    t("admin.settings.adminApiKey.deleteConfirm"),
    t("admin.settings.adminApiKey.delete"),
    performDeleteAdminApiKey,
  );
}

async function performDeleteAdminApiKey() {
  adminApiKeyOperating.value = true;
  try {
    await adminAPI.settings.deleteAdminApiKey();
    adminApiKeyExists.value = false;
    adminApiKeyMasked.value = "";
    newAdminApiKey.value = "";
    appStore.showSuccess(t("admin.settings.adminApiKey.keyDeleted"));
    return true;
  } catch (error: unknown) {
    appStore.showError(extractApiErrorMessage(error, t("common.error")));
    return false;
  } finally {
    adminApiKeyOperating.value = false;
  }
}

function copyNewKey() {
  navigator.clipboard
    .writeText(newAdminApiKey.value)
    .then(() => {
      appStore.showSuccess(t("admin.settings.adminApiKey.keyCopied"));
    })
    .catch(() => {
      appStore.showError(t("common.copyFailed"));
    });
}

async function loadUpstreamBillingProbeSettings() {
  upstreamBillingProbeLoading.value = true;
  try {
    Object.assign(
      upstreamBillingProbeForm,
      await adminAPI.accounts.getUpstreamBillingProbeSettings(),
    );
  } catch (_error: unknown) {
    // Keep defaults when this optional setting cannot be loaded.
  } finally {
    upstreamBillingProbeLoading.value = false;
  }
}

async function saveUpstreamBillingProbeSettings() {
  upstreamBillingProbeSaving.value = true;
  try {
    const updated = await adminAPI.accounts.updateUpstreamBillingProbeSettings({
      ...upstreamBillingProbeForm,
    });
    Object.assign(upstreamBillingProbeForm, updated);
    appStore.showSuccess(t("admin.settings.upstreamBillingProbe.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(
        error,
        t("admin.settings.upstreamBillingProbe.saveFailed"),
      ),
    );
  } finally {
    upstreamBillingProbeSaving.value = false;
  }
}

async function loadOllamaCloudUsageSettings() {
  ollamaCloudUsageLoading.value = true;
  try {
    Object.assign(
      ollamaCloudUsageForm,
      await adminAPI.accounts.getOllamaCloudUsageSettings(),
    );
  } catch (_error: unknown) {
    // Keep the fail-safe disabled defaults when this optional setting cannot be loaded.
  } finally {
    ollamaCloudUsageLoading.value = false;
  }
}

async function saveOllamaCloudUsageSettings() {
  ollamaCloudUsageSaving.value = true;
  try {
    const updated = await adminAPI.accounts.updateOllamaCloudUsageSettings({
      ...ollamaCloudUsageForm,
    });
    Object.assign(ollamaCloudUsageForm, updated);
    appStore.showSuccess(t("admin.settings.ollamaCloudUsage.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(error, t("admin.settings.ollamaCloudUsage.saveFailed")),
    );
  } finally {
    ollamaCloudUsageSaving.value = false;
  }
}

// Overload Cooldown 方法
async function loadOverloadCooldownSettings() {
  overloadCooldownLoading.value = true;
  try {
    const settings = await adminAPI.settings.getOverloadCooldownSettings();
    Object.assign(overloadCooldownForm, settings);
  } catch (_error: unknown) {
    // Silent fail - settings will use defaults
  } finally {
    overloadCooldownLoading.value = false;
  }
}

async function saveOverloadCooldownSettings() {
  overloadCooldownSaving.value = true;
  try {
    const updated = await adminAPI.settings.updateOverloadCooldownSettings({
      enabled: overloadCooldownForm.enabled,
      cooldown_minutes: overloadCooldownForm.cooldown_minutes,
    });
    Object.assign(overloadCooldownForm, updated);
    appStore.showSuccess(t("admin.settings.overloadCooldown.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(
        error,
        t("admin.settings.overloadCooldown.saveFailed"),
      ),
    );
  } finally {
    overloadCooldownSaving.value = false;
  }
}

// Panel API Rate Limit 方法
async function loadPanelRateLimitSettings() {
  panelRateLimitLoading.value = true;
  try {
    const settings = await adminAPI.settings.getPanelRateLimitSettings();
    Object.assign(panelRateLimitForm, settings);
  } catch (_error: unknown) {
    // Silent fail - settings will use defaults
  } finally {
    panelRateLimitLoading.value = false;
  }
}

async function savePanelRateLimitSettings() {
  panelRateLimitSaving.value = true;
  try {
    const updated = await adminAPI.settings.updatePanelRateLimitSettings({
      enabled: panelRateLimitForm.enabled,
      user_rpm: panelRateLimitForm.user_rpm,
      heavy_rpm: panelRateLimitForm.heavy_rpm,
      exempt_admin: panelRateLimitForm.exempt_admin,
      public_ip_rpm: panelRateLimitForm.public_ip_rpm,
    });
    Object.assign(panelRateLimitForm, updated);
    appStore.showSuccess(t("admin.settings.panelRateLimit.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(
        error,
        t("admin.settings.panelRateLimit.saveFailed"),
      ),
    );
  } finally {
    panelRateLimitSaving.value = false;
  }
}

// Rate Limit Cooldown (429) 方法
async function loadRateLimit429CooldownSettings() {
  rateLimit429CooldownLoading.value = true;
  try {
    const settings = await adminAPI.settings.getRateLimit429CooldownSettings();
    Object.assign(rateLimit429CooldownForm, settings);
  } catch (_error: unknown) {
    // Silent fail - settings will use defaults
  } finally {
    rateLimit429CooldownLoading.value = false;
  }
}

async function saveRateLimit429CooldownSettings() {
  rateLimit429CooldownSaving.value = true;
  try {
    const updated = await adminAPI.settings.updateRateLimit429CooldownSettings({
      enabled: rateLimit429CooldownForm.enabled,
      cooldown_seconds: rateLimit429CooldownForm.cooldown_seconds,
    });
    Object.assign(rateLimit429CooldownForm, updated);
    appStore.showSuccess(t("admin.settings.rateLimit429Cooldown.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(
        error,
        t("admin.settings.rateLimit429Cooldown.saveFailed"),
      ),
    );
  } finally {
    rateLimit429CooldownSaving.value = false;
  }
}

// Stream Timeout 方法
async function loadStreamTimeoutSettings() {
  streamTimeoutLoading.value = true;
  try {
    const settings = await adminAPI.settings.getStreamTimeoutSettings();
    Object.assign(streamTimeoutForm, settings);
  } catch (_error: unknown) {
    // Silent fail - settings will use defaults
  } finally {
    streamTimeoutLoading.value = false;
  }
}

async function saveStreamTimeoutSettings() {
  streamTimeoutSaving.value = true;
  try {
    const updated = await adminAPI.settings.updateStreamTimeoutSettings({
      enabled: streamTimeoutForm.enabled,
      action: streamTimeoutForm.action,
      temp_unsched_minutes: streamTimeoutForm.temp_unsched_minutes,
      threshold_count: streamTimeoutForm.threshold_count,
      threshold_window_minutes: streamTimeoutForm.threshold_window_minutes,
    });
    Object.assign(streamTimeoutForm, updated);
    appStore.showSuccess(t("admin.settings.streamTimeout.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(
        error,
        t("admin.settings.streamTimeout.saveFailed"),
      ),
    );
  } finally {
    streamTimeoutSaving.value = false;
  }
}

// Rectifier 方法
async function loadRectifierSettings() {
  rectifierLoading.value = true;
  try {
    const settings = await adminAPI.settings.getRectifierSettings();
    Object.assign(rectifierForm, settings);
    // 确保 patterns 是数组（旧数据可能为 null）
    if (!Array.isArray(rectifierForm.apikey_signature_patterns)) {
      rectifierForm.apikey_signature_patterns = [];
    }
  } catch (_error: unknown) {
    // Silent fail - settings will use defaults
  } finally {
    rectifierLoading.value = false;
  }
}

async function saveRectifierSettings() {
  rectifierSaving.value = true;
  try {
    const updated = await adminAPI.settings.updateRectifierSettings({
      enabled: rectifierForm.enabled,
      thinking_signature_enabled: rectifierForm.thinking_signature_enabled,
      thinking_budget_enabled: rectifierForm.thinking_budget_enabled,
      apikey_signature_enabled: rectifierForm.apikey_signature_enabled,
      apikey_signature_patterns: rectifierForm.apikey_signature_patterns.filter(
        (p) => p.trim() !== "",
      ),
    });
    Object.assign(rectifierForm, updated);
    if (!Array.isArray(rectifierForm.apikey_signature_patterns)) {
      rectifierForm.apikey_signature_patterns = [];
    }
    appStore.showSuccess(t("admin.settings.rectifier.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(error, t("admin.settings.rectifier.saveFailed")),
    );
  } finally {
    rectifierSaving.value = false;
  }
}

const betaPolicyActionOptions = computed(() => [
  { value: "pass", label: t("admin.settings.betaPolicy.actionPass") },
  { value: "filter", label: t("admin.settings.betaPolicy.actionFilter") },
  { value: "block", label: t("admin.settings.betaPolicy.actionBlock") },
]);

const betaPolicyScopeOptions = computed(() => [
  { value: "all", label: t("admin.settings.betaPolicy.scopeAll") },
  { value: "oauth", label: t("admin.settings.betaPolicy.scopeOAuth") },
  { value: "apikey", label: t("admin.settings.betaPolicy.scopeAPIKey") },
  { value: "bedrock", label: t("admin.settings.betaPolicy.scopeBedrock") },
]);

// Beta Policy 方法
const betaDisplayNames: Record<string, string> = {
  "fast-mode-2026-02-01": "Fast Mode",
  "context-1m-2025-08-07": "Context 1M",
};

// 快捷预设：按 beta_token 定义预设方案
const betaPresets: Record<
  string,
  Array<{
    label: string;
    description: string;
    action: "pass" | "filter" | "block";
    model_whitelist: string[];
    fallback_action: "pass" | "filter" | "block";
  }>
> = {
  "context-1m-2025-08-07": [
    {
      label: t("admin.settings.betaPolicy.presetOpusOnly"),
      description: t("admin.settings.betaPolicy.presetOpusOnlyDesc"),
      action: "pass",
      model_whitelist: ["claude-opus-4-6"],
      fallback_action: "filter",
    },
  ],
};

// 常用模型模式（具体 ID + 通配符示例）
const commonModelPatterns = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-opus-*",
  "claude-sonnet-*",
];

function getBetaDisplayName(token: string): string {
  return betaDisplayNames[token] || token;
}

function applyBetaPreset(
  rule: (typeof betaPolicyForm.rules)[number],
  preset: {
    action: "pass" | "filter" | "block";
    model_whitelist: string[];
    fallback_action: "pass" | "filter" | "block";
  },
) {
  rule.action = preset.action;
  rule.model_whitelist = [...preset.model_whitelist];
  rule.fallback_action = preset.fallback_action;
}

function addQuickPattern(
  rule: (typeof betaPolicyForm.rules)[number],
  pattern: string,
) {
  if (!rule.model_whitelist) rule.model_whitelist = [];
  if (!rule.model_whitelist.includes(pattern)) {
    rule.model_whitelist.push(pattern);
  }
}

async function loadBetaPolicySettings() {
  betaPolicyLoading.value = true;
  try {
    const settings = await adminAPI.settings.getBetaPolicySettings();
    betaPolicyForm.rules = settings.rules;
  } catch (_error: unknown) {
    // Silent fail - settings will use defaults
  } finally {
    betaPolicyLoading.value = false;
  }
}

// ==================== OpenAI Fast/Flex Policy ====================

const openaiFastPolicyTierOptions = computed(() => [
  { value: "all", label: t("admin.settings.openaiFastPolicy.tierAll") },
  {
    value: "priority",
    label: t("admin.settings.openaiFastPolicy.tierPriority"),
  },
  { value: "flex", label: t("admin.settings.openaiFastPolicy.tierFlex") },
]);

const openaiFastPolicyActionOptions = computed(() => [
  { value: "pass", label: t("admin.settings.openaiFastPolicy.actionPass") },
  { value: "filter", label: t("admin.settings.openaiFastPolicy.actionFilter") },
  {
    value: "force_priority",
    label: t("admin.settings.openaiFastPolicy.actionForcePriority"),
  },
  { value: "block", label: t("admin.settings.openaiFastPolicy.actionBlock") },
]);

const openaiFastPolicyScopeOptions = computed(() => [
  { value: "all", label: t("admin.settings.openaiFastPolicy.scopeAll") },
  { value: "oauth", label: t("admin.settings.openaiFastPolicy.scopeOAuth") },
  { value: "apikey", label: t("admin.settings.openaiFastPolicy.scopeAPIKey") },
  {
    value: "bedrock",
    label: t("admin.settings.openaiFastPolicy.scopeBedrock"),
  },
]);

function addOpenAIFastPolicyRule() {
  openaiFastPolicyForm.rules.push({
    service_tier: "priority",
    action: "filter",
    scope: "all",
    user_ids: [],
    error_message: "",
    model_whitelist: [],
    fallback_action: "pass",
    fallback_error_message: "",
  });
}

function removeOpenAIFastPolicyRule(index: number) {
  openaiFastPolicyForm.rules.splice(index, 1);
}

function addOpenAIFastPolicyModelPattern(rule: OpenAIFastPolicyRule) {
  if (!rule.model_whitelist) rule.model_whitelist = [];
  rule.model_whitelist.push("");
}

function removeOpenAIFastPolicyModelPattern(
  rule: OpenAIFastPolicyRule,
  idx: number,
) {
  rule.model_whitelist?.splice(idx, 1);
}

async function saveBetaPolicySettings() {
  betaPolicySaving.value = true;
  try {
    // Clean up empty patterns before saving
    const cleanedRules = betaPolicyForm.rules.map((rule) => {
      const whitelist = rule.model_whitelist?.filter((p) => p.trim() !== "");
      const hasWhitelist = whitelist && whitelist.length > 0;
      return {
        beta_token: rule.beta_token,
        action: rule.action,
        scope: rule.scope,
        error_message: rule.error_message,
        model_whitelist: hasWhitelist ? whitelist : undefined,
        fallback_action: hasWhitelist
          ? rule.fallback_action || "pass"
          : undefined,
        fallback_error_message:
          hasWhitelist && rule.fallback_action === "block"
            ? rule.fallback_error_message
            : undefined,
      };
    });
    const updated = await adminAPI.settings.updateBetaPolicySettings({
      rules: cleanedRules,
    });
    betaPolicyForm.rules = updated.rules;
    appStore.showSuccess(t("admin.settings.betaPolicy.saved"));
  } catch (error: unknown) {
    appStore.showError(
      extractApiErrorMessage(error, t("admin.settings.betaPolicy.saveFailed")),
    );
  } finally {
    betaPolicySaving.value = false;
  }
}

// ==================== Provider Management ====================

const allPaymentTypes = computed(() => [
  { value: "easypay", label: t("payment.methods.easypay") },
  { value: "alipay", label: t("payment.methods.alipay") },
  { value: "wxpay", label: t("payment.methods.wxpay") },
  { value: "stripe", label: t("payment.methods.stripe") },
  { value: "airwallex", label: t("payment.methods.airwallex") },
]);

function isPaymentTypeEnabled(type: string): boolean {
  return form.payment_enabled_types.includes(type);
}

const hasAnyPaymentTypeEnabled = computed(
  () => form.payment_enabled_types.length > 0,
);

function togglePaymentType(type: string) {
  if (form.payment_enabled_types.includes(type)) {
    form.payment_enabled_types = form.payment_enabled_types.filter(
      (t) => t !== type,
    );
    // Disable all provider instances matching this type
    disableProvidersByType(type);
  } else {
    form.payment_enabled_types = [...form.payment_enabled_types, type];
  }
}

async function disableProvidersByType(type: string) {
  const matching = providers.value.filter(
    (p) => p.provider_key === type && p.enabled,
  );
  for (const p of matching) {
    try {
      await adminAPI.payment.updateProvider(p.id, { enabled: false });
      p.enabled = false;
    } catch (err: unknown) {
      slog("disable provider failed", p.id, err);
    }
  }
}

function slog(...args: unknown[]) {
  console.warn("[payment]", ...args);
}

const providersLoading = ref(false);
const providerSaving = ref(false);
const providers = ref<ProviderInstance[]>([]);
const showProviderDialog = ref(false);
const showDeleteProviderDialog = ref(false);
const editingProvider = ref<ProviderInstance | null>(null);
const deletingProviderId = ref<number | null>(null);
const providerDialogRef = ref<InstanceType<
  typeof PaymentProviderDialog
> | null>(null);

const providerKeyOptions = computed(() => [
  { value: "easypay", label: t("admin.settings.payment.providerEasypay") },
  { value: "alipay", label: t("admin.settings.payment.providerAlipay") },
  { value: "wxpay", label: t("admin.settings.payment.providerWxpay") },
  { value: "stripe", label: t("admin.settings.payment.providerStripe") },
  { value: "airwallex", label: t("admin.settings.payment.providerAirwallex") },
]);

const enabledProviderKeyOptions = computed(() => {
  const enabled = form.payment_enabled_types;
  return providerKeyOptions.value.filter((opt) => enabled.includes(opt.value));
});

const loadBalanceOptions = computed(() => [
  {
    value: "round-robin",
    label: t("admin.settings.payment.strategyRoundRobin"),
  },
  {
    value: "least-amount",
    label: t("admin.settings.payment.strategyLeastAmount"),
  },
]);

const cancelRateLimitUnitOptions = computed(() => [
  {
    value: "minute",
    label: t("admin.settings.payment.cancelRateLimitUnitMinute"),
  },
  { value: "hour", label: t("admin.settings.payment.cancelRateLimitUnitHour") },
  { value: "day", label: t("admin.settings.payment.cancelRateLimitUnitDay") },
]);

const cancelRateLimitModeOptions = computed(() => [
  {
    value: "rolling",
    label: t("admin.settings.payment.cancelRateLimitWindowModeRolling"),
  },
  {
    value: "fixed",
    label: t("admin.settings.payment.cancelRateLimitWindowModeFixed"),
  },
]);

type ProviderEnablementCandidate = Pick<
  ProviderInstance,
  "id" | "provider_key" | "supported_types" | "enabled" | "name"
>;

function getProviderVisibleMethods(
  provider: ProviderEnablementCandidate,
): Array<"alipay" | "wxpay"> {
  if (!provider.enabled) {
    return [];
  }

  const supportedTypes = Array.isArray(provider.supported_types)
    ? provider.supported_types
    : [];
  const methods = new Set<"alipay" | "wxpay">();
  const addMethod = (type: string) => {
    const method = normalizeVisibleMethod(type);
    if (method === "alipay" || method === "wxpay") {
      methods.add(method);
    }
  };

  if (provider.provider_key === "alipay") {
    if (supportedTypes.length === 0) {
      methods.add("alipay");
    } else {
      supportedTypes.forEach((type) => {
        if (normalizeVisibleMethod(type) === "alipay") {
          methods.add("alipay");
        }
      });
    }
  } else if (provider.provider_key === "wxpay") {
    if (supportedTypes.length === 0) {
      methods.add("wxpay");
    } else {
      supportedTypes.forEach((type) => {
        if (normalizeVisibleMethod(type) === "wxpay") {
          methods.add("wxpay");
        }
      });
    }
  } else if (provider.provider_key === "easypay") {
    supportedTypes.forEach(addMethod);
  }

  return Array.from(methods);
}

function findProviderEnablementConflict(
  candidate: ProviderEnablementCandidate,
): { method: "alipay" | "wxpay"; conflicting: ProviderInstance } | null {
  const claimedMethods = getProviderVisibleMethods(candidate);
  if (claimedMethods.length === 0) {
    return null;
  }

  for (const other of providers.value) {
    if (other.id === candidate.id || !other.enabled) {
      continue;
    }

    const otherMethods = getProviderVisibleMethods(other);
    const matchedMethod = claimedMethods.find((method) =>
      otherMethods.includes(method),
    );
    if (matchedMethod) {
      return {
        method: matchedMethod,
        conflicting: other,
      };
    }
  }

  return null;
}

function showProviderEnablementConflict(
  conflict: { method: "alipay" | "wxpay"; conflicting: ProviderInstance },
) {
  appStore.showError(
    t("admin.settings.payment.enableConflict", {
      method: t(`payment.methods.${conflict.method}`),
      provider: conflict.conflicting.name,
    }),
  );
}

async function loadProviders() {
  providersLoading.value = true;
  try {
    const res = await adminAPI.payment.getProviders();
    // Normalize supported_types: backend returns null when the list is empty
    // (Go nil slice → JSON null). Without this, ProviderCard's isSelected()
    // throws TypeError on null.includes(), causing the card to vanish.
    providers.value = (res.data || []).map((p) => ({
      ...p,
      supported_types: Array.isArray(p.supported_types)
        ? p.supported_types
        : [],
    }));
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, "payment.errors", t("common.error")));
  } finally {
    providersLoading.value = false;
  }
}

function openCreateProvider() {
  editingProvider.value = null;
  providerDialogRef.value?.reset(
    enabledProviderKeyOptions.value[0]?.value || "easypay",
  );
  showProviderDialog.value = true;
}

function openEditProvider(provider: ProviderInstance) {
  editingProvider.value = provider;
  providerDialogRef.value?.loadProvider(provider);
  showProviderDialog.value = true;
}

async function handleSaveProvider(payload: Partial<ProviderInstance>) {
  providerSaving.value = true;
  try {
    const candidate: ProviderEnablementCandidate = {
      id: editingProvider.value?.id ?? 0,
      provider_key:
        payload.provider_key ?? editingProvider.value?.provider_key ?? "",
      supported_types:
        payload.supported_types ?? editingProvider.value?.supported_types ?? [],
      enabled: payload.enabled ?? editingProvider.value?.enabled ?? false,
      name: payload.name ?? editingProvider.value?.name ?? "",
    };
    const conflict = findProviderEnablementConflict(candidate);
    if (conflict) {
      showProviderEnablementConflict(conflict);
      return;
    }

    if (editingProvider.value) {
      await adminAPI.payment.updateProvider(editingProvider.value.id, payload);
    } else {
      await adminAPI.payment.createProvider(payload);
    }
    showProviderDialog.value = false;
    // Reload full list (API returns decrypted/formatted data with correct sort order)
    await loadProviders();
    // Auto-save settings so provider changes take effect immediately
    await saveSettings();
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, "payment.errors", t("common.error")));
  } finally {
    providerSaving.value = false;
  }
}

async function handleToggleField(
  provider: ProviderInstance,
  field: "enabled" | "refund_enabled" | "allow_user_refund",
) {
  let newValue: boolean;
  if (field === "enabled") newValue = !provider.enabled;
  else if (field === "refund_enabled") newValue = !provider.refund_enabled;
  else newValue = !provider.allow_user_refund;

  if (field === "enabled" && newValue) {
    const conflict = findProviderEnablementConflict({
      id: provider.id,
      provider_key: provider.provider_key,
      supported_types: provider.supported_types,
      enabled: true,
      name: provider.name,
    });
    if (conflict) {
      showProviderEnablementConflict(conflict);
      return;
    }
  }

  const payload: Record<string, boolean> = { [field]: newValue };
  // Cascade: turning off refund_enabled also turns off allow_user_refund
  if (field === "refund_enabled" && !newValue) {
    payload.allow_user_refund = false;
  }
  try {
    await adminAPI.payment.updateProvider(provider.id, payload);
    await loadProviders();
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, "payment.errors", t("common.error")));
  }
}

async function handleToggleType(provider: ProviderInstance, type: string) {
  const currentTypes = Array.isArray(provider.supported_types)
    ? provider.supported_types
    : [];
  const updated = currentTypes.includes(type)
    ? currentTypes.filter((t) => t !== type)
    : [...currentTypes, type];
  const conflict = findProviderEnablementConflict({
    id: provider.id,
    provider_key: provider.provider_key,
    supported_types: updated,
    enabled: provider.enabled,
    name: provider.name,
  });
  if (conflict) {
    showProviderEnablementConflict(conflict);
    return;
  }
  try {
    await adminAPI.payment.updateProvider(provider.id, {
      supported_types: updated,
    } as any);
    await loadProviders();
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, "payment.errors", t("common.error")));
  }
}

function confirmDeleteProvider(provider: ProviderInstance) {
  deletingProviderId.value = provider.id;
  showDeleteProviderDialog.value = true;
}

async function handleReorderProviders(
  updates: { id: number; sort_order: number }[],
) {
  try {
    await Promise.all(
      updates.map((u) =>
        adminAPI.payment.updateProvider(u.id, {
          sort_order: u.sort_order,
        } as Partial<ProviderInstance>),
      ),
    );
    await loadProviders();
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, "payment.errors", t("common.error")));
    loadProviders();
  }
}

async function handleDeleteProvider() {
  if (!deletingProviderId.value) return;
  try {
    await adminAPI.payment.deleteProvider(deletingProviderId.value);
    appStore.showSuccess(t("common.deleted"));
    showDeleteProviderDialog.value = false;
    loadProviders();
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, "payment.errors", t("common.error")));
  }
}

onMounted(() => {
  loadSettings();
  loadSubscriptionPlans();
  loadAdminApiKey();
  loadUpstreamBillingProbeSettings();
  loadOllamaCloudUsageSettings();
  loadOverloadCooldownSettings();
  loadRateLimit429CooldownSettings();
  loadPanelRateLimitSettings();
  loadStreamTimeoutSettings();
  loadRectifierSettings();
  loadBetaPolicySettings();
  loadProviders();
});

// =========================
// Affiliate (邀请返利) 专属用户管理
// =========================

interface AffiliateState {
  loading: boolean;
  entries: AffiliateAdminEntry[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  selected: number[];
  searchTimer: number | null;
}

const affiliateState = reactive<AffiliateState>({
  loading: false,
  entries: [],
  total: 0,
  page: 1,
  pageSize: 20,
  search: "",
  selected: [],
  searchTimer: null,
});

// `rate` is typed as string|number because <input type="number"> makes Vue's
// v-model auto-cast the bound value to a Number on every keystroke. We keep
// both shapes and normalize at read time.
interface AffiliateModalState {
  open: boolean;
  mode: "add" | "edit";
  saving: boolean;
  userQuery: string;
  userResults: AffiliateSimpleUser[];
  selectedUser: AffiliateSimpleUser | null;
  editingEntry: AffiliateAdminEntry | null;
  code: string;
  rate: string | number;
  searchTimer: number | null;
}

const affiliateModal = reactive<AffiliateModalState>({
  open: false,
  mode: "add",
  saving: false,
  userQuery: "",
  userResults: [],
  selectedUser: null,
  editingEntry: null,
  code: "",
  rate: "",
  searchTimer: null,
});

const affiliateBatchModal = reactive<{
  open: boolean;
  saving: boolean;
  rate: string | number;
}>({
  open: false,
  saving: false,
  rate: "",
});

// affiliateConfirmDialog drives the project-standard <ConfirmDialog>. We can't
// `await` the user's response from the dialog component, so the confirm action
// runs from the @confirm callback once the user clicks the dialog's confirm
// button.
const affiliateConfirmDialog = reactive<{
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  pending: (() => Promise<unknown>) | null;
}>({
  show: false,
  title: "",
  message: "",
  confirmText: "",
  pending: null,
});

function openAffiliateConfirm(
  title: string,
  message: string,
  confirmText: string,
  fn: () => Promise<unknown>,
) {
  affiliateConfirmDialog.title = title;
  affiliateConfirmDialog.message = message;
  affiliateConfirmDialog.confirmText = confirmText;
  affiliateConfirmDialog.pending = fn;
  affiliateConfirmDialog.show = true;
}

async function handleAffiliateConfirm() {
  const fn = affiliateConfirmDialog.pending;
  affiliateConfirmDialog.show = false;
  affiliateConfirmDialog.pending = null;
  if (!fn) return;
  try {
    await fn();
    appStore.showSuccess(t("common.saved"));
    await loadAffiliateUsers();
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  }
}

function cancelAffiliateConfirm() {
  affiliateConfirmDialog.show = false;
  affiliateConfirmDialog.pending = null;
}

// debounceTimer wires a single timer slot to a callback with a delay,
// canceling any pending invocation. Used for type-as-you-go search inputs.
function debounceTimer(slot: { searchTimer: number | null }, delayMs: number, run: () => void) {
  if (slot.searchTimer != null) window.clearTimeout(slot.searchTimer);
  slot.searchTimer = window.setTimeout(run, delayMs);
}

// parseRebateRate validates 0-100 numeric input. Returns the parsed number on
// success, null when the field is empty (caller decides empty semantics), or
// undefined on invalid input (after surfacing a toast).
//
// Accepts unknown because <input type="number"> makes Vue's v-model coerce
// the value to Number on each keystroke (e.g. typing "30" lands a `30: number`
// in state, not a `"30": string`). String("") and (30).trim() would crash, so
// we normalize here instead of forcing every caller to remember.
function parseRebateRate(raw: unknown): number | null | undefined {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const parsed = Number(s);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    appStore.showError(t("admin.settings.features.affiliate.modal.errorBadRate"));
    return undefined;
  }
  return parsed;
}

async function loadAffiliateUsers() {
  affiliateState.loading = true;
  try {
    const res = await affiliatesAPI.listUsers({
      page: affiliateState.page,
      page_size: affiliateState.pageSize,
      search: affiliateState.search,
    });
    affiliateState.entries = res.items ?? [];
    affiliateState.total = res.total ?? 0;
    // Drop selections that are no longer visible.
    const visibleIds = new Set(affiliateState.entries.map((e) => e.user_id));
    affiliateState.selected = affiliateState.selected.filter((id) => visibleIds.has(id));
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    affiliateState.loading = false;
  }
}

function onAffiliateSearchInput() {
  debounceTimer(affiliateState, 300, () => {
    affiliateState.page = 1;
    loadAffiliateUsers();
  });
}

function changeAffiliatePage(page: number) {
  if (page < 1) return;
  affiliateState.page = page;
  loadAffiliateUsers();
}

function toggleAffiliateSelectAll(checked: boolean) {
  affiliateState.selected = checked ? affiliateState.entries.map((entry) => entry.user_id) : [];
}

function toggleAffiliateSelect(userId: number, _checked?: boolean) {
  const idx = affiliateState.selected.indexOf(userId);
  if (idx >= 0) affiliateState.selected.splice(idx, 1);
  else affiliateState.selected.push(userId);
}

// openAffiliateModal opens the add/edit modal, prefilling fields from the
// edited entry when present and resetting them otherwise.
function openAffiliateModal(entry: AffiliateAdminEntry | null) {
  affiliateModal.open = true;
  affiliateModal.mode = entry ? "edit" : "add";
  affiliateModal.userQuery = "";
  affiliateModal.userResults = [];
  affiliateModal.selectedUser = null;
  affiliateModal.editingEntry = entry;
  affiliateModal.code = entry?.aff_code_custom ? entry.aff_code : "";
  affiliateModal.rate =
    entry?.aff_rebate_rate_percent != null ? String(entry.aff_rebate_rate_percent) : "";
}

function closeAffiliateModal() {
  affiliateModal.open = false;
  if (affiliateModal.searchTimer != null) {
    window.clearTimeout(affiliateModal.searchTimer);
    affiliateModal.searchTimer = null;
  }
}

function onAffiliateUserSearchInput() {
  const q = affiliateModal.userQuery.trim();
  if (!q) {
    affiliateModal.userResults = [];
    return;
  }
  debounceTimer(affiliateModal, 300, async () => {
    try {
      affiliateModal.userResults = await affiliatesAPI.lookupUsers(q);
    } catch (err) {
      appStore.showError(extractApiErrorMessage(err, t("common.error")));
    }
  });
}

// selectAffiliateUser picks a user from the dropdown and collapses the search
// UI. Clearing the result list also clears the visual dropdown.
function selectAffiliateUser(user: AffiliateSimpleUser) {
  affiliateModal.selectedUser = user;
  affiliateModal.userQuery = "";
  affiliateModal.userResults = [];
}

function clearSelectedAffiliateUser() {
  affiliateModal.selectedUser = null;
}

// affiliateModalCanSubmit guards the Save button: must have a user picked AND
// produce at least one field change. Without this the admin could "save" an
// empty payload that silently does nothing — the user reported exactly that
// confusion.
const affiliateModalCanSubmit = computed(() => {
  if (affiliateModal.mode === "add") {
    if (!affiliateModal.selectedUser) return false;
  } else if (!affiliateModal.editingEntry) {
    return false;
  }
  const codeFilled = affiliateModal.code.trim() !== "";
  const rateFilled = String(affiliateModal.rate ?? "").trim() !== "";
  if (codeFilled || rateFilled) return true;
  // Edit mode + empty rate input is a meaningful "clear" only if the user
  // currently has an exclusive rate to clear.
  return (
    affiliateModal.mode === "edit" &&
    affiliateModal.editingEntry?.aff_rebate_rate_percent != null
  );
});

async function submitAffiliateModal() {
  if (!affiliateModalCanSubmit.value) {
    // Should be unreachable because the button is disabled, but keep a guard.
    appStore.showError(t("admin.settings.features.affiliate.modal.errorEmpty"));
    return;
  }

  let userId: number;
  if (affiliateModal.mode === "add") {
    userId = affiliateModal.selectedUser!.id;
  } else {
    userId = affiliateModal.editingEntry!.user_id;
  }

  const payload: Parameters<typeof affiliatesAPI.updateUserSettings>[1] = {};
  const codeRaw = affiliateModal.code.trim();
  if (codeRaw) payload.aff_code = codeRaw.toUpperCase();

  const rateInput = parseRebateRate(affiliateModal.rate);
  if (rateInput === undefined) return; // toast already shown
  if (rateInput === null) {
    if (affiliateModal.mode === "edit" && affiliateModal.editingEntry?.aff_rebate_rate_percent != null) {
      payload.clear_rebate_rate = true;
    }
  } else {
    payload.aff_rebate_rate_percent = rateInput;
  }

  affiliateModal.saving = true;
  try {
    await affiliatesAPI.updateUserSettings(userId, payload);
    appStore.showSuccess(t("common.saved"));
    closeAffiliateModal();
    affiliateState.page = 1;
    await loadAffiliateUsers();
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    affiliateModal.saving = false;
  }
}

// askResetAffiliateUser prompts via the project ConfirmDialog, then on confirm
// calls the backend "reset all" endpoint that clears both the exclusive rate
// AND regenerates the invite code as a system random one.
function askResetAffiliateUser(entry: AffiliateAdminEntry) {
  openAffiliateConfirm(
    t("admin.settings.features.affiliate.customUsers.resetTitle"),
    t("admin.settings.features.affiliate.customUsers.resetMessage", {
      email: entry.email || `#${entry.user_id}`,
    }),
    t("common.delete"),
    () => affiliatesAPI.clearUserSettings(entry.user_id),
  );
}

function openAffiliateBatchModal() {
  if (affiliateState.selected.length === 0) return;
  affiliateBatchModal.open = true;
  affiliateBatchModal.rate = "";
}

async function submitAffiliateBatchModal() {
  const rateInput = parseRebateRate(affiliateBatchModal.rate);
  if (rateInput === undefined) return;
  const userIDs = [...affiliateState.selected];
  const payload: Parameters<typeof affiliatesAPI.batchSetRate>[0] =
    rateInput === null
      ? { user_ids: userIDs, clear: true }
      : { user_ids: userIDs, aff_rebate_rate_percent: rateInput };

  affiliateBatchModal.saving = true;
  try {
    await affiliatesAPI.batchSetRate(payload);
    appStore.showSuccess(t("common.saved"));
    affiliateBatchModal.open = false;
    affiliateState.selected = [];
    await loadAffiliateUsers();
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    affiliateBatchModal.saving = false;
  }
}

// Load the per-user table the first time the affiliate switch is observed
// as enabled. The form starts disabled and is updated to the server's value
// after the settings load — so this fires either when the saved value is
// truthy on first paint, or when the admin manually toggles it on.
watch(
  () => form.affiliate_enabled,
  (enabled, prev) => {
    if (enabled && !prev) {
      loadAffiliateUsers();
    }
  },
);

// bypass_registration 与身份同步三开关仅在 internal_only 模式下生效。切换 policy 到其它值时，
// 立即把相关字段重置为 false，避免保存请求里残留旧值。后端 admin handler 与
// 配置加载层都有 coerce 兜底，这里是 UX 层的同步而非安全防线。
watch(
  () => form.dingtalk_connect_corp_restriction_policy,
  (policy) => {
    if (policy !== "internal_only") {
      if (form.dingtalk_connect_bypass_registration) form.dingtalk_connect_bypass_registration = false;
      if (form.dingtalk_connect_sync_corp_email) form.dingtalk_connect_sync_corp_email = false;
      if (form.dingtalk_connect_sync_display_name) form.dingtalk_connect_sync_display_name = false;
      if (form.dingtalk_connect_sync_dept) form.dingtalk_connect_sync_dept = false;
    }
  },
);
</script>

<style scoped>
/* One settings surface per logical tab block. Individual settings remain
   sections separated by rules instead of independent nested cards. */
.settings-panel {
  @apply overflow-hidden rounded-[4px] border border-gray-200 bg-white shadow-none dark:border-dark-700 dark:bg-dark-800/50;
}

.settings-panel-embedded {
  @apply overflow-visible border-0 bg-transparent;
}

.settings-section {
  @apply bg-transparent;
}

.settings-section + .settings-section {
  @apply border-t border-gray-200 dark:border-dark-700;
}

/* ============ 系统设置 Tab 导航 ============ */
.settings-tabs-shell {
  @apply sticky z-20 -mx-1 max-w-full min-w-0 bg-white/95 px-1 backdrop-blur-sm dark:bg-dark-900/95;
  top: calc(var(--app-header-height, 4rem) + 0.75rem);
}
</style>
