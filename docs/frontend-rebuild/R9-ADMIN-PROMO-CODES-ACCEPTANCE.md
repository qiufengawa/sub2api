# R9 管理员兑换码页验收记录

## 范围

- 页面：`frontend/src/views/admin/PromoCodesView.vue`
- 本批次重写兑换码页面壳、筛选栏、表格、分页、复制操作、创建/编辑/使用记录/删除弹窗。
- 保留兑换码 CRUD、使用记录分页、复制兑换码和注册链接、状态判定、过期/最大使用次数语义及原有 API payload。

## 新结构

```text
AppLayout
└── AppPage
    ├── AppPageHeader
    │   └── UiButton（创建兑换码）
    └── UiServerTableWorkspace
        ├── UiTableToolbar
        │   ├── UiSearchInput
        │   ├── UiSelect
        │   └── UiIconButton（刷新）
        ├── UiDataTable
        │   ├── UiBadge（状态）
        │   └── UiIconButton（复制、注册链接、使用记录、编辑、删除）
        └── UiPagination
```

创建和编辑使用 `UiDialog`、`UiTextField`、`UiTextArea`、`UiSelect`；使用记录使用 `UiSpinner`、`UiEmptyState`、`UiPagination`；删除使用 `UiConfirmDialog`。

## 行为保护

- 列表请求继续携带 `status/search/sort_by/sort_order` 和 `AbortSignal`。
- 搜索由 `UiSearchInput` 统一承担 300ms 防抖，筛选、排序、分页和页大小继续从第一页重载。
- 创建数值字段仍转换为 number；更新仍将清空过期时间转换为 `0`。
- 状态展示继续区分 active、disabled、expired 和 max-used。
- 使用记录分页、注册链接生成、兑换码复制反馈以及删除确认流程保持原有事件链。
- 同时修复编辑表单重复绑定 `bonus_amount` 的旧模板问题。

## 自动化验证

```text
pnpm exec vitest run src/views/admin/__tests__/PromoCodesView.spec.ts
  1 file passed
  2 tests passed

pnpm exec vue-tsc --noEmit
  passed

pnpm exec eslint src/views/admin/PromoCodesView.vue src/views/admin/__tests__/PromoCodesView.spec.ts
  passed
```

覆盖的关键场景：默认服务端排序请求、搜索/状态筛选重载。

## 浏览器验收待办

- [ ] 1440px：表格金额、使用次数和操作列无重叠。
- [ ] 900px：筛选栏换行后仍可操作，弹窗表单保持可读。
- [ ] 390px：表格横向滚动，使用记录弹窗不被底部浏览器控件遮挡。
- [ ] dark mode、reduced motion、键盘焦点和 Escape 关闭。
