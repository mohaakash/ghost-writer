import {
  trimClipboardHistory,
  type ClipboardItem,
} from "./clipboard-domain";

export { DEFAULT_CLIPBOARD_SETTINGS, HISTORY_KEY, SETTINGS_KEY, trimClipboardHistory } from "./clipboard-domain";
export type { ClipboardItem, ClipboardSettings } from "./clipboard-domain";

export const NOTES_KEY = "ghost_writer_notepad_v2";

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  image?: string;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Compatibility alias used by the staged React windows. */
export function trimHistory(items: ClipboardItem[], maxItems: number) {
  return trimClipboardHistory(items, maxItems);
}
