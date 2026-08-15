# Sub2API 全站前端重构计划

## 0. 文档状态

- 状态：规划与 Git 存档已完成，R0 已完成，R1 公共组件独立化正在实施，R2 认证与初始化已完成并通过定向验收；R3-R9 尚未完成。
- 基线日期：2026-08-14。
- 当前开发分支：`ui/main`；全部后续前端重构只在该开发线继续整合。
- 设计基线：`UI.MD`、`frontend/src/styles/ui-tokens.css`、`frontend/src/components/ui/`。
- 组件基线：114 个共享 `Ui/App` 组件已经建立；组件存在不代表业务页面已经迁移。
- 本文替换原有“账号调用优先度改造计划”。旧计划对应功能已经完成，不再作为全站前端工作的执行依据。
- 页面范围、重写边界、批次顺序和验收口径已经确认。
- 长任务执行入口见本文第 15 节；执行者必须先读取全文，再按 R0 至 R9 连续推进。
- 可直接复制的完整目标引导词同步维护在 [`docs/FRONTEND_REFACTOR_GOAL_PROMPT.md`](docs/FRONTEND_REFACTOR_GOAL_PROMPT.md)；该文件必须与第 15 节保持一致。
- 本轮最终决策：旧前端的样式、组件外观、DOM、排版和布局全部丢弃并重写；旧前端只作为业务功能契约、数据字段和异常分支参考。
- 最新确认（2026-08-14）：本次是前端整体重构，不是旧页面换色或局部修补。旧前端的样式、组件实现、页面 DOM、排版、布局、响应式补丁和视觉 CSS 均不作为新实现基础；先以 Git archive 作为唯一回退存档，再在 `ui/main` 逐页重写并装入原有业务功能。除非在例外清单中明确记录，否则不得保留旧视觉实现。
- 文档唯一性：`plan.md` 是全量前端重构的唯一执行总纲；`UI.MD` 是设计令牌与公共组件基线，其他阶段性文档不得覆盖本文的边界、批次或验收标准。
- 长任务启动门禁：开始删除或重写前，必须实际验证 archive 分支、提交和远端指向；若任一项不可验证，先创建并推送只包含前端基线的 archive 提交，完成验证后才能继续。

## 1. 目标

基于现有 114 个共享组件，重新构建公共页、认证页、用户控制台、管理员控制台和辅助流程。现有页面只作为功能清单和行为参考，不作为样式、组件结构、DOM 或布局参考。

本次重构的核心不是“给旧页面换颜色”，而是完成以下闭环：

1. 在任何删除或重写前，先创建并推送可独立恢复的 Git 前端存档分支。
2. 保留 114 个已确认的 `Ui/App` 组件、API 层、store、composable、类型、国际化资源和业务规则。
3. 丢弃旧页面模板、旧布局 DOM、旧视觉组件、旧页面 CSS 和旧全局视觉规则，重新实现全部 61 个页面。
4. 旧页面只用于逐项提取功能、字段、权限、状态机和异常分支，提取完成后不沿用其视觉实现。
5. 按页面职责重新设计信息顺序、布局和交互，再将原有功能装入新的页面结构。
6. 桌面端优先保证信息密度和扫描效率，移动端保持同一信息结构并做响应式适配。
7. 最终生产代码只保留新 UI 体系，不以长期兼容为理由残留两套页面或两套视觉组件。

## 2. 冻结原则

### 2.1 本轮允许修改

- 删除并重写全部页面模板、页面结构、页面样式、布局壳和旧视觉组件。
- 重新设计信息顺序、留白、栅格、表格、表单、导航、弹窗和响应式排版。
- 将旧领域组件拆成“业务逻辑”和“新视觉实现”，必要时重新命名或重新建文件。
- 加载、空状态、错误状态、成功反馈和响应式布局。
- 在不改变业务含义的前提下精简文案、统一术语和格式。
- 为功能搬运补充临时适配器、测试和验收 fixture；临时适配器不得成为最终视觉实现。

### 2.2 本轮默认不修改

- `backend/` 目录中的任何文件（源码、配置、迁移、测试、嵌入产物和文档）均不得修改；本轮只允许修改 `frontend/`、UI 设计文档、前端重构记录和必要的前端测试。
- API URL、请求参数、响应字段和错误协议。
- 登录、权限、功能开关、菜单可见性和路由语义。
- 计费、倍率、订阅、余额、订单、退款和支付状态机。
- 调度、账号优先度、监控统计口径和后端数据计算。
- 本地持久化 key、支付恢复快照、查询参数深链和第三方 SDK 生命周期。
- `backend/cmd/server/VERSION`、`frontend/package.json` 的系统版本来源、任何版本号、tag、GitHub Release、GHCR 标签和线上发布元数据。

确需改变上述行为时，必须拆成独立需求，不得混入视觉重构。

### 2.3 视觉与结构约束

- 沿用已经确认的 UI 组件体系：米白背景、黑白主体、暖灰边界和语义色。
- 按仓库硬约束使用细长控件：默认 `36px`，compact `32px`，dense `28px`；`24px` 仅用于表格行内图标操作和紧凑标签，`40px` 仅用于有明确触控理由的独立主操作。超过 `36px` 必须在页面验收记录中说明交互理由。
- 不使用大面积渐变、彩色标题条、无意义编号和解释实现方式的文案。
- 不允许卡片套卡片；完整页面区块不因装饰目的被包进浮动卡片；不添加只为制造背景色的 wrapper；普通页面最多三层可见 surface（页面、section/tool、overlay）。相关值必须使用 grid 或 description list 对齐。
- Lucide 是唯一界面图标来源；页面不得新增手绘 SVG 图标。
- 独立工具图标可有描边容器；内嵌编辑、关闭、勾、叉、校验与状态图标保持无框。
- 绿色只表示成功或确认，红色只表示失败、取消或删除，黄色表示警告或等待。
- 蓝色只用于信息状态或图表序列，不作为通用按钮色；粉色只用于公共页装饰或次级图表；供应商品牌色只允许出现在图标或小标签中，不得铺满卡片或弹窗；黄色文字必须保持可读对比度；绿色不得作为页面背景；不得出现 logo 前的彩色条。
- 英文与普通数字使用 `Inter, "SF Pro Text", "Segoe UI", Arial, sans-serif`；中英混排使用 `Inter, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif`；JSON、API Key、模型 ID、端点和请求 ID 使用 `"SFMono-Regular", "Cascadia Code", "Roboto Mono", Consolas, "Liberation Mono", monospace`；金额和指标使用 `font-variant-numeric: tabular-nums`。
- 字间距固定为 `0`；字重仅使用 `400/500/600/700`，`800+` 只允许首页 hero 或明确的公共营销标题；标题字号按固定 type scale 和断点切换，不按 viewport 连续缩放。
- 高密度列表在手机端仍保持列表或表格，通过受控横向滚动完成比较，不改成大卡片流。
- 普通页面最多保留三层可见 surface（页面、section/tool、overlay）；仅承载布局的 wrapper 不得拥有独立背景、边框、阴影或圆角。表格工具栏只承载搜索、筛选、批量、导出、刷新、列设置和创建等语义动作；数据单元格保持“一条主值 + 一条 metadata”，横向滚动区域必须可聚焦并有 accessible name。

### 2.4 UI.MD 与 AGENTS 组件硬契约

- 所有界面图标必须通过 `components/icons/Icon.vue` 使用 `lucide-vue-next`；禁止第二图标库、UCloud 图标和页面级 SVG。SVG 仅用于数据可视化；栅格插画仅限公共页、邮件、空状态和 onboarding，且必须服务于任务。
- 共享组件必须按需提供 light/dark、`mini/dense/default/large` density、normal/hover/active/focus-visible/disabled/loading/invalid/readonly 状态，支持长中文、英文、数字、模型 ID 和 API 值，覆盖 1440/900/390 三视口、reduced-motion、键盘操作和 accessible name，并配套单测与 fixture。
- 组件 props 表达语义（如 `intent="danger"`、`density="compact"`、`loading`），禁止 `blue`、`largeRounded`、`shadowHeavy` 等任意视觉 props。消费者只能调整 width、grid 和上下文间距，不得重定义颜色、高度、圆角、focus、disabled 或 motion；禁止用 `:deep()` 或 `!important` 打补丁。
- 动效只解释状态变化：hover/focus `100-140ms`，tooltip/popover `120-140ms` 且位移不超过 `2px`，认证表单切换使用持久 shell 的 `140ms` 交叉淡入，dialog `180ms`、drawer/sheet `180-240ms`。普通过渡只动画 `opacity` 和 `transform`，禁止动画 height/width/top/left/padding/margin；表格排序、筛选、分页不得逐行入场，实时图表不得重复播放整段入场动画。
- 桌面首行放主要指标与健康状态，toolbar 不得不可预测换行；平板先减列不减字号；移动端保留表头和比较能力，sticky 列不得遮挡内容，dialog 在键盘或浏览器 chrome 会遮挡时改用 sheet，并尊重 safe-area；页面不得横向溢出。
- 认证路由必须复用 `AuthLayout`、`AuthFormPanel`、`AuthTextField` 的路由、行为和可访问性契约，并重写这些组件的 DOM/CSS 实现；相关路由保持持久认证壳，只切换表单内容，不出现空白中间帧。密码规则通过字段帮助/tooltip 提供，不常驻堆叠说明。
- 共享组件必须使用语义 props 表达意图，不向页面暴露任意颜色、圆角、阴影或高度 props；页面不得通过 `:deep()`、`!important` 或局部 CSS 重定义共享状态。
- Tooltip 只承载短只读说明，不承载必需操作；spinner 只用于短暂动作，页面首次加载必须用与最终布局同尺寸的 skeleton；toast 不能成为支付或破坏性失败的唯一记录；dialog 不用于普通导航或把完整页面塞进弹窗。
- 每个正式页面默认由 `AppPage` + 一个 `AppPageHeader` 组成，例外必须在 review 记录中说明；新增状态必须同步更新 `ui-system` fixture；按钮、链接、tabs、switch 必须使用正确语义元素。

### 2.5 完整重写边界

以下内容必须丢弃并重新实现：

- 61 个页面现有的 `<template>` 视觉结构和页面级 `<style>`。
- `AppLayout`、`AuthLayout`、`AppHeader`、`AppSidebar`、`TablePageLayout` 的现有排版与视觉 DOM。
- `components/common` 中仅承担视觉职责的旧按钮、输入框、弹窗、表格、状态、空态和加载组件。
- `frontend/src/style.css` 中服务于旧页面外观的 `.btn`、`.input`、`.card`、`.modal`、旧表格和旧布局规则。
- 页面自行维护的颜色、圆角、高度、阴影、图标容器和响应式补丁。

以下内容保留并迁移到新页面：

- API、store、composable、router、类型、i18n key 和权限判断。
- 业务计算、校验、轮询、取消、重试、缓存、持久化和第三方 SDK 生命周期。
- 每个页面全部有效字段、操作、状态、错误分支和功能开关。
- 已确认的 114 个 `Ui/App` 组件及其设计令牌；114 个组件必须全部完成独立化、统一令牌接入、状态覆盖、契约测试和验收页登记。如果组件行为不足，应增强组件本身，而不是恢复旧页面样式。这里的“保留”只指保留业务契约和可复用目标，不表示原样保留旧实现。

实施采用“功能提取 -> 新页面实现 -> 行为对照 -> 切换路由 -> 删除旧视觉代码”的替换方式。允许为了保持应用可运行而短期存在适配器，但任何页面只有在旧视觉代码已经删除后才算完成。

### 2.6 Git 存档点

前端基线存档已经建立并推送：

```text
branch: archive/frontend-before-full-rebuild-20260814
commit: 215adfaa4aa893488c53cd3853dae27c8847dc91
remote: origin (qiufengawa/sub2api)
```

存档建立过程遵循以下规则：

1. 审查工作区，确认当前前端和 UI 文档是需要保存的基线。
2. 创建一个只包含 `frontend/`、`UI.MD`、`plan.md` 和相关 UI 展示文档的快照提交；不得混入无关后端改动。
3. 从该提交创建并推送分支：`archive/frontend-before-full-rebuild-20260814`。
4. 不创建 GitHub Release，不使用版本号 tag，也不触发线上更新。
5. 用 `git show`、`git ls-tree` 和远端分支查询确认快照包含新 UI 组件、现有页面和文档。
6. 在当前开发分支继续重构；需要回退时可从 archive 分支恢复完整前端或单个文件。

远端分支、提交哈希、114 个 UI 组件和重构计划均已核验。这个存档点只负责回退，不是后续继续复用旧样式的依据。

## 3. 页面数量与统计口径

### 3.1 总量

| 统计对象 | 数量 | 说明 |
| --- | ---: | --- |
| 生产路由记录 | 66 | 包含 4 个纯重定向、认证父壳和 404；alias 不重复计数 |
| 独立页面组件 | 61 | 生产路由绑定的内容页；认证父壳 `AuthShellView` 不作为独立内容页重复计数 |
| 静态主导航入口 | 37 | 用户侧 14 个、管理员侧 23 个；受权限和功能开关影响 |
| 动态主导航入口 | `N` | `custom_menu_items` 可增加任意数量入口，但统一复用 `/custom/:id` |
| 开发专用路由 | 1 | `/ui-system-preview` 仅开发环境存在，复用 `UiSystemView` |

### 3.2 61 个独立页面的归属

| 页面族 | 数量 | 说明 |
| --- | ---: | --- |
| 公共产品页 | 4 | 首页、公开 Key 用量、法律文档、模型广场 |
| 认证主流程 | 5 | 登录、注册、邮箱验证、忘记密码、重置密码 |
| 用户控制台主页面 | 13 | 用户日常工作页，不含购买与支付子流程 |
| 管理员控制台主页面 | 23 | 不含 UI 组件验收页 |
| 支付、回调和辅助流程 | 15 | 7 个认证回调、6 个支付流程、初始化、404 |
| 内部验收页 | 1 | 管理员 UI System |
| 合计 | 61 | 独立 Vue 页面组件口径 |

### 3.3 角色共享边界

- 管理员通过现有权限逻辑可以访问多数用户页面，但管理员默认入口仍为 `/admin/dashboard`。
- `/monitor` 是用户与管理员共享的渠道状态页面，管理员可看到更多诊断信息。
- `/model-plaza` 同时支持公开独立形态与控制台嵌入形态。
- `/custom/:id` 是一个页面组件，实际内容与菜单可见性由后台配置决定。
- `/purchase`、订单和支付回调属于一个交易流程族，页面计数分开，但实施时必须作为一个批次验收。

## 4. 目标前端分层

```text
views/
  只负责页面编排、路由参数、页面级请求和业务状态

components/<domain>/
  负责账号、分组、支付、公告、监控等领域逻辑与组合

components/ui/
  负责通用视觉、交互、键盘、焦点、加载、响应式和无障碍

styles/ui-tokens.css
  唯一的字体、颜色、密度、圆角、边界、阴影和动效令牌
```

业务页面只能从 `@/components/ui` 公共入口导入共享组件。禁止新增 `@/components/ui/UiXxx.vue` 文件路径导入，也禁止页面重新定义共享组件的高度、颜色、圆角和焦点状态。新页面必须重新编写模板结构，不允许把旧页面 DOM 包进 `AppPage` 后视为完成。

## 5. P0：公共组件整体替换

公共组件替换是页面重构的前置任务。目标不是给旧组件换皮，而是让 114 个新组件独立承接所有通用行为，随后删除旧视觉组件。

### 5.1 当前事实

- `frontend/src/components/common/` 现有 42 个 Vue 组件。
- 高频旧组件仍被大量业务页面直接依赖：`BaseDialog` 79 个文件、`Select` 54 个、`ConfirmDialog` 34 个、`Pagination` 28 个、`DataTable` 22 个、`EmptyState` 20 个、`HelpTooltip` 18 个、`LoadingSpinner` 18 个、`Toggle` 16 个。
- `AppLayout` 被约 40 个页面使用，`TablePageLayout` 被 18 个页面使用。
- 部分新组件仍是旧组件的样式包装：`UiDialog`、`UiConfirmDialog`、`UiDataTable`、`UiSelect`、`UiCombobox`、`UiDateRangePicker`、`UiTooltip`、`UiFieldHelp`、`UiSkeleton`。
- 因此“把 import 名称改成 UiXxx”不等于完成替换，必须同时保留并最终收口旧组件的行为契约。

### 5.2 替换类型

| 类型 | 处理方式 | 适用对象 |
| --- | --- | --- |
| A：直接替换 | 接口等价，逐处换为 `Ui*` 并删除页面局部样式 | Input、TextArea、Toggle、SearchInput、Skeleton、LoadingSpinner |
| B：临时行为适配 | 先把旧行为契约提取到 `Ui*`，迁移消费者后删除旧内部实现；适配器不得保留旧外观 | DataTable、Pagination、Select、DateRangePicker、Dialog、ConfirmDialog、Tooltip |
| C：领域逻辑重装 | 保留领域 API 和计算，重新编写全部模板与样式，内部只组合 `Ui*` | GroupSelector、ProxySelector、PlatformIcon、Announcement、VersionBadge、Payment 组件 |
| D：布局重建 | 保留权限、菜单数据和状态来源，布局壳的 DOM、CSS 与响应式行为全部重写 | AppLayout、AuthLayout、AppHeader、AppSidebar、TablePageLayout |
| E：强制删除 | 新实现通过行为对照后删除旧文件、旧 DOM 和旧样式 | 所有已完成迁移的旧视觉实现 |

### 5.3 高频组件替换矩阵

| 旧组件/结构 | 目标组件 | 实施要求 | 风险 |
| --- | --- | --- | --- |
| `Input` | `UiTextField` | 对齐 label、error、prefix/suffix、事件和 autocomplete | 低 |
| `TextArea` | `UiTextArea` | 保留 maxlength、计数、rows、resize 决策 | 低 |
| `Toggle` | `UiSwitch` | 保留 v-model、disabled 和即时保存语义 | 低 |
| `SearchInput` | `UiSearchInput` | 保留 debounce、clear 和 search 事件 | 低 |
| `LoadingSpinner` | `UiSpinner` | 统一尺寸映射；已知结构优先改用 `UiSkeleton` | 低 |
| `Skeleton` | `UiSkeleton` | 骨架尺寸必须匹配最终布局 | 低 |
| `EmptyState` | `UiEmptyState` | 对齐标题、描述、图标、action slot 和默认文案 | 低 |
| `StatCard` | `UiStatMetric` + `UiMetricTrend` | 指标不再拆成装饰性大卡片 | 中 |
| `Pagination` | `UiPagination` | 保留跳页、页大小、持久化和移动端行为 | 中 |
| `HelpTooltip` | `UiTooltip` / `UiFieldHelp` | 保留 hover/click、定位、外点关闭和键盘访问 | 中 |
| `DateRangePicker` | `UiDateRangePicker` / `UiDateTimeRangePicker` | 保留预设、时区和“今天”边界语义 | 中高 |
| `Select` | `UiSelect` / `UiCombobox` / `UiMultiCombobox` | 保留搜索、创建、分组、禁用、Teleport、键盘与定位 | 高 |
| `BaseDialog` | `UiDialog` | 保留 overlay stack、focus trap、Esc、滚动锁和恢复焦点 | 高 |
| `ConfirmDialog` | `UiConfirmDialog` | 保留 pending、confirmDisabled 和危险操作安全默认值 | 高 |
| `DataTable` | `UiDataTable` + `UiMobileTableScroller` | 保留排序、虚拟化、选择、sticky、持久化和服务端分页 | 极高 |
| `TablePageLayout` | `AppPage` + `UiServerTableWorkspace` | 先做兼容层，保持 actions/filters/table/pagination slots | 高 |
| 全局 `Toast` | `UiToast`/`UiSnackbar` + 队列适配器 | 不能机械替换单条组件；保留全局队列和严重级别 | 高 |
| `ImageUpload` | `UiFileUpload` + 领域预览 | 保留 data URL/SVG 清洗、尺寸比例和大小限制 | 高 |
| `ExportProgressDialog` | `UiDialog` + `UiExportJob` | 保留进度、取消、重试、下载和估时 | 中高 |

### 5.4 必须保留为领域组件的对象

以下对象保留领域职责和对外业务契约，但其模板、排版和样式同样全部重写：

- 公告：`AnnouncementBell`、`AnnouncementPopup`、`AnnouncementDetail`。
- 分组和模型：`GroupBadge`、`GroupSelector`、`GroupOptionItem`、`ModelIcon`、`PlatformIcon`。
- 代理和 IP：`ProxySelector`、`IpGeoCell`、`IpGeoBatchToolbar`。
- 系统：`LocaleSwitcher`、`NavigationProgress`、`AutoRefreshButton`、`VersionBadge`。
- 支付：支付方式选择、二维码、Provider 配置、订单状态和恢复流程组件。
- 操练场：Composer、Message、参数面板、请求预览和 `usePlayground`。
- 监控：矩阵、趋势、健康计算、查询同步和自动刷新组件。

### 5.5 公共组件替换完成标准

1. 业务代码从 `@/components/ui` 导入通用组件。
2. A 类旧组件没有生产消费者。
3. B 类组件的 `Ui*` API 覆盖旧行为，内部不再依赖不可控的页面样式覆写。
4. C 类组件保留领域 API，但按钮、字段、弹窗、状态和排版来自 UI 层。
5. 新代码不新增 `common` 通用组件，不新增第二套按钮、输入框、弹窗或表格。
6. 所有兼容层都有迁移清单、测试和明确删除条件。
7. 旧全局 CSS 仅保留尚有消费者的规则，并通过使用统计逐步归零。
8. 最终页面不包含从旧页面复制的模板区块、旧 class 结构或旧响应式补丁。
9. `components/common` 中纯视觉组件的生产消费者归零；领域组件必须完成新模板重写。

## 6. 页面数据与展示形态

### 6.1 列表工作台

适用：账号、用户、密钥、分组、渠道、订单、用量、兑换码、代理、审计等。

```text
AppPage
├── AppPageHeader：标题、必要说明、主操作
├── UiServerTableWorkspace
│   ├── UiTableToolbar：搜索、筛选、刷新、列设置、导出
│   ├── UiFilterChips：已应用筛选
│   ├── UiBulkActionBar：有选择时出现
│   ├── UiMobileTableScroller + UiDataTable
│   └── UiPagination
└── UiDrawer / UiDialog：详情与编辑
```

桌面优先显示名称、关键状态、核心指标和操作；手机保留表头与列比较，不转换为高大的卡片。

### 6.2 仪表盘与监控

```text
AppPage
├── AppPageHeader：时间范围、刷新、实时状态
├── AppGrid：UiStatMetric / UiLiveMetric / UiThresholdMetric
├── AppSection：主要健康或成本结论
└── UiChartFrame：趋势、分布、图例、空态、错误、全屏
```

首屏先回答“是否正常、哪里异常、影响多大、下一步做什么”，其次展示支持判断的趋势和明细。

### 6.3 表单与设置

```text
AppPage / UiDialog / UiDrawer
├── AppPageHeader 或 overlay header
├── AppSection + AppGrid：同级字段
├── AppStack：长文本、JSON、动态字段
├── UiStructuredEditor / UiKeyValueEditor：结构化配置
└── UiSaveBar：脏状态、保存、撤销
```

高级设置使用 `UiAccordion` 分层，不为每个字段套卡片。敏感信息使用 `UiSecretField`，帮助信息使用 `UiFieldHelp`。

### 6.4 详情与审计

- 基础事实使用 `UiDescriptionList`。
- ID、端点、JSON 和原始响应使用 `UiDataCell`、`UiCodeBlock`、`UiStructuredEditor`。
- 状态变化使用 `UiTimeline`，前后变化使用 `UiChangeSet`。
- 错误诊断使用 `UiErrorDetailDialog`，保留 request ID、状态码、时间和原始错误。

### 6.5 异步流程

- 初次加载使用与最终布局同尺寸的 `UiSkeleton`。
- 局部刷新使用 `UiLoadingOverlay`，不清空旧数据，也不让页面宽度收缩。
- 空数据使用 `UiEmptyState`，请求失败使用 `UiErrorState`。
- 普通操作结果使用 `UiToast`；支付、计费和危险操作错误必须在页面内留下持久说明。
- 自动刷新不得改变筛选、滚动、选中项或重播整页入场动画。

## 7. 全部页面规划矩阵

以下为目标信息结构。组件名称表示计划使用的共享契约，领域组件继续保留业务逻辑。

### 7.1 公共产品页：4 个

| 路由 / 页面 | 目标内容 | 主要组件与结构 | 批次 |
| --- | --- | --- | --- |
| `/home` 首页 | 产品定位、模型覆盖、能力、价格参考、接入方式、FAQ、行动入口 | 现有首页专用区块、`HomeSiteHeader`、`UiButton`、`UiLink`、`UiAccordion` | R8 |
| `/key-usage` Key 用量查询 | Key 输入、额度摘要、周期、请求记录、错误状态 | `AppPage`、`UiTextField`、`UiQuotaSummary`、`UiDataTable`、`UiErrorState` | R3 |
| `/legal/:documentId` 法律文档 | 文档标题、更新时间、正文、目录与返回 | `AppPage`、`AppPageHeader`、`UiPageNav`、`UiBackToTop` | R8 |
| `/model-plaza` 模型广场 | 搜索、厂商/能力/分组筛选、模型列表、多计费单位价格、详情 | `AppPage`、`UiSearchInput`、`UiFilterBar`、`UiTabs`、`UiDataTable`、`UiDrawer` | R5 |

### 7.2 认证主流程：5 个

| 路由 / 页面 | 目标内容 | 主要组件与结构 | 批次 |
| --- | --- | --- | --- |
| `/login` 登录 | 账号、密码、验证码/二步验证、第三方登录、忘记密码、注册入口 | `AuthLayout`、`AuthFormPanel`、`AuthTextField`、`UiButton` | R2 |
| `/register` 注册 | 必要注册字段、动态校验、协议、验证码、登录入口 | 同一认证壳、`UiFormField`、`UiFieldHelp`、`UiCheckbox`、`UiButton` | R2 |
| `/email-verify` 邮箱验证 | 验证状态、邮箱、重发、返回登录 | `AuthLayout`、`UiStatusBadge`、`UiAlert`、`UiButton` | R2 |
| `/forgot-password` 忘记密码 | 邮箱、验证码、人机验证、提交状态 | `AuthLayout`、`AuthTextField`、`UiButton`、`UiAlert` | R2 |
| `/reset-password` 重置密码 | 新密码、规则提示、确认密码、结果状态 | `AuthLayout`、`AuthTextField`、`UiFieldHelp`、`UiButton` | R2 |

### 7.3 用户控制台主页面：13 个

| 路由 / 页面 | 目标内容 | 主要组件与结构 | 批次 |
| --- | --- | --- | --- |
| `/dashboard` 用户仪表盘 | 余额/订阅/额度、趋势、模型分布、最近用量、快捷操作 | `AppPage`、`UiStatMetric`、`UiQuotaSummary`、`UiChartFrame`、`UiTimeline` | R3 |
| `/keys` API 密钥 | 密钥列表、分组/订阅绑定、额度、限速、创建/编辑/使用 | `UiServerTableWorkspace`、`UiDataTable`、`UiStatusBadge`、`UiDialog`、`UiSecretField` | R3 |
| `/playground` 操练场 | 对话、分组与模型、参数、流式状态、图片、响应指标、请求预览 | `AppSplitPane`、`PlaygroundComposer`、`UiConnectionStatus`、`UiImagePreview`、`UiCodeBlock` | R5 |
| `/batch-image` 批量生图 | 任务列表、创建任务、进度、结果图片、详情、指南 | `UiServerTableWorkspace`、`UiProgressBar`、`UiDialog`、`UiImagePreview`、`UiExportJob` | R5 |
| `/usage` 用户用量 | 时间筛选、统计、趋势、分布、请求列表、错误请求 | `UiDateRangePicker`、`UiStatMetric`、`UiChartFrame`、`UiDataTable`、`UiErrorDetailDialog` | R3 |
| `/redeem` 兑换 | 兑换码输入、结果、历史记录 | `AppPage`、`UiTextField`、`UiButton`、`UiStatusBadge`、`UiTimeline` | R3 |
| `/affiliate` 推广 | 邀请码/链接、返佣指标、记录、提现/转账说明 | `UiStatMetric`、`UiCopyButton`、`UiDataTable`、`UiConfirmDialog` | R3 |
| `/available-channels` 可用渠道 | 分组筛选、渠道/模型能力、倍率与可用状态 | `UiFilterBar`、`UiCombobox`、`UiDataTable`、`UiStatusBadge` | R5 |
| `/profile` 个人资料 | 头像、基本资料、密码、TOTP、Passkey、身份绑定、账单偏好 | `AppSection`、`AppGrid`、`UiFileUpload`、`UiSecretField`、`UiSaveBar` | R3 |
| `/subscriptions` 我的订阅 | 多实例订阅、额度窗口、到期时间、绑定 Key、续费入口 | `UiQuotaSummary`、`UiProgressBar`、`UiStatusBadge`、`UiDialog`、`UiButton` | R4 |
| `/orders` 我的订单 | 订单筛选、金额、支付方式、状态、取消、退款、详情 | `UiServerTableWorkspace`、`UiDataTable`、`UiTimeline`、`UiConfirmDialog` | R4 |
| `/monitor` 渠道状态 | 健康概览、趋势、矩阵、筛选、错误与用户维度、自动刷新 | `UiLiveMetric`、`UiChartFrame`、`UiFilterBar`、监控矩阵领域组件、`UiFullscreenPanel` | R5 |
| `/custom/:id` 自定义页 | 后台配置的 Markdown 或安全嵌入内容、加载和错误状态 | `AppPage`、`AppPageHeader`、`UiSkeleton`、`UiErrorState` | R5 |

### 7.4 管理员控制台主页面：23 个

| 路由 / 页面 | 目标内容 | 主要组件与结构 | 批次 |
| --- | --- | --- | --- |
| `/admin/dashboard` 管理仪表盘 | 核心业务指标、趋势、分布、风险摘要、快捷入口 | `UiStatMetric`、`UiMetricTrend`、`UiChartFrame`、`UiAlert` | R6 |
| `/admin/ops` 运维监控 | 系统健康环、CPU/内存/Redis、吞吐、延迟、错误、日志、告警 | `UiProgressRing`、`UiThresholdMetric`、`UiLiveMetric`、`UiChartFrame`、`UiLogLine` | R7 |
| `/admin/audit-logs` 审计日志 | 操作者、动作、资源、时间、IP、前后变化、详情 | `UiServerTableWorkspace`、`UiDateTimeRangePicker`、`UiChangeSet`、`UiDrawer` | R6 |
| `/admin/users` 用户管理 | 用户、余额、分组、平台额度、状态、批量操作、详情 | `UiDataTable`、`UiBulkActionBar`、`UiDrawer`、`UiTransferList`、`UiNumberStepper` | R6 |
| `/admin/groups` 分组管理 | 分组、倍率、模型、平台、优先级、复制、规则编辑 | `UiDataTable`、`UiInlineEdit`、`UiMultiCombobox`、`UiStructuredEditor`、`UiDialog` | R6 |
| `/admin/channels/pricing` 渠道与定价 | 渠道列表、倍率、模型映射、价格、可用状态、编辑 | `UiServerTableWorkspace`、`UiDataTable`、`UiKeyValueEditor`、`UiDialog` | R6 |
| `/admin/channels/monitor` 渠道监控配置 | V2 配置、旧监控 CRUD、立即运行、复制、模板 | `UiTabs`、`UiDataTable`、`UiDialog`、`UiConfirmDialog`、`UiSaveBar` | R7 |
| `/admin/subscriptions` 订阅管理 | 用户订阅实例、套餐、额度窗口、状态、续期和调整 | `UiDataTable`、`UiQuotaSummary`、`UiDrawer`、`UiTimeline` | R6 |
| `/admin/accounts` 账号管理 | 虚拟列表、服务状态、优先度、容量、排序、列设置、批量操作、测试 | `UiServerTableWorkspace`、`UiDataTable`、`UiInlineEdit`、`UiBulkActionBar`、`UiErrorDetailDialog` | R7 |
| `/admin/announcements` 公告管理 | 公告列表、编辑、预览、发布状态、阅读统计 | `UiDataTable`、`UiStructuredEditor`、`UiAnnouncementDialog`、`UiDrawer` | R6 |
| `/admin/proxies` 代理管理 | 代理列表、状态、批量测试、账号引用、导入导出 | `UiDataTable`、`UiBulkActionBar`、`UiExportJob`、领域 `ProxySelector` | R6 |
| `/admin/redeem` 兑换码管理 | 批次、额度、状态、有效期、订阅、批量修改和导出 | `UiDataTable`、`UiBulkActionBar`、`UiDateInput`、`UiExportJob` | R6 |
| `/admin/promo-codes` 优惠码管理 | 折扣规则、适用套餐、有效期、使用次数、状态 | `UiDataTable`、`UiFormField`、`UiDateTimeRangePicker`、`UiDialog` | R6 |
| `/admin/settings` 系统设置 | 分类导航、通用/认证/支付/网关/安全设置、上传、JSON、高级配置 | `UiSideNavGroup`、`AppSection`、`UiSecretField`、`UiStructuredEditor`、`UiSaveBar` | R7 |
| `/admin/risk-control` 风控 | 规则、阈值、命中记录、状态、测试与例外 | `UiDataTable`、`UiThresholdMetric`、`UiStructuredEditor`、`UiDialog` | R7 |
| `/admin/prompt-audit` Prompt 审计 | 筛选、Prompt 记录、风险、上下文、详情和处置 | `UiFilterBar`、`UiDataTable`、`UiCodeBlock`、`UiErrorDetailDialog` | R7 |
| `/admin/usage` 全站用量 | 时间筛选、全站指标、排行、趋势、请求和错误列表 | `UiDateRangePicker`、`UiStatMetric`、`UiChartFrame`、`UiDataTable` | R6 |
| `/admin/affiliates/invites` 邀请记录 | 邀请人、被邀请人、状态、注册与转化时间 | `UiServerTableWorkspace`、`UiDataTable`、`UiFilterBar` | R6 |
| `/admin/affiliates/rebates` 返佣记录 | 订单、返佣金额、比例、状态、时间 | `UiServerTableWorkspace`、`UiDataTable`、`UiStatusBadge` | R6 |
| `/admin/affiliates/transfers` 转账记录 | 用户、金额、状态、时间、审核与详情 | `UiServerTableWorkspace`、`UiDataTable`、`UiConfirmDialog`、`UiTimeline` | R6 |
| `/admin/orders/dashboard` 支付仪表盘 | 收入、订单、退款、支付渠道、趋势和异常 | `UiStatMetric`、`UiChartFrame`、`UiStatusBadge`、`UiAlert` | R7 |
| `/admin/orders` 订单管理 | 订单、用户、金额、支付方式、状态、退款、详情 | `UiServerTableWorkspace`、`UiDataTable`、`UiTimeline`、`UiConfirmDialog` | R7 |
| `/admin/orders/plans` 套餐管理 | 套餐、适用分组、额度窗口、价格、有效期、上下架、JSON 导入 | `UiDataTable`、`UiStructuredEditor`、`UiReviewSummary`、`UiDialog` | R7 |

### 7.5 支付、回调和辅助流程：15 个

| 路由 / 页面 | 目标内容 | 主要组件与结构 | 批次 |
| --- | --- | --- | --- |
| `/auth/callback` OAuth 回调 | 处理中、成功、失败、重试或返回登录 | `AuthLayout`、`UiSpinner`、`UiStatusBadge`、`UiAlert` | R2 |
| `/auth/linuxdo/callback` LinuxDo 回调 | 同上，保留账号绑定/创建分支 | 同一回调状态模板 | R2 |
| `/auth/wechat/callback` 微信回调 | 同上，保留微信授权错误与账号流程 | 同一回调状态模板 | R2 |
| `/auth/wechat/payment/callback` 微信支付回调 | 支付授权、恢复订单、继续支付或错误 | `UiSpinner`、`PaymentStatusPanel`、`UiAlert` | R4 |
| `/auth/dingtalk/callback` 钉钉回调 | 登录处理、账号状态和错误 | 同一回调状态模板 | R2 |
| `/auth/dingtalk/email-completion` 钉钉邮箱补全 | 必填邮箱、校验、继续创建账号 | `AuthLayout`、`AuthTextField`、`UiButton` | R2 |
| `/auth/oidc/callback` OIDC 回调 | 登录处理、账号状态和错误 | 同一回调状态模板 | R2 |
| `/purchase` 购买/充值 | 充值与订阅切换、套餐、续费实例、金额、支付方式、确认与恢复 | `UiTabs`、`UiNumberStepper`、领域套餐组件、`UiReviewSummary`、`PaymentStatusPanel` | R4 |
| `/payment/qrcode` 二维码支付 | 金额、订单、二维码、倒计时、轮询、取消和跳转 | 支付领域组件、`UiProgressBar`、`UiStatusBadge`、`UiButton` | R4 |
| `/payment/result` 支付结果 | 订单状态、金额、支付方式、时间、重试或返回 | `UiStatusBadge`、`UiDescriptionList`、`UiTimeline`、`UiButton` | R4 |
| `/payment/stripe` Stripe 支付 | 第三方 Payment Element、状态、恢复和结果跳转 | 支付领域壳、`UiAlert`、`UiSpinner` | R4 |
| `/payment/airwallex` Airwallex 支付 | 第三方支付加载、恢复、状态和结果跳转 | 支付领域壳、`UiAlert`、`UiSpinner` | R4 |
| `/payment/stripe-popup` Stripe 弹窗 | 父子窗口握手、支付状态、轮询和关闭 | 极简支付状态壳，不增加页面装饰 | R4 |
| `/setup` 初始化向导 | 数据库、管理员、站点配置、校验和完成 | `UiSteps`、`UiFormField`、`UiSecretField`、`UiReviewSummary` | R2 |
| `/:pathMatch(.*)*` 404 | 未找到说明、返回首页或控制台 | `AppPage`、`UiEmptyState`、`UiButton` | R8 |

### 7.6 内部验收页：1 个

| 路由 / 页面 | 目标内容 | 主要组件与结构 | 批次 |
| --- | --- | --- | --- |
| `/admin/ui-system` UI System | 114 个组件、全部状态、正式 mock 页面、响应式和动效验收 | 真实 `Ui/App` 组件，不复制静态外观 | 全程维护 |

## 8. 实施批次

### R0：规划冻结与回归基线

- 确认本文页面数量、目标内容、组件映射和批次。
- 创建并推送 `archive/frontend-before-full-rebuild-20260814` 前端存档分支。
- 确认 archive 分支可恢复 `frontend/`、114 个 UI 组件、现有 61 个页面和相关文档。
- 保存关键页面在 `1440 / 900 / 390px` 的重构前基线截图。
- 记录路由、功能开关、API 调用、localStorage、query、滚动和选择状态。
- 建立旧公共组件消费者统计，后续每批次更新。

完成结果：旧前端拥有可验证的 Git 回退点，后续可以彻底删除旧视觉代码，同时仍能核对功能是否完整。

### R1：公共组件整体替换

1. R1A：直接迁移 Input、TextArea、Toggle、SearchInput、Spinner、Skeleton、EmptyState。
2. R1B：补齐 Pagination、StatMetric、Tooltip 和全局反馈适配。
3. R1C：从旧 DataTable 与 TablePageLayout 提取行为契约，在新 table workspace 中重新实现 toolbar、selection、pagination 和 mobile scroller。
4. R1D：收口 Select、DateRange、Dialog、Confirm 和统一 overlay manager。
5. R1E：让公告、分组、代理、支付、系统等领域组件内部使用共享 UI。
6. R1F：删除已无消费者的旧通用组件和对应全局样式。

完成结果：新公共组件不再依赖旧视觉实现；页面不再自行实现通用控件，后续 61 个页面全部使用新模板和领域组合重建。

### R2：应用壳、认证与初始化

- [x] 统一认证壳、认证表单、OAuth 回调、条款弹窗和初始化向导。
- [x] 完成登录、注册、验证、找回、重置、回调和 setup 的共享组件迁移。
- [x] 通过认证定向测试 166 项、路由 guards 35 项、TypeScript、ESLint、生产构建和三视口浏览器验收。
- [ ] `AppLayout`、用户/管理员 header/sidebar 和完整页面加载骨架仍在 R1/R2 壳层收口中，不能因认证完成而标记全 R2 完成。

证据：`docs/frontend-rebuild/R2-AUTH-ACCEPTANCE.md`。

### R3：用户高频核心页

- [x] Redeem：兑换、结果、历史和帮助工作台。
- [x] Profile：资料、安全、绑定、账单偏好和提醒分区壳。
- [x] Affiliate：推广指标、复制、转账确认和邀请人列表。
- [x] Dashboard：状态首行、告警、阶段工作台和分析栅格壳。
- [x] Usage：用户用量工作台与管理员 Usage 已完成第一轮共享壳迁移。
- [~] Keys、公开 Key Usage：列表/查询外壳已迁移，表单与结果详情仍在 R1/R3 收口中。
- 优先验证表格、筛选、配额、金额、时间和错误详情格式。

页面证据：`docs/frontend-rebuild/R3-REDEEM-ACCEPTANCE.md`、`docs/frontend-rebuild/R3-PROFILE-ACCEPTANCE.md`、`docs/frontend-rebuild/R3-AFFILIATE-ACCEPTANCE.md`、`docs/frontend-rebuild/R3-DASHBOARD-ACCEPTANCE.md`、`docs/frontend-rebuild/R3-USAGE-ACCEPTANCE.md`、`docs/frontend-rebuild/R3-KEYS-ACCEPTANCE.md`、`docs/frontend-rebuild/R3-KEY-USAGE-ACCEPTANCE.md`。

### R4：订阅、购买、订单与支付流程

- 作为一个原子交易批次迁移。
- 冻结支付恢复快照、订单 ID、续费实例、QR 轮询、WeChat resume token、Stripe popup 和 Airwallex 生命周期。
- 任何页面视觉通过但恢复/回调失败，整个 R4 视为未完成。

### R5：高交互用户工具

- Model Plaza、Playground、Batch Image、Available Channels、Monitor、Custom Page。
- 冻结流式 generation、AbortController、图片响应、query 深链、自动刷新、矩阵缩放和滚动语义。

### R6：标准管理员工作台

- Dashboard、Users、Groups、Channels Pricing、Subscriptions、Announcements、Proxies、Redeem、Promo、Usage、Audit、Affiliate。
- 复用同一列表工作台，不在每个页面重新做筛选、分页、批量操作和详情弹窗。
- [x] Users：列表工作台、跨页批量操作、分组浮层，以及创建、编辑、额度、API Key、允许分组、余额和历史记录弹窗已完成共享 UI 重构与定向验收。
- [ ] R6 其余页面继续按页面验收记录逐项收口；Users 完成不代表整个 R6 完成。

### R7：复杂管理员页面

- Accounts、Ops、Channel Monitor、Settings、Risk Control、Prompt Audit、支付后台。
- 每个页面单独做状态图、依赖审计和浏览器验收，不进行机械批量替换。

### R8：公共和例外页面

- Home、Legal、404 及未覆盖的结果/说明页。
- 首页保留表达性；其余页面保持克制，不把营销布局带入工具页。

### R9：清理与全量一致性

- 删除全部已被新实现取代的旧页面模板、旧布局、旧视觉组件、旧 utility class、重复颜色和局部控件 CSS。
- 扫描直接文件导入、手绘 SVG、重复图标库、卡片嵌套和硬编码控件尺寸。
- 扫描旧 class、旧页面结构和 `components/common` 纯视觉消费者；除批准的第三方组件外必须归零。
- 更新 `UI.MD` 的实际状态和组件消费者统计。

## 9. 高风险页面保护条件

### 9.1 支付

- 不丢失订单恢复字段、续费实例和目标订阅 ID。
- 不改变 QR 终态、轮询防重入、deep-link fallback 和取消行为。
- 不重复初始化 Stripe/Airwallex SDK，不破坏 popup `postMessage`。
- 未登录支付结果页仍可按原路由策略访问。

### 9.2 操练场

- 不改变 `usePlayground` 的用户隔离、session、generation token 和持久化。
- stop 后的迟到 chunk 不得覆盖终态。
- 文本、图片、错误响应和响应指标必须继续进入正确会话。

### 9.3 Monitor V2

- query 是页面状态的一部分，筛选和 tab 可刷新恢复、可深链。
- 保留 abort + sequence 并发保护、自动刷新和 soft-prune。
- 矩阵滚轮缩放/平移不被普通滚动容器覆盖。

### 9.4 管理员账号页

- 保留虚拟化、服务端排序、列设置、`include_scheduler_score`、所有结果选择和自动刷新。
- 行内优先度更新继续拥有乐观更新、失败回滚和静默刷新窗口。
- 手机和桌面共享同一排序结果，不在客户端重新排序。

### 9.5 设置页

- 不改变动态配置 schema、secret 保留语义、Provider 特有字段和保存 payload。
- 长页面按设置域拆分导航与 section，不通过隐藏字段来获得“简洁”。

## 10. 测试与验收标准

### 10.1 公共组件验收

- 114 个组件继续通过 inventory 测试和 `/admin/ui-system` 展示。
- 关键组件覆盖 normal、hover、focus、disabled、loading、error、empty 和 long-content 状态。
- Select、Menu、Tabs、Dialog、Drawer、Sheet 和 Table 完成键盘路径测试。
- overlay 使用统一栈，只关闭顶层，焦点可圈定并返回触发器。
- 390px 下触控目标可用，页面无横向溢出；表格横向滚动区域可聚焦并有名称。

### 10.2 单页验收

每个页面必须同时满足：

1. 首屏可识别页面的主要任务、关键状态和下一步操作。
2. 所有原有有效信息仍可访问，没有因“简洁”被删除。
3. 权限、feature flag、路由、query 和 API payload 不变。
4. 加载时宽度、标题、工具栏和主要内容骨架稳定。
5. 空、错、无权限、超长文本、大数字和慢请求均有明确状态。
6. `1440px`、`900px`、`390px` 无遮挡、重叠或页面级横向滚动。
7. 表格在桌面和手机均保持列表语义与列比较能力。
8. 重要操作可仅使用键盘完成，焦点清晰且顺序合理。
9. 浏览器控制台没有本轮引入的 error 或 warning。
10. 页面不新增共享控件的局部复制实现。

### 10.3 自动化门禁

每个实施批次结束必须执行：

```bash
cd frontend
pnpm run test:run
pnpm run typecheck
pnpm run lint:check
pnpm run build
```

并补充：

- 对改造页面的定向单元/集成测试。
- 真实浏览器主流程测试。
- 三视口截图对比。
- dark mode 与 `prefers-reduced-motion` 抽查。
- `git diff --check` 和旧组件消费者数量复核。

### 10.4 批次完成标准

- 本批次所有页面和其弹窗、抽屉、空态、错误态一起完成。
- 迁移后没有临时混用两套外观的关键流程。
- 对应旧样式已删除或有明确的剩余消费者记录。
- 业务回归测试和视觉验收均通过。
- 未通过的页面不能以“主体完成”计入完成率。

## 11. 量化指标

| 指标 | 目标 |
| --- | ---: |
| 按钮、链接、表单控件共享组件使用率 | `>= 95%` |
| 弹窗、提示、状态、加载共享组件使用率 | `>= 95%` |
| 表格、筛选、分页共享组件使用率 | `>= 90%` |
| 页面壳、标题、工具栏、间距共享组件使用率 | `>= 90%` |
| 业务组合视觉复用率 | `>= 80%` |
| 全站综合组件实例复用率 | `>= 85%` |
| 新增 page-local 通用控件 | `0` |
| 新增第二图标库或手绘界面 SVG | `0` |
| 未记录的 legacy 兼容层 | `0` |

## 12. 已确认的冻结决定

1. 使用 `61 个独立页面组件` 作为全量重构口径，`37 + N` 作为主导航口径。
2. 先创建并推送 Git 前端 archive 分支，再删除或重写任何旧页面。
3. 保留 114 个新 UI 组件和业务能力，旧页面样式、DOM、组件外观、排版与布局全部淘汰。
4. 先完成 R1 公共组件独立化，再进入 61 个页面的完整重写。
5. 支付、操练场、监控、账号管理和设置页按完整业务批次迁移，不做机械换皮。
6. 移动端高密度数据继续采用可横向滚动列表/表格，而非卡片。
7. 按 R2 壳与认证、R3 用户核心、R4 支付、R5 工具、R6/R7 管理后台、R8 公共例外、R9 清理的顺序推进。
8. dark mode 与 reduced motion 保留为正式验收范围。
9. 全站旧前端视觉实现必须淘汰：可以删除的旧样式、旧组件、旧 DOM、旧排版和旧布局全部删除；Git archive 只用于回退，不作为新页面的视觉来源。

## 13. 最终交付物

- 统一后的 114 个共享组件及完整行为测试。
- 61 个独立页面组件的重构实现。
- 全站页面状态、数据格式和响应式规范。
- 更新后的 `UI.MD`、页面迁移清单和旧组件消费者报告。
- `/admin/ui-system` 真实组件验收页。
- 每个批次的三视口截图、测试报告和回归记录。
- 删除旧页面模板、旧布局、旧视觉组件、旧样式和重复实现；archive 分支作为唯一回退来源。

## 14. Definition of Done

全站前端重构只有在以下条件全部满足时才算完成：

1. 61 个独立页面均按本文完成；例外只能由主代理在 `docs/frontend-rebuild/exceptions.md` 记录原因、影响范围、审批人、创建批次、撤销条件和到期批次，并在每个批次 review 时复核。未记录或过期的例外不计入完成。
2. 所有有效业务信息、权限、状态机和数据语义保持完整。
3. 页面通过共享组件完成视觉和行为统一，不依赖局部复制样式。
4. 桌面、平板、手机、dark mode 和 reduced motion 均完成验收。
5. 全量测试、类型检查、ESLint、生产构建和真实浏览器主流程通过。
6. 旧页面模板、旧布局 DOM、旧纯视觉组件和旧页面样式已从生产代码删除；不得以兼容为由长期残留。
7. `UI.MD`、组件验收页和实际生产界面保持一致。
8. Git archive 分支可从远端检出并恢复重构前的完整前端。

### 14.1 批次提交与回滚门禁

- 每个 R 批次必须有独立提交，提交说明包含批次编号、页面/组件范围和验证命令。
- 批次提交前必须保存定向测试、全量测试、类型、Lint、构建和三视口截图索引；产物统一放在 `docs/frontend-rebuild/`。
- 批次验证失败时，只允许回退到最近一个已验收提交；不得使用 `git reset --hard`、不得覆盖其他任务改动、不得修改 archive 分支。
- 合并到 `ui/main` 前由主代理完成 diff 审查；未通过门禁的批次不得进入下一批次。

## 15. 长任务目标引导词

以下内容是本计划唯一、正式且完整的执行提示词。设置长任务目标时应原样完整使用，不得只截取其中一个阶段，也不得另建内容不一致的目标文档。该提示词已经纳入“旧前端只保留功能契约、视觉实现全部丢弃”的最新决定。

```text
目标：按照 /Users/qiu/Desktop/Sub2API/plan.md，完整重写 Sub2API 全部前端，并在不改变业务契约的前提下完成 61 个独立页面、公共组件、布局壳、领域组件视觉层、响应式与交互状态的全面重构。

一、执行基线

1. 开始前完整阅读：
   - /Users/qiu/Desktop/Sub2API/plan.md
   - /Users/qiu/Desktop/Sub2API/UI.MD
   - /Users/qiu/Desktop/Sub2API/AGENTS.md

2. 验证远端 Git 存档点：
   - branch: archive/frontend-before-full-rebuild-20260814
   - commit: 215adfaa4aa893488c53cd3853dae27c8847dc91
   - remote: origin / qiufengawa/sub2api

   若该存档点不存在或远端不可验证，必须先创建只包含前端基线的 archive 提交并推送，完成验证后才能开始任何删除或重写。

   长任务启动门禁：开始删除或重写前，必须实际验证 archive 分支、提交和远端指向；若任一项不可验证，先创建并推送只包含前端基线的 archive 提交，完成验证后才能继续。

   若存档分支、提交或远端引用不存在，执行者必须先创建只包含前端基线的存档提交并推送到 `origin`，然后重新验证三者；在验证完成前不得删除或重写任何生产前端文件。

3. 当前 archive 分支是旧前端唯一回退来源。不要覆盖、删除、force-push 或继续在该分支开发。

4. 在 ui/main 开发分支执行并整合全部后续前端重构，不再建立第二条并行前端开发线。工作区可能存在其他任务的改动，不得回退、覆盖或提交与本任务无关的修改。

二、重构定义

1. 这不是旧页面换肤，不是局部 CSS 优化，也不是在旧 DOM 外包一层新组件。

2. 旧页面只作为以下内容的功能参考：
   - 页面字段与操作。
   - API 调用与数据映射。
   - 权限、功能开关和路由行为。
   - 加载、空、错、成功、禁用和异常分支。
   - 轮询、取消、重试、缓存、持久化和第三方 SDK 生命周期。

   旧页面的截图、DOM、CSS、组件组合、间距、排版和信息布局均不属于参考基线；旧前端仅保留业务契约，任何旧视觉实现均不得保留。功能盘点完成后，应从新的页面职责和信息架构重新设计。

3. 以下旧视觉实现全部丢弃并重写：
   - 61 个页面的现有 template 视觉结构。
   - 页面级 style、旧 class 和响应式补丁。
   - AppLayout、AuthLayout、AppHeader、AppSidebar、TablePageLayout 的旧 DOM、排版和样式。
   - components/common 中只承担视觉职责的旧组件。
   - frontend/src/style.css 中服务于旧页面外观的按钮、输入框、卡片、弹窗、表格和布局规则。
   - 页面自定义的颜色、圆角、高度、阴影、图标容器和控件外观。

4. 以下能力保留并迁移到新实现：
   - 已确认的 114 个 Ui/App 组件和 UI design tokens；114 个组件必须全部完成独立化、统一令牌接入、状态覆盖、契约测试和验收页登记，并脱离旧视觉实现，不是原样保留旧组件。这里的“保留”只指保留业务契约和可复用目标。
   - API、store、composable、router、类型、i18n key 和权限判断。
   - 业务计算、校验、状态机、请求并发保护和持久化协议。
   - 支付、订阅、计费、调度、监控和第三方 SDK 行为。
   - 每个页面全部有效信息与功能。

5. 如果现有 Ui/App 组件能力不足，增强共享组件本身并补测试。不得恢复旧组件或在页面内复制一个新控件。

三、实施方式

1. 严格按照 plan.md 的 R0 至 R9 连续推进，不逐阶段等待确认。

2. 每个页面采用以下闭环：
   功能盘点 -> 新信息架构 -> 新页面模板 -> 接入业务逻辑 -> 状态补齐
   -> 自动化测试 -> 浏览器验收 -> 删除旧视觉实现 -> Code Review。

3. 页面只有在旧模板、旧视觉组件和旧页面样式已经删除后才算完成。

4. 临时适配器只能搬运行为，不能保留旧外观。适配器必须有消费者清单、测试和删除条件，并在 R9 前清理。

5. 优先完成 R1 公共组件独立化：
   - 让 UiDialog、UiConfirmDialog、UiDataTable、UiSelect、UiCombobox、UiDateRangePicker、UiTooltip、UiFieldHelp、UiSkeleton 等摆脱旧视觉实现。
   - 重建统一 overlay manager、table workspace、form、feedback、navigation 和 page shell。
   - 将领域组件的模板与样式改写为 Ui/App 组合，同时保留领域 API 和业务计算。
   - 删除无消费者的 common 纯视觉组件和旧全局样式。

6. R1 完成后按以下顺序重写页面：
   - R2：应用壳、认证、回调与初始化。
   - R3：Dashboard、Keys、Usage、Profile、Redeem、Affiliate、Key Usage。
   - R4：Subscriptions、Purchase、Orders 和完整支付流程。
   - R5：Model Plaza、Playground、Batch Image、Available Channels、Monitor、Custom Page。
   - R6：标准管理员工作台。
   - R7：Accounts、Ops、Channel Monitor、Settings、Risk Control、Prompt Audit 和支付后台。
   - R8：Home、Legal、404 和例外页面。
   - R9：删除旧实现、统一全站并完成最终验收。

7. 每个批次在 `ui/main` 形成独立提交，并在 `docs/frontend-rebuild/` 保存该批次的变更清单、测试结果和截图索引。批次失败时只回退到最近一个已验收提交，不得回退 archive 分支或覆盖其他任务改动。

四、设计约束

1. 使用已经确认的 UI 体系：米白背景、黑白主体、暖灰边界和克制语义色。

2. 控件按仓库硬约束使用 `36px` 默认、`32px` compact、`28px` dense；`24px` 仅用于表格行内图标操作和紧凑标签，`40px` 仅用于有明确触控理由的独立主操作。超过 `36px` 必须记录交互理由。

3. 禁止：
   - 卡片套卡片。
   - 为页面区块增加无意义外层容器。
   - 大面积渐变和彩色标题条。
   - 无意义编号、实现说明和面向开发者的垃圾文案。
   - 负字距或随 viewport 连续缩放字号。
   - 页面自行重定义共享组件的颜色、高度、圆角和焦点。

4. Lucide 是唯一界面图标来源，不新增第二图标库或手绘界面 SVG。

5. 独立工具图标可以有描边容器；关闭、编辑、勾、叉、校验和状态图标保持无框。绿色表示成功或确认，红色表示失败、取消或删除，黄色表示警告或等待。

6. 英文与普通数字使用 Inter/SF Pro/Segoe UI Latin stack；中英混排使用带中文 fallback 的 sans stack；JSON、API Key、模型 ID、端点和请求 ID 使用 SFMono/Cascadia/Roboto Mono 等宽栈；金额、额度、延迟、速度、比例和计数使用 tabular numbers，letter-spacing 固定为 `0`。

7. 首页可以有有意义的产品视觉和动画；认证页只保留认证任务；用户控制台以任务完成为中心；管理员控制台以数据扫描、比较和操作效率为中心。

8. 所有页面避免多层容器嵌套。用排版、间距、对齐、分隔线和全宽 section 建立层级。

9. 动效只使用 `opacity` 与 `transform`：hover/focus 100-140ms，tooltip 120-140ms 且位移不超过 2px，认证壳切换 140ms 交叉淡入，dialog 180ms，drawer/sheet 180-240ms。禁止动画 height/width/top/left/padding/margin；表格不逐行入场，实时图表不重复播放完整入场动画；reduced-motion 下移除非必要动画。

10. 桌面端首行展示主要指标与健康状态，toolbar 不得不可预测换行；平板先减少列数而非缩小字号；移动端保留表头与比较能力，sticky 列不能遮挡，键盘可能遮挡时 dialog 改为 sheet，并尊重 safe-area。

   普通页面最多保留三层可见 surface（页面、section/tool、overlay）；仅承载布局的 wrapper 不得拥有独立背景、边框、阴影或圆角。表格工具栏只承载搜索、筛选、批量、导出、刷新、列设置和创建等语义动作；数据单元格保持“一条主值 + 一条 metadata”，横向滚动区域必须可聚焦并有 accessible name。

11. 共享组件必须覆盖 light/dark、density、hover/active/focus/disabled/loading/invalid/readonly、长文本、三视口、键盘、accessible name 和 reduced-motion，并有单测与视觉 fixture。页面只可改变 width/grid/context spacing，禁止 `:deep()`、`!important` 或局部重定义共享颜色、高度、圆角、焦点和动效。

12. 认证页面强制复用 `AuthLayout`、`AuthFormPanel`、`AuthTextField` 的路由、行为和可访问性契约，并重写这些组件的 DOM/CSS 实现；相关路由保持持久 shell，只切换表单内容，不出现空白中间帧。

   共享组件必须使用语义 props 表达意图，不向页面暴露任意颜色、圆角、阴影或高度 props；页面不得通过 `:deep()`、`!important` 或局部 CSS 重定义共享状态。

五、功能保护

1. 不修改：
   - `backend/` 目录中的任何文件（包括源码、配置、迁移、测试、嵌入产物和文档）、数据库、后端配置、后端测试和 API 协议；本任务仅允许修改 `frontend/`、UI 文档、前端重构记录和必要的前端测试。
   - API URL、请求参数、响应字段和错误协议。
   - 权限、功能开关、菜单可见性和路由语义。
   - 计费、倍率、订阅、余额、订单、退款和支付状态机。
   - 调度、账号优先度和监控统计口径。
   - localStorage key、支付恢复快照和 query 深链协议。
   - `backend/cmd/server/VERSION`、`frontend/package.json` 的系统版本来源、任何版本号、tag、GitHub Release、GHCR 标签或线上发布元数据。

2. 支付必须作为完整交易流程迁移，保护订单恢复、续费实例、QR 轮询、WeChat resume token、Stripe popup、Airwallex 和第三方 SDK 生命周期。

3. Playground 必须保护用户隔离、session、generation token、AbortController、迟到 chunk、图片响应、滚动跟随和持久化。

4. Monitor V2 必须保护 query 状态、abort + sequence、自动刷新、soft-prune、矩阵缩放和平移。

5. Accounts 必须保护虚拟化、服务端排序、列设置、scheduler score、所有结果选择、自动刷新、行内优先度更新和失败回滚。

6. Settings 必须保护动态 schema、secret 保留语义、Provider 特有字段、callback URL 和保存 payload。

六、响应式与状态

1. 每个页面必须支持 1440px、900px、390px。

2. 移动端高密度数据继续使用可横向滚动的列表或表格，不转换为高大的卡片流。

3. 首次加载使用与最终布局同尺寸的骨架。加载过程中页面宽度、标题、工具栏和主要栅格不得收缩或跳动。

4. 局部刷新保留旧数据并使用局部 loading overlay，不清空页面。

5. 每个页面必须实现并验收：loading、empty、error、success、disabled、long text、large number、slow request。

6. 所有 overlay 必须处理安全区、虚拟键盘、滚动锁、焦点圈定、Esc 和关闭后焦点恢复。

7. dark mode 与 prefers-reduced-motion 是正式验收范围，不是可选增强项。

8. 每个正式页面默认使用一个 `AppPage` 和一个 `AppPageHeader`；例外必须在 `docs/frontend-rebuild/exceptions.md` 记录原因、审批人、创建批次、撤销条件和到期批次。未记录或过期的例外不计入完成。

七、代理协作

1. 按 AGENTS.md 使用子代理进行跨目录探索、页面功能盘点、独立核验和测试审计。

2. 主代理负责设计决策、核心实现、文件编辑、整合、最终 Code Review 和浏览器验收。

3. 子代理默认只做探索和核验，不得让多个代理同时修改同一文件。

4. 主代理不得长时间只监控一个代理；独立任务应并行推进，但任何共享文件修改必须由主代理统一完成。

八、验收门禁

1. 每完成一个实施批次，立即执行定向测试、Code Review 和真实浏览器验收，发现问题直接修复后继续。

2. 每个页面必须满足：
   - 首屏明确主要任务、关键状态和下一步操作。
   - 原有全部有效字段、操作、权限和异常分支仍可使用。
   - 无旧页面 DOM、旧视觉 class 或旧页面控件样式残留。
   - 无卡片嵌套、遮挡、重叠和页面级横向溢出。
   - 表格在桌面和手机均保持比较能力。
   - 键盘操作、焦点顺序和 accessible name 正确。
   - 浏览器控制台没有本轮引入的 error 或 warning。

3. 最终执行：
   cd /Users/qiu/Desktop/Sub2API/frontend
   pnpm run test:run
   pnpm run typecheck
   pnpm run lint:check
   pnpm run build
   cd /Users/qiu/Desktop/Sub2API
   git diff --check

4. 最终扫描：
   - 旧 common 纯视觉组件消费者。
   - 旧全局 CSS 和旧页面 class。
   - 直接 Ui 文件路径导入。
   - 第二图标库和手绘界面 SVG。
   - 重复控件、硬编码颜色、控件高度、圆角和 overlay z-index。

九、最终报告

完成后必须报告：

1. 实际完成的页面数量和组件数量。
2. 每个 R0-R9 批次的完成状态。
3. 删除的旧页面模板、布局、组件和样式。
4. 保留的领域逻辑、临时例外及原因。
5. 自动化测试、TypeScript、ESLint 和生产构建结果。
6. 1440px、900px、390px 浏览器验收结果。
7. dark mode、reduced motion、键盘与无障碍验收结果。
8. 最终 Code Review 结论和剩余风险。
9. archive 分支和恢复方式。

十、停止条件

1. 只有完成 plan.md Definition of Done 后，才能把目标标记为完成。

2. 遇到问题应先自行排查和修复，不因任务规模大、耗时长或测试多而提前停止。

3. 完成实现、测试、Code Review 和浏览器验收后停止。

4. 不创建 GitHub Release，不修改 `backend/cmd/server/VERSION`、`frontend/package.json` 的系统版本来源、任何版本号/tag/package 版本元数据，不发布线上更新，等待单独发布指令。
```
