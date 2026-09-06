# Phase 2 Status — Typed Contracts and Pure Services

Phase 2 is complete for the typed contract, pure-service, and compatibility
adapter work. The active product pages remain the original HTML and
JavaScript, so this work does not change the rendered design or user behavior.

The typed foundation now includes:

- `src/lib/contracts.ts` for storage keys, native command/event names, payloads,
  shortcut values, generated images, and toast state.
- `src/lib/appearance-domain.ts` and `src/lib/appearance.ts` for the existing
  appearance defaults, normalization, persistence, CSS variables, and event
  bridge.
- `src/lib/clipboard-domain.ts` and `src/lib/storage.ts` for clipboard item
  normalization, image detection, sorting, duplicate updates, and pinned-item
  trimming.
- `src/lib/ai-domain.ts` for the encrypted settings keys, provider defaults,
  image model validation, custom endpoint migration, provider key rules, and
  API-key masking.
- `src/lib/presentation-domain.ts` for generated-image data URLs, clipboard
  time/length labels, history grouping, and translation fallback behavior.
- `src/lib/tauri-commands.ts` and `src/lib/tauri-events.ts` for typed native
  boundaries that preserve the current command names and payload shapes.
- `src/lib/legacy-adapter.ts` plus guarded calls in the current pages, allowing
  each inline helper to use the typed service while its fallback remains
  available for rollback.

Validation completed:

```text
corepack npm test
corepack npm run build
cargo check --manifest-path src-tauri/Cargo.toml
git diff --check
```

Additional inline helpers can adopt the same adapter during later React slices,
while the legacy pages remain the visual and workflow oracle. No React page
cutover is part of this phase.
