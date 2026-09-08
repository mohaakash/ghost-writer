import { useEffect, useMemo, useRef, useState } from "react";
import { applyAppearance, loadAppearance } from "./lib/appearance";
import {
  HISTORY_KEY,
  SETTINGS_KEY,
  addClipboardItem,
  isClipboardImage,
  normalizeClipboardHistory,
  normalizeClipboardSettings,
  sortClipboardItems,
  trimClipboardHistory,
  type ClipboardItem as ClipboardHistoryItem,
  type ClipboardSettings,
} from "./lib/clipboard-domain";
import { formatLength, formatTime, historyGroupLabel } from "./lib/presentation-domain";
import { closeClipboardWindow, copyImageToClipboard, writeToClipboard } from "./lib/tauri-commands";
import { onAppearanceChanged, onClipboardCaptured, onClipboardCommand } from "./lib/tauri-events";
import { startDragging } from "./lib/tauri";
import { readJson, writeJson } from "./lib/storage";

function makeId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ?? `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function loadItems() {
  return sortClipboardItems(normalizeClipboardHistory(readJson<unknown>(HISTORY_KEY, []), makeId));
}

function loadSettings(): ClipboardSettings {
  return normalizeClipboardSettings(readJson<unknown>(SETTINGS_KEY, {}));
}

function ClipboardIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-icons-outlined ${className}`.trim()}>{name}</span>;
}

/** React-owned Clipboard markup that keeps the legacy page's class and DOM contract. */
export function ClipboardPage() {
  const [items, setItems] = useState<ClipboardHistoryItem[]>(loadItems);
  const [settings, setSettings] = useState<ClipboardSettings>(loadSettings);
  const [query, setQuery] = useState("");
  const [historyView, setHistoryView] = useState<"all" | "pinned">("all");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const settingsRef = useRef(settings);
  itemsRef.current = items;
  settingsRef.current = settings;

  useEffect(() => {
    applyAppearance(loadAppearance());

    const refreshItems = () => setItems(loadItems());
    const onStorage = (event: StorageEvent) => {
      if (event.key === HISTORY_KEY) refreshItems();
      if (event.key === SETTINGS_KEY) setSettings(loadSettings());
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", refreshItems);

    let disposeClipboard: (() => void) | undefined;
    let disposeCapture: (() => void) | undefined;
    let disposeAppearance: (() => void) | undefined;
    void onClipboardCaptured((text) => {
      if (!settingsRef.current.autoCapture) return;
      const next = addClipboardItem(itemsRef.current, text, makeId, Date.now(), settingsRef.current.maxItems);
      if (next.length === itemsRef.current.length && next.every((item, index) => item.id === itemsRef.current[index]?.id && item.createdAt === itemsRef.current[index]?.createdAt)) return;
      itemsRef.current = next;
      setItems(next);
      writeJson(HISTORY_KEY, next);
    }).then((unlisten) => { disposeCapture = unlisten; }).catch(() => {});
    void onClipboardCommand((command) => {
      if (command === "refresh") {
        refreshItems();
        return;
      }
      if (command === "clear") {
        setActiveItemId(null);
        setItems([]);
        writeJson(HISTORY_KEY, []);
        return;
      }
      try {
        const parsed = JSON.parse(command) as { type?: string; settings?: Partial<ClipboardSettings> };
        if (parsed?.type === "settings" && parsed.settings) {
          const nextSettings = normalizeClipboardSettings({ ...settingsRef.current, ...parsed.settings });
          const trimmed = trimClipboardHistory(itemsRef.current, nextSettings.maxItems);
          setSettings(nextSettings);
          setItems(trimmed);
          writeJson(HISTORY_KEY, trimmed);
        }
      } catch {
        // Older versions send only the plain refresh and clear commands.
      }
    }).then((unlisten) => { disposeClipboard = unlisten; }).catch(() => {});
    void onAppearanceChanged((next) => applyAppearance(next))
      .then((unlisten) => { disposeAppearance = unlisten; })
      .catch(() => {});

    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", refreshItems);
      disposeClipboard?.();
      disposeCapture?.();
      disposeAppearance?.();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => historyView === "pinned" ? Boolean(item.pinned) : true)
      .filter((item) => item.text.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [historyView, items, query]);

  const groups = useMemo(() => {
    const grouped: Array<{ label: string; items: ClipboardHistoryItem[] }> = [];
    for (const item of filtered) {
      const label = historyGroupLabel(item.createdAt);
      const current = grouped[grouped.length - 1];
      if (!current || current.label !== label) grouped.push({ label, items: [item] });
      else current.items.push(item);
    }
    return grouped;
  }, [filtered]);

  function saveItems(nextItems: ClipboardHistoryItem[]) {
    const trimmed = trimClipboardHistory(nextItems, settings.maxItems);
    setItems(trimmed);
    writeJson(HISTORY_KEY, trimmed);
  }

  function showToast(message: string) {
    setToast(message);
  }

  async function copyItem(item: ClipboardHistoryItem) {
    setActiveItemId(item.id);
    try {
      if (isClipboardImage(item.text)) await copyImageToClipboard({ base64Png: item.text });
      else await writeToClipboard({ text: item.text });
      showToast("Copied to clipboard");
    } catch {
      showToast("Could not access the clipboard");
    }
  }

  function togglePin(item: ClipboardHistoryItem) {
    saveItems(items.map((candidate) => candidate.id === item.id
      ? { ...candidate, pinned: !candidate.pinned }
      : candidate));
  }

  function deleteItem(item: ClipboardHistoryItem) {
    if (activeItemId === item.id) setActiveItemId(null);
    saveItems(items.filter((candidate) => candidate.id !== item.id));
    showToast("Clipboard item deleted");
  }

  async function closeWindow() {
    try {
      await closeClipboardWindow();
    } catch {
      // The legacy window also keeps the shell open when the native bridge is unavailable.
    }
  }

  function startWindowDrag(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, label")) return;
    void startDragging(event);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const emptyIcon = normalizedQuery ? "search_off" : historyView === "pinned" ? "push_pin" : "content_paste";
  const emptyTitle = normalizedQuery
    ? "No matching items"
    : historyView === "pinned" ? "No pinned clips" : "Your clipboard is ready";
  const emptyCopy = normalizedQuery
    ? "Try a different search."
    : historyView === "pinned"
      ? "Pin an item to see it here."
      : "Copy text anywhere while Ghost Writer is running and it will appear here.";
  const visibleLabel = filtered.length === 1 ? "item" : "items";
  const status = `${filtered.length} ${visibleLabel}${normalizedQuery && historyView === "all" ? ` · ${items.length} total` : ""}`;

  return (
    <>
      <div className="clipboard-shell glass-effect app-shell" data-tauri-drag-region>
        <div className="window-drag" data-tauri-drag-region onMouseDown={startWindowDrag} />
        <div className="app-layout">
          <div className="workspace">
            <header className="header" onMouseDown={startWindowDrag}>
              <div className="title-group">
                <ClipboardIcon name="content_paste" className="title-icon" />
                <span className="title">Clipboard</span>
              </div>
              <div className="header-actions">
                <div className="view-toggle" role="tablist" aria-label="Clipboard history views">
                  <button className={`view-button${historyView === "all" ? " active" : ""}`} data-history-view="all" role="tab" aria-selected={historyView === "all"} onClick={() => setHistoryView("all")}>All</button>
                  <button className={`view-button${historyView === "pinned" ? " active" : ""}`} data-history-view="pinned" role="tab" aria-selected={historyView === "pinned"} onClick={() => setHistoryView("pinned")}>Pinned</button>
                </div>
                <button className="icon-button close" id="close-button" title="Close clipboard" aria-label="Close clipboard" onClick={() => void closeWindow()}>
                  <ClipboardIcon name="close" />
                </button>
              </div>
            </header>

            <section className="toolbar">
              <label className="search">
                <ClipboardIcon name="search" />
                <input id="search-input" type="search" autoComplete="off" placeholder="Search clipboard history" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <div className="toolbar-row">
                <span className="status" id="status">{status}</span>
              </div>
            </section>

            <main className="history" id="history" aria-live="polite">
              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon"><ClipboardIcon name={emptyIcon} /></div>
                  <div className="empty-title">{emptyTitle}</div>
                  <div className="empty-copy">{emptyCopy}</div>
                </div>
              ) : (
                <div className="timeline">
                  {groups.map((group) => (
                    <section className="timeline-group" key={group.label}>
                      <div className="timeline-heading">
                        <span className="timeline-dot" />
                        {group.label}
                      </div>
                      <div className="timeline-items">
                        {group.items.map((item) => (
                          <article
                            className={`clip-item${item.pinned ? " pinned" : ""}${item.id === activeItemId ? " selected" : ""}`}
                            title="Copy this item"
                            key={item.id}
                            onClick={() => void copyItem(item)}
                          >
                            <div className="clip-main">
                              <div className="clip-text">
                                {isClipboardImage(item.text) ? <img src={item.text} alt="Clipboard image" style={{ maxWidth: "100%", maxHeight: "150px", objectFit: "contain" }} /> : item.text}
                              </div>
                              <div className="clip-meta">{formatTime(item.createdAt)} · {formatLength(item.text)}</div>
                            </div>
                            <div className="item-actions">
                              <button className="item-button" type="button" title="Copy" aria-label="Copy" onClick={(event) => { event.stopPropagation(); void copyItem(item); }}><ClipboardIcon name="content_copy" /></button>
                              <button className={`item-button${item.pinned ? " pin-active" : ""}`} type="button" title={item.pinned ? "Unpin" : "Pin"} aria-label={item.pinned ? "Unpin" : "Pin"} onClick={(event) => { event.stopPropagation(); togglePin(item); }}><ClipboardIcon name="push_pin" /></button>
                              <button className="item-button danger" type="button" title="Delete" aria-label="Delete" onClick={(event) => { event.stopPropagation(); deleteItem(item); }}><ClipboardIcon name="delete" /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </main>

            <footer className="footer">Clipboard history is managed in Preferences and stays local to this device.</footer>
          </div>
        </div>
      </div>
      <div className={`toast${toast ? " show" : ""}`} id="toast" role="status">{toast ?? ""}</div>
    </>
  );
}
