<template>
  <AppPage width="wide">
    <AppPageHeader title="Qiu UI 组件系统" description="用于统一检查常用组件的形态、密度、状态、动效与响应式行为。此页面不进入正式菜单。">
      <template #status><UiBadge label="96 components" /></template>
      <template #actions><UiSwitch v-model="dark" label="切换深色模式"/><UiButton density="compact" @click="toggleTheme">{{ dark ? '浅色' : '深色' }}</UiButton></template>
    </AppPageHeader>

    <AppSection title="操作与链接" description="主要动作只保留一个黑色主按钮，其余使用白色边框或安静按钮。" divided>
      <AppInline><UiButton variant="primary">保存设置</UiButton><UiButton>取消</UiButton><UiButton variant="quiet">查看详情</UiButton><UiButton variant="danger">删除</UiButton><UiButton loading>处理中</UiButton><UiIconButton label="刷新"><Icon name="refresh" size="sm"/></UiIconButton><UiLink href="https://example.com" external>外部文档</UiLink></AppInline>
    </AppSection>

    <AppSection title="表单控件" description="标签、帮助、错误和控件遵循相同的纵向节奏。" divided>
      <AppGrid min="260px">
        <UiTextField v-model="form.name" label="项目名称" placeholder="输入名称" help="用于控制台内识别项目" />
        <UiPasswordField v-model="form.password" label="密码" rules="至少 6 个字符" placeholder="输入密码" />
        <UiSelect v-model="form.group" label="分组" :options="choices" />
        <UiCombobox v-model="form.model" label="模型" :options="choices" clearable />
        <UiNumberStepper v-model="form.priority" label="调用优先度" description="数字越大，优先级越高" />
        <UiDateInput v-model="form.date" label="日期" />
      </AppGrid>
      <AppStack :gap="12" class="mt-4"><UiTextArea v-model="form.notes" label="备注" :maxlength="120"/><UiSearchInput v-model="form.search"/><AppInline><UiCheckbox v-model="form.enabled" label="启用功能"/><UiRadioGroup v-model="form.mode" name="mode" label="模式" :options="modeChoices"/><UiSegmentedControl v-model="form.view" label="视图" :options="viewChoices"/></AppInline><UiFileUpload label="导入配置" accept="application/json" accept-text="支持 JSON 文件" @select="selectedFiles=$event"/><small v-if="selectedFiles.length">{{ selectedFiles[0]?.name }}</small></AppStack>
    </AppSection>

    <AppSection title="状态与进度" description="语义色只用于状态，不用于大面积装饰。" divided>
      <AppGrid min="200px"><UiStatMetric label="今日请求" value="12,845" context="截至当前时间"><template #status><UiMetricTrend :value="8.2" period="较昨日"/></template></UiStatMetric><UiStatMetric label="实际成本" value="428.60" unit="CNY"/><UiProgressBar label="CPU" :value="43"/><UiProgressBar label="内存" :value="78" tone="warning"/><UiProgressRing :value="96" label="健康度"/></AppGrid>
      <AppStack :gap="8" class="mt-4"><AppInline><UiStatusBadge status="healthy" label="服务正常"/><UiStatusBadge status="pending" label="等待处理"/><UiStatusBadge status="failed" label="请求失败"/><UiConnectionStatus status="live"/></AppInline><UiAlert tone="info" title="计费提示" message="订阅额度会按所选分组的实际倍率扣除。"/><UiAlert tone="warning" message="部分渠道正在进行维护。"/></AppStack>
    </AppSection>

    <AppSection title="导航与信息展开" divided>
      <UiTabs v-model="activeTab" label="组件分类" :tabs="tabs"/>
      <AppInline class="mt-4"><UiBreadcrumb :items="breadcrumbs"/><UiContextMenu :items="menuItems"/><UiTooltip content="这是一条不会改变布局高度的说明"><UiButton density="dense">悬浮查看</UiButton></UiTooltip></AppInline>
      <UiAccordion class="mt-4" :items="accordion" :default-open="['usage']"/>
    </AppSection>

    <AppSection title="数据展示" description="移动端仍保持表格并允许横向滚动。" divided>
      <UiTableToolbar><UiSearchInput v-model="form.tableSearch"/><template #actions><UiColumnPicker v-model="visibleColumns" :columns="columnChoices"/><UiButton variant="primary" density="compact">新增账号</UiButton></template></UiTableToolbar>
      <UiMobileTableScroller min-width="640px"><UiDataTable :columns="columns" :data="rows"><template #cell-name="{row}"><UiDataCell :value="row.name" :meta="row.provider"/></template><template #cell-status="{row}"><UiStatusBadge :status="row.status" :label="row.status==='healthy'?'正常':'异常'"/></template></UiDataTable></UiMobileTableScroller>
      <UiPagination v-model:page="page" v-model:page-size="pageSize" :total="48" :show-page-size-selector="false"/>
    </AppSection>

    <AppSection title="弹层与覆盖层" description="弹层只承载独立任务或详情，不用于包装普通页面区域。">
      <AppInline><UiButton @click="dialog=true">标准弹窗</UiButton><UiButton @click="drawer=true">详情抽屉</UiButton><UiButton @click="sheet=true">移动 Sheet</UiButton><UiButton @click="confirm=true">确认操作</UiButton><UiButton @click="fullscreen=true">全屏工具</UiButton></AppInline>
    </AppSection>

    <UiDialog :show="dialog" title="编辑配置" @close="dialog=false"><UiTextField v-model="form.name" label="名称"/><template #footer><AppInline justify="flex-end"><UiButton @click="dialog=false">取消</UiButton><UiButton variant="primary" @click="dialog=false">保存</UiButton></AppInline></template></UiDialog>
    <UiDrawer :show="drawer" title="账号详情" @close="drawer=false"><UiDescriptionList :items="facts"/></UiDrawer>
    <UiSheet :show="sheet" title="筛选条件" @close="sheet=false"><UiFilterBar><UiTextField v-model="form.search" label="关键词"/></UiFilterBar></UiSheet>
    <UiConfirmDialog :show="confirm" title="删除记录" message="此操作不可撤销。" danger @confirm="confirm=false" @cancel="confirm=false"/>
    <UiFullscreenPanel :show="fullscreen" title="监控详情" @close="fullscreen=false"><UiEmptyState title="全屏工具区域" description="图表、监控和操练场可复用该结构。"/></UiFullscreenPanel>
  </AppPage>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import type { Column } from '@/components/common/types'
import {
  AppGrid, AppInline, AppPage, AppPageHeader, AppSection, AppStack, UiAccordion,
  UiAlert, UiBadge, UiBreadcrumb, UiButton, UiCheckbox, UiColumnPicker, UiCombobox,
  UiConfirmDialog, UiConnectionStatus, UiContextMenu, UiDataCell, UiDataTable, UiDateInput,
  UiDescriptionList, UiDialog, UiDrawer, UiEmptyState, UiFileUpload, UiFilterBar,
  UiFullscreenPanel, UiIconButton, UiLink, UiMetricTrend, UiMobileTableScroller,
  UiNumberStepper, UiPagination, UiPasswordField, UiProgressBar, UiProgressRing,
  UiRadioGroup, UiSearchInput, UiSegmentedControl, UiSelect, UiSheet, UiStatMetric,
  UiStatusBadge, UiSwitch, UiTableToolbar, UiTabs, UiTextArea, UiTextField, UiTooltip
} from '@/components/ui'

const dark = ref(document.documentElement.classList.contains('dark'))
function toggleTheme() { dark.value = !dark.value }
watch(dark, value => document.documentElement.classList.toggle('dark', value))
const form = reactive({ name:'生产环境', password:'', group:'standard', model:'standard', priority:10, date:new Date().toISOString().slice(0,10), notes:'', search:'', tableSearch:'', enabled:true, mode:'auto', view:'list' })
const choices = [{value:'standard',label:'标准分组'},{value:'priority',label:'优先分组'}]
const modeChoices = [{value:'auto',label:'自动'},{value:'manual',label:'手动'}]
const viewChoices = [{value:'list',label:'列表'},{value:'chart',label:'图表'}]
const selectedFiles = ref<File[]>([])
const activeTab = ref('all')
const tabs = [{value:'all',label:'全部',count:96},{value:'form',label:'表单',count:30},{value:'data',label:'数据',count:20}]
const breadcrumbs = [{label:'后台',to:'/admin/dashboard'},{label:'组件系统'}]
const menuItems = [{key:'edit',label:'编辑',icon:'edit' as const},{key:'delete',label:'删除',icon:'trash' as const,danger:true}]
const accordion = [{key:'usage',title:'什么时候使用表格？',content:'当用户需要扫描、排序或比较多条同构数据时使用表格。'},{key:'card',title:'什么时候使用卡片？',content:'仅用于独立重复项目或真正需要边界的工具。'}]
const visibleColumns = ref(['name','priority','status'])
const columnChoices = [{key:'name',label:'账号',required:true},{key:'priority',label:'优先度'},{key:'status',label:'状态'}]
const columns:Column[] = [{key:'name',label:'账号'},{key:'priority',label:'优先度',sortable:true},{key:'status',label:'状态'}]
const rows = [{id:1,name:'OpenAI 主账号',provider:'OpenAI',priority:20,status:'healthy'},{id:2,name:'Claude 备用账号',provider:'Anthropic',priority:10,status:'failed'}]
const page=ref(1),pageSize=ref(20)
const dialog=ref(false),drawer=ref(false),sheet=ref(false),confirm=ref(false),fullscreen=ref(false)
const facts=[{label:'账号名称',value:'OpenAI 主账号'},{label:'调用优先度',value:20,numeric:true},{label:'服务状态',value:'正常'}]
</script>

<style scoped>.mt-4{margin-top:16px}</style>
