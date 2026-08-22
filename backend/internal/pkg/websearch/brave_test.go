package websearch

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

type braveRoundTripFunc func(*http.Request) (*http.Response, error)

func (f braveRoundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestBraveProvider_Name(t *testing.T) {
	p := NewBraveProvider("key", nil)
	require.Equal(t, "brave", p.Name())
}

func TestBraveProvider_Search_Success(t *testing.T) {
	resp := braveResponse{}
	resp.Web.Results = []braveResult{
		{URL: "https://go.dev", Title: "Go", Description: "Go lang", Age: "1 day"},
		{URL: "https://pkg.go.dev", Title: "Pkg", Description: "Packages"},
		{URL: "https://tour.go.dev", Title: "Tour", Description: "A Tour of Go", Age: "3 days"},
	}
	body, err := json.Marshal(resp)
	require.NoError(t, err)

	client := &http.Client{Transport: braveRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, "test-key", r.Header.Get("X-Subscription-Token"))
		require.Equal(t, "application/json", r.Header.Get("Accept"))
		require.Equal(t, "golang", r.URL.Query().Get("q"))
		require.Equal(t, "3", r.URL.Query().Get("count"))

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(body)),
			Request:    r,
		}, nil
	})}

	p := NewBraveProvider("test-key", client)
	result, err := p.Search(context.Background(), SearchRequest{Query: "golang", MaxResults: 3})
	require.NoError(t, err)
	require.Len(t, result.Results, 3)
	require.Equal(t, "https://go.dev", result.Results[0].URL)
	require.Equal(t, "Go lang", result.Results[0].Snippet)
	require.Equal(t, "1 day", result.Results[0].PageAge)
}

func TestBraveProvider_Search_DefaultMaxResults(t *testing.T) {
	var receivedCount string
	client := &http.Client{Transport: braveRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		receivedCount = r.URL.Query().Get("count")
		body, _ := json.Marshal(braveResponse{})
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(body)), Header: make(http.Header), Request: r}, nil
	})}
	p := NewBraveProvider("key", client)

	_, _ = p.Search(context.Background(), SearchRequest{Query: "test", MaxResults: 0})
	require.Equal(t, "5", receivedCount)
}

func TestBraveProvider_Search_HTTPError(t *testing.T) {
	client := &http.Client{Transport: braveRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 429, Body: io.NopCloser(bytes.NewReader([]byte("rate limited"))), Header: make(http.Header), Request: r}, nil
	})}
	p := NewBraveProvider("key", client)

	_, err := p.Search(context.Background(), SearchRequest{Query: "test"})
	require.ErrorContains(t, err, "brave: status 429")
}

func TestBraveProvider_Search_InvalidJSON(t *testing.T) {
	client := &http.Client{Transport: braveRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader([]byte("not json"))), Header: make(http.Header), Request: r}, nil
	})}
	p := NewBraveProvider("key", client)

	_, err := p.Search(context.Background(), SearchRequest{Query: "test"})
	require.ErrorContains(t, err, "brave: decode response")
}

func TestBraveProvider_Search_EmptyResults(t *testing.T) {
	client := &http.Client{Transport: braveRoundTripFunc(func(r *http.Request) (*http.Response, error) {
		body, _ := json.Marshal(braveResponse{})
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(body)), Header: make(http.Header), Request: r}, nil
	})}
	p := NewBraveProvider("key", client)

	resp, err := p.Search(context.Background(), SearchRequest{Query: "test"})
	require.NoError(t, err)
	require.Empty(t, resp.Results)
}
