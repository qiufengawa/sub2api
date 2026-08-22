<template>
    <AppStack :gap="20" class="backup-settings">
      <AppSection :title="t('admin.backup.s3.title')" :description="`${t('admin.backup.s3.descriptionPrefix')} Cloudflare R2${t('admin.backup.s3.descriptionSuffix')}`">
        <template #actions>
          <UiButton variant="quiet" density="dense" @click="showR2Guide = true">Cloudflare R2</UiButton>
        </template>
        <UiAlert v-if="s3LoadError" tone="danger" :message="t('errors.networkError')">
          <template #default>{{ t('errors.networkError') }} <UiButton variant="quiet" density="dense" @click="loadS3Config">{{ t('common.retry') }}</UiButton></template>
        </UiAlert>
        <AppGrid v-if="loadingS3" class="backup-field-grid" min="260px" :gap="12" aria-live="polite">
          <UiSkeleton v-for="index in 6" :key="index" height="54px" />
        </AppGrid>
        <AppGrid v-else-if="!s3LoadError" class="backup-field-grid" min="260px" :gap="12">
          <UiTextField v-model="s3Form.endpoint" density="compact" :label="t('admin.backup.s3.endpoint')" placeholder="https://<account_id>.r2.cloudflarestorage.com" />
          <UiTextField v-model="s3Form.region" density="compact" :label="t('admin.backup.s3.region')" placeholder="auto" />
          <UiTextField v-model="s3Form.bucket" density="compact" :label="t('admin.backup.s3.bucket')" />
          <UiTextField v-model="s3Form.prefix" density="compact" :label="t('admin.backup.s3.prefix')" placeholder="backups/" />
          <UiTextField v-model="s3Form.access_key_id" density="compact" :label="t('admin.backup.s3.accessKeyId')" monospace />
          <UiPasswordField :model-value="s3Form.secret_access_key || ''" density="compact" :label="t('admin.backup.s3.secretAccessKey')" :placeholder="s3SecretConfigured ? t('admin.backup.s3.secretConfigured') : ''" @update:model-value="s3Form.secret_access_key = $event" />
        </AppGrid>
        <AppInline v-if="!loadingS3 && !s3LoadError" class="backup-switch-row">
          <UiSwitch v-model="s3Form.force_path_style" :label="t('admin.backup.s3.forcePathStyle')" />
          <span>{{ t('admin.backup.s3.forcePathStyle') }}</span>
        </AppInline>
        <AppInline v-if="!loadingS3 && !s3LoadError" class="backup-actions">
          <UiButton density="compact" :loading="testingS3" @click="testS3">{{ t('admin.backup.s3.testConnection') }}</UiButton>
          <UiButton variant="primary" density="compact" :loading="savingS3" @click="saveS3Config">{{ t('common.save') }}</UiButton>
        </AppInline>
      </AppSection>

      <AppSection :title="t('admin.backup.imageStorage.title')" :description="t('admin.backup.imageStorage.description')" divided>
        <UiAlert v-if="imageStorageLoadError" tone="danger" :message="t('errors.networkError')">
          <template #default>{{ t('errors.networkError') }} <UiButton variant="quiet" density="dense" @click="loadImageStorageConfig">{{ t('common.retry') }}</UiButton></template>
        </UiAlert>
        <AppGrid v-if="loadingImageStorage" class="backup-field-grid" min="260px" :gap="12" aria-live="polite">
          <UiSkeleton v-for="index in 6" :key="index" height="54px" />
        </AppGrid>
        <AppInline v-else-if="!imageStorageLoadError" class="backup-switch-row">
          <UiSwitch v-model="imageStorageForm.enabled" :label="t('admin.backup.imageStorage.enabled')" />
          <span>{{ t('admin.backup.imageStorage.enabled') }}</span>
          <UiSwitch v-model="imageStorageForm.reuse_backup_s3" :label="t('admin.backup.imageStorage.reuseBackupS3')" />
          <span>{{ t('admin.backup.imageStorage.reuseBackupS3') }}</span>
        </AppInline>
        <AppGrid v-if="!loadingImageStorage && !imageStorageLoadError" class="backup-field-grid" min="260px" :gap="12">
          <UiTextField v-model="imageStorageForm.bucket" density="compact" :label="t('admin.backup.imageStorage.bucket')" :placeholder="imageStorageForm.reuse_backup_s3 ? t('admin.backup.imageStorage.bucketInherited') : ''" />
          <UiTextField v-model="imageStorageForm.prefix" density="compact" :label="t('admin.backup.imageStorage.prefix')" placeholder="images/" />
          <template v-if="!imageStorageForm.reuse_backup_s3">
            <UiTextField v-model="imageStorageForm.endpoint" density="compact" :label="t('admin.backup.s3.endpoint')" placeholder="https://<account_id>.r2.cloudflarestorage.com" />
            <UiTextField v-model="imageStorageForm.region" density="compact" :label="t('admin.backup.s3.region')" placeholder="auto" />
            <UiTextField v-model="imageStorageForm.access_key_id" density="compact" :label="t('admin.backup.s3.accessKeyId')" monospace />
            <UiPasswordField :model-value="imageStorageForm.secret_access_key || ''" density="compact" :label="t('admin.backup.s3.secretAccessKey')" :placeholder="imageStorageSecretConfigured ? t('admin.backup.s3.secretConfigured') : ''" @update:model-value="imageStorageForm.secret_access_key = $event" />
          </template>
          <UiTextField v-model="imageStorageForm.public_base_url" density="compact" :label="t('admin.backup.imageStorage.publicBaseUrl')" :placeholder="t('admin.backup.imageStorage.publicBaseUrlPlaceholder')" />
          <UiTextField v-model.number="imageStorageForm.presign_expiry_hours" type="number" min="1" density="compact" :label="t('admin.backup.imageStorage.presignExpiryHours')" />
        </AppGrid>
        <AppInline v-if="!loadingImageStorage && !imageStorageLoadError && !imageStorageForm.reuse_backup_s3" class="backup-switch-row">
          <UiSwitch v-model="imageStorageForm.force_path_style" :label="t('admin.backup.s3.forcePathStyle')" />
          <span>{{ t('admin.backup.s3.forcePathStyle') }}</span>
        </AppInline>
        <AppInline v-if="!loadingImageStorage && !imageStorageLoadError" class="backup-actions">
          <UiButton density="compact" :loading="testingImageStorage" @click="testImageStorage">{{ t('admin.backup.s3.testConnection') }}</UiButton>
          <UiButton variant="primary" density="compact" :loading="savingImageStorage" @click="saveImageStorageConfig">{{ t('common.save') }}</UiButton>
        </AppInline>
      </AppSection>

      <AppSection :title="t('admin.backup.schedule.title')" :description="t('admin.backup.schedule.description')" divided>
        <UiAlert v-if="scheduleLoadError" tone="danger" :message="t('errors.networkError')">
          <template #default>{{ t('errors.networkError') }} <UiButton variant="quiet" density="dense" @click="loadSchedule">{{ t('common.retry') }}</UiButton></template>
        </UiAlert>
        <AppGrid v-if="loadingSchedule" class="backup-field-grid" min="260px" :gap="12" aria-live="polite">
          <UiSkeleton v-for="index in 3" :key="index" height="54px" />
        </AppGrid>
        <AppInline v-else-if="!scheduleLoadError" class="backup-switch-row">
          <UiSwitch v-model="scheduleForm.enabled" :label="t('admin.backup.schedule.enabled')" />
          <span>{{ t('admin.backup.schedule.enabled') }}</span>
        </AppInline>
        <AppGrid v-if="!loadingSchedule && !scheduleLoadError" class="backup-field-grid" min="260px" :gap="12">
          <UiTextField v-model="scheduleForm.cron_expr" density="compact" :label="t('admin.backup.schedule.cronExpr')" :description="t('admin.backup.schedule.cronHint')" placeholder="0 2 * * *" monospace />
          <UiTextField v-model.number="scheduleForm.retain_days" type="number" min="0" density="compact" :label="t('admin.backup.schedule.retainDays')" :description="t('admin.backup.schedule.retainDaysHint')" />
          <UiTextField v-model.number="scheduleForm.retain_count" type="number" min="0" density="compact" :label="t('admin.backup.schedule.retainCount')" :description="t('admin.backup.schedule.retainCountHint')" />
        </AppGrid>
        <AppInline v-if="!loadingSchedule && !scheduleLoadError" class="backup-actions">
          <UiButton variant="primary" density="compact" :loading="savingSchedule" @click="saveSchedule">{{ t('common.save') }}</UiButton>
        </AppInline>
      </AppSection>

      <AppSection :title="t('admin.backup.operations.title')" :description="t('admin.backup.operations.description')" divided>
        <template #actions>
          <AppInline>
            <UiTextField v-model.number="manualExpireDays" class="backup-expiry-field" type="number" min="0" density="dense" :label="t('admin.backup.operations.expireDays')" />
            <UiButton variant="primary" density="compact" :loading="creatingBackup" :disabled="loadingBackups" @click="createBackup">{{ t('admin.backup.operations.createBackup') }}</UiButton>
            <UiIconButton icon="refresh" density="compact" :disabled="loadingBackups" :label="t('common.refresh')" @click="loadBackups" />
          </AppInline>
        </template>

        <UiDataTable
          :columns="backupColumns"
          :data="backups"
          :loading="loadingBackups"
          row-key="id"
          mobile-table
          :aria-label="t('admin.backup.operations.title')"
        >
          <template #cell-id="{ row }"><UiDataCell :value="row.id" mono /></template>
          <template #cell-status="{ row }"><UiStatusBadge :status="row.status" :label="backupStatusLabel(row)" /></template>
          <template #cell-file_name="{ row }"><UiDataCell :value="row.file_name || '-'" :meta="row.parts?.length ? `(${row.parts.length})` : undefined" mono /></template>
          <template #cell-size_bytes="{ row }"><span class="ui-numeric">{{ formatSize(row.size_bytes) }}</span></template>
          <template #cell-expires_at="{ row }">{{ row.status === 'running' ? '-' : (row.expires_at ? formatDate(row.expires_at) : t('admin.backup.neverExpire')) }}</template>
          <template #cell-triggered_by="{ row }">{{ row.triggered_by === 'scheduled' ? t('admin.backup.trigger.scheduled') : t('admin.backup.trigger.manual') }}</template>
          <template #cell-started_at="{ row }"><time class="ui-numeric">{{ formatDate(row.started_at) }}</time></template>
          <template #cell-actions="{ row }">
            <AppInline :wrap="false">
              <UiIconButton v-if="row.status === 'completed'" icon="download" variant="ghost" density="dense" :label="t('admin.backup.actions.download')" @click="downloadBackup(row.id)" />
              <UiIconButton v-if="row.status === 'completed'" icon="refresh" variant="ghost" density="dense" :disabled="restoringId === row.id" :label="t('admin.backup.actions.restore')" @click="restoreBackup(row.id)" />
              <UiIconButton v-if="row.status !== 'running'" icon="trash" variant="danger" density="dense" :label="t('common.delete')" @click="removeBackup(row.id)" />
            </AppInline>
          </template>
          <template #empty>
            <UiErrorState v-if="backupsLoadError" :title="t('errors.networkError')" :retry-text="t('common.retry')" @retry="loadBackups" />
            <UiEmptyState v-else :title="t('admin.backup.empty')" />
          </template>
        </UiDataTable>
      </AppSection>
    </AppStack>

    <!-- Cloudflare R2 Setup Guide Modal -->
    <UiDialog
      :show="showR2Guide"
      :title="t('admin.backup.r2Guide.title')"
      width="wide"
      @close="showR2Guide = false"
    >
      <AppStack :gap="16">
        <p>{{ t('admin.backup.r2Guide.intro') }}</p>
        <AppSection :title="t('admin.backup.r2Guide.step1.title')">
          <ol class="backup-guide-list">
            <li>{{ t('admin.backup.r2Guide.step1.line1') }}</li>
            <li>{{ t('admin.backup.r2Guide.step1.line2') }}</li>
            <li>{{ t('admin.backup.r2Guide.step1.line3') }}</li>
          </ol>
        </AppSection>
        <AppSection :title="t('admin.backup.r2Guide.step2.title')">
          <ol class="backup-guide-list">
            <li>{{ t('admin.backup.r2Guide.step2.line1') }}</li>
            <li>{{ t('admin.backup.r2Guide.step2.line2') }}</li>
            <li>{{ t('admin.backup.r2Guide.step2.line3') }}</li>
            <li>{{ t('admin.backup.r2Guide.step2.line4') }}</li>
          </ol>
          <UiAlert tone="warning" :message="t('admin.backup.r2Guide.step2.warning')" />
        </AppSection>
        <AppSection :title="t('admin.backup.r2Guide.step3.title')" :description="t('admin.backup.r2Guide.step3.desc')">
          <UiCodeBlock :code="r2EndpointExample" :label="t('admin.backup.s3.endpoint')" />
        </AppSection>
        <AppSection :title="t('admin.backup.r2Guide.step4.title')">
          <UiDescriptionList :items="r2DescriptionItems" :columns="1" />
        </AppSection>
        <UiAlert tone="info" :message="t('admin.backup.r2Guide.freeTier')" />
      </AppStack>

      <template #footer>
        <AppInline justify="flex-end">
          <UiButton density="compact" @click="showR2Guide = false">{{ t('common.close') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <UiDialog
      :show="Boolean(restoreBackupId)"
      :title="t('admin.backup.actions.restore')"
      width="normal"
      @close="cancelRestoreBackup"
    >
      <AppStack :gap="12">
        <UiAlert tone="warning" :message="t('admin.backup.actions.restoreConfirm')" />
        <UiPasswordField
          v-model="restorePassword"
          density="compact"
          :label="t('admin.backup.actions.restorePasswordPrompt')"
          autocomplete="current-password"
        />
      </AppStack>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton density="compact" :disabled="Boolean(restoringId)" @click="cancelRestoreBackup">{{ t('common.cancel') }}</UiButton>
          <UiButton variant="danger" density="compact" :loading="Boolean(restoringId)" :disabled="!restorePassword" @click="confirmRestoreBackup">{{ t('admin.backup.actions.restore') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <UiConfirmDialog
      :show="Boolean(deleteBackupId)"
      :title="t('common.delete')"
      :message="t('admin.backup.actions.deleteConfirm')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :pending="deletingBackup"
      danger
      @confirm="confirmRemoveBackup"
      @cancel="deleteBackupId = ''"
    />

    <UiDialog
      :show="downloadPartsModalOpen"
      :title="t('admin.backup.actions.downloadParts')"
      width="normal"
      @close="closeDownloadParts"
    >
      <AppStack :gap="12">
        <p>{{ t('admin.backup.actions.downloadPartsHint') }}</p>
        <AppStack :gap="8">
          <AppInline v-for="part in downloadParts" :key="part.index" justify="space-between">
            <UiDataCell :value="t('admin.backup.actions.partLabel', { index: part.index })" :meta="formatSize(part.size_bytes)" />
            <UiLink :href="part.url">{{ t('admin.backup.actions.download') }}</UiLink>
          </AppInline>
        </AppStack>
      </AppStack>
      <template #footer>
        <UiButton density="compact" @click="closeDownloadParts">{{ t('common.close') }}</UiButton>
      </template>
    </UiDialog>
    <TotpStepUpDialog :controller="backupStepUp" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api'
import { useAppStore } from '@/stores'
import type {
  BackupS3Config,
  BackupScheduleConfig,
  BackupRecord,
  BackupDownloadPart,
  ImageStorageConfig,
} from '@/api/admin/backup'
import { useStepUp, isStepUpBlocked, isStepUpCancelled, stepUpBlockReason } from '@/composables/useStepUp'
import TotpStepUpDialog from '@/components/auth/TotpStepUpDialog.vue'
import {
  AppGrid,
  AppInline,
  AppSection,
  AppStack,
  UiAlert,
  UiButton,
  UiCodeBlock,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiIconButton,
  UiLink,
  UiPasswordField,
  UiSkeleton,
  UiStatusBadge,
  UiSwitch,
  UiTextField,
  type Column,
} from '@/components/ui'

const { t } = useI18n()
const appStore = useAppStore()
const backupStepUp = useStepUp()

// 敏感操作被 2FA 门控拦截时的统一提示。
function reportStepUpBlocked(error: unknown): boolean {
  if (!isStepUpBlocked(error)) return false
  appStore.showError(
    stepUpBlockReason(error) === 'STEP_UP_ADMIN_API_KEY_FORBIDDEN'
      ? t('stepUp.adminApiKeyForbidden')
      : t('stepUp.notEnabled')
  )
  return true
}

// S3 config
const s3Form = ref<BackupS3Config>({
  endpoint: '',
  region: 'auto',
  bucket: '',
  access_key_id: '',
  secret_access_key: '',
  prefix: 'backups/',
  force_path_style: false,
})
const s3SecretConfigured = ref(false)
const loadingS3 = ref(true)
const s3LoadError = ref(false)
const savingS3 = ref(false)
const testingS3 = ref(false)

// Async image object storage. Shares the S3 client with backups, so the default is
// to reuse the credentials configured above and only differ by prefix.
const imageStorageForm = ref<ImageStorageConfig>({
  enabled: false,
  reuse_backup_s3: true,
  bucket: '',
  prefix: 'images/',
  public_base_url: '',
  presign_expiry_hours: 24,
  max_download_bytes: 33554432,
  endpoint: '',
  region: 'auto',
  access_key_id: '',
  secret_access_key: '',
  force_path_style: false,
})
const imageStorageSecretConfigured = ref(false)
const loadingImageStorage = ref(true)
const imageStorageLoadError = ref(false)
const savingImageStorage = ref(false)
const testingImageStorage = ref(false)

// Schedule config
const scheduleForm = ref<BackupScheduleConfig>({
  enabled: false,
  cron_expr: '0 2 * * *',
  retain_days: 14,
  retain_count: 10,
})
const savingSchedule = ref(false)
const loadingSchedule = ref(true)
const scheduleLoadError = ref(false)

// Backups
const backups = ref<BackupRecord[]>([])
const loadingBackups = ref(true)
const backupsLoadError = ref(false)
let backupsRequestId = 0
const creatingBackup = ref(false)
const restoringId = ref('')
const restoreBackupId = ref('')
const restorePassword = ref('')
const manualExpireDays = ref(14)
const deleteBackupId = ref('')
const deletingBackup = ref(false)
// Keep the mutation guards at the function boundary as well as on the
// buttons.  A dialog/step-up flow can emit the same action more than once
// before Vue has a chance to update the disabled state.
const downloadingBackupIds = ref(new Set<string>())
const downloadParts = ref<BackupDownloadPart[]>([])
const downloadPartsModalOpen = ref(false)

function closeDownloadParts() {
  downloadPartsModalOpen.value = false
  downloadParts.value = []
}

// Polling
const pollingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const restoringPollingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const pollingGeneration = ref(0)
const restoringPollingGeneration = ref(0)
const MAX_POLL_COUNT = 900

function updateRecordInList(updated: BackupRecord) {
  const idx = backups.value.findIndex(r => r.id === updated.id)
  if (idx >= 0) {
    backups.value[idx] = updated
  }
}

function startPolling(backupId: string) {
  stopPolling()
  const generation = pollingGeneration.value
  let count = 0
  const poll = async () => {
    if (generation !== pollingGeneration.value) return
    if (count++ >= MAX_POLL_COUNT) {
      stopPolling()
      creatingBackup.value = false
      appStore.showWarning(t('admin.backup.operations.backupRunning'))
      return
    }
    try {
      const record = await adminAPI.backup.getBackup(backupId)
      if (generation !== pollingGeneration.value) return
      updateRecordInList(record)
      if (record.status === 'completed' || record.status === 'failed') {
        stopPolling()
        creatingBackup.value = false
        if (record.status === 'completed') {
          appStore.showSuccess(t('admin.backup.operations.backupCreated'))
        } else {
          appStore.showError(record.error_message || t('admin.backup.operations.backupFailed'))
        }
        await loadBackups()
        return
      }
    } catch {
      // 轮询失败时不中断
    }
    if (generation === pollingGeneration.value) {
      pollingTimer.value = setTimeout(poll, 2000)
    }
  }
  pollingTimer.value = setTimeout(poll, 2000)
}

function stopPolling() {
  pollingGeneration.value += 1
  if (pollingTimer.value) {
    clearTimeout(pollingTimer.value)
    pollingTimer.value = null
  }
}

function startRestorePolling(backupId: string) {
  stopRestorePolling()
  const generation = restoringPollingGeneration.value
  let count = 0
  const poll = async () => {
    if (generation !== restoringPollingGeneration.value) return
    if (count++ >= MAX_POLL_COUNT) {
      stopRestorePolling()
      restoringId.value = ''
      appStore.showWarning(t('admin.backup.operations.restoreRunning'))
      return
    }
    try {
      const record = await adminAPI.backup.getBackup(backupId)
      if (generation !== restoringPollingGeneration.value) return
      updateRecordInList(record)
      if (record.restore_status === 'completed' || record.restore_status === 'failed') {
        stopRestorePolling()
        restoringId.value = ''
        if (record.restore_status === 'completed') {
          appStore.showSuccess(t('admin.backup.actions.restoreSuccess'))
        } else {
          appStore.showError(record.restore_error || t('admin.backup.operations.restoreFailed'))
        }
        await loadBackups()
        return
      }
    } catch {
      // 轮询失败时不中断
    }
    if (generation === restoringPollingGeneration.value) {
      restoringPollingTimer.value = setTimeout(poll, 2000)
    }
  }
  restoringPollingTimer.value = setTimeout(poll, 2000)
}

function stopRestorePolling() {
  restoringPollingGeneration.value += 1
  if (restoringPollingTimer.value) {
    clearTimeout(restoringPollingTimer.value)
    restoringPollingTimer.value = null
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopPolling()
    stopRestorePolling()
  } else {
    // 标签页恢复时刷新列表，检查是否仍有活跃操作
    loadBackups().then(loaded => {
      if (!loaded) return
      const running = backups.value.find(r => r.status === 'running')
      creatingBackup.value = Boolean(running)
      if (running) {
        startPolling(running.id)
      }
      const restoring = backups.value.find(r => r.restore_status === 'running')
      restoringId.value = restoring?.id ?? ''
      if (restoring) {
        startRestorePolling(restoring.id)
      }
    })
  }
}

// R2 guide
const showR2Guide = ref(false)
const r2EndpointExample = computed(() => `https://<${t('admin.backup.r2Guide.step3.accountId')}>.r2.cloudflarestorage.com`)
const r2ConfigRows = computed(() => [
  { field: t('admin.backup.s3.endpoint'), value: 'https://<account_id>.r2.cloudflarestorage.com' },
  { field: t('admin.backup.s3.region'), value: 'auto' },
  { field: t('admin.backup.s3.bucket'), value: t('admin.backup.r2Guide.step4.bucketValue') },
  { field: t('admin.backup.s3.prefix'), value: 'backups/' },
  { field: 'Access Key ID', value: t('admin.backup.r2Guide.step4.fromStep2') },
  { field: 'Secret Access Key', value: t('admin.backup.r2Guide.step4.fromStep2') },
  { field: t('admin.backup.s3.forcePathStyle'), value: t('admin.backup.r2Guide.step4.unchecked') },
])
const r2DescriptionItems = computed(() => r2ConfigRows.value.map(row => ({ label: row.field, value: row.value, mono: true })))

const backupColumns = computed<Column[]>(() => [
  { key: 'id', label: 'ID' },
  { key: 'status', label: t('admin.backup.columns.status') },
  { key: 'file_name', label: t('admin.backup.columns.fileName') },
  { key: 'size_bytes', label: t('admin.backup.columns.size') },
  { key: 'expires_at', label: t('admin.backup.columns.expiresAt') },
  { key: 'triggered_by', label: t('admin.backup.columns.triggeredBy') },
  { key: 'started_at', label: t('admin.backup.columns.startedAt') },
  { key: 'actions', label: t('admin.backup.columns.actions') },
])

function backupStatusLabel(record: BackupRecord): string {
  return record.status === 'running' && record.progress
    ? t(`admin.backup.progress.${record.progress}`)
    : t(`admin.backup.status.${record.status}`)
}

async function loadS3Config() {
  loadingS3.value = true
  s3LoadError.value = false
  try {
    const cfg = await adminAPI.backup.getS3Config()
    s3Form.value = {
      endpoint: cfg.endpoint || '',
      region: cfg.region || 'auto',
      bucket: cfg.bucket || '',
      access_key_id: cfg.access_key_id || '',
      secret_access_key: '',
      prefix: cfg.prefix || 'backups/',
      force_path_style: Boolean(cfg.force_path_style),
    }
    s3SecretConfigured.value = Boolean(cfg.access_key_id)
  } catch (error) {
    s3LoadError.value = true
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    loadingS3.value = false
  }
}

async function saveS3Config() {
  if (savingS3.value) return
  savingS3.value = true
  try {
    await backupStepUp.run(() => adminAPI.backup.updateS3Config(s3Form.value))
    appStore.showSuccess(t('admin.backup.s3.saved'))
    await loadS3Config()
  } catch (error) {
    if (isStepUpCancelled(error)) {
      savingS3.value = false
      return
    }
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    savingS3.value = false
  }
}

async function loadImageStorageConfig() {
  loadingImageStorage.value = true
  imageStorageLoadError.value = false
  try {
    const { config, secret_configured } = await adminAPI.backup.getImageStorageConfig()
    imageStorageForm.value = {
      ...config,
      enabled: Boolean(config.enabled),
      reuse_backup_s3: config.reuse_backup_s3 !== false,
      bucket: config.bucket || '',
      prefix: config.prefix || 'images/',
      public_base_url: config.public_base_url || '',
      presign_expiry_hours: config.presign_expiry_hours || 24,
      max_download_bytes: config.max_download_bytes || 33554432,
      endpoint: config.endpoint || '',
      region: config.region || 'auto',
      access_key_id: config.access_key_id || '',
      secret_access_key: '',
      force_path_style: Boolean(config.force_path_style),
    }
    imageStorageSecretConfigured.value = secret_configured
  } catch (error) {
    imageStorageLoadError.value = true
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    loadingImageStorage.value = false
  }
}

async function saveImageStorageConfig() {
  if (savingImageStorage.value) return
  savingImageStorage.value = true
  try {
    await backupStepUp.run(() => adminAPI.backup.updateImageStorageConfig(imageStorageForm.value))
    appStore.showSuccess(t('admin.backup.imageStorage.saved'))
    await loadImageStorageConfig()
  } catch (error) {
    if (isStepUpCancelled(error)) {
      savingImageStorage.value = false
      return
    }
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    savingImageStorage.value = false
  }
}

async function testImageStorage() {
  if (testingImageStorage.value) return
  testingImageStorage.value = true
  try {
    const result = await adminAPI.backup.testImageStorageConnection(imageStorageForm.value)
    if (result.ok) {
      appStore.showSuccess(result.message || t('admin.backup.s3.testSuccess'))
    } else {
      appStore.showError(result.message || t('admin.backup.s3.testFailed'))
    }
  } catch (error) {
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    testingImageStorage.value = false
  }
}

async function testS3() {
  if (testingS3.value) return
  testingS3.value = true
  try {
    const result = await adminAPI.backup.testS3Connection(s3Form.value)
    if (result.ok) {
      appStore.showSuccess(result.message || t('admin.backup.s3.testSuccess'))
    } else {
      appStore.showError(result.message || t('admin.backup.s3.testFailed'))
    }
  } catch (error) {
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    testingS3.value = false
  }
}

async function loadSchedule() {
  loadingSchedule.value = true
  scheduleLoadError.value = false
  try {
    const cfg = await adminAPI.backup.getSchedule()
    scheduleForm.value = {
      enabled: cfg.enabled,
      cron_expr: cfg.cron_expr || '0 2 * * *',
      retain_days: cfg.retain_days ?? 14,
      retain_count: cfg.retain_count ?? 10,
    }
  } catch (error) {
    scheduleLoadError.value = true
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    loadingSchedule.value = false
  }
}

async function saveSchedule() {
  if (savingSchedule.value) return
  savingSchedule.value = true
  try {
    await adminAPI.backup.updateSchedule(scheduleForm.value)
    appStore.showSuccess(t('admin.backup.schedule.saved'))
  } catch (error) {
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    savingSchedule.value = false
  }
}

async function loadBackups(): Promise<boolean> {
  const requestId = ++backupsRequestId
  loadingBackups.value = true
  backupsLoadError.value = false
  try {
    const result = await adminAPI.backup.listBackups()
    if (requestId !== backupsRequestId) return false
    backups.value = result.items || []
    return true
  } catch (error) {
    if (requestId !== backupsRequestId) return false
    backupsLoadError.value = true
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
    return false
  } finally {
    if (requestId === backupsRequestId) loadingBackups.value = false
  }
}

async function createBackup() {
  if (creatingBackup.value) return
  creatingBackup.value = true
  try {
    const record = await backupStepUp.run(() => adminAPI.backup.createBackup({ expire_days: manualExpireDays.value }))
    // 插入到列表顶部
    backups.value.unshift(record)
    startPolling(record.id)
  } catch (error: any) {
    if (isStepUpCancelled(error)) {
      creatingBackup.value = false
      return
    }
    if (reportStepUpBlocked(error)) {
      creatingBackup.value = false
      return
    }
    if (error?.status === 409 || error?.response?.status === 409) {
      appStore.showWarning(t('admin.backup.operations.alreadyInProgress'))
      const loaded = await loadBackups()
      const running = loaded ? backups.value.find(record => record.status === 'running') : undefined
      if (running) {
        creatingBackup.value = true
        startPolling(running.id)
        return
      }
    } else {
      appStore.showError(error?.message || t('errors.networkError'))
    }
    creatingBackup.value = false
  }
}

async function downloadBackup(id: string) {
  if (downloadingBackupIds.value.has(id)) return
  downloadingBackupIds.value.add(id)
  try {
    const result = await backupStepUp.run(() => adminAPI.backup.getDownloadURL(id))
    if (result.parts?.length) {
      downloadParts.value = result.parts
      downloadPartsModalOpen.value = true
      return
    }
    if (!result.url) {
      throw new Error(t('errors.networkError'))
    }
    // 预签名 URL 带 attachment disposition，同页 anchor 导航直接触发下载；
    // 不用 window.open：step-up 弹窗 await 会耗尽瞬态用户激活，新标签页会被浏览器拦截。
    const link = document.createElement('a')
    link.href = result.url
    link.rel = 'noopener'
    link.click()
  } catch (error) {
    if (isStepUpCancelled(error)) return
    if (reportStepUpBlocked(error)) return
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    const next = new Set(downloadingBackupIds.value)
    next.delete(id)
    downloadingBackupIds.value = next
  }
}

function restoreBackup(id: string) {
  restoreBackupId.value = id
  restorePassword.value = ''
}

function cancelRestoreBackup() {
  if (restoringId.value) return
  restoreBackupId.value = ''
  restorePassword.value = ''
}

async function confirmRestoreBackup() {
  const id = restoreBackupId.value
  const password = restorePassword.value
  if (!id || !password || restoringId.value) return
  restoringId.value = id
  try {
    const record = await backupStepUp.run(() => adminAPI.backup.restoreBackup(id, password))
    updateRecordInList(record)
    restoreBackupId.value = ''
    restorePassword.value = ''
    startRestorePolling(id)
  } catch (error: any) {
    restoringId.value = ''
    if (isStepUpCancelled(error)) return
    if (reportStepUpBlocked(error)) return
    // apiClient 拦截器把 HTTP 错误归一化为顶层 { status } 平面对象（无 response 字段）
    if (error?.status === 409 || error?.response?.status === 409) {
      appStore.showWarning(t('admin.backup.operations.restoreRunning'))
    } else {
      appStore.showError(error?.message || t('errors.networkError'))
    }
  }
}

async function removeBackup(id: string) {
  deleteBackupId.value = id
}

async function confirmRemoveBackup() {
  if (!deleteBackupId.value || deletingBackup.value) return
  deletingBackup.value = true
  try {
    await adminAPI.backup.deleteBackup(deleteBackupId.value)
    appStore.showSuccess(t('admin.backup.actions.deleted'))
    deleteBackupId.value = ''
    await loadBackups()
  } catch (error) {
    appStore.showError((error as { message?: string })?.message || t('errors.networkError'))
  } finally {
    deletingBackup.value = false
  }
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  await Promise.all([loadS3Config(), loadImageStorageConfig(), loadSchedule(), loadBackups()])

  // 如果有正在 running 的备份，恢复轮询
  const runningBackup = backups.value.find(r => r.status === 'running')
  if (runningBackup) {
    creatingBackup.value = true
    startPolling(runningBackup.id)
  }
  const restoringBackup = backups.value.find(r => r.restore_status === 'running')
  if (restoringBackup) {
    restoringId.value = restoringBackup.id
    startRestorePolling(restoringBackup.id)
  }
})

onBeforeUnmount(() => {
  backupsRequestId += 1
  stopPolling()
  stopRestorePolling()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style scoped>
.backup-settings {
  width: 100%;
}

.backup-field-grid,
.backup-switch-row,
.backup-actions {
  margin-top: 12px;
}

.backup-expiry-field {
  width: 132px;
}

.backup-guide-list {
  margin: 0;
  display: grid;
  gap: 6px;
  padding-left: 20px;
}

@media (max-width: 640px) {
  .backup-expiry-field {
    width: 100%;
  }
}
</style>
