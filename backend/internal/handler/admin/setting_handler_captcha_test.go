package admin

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type captchaTestRoundTripper func(*http.Request) (*http.Response, error)

func (f captchaTestRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestSettingHandler_TestCaptchaUsesDraftCredentialsWithoutPersisting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	verifier := service.NewGeetestCaptchaService(
		service.GeetestCaptchaCredentials{},
		&http.Client{Transport: captchaTestRoundTripper(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewBufferString(`{"result":"success","reason":"ok"}`)),
				Header:     make(http.Header),
				Request:    r,
			}, nil
		})},
	)
	h := NewSettingHandler(nil, nil, nil, nil, nil, nil, nil)
	h.SetGeetestCaptchaService(verifier)

	body := []byte(`{
		"provider":"geetest",
		"geetest_captcha_id":"draft-id",
		"geetest_captcha_key":"draft-key",
		"proof":{"lot_number":"lot-1","captcha_output":"output","pass_token":"pass","gen_time":"123"}
	}`)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/admin/settings/test-captcha", bytes.NewReader(body))

	h.TestCaptcha(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"verified":true`)
}

func TestSettingHandler_TestCaptchaRejectsUnsupportedProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewSettingHandler(nil, nil, nil, nil, nil, nil, nil)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/admin/settings/test-captcha", bytes.NewBufferString(`{"provider":"turnstile"}`))

	h.TestCaptcha(c)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}
