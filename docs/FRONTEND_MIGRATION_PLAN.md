# Ghost Writer Frontend Migration Plan

## Purpose

Move Ghost Writer from its current HTML and inline JavaScript frontend to
React + TypeScript + Vite + locally compiled Tailwind CSS, one verified slice at
a time.

The current interface is the reference implementation. Every migration step
must preserve its visual output and behavior before the next step begins. This
plan intentionally treats the migration as a controlled replacement of the
frontend implementation, not as a redesign.

## Non-negotiable constraints

1. **The current UI is the golden reference.** The existing pages in
   `src/index.html`, `src/notepad.html`, and `src/clipboard.html` define the
   required DOM relationships, dimensions, spacing, colors, typography, icon
   metrics, animations, labels, and empty/error/loading states.
2. **No product behavior changes.** AI requests, image generation, clipboard
   capture, history retention, pinning, notepad autosave, settings, shortcuts,
   localization, toasts, and window lifecycle must behave exactly as they do
   today.
3. **Rust stays the authority for native behavior.** Do not move filesystem,
   clipboard, encryption, shortcut, window, or AI-provider logic into React.
   Existing Tauri commands and events are contracts during the migration.
4. **One page at a time.** Keep the old implementation available until the
   React implementation passes the page's visual, functional, and packaging
   gates.
5. **No speculative UI library.** Radix or shadcn-style primitives may be
   introduced only when a real interaction needs them and only with styling
   that matches the reference. Native controls remain preferred.
6. **Icon changes require proof.** Material Icons are part of the current
   visual reference. Lucide may be used in a migrated component only after its
   size, stroke, baseline, and optical weight match the reference at the target
   window size. Keeping Material Icons during a page migration is acceptable.
7. **Every change must be reversible.** Each page migration should be an
   isolated commit or small commit series with a working legacy fallback.

## Current baseline

The repository is currently in a compatibility-first stage:

- Vite is configured as a multi-page build with `src/` as its root. It writes
  `src/index.html`, `src/notepad.html`, and `src/clipboard.html` to `dist/`.
- Tailwind is compiled locally through PostCSS. The local theme mirrors the
  existing `primary`, glass, font, and radius tokens that were previously
  supplied by the CDN configuration.
- `src/main.tsx` loads the compiled stylesheet and shared appearance behavior,
  then mounts a hidden React runtime so the pages can adopt React without
  replacing their DOM yet.
- `src/App.tsx`, `src/notepad.tsx`, and `src/clipboard.tsx` are typed React
  implementations staged for later page-by-page adoption. They are not the
  production page owners yet.
- `src/appearance.js` is bundled by Vite so theme, acrylic blur, blur amount,
  transparency, and cross-window synchronization continue to work in packaged
  builds.
- Tauri packages `dist/`. Rust source under `src-tauri/src/` has not been
  changed as part of the frontend migration.

This baseline is considered **Phase 1 complete**, but the frontend is not yet
fully React-owned. The remaining phases below are the actual UI migration.

## Target architecture

The final frontend should have clear page entry points and a thin native
bridge:

```text
src/
├── pages/
│   ├── HomePage.tsx
│   ├── NotepadPage.tsx
│   └── ClipboardPage.tsx
├── components/
│   ├── home/
│   ├── notepad/
│   ├── clipboard/
│   ├── settings/
│   └── shared/
├── hooks/
├── services/
│   ├── ai.ts
│   ├── clipboard.ts
│   ├── notepad.ts
│   └── appearance.ts
├── lib/
│   ├── tauri.ts
│   ├── storage.ts
│   └── contracts.ts
├── types/
├── styles.css
├── main.tsx
├── notepad-main.tsx
└── clipboard-main.tsx
```

The final entry flow should be:

```text
index.html     → main.tsx          → HomePage
notepad.html   → notepad-main.tsx  → NotepadPage
clipboard.html → clipboard-main.tsx → ClipboardPage
                                      ↓
                                Tauri services
```

The page components own rendering and UI state. Services own storage,
serialization, Tauri invocation, and event subscriptions. Rust remains the
owner of native operations. Components should not call arbitrary Tauri
commands directly; they should use typed service functions with explicit
contracts.

## Reference inventory to freeze before React work

Create a reference record before replacing any visible component. The record
should be kept under `docs/frontend-reference/` and updated only when the
existing product intentionally changes.

### Window and page dimensions

Use the current Tauri window sizes as the visual test viewports:

| Page | Reference viewport |
|---|---:|
| Home | 340 × 470 |
| Notepad | 580 × 660 |
| Clipboard | 420 × 600 |

Record behavior at the configured minimum sizes as well. Include both dark and
light appearance states wherever the existing page supports them.

### DOM and style inventory

For each page, record:

- top-level shell classes and window drag regions;
- every stable `id`, `data-i18n` key, `aria-*` attribute, and keyboard target;
- computed font family, weight, size, line height, color, background, border,
  radius, shadow, blur, opacity, and transition values for visible states;
- scroll container boundaries and scrollbar behavior;
- focus, hover, pressed, disabled, loading, empty, error, and selected states;
- image sizing and fallback behavior;
- the exact Material Icon name, size, and alignment for each existing icon;
- text strings and their translations.

Do not use a screenshot as the only reference. A screenshot can miss focus,
hover, overflow, keyboard, and accessibility behavior. Keep a DOM/style record
and screenshots together.

### Workflow inventory

Capture a reproducible workflow for each behavior. Each workflow should record
the starting local storage state, user actions, expected visible result, Tauri
commands/events, and resulting storage state. Redact keys and user text in
committed fixtures.

## Migration phases

### Phase 0 — Freeze and baseline the existing frontend

**Goal:** make visual and functional regressions observable before changing
page ownership.

Tasks:

- Create a migration branch and record the starting commit.
- Preserve the existing pages as the legacy reference. Do not edit them for
  formatting during this phase.
- Capture screenshots at the three reference viewports in dark and light
  states where applicable.
- Record DOM snapshots for the home, notepad, and clipboard initial states.
- Record computed style snapshots for the shells, headers, controls, panels,
  result cards, toasts, and loading states.
- Inventory all inline handlers, functions, constants, storage keys, command
  names, event names, and cross-window messages.
- Turn the existing `tests/workflows.test.mjs` checks into a named baseline
  suite. Do not delete or weaken these tests while migrating.
- Add a short manual smoke checklist for launching each Tauri window, closing
  it, dragging it, using the global shortcuts, and reopening it.

Exit gate:

- A clean build and test run is recorded.
- A new developer can reproduce the reference screenshots and workflows.
- Every production page has a documented fallback entry.

### Phase 1 — Toolchain without UI ownership changes (complete)

**Goal:** change the build stack while keeping the reference pages in control
of the UI.

Completed work to retain:

- React, TypeScript, Vite, Tailwind, PostCSS, and Lucide dependencies are
  installed.
- Vite builds all three existing pages and emits relative asset URLs suitable
  for Tauri's app protocol.
- The Tailwind theme is local and uses the existing design tokens.
- The appearance module is bundled instead of loaded as an unbundled asset.
- Tauri's `frontendDist`, dev URL, and build hooks point to the Vite output.

Exit gate:

- The packaged pages render with the same layout and states as the reference.
- `corepack npm run build`, `corepack npm test`, `cargo check --manifest-path
  src-tauri/Cargo.toml`, and a Tauri release build pass.
- No Rust source changes are needed for the frontend build.

### Phase 2 — Extract contracts and pure services

**Status: complete for the typed services and legacy compatibility adapter.**
The active page owners remain unchanged; visible React cutover begins in Phase
3 only after the Notepad fallback and visual gates are added.

**Goal:** move data and native boundaries into typed modules without changing
the visible pages.

Do this before converting JSX so the UI migration does not also invent new
storage formats or command semantics.

Tasks:

- Define TypeScript types for appearance settings, AI settings, provider
  configuration, clipboard items/settings, notes, generated images, toast
  state, and shortcut values.
- Centralize the existing storage keys and default values. Keep the exact key
  strings and migration behavior, including legacy keys.
- Wrap every existing Tauri command in a typed function in `src/lib/tauri.ts`
  or `src/services/`. Preserve command names and argument shapes.
- Wrap event listeners for `selection-captured`, `appearance-changed`,
  `clipboard-command`, and any other existing event in typed subscriptions.
- Move pure functions first: settings normalization, provider selection,
  clipboard sorting/trimming, time formatting, image data URL conversion,
  shortcut display formatting, and translation lookup.
- Add unit tests for every extracted pure function using current behavior as
  the expected result.
- Keep a small legacy adapter where inline functions still need to call the
  extracted service. Do not duplicate storage or command logic in the React
  layer.

Exit gate:

- The legacy pages still pass every workflow test.
- Service tests cover valid, missing, malformed, and legacy stored values.
- No service changes storage keys, command names, event names, or payload
  shapes without an explicit compatibility decision.

### Phase 3 — Shared visual primitives and React shell

**Status: foundation complete; page ownership remains with the legacy DOM.**
The shared primitives and isolated hidden shell are ready for the Notepad
parity slice in Phase 4.

**Goal:** establish React ownership of non-product-specific structure while
keeping the pixels unchanged.

Tasks:

- Create a shared `GlassWindow`, `DragRegion`, `WindowHeader`, `Toast`,
  `LoadingState`, `IconButton`, `PrimaryButton`, `SegmentedControl`, and
  `BottomSheet` only where the reference contains the corresponding pattern.
- Start each primitive from the existing markup and class list. Extracting a
  component must not rename classes, alter nesting, or change default browser
  behavior without a snapshot proving parity.
- Keep the existing appearance CSS and CSS variables as the source of truth.
- Keep Material Icons in migrated components until a Lucide replacement passes
  a visual comparison. If Lucide changes the stroke or baseline, retain the
  original icon.
- Add `data-testid` attributes only where needed for tests; do not use them as
  styling hooks.
- Mount a React shell into an isolated page root while the remaining legacy
  DOM stays available behind the fallback switch.

Exit gate:

- The shell has identical dimensions, drag behavior, translucency, blur,
  border, shadow, focus, and close behavior.
- A fallback flag can restore the legacy shell without rebuilding Rust.
- No page workflow has been moved yet unless its reference test passes.

### Phase 4 — Migrate Notepad first

**Status: React slice implemented behind the fallback flag; visual cutover
gate pending.**

**Goal:** convert the smallest self-contained window and validate the process.

Reference: `src/notepad.html`.

Preserve these behaviors and boundaries:

- Existing notepad and legacy storage keys, including migration from the legacy
  key when present.
- Initial note selection, note count, empty state, tab rendering, tab
  selection, tab rename, new note, note deletion, and last-note behavior.
- Title and body editing, debounced autosave, saved indicator, updated date,
  copy-to-clipboard, image attachment display, and delete confirmation/toast
  behavior.
- `close_notepad_window`, `write_to_clipboard`, and any existing drag-region
  behavior.
- Exact tab widths, truncation, close icon placement, editor spacing, text
  sizes, scrollbar behavior, and light/dark appearance styles.

Suggested sequence:

1. Replace only the static header with a React component while keeping the
   existing editor DOM and handlers.
2. Move tab state and rendering into React, retaining the same tab classes and
   stable attributes.
3. Move title/content editing and autosave into a typed hook backed by the
   extracted storage service.
4. Move copy, delete, image attachment, toast, and close actions.
5. Switch the notepad Tauri entry to `NotepadPage` only after the full workflow
   suite passes.
6. Keep the legacy notepad entry as a one-release fallback before deleting any
   duplicate code.

Notepad exit gate:

- Existing notes open unchanged.
- Creating, renaming, editing, deleting, copying, reopening, and autosaving
  produce the same visible and stored results.
- Reference screenshots match at 580 × 660 and the configured minimum size.
- Keyboard focus, drag behavior, and close behavior match.

### Phase 5 — Migrate Clipboard second

**Goal:** convert the standalone history window while preserving its local
history semantics and cross-window commands.

Reference: `src/clipboard.html`.

Preserve these behaviors and boundaries:

- `ghost_writer_clipboard_history_v1` and
  `ghost_writer_clipboard_settings_v1` storage formats and defaults.
- Loading malformed history safely, sorting pinned items first, retaining the
  existing timestamp order, trimming only unpinned items, and respecting the
  history limit.
- Automatic capture polling, forced capture, duplicate prevention, image
  clipboard entries, text/image copy behavior, pin/unpin, delete, clear all,
  search, view filters, grouped timeline rendering, item counts, and toasts.
- `clipboard-command` event handling for refresh, clear, and settings updates.
- `read_clipboard_text`, `write_to_clipboard`, `copy_image_to_clipboard`, and
  `close_clipboard_window` argument shapes.
- Existing timeline rail, dots, selection state, action buttons, dark/light
  behavior, scrolling, and icon metrics.

Suggested sequence:

1. Move storage normalization, sorting, trimming, and grouping to tested typed
   services.
2. Port the shell/header and search/filter controls with the exact classes and
   dimensions.
3. Port one history item and its copy/pin/delete actions.
4. Port empty states, image entries, grouped timeline, clear history, and
   toast behavior.
5. Add event subscription cleanup tests so hidden or closed windows do not
   accumulate listeners or polling timers.
6. Switch the Clipboard Tauri entry only after old and new workflow results
   match for the same fixtures.

Clipboard exit gate:

- The same fixture history renders in the same order and grouping.
- Pinning, eviction, searching, copying, image copying, deleting, clearing,
  refresh events, and settings events match.
- Automatic capture does not create duplicates or timer leaks.
- Reference screenshots match at 420 × 600 and the configured minimum size.

### Phase 6 — Migrate the Home window shell and menu

**Goal:** move the home window's navigation and action surface before moving
the more complex settings and AI flows.

Reference: `src/index.html`.

Preserve:

- Captured text indicator and copied-text fallback.
- Prompt input, quick action labels and prompts, Image, Diagram, Notepad, and
  Clipboard action rows.
- Menu/result/image/settings view transitions, back behavior, loading states,
  close/hide behavior, and settings FAB placement.
- Exact 340 × 470 shell sizing, responsive overflow, rounded glass panels,
  gradients, and Material Icon alignment.

Suggested sequence:

1. Port `GlassWindow`, drag strip, captured-text area, and menu layout.
2. Port prompt state and quick actions using the existing prompt strings.
3. Port workspace actions and window-opening service calls.
4. Port view state and transitions while retaining the exact hidden/visible
   class behavior.
5. Port loading, result, image prompt, image loading, and image result shells
   with mocked service results before connecting real Tauri calls.

Home shell exit gate:

- The initial menu is pixel-equivalent in every supported appearance state.
- Captured text, prompt editing, every quick action, and every workspace action
  produce the same next view and Tauri call.
- View transitions and back/close behavior match without stale results.

### Phase 7 — Migrate Home settings and AI flows

**Goal:** move the highest-risk stateful surface only after its shell is stable.

Port settings one tab at a time:

1. **Models:** provider catalog, cloud/local/custom endpoint forms, encrypted
   key storage, model selectors, image model selectors, provider testing,
   add/edit/remove flows, masking, validation, and error messages.
2. **General:** capture shortcut recorder, Clipboard shortcut recorder, theme,
   language, acrylic toggle, blur slider, and transparency slider.
3. **Clipboard:** automatic capture, history limit, open-only behavior, capture
   now, clear history, and Clipboard window opening.

Then port AI and image behavior:

- selected text resolution and manual copied-text behavior;
- process-text request construction and error extraction;
- accept/reject/copy result behavior, including the rule that summaries do not
  paste over the source;
- stale-response protection when the selection changes;
- image and diagram prompt construction;
- generated image display, copy, download, save-to-Notepad, and regenerate;
- loading and failure states.

Home settings/AI exit gate:

- Every existing provider and legacy settings fixture loads identically.
- Encrypted values still use the existing Rust encrypt/decrypt commands.
- Shortcut updates still reach the existing native registration path.
- AI, image, diagram, accept, reject, copy, save, and stale-response workflows
  pass against deterministic IPC fixtures.
- All three settings tabs match their reference screenshots and keyboard focus
  order.

### Phase 8 — Remove duplicate legacy UI after a soak period

**Goal:** finish the migration only after React has proven itself in the real
  Tauri windows.

Tasks:

- Run both implementations side by side against the same sanitized storage
  fixtures and IPC responses.
- Keep the legacy fallback for at least one release candidate or agreed soak
  period.
- Remove only duplicate page markup and handlers that are fully covered by the
  React implementation.
- Keep the shared appearance and service compatibility layers if they remain
  useful to future pages.
- Remove the hidden bootstrap behavior only after all three React entry points
  are active and the fallback is no longer required.
- Update README, design language, and architecture docs to describe the final
  React-owned structure.

Exit gate:

- No production page depends on inline event handlers or duplicate legacy
  state management.
- The same storage and Tauri command contracts still work after a clean
  install and upgrade from an older release.
- Legacy files are removed only after their replacement has passed all release
  gates and a rollback build has been verified.

## Behavior parity matrix

Use this matrix for every migrated slice. Mark a row complete only when both
automated and manual evidence exists.

| Area | Reference behavior | Automated evidence | Manual evidence |
|---|---|---|---|
| Appearance | Theme, acrylic, blur, transparency sync across windows | service tests + event tests | change setting in one window and inspect all windows |
| Capture | Global shortcut opens captured text | command/event integration test | capture from another application |
| Prompt | Prompt and quick actions preserve text and intent | component interaction tests | run each quick action |
| AI result | Accept/reject/copy semantics match | deterministic IPC workflow tests | inspect source and result before/after |
| Images | Generate, copy, download, save, regenerate | image fixture tests | inspect image result and Notepad attachment |
| Models | Provider/key/model forms preserve storage and validation | storage + IPC tests | add, edit, test, remove providers |
| Shortcuts | Recording and persistence match | command payload tests | change and trigger both shortcuts |
| Clipboard | Capture, dedupe, pin, trim, search, copy, clear | history/service tests | exercise history with pinned/unpinned fixtures |
| Notepad | Tabs, rename, autosave, copy, delete | storage/component tests | reopen after edits and inspect persistence |
| i18n | Language changes all existing labels | translation coverage test | switch supported languages |
| Windowing | Drag, close, hide, reopen, standalone windows | Tauri smoke tests | operate all three windows |
| Accessibility | Focus order, labels, keyboard actions | DOM/RTL assertions | keyboard-only pass |

## Visual parity method

For each migrated page:

1. Render the legacy and React page at the same viewport, device scale, theme,
   stored state, and font-loading state.
2. Capture initial, focused, hovered, active, loading, empty, error, and result
   states.
3. Compare screenshots with an overlay or pixel-diff tool. Review every
   difference instead of accepting a broad similarity score.
4. Compare DOM landmarks and computed styles for the changed component.
5. Check text wrapping, scroll position, focus rings, icon baseline, and
   pointer/drag hit areas manually.
6. Record accepted differences explicitly. A difference is allowed only when
   it is required by React ownership or a browser/build constraint and does not
   change the product appearance or behavior.

Do not “fix” a visual mismatch by changing the reference page during the
migration. If the reference needs a product change, make that a separate
change, update the reference record, and restart the affected parity check.

## Testing strategy

### Before each page switch

Run:

```bash
corepack npm run build
corepack npm test
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

For a page switch, also run the page's visual and workflow suites at its
reference viewport. A failing parity check blocks the switch.

### Frontend tests

- Keep the current inline workflow tests until the corresponding legacy code is
  removed.
- Add unit tests for services and pure transformations.
- Add React Testing Library tests for state transitions, keyboard behavior,
  focus, loading, empty, error, and disabled states.
- Add deterministic IPC mocks that assert exact command names and payloads.
- Test event subscription cleanup and timer cleanup on unmount.
- Add visual regression snapshots for the agreed page states.

### Tauri tests

- Keep Rust unit tests and `cargo check` independent of React.
- Add a packaging smoke test that opens all three emitted pages from `dist/`.
- Verify the packaged app can load local JS/CSS assets without a network-only
  dependency. Google-hosted fonts/icons may remain only if retaining them is
  required for pixel parity; record that decision in the reference notes.
- Run shortcut, window, clipboard, encryption, and AI bridge smoke tests on
  the supported desktop platforms.

## Rollback and release controls

- Use a page-level feature flag or entry selection to choose legacy or React
  during migration. The fallback must not require a Rust rebuild.
- Keep legacy and React implementations on separate commits where possible.
- Never delete a legacy handler in the same commit that first introduces its
  React replacement.
- Preserve storage keys and migration paths until an explicit data migration
  release is planned and tested.
- If a regression appears, switch that page back to legacy, retain the failing
  fixture, and fix the React implementation before retrying.
- Do not hide a mismatch by changing screenshots, weakening assertions, or
  broadening selectors.

## Definition of complete migration

The migration is complete only when all of the following are true:

- Home, Notepad, and Clipboard are rendered by active React + TypeScript entry
  points.
- Existing design tokens, markup relationships, dimensions, icon treatment,
  states, transitions, labels, and text wrapping match the reference.
- All existing user workflows and storage behavior pass their parity tests.
- Tauri commands, events, window settings, shortcuts, clipboard, encryption,
  and AI integrations retain their existing contracts.
- No production behavior depends on inline event handlers or page-specific
  duplicate state logic.
- Local Tailwind/Vite assets load in development, packaged builds, and the
  Tauri app protocol.
- Rust source remains unchanged except for explicitly approved frontend build
  configuration changes.
- The legacy fallback has been exercised, then removed only after the agreed
  soak period and a verified rollback build.

## Immediate next steps

Phase 0 is complete for the frozen dark all-window baseline. Phase 2’s typed
contract, pure services, and compatibility adapter are complete. The remaining
states in `docs/frontend-reference/VISUAL_STATES.md` are captured as regression
cases immediately before the page or component that owns each state is
migrated.

1. Choose Notepad as the first visible React slice and add its fallback switch.
2. Port only the Notepad shell/header, run visual comparison, and stop if any
   spacing, icon, focus, or drag behavior differs.
3. Continue through Notepad, Clipboard, Home shell, and Home settings/AI in
   that order, using the exit gate after each slice.
