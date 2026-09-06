# Frontend Reference Baseline

This directory is the Phase 0 record for the one-to-one React migration. The
current HTML pages remain the golden implementation until each page passes the
parity gates in [`../FRONTEND_MIGRATION_PLAN.md`](../FRONTEND_MIGRATION_PLAN.md).

## Files

- [`BASELINE.md`](BASELINE.md) — frozen source/build state, dimensions, visual
  references, and validation results.
- [`DOM_AND_BEHAVIOR_CONTRACT.md`](DOM_AND_BEHAVIOR_CONTRACT.md) — stable page
  IDs, handlers, storage keys, Tauri commands, and events that React must
  preserve.
- [`WORKFLOWS.md`](WORKFLOWS.md) — repeatable manual workflows and expected
  outcomes for the three windows.
- [`VISUAL_STATES.md`](VISUAL_STATES.md) — screenshot states and token checks
  required for one-to-one visual comparison.
- [`../PHASE_2_STATUS.md`](../PHASE_2_STATUS.md) — typed contract and pure
  service extraction status before any visible React cutover.

The original composite reference image is
[`screenshots/screenshot.png`](../../screenshots/screenshot.png). The Phase 0
live capture supplied for the current build is
[`screenshots/phase0-all-windows-dark.png`](screenshots/phase0-all-windows-dark.png).
It shows Home, Notepad, and Clipboard together in the dark glass state.
