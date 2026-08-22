package provider

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
)

// inProcessRoundTripper drives provider HTTP clients through an httptest
// recorder without opening a loopback listener.  The repository test sandbox
// disallows local sockets, while the provider code only needs the standard
// http.Client contract for these deterministic fixtures.
type inProcessRoundTripper func(*http.Request) (*http.Response, error)

func (f inProcessRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func newInProcessHTTPClient(handler http.Handler) *http.Client {
	return &http.Client{Transport: inProcessRoundTripper(func(r *http.Request) (*http.Response, error) {
		var body []byte
		if r.Body != nil {
			body, _ = io.ReadAll(r.Body)
			_ = r.Body.Close()
			r.Body = io.NopCloser(bytes.NewReader(body))
		}
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, r)
		return recorder.Result(), nil
	})}
}
