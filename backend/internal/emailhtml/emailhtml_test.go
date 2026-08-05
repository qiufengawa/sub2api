package emailhtml

import (
	"bytes"
	"strings"
	"testing"
)

func TestRenderUsesEmailSafeVisualSystemAndEscapesText(t *testing.T) {
	body := Intro(`<script>alert("body")</script>`) +
		CodePanel("Code", `123<456`, "15 minutes") +
		Action(`https://example.com/?a=1&b=<x>`, `Open <now>`, TonePrimary)
	rendered := Render(Message{
		Lang:      "en",
		SiteName:  `Qiu <API>`,
		Preheader: `Preview <hidden>`,
		Category:  "Account security",
		Title:     `Verify <email>`,
		Tone:      TonePrimary,
		BodyHTML:  body,
		Footer:    `Sent by Qiu <API>`,
	})

	for _, unsafe := range []string{"<script>", "Qiu <API>", "Verify <email>", `href="https://example.com/?a=1&b=<x>"`} {
		if strings.Contains(rendered, unsafe) {
			t.Fatalf("rendered email contains unescaped value %q", unsafe)
		}
	}
	for _, required := range []string{"Qiu &lt;API&gt;", "Verify &lt;email&gt;", "123&lt;456", "a=1&amp;b=&lt;x&gt;", "max-width:620px", "max-width: 480px", "mail-sheet", "mail-code", "mail-action-table", "mail-footer", `bgcolor="#eaf1f8"`, `bgcolor="#f3f7fc"`, "border-radius:3px", "overflow-wrap:anywhere"} {
		if !strings.Contains(rendered, required) {
			t.Fatalf("rendered email does not contain %q", required)
		}
	}
	for _, forbidden := range []string{"linear-gradient", "box-shadow", "background-image", "position:absolute", "float:", "white-space:nowrap", "border-radius:8px", "border-radius:12px", "width:28px;height:4px", "width:38px;vertical-align:top"} {
		if strings.Contains(rendered, forbidden) {
			t.Fatalf("rendered email contains forbidden style %q", forbidden)
		}
	}
	if !strings.Contains(StatusBand("Status", "Ready", "Delivered", ToneSuccess), `bgcolor="#16803e"`) {
		t.Fatal("status band does not include an Outlook-compatible background color")
	}
}

func TestIllustrationUsesCIDAndCanBeResolvedForBrowserPreview(t *testing.T) {
	rendered := Render(Message{
		Lang:         "en",
		SiteName:     "Qiu API",
		Category:     "Account security",
		Title:        "Verify your email",
		Tone:         TonePrimary,
		Illustration: IllustrationVerification,
		BodyHTML:     Intro("Complete verification."),
	})

	if !strings.Contains(rendered, `src="cid:qiu-email-verification@assets.qiu.invalid"`) {
		t.Fatal("rendered email does not reference the verification illustration by CID")
	}
	if strings.Contains(rendered, "data:image/") {
		t.Fatal("delivery HTML must not contain a data URI")
	}
	assets := InlineAssetsForHTML(rendered)
	if len(assets) != 1 {
		t.Fatalf("got %d inline assets, want one business illustration", len(assets))
	}
	if assets[0].ContentID != "qiu-email-verification@assets.qiu.invalid" || assets[0].MediaType != "image/png" {
		t.Fatalf("unexpected inline asset metadata: %+v", assets[0])
	}
	if !bytes.HasPrefix(assets[0].Data, []byte("\x89PNG\r\n\x1a\n")) {
		t.Fatal("inline asset is not a PNG")
	}

	assets[0].Data[0] = 0
	fresh := InlineAssetsForHTML(rendered)
	if len(fresh) != 1 || fresh[0].Data[0] != 0x89 {
		t.Fatal("inline asset data was not returned as an isolated copy")
	}
	preview := ResolveInlineAssetsForPreview(rendered)
	if strings.Contains(preview, "cid:qiu-email-verification@assets.qiu.invalid") || strings.Count(preview, "data:image/png;base64,") != 1 {
		t.Fatal("browser preview did not resolve the CID illustration")
	}
}

func TestEveryIllustrationHasAResolvablePNG(t *testing.T) {
	tests := []struct {
		illustration Illustration
		contentID    string
	}{
		{IllustrationVerification, "qiu-email-verification@assets.qiu.invalid"},
		{IllustrationPasswordReset, "qiu-email-password-reset@assets.qiu.invalid"},
		{IllustrationNotificationEmail, "qiu-email-notification-email@assets.qiu.invalid"},
		{IllustrationSubscriptionActive, "qiu-email-subscription-active@assets.qiu.invalid"},
		{IllustrationSubscriptionExpiry, "qiu-email-subscription-expiry@assets.qiu.invalid"},
		{IllustrationBalanceLow, "qiu-email-balance-low@assets.qiu.invalid"},
		{IllustrationRechargeSuccess, "qiu-email-recharge-success@assets.qiu.invalid"},
		{IllustrationQuotaCapacity, "qiu-email-quota-capacity@assets.qiu.invalid"},
		{IllustrationModerationRisk, "qiu-email-moderation-risk@assets.qiu.invalid"},
		{IllustrationCyberPolicy, "qiu-email-cyber-policy@assets.qiu.invalid"},
		{IllustrationOpsAlert, "qiu-email-ops-alert@assets.qiu.invalid"},
		{IllustrationOpsReport, "qiu-email-ops-report@assets.qiu.invalid"},
	}

	for _, tt := range tests {
		t.Run(string(tt.illustration), func(t *testing.T) {
			rendered := Render(Message{
				SiteName:     "Qiu API",
				Title:        "Visual test",
				Illustration: tt.illustration,
				BodyHTML:     Intro("Complete the requested action."),
			})
			if !strings.Contains(rendered, `src="cid:`+tt.contentID+`"`) {
				t.Fatalf("rendered email does not reference %s", tt.contentID)
			}
			if !strings.Contains(rendered, `width="88" height="88" alt="" role="presentation" aria-hidden="true" draggable="false" unselectable="on"`) {
				t.Fatal("business illustration is missing email-safe dimensions or presentation semantics")
			}
			for _, required := range []string{"pointer-events:none", "user-select:none", "-webkit-user-select:none", "-moz-user-select:none", "-webkit-user-drag:none"} {
				if !strings.Contains(rendered, required) {
					t.Fatalf("business illustration is missing non-interactive style %q", required)
				}
			}
			assets := InlineAssetsForHTML(rendered)
			if len(assets) != 1 {
				t.Fatalf("got %d inline assets, want one business illustration", len(assets))
			}
			if assets[0].ContentID != tt.contentID || !bytes.HasPrefix(assets[0].Data, []byte("\x89PNG\r\n\x1a\n")) {
				t.Fatalf("unexpected business illustration asset: %+v", assets[0])
			}
			preview := ResolveInlineAssetsForPreview(rendered)
			if strings.Contains(preview, "cid:qiu-email-") || strings.Count(preview, "data:image/png;base64,") != 1 {
				t.Fatal("browser preview did not resolve the inline asset")
			}
		})
	}
}

func TestInlineAssetsRequireAnExactImageSourceReference(t *testing.T) {
	for _, document := range []string{
		`<img src="cid:qiu-email-verification@assets.qiu.invalid.evil" alt="">`,
		`<td background="cid:qiu-email-verification@assets.qiu.invalid.evil">`,
	} {
		if assets := InlineAssetsForHTML(document); len(assets) != 0 {
			t.Fatalf("near-match CID unexpectedly selected %d inline assets", len(assets))
		}
		if preview := ResolveInlineAssetsForPreview(document); preview != document {
			t.Fatal("near-match CID was unexpectedly rewritten for preview")
		}
	}
}

func TestDetailsAndRecordsPreserveLongTextWrapping(t *testing.T) {
	rendered := FactList(Fact{Label: "Model", Value: strings.Repeat("long-model-name-", 12)}) +
		Records(Record{Meta: "2026-08-05 · provider · HTTP 500", Text: strings.Repeat("upstream-message-", 20)}) +
		MessageBlock("Raw message", strings.Repeat("abcdef", 40), ToneDanger)

	for _, required := range []string{"overflow-wrap:anywhere", "word-break:break-word", "white-space:pre-wrap"} {
		if !strings.Contains(rendered, required) {
			t.Fatalf("long-text layout does not contain %q", required)
		}
	}
}

func TestSemanticEmphasisAndMobileLayoutHandleLongValues(t *testing.T) {
	longValue := strings.Repeat("long-value-without-a-safe-width-", 8)
	body := CodePanel("Verification code", "12345678", "Valid for 15 minutes") +
		AmountPanel("Current balance", "$12345678901234567890.123456", "Threshold $10.00", ToneWarning) +
		Statement("Active plan", longValue, "Valid for 30 days", ToneSuccess) +
		StatusBand("Account status", "Disabled", longValue, ToneDanger) +
		FactList(Fact{Label: longValue, Value: longValue}) +
		ReferenceLink("https://example.com/"+longValue, "Complete link") +
		Action("https://example.com", longValue, TonePrimary)

	rendered := Render(Message{
		Lang:      "en",
		SiteName:  strings.Repeat("Very long site name ", 10),
		Category:  strings.Repeat("Account security ", 8),
		Title:     strings.Repeat("A long transactional email title ", 5),
		Tone:      ToneDanger,
		BodyHTML:  body,
		Preheader: "Long-value regression",
	})

	for _, className := range []string{"mail-code", "mail-amount", "mail-statement", "mail-status-band"} {
		if !strings.Contains(rendered, className) {
			t.Fatalf("semantic emphasis class %q is missing", className)
		}
	}
	for _, forbidden := range []string{"white-space:nowrap", "word-break:keep-all"} {
		if strings.Contains(rendered, forbidden) {
			t.Fatalf("responsive email contains overflow-prone style %q", forbidden)
		}
	}
}
