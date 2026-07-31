# Repository Agent Instructions

## Release version policy

Before changing `backend/cmd/server/VERSION`, creating a release tag, or
publishing a release, read and follow
[`docs/RELEASE_VERSION_POLICY.md`](docs/RELEASE_VERSION_POLICY.md).

Hard requirements:

- The only valid new release tag format is
  `v<upstream-major>.<upstream-minor>.<upstream-patch>-qiu.<positive-integer>`.
- `backend/cmd/server/VERSION` uses the same value without the leading `v`.
- On the same upstream baseline, increment the integer Qiu revision by one.
- When the upstream stable version changes, update the upstream triplet and
  reset the Qiu revision to `qiu.1`.
- Do not publish new `qiu.N.P` tags. `v0.1.169-qiu.3.1` is historical only.
- Before introducing any different tag syntax, verify that the update parser
  in the currently deployed release can discover and compare it. Support in
  the candidate release alone is insufficient.
- Do not use `frontend/package.json` as the system version source.
- The update source must remain `qiufengawa/sub2api`.
- A release is not complete until the GitHub Release, downloadable artifacts,
  checksum file, GHCR version tag, `latest` tag, and GitHub `releases/latest`
  response have all been verified.

