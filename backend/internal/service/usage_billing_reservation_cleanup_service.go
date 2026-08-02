package service

import (
	"context"
	"sync"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"go.uber.org/zap"
)

const (
	defaultUsageBillingReservationCleanupInterval = time.Minute
	defaultUsageBillingReservationCleanupBatch    = 100
)

// UsageBillingReservationCleanupService releases request reservations whose
// owning process stopped refreshing its lease. Repository row locks make the
// sweep safe to run concurrently on multiple application instances.
type UsageBillingReservationCleanupService struct {
	repo     UsageBillingReservationRepository
	interval time.Duration
	batch    int

	startOnce sync.Once
	stopOnce  sync.Once
	stopCh    chan struct{}
}

func NewUsageBillingReservationCleanupService(repo UsageBillingReservationRepository, cfg *config.Config) *UsageBillingReservationCleanupService {
	interval := defaultUsageBillingReservationCleanupInterval
	batch := defaultUsageBillingReservationCleanupBatch
	if cfg != nil {
		if seconds := cfg.Billing.RequestReservationCleanupIntervalSeconds; seconds > 0 {
			interval = time.Duration(seconds) * time.Second
		}
		if configuredBatch := cfg.Billing.RequestReservationCleanupBatchSize; configuredBatch > 0 {
			batch = configuredBatch
		}
	}
	return &UsageBillingReservationCleanupService{
		repo:     repo,
		interval: interval,
		batch:    batch,
		stopCh:   make(chan struct{}),
	}
}

func (s *UsageBillingReservationCleanupService) Start() {
	if s == nil || s.repo == nil {
		return
	}
	s.startOnce.Do(func() {
		go s.runLoop()
	})
}

func (s *UsageBillingReservationCleanupService) Stop() {
	if s == nil {
		return
	}
	s.stopOnce.Do(func() {
		close(s.stopCh)
	})
}

func (s *UsageBillingReservationCleanupService) runLoop() {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	s.cleanupOnce()
	for {
		select {
		case <-ticker.C:
			s.cleanupOnce()
		case <-s.stopCh:
			return
		}
	}
}

func (s *UsageBillingReservationCleanupService) cleanupOnce() {
	if s == nil || s.repo == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	released, err := s.repo.ReleaseExpiredRequestBilling(ctx, s.batch)
	if err != nil {
		logger.L().Warn("usage_billing.request_reservation_cleanup_failed", zap.Error(err))
		return
	}
	if released > 0 {
		logger.L().Info("usage_billing.request_reservation_cleanup_completed", zap.Int("released", released))
	}
}
