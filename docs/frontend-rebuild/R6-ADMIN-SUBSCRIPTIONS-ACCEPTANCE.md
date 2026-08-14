# R6 管理员订阅页验收记录

## 范围

- 页面：`frontend/src/views/admin/SubscriptionsView.vue`
- 路由：`/admin/subscriptions`
- 本批次只重写前端视觉、模板和共享组件组合，不修改后端、API、订阅状态机或计费语义。
- 旧 `TablePageLayout`、旧 `DataTable`、旧手写下拉、旧原生行操作按钮、旧配额条、旧状态徽章和自绘指南弹窗已删除。

## 新结构

```text
AppLayout
└── AppPage
    ├── AppPageHeader
    └── UiServerTableWorkspace
        ├── UiTableToolbar
        │   ├── UiAsyncEntityPicker
        │   ├── UiSelect
        │   ├── UiSegmentedControl
        │   ├── UiColumnPicker
        │   └── UiButton / UiIconButton
        ├── UiSelect（高级筛选）
        ├── UiDataTable
        │   ├── UiAvatar / UiBadge
        │   ├── UiProgressBar
        │   ├── UiStatusBadge
        │   └── UiIconButton
        └── UiPagination
```

分配、调整、撤销、恢复、重置和指南均使用 `UiDialog` / `UiConfirmDialog`；指南正文使用 `UiDescriptionList`、`UiAlert`、`UiLink`。

## 行为保护

- 初始筛选仍为 `status=active`，服务端排序仍为 `created_at desc`。
- 筛选、排序、页码、页大小和用户选择仍重置/加载正确的服务端请求。
- 用户搜索仍使用 300ms 防抖；搜索结果增加 sequence 防护，清除或新查询不会被旧响应覆盖。
- 订阅分配仍携带 `user_id`、`plan_id`、`validity_days`。
- 调整仍允许正负天数，并保留未来到期校验。
- 撤销、恢复、重置配额的状态矩阵和确认流程不变。
- 配额显示继续计算 `usage + reserved`，进度封顶 100%，70%/90% 使用共享语义色，零/空额度显示 unlimited。
- `subscription-user-column-mode`、`subscription-hidden-columns` 和历史 `group -> plan` 兼容保留。
- 组件卸载时取消活动列表请求和用户搜索定时器。

## 自动化验证

```text
pnpm exec vitest run src/views/admin/__tests__/SubscriptionsView.spec.ts
  1 file passed
  6 tests passed

pnpm exec vue-tsc --noEmit
  passed

pnpm exec eslint src/views/admin/SubscriptionsView.vue src/views/admin/__tests__/SubscriptionsView.spec.ts
  passed

git diff --check
  passed
```

覆盖的关键场景：初始请求参数、列偏好迁移、用户搜索与清除、`usage + reserved`、100% 封顶、状态操作矩阵、服务端排序。

## 浏览器验收待办

- [ ] 1440px：工具栏、表格、操作列和对话框无重叠。
- [ ] 900px：高级筛选和工具栏可换行，表格保持可比较。
- [ ] 390px：表格保持横向滚动，弹窗切换为 sheet，搜索结果不被浏览器键盘遮挡。
- [ ] dark mode、reduced motion、键盘焦点和屏幕阅读器名称。
