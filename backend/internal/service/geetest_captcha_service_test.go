package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type geetestRoundTripper func(*http.Request) (*http.Response, error)

func (f geetestRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestGeetestSignToken(t *testing.T) {
	got := GeetestSignToken("LOT", "KEY")
	m := hmac.New(sha256.New, []byte("KEY"))
	_, _ = m.Write([]byte("LOT"))
	require.Equal(t, hex.EncodeToString(m.Sum(nil)), got)
}

func TestGeetestCaptchaServiceVerifyPostsGT4Form(t *testing.T) {
	client := &http.Client{Transport: geetestRoundTripper(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "application/x-www-form-urlencoded", r.Header.Get("Content-Type"))
		require.Equal(t, "cid", r.URL.Query().Get("captcha_id"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		form, err := url.ParseQuery(string(body))
		require.NoError(t, err)
		require.Equal(t, "lot", form.Get("lot_number"))
		require.Equal(t, "output", form.Get("captcha_output"))
		require.Equal(t, "pass", form.Get("pass_token"))
		require.Equal(t, "123", form.Get("gen_time"))
		require.Equal(t, GeetestSignToken("lot", "key"), form.Get("sign_token"))
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"result":"success"}`)), Header: make(http.Header)}, nil
	})}
	svc := NewGeetestCaptchaService(GeetestCaptchaCredentials{CaptchaID: "cid", CaptchaKey: "key"}, client)
	svc.Endpoint = "https://fixture.invalid/validate"
	require.NoError(t, svc.Verify(context.Background(), GeetestCaptchaProof{LotNumber: "lot", CaptchaOutput: "output", PassToken: "pass", GenTime: "123"}))
}

func TestGeetestCaptchaServiceRejectsMalformedOrFailed(t *testing.T) {
	svc := NewGeetestCaptchaService(GeetestCaptchaCredentials{CaptchaID: "cid", CaptchaKey: "key"}, &http.Client{Transport: geetestRoundTripper(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"result":"fail","reason":"bad"}`)), Header: make(http.Header)}, nil
	})})
	svc.Endpoint = "https://fixture.invalid/validate"
	err := svc.Verify(context.Background(), GeetestCaptchaProof{LotNumber: "lot", CaptchaOutput: "output", PassToken: "pass", GenTime: "123"})
	require.ErrorIs(t, err, ErrGeetestCaptchaVerificationFailed)
	err = svc.Verify(context.Background(), GeetestCaptchaProof{LotNumber: "lot"})
	require.ErrorIs(t, err, ErrGeetestCaptchaVerificationFailed)
}
