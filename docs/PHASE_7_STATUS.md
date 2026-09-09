# Phase 7 Status — Home Settings Slices

The Home Preferences Models, General, and Clipboard tabs are implemented behind the
opt-in storage flags `ghost_writer_react_home_v1`,
`ghost_writer_react_home_models_v1`, `ghost_writer_react_home_general_v1`, and
`ghost_writer_react_home_clipboard_v1`.

This slice preserves the legacy provider catalog, model and image-model
selectors, encrypted settings storage, legacy encrypted-settings migration,
provider add/remove flows, cloud API keys, local endpoint configuration, custom
OpenAI-compatible endpoints, endpoint testing, masked keys, and the existing
settings classes and Material icon treatment.

The General slice preserves the global shortcut recorder, native shortcut
registration, theme switching, language selection, acrylic blur, blur amount,
transparency controls, appearance storage, appearance events, and the existing
settings classes and Material icon treatment. Language changes hand off to the
legacy owner so the complete translation catalogue updates atomically.

The Clipboard slice preserves automatic capture, the history limit, pinned-item
retention when trimming, open-only Clipboard, the Clipboard shortcut recorder,
capture-now, clear-history, item counts, local storage, native clipboard
commands, and the existing settings classes and Material icon treatment.

To preview all three settings slices in the Home window, enable the flags and reload:

```js
localStorage.setItem("ghost_writer_react_home_v1", "true");
localStorage.setItem("ghost_writer_react_home_models_v1", "true");
localStorage.setItem("ghost_writer_react_home_general_v1", "true");
localStorage.setItem("ghost_writer_react_home_clipboard_v1", "true");
location.reload();
```

AI and image result flows still return to the legacy Home owner. Remove the
flags to restore the legacy implementation:

```js
localStorage.removeItem("ghost_writer_react_home_v1");
localStorage.removeItem("ghost_writer_react_home_models_v1");
localStorage.removeItem("ghost_writer_react_home_general_v1");
localStorage.removeItem("ghost_writer_react_home_clipboard_v1");
location.reload();
```

Manual visual and workflow comparison at 340 × 470 and the configured minimum
size is still required before changing the default owner.
