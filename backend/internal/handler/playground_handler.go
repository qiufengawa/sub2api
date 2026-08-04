package handler

import (
	"context"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	servermiddleware "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// PlaygroundHandler serves authenticated panel-only Playground metadata.
// Model requests themselves continue through the existing gateway handlers.
type PlaygroundHandler struct {
	apiKeyService playgroundAPIKeyOptionLister
}

type playgroundAPIKeyOptionLister interface {
	ListPlaygroundOptions(ctx context.Context, userID int64) (*service.PlaygroundAPIKeyOptionList, error)
}

func NewPlaygroundHandler(apiKeyService *service.APIKeyService) *PlaygroundHandler {
	return &PlaygroundHandler{apiKeyService: apiKeyService}
}

type playgroundKeyOption struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	GroupID   *int64 `json:"group_id"`
	GroupName string `json:"group_name"`
	Platform  string `json:"platform"`
}

type playgroundKeyOptionList struct {
	Items     []playgroundKeyOption `json:"items"`
	Truncated bool                  `json:"truncated"`
}

// ListKeys returns a credential-free list of API keys for the Playground.
func (h *PlaygroundHandler) ListKeys(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	subject, ok := servermiddleware.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return
	}

	result, err := h.apiKeyService.ListPlaygroundOptions(c.Request.Context(), subject.UserID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}

	out := make([]playgroundKeyOption, 0, len(result.Items))
	for i := range result.Items {
		item := playgroundKeyOption{
			ID:        result.Items[i].ID,
			Name:      strings.TrimSpace(result.Items[i].Name),
			Status:    result.Items[i].Status,
			GroupID:   result.Items[i].GroupID,
			GroupName: strings.TrimSpace(result.Items[i].GroupName),
			Platform:  strings.TrimSpace(result.Items[i].Platform),
		}
		out = append(out, item)
	}

	response.Success(c, playgroundKeyOptionList{Items: out, Truncated: result.Truncated})
}
