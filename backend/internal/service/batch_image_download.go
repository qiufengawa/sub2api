package service

import (
	"archive/zip"
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/Wei-Shaw/sub2api/internal/config"
	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

const (
	defaultBatchImageZipMaxItems          = 200
	defaultBatchImageZipMaxBytes          = 512 * 1024 * 1024
	defaultBatchImageDownloadDuration     = 10 * time.Minute
	defaultBatchImageDownloadConcurrency  = 1
	batchImageDownloadScannerMaxLineBytes = 16 * 1024 * 1024
)

var errBatchImageDownloadSizeExceeded = errors.New("batch image download size limit exceeded")

type BatchImageDownloadLimiter interface {
	Acquire(ctx context.Context, userID string, kind string) (BatchImageDownloadPermit, error)
}

type BatchImageDownloadPermit interface {
	Release(ctx context.Context) error
}

type BatchImageContentStream struct {
	Reader        io.ReadCloser
	ContentType   string
	Filename      string
	ContentLength *int64
}

type BatchImageZipOptions struct {
	Status          string
	MaxItems        int
	IncludeManifest bool
}

type BatchImageZipResult struct {
	FileCount  int
	ErrorCount int
}

type BatchImageLineImages struct {
	CustomID     string
	Images       []BatchImageInlineImage
	ErrorCode    string
	ErrorMessage string
}

type BatchImageInlineImage struct {
	MimeType   string
	Extension  string
	Base64Data string
}

type BatchImageDownloadService struct {
	Repo             BatchImageRepository
	ProviderRegistry *BatchImageProviderRegistry
	AccountResolver  BatchImageAccountResolver
	Limiter          BatchImageDownloadLimiter
	Config           *config.Config
}

type batchImageDownloadLimitWriter struct {
	w       io.Writer
	limit   int64
	written int64
}

func (w *batchImageDownloadLimitWriter) Write(p []byte) (int, error) {
	if w == nil || w.w == nil {
		return 0, io.ErrClosedPipe
	}
	if w.limit > 0 && w.written+int64(len(p)) > w.limit {
		return 0, errBatchImageDownloadSizeExceeded
	}
	n, err := w.w.Write(p)
	w.written += int64(n)
	return n, err
}

func NewBatchImageDownloadService(repo BatchImageRepository, accountRepo AccountRepository, limiter BatchImageDownloadLimiter, cfg *config.Config) *BatchImageDownloadService {
	return &BatchImageDownloadService{
		Repo:             repo,
		ProviderRegistry: NewBatchImageProviderRegistryFromConfig(cfg),
		AccountResolver:  &BatchImageAccountRepositoryResolver{Repo: accountRepo},
		Limiter:          limiter,
		Config:           cfg,
	}
}

func (s *BatchImageDownloadService) OpenItemContent(ctx context.Context, owner BatchImageOwner, batchID string, customID string, imageIndex int) (*BatchImageContentStream, error) {
	if imageIndex < 0 {
		return nil, ErrBatchImageItemImageIndexOutOfRange
	}
	job, err := s.getCompletedJob(ctx, owner, batchID)
	if err != nil {
		return nil, err
	}
	item, err := s.Repo.GetBatchImageItemForDownload(ctx, job.BatchID, customID)
	if err != nil {
		return nil, err
	}
	if item.Status != BatchImageItemStatusSuccess {
		return nil, ErrBatchImageItemFailed
	}
	if imageIndex >= item.ImageCount {
		return nil, ErrBatchImageItemImageIndexOutOfRange
	}

	permit, err := s.acquirePermit(ctx, owner.UserID, "item")
	if err != nil {
		return nil, err
	}
	releasePermit := true
	defer func() {
		if releasePermit && permit != nil {
			_ = permit.Release(ctx)
		}
	}()

	provider, account, err := s.providerAndAccount(ctx, job)
	if err != nil {
		return nil, err
	}
	r, _, err := provider.OpenResult(ctx, job, account)
	if err != nil {
		return nil, ErrBatchImageResultMissing.WithCause(err)
	}
	defer func() { _ = r.Close() }()

	line, err := findBatchImageLineImages(r, item.CustomID)
	if err != nil {
		return nil, err
	}
	if imageIndex >= len(line.Images) {
		return nil, ErrBatchImageItemImageIndexOutOfRange
	}
	image := line.Images[imageIndex]
	if strings.TrimSpace(image.Base64Data) == "" {
		return nil, ErrBatchImageResultMissing
	}
	contentType := strings.TrimSpace(image.MimeType)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	extension := strings.TrimSpace(image.Extension)
	if extension == "" {
		extension = batchImageFileExtension(contentType)
	}
	if extension == "" {
		extension = "bin"
	}

	reader := base64.NewDecoder(base64.StdEncoding, strings.NewReader(image.Base64Data))
	releasePermit = false
	return &BatchImageContentStream{
		Reader:      &batchImagePermitReadCloser{Reader: reader, permit: permit},
		ContentType: contentType,
		Filename:    BatchImageSafeDownloadFilename(item.CustomID, extension),
	}, nil
}

func (s *BatchImageDownloadService) StreamZip(ctx context.Context, owner BatchImageOwner, batchID string, opts BatchImageZipOptions, w io.Writer) (*BatchImageZipResult, error) {
	includeSuccess, includeFailed, err := batchImageZipStatusSelection(opts.Status)
	if err != nil {
		return nil, err
	}
	root, jobs, aggregate, err := s.resolveZipJobs(ctx, owner, batchID, includeSuccess, includeFailed)
	if err != nil {
		return nil, err
	}
	maxItems := opts.MaxItems
	if cap := s.maxZipItems(); maxItems <= 0 || maxItems > cap {
		// 客户端传入的 max_items 不得放大管理员配置的 ZIP 上限。
		maxItems = cap
	}
	if !aggregate {
		if includeSuccess && root.SuccessCount > maxItems {
			return nil, ErrBatchImageZipTooManyItems
		}
		if includeFailed && root.FailCount > maxItems {
			return nil, ErrBatchImageZipTooManyItems
		}
	}

	// Load every source's items before opening any provider output.  This makes
	// aggregate limits deterministic and prevents a late source from producing
	// a partial archive after the item cap has already been exceeded.
	type sourceItems struct {
		job          *BatchImageJob
		successItems []*BatchImageItem
		failedItems  []*BatchImageItem
	}
	loaded := make([]sourceItems, 0, len(jobs))
	totalSuccess, totalFailed := 0, 0
	for _, source := range jobs {
		if source == nil {
			continue
		}
		entry := sourceItems{job: source}
		// A failed/cancelled root can still own successful provider output when
		// only a subset of its items failed and a retry child later completes the
		// remainder.  resolveZipJobs admits that root into the aggregate source
		// set; load its successful items as well instead of silently dropping the
		// already-produced images and making the aggregate appear incomplete.
		if includeSuccess && (source.Status == BatchImageJobStatusCompleted ||
			((source.Status == BatchImageJobStatusFailed || source.Status == BatchImageJobStatusCancelled) && source.SuccessCount > 0)) {
			entry.successItems, err = s.Repo.ListBatchImageItemsForDownload(ctx, source.BatchID, BatchImageItemStatusSuccess, maxItems+1)
			if err != nil {
				return nil, err
			}
			totalSuccess += len(entry.successItems)
		}
		if includeFailed && (!aggregate || source.ParentBatchID != nil) {
			// In an aggregate archive a fully recovered root must not report its
			// old failed rows as current errors.  Child failures remain useful
			// diagnostics, while an incomplete aggregate is rejected below.
			entry.failedItems, err = s.Repo.ListBatchImageItemsForDownload(ctx, source.BatchID, BatchImageItemStatusFailed, maxItems+1)
			if err != nil {
				return nil, err
			}
			totalFailed += len(entry.failedItems)
		}
		loaded = append(loaded, entry)
	}
	if includeSuccess && totalSuccess > maxItems {
		return nil, ErrBatchImageZipTooManyItems
	}
	if includeFailed && totalFailed > maxItems {
		return nil, ErrBatchImageZipTooManyItems
	}
	if aggregate && includeSuccess && totalSuccess < root.ItemCount {
		return nil, ErrBatchImageNotReady
	}

	result := &BatchImageZipResult{}
	var manifestFiles []batchImageZipManifestFile
	var zipErrors []batchImageZipError
	seenFilenames := make(map[string]struct{})
	streamCtx := ctx
	var cancel context.CancelFunc = func() {}
	if includeSuccess {
		permit, permitErr := s.acquirePermit(ctx, owner.UserID, "zip")
		if permitErr != nil {
			return nil, permitErr
		}
		if permit != nil {
			defer func() { _ = permit.Release(ctx) }()
		}
		if d := s.maxDownloadDuration(); d > 0 {
			streamCtx, cancel = context.WithTimeout(ctx, d)
		}
		defer cancel()
	}

	limitedWriter := &batchImageDownloadLimitWriter{w: w, limit: s.maxDownloadBytes()}
	zipWriter := zip.NewWriter(limitedWriter)
	for _, source := range loaded {
		if includeSuccess && len(source.successItems) > 0 {
			provider, account, providerErr := s.providerAndAccount(ctx, source.job)
			if providerErr != nil {
				return nil, providerErr
			}
			resultReader, _, openErr := provider.OpenResult(streamCtx, source.job, account)
			if openErr != nil {
				return nil, ErrBatchImageResultMissing.WithCause(openErr)
			}
			writeResult, writeManifest, writeErrors, writeErr := s.writeZipImages(streamCtx, zipWriter, resultReader, source.successItems, seenFilenames)
			_ = resultReader.Close()
			if writeErr != nil {
				_ = zipWriter.Close()
				if errors.Is(writeErr, errBatchImageDownloadSizeExceeded) {
					return writeResult, ErrBatchImageDownloadTooLarge.WithCause(writeErr)
				}
				return writeResult, ErrBatchImageDownloadFailed.WithCause(writeErr)
			}
			result.FileCount += writeResult.FileCount
			manifestFiles = append(manifestFiles, writeManifest...)
			zipErrors = append(zipErrors, writeErrors...)
		}
		if includeFailed {
			zipErrors = append(zipErrors, batchImageZipErrorsFromItems(source.failedItems)...)
		}
	}
	if err := writeBatchImageZipJSON(zipWriter, "manifest.json", batchImageZipManifest{
		BatchID:      root.BatchID,
		Model:        root.Model,
		ItemCount:    root.ItemCount,
		SuccessCount: totalSuccess,
		FailCount:    totalFailed,
		Files:        manifestFiles,
	}); err != nil {
		_ = zipWriter.Close()
		if errors.Is(err, errBatchImageDownloadSizeExceeded) {
			return result, ErrBatchImageDownloadTooLarge.WithCause(err)
		}
		return result, ErrBatchImageDownloadFailed.WithCause(err)
	}
	if err := writeBatchImageZipJSON(zipWriter, "errors.json", zipErrors); err != nil {
		_ = zipWriter.Close()
		if errors.Is(err, errBatchImageDownloadSizeExceeded) {
			return result, ErrBatchImageDownloadTooLarge.WithCause(err)
		}
		return result, ErrBatchImageDownloadFailed.WithCause(err)
	}
	result.ErrorCount = len(zipErrors)
	if err := zipWriter.Close(); err != nil {
		if errors.Is(err, errBatchImageDownloadSizeExceeded) {
			return result, ErrBatchImageDownloadTooLarge.WithCause(err)
		}
		return result, ErrBatchImageDownloadFailed.WithCause(err)
	}
	return result, nil
}

// resolveZipJobs builds the owner-scoped source set for a ZIP request.  A
// retry root can be represented by a failed/cancelled parent plus completed
// children; the frontend intentionally exposes that aggregate as one archive.
// We only enable that path for the default/success export and require enough
// completed child output to cover every root input item.
func (s *BatchImageDownloadService) resolveZipJobs(ctx context.Context, owner BatchImageOwner, batchID string, includeSuccess, includeFailed bool) (*BatchImageJob, []*BatchImageJob, bool, error) {
	if s == nil || s.Repo == nil {
		return nil, nil, false, ErrBatchImageDownloadFailed
	}
	root, err := s.Repo.GetBatchImageJobForDownload(ctx, owner.UserID, owner.APIKeyID, batchID)
	if err != nil {
		return nil, nil, false, err
	}
	if root.Status == BatchImageJobStatusOutputDeleted {
		return nil, nil, false, ErrBatchImageOutputDeleted
	}
	children, err := s.Repo.ListBatchImageChildJobsForDownload(ctx, owner.UserID, owner.APIKeyID, root.BatchID)
	if err != nil {
		return nil, nil, false, err
	}
	// Preserve the historical single-job behavior for failed-only exports and
	// jobs without retry children.
	if len(children) == 0 || (!includeSuccess && includeFailed) {
		if root.Status != BatchImageJobStatusCompleted {
			return nil, nil, false, ErrBatchImageNotReady
		}
		return root, []*BatchImageJob{root}, false, nil
	}

	aggregate := true
	jobs := make([]*BatchImageJob, 0, len(children)+1)
	if root.Status == BatchImageJobStatusCompleted ||
		root.Status == BatchImageJobStatusFailed || root.Status == BatchImageJobStatusCancelled {
		// Keep terminal roots in the source set. Failed/cancelled roots may have
		// produced a successful subset before a retry child completed the
		// remainder; StreamZip filters sources with no success items below.
		jobs = append(jobs, root)
	} else {
		return nil, nil, aggregate, ErrBatchImageNotReady
	}
	for _, child := range children {
		if child == nil {
			continue
		}
		switch child.Status {
		case BatchImageJobStatusCompleted:
			jobs = append(jobs, child)
		case BatchImageJobStatusOutputDeleted:
			return nil, nil, aggregate, ErrBatchImageOutputDeleted
		case BatchImageJobStatusFailed, BatchImageJobStatusCancelled:
			// Failed child rows are represented in errors.json only when an
			// aggregate is otherwise complete; they do not provide images.
		default:
			return nil, nil, aggregate, ErrBatchImageNotReady
		}
	}
	if len(jobs) == 0 {
		return nil, nil, aggregate, ErrBatchImageNotReady
	}
	return root, jobs, aggregate, nil
}

func batchImageZipStatusSelection(raw string) (includeSuccess, includeFailed bool, err error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "all":
		return true, true, nil
	case "success", "succeeded", "completed":
		return true, false, nil
	case "failed", "error":
		return false, true, nil
	default:
		return false, false, ErrBatchImageInvalidItems
	}
}

func (s *BatchImageDownloadService) writeZipImages(ctx context.Context, zipWriter *zip.Writer, resultReader io.Reader, successItems []*BatchImageItem, seenFilenames map[string]struct{}) (*BatchImageZipResult, []batchImageZipManifestFile, []batchImageZipError, error) {
	if seenFilenames == nil {
		seenFilenames = make(map[string]struct{})
	}
	successByID := make(map[string]*BatchImageItem, len(successItems))
	missing := make(map[string]struct{}, len(successItems))
	for _, item := range successItems {
		if item == nil {
			continue
		}
		successByID[item.CustomID] = item
		missing[item.CustomID] = struct{}{}
	}
	scanner := bufio.NewScanner(resultReader)
	scanner.Buffer(make([]byte, 0, 64*1024), batchImageDownloadScannerMaxLineBytes)

	result := &BatchImageZipResult{}
	var manifestFiles []batchImageZipManifestFile
	var zipErrors []batchImageZipError
	for scanner.Scan() {
		if err := ctx.Err(); err != nil {
			return result, manifestFiles, zipErrors, err
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		images, err := ExtractBatchImagePartsFromResultLine([]byte(line))
		if err != nil {
			return result, manifestFiles, zipErrors, err
		}
		item := successByID[images.CustomID]
		if item == nil {
			continue
		}
		delete(missing, images.CustomID)
		if len(images.Images) == 0 {
			zipErrors = append(zipErrors, batchImageZipError{CustomID: images.CustomID, Code: "EMPTY_IMAGE_OUTPUT", Message: "provider response contained no image output"})
			continue
		}
		for idx, image := range images.Images {
			extension := image.Extension
			if extension == "" {
				extension = "bin"
			}
			filename := uniqueBatchImageZipFilename(batchImageZipImageFilename(item.CustomID, idx, extension), seenFilenames)
			// Validate and fully decode the provider payload before creating a
			// ZIP entry.  Creating the entry first can leave a corrupt/empty image
			// file in an otherwise successful archive when malformed base64 is
			// returned by the provider.
			decoded, err := io.ReadAll(base64.NewDecoder(base64.StdEncoding, strings.NewReader(image.Base64Data)))
			if err != nil {
				return result, manifestFiles, zipErrors, err
			}
			entry, err := zipWriter.CreateHeader(&zip.FileHeader{Name: filename, Method: zip.Deflate})
			if err != nil {
				return result, manifestFiles, zipErrors, err
			}
			if _, err := entry.Write(decoded); err != nil {
				return result, manifestFiles, zipErrors, err
			}
			result.FileCount++
			manifestFiles = append(manifestFiles, batchImageZipManifestFile{
				CustomID:   item.CustomID,
				Filename:   filename,
				MimeType:   image.MimeType,
				ImageIndex: idx,
			})
		}
	}
	if err := scanner.Err(); err != nil {
		return result, manifestFiles, zipErrors, err
	}
	missingIDs := make([]string, 0, len(missing))
	for customID := range missing {
		missingIDs = append(missingIDs, customID)
	}
	sort.Strings(missingIDs)
	for _, customID := range missingIDs {
		zipErrors = append(zipErrors, batchImageZipError{CustomID: customID, Code: "RESULT_MISSING", Message: "provider result was not found for item"})
	}
	return result, manifestFiles, zipErrors, nil
}

func (s *BatchImageDownloadService) getCompletedJob(ctx context.Context, owner BatchImageOwner, batchID string) (*BatchImageJob, error) {
	if s == nil || s.Repo == nil {
		return nil, ErrBatchImageDownloadFailed
	}
	job, err := s.Repo.GetBatchImageJobForDownload(ctx, owner.UserID, owner.APIKeyID, batchID)
	if err != nil {
		return nil, err
	}
	if job.OutputDeletedAt != nil {
		return nil, ErrBatchImageOutputDeleted
	}
	switch job.Status {
	case BatchImageJobStatusCompleted:
		return job, nil
	case BatchImageJobStatusFailed, BatchImageJobStatusCancelled:
		// A terminal root may have produced a successful subset before a
		// retry child completed the remaining items.  Item-content requests for
		// that retained subset still have a valid provider source; the item
		// status check below prevents failed rows from being exposed.
		if job.SuccessCount > 0 && strings.TrimSpace(batchImageDerefString(job.ProviderOutputRef)) != "" {
			return job, nil
		}
	case BatchImageJobStatusOutputDeleted:
		return nil, ErrBatchImageOutputDeleted
	default:
		return nil, ErrBatchImageNotReady
	}
	return nil, ErrBatchImageNotReady
}

func (s *BatchImageDownloadService) providerAndAccount(ctx context.Context, job *BatchImageJob) (BatchImageProvider, *Account, error) {
	if s == nil || s.ProviderRegistry == nil || s.AccountResolver == nil || job == nil {
		return nil, nil, ErrBatchImageDownloadFailed
	}
	provider, ok := s.ProviderRegistry.Get(job.Provider)
	if !ok || provider == nil {
		return nil, nil, ErrBatchImageUnsupportedProvider
	}
	if job.AccountID == nil || *job.AccountID <= 0 {
		return nil, nil, ErrBatchImageMissingAccountID
	}
	account, err := s.AccountResolver.ResolveBatchImageAccount(ctx, *job.AccountID)
	if err != nil {
		return nil, nil, ErrBatchImageDownloadFailed
	}
	if !provider.SupportsAccount(account) {
		return nil, nil, ErrBatchImageProviderUnsupportedAccount
	}
	return provider, account, nil
}

func (s *BatchImageDownloadService) acquirePermit(ctx context.Context, userID int64, kind string) (BatchImageDownloadPermit, error) {
	if s == nil || s.Limiter == nil {
		return nil, nil
	}
	permit, err := s.Limiter.Acquire(ctx, fmt.Sprintf("%d", userID), kind)
	if err != nil {
		if infraerrors.Code(err) == http.StatusTooManyRequests {
			return nil, ErrBatchImageDownloadLimited
		}
		return nil, ErrBatchImageDownloadLimited.WithCause(err)
	}
	return permit, nil
}

func (s *BatchImageDownloadService) maxZipItems() int {
	if s != nil && s.Config != nil && s.Config.BatchImage.MaxDownloadItemsZip > 0 {
		return s.Config.BatchImage.MaxDownloadItemsZip
	}
	return defaultBatchImageZipMaxItems
}

func (s *BatchImageDownloadService) maxDownloadBytes() int64 {
	if s != nil && s.Config != nil && s.Config.BatchImage.MaxDownloadBytesPerRequest > 0 {
		return s.Config.BatchImage.MaxDownloadBytesPerRequest
	}
	return defaultBatchImageZipMaxBytes
}

func (s *BatchImageDownloadService) maxDownloadDuration() time.Duration {
	if s != nil && s.Config != nil && s.Config.BatchImage.MaxDownloadDurationSeconds > 0 {
		return time.Duration(s.Config.BatchImage.MaxDownloadDurationSeconds) * time.Second
	}
	return defaultBatchImageDownloadDuration
}

func ExtractBatchImagePartsFromResultLine(line []byte) (*BatchImageLineImages, error) {
	var obj map[string]any
	if err := json.Unmarshal(line, &obj); err != nil {
		return nil, ErrBatchImageIndexParseFailed.WithCause(err)
	}
	customID := batchImageFirstNonEmptyString(
		batchImageMapString(obj, "key"),
		batchImageMapString(obj, "custom_id"),
		batchImageMapString(obj, "customId"),
		batchImageNestedString(obj, "request", "key"),
	)
	if customID == "" {
		return nil, ErrBatchImageIndexParseFailed.WithCause(fmt.Errorf("missing custom id"))
	}
	out := &BatchImageLineImages{CustomID: customID}
	out.Images = append(out.Images, extractBatchImageInlineImages(batchImageNestedAny(obj, "response", "candidates"))...)
	out.Images = append(out.Images, extractBatchImageInlineImages(obj["candidates"])...)
	if len(out.Images) > 0 {
		return out, nil
	}
	if code, message, ok := batchImageFailureFromProviderFields(obj); ok {
		out.ErrorCode = code
		out.ErrorMessage = truncateBatchImageMessage(message, batchImageMaxErrorMessageLength)
		return out, nil
	}
	if _, hasResponse := obj["response"]; hasResponse || batchImageHasCandidates(obj) {
		out.ErrorCode = "EMPTY_IMAGE_OUTPUT"
		out.ErrorMessage = "provider response contained no image output"
		return out, nil
	}
	out.ErrorCode = "PROVIDER_ITEM_FAILED"
	out.ErrorMessage = "provider result line contained no image output"
	return out, nil
}

func extractBatchImageInlineImages(raw any) []BatchImageInlineImage {
	candidates, ok := raw.([]any)
	if !ok {
		return nil
	}
	var images []BatchImageInlineImage
	for _, candidateRaw := range candidates {
		candidate, ok := candidateRaw.(map[string]any)
		if !ok {
			continue
		}
		parts, ok := batchImageNestedAny(candidate, "content", "parts").([]any)
		if !ok {
			continue
		}
		for _, partRaw := range parts {
			part, ok := partRaw.(map[string]any)
			if !ok {
				continue
			}
			inline, ok := firstMap(part["inlineData"], part["inline_data"])
			if !ok {
				continue
			}
			data := strings.TrimSpace(batchImageMapString(inline, "data"))
			mime := strings.TrimSpace(batchImageFirstNonEmptyString(batchImageMapString(inline, "mimeType"), batchImageMapString(inline, "mime_type")))
			if data == "" || !strings.HasPrefix(strings.ToLower(mime), "image/") {
				continue
			}
			images = append(images, BatchImageInlineImage{
				MimeType:   mime,
				Extension:  batchImageFileExtension(mime),
				Base64Data: data,
			})
		}
	}
	return images
}

func findBatchImageLineImages(r io.Reader, customID string) (*BatchImageLineImages, error) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), batchImageDownloadScannerMaxLineBytes)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		parsed, err := ExtractBatchImagePartsFromResultLine([]byte(line))
		if err != nil {
			return nil, err
		}
		if parsed.CustomID != customID {
			continue
		}
		if len(parsed.Images) == 0 {
			if parsed.ErrorCode != "" {
				return nil, ErrBatchImageItemFailed
			}
			return nil, ErrBatchImageResultMissing
		}
		return parsed, nil
	}
	if err := scanner.Err(); err != nil {
		return nil, ErrBatchImageDownloadFailed.WithCause(err)
	}
	return nil, ErrBatchImageResultMissing
}

func BatchImageSafeDownloadFilename(customID, extension string) string {
	base := sanitizeBatchImageFilenameBase(customID)
	extension = sanitizeBatchImageFilenameExtension(extension)
	if extension == "" {
		extension = "bin"
	}
	return base + "." + extension
}

func BatchImageContentDispositionAttachment(filename string) string {
	filename = strings.ReplaceAll(filename, "\\", "_")
	filename = strings.ReplaceAll(filename, `"`, "_")
	filename = sanitizeBatchImageFilenameBase(strings.TrimSuffix(filename, filepath.Ext(filename))) + filepath.Ext(filename)
	return `attachment; filename="` + filename + `"`
}

func sanitizeBatchImageFilenameBase(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "image"
	}
	var b strings.Builder
	for _, r := range value {
		switch {
		case r == '/' || r == '\\' || r == ':' || r == 0:
			_ = b.WriteByte('_')
		case unicode.IsControl(r):
			_ = b.WriteByte('_')
		case unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-' || r == '.':
			_, _ = b.WriteRune(r)
		default:
			_ = b.WriteByte('_')
		}
	}
	out := strings.Trim(b.String(), ". ")
	for strings.Contains(out, "..") {
		out = strings.ReplaceAll(out, "..", "_")
	}
	out = strings.Trim(out, ". ")
	if out == "" {
		out = "image"
	}
	if len(out) > 120 {
		out = strings.TrimRight(out[:120], ". ")
	}
	if out == "" {
		out = "image"
	}
	return out
}

func sanitizeBatchImageFilenameExtension(extension string) string {
	extension = strings.TrimPrefix(strings.TrimSpace(strings.ToLower(extension)), ".")
	var b strings.Builder
	for _, r := range extension {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			_, _ = b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 12 {
		out = out[:12]
	}
	return out
}

func batchImageZipImageFilename(customID string, imageIndex int, extension string) string {
	base := sanitizeBatchImageFilenameBase(customID)
	if imageIndex > 0 {
		base = fmt.Sprintf("%s_%d", base, imageIndex+1)
	}
	return "images/" + BatchImageSafeDownloadFilename(base, extension)
}

// uniqueBatchImageZipFilename keeps every successful image addressable when
// distinct custom IDs normalize to the same safe filename (for example
// "a..b" and "a_b").  ZIP permits duplicate names, but many extractors map
// them by name and silently overwrite one image, so suffix collisions in a
// deterministic encounter order instead.
func uniqueBatchImageZipFilename(filename string, seen map[string]struct{}) string {
	if _, exists := seen[filename]; !exists {
		seen[filename] = struct{}{}
		return filename
	}
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	for suffix := 2; ; suffix++ {
		candidate := fmt.Sprintf("%s_%d%s", base, suffix, ext)
		if _, exists := seen[candidate]; exists {
			continue
		}
		seen[candidate] = struct{}{}
		return candidate
	}
}

func writeBatchImageZipJSON(zipWriter *zip.Writer, name string, value any) error {
	entry, err := zipWriter.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Deflate})
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(entry)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

type batchImageZipManifest struct {
	BatchID      string                      `json:"batch_id"`
	Model        string                      `json:"model"`
	ItemCount    int                         `json:"item_count"`
	SuccessCount int                         `json:"success_count"`
	FailCount    int                         `json:"fail_count"`
	Files        []batchImageZipManifestFile `json:"files"`
}

type batchImageZipManifestFile struct {
	CustomID   string `json:"custom_id"`
	Filename   string `json:"filename"`
	MimeType   string `json:"mime_type"`
	ImageIndex int    `json:"image_index"`
}

type batchImageZipError struct {
	CustomID string `json:"custom_id"`
	Code     string `json:"code"`
	Message  string `json:"message"`
}

func batchImageZipErrorsFromItems(items []*BatchImageItem) []batchImageZipError {
	out := make([]batchImageZipError, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		out = append(out, batchImageZipError{
			CustomID: item.CustomID,
			Code:     batchImageDerefString(item.ErrorCode),
			Message:  sanitizeBatchImagePublicMessage(batchImageDerefString(item.ErrorMessage)),
		})
	}
	return out
}

type batchImagePermitReadCloser struct {
	io.Reader
	permit BatchImageDownloadPermit
	once   sync.Once
	err    error
}

func (r *batchImagePermitReadCloser) Close() error {
	r.once.Do(func() {
		if r.permit != nil {
			r.err = r.permit.Release(context.Background())
		}
	})
	return r.err
}
