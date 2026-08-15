<template>
  <UiDialog :show="show" :title="t('admin.users.groupConfig')" width="wide" @close="$emit('close')">
    <div v-if="user" class="user-groups">
      <header class="user-groups__header">
        <strong>{{ user.email }}</strong>
        <p>{{ t('admin.users.groupConfigHint', { email: user.email }) }}</p>
      </header>

      <div v-if="loading" class="user-groups__loading" aria-live="polite">
        <UiSkeleton v-for="index in 4" :key="index" height="64px" />
      </div>
      <UiErrorState
        v-else-if="loadError"
        :title="t('admin.users.failedToLoadGroups')"
        :retry-text="t('common.retry')"
        @retry="load"
      />
      <template v-else>
        <section v-if="exclusiveGroupConfigs.length" class="user-groups__section">
          <div class="user-groups__section-heading">
            <h3>{{ t('admin.users.exclusiveGroups') }}</h3>
            <span>{{ exclusiveGroupConfigs.filter((config) => config.isSelected).length }}/{{ exclusiveGroupConfigs.length }}</span>
          </div>
          <div class="user-groups__list">
            <article v-for="config in exclusiveGroupConfigs" :key="config.groupId" class="user-groups__row">
              <div class="user-groups__identity">
                <UiCheckbox
                  :model-value="config.isSelected"
                  :label="config.groupName"
                  @update:model-value="toggleExclusiveGroup(config.groupId)"
                />
                <UiBadge>{{ t('admin.groups.exclusive') }}</UiBadge>
                <span><PlatformIcon :platform="config.platform" size="xs" />{{ config.platform }}</span>
                <span>{{ t('admin.users.defaultRate') }}: {{ config.defaultRate }}x</span>
              </div>
              <UiTextField
                :id="`group-rate-${config.groupId}`"
                :model-value="config.customRate ?? ''"
                type="number"
                inputmode="decimal"
                step="0.001"
                min="0.001"
                density="compact"
                :label="t('admin.users.customRate')"
                :placeholder="String(config.defaultRate)"
                @update:model-value="updateCustomRate(config.groupId, $event)"
              />
            </article>
          </div>
        </section>

        <section v-if="publicGroupConfigs.length" class="user-groups__section">
          <div class="user-groups__section-heading">
            <h3>{{ t('admin.users.publicGroups') }}</h3>
            <span>{{ publicGroupConfigs.length }}</span>
          </div>
          <div class="user-groups__list">
            <article v-for="config in publicGroupConfigs" :key="config.groupId" class="user-groups__row">
              <div class="user-groups__identity">
                <UiCheckbox :model-value="true" :label="config.groupName" disabled />
                <UiBadge tone="success">{{ t('admin.users.publicGroups') }}</UiBadge>
                <span><PlatformIcon :platform="config.platform" size="xs" />{{ config.platform }}</span>
                <span>{{ t('admin.users.defaultRate') }}: {{ config.defaultRate }}x</span>
              </div>
              <UiTextField
                :id="`group-rate-${config.groupId}`"
                :model-value="config.customRate ?? ''"
                type="number"
                inputmode="decimal"
                step="0.001"
                min="0.001"
                density="compact"
                :label="t('admin.users.customRate')"
                :placeholder="String(config.defaultRate)"
                @update:model-value="updateCustomRate(config.groupId, $event)"
              />
            </article>
          </div>
        </section>

        <UiEmptyState v-if="groups.length === 0" :title="t('common.noGroupsAvailable')" />
      </template>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton @click="$emit('close')">{{ t('common.cancel') }}</UiButton>
        <UiButton @click="handleSave" :disabled="submitting || loading || !!loadError || !loaded" :loading="submitting" variant="primary">{{ submitting ? t('common.saving') : t('common.save') }}</UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser, Group, GroupPlatform } from '@/types'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import {
  UiBadge,
  UiButton,
  UiCheckbox,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiTextField,
} from '@/components/ui'

interface GroupRateConfig {
  groupId: number
  groupName: string
  platform: GroupPlatform
  isExclusive: boolean
  defaultRate: number
  customRate: number | null
  isSelected: boolean
}

const props = defineProps<{ show: boolean; user: AdminUser | null }>()
const emit = defineEmits(['close', 'success'])
const { t } = useI18n()
const appStore = useAppStore()

const groups = ref<Group[]>([])
const groupConfigs = ref<GroupRateConfig[]>([])
const originalGroupRates = ref<Record<number, number>>({}) // 记录原始专属倍率，用于检测删除
const hiddenAllowedGroupIds = ref<number[]>([])
const loading = ref(false)
const submitting = ref(false)
const loaded = ref(false)
const loadError = ref<unknown>(null)
let loadSequence = 0

const exclusiveGroupConfigs = computed(() => groupConfigs.value.filter((c) => c.isExclusive))
const publicGroupConfigs = computed(() => groupConfigs.value.filter((c) => !c.isExclusive))

watch(
  [() => props.show, () => props.user?.id],
  ([show, userId]) => {
    if (show && userId) {
      load()
    } else if (!show) {
      loadSequence += 1
    }
  },
  { immediate: true },
)

async function load() {
  const userId = props.user?.id
  if (!userId) return
  const sequence = ++loadSequence
  groups.value = []
  groupConfigs.value = []
  originalGroupRates.value = {}
  hiddenAllowedGroupIds.value = []
  loaded.value = false
  loadError.value = null
  loading.value = true
  try {
    const [res, freshUser] = await Promise.all([
      adminAPI.groups.list(1, 1000),
      adminAPI.users.getById(userId),
    ])
    if (sequence !== loadSequence || props.user?.id !== userId || !props.show) return
    // 只显示标准类型且活跃的分组
    groups.value = res.items.filter((g) => g.subscription_type === 'standard' && g.status === 'active')

    // 初始化配置
    const userAllowedGroups = freshUser.allowed_groups || []
    const userGroupRates = freshUser.group_rates || {}
    const visibleGroupIds = new Set(groups.value.map((group) => group.id))
    hiddenAllowedGroupIds.value = userAllowedGroups.filter((groupId) => !visibleGroupIds.has(groupId))

    // 保存原始专属倍率，用于检测删除操作
    originalGroupRates.value = { ...userGroupRates }

    groupConfigs.value = groups.value.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      platform: g.platform,
      isExclusive: g.is_exclusive,
      defaultRate: g.rate_multiplier,
      customRate: userGroupRates[g.id] ?? null,
      // 专属分组：检查是否在 allowed_groups 中
      // 公开分组：始终选中
      isSelected: g.is_exclusive ? userAllowedGroups.includes(g.id) : true,
    }))
    loaded.value = true
  } catch (error) {
    if (sequence !== loadSequence) return
    loadError.value = error
    appStore.showError(t('admin.users.failedToLoadGroups'))
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

const toggleExclusiveGroup = (groupId: number) => {
  const config = groupConfigs.value.find((c) => c.groupId === groupId)
  if (config && config.isExclusive) {
    config.isSelected = !config.isSelected
  }
}

const updateCustomRate = (groupId: number, value: string) => {
  const config = groupConfigs.value.find((c) => c.groupId === groupId)
  if (config) {
    if (value === '' || value === null || value === undefined) {
      config.customRate = null
    } else {
      const numValue = parseFloat(value)
      config.customRate = isNaN(numValue) ? null : numValue
    }
  }
}

const handleSave = async () => {
  if (!props.user || !loaded.value || loadError.value || loading.value || submitting.value) return
  submitting.value = true

  try {
    // 构建 allowed_groups（仅包含专属分组中被勾选的）
    const allowedGroups = [
      ...hiddenAllowedGroupIds.value,
      ...groupConfigs.value.filter((c) => c.isExclusive && c.isSelected).map((c) => c.groupId),
    ]

    // 构建 group_rates
    // - 有新专属倍率: 设置为该值
    // - 原本有专属倍率但现在被清空: 设置为 null（表示删除）
    const groupRates: Record<number, number | null> = {}
    for (const c of groupConfigs.value) {
      const hadOriginalRate = originalGroupRates.value[c.groupId] !== undefined

      if (c.customRate !== null) {
        // 有专属倍率
        groupRates[c.groupId] = c.customRate
      } else if (hadOriginalRate) {
        // 原本有专属倍率，现在被清空，需要显式删除
        groupRates[c.groupId] = null
      }
    }

    await adminAPI.users.update(props.user.id, {
      allowed_groups: allowedGroups,
      group_rates: Object.keys(groupRates).length > 0 ? groupRates : undefined,
    })

    appStore.showSuccess(t('admin.users.groupConfigUpdated'))
    emit('success')
    emit('close')
  } catch (error) {
    console.error('Failed to update user group config:', error)
    appStore.showError(t('admin.users.failedToUpdateAllowedGroups'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.user-groups{display:grid;gap:24px}.user-groups__header{display:grid;gap:4px;padding-bottom:16px;border-bottom:1px solid var(--ui-border-soft)}.user-groups__header strong{font-size:14px;font-weight:600;line-height:22px}.user-groups__header p{margin:0;color:var(--ui-text-muted);font-size:12px;line-height:19px}.user-groups__loading{display:grid;gap:8px}.user-groups__section{display:grid;gap:8px}.user-groups__section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.user-groups__section-heading h3{margin:0;font-size:13px;font-weight:600;line-height:22px}.user-groups__section-heading span{color:var(--ui-text-soft);font-size:12px;font-variant-numeric:tabular-nums}.user-groups__list{border-block:1px solid var(--ui-border-soft)}.user-groups__row{display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:16px;align-items:center;padding:12px 0}.user-groups__row+.user-groups__row{border-top:1px solid var(--ui-border-soft)}.user-groups__identity{display:flex;min-width:0;flex-wrap:wrap;align-items:center;gap:6px 10px}.user-groups__identity>span:not(.ui-badge){display:inline-flex;align-items:center;gap:4px;color:var(--ui-text-muted);font-size:12px}.user-groups__row :deep(.ui-form-field){min-width:0}@media(max-width:640px){.user-groups__row{grid-template-columns:1fr}.user-groups__row :deep(.ui-form-field){max-width:220px}}
</style>
