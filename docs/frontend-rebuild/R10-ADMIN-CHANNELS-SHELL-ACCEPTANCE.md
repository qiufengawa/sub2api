# R10 管理员渠道页壳迁移记录

## 本批次范围

- 页面：`frontend/src/views/admin/ChannelsView.vue`
- 本批次完成列表工作区、筛选栏、分页、状态切换、行操作、空态和编辑弹窗外壳迁移。
- 平台定价、账户统计规则、模型映射和账户搜索继续复用原有脚本/负载语义，内部控件已收口到共享 UI 合同。

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
- `ChannelGroupSelector`、`ChannelModelMappingEditor`、`ChannelAccountStatsRulesEditor`、`PricingEntryCard` 和 `IntervalRow` 均使用共享 `Ui*` 控件；账户规则搜索使用 `UiAsyncEntityPicker`，模型列表使用 `UiTagInput`。

## 保留契约

- `/admin/channels` 列表请求、服务端排序、状态筛选、分页和请求取消。
- 渠道创建/编辑/删除、状态切换、组冲突检测、定价序列化、账户统计定价规则和模型同步。
- 平台开关、账号统计规则、图片/视频/搜索/桥接配置及第三方渠道字段。

## 当前剩余工作

- 当前源码生产路径未发现裸 `input`/`select`/`textarea`/`button`；`channel-*` 类为局部布局/状态类，不是旧 generic card/form helper。
- 仍需真实管理员浏览器三视口、主题、reduced-motion、键盘、screen-reader 和成功/失败 mutation 证据；这些不由 jsdom 定向测试替代。

## 验证

```text
pnpm exec vitest run src/views/admin/__tests__/ChannelsView.spec.ts src/components/admin/channel/__tests__/PricingEntryCard.spec.ts src/components/admin/channel/__tests__/types.spec.ts
  3 files passed
  13 tests passed

pnpm exec vue-tsc --noEmit
  passed

pnpm exec eslint src/views/admin/ChannelsView.vue src/views/admin/__tests__/ChannelsView.spec.ts
  passed

git diff --check
  passed
```
