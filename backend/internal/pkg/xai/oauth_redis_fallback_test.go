//go:build unit

package xai

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

func TestSessionStoreRedisFallbackIsLimitedToFailedWrites(t *testing.T) {
	mr := startMiniredisOrSkip(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr(), MaxRetries: -1})
	t.Cleanup(func() { _ = client.Close() })
	store := NewRedisSessionStore(client)
	defer store.Stop()
	session := func(state string) *OAuthSession { return &OAuthSession{State: state, CreatedAt: time.Now()} }

	store.Set("remote", session("remote"))
	require.NoError(t, store.remote.Delete(context.Background(), "remote"))
	_, ok := store.Get("remote")
	require.False(t, ok, "a remote miss must not revive the stale local copy")

	mr.Close()
	store.Set("local-only", session("local"))
	got, ok := store.Get("local-only")
	require.True(t, ok)
	require.Equal(t, "local", got.State)
	require.True(t, store.TryConsumeSession("local-only"))
	require.False(t, store.TryConsumeSession("local-only"))
}
