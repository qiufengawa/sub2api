package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
)

type AccountPriorityPublication struct {
	MigrationKey      string
	SemanticEpoch     int64
	PrioritySemantics string
	PriorityPivot     int64
	BucketSetFrozen   bool
	Status            string
}

type AccountPriorityPublicationBucket struct {
	Bucket   SchedulerBucket
	Attempts int
}

type AccountPriorityPublicationRepository interface {
	Claim(ctx context.Context, migrationKey string) (*AccountPriorityPublication, bool, error)
	ReleaseClaim(ctx context.Context, migrationKey string) error
	FreezeBuckets(ctx context.Context, migrationKey string, buckets []SchedulerBucket) error
	ListBuckets(ctx context.Context, migrationKey string) ([]AccountPriorityPublicationBucket, error)
	ListRetryableBuckets(ctx context.Context, migrationKey string, now time.Time) ([]AccountPriorityPublicationBucket, error)
	MarkBucketSucceeded(ctx context.Context, migrationKey string, bucket SchedulerBucket) error
	MarkBucketFailed(ctx context.Context, migrationKey string, bucket SchedulerBucket, nextRetry time.Time, failure string) error
	CompleteIfReady(ctx context.Context, migrationKey string) (bool, error)
	MarkFailed(ctx context.Context, migrationKey string, nextRetry time.Time, failure string) error
}

var (
	ErrAccountPriorityPublicationBusy       = errors.New("account priority publication is not claimable")
	ErrAccountPriorityPublicationIncomplete = errors.New("account priority publication is incomplete")
)

type AccountPrioritySemanticPublisher struct {
	repo      AccountPriorityPublicationRepository
	snapshot  *SchedulerSnapshotService
	cache     SchedulerCache
	groups    GroupRepository
	cfg       *config.Config
	now       func() time.Time
	retryWait func(context.Context) error
	rebuild   func(context.Context, SchedulerBucket, int64, string) error
}

func NewAccountPrioritySemanticPublisher(repo AccountPriorityPublicationRepository, snapshot *SchedulerSnapshotService, cache SchedulerCache, groups GroupRepository, cfg *config.Config) *AccountPrioritySemanticPublisher {
	return &AccountPrioritySemanticPublisher{repo: repo, snapshot: snapshot, cache: cache, groups: groups, cfg: cfg, now: time.Now}
}

func (p *AccountPrioritySemanticPublisher) Publish(ctx context.Context, migrationKey string) (retErr error) {
	if p == nil || p.repo == nil || p.snapshot == nil || p.cache == nil {
		return ErrSchedulerCacheNotReady
	}
	publication, claimed, err := p.repo.Claim(ctx, migrationKey)
	if err != nil {
		return err
	}
	if !claimed {
		return ErrAccountPriorityPublicationBusy
	}
	defer func() {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		retErr = errors.Join(retErr, p.repo.ReleaseClaim(releaseCtx, migrationKey))
	}()
	if publication.PrioritySemantics != AccountPrioritySemanticsHigherWins || publication.SemanticEpoch <= 0 {
		return fmt.Errorf("unsupported account priority publication: semantics=%q epoch=%d", publication.PrioritySemantics, publication.SemanticEpoch)
	}
	cachePublisher, ok := p.cache.(SchedulerPrioritySemanticPublisher)
	if !ok {
		return errors.New("scheduler cache does not support semantic publication")
	}
	epochCache, ok := p.cache.(SchedulerPrioritySemanticEpochCache)
	if !ok {
		return errors.New("scheduler cache does not expose semantic epoch")
	}
	activeEpoch, err := epochCache.GetPrioritySemanticEpoch(ctx)
	if err != nil {
		return err
	}
	if activeEpoch == publication.SemanticEpoch && publication.Status == "succeeded" {
		return nil
	}
	if err := cachePublisher.BeginPrioritySemanticPublication(ctx, publication.SemanticEpoch); err != nil {
		return err
	}
	if !publication.BucketSetFrozen {
		buckets, err := p.captureBucketSet(ctx)
		if err != nil {
			return p.failPublication(ctx, publication, 0, err)
		}
		if err := p.repo.FreezeBuckets(ctx, publication.MigrationKey, buckets); err != nil {
			return err
		}
	}
	// Always stage every frozen bucket once after claiming. Redis may have
	// restarted or evicted an unpublished epoch even when PostgreSQL still says
	// the bucket succeeded. Subsequent passes consume only due failed buckets.
	buckets, err := p.repo.ListBuckets(ctx, publication.MigrationKey)
	if err != nil {
		return err
	}
	if err := p.publishBuckets(ctx, publication, buckets); err != nil {
		return err
	}

	for {
		ready, err := p.repo.CompleteIfReady(ctx, publication.MigrationKey)
		if err != nil {
			return err
		}
		if ready {
			return cachePublisher.CompletePrioritySemanticPublication(ctx, publication.SemanticEpoch)
		}
		if len(buckets) == 0 {
			return ErrAccountPriorityPublicationIncomplete
		}

		due, err := p.repo.ListRetryableBuckets(ctx, publication.MigrationKey, p.now())
		if err != nil {
			return err
		}
		if len(due) > 0 {
			if err := p.publishBuckets(ctx, publication, due); err != nil {
				return err
			}
			continue
		}
		if err := p.waitForRetry(ctx); err != nil {
			return errors.Join(ErrAccountPriorityPublicationIncomplete, err)
		}
	}
}

func (p *AccountPrioritySemanticPublisher) publishBuckets(ctx context.Context, publication *AccountPriorityPublication, buckets []AccountPriorityPublicationBucket) error {
	for _, entry := range buckets {
		rebuild := p.rebuild
		if rebuild == nil {
			rebuild = p.snapshot.RebuildPrioritySemanticBucket
		}
		err := rebuild(ctx, entry.Bucket, publication.SemanticEpoch, "priority_semantic_publisher")
		if err != nil {
			next := p.now().Add(priorityPublicationBackoff(entry.Attempts + 1))
			if markErr := p.repo.MarkBucketFailed(ctx, publication.MigrationKey, entry.Bucket, next, err.Error()); markErr != nil {
				return errors.Join(err, markErr)
			}
			continue
		}
		if err := p.repo.MarkBucketSucceeded(ctx, publication.MigrationKey, entry.Bucket); err != nil {
			return err
		}
	}
	return nil
}

func (p *AccountPrioritySemanticPublisher) waitForRetry(ctx context.Context) error {
	if p.retryWait != nil {
		return p.retryWait(ctx)
	}
	timer := time.NewTimer(priorityPublicationBackoff(1))
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (p *AccountPrioritySemanticPublisher) captureBucketSet(ctx context.Context) ([]SchedulerBucket, error) {
	registered, err := p.cache.ListBuckets(ctx)
	if err != nil {
		return nil, err
	}
	buckets := append([]SchedulerBucket(nil), registered...)
	if p.cfg != nil && p.cfg.RunMode == config.RunModeSimple {
		return dedupeBuckets(append(buckets, schedulerCanonicalBuckets(0)...)), nil
	}
	buckets = append(buckets, schedulerCanonicalBuckets(0)...)
	if p.groups == nil {
		return nil, ErrSchedulerCacheNotReady
	}
	groups, err := p.groups.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	for _, group := range groups {
		buckets = append(buckets, schedulerBucketsForGroup(group.ID)...)
	}
	return dedupeBuckets(buckets), nil
}

func (p *AccountPrioritySemanticPublisher) failPublication(ctx context.Context, publication *AccountPriorityPublication, attempts int, cause error) error {
	next := p.now().Add(priorityPublicationBackoff(attempts + 1))
	if err := p.repo.MarkFailed(ctx, publication.MigrationKey, next, cause.Error()); err != nil {
		return errors.Join(cause, err)
	}
	return cause
}

func priorityPublicationBackoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	delay := time.Second << min(attempt-1, 8)
	if delay > 5*time.Minute {
		return 5 * time.Minute
	}
	return delay
}
