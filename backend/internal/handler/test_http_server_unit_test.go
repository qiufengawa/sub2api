package handler

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

// newHandlerUnitHTTPServer keeps listener-dependent websocket fixtures from
// panicking when the local sandbox denies loopback binds.
func newHandlerUnitHTTPServer(t *testing.T, handler http.Handler) *httptest.Server {
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
