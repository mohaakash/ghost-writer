import { useEffect, useState } from "react";
import {
  CLIPBOARD_HISTORY_LIMITS,
  DEFAULT_CLIPBOARD_SETTINGS,
  SETTINGS_KEY,
  HISTORY_KEY,
  normalizeClipboardSettings,
  trimClipboardHistory,
  type ClipboardItem,
  type ClipboardSettings as ClipboardSettingsValue,
} from "./lib/clipboard-domain";
import { openClipboardOnlyWindow, readClipboardText, sendClipboardCommand, configureShortcuts } from "./lib/tauri-commands";
import { onClipboardCaptured } from "./lib/tauri-events";
import { formatShortcutKey } from "./lib/presentation-domain";
import { SettingsFrame, type PreferencesTab } from "./home-models";

type ToastType = "info" | "success" | "error";

interface ClipboardSettingsProps {
  onClose: () => void;
  fallbackToLegacy: (view?: string) => void;
  onSelectTab: (tab: PreferencesTab) => void;
  showToast: (message: string, type?: ToastType) => void;
}

const DEFAULT_APP_SHORTCUT = "Ctrl+Shift+U";
const DEFAULT_CLIPBOARD_SHORTCUT = "Ctrl+Shift+V";

function icon(name: string, className = "") {
  return <span className={`material-icons-outlined ${className}`.trim()}>{name}</span>;
}

function readSettings(): ClipboardSettingsValue {
  try {
    return normalizeClipboardSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"));
  } catch {
    return { ...DEFAULT_CLIPBOARD_SETTINGS };
  }
}

function readHistory(): ClipboardItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is ClipboardItem => Boolean(item) && typeof item.text === "string")
      : [];
  } catch {
    return [];
  }
}

function historyCountLabel(count: number, language: string) {
  if (language === "fr") return count === 1 ? "1 élément enregistré" : `${count} éléments enregistrés`;
  if (language === "ar") return count === 1 ? "تم حفظ 1 عنصر" : `تم حفظ ${count} عناصر`;
  return count === 1 ? "1 item stored" : `${count} items stored`;
}

/** Clipboard preferences staged against the exact legacy Home settings panel. */
export function ClipboardSettings({ onClose, fallbackToLegacy, onSelectTab, showToast }: ClipboardSettingsProps) {
  const [settings, setSettings] = useState<ClipboardSettingsValue>(() => readSettings());
  const [historyCount, setHistoryCount] = useState(() => readHistory().length);
  const [shortcut, setShortcut] = useState(() => {
    try { return localStorage.getItem("clipboard_shortcut") || DEFAULT_CLIPBOARD_SHORTCUT; } catch { return DEFAULT_CLIPBOARD_SHORTCUT; }
  });
  const [recording, setRecording] = useState(false);
  const [language] = useState(() => {
    try { return localStorage.getItem("app_lang") || "en"; } catch { return "en"; }
  });

  useEffect(() => {
    const refresh = () => setHistoryCount(readHistory().length);
    const onStorage = (event: StorageEvent) => {
      if (event.key === HISTORY_KEY || event.key === SETTINGS_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    let dispose: (() => void) | undefined;
    void onClipboardCaptured(() => refresh()).then((cleanup) => { dispose = cleanup; }).catch(() => {});
    return () => {
      window.removeEventListener("storage", onStorage);
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const handleKeys = (event: KeyboardEvent) => {
      event.preventDefault();
      const modifiers: string[] = [];
      if (event.ctrlKey) modifiers.push("Ctrl");
      if (event.shiftKey) modifiers.push("Shift");
      if (event.altKey) modifiers.push("Alt");
      if (event.metaKey) modifiers.push("Command");
      const key = formatShortcutKey(event.key);
      if (["CONTROL", "SHIFT", "ALT", "META"].includes(key)) return;

      const nextShortcut = [...modifiers, key].join("+");
      setRecording(false);
      let appShortcut = DEFAULT_APP_SHORTCUT;
      try { appShortcut = localStorage.getItem("app_shortcut") || DEFAULT_APP_SHORTCUT; } catch { /* use the legacy default */ }
      void configureShortcuts({ appShortcut, clipboardShortcut: nextShortcut }).then(() => {
        try { localStorage.setItem("clipboard_shortcut", nextShortcut); } catch { /* keep the native shortcut even if storage is unavailable */ }
        setShortcut(nextShortcut);
        showToast(`Clipboard shortcut set to ${nextShortcut}`, "success");
      }).catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Could not register clipboard shortcut", "error");
      });
    };
    window.addEventListener("keydown", handleKeys, true);
    return () => window.removeEventListener("keydown", handleKeys, true);
  }, [recording, showToast]);

  function persist(next: ClipboardSettingsValue) {
    const normalized = normalizeClipboardSettings(next);
    setSettings(normalized);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized)); } catch { /* legacy storage remains the fallback */ }
    const trimmed = trimClipboardHistory(readHistory(), normalized.maxItems);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)); } catch { /* preserve the in-memory setting */ }
    setHistoryCount(trimmed.length);
    void sendClipboardCommand({ command: JSON.stringify({ type: "settings", settings: normalized }) }).catch(() => {});
  }

  function addHistoryItem(text: string) {
    if (!text.trim()) return;
    const history = readHistory();
    const existing = history.find((item) => item.text === text);
    if (existing) existing.createdAt = Date.now();
    else {
      const id = globalThis.crypto?.randomUUID?.() ?? `clip_${Date.now()}`;
      history.push({ id, text, pinned: false, createdAt: Date.now() });
    }
    const trimmed = trimClipboardHistory(history, settings.maxItems);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)); } catch { /* surface the same visible count even if storage is unavailable */ }
    setHistoryCount(trimmed.length);
  }

  async function captureNow() {
    try {
      const text = await readClipboardText();
      if (typeof text !== "string" || !text.trim()) {
        showToast(language === "fr" ? "Le presse-papiers est vide" : language === "ar" ? "الحافظة فارغة" : "Clipboard is empty", "info");
        return;
      }
      addHistoryItem(text);
      await sendClipboardCommand({ command: "refresh" });
      showToast(language === "fr" ? "Presse-papiers vérifié" : language === "ar" ? "تم فحص الحافظة" : "Clipboard checked", "success");
    } catch (error) {
      showToast(`Clipboard Error: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  async function clearHistory() {
    const history = readHistory();
    if (!history.length || !window.confirm(language === "fr" ? "Effacer tout l’historique du presse-papiers ?" : language === "ar" ? "هل تريد مسح سجل الحافظة بالكامل؟" : "Clear all clipboard history?")) return;
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* update the view even if storage is unavailable */ }
    setHistoryCount(0);
    await sendClipboardCommand({ command: "clear" });
    showToast(language === "fr" ? "Historique du presse-papiers effacé" : language === "ar" ? "تم مسح سجل الحافظة" : "Clipboard history cleared", "info");
  }

  function openClipboardOnly() {
    void openClipboardOnlyWindow().catch(() => showToast("Could not open Clipboard", "error"));
  }

  return (
    <SettingsFrame onClose={onClose} fallbackToLegacy={fallbackToLegacy} activeTab="clipboard" onSelectTab={onSelectTab}>
      <section id="settings-clipboard-panel" className="space-y-4 px-1 pt-2 pb-4">
        <div className="px-1"><p data-i18n="clipboard" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Clipboard</p><p data-i18n="clipboard_help" className="mt-0.5 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500/90">Manage your local clipboard history and capture behavior.</p></div>

        <div className="rounded-2xl border border-black/5 bg-black/5 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="mb-3 flex items-center gap-2">{icon("content_paste", "text-[18px] text-primary")}<span data-i18n="clipboard_behavior" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Behavior</span></div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/40 px-3 py-2.5 dark:bg-zinc-900/40"><span className="min-w-0"><span data-i18n="clipboard_auto_capture" className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">Automatic capture</span><span data-i18n="clipboard_auto_capture_help" className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">Capture new text copied anywhere while Ghost Writer is running.</span></span><input id="clipboard-auto-capture" type="checkbox" checked={settings.autoCapture} onChange={(event) => persist({ ...settings, autoCapture: event.target.checked })} className="h-4 w-4 shrink-0 rounded border-zinc-300 text-primary focus:ring-primary/30 dark:border-zinc-700 dark:bg-zinc-900" /></label>
          <label className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white/40 px-3 py-2.5 dark:bg-zinc-900/40"><span className="min-w-0"><span data-i18n="clipboard_history_limit" className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">History limit</span><span data-i18n="clipboard_history_limit_help" className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">Older unpinned items are removed first.</span></span><select id="clipboard-history-limit" value={String(settings.maxItems)} onChange={(event) => persist({ ...settings, maxItems: Number(event.target.value) })} className="rounded-lg border border-transparent bg-white/60 px-2 py-1 text-[11px] font-semibold text-zinc-700 outline-none focus:border-primary/30 dark:bg-zinc-900/60 dark:text-zinc-200">{CLIPBOARD_HISTORY_LIMITS.map((limit) => <option key={limit} value={limit}>{limit}</option>)}</select></label>
        </div>

        <div className="rounded-2xl border border-black/5 bg-black/5 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p data-i18n="clipboard_open_mode" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Open mode</p><p data-i18n="clipboard_open_only" className="mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">Open clipboard only</p><p data-i18n="clipboard_open_only_help" className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">Hide the main window and use Clipboard as a standalone tool.</p></div><button type="button" onClick={openClipboardOnly} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90">{icon("open_in_new", "text-[15px]")}<span data-i18n="clipboard_open_only_action">Open only Clipboard</span></button></div>
          <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/5"><div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><p data-i18n="clipboard_shortcut" className="text-xs font-medium text-zinc-800 dark:text-zinc-200">Clipboard shortcut</p><p data-i18n="clipboard_shortcut_help" className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">Open Clipboard without opening the main window.</p></div></div><button id="clipboard-shortcut-recorder" type="button" onClick={() => setRecording(true)} className="group flex w-full items-center justify-between rounded-xl bg-white/40 px-3 py-2.5 text-left transition-all hover:bg-white/60 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60"><span className="flex items-center gap-2.5">{icon("keyboard", "text-[18px] text-zinc-400 group-hover:text-primary")}<span id="clipboard-shortcut-display" className={`font-bold text-zinc-800 dark:text-zinc-200${recording ? " text-primary" : ""}`}>{recording ? "..." : shortcut}</span></span><span data-i18n="edit" className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Edit</span></button></div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-black/5 p-3 dark:border-white/5 dark:bg-white/5"><div className="flex items-center justify-between gap-3"><div><p data-i18n="clipboard_actions" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">History actions</p><p id="clipboard-item-count" className="mt-1 text-[10px] text-zinc-500">{historyCountLabel(historyCount, language)}</p></div><button type="button" onClick={() => void captureNow()} className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90">{icon("sync", "text-[15px]")}<span data-i18n="clipboard_capture_now">Capture now</span></button></div><button type="button" onClick={() => void clearHistory()} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-red-500 transition-all hover:bg-red-500/10">{icon("delete_sweep", "text-[15px]")}<span data-i18n="clipboard_clear_all">Clear all history</span></button></div>

        <p data-i18n="clipboard_local_note" className="px-1 text-[10px] leading-relaxed text-zinc-500">Clipboard history stays on this device and is never sent to an AI provider.</p>
      </section>
    </SettingsFrame>
  );
}
