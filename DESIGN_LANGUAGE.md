# Ghost Writer — Design Language

Extracted from the **home** section (`src/index.html`) and the **clipboard** section (`src/clipboard.html`).

---

## 1. Guiding Principles

- **iOS-inspired floating glass UI** rendered inside frameless, transparent Tauri windows.
- **Dark-first**, with a light-mode variant on the home screen. The clipboard window is **dark-only**.
- **Compact, dense, utility-first** styling via Tailwind utility classes (no component library).
- **Amber** is used sparingly as the "brand" accent; **sky-blue** marks the clipboard feature, **blue (#007AFF)** is the primary action color; **pink → violet** gradients mark AI/image features.

---

## 2. Colors

### 2.1 Semantic palette (Home)

| Token | Light | Dark |
|---|---|---|
| `primary` | `#007AFF` | `#007AFF` |
| `background-light` | `#F2F2F7` | — |
| `background-dark` | — | `#000000` |
| `glass-light` | `rgba(255,255,255,0.7)` | — |
| `glass-dark` | — | `rgba(28,28,30,0.8)` |

### 2.2 Clipboard CSS variables (dark-only)

| Token | Value |
|---|---|
| `--bg` | `#000000` |
| `--panel` | `rgba(28, 28, 30, 0.8)` |
| `--panel-raised` | `rgba(255, 255, 255, 0.08)` |
| `--border` | `rgba(255, 255, 255, 0.1)` |
| `--primary` | `#007aff` |
| `--primary-dim` | `rgba(0, 122, 255, 0.14)` |
| `--text` | `#f4f4f5` |
| `--muted` | `#a1a1aa` |
| `--dim` | `#71717a` |
| `--faint` | `#52525b` |
| `--amber` | `#fbbf24` (pin / brand accent) |
| `--red` | `#f87171` (destructive) |

### 2.3 Text layers (both)
`#f4f4f5` (primary) → `#a1a1aa` (muted) → `#71717a` (dim) → `#52525b` (faint). In Tailwind terms the home screen uses the standard **zinc** scale (`zinc-950` … `zinc-400/500/600`).

### 2.4 Gradient accents

**AI gradient** — applied to icons via `background-clip: text`:

```
linear-gradient(135deg, #7dd3fc, #c084fc, #f472b6)   /* sky → violet → pink */
```

- `.ai-gradient-icon` (home) / `.title-icon` (clipboard): `background: linear-gradient(...); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;`
- Image-loading spinner variant: `linear-gradient(135deg, #f472b6, #a78bfa)`.

**CTA gradient** (solid button fill):

```
bg-gradient-to-r from-pink-500 to-violet-500
```

### 2.5 Feature accent colors (home quick actions)

| Feature | Icon color |
|---|---|
| Generate Image | `text-pink-400` |
| Generate Diagram | `text-violet-400` |
| Notepad | `text-amber-400` |
| Clipboard | `text-sky-400` |

---

## 3. Typography

- **Font family:** `Inter` (300–700 weights), fallback stack `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif`. Defined in Tailwind `fontFamily.display`.
- **Smoothing:** `-webkit-font-smoothing: antialiased`.
- **Scale:** explicit utility sizes dominate — `[10px]`, `[11px]`, `[12px]`, `[13px]`, `[14px]`, `[15px]`, plus `text-sm`, `text-xl`, `text-4xl/5xl` for emphasis.
- **Section labels:** tiny, uppercase, bold, letter-spaced —
  `text-[10px] font-bold uppercase tracking-widest text-zinc-500` (e.g. "Quick Actions", "Proposed Change").
- **Settings section headers:** `text-[11px] font-bold uppercase tracking-wider`.
- **Window/panel titles:** `14px`, weight ~650, slight letter-spacing (`letter-spacing: 0.02em`).

---

## 4. Surfaces & Layers

### 4.1 Glass shell
```css
glass-effect {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```
Combo seen on the main window / clipboard / notepad:
`glass-effect bg-glass-dark/95 border border-white/10 ios-shadow overflow-hidden`

- `ios-shadow`: `box-shadow: 0 4px 30px rgba(0,0,0,0.1)`
- Main window: `bg-glass-light/95 dark:bg-glass-dark/95 border-white/20 dark:border-white/10`
- Clipboard shell: flat CSS `--panel` bg + `border 1px var(--border)` + same blur/shadow.

### 4.2 Inner panels / result cards
- `bg-white/40 dark:bg-zinc-800/40 border border-white/20 dark:border-zinc-700/30 rounded-xl|rounded-2xl`
- Result text: additionally `shadow-inner`, `text-[14px]`, `whitespace-pre-wrap`.

### 4.3 Overlays & bottom sheet
- **Overlay:** `bg-black/30 dark:bg-black/60 backdrop-blur-[2px]`, click-outside closes.
- **Bottom sheet:** slides `translateY(100%) → 0` over `0.4s cubic-bezier(0.32, 0.72, 0, 1)`, top corners `32px`; inner panel `rounded-[22px] shadow-2xl`.

---

## 5. Components

### 5.1 Buttons

| Style | Classes / look |
|---|---|
| **Primary pill** | `bg-primary text-white rounded-xl font-bold uppercase tracking-wide text-[10px]` hover `bg-primary/90` |
| **Gradient CTA** | `bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-xl font-bold shadow-lg shadow-pink-500/20` |
| **Ghost/translucent action** | `bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/10 rounded-xl font-bold text-sm` (Reject = red, Accept = green, copy = `bg-primary/10 text-primary`) |
| **Text link** | `text-xs text-primary` |
| **Close (bare)** | `text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300` |
| **Icon button (clipboard)** | `30×30`, `border-radius: 8px`, hover `color → text` + `bg var(--panel-raised)`; `.danger:hover` → `#f87171` on `rgba(248,113,113,0.12)` |
| **Pill segmented item** | `text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase font-bold` (status badge) |

### 5.2 Menu action rows (home)
- `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all`
- Icon `material-icons-outlined text-[20px]` + label `text-[15px] text-zinc-800 dark:text-zinc-200 font-medium`.

### 5.3 Tabs / segmented control (clipboard & settings)
- Container: `flex rounded-xl bg-black/5 dark:bg-white/5 p-1` (clipboard: `border 1px rgba(255,255,255,0.08) rounded 12px bg rgba(255,255,255,0.05)`).
- **Active:** `bg-white/80 dark:bg-zinc-800 text-primary shadow-sm` rounded-lg, `text-[10px] uppercase bold tracking-wide`.
- **Inactive:** `text-zinc-500` muted, hover to lighter.

### 5.4 Inputs
- **Inline input:** `bg-transparent border-none focus:ring-0 p-0`, placeholder `placeholder-zinc-500 / placeholder-zinc-600`.
- **Textarea / field (image prompt):** `bg-white/40 dark:bg-zinc-800/40 border border-white/20 dark:border-zinc-700/30 rounded-2xl px-4 py-3`, focus `focus:border-primary/30`.
- **Search (clipboard):** height `34px`, `border-radius: 10px`, `border rgba(63,63,70,0.3)`, `background rgba(39,39,42,0.4)`, focus `rgba(0,122,255,0.58)`, text `12px`.

### 5.5 Settings rows
- `bg-black/5 dark:bg-white/5 border border-transparent hover:border-primary/20 rounded-xl px-4 py-3 text-sm`
- Icon 20px (mutes to `text-primary` on group hover) + label `font-medium` + trailing value pill.

### 5.6 Clipboard timeline items
- Item: transparent button, `padding: 9px`, text `12px`, `line-height 1.45`, `white-space: pre-wrap`, max `4` clamped lines; hover → pure white text.
- Timeline: left rail `1px rgba(255,255,255,0.12)`, 8px dots (`border rgba(161,161,170,0.65)`).
- **Selected:** dot turns pink `#f472b6` with glow `0 0 0 4px rgba(244,114,182,0.12), 0 0 12px rgba(244,114,182,0.45)`.
- Meta line: `10px` faint with `·` separators.
- Item actions: `26×26` icon buttons; pin active = `--amber`.

### 5.7 Toast / notifications
- Position: `fixed bottom-4 left-4 right-4 z-[9999]` (home/notepad) or fixed bottom-right (clipboard).
- Surface: `glass-effect bg-black/80 dark:bg-zinc-900/90 rounded-2xl border border-white/10 shadow-2xl` (clipboard: `rgba(0,0,0,0.8)`, `9px` radius).
- Icon color-coded state — `text-red-400` error, `text-green-400` success, `text-blue-400` info, `text-amber-400` neutral/confirm.
- Animation: slide-in `translateY(100%) → 0` 0.3s ease-out; fade-out 0.3s; auto-dismiss ~1.8–2s. Clipboard uses 160ms opacity/translateY crossfade.

### 5.8 Loading states
- Centered column: spinning gradient icon (`material-icons-outlined ai-gradient-icon text-5xl animate-spin`) + caption `text-sm font-medium text-zinc-500`.
- Home adds `animate-pulse` and "Synthesizing with AI…" copy.

### 5.9 Window furniture
- **Drag region:** top strip `h-1 w-full data-tauri-drag-region` (home) / 4px strip + header (clipboard); controls use `-webkit-app-region: no-drag`.
- **Settings FAB (home):** `absolute bottom-3 right-3 h-9 w-9 rounded-full border border-white/30 bg-white/60 dark:bg-zinc-800/80 backdrop-blur-md shadow-lg`, hover `scale-105`.

---

## 6. Motion & Transitions

- **View switching:** `.view-container { transition: all .3s cubic-bezier(0.4,0,0.2,1) }`; incoming `animate-in fade-in slide-in-from-right-4 duration-300`.
- **Bottom sheet:** `0.4s cubic-bezier(0.32, 0.72, 0, 1)` slide-up.
- **Hover:** generic `transition-all`; color/bg fades ~140–300ms.
- **Image result:** fade-in only.

---

## 7. Icons

- **Material Icons Outlined** loaded from Google Fonts.
- Default action volume: `18–20px` (superscript: 20px rows, 18px buttons, 19px FAB).
- Gradient text version used for AI/magic (`auto_awesome`) and feature titles.

---

## 8. Scrollbars (all windows)

```css
::-webkit-scrollbar { width: 4px }                 /* clipboard: 6px */
::-webkit-scrollbar-track { background: transparent }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 10px }  /* clipboard: 999px */
::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.5) }
```

---

## 9. Implementation constants

- Tailwind via CDN with `forms` + `typography` plugins; `darkMode: "class"`.
- Colors/fonts wired through `tailwind.config` under `extend` (`primary`, `background-light/dark`, `glass-light/dark`, `fontFamily.display`, `borderRadius.DEFAULT=12px`, `borderRadius.ios=20px`).
- i18n: all user-facing strings carry `data-i18n` attributes.