import { useEffect, useRef, useState } from "react";
import { applyAppearance, loadAppearance } from "./lib/appearance";
import { closeNotepadWindow, writeToClipboard } from "./lib/tauri-commands";
import { onAppearanceChanged } from "./lib/tauri-events";
import { startDragging } from "./lib/tauri";
import { STORAGE_KEYS } from "./lib/contracts";
import { readJson, writeJson, type Note } from "./lib/storage";
import { IconButton, GlassWindow, WindowHeader } from "./components/primitives";

const STORE_KEY = STORAGE_KEYS.notepad;
const LEGACY_STORE_KEY = STORAGE_KEYS.legacyNotepad;
const WELCOME_CONTENT = "Your notes live here — each note is a tab.\n\n• Create new notes with the + button\n• Close tabs with the × on each tab\n• Double-click a tab to rename it\n• Notes auto-save locally";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function welcomeNote(): Note {
  const now = nowIso();
  return { id: makeId("note"), title: "Welcome", content: WELCOME_CONTENT, createdAt: now, updatedAt: now };
}

function loadNotes(): Note[] {
  try {
    const currentRaw = localStorage.getItem(STORE_KEY);
    const legacyRaw = currentRaw ? null : localStorage.getItem(LEGACY_STORE_KEY);
    const parsed = JSON.parse(currentRaw || legacyRaw || "[]");
    const next = Array.isArray(parsed) ? parsed as Note[] : [];
    if (legacyRaw) {
      localStorage.setItem(STORE_KEY, legacyRaw);
      localStorage.removeItem(LEGACY_STORE_KEY);
    }
    if (next.length) return next;
    const initial = [welcomeNote()];
    writeJson(STORE_KEY, initial);
    return initial;
  } catch {
    const initial = [welcomeNote()];
    try { writeJson(STORE_KEY, initial); } catch { /* keep the editor usable if storage is unavailable */ }
    return initial;
  }
}

function persistNotes(notes: Note[]) {
  const latest = readJson<Note[]>(STORE_KEY, []);
  const merged = [...notes];
  for (const item of latest) {
    if (!merged.some((note) => note.id === item.id)) merged.push(item);
  }
  writeJson(STORE_KEY, merged);
}

function formatNoteDate(value: string) {
  return value
    ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
}

function canStartDrag(event: React.MouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement;
  return !target.closest("button, input, textarea, .tab-bar, [data-tauri-drag-region=\"no-drag\"]");
}

export function NotepadPage() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeId, setActiveId] = useState<string | null>(() => notes[0]?.id ?? null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const active = notes.find((note) => note.id === activeId) ?? null;

  useEffect(() => {
    applyAppearance(loadAppearance());
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORE_KEY) return;
      const incoming = readJson<Note[]>(STORE_KEY, []);
      setNotes(incoming);
      setActiveId(incoming[0]?.id ?? null);
    };
    window.addEventListener("storage", onStorage);
    let dispose: (() => void) | undefined;
    void onAppearanceChanged((next) => applyAppearance(next)).then((unlisten) => { dispose = unlisten; }).catch(() => {});
    return () => {
      window.removeEventListener("storage", onStorage);
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (!editingTabId) return;
    renameRef.current?.focus();
    renameRef.current?.select();
  }, [editingTabId]);

  useEffect(() => {
    if (!activeId) return;
    const timer = window.setTimeout(() => contentRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [activeId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
  }

  function updateNote(id: string, patch: Partial<Note>) {
    setSaved(false);
    setNotes((current) => current.map((note) => note.id === id ? { ...note, ...patch, updatedAt: nowIso() } : note));
  }

  useEffect(() => {
    if (saved) return;
    const timer = window.setTimeout(() => {
      setNotes((current) => {
        persistNotes(current);
        return current;
      });
      setSaved(true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [notes, saved]);

  function createNew() {
    const now = nowIso();
    const note: Note = { id: makeId("note"), title: "New Note", content: "", createdAt: now, updatedAt: now };
    setNotes((current) => {
      const next = [note, ...current];
      persistNotes(next);
      return next;
    });
    setActiveId(note.id);
    showToast("Note created");
  }

  function finishRename(id: string, value: string) {
    const nextTitle = value.trim() || "Untitled";
    setNotes((current) => {
      const next = current.map((note) => note.id === id ? { ...note, title: nextTitle, updatedAt: nowIso() } : note);
      persistNotes(next);
      return next;
    });
    setEditingTabId(null);
  }

  function deleteNote(id: string) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    if (notes.length <= 1) {
      const next = notes.map((item) => item.id === id ? { ...item, title: "Untitled", content: "", updatedAt: nowIso() } : item);
      setNotes(next);
      persistNotes(next);
      setActiveId(id);
      showToast("Cleared");
      return;
    }
    const next = notes.filter((item) => item.id !== id);
    setNotes(next);
    persistNotes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    showToast("Deleted");
  }

  async function copyContent() {
    if (!active?.content) return;
    try {
      await writeToClipboard({ text: active.content });
      showToast("Copied!");
    } catch {
      try {
        await navigator.clipboard.writeText(active.content);
        showToast("Copied!");
      } catch {
        showToast("Could not copy");
      }
    }
  }

  async function close() {
    try {
      await closeNotepadWindow();
    } catch {
      window.close();
    }
  }

  return (
    <>
      <GlassWindow
        className="notepad-shell flex h-full w-full flex-col ios-shadow border border-black/10 dark:border-white/10 overflow-hidden"
        onMouseDown={(event) => {
          if (canStartDrag(event)) void startDragging(event);
        }}
      >
        <WindowHeader
          actions={(
            <IconButton variant="close" onClick={() => void close()} title="Close notepad" aria-label="Close notepad">
              <span className="material-icons-outlined">close</span>
            </IconButton>
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-icons-outlined text-[18px] text-amber-400">edit_note</span>
            <h1 className="truncate text-sm font-bold tracking-wide text-zinc-800 dark:text-zinc-200">Notepad</h1>
            <span id="note-count" className="shrink-0 text-[10px] bg-amber-500/10 text-amber-500 dark:text-amber-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-tight">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          </div>
        </WindowHeader>

        <div className="shrink-0 flex items-center gap-1.5 px-3 pt-2 pb-1 min-w-0">
          <div id="tab-container" className="tab-bar flex items-center gap-1 overflow-x-auto overflow-y-hidden py-0.5 min-w-0 flex-1">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`tab flex items-center gap-1.5 h-[24px] px-2.5 max-w-[160px] cursor-pointer text-[11px] rounded-full shrink-0 transition-all overflow-hidden${note.id === activeId ? " bg-black/5 text-zinc-800 shadow-sm dark:bg-white/15 dark:text-zinc-100" : " text-zinc-500 hover:text-zinc-700 hover:bg-black/5 dark:hover:text-zinc-300 dark:hover:bg-white/[0.04]"}`}
                data-id={note.id}
                onClick={() => setActiveId(note.id)}
                onDoubleClick={() => setEditingTabId(note.id)}
              >
                {editingTabId === note.id ? (
                  <input
                    ref={renameRef}
                    className="tab-title-input bg-transparent border-none text-zinc-100 text-[11px] outline-none w-full min-w-[40px] px-0"
                    value={note.title || "Untitled"}
                    onChange={(event) => setNotes((current) => current.map((item) => item.id === note.id ? { ...item, title: event.target.value } : item))}
                    onBlur={(event) => finishRename(note.id, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                      if (event.key === "Escape") { event.currentTarget.value = note.title || "Untitled"; event.currentTarget.blur(); }
                    }}
                  />
                ) : <span className="tab-title overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{note.title || "Untitled"}</span>}
                <span
                  className={`tab-close flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] text-zinc-600 opacity-0 transition-all shrink-0 leading-none${note.id === activeId ? " opacity-50" : ""}`}
                  onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(255,255,255,0.08)"; event.currentTarget.style.color = "#e4e4e7"; }}
                  onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; event.currentTarget.style.color = ""; }}
                  onClick={(event) => { event.stopPropagation(); deleteNote(note.id); }}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
          <button onClick={createNew} title="New note" aria-label="New note" className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all text-base leading-none">+</button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative px-3 pb-2">
          {!active ? (
            <div id="empty-state" className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <div className="flex items-center justify-center w-12 h-12 rounded-[15px] text-amber-400 bg-amber-500/10"><span className="material-icons-outlined text-[24px]">edit_note</span></div>
              <p className="text-[13px] font-semibold text-zinc-400">No notes yet</p>
              <button onClick={createNew} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90"><span className="material-icons-outlined text-[15px]">add</span>Create New Note</button>
            </div>
          ) : (
            <div id="editor" className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-1.5 pt-1 pb-1 shrink-0">
                <input id="note-title" type="text" placeholder="Note Title..." value={active.title} onChange={(event) => updateNote(active.id, { title: event.target.value })} className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-[15px] font-bold text-zinc-800 dark:text-zinc-100 placeholder-zinc-500 min-w-0" />
                <IconButton onClick={() => void copyContent()} title="Copy content"><span className="material-icons-outlined">content_copy</span></IconButton>
                <IconButton variant="close" onClick={() => deleteNote(active.id)} title="Delete note"><span className="material-icons-outlined">delete</span></IconButton>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 pb-1.5 mb-1 border-b border-black/5 dark:border-white/10 shrink-0">
                <span id="note-date">Last modified: {formatNoteDate(active.updatedAt)}</span>
                <span id="save-indicator" className="text-zinc-500 transition-opacity" style={{ opacity: saved ? 0 : 1 }}>{saved ? "Saved" : "Saving..."}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto py-1">
                <textarea ref={contentRef} id="note-content" placeholder="Type your notes here..." value={active.content} onChange={(event) => updateNote(active.id, { content: event.target.value })} className="w-full h-full bg-transparent border-none focus:ring-0 p-0 text-[13px] text-zinc-800 dark:text-zinc-200 placeholder-zinc-600 resize-none leading-relaxed" />
              </div>
            </div>
          )}
        </div>
        <footer className="shrink-0 px-4 py-2.5 border-t border-black/5 dark:border-white/10"><p className="text-center text-[10px] leading-relaxed text-zinc-500">Notes are stored locally and never sent to an AI provider.</p></footer>
      </GlassWindow>
      <div className={toast ? "fixed bottom-3 left-3 right-3 z-[9999]" : "hidden fixed bottom-3 left-3 right-3 z-[9999]"} id="react-toast">
        <div className="glass-effect bg-black/80 dark:bg-zinc-900/90 text-white rounded-2xl p-3 flex items-center gap-3 shadow-2xl border border-white/10">
          <span className="material-icons-outlined text-amber-400 text-[16px]">check_circle</span>
          <span className="text-sm font-medium flex-1">{toast ?? ""}</span>
        </div>
      </div>
    </>
  );
}
