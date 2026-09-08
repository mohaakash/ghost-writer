# Phase 5 Status — Clipboard React Slice

The React Clipboard page is implemented behind the opt-in storage flag
`ghost_writer_react_clipboard_v1`. It keeps the legacy Clipboard DOM classes,
timeline structure, Material icon treatment, storage keys, pinned-first history
normalization, search and view filters, image previews, copy/pin/delete actions,
toast messages, appearance events, clipboard commands, visibility refresh, and
window close command.

The legacy Clipboard page remains the default. To preview the React slice during
manual parity testing, set this flag in the Clipboard window's local storage and
reload that window:

```js
localStorage.setItem("ghost_writer_react_clipboard_v1", "true");
location.reload();
```

Remove the flag to restore the legacy owner:

```js
localStorage.removeItem("ghost_writer_react_clipboard_v1");
location.reload();
```

The visual and workflow cutover gate is still pending manual comparison at
420 × 600 and the configured minimum size. Until that review passes, the
legacy DOM remains the safe default and rollback path.
