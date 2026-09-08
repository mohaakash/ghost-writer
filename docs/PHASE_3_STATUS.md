# Phase 3 Status — Shared Visual Primitives and React Shell

The shared shell foundation is in place. The visible product windows still use
their existing HTML owners, so this phase has no user-facing design or behavior
change.

Added in `src/components/primitives.tsx`:

- `GlassWindow` and `DragRegion` preserve the existing glass and Tauri drag
  attributes.
- `WindowHeader` preserves the 44px header, border, spacing, and no-drag action
  area used by the reference windows.
- `IconButton` and `PrimaryButton` preserve the existing button classes.
- `SegmentedControl`, `Toast`, `LoadingState`, and `BottomSheet` use the
  existing reference class names and state conventions.

`src/main.tsx` now mounts the shared React shell into the isolated
`#react-runtime` root. The root and probe are hidden until a visual parity gate
enables a page-specific React owner. This keeps the legacy markup available as
the immediate rollback path.

Validation:

```text
corepack npm test
corepack npm run build
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

The next slice is Phase 4: port the Notepad shell and behavior behind its
fallback flag, then compare it at the documented 580 × 660 viewport before
allowing any visible cutover.
