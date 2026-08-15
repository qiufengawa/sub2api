<template>
  <div class="ui-pagination">
    <span class="ui-pagination__summary">
      <span v-if="summaryLabel">{{ summaryLabel }} </span>{{ from }}-{{ to }} / {{ total }}
    </span>
    <label v-if="showPageSizeSelector" class="ui-pagination__size">
      <span>{{ pageSizeLabel }}</span>
      <select :value="pageSize" :aria-label="pageSizeLabel" @change="changePageSize">
        <option v-for="size in normalizedOptions" :key="size" :value="size">{{ size }}</option>
      </select>
    </label>
    <nav aria-label="分页">
      <button type="button" :disabled="page <= 1" :aria-label="previousLabel" @click="go(page - 1)"><Icon name="chevronLeft" size="sm" /></button>
      <button
        v-for="(item, index) in visiblePages"
        :key="`${item}-${index}`"
        type="button"
        :disabled="typeof item !== 'number'"
        :aria-current="item === page ? 'page' : undefined"
        :class="{ 'is-current': item === page }"
        @click="typeof item === 'number' && go(item)"
      >{{ item }}</button>
      <button type="button" :disabled="page >= totalPages" :aria-label="nextLabel" @click="go(page + 1)"><Icon name="chevronRight" size="sm" /></button>
    </nav>
    <form v-if="showJump" class="ui-pagination__jump" @submit.prevent="submitJump">
      <span>{{ jumpLabel }}</span><input v-model="jump" type="number" min="1" :max="totalPages" :aria-label="jumpLabel"><button type="submit">{{ jumpActionLabel }}</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/icons/Icon.vue'

const props = withDefaults(defineProps<{
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  showPageSizeSelector?: boolean
  showJump?: boolean
  resetPageOnPageSizeChange?: boolean
  summaryLabel?: string
  pageSizeLabel?: string
  previousLabel?: string
  nextLabel?: string
  jumpLabel?: string
  jumpActionLabel?: string
}>(), {
  pageSizeOptions: () => [10, 20, 50, 100],
  showPageSizeSelector: true,
  showJump: false,
  resetPageOnPageSizeChange: true,
  summaryLabel: '',
  pageSizeLabel: '每页',
  previousLabel: '上一页',
  nextLabel: '下一页',
  jumpLabel: '跳至',
  jumpActionLabel: '确定'
})
const emit = defineEmits<{ 'update:page': [number]; 'update:pageSize': [number] }>()
const jump = ref('')
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => props.total ? (props.page - 1) * props.pageSize + 1 : 0)
const to = computed(() => Math.min(props.total, props.page * props.pageSize))
const normalizedOptions = computed(() => [...new Set([...props.pageSizeOptions, props.pageSize])].sort((a, b) => a - b))
const visiblePages = computed<(number | string)[]>(() => {
  const total = totalPages.value
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const start = Math.max(2, props.page - 1)
  const end = Math.min(total - 1, props.page + 1)
  const values: (number | string)[] = [1]
  if (start > 2) values.push('…')
  for (let value = start; value <= end; value += 1) values.push(value)
  if (end < total - 1) values.push('…')
  values.push(total)
  return values
})
function go(value: number) { if (value >= 1 && value <= totalPages.value && value !== props.page) emit('update:page', value) }
function changePageSize(event: Event) {
  emit('update:pageSize', Number((event.target as HTMLSelectElement).value))
  if (props.resetPageOnPageSizeChange) emit('update:page', 1)
}
function submitJump() { go(Number(jump.value)); jump.value = '' }
</script>

<style scoped>
.ui-pagination{display:flex;min-height:44px;align-items:center;justify-content:flex-end;gap:12px;padding:8px 0;color:var(--ui-text-muted);font-size:12px;line-height:18px}.ui-pagination__summary{margin-right:auto;font-variant-numeric:tabular-nums}.ui-pagination nav{display:inline-flex}.ui-pagination button,.ui-pagination select,.ui-pagination input{height:28px;border:1px solid var(--ui-border);color:var(--ui-text);background:var(--ui-surface);font:inherit}.ui-pagination button{min-width:28px;margin-left:-1px;padding:0 7px}.ui-pagination nav button:first-child{margin-left:0;border-radius:var(--ui-radius-dense) 0 0 var(--ui-radius-dense)}.ui-pagination nav button:last-child{border-radius:0 var(--ui-radius-dense) var(--ui-radius-dense) 0}.ui-pagination button:hover:not(:disabled){z-index:1;background:var(--ui-surface-muted)}.ui-pagination button.is-current{z-index:2;border-color:var(--ui-text);color:var(--ui-text);background:var(--ui-surface-strong);font-weight:500}.ui-pagination button:disabled{cursor:not-allowed;color:var(--ui-text-soft)}.ui-pagination__size,.ui-pagination__jump{display:flex;align-items:center;gap:6px}.ui-pagination select{min-width:58px;border-radius:var(--ui-radius-dense);padding:0 6px}.ui-pagination input{width:54px;border-radius:var(--ui-radius-dense);padding:0 7px}.ui-pagination__jump button{margin:0;border-radius:var(--ui-radius-dense)}@media(max-width:640px){.ui-pagination{justify-content:space-between;overflow-x:auto}.ui-pagination__summary,.ui-pagination__size,.ui-pagination__jump{display:none}.ui-pagination nav{margin:auto}}
</style>
