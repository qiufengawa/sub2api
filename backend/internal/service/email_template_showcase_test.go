package service

import (
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/emailhtml"
	"github.com/stretchr/testify/require"
)

const updateEmailTemplateShowcaseEnv = "UPDATE_EMAIL_SHOWCASE"

func TestEmailTemplateShowcaseCoversEveryOfficialTemplate(t *testing.T) {
	document, count, err := buildEmailTemplateShowcase()
	require.NoError(t, err)
	require.Equal(t, len(notificationEmailEventOrder)*len(notificationEmailLocales), count)
	require.Equal(t, count, strings.Count(document, `<iframe class="email-frame"`))
	require.NotContains(t, document, "{{", "showcase must not contain unresolved template placeholders")
	require.NotContains(t, document, "linear-gradient")
	require.NotContains(t, document, "cid:qiu-email-", "showcase must resolve CID illustrations for browser preview")
	require.Equal(t, count, strings.Count(document, "data:image/png;base64,"), "each template should display one business illustration")

	path := filepath.Join("..", "..", "..", "docs", "email-template-showcase.html")
	if os.Getenv(updateEmailTemplateShowcaseEnv) == "1" {
		require.NoError(t, os.WriteFile(path, []byte(document), 0o644))
		return
	}
	committed, err := os.ReadFile(path)
	require.NoError(t, err)
	require.Equal(t, document, string(committed), "email showcase is stale; regenerate it with UPDATE_EMAIL_SHOWCASE=1")
}

func buildEmailTemplateShowcase() (string, int, error) {
	type renderedTemplate struct {
		event       string
		label       string
		description string
		locale      string
		subject     string
		html        string
	}

	items := make([]renderedTemplate, 0, len(notificationEmailEventOrder)*len(notificationEmailLocales))
	for _, event := range notificationEmailEventOrder {
		definition := notificationEmailEventDefinitions[event]
		for _, locale := range notificationEmailLocales {
			tmpl := notificationEmailOfficialTemplates[event][locale]
			variables := notificationEmailSampleVariables(locale)
			variables["site_name"] = "Qiu API"
			variables["recipient_email"] = "long.customer.address+notifications@example.com"
			variables["subscription_group"] = "OpenAI Comprehensive Developer Subscription"
			variables["account_name"] = "openai-production-capacity-account-east-asia"
			variables["model"] = "gpt-image-1-production-long-model-identifier"
			variables["upstream_message"] = "The request was blocked by the upstream security policy. Reference: policy_check_failed_for_a_very_long_provider_response_without_spaces_0123456789abcdef."
			raw := map[string]string(nil)
			if event == NotificationEmailEventOpsScheduledReport {
				raw = map[string]string{"report_html": `<h2 style="font-size:18px;margin:0 0 12px;">Detailed report</h2><p style="font-size:14px;line-height:1.6;">This trusted server-generated section is used by error and account-health reports.</p>`}
			}
			rendered, err := renderNotificationEmail(event, tmpl.Subject, tmpl.HTML, variables, raw)
			if err != nil {
				return "", 0, fmt.Errorf("render %s/%s: %w", event, locale, err)
			}
			items = append(items, renderedTemplate{
				event:       event,
				label:       definition.Label,
				description: definition.Description,
				locale:      locale,
				subject:     rendered.Subject,
				html:        emailhtml.ResolveInlineAssetsForPreview(rendered.HTML),
			})
		}
	}

	var sections strings.Builder
	for index := 0; index < len(items); index += len(notificationEmailLocales) {
		first := items[index]
		_, _ = sections.WriteString(`<section class="template-section" id="` + html.EscapeString(first.event) + `">`)
		_, _ = sections.WriteString(`<div class="section-heading"><div><p class="event-key">` + html.EscapeString(first.event) + `</p><h2>` + html.EscapeString(first.label) + `</h2><p class="description">` + html.EscapeString(first.description) + `</p></div><span class="index">` + fmt.Sprintf("%02d", index/len(notificationEmailLocales)+1) + `</span></div>`)
		_, _ = sections.WriteString(`<div class="locale-grid">`)
		for offset := 0; offset < len(notificationEmailLocales); offset++ {
			item := items[index+offset]
			localeLabel := "English"
			if item.locale == notificationEmailLocaleChinese {
				localeLabel = "简体中文"
			}
			_, _ = sections.WriteString(`<article class="locale-panel locale-` + html.EscapeString(item.locale) + `"><div class="locale-meta"><span>` + localeLabel + `</span><code>` + html.EscapeString(item.subject) + `</code></div><div class="frame-shell"><iframe class="email-frame" title="` + html.EscapeString(item.event+" "+localeLabel) + `" srcdoc="` + html.EscapeString(item.html) + `"></iframe></div></article>`)
		}
		_, _ = sections.WriteString(`</div></section>`)
	}

	document := `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qiu API 邮件模板总览</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #172033; background: #eef3f8; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef3f8; }
    button { font: inherit; }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 62px; padding: 10px 24px; border-bottom: 1px solid #d8e2ec; background: rgba(255,255,255,.96); }
    .toolbar-title { min-width: 0; }
    .toolbar h1 { margin: 0; font-size: 17px; line-height: 1.3; }
    .toolbar p { margin: 3px 0 0; color: #667085; font-size: 12px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .control-group { display: flex; padding: 2px; border: 1px solid #d8e2ec; border-radius: 4px; background: #f8fafc; }
    .control { min-height: 30px; padding: 5px 10px; border: 0; border-radius: 3px; color: #475569; background: transparent; font-size: 12px; font-weight: 600; cursor: pointer; }
    .control.active { color: #fff; background: #2f6feb; }
    main { width: min(1560px, 100%); margin: 0 auto; padding: 30px 24px 64px; }
    .template-section { padding: 30px 0 38px; border-bottom: 1px solid #d8e2ec; }
    .template-section:first-child { padding-top: 0; }
    .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
    .event-key { margin: 0 0 5px; color: #2f6feb; font: 600 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .section-heading h2 { margin: 0; font-size: 20px; line-height: 1.35; }
    .description { max-width: 760px; margin: 6px 0 0; color: #667085; font-size: 13px; line-height: 1.55; }
    .index { color: #94a3b8; font: 700 20px/1 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .locale-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
    .locale-panel { min-width: 0; }
    .locale-meta { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px; min-height: 40px; padding: 7px 10px; border: 1px solid #d8e2ec; border-bottom: 0; border-radius: 4px 4px 0 0; background: #fff; }
    .locale-meta span { color: #344054; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .locale-meta code { min-width: 0; overflow: hidden; color: #667085; font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
    .frame-shell { width: 100%; margin: 0 auto; border: 1px solid #d8e2ec; border-radius: 0 0 4px 4px; overflow: hidden; background: #f3f7fb; transition: width .18s ease; }
    .email-frame { display: block; width: 100%; height: 680px; border: 0; background: #f3f7fb; }
    body.mobile-mode .frame-shell { width: min(390px, 100%); border-radius: 4px; }
    body.mobile-mode .locale-grid { align-items: start; }
    body[data-locale="en"] .locale-zh, body[data-locale="zh"] .locale-en { display: none; }
    body:not([data-locale="all"]) .locale-grid { grid-template-columns: minmax(0, 760px); }
    @media (max-width: 900px) {
      .toolbar { position: static; align-items: flex-start; padding: 12px 14px; }
      .toolbar p { display: none; }
      .controls { gap: 6px; }
      main { padding: 22px 12px 48px; }
      .locale-grid { grid-template-columns: 1fr; }
      .template-section { padding: 24px 0 30px; }
      .description { display: none; }
    }
    @media (max-width: 560px) {
      .toolbar { display: block; }
      .controls { justify-content: flex-start; margin-top: 10px; }
      .locale-meta { grid-template-columns: 1fr; gap: 2px; }
    }
  </style>
</head>
<body data-locale="all">
  <header class="toolbar">
    <div class="toolbar-title"><h1>Qiu API 邮件模板总览</h1><p>13 类事件 · 26 个中英文模板 · 使用真实模板渲染器与示例数据</p></div>
    <div class="controls">
      <div class="control-group" aria-label="预览宽度"><button class="control active" data-width="desktop">桌面</button><button class="control" data-width="mobile">手机 390px</button></div>
      <div class="control-group" aria-label="语言筛选"><button class="control active" data-locale="all">全部</button><button class="control" data-locale="zh">中文</button><button class="control" data-locale="en">English</button></div>
    </div>
  </header>
  <main>` + sections.String() + `</main>
  <script>
    const fitFrame = (frame) => {
      try {
        const height = frame.contentDocument.documentElement.scrollHeight;
        frame.style.height = Math.max(520, height + 2) + 'px';
      } catch (_) {}
    };
    document.querySelectorAll('.email-frame').forEach((frame) => {
      frame.addEventListener('load', () => fitFrame(frame));
      if (frame.contentDocument && frame.contentDocument.readyState === 'complete') fitFrame(frame);
    });
    document.querySelectorAll('[data-width]').forEach((button) => button.addEventListener('click', () => {
      document.body.classList.toggle('mobile-mode', button.dataset.width === 'mobile');
      document.querySelectorAll('[data-width]').forEach((item) => item.classList.toggle('active', item === button));
      setTimeout(() => document.querySelectorAll('.email-frame').forEach(fitFrame), 220);
    }));
    document.querySelectorAll('button[data-locale]').forEach((button) => button.addEventListener('click', () => {
      document.body.dataset.locale = button.dataset.locale;
      document.querySelectorAll('button[data-locale]').forEach((item) => item.classList.toggle('active', item === button));
    }));
  </script>
</body>
</html>`
	return document, len(items), nil
}
