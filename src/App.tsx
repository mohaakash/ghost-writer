import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clipboard,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePenLine,
  Image as ImageIcon,
  Keyboard,
  Languages,
  ListTree,
  LoaderCircle,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings2,
  Sparkles,
  SpellCheck,
  Sun,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { APPEARANCE_KEY, applyAppearance, loadAppearance, saveAppearance, type AppearanceSettings } from "./lib/appearance";
import { invoke, listen, startDragging } from "./lib/tauri";
import { HISTORY_KEY, readJson, trimHistory, writeJson, type ClipboardItem, type Note } from "./lib/storage";

type View = "menu" | "settings" | "result" | "image-prompt" | "image-loading" | "image-result";
type SettingsTab = "models" | "general" | "clipboard";
type ImageMode = "image" | "diagram";

interface ProviderConfig {
  key?: string;
  encryptedKey?: string;
  baseUrl?: string;
  modelId?: string;
  imageModelId?: string;
}

interface AiSettings {
  selectedProvider: string;
  selectedModel: string;
  selectedImageProvider: string;
  selectedImageModel: string;
  providers: Record<string, ProviderConfig>;
}

interface ProviderInfo {
  id: string;
  label: string;
  kind: string;
  defaultModel: string;
  imageModel?: string;
  baseUrl?: string;
}

const AI_SETTINGS_KEY = "ghost_writer_ai_settings_v3";
const LEGACY_AI_SETTINGS_KEY = "ghost_writer_ai_settings_enc";
const LEGACY_LUMINUS_SETTINGS_KEY = "luminus_ai_settings_enc";
const APP_SHORTCUT_KEY = "app_shortcut";
const CLIPBOARD_SHORTCUT_KEY = "clipboard_shortcut";
const NOTES_KEY = "ghost_writer_notepad_v2";

const PROVIDERS = [
  { id: "openai", label: "OpenAI", kind: "Cloud", defaultModel: "gpt-4.1-mini", imageModel: "gpt-image-2" },
  { id: "anthropic", label: "Anthropic", kind: "Cloud", defaultModel: "claude-3-5-sonnet-latest" },
  { id: "google", label: "Google Gemini", kind: "Cloud", defaultModel: "gemini-2.0-flash" },
  { id: "xai", label: "xAI", kind: "Cloud", defaultModel: "grok-3-mini" },
  { id: "cerebras", label: "Cerebras", kind: "Cloud", defaultModel: "llama-3.3-70b" },
  { id: "groq", label: "Groq", kind: "Cloud", defaultModel: "llama-3.3-70b-versatile" },
  { id: "deepseek", label: "DeepSeek", kind: "Cloud", defaultModel: "deepseek-chat" },
  { id: "mistral", label: "Mistral", kind: "Cloud", defaultModel: "mistral-small-latest" },
  { id: "openrouter", label: "OpenRouter", kind: "Cloud", defaultModel: "openai/gpt-4.1-mini" },
  { id: "ollama", label: "Ollama", kind: "Local", defaultModel: "llama3.2", baseUrl: "http://localhost:11434/v1" },
  { id: "lmstudio", label: "LM Studio", kind: "Local", defaultModel: "local-model", baseUrl: "http://localhost:1234/v1" },
  { id: "mlx", label: "MLX", kind: "Local", defaultModel: "local-model", baseUrl: "http://127.0.0.1:8080/v1" },
  { id: "openai-compatible", label: "Custom endpoint", kind: "Custom", defaultModel: "model", baseUrl: "http://localhost:8000/v1" },
];

const QUICK_ACTIONS: Array<{ label: string; prompt: string; icon: typeof Sparkles }> = [
  { label: "Improve writing", prompt: "Improve the writing while preserving the original meaning, facts, and voice.", icon: WandSparkles },
  { label: "Fix grammar", prompt: "Check grammar and spelling in this text.", icon: SpellCheck },
  { label: "Summarize text", prompt: "Summarize this text as concise bullet points. Include only ideas explicitly present in the text. Do not add facts, opinions, or explanations.", icon: ListTree },
  { label: "Rewrite for clarity", prompt: "Rewrite this text for clarity and structure. Preserve the original meaning and all important details. Return only the rewritten text.", icon: FilePenLine },
];

function defaultAiSettings(): AiSettings {
  return { selectedProvider: "openai", selectedModel: "gpt-4.1-mini", selectedImageProvider: "openai", selectedImageModel: "gpt-image-2", providers: {} };
}

function loadAiSettings(): AiSettings {
  const stored = readJson<Partial<AiSettings>>(AI_SETTINGS_KEY, {});
  return { ...defaultAiSettings(), ...stored, providers: stored.providers ?? {} };
}

function providerInfo(id: string): ProviderInfo {
  return PROVIDERS.find((provider) => provider.id === id) ?? { id, label: "Custom endpoint", kind: "Custom", defaultModel: "model" };
}

function isLocalProvider(id: string) {
  return ["ollama", "lmstudio", "mlx", "openai-compatible"].includes(id) || id.startsWith("custom:");
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function ShellHeader({ title, icon: Icon, onClose }: { title: string; icon: typeof Sparkles; onClose?: () => void }) {
  return (
    <header className="drag-region flex h-11 shrink-0 items-center justify-between border-b hairline px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={15} strokeWidth={1.8} className="text-signal" />
        <span className="truncate text-[12px] font-semibold uppercase tracking-[0.18em] text-ink">{title}</span>
      </div>
      {onClose ? <button data-no-drag className="industrial-button h-7 w-7" onClick={onClose} aria-label="Close"><X size={14} /></button> : null}
    </header>
  );
}

function Toast({ message, kind = "info", onDismiss }: { message: string; kind?: "info" | "success" | "error"; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 3000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);
  const Icon = kind === "error" ? CircleAlert : kind === "success" ? CircleCheck : CircleCheck;
  return <div className="toast-enter fixed bottom-3 left-3 right-3 z-50 flex items-center gap-2 border border-signal/30 bg-raised px-3 py-2 text-[11px] text-ink shadow-2xl"><Icon size={14} className={kind === "error" ? "text-red-400" : "text-signal"} /><span className="min-w-0 flex-1 truncate">{message}</span><button className="text-dim hover:text-ink" onClick={onDismiss}><X size={13} /></button></div>;
}

export default function App() {
  const [view, setView] = useState<View>("menu");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("models");
  const [capturedText, setCapturedText] = useState("");
  const [manualSelection, setManualSelection] = useState(false);
  const selectionVersion = useRef(0);
  const [prompt, setPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [resultKind, setResultKind] = useState<"standard" | "summary">("standard");
  const [imageMode, setImageMode] = useState<ImageMode>("image");
  const [generatedImage, setGeneratedImage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "info" | "success" | "error" } | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings>(loadAiSettings);
  const [appearance, setAppearance] = useState<AppearanceSettings>(loadAppearance);
  const [clipboardSettings, setClipboardSettings] = useState(() => ({ autoCapture: true, maxItems: 50, ...readJson<Partial<{ autoCapture: boolean; maxItems: number }>>("ghost_writer_clipboard_settings_v1", {}) }));
  const [shortcut, setShortcut] = useState(() => localStorage.getItem(APP_SHORTCUT_KEY) || "Ctrl+Shift+U");
  const [clipboardShortcut, setClipboardShortcut] = useState(() => localStorage.getItem(CLIPBOARD_SHORTCUT_KEY) || "Ctrl+Shift+V");
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  const currentProvider = providerInfo(aiSettings.selectedProvider);
  const selectedConfig = aiSettings.providers[aiSettings.selectedProvider] ?? {};
  const hasCapturedText = Boolean(capturedText.trim());

  useEffect(() => {
    applyAppearance(appearance);
    const onAppearance = (event: Event) => setAppearance((event as CustomEvent<AppearanceSettings>).detail);
    const onStorage = (event: StorageEvent) => { if (event.key === APPEARANCE_KEY) { const next = loadAppearance(); applyAppearance(next); setAppearance(next); } };
    window.addEventListener("appearancechange", onAppearance);
    window.addEventListener("storage", onStorage);
    let selectionUnlisten: (() => void) | undefined;
    let clipboardUnlisten: (() => void) | undefined;
    let appearanceUnlisten: (() => void) | undefined;
    void listen<string>("selection-captured", (text) => { selectionVersion.current += 1; setCapturedText(text || ""); setManualSelection(false); setView("menu"); }).then((dispose) => { selectionUnlisten = dispose; }).catch(() => {});
    void listen<string>("clipboard-captured", (text) => { if (text?.trim()) { selectionVersion.current += 1; setCapturedText(text); setManualSelection(true); } }).then((dispose) => { clipboardUnlisten = dispose; }).catch(() => {});
    void listen<AppearanceSettings>("appearance-changed", (next) => { applyAppearance(next); setAppearance(next); }).then((dispose) => { appearanceUnlisten = dispose; }).catch(() => {});
    void invoke("start_clipboard_monitor").catch(() => {});
    return () => { window.removeEventListener("appearancechange", onAppearance); window.removeEventListener("storage", onStorage); selectionUnlisten?.(); clipboardUnlisten?.(); appearanceUnlisten?.(); };
  }, []);

  // Read the encrypted settings format used by the vanilla client once. This keeps
  // existing provider connections and model choices intact after upgrading.
  useEffect(() => {
    if (localStorage.getItem(AI_SETTINGS_KEY)) return;
    const legacy = localStorage.getItem(LEGACY_AI_SETTINGS_KEY) || localStorage.getItem(LEGACY_LUMINUS_SETTINGS_KEY);
    if (!legacy) return;
    void (async () => {
      try {
        const decoded = await invoke<string>("decrypt_data", { encrypted_data: legacy });
        const old = JSON.parse(decoded) as { selectedProvider?: string; selectedModel?: string; selectedEndpointId?: string; imageProvider?: string; imageModel?: string; imageEndpointId?: string; providerKeys?: Record<string, string>; providerConfig?: Record<string, ProviderConfig>; customEndpoints?: Array<{ id: string; baseUrl?: string; modelId?: string; imageModelId?: string }> };
        const providers: Record<string, ProviderConfig> = {};
        for (const [id, key] of Object.entries(old.providerKeys ?? {})) {
          const config = old.providerConfig?.[id] ?? {};
          let encryptedKey: string | undefined;
          try { encryptedKey = await invoke<string>("encrypt_data", { data: key }); } catch { /* browser preview */ }
          providers[id] = encryptedKey ? { ...config, encryptedKey } : config;
        }
        for (const endpoint of old.customEndpoints ?? []) {
          const id = `custom:${endpoint.id}`;
          const config = { baseUrl: endpoint.baseUrl, modelId: endpoint.modelId, imageModelId: endpoint.imageModelId };
          const key = old.providerKeys?.[id];
          if (key) {
            try { config.modelId = config.modelId || "model"; const encryptedKey = await invoke<string>("encrypt_data", { data: key }); providers[id] = { ...config, encryptedKey }; } catch { providers[id] = config; }
          } else providers[id] = config;
        }
        const selectedProvider = old.selectedProvider === "custom-endpoint" && old.selectedEndpointId ? `custom:${old.selectedEndpointId}` : old.selectedProvider || "openai";
        const selectedImageProvider = old.imageProvider === "custom-endpoint" && old.imageEndpointId ? `custom:${old.imageEndpointId}` : old.imageProvider || selectedProvider;
        if (old.selectedModel && providers[selectedProvider]) providers[selectedProvider].modelId = old.selectedModel;
        if (old.imageModel && providers[selectedImageProvider]) providers[selectedImageProvider].imageModelId = old.imageModel;
        const next: AiSettings = { ...defaultAiSettings(), selectedProvider, selectedModel: old.selectedModel || "gpt-4.1-mini", selectedImageProvider, selectedImageModel: old.imageModel || "gpt-image-2", providers };
        persistAiSettings(next);
      } catch { /* A malformed legacy value should not block the new UI. */ }
    })();
  }, []);

  function notify(message: string, kind: "info" | "success" | "error" = "info") { setToast({ message, kind }); }

  function persistAiSettings(next: AiSettings) { setAiSettings(next); writeJson(AI_SETTINGS_KEY, next); }

  async function selectedKey(providerId = aiSettings.selectedProvider) {
    const config = aiSettings.providers[providerId] ?? {};
    if (config.encryptedKey) {
      try { return await invoke<string>("decrypt_data", { encrypted_data: config.encryptedKey }); } catch { return ""; }
    }
    return config.key ?? "";
  }

  async function aiRequest() {
    const key = await selectedKey();
    return { provider: aiSettings.selectedProvider, model: aiSettings.selectedModel || currentProvider.defaultModel, apiKey: key, baseUrl: selectedConfig.baseUrl };
  }

  async function handleAI(requestPrompt: string) {
    if (!hasCapturedText) { notify("Select text and press the shortcut first", "error"); return; }
    const version = selectionVersion.current;
    setResultKind(requestPrompt.toLowerCase().includes("summarize") ? "summary" : "standard");
    setIsBusy(true); setView("result"); setAiResult("");
    try {
      const request = await aiRequest();
      if (!isLocalProvider(request.provider) && !request.apiKey.trim()) { setView("menu"); notify(`${currentProvider.label} API key is not configured`, "error"); return; }
      const result = await invoke<string>("process_text", { request: { text: capturedText, prompt: requestPrompt, api_key: request.apiKey, provider: request.provider, model: request.model, base_url: request.baseUrl } });
      if (version !== selectionVersion.current) { setView("menu"); return; }
      setAiResult(result);
      setPrompt("");
    } catch (error) { setView("menu"); notify(formatError(error), "error"); }
    finally { setIsBusy(false); }
  }

  async function useCopiedText() {
    try {
      const text = await invoke<string>("read_clipboard_text");
      if (!text?.trim()) { notify("Clipboard is empty", "error"); return; }
      selectionVersion.current += 1; setCapturedText(text); setManualSelection(true); notify("Text captured", "success");
    } catch (error) { notify(formatError(error), "error"); }
  }

  async function copyText(text: string) {
    try {
      await invoke("write_to_clipboard", { text });
      const history = readJson<ClipboardItem[]>(HISTORY_KEY, []);
      if (!history.some((item) => item.text === text)) writeJson(HISTORY_KEY, trimHistory([{ id: `clip_${Date.now()}`, text, createdAt: Date.now() }, ...history], clipboardSettings.maxItems));
      notify("Copied to clipboard", "success");
    }
    catch (error) { notify(formatError(error), "error"); }
  }

  async function acceptResult() {
    if (!aiResult) return;
    if (manualSelection) { await copyText(aiResult); setView("menu"); return; }
    try { await invoke("paste_text", { text: aiResult }); notify("Applied successfully", "success"); setView("menu"); }
    catch (error) { notify(formatError(error), "error"); }
  }

  async function generateImage(mode: ImageMode = imageMode) {
    if (!hasCapturedText) { notify("Select text before generating an image", "error"); return; }
    setImageMode(mode); setView("image-loading"); setIsBusy(true);
    try {
      const config = aiSettings.providers[aiSettings.selectedImageProvider] ?? {};
      const key = await selectedKey(aiSettings.selectedImageProvider);
      if (!isLocalProvider(aiSettings.selectedImageProvider) && !key.trim()) { setView("menu"); notify(`${providerInfo(aiSettings.selectedImageProvider).label} API key is not configured`, "error"); return; }
      const context = mode === "diagram" ? `Create a clear diagram that represents the following text. Do not add facts.\n\n${capturedText}` : `${capturedText}${prompt ? `\n\nAdditional direction: ${prompt}` : ""}`;
      const result = await invoke<string>("generate_image", { prompt: context, api_key: key, model: aiSettings.selectedImageModel, provider: aiSettings.selectedImageProvider, base_url: config.baseUrl });
      setGeneratedImage(result); setView("image-result");
    } catch (error) { setView("menu"); notify(formatError(error), "error"); }
    finally { setIsBusy(false); }
  }

  async function copyImage() {
    if (!generatedImage) return;
    try {
      await invoke("copy_image_to_clipboard", { base64_png: generatedImage });
      const history = readJson<ClipboardItem[]>(HISTORY_KEY, []);
      if (!history.some((item) => item.text === generatedImage)) writeJson(HISTORY_KEY, trimHistory([{ id: `clip_${Date.now()}`, text: generatedImage, createdAt: Date.now() }, ...history], clipboardSettings.maxItems));
      notify("Image copied to clipboard", "success");
    }
    catch (error) { notify(formatError(error), "error"); }
  }

  function downloadImage() {
    if (!generatedImage) return;
    const link = document.createElement("a"); link.href = generatedImage; link.download = `ghost-writer-${Date.now()}.png`; link.click();
  }

  function saveImageToNotepad() {
    const notes = readJson<Note[]>(NOTES_KEY, []);
    const now = new Date().toISOString();
    writeJson(NOTES_KEY, [{ id: `note_${Date.now()}`, title: imageMode === "diagram" ? "Generated diagram" : "Generated image", content: "", image: generatedImage, createdAt: now, updatedAt: now }, ...notes]);
    void invoke("open_notepad_window").catch(() => {}); notify("Saved to Notepad", "success");
  }

  function saveTextToNotepad() {
    if (!aiResult) return;
    const notes = readJson<Note[]>(NOTES_KEY, []);
    const now = new Date().toISOString();
    writeJson(NOTES_KEY, [{ id: `note_${Date.now()}`, title: "AI result", content: aiResult, createdAt: now, updatedAt: now }, ...notes]);
    void invoke("open_notepad_window").catch(() => {}); notify("Saved to Notepad", "success");
  }

  function updateProvider(id: string, patch: Partial<ProviderConfig>) {
    const next = { ...aiSettings, providers: { ...aiSettings.providers, [id]: { ...(aiSettings.providers[id] ?? {}), ...patch } } };
    persistAiSettings(next);
  }

  async function saveProviderKey(id: string, value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    let encryptedKey: string;
    try { encryptedKey = await invoke<string>("encrypt_data", { data: trimmed }); }
    catch { notify("Provider keys can only be stored inside the Tauri app", "error"); return; }
    updateProvider(id, { encryptedKey, key: undefined });
    setEditingProvider(null); notify(`${providerInfo(id).label} connected`, "success");
  }

  function removeProvider(id: string) {
    const providers = { ...aiSettings.providers }; delete providers[id];
    const next = { ...aiSettings, providers, selectedProvider: aiSettings.selectedProvider === id ? "openai" : aiSettings.selectedProvider, selectedImageProvider: aiSettings.selectedImageProvider === id ? "openai" : aiSettings.selectedImageProvider };
    persistAiSettings(next); notify(`${providerInfo(id).label} removed`);
  }

  async function configureShortcuts() {
    try { await invoke("configure_shortcuts", { app_shortcut: shortcut, clipboard_shortcut: clipboardShortcut }); localStorage.setItem(APP_SHORTCUT_KEY, shortcut); localStorage.setItem(CLIPBOARD_SHORTCUT_KEY, clipboardShortcut); notify("Shortcuts updated", "success"); }
    catch (error) { notify(formatError(error), "error"); }
  }

  function updateAppearance(patch: Partial<AppearanceSettings>) { setAppearance(saveAppearance(patch)); }

  function openWindow(command: string) { void invoke(command).catch((error) => notify(formatError(error), "error")); }

  return (
    <main className="app-shell">
      <div className="drag-region h-1 shrink-0 border-b signal-line" />
      {view === "settings" ? <SettingsView tab={settingsTab} setTab={setSettingsTab} appearance={appearance} updateAppearance={updateAppearance} aiSettings={aiSettings} persistAiSettings={persistAiSettings} editingProvider={editingProvider} setEditingProvider={setEditingProvider} saveProviderKey={saveProviderKey} updateProvider={updateProvider} removeProvider={removeProvider} clipboardSettings={clipboardSettings} setClipboardSettings={setClipboardSettings} shortcut={shortcut} setShortcut={setShortcut} clipboardShortcut={clipboardShortcut} setClipboardShortcut={setClipboardShortcut} configureShortcuts={configureShortcuts} onClose={() => setView("menu")} openWindow={openWindow} notify={notify} /> : null}
      <div className={`flex min-h-0 flex-1 flex-col ${view === "settings" ? "hidden" : ""}`}>
        <ShellHeader title="Ghost Writer" icon={Sparkles} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
          {view === "menu" ? <MenuView capturedText={capturedText} prompt={prompt} setPrompt={setPrompt} onUseCopied={useCopiedText} onAction={handleAI} onImage={(mode) => { setImageMode(mode); setView("image-prompt"); }} onOpenNotepad={() => openWindow("open_notepad_window")} onOpenClipboard={() => openWindow("open_clipboard_window")} /> : null}
          {view === "result" ? <ResultView loading={isBusy} result={aiResult} kind={resultKind} onBack={() => setView("menu")} onAccept={acceptResult} onReject={() => setView("menu")} onCopy={() => copyText(aiResult)} onSave={saveTextToNotepad} /> : null}
          {view === "image-prompt" ? <ImagePromptView mode={imageMode} prompt={prompt} setPrompt={setPrompt} onBack={() => setView("menu")} onGenerate={() => generateImage(imageMode)} /> : null}
          {view === "image-loading" ? <LoadingView label={imageMode === "diagram" ? "Building diagram" : "Generating image"} /> : null}
          {view === "image-result" ? <ImageResultView image={generatedImage} mode={imageMode} onBack={() => setView("menu")} onCopy={copyImage} onDownload={downloadImage} onSave={saveImageToNotepad} onAgain={() => setView("image-prompt")} /> : null}
        </div>
        {view === "menu" ? <button data-no-drag className="industrial-button absolute bottom-3 right-3 h-8 w-8 bg-raised" onClick={() => setView("settings")} aria-label="Preferences"><Settings2 size={14} /></button> : null}
      </div>
      {toast ? <Toast {...toast} onDismiss={() => setToast(null)} /> : null}
    </main>
  );
}

function MenuView({ capturedText, prompt, setPrompt, onUseCopied, onAction, onImage, onOpenNotepad, onOpenClipboard }: { capturedText: string; prompt: string; setPrompt: (value: string) => void; onUseCopied: () => void; onAction: (prompt: string) => void; onImage: (mode: ImageMode) => void; onOpenNotepad: () => void; onOpenClipboard: () => void }) {
  return <section className="view-enter space-y-4 py-3">
    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-dim"><span>Selection</span><span className={capturedText ? "text-signal" : "text-dim"}>{capturedText ? "Captured" : "Waiting"}</span></div>
    {capturedText ? <div className="border signal-line bg-input px-2.5 py-2 text-[10px] leading-relaxed text-muted"><span className="mr-1 text-signal">›</span>{capturedText.slice(0, 120)}{capturedText.length > 120 ? "…" : ""}</div> : null}
    <button className="text-left text-[10px] text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal" onClick={onUseCopied}>Use copied text</button>
    <label className="flex items-center gap-2 border signal-line bg-input px-2.5 py-2.5"><Sparkles size={15} className="shrink-0 text-signal" /><input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && prompt.trim()) onAction(prompt.trim()); }} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-ink outline-none placeholder:text-dim" placeholder="Describe a change…" /></label>
    <div className="border-t hairline pt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Quick actions</p><div className="space-y-1">{QUICK_ACTIONS.map(({ label, prompt: actionPrompt, icon: Icon }) => <button key={label} className="group flex w-full items-center gap-3 border border-transparent px-2.5 py-2 text-left text-[12px] text-muted transition hover:border-signal/20 hover:bg-signal/5 hover:text-ink" onClick={() => onAction(actionPrompt)}><Icon size={16} className="text-dim group-hover:text-signal" /><span>{label}</span></button>)}</div></div>
    <div className="border-t hairline pt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Workspace</p><div className="grid grid-cols-2 gap-1.5"><button className="industrial-button h-9 justify-start px-2 text-[10px]" onClick={() => onImage("image")}><ImageIcon size={14} className="text-signal" />Image</button><button className="industrial-button h-9 justify-start px-2 text-[10px]" onClick={() => onImage("diagram")}><ListTree size={14} className="text-signal" />Diagram</button><button className="industrial-button h-9 justify-start px-2 text-[10px]" onClick={onOpenNotepad}><FilePenLine size={14} className="text-signal" />Notepad</button><button className="industrial-button h-9 justify-start px-2 text-[10px]" onClick={onOpenClipboard}><Clipboard size={14} className="text-signal" />Clipboard</button></div></div>
  </section>;
}

function ResultView({ loading, result, kind, onBack, onAccept, onReject, onCopy, onSave }: { loading: boolean; result: string; kind: "standard" | "summary"; onBack: () => void; onAccept: () => void; onReject: () => void; onCopy: () => void; onSave: () => void }) {
  return <section className="view-enter space-y-3 py-3"><button className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-dim hover:text-ink" onClick={onBack}><ArrowLeft size={13} />Back</button><div className="flex items-center justify-between border-b hairline pb-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">{kind === "summary" ? "Summary" : "Proposed change"}</span><span className="text-[10px] text-signal">{loading ? "Working" : "Ready"}</span></div>{loading ? <LoadingView label="Synthesizing with AI" /> : <><div className="min-h-[170px] whitespace-pre-wrap border signal-line bg-input p-3 text-[12px] leading-relaxed text-ink">{result}</div>{kind === "standard" ? <div className="grid grid-cols-2 gap-1.5"><button className="industrial-button industrial-button-primary h-9 text-[10px]" onClick={onAccept}><Check size={14} />Accept</button><button className="industrial-button h-9 text-[10px]" onClick={onReject}><X size={14} />Close</button></div> : null}<div className="grid grid-cols-2 gap-1.5"><button className="industrial-button h-8 text-[10px]" onClick={onCopy}><Copy size={13} />Copy</button><button className="industrial-button h-8 text-[10px]" onClick={onSave}><Save size={13} />Notepad</button></div></>}</section>;
}

function LoadingView({ label }: { label: string }) { return <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center"><LoaderCircle size={30} className="animate-spin text-signal" /><p className="text-[12px] text-muted">{label}</p><p className="text-[10px] text-dim">Using your selected model</p></div>; }

function ImagePromptView({ mode, prompt, setPrompt, onBack, onGenerate }: { mode: ImageMode; prompt: string; setPrompt: (value: string) => void; onBack: () => void; onGenerate: () => void }) { return <section className="view-enter space-y-3 py-3"><button className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-dim hover:text-ink" onClick={onBack}><ArrowLeft size={13} />Back</button><div className="flex items-center justify-between border-b hairline pb-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">{mode === "diagram" ? "Generate diagram" : "Generate image"}</span><span className="text-[10px] text-signal">{mode}</span></div><p className="text-[10px] leading-relaxed text-muted">The selected text will guide the generation. Add an optional direction below.</p><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} className="field resize-none p-2.5 text-[11px] leading-relaxed" placeholder="Add a direction…" /><button className="industrial-button industrial-button-primary h-10 w-full text-[10px] uppercase tracking-[0.1em]" onClick={onGenerate}><Sparkles size={14} />Generate</button></section>; }

function ImageResultView({ image, mode, onBack, onCopy, onDownload, onSave, onAgain }: { image: string; mode: ImageMode; onBack: () => void; onCopy: () => void; onDownload: () => void; onSave: () => void; onAgain: () => void }) { return <section className="view-enter space-y-3 py-3"><button className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-dim hover:text-ink" onClick={onBack}><ArrowLeft size={13} />Back</button><div className="flex items-center justify-between border-b hairline pb-2"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Generated {mode}</span><span className="text-[10px] text-signal">Ready</span></div><div className="flex min-h-[180px] items-center justify-center border signal-line bg-input p-2"><img src={image} alt={`Generated ${mode}`} className="max-h-[220px] max-w-full object-contain" /></div><div className="grid grid-cols-2 gap-1.5"><button className="industrial-button industrial-button-primary h-9 text-[10px]" onClick={onCopy}><Copy size={13} />Copy image</button><button className="industrial-button h-9 text-[10px]" onClick={onDownload}><Download size={13} />Download</button></div><button className="industrial-button h-8 w-full text-[10px]" onClick={onSave}><Save size={13} />Save to Notepad</button><button className="w-full py-1 text-[10px] text-dim hover:text-ink" onClick={onAgain}>Generate another</button></section>; }

function SettingsView(props: {
  tab: SettingsTab; setTab: (tab: SettingsTab) => void; appearance: AppearanceSettings; updateAppearance: (patch: Partial<AppearanceSettings>) => void; aiSettings: AiSettings; persistAiSettings: (settings: AiSettings) => void; editingProvider: string | null; setEditingProvider: (id: string | null) => void; saveProviderKey: (id: string, key: string) => Promise<void>; updateProvider: (id: string, patch: Partial<ProviderConfig>) => void; removeProvider: (id: string) => void; clipboardSettings: { autoCapture: boolean; maxItems: number }; setClipboardSettings: (value: { autoCapture: boolean; maxItems: number }) => void; shortcut: string; setShortcut: (value: string) => void; clipboardShortcut: string; setClipboardShortcut: (value: string) => void; configureShortcuts: () => Promise<void>; onClose: () => void; openWindow: (command: string) => void; notify: (message: string, kind?: "info" | "success" | "error") => void;
}) {
  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Sparkles }> = [{ id: "models", label: "Models", icon: Server }, { id: "general", label: "General", icon: Settings2 }, { id: "clipboard", label: "Clipboard", icon: Clipboard }];
  return <div className="absolute inset-0 z-20 flex flex-col bg-shell"><ShellHeader title="Preferences" icon={Settings2} onClose={props.onClose} /><nav className="grid grid-cols-3 border-b hairline px-2 py-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`flex h-8 items-center justify-center gap-1 border text-[9px] uppercase tracking-[0.12em] ${props.tab === id ? "signal-line bg-signal/10 text-signal" : "border-transparent text-dim hover:text-ink"}`} onClick={() => props.setTab(id)}><Icon size={12} />{label}</button>)}</nav><div className="settings-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-5">{props.tab === "models" ? <ModelsPanel {...props} /> : null}{props.tab === "general" ? <GeneralPanel {...props} /> : null}{props.tab === "clipboard" ? <ClipboardPanel {...props} /> : null}</div></div>;
}

function routeValue(id: string, model: string) { return JSON.stringify([id, model]); }
function parseRouteValue(value: string): [string, string] { try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return [String(parsed[0]), String(parsed[1])]; } catch { /* fall through */ } const [id, ...model] = value.split(":"); return [id, model.join(":")]; }

function ModelsPanel({ aiSettings, persistAiSettings, editingProvider, setEditingProvider, saveProviderKey, updateProvider, removeProvider }: Pick<ComponentProps<typeof SettingsView>, "aiSettings" | "persistAiSettings" | "editingProvider" | "setEditingProvider" | "saveProviderKey" | "updateProvider" | "removeProvider">) {
  const [showAdd, setShowAdd] = useState(false);
  const connected = Object.keys(aiSettings.providers);
  function selectProvider(id: string, model?: string) { const info = providerInfo(id); persistAiSettings({ ...aiSettings, selectedProvider: id, selectedModel: model || aiSettings.providers[id]?.modelId || info.defaultModel }); }
  function selectImageProvider(id: string, model?: string) { const info = providerInfo(id); persistAiSettings({ ...aiSettings, selectedImageProvider: id, selectedImageModel: model || aiSettings.providers[id]?.imageModelId || info.imageModel || info.defaultModel }); }
  const chatOptions = connected.length ? connected.map((id) => { const model = aiSettings.providers[id]?.modelId || providerInfo(id).defaultModel; return { value: routeValue(id, model), label: `${providerInfo(id).label} · ${model}` }; }) : [{ value: routeValue("openai", "gpt-4.1-mini"), label: "OpenAI · gpt-4.1-mini" }];
  const imageOptions = connected.length ? connected.map((id) => { const model = aiSettings.providers[id]?.imageModelId || providerInfo(id).imageModel || providerInfo(id).defaultModel; return { value: routeValue(id, model), label: `${providerInfo(id).label} · ${model}` }; }) : [{ value: routeValue("openai", "gpt-image-2"), label: "OpenAI · gpt-image-2" }];
  return <section className="view-enter space-y-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Model routing</p><p className="mt-1 text-[10px] leading-relaxed text-muted">Choose which connected provider handles each action.</p></div><div className="space-y-2"><SelectRow label="Chat model" value={routeValue(aiSettings.selectedProvider, aiSettings.selectedModel)} options={chatOptions} onChange={(value) => { const [id, model] = parseRouteValue(value); selectProvider(id, model); }} /><SelectRow label="Image model" value={routeValue(aiSettings.selectedImageProvider, aiSettings.selectedImageModel)} options={imageOptions} onChange={(value) => { const [id, model] = parseRouteValue(value); selectImageProvider(id, model); }} /></div><div className="flex items-center justify-between border-t hairline pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Providers</p><button className="industrial-button h-7 px-2 text-[9px] text-signal" onClick={() => setShowAdd((value) => !value)}><Plus size={12} />Add</button></div>{showAdd ? <div className="grid grid-cols-1 gap-1 border signal-line bg-input p-1">{PROVIDERS.filter((provider) => !connected.includes(provider.id)).map((provider) => <button key={provider.id} className="flex items-center justify-between px-2 py-2 text-left text-[10px] text-muted hover:bg-signal/10 hover:text-ink" onClick={() => { updateProvider(provider.id, { baseUrl: provider.baseUrl, modelId: provider.defaultModel, imageModelId: provider.imageModel }); setShowAdd(false); setEditingProvider(provider.id); }}><span>{provider.label}</span><span className="text-[9px] text-dim">{provider.kind}</span></button>)}</div> : null}{connected.length ? connected.map((id) => <ProviderCard key={id} id={id} config={aiSettings.providers[id] ?? {}} editing={editingProvider === id} setEditing={() => setEditingProvider(id)} cancel={() => setEditingProvider(null)} onSave={saveProviderKey} onUpdate={updateProvider} onRemove={() => removeProvider(id)} />) : <div className="border border-dashed hairline px-3 py-5 text-center text-[10px] text-dim">No providers connected yet.</div>}</section>;
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1 block text-[9px] uppercase tracking-[0.13em] text-dim">{label}</span><div className="relative"><select className="field appearance-none px-2.5 py-2 pr-7 text-[10px]" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-dim" /></div></label>; }

function ProviderCard({ id, config, editing, setEditing, cancel, onSave, onUpdate, onRemove }: { id: string; config: ProviderConfig; editing: boolean; setEditing: () => void; cancel: () => void; onSave: (id: string, key: string) => Promise<void>; onUpdate: (id: string, patch: Partial<ProviderConfig>) => void; onRemove: () => void }) { const info = providerInfo(id); const [key, setKey] = useState(""); const [showKey, setShowKey] = useState(false); const hasKey = Boolean(config.key || config.encryptedKey); return <article className="border hairline bg-input p-2.5"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-semibold text-ink">{info.label}</p><p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-dim">{info.kind} · {config.modelId || info.defaultModel}</p></div><button className="text-dim hover:text-red-400" onClick={onRemove} aria-label={`Remove ${info.label}`}><Trash2 size={13} /></button></div>{isLocalProvider(id) ? <input className="field mt-2 px-2 py-1.5 text-[10px]" value={config.baseUrl || ""} placeholder={info.baseUrl || "Base URL"} onChange={(event) => onUpdate(id, { baseUrl: event.target.value })} /> : null}<input className="field mt-2 px-2 py-1.5 font-mono text-[10px]" value={config.modelId || ""} placeholder={`Model ID (${info.defaultModel})`} onChange={(event) => onUpdate(id, { modelId: event.target.value })} />{editing || !hasKey ? <div className="mt-2 flex gap-1"><div className="relative min-w-0 flex-1"><input className="field px-2 py-1.5 pr-7 text-[10px]" type={showKey ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void onSave(id, key); }} placeholder={isLocalProvider(id) ? "API key (optional)" : "API key"} /><button className="absolute right-1.5 top-1/2 -translate-y-1/2 text-dim hover:text-ink" onClick={() => setShowKey((value) => !value)} aria-label="Toggle API key visibility">{showKey ? <EyeOff size={12} /> : <Eye size={12} />}</button></div><button className="industrial-button industrial-button-primary h-7 px-2 text-[9px]" disabled={!key.trim()} onClick={() => void onSave(id, key)}>Save</button></div> : <div className="mt-2 flex items-center justify-between border signal-line px-2 py-1.5 text-[10px] text-muted"><span>API key configured</span><button className="text-signal" onClick={setEditing}>Replace</button></div>}{editing && hasKey ? <button className="mt-1 text-[9px] text-dim hover:text-ink" onClick={cancel}>Cancel</button> : null}</article>; }

function GeneralPanel({ appearance, updateAppearance, shortcut, setShortcut, clipboardShortcut, setClipboardShortcut, configureShortcuts }: Pick<ComponentProps<typeof SettingsView>, "appearance" | "updateAppearance" | "shortcut" | "setShortcut" | "clipboardShortcut" | "setClipboardShortcut" | "configureShortcuts">) { return <section className="view-enter space-y-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Keyboard</p><p className="mt-1 text-[10px] leading-relaxed text-muted">Global shortcuts work while Ghost Writer is in the background.</p></div><ShortcutField label="Capture selection" value={shortcut} onChange={setShortcut} /><ShortcutField label="Open clipboard" value={clipboardShortcut} onChange={setClipboardShortcut} /><button className="industrial-button industrial-button-primary h-8 w-full text-[10px]" onClick={() => void configureShortcuts()}><Keyboard size={13} />Save shortcuts</button><div className="border-t hairline pt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Appearance</p><button className="industrial-button h-9 w-full justify-between px-2.5 text-[10px]" onClick={() => updateAppearance({ theme: appearance.theme === "dark" ? "light" : "dark" })}><span className="flex items-center gap-2">{appearance.theme === "dark" ? <Moon size={13} /> : <Sun size={13} />}Interface theme</span><span className="text-signal">{appearance.theme}</span></button><label className="mt-2 flex items-center justify-between border hairline bg-input px-2.5 py-2 text-[10px] text-muted"><span className="flex items-center gap-2"><RefreshCw size={13} />Acrylic blur</span><input type="checkbox" checked={appearance.acrylic} onChange={(event) => updateAppearance({ acrylic: event.target.checked })} /></label><label className="mt-2 block border hairline bg-input px-2.5 py-2"><span className="flex items-center justify-between text-[10px] text-muted"><span>Blur amount</span><span className="text-signal">{appearance.blurAmount}px</span></span><input className="mt-2 w-full accent-signal" type="range" min="0" max="40" value={appearance.blurAmount} onChange={(event) => updateAppearance({ blurAmount: Number(event.target.value) })} /></label><label className="mt-2 block border hairline bg-input px-2.5 py-2"><span className="flex items-center justify-between text-[10px] text-muted"><span>Transparency</span><span className="text-signal">{appearance.transparency}%</span></span><input className="mt-2 w-full accent-signal" type="range" min="0" max="100" value={appearance.transparency} onChange={(event) => updateAppearance({ transparency: Number(event.target.value) })} /></label></div><div className="border-t hairline pt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Language</p><label className="flex items-center gap-2 border hairline bg-input px-2.5 py-2 text-[10px] text-muted"><Languages size={13} /><select className="min-w-0 flex-1 bg-transparent text-[10px] outline-none" defaultValue={localStorage.getItem("app_lang") || "en"} onChange={(event) => localStorage.setItem("app_lang", event.target.value)}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></label></div></section>; }

function ShortcutField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1 block text-[9px] uppercase tracking-[0.13em] text-dim">{label}</span><input className="field px-2.5 py-2 text-[11px]" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }

function ClipboardPanel({ clipboardSettings, setClipboardSettings, openWindow }: Pick<ComponentProps<typeof SettingsView>, "clipboardSettings" | "setClipboardSettings" | "openWindow">) { function update(patch: Partial<typeof clipboardSettings>) { const next = { ...clipboardSettings, ...patch }; setClipboardSettings(next); writeJson("ghost_writer_clipboard_settings_v1", next); void invoke("clipboard_command", { command: JSON.stringify({ type: "settings", settings: next }) }).catch(() => {}); } return <section className="view-enter space-y-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dim">Clipboard history</p><p className="mt-1 text-[10px] leading-relaxed text-muted">History stays on this device and is never sent to an AI provider.</p></div><label className="flex items-center justify-between border hairline bg-input px-2.5 py-2.5 text-[10px] text-muted"><span>Automatic capture</span><input type="checkbox" checked={clipboardSettings.autoCapture} onChange={(event) => update({ autoCapture: event.target.checked })} /></label><label className="flex items-center justify-between border hairline bg-input px-2.5 py-2.5 text-[10px] text-muted"><span>History limit</span><select className="bg-transparent text-[10px] text-signal outline-none" value={clipboardSettings.maxItems} onChange={(event) => update({ maxItems: Number(event.target.value) })}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option></select></label><button className="industrial-button industrial-button-primary h-9 w-full text-[10px]" onClick={() => openWindow("open_clipboard_only_window")}><Clipboard size={13} />Open clipboard</button></section>; }
