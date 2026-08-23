package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

var (
	ErrGeetestCaptchaVerificationFailed  = infraerrors.BadRequest("GEETEST_CAPTCHA_VERIFICATION_FAILED", "geetest captcha verification failed")
	ErrGeetestCaptchaNotConfigured       = infraerrors.ServiceUnavailable("GEETEST_CAPTCHA_NOT_CONFIGURED", "geetest captcha not configured")
	ErrGeetestCaptchaProviderUnavailable = errors.New("geetest captcha provider unavailable")
)

// GeetestCaptchaProof is the proof returned by the GT4 browser challenge.
// All fields are required by the server-side validate endpoint.
type GeetestCaptchaProof struct {
	LotNumber     string `json:"lot_number"`
	CaptchaOutput string `json:"captcha_output"`
	PassToken     string `json:"pass_token"`
	GenTime       string `json:"gen_time"`
}

// GeetestCaptchaCredentials identifies a GT4 captcha application.
type GeetestCaptchaCredentials struct {
	CaptchaID  string
	CaptchaKey string
}

// GeetestCaptchaVerifyResponse is the normalized GT4 response.
type GeetestCaptchaVerifyResponse struct {
	Result string `json:"result"`
	Reason string `json:"reason"`
}

// GeetestCaptchaHTTPClient is the subset of http.Client used by the verifier.
// It allows listener-free tests with a custom RoundTripper.
type GeetestCaptchaHTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

const geetestCaptchaValidateEndpoint = "https://gcaptcha4.geetest.com/validate"

// GeetestCaptchaValidateEndpoint is the provider's GT4 validation URL.
const GeetestCaptchaValidateEndpoint = geetestCaptchaValidateEndpoint

// GeetestCaptchaService performs GT4 server-side verification.
type GeetestCaptchaService struct {
	Credentials GeetestCaptchaCredentials
	HTTPClient  GeetestCaptchaHTTPClient
	// Endpoint is injectable for tests; leave empty to use the Geetest endpoint.
	Endpoint string
	replay   *geetestReplayStore
}

type geetestReplayStore struct {
	mu     sync.Mutex
	values map[string]time.Time
}

// NewGeetestCaptchaService accepts the canonical (credentials, client) pair.
// For compatibility with callers that inject the client first, the arguments
// are intentionally interface-typed; unsupported values simply leave the
// service unconfigured and are reported by Verify.
func NewGeetestCaptchaService(first interface{}, rest ...interface{}) *GeetestCaptchaService {
	var credentials GeetestCaptchaCredentials
	var client GeetestCaptchaHTTPClient
	assign := func(v interface{}) {
		switch x := v.(type) {
		case GeetestCaptchaCredentials:
			credentials = x
		case *GeetestCaptchaCredentials:
			if x != nil {
				credentials = *x
			}
		case GeetestCaptchaHTTPClient:
			client = x
		case string:
			if credentials.CaptchaID == "" {
				credentials.CaptchaID = x
			} else if credentials.CaptchaKey == "" {
				credentials.CaptchaKey = x
			}
		}
	}
	assign(first)
	for _, v := range rest {
		assign(v)
	}
	if client == nil {
		client = http.DefaultClient
	}
	return &GeetestCaptchaService{Credentials: credentials, HTTPClient: client, replay: &geetestReplayStore{values: make(map[string]time.Time)}}
}

func NewGeetestCaptchaServiceWithClient(credentials GeetestCaptchaCredentials, client GeetestCaptchaHTTPClient) *GeetestCaptchaService {
	return NewGeetestCaptchaService(credentials, client)
}

// SignToken computes the GT4 sign_token: lowercase hex HMAC-SHA256(lot_number,
// captcha_key).
func GeetestSignToken(lotNumber, captchaKey string) string {
	m := hmac.New(sha256.New, []byte(captchaKey))
	_, _ = m.Write([]byte(lotNumber))
	return hex.EncodeToString(m.Sum(nil))
}

// GenerateGeetestSignToken is an alias retained for callers that prefer a
// verb-style helper name.
func GenerateGeetestSignToken(lotNumber, captchaKey string) string {
	return GeetestSignToken(lotNumber, captchaKey)
}

// Verify validates one GT4 proof. It fails closed for malformed proof,
// transport/HTTP/JSON errors, and any response whose result is not success.
func (s *GeetestCaptchaService) Verify(ctx context.Context, proof GeetestCaptchaProof) error {
	_, err := s.VerifyWithResponse(ctx, proof)
	return err
}

// IsGeetestCaptchaProviderUnavailable reports failures where GT4 could not be
// reached or returned an unusable response. Callers may apply the documented
// fail-open policy for these failures while still rejecting malformed proofs.
func IsGeetestCaptchaProviderUnavailable(err error) bool {
	return errors.Is(err, ErrGeetestCaptchaProviderUnavailable)
}

func (s *GeetestCaptchaService) VerifyProof(ctx context.Context, proof GeetestCaptchaProof) error {
	return s.Verify(ctx, proof)
}

// VerifyWithResponse is Verify with the provider response returned on success
// (and on a provider-level rejection). The response is nil for local/request
// errors.
func (s *GeetestCaptchaService) VerifyWithResponse(ctx context.Context, proof GeetestCaptchaProof) (*GeetestCaptchaVerifyResponse, error) {
	if s == nil || strings.TrimSpace(s.Credentials.CaptchaID) == "" || strings.TrimSpace(s.Credentials.CaptchaKey) == "" || s.HTTPClient == nil {
		return nil, ErrGeetestCaptchaNotConfigured
	}
	proof.LotNumber = strings.TrimSpace(proof.LotNumber)
	proof.CaptchaOutput = strings.TrimSpace(proof.CaptchaOutput)
	proof.PassToken = strings.TrimSpace(proof.PassToken)
	proof.GenTime = strings.TrimSpace(proof.GenTime)
	if proof.LotNumber == "" || proof.CaptchaOutput == "" || proof.PassToken == "" || proof.GenTime == "" {
		return nil, ErrGeetestCaptchaVerificationFailed
	}
	// GT4 pass_token/lot_number proofs are one-time. Keep a short-lived local
	// replay fence; deployments with multiple instances should additionally
	// back this with a shared cache at the edge.
	if s.replay != nil {
		now := time.Now()
		s.replay.mu.Lock()
		for lot, timestamp := range s.replay.values {
			if now.Sub(timestamp) >= 10*time.Minute {
				delete(s.replay.values, lot)
			}
		}
		if previous, loaded := s.replay.values[proof.LotNumber]; loaded && now.Sub(previous) < 10*time.Minute {
			s.replay.mu.Unlock()
			return nil, ErrGeetestCaptchaVerificationFailed
		}
		if len(s.replay.values) >= 10_000 {
			s.replay.values = make(map[string]time.Time)
		}
		s.replay.values[proof.LotNumber] = now
		s.replay.mu.Unlock()
	}

	endpoint := s.Endpoint
	if strings.TrimSpace(endpoint) == "" {
		endpoint = geetestCaptchaValidateEndpoint
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid endpoint: %v", ErrGeetestCaptchaVerificationFailed, err)
	}
	q := u.Query()
	q.Set("captcha_id", strings.TrimSpace(s.Credentials.CaptchaID))
	u.RawQuery = q.Encode()

	form := url.Values{}
	form.Set("lot_number", proof.LotNumber)
	form.Set("captcha_output", proof.CaptchaOutput)
	form.Set("pass_token", proof.PassToken)
	form.Set("gen_time", proof.GenTime)
	form.Set("sign_token", GeetestSignToken(proof.LotNumber, s.Credentials.CaptchaKey))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("%w: build request: %v", ErrGeetestCaptchaVerificationFailed, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, errors.Join(ErrGeetestCaptchaVerificationFailed, ErrGeetestCaptchaProviderUnavailable, fmt.Errorf("request failed: %w", err))
	}
	if resp == nil {
		return nil, errors.Join(ErrGeetestCaptchaVerificationFailed, ErrGeetestCaptchaProviderUnavailable, errors.New("empty response"))
	}
	if resp.Body == nil {
		return nil, errors.Join(ErrGeetestCaptchaVerificationFailed, ErrGeetestCaptchaProviderUnavailable, errors.New("empty response body"))
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, errors.Join(ErrGeetestCaptchaVerificationFailed, ErrGeetestCaptchaProviderUnavailable, fmt.Errorf("read response: %w", err))
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, errors.Join(ErrGeetestCaptchaVerificationFailed, ErrGeetestCaptchaProviderUnavailable, fmt.Errorf("http status %d", resp.StatusCode))
	}
	var result GeetestCaptchaVerifyResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, errors.Join(ErrGeetestCaptchaVerificationFailed, ErrGeetestCaptchaProviderUnavailable, fmt.Errorf("decode response: %w", err))
	}
	if !strings.EqualFold(strings.TrimSpace(result.Result), "success") {
		return &result, ErrGeetestCaptchaVerificationFailed
	}
	return &result, nil
}

// VerifyWithCredentials is a convenience for callers that keep credentials
// outside the service instance.
func (s *GeetestCaptchaService) VerifyWithCredentials(ctx context.Context, credentials GeetestCaptchaCredentials, proof GeetestCaptchaProof) error {
	if s == nil {
		return ErrGeetestCaptchaNotConfigured
	}
	clone := *s
	clone.Credentials = credentials
	return clone.Verify(ctx, proof)
}

// VerifyChallenge is a descriptive alias for VerifyWithCredentials.
func (s *GeetestCaptchaService) VerifyChallenge(ctx context.Context, credentials GeetestCaptchaCredentials, proof GeetestCaptchaProof) error {
	return s.VerifyWithCredentials(ctx, credentials, proof)
}

// Validate is an alias for Verify.
func (s *GeetestCaptchaService) Validate(ctx context.Context, proof GeetestCaptchaProof) error {
	return s.Verify(ctx, proof)
}
