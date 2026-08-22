//go:build unit

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func TestBatchImageDownloadLimiter_AcquireDenyReleaseAndTTL(t *testing.T) {
	ctx := context.Background()
	mr := newRepositoryMiniRedis(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	limiter := &batchImageDownloadLimiter{
		rdb:          rdb,
		activePrefix: defaultBatchImageDownloadActivePrefix,
		maxActive:    1,
		ttl:          time.Minute,
	}

	permit, err := limiter.Acquire(ctx, "11", "zip")
	require.NoError(t, err)
	require.NotNil(t, permit)
	require.True(t, mr.TTL(limiter.activeKey("11")) > 0)

	_, err = limiter.Acquire(ctx, "11", "zip")
	require.ErrorIs(t, err, service.ErrBatchImageDownloadLimited)

	require.NoError(t, permit.Release(ctx))
	require.NoError(t, permit.Release(ctx))
	require.False(t, mr.Exists(limiter.activeKey("11")))

	permit, err = limiter.Acquire(ctx, "11", "zip")
	require.NoError(t, err)
	require.NotNil(t, permit)
}

func TestBatchImageDownloadLimiter_ReleaseCanceledContextStillDecrements(t *testing.T) {
	ctx := context.Background()
	mr := newRepositoryMiniRedis(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	limiter := &batchImageDownloadLimiter{
		rdb:          rdb,
		activePrefix: defaultBatchImageDownloadActivePrefix,
		maxActive:    1,
		ttl:          time.Minute,
	}

	permit, err := limiter.Acquire(ctx, "cancel-release", "zip")
	require.NoError(t, err)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	require.NoError(t, permit.Release(canceled))

	// If Release used the canceled request context, the once guard would have
	// consumed the attempt while the Redis counter remained active and this
	// acquire would be incorrectly denied.
	next, err := limiter.Acquire(ctx, "cancel-release", "zip")
	require.NoError(t, err)
	require.NotNil(t, next)
}
