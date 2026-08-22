package securityaudit

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeBaseURLAllowsAdministratorConfiguredDestinations(t *testing.T) {
	allowed := []string{
		"https://guard.example.com", "https://guard.example.com/v1", "http://guard.example.com",
		"http://127.0.0.1:8080", "http://10.0.0.8:8080", "https://172.16.0.5",
		"http://169.254.169.254", "https://metadata.google.internal", "https://192.0.2.1",
		"http://internal-admin.local", "http://guard.local:8080",
	}
	for _, raw := range allowed {
		_, err := NormalizeBaseURL(raw)
		require.NoError(t, err, raw)
	}
	blocked := []string{
		"ftp://guard.example.com", "https://user:pass@guard.example.com",
		"https://guard.example.com?q=secret", "https://guard.example.com/#fragment",
	}
	for _, raw := range blocked {
		_, err := NormalizeBaseURL(raw)
		require.Error(t, err, raw)
	}
	url, err := ChatCompletionsURL("https://guard.example.com/v1")
	require.NoError(t, err)
	require.Equal(t, "https://guard.example.com/v1/chat/completions", url)
}

func TestHTTPClientUsesDirectStandardDialer(t *testing.T) {
	client, err := NewSecureHTTPClient(ActiveEndpoint{BaseURL: "https://guard.example.com", TimeoutMS: 1000})
	require.NoError(t, err)
	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)
	require.Nil(t, transport.Proxy)
	require.NotNil(t, transport.DialContext)
}

func TestOpenAICompatibleScannerRequestContract(t *testing.T) {
	endpoint := ActiveEndpoint{ID: "one", BaseURL: "http://fixture.securityaudit", Model: DefaultGuardModel, Token: "token", TimeoutMS: 1000}
	scanner := newSecurityAuditFixtureScanner(endpoint, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/chat/completions", r.URL.Path)
		require.Equal(t, "Bearer token", r.Header.Get("Authorization"))
		var payload map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		require.Equal(t, DefaultGuardModel, payload["model"])
		require.Equal(t, float64(0), payload["temperature"])
		require.Equal(t, float64(64), payload["max_tokens"])
		require.Equal(t, float64(42), payload["seed"])
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Safety: Safe\nCategories: None"}}]}`))
	}))
	result, err := scanner.Scan(context.Background(), endpoint, "hello", AllScannerIDs)
	require.NoError(t, err)
	require.Equal(t, EventPass, result.Decision)
}

func TestOpenAICompatibleScannerFollowsRedirectAndRejectsOversize(t *testing.T) {
	redirectEndpoint := ActiveEndpoint{ID: "redirect", BaseURL: "http://redirect.securityaudit", Model: DefaultGuardModel, TimeoutMS: 1000}
	redirectScanner := newSecurityAuditFixtureScanner(redirectEndpoint, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Host == "redirect.securityaudit" {
			http.Redirect(w, r, "http://target.securityaudit/v1/chat/completions", http.StatusFound)
			return
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Safety: Safe\nCategories: None"}}]}`))
	}))
	result, err := redirectScanner.Scan(context.Background(), redirectEndpoint, "hello", AllScannerIDs)
	require.NoError(t, err)
	require.Equal(t, EventPass, result.Decision)
	oversizeEndpoint := ActiveEndpoint{ID: "large", BaseURL: "http://oversize.securityaudit", Model: DefaultGuardModel, TimeoutMS: 1000}
	oversizeScanner := newSecurityAuditFixtureScanner(oversizeEndpoint, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", int(maxGuardResponseBytes)+1)))
	}))
	_, err = oversizeScanner.Scan(context.Background(), oversizeEndpoint, "hello", AllScannerIDs)
	require.Error(t, err)
}

func TestOpenAICompatibleScannerClassifiesHTTPConnectionAndTimeoutFailures(t *testing.T) {
	tests := []struct {
		name      string
		status    int
		retryable bool
	}{
		{name: "authentication", status: http.StatusUnauthorized, retryable: false},
		{name: "forbidden", status: http.StatusForbidden, retryable: false},
		{name: "rate limited", status: http.StatusTooManyRequests, retryable: true},
		{name: "server failure", status: http.StatusBadGateway, retryable: true},
		{name: "other client error", status: http.StatusBadRequest, retryable: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			endpoint := ActiveEndpoint{ID: "status-" + tt.name, BaseURL: "http://status.securityaudit", Model: DefaultGuardModel, TimeoutMS: 1000}
			scanner := newSecurityAuditFixtureScanner(endpoint, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.status)
			}))
			_, err := scanner.Scan(context.Background(), endpoint, "hello", AllScannerIDs)
			var guardErr *GuardError
			require.ErrorAs(t, err, &guardErr)
			require.Equal(t, ErrorCodeUnavailable, guardErr.Code)
			require.Equal(t, tt.status, guardErr.HTTPStatus)
			require.Equal(t, tt.retryable, guardErr.Retryable)
			require.NotContains(t, err.Error(), endpoint.BaseURL)
		})
	}

	closedEndpoint := ActiveEndpoint{ID: "closed", BaseURL: "http://closed.securityaudit", Model: DefaultGuardModel, TimeoutMS: 100}
	closedScanner := newSecurityAuditFixtureErrorScanner(closedEndpoint, fmt.Errorf("connection closed"))
	_, err := closedScanner.Scan(context.Background(), closedEndpoint, "hello", AllScannerIDs)
	var connectionErr *GuardError
	require.ErrorAs(t, err, &connectionErr)
	require.True(t, connectionErr.Retryable)

	timeoutEndpoint := ActiveEndpoint{ID: "timeout", BaseURL: "http://timeout.securityaudit", Model: DefaultGuardModel, TimeoutMS: 20}
	timeoutScanner := newSecurityAuditFixtureErrorScanner(timeoutEndpoint, context.DeadlineExceeded)
	_, err = timeoutScanner.Scan(context.Background(), timeoutEndpoint, "hello", AllScannerIDs)
	var timeoutErr *GuardError
	require.ErrorAs(t, err, &timeoutErr)
	require.True(t, timeoutErr.Retryable)
	require.True(t, timeoutErr.Timeout)
}

func TestPromptAuditProbeModelsFallbackAndResponseSafety(t *testing.T) {
	t.Run("models contains configured model", func(t *testing.T) {
		var chatCalls atomic.Int64
		server := newSecurityAuditTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, "Bearer temporary-token", r.Header.Get("Authorization"))
			if r.URL.Path == "/v1/models" {
				_, _ = w.Write([]byte(`{"data":[{"id":"` + DefaultGuardModel + `"}]}`))
				return
			}
			chatCalls.Add(1)
		}))
		defer server.Close()
		result := newProbeTestService().Probe(context.Background(), ProbeRequest{Endpoint: probeEndpoint(server.URL, "temporary-token")})
		require.True(t, result.OK)
		require.True(t, result.TokenApplied)
		require.Equal(t, http.StatusOK, result.HTTPStatus)
		require.Zero(t, chatCalls.Load())
	})

	t.Run("invalid models response performs real guard fallback", func(t *testing.T) {
		var chatCalls atomic.Int64
		server := newSecurityAuditTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/v1/models" {
				_, _ = w.Write([]byte(`{"unexpected":true}`))
				return
			}
			chatCalls.Add(1)
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Safety: Safe\nCategories: None"}}]}`))
		}))
		defer server.Close()
		result := newProbeTestService().Probe(context.Background(), ProbeRequest{Endpoint: probeEndpoint(server.URL, "temporary-token")})
		require.True(t, result.OK)
		require.Equal(t, int64(1), chatCalls.Load())
	})

	t.Run("fallback authentication failure is stable", func(t *testing.T) {
		server := newSecurityAuditTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/v1/models" {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusUnauthorized)
		}))
		defer server.Close()
		result := newProbeTestService().Probe(context.Background(), ProbeRequest{Endpoint: probeEndpoint(server.URL, "temporary-token")})
		require.False(t, result.OK)
		require.Equal(t, ErrorCodeUnavailable, result.ErrorCode)
		require.Equal(t, http.StatusUnauthorized, result.HTTPStatus)
		require.False(t, result.Retryable)
	})

	t.Run("oversized models response is rejected without fallback", func(t *testing.T) {
		var chatCalls atomic.Int64
		server := newSecurityAuditTestServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/v1/models" {
				chatCalls.Add(1)
			}
			_, _ = w.Write([]byte(strings.Repeat("x", int(maxGuardResponseBytes)+1)))
		}))
		defer server.Close()
		result := newProbeTestService().Probe(context.Background(), ProbeRequest{Endpoint: probeEndpoint(server.URL, "temporary-token")})
		require.False(t, result.OK)
		require.Equal(t, "response_too_large", result.ErrorCode)
		require.Zero(t, chatCalls.Load())
	})
}

func TestResolveProbeEndpointReusesTokenOnlyForMatchingBaseURL(t *testing.T) {
	manager := &ConfigManager{}
	manager.snapshot.Store(&activeConfigSnapshot{active: ActiveConfig{Endpoints: []ActiveEndpoint{{
		ID: "guard-1", BaseURL: "https://guard.example.com", Token: "STORED_GUARD_TOKEN", TimeoutMS: 1000, InputLimit: 1024, Enabled: true,
	}}}})
	service := &PromptService{config: manager}

	matched, applied, err := service.resolveProbeEndpoint(UpdateEndpoint{
		ID: "guard-1", BaseURL: "https://guard.example.com/v1", TimeoutMS: 1000, InputLimit: 1024,
	})
	require.NoError(t, err)
	require.True(t, applied)
	require.Equal(t, "STORED_GUARD_TOKEN", matched.Token)

	mismatched, applied, err := service.resolveProbeEndpoint(UpdateEndpoint{
		ID: "guard-1", BaseURL: "https://attacker.example.com", TimeoutMS: 1000, InputLimit: 1024,
	})
	require.NoError(t, err)
	require.False(t, applied)
	require.Empty(t, mismatched.Token)
}

func newProbeTestService() *PromptService {
	return &PromptService{
		config: &ConfigManager{}, scanner: NewOpenAICompatibleScanner(), clock: realClock{},
		probes: map[string]ProbeResult{},
	}
}

func probeEndpoint(baseURL, token string) UpdateEndpoint {
	return UpdateEndpoint{
		ID: "probe-one", Name: "Probe One", Protocol: "openai_compatible", BaseURL: baseURL,
		Model: DefaultGuardModel, Token: token, TimeoutMS: 1000, InputLimit: 1024, Enabled: true,
	}
}

type securityAuditRoundTripper func(*http.Request) (*http.Response, error)

func (f securityAuditRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func newSecurityAuditFixtureScanner(endpoint ActiveEndpoint, handler http.Handler) *OpenAICompatibleScanner {
	scanner := NewOpenAICompatibleScanner()
	scanner.clients.Store(fmt.Sprintf("%s|%s|%d", endpoint.ID, endpoint.BaseURL, endpoint.TimeoutMS), &http.Client{
		Transport: securityAuditRoundTripper(func(req *http.Request) (*http.Response, error) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			return recorder.Result(), nil
		}),
	})
	return scanner
}

func newSecurityAuditFixtureErrorScanner(endpoint ActiveEndpoint, fixtureErr error) *OpenAICompatibleScanner {
	scanner := NewOpenAICompatibleScanner()
	scanner.clients.Store(fmt.Sprintf("%s|%s|%d", endpoint.ID, endpoint.BaseURL, endpoint.TimeoutMS), &http.Client{
		Transport: securityAuditRoundTripper(func(*http.Request) (*http.Response, error) {
			return nil, fixtureErr
		}),
	})
	return scanner
}

func newSecurityAuditTestServer(tb testing.TB, handler http.Handler) *httptest.Server {
	tb.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		tb.Skipf("local listeners are not permitted in this environment: %v", err)
	}
	_ = listener.Close()
	return httptest.NewServer(handler)
}
