# Release Version Policy

This document is the mandatory release contract for the Qiu API distribution.
It exists to keep the source version, updater, GitHub Release, binaries, and
container images mutually compatible.

## Canonical format

Every new release uses an integer Qiu revision:

```text
Git tag:  v<upstream-version>-qiu.<revision>
VERSION:  <upstream-version>-qiu.<revision>
Example:  v0.1.169-qiu.4
```

`<upstream-version>` is the latest synchronized official stable Sub2API
version. `<revision>` is a positive integer without leading zeroes.

Valid examples:

- `v0.1.169-qiu.4`
- `v0.1.169-qiu.12`
- `v0.1.170-qiu.1`

Invalid examples:

- `v0.1.169-qiu.3.1`
- `v0.1.169-qiu.4.0`
- `v0.1.169-qiu.0`
- `0.1.169-qiu.4`
- `v0.1.169-qiu.04`

The published `v0.1.169-qiu.3.1` release is retained as historical data and
remains parseable for update and rollback compatibility. It must not be used
as a template for new releases.

## Increment rules

| Situation | Required next version |
| --- | --- |
| Qiu-only change on the same upstream baseline | Increment the integer revision, for example `qiu.4` to `qiu.5` |
| Unreleased upstream `main` commits are synchronized but the official stable version is unchanged | Keep the upstream triplet and increment the integer revision |
| The official stable upstream version changes | Use the new upstream triplet and reset to `qiu.1` |

The upstream baseline is determined from the official Wei-Shaw/Sub2API stable
Release and tag, not merely from new commits on upstream `main`.

## Compatibility gate

Version discovery is executed by the binary that is already running in
production. A candidate release understanding its own tag does not prove that
the deployed release can discover it.

Before approving any change to the tag grammar:

1. Check out or inspect the currently deployed release tag.
2. Run its version parser and comparison logic against the proposed new tag.
3. Verify its forced update-check path accepts the GitHub `releases/latest`
   response and reports `has_update=true`.
4. Reject the new grammar if the deployed version cannot understand it, or
   provide an integer-format compatibility release first.

The `qiu.3` updater accepted only `qiu.<integer>`, so it could not discover
`qiu.3.1`. This is why all new releases remain integer-only.

## Required source updates

Before tagging, verify these release-facing locations are consistent:

- `backend/cmd/server/VERSION`
- `.github/workflows/release.yml`
- `.goreleaser.yaml`
- `README.md`
- `deploy/DOCKER.md`
- `deploy/install.sh`
- update comparison tests and release workflow validation tests

The running system version comes from the backend build version. Do not change
`frontend/package.json` to represent the product release.

The update repository must remain `qiufengawa/sub2api`; do not point update,
rollback, installation, or asset downloads back to the upstream repository.

## Pre-release checklist

1. Confirm the latest official upstream stable Release and tag.
2. Choose the next integer Qiu revision using the rules above.
3. Confirm the target tag does not already exist locally or on `origin`.
4. Update every release-facing source listed above.
5. Run update parser/comparison tests, release-tag positive and negative
   checks, installer shell syntax validation, `actionlint`, production build,
   and `git diff --check`.
6. Confirm the working tree contains only intended release changes.
7. Push the branch before creating the annotated release tag.
8. Push the tag and monitor the Release workflow to completion.

## Post-release verification

A green tag push alone is not sufficient. Verify all of the following:

- GitHub Actions Release workflow completed successfully.
- GitHub Release is published, not a draft, and not a prerelease.
- GitHub `repos/qiufengawa/sub2api/releases/latest` returns the new tag.
- Linux AMD64, Linux ARM64, macOS AMD64, macOS ARM64, Windows AMD64, and
  `checksums.txt` assets exist.
- `ghcr.io/qiufengawa/sub2api:<version>` exists.
- GHCR `latest` points to the new release.
- The previous deployed version detects the release through a forced update
  check before announcing that in-app update is available.

Never delete, retarget, or silently replace an existing release tag to repair a
versioning mistake. Publish a forward-compatible integer revision instead.

