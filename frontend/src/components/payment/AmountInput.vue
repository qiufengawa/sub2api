<template>
  <div class="amount-input">
    <fieldset class="amount-input__presets">
      <legend>{{ t('payment.quickAmounts') }}</legend>
      <div class="amount-input__grid">
        <UiButton
          v-for="amt in filteredAmounts"
          :key="amt"
          :variant="modelValue === amt ? 'primary' : 'secondary'"
          density="compact"
          class="amount-input__preset"
          :aria-pressed="modelValue === amt"
          @click="selectAmount(amt)"
        >
          {{ amt }}
        </UiButton>
      </div>
    </fieldset>

    <UiTextField
      :model-value="customText"
      :label="t('payment.customAmount')"
      :placeholder="placeholderText"
      inputmode="decimal"
      density="compact"
      monospace
      @update:model-value="handleTextInput"
    >
      <template #prefix>$</template>
    </UiTextField>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiButton, UiTextField } from '@/components/ui'

const props = withDefaults(defineProps<{
  amounts?: number[]
  modelValue: number | null
  min?: number
  max?: number
}>(), {
  amounts: () => [10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
  min: 0,
  max: 0,
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const { t } = useI18n()

const customText = ref('')

// 0 = no limit
const filteredAmounts = computed(() =>
  props.amounts.filter((a) => (props.min <= 0 || a >= props.min) && (props.max <= 0 || a <= props.max))
)

const placeholderText = computed(() => {
  if (props.min > 0 && props.max > 0) return `${props.min} - ${props.max}`
  if (props.min > 0) return `≥ ${props.min}`
  if (props.max > 0) return `≤ ${props.max}`
  return t('payment.enterAmount')
})

const AMOUNT_PATTERN = /^\d*(\.\d{0,2})?$/

function selectAmount(amt: number) {
  customText.value = String(amt)
  emit('update:modelValue', amt)
}

function handleTextInput(value: string | number | null) {
  const val = String(value ?? '')
  if (!AMOUNT_PATTERN.test(val)) return
  customText.value = val
  if (val === '') {
    emit('update:modelValue', null)
    return
  }
  const num = parseFloat(val)
  if (!isNaN(num) && num > 0) {
    emit('update:modelValue', num)
  } else {
    emit('update:modelValue', null)
  }
}

watch(() => props.modelValue, (v) => {
  if (v !== null && String(v) !== customText.value) {
    customText.value = String(v)
  }
}, { immediate: true })
</script>

<style scoped>
.amount-input { display:flex; min-width:0; flex-direction:column; gap:16px; }
.amount-input__presets { min-width:0; margin:0; padding:0; border:0; }
.amount-input__presets legend { margin:0 0 8px; color:var(--ui-text); font-size:12px; font-weight:500; }
.amount-input__grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.amount-input__preset { width:100%; font-variant-numeric:tabular-nums; }
</style>
