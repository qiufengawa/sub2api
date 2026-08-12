# 同档套餐多份订阅改造计划

## 0. 文档状态

- 状态：需求与验收标准已冻结，后续实现以本文为准。
- 开发分支：`feat/subscription-plan-quantity`。
- 独立工作树：`/Users/qiu/Desktop/Sub2API-subscription-quantity`。
- 基线：`v0.1.172-qiu.1`。
- 目标：管理员可为每个套餐设置单个用户同时持有的最大订阅份数；默认值为 `1`，保持现有单份订阅和续费行为；设置为 `N > 1` 后，用户最多可同时持有 `N` 份同一套餐。
- 本文中的“份”是独立订阅实例，不是把有效期或额度乘在同一数据库行上。

## 1. 产品契约

### 1.1 套餐上限

1. `subscription_plans.max_subscriptions_per_user` 表示单个用户可同时持有该套餐的最大份数。
2. 默认值和最小值均为 `1`。值 `2` 表示最多同时持有两份，值 `N` 表示最多同时持有 `N` 份。
3. 不设置人为产品上限；仅接受 PostgreSQL `INTEGER` 安全范围内的正整数 `1..2147483647`。
4. 后台创建、编辑、目录导入和 API 均拒绝 `0`、负数、小数、指数形式、字符串、布尔值、`null` 和溢出值，不静默修正。
5. 存量套餐通过迁移补为 `1`，升级后行为不变。
6. 管理员可把上限调低到当前持有份数以下；已有已付款权益不删除、不合并、不缩短，新购会被阻止，直至同时持有份数低于新上限。

### 1.2 独立订阅实例

每份同档订阅必须拥有独立的：

- `user_subscriptions.id`；
- 开始时间、到期时间和状态；
- 5 小时额度窗口、周期额度窗口和整个期限总额度；
- 已用额度、预留额度和钱包兜底配置；
- 支付订单归属、退款和审计记录。

两个 Pro 不得实现为“一个 Pro 延长两倍时间”，也不得把两份额度合并后失去各自期限。计费继续按现有候选顺序逐份使用：优先使用最早到期且仍能承担本次请求的订阅，当前份额度不足时再尝试下一份。

### 1.3 新购与续费

1. 套餐上限为 `1` 时：
   - 没有有效实例时，购买创建新实例；
   - 已有有效实例时，套餐购买入口保持现有续费语义；
   - “我的订阅”中的续费必须续费用户选择的具体实例。
2. 套餐上限大于 `1` 时：
   - 当前份数小于上限，套餐卡提供“再订一份”，支付成功后创建独立实例；
   - 达到上限后，“再订一份”禁用并显示已达上限；
   - 每个已有实例仍可单独续费，续费不增加份数。
3. “同时持有份数”统计未软删除且仍属于当前权益的实例：`active`、`suspended` 且尚未到期的实例均占用份数；已到期实例不占用新购份数。
4. 为避免并发超卖，创建订单时必须在同一数据库事务和同一用户/套餐互斥范围内，同时统计：
   - 当前占用份数的订阅实例；
   - 尚未终结、准备创建新实例的订阅订单槽位。
5. 支付中的新购订单会预占一份名额；订单取消、失败或过期后释放。支付完成前管理员降低上限时，已付款订单仍须可履约，不能让用户付款后丢失权益。

### 1.4 兼容入口

- 管理员分配、默认注册订阅、兑换码和旧内部调用继续保持既有“存在则复用/续期”语义，除非调用方明确请求创建新实例。
- 所有新建实例仍受套餐上限检查，不能通过非支付入口绕过上限。
- 老客户端未发送购买模式时：上限为 `1` 且已有实例则按续费处理；否则按新购一份处理。
- 旧订单快照和旧退款记录继续使用兼容回退逻辑；新订单必须记录确定的购买模式和目标/履约订阅 ID。

## 2. 当前实现差距

1. 数据库部分唯一索引 `user_subscriptions_user_plan_unique_active` 强制每个未软删除的 `(user_id, plan_id)` 只有一行。
2. `GetByUserIDAndPlanID` 和分配服务默认只处理一行，再次购买会调用 `AssignOrExtendSubscription` 延长期限。
3. 支付履约和退款通过用户与套餐查找订阅，存在多行后会选错实例。
4. 套餐模型、后台 CRUD、公开套餐响应、目录导入导出和前端类型均没有份数上限字段。
5. 用户套餐卡只区分“订阅”和“续费”，不能展示已持有份数、剩余可购份数或指定续费实例。

## 3. 数据与迁移设计

### 3.1 新字段

- `subscription_plans.max_subscriptions_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_subscriptions_per_user >= 1)`。
- `payment_orders.fulfilled_subscription_id BIGINT NULL`，记录订阅订单实际创建或续费的实例，用于幂等、查询和退款。
- 新订阅订单快照升级版本，增加：
  - `purchase_mode`: `new_instance` 或 `renew_instance`；
  - `target_subscription_id`: 仅续费时存在；
  - `max_subscriptions_per_user`: 下单时审计快照。

### 3.2 索引

- 删除旧的 `user_subscriptions_user_plan_unique_active` 部分唯一索引。
- 保留普通 `(user_id, plan_id)` 查询索引。
- 为占用份数查询增加适合 `user_id + plan_id + status + expires_at` 的部分索引。
- `payment_orders.fulfilled_subscription_id` 增加普通索引；支付订单本身仍由既有订单幂等和审计约束保证一次履约。

### 3.3 迁移原则

- 只新增新的前向迁移，不修改已经发布的 192、195 等迁移。
- 迁移可重复执行，存量套餐全部得到默认值 `1`，存量订阅行不改写。
- Ent schema 和生成代码必须与 PostgreSQL 迁移一致。
- 回滚到旧二进制前必须确认不存在重复 `(user_id, plan_id)` 的未删除实例；产生多份实例后不能无损恢复旧唯一索引，因此发布说明必须标明数据库向前兼容边界。

## 4. 后端实现

### 4.1 套餐配置

- Create/Update 请求、实体响应和校验加入 `max_subscriptions_per_user`。
- 创建时未传按 `1`；更新时未传保持原值。
- 管理端和公开套餐响应返回规范化整数。
- 目录导入/导出增加可选字段；旧目录缺失时创建默认 `1`、更新保持现值，模板显式写 `1`。

### 4.2 订阅仓储与领域服务

- 增加按用户/套餐列出实例、按 ID 锁定实例、统计当前占用份数的仓储方法。
- 保留旧 `GetByUserIDAndPlanID` 作为兼容查找，但新购、续费、退款不得依赖其模糊选择。
- 新增明确的订阅获取模式：
  - `new_instance` 创建独立行；
  - `renew_instance` 只更新指定订阅 ID。
- 新实例创建与上限判断在事务内完成，并使用用户/套餐级数据库互斥避免并发越限。
- 恢复软删除实例时同样检查上限；恢复已到期实例不占当前份数，但不得制造数据库约束冲突。

### 4.3 支付订单

- 创建订阅订单时解析购买模式并校验目标实例归属。
- 新购订单在事务内预占名额，重复并发下单不能超过上限。
- 快照保存上限、购买模式和目标实例，套餐随后编辑不改变已创建订单语义。
- 履约时：
  - `new_instance` 创建一行并写入 `fulfilled_subscription_id`；
  - `renew_instance` 续费快照指定的实例并写入同一字段；
  - 重复 webhook/重试读取已写入 ID，不能再次创建或延长。
- 新订单退款只处理 `fulfilled_subscription_id` 指向的实例；旧订单保留按订单注记和套餐查找的兼容路径。

### 4.4 计费

- 请求和批量生图的订阅候选查询继续返回全部覆盖目标分组的实例。
- 候选稳定按 `expires_at ASC, id ASC`，逐份判断 5 小时、周期和总额度。
- 一次请求只从一份订阅预留与结算，不跨两份拆分金额。
- 某份额度不足时继续尝试下一份；全部不足后才按现有钱包兜底与用户计费偏好处理。

## 5. 前端实现

### 5.1 管理端

- 套餐创建/编辑弹窗加入整数输入“单用户最大订阅份数”，默认 `1`、最小 `1`，不设置 HTML 产品最大值。
- 提示文案明确：`1` 仅允许一份；`2` 允许两份；每份额度和期限独立。
- 套餐列表增加紧凑的最大份数列。
- 中英文文案、类型、API payload、目录模板和导入预览字段名同步。

### 5.2 用户端购买

- 套餐卡显示“已持有 X / N 份”。
- 未持有时显示“立即订阅”；上限大于 1 且未满时显示“再订一份”；达到上限时禁用新购并显示“已达上限”。
- 上限为 `1` 时保留现有套餐卡续费入口行为。
- “我的订阅”每条记录的续费链接携带 `subscription_id`，购买页明确显示正在续费的实例及其到期时间。
- 微信恢复、二维码、Stripe/支付宝/微信/Airwallex 状态机继续携带购买模式和目标订阅 ID，恢复后不得退化成另一种购买语义。

## 6. 影响文件范围

预计涉及：

- `backend/ent/schema/subscription_plan.go`
- `backend/ent/schema/user_subscription.go`
- `backend/ent/schema/payment_order.go`
- `backend/ent/**` 生成代码
- `backend/migrations/`
- `backend/internal/repository/user_subscription_repo.go`
- `backend/internal/service/subscription_service.go`
- `backend/internal/service/payment_config_*.go`
- `backend/internal/service/payment_order.go`
- `backend/internal/service/payment_fulfillment.go`
- `backend/internal/service/payment_refund.go`
- `backend/internal/service/payment_catalog_import.go`
- `backend/internal/handler/payment_handler.go`
- `backend/internal/handler/admin/payment_handler.go`
- `frontend/src/types/payment.ts`
- `frontend/src/views/admin/orders/PlanEditDialog.vue`
- `frontend/src/views/admin/orders/AdminPaymentPlansView.vue`
- `frontend/src/components/payment/SubscriptionPlanCard.vue`
- `frontend/src/views/user/PaymentView.vue`
- `frontend/src/views/user/SubscriptionsView.vue`
- `frontend/src/components/payment/paymentFlow.ts`
- 中英文 `payment` 文案和相关测试。

## 7. 实施阶段

1. **契约与迁移**：新增字段、索引、Ent schema、订单快照版本和迁移测试。
2. **套餐配置**：完成 CRUD、目录导入导出、响应契约和校验。
3. **多实例领域**：完成实例创建、指定续费、并发上限、恢复和缓存失效。
4. **支付闭环**：完成订单槽位、快照、履约幂等和精确退款。
5. **前端管理与购买**：完成后台字段、份数展示、新购/续费交互和恢复状态。
6. **全量验收与审查**：执行迁移、后端、前端、浏览器、并发和回归验收。
7. **发布**：遵守 `docs/RELEASE_VERSION_POLICY.md`，同步最新稳定上游基线、选择整数 `qiu.N` 版本，发布并验证全部资产。

## 8. 验收标准

### 8.1 套餐配置

- [ ] 存量套餐升级后 `max_subscriptions_per_user=1`，原有购买和续费结果不变。
- [ ] 后台创建/编辑可保存 `1`、`2` 和大于 `2` 的合法整数并在重新打开后正确回显。
- [ ] `0`、负数、小数、指数、字符串、布尔值、`null` 和溢出输入返回明确 4xx。
- [ ] 目录导入、导出和模板保留该字段；旧目录兼容规则符合第 4.1 节。

### 8.2 多份购买

- [ ] 上限 `1` 时，同一用户不能创建第二份有效实例，现有入口继续续费原实例。
- [ ] 上限 `2` 时，连续购买两次产生两个不同订阅 ID，开始/到期时间和三类额度计数相互独立。
- [ ] 上限 `2` 时第三次新购在发起支付前被拒绝，且不创建支付订单、不扣款。
- [ ] 两个并发新购请求只有不超过剩余槽位的请求成功，不发生超卖。
- [ ] 未完成的新购订单占用槽位，取消/失败/过期后释放。
- [ ] 管理员降低上限不破坏既有权益；达到或超过新上限后不能再新购。

### 8.3 续费、履约和退款

- [ ] 两份同档订阅可分别续费，只有目标实例的 `expires_at` 和应增加的期限总额度发生变化。
- [ ] 套餐上限编辑、套餐下架或重复 webhook 不改变已创建订单快照的购买模式。
- [ ] 同一订单重复履约不会创建第三份，也不会重复延长。
- [ ] 新订单记录准确的 `fulfilled_subscription_id`。
- [ ] 退款只扣减或撤销该订单实际履约的实例，不影响同档另一实例。
- [ ] 旧订单履约与退款兼容测试继续通过。

### 8.4 计费

- [ ] 第一份额度可用时只消耗第一份。
- [ ] 第一份额度不足时使用第二份，不提前走钱包。
- [ ] 两份均不足时遵循 `subscription_first`、`wallet_first`、`subscription_only`、`wallet_only` 和套餐钱包兜底配置。
- [ ] 并发预留不会让任一实例的 reserved/usage 计数为负或超过事务约束。

### 8.5 前端与响应式

- [ ] 套餐卡正确显示 `已持有 X / N 份`、立即订阅、再订一份、续费和已达上限状态。
- [ ] “我的订阅”中两份 Pro 是两条可区分记录，续费分别指向正确实例。
- [ ] 微信 OAuth 恢复、二维码、跳转、轮询和支付结果页保持购买模式及目标实例。
- [ ] 1440px、约 900px、390px 下后台弹窗、套餐卡和订阅列表无横向溢出、遮挡或异常换行。
- [ ] 加载、空状态、错误、支付中、已满和长套餐名称状态正常。

### 8.6 工程与发布

- [ ] 新迁移在空库和升级库均可执行，重复运行安全；schema 对齐测试通过。
- [ ] 定向及全量 Go unit/integration tests 通过，无 race-sensitive 新失败。
- [ ] 前端 Vitest、`vue-tsc`、ESLint、生产构建通过。
- [ ] `git diff --check`、生成代码检查和最终 Code Review 通过。
- [ ] 发布版本符合整数 `qiu.N` 规则，分支、tag、`VERSION`、README 和镜像版本一致。
- [ ] GitHub Release、全部可下载产物、`checksums.txt`、GHCR 版本标签、GHCR `latest` 和 GitHub `releases/latest` 全部验证。

## 9. 非目标

- 不合并多份订阅的额度到单行。
- 不允许一次请求跨多份订阅拆分扣费。
- 不改账号调度优先度、上游账号订阅类型或 `account_groups.priority`。
- 不修改现有支付提供商协议和手续费计算。
- 不在本次引入自动续费或按数量一次性批量结账。
