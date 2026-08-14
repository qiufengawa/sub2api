# Sub2API 前端全量重构规划

> 状态：实施前基线
>
> 当前实施范围：用户控制台、用户支付流程及其公共组件；管理员页面只保留数量与边界记录，不进入本阶段重构
>
> 设计基础：复用 `frontend/src/components/ui/` 已实现的 114 个公共组件
>
> 视觉参考：当前 Qiu API 首页的米白、黑白品牌体系；Xiaomi MiMo 开放平台控制台的排版、布局、组件密度和响应式方式
>
> 本文职责：明确用户端页面职责、参考页面映射、信息层级、组件使用、布局、响应式策略、迁移顺序和验收标准
>
> 非目标：本文不修改接口、权限、计费、订阅、路由语义或业务数据

## 1. 重构目标

本次重构不是给旧页面统一换颜色，而是建立一套可持续复用的产品界面结构：

1. 全站视觉与当前首页统一：米白页面背景、黑白主体、暖灰分隔与浅米色内容面；蓝色只作为链接、焦点或少数信息强调，不作为页面主色。
2. 用户控制台排版优先复刻 Xiaomi MiMo 开放平台控制台；有对应页面时按真实 DOM/CSS 一比一映射，没有对应页面时只继承其设计语言。
3. 用户页面优先展示当前状态、可执行动作、费用或额度、历史记录和异常信息。
4. 所有页面复用同一套页面壳、标题、工具栏、表单、表格、状态、浮层和反馈组件。
5. 保留完整业务信息，但重新安排层级；不通过隐藏字段换取表面整洁。
6. 桌面端充分利用横向空间；手机端做布局适配，不另造一套信息结构。
7. 日志、模型、账号、订单等比较型数据在手机端仍保持列表或表格，并允许横向滚动。
8. 删除无业务价值的装饰文字、实现说明、编号、重复标题和多层容器。
9. 异步加载必须预留稳定尺寸，杜绝刷新时页面先变窄再展开。
10. 页面迁移后删除被替代的局部样式，避免新旧视觉系统长期叠加。

## 2. 页面计数口径

### 2.1 计数规则

- 只计算直接承载业务内容的 canonical route component；仅作为父级壳或重定向容器的 route record 不计页面。
- `/`、`/admin`、`/admin/channels`、`/admin/affiliates` 及 `/auth-entry` 不计页面；其中 `/auth-entry` 仅承载 `AuthShellView` 并重定向到 `/login`。
- `/auth/oauth/callback` 是 `/auth/callback` 的 alias，`/docs/batch-image` 是 `/batch-image` 的 alias；alias 不重复计数。
- `/custom/:id` 按一个动态页面模板计数，不按后台配置的菜单实例数量计数。
- `/legal/:documentId` 与 `/:pathMatch(.*)*` 也各按一个路由模板计数，不按参数值或未匹配 URL 数量计数。
- `/admin/ui-system` 是内部组件验收页，不混入管理员业务页面数。
- `/ui-system-preview` 仅开发环境存在，不计生产页面。
- `BackupView.vue` 是设置页内部标签，不是独立路由，不计页面。
- 页面数量和共享入口数量是两个维度，不能直接相加。

### 2.2 结论

| 分类 | 数量 | 说明 |
| --- | ---: | --- |
| 管理员业务页面 | **23** | `/admin/**` 下的生产业务页面，不含 UI 验收页 |
| 管理员内部验收页 | **1** | `/admin/ui-system`，不进入正式业务菜单 |
| 管理员实际组件路由合计 | **24** | 23 个业务页 + 1 个内部验收页 |
| 用户域页面 | **19** | 14 个用户功能页 + 5 个支付后续流程页 |
| 管理员/用户共同侧栏主入口 | **13** | 两种角色在非简易模式侧栏均声明的固定入口；不含 dashboard、动态自定义页及 feature flag/simple mode 过滤后的可见数 |
| 公开常规页面 | **4** | 首页、Key 用量查询、法律文档、模型广场；这是路由定位分类，实际访问受 feature flag、认证要求和 backend mode 影响 |
| 认证页面 | **12** | 登录、注册、验证、恢复及各种 OAuth 完成流程 |
| 系统页面 | **2** | 初始化向导、404；开发环境另有 1 个 UI 预览页 |

### 2.3 共享页面的准确解释

固定共享主入口为：

1. `/keys`
2. `/playground`
3. `/batch-image`
4. `/usage`
5. `/available-channels`
6. `/model-plaza`
7. `/monitor`
8. `/subscriptions`
9. `/purchase`
10. `/orders`
11. `/redeem`
12. `/affiliate`
13. `/profile`

补充边界：

- 普通用户 dashboard 是 `/dashboard`，管理员 dashboard 是 `/admin/dashboard`，职责不同，不算共享入口。
- 权限上管理员可以直接访问 `/dashboard`，但管理员侧栏不会把它当作共同主入口。
- `/custom/:id` 的路由模板可被管理员访问，但管理员和用户的菜单实例由 `visibility` 分开配置，不计固定共享入口。
- 支付二维码、结果和支付 SDK 承载页是交易子流程，不是侧栏主入口。
- feature flag 只改变部分入口的可见或可达状态，不改变静态页面数量。

## 3. 信息架构

### 3.1 管理员导航分组

| 分组 | 页面 | 主要任务 |
| --- | --- | --- |
| 总览 | 仪表盘、运维监控 | 判断业务、系统和服务是否健康 |
| 身份与供给 | 用户、分组、渠道、账号、代理 | 管理用户、路由供给、上游资源与调度 |
| 商业化 | 订阅、支付看板、订单、套餐、促销码、兑换码 | 管理商品、交易、额度发放与营销 |
| 内容与通知 | 公告 | 发布、定向和检查用户触达 |
| 安全与审计 | 风控、提示词审计、审计日志 | 发现风险、追踪操作和处理异常 |
| 增长 | 邀请、返佣、转账 | 查看增长和佣金链路 |
| 分析 | 管理员用量 | 分析成本、用量、请求与错误 |
| 系统 | 设置 | 管理全站运行参数与集成配置 |
| 个人工作区 | 13 个共享入口 | 管理员以用户身份创建 Key、测试和购买 |

### 3.2 用户导航分组

| 分组 | 页面 | 主要任务 |
| --- | --- | --- |
| 总览 | 用户仪表盘 | 查看余额、订阅、额度、用量和下一步动作 |
| 开发 | API Key、操练场、批量生图、可用渠道、模型广场、渠道状态 | 接入、测试和选择模型供给 |
| 消费 | 用量、订阅、购买、订单、兑换 | 理解费用、额度、有效期和交易状态 |
| 增长 | 邀请返佣 | 分享、查看返佣和转账 |
| 账户 | 个人资料 | 管理身份、安全、通知与账单偏好 |
| 扩展 | 自定义页 | 显示管理员配置的业务文档或嵌入工具 |

## 4. 视觉基线：Qiu 首页配色 + Xiaomi MiMo 控制台结构

### 4.1 基础令牌

用户控制台不建立新的蓝色主题。配色直接继承当前首页已经形成的视觉关系，同时使用 Xiaomi MiMo 控制台的暖色结构令牌：米白是页面背景，白色是主要工作面，黑色是文字与主要命令，暖灰用于边界、hover 和次级分区。蓝色仅用于文本链接、focus ring、少量信息状态与必要图表序列。

```css
:root {
  --ui-bg: #fcfaf8;
  --ui-surface: #ffffff;
  --ui-surface-muted: #faf7f3;
  --ui-surface-hover: #f7f3ef;
  --ui-surface-section: #f0ebe5;
  --ui-text: #1f2329;
  --ui-text-strong: #000000;
  --ui-text-muted: #646a73;
  --ui-text-soft: #8f959e;
  --ui-border: #dee0e3;
  --ui-border-warm: #f0ebe5;

  --ui-primary: #000000;
  --ui-primary-foreground: #ffffff;
  --ui-link: #249aff;
  --ui-focus: #3370ff;
  --ui-focus-ring: rgba(51, 112, 255, 0.20);

  --ui-success: #30953b;
  --ui-success-soft: #f0fbef;
  --ui-warning: #a76408;
  --ui-warning-soft: #fff5eb;
  --ui-danger: #d52515;
  --ui-danger-soft: #fef2ed;
  --ui-info: #0f62fe;
  --ui-info-soft: #eaf5ff;
}
```

暗色主题保持“黑白主体 + 暖灰结构”的对应关系，不把蓝色扩大为背景：

```css
.dark {
  --ui-bg: #10100f;
  --ui-surface: #171716;
  --ui-surface-muted: #1f1e1c;
  --ui-surface-hover: #292724;
  --ui-surface-section: #312e2a;
  --ui-text: #f3f1ee;
  --ui-text-strong: #ffffff;
  --ui-text-muted: #aaa49d;
  --ui-text-soft: #77716b;
  --ui-border: #3a3733;
  --ui-border-warm: #312e2a;
  --ui-primary: #ffffff;
  --ui-primary-foreground: #0a0a0a;
  --ui-link: #79b7ff;
  --ui-focus: #79b7ff;
  --ui-focus-ring: rgba(121, 183, 255, 0.22);
}
```

### 4.2 颜色使用规则

- 黑色：主要按钮、重要标题、正文和核心数值；深色主题中反转为白色。
- 米白：页面底色，不用纯冷白铺满整个应用背景。
- 白色：内容工作面、表格、表单和需要明确边界的主容器。
- 暖灰：侧栏选中/hover、分隔线、次级内容面和辅助背景。
- 蓝色：文本链接、focus ring、信息状态和少数图表序列；不得成为大面积品牌主色。
- 绿色：成功、健康、可用；不能用蓝色代替健康语义。
- 黄色：等待、警告、接近限额。
- 红色：失败、危险、不可逆操作、严重告警。
- 灰色：禁用、未知、未运行、次要元数据。
- Provider 颜色只用于小型品牌标记或图标，不扩散到整张卡片。
- 禁止整页、整块卡片或大面积背景使用蓝色或彩色渐变。
- 禁止用颜色作为唯一状态信息，必须同时提供文字、图标或形状。

### 4.3 字体、密度与尺寸

- 中文和普通英文：`PingFang SC`, `Microsoft YaHei UI`, system-ui, sans-serif。
- API Key、模型 ID、端点、请求 ID：等宽字体。
- 金额、百分比、延迟、Token、次数：`font-variant-numeric: tabular-nums`。
- 页面标题：`24-28px / 32-36px`；区块标题：`18-20px / 26-28px`。
- 正文：`14px / 22px`；表格和控件：`12-13px / 18-22px`。
- 用户控制台控件高度：mini `24px`、dense `28px`、default `32px`、large `40px`；常规页面不得继续使用 `36px` 这一套平行尺寸。移动端视觉高度仍保持紧凑，通过外部点击区域满足触控。
- 圆角：密集控件 `4px`、一般控件 `6px`、弹窗/重复卡片最大 `8px`。
- 页面间距使用 `4/8/12/16/20/24/32/40/48/64px` 标尺。
- 运维和列表页面优先 dense/compact；购买和认证表单使用 compact/default。

### 4.4 Xiaomi MiMo 控制台提取基线

以下数值来自已下载的 Xiaomi MiMo 控制台 CSS 和已登录控制台 bundle，用于后续一比一实现与浏览器像素核验：

| 项目 | Xiaomi MiMo 真实基线 | Qiu API 采用方式 |
| --- | --- | --- |
| 页面背景 | `#fcfaf8` | 与首页背景完全统一 |
| 主内容面 | `#fff` | 用户控制台工作区使用白色 |
| 次级内容面 | `#faf7f3` | 统计块、说明区和局部分组 |
| 选中/hover | `#f7f3ef` | Sidebar、菜单和安静按钮 |
| 暖边界 | `#f0ebe5` | 外壳、分隔线和侧栏分组 |
| 正文/次级文字 | `#1f2329` / `#646a73` / `#8f959e` | 三级文字层级 |
| 顶部导航 | 桌面高 `54px` | 横版 Logo、全局动作、用户入口 |
| Sidebar | 展开 `202px`，折叠 `64px` | 用户端按同一尺寸实现 |
| Sidebar item | 高 `32px`、圆角 `6px`、图标 `18px`、文字 `14/20px` | 一比一复刻密度与选中方式 |
| 主内容外边距 | 移动/窄屏 `8px`，桌面左/上归零 | 避免内容漂浮和不一致留白 |
| 内容外壳 | `6px` 圆角、`1px #f0ebe5` outline、`0 0 10px rgba(0,0,0,.03)` | 用户控制台统一使用 |
| 普通控件 | 高 `32px`、圆角 `6px`、字体 `13px/22px` | 作为默认密度；高频表格可用 `28px` |
| 控件尺寸 | large `40px`、middle `32px`、small `28px`、mini `24px` | 通过 density 显式选择，不允许页面随意定高 |
| 页面卡标题 | 标题行高 `32px`，标题/说明/动作同一行 | 用于财务、用量和设置区块 |
| 移动断点 | `md = 768px`，`lg = 1024px` | 小于 768px 切换移动导航与单列结构 |

### 4.5 复刻边界

- **直接复刻**：小米存在同类页面，且业务信息结构可对齐时，复刻其外壳、间距、标题、控件、表格、空态和响应式规则。
- **结构复刻、内容替换**：页面功能相近但字段不同，保留小米布局节奏与组件关系，填入 Sub2API 自有字段。
- **设计语言映射**：小米没有对应功能时，只使用其 tokens、密度、层级、边界与响应式原则，不伪造“小米原页面”。
- 不复制 Xiaomi/MiMo 名称、Logo、图标资产、产品文案或业务专有字段。
- 不因一比一复刻改变 Sub2API 的接口、权限、订阅、计费、模型路由和支付行为。

### 4.6 参考文件与可追溯性

本地参考位于 `docs/reference/xiaomi-mimo/`，当前包含入口 HTML 与 11 份控制台 CSS。实现时不得在线热链这些资源；每次发现 Xiaomi 部署哈希变化，只在明确需要重新校准时更新本地参考并记录差异。

| 文件 | 作用 |
| --- | --- |
| `profile.html` | 控制台入口 HTML、chunk 映射和资源入口 |
| `main.513ba316.chunk.css` | 全局字体、Tailwind utility、页面语义 tokens 与基础布局 |
| `650.73cdc68d.chunk.css` | Ant Design/ITP 组件系统，按钮、输入框、表格、Select、Dialog 等 |
| `8114.ec9b8617.chunk.css` | 控制台页面、资料、财务、用量与认证分区样式 |
| `134/138/221/289/765/859/871/978.*.css` | 各异步页面和业务组件补充样式 |

当前快照：11 份 CSS 共 `644,578` bytes。下载日期为 `2026-08-14`；正式实现不得依赖文件名长期不变，文件名中的 hash 只表示本次参考快照。

提取来源和可信度：

- Edge 中已确认存在登录态 Xiaomi MiMo 控制台会话，控制台当前可进入 `/console/balance`。
- 页面 CSS 已从正式静态资源地址重新下载并通过 SHA-256 本地校验。
- 控制台 bundle 明确暴露 `/console/profile`、`/console/api-keys`、`/console/balance`、`/console/plan-manage`、`/console/usage`、`/console/recharge`、`/console/invoice`、`/console/plugin` 等路由。
- 浏览器全 DOM 快照在当前站点响应较慢，因此规划采用“正式 CSS + bundle DOM + 已登录页面视觉核验”三种证据交叉确认；实施每一页时仍需重新进行 Edge 截图像素比对。
- 文档中写“直接复刻”的只是排版、布局和组件表现，不意味着复制品牌、代码或业务内容。

## 5. 全局页面壳

### 5.1 管理员桌面壳（后续阶段边界）

本节保留用于说明共享品牌和管理员后续迁移边界，不属于当前用户端执行清单。当前阶段不得为了用户壳复刻而重排管理员导航或业务页面。

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  LOGO（容器内居中） │ 当前页面 / 上下文                 帮助  通知  用户 │
├─────────────────────┼────────────────────────────────────────────────────┤
│ 总览                │ 页面标题                         [页面主操作]       │
│  仪表盘             │ 一句必要说明 / 当前更新时间 / 状态                 │
│  运维监控           ├────────────────────────────────────────────────────┤
│ 身份与供给          │ 重要状态或告警带                                   │
│  用户 / 分组        │                                                    │
│  渠道 / 账号        │ KPI / 摘要 / 核心诊断                              │
│ 商业化              │                                                    │
│ 安全与审计          │ 筛选工具栏                           [批量/导出]    │
│ 增长 / 分析         ├────────────────────────────────────────────────────┤
│ 系统设置            │ 表格 / 图表 / 工作区                               │
│──────────────       │                                                    │
│ 我的账户            │                                                    │
└─────────────────────┴────────────────────────────────────────────────────┘
```

规则：

- Sidebar 展开 `224-240px`，折叠 `64px`；正文不因异步数据改变宽度。
- 页头只显示页面身份、必要上下文和最重要操作，不复制侧栏导航。
- 第一屏按“风险/健康 -> 核心指标 -> 筛选与操作 -> 明细”排序。
- 页面最大宽度仅用于表单或阅读页；表格、监控和分析页使用全部可用宽度。

### 5.2 移动壳

```text
┌──────────────────────────────┐
│ [菜单]  横版 LOGO     [用户] │
├──────────────────────────────┤
│ 页面标题              [主操作]│
│ 必要说明 / 当前状态           │
├──────────────────────────────┤
│ 关键告警 / 核心指标           │
├──────────────────────────────┤
│ 筛选摘要  [筛选] [更多]       │
├──────────────────────────────┤
│ 内容区                       │
│ 表格：← 可横向滚动 →          │
└──────────────────────────────┘
```

规则：

- 页面水平 padding `16px`；阅读页可为 `20px`。
- Sidebar 变为抽屉；打开时焦点锁定，关闭后焦点返回菜单按钮。
- 表格页面不转换为大型卡片；使用 `UiMobileTableScroller`。
- 复杂编辑使用全高 `UiSheet`，底部操作预留安全区和虚拟键盘空间。

### 5.3 用户控制台壳：按 Xiaomi MiMo 复刻

用户端采用独立的 `UserConsoleShell`，与管理员运维壳保持同一品牌令牌，但不复用管理员的导航密度和信息分组。桌面结构按 Xiaomi MiMo 控制台的真实层级复刻：顶部 54px、左侧 202px、主内容 6px 外壳、页面内部 8/12/16px 间距。

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 横版 Logo（容器内居中）                           [语言] [帮助] [用户]│ 54
├──────────────────┬───────────────────────────────────────────────────┤
│ 账户              │  ┌─────────────────────────────────────────────┐  │
│  个人资料         │  │ 页面标题                 [主要操作]          │  │
│  API Keys         │  │ 必要副标题 / 时间 / 状态                    │  │
│──────────────────│  ├─────────────────────────────────────────────┤  │
│ 财务              │  │ 页面工作区：统计、表格、表单或对话            │  │
│ 余额 / 用量       │  │                                             │  │
│ 订阅 / 充值       │  │                                             │  │
│ 订单              │  └─────────────────────────────────────────────┘  │
│──────────────────│                                                   │
│ 工具              │                                                   │
│ 操练场 / 模型广场│                                                   │
└──────────────────┴───────────────────────────────────────────────────┘
```

硬性布局规则：

- 展开侧栏 `202px`，折叠侧栏 `64px`；侧栏折叠状态持久化，但不改变主内容起点。
- 菜单分组标题 `13px/14px`、菜单项 `32px`、图标 `18px`、文字 `14px/20px`，选中背景为暖灰而非蓝底。
- 页面标题行固定 `32px`，标题、必要副标题和页面动作同一水平线；窄屏副标题换到下一行。
- 内容外壳为白色、`6px` 圆角、暖灰 1px outline，阴影仅使用 `0 0 10px rgba(0,0,0,.03)`。
- 顶部导航不堆叠营销文案；只放 Logo、语言/帮助、通知、个人入口和必要外部动作。
- 任何页面加载前先渲染与最终页面同宽的外壳和骨架，禁止先出现窄列或中心小卡再扩展。

### 5.4 用户端复刻矩阵

| Xiaomi MiMo 控制台页面 | Qiu API 用户端对应 | 复刻级别 | 必须复刻的结构 | Qiu API 业务差异 |
| --- | --- | --- | --- | --- |
| `/console/balance` | `/dashboard`、`/purchase` | 结构一比一 | 页面标题行、余额/统计区、浅米色统计面、操作区、分隔与状态 | Qiu 显示余额、订阅、5小时/7天/总额窗口和真实扣费，不复制 MiMo 余额字段 |
| `/console/usage` | `/usage` | 结构一比一 | 标题/副标题、时间筛选、统计区、趋势、表格、分页、空态 | 显示模型、分组、倍率、缓存百分比、费用和请求元数据 |
| `/console/api-keys` | `/keys` | 结构一比一 | 创建按钮、信息提示、紧凑表格、行操作、创建/编辑弹窗 | 增加分组、订阅绑定、限额、限速和 Key 脱敏规则 |
| `/console/profile` | `/profile` | 结构一比一 | 居中资料区、窄资料表、约 540px 表单卡、按钮堆叠 | 增加 Qiu 的安全设置、余额提醒和账单偏好；不显示无关说明 |
| `/console/profile/auth/*` | `/profile` 安全分区 | 结构复刻 | 资料/认证分层、状态、表单与验证反馈 | 保留现有 TOTP、Passkey、第三方绑定业务 |
| `/console/recharge` | `/purchase` 充值 Tab | 结构复刻 | 金额输入、支付方式、支付中/成功/失败、订单信息 | 使用 Qiu 充值比例、支付渠道和订单逻辑 |
| `/console/plan-manage` | `/subscriptions` | 结构复刻 | 套餐列表、标签、价格/周期、购买动作、状态 | 显示适用分组、5小时/7天/总额、实例与到期；不复制 Token Plan 文案 |
| `/console/invoice` | `/orders` 订单详情/发票区 | 结构借鉴 | 查询工具栏、表格、状态标签、详情/下载动作 | Qiu 订单与退款字段按现有支付系统定义 |
| `/console/plugin` | `/available-channels`、`/batch-image` | 设计语言映射 | 小工具入口、说明、状态和动作 | 不假设有 MiMo 插件；只采用其紧凑工具列表和统一操作区 |
| 无直接对应 | `/playground`、`/monitor`、`/model-plaza`、`/affiliate`、`/redeem`、`/custom/:id` | 设计语言映射 | 统一壳、标题、工具栏、表格、空态和 Drawer/Sheet | 以 Qiu 现有业务为准，不制造 Xiaomi 页面影子 |

### 5.5 用户手机壳

```text
┌──────────────────────────────┐
│ [菜单]  横版 Logo     [用户] │ 52
├──────────────────────────────┤
│ 页面标题              [操作] │
│ 副标题 / 当前状态             │
├──────────────────────────────┤
│ 统计或工具区                 │
├──────────────────────────────┤
│ 表格/表单/对话               │
│ ← 高数据量页面在内部横滚 →   │
└──────────────────────────────┘
```

- `768px` 以下隐藏桌面侧栏，顶部仅保留 Logo、菜单、用户动作；菜单打开为全高 Sheet。
- `1024px` 以下将资料页和设置页从双列改为单列；标题副标题换行，但不降低正文可读性。
- 用户表格不转为大卡片；在 `390px` 只保留必要固定列，其余横向滚动。
- 购买/支付底部操作使用 `env(safe-area-inset-bottom)`；浏览器地址栏和虚拟键盘不能遮挡金额、确认和错误信息。

## 6. 114 个公共组件的使用边界

现有组件按以下五组承担全站视觉和通用交互。业务页面不得重新实现同类按钮、输入框、表格、分页、弹窗或状态标签。

| 组件组 | 数量 | 组件 | 主要覆盖页面 |
| --- | ---: | --- | --- |
| 基础控件 | 22 | `UiButton`、`UiIconButton`、`UiButtonGroup`、`UiLink`、`UiTextField`、`UiPasswordField`、`UiTextArea`、`UiSelect`、`UiCombobox`、`UiSearchInput`、`UiNumberStepper`、`UiCheckbox`、`UiRadioGroup`、`UiSwitch`、`UiSegmentedControl`、`UiDateInput`、`UiDateRangePicker`、`UiFileUpload`、`UiFormField`、`UiFieldHelp`、`UiFieldError`、`UiCopyButton` | 全部表单、筛选、内联编辑和命令 |
| 导航与布局 | 18 | `UiTabs`、`UiBreadcrumb`、`UiPagination`、`UiDropdownMenu`、`UiContextMenu`、`UiPopover`、`UiTooltip`、`UiAccordion`、`UiCommandMenu`、`UiNavItem`、`AppPage`、`AppPageHeader`、`AppSection`、`AppStack`、`AppInline`、`AppGrid`、`AppSplitPane`、`AppToolbar` | 页面壳、侧栏、设置、详情和工作区 |
| 反馈与浮层 | 20 | `UiBadge`、`UiStatusBadge`、`UiAlert`、`UiToast`、`UiSpinner`、`UiProgressBar`、`UiProgressRing`、`UiSkeleton`、`UiEmptyState`、`UiErrorState`、`UiLoadingOverlay`、`UiConnectionStatus`、`UiDialog`、`UiConfirmDialog`、`UiDrawer`、`UiSheet`、`UiAnnouncementDialog`、`UiImagePreview`、`UiErrorDetailDialog`、`UiFullscreenPanel` | 状态、加载、异常、编辑、确认、详情 |
| 数据展示 | 12 | `UiDataTable`、`UiTableToolbar`、`UiSortableHeader`、`UiDataCell`、`UiMobileTableScroller`、`UiFilterBar`、`UiColumnPicker`、`UiDescriptionList`、`UiStatMetric`、`UiMetricTrend`、`UiCodeBlock`、`UiTimeline` | 所有数据页、监控、审计和支付历史 |
| 扩展原语 | 24 | `UiAvatar`、`UiAvatarGroup`、`UiSlider`、`UiTagInput`、`UiTimeInput`、`UiColorSwatch`、`UiKbd`、`UiDivider`、`UiSteps`、`UiPageNav`、`UiSideNavGroup`、`UiBackToTop`、`UiBanner`、`UiSnackbar`、`UiNotificationDot`、`UiPulseIndicator`、`UiKeyValue`、`UiList`、`UiTree`、`UiChartLegend`、`UiSparkline`、`UiQuotaSummary`、`UiLogLine`、`UiScoreBar` | 资料、导航、实时状态、配额、日志与轻量可视化 |
| 高级工作流 | 18 | `UiMultiCombobox`、`UiAsyncEntityPicker`、`UiDateTimeRangePicker`、`UiSecretField`、`UiKeyValueEditor`、`UiStructuredEditor`、`UiServerTableWorkspace`、`UiBulkActionBar`、`UiExportJob`、`UiSaveBar`、`UiChangeSet`、`UiFilterChips`、`UiChartFrame`、`UiThresholdMetric`、`UiLiveMetric`、`UiInlineEdit`、`UiTransferList`、`UiReviewSummary` | 多选、远程选择、审计、凭据、导入导出、列表、监控与提交确认 |
| 合计 | **114** | 从 `@/components/ui` 公共入口导入 | 目标总体实例复用率不低于 85% |

### 6.1 业务复合组件

通用组件不包含业务规则。以下复合组件负责把业务状态组织成固定模式：

- `AccountPriorityControl`：减号、可编辑非负整数、加号；值越大调度优先级越高。
- `AccountServiceStatus`：调用样本形成的窄竖条历史、成功率、延迟和不可用原因。
- `QuotaMeter`：5 小时、7 天、有效期总额的额度与重置状态。
- `SubscriptionUsageSummary`：订阅实例、适用分组、本期/周期总额、预留与到期时间。
- `GroupSelector`、`ModelSelector`：分组与模型选择，不改变现有路由/计费逻辑。
- `PaymentStatusPanel`、`OrderStatusTimeline`：订单创建、待支付、确认、成功、失败、退款。
- `PlaygroundComposer`、`PlaygroundMessage`：输入、附件、生图结果和请求指标。
- `MonitorHealthSummary`：健康圆环、资源进度和服务小状态块。
- `UsageCostBreakdown`：费用、缓存、倍率、Token 和请求元数据。

### 6.2 组件重构不是换 Token

现有 114 个组件已经建立了名称和基础行为，但视觉实现尚未达到 Xiaomi MiMo 控制台基线。抽查确认存在以下系统性偏差：

- `UiDensity` 仍是 `28/32/36px`，而 Xiaomi MiMo 为 `24/28/32/40px`。
- `UiButton` 默认 12px、600 weight、8px gap；目标是 13px/22px、常规 500 weight、图文 gap 4px。
- `UiTextField` 和 `UiSelect` 默认 36px；目标默认 32px。
- `AppPageHeader` 使用 26px 标题和 72px 高头部；Xiaomi 控制台的区块标题更紧凑，普通控制台页面不使用营销级标题。
- `UiBadge` 默认胶囊圆角 `999px`；目标普通标签为 4px，小型状态标签只在确有语义时使用圆形点。
- `UiDialog` 仍使用 `0 18px 48px rgba(...,.18)` 的重阴影；目标是 8px 圆角和克制的分层阴影。
- `UiTabs` 使用 18px gap、36px 高度和单独本地样式；目标需统一为 Xiaomi 的 FancyTabs/ITP Tabs 视觉与状态协议。
- `UiNavItem` 高 34px；用户侧栏目标为 32px。
- `UiSelect`、`UiDataTable`、`UiDialog`、`UiPagination` 仍通过包装旧 `common` 组件再深度覆盖 CSS，容易出现交互状态和响应式不一致。

因此组件迁移必须包含四层：

1. **Token 层**：颜色、字体、尺寸、圆角、边界、阴影和动效。
2. **Component API 层**：密度名称、variant、intent、loading、disabled、error 和响应式 props。
3. **DOM/行为层**：键盘、焦点、overlay 定位、表格滚动、Select 浮层、Dialog/Sheet 安全区。
4. **业务适配层**：页面逐步替换旧 `common` 组件，不能无限期依赖 `:deep()` 覆盖。

### 6.3 统一组件尺寸 API

目标密度改为：

```ts
export type UiDensity = 'mini' | 'dense' | 'default' | 'large'

export const densityHeight = {
  mini: '24px',
  dense: '28px',
  default: '32px',
  large: '40px'
} as const
```

兼容策略：

- 迁移期间将旧 `compact` 映射到新 `default=32px`。
- 旧 `default=36px` 不能静默继续作为默认；调用点必须根据用途迁移到 32px 或 40px。
- 表格工具栏、行内编辑和次级动作使用 `dense=28px`。
- 普通表单、按钮、Select、日期和搜索使用 `default=32px`。
- 支付 SDK、二维码主操作或触控强调才使用 `large=40px`。
- 24px 只用于分页、极密集工具和明确的小型控制，不用于普通表单。

### 6.4 114 个组件逐组调整清单

#### 6.4.1 基础控件（30）

| 组件 | 目标样式与行为 |
| --- | --- |
| `UiButton` | 13px/22px、500 weight、图文 gap 4px；32px 默认；主按钮黑底白字；secondary 为白底暖灰边框；hover/active/disabled 与 ITP 状态一致 |
| `UiIconButton` | 24/28/32/40 方形尺寸；图标 16px；透明背景，hover 暖灰；陌生图标必须 Tooltip |
| `UiButtonGroup` | 共享 6px 外圆角，内部 1px 边界合并；不使用胶囊容器 |
| `UiLink` | 默认 `#249aff`，hover/active 明确；外链图标 14px；正文链接不加按钮背景 |
| `UiTextField` | 32px 默认、13px/22px、12px 水平 padding、6px 圆角、`#dee0e3` 边框；focus 为克制蓝边，不出现 3px 大光圈 |
| `UiPasswordField` | 只保留一个显隐按钮；规则使用 `UiFieldHelp`；错误出现时不重复渲染常驻说明 |
| `UiTextArea` | 13px/22px、6px 圆角、12px padding；最小高度按 rows，而非固定大卡片 |
| `UiSelect` | 32px 默认；触发器、菜单、选项、搜索、清除和 disabled/error 全部统一；逐步移除对旧 `Select.vue` 的深层覆盖 |
| `UiCombobox` | 与 Select 同尺寸；搜索结果 32px 一行；高亮用暖灰，不用蓝底白字 |
| `UiSearchInput` | 32px、图标 16px、左右 12px；清除按钮保持布局稳定 |
| `UiNumberStepper` | 32px；左右按钮各 32px，中间可编辑；分隔线暖灰；最小值按业务，优先级最小 0、无最大值 |
| `UiCheckbox` | 16px 控件、13px/22px 标签；选中黑色，危险/错误单独语义化 |
| `UiRadioGroup` | 16px 单选、组 gap 12px；标签正常排版，不用大块卡片模拟选项，除非商品选择确有需要 |
| `UiSwitch` | 视觉尺寸与 ITP 紧凑开关一致；开态黑色或语义色，关闭态暖灰；关联 label 和 help |
| `UiSegmentedControl` | 32px 总高、2px 内边距、4px 项圆角；容器暖灰、选中白色；仅用于少量模式 |
| `UiDateInput` | 与 TextField 同 32px；日期图标 16px；本地时区语义统一 |
| `UiDateRangePicker` | 32px；预设与自定义范围统一；“今天”生成 `[00:00, 次日00:00)` |
| `UiFileUpload` | 默认是紧凑文件行；只有拖放任务才使用 Dropzone；错误、进度和文件名不增宽页面 |
| `UiFormField` | label 13px/22px、颜色 `#646a73`；label/help 同行；description/error 按需出现 |
| `UiFieldHelp` | 16px 问号；hover/focus/click 均可打开；浮层自动翻转，移动端转可点击 Popover |
| `UiFieldError` | 12px/18px、危险色；与字段建立 `aria-describedby`；不重复 Toast |
| `UiCopyButton` | 透明 IconButton；成功只短暂改变图标/Tooltip，不让按钮宽度变化 |
| `UiAvatar` | 24/32/40px；图片与文字回退统一，状态点不遮挡主体 |
| `UiAvatarGroup` | 紧凑重叠头像，显示剩余数量并保留可访问名称 |
| `UiSlider` | 原生键盘语义，黑色轨道，数值独立对齐 |
| `UiTagInput` | 标签可删除、Enter/逗号提交，焦点与错误状态统一 |
| `UiTimeInput` | 自定义小时/分钟双列面板，不依赖浏览器原生外观 |
| `UiColorSwatch` | 圆形色板配 Lucide 选中标记，不用文字色块按钮 |
| `UiKbd` | 22px 键盘提示，用于命令菜单和快捷操作 |
| `UiDivider` | 水平/垂直分隔，允许短标签，不制造新容器 |

#### 6.4.2 导航与布局（22）

| 组件 | 目标样式与行为 |
| --- | --- |
| `UiTabs` | 32px 控件节奏；文本 13px/22px；底部分隔线暖灰；选中黑色；Tabs 可横滚且不显示胶囊蓝底 |
| `UiBreadcrumb` | 12px/18px、次级灰；只用于深层页面；当前项不做链接 |
| `UiPagination` | 24/28px 小型控件；当前页暖灰或黑色细边界；逐步脱离旧 Pagination 深度覆盖 |
| `UiDropdownMenu` | 菜单 6px 圆角、8px padding；选项 32px；阴影克制；危险项仅文字/图标危险色 |
| `UiContextMenu` | 与 Dropdown 共用 overlay；键盘导航、边缘翻转和滚动容器统一 |
| `UiPopover` | 6px 圆角、暖灰边界、轻阴影；最大宽度与视口约束；不作为大表单容器 |
| `UiTooltip` | 12px 文本、短延迟、自动翻转；指针不能落在错误位置；触屏不依赖 hover |
| `UiAccordion` | 标题行 40px 左右、上下细分隔；展开区不再套卡片 |
| `UiCommandMenu` | 搜索 32px、结果 32px；选中暖灰；快捷键提示为次级文字 |
| `UiNavItem` | 用户侧栏严格 32px、6px 圆角、18px 图标、14px/20px 文本、12px 水平 padding；active/hover `#f7f3ef` |
| `AppPage` | 用户端不使用 1080/1440 居中大页；在白色内容壳内占满，页面内 padding 12/16px |
| `AppPageHeader` | 默认 32px 标题行；标题使用紧凑控制台字号，不再固定 26px/72px；副标题宽屏同行、窄屏下一行 |
| `AppSection` | 以间距和分隔线建立层级；标题 16-20px，禁止为每节新增卡片背景 |
| `AppStack` | 默认 gap 12px；页面大分区显式 20/24px，不靠子元素 margin 链 |
| `AppInline` | 默认 gap 8px；金额/状态/动作对齐；长标签可换行 |
| `AppGrid` | gap 12/16px；列宽用 minmax，Skeleton 与最终栅格一致 |
| `AppSplitPane` | 主/次面板比例稳定；小于 1024px 次面板转 Sheet；用于 Playground 等真实工作区 |
| `AppToolbar` | 32px 控件，整体最小高度 44px；搜索/筛选/动作不套独立卡片 |
| `UiSteps` | 紧凑步骤进度，完成项使用 Lucide Check，当前项明确 |
| `UiPageNav` | 上一项/下一项内容导航，使用 Lucide Chevron |
| `UiSideNavGroup` | 侧栏分组展开收起，复用 32px 导航节奏与暖灰选中态 |
| `UiBackToTop` | 滚动超过阈值后淡入，reduced-motion 下禁用平滑动画 |

#### 6.4.3 反馈与浮层（24）

| 组件 | 目标样式与行为 |
| --- | --- |
| `UiBadge` | 普通标签 4px 圆角、11/16px、1px 边界；只在状态点/计数确有需要时使用圆形或胶囊 |
| `UiStatusBadge` | 文字 + 可选 6px dot；成功/警告/失败/未知语义完整，不用纯颜色 |
| `UiAlert` | 6px 圆角、13px/22px、16px 图标、`16px 9px` 级别 padding；正文可换行 |
| `UiToast` | 轻阴影、6px 圆角；成功/失败不改变页面布局；关键错误仍需页面内记录 |
| `UiSpinner` | 12/16/24px；继承 currentColor；reduced motion 下显示静态加载状态 |
| `UiProgressBar` | 高 4/6px；语义色；label/value 在外部对齐；资源和额度不得使用装饰渐变 |
| `UiProgressRing` | 仅健康或单一核心比例使用；数值排版与 tabular-nums 对齐 |
| `UiSkeleton` | 使用暖灰层级；尺寸由最终内容决定；不得造成刷新时页面变窄 |
| `UiEmptyState` | 紧凑居中；必要说明 + 一个主动作；不默认占 180px 大卡 |
| `UiErrorState` | 显示影响、重试和 request ID；网络错误与业务失败分开 |
| `UiLoadingOverlay` | 只覆盖当前工具；背景透明度克制；保留原内容尺寸 |
| `UiConnectionStatus` | live/reconnecting/stale/offline；使用文字与图标，不反复闪烁 |
| `UiDialog` | 8px 圆角、轻阴影、24px Header；标题 16px/24px；逐步移除旧 BaseDialog 深度覆盖 |
| `UiConfirmDialog` | 复用 Dialog；清晰后果；危险确认默认焦点在取消 |
| `UiDrawer` | 白色面、暖灰边界、轻阴影；Header 52px 左右；桌面保留来源上下文 |
| `UiSheet` | 手机 `100dvh` 安全区；标题/底部动作固定，中间滚动；浏览器栏和键盘不遮挡 |
| `UiAnnouncementDialog` | 列表/详情共用响应式结构；正文 14px；不使用超大标题 |
| `UiImagePreview` | 黑色查看背景只限媒体层；工具 32px；图片禁止拖拽并支持缩放/下载 |
| `UiErrorDetailDialog` | 请求、状态码、错误、ID、时间和复制；等宽区可滚动 |
| `UiFullscreenPanel` | 监控/图表/Playground 检查；退出动作明确；不复制页面完整导航 |
| `UiBanner` | 页面级通知带 Lucide 语义图标，使用全宽带状结构 |
| `UiSnackbar` | 底部短反馈与单一撤销动作，不占据页面流布局 |
| `UiNotificationDot` | 图标角标或纯状态点，数字有最大显示值 |
| `UiPulseIndicator` | 实时状态脉冲，reduced-motion 下退化为静态状态点 |

#### 6.4.4 数据展示（20）

| 组件 | 目标样式与行为 |
| --- | --- |
| `UiDataTable` | 统一表头、行高、边界、hover、loading/empty；默认不做圆角卡片包裹；逐步替换旧 DataTable |
| `UiTableToolbar` | 32px 控件；搜索、筛选、批量、导出、刷新分组；窄屏次级动作进菜单 |
| `UiSortableHeader` | 12/18px、次级色；排序箭头 12px；键盘可操作 |
| `UiDataCell` | 主值 13px、次值 11/16px；金额/Token/延迟 tabular；长值复制或 Tooltip |
| `UiMobileTableScroller` | 明确横向滚动边界和滚动提示；不让整个 body 横滚；固定列谨慎使用 |
| `UiFilterBar` | 32px 筛选；已应用状态可见；手机转 Sheet，但保留当前条件摘要 |
| `UiColumnPicker` | 与 Dropdown 共用菜单；必需列不可关闭；设置可持久化 |
| `UiDescriptionList` | 标签 90-120px、13/22px；内容可换行；资料页直接复刻 MiMo 对齐方式 |
| `UiStatMetric` | label 12px/20px，value 22px/normal；浅米内容面；不使用大号营销数字 |
| `UiMetricTrend` | 11/16px；方向、数值、比较周期同时显示；语义色克制 |
| `UiCodeBlock` | 等宽 12/20px、暖灰背景、复制 32px；长端点可横滚或安全换行 |
| `UiTimeline` | 订单/支付/审计使用；点线暖灰，当前/失败使用语义色；时间对齐 |
| `UiKeyValue` | 单行标签、值与操作，适合请求 ID 和配置详情 |
| `UiList` | 44px 紧凑列表行，支持 Lucide 图标、描述和尾部动作 |
| `UiTree` | 层级数据选择，使用 Lucide 展开/文件图标与暖灰选中态 |
| `UiChartLegend` | 色块、标签和值同排，颜色不作为唯一信息 |
| `UiSparkline` | 轻量趋势数据可视化；SVG 仅用于图表，不作为操作图标 |
| `UiQuotaSummary` | 已用/总额、重置说明与进度条组合，0 表示不限额 |
| `UiLogLine` | 时间、等级、消息等宽对齐，长文本安全换行 |
| `UiScoreBar` | 调度得分等有界指标，数值与条形同时表达 |

#### 6.4.5 高级工作流（18）

| 组件 | 目标样式与行为 |
| --- | --- |
| `UiMultiCombobox` | 模型、分组、权限等受限多选；搜索、已选摘要、键盘和空态一致 |
| `UiAsyncEntityPicker` | 用户、账号、密钥等远程搜索；请求由页面提供，组件负责加载与选择状态 |
| `UiDateTimeRangePicker` | 日期和时间组合、精确边界、预设范围和窄屏单列布局 |
| `UiSecretField` | 凭据掩码、显隐、复制、保留旧值和明确清空，不泄漏业务密钥 |
| `UiKeyValueEditor` | Header、metadata 等键值编辑；增删紧凑、重复键由业务校验 |
| `UiStructuredEditor` | JSON 粘贴、文件导入、格式化、解析诊断；提交仍由业务层预检 |
| `UiServerTableWorkspace` | 统一标题、筛选、表格、加载、空态、分页插槽，不内置请求逻辑 |
| `UiBulkActionBar` | 批量选择摘要、全选和批量命令；无选择时退出页面流 |
| `UiExportJob` | 等待、生成、失败、重试、完成、文件信息和下载全流程 |
| `UiSaveBar` | dirty、saving、saved 与放弃状态；离开页面拦截由路由层负责 |
| `UiChangeSet` | 审计与提交前 before/after 差异；长值安全截断并保留展开能力 |
| `UiFilterChips` | 当前已应用筛选可见、可单项删除或全部清除 |
| `UiChartFrame` | 图表标题、时间工具、图例、加载、空态、错误、更新时间统一；不接管 Chart.js geometry |
| `UiThresholdMetric` | 当前值、阈值、进度和正常/接近/超限语义同时表达 |
| `UiLiveMetric` | 实时、暂停、陈旧状态稳定显示，更新不引起布局跳动 |
| `UiInlineEdit` | 简短字段的就地编辑、确认和取消；复杂表单仍使用 Dialog/Drawer |
| `UiTransferList` | 低频的大集合分配场景，移动端上下排列，不替代普通多选 |
| `UiReviewSummary` | 导入、套餐、危险设置提交前的事实汇总和校验状态 |

### 6.5 组件迁移优先级

| 批次 | 组件 | 原因 |
| --- | --- | --- |
| C0 | tokens、`types.ts`、`UiButton`、`UiTextField`、`UiSelect`、`UiFormField`、`UiNavItem`、`AppPage`、`AppPageHeader` | 决定所有页面的尺寸和基础视觉 |
| C1 | `UiDataTable`、`UiTableToolbar`、`UiFilterBar`、`UiPagination`、`UiDataCell`、`UiMobileTableScroller` | `/keys`、`/usage`、`/orders`、模型列表的共同基础 |
| C2 | `UiDialog`、`UiConfirmDialog`、`UiDrawer`、`UiSheet`、`UiPopover`、`UiTooltip`、`UiDropdownMenu` | 解决旧 overlay、定位和移动遮挡问题 |
| C3 | `UiTabs`、`UiBadge`、`UiStatusBadge`、`UiAlert`、`UiSkeleton`、`UiEmptyState`、`UiErrorState` | 统一页面状态和 Xiaomi 视觉细节 |
| C4 | 其余控件、图表辅助、代码、Timeline、Fullscreen、业务复合组件 | 完成全部 114 个组件和业务工具覆盖 |

页面实现不得早于 C0；表格页面不得早于 C1；使用浮层的页面不得在 C2 未验收时宣告完成。

### 6.6 组件验收页要求

`/admin/ui-system` 必须新增 Xiaomi MiMo 对照章节，按 24/28/32/40px 展示所有尺寸，并覆盖：

- light/dark；
- normal/hover/active/focus-visible/disabled/loading/readonly/error；
- 中文、英文、数字、长模型 ID、长 URL、长邮箱；
- keyboard、touch、reduced motion；
- 1440px、900px、390px；
- overlay 位于视口四角、表格边缘和移动键盘上方；
- 表格 loading/empty/error/长列/横向滚动；
- Xiaomi 参考截图与 Qiu fixture 并排或像素差异记录。

组件阶段验收标准：114 个组件全部使用新 tokens；`types.ts` 不再声明 36px 默认高度；核心组件不再仅靠 `:deep()` 覆盖旧视觉；组件测试、类型检查、Lint 和生产构建通过。

## 7. 管理员页面逐页规划（延后，不进入本阶段）

本章是前一轮全站盘点的保留附录，用于维持 23 个管理员业务页面的数量、职责和组件边界。当前开发阶段只实施第 8 章的用户端页面；本章所有页面维持现状。用户端完成并验收后，管理员重构需另行更新本章的参考来源、布局和实施顺序，不能直接套用 Xiaomi MiMo 用户控制台结构。

### 7.1 管理员业务页面总表（23）

| # | 路由 | 页面必须显示的内容 | 信息层级与桌面布局 | 公共组件 | 移动端与状态 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `/admin/dashboard` | 收入/用量/用户/请求核心指标；变化趋势；模型分布；Token 趋势；近期高用量用户；异常摘要；快捷入口 | 顶部告警；一行核心 KPI；中部 2:1 趋势与分布；底部排名表。只做经营总览，不复制 Usage 全量分析 | `AppPage`、`AppPageHeader`、`UiAlert`、`AppGrid`、`UiStatMetric`、`UiMetricTrend`、`UiDataTable`、`UiSkeleton` | KPI 两列；图表单列；排名表横滚。加载骨架固定列宽，局部失败不阻塞整页 |
| 2 | `/admin/ops` | 总体健康；请求、并发、队列；CPU/内存/Redis；错误率；首字/总延迟；Token；告警；实时日志；运行参数 | 健康环为主视觉；资源百分比排成一栏进度条；服务正常/异常用小状态单元；趋势图与日志占主体 | `UiProgressRing`、`UiProgressBar`、`UiConnectionStatus`、`UiStatusBadge`、`UiTabs`、`UiFullscreenPanel`、`UiErrorDetailDialog` | 指标按重要性单列；图表横向滚动或全屏；实时更新不重播入场动画，不改变尺寸 |
| 3 | `/admin/audit-logs` | 操作者、动作、对象、结果、IP、时间、变更摘要；时间/高级筛选；详情；清理 | 单一密集表格；筛选栏固定；变更详情放 Drawer；清理为危险次级操作 | `UiFilterBar`、`UiDateRangePicker`、`UiDataTable`、`UiDrawer`、`UiDescriptionList`、`UiConfirmDialog` | 表格横滚；保留操作者/动作/时间；详情使用 Sheet；空状态区分“无记录”和“筛选无结果” |
| 4 | `/admin/users` | 用户身份、角色、状态、分组、余额、订阅、Key、注册/活跃时间；批量编辑；详情 | 顶部用户总数和风险摘要；主表支持选择、排序、列管理；详情 Drawer 以资料/余额/订阅/安全分段 | `UiTableToolbar`、`UiDataTable`、`UiColumnPicker`、`UiDrawer`、`UiTabs`、`UiStatusBadge`、`UiConfirmDialog` | 表格横滚；用户名/状态可固定；编辑转 Sheet；批量动作显示已选数量和影响范围 |
| 5 | `/admin/groups` | 分组名称、平台、状态、独占性、倍率/定价、模型、容量、路由策略；CRUD | 顶部平台与状态摘要；主表显示比较字段；模型/倍率/容量等复杂编辑进入 Drawer 分区，不堆卡片 | `UiDataTable`、`UiBadge`、`UiNumberStepper`、`UiDrawer`、`UiTabs`、`UiDescriptionList` | 保持列表；复杂模型列表在 Sheet 内搜索；长名称不截断关键差异，悬浮显示全值 |
| 6 | `/admin/channels/pricing` | 渠道、平台、状态、优先级、分组、模型、价格与倍率；新增编辑测试 | 主体为渠道列表；行内只放高频状态与摘要；定价详情 Drawer；批量测试结果独立反馈 | `UiDataTable`、`UiFilterBar`、`UiStatusBadge`、`UiDrawer`、`UiNumberStepper`、`UiLoadingOverlay` | 表格横滚；渠道名/状态优先；测试进行中只锁定对应行或面板 |
| 7 | `/admin/channels/monitor` | V2 监控配置、旧版监控项、探测频率、阈值、通知与当前状态 | 页面 Tabs 明确“监控策略/监控目标”；避免 v2/legacy 混在同一视觉层；保存状态常驻页头 | `UiTabs`、`UiFormField`、`UiSwitch`、`UiNumberStepper`、`UiDataTable`、`UiAlert` | Tabs 可横滚；表单单列；未启用时显示原因与启用动作，不展示伪数据 |
| 8 | `/admin/subscriptions` | 用户、套餐/实例、允许分组、周期额度、已用、重置、有效期、状态；分配与延期 | 先显示有效/即将到期/超限统计；主表一行一个订阅实例；额度详情为多周期进度，不混淆套餐和账号分组 | `UiStatMetric`、`UiDataTable`、`QuotaMeter`、`UiProgressBar`、`UiDrawer`、`UiDialog` | 表格横滚；实例号与状态优先；分配/延期用 Sheet；周期说明不可省略 |
| 9 | `/admin/accounts` | 名称、平台、状态、服务调用历史、优先级、分组、用量窗口、凭据、代理；导入导出、测试、重认证、批量编辑 | 状态和优先级紧邻名称；默认按优先级降序；服务历史为多根窄竖条；高风险凭据只在详情中显示 | `UiDataTable`、`AccountServiceStatus`、`UiNumberStepper`、`UiTableToolbar`、`UiDrawer`、`UiTooltip`、`UiConfirmDialog` | 列表横滚且优先级仍可编辑；最后一格无黑色选中态；Tooltip 自动避让视口；测试提供 mock fixture 仅限开发预览 |
| 10 | `/admin/announcements` | 标题、类型、状态、定向范围、有效时间、阅读率；编辑、预览、阅读明细 | 主表 + 右侧编辑/详情；预览复用真实公告组件；列表弹窗和详情弹窗共用响应式协议 | `UiDataTable`、`UiStatusBadge`、`UiDrawer`、`UiAnnouncementDialog`、`UiDateRangePicker` | 公告弹窗最大高度基于 `dvh`，底部安全区；正文 14px，不因浏览器栏遮挡操作 |
| 11 | `/admin/proxies` | 代理地址脱敏、状态、延迟、成功率、关联账号、最近检测；导入、检测、CRUD | 顶部健康摘要；主体密集表；检测结果以状态和延迟排序；关联账号放详情 | `UiDataTable`、`UiProgressBar`、`UiStatusBadge`、`UiDrawer`、`UiFileUpload`、`UiConfirmDialog` | 表格横滚；导入用 Sheet；敏感值默认脱敏，复制需明确动作 |
| 12 | `/admin/redeem` | 兑换码、面值、状态、批次、创建/使用用户与时间；生成、导出、批量更新 | 批次摘要 + 表格；生成器为 Dialog；码值等宽；危险失效操作明确影响数量 | `UiTableToolbar`、`UiDataTable`、`UiCodeBlock`、`UiDialog`、`UiConfirmDialog`、`UiFileUpload` | 表格横滚；生成表单单列；导出成功显示文件信息而非只发 Toast |
| 13 | `/admin/promo-codes` | 促销码、折扣方式/值、限制、有效期、使用次数、状态；使用记录 | 主表呈现规则摘要；编辑 Drawer；使用记录 Timeline/Table；避免多个彩色标签竞争 | `UiDataTable`、`UiBadge`、`UiDrawer`、`UiDescriptionList`、`UiTimeline`、`UiConfirmDialog` | 横滚；促销规则自动换行；过期、用尽、停用用不同语义状态 |
| 14 | `/admin/settings` | general/agreement/features/security/users/gateway/payment/email/backup 九类设置；未保存状态、校验和依赖关系 | 左侧 sticky 本地导航，右侧分区表单；页面页头显示保存/重置；每区直接排列字段，不套多层卡片 | `UiTabs` 或 `UiNavItem`、`UiFormField`、`UiFieldHelp`、`UiSwitch`、`UiAccordion`、`UiAlert`、`UiButton` | 手机端本地导航改水平 Tabs/下拉；底部固定保存栏避开键盘；切换分类前提示未保存修改 |
| 15 | `/admin/risk-control` | 运行状态、内容审核日志、七类策略配置、命中原因、处理结果 | 运行状态与风险事件优先；策略放 Tabs；事件用主表；详情显示原始/处理后信息及策略命中链 | `UiConnectionStatus`、`UiTabs`、`UiDataTable`、`UiErrorDetailDialog`、`UiFormField`、`UiAlert` | 表格横滚；敏感内容折叠；权限不足和功能关闭需专门状态 |
| 16 | `/admin/prompt-audit` | Runtime、Endpoint Pool、Policy、Event Workspace；吞吐、队列、策略和事件 | 以四个连续工作区构成，不做卡片套卡片；Runtime 摘要在首屏；事件表为主体 | `AppGrid`、`UiConnectionStatus`、`UiProgressBar`、`UiDataTable`、`UiDrawer`、`UiTabs` | 工作区单列；事件表横滚；实时数据变更只更新数值，不重排页面 |
| 17 | `/admin/usage` | 总费用/Token/请求/缓存；趋势；模型、分组、端点分布；用量明细；错误明细；导出与清理 | KPI -> 趋势/分布 -> Tabs 明细；与用户 `/usage` 共用缓存百分比标签和费用格式；高级维度仅管理员显示 | `UiStatMetric`、`UiMetricTrend`、`UiTabs`、`UiFilterBar`、`UiDataTable`、`UsageCostBreakdown`、`UiConfirmDialog` | 图表单列；记录表保持列表横滚；“今天”使用本地时区当天 `[00:00, 次日00:00)` |
| 18 | `/admin/affiliates/invites` | 邀请人、被邀请人、邀请码、状态、注册时间、归因 | 三个联盟页共用同一记录壳和列配置；本页突出归因链和转化状态 | `AppPage`、`UiFilterBar`、`UiDataTable`、`UiDrawer` | 横滚；身份列和状态优先；无数据时解释邀请功能是否启用 |
| 19 | `/admin/affiliates/rebates` | 用户、来源订单/消费、返佣比例、金额、状态、时间 | 同共享壳；金额与比例使用等宽数字；详情展示计算依据 | `UiDataTable`、`UiDescriptionList`、`UiStatusBadge`、`UiDrawer` | 横滚；金额不折行；失败状态显示原因 |
| 20 | `/admin/affiliates/transfers` | 发起人、方向、额度/佣金、状态、前后余额、时间 | 同共享壳；突出方向、金额和前后余额；异常转账可诊断 | `UiDataTable`、`UiTimeline`、`UiErrorDetailDialog`、`UiStatusBadge` | 横滚；方向同时用图标和文字；保留精确金额 |
| 21 | `/admin/orders/dashboard` | GMV/实收/退款/订单；日收入；支付方式；Top 用户；异常支付 | 商业 KPI 第一行；收入趋势 2/3，支付方式 1/3；异常订单表置底并可跳订单页 | `UiStatMetric`、`UiMetricTrend`、`AppGrid`、`UiDataTable`、`UiDateRangePicker` | KPI 两列；图表单列；金额与时间范围固定格式 |
| 22 | `/admin/orders` | 订单号、用户、商品、金额、渠道、状态、时间；详情、取消、重试、退款 | 单一交易表；订单详情 Drawer 内用 Timeline；退款为高风险独立 Dialog | `UiFilterBar`、`UiDataTable`、`UiDrawer`、`UiTimeline`、`UiConfirmDialog`、`UiStatusBadge` | 表格横滚；订单号可复制；支付/退款状态不混用；中转失败提供重试信息 |
| 23 | `/admin/orders/plans` | 套餐名、适用分组、周期额度、价格、有效期、5小时/7天/总限额、状态、排序；导入导出 | 主表直观展示关键约束；编辑 Drawer 分“商品/分组/额度窗口/上架”；JSON 导入支持文件与粘贴，先预检再提交 | `UiDataTable`、`UiFileUpload`、`UiTextArea`、`UiDrawer`、`UiTabs`、`UiAlert`、`UiConfirmDialog` | 横滚；长介绍仅在详情展开；导入错误精确到计划和字段；不携带任何默认业务数据 |

### 7.2 内部管理员页面（1）

| 路由 | 职责 | 规划 |
| --- | --- | --- |
| `/admin/ui-system` | 114 个组件的交互、状态、主题和响应式验收 | 不进入正式侧栏；覆盖 normal/hover/focus/disabled/loading/error/empty、长文本、暗色、reduced motion；作为页面迁移前置门禁 |

### 7.3 管理员表格页面 ASCII

```text
┌ 用户管理 ───────────────────────────────────────── [新建用户] ┐
│ 用户 12,480   正常 12,301   风险 19   今日新增 43             │
├───────────────────────────────────────────────────────────────┤
│ [搜索____________] [角色⌄] [状态⌄] [分组⌄]  [列] [导出]      │
│ 已选择 8 项： [批量分组] [批量禁用]                           │
├──┬────────────┬──────┬────────┬────────┬──────────┬───────────┤
│□ │用户        │状态  │分组    │余额    │最近活跃  │操作       │
├──┼────────────┼──────┼────────┼────────┼──────────┼───────────┤
│□ │user@...    │正常  │GPT-A   │¥42.60  │2 分钟前  │[···]      │
│□ │...         │...   │...     │...     │...       │[···]      │
└──┴────────────┴──────┴────────┴────────┴──────────┴───────────┘
```

### 7.4 运维页面 ASCII

```text
┌ 系统状态 ─────────────────────────────────────────────────────┐
│  ┌─────────┐  CPU       [████████░░░░] 64%   API    [正常]   │
│  │  97.8%  │  内存      [██████░░░░░░] 48%   DB     [正常]   │
│  │  健 康  │  Redis     [████░░░░░░░░] 31%   Queue  [积压]   │
│  └─────────┘  并发      [█████░░░░░░░] 39%   Worker [正常]   │
├───────────────────────────────────────────────────────────────┤
│ 请求 12,480  错误 0.7%  首字 620ms  总耗时 3.2s  12:42:16    │
├────────────────────────────────┬──────────────────────────────┤
│ 请求/并发趋势                  │ 延迟/错误分布                │
│                                │                              │
├────────────────────────────────┴──────────────────────────────┤
│ 实时日志 / 告警 / 请求详情 Tabs                               │
└───────────────────────────────────────────────────────────────┘
```

### 7.5 设置页 ASCII

```text
┌ 系统设置 ──────────────── 已保存 12:40 ── [放弃] [保存修改] ┐
├──────────────────┬───────────────────────────────────────────┤
│ 常规             │ 站点身份                                  │
│ 协议             │ Logo      [预览____________] [上传]        │
│ 功能             │ Icon      [预览]            [上传]        │
│ 安全             │ 站点名称  [________________________]       │
│ 用户             │───────────────────────────────────────────│
│ 网关             │ 功能开关                                  │
│ 支付             │ 操练场                 [ 开关 ] [?]       │
│ 邮件             │ 模型广场               [ 开关 ] [?]       │
│ 备份             │                                           │
└──────────────────┴───────────────────────────────────────────┘
```

## 8. 用户域页面逐页规划

### 8.1 用户功能页面（14）

| # | 路由 | 参考等级 | 页面必须显示的内容 | 布局与信息层级 | 公共组件 | 移动端与状态 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `/dashboard` | 对应 `/console/balance`，结构复刻 | 可用余额、有效订阅、周期额度、用量、最近请求、模型拆分、快捷动作 | 复刻 MiMo 页标题和余额统计节奏；首屏回答“还能用多少、何时重置、下一步做什么”；趋势和记录置后 | `UiStatMetric`、`QuotaMeter`、`UiMetricTrend`、`AppGrid`、`UiDataTable`、`UiAlert` | 统计两列；图表单列；无订阅时提供购买或充值动作，不显示空壳 |
| 2 | `/keys` | 对应 `/console/api-keys`，直接复刻 | Key 名称/前缀、状态、分组、订阅绑定、限额、限速、创建/最近使用；使用示例 | 复刻信息提示 + 标题操作 + 紧凑表格 + 创建/编辑 Dialog；Key 仅创建后完整显示一次 | `UiDataTable`、`UiTableToolbar`、`UiStatusBadge`、`UiDialog`、`UiCodeBlock`、`UiCopyButton`、`UiConfirmDialog` | 表格横滚；创建转 Sheet；密钥保存提醒不被遮挡 |
| 3 | `/playground` | 小米无对应，设计语言映射 | 对话、生图、分组、模型、附件、参数、请求预览；模型 ID、首字、耗时、速度、时间戳 | 使用 MiMo 控制台壳和 32px 控件；对话区为主体；模型/分组位于 Composer；参数是次级面板 | `AppSplitPane`、`UiCombobox`、`UiSheet`、`UiCodeBlock`、`UiImagePreview`、`UiErrorDetailDialog` | 参数转 Sheet；Composer 固定底部但不套额外卡片；图片小缩略图可放大 |
| 4 | `/batch-image` | 参考 `/console/plugin` 密度，业务自定义 | 任务列表、创建参数、进度、结果、错误、图片预览、必要指南 | 任务表为主体；创建用 Drawer；说明沿用 MiMo 工具页的紧凑标题/动作，不做说明卡墙 | `UiDataTable`、`UiProgressBar`、`UiDrawer`、`UiAccordion`、`UiImagePreview`、`UiErrorDetailDialog` | 表格横滚；创建转全高 Sheet；任务进度不改变行高 |
| 5 | `/usage` | 对应 `/console/usage`，直接复刻 | 总费用、Token、请求、缓存命中；趋势/分布；请求与错误记录；时间筛选 | 复刻 MiMo 用量统计块、标题、时间筛选、图表、表格和分页；加入 Qiu 缓存百分比与分组维度 | `UiStatMetric`、`UiMetricTrend`、`UiDateRangePicker`、`UiTabs`、`UiDataTable`、`UiBadge`、`UsageCostBreakdown` | 表格横滚不转卡片；今天查询 `[本地00:00, 次日00:00)`；列宽稳定 |
| 6 | `/redeem` | 小米无对应，设计语言映射 | 兑换码输入、可兑换结果、成功额度、历史状态 | 使用 MiMo 内容壳、表单尺寸和表格；单一紧凑输入操作区，不做营销容器 | `UiTextField`、`UiButton`、`UiAlert`、`UiDataTable`、`UiStatusBadge` | 输入与按钮可换两行；成功后保留到账说明；失效原因准确 |
| 7 | `/affiliate` | 小米无对应，设计语言映射 | 邀请码/链接、邀请人数、返佣、可转额度、记录；复制与转账 | 浅米统计块 + 链接工具行 + 记录 Tabs；数字层级参考 MiMo usage | `UiStatMetric`、`UiCopyButton`、`UiTabs`、`UiDataTable`、`UiConfirmDialog` | 统计两列；记录横滚；未启用显示真实功能状态 |
| 8 | `/available-channels` | 参考 `/console/plugin`，结构借鉴 | 当前用户与分组可用的渠道、平台、模型/能力、状态与说明 | 复刻工具页标题/筛选/动作密度；主体保持列表，不改可见性逻辑 | `UiFilterBar`、`UiDataTable`、`UiBadge`、`UiStatusBadge`、`UiMobileTableScroller` | 手机仍是列表横滚；长模型集合按需展开 |
| 9 | `/profile` | 对应 `/console/profile`，直接复刻 | 头像与基础资料、密码、TOTP、Passkey、第三方绑定、余额提醒、账单偏好 | 复刻居中标题、约 540px 资料面、90px 标签列和按钮区；再用相同结构扩展安全/账单分区 | `AppSection`、`UiFormField`、`UiPasswordField`、`UiSwitch`、`UiDescriptionList`、`UiConfirmDialog` | 单列；安全凭据使用 Sheet；保存局部反馈；敏感操作二次确认 |
| 10 | `/subscriptions` | 对应 `/console/plan-manage`，结构复刻 | 每个实例、套餐、允许分组、本期用量、5小时/7天/总限额、重置、到期；绑定 Key、续费 | 复刻套餐列表、价格/周期/标签/操作对齐；Qiu 增加实例号和三窗口额度，权益不可折叠丢失 | `QuotaMeter`、`UiStatusBadge`、`UiDescriptionList`、`UiDialog`、`UiProgressBar`、`UiButton` | 指标换行但不丢字段；到期/超限/未选分组分别提示；续费目标明确 |
| 11 | `/purchase` | 对应 `/console/recharge`，结构复刻 | 充值与订阅 Tabs、套餐介绍/标签/折扣/价格/额度窗口/分组；支付方式和订单状态 | 复刻金额、支付方式、状态和订单信息；订阅商品保持价格基线与纯色标签，不使用渐变顶条 | `UiTabs`、`UiBadge`、`UiRadioGroup`、`UiDescriptionList`、`UiButton`、`PaymentStatusPanel` | 商品单列；标签不挤压介绍；底部操作避开浏览器栏；提交前复核权益 |
| 12 | `/orders` | 对应 `/console/invoice`，结构借鉴 | 订单号、商品、金额、状态、支付方式、创建/支付时间；取消与退款 | 复刻财务表格、筛选、状态和详情动作；订单详情用 Timeline；不引入发票专有字段 | `UiDataTable`、`UiFilterBar`、`UiStatusBadge`、`UiDrawer`、`UiTimeline`、`UiConfirmDialog` | 横滚；订单号/金额/状态优先；详情转 Sheet；轮询不闪烁 |
| 13 | `/monitor` | 小米无对应，设计语言映射 | 渠道健康、成功率、延迟、历史趋势、可用模型；管理员额外诊断 | 使用 MiMo usage 的统计/图表/表格节奏；健康信息优先，角色差异只改变授权字段 | `MonitorHealthSummary`、`UiTabs`、`UiDataTable`、`UiProgressBar`、`UiErrorDetailDialog` | 趋势单列；矩阵横滚；隐藏吞吐量时不留空列；刷新保持位置 |
| 14 | `/custom/:id` | 小米无对应，设计语言映射 | 后台配置的 Markdown 或安全嵌入 URL；加载/无权限/错误 | 使用统一用户壳；不假设内容；标题与导航来自配置；保留净化与安全限制 | `AppPage`、`AppPageHeader`、`UiSkeleton`、`UiErrorState`、`UiAlert` | iframe 适配可用高度；长链接/代码换行；缺失配置给返回路径 |

### 8.2 支付后续流程页面（5）

| 路由 | 职责 | 目标布局与组件 | 关键状态 |
| --- | --- | --- | --- |
| `/payment/qrcode` | 展示二维码、倒计时、轮询订单、取消或完成 | 居中的紧凑交易面板；`UiProgressBar`、`UiStatusBadge`、`UiButton`、`UiAlert` | 待支付、已过期、已取消、成功、轮询失败；页面恢复后继续正确订单 |
| `/payment/result` | 显示付款结果/收据并引导回订阅、订单或控制台 | `UiStatusBadge`、`UiDescriptionList`、`UiTimeline`、`UiButton` | 成功、处理中、失败、未知；不把网络失败直接等同支付失败 |
| `/payment/stripe` | 承载 Stripe Element、微信二维码或跳转支付 | 最小交易壳，第三方控件外不叠加多余容器；`UiAlert`、`UiLoadingOverlay` | SDK 加载、需要动作、处理中、恢复、错误；错误可复制 request/order ID |
| `/payment/airwallex` | 恢复快照并跳转托管结账 | 最小中转页；`UiSpinner`、`UiConnectionStatus`、`UiErrorState` | 初始化、重定向、快照失效、恢复失败 |
| `/payment/stripe-popup` | 弹窗初始化、支付和状态回传 | popup 专用紧凑布局，不套完整 AppLayout；`UiSpinner`、`UiAlert` | 等待父窗、初始化、支付中、成功关闭、通信失败 |

### 8.3 用户仪表盘 ASCII

```text
┌ 我的控制台 ─────────────────────────────────────── [创建 Key] ┐
│ 可用余额 ¥38.60   有效订阅 2   本周剩余 ¥31.40   7 天后重置 │
├───────────────────────────────┬───────────────────────────────┤
│ 额度窗口                      │ 最近 30 天用量                 │
│ 5 小时  不限制                │                               │
│ 7 天    [██████░░░░] 62%      │                               │
│ 总额度  [███░░░░░░░] 31%      │                               │
├───────────────────────────────┴───────────────────────────────┤
│ 最近请求  模型 / Token / 费用 / 缓存 / 时间 / 状态           │
└───────────────────────────────────────────────────────────────┘
```

### 8.4 手机用量列表 ASCII

```text
┌ 使用记录 ────────────────────┐
│ 今天  [时间范围] [筛选]       │
├───────────────────────────────┤
│ ← 横向滚动，不转换成大卡片 → │
│┌────────┬────────┬──────┬────┐│
││时间    │模型    │费用  │缓存││
│├────────┼────────┼──────┼────┤│
││12:40   │gpt-... │¥0.02 │72% ││
││12:38   │...     │...   │... ││
│└────────┴────────┴──────┴────┘│
└───────────────────────────────┘
```

### 8.5 订阅与支付 ASCII

```text
┌ 购买 ────────────────────────────────────────────────────────┐
│ [充值] [订阅]                                                │
├──────────────────────────────────────────────────────────────┤
│ Standard          [Comprehensive] [35% OFF]      ¥104 / 30天 │
│ 日常开发与内容创作；适用于 GPT-A、GPT-B 分组                  │
│ 5小时 不限制  ·  每7天 ¥40  ·  周期总额 ¥160   [选择]        │
├──────────────────────────────────────────────────────────────┤
│ Pro               [高频使用] [35% OFF]           ¥259 / 30天 │
│ ...                                                      [选择]│
└──────────────────────────────────────────────────────────────┘
```

### 8.6 操练场 ASCII

```text
┌ 操练场 ───────────────────────────────────────── [请求记录] ┐
│                                           │ 参数             │
│ 你：生成一张蓝色简约产品图                │ temperature 0.7 │
│                                           │ max tokens       │
│ 助手：                                    │ stream [开]      │
│ ┌──────────────┐                          │                  │
│ │ 图片缩略图   │ [放大] [下载]            │                  │
│ └──────────────┘                          │                  │
│ gpt-image-2 · 首字 0.8s · 耗时 6.2s       │                  │
│ 速度 42 tok/s · 2026-08-14 14:32:10       │                  │
├───────────────────────────────────────────┴──────────────────┤
│ [分组⌄] [模型⌄]  输入消息或图片…                 [发送]       │
└──────────────────────────────────────────────────────────────┘
```

## 9. 公开、认证与系统页面规划

### 9.1 公开常规页面（4）

| 路由 | 内容与职责 | 组件与布局 |
| --- | --- | --- |
| `/home` | 品牌、核心价值、模型覆盖、接入方式、能力、价格说明、使用场景和明确 CTA；保留后台动态站名、Logo、文档、首页覆盖和 compact 模式 | 独立公开 Header；内容全宽分区；产品图与有效动效可用；不复用后台卡片堆叠；移动首屏仍露出下一部分 |
| `/key-usage` | 输入 API Key 查询额度、周期、用量和记录 | 复用公开 Header；紧凑工具页；`UiTextField`、`UiButton`、`QuotaMeter`、`UiDataTable`；Key 默认脱敏 |
| `/legal/:documentId` | 法律文档标题、生效时间、正文、加载/缺失/错误 | 复用公开 Header；窄阅读列；目录可选；`UiSkeleton`、`UiErrorState`；正文排版满足长文本 |
| `/model-plaza` | 模型列表、提供方、能力、上下文、分组价格/倍率和状态；公开独立态与控制台嵌入态 | 同一个 `ModelPlazaContent`，外壳按场景切换；桌面/手机均为列表，筛选固定，手机横滚；不做模型卡片墙 |

### 9.2 认证页面（12）

| 页面组 | 路由 | 显示内容 | 统一方式 |
| --- | --- | --- | --- |
| 基础认证 | `/login`、`/register` | 必要字段、验证码/邀请码、第三方登录、协议、错误与页面切换 | 持久 `AuthShellView` + `AuthLayout` + `AuthFormPanel`；输入/按钮 32px；切换交叉淡入，不出现空帧 |
| 账号验证 | `/email-verify` | 邮箱、验证码、重发、倒计时、成功/失败 | 复用认证壳；初始不显示无意义规则说明；错误出现时就近显示 |
| 密码恢复 | `/forgot-password`、`/reset-password` | 邮箱、新密码、确认、链接失效、提交成功 | 复用认证壳；密码规则放 `UiFieldHelp`，错误时显示具体不符合项 |
| OAuth 完成 | `/auth/callback`、`/auth/linuxdo/callback`、`/auth/wechat/callback`、`/auth/dingtalk/callback`、`/auth/oidc/callback` | 处理中、补充资料、绑定/创建、TOTP、邀请信息和失败重试 | 共用 OAuth completion 状态模板；只在需要用户输入时显示表单；处理中保持最小界面 |
| OAuth 补充 | `/auth/dingtalk/email-completion` | 补充邮箱、校验和继续 | 复用认证表单壳，不另造页面结构 |
| 支付回调 | `/auth/wechat/payment/callback` | 恢复支付目标、处理中、错误返回 | 使用最小支付中转模板，不混入账户注册说明 |

### 9.3 系统页面（2）

| 路由 | 内容 | 规划 |
| --- | --- | --- |
| `/setup` | 初始化步骤、数据库/管理员/系统配置、验证和完成 | 独立 Wizard；步骤、当前校验、错误和返回动作明确；不使用普通后台侧栏 |
| `/:pathMatch(.*)*` | 404、当前路径、返回上一页/首页/控制台 | 简洁系统反馈页；不使用大段营销内容；根据登录状态选择主动作 |

## 10. 弹窗、Drawer 与 Sheet

### 10.1 选择规则

- 小型确认、短表单：`UiDialog`。
- 不可逆操作：`UiConfirmDialog`，默认焦点放安全动作。
- 列表详情、复杂编辑且需保留来源上下文：桌面 `UiDrawer`。
- 手机复杂编辑、公告详情、浏览器栏可能遮挡内容：`UiSheet`。
- 大图：`UiImagePreview`；日志或图表大视图：`UiFullscreenPanel`。

```text
桌面                                       手机
┌──────────── 主页面 ────────────┬──────┐  ┌──────────────────────┐
│ 表格仍可见                    │详情  │  │ 标题              [×]│
│                               │      │  ├──────────────────────┤
│                               │表单  │  │ 可滚动正文/表单       │
│                               │      │  │                      │
└───────────────────────────────┴──────┘  ├──────────────────────┤
                                          │ [取消]       [确认]  │
                                          │ safe-area + keyboard │
                                          └──────────────────────┘
```

### 10.2 强制行为

- 使用 `100dvh` 和安全区，不使用固定 `100vh` 导致移动浏览器遮挡。
- 标题与底部动作固定，中间正文独立滚动。
- Tooltip/Popover 自动翻转和限制宽度，不能被表格或视口裁切。
- 关闭后焦点返回触发元素；Escape、遮罩关闭行为由组件统一控制。
- 加载只覆盖当前操作面板，不让整个页面丢失上下文。

## 11. 加载、空、错与权限状态

每个页面必须设计以下状态，不能只设计有数据时的画面：

| 状态 | 要求 |
| --- | --- |
| 首次加载 | `UiSkeleton` 预留最终栅格宽高；Sidebar、页头和内容列宽立即稳定 |
| 局部刷新 | 保留旧数据和布局，显示局部 Spinner/更新时间；不可整页闪白 |
| 空数据 | 说明是从未有数据、被筛选为空还是功能未启用；提供一个合理动作 |
| 错误 | 显示影响范围、可重试动作和必要 request ID；网络错误不伪装为业务失败 |
| 无权限 | 说明权限不足并提供返回路径，不渲染残缺页面 |
| 功能关闭 | 显示 feature flag 状态与管理员开启位置；不显示 mock 业务数据 |
| 长文本 | 中文、英文、模型 ID、URL、邮箱均不可覆盖相邻内容；需要时换行或 Tooltip |
| 实时数据 | 不改变容器尺寸、不反复播放入场动画、不抢走用户滚动和焦点 |

## 12. 动效规范

```css
--motion-instant: 100ms;
--motion-fast: 140ms;
--motion-base: 180ms;
--motion-slow: 240ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

- hover/focus：`100-140ms`。
- 登录与注册切换：持久壳内 `140ms` 交叉淡入，位移不超过 `4px`。
- Dialog：遮罩淡入 + 内容 `4-8px` 位移，`180ms`，禁止弹跳缩放。
- Drawer/Sheet：`180-240ms` transform。
- 表格排序、筛选、分页不做逐行动画，必须保持表头与工具栏尺寸。
- 实时监控只对数值做平滑更新，不重放整个图表入场。
- `prefers-reduced-motion: reduce` 下移除非必要变换、平滑滚动和图表入场。

## 13. 重构实施顺序

### Phase U0：参考基线冻结

1. 保存 Xiaomi MiMo 控制台已加载 CSS、关键页面 DOM/截图和浏览器视口数据，只作为内部实现参考。
2. 建立 `/console/balance`、`/console/usage`、`/console/api-keys`、`/console/profile`、`/console/recharge`、`/console/plan-manage`、`/console/invoice` 的参考矩阵。
3. 记录 Qiu 14 个用户功能页面与 5 个支付流程页当前真实业务流程、接口和截图。
4. 明确 feature flag、simple mode、backend mode 和管理员进入用户页时的差异。

完成标准：每个用户页面都被标记为“直接复刻、结构复刻或设计语言映射”。

### Phase U1：品牌令牌与用户控制台壳

1. 将 `ui-tokens.css` 从冷灰/蓝色方向改为首页米白、黑白、暖灰体系。
2. 按 C0-C4 顺序重构全部 114 个公共组件，先完成尺寸 API、基础控件、表格和 overlay。
3. 在 `/admin/ui-system` 建立 Xiaomi MiMo 对照 fixture，完成四尺寸、全状态和三视口验收。
4. 新建或收敛 `UserConsoleShell`，复刻 54px 顶栏、202/64px 侧栏、32px 菜单项和白色内容外壳。
5. 横版 Logo 在品牌栏位中居中；favicon 只用于浏览器标签页。
6. 建立稳定 Skeleton，确保刷新前后内容宽度、标题和主栅格完全一致。
7. 不重构管理员业务页面，UI System 仅作为公共组件验收入口。

完成标准：114 个组件完成新视觉迁移；核心组件不再只包装旧实现；用户所有页面先统一外壳；空、加载、有数据三种状态不发生宽度跳动。

### Phase U2：资料与 API Key

1. `/profile` 对照 `/console/profile` 直接复刻资料布局，再扩展 Qiu 安全和账单分区。
2. `/keys` 对照 `/console/api-keys` 复刻标题、提示、表格与 Dialog。
3. 统一 32px 表单、6px 圆角、字段帮助、密钥一次性展示和危险确认。

完成标准：两个页面在 1440px 与参考页面的壳、间距、字号、控件高度达到像素级一致；业务字段完整。

### Phase U3：Dashboard 与 Usage

1. `/dashboard` 使用 `/console/balance` 的页面标题、统计块和财务信息节奏。
2. `/usage` 对照 `/console/usage` 直接复刻统计、筛选、图表、表格和分页布局。
3. 注入 Qiu 特有的订阅额度窗口、分组、倍率、缓存百分比和错误明细。
4. 修复“今天”自然日时区边界，并为刷新/轮询保持布局稳定。

完成标准：第一屏能判断余额、订阅和用量；手机记录保持列表横滚。

### Phase U4：订阅、购买、订单与支付流程

1. `/subscriptions` 参考 `/console/plan-manage`；每个实例显示分组、额度窗口、重置和到期。
2. `/purchase` 参考 `/console/recharge`；统一充值、订阅、支付方式和状态面板。
3. `/orders` 参考 `/console/invoice` 的表格/筛选/状态结构，但使用 Qiu 订单和退款字段。
4. 统一 5 个支付后续页的中转、恢复、结果、错误和移动安全区。

完成标准：金额、商品、实例、权益、支付目标和订单状态无歧义；网络错误不被误报为支付失败。

### Phase U5：开发者工具

1. Playground、Batch Image、Available Channels、Model Plaza、Monitor。
2. 没有小米同类页面的功能，只继承用户壳、标题、32px 控件、暖灰表面、表格与浮层协议。
3. 操练场以对话为主体，模型选择进入 Composer，参数转次级面板。
4. 模型广场和可用渠道在所有视口保持列表；生图结果使用小型缩略图和预览。

完成标准：对话、生图、请求诊断、模型比较在 `390px` 可完成完整流程，无多层容器。

### Phase U6：增长、兑换与自定义页

1. Affiliate、Redeem、Custom Page 使用 Xiaomi MiMo 的统计、表单、表格、空态和页面壳语言。
2. 保留功能开关、Markdown 净化、iframe 安全和角色可见性。
3. 删除无业务价值的说明文字和装饰容器。

完成标准：没有对应参考页的功能仍与整体一致，但不会被错误描述为“小米复刻页”。

### Phase U7：用户端清理与发布

1. 删除用户端已无消费者的旧组件、局部 tokens 和旧 `.card/.btn/.input` 样式。
2. 搜索并消除用户页面的一次性颜色、尺寸、浮层和表格实现。
3. 自动化、三视口、暗色、reduced motion、Edge 对照截图和真实业务流程验收。
4. 管理员页面保持现状；管理员全量重构另立后续阶段。
5. 发布时按 `docs/RELEASE_VERSION_POLICY.md` 完成版本与产物检查。

## 14. 验收标准

### 14.1 视觉与布局

- 页面背景、工作面、文字、边界和 hover 与首页的米白/黑白/暖灰体系一致。
- 主要按钮为黑底白字；蓝色只用于链接、focus ring、信息状态或必要图表，不成为页面主色。
- 用户控制台桌面壳符合 `54px` 顶栏、`202/64px` 侧栏、`32px` 菜单项、`6px` 内容外壳基线。
- 页面第一屏能识别主任务、主要状态和主操作。
- 无卡片套卡片、无无意义渐变顶条、无品牌名前装饰色条。
- `1440px`、`900px`、`390px` 无正文级横向溢出、遮挡和按钮文字裁切。
- 需要比较的数据在手机端仍是表格，并在自己的滚动容器内横向滚动。
- 异步加载前后 Sidebar、页面宽度、标题和主要栅格不跳动。
- Logo 在所属顶部/侧栏品牌容器中视觉居中。
- 标记为“直接复刻”的页面必须有 Xiaomi MiMo 对照截图和关键尺寸差异记录；没有对应页面的不得宣称一比一复刻。

### 14.2 组件复用

- 按钮、表单、状态和浮层实例复用率 `>=95%`。
- 表格、筛选、分页复用率 `>=90%`。
- 页面壳、标题、工具栏和间距复用率 `>=90%`。
- 整体组件实例复用率 `>=85%`。
- 应用代码只从 `@/components/ui` 导入 UI contracts。
- 不为追求复用率抽象只使用一次且没有通用行为的业务视图。

### 14.3 功能与信息

- 重构前已有字段、动作、筛选、导出、批量操作和权限全部保留。
- 不修改 API payload、权限判断、计费、订阅扣费、渠道选择和路由规则。
- feature flag 关闭、simple mode、backend mode、管理员和普通用户差异保持一致。
- 金额、倍率、周期、本期、总额、预留、重置与到期字段不混淆。
- “今天”查询使用当前配置时区的完整自然日半开区间。
- 操练场显示模型 ID、首字、耗时、速度和请求时间戳；生图结果可预览。

### 14.4 交互与可访问性

- 全部交互可通过键盘完成，focus-visible 清晰。
- Icon-only 按钮有 accessible name，陌生图标有 Tooltip。
- Dialog/Drawer/Sheet 正确锁定与恢复焦点，Escape 行为一致。
- 状态不只依赖颜色；错误能被读屏器关联到字段或工作区。
- `prefers-reduced-motion` 下功能完整，无不必要动画。
- Tooltip 和 Popover 在桌面、表格、边缘位置正确翻转，不超出视口。

### 14.5 页面状态

- 每页验收 loading、loaded、empty、filtered-empty、error、no-permission、feature-disabled。
- 长中文、长英文、长模型 ID、URL、邮箱、金额和多标签均不破坏布局。
- 实时监控刷新不改变用户滚动、焦点和内容尺寸。
- 支付网络错误与支付业务失败分别显示，不能一律提示付款失败。

### 14.6 自动化与浏览器验收

每个迁移批次至少执行：

```bash
cd frontend
pnpm test
pnpm vue-tsc --noEmit
pnpm lint
pnpm build
```

浏览器矩阵：

| 视口 | 重点 |
| --- | --- |
| `1440px` | 桌面信息密度、侧栏、并排图表、表格列和 Drawer |
| `900px` | 平板断点、工具栏换行、两列转单列、侧栏行为 |
| `390px` | 手机表格横滚、Sheet、底部安全区、虚拟键盘、长文本 |

高风险流程必须做真实浏览器验收：

1. 用户控制台壳在登录态刷新、路由切换、折叠侧栏和移动菜单时保持稳定。
2. `/profile` 与 Xiaomi `/console/profile` 的结构、间距、字体和控件尺寸对照。
3. 创建 Key、编辑 Key、选择订阅分组、一次性密钥展示和删除确认。
4. 用户 Usage 的今天查询、缓存标签、请求表格和错误记录。
5. 购买、扫码/Stripe/Airwallex、结果恢复、订单与退款。
6. 订阅实例、5小时/7天/总额度、重置、到期和续费目标展示。
7. 操练场对话、生图、错误详情和图片预览。
8. 手机端 Usage、Model Plaza、Available Channels 与 Orders 的横向表格滚动。

## 15. 风险、约束与非目标

### 15.1 主要风险

- 114 个组件已经建立接口，但用户页面仍大量使用旧 `DataTable`、`Pagination`、`BaseDialog` 和局部样式；必须先迁移组件内部实现，再分批替换页面消费者，不能只靠全局 CSS 覆盖来伪装完成。
- Xiaomi MiMo 的 CSS 与 DOM 只作为视觉参考；直接复制其品牌资产、专有文案或无关业务结构会造成错误实现。
- Model Plaza 同时支持公开和控制台嵌入，必须复用内容而不是复制两份页面。
- 支付页包含第三方 SDK、popup、重定向和恢复快照，不可用普通 SPA 页面假设重写。
- 实时监控包含自动刷新；不稳定骨架、动画和重新排序会影响观察和操作。
- 自定义页内容来自配置，必须保留 URL 清洗、Markdown 净化和 iframe 安全边界。

### 15.2 非目标

- 不重写后端接口。
- 不改变订阅额度与分组扣费逻辑。
- 不修改管理员与用户权限模型。
- 不在当前阶段重构管理员业务页面和管理员导航。
- 不把全部页面设计成同一种卡片模板。
- 不隐藏复杂字段来制造“简洁”。
- 不在业务页面加入说明实现方式的文字。
- 不把移动端数据表转换为高大的记录卡片。

## 16. 完成定义

一个页面只有同时满足以下条件才算重构完成：

1. 使用首页一致的米白/黑白/暖灰令牌和适用的公共组件。
2. 业务信息、权限、动作和接口行为完整保留。
3. 页面主任务和信息层级符合本文逐页规划。
4. loading、empty、error、权限和 feature flag 状态完整。
5. 桌面、平板、手机、暗色和 reduced motion 验收通过。
6. 单元测试、类型检查、Lint、生产构建和浏览器主流程通过。
7. 已删除该页面被替代的旧样式和重复组件。
8. Code Review 未发现数据语义、计费、权限、可访问性或响应式回归。

本文是用户端前端重构的实施基线，同时保留管理员页面盘点附录。若用户路由、权限、支付或订阅业务新增，必须先更新本文件中的页面清单、参考映射、组件和验收标准，再进入实现；管理员重构开始前必须单独更新第 7 章与阶段计划。
