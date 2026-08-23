<template>
  <div class="ui-table-scroller" tabindex="0" role="region" :aria-label="label">
    <div class="ui-table-scroller__content" :style="{ minWidth }"><slot /></div>
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{label?:string;
minWidth?:string}>(),{label:'可横向滚动的数据表',minWidth:'720px'})
</script>
<style scoped>
.ui-table-scroller{
  width:100%;
  min-width:0;
  max-width:100%;
  overflow-x:auto;
  overscroll-behavior-x:contain;
  touch-action:pan-x;
  -webkit-overflow-scrolling:touch;
}

/*
 * Keep one horizontal scroll owner. UiDataTable and its core table wrapper
 * also expose overflow-x:auto; when they are allowed to shrink to the
 * viewport, a narrow screen can stop at an intermediate column because the
 * outer scroller only sees the wrapper's min-width. The max-content track
 * lets the outer region measure the complete table and exposes every column.
 */
.ui-table-scroller__content{
  display:inline-block;
  width:max-content;
  min-width:100%;
}
.ui-table-scroller__content :deep(.ui-data-table),
.ui-table-scroller__content :deep(.table-wrapper){
  width:max-content;
  min-width:100%;
  overflow-x:visible;
}

.ui-table-scroller__content :deep(table){
  width:max-content;
  min-width:100%;
}

.ui-table-scroller:focus-visible{
  outline:2px solid color-mix(in srgb,var(--ui-focus) 20%,transparent);
  outline-offset:2px;
}
</style>
