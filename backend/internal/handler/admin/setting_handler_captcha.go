package admin

import (
	"net/http"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/handler/dto"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// TestCaptchaRequest is intentionally separate from UpdateSettingsRequest:
// testing a draft configuration must not persist it. Private keys are used
// only for this request and are never returned in the response.
type TestCaptchaRequest struct {
	Provider          string                      `json:"provider"`
	GeetestCaptchaID  string                      `json:"geetest_captcha_id"`
	GeetestCaptchaKey string                      `json:"geetest_captcha_key"`
	Proof             service.GeetestCaptchaProof `json:"proof"`
}

// TestCaptcha validates a GeeTest proof with the credentials currently in the
// form (falling back to the saved key when the form intentionally leaves it
// blank). It gives administrators a real end-to-end check of both the browser
// widget and the server-side second-step verification without saving anything.
// POST /api/v1/admin/settings/test-captcha
func (h *SettingHandler) TestCaptcha(c *gin.Context) {
	var req TestCaptchaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if provider := strings.ToLower(strings.TrimSpace(req.Provider)); provider != "geetest" {
		response.BadRequest(c, "Only GeeTest can be tested from this form")
		return
	}

	credentials := service.GeetestCaptchaCredentials{
		CaptchaID:  strings.TrimSpace(req.GeetestCaptchaID),
		CaptchaKey: strings.TrimSpace(req.GeetestCaptchaKey),
	}
	// A configured secret is deliberately omitted from GET responses and is
	// commonly left blank in the form. Reuse the stored value for that case.
	if credentials.CaptchaID == "" || credentials.CaptchaKey == "" {
		if h.settingService != nil {
			if config, err := h.settingService.GetCaptchaProviderConfig(c.Request.Context()); err == nil {
				if credentials.CaptchaID == "" {
					credentials.CaptchaID = strings.TrimSpace(config.Geetest.CaptchaID)
				}
				if credentials.CaptchaKey == "" {
					credentials.CaptchaKey = strings.TrimSpace(config.Geetest.CaptchaKey)
				}
			}
		}
	}
	if credentials.CaptchaID == "" {
		response.BadRequest(c, "GeeTest Captcha ID is required")
		return
	}
	if credentials.CaptchaKey == "" {
		response.BadRequest(c, "GeeTest private key is required")
		return
	}

	verifier := h.geetestCaptchaService
	if verifier == nil {
		verifier = service.NewGeetestCaptchaService(service.GeetestCaptchaCredentials{}, nil)
	}
	if err := verifier.VerifyWithCredentials(c.Request.Context(), credentials, req.Proof); err != nil {
		if service.IsGeetestCaptchaProviderUnavailable(err) {
			response.Error(c, http.StatusBadGateway, "GeeTest service is unavailable; check network access and try again")
			return
		}
		response.ErrorFrom(c, err)
		return
	}

	response.Success(c, dto.CaptchaTestResult{
		Provider: "geetest",
		Verified: true,
		Message:  "GeeTest verification successful",
	})
}
