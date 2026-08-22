package repository

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
)

// newRepositoryMiniRedis keeps listener-backed Redis fixtures explicit about
// the sandbox limitation instead of letting miniredis.Fatalf abort the suite.
func newRepositoryMiniRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Skipf("listener unavailable in this environment: %v", err)
	}
	t.Cleanup(mr.Close)
	return mr
}

// newRepositoryHTTPServer is the listener-backed counterpart to
// httptest.NewServer for repository integration-shaped unit fixtures.
func newRepositoryHTTPServer(t *testing.T, handler http.Handler) *httptest.Server {
	t.Helper()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Skipf("listener unavailable in this environment: %v", err)
	}
	server := &httptest.Server{Listener: listener, Config: &http.Server{Handler: handler}}
	server.Start()
	t.Cleanup(server.Close)
	return server
}
