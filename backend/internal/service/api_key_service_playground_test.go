//go:build unit

package service

import (
	"context"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

func TestGetByIDForPlaygroundUsesOwnedCredentialAuthPath(t *testing.T) {
	const (
		keyID  = int64(41)
		userID = int64(7)
	)
	repo := &authRepoStub{
		getKeyAndOwnerID: func(_ context.Context, id int64) (string, int64, error) {
			require.Equal(t, keyID, id)
			return "sk-owned", userID, nil
		},
		getByKeyForAuth: func(_ context.Context, key string) (*APIKey, error) {
			require.Equal(t, "sk-owned", key)
			return &APIKey{
				ID: keyID, UserID: userID, Key: key, Status: StatusAPIKeyActive,
				User: &User{ID: userID, Status: StatusActive},
			}, nil
		},
	}
	svc := NewAPIKeyService(repo, nil, nil, nil, nil, nil, &config.Config{})

	got, err := svc.GetByIDForPlayground(context.Background(), keyID, userID)
	require.NoError(t, err)
	require.Equal(t, keyID, got.ID)
	require.Equal(t, userID, got.UserID)
}

func TestListPlaygroundOptionsReportsTruncation(t *testing.T) {
	items := make([]PlaygroundAPIKeyOption, MaxPlaygroundAPIKeyOptions+1)
	repo := &playgroundListRepoStub{items: items}
	svc := NewAPIKeyService(repo, nil, nil, nil, nil, nil, &config.Config{})

	result, err := svc.ListPlaygroundOptions(context.Background(), 7)
	require.NoError(t, err)
	require.True(t, result.Truncated)
	require.Len(t, result.Items, MaxPlaygroundAPIKeyOptions)
	require.Equal(t, MaxPlaygroundAPIKeyOptions+1, repo.limit)
}

func TestListPlaygroundOptionsAtLimitIsNotTruncated(t *testing.T) {
	items := make([]PlaygroundAPIKeyOption, MaxPlaygroundAPIKeyOptions)
	for i := range items {
		items[i].ID = int64(i + 1)
	}
	repo := &playgroundListRepoStub{items: items}
	svc := NewAPIKeyService(repo, nil, nil, nil, nil, nil, &config.Config{})

	result, err := svc.ListPlaygroundOptions(context.Background(), 7)
	require.NoError(t, err)
	require.False(t, result.Truncated)
	require.Len(t, result.Items, MaxPlaygroundAPIKeyOptions)
	require.Equal(t, int64(MaxPlaygroundAPIKeyOptions), result.Items[MaxPlaygroundAPIKeyOptions-1].ID)
	require.Equal(t, MaxPlaygroundAPIKeyOptions+1, repo.limit)
}

type playgroundListRepoStub struct {
	authRepoStub
	items []PlaygroundAPIKeyOption
	limit int
}

func (s *playgroundListRepoStub) ListPlaygroundOptions(_ context.Context, _ int64, limit int) ([]PlaygroundAPIKeyOption, error) {
	s.limit = limit
	return s.items, nil
}

func TestGetByIDForPlaygroundHidesForeignKey(t *testing.T) {
	calledAuth := false
	repo := &authRepoStub{
		getKeyAndOwnerID: func(context.Context, int64) (string, int64, error) {
			return "sk-foreign", 99, nil
		},
		getByKeyForAuth: func(context.Context, string) (*APIKey, error) {
			calledAuth = true
			return nil, nil
		},
	}
	svc := NewAPIKeyService(repo, nil, nil, nil, nil, nil, &config.Config{})

	_, err := svc.GetByIDForPlayground(context.Background(), 41, 7)
	require.ErrorIs(t, err, ErrAPIKeyNotFound)
	require.False(t, calledAuth)
}
