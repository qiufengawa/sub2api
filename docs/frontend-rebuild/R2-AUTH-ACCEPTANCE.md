# R2 认证、回调与初始化验收记录

日期：2026-08-17

## 完成范围

- 登录、注册、邮箱验证、找回密码、重置密码和全部 OAuth 回调统一进入持久 `AuthShellView`。
- 12 条认证路由记录及 `/auth/oauth/callback` alias 共 13 个公开路径保留原 URL、name、meta 与 backend-mode 语义。
- `AuthLayout` 在认证子路由切换期间保持挂载，只替换表单内容；OAuth callback 保留 560px 内容宽度，其余流程使用 460px。
- 认证表单统一复用 `AuthFormPanel`、`AuthTextField`、`AuthFooterPrompt` 和 `auth-form.css`。
- `AuthTextField` 统一密码显隐、帮助提示、验证码输入、等宽值、错误状态与 Enter 提交事件。
- OAuth provider、资料采用、邀请、创建账号、绑定账号、TOTP 和邮箱补全状态继续保留原业务流程。
- TOTP 登录和 step-up 共用 `auth-totp.css`，不再维护两套重复输入样式。
- OAuth 资料采用区移除双层 surface，条款提示状态图标移除无意义边框容器。
- 登录响应和当前用户响应增加结构校验，避免读取缺失 `run_mode` 时发生运行时异常。
- 初始化向导继续使用共享 `UiSteps`、表单、反馈和 review 组件；本轮没有修改其业务逻辑。

## 行为保护

- API URL、请求字段、OAuth token 持久化、redirect/query、pending session 和 localStorage key 未改变。
- 登录条款的 `accept/reject/open` 事件、文档路由和 revision 协议未改变。
- TOTP 登录使用原临时 token 调用 `login2FA`；失败保留弹窗并允许重试，取消清理临时状态。
- Step-up 六位码自动提交；验证中忽略关闭，失败恢复可重试状态。
- 重置密码继续提交 `email`、`token` 和 `new_password`，并区分无效链接、过期 token 和成功状态。
- Backend mode 允许 `/auth/oauth/callback`，与其 `/auth/callback` alias 语义一致。

## 自动化验证

```text
认证定向：25 个测试文件，213 项通过
全量前端：332 个测试文件，2192 项通过
TypeScript：pnpm run typecheck 通过
ESLint：pnpm run lint:check 通过
生产构建：3109 modules transformed，24.23s 完成
差异格式：git diff --check 通过
```

新增直接覆盖：

- 真实嵌套路由下 login -> register -> OAuth callback 切换保持同一 `AuthLayout` 和 route stage。
- 登录收到 TOTP challenge 后的临时 token、成功、失败、重试和取消。
- Step-up 自动提交、成功、失败、关闭与验证中防取消。
- 重置密码的缺参数、有效提交、过期 token、成功状态和按需密码规则帮助。
- 认证字段的 inputmode、maxlength、monospace、错误关联与 Enter 事件透传。

### 2026-08-19 DingTalk 回调补充

- 新增 `DingTalkCallbackView.spec.ts`，覆盖 pending exchange 返回补邮箱状态时拒绝 `//evil.example` 外部 redirect，并只导航到编码后的 `/dashboard`。
- 同一夹具覆盖 legacy fragment access/refresh token 兼容路径：不调用 pending exchange，refresh token 与过期时间继续持久化，登录成功后返回受信任站内路径。
- 新增 `DingTalkEmailCompletionView.spec.ts`，实际填写邮箱/密码并提交 `/auth/oauth/pending/create-account`，验证 access token、refresh token/expiry、成功提示及 sanitized redirect 闭环。
- DingTalk 两个组件测试与 auth-shell route 契约共 3 files / 17 tests 通过；typecheck、定向 ESLint 与 diff check 通过。

全量测试输出中的网络失败、i18n compiler 和未解析 `router-link` 信息来自既有失败分支测试或测试桩；命令退出码为 0。构建仍报告既有动态/静态 import 与大 chunk 提示，本批次没有新增第二图标库或生产构建错误。

## 浏览器验证

本地地址：`http://127.0.0.1:5174`

| 页面 / 状态 | 视口 | 结果 |
| --- | --- | --- |
| `/login` light | 1440 x 900 | `scrollWidth=1440`，无横向溢出，输入和主按钮均为 32px |
| `/register` live disabled state | 900 x 900 | `scrollWidth=900`，关闭注册提示、标题和返回登录操作稳定 |
| `/login` light | 390 x 844 | `scrollWidth=390`，表单宽 342px，无遮挡或横向溢出 |
| `/login` dark | 390 x 844 | dark token 正确，背景 `rgb(10,10,10)`，无横向溢出 |
| `/forgot-password` | 390 x 844 | 输入和按钮均为 32px，无横向溢出 |
| `/reset-password` 无效链接 | 390 x 844 | 正确显示警告与重新申请入口，无横向溢出 |

当前本地后端关闭了公开注册，因此浏览器展示的是正式 disabled state；完整注册字段与登录/注册共享壳切换由 `RegisterView.spec.ts` 和真实嵌套路由测试覆盖，没有修改后端设置或数据库来制造验收状态。

键盘焦点顺序：品牌链接 -> 语言 -> 主题 -> 返回首页 -> 邮箱 -> 密码 -> 密码显隐 -> 登录。焦点顺序与可访问名称正确。

减少动效模式：`matchMedia('(prefers-reduced-motion: reduce)') = true`，认证 route transition 计算值为 `0s`。

浏览器控制台：本轮认证页面没有 error 或 warning。

## 截图索引

- `screenshots/r2-auth/login-1440.png`
- `screenshots/r2-auth/register-900.png`
- `screenshots/r2-auth/login-390.png`
- `screenshots/r2-auth/login-dark-390.png`
- `screenshots/r2-auth/forgot-password-390.png`
- `screenshots/r2-auth/reset-invalid-390.png`

## 后续边界

- R4 交易流程仍需在认证共享壳依赖落地后完成原子验收。
- 本记录只证明 R2 认证、回调与初始化批次，不代表 61 个页面的全站重构完成。

## 2026-08-19 TOTP 登录弹窗契约补充

- `TotpLoginModal.spec.ts` 增加 4 tests，覆盖六位数字自动提交、密码管理器 `one-time-code` 填充、粘贴清洗与焦点、空格退格回退、验证中禁用，以及错误后清空并聚焦首格。
- 本批只补 jsdom 行为证据，不改变 TOTP API、弹窗关闭策略或认证路由；真实认证壳三视口、主题、reduced-motion、keyboard 与 console 仍按 R2/R62 浏览器门禁执行。
