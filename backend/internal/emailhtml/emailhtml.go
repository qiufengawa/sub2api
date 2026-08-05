// Package emailhtml provides email-client-safe building blocks for
// transactional email bodies. Text arguments are escaped; BodyHTML is only
// for markup assembled from these helpers or other trusted server-side HTML.
package emailhtml

import (
	_ "embed"
	"encoding/base64"
	"html"
	"strings"
)

type Tone string

type Illustration string

const (
	TonePrimary Tone = "primary"
	ToneSuccess Tone = "success"
	ToneWarning Tone = "warning"
	ToneDanger  Tone = "danger"
	ToneNeutral Tone = "neutral"
)

const (
	IllustrationNone               Illustration = ""
	IllustrationVerification       Illustration = "verification"
	IllustrationPasswordReset      Illustration = "password-reset"
	IllustrationNotificationEmail  Illustration = "notification-email"
	IllustrationSubscriptionActive Illustration = "subscription-active"
	IllustrationSubscriptionExpiry Illustration = "subscription-expiry"
	IllustrationBalanceLow         Illustration = "balance-low"
	IllustrationRechargeSuccess    Illustration = "recharge-success"
	IllustrationQuotaCapacity      Illustration = "quota-capacity"
	IllustrationModerationRisk     Illustration = "moderation-risk"
	IllustrationCyberPolicy        Illustration = "cyber-policy"
	IllustrationOpsAlert           Illustration = "ops-alert"
	IllustrationOpsReport          Illustration = "ops-report"
	IllustrationSecurity                        = IllustrationVerification
	IllustrationRisk                            = IllustrationModerationRisk
)

type Message struct {
	Lang         string
	SiteName     string
	Preheader    string
	Category     string
	Title        string
	Tone         Tone
	Illustration Illustration
	BodyHTML     string
	Footer       string
}

type InlineAsset struct {
	ContentID string
	Filename  string
	MediaType string
	Data      []byte
}

type Fact struct {
	Label string
	Value string
}

type Stat struct {
	Label string
	Value string
	Tone  Tone
}

type Record struct {
	Meta string
	Text string
}

type palette struct {
	accent string
	strong string
	soft   string
	border string
}

type illustrationAsset struct {
	illustration Illustration
	contentID    string
	filename     string
	mediaType    string
	data         []byte
}

//go:embed assets/verification.png
var verificationIllustration []byte

//go:embed assets/password-reset.png
var passwordResetIllustration []byte

//go:embed assets/notification-email.png
var notificationEmailIllustration []byte

//go:embed assets/subscription-active.png
var subscriptionActiveIllustration []byte

//go:embed assets/subscription-expiry.png
var subscriptionExpiryIllustration []byte

//go:embed assets/balance-low.png
var balanceLowIllustration []byte

//go:embed assets/recharge-success.png
var rechargeSuccessIllustration []byte

//go:embed assets/quota-capacity.png
var quotaCapacityIllustration []byte

//go:embed assets/moderation-risk.png
var moderationRiskIllustration []byte

//go:embed assets/cyber-policy.png
var cyberPolicyIllustration []byte

//go:embed assets/ops-alert.png
var opsAlertIllustration []byte

//go:embed assets/ops-report.png
var opsReportIllustration []byte

var illustrationAssets = []illustrationAsset{
	{
		illustration: IllustrationVerification,
		contentID:    "qiu-email-verification@assets.qiu.invalid",
		filename:     "qiu-email-verification.png",
		mediaType:    "image/png",
		data:         verificationIllustration,
	},
	{
		illustration: IllustrationPasswordReset,
		contentID:    "qiu-email-password-reset@assets.qiu.invalid",
		filename:     "qiu-email-password-reset.png",
		mediaType:    "image/png",
		data:         passwordResetIllustration,
	},
	{
		illustration: IllustrationNotificationEmail,
		contentID:    "qiu-email-notification-email@assets.qiu.invalid",
		filename:     "qiu-email-notification-email.png",
		mediaType:    "image/png",
		data:         notificationEmailIllustration,
	},
	{
		illustration: IllustrationSubscriptionActive,
		contentID:    "qiu-email-subscription-active@assets.qiu.invalid",
		filename:     "qiu-email-subscription-active.png",
		mediaType:    "image/png",
		data:         subscriptionActiveIllustration,
	},
	{
		illustration: IllustrationSubscriptionExpiry,
		contentID:    "qiu-email-subscription-expiry@assets.qiu.invalid",
		filename:     "qiu-email-subscription-expiry.png",
		mediaType:    "image/png",
		data:         subscriptionExpiryIllustration,
	},
	{
		illustration: IllustrationBalanceLow,
		contentID:    "qiu-email-balance-low@assets.qiu.invalid",
		filename:     "qiu-email-balance-low.png",
		mediaType:    "image/png",
		data:         balanceLowIllustration,
	},
	{
		illustration: IllustrationRechargeSuccess,
		contentID:    "qiu-email-recharge-success@assets.qiu.invalid",
		filename:     "qiu-email-recharge-success.png",
		mediaType:    "image/png",
		data:         rechargeSuccessIllustration,
	},
	{
		illustration: IllustrationQuotaCapacity,
		contentID:    "qiu-email-quota-capacity@assets.qiu.invalid",
		filename:     "qiu-email-quota-capacity.png",
		mediaType:    "image/png",
		data:         quotaCapacityIllustration,
	},
	{
		illustration: IllustrationModerationRisk,
		contentID:    "qiu-email-moderation-risk@assets.qiu.invalid",
		filename:     "qiu-email-moderation-risk.png",
		mediaType:    "image/png",
		data:         moderationRiskIllustration,
	},
	{
		illustration: IllustrationCyberPolicy,
		contentID:    "qiu-email-cyber-policy@assets.qiu.invalid",
		filename:     "qiu-email-cyber-policy.png",
		mediaType:    "image/png",
		data:         cyberPolicyIllustration,
	},
	{
		illustration: IllustrationOpsAlert,
		contentID:    "qiu-email-ops-alert@assets.qiu.invalid",
		filename:     "qiu-email-ops-alert.png",
		mediaType:    "image/png",
		data:         opsAlertIllustration,
	},
	{
		illustration: IllustrationOpsReport,
		contentID:    "qiu-email-ops-report@assets.qiu.invalid",
		filename:     "qiu-email-ops-report.png",
		mediaType:    "image/png",
		data:         opsReportIllustration,
	},
}

func paletteFor(tone Tone) palette {
	switch tone {
	case ToneSuccess:
		return palette{accent: "#16803e", strong: "#126132", soft: "#eef9f1", border: "#b9dfc4"}
	case ToneWarning:
		return palette{accent: "#b45309", strong: "#87410a", soft: "#fff7e8", border: "#ecd09e"}
	case ToneDanger:
		return palette{accent: "#c2413b", strong: "#922f2b", soft: "#fff1f0", border: "#e9c2bf"}
	case ToneNeutral:
		return palette{accent: "#64748b", strong: "#475569", soft: "#f5f7fa", border: "#d9e0e8"}
	default:
		return palette{accent: "#2f6feb", strong: "#1f55bd", soft: "#eef4ff", border: "#c6d5f5"}
	}
}

func Render(message Message) string {
	p := paletteFor(message.Tone)
	lang := strings.TrimSpace(message.Lang)
	if lang == "" {
		lang = "en"
	}
	footer := strings.TrimSpace(message.Footer)
	if footer == "" {
		footer = "This message was sent automatically by " + message.SiteName + ". Please do not reply directly."
	}
	category := ""
	if strings.TrimSpace(message.Category) != "" {
		category = `<div style="margin-top:5px;color:` + p.strong + `;font-size:12px;font-weight:700;line-height:1.45;overflow-wrap:anywhere;word-break:break-word;">` + text(message.Category) + `</div>`
	}
	titleBlock := `<h1 class="mail-title" style="margin:0;color:#172033;font-size:25px;font-weight:750;line-height:1.3;overflow-wrap:anywhere;word-break:break-word;">` + text(message.Title) + `</h1>`
	if visual := illustrationHTML(message.Illustration); visual != "" {
		titleBlock = `<table class="mail-heading" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;table-layout:fixed;"><tr><td class="mail-heading-copy" style="padding-right:20px;vertical-align:middle;">` + titleBlock + `</td><td class="mail-heading-visual" width="88" style="width:88px;vertical-align:middle;text-align:right;">` + visual + `</td></tr></table>`
	}
	return `<!doctype html>
<html lang="` + text(lang) + `">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>` + text(message.Title) + `</title>
  <style>
    @media only screen and (max-width: 480px) {
      .mail-canvas { padding: 0 !important; }
      .mail-sheet { border-left: 0 !important; border-right: 0 !important; }
      .mail-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .mail-title { font-size: 22px !important; }
      .mail-heading-copy { padding-right: 12px !important; }
      .mail-heading-visual { width: 64px !important; }
      .mail-illustration { width: 64px !important; height: 64px !important; }
      .mail-code { font-size: 26px !important; letter-spacing: .12em !important; }
      .mail-amount { font-size: 28px !important; }
      .mail-statement { font-size: 20px !important; }
      .mail-fact-label, .mail-fact-value { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: left !important; }
      .mail-fact-label { padding: 11px 0 2px !important; border-bottom: 0 !important; }
      .mail-fact-value { padding: 0 0 11px !important; }
      .mail-stat-table, .mail-stat-table tbody, .mail-stat-table tr, .mail-stat-cell { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .mail-stat-cell { border-right: 0 !important; border-bottom: 1px solid #dfe6ee !important; }
      .mail-stat-cell:last-child { border-bottom: 0 !important; }
      .mail-action-table, .mail-action-cell, .mail-action-link { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .mail-action-link { text-align: center !important; }
    }
  </style>
</head>
<body bgcolor="#eaf1f8" style="margin:0;padding:0;background-color:#eaf1f8;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">` + text(message.Preheader) + `</div>
  <table class="mail-canvas" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eaf1f8" style="width:100%;background-color:#eaf1f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table class="mail-sheet" role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" bgcolor="#fbfdff" style="width:100%;max-width:620px;background-color:#fbfdff;border:1px solid #d4e0ec;">
		  <tr>
			<td class="mail-pad" bgcolor="#f3f7fc" style="padding:24px 34px 20px;border-bottom:1px solid #dce6f0;background-color:#f3f7fc;">
              <div style="color:#172033;font-size:18px;font-weight:750;line-height:1.35;overflow-wrap:anywhere;word-break:break-word;">` + text(message.SiteName) + `</div>` + category + `
            </td>
          </tr>
          <tr>
			<td class="mail-pad" bgcolor="#fbfdff" style="padding:30px 34px 24px;background-color:#fbfdff;">
			  ` + titleBlock + `
            </td>
          </tr>
          <tr>
			<td class="mail-pad" bgcolor="#fbfdff" style="padding:0 34px 34px;background-color:#fbfdff;color:#344054;font-size:15px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;">` + message.BodyHTML + `</td>
          </tr>
          <tr>
			<td class="mail-pad mail-footer" bgcolor="#f3f7fc" style="padding:20px 34px;border-top:1px solid #dce6f0;background-color:#f3f7fc;color:#6b7789;font-size:12px;line-height:1.65;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;">` + text(footer) + `</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

func illustrationHTML(illustration Illustration) string {
	for _, asset := range illustrationAssets {
		if asset.illustration == illustration {
			return `<img class="mail-illustration" src="cid:` + asset.contentID + `" width="88" height="88" alt="" role="presentation" aria-hidden="true" draggable="false" unselectable="on" style="display:block;width:88px;height:88px;border:0;outline:none;text-decoration:none;pointer-events:none;user-select:none;-webkit-user-select:none;-moz-user-select:none;-webkit-user-drag:none;">`
		}
	}
	return ""
}

// InlineAssetsForHTML returns copies of the embedded assets referenced by a
// rendered email. Callers can safely attach the returned data as CID parts.
func InlineAssetsForHTML(document string) []InlineAsset {
	assets := make([]InlineAsset, 0, len(illustrationAssets))
	for _, asset := range illustrationAssets {
		if !referencesInlineAsset(document, asset.contentID) {
			continue
		}
		assets = append(assets, InlineAsset{
			ContentID: asset.contentID,
			Filename:  asset.filename,
			MediaType: asset.mediaType,
			Data:      append([]byte(nil), asset.data...),
		})
	}
	return assets
}

// ResolveInlineAssetsForPreview makes CID illustrations visible in standalone
// browser previews without changing the HTML used by real email delivery.
func ResolveInlineAssetsForPreview(document string) string {
	for _, asset := range illustrationAssets {
		if !referencesInlineAsset(document, asset.contentID) {
			continue
		}
		dataURL := "data:" + asset.mediaType + ";base64," + base64.StdEncoding.EncodeToString(asset.data)
		document = replaceInlineAssetReference(document, asset.contentID, dataURL)
	}
	return document
}

func referencesInlineAsset(document, contentID string) bool {
	for _, reference := range inlineAssetReferences(contentID) {
		if strings.Contains(document, reference) {
			return true
		}
	}
	return false
}

func replaceInlineAssetReference(document, contentID, replacement string) string {
	for _, reference := range inlineAssetReferences(contentID) {
		document = strings.ReplaceAll(document, reference, strings.Replace(reference, "cid:"+contentID, replacement, 1))
	}
	return document
}

func inlineAssetReferences(contentID string) []string {
	return []string{
		inlineAssetReference(contentID),
		`background="cid:` + contentID + `"`,
		`url('cid:` + contentID + `')`,
		`url("cid:` + contentID + `")`,
	}
}

func inlineAssetReference(contentID string) string {
	return `src="cid:` + contentID + `"`
}

func Intro(value string) string {
	return `<p style="margin:0 0 22px;color:#3f4c5f;font-size:15px;line-height:1.72;overflow-wrap:anywhere;word-break:break-word;">` + text(value) + `</p>`
}

func CodePanel(label, value, note string) string {
	noteHTML := noteLine(note)
	return `<table class="mail-code-panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:22px 0;border-top:1px solid #cfd9e5;border-bottom:1px solid #cfd9e5;background:#f6f8fb;"><tr><td align="center" style="padding:20px 16px;"><div style="color:#1f55bd;font-size:12px;font-weight:700;line-height:1.4;">` + text(label) + `</div><div class="mail-code" style="margin-top:8px;color:#172033;font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:31px;font-weight:750;line-height:1.25;letter-spacing:.18em;direction:ltr;overflow-wrap:anywhere;word-break:break-all;">` + text(value) + `</div>` + noteHTML + `</td></tr></table>`
}

func AmountPanel(label, value, note string, tone Tone) string {
	p := paletteFor(tone)
	return `<div class="mail-amount-panel" style="margin:22px 0;padding:4px 0 18px;border-bottom:2px solid ` + p.accent + `;"><div style="color:` + p.strong + `;font-size:12px;font-weight:700;line-height:1.4;">` + text(label) + `</div><div class="mail-amount" style="margin-top:6px;color:#172033;font-size:32px;font-weight:750;line-height:1.2;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;word-break:break-word;">` + text(value) + `</div>` + noteLine(note) + `</div>`
}

func Statement(label, value, note string, tone Tone) string {
	p := paletteFor(tone)
	return `<table class="mail-statement-panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:22px 0;"><tr><td bgcolor="` + p.accent + `" style="width:4px;background-color:` + p.accent + `;font-size:0;line-height:0;">&nbsp;</td><td style="padding:3px 0 3px 16px;"><div style="color:` + p.strong + `;font-size:12px;font-weight:700;line-height:1.4;">` + text(label) + `</div><div class="mail-statement" style="margin-top:5px;color:#172033;font-size:22px;font-weight:750;line-height:1.32;overflow-wrap:anywhere;word-break:break-word;">` + text(value) + `</div>` + noteLine(note) + `</td></tr></table>`
}

func StatusBand(label, value, note string, tone Tone) string {
	p := paletteFor(tone)
	return `<table class="mail-status-band" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="` + p.accent + `" style="width:100%;margin:22px 0;background-color:` + p.accent + `;"><tr><td style="padding:15px 17px;color:#ffffff;"><div style="font-size:11px;font-weight:700;line-height:1.4;">` + text(label) + `</div><div style="margin-top:4px;font-size:20px;font-weight:750;line-height:1.35;overflow-wrap:anywhere;word-break:break-word;">` + text(value) + `</div><div style="margin-top:5px;color:#ffffff;font-size:12px;line-height:1.5;opacity:.92;overflow-wrap:anywhere;word-break:break-word;">` + text(note) + `</div></td></tr></table>`
}

func FactList(rows ...Fact) string {
	var builder strings.Builder
	builder.WriteString(`<table class="mail-fact-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:22px 0;border-top:1px solid #dfe6ee;table-layout:fixed;">`)
	for _, row := range rows {
		builder.WriteString(`<tr><td class="mail-fact-label" style="width:36%;padding:12px 14px 12px 0;border-bottom:1px solid #dfe6ee;color:#6b7789;font-size:12px;font-weight:650;line-height:1.5;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;">`)
		builder.WriteString(text(row.Label))
		builder.WriteString(`</td><td class="mail-fact-value" style="width:64%;padding:12px 0 12px 14px;border-bottom:1px solid #dfe6ee;color:#172033;font-size:14px;font-weight:650;line-height:1.55;text-align:right;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;">`)
		builder.WriteString(text(row.Value))
		builder.WriteString(`</td></tr>`)
	}
	builder.WriteString(`</table>`)
	return builder.String()
}

func StatRow(stats ...Stat) string {
	var builder strings.Builder
	builder.WriteString(`<table class="mail-stat-table" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;border-top:1px solid #dfe6ee;border-bottom:1px solid #dfe6ee;table-layout:fixed;"><tbody>`)
	for index := 0; index < len(stats); index += 2 {
		builder.WriteString(`<tr>`)
		for offset := 0; offset < 2; offset++ {
			statIndex := index + offset
			if statIndex >= len(stats) {
				builder.WriteString(`<td class="mail-stat-cell" style="width:50%;"></td>`)
				continue
			}
			stat := stats[statIndex]
			p := paletteFor(stat.Tone)
			border := ""
			if offset == 0 {
				border = "border-right:1px solid #dfe6ee;"
			}
			builder.WriteString(`<td class="mail-stat-cell" style="width:50%;padding:15px 16px;` + border + `vertical-align:top;"><div style="color:#6b7789;font-size:11px;font-weight:650;line-height:1.45;overflow-wrap:anywhere;word-break:break-word;">`)
			builder.WriteString(text(stat.Label))
			builder.WriteString(`</div><div style="margin-top:5px;color:`)
			builder.WriteString(p.strong)
			builder.WriteString(`;font-size:20px;font-weight:750;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;word-break:break-word;">`)
			builder.WriteString(text(stat.Value))
			builder.WriteString(`</div></td>`)
		}
		builder.WriteString(`</tr>`)
	}
	builder.WriteString(`</tbody></table>`)
	return builder.String()
}

func Section(value string) string {
	return `<h2 style="margin:28px 0 12px;padding-bottom:9px;border-bottom:1px solid #dfe6ee;color:#172033;font-size:16px;font-weight:750;line-height:1.4;overflow-wrap:anywhere;word-break:break-word;">` + text(value) + `</h2>`
}

func Action(url, label string, tone Tone) string {
	p := paletteFor(tone)
	return `<table class="mail-action-table" role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td class="mail-action-cell" bgcolor="` + p.accent + `" style="border-radius:3px;"><a class="mail-action-link" href="` + text(url) + `" style="display:inline-block;max-width:100%;padding:12px 20px;color:#ffffff;font-size:14px;font-weight:750;line-height:1.35;text-align:center;text-decoration:none;overflow-wrap:anywhere;word-break:break-word;">` + text(label) + `</a></td></tr></table>`
}

func Advisory(value string, tone Tone) string {
	p := paletteFor(tone)
	return `<table class="mail-advisory" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:22px 0;"><tr><td bgcolor="` + p.accent + `" style="width:3px;background-color:` + p.accent + `;font-size:0;line-height:0;">&nbsp;</td><td style="padding:1px 0 1px 14px;color:` + p.strong + `;font-size:13px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word;">` + text(value) + `</td></tr></table>`
}

func MessageBlock(label, value string, tone Tone) string {
	p := paletteFor(tone)
	return `<div style="margin:22px 0;padding:15px 16px;border-top:1px solid ` + p.border + `;border-bottom:1px solid ` + p.border + `;background:#f6f8fb;"><div style="margin-bottom:6px;color:` + p.strong + `;font-size:12px;font-weight:700;line-height:1.4;">` + text(label) + `</div><div style="max-width:100%;color:#344054;font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:12px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap;">` + text(value) + `</div></div>`
}

func ReferenceLink(value, label string) string {
	return `<div style="margin:22px 0;color:#6b7789;font-size:12px;line-height:1.65;"><div style="margin-bottom:5px;font-weight:650;">` + text(label) + `</div><a href="` + text(value) + `" style="color:#245dcc;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">` + text(value) + `</a></div>`
}

func MinorLink(url, label string) string {
	return `<p style="margin:22px 0 0;color:#6b7789;font-size:12px;line-height:1.65;"><a href="` + text(url) + `" style="color:#526175;text-decoration:underline;overflow-wrap:anywhere;word-break:break-word;">` + text(label) + `</a></p>`
}

func Records(records ...Record) string {
	var builder strings.Builder
	builder.WriteString(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:16px 0;border-top:1px solid #dfe6ee;">`)
	for _, record := range records {
		builder.WriteString(`<tr><td style="padding:13px 0;border-bottom:1px solid #dfe6ee;vertical-align:top;"><div style="margin-bottom:4px;color:#6b7789;font-size:11px;font-weight:650;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">`)
		builder.WriteString(text(record.Meta))
		builder.WriteString(`</div><div style="color:#344054;font-size:13px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word;">`)
		builder.WriteString(text(record.Text))
		builder.WriteString(`</div></td></tr>`)
	}
	builder.WriteString(`</table>`)
	return builder.String()
}

func noteLine(note string) string {
	if strings.TrimSpace(note) == "" {
		return ""
	}
	return `<div style="margin-top:7px;color:#6b7789;font-size:13px;line-height:1.55;overflow-wrap:anywhere;word-break:break-word;">` + text(note) + `</div>`
}

func text(value string) string {
	return html.EscapeString(value)
}
