# Release Verification: `v0.1.179-qiu.2`

Verification date: 2026-08-20 UTC. All commands below were run against
`qiufengawa/sub2api` after the release workflow completed.

## Version and Workflows

- Release commit: `b557c76001b2de9d4a1bdee4da729dcb1c745786`.
- Release tag `v0.1.179-qiu.2` points to that commit. `origin/ui/main` now
  contains the post-release evidence commit `67942a6ab150d0d4a58aeecd07334d701e115963`.
- `backend/cmd/server/VERSION` is `0.1.179-qiu.2`.
- The official upstream latest release is `v0.1.179`; the candidate is a Qiu
  revision on that baseline (`git rev-list --left-right --count
  b557c7600...v0.1.179` returned `276 0`).
- CI run `32400923278`, tag CI run `32401866253`, and Security Scan run
  `32401866174` all completed successfully.
- The post-release evidence commit also passed branch CI `32404413381` and
  Security Scan `32404413281`.
- Release run `32401866123` completed successfully:
  <https://github.com/qiufengawa/sub2api/actions/runs/32401866123>
  `build-frontend`, `update-version`, `release`, and `sync-version-file` all
  passed. The sync job reported `VERSION file already matches` and created no
  extra commit.

## GitHub Release

Release metadata:

- URL: <https://github.com/qiufengawa/sub2api/releases/tag/v0.1.179-qiu.2>
- Published: `2026-08-20T18:27:45Z`.
- `draft=false`, `prerelease=false`.
- `repos/qiufengawa/sub2api/releases/latest` returns `v0.1.179-qiu.2`.

The six required assets are present:

```text
checksums.txt
sub2api_0.1.179-qiu.2_darwin_amd64.tar.gz
sub2api_0.1.179-qiu.2_darwin_arm64.tar.gz
sub2api_0.1.179-qiu.2_linux_amd64.tar.gz
sub2api_0.1.179-qiu.2_linux_arm64.tar.gz
sub2api_0.1.179-qiu.2_windows_amd64.zip
```

Downloaded assets passed `sha256sum --check checksums.txt`:

```text
e6b1b4e34c83418654ba2bf71aff48e44f29eda233204eaafaf04693f1286d46  sub2api_0.1.179-qiu.2_darwin_amd64.tar.gz
8ecd58a1bc14f0ac9e09a2a1e1348ae9f539ae4fb9efd79a6d5882ce79da8903  sub2api_0.1.179-qiu.2_darwin_arm64.tar.gz
02ae8acff0c910994fa81f6c604d38416b3c33517827111282b4e7c97fd30f41  sub2api_0.1.179-qiu.2_linux_amd64.tar.gz
5dbe2f5ef7d44ad6d5132577896f90733d3f923b8289fae4b6f7fb2dd17ae67e  sub2api_0.1.179-qiu.2_linux_arm64.tar.gz
2683a8b0d65c8ea69978dcaee237926aebd68c3762e74b53b6ba8c76f3917944  sub2api_0.1.179-qiu.2_windows_amd64.zip
```

## GHCR

`docker buildx imagetools inspect` reports the same index digest for the
version tag and `latest`:

```text
ghcr.io/qiufengawa/sub2api:0.1.179-qiu.2
Digest: sha256:3c0b54a1c497254107d75a95e7f729b544cfb37be93c4d939dd0b918e7866fbc

ghcr.io/qiufengawa/sub2api:latest
Digest: sha256:3c0b54a1c497254107d75a95e7f729b544cfb37be93c4d939dd0b918e7866fbc
```

Both indexes contain the same platform manifests:

```text
linux/amd64  sha256:046992bb8da83ad09ad758b6b1bca76733650c64da9ea08a2dcd6c375e95b972
linux/arm64  sha256:43c5aaf7b90e09b025ecaef48ac66ea2b8ec174f06209e0b895c82cd35309a10
```

## Update Checks

The updater source is unchanged between the previous deployed tag and this
release (`git diff v0.1.179-qiu.1..HEAD -- backend/internal/service/update_service.go`
is empty). A temporary test invoked the real `GitHubReleaseClient` against
`https://api.github.com/repos/qiufengawa/sub2api/releases/latest` with
`force=true`, then was removed from the worktree.

```text
current=0.1.179-qiu.1 latest=0.1.179-qiu.2 has_update=true cached=false
current=0.1.179-qiu.2 latest=0.1.179-qiu.2 has_update=false cached=false
```

The downloaded platform archives and checksum file above also verify the
release asset and checksum path used by the updater without replacing the
running executable.

## Remaining Scope

This closes the release, artifact, GHCR, previous-version discovery, and
current-version online update evidence. It does not mark the single R0-R9
goal complete: protected-page browser coverage, screen-reader/provider
sandbox/destructive-action evidence, and the remaining final Code Review items
listed in `FINAL-CODE-REVIEW-AND-RELEASE-GATE.md` are still open.
