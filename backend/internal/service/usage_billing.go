package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/shopspring/decimal"
)

var ErrUsageBillingRequestIDRequired = errors.New("usage billing request_id is required")
var ErrUsageBillingRequestConflict = errors.New("usage billing request fingerprint conflict")
var ErrUsageBillingReservationNotFound = errors.New("usage billing reservation was not found")
var ErrUsageBillingReservationReleased = errors.New("usage billing reservation has already been released")
var ErrUsageBillingReservationInvalidState = errors.New("usage billing reservation has invalid state")

var ErrSubscriptionQuotaExceeded = infraerrors.TooManyRequests(
	"SUBSCRIPTION_QUOTA_EXCEEDED",
	"subscription quota is insufficient for this request",
)

const (
	BillingSourceLegacy       = "legacy"
	BillingSourceWallet       = "wallet"
	BillingSourceSubscription = "subscription"
)

// UsageBillingCommand describes one billable request that must be applied at most once.
type UsageBillingCommand struct {
	RequestID          string
	APIKeyID           int64
	RequestFingerprint string
	RequestPayloadHash string

	UserID               int64
	AccountID            int64
	GroupID              *int64
	SubscriptionID       *int64
	AccountType          string
	Model                string
	ServiceTier          string
	ReasoningEffort      string
	BillingType          int8
	InputTokens          int
	OutputTokens         int
	CacheCreationTokens  int
	CacheReadTokens      int
	ImageCount           int
	MediaType            string
	BillingPreference    string
	ResolveBillingSource bool
	BillableCost         decimal.Decimal

	BalanceCost         decimal.Decimal
	SubscriptionCost    decimal.Decimal
	APIKeyQuotaCost     decimal.Decimal
	APIKeyRateLimitCost decimal.Decimal
	AccountQuotaCost    decimal.Decimal
}

func (c *UsageBillingCommand) Normalize() {
	if c == nil {
		return
	}
	c.RequestID = strings.TrimSpace(c.RequestID)
	if strings.TrimSpace(c.RequestFingerprint) == "" {
		c.RequestFingerprint = buildUsageBillingFingerprint(c)
	}
}

func buildUsageBillingFingerprint(c *UsageBillingCommand) string {
	if c == nil {
		return ""
	}
	raw := fmt.Sprintf(
		"%d|%d|%d|%d|%s|%s|%s|%s|%d|%d|%d|%d|%d|%d|%s|%d|%s|%t|%s|%s|%s|%s|%s|%s",
		c.UserID,
		c.AccountID,
		c.APIKeyID,
		valueOrZero(c.GroupID),
		strings.TrimSpace(c.AccountType),
		strings.TrimSpace(c.Model),
		strings.TrimSpace(c.ServiceTier),
		strings.TrimSpace(c.ReasoningEffort),
		c.BillingType,
		c.InputTokens,
		c.OutputTokens,
		c.CacheCreationTokens,
		c.CacheReadTokens,
		c.ImageCount,
		strings.TrimSpace(c.MediaType),
		valueOrZero(c.SubscriptionID),
		NormalizeBillingPreference(c.BillingPreference),
		c.ResolveBillingSource,
		canonicalBillingAmount(c.BillableCost),
		canonicalBillingAmount(c.BalanceCost),
		canonicalBillingAmount(c.SubscriptionCost),
		canonicalBillingAmount(c.APIKeyQuotaCost),
		canonicalBillingAmount(c.APIKeyRateLimitCost),
		canonicalBillingAmount(c.AccountQuotaCost),
	)
	if payloadHash := strings.TrimSpace(c.RequestPayloadHash); payloadHash != "" {
		raw += "|" + payloadHash
	}
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

const BillingAmountScale int32 = 10

// BillingAmountFromFloat is the explicit boundary between the legacy pricing
// engine and final account settlement. All comparisons and arithmetic after
// this conversion use decimal values matching the database scale.
func BillingAmountFromFloat(value float64) decimal.Decimal {
	if math.IsNaN(value) || math.IsInf(value, 0) || value == 0 {
		return decimal.Zero
	}
	return decimal.NewFromFloat(value).Round(BillingAmountScale)
}

func canonicalBillingAmount(value decimal.Decimal) string {
	return value.Round(BillingAmountScale).StringFixed(BillingAmountScale)
}

func HashUsageRequestPayload(payload []byte) string {
	if len(payload) == 0 {
		return ""
	}
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func valueOrZero(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

// AccountQuotaState holds the post-increment quota state returned by the DB transaction.
// All values are post-update (i.e., already include the increment).
type AccountQuotaState struct {
	TotalUsed   float64
	TotalLimit  float64
	DailyUsed   float64
	DailyLimit  float64
	WeeklyUsed  float64
	WeeklyLimit float64
}

type UsageBillingApplyResult struct {
	Applied               bool
	APIKeyQuotaExhausted  bool
	BillingSource         string
	BillingPreference     string
	BillingFallbackReason string
	SubscriptionID        *int64
	NewBalance            *decimal.Decimal   // post-deduction balance (nil = no balance deduction)
	BalanceOverdrafted    bool               // true when the sufficient-balance guard missed and debt was still recorded
	QuotaState            *AccountQuotaState // post-increment quota state (nil = no quota increment)
}

// UsageBillingReservationCommand reserves the maximum expected charge before
// an upstream request starts. The actual charge is supplied later through
// UsageBillingCommand and settled by Apply using the same request key.
type UsageBillingReservationCommand struct {
	RequestID          string
	APIKeyID           int64
	RequestFingerprint string
	RequestPayloadHash string
	UserID             int64
	GroupID            *int64
	EstimatedAmount    decimal.Decimal
	LeaseOwner         string
	LeaseDurationSecs  int
}

func (c *UsageBillingReservationCommand) Normalize() {
	if c == nil {
		return
	}
	c.RequestID = strings.TrimSpace(c.RequestID)
	c.RequestPayloadHash = strings.TrimSpace(c.RequestPayloadHash)
	c.LeaseOwner = strings.TrimSpace(c.LeaseOwner)
	c.EstimatedAmount = c.EstimatedAmount.Round(BillingAmountScale)
	if c.EstimatedAmount.IsNegative() {
		c.EstimatedAmount = decimal.Zero
	}
	if strings.TrimSpace(c.RequestFingerprint) == "" {
		c.RequestFingerprint = buildUsageBillingReservationFingerprint(c)
	}
}

// UsageBillingReservationRebindCommand atomically moves a pending request
// reservation to another real routing group. This is used by the Claude
// prompt-too-long fallback path, where routing and pricing both change before
// the upstream retry starts.
type UsageBillingReservationRebindCommand struct {
	RequestID          string
	APIKeyID           int64
	RequestFingerprint string
	RequestPayloadHash string
	UserID             int64
	ExpectedGroupID    *int64
	GroupID            *int64
	EstimatedAmount    decimal.Decimal
	LeaseOwner         string
	LeaseDurationSecs  int
}

func (c *UsageBillingReservationRebindCommand) Normalize() {
	if c == nil {
		return
	}
	c.RequestID = strings.TrimSpace(c.RequestID)
	c.RequestPayloadHash = strings.TrimSpace(c.RequestPayloadHash)
	c.LeaseOwner = strings.TrimSpace(c.LeaseOwner)
	c.EstimatedAmount = c.EstimatedAmount.Round(BillingAmountScale)
	if c.EstimatedAmount.IsNegative() {
		c.EstimatedAmount = decimal.Zero
	}
	if strings.TrimSpace(c.RequestFingerprint) == "" {
		c.RequestFingerprint = buildUsageBillingReservationFingerprint(&UsageBillingReservationCommand{
			RequestID:          c.RequestID,
			APIKeyID:           c.APIKeyID,
			RequestPayloadHash: c.RequestPayloadHash,
			UserID:             c.UserID,
			GroupID:            c.GroupID,
			EstimatedAmount:    c.EstimatedAmount,
		})
	}
}

func buildUsageBillingReservationFingerprint(c *UsageBillingReservationCommand) string {
	if c == nil {
		return ""
	}
	raw := fmt.Sprintf(
		"%d|%d|%d|%s|%s",
		c.UserID,
		c.APIKeyID,
		valueOrZero(c.GroupID),
		canonicalBillingAmount(c.EstimatedAmount),
		strings.TrimSpace(c.RequestPayloadHash),
	)
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

type UsageBillingReservationReleaseCommand struct {
	RequestID          string
	APIKeyID           int64
	UserID             int64
	RequestPayloadHash string
}

type UsageBillingReservationHeartbeatCommand struct {
	RequestID         string
	APIKeyID          int64
	LeaseOwner        string
	LeaseDurationSecs int
}

func (c *UsageBillingReservationHeartbeatCommand) Normalize() {
	if c == nil {
		return
	}
	c.RequestID = strings.TrimSpace(c.RequestID)
	c.LeaseOwner = strings.TrimSpace(c.LeaseOwner)
}

func (c *UsageBillingReservationReleaseCommand) Normalize() {
	if c == nil {
		return
	}
	c.RequestID = strings.TrimSpace(c.RequestID)
	c.RequestPayloadHash = strings.TrimSpace(c.RequestPayloadHash)
}

type UsageBillingReservationResult struct {
	Applied               bool
	Status                string
	BillingSource         string
	BillingPreference     string
	BillingFallbackReason string
	SubscriptionID        *int64
	GroupID               *int64
	ReservedAmount        decimal.Decimal
	FinalAmount           decimal.Decimal
	NewBalance            *decimal.Decimal
	FrozenBalance         *decimal.Decimal
	LeaseOwner            string
}

// BatchImageBalanceHoldCommand describes an idempotent balance hold operation.
type BatchImageBalanceHoldCommand struct {
	RequestID            string
	APIKeyID             int64
	RequestFingerprint   string
	RequestPayloadHash   string
	UserID               int64
	GroupID              *int64
	BatchID              string
	HoldAmount           decimal.Decimal
	ActualAmount         decimal.Decimal
	ResolveBillingSource bool
}

func (c *BatchImageBalanceHoldCommand) Normalize() {
	if c == nil {
		return
	}
	c.RequestID = strings.TrimSpace(c.RequestID)
	c.BatchID = strings.TrimSpace(c.BatchID)
	if strings.TrimSpace(c.RequestFingerprint) == "" {
		c.RequestFingerprint = buildBatchImageBalanceHoldFingerprint(c)
	}
}

func buildBatchImageBalanceHoldFingerprint(c *BatchImageBalanceHoldCommand) string {
	if c == nil {
		return ""
	}
	raw := fmt.Sprintf(
		"%d|%d|%d|%s|%s|%s|%t",
		c.UserID,
		c.APIKeyID,
		valueOrZero(c.GroupID),
		strings.TrimSpace(c.BatchID),
		canonicalBillingAmount(c.HoldAmount),
		canonicalBillingAmount(c.ActualAmount),
		c.ResolveBillingSource,
	)
	if payloadHash := strings.TrimSpace(c.RequestPayloadHash); payloadHash != "" {
		raw += "|" + payloadHash
	}
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

type BatchImageBalanceHoldResult struct {
	Applied               bool
	BillingSource         string
	BillingPreference     string
	BillingFallbackReason string
	SubscriptionID        *int64
	GroupID               *int64
	NewBalance            *decimal.Decimal
	FrozenBalance         *decimal.Decimal
}

type UsageBillingRepository interface {
	Apply(ctx context.Context, cmd *UsageBillingCommand) (*UsageBillingApplyResult, error)
	ReserveBatchImageBalance(ctx context.Context, cmd *BatchImageBalanceHoldCommand) (*BatchImageBalanceHoldResult, error)
	CaptureBatchImageBalance(ctx context.Context, cmd *BatchImageBalanceHoldCommand) (*BatchImageBalanceHoldResult, error)
	ReleaseBatchImageBalance(ctx context.Context, cmd *BatchImageBalanceHoldCommand) (*BatchImageBalanceHoldResult, error)
}

// UsageBillingReservationRepository is an additive capability implemented by
// the SQL repository. Keeping it separate preserves compatibility with legacy
// UsageBillingRepository stubs and custom implementations while the feature is
// behind its rollout flag.
type UsageBillingReservationRepository interface {
	ReserveRequestBilling(ctx context.Context, cmd *UsageBillingReservationCommand) (*UsageBillingReservationResult, error)
	RebindRequestBilling(ctx context.Context, cmd *UsageBillingReservationRebindCommand) (*UsageBillingReservationResult, error)
	ReleaseRequestBilling(ctx context.Context, cmd *UsageBillingReservationReleaseCommand) (*UsageBillingReservationResult, error)
	HeartbeatRequestBilling(ctx context.Context, cmd *UsageBillingReservationHeartbeatCommand) (bool, error)
	ReleaseExpiredRequestBilling(ctx context.Context, batchSize int) (int, error)
}
