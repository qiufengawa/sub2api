package service

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/pkg/timezone"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"github.com/tidwall/gjson"
	"go.uber.org/zap"
)

const (
	requestReservationInputOverheadTokens  = 4096
	requestReservationFallbackOutputTokens = 4096
	defaultRequestReservationLeaseSeconds  = 900
	defaultRequestReservationHeartbeatSecs = 60
)

type RequestBillingEstimateKind string

const (
	RequestBillingEstimateToken     RequestBillingEstimateKind = "token"
	RequestBillingEstimateImage     RequestBillingEstimateKind = "image"
	RequestBillingEstimateVideo     RequestBillingEstimateKind = "video"
	RequestBillingEstimateWebSearch RequestBillingEstimateKind = "web_search"
)

type RequestBillingEstimate struct {
	Kind            RequestBillingEstimateKind
	Model           string
	Body            []byte
	RequestCount    int
	SizeTier        string
	Resolution      string
	DurationSeconds int
	NoOutputTokens  bool
	WebSearchCalls  int
}

type RequestBillingReservationHandle struct {
	mu         sync.Mutex
	repo       UsageBillingReservationRepository
	releaseCmd UsageBillingReservationReleaseCommand
	groupID    *int64
	leaseOwner string
	heartbeat  context.CancelFunc
	reserved   bool
	settle     bool
	closed     bool
}

func (h *RequestBillingReservationHandle) Reserved() bool {
	if h == nil {
		return false
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.reserved
}

// MarkForSettlement transfers release ownership to the normal usage-record
// path. Keep renewing the lease until UsageBillingRepository.Apply moves the
// reservation out of pending; the heartbeat then observes the terminal state
// and exits. Stopping it when a task is merely queued lets cleanup release a
// successful request before the asynchronous settlement runs.
func (h *RequestBillingReservationHandle) MarkForSettlement() {
	if h == nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed || !h.reserved {
		return
	}
	h.settle = true
}

// Close releases a pending reservation unless a successful request has been
// handed to the usage-record settlement path.
func (h *RequestBillingReservationHandle) Close(ctx context.Context) {
	if h == nil {
		return
	}
	h.mu.Lock()
	if !h.reserved || h.settle || h.closed || h.repo == nil {
		h.mu.Unlock()
		return
	}
	h.closed = true
	if h.heartbeat != nil {
		h.heartbeat()
		h.heartbeat = nil
	}
	repo := h.repo
	releaseCmd := h.releaseCmd
	h.mu.Unlock()

	releaseCtx, cancel := detachedBillingContext(ctx)
	defer cancel()
	if _, err := repo.ReleaseRequestBilling(releaseCtx, &releaseCmd); err != nil {
		logger.L().Warn("usage_billing.request_reservation_release_failed",
			zap.String("request_id", releaseCmd.RequestID),
			zap.Int64("api_key_id", releaseCmd.APIKeyID),
			zap.Error(err),
		)
	}
}

func (h *RequestBillingReservationHandle) rebind(
	ctx context.Context,
	userID int64,
	apiKeyID int64,
	groupID *int64,
	estimatedAmount decimal.Decimal,
	payloadHash string,
	leaseDurationSeconds int,
) error {
	if h == nil {
		return nil
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.reserved || h.settle || h.closed || h.repo == nil {
		return nil
	}
	if h.releaseCmd.APIKeyID != apiKeyID || h.releaseCmd.UserID != userID {
		return ErrUsageBillingRequestConflict
	}
	cmd := &UsageBillingReservationRebindCommand{
		RequestID:          h.releaseCmd.RequestID,
		APIKeyID:           apiKeyID,
		RequestPayloadHash: strings.TrimSpace(payloadHash),
		UserID:             userID,
		ExpectedGroupID:    cloneOptionalInt64(h.groupID),
		GroupID:            cloneOptionalInt64(groupID),
		EstimatedAmount:    estimatedAmount,
		LeaseOwner:         h.leaseOwner,
		LeaseDurationSecs:  leaseDurationSeconds,
	}
	result, err := h.repo.RebindRequestBilling(ctx, cmd)
	if err != nil {
		return err
	}
	if result != nil {
		h.groupID = cloneOptionalInt64(result.GroupID)
		if owner := strings.TrimSpace(result.LeaseOwner); owner != "" {
			h.leaseOwner = owner
		}
	} else {
		h.groupID = cloneOptionalInt64(groupID)
	}
	return nil
}

func (h *RequestBillingReservationHandle) startHeartbeat(interval time.Duration, leaseDurationSeconds int) {
	if h == nil || interval <= 0 || leaseDurationSeconds <= 0 {
		return
	}
	h.mu.Lock()
	if !h.reserved || h.settle || h.closed || h.repo == nil || strings.TrimSpace(h.leaseOwner) == "" {
		h.mu.Unlock()
		return
	}
	heartbeatCtx, cancel := context.WithCancel(context.Background())
	h.heartbeat = cancel
	repo := h.repo
	cmd := UsageBillingReservationHeartbeatCommand{
		RequestID:         h.releaseCmd.RequestID,
		APIKeyID:          h.releaseCmd.APIKeyID,
		LeaseOwner:        h.leaseOwner,
		LeaseDurationSecs: leaseDurationSeconds,
	}
	h.mu.Unlock()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-heartbeatCtx.Done():
				return
			case <-ticker.C:
				updateCtx, updateCancel := context.WithTimeout(context.Background(), 10*time.Second)
				active, err := repo.HeartbeatRequestBilling(updateCtx, &cmd)
				updateCancel()
				if err != nil {
					logger.L().Warn("usage_billing.request_reservation_heartbeat_failed",
						zap.String("request_id", cmd.RequestID),
						zap.Int64("api_key_id", cmd.APIKeyID),
						zap.Error(err),
					)
					continue
				}
				if !active {
					return
				}
			}
		}
	}()
}

func cloneOptionalInt64(value *int64) *int64 {
	if value == nil {
		return nil
	}
	copyValue := *value
	return &copyValue
}

func (s *GatewayService) ReserveRequestBilling(ctx context.Context, user *User, apiKey *APIKey, estimate RequestBillingEstimate, payloadHash string) (*RequestBillingReservationHandle, error) {
	if s == nil {
		return &RequestBillingReservationHandle{}, nil
	}
	multiplier, mediaMultiplier := s.requestReservationMultipliers(ctx, user, apiKey)
	return reserveGatewayRequestBilling(ctx, s.cfg, s.usageBillingRepo, s.billingService, s.resolver, user, apiKey, estimate, payloadHash, multiplier, mediaMultiplier)
}

func (s *GatewayService) RebindRequestBilling(ctx context.Context, handle *RequestBillingReservationHandle, user *User, apiKey *APIKey, estimate RequestBillingEstimate, payloadHash string) error {
	if s == nil || handle == nil || !handle.Reserved() {
		return nil
	}
	multiplier, mediaMultiplier := s.requestReservationMultipliers(ctx, user, apiKey)
	return rebindGatewayRequestBilling(ctx, s.cfg, s.billingService, s.resolver, handle, user, apiKey, estimate, payloadHash, multiplier, mediaMultiplier)
}

func (s *OpenAIGatewayService) ReserveRequestBilling(ctx context.Context, user *User, apiKey *APIKey, estimate RequestBillingEstimate, payloadHash string) (*RequestBillingReservationHandle, error) {
	if s == nil {
		return &RequestBillingReservationHandle{}, nil
	}
	multiplier, mediaMultiplier := s.requestReservationMultipliers(ctx, user, apiKey)
	return reserveGatewayRequestBilling(ctx, s.cfg, s.usageBillingRepo, s.billingService, s.resolver, user, apiKey, estimate, payloadHash, multiplier, mediaMultiplier)
}

func (s *GatewayService) requestReservationMultipliers(ctx context.Context, user *User, apiKey *APIKey) (float64, float64) {
	base := defaultRequestReservationMultiplier(s.cfg)
	if user != nil && apiKey != nil && apiKey.GroupID != nil && apiKey.Group != nil {
		base = s.ResolveUserGroupRateMultiplier(ctx, user.ID, *apiKey.GroupID, apiKey.Group.RateMultiplier)
	}
	return computePeakAwareMultipliers(apiKey, base, timezone.Now())
}

func (s *OpenAIGatewayService) requestReservationMultipliers(ctx context.Context, user *User, apiKey *APIKey) (float64, float64) {
	base := defaultRequestReservationMultiplier(s.cfg)
	if user != nil && apiKey != nil && apiKey.GroupID != nil && apiKey.Group != nil {
		base = s.ResolveUserGroupRateMultiplier(ctx, user.ID, *apiKey.GroupID, apiKey.Group.RateMultiplier)
	}
	return computePeakAwareMultipliers(apiKey, base, timezone.Now())
}

func defaultRequestReservationMultiplier(cfg *config.Config) float64 {
	if cfg != nil {
		return cfg.Default.RateMultiplier
	}
	return 1
}

func reserveGatewayRequestBilling(
	ctx context.Context,
	cfg *config.Config,
	repo UsageBillingRepository,
	billingService *BillingService,
	resolver *ModelPricingResolver,
	user *User,
	apiKey *APIKey,
	estimate RequestBillingEstimate,
	payloadHash string,
	tokenMultiplier float64,
	mediaMultiplier float64,
) (*RequestBillingReservationHandle, error) {
	handle := &RequestBillingReservationHandle{}
	if cfg == nil || cfg.RunMode == config.RunModeSimple {
		return handle, nil
	}
	reservationRepo, ok := repo.(UsageBillingReservationRepository)
	if !ok || reservationRepo == nil || billingService == nil || user == nil || apiKey == nil {
		return nil, errors.New("usage billing request reservation is not configured")
	}

	amount, err := estimateRequestBillingAmount(ctx, billingService, resolver, apiKey, estimate, tokenMultiplier, mediaMultiplier)
	if err != nil {
		return nil, err
	}
	if !amount.IsPositive() {
		return handle, nil
	}
	requestID := resolveUsageBillingRequestID(ctx, "")
	if strings.TrimSpace(payloadHash) == "" {
		payloadHash = HashUsageRequestPayload(estimate.Body)
	}
	leaseSeconds, heartbeatInterval := requestReservationLeaseSettings(cfg)
	cmd := &UsageBillingReservationCommand{
		RequestID:          requestID,
		APIKeyID:           apiKey.ID,
		RequestPayloadHash: strings.TrimSpace(payloadHash),
		UserID:             user.ID,
		GroupID:            apiKey.GroupID,
		EstimatedAmount:    amount,
		LeaseOwner:         uuid.NewString(),
		LeaseDurationSecs:  leaseSeconds,
	}
	result, err := reservationRepo.ReserveRequestBilling(ctx, cmd)
	if err != nil {
		return nil, err
	}
	handle.repo = reservationRepo
	handle.releaseCmd = UsageBillingReservationReleaseCommand{
		RequestID:          requestID,
		APIKeyID:           apiKey.ID,
		UserID:             user.ID,
		RequestPayloadHash: strings.TrimSpace(payloadHash),
	}
	handle.reserved = result != nil && (result.Applied || result.Status == "pending")
	handle.groupID = cloneOptionalInt64(apiKey.GroupID)
	handle.leaseOwner = cmd.LeaseOwner
	if result != nil {
		handle.groupID = cloneOptionalInt64(result.GroupID)
		if owner := strings.TrimSpace(result.LeaseOwner); owner != "" {
			handle.leaseOwner = owner
		}
	}
	handle.startHeartbeat(heartbeatInterval, leaseSeconds)
	return handle, nil
}

func rebindGatewayRequestBilling(
	ctx context.Context,
	cfg *config.Config,
	billingService *BillingService,
	resolver *ModelPricingResolver,
	handle *RequestBillingReservationHandle,
	user *User,
	apiKey *APIKey,
	estimate RequestBillingEstimate,
	payloadHash string,
	tokenMultiplier float64,
	mediaMultiplier float64,
) error {
	if cfg == nil || cfg.RunMode == config.RunModeSimple || !handle.Reserved() {
		return nil
	}
	if billingService == nil || user == nil || apiKey == nil {
		return errors.New("usage billing request reservation rebind is not configured")
	}
	amount, err := estimateRequestBillingAmount(ctx, billingService, resolver, apiKey, estimate, tokenMultiplier, mediaMultiplier)
	if err != nil {
		return err
	}
	if !amount.IsPositive() {
		return errors.New("usage billing request reservation rebind amount must be positive")
	}
	if strings.TrimSpace(payloadHash) == "" {
		payloadHash = HashUsageRequestPayload(estimate.Body)
	}
	leaseSeconds, _ := requestReservationLeaseSettings(cfg)
	return handle.rebind(ctx, user.ID, apiKey.ID, apiKey.GroupID, amount, payloadHash, leaseSeconds)
}

func requestReservationLeaseSettings(cfg *config.Config) (int, time.Duration) {
	leaseSeconds := defaultRequestReservationLeaseSeconds
	heartbeatSeconds := defaultRequestReservationHeartbeatSecs
	if cfg != nil {
		if cfg.Billing.RequestReservationLeaseSeconds > 0 {
			leaseSeconds = cfg.Billing.RequestReservationLeaseSeconds
		}
		if cfg.Billing.RequestReservationHeartbeatSeconds > 0 {
			heartbeatSeconds = cfg.Billing.RequestReservationHeartbeatSeconds
		}
	}
	if heartbeatSeconds >= leaseSeconds {
		heartbeatSeconds = leaseSeconds / 2
		if heartbeatSeconds <= 0 {
			heartbeatSeconds = 1
		}
	}
	return leaseSeconds, time.Duration(heartbeatSeconds) * time.Second
}

func estimateRequestBillingAmount(
	ctx context.Context,
	billingService *BillingService,
	resolver *ModelPricingResolver,
	apiKey *APIKey,
	estimate RequestBillingEstimate,
	tokenMultiplier float64,
	mediaMultiplier float64,
) (decimal.Decimal, error) {
	model := strings.TrimSpace(estimate.Model)
	if model == "" {
		return decimal.Zero, errors.New("usage billing reservation model is required")
	}
	if estimate.RequestCount <= 0 {
		estimate.RequestCount = 1
	}

	var resolved *ResolvedPricing
	if resolver != nil {
		resolved = resolver.Resolve(ctx, PricingInput{Model: model, GroupID: apiKey.GroupID})
	}

	switch estimate.Kind {
	case RequestBillingEstimateImage:
		sizeTier := NormalizeImageBillingTierOrDefault(estimate.SizeTier)
		mediaCost := billingService.CalculateImageCost(model, sizeTier, estimate.RequestCount, imagePriceConfigFromAPIKey(apiKey), mediaMultiplier)
		if resolved != nil && (resolved.Mode == BillingModePerRequest || resolved.Mode == BillingModeImage) {
			cost, err := billingService.CalculateCostUnified(CostInput{
				Ctx:            ctx,
				Model:          model,
				GroupID:        apiKey.GroupID,
				RequestCount:   estimate.RequestCount,
				SizeTier:       sizeTier,
				RateMultiplier: mediaMultiplier,
				Resolver:       resolver,
				Resolved:       resolved,
			})
			if err != nil {
				return decimal.Zero, err
			}
			mediaCost = cost
		}
		mediaAmount := billingReservationCost(mediaCost)
		if resolved != nil && resolved.Mode == BillingModeToken {
			tokenAmount, err := estimateTokenRequestBillingAmount(ctx, billingService, resolver, apiKey, estimate, model, tokenMultiplier, resolved)
			if err != nil {
				return decimal.Zero, err
			}
			if tokenAmount.GreaterThan(mediaAmount) {
				return tokenAmount, nil
			}
		}
		return mediaAmount, nil
	case RequestBillingEstimateVideo:
		mediaAmount := billingReservationCost(billingService.CalculateVideoCost(model, estimate.Resolution, estimate.RequestCount, estimate.DurationSeconds, videoPriceConfigFromAPIKey(apiKey), mediaMultiplier))
		if resolved != nil && resolved.Mode == BillingModeToken {
			tokenAmount, err := estimateTokenRequestBillingAmount(ctx, billingService, resolver, apiKey, estimate, model, tokenMultiplier, resolved)
			if err != nil {
				return decimal.Zero, err
			}
			if tokenAmount.GreaterThan(mediaAmount) {
				return tokenAmount, nil
			}
		}
		return mediaAmount, nil
	case RequestBillingEstimateWebSearch:
		calls := estimate.WebSearchCalls
		if calls <= 0 {
			calls = estimate.RequestCount
		}
		return billingReservationCost(billingService.CalculateWebSearchCost(calls, webSearchPricePerCallFromAPIKey(apiKey), mediaMultiplier)), nil
	default:
		return estimateTokenRequestBillingAmount(ctx, billingService, resolver, apiKey, estimate, model, tokenMultiplier, resolved)
	}
}

func estimateTokenRequestBillingAmount(
	ctx context.Context,
	billingService *BillingService,
	resolver *ModelPricingResolver,
	apiKey *APIKey,
	estimate RequestBillingEstimate,
	model string,
	tokenMultiplier float64,
	resolved *ResolvedPricing,
) (decimal.Decimal, error) {
	var pricing *ModelPricing
	if resolved != nil {
		pricing = resolved.BasePricing
	}
	if pricing == nil {
		var err error
		pricing, err = billingService.GetModelPricing(model)
		if err != nil {
			return decimal.Zero, err
		}
	}
	inputTokens := len(estimate.Body) + requestReservationInputOverheadTokens
	if pricing.MaxInputTokens > 0 && inputTokens > pricing.MaxInputTokens {
		inputTokens = pricing.MaxInputTokens
	}
	outputTokens := 0
	if !estimate.NoOutputTokens {
		outputTokens = requestReservationOutputTokens(estimate.Body, pricing.MaxOutputTokens)
	}
	serviceTier := strings.TrimSpace(gjson.GetBytes(estimate.Body, "service_tier").String())
	groupID := apiKey.GroupID
	cost, err := billingService.CalculateCostUnified(CostInput{
		Ctx:            ctx,
		Model:          model,
		GroupID:        groupID,
		Tokens:         UsageTokens{InputTokens: inputTokens, OutputTokens: outputTokens},
		RequestCount:   estimate.RequestCount,
		SizeTier:       estimate.SizeTier,
		RateMultiplier: tokenMultiplier,
		ServiceTier:    serviceTier,
		Resolver:       resolver,
		Resolved:       resolved,
	})
	if err != nil {
		return decimal.Zero, err
	}
	return billingReservationCost(cost), nil
}

func requestReservationOutputTokens(body []byte, modelMaximum int) int {
	maximum := 0
	for _, path := range []string{
		"max_output_tokens",
		"max_completion_tokens",
		"max_tokens",
		"generationConfig.maxOutputTokens",
		"generation_config.max_output_tokens",
	} {
		value := gjson.GetBytes(body, path)
		if value.Exists() && value.Type == gjson.Number && value.Int() > int64(maximum) {
			maximum = int(value.Int())
		}
	}
	if maximum <= 0 {
		maximum = requestReservationFallbackOutputTokens
	}
	if modelMaximum > 0 && maximum > modelMaximum {
		maximum = modelMaximum
	}
	return maximum
}

func billingReservationCost(cost *CostBreakdown) decimal.Decimal {
	if cost == nil || cost.ActualCost <= 0 {
		return decimal.Zero
	}
	return BillingAmountFromFloat(cost.ActualCost)
}
