# DOM and Behavior Contract

This is the contract the React implementation must preserve. IDs and function
names are listed because current tests, inline handlers, Tauri events, and
cross-window behavior depend on them. React may replace the implementation,
but it must preserve the user-visible behavior and the native payloads.

## Shared contract

### Appearance

- Source: `src/appearance.js`.
- Local storage key: `ghost_writer_appearance_v1`.
- Public browser API: `window.Appearance.get()`, `window.Appearance.set()`,
  and `window.Appearance.apply()`.
- Browser event: `appearancechange`.
- Tauri event: `appearance-changed`.
- Settings: `theme`, `acrylic`, `blurAmount`, `transparency`.
- Shared effects: `html.dark`, `html.no-acrylic`, `--glass-blur`,
  `--glass-alpha`, and `--frost-opacity`.

React services must preserve normalization, defaults, local-storage syncing,
Tauri event syncing, focus/visibility refresh, and the `.glass-effect` and
`.app-shell` behavior.

Other shared browser/native events include `selection-captured` for the Home
window and `visibilitychange`/`storage` refresh handling used by the secondary
windows.

### Common native calls

The following command names are used by the current pages and must not be
renamed or given different argument shapes during migration:

```text
process_text
generate_image
copy_image_to_clipboard
write_to_clipboard
read_clipboard_text
start_clipboard_monitor
clipboard_command
paste_text
configure_shortcuts
encrypt_data
decrypt_data
lm_ping
open_notepad_window
close_notepad_window
open_clipboard_window
open_clipboard_only_window
close_clipboard_window
```

The native bridge must continue to return the same success/error values. A
typed wrapper may improve compile-time checking, but it must not silently
change command names or payload fields.

The current typed registry is in [`src/lib/contracts.ts`](../../src/lib/contracts.ts),
with command wrappers in `src/lib/tauri-commands.ts` and event subscriptions in
`src/lib/tauri-events.ts`. Rust snake_case argument names that are camel-cased
by Tauri at the JavaScript boundary are documented in those payload types.

## Home page contract

Reference: `src/index.html`.

### Stable DOM landmarks

```text
html#html-root
div#current-text
div#floating-menu
div#captured-indicator
span#captured-preview
div#menu-view
input#prompt-input
button#generate-image-btn
button#generate-diagram-btn
button#open-notepad-btn
button#open-clipboard-btn
div#settings-view
button#settings-toggle
button#settings-tab-models
button#settings-tab-general
button#settings-tab-clipboard
section#settings-models-panel
div#model-settings-root
section#settings-general-panel
section#settings-clipboard-panel
div#loading-view
div#result-view
div#result-text
div#standard-result-actions
div#summarize-result-actions
div#image-prompt-view
input#image-prompt-input
div#image-loading-view
div#image-result-view
img#generated-image-preview
div#toast
span#toast-icon
span#toast-message
```

The `data-i18n` keys are part of the contract. Preserve them or provide an
equivalent translation key map so language changes update the same strings.

### State and storage

```text
app_shortcut
clipboard_shortcut
ghost_writer_clipboard_history_v1
ghost_writer_clipboard_settings_v1
ghost_writer_notepad_v2
ghost_writer_notepad_notes
ghost_writer_ai_settings_enc
luminus_ai_settings_enc
luminus_openai_api_key_enc
luminus_notepad_notes
```

Keep the legacy keys because existing installations may still contain data
under them. Do not change the default shortcuts:

```text
Ctrl+Shift+U — capture selection / open Home
Ctrl+Shift+V — open Clipboard
```

### Home behavior functions

The current implementation includes these behavior areas. The React version
must cover each one before the matching legacy function is removed:

```text
useCopiedText
copyTextResult
copyImageResult
saveResultToNotepad
sendClipboardCommand
captureClipboardNow
clearClipboardHistory
applyTranslations
changeLanguage
showToast
showConfirmModal
toggleTheme
saveAppearanceSetting
onAppearanceSlider
updateAppearanceUI
updateThemeLabel
updateAppShortcut
updateClipboardShortcut
startRecordingShortcut
startRecordingClipboardShortcut
selectSettingsTab
showView
showImagePromptView
handleGenerateImage
pasteGeneratedImage
copyGeneratedImage
getGeneratedImageDataUrl
generatedImageAsPngBase64
loadAiSettings
persistAiSettings
renderModelSettings
toggleProviderMenu
closeProviderMenu
addProvider
addCustomEndpoint
saveProviderKey
clearProviderKey
editProviderKey
cancelProviderKeyEdit
removeProvider
saveProviderConfigField
toggleKeyVisibility
testProviderUrl
selectDefaultModel
selectImageModel
saveCustomEndpointField
saveCustomEndpointContext
toggleCustomEndpoint
removeCustomEndpoint
saveCustomEndpointKey
clearCustomEndpointKey
testCustomEndpoint
getSelectedAiRequest
getDecryptedKey
getSelectedImageRequest
handleAI
copySummary
acceptResult
rejectResult
```

These names are an inventory, not a requirement to keep global functions in
the final code. They are a checklist of behavior that needs a typed owner.

## Notepad page contract

Reference: `src/notepad.html`.

### Stable DOM landmarks

```text
main.notepad-shell
div#tab-container
div#empty-state
div#editor
input#note-title
textarea#note-content
span#note-date
span#save-indicator
div#toast
span#toast-msg
```

### Storage and commands

```text
ghost_writer_notepad_v2
luminus_notepad_v2 (legacy migration source)
close_notepad_window
write_to_clipboard
```

### Behavior functions

```text
npClose
npSetCount
load
save
renderTabs
startRenameTab
finishRenameTab
select
showEmpty
fmtDate
npCreateNew
npDeleteTab
npTitleInput
npContentInput
autoSave
npDelete
npCopy
toast
startWindowDrag
```

Preserve tab order, active-note selection, title/content editing, debounced
autosave, saved indicator, updated date, copy, image attachments, deletion,
empty state, close behavior, and drag behavior.

## Clipboard page contract

Reference: `src/clipboard.html`.

### Stable DOM landmarks

```text
main#history
input#search-input
span#status
button#close-button
div#toast
div.view-toggle[role=tablist]
button.view-button
```

The current page also uses the classes `timeline`, `timeline-group`,
`timeline-items`, `timeline-dot`, `item-actions`, `pin-active`, `empty`, and
`danger` as styling and state hooks. Preserve their semantic equivalents until
the visual reference has been captured.

### Storage, events, and commands

```text
ghost_writer_clipboard_history_v1
ghost_writer_clipboard_settings_v1
clipboard-command: refresh | clear | settings payload
read_clipboard_text
write_to_clipboard
copy_image_to_clipboard { base64Png }
close_clipboard_window
```

### Behavior functions

```text
makeId
loadClipboardSettings
saveItems
loadItems
sortItems
trimItems
addItem
formatTime
formatLength
historyGroupLabel
updateHistoryViewControls
setHistoryView
showToast
makeIcon
makeAction
render
readClipboard
copyItem
togglePin
deleteItem
closeWindow
clearHistoryFromSettings
applySettingsFromMain
handleClipboardCommand
startWindowDrag
```

Preserve duplicate prevention, timestamp ordering, pinned-first ordering,
unpinned eviction, automatic capture, image handling, search, view filters,
grouping, pin/unpin, deletion, clear history, status counts, toasts, and event
refresh behavior.

## Contract change policy

If React needs a different internal shape, add an adapter and test it against
the reference shape. Do not change storage keys, Tauri commands, event names,
default values, or user-visible labels as part of a rendering migration.
