<template>
  <UiDialog
    :show="show"
    :title="t('admin.accounts.editAccount')"
    :close-label="t('common.close')"
    width="wide"
    @close="handleClose"
  >
    <form
      v-if="account"
      id="edit-account-form"
      @submit.prevent="handleSubmit"
      class="space-y-5"
    >
      <UiTextField
        v-model="form.name"
        :label="t('common.name')"
        required
        data-tour="edit-account-form-name"
      />
      <UiTextArea
        v-model="form.notes"
        :label="t('admin.accounts.notes')"
        :description="t('admin.accounts.notesHint')"
        :placeholder="t('admin.accounts.notesPlaceholder')"
        :rows="3"
      />

      <!-- API Key fields (only for apikey type) -->
      <div v-if="account.type === 'apikey'" class="space-y-4">
        <div>
          <UiTextField
            v-model="editBaseUrl"
            :label="t('admin.accounts.baseUrl')"
            :description="baseUrlHint"
            :placeholder="
              account.platform === 'openai'
                ? 'https://api.openai.com'
                : account.platform === 'gemini'
                  ? 'https://generativelanguage.googleapis.com'
                  : account.platform === 'antigravity'
                    ? 'https://cloudcode-pa.googleapis.com'
                    : account.platform === 'grok'
                      ? 'https://api.x.ai/v1'
                      : 'https://api.anthropic.com'
            "
          />
          <GrokBaseUrlPresets
            v-if="account.platform === 'grok'"
            class="mt-2"
            @select="editBaseUrl = $event"
          />
        </div>
        <div>
          <UiPasswordField
            v-model="editApiKey"
            autocomplete="new-password"
            :label="t('admin.accounts.apiKey')"
            :description="t('admin.accounts.leaveEmptyToKeep')"
            :reveal-label="t('common.showPassword')"
            :hide-label="t('common.hidePassword')"
            :input-attrs="{
              'data-1p-ignore': true,
              'data-lpignore': 'true',
              'data-bwignore': 'true'
            }"
            :placeholder="
              account.platform === 'openai'
                ? 'sk-proj-...'
                : account.platform === 'gemini'
                  ? 'AIza...'
                  : account.platform === 'antigravity'
                    ? 'sk-...'
                    : account.platform === 'grok'
                      ? 'xai-...'
                      : 'sk-ant-...'
            "
          />
        </div>

        <!-- Model Restriction Section -->
        <ModelRestrictionEditor
          v-if="account.platform !== 'antigravity'"
          v-model:mode="modelRestrictionMode"
          v-model:allowed-models="allowedModels"
          v-model:model-mappings="modelMappings"
          :platform="account.platform"
          :account-id="account.id"
          :disabled="isOpenAIModelRestrictionDisabled"
          :disabled-message="t('admin.accounts.openai.modelRestrictionDisabledByPassthrough')"
          :supports-all="allowedModels.length === 0 && modelMappings.length === 0"
          :presets="presetMappings"
          @duplicate-preset="({ from, to }) => addPresetMapping(from, to)"
        />

        <!-- Pool Mode Section -->
        <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.poolMode') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.poolModeHint') }}
              </p>
            </div>
            <UiSwitch v-model="poolModeEnabled" :label="t('admin.accounts.poolMode')" />
          </div>
          <div v-if="poolModeEnabled" class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p class="text-xs text-blue-700 dark:text-blue-400">
              <Icon name="exclamationCircle" size="sm" class="mr-1 inline" :stroke-width="2" />
              {{ t('admin.accounts.poolModeInfo') }}
            </p>
          </div>
          <div v-if="poolModeEnabled" class="mt-3">
            <UiTextField
              v-model.number="poolModeRetryCount"
              type="number"
              density="compact"
              :min="0"
              :max="MAX_POOL_MODE_RETRY_COUNT"
              :step="1"
              :label="t('admin.accounts.poolModeRetryCount')"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{
                t('admin.accounts.poolModeRetryCountHint', {
                  default: DEFAULT_POOL_MODE_RETRY_COUNT,
                  max: MAX_POOL_MODE_RETRY_COUNT
                })
              }}
            </p>
          </div>
          <div v-if="poolModeEnabled" class="mt-3">
            <UiTextField
              v-model="poolModeRetryStatusCodesInput"
              type="text"
              density="compact"
              :label="t('admin.accounts.poolModeRetryStatusCodes')"
              :placeholder="DEFAULT_POOL_MODE_RETRY_STATUS_CODES.join(', ')"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.poolModeRetryStatusCodesHint', { default: DEFAULT_POOL_MODE_RETRY_STATUS_CODES.join(', ') }) }}
            </p>
          </div>
        </div>

        <!-- Custom Error Codes Section -->
        <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.customErrorCodes') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.customErrorCodesHint') }}
              </p>
            </div>
            <UiSwitch v-model="customErrorCodesEnabled" :label="t('admin.accounts.customErrorCodes')" />
          </div>

          <div v-if="customErrorCodesEnabled" class="space-y-3">
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
                density="compact"
                :aria-pressed="selectedErrorCodes.includes(code.value)"
                @click="toggleErrorCode(code.value)"
              >
                {{ code.value }} {{ code.label }}
              </UiButton>
            </div>

            <!-- Manual input -->
            <div class="flex items-center gap-2">
              <UiTextField
                v-model.number="customErrorCodeInput"
                type="number"
                density="compact"
                :min="100"
                :max="599"
                class="flex-1"
                :placeholder="t('admin.accounts.enterErrorCode')"
                :prevent-enter-default="true"
                @enter="addCustomErrorCode"
              />
              <UiIconButton
                type="button"
                variant="outlined"
                :label="t('admin.accounts.addMapping')"
                @click="addCustomErrorCode"
              >
                <Icon name="plus" size="sm" />
              </UiIconButton>
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
                  variant="danger"
                  density="mini"
                  :label="t('common.delete')"
                  @click="removeErrorCode(code)"
                />
              </span>
              <span v-if="selectedErrorCodes.length === 0" class="text-xs text-gray-400">
                {{ t('admin.accounts.noneSelectedUsesDefault') }}
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- Grok OAuth client-tool prompt cache opt-in -->
      <div
        v-if="account.platform === 'grok' && account.type === 'oauth'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <label class="ui-field-label mb-0">{{ t('admin.accounts.grokClientToolCache.title') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.grokClientToolCache.hint') }}
            </p>
          </div>
          <UiSwitch
            v-model="grokClientToolCacheEnabled"
            data-testid="grok-client-tool-cache-toggle"
            :label="t('admin.accounts.grokClientToolCache.title')"
          />
        </div>
      </div>

      <!-- Grok OAuth Custom Upstream URL (仅改写转发端点，OAuth 授权/刷新不受影响) -->
      <div
        v-if="account.platform === 'grok' && account.type === 'oauth'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="mb-3 flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.grokCustomBaseUrl.title') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.grokCustomBaseUrl.hint') }}
            </p>
          </div>
          <UiSwitch
            v-model="grokOAuthCustomBaseUrlEnabled"
            :label="t('admin.accounts.grokCustomBaseUrl.title')"
            data-testid="grok-custom-base-url-toggle"
          />
        </div>
        <div v-if="grokOAuthCustomBaseUrlEnabled" class="space-y-2">
          <UiTextField
            v-model="grokOAuthBaseUrl"
            type="url"
            density="compact"
            :label="t('admin.accounts.grokCustomBaseUrl.title')"
            :description="t('admin.accounts.grokCustomBaseUrl.hint')"
            test-id="grok-custom-base-url-input"
            :placeholder="t('admin.accounts.grokCustomBaseUrl.placeholder')"
          />
          <GrokBaseUrlPresets @select="grokOAuthBaseUrl = $event" />
        </div>
      </div>

      <!-- Header Override Section (anthropic/openai apikey + grok apikey/oauth) -->
      <div v-if="headerOverrideCapable" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.headerOverride.title') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.headerOverride.hint') }}
            </p>
          </div>
          <UiSwitch v-model="headerOverrideEnabled" :label="t('admin.accounts.headerOverride.title')" />
        </div>

        <div v-if="headerOverrideEnabled" class="space-y-3">
          <div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p class="text-xs text-blue-700 dark:text-blue-400">
              <Icon name="exclamationCircle" size="sm" class="mr-1 inline" :stroke-width="2" />
              {{ t('admin.accounts.headerOverride.info') }}
            </p>
          </div>

          <HeaderOverrideEditor
            :rows="headerOverrideRows"
            @update:rows="headerOverrideRows = $event"
          />
        </div>
      </div>

      <!-- OpenAI/Grok OAuth Model Mapping (OAuth 类型没有 apikey 容器，需要独立的模型映射区域) -->
      <ModelRestrictionEditor
        v-if="(account.platform === 'openai' || account.platform === 'grok') && account.type === 'oauth'"
        v-model:mode="modelRestrictionMode"
        v-model:allowed-models="allowedModels"
        v-model:model-mappings="modelMappings"
        :platform="account.platform"
        :account-id="account.id"
        :disabled="isOpenAIModelRestrictionDisabled"
        :disabled-message="t('admin.accounts.openai.modelRestrictionDisabledByPassthrough')"
        :supports-all="allowedModels.length === 0 && modelMappings.length === 0"
        :presets="presetMappings"
        @duplicate-preset="({ from, to }) => addPresetMapping(from, to)"
      />

      <!-- Upstream fields (only for upstream type) -->
      <div v-if="account.type === 'upstream'" class="space-y-4">
        <UiTextField
            v-model="editBaseUrl"
            :label="t('admin.accounts.upstream.baseUrl')"
            :description="t('admin.accounts.upstream.baseUrlHint')"
            placeholder="https://cloudcode-pa.googleapis.com"
            monospace
        />
        <UiPasswordField
            v-model="editApiKey"
            :label="t('admin.accounts.upstream.apiKey')"
            :description="t('admin.accounts.leaveEmptyToKeep')"
            placeholder="sk-..."
            monospace
            :reveal-label="t('common.showPassword')"
            :hide-label="t('common.hidePassword')"
        />
      </div>

      <!-- Vertex Service Account -->
      <div v-if="(account.platform === 'gemini' || account.platform === 'anthropic') && account.type === 'service_account'" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UiTextField
              v-model="editVertexProjectId"
              readonly
              label="Project ID"
              :placeholder="t('admin.accounts.vertexProjectIdPlaceholder')"
              :description="t('admin.accounts.vertexSaJsonEditHint')"
              monospace
          />
          <div>
            <UiSelect
              v-model="editVertexLocation"
              label="Location"
              :description="t('admin.accounts.vertexLocationHint')"
              :options="vertexLocationSelectOptions"
              required
              class="font-mono"
            />
          </div>
        </div>

        <!-- Model Restriction Section for Service Account -->
        <ModelRestrictionEditor
          v-model:mode="modelRestrictionMode"
          v-model:allowed-models="allowedModels"
          v-model:model-mappings="modelMappings"
          :platform="account.platform"
          :account-id="account.id"
          :supports-all="allowedModels.length === 0 && modelMappings.length === 0"
          :presets="presetMappings"
          @duplicate-preset="({ from, to }) => addPresetMapping(from, to)"
        />
      </div>

      <!-- Bedrock fields (for bedrock type, both SigV4 and API Key modes) -->
      <div v-if="account.type === 'bedrock'" class="space-y-4">
        <!-- SigV4 fields -->
        <template v-if="!isBedrockAPIKeyMode">
          <UiTextField
              v-model="editBedrockAccessKeyId"
              :label="t('admin.accounts.bedrockAccessKeyId')"
              placeholder="AKIA..."
              monospace
          />
          <UiPasswordField
              v-model="editBedrockSecretAccessKey"
              :label="t('admin.accounts.bedrockSecretAccessKey')"
              :placeholder="t('admin.accounts.bedrockSecretKeyLeaveEmpty')"
              :description="t('admin.accounts.bedrockSecretKeyLeaveEmpty')"
              monospace
              :reveal-label="t('common.showPassword')"
              :hide-label="t('common.hidePassword')"
          />
          <UiPasswordField
              v-model="editBedrockSessionToken"
              :placeholder="t('admin.accounts.bedrockSecretKeyLeaveEmpty')"
              :label="t('admin.accounts.bedrockSessionToken')"
              :description="t('admin.accounts.bedrockSessionTokenHint')"
              monospace
              :reveal-label="t('common.showPassword')"
              :hide-label="t('common.hidePassword')"
          />
        </template>

        <!-- API Key field -->
        <UiPasswordField
            v-if="isBedrockAPIKeyMode"
            v-model="editBedrockApiKeyValue"
            :label="t('admin.accounts.bedrockApiKeyInput')"
            :placeholder="t('admin.accounts.bedrockApiKeyLeaveEmpty')"
            :description="t('admin.accounts.bedrockApiKeyLeaveEmpty')"
            monospace
            :reveal-label="t('common.showPassword')"
            :hide-label="t('common.hidePassword')"
        />

        <!-- Shared: Region -->
        <UiTextField
            v-model="editBedrockRegion"
            :label="t('admin.accounts.bedrockRegion')"
            placeholder="us-east-1"
            :description="t('admin.accounts.bedrockRegionHint')"
        />

        <!-- Shared: Force Global -->
        <div>
          <UiSwitch
            v-model="editBedrockForceGlobal"
            :label="t('admin.accounts.bedrockForceGlobal')"
          />
          <p class="ui-field-hint mt-1">{{ t('admin.accounts.bedrockForceGlobalHint') }}</p>
        </div>

        <!-- Model Restriction for Bedrock -->
        <ModelRestrictionEditor
          v-model:mode="modelRestrictionMode"
          v-model:allowed-models="allowedModels"
          v-model:model-mappings="modelMappings"
          platform="anthropic"
          :account-id="account.id"
          :supports-all="allowedModels.length === 0 && modelMappings.length === 0"
          :presets="bedrockPresets"
          :from-placeholder="t('admin.accounts.fromModel')"
          :to-placeholder="t('admin.accounts.toModel')"
          @duplicate-preset="({ from, to }) => addPresetMapping(from, to)"
        />

        <!-- Pool Mode Section for Bedrock -->
        <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.poolMode') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.poolModeHint') }}
              </p>
            </div>
            <UiSwitch v-model="poolModeEnabled" :label="t('admin.accounts.poolMode')" />
          </div>
          <div v-if="poolModeEnabled" class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p class="text-xs text-blue-700 dark:text-blue-400">
              <Icon name="exclamationCircle" size="sm" class="mr-1 inline" :stroke-width="2" />
              {{ t('admin.accounts.poolModeInfo') }}
            </p>
          </div>
          <div v-if="poolModeEnabled" class="mt-3">
            <UiTextField
              v-model.number="poolModeRetryCount"
              type="number"
              density="compact"
              :min="0"
              :max="MAX_POOL_MODE_RETRY_COUNT"
              :step="1"
              :label="t('admin.accounts.poolModeRetryCount')"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{
                t('admin.accounts.poolModeRetryCountHint', {
                  default: DEFAULT_POOL_MODE_RETRY_COUNT,
                  max: MAX_POOL_MODE_RETRY_COUNT
                })
              }}
            </p>
          </div>
          <div v-if="poolModeEnabled" class="mt-3">
            <UiTextField
              v-model="poolModeRetryStatusCodesInput"
              type="text"
              density="compact"
              :label="t('admin.accounts.poolModeRetryStatusCodes')"
              :placeholder="DEFAULT_POOL_MODE_RETRY_STATUS_CODES.join(', ')"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.poolModeRetryStatusCodesHint', { default: DEFAULT_POOL_MODE_RETRY_STATUS_CODES.join(', ') }) }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="account.platform === 'antigravity' && account.type === 'oauth'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <UiTextField
          v-model="antigravityProjectId"
          :label="t('admin.accounts.antigravityProjectIdLabel')"
          :description="t('admin.accounts.antigravityProjectIdHint')"
          test-id="antigravity-project-id-input"
          type="text"
          monospace
          :placeholder="t('admin.accounts.antigravityProjectIdPlaceholder')"
        />
      </div>

      <!-- Antigravity model restriction (applies to all antigravity types) -->
      <!-- Antigravity 只支持模型映射模式，不支持白名单模式 -->
      <div v-if="account.platform === 'antigravity'" class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <label class="ui-field-label">{{ t('admin.accounts.modelRestriction') }}</label>

        <!-- Mapping Mode Only (no toggle for Antigravity) -->
        <div>
          <div class="mb-3 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
            <p class="text-xs text-purple-700 dark:text-purple-400">{{ t('admin.accounts.mapRequestModels') }}</p>
          </div>

          <div class="mb-3 flex flex-wrap gap-2">
            <UiButton
              type="button"
              @click="syncAntigravityUpstreamModels"
              :disabled="isSyncingAntigravityUpstream || !account?.id"
              :loading="isSyncingAntigravityUpstream"
              variant="secondary"
              density="compact"
            >
              {{ isSyncingAntigravityUpstream ? t('admin.accounts.syncUpstreamModelsLoading') : t('admin.accounts.syncUpstreamModels') }}
            </UiButton>
          </div>

          <ModelMappingEditor
            v-model="antigravityModelMappings"
            class="mb-3"
            :from-placeholder="t('admin.accounts.requestModel')"
            :to-placeholder="t('admin.accounts.actualModel')"
            :add-label="t('admin.accounts.addMapping')"
            :remove-label="t('common.delete')"
            :wildcard-source-error="t('admin.accounts.wildcardOnlyAtEnd')"
            :wildcard-target-error="t('admin.accounts.targetNoWildcard')"
            validate-wildcards
          />

          <div class="flex flex-wrap gap-2">
            <UiButton
              v-for="preset in antigravityPresetMappings"
              :key="preset.label"
              type="button"
              variant="secondary"
              density="mini"
              @click="addAntigravityPresetMapping(preset.from, preset.to)"
            >
              + {{ preset.label }}
            </UiButton>
          </div>
        </div>
      </div>

      <!-- Temp Unschedulable Rules -->
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600 space-y-4">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.tempUnschedulable.title') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.tempUnschedulable.hint') }}
            </p>
          </div>
          <UiSwitch v-model="tempUnschedEnabled" :label="t('admin.accounts.tempUnschedulable.title')" />
        </div>

        <div v-if="tempUnschedEnabled" class="space-y-3">
          <div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <p class="text-xs text-blue-700 dark:text-blue-400">
              <Icon name="exclamationTriangle" size="sm" class="mr-1 inline" :stroke-width="2" />
              {{ t('admin.accounts.tempUnschedulable.notice') }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UiButton
              v-for="preset in tempUnschedPresets"
              :key="preset.label"
              variant="quiet"
              density="dense"
              @click="addTempUnschedRule(preset.rule)"
            >
              + {{ preset.label }}
            </UiButton>
          </div>

          <div v-if="tempUnschedRules.length > 0" class="space-y-3">
            <div
              v-for="(rule, index) in tempUnschedRules"
              :key="getTempUnschedRuleKey(rule)"
              class="rounded-lg border border-gray-200 p-3 dark:border-dark-600"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {{ t('admin.accounts.tempUnschedulable.ruleIndex', { index: index + 1 }) }}
                </span>
                <div class="flex items-center gap-2">
                  <UiIconButton
                    :label="t('admin.accounts.tempUnschedulable.moveUp')"
                    icon="chevronUp"
                    variant="ghost"
                    density="mini"
                    :disabled="index === 0"
                    @click="moveTempUnschedRule(index, -1)"
                  />
                  <UiIconButton
                    :label="t('admin.accounts.tempUnschedulable.moveDown')"
                    icon="chevronDown"
                    variant="ghost"
                    density="mini"
                    :disabled="index === tempUnschedRules.length - 1"
                    @click="moveTempUnschedRule(index, 1)"
                  />
                  <UiIconButton
                    :label="t('common.delete')"
                    icon="x"
                    variant="danger"
                    density="mini"
                    @click="removeTempUnschedRule(index)"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <UiTextField
                    v-model.number="rule.error_code"
                    type="number"
                    :label="t('admin.accounts.tempUnschedulable.errorCode')"
                    :min="100"
                    :max="599"
                    density="compact"
                    :placeholder="t('admin.accounts.tempUnschedulable.errorCodePlaceholder')"
                />
                <UiTextField
                    v-model.number="rule.duration_minutes"
                    type="number"
                    :label="t('admin.accounts.tempUnschedulable.durationMinutes')"
                    :min="1"
                    density="compact"
                    :placeholder="t('admin.accounts.tempUnschedulable.durationPlaceholder')"
                />
                <UiTextField
                    class="sm:col-span-2"
                    v-model="rule.keywords"
                    :label="t('admin.accounts.tempUnschedulable.keywords')"
                    :description="t('admin.accounts.tempUnschedulable.keywordsHint')"
                    density="compact"
                    :placeholder="t('admin.accounts.tempUnschedulable.keywordsPlaceholder')"
                />
                <UiTextField
                    class="sm:col-span-2"
                    v-model="rule.description"
                    :label="t('admin.accounts.tempUnschedulable.description')"
                    density="compact"
                    :placeholder="t('admin.accounts.tempUnschedulable.descriptionPlaceholder')"
                />
              </div>
            </div>
          </div>

          <UiButton
            variant="secondary"
            block
            @click="addTempUnschedRule()"
          >
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('admin.accounts.tempUnschedulable.addRule') }}
          </UiButton>
        </div>
      </div>


      <div
        v-if="supportsAccountSchedulingThresholdOverride"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
        data-testid="account-scheduling-threshold-section"
      >
        <div class="mb-3 flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.accountSchedulingThresholdOverride') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.accountSchedulingThresholdOverrideHint') }}
            </p>
          </div>
          <UiSwitch
            v-model="accountSchedulingThresholdOverrideEnabled"
            data-testid="account-scheduling-threshold-override-enabled"
            :label="t('admin.accounts.accountSchedulingThresholdOverride')"
          />
        </div>
        <div v-if="accountSchedulingThresholdOverrideEnabled">
          <UiTextField
            v-model.number="accountSchedulingThresholdOverrideValue"
            test-id="account-scheduling-threshold-override-value"
            type="number"
            min="1"
            max="100"
            density="compact"
            :label="t('admin.accounts.accountSchedulingThresholdOverrideValue')"
            :description="t('admin.accounts.accountSchedulingThresholdOverrideDisabledHint')"
          />
        </div>
      </div>

      <!-- Intercept Warmup Requests (Anthropic/Antigravity) -->
      <div
        v-if="account?.platform === 'anthropic' || account?.platform === 'antigravity'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{
              t('admin.accounts.interceptWarmupRequests')
            }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.interceptWarmupRequestsDesc') }}
            </p>
          </div>
          <UiSwitch
            v-model="interceptWarmupRequests"
            :label="t('admin.accounts.interceptWarmupRequests')"
          />
        </div>
      </div>

      <div v-if="!isSparkShadow">
        <div class="mb-1 flex items-center gap-2">
          <label class="ui-field-label mb-0">{{ t('admin.accounts.proxy') }}</label>
          <ProxyAdBanner />
        </div>
        <ProxySelector v-model="form.proxy_id" :proxies="proxies" />
      </div>

      <AppGrid min="180px" :gap="12">
        <UiTextField
          v-model.number="form.concurrency"
          type="number"
          min="1"
          :label="t('admin.accounts.concurrency')"
          @input="form.concurrency = Math.max(1, form.concurrency || 1)"
        />
        <UiTextField
          v-model.number="form.load_factor"
          type="number"
          min="1"
          :label="t('admin.accounts.loadFactor')"
          :description="t('admin.accounts.loadFactorHint')"
          :placeholder="String(form.concurrency || 1)"
          @input="form.load_factor = (form.load_factor &amp;&amp; form.load_factor >= 1) ? form.load_factor : null"
        />
        <UiTextField
          v-model="priorityInput"
          inputmode="numeric"
          autocomplete="off"
          min="0"
          :label="t('admin.accounts.priority')"
          :description="t('admin.accounts.priorityHint')"
          data-tour="account-form-priority"
          @input="priorityWasEdited = true"
        />
        <div>
          <UiTextField
            v-model.number="form.rate_multiplier"
            type="number"
            min="0"
            step="0.001"
            :label="t('admin.accounts.billingRateMultiplier')"
            :description="t(
              upstreamBillingRateSyncEnabled
                ? 'admin.accounts.upstreamBilling.syncRateManagedHint'
                : 'admin.accounts.billingRateMultiplierHint'
            )"
            test-id="account-rate-multiplier"
            :disabled="upstreamBillingRateSyncEnabled"
          />
          <div
            v-if="account?.type === 'apikey'"
            class="mt-3 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-200">
                {{ t('admin.accounts.upstreamBilling.syncRate') }}
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.upstreamBilling.syncRateHint') }}
              </p>
            </div>
            <UiSwitch
              :model-value="upstreamBillingRateSyncEnabled"
              data-testid="upstream-billing-rate-sync"
              :label="t('admin.accounts.upstreamBilling.syncRate')"
              @update:model-value="handleUpstreamBillingRateSyncChange"
            />
          </div>
        </div>
      </AppGrid>
      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <UiTextField
          v-model="expiresAtInput"
          type="datetime-local"
          :label="t('admin.accounts.expiresAt')"
          :description="t('admin.accounts.expiresAtHint')"
        />
      </div>

      <!-- OpenAI 自动透传开关（OAuth/API Key） -->
      <div
        v-if="account?.platform === 'openai' && (account?.type === 'oauth' || account?.type === 'setup-token' || account?.type === 'apikey')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.oauthPassthrough') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.oauthPassthroughDesc') }}
            </p>
          </div>
          <UiSwitch
            v-model="openaiPassthroughEnabled"
            :label="t('admin.accounts.openai.oauthPassthrough')"
          />
        </div>
      </div>

      <!-- OpenAI Codex namespace 工具摊平（兼容开关，仅 OAuth） -->
      <div
        v-if="account?.platform === 'openai' && account?.type === 'oauth'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.flattenNamespaces') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.flattenNamespacesDesc') }}
            </p>
          </div>
          <UiSwitch
            v-model="openaiFlattenNamespacesEnabled"
            data-testid="edit-openai-flatten-namespaces-toggle"
            :label="t('admin.accounts.openai.flattenNamespaces')"
          />
        </div>
      </div>

      <!-- OpenAI Codex hosted image_generation bridge policy -->
      <div
        v-if="account?.platform === 'openai' && (account?.type === 'oauth' || account?.type === 'setup-token' || account?.type === 'apikey')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="overflow-hidden rounded-lg border border-sky-100 bg-sky-50/60 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/20">
          <div class="flex items-start gap-3 px-4 py-3">
            <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-sky-600 shadow-sm ring-1 ring-sky-100 dark:bg-dark-800 dark:text-sky-300 dark:ring-sky-900/60">
              <Icon name="sparkles" size="sm" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.codexImageTool') }}</label>
                <span
                  class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="codexImageToolBadgeClass"
                >
                  {{ codexImageToolBadgeLabel }}
                </span>
              </div>
              <p class="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {{ t('admin.accounts.openai.codexImageToolDesc') }}
              </p>
            </div>
          </div>
          <div class="border-t border-sky-100 bg-white/70 p-2 dark:border-sky-900/50 dark:bg-dark-800/70">
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="option in codexImageToolOptions"
                :key="option.value"
                type="button"
                :data-testid="`codex-image-tool-${option.value}`"
                @click="codexImageToolMode = option.value"
                :class="[
                  'group flex min-h-[62px] items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                  codexImageToolMode === option.value
                    ? option.selectedCardClass
                    : 'border-transparent bg-transparent text-slate-600 hover:border-gray-200 hover:bg-gray-50 dark:text-slate-300 dark:hover:border-dark-500 dark:hover:bg-dark-700'
                ]"
              >
                <span
                  :class="[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    codexImageToolMode === option.value
                      ? option.selectedDotClass
                      : 'border-gray-300 text-transparent group-hover:border-gray-400 dark:border-dark-500'
                  ]"
                >
                  <Icon name="check" size="xs" :stroke-width="2" />
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-medium">{{ option.label }}</span>
                  <span class="mt-0.5 block text-xs leading-4 text-slate-500 dark:text-slate-400">{{ option.description }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- OpenAI WS Mode 三态（off/ctx_pool/passthrough） -->
      <div
        v-if="account?.platform === 'openai' && (account?.type === 'oauth' || account?.type === 'setup-token' || account?.type === 'apikey')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.wsMode') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.wsModeDesc') }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t(openAIWSModeConcurrencyHintKey) }}
            </p>
          </div>
          <div class="w-52">
            <UiSelect v-model="openaiResponsesWebSocketV2Mode" data-testid="edit-openai-ws-mode-select" :options="openAIWSModeOptions" />
          </div>
        </div>
      </div>

      <!-- OpenAI APIKey Responses API support mode -->
      <div
        v-if="account?.platform === 'openai' && account?.type === 'apikey'"
        class="space-y-4 border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.responsesMode') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.responsesModeDesc') }}
            </p>
          </div>
          <div class="w-56">
            <UiSelect
              v-model="openAIResponsesMode"
              :options="openAIResponsesModeOptions"
              :disabled="!openAITextGenerationCapabilityEnabled"
              data-testid="openai-responses-mode-select"
            />
          </div>
        </div>
        <div
          v-if="openAITextGenerationCapabilityEnabled"
          class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-dark-700 dark:text-gray-300"
        >
          <span class="font-medium">{{ t(openAIResponsesStatusKey) }}</span>
        </div>
        <div
          v-else
          class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
          data-testid="openai-responses-mode-not-applicable"
        >
          {{ t('admin.accounts.openai.responsesModeTextDisabledHint') }}
        </div>
        <div>
          <label class="ui-field-label mb-2 block">{{ t('admin.accounts.openai.endpointCapabilities') }}</label>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <UiCheckbox
              v-for="option in openAIEndpointCapabilityOptions"
              :key="option.value"
              :model-value="openAIEndpointCapabilities.includes(option.value)"
              :data-testid="`openai-endpoint-capability-${option.value}`"
              :label="option.label"
              full-width
              @change="(enabled, event) => setOpenAIEndpointCapability(option.value, enabled, event)"
            />
          </div>
          <p class="ui-field-hint">{{ t('admin.accounts.openai.endpointCapabilitiesDesc') }}</p>
        </div>
      </div>

      <div
        v-if="account?.type === 'apikey'"
        class="flex items-center justify-between gap-4 border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div>
          <label class="ui-field-label mb-0">{{ t('admin.accounts.upstreamBilling.autoProbe') }}</label>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.upstreamBilling.autoProbeHint') }}
          </p>
        </div>
        <UiSwitch
          :model-value="upstreamBillingAutoProbeEnabled"
          data-testid="upstream-billing-auto-probe"
          :label="t('admin.accounts.upstreamBilling.autoProbe')"
          @update:model-value="handleUpstreamBillingAutoProbeChange"
        />
      </div>

      <OllamaCloudUsageSettings
        v-if="account?.ollama_cloud_usage?.eligible"
        :account="account"
        @updated="handleOllamaCloudUsageUpdated"
      />

      <!-- Anthropic API Key 自动透传开关 -->
      <div
        v-if="account?.platform === 'anthropic' && account?.type === 'apikey'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.anthropic.apiKeyPassthrough') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.anthropic.apiKeyPassthroughDesc') }}
            </p>
          </div>
          <UiSwitch
            v-model="anthropicPassthroughEnabled"
            :label="t('admin.accounts.anthropic.apiKeyPassthrough')"
          />
        </div>
      </div>

      <div
        v-if="account?.platform === 'anthropic' && account?.type === 'apikey'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <UiSelect
          v-model="anthropicAPIKeyAuthScheme"
          :label="t('admin.accounts.anthropic.apiKeyAuthScheme')"
          :description="t('admin.accounts.anthropic.apiKeyAuthSchemeDesc')"
          :options="anthropicAPIKeyAuthSchemeOptions"
        />
      </div>

      <!-- Anthropic API Key: Web Search Emulation (hidden when global disabled) -->
      <div
        v-if="account?.platform === 'anthropic' && account?.type === 'apikey' && webSearchGlobalEnabled"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <UiSelect
          v-model="webSearchEmulationMode"
          :label="t('admin.accounts.anthropic.webSearchEmulation')"
          :description="t('admin.accounts.anthropic.webSearchEmulationDesc')"
          :options="webSearchEmulationOptions"
        />
      </div>

      <!-- 配额控制 (Anthropic apikey/bedrock: 配额限制 + 亲和) -->
      <div
        v-if="account?.platform === 'anthropic' && (account?.type === 'apikey' || account?.type === 'bedrock')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600 space-y-4"
      >
        <div class="mb-3">
          <h3 class="ui-field-label mb-0 text-base font-semibold">{{ t('admin.accounts.quotaControl.title') }}</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.quotaControl.hint') }}
          </p>
        </div>
        <QuotaLimitCard
          :totalLimit="editQuotaLimit"
          :dailyLimit="editQuotaDailyLimit"
          :weeklyLimit="editQuotaWeeklyLimit"
          :dailyResetMode="editDailyResetMode"
          :dailyResetHour="editDailyResetHour"
          :weeklyResetMode="editWeeklyResetMode"
          :weeklyResetDay="editWeeklyResetDay"
          :weeklyResetHour="editWeeklyResetHour"
          :resetTimezone="editResetTimezone"
          :quotaNotifyGlobalEnabled="quotaNotifyGlobalEnabled"
          :quotaNotifyDailyEnabled="quotaNotifyState.daily.enabled"
          :quotaNotifyDailyThreshold="quotaNotifyState.daily.threshold"
          :quotaNotifyDailyThresholdType="quotaNotifyState.daily.thresholdType"
          :quotaNotifyWeeklyEnabled="quotaNotifyState.weekly.enabled"
          :quotaNotifyWeeklyThreshold="quotaNotifyState.weekly.threshold"
          :quotaNotifyWeeklyThresholdType="quotaNotifyState.weekly.thresholdType"
          :quotaNotifyTotalEnabled="quotaNotifyState.total.enabled"
          :quotaNotifyTotalThreshold="quotaNotifyState.total.threshold"
          :quotaNotifyTotalThresholdType="quotaNotifyState.total.thresholdType"
          @update:totalLimit="editQuotaLimit = $event"
          @update:dailyLimit="editQuotaDailyLimit = $event"
          @update:weeklyLimit="editQuotaWeeklyLimit = $event"
          @update:dailyResetMode="editDailyResetMode = $event"
          @update:dailyResetHour="editDailyResetHour = $event"
          @update:weeklyResetMode="editWeeklyResetMode = $event"
          @update:weeklyResetDay="editWeeklyResetDay = $event"
          @update:weeklyResetHour="editWeeklyResetHour = $event"
          @update:resetTimezone="editResetTimezone = $event"
          @update:quotaNotifyDailyEnabled="quotaNotifyState.daily.enabled = $event"
          @update:quotaNotifyDailyThreshold="quotaNotifyState.daily.threshold = $event"
          @update:quotaNotifyDailyThresholdType="quotaNotifyState.daily.thresholdType = $event"
          @update:quotaNotifyWeeklyEnabled="quotaNotifyState.weekly.enabled = $event"
          @update:quotaNotifyWeeklyThreshold="quotaNotifyState.weekly.threshold = $event"
          @update:quotaNotifyWeeklyThresholdType="quotaNotifyState.weekly.thresholdType = $event"
          @update:quotaNotifyTotalEnabled="quotaNotifyState.total.enabled = $event"
          @update:quotaNotifyTotalThreshold="quotaNotifyState.total.threshold = $event"
          @update:quotaNotifyTotalThresholdType="quotaNotifyState.total.thresholdType = $event"
        />
      </div>
      <!-- 配额控制 (非 Anthropic apikey/bedrock) -->
      <div
        v-else-if="account?.type === 'apikey' || account?.type === 'bedrock'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600 space-y-4"
      >
        <div class="mb-3">
          <h3 class="ui-field-label mb-0 text-base font-semibold">{{ t('admin.accounts.quotaControl.title') }}</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.quotaLimitHint') }}
          </p>
        </div>
        <QuotaLimitCard
          :totalLimit="editQuotaLimit"
          :dailyLimit="editQuotaDailyLimit"
          :weeklyLimit="editQuotaWeeklyLimit"
          :dailyResetMode="editDailyResetMode"
          :dailyResetHour="editDailyResetHour"
          :weeklyResetMode="editWeeklyResetMode"
          :weeklyResetDay="editWeeklyResetDay"
          :weeklyResetHour="editWeeklyResetHour"
          :resetTimezone="editResetTimezone"
          :quotaNotifyGlobalEnabled="quotaNotifyGlobalEnabled"
          :quotaNotifyDailyEnabled="quotaNotifyState.daily.enabled"
          :quotaNotifyDailyThreshold="quotaNotifyState.daily.threshold"
          :quotaNotifyDailyThresholdType="quotaNotifyState.daily.thresholdType"
          :quotaNotifyWeeklyEnabled="quotaNotifyState.weekly.enabled"
          :quotaNotifyWeeklyThreshold="quotaNotifyState.weekly.threshold"
          :quotaNotifyWeeklyThresholdType="quotaNotifyState.weekly.thresholdType"
          :quotaNotifyTotalEnabled="quotaNotifyState.total.enabled"
          :quotaNotifyTotalThreshold="quotaNotifyState.total.threshold"
          :quotaNotifyTotalThresholdType="quotaNotifyState.total.thresholdType"
          @update:totalLimit="editQuotaLimit = $event"
          @update:dailyLimit="editQuotaDailyLimit = $event"
          @update:weeklyLimit="editQuotaWeeklyLimit = $event"
          @update:dailyResetMode="editDailyResetMode = $event"
          @update:dailyResetHour="editDailyResetHour = $event"
          @update:weeklyResetMode="editWeeklyResetMode = $event"
          @update:weeklyResetDay="editWeeklyResetDay = $event"
          @update:weeklyResetHour="editWeeklyResetHour = $event"
          @update:resetTimezone="editResetTimezone = $event"
          @update:quotaNotifyDailyEnabled="quotaNotifyState.daily.enabled = $event"
          @update:quotaNotifyDailyThreshold="quotaNotifyState.daily.threshold = $event"
          @update:quotaNotifyDailyThresholdType="quotaNotifyState.daily.thresholdType = $event"
          @update:quotaNotifyWeeklyEnabled="quotaNotifyState.weekly.enabled = $event"
          @update:quotaNotifyWeeklyThreshold="quotaNotifyState.weekly.threshold = $event"
          @update:quotaNotifyWeeklyThresholdType="quotaNotifyState.weekly.thresholdType = $event"
          @update:quotaNotifyTotalEnabled="quotaNotifyState.total.enabled = $event"
          @update:quotaNotifyTotalThreshold="quotaNotifyState.total.threshold = $event"
          @update:quotaNotifyTotalThresholdType="quotaNotifyState.total.thresholdType = $event"
        />
      </div>

      <!-- OpenAI API 长上下文计费开关 -->
      <div
        v-if="account?.platform === 'openai' && !isSparkShadow && (account?.type === 'oauth' || account?.type === 'setup-token' || account?.type === 'apikey')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.longContextBilling') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.longContextBillingDesc') }}
            </p>
          </div>
          <UiSwitch
            v-model="openAILongContextBillingEnabled"
            :label="t('admin.accounts.openai.longContextBilling')"
            data-testid="openai-long-context-billing-toggle"
          />
        </div>
      </div>

      <div
        v-if="account?.platform === 'openai' && (account?.type === 'oauth' || account?.type === 'setup-token')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.codexCLIOnly') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.codexCLIOnlyDesc') }}
            </p>
          </div>
          <UiSwitch v-model="codexCLIOnlyEnabled" :label="t('admin.accounts.openai.codexCLIOnly')" />
        </div>
        <div
          v-if="codexCLIOnlyEnabled"
          class="mt-4 flex items-center justify-between border-l-2 border-gray-200 pl-4 dark:border-dark-600"
        >
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.codexCLIOnlyAppServer') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.codexCLIOnlyAppServerDesc') }}
            </p>
          </div>
          <UiSwitch
            v-model="codexCLIOnlyAppServerEnabled"
            :label="t('admin.accounts.openai.codexCLIOnlyAppServer')"
          />
        </div>
      </div>

      <!-- Codex 指纹收敛模式（仅 OpenAI OAuth） -->
      <div
        v-if="account?.platform === 'openai' && account?.type === 'oauth'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.codexFingerprintMode') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.codexFingerprintModeDesc') }}
            </p>
          </div>
          <div class="w-52 flex-shrink-0">
            <UiSelect v-model="codexFingerprintMode" data-testid="edit-codex-fingerprint-mode-select" :options="codexFingerprintModeOptions" />
          </div>
        </div>
      </div>

      <!-- OpenAI 订阅档位手动覆盖（Plus/Pro/Free），仅 OAuth 非影子账号 -->
      <div
        v-if="account?.platform === 'openai' && account?.type === 'oauth' && !isSparkShadow"
        class="border-t border-gray-200 pt-4 dark:border-dark-600"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.planType') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.planTypeDesc') }}
            </p>
          </div>
          <div class="w-44 flex-shrink-0">
            <UiSelect v-model="editPlanType" :options="planTypeOptions" />
          </div>
        </div>
      </div>

      <div
        v-if="account?.platform === 'openai' && (account?.type === 'oauth' || account?.type === 'setup-token' || account?.type === 'apikey')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600 space-y-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{ t('admin.accounts.openai.compactMode') }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.openai.compactModeDesc') }}
            </p>
          </div>
          <div class="w-44">
            <UiSelect v-model="openAICompactMode" :options="openAICompactModeOptions" />
          </div>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-dark-700 dark:text-gray-300">
          <span class="font-medium">{{ t(openAICompactStatusKey) }}</span>
          <span
            v-if="account?.extra?.openai_compact_checked_at"
            class="ml-2 text-gray-500 dark:text-gray-400"
          >
            {{ t('admin.accounts.openai.compactLastChecked') }}:
            {{ formatDateTime(new Date(String(account.extra.openai_compact_checked_at))) }}
          </span>
        </div>
        <div>
          <label class="ui-field-label">{{ t('admin.accounts.openai.compactModelMapping') }}</label>
          <p class="ui-field-hint">{{ t('admin.accounts.openai.compactModelMappingDesc') }}</p>
          <ModelMappingEditor
            v-model="openAICompactModelMappings"
            :from-placeholder="t('admin.accounts.fromModel')"
            :to-placeholder="t('admin.accounts.toModel')"
            :add-label="t('admin.accounts.addMapping')"
            :remove-label="t('common.delete')"
          />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <div>
            <label class="ui-field-label mb-0">{{
              t('admin.accounts.autoPauseOnExpired')
            }}</label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.autoPauseOnExpiredDesc') }}
            </p>
          </div>
          <UiSwitch v-model="autoPauseOnExpired" :label="t('admin.accounts.autoPauseOnExpired')" />
        </div>
      </div>

      <div
        v-if="account?.platform === 'openai'"
        class="border-t border-gray-200 pt-4 dark:border-dark-600 space-y-4"
      >
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="ui-field-label mb-0">{{ t('admin.accounts.autoPause5hDisabled') }}</label>
            <UiSwitch
              v-model="autoPause5hDisabled"
              :label="t('admin.accounts.autoPause5hDisabled')"
              data-testid="auto-pause-5h-disabled"
            />
          </div>
          <p class="ui-field-hint">{{ t('admin.accounts.autoPauseDisabledHint') }}</p>
        </div>
        <div>
          <UiTextField
            v-model.number="autoPause5hThreshold"
            type="number"
            density="compact"
            :label="t('admin.accounts.autoPause5hThreshold')"
            :min="0"
            :max="100"
            :step="0.1"
            :disabled="autoPause5hDisabled"
            test-id="auto-pause-5h-threshold"
          />
          <p class="ui-field-hint">{{ t('admin.accounts.autoPauseThresholdHint') }}</p>
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="ui-field-label mb-0">{{ t('admin.accounts.autoPause7dDisabled') }}</label>
            <UiSwitch
              v-model="autoPause7dDisabled"
              :label="t('admin.accounts.autoPause7dDisabled')"
              data-testid="auto-pause-7d-disabled"
            />
          </div>
          <p class="ui-field-hint">{{ t('admin.accounts.autoPauseDisabledHint') }}</p>
        </div>
        <div>
          <UiTextField
            v-model.number="autoPause7dThreshold"
            type="number"
            density="compact"
            :label="t('admin.accounts.autoPause7dThreshold')"
            :min="0"
            :max="100"
            :step="0.1"
            :disabled="autoPause7dDisabled"
            test-id="auto-pause-7d-threshold"
          />
          <p class="ui-field-hint">{{ t('admin.accounts.autoPauseThresholdHint') }}</p>
        </div>
      </div>

      <!-- 配额控制 (Anthropic OAuth/SetupToken: 亲和 + 窗口费用 + 会话 + RPM 等) -->
      <div
        v-if="account?.platform === 'anthropic' && (account?.type === 'oauth' || account?.type === 'setup-token')"
        class="border-t border-gray-200 pt-4 dark:border-dark-600 space-y-4"
      >
        <div class="mb-3">
          <h3 class="ui-field-label mb-0 text-base font-semibold">{{ t('admin.accounts.quotaControl.title') }}</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.accounts.quotaControl.hint') }}
          </p>
        </div>

        <!-- Window Cost Limit -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-600">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.quotaControl.windowCost.label') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.quotaControl.windowCost.hint') }}
              </p>
            </div>
            <UiSwitch
              v-model="windowCostEnabled"
              :label="t('admin.accounts.quotaControl.windowCost.label')"
            />
          </div>

          <div v-if="windowCostEnabled" class="grid grid-cols-2 gap-4">
            <UiTextField v-model.number="windowCostLimit" type="number" :label="t('admin.accounts.quotaControl.windowCost.limit')" :description="t('admin.accounts.quotaControl.windowCost.limitHint')" :min="0" :step="1" density="compact" :placeholder="t('admin.accounts.quotaControl.windowCost.limitPlaceholder')"><template #prefix>$</template></UiTextField>
            <UiTextField v-model.number="windowCostStickyReserve" type="number" :label="t('admin.accounts.quotaControl.windowCost.stickyReserve')" :description="t('admin.accounts.quotaControl.windowCost.stickyReserveHint')" :min="0" :step="1" density="compact" :placeholder="t('admin.accounts.quotaControl.windowCost.stickyReservePlaceholder')"><template #prefix>$</template></UiTextField>
          </div>
        </div>

        <!-- Session Limit -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-600">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.quotaControl.sessionLimit.label') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.quotaControl.sessionLimit.hint') }}
              </p>
            </div>
            <UiSwitch
              v-model="sessionLimitEnabled"
              :label="t('admin.accounts.quotaControl.sessionLimit.label')"
            />
          </div>

          <div v-if="sessionLimitEnabled" class="grid grid-cols-2 gap-4">
            <UiTextField v-model.number="maxSessions" type="number" :label="t('admin.accounts.quotaControl.sessionLimit.maxSessions')" :description="t('admin.accounts.quotaControl.sessionLimit.maxSessionsHint')" :min="1" :step="1" density="compact" :placeholder="t('admin.accounts.quotaControl.sessionLimit.maxSessionsPlaceholder')" />
            <UiTextField v-model.number="sessionIdleTimeout" type="number" :label="t('admin.accounts.quotaControl.sessionLimit.idleTimeout')" :description="t('admin.accounts.quotaControl.sessionLimit.idleTimeoutHint')" :min="1" :step="1" density="compact" :placeholder="t('admin.accounts.quotaControl.sessionLimit.idleTimeoutPlaceholder')"><template #suffix>{{ t('common.minutes') }}</template></UiTextField>
          </div>
        </div>

        <!-- RPM Limit -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-600">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.quotaControl.rpmLimit.label') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.quotaControl.rpmLimit.hint') }}
              </p>
            </div>
            <UiSwitch
              v-model="rpmLimitEnabled"
              :label="t('admin.accounts.quotaControl.rpmLimit.label')"
            />
          </div>

          <div v-if="rpmLimitEnabled" class="space-y-4">
            <UiTextField v-model.number="baseRpm" type="number" :label="t('admin.accounts.quotaControl.rpmLimit.baseRpm')" :description="t('admin.accounts.quotaControl.rpmLimit.baseRpmHint')" :min="1" :max="1000" :step="1" density="compact" :placeholder="t('admin.accounts.quotaControl.rpmLimit.baseRpmPlaceholder')" />

            <div>
              <UiRadioGroup v-model="rpmStrategy" :label="t('admin.accounts.quotaControl.rpmLimit.strategy')" name="edit-rpm-strategy" layout="grid" :options="rpmStrategyOptions" />
            </div>

            <div v-if="rpmStrategy === 'tiered'">
              <UiTextField v-model.number="rpmStickyBuffer" type="number" :label="t('admin.accounts.quotaControl.rpmLimit.stickyBuffer')" :description="t('admin.accounts.quotaControl.rpmLimit.stickyBufferHint')" :min="1" :step="1" density="compact" :placeholder="t('admin.accounts.quotaControl.rpmLimit.stickyBufferPlaceholder')" />
            </div>

          </div>

          <!-- 用户消息限速模式（独立于 RPM 开关，始终可见） -->
          <div class="mt-4">
            <UiRadioGroup v-model="userMsgQueueMode" :label="t('admin.accounts.quotaControl.rpmLimit.userMsgQueue')" name="edit-umq-mode" layout="inline" :options="umqModeOptions" />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('admin.accounts.quotaControl.rpmLimit.userMsgQueueHint') }}</p>
          </div>
        </div>

        <!-- TLS Fingerprint -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-600">
          <div class="flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.quotaControl.tlsFingerprint.label') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.quotaControl.tlsFingerprint.hint') }}
              </p>
            </div>
            <UiSwitch
              v-model="tlsFingerprintEnabled"
              :label="t('admin.accounts.quotaControl.tlsFingerprint.label')"
            />
          </div>
          <!-- Profile selector -->
          <div v-if="tlsFingerprintEnabled" class="mt-3">
            <UiSelect
              v-model="tlsFingerprintProfileId"
              :label="t('admin.accounts.quotaControl.tlsFingerprint.label')"
              :options="tlsFingerprintProfileOptions"
              density="compact"
            />
          </div>
        </div>

        <!-- Session ID Masking -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-600">
          <div class="flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.quotaControl.sessionIdMasking.label') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.quotaControl.sessionIdMasking.hint') }}
              </p>
            </div>
            <UiSwitch
              v-model="sessionIdMaskingEnabled"
              :label="t('admin.accounts.quotaControl.sessionIdMasking.label')"
            />
          </div>
        </div>

        <!-- Cache TTL Override -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-600">
          <div class="flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.quotaControl.cacheTTLOverride.label') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.quotaControl.cacheTTLOverride.hint') }}
              </p>
            </div>
            <UiSwitch
              v-model="cacheTTLOverrideEnabled"
              :label="t('admin.accounts.quotaControl.cacheTTLOverride.label')"
            />
          </div>
          <div v-if="cacheTTLOverrideEnabled" class="mt-3">
            <UiSelect
              v-model="cacheTTLOverrideTarget"
              :label="t('admin.accounts.quotaControl.cacheTTLOverride.target')"
              :description="t('admin.accounts.quotaControl.cacheTTLOverride.targetHint')"
              :options="cacheTTLOverrideOptions"
              density="compact"
            />
          </div>
        </div>

        <!-- Custom Base URL Relay -->
        <div class="rounded-lg border border-gray-200 p-4 dark:border-dark-600">
          <div class="flex items-center justify-between">
            <div>
              <label class="ui-field-label mb-0">{{ t('admin.accounts.quotaControl.customBaseUrl.label') }}</label>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ t('admin.accounts.quotaControl.customBaseUrl.hint') }}
              </p>
            </div>
            <UiSwitch
              v-model="customBaseUrlEnabled"
              :label="t('admin.accounts.quotaControl.customBaseUrl.label')"
            />
          </div>
          <div v-if="customBaseUrlEnabled" class="mt-3">
            <UiTextField
              v-model="customBaseUrl"
              type="text"
              density="compact"
              :label="t('admin.accounts.quotaControl.customBaseUrl.label')"
              :placeholder="t('admin.accounts.quotaControl.customBaseUrl.urlHint')"
            />
          </div>
        </div>
      </div>

      <div class="border-t border-gray-200 pt-4 dark:border-dark-600">
        <div>
          <label class="ui-field-label">{{ t('common.status') }}</label>
          <UiSelect v-model="form.status" :options="statusOptions" />
        </div>

        <!-- Mixed Scheduling (only for antigravity accounts, read-only in edit mode) -->
        <div v-if="account?.platform === 'antigravity'" class="flex items-center gap-2">
          <UiCheckbox
            v-model="mixedScheduling"
            disabled
            :label="t('admin.accounts.mixedScheduling')"
          />
          <div class="group relative">
            <span
              class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500 hover:bg-gray-300 dark:bg-dark-600 dark:text-gray-400 dark:hover:bg-dark-500"
            >
              ?
            </span>
            <!-- Tooltip（向下显示避免被弹窗裁剪） -->
            <div
              class="pointer-events-none absolute left-0 top-full z-[100] mt-1.5 w-72 rounded bg-gray-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700"
            >
              {{ t('admin.accounts.mixedSchedulingTooltip') }}
              <div
                class="absolute bottom-full left-3 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700"
              ></div>
            </div>
          </div>
        </div>
        <div v-if="account?.platform === 'antigravity'" class="mt-3 flex items-center gap-2">
          <UiCheckbox v-model="allowOverages" :label="t('admin.accounts.allowOverages')" />
          <div class="group relative">
            <span
              class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500 hover:bg-gray-300 dark:bg-dark-600 dark:text-gray-400 dark:hover:bg-dark-500"
            >
              ?
            </span>
            <div
              class="pointer-events-none absolute left-0 top-full z-[100] mt-1.5 w-72 rounded bg-gray-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-gray-700"
            >
              {{ t('admin.accounts.allowOveragesTooltip') }}
              <div
                class="absolute bottom-full left-3 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Group Selection - 仅标准模式显示 -->
      <GroupSelector
        v-if="!authStore.isSimpleMode"
        v-model="form.group_ids"
        :groups="groups"
        :platform="account?.platform"
        :mixed-scheduling="mixedScheduling"
        data-tour="account-form-groups"
      />

    </form>

    <template #footer>
      <div v-if="account" class="flex justify-end gap-3">
        <UiButton type="button" variant="secondary" @click="handleClose">
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          type="submit"
          form="edit-account-form"
          variant="primary"
          :loading="submitting"
          data-tour="account-form-submit"
        >
          {{ submitting ? t('admin.accounts.updating') : t('common.update') }}
        </UiButton>
      </div>
    </template>
  </UiDialog>

  <!-- Mixed Channel Warning Dialog -->
  <UiConfirmDialog
    :show="showMixedChannelWarning"
    :title="t('admin.accounts.mixedChannelWarningTitle')"
    :message="mixedChannelWarningMessageText"
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
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { adminAPI } from '@/api/admin'
import { useQuotaNotifyState } from '@/composables/useQuotaNotifyState'
import type {
  Account,
  Proxy,
  AdminGroup,
  CheckMixedChannelResponse,
  OpenAICompactMode,
  OpenAIResponsesMode,
  OpenAIEndpointCapability,
  OllamaCloudUsageState
} from '@/types'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  UiButton,
  UiCheckbox,
  UiConfirmDialog,
  UiDialog,
  UiIconButton,
  UiPasswordField,
  UiRadioGroup,
  UiSelect,
  UiSwitch,
  UiTextArea,
  UiTextField
} from '@/components/ui'
import ProxySelector from '@/components/common/ProxySelector.vue'
import ProxyAdBanner from '@/components/common/ProxyAdBanner.vue'
import GroupSelector from '@/components/common/GroupSelector.vue'
import ModelMappingEditor from '@/components/account/ModelMappingEditor.vue'
import ModelRestrictionEditor from '@/components/account/ModelRestrictionEditor.vue'
import QuotaLimitCard from '@/components/account/QuotaLimitCard.vue'
import GrokBaseUrlPresets from '@/components/account/GrokBaseUrlPresets.vue'
import HeaderOverrideEditor from '@/components/account/HeaderOverrideEditor.vue'
import OllamaCloudUsageSettings from '@/components/account/OllamaCloudUsageSettings.vue'
import {
  applyAntigravityProjectID,
  applyHeaderOverride,
  applyInterceptWarmup,
  applyPlanType,
  buildPlanTypeOptions,
  readPlanType,
  isCustomGrokBaseUrl,
  isHeaderOverrideCapable,
  splitHeaderOverridesObject,
  validateHeaderOverrideRows,
  HEADER_OVERRIDE_ENABLED_CREDENTIAL_KEY,
  HEADER_OVERRIDES_CREDENTIAL_KEY,
  type HeaderOverrideRow
} from '@/components/account/credentialsBuilder'
import { formatDateTime, formatDateTimeLocalInput, parseDateTimeLocalInput } from '@/utils/format'
import { createStableObjectKeyResolver } from '@/utils/stableObjectKey'
import { parseAccountPriority } from '@/utils/accountPriority'
import { VERTEX_LOCATION_OPTIONS } from '@/constants/account'
import {
  OPENAI_WS_MODE_CTX_POOL,
  OPENAI_WS_MODE_OFF,
  OPENAI_WS_MODE_PASSTHROUGH,
  OPENAI_WS_MODE_HTTP_BRIDGE,
  isOpenAIWSModeEnabled,
  resolveOpenAIWSModeConcurrencyHintKey,
  type OpenAIWSMode,
  resolveOpenAIWSModeFromExtra
} from '@/utils/openaiWsMode'
import {
  getPresetMappingsByPlatform,
  commonErrorCodes,
  buildModelMappingObject,
  splitModelMappingObject
} from '@/composables/useModelWhitelist'

interface Props {
  show: boolean
  account: Account | null
  proxies: Proxy[]
  groups: AdminGroup[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  updated: [account: Account]
}>()

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

// Spark 影子账号(parent_account_id 非空):代理恒继承母账号,不可独立编辑(外审 B/P1),
// 故隐藏代理选择器。
const isSparkShadow = computed(() => props.account?.parent_account_id != null)

const handleOllamaCloudUsageUpdated = (state: OllamaCloudUsageState) => {
  if (props.account) emit('updated', { ...props.account, ollama_cloud_usage: state })
}

// Platform-specific hint for Base URL
const baseUrlHint = computed(() => {
  if (!props.account) return t('admin.accounts.baseUrlHint')
  if (props.account.platform === 'openai') return t('admin.accounts.openai.baseUrlHint')
  if (props.account.platform === 'gemini') return t('admin.accounts.gemini.baseUrlHint')
  if (props.account.platform === 'grok') return ''
  return t('admin.accounts.baseUrlHint')
})

const antigravityPresetMappings = computed(() => getPresetMappingsByPlatform('antigravity'))
const bedrockPresets = computed(() => getPresetMappingsByPlatform('bedrock'))

// Model mapping type
interface ModelMapping {
  from: string
  to: string
}

interface TempUnschedRuleForm {
  error_code: number | null
  keywords: string
  duration_minutes: number | null
  description: string
}

// State
const submitting = ref(false)
const editBaseUrl = ref('https://api.anthropic.com')
const editApiKey = ref('')
// Bedrock credentials
const editBedrockAccessKeyId = ref('')
const editBedrockSecretAccessKey = ref('')
const editBedrockSessionToken = ref('')
const editBedrockRegion = ref('')
const editBedrockForceGlobal = ref(false)
const editBedrockApiKeyValue = ref('')
const editVertexProjectId = ref('')
const editVertexClientEmail = ref('')
const editVertexLocation = ref('us-central1')
const isBedrockAPIKeyMode = computed(() =>
  props.account?.type === 'bedrock' &&
  (props.account?.credentials as Record<string, unknown>)?.auth_mode === 'apikey'
)
const modelMappings = ref<ModelMapping[]>([])
const openAICompactModelMappings = ref<ModelMapping[]>([])
const modelRestrictionMode = ref<'whitelist' | 'mapping'>('whitelist')
const allowedModels = ref<string[]>([])
const DEFAULT_POOL_MODE_RETRY_COUNT = 3
const MAX_POOL_MODE_RETRY_COUNT = 10
const DEFAULT_POOL_MODE_RETRY_STATUS_CODES = [401, 403, 429]
const GROK_CLIENT_TOOL_CACHE_EXTRA_KEY = 'grok_client_tool_cache_enabled'
const poolModeEnabled = ref(false)
const poolModeRetryCount = ref(DEFAULT_POOL_MODE_RETRY_COUNT)
const poolModeRetryStatusCodesInput = ref('')

function parsePoolModeRetryStatusCodes(input: string): number[] {
  if (!input || !input.trim()) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const token of input.split(/[,\s]+/)) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const n = Number(trimmed)
    if (!Number.isFinite(n) || !Number.isInteger(n)) continue
    if (n < 100 || n > 599) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out.sort((a, b) => a - b)
}

function formatPoolModeRetryStatusCodes(value: unknown): string {
  if (!Array.isArray(value)) return ''
  const out: number[] = []
  const seen = new Set<number>()
  for (const v of value) {
    const n = typeof v === 'string' ? Number(v.trim()) : Number(v)
    if (!Number.isFinite(n) || !Number.isInteger(n)) continue
    if (n < 100 || n > 599) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out.sort((a, b) => a - b).join(', ')
}
const customErrorCodesEnabled = ref(false)
const selectedErrorCodes = ref<number[]>([])
const customErrorCodeInput = ref<number | null>(null)
const errorCodeConfirmation = ref<{ code: 429 | 529; source: 'toggle' | 'custom' } | null>(null)
const errorCodeConfirmationMessage = computed(() =>
  errorCodeConfirmation.value?.code === 429
    ? t('admin.accounts.customErrorCodes429Warning')
    : t('admin.accounts.customErrorCodes529Warning'),
)
const headerOverrideEnabled = ref(false)
const headerOverrideRows = ref<HeaderOverrideRow[]>([])

const headerOverrideCapable = computed(
  () => !!props.account && isHeaderOverrideCapable(props.account.platform, props.account.type)
)

// Grok OAuth 自定义上游地址（仅转发端点；OAuth 授权/令牌刷新不受影响）
const grokOAuthCustomBaseUrlEnabled = ref(false)
const grokOAuthBaseUrl = ref('')
// Grok Free OAuth accounts use client-tool prompt caching by default. Keep an
// explicit false in the account extra as the opt-out signal.
const grokClientToolCacheEnabled = ref(true)

const interceptWarmupRequests = ref(false)
const autoPauseOnExpired = ref(false)
const autoPause5hThreshold = ref<number | null>(null)
const autoPause7dThreshold = ref<number | null>(null)
const autoPause5hDisabled = ref(false)
const autoPause7dDisabled = ref(false)
const upstreamBillingAutoProbeEnabled = ref(false)
const upstreamBillingRateSyncEnabled = ref(false)
const mixedScheduling = ref(false) // For antigravity accounts: enable mixed scheduling
const allowOverages = ref(false) // For antigravity accounts: enable AI Credits overages
const antigravityProjectId = ref('')
const antigravityModelRestrictionMode = ref<'whitelist' | 'mapping'>('whitelist')
const antigravityWhitelistModels = ref<string[]>([])
const antigravityModelMappings = ref<ModelMapping[]>([])
const isSyncingAntigravityUpstream = ref(false)
const tempUnschedEnabled = ref(false)
const accountSchedulingThresholdOverrideEnabled = ref(false)
const accountSchedulingThresholdOverrideValue = ref(100)
const ACCOUNT_SCHEDULING_THRESHOLD_CREDENTIAL_KEY = 'account_scheduling_threshold'
const supportsAccountSchedulingThresholdOverride = computed(() =>
  supportsAccountSchedulingThresholdOverridePlatform(props.account?.platform)
)
const tempUnschedRules = ref<TempUnschedRuleForm[]>([])
const getTempUnschedRuleKey = createStableObjectKeyResolver<TempUnschedRuleForm>('edit-temp-unsched-rule')

const showMixedChannelWarning = ref(false)
const mixedChannelWarningDetails = ref<{ groupName: string; currentPlatform: string; otherPlatform: string } | null>(
  null
)
const mixedChannelWarningRawMessage = ref('')
const mixedChannelWarningAction = ref<(() => Promise<void>) | null>(null)
const antigravityMixedChannelConfirmed = ref(false)

// Quota control state (Anthropic OAuth/SetupToken only)
const windowCostEnabled = ref(false)
const windowCostLimit = ref<number | null>(null)
const windowCostStickyReserve = ref<number | null>(null)
const sessionLimitEnabled = ref(false)
const maxSessions = ref<number | null>(null)
const sessionIdleTimeout = ref<number | null>(null)
const rpmLimitEnabled = ref(false)
const baseRpm = ref<number | null>(null)
const rpmStrategy = ref<'tiered' | 'sticky_exempt'>('tiered')
const rpmStickyBuffer = ref<number | null>(null)
const rpmStrategyOptions = computed(() => [
  { value: 'tiered', label: t('admin.accounts.quotaControl.rpmLimit.strategyTiered'), description: t('admin.accounts.quotaControl.rpmLimit.strategyTieredHint') },
  { value: 'sticky_exempt', label: t('admin.accounts.quotaControl.rpmLimit.strategyStickyExempt'), description: t('admin.accounts.quotaControl.rpmLimit.strategyStickyExemptHint') },
])
const userMsgQueueMode = ref('')
const umqModeOptions = computed(() => [
  { value: '', label: t('admin.accounts.quotaControl.rpmLimit.umqModeOff') },
  { value: 'throttle', label: t('admin.accounts.quotaControl.rpmLimit.umqModeThrottle') },
  { value: 'serialize', label: t('admin.accounts.quotaControl.rpmLimit.umqModeSerialize') },
])
const tlsFingerprintEnabled = ref(false)
const tlsFingerprintProfileId = ref<number | null>(null)
const tlsFingerprintProfiles = ref<{ id: number; name: string }[]>([])
const tlsFingerprintProfileOptions = computed(() => [
  { value: null, label: t('admin.accounts.quotaControl.tlsFingerprint.defaultProfile') },
  ...(tlsFingerprintProfiles.value.length > 0
    ? [{ value: -1, label: t('admin.accounts.quotaControl.tlsFingerprint.randomProfile') }]
    : []),
  ...tlsFingerprintProfiles.value.map(profile => ({ value: profile.id, label: profile.name }))
])
const sessionIdMaskingEnabled = ref(false)
const cacheTTLOverrideEnabled = ref(false)
const cacheTTLOverrideTarget = ref<string>('5m')
const cacheTTLOverrideOptions = [
  { value: '5m', label: '5m' },
  { value: '1h', label: '1h' }
]
const customBaseUrlEnabled = ref(false)
const customBaseUrl = ref('')
const vertexLocationSelectOptions = VERTEX_LOCATION_OPTIONS.flatMap(group => [
  { value: `__group_${group.label}`, label: group.label, kind: 'group' },
  ...group.options.map(option => ({ value: option.value, label: option.label }))
])

// OpenAI 自动透传开关（OAuth/API Key）
const openaiPassthroughEnabled = ref(false)
// OpenAI Codex namespace 工具摊平兼容开关（仅 OAuth），缺省关闭即原样保留
const openaiFlattenNamespacesEnabled = ref(false)
const openAILongContextBillingEnabled = ref(false)
// OpenAI 订阅档位（Plus/Pro/Free）手动覆盖值,存于 credentials.plan_type;'' 表示清空/自动识别
const editPlanType = ref<string>('')
const openAICompactMode = ref<OpenAICompactMode>('auto')
const openAIResponsesMode = ref<OpenAIResponsesMode>('auto')
const openAIEndpointCapabilities = ref<OpenAIEndpointCapability[]>(['chat_completions', 'embeddings'])
const openaiOAuthResponsesWebSocketV2Mode = ref<OpenAIWSMode>(OPENAI_WS_MODE_OFF)
const openaiAPIKeyResponsesWebSocketV2Mode = ref<OpenAIWSMode>(OPENAI_WS_MODE_OFF)
const codexCLIOnlyEnabled = ref(false)
const codexCLIOnlyAppServerEnabled = ref(false)
type CodexFingerprintMode = 'off' | 'device' | 'session' | 'full'
const codexFingerprintMode = ref<CodexFingerprintMode>('session')
type CodexImageToolMode = 'inherit' | 'enabled' | 'disabled' | 'block'
const codexImageToolMode = ref<CodexImageToolMode>('inherit')
type AnthropicAPIKeyAuthScheme = 'x_api_key' | 'authorization_bearer'
const anthropicPassthroughEnabled = ref(false)
const anthropicAPIKeyAuthScheme = ref<AnthropicAPIKeyAuthScheme>('x_api_key')
const webSearchEmulationMode = ref('default')
const webSearchGlobalEnabled = ref(false)
const anthropicAPIKeyAuthSchemeOptions = computed(() => [
  { value: 'x_api_key' as AnthropicAPIKeyAuthScheme, label: t('admin.accounts.anthropic.apiKeyAuthSchemeXApiKey') },
  { value: 'authorization_bearer' as AnthropicAPIKeyAuthScheme, label: t('admin.accounts.anthropic.apiKeyAuthSchemeBearer') }
])
const webSearchEmulationOptions = computed(() => [
  { value: 'default', label: t('admin.accounts.anthropic.webSearchDefault') },
  { value: 'enabled', label: t('admin.accounts.anthropic.webSearchEnabled') },
  { value: 'disabled', label: t('admin.accounts.anthropic.webSearchDisabled') }
])
const {
  globalEnabled: quotaNotifyGlobalEnabled,
  state: quotaNotifyState,
  loadGlobalState: loadQuotaNotifyGlobal,
  loadFromExtra: loadQuotaNotifyFromExtra,
  writeToExtra: writeQuotaNotifyToExtra,
  reset: resetQuotaNotify,
} = useQuotaNotifyState()

// Load global feature states once
adminAPI.settings.getWebSearchEmulationConfig().then(cfg => {
  webSearchGlobalEnabled.value = cfg?.enabled === true && (cfg?.providers?.length ?? 0) > 0
}).catch(() => { webSearchGlobalEnabled.value = false })

loadQuotaNotifyGlobal()
const editQuotaLimit = ref<number | null>(null)
const editQuotaDailyLimit = ref<number | null>(null)
const editQuotaWeeklyLimit = ref<number | null>(null)
const editDailyResetMode = ref<'rolling' | 'fixed' | null>(null)
const editDailyResetHour = ref<number | null>(null)
const editWeeklyResetMode = ref<'rolling' | 'fixed' | null>(null)
const editWeeklyResetDay = ref<number | null>(null)
const editWeeklyResetHour = ref<number | null>(null)
const editResetTimezone = ref<string | null>(null)
const codexFingerprintModeOptions = computed(() => [
  { value: 'off' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintOff') },
  { value: 'device' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintDevice') },
  { value: 'session' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintSession') },
  { value: 'full' as CodexFingerprintMode, label: t('admin.accounts.openai.codexFingerprintFull') },
])

const openAIWSModeOptions = computed(() => [
  { value: OPENAI_WS_MODE_OFF, label: t('admin.accounts.openai.wsModeOff') },
  { value: OPENAI_WS_MODE_CTX_POOL, label: t('admin.accounts.openai.wsModeCtxPool') },
  { value: OPENAI_WS_MODE_PASSTHROUGH, label: t('admin.accounts.openai.wsModePassthrough') },
  { value: OPENAI_WS_MODE_HTTP_BRIDGE, label: t('admin.accounts.openai.wsModeHttpBridge') }
])
const openaiResponsesWebSocketV2Mode = computed({
  get: () => {
    if (props.account?.type === 'apikey') {
      return openaiAPIKeyResponsesWebSocketV2Mode.value
    }
    return openaiOAuthResponsesWebSocketV2Mode.value
  },
  set: (mode: OpenAIWSMode) => {
    if (props.account?.type === 'apikey') {
      openaiAPIKeyResponsesWebSocketV2Mode.value = mode
      return
    }
    openaiOAuthResponsesWebSocketV2Mode.value = mode
  }
})
const openAIWSModeConcurrencyHintKey = computed(() =>
  resolveOpenAIWSModeConcurrencyHintKey(openaiResponsesWebSocketV2Mode.value)
)
const codexImageToolOptions = computed<Array<{
  value: CodexImageToolMode
  label: string
  description: string
  selectedCardClass: string
  selectedDotClass: string
}>>(() => [
  {
    value: 'inherit',
    label: t('admin.accounts.openai.codexImageToolInherit'),
    description: t('admin.accounts.openai.codexImageToolInheritDesc'),
    selectedCardClass: 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm ring-1 ring-sky-200 dark:border-sky-700 dark:bg-sky-900/25 dark:text-sky-100 dark:ring-sky-800',
    selectedDotClass: 'border-sky-500 bg-sky-500 text-white'
  },
  {
    value: 'enabled',
    label: t('admin.accounts.openai.codexImageToolEnabled'),
    description: t('admin.accounts.openai.codexImageToolEnabledDesc'),
    selectedCardClass: 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-100 dark:ring-emerald-800',
    selectedDotClass: 'border-emerald-500 bg-emerald-500 text-white'
  },
  {
    value: 'disabled',
    label: t('admin.accounts.openai.codexImageToolDisabled'),
    description: t('admin.accounts.openai.codexImageToolDisabledDesc'),
    selectedCardClass: 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-200 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-100 dark:ring-amber-800',
    selectedDotClass: 'border-amber-500 bg-amber-500 text-white'
  },
  {
    value: 'block',
    label: t('admin.accounts.openai.codexImageToolBlock'),
    description: t('admin.accounts.openai.codexImageToolBlockDesc'),
    selectedCardClass: 'border-rose-300 bg-rose-50 text-rose-900 shadow-sm ring-1 ring-rose-200 dark:border-rose-700 dark:bg-rose-900/25 dark:text-rose-100 dark:ring-rose-800',
    selectedDotClass: 'border-rose-500 bg-rose-500 text-white'
  }
])
const codexImageToolBadgeLabel = computed(() => {
  switch (codexImageToolMode.value) {
    case 'enabled':
      return t('admin.accounts.openai.codexImageToolBadgeEnabled')
    case 'disabled':
      return t('admin.accounts.openai.codexImageToolBadgeDisabled')
    case 'block':
      return t('admin.accounts.openai.codexImageToolBadgeBlock')
    default:
      return t('admin.accounts.openai.codexImageToolBadgeInherit')
  }
})
const codexImageToolBadgeClass = computed(() => {
  switch (codexImageToolMode.value) {
    case 'enabled':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'disabled':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'block':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-dark-600 dark:text-slate-300'
  }
})
const openAICompactModeOptions = computed(() => [
  { value: 'auto', label: t('admin.accounts.openai.compactModeAuto') },
  { value: 'force_on', label: t('admin.accounts.openai.compactModeForceOn') },
  { value: 'force_off', label: t('admin.accounts.openai.compactModeForceOff') }
])
// OpenAI 订阅档位手动覆盖选项(清空 + Plus/Pro/Free;别名/自定义值友好显示且保留 canonical)
const planTypeOptions = computed(() =>
  buildPlanTypeOptions(editPlanType.value, t('admin.accounts.openai.planTypeClear'))
)
const openAIResponsesModeOptions = computed(() => [
  { value: 'auto', label: t('admin.accounts.openai.responsesModeAuto') },
  { value: 'force_responses', label: t('admin.accounts.openai.responsesModeForceResponses') },
  { value: 'force_chat_completions', label: t('admin.accounts.openai.responsesModeForceChatCompletions') }
])
const openAITextEndpointCapabilityLabel = computed(() => {
  if (openAIResponsesMode.value === 'force_responses') {
    return t('admin.accounts.openai.capabilityResponses')
  }
  if (openAIResponsesMode.value === 'force_chat_completions') {
    return t('admin.accounts.openai.capabilityChatCompletions')
  }
  const extra = props.account?.extra as Record<string, unknown> | undefined
  if (extra?.openai_responses_supported === true) {
    return t('admin.accounts.openai.capabilityResponsesAuto')
  }
  if (extra?.openai_responses_supported === false) {
    return t('admin.accounts.openai.capabilityChatCompletionsAuto')
  }
  return t('admin.accounts.openai.capabilityTextAuto')
})
const openAIEndpointCapabilityOptions = computed<{ value: OpenAIEndpointCapability; label: string }[]>(() => [
  { value: 'chat_completions', label: openAITextEndpointCapabilityLabel.value },
  { value: 'embeddings', label: t('admin.accounts.openai.capabilityEmbeddings') }
])
const openAITextGenerationCapabilityEnabled = computed(() =>
  openAIEndpointCapabilities.value.includes('chat_completions')
)

const normalizeOpenAIEndpointCapabilities = (values: OpenAIEndpointCapability[]) => {
  const allowed: OpenAIEndpointCapability[] = ['chat_completions', 'embeddings']
  const selected = allowed.filter((value) => values.includes(value))
  return selected.length > 0 ? selected : allowed
}

const readOpenAIEndpointCapabilities = (credentials?: Record<string, unknown>): OpenAIEndpointCapability[] => {
  const raw = credentials?.openai_capabilities
  if (Array.isArray(raw)) {
    return normalizeOpenAIEndpointCapabilities(
      raw.filter((value): value is OpenAIEndpointCapability =>
        value === 'chat_completions' || value === 'embeddings'
      )
    )
  }
  if (raw !== null && typeof raw === 'object') {
    const capabilityMap = raw as Record<string, unknown>
    return normalizeOpenAIEndpointCapabilities(
      openAIEndpointCapabilityOptions.value
        .map((option) => option.value)
        .filter((value) => capabilityMap[value] === true)
    )
  }
  return ['chat_completions', 'embeddings']
}

const setOpenAIEndpointCapability = (
  capability: OpenAIEndpointCapability,
  enabled: boolean,
  event?: Event
) => {
  const currentlyEnabled = openAIEndpointCapabilities.value.includes(capability)
  if (!enabled && currentlyEnabled) {
    if (openAIEndpointCapabilities.value.length <= 1) {
      const input = event?.target as HTMLInputElement | null
      if (input) input.checked = true
      return
    }
    openAIEndpointCapabilities.value = openAIEndpointCapabilities.value.filter(
      (value) => value !== capability
    )
    if (!openAITextGenerationCapabilityEnabled.value) {
      openAIResponsesMode.value = 'auto'
    }
    return
  }
  if (enabled && !currentlyEnabled) {
    openAIEndpointCapabilities.value = normalizeOpenAIEndpointCapabilities([
      ...openAIEndpointCapabilities.value,
      capability
    ])
  }
}

const applyOpenAIEndpointCapabilities = (credentials: Record<string, unknown>) => {
  const capabilities = normalizeOpenAIEndpointCapabilities(openAIEndpointCapabilities.value)
  if (capabilities.length === 2) {
    delete credentials.openai_capabilities
    return
  }
  credentials.openai_capabilities = capabilities
}
const normalizeOpenAIResponsesMode = (mode: unknown): OpenAIResponsesMode => {
  if (mode === 'force_responses' || mode === 'force_chat_completions') {
    return mode
  }
  return 'auto'
}
const isOpenAIModelRestrictionDisabled = computed(() =>
  props.account?.platform === 'openai' && openaiPassthroughEnabled.value
)
const openAIResponsesStatusKey = computed(() => {
  if (openAIResponsesMode.value === 'force_responses') {
    return 'admin.accounts.openai.responsesStatusForcedResponses'
  }
  if (openAIResponsesMode.value === 'force_chat_completions') {
    return 'admin.accounts.openai.responsesStatusForcedChatCompletions'
  }
  const extra = props.account?.extra as Record<string, unknown> | undefined
  if (extra?.openai_responses_supported === true) {
    return 'admin.accounts.openai.responsesStatusAutoSupported'
  }
  if (extra?.openai_responses_supported === false) {
    return 'admin.accounts.openai.responsesStatusAutoUnsupported'
  }
  return 'admin.accounts.openai.responsesStatusAutoUnknown'
})
const openAICompactStatusKey = computed(() => {
  const extra = props.account?.extra as Record<string, unknown> | undefined
  if (!props.account || props.account.platform !== 'openai') return ''
  const mode = typeof extra?.openai_compact_mode === 'string' ? extra.openai_compact_mode : 'auto'
  if (mode === 'force_on') return 'admin.accounts.openai.compactSupported'
  if (mode === 'force_off') return 'admin.accounts.openai.compactUnsupported'
  if (typeof extra?.openai_compact_supported === 'boolean') {
    return extra.openai_compact_supported
      ? 'admin.accounts.openai.compactSupported'
      : 'admin.accounts.openai.compactUnsupported'
  }
  return 'admin.accounts.openai.compactAuto'
})

// Computed: current preset mappings based on platform
const presetMappings = computed(() => getPresetMappingsByPlatform(props.account?.platform || 'anthropic'))
const tempUnschedPresets = computed(() => [
  {
    label: t('admin.accounts.tempUnschedulable.presets.overloadLabel'),
    rule: {
      error_code: 529,
      keywords: 'overloaded, too many',
      duration_minutes: 60,
      description: t('admin.accounts.tempUnschedulable.presets.overloadDesc')
    }
  },
  {
    label: t('admin.accounts.tempUnschedulable.presets.rateLimitLabel'),
    rule: {
      error_code: 429,
      keywords: 'rate limit, too many requests',
      duration_minutes: 10,
      description: t('admin.accounts.tempUnschedulable.presets.rateLimitDesc')
    }
  },
  {
    label: t('admin.accounts.tempUnschedulable.presets.unavailableLabel'),
    rule: {
      error_code: 503,
      keywords: 'unavailable, maintenance',
      duration_minutes: 30,
      description: t('admin.accounts.tempUnschedulable.presets.unavailableDesc')
    }
  }
])

// Computed: default base URL based on platform
const defaultBaseUrl = computed(() => {
  if (props.account?.platform === 'openai') return 'https://api.openai.com'
  if (props.account?.platform === 'gemini') return 'https://generativelanguage.googleapis.com'
  if (props.account?.platform === 'grok') return 'https://api.x.ai/v1'
  return 'https://api.anthropic.com'
})

const mixedChannelWarningMessageText = computed(() => {
  if (mixedChannelWarningDetails.value) {
    return t('admin.accounts.mixedChannelWarning', mixedChannelWarningDetails.value)
  }
  return mixedChannelWarningRawMessage.value
})

const form = reactive({
  name: '',
  notes: '',
  proxy_id: null as number | null,
  concurrency: 1,
  load_factor: null as number | null,
  priority: 0,
  rate_multiplier: 1,
  status: 'active' as 'active' | 'inactive' | 'error',
  group_ids: [] as number[],
  expires_at: null as number | null
})
const priorityInput = ref('0')
const priorityWasPresent = ref(true)
const priorityWasEdited = ref(false)

const handleUpstreamBillingRateSyncChange = (enabled: boolean) => {
  upstreamBillingRateSyncEnabled.value = enabled
  if (enabled) {
    upstreamBillingAutoProbeEnabled.value = true
  }
}

const handleUpstreamBillingAutoProbeChange = (enabled: boolean) => {
  upstreamBillingAutoProbeEnabled.value = enabled
  if (!enabled) {
    upstreamBillingRateSyncEnabled.value = false
  }
}

const statusOptions = computed(() => {
  const options = [
    { value: 'active', label: t('common.active') },
    { value: 'inactive', label: t('common.inactive') }
  ]
  if (form.status === 'error') {
    options.push({ value: 'error', label: t('admin.accounts.status.error') })
  }
  return options
})

const expiresAtInput = computed({
  get: () => formatDateTimeLocal(form.expires_at),
  set: (value: string) => {
    form.expires_at = parseDateTimeLocal(value)
  }
})

// Watchers
const normalizePoolModeRetryCount = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_POOL_MODE_RETRY_COUNT
  }
  const normalized = Math.trunc(value)
  if (normalized < 0) {
    return 0
  }
  if (normalized > MAX_POOL_MODE_RETRY_COUNT) {
    return MAX_POOL_MODE_RETRY_COUNT
  }
  return normalized
}

const loadModelRestrictionFromMapping = (rawMapping?: Record<string, unknown>) => {
  const parsed = splitModelMappingObject(rawMapping)
  allowedModels.value = parsed.allowedModels
  modelMappings.value = parsed.modelMappings
  modelRestrictionMode.value =
    parsed.modelMappings.length > 0 && parsed.allowedModels.length === 0
      ? 'mapping'
      : 'whitelist'
}

const buildModelRestrictionMapping = () =>
  buildModelMappingObject('combined', allowedModels.value, modelMappings.value)

const applyOpenAIModelMappingCredentials = (credentials: Record<string, unknown>) => {
  const shouldApplyModelMapping = !openaiPassthroughEnabled.value

  if (shouldApplyModelMapping) {
    const modelMapping = buildModelRestrictionMapping()
    if (modelMapping) {
      credentials.model_mapping = modelMapping
    } else {
      delete credentials.model_mapping
    }
  } else if (!credentials.model_mapping) {
    delete credentials.model_mapping
  }

  const compactModelMapping = buildModelMappingObject('mapping', [], openAICompactModelMappings.value)
  if (compactModelMapping) {
    credentials.compact_model_mapping = compactModelMapping
  } else {
    delete credentials.compact_model_mapping
  }
}

const syncFormFromAccount = (newAccount: Account | null) => {
  if (!newAccount) {
    return
  }
  antigravityMixedChannelConfirmed.value = false
  showMixedChannelWarning.value = false
  mixedChannelWarningDetails.value = null
  mixedChannelWarningRawMessage.value = ''
  mixedChannelWarningAction.value = null
  form.name = newAccount.name
  form.notes = newAccount.notes || ''
  form.proxy_id = newAccount.proxy_id
  form.concurrency = newAccount.concurrency
  form.load_factor = newAccount.load_factor ?? null
  priorityWasPresent.value = Object.prototype.hasOwnProperty.call(newAccount, 'priority')
  priorityWasEdited.value = false
  form.priority = newAccount.priority ?? 0
  priorityInput.value = String(newAccount.priority ?? 0)
  form.rate_multiplier = newAccount.rate_multiplier ?? 1
  form.status = (newAccount.status === 'active' || newAccount.status === 'inactive' || newAccount.status === 'error')
    ? newAccount.status
    : 'active'
  form.group_ids = newAccount.group_ids || []
  form.expires_at = newAccount.expires_at ?? null

  // Load intercept warmup requests setting (applies to all account types)
  const credentials = newAccount.credentials as Record<string, unknown> | undefined
  interceptWarmupRequests.value = credentials?.intercept_warmup_requests === true
  autoPauseOnExpired.value = newAccount.auto_pause_on_expired === true
  editVertexProjectId.value = ''
  editVertexClientEmail.value = ''
  editVertexLocation.value = 'us-central1'
  antigravityProjectId.value =
    newAccount.platform === 'antigravity' &&
    newAccount.type === 'oauth' &&
    typeof credentials?.antigravity_project_id === 'string'
      ? credentials.antigravity_project_id.trim()
      : ''

  // Load mixed scheduling setting (only for antigravity accounts)
  mixedScheduling.value = false
  allowOverages.value = false
	const extra = newAccount.extra as Record<string, unknown> | undefined
	mixedScheduling.value = extra?.mixed_scheduling === true
	allowOverages.value = extra?.allow_overages === true
	autoPause5hThreshold.value = typeof extra?.auto_pause_5h_threshold === 'number' ? extra.auto_pause_5h_threshold * 100 : null
	autoPause7dThreshold.value = typeof extra?.auto_pause_7d_threshold === 'number' ? extra.auto_pause_7d_threshold * 100 : null
	autoPause5hDisabled.value = extra?.auto_pause_5h_disabled === true
	autoPause7dDisabled.value = extra?.auto_pause_7d_disabled === true
	upstreamBillingAutoProbeEnabled.value = extra?.upstream_billing_probe_enabled === true
  upstreamBillingRateSyncEnabled.value =
    upstreamBillingAutoProbeEnabled.value && extra?.upstream_billing_rate_sync_enabled === true

  // Load OpenAI passthrough toggle (OpenAI OAuth/SetupToken/API Key)
  openaiPassthroughEnabled.value = false
  openaiFlattenNamespacesEnabled.value = false
  openAILongContextBillingEnabled.value = false
  editPlanType.value = ''
  openAICompactMode.value = 'auto'
  openAIResponsesMode.value = 'auto'
  openAIEndpointCapabilities.value = ['chat_completions', 'embeddings']
  openAICompactModelMappings.value = []
  openaiOAuthResponsesWebSocketV2Mode.value = OPENAI_WS_MODE_OFF
  openaiAPIKeyResponsesWebSocketV2Mode.value = OPENAI_WS_MODE_OFF
  codexCLIOnlyEnabled.value = false
  codexCLIOnlyAppServerEnabled.value = false
  codexFingerprintMode.value = 'session'
  codexImageToolMode.value = 'inherit'
  anthropicPassthroughEnabled.value = false
  anthropicAPIKeyAuthScheme.value = 'x_api_key'
  webSearchEmulationMode.value = 'default'
  if (newAccount.platform === 'openai' && (newAccount.type === 'oauth' || newAccount.type === 'setup-token' || newAccount.type === 'apikey')) {
    openaiPassthroughEnabled.value = extra?.openai_passthrough === true || extra?.openai_oauth_passthrough === true
    openaiFlattenNamespacesEnabled.value =
      newAccount.type === 'oauth' && extra?.openai_responses_flatten_namespaces === true
    const longContextBillingValue = extra?.openai_long_context_billing_enabled
    openAILongContextBillingEnabled.value = longContextBillingValue === true
    // plan_type 手动覆盖仅 OAuth 有实际调度语义(IsOpenAIChatGPTSubscription 要求 oauth),故只对 oauth 回填
    editPlanType.value = newAccount.type === 'oauth'
      ? readPlanType(newAccount.credentials as Record<string, unknown> | undefined)
      : ''
    openAICompactMode.value = (extra?.openai_compact_mode as OpenAICompactMode) || 'auto'
    if (newAccount.type === 'apikey') {
      openAIResponsesMode.value = normalizeOpenAIResponsesMode(extra?.openai_responses_mode)
      openAIEndpointCapabilities.value = readOpenAIEndpointCapabilities(
        newAccount.credentials as Record<string, unknown> | undefined
      )
      if (!openAITextGenerationCapabilityEnabled.value) {
        openAIResponsesMode.value = 'auto'
      }
    }
    const codexImageGenerationBridgeValue = typeof extra?.codex_image_generation_bridge === 'boolean'
      ? extra.codex_image_generation_bridge
      : extra?.codex_image_generation_bridge_enabled
    if (extra?.codex_image_generation_explicit_tool_policy === 'strip') {
      codexImageToolMode.value = 'block'
    } else if (codexImageGenerationBridgeValue === true) {
      codexImageToolMode.value = 'enabled'
    } else if (codexImageGenerationBridgeValue === false) {
      codexImageToolMode.value = 'disabled'
    }
    openaiOAuthResponsesWebSocketV2Mode.value = resolveOpenAIWSModeFromExtra(extra, {
      modeKey: 'openai_oauth_responses_websockets_v2_mode',
      enabledKey: 'openai_oauth_responses_websockets_v2_enabled',
      fallbackEnabledKeys: ['responses_websockets_v2_enabled', 'openai_ws_enabled'],
      defaultMode: OPENAI_WS_MODE_OFF
    })
    openaiAPIKeyResponsesWebSocketV2Mode.value = resolveOpenAIWSModeFromExtra(extra, {
      modeKey: 'openai_apikey_responses_websockets_v2_mode',
      enabledKey: 'openai_apikey_responses_websockets_v2_enabled',
      fallbackEnabledKeys: ['responses_websockets_v2_enabled', 'openai_ws_enabled'],
      defaultMode: OPENAI_WS_MODE_OFF
    })
    if (newAccount.type === 'oauth' || newAccount.type === 'setup-token') {
      codexCLIOnlyEnabled.value = extra?.codex_cli_only === true
      codexCLIOnlyAppServerEnabled.value =
        extra?.codex_cli_only_allow_app_server === true
    }
    if (newAccount.type === 'oauth') {
      const fpMode = extra?.codex_fingerprint_mode as string | undefined
      codexFingerprintMode.value = (['off', 'device', 'session', 'full'].includes(fpMode || '')
        ? fpMode as CodexFingerprintMode
        : 'session')
    }
    const credentials = newAccount.credentials as Record<string, unknown> | undefined
    const compactMappings = credentials?.compact_model_mapping as Record<string, string> | undefined
    if (compactMappings && typeof compactMappings === 'object') {
      openAICompactModelMappings.value = Object.entries(compactMappings).map(([from, to]) => ({ from, to }))
    }
  }
  if (newAccount.platform === 'anthropic' && newAccount.type === 'apikey') {
    anthropicPassthroughEnabled.value = extra?.anthropic_passthrough === true
    anthropicAPIKeyAuthScheme.value = extra?.anthropic_apikey_auth_scheme === 'authorization_bearer'
      ? 'authorization_bearer'
      : 'x_api_key'
    // 三态：string "default"/"enabled"/"disabled"，向后兼容旧 bool
    const wsVal = extra?.web_search_emulation
    if (wsVal === 'enabled' || wsVal === 'disabled') {
      webSearchEmulationMode.value = wsVal
    } else if (wsVal === true) {
      webSearchEmulationMode.value = 'enabled'
    } else {
      webSearchEmulationMode.value = 'default'
    }
  }

  // Load quota limit for apikey/bedrock accounts (bedrock quota is also loaded in its own branch above)
  if (newAccount.type === 'apikey' || newAccount.type === 'bedrock') {
    const quotaVal = extra?.quota_limit as number | undefined
    editQuotaLimit.value = (quotaVal && quotaVal > 0) ? quotaVal : null
    const dailyVal = extra?.quota_daily_limit as number | undefined
    editQuotaDailyLimit.value = (dailyVal && dailyVal > 0) ? dailyVal : null
    const weeklyVal = extra?.quota_weekly_limit as number | undefined
    editQuotaWeeklyLimit.value = (weeklyVal && weeklyVal > 0) ? weeklyVal : null
    // Load quota reset mode config
    editDailyResetMode.value = (extra?.quota_daily_reset_mode as 'rolling' | 'fixed') || null
    editDailyResetHour.value = (extra?.quota_daily_reset_hour as number) ?? null
    editWeeklyResetMode.value = (extra?.quota_weekly_reset_mode as 'rolling' | 'fixed') || null
    editWeeklyResetDay.value = (extra?.quota_weekly_reset_day as number) ?? null
    editWeeklyResetHour.value = (extra?.quota_weekly_reset_hour as number) ?? null
    editResetTimezone.value = (extra?.quota_reset_timezone as string) || null
    // Load quota notify config
    loadQuotaNotifyFromExtra(extra)
  } else {
    editQuotaLimit.value = null
    editQuotaDailyLimit.value = null
    editQuotaWeeklyLimit.value = null
    editDailyResetMode.value = null
    editDailyResetHour.value = null
    editWeeklyResetMode.value = null
    editWeeklyResetDay.value = null
    editWeeklyResetHour.value = null
    editResetTimezone.value = null
    resetQuotaNotify()
  }

  // Load antigravity model mapping (Antigravity 只支持映射模式)
  if (newAccount.platform === 'antigravity') {
    const credentials = newAccount.credentials as Record<string, unknown> | undefined

    // Antigravity 始终使用映射模式
    antigravityModelRestrictionMode.value = 'mapping'
    antigravityWhitelistModels.value = []

    // 从 model_mapping 读取映射配置
    const rawAgMapping = credentials?.model_mapping as Record<string, string> | undefined
    if (rawAgMapping && typeof rawAgMapping === 'object') {
      const entries = Object.entries(rawAgMapping)
      // 无论是白名单样式(key===value)还是真正的映射，都统一转换为映射列表
      antigravityModelMappings.value = entries.map(([from, to]) => ({ from, to }))
    } else {
      // 兼容旧数据：从 model_whitelist 读取，转换为映射格式
      const rawWhitelist = credentials?.model_whitelist
      if (Array.isArray(rawWhitelist) && rawWhitelist.length > 0) {
        antigravityModelMappings.value = rawWhitelist
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0)
          .map((m) => ({ from: m, to: m }))
      } else {
        antigravityModelMappings.value = []
      }
    }
  } else {
    antigravityModelRestrictionMode.value = 'mapping'
    antigravityWhitelistModels.value = []
    antigravityModelMappings.value = []
  }

  // Load quota control settings (Anthropic OAuth/SetupToken only)
  loadQuotaControlSettings(newAccount)

  loadTempUnschedRules(credentials)
  loadAccountSchedulingThresholdOverride(newAccount.platform, credentials)

  // Load header override state (anthropic/openai apikey + grok apikey/oauth)
  headerOverrideEnabled.value = false
  headerOverrideRows.value = []
  if (newAccount.credentials && isHeaderOverrideCapable(newAccount.platform, newAccount.type)) {
    const overrideCreds = newAccount.credentials as Record<string, unknown>
    headerOverrideEnabled.value = overrideCreds[HEADER_OVERRIDE_ENABLED_CREDENTIAL_KEY] === true
    headerOverrideRows.value = splitHeaderOverridesObject(
      overrideCreds[HEADER_OVERRIDES_CREDENTIAL_KEY]
    )
  }

  // Load Grok OAuth custom upstream URL state（存储的官方地址视同未定制）
  grokOAuthCustomBaseUrlEnabled.value = false
  grokOAuthBaseUrl.value = ''
  const grokClientToolCacheSetting =
    newAccount.platform === 'grok' && newAccount.type === 'oauth'
      ? newAccount.extra?.[GROK_CLIENT_TOOL_CACHE_EXTRA_KEY]
      : undefined
  grokClientToolCacheEnabled.value =
    newAccount.platform === 'grok' &&
    newAccount.type === 'oauth' &&
    (grokClientToolCacheSetting === undefined || grokClientToolCacheSetting === true)
  if (newAccount.platform === 'grok' && newAccount.type === 'oauth' && newAccount.credentials) {
    const grokCreds = newAccount.credentials as Record<string, unknown>
    if (isCustomGrokBaseUrl(grokCreds.base_url)) {
      grokOAuthCustomBaseUrlEnabled.value = true
      grokOAuthBaseUrl.value = (grokCreds.base_url as string).trim()
    }
  }

  // Initialize API Key fields for apikey type
  if (newAccount.type === 'apikey' && newAccount.credentials) {
    const credentials = newAccount.credentials as Record<string, unknown>
    const platformDefaultUrl =
      newAccount.platform === 'openai'
        ? 'https://api.openai.com'
        : newAccount.platform === 'gemini'
          ? 'https://generativelanguage.googleapis.com'
          : newAccount.platform === 'grok'
            ? 'https://api.x.ai/v1'
            : 'https://api.anthropic.com'
    editBaseUrl.value = (credentials.base_url as string) || platformDefaultUrl

    // Load model mappings and detect mode
    loadModelRestrictionFromMapping(credentials.model_mapping as Record<string, unknown> | undefined)

    // Load pool mode
    poolModeEnabled.value = credentials.pool_mode === true
    poolModeRetryCount.value = normalizePoolModeRetryCount(
      Number(credentials.pool_mode_retry_count ?? DEFAULT_POOL_MODE_RETRY_COUNT)
    )
    poolModeRetryStatusCodesInput.value = formatPoolModeRetryStatusCodes(credentials.pool_mode_retry_status_codes)

    // Load custom error codes
    customErrorCodesEnabled.value = credentials.custom_error_codes_enabled === true
    const existingErrorCodes = credentials.custom_error_codes as number[] | undefined
    if (existingErrorCodes && Array.isArray(existingErrorCodes)) {
      selectedErrorCodes.value = [...existingErrorCodes]
    } else {
      selectedErrorCodes.value = []
    }

  } else if (newAccount.type === 'bedrock' && newAccount.credentials) {
    const bedrockCreds = newAccount.credentials as Record<string, unknown>
    const authMode = (bedrockCreds.auth_mode as string) || 'sigv4'
    editBedrockRegion.value = (bedrockCreds.aws_region as string) || ''
    editBedrockForceGlobal.value = (bedrockCreds.aws_force_global as string) === 'true'

    if (authMode === 'apikey') {
      editBedrockApiKeyValue.value = ''
    } else {
      editBedrockAccessKeyId.value = (bedrockCreds.aws_access_key_id as string) || ''
      editBedrockSecretAccessKey.value = ''
      editBedrockSessionToken.value = ''
    }

    // Load pool mode for bedrock
    poolModeEnabled.value = bedrockCreds.pool_mode === true
    const retryCount = bedrockCreds.pool_mode_retry_count
    poolModeRetryCount.value = (typeof retryCount === 'number' && retryCount >= 0) ? retryCount : DEFAULT_POOL_MODE_RETRY_COUNT
    poolModeRetryStatusCodesInput.value = formatPoolModeRetryStatusCodes(bedrockCreds.pool_mode_retry_status_codes)

    // Load quota limits for bedrock
    const bedrockExtra = (newAccount.extra as Record<string, unknown>) || {}
    editQuotaLimit.value = typeof bedrockExtra.quota_limit === 'number' ? bedrockExtra.quota_limit : null
    editQuotaDailyLimit.value = typeof bedrockExtra.quota_daily_limit === 'number' ? bedrockExtra.quota_daily_limit : null
    editQuotaWeeklyLimit.value = typeof bedrockExtra.quota_weekly_limit === 'number' ? bedrockExtra.quota_weekly_limit : null
    // Load quota notify for bedrock
    loadQuotaNotifyFromExtra(bedrockExtra)

    // Load model mappings for bedrock
    loadModelRestrictionFromMapping(bedrockCreds.model_mapping as Record<string, unknown> | undefined)
  } else if (newAccount.type === 'upstream' && newAccount.credentials) {
    const credentials = newAccount.credentials as Record<string, unknown>
    editBaseUrl.value = (credentials.base_url as string) || ''
  } else if ((newAccount.platform === 'gemini' || newAccount.platform === 'anthropic') && newAccount.type === 'service_account' && newAccount.credentials) {
    const credentials = newAccount.credentials as Record<string, unknown>
    editVertexProjectId.value = (credentials.project_id as string) || ''
    editVertexClientEmail.value = (credentials.client_email as string) || ''
    editVertexLocation.value = (credentials.location as string) || (credentials.vertex_location as string) || 'us-central1'

    // Load model mappings for service_account
    loadModelRestrictionFromMapping(credentials.model_mapping as Record<string, unknown> | undefined)
  } else {
    const platformDefaultUrl =
      newAccount.platform === 'openai'
        ? 'https://api.openai.com'
        : newAccount.platform === 'gemini'
          ? 'https://generativelanguage.googleapis.com'
          : newAccount.platform === 'grok'
            ? 'https://api.x.ai/v1'
            : 'https://api.anthropic.com'
    editBaseUrl.value = platformDefaultUrl

    // Load model mappings for OpenAI/Grok OAuth accounts
    if ((newAccount.platform === 'openai' || newAccount.platform === 'grok') && newAccount.credentials) {
      const oauthCredentials = newAccount.credentials as Record<string, unknown>
      loadModelRestrictionFromMapping(oauthCredentials.model_mapping as Record<string, unknown> | undefined)
    } else {
      modelRestrictionMode.value = 'whitelist'
      modelMappings.value = []
      allowedModels.value = []
    }
    poolModeEnabled.value = false
    poolModeRetryCount.value = DEFAULT_POOL_MODE_RETRY_COUNT
    poolModeRetryStatusCodesInput.value = ''
    customErrorCodesEnabled.value = false
    selectedErrorCodes.value = []
  }
  editApiKey.value = ''
}

async function loadTLSProfiles() {
  try {
    const profiles = await adminAPI.tlsFingerprintProfiles.list()
    tlsFingerprintProfiles.value = profiles.map(p => ({ id: p.id, name: p.name }))
  } catch {
    tlsFingerprintProfiles.value = []
  }
}

watch(
  [() => props.show, () => props.account],
  ([show, newAccount], [wasShow, previousAccount]) => {
    if (!show || !newAccount) {
      return
    }
    if (!wasShow || newAccount !== previousAccount) {
      syncFormFromAccount(newAccount)
      loadTLSProfiles()
    }
  },
  { immediate: true }
)

const addPresetMapping = (from: string, to: string) => {
  const exists = modelMappings.value.some((m) => m.from === from)
  if (exists) {
    appStore.showInfo(t('admin.accounts.mappingExists', { model: from }))
    return
  }
  modelMappings.value.push({ from, to })
}

const addAntigravityPresetMapping = (from: string, to: string) => {
  const exists = antigravityModelMappings.value.some((m) => m.from === from)
  if (exists) {
    appStore.showInfo(t('admin.accounts.mappingExists', { model: from }))
    return
  }
  antigravityModelMappings.value.push({ from, to })
}

const syncAntigravityUpstreamModels = async () => {
  if (!props.account?.id || isSyncingAntigravityUpstream.value) return

  isSyncingAntigravityUpstream.value = true
  try {
    const result = await adminAPI.accounts.syncUpstreamModels(props.account.id)
    const upstreamModels = result.models.map((model) => model.trim()).filter(Boolean)
    if (upstreamModels.length === 0) {
      appStore.showInfo(t('admin.accounts.syncUpstreamModelsEmpty'))
      return
    }

    let addedCount = 0
    for (const model of upstreamModels) {
      const exists = antigravityModelMappings.value.some((mapping) => mapping.from === model)
      if (!exists) {
        antigravityModelMappings.value.push({ from: model, to: model })
        addedCount += 1
      }
    }

    if (addedCount > 0) {
      appStore.showSuccess(t('admin.accounts.syncUpstreamModelsSuccess', { count: addedCount, total: upstreamModels.length }))
    } else {
      appStore.showInfo(t('admin.accounts.syncUpstreamModelsNoChanges', { count: upstreamModels.length }))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : t('admin.accounts.syncUpstreamModelsFailed')
    appStore.showError(t('admin.accounts.syncUpstreamModelsError', { message }))
  } finally {
    isSyncingAntigravityUpstream.value = false
  }
}

// Error code toggle helper
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

// Add custom error code from input
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

// Remove error code
const removeErrorCode = (code: number) => {
  const index = selectedErrorCodes.value.indexOf(code)
  if (index !== -1) {
    selectedErrorCodes.value.splice(index, 1)
  }
}

const addTempUnschedRule = (preset?: TempUnschedRuleForm) => {
  if (preset) {
    tempUnschedRules.value.push({ ...preset })
    return
  }
  tempUnschedRules.value.push({
    error_code: null,
    keywords: '',
    duration_minutes: 30,
    description: ''
  })
}

const removeTempUnschedRule = (index: number) => {
  tempUnschedRules.value.splice(index, 1)
}

const moveTempUnschedRule = (index: number, direction: number) => {
  const target = index + direction
  if (target < 0 || target >= tempUnschedRules.value.length) return
  const rules = tempUnschedRules.value
  const current = rules[index]
  rules[index] = rules[target]
  rules[target] = current
}

const buildTempUnschedRules = (rules: TempUnschedRuleForm[]) => {
  const out: Array<{
    error_code: number
    keywords: string[]
    duration_minutes: number
    description: string
  }> = []

  for (const rule of rules) {
    const errorCode = Number(rule.error_code)
    const duration = Number(rule.duration_minutes)
    const keywords = splitTempUnschedKeywords(rule.keywords)
    if (!Number.isFinite(errorCode) || errorCode < 100 || errorCode > 599) {
      continue
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      continue
    }
    if (keywords.length === 0) {
      continue
    }
    out.push({
      error_code: Math.trunc(errorCode),
      keywords,
      duration_minutes: Math.trunc(duration),
      description: rule.description.trim()
    })
  }

  return out
}

const applyTempUnschedConfig = (credentials: Record<string, unknown>) => {
  if (!tempUnschedEnabled.value) {
    delete credentials.temp_unschedulable_enabled
    delete credentials.temp_unschedulable_rules
    return true
  }

  const rules = buildTempUnschedRules(tempUnschedRules.value)
  if (rules.length === 0) {
    appStore.showError(t('admin.accounts.tempUnschedulable.rulesInvalid'))
    return false
  }

  credentials.temp_unschedulable_enabled = true
  credentials.temp_unschedulable_rules = rules
  return true
}


function supportsAccountSchedulingThresholdOverridePlatform(platform: Account['platform'] | undefined) {
  return platform === 'openai' || platform === 'anthropic' || platform === 'grok'
}

function normalizeAccountSchedulingThresholdOverride(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }
  const integer = Math.trunc(numeric)
  if (integer < 1 || integer > 100) {
    return null
  }
  return integer
}

function clampAccountSchedulingThresholdOverride(value: unknown): number {
  return Math.min(100, Math.max(1, Math.trunc(Number(value) || 100)))
}

function loadAccountSchedulingThresholdOverride(
  platform: Account['platform'] | undefined,
  credentials: Record<string, unknown> | undefined
) {
  if (!supportsAccountSchedulingThresholdOverridePlatform(platform)) {
    accountSchedulingThresholdOverrideEnabled.value = false
    accountSchedulingThresholdOverrideValue.value = 100
    return
  }
  const value = normalizeAccountSchedulingThresholdOverride(
    credentials?.[ACCOUNT_SCHEDULING_THRESHOLD_CREDENTIAL_KEY]
  )
  accountSchedulingThresholdOverrideEnabled.value = value !== null
  accountSchedulingThresholdOverrideValue.value = value ?? 100
}

const applyAccountSchedulingThresholdOverridePatch = (
  credentials: Record<string, unknown>,
  currentCredentials: Record<string, unknown>,
  platform: Account['platform'] | undefined = props.account?.platform
) => {
  if (!supportsAccountSchedulingThresholdOverridePlatform(platform)) {
    return
  }
  const current = normalizeAccountSchedulingThresholdOverride(
    currentCredentials[ACCOUNT_SCHEDULING_THRESHOLD_CREDENTIAL_KEY]
  )
  if (!accountSchedulingThresholdOverrideEnabled.value) {
    if (current !== null) {
      credentials[ACCOUNT_SCHEDULING_THRESHOLD_CREDENTIAL_KEY] = null
    }
    return
  }
  const next = clampAccountSchedulingThresholdOverride(accountSchedulingThresholdOverrideValue.value)
  if (current !== next) {
    credentials[ACCOUNT_SCHEDULING_THRESHOLD_CREDENTIAL_KEY] = next
  }
}

function loadTempUnschedRules(credentials?: Record<string, unknown>) {
  tempUnschedEnabled.value = credentials?.temp_unschedulable_enabled === true
  const rawRules = credentials?.temp_unschedulable_rules
  if (!Array.isArray(rawRules)) {
    tempUnschedRules.value = []
    return
  }

  tempUnschedRules.value = rawRules.map((rule) => {
    const entry = rule as Record<string, unknown>
    return {
      error_code: toPositiveNumber(entry.error_code),
      keywords: formatTempUnschedKeywords(entry.keywords),
      duration_minutes: toPositiveNumber(entry.duration_minutes),
      description: typeof entry.description === 'string' ? entry.description : ''
    }
  })
}

// Load quota control settings from account (Anthropic OAuth/SetupToken only)
function loadQuotaControlSettings(account: Account) {
  // Reset all quota control state first
  windowCostEnabled.value = false
  windowCostLimit.value = null
  windowCostStickyReserve.value = null
  sessionLimitEnabled.value = false
  maxSessions.value = null
  sessionIdleTimeout.value = null
  rpmLimitEnabled.value = false
  baseRpm.value = null
  rpmStrategy.value = 'tiered'
  rpmStickyBuffer.value = null
  userMsgQueueMode.value = ''
  tlsFingerprintEnabled.value = false
  tlsFingerprintProfileId.value = null
  sessionIdMaskingEnabled.value = false
  cacheTTLOverrideEnabled.value = false
  cacheTTLOverrideTarget.value = '5m'
  customBaseUrlEnabled.value = false
  customBaseUrl.value = ''

  // Remaining quota control settings only apply to Anthropic accounts
  if (account.platform !== 'anthropic') {
    return
  }

  // Window cost / session limit only apply to Anthropic OAuth/SetupToken accounts
  if (account.type !== 'oauth' && account.type !== 'setup-token') {
    return
  }

  // Load from extra field (via backend DTO fields)
  if (account.window_cost_limit != null && account.window_cost_limit > 0) {
    windowCostEnabled.value = true
    windowCostLimit.value = account.window_cost_limit
    windowCostStickyReserve.value = account.window_cost_sticky_reserve ?? 10
  }

  if (account.max_sessions != null && account.max_sessions > 0) {
    sessionLimitEnabled.value = true
    maxSessions.value = account.max_sessions
    sessionIdleTimeout.value = account.session_idle_timeout_minutes ?? 5
  }

  // RPM limit
  if (account.base_rpm != null && account.base_rpm > 0) {
    rpmLimitEnabled.value = true
    baseRpm.value = account.base_rpm
    rpmStrategy.value = (account.rpm_strategy as 'tiered' | 'sticky_exempt') || 'tiered'
    rpmStickyBuffer.value = account.rpm_sticky_buffer ?? null
  }

  // UMQ mode（独立于 RPM 加载，防止编辑无 RPM 账号时丢失已有配置）
  userMsgQueueMode.value = account.user_msg_queue_mode ?? ''

  // Load TLS fingerprint setting
  if (account.enable_tls_fingerprint === true) {
    tlsFingerprintEnabled.value = true
  }
  tlsFingerprintProfileId.value = account.tls_fingerprint_profile_id ?? null

  // Load session ID masking setting
  if (account.session_id_masking_enabled === true) {
    sessionIdMaskingEnabled.value = true
  }

  // Load cache TTL override setting
  if (account.cache_ttl_override_enabled === true) {
    cacheTTLOverrideEnabled.value = true
    cacheTTLOverrideTarget.value = account.cache_ttl_override_target || '5m'
  }

  // Load custom base URL setting
  if (account.custom_base_url_enabled === true) {
    customBaseUrlEnabled.value = true
    customBaseUrl.value = account.custom_base_url || ''
  }
}

function formatTempUnschedKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .join(', ')
  }
  if (typeof value === 'string') {
    return value
  }
  return ''
}

const splitTempUnschedKeywords = (value: string) => {
  return value
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function toPositiveNumber(value: unknown) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    return null
  }
  return Math.trunc(num)
}

const needsMixedChannelCheck = () => props.account?.platform === 'antigravity' || props.account?.platform === 'anthropic'

const buildMixedChannelDetails = (resp?: CheckMixedChannelResponse) => {
  const details = resp?.details
  if (!details) {
    return null
  }
  return {
    groupName: details.group_name || 'Unknown',
    currentPlatform: details.current_platform || 'Unknown',
    otherPlatform: details.other_platform || 'Unknown'
  }
}

const clearMixedChannelDialog = () => {
  showMixedChannelWarning.value = false
  mixedChannelWarningDetails.value = null
  mixedChannelWarningRawMessage.value = ''
  mixedChannelWarningAction.value = null
}

const openMixedChannelDialog = (opts: {
  response?: CheckMixedChannelResponse
  message?: string
  onConfirm: () => Promise<void>
}) => {
  mixedChannelWarningDetails.value = buildMixedChannelDetails(opts.response)
  mixedChannelWarningRawMessage.value =
    opts.message || opts.response?.message || t('admin.accounts.failedToUpdate')
  mixedChannelWarningAction.value = opts.onConfirm
  showMixedChannelWarning.value = true
}

const withAntigravityConfirmFlag = (payload: Record<string, unknown>) => {
  if (needsMixedChannelCheck() && antigravityMixedChannelConfirmed.value) {
    return {
      ...payload,
      confirm_mixed_channel_risk: true
    }
  }
  const cloned = { ...payload }
  delete cloned.confirm_mixed_channel_risk
  return cloned
}

const ensureAntigravityMixedChannelConfirmed = async (onConfirm: () => Promise<void>): Promise<boolean> => {
  if (!needsMixedChannelCheck()) {
    return true
  }
  if (antigravityMixedChannelConfirmed.value) {
    return true
  }
  if (!props.account) {
    return false
  }

  try {
    const result = await adminAPI.accounts.checkMixedChannelRisk({
      platform: props.account.platform,
      group_ids: form.group_ids,
      account_id: props.account.id
    })
    if (!result.has_risk) {
      return true
    }
    openMixedChannelDialog({
      response: result,
      onConfirm: async () => {
        antigravityMixedChannelConfirmed.value = true
        await onConfirm()
      }
    })
    return false
  } catch (error: any) {
    appStore.showError(error.message || t('admin.accounts.failedToUpdate'))
    return false
  }
}

const formatDateTimeLocal = formatDateTimeLocalInput
const parseDateTimeLocal = parseDateTimeLocalInput

// Methods
const handleClose = () => {
  antigravityMixedChannelConfirmed.value = false
  clearMixedChannelDialog()
  emit('close')
}

const submitUpdateAccount = async (accountID: number, updatePayload: Record<string, unknown>) => {
  submitting.value = true
  try {
    const updatedAccount = await adminAPI.accounts.update(accountID, withAntigravityConfirmFlag(updatePayload))
    appStore.showSuccess(t('admin.accounts.accountUpdated'))
    emit('updated', updatedAccount)
    handleClose()
  } catch (error: any) {
    if (error.status === 409 && error.error === 'mixed_channel_warning' && needsMixedChannelCheck()) {
      openMixedChannelDialog({
        message: error.message,
        onConfirm: async () => {
          antigravityMixedChannelConfirmed.value = true
          await submitUpdateAccount(accountID, updatePayload)
        }
      })
      return
    }
    appStore.showError(error.message || t('admin.accounts.failedToUpdate'))
  } finally {
    submitting.value = false
  }
}

const handleSubmit = async () => {
  if (!props.account) return
  const parsedPriority = parseAccountPriority(priorityInput.value)
  if (parsedPriority == null) {
    appStore.showError(t('admin.accounts.priorityInvalid'))
    return
  }
  form.priority = parsedPriority
  const accountID = props.account.id

  if (form.status !== 'active' && form.status !== 'inactive' && form.status !== 'error') {
    appStore.showError(t('admin.accounts.pleaseSelectStatus'))
    return
  }

  const updatePayload: Record<string, unknown> = { ...form }
  if (!priorityWasPresent.value && !priorityWasEdited.value) {
    delete updatePayload.priority
  }
  try {
    // 后端期望 proxy_id: 0 表示清除代理，而不是 null
    if (updatePayload.proxy_id === null) {
      updatePayload.proxy_id = 0
    }
    if (form.expires_at === null) {
      updatePayload.expires_at = 0
    }
    // load_factor: 空值/NaN/0/负数 时发送 0（后端约定 <= 0 = 清除）
    const lf = form.load_factor
    if (lf == null || Number.isNaN(lf) || lf <= 0) {
      updatePayload.load_factor = 0
    }
    updatePayload.auto_pause_on_expired = autoPauseOnExpired.value
    if (props.account.type === 'apikey') {
      updatePayload.upstream_billing_probe_enabled = upstreamBillingAutoProbeEnabled.value
      updatePayload.upstream_billing_rate_sync_enabled = upstreamBillingRateSyncEnabled.value
      if (upstreamBillingRateSyncEnabled.value) {
        delete updatePayload.rate_multiplier
      }
    }

    // For apikey type, handle credentials update
    if (props.account.type === 'apikey') {
      const currentCredentials = (props.account.credentials as Record<string, unknown>) || {}
      const newBaseUrl = editBaseUrl.value.trim() || defaultBaseUrl.value
      const shouldApplyModelMapping = !(props.account.platform === 'openai' && openaiPassthroughEnabled.value)

      // Always update credentials for apikey type to handle model mapping changes
      const newCredentials: Record<string, unknown> = {
        ...currentCredentials,
        base_url: newBaseUrl
      }

      // Handle API key
      // 后端响应已脱敏：currentCredentials 不会再包含 api_key 原文。
      // 用户填入新值则覆盖；留空时优先看 credentials_status.has_api_key；
      // 若后端尚未升级（无 credentials_status），回退读旧结构 currentCredentials.api_key。
      // 两者都无才报错。
      const hasExistingApiKey =
        props.account.credentials_status?.has_api_key ?? Boolean(currentCredentials.api_key)
      if (editApiKey.value.trim()) {
        newCredentials.api_key = editApiKey.value.trim()
      } else if (!hasExistingApiKey) {
        appStore.showError(t('admin.accounts.apiKeyIsRequired'))
        return
      }

      // Add model mapping if configured（OpenAI 开启自动透传时保留现有映射，不再编辑）
      if (shouldApplyModelMapping) {
        const modelMapping = buildModelRestrictionMapping()
        if (modelMapping) {
          newCredentials.model_mapping = modelMapping
        } else {
          delete newCredentials.model_mapping
        }
      } else if (currentCredentials.model_mapping) {
        newCredentials.model_mapping = currentCredentials.model_mapping
      }
      if (props.account.platform === 'openai') {
        applyOpenAIEndpointCapabilities(newCredentials)
        const compactModelMapping = buildModelMappingObject('mapping', [], openAICompactModelMappings.value)
        if (compactModelMapping) {
          newCredentials.compact_model_mapping = compactModelMapping
        } else {
          delete newCredentials.compact_model_mapping
        }
      }

      // Add pool mode if enabled
      if (poolModeEnabled.value) {
        newCredentials.pool_mode = true
        newCredentials.pool_mode_retry_count = normalizePoolModeRetryCount(poolModeRetryCount.value)
        const parsedRetryStatusCodes = parsePoolModeRetryStatusCodes(poolModeRetryStatusCodesInput.value)
        if (parsedRetryStatusCodes.length > 0) {
          newCredentials.pool_mode_retry_status_codes = parsedRetryStatusCodes
        } else {
          delete newCredentials.pool_mode_retry_status_codes
        }
      } else {
        delete newCredentials.pool_mode
        delete newCredentials.pool_mode_retry_count
        delete newCredentials.pool_mode_retry_status_codes
      }

      // Add custom error codes if enabled
      if (customErrorCodesEnabled.value) {
        newCredentials.custom_error_codes_enabled = true
        newCredentials.custom_error_codes = [...selectedErrorCodes.value]
      } else {
        delete newCredentials.custom_error_codes_enabled
        delete newCredentials.custom_error_codes
      }

      // Add header override if enabled (anthropic/openai/grok apikey)
      if (isHeaderOverrideCapable(props.account.platform, 'apikey')) {
        if (headerOverrideEnabled.value) {
          const headerError = validateHeaderOverrideRows(headerOverrideRows.value)
          if (headerError) {
            appStore.showError(t(`admin.accounts.headerOverride.${headerError}`))
            return
          }
        }
        applyHeaderOverride(newCredentials, headerOverrideEnabled.value, headerOverrideRows.value, 'edit')
      }

      // Add intercept warmup requests setting
      applyInterceptWarmup(newCredentials, interceptWarmupRequests.value, 'edit')
      applyAccountSchedulingThresholdOverridePatch(newCredentials, currentCredentials)
      if (!applyTempUnschedConfig(newCredentials)) {
        return
      }

      updatePayload.credentials = newCredentials
    } else if (props.account.type === 'upstream') {
      const currentCredentials = (props.account.credentials as Record<string, unknown>) || {}
      const newCredentials: Record<string, unknown> = { ...currentCredentials }

      newCredentials.base_url = editBaseUrl.value.trim()

      if (editApiKey.value.trim()) {
        newCredentials.api_key = editApiKey.value.trim()
      }

      // Add intercept warmup requests setting
      applyInterceptWarmup(newCredentials, interceptWarmupRequests.value, 'edit')

      applyAccountSchedulingThresholdOverridePatch(newCredentials, currentCredentials)
      if (!applyTempUnschedConfig(newCredentials)) {
        return
      }

      updatePayload.credentials = newCredentials
    } else if ((props.account.platform === 'gemini' || props.account.platform === 'anthropic') && props.account.type === 'service_account') {
      const currentCredentials = (props.account.credentials as Record<string, unknown>) || {}
      const newCredentials: Record<string, unknown> = { ...currentCredentials }

      if (!editVertexProjectId.value.trim()) {
        appStore.showError(t('admin.accounts.vertexSaJsonMissingProjectId'))
        return
      }
      if (!editVertexClientEmail.value.trim()) {
        appStore.showError(t('admin.accounts.vertexSaJsonMissingClientEmail'))
        return
      }
      if (!editVertexLocation.value.trim()) {
        appStore.showError(t('admin.accounts.vertexLocationRequired'))
        return
      }

      // SA JSON 已脱敏不再随 credentials 返回，存在性优先读 credentials_status。
      // 若后端尚未升级（无 credentials_status），回退读旧结构 service_account_json / service_account。
      const credentialsStatus = props.account.credentials_status
      const hasExistingServiceAccountJson = credentialsStatus
        ? Boolean(
            credentialsStatus.has_service_account_json || credentialsStatus.has_service_account
          )
        : Boolean(currentCredentials.service_account_json || currentCredentials.service_account)
      if (!hasExistingServiceAccountJson) {
        appStore.showError(t('admin.accounts.vertexSaJsonRequired'))
        return
      }
      newCredentials.project_id = editVertexProjectId.value.trim()
      newCredentials.client_email = editVertexClientEmail.value.trim()
      newCredentials.location = editVertexLocation.value.trim()
      newCredentials.tier_id = 'vertex'

      // Add model mapping if configured
      const modelMapping = buildModelRestrictionMapping()
      if (modelMapping) {
        newCredentials.model_mapping = modelMapping
      } else {
        delete newCredentials.model_mapping
      }

      applyInterceptWarmup(newCredentials, interceptWarmupRequests.value, 'edit')
      applyAccountSchedulingThresholdOverridePatch(newCredentials, currentCredentials)
      if (!applyTempUnschedConfig(newCredentials)) {
        return
      }

      updatePayload.credentials = newCredentials
    } else if (props.account.type === 'bedrock') {
      const currentCredentials = (props.account.credentials as Record<string, unknown>) || {}
      const newCredentials: Record<string, unknown> = { ...currentCredentials }

      newCredentials.aws_region = editBedrockRegion.value.trim()
      if (editBedrockForceGlobal.value) {
        newCredentials.aws_force_global = 'true'
      } else {
        delete newCredentials.aws_force_global
      }

      if (isBedrockAPIKeyMode.value) {
        // API Key mode: only update api_key if user provided new value
        if (editBedrockApiKeyValue.value.trim()) {
          newCredentials.api_key = editBedrockApiKeyValue.value.trim()
        }
      } else {
        // SigV4 mode
        newCredentials.aws_access_key_id = editBedrockAccessKeyId.value.trim()
        if (editBedrockSecretAccessKey.value.trim()) {
          newCredentials.aws_secret_access_key = editBedrockSecretAccessKey.value.trim()
        }
        if (editBedrockSessionToken.value.trim()) {
          newCredentials.aws_session_token = editBedrockSessionToken.value.trim()
        }
      }

      // Pool mode
      if (poolModeEnabled.value) {
        newCredentials.pool_mode = true
        newCredentials.pool_mode_retry_count = normalizePoolModeRetryCount(poolModeRetryCount.value)
        const parsedRetryStatusCodes = parsePoolModeRetryStatusCodes(poolModeRetryStatusCodesInput.value)
        if (parsedRetryStatusCodes.length > 0) {
          newCredentials.pool_mode_retry_status_codes = parsedRetryStatusCodes
        } else {
          delete newCredentials.pool_mode_retry_status_codes
        }
      } else {
        delete newCredentials.pool_mode
        delete newCredentials.pool_mode_retry_count
        delete newCredentials.pool_mode_retry_status_codes
      }

      // Model mapping
      const modelMapping = buildModelRestrictionMapping()
      if (modelMapping) {
        newCredentials.model_mapping = modelMapping
      } else {
        delete newCredentials.model_mapping
      }

      applyInterceptWarmup(newCredentials, interceptWarmupRequests.value, 'edit')
      applyAccountSchedulingThresholdOverridePatch(newCredentials, currentCredentials)
      if (!applyTempUnschedConfig(newCredentials)) {
        return
      }

      updatePayload.credentials = newCredentials
    } else {
      // For oauth/setup-token types, only update intercept_warmup_requests if changed
      const currentCredentials = (props.account.credentials as Record<string, unknown>) || {}
      const newCredentials: Record<string, unknown> = { ...currentCredentials }

      applyInterceptWarmup(newCredentials, interceptWarmupRequests.value, 'edit')
      applyAccountSchedulingThresholdOverridePatch(newCredentials, currentCredentials)
      if (!applyTempUnschedConfig(newCredentials)) {
        return
      }

      updatePayload.credentials = newCredentials
    }

    // OpenAI/Grok OAuth: persist model mapping to credentials
    if ((props.account.platform === 'openai' || props.account.platform === 'grok') && props.account.type === 'oauth') {
      const currentCredentials = isSparkShadow.value
        ? {}
        : (updatePayload.credentials as Record<string, unknown>) ||
          ((props.account.credentials as Record<string, unknown>) || {})
      const newCredentials: Record<string, unknown> = { ...currentCredentials }
      if (props.account.platform === 'openai') {
        applyOpenAIModelMappingCredentials(newCredentials)
      } else {
        const modelMapping = buildModelRestrictionMapping()
        if (modelMapping) {
          newCredentials.model_mapping = modelMapping
        } else {
          delete newCredentials.model_mapping
        }
      }

      updatePayload.credentials = newCredentials
    }

    // Grok OAuth: 自定义上游地址 + 请求头覆写。base_url 仅改写转发端点，
    // OAuth 授权与令牌刷新链路不读取该值；关闭开关即恢复默认官方网关。
    if (props.account.platform === 'grok' && props.account.type === 'oauth') {
      const currentCredentials =
        (updatePayload.credentials as Record<string, unknown>) ||
        ((props.account.credentials as Record<string, unknown>) || {})
      const newCredentials: Record<string, unknown> = { ...currentCredentials }

      if (grokOAuthCustomBaseUrlEnabled.value) {
        const trimmedBaseUrl = grokOAuthBaseUrl.value.trim()
        if (!trimmedBaseUrl) {
          appStore.showError(t('admin.accounts.grokCustomBaseUrl.required'))
          return
        }
        if (!/^https?:\/\//i.test(trimmedBaseUrl)) {
          appStore.showError(t('admin.accounts.grokCustomBaseUrl.invalid'))
          return
        }
        newCredentials.base_url = trimmedBaseUrl
      } else {
        delete newCredentials.base_url
      }

      if (headerOverrideEnabled.value) {
        const headerError = validateHeaderOverrideRows(headerOverrideRows.value)
        if (headerError) {
          appStore.showError(t(`admin.accounts.headerOverride.${headerError}`))
          return
        }
      }
      applyHeaderOverride(newCredentials, headerOverrideEnabled.value, headerOverrideRows.value, 'edit')

      updatePayload.credentials = newCredentials

      const newExtra: Record<string, unknown> = {
        ...((props.account.extra as Record<string, unknown>) || {})
      }
      // Persist both states so a disabled account remains opted out when the
      // backend applies the default-enabled policy to missing values.
      newExtra[GROK_CLIENT_TOOL_CACHE_EXTRA_KEY] = grokClientToolCacheEnabled.value
      updatePayload.extra = newExtra
    }

    // OpenAI: 手动覆盖订阅档位 plan_type（Plus/Pro/Free）。仅 OAuth 非影子账号：
    // 影子账号凭据由母账号管理(且后端会 sanitize),setup-token 无订阅调度语义。
    if (props.account.platform === 'openai' && props.account.type === 'oauth' && !isSparkShadow.value) {
      const currentCredentials = (updatePayload.credentials as Record<string, unknown>) ||
        ((props.account.credentials as Record<string, unknown>) || {})
      updatePayload.credentials = applyPlanType({ ...currentCredentials }, editPlanType.value)
    }

    // Antigravity: persist model mapping to credentials (applies to all antigravity types)
    // Antigravity 只支持映射模式
    if (props.account.platform === 'antigravity') {
      const currentCredentials = (updatePayload.credentials as Record<string, unknown>) ||
        ((props.account.credentials as Record<string, unknown>) || {})
      const newCredentials: Record<string, unknown> = { ...currentCredentials }
      if (props.account.type === 'oauth') {
        applyAntigravityProjectID(newCredentials, antigravityProjectId.value, 'edit')
      }

      // 移除旧字段
      delete newCredentials.model_whitelist
      delete newCredentials.model_mapping

      // 只使用映射模式
      const antigravityModelMapping = buildModelMappingObject(
        'mapping',
        [],
        antigravityModelMappings.value
      )
      if (antigravityModelMapping) {
        newCredentials.model_mapping = antigravityModelMapping
      }

      updatePayload.credentials = newCredentials
    }

    // For antigravity accounts, handle mixed_scheduling and allow_overages in extra
    if (props.account.platform === 'antigravity') {
      const currentExtra = (props.account.extra as Record<string, unknown>) || {}
      const newExtra: Record<string, unknown> = { ...currentExtra }
      if (mixedScheduling.value) {
        newExtra.mixed_scheduling = true
      } else {
        delete newExtra.mixed_scheduling
      }
      if (allowOverages.value) {
        newExtra.allow_overages = true
      } else {
        delete newExtra.allow_overages
      }
      updatePayload.extra = newExtra
    }

    // For Anthropic OAuth/SetupToken accounts, handle quota control settings in extra
    if (props.account.platform === 'anthropic' && (props.account.type === 'oauth' || props.account.type === 'setup-token')) {
      const currentExtra = (updatePayload.extra as Record<string, unknown>) || (props.account.extra as Record<string, unknown>) || {}
      const newExtra: Record<string, unknown> = { ...currentExtra }

      // Window cost limit settings
      if (windowCostEnabled.value && windowCostLimit.value != null && windowCostLimit.value > 0) {
        newExtra.window_cost_limit = windowCostLimit.value
        newExtra.window_cost_sticky_reserve = windowCostStickyReserve.value ?? 10
      } else {
        delete newExtra.window_cost_limit
        delete newExtra.window_cost_sticky_reserve
      }

      // Session limit settings
      if (sessionLimitEnabled.value && maxSessions.value != null && maxSessions.value > 0) {
        newExtra.max_sessions = maxSessions.value
        newExtra.session_idle_timeout_minutes = sessionIdleTimeout.value ?? 5
      } else {
        delete newExtra.max_sessions
        delete newExtra.session_idle_timeout_minutes
      }

      // RPM limit settings
      if (rpmLimitEnabled.value) {
        const DEFAULT_BASE_RPM = 15
        newExtra.base_rpm = (baseRpm.value != null && baseRpm.value > 0)
          ? baseRpm.value
          : DEFAULT_BASE_RPM
        newExtra.rpm_strategy = rpmStrategy.value
        if (rpmStickyBuffer.value != null && rpmStickyBuffer.value > 0) {
          newExtra.rpm_sticky_buffer = rpmStickyBuffer.value
        } else {
          delete newExtra.rpm_sticky_buffer
        }
      } else {
        delete newExtra.base_rpm
        delete newExtra.rpm_strategy
        delete newExtra.rpm_sticky_buffer
      }

      // UMQ mode（独立于 RPM 保存）
      if (userMsgQueueMode.value) {
        newExtra.user_msg_queue_mode = userMsgQueueMode.value
      } else {
        delete newExtra.user_msg_queue_mode
      }
      delete newExtra.user_msg_queue_enabled  // 清理旧字段

      // TLS fingerprint setting
      if (tlsFingerprintEnabled.value) {
        newExtra.enable_tls_fingerprint = true
        if (tlsFingerprintProfileId.value) {
          newExtra.tls_fingerprint_profile_id = tlsFingerprintProfileId.value
        } else {
          delete newExtra.tls_fingerprint_profile_id
        }
      } else {
        delete newExtra.enable_tls_fingerprint
        delete newExtra.tls_fingerprint_profile_id
      }

      // Session ID masking setting
      if (sessionIdMaskingEnabled.value) {
        newExtra.session_id_masking_enabled = true
      } else {
        delete newExtra.session_id_masking_enabled
      }

      // Cache TTL override setting
      if (cacheTTLOverrideEnabled.value) {
        newExtra.cache_ttl_override_enabled = true
        newExtra.cache_ttl_override_target = cacheTTLOverrideTarget.value
      } else {
        delete newExtra.cache_ttl_override_enabled
        delete newExtra.cache_ttl_override_target
      }

      // Custom base URL relay setting
      if (customBaseUrlEnabled.value && customBaseUrl.value.trim()) {
        newExtra.custom_base_url_enabled = true
        newExtra.custom_base_url = customBaseUrl.value.trim()
      } else {
        delete newExtra.custom_base_url_enabled
        delete newExtra.custom_base_url
      }

      updatePayload.extra = newExtra
    }

    // For Anthropic API Key accounts, handle passthrough mode + web search emulation in extra
    if (props.account.platform === 'anthropic' && props.account.type === 'apikey') {
      const currentExtra = (updatePayload.extra as Record<string, unknown>) || (props.account.extra as Record<string, unknown>) || {}
      const newExtra: Record<string, unknown> = { ...currentExtra }
      if (anthropicPassthroughEnabled.value) {
        newExtra.anthropic_passthrough = true
      } else {
        delete newExtra.anthropic_passthrough
      }
      if (anthropicAPIKeyAuthScheme.value === 'authorization_bearer') {
        newExtra.anthropic_apikey_auth_scheme = 'authorization_bearer'
      } else {
        delete newExtra.anthropic_apikey_auth_scheme
      }
      if (webSearchEmulationMode.value === 'default') {
        delete newExtra.web_search_emulation
      } else {
        newExtra.web_search_emulation = webSearchEmulationMode.value
      }
      updatePayload.extra = newExtra
    }

    // For OpenAI OAuth/SetupToken/API Key accounts, handle passthrough mode in extra
    if (props.account.platform === 'openai' && (props.account.type === 'oauth' || props.account.type === 'setup-token' || props.account.type === 'apikey')) {
      const currentExtra = (props.account.extra as Record<string, unknown>) || {}
      const newExtra: Record<string, unknown> = { ...currentExtra }
      const hadCodexCLIOnlyEnabled = currentExtra.codex_cli_only === true
      if (props.account.type === 'oauth' || props.account.type === 'setup-token') {
        newExtra.openai_oauth_responses_websockets_v2_mode = openaiOAuthResponsesWebSocketV2Mode.value
        newExtra.openai_oauth_responses_websockets_v2_enabled = isOpenAIWSModeEnabled(openaiOAuthResponsesWebSocketV2Mode.value)
      } else if (props.account.type === 'apikey') {
        newExtra.openai_apikey_responses_websockets_v2_mode = openaiAPIKeyResponsesWebSocketV2Mode.value
        newExtra.openai_apikey_responses_websockets_v2_enabled = isOpenAIWSModeEnabled(openaiAPIKeyResponsesWebSocketV2Mode.value)
      }
      delete newExtra.responses_websockets_v2_enabled
      delete newExtra.openai_ws_enabled
      if (openaiPassthroughEnabled.value) {
        newExtra.openai_passthrough = true
      } else {
        delete newExtra.openai_passthrough
        delete newExtra.openai_oauth_passthrough
      }
      // 缺省即保留 namespace，不写空值，避免 extra 里堆积默认项
      if (props.account.type === 'oauth' && openaiFlattenNamespacesEnabled.value) {
        newExtra.openai_responses_flatten_namespaces = true
      } else {
        delete newExtra.openai_responses_flatten_namespaces
      }
      if (isSparkShadow.value) {
        delete newExtra.openai_long_context_billing_enabled
      } else {
        newExtra.openai_long_context_billing_enabled = openAILongContextBillingEnabled.value
      }
      if (openAICompactMode.value === 'auto') {
        delete newExtra.openai_compact_mode
      } else {
        newExtra.openai_compact_mode = openAICompactMode.value
      }
		if (props.account.type === 'apikey') {
        if (!openAITextGenerationCapabilityEnabled.value || openAIResponsesMode.value === 'auto') {
          delete newExtra.openai_responses_mode
        } else {
          newExtra.openai_responses_mode = openAIResponsesMode.value
        }
		}
		if (autoPause5hThreshold.value != null && autoPause5hThreshold.value > 0) {
			newExtra.auto_pause_5h_threshold = autoPause5hThreshold.value / 100
		} else {
			delete newExtra.auto_pause_5h_threshold
		}
		if (autoPause7dThreshold.value != null && autoPause7dThreshold.value > 0) {
			newExtra.auto_pause_7d_threshold = autoPause7dThreshold.value / 100
		} else {
			delete newExtra.auto_pause_7d_threshold
		}
		if (autoPause5hDisabled.value) {
			newExtra.auto_pause_5h_disabled = true
		} else {
			delete newExtra.auto_pause_5h_disabled
		}
		if (autoPause7dDisabled.value) {
			newExtra.auto_pause_7d_disabled = true
		} else {
			delete newExtra.auto_pause_7d_disabled
		}

		delete newExtra.codex_image_generation_bridge_enabled
      switch (codexImageToolMode.value) {
        case 'enabled':
        case 'disabled':
          newExtra.codex_image_generation_bridge = codexImageToolMode.value === 'enabled'
          delete newExtra.codex_image_generation_explicit_tool_policy
          break
        case 'block':
          newExtra.codex_image_generation_explicit_tool_policy = 'strip'
          delete newExtra.codex_image_generation_bridge
          break
        default:
          delete newExtra.codex_image_generation_bridge
          delete newExtra.codex_image_generation_explicit_tool_policy
      }

      if (props.account.type === 'oauth' || props.account.type === 'setup-token') {
        if (codexCLIOnlyEnabled.value) {
          newExtra.codex_cli_only = true
        } else if (hadCodexCLIOnlyEnabled) {
          // 关闭时显式写 false，避免 extra 为空被后端忽略导致旧值无法清除
          newExtra.codex_cli_only = false
        } else {
          delete newExtra.codex_cli_only
        }
        // Claude Code 插件放行已迁移到全局 codex_cli_only_whitelist，编辑时清理废弃账号级快捷字段。
        delete newExtra.codex_cli_only_allowed_clients
        if (codexCLIOnlyEnabled.value && codexCLIOnlyAppServerEnabled.value) {
          newExtra.codex_cli_only_allow_app_server = true
        } else {
          delete newExtra.codex_cli_only_allow_app_server
        }
      }

      // 指纹收敛模式：默认 session，不写入；非默认值显式写入（包括 off）
      if (props.account.type === 'oauth') {
        if (codexFingerprintMode.value !== 'session') {
          newExtra.codex_fingerprint_mode = codexFingerprintMode.value
        } else {
          delete newExtra.codex_fingerprint_mode
        }
      }

      updatePayload.extra = newExtra
    }

    // For apikey/bedrock accounts, handle quota_limit in extra
    if (props.account.type === 'apikey' || props.account.type === 'bedrock') {
      const currentExtra = (updatePayload.extra as Record<string, unknown>) ||
        (props.account.extra as Record<string, unknown>) || {}
      const newExtra: Record<string, unknown> = { ...currentExtra }
      // 上游倍率自动探测对全部 API-key 平台开放（sub2api 上游即可应答），
      // Bedrock 凭证无静态 Key 不参与。
      if (props.account.type === 'apikey') {
        delete newExtra.upstream_billing_probe_enabled
        delete newExtra.upstream_billing_rate_sync_enabled
      }
      // Total quota
      if (editQuotaLimit.value != null && editQuotaLimit.value > 0) {
        newExtra.quota_limit = editQuotaLimit.value
      } else {
        delete newExtra.quota_limit
      }
      // Daily quota
      if (editQuotaDailyLimit.value != null && editQuotaDailyLimit.value > 0) {
        newExtra.quota_daily_limit = editQuotaDailyLimit.value
      } else {
        delete newExtra.quota_daily_limit
        delete newExtra.quota_daily_used
        delete newExtra.quota_daily_start
      }
      // Weekly quota
      if (editQuotaWeeklyLimit.value != null && editQuotaWeeklyLimit.value > 0) {
        newExtra.quota_weekly_limit = editQuotaWeeklyLimit.value
      } else {
        delete newExtra.quota_weekly_limit
        delete newExtra.quota_weekly_used
        delete newExtra.quota_weekly_start
      }
      // Quota reset mode config
      if (editDailyResetMode.value === 'fixed') {
        newExtra.quota_daily_reset_mode = 'fixed'
        newExtra.quota_daily_reset_hour = editDailyResetHour.value ?? 0
      } else {
        delete newExtra.quota_daily_reset_mode
        delete newExtra.quota_daily_reset_hour
      }
      if (editWeeklyResetMode.value === 'fixed') {
        newExtra.quota_weekly_reset_mode = 'fixed'
        newExtra.quota_weekly_reset_day = editWeeklyResetDay.value ?? 1
        newExtra.quota_weekly_reset_hour = editWeeklyResetHour.value ?? 0
      } else {
        delete newExtra.quota_weekly_reset_mode
        delete newExtra.quota_weekly_reset_day
        delete newExtra.quota_weekly_reset_hour
      }
      if (editDailyResetMode.value === 'fixed' || editWeeklyResetMode.value === 'fixed') {
        newExtra.quota_reset_timezone = editResetTimezone.value || 'UTC'
      } else {
        delete newExtra.quota_reset_timezone
      }
      // Quota notify config
      writeQuotaNotifyToExtra(newExtra, 'update')
      updatePayload.extra = newExtra
    }

    const canContinue = await ensureAntigravityMixedChannelConfirmed(async () => {
      await submitUpdateAccount(accountID, updatePayload)
    })
    if (!canContinue) {
      return
    }

    await submitUpdateAccount(accountID, updatePayload)
  } catch (error: any) {
    appStore.showError(error.message || t('admin.accounts.failedToUpdate'))
  }
}

// Handle mixed channel warning confirmation
const handleMixedChannelConfirm = async () => {
  if (submitting.value) return
  const action = mixedChannelWarningAction.value
  if (!action) {
    clearMixedChannelDialog()
    return
  }
  clearMixedChannelDialog()
  submitting.value = true
  try {
    await action()
  } finally {
    submitting.value = false
  }
}

const handleMixedChannelCancel = () => {
  clearMixedChannelDialog()
}
</script>
