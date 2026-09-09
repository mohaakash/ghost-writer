import { useEffect, useRef, useState } from "react";
import { applyAppearance, loadAppearance } from "./lib/appearance";
import { addClipboardItem, HISTORY_KEY, normalizeClipboardHistory, normalizeClipboardSettings, SETTINGS_KEY } from "./lib/clipboard-domain";
import { onAppearanceChanged, onClipboardCaptured, onSelectionCaptured } from "./lib/tauri-events";
import { copyImageToClipboard, generateImage, openClipboardWindow, openNotepadWindow, pasteText, processText, readClipboardText, sendClipboardCommand, startClipboardMonitor, writeToClipboard } from "./lib/tauri-commands";
import { currentWindow, startDragging } from "./lib/tauri";
import { generatedImageDataUrl } from "./lib/presentation-domain";
import { readJson, writeJson, type Note } from "./lib/storage";
import { providerNeedsKey, type AiSettings } from "./lib/ai-domain";
import { ClipboardSettings } from "./home-clipboard-settings";
import { GeneralSettings } from "./home-general";
import { getSelectedAiRequest, getSelectedImageRequest, loadStoredSettings, ModelsSettings, type PreferencesTab } from "./home-models";

type ToastType = "info" | "success" | "error";
type HomeView = "menu" | "loading" | "result" | "image-prompt" | "image-loading" | "image-result";
type ImageMode = "image" | "diagram";
type ResultAction = "standard" | "summarize";

type LegacyHomeWindow = Window & {
  useCopiedText?: () => void;
  handleAI?: (prompt?: string) => void;
  handleGenerateImage?: (mode?: string) => void;
  showView?: (view: string) => void;
  selectSettingsTab?: (tab: string) => void;
  changeLanguage?: (lang: string) => void;
};

interface HomePageProps {
  fallbackToLegacy: (view?: string) => void;
  modelsEnabled?: boolean;
  generalEnabled?: boolean;
  clipboardSettingsEnabled?: boolean;
  aiEnabled?: boolean;
}

const QUICK_ACTIONS = [
  { label: "Improve writing", icon: "auto_awesome", prompt: "Improve the writing while preserving the original meaning, facts, and voice.", iconClass: "ai-gradient-icon", labelKey: "improve_writing" },
  { label: "Fix grammar", icon: "spellcheck", prompt: "Check grammar and spelling in this text.", iconClass: "text-zinc-500 dark:text-zinc-400", labelKey: "fix_grammar" },
  { label: "Summarize text", icon: "summarize", prompt: "Summarize this text as concise bullet points. Include only ideas explicitly present in the text. Do not add facts, opinions, or explanations.", iconClass: "text-zinc-500 dark:text-zinc-400", labelKey: "summarize" },
  { label: "Rewrite for clarity", icon: "fact_check", prompt: "Rewrite this text for clarity and structure. Preserve the original meaning and all important details. Return only the rewritten text.", iconClass: "text-zinc-500 dark:text-zinc-400", labelKey: "rewrite_clearly" },
] as const;

const DIAGRAM_SYSTEM_PROMPT = `Create a clear, accurate visual diagram from the supplied text.

ROLE
You are a precise visual communication assistant. Turn the source text into a diagram that helps someone understand the relationships, sequence, structure, or hierarchy at a glance.

OBJECTIVE
Make the main idea understandable in a few seconds. Identify the important concepts, group related information, and show meaningful connections with readable labels and arrows.

PROCESS
Before drawing:
1. Identify the subject, key concepts, steps, and relationships explicitly present in the source text.
2. Preserve the source text’s facts, order, names, quantities, and distinctions.
3. Choose the diagram structure that best fits the content: flowchart, timeline, hierarchy, mind map, comparison, or labeled overview.
4. Generate one coherent visual composition.

VISUAL STYLE
Use a clean, professional, high-contrast layout with a clear title, consistent spacing, simple shapes, and legible typography. Use restrained color only when it improves grouping or comprehension. Keep the diagram suitable for sharing or printing.

ACCURACY RULES
Never invent facts, examples, steps, relationships, labels, or conclusions. Do not omit important source details. Do not add a separate explanation panel; integrate the necessary context directly into the diagram. If the source text does not contain enough information for a connection, leave the connection out. Keep all text readable and avoid decorative clutter.`;

const NOTES_KEY = "ghost_writer_notepad_v2";

function MaterialIcon({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-icons-outlined ${className}`.trim()} style={style}>{name}</span>;
}

function legacyText(key: string, fallback: string) {
  return document.querySelector(`[data-i18n="${key}"]`)?.textContent?.trim() || fallback;
}

function extractErrorMessage(error: unknown, fallback = "Request failed") {
  if (!error) return fallback;
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error) as { message?: unknown };
      if (parsed && typeof parsed.message === "string") return parsed.message;
    } catch { /* use the raw string */ }
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const value = error as { message?: unknown; error?: unknown };
    if (typeof value.message === "string") return value.message;
    if (value.error && typeof value.error === "object" && typeof (value.error as { message?: unknown }).message === "string") return (value.error as { message: string }).message;
  }
  return fallback;
}

function makeClipboardId() {
  return globalThis.crypto?.randomUUID?.() ?? `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function recordClipboardItem(text: string) {
  if (!text.trim()) return;
  const history = normalizeClipboardHistory(readJson<unknown>(HISTORY_KEY, []), makeClipboardId);
  const settings = normalizeClipboardSettings(readJson<unknown>(SETTINGS_KEY, {}));
  writeJson(HISTORY_KEY, addClipboardItem(history, text, makeClipboardId, Date.now(), settings.maxItems));
}

async function generatedImageAsPngBase64(dataUrl: string) {
  if (dataUrl.startsWith("data:image/png;")) return dataUrl.split(",")[1] ?? "";
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not decode generated image")); });
  image.src = dataUrl;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare generated image");
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

/** Home shell and AI flows staged against the existing index.html reference. */
export function HomePage({ fallbackToLegacy, modelsEnabled = false, generalEnabled = false, clipboardSettingsEnabled = false, aiEnabled = false }: HomePageProps) {
  const [capturedText, setCapturedText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [view, setView] = useState<HomeView>("menu");
  const [aiResult, setAiResult] = useState("");
  const [resultAction, setResultAction] = useState<ResultAction>("standard");
  const [manualSelection, setManualSelection] = useState(false);
  const [imageMode, setImageMode] = useState<ImageMode>("image");
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const selectionVersion = useRef(0);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<PreferencesTab>(modelsEnabled ? "models" : generalEnabled ? "general" : "clipboard");

  useEffect(() => {
    applyAppearance(loadAppearance());
    let selectionDispose: (() => void) | undefined;
    let clipboardDispose: (() => void) | undefined;
    let appearanceDispose: (() => void) | undefined;
    void onSelectionCaptured((text) => {
      selectionVersion.current += 1;
      setAiResult("");
      setGeneratedImage("");
      setManualSelection(false);
      setPrompt("");
      setSettingsOpen(false);
      const next = text || "";
      setCapturedText(next);
      setView("menu");
      if (!next.trim()) showToast("Could not capture selected text. Copy it in your source app, then choose Use copied text.", "info");
      else showToast(legacyText("text_captured_success", "Text captured successfully"), "success");
    }).then((dispose) => { selectionDispose = dispose; }).catch(() => {});
    void onClipboardCaptured((text) => {
      if (!text?.trim()) return;
      selectionVersion.current += 1;
      setCapturedText(text);
      setManualSelection(true);
    }).then((dispose) => { clipboardDispose = dispose; }).catch(() => {});
    void onAppearanceChanged((next) => applyAppearance(next)).then((dispose) => { appearanceDispose = dispose; }).catch(() => {});
    void startClipboardMonitor().catch(() => {});
    return () => { selectionDispose?.(); clipboardDispose?.(); appearanceDispose?.(); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message: string, type: ToastType = "info") {
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

  function selectSettingsTab(tab: PreferencesTab) {
    if (tab === "models" && modelsEnabled) { setSettingsTab("models"); return; }
    if (tab === "general" && generalEnabled) { setSettingsTab("general"); return; }
    if (tab === "clipboard" && clipboardSettingsEnabled) { setSettingsTab("clipboard"); return; }
    fallbackToLegacy("settings");
    window.setTimeout(() => (window as LegacyHomeWindow).selectSettingsTab?.(tab), 0);
  }

  function openSettingsForAi() {
    if (modelsEnabled) { setView("menu"); setSettingsTab("models"); setSettingsOpen(true); }
    else fallbackToLegacy("settings");
  }

  async function useCopiedText() {
    try {
      const text = await readClipboardText();
      if (!text?.trim()) { showToast("Copy some text first.", "info"); return; }
      selectionVersion.current += 1;
      setCapturedText(text);
      setAiResult("");
      setManualSelection(true);
      setView("menu");
      showToast("Text loaded. Copy the result to paste it back manually.", "info");
    } catch (error) { showToast(extractErrorMessage(error), "error"); }
  }

  async function handleAI(customPrompt?: string) {
    const settings: AiSettings = await loadStoredSettings();
    const selectedRequest = getSelectedAiRequest(settings);
    if (!selectedRequest) { showToast(legacyText("connect_provider_first", "Connect a provider and select a model first."), "error"); openSettingsForAi(); return; }
    if (providerNeedsKey(selectedRequest.provider) && !selectedRequest.api_key) { showToast(legacyText("connect_provider_first", "Connect a provider and select a model first."), "error"); openSettingsForAi(); return; }
    if (!capturedText.trim()) {
      let shortcut = "Ctrl+Shift+U";
      try { shortcut = localStorage.getItem("app_shortcut") || shortcut; } catch { /* use the default */ }
      showToast(legacyText("select_text_first", "Select text and press shortcut first").replace("{shortcut}", shortcut), "error");
      return;
    }
    const nextPrompt = customPrompt ?? prompt;
    if (!nextPrompt) return;
    setResultAction(nextPrompt.toLowerCase().includes("summarize") ? "summarize" : "standard");
    setAiResult("");
    setView("loading");
    const version = selectionVersion.current;
    try {
      const result = await processText({ text: capturedText, prompt: nextPrompt, api_key: selectedRequest.api_key, provider: selectedRequest.provider, model: selectedRequest.model, base_url: selectedRequest.base_url });
      if (version !== selectionVersion.current) { setAiResult(""); return; }
      setAiResult(result);
      setPrompt("");
      setView("result");
    } catch (error) {
      showToast(`AI Error: ${extractErrorMessage(error, "Request failed")}`, "error");
      setView("menu");
    }
  }

  async function generateImageFlow(mode: ImageMode = imageMode) {
    setImageMode(mode);
    const settings = await loadStoredSettings();
    const imageRequest = getSelectedImageRequest(settings);
    if (!imageRequest || (providerNeedsKey(imageRequest.provider) && !imageRequest.api_key)) {
      showToast(legacyText("connect_image_provider", "Connect an image-capable provider first."), "error");
      openSettingsForAi();
      return;
    }
    if (!capturedText.trim()) { showToast("Select text and use your app shortcut before generating an image or diagram.", "error"); return; }
    const finalPrompt = mode === "diagram" ? `${DIAGRAM_SYSTEM_PROMPT}\n\nSOURCE TEXT / NOTES / CONTEXT:\n${capturedText}` : capturedText;
    setView("image-loading");
    setGeneratedImage("");
    const version = selectionVersion.current;
    try {
      const base64 = await generateImage({ prompt: finalPrompt, apiKey: imageRequest.api_key, model: imageRequest.model, provider: imageRequest.provider, baseUrl: imageRequest.base_url });
      if (version !== selectionVersion.current) { setGeneratedImage(""); return; }
      setGeneratedImage(base64);
      setView("image-result");
    } catch (error) {
      showToast(`Generation Error: ${extractErrorMessage(error, "Generation failed")}`, "error");
      setView("menu");
    }
  }

  async function copyTextResult() {
    if (!aiResult) return;
    try {
      await writeToClipboard({ text: aiResult });
      recordClipboardItem(aiResult);
      await sendClipboardCommand({ command: "refresh" });
      showToast("Copied to Clipboard", "success");
    } catch (error) { showToast(extractErrorMessage(error), "error"); }
  }

  async function copySummary() {
    if (!aiResult) return;
    try {
      await writeToClipboard({ text: aiResult });
      recordClipboardItem(aiResult);
      await sendClipboardCommand({ command: "refresh" });
      showToast(legacyText("summary_copied", "Summary copied to clipboard"), "success");
      setCapturedText("");
      setAiResult("");
      setView("menu");
      await currentWindow()?.hide?.();
    } catch (error) { showToast(`Failed to copy: ${extractErrorMessage(error)}`, "error"); }
  }

  async function acceptResult() {
    if (manualSelection || !aiResult) return;
    try {
      await pasteText({ text: aiResult });
      setCapturedText("");
      setAiResult("");
      setView("menu");
      showToast(legacyText("applied_success", "Applied successfully"), "success");
    } catch (error) { showToast(`Paste Error: ${extractErrorMessage(error)}`, "error"); }
  }

  function rejectResult() {
    setAiResult("");
    setView("menu");
    showToast(legacyText("changes_discarded", "Changes discarded"), "info");
  }

  async function copyImageResult() {
    if (!generatedImage) return;
    try {
      const png = await generatedImageAsPngBase64(generatedImageDataUrl(generatedImage));
      await copyImageToClipboard({ base64Png: png });
      recordClipboardItem(`data:image/png;base64,${png}`);
      await sendClipboardCommand({ command: "refresh" });
      showToast("Image copied to Clipboard", "success");
    } catch (error) { showToast(extractErrorMessage(error), "error"); }
  }

  function downloadImage() {
    if (!generatedImage) return;
    try {
      const dataUrl = generatedImageDataUrl(generatedImage);
      const mimeType = dataUrl.match(/^data:(image\/[^;]+);/)?.[1] || "image/png";
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "png";
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `ghost-writer-generated.${extension}`;
      link.click();
      showToast("Image saved!", "success");
    } catch { showToast("Could not save image", "error"); }
  }

  function saveResultToNotepad(isImage: boolean) {
    if (isImage ? !generatedImage : !aiResult) return;
    try {
      const notes = readJson<Note[]>(NOTES_KEY, []);
      const now = new Date().toISOString();
      const note: Note = { id: globalThis.crypto?.randomUUID?.() ?? `note_${Date.now()}`, title: isImage ? (imageMode === "diagram" ? "Generated diagram" : "Generated image") : (resultAction === "summarize" ? "Summary" : "Improved writing"), content: isImage ? capturedText : aiResult, createdAt: now, updatedAt: now, ...(isImage ? { image: generatedImageDataUrl(generatedImage) } : {}) };
      writeJson(NOTES_KEY, [note, ...notes]);
      showToast("Saved to Notepad", "success");
      void openNotepadWindow();
    } catch (error) { showToast(`Could not save note: ${extractErrorMessage(error)}`, "error"); }
  }

  function handleDrag(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, a, select, textarea, #result-text")) return;
    void startDragging(event);
  }

  const hasCapturedText = Boolean(capturedText.trim());
  const capturedPreview = capturedText.length > 40 ? `${capturedText.substring(0, 40)}...` : capturedText;

  function menuAction(promptValue: string) { if (aiEnabled) void handleAI(promptValue); else runLegacy("ai", promptValue); }
  function copiedAction() { if (aiEnabled) void useCopiedText(); else runLegacy("copied"); }
  function imageAction(mode: ImageMode) { if (aiEnabled) void generateImageFlow(mode); else runLegacy(mode === "diagram" ? "diagram" : "image"); }

  return (
    <>
      <div id="floating-menu" data-tauri-drag-region className="w-full h-full flex flex-col glass-effect app-shell ios-shadow border border-white/20 dark:border-white/10 overflow-hidden relative" onMouseDown={handleDrag}>
        <div className="h-1 flexible-drag-region w-full" data-tauri-drag-region />
        <div className="flex-1 overflow-y-auto px-3 pb-16">
          {hasCapturedText ? <div id="captured-indicator" className="mb-3 px-3 py-2 bg-green-500/10 dark:bg-green-400/10 rounded-xl border border-green-500/20"><p className="text-[11px] text-green-600 dark:text-green-400 font-medium truncate flex items-center gap-2"><MaterialIcon name="content_paste" className="text-[14px]" /><span data-i18n="text_captured" id="captured-preview">{capturedPreview}</span></p></div> : null}
          {view === "menu" ? <div id="menu-view" className="view-container"><button type="button" onClick={copiedAction} className="text-xs text-primary mb-2">Use copied text</button><div className="mb-3 bg-white/40 dark:bg-zinc-800/40 rounded-xl p-3 flex items-center gap-3 border border-white/20 dark:border-zinc-700/30 group-focus-within:border-primary/50 transition-all"><MaterialIcon name="auto_awesome" className="ai-gradient-icon text-xl" /><input id="prompt-input" className="bg-transparent border-none focus:ring-0 p-0 text-[15px] placeholder-zinc-500 dark:text-white flex-1" data-i18n-placeholder="describe_change" placeholder={legacyText("prompt-input-placeholder", "Describe your change...")} type="text" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") menuAction(prompt); }} /></div><div className="px-1 mb-2"><p data-i18n="quick_actions" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500/80 tracking-widest uppercase">{legacyText("quick_actions", "Quick Actions")}</p></div><div className="space-y-1">{QUICK_ACTIONS.map((action) => <button key={action.labelKey} type="button" onClick={() => menuAction(action.prompt)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all group"><MaterialIcon name={action.icon} className={`text-[20px] ${action.iconClass}`} /><span data-i18n={action.labelKey} className={`text-[15px] text-zinc-800 dark:text-zinc-200${action.labelKey === "improve_writing" ? " font-medium" : ""}`}>{legacyText(action.labelKey, action.label)}</span></button>)}<button id="generate-image-btn" type="button" onClick={() => imageAction("image")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all"><MaterialIcon name="image" className="text-[20px] text-pink-400" /><span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Generate Image</span></button><button id="generate-diagram-btn" type="button" onClick={() => imageAction("diagram")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all"><MaterialIcon name="account_tree" className="text-[20px] text-violet-400" /><span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Generate Diagram</span></button><button id="open-notepad-btn" type="button" onClick={() => openWindow(openNotepadWindow, "Notepad")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all"><MaterialIcon name="edit_note" className="text-[20px] text-amber-400" /><span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Notepad</span></button><button id="open-clipboard-btn" type="button" onClick={() => openWindow(openClipboardWindow, "Clipboard")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/30 dark:hover:bg-white/5 transition-all"><MaterialIcon name="content_paste" className="text-[20px] text-sky-400" /><span className="text-[15px] text-zinc-800 dark:text-zinc-200 font-medium">Clipboard</span></button></div></div> : null}
          {view === "loading" ? <div id="loading-view" className="py-12 text-center animate-pulse"><MaterialIcon name="auto_awesome" className="ai-gradient-icon text-5xl animate-spin mb-4" /><p data-i18n="synthesizing" className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Synthesizing with AI...</p></div> : null}
          {view === "result" ? <div id="result-view" className="view-container"><div className="px-1 mb-2"><p data-i18n="proposed_change" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500/80 tracking-widest uppercase">Proposed Change</p></div><div id="result-text" className="p-4 bg-white/40 dark:bg-zinc-800/40 rounded-2xl border border-white/20 dark:border-zinc-700/30 text-[14px] text-zinc-800 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap shadow-inner overflow-hidden">{aiResult}</div><div id="standard-result-actions" className={resultAction === "summarize" ? "hidden grid grid-cols-2 gap-3 mt-4" : "grid grid-cols-2 gap-3 mt-4"}><button type="button" onClick={rejectResult} className="flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 rounded-xl transition-all font-bold text-sm border border-red-500/10"><span data-i18n="reject">Reject</span></button><button id="accept-btn" type="button" onClick={() => void acceptResult()} disabled={manualSelection} title={manualSelection ? "Use Copy result, then paste into your source app" : "Replace selected text"} className="flex items-center justify-center gap-2 py-3 bg-green-500/10 hover:bg-green-500/15 text-green-600 dark:text-green-400 rounded-xl transition-all font-bold text-sm border border-green-500/10 disabled:cursor-not-allowed" style={{ opacity: manualSelection ? 0.4 : 1 }}><span data-i18n="accept">Accept</span></button></div><div className="flex gap-3 mt-3 text-xs text-primary"><button type="button" onClick={() => saveResultToNotepad(false)}>Save to Notepad</button><button type="button" onClick={() => void copyTextResult()}>Copy result</button></div><div id="summarize-result-actions" className={resultAction === "summarize" ? "grid grid-cols-1 mt-4" : "hidden grid grid-cols-1 mt-4"}><button type="button" onClick={() => void copySummary()} className="flex items-center justify-center gap-2 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all font-bold text-sm border border-primary/10"><MaterialIcon name="content_copy" className="text-[18px]" /><span data-i18n="copy_clipboard">Copy to Clipboard</span></button><button type="button" onClick={rejectResult} data-i18n="close" className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all">Close</button></div></div> : null}
          {view === "image-prompt" ? <div id="image-prompt-view" className="view-container animate-in fade-in slide-in-from-right-4 duration-300"><div className="flex items-center gap-3 mb-4 px-1"><button type="button" onClick={() => setView("menu")} className="p-1.5 hover:bg-zinc-500/10 rounded-full transition-all"><MaterialIcon name="arrow_back" className="text-zinc-600 dark:text-zinc-400" /></button><h2 id="image-prompt-title" className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">{imageMode === "diagram" ? "Generate Diagram" : "Generate Image"}</h2></div><div className="px-1 space-y-3"><p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed" id="image-prompt-hint">Describe the image you want to generate.</p><textarea id="image-prompt-input" rows={6} placeholder="Describe the image in detail..." value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} className="w-full bg-white/40 dark:bg-zinc-800/40 border border-white/20 dark:border-zinc-700/30 rounded-2xl px-4 py-3 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 resize-none focus:outline-none focus:border-primary/30 transition-all" /><button type="button" onClick={() => void generateImageFlow()} className="w-full py-3 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 hover:shadow-pink-500/40 transition-all"><MaterialIcon name="auto_awesome" className="text-[18px]" />Generate image</button></div></div> : null}
          {view === "image-loading" ? <div id="image-loading-view" className="py-12 text-center"><div className="flex flex-col items-center gap-4"><MaterialIcon name="auto_awesome" className="text-5xl animate-spin" style={{ background: "linear-gradient(135deg,#f472b6,#a78bfa)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }} /><p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Generating image...</p><p className="text-[11px] text-zinc-400 dark:text-zinc-500">Using your selected image model</p></div></div> : null}
          {view === "image-result" ? <div id="image-result-view" className="view-container animate-in fade-in duration-300"><div className="flex items-center gap-3 mb-3 px-1"><button type="button" onClick={() => setView("menu")} className="p-1.5 hover:bg-zinc-500/10 rounded-full transition-all"><MaterialIcon name="arrow_back" className="text-zinc-600 dark:text-zinc-400" /></button><h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">Generated Image</h2></div><div className="rounded-2xl overflow-hidden border border-white/20 dark:border-zinc-700/30 bg-zinc-100 dark:bg-zinc-800/40 mb-3 flex max-h-[220px] items-center justify-center"><img id="generated-image-preview" src={generatedImageDataUrl(generatedImage)} alt="Generated image" className="block max-h-[220px] max-w-full object-contain" /></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => void copyImageResult()} className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-pink-500/80 to-violet-500/80 text-white rounded-xl font-bold text-sm shadow-lg transition-all hover:from-pink-500 hover:to-violet-500"><MaterialIcon name="content_paste" className="text-[18px]" />Copy Image</button><button type="button" onClick={downloadImage} className="flex items-center justify-center gap-2 py-3 bg-white/30 dark:bg-zinc-700/30 text-zinc-800 dark:text-zinc-200 rounded-xl font-bold text-sm border border-white/20 dark:border-zinc-700/30 transition-all hover:bg-white/50 dark:hover:bg-zinc-700/50"><MaterialIcon name="download" className="text-[18px]" />Download</button></div><button type="button" onClick={() => saveResultToNotepad(true)} className="mt-3 w-full text-xs text-primary py-2">Save to Notepad</button><button type="button" onClick={() => void generateImageFlow(imageMode)} className="mt-2 w-full text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all py-1">↩ Generate another</button></div> : null}
        </div>
        <button id="settings-toggle" type="button" onClick={() => { if (modelsEnabled || generalEnabled || clipboardSettingsEnabled) { setSettingsTab(modelsEnabled ? "models" : generalEnabled ? "general" : "clipboard"); setSettingsOpen(true); } else fallbackToLegacy("settings"); }} aria-label="Preferences" title="Preferences" className={`${view === "menu" ? "" : "hidden "}absolute bottom-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/60 text-primary shadow-lg shadow-black/10 backdrop-blur-md transition-all hover:scale-105 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-zinc-800/80 dark:hover:bg-primary/15`}><MaterialIcon name="settings" className="text-[19px]" /></button>
        <div id="react-home-toast" className={toast ? "fixed bottom-4 left-4 right-4 z-[9999] toast-animate-in" : "hidden fixed bottom-4 left-4 right-4 z-[9999]"}><div id="toast-content" className="glass-effect bg-black/80 dark:bg-zinc-900/90 text-white rounded-2xl p-4 flex items-center gap-3 shadow-2xl border border-white/10"><MaterialIcon name={toast?.type === "error" ? "error_outline" : toast?.type === "success" ? "check_circle_outline" : "info"} className={toast?.type === "error" ? "text-red-400" : toast?.type === "success" ? "text-green-400" : "text-blue-400"} /><span className="text-sm font-medium flex-1">{toast?.message ?? ""}</span></div></div>
      </div>
      {settingsOpen && settingsTab === "models" && modelsEnabled ? <ModelsSettings onClose={() => setSettingsOpen(false)} fallbackToLegacy={fallbackToLegacy} onSelectTab={selectSettingsTab} showToast={showToast} /> : null}
      {settingsOpen && settingsTab === "general" && generalEnabled ? <GeneralSettings onClose={() => setSettingsOpen(false)} fallbackToLegacy={fallbackToLegacy} onSelectTab={selectSettingsTab} showToast={showToast} /> : null}
      {settingsOpen && settingsTab === "clipboard" && clipboardSettingsEnabled ? <ClipboardSettings onClose={() => setSettingsOpen(false)} fallbackToLegacy={fallbackToLegacy} onSelectTab={selectSettingsTab} showToast={showToast} /> : null}
    </>
  );
}
