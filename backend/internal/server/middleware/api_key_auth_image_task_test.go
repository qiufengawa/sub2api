package middleware

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsAsyncImageTaskRead(t *testing.T) {
	require.True(t, isAsyncImageTaskRead(http.MethodGet, "/v1/images/tasks/imgtask_123"))
	require.True(t, isAsyncImageTaskRead(http.MethodGet, "/images/tasks/imgtask_123"))
	require.False(t, isAsyncImageTaskRead(http.MethodPost, "/v1/images/tasks/imgtask_123"))
	require.False(t, isAsyncImageTaskRead(http.MethodGet, "/v1/images/generations"))
}

func TestIsBatchImageRead(t *testing.T) {
	for _, path := range []string{
		"/v1/images/batches",
		"/v1/images/batches/models",
		"/v1/images/batches/imgbatch_123",
		"/v1/images/batches/imgbatch_123/items",
		"/v1/images/batches/imgbatch_123/download",
		"/images/batches/imgbatch_123/items/item_1/content",
	} {
		require.True(t, isBatchImageRead(http.MethodGet, path), path)
	}
	require.False(t, isBatchImageRead(http.MethodPost, "/v1/images/batches"))
	require.False(t, isBatchImageRead(http.MethodDelete, "/v1/images/batches/imgbatch_123"))
	require.False(t, isBatchImageRead(http.MethodGet, "/v1/images/generations"))
	require.False(t, isBatchImageRead(http.MethodGet, "/v1/images/batches-extra"))
}
