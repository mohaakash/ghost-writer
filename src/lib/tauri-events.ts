import { listen } from "./tauri";
import { TAURI_EVENTS } from "./contracts";
import type { AppearanceSettings } from "./appearance-domain";

/** Typed subscriptions keep native event names and payloads in one place. */
export function onSelectionCaptured(handler: (text: string) => void) {
  return listen<string>(TAURI_EVENTS.selectionCaptured, handler);
}

export function onClipboardCaptured(handler: (text: string) => void) {
  return listen<string>(TAURI_EVENTS.clipboardCaptured, handler);
}

export function onClipboardCommand(handler: (command: string) => void) {
  return listen<string>(TAURI_EVENTS.clipboardCommand, handler);
}

export function onAppearanceChanged(handler: (settings: AppearanceSettings) => void) {
  return listen<AppearanceSettings>(TAURI_EVENTS.appearanceChanged, handler);
}
