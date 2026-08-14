<template><div class="ui-date-range"><DateRangePicker :start-date="startDate" :end-date="endDate" @update:start-date="emit('update:startDate',$event)" @update:end-date="emit('update:endDate',$event)" @change="emit('change',$event)" /></div></template>
<script setup lang="ts">

import DateRangePicker from '@/components/common/DateRangePicker.vue';
defineProps<{startDate:string;
endDate:string}>();
const emit=defineEmits<{ 'update:startDate':[string];
'update:endDate':[string];
change:[{startDate:string;
endDate:string;
preset:string|null}]}>()

</script>
<style scoped>.ui-date-range :deep(button),.ui-date-range :deep(input){border-color:var(--ui-border)!important;
border-radius:var(--ui-radius)!important;
color:var(--ui-text)!important;
background:var(--ui-surface)!important}</style>
