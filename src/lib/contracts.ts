export const STORAGE_KEYS = {
  appearance: "ghost_writer_appearance_v1",
  appShortcut: "app_shortcut",
  clipboardShortcut: "clipboard_shortcut",
  clipboardHistory: "ghost_writer_clipboard_history_v1",
  clipboardSettings: "ghost_writer_clipboard_settings_v1",
  notepad: "ghost_writer_notepad_v2",
  legacyNotepad: "luminus_notepad_v2",
  legacyNotepadHome: "luminus_notepad_notes",
  homeNotepad: "ghost_writer_notepad_notes",
  aiSettings: "ghost_writer_ai_settings_enc",
  legacyAiSettings: "luminus_ai_settings_enc",
  legacyOpenAiKey: "luminus_openai_api_key_enc",
} as const;

export const TAURI_COMMANDS = {
  processText: "process_text",
  generateImage: "generate_image",
  copyImageToClipboard: "copy_image_to_clipboard",
  writeToClipboard: "write_to_clipboard",
  readClipboardText: "read_clipboard_text",
  startClipboardMonitor: "start_clipboard_monitor",
  clipboardCommand: "clipboard_command",
  pasteText: "paste_text",
  configureShortcuts: "configure_shortcuts",
  encryptData: "encrypt_data",
  decryptData: "decrypt_data",
  lmPing: "lm_ping",
  openNotepadWindow: "open_notepad_window",
  closeNotepadWindow: "close_notepad_window",
  openClipboardWindow: "open_clipboard_window",
  openClipboardOnlyWindow: "open_clipboard_only_window",
  closeClipboardWindow: "close_clipboard_window",
} as const;

export const TAURI_EVENTS = {
  selectionCaptured: "selection-captured",
  clipboardCaptured: "clipboard-captured",
  clipboardCommand: "clipboard-command",
  appearanceChanged: "appearance-changed",
} as const;

export type TauriCommandName = typeof TAURI_COMMANDS[keyof typeof TAURI_COMMANDS];
export type TauriEventName = typeof TAURI_EVENTS[keyof typeof TAURI_EVENTS];

export type ShortcutValue = string;
export type ToastKind = "info" | "success" | "error";

export interface ToastState {
  message: string;
  kind: ToastKind;
}

export interface GeneratedImage {
  base64: string;
  dataUrl: string;
}

export interface ProcessTextRequest {
  text: string;
  prompt: string;
  api_key: string;
  system_prompt?: string;
  provider?: string;
  model?: string;
  base_url?: string | null;
}

export interface GenerateImageArgs {
  prompt: string;
  apiKey: string;
  model?: string | null;
  provider?: string | null;
  baseUrl?: string | null;
}

export interface ConfigureShortcutsArgs {
  appShortcut: string;
  clipboardShortcut: string;
}

export interface EncryptDataArgs {
  data: string;
}

export interface DecryptDataArgs {
  /** Tauri's JavaScript boundary uses camelCase for the Rust `encrypted_data` argument. */
  encryptedData: string;
}

export interface LmPingArgs {
  baseUrl: string;
}

export interface ClipboardImageArgs {
  /** Tauri's JavaScript boundary uses camelCase for Rust's `base64_png`. */
  base64Png: string;
}

export interface TextArgs {
  text: string;
}

export interface ClipboardCommandArgs {
  command: string;
}
