<template>
  <section class="group-models-list">
    <header class="group-models-list__header">
      <div>
        <h4>{{ t('admin.groups.modelsList.title') }}</h4>
        <p>{{ t('admin.groups.modelsList.hint') }}</p>
      </div>
      <UiSwitch
        :model-value="state.enabled"
        :label="t('admin.groups.modelsList.title')"
        @update:model-value="setEnabled"
      />
    </header>

    <div v-if="state.enabled" class="group-models-list__workspace">
      <div v-if="!loading && state.items.length" class="group-models-list__toolbar">
        <span>
          {{ t('admin.groups.modelsList.selectedSummary', {
            selected: selectedCount,
            total: state.items.length
          }) }}
        </span>
        <div>
          <UiButton density="dense" variant="quiet" @click="selectAll">
            {{ t('admin.groups.modelsList.selectAll') }}
          </UiButton>
          <UiButton density="dense" variant="quiet" @click="invertSelection">
            {{ t('admin.groups.modelsList.invertSelection') }}
          </UiButton>
        </div>
      </div>

      <div v-if="loading" class="group-models-list__state">
        <UiSpinner size="sm" :label="t('admin.groups.modelsList.loading')" />
        <span>{{ t('admin.groups.modelsList.loading') }}</span>
      </div>
      <p v-else-if="!state.items.length" class="group-models-list__state">
        {{ t('admin.groups.modelsList.empty') }}
      </p>
      <div v-else class="group-models-list__rows">
        <div v-for="(item, index) in state.items" :key="item.id" class="group-models-list__row">
          <UiCheckbox
            :model-value="item.selected"
            :label="item.id"
            @update:model-value="setSelected(item.id, $event)"
          >
            <code>{{ item.id }}</code>
          </UiCheckbox>
          <div class="group-models-list__actions">
            <UiIconButton
              :label="t('admin.groups.modelsList.moveUp')"
              icon="arrowUp"
              variant="ghost"
              density="dense"
              :disabled="index === 0"
              @click="moveItem(index, index - 1)"
            />
            <UiIconButton
              :label="t('admin.groups.modelsList.moveDown')"
              icon="arrowDown"
              variant="ghost"
              density="dense"
              :disabled="index === state.items.length - 1"
              @click="moveItem(index, index + 1)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  UiButton,
  UiCheckbox,
  UiIconButton,
  UiSpinner,
  UiSwitch
} from '@/components/ui'
import {
  invertModelsListSelection,
  moveModelsListItem,
  selectAllModelsListItems,
  type ModelsListState
} from '@/views/admin/groupsModelsList'

const props = defineProps<{
  state: ModelsListState
  loading?: boolean
}>()
const emit = defineEmits<{ 'update:state': [ModelsListState] }>()

const { t } = useI18n()
const selectedCount = computed(() => props.state.items.filter(item => item.selected).length)

const cloneState = (): ModelsListState => ({
  enabled: props.state.enabled,
  savedModels: [...props.state.savedModels],
  items: props.state.items.map(item => ({ ...item }))
})

const setEnabled = (enabled: boolean) => {
  emit('update:state', { ...cloneState(), enabled })
}

const setSelected = (modelID: string, selected: boolean) => {
  const next = cloneState()
  const item = next.items.find(candidate => candidate.id === modelID)
  if (item) item.selected = selected
  emit('update:state', next)
}

const selectAll = () => {
  const next = cloneState()
  selectAllModelsListItems(next)
  emit('update:state', next)
}

const invertSelection = () => {
  const next = cloneState()
  invertModelsListSelection(next)
  emit('update:state', next)
}

const moveItem = (fromIndex: number, toIndex: number) => {
  const next = cloneState()
  moveModelsListItem(next, fromIndex, toIndex)
  emit('update:state', next)
}
</script>

<style scoped>
.group-models-list{padding-top:16px;border-top:1px solid var(--ui-border-soft)}
.group-models-list__header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.group-models-list__header h4{margin:0;color:var(--ui-text);font-size:13px;font-weight:600;line-height:22px}
.group-models-list__header p{margin:2px 0 0;color:var(--ui-text-muted);font-size:12px;line-height:18px}
.group-models-list__workspace{margin-top:12px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);overflow:hidden}
.group-models-list__toolbar{display:flex;min-height:36px;align-items:center;justify-content:space-between;gap:12px;padding:3px 8px;border-bottom:1px solid var(--ui-border-soft);color:var(--ui-text-muted);background:var(--ui-surface-muted);font-size:12px}
.group-models-list__toolbar>div{display:flex;gap:2px}
.group-models-list__state{display:flex;min-height:72px;align-items:center;justify-content:center;gap:8px;margin:0;color:var(--ui-text-muted);font-size:12px}
.group-models-list__rows{max-height:256px;overflow:auto}
.group-models-list__row{display:flex;min-height:36px;align-items:center;justify-content:space-between;gap:12px;padding:2px 6px 2px 10px;border-bottom:1px solid var(--ui-border-soft)}
.group-models-list__row:last-child{border-bottom:0}
.group-models-list__row code{overflow-wrap:anywhere;font-family:var(--ui-font-mono);font-size:12px}
.group-models-list__actions{display:flex;flex:none;gap:2px}
@media(max-width:640px){.group-models-list__toolbar{align-items:flex-start;flex-direction:column;padding:6px 8px}.group-models-list__toolbar>div{width:100%;justify-content:flex-end}}
</style>
