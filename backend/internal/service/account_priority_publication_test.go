package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type priorityPublicationRepoStub struct {
	publication *AccountPriorityPublication
	claimed     bool
	ready       bool
	released    int
	buckets     []AccountPriorityPublicationBucket
	retryable   [][]AccountPriorityPublicationBucket
	completed   int
	failed      []SchedulerBucket
	succeeded   []SchedulerBucket
}

func (r *priorityPublicationRepoStub) Claim(context.Context, string) (*AccountPriorityPublication, bool, error) {
	return r.publication, r.claimed, nil
}
func (r *priorityPublicationRepoStub) ReleaseClaim(context.Context, string) error {
	r.released++
	return nil
}
func (r *priorityPublicationRepoStub) FreezeBuckets(context.Context, string, []SchedulerBucket) error {
	return nil
}
func (r *priorityPublicationRepoStub) ListBuckets(context.Context, string) ([]AccountPriorityPublicationBucket, error) {
	return r.buckets, nil
}
func (r *priorityPublicationRepoStub) ListRetryableBuckets(context.Context, string, time.Time) ([]AccountPriorityPublicationBucket, error) {
	if len(r.retryable) == 0 {
		return nil, nil
	}
	result := r.retryable[0]
	r.retryable = r.retryable[1:]
	return result, nil
}
func (r *priorityPublicationRepoStub) MarkBucketSucceeded(_ context.Context, _ string, bucket SchedulerBucket) error {
	r.succeeded = append(r.succeeded, bucket)
	return nil
}
func (r *priorityPublicationRepoStub) MarkBucketFailed(_ context.Context, _ string, bucket SchedulerBucket, _ time.Time, _ string) error {
	r.failed = append(r.failed, bucket)
	return nil
}
func (r *priorityPublicationRepoStub) CompleteIfReady(context.Context, string) (bool, error) {
	r.completed++
	return r.ready || r.completed > 1, nil
}
func (r *priorityPublicationRepoStub) MarkFailed(context.Context, string, time.Time, string) error {
	return nil
}

type priorityPublicationCacheStub struct {
	SchedulerCache
	activeEpoch int64
	begun       []int64
	completed   []int64
	rebuilds    int
	failFirst   bool
}

func (c *priorityPublicationCacheStub) GetPrioritySemanticEpoch(context.Context) (int64, error) {
	return c.activeEpoch, nil
}
func (c *priorityPublicationCacheStub) SetPrioritySemanticEpoch(context.Context, int64) error {
	return nil
}
func (c *priorityPublicationCacheStub) InvalidatePrioritySemanticAccounts(context.Context) error {
	return nil
}
func (c *priorityPublicationCacheStub) BeginPrioritySemanticPublication(_ context.Context, epoch int64) error {
	c.begun = append(c.begun, epoch)
	return nil
}
func (c *priorityPublicationCacheStub) CaptureBucketWriteTokenAtSemanticEpoch(_ context.Context, bucket SchedulerBucket, epoch int64) (SchedulerBucketWriteToken, error) {
	c.rebuilds++
	if c.failFirst && c.rebuilds == 1 {
		return SchedulerBucketWriteToken{}, errors.New("temporary rebuild failure")
	}
	return SchedulerBucketWriteToken{Bucket: bucket, Epoch: int64(c.rebuilds), SemanticEpoch: epoch}, nil
}
func (c *priorityPublicationCacheStub) CompletePrioritySemanticPublication(_ context.Context, epoch int64) error {
	c.completed = append(c.completed, epoch)
	c.activeEpoch = epoch
	return nil
}

func newPriorityPublicationForTest(status string) *AccountPriorityPublication {
	return &AccountPriorityPublication{
		MigrationKey:      "account_priority_higher_wins_v1",
		SemanticEpoch:     2,
		PrioritySemantics: AccountPrioritySemanticsHigherWins,
		BucketSetFrozen:   true,
		Status:            status,
	}
}

func TestAccountPrioritySemanticPublisherReturnsIncompleteAndReleasesClaim(t *testing.T) {
	repo := &priorityPublicationRepoStub{publication: newPriorityPublicationForTest("running"), claimed: true}
	cache := &priorityPublicationCacheStub{activeEpoch: 1}
	publisher := NewAccountPrioritySemanticPublisher(repo, &SchedulerSnapshotService{}, cache, nil, &config.Config{RunMode: config.RunModeSimple})

	err := publisher.Publish(context.Background(), repo.publication.MigrationKey)
	require.ErrorIs(t, err, ErrAccountPriorityPublicationIncomplete)
	require.Equal(t, 1, repo.released)
	require.Equal(t, []int64{2}, cache.begun)
	require.Empty(t, cache.completed)
}

func TestAccountPrioritySemanticPublisherResumesAfterDatabaseCompletion(t *testing.T) {
	repo := &priorityPublicationRepoStub{publication: newPriorityPublicationForTest("succeeded"), claimed: true, ready: true}
	cache := &priorityPublicationCacheStub{activeEpoch: 1}
	publisher := NewAccountPrioritySemanticPublisher(repo, &SchedulerSnapshotService{}, cache, nil, &config.Config{RunMode: config.RunModeSimple})

	require.NoError(t, publisher.Publish(context.Background(), repo.publication.MigrationKey))
	require.Equal(t, 1, repo.released)
	require.Equal(t, []int64{2}, cache.begun)
	require.Equal(t, []int64{2}, cache.completed)
	require.Equal(t, int64(2), cache.activeEpoch)
}

func TestAccountPrioritySemanticPublisherBusyIsExplicit(t *testing.T) {
	repo := &priorityPublicationRepoStub{claimed: false}
	publisher := NewAccountPrioritySemanticPublisher(repo, &SchedulerSnapshotService{}, &priorityPublicationCacheStub{}, nil, nil)

	err := publisher.Publish(context.Background(), "account_priority_higher_wins_v1")
	require.ErrorIs(t, err, ErrAccountPriorityPublicationBusy)
	require.Zero(t, repo.released)
}

func TestAccountPrioritySemanticPublisherRetriesDueBucketAndPromotes(t *testing.T) {
	bucket := SchedulerBucket{GroupID: 7, Platform: PlatformOpenAI, Mode: SchedulerModeSingle}
	repo := &priorityPublicationRepoStub{
		publication: newPriorityPublicationForTest("running"),
		claimed:     true,
		buckets:     []AccountPriorityPublicationBucket{{Bucket: bucket}},
		retryable:   [][]AccountPriorityPublicationBucket{{{Bucket: bucket, Attempts: 1}}},
	}
	cache := &priorityPublicationCacheStub{activeEpoch: 1, failFirst: true}
	publisher := NewAccountPrioritySemanticPublisher(repo, &SchedulerSnapshotService{}, cache, nil, &config.Config{RunMode: config.RunModeSimple})
	publisher.retryWait = func(context.Context) error { return nil }
	publisher.rebuild = func(_ context.Context, got SchedulerBucket, epoch int64, reason string) error {
		cache.rebuilds++
		require.Equal(t, bucket, got)
		require.Equal(t, int64(2), epoch)
		require.Equal(t, "priority_semantic_publisher", reason)
		if cache.rebuilds == 1 {
			return errors.New("temporary rebuild failure")
		}
		return nil
	}

	require.NoError(t, publisher.Publish(context.Background(), repo.publication.MigrationKey))
	require.Equal(t, []SchedulerBucket{bucket}, repo.failed)
	require.Equal(t, []SchedulerBucket{bucket}, repo.succeeded)
	require.Equal(t, 2, cache.rebuilds)
	require.Equal(t, []int64{2}, cache.completed)
	require.Equal(t, 1, repo.released)
}
