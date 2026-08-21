# Sub2API 前端 R0-R9 全量重构、验收与发布闭环计划

## 0. 文档定位与唯一目标

- 本文件是根目录唯一的前端重构执行计划。
- `UI.MD` 是组件目录、设计令牌和组件契约的权威来源。
- `docs/FRONTEND_DESIGN_GUIDELINES.md` 是页面职责、控件密度和认证页面约束的权威来源。
- 本计划覆盖 R0-R9 的基线、公共组件、布局壳、用户页面、管理员页面、状态、响应式、最终清理、发布和线上更新验证。
- “组件已实现”不等于“业务页面已迁移”。只有完成消费者迁移、状态测试和浏览器验收，批次才可标记完成。
- R0-R9 是一个不可拆分、不可中途交付的唯一目标。R 编号只是执行顺序和进度标签，不是可独立停止、交付或发布的子目标。
- 任一 R 完成、定向测试通过、全量门禁通过、验收文档完成或阶段性提交，都不得触发停止、询问确认或发布；必须立即继续下一个未完成 R。
- 唯一停止条件：R0-R9 全部完成，最终 Code Review 通过，版本与发布门禁通过，GitHub Release/下载产物/checksum/GHCR/latest/旧版本更新发现/线上更新验证全部完成并记录。
- 目标执行协议：本计划必须由一个唯一的长任务目标连续执行；不得为 R0-R9、浏览器验收、Code Review 或发布分别创建/完成独立目标。恢复任务时先读取当前目标状态、工作区归属和本节未完成清单，从第一个未闭环项继续；只有最终发布闭环证据全部写入 `docs/frontend-rebuild/` 后，才可将唯一目标标记为 `complete`。
- 当前状态：R0-R9 尚未全部完成；本文件是唯一长任务执行总纲，不能据此宣称已完成或允许发布。

### 2026-08-20 继续执行快照

- 可信 Chromium 已补齐公开/认证路由的三视口布局、标题/H1、Tab 首焦点、reduced-motion 及部分 dark 证据；详见 `docs/frontend-rebuild/R9-PUBLIC-AUTH-BROWSER-EVIDENCE-20260820.md`。
- 该证据不关闭后端未启动造成的真实 console 500、受保护页面完整矩阵、screen-reader、provider sandbox、ownership、CI/Security、版本基线和 Release/GHCR/update 门禁。
- 继续保持唯一目标 active；禁止修改 VERSION、tag、Release、GHCR 或发布元数据，直到上述前置门禁全部关闭。

### 2026-08-20 发布闭环复验

- 官方 upstream 最新稳定版已更新为 `v0.1.179`；当前 HEAD 在该 tag 之后，
  因此 `v0.1.179-qiu.2` 符合整数 Qiu revision 规则。
- Release tag `v0.1.179-qiu.2` 和 `backend/cmd/server/VERSION` 已统一到
  `b557c7600` / `0.1.179-qiu.2`；随后推送的证据提交为
  `67942a6ab`。Release workflow `32401866123`、tag CI `32401866253` 和
  Security Scan `32401866174` 全部成功。
- GitHub Release、五个平台归档、`checksums.txt`、GHCR version/latest 同一
  digest，以及旧版和当前版本的强制更新检查证据已记录在
  `docs/frontend-rebuild/RELEASE-VERIFICATION-20260820.md`。
- 发布闭环已关闭，但 R0-R9 的受保护页面完整浏览器矩阵、screen-reader、
  provider sandbox、破坏性操作和最终 Code Review 仍未完成；唯一长任务继续
  active，不得宣称总目标完成。

### 0.1 全量闭环状态机

```text
R0 基线与存档
  -> R1 公共组件消费者迁移
  -> R2 应用壳与认证
  -> R3 用户核心工作区
  -> R4 订阅、订单与支付
  -> R5 用户开发工作区
  -> R6 标准管理员工作台
  -> R7 复杂管理员与运维
  -> R8 公共与例外页面
  -> R9 删除旧实现与全站审计
  -> 最终自动化/浏览器/无障碍/Code Review
  -> 版本策略与发布
  -> Release/产物/checksum/GHCR/latest 验证
  -> 旧版本更新发现与线上更新验证
  -> 唯一完成点
```

阶段性结果必须写入执行日志，但不得把阶段性结果当作最终交付；发生普通测试或实现失败时应定位、修复、复验并继续，只有真实的后端/业务契约阻塞才可记录为阻塞，且仍需推进不依赖该阻塞的工作。

## 1. 目标与边界

### 1.1 最终目标

在不改变后端协议和业务语义的前提下，完成一套统一的 Sub2API 前端：

1. 全部页面使用统一的米白背景、黑白主体、暖灰边界和克制语义色。
2. 114 个 Ui/App 公共组件具备明确语义 API、统一令牌、完整状态和契约测试。
3. 用户端和管理员端页面全部脱离旧视觉模板、旧布局和旧通用控件。
4. 桌面端强调扫描、比较和重复操作效率；移动端保留列表/表格比较能力并通过受控横向滚动适配。
5. 所有页面的 loading、empty、error、success、disabled、slow request、long text、large number 状态完整可用。
6. 通过 TypeScript、ESLint、Vitest、生产构建、真实浏览器和最终 Code Review 门禁后才允许进入发布流程。

### 1.2 允许修改

- `frontend/` 下页面、领域组件、公共组件、样式令牌、前端测试和前端重构文档。
- `UI.MD`、`docs/FRONTEND_DESIGN_GUIDELINES.md` 及 `docs/frontend-rebuild/` 中与本计划直接相关的文档。
- 为保留业务行为所需的前端适配器、fixture 和测试。

### 1.3 禁止修改

- `backend/` 源码、配置、迁移、测试、嵌入产物和后端文档。
- 数据库、API URL、请求参数、响应字段、权限、路由语义和功能开关。
- 计费、倍率、订阅、余额、订单、支付状态机、调度和监控统计口径。
- localStorage key、支付恢复快照、query 深链协议和第三方 SDK 生命周期。
- `backend/cmd/server/VERSION`、版本号、tag、GitHub Release、GHCR 标签和部署元数据。
- 不得回退、覆盖或清理其他线程的未提交修改。

## 2. Git 存档与工作区规则

### 2.1 唯一回退点

- 分支：`archive/frontend-before-full-rebuild-20260814`
- 提交：`215adfaa4aa893488c53cd3853dae27c8847dc91`
- 远端：`origin` / `qiufengawa/sub2api`

开始任何删除或大规模重写前必须验证分支、提交和远端指向。存档分支只用于回退，不在其上开发，也不得 force-push。

### 2.2 当前开发线

- 只在 `ui/main` 继续整合。
- 每个可独立验收批次使用独立提交。
- 工作区存在无关改动时，只提交本批次明确拥有的文件；不能整体提交。
- 不启动服务、不访问其他端口进行验收，除非任务明确要求且端口属于本地目标。

## 3. 设计与实现硬约束

### 3.1 组件与图标

- 所有通用控件从 `@/components/ui` 公共出口导入。
- Lucide 是唯一界面图标来源，统一通过 `components/icons/Icon.vue` 使用。
- 禁止新增手绘界面 SVG、第二图标库、UCloud 图标和页面级复制控件。
- 页面不得通过 `:deep()`、`!important` 或局部 CSS 重定义共享组件颜色、高度、圆角、focus、disabled 和 motion。
- 领域组件保留业务 API，但内部只能组合 Ui/App 组件；旧 common 纯视觉组件必须在 R9 前删除。

### 3.2 视觉令牌

- 页面背景：米白；工作面：白色；分区：暖灰；主体文字：黑色；蓝色仅用于链接、focus 和信息状态。
- 成功使用绿色，警告使用黄色，失败/危险使用红色，未知使用灰色。
- 中文/英文使用统一 sans 字体栈；模型 ID、API Key、端点、请求 ID、JSON 使用等宽字体。
- 金额、百分比、延迟、速度、Token 和计数使用 tabular numbers；letter-spacing 固定为 0。
- 禁止无意义编号、垃圾说明文案、大面积渐变和彩色标题条。
- 禁止卡片套卡片；页面、section/tool、overlay 最多三层可见 surface。

### 3.3 控件密度

- mini：24px，仅表格行内图标操作和紧凑标签。
- dense：28px，运维表格和高密度列表。
- compact：32px，认证、表单、对话框。
- default：36px，一般页面操作。
- large：40px，仅有明确触控理由的独立主操作。
- 同一表单的输入、选择和相邻按钮必须同高。
- 新增控件不得超过 36px；超过时必须在例外文档记录触控理由和撤销条件。

### 3.4 动效与无障碍

- hover/focus：100-140ms。
- tooltip/popover：120-140ms，位移不超过 2px。
- dialog：180ms；drawer/sheet：180-240ms。
- 只动画 opacity 和 transform；不动画 height、width、top、left、padding、margin。
- reduced-motion 下禁用非必要动画。
- 所有 icon-only 操作必须有 accessible name；overlay 必须支持 Esc、焦点圈定、滚动锁和关闭后焦点恢复。
- 所有正式页面必须通过 1440px、900px、390px，light/dark、keyboard 和 reduced-motion 验收。

## 4. 页面与组件范围

### 4.1 页面数量口径

| 分类 | 数量 | 说明 |
| --- | ---: | --- |
| 独立生产页面 | 61 | 公共、认证、用户、管理员、支付和系统页面 |
| 生产路由记录 | 66 | 含重定向、认证父壳和 404 |
| 静态主导航入口 | 37 | 用户侧 14、管理员侧 23 |
| 动态自定义页模板 | 1 | `/custom/:id`，菜单实例数量不重复计数 |
| UI 验收页 | 1 | `/admin/ui-system`，不计入业务页面 |
| 开发预览页 | 1 | `/ui-system-preview`，仅开发环境 |

### 4.2 共享页面入口

`/keys`、`/playground`、`/batch-image`、`/usage`、`/available-channels`、`/model-plaza`、`/monitor`、`/subscriptions`、`/purchase`、`/orders`、`/redeem`、`/affiliate`、`/profile`。

管理员 Dashboard 与用户 Dashboard 职责不同，不合并为一个页面。

### 4.3 页面必须使用的结构

正式页面默认：

```text
AppPage
├── AppPageHeader
├── AppToolbar / UiFilterBar（需要时）
├── 主工作区（UiServerTableWorkspace、AppSection、AppGrid 等）
├── loading / empty / error / success 状态
└── UiDialog / UiDrawer / UiSheet（需要时）
```

例外必须写入 `docs/frontend-rebuild/exceptions.md`，包含原因、影响、创建批次、撤销条件和到期批次。

## 5.0 R0 基线、存档与行为契约冻结

### 必须完成

- 验证当前分支为 `ui/main`，确认唯一回退点分支和提交与第 2 节一致。
- 盘点 61 个独立生产页面、66 个路由记录、37 个主导航入口和 114 个 Ui/App 组件的当前消费者、路由权限、数据契约和测试覆盖。
- 为每个页面建立“主任务—信息层级—组件—状态—行为保护—浏览器证据”记录；旧 DOM、CSS 和视觉仅作为业务契约参考。
- 建立工作区隔离清单，保护其他线程未提交修改；不得访问不属于本任务的本地服务或端口。
- 在开始删除旧实现前确认可从存档点回退，并在 `docs/frontend-rebuild/` 记录基线。

### R0 完成标准

基线清单、回退验证、行为契约清单、测试基线和工作区隔离记录齐全；这只是长任务的起点，完成 R0 后必须继续 R1，不得停止或发布。

## 5. R1 公共组件与兼容层收口

### 5.1 目标

完成 114 个 Ui/App 组件的实际消费者迁移，而不是只保留组件文件。

### 5.2 必须完成的组件组

| 组件组 | 组件 | 必须覆盖 |
| --- | --- | --- |
| Actions | UiButton、UiIconButton、UiButtonGroup、UiLink | variant、density、loading、disabled、keyboard |
| Fields | UiTextField、UiPasswordField、UiTextArea、UiSelect、UiCombobox、UiSearchInput、UiNumberStepper | label、error、focus、long text、nullable value |
| Choices | UiCheckbox、UiRadioGroup、UiSwitch、UiSegmentedControl、UiMultiCombobox | aria、v-model、disabled、keyboard |
| Date/File | UiDateInput、UiDateRangePicker、UiDateTimeRangePicker、UiFileUpload | preset、timezone、file type、size、error |
| Feedback | UiAlert、UiToast、UiSnackbar、UiSpinner、UiSkeleton、UiEmptyState、UiErrorState、UiLoadingOverlay | stable geometry、aria-live、reduced motion |
| Data | UiDataTable、UiDataCell、UiSortableHeader、UiMobileTableScroller、UiPagination、UiFilterBar、UiColumnPicker | sort、selection、sticky、mobile scroll |
| Overlay | UiDialog、UiConfirmDialog、UiDrawer、UiSheet、UiPopover、UiTooltip、UiErrorDetailDialog | focus trap、Esc、scroll lock、restore focus |
| Layout | AppPage、AppPageHeader、AppSection、AppStack、AppInline、AppGrid、AppToolbar、AppSplitPane | stable shells、responsive tracks |
| Specialized | UiCodeBlock、UiDescriptionList、UiStatMetric、UiQuotaSummary、UiProgressBar、UiProgressRing、UiSaveBar、UiServerTableWorkspace、UiExportJob | operational pages and fixtures |

### 5.3 必须迁移的高风险旧消费者

- `PaymentProviderDialog.vue`：BaseDialog、HelpTooltip、Select。
- `AdminOrderTable.vue`：common DataTable/Select、原生 input/button。
- `UserErrorRequestsTable.vue`：common DataTable/EmptyState/Pagination。
- `SettingsView.vue`：ProxySelector、ImageUpload、原生 input/select/button。
- `KeysView.vue`：GroupBadge、GroupOptionItem、创建/编辑表单。
- `CreateAccountModal.vue`、`EditAccountModal.vue`：大面积原生字段、旧按钮、手写 SVG。
- `VersionBadge.vue`、`GroupSelector.vue`、`GroupCapacityBadge.vue`：旧 Tailwind、原生控件和手绘 SVG。

### 5.4 R1 完成标准

- A/B 类旧通用组件生产消费者归零。
- C 类领域组件的按钮、字段、弹窗、状态全部来自 UI 层。
- 每个兼容层都有消费者清单、契约测试和删除条件。
- `components/common` 纯视觉组件无生产消费者。
- `UI.MD` 更新实际消费者统计。
- R1 定向测试、全量测试、typecheck、lint、build 和浏览器三视口通过。

## 6. R2 应用壳与认证

### 范围

AppLayout、AppHeader、AppSidebar、AuthLayout、AuthFormPanel、AuthTextField、初始化向导、OAuth/邮箱回调、错误和加载骨架。

### 必须完成

- authenticated user/admin 壳层 1440/900/390 截图和交互验收。
- 刷新期间壳层尺寸稳定，骨架与最终布局同尺寸。
- sidebar 展开/折叠、移动端导航、active route、权限菜单、logo、版本和主题切换。
- 认证路由持久 shell，只切换表单内容，不出现空白中间帧。
- 登录、注册、验证、恢复、OAuth 回调的错误、loading、disabled 和 keyboard 状态完整。

### 完成标准

R2 应用壳验收记录更新为通过；无控制台错误、无横向溢出、无闪烁和焦点丢失。

## 7. R3 用户核心工作区

### 页面

Dashboard、Keys、公开 Key Usage、Usage、Profile、Redeem、Affiliate。

### 必须完成

- Keys 创建/编辑字段、分组选择、优先度、订阅组、密钥显示和错误状态全部迁移。
- Usage 与公开 Key Usage 的筛选、今天边界、表格横向滚动、缓存百分比标签和详情状态统一。
- Dashboard 指标、订阅、余额、用量、近期请求和空态层级稳定。
- Profile、Redeem、Affiliate 的表单、详情、错误、成功和移动端布局补齐。
- 保留 query 深链、分页、缓存和权限契约。

### 完成标准

R3 acceptance 文档不再写“进行中”；Keys、Key Usage、Redeem 通过浏览器三视口和 keyboard/dark/reduced-motion 门禁。

## 8. R4 订阅、订单与支付

### 页面/流程

Subscriptions、Purchase、Orders、Payment QR、Payment Result、Stripe、Airwallex、WeChat callback/resume、退款/恢复辅助流程、管理员订阅与订单。

### 必须完成

- 订阅实例、续费目标、有效期、周期额度、分组限制和扣费说明准确显示。
- 购买、订单状态、失败重试、取消、恢复和轮询状态完整。
- QR、Stripe popup、Airwallex、WeChat resume token 和 callback 生命周期不被重构破坏。
- admin subscriptions 与 admin orders 使用共享表格、筛选和确认弹窗。
- 移动端键盘遮挡时使用 sheet 或安全区布局。

### 完成标准

R4 acceptance 文档覆盖真实/fixture 交易状态；所有交易页面 1440/900/390、慢请求、失败重试和恢复路径通过。

## 9. R5 用户开发工作区

### 页面

Model Plaza、Playground、Batch Image、Available Channels、Monitor、Custom Page。

### 必须完成

- Model Plaza 桌面/手机保持列表比较能力，价格、倍率、模型 ID 不换成大卡片流。
- Playground 对话气泡、模型/分组选择、首字、耗时、速度、时间戳、流式中断、图片生成和请求错误。
- Batch Image 的上传、批量状态、预览和错误。
- Available Channels/Monitor 的筛选、刷新、健康状态、历史、窄屏表格和 abort/sequence。
- Custom Page 的安全 URL、加载、空态和错误。
- deep link、刷新和移动横向滚动通过。

## 10. R6 标准管理员工作台

### 页面组

Dashboard、Users、Groups、Channels、Accounts、Proxies、Usage、Orders、Payment Plans、Redeem/Promo、Announcements、Affiliate、Transfers、Audit Log、Risk Control、Settings 等标准管理员页面。

### 必须完成

- Users 已完成的模式扩展到其余标准页面。
- 所有列表统一 UiServerTableWorkspace、UiFilterBar、UiPagination、UiBulkActionBar。
- 账号列表按调用优先度从高到低排序，数字可编辑且无上限，失败回滚。
- 监控、用户、订单和渠道页面保留信息密度，手机使用横向列表而非巨大卡片。
- 所有 destructive action 使用 UiConfirmDialog，保存使用 UiSaveBar/UiButton loading。

### 完成标准

R6 管理员 Affiliate、管理员 Dashboard 及各标准页面 browser gate 全部通过；权限、批量操作、错误和空态完整。

## 11. R7 复杂管理员与运维页面

### 页面

Accounts、Ops Dashboard、Channel Monitor、Settings、Risk Control、Prompt Audit、支付后台及其领域组件。

### 必须完成

- Accounts：虚拟化/分页、调度阈值、优先度、服务状态、测试、批量编辑、排序和失败回滚。
- Ops：图表从 CSS token 取色，主题变化可响应，指标/日志/错误详情统一。
- Channel Monitor：模板、历史、执行取消、自动刷新、状态矩阵、窄屏换行和详情弹窗。
- Settings：动态 schema、secret 保留、provider 特有字段、上传、保存 loading、局部错误；按设置域拆批迁移，不机械替换 12,000 行文件。
- Risk Control：图片 allowlist、模型过滤、API Key 状态、日志筛选和危险操作。
- Prompt Audit：事件表、配置状态、详情、风险解释、移动端横向表格和错误详情。
- 支付后台：Provider、订单、套餐、支付状态和确认流程统一。

### 完成标准

R7 Channel Monitor、Settings、Risk Control、Prompt Audit、Accounts、Ops 各自有定向测试和浏览器记录；不得用“测试通过但未浏览器验收”标记完成。

## 12. R8 公共与例外页面

### 页面

Home、Legal、404、初始化、公开 Model Plaza、公开 Key Usage 和例外页面。

### 必须完成

- 首页可使用产品动画和图片，但不出现开发垃圾文案。
- Legal/404 信息层级、链接、空态和错误状态统一。
- 公共页面与认证页面的 header/logo/字体/背景一致。
- 所有例外记录进入 `docs/frontend-rebuild/exceptions.md`。

### 完成标准

Home、Legal、404 acceptance 文档状态统一；公开页面三视口、dark、reduced-motion 和无障碍通过。

## 13. R9 删除旧实现与全站审计

### 删除范围

- 已迁移页面中的旧 template、旧页面 CSS、旧 Tailwind class 和响应式补丁。
- common 纯视觉组件、旧 BaseDialog/Select/DataTable/Pagination/EmptyState/Toggle/Input 等无消费者文件。
- `frontend/src/style.css` 中无消费者的旧 `.btn`、`.input`、`.card`、`.modal` 和旧表格规则。
- 手绘界面 SVG、重复图标库、旧颜色/高度/圆角和未记录 z-index。

### 必须扫描

- common 纯视觉组件直接消费者数为 0。
- 页面不直接导入 `@/components/ui/Ui*.vue`，统一从公共出口导入。
- 页面无通用原生 input/select/button/textarea，例外有文档和测试。
- 手绘界面 SVG 数为 0；数据可视化 SVG 除外。
- 旧 class、硬编码颜色、控制高度、圆角、shadow 和 overlay z-index 无未记录实例。
- `UI.MD` 的组件消费者统计与实际 grep 结果一致。

## 14. 每批实施闭环（不得作为停止点）

每个 R 批次必须按以下顺序执行。批次闭环只代表允许进入下一批，不代表本目标完成：

1. 读取本计划、UI.MD、设计指南和目标页面业务契约。
2. 建立文件/组件消费者清单和保留行为清单。
3. 设计信息架构和状态矩阵。
4. 主代理统一编辑；子代理只做独立探索、核验和测试审计。
5. 完成页面/组件实现并删除被替代视觉代码。
6. 添加/更新单测、契约测试和 UI fixture。
7. 运行定向测试、Code Review 和本地浏览器三视口验收。
8. 修复问题后运行全量测试、typecheck、lint、build 和 diff check。
9. 在 `docs/frontend-rebuild/` 写入变更清单、测试结果、截图索引和剩余风险。
10. 形成独立提交后立即进入下一批，不等待用户确认，不暂停长任务。

任何“继续”“阶段完成”“定向验收通过”的消息都只能更新执行日志；执行者必须读取下一项未完成清单并继续，直到第 0 节定义的唯一完成点。

## 15. 最终验收标准

### 自动化门禁

```bash
cd /Users/qiu/Desktop/Sub2API/frontend
pnpm run test:run
pnpm run typecheck
pnpm run lint:check
pnpm run build
cd /Users/qiu/Desktop/Sub2API
git diff --check
```

要求：全量测试 0 failed；TypeScript、ESLint、构建和 diff check 全部成功。

### 浏览器门禁

每个生产页面至少验证：

- 1440px：完整桌面布局、主要指标、toolbar、表格比较能力。
- 900px：平板/窄桌面布局、无不可预测换行。
- 390px：移动布局、无横向溢出；高密度数据保持表头和横向比较。
- light/dark：文字、边界、状态颜色和图表可读。
- reduced-motion：无非必要动画。
- keyboard：Tab 顺序、Enter/Space、Esc、焦点恢复和可见 focus ring。
- slow request/loading：骨架尺寸稳定，旧数据不被无意义清空。
- empty/error/success/disabled：每个页面均有可操作反馈。
- browser console：本轮引入的 error/warning 为 0。

### 功能门禁

- API 参数、响应、权限、计费、订阅、订单、支付、调度、监控统计和持久化协议与基线一致。
- 账号优先度、模型分组、订阅额度、扣费和支付恢复链路无行为回归。
- Playground 流式/图片、Monitor abort/sequence、Accounts 批量/虚拟化、Settings secret 保留均通过行为测试。
- 每个临时适配器都有删除条件；R9 结束时已删除或记录正式例外。

## 16. 发布前 Code Review

Review 必须按严重度记录：

1. 业务回归：API、权限、支付、订阅、调度、监控、持久化。
2. 页面状态：loading、empty、error、slow request、retry、disabled。
3. 响应式：1440/900/390 溢出、遮挡、sticky、键盘安全区。
4. 组件契约：density、aria、focus、keyboard、reduced-motion、dark。
5. 视觉残留：旧 class、旧组件、手绘 SVG、硬编码颜色/高度/圆角。
6. 性能：首屏、bundle、虚拟化、重复请求和取消。
7. 文档：UI.MD 统计、例外记录、批次 acceptance 和截图索引。

存在未解决的 P0/P1、任一自动化门禁失败、任一核心页面浏览器门禁未完成时，不得发布。

## 16.1 最终发布与线上更新闭环

只有 R0-R9、最终门禁和 Code Review 全部通过后，才允许进入本节；发布不是另一个可选任务，而是本唯一目标的最后一段。

1. 读取并遵守 `docs/RELEASE_VERSION_POLICY.md`，确认官方稳定基线和整数格式 `v<upstream-major>.<upstream-minor>.<upstream-patch>-qiu.<positive-integer>`。
2. 验证旧版更新解析器能够发现并比较候选版本；若旧版不能发现，先修复兼容的发布元数据/更新实现并重新验证。
3. 执行前端门禁、版本构建、Release workflow、actionlint（如适用）和工作区 diff 检查；只提交本目标拥有的文件。
4. 推送 `ui/main`、版本 tag，监控 GitHub Actions 完成；不得把 draft/prerelease 当作发布完成。
5. 验证 GitHub Release 非 draft、非 prerelease；Linux AMD64/ARM64、macOS AMD64/ARM64、Windows AMD64、checksums.txt 均存在且 SHA-256 一致。
6. 验证 GHCR 版本 tag 与 `latest` 指向同一 digest，并验证 GitHub `releases/latest` 返回该版本。
7. 使用旧版候选环境执行一次更新发现/比较/下载路径验证，再用新版本执行线上更新检查；记录版本、响应、产物和结果。
8. 将发布、产物、checksum、GHCR、latest、旧版发现和线上更新证据写入 `docs/frontend-rebuild/`。

任一产物缺失、checksum 不一致、GHCR digest 不一致、旧版无法发现或线上更新未验证，均不得停止，不得宣称发布完成；修复后重新执行本节。

## 17. 当前未完成清单

截至 2026-08-20，静态迁移、部分真实 Chromium 基础矩阵和发布闭环已关闭；以下仍是 R0-R9 未闭环项：

- R1/R9：静态迁移、114 个公共 contract、276 个 production consumer files、1883 个 runtime references、旧兼容层和 AST 审计已完成；仅正式 `exceptions.md` 项的真实三视口/主题/reduced-motion/keyboard 与 screen-reader 复核。
- R2：受保护 AppLayout/Auth shell 的完整 overlay、权限菜单、键盘焦点恢复、screen-reader 和 console 矩阵；基础页面三视口证据已部分复验。
- R3：Redeem 成功兑换与失败/导出/破坏性操作、外部 email/TOTP/passkey 和 screen-reader；Keys/Key Usage 基础三视口证据已完成。
- R4：真实 Stripe/WeChat/Airwallex sandbox、callback/result、双标签外部回跳、退款/取消/Storage 拒绝路径；`/admin/orders/plans` 浏览器验收仍未完成。
- R5：Playground SSE/image/provider sandbox；Batch Image 并发/取消/破坏性操作；Available Channels/Monitor 完整失败矩阵；Custom Page iframe/provider sandbox/destructive；screen-reader；retry payload 的后端契约仍阻塞（item API 只有可能截断的 `prompt_preview`，缺少完整 prompt、reference images、output count、aspect ratio）。
- R6/R7：未覆盖管理员路由（audit logs、redeem codes、payment plans、channel monitor state/history 等）的三视口/主题/keyboard/console；真实 mutation、slow/error 状态和 screen-reader。`ProxiesView` 单条/批量删除的 pending/single-flight 与失败重试上下文已关闭；已验证路由的基础证据不再重复列为 pending。
- R8：public settings 后端成功/空/慢/失败 console-clean；剩余公共/例外路由及 admin exception routes；screen-reader/provider/OAuth。
- 全局剩余门禁：最终 ownership/Code Review 口径、受保护页面完整浏览器矩阵、screen-reader、provider sandbox、破坏性操作和未覆盖路由的 slow/error/console 证据。Release、六平台 checksum、GHCR/latest、旧版 updater 发现/比较和新版本线上检查已由 `RELEASE-VERIFICATION-20260820.md` 关闭。

### 2026-08-21 继续执行后的当前状态与未完成清单

- 本轮真实 Chromium 证据已把用户端 `19` 条路由（`171` 组合）和管理员
  `24` 个路由标签（`216` 组合）固化到三视口 `1440/900/390`、light/dark、
  reduced-motion、ARIA snapshot、Tab 轨迹和 console/request 捕获。用户矩阵为
  `0` overflow、navigation error、console/pageerror、failed request；管理员矩阵为
  `0` overflow、navigation error、console、unexpected pageerror、failed request。
  Risk Control/Prompt Audit 另以 feature-enabled fixture 精确复验 `18` 组合。
- 管理员原始矩阵的邮件预览 sandbox 保留 `3537` 条预期
  `SecurityError`；这属于 iframe 安全边界，不通过放宽 `allow-same-origin` 来“清零”。
  `/admin/backups` 是历史标签而非生产路由，Backup 已按 Settings 内嵌面板完成 step-up、
  创建轮询和删除确认证据。
- 本轮源码修复为 `AppHeader` 长标题 flex 约束、Channels 缺失 `UiTabs` 导入、
  accounts `expired` 中英文 locale，以及 Accounts 初始列表拒绝的 catch/toast；UI
  consumer inventory 因真实导入修复更新为 `114 / 276 / 1884`。定向测试、全量
  Vitest（`359` files / `2431` tests）、
  static audit（`13` tests）、typecheck、lint、生产 build 和 `git diff --check` 已复验；
  backend routes/service/repository 选定包也已复验通过。
- 本地 provider fixture 和隔离数据库 webhook/refund 证据已写入
  `docs/frontend-rebuild/R2-R8-CONTINUATION-20260821.md` 及其
  `evidence/20260821/` 索引；它们不冒充外部 Stripe/WeChat/Airwallex 凭据或真实结算。
- 新增 `admin-state-matrix-summary.json`：8 个高优先级管理员路由在
  `1440×1000/390×844` 下各跑 empty/slow/error，48 个 page-specific 请求全部被
  fixture 控制；0 overflow/navigation/failed request。Ops 的 snapshot 失败会回退到
  split endpoints；Accounts 初始列表拒绝已补 catch、错误 toast 和回归测试，避免真实
  Chromium 的 unhandled pageerror；同时清理首载 `lite` 参数并用 sequence token 防止
  乱序加载污染。该矩阵仍把 fixture 503 的 console/pageerror 计入，
  不扩大为 console-clean。
- `keyboard-overlay-summary.json` 另以 `390×844` dark/reduced-motion 真实验证
  10 个管理员/用户入口的 Enter、Space、Escape 和 focus-return，10/10 全部通过且
  无 console/pageerror；这仍是代表性 overlay 证据，不替代原生 screen-reader。
- `payment-double-tab.json` 在同一真实 Chromium context 复验两页支付恢复：A 完成后
  仅清除 A 的 scoped token，B 的 token/兼容 alias 保留。credentialed 外部回跳仍开放，
  但本地双标签存储竞态已有可复核 fixture。
- `admin-state-remaining-summary.json` 为 Users/Groups/Announcements/Channels pricing/
  Usage/Affiliate records/Orders 等 10 个额外管理员路由补充 60 个 empty/slow/error
  组合；54 个 page-specific 请求被控制且 0 overflow/navigation/failed request，Dashboard
  的 6 个 feature-guard 组合单独保留，不冒充状态覆盖。
- 仍未完成：原生 screen-reader（当前环境无 VoiceOver/NVDA 可控会话）；credentialed
  external provider settlement/refund、双标签外部回跳；逐页 slow/empty/error/late-response
  状态矩阵；剩余例外页面的完整 Enter/Space/Escape/focus-return 读屏证据；最终按严重度签署
  Code Review。唯一长任务保持 active，不得标记完成。

## 18. 执行日志

### 2026-08-20 ProxiesView 破坏性删除防重入收口

- `ProxiesView` 单条和批量删除确认现在传递 `UiConfirmDialog.pending`，入口使用 single-flight guard，并在请求期间锁定取消、Esc 和重复确认。
- 删除目标使用稳定快照；失败保留确认上下文/选择状态，成功后才关闭对话框并刷新列表。
- 新增 3 个 deferred/rejection 回归用例；专项 `ProxiesView` 为 7 tests，隔离树全量为 356 files / 2403 tests。
- 隔离树静态审计 13 tests、typecheck、lint、生产构建（3103 modules）和 `git diff --check` 全部通过。screen-reader、provider/destructive-action 真实浏览器、远端 CI/Security、版本与发布门禁仍开放。

### 2026-08-20 管理员退款目标竞态收口

- `AdminOrdersView` 退款入口在 pending 时锁定；父级以稳定订单 ID/request ID 校验响应，晚到响应不会关闭或污染另一订单的退款上下文。
- `AdminRefundDialog` 同时监听可见状态和订单 ID；订单切换时重置金额、原因、扣余额和 force 表单，避免沿用上一订单输入。
- 新增跨订单 deferred 响应与表单重置回归；管理员订单/退款专项共 18 tests 通过。隔离树全量门禁更新为 356 files / 2405 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。
- 真实支付 provider、双标签回跳、screen-reader、远端 CI/Security、版本与发布门禁仍开放。

### 2026-08-20 Keys 重置操作失败恢复收口

- `KeysView` quota/rate-limit reset 不再在请求开始时关闭确认框；两个操作均使用 pending/single-flight guard，失败保留确认上下文，成功后才关闭。
- 新增重复提交、pending 和失败重试回归；Keys 专项 30 tests 通过。隔离树全量门禁更新为 356 files / 2407 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。
- 真实 screen-reader/provider、支付回调、远端 CI/Security、版本与发布门禁仍开放。

### 2026-08-20 Channels 删除失败恢复收口

- `ChannelsView` 删除确认增加 pending/single-flight guard，失败保留确认上下文，成功后才关闭并刷新列表。
- 新增删除重复提交与失败恢复回归；Channels 专项 3 tests 通过。隔离树全量门禁更新为 356 files / 2408 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。
- 管理员用户删除缺少后端 step-up 属于禁止修改的 backend 安全契约范围，已记录为外部发布风险，不在本轮前端改动中绕过。

### 2026-08-20 Groups 删除失败恢复收口

- `GroupsView` 删除确认增加 pending/single-flight guard，并在请求前捕获不可变目标；失败保留确认上下文，成功后才关闭并刷新列表。
- 新增重复删除、pending 与失败恢复回归；Groups 专项 5 tests 通过。隔离树全量门禁更新为 356 files / 2409 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。
- Composite 路由加载/删除的跨组 stale response 已通过请求 token、目标快照和关闭失效保护收口；真实 screen-reader/provider、远端 CI/Security、版本与发布门禁仍开放。

### 2026-08-20 Composite 路由竞态收口

- `GroupsView` Composite 路由列表请求以单调 request ID 绑定当前分组和打开状态，旧分组响应不会覆盖当前分组或关闭后的状态。
- Composite 路由删除捕获 group/route ID，增加 single-flight guard，晚到响应不会清理新分组上下文。
- 新增跨分组 deferred load 与重复删除回归；Groups 专项 7 tests 通过。隔离树全量门禁更新为 356 files / 2411 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。

### 2026-08-20 用户订单退款上下文竞态收口

- `UserOrdersView` 退款提交期间禁止关闭或切换订单；请求使用不可变订单/原因快照，完成时只清理仍匹配原订单的上下文。
- 新增订单 A pending 后切换到订单 B 的 deferred 回归，确认 A 完成不会清空 B 的退款目标或原因；用户订单专项 7 tests 通过。
- 隔离树全量门禁更新为 356 files / 2412 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。公告保存会话锁定留作后续独立批次。

### 2026-08-20 Backup 列表乱序响应收口

- `BackupView.loadBackups` 增加单调 request ID；旧请求的成功或失败均不会覆盖较新的列表、error 或 loading 状态，卸载时同步使未完成请求失效。
- 新增挂载请求 A 与可见性刷新 B 乱序完成的 deferred 回归，确认 B 的运行中备份和轮询状态不被 A 覆盖；Backup 专项 10 tests 通过。
- 隔离树全量门禁更新为 356 files / 2413 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。

### 2026-08-20 公告保存会话竞态收口

- `AnnouncementsView` 保存期间锁定对话框关闭、取消和编辑目标切换；保存请求绑定单调编辑会话 ID，仅在会话和目标仍匹配时关闭/清空编辑器。
- 新增 deferred update 回归，覆盖保存中关闭/切换被拒绝及旧保存完成不清理新编辑上下文；Announcements 专项 10 tests 通过。
- 隔离树全量门禁更新为 356 files / 2414 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。

### 2026-08-20 管理员订阅 quota reset 收口

- 管理员 `SubscriptionsView` quota reset 确认框绑定 pending；执行期间拒绝重复提交和切换订阅目标，请求使用不可变目标 ID，失败保留确认上下文。
- 新增 deferred 成功、重复确认、目标切换与失败恢复回归；Subscriptions 专项 12 tests 通过。
- 隔离树全量门禁更新为 356 files / 2415 tests，静态审计 13 tests、typecheck、lint、生产构建和 diff-check 继续通过。

### 2026-08-18：公共控件与管理员订单表批次

- 已完成：
  - `AutoRefreshButton` -> `UiDropdownMenu` + `UiButton` + Lucide。
  - `ExportProgressDialog` -> `UiDialog` + `UiProgressBar` + `UiButton`。
  - `GroupCapacityBadge` 的手绘 SVG -> Lucide 图标。
  - Settings 全局保存、Gateway 三个局部保存动作 -> `UiButton` loading 契约。
  - Settings Gateway 的 529/429/stream timeout 数值字段和 action -> `UiTextField`、`UiSelect`，保留数值类型与保存 payload。
  - Settings Gateway 三个局部加载态 -> `UiSpinner`，保留稳定布局和 loading 语义。
  - Risk Control 审计试跑图片限制为 JPEG/PNG/WebP。
  - `AdminOrderTable` 搜索、筛选、表格、分页和行操作 -> 共享 UI 组件。
  - `UserErrorRequestsTable` 的表格、空态和分页 -> `UiDataTable`、`UiEmptyState`、`UiPagination`。
  - `PaymentProviderDialog` 的 Dialog、动态 Select 和 payment guide tooltip -> `UiDialog`、`UiSelect`、`UiTooltip`，保留 Provider 字段和保存 payload。
- 定向验收：AdminOrderTable 9 tests；Settings/Risk Control/容量相关 82 tests；均通过。
- 全量门禁基线：333 suites / 2211 tests、typecheck、lint、production build、diff check 均通过。
- 未完成：`AdminOrderTable` 外层旧 card/局部颜色仍需在后续页面壳批次收口；`PaymentProviderDialog` 的原生动态字段和局部旧 class，`KeysView` 及账户表单仍在 R1/R3 遗留清单中。

### 2026-08-18：账户、Keys、支付与领域弹窗收口批次

- 已完成：
  - `CreateAccountModal` 的 Antigravity upstream 与 Bedrock 凭据字段迁移至 `UiTextField` / `UiPasswordField`，保留 required、placeholder、等宽字体和创建 payload。
  - `GroupSelector` 搜索与多选迁移至 `UiSearchInput` / `UiCheckbox`；新增 `UiCheckbox.fullWidth` 契约与组件测试，保留平台过滤、混合调度和数组更新语义。
  - `EndpointPopover`、`UseKeyModal` 的手绘 UI SVG 替换为 Lucide；`UseKeyModal` 外层迁移至 `UiDialog` / `UiButton`，配置生成和页签状态未改。
  - `PaymentQRDialog`、`AdminOrderDetail` 迁移至共享 Dialog/Button/Spinner/Status 组件，保留二维码、轮询、取消、币种、退款和事件契约。
  - `AdminComplianceDialog`、`ErrorPassthroughRulesModal`、`TLSFingerprintProfilesModal`、`UserAttributesConfigModal`、`UserErrorDetailModal` 迁移至共享 overlay/feedback/action 组件。
  - `UserAttributeForm` 的文本、数字、日期、textarea、select、多选和 loading 全部迁移至共享 UI；`UiTextArea` 补齐原生 input 事件兼容。
- 定向验收：账户与 GroupSelector 116 tests；Keys/UseKey 31 tests；支付 50 tests；Accounts/Users 15 tests；用户属性与 UI primitives 18 tests；全部通过。
- 静态验收：本批次涉及文件的 typecheck 与 ESLint 通过；旧 A/B 类 common 视觉组件生产直接导入扫描为 0。
- 未完成：Settings 与账户弹窗的剩余原生字段/旧 Tailwind，品牌/模型图标策略，VersionBadge，领域 common 组件归档，以及 R2-R9 浏览器矩阵。

### 2026-08-18：账户池模式与版本徽章图标收口批次

- 已完成：
  - `CreateAccountModal` 与 `EditAccountModal` 的池模式重试次数、重试状态码输入统一迁移至 `UiTextField`，保留 `v-model.number`、边界值、默认值提示和双分支语义。
  - `CreateAccountModal` Gemini API Key、OAuth 高级选项、AI Studio 类型卡片中的 3 处手绘 SVG 替换为 `Icon`，保留禁用态、展开旋转动画和点击行为。
  - `VersionBadge` 的加载、检查、重启、更新、回滚、信息提示、Chevron 和 GitHub 图标全部改用共享 `Icon`；删除该组件内全部内联手绘 SVG，品牌图标也统一走图标映射。
- 定向验收：账户弹窗 4 个套件共 92 tests；`AppSidebar` 15 tests；相关 ESLint、vue-tsc 与 `git diff --check` 通过。
- 仍未完成：账户平台专属原生控件、Settings 大型分域迁移、VersionBadge 的旧按钮/旧 class、PlatformIcon/ModelIcon 品牌资源策略，以及 R2-R9 浏览器矩阵。

### 2026-08-18：Settings Rectifier 分域迁移批次

- 已完成：
  - Settings 的 API Key Signature Rectifier 自定义 pattern 行迁移至 `UiTextField`。
  - pattern 删除使用 `UiIconButton` + Lucide `x`，新增 pattern 使用紧凑 `UiButton`，保存动作使用共享 loading Button。
  - 保留 `rectifierForm` 的数组增删、保存 payload、启用条件和原有 Toggle 语义。
- 定向验收：`SettingsView.spec.ts` 36 tests、`SettingsViewLayout.spec.ts` 1 test 全部通过；vue-tsc、ESLint 通过。
- 仍未完成：Settings 其余分域、账户平台专属控件、VersionBadge 旧按钮/旧 class、PlatformIcon/ModelIcon 品牌资源策略，以及 R2-R9 浏览器矩阵。

### 2026-08-18：账户调度开关控件批次

- 已完成：
  - Create/Edit 账户弹窗的 Antigravity `mixedScheduling` 和 `allowOverages` 开关迁移至 `UiCheckbox`，保留编辑态只读 disabled、提示文案和 `buildAntigravityExtra` 语义。
  - OpenAI endpoint capability 复选框暂保留原生输入：其“至少保留一个能力”的受控回写行为依赖原生事件对象，后续需先扩展 `UiCheckbox` 的受控拒绝/回写契约再迁移，避免改变业务行为。
- 定向验收：Create/Edit 账户 77 tests、vue-tsc、ESLint 通过。

### 2026-08-18：领域状态图标收口批次

- 已完成：
  - `GrokQuotaProbeCell` 的刷新/旋转图标迁移至共享 `Icon`，保留手动探测按钮、loading 禁用态和事件。
  - `UserConcurrencyCell` 的四格状态图标迁移至 Lucide `grid`，保留状态颜色和数值显示。
  - `AccountUsageCell` Gemini 配额帮助图标迁移至共享 `questionCircle`，保留悬浮说明层。
- 定向验收：相关账户、用户和 AccountsView 共 48 tests；vue-tsc、ESLint 通过。

### 2026-08-18：支付 Provider 动态字段图标批次

- 已完成：
  - `PaymentProviderDialog` 动态敏感字段的显隐图标统一走 Lucide `eye/eyeOff`。
  - 可展开限额区的 Chevron 统一走共享 `chevronDown`，保留旋转过渡和展开状态。
- 定向验收：PaymentProviderDialog 9 tests、vue-tsc、ESLint 通过。

### 2026-08-18：本轮全量门禁

- `pnpm run test:run`：334 suites / 2214 tests passed。
- `pnpm run typecheck`：通过。
- `pnpm run lint:check`：通过。
- `pnpm run build`：生产构建通过。
- `git diff --check`：通过。
- 仅保留既有非阻塞警告：Browserslist 数据过旧、lottie-web eval、动态/静态 import 同时存在、部分 chunk 超过 500KB、Settings 测试 router-link stub 警告；本轮未新增失败。

### 2026-08-18：R0-R9 单一长任务目标改写

- 将 R0 基线、R1-R9 实施、最终自动化/浏览器/无障碍门禁、Code Review、版本发布、产物校验、GHCR/latest、旧版更新发现和线上更新验证合并为一个不可拆分目标。
- 明确阶段完成、定向测试、构建和 acceptance 文档均不是停止点；只有第 0 节唯一完成点满足后才允许最终回复。
- 同步更新 `docs/FRONTEND_REFACTOR_GOAL_PROMPT.md` 和补充信息架构文档的执行口径；本次只修改计划文档，未修改业务代码、版本号、Release 或部署元数据。

### 2026-08-18：Settings Gateway 低风险分域迁移批次

- `SettingsView` 的 Upstream Billing Probe interval 字段迁移至 `UiTextField`，保留数值边界、`v-model.number`、Enter 保存和测试选择器。
- `SettingsView` 的 Ollama Cloud debounce/interval 字段迁移至 `UiTextField`，保存动作迁移至带 loading 的 `UiButton`，加载态迁移至 `UiSpinner`。
- 定向与全量验证：334 suites / 2214 tests、typecheck、lint 通过；`git diff --check` 通过。
- 仍未完成：Settings 其他分域、账户平台专属字段、Profile 子表单、Accounts/Ops 低风险原生按钮、R2-R9 页面和浏览器矩阵。

### 2026-08-18：Profile 基础与密码表单迁移批次

- `ProfileEditForm` 用户名字段迁移至 `UiTextField`，提交迁移至带 loading 的 `UiButton`。
- `ProfilePasswordForm` 三个密码字段迁移至 `UiPasswordField`，提交迁移至 `UiButton`；保留字段 ID、校验、API 调用、toast 和表单重置行为。
- 定向验收：ProfilePasswordForm/ProfileView 共 6 tests 通过；typecheck、lint 通过。
- 仍未完成：Profile Passkey/TOTP/余额通知卡片、Keys 自定义选择器、Settings 其余分域、R2-R9 页面和浏览器矩阵。

### 2026-08-18：管理员工作台行内动作收口批次

- `AccountsView` 代理 fallback 恢复动作迁移至紧凑 `UiButton`，保留原行数据和回滚处理器。
- `OpsErrorLogTable` 用户可点击身份动作迁移至 `UiButton` mini，保留 `userClick` 事件、阻止行点击和移动端表格行为。
- 定向验收：OpsErrorLogTable 7 tests 通过；本批次未修改 API、权限或表格分页/排序契约。
- 仍未完成：Accounts 其他 provider 专属字段、Ops 其余组件、Settings 分域、R2-R5/R7-R9 及浏览器矩阵。

### 2026-08-18：Edit Account Provider 字段迁移批次

- `EditAccountModal` upstream URL/API key、Vertex project ID、Bedrock credentials/API key/region 迁移至 `UiTextField` 与 `UiPasswordField`。
- 保留账号类型条件、密钥留空语义、readonly 项目字段、placeholder/description 和现有编辑 payload。
- 定向验收：`EditAccountModal.spec.ts` 49 tests 通过；typecheck、lint 通过。
- 仍未完成：Bedrock/调度/受控能力控件、Settings 其余分域、R2-R9 页面和浏览器矩阵。

### 2026-08-18：Create Account 字段迁移批次

- `CreateAccountModal` Antigravity/Vertex project ID、custom error code、Bedrock pool retry count/status codes 迁移至 `UiTextField`。
- 保留 Vertex 原生文件上传例外、拖拽/FileReader 语义、数值边界、Enter 处理和创建 payload。
- 定向验收：CreateAccountModal 32 tests 通过；typecheck、lint 通过。
- 仍未完成：账户平台选择卡、radio/checkbox 组、ProxySelector、Settings 其余分域、R2-R9 页面和浏览器矩阵。

### 2026-08-18：Profile Passkey 控件迁移批次

- `ProfilePasskeyCard` 的新增、编辑、删除、密码字段、loading 和操作按钮迁移至共享 `UiTextField`/`UiPasswordField`/`UiButton`/`UiSpinner`。
- 保留 WebAuthn 注册/删除 API、密码确认、错误 toast、空态和凭据列表排序行为。
- typecheck、lint 通过；Profile 相关回归测试保持通过。
- 仍未完成：TOTP 设置/禁用弹窗、余额通知卡片、Profile 浏览器证据、Settings 其余分域和 R2-R9。

### 2026-08-18：Profile TOTP 卡片控件批次

- `ProfileTotpCard` 启用/禁用按钮、加载指示器和安全状态图标迁移至共享 UI/Lucide。
- 保留 TOTP 状态 API、启用/禁用分支、弹窗事件和刷新逻辑；设置/禁用弹窗内部控件仍待后续批次。
- typecheck、lint 通过。

### 2026-08-18：Profile TOTP 禁用弹窗控件批次

- `TotpDisableDialog` 的警告图标、加载状态、邮箱验证码字段、发送验证码按钮、密码字段和底部操作按钮迁移至共享 `Icon`、`UiSpinner`、`UiTextField`、`UiPasswordField` 与 `UiButton`。
- 保留邮箱/密码双验证分支、验证码倒计时与卸载清理、提交 payload、toast 错误处理、遮罩关闭和表单提交行为；验证码六位输入等尚未迁移的自定义交互控件继续保持原生实现并记录为例外。
- 定向验收：TOTP timer cleanup 与 ProfileView 共 8 tests 通过；typecheck、lint 通过。
- 仍未完成：Profile 余额通知/账单偏好/身份绑定、Settings 其他分域、账户受控 checkbox/radio、R2-R9 页面、浏览器矩阵、最终 Code Review、Release 与线上更新验证。

### 2026-08-18：Settings Panel API Rate Limit 卡片迁移批次

- `SettingsView` Panel API Rate Limit 卡片的加载指示器、三个 RPM 数值字段和保存操作迁移至 `UiSpinner`、`UiTextField` 与带 loading 的 `UiButton`。
- 保留 `v-model.number`、0–100000 边界、原有 `data-testid`（数值字段通过 `test-id` 转发至真实 input）、开关条件渲染、保存 payload、成功/失败 toast 和 API 调用。
- 定向验收：SettingsView panel rate limit 用例通过；typecheck、lint 通过。
- 仍未完成：Settings Security/Captcha/Payment/Email 等分域、账号受控复选框/单选组、R2-R9 页面、浏览器矩阵、最终 Code Review、Release 与线上更新验证。

### 2026-08-18：Profile 账单偏好保存动作批次

- `ProfileBillingPreferenceSection` 保存操作迁移至紧凑 `UiButton`，保留四种原生 radio 的分组语义、dirty 判定、失败后重试、prop 同步、API payload 和 disabled 状态。
- 后续子批次将四种偏好选择迁移至 stacked `UiRadioGroup`，保留 `input[type=radio]`、name、选中值、dirty 与失败重试契约，并统一共享选择器密度。
- 定向验收：`ProfileBillingPreferenceSection.spec.ts` 2 tests 通过；typecheck、lint 通过。

### 2026-08-18：Profile 头像操作控件批次

- `ProfileAvatarCard` 保存/删除动作迁移至紧凑共享 `UiButton`，保存动作使用统一 loading 状态。
- 保留原生隐藏文件 input 与 label 触发器：其文件选择、压缩、预览、FileReader/canvas 和清空 value 行为依赖原生文件控件，不做机械替换。
- 定向验收：`ProfileAvatarCard.spec.ts` 4 tests 通过；typecheck、lint 通过。

### 2026-08-18：Profile 身份绑定控件批次

- `ProfileIdentityBindingsSection` 邮箱、验证码、密码字段迁移至 `UiTextField`/`UiPasswordField`，发送验证码、绑定/换绑、展开、第三方绑定与解绑动作迁移至 `UiButton`。
- 保留 LinuxDo/DingTalk/OIDC/WeChat 能力判定、邮箱换绑语义、验证码/密码 payload、动态 data-testid、解绑 loading、OAuth 跳转和用户状态回填。
- 定向验收：身份绑定与 ProfileView 共 20 tests 通过；typecheck、lint 通过。

### 2026-08-18：Profile 余额提醒基础控件批次

- `ProfileBalanceNotifyCard` 主开关迁移至 `UiSwitch`，阈值与新增邮箱字段迁移至紧凑 `UiTextField`，阈值保存与新增邮箱动作迁移至 `UiButton`。
- 为此前无组件级测试的卡片新增 3 个测试，覆盖开关更新、数值阈值 payload/真实 input test-id、待验证邮箱新增；保留异常回滚、邮箱验证倒计时和内联验证流程。
- 后续子批次继续将已保存/待验证邮箱的逐项开关、验证码字段、验证/重发/取消和删除动作迁移至 `UiSwitch`、mini `UiTextField`、quiet `UiButton` 与 danger `UiIconButton`；倒计时和验证状态机保持不变。
- 定向验收：余额提醒与 ProfileView 共 7 tests 通过；typecheck、lint 通过。

### 2026-08-18：用户 Dashboard 与 Usage 交互控件批次

- `UserDashboardGettingStarted` 的步骤链接、复制动作、可用模型入口与外部文档入口迁移至 `UiLink`/`UiButton`，保留复制内容、路由和外链安全属性。
- `UserDashboardCharts` 的 7/30 天选择迁移至键盘可导航 `UiSegmentedControl`，空态入口迁移至 `UiButton`；图表数据、比较口径和 range emit 保持不变。
- `UserDashboardModelBreakdown` 的详情/空态入口迁移至共享链接和按钮；`UsageRankingCard` tokens/actual cost 切换迁移至 `UiSegmentedControl`。
- 定向验收：Dashboard/Usage 23 tests、typecheck、lint 通过。

### 2026-08-18：Settings 调度阈值字段批次

- `SettingsView` 各平台账号调度阈值从自定义卡片+原生 number input 收口为 `UiTextField` 网格，保留 1–100 范围、整数步进、百分比后缀、平台键和值映射。
- OpenAI OAuth 调度参考倍率迁移至带 `x` 后缀的紧凑 `UiTextField`，保留测试选择器、required、最小值/步进、低倍率优先与实验调度模式条件显示。
- 定向验收：Settings rate-controls 用例通过；typecheck、lint 通过。

### 2026-08-18：Edit Account 受控设置控件批次

- 账号调度阈值覆盖开关/数值、OpenAI endpoint capabilities 和自定义 quota base URL 迁移至 `UiSwitch`、`UiTextField`、`UiCheckbox`。
- 扩展 `UiCheckbox` 的 `change(checked, nativeEvent)` 契约，使“至少保留一个 endpoint capability”可在拒绝取消时立即恢复真实 checkbox DOM，同时不破坏普通 `v-model`。
- 保留 1–100 阈值、凭据 patch/null 语义、OpenAI 最少一个能力规则、responses mode 回退、自定义 URL trim/payload 和全部 data-testid。
- 定向验收：UiCheckbox + EditAccountModal 共 61 tests 通过；typecheck、lint 通过。

### 2026-08-19：Create Account 受控设置控件批次

- `CreateAccountModal` OpenAI endpoint capabilities 迁移至受控 `UiCheckbox`，复用 `UiCheckbox.change` 原生事件契约。
- 保留创建页至少一个能力选中规则、responses mode 自动回退、payload 归一化和动态 data-testid；补充创建页回归用例。
- 定向验收：CreateAccountModal 与 Grok 专项共 33 tests 通过；typecheck、lint 通过。

### 2026-08-19：Settings 用户默认值与订阅默认项批次

- Settings Users/Defaults 区块的默认余额、并发、用户 RPM、订阅有效期字段迁移至紧凑 `UiTextField`；新增默认订阅动作迁移至 `UiButton`，删除动作迁移至带可访问标签的 danger `UiIconButton`。
- 保留 number modifiers、默认值边界、订阅计划选择/期限数据结构、动态新增/删除索引和全局保存 payload；未改动平台限额矩阵与认证来源动态数组。
- Settings 全量定向测试 36 tests、typecheck、lint 通过。

### 2026-08-19：Settings 默认平台配额矩阵批次

- Users/Defaults 平台配额矩阵 15 个日/周/月字段迁移至 mini `UiTextField`，保留表格布局、0 与空值语义、`v-model.number` 清洗、平台键映射和 aria-label。
- 定向验收：Settings 平台配额/空值用例通过；typecheck、lint 通过。

### 2026-08-19：Settings Gateway 版本字段批次

- Codex 最小/最大版本、Antigravity User-Agent、OpenAI Codex User-Agent 和客户端版本字段迁移至 compact monospace `UiTextField`。
- 保留外置语义标签、占位符、hint 文案、v-model 字段键及设置提交 payload；未修改版本匹配/同步逻辑。
- 定向验收：Settings Codex/Antigravity/rate-controls 用例通过；typecheck、lint 通过。

### 2026-08-19：R9 图表键盘与通用图标批次

- `GroupDistributionChart` 与 `EndpointDistributionChart` 的可展开数据行补齐 `role="button"`、`tabindex`、`aria-expanded` 以及 Enter/Space 键盘操作；鼠标展开、异步明细加载和折叠状态保持不变。
- 两个图表的通用展开箭头由手绘 SVG 替换为共享 Lucide `Icon`（`chevronDown`/`chevronRight`），不触碰 Chart.js 数据可视化 SVG。
- `PlaygroundMessage` 技术详情中的模型、请求 ID、响应 ID 复制动作统一为 `UiIconButton` mini/ghost，保留标签、复制状态、剪贴板错误 toast 和 20px 局部布局约束。
- Settings 安全页 Admin API Key 创建、再生成、删除、复制动作统一为带 loading/语义 variant 的 `UiButton`，保留确认、禁用、文案、API payload 和新增测试选择器。

### 2026-08-19：R0-R9 当前全量门禁

- `pnpm run test:run`：336 个测试套件、2220 个测试全部通过。
- `pnpm run typecheck`：通过。
- `pnpm run lint:check`：通过。
- `pnpm run build`：生产构建通过；仅保留既有 Browserslist、lottie eval、动态/静态 import 和大 chunk 警告。
- `git diff --check`：通过。
- 本批次仍未进入发布流程；R1 Settings 其余安全/OAuth/支付/邮件动态区块、R2-R9 页面收口、浏览器三视口/主题/动效/无障碍矩阵、最终 Code Review 与 Release/线上更新验证继续执行，不得停止。

### 2026-08-19：Settings Beta Policy 控件批次

- Beta Policy 规则卡的错误消息、模型白名单、fallback 错误消息迁移至紧凑 `UiTextField`；加载状态迁移至 `UiSpinner`。
- 预设、常用模型模式、新增模式与删除模式统一使用 `UiButton`/`UiIconButton`，保存按钮使用 loading 状态；保留规则 action/scope、动态数组增删、preset 写入、fallback 条件和保存 payload。
- 定向验收：SettingsView 36 tests、图表 6 tests、typecheck、lint 通过；现有 `router-link` stub 警告和测试故意错误日志仍为非阻塞既有警告。

### 2026-08-19：R9 首页动效、焦点与端点复制批次

- `HomeEarthAnimation` 读取 `prefers-reduced-motion`：减少动效时加载首帧并停止播放，正常模式继续循环自动播放；HomeView 同步禁用首页自定义动画/悬浮位移并允许首屏副标题换行，避免 901–1280px 静默裁切。
- `frontend/public/animations/home-earth/` 中的 `data.json`、Lottie `images/` 与五张模型卡图片是该首页实现的受控运行时资产，和组件源码、测试一起纳入前端目标 ownership。
- HomeSiteHeader 的品牌、导航、主题、文档、登录和移动菜单动作补齐共享 `ui-focus-ring`/`ui-motion` 语义及 reduced-motion 过渡降级。
- `EndpointPopover` 端点复制动作迁移至 `UiIconButton` mini/ghost/success，保留复制状态、aria-label/title 文案、剪贴板行为和现有测速链接。
- 定向验收：EndpointPopover/Home 相关 18 tests、typecheck、lint 通过。

### 2026-08-19：R2 ImageUpload 清除动作批次

- `ImageUpload` 清除操作迁移至 danger `UiButton`；文件选择仍保留原生隐藏 input/label，以保持 SVG/图片读取、大小校验、sanitize 和 FileReader 语义。

### 2026-08-19：账号弹窗受控输入批次

- `CreateAccountModal` Bedrock 鉴权方式迁移至 `UiRadioGroup`，全局区域开关和错误码删除动作迁移至 `UiSwitch`/`UiIconButton`；保留 auth mode 分支、凭据 payload、错误码范围和动态删除行为。
- `EditAccountModal` 自定义错误码输入/删除与 Bedrock 全局区域开关迁移至 `UiTextField`/`UiIconButton`/`UiSwitch`，Enter 事件改用共享 `enter` 契约，保存逻辑不变。
- 定向验收：CreateAccountModal 33 tests、EditAccountModal 60 tests、typecheck、lint 通过。

### 2026-08-19：OpenAI Fast/Flex Policy 控件批次

- Settings OpenAI Fast/Flex policy 规则的错误消息、模型白名单与 fallback 错误消息迁移至 `UiTextField`；规则/模式删除使用 danger `UiIconButton`，新增规则/模式使用紧凑 `UiButton` 与 Lucide plus。
- 保留 service tier/action/scope 选择、用户选择器、动态规则顺序、fallback 条件和保存 API 结构；SettingsView 36 tests、typecheck、lint 通过。

### 2026-08-19：Popover 与分组触发器无障碍批次

- `UiPopover` 对 dialog 面板补充 `aria-modal="true"`，Escape 关闭/焦点恢复保持不变，并新增 Tab/Shift+Tab 焦点循环。
- 管理员账号分组隐藏数量触发器由不可聚焦 `UiBadge` 改为 mini quiet `UiButton`，保留弹层内容和关闭动作。
- UiPopover 专项 2 tests、HelpTooltip 4 tests 通过。

### 2026-08-19：Settings SMTP 与测试邮件批次

- SMTP 主机、端口、用户名、发件人邮箱/名称迁移至 compact `UiTextField`，SMTP 密码迁移至 `UiPasswordField` 并保留已配置密码占位、手工编辑哨兵、autocomplete、autocapitalize/spellcheck 与测试/保存 payload。
- SMTP 连接测试、测试邮件发送统一为带 loading/disabled 语义的 `UiButton`，移除局部 spinner SVG；验证码开关、API 调用和失败安全状态保持不变。
- SettingsView 36 tests、typecheck、lint 通过；已有 `router-link` stub 警告保持非阻塞。

### 2026-08-19：Settings 邮件通知与图标残留批次

- 余额不足提醒阈值与充值 URL 迁移至紧凑 `UiTextField`，保留美元前缀、number modifier、URL fallback 和保存 payload。
- 账号额度通知的逐项启用开关、邮箱字段、删除与新增动作迁移至 `UiSwitch`、`UiTextField`、`UiIconButton`、`UiButton`；保留 `disabled/verified` 状态、空邮箱过滤和动态数组语义。
- Settings 通用 provider 展开、密钥显隐/复制、自定义 endpoint/menu 增删移动、支付帮助外链的手绘界面 SVG 替换为共享 Lucide `Icon`；Settings 模板不再包含通用 `<svg>`。
- 新增 `docs/frontend-rebuild/exceptions.md`，记录原生文件选择、品牌资产、数据可视化、订阅分组单选、OTP/上传和运维健康卡等有明确契约的例外。
- 定向验收：SettingsView 36 tests、Settings 布局 1 test、ProfileAvatarCard 5 tests、OpsDashboardHeader 10 tests、UiPopover 3 tests、HelpTooltip 4 tests、HomeSiteHeader 4 tests 均通过；typecheck/lint 继续执行。

### 2026-08-19：Settings General 站点基础字段批次

- General/Site 的站点名、副标题、API Base URL、默认分页大小与分页选项迁移至 compact `UiTextField`；保留 monospace、number 边界、空值解析、保存校验与 API payload。
- 自定义 endpoint 列表迁移至 `UiTextField`、danger `UiIconButton` 和 compact `UiButton`，保留动态数组增删、排序字段、URL/描述语义。
- SettingsView 36 tests、布局 1 test、typecheck 通过；通用设置的 OAuth/支付/动态菜单及浏览器视口仍继续推进。
- 自定义菜单的名称、可见性、URL、排序、删除和新增操作也统一至 `UiTextField`/`UiSelect`/`UiIconButton`/`UiButton`，SVG 上传继续走有明确文件语义的 `ImageUpload`。

### 2026-08-19：Settings 登录协议文档批次

- 登录协议的更新日期、文档新增/删除、标题、路由标识和 Markdown 内容迁移至 `UiTextField`、`UiTextArea`、`UiButton`、`UiIconButton`；保留启用时至少保留一份文档、动态 id、内容保存和路由预览逻辑。
- SettingsView typecheck 与 36 个行为测试保持通过；协议展示模式与动态文档浏览器验收仍需继续覆盖。

### 2026-08-19：头像上传与运维健康触发器批次

- `ProfileAvatarCard` 上传入口改为共享 compact `UiButton`，保留隐藏原生 file input、test-id、accept、压缩/预览/保存链路，并新增文件选择触发契约测试。
- `OpsDashboardHeader` 健康诊断大卡片改用 `UiButton` quiet 语义，保留自定义卡片布局、进度环、Popover、全屏隐藏和键盘行为。
- `HomeSiteHeader` 移动菜单 Escape 关闭时恢复菜单按钮焦点，避免隐藏菜单后焦点丢失；新增浏览器挂载焦点验收。
- `UiPopover` dialog 模式增加滚动锁与恢复、外部关闭后的焦点恢复；保留 Escape、Tab/Shift+Tab 焦点循环与 aria-modal。

### 2026-08-19：R9 图表 reduced-motion 与弹层语义批次

- 新增 `useReducedMotion` 响应式 composable，Endpoint/Group/Model/Token 图表与用户 Dashboard Chart.js 配置在系统减少动效时关闭 canvas 动画，并监听主题/动效媒体变化生命周期。
- `UiPopover` 触发壳补充 `aria-expanded`、`aria-haspopup`、`aria-controls` 关系；dialog 模式继续执行 body scroll lock、外部关闭焦点恢复和内部 Tab 焦点圈定。
- 图表/用户 Dashboard/首页导航定向测试与 typecheck 通过；Chart.js 视觉颜色 token 化和全站浏览器矩阵仍需继续收口。

### 2026-08-19：公共通知、订阅摘要与版本徽章批次

- `AnnouncementBell` 公告列表项、`SubscriptionProgressMini` 摘要触发器和 `VersionBadge` 的版本/刷新/更新/重启/回滚动作迁移至共享 `UiButton`/`UiIconButton`；保留弹层内容、更新状态机、版本缓存、复制和回滚命令行为。
- `ProfileAvatarCard`、Ops、HomeSiteHeader 与图表 reduced-motion 相关定向测试继续通过；typecheck 通过。
- `HelpTooltip` 默认帮助触发器迁移至 mini `UiIconButton`，保留 hover/click、定位、外部关闭和 tooltip close 行为。

### 2026-08-19：Settings 通用站点与风险控制字段批次

- General/Site 的客服联系方式、文档 URL 和首页自定义内容迁移至 compact `UiTextField`/`UiTextArea`；保留 URL/HTML/iframe 文案、保存 payload 和安全提示。
- Model Plaza 的价格说明与风险控制会话屏蔽 TTL 迁移至 `UiTextArea`/compact `UiTextField`，保留数值边界、条件显示和设置提交语义。
- `UiPopover` 为没有可聚焦触发内容的领域触发器提供 role=button、tabindex、Enter/Space 打开能力；已有按钮触发器不增加重复 Tab 停靠点，Escape/外点关闭和焦点恢复保持不变。
- 定向 SettingsView/布局、UiPopover、HelpTooltip 回归通过；剩余安全/OAuth、支付、动态 affiliate 及浏览器矩阵继续推进。

### 2026-08-19：Settings CAPTCHA/OAuth 与支付供应商批次

- Cloudflare Turnstile 的站点密钥与密钥输入迁移至 compact `UiTextField`/`UiPasswordField`；保留供应商切换、已配置密钥提示、外部控制台链接和保存 payload。
- LinuxDo Connect 的 Client ID、Client Secret、回调 URL 与快速设置复制动作迁移至共享字段/按钮；保留回调建议、剪贴板和 OAuth 设置语义。
- 支付供应商列表的拖拽手柄改用 Lucide `gripVertical`，空状态创建动作和加载状态使用 `UiButton`/`UiSpinner`；VueDraggable handle、排序和 ProviderCard 行为不变。
- 支付目录 100 tests、Settings 36 tests、typecheck 通过；保留腾讯/阿里云复杂供应商字段作为后续受控批次。

### 2026-08-19：图表可访问性与 Affiliate 控件批次

- Endpoint/Group 分布图的来源、指标切换按钮补 `aria-pressed`，统计表补可读 `aria-label`；图表键盘展开与 reduced-motion 配置保持。
- Affiliate 返利率、冻结时长、有效期、单用户上限迁移至 compact `UiTextField`（百分比 suffix 保留）；专属用户新增、搜索、批量、编辑、删除、翻页动作迁移至共享 `UiButton`，保留动态选中与 API 查询逻辑。
- 图表 16 tests、typecheck 通过；设置页剩余动态 OAuth/支付/用户矩阵继续收口。

### 2026-08-19：Settings OAuth 与 Affiliate 细节批次

- GitHub/Google OAuth 的 Client ID、Client Secret、后端/前端回调地址和生成复制动作迁移至 compact `UiTextField`/`UiPasswordField`/`UiButton`；保留已配置密钥留空语义、回调建议和 OAuth payload。
- Affiliate 数值策略与专属用户搜索/批量/编辑/删除/翻页操作继续统一共享控件，动态勾选状态和查询分页逻辑保持。
- SettingsView 36 tests 与 typecheck/lint 通过；腾讯/阿里云、WeChat/OIDC 等动态认证区块仍按独立契约批次推进。

### 2026-08-19：WeChat Connect 凭据批次

- WeChat PC、公众号、移动应用的 AppID/AppSecret 与浏览器回调地址迁移至 compact `UiTextField`/`UiPasswordField`，通过 `test-id` 保持现有测试与内层 input 选择器。
- 保留各子渠道开关、已配置密钥留空语义、回调 URL 绑定和保存/清空 secret 的后端契约；定向 SettingsView 36 tests、typecheck 通过。

### 2026-08-19：R9 首页主题与公开内容可访问性批次

- 自定义首页 iframe 增加站点名称 `title`，保留管理员自定义 URL/HTML 双模式和安全处理。
- 首页价格、能力、FAQ、时间线等清爽板块的规则线、辅助文字、索引和 action 边框改用 Qiu 主题变量，补齐暗色表面与对比度，不改变文案和布局结构。
- Home、紧凑首页、移动导航 16 tests 与 typecheck 通过；浏览器三视口截图、暗色与 reduced-motion 矩阵留待最终门禁。

### 2026-08-19：Users/Gateway 默认值批次

- 用户认证来源默认额度、并发数、订阅有效期与新增/删除动作迁移至 compact `UiTextField`/`UiButton`，保留每个来源的 grant 开关、动态订阅数组和 payload。
- Claude Code 最低/最高版本字段迁移至 compact monospace `UiTextField`；版本提示、保存结构与网关行为不变。
- SettingsView 36 tests、typecheck 通过；平台额度矩阵、Codex 指纹动态行和支付/邮件动态区块继续按行为契约推进。

### 2026-08-19：DingTalk 字段与用户趋势图主题批次

- WeChat 前端回调地址、DingTalk Client ID/Secret/回调地址及身份同步目标字段迁移至 compact `UiTextField`/`UiPasswordField`；保留 test-id、已配置密钥留空语义、开关条件和设置 payload。
- 新增 `useDarkMode` 响应式文档主题观察器；用户 Dashboard 趋势图的数据集、图例、坐标轴、网格和 Tooltip 颜色随 light/dark 实时更新，并为 canvas 图表增加可访问名称。
- SettingsView 36 tests、全量 336 suites/2223 tests、typecheck、lint 通过；三视口浏览器矩阵及其余动态认证/支付/邮件字段仍需继续推进。
- 新增 `UserDashboardCharts` 主题切换测试，验证 dark class 运行时更新图例/数据集颜色且不改变趋势数据。
- Auth Source Defaults 平台配额覆盖矩阵的 15 个数字输入改用 compact `UiTextField`，通过动态 aria-label 保留平台/周期语义；Settings tab panels 补齐 `role=tabpanel`、`aria-labelledby` 与多面板 `aria-controls` 关系。
- Codex fingerprint、blacklist、whitelist 的动态匹配字段及新增/删除动作迁移至 compact `UiTextField`/`UiButton`；保留 select、复选条件、数组增删顺序和设置 payload。定向 Codex/Settings 39 tests 与 typecheck 通过。
- OIDC Token Auth Method 原生 select 迁移到共享 `Select`/`UiSelectControl`，保留三种协议值与保存 payload；typecheck/lint 通过。
- 支付设置的商品名前后缀和帮助文案迁移到 compact `UiTextField`/`UiTextArea`，保留预览计算、占位符和支付保存 payload；typecheck/lint 通过。
- DingTalk 企业限制策略的二选一原生 radio 迁移到共享 `UiRadioGroup` stacked 变体，保留 `none`/`internal_only` 值和条件同步字段显示；typecheck 通过。
- Gateway 调度权重字段、Grok 默认文本模型和 Base URL 模式迁移到 compact `UiTextField`/`Select`，保留 datalist、动态权重键、test-id 与 Grok 设置 payload；Grok/调度定向测试通过。
- OpenAI OAuth 调度倍率、Claude OAuth 系统提示正文及新增/重置操作迁移至共享 `UiTextField`/`UiTextArea`/`UiButton`，保留 `x` 后缀、动态 block 序列化和 preset 行为；typecheck/lint 通过。
- Web Search Emulation 的供应商增删、配额上限、测试查询、测试/重置/关闭动作迁移至 compact `UiTextField`/`UiButton`；供应商折叠头补 `role=button`、aria-expanded 与 Enter/Space 键盘操作，ProxySelector、API key 显示/复制和 provider payload 保持不变。
- Settings 的用户错误记录可见性开关统一复用 `Toggle`（`UiSwitch`），保留权限条件、模型绑定与服务端保存语义。
- Channel Monitor 默认探测间隔迁移至 compact `UiTextField`，保留最小/最大值、默认模式条件、保存 payload 与自定义模式按钮行为。
- Web Search provider 折叠头补充键盘 Enter/Space 操作和展开状态语义；本轮共享控件迁移与 Settings 定向回归继续通过，复杂 API key 显示、动态支付/邮件数组与浏览器矩阵仍待最终收口。
- `TokenUsageTrend` 接入共享 `useDarkMode`，主题切换时实时刷新 Chart.js 图例、网格、坐标轴和数据集颜色；新增运行时 light/dark 回归测试，保留缓存命中率计算和 reduced-motion 行为。
- 通用 `ImageUpload` 空状态占位图与 `AliyunCaptchaWidget` 状态图标改为 Lucide `Icon`，保留上传/清理、验证码初始化、验证状态与第三方 SDK DOM 契约；品牌图标和数据可视化 SVG 仍按 exceptions.md 保留。
- `ImageUpload` 上传入口改为 compact `UiButton` + 隐藏原生 file input ref，移除 label 内嵌控件和旧 `.btn` 依赖；文件 accept、大小校验、SVG 清洗、FileReader 与清理动作不变。
- 完成 R1 dead compatibility cleanup：确认无生产消费者后删除旧 `common` BaseDialog/ConfirmDialog/DataTable/EmptyState/Input/LoadingSpinner/Pagination/Select/StatCard/StatusBadge/Toggle/ExportProgressDialog 文件及其仅针对兼容层的测试，重写 common barrel/README 仅保留领域组件；`R61-R1-DEAD-COMPATIBILITY-CLEANUP-ACCEPTANCE.md` 已补充证据。
- HomeSiteHeader 的主题切换与移动菜单图标动作改用 `UiIconButton`，保留 qiu header 的尺寸/透明 hover、aria-expanded/controls、Escape 后焦点恢复和 compact 视觉；`UiIconButton` 增加公开 focus() 契约供菜单恢复焦点。
- Settings Claude OAuth system-prompt block 的展开、上下移、删除动作改用带 accessible label 的 `UiIconButton`；Web Search API key 显示/复制动作同样统一到 `UiIconButton`，保留 reveal/copy disabled 语义。
- Settings Affiliate 专属用户新增/编辑与批量弹窗的字段、结果选择和保存/取消动作迁移到 `UiTextField`/`UiButton`/`UiIconButton`；保留搜索防抖、用户选择、百分比字符串、空值校验和 API payload。
- Settings 的 CAPTCHA、登录协议、Channel Monitor 与 payment-type 分段按钮补充 `aria-pressed` 状态，保留原有 provider/mode/payment type 选择样式与事件。
- Settings payment 取消频控、支付宝强制二维码与移动端深链开关改用 `Toggle`（`UiSwitch`）并对可选布尔值做显式归一化；支付订单超时与待处理上限改用 compact `UiTextField`，保留数值边界、禁用条件与保存 payload。
- 本批门禁：全量 Vitest `334` suites / `2202` tests 通过；`vue-tsc --noEmit`、ESLint、生产构建与 `git diff --check` 通过。构建仅产生既有 lottie/eval、动态/静态 import、旧 Browserslist 与 chunk size 警告；受保护页面浏览器矩阵、最终 Code Review、Release 与线上更新证据仍未完成。
- R9 图表语义批次：Group/Endpoint/Model 分布图增加画布 `role=img`、表格 caption 与可展开行的 `aria-controls` 关系；Token Usage 趋势图增加可访问名称；不改变 Chart.js 数据、主题或交互。
- Settings Web Search 订阅日期改用 compact `UiTextField`，Create Account Vertex JSON 选择动作改用 `UiButton`，保留原生隐藏 file input、日期解析与上传处理；定向 65 tests、typecheck 通过。
- 本轮最终自动化回归：全量 Vitest `334` suites / `2202` tests 通过；`vue-tsc --noEmit`、ESLint、生产构建、`git diff --check` 均通过。构建输出仍只有既有第三方 eval、动态/静态 import、Browserslist 与大 chunk 警告。
- Payment limits 的五个独立金额/倍率字段继续收口到 compact `UiTextField`，保留原有即时解析（空值默认、倍率默认值）与预览计算；Settings 定向 36 tests、typecheck、lint 和 diff check 通过。
- 用户 Dashboard 的“创建 API Key”入口改用 `UiButton` 路由契约，移除该处旧 `.btn` 依赖；Dashboard 定向 9 tests 与 typecheck 通过。
- Payment Provider 列表刷新/创建动作及 EasyPay 自定义方式新增/删除动作改用 `UiButton`；为新增动作补充稳定 test-id，保留 EasyPay 校验与 provider payload。定向 PaymentProvider 19 tests、typecheck、lint 通过。
- TLS fingerprint 与 error passthrough 管理弹窗的创建、取消、提交动作改用 compact `UiButton`/loading 契约，保留 YAML 解析、表单校验、提交和关闭行为；typecheck、lint 通过。
- Stripe 备用支付组件的加载、返回、确认、支付与取消动作改用 `UiSpinner`/`UiButton`，移除其最后的旧 `.btn` 依赖；Stripe lazy-loading 与 payment flow 34 tests、typecheck、lint 通过。
- R9 静态门禁收口：Vue 生产源码中旧 `.btn` class 引用已归零；剩余原生 SVG 仅为品牌资产、Chart.js/ProgressRing/Sparkline 数据可视化。
- TLS fingerprint 管理弹窗的 YAML、基本资料和全部协议数组字段迁移至 `UiTextArea`/`UiTextField`，保留粘贴解析、数组编辑与提交数据；原生文件/协议语义不变，typecheck 与 lint 通过。
- 错误透传规则弹窗的名称、优先级、描述、错误码、关键词、响应码和自定义响应字段迁移至 compact `UiTextField`/`UiTextArea`；保留必填校验、数组解析、条件显示与提交 payload，`git diff --check` 通过。
- Settings 支付费率与取消频控的两个内联数值控件迁移至 compact `UiTextField`，保留费率 clamp/round、百分号后缀、禁用条件、数值绑定与支付保存 payload；SettingsView 37 tests、typecheck/lint 通过。
- Settings Web Search provider 的 API key 输入迁移至 compact `UiTextField`，保留按 provider 的显示/隐藏、复制按钮、已配置占位符和 API key 状态语义；SettingsView 36 tests、typecheck/lint 通过。
- `PaymentProviderDialog.vue` 的动态 provider 凭据、EasyPay 自定义方法、回调基址与按类型限额字段迁移至 `UiTextField`/`UiTextArea`/`UiIconButton`；保留敏感值可见性、secret 保留/清空、callback 拼接、限额解析与保存 payload；PaymentProvider 19 tests、typecheck/lint 通过。
- PaymentProviderDialog 的支付模式、支持类型与限额折叠按钮补齐 `aria-pressed`/`aria-expanded`/`aria-controls`，不改变自定义选项布局与选择语义；PaymentProvider 19 tests、typecheck、lint 和 diff check 通过。
- PaymentProviderDialog 配置说明入口改用带可访问名称的 Lucide `UiIconButton`，保留 tooltip 点击触发与帮助内容；PaymentProvider 9 tests、typecheck/lint 通过。
- 本轮最终自动化回归：全量 Vitest `334` suites / `2202` tests 通过；生产构建、typecheck、ESLint、`git diff --check` 通过；旧 `.btn` class 扫描为 0，Vue 内联 SVG 仅剩品牌资产与数据可视化。R0-R9 浏览器矩阵、ownership 隔离、Code Review 与 Release 闭环仍未完成。
- 支付供应商卡片的编辑/删除动作改用 compact `UiButton`，支付类型切换补 `aria-pressed`，保留 provider toggle/edit/delete 事件与选中状态；typecheck、Lint、diff check 通过。
- 新增 `ProviderCard.spec.ts`，覆盖共享编辑/删除按钮与支付类型 `aria-pressed`/toggleType 契约；定向测试 1 passed。
- Settings 登录协议展示模式与 Channel Monitor 模式按钮补齐 `aria-pressed`，保持现有模式切换值与保存逻辑；SettingsView 36 tests、typecheck/lint/diff check 通过。
- 支付设置复用的 `ToggleSwitch` 改为 `UiSwitch`，保留外层标签、`checked` 双向事件和紧凑布局，移除该领域组件最后一处自定义 switch button 实现；ProviderCard/PaymentProviderDialog 定向回归通过。
- ToggleSwitch 收口后的全量门禁：Vitest `335` suites / `2204` tests 通过；`vue-tsc --noEmit`、ESLint、生产构建与 `git diff --check` 通过。浏览器三视口、工作区归属隔离、最终 Code Review、Release 与线上更新验证仍是唯一未闭环的发布门禁。
- Settings 标签输入批次：`UiTextField` 新增 `keydown`/`paste` 转发事件，注册邮箱后缀白名单与 Forwarded Client-IP Headers 迁移到 compact `UiTextField`，保留分隔键提交、Backspace 删除、粘贴批量解析、重复/非法校验、`test-id` 与设置 payload；Settings 定向 36 tests、UI TextField 5 tests、typecheck/lint 通过。
- 兼容性修复：`UiTextField` 对测试与浏览器的 `Enter`/`enter` 事件名统一归一化，恢复 KeyUsage、InlineEdit 等原有 Enter 提交契约；KeyUsage 8、UiExtendedComponents 12、UiTextField 6 定向测试通过。
- Settings Affiliate 专属用户表的全选与逐行选择迁移到 `UiCheckbox`，补齐可访问名称并保留当前页全选、单用户切换与批量操作状态；Settings 36 tests、typecheck/lint 通过。
- 新增 `docs/frontend-rebuild/WORKSPACE-OWNERSHIP-AUDIT.md`，明确允许提交路径、当前后端/临时产物排除项、隔离后重跑门禁顺序和发布前证据要求；当前共享工作树仍不可直接提交或发布。
- `UiPopover` 将 `aria-expanded`、`aria-haspopup`、`aria-controls` 同步到真实可聚焦触发器，同时保留包装层兼容属性、Escape/外点关闭、滚动锁与焦点恢复；新增实际触发器状态断言，UiPopover 3 tests、typecheck/lint 通过。
- 最终自动化复验（包含 UiPopover 与 Settings Affiliate 变更）：Vitest `335` suites / `2204` tests、`vue-tsc --noEmit`、ESLint、生产构建、`git diff --check` 全部通过；生产构建仅保留既有 Browserslist、第三方 eval、动态/静态 import 与大 chunk 警告。共享工作树归属、浏览器授权矩阵和 Release 闭环仍未完成。
- 账号领域快捷操作批次：Grok Base URL 预设与 Grok quota probe 改用 compact `UiButton`，保留 preset 选择、loading/disabled、probe API 与错误展示；Grok probe、Create Account、Edit Account 定向 41 tests、typecheck/lint 通过。
- 管理分组复制选择器的已选项移除动作改用带可访问名称的 `UiIconButton`，保留选中数组更新和 badge 布局；GroupCopyAccountsPicker 2 tests、typecheck/lint 通过。
- 当前全量回归快照仍为 Vitest `335` suites / `2204` tests 通过；本次 Grok/GroupCopy 变更未引入回归。
- Bulk Edit Account 的模型快捷预设、常用错误码与用户消息队列模式改用 compact `UiButton`，错误码移除改为带标签的 `UiIconButton`，保留 selected 状态、数组操作和批量提交语义；BulkEdit 36 tests、typecheck/lint 通过。
- BulkEdit 收口后的全量门禁继续为 Vitest `335` suites / `2204` tests、ESLint、生产构建和 `git diff --check` 全绿；旧 `.btn` class 仍为 0。
- 邮件模板编辑器的占位符复制 chip 改用 compact `UiButton`，保留占位符列表、剪贴板反馈和编辑器布局；typecheck/lint 通过。

### 2026-08-19：R9 静态审计门禁批次

- 新增 `frontend/src/__tests__/frontendRefactorStaticAudit.spec.ts`，固定检查删除的 common 兼容层无生产直导入、旧 `.btn` 控件类不回归、通用 inline SVG 仅存在于登记的品牌/数据可视化 owner，并确认回退/ownership/例外文档存在。
- 静态审计在初建时为 4 tests，现已扩展为 7 tests；该门禁只负责阻止视觉/组件残留回归，不能替代受保护页面的真实浏览器矩阵、ownership 隔离或最终 Code Review。

### 2026-08-19：Settings 页签与领域控件继续收口

- Settings 页签迁移至共享 `UiTabs`，由组件统一提供 roving tabindex、左右/上下/Home/End 导航，并新增每个 tab 的 `id`/`aria-controls`；删除 Settings 页面自绘 tab 导航 CSS，保留 tab panel 业务分组和滚动定位。
- `UiTabs` 扩展 `id`、`controls` 和上下方向键契约；`SettingsViewLayout.spec.ts` 更新为验证共享页签而非旧 CSS 字符串。
- Settings 的加载态、CAPTCHA 服务商/区域、登录协议展示模式、Channel Monitor 模式、支付类型选择改用 `UiSpinner`、`UiButton` 或 `UiTabs`/`UiSegmentedControl`，保留 provider 值、pressed 状态和设置 payload；Settings 定向 36 tests、UiExtendedComponents 12 tests、typecheck/lint 通过。
- 账号创建/编辑的错误码、Antigravity 预设、Anthropic 添加方式与同步动作改用 `UiButton`/`UiRadioGroup`；保留 OAuth、数组增删、文件选择和 Codex 富卡片例外；Create/Edit 定向 93 tests、typecheck/lint 通过。
- Error Passthrough 规则弹窗的开关、单选、平台复选、编辑/删除动作改用 `UiSwitch`/`UiRadioGroup`/`UiCheckbox`/`UiIconButton`；保留条件字段、数组归一化与 API payload；typecheck/lint 通过。
- TLS Fingerprint 弹窗的 GREASE 开关与列表操作改用 `UiSwitch`/`UiIconButton`；YAML、协议数组和提交流程保持不变；typecheck/lint 通过。
- PaymentProviderDialog 的支付模式、支持类型选择改用 compact `UiButton`，保留 `aria-pressed`、provider 选择和保存契约；PaymentProvider 9 tests、typecheck/lint 通过。
- Group/Endpoint 分布图来源/指标切换改用 `UiSegmentedControl`，保留筛选事件、键盘展开、Chart.js 数据和可访问表格；图表 12 tests、typecheck/lint 通过。
- Batch Image Guide 参考图删除动作改用带可访问名称的 `UiIconButton`，保留文件上传、预览和行选择的原生浏览器契约。
- 本批自动化回归：全量 Vitest `335` suites / `2204` tests 通过；`vue-tsc --noEmit`、定向 ESLint、`git diff --check` 通过。浏览器三视口、工作区 ownership 隔离、Code Review、Release 与线上更新验证仍未完成，不得停止总目标。

### 2026-08-19：R0 路由清单与 R9 legacy surface 收口批次

- 导出并测试生产路由清单：66 条生产 `RouteRecordRaw`、5 条 redirect、62 个 component assignment、61 个独立内容页面；2 个 alias 与 `/ui-system-preview` DEV-only 预览均有专门契约测试，避免 alias/DEV 记录污染基线。
- 将生产代码对 UI 子路径的绕过导入收口到 `@/components/ui` 公共出口，并在静态审计中加入禁止绕过检查。
- 新增 `ui-panel` 令牌 surface，迁移 charts、dashboard、profile、payment、order、table 等旧 `.card` 消费者；删除无消费者的旧 `.card`/stat/table/dropdown/dialog/toast/page/empty/spinner/skeleton/tab/progress/switch/code/tour 全局规则，保留实际 `modal-open`、`sidebar-open` 与表格滚动契约。
- `input-label`/`input-hint` 改为 token 化的 `ui-field-label`/`ui-field-hint`；账户、设置、支付和用户资料表单的业务绑定不变。
- Error Passthrough、TLS Fingerprint、Profile、Admin Order、Gemini quota 的旧 badge 类迁移为 `UiBadge` tone；订单状态工具函数改为 `OrderStatusTone`，代理到期工具函数改为共享 tone 语义。
- 静态审计扩展为 7 个可执行边界：删除 common 兼容层、`.btn`、`.card`/旧字段 helper、legacy badge、UI 子路径、inline SVG、motion/reduced-motion 与文档/存档存在性。Overlay、路由、ARIA 定向测试均通过；全量门禁和浏览器/发布门禁继续执行。

### 2026-08-19：支付过期状态与 Playground/R9 动效收口批次

- 修复 `PaymentQRCodeView` 与 `PaymentStatusPanel` 的过期订单轮询泄漏：过期或无效 `expires_at` 现在立即进入终态，不创建 3 秒轮询定时器；无效日期不再产生 `NaN:NaN` 倒计时。
- 新增 QR 支付页与支付状态面板的 malformed-expiry 回归测试，覆盖终态展示、无轮询和卸载清理。
- Playground 回到底部按钮接入 `useReducedMotion`，系统减少动效时将平滑滚动降级为即时滚动；流式文本状态补充 `role=status`、`aria-live=polite`，动画点标记为装饰内容。
- NavigationProgress 在 `prefers-reduced-motion: reduce` 下停止无限动画，并增加源契约测试；VersionBadge 与 onboarding 导航按钮的过渡改为仅 opacity/transform 或显式颜色属性，移除 `transition: all`。
- 本批定向回归：5 个文件、34 个测试通过；全量测试、typecheck、lint、build、diff check 需在后续最终门禁再次运行。浏览器矩阵、ownership 隔离、Code Review、Release 与线上更新仍未完成。

### 2026-08-19：Settings 弹窗语义、支付恢复上下文与进度条无障碍批次

- Settings Web Search 测试浮层迁移到共享 `UiDialog`，保留查询、Enter 测试、结果列表、外点关闭和 API 状态；同时移除四个错误的 `aria-pressed` 命令按钮状态。
- Stripe 支付回调 URL 与非弹窗结果跳转统一携带 `resume_token` 与 `out_trade_no`（仅签名恢复上下文，不暴露 client secret），新增恢复上下文回归测试。
- `UiQuotaSummary`、`UiThresholdMetric`、运维并发卡和系统日志队列的隐藏数值进度条补齐可访问名称；`UiFileUpload` reduced-motion 下停止宽度动画，无消费者的 `UiScoreBar` 移除宽度过渡。
- malformed expiry、Settings dialog、Stripe return URL 与进度条语义定向回归通过；浏览器三视口、ownership 隔离、Code Review、Release 与线上更新仍未完成。
- R9 静态门禁扩展到前端 CSS：禁止 `transition: all` 与 reduced-motion 无限 `progress-pulse`；应用壳几何过渡登记为结构性例外，普通上传/评分进度条不再在 reduced-motion 下持续运动。
- Web Search 配额进度改用 `UiProgressBar`，按原有 70%/90% 阈值映射 token tone，并保留重置动作、无限额度展示和 provider payload；Settings 定向 36 tests 与 typecheck 通过。
- `useReducedMotion` 增加旧版 MediaQueryList `addListener/removeListener` 兼容，并用现代与旧浏览器两条测试路径验证监听、更新和卸载清理。

### 2026-08-19：R3 Profile TOTP Overlay 收口批次

- `TotpSetupModal` 与 `TotpDisableDialog` 的两套手写 fixed overlay 迁移到共享 `UiDialog`，统一获得 dialog/aria-modal、Escape、焦点圈定、滚动锁、外点关闭与关闭后焦点恢复契约；TOTP API、邮箱/密码验证分支、倒计时、二维码、setup token 和提交 payload 未改变。
- 六位 TOTP 验证格由 48px 旧控件压缩到 36px token 高度，390px 以下进一步收窄宽度；保留逐格输入、Backspace、粘贴、自动前移和 one-time-code，并为每格补充 accessible name。
- `ProfilePasskeyCard` 的删除凭据确认也从第三套手写 overlay 迁移到 `UiDialog`，保留当前密码验证、删除失败保持弹窗、凭据列表更新和 toast 语义；新增组件测试覆盖 dialog 语义与 `remove(id, password)` payload。
- 定向验收：TOTP timer/失败/共享 Dialog/验证码格与 Passkey 删除共 6 tests、`vue-tsc --noEmit`、定向 ESLint 与 `git diff --check` 全部通过。
- 该批次只闭环 R3 的一个 Profile 领域遗留；R0-R9 浏览器矩阵、ownership 隔离、最终 Code Review、Release 与线上更新仍未完成，继续执行下一项。

### 2026-08-19：R7 Settings 危险操作确认收口批次

- Web Search 用量重置、管理员 API Key 重新生成/删除从浏览器原生 `confirm()` 迁移到共享 `UiConfirmDialog`；确认前不调用 API，执行期间锁定取消并显示 pending，保留 provider type、密钥一次性显示、删除状态与成功/失败 toast。
- `EmailTemplateEditor` 的“恢复官方模板”同样迁移到 `UiConfirmDialog`，保留 event/locale 参数、恢复后预览刷新、失败可重试和自定义模板状态更新；生产 Settings/Email Template 代码不再使用原生 confirm。
- 新增行为测试覆盖取消前零调用、确认 payload、密钥状态更新、模板恢复与 dialog 语义；Settings 全套 38 tests、Email Template 1 test、typecheck、定向 ESLint 与 diff check 通过。
- 该批次不替代 Settings 全域浏览器验收；其余 R0-R9、ownership、Code Review、发布与线上更新继续执行。

### 2026-08-19：R4 Stripe Popup 恢复上下文收口批次

- `StripePopupView` 的支付宝外部回跳 URL 现在与主 Stripe/Airwallex 路径一致，继续携带 `order_id`、`out_trade_no` 与签名 `resume_token`，且不包含 client secret；跨窗口/本地认证状态丢失后仍可由公开恢复接口解析订单。
- `StripePaymentInline` 的 popup query 与 inline return URL 同步支持可选 `outTradeNo/resumeToken`，未传值时保持旧 URL 兼容；现有 popup READY/INIT 握手、WeChat QR 轮询与卡支付行为未改。
- 新增 Popup 运行时测试解析 Stripe `return_url` 并逐项断言安全恢复参数；Stripe Popup/Main/lazy-loading 共 7 tests、typecheck、定向 ESLint 与 diff check 通过。
- QR/Stripe/Airwallex/WeChat 的真实浏览器状态矩阵仍是 R4 发布前门禁，本批次不据此标记 R4 完成。

### 2026-08-19：R4 订阅刷新竞态收口批次

- `SubscriptionsView` 的订阅刷新增加单调请求序号；较慢的旧成功/失败响应不再覆盖较新的订阅实例列表、loading/error 状态或重复弹出失败 toast，当前请求的旧数据保留与重试行为不变。
- 新增延迟 Promise 竞态测试，先完成第二次刷新再回放第一次响应，断言只展示新实例且无陈旧错误；Subscriptions 12 tests、typecheck、定向 ESLint 与 diff check 通过。
- 订阅实例/分组/续费/额度的业务计算未改；R4 浏览器与真实交易状态矩阵继续作为发布前门禁。

### 2026-08-19：R4 多订单恢复隔离与 Stripe QR 轮询收口批次

- 支付恢复快照改为“精确订单键 + 最近订单兼容入口”：优先按 `resume_token`，无 token 时按 order ID / out-trade-no 隔离；旧固定键继续提供当前订单与旧版本兼容，但只有身份匹配的订单才允许清理，避免 A 订单迟到响应删除 B 订单恢复状态。
- Payment、Result、Stripe 与 Airwallex 页面统一使用精确恢复读取；`PaymentResultView` 增加生命周期 epoch，卸载后的公开查询或轮询响应不再更新页面或清理新订单快照。
- Stripe WeChat QR 轮询增加单请求 in-flight、终态与 disposed 防护；慢于 3 秒的请求不会重叠，支付成功只调度一次关闭/结果跳转，卸载后的迟到成功不再导航。
- 新增双订单并存/精确清理、旧结果页迟到响应、Stripe 慢轮询防重入与卸载迟到响应测试；Payment Flow、Payment、Result、Stripe、Airwallex 共 73 tests，typecheck 与定向 ESLint 通过。
- 本批仍不替代 Stripe/Airwallex/二维码真实支付浏览器矩阵；R0-R9、ownership、最终 Code Review、Release 与线上更新继续执行。

### 2026-08-19：R7 Affiliate 弹窗壳收口批次

- Settings 的 Affiliate 专属用户新增/编辑与批量费率两套手写 fixed overlay 迁移到共享 `UiDialog`，统一获得 dialog/aria-modal、Escape、焦点圈定、滚动锁、外点关闭、移动端 bottom-sheet 与关闭后焦点恢复契约。
- 搜索防抖、用户选择、邀请码、0-100 费率校验、清空独立费率、批量选择与 API payload 均保持不变；只替换弹窗壳与 footer 布局。
- 新增真实入口测试，覆盖 Features 页签、打开新增弹窗、共享 close 事件、选择用户与打开批量费率弹窗；Settings 40 tests、Layout 1 test、typecheck 与定向 ESLint 通过。
- 该批不替代 Settings 1440/900/390、dark、reduced-motion 与键盘浏览器矩阵；总目标继续执行。

### 2026-08-19：R8 公告本地响应式契约与首页动效夹具批次

- 为 `HomeEarthAnimation` 新增 Lottie fixture，覆盖普通模式 loop/autoplay、reduced-motion 静态首帧、资源 404 静默降级与卸载销毁，首页动画不再只由 HomeView stub 间接覆盖。
- fixture 与默认首页共同读取 `frontend/public/animations/home-earth/`；该目录的动画 JSON、位图序列和模型卡图片必须随本次前端实现进入隔离验证与最终提交。
- 管理员公告页测试改为实际渲染 `UiMobileTableScroller`，锁定可聚焦 region、公告 accessible name 与 940px 横向滚动契约；创建入口同时锁定 `UiDialog width=wide` 编辑器契约。
- 定向验收共 3 files / 25 tests 通过；这些证据已回写 `R8-ADMIN-ANNOUNCEMENTS-ACCEPTANCE.md`，但不冒充管理员真实会话下的 1440/900/390、dark、reduced-motion、keyboard/console 浏览器验收。

### 2026-08-19：R0 清单漂移与共享动效契约收口批次

- 修正 `UI.MD` 中 `UiScoreBar` 的重复 `114` 编号为 `96`；公共合同总数仍为 114，内部 `UiDataTableCore`/`UiSelectControl` 不重复计入。
- R0 文档补齐 66 production records、62 component assignments、5 redirects、61 独立内容页、2 aliases、DEV-only preview 与 37 静态导航的计数口径；历史 335/2204 被明确标为最近全量快照而非当前最终门禁。
- 静态审计文档从过期的 4/6 项统一为当前 7 个可执行测试边界。
- `UiDrawer`、`UiSheet`、`UiSnackbar` 与 `UiAccordion` 补齐 reduced-motion transition 禁用规则，并扩展 overlay 源契约门禁；生命周期、布局、事件和普通模式动效均未改。

### 2026-08-19：R2 DingTalk 回调闭环测试批次

- DingTalk callback 新增补邮箱 open-redirect 防护测试，后端 completion 即使返回 `//evil.example` 也只能进入 `/auth/dingtalk/email-completion?redirect=%2Fdashboard`。
- legacy fragment token 路径新增回归：不触发 pending exchange，继续保存 refresh token/expiry、设置 access token、显示成功状态并返回受信任站内路径。
- DingTalk email completion 实际渲染共享创建账号表单，验证邮箱/密码 payload、token context 持久化、认证 store 与 `/welcome` redirect；不启用验证码计时器或修改后端配置。
- DingTalk/AuthShell 共 3 files / 17 tests、typecheck、定向 ESLint 与 diff check 通过；R2 证据已回写，但全站受保护页面浏览器矩阵仍未完成。

### 2026-08-19：当前全量自动化门禁快照

- 在上述 R0/R2/R3/R4/R7/R8/R9 批次合并后的同一工作树上重新执行完整前端门禁；Vitest `344` files / `2248` tests 全部通过。
- `vue-tsc --noEmit`、全量 ESLint、生产构建与 `git diff --check` 全部通过；Vite 共完成生产资源打包并于 `36.35s` 正常结束。
- 独立前端重构静态审计 `frontendRefactorStaticAudit.spec.ts` 的 7 项边界全部通过。
- 该快照只证明当前源码自动化门禁为绿色；受保护页面真实用户/管理员三视口、light/dark、reduced-motion、keyboard/console 浏览器矩阵、工作区 ownership 隔离、最终 Code Review、Release、产物/checksum、GHCR/latest、旧版更新发现与线上更新仍未完成，因此不得作为总目标停止点。

### 2026-08-19：共享日期弹层与 Stripe 微信二维码终态批次

- `UiDateRangePicker` 增加 `aria-haspopup=dialog`、打开后首个预设焦点入口、ArrowDown 打开、Escape/Apply 关闭后触发器焦点恢复；Enter/Space 继续使用原生 button 激活，避免键盘 keydown 与 click 双重切换。日期草稿、Apply 才提交、preset 和 Usage 查询语义均未改变。
- 日期选择器、用户 Usage、管理员 Usage 共 30 tests、typecheck、定向 ESLint 与 diff check 通过。
- Stripe 微信二维码轮询现在同时受订单 `expires_at` 与 30 分钟前端安全上限约束；已过期订单不启动轮询，运行中到期或收到 EXPIRED/CANCELLED/FAILED 终态会清理 interval/timeout、显示过期状态并提供返回充值入口。
- Stripe 慢请求单飞、成功仅结算一次、卸载迟到响应防护保持不变；Stripe/Popup/Result 共 24 tests、typecheck、定向 ESLint 与 diff check 通过。
- 该批仍不能替代真实 Usage/Stripe 微信支付的三视口、dark、reduced-motion、keyboard/console 与回调状态浏览器矩阵，总目标继续执行。

### 2026-08-19：R2 应用壳运行时回归批次

- 新增 `AppSidebar.behavior.spec.ts`，真实挂载侧栏并覆盖移动端 Escape 关闭、`body.sidebar-open` 清理、卸载后全局监听移除、导航滚动位置恢复/保存，以及底部主题按钮的 dark/light 与 localStorage 状态切换。
- AppSidebar 运行时与原有结构契约共 18 tests、typecheck、定向 ESLint 与 diff check 通过；未访问端口、未伪造认证浏览器会话。
- 该批补足组件级防回归证据，但不能替代 R62 要求的真实用户/管理员会话下 1440/900/390、刷新稳定性、权限菜单、折叠/移动布局、主题和 console 浏览器验收。

### 2026-08-19：R57 法律文档跨来源导航批次

- `LegalDocumentView` 新增回归夹具，验证内置 `admin-compliance` 文档在存在配置文档时，下一篇稳定指向第一份配置文档，并通过共享 `UiPageNav` 发出正确的命名路由参数。
- 法律页定向 6 tests、typecheck、定向 ESLint 与 diff check 通过；内置文档加载失败仍不误报为远程文档失败。
- 该批只闭环公开文档导航的本地行为证据，不替代 R57 的真实公开页三视口、暗色、reduced-motion 与键盘浏览器矩阵。

### 2026-08-19：R5 Playground Composer 无障碍标识批次

- Playground composer 外层交互区域补充稳定的 `aria-label`，由现有 `playground.title` 文案提供；键盘发送、Shift+Enter 换行、模型/密钥选择、图片模式和工具动作均未改变。
- Composer 与 Playground 定向 12 tests、typecheck、定向 ESLint 与 diff check 通过；本地仍不调用 Playground 后端或其他端口。
- 该批补足屏幕阅读器区域识别，不替代 R5 已记录的真实响应、图片生成、慢请求和三视口浏览器验收。

### 2026-08-19：R4 订阅分组选择共享化批次

- `UiRadioGroup` 新增 `ariaLabel`、option `title` 与 `#option` 自定义内容插槽；原有默认 label/description、隐藏 radio、disabled 和 update 事件契约保持兼容。
- 用户订阅的多分组创建/绑定密钥选择从页面原生 radio 迁移到共享 `UiRadioGroup`，保留平台图标、分组名称、倍率、tooltip、默认第一组、`input[value]` 选择语义和 `/keys` 路由 payload。
- UiRadioGroup、订阅页定向 15 tests、typecheck、定向 ESLint 与 diff check 通过；真实订阅/密钥浏览器矩阵仍未完成。

### 2026-08-19：本轮改动后的完整前端门禁快照

- 在日期选择器、Stripe 微信二维码终态、AppSidebar 运行时、法律文档导航、Playground Composer accessible name 与订阅分组共享 radio 改动后，重新执行完整门禁：Vitest `345` files / `2255` tests 全部通过。
- `vue-tsc --noEmit`、全量 ESLint、生产构建和 `git diff --check` 全部通过；生产构建 `3101 modules transformed`，`24.54s` 正常结束；静态审计 7 tests 全部通过。
- 构建仍只有既有的 Browserslist 过期、动态/静态 import 共存和大 chunk 警告，没有编译或测试失败。
- 该快照仍不构成总目标停止点：ownership 隔离、受保护页面真实浏览器矩阵、最终 Code Review、Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证均未完成。

### 2026-08-19：R4 Stripe 弹窗轮询终态补充

- `StripePopupView` 的微信支付轮询增加 30 分钟前端安全上限，并在成功、失败、取消、过期和卸载路径统一清理 interval/timeout；失败或过期后不再无限请求。
- 新增 Stripe Popup 失败终态测试，覆盖轮询只执行一次、失败文案显示以及继续推进超时窗口不会再次请求；Stripe Popup/主 Stripe/二维码/支付状态面板定向共 20 tests 通过。
- typecheck、定向 ESLint 与 `git diff --check` 通过；真实支付供应商回调和浏览器矩阵仍是 R4 发布前门禁。

### 2026-08-19：Stripe 弹窗批次后的完整前端门禁快照

- Vitest `345` files / `2256` tests 全部通过（新增 Stripe Popup 失败终态回归与 DingTalk 夹具均纳入全量）。
- `vue-tsc --noEmit`、全量 ESLint、生产构建、静态审计 7 tests 与 `git diff --check` 全部通过；生产构建 `3101 modules transformed`，`24.84s` 完成。
- 构建仅保留既有 Browserslist 过期、动态/静态 import 共存和大 chunk 警告；没有新增编译、测试或格式错误。
- 该快照仍不构成总目标停止点：ownership 隔离、真实受保护页面浏览器矩阵、最终 Code Review、Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证均未完成。

### 2026-08-19：R9 样式动效静态审计扩展

- `frontendRefactorStaticAudit.spec.ts` 的动效规则从仅扫描独立 CSS 文件扩展为扫描所有生产 SFC 的 `<style>` 块及独立 CSS，确保 `transition: all` 与已移除的无限 `progress-pulse` 不会通过 Vue 单文件样式绕过门禁。
- 既有 7 项静态审计全部通过；未改变任何运行时代码或样式，只扩大了自动化检查覆盖面。
- `vue-tsc --noEmit`、定向 ESLint 与 `git diff --check` 通过。

### 2026-08-19：R9 共享进度条布局动效收口

- `UiProgressBar` 与 `UiFileUpload` 的进度填充不再对 `width` 做过渡，改为即时更新；`UiScoreBar` 同步纳入禁止布局宽度动画的静态门禁。
- 数值归一化、颜色 tone、ARIA `progressbar`/`meter` 语义、文件选择与进度数据均未改变。
- 静态审计扩展为 8 tests；相关 UI 回归、typecheck、定向 ESLint 与 `git diff --check` 通过。

### 2026-08-19：R1/R9 规则标签组件一致性修正

- `ErrorPassthroughRulesModal` 的平台条件标签改为实际使用 `UiBadge tone="info"`；此前仅在原生 `span` 上挂置无效 `tone` 属性，导致该标签没有共享徽章语义和视觉。
- 平台文本、截断数量、规则匹配和操作逻辑均未改变；typecheck、定向 ESLint 与 `git diff --check` 通过。

### 2026-08-19：R1 创建账号平台选择共享化批次

- `CreateAccountModal` 顶部 Anthropic/OpenAI/Gemini/Antigravity/Grok 平台选择从页面自定义按钮组迁移到 `UiSegmentedControl`，保留平台值、测试选择器、品牌图标、键盘左右切换和表单 payload。
- `UiSegmentedControl` 增加 option `title` 与 `#option` 内容插槽，仍输出原有 radiogroup/radio 语义；新增 2 项组件契约测试。
- CreateAccountModal/Grok 相关定向 35 tests、typecheck、定向 ESLint 与 `git diff --check` 通过；其余 OAuth/API Key/服务账号/Bedrock 分支未机械改动。

### 2026-08-19：R4 签名恢复订单类型契约修正

- 前端支付 API 将匿名 `out_trade_no` 最小查询响应与签名 `resume_token` 完整订单响应拆分为 `PublicOrderVerifyResult` / `PublicOrderResult`；旧匿名接口仍只暴露最小字段。
- `PaymentResultView` 的订单解析联合类型与金额/支付方式/订单 ID 守卫同步支持签名恢复结果，使 Stripe/Airwallex 回跳在无本地快照时仍可按后端真实响应展示金额、币种、手续费、支付方式和订阅收据。
- Payment Result 与 payment API 定向 20 tests、typecheck、定向 ESLint 与 `git diff --check` 通过；未修改后端响应或 API 路径。

### 2026-08-19：平台选择与支付类型修正后的完整门禁快照

- Vitest `346` files / `2259` tests 全部通过；`UiSegmentedControl` 新增 2 项契约测试并纳入全量。
- `vue-tsc --noEmit`、全量 ESLint、生产构建、静态审计 8 tests 与 `git diff --check` 全部通过；生产构建 `3101 modules transformed`，`25.17s` 完成。
- 构建仍只有既有 Browserslist、动态/静态 import 和大 chunk 提示；没有新增编译、测试、lint 或格式错误。
- 当前依然不得停止或发布：受保护页面浏览器矩阵、ownership 隔离、最终 Code Review 与 Release/GHCR/更新闭环尚未完成。

### 2026-08-19：R7 账号操作菜单键盘与焦点收口

- `AccountActionMenu` 打开后自动聚焦首个可用菜单项，支持 ArrowUp/ArrowDown 循环、Home/End 首尾导航，并在受控 `show` 关闭或卸载时恢复原触发器焦点；既有 Escape、背景关闭及所有账号动作事件保持不变。
- 账号操作菜单与 AccountsView spark-shadow 定向共 25 tests、typecheck、定向 ESLint 与 `git diff --check` 通过。
- 该批补足组件级 menu 键盘模型，仍需在真实管理员会话中验收触发器、定位、滚动边界、三视口和屏幕阅读器播报。

### 2026-08-19：R4 并发支付恢复与 Stripe 充值中终态收口

- `PaymentView.resetPayment()` 在清空响应式状态前捕获并删除当前订单的 scoped recovery identity，修复 JSAPI 成功、取消与 Bridge 不可用后 token/order 快照残留。
- 微信恢复回调不再无条件删除全局兼容指针；有签名 token 时仅清当前 token 的旧快照，并跳过全局 latest 恢复，保证并发订单 B 不会被订单 A 的回调误删或误当作 A 恢复。
- Stripe 微信二维码轮询将正式订单状态 `RECHARGING` 与 `PAID/COMPLETED` 一样视为支付事实，统一经 `settleSuccessfulPayment()` 停止轮询并只跳转一次。
- PaymentView、paymentFlow、StripePaymentView 定向回归连同管理员订阅额度测试共 62 tests、typecheck、定向 ESLint 与 `git diff --check` 通过。
- 真实双标签支付、微信/Stripe 外部回跳和供应商 sandbox 仍属于 R4 发布前浏览器/支付环境门禁。

### 2026-08-19：R6 管理员订阅额度进度条可访问名称

- 管理员订阅列表的 5 小时、本期和有效期总额三条 `UiProgressBar` 分别复用现有本地化标题作为 `aria-label`，不额外渲染可见 meta 行，不改变 usage/reserved/limit 数值、阈值色或布局。
- `SubscriptionsView.spec.ts` 增加三条进度条名称顺序断言；管理员订阅定向测试现在为 7 tests，通过 typecheck、定向 ESLint 与 `git diff --check`。

### 2026-08-19：并发恢复与菜单键盘批次后的完整前端门禁快照

- Vitest `346` files / `2262` tests 全部通过；新增管理员订阅 accessible-name 与 Stripe `RECHARGING` 回归均纳入全量。
- `vue-tsc --noEmit`、全量 ESLint、生产构建、静态审计 8 tests 与 `git diff --check` 全部通过；生产构建 `3102 modules transformed`，`24.66s` 完成。
- 构建仍只有既有 Browserslist 过期、动态/静态 import 共存、Lottie eval 与大 chunk 提示；没有新增编译、测试、lint 或格式错误。
- 该快照仍不构成总目标停止点：ownership 隔离、受保护页面真实浏览器矩阵、最终 Code Review 与 Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证尚未完成。

### 2026-08-19：R9 原生控件例外机器门禁

- 新增 `frontend/config/native-control-exceptions.json`，按生产 SFC、原生标签类型与数量登记确有浏览器/业务必要的控件；当前覆盖账户富选择卡、OTP/file、应用壳菜单、第三方验证码 host、图表/监控 disclosure、Playground 编辑器和富媒体预览等既有例外。
- `frontendRefactorStaticAudit.spec.ts` 使用 Vue SFC AST 而非文本 grep，精确扫描生产 `<button>/<input>/<select>/<textarea>`，并要求发现项与 manifest 双向完全一致、每个 owner 同时出现在 `exceptions.md`；新增未登记控件或过期例外都会失败，Settings 注释不再产生假阳性。
- 清理已完成的用户订阅原生 radio 与创建账号顶层平台选择旧例外；补齐 Aliyun SDK、应用壳菜单、ModelDistribution、Playground、MonitorCard 与完整 TOTP owner 的理由和移除条件。
- 静态审计现在为 9 tests，typecheck、定向 ESLint 与 `git diff --check` 通过；该门禁仍不替代真实 keyboard/screen-reader 浏览器验收。

### 2026-08-19：R0/R1/R9 公共组件消费者清单与 AST 门禁

- 新增 `docs/frontend-rebuild/CONSUMER-INVENTORY.md`，冻结 114 个 Ui/App 公共组件的生产消费者口径：276 个 distinct production consumer files、1,880 个 runtime component references，生产范围排除 UI 自身、测试和 showcase 静态 HTML。
- 新增 `frontend/src/components/ui/__tests__/UiConsumerInventory.spec.ts`，使用 Vue SFC parser + TypeScript AST 解析多行、别名和混合 type/runtime 导入，双向校验组件集合、外部零消费者 allowlist、未知导入、namespace/default 导入和动态公共出口导入。
- 20 个外部直接消费者为 0 的组件已分类：`UiFieldError`/`UiTimeInput` 为公共组件内部组合，另外 18 个为 reference-only/staged；它们继续保留在 public barrel、契约测试或 showcase，不把静态展示误计为生产消费者。
- `UI.MD`、R0 基线和当前未完成清单已互链并同步统计口径。该批仅补清单与自动化可复核性，不宣称 R1 页面迁移或 R9 浏览器/无障碍门禁完成。
- 定向消费者门禁：2 tests passed；随后必须并入下一次全量 Vitest、typecheck、lint、build、diff check，并继续处理受保护页面浏览器矩阵、ownership、Code Review 和 Release 闭环。

### 2026-08-19：消费者清单批次后的完整前端门禁快照

- `pnpm run test:run`：347 files / 2266 tests 全部通过；新增消费者 AST 门禁与 Settings 密度契约已纳入全量。
- `pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过；生产构建 3102 modules transformed，24.83s 完成。
- 仅保留既有 Browserslist 过期、Lottie eval、动态/静态 import 共存和大 chunk 警告；没有新增编译、测试、lint 或格式错误。
- 该快照仍不构成总目标停止点：ownership 隔离、受保护页面真实浏览器矩阵、最终 Code Review、Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证尚未完成。

### 2026-08-19：R7 Settings 密度批次后的完整前端门禁快照

- `pnpm run test:run`：347 files / 2266 tests 全部通过；SettingsView 定向回归为 42 tests。
- `pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过；生产构建 3102 modules transformed，24.84s 完成。
- 仍只有既有 Browserslist 过期、Lottie eval、动态/静态 import 共存和大 chunk 警告；未出现新的测试、类型、Lint、构建或格式错误。
- 该快照仍不构成总目标停止点：R1-R9 页面迁移和受保护浏览器矩阵、ownership、最终 Code Review、Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证继续执行。

### 2026-08-19：R9 进度条 accessible-name 与动效静态复核

- 为 `UiThresholdMetric`、Ops concurrency、Ops system-log queue 增加 `role="progressbar"` accessible-name 回归断言；7 项定向测试全部通过。
- 新增 `UiQuotaSummary` accessible-name 契约测试，验证可见 quota label、百分比值和 reset 文案同时保留。
- 复核 `UiFileUpload`、`UiProgressBar`、`UiScoreBar` 当前源码不含 `transition: width`，不再在 reduced-motion 下产生宽度动画；新增 `docs/frontend-rebuild/R9-FINAL-MOTION-A11Y-ACCEPTANCE.md` 记录范围、证据与受保护浏览器 pending。
- 该批不替代真实浏览器 screen-reader/keyboard 验收；继续执行 R0-R9 页面矩阵、ownership、Code Review 和 Release/线上更新闭环。

### 2026-08-19：R9 quota accessible-name 批次后的完整前端门禁快照

- `pnpm run test:run`：348 files / 2267 tests 全部通过；新增 `UiQuotaSummary` 契约测试已纳入全量。
- 本批定向 R9 进度条/无障碍测试 8 tests 通过；`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过，生产构建 3102 modules transformed，25.36s 完成。
- 仅保留既有 Browserslist、Lottie eval、动态/静态 import 共存和大 chunk 警告。
- 该快照仍不构成总目标停止点：真实页面浏览器矩阵、ownership、最终 Code Review、Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证尚未完成。

### 2026-08-19：R7 Settings 密集控件密度一致性批次

- 将 Beta Policy、OpenAI Fast/Flex、Claude OAuth system prompt 的选择控件，以及支付负载均衡/取消频控行的 Select 与数字字段统一为 `density="compact"`；保留原有 `v-model`、禁用条件、数值修饰符、事件和 payload。
- `SettingsViewLayout.spec.ts` 增加源契约断言，确保上述选择器和取消频控数字字段不会回退到默认 36px 密度。
- SettingsView 定向回归：42 tests passed；随后仍需并入完整门禁，并继续处理 Settings 剩余原生控件、旧样式、浏览器矩阵和最终发布门禁。

### 2026-08-19：R2 AppLayout 运行时契约补强

- 新增 `AppLayout.behavior.spec.ts`，与既有 AppSidebar 运行时/结构契约一起验证展开/折叠工作区类、header/sidebar/page slot 持续挂载和 onboarding replay callback 注册；不改 store、路由、权限或布局业务逻辑。
- R2 壳定向回归：3 files / 21 tests passed；真实 user/admin 三视口、主题、reduced-motion、keyboard、console 浏览器证据仍待授权会话，不能将本地 fixture 视为浏览器验收。

### 2026-08-19：R2 AppLayout 批次后的完整前端门禁快照

- `pnpm run test:run`：349 files / 2271 tests 全部通过；新增 AppLayout 运行时契约和布局动效例外静态检查已纳入全量。
- `pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 继续作为本批最终门禁；浏览器、ownership、Code Review 与 Release 闭环仍未完成。

### 2026-08-19：R9 布局动效例外机器门禁

- 静态审计新增“布局属性过渡必须属于已登记 AppLayout/AppSidebar 结构性例外”检查，当前 `frontendRefactorStaticAudit.spec.ts` 为 10 tests 通过；共享进度条和上传/评分组件仍禁止宽度过渡。
- 该检查只约束未来回归，不替代应用壳 reduced-motion 与三视口浏览器验收；本批未改运行时代码。

### 2026-08-19：R4/R9 支付终态与控件可访问性批次后的完整前端门禁快照

- `UsageProgressBar` 现在提供完整 `role=progressbar` 名称、0–100 边界、当前值和文本值，并移除宽度过渡；账户错误状态的信息提示触发器补充本地化 accessible name。
- 二维码支付页将 `RECHARGING` 视为支付终态并把 `resume_token/out_trade_no` 透传到结果页；Stripe 弹窗同步处理 `RECHARGING`，认证失效时使用签名公共解析接口恢复订单。新增二维码、Stripe popup、signed-resume 回归共 5 tests，相关定向测试全部通过。
- `pnpm run test:run`：350 files / 2276 tests 全部通过；`pnpm typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过。生产构建 3102 modules transformed，25.50s 完成。
- 构建仅保留既有 Browserslist、Lottie eval、动态/静态 import 共存和大 chunk 提示；没有新增编译、测试、Lint、构建或格式错误。
- 该快照仍不构成总目标停止点：R0-R9 受保护页面真实浏览器矩阵、ownership 隔离、最终 Code Review、Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证尚未完成。

### 2026-08-19：R4 轮询生命周期与 R9 AuthShell 动效令牌批次

- `PaymentStatusPanel`、`PaymentQRCodeView` 和 `StripePopupView` 现在把临时轮询失败留在既有重试窗口内；组件卸载后，迟到请求、Stripe 初始化结果和延迟关闭回调不再更新状态、发出成功事件或关闭窗口。
- `StripePopupView` 对初始化超时、轮询 interval 和自动关闭 timeout 使用同一销毁 fence；不改变认证优先、签名恢复、支付终态或路由业务契约。
- `AuthShellView` 的 form-stage 动效改用 `--ui-motion-fast` 与 `--ui-ease-standard`，并保留 reduced-motion 下 `transition: none`。
- 定向回归为 4 files / 21 tests；`pnpm run test:run` 为 350 files / 2281 tests 全部通过，`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过。生产构建 3102 modules transformed，39.04s 完成。
- 仅保留既有 Browserslist、Lottie eval、动态/静态 import 共存和大 chunk 提示；该批仍不替代受保护页面浏览器矩阵、ownership、Code Review 或 Release/线上更新闭环。

### 2026-08-19：R1 领域兼容组件行为契约批次

- 新增 `ImageUpload.spec.ts`：锁定隐藏原生文件选择器触发、image/SVG accept、大小与 MIME 拒绝、图片 data URL、SVG trim/sanitize、预览、清除和 FileReader 失败语义。
- 新增 `ProxySelector.spec.ts`：真实挂载验证 shared combobox accessible name、compact/search/clear 属性、null/number 值归一化、单代理成功与失败重试、批量并发及重复提交锁。
- `UiCombobox` 新增与 `UiSelect` 对齐的 `ariaLabel` prop，避免未定义可见 label 覆盖调用方的 `aria-label`；其余选项、payload、测试 API 和页面布局不变。
- 定向新增回归 2 files / 9 tests；`pnpm run test:run`：352 files / 2290 tests 全部通过；`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过。生产构建 3102 modules transformed，41.90s 完成。
- 本批仅补本地组件契约，不能替代 R1 页面三视口、账户/Settings 浏览器矩阵、ownership 隔离、最终 Code Review 或 Release/线上更新验证。

### 2026-08-19：R2 TOTP 与 R5 MonitorCard 例外契约批次

- `TotpLoginModal.spec.ts` 扩展为 4 tests，覆盖六位数字自动提交、`one-time-code` 自动填充、粘贴清洗/焦点、空格退格回退、验证中禁用以及错误后清空并聚焦首格。
- 新增真实 `MonitorCard.spec.ts` 3 tests，验证 compound exception 的原生 button/type、可见 monitor/provider/model accessible name 与 detail click；保留 `MonitorCardGrid` 的列表转发测试。
- 本批不改 TOTP 或 monitor 业务/API/布局实现，仅补例外清单要求的本地行为证据。
- `pnpm run test:run`：353 files / 2296 tests 全部通过；`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过。生产构建 3102 modules transformed，27.48s 完成。
- 认证/monitor 真实三视口、dark、reduced-motion、keyboard、slow/error、console 浏览器矩阵，以及 ownership、Code Review、Release/线上更新仍未完成。

### 2026-08-19：R7 AccountTestModal 媒体例外证据补充

- 扩展 `AccountTestModal.spec.ts` 的 `UiImagePreview` stub，使生成图片缩略图点击、`show/src/alt` 传递和 close 清理可被直接观察；不改变图片流解析、账户 API 或媒体按钮布局。
- 该 spec 4 tests 通过；随后 `eslint`、`vue-tsc --noEmit` 和 `git diff --check` 通过。全量数量保持 353 files / 2296 tests。
- 本地媒体例外证据不替代管理员页面的真实三视口、dark、reduced-motion、keyboard、console 浏览器验收。

### 2026-08-19：发布版本只读核对（未触发发布）

- `docs/RELEASE_VERSION_POLICY.md` 要求新版本使用整数 `qiu.N`；当前源码版本为 `0.1.176-qiu.2`，origin 最新 Qiu tag/release 也是 `v0.1.176-qiu.2`。
- upstream 已公开稳定 tag/release `v0.1.178`；按策略，若先完成 upstream 基线同步，候选 Qiu 版本应为 `v0.1.178-qiu.1`，不能直接沿用旧 `0.1.176` triplet。upstream tag 的 VERSION 文件仍写 `0.1.177`，因此必须在版本变更前由发布负责人确认“官方 tag 优先”的基线口径。
- 本次只读核对确认 update source 仍为 `qiufengawa/sub2api`，release workflow 的 tag regex 接受整数 `qiu.N`；没有改 VERSION、创建 tag、推送分支、触发 workflow、写 GHCR 或改旧版更新逻辑。
- 当前工作树仍包含其他线程 backend 修改、未跟踪资产和大量未提交 frontend 变更，尚不满足 ownership 隔离与发布前“只提交本目标文件”条件。

### 2026-08-19：旧版更新解析器只读核验（未触发更新）

- 读取 `backend/internal/service/update_service.go` 与现有 `update_service_test.go`：解析器接受 `vX.Y.Z-qiu.N` 及历史兼容的 `vX.Y.Z-qiu.N.P`，按 upstream 三段版本优先、再按整数 Qiu revision 比较；测试覆盖同基线递增、数字比较、`v` 前缀、无效零/前导零和不支持格式。
- 运行 `cd backend && go test -tags=unit ./internal/service ./internal/repository -run 'Test(ParseVersion|CompareVersions|UpdateServiceDetectsQiu|GitHubReleaseClientAPIRequestAuthorization)'`：两个包通过（`internal/service` 2.203s、`internal/repository` 1.245s）。这证明当前已部署格式的整数 `qiu.N` 候选可被发现/比较，但不证明候选版本已发布或线上更新链路可用。
- 仍未修改 backend 更新逻辑；由于 upstream `v0.1.178` tag 内 VERSION 为 `0.1.177`，候选基线仍需发布负责人确认，且 ownership、授权浏览器、Release/GHCR/线上证据未完成。

### 2026-08-19：R4 二维码失败/取消终态文案补强

- `PaymentQRCodeView` 不再把 `FAILED` 或 `CANCELLED` 误报为 `Order Expired`；分别复用既有支付失败/取消文案与说明，保留 `RECHARGING` 成功跳转、取消按钮、恢复 token 和订单 payload。
- `PaymentQRCodeView.spec.ts` 新增 FAILED/CANCELLED 终态断言；定向回归 7 tests 通过，随后 ESLint 与 `vue-tsc --noEmit` 通过。
- 本地修复不替代支付供应商 sandbox、双标签回跳和三视口浏览器验收。

### 2026-08-19：R9 quota 进度条宽度动效收口

- 移除 `UserDashboardQuickActions` 配额进度条的 `transition-all`，避免动态 width 产生布局宽度动画；数值计算、颜色阈值和展示结构不变。

### 2026-08-19：R4 QR/R9 动效批次后的完整前端门禁快照

- `pnpm run test:run`：353 files / 2298 tests 全部通过；本批新增 QR `FAILED/CANCELLED` 终态用例已纳入全量。
- `pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`、`git diff --check` 全部通过；生产构建 3102 modules transformed，27.41s 完成。
- 仅保留既有 Browserslist、Lottie eval、动态/静态 import 共存和大 chunk 警告；受保护浏览器、ownership、Code Review、Release/GHCR/线上更新仍未完成。

### 2026-08-19 支付轮询生命周期与二维码终态回归

- `PaymentQRCodeView` 对 FAILED/CANCELLED 使用独立终态文案，并在轮询、倒计时、取消请求卸载后阻断迟到响应；`PaymentStatusPanel` 同步阻断迟到倒计时/取消状态写入。
- 定向 QR/PaymentStatusPanel 回归共 21 tests 通过；全量 `pnpm run test:run` 为 353 files / 2300 tests 全部通过。
- 随后 `pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build` 与 `git diff --check` 全部通过；生产构建 3102 modules transformed，24.89s 完成。
- 受保护浏览器矩阵、ownership 隔离、最终 Code Review、Release/GHCR/线上更新仍未完成。

### 2026-08-19 Stripe 弹窗多币种回归

- Stripe 弹窗 URL 透传 `currency`，弹窗金额改用共享支付金额格式化器，不再固定显示人民币；新增多币种显示回归。
- 最新全量前端门禁为 353 files / 2301 tests；typecheck、lint、build（3102 modules，25.74s）和 `git diff --check` 通过。
- 真实 Stripe sandbox、双标签回跳、授权浏览器矩阵、ownership、Code Review 与 Release/线上更新仍未完成。

### 2026-08-19 R9 disclosure 与模板动效收口

- Ops 系统日志高级筛选/运行时配置按钮补齐 `aria-controls` 与稳定区域 id，并加入交互回归；PaymentMethodChart、EndpointPopover、ProviderCard 移除未登记的 `transition-all`/宽度动效。
- 最新共享工作树全量为 353 files / 2303 tests；typecheck、lint、build（3102 modules，25.90s）和 `git diff --check` 通过。
- 该共享树仍不替代 ownership 隔离、受保护浏览器矩阵、最终 Code Review 或 Release/线上更新证据。

### 2026-08-19 R9 共享 disclosure 语义收口

- `UiAccordion` 与 `UiSideNavGroup` 补齐稳定 body id、`aria-controls` 和 `ui-focus-ring`，新增 2 个共享组件契约测试。
- 最新全量前端门禁为 354 files / 2305 tests；typecheck、lint、build（3102 modules，25.00s）和 `git diff --check` 通过。
- 受保护浏览器矩阵、ownership 隔离、最终 Code Review、Release/GHCR/线上更新仍未完成。

### 2026-08-19 R5/R6 异步边界与 disclosure 收口

- V2 Monitor 统一识别 `AbortError`/`CanceledError`/`ERR_CANCELED`，卸载时使主请求与 tab 请求序列失效；Available Channels 详情按钮补齐 `aria-controls`。
- 管理员订阅高级筛选补齐受控区域关系，assign/extend/revoke/restore 增加函数级防重入与确认 pending；新增 2 个行为测试。
- 最新全量前端门禁为 354 files / 2307 tests；typecheck、lint、build（3102 modules，24.49s）和 `git diff --check` 通过。
- 该本地证据不替代真实 Monitor/Available Channels 数据、受保护管理员浏览器矩阵、ownership、Code Review 或 Release 闭环。

### 2026-08-19 R5 Batch Image API-key single-flight 收口

- `BatchImageGuideView.loadApiKeys` 增加单飞 promise、AbortSignal、序列失效和卸载取消；创建弹窗在初始请求 pending 时不会重复发起 `/keys`，迟到响应/取消错误不会写入已卸载页面或弹出错误 toast。
- `BatchImageGuideView.spec.ts` 新增 pending-load 去重与 unmount abort 回归，聚焦套件为 7 tests passed。
- 最新共享工作树全量前端门禁为 354 files / 2309 tests；typecheck、lint、build（3102 modules）和 `git diff --check` 通过。
- 该本地证据不替代 R51 填充数据、受保护页面三视口/dark/reduced-motion/keyboard/console 浏览器矩阵、ownership、Code Review 或 Release/GHCR/线上更新闭环。

### 2026-08-19 R6 Admin Subscriptions failure-state 收口

- 管理订阅列表区分 initial loading 与 refresh，首屏失败显示可重试 `UiErrorState`，刷新失败保留旧行并显示 inline danger alert；新增首屏失败/重试与刷新失败保留行回归。
- `UiConsumerInventory` 统计基线随新增 `UiErrorState` 及共享状态组件生产导入更新为 1880 runtime references / 276 production consumer files。
- 最新共享工作树全量前端门禁为 354 files / 2311 tests；typecheck、lint、build（3102 modules）和 `git diff --check` 通过。
- 该本地证据不替代 R6 受保护管理员浏览器矩阵、ownership、Code Review 或 Release/GHCR/线上更新闭环。

### 2026-08-19 R8 Announcement read recovery 收口

- 公告单条已读失败不再被 store 吞掉：公告中心可提示错误，未读状态保持；popup dismissal 失败时恢复原公告并保留后续队列，成功后才推进下一条，reset 同步清理过渡 timer。
- 新增公告 store 2 tests 与 Bell 失败提示 1 test，公告定向套件 3 files / 8 tests 通过。
- 最新共享工作树全量前端门禁为 355 files / 2314 tests；typecheck、lint、build（3102 modules，24.71s）和 `git diff --check` 通过。
- 该本地证据不替代 R8 受保护浏览器 slow/error、keyboard/screen-reader、ownership、Code Review 或 Release/GHCR/线上更新闭环。

### 2026-08-19：R1/R9 认证错误关联与 Usage disclosure 语义补充

- Login、Register、Forgot Password、Reset Password 的共享 `AuthTextField` 现在传递字段级错误文本，确保 `aria-describedby` 指向实际错误节点；保留原有校验、toast、提交与 payload 行为。
- Usage 移动端“更多筛选”按钮补齐 `aria-expanded`/`aria-controls`，并为受控高级筛选区域提供稳定 id；筛选值、查询触发和响应式布局不变。
- 定向回归：认证 ResetPassword 5 tests、Usage 15 tests；typecheck 与 lint:check 通过。浏览器矩阵、ownership 隔离、最终 Code Review 和 Release/线上更新仍未完成。

### 2026-08-19：R9 Payment tab ARIA 关系补充

- PaymentView 的充值/订阅 tabs 现在显式生成与现有 tabpanel 对应的 `id`、`aria-controls`，并新增回归断言验证 panel 的 `aria-labelledby` 回指；不改变 active tab、支付选择或订单状态机。
- PaymentView 与共享 UiTabs 定向回归 30 tests 通过；`vue-tsc` 与相关 ESLint 检查通过。受保护浏览器、ownership、Code Review 和 Release/线上更新仍未完成。

### 2026-08-19：R3 Keys 请求卸载边界补充

- KeysView 在卸载时主动中止当前 key 列表请求并清除 controller，避免离开页面后继续加载 usage stats 或写入组件状态；保留既有筛选、分页、排序和错误语义。
- KeysView 定向回归扩展为 21 tests，覆盖 active request 的 AbortSignal 在 unmount 后变为 aborted；`vue-tsc`、相关 ESLint 与 `git diff --check` 通过。
- 本地异步边界证据不替代 Keys 真实数据、受保护浏览器三视口/主题/键盘验收、ownership、Code Review 或 Release 闭环。

### 2026-08-19：R4 Payment/Airwallex 卸载生命周期补充

- PaymentView 引入 lifecycle epoch，建单、微信 JSAPI、移动二维码 fallback、微信回跳恢复、订阅刷新和结果页导航的异步延续在写状态、恢复快照、toast 或导航前核对组件仍存活；Airwallex SDK import/init 完成后同样检查 disposed。
- 不取消可能已在后端落库的建单写请求，只阻断卸载后的前端迟到副作用，因此不改变 API payload、支付状态机或恢复 token 契约。
- PaymentView/Airwallex 定向回归 22 tests 通过，新增“建单响应晚于 unmount 不写 storage/不导航”和“SDK init 晚于 unmount 不拉起 checkout”覆盖；`vue-tsc` 与相关 ESLint 通过。
- 真实支付供应商 sandbox、双标签/外部回跳、ownership、Code Review 与 Release/线上更新仍未完成。

### 2026-08-19：R2 OAuth callback 状态与恢复入口补充

- LinuxDo、WeChat、OIDC、DingTalk callback 在初始 exchange 阶段显示共享 `UiSpinner`/`role=status`，失败后保留既有 toast 并显示 inline danger alert 与返回登录动作，不再留下只有标题的空壳。
- invitation、pending account chooser、create/bind、TOTP、profile adoption、redirect、token persistence 与 provider-specific 分支均保持原位置和 payload。
- 四个 callback 定向回归 4 files / 65 tests 通过，除 provider-denied inline recovery 外，四页均覆盖 initial exchange 挂起期间的 processing status 与失败切换；`vue-tsc` 与相关 ESLint 通过。
- OAuth provider/Captcha 真实 HTTPS、第三方 cookie/popup、受保护浏览器矩阵、ownership、Code Review 与 Release 仍未完成。

### 2026-08-19：R5 Batch Image 多 Key 全局分页连续性补充

- Batch Image 列表不再把同一全局 offset 直接套给每个 Key 后丢弃合并溢出行；改为同一缓存代次内按 Key 保存前缀、raw offset 与 exhausted 状态，原子扩展到当前全局页末后一条，再稳定归并切页。
- 筛选、页长、显式刷新及列表 mutation 会重建缓存代次；返回已加载页复用缓存。父项不在当前页的 child 作为 orphan child 行展示，避免页边界吞行。
- Batch Image 定向回归扩展为 10 tests，新增两个 Key 各 25 条、三页连续且返回缓存页不重复请求的反例覆盖，并区分首屏 API-key/job-list 错误；`vue-tsc`、相关 ESLint 与 `git diff --check` 通过。
- 服务端 API 只有 per-Key OFFSET/has_more、没有 snapshot token，因此该算法保证同一缓存代次/静态数据集的全局连续性；实时新增/删除期间的强快照一致性仍需后端契约，未在 R0-R9 阶段修改。

### 2026-08-19：最新共享工作树全量门禁

- `UiConsumerInventory` 已同步为 114 contracts / 276 production consumer files / 1880 runtime references，未知、namespace 与 dynamic 公共出口导入仍为 0。
- `pnpm run test:run`：355 files / 2357 tests 全部通过；`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build` 与 `git diff --check` 全部通过；生产构建为 3102 modules transformed。
- 该结果属于当前共享脏工作树，仅证明现状门禁通过；ownership 隔离后的复验、受保护浏览器矩阵、最终 Code Review、Release/GHCR/checksum/latest、旧版更新发现与线上更新仍未完成。

### 2026-08-19：R4 支付恢复存储与退款终态收口

- payment recovery 的 Storage 读写删除均改为 best-effort，Storage 抛出 `SecurityError` 等异常时不再中断支付主流程、结果页查询或终态导航；并发订单仍按 resume token/order/trade identity 隔离。
- `REFUNDED`、`PARTIALLY_REFUNDED`、`REFUND_FAILED` 从 provider/未知 pending 分支中剥离为明确终态，停止结果页轮询并清理当前 identity；结果标题、说明与 badge 使用真实退款语义。
- User Orders 的取消与退款确认增加函数级防重入；定向 paymentFlow / PaymentResult / UserOrders 回归为 3 files / 60 tests，typecheck 与相关 ESLint 通过。
- 真实 refund provider sandbox、Storage 策略异常浏览器、ownership 隔离、受保护浏览器矩阵、最终 Code Review 与发布闭环仍未完成。

### 2026-08-19：R6/R7 管理员 mutation 防重入收口

- Accounts 单项删除、schedulable 与批量删除/清错/刷新 token/上游账单探测/schedulable 更新加入函数级 pending guard；批量工具条统一 disabled/`aria-busy`，Scheduled Tests 的 create/edit/delete/enabled toggle 同步补 guard。
- Usage Cleanup 创建/取消、Admin Orders 取消/重试/退款/退款查询、Users 状态切换/删除均增加函数级 single-flight；按实体 ID 可并行不同实体，但同一 mutation 不再因同 tick、键盘或程序化重复触发而并发。
- 本批定向验证为 Accounts 3 files / 17 tests、Scheduled/Usage Cleanup 2 files / 10 tests、Admin Orders/Users 2 files / 11 tests；各批 typecheck 与相关 ESLint 均通过。
- 本地行为测试不替代真实管理员会话、慢请求失败恢复、ownership 隔离、最终 Code Review 或发布闭环。

### 2026-08-19：支付与管理员 single-flight 后全量门禁

- `pnpm run test:run`：355 files / 2357 tests 全部通过；`pnpm run lint:check`、`pnpm run build`（含 TypeScript project check，3102 modules transformed）与 `git diff --check` 全部通过。

### 2026-08-19：最终 Code Review 修复

- WeChat 恢复二维码兜底保留 `wechat_resume_token`；Settings 失败确认与 Usage Cleanup 失败/进行中状态均保持可重试且禁止重入。
- 隔离最终回归：355 files / 2357 tests、typecheck、lint、build（3102 modules）和 diff-check 全部通过；真实浏览器、provider sandbox 与发布闭环仍待完成。
- UI consumer inventory 保持 114 contracts / 276 production consumer files / 1880 runtime references；静态审计与消费者 AST 门禁均包含在全量测试中。
- 该快照仍来自共享脏工作树，不替代 ownership 隔离后的重跑、受保护浏览器矩阵、最终 Code Review、Release/GHCR/checksum/latest、旧版发现和线上更新验证。

### 2026-08-19：R3/R5 Keys 与 Batch Image 列表失败态收口

- Keys 首屏列表失败显示持久 `UiErrorState` 并可原位重试，已有行刷新失败保留旧数据与 inline alert；真实空集合继续使用创建 Key 空态。
- Batch Image 分别保存 API-key discovery 与 job-list 错误，首屏失败不再显示空任务，已有行刷新失败不丢表格；统一 retry 会重新执行 key 与 job 加载链路。
- Keys / Batch Image 定向回归为 2 files / 33 tests，typecheck 与相关 ESLint 通过。真实 eligible key、填充任务、三视口/主题/键盘、ownership 与发布门禁仍未完成。

### 2026-08-19：R4 PaymentResult 临时查询失败恢复

- 可信 `resume_token`、`order_id` 或 legacy return identity 的首次 resume/poll/public verify 全部临时失败时，结果页保持 processing 语义并沿用现有 2 秒刷新链路，不再提前折叠为最终支付失败或清除 recovery snapshot。
- 查询重试一旦取得订单即退出 lookup-pending，继续按原支付、失败和退款终态决定轮询与当前 identity 清理；裸 `out_trade_no` 和无身份旧参数仍保持既有失败边界。
- PaymentResult 定向回归为 24 tests；除自动恢复链外，新增 15 次自动查询耗尽后显示失败/显式重查、恢复为 `PAID` 并清理当前 identity 的覆盖。typecheck、相关 ESLint 与 diff-check 通过。

### 2026-08-19：R7 Accounts 单项 mutation single-flight 补充

- Accounts 的 refresh credentials、recover state、reset quota、set privacy、revert fallback 与 create Spark shadow 统一按账号 ID 加入函数级 single-flight；不同账号仍可并行。
- AccountActionMenu 在当前账号 mutation pending 时禁用相关入口，fallback 行按钮与 Spark `UiConfirmDialog` 同步接入 pending；失败后的 `finally` 释放状态并允许重试。
- Accounts/AccountActionMenu 定向回归为 2 files / 33 tests，覆盖五类 handler 重入、Spark 重复确认和菜单 pending；typecheck、相关 ESLint 与 diff-check 通过。

### 2026-08-19：浏览器验收运行时连接记录

- 独立 Vite 开发服务已启动于 `http://localhost:3001/`；默认 `3000` 已被既有进程占用，未访问该既有服务。
- 应用内 Browser 连接在运行时返回 `Browser use requires a trusted Node REPL browser service`，且没有可读取的 browser runtime/troubleshooting binding，因此本轮没有伪造截图或把 jsdom 结果记作浏览器证据。
- 404、Legal、Key Usage 和认证公开页已有仓库内三视口/主题/reduced-motion/keyboard/console 证据；受保护用户/管理员页面及 provider sandbox 仍需可信浏览器服务和真实会话后继续。

### 2026-08-19 受保护浏览器与最新前端门禁追加

- 通过一次性 PostgreSQL 复制库 `sub2api_browser_verify_20260819`、本地 Redis、`RUN_MODE=simple` 后端和 Playwright Chromium 151，真实登录 `admin@admin.com` 与 `test@test.com` 后复验管理员 `/admin/dashboard`、`/admin/users`、`/admin/settings`、`/admin/orders` 及用户 `/dashboard`、`/keys`、`/usage`、`/subscriptions`、`/purchase`、`/orders`。代表性页面均无 5xx 或横向溢出；`/keys` 覆盖 1440/900/390 三视口，`/keys` 390px 与管理员 `/admin/dashboard` 900px 的 dark/reduced-motion/keyboard 复验无 console/pageerror。验证数据库、后端进程和 Vite 进程已清理。
- 浏览器复验发现并修复 `KeysView` 不存在的 `common.apiKeys` 文案键，以及邮件模板 iframe 预览无法解析 MIME `cid:` 的 `ERR_UNKNOWN_URL_SCHEME`；后者仅替换浏览器预览内的安全占位图，不改变后端发送 HTML。新增/更新定向测试 25 项通过。
- 最新隔离前端门禁：`pnpm run test:run` 为 355 files / 2358 tests，0 failed；`pnpm run test:audit` 为 1 file / 10 tests；typecheck、lint、build（3102 modules）和 `git diff --check` 全部通过。仍不得停止：全站逐页 screen-reader/provider sandbox/支付双标签矩阵、绿色 CI、版本基线裁决和 Release/GHCR/线上更新闭环未完成。

## 19. 单一长任务执行入口

执行者必须读取本文件全文后，从当前工作区事实继续，不得重新创建第二套计划。按 `R0 -> R1 -> ... -> R9 -> 最终门禁 -> Code Review -> 发布与线上更新验证` 连续推进；每完成一个批次立即验证并记录，再继续下一批。不得因阶段完成、测试通过、截图完成或用户暂未回复而暂停。

执行者的最终回复只能在第 0 节“唯一完成点”满足后发送；最终回复必须列出 R0-R9 完成证据、门禁结果、Code Review 结论、Release URL、产物/checksum、GHCR/latest、旧版更新发现和线上更新验证。若仍有未完成事项，必须继续执行而不是汇报“已完成”。

### 2026-08-19：Code Review 修复 backend mode Stripe 恢复入口

- `backendModeAccess` 新增公开 `/payment/stripe` 与 `/payment/stripe-popup` 白名单；这两个路由的元数据本来就是 `requiresAuth: false`，用于 Stripe checkout/resume 和 popup 回跳。
- 路由守卫测试扩展为同时覆盖 `/payment/result`、Stripe 两个入口和 `/payment/airwallex`；定向 35 tests、相关 ESLint 通过。
- 该修复只影响前端导航白名单，不改变支付 API、订单状态机或后端契约；真实 Stripe sandbox、外部回跳和完整浏览器矩阵仍待授权环境。

## 2026-08-19 继续执行：隔离后端真实浏览器矩阵

- 使用一次性 PostgreSQL（15432）从 `sub2api_preview` 恢复数据，独立 Redis（16379）和临时 `DATA_DIR` 启动源码后端 18083；处理了复制库缺少 199/200 维护迁移的启动前置，未修改 backend 源码、共享数据库或共享 Redis。验证结束后后端、Vite、临时 PostgreSQL/Redis 均已停止。
- 真实登录矩阵：管理员 9 路由 × 1440/900/390 = 27 页，用户 12 路由 × 3 视口 = 36 页。所有目标路由均无登录回退/404、无横向溢出；dark、reduced-motion、5 次 Tab 和 console/pageerror 均采集。管理员 27/27 console clean；用户首次批量访问触发隔离实例限流后清理 `rate_limit:*`，Playground 900/390 单独复验 clean。
- 浏览器发现并修复：`AffiliateView` 在 390px 被默认 grid 最小内容轨道撑到 560px，改为 `grid-template-columns: minmax(0, 1fr)`；管理员 Usage 缺失 `usage.analytics` 中英文文案键；支付概览真实路由确认是 `/admin/orders/dashboard`，旧 `/admin/orders/payment-dashboard` 为 404。修复后 Affiliate、Admin Usage、Admin Payment Dashboard、Playground 均三视口无溢出且 console clean。
- 相关验收记录已追加真实截图索引和隔离环境边界：R3 Dashboard/Keys/Usage/Profile/Affiliate/Redeem、R4 subscriptions/orders、R6 admin subscriptions/usage、R7 payment dashboard/settings、R8 announcements 及最终门禁记录。
- 本轮前端门禁：定向 15 tests 通过；全量 `pnpm run test:run` 为 355 files / 2358 tests，0 failed；`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`（3102 modules）和 `git diff --check` 通过。
- 仍不可停止：真实 Stripe/WeChat/Airwallex sandbox、双标签外部回调、真实退款/导出/清理提交、screen-reader 工具证据、ownership 隔离、绿色 CI、安全扫描、版本基线裁决、Release/产物/checksum/GHCR/latest/旧版更新发现/线上更新验证均未形成完整闭环。

### 2026-08-19：继续核对外部发布门禁

- `origin/ui/main` 当前仍为 `c173dcc6463e3e26c6ac11569ffbf02a1e965a77`；可复核的最新 CI `31698041574` 和 Security Scan `31992691536` 均为失败，未形成绿色发布门禁。
- GitHub `releases/latest` 仍为非 draft/non-prerelease `v0.1.176-qiu.2`，六个平台归档和 `checksums.txt` 仍存在；官方 upstream latest 仍为 `v0.1.178`。
- 本次只读核对未修改 `VERSION`、tag、Release、GHCR 或部署元数据；upstream tag 内 VERSION 与官方 main 的基线冲突仍需发布负责人裁决。

### 2026-08-19：R5 浏览器证据索引复核

- `/tmp/sub2api-browser-matrix-clean.json` 的隔离用户矩阵包含 `/batch-image`、`/model-plaza`、`/playground` 各 1440/900/390，均记录无正文横向溢出；R5 汇总记录已引用该机器结果。
- 该矩阵没有 Available Channels、Monitor 或 Custom Page 路由，也没有真实 Key/SSE/image、填充任务、Monitor V2、成功自定义页或 screen-reader 证据；这些项目继续保持 pending。

### 2026-08-19：支付二维码与 Usage 日期范围无障碍修复

- Payment QR canvas now exposes a localized `role="img"` name and keeps a keyboard-usable payment URL fallback while the QR is visible; unsafe URLs remain rejected by the existing normalization path.
- Usage date range now passes a stable `id` and explicit accessible label so the visible label is associated with the date-range trigger instead of announcing only the current value.
- Focused PaymentQRCode/Usage suites pass 25 tests; related ESLint passes. This closes two code-level accessibility findings but does not replace screen-reader runtime evidence.

### 2026-08-19：无障碍修复后的最终本地门禁

- `pnpm run test:run`：355 files / 2360 tests，0 failed。
- `pnpm run test:audit`：10 tests passed；`pnpm run typecheck`、`pnpm run lint:check`、`pnpm run build`（3102 modules）和 `git diff --check` 均通过。
- 构建保留既有 Browserslist、第三方 Lottie `eval`、动态/静态 import 和大 chunk 警告；这些不是本轮新增失败。真实 screen-reader、provider sandbox、ownership 和发布闭环仍未完成。

### 2026-08-19：共享表单控件无障碍关联补强

- `UiStructuredEditor` 与 `UiTagInput` 现在生成或接受稳定 `id`，把可见 `UiFormField` 标签、描述/错误消息与实际 textarea/input 通过 `for`、`aria-describedby`、`aria-invalid` 关联；标签输入另支持显式 `ariaLabel`。
- `TotpLoginModal` 与 `TotpStepUpDialog` 的六位验证码输入增加 `role=group`、本地化组名和逐位 accessible name；键盘、粘贴、自动填充和提交逻辑未改变。
- `UiDateTimeRangePicker` 为开始/结束日期和时间传递稳定 id 与可见 label；`UiTimeInput` 支持 id 关联、错误描述和 `aria-invalid`，并保留原有时间选择行为。
- 聚焦回归：`UiExtendedComponents`、`TotpLoginModal`、`TotpStepUpDialog` 共 21 tests passed；typecheck 与定向 ESLint passed。真实 screen-reader、受保护浏览器、ownership、CI 和发布闭环仍 pending。
- 后续复核补强：`UiTimeInput` 生成无冲突 fallback id、使用 dialog 语义、对非法 minute step 做安全收敛并避免悬空 `aria-describedby`；`UiDateTimeRangePicker` 将范围级描述/错误关联到开始日期控件；`ModelTagInput` 传入可访问名称，`UiTagInput` 在空草稿时不再拦截 Tab；TOTP 输入会把净化后的单个数字同步回 DOM。聚焦回归更新为 22 tests passed。
- 本轮最终本地复验：`pnpm run test:run` 为 355 files / 2362 tests passed，`pnpm run test:audit` 为 10 tests passed；typecheck、定向 ESLint、生产 build（3102 modules）与 `git diff --check` 全部通过。既有构建警告仍为 Browserslist、Lottie eval、动态/静态 import 共存和大 chunk；真实 screen-reader/provider sandbox、ownership、CI、安全扫描、版本基线与 Release/GHCR/线上更新闭环仍未完成。
- `UiTree` 补充 tree/treeitem、selected/current 和 expanded 语义；`UiExtendedComponents` 聚焦套件更新为 15 tests passed。
- 该批完整复验：`pnpm run test:run` 为 355 files / 2363 tests passed，`pnpm run test:audit` 为 10 tests passed；typecheck、定向 ESLint 与 `git diff --check` 通过。生产构建上一轮已通过，真实 screen-reader/provider sandbox、ownership、CI、安全扫描、版本基线与 Release/GHCR/线上更新闭环仍未完成。
- 随后生产构建复验通过（3102 modules transformed，保留既有非阻塞 warning）。

### 2026-08-19：共享 Popover ARIA 契约修复

- `UiPopover` 默认 panel role 现在明确为 `menu`，触发器的 `aria-haspopup` 与传入的 `dialog/menu/listbox/tree` role 保持一致，不再出现触发器宣告 menu、面板却无 role 的矛盾状态。
- `UiDropdownMenu` 由 Popover 面板承担唯一 `role=menu`，避免嵌套 menu；Account groups、Users 筛选/排序和 `UiColumnPicker` 的 checkbox/info 弹层明确使用有名称的 dialog 语义。
- `UiPopover` 与 Users 聚焦回归共 10 tests passed；typecheck、定向 ESLint、`git diff --check` 通过。可信浏览器连接仍被运行时拒绝，本批未把组件测试冒充 browser/screen-reader 证据。

### 2026-08-19：发布门禁只读复核补充

- `origin/ui/main` 仍为 `c173dcc6463e3e26c6ac11569ffbf02a1e965a77`，本地 HEAD 相对 origin 超前 204 commits 且共享工作树非净；不满足发布前 ownership/clean-tree 门禁。
- 最新可复核 CI `31698041574` 失败，包含 golangci-lint 与 repository integration failures；Security Scan `31992691536` 失败，包含 frontend `nanoid` high advisory exception 缺口和 Go `1.26.5` 的 6 项可达标准库漏洞（修复于 `1.26.6`）。这些不是前端重构可以绕过的绿色门禁。
- 现有 `v0.1.176-qiu.2` Release 的六项资产/checksum 和 GHCR version/latest digest 可作为旧版基线；未发现该 `.2` tag 对应的成功 Release workflow 证据。上游稳定版已为 `v0.1.178`，新候选按策略只能是 `v0.1.178-qiu.1`，但当前未修改 VERSION、未创建 tag、未推送或发布。

### 2026-08-19：Frontend security 与 Popover 键盘门禁收口

- `nanoid` 公告 `GHSA-2v37-7h3g-55p8` 由传递依赖 `3.3.17` 精确 override 到兼容修复版 `3.3.18`；锁文件未跨 major，`pnpm why nanoid --prod` 的所有 Vue/PostCSS 路径均解析到 `3.3.18`。
- 使用官方 npm registry 生成 production audit 后，高危/严重项只剩仓库已有的两项 `xlsx` 正式例外；`tools/check_pnpm_audit_exceptions.py` 返回 `Audit exceptions validated.`，没有为 nanoid 新增例外。远端历史 Security Scan 仍为失败，需候选提交推送后的新 run 才能形成绿色证据。
- `UiPopover` 改用 Vue `useId()` 生成 hydration-stable trigger/panel id，未显式命名时由 trigger 关联 panel；menu/listbox 支持 ArrowUp/ArrowDown/Home/End，非 dialog 弹层按 Tab 正常关闭并离开，焦点陷阱只保留给 dialog。
- 全量复验：`pnpm run test:run` 为 355 files / 2366 tests passed；`pnpm run test:audit` 10 tests、typecheck（含于 build）、`pnpm run lint:check`、生产 build（3102 modules）、audit exception checker 与 `git diff --check` 全部通过。

### 2026-08-19：Go 1.26.6 发布工具链只读预验证

- 高风险独立复核确认发布工具链需同步 8 个现行位置：`backend/go.mod`、根/`backend`/`deploy` 三个 Dockerfile、backend CI 两处断言、Security Scan、Release workflow 和 `DEV_GUIDE.md`；只改 workflow 会导致 `GOTOOLCHAIN=local` 的 Docker 构建失败。当前因 R0-R9/browser/ownership 尚未闭环，未写入这些 backend/deploy/workflow 文件。
- 不改工作树执行 `GOTOOLCHAIN=go1.26.6`：`go version`、`go mod download`、`go mod verify` 通过；`govulncheck ./...` 返回 0 可达漏洞；server embed binary 与 account-priority-publisher 两个 `CGO_ENABLED=0` 构建通过。
- `go mod tidy -diff` 仅报告现有 `go.sum` 的 10 条冗余 checksum，不涉及版本升级或新依赖，未写文件。
- `make test-unit` 在 `go1.26.6` 与当前 `go1.26.5` 下均以同一断言失败：共享 backend 修改新增 `site_icon` 后，`TestAPIContracts/GET_/api/v1/admin/settings_falls_back_to_config_oauth_defaults` 仍期望 296 字段、实际 297。由此证明失败不是 1.26.6 回归，但当前 backend ownership 快照本身不满足绿色 unit gate；本线程未修改/回退该 backend 业务改动或测试。

### 2026-08-20：R5 异步失败态、安全与矩阵键盘收口

- `CustomPageView` 不再把登录 Bearer token 写入任意外部 iframe URL；用户 id、主题、语言和嵌入模式参数保持不变。公共设置冷启动失败现在显示可重试错误而不是误报页面不存在，空 Markdown 显示明确空态。
- Channel Monitor V2 首载失败现在显示 `UiErrorState` 并隐藏伪在线/空数据内容；已有快照刷新失败时保留旧数据、显示 stale 状态和页面内危险提示。Relay pulse matrix 改为单一 roving Tab stop，支持四向键与 Home/End。
- Batch Image 在卸载时使 models/jobs/detail/items 请求序号全部失效，避免离开页面后的迟到回写或错误 toast。Available Channels 已复核具备首载、刷新、乱序、卸载和填充行自动化覆盖。
- R5 聚焦回归为 6 files / 40 tests；随后单次完整 `pnpm run test:run` 为 356 files / 2374 tests，0 failed。`pnpm run test:audit` 10 tests、typecheck、全量 lint、生产 build（3102 modules）和 `git diff --check` 全部通过；UI consumer inventory 同步为 114 contracts / 276 production consumer files / 1881 runtime references。
- 可信 Browser 服务仍返回 `Browser use requires a trusted Node REPL browser service`。Available Channels live rows、Batch populated jobs、Playground SSE/image、Monitor V2 live data、Custom Page success fixture、screen-reader、provider sandbox、backend unit、远端绿色 CI/Security Scan、ownership、版本与 Release/GHCR/线上更新闭环继续 pending；未修改 VERSION、tag 或发布元数据。

### 2026-08-20：CI 与版本发布门禁只读复核

- origin 最新可复核的 `ui/main` CI `31698041574` 与 Security Scan `31992691536` 仍为失败；CI 的 frontend job 已通过，红灯分别来自历史 backend test/golangci-lint、Go 1.26.5 govulncheck，以及当时尚未登记的 `nanoid` 审计例外。当前工作树已将 nanoid 精确固定到 3.3.18，但未修改 backend Go toolchain 或 workflow，因此不能把历史 run 重新解释为绿色证据。
- 发布审计确认官方 upstream 稳定版为 `v0.1.178`，策略要求同步该基线后候选使用整数格式 `v0.1.178-qiu.1`；当前 `ui/main` 未包含 upstream 0.1.178 祖先、工作树仍有 353 个跨线程变更，故未修改 `backend/cmd/server/VERSION`、未创建 tag、未推送 Release/GHCR。
- 旧版线上基线仍为 `v0.1.176-qiu.2`；其 GitHub Release 六个平台资产与 checksums 已核对，GHCR 新旧 digest 和新候选更新发现/线上更新仍未形成证据。目标继续保持未完成。

### 2026-08-20：R5 Batch Image 聚合下载修复与本地门禁刷新

- 修复详情弹窗下载按钮仍读取原始根任务状态的问题：根任务失败/取消但重试子任务补齐成功时，下载门禁现在使用已聚合的 `currentDisplayJob`，请求仍使用根任务 ID，不改变下载 API 契约。
- 新增回归覆盖聚合状态完成后的详情下载可用性与根任务下载调用；Batch Image 定向套件为 13 tests passed。
- 修复后的前端全量门禁：`pnpm run test:run` 为 356 files / 2375 tests，0 failed；`pnpm run typecheck`、`pnpm run lint:check`、生产构建（3102 modules）和 `git diff --check` 全部通过。构建保留既有 Browserslist、Lottie eval、动态/静态 import 和大 chunk 非阻塞警告。
- R5 探针另提出 `prompt_preview` 可能截断导致重试 payload 变化的风险；当前 API 类型与后端契约未证明该字段是否完整，本轮未擅自修改后端协议，保留为待契约确认项。可信 Browser、screen-reader、provider sandbox、backend/远端 CI、安全扫描、ownership、版本和 Release/GHCR/线上更新仍 pending。

### 2026-08-20：Batch Image 重试契约边界核验

- 后端 `createPendingItems` 将提交 prompt 以 `truncateBatchImageMessage(item.Prompt, s.maxPromptChars())` 写入 `prompt_preview`；公开 item DTO、数据库 schema 和 repository 都没有完整 prompt 字段。当前默认校验限制为 8000 字符，因此新提交通常不会截断，但历史数据、配置变化和旧记录不能保证 preview 可重放。
- 失败重试还缺少可从 item API 恢复的 reference images、output count 和 aspect ratio；前端不能安全地把 `prompt_preview` 当作完整重试输入，也不能在不改变后端/API 契约的前提下补齐这些字段。
- 本轮保持现有 API 与后端不变，未用猜测性前端缓存或静默改写 payload 冒充修复；该项记录为后端专用 retry endpoint 或受保护完整输入 DTO 的后续契约阻塞。R5 其他可在前端范围内修复项已继续推进。

### 2026-08-20：R9 rich choice 动效令牌化

- `CreateAccountModal` 与 `EditAccountModal` 的 provider/account-type rich choice cards 将 `transition-all` 收窄为 `transition-colors`，保留选中、hover、边框和背景反馈，避免隐式布局属性动画。
- 静态审计新增 `transition-all` 禁止契约，防止新的页面级 blanket transition 回归。
- StripePaymentView 删除页面级 `:deep(*)`/`!important` reduced-motion 覆盖，统一依赖全局 UI motion tokens；静态审计同步锁定该页面不得恢复 blanket descendant override。
- HomeSiteHeader 删除冗余的全后代 `transition: none !important` 覆盖；首页专属 hero 动画仍保留显式 reduced-motion 分支，公共控件继续由全局 tokens 管理。

### 2026-08-20：R9 动效收口后的全量门禁

- `pnpm run test:run`：356 files / 2375 tests，全部通过；`pnpm run typecheck`、`pnpm run lint:check`、生产构建（3102 modules）和 `git diff --check` 全部通过。
- `pnpm run test:audit`：10 tests passed；新增的 `transition-all` 静态契约与现有原生控件、旧视觉、动态导入和 reduced-motion 审计均通过。构建警告仍限于既有 Browserslist、Lottie eval、动态/静态 import 和大 chunk。

### 2026-08-20：发布门禁外部状态刷新

- `origin/ui/main` 仍为 `c173dcc6463e3e26c6ac11569ffbf02a1e965a77`；上游 `v0.1.178` tag 仍存在，但当前 HEAD 尚未整合该祖先，工作树仍有 353 项混合变更。
- `qiufengawa/sub2api` 最新可复核 runs 仍为历史失败的 CI `31698041574` 与 Security Scan `31992691536`，没有候选提交的绿色 workflow 证据。
- GitHub latest 仍为正式版 `v0.1.176-qiu.2`，六个平台归档和 `checksums.txt` 存在；未创建新 tag/Release、未修改 VERSION、未验证新候选 GHCR/latest 或线上更新。

### 2026-08-20：前端裸 transform 过渡 reduced-motion 收口

- `SettingsView` Web Search provider、`CreateAccountModal` OAuth advanced、`PaymentProviderDialog` limits 和 `VersionBadge` 两处 chevron/hover 过渡统一改为 `motion-safe:transition-transform`；键盘、ARIA、展开和旋转状态保持不变，reduced-motion 偏好下不再启用非必要 transform transition。
- `SettingsViewLayout.spec.ts` 保留页面契约；全局 `frontendRefactorStaticAudit.spec.ts` 新增裸 Tailwind `transition-transform` 禁止规则。定向组件/审计回归 3 files / 48 tests、ESLint、typecheck、静态审计 10 tests 均通过。
- 当前共享树全量门禁：`pnpm run test:run` 356 files / 2377 tests，生产构建 3102 modules，lint、typecheck 和 `git diff --check` 全部通过；警告仍为既有 Browserslist、Lottie eval、动态/静态 import 和大 chunk。
- 该修复只关闭一个前端 reduced-motion 源码门禁，不关闭受保护页面读屏/provider sandbox、ownership、backend unit、远端 CI/Security、版本、Release/GHCR 或线上更新验证。

### 2026-08-20：发布外部状态只读刷新

- `gh run list --repo qiufengawa/sub2api` 仍显示 `ui/main` CI `31698041574` 与 Security Scan `31992691536` 为 failure；同 SHA 的 `31698041430` 成功不能替代最新失败 run。
- `gh api repos/qiufengawa/sub2api/releases/latest` 仍返回正式版 `v0.1.176-qiu.2`，六个平台归档与 `checksums.txt` 齐全，draft/prerelease 均为 false；没有当前候选版本 Release/GHCR/update verification 证据。
- 当前共享树 status 为 397 paths（315 tracked changed + 82 untracked），其中 12 个 backend 路径越界；HEAD `5c5eee3c` 尚未整合 upstream `v0.1.178`。ownership、backend unit、远端绿 CI/Security、版本与发布闭环继续阻塞，未触碰 VERSION/tag/Release/GHCR。

### 2026-08-20：ownership 隔离树只读复核

- `/private/tmp/Sub2API-frontend-ownership-final-20260819` 与当前 HEAD 同为 `5c5eee3c`，status 为 314 个目标文件修改，越界路径筛选结果为 0。
- 该隔离树尚未包含本轮最新 motion-safe 过渡修复，且仍不是 clean ownership 候选；不能用它替代当前共享树的最终复验或发布前清洁工作区。

### 2026-08-20：R3 验收文档历史口径同步

- R3 Dashboard/Keys/Usage/Profile/Affiliate/Redeem 文档中与后续隔离浏览器复验矛盾的旧 pending 语句已标注为历史基线；当前章节保留真实三视口、主题、reduced-motion、键盘和 console/pageerror 证据范围。
- 明确保留未完成边界：真实导出/破坏性清理、成功兑换、外部邮件/TOTP/passkey、读屏和完整受保护页面总矩阵仍不能宣称通过；R3 文档只做证据口径同步，不改变业务契约。

### 2026-08-20：最后一轮本地无障碍与自动化复验

- `UiSlider` 支持显式 `aria-label`/`aria-labelledby`，Playground 的 temperature、top-p、frequency penalty、presence penalty 滑块均补齐可访问名称。
- `UiFileUpload` 进度条改为 `role=progressbar`，提供稳定的 `aria-valuemin/max/now` 与可配置标签，并覆盖超范围值归一化测试。
- `UiDateRangePicker` 点击外部关闭统一走焦点恢复路径，新增外部点击关闭/焦点回归。
- 共享工作树最新全量门禁：`pnpm run test:run` 为 357 files / 2428 tests，`pnpm run test:audit` 为 13 tests，typecheck、lint、生产构建（3103 modules）和 `git diff --check` 全部通过；新增 `UiSlider` accessible-name 回归为 1 test。
- 仍不可宣称总目标完成：受保护页面 live browser、真实 screen-reader/provider/destructive 流程、远端 CI/Security、候选版本/Release、GHCR/latest、旧版 updater 与线上更新证据仍未闭环；未修改 VERSION、tag、Release 或 GHCR。

### 2026-08-20：消费者统计口径复核

- 权威 `CONSUMER-INVENTORY.md` 与最终门禁/R9 历史快照已统一标注：当前为 114 contracts / 276 production consumer files / 1884 runtime references，1869/1880/1883 仅保留为历史快照。
- `UiConsumerInventory` 与 `UiSlider` 定向回归 3 tests 通过，`git diff --check` 通过。
- 当前总进度更新为 87%；R7 Settings、R10 Channels、R6 Admin Usage 的剩余领域迁移，以及受保护浏览器、provider sandbox、远端 CI/Security、Release/GHCR/updater 仍未闭环。

### 2026-08-20：Settings 紧凑控件残留收口

- Settings 两处默认订阅计划 `Select` 改用共享 `density="compact"`，删除页面级 `:deep(.select-trigger)` 高度覆盖及未使用的删除按钮高度样式；API/payload 未改变。
- `SettingsViewLayout` 增加默认订阅选项密度断言；共享树与 ownership 隔离候选 Settings/静态审计套件均为 60 tests 通过。
- 隔离候选 typecheck、lint、3103-module production build 和 `git diff --check` 全部通过；当前可证明进度为 89%。
- Channels/Usage 领域迁移、受保护浏览器与 screen-reader/provider/destructive 证据、远端 CI/Security、Release/GHCR/updater 仍未闭环。

### 2026-08-20：Channels 内部控件验收口径校正

- 复核确认 Channels 生产路径的分组选择、模型映射、账户规则搜索、定价条目和区间编辑均已使用共享 `Ui*` 控件；裸控件扫描为 0。
- Channels 定向回归（ChannelsView、PricingEntryCard、类型契约）为 3 files / 13 tests 通过；R10 文档已移除过时的“内部控件待迁移”表述。
- 当前可证明进度更新为 90%；管理员真实浏览器/读屏/mutation 证据、Usage 领域旧视觉收口及外部 CI/Release/updater 门禁仍未完成。

### 2026-08-20：Admin Usage 控件口径复核

- `UsageFilters`、`UsageTable`、`OpsErrorLogTable` 已确认使用共享表格、筛选、按钮、徽标和列设置合同；生产模板无裸表单控件，旧记录中的“内部控件待收口”已改为历史口径。
- UsageView、UsageCleanupDialog、OpsErrorLogTable 隔离定向回归共 28 tests 通过；共享树/隔离树 diff-check 通过。
- 当前可证明进度更新为 91%；剩余为真实导出/清理 mutation、慢请求/取消浏览器证据、受保护页面/读屏/provider 证据和远端发布更新门禁。

### 2026-08-20：UiCommandMenu 公共契约补强

- `UiCommandMenu` 补齐 combobox/listbox 关系、稳定 option id、`aria-selected`/`aria-activedescendant`、禁用项跳过，以及 Arrow/Home/End/Enter 键盘操作。
- 共享树与 ownership 隔离候选新增回归均为 2 tests 通过；隔离候选全量门禁为 359 files / 2430 tests，静态审计 13 tests、typecheck、lint、3103-module build、diff-check 全部通过。
- 当前可证明进度更新为 94%；剩余仅保留真实受保护页面/读屏/provider/destructive 证据、远端 CI/Security、Release/GHCR/latest 与旧版 updater/线上更新门禁。

### 2026-08-20：最终本地审计复核

- 前端生产依赖已包含 `nanoid@3.3.18` override 与 lockfile 解析；该修复对应远端 Security Scan 报告的 nanoid advisory。
- `go test -tags=unit ./internal/service ./internal/repository` 通过；updater 解析、Qiu revision 比较、强制检查和下载路径均有现有单元覆盖。
- 当前没有可在无外部权限情况下安全完成的本地替代项：旧版线上发现需要真实旧二进制，GHCR 需要鉴权，Release 需要候选版本，受保护页面/provider 需要认证会话与可信浏览器。

### 2026-08-20：依赖与发布前安全复核

- `pnpm audit --prod` 当前结果为 2 个 high、0 个 critical；两项均为已登记、动态导出场景限定的 `xlsx` 例外。
- `python3 tools/check_pnpm_audit_exceptions.py --audit frontend/audit.json --exceptions .github/audit-exceptions.yml` 通过；`nanoid@3.3.18` override 已锁定并消除此前远端前端 advisory。
- 当前可证明进度更新为 95%；剩余为远端 CI/Security 基线修复、候选 Release/产物/checksum/GHCR、旧版 updater 真实二进制和受保护浏览器/provider 证据。

### 2026-08-20：Settings provider 折叠控件语义收口

- Web Search provider 折叠头不再把 `Select` 与删除按钮嵌套在 `role="button"` 容器内；展开触发器改为独立的 `UiIconButton`，保留 `aria-expanded`、`aria-controls`、旋转图标与原有展开逻辑。
- Settings 回归测试改为验证真实按钮触发器、面板关系及无 Select 嵌套；Settings 定向套件为 2 files / 44 tests passed。
- 修复后的共享树全量门禁：`pnpm run test:run` 为 356 files / 2377 tests，`test:audit` 为 10 tests，typecheck、lint、生产构建（3102 modules）与 `git diff --check` 均通过；构建仅保留既有非阻塞 warning。
- 该源码级无障碍修复不替代真实管理员 screen-reader、键盘、三视口、console-clean、ownership、远端 CI/Security 或发布闭环证据。
- 独立语义复核确认 `EndpointPopover` 的 endpoint 复制 code、复制按钮和测速链接为同级控件，未发现新的嵌套交互或键盘语义缺口。
- provider disclosure 面板改用 `v-show` 保持 `aria-controls` 目标节点持续存在；测试覆盖折叠时 `display: none` 与展开后恢复显示。静态审计、typecheck、lint、生产构建（3102 modules）和 diff check 均通过。

### 2026-08-20：R5 当前浏览器证据口径同步

- `R5-DEVELOPER-WORKSPACE-ACCEPTANCE.md` 顶部页面矩阵已从 2026-08-19 基线同步到 2026-08-20 隔离 Chromium 证据：Available Channels 真实行、Batch Image 填充任务、Monitor V2 历史数据和 Custom Page Markdown 成功态不再被旧表格误记为 pending。
- Playground SSE/image success、provider/iframe sandbox、Batch Image 并发/取消/破坏性操作、读屏和完整失败矩阵仍明确保留为开放门禁；文档更新不扩大证据范围。

### 2026-08-20：Custom Page TOC disclosure 语义收口

- 桌面 Markdown TOC 收起按钮补齐 `aria-expanded` 与 `aria-controls`；移动 TOC 使用的 `UiDrawer` 新增可选 `id` 透传，并绑定 `custom-page-toc`，避免移动打开按钮引用不存在的桌面节点。
- `CustomPageView` 与 `UiDrawer` 定向回归为 2 files / 19 tests；随后全量 `pnpm run test:run` 为 356 files / 2379 tests，`test:audit` 10 tests、typecheck、lint、生产构建（3102 modules）和 diff check 均通过。
- 该源码级 disclosure 修复不替代真实 screen-reader、受保护浏览器、provider sandbox、ownership、远端 CI/Security 或发布闭环证据。

### 2026-08-20：Keys 与渠道定价 disclosure 语义收口

- Keys group picker 的选项容器补上 `role="listbox"` 和本地化 `aria-label`，使现有 `role="option"`/`aria-selected` 子项拥有有效 ARIA 所有者。
- `PricingEntryCard` 折叠按钮使用 Vue `useId()` 生成稳定 `aria-controls`，内容区改为 `v-show` 保持目标节点存在；回归测试覆盖展开/折叠关系。
- 定向 Keys/Pricing 套件为 2 files / 27 tests；随后全量 `pnpm run test:run` 为 356 files / 2380 tests，`test:audit` 10 tests、typecheck、lint、生产构建（3102 modules）和 diff check 均通过。
- 这些源码级语义修复不替代真实 screen-reader、受保护浏览器、ownership、远端 CI/Security 或发布闭环证据。

### 2026-08-20：Playground 参数计数无障碍本地化

- Playground 参数计数从硬编码 `aria-label="parameter count"` 改为中英文 i18n 文案，并加入 `aria-live="polite"`，让参数数量变化可被读屏用户获知。
- Playground 与 locale 定向回归为 3 files / 13 tests；随后全量 `pnpm run test:run` 为 356 files / 2380 tests，`test:audit` 10 tests、typecheck、lint、生产构建（3102 modules）和 diff check 均通过。
- 仍未把本地组件证据升级为真实 screen-reader、受保护浏览器、provider sandbox 或发布闭环证据。

### 2026-08-20：Admin Usage 与 Orders 受保护语义/失败态收口

- Admin Usage detail tabs 补齐稳定 `id`/`aria-controls`，三个面板保持常驻并使用 `role="tabpanel"`/`aria-labelledby`；排行内容仍按首次访问懒挂载，避免引用不存在的目标节点。
- Usage 日志、统计、模型统计和图表请求新增可见错误状态与重试入口；失败时保留已有分析数据，避免网络错误被误报为空结果。
- Admin Orders 高级筛选区域补齐稳定 `id="admin-orders-advanced-filters"` 与按钮 `aria-controls`，并保持折叠目标节点存在。
- 新增 Usage tabpanel/日志失败契约测试及 Orders 高级筛选语义测试；定向套件 2 files / 22 tests、typecheck、lint、diff check 通过。
- 该源码级修复仍不替代真实 screen-reader、受保护页面浏览器矩阵、ownership、远端 CI/Security、版本、Release/GHCR 或线上更新证据。

### 2026-08-20：Admin Usage 变更全量门禁复验

- 修复后 `pnpm run test:run`：356 files / 2383 tests passed；`pnpm run test:audit` 10 tests、`pnpm run typecheck`、`pnpm run lint:check`、`git diff --check` 均通过。
- `pnpm run build` 成功（3102 modules，23.90s）；仅保留既有 Browserslist、Lottie eval、动态/静态 import 和大 chunk 警告。
- UI consumer inventory 运行时引用基线随新增 `UiErrorState` 消费者从 1881 更新为 1882，库存契约测试通过。

### 2026-08-20：Redeem 历史刷新竞态收口

- `RedeemView.fetchHistory` 不再在首屏历史请求进行时静默返回；兑换成功触发的刷新会排队，待当前请求完成后再次拉取，避免成功兑换后保留旧历史列表。
- 新增“首个 history 请求 pending + redeem 成功”回归测试；Redeem 定向套件 7 tests、typecheck、lint 通过。
- Usage 默认“last 24 hours”仍仅发送 `YYYY-MM-DD` 日期参数，可能覆盖两个自然日；因后端时间参数语义尚未确认，本轮未猜改 API，继续作为契约核验项。

### 2026-08-20：Redeem 竞态修复后的全量门禁

- `pnpm run test:run`：356 files / 2384 tests passed；Redeem 新增 pending 首载与成功兑换刷新回归已纳入全量套件。
- `pnpm run test:audit` 10 tests、typecheck、lint 和 `git diff --check` 通过；本轮未修改后端、API 契约、VERSION、tag 或发布元数据。
- 受信浏览器 Node REPL 未暴露可用 browser binding，未访问本地端口；真实 Redeem 认证浏览器、读屏、provider sandbox、ownership 与发布闭环继续保持 pending。
- Redeem 改动后的生产构建再次成功：3102 modules，24.18s；仅保留既有 Browserslist、Lottie eval、动态/静态 import 和大 chunk 警告。

### 2026-08-20：继续执行外部发布门禁刷新

- 最新可复核远端仍为 CI `31698041574` failure、Security Scan `31992691536` failure；没有候选提交的绿色 workflow 证据。
- `releases/latest` 仍为 `v0.1.176-qiu.2`；GHCR `latest` 与 `0.1.176-qiu.2` 仍指向 digest `sha256:98ceb21e472e3e3f70789d35c3f76ff50c55ef15a7464bec46ca7936d6c7ebf4`，没有 `0.1.178-qiu.1`。
- 当前目标继续 active；未修改 VERSION、tag、Release、GHCR 或后端业务契约。

### 2026-08-20：Keys 分组触发器语义补充

- Keys 分组选择按钮补齐 `aria-haspopup="dialog"`，使真实触发器与 `UiPopover` dialog 面板语义一致；新增静态契约断言。
- Keys 定向套件 24 tests、typecheck、lint 通过；Usage 日期范围仍遵循后端 `YYYY-MM-DD` 契约，未改请求协议。

### 2026-08-20：Usage 首次统计加载与续费深链目标收口

- Usage 首次统计请求新增独立 `statsLoading` 状态：无旧数据时显示四列 skeleton、`role=status` 与区域 `aria-busy`，不再把 pending 请求误显示为全 0；已有数据刷新时继续保留旧卡片。Usage 定向套件新增 pending/resolve 回归，17 tests passed。
- UI consumer inventory 因 Usage 新增的生产 `UiSkeleton` 引用从 1882 更新为 1883，保持显式运行时引用基线与实际源码一致。
- PaymentView 对带正数 `subscription_id` 的续费深链要求目标实例必须匹配当前套餐和有效订阅；失效目标显示本地化错误、清空自动选择并阻断下单，不再回退到其他实例或新建实例。有效续费路径保持通过；PaymentView 定向套件 20 tests passed。
- 两项源码修复仍不替代真实受保护浏览器、screen-reader、provider sandbox、ownership、远端 CI/Security、版本、Release/GHCR 或线上更新证据。

### 2026-08-20：Usage/Payment 修复后前端门禁复验

- 全量前端测试：356 files / 2386 tests passed；静态审计 10 tests passed；UI consumer inventory 2 tests passed，运行时引用基线为 1883。
- `pnpm run typecheck`、`pnpm run lint:check`、`git diff --check` 均通过；生产构建成功，3102 modules，23.58s。仅有既有 Browserslist、Lottie eval、动态/静态 import 重叠和大 chunk 警告。
- 本地门禁通过不改变发布结论：真实受保护浏览器/读屏、ownership clean tree、backend/远端 CI/Security、版本候选、GitHub Release 产物/checksum、GHCR、旧版 update 与线上验证仍未闭合。

### 2026-08-20：Batch Image 本地化与取消竞态收口

- Batch Image 详情表的 `Custom ID`/`Prompt` 列标题改为中英文 locale 文案，补充中文界面与读屏列名一致性；新增详情表头回归测试。
- 取消请求捕获 batch id 与详情请求序列，切换任务或关闭详情后忽略迟到响应/错误，避免旧任务覆盖当前详情；新增 pending cancel -> switch job 回归测试。
- Batch Image 定向套件：15 tests passed；本轮未修改后端业务契约、VERSION、tag 或发布元数据。

### 2026-08-20：Batch Image 修复后全量门禁复验

- 全量前端测试：356 files / 2388 tests passed；静态审计 10 tests、typecheck、lint、`git diff --check` 均通过。
- 生产构建成功：3102 modules，24.09s；仅保留既有 Browserslist、Lottie eval、动态/静态 import 重叠和大 chunk 警告。
- 本地证据仍不覆盖真实认证浏览器/读屏、ownership clean tree、后端/远端 CI/Security、版本候选和 GitHub/GHCR/线上更新发布闭环。

### 2026-08-20：Batch Image 修复后发布状态刷新

- 当前 HEAD 仍为 `5c5eee3c`，工作树 365 个 dirty paths；两个 ownership 隔离树仍 detached 且非 clean，不能作为发布候选。
- `backend/cmd/server/VERSION` 仍为 `0.1.176-qiu.2`；上游稳定 tag `v0.1.178` 存在，但尚未形成 `v0.1.178-qiu.1` 候选。
- 远端最新可复核 CI `31772064097` 与 Security Scan `31992691536` 仍 failure（较早 CI `31698041574` 亦 failure）；`releases/latest` 仍为 `v0.1.176-qiu.2`。
- GHCR 当前仍只有 `0.1.176-qiu.2`/`latest`（及历史架构 tag），没有 `0.1.178-qiu.1` candidate digest；未执行 VERSION、tag、Release 或 GHCR 写操作。

### 2026-08-20：Subscriptions loading label 本地化

- SubscriptionsView 首屏 skeleton 的硬编码 `aria-label="Loading"` 改为 `common.loading`，中文读屏不再播报英文状态。
- 新增 pending 请求回归；定向 Subscriptions 套件 13 tests passed。
- 修复后全量前端测试 356 files / 2389 tests passed，typecheck、lint、diff check 通过；生产构建成功（3102 modules，23.91s）。

### 2026-08-20：Keys mutation 竞态与 CCS timer 收口

- Keys 提交 mutation 捕获操作序号和编辑目标 id；关闭或切换表单后忽略迟到成功/错误，避免重置新表单；提交期间禁用对话框关闭、取消与重复提交。
- 删除确认捕获目标 id，接入 `UiConfirmDialog` 的 pending 合同并阻止重复删除；迟到响应只在仍属于原目标时关闭对话框。
- 状态切换与分组更新增加逐 key pending 锁和禁用态，避免重复 PUT 与并发意图乱序；CCS fallback timer 增加 generation、重复导入清理和卸载清理。
- Keys 定向套件 25 tests passed；随后 typecheck、lint 通过。全量门禁待本轮源码修复后复验。

### 2026-08-20：Keys mutation 修复后全量门禁复验

- Keys 定向回归补充状态/分组/删除 pending 去重后为 28 tests passed。
- 全量前端测试：356 files / 2393 tests passed；静态审计 10 tests passed。
- `pnpm run typecheck`、`pnpm run lint:check`、`git diff --check` 均通过；最终生产构建成功（3102 modules，23.52s）。
- 构建仅保留既有 Browserslist、Lottie eval、动态/静态 import 重叠和大 chunk 警告；本地门禁仍不替代真实浏览器/读屏、ownership、远端 CI/Security 与发布闭环证据。

### 2026-08-20：公告竞态、共享默认文案与键盘语义收口

- 公告 fetch 增加 generation，reset 后忽略迟到响应；登录延迟公告 timer 支持登出、认证变化和卸载清理。
- 共享 UiDialog、UiPagination、UiSearchInput、UiAlert、UiToast、UiBanner、UiDrawer、UiSheet、UiSnackbar、UiTooltip、UiImagePreview、UiTimeInput 默认文案改为 `common.*` i18n；补充 en/zh common keys，避免英文界面泄漏中文 aria-label。
- 新增 `useUiI18n` 适配，使共享控件在未安装 i18n 插件的独立测试中安全回退到 key，同时保留生产环境全局翻译响应式。
- UiAsyncEntityPicker 补齐 combobox/listbox ARIA 关系、键盘选择和 timer cleanup；UiTree 补齐 tree/group 层级、roving tabindex、键盘导航和 aria position metadata。
- 公告定向 4 tests、AsyncPicker 4 tests、UI Extended + AsyncPicker 19 tests；受影响 Tooltip/Overlay/TimeInput 20 tests；全量前端测试 356 files / 2397 tests passed。
- `pnpm run test:audit` 10 tests、typecheck、lint、`git diff --check` 均通过；生产构建成功（3103 modules，26.83s）。
- 远端 CI/Security、ownership clean tree、真实浏览器/读屏、版本候选、GitHub Release 产物/checksum、GHCR 与旧版线上 updater 证据仍未闭合，目标继续 active，未修改 VERSION/tag/Release/GHCR。

### 2026-08-20：Code Review 修复、onboarding 例外收口与最终本地门禁

- Scheduled Tests 计划/结果请求、Accounts 调度模型选项、Usage 导出取消、Settings/Plan 保存重复提交、Stripe provider 生命周期/消息来源、Payment Result query-only 深链和公告/登录 timer 竞态均已增加 request generation、disposed 或 single-flight 保护；失败态现在显式提示且不会误关闭确认上下文。
- 共享 UI 默认 ARIA 文案已统一走 `common.*` i18n，并由 `useUiI18n` 提供独立测试回退；`UiAsyncEntityPicker` 与 `UiTree` 补齐 combobox/tree 关系、键盘导航和清理逻辑。UI consumer inventory 已同步到 1883 条运行时引用。
- Driver onboarding 例外已收窄：自定义 `tour-*` 节点全部挂在 `.driver-popover.theme-tour-popover` 下，运行时 hint 移除 Tailwind 工具类，颜色/表面/边框/圆角/字体优先使用 UI tokens；静态审计新增 selector-scope 与工具类检查。
- 本轮全量门禁：`pnpm run test:run` 为 356 files / 2400 tests；`pnpm run test:audit` 为 13 tests；`pnpm run typecheck`、`pnpm run lint:check`、生产构建（3103 modules，约 26.34s）及 `git diff --check` 全部通过。构建仅保留既有 Browserslist、Lottie eval、动态/静态 import 重叠和大 chunk warning。
- 仍未闭合且禁止发布：ownership clean tree、真实 screen-reader/provider sandbox/destructive-action 证据、候选版本基线裁决、绿色远端 CI/Security、GitHub Release 六平台产物与 checksum、GHCR/latest、旧版 updater 发现/比较/下载和新版本线上更新检查。未修改 VERSION、tag、Release 或 GHCR。

### 2026-08-20：远端发布门禁最终只读刷新

- `gh run list` 仍显示 `ui/main` CI `31698041574` 与 Security Scan `31992691536` 为 failure；没有当前候选提交的绿色 CI/Security 记录。较早的 `31698041430` success 不能替代同 SHA 的最新失败扫描。
- `releases/latest` 仍是正式版 `v0.1.176-qiu.2`，六个平台归档和 `checksums.txt` 齐全；`v0.1.178-qiu.1` 仍不存在，工作树状态为 382 个 dirty path，HEAD 为 `5c5eee3c2`，VERSION 仍为 `0.1.176-qiu.2`。
- GHCR 版本查询在当前凭据下返回 Not Found，未取得候选 digest；没有执行任何远端写入。发布、版本、ownership、真实浏览器/读屏/provider sandbox 与旧版线上 updater 证据继续 pending。

### 2026-08-20：未完成清单与证据口径校正

- Terra 独立复核了第 17 节与 R3/R4/R5/R6-R9 acceptance 记录；已把 Keys/Key Usage、支付基础路由、R5 真实数据基础矩阵、管理员基础矩阵和公开认证基础矩阵从笼统 pending 中拆出，保留各文档明确的 mutation、sandbox、失败态、screen-reader 和未覆盖路由残余。
- R1/R9 的静态迁移、消费者库存与 AST 审计维持已关闭口径；当前 inventory 为 114 contracts / 276 production consumer files / 1883 runtime references。
- 该校正只更新执行真相，不扩大浏览器、provider、后端契约或发布证据；全局 ownership、backend unit、远端 CI/Security、版本、Release/GHCR 和 updater 门禁仍开放。

### 2026-08-20：当前工作树 ownership 隔离复验

- 新建 detached worktree `/tmp/Sub2API-frontend-ownership-current-20260820`（基线 `5c5eee3c2`），仅镜像允许的 frontend/UI/重构文档路径，并同步删除态 common wrapper 与 `docs/ui-showcase` 夹具。
- 隔离树共 346 个允许范围 dirty paths，无 `backend/`、`deploy/`、VERSION 或 release metadata 变更；完整门禁通过：356 files / 2400 tests、静态审计 13 tests、typecheck、lint、生产构建 3103 modules、diff-check。
- 该证据关闭 ownership 与本地自动化复验缺口，但不替代 protected browser、screen-reader、provider sandbox、destructive mutation、backend/远端 CI、Release/GHCR 或 updater 证据。

### 2026-08-20：Audit、Accounts 与 Playground mutation 竞态收口

- AuditLog 清空入口在 TOTP 状态检查期间绑定 loading/disabled，继续由 single-flight guard 防止重复检查；补充 pending 状态回归。
- Accounts 导出确认框绑定 `exportingData` pending，step-up/export 期间锁定确认与取消入口。
- Playground key/model 列表 API 支持 `AbortSignal`；新一轮选项请求会取消旧请求，卸载时取消未完成请求，并忽略取消错误，避免 retry/切换造成并发网络请求和旧错误污染。
- 本轮隔离门禁：356 files / 2417 tests、静态审计 13 tests、typecheck、lint、3103-module production build、`git diff --check` 全部通过；仅保留既有构建 warnings。
- 真实浏览器、screen-reader、provider sandbox、破坏性 mutation、远端 CI/Security、版本/Release/GHCR 与 updater 证据仍未闭环，目标继续 active。
- 复核时同步修正 Accounts 单条删除：取消确认会清理目标快照，删除失败通过 `appStore.showError` 提示并保留确认上下文；共享树与隔离树 Accounts 专项 27 tests、diff-check 均通过。

### 2026-08-20：异步破坏性确认 pending 收口与浏览器证据口径校正

- User Attributes、TLS Fingerprint Profiles、Error Passthrough Rules 的删除确认增加 pending、single-flight、稳定目标快照和 finally 恢复；失败保留确认上下文，取消清理目标。
- Proxies 导出确认绑定既有 `exportingData` pending，避免异步导出期间确认/取消入口无反馈。
- 新增跨三个弹窗的 deferred/失败恢复测试：4 tests 在共享树和 ownership 隔离树均通过；隔离树 typecheck 与两树 diff-check 通过。
- R5 文档明确区分临时 `/tmp` 截图、独立 fresh-session 和 `/tmp/sub2api-browser-matrix-clean.json`；矩阵缺少 Available Channels/Monitor/Custom，Playground 窄视口含 429，不再把不同证据合并为 console-clean。
- 本批未触碰 backend、VERSION、tag、Release、GHCR 或远端状态；真实 screen-reader/provider/destructive-action、绿色 CI/Security 和发布闭环仍开放。

### 2026-08-20：R9 native confirm 全站归零

- Accounts 批量删除、重置状态、刷新令牌从原生 `confirm()` 迁移到稳定 ID 快照 + `UiConfirmDialog`；pending 期间阻止重复提交和自动刷新，失败保留确认上下文。
- CreateAccountModal、EditAccountModal、BulkEditAccountModal 的 429/529 本地警告迁移到应用内 `UiConfirmDialog`，确认前不修改错误码数组，取消保持原状态。
- 非测试生产源码 `confirm()` 扫描归零；Accounts/Create/Edit/Bulk 定向套件 119 tests 在共享树和隔离树通过，typecheck 与 diff-check 通过。
- 该批仍未关闭真实 screen-reader/provider/destructive-action、受保护浏览器、远端 CI/Security、版本/Release/GHCR 和 updater 门禁。

### 2026-08-20：R9 native confirm 批次隔离门禁复验

- 隔离候选全量测试 `357 files / 2423 tests` 通过；静态审计 13 tests、typecheck、lint、3103-module production build、ownership scope 和 diff-check 均通过。
- 非测试生产源码 `confirm()` 仍为 0；构建仅保留既有 Browserslist、Lottie eval、动态/静态 import 和大 chunk warnings。
- 该结果继续证明本地前端门禁，不替代真实浏览器/读屏/provider、远端 CI/Security、版本和发布闭环。
- 只读 updater 兼容性核验：当前 `backend/internal/service/update_service.go` 的 `parseVersion`/`compareVersions` 接受整数 `-qiu.<revision>`，`fetchLatestRelease` 固定读取 `qiufengawa/sub2api`，`CheckUpdate(force=true)` 计算 `has_update`；未修改 backend。旧版线上二进制的真实发现/下载仍待发布候选后执行。

### 2026-08-20：混合渠道确认 pending 收口

- CreateAccountModal、EditAccountModal、BulkEditAccountModal 的混合渠道风险确认框绑定 `submitting` pending；确认处理器拒绝重复触发，Bulk 路径保留原有确认标记和更新 payload。
- 两树账户定向套件 `114 tests` 与 typecheck 均通过；未修改后端契约、VERSION 或发布元数据。
- 真实 provider/screen-reader、受保护浏览器、远端 CI/Security 和完整 Release/updater 证据仍未闭环。

### 2026-08-20：浏览器证据服务复核

- 按长任务要求尝试连接现有可信浏览器会话，但当前运行环境返回 `Browser use requires a trusted Node REPL browser service`；未访问任意本地端口，也未把静态/临时截图升级为真实浏览器证据。
- 真实三视口、screen-reader、provider sandbox 和 console-clean 矩阵因此继续保持开放；本轮只完成源码和自动化门禁。

### 2026-08-20：发布脚本静态门禁复核

- `.github/workflows/release.yml` 通过 `actionlint`；`deploy/install.sh` 与 `backend/scripts/resolve-version.sh` 通过 `bash -n`。
- `shellcheck deploy/install.sh` 仅报告既有 warning/info；安装器行为测试在当前 macOS Bash `3.2.57` 下明确拒绝运行（脚本要求 Bash 4+），未伪造通过结果，也未修改脚本或安装环境。
- 该静态证据不关闭绿色远端 CI、真实 Release 产物/checksum/GHCR、旧版 updater 和线上更新验证。

### 2026-08-20：候选版本与 GoReleaser 静态核验

- 本地只读 regex 核验确认 `v0.1.178-qiu.1` 为有效整数 Qiu 格式，`qiu.01`、`qiu.0`、`qiu.1.2` 均拒绝。
- `.goreleaser.yaml` 静态配置包含 Linux AMD64/ARM64、macOS AMD64/ARM64、Windows AMD64 archives、`checksums.txt` 及 GHCR version/latest image tags；未执行发布。

### 2026-08-20：混合渠道 pending 隔离门禁复验

- 隔离候选全量测试 `357 files / 2423 tests`、静态审计 13 tests、typecheck、lint、3103-module production build、ownership scope 和 diff-check 全部通过。
- 混合渠道确认 pending/duplicate guard 已在 Create/Edit/Bulk 三个组件同步；账户定向 114 tests 通过。
- 最新只读远端状态仍为 CI `31698041574` failure、Security Scan `31992691536` failure；`releases/latest` 仍为 `v0.1.176-qiu.2`，VERSION 未改。
- 目标继续 active；真实浏览器/读屏/provider、候选 CI、版本/Release/GHCR/updater 证据仍未闭环。

### 2026-08-20：Prompt Audit 与 Proxies 失败重试上下文收口

- PromptAuditView 单条/批量事件删除不再在请求开始时清空确认目标；pending 期间拒绝重复确认，成功后才清理，失败保留确认框以便重试。
- ProxiesView 导出成功后才关闭确认框；失败保留导出确认上下文并恢复 pending，避免错误后无声丢失重试入口。
- 两树定向 Prompt Audit/Proxies 套件共 `20 tests` 通过；全量隔离门禁待本批复验。

### 2026-08-20：Prompt Audit/Proxies 隔离全量门禁复验

- 隔离候选全量测试 `357 files / 2425 tests`、静态审计 13 tests、typecheck、lint、3103-module production build、ownership scope 和 diff-check 全部通过。
- 本批修复后的 Prompt Audit/Proxies 定向套件共 20 tests 通过；既有测试 stderr 均为显式失败模拟或环境 warning。
- 真实浏览器、读屏、provider sandbox、绿色远端 CI/Security、Release/GHCR/updater 证据仍未闭环。

### 2026-08-20：v0.1.179-qiu.2 发布与线上更新闭环

- Release workflow `32401866123` 成功；`build-frontend`、`update-version`、
  GoReleaser 和 `sync-version-file` 均通过。同步任务确认 VERSION 已匹配，
  未产生额外 bot commit。
- GitHub Release `v0.1.179-qiu.2` 为非 draft/non-prerelease，
  `releases/latest` 已返回该版本；Linux/macOS/Windows 五个平台归档和
  `checksums.txt` 均存在，下载文件 SHA-256 全部通过。
- GHCR `0.1.179-qiu.2` 与 `latest` 共同指向
  `sha256:3c0b54a1c497254107d75a95e7f729b544cfb37be93c4d939dd0b918e7866fbc`，
  amd64/arm64 子 manifest 一致。
- 实际 `GitHubReleaseClient` 强制请求验证：旧版 `0.1.179-qiu.1` 发现
  `0.1.179-qiu.2` 且 `has_update=true`；当前版返回 `has_update=false`。
  完整命令、输出和资产哈希见 `docs/frontend-rebuild/RELEASE-VERIFICATION-20260820.md`。
- 该批关闭版本/Release/GHCR/checksum/updater 门禁，但不关闭 R0-R9 剩余的
  受保护浏览器、screen-reader、provider sandbox、破坏性操作和最终 Code Review；
  唯一长任务继续 active。

### 2026-08-21：R2-R8 受保护矩阵与本地 provider 回调继续执行

- 修正浏览器矩阵 runner 的视口设置：用户 `171` 条、管理员 `216` 条均真正执行
  `1440/900/390`，而不是只改变截图文件名。用户矩阵达到 0 overflow、0 navigation
  error、0 console/pageerror/failed request；管理员矩阵达到 0 overflow、0 navigation
  error、0 console、0 unexpected pageerror、0 failed request。管理员原始矩阵保留
  `3537` 条 sandbox iframe `SecurityError`，并明确标记为安全边界，不放宽 iframe sandbox。
- 修复 `AppHeader` 长标题/描述下的 flex 溢出；补齐 Channels `UiTabs` 导入和 accounts
  `expired` 中英文 locale。真实 Chromium 复验后 `/admin/audit-logs` 的 1556/1107px
  横向溢出归零，Channels pricing console warning 归零。
- 本地 Playwright provider fixture 实测 Playground SSE 成功/截断 EOF/错误/图片成功与
  错误/Abort/Storage 拒绝；Batch Image 模型列表、创建、取消确认、失败项重试、删除确认；
  Stripe Element、WeChat QR、Airwallex SDK redirect、签名结果和 Airwallex Storage 缺参。
  证据索引见 `docs/frontend-rebuild/R2-R8-CONTINUATION-20260821.md`。
- 隔离 PostgreSQL 上用本地签名 payload 实测 EasyPay-WeChat、Stripe、Airwallex 三条
  webhook 成功履约；错误签名均 `400 verify failed` 且不改变已完成订单。实测用户退款请求、
  重复退款拒绝和无交易号的管理员离线退款。
- 本批仍不宣称总目标完成：原生 screen-reader、credentialed external sandbox settlement/
  refund、其余管理员 mutation 逐页 slow/error/empty 状态和最终 Code Review 仍开放。
