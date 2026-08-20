<template>
  <UiDialog
    :show="show"
    :title="t('admin.accounts.bulkEdit.title')"
    :close-label="t('common.close')"
    width="wide"
    @close="handleClose"
  >
    <form id="bulk-edit-account-form" class="space-y-5" @submit.prevent="() => handleSubmit()">
      <!-- Info -->
      <UiAlert tone="info">
          {{ t('admin.accounts.bulkEdit.selectionInfo', { count: targetMode === 'filtered' ? targetPreviewCount : accountIds.length }) }}
      </UiAlert>

      <!-- Mixed platform warning -->
      <UiAlert v-if="isMixedPlatform" tone="warning">
          {{ t('admin.accounts.bulkEdit.mixedPlatformWarning', { platforms: targetSelectedPlatforms.join(', ') }) }}
      </UiAlert>

      <!-- OpenAI passthrough -->
      <div
        v-if="allOpenAIPassthroughCapable"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="flex-1 pr-4">
            <label
              id="bulk-edit-openai-passthrough-label"
              class="ui-field-label mb-0"
              for="bulk-edit-openai-passthrough-enabled"
            >
              {{ t('admin.accounts.openai.oauthPassthrough') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.oauthPassthroughDesc') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableOpenAIPassthrough"
            id="bulk-edit-openai-passthrough-enabled"
            :aria-label="t('admin.accounts.openai.oauthPassthrough')"
            aria-controls="bulk-edit-openai-passthrough-body"
          />
        </div>
        <div
          id="bulk-edit-openai-passthrough-body"
          :class="!enableOpenAIPassthrough && 'pointer-events-none opacity-50'"
          role="group"
          aria-labelledby="bulk-edit-openai-passthrough-label"
        >
          <UiSwitch
            id="bulk-edit-openai-passthrough-toggle"
            v-model="openaiPassthroughEnabled"
            :label="t('admin.accounts.openai.oauthPassthrough')"
          />
        </div>
      </div>

      <!-- OpenAI Codex namespace 工具摊平（兼容开关，仅 OAuth） -->
      <div
        v-if="allOpenAIOAuthOnly"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="flex-1 pr-4">
            <label
              id="bulk-edit-openai-flatten-namespaces-label"
              class="ui-field-label mb-0"
              for="bulk-edit-openai-flatten-namespaces-enabled"
            >
              {{ t('admin.accounts.openai.flattenNamespaces') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.flattenNamespacesDesc') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableOpenAIFlattenNamespaces"
            id="bulk-edit-openai-flatten-namespaces-enabled"
            :aria-label="t('admin.accounts.openai.flattenNamespaces')"
            aria-controls="bulk-edit-openai-flatten-namespaces-body"
          />
        </div>
        <div
          id="bulk-edit-openai-flatten-namespaces-body"
          :class="!enableOpenAIFlattenNamespaces && 'pointer-events-none opacity-50'"
          role="group"
          aria-labelledby="bulk-edit-openai-flatten-namespaces-label"
        >
          <UiSwitch
            id="bulk-edit-openai-flatten-namespaces-toggle"
            v-model="openaiFlattenNamespacesEnabled"
            :label="t('admin.accounts.openai.flattenNamespaces')"
          />
        </div>
      </div>

      <!-- Base URL (API Key only) -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-base-url-label"
            class="ui-field-label mb-0"
            for="bulk-edit-base-url-enabled"
          >
            {{ t('admin.accounts.baseUrl') }}
          </label>
          <UiCheckbox
            v-model="enableBaseUrl"
            id="bulk-edit-base-url-enabled"
            aria-controls="bulk-edit-base-url"
          />
        </div>
        <UiTextField
          v-model="baseUrl"
          id="bulk-edit-base-url"
          :disabled="!enableBaseUrl"
          :placeholder="t('admin.accounts.bulkEdit.baseUrlPlaceholder')"
        />
        <GrokBaseUrlPresets
          v-if="allTargetsGrok"
          class="mt-2"
          @select="baseUrl = $event; enableBaseUrl = true"
        />
        <p class="ui-field-hint">
          {{ t('admin.accounts.bulkEdit.baseUrlNotice') }}
        </p>
      </div>

      <!-- Model restriction -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-model-restriction-label"
            class="ui-field-label mb-0"
            for="bulk-edit-model-restriction-enabled"
          >
            {{ t('admin.accounts.modelRestriction') }}
          </label>
          <UiCheckbox
            v-model="enableModelRestriction"
            id="bulk-edit-model-restriction-enabled"
            aria-controls="bulk-edit-model-restriction-body"
          />
        </div>

        <div
          id="bulk-edit-model-restriction-body"
          :class="!enableModelRestriction && 'pointer-events-none opacity-50'"
          role="group"
          aria-labelledby="bulk-edit-model-restriction-label"
        >
          <div
            v-if="isOpenAIModelRestrictionDisabled"
            class="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20"
          >
            <p class="text-xs text-amber-700 dark:text-amber-400">
              {{ t('admin.accounts.openai.modelRestrictionDisabledByPassthrough') }}
            </p>
          </div>

          <template v-else>
            <!-- Mode Toggle -->
            <UiSegmentedControl
              v-model="modelRestrictionMode"
              class="mb-4"
              :label="t('admin.accounts.modelRestriction')"
              :options="modelRestrictionOptions"
            />

            <!-- Whitelist Mode -->
            <div v-if="modelRestrictionMode === 'whitelist'">
              <UiAlert class="mb-3" tone="info">
                  {{ t('admin.accounts.selectAllowedModels') }}
              </UiAlert>

              <ModelWhitelistSelector
                v-model="allowedModels"
                :platforms="targetSelectedPlatforms"
              />

              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.selectedModels', { count: allowedModels.length }) }}
                <span v-if="allowedModels.length === 0">{{
                  t('admin.accounts.supportsAllModels')
                }}</span>
              </p>
            </div>

            <!-- Mapping Mode -->
            <div v-else>
              <UiAlert class="mb-3" tone="info">
                  {{ t('admin.accounts.mapRequestModels') }}
              </UiAlert>

              <!-- Model Mapping List -->
              <div v-if="modelMappings.length > 0" class="mb-3 space-y-2">
                <div
                  v-for="(mapping, index) in modelMappings"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <UiTextField
                    v-model="mapping.from"
                    class="flex-1"
                    :placeholder="t('admin.accounts.requestModel')"
                  />
                  <Icon name="arrowRight" size="sm" class="flex-shrink-0 text-gray-400" />
                  <UiTextField
                    v-model="mapping.to"
                    class="flex-1"
                    :placeholder="t('admin.accounts.actualModel')"
                  />
                  <UiIconButton
                    :label="t('common.delete')"
                    variant="danger"
                    density="dense"
                    @click="removeModelMapping(index)"
                  >
                    <Icon name="trash" size="sm" />
                  </UiIconButton>
                </div>
              </div>

              <UiButton
                class="mb-3"
                block
                variant="secondary"
                @click="addModelMapping"
              >
                <template #icon><Icon name="plus" size="sm" /></template>
                {{ t('admin.accounts.addMapping') }}
              </UiButton>

              <!-- Quick Add Buttons -->
              <div class="flex flex-wrap gap-2">
                <UiButton
                  v-for="preset in filteredPresets"
                  :key="preset.label"
                  type="button"
                  variant="quiet"
                  density="dense"
                  @click="addPresetMapping(preset.from, preset.to)"
                >
                  + {{ preset.label }}
                </UiButton>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Custom error codes -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <label
              id="bulk-edit-custom-error-codes-label"
              class="ui-field-label mb-0"
              for="bulk-edit-custom-error-codes-enabled"
            >
              {{ t('admin.accounts.customErrorCodes') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.customErrorCodesHint') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableCustomErrorCodes"
            id="bulk-edit-custom-error-codes-enabled"
            aria-controls="bulk-edit-custom-error-codes-body"
          />
        </div>

        <div v-if="enableCustomErrorCodes" id="bulk-edit-custom-error-codes-body" class="space-y-3">
          <div class="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <p class="text-xs text-amber-700 dark:text-amber-400">
              <Icon name="exclamationTriangle" size="sm" class="mr-1 inline" :stroke-width="2" />
              {{ t('admin.accounts.customErrorCodesWarning') }}
            </p>
          </div>

          <!-- Error Code Buttons -->
          <div class="flex flex-wrap gap-2">
            <UiButton
              v-for="code in commonErrorCodes"
              :key="code.value"
              type="button"
              :variant="selectedErrorCodes.includes(code.value) ? 'danger' : 'secondary'"
              density="dense"
              :aria-pressed="selectedErrorCodes.includes(code.value)"
              @click="toggleErrorCode(code.value)"
            >
              {{ code.value }} {{ code.label }}
            </UiButton>
          </div>

          <!-- Manual input -->
          <div class="flex items-center gap-2">
            <UiTextField
              v-model="customErrorCodeInput"
              id="bulk-edit-custom-error-code-input"
              type="number"
              min="100"
              max="599"
              class="flex-1"
              :placeholder="t('admin.accounts.enterErrorCode')"
              @enter="addCustomErrorCode"
            />
            <UiIconButton
              :label="t('common.add')"
              icon="plus"
              @click="addCustomErrorCode"
            />
          </div>

          <!-- Selected codes summary -->
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="code in selectedErrorCodes.sort((a, b) => a - b)"
              :key="code"
              class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
              {{ code }}
              <UiIconButton
                type="button"
                icon="x"
                variant="ghost"
                density="mini"
                :label="`${t('common.delete')} ${code}`"
                @click="removeErrorCode(code)"
              />
            </span>
            <span v-if="selectedErrorCodes.length === 0" class="text-xs text-gray-400">
              {{ t('admin.accounts.noneSelectedUsesDefault') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Intercept warmup requests (Anthropic only) -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="flex items-center justify-between">
          <div class="flex-1 pr-4">
            <label
              id="bulk-edit-intercept-warmup-label"
              class="ui-field-label mb-0"
              for="bulk-edit-intercept-warmup-enabled"
            >
              {{ t('admin.accounts.interceptWarmupRequests') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.interceptWarmupRequestsDesc') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableInterceptWarmup"
            id="bulk-edit-intercept-warmup-enabled"
            aria-controls="bulk-edit-intercept-warmup-body"
          />
        </div>
        <div v-if="enableInterceptWarmup" id="bulk-edit-intercept-warmup-body" class="mt-3">
          <UiSwitch
            v-model="interceptWarmupRequests"
            :label="t('admin.accounts.interceptWarmupRequests')"
          />
        </div>
      </div>

      <!-- Header Override (anthropic/openai apikey only) -->
      <div v-if="allHeaderOverrideCapable" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="flex items-center justify-between">
          <div class="flex-1 pr-4">
            <label
              id="bulk-edit-header-override-label"
              class="ui-field-label mb-0"
              for="bulk-edit-header-override-enabled"
            >
              {{ t('admin.accounts.headerOverride.title') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.headerOverride.hint') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableHeaderOverride"
            id="bulk-edit-header-override-enabled"
            aria-controls="bulk-edit-header-override-body"
          />
        </div>
        <div v-if="enableHeaderOverride" id="bulk-edit-header-override-body" class="mt-3 space-y-3">
          <UiSwitch
            v-model="headerOverrideEnabled"
            :label="t('admin.accounts.headerOverride.title')"
          />

          <div v-if="headerOverrideEnabled" class="space-y-3">
            <div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <p class="text-xs text-blue-700 dark:text-blue-400">
                <Icon name="exclamationCircle" size="sm" class="mr-1 inline" :stroke-width="2" />
                {{ t('admin.accounts.headerOverride.info') }}
              </p>
            </div>

            <p class="text-xs text-amber-600 dark:text-amber-400">
              {{ t('admin.accounts.headerOverride.bulkReplaceHint') }}
            </p>

            <HeaderOverrideEditor
              :rows="headerOverrideRows"
              @update:rows="headerOverrideRows = $event"
            />
          </div>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.headerOverride.bulkDisableHint') }}
          </p>
        </div>
      </div>

      <!-- Proxy -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-proxy-label"
            class="ui-field-label mb-0"
            for="bulk-edit-proxy-enabled"
          >
            {{ t('admin.accounts.proxy') }}
          </label>
          <UiCheckbox
            v-model="enableProxy"
            id="bulk-edit-proxy-enabled"
            aria-controls="bulk-edit-proxy-body"
          />
        </div>
        <div id="bulk-edit-proxy-body" :class="!enableProxy && 'pointer-events-none opacity-50'">
          <ProxySelector
            v-model="proxyId"
            :proxies="proxies"
            aria-labelledby="bulk-edit-proxy-label"
          />
        </div>
      </div>

      <!-- Concurrency & Priority -->
      <div class="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 dark:border-dark-600 lg:grid-cols-4">
        <div>
          <div class="mb-3 flex items-center justify-between">
            <label
              id="bulk-edit-concurrency-label"
              class="ui-field-label mb-0"
              for="bulk-edit-concurrency-enabled"
            >
              {{ t('admin.accounts.concurrency') }}
            </label>
            <UiCheckbox
              v-model="enableConcurrency"
              id="bulk-edit-concurrency-enabled"
              aria-controls="bulk-edit-concurrency"
            />
          </div>
          <UiTextField
            v-model.number="concurrency"
            id="bulk-edit-concurrency"
            type="number"
            min="1"
            :disabled="!enableConcurrency"
            @input="concurrency = Math.max(1, concurrency || 1)"
          />
        </div>
        <div>
          <div class="mb-3 flex items-center justify-between">
            <label
              id="bulk-edit-load-factor-label"
              class="ui-field-label mb-0"
              for="bulk-edit-load-factor-enabled"
            >
              {{ t('admin.accounts.loadFactor') }}
            </label>
            <UiCheckbox
              v-model="enableLoadFactor"
              id="bulk-edit-load-factor-enabled"
              aria-controls="bulk-edit-load-factor"
            />
          </div>
          <UiTextField
            v-model.number="loadFactor"
            id="bulk-edit-load-factor"
            type="number"
            min="1"
            :disabled="!enableLoadFactor"
            @input="loadFactor = (loadFactor &amp;&amp; loadFactor >= 1) ? loadFactor : null"
          />
          <p class="ui-field-hint">{{ t('admin.accounts.loadFactorHint') }}</p>
        </div>
        <div>
          <div class="mb-3 flex items-center justify-between">
            <label
              id="bulk-edit-priority-label"
              class="ui-field-label mb-0"
              for="bulk-edit-priority-enabled"
            >
              {{ t('admin.accounts.priority') }}
            </label>
            <UiCheckbox
              v-model="enablePriority"
              id="bulk-edit-priority-enabled"
              aria-controls="bulk-edit-priority"
            />
          </div>
          <UiTextField
            v-model="priorityInput"
            id="bulk-edit-priority"
            inputmode="numeric"
            autocomplete="off"
            min="0"
            :disabled="!enablePriority"
          />
          <p class="ui-field-hint">{{ t('admin.accounts.priorityHint') }}</p>
        </div>
        <div>
          <div class="mb-3 flex items-center justify-between">
            <label
              id="bulk-edit-rate-multiplier-label"
              class="ui-field-label mb-0"
              for="bulk-edit-rate-multiplier-enabled"
            >
              {{ t('admin.accounts.billingRateMultiplier') }}
            </label>
            <UiCheckbox
              v-model="enableRateMultiplier"
              id="bulk-edit-rate-multiplier-enabled"
              aria-controls="bulk-edit-rate-multiplier"
            />
          </div>
          <UiTextField
            v-model.number="rateMultiplier"
            id="bulk-edit-rate-multiplier"
            type="number"
            min="0"
            step="0.01"
            :disabled="!enableRateMultiplier"
          />
          <p class="ui-field-hint">{{ t('admin.accounts.billingRateMultiplierHint') }}</p>
          <p
            v-if="enableRateMultiplier"
            class="mt-2 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300"
            data-testid="bulk-rate-sync-warning"
          >
            <Icon name="exclamationTriangle" size="xs" class="mt-0.5 flex-shrink-0" />
            <span>{{ t('admin.accounts.bulkEdit.rateSyncWarning') }}</span>
          </p>
        </div>
      </div>

      <!-- Status -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-status-label"
            class="ui-field-label mb-0"
            for="bulk-edit-status-enabled"
          >
            {{ t('common.status') }}
          </label>
          <UiCheckbox
            v-model="enableStatus"
            id="bulk-edit-status-enabled"
            aria-controls="bulk-edit-status"
          />
        </div>
        <div id="bulk-edit-status" :class="!enableStatus && 'pointer-events-none opacity-50'">
          <UiSelect
            v-model="status"
            :options="statusOptions"
            aria-labelledby="bulk-edit-status-label"
          />
        </div>
      </div>

      <!-- OpenAI OAuth WS mode -->
      <div v-if="allOpenAIOAuth" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-openai-ws-mode-label"
            class="ui-field-label mb-0"
            for="bulk-edit-openai-ws-mode-enabled"
          >
            {{ t('admin.accounts.openai.wsMode') }}
          </label>
          <UiCheckbox
            v-model="enableOpenAIWSMode"
            id="bulk-edit-openai-ws-mode-enabled"
            aria-controls="bulk-edit-openai-ws-mode"
          />
        </div>
        <div
          id="bulk-edit-openai-ws-mode"
          :class="!enableOpenAIWSMode && 'pointer-events-none opacity-50'"
        >
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.openai.wsModeDesc') }}
          </p>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {{ t(openAIWSModeConcurrencyHintKey) }}
          </p>
          <UiSelect
            v-model="openaiOAuthResponsesWebSocketV2Mode"
            data-testid="bulk-edit-openai-ws-mode-select"
            :options="openAIWSModeOptions"
            aria-labelledby="bulk-edit-openai-ws-mode-label"
          />
        </div>
      </div>

      <!-- OpenAI OAuth Codex CLI only -->
      <div v-if="allOpenAIOAuth" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-openai-codex-cli-only-label"
            class="ui-field-label mb-0"
            for="bulk-edit-openai-codex-cli-only-enabled"
          >
            {{ t('admin.accounts.openai.codexCLIOnly') }}
          </label>
          <UiCheckbox
            v-model="enableCodexCLIOnly"
            id="bulk-edit-openai-codex-cli-only-enabled"
            aria-controls="bulk-edit-openai-codex-cli-only"
          />
        </div>
        <div
          id="bulk-edit-openai-codex-cli-only"
          :class="!enableCodexCLIOnly && 'pointer-events-none opacity-50'"
        >
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.openai.codexCLIOnlyDesc') }}
          </p>
          <UiSwitch
            id="bulk-edit-openai-codex-cli-only-toggle"
            v-model="codexCLIOnlyEnabled"
            :label="t('admin.accounts.openai.codexCLIOnly')"
          />
        </div>
      </div>

      <!-- OpenAI OAuth: Codex app-server -->
      <div v-if="allOpenAIOAuth" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-openai-codex-app-server-label"
            class="ui-field-label mb-0"
            for="bulk-edit-openai-codex-app-server-enabled"
          >
            {{ t('admin.accounts.openai.codexCLIOnlyAppServer') }}
          </label>
          <UiCheckbox
            v-model="enableCodexCLIOnlyAppServer"
            id="bulk-edit-openai-codex-app-server-enabled"
            aria-controls="bulk-edit-openai-codex-app-server"
          />
        </div>
        <div
          id="bulk-edit-openai-codex-app-server"
          :class="!enableCodexCLIOnlyAppServer && 'pointer-events-none opacity-50'"
        >
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.openai.codexCLIOnlyAppServerDesc') }}
          </p>
          <UiSwitch
            id="bulk-edit-openai-codex-app-server-toggle"
            v-model="codexCLIOnlyAppServerEnabled"
            :label="t('admin.accounts.openai.codexCLIOnlyAppServer')"
          />
        </div>
      </div>

      <!-- Codex 指纹收敛模式（仅 OpenAI OAuth） -->
      <div v-if="allOpenAIOAuth" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.codexFingerprintMode') }}</label>
          <UiCheckbox
            v-model="enableCodexFingerprintMode"
            :aria-label="t('admin.accounts.openai.codexFingerprintMode')"
          />
        </div>
        <div :class="!enableCodexFingerprintMode && 'pointer-events-none opacity-50'">
          <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.openai.codexFingerprintModeDesc') }}
          </p>
          <UiSelect v-model="codexFingerprintMode" data-testid="bulk-codex-fingerprint-mode-select" :options="codexFingerprintModeOptions" />
        </div>
      </div>

      <!-- Upstream billing auto probe (any API-key platform) -->
      <div v-if="allBillingProbeCapable" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex-1 pr-4">
            <label
              id="bulk-edit-upstream-billing-auto-probe-label"
              class="ui-field-label mb-0"
              for="bulk-edit-upstream-billing-auto-probe-enabled"
            >
              {{ t('admin.accounts.upstreamBilling.autoProbe') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.upstreamBilling.autoProbeHint') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableUpstreamBillingAutoProbe"
            id="bulk-edit-upstream-billing-auto-probe-enabled"
            aria-controls="bulk-edit-upstream-billing-auto-probe"
          />
        </div>
        <div
          id="bulk-edit-upstream-billing-auto-probe"
          :class="!enableUpstreamBillingAutoProbe && 'pointer-events-none opacity-50'"
          role="group"
          aria-labelledby="bulk-edit-upstream-billing-auto-probe-label"
        >
          <UiSelect
            v-model="upstreamBillingAutoProbeMode"
            :disabled="!enableUpstreamBillingAutoProbe"
            data-testid="bulk-edit-upstream-billing-auto-probe-select"
            :options="upstreamBillingAutoProbeOptions"
            aria-labelledby="bulk-edit-upstream-billing-auto-probe-label"
          />
        </div>
      </div>

      <!-- OpenAI API Key WS mode -->
      <div v-if="allOpenAIAPIKey" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-openai-apikey-ws-mode-label"
            class="ui-field-label mb-0"
            for="bulk-edit-openai-apikey-ws-mode-enabled"
          >
            {{ t('admin.accounts.openai.wsMode') }}
          </label>
          <UiCheckbox
            v-model="enableOpenAIAPIKeyWSMode"
            id="bulk-edit-openai-apikey-ws-mode-enabled"
            aria-controls="bulk-edit-openai-apikey-ws-mode"
          />
        </div>
        <div
          id="bulk-edit-openai-apikey-ws-mode"
          :class="!enableOpenAIAPIKeyWSMode && 'pointer-events-none opacity-50'"
        >
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.openai.wsModeDesc') }}
          </p>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {{ t(openAIAPIKeyWSModeConcurrencyHintKey) }}
          </p>
          <UiSelect
            v-model="openaiAPIKeyResponsesWebSocketV2Mode"
            data-testid="bulk-edit-openai-apikey-ws-mode-select"
            :options="openAIWSModeOptions"
            aria-labelledby="bulk-edit-openai-apikey-ws-mode-label"
          />
        </div>
      </div>

      <!-- OpenAI Compact mode -->
      <div v-if="allOpenAIPassthroughCapable" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex-1 pr-4">
            <label
              id="bulk-edit-openai-compact-mode-label"
              class="ui-field-label mb-0"
              for="bulk-edit-openai-compact-mode-enabled"
            >
              {{ t('admin.accounts.openai.compactMode') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.compactModeDesc') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableOpenAICompactMode"
            id="bulk-edit-openai-compact-mode-enabled"
            aria-controls="bulk-edit-openai-compact-mode"
          />
        </div>
        <div
          id="bulk-edit-openai-compact-mode"
          :class="!enableOpenAICompactMode && 'pointer-events-none opacity-50'"
        >
          <UiSelect
            v-model="openAICompactMode"
            data-testid="bulk-edit-openai-compact-mode-select"
            :options="openAICompactModeOptions"
            aria-labelledby="bulk-edit-openai-compact-mode-label"
          />
        </div>
      </div>

      <!-- OpenAI Compact model mapping -->
      <div v-if="allOpenAIPassthroughCapable" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex-1 pr-4">
            <label
              id="bulk-edit-openai-compact-model-mapping-label"
              class="ui-field-label mb-0"
              for="bulk-edit-openai-compact-model-mapping-enabled"
            >
              {{ t('admin.accounts.openai.compactModelMapping') }}
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.compactModelMappingDesc') }}
            </p>
          </div>
          <UiCheckbox
            v-model="enableOpenAICompactModelMapping"
            id="bulk-edit-openai-compact-model-mapping-enabled"
            aria-controls="bulk-edit-openai-compact-model-mapping"
          />
        </div>
        <div
          id="bulk-edit-openai-compact-model-mapping"
          :class="!enableOpenAICompactModelMapping && 'pointer-events-none opacity-50'"
        >
          <div v-if="openAICompactModelMappings.length > 0" class="mb-3 space-y-2">
            <div
              v-for="(mapping, index) in openAICompactModelMappings"
              :key="index"
              class="flex items-center gap-2"
            >
              <UiTextField
                v-model="mapping.from"
                class="flex-1"
                :placeholder="t('admin.accounts.fromModel')"
                test-id="bulk-edit-openai-compact-model-mapping-input"
              />
              <span class="text-gray-400">→</span>
              <UiTextField
                v-model="mapping.to"
                class="flex-1"
                :placeholder="t('admin.accounts.toModel')"
                test-id="bulk-edit-openai-compact-model-mapping-input"
              />
              <UiIconButton
                :label="t('common.delete')"
                variant="danger"
                density="dense"
                @click="removeOpenAICompactModelMapping(index)"
              >
                <Icon name="trash" size="sm" />
              </UiIconButton>
            </div>
          </div>
          <UiButton
            class="mb-3"
            block
            variant="secondary"
            data-testid="bulk-edit-openai-compact-model-mapping-add"
            @click="addOpenAICompactModelMapping"
          >
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('admin.accounts.addMapping') }}
          </UiButton>
        </div>
      </div>

      <!-- RPM Limit (仅全部为 Anthropic OAuth/SetupToken 时显示) -->
      <div v-if="allAnthropicOAuthOrSetupToken" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-rpm-limit-label"
            class="ui-field-label mb-0"
            for="bulk-edit-rpm-limit-enabled"
          >
            {{ t('admin.accounts.quotaControl.rpmLimit.label') }}
          </label>
          <UiCheckbox
            v-model="enableRpmLimit"
            id="bulk-edit-rpm-limit-enabled"
            aria-controls="bulk-edit-rpm-limit-body"
          />
        </div>

        <div
          id="bulk-edit-rpm-limit-body"
          :class="!enableRpmLimit && 'pointer-events-none opacity-50'"
          role="group"
          aria-labelledby="bulk-edit-rpm-limit-label"
        >
          <div class="mb-3 flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('admin.accounts.quotaControl.rpmLimit.hint') }}</span>
            <UiSwitch
              v-model="rpmLimitEnabled"
              :label="t('admin.accounts.quotaControl.rpmLimit.label')"
            />
          </div>

          <div v-if="rpmLimitEnabled" class="space-y-3">
            <div>
              <label class="ui-field-label text-xs">{{ t('admin.accounts.quotaControl.rpmLimit.baseRpm') }}</label>
              <UiTextField
                v-model.number="bulkBaseRpm"
                type="number"
                min="1"
                max="1000"
                step="1"
                :placeholder="t('admin.accounts.quotaControl.rpmLimit.baseRpmPlaceholder')"
              />
              <p class="ui-field-hint">{{ t('admin.accounts.quotaControl.rpmLimit.baseRpmHint') }}</p>
            </div>

            <div>
              <label class="ui-field-label text-xs">{{ t('admin.accounts.quotaControl.rpmLimit.strategy') }}</label>
              <UiSegmentedControl
                v-model="bulkRpmStrategy"
                :label="t('admin.accounts.quotaControl.rpmLimit.strategy')"
                :options="rpmStrategyOptions"
              />
            </div>

            <div v-if="bulkRpmStrategy === 'tiered'">
              <label class="ui-field-label text-xs">{{ t('admin.accounts.quotaControl.rpmLimit.stickyBuffer') }}</label>
              <UiTextField
                v-model.number="bulkRpmStickyBuffer"
                type="number"
                min="1"
                step="1"
                :placeholder="t('admin.accounts.quotaControl.rpmLimit.stickyBufferPlaceholder')"
              />
              <p class="ui-field-hint">{{ t('admin.accounts.quotaControl.rpmLimit.stickyBufferHint') }}</p>
            </div>

            </div>
          </div>

        <!-- 用户消息限速模式（独立于 RPM 开关，始终可见） -->
        <div class="mt-4">
          <label class="ui-field-label">{{ t('admin.accounts.quotaControl.rpmLimit.userMsgQueue') }}</label>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
            {{ t('admin.accounts.quotaControl.rpmLimit.userMsgQueueHint') }}
          </p>
          <div class="flex space-x-2">
            <UiButton type="button" v-for="opt in umqModeOptions" :key="opt.value"
              :variant="userMsgQueueMode === opt.value ? 'primary' : 'secondary'"
              density="dense"
              :aria-pressed="userMsgQueueMode === opt.value"
              @click="userMsgQueueMode = userMsgQueueMode === opt.value ? null : opt.value"
            >
              {{ opt.label }}
            </UiButton>
          </div>
        </div>
      </div>

      <!-- Groups -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <label
            id="bulk-edit-groups-label"
            class="ui-field-label mb-0"
            for="bulk-edit-groups-enabled"
          >
            {{ t('nav.groups') }}
          </label>
          <UiCheckbox
            v-model="enableGroups"
            id="bulk-edit-groups-enabled"
            aria-controls="bulk-edit-groups"
          />
        </div>
        <div id="bulk-edit-groups" :class="!enableGroups && 'pointer-events-none opacity-50'">
          <GroupSelector
            v-model="groupIds"
            :groups="groups"
            aria-labelledby="bulk-edit-groups-label"
          />
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton type="button" variant="secondary" @click="handleClose">
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          type="submit"
          form="bulk-edit-account-form"
          variant="primary"
          :loading="submitting"
        >
          {{
            submitting ? t('admin.accounts.bulkEdit.updating') : t('admin.accounts.bulkEdit.submit')
          }}
        </UiButton>
      </div>
    </template>
  </UiDialog>

  <UiConfirmDialog
    :show="showMixedChannelWarning"
    :title="t('admin.accounts.mixedChannelWarningTitle')"
    :message="mixedChannelWarningMessage"
    :confirm-text="t('common.confirm')"
    :cancel-text="t('common.cancel')"
    :danger="true"
    :pending="submitting"
    @confirm="handleMixedChannelConfirm"
    @cancel="handleMixedChannelCancel"
  />
  <UiConfirmDialog
    :show="errorCodeConfirmation !== null"
    :title="t('common.confirm')"
    :message="errorCodeConfirmationMessage"
    :confirm-text="t('common.confirm')"
    :cancel-text="t('common.cancel')"
    :danger="true"
    @confirm="confirmErrorCodeWarning"
    @cancel="cancelErrorCodeWarning"
  />
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { Proxy as ProxyConfig, AdminGroup, AccountPlatform, AccountType, OpenAICompactMode } from '@/types'
import ProxySelector from '@/components/common/ProxySelector.vue'
import GroupSelector from '@/components/common/GroupSelector.vue'
import ModelWhitelistSelector from '@/components/account/ModelWhitelistSelector.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  UiAlert,
  UiButton,
  UiCheckbox,
  UiConfirmDialog,
  UiDialog,
  UiIconButton,
  UiSegmentedControl,
  UiSelect,
  UiSwitch,
  UiTextField
} from '@/components/ui'
import { parseAccountPriority } from '@/utils/accountPriority'
import {
  buildModelMappingObject as buildModelMappingPayload,
  getPresetMappingsByPlatform
} from '@/composables/useModelWhitelist'
import HeaderOverrideEditor from '@/components/account/HeaderOverrideEditor.vue'
import {
  buildHeaderOverridesObject,
  isHeaderOverrideCapable,
  validateHeaderOverrideRows,
  HEADER_OVERRIDE_ENABLED_CREDENTIAL_KEY,
  HEADER_OVERRIDES_CREDENTIAL_KEY,
  type HeaderOverrideRow
} from '@/components/account/credentialsBuilder'
import GrokBaseUrlPresets from '@/components/account/GrokBaseUrlPresets.vue'
import {
  OPENAI_WS_MODE_CTX_POOL,
  OPENAI_WS_MODE_OFF,
  OPENAI_WS_MODE_PASSTHROUGH,
  OPENAI_WS_MODE_HTTP_BRIDGE,
  isOpenAIWSModeEnabled,
  resolveOpenAIWSModeConcurrencyHintKey
} from '@/utils/openaiWsMode'
import type { OpenAIWSMode } from '@/utils/openaiWsMode'
interface Props {
  show: boolean
  accountIds: number[]
  selectedPlatforms: AccountPlatform[]
  selectedTypes: AccountType[]
  target?: {
    mode: 'selected' | 'filtered'
    filters?: Record<string, unknown>
    previewCount?: number
    selectedPlatforms?: AccountPlatform[]
    selectedTypes?: AccountType[]
  }
  proxies: ProxyConfig[]
  groups: AdminGroup[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  updated: []
}>()

const { t } = useI18n()
const appStore = useAppStore()
const modelRestrictionOptions = computed(() => [
  { value: 'whitelist', label: t('admin.accounts.modelWhitelist') },
  { value: 'mapping', label: t('admin.accounts.modelMapping') }
])
const rpmStrategyOptions = computed(() => [
  {
    value: 'tiered',
    label: t('admin.accounts.quotaControl.rpmLimit.strategyTiered')
  },
  {
    value: 'sticky_exempt',
    label: t('admin.accounts.quotaControl.rpmLimit.strategyStickyExempt')
  }
])

// Platform awareness
const targetMode = computed(() => props.target?.mode ?? 'selected')
const targetPreviewCount = computed(() => props.target?.previewCount ?? props.accountIds.length)
const targetSelectedPlatforms = computed(() => props.target?.selectedPlatforms ?? props.selectedPlatforms)
const targetSelectedTypes = computed(() => props.target?.selectedTypes ?? props.selectedTypes)
// Grok 快捷端点仅在所选账号全部为 grok 平台时展示（其他平台不显示）
const allTargetsGrok = computed(
  () =>
    targetSelectedPlatforms.value.length > 0 &&
    targetSelectedPlatforms.value.every((p) => p === 'grok')
)
const isMixedPlatform = computed(() => targetSelectedPlatforms.value.length > 1)

const allOpenAIPassthroughCapable = computed(() => {
  return (
    targetSelectedPlatforms.value.length === 1 &&
    targetSelectedPlatforms.value[0] === 'openai' &&
    targetSelectedTypes.value.length > 0 &&
    targetSelectedTypes.value.every(t => t === 'oauth' || t === 'setup-token' || t === 'apikey')
  )
})

const allOpenAIOAuth = computed(() => {
  return (
    targetSelectedPlatforms.value.length === 1 &&
    targetSelectedPlatforms.value[0] === 'openai' &&
    targetSelectedTypes.value.length > 0 &&
    targetSelectedTypes.value.every(t => t === 'oauth' || t === 'setup-token')
  )
})

// 严格 OAuth（不含 setup-token）：namespace 摊平兼容开关只对 OAuth 账号生效
const allOpenAIOAuthOnly = computed(() => {
  return (
    targetSelectedPlatforms.value.length === 1 &&
    targetSelectedPlatforms.value[0] === 'openai' &&
    targetSelectedTypes.value.length > 0 &&
    targetSelectedTypes.value.every(t => t === 'oauth')
  )
})

const allOpenAIAPIKey = computed(() => {
  return (
    targetSelectedPlatforms.value.length === 1 &&
    targetSelectedPlatforms.value[0] === 'openai' &&
    targetSelectedTypes.value.length > 0 &&
    targetSelectedTypes.value.every(t => t === 'apikey')
  )
})

// 上游倍率自动探测已放宽到全部 API-key 平台：只要求所选类型全为 apikey，
// 平台不限（sub2api 上游即可应答 /v1/sub2api/billing）。
const allBillingProbeCapable = computed(() => {
  return (
    targetSelectedTypes.value.length > 0 &&
    targetSelectedTypes.value.every(t => t === 'apikey')
  )
})

// 是否全部为 anthropic/openai 平台的 apikey 账号（请求头覆写仅在此条件下显示）
// 所选平台 × 所选类型的全组合均需具备覆写资格（实际选中账号是该组合的子集，
// 按交叉积判定偏保守但绝不放行不合资格的账号）
const allHeaderOverrideCapable = computed(() => {
  return (
    targetSelectedPlatforms.value.length > 0 &&
    targetSelectedTypes.value.length > 0 &&
    targetSelectedPlatforms.value.every(p =>
      targetSelectedTypes.value.every(ty => isHeaderOverrideCapable(p, ty))
    )
  )
})

// 是否全部为 Anthropic OAuth/SetupToken（RPM 配置仅在此条件下显示）
const allAnthropicOAuthOrSetupToken = computed(() => {
  return (
    targetSelectedPlatforms.value.length === 1 &&
    targetSelectedPlatforms.value[0] === 'anthropic' &&
    targetSelectedTypes.value.every(t => t === 'oauth' || t === 'setup-token')
  )
})

const filteredPresets = computed(() => {
  if (targetSelectedPlatforms.value.length === 0) return []

  const dedupedPresets = new Map<string, ReturnType<typeof getPresetMappingsByPlatform>[number]>()
  for (const platform of targetSelectedPlatforms.value) {
    for (const preset of getPresetMappingsByPlatform(platform)) {
      const key = `${preset.from}=>${preset.to}`
      if (!dedupedPresets.has(key)) {
        dedupedPresets.set(key, preset)
      }
    }
  }

  return Array.from(dedupedPresets.values())
})

// Model mapping type
interface ModelMapping {
  from: string
  to: string
}

// State - field enable flags
const enableBaseUrl = ref(false)
const enableModelRestriction = ref(false)
const enableCustomErrorCodes = ref(false)
const enableInterceptWarmup = ref(false)
const enableHeaderOverride = ref(false)
const enableProxy = ref(false)
const enableConcurrency = ref(false)
const enableLoadFactor = ref(false)
const enablePriority = ref(false)
const enableRateMultiplier = ref(false)
const enableStatus = ref(false)
const enableGroups = ref(false)
const enableOpenAIPassthrough = ref(false)
const enableOpenAIFlattenNamespaces = ref(false)
const enableOpenAIWSMode = ref(false)
const enableOpenAIAPIKeyWSMode = ref(false)
const enableUpstreamBillingAutoProbe = ref(false)
const enableCodexCLIOnly = ref(false)
const enableCodexCLIOnlyAppServer = ref(false)
const enableOpenAICompactMode = ref(false)
const enableOpenAICompactModelMapping = ref(false)
const enableRpmLimit = ref(false)

// State - field values
const submitting = ref(false)
const showMixedChannelWarning = ref(false)
const mixedChannelWarningMessage = ref('')
const pendingUpdatesForConfirm = ref<Record<string, unknown> | null>(null)
const baseUrl = ref('')
const modelRestrictionMode = ref<'whitelist' | 'mapping'>('whitelist')
const allowedModels = ref<string[]>([])
const modelMappings = ref<ModelMapping[]>([])
const selectedErrorCodes = ref<number[]>([])
const customErrorCodeInput = ref<number | null>(null)
const errorCodeConfirmation = ref<{ code: 429 | 529; source: 'toggle' | 'custom' } | null>(null)
const errorCodeConfirmationMessage = computed(() =>
  errorCodeConfirmation.value?.code === 429
    ? t('admin.accounts.customErrorCodes429Warning')
    : t('admin.accounts.customErrorCodes529Warning'),
)
const interceptWarmupRequests = ref(false)
const headerOverrideEnabled = ref(false)
const headerOverrideRows = ref<HeaderOverrideRow[]>([])
const proxyId = ref<number | null>(null)
const concurrency = ref(1)
const loadFactor = ref<number | null>(null)
const priority = ref(0)
const priorityInput = ref('0')
const rateMultiplier = ref(1)
const status = ref<'active' | 'inactive'>('active')
const groupIds = ref<number[]>([])
const openaiPassthroughEnabled = ref(false)
// Codex namespace 工具摊平兼容开关（仅 OAuth），缺省关闭即原样保留
const openaiFlattenNamespacesEnabled = ref(false)
const openaiOAuthResponsesWebSocketV2Mode = ref<OpenAIWSMode>(OPENAI_WS_MODE_OFF)
const openaiAPIKeyResponsesWebSocketV2Mode = ref<OpenAIWSMode>(OPENAI_WS_MODE_OFF)
const upstreamBillingAutoProbeMode = ref<'enabled' | 'disabled'>('enabled')
const codexCLIOnlyEnabled = ref(false)
const codexCLIOnlyAppServerEnabled = ref(false)
type CodexFingerprintMode = 'off' | 'device' | 'session' | 'full'
const enableCodexFingerprintMode = ref(false)
const codexFingerprintMode = ref<CodexFingerprintMode>('session')
const codexFingerprintModeOptions = computed(() => [
  { value: 'off' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintOff') },
  { value: 'device' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintDevice') },
  { value: 'session' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintSession') },
  { value: 'full' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintFull') },
])
const openAICompactMode = ref<OpenAICompactMode>('auto')
const openAICompactModelMappings = ref<ModelMapping[]>([])
const rpmLimitEnabled = ref(false)
const bulkBaseRpm = ref<number | null>(null)
const bulkRpmStrategy = ref<'tiered' | 'sticky_exempt'>('tiered')
const bulkRpmStickyBuffer = ref<number | null>(null)
const userMsgQueueMode = ref<string | null>(null)
const umqModeOptions = computed(() => [
  { value: '', label: t('admin.accounts.quotaControl.rpmLimit.umqModeOff') },
  { value: 'throttle', label: t('admin.accounts.quotaControl.rpmLimit.umqModeThrottle') },
  { value: 'serialize', label: t('admin.accounts.quotaControl.rpmLimit.umqModeSerialize') },
])

// Common HTTP error codes
const commonErrorCodes = [
  { value: 401, label: 'Unauthorized' },
  { value: 403, label: 'Forbidden' },
  { value: 429, label: 'Rate Limit' },
  { value: 500, label: 'Server Error' },
  { value: 502, label: 'Bad Gateway' },
  { value: 503, label: 'Unavailable' },
  { value: 529, label: 'Overloaded' }
]

const statusOptions = computed(() => [
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') }
])
const upstreamBillingAutoProbeOptions = computed(() => [
  { value: 'enabled', label: t('common.enabled') },
  { value: 'disabled', label: t('common.disabled') }
])
const isOpenAIModelRestrictionDisabled = computed(
  () =>
    allOpenAIPassthroughCapable.value &&
    enableOpenAIPassthrough.value &&
    openaiPassthroughEnabled.value
)

const openAIWSModeOptions = computed(() => [
  { value: OPENAI_WS_MODE_OFF, label: t('admin.accounts.openai.wsModeOff') },
  { value: OPENAI_WS_MODE_CTX_POOL, label: t('admin.accounts.openai.wsModeCtxPool') },
  { value: OPENAI_WS_MODE_PASSTHROUGH, label: t('admin.accounts.openai.wsModePassthrough') },
  { value: OPENAI_WS_MODE_HTTP_BRIDGE, label: t('admin.accounts.openai.wsModeHttpBridge') }
])
const openAICompactModeOptions = computed(() => [
  { value: 'auto', label: t('admin.accounts.openai.compactModeAuto') },
  { value: 'force_on', label: t('admin.accounts.openai.compactModeForceOn') },
  { value: 'force_off', label: t('admin.accounts.openai.compactModeForceOff') }
])
const openAIWSModeConcurrencyHintKey = computed(() =>
  resolveOpenAIWSModeConcurrencyHintKey(openaiOAuthResponsesWebSocketV2Mode.value)
)
const openAIAPIKeyWSModeConcurrencyHintKey = computed(() =>
  resolveOpenAIWSModeConcurrencyHintKey(openaiAPIKeyResponsesWebSocketV2Mode.value)
)

// Model mapping helpers
const addModelMapping = () => {
  modelMappings.value.push({ from: '', to: '' })
}

const removeModelMapping = (index: number) => {
  modelMappings.value.splice(index, 1)
}

const addOpenAICompactModelMapping = () => {
  openAICompactModelMappings.value.push({ from: '', to: '' })
}

const removeOpenAICompactModelMapping = (index: number) => {
  openAICompactModelMappings.value.splice(index, 1)
}

const addPresetMapping = (from: string, to: string) => {
  const exists = modelMappings.value.some((m) => m.from === from)
  if (exists) {
    appStore.showInfo(t('admin.accounts.mappingExists', { model: from }))
    return
  }
  modelMappings.value.push({ from, to })
}

// Error code helpers
const toggleErrorCode = (code: number) => {
  const index = selectedErrorCodes.value.indexOf(code)
  if (index === -1) {
    // Adding code - check for 429/529 warning
    if (code === 429 || code === 529) {
      errorCodeConfirmation.value = { code, source: 'toggle' }
      return
    }
    selectedErrorCodes.value.push(code)
  } else {
    selectedErrorCodes.value.splice(index, 1)
  }
}

const addCustomErrorCode = () => {
  const code = customErrorCodeInput.value
  if (code === null || code < 100 || code > 599) {
    appStore.showError(t('admin.accounts.invalidErrorCode'))
    return
  }
  if (selectedErrorCodes.value.includes(code)) {
    appStore.showInfo(t('admin.accounts.errorCodeExists'))
    return
  }
  // Check for 429/529 warning
  if (code === 429 || code === 529) {
    errorCodeConfirmation.value = { code, source: 'custom' }
    return
  }
  selectedErrorCodes.value.push(code)
  customErrorCodeInput.value = null
}

const confirmErrorCodeWarning = () => {
  const confirmation = errorCodeConfirmation.value
  errorCodeConfirmation.value = null
  if (!confirmation || selectedErrorCodes.value.includes(confirmation.code)) return
  selectedErrorCodes.value.push(confirmation.code)
  if (confirmation.source === 'custom') customErrorCodeInput.value = null
}

const cancelErrorCodeWarning = () => {
  errorCodeConfirmation.value = null
}

const removeErrorCode = (code: number) => {
  const index = selectedErrorCodes.value.indexOf(code)
  if (index !== -1) {
    selectedErrorCodes.value.splice(index, 1)
  }
}

const buildModelMappingObject = (): Record<string, string> | null => {
  return buildModelMappingPayload(
    modelRestrictionMode.value,
    allowedModels.value,
    modelMappings.value
  )
}

const buildOpenAICompactModelMapping = (): Record<string, string> | null => {
  return buildModelMappingPayload('mapping', [], openAICompactModelMappings.value)
}

const buildUpdatePayload = (): Record<string, unknown> | null => {
  const updates: Record<string, unknown> = {}
  const credentials: Record<string, unknown> = {}
  let credentialsChanged = false
  const ensureExtra = (): Record<string, unknown> => {
    if (!updates.extra) {
      updates.extra = {}
    }
    return updates.extra as Record<string, unknown>
  }

  if (enableProxy.value) {
    // 后端期望 proxy_id: 0 表示清除代理，而不是 null
    updates.proxy_id = proxyId.value === null ? 0 : proxyId.value
  }

  if (enableConcurrency.value) {
    updates.concurrency = concurrency.value
  }

  if (enableLoadFactor.value) {
    // 空值/NaN/0 时发送 0（后端约定 <= 0 表示清除）
    const lf = loadFactor.value
    updates.load_factor = (lf != null && !Number.isNaN(lf) && lf > 0) ? lf : 0
  }

  if (enablePriority.value) {
    updates.priority = priority.value
  }

  if (enableRateMultiplier.value) {
    updates.rate_multiplier = rateMultiplier.value
  }

  if (enableStatus.value) {
    updates.status = status.value
  }

  if (enableGroups.value) {
    updates.group_ids = groupIds.value
  }

  if (enableBaseUrl.value) {
    const baseUrlValue = baseUrl.value.trim()
    if (baseUrlValue) {
      credentials.base_url = baseUrlValue
      credentialsChanged = true
    }
  }

  if (enableOpenAIPassthrough.value) {
    const extra = ensureExtra()
    extra.openai_passthrough = openaiPassthroughEnabled.value
    if (!openaiPassthroughEnabled.value) {
      extra.openai_oauth_passthrough = false
    }
  }

  // 同时校验可见性：勾选后又改了目标筛选条件时，不应把该键写到非 OAuth 账号上
  if (enableOpenAIFlattenNamespaces.value && allOpenAIOAuthOnly.value) {
    const extra = ensureExtra()
    extra.openai_responses_flatten_namespaces = openaiFlattenNamespacesEnabled.value
  }

  if (enableModelRestriction.value && !isOpenAIModelRestrictionDisabled.value) {
    // 统一使用 model_mapping 字段
    if (modelRestrictionMode.value === 'whitelist') {
      // 白名单模式：将模型转换为 model_mapping 格式（key=value）
      // 空白名单表示“支持所有模型”，需显式发送空对象以覆盖已有限制。
      const mapping: Record<string, string> = {}
      for (const m of allowedModels.value) {
        mapping[m] = m
      }
      credentials.model_mapping = mapping
      credentialsChanged = true
    } else {
      // 映射模式下空配置同样表示“支持所有模型”。
      const modelMapping = buildModelMappingObject()
      credentials.model_mapping = modelMapping ?? {}
      credentialsChanged = true
    }
  }

  if (enableCustomErrorCodes.value) {
    credentials.custom_error_codes_enabled = true
    credentials.custom_error_codes = [...selectedErrorCodes.value]
    credentialsChanged = true
  }

  if (enableInterceptWarmup.value) {
    credentials.intercept_warmup_requests = interceptWarmupRequests.value
    credentialsChanged = true
  }

  if (enableHeaderOverride.value) {
    // 后端使用 JSONB || merge 语义：关闭时显式写入 false + 空对象以清除旧配置
    credentials[HEADER_OVERRIDE_ENABLED_CREDENTIAL_KEY] = headerOverrideEnabled.value
    credentials[HEADER_OVERRIDES_CREDENTIAL_KEY] = headerOverrideEnabled.value
      ? buildHeaderOverridesObject(headerOverrideRows.value)
      : {}
    credentialsChanged = true
  }

  if (enableOpenAIWSMode.value) {
    const extra = ensureExtra()
    extra.openai_oauth_responses_websockets_v2_mode = openaiOAuthResponsesWebSocketV2Mode.value
    extra.openai_oauth_responses_websockets_v2_enabled = isOpenAIWSModeEnabled(
      openaiOAuthResponsesWebSocketV2Mode.value
    )
  }

  if (enableOpenAIAPIKeyWSMode.value) {
    const extra = ensureExtra()
    extra.openai_apikey_responses_websockets_v2_mode = openaiAPIKeyResponsesWebSocketV2Mode.value
    extra.openai_apikey_responses_websockets_v2_enabled = isOpenAIWSModeEnabled(
      openaiAPIKeyResponsesWebSocketV2Mode.value
    )
  }

  if (enableUpstreamBillingAutoProbe.value) {
    updates.upstream_billing_probe_enabled = upstreamBillingAutoProbeMode.value === 'enabled'
  }

  if (enableCodexCLIOnly.value) {
    const extra = ensureExtra()
    extra.codex_cli_only = codexCLIOnlyEnabled.value
  }

  // 子开关从属于 codex_cli_only：仅当同一次批量编辑也把父开关设为开启时才写入，
  // 与 Create/Edit 语义对齐，避免在父开关关闭的账号上写入无意义的孤立字段。
  if (
    enableCodexCLIOnlyAppServer.value &&
    enableCodexCLIOnly.value &&
    codexCLIOnlyEnabled.value
  ) {
    const extra = ensureExtra()
    extra.codex_cli_only_allow_app_server = codexCLIOnlyAppServerEnabled.value
  }

  if (enableCodexFingerprintMode.value) {
    const extra = ensureExtra()
    if (codexFingerprintMode.value !== 'session') {
      extra.codex_fingerprint_mode = codexFingerprintMode.value
    } else {
      delete extra.codex_fingerprint_mode
    }
  }

  if (enableOpenAICompactMode.value) {
    const extra = ensureExtra()
    extra.openai_compact_mode = openAICompactMode.value
  }

  if (enableOpenAICompactModelMapping.value) {
    credentials.compact_model_mapping = buildOpenAICompactModelMapping() ?? {}
    credentialsChanged = true
  }

  // RPM limit settings (写入 extra 字段)
  if (enableRpmLimit.value) {
    const extra = ensureExtra()
    if (rpmLimitEnabled.value && bulkBaseRpm.value != null && bulkBaseRpm.value > 0) {
      extra.base_rpm = bulkBaseRpm.value
      extra.rpm_strategy = bulkRpmStrategy.value
      if (bulkRpmStickyBuffer.value != null && bulkRpmStickyBuffer.value > 0) {
        extra.rpm_sticky_buffer = bulkRpmStickyBuffer.value
      }
    } else {
      // 关闭 RPM 限制 - 设置 base_rpm 为 0，并用空值覆盖关联字段
      // 后端使用 JSONB || merge 语义，不会删除已有 key，
      // 所以必须显式发送空值来重置（后端读取时会 fallback 到默认值）
      extra.base_rpm = 0
      extra.rpm_strategy = ''
      extra.rpm_sticky_buffer = 0
    }
    updates.extra = extra
  }

  // UMQ mode（独立于 RPM 保存）
  if (userMsgQueueMode.value !== null) {
    const umqExtra = ensureExtra()
    umqExtra.user_msg_queue_mode = userMsgQueueMode.value  // '' = 清除账号级覆盖
    umqExtra.user_msg_queue_enabled = false  // 清理旧字段（JSONB merge）
  }

  if (credentialsChanged) {
    updates.credentials = credentials
  }

  return Object.keys(updates).length > 0 ? updates : null
}

const mixedChannelConfirmed = ref(false)

// 是否需要预检查：改了分组 + 全是单一的 antigravity 或 anthropic 平台
// 多平台混合的情况由 submitBulkUpdate 的 409 catch 兜底
const canPreCheck = () =>
  enableGroups.value &&
  groupIds.value.length > 0 &&
  targetSelectedPlatforms.value.length === 1 &&
  (targetSelectedPlatforms.value[0] === 'antigravity' || targetSelectedPlatforms.value[0] === 'anthropic')

const handleClose = () => {
  showMixedChannelWarning.value = false
  mixedChannelWarningMessage.value = ''
  pendingUpdatesForConfirm.value = null
  mixedChannelConfirmed.value = false
  emit('close')
}

// 预检查：提交前调接口检测，有风险就弹窗阻止，返回 false 表示需要用户确认
const preCheckMixedChannelRisk = async (built: Record<string, unknown>): Promise<boolean> => {
  if (!canPreCheck()) return true
  if (mixedChannelConfirmed.value) return true

  try {
    const result = await adminAPI.accounts.checkMixedChannelRisk({
      platform: targetSelectedPlatforms.value[0],
      group_ids: groupIds.value
    })
    if (!result.has_risk) return true

    pendingUpdatesForConfirm.value = built
    mixedChannelWarningMessage.value = result.message || t('admin.accounts.bulkEdit.failed')
    showMixedChannelWarning.value = true
    return false
  } catch (error: any) {
    appStore.showError(error.message || t('admin.accounts.bulkEdit.failed'))
    return false
  }
}

const handleSubmit = async () => {
  if (targetMode.value === 'selected' && props.accountIds.length === 0) {
    appStore.showError(t('admin.accounts.bulkEdit.noSelection'))
    return
  }

  const hasAnyFieldEnabled =
    enableBaseUrl.value ||
    enableOpenAIPassthrough.value ||
    enableOpenAIFlattenNamespaces.value ||
    enableModelRestriction.value ||
    enableCustomErrorCodes.value ||
    enableInterceptWarmup.value ||
    enableHeaderOverride.value ||
    enableProxy.value ||
    enableConcurrency.value ||
    enableLoadFactor.value ||
    enablePriority.value ||
    enableRateMultiplier.value ||
    enableStatus.value ||
    enableGroups.value ||
    enableOpenAIWSMode.value ||
    enableOpenAIAPIKeyWSMode.value ||
    enableUpstreamBillingAutoProbe.value ||
    enableCodexCLIOnly.value ||
    enableCodexCLIOnlyAppServer.value ||
    enableCodexFingerprintMode.value ||
    enableOpenAICompactMode.value ||
    enableOpenAICompactModelMapping.value ||
    enableRpmLimit.value ||
    userMsgQueueMode.value !== null

  if (!hasAnyFieldEnabled) {
    appStore.showError(t('admin.accounts.bulkEdit.noFieldsSelected'))
    return
  }

  if (enablePriority.value) {
    const parsedPriority = parseAccountPriority(priorityInput.value)
    if (parsedPriority == null) {
      appStore.showError(t('admin.accounts.priorityInvalid'))
      return
    }
    priority.value = parsedPriority
  }

  // base_url 现在也会作用于 Grok OAuth 订阅账号的转发端点；坏值会让请求期
  // 校验失败、账号请求全挂，因此保存前强制格式校验（与单账号编辑一致）。
  if (enableBaseUrl.value) {
    const trimmedBaseUrl = baseUrl.value.trim()
    if (trimmedBaseUrl && !/^https?:\/\//i.test(trimmedBaseUrl)) {
      appStore.showError(t('admin.accounts.grokCustomBaseUrl.invalid'))
      return
    }
  }

  if (enableHeaderOverride.value && headerOverrideEnabled.value) {
    // 批量保存对 header_overrides 是整键替换：开启但没有任何有效行会把所选账号的
    // 既有覆写配置静默清空，必须显式拦截（清空请走关闭开关的路径，有专门提示）
    if (!headerOverrideRows.value.some((row) => row.name.trim())) {
      appStore.showError(t('admin.accounts.headerOverride.bulkEmptyRows'))
      return
    }
    const headerError = validateHeaderOverrideRows(headerOverrideRows.value)
    if (headerError) {
      appStore.showError(t(`admin.accounts.headerOverride.${headerError}`))
      return
    }
  }

  const built = buildUpdatePayload()
  if (!built) {
    appStore.showError(t('admin.accounts.bulkEdit.noFieldsSelected'))
    return
  }

  const canContinue = await preCheckMixedChannelRisk(built)
  if (!canContinue) return

  await submitBulkUpdate(built)
}

const submitBulkUpdate = async (baseUpdates: Record<string, unknown>) => {
  // 无论是预检查确认还是 409 兜底确认，只要 mixedChannelConfirmed 为 true 就带上 flag
  const updates = mixedChannelConfirmed.value
    ? { ...baseUpdates, confirm_mixed_channel_risk: true }
    : baseUpdates

  submitting.value = true

  try {
    const res = targetMode.value === 'filtered' && props.target?.filters
      ? await adminAPI.accounts.bulkUpdate({
        filters: props.target.filters,
        ...updates
      })
      : await adminAPI.accounts.bulkUpdate(props.accountIds, updates)
    const success = res.success || 0
    const failed = res.failed || 0

    if (success > 0 && failed === 0) {
      appStore.showSuccess(t('admin.accounts.bulkEdit.success', { count: success }))
    } else if (success > 0) {
      appStore.showError(t('admin.accounts.bulkEdit.partialSuccess', { success, failed }))
    } else {
      appStore.showError(t('admin.accounts.bulkEdit.failed'))
    }

    if (success > 0) {
      pendingUpdatesForConfirm.value = null
      emit('updated')
      handleClose()
    }
  } catch (error: any) {
    // 兜底：多平台混合场景下，预检查跳过，由后端 409 触发确认框
    if (error.status === 409 && error.error === 'mixed_channel_warning') {
      pendingUpdatesForConfirm.value = baseUpdates
      mixedChannelWarningMessage.value = error.message
      showMixedChannelWarning.value = true
    } else if (error.reason === 'UPSTREAM_BILLING_RATE_SYNC_BULK_CONFLICT') {
      appStore.showError(t('admin.accounts.bulkEdit.rateSyncConflict', {
        count: error.metadata?.count ?? 1
      }))
    } else {
      appStore.showError(error.message || t('admin.accounts.bulkEdit.failed'))
      console.error('Error bulk updating accounts:', error)
    }
  } finally {
    submitting.value = false
  }
}

const handleMixedChannelConfirm = async () => {
  if (submitting.value) return
  showMixedChannelWarning.value = false
  mixedChannelConfirmed.value = true
  if (pendingUpdatesForConfirm.value) {
    await submitBulkUpdate(pendingUpdatesForConfirm.value)
  }
}

const handleMixedChannelCancel = () => {
  showMixedChannelWarning.value = false
  pendingUpdatesForConfirm.value = null
}

// Reset form when modal closes
watch(
  () => props.show,
  (newShow) => {
    if (!newShow) {
      // Reset all enable flags
      enableBaseUrl.value = false
      enableModelRestriction.value = false
      enableCustomErrorCodes.value = false
      enableInterceptWarmup.value = false
      enableHeaderOverride.value = false
      enableProxy.value = false
      enableConcurrency.value = false
      enableLoadFactor.value = false
      enablePriority.value = false
      enableRateMultiplier.value = false
      enableStatus.value = false
      enableGroups.value = false
      enableOpenAIPassthrough.value = false
      enableOpenAIFlattenNamespaces.value = false
      enableOpenAIWSMode.value = false
      enableOpenAIAPIKeyWSMode.value = false
      enableUpstreamBillingAutoProbe.value = false
      enableCodexCLIOnly.value = false
      enableCodexCLIOnlyAppServer.value = false
      enableCodexFingerprintMode.value = false
      codexFingerprintMode.value = 'session'
      enableOpenAICompactMode.value = false
      enableOpenAICompactModelMapping.value = false
      enableRpmLimit.value = false

      // Reset all values
      baseUrl.value = ''
      openaiPassthroughEnabled.value = false
      openaiFlattenNamespacesEnabled.value = false
      modelRestrictionMode.value = 'whitelist'
      allowedModels.value = []
      modelMappings.value = []
      selectedErrorCodes.value = []
      customErrorCodeInput.value = null
      interceptWarmupRequests.value = false
      headerOverrideEnabled.value = false
      headerOverrideRows.value = []
      proxyId.value = null
      concurrency.value = 1
      loadFactor.value = null
      priority.value = 0
      priorityInput.value = '0'
      rateMultiplier.value = 1
      status.value = 'active'
      groupIds.value = []
      openaiOAuthResponsesWebSocketV2Mode.value = OPENAI_WS_MODE_OFF
      openaiAPIKeyResponsesWebSocketV2Mode.value = OPENAI_WS_MODE_OFF
      upstreamBillingAutoProbeMode.value = 'enabled'
      codexCLIOnlyEnabled.value = false
      codexCLIOnlyAppServerEnabled.value = false
      openAICompactMode.value = 'auto'
      openAICompactModelMappings.value = []
      rpmLimitEnabled.value = false
      bulkBaseRpm.value = null
      bulkRpmStrategy.value = 'tiered'
      bulkRpmStickyBuffer.value = null
      userMsgQueueMode.value = null

      // Reset mixed channel warning state
      showMixedChannelWarning.value = false
      mixedChannelWarningMessage.value = ''
      pendingUpdatesForConfirm.value = null
      mixedChannelConfirmed.value = false
    }
  }
)
</script>
