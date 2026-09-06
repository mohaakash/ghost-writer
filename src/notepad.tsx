import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Clipboard, Copy, FilePenLine, Plus, Save, Trash2, X } from "lucide-react";
import { invoke, listen, startDragging } from "./lib/tauri";
import { APPEARANCE_KEY, applyAppearance, loadAppearance } from "./lib/appearance";
import { NOTES_KEY, readJson, writeJson, type Note } from "./lib/storage";
import "./styles.css";

function newNote(): Note {
  const now = new Date().toISOString();
  return { id: `note_${Date.now()}`, title: "New note", content: "", createdAt: now, updatedAt: now };
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Notepad() {
  const [notes, setNotes] = useState<Note[]>(() => readJson<Note[]>(NOTES_KEY, []));
  const [activeId, setActiveId] = useState<string | null>(() => readJson<Note[]>(NOTES_KEY, [])[0]?.id ?? null);
  const active = useMemo(() => notes.find((note) => note.id === activeId) ?? null, [notes, activeId]);
  const [saved, setSaved] = useState(true);

  useEffect(() => { applyAppearance(loadAppearance()); const onStorage = (event: StorageEvent) => { if (event.key === NOTES_KEY) { const next = readJson<Note[]>(NOTES_KEY, []); setNotes(next); setActiveId((id) => next.some((note) => note.id === id) ? id : next[0]?.id ?? null); } if (event.key === APPEARANCE_KEY) applyAppearance(loadAppearance()); }; window.addEventListener("storage", onStorage); let dispose: (() => void) | undefined; void listen<ReturnType<typeof loadAppearance>>("appearance-changed", (next) => applyAppearance(next)).then((unlisten) => { dispose = unlisten; }).catch(() => {}); return () => { window.removeEventListener("storage", onStorage); dispose?.(); }; }, []);
  useEffect(() => { if (!activeId) return; const timeout = window.setTimeout(() => { writeJson(NOTES_KEY, notes); setSaved(true); }, 350); return () => window.clearTimeout(timeout); }, [notes, activeId]);

  function updateActive(patch: Partial<Note>) { if (!activeId) return; setSaved(false); setNotes((current) => current.map((note) => note.id === activeId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note)); }
  function create() { const note = newNote(); setNotes((current) => [note, ...current]); setActiveId(note.id); }
  function remove(id: string) { if (notes.length <= 1) { updateActive({ title: "Untitled", content: "", image: undefined }); return; } const next = notes.filter((note) => note.id !== id); setNotes(next); setActiveId((current) => current === id ? next[0]?.id ?? null : current); writeJson(NOTES_KEY, next); }
  async function copy() { if (!active?.content) return; try { await invoke("write_to_clipboard", { text: active.content }); } catch { await navigator.clipboard?.writeText(active.content); } }
  async function close() { await invoke("close_notepad_window").catch(() => {}); }

  return <main className="app-shell"><div className="drag-region h-1 shrink-0 border-b signal-line" /><header className="drag-region flex h-11 shrink-0 items-center justify-between border-b hairline px-3"><div className="flex items-center gap-2"><FilePenLine size={15} className="text-signal" /><span className="text-[12px] font-semibold uppercase tracking-[0.16em]">Notepad</span><span className="text-[9px] text-dim">{notes.length} {notes.length === 1 ? "note" : "notes"}</span></div><button data-no-drag className="industrial-button h-7 w-7" onClick={() => void close()} aria-label="Close notepad"><X size={14} /></button></header><div className="flex min-h-0 flex-1 flex-col"><div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b hairline px-2 py-2">{notes.map((note) => <button key={note.id} className={`group flex max-w-[150px] items-center gap-1 border px-2 py-1 text-[10px] ${note.id === activeId ? "signal-line bg-signal/10 text-signal" : "border-transparent text-muted hover:text-ink"}`} onClick={() => setActiveId(note.id)}><span className="truncate">{note.title || "Untitled"}</span><span className="text-dim opacity-0 group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); remove(note.id); }}><X size={11} /></span></button>)}<button className="industrial-button ml-auto h-6 w-6 shrink-0" onClick={create} aria-label="New note"><Plus size={13} /></button></div>{active ? <section className="flex min-h-0 flex-1 flex-col px-3 pb-3" onMouseDown={(event) => { void startDragging(event); }}><div className="flex shrink-0 items-center gap-2 border-b hairline py-2"><input data-no-drag className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] font-semibold text-ink outline-none placeholder:text-dim" value={active.title} onChange={(event) => updateActive({ title: event.target.value })} placeholder="Note title" /><span className="text-[9px] text-dim">{saved ? "Saved" : "Saving…"}</span><button data-no-drag className="industrial-button h-7 w-7" onClick={() => void copy()} aria-label="Copy note"><Copy size={13} /></button><button data-no-drag className="industrial-button h-7 w-7 text-red-400" onClick={() => remove(active.id)} aria-label="Delete note"><Trash2 size={13} /></button></div><textarea data-no-drag className="min-h-0 flex-1 resize-none border-0 bg-transparent py-3 text-[12px] leading-relaxed text-ink outline-none placeholder:text-dim" value={active.content} onChange={(event) => updateActive({ content: event.target.value })} placeholder="Start writing…" />{active.image ? <div className="border signal-line bg-input p-2"><img src={active.image} alt="Saved generated image" className="max-h-40 max-w-full object-contain" /></div> : null}<div className="flex shrink-0 items-center justify-between border-t hairline pt-2 text-[9px] text-dim"><span>Last modified {dateLabel(active.updatedAt)}</span><span className="flex items-center gap-1"><Save size={11} />Local note</span></div></section> : <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center"><FilePenLine size={26} className="text-signal" /><p className="text-[11px] text-muted">No notes yet</p><button className="industrial-button industrial-button-primary h-8 px-3 text-[10px]" onClick={create}><Plus size={13} />Create note</button></section>}</div></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Notepad /></StrictMode>);
