import { useEffect, useState } from "react";
import { applyAppearance, loadAppearance } from "./lib/appearance";
import { onAppearanceChanged, onClipboardCaptured, onSelectionCaptured } from "./lib/tauri-events";
import { openClipboardWindow, openNotepadWindow, startClipboardMonitor } from "./lib/tauri-commands";
import { startDragging } from "./lib/tauri";
import { ModelsSettings } from "./home-models";

type LegacyHomeWindow = Window & {
  useCopiedText?: () => void;
  handleAI?: (prompt?: string) => void;
  handleGenerateImage?: (mode?: string) => void;
  showView?: (view: string) => void;
  selectSettingsTab?: (tab: string) => void;
};

interface HomePageProps {
  fallbackToLegacy: (view?: string) => void;
  modelsEnabled?: boolean;
}

const QUICK_ACTIONS = [
  { label: "Improve writing", icon: "auto_awesome", prompt: "Improve the writing while preserving the original meaning, facts, and voice.", iconClass: "ai-gradient-icon", labelKey: "improve_writing" },
  { label: "Fix grammar", icon: "spellcheck", prompt: "Check grammar and spelling in this text.", iconClass: "text-zinc-500 dark:text-zinc-400", labelKey: "fix_grammar" },
  { label: "Summarize text", icon: "summarize", prompt: "Summarize this text as concise bullet points. Include only ideas explicitly present in the text. Do not add facts, opinions, or explanations.", iconClass: "text-zinc-500 dark:text-zinc-400", labelKey: "summarize" },
  { label: "Rewrite for clarity", icon: "fact_check", prompt: "Rewrite this text for clarity and structure. Preserve the original meaning and all important details. Return only the rewritten text.", iconClass: "text-zinc-500 dark:text-zinc-400", labelKey: "rewrite_clearly" },
] as const;

function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-icons-outlined ${className}`.trim()}>{name}</span>;
}

function legacyText(key: string, fallback: string) {
  return document.querySelector(`[data-i18n="${key}"]`)?.textContent?.trim() || fallback;
}

/** Home menu shell staged against the existing index.html reference. */
export function HomePage({ fallbackToLegacy, modelsEnabled = false }: HomePageProps) {
  const [capturedText, setCapturedText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "error" } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    applyAppearance(loadAppearance());
    let selectionDispose: (() => void) | undefined;
    let clipboardDispose: (() => void) | undefined;
    let appearanceDispose: (() => void) | undefined;
    void onSelectionCaptured((text) => setCapturedText(text || ""))
      .then((dispose) => { selectionDispose = dispose; }).catch(() => {});
    void onClipboardCaptured((text) => { if (text?.trim()) setCapturedText(text); })
      .then((dispose) => { clipboardDispose = dispose; }).catch(() => {});
    void onAppearanceChanged((next) => applyAppearance(next))
      .then((dispose) => { appearanceDispose = dispose; }).catch(() => {});
    void startClipboardMonitor().catch(() => {});
    return () => {
      selectionDispose?.();
      clipboardDispose?.();
      appearanceDispose?.();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string, type: "info" | "success" | "error" = "info") {
    setToast({ message, type });
  }

  function runLegacy(action: "copied" | "ai" | "image" | "diagram", value?: string) {
    fallbackToLegacy();
    window.setTimeout(() => {
      const legacy = window as LegacyHomeWindow;
      if (action === "copied") legacy.useCopiedText?.();
      else if (action === "ai") legacy.handleAI?.(value);
      else legacy.handleGenerateImage?.(action === "diagram" ? "diagram" : "image");
    }, 0);
  }

  function openWindow(open: () => Promise<unknown>, label: string) {
    void open().catch(() => showToast(`Could not open ${label}`, "error"));
  }

  function handleDrag(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, a, select, textarea, #result-text")) return;
    void startDragging(event);
  }

  const hasCapturedText = Boolean(capturedText.trim());
  const legacy = window as LegacyHomeWindow;

  return (
    <>
      <div
        id="floating-menu"
        data-tauri-drag-region
        className="w-full h-full flex flex-col glass-effect app-shell ios-shadow border border-white/20 dark:border-white/10 overflow-hidden relative"
        onMouseDown={handleDrag}
      >
        <div className="h-1 flexible-drag-region w-full" data-tauri-drag-region />
        <div className="flex-1 overflow-y-auto px-3 pb-16">
          {hasCapturedText ? (
            <div id="captured-indicator" className="mb-3 px-3 py-2 bg-green-500/10 dark:bg-green-400/10 rounded-xl border border-green-500/20">
              <p className="text-[11px] text-green-600 dark:text-green-400 font-medium truncate flex items-center gap-2">
                <MaterialIcon name="content_paste" className="text-[14px]" />
                <span data-i18n="text_captured" id="captured-preview">{legacyText("text_captured", "Text captured")}</span>
              </p>
            </div>
          ) : null}

          <div id="menu-view" className="view-container">
            <button type="button" onClick={() => runLegacy("copied")} className="text-xs text-primary mb-2">Use copied text</button>
            <div className="mb-3 bg-white/40 dark:bg-zinc-800/40 rounded-xl p-3 flex items-center gap-3 border border-white/20 dark:border-zinc-700/30 group-focus-within:border-primary/50 transition-all">
              <MaterialIcon name="auto_awesome" className="ai-gradient-icon text-xl" />
              <input
                id="prompt-input"
                className="bg-transparent border-none focus:ring-0 p-0 text-[15px] placeholder-zinc-500 dark:text-white flex-1"
                data-i18n-placeholder="describe_change"
                placeholder={legacyText("prompt-input-placeholder", "Describe your change...")}
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") runLegacy("ai", prompt); }}
              />
            </div>

            <div className="px-1 mb-2">
              <p data-i18n="quick_actions" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500/80 tracking-widest uppercase">{legacyText("quick_actions", "Quick Actions")}</p>
            </div>
            <div className="space-y-1">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.labelKey} type="button" onClick={() => runLegacy("ai", action.prompt)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all group">
                  <MaterialIcon name={action.icon} className={`text-[20px] ${action.iconClass}`} />
                  <span data-i18n={action.labelKey} className={`text-[15px] text-zinc-800 dark:text-zinc-200${action.labelKey === "improve_writing" ? " font-medium" : ""}`}>{legacyText(action.labelKey, action.label)}</span>
                </button>
              ))}
              <button id="generate-image-btn" type="button" onClick={() => runLegacy("image")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all">
                <MaterialIcon name="image" className="text-[20px] text-pink-400" />
                <span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Generate Image</span>
              </button>
              <button id="generate-diagram-btn" type="button" onClick={() => runLegacy("diagram")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all">
                <MaterialIcon name="account_tree" className="text-[20px] text-violet-400" />
                <span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Generate Diagram</span>
              </button>
              <button id="open-notepad-btn" type="button" onClick={() => openWindow(openNotepadWindow, "Notepad")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all">
                <MaterialIcon name="edit_note" className="text-[20px] text-amber-400" />
                <span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Notepad</span>
              </button>
              <button id="open-clipboard-btn" type="button" onClick={() => openWindow(openClipboardWindow, "Clipboard")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all">
                <MaterialIcon name="content_paste" className="text-[20px] text-sky-400" />
                <span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Clipboard</span>
              </button>
            </div>
          </div>
        </div>

        <button id="settings-toggle" type="button" onClick={() => modelsEnabled ? setSettingsOpen(true) : fallbackToLegacy("settings")} aria-label="Preferences" title="Preferences" className="absolute bottom-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/60 text-primary shadow-lg shadow-black/10 backdrop-blur-md transition-all hover:scale-105 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-zinc-800/80 dark:hover:bg-primary/15">
          <MaterialIcon name="settings" className="text-[19px]" />
        </button>

        <div id="react-home-toast" className={toast ? "fixed bottom-4 left-4 right-4 z-[9999] toast-animate-in" : "hidden fixed bottom-4 left-4 right-4 z-[9999]"}>
          <div id="toast-content" className="glass-effect bg-black/80 dark:bg-zinc-900/90 text-white rounded-2xl p-4 flex items-center gap-3 shadow-2xl border border-white/10">
            <MaterialIcon name={toast?.type === "error" ? "error_outline" : toast?.type === "success" ? "check_circle_outline" : "info"} className={toast?.type === "error" ? "text-red-400" : toast?.type === "success" ? "text-green-400" : "text-blue-400"} />
            <span className="text-sm font-medium flex-1">{toast?.message ?? ""}</span>
          </div>
        </div>
      </div>
      {settingsOpen ? <ModelsSettings onClose={() => setSettingsOpen(false)} fallbackToLegacy={(view) => { fallbackToLegacy(view); }} showToast={showToast} /> : null}
    </>
  );
}
