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
	// 量化必须在指纹计算之后：指纹是请求幂等键，保持由原始金额派生可以避免
	// 升级前后同一 request_id 的重试算出不同指纹而被判为 fingerprint conflict。
	c.quantizeMonetaryFields()
}

// UsageBillingMonetaryScale 是所有计费金额的规范小数位数，
// 对齐 users.balance / api_keys.quota_used 的 NUMERIC(20,8)。
const UsageBillingMonetaryScale = 8

// quantizeMonetaryFields 把命令中的金额统一量化到 NUMERIC(20,8)。
//
// 不量化时，同一笔 ActualCost 会在两条方向相反的 SQL 上被 PostgreSQL 分别舍入：
//
//	balance    = balance - $1      // 存剩余额度，舍入的是「减法结果」
//	quota_used = quota_used + $1   // 存累计用量，舍入的是「加法结果」
//
// PostgreSQL 对 NUMERIC 采用 half-away-from-zero。当金额在第 9 位出现 half 边界
// （例：10 输入 token × 0.00000125 + 5 输出 token × 0.00001000，再乘分组倍率
// 1.25 = 0.000078125）时：
//
//	balance:    10000 - 0.000078125 = 9999.999921875 → 9999.99992188（delta 0.00007812）
//	quota_used:     0 + 0.000078125 =     0.000078125 →     0.00007813（delta 0.00007813）
//
// 两个 delta 相差 1e-8，且方向相反——余额少扣、Key 配额多记，随请求量线性累积，
// 使余额、API Key 配额与用量记录无法精确对账（需要 epsilon 比较才能勉强吻合）。
//
// 在参数进入 SQL 之前量化一次，两条语句就都拿到已经落在 8 位刻度上的同一个金额，
// 存储阶段不再发生任何舍入，delta 精确相等。
func (c *UsageBillingCommand) quantizeMonetaryFields() {
	c.BalanceCost = quantizeUsageBillingDecimal(c.BalanceCost)
	c.SubscriptionCost = quantizeUsageBillingDecimal(c.SubscriptionCost)
	c.APIKeyQuotaCost = quantizeUsageBillingDecimal(c.APIKeyQuotaCost)
	c.APIKeyRateLimitCost = quantizeUsageBillingDecimal(c.APIKeyRateLimitCost)
	c.AccountQuotaCost = quantizeUsageBillingDecimal(c.AccountQuotaCost)
}

func quantizeUsageBillingDecimal(v decimal.Decimal) decimal.Decimal {
	return v.Round(UsageBillingMonetaryScale)
}

// QuantizeUsageBillingAmount 把金额舍入到 UsageBillingMonetaryScale 位小数，
// 采用与 PostgreSQL NUMERIC 一致的 half-away-from-zero 规则。
//
// 走 decimal 而不是 math.Round(v*1e8)/1e8：后者在乘除过程中会引入额外的二进制
// 误差，边界值可能被推到错误的一侧。decimal.NewFromFloat 取 float64 的最短十进制
// 表示，正是 PostgreSQL 把 float8 参数转成 numeric 时所用的表示。
func QuantizeUsageBillingAmount(v float64) float64 {
	if v == 0 || math.IsNaN(v) || math.IsInf(v, 0) {
		return v
	}
	quantized, _ := decimal.NewFromFloat(v).Round(UsageBillingMonetaryScale).Float64()
	return quantized
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
