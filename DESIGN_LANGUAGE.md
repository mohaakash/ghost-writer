# Ghost Writer — Design Language

The frontend migration preserves the existing Ghost Writer visual system. The
window markup, class names, inline behavior, and interaction copy remain the
source of truth; React, TypeScript, Vite, and local Tailwind CSS provide the
build pipeline around that UI.

## Visual direction

- iOS-inspired floating glass UI inside frameless, transparent Tauri windows.
- Dark-first home screen with the existing light-mode variant; the Clipboard
  window remains dark-only.
- Compact, dense utility layout with rounded controls, translucent panels, and
  the existing blur and shadow treatment.
- Amber marks the brand and pinned items, sky blue marks Clipboard, blue
  (`#007AFF`) is the primary action color, and pink-to-violet gradients mark AI
  and image features.

## Tokens

| Token | Value |
|---|---|
| `primary` | `#007AFF` |
| `background-light` | `#F2F2F7` |
| `background-dark` | `#000000` |
| `glass-light` | `rgba(255,255,255,0.7)` |
| `glass-dark` | `rgba(28,28,30,0.8)` |
| `fontFamily.display` | Inter with the existing system fallbacks |
| `borderRadius.DEFAULT` | `12px` |
| `borderRadius.ios` | `20px` |

The Clipboard page keeps its existing CSS variables (`--panel`, `--border`,
`--text`, `--muted`, `--amber`, and `--red`). The shared `appearance.js` module
continues to control theme, acrylic blur, blur amount, and transparency across
all windows through the same local-storage key and Tauri event.

## Components and behavior

- Glass shells use the existing `glass-effect`, backdrop blur, translucent
  borders, and iOS shadow classes.
- Home action rows, settings tabs, bottom sheets, toasts, loading states, and
  the settings FAB retain their original spacing, motion, colors, and labels.
- Clipboard timeline items retain the left rail, selected pink dot, pin state,
  search/filter behavior, and pin-before-eviction rule.
- Notepad keeps its tabbed layout, autosave behavior, and shared appearance
  settings.
- Material Icons Outlined remain loaded by the compatibility pages so the
  existing pixels and icon metrics do not change. Lucide is installed for new
  typed React primitives as the migration continues.

## Frontend pipeline

```text
src/index.html      ─┐
src/notepad.html     ├─ Vite multi-page build → dist/
src/clipboard.html  ─┘
        │
        └─ src/main.tsx (hidden React runtime + shared appearance/styles)
```

Tailwind is compiled locally through PostCSS; the pages no longer depend on a
runtime Tailwind CDN. `src/App.tsx`, `src/notepad.tsx`, and `src/clipboard.tsx`
provide typed React entry points for incremental migration without replacing
the existing production DOM. Radix/shadcn primitives are not required yet
because the current controls are already native and behaviorally complete.

Tauri continues to package `dist/` and all Rust commands, windows, shortcuts,
storage, encryption, and AI integrations remain unchanged.
