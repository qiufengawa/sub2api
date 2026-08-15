# R7 管理员支付概览验收记录

## 范围

- 页面：`frontend/src/views/admin/orders/AdminPaymentDashboardView.vue`
- 领域组件：`OrderStatsCards.vue`、`DailyRevenueChart.vue`
- 本批次只重写前端视觉、模板和共享组件组合，不修改后端、API、支付统计口径或货币数据契约。
- 旧 Tailwind 卡片、旧原生日期按钮、旧刷新按钮、旧加载图标和旧排名色块已删除。

## 新结构

```text
AppLayout
└── AppPage
    ├── AppPageHeader
    │   ├── UiSegmentedControl
    │   └── UiIconButton
    ├── UiSkeleton（首次加载）
    ├── AppGrid
    │   └── UiStatMetric × 4
    ├── UiChartFrame
    │   └── DailyRevenueChart
    └── 两列数据区
        ├── 支付方式分布（UiBadge / UiEmptyState）
        └── 用户排行（UiBadge / UiEmptyState）
```

## 行为保护

- 首次进入仍请求 30 天统计，日期范围继续支持 7、30、90 天。
- 日期切换与手动刷新继续复用 `adminPaymentAPI.getDashboard(days)`。
- 加载失败继续通过 `extractI18nErrorMessage` 和全局通知反馈。
- 支付金额、订单数、支付方式和用户排行数据契约不变。
- 多货币数据按币种排序并逐行展示，避免窄容器横向溢出且不丢失币种。
- 日期标签改为响应式计算，运行时语言切换后可同步更新。
- 图表继续保留金额轴、订单数轴、货币数据集和悬浮联动。

## 自动化验证

```text
pnpm exec vitest run src/views/admin/orders/__tests__/AdminPaymentDashboardView.spec.ts
  1 file passed
  4 tests passed

pnpm run test:run
  275 files passed
  1900 tests passed

pnpm run typecheck
  passed

pnpm run lint:check
  passed

pnpm run build
  passed

git diff --check
  passed
```

覆盖的关键场景：默认 30 天请求、日期范围切换、错误通知、多货币完整展示。

## 浏览器验收

- 当前 Edge 扩展对 `localhost`、`127.0.0.1` 和局域网开发地址的访问被客户端拦截，本批次未生成浏览器截图。
- 待可访问本地开发服务后补验 1440px、900px、390px 三个视口以及 dark mode、reduced motion 和键盘焦点。
