<template><UiDropdownMenu :items="items" placement="bottom-end" @select="emit('select',$event)"><template #trigger><UiIconButton :label="label" density="dense"><Icon name="more" size="sm"/></UiIconButton></template></UiDropdownMenu></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
import UiIconButton from './UiIconButton.vue';
import UiDropdownMenu,{type UiMenuItem} from './UiDropdownMenu.vue';
withDefaults(defineProps<{items:UiMenuItem[];
label?:string}>(),{label:'更多操作'});
const emit=defineEmits<{select:[UiMenuItem]}>()
</script>
