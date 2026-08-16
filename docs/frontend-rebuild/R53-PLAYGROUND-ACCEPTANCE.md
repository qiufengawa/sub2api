# R53 Playground Acceptance

## Scope

R53 rebuilds the authenticated Playground as a compact conversation workspace while preserving its existing API, streaming, image-generation, storage, and feature-gate contracts.

### Delivered

- Replaced the legacy page states and actions with shared Qiu UI primitives.
- Rebuilt chat and image messages with the shared warm neutral token system.
- Kept Markdown sanitization, safe external links, code copy, image preview, image download, message edit, retry, delete, metrics, and technical details.
- Replaced the custom parameter overlay with a desktop `UiDrawer` and mobile `UiSheet`.
- Extracted the parameter form into `PlaygroundParametersForm` and localized image quality options.
- Replaced the request preview's local code container with `UiCodeBlock` and localized copy feedback.
- Prevented streaming updates from forcing the viewport to the bottom after the user scrolls upward.
- Accepted either `completion_tokens` or `output_tokens` when calculating output speed.
- Added long-message containment to `UiAlert` so gateway errors cannot widen the page or a message bubble.

## Preserved Contracts

- `/playground` remains authenticated and guarded by `requiresPlayground`.
- Only enabled, valid chat parameters are included in chat payloads.
- Image requests keep `response_format: b64_json` and their size, quality, format, and count options.
- Stop aborts the active request and prevents late stream writes.
- Chat history remains session-scoped; image prompts and image results remain excluded from persisted sessions.
- Existing session limits, key/model selection rules, SSE parsing, one-time 401 retry, and image request timeout are unchanged.

## Automated Verification

Executed from `frontend/`:

```bash
pnpm exec vitest run \
  src/views/user/__tests__/PlaygroundView.spec.ts \
  src/composables/__tests__/usePlayground.spec.ts \
  src/components/playground/__tests__/PlaygroundParametersPanel.spec.ts \
  src/components/playground/__tests__/PlaygroundRequestPreview.spec.ts \
  src/components/playground/__tests__/PlaygroundMessage.spec.ts \
  src/components/playground/__tests__/PlaygroundComposer.spec.ts \
  src/api/__tests__/playground.spec.ts \
  src/components/ui/__tests__/UiPrimitives.spec.ts
```

Result: 8 files passed, 64 tests passed.

Additional checks:

```bash
pnpm exec vue-tsc --noEmit
pnpm exec eslint <R53 files>
pnpm run build
git diff --check -- <R53 files>
```

Result: all passed. The production build reports only existing dependency/chunk-size warnings.

The repository-wide Vitest run currently has five failures in `src/views/__tests__/KeyUsageView.spec.ts`. They are outside the R53 Playground scope and are not introduced by this change; R53's isolated suite is green.

## Visual Verification

Verified layouts and states:

- Desktop: `1440x900`
- Compact desktop: `900x900`
- Mobile: `390x844` parameter sheet
- Mobile content captures: actual `382x827`
- Mobile dark mode
- Request JSON dialog
- No horizontal overflow in the verified viewports

Evidence:

- `docs/frontend-rebuild/screenshots/playground-1440.jpg`
- `docs/frontend-rebuild/screenshots/playground-parameters-1440.jpg`
- `docs/frontend-rebuild/screenshots/playground-900.jpg`
- `docs/frontend-rebuild/screenshots/playground-390.jpg`
- `docs/frontend-rebuild/screenshots/playground-parameters-390.jpg`
- `docs/frontend-rebuild/screenshots/playground-dark-390.jpg`

## Known Environment Limitation

The local preview backend binary does not expose the current Playground Key API and returned `404`, so the browser pass could not create a live response through that binary. Request payloads, SSE behavior, image generation, message behavior, metrics, cancellation, and storage boundaries are covered by the focused automated suite.
