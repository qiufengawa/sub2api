//go:build unit

package service

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type updateServiceCacheStub struct {
	data string
}

func (s *updateServiceCacheStub) GetUpdateInfo(context.Context) (string, error) {
	if s.data == "" {
		return "", errors.New("cache miss")
	}
	return s.data, nil
}

func (s *updateServiceCacheStub) SetUpdateInfo(_ context.Context, data string, _ time.Duration) error {
	s.data = data
	return nil
}

type updateServiceGitHubClientStub struct {
	release        *GitHubRelease
	recentReleases []*GitHubRelease
	recentErr      error
	latestRepo     string
	recentRepo     string
}

func (s *updateServiceGitHubClientStub) FetchLatestRelease(_ context.Context, repo string) (*GitHubRelease, error) {
	s.latestRepo = repo
	return s.release, nil
}

func (s *updateServiceGitHubClientStub) FetchRecentReleases(_ context.Context, repo string, _ int) ([]*GitHubRelease, error) {
	s.recentRepo = repo
	return s.recentReleases, s.recentErr
}

func (s *updateServiceGitHubClientStub) DownloadFile(context.Context, string, string, int64) error {
	panic("DownloadFile should not be called when no update is available")
}

func (s *updateServiceGitHubClientStub) FetchChecksumFile(context.Context, string) ([]byte, error) {
	panic("FetchChecksumFile should not be called when no update is available")
}

func TestUpdateServicePerformUpdateNoUpdateReturnsSentinel(t *testing.T) {
	svc := NewUpdateService(
		&updateServiceCacheStub{},
		&updateServiceGitHubClientStub{
			release: &GitHubRelease{
				TagName: "v0.1.132",
				Name:    "v0.1.132",
			},
		},
		"0.1.132",
		"release",
	)

	err := svc.PerformUpdate(context.Background())

	require.Error(t, err)
	require.True(t, errors.Is(err, ErrNoUpdateAvailable))
	require.ErrorIs(t, err, ErrNoUpdateAvailable)
}

func TestUpdateServiceUsesCustomDistributionRepository(t *testing.T) {
	client := &updateServiceGitHubClientStub{
		release: &GitHubRelease{TagName: "v0.1.168-qiu.1", Name: "Sub2API UI 0.1.168-qiu.1"},
		recentReleases: []*GitHubRelease{
			{TagName: "v0.9.0"},
		},
	}
	svc := NewUpdateService(&updateServiceCacheStub{}, client, "0.1.168", "release")

	info, err := svc.CheckUpdate(context.Background(), true)
	require.NoError(t, err)
	require.True(t, info.HasUpdate)
	require.Equal(t, "0.1.168-qiu.1", info.LatestVersion)
	require.Equal(t, "qiufengawa/sub2api", client.latestRepo)

	_, err = svc.ListRollbackVersions(context.Background())
	require.NoError(t, err)
	require.Equal(t, "qiufengawa/sub2api", client.recentRepo)
}

func TestCompareVersionsUsesUpstreamBaselineThenForkRevision(t *testing.T) {
	tests := []struct {
		name    string
		current string
		latest  string
		want    int
	}{
		{name: "qiu revision increments", current: "0.1.168-qiu.1", latest: "0.1.168-qiu.2", want: -1},
		{name: "qiu patch increments", current: "0.1.169-qiu.3", latest: "0.1.169-qiu.3.1", want: -1},
		{name: "qiu patch compares numerically", current: "0.1.169-qiu.3.10", latest: "0.1.169-qiu.3.2", want: 1},
		{name: "next qiu revision wins over patches", current: "0.1.169-qiu.3.99", latest: "0.1.169-qiu.4", want: -1},
		{name: "zero patch matches legacy whole revision", current: "0.1.169-qiu.3", latest: "0.1.169-qiu.3.0", want: 0},
		{name: "upstream baseline wins over qiu revision", current: "0.1.168-qiu.99", latest: "0.1.169-qiu.1", want: -1},
		{name: "newer upstream wins after qiu revision increments", current: "0.1.169-qiu.1", latest: "0.1.168-qiu.99", want: 1},
		{name: "outer v prefix is ignored for qiu revision", current: "v0.1.168-qiu.1", latest: "0.1.168-qiu.1", want: 0},
		{name: "plain upstream is revision zero", current: "0.1.168", latest: "0.1.168-qiu.1", want: -1},
		{name: "historical standalone release upgrades to qiu revision", current: "1.0.0", latest: "0.1.168-qiu.1", want: -1},
		{name: "qiu revision is newer than historical standalone release", current: "0.1.168-qiu.1", latest: "1.0.0", want: 1},
		{name: "qiu format supersedes paired preview format", current: "0.1.168-v99.0.0", latest: "0.1.168-qiu.1", want: -1},
		{name: "superseded paired distribution patch remains comparable", current: "0.1.168-v1.0.0", latest: "0.1.168-v1.0.1", want: -1},
		{name: "distribution minor increments", current: "0.1.168-v1.2.9", latest: "0.1.168-v1.3.0", want: -1},
		{name: "distribution major increments", current: "0.1.168-v1.9.9", latest: "0.1.168-v2.0.0", want: -1},
		{name: "upstream baseline wins over distribution", current: "0.1.168-v99.0.0", latest: "0.1.169-v1.0.0", want: -1},
		{name: "newer upstream wins even after distribution reset", current: "0.1.169-v1.0.0", latest: "0.1.168-v99.0.0", want: 1},
		{name: "qiu revisions compare numerically", current: "0.1.168-qiu.10", latest: "0.1.168-qiu.2", want: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, compareVersions(tt.current, tt.latest))
		})
	}
}

func TestParseVersionAcceptsQiuPatchRevision(t *testing.T) {
	version, ok := parseVersion("v0.1.169-qiu.3.1")

	require.True(t, ok)
	require.Equal(t, [3]int{0, 1, 169}, version.upstream)
	require.Equal(t, [3]int{3, 1, 0}, version.distribution)
	require.Equal(t, versionKindQiuRevision, version.kind)

	resetVersion, resetOK := parseVersion("v0.1.170-qiu.1.0")
	require.True(t, resetOK)
	require.Equal(t, [3]int{1, 0, 0}, resetVersion.distribution)
}

func TestParseVersionRejectsUnsupportedFormats(t *testing.T) {
	for _, version := range []string{
		"",
		"0.1",
		"0.1.168-v1.0",
		"0.1.168-v1.0.0-extra",
		"0.1.168-qiu.0",
		"0.1.168-qiu.-1",
		"0.1.169-qiu.03.1",
		"0.1.169-qiu.3.01",
		"0.1.169-qiu.3.1.1",
		"release-0.1.168-v1.0.0",
	} {
		_, ok := parseVersion(version)
		require.False(t, ok, "version %q should be rejected", version)
	}
}

func TestUpdateServiceDetectsQiuPatchRevisionOnSameUpstreamBaseline(t *testing.T) {
	svc := NewUpdateService(
		&updateServiceCacheStub{},
		&updateServiceGitHubClientStub{release: &GitHubRelease{TagName: "v0.1.169-qiu.3.1"}},
		"0.1.169-qiu.3",
		"release",
	)

	info, err := svc.CheckUpdate(context.Background(), true)

	require.NoError(t, err)
	require.True(t, info.HasUpdate)
	require.Equal(t, "0.1.169-qiu.3.1", info.LatestVersion)
}

func TestUpdateServiceDetectsQiuRevisionOnSameUpstreamBaseline(t *testing.T) {
	svc := NewUpdateService(
		&updateServiceCacheStub{},
		&updateServiceGitHubClientStub{release: &GitHubRelease{TagName: "v0.1.168-qiu.2"}},
		"0.1.168-qiu.1",
		"release",
	)

	info, err := svc.CheckUpdate(context.Background(), true)

	require.NoError(t, err)
	require.True(t, info.HasUpdate)
	require.Equal(t, "0.1.168-qiu.2", info.LatestVersion)
}

func TestUpdateServiceRejectsUnsupportedLatestReleaseTag(t *testing.T) {
	svc := NewUpdateService(
		&updateServiceCacheStub{},
		&updateServiceGitHubClientStub{release: &GitHubRelease{TagName: "v0.1.168-qiu.0"}},
		"0.1.168-qiu.1",
		"release",
	)

	info, err := svc.CheckUpdate(context.Background(), true)

	require.NoError(t, err)
	require.False(t, info.HasUpdate)
	require.Contains(t, info.Warning, "unsupported version tag")
}

func newRollbackTestService(current string, releases []*GitHubRelease) *UpdateService {
	return NewUpdateService(
		&updateServiceCacheStub{},
		&updateServiceGitHubClientStub{recentReleases: releases},
		current,
		"release",
	)
}

func TestUpdateServiceListRollbackVersionsFiltersAndCaps(t *testing.T) {
	releases := []*GitHubRelease{
		{TagName: "v0.1.148", PublishedAt: "2026-07-09T00:00:00Z"},                       // newer than current: excluded
		{TagName: "v0.1.147", PublishedAt: "2026-07-08T00:00:00Z"},                       // current: excluded
		{TagName: "v0.1.146-rc1", PublishedAt: "2026-07-07T12:00:00Z", Prerelease: true}, // prerelease: excluded
		{TagName: "v0.1.146", PublishedAt: "2026-07-07T00:00:00Z"},
		{TagName: "v0.1.145", PublishedAt: "2026-07-06T00:00:00Z", Draft: true}, // draft: excluded
		{TagName: "v0.1.144", PublishedAt: "2026-07-05T00:00:00Z"},
		{TagName: "v0.1.144", PublishedAt: "2026-07-05T00:00:00Z"}, // duplicate: excluded
		{TagName: "v0.1.143", PublishedAt: "2026-07-04T00:00:00Z"},
		{TagName: "v0.1.142", PublishedAt: "2026-07-03T00:00:00Z"}, // beyond cap of 3: excluded
	}
	svc := newRollbackTestService("0.1.147", releases)

	versions, err := svc.ListRollbackVersions(context.Background())

	require.NoError(t, err)
	require.Len(t, versions, 3)
	require.Equal(t, "0.1.146", versions[0].Version)
	require.Equal(t, "0.1.144", versions[1].Version)
	require.Equal(t, "0.1.143", versions[2].Version)
}

func TestUpdateServiceListRollbackVersionsSortsUnorderedInput(t *testing.T) {
	releases := []*GitHubRelease{
		{TagName: "v0.1.144"},
		{TagName: "v0.1.146"},
		{TagName: "v0.1.145"},
	}
	svc := newRollbackTestService("0.1.147", releases)

	versions, err := svc.ListRollbackVersions(context.Background())

	require.NoError(t, err)
	require.Len(t, versions, 3)
	require.Equal(t, "0.1.146", versions[0].Version)
	require.Equal(t, "0.1.145", versions[1].Version)
	require.Equal(t, "0.1.144", versions[2].Version)
}

func TestUpdateServiceListRollbackVersionsSortsQiuAndHistoricalVersions(t *testing.T) {
	releases := []*GitHubRelease{
		{TagName: "v0.1.167-qiu.9"},
		{TagName: "v0.1.168-qiu.2"},
		{TagName: "v0.1.168-qiu.1"},
		{TagName: "v0.1.167-v9.0.0"},
		{TagName: "v0.1.168-v1.0"}, // invalid: excluded
		{TagName: "not-a-version"}, // invalid: excluded
	}
	svc := newRollbackTestService("0.1.168-qiu.3", releases)

	versions, err := svc.ListRollbackVersions(context.Background())

	require.NoError(t, err)
	require.Len(t, versions, 3)
	require.Equal(t, "0.1.168-qiu.2", versions[0].Version)
	require.Equal(t, "0.1.168-qiu.1", versions[1].Version)
	require.Equal(t, "0.1.167-qiu.9", versions[2].Version)
}

func TestUpdateServiceListRollbackVersionsEmptyWhenNoneOlder(t *testing.T) {
	releases := []*GitHubRelease{
		{TagName: "v0.1.147"},
		{TagName: "v0.1.148"},
	}
	svc := newRollbackTestService("0.1.147", releases)

	versions, err := svc.ListRollbackVersions(context.Background())

	require.NoError(t, err)
	require.Empty(t, versions)
}

func TestUpdateServiceListRollbackVersionsPropagatesFetchError(t *testing.T) {
	svc := NewUpdateService(
		&updateServiceCacheStub{},
		&updateServiceGitHubClientStub{recentErr: errors.New("github unavailable")},
		"0.1.147",
		"release",
	)

	_, err := svc.ListRollbackVersions(context.Background())

	require.Error(t, err)
	require.Contains(t, err.Error(), "github unavailable")
}

func TestUpdateServiceRollbackToVersionRejectsDisallowedTargets(t *testing.T) {
	releases := []*GitHubRelease{
		{TagName: "v0.1.148"},
		{TagName: "v0.1.147"},
		{TagName: "v0.1.146"},
		{TagName: "v0.1.145"},
		{TagName: "v0.1.144"},
		{TagName: "v0.1.143"},
		{TagName: "v0.1.142"},
	}
	svc := newRollbackTestService("0.1.147", releases)

	for _, target := range []string{
		"",         // empty
		"0.1.147",  // current version
		"v0.1.147", // current version with prefix
		"0.1.148",  // newer than current
		"0.1.142",  // older than the 3 most recent
		"9.9.9",    // nonexistent
	} {
		err := svc.RollbackToVersion(context.Background(), target)
		require.ErrorIs(t, err, ErrRollbackVersionNotAllowed, "target %q should be rejected", target)
	}
}

func TestUpdateServiceRollbackToVersionAcceptsVPrefix(t *testing.T) {
	// No platform asset in the release: the target passes the allowlist check
	// and fails later at asset lookup, proving the version itself was accepted.
	releases := []*GitHubRelease{
		{TagName: "v0.1.147"},
		{TagName: "v0.1.146"},
	}
	svc := newRollbackTestService("0.1.147", releases)

	err := svc.RollbackToVersion(context.Background(), "v0.1.146")

	require.Error(t, err)
	require.NotErrorIs(t, err, ErrRollbackVersionNotAllowed)
	require.Contains(t, err.Error(), "no compatible release found")
}

func TestUpdateServiceRequiresReleaseChecksumAsset(t *testing.T) {
	assetName := fmt.Sprintf("sub2api_0.1.168-qiu.1_%s_%s.tar.gz", runtime.GOOS, runtime.GOARCH)
	svc := NewUpdateService(&updateServiceCacheStub{}, &updateServiceGitHubClientStub{}, "0.1.168-qiu.1", "release")

	err := svc.applyReleaseAssets(context.Background(), []Asset{{
		Name:        assetName,
		DownloadURL: "https://github.com/qiufengawa/sub2api/releases/download/v0.1.168-qiu.1/" + assetName,
	}})

	require.Error(t, err)
	require.Contains(t, err.Error(), "checksums.txt is required")
}

func TestUpdateServiceExtractBinaryFromZip(t *testing.T) {
	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "sub2api_windows_amd64.zip")
	destPath := filepath.Join(tempDir, "sub2api.exe")

	archiveFile, err := os.Create(archivePath)
	require.NoError(t, err)
	zw := zip.NewWriter(archiveFile)
	entry, err := zw.Create("nested/sub2api.exe")
	require.NoError(t, err)
	_, err = entry.Write([]byte("windows-binary"))
	require.NoError(t, err)
	require.NoError(t, zw.Close())
	require.NoError(t, archiveFile.Close())

	svc := NewUpdateService(nil, nil, "", "")
	require.NoError(t, svc.extractBinary(archivePath, destPath))
	extracted, err := os.ReadFile(destPath)
	require.NoError(t, err)
	require.Equal(t, "windows-binary", string(extracted))
}

func TestWriteLimitedBinaryRejectsOversizedAndEmptyFiles(t *testing.T) {
	t.Run("oversized", func(t *testing.T) {
		destPath := filepath.Join(t.TempDir(), "sub2api")
		err := writeLimitedBinary(destPath, strings.NewReader("1234"), 3)
		require.Error(t, err)
		_, statErr := os.Stat(destPath)
		require.ErrorIs(t, statErr, os.ErrNotExist)
	})

	t.Run("empty", func(t *testing.T) {
		destPath := filepath.Join(t.TempDir(), "sub2api")
		err := writeLimitedBinary(destPath, bytes.NewReader(nil), 3)
		require.Error(t, err)
		_, statErr := os.Stat(destPath)
		require.ErrorIs(t, statErr, os.ErrNotExist)
	})
}

func TestValidateDownloadURLRejectsCredentialAndPort(t *testing.T) {
	for _, rawURL := range []string{
		"https://user@github.com/qiufengawa/sub2api/releases/download/file",
		"https://github.com:8443/qiufengawa/sub2api/releases/download/file",
		"https://github.com.evil.test/file",
	} {
		require.Error(t, validateDownloadURL(rawURL), rawURL)
	}
	require.NoError(t, validateDownloadURL("https://release-assets.githubusercontent.com/file"))
}
