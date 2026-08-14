<template><div class="ui-data-table" role="region" tabindex="0" :aria-label="ariaLabel"><DataTable v-bind="$attrs" :columns="columns" :data="data" :loading="loading" :mobile-table="mobileTable"><template v-for="(_,name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope||{}"/></template></DataTable></div></template>
<script setup lang="ts">
import DataTable from '@/components/common/DataTable.vue';
import type { Column } from '@/components/common/types';
defineOptions({inheritAttrs:false})
withDefaults(defineProps<{columns:Column[];data:Record<string,unknown>[];loading?:boolean;mobileTable?:boolean;ariaLabel?:string}>(),{loading:false,mobileTable:true,ariaLabel:'数据表格，可横向滚动'})
</script>
<style scoped>.ui-data-table{overflow-x:auto;
background:var(--ui-surface)}.ui-data-table :deep(.table-wrapper){border:0!important;
border-radius:0!important}.ui-data-table :deep(thead){background:var(--ui-surface-muted)!important}.ui-data-table :deep(tbody){background:var(--ui-surface)!important}.ui-data-table :deep(th){color:var(--ui-text-soft)!important;
letter-spacing:0!important;font-size:12px!important;font-weight:500!important}.ui-data-table :deep(td){color:var(--ui-text)!important;font-size:13px!important;
font-variant-numeric:tabular-nums}</style>
