# Phase 6 Status — Home React Shell and Menu

The Home shell and menu are implemented behind the opt-in storage flag
`ghost_writer_react_home_v1`. The React slice preserves the reference shell
dimensions and glass classes, captured-text indicator, prompt input, quick
action labels and prompts, image and diagram actions, Notepad and Clipboard
window actions, Preferences entry, Material icons, drag filtering, and the
existing native command boundaries.

Advanced AI/image actions and Preferences hand back to the legacy Home owner
for now. This keeps the existing settings, provider, result, loading, and
image workflows available while Phase 7 ports those surfaces.

The legacy Home page remains the default. To preview the React shell and menu,
set this flag in the Home window's local storage and reload that window:

```js
localStorage.setItem("ghost_writer_react_home_v1", "true");
location.reload();
```

The React shell removes the flag and restores the legacy page when Preferences
or an advanced AI/image action is selected. Remove the flag manually to restore
the legacy owner on the next reload:

```js
localStorage.removeItem("ghost_writer_react_home_v1");
location.reload();
```

The visual and workflow cutover gate is still pending manual comparison at
340 × 470 and the configured minimum size. Until that review passes, the
legacy DOM remains the safe default and rollback path.
