package service

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

// newUnitHTTPServer is the listener-capable counterpart to httptest.NewServer
// used by integration-shaped unit fixtures. The sandbox used for local runs
// may deny loopback binds; skip those tests with an explicit diagnostic rather
// than allowing httptest.NewServer to panic before the test can report it.
func newUnitHTTPServer(t *testing.T, handler http.Handler) *httptest.Server {
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
