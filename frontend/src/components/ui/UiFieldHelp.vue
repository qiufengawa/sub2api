<template><HelpTooltip :content="content" :trigger="trigger" :width-class="widthClass"><template #trigger><button type="button" class="ui-field-help ui-focus-ring" :aria-label="content"><Icon name="questionCircle" size="xs" /></button></template><slot /></HelpTooltip></template>
<script setup lang="ts">

import HelpTooltip from '@/components/common/HelpTooltip.vue';
import Icon from '@/components/icons/Icon.vue';
withDefaults(defineProps<{content?:string;
trigger?:'hover'|'click';
widthClass?:string}>(),{content:'',trigger:'hover',widthClass:'w-64'})

</script>
<style scoped>.ui-field-help{display:inline-grid;
width:16px;
height:16px;
place-items:center;
padding:0;
border:0;
border-radius:50%;
color:var(--ui-text-soft);
background:transparent;
cursor:help}.ui-field-help:hover{color:var(--ui-text)}</style>
