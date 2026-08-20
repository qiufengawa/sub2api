# R8 管理员公告页验收记录

## 范围

- 页面：`frontend/src/views/admin/AnnouncementsView.vue`
- 本批次重写页面壳、筛选栏、表格、分页、状态展示、行操作、公告编辑/确认弹窗、阅读状态抽屉和用户公告正文视觉层。
- 保留公告 CRUD API、服务端排序、分页、搜索防抖、日期序列化、投放条件语义和用户标记已读行为。

## 新结构

```text
AppLayout
└── AppPage
    ├── AppPageHeader
    │   └── UiButton（创建）
    └── UiServerTableWorkspace
        ├── UiFilterBar
        │   ├── UiSearchInput
        │   ├── UiSelect
        │   └── UiIconButton（刷新）
        ├── UiDataTable
        │   ├── UiStatusBadge / UiBadge
        │   └── UiIconButton（预览、读状态、编辑、删除）
        └── UiPagination
```

编辑使用 `UiDialog`、`UiTextField`、`UiTextArea`、`UiSelect` 和 `UiButton`；删除使用 `UiConfirmDialog`；阅读状态使用 `UiDrawer`；管理员预览、用户弹窗和公告中心共用领域 `AnnouncementDetail`。

## 行为保护

- 列表请求仍携带 `status/search/sort_by/sort_order`，并继续使用 `AbortSignal` 防止旧响应覆盖新响应。
- 搜索仍为 300ms 防抖，由 `UiSearchInput` 统一承担；状态、排序、页码和页大小继续回到第一页并重载。
- 创建与更新的时间字段仍区分未设置、清空（`0`）和具体 Unix 秒值。
- targeting 通过共享校验器对齐后端 `NormalizeAndValidate` 约束：空 targeting 表示全部用户；自定义规则必须包含非空 AND 条件；订阅条件必须选择正整数分组并使用 `in`；余额条件必须使用受支持运算符和有限数值；`any_of/all_of` 各自最多 50 条。
- targeting 无效时，编辑器显示持久错误，保存按钮禁用，提交处理器也会拒绝程序化提交，不再把无效规则发送到后端。
- 行操作仍映射到预览、阅读状态、编辑和删除四条原有行为链。
- 首次加载使用稳定的表格 loading 状态；刷新失败时保留已有数据并显示持久错误；空列表与请求失败使用不同状态。
- 保存、删除和阅读状态请求具有防重入、取消与可重试错误状态；组件卸载时中止未完成请求并清理搜索计时器。
- 公告 Markdown 经 DOMPurify 清洗；HTTP(S) 外链增加 `_blank` 和 `noopener noreferrer`，旧 `markdown-body` 与旧公告样式文件已经移除。

## 自动化验证

```text
pnpm exec vitest run \
  src/views/admin/__tests__/AnnouncementsView.spec.ts \
  src/components/admin/announcements/__tests__/AnnouncementReadStatusDialog.spec.ts \
  src/components/admin/announcements/__tests__/AnnouncementTargetingEditor.spec.ts \
  src/components/admin/announcements/__tests__/targetingValidation.spec.ts \
  src/components/common/__tests__/AnnouncementPopup.spec.ts \
  src/components/common/__tests__/AnnouncementBell.spec.ts \
  src/i18n/__tests__/localesMessageCompile.spec.ts
  7 files passed
  21 tests passed

pnpm exec vue-tsc --noEmit
  passed

pnpm exec eslint <announcement implementation, tests, and locale files>
  passed

git diff --check
  passed

pnpm run test:run
  322 files passed
  2120 tests passed

pnpm run typecheck
  passed

pnpm run lint:check
  passed

pnpm run build
  passed
```

覆盖的关键场景：默认服务端请求参数、稳定首次加载、刷新失败保留旧数据、搜索/状态筛选重载、空列表创建入口、删除防重入、无效投放阻止提交、阅读状态取消/错误重试、目标编辑、Markdown 清洗、安全外链、管理员预览和用户标记已读。

### 2026-08-19 本地响应式契约补充

- `AnnouncementsView.spec.ts` 不再只验证表格 fixture：真实 `UiMobileTableScroller` 现已断言 `role=region`、键盘 `tabindex=0`、公告页 accessible name 与 `min-width: 940px` 横向滚动契约。
- 创建入口现已断言编辑器通过 `UiDialog width=wide` 打开，标题与创建行为保持一致；共享 `UiDialog` 的 640px bottom-sheet、Escape、focus trap、scroll lock 与焦点恢复由 UI overlay 套件验证。
- 定向命令：`AnnouncementsView.spec.ts`、`UiExtendedComponents.spec.ts`、`HomeEarthAnimation.spec.ts` 共 3 files / 25 tests 通过。
- 这些是可重复的本地组件契约，只缩小回归面，不替代下方真实管理员会话浏览器清单。

## 浏览器验收待办

- [ ] 1440px：工具栏、表格操作列和编辑弹窗无重叠。
- [ ] 900px：筛选栏换行后仍保持可用，时间列不挤压标题。
- [ ] 390px：表格保持横向滚动，编辑弹窗切换为底部 sheet。
- [ ] dark mode、reduced motion、键盘焦点和 Escape 关闭。

待办原因：本地 Edge 当前没有管理员登录会话，受保护路由会重定向至登录页。未注入本地存储、未绕过路由守卫、未修改数据库；上述浏览器门禁保持未通过状态。

## 2026-08-19 用户公告已读失败恢复补充

- 单条 `markAsRead` 只有在 API 成功后才写本地 `read_at`；失败继续保持未读并向调用方传播，使公告中心能显示错误。
- 弹窗 dismissal 在已读请求失败时恢复原公告并保留后续队列顺序；成功后才延迟 300ms 展示下一条。reset 会清理过渡 timer，避免会话退出后的迟到弹窗。
- 新增公告 store 恢复测试与公告铃失败提示回归；公告相关定向套件 3 files / 8 tests passed。
- 该本地幂等恢复证据不替代受保护用户/管理员浏览器、slow/error 网络、keyboard/screen-reader、ownership、Code Review 或发布证据。

## 2026-08-19 隔离后端真实浏览器复验

- 真实 `admin@admin.com` 登录后，`/admin/announcements` 在 1440/900/390、dark、`prefers-reduced-motion: reduce` 下均加载目标路由；无横向溢出，Tab 可到达筛选、创建、表格和编辑入口，console/pageerror 清洁。
- 截图索引：`/tmp/sub2api-clean-admin-admin-announcements-1440.png`、`/tmp/sub2api-clean-admin-admin-announcements-900.png`、`/tmp/sub2api-clean-admin-admin-announcements-390.png`。
- 未执行真实创建/删除或外部 Markdown 预览提交；mutation 失败恢复仍以组件/行为测试为证据。
