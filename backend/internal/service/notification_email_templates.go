package service

import "github.com/Wei-Shaw/sub2api/internal/emailhtml"

var notificationEmailOfficialTemplates = buildNotificationEmailOfficialTemplates()

func buildNotificationEmailOfficialTemplates() map[string]map[string]notificationEmailOfficialTemplate {
	templates := make(map[string]map[string]notificationEmailOfficialTemplate, len(notificationEmailEventOrder))
	for _, event := range notificationEmailEventOrder {
		templates[event] = map[string]notificationEmailOfficialTemplate{
			notificationEmailDefaultLocale: notificationEmailOfficialTemplateFor(event, notificationEmailDefaultLocale),
			notificationEmailLocaleChinese: notificationEmailOfficialTemplateFor(event, notificationEmailLocaleChinese),
		}
	}
	return templates
}

func notificationEmailOfficialTemplateFor(event, locale string) notificationEmailOfficialTemplate {
	switch event {
	case NotificationEmailEventAuthVerifyCode:
		return officialAuthVerifyCodeTemplate(locale)
	case NotificationEmailEventAuthPasswordReset:
		return officialPasswordResetTemplate(locale)
	case NotificationEmailEventNotificationEmailVerifyCode:
		return officialNotificationEmailVerifyTemplate(locale)
	case NotificationEmailEventSubscriptionPurchaseSuccess:
		return officialSubscriptionPurchaseTemplate(locale)
	case NotificationEmailEventSubscriptionExpiryReminder:
		return officialSubscriptionExpiryTemplate(locale)
	case NotificationEmailEventBalanceLow:
		return officialBalanceLowTemplate(locale)
	case NotificationEmailEventBalanceRechargeSuccess:
		return officialBalanceRechargeTemplate(locale)
	case NotificationEmailEventAccountQuotaAlert:
		return officialAccountQuotaAlertTemplate(locale)
	case NotificationEmailEventContentModerationViolation:
		return officialModerationViolationTemplate(locale)
	case NotificationEmailEventContentModerationDisabled:
		return officialModerationDisabledTemplate(locale)
	case NotificationEmailEventCyberPolicyNotice:
		return officialCyberPolicyTemplate(locale)
	case NotificationEmailEventOpsAlert:
		return officialOpsAlertTemplate(locale)
	case NotificationEmailEventOpsScheduledReport:
		return officialOpsReportTemplate(locale)
	default:
		return notificationEmailOfficialTemplate{}
	}
}

func officialAuthVerifyCodeTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。请使用以下验证码完成本次身份验证。") +
			emailhtml.CodePanel("本次验证码", "{{verification_code}}", "{{expires_in_minutes}} 分钟内有效") +
			emailhtml.Advisory("如果不是您本人发起的操作，请忽略此邮件，不要向任何人提供验证码。", emailhtml.ToneNeutral)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 邮箱验证码",
			HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "账户安全", "邮箱验证码", "验证码将在 {{expires_in_minutes}} 分钟后失效。", body, emailhtml.IllustrationVerification),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Use the code below to complete this identity verification.") +
		emailhtml.CodePanel("Verification code", "{{verification_code}}", "Valid for {{expires_in_minutes}} minutes") +
		emailhtml.Advisory("If you did not start this request, ignore this email and do not share the code with anyone.", emailhtml.ToneNeutral)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Email verification code",
		HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "Account security", "Email verification code", "Your verification code expires in {{expires_in_minutes}} minutes.", body, emailhtml.IllustrationVerification),
	}
}

func officialPasswordResetTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。我们收到了您的密码重置请求，请通过下方按钮设置新密码。") +
			emailhtml.Action("{{reset_url}}", "重置密码", emailhtml.TonePrimary) +
			emailhtml.FactList(emailhtml.Fact{Label: "链接有效期", Value: "{{expires_in_minutes}} 分钟"}) +
			emailhtml.ReferenceLink("{{reset_url}}", "按钮无法打开时，请复制此完整链接") +
			emailhtml.Advisory("如果不是您本人发起的请求，请忽略此邮件，您的密码不会被修改。", emailhtml.ToneWarning)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 密码重置请求",
			HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "账户安全", "重置账户密码", "密码重置链接将在 {{expires_in_minutes}} 分钟后失效。", body, emailhtml.IllustrationPasswordReset),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. We received a request to reset your password. Use the button below to choose a new one.") +
		emailhtml.Action("{{reset_url}}", "Reset password", emailhtml.TonePrimary) +
		emailhtml.FactList(emailhtml.Fact{Label: "Link validity", Value: "{{expires_in_minutes}} minutes"}) +
		emailhtml.ReferenceLink("{{reset_url}}", "If the button does not open, copy this complete link") +
		emailhtml.Advisory("If you did not request a password reset, ignore this email. Your password will remain unchanged.", emailhtml.ToneWarning)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Password reset request",
		HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "Account security", "Reset your password", "The password reset link expires in {{expires_in_minutes}} minutes.", body, emailhtml.IllustrationPasswordReset),
	}
}

func officialNotificationEmailVerifyTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。您正在添加此地址作为额外通知邮箱。") +
			emailhtml.CodePanel("通知邮箱验证码", "{{verification_code}}", "{{expires_in_minutes}} 分钟内有效") +
			emailhtml.Advisory("完成验证后，此邮箱可以接收账户通知。如果不是您本人操作，请忽略此邮件。", emailhtml.ToneNeutral)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 通知邮箱验证码",
			HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "账户通知", "验证通知邮箱", "完成验证后，此邮箱可接收账户通知。", body, emailhtml.IllustrationNotificationEmail),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. You are adding this address as an extra notification email.") +
		emailhtml.CodePanel("Notification email code", "{{verification_code}}", "Valid for {{expires_in_minutes}} minutes") +
		emailhtml.Advisory("After verification, this address can receive account notifications. If you did not start this request, ignore this email.", emailhtml.ToneNeutral)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Notification email verification code",
		HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "Account notifications", "Verify notification email", "After verification, this address can receive account notifications.", body, emailhtml.IllustrationNotificationEmail),
	}
}

func officialSubscriptionPurchaseTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。您的订阅订单已经完成，套餐现已生效。") +
			emailhtml.StatusBand("订阅状态", "已成功开通", "可以按照套餐规则开始使用", emailhtml.ToneSuccess) +
			emailhtml.Statement("订阅套餐", "{{subscription_group}}", "", emailhtml.ToneSuccess) +
			emailhtml.FactList(
				emailhtml.Fact{Label: "有效期", Value: "{{subscription_days}} 天"},
				emailhtml.Fact{Label: "到期时间", Value: "{{expiry_time}}"},
				emailhtml.Fact{Label: "订单号", Value: "{{order_id}}"},
			) +
			emailhtml.Advisory("创建或编辑 API 密钥时，请选择此订阅允许的分组，符合分组范围的请求才会使用订阅额度。", emailhtml.TonePrimary)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 订阅购买成功",
			HTML:    officialEmailDocument(locale, emailhtml.ToneSuccess, "订阅", "订阅已成功开通", "{{subscription_group}} 已生效，可按套餐规则使用。", body, emailhtml.IllustrationSubscriptionActive),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Your subscription order is complete and the plan is now active.") +
		emailhtml.StatusBand("Subscription status", "Activated", "Ready to use under the plan rules", emailhtml.ToneSuccess) +
		emailhtml.Statement("Subscription plan", "{{subscription_group}}", "", emailhtml.ToneSuccess) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Validity", Value: "{{subscription_days}} days"},
			emailhtml.Fact{Label: "Expiry time", Value: "{{expiry_time}}"},
			emailhtml.Fact{Label: "Order ID", Value: "{{order_id}}"},
		) +
		emailhtml.Advisory("When creating or editing an API key, select a group allowed by this subscription. Only requests within that group scope use subscription quota.", emailhtml.TonePrimary)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Subscription purchase successful",
		HTML:    officialEmailDocument(locale, emailhtml.ToneSuccess, "Subscription", "Subscription activated", "{{subscription_group}} is active and ready to use under its plan rules.", body, emailhtml.IllustrationSubscriptionActive),
	}
}

func officialSubscriptionExpiryTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。请根据需要提前安排续费，避免订阅额度中断。") +
			emailhtml.AmountPanel("距离到期", "{{days_remaining}} 天", "到期时间 {{expiry_time}}", emailhtml.ToneWarning) +
			emailhtml.FactList(emailhtml.Fact{Label: "订阅套餐", Value: "{{subscription_group}}"}) +
			emailhtml.Advisory("订阅到期后，套餐额度和对应分组的订阅计费将停止生效。", emailhtml.ToneWarning) +
			emailhtml.MinorLink("{{unsubscribe_url}}", "不再接收此类订阅到期提醒")
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 订阅将在 {{days_remaining}} 天后到期",
			HTML:    officialEmailDocument(locale, emailhtml.ToneWarning, "订阅", "订阅即将到期", "{{subscription_group}} 将在 {{days_remaining}} 天后到期。", body, emailhtml.IllustrationSubscriptionExpiry),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Renew in advance if needed to avoid an interruption to subscription quota.") +
		emailhtml.AmountPanel("Time remaining", "{{days_remaining}} day(s)", "Expires at {{expiry_time}}", emailhtml.ToneWarning) +
		emailhtml.FactList(emailhtml.Fact{Label: "Subscription plan", Value: "{{subscription_group}}"}) +
		emailhtml.Advisory("After expiry, plan quota and subscription billing for its covered groups stop applying.", emailhtml.ToneWarning) +
		emailhtml.MinorLink("{{unsubscribe_url}}", "Unsubscribe from optional subscription reminders")
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Subscription expires in {{days_remaining}} day(s)",
		HTML:    officialEmailDocument(locale, emailhtml.ToneWarning, "Subscription", "Subscription expiring soon", "{{subscription_group}} expires in {{days_remaining}} day(s).", body, emailhtml.IllustrationSubscriptionExpiry),
	}
}

func officialBalanceLowTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。您的账户余额已触发低余额提醒。") +
			emailhtml.AmountPanel("当前余额", "${{current_balance}}", "提醒阈值 ${{threshold}}", emailhtml.ToneWarning) +
			emailhtml.Action("{{recharge_url}}", "立即充值", emailhtml.TonePrimary) +
			emailhtml.Advisory("请及时检查余额，避免影响按余额计费的请求。", emailhtml.ToneWarning) +
			emailhtml.MinorLink("{{unsubscribe_url}}", "不再接收此类余额提醒")
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 余额不足提醒",
			HTML:    officialEmailDocument(locale, emailhtml.ToneWarning, "账户余额", "账户余额低于提醒阈值", "请及时检查余额，避免影响按余额计费的请求。", body, emailhtml.IllustrationBalanceLow),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Your account has triggered its low-balance alert.") +
		emailhtml.AmountPanel("Current balance", "${{current_balance}}", "Alert threshold ${{threshold}}", emailhtml.ToneWarning) +
		emailhtml.Action("{{recharge_url}}", "Recharge now", emailhtml.TonePrimary) +
		emailhtml.Advisory("Review your balance to avoid interruptions to balance-billed requests.", emailhtml.ToneWarning) +
		emailhtml.MinorLink("{{unsubscribe_url}}", "Unsubscribe from optional balance alerts")
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Low balance alert",
		HTML:    officialEmailDocument(locale, emailhtml.ToneWarning, "Account balance", "Balance below alert threshold", "Review your balance to avoid interruptions to balance-billed requests.", body, emailhtml.IllustrationBalanceLow),
	}
}

func officialBalanceRechargeTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。您的充值订单已处理完成。") +
			emailhtml.StatusBand("处理结果", "充值已到账", "充值金额已计入账户余额", emailhtml.ToneSuccess) +
			emailhtml.AmountPanel("本次充值", "${{recharge_amount}}", "", emailhtml.ToneSuccess) +
			emailhtml.FactList(
				emailhtml.Fact{Label: "当前余额", Value: "${{current_balance}}"},
				emailhtml.Fact{Label: "订单号", Value: "{{order_id}}"},
			) +
			emailhtml.Advisory("如账户余额未及时更新，请稍后刷新；请勿对同一订单重复付款。", emailhtml.ToneNeutral)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 余额充值成功",
			HTML:    officialEmailDocument(locale, emailhtml.ToneSuccess, "账户余额", "余额充值成功", "充值金额已计入您的账户余额。", body, emailhtml.IllustrationRechargeSuccess),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Your recharge order has been completed.") +
		emailhtml.StatusBand("Result", "Recharge credited", "The amount has been added to your account balance", emailhtml.ToneSuccess) +
		emailhtml.AmountPanel("Recharge amount", "${{recharge_amount}}", "", emailhtml.ToneSuccess) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Current balance", Value: "${{current_balance}}"},
			emailhtml.Fact{Label: "Order ID", Value: "{{order_id}}"},
		) +
		emailhtml.Advisory("If the balance has not updated yet, refresh later. Do not pay the same order twice.", emailhtml.ToneNeutral)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Balance recharge successful",
		HTML:    officialEmailDocument(locale, emailhtml.ToneSuccess, "Account balance", "Recharge successful", "The recharge amount has been added to your account balance.", body, emailhtml.IllustrationRechargeSuccess),
	}
}

func officialAccountQuotaAlertTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.StatusBand("告警状态", "需要检查上游容量", "{{account_name}} 已触发配置的额度阈值", emailhtml.ToneDanger) +
			emailhtml.StatRow(
				emailhtml.Stat{Label: "剩余额度", Value: "{{quota_remaining}}", Tone: emailhtml.ToneDanger},
				emailhtml.Stat{Label: "已用额度", Value: "{{quota_used}}", Tone: emailhtml.ToneWarning},
				emailhtml.Stat{Label: "额度上限", Value: "{{quota_limit}}", Tone: emailhtml.ToneNeutral},
				emailhtml.Stat{Label: "告警阈值", Value: "{{quota_threshold}}", Tone: emailhtml.ToneDanger},
			) +
			emailhtml.Section("账号信息") +
			emailhtml.FactList(
				emailhtml.Fact{Label: "账号 ID", Value: "{{account_id}}"},
				emailhtml.Fact{Label: "账号名称", Value: "{{account_name}}"},
				emailhtml.Fact{Label: "平台", Value: "{{platform}}"},
				emailhtml.Fact{Label: "额度维度", Value: "{{quota_dimension}}"},
			) +
			emailhtml.Advisory("请及时检查上游账号容量和调度状态。", emailhtml.ToneDanger)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 账号限额告警 - {{account_name}}",
			HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "系统监控", "上游账号额度告警", "{{account_name}} 已触发配置的额度阈值。", body, emailhtml.IllustrationQuotaCapacity),
		}
	}
	body := emailhtml.StatusBand("Alert status", "Upstream capacity needs review", "{{account_name}} crossed its configured quota threshold", emailhtml.ToneDanger) +
		emailhtml.StatRow(
			emailhtml.Stat{Label: "Quota remaining", Value: "{{quota_remaining}}", Tone: emailhtml.ToneDanger},
			emailhtml.Stat{Label: "Quota used", Value: "{{quota_used}}", Tone: emailhtml.ToneWarning},
			emailhtml.Stat{Label: "Quota limit", Value: "{{quota_limit}}", Tone: emailhtml.ToneNeutral},
			emailhtml.Stat{Label: "Alert threshold", Value: "{{quota_threshold}}", Tone: emailhtml.ToneDanger},
		) +
		emailhtml.Section("Account information") +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Account ID", Value: "{{account_id}}"},
			emailhtml.Fact{Label: "Account name", Value: "{{account_name}}"},
			emailhtml.Fact{Label: "Platform", Value: "{{platform}}"},
			emailhtml.Fact{Label: "Quota dimension", Value: "{{quota_dimension}}"},
		) +
		emailhtml.Advisory("Review the upstream account capacity and scheduling status promptly.", emailhtml.ToneDanger)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Account quota alert - {{account_name}}",
		HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "System monitoring", "Upstream account quota alert", "{{account_name}} crossed its configured quota threshold.", body, emailhtml.IllustrationQuotaCapacity),
	}
}

func officialModerationViolationTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。您的 API 请求触发了平台内容审核与风险控制策略。") +
			emailhtml.StatusBand("处理结果", "请求已被记录", "请检查并调整请求内容", emailhtml.ToneDanger) +
			emailhtml.StatRow(
				emailhtml.Stat{Label: "累计触发次数", Value: "{{violation_count}}", Tone: emailhtml.ToneDanger},
				emailhtml.Stat{Label: "自动禁用阈值", Value: "{{ban_threshold}}", Tone: emailhtml.ToneWarning},
			) +
			emailhtml.FactList(
				emailhtml.Fact{Label: "触发时间", Value: "{{triggered_at}}"},
				emailhtml.Fact{Label: "所属分组", Value: "{{group_name}}"},
				emailhtml.Fact{Label: "命中类别", Value: "{{moderation_category}}"},
				emailhtml.Fact{Label: "审核分数", Value: "{{moderation_score}}"},
			) +
			emailhtml.Advisory("达到自动禁用阈值后，账户可能无法继续发起 API 请求。", emailhtml.ToneDanger)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 账户风控提醒",
			HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "风险控制", "请求触发内容审核规则", "本次请求已被记录，请检查请求内容。", body, emailhtml.IllustrationModerationRisk),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Your API request triggered the platform content moderation and risk-control policy.") +
		emailhtml.StatusBand("Result", "Request recorded", "Review and adjust the submitted content", emailhtml.ToneDanger) +
		emailhtml.StatRow(
			emailhtml.Stat{Label: "Violation count", Value: "{{violation_count}}", Tone: emailhtml.ToneDanger},
			emailhtml.Stat{Label: "Auto-disable threshold", Value: "{{ban_threshold}}", Tone: emailhtml.ToneWarning},
		) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Triggered at", Value: "{{triggered_at}}"},
			emailhtml.Fact{Label: "Group", Value: "{{group_name}}"},
			emailhtml.Fact{Label: "Category", Value: "{{moderation_category}}"},
			emailhtml.Fact{Label: "Moderation score", Value: "{{moderation_score}}"},
		) +
		emailhtml.Advisory("At the auto-disable threshold, the account may no longer be able to make API requests.", emailhtml.ToneDanger)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Risk control notice",
		HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "Risk control", "Request triggered content moderation", "This request was recorded. Review the submitted content.", body, emailhtml.IllustrationModerationRisk),
	}
}

func officialModerationDisabledTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。您的账户在统计周期内多次触发内容审核规则。") +
			emailhtml.StatusBand("账户状态", "已被自动禁用", "当前无法继续发起 API 请求", emailhtml.ToneDanger) +
			emailhtml.StatRow(
				emailhtml.Stat{Label: "累计触发次数", Value: "{{violation_count}}", Tone: emailhtml.ToneDanger},
				emailhtml.Stat{Label: "禁用阈值", Value: "{{ban_threshold}}", Tone: emailhtml.ToneWarning},
			) +
			emailhtml.FactList(
				emailhtml.Fact{Label: "禁用时间", Value: "{{triggered_at}}"},
				emailhtml.Fact{Label: "所属分组", Value: "{{group_name}}"},
				emailhtml.Fact{Label: "命中类别", Value: "{{moderation_category}}"},
				emailhtml.Fact{Label: "审核分数", Value: "{{moderation_score}}"},
			) +
			emailhtml.Advisory("如需申诉或恢复账号，请联系平台管理员处理。", emailhtml.ToneDanger)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 账户已被禁用",
			HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "风险控制", "账户已被自动禁用", "该账户当前无法继续发起 API 请求。", body, emailhtml.IllustrationModerationRisk),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Your account repeatedly triggered content-moderation rules during the counting period.") +
		emailhtml.StatusBand("Account status", "Disabled automatically", "API requests are currently unavailable", emailhtml.ToneDanger) +
		emailhtml.StatRow(
			emailhtml.Stat{Label: "Violation count", Value: "{{violation_count}}", Tone: emailhtml.ToneDanger},
			emailhtml.Stat{Label: "Disable threshold", Value: "{{ban_threshold}}", Tone: emailhtml.ToneWarning},
		) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Disabled at", Value: "{{triggered_at}}"},
			emailhtml.Fact{Label: "Group", Value: "{{group_name}}"},
			emailhtml.Fact{Label: "Category", Value: "{{moderation_category}}"},
			emailhtml.Fact{Label: "Moderation score", Value: "{{moderation_score}}"},
		) +
		emailhtml.Advisory("Contact the platform administrator if you need to appeal or restore access.", emailhtml.ToneDanger)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Account disabled by risk control",
		HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "Risk control", "Account disabled automatically", "This account cannot make API requests at this time.", body, emailhtml.IllustrationModerationRisk),
	}
}

func officialCyberPolicyTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("{{recipient_name}}，您好。您的请求被上游服务商的网络安全策略拦截。") +
			emailhtml.StatusBand("处理结果", "请求已被拦截", "上游服务商未执行本次请求", emailhtml.ToneDanger) +
			emailhtml.FactList(
				emailhtml.Fact{Label: "触发时间", Value: "{{triggered_at}}"},
				emailhtml.Fact{Label: "模型", Value: "{{model}}"},
				emailhtml.Fact{Label: "所属分组", Value: "{{group_name}}"},
			) +
			emailhtml.MessageBlock("上游说明", "{{upstream_message}}", emailhtml.ToneDanger) +
			emailhtml.Advisory("如认为系误判，可调整请求措辞后重试，或申请获得授权的安全访问权限。", emailhtml.ToneNeutral)
		return notificationEmailOfficialTemplate{
			Subject: "[{{site_name}}] 网络安全策略拦截提醒",
			HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "风险控制", "请求被网络安全策略拦截", "上游服务商拒绝了本次请求。", body, emailhtml.IllustrationCyberPolicy),
		}
	}
	body := emailhtml.Intro("Hello {{recipient_name}}. Your request was blocked by the upstream provider's cyber-security policy.") +
		emailhtml.StatusBand("Result", "Request blocked", "The upstream provider did not execute this request", emailhtml.ToneDanger) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Triggered at", Value: "{{triggered_at}}"},
			emailhtml.Fact{Label: "Model", Value: "{{model}}"},
			emailhtml.Fact{Label: "Group", Value: "{{group_name}}"},
		) +
		emailhtml.MessageBlock("Upstream message", "{{upstream_message}}", emailhtml.ToneDanger) +
		emailhtml.Advisory("If this appears to be a mistake, rephrase the request or apply for authorized security access.", emailhtml.ToneNeutral)
	return notificationEmailOfficialTemplate{
		Subject: "[{{site_name}}] Cyber-security policy notice",
		HTML:    officialEmailDocument(locale, emailhtml.ToneDanger, "Risk control", "Request blocked by security policy", "The upstream provider rejected this request.", body, emailhtml.IllustrationCyberPolicy),
	}
}

func officialOpsAlertTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.StatusBand("当前状态", "{{alert_status}}", "严重级别 {{severity}}", emailhtml.ToneWarning) +
			emailhtml.Statement("触发指标", "{{metric_type}} {{operator}} {{metric_value}}", "阈值 {{threshold_value}}", emailhtml.ToneWarning) +
			emailhtml.FactList(
				emailhtml.Fact{Label: "规则", Value: "{{rule_name}}"},
				emailhtml.Fact{Label: "严重级别", Value: "{{severity}}"},
				emailhtml.Fact{Label: "触发时间", Value: "{{triggered_at}}"},
			) +
			emailhtml.MessageBlock("告警说明", "{{alert_description}}", emailhtml.ToneWarning)
		return notificationEmailOfficialTemplate{
			Subject: "[运维告警][{{severity}}] {{rule_name}}",
			HTML:    officialEmailDocument(locale, emailhtml.ToneWarning, "运维", "监控规则触发告警", "{{rule_name}} 当前状态为 {{alert_status}}。", body, emailhtml.IllustrationOpsAlert),
		}
	}
	body := emailhtml.StatusBand("Current status", "{{alert_status}}", "Severity {{severity}}", emailhtml.ToneWarning) +
		emailhtml.Statement("Triggered metric", "{{metric_type}} {{operator}} {{metric_value}}", "Threshold {{threshold_value}}", emailhtml.ToneWarning) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Rule", Value: "{{rule_name}}"},
			emailhtml.Fact{Label: "Severity", Value: "{{severity}}"},
			emailhtml.Fact{Label: "Triggered at", Value: "{{triggered_at}}"},
		) +
		emailhtml.MessageBlock("Alert description", "{{alert_description}}", emailhtml.ToneWarning)
	return notificationEmailOfficialTemplate{
		Subject: "[Ops Alert][{{severity}}] {{rule_name}}",
		HTML:    officialEmailDocument(locale, emailhtml.ToneWarning, "Operations", "Monitoring rule triggered", "{{rule_name}} is currently {{alert_status}}.", body, emailhtml.IllustrationOpsAlert),
	}
}

func officialOpsReportTemplate(locale string) notificationEmailOfficialTemplate {
	if notificationEmailIsChinese(locale) {
		body := emailhtml.Intro("统计周期：{{report_start_time}} 至 {{report_end_time}}（UTC）") +
			emailhtml.FactList(
				emailhtml.Fact{Label: "报表名称", Value: "{{report_name}}"},
				emailhtml.Fact{Label: "报表类型", Value: "{{report_type}}"},
			) +
			`<div style="display: {{report_summary_display}};">` +
			emailhtml.Section("请求概览") +
			emailhtml.StatRow(
				emailhtml.Stat{Label: "总请求数", Value: "{{report_total_requests}}", Tone: emailhtml.TonePrimary},
				emailhtml.Stat{Label: "成功请求", Value: "{{report_success_count}}", Tone: emailhtml.ToneSuccess},
				emailhtml.Stat{Label: "SLA 错误", Value: "{{report_sla_error_count}}", Tone: emailhtml.ToneDanger},
				emailhtml.Stat{Label: "业务限流", Value: "{{report_business_limited_count}}", Tone: emailhtml.ToneWarning},
			) +
			emailhtml.Section("可靠性") +
			emailhtml.FactList(
				emailhtml.Fact{Label: "SLA", Value: "{{report_sla}}"},
				emailhtml.Fact{Label: "错误率", Value: "{{report_error_rate}}"},
				emailhtml.Fact{Label: "上游错误率（不含 429 / 529）", Value: "{{report_upstream_error_rate}}"},
				emailhtml.Fact{Label: "上游错误（不含 429 / 529）", Value: "{{report_upstream_error_count_excl_429_529}}"},
				emailhtml.Fact{Label: "上游 429 / 529", Value: "{{report_upstream_429_count}} / {{report_upstream_529_count}}"},
			) +
			emailhtml.Section("延迟与吞吐量") +
			emailhtml.FactList(
				emailhtml.Fact{Label: "请求延迟 p50 / p99", Value: "{{report_latency_p50}} / {{report_latency_p99}}"},
				emailhtml.Fact{Label: "首 Token 时间 p50 / p99", Value: "{{report_ttft_p50}} / {{report_ttft_p99}}"},
				emailhtml.Fact{Label: "Token 消耗", Value: "{{report_tokens}}"},
				emailhtml.Fact{Label: "QPS（当前 / 峰值 / 平均）", Value: "{{report_qps_current}} / {{report_qps_peak}} / {{report_qps_avg}}"},
				emailhtml.Fact{Label: "TPS（当前 / 峰值 / 平均）", Value: "{{report_tps_current}} / {{report_tps_peak}} / {{report_tps_avg}}"},
			) + `</div><div class="mail-generated-content" style="display: {{report_detail_display}};max-width:100%;overflow-wrap:anywhere;word-break:break-word;">{{report_html}}</div>`
		return notificationEmailOfficialTemplate{
			Subject: "[运维报表] {{report_name}}",
			HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "运维", "{{report_name}}", "{{site_name}} 的运行概览已经生成。", body, emailhtml.IllustrationOpsReport),
		}
	}
	body := emailhtml.Intro("Reporting period: {{report_start_time}} to {{report_end_time}} (UTC)") +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Report name", Value: "{{report_name}}"},
			emailhtml.Fact{Label: "Report type", Value: "{{report_type}}"},
		) +
		`<div style="display: {{report_summary_display}};">` +
		emailhtml.Section("Request overview") +
		emailhtml.StatRow(
			emailhtml.Stat{Label: "Total requests", Value: "{{report_total_requests}}", Tone: emailhtml.TonePrimary},
			emailhtml.Stat{Label: "Successful requests", Value: "{{report_success_count}}", Tone: emailhtml.ToneSuccess},
			emailhtml.Stat{Label: "SLA errors", Value: "{{report_sla_error_count}}", Tone: emailhtml.ToneDanger},
			emailhtml.Stat{Label: "Business limited", Value: "{{report_business_limited_count}}", Tone: emailhtml.ToneWarning},
		) +
		emailhtml.Section("Reliability") +
		emailhtml.FactList(
			emailhtml.Fact{Label: "SLA", Value: "{{report_sla}}"},
			emailhtml.Fact{Label: "Error rate", Value: "{{report_error_rate}}"},
			emailhtml.Fact{Label: "Upstream error rate (excluding 429 / 529)", Value: "{{report_upstream_error_rate}}"},
			emailhtml.Fact{Label: "Upstream errors (excluding 429 / 529)", Value: "{{report_upstream_error_count_excl_429_529}}"},
			emailhtml.Fact{Label: "Upstream 429 / 529", Value: "{{report_upstream_429_count}} / {{report_upstream_529_count}}"},
		) +
		emailhtml.Section("Latency and throughput") +
		emailhtml.FactList(
			emailhtml.Fact{Label: "Request latency p50 / p99", Value: "{{report_latency_p50}} / {{report_latency_p99}}"},
			emailhtml.Fact{Label: "Time to first token p50 / p99", Value: "{{report_ttft_p50}} / {{report_ttft_p99}}"},
			emailhtml.Fact{Label: "Tokens consumed", Value: "{{report_tokens}}"},
			emailhtml.Fact{Label: "QPS (current / peak / average)", Value: "{{report_qps_current}} / {{report_qps_peak}} / {{report_qps_avg}}"},
			emailhtml.Fact{Label: "TPS (current / peak / average)", Value: "{{report_tps_current}} / {{report_tps_peak}} / {{report_tps_avg}}"},
		) + `</div><div class="mail-generated-content" style="display: {{report_detail_display}};max-width:100%;overflow-wrap:anywhere;word-break:break-word;">{{report_html}}</div>`
	return notificationEmailOfficialTemplate{
		Subject: "[Ops Report] {{report_name}}",
		HTML:    officialEmailDocument(locale, emailhtml.TonePrimary, "Operations", "{{report_name}}", "The {{site_name}} runtime overview is ready.", body, emailhtml.IllustrationOpsReport),
	}
}

func officialEmailDocument(locale string, tone emailhtml.Tone, category, title, preheader, body string, illustrations ...emailhtml.Illustration) string {
	zh := notificationEmailIsChinese(locale)
	footer := "This message was sent automatically by {{site_name}}. Please do not reply directly."
	lang := "en"
	if zh {
		footer = "此邮件由 {{site_name}} 自动发送，请勿直接回复。"
		lang = "zh-CN"
	}
	illustration := emailhtml.IllustrationNone
	if len(illustrations) > 0 {
		illustration = illustrations[0]
	}
	return emailhtml.Render(emailhtml.Message{
		Lang:         lang,
		SiteName:     "{{site_name}}",
		Preheader:    preheader,
		Category:     category,
		Title:        title,
		Tone:         tone,
		Illustration: illustration,
		BodyHTML:     body,
		Footer:       footer,
	})
}

func notificationEmailIsChinese(locale string) bool {
	return normalizeNotificationLocale(locale) == notificationEmailLocaleChinese
}
