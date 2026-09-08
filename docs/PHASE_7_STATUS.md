# Phase 7 Status — Home Models Settings Slice

The Home Preferences Models tab is implemented behind the opt-in storage flags
`ghost_writer_react_home_v1` and `ghost_writer_react_home_models_v1`.

This slice preserves the legacy provider catalog, model and image-model
selectors, encrypted settings storage, legacy encrypted-settings migration,
provider add/remove flows, cloud API keys, local endpoint configuration, custom
OpenAI-compatible endpoints, endpoint testing, masked keys, and the existing
settings classes and Material icon treatment.

To preview it in the Home window, enable both flags and reload:

```js
localStorage.setItem("ghost_writer_react_home_v1", "true");
localStorage.setItem("ghost_writer_react_home_models_v1", "true");
location.reload();
```

The General and Clipboard tabs, plus AI and image result flows, still return to
the legacy Home owner. Remove both flags to restore the legacy implementation:

```js
localStorage.removeItem("ghost_writer_react_home_v1");
localStorage.removeItem("ghost_writer_react_home_models_v1");
location.reload();
```

Manual visual and workflow comparison at 340 × 470 and the configured minimum
size is still required before changing the default owner.
