# 工作区归属审计记录

## 审计目的

在 R0-R9 前端重构完成后，发布前确认只提交本目标拥有的文件，不覆盖其他
线程的后端、部署、版本或临时产物。该记录不代表当前可以发布。

## 允许提交范围

- `frontend/`
- `UI.MD`
- `docs/FRONTEND_DESIGN_GUIDELINES.md`
- `docs/frontend-rebuild/`
- `docs/ui-showcase/`
- `frontend/public/animations/home-earth/`
- `plan.md`
- `docs/FRONTEND_REFACTOR_GOAL_PROMPT.md`

## 当前明确排除

- `backend/`：当前存在设置处理器、设置服务和嵌入资源的未提交修改，归属
  其他线程，不能在前端目标中提交、回退或覆盖。
- `.gitignore`、`AGENTS.md`：不属于本次前端实现范围。
- `data/`、`docs/reference/` 以及 `frontend/public/animations/` 中除
  `home-earth/` 外的内容：属于临时数据、参考抓取或其他线程资产，不纳入本目标。

`docs/ui-showcase/` 是共享组件契约测试的直接输入；
`frontend/public/animations/home-earth/` 是 `HomeEarthAnimation` 与首页模型卡的运行时
资源。二者与本次前端实现、测试和计划记录构成同一提交单元，不再作为待确认的外围资产。

## 当前验证快照

- 工作树状态数量：以最终提交前重新执行的
  `git status --porcelain=v1` 为准；当前仍存在跨线程修改，未执行整体清理。
- 前端静态检查：旧 `.btn` class 为 0；通用界面内联 SVG 仅保留品牌资产、
  数据可视化和 Lucide 兼容资产，理由记录在 `exceptions.md`。
- 自动化：早期共享工作树快照为 353 files / 2296 tests、typecheck、lint、生产构建和
  `git diff --check` 已在当前共享工作树通过；隔离后必须重新执行。

### 2026-08-19 历史共享快照

- QR 终态回归与 quota 动效收口的前一共享快照为 353 files / 2298 tests；支付生命周期
  回归后已更新为 353/2303（见下方最新记录），均不能替代隔离树复验。

### 2026-08-19 支付生命周期中间共享快照

- QR/PaymentStatusPanel 卸载生命周期回归后的中间共享快照为 353 files / 2300 tests；
  typecheck、lint、build（3102 modules，24.89s）和 diff check 通过。
- 该共享树数字仍需在排除其他线程文件的隔离工作树中复验；受保护浏览器、Code Review
  与 Release/线上更新仍 pending。

### 2026-08-19 Stripe 弹窗多币种中间共享快照

- Stripe 弹窗多币种回归后的中间共享树为 353 files / 2301 tests；typecheck、lint、build
  （3102 modules，25.74s）和 diff check 通过。
- 该数字仍需在排除其他线程文件的隔离工作树中复验，真实 Stripe sandbox、浏览器矩阵、
  Code Review 与 Release/线上更新仍 pending。

### 2026-08-19 共享 disclosure 语义中间共享快照

- `UiAccordion`/`UiSideNavGroup` 契约补强后，最新共享树为 354 files / 2305 tests；typecheck、
  lint、build（3102 modules，25.00s）和 diff check 通过。
- 仍需在排除其他线程文件的隔离工作树中复验，并完成授权浏览器矩阵、Code Review 与发布闭环。

### 2026-08-19 R5/R6 最新共享快照

- V2 Monitor、Available Channels 与管理员订阅补强后，最新共享树为 354 files / 2307 tests；
  typecheck、lint、build（3102 modules，24.49s）和 diff check 通过。
- 该共享树仍有其他线程文件，必须在 ownership 隔离后复验，再完成授权浏览器与发布闭环。

### 2026-08-19 R5 Batch Image 共享快照

- Batch Image API-key 请求单飞与卸载取消回归加入后，共享树全量为 354 files / 2309 tests；typecheck、lint、build 和 diff-check 通过。
- 这不是隔离工作树结果；仍需按本文件的 ownership 顺序隔离并重跑全部自动化，再取得授权浏览器与发布证据。

### 2026-08-19 R6 subscription failure recovery 共享快照

- 管理订阅失败/重试状态与旧行保留回归加入后，共享树全量为 354 files / 2311 tests；UI consumer inventory 为 1869 runtime references / 276 production consumer files。
- typecheck、lint、build 和 diff-check 通过；这仍不是隔离工作树结果，必须按 ownership 顺序复验后再进行授权浏览器与发布步骤。

### 2026-08-19 R8 announcement read recovery 共享快照

- 公告已读失败恢复测试加入后，共享树全量为 355 files / 2314 tests；typecheck、lint、build 和 diff-check 通过。

## 2026-08-19 当前共享树证据

- 当前共享工作树早期全量门禁为 355 files / 2322 tests；typecheck、lint、build（3102 modules）与 `git diff --check` 通过，当时 UI consumer inventory 为 114 contracts / 276 production consumer files / 1877 runtime references。
- 这些结果不能证明文件归属已隔离。后端、前端和文档仍混有其他线程修改，发布前必须在明确 ownership 的隔离树重新执行全部门禁并记录提交边界。
- 这仍不是隔离工作树结果；必须保持其他线程文件不被覆盖，按 ownership 顺序隔离复验后再取得授权浏览器与发布证据。

### 2026-08-19 mutation 收口后共享树证据

- 当前共享树全量更新为 355 files / 2355 tests；lint、build（3102 modules，含 TypeScript project check）和 diff-check 通过，consumer inventory 保持 114 contracts / 276 files / 1880 references。
- 该数字仅更新自动化现状，不改变本文件的 ownership 结论：其他线程文件仍未隔离，发布门禁仍未满足。

### 2026-08-19 R1/R9 静态残留复核

- `frontendRefactorStaticAudit.spec.ts` 已将生产 native controls 与 `frontend/config/native-control-exceptions.json` 做 exact equality；每个 manifest entry 均要求在 `exceptions.md` 有正式理由、验证方式和移除条件。Settings 不在 manifest 中，已无未登记 native control。
- 旧 `.btn`、generic card/badge/field helper、公共 UI 子路径导入、未登记 inline SVG、blanket transition、未登记 layout-property transition 和共享 progress width motion 均由同一静态 suite 检查并包含在 355 files / 2355 tests 全量通过结果中。
- 因此 R1/R9 当前剩余是正式例外的真实浏览器/无障碍复核，不再把已登记例外误记为静态迁移未完成。

### 2026-08-19 最终 ownership 隔离复验

- 隔离 worktree：`/tmp/Sub2API-frontend-ownership-final-20260819`，基线提交
  `5c5eee3c256327523636a69e8361e90c13aea8b4`。
- 隔离内容只来自本文件“允许提交范围”；`docs/ui-showcase/` 与
  `frontend/public/animations/home-earth/` 按上文归属结论纳入，未带入共享树已有的后端、
  部署、版本、`data/` 或 `docs/reference/` 修改。
- `frontendRefactorStaticAudit.spec.ts` 的 Git 元数据断言改为接受主工作树目录与 linked
  worktree 文件两种合法 `.git` 入口；ownership、exception 与计划文档存在性断言保持不变。
- `pnpm run test:run`：355 files / 2357 tests，全部通过。
- `pnpm run typecheck`：通过。
- `pnpm run lint:check`：通过。
- `pnpm run build`：通过，3102 modules transformed；保留既有 Browserslist 数据年龄、
  Lottie `eval`、混合静态/动态 import 和大 chunk 警告。
- `git diff --check`：通过。
- 该结果完成 ownership 隔离自动化复验，但不替代受保护用户/管理员、provider sandbox、
  三视口、主题、reduced-motion、键盘、screen-reader 与 console 浏览器证据，也不解除最终
  Code Review 和 Release/线上更新门禁。

### 2026-08-19 最终 Code Review 修复复验

- WeChat 恢复二维码兜底透传 `wechat_resume_token`，避免余额恢复订单退化为零金额请求。
- Settings 破坏性确认仅在 action 返回成功后关闭；失败保留确认上下文以便重试。
- Usage Cleanup 在创建/取消请求期间保留确认框、锁定主对话框关闭入口，失败后允许原地重试。
- 新增失败恢复与 token 透传回归；隔离树最终套件为 355 files / 2357 tests，全部通过。

### 2026-08-20 current-tree ownership recheck

- Fresh detached worktree: `/tmp/Sub2API-frontend-ownership-current-20260820`, based on `5c5eee3c2`.
- Only the allowed frontend/UI/documentation paths were mirrored, including deletion state for removed common wrappers and the `docs/ui-showcase` test fixtures. The resulting 346 dirty paths contain no `backend/`, `deploy/`, `VERSION`, or release metadata changes.
- Isolated gates passed: `pnpm run test:run` 356 files / 2403 tests; `pnpm run test:audit` 13 tests; `pnpm run typecheck`; `pnpm run lint:check`; production build 3103 modules; `git diff --check`.
- The candidate also closes the ProxiesView single/batch destructive-delete single-flight and pending-confirmation gap; focused ProxiesView coverage is 7 tests and passes in both trees.
- The candidate also closes the AdminOrdersView/AdminRefundDialog stale refund target and form reset race; the focused payment/order suites cover 18 tests in both trees.
- The candidate also closes KeysView quota/rate-limit reset pending and retry-context gaps; the focused Keys suite covers 30 tests in both trees.
- The candidate also closes ChannelsView channel-delete pending and retry-context gaps; the focused Channels suite covers 3 tests in both trees.
- The candidate also closes GroupsView group-delete pending and retry-context gaps; the focused Groups suite covers 5 tests in both trees.
- The candidate also closes GroupsView composite-route stale-load and delete-target races; the focused Groups suite covers 7 tests in both trees.
- The candidate also closes UserOrdersView cross-order refund-context races; the focused user orders suite covers 7 tests in both trees.
- The candidate also closes BackupView stale backup-list response races; the focused Backup suite covers 10 tests in both trees.
- The candidate also closes AnnouncementsView stale save-session cleanup races; the focused announcements suite covers 10 tests in both trees.
- The candidate also closes admin subscription quota-reset pending and retargeting gaps; the focused subscriptions suite covers 12 tests in both trees.
- This is stronger ownership and automation evidence than the shared-tree snapshot, but it still does not close protected browser, screen-reader, provider sandbox, destructive mutation, backend/remote CI, release, GHCR, or updater gates.

### 2026-08-20 Mutation follow-up recheck

- The same isolated candidate includes the AuditLog TOTP-gate pending state, Accounts export confirmation pending binding, and Playground key/model AbortSignal cancellation changes.
- Focused regression suites and the full isolated gates pass: 356 files / 2417 tests, 13 static-audit tests, typecheck, lint, 3103-module build, and diff-check.
- No backend, deploy, VERSION, tag, release metadata, or remote state was changed by this batch.
- The final Accounts follow-up remains frontend-only and was rechecked in both trees with 27 focused tests and clean diff checks.

### 2026-08-20 Async confirmation follow-up

- Ownership-isolated source now includes the three async delete pending guards and the Proxies export pending binding; no backend, deploy, VERSION, tag, release metadata, or remote state changed.
- The 4-test deferred suite passes in both trees; isolated typecheck and diff-check pass. R5 evidence corrections are documentation-only and remain within the allowed frontend-rebuild scope.

### 2026-08-20 R9 native confirmation cleanup

- Ownership-isolated source now has zero non-test native `confirm()` calls outside `UiConfirmDialog`; Accounts bulk confirmation and account error-code warning changes are mirrored.
- The 119-test focused suite and typecheck pass in both trees; diff checks are clean. No backend, deploy, VERSION, tag, release metadata, or remote state changed.

### 2026-08-20 R9 native confirm isolated gate

- The candidate remains within the allowed frontend/UI/documentation scope and passes 357 test files / 2423 tests, static audit 13 tests, typecheck, lint, production build, and diff-check.
- No backend, deploy, VERSION, tag, release metadata, or remote state was changed.

### 2026-08-20 Retry-context follow-up

- Prompt Audit and Proxies retry-context changes are mirrored in the isolated frontend candidate; 20 focused tests pass in both trees.
- No backend, deploy, VERSION, tag, release metadata, or remote state changed.

### 2026-08-20 Prompt Audit/Proxies isolated full gate

- The isolated frontend candidate remains scope-clean and passes 357 test files / 2425 tests, static audit, typecheck, lint, build, and diff-check.
- No backend, deploy, VERSION, tag, release metadata, or remote state changed.
- Updater parser compatibility was inspected read-only in backend service/tests; this evidence does not expand ownership scope or prove an online old-version update flow.

### 2026-08-20 Mixed-channel confirmation follow-up

- The mixed-channel pending/duplicate-confirmation changes are mirrored in the ownership-isolated frontend candidate; the focused 114-test account suite and typecheck pass in both trees.

### 2026-08-20 Final local accessibility follow-up

- The ownership-isolated candidate includes the `UiSlider` accessible-name contract, `UiFileUpload` progress semantics, and `UiDateRangePicker` outside-click focus restoration.
- Fresh isolated full run: 358 test files / 2428 tests passed; focused slider/upload/date-range regressions pass, and no backend/deploy/VERSION/release paths are present in the candidate diff.
- This closes the local frontend automation increment only. Protected browser/screen-reader/provider/destructive evidence, remote CI/Security, Release/GHCR/latest, and old-version updater evidence remain open.
- No backend, deploy, VERSION, tag, release metadata, or remote state changed.

### 2026-08-20 Mixed-channel isolated gate

- The candidate remains within frontend/UI/documentation scope and passes 357 test files / 2423 tests, static audit, typecheck, lint, build, ownership scope, and diff-check.
- Remote CI/Security and release metadata were only read; no backend, VERSION, tag, release, or GHCR state changed.

### 2026-08-20 Browser service recheck

- Trusted browser connection was unavailable in the current runtime; no local service or unrelated port was accessed. The missing browser evidence remains explicitly open.

### 2026-08-20 Release script static gate

- Actionlint and shell syntax checks were read-only; the installer behavior test was not run because the host Bash is 3.2.57 while the script requires Bash 4+.
- No backend, deploy, VERSION, tag, release metadata, or remote state was modified.

### 2026-08-20 Candidate release static review

- Candidate tag and GoReleaser configuration were inspected read-only; no version, tag, artifact, GHCR, or remote state was changed.

## 发布前操作顺序

1. 逐路径确认前端、UI 文档和 `docs/frontend-rebuild/` 的所有改动均属于本目标。
2. 将后端及其他线程文件保持在工作树之外，不使用 reset/checkout 覆盖。
3. 在隔离后的临时工作树重跑自动化、静态扫描和 Code Review。
4. 获得授权的本地预览或用户提供链接后，完成三视口/light-dark/reduced-motion/
   keyboard 浏览器证据；不探测无关端口。
5. 只有浏览器门禁、Release 产物、checksum、GHCR/latest、旧版更新发现和线上
   更新验证全部记录后，才允许创建提交、发布并结束目标。
