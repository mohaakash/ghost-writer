# Phase 4 Status — Notepad React Slice

The React Notepad page is implemented behind the opt-in storage flag
`ghost_writer_react_notepad_v1`. It mirrors the current Notepad markup classes
and preserves the current note keys, Welcome note, legacy-key migration, tab
selection/rename/delete behavior, debounced autosave, saved indicator,
clipboard copy, toast messages, appearance events, drag filtering, and close
command.

The default remains the legacy Notepad page. To preview the React slice during
manual parity testing, set this flag in the Notepad window’s local storage and
reload that window:

```js
localStorage.setItem("ghost_writer_react_notepad_v1", "true");
location.reload();
```

Remove the flag to restore the legacy owner:

```js
localStorage.removeItem("ghost_writer_react_notepad_v1");
location.reload();
```

The visual and workflow cutover gate is still pending manual comparison at
580 × 660 and the documented minimum size. Until that review passes, the
legacy DOM remains the safe default and rollback path.
