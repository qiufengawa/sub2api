//go:build unit

package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type crsPriorityKind struct {
	collection  string
	id          string
	credentials map[string]any
	extra       map[string]any
}

var crsPriorityKinds = []crsPriorityKind{
	{collection: "claudeAccounts", id: "claude-1", credentials: map[string]any{"access_token": "token"}, extra: map[string]any{"authType": "oauth"}},
	{collection: "claudeConsoleAccounts", id: "console-1", credentials: map[string]any{"api_key": "key"}},
	{collection: "openaiOAuthAccounts", id: "openai-oauth-1", credentials: map[string]any{"access_token": "token"}},
	{collection: "openaiResponsesAccounts", id: "openai-responses-1", credentials: map[string]any{"api_key": "key"}},
	{collection: "geminiOAuthAccounts", id: "gemini-oauth-1", credentials: map[string]any{"refresh_token": "refresh"}},
	{collection: "geminiApiKeyAccounts", id: "gemini-key-1", credentials: map[string]any{"api_key": "key"}},
}

func buildCRSPriorityExport(priority *int, semantics string, pivot *int) map[string]any {
	data := map[string]any{"priority_semantics": semantics}
	if semantics == AccountPrioritySemanticsLowerWins {
		data["version"] = 1
	}
	if pivot != nil {
		data["priority_pivot"] = *pivot
	}
	for _, kind := range crsPriorityKinds {
		account := map[string]any{
			"kind": kind.collection, "id": kind.id, "name": kind.id,
			"isActive": true, "schedulable": true, "credentials": kind.credentials,
		}
		for key, value := range kind.extra {
			account[key] = value
		}
		if priority != nil {
			account["priority"] = *priority
		}
		data[kind.collection] = []any{account}
	}
	return data
}

func runCRSPrioritySync(t *testing.T, repo AccountRepository, data map[string]any) *SyncFromCRSResult {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/web/auth/login" {
			_, _ = response.Write([]byte(`{"success":true,"token":"admin-token"}`))
			return
		}
		require.NoError(t, json.NewEncoder(response).Encode(map[string]any{"success": true, "data": data}))
	}))
	t.Cleanup(server.Close)
	cfg := &config.Config{}
	cfg.Security.URLAllowlist.AllowInsecureHTTP = true
	svc := NewCRSSyncService(repo, nil, nil, nil, nil, cfg)
	result, err := svc.SyncFromCRS(context.Background(), SyncFromCRSInput{BaseURL: server.URL, Username: "admin", Password: "password"})
	require.NoError(t, err)
	return result
}

func newCRSPriorityRawService(t *testing.T, rawData string) (*CRSSyncService, SyncFromCRSInput) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		if request.URL.Path == "/web/auth/login" {
			_, _ = response.Write([]byte(`{"success":true,"token":"admin-token"}`))
			return
		}
		_, _ = response.Write([]byte(`{"success":true,"data":` + rawData + `}`))
	}))
	t.Cleanup(server.Close)
	cfg := &config.Config{}
	cfg.Security.URLAllowlist.AllowInsecureHTTP = true
	return NewCRSSyncService(newCRSLongContextAccountRepo(), nil, nil, nil, nil, cfg), SyncFromCRSInput{BaseURL: server.URL, Username: "admin", Password: "password"}
}

func TestCRSSyncPriorityAllAccountKinds(t *testing.T) {
	t.Run("create missing defaults zero", func(t *testing.T) {
		repo := newCRSLongContextAccountRepo()
		result := runCRSPrioritySync(t, repo, buildCRSPriorityExport(nil, AccountPrioritySemanticsHigherWins, nil))
		require.Equal(t, 6, result.Created)
		for _, kind := range crsPriorityKinds {
			require.Equal(t, 0, repo.accounts[kind.id].Priority)
		}
	})

	t.Run("explicit zero overwrites existing", func(t *testing.T) {
		repo := newCRSLongContextAccountRepo(crsPriorityExistingAccounts(17)...)
		zero := 0
		result := runCRSPrioritySync(t, repo, buildCRSPriorityExport(&zero, AccountPrioritySemanticsHigherWins, nil))
		require.Equal(t, 6, result.Updated)
		for _, kind := range crsPriorityKinds {
			require.Equal(t, 0, repo.accounts[kind.id].Priority)
		}
	})

	t.Run("update missing preserves existing", func(t *testing.T) {
		repo := newCRSLongContextAccountRepo(crsPriorityExistingAccounts(17)...)
		result := runCRSPrioritySync(t, repo, buildCRSPriorityExport(nil, AccountPrioritySemanticsHigherWins, nil))
		require.Equal(t, 6, result.Updated)
		for _, kind := range crsPriorityKinds {
			require.Equal(t, 17, repo.accounts[kind.id].Priority)
		}
	})

	t.Run("legacy converts using source pivot", func(t *testing.T) {
		repo := newCRSLongContextAccountRepo()
		priority, pivot := 7, 50
		result := runCRSPrioritySync(t, repo, buildCRSPriorityExport(&priority, AccountPrioritySemanticsLowerWins, &pivot))
		require.Equal(t, 6, result.Created)
		for _, kind := range crsPriorityKinds {
			require.Equal(t, 43, repo.accounts[kind.id].Priority)
		}
	})
}

func TestCRSPriorityErrorsConsistentBetweenPreviewAndSync(t *testing.T) {
	cases := map[string]string{
		"missing semantics":          `{"claudeAccounts":[{"id":"a","priority":1}]}`,
		"unknown semantics":          `{"priority_semantics":"mixed","claudeAccounts":[]}`,
		"legacy missing pivot":       `{"version":1,"priority_semantics":"lower_wins","claudeAccounts":[{"id":"a","priority":1}]}`,
		"legacy priority over pivot": `{"version":1,"priority_semantics":"lower_wins","priority_pivot":5,"claudeAccounts":[{"id":"a","priority":6}]}`,
		"null priority":              `{"priority_semantics":"higher_wins","claudeAccounts":[{"id":"a","priority":null}]}`,
		"negative zero priority":     `{"priority_semantics":"higher_wins","claudeAccounts":[{"id":"a","priority":-0}]}`,
		"decimal priority":           `{"priority_semantics":"higher_wins","claudeAccounts":[{"id":"a","priority":1.0}]}`,
		"exponent priority":          `{"priority_semantics":"higher_wins","claudeAccounts":[{"id":"a","priority":1e3}]}`,
		"string priority":            `{"priority_semantics":"higher_wins","claudeAccounts":[{"id":"a","priority":"1"}]}`,
		"boolean priority":           `{"priority_semantics":"higher_wins","claudeAccounts":[{"id":"a","priority":true}]}`,
		"overflow priority":          `{"priority_semantics":"higher_wins","claudeAccounts":[{"id":"a","priority":2147483648}]}`,
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			previewService, previewInput := newCRSPriorityRawService(t, raw)
			preview, previewErr := previewService.PreviewFromCRS(context.Background(), previewInput)
			require.Nil(t, preview)
			require.Error(t, previewErr)

			syncService, syncInput := newCRSPriorityRawService(t, raw)
			synced, syncErr := syncService.SyncFromCRS(context.Background(), syncInput)
			require.Nil(t, synced)
			require.Error(t, syncErr)
			require.Equal(t, previewErr.Error(), syncErr.Error())
		})
	}
}

func crsPriorityExistingAccounts(priority int) []*Account {
	existing := make([]*Account, 0, len(crsPriorityKinds))
	for i, kind := range crsPriorityKinds {
		platform, accountType := PlatformAnthropic, AccountTypeOAuth
		switch kind.collection {
		case "claudeConsoleAccounts":
			accountType = AccountTypeAPIKey
		case "openaiOAuthAccounts":
			platform = PlatformOpenAI
		case "openaiResponsesAccounts":
			platform, accountType = PlatformOpenAI, AccountTypeAPIKey
		case "geminiOAuthAccounts":
			platform = PlatformGemini
		case "geminiApiKeyAccounts":
			platform, accountType = PlatformGemini, AccountTypeAPIKey
		}
		existing = append(existing, &Account{ID: int64(i + 1), Priority: priority, Platform: platform, Type: accountType, Extra: map[string]any{"crs_account_id": kind.id}})
	}
	return existing
}
