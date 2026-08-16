# R57 Legal Document Acceptance

## Scope

- Route: `/legal/:documentId`
- View: `frontend/src/views/public/LegalDocumentView.vue`
- Domain renderer: `frontend/src/components/legal/LegalDocumentContent.vue`
- Shared contract extensions: `UiLink`, `UiPageNav`, `UiBackToTop`
- Locales: `legal.*` document-navigation labels and `common.backToTop`

## Implemented

- Replaced the complete legacy Tailwind page, header, loading spinner, state cards, and page-level Markdown `@apply` rules.
- Uses one `AppPage` and one `AppPageHeader` for the formal route.
- Preserves the configured horizontal logo and site-name fallback without restoring the removed square icon treatment.
- Keeps the bundled administrator compliance document available when public settings fail.
- Keeps dynamic login-agreement documents, updated date, route parameter, locale selection, and public-settings loading behavior.
- Parses Markdown with `marked`, sanitizes it with `DOMPurify`, adds stable `h2/h3` anchors, and gives safe external links `_blank` plus `noopener noreferrer`.
- Adds an accessible document contents list, responsive `AppSplitPane`, previous/next document navigation, and localized back-to-top behavior.
- Adds a domain-level legal prose renderer for headings, lists, quotes, code, images, and horizontally scrollable tables without adding another generic UI component.
- Adds shared `UiLink` `muted` and `brand` semantics instead of overriding link appearance from page CSS.
- Adds localized `UiPageNav` fallbacks and reduced-motion-aware `UiBackToTop` scrolling.

## State And Contract Coverage

- Loading: dimensionally stable header plus reserved body skeleton.
- Error: persistent `UiErrorState` with retry.
- Empty: missing document and empty content use `UiEmptyState`.
- Success: title, type, update time, contents, sanitized prose, document navigation.
- Long content: wrapping prose, constrained logo/name, sticky desktop contents, single-column narrow layout.
- Security: scripts and unsafe URL protocols are removed; configured logo URL remains sanitized.
- Accessibility: one page heading, labelled article, labelled contents navigation, labelled document navigation, keyboard-native links and actions.

## Automated Verification

Run on 2026-08-16:

```text
pnpm exec vitest run \
  src/views/public/__tests__/LegalDocumentView.spec.ts \
  src/components/ui/__tests__/UiExtendedComponents.spec.ts \
  src/i18n/__tests__/localesMessageCompile.spec.ts
Result: 3 files, 17 tests passed

pnpm exec vue-tsc --noEmit
Result: passed

pnpm exec eslint <R57 files>
Result: passed

pnpm run build
Result: passed

pnpm run test:run
Result: 321 files, 2111 tests passed
```

The build only reports the repository's existing dependency, mixed-import, and chunk-size warnings.

## Browser Acceptance

Verified on the public route `http://127.0.0.1:4174/legal/admin-compliance`:

| Viewport / mode | Result | Evidence |
| --- | --- | --- |
| `1440 x 1000`, light | Passed; 220px sticky contents beside an 812px article | `screenshots/r57-legal/legal-1440-light.png` |
| `900 x 900`, light | Passed; contents and article stack without shrinking type | `screenshots/r57-legal/legal-900-light.png` |
| `390 x 844`, light | Passed; 358px content width and no overlap | `screenshots/r57-legal/legal-390-light.png` |
| `390 x 844`, dark + reduced motion | Passed; dark tokens and no page overflow | `screenshots/r57-legal/legal-390-dark-reduced.png` |

Measured page-level horizontal overflow was `false` at all three widths. At 1440px the header and page both measured 1080px and remained aligned; at 900px and 390px both expanded to the available width without exceeding the document client width.

Keyboard and interaction checks:

- pressing Enter on the first contents link changed the URL to `#legal-section-1`;
- pressing Enter on the next-document button navigated from the bundled compliance document to `/legal/terms` and rendered the configured title;
- after scroll input settled, pressing Enter on the localized back-to-top button under reduced motion returned to `scrollY = 0`;
- the public route emitted no browser-console warning or error.

The temporary viewport and emulated media overrides were reset after verification. The temporary dark root class used to inspect explicit dark design tokens was removed before the browser session was finalized.
