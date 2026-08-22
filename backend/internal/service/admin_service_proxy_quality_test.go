package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFinalizeProxyQualityResult_ScoreAndGrade(t *testing.T) {
	result := &ProxyQualityCheckResult{
		PassedCount:    2,
		WarnCount:      1,
		FailedCount:    1,
		ChallengeCount: 1,
	}

	finalizeProxyQualityResult(result)

	require.Equal(t, 38, result.Score)
	require.Equal(t, "F", result.Grade)
	require.Contains(t, result.Summary, "通过 2 项")
	require.Contains(t, result.Summary, "告警 1 项")
	require.Contains(t, result.Summary, "失败 1 项")
	require.Contains(t, result.Summary, "挑战 1 项")
}

func TestRunProxyQualityTarget_CloudflareChallenge(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Header().Set("cf-ray", "test-ray-123")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("<!DOCTYPE html><title>Just a moment...</title><script>window._cf_chl_opt={};</script>"))
	})

	target := proxyQualityTarget{
		Target: "openai",
		URL:    "https://proxy-fixture.test/openai",
		Method: http.MethodGet,
		AllowedStatuses: map[int]struct{}{
			http.StatusUnauthorized: {},
		},
	}

	item := runProxyQualityTarget(context.Background(), newProxyQualityFixtureHTTPClient(handler), target)
	require.Equal(t, "challenge", item.Status)
	require.Equal(t, http.StatusForbidden, item.HTTPStatus)
	require.Equal(t, "test-ray-123", item.CFRay)
}

func TestRunProxyQualityTarget_AllowedStatusPass(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"models":[]}`))
	})

	target := proxyQualityTarget{
		Target: "gemini",
		URL:    "https://proxy-fixture.test/gemini",
		Method: http.MethodGet,
		AllowedStatuses: map[int]struct{}{
			http.StatusOK: {},
		},
	}

	item := runProxyQualityTarget(context.Background(), newProxyQualityFixtureHTTPClient(handler), target)
	require.Equal(t, "pass", item.Status)
	require.Equal(t, http.StatusOK, item.HTTPStatus)
}

func TestRunProxyQualityTarget_AllowedStatusPassForUnauthorized(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	})

	target := proxyQualityTarget{
		Target: "openai",
		URL:    "https://proxy-fixture.test/openai",
		Method: http.MethodGet,
		AllowedStatuses: map[int]struct{}{
			http.StatusUnauthorized: {},
		},
	}

	item := runProxyQualityTarget(context.Background(), newProxyQualityFixtureHTTPClient(handler), target)
	require.Equal(t, "pass", item.Status)
	require.Equal(t, http.StatusUnauthorized, item.HTTPStatus)
	require.Contains(t, item.Message, "目标可达")
}

func TestProxyQualityTargets_IncludesGrok(t *testing.T) {
	var grokTarget *proxyQualityTarget
	for i := range proxyQualityTargets {
		if proxyQualityTargets[i].Target == "grok" {
			grokTarget = &proxyQualityTargets[i]
			break
		}
	}

	require.NotNil(t, grokTarget)
	require.Equal(t, "https://api.x.ai/v1/models", grokTarget.URL)
	require.Equal(t, http.MethodGet, grokTarget.Method)
	require.Contains(t, grokTarget.AllowedStatuses, http.StatusUnauthorized)
}

func TestRunProxyQualityTarget_GrokUnauthorizedPasses(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("unexpected method: %s", r.Method)
		}
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	})

	target := proxyQualityTarget{
		Target: "grok",
		URL:    "https://proxy-fixture.test/grok",
		Method: http.MethodGet,
		AllowedStatuses: map[int]struct{}{
			http.StatusUnauthorized: {},
		},
	}

	item := runProxyQualityTarget(context.Background(), newProxyQualityFixtureHTTPClient(handler), target)
	require.Equal(t, "grok", item.Target)
	require.Equal(t, "pass", item.Status)
	require.Equal(t, http.StatusUnauthorized, item.HTTPStatus)
	require.Contains(t, item.Message, "目标可达")
}

type proxyQualityFixtureRoundTripper func(*http.Request) (*http.Response, error)

func (f proxyQualityFixtureRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func newProxyQualityFixtureHTTPClient(handler http.Handler) *http.Client {
	return &http.Client{Transport: proxyQualityFixtureRoundTripper(func(req *http.Request) (*http.Response, error) {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		return recorder.Result(), nil
	})}
}
