//go:build unit

package redissession

import (
	"context"
	"errors"
	"syscall"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

// startMiniredisOrSkip keeps these tests runnable in sandboxes that deny
// binding localhost while still failing on any other startup error.
func startMiniredisOrSkip(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	mr, err := miniredis.Run()
	if err == nil {
		t.Cleanup(mr.Close)
		return mr
	}
	if errors.Is(err, syscall.EACCES) || errors.Is(err, syscall.EPERM) {
		t.Skipf("miniredis requires local listen permission: %v", err)
	}
	t.Fatalf("could not start miniredis: %v", err)
	return nil
}

func TestStoreRoundTripAndSingleUse(t *testing.T) {
	mr := startMiniredisOrSkip(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	store := New(rdb, "oauth:test", time.Minute)
	ctx := context.Background()

	require.NoError(t, store.Set(ctx, "sid", map[string]string{"state": "state"}))
	var got map[string]string
	ok, err := store.Get(ctx, "sid", &got)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, "state", got["state"])

	ok, err = store.TryConsume(ctx, "sid")
	require.NoError(t, err)
	require.True(t, ok)
	ok, err = store.TryConsume(ctx, "sid")
	require.NoError(t, err)
	require.False(t, ok)

	require.NoError(t, store.Delete(ctx, "sid"))
	ok, err = store.Get(ctx, "sid", &got)
	require.NoError(t, err)
	require.False(t, ok)
}
