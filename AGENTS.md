# Repository Agent Instructions

## Frontend design policy

Before creating or redesigning frontend pages or controls, read and follow
[`docs/FRONTEND_DESIGN_GUIDELINES.md`](docs/FRONTEND_DESIGN_GUIDELINES.md).
Use [`UI.MD`](UI.MD) as the authoritative component catalog, selection guide,
layout reference, and implementation source map.

Hard requirements:

- Design each page around its primary user task; authentication pages must not
  contain unrelated marketing, process, endpoint, or capability content.
- New and redesigned form inputs and buttons use the slim control scale:
  `36px` by default, `32px` for compact forms, and `28px` in dense contexts.
- A control taller than `36px` requires a specific touch or interaction reason.
- Prefer `.input-compact`, `.btn-compact`, `.input-dense`, and `.btn-dense`
  instead of introducing unrelated one-off control heights.
- Authentication views must reuse `AuthLayout`, `AuthFormPanel`, and
  `AuthTextField`; do not duplicate their shared heading, field, button, or
  spacing styles inside individual pages.
- Related authentication routes must keep a persistent `AuthLayout` shell and
  transition only their form content without an empty intermediate frame.
- Compact controls must retain readable text, visible focus and validation
  states, and verified desktop/mobile alignment.
- New frontend work must import applicable shared contracts from
  `@/components/ui`; page-local replacements require a documented exception in
  `UI.MD`.
- Do not override shared component colors, control heights, radii, focus
  states, or motion from page CSS. Pages may control placement and contextual
  width.

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
