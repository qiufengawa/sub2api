# R10 管理员渠道页壳迁移记录

## 本批次范围

- 页面：`frontend/src/views/admin/ChannelsView.vue`
- 本批次完成列表工作区、筛选栏、分页、状态切换、行操作、空态和编辑弹窗外壳迁移。
- 平台定价、账户统计规则和冲突检测等领域逻辑继续复用原有脚本和 `PricingEntryCard`，后续 R10 子批次继续拆换其内部控件。

## 已迁移

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
        │   ├── UiSwitch
        │   ├── UiBadge
        │   └── UiIconButton（编辑、删除）
        └── UiPagination
```

- 编辑弹窗壳改为 `UiDialog`，确认删除改为 `UiConfirmDialog`。
- 基础字段改为 `UiTextField`、`UiTextArea`、`UiSelect`、`UiCheckbox`。
- 平台切换改为 `UiTabs`，移除旧 `channel-tab` 页面样式。
- 修复 `bedrock_cc_compat` 读取对象形状与写入对象形状不一致的问题，同时兼容旧布尔值。

## 保留契约

- `/admin/channels` 列表请求、服务端排序、状态筛选、分页和请求取消。
- 渠道创建/编辑/删除、状态切换、组冲突检测、定价序列化、账户统计定价规则和模型同步。
- 平台开关、账号统计规则、图片/视频/搜索/桥接配置及第三方渠道字段。

## 当前剩余工作

- 平台分组选择、模型映射、规则账户搜索和定价条目内部仍有旧原生控件/旧页面 class，需要在后续 R10 子批次迁移到 `UiCheckbox`、`UiTextField`、`UiAsyncEntityPicker`、`UiAccordion` 等组件。
- `PricingEntryCard` 和领域平台图标仍需独立完成视觉重构后才可将 Channels 页面标记为最终完成。

## 验证

```text
pnpm exec vitest run src/views/admin/__tests__/ChannelsView.spec.ts
  1 file passed
  2 tests passed

pnpm exec vue-tsc --noEmit
  passed

pnpm exec eslint src/views/admin/ChannelsView.vue src/views/admin/__tests__/ChannelsView.spec.ts
  passed

git diff --check
  passed
```
