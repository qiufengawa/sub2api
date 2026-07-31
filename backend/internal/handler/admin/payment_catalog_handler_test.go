package admin

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func decodeCatalogBodyForTest(t *testing.T, body string, dst any) error {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/api/v1/admin/payment/catalog/import/preview", strings.NewReader(body))
	return decodePaymentCatalogJSON(ctx, dst)
}

func TestDecodePaymentCatalogJSONStrictness(t *testing.T) {
	gin.SetMode(gin.TestMode)
	valid := `{"schema_version":1,"mode":"upsert","defaults":{},"groups":[],"plans":[]}`

	t.Run("valid", func(t *testing.T) {
		var dst map[string]any
		if err := decodeCatalogBodyForTest(t, valid, &dst); err != nil {
			t.Fatalf("valid body rejected: %v", err)
		}
	})

	t.Run("unknown field", func(t *testing.T) {
		var dst struct {
			SchemaVersion int `json:"schema_version"`
		}
		err := decodeCatalogBodyForTest(t, `{"schema_version":1,"secret":"no"}`, &dst)
		if err == nil || !strings.Contains(err.Error(), "unknown field") {
			t.Fatalf("expected unknown field error, got %v", err)
		}
	})

	t.Run("trailing object", func(t *testing.T) {
		var dst map[string]any
		err := decodeCatalogBodyForTest(t, valid+` {}`, &dst)
		if err == nil || !strings.Contains(err.Error(), "exactly one JSON object") {
			t.Fatalf("expected trailing object error, got %v", err)
		}
	})

	t.Run("body limit", func(t *testing.T) {
		var dst map[string]any
		err := decodeCatalogBodyForTest(t, strings.Repeat(" ", paymentCatalogImportBodyLimit+1), &dst)
		if err == nil || !strings.Contains(err.Error(), "1 MiB") {
			t.Fatalf("expected body limit error, got %v", err)
		}
	})
}
