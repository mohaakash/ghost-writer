import { STORAGE_KEYS } from "./contracts";

export const HISTORY_KEY = STORAGE_KEYS.clipboardHistory;
export const SETTINGS_KEY = STORAGE_KEYS.clipboardSettings;
export const MAX_TEXT_LENGTH = 250_000;
export const CLIPBOARD_HISTORY_LIMITS = [25, 50, 100, 200] as const;

export interface ClipboardItem {
  id: string;
  text: string;
  createdAt: number;
  pinned?: boolean;
}

export interface ClipboardSettings {
  autoCapture: boolean;
  maxItems: number;
}

export const DEFAULT_CLIPBOARD_SETTINGS: ClipboardSettings = {
  autoCapture: true,
  maxItems: 50,
};

export function normalizeClipboardSettings(value: unknown): ClipboardSettings {
  const input = value && typeof value === "object" ? value as Partial<ClipboardSettings> : {};
  const maxItems = Number(input.maxItems);
  return {
    autoCapture: input.autoCapture !== false,
    maxItems: CLIPBOARD_HISTORY_LIMITS.includes(maxItems as typeof CLIPBOARD_HISTORY_LIMITS[number])
      ? maxItems
      : DEFAULT_CLIPBOARD_SETTINGS.maxItems,
  };
}

export function isClipboardImage(text: string) {
  return text.startsWith("data:image/png;base64,");
}

export function normalizeClipboardItem(
  value: unknown,
  makeId: () => string,
  now = Date.now(),
): ClipboardItem | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<ClipboardItem>;
  if (typeof input.text !== "string") return null;
  return {
    id: String(input.id || makeId()),
    text: isClipboardImage(input.text) ? input.text : input.text.slice(0, MAX_TEXT_LENGTH),
    pinned: Boolean(input.pinned),
    createdAt: Number(input.createdAt) || now,
  };
}

export function normalizeClipboardHistory(
  value: unknown,
  makeId: () => string,
  now = Date.now(),
): ClipboardItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeClipboardItem(item, makeId, now))
    .filter((item): item is ClipboardItem => item !== null);
}

export function compareClipboardItems(a: ClipboardItem, b: ClipboardItem) {
  return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt - a.createdAt;
}

export function sortClipboardItems(items: ClipboardItem[]) {
  return [...items].sort(compareClipboardItems);
}

function lastUnpinnedIndex(items: ClipboardItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index].pinned) return index;
  }
  return -1;
}

/** Return a new array while preserving the legacy pinned-first/oldest-unpinned eviction rule. */
export function trimClipboardHistory(items: ClipboardItem[], maxItems: number) {
  const limit = Number.isFinite(maxItems) ? Math.max(1, Math.floor(maxItems)) : DEFAULT_CLIPBOARD_SETTINGS.maxItems;
  const trimmed = sortClipboardItems(items);
  while (trimmed.length > limit) {
    const removableIndex = lastUnpinnedIndex(trimmed);
    if (removableIndex < 0) break;
    trimmed.splice(removableIndex, 1);
  }
  return trimmed;
}

export function addClipboardItem(
  items: ClipboardItem[],
  text: string,
  makeId: () => string,
  now = Date.now(),
  maxItems = DEFAULT_CLIPBOARD_SETTINGS.maxItems,
) {
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) {
    return trimClipboardHistory(items, maxItems);
  }
  const next = [...items];
  const existingIndex = next.findIndex((item) => item.text === text);
  if (existingIndex >= 0) {
    next[existingIndex] = { ...next[existingIndex], createdAt: now };
  } else {
    next.push({ id: makeId(), text, pinned: false, createdAt: now });
  }
  return trimClipboardHistory(next, maxItems);
}
