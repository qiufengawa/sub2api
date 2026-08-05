package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/emailhtml"
)

func buildContentModerationViolationEmailBody(siteName string, log *ContentModerationLog, cfg *ContentModerationConfig) string {
	if log == nil {
		return ""
	}
	userName := contentModerationEmailRecipient(log)
	threshold := contentModerationEmailThreshold(cfg)
	body := emailhtml.Intro("尊敬的用户 "+userName+"，您的 API 请求触发了平台内容审核与风险控制策略。") +
		emailhtml.StatusBand("处理结果", "请求已被记录", "请检查并调整请求内容", emailhtml.ToneDanger) +
		emailhtml.StatRow(
			emailhtml.Stat{Label: "累计触发次数", Value: fmt.Sprintf("%d", log.ViolationCount), Tone: emailhtml.ToneDanger},
			emailhtml.Stat{Label: "自动禁用阈值", Value: fmt.Sprintf("%d", threshold), Tone: emailhtml.ToneWarning},
		) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "触发时间", Value: time.Now().Format("2006-01-02 15:04:05")},
			emailhtml.Fact{Label: "触发来源", Value: "内容审核"},
			emailhtml.Fact{Label: "所属分组", Value: defaultContentModerationString(log.GroupName, "-")},
			emailhtml.Fact{Label: "命中类别", Value: defaultContentModerationString(log.HighestCategory, "-")},
			emailhtml.Fact{Label: "审核分数", Value: fmt.Sprintf("%.3f", log.HighestScore)},
		) + emailhtml.Advisory("请调整请求内容，避免后续服务受到影响。", emailhtml.ToneDanger)
	if log.AutoBanned {
		body += emailhtml.Advisory("账户当前处于禁用状态，所有 API 请求将被拒绝。", emailhtml.ToneDanger)
	}
	return emailhtml.Render(emailhtml.Message{
		Lang:         "zh-CN",
		SiteName:     siteName,
		Preheader:    "您的 API 请求触发了内容审核与风险控制策略。",
		Category:     "风险控制",
		Title:        "请求触发内容审核规则",
		Tone:         emailhtml.ToneDanger,
		Illustration: emailhtml.IllustrationModerationRisk,
		BodyHTML:     body,
		Footer:       "此邮件由 " + siteName + " 自动发送，请勿直接回复。",
	})
}

func buildContentModerationAccountDisabledEmailBody(siteName string, log *ContentModerationLog, cfg *ContentModerationConfig) string {
	if log == nil {
		return ""
	}
	userName := contentModerationEmailRecipient(log)
	threshold := contentModerationEmailThreshold(cfg)
	body := emailhtml.Intro("尊敬的用户 "+userName+"，您的账户在统计周期内多次触发内容审核规则，系统已自动禁用该账户。") +
		emailhtml.StatusBand("账户状态", "已禁用", fmt.Sprintf("累计触发 %d 次 / 阈值 %d 次", log.ViolationCount, threshold), emailhtml.ToneDanger) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "禁用时间", Value: time.Now().Format("2006-01-02 15:04:05")},
			emailhtml.Fact{Label: "触发来源", Value: "内容审核"},
			emailhtml.Fact{Label: "所属分组", Value: defaultContentModerationString(log.GroupName, "-")},
			emailhtml.Fact{Label: "命中类别", Value: defaultContentModerationString(log.HighestCategory, "-")},
			emailhtml.Fact{Label: "审核分数", Value: fmt.Sprintf("%.3f", log.HighestScore)},
		) +
		emailhtml.Advisory("账户当前无法继续发起 API 请求。如需申诉或恢复账号，请联系平台管理员。", emailhtml.ToneDanger)
	return emailhtml.Render(emailhtml.Message{
		Lang:         "zh-CN",
		SiteName:     siteName,
		Preheader:    "您的账户已被风险控制系统自动禁用。",
		Category:     "风险控制",
		Title:        "账户已被自动禁用",
		Tone:         emailhtml.ToneDanger,
		Illustration: emailhtml.IllustrationModerationRisk,
		BodyHTML:     body,
		Footer:       "此邮件由 " + siteName + " 自动发送，请勿直接回复。",
	})
}

func defaultContentModerationString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

// buildCyberPolicyNoticeEmailBody is the built-in fallback when the editable
// cyber-policy notification template cannot be rendered.
func buildCyberPolicyNoticeEmailBody(siteName string, log *ContentModerationLog) string {
	if log == nil {
		return ""
	}
	body := emailhtml.Intro("尊敬的用户 "+contentModerationEmailRecipient(log)+"，您的请求被上游服务商的网络安全策略拦截。") +
		emailhtml.StatusBand("处理结果", "请求已拦截", "上游服务商未执行本次请求", emailhtml.ToneDanger) +
		emailhtml.FactList(
			emailhtml.Fact{Label: "触发时间", Value: log.CreatedAt.Format("2006-01-02 15:04:05")},
			emailhtml.Fact{Label: "模型", Value: defaultContentModerationString(log.Model, "-")},
			emailhtml.Fact{Label: "所属分组", Value: defaultContentModerationString(log.GroupName, "-")},
		) +
		emailhtml.MessageBlock("上游说明", defaultContentModerationString(log.Error, "-"), emailhtml.ToneDanger) +
		emailhtml.Advisory("如认为系误判，可调整请求措辞后重试，或申请获得授权的安全访问权限。", emailhtml.ToneNeutral)
	return emailhtml.Render(emailhtml.Message{
		Lang:         "zh-CN",
		SiteName:     siteName,
		Preheader:    "您的请求被上游网络安全策略拦截。",
		Category:     "风险控制",
		Title:        "请求被网络安全策略拦截",
		Tone:         emailhtml.ToneDanger,
		Illustration: emailhtml.IllustrationCyberPolicy,
		BodyHTML:     body,
		Footer:       "此邮件由 " + siteName + " 自动发送，请勿直接回复。",
	})
}

func contentModerationEmailRecipient(log *ContentModerationLog) string {
	userName := strings.TrimSpace(log.UserEmail)
	if userName == "" && log.UserID != nil {
		userName = fmt.Sprintf("UID %d", *log.UserID)
	}
	return defaultContentModerationString(userName, "用户")
}

func contentModerationEmailThreshold(cfg *ContentModerationConfig) int {
	threshold := defaultContentModerationBanThreshold
	if cfg != nil && cfg.BanThreshold > 0 {
		threshold = cfg.BanThreshold
	}
	return threshold
}
