# Visual State Capture Matrix

This matrix lists the states that must be captured for pixel comparison. The
initial all-window dark capture was supplied during Phase 0 and is marked
`captured`; the remaining rows are regression captures for the relevant page
cutover. Do not mark a state passed from source inspection alone.

## Capture convention

Use this filename pattern:

```text
{implementation}-{page}-{state}-{theme}-{viewport}.png
```

Examples:

```text
legacy-home-menu-dark-340x470.png
react-notepad-editor-light-580x660.png
```

For each capture, keep the same device scale, font-loading state, local-storage
fixture, window position, and background where possible. Compare legacy and
React captures side by side and with an overlay.

## Shared shell states

| ID | State | Required checks | Status |
|---|---|---|---|
| S01 | dark, acrylic on, default blur/transparency | shell color, blur, frost, border, shadow | captured in `phase0-all-windows-dark.png` |
| S02 | light, acrylic on, default blur/transparency | light shell and text contrast | pending |
| S03 | acrylic off | no backdrop blur/frost, same layout | pending |
| S04 | blur 0 | no blur, same shell geometry | pending |
| S05 | blur 40 | maximum blur, no layout shift | pending |
| S06 | transparency 0 | shell opacity and readable content | pending |
| S07 | transparency 100 | shell opacity and readable content | pending |
| S08 | focused control | focus ring, caret, keyboard target | pending |
| S09 | hover/pressed control | hover/pressed color and transition | pending |
| S10 | toast visible | position, icon, text, dismissal animation | pending |

## Home states (340 × 470)

| ID | State | Required checks | Status |
|---|---|---|---|
| H01 | initial menu, no captured text | shell, prompt, Quick Actions, workspace, FAB | captured in `phase0-all-windows-dark.png` |
| H02 | captured text indicator | preview text, fallback action, wrapping | pending |
| H03 | custom prompt focused | placeholder, caret, input height | pending |
| H04 | settings Models tab | header, tabs, loading/provider cards | pending |
| H05 | settings General tab | shortcuts, theme, language, sliders | pending |
| H06 | settings Clipboard tab | capture, limit, open-only, actions | pending |
| H07 | provider menu open | menu position, grouping, clipping, focus | pending |
| H08 | provider card editing | inputs, save/cancel, masking, errors | pending |
| H09 | text loading | gradient spinner, copy, vertical spacing | pending |
| H10 | text result | result wrapping and Accept/Reject/Copy actions | pending |
| H11 | image prompt | title, hint, textarea, Generate action | pending |
| H12 | image loading | spinner and loading copy | pending |
| H13 | image result | image bounds, action grid, save/regenerate | pending |
| H14 | error/confirmation | modal/toast surface, buttons, focus | pending |

## Notepad states (580 × 660)

| ID | State | Required checks | Status |
|---|---|---|---|
| N01 | empty state | header, empty illustration, prompt/action | pending |
| N02 | one note editor | tab, title, body, date, save indicator | captured in `phase0-all-windows-dark.png` |
| N03 | multiple tabs | active/inactive tabs, order, truncation | pending |
| N04 | tab rename | input geometry, commit/cancel behavior | pending |
| N05 | image attachment | image bounds and editor overflow | pending |
| N06 | copy/delete toast | toast position, icon, timing | pending |
| N07 | minimum viewport | overflow, scrolling, drag region | pending |

## Clipboard states (420 × 600)

| ID | State | Required checks | Status |
|---|---|---|---|
| C01 | empty history | title, toggle, search, empty state, footer | pending |
| C02 | populated text history | timeline rail, groups, metadata, actions | captured in `phase0-all-windows-dark.png` |
| C03 | pinned item | pin color, order, selected state | pending |
| C04 | search results | input, matching rows, count | pending |
| C05 | no search matches | empty result message and layout | pending |
| C06 | Pinned filter | active toggle and empty/populated states | pending |
| C07 | image item | image bounds, metadata, copy action | pending |
| C08 | toast visible | position, contrast, dismissal | pending |
| C09 | minimum viewport | overflow, scrollbar, action hit areas | pending |

## Reference token checks

Each visual review must explicitly check these values against the current
reference:

- Inter and the existing system fallback stack;
- primary blue `#007AFF`;
- light background `#F2F2F7` and dark background `#000000`;
- light glass `rgba(255,255,255,0.7)` and dark glass
  `rgba(28,28,30,0.8)`;
- pink-to-violet AI gradient;
- amber Notepad/pin, sky Clipboard, pink Image, and violet Diagram accents;
- existing rounded radii, border alpha, shadow, backdrop blur, and scrollbar;
- Material Icons Outlined name, size, stroke appearance, and baseline.

Any intentional token change must be recorded as a product/design change
separate from the React migration.
