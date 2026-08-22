package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const defaultImageMaxDownloadBytes int64 = 32 << 20 // 32 MiB

// ImageStorage 把图片字节写入对象存储并返回可访问 URL。
//
// 这是对象存储的可插拔抽象：适配一个新的对象存储厂商，只需实现本接口
// （例如包一个厂商 SDK），无需改动任务/网关逻辑。仓库内自带一个 S3 兼容实现
// （repository.S3ImageStorage），适用于 AWS S3 / Cloudflare R2 / 阿里云 OSS / MinIO 等。
type ImageStorage interface {
	// Save 把 data 以 key 存入对象存储，返回可下载的 URL（公开直链或 presigned 临时链接）。
	// contentType 为图片 MIME 类型，如 "image/png"。
	Save(ctx context.Context, key, contentType string, data []byte) (url string, err error)
}

// ImageStorageObjectDeleter is an optional companion to ImageStorage.  When an
// uploader has already persisted earlier images but a later image fails, it
// uses this hook to roll those objects back.  Keeping the hook optional
// preserves compatibility with storage adapters that only support writes;
// the built-in S3 adapter implements it so production uploads are
// compensating rather than silently orphaning objects.
type ImageStorageObjectDeleter interface {
	Delete(ctx context.Context, key string) error
}

// ImageResultUploader 是 ImageStorage 的上层编排器（与具体厂商无关）：
// 把上游生图响应里的每张图片（b64_json 解码 / url 下载）转存到对象存储，
// 并把响应结果改写为只含短链接的紧凑 JSON，从而避免大 base64 落 Redis。
type ImageResultUploader struct {
	storage          ImageStorage
	httpClient       *http.Client
	prefix           string
	maxDownloadBytes int64
}

// NewImageResultUploader 构造一个 uploader；storage 为 nil 时 Rewrite 直接透传。
func NewImageResultUploader(storage ImageStorage, prefix string, maxDownloadBytes int64, httpClient *http.Client) *ImageResultUploader {
	if httpClient == nil {
		httpClient = defaultImageDownloadHTTPClient()
	}
	if maxDownloadBytes <= 0 {
		maxDownloadBytes = defaultImageMaxDownloadBytes
	}
	return &ImageResultUploader{
		storage:          storage,
		httpClient:       httpClient,
		prefix:           prefix,
		maxDownloadBytes: maxDownloadBytes,
	}
}

func defaultImageDownloadHTTPClient() *http.Client {
	var transport *http.Transport
	if base, ok := http.DefaultTransport.(*http.Transport); ok && base != nil {
		transport = base.Clone()
	} else {
		// http.DefaultTransport is intentionally replaceable (and tests often
		// install a custom RoundTripper).  Do not panic when it is not an
		// *http.Transport; the safe dial policy below still applies to the
		// fallback transport.
		transport = &http.Transport{}
	}
	// Image URLs are provider-controlled input.  Reuse the package's DNS-aware
	// dial guard so a hostname that resolves to loopback/private/link-local
	// space is rejected at the actual socket dial (including DNS rebinding).
	transport.DialContext = safeDialContext
	return &http.Client{Timeout: 60 * time.Second, Transport: transport}
}

// Rewrite 将 result（上游生图响应 JSON）里的每张图片转存到对象存储，
// 返回改写后的紧凑结果（data[i].url 指向对象存储，b64_json 被移除）。
// 任一图片转存失败即返回 error（调用方据此将任务标记为失败，绝不把大 blob 落 Redis）。
func (u *ImageResultUploader) Rewrite(ctx context.Context, taskID string, result json.RawMessage) (json.RawMessage, error) {
	if u == nil || u.storage == nil {
		return result, nil
	}
	var top map[string]json.RawMessage
	if err := json.Unmarshal(result, &top); err != nil {
		return nil, fmt.Errorf("parse image response: %w", err)
	}
	rawData, ok := top["data"]
	if !ok {
		// 没有 data 数组（结构不符合预期），保持原样返回，交由上层决定。
		return result, nil
	}
	var items []map[string]json.RawMessage
	if err := json.Unmarshal(rawData, &items); err != nil {
		return nil, fmt.Errorf("parse image response data: %w", err)
	}
	if len(items) == 0 {
		return result, nil
	}
	savedKeys := make([]string, 0, len(items))
	rollback := func(cause error) error {
		if len(savedKeys) == 0 {
			return cause
		}
		deleter, ok := u.storage.(ImageStorageObjectDeleter)
		if !ok {
			// Third-party adapters may not expose deletion.  Preserve the
			// original error while making the lack of compensation explicit in
			// logs/diagnostics at the call site.
			return fmt.Errorf("%w (stored %d earlier image object(s); storage adapter has no rollback)", cause, len(savedKeys))
		}
		// A cancelled request must not prevent cleanup of objects that were
		// already committed.  Bound compensation so a broken storage backend
		// cannot hold the worker forever.
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
		defer cancel()
		var cleanupErrs []string
		for i := len(savedKeys) - 1; i >= 0; i-- {
			if err := deleter.Delete(cleanupCtx, savedKeys[i]); err != nil {
				cleanupErrs = append(cleanupErrs, fmt.Sprintf("%s: %v", savedKeys[i], err))
			}
		}
		if len(cleanupErrs) > 0 {
			return fmt.Errorf("%w (rollback failed: %s)", cause, strings.Join(cleanupErrs, "; "))
		}
		return cause
	}
	for i, item := range items {
		data, contentType, err := u.fetchImageBytes(ctx, item)
		if err != nil {
			return nil, rollback(fmt.Errorf("image %d: %w", i, err))
		}
		key := u.buildKey(taskID, i, contentType)
		url, err := u.storage.Save(ctx, key, contentType, data)
		if err != nil {
			return nil, rollback(fmt.Errorf("image %d: upload to object storage: %w", i, err))
		}
		savedKeys = append(savedKeys, key)
		urlRaw, err := json.Marshal(url)
		if err != nil {
			return nil, rollback(fmt.Errorf("image %d: encode url: %w", i, err))
		}
		item["url"] = urlRaw
		delete(item, "b64_json")
		items[i] = item
	}
	newData, err := json.Marshal(items)
	if err != nil {
		return nil, rollback(fmt.Errorf("encode image response data: %w", err))
	}
	top["data"] = newData
	out, err := json.Marshal(top)
	if err != nil {
		return nil, rollback(fmt.Errorf("encode image response: %w", err))
	}
	return out, nil
}

func (u *ImageResultUploader) fetchImageBytes(ctx context.Context, item map[string]json.RawMessage) ([]byte, string, error) {
	if raw, ok := item["b64_json"]; ok {
		var b64 string
		if err := json.Unmarshal(raw, &b64); err == nil {
			if b64 = strings.TrimSpace(b64); b64 != "" {
				data, err := base64.StdEncoding.DecodeString(b64)
				if err != nil {
					return nil, "", fmt.Errorf("decode b64_json: %w", err)
				}
				return data, detectImageContentType(data), nil
			}
		}
	}
	if raw, ok := item["url"]; ok {
		var rawURL string
		if err := json.Unmarshal(raw, &rawURL); err == nil {
			if rawURL = strings.TrimSpace(rawURL); rawURL != "" {
				if len(rawURL) >= len("data:") && strings.EqualFold(rawURL[:len("data:")], "data:") {
					return u.decodeImageDataURL(rawURL)
				}
				return u.download(ctx, rawURL)
			}
		}
	}
	return nil, "", errors.New("image item has neither b64_json nor url")
}

func (u *ImageResultUploader) decodeImageDataURL(rawURL string) ([]byte, string, error) {
	header, payload, ok := strings.Cut(rawURL[len("data:"):], ",")
	if !ok {
		return nil, "", errors.New("decode image data URL: missing comma separator")
	}

	parts := strings.Split(header, ";")
	if strings.TrimSpace(parts[0]) == "" {
		return nil, "", errors.New("decode image data URL: missing media type")
	}
	base64Index := len(parts) - 1
	if base64Index < 1 || !strings.EqualFold(strings.TrimSpace(parts[base64Index]), "base64") {
		for i := 1; i < base64Index; i++ {
			if strings.EqualFold(strings.TrimSpace(parts[i]), "base64") {
				return nil, "", errors.New("decode image data URL: base64 marker must be the final header token")
			}
		}
		return nil, "", errors.New("decode image data URL: payload is not base64 encoded")
	}
	for i := 1; i < base64Index; i++ {
		if strings.EqualFold(strings.TrimSpace(parts[i]), "base64") {
			return nil, "", errors.New("decode image data URL: duplicate base64 marker")
		}
	}
	mediaTypeHeader := strings.Join(parts[:base64Index], ";")
	declaredType, _, err := mime.ParseMediaType(mediaTypeHeader)
	if err != nil {
		return nil, "", fmt.Errorf("decode image data URL: invalid media type: %w", err)
	}
	declaredType = strings.ToLower(declaredType)
	if !strings.HasPrefix(declaredType, "image/") {
		return nil, "", fmt.Errorf("decode image data URL: media type %q is not an image", declaredType)
	}

	limit := u.maxDownloadBytes
	if limit <= 0 {
		limit = defaultImageMaxDownloadBytes
	}
	decoder := base64.NewDecoder(base64.StdEncoding, strings.NewReader(payload))
	data, err := io.ReadAll(io.LimitReader(decoder, limit+1))
	if err != nil {
		return nil, "", fmt.Errorf("decode image data URL base64 payload: %w", err)
	}
	if int64(len(data)) > limit {
		return nil, "", fmt.Errorf("decoded image data URL exceeds %d bytes", limit)
	}

	contentType := detectedImageContentType(data)
	if contentType == "" {
		contentType = declaredType
	}
	return data, contentType, nil
}

func (u *ImageResultUploader) download(ctx context.Context, rawURL string) ([]byte, string, error) {
	if err := validateImageDownloadURL(rawURL); err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("build download request: %w", err)
	}
	client := u.httpClient
	if client == nil {
		client = defaultImageDownloadHTTPClient()
	}
	// Do not trust a caller-provided client to validate redirects.  Clone the
	// client for this request and fence every redirect target before net/http
	// follows it.  The original policy (if any) still runs after our guard.
	clientCopy := *client
	// An http.Client with a nil Transport implicitly uses http.DefaultTransport.
	// Replace that implicit fallback with our SSRF-aware transport; otherwise a
	// caller-provided (but otherwise empty) client would silently bypass the
	// DNS/IP dial guard used by the default uploader client.
	if clientCopy.Transport == nil {
		clientCopy.Transport = defaultImageDownloadHTTPClient().Transport
	}
	originalRedirect := client.CheckRedirect
	clientCopy.CheckRedirect = func(next *http.Request, via []*http.Request) error {
		if err := validateImageDownloadURL(next.URL.String()); err != nil {
			return err
		}
		if originalRedirect != nil {
			return originalRedirect(next, via)
		}
		return nil
	}
	resp, err := clientCopy.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("download image: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, "", fmt.Errorf("download image: unexpected status %d", resp.StatusCode)
	}
	limit := u.maxDownloadBytes
	if limit <= 0 {
		limit = defaultImageMaxDownloadBytes
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, "", fmt.Errorf("read image body: %w", err)
	}
	if int64(len(data)) > limit {
		return nil, "", fmt.Errorf("downloaded image exceeds %d bytes", limit)
	}
	contentType := strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0])
	if !strings.HasPrefix(contentType, "image/") {
		contentType = detectImageContentType(data)
	}
	return data, contentType, nil
}

// validateImageDownloadURL blocks unsafe URL forms before a custom transport
// (including test transports) gets a chance to issue the request.  Literal IP
// checks cover the common SSRF targets; the production transport additionally
// applies safeDialContext to all DNS-resolved addresses.
func validateImageDownloadURL(rawURL string) error {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return fmt.Errorf("download image: invalid URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("download image: unsupported URL scheme %q", u.Scheme)
	}
	if u.Host == "" || u.Hostname() == "" {
		return errors.New("download image: URL host is required")
	}
	if u.User != nil {
		return errors.New("download image: URL userinfo is not allowed")
	}
	hostname := strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
	if isBlockedHostname(hostname) {
		return fmt.Errorf("download image: host %q is blocked", hostname)
	}
	if ip := net.ParseIP(hostname); ip != nil && isPrivateIP(ip) {
		return fmt.Errorf("download image: host %q is blocked", hostname)
	}
	return nil
}

func (u *ImageResultUploader) buildKey(taskID string, index int, contentType string) string {
	return u.prefix + taskID + "-" + strconv.Itoa(index) + extensionForContentType(contentType)
}

func detectImageContentType(data []byte) string {
	if ct := detectedImageContentType(data); ct != "" {
		return ct
	}
	return "image/png"
}

func detectedImageContentType(data []byte) string {
	ct := strings.TrimSpace(strings.Split(http.DetectContentType(data), ";")[0])
	if strings.HasPrefix(ct, "image/") {
		return ct
	}
	return ""
}

func extensionForContentType(ct string) string {
	switch {
	case strings.Contains(ct, "png"):
		return ".png"
	case strings.Contains(ct, "jpeg"), strings.Contains(ct, "jpg"):
		return ".jpg"
	case strings.Contains(ct, "webp"):
		return ".webp"
	case strings.Contains(ct, "gif"):
		return ".gif"
	default:
		return ".png"
	}
}
