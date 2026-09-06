# Phase 0 Reference Workflows

Run these workflows against the legacy pages before each page cutover and
against React after each cutover. Record the result, screenshot name, browser
console errors, Tauri calls, and storage changes in the phase notes.

Use sanitized fixtures. Never commit API keys, private clipboard content, or
personal notes.

## Fixture setup

Start each page with a known local-storage fixture:

```text
appearance: { theme: "dark", acrylic: true, blurAmount: 20, transparency: 95 }
clipboard settings: { autoCapture: true, maxItems: 200 }
history: empty unless the workflow says otherwise
notes: empty unless the workflow says otherwise
AI providers: no real keys; use deterministic IPC mocks for tests
```

For visual captures, use the Tauri window dimensions recorded in
[`BASELINE.md`](BASELINE.md). Wait for fonts and the appearance module before
capturing.

## Home workflows

### H01 — Initial menu

1. Open Home with empty history and no captured text.
2. Capture the 340 × 470 dark initial state.
3. Verify the glass shell, drag strip, copied-text fallback, prompt field,
   Quick Actions rows, workspace rows, settings FAB, scrollbar, and toast
   layer match the reference.
4. Repeat in the supported light state.

Expected: no content is clipped unexpectedly, no loading state appears, and
all labels/icons are present with the same wrapping and spacing.

### H02 — Captured text and prompt

1. Trigger the global selection shortcut with sanitized text.
2. Verify the captured indicator and preview update.
3. Type a custom prompt and reload the window.
4. Verify the prompt, source text, and view state follow the current behavior.

Expected: captured text is shown exactly as before; manual copied text does not
replace a newer native selection unexpectedly.

### H03 — Quick actions and text results

For each of Improve writing, Fix grammar, Summarize text, and Rewrite for
clarity:

1. Use a deterministic `process_text` response.
2. Capture loading, result, and error states.
3. For rewrite actions, verify Accept replaces the source only after explicit
   acceptance and Reject closes the result without replacing it.
4. For summaries, verify Copy to Clipboard works and no paste occurs.

Expected: prompts, loading copy, result text, action visibility, transitions,
and source replacement semantics match.

### H04 — Image and diagram generation

1. Open Image and Diagram from the workspace.
2. Capture the prompt, loading, result, empty-source, and error states.
3. Use a deterministic generated image fixture.
4. Verify copy image, download, save to Notepad, and generate-again behavior.

Expected: image dimensions, preview placement, gradient loading icon, button
layout, and image attachment behavior match; generation never pastes text over
the source.

### H05 — Settings and appearance

1. Open Preferences and capture Models, General, and Clipboard tabs.
2. Record focus order and keyboard activation for tabs and controls.
3. Toggle theme, acrylic, blur amount, transparency, and language.
4. Open Clipboard and Notepad while the settings are changed.

Expected: settings labels, provider cards, selectors, sliders, and controls
match; appearance changes synchronize across all open windows.

### H06 — Provider and shortcut settings

1. Add a deterministic cloud provider fixture and a local/custom endpoint.
2. Edit model and image model selections.
3. Save, replace, test, and remove provider credentials using IPC mocks.
4. Record shortcut values, edit both shortcut recorders, and save them.

Expected: the same encrypted command names/payloads, validation, masking,
errors, selectors, and persisted settings are produced.

## Notepad workflows

### N01 — Empty state and first note

1. Open Notepad with no notes.
2. Capture the 580 × 660 empty state.
3. Create a note and verify the active tab, title field, editor, and count.

Expected: empty state, tab geometry, editor spacing, and focus match.

### N02 — Edit and autosave

1. Set a title and body using sanitized text.
2. Wait for the saved indicator and updated date.
3. Close and reopen Notepad.

Expected: title, body, active note, date, and saved state persist exactly.

### N03 — Tabs and rename

1. Create at least three notes.
2. Select each tab, rename one, and switch away and back.
3. Capture long titles and narrow minimum-size behavior.

Expected: order, truncation, close affordances, selection, and rename behavior
match without losing content.

### N04 — Copy, image, delete, and close

1. Copy a note and verify `write_to_clipboard` receives the body.
2. Open a note with an image attachment and inspect sizing.
3. Delete a note, then delete the final note.
4. Drag the window and close it from the native control.

Expected: image, toast, deletion, final-note empty behavior, drag region, and
close behavior match.

## Clipboard workflows

### C01 — Empty history

1. Open Clipboard with an empty history.
2. Capture the 420 × 600 dark state and supported light state.
3. Verify title, All/Pinned controls, search, empty message, and footer.

Expected: the timeline rail, empty state, controls, and counts match.

### C02 — Add, deduplicate, search, and group

1. Seed text items with known timestamps and repeated content.
2. Capture the rendered timeline and groups.
3. Search by a distinctive substring and switch the view filter.

Expected: repeated text is not duplicated; matching, grouping, counts, and
empty search state match.

### C03 — Pin and retention

1. Seed more items than the configured history limit.
2. Pin an older item and trigger trimming.
3. Unpin it and trim again.

Expected: pinned items remain, the oldest removable unpinned item is evicted,
and pinned-first ordering is stable.

### C04 — Copy, image, delete, clear, and refresh

1. Copy a text item and an image item.
2. Delete one item and clear all history.
3. Send refresh, clear, and settings `clipboard-command` events.
4. Hide and show the window to exercise visibility refresh.

Expected: exact native calls, toasts, counts, image behavior, event handling,
and cleanup match without duplicate listeners or polling timers.

## Cross-window workflows

### X01 — Appearance synchronization

1. Open Home, Notepad, and Clipboard.
2. Change theme, acrylic, blur, and transparency in Home.
3. Inspect all three windows while visible and after hide/show.

Expected: all shells update with the same timing and CSS variables.

### X02 — Clipboard and Notepad from Home

1. Open Clipboard and Notepad through Home workspace actions.
2. Capture text in Home, copy it to Clipboard, and save a result to Notepad.
3. Close and reopen each secondary window.

Expected: windows open through the same Tauri commands, local data is retained,
and Home visibility/close behavior is unchanged.

### X03 — Native shortcut lifecycle

1. Start the packaged application.
2. Trigger the capture shortcut from another application.
3. Trigger the Clipboard shortcut.
4. Edit both shortcuts in Preferences and repeat.

Expected: the same window is shown or hidden, captured text is delivered, and
shortcut changes persist across restart.

## Pass/fail record

For each workflow, record:

```text
Date/time:
Implementation: legacy | React
Viewport:
Theme/appearance:
Fixture:
Result: pass | fail | blocked
Screenshot(s):
Tauri calls/events:
Storage before/after:
Console errors:
Notes:
```

A page cannot switch to React while any workflow is failed or blocked without
an explicit documented decision and a working legacy fallback.
