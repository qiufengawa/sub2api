<script setup lang="ts">
interface Props {
  fullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fullscreen: false
})
</script>

<template>
  <div class="space-y-4 lg:space-y-5">
    <div :class="['overflow-hidden rounded-[4px] border border-gray-200 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-800', props.fullscreen ? 'p-6' : 'p-4 sm:p-5']">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-dark-700">
        <div class="h-3 w-64 max-w-full animate-pulse rounded bg-gray-100 dark:bg-dark-700"></div>
        <div v-if="!props.fullscreen" class="flex flex-wrap gap-2">
          <div v-for="i in 6" :key="i" class="h-8 w-24 animate-pulse rounded-[4px] bg-gray-100 dark:bg-dark-700"></div>
        </div>
      </div>
      <div v-if="!props.fullscreen" class="mt-3 h-12 animate-pulse border-l-[3px] border-l-gray-200 bg-gray-50 dark:border-l-dark-600 dark:bg-dark-900/30"></div>
      <div class="mt-3 grid grid-cols-1 border-y border-gray-100 lg:grid-cols-[200px_minmax(0,1fr)] dark:border-dark-700">
        <div class="min-h-[250px] border-b border-gray-100 p-4 lg:min-h-[352px] lg:border-b-0 lg:border-r dark:border-dark-700">
          <div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-gray-100 dark:bg-dark-700/70"></div>
          <div class="mx-auto mt-4 h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-dark-700/70"></div>
        </div>
        <div class="grid min-h-[352px] grid-cols-1 md:grid-cols-[minmax(230px,1fr)_minmax(0,2.15fr)]">
          <div class="min-h-48 animate-pulse border-b border-gray-100 bg-gray-50/70 p-4 md:border-b-0 md:border-r dark:border-dark-700 dark:bg-dark-900/30"></div>
          <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div v-for="i in 5" :key="i" class="min-h-24 animate-pulse border-b border-gray-100 bg-gray-50/40 p-4 md:min-h-0 dark:border-dark-700 dark:bg-dark-900/20"></div>
          </div>
        </div>
      </div>
      <div class="mt-3 h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-dark-700"></div>
      <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <div v-for="i in 6" :key="i" class="h-[108px] animate-pulse rounded-[4px] border border-gray-200 bg-gray-50/60 p-3 dark:border-dark-700 dark:bg-dark-900/30"></div>
      </div>
    </div>

    <div class="space-y-3">
      <div class="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-dark-700"></div>
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div class="grid gap-4 xl:col-span-7 xl:grid-rows-[minmax(340px,1fr)_190px]">
          <div class="min-h-[340px] animate-pulse rounded-[4px] border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800"></div>
          <div class="h-[190px] animate-pulse rounded-[4px] border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800"></div>
        </div>
        <div class="min-h-[420px] animate-pulse rounded-[4px] border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800 xl:col-span-5 xl:min-h-[546px]"></div>
      </div>
    </div>

    <div class="space-y-3">
      <div class="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-dark-700"></div>
      <div class="grid grid-cols-1 gap-4 xl:h-[456px] xl:grid-cols-12">
        <div class="min-h-[360px] min-w-0 animate-pulse rounded-[4px] border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800 xl:col-span-7 xl:h-[456px] xl:min-h-0"></div>
        <div class="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-5 xl:h-[456px] xl:grid-cols-1 xl:grid-rows-2">
          <div v-for="i in 2" :key="i" class="min-h-[220px] min-w-0 animate-pulse rounded-[4px] border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800 xl:min-h-0"></div>
        </div>
      </div>
    </div>

    <div data-testid="ops-skeleton-alerts" class="overflow-hidden rounded-[4px] border border-gray-200 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-800">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-4 dark:border-dark-700">
        <div class="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-dark-700"></div>
        <div class="h-8 w-72 max-w-full animate-pulse rounded-[4px] bg-gray-100 dark:bg-dark-700"></div>
      </div>
      <div v-for="i in 4" :key="i" class="h-11 animate-pulse border-b border-gray-100 bg-gray-50/40 last:border-b-0 dark:border-dark-700 dark:bg-dark-900/20"></div>
    </div>

    <div data-testid="ops-skeleton-tokens" class="overflow-hidden rounded-[4px] border border-gray-200 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-800">
      <div class="flex items-center justify-between border-b border-gray-100 p-4 dark:border-dark-700">
        <div class="h-4 w-44 animate-pulse rounded bg-gray-200 dark:bg-dark-700"></div>
        <div class="h-8 w-28 animate-pulse rounded-[4px] bg-gray-100 dark:bg-dark-700"></div>
      </div>
      <div v-for="i in 5" :key="i" class="h-11 animate-pulse border-b border-gray-100 bg-gray-50/40 last:border-b-0 dark:border-dark-700 dark:bg-dark-900/20"></div>
    </div>

    <div data-testid="ops-skeleton-logs" class="overflow-hidden rounded-[4px] border border-gray-200 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-800">
      <div class="grid grid-cols-2 gap-px border-b border-gray-100 bg-gray-100 sm:grid-cols-5 dark:border-dark-700 dark:bg-dark-700">
        <div v-for="i in 5" :key="i" class="h-14 animate-pulse bg-white p-3 dark:bg-dark-800"></div>
      </div>
      <div class="border-b border-gray-100 p-4 dark:border-dark-700">
        <div class="h-9 w-full animate-pulse rounded-[4px] bg-gray-100 dark:bg-dark-700/70"></div>
      </div>
      <div v-for="i in 7" :key="i" class="h-11 animate-pulse border-b border-gray-100 bg-gray-50/40 last:border-b-0 dark:border-dark-700 dark:bg-dark-900/20"></div>
    </div>
  </div>
</template>
