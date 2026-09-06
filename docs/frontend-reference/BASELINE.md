# Phase 0 Baseline

## Baseline identity

This record was created from the current working tree before any visible page
is migrated to React.

| Field | Value |
|---|---|
| Repository HEAD | `e765a91f614c62b3169726292d4d3b43c9f69695` |
| Reference UI | `src/index.html`, `src/notepad.html`, `src/clipboard.html` |
| Vite root | `src/` |
| Build output | `dist/` |
| Tauri frontend distribution | `../dist` |
| React production ownership | Not switched yet; legacy pages remain active |
| Rust source status | Unchanged by the frontend migration |
| Existing screenshot | `screenshots/screenshot.png` (1881 × 872 composite) |
| Phase 0 live capture | `screenshots/phase0-all-windows-dark.png` (1881 × 872 RGB PNG) |

The working tree contains the Phase 1 toolchain changes. The HEAD value above
is recorded so a future commit or branch can identify exactly which source
state this baseline belongs to. The hashes below identify the actual files at
the time of this record and should be refreshed only when the reference UI is
intentionally changed.

## Reference viewport sizes

These are the configured Tauri window sizes and are the required visual test
viewports:

| Window | Size | Source/configuration |
|---|---:|---|
| Home | 340 × 470 | `src-tauri/tauri.conf.json` main window |
| Notepad | 580 × 660 | `src-tauri/tauri.conf.json` notepad window |
| Clipboard | 420 × 600 | `src-tauri/tauri.conf.json` clipboard window |

Also test the configured minimum sizes: Home 340 × 100, Notepad 360 × 400,
and Clipboard 340 × 420. Capture dark and light states wherever the current
page supports them, plus empty, populated, focused, loading, result, and error
states.

## Source measurements

| File | Lines | Bytes | SHA-256 |
|---|---:|---:|---|
| `src/index.html` | 3015 | 146312 | `79f8d53d3c76078b7bc278d044991a0a435aceb1d6e3af67dea0f2ca13b1f070` |
| `src/notepad.html` | 485 | 16989 | `2be3527d5fe0fe9559b4203cfe47d98ee1068dfbebafe75255c23a5d16a370d8` |
| `src/clipboard.html` | 821 | 28239 | `5d7f273c3f23e49e0d8e38417526816416553d9faaf55bccb474c90c7fe7fecc` |
| `src/appearance.js` | 180 | 6490 | `fea303f919b72cfe430de3bd47199278d75caa65c66defb9035a9f59eba06278` |
| `src/styles.css` | 15 | 481 | `30b00c378be840843c1db9ee26effdb509adaca8ff6fc52dc7029ad8464866c9` |

Regenerate the measurements with:

```bash
sha256sum src/index.html src/notepad.html src/clipboard.html \
  src/appearance.js src/styles.css
wc -l -c src/index.html src/notepad.html src/clipboard.html \
  src/appearance.js src/styles.css
```

## Visual reference

The current visual direction is the iOS-inspired glass interface documented in
[`DESIGN_LANGUAGE.md`](../../DESIGN_LANGUAGE.md): Inter typography, blue
`#007AFF` primary actions, translucent light/dark glass panels, rounded iOS
surfaces, pink-to-violet AI accents, amber Notepad/pin accents, sky Clipboard
accents, and Material Icons Outlined.

The Phase 0 live capture shows the current Home, Notepad, and Clipboard windows
over the desktop background in their dark glass state. It is stored at
[`screenshots/phase0-all-windows-dark.png`](screenshots/phase0-all-windows-dark.png)
and has SHA-256
`9e7fec8b9d39696cdf4c747fb2cf9ba40a813e827cca5074dad686dc72233b4c`.

This completes the initial visual freeze for all three windows. The remaining
states in [`VISUAL_STATES.md`](VISUAL_STATES.md) are regression cases to
capture before the corresponding React cutover (focused, loading, error,
light-theme, and minimum-size states); they do not replace this frozen dark
baseline.

For every capture, record:

- viewport size and device scale;
- theme and appearance settings;
- font-loading state;
- local-storage fixture name;
- page state and user action that produced it;
- whether the capture is legacy or React;
- screenshot filename and review status.

## Phase 0 status: complete

The source, behavior, workflow, and initial all-window visual references are
recorded. React migration work may begin with the Notepad shell, provided the
legacy fallback remains available and the parity gates in the migration plan
are followed.

## Phase 0 validation completed

The following commands pass for this baseline:

```text
corepack npm run build
corepack npm test
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
corepack npm run tauri:build -- --ci
```

The release build emits `dist/index.html`, `dist/notepad.html`,
`dist/clipboard.html`, and shared Vite assets. The appearance module is present
in the generated JavaScript bundle, so packaged windows do not depend on an
unbundled `appearance.js` URL.

## Baseline rules

- Do not edit the reference pages merely to make React conversion easier.
- Do not update a screenshot to hide a React mismatch.
- Do not remove an inline handler, storage key, command, or event until its
  React replacement has a passing parity test and a verified fallback.
- If the product intentionally changes, update the reference record in a
  separate change before continuing migration work.
