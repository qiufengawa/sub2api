# R4 管理员订单与退款批次验收

## 范围

- `frontend/src/views/admin/orders/AdminOrdersView.vue`
- `frontend/src/views/admin/orders/__tests__/AdminOrdersView.spec.ts`
- `frontend/src/components/admin/payment/AdminRefundDialog.vue`
- `frontend/src/components/admin/payment/__tests__/orderCurrencyDisplay.spec.ts`

## 迁移内容

- 管理员订单页由旧 `TablePageLayout` 重写为 `AppPage`、`AppPageHeader` 和 `UiServerTableWorkspace`。
- 搜索、筛选、分页、刷新、详情和退款行操作统一使用 `@/components/ui` 公共控件。
- 订单详情改为 `UiDescriptionList`、`AppSection` 和 `UiTimeline`，保留订单事实、退款申请信息和审计日志。
- 退款弹窗改为 `UiDialog`、`UiDescriptionList`、`UiAlert`、`UiCheckbox`、`UiTextField`、`UiTextArea` 和 `UiButton`。
- 保留订单 API 参数、分页状态、退款 `require_force` 状态机、退款处理中查询、金额币种语义和退款申请预填逻辑。
- 删除本批次页面中的旧 `BaseDialog`、`TablePageLayout`、原生输入框、原生复选框、旧按钮、手绘 SVG 和局部颜色卡片。

## 行为验收

- 订单首次加载携带 `page=1`、`page_size=20` 和当前筛选参数。
- 搜索由 `UiSearchInput` 自带 debounce 触发，不再保留页面级重复 debounce。
- 修改分页大小只发起一次请求，并由页面统一重置到第一页。
- 详情弹窗保留订单号、金额、支付方式、状态、退款信息和审计日志。
- 退款金额继续使用 USD 记账额度；订单支付金额继续使用订单币种。
- `REFUND_REQUESTED` 继续预填申请金额和申请原因。
- 已退款金额只在 `PARTIALLY_REFUNDED` / `REFUNDED` 状态计入最大可退款额度。
- `require_force` 未确认时阻止提交；确认后 payload 仍为数值金额和完整退款字段。
- `UiDialog` 关闭标签使用当前语言的 `common.close`。

## 验证命令

```bash
cd /Users/qiu/Desktop/Sub2API/frontend
pnpm exec vitest run \
  src/views/admin/orders/__tests__/AdminOrdersView.spec.ts \
  src/views/admin/orders/__tests__/AdminPaymentPlansView.spec.ts \
  src/views/admin/orders/__tests__/PlanEditDialog.spec.ts \
  src/views/admin/orders/__tests__/PlanImportDialog.spec.ts \
  src/components/admin/payment/__tests__/orderCurrencyDisplay.spec.ts
pnpm exec vue-tsc --noEmit
pnpm exec eslint \
  src/views/admin/orders/AdminOrdersView.vue \
  src/views/admin/orders/__tests__/AdminOrdersView.spec.ts \
  src/components/admin/payment/AdminRefundDialog.vue \
  src/components/admin/payment/__tests__/orderCurrencyDisplay.spec.ts
git diff --check
```

结果：5 个测试文件、44 个测试通过；`vue-tsc`、定向 ESLint 和 `git diff --check` 通过。

## 未完成范围

- 管理员订阅页仍待下一批迁移。
- `AppLayout` 本身仍属于高影响布局壳，按 R2/R9 计划统一收口，不在本批次局部改写。
