# R8 管理员公告页验收记录

## 范围

- 页面：`frontend/src/views/admin/AnnouncementsView.vue`
- 本批次只重写页面壳、筛选栏、表格、分页、状态展示、行操作和公告编辑/确认弹窗。
- 保留公告 targeting 编辑器、CRUD API、服务端排序、分页、搜索防抖、日期序列化、投放条件校验和读状态/预览领域组件。

## 新结构

```text
AppLayout
└── AppPage
    ├── AppPageHeader
    │   └── UiButton（创建）
    └── UiServerTableWorkspace
        ├── UiTableToolbar
        │   ├── UiSearchInput
        │   ├── UiSelect
        │   └── UiIconButton（刷新）
        ├── UiDataTable
        │   ├── UiStatusBadge / UiBadge
        │   └── UiIconButton（预览、读状态、编辑、删除）
        └── UiPagination
```

编辑使用 `UiDialog`、`UiTextField`、`UiTextArea`、`UiSelect` 和 `UiButton`；删除使用 `UiConfirmDialog`。

## 行为保护

- 列表请求仍携带 `status/search/sort_by/sort_order`，并继续使用 `AbortSignal` 防止旧响应覆盖新响应。
- 搜索仍为 300ms 防抖，由 `UiSearchInput` 统一承担；状态、排序、页码和页大小继续回到第一页并重载。
- 创建与更新的时间字段仍区分未设置、清空（`0`）和具体 Unix 秒值。
- targeting 的 `any_of/all_of` 数量上限校验、分组加载条件和读状态/预览事件保持不变。
- 行操作仍映射到预览、阅读状态、编辑和删除四条原有行为链。
- 修复模板重复 `announcement` 属性，避免无效 DOM 属性和编译警告。

## 自动化验证

```text
pnpm exec vitest run src/views/admin/__tests__/AnnouncementsView.spec.ts
  1 file passed
  3 tests passed

pnpm exec vue-tsc --noEmit
  passed

pnpm exec eslint src/views/admin/AnnouncementsView.vue
  passed
```

覆盖的关键场景：默认服务端请求参数、搜索/状态筛选重载、空列表创建入口。

## 浏览器验收待办

- [ ] 1440px：工具栏、表格操作列和编辑弹窗无重叠。
- [ ] 900px：筛选栏换行后仍保持可用，时间列不挤压标题。
- [ ] 390px：表格保持横向滚动，编辑弹窗切换为底部 sheet。
- [ ] dark mode、reduced motion、键盘焦点和 Escape 关闭。
