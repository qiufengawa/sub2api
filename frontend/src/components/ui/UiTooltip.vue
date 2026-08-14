<template><HelpTooltip :content="content" :trigger="trigger" :width-class="widthClass"><template #trigger><slot/></template></HelpTooltip></template>
<script setup lang="ts">
import HelpTooltip from '@/components/common/HelpTooltip.vue';
withDefaults(defineProps<{content:string;
trigger?:'hover'|'click';
widthClass?:string}>(),{trigger:'hover',widthClass:'w-64'})
</script>
