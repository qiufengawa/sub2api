<template>
  <main class="setup-page">
    <section class="setup-shell">
      <header class="setup-header">
        <Icon name="cog" size="md" />
        <div>
          <h1>{{ t('setup.title') }}</h1>
          <p>{{ t('setup.description') }}</p>
        </div>
      </header>

      <!-- Progress Steps -->
      <UiSteps :steps="steps" :current="currentStep" :aria-label="t('setup.title')" />

      <!-- Step Content -->
      <section class="setup-workspace">
        <!-- Step 1: Database -->
        <div v-if="currentStep === 0" class="setup-step">
          <header class="setup-step__header">
            <h2>
              {{ t('setup.database.title') }}
            </h2>
            <p>
              {{ t('setup.database.description') }}
            </p>
          </header>

          <div class="setup-form-grid">
              <UiTextField
                id="setup-database-host"
                v-model="formData.database.host"
                type="text"
                :label="t('setup.database.host')"
                density="compact"
                placeholder="localhost"
              />
              <UiTextField
                id="setup-database-port"
                :model-value="formData.database.port"
                type="number"
                :label="t('setup.database.port')"
                density="compact"
                placeholder="5432"
                @update:model-value="updateDatabasePort"
              />
          </div>

          <div class="setup-form-grid">
              <UiTextField
                id="setup-database-user"
                v-model="formData.database.user"
                type="text"
                :label="t('setup.database.username')"
                density="compact"
                placeholder="postgres"
              />
              <UiTextField
                id="setup-database-password"
                v-model="formData.database.password"
                type="password"
                :label="t('setup.database.password')"
                density="compact"
                :placeholder="t('setup.database.passwordPlaceholder')"
              />
          </div>

          <div class="setup-form-grid">
              <UiTextField
                id="setup-database-name"
                v-model="formData.database.dbname"
                type="text"
                :label="t('setup.database.databaseName')"
                density="compact"
                placeholder="sub2api"
              />
              <UiSelect
                id="setup-database-ssl"
                v-model="formData.database.sslmode"
                :label="t('setup.database.sslMode')"
                density="compact"
                :options="[
                  { value: 'disable', label: t('setup.database.ssl.disable') },
                  { value: 'require', label: t('setup.database.ssl.require') },
                  { value: 'verify-ca', label: t('setup.database.ssl.verifyCa') },
                  { value: 'verify-full', label: t('setup.database.ssl.verifyFull') }
                ]"
              />
          </div>

          <UiButton
            type="button"
            :disabled="testingDb"
            :loading="testingDb"
            variant="secondary"
            density="compact"
            block
            @click="testDatabaseConnection"
          >
            <template v-if="dbConnected && !testingDb" #icon><Icon name="check" size="sm" class="setup-status--success" /></template>
            {{
              testingDb
                ? t('setup.status.testing')
                : dbConnected
                  ? t('setup.status.success')
                  : t('setup.status.testConnection')
            }}
          </UiButton>
        </div>

        <!-- Step 2: Redis -->
        <div v-if="currentStep === 1" class="setup-step">
          <header class="setup-step__header">
            <h2>
              {{ t('setup.redis.title') }}
            </h2>
            <p>
              {{ t('setup.redis.description') }}
            </p>
          </header>

          <div class="setup-form-grid">
              <UiTextField
                id="setup-redis-host"
                v-model="formData.redis.host"
                type="text"
                :label="t('setup.redis.host')"
                density="compact"
                placeholder="localhost"
              />
              <UiTextField
                id="setup-redis-port"
                :model-value="formData.redis.port"
                type="number"
                :label="t('setup.redis.port')"
                density="compact"
                placeholder="6379"
                @update:model-value="updateRedisPort"
              />
          </div>

          <div class="setup-form-grid">
              <UiTextField
                id="setup-redis-user"
                v-model="formData.redis.username"
                type="text"
                :label="t('setup.redis.username')"
                density="compact"
                :placeholder="t('setup.redis.usernamePlaceholder')"
              />
              <UiTextField
                id="setup-redis-password"
                v-model="formData.redis.password"
                type="password"
                :label="t('setup.redis.password')"
                density="compact"
                :placeholder="t('setup.redis.passwordPlaceholder')"
              />
              <UiTextField
                id="setup-redis-database"
                :model-value="formData.redis.db"
                type="number"
                :label="t('setup.redis.database')"
                density="compact"
                placeholder="0"
                @update:model-value="updateRedisDatabase"
              />
          </div>

          <div class="setup-setting-row">
            <div>
              <strong>
                {{ t("setup.redis.enableTls") }}
              </strong>
              <p>
                {{ t("setup.redis.enableTlsHint") }}
              </p>
            </div>
            <UiSwitch
              v-model="formData.redis.enable_tls"
              :label="t('setup.redis.enableTls')"
            />
          </div>

          <UiButton
            type="button"
            :disabled="testingRedis"
            :loading="testingRedis"
            variant="secondary"
            density="compact"
            block
            @click="testRedisConnection"
          >
            <template v-if="redisConnected && !testingRedis" #icon><Icon name="check" size="sm" class="setup-status--success" /></template>
            {{
              testingRedis
                ? t('setup.status.testing')
                : redisConnected
                  ? t('setup.status.success')
                  : t('setup.status.testConnection')
            }}
          </UiButton>
        </div>

        <!-- Step 3: Admin -->
        <div v-if="currentStep === 2" class="setup-step">
          <header class="setup-step__header">
            <h2>
              {{ t('setup.admin.title') }}
            </h2>
            <p>
              {{ t('setup.admin.description') }}
            </p>
          </header>

          <div class="setup-form-stack">
            <UiTextField
              id="setup-admin-email"
              v-model="formData.admin.email"
              type="email"
              autocomplete="email"
              :label="t('setup.admin.email')"
              density="compact"
              placeholder="admin@example.com"
            />

            <UiTextField
              id="setup-admin-password"
              v-model="formData.admin.password"
              type="password"
              autocomplete="new-password"
              :label="t('setup.admin.password')"
              density="compact"
              :placeholder="t('setup.admin.passwordPlaceholder')"
            />

            <UiTextField
              id="setup-admin-confirm-password"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              :label="t('setup.admin.confirmPassword')"
              density="compact"
              :error="confirmPassword && formData.admin.password !== confirmPassword ? t('setup.admin.passwordMismatch') : undefined"
              :placeholder="t('setup.admin.confirmPasswordPlaceholder')"
            />
          </div>
        </div>

        <!-- Step 4: Complete -->
        <div v-if="currentStep === 3" class="setup-step">
          <UiReviewSummary
            :title="t('setup.ready.title')"
            :description="t('setup.ready.description')"
            :items="reviewItems"
            :valid="canProceed"
          />
        </div>

        <!-- Error Message -->
        <UiAlert v-if="errorMessage" class="setup-feedback" tone="danger" :message="errorMessage" />

        <!-- Success Message -->
        <UiAlert
          v-if="installSuccess"
          class="setup-feedback"
          tone="success"
          :title="t('setup.status.completed')"
          :message="serviceReady ? t('setup.status.redirecting') : t('setup.status.restarting')"
        />

        <!-- Navigation Buttons -->
        <footer class="setup-actions">
          <UiButton
            v-if="currentStep > 0 && !installSuccess"
            type="button"
            variant="secondary"
            density="compact"
            class="setup-actions__back"
            @click="currentStep--"
          >
            <template #icon><Icon name="chevronLeft" size="sm" /></template>
            {{ t('common.back') }}
          </UiButton>

          <UiButton
            v-if="currentStep < 3"
            type="button"
            :disabled="!canProceed"
            variant="primary"
            density="compact"
            @click="nextStep"
          >
            {{ t('common.next') }}
          </UiButton>

          <UiButton
            v-else-if="!installSuccess"
            type="button"
            :disabled="installing"
            :loading="installing"
            variant="primary"
            density="compact"
            @click="performInstall"
          >
            {{ installing ? t('setup.status.installing') : t('setup.status.completeInstallation') }}
          </UiButton>
        </footer>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { testDatabase, testRedis, install, type InstallRequest } from '@/api/setup'
import { buildGatewayUrl } from '@/api/client'
import Icon from '@/components/icons/Icon.vue'
import {
  UiAlert,
  UiButton,
  UiReviewSummary,
  UiSelect,
  UiSteps,
  UiSwitch,
  UiTextField
} from '@/components/ui'

const { t } = useI18n()

const steps = computed(() => [
  { key: 'database', label: t('setup.database.title') },
  { key: 'redis', label: t('setup.redis.title') },
  { key: 'admin', label: t('setup.admin.title') },
  { key: 'complete', label: t('setup.ready.title') }
])

const currentStep = ref(0)
const errorMessage = ref('')
const installSuccess = ref(false)

// Connection test states
const testingDb = ref(false)
const testingRedis = ref(false)
const dbConnected = ref(false)
const redisConnected = ref(false)
const installing = ref(false)
const confirmPassword = ref('')
const serviceReady = ref(false)

// Default server port
const getCurrentPort = (): number => {
  const port = window.location.port
  if (port) {
    return parseInt(port, 10)
  }

  return window.location.protocol === 'https:' ? 443 : 80
}

const formData = reactive<InstallRequest>({
  database: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    dbname: 'sub2api',
    sslmode: 'disable'
  },
  redis: {
    host: 'localhost',
    port: 6379,
    username: '',
    password: '',
    db: 0,
    enable_tls: false
  },
  admin: {
    email: '',
    password: ''
  },
  server: {
    host: '0.0.0.0',
    port: getCurrentPort(), // Use current port from browser
    mode: 'release'
  }
})

const reviewItems = computed(() => [
  {
    label: t('setup.ready.database'),
    value: `${formData.database.user}@${formData.database.host}:${formData.database.port}/${formData.database.dbname}`
  },
  {
    label: t('setup.ready.redis'),
    value: `${formData.redis.host}:${formData.redis.port}`
  },
  {
    label: t('setup.ready.adminEmail'),
    value: formData.admin.email
  }
])

function parseNumericInput(value: string, current: number, min: number, max: number): number {
  if (!value.trim()) return current
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return current
  return parsed
}

function updateDatabasePort(value: string): void {
  formData.database.port = parseNumericInput(value, formData.database.port, 1, 65535)
}

function updateRedisPort(value: string): void {
  formData.redis.port = parseNumericInput(value, formData.redis.port, 1, 65535)
}

function updateRedisDatabase(value: string): void {
  formData.redis.db = parseNumericInput(value, formData.redis.db, 0, 15)
}

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0:
      return dbConnected.value
    case 1:
      return redisConnected.value
    case 2:
      return (
        Boolean(formData.admin.email) &&
        formData.admin.password.length >= 8 &&
        formData.admin.password === confirmPassword.value
      )
    default:
      return true
  }
})

async function testDatabaseConnection() {
  testingDb.value = true
  errorMessage.value = ''
  dbConnected.value = false

  try {
    await testDatabase(formData.database)
    dbConnected.value = true
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string }
    errorMessage.value =
      err.response?.data?.detail || err.response?.data?.message || err.message || 'Connection failed'
  } finally {
    testingDb.value = false
  }
}

async function testRedisConnection() {
  testingRedis.value = true
  errorMessage.value = ''
  redisConnected.value = false

  try {
    await testRedis(formData.redis)
    redisConnected.value = true
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string }
    errorMessage.value =
      err.response?.data?.detail || err.response?.data?.message || err.message || 'Connection failed'
  } finally {
    testingRedis.value = false
  }
}

function nextStep() {
  if (canProceed.value) {
    errorMessage.value = ''
    currentStep.value++
  }
}

async function performInstall() {
  installing.value = true
  errorMessage.value = ''

  try {
    await install(formData)
    installSuccess.value = true
    // Start polling for service restart
    waitForServiceRestart()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string }
    errorMessage.value =
      err.response?.data?.detail || err.response?.data?.message || err.message || 'Installation failed'
  } finally {
    installing.value = false
  }
}

// Wait for service to restart and become available
async function waitForServiceRestart() {
  const maxAttempts = 60 // Increase to 60 attempts, ~60 seconds max
  const interval = 1000 // 1 second between attempts

  // Wait a moment for the service to start restarting
  await new Promise((resolve) => setTimeout(resolve, 3000))

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Use setup status endpoint as it tells us the real mode
      // Service might return 404 or connection refused while restarting
      const response = await fetch(buildGatewayUrl('/setup/status'), {
        method: 'GET',
        cache: 'no-store'
      })

      if (response.ok) {
        const data = await response.json()
        // If needs_setup is false, service has restarted in normal mode
        if (data.data && !data.data.needs_setup) {
          serviceReady.value = true
          // Redirect to login page after a short delay
          setTimeout(() => {
            window.location.href = '/login'
          }, 1500)
          return
        }
      }
    } catch {
      // Service not ready or network error during restart, continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  // If we reach here, service didn't restart in time
  // Show a message to refresh manually
  errorMessage.value = t('setup.status.timeout')
}
</script>

<style scoped>
.setup-page {
  min-height: 100svh;
  padding: 48px 24px;
  color: var(--ui-text);
  background: var(--ui-bg);
}

.setup-shell {
  display: grid;
  width: min(760px, 100%);
  margin: 0 auto;
  gap: 24px;
}

.setup-header {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}

.setup-header h1,
.setup-header p,
.setup-step__header h2,
.setup-step__header p {
  margin: 0;
}

.setup-header h1 { font-size: 24px; font-weight: 600; line-height: 32px; }
.setup-header p { margin-top: 3px; color: var(--ui-text-muted); font-size: 13px; line-height: 20px; }

.setup-workspace {
  padding: 24px;
  border: 1px solid var(--ui-border-warm);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-surface);
}

.setup-step { display: grid; gap: 20px; }
.setup-step__header { padding-bottom: 14px; border-bottom: 1px solid var(--ui-border-soft); }
.setup-step__header h2 { font-size: 18px; font-weight: 600; line-height: 26px; }
.setup-step__header p { margin-top: 3px; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.setup-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.setup-form-stack { display: grid; gap: 14px; }
.setup-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-block: 1px solid var(--ui-border-soft); }
.setup-setting-row strong { display: block; font-size: 13px; line-height: 20px; }
.setup-setting-row p { margin: 2px 0 0; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.setup-status--success { color: var(--ui-success); }
.setup-feedback { margin-top: 20px; }
.setup-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--ui-border-soft); }
.setup-actions__back { margin-right: auto; }

@media (max-width: 640px) {
  .setup-page { padding: 24px 16px; }
  .setup-workspace { padding: 18px 16px; }
  .setup-form-grid { grid-template-columns: 1fr; }
}
</style>
