# Qiu API UI Design System Plan

> Status: planning baseline
> Scope: public pages, authentication, user console, administrator console
> Implementation state: this document defines the target system; it does not mean every existing page has already migrated.

## 1. Goal

Build one reusable UI system from the confirmed design tokens and semantic principles. Home, login, and registration are product and information references only; their existing DOM, CSS, component composition, spacing, typography, and layout are not implementation baselines and must not be copied. The system must make later pages consistent while preserving their business contracts.

The target experience is:

- warm neutral background, black and white as the structural colors;
- restrained beige surfaces and borders;
- semantic color only where color carries information;
- compact controls, clear hierarchy, and high information density;
- stable page shells with short, quiet transitions;
- fewer containers, no card inside card, and no decoration competing with data;
- the same visual grammar on desktop and mobile, with layout adaptation instead of a separate mobile design.

## 2. Page Responsibility

Every page is designed around one primary user task.

| Page family | Primary task | Information policy | Visual intensity |
| --- | --- | --- | --- |
| Home and public product pages | Explain value and lead users to action | Rich but scannable product information | Highest; meaningful animation and product visuals allowed |
| Authentication | Complete login, registration, verification, or recovery | Only fields, validation, legal requirements, and route switching | Lowest; no marketing panels or unrelated instructions |
| User console | Understand usage and complete frequent account actions | Current state, next action, records, and exceptions first | Quiet and task-focused |
| Administrator console | Monitor, compare, diagnose, and operate at scale | Dense data with explicit status and risk hierarchy | Quietest; decoration must never outrank operational data |
| Payment and subscription | Understand product, price, quota, and order state | Prevent ambiguity around amount, validity, reset, and status | Clear hierarchy with restrained emphasis |
| Playground | Compose a request and inspect the response | Conversation first; parameters and diagnostics remain accessible | Productive, responsive, and content-led |

No page may display implementation commentary, decorative numbering, redundant category labels, or explanatory copy that does not help its primary task.

## 3. Design Principles

### 3.1 One visual system, different page density

The public site may be expressive, but console pages inherit the target typography, neutral palette, icon language, borders, and motion tokens rather than any old page DOM or decorative composition. Hand-drawn or colorful elements are not copied mechanically into operational screens.

### 3.2 Structure before containers

Use spacing, alignment, dividers, typography, and full-width bands to establish hierarchy. A border or card is introduced only when the content is genuinely a repeated item, interactive tool, or modal unit.

Hard rules:

- no card nested inside another card;
- no floating card around a complete page section;
- no wrapper added only to create another background color;
- a normal page should have at most three visible surface levels: page, section/tool, overlay;
- related values are aligned in a grid or description list, not split into many small cards;
- table data stays a table on mobile and uses deliberate horizontal scrolling when comparison matters.

### 3.3 Compact by default

Controls stay slim and horizontally proportioned.

| Density | Height | Use |
| --- | ---: | --- |
| Mini | `24px` | Table row icon actions and compact tags |
| Dense | `28px` | Table toolbars, inline editing, high-density admin controls |
| Compact | `32px` | Compact forms, filters, and dialog controls |
| Default | `36px` | Normal forms and console actions |
| Large | `40px` | Touch-emphasized or isolated primary actions with a documented reason |

Controls above `36px` require an explicit touch or interaction reason. Visible control height may remain compact while the mobile hit target is increased with an invisible or layout-safe target area.

### 3.4 Meaningful color

Black, white, warm gray, and beige define structure. Color is reserved for status, chart series, provider identity, tags, and critical actions. Large decorative gradients are not part of the system.

### 3.5 Reuse behavior as well as CSS

A shared component owns its focus, keyboard, loading, disabled, error, responsive, dark-mode, and reduced-motion states. Pages should not rebuild those states with page-local classes.

## 4. Foundation Tokens

Tokens will live in one global theme layer and be exposed as CSS custom properties. Tailwind utilities may consume the same values, but page files must not create parallel palettes.

### 4.1 Typography

The current home and authentication stack remains the baseline:

```css
--font-latin: Inter, "SF Pro Text", "Segoe UI", Arial, sans-serif;
--font-sans: Inter, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
--font-mono: "SFMono-Regular", "Cascadia Code", "Roboto Mono", Consolas, "Liberation Mono", monospace;
```

Rules:

- English and ordinary numbers prefer `--font-latin`; mixed Chinese/English interface lines use `--font-sans`, whose fallback order preserves the Latin face before Chinese system fonts.
- API keys, model IDs, endpoints, request IDs, and code use `--font-mono`.
- Prices, quotas, latency, token counts, percentages, and table metrics use `font-variant-numeric: tabular-nums`.
- Marketing headings may use proportional figures; operational data never does.
- Letter spacing is `0`; compactness is achieved through size and spacing, not negative tracking.
- Font weight scale is `400 / 500 / 600 / 700`; `800+` is reserved for the public hero or exceptional campaign text.

Type scale:

| Token | Size / line height | Use |
| --- | --- | --- |
| `text-xs` | `11 / 16px` | Field labels, metadata, dense table secondary text |
| `text-sm` | `12 / 18px` | Controls, badges, table cells |
| `text-body` | `14 / 22px` | Console body text and descriptions |
| `text-lead` | `16 / 26px` | Important descriptions and dialog introductions |
| `title-section` | `20 / 28px` | Page sections and tool headings |
| `title-page` | `26 / 34px` | Normal page title |
| `title-display` | responsive by breakpoint, not viewport interpolation | Public hero only |

### 4.2 Core palette

Light theme:

```css
--ui-bg: #fcfaf8;
--ui-surface: #ffffff;
--ui-surface-muted: #f6f2ed;
--ui-surface-strong: #eee9e4;
--ui-text: #0a0a0a;
--ui-text-muted: #6c6762;
--ui-text-soft: #8f959e;
--ui-border: #ddd7d1;
--ui-border-soft: #eee9e4;
--ui-focus: #151515;
--ui-inverse: #ffffff;
```

Dark theme:

```css
--ui-bg: #0a0a0a;
--ui-surface: #111110;
--ui-surface-muted: #1c1a18;
--ui-surface-strong: #24211e;
--ui-text: #f5f3f0;
--ui-text-muted: #aaa49d;
--ui-text-soft: #77716b;
--ui-border: #393632;
--ui-border-soft: #2c2926;
--ui-focus: #f5f3f0;
--ui-inverse: #0a0a0a;
```

Semantic accents inherit the restrained home palette:

| Meaning | Base use | Restrictions |
| --- | --- | --- |
| Green | healthy, successful, available | not a page background |
| Red | destructive, failed, critical | never used for ordinary emphasis |
| Yellow | warning, pending, quota attention | text must retain accessible contrast |
| Blue | informational state and one chart series | not the universal button color |
| Pink | secondary chart/provider differentiation | decorative use only on public pages |

Provider brand colors are allowed only in provider icons or a small provider tag. They do not recolor complete cards or dialogs.

### 4.3 Spacing, radius, border, and shadow

- Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64px`.
- Component gaps normally use `8` or `12px`; section gaps use `24` or `32px`.
- Radius scale: `4px` dense, `6px` default, `8px` only for repeated cards, dialogs, and framed tools.
- Standard border: `1px solid var(--ui-border)`.
- Strong border is black/white and reserved for focused primary tools or public-page graphic emphasis.
- Shadows are absent by default. Overlays use one restrained elevation shadow; buttons do not use colored glow.
- No colored strip before the Qiu API name or logo.

### 4.4 Icons

- All interface icons use `lucide-vue-next` through `components/icons/Icon.vue`; no second icon package or page-local SVG path is allowed.
- Default inline icon: `16px`; dense icon: `12px`; standalone action: `20px` maximum in normal console UI.
- Icon-only actions require an accessible name and tooltip when their meaning is not universal.
- A bordered icon container is reserved for a standalone actionable tool. Inline confirmation, cancellation, success, failure, and validation glyphs remain unframed: success/check uses `--ui-success`, cancellation/error uses `--ui-danger`, and warning uses `--ui-warning`.
- `UiIconButton` uses `outlined` for standalone tools, `ghost` for embedded close/edit actions, and `success` / `danger` for semantic confirmation and cancellation. Do not wrap a status-only icon in an extra button-like surface.
- Do not use manually drawn SVG or UCloud icons. SVG remains allowed only for data visualizations such as progress rings and sparklines.
- Decorative raster illustrations are limited to public, email, empty, or onboarding contexts and must support the task.

## 5. Planned Shared Components

The implemented library contains **114 common components**. Existing components that already satisfy a contract are retained and normalized; overlapping implementations are consolidated.

### 5.1 Actions and form controls: 22

1. `UiButton` - primary, secondary, quiet, destructive, and loading states.
2. `UiIconButton` - compact symbolic actions with tooltip and accessible label.
3. `UiButtonGroup` - related command grouping without pill decoration.
4. `UiLink` - inline, standalone, external, muted, and brand-navigation variants. `brand` removes the underline only for a logo or site-name link; ordinary navigation remains underlined.
5. `UiTextField` - text, email, URL, and identifier entry.
6. `UiPasswordField` - reveal action and non-layout-shifting rules tooltip.
7. `UiTextArea` - compact multiline input with optional counter.
8. `UiSelect` - bounded option sets.
9. `UiCombobox` - searchable large option sets.
10. `UiSearchInput` - search, clear, and keyboard behavior.
11. `UiNumberStepper` - minus, editable value, and plus; no arbitrary maximum.
12. `UiCheckbox` - independent binary selection.
13. `UiRadioGroup` - mutually exclusive choices.
14. `UiSwitch` - immediate binary setting.
15. `UiSegmentedControl` - compact modes or views, with optional option metadata and `#option` content for branded choices.
16. `UiDateInput` - single calendar date.
17. `UiDateRangePicker` - presets, timezone-safe boundaries, and custom range.
18. `UiFileUpload` - browse, drop, validation, and progress.
19. `UiFormField` - label, description, control, error, and required state.
20. `UiFieldHelp` - hover/focus/click help without changing form height.
21. `UiFieldError` - validation text with reserved or deliberate layout behavior.
22. `UiCopyButton` - copy value with transient success feedback.

### 5.2 Navigation and disclosure: 10

23. `UiTabs` - views within the same page; stable width and keyboard navigation.
24. `UiBreadcrumb` - deep administrator routes only.
25. `UiPagination` - compact desktop and simplified mobile controls.
26. `UiDropdownMenu` - small bounded action sets.
27. `UiContextMenu` - row and item actions where a visible toolbar is too dense.
28. `UiPopover` - interactive contextual content.
29. `UiTooltip` - short read-only explanation with viewport-aware placement.
30. `UiAccordion` - secondary details, FAQ, and advanced settings.
31. `UiCommandMenu` - searchable navigation or large command sets.
32. `UiNavItem` - sidebar and top-navigation states from one contract.

### 5.3 Feedback and status: 12

33. `UiBadge` - neutral category or attribute label.
34. `UiStatusBadge` - semantic status with icon, text, and optional detail.
35. `UiAlert` - inline information, warning, or error requiring attention.
36. `UiToast` - transient operation result; never the only record of a critical failure.
37. `UiSpinner` - small indeterminate activity.
38. `UiProgressBar` - CPU, memory, Redis, quota, and bounded progress.
39. `UiProgressRing` - health or one prominent bounded metric only.
40. `UiSkeleton` - dimensionally stable loading placeholders.
41. `UiEmptyState` - concise reason and one next action.
42. `UiErrorState` - retryable or terminal data-load failure.
43. `UiLoadingOverlay` - blocks only the tool being updated, not the whole page.
44. `UiConnectionStatus` - live, reconnecting, stale, and offline states.

### 5.4 Data display: 12

45. `UiDataTable` - shared density, row states, sticky options, loading, and empty state.
46. `UiTableToolbar` - search, filters, bulk actions, export, and refresh.
47. `UiSortableHeader` - label, direction, and keyboard sorting.
48. `UiDataCell` - primary value, secondary metadata, copy, and truncation contract.
49. `UiMobileTableScroller` - preserves table comparison through horizontal scrolling.
50. `UiFilterBar` - responsive filters with applied-state visibility.
51. `UiColumnPicker` - optional columns without changing required information.
52. `UiDescriptionList` - aligned key-value facts in pages and dialogs.
53. `UiStatMetric` - label, value, unit, context, and loading state.
54. `UiMetricTrend` - restrained delta and comparison period.
55. `UiCodeBlock` - code, endpoint, key, copy, and wrap behavior.
56. `UiTimeline` - orders, payments, audits, and status history.

### 5.5 Overlays: 8

57. `UiDialog` - bounded task or detail overlay with stable mobile viewport behavior.
58. `UiConfirmDialog` - explicit consequence, safe default, and destructive state.
59. `UiDrawer` - supplementary desktop detail without losing table context.
60. `UiSheet` - mobile task surface that respects browser safe areas and virtual keyboards.
61. `UiAnnouncementDialog` - announcement list and detail variants.
62. `UiImagePreview` - generated image zoom, download, and close actions.
63. `UiErrorDetailDialog` - request, account, and backend error diagnostics.
64. `UiFullscreenPanel` - charts, monitoring, or playground inspection.

### 5.6 Layout and page structure: 8

65. `AppPage` - page width, background, responsive padding, and loading stability.
66. `AppPageHeader` - title, essential description, status, and primary actions.
67. `AppSection` - unframed section rhythm with optional divider.
68. `AppStack` - vertical rhythm without local margin chains.
69. `AppInline` - aligned inline content and wrapping rules.
70. `AppGrid` - responsive columns with stable minimum tracks.
71. `AppSplitPane` - master/detail and playground composition.
72. `AppToolbar` - stable command placement across page types.

### 5.7 Extended primitives: 24

73. `UiAvatar` - image, initials fallback, size, and service presence.
74. `UiAvatarGroup` - overlapping members and remaining count.
75. `UiSlider` - bounded numeric adjustment with keyboard support.
76. `UiTagInput` - compact multi-value entry and removal.
77. `UiTimeInput` - custom hour/minute panel independent of browser-native styling.
78. `UiColorSwatch` - color choice with a Lucide selection marker.
79. `UiKbd` - keyboard command hint.
80. `UiDivider` - horizontal or vertical structural separation.
81. `UiSteps` - current, complete, and pending workflow steps.
82. `UiPageNav` - previous/next content navigation.
83. `UiSideNavGroup` - collapsible sidebar section.
84. `UiBackToTop` - threshold-based scroll affordance.
85. `UiBanner` - page-level notification band.
86. `UiSnackbar` - transient bottom feedback with one optional action.
87. `UiNotificationDot` - count or dot attached to an icon/control.
88. `UiPulseIndicator` - live status with reduced-motion fallback.
89. `UiKeyValue` - one-line property, value, and action.
90. `UiList` - compact icon, title, detail, and action rows.
91. `UiTree` - hierarchical data navigation.
92. `UiChartLegend` - chart label, swatch, and value.
93. `UiSparkline` - compact inline trend visualization.
94. `UiQuotaSummary` - used/total quota, progress, and reset context.
95. `UiLogLine` - aligned timestamp, level, and log message.
96. `UiScoreBar` - bounded score with numeric and visual representation.

### 5.8 Advanced workflow and operations: 18

97. `UiMultiCombobox` - searchable multi-selection for bounded options such as groups and models.
98. `UiAsyncEntityPicker` - controlled remote entity search with loading, empty, and selected states.
99. `UiDateTimeRangePicker` - exact date/time boundaries and reusable range presets.
100. `UiSecretField` - masked credential replacement, reveal, copy, preserve, and clear states.
101. `UiKeyValueEditor` - compact editable key-value rows with add and remove behavior.
102. `UiStructuredEditor` - JSON paste, file import, formatting, parsing, and diagnostics.
103. `UiServerTableWorkspace` - controlled table header, filters, content, empty state, and pagination shell.
104. `UiBulkActionBar` - selection summary and bounded batch commands.
105. `UiExportJob` - queued, running, failed, completed, retry, cancel, and download states.
106. `UiSaveBar` - dirty, saving, saved, discard, and save states for configuration pages.
107. `UiChangeSet` - compact before/after field comparison for audit and confirmation.
108. `UiFilterChips` - removable summary of applied filters.
109. `UiChartFrame` - title, tools, legend, loading, empty, error, update, and fullscreen shell for domain charts.
110. `UiThresholdMetric` - current value, bounded progress, threshold, and semantic breach state.
111. `UiLiveMetric` - real-time value with live, paused, and stale states.
112. `UiInlineEdit` - compact read/edit/commit/cancel workflow.
113. `UiTransferList` - low-frequency but necessary assignment between available and selected sets.
114. `UiReviewSummary` - final review facts, validation state, and submission actions.

### 5.9 Business compositions

Business compositions are assembled from the 114 contracts and retain their domain logic. They are not separate visual primitives. Priority compositions include:

- `GroupSelector` and `ModelSelector`;
- `AccountPriorityControl` and `AccountServiceStatus`;
- `QuotaMeter` and `SubscriptionUsageSummary`;
- `PaymentStatusPanel` and `OrderStatusTimeline`;
- `PlaygroundComposer` and `PlaygroundMessage`;
- `MonitorHealthSummary` and `UsageCostBreakdown`.

Existing domain components remain responsible for API calls, permissions, calculations, and business validation. Shared UI components own appearance and generic interaction only.

## 6. Component API Rules

Each shared component must provide, when applicable:

- light and dark tokens;
- mini, dense, compact, default, and large sizing through a documented prop;
- normal, hover, active, focus-visible, disabled, loading, invalid, and readonly states;
- keyboard operation and an accessible name;
- long Chinese, English, numeric, model ID, and API value handling;
- responsive behavior at `1440px`, `900px`, and `390px`;
- `prefers-reduced-motion` behavior;
- unit tests for contract behavior and a visual fixture for important variants.

Props describe meaning, not arbitrary CSS. Avoid props such as `blue`, `largeRounded`, or `shadowHeavy`; use roles such as `intent="danger"`, `density="compact"`, and `loading`.

## 7. Target Reuse Rate

Reuse is measured by the proportion of redesigned interface instances that use a shared contract, not by lines of CSS.

| Area | Target reuse | Allowed page-specific work |
| --- | ---: | --- |
| Buttons, links, form controls | `>= 95%` | specialized editors and third-party widgets |
| Dialogs, tooltips, status, loading | `>= 95%` | provider-owned authentication/payment frames |
| Tables, filtering, pagination | `>= 90%` | unusual virtualized or tree data adapters |
| Page shell, headers, toolbars, spacing | `>= 90%` | home hero and immersive playground body |
| Business composites | `>= 80%` visual reuse | API logic and domain-specific content |
| Charts and special visualizations | `>= 60%` structural reuse | chart geometry, series, and domain tooltips |
| Overall redesigned product | `>= 85%` component-instance reuse | genuinely unique product experiences |

No abstraction is created solely to improve the metric. A component becomes shared only when it removes real duplication, standardizes a risky interaction, or has at least two credible consumers.

## 8. Motion System

Motion explains state change; it is not decoration.

### 8.1 Timing

```css
--motion-instant: 100ms;
--motion-fast: 140ms;
--motion-base: 180ms;
--motion-slow: 240ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

### 8.2 Interaction rules

- Hover and focus color: `100-140ms`.
- Tooltip and popover: `120-140ms` opacity plus at most `2px` movement.
- Login/register content switch: persistent shell, `140ms` overlapping crossfade, at most `4px` movement, no empty frame.
- Dialog: backdrop opacity plus `4-8px` content movement in `180ms`; no scale bounce.
- Drawer and sheet: transform in `180-240ms`.
- Tabs and filters: content opacity only when needed; controls do not move.
- Table sorting, filtering, and pagination: preserve toolbar and table dimensions; no row-by-row entrance animation.
- Skeleton replacement: crossfade only if it prevents a visible flash.
- Charts may animate on first meaningful load, but live monitoring updates do not replay full entrance motion.

Animate only `opacity` and `transform` for transitions. Do not animate layout height, width, top, left, padding, or margin during normal navigation. Reserve dimensions before asynchronous content loads.

Under `prefers-reduced-motion: reduce`, remove nonessential transitions, smooth scrolling, chart entrance motion, and animated transforms while preserving immediate state feedback.

## 9. Responsive Rules

### Desktop

- Operational pages use the available width for comparison and scanning.
- Primary metrics and health state occupy the first visual row.
- Toolbars keep search/filter actions aligned and do not wrap unpredictably.
- Detail panels use drawers or split panes when preserving table context matters.

### Tablet

- Reduce column count before reducing readable type size.
- Move secondary actions into a menu, but keep the primary action visible.
- Preserve table headers and enable controlled horizontal scrolling.

### Mobile

- Page padding defaults to `16-24px` based on responsibility.
- Data-heavy pages remain tables inside `UiMobileTableScroller`; do not convert high-volume usage logs or model lists into oversized cards.
- Sticky columns are used only when they materially improve row identity and do not obscure comparison.
- Dialogs become `UiSheet` when browser chrome or the keyboard would cover content.
- Bottom actions respect `env(safe-area-inset-bottom)`.
- Text, controls, badges, and toolbars must not cause horizontal page overflow.

## 10. Page Migration Plan

### Phase A: foundations and compatibility

1. Create global typography, color, spacing, radius, elevation, density, and motion tokens.
2. Map the behavior contracts of existing `btn`, `input`, dialog, table, badge, and skeleton consumers to the new contracts; do not carry over their legacy DOM or visual CSS.
3. Build a component fixture page covering all states and three target viewports.
4. Add lint/review guidance against new hard-coded page palettes and duplicate primitives.

Expected result: new work can use the system while migration proceeds in bounded batches. Any compatibility wrapper is behavior-only, has a consumer inventory and tests, carries no legacy visual CSS, and must be removed by R9.

### Phase B: shell and authentication

Pages: login, registration, email verification, password recovery/reset, OAuth completion, setup.

- Extend the persistent authentication shell to all related routes.
- Reuse the current compact field/button treatment.
- Keep validation and help overlays from changing the initial form height.
- Unify the top-right locale, theme, and return actions.

Expected result: one minimal authentication experience with stable transitions.

### Phase C: user core workflows

Pages: dashboard, keys, usage, subscriptions, recharge/payment, orders, profile.

- Establish `AppPage`, `AppPageHeader`, `AppToolbar`, and the table system.
- Put current quota, cost, expiry, and next action before secondary detail.
- Unify status, money, date, quota, and request metadata formats.
- Keep usage records as a compact horizontally scrollable table on mobile.

Expected result: routine user tasks become visually predictable and faster to scan.

### Phase D: administrator operations

Pages: accounts, users, channels, groups, subscriptions, orders, payment plans, usage, announcements, promo/redeem, proxies, audit, backup, risk control, settings.

- Migrate highest-volume tables and their filters first.
- Replace card mosaics with aligned metrics, description lists, and tables.
- Use drawers for account/user detail when the source list must remain visible.
- Standardize bulk actions, row actions, dangerous confirmation, and inline editing.
- Preserve every data field; reorganize hierarchy without hiding required information.

Expected result: dense operational pages share one interaction language and retain full information.

### Phase E: monitoring and analytical tools

Pages: operations monitoring, channel status, account service status, dashboards, charts.

- Keep the health ring where it is the primary health summary.
- Place CPU, memory, Redis, quota, and bounded metrics in aligned progress rows.
- Use small status units for binary service state.
- Standardize chart legends, axes, number formats, empty states, and tooltips.
- Prevent auto-refresh from shifting layout or replaying entrance motion.

Expected result: the most important health signal is visible first and supporting data remains comparable.

### Phase F: model plaza and playground

Pages: model plaza, available channels, playground, image generation.

- Preserve list/table presentation on desktop and mobile.
- Keep model/group selection close to the action that uses it.
- Make conversation the playground's primary surface; parameters are secondary.
- Standardize response metadata: model ID, first-token latency, total duration, speed, and request timestamp.
- Generated images use compact inline presentation with `UiImagePreview` for inspection.

Expected result: model discovery and testing feel like focused tools rather than collections of nested panels.

### Phase G: public and exceptional pages

Pages: payment result, legal, announcements, not-found, custom pages, batch-image guidance, email preview.

- Reuse typography, status, overlay, and action components.
- Allow illustration only when it clarifies a state.
- Keep success/failure pages emotionally clear without oversized text or decorative clutter.

## 11. Migration Safety

- Do not change API payloads, permission checks, billing calculations, subscription logic, or route semantics as part of visual migration.
- Normalize one component family or page workflow at a time.
- Keep behavior-only compatibility wrappers only while existing consumers migrate; wrappers must not preserve legacy visual CSS or DOM and must have a consumer inventory, tests, and an R9 removal deadline.
- Delete an old style and its legacy DOM after all known consumers have moved and tests confirm no regression; no old visual implementation may remain as a permanent fallback.
- Avoid global selectors that mechanically restyle third-party widgets or legacy screens not yet reviewed.
- Document intentional exceptions next to the component contract, not as unexplained page CSS.

## 12. Acceptance Criteria

### Component acceptance

- All documented states render consistently in light and dark themes.
- Keyboard focus is visible and logical.
- Icon-only controls have accessible names.
- Loading and validation never erase required context.
- Long text and numeric values do not overlap adjacent content.
- Reduced-motion mode remains functional.

### Page acceptance

- The page's primary task is identifiable in the first viewport.
- All required information remains available.
- There is no card-inside-card composition.
- Async loading does not make the page temporarily narrow or change its main alignment.
- No horizontal page overflow at `1440px`, `900px`, or `390px`.
- Data tables remain usable by keyboard and on mobile.
- Browser console has no new errors or warnings caused by the migration.

### Verification workflow

1. Unit-test component behavior and state contracts.
2. Run TypeScript, ESLint, and production build.
3. Capture visual fixtures for `1440px`, `900px`, and `390px`.
4. Exercise loading, empty, error, long-text, dark, and reduced-motion states.
5. Test the page's primary workflow in a real browser.
6. Review the diff for new one-off colors, heights, radii, overlays, and duplicated primitives.

## 13. Definition of Done

A page is migrated only when it uses the shared tokens and applicable components, preserves its business behavior and full information set, passes automated and browser verification, and removes superseded local styling. Visual similarity alone is not completion; interaction, responsiveness, accessibility, loading stability, and information hierarchy must all meet this document.

## 14. Implemented Source Structure

The 114 contracts are implemented in `frontend/src/components/ui/` and exported by `frontend/src/components/ui/index.ts`.

```text
frontend/src/
├── styles/ui-tokens.css          # typography, palette, density, radius, motion
├── components/ui/                # 114 reusable component contracts
│   ├── index.ts                  # public imports
│   ├── types.ts                  # density, intent, and shared option types
│   └── __tests__/                # inventory and behavior contracts
└── views/admin/UiSystemView.vue  # interactive component fixture
```

The fixture is available to administrators at `/admin/ui-system`. It is intentionally absent from the normal sidebar because it is a development and acceptance surface, not a customer feature. During Vite development only, `/ui-system-preview` exposes the same fixture without authentication for local visual QA; that route is omitted from production builds.

Import only from the public entry in application code:

```ts
import {
  AppPage,
  AppPageHeader,
  AppSection,
  UiButton,
  UiDataTable,
  UiTextField,
} from '@/components/ui'
```

Do not import a new UI contract through a file path such as `@/components/ui/UiButton.vue`. The public entry is the compatibility boundary.

## 15. Selection Rules

### 15.1 Button, link, and menu selection

| Need | Component | Rule |
| --- | --- | --- |
| Commit the page's primary action | `UiButton variant="primary"` | One visible primary action per tool or dialog where practical |
| Cancel or secondary command | `UiButton` | White surface with neutral border |
| Low-priority local action | `UiButton variant="quiet"` | Use when a border would create too much visual weight |
| Destructive command | `UiButton variant="danger"` | Only after the consequence is clear; pair irreversible actions with `UiConfirmDialog` |
| Familiar symbol-only command | `UiIconButton` | Requires `label`; tooltip is derived from it |
| Navigation inside the application | `UiLink :to="..."` | Do not use a command button for navigation |
| External destination | `UiLink external href="..."` | Adds external indicator and safe `rel` attributes |
| Two to four closely related commands | `UiButtonGroup` | Do not use for unrelated page actions |
| Small row action list | `UiContextMenu` | Keep frequent or primary row actions visible instead |
| Longer bounded action list | `UiDropdownMenu` | Use labels and icons; destructive items use semantic danger text |
| Large searchable command set | `UiCommandMenu` | Admin navigation, command palette, or many actions only |

```vue
<AppInline justify="flex-end">
  <UiButton @click="cancel">取消</UiButton>
  <UiButton variant="primary" :loading="saving" @click="save">保存</UiButton>
</AppInline>
```

### 15.2 Field selection

| Data | Component | Rule |
| --- | --- | --- |
| Short free text | `UiTextField` | Add a visible label; placeholder is an example, not the label |
| Secret value | `UiPasswordField` | Rules live in the question tooltip and do not occupy initial form height |
| Long text or JSON notes | `UiTextArea` | Use `maxlength` when a real limit exists |
| Up to roughly 10 known choices | `UiSelect` | No search unless the set is genuinely hard to scan |
| Large or creatable option set | `UiCombobox` | Model, group, provider, or account search |
| Search a list | `UiSearchInput` | Emits immediate model updates and debounced search events |
| Integer priority or weight | `UiNumberStepper` | Minimum may be `0`; do not invent a maximum |
| Independent choice | `UiCheckbox` | Label describes the selected state |
| Mutually exclusive settings | `UiRadioGroup` | Use when all options should remain visible |
| Immediate on/off setting | `UiSwitch` | Requires a meaningful accessible label |
| Two to four view modes | `UiSegmentedControl` | Do not use it as a command toolbar |
| Calendar date | `UiDateInput` | Use local `YYYY-MM-DD` values at the view boundary |
| Query time range | `UiDateRangePicker` | API conversion owns inclusive/exclusive and timezone boundaries |
| File input | `UiFileUpload` | Validate MIME, size, and payload in the consumer |

`UiFormField` supplies label, description, help, error, and required state for custom controls. `UiFieldHelp` contains optional rules or concepts; `UiFieldError` is used only after validation fails.

`UiCheckbox` emits the normal `update:modelValue` event and a secondary `change(checked, nativeEvent)` event. Use the secondary event only when a controlled consumer must reject a change (for example, preserving at least one selected capability) and immediately restore the native checkbox state.

```vue
<UiTextField
  v-model="form.email"
  id="email"
  label="邮箱"
  autocomplete="email"
  :error="errors.email"
/>

<UiNumberStepper
  v-model="form.priority"
  label="调用优先度"
  description="数字越大，优先级越高"
  :min="0"
/>
```

Form layout:

```vue
<AppGrid min="260px" :gap="16">
  <UiTextField ... />
  <UiSelect ... />
</AppGrid>
<AppStack :gap="12">
  <UiTextArea ... />
  <UiFileUpload ... />
</AppStack>
```

Use `AppGrid` for peer fields and `AppStack` for fields whose width or content differs. Do not wrap every field in an extra card.

### 15.3 Navigation selection

- `UiTabs`: switch views of the same resource without changing the global context.
- `UiBreadcrumb`: show deep administrator hierarchy; omit it on shallow user pages.
- `UiPagination`: page through server or local data. The mobile view remains compact.
- `UiPopover`: interactive contextual content; it is the primitive behind menus and pickers.
- `UiTooltip`: one or two short read-only sentences. It must not contain a required action.
- `UiAccordion`: advanced settings, FAQ, and secondary details.
- `UiNavItem`: common active, hover, badge, and collapsed states for header/sidebar navigation.

```vue
<UiTabs v-model="view" label="用量视图" :tabs="[
  { value: 'records', label: '请求记录' },
  { value: 'stats', label: '统计' },
]" />
```

### 15.4 Status and feedback selection

| Situation | Component |
| --- | --- |
| Neutral attribute such as provider or plan type | `UiBadge` |
| Health, availability, payment, or order state | `UiStatusBadge` |
| Persistent information inside the current task | `UiAlert` |
| Transient operation result | `UiToast` |
| Indeterminate local work | `UiSpinner` |
| Bounded capacity, CPU, memory, quota | `UiProgressBar` |
| One primary health score | `UiProgressRing` |
| Predictable initial loading geometry | `UiSkeleton` |
| No result and one possible next action | `UiEmptyState` |
| Failed load with retry | `UiErrorState` |
| Updating one existing tool | `UiLoadingOverlay` |
| Live stream connection state | `UiConnectionStatus` |

Do not show a spinner where the final geometry is known; use a dimensionally equivalent skeleton. Do not use a toast as the only explanation for billing, payment, or destructive failure.

### 15.5 Table and data selection

Use `UiDataTable` when users scan, compare, sort, or operate on repeated records. Compose it with:

```vue
<UiTableToolbar>
  <UiSearchInput v-model="query" />
  <template #actions>
    <UiColumnPicker v-model="visibleColumns" :columns="columns" />
    <UiButton variant="primary" density="compact">新增</UiButton>
  </template>
</UiTableToolbar>

<UiMobileTableScroller min-width="760px">
  <UiDataTable :columns="columns" :data="rows" mobile-table>
    <template #cell-name="{ row }">
      <UiDataCell :value="row.name" :meta="row.provider" />
    </template>
  </UiDataTable>
</UiMobileTableScroller>

<UiPagination
  v-model:page="page"
  v-model:page-size="pageSize"
  :total="total"
/>
```

- `UiTableToolbar`: only search, filtering, bulk commands, export, refresh, and the primary create action.
- `UiSortableHeader`: use when building a specialized table outside `UiDataTable`.
- `UiDataCell`: primary value plus one metadata line, optional mono and copy behavior.
- `UiMobileTableScroller`: required when comparison columns must survive on mobile.
- `UiFilterBar`: visible and optional filters; show applied count and clear behavior.
- `UiColumnPicker`: may hide optional columns but never required information.
- `UiDescriptionList`: aligned facts in detail pages, drawers, and dialogs.
- `UiStatMetric`: one metric with unit and context; metrics sit in `AppGrid`, not individual decorative cards.
- `UiMetricTrend`: compact comparison attached to a metric.
- `UiCodeBlock`: code, IDs, endpoints, and payloads; always provide copy where useful.
- `UiTimeline`: ordered payment, order, audit, and state transitions.

### 15.6 Overlay selection

| Need | Component | Layout |
| --- | --- | --- |
| Complete a bounded task | `UiDialog` | Header, scrollable body, footer actions |
| Confirm a consequence | `UiConfirmDialog` | Short message; cancel first, confirm last |
| Inspect/edit while preserving a desktop list | `UiDrawer` | Right side by default |
| Mobile filters or keyboard-sensitive task | `UiSheet` | Bottom surface with safe-area padding |
| Announcement list/detail | `UiAnnouncementDialog` | Compact type, readable long content |
| Inspect generated media | `UiImagePreview` | Full viewport, image remains uncropped |
| Request/account diagnostic detail | `UiErrorDetailDialog` | Facts followed by raw error block |
| Monitoring/chart/playground expansion | `UiFullscreenPanel` | Fixed toolbar and scrollable content |

Do not open a dialog for ordinary page navigation. Do not put a complete page card inside a dialog. Dialog actions use `AppInline justify="flex-end"` and slim buttons.

### 15.7 Page layout selection

```vue
<AppPage width="wide">
  <AppPageHeader title="账号管理" description="管理上游账号与调度状态">
    <template #actions>
      <UiButton variant="primary">新增账号</UiButton>
    </template>
  </AppPageHeader>

  <AppSection title="账号列表">
    <!-- toolbar and table -->
  </AppSection>
</AppPage>
```

- `AppPage`: owns maximum width and responsive page padding.
- `AppPageHeader`: one page title, essential description, status, and primary actions.
- `AppSection`: unframed vertical section; use a divider instead of a section card.
- `AppStack`: consistent vertical rhythm.
- `AppInline`: inline alignment and wrapping.
- `AppGrid`: stable responsive tracks for peer fields or metrics.
- `AppSplitPane`: playground and master/detail layouts.
- `AppToolbar`: stable command row, optionally sticky within an operational page.

## 16. Styling and Extension Rules

Consumers may set width, grid placement, or contextual spacing. They may not redefine the component's colors, height, radius, focus ring, disabled state, or motion.

Allowed:

```vue
<UiSearchInput class="max-w-[320px]" />
<AppGrid min="300px" :gap="20">...</AppGrid>
```

Avoid:

```vue
<UiButton class="h-12 rounded-2xl bg-blue-600 shadow-xl">...</UiButton>
```

If a component lacks a real product state, extend its semantic API and fixture coverage. Do not patch it from an individual page with `:deep()` or `!important`.

Business components remain in their domain folders and compose this layer. For example, account service health owns status calculations while rendering `UiStatusBadge`, `UiProgressBar`, `UiTooltip`, and `UiTimeline`.

## 17. Implementation Status

- Design tokens: implemented in `frontend/src/styles/ui-tokens.css`.
- Public component entry: implemented in `frontend/src/components/ui/index.ts`.
- 114 component contract files: implemented.
- Interactive fixture: implemented at `/admin/ui-system`.
- Inventory and primitive contract tests: implemented in `frontend/src/components/ui/__tests__/`.
- Consumer inventory: `docs/frontend-rebuild/CONSUMER-INVENTORY.md` records 114 contracts,
  276 distinct production consumer files and 1,880 runtime component references.
  Twenty contracts currently have no external direct consumer: two are composed by
  another public component (`UiFieldError`, `UiTimeInput`) and 18 are explicitly
  reference-only/staged contracts retained for low-frequency pages, tests and showcase.
  The executable AST gate is `UiConsumerInventory.spec.ts`; it rejects unknown,
  namespace and dynamic barrel imports.
- Existing pages: compatibility migration remains phased according to Section 10. A component being implemented does not mean every legacy consumer has already migrated; the consumer inventory is evidence of import reachability, not page-level browser acceptance.

## 18. Component Reference

This is the quick decision index. “Shape” describes the default visual form; special business colors or dimensions must not override it from a page.

### 18.1 Actions and fields

| Component | Default shape | Use it for |
| --- | --- | --- |
| `UiButton` | `28/32/36px` slim rectangle, `6px` radius, icon and label | Page and dialog commands |
| `UiIconButton` | Square slim control with centered `16px` icon | Familiar symbolic tools such as refresh, close, copy |
| `UiButtonGroup` | Adjacent buttons sharing their inner borders | Two to four commands acting on the same value |
| `UiLink` | Underlined text with optional external icon; unadorned `brand` variant for logo/site-name navigation | Internal or external navigation |
| `UiTextField` | Label above a single-line neutral input | Short strings, email, URL, IDs |
| `UiPasswordField` | Text field with lock, reveal, and rules tooltip | Password and secret entry |
| `UiTextArea` | Resizable neutral multiline surface with optional counter | Notes, prompts, headers, JSON text |
| `UiSelect` | Closed field with chevron and bounded option list | Small known option sets |
| `UiCombobox` | Select field with search and optional creation | Models, groups, accounts, large sets |
| `UiSearchInput` | Compact field with search and clear icons | Filtering an existing list or table |
| `UiNumberStepper` | Minus, editable number, plus in one border | Priority, weight, counts, bounded minimum values |
| `UiCheckbox` | `16px` box followed by label | Independent selection and bulk row selection |
| `UiRadioGroup` | Visible round choices in one fieldset; optional `ariaLabel`, option `title`, and `#option` slot preserve rich metadata | Mutually exclusive settings users should compare, including platform/rate choice cards that still need the shared radio contract |
| `UiSwitch` | `34×20px` neutral/black track and thumb | Immediate on/off settings |
| `UiSegmentedControl` | Small options on one muted strip; supports option `title` and `#option` content without losing radio semantics | Two to five modes or view types, including compact platform selectors |
| `UiDateInput` | Native date field using shared field styling | One calendar date |
| `UiDateRangePicker` | Compact preset trigger and two date fields | Usage, audit, order, and monitoring queries |
| `UiFileUpload` | One dashed drop target with icon and progress | JSON import, images, certificates, configuration files |
| `UiFormField` | Label/help row, control slot, description/error row | Wrapping any custom form control |
| `UiFieldHelp` | `16px` question icon with viewport-aware tooltip | Optional rules or unfamiliar concepts |
| `UiFieldError` | Small red icon and message under the field | Validation failure after interaction or submit |
| `UiCopyButton` | Dense icon button switching briefly to a check | Keys, IDs, URLs, code, request values |

### 18.2 Navigation and disclosure

| Component | Default shape | Use it for |
| --- | --- | --- |
| `UiTabs` | Text tabs above a divider with `2px` active underline | Views of the same page resource |
| `UiBreadcrumb` | Small muted inline hierarchy with chevrons | Deep administrator routes |
| `UiPagination` | Dense page buttons plus result range | Server or client paginated collections |
| `UiDropdownMenu` | One elevated neutral list with `30px` rows | Bounded secondary actions |
| `UiContextMenu` | Dense three-dot trigger opening a dropdown | Row or item overflow actions |
| `UiPopover` | Viewport-positioned neutral overlay | Interactive contextual tools |
| `UiTooltip` | Short dark overlay with no required action | Concise read-only explanations |
| `UiAccordion` | Divider-separated text rows with chevron | Advanced settings, FAQ, secondary detail |
| `UiCommandMenu` | Search field above dense command results | Large navigation or action sets |
| `UiNavItem` | `34px` icon/text row with muted active fill | Sidebar and compact navigation |

### 18.3 Feedback and status

| Component | Default shape | Use it for |
| --- | --- | --- |
| `UiBadge` | Small outlined capsule with optional dot | Categories, providers, plan attributes |
| `UiStatusBadge` | Semantic badge with dot and explicit text | Health, availability, order/payment state |
| `UiAlert` | One lightly tinted inline row | Persistent information within a task |
| `UiToast` | Small elevated transient message | Completion or noncritical operation result |
| `UiSpinner` | `12/16/24px` circular activity indicator | Indeterminate local work |
| `UiProgressBar` | Label/value above a `6px` track | CPU, memory, Redis, quota, bounded usage |
| `UiProgressRing` | Thin ring around percentage and short label | One prominent health score |
| `UiSkeleton` | Muted rect, text, or circle matching final dimensions | Initial asynchronous loading |
| `UiEmptyState` | Centered icon, title, short reason, optional action | A valid empty collection or result |
| `UiErrorState` | Error icon, explanation, retry | Failed data load or terminal tool state |
| `UiLoadingOverlay` | Local translucent layer over existing content | Refreshing or submitting one bounded tool |
| `UiConnectionStatus` | Semantic live/reconnect/stale/offline badge | Streaming and real-time monitoring connection |

### 18.4 Data display

| Component | Default shape | Use it for |
| --- | --- | --- |
| `UiDataTable` | One bordered table surface with muted header | Repeated records requiring scan and comparison |
| `UiTableToolbar` | `44px` search/filter row with right actions | Commands belonging to a table |
| `UiSortableHeader` | Header text and small direction icon | Specialized sortable table headers |
| `UiDataCell` | Primary line, metadata line, optional copy | IDs, accounts, models, providers, request values |
| `UiMobileTableScroller` | Focusable horizontal overflow region | Preserving a comparison table on narrow screens |
| `UiFilterBar` | Divider-separated wrapping fields and actions | Visible table or report filters |
| `UiColumnPicker` | Dropdown of column checkboxes | Optional table columns |
| `UiDescriptionList` | Aligned label/value rows without cards | Facts in details, drawers, dialogs |
| `UiStatMetric` | Top divider, label, large tabular value, context | Dashboard and monitoring metrics |
| `UiMetricTrend` | Tiny arrow, signed percentage, period | Comparison attached to a metric |
| `UiCodeBlock` | Dark monospace block with header and copy | Payloads, endpoints, keys, code |
| `UiTimeline` | Small status nodes on a vertical line | Orders, payments, audits, state history |

### 18.5 Overlays

| Component | Default shape | Use it for |
| --- | --- | --- |
| `UiDialog` | Centered `8px` panel with header/body/footer | Bounded form or detail task |
| `UiConfirmDialog` | Narrow dialog with cancel and confirm | Consequence confirmation |
| `UiDrawer` | Desktop side panel up to `460px` | Detail/edit while preserving list context |
| `UiSheet` | Mobile bottom surface with safe-area footer | Filters and keyboard-sensitive mobile tasks |
| `UiAnnouncementDialog` | Readable compact dialog content | Announcement list and detail |
| `UiImagePreview` | Full dark viewport with uncropped image | Generated image inspection |
| `UiErrorDetailDialog` | Facts followed by raw diagnostic block | Request and account troubleshooting |
| `UiFullscreenPanel` | Full viewport with fixed `52px` toolbar | Expanded monitoring, charts, playground tools |

### 18.6 Layout

| Component | Default shape | Use it for |
| --- | --- | --- |
| `AppPage` | Centered responsive page padding and width | Root of every console page |
| `AppPageHeader` | Title/description left, primary actions right | One consistent page entry hierarchy |
| `AppSection` | Unframed vertical band with optional divider | Major page content groups |
| `AppStack` | Configurable vertical flex rhythm | Forms and sequential content |
| `AppInline` | Aligned wrapping horizontal rhythm | Actions, badges, compact facts |
| `AppGrid` | Auto-fit stable minimum tracks | Peer fields, metrics, repeated tools |
| `AppSplitPane` | Master width plus flexible detail | Playground and desktop master/detail |
| `AppToolbar` | Stable command row with optional stickiness | Page-level operational commands |

## 19. Review Checklist for New UI

Before approving new frontend code, check:

1. The page starts with `AppPage` and has one `AppPageHeader` unless it is a documented exceptional surface.
2. A component from Section 18 is selected before creating local HTML/CSS.
3. Page CSS changes only placement and contextual width, not a shared component's visual contract.
4. Buttons are commands, links are navigation, tabs are views, and switches are immediate settings.
5. No card contains another card and no full page section is wrapped only for decoration.
6. Operational numbers use tabular figures; identifiers and code use monospace.
7. Loading reserves final dimensions and transitions do not animate layout properties.
8. Mobile tables remain comparable and overlays respect browser chrome, keyboard, and safe areas.
9. The new state is added to `/admin/ui-system` or the development `/ui-system-preview` fixture.
10. TypeScript, ESLint, tests, production build, and three target viewports pass before migration is considered complete.
