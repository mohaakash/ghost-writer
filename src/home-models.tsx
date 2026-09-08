import { useEffect, useMemo, useState } from "react";
import {
  AI_SETTINGS_KEY,
  DEFAULT_AI_SETTINGS,
  LEGACY_AI_SETTINGS_KEY,
  LEGACY_OPENAI_KEY,
  maskApiKey,
  normalizeAiSettings,
  providerNeedsKey,
  type AiSettings,
  type CustomEndpoint,
  type ProviderConfig,
} from "./lib/ai-domain";
import { decryptData, encryptData, lmPing } from "./lib/tauri-commands";

type ToastType = "info" | "success" | "error";

interface ModelsSettingsProps {
  onClose: () => void;
  fallbackToLegacy: (view?: string) => void;
  showToast: (message: string, type?: ToastType) => void;
  onSelectTab?: (tab: PreferencesTab) => void;
}

interface ProviderCatalogEntry {
  id: string;
  label: string;
  type: "cloud" | "local";
  keyPrefix?: string;
  docs: string;
  icon: string;
  baseUrl?: string;
  modelPlaceholder?: string;
  description?: string;
  models?: ReadonlyArray<readonly [string, string, string]>;
}

interface ModelOption {
  value: string;
  provider: string;
  endpointId: string;
  modelId: string;
  label: string;
  hint: string;
}

const PROVIDERS: readonly ProviderCatalogEntry[] = [
  { id: "openai", label: "OpenAI", type: "cloud", keyPrefix: "sk-", docs: "https://platform.openai.com/api-keys", icon: "auto_awesome", models: [["gpt-4.1-mini", "GPT-4.1 mini", "Cheap"], ["gpt-4.1", "GPT-4.1", "Balanced"], ["gpt-5.4-mini", "GPT-5.4 mini", "Fast"], ["gpt-5.4-nano", "GPT-5.4 nano", "Fastest"], ["gpt-5.3-codex", "GPT-5.3 Codex", "Coding"], ["gpt-5.5", "GPT-5.5", "Flagship"]] },
  { id: "anthropic", label: "Anthropic", type: "cloud", keyPrefix: "sk-ant-", docs: "https://console.anthropic.com/settings/keys", icon: "psychology", models: [["claude-sonnet-4-6", "Claude Sonnet 4.6", "Balanced"], ["claude-opus-4-8", "Claude Opus 4.8", "Best"], ["claude-opus-4-7", "Claude Opus 4.7", "Previous"], ["claude-haiku-4-5", "Claude Haiku 4.5", "Fast"], ["claude-opus-4-6", "Claude Opus 4.6", "Legacy"]] },
  { id: "google", label: "Google Gemini", type: "cloud", docs: "https://aistudio.google.com/apikey", icon: "diamond", models: [["gemini-2.5-flash", "Gemini 2.5 Flash", "Fast"], ["gemini-2.5-pro", "Gemini 2.5 Pro", "Stable"], ["gemini-3.5-flash", "Gemini 3.5 Flash", "Fast"], ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite", "Lite"], ["gemini-3-flash-preview", "Gemini 3 Flash", "Fast"], ["gemini-3.1-pro-preview", "Gemini 3.1 Pro", "Flagship"]] },
  { id: "xai", label: "xAI", type: "cloud", keyPrefix: "xai-", docs: "https://console.x.ai/", icon: "bolt", models: [["grok-4.20-reasoning", "Grok 4.20 Reasoning", "Reasoning"], ["grok-4.20-non-reasoning", "Grok 4.20", "Fast"], ["grok-4-fast-reasoning", "Grok 4 Fast", "Reasoning"], ["grok-4.3", "Grok 4.3", "Flagship"], ["grok-build-0.1", "Grok Build 0.1", "Coding"]] },
  { id: "cerebras", label: "Cerebras", type: "cloud", keyPrefix: "csk-", docs: "https://cloud.cerebras.ai/", icon: "speed", models: [["gpt-oss-120b", "GPT-OSS 120B", "Ultra-fast"], ["llama3.3-70b", "Llama 3.3 70B", "Fast"], ["qwen-3-32b", "Qwen 3 32B", "Fast"]] },
  { id: "groq", label: "Groq", type: "cloud", keyPrefix: "gsk_", docs: "https://console.groq.com/keys", icon: "flash_on", models: [["openai/gpt-oss-20b", "GPT-OSS 20B", "Ultra-fast"], ["llama-3.3-70b-versatile", "Llama 3.3 70B", "Versatile"], ["deepseek-r1-distill-llama-70b", "DeepSeek R1 Distill 70B", "Thinking"]] },
  { id: "deepseek", label: "DeepSeek", type: "cloud", keyPrefix: "sk-", docs: "https://platform.deepseek.com/api_keys", icon: "explore", models: [["deepseek-v4-pro", "DeepSeek V4 Pro", "Best"], ["deepseek-v4-flash", "DeepSeek V4 Flash", "Fast"], ["deepseek-reasoner", "DeepSeek Reasoner", "Thinking"]] },
  { id: "mistral", label: "Mistral", type: "cloud", docs: "https://console.mistral.ai/api-keys/", icon: "waves", models: [["mistral-large-latest", "Mistral Large 3", "Best"], ["mistral-medium-latest", "Mistral Medium 3.5", "Balanced"], ["codestral-latest", "Codestral", "Code"]] },
  { id: "openrouter", label: "OpenRouter", type: "cloud", keyPrefix: "sk-or-", docs: "https://openrouter.ai/keys", icon: "hub" },
  { id: "lmstudio", label: "LM Studio", type: "local", docs: "https://lmstudio.ai/docs/basics/server", icon: "memory", baseUrl: "http://localhost:1234/v1", modelPlaceholder: "qwen2.5-coder-7b-instruct", description: "Run local GGUF models via LM Studio’s HTTP server." },
  { id: "mlx", label: "MLX", type: "local", docs: "https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md", icon: "developer_board", baseUrl: "http://127.0.0.1:8080/v1", modelPlaceholder: "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit", description: "Apple-silicon inference via mlx_lm.server." },
  { id: "ollama", label: "Ollama", type: "local", docs: "https://ollama.com/download", icon: "dns", baseUrl: "http://localhost:11434/v1", modelPlaceholder: "qwen2.5-coder:7b", description: "Local models through Ollama’s OpenAI-compatible API." },
];

const IMAGE_MODELS: readonly { provider: string; id: string; label: string; hint: string }[] = [
  { provider: "openai", id: "gpt-image-2", label: "GPT Image 2", hint: "Latest" },
  { provider: "openai", id: "gpt-image-1", label: "GPT Image 1", hint: "Compatible" },
  { provider: "openai", id: "dall-e-3", label: "DALL·E 3", hint: "Legacy" },
  { provider: "google", id: "gemini-2.0-flash-preview-image-generation", label: "Gemini Image Generation", hint: "Native" },
  { provider: "google", id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image", hint: "Nano Banana" },
  { provider: "google", id: "gemini-3.1-flash-lite-image", label: "Gemini 3.1 Flash Lite Image", hint: "Fast" },
  { provider: "google", id: "gemini-3-pro-image", label: "Gemini 3 Pro Image", hint: "Pro" },
  { provider: "google", id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", hint: "Compatible" },
  { provider: "xai", id: "grok-imagine-image-2.0", label: "Grok Imagine 2.0", hint: "Image" },
  { provider: "openrouter", id: "bytedance-seed/seedream-4.5", label: "Seedream 4.5", hint: "OpenRouter" },
  { provider: "openrouter", id: "black-forest-labs/flux.2-pro", label: "FLUX.2 Pro", hint: "OpenRouter" },
];

function icon(name: string, className = "") {
  return <span className={`material-icons-outlined ${className}`.trim()}>{name}</span>;
}

function providerFor(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

function cloneDefaults() {
  return normalizeAiSettings(JSON.parse(JSON.stringify(DEFAULT_AI_SETTINGS)));
}

function configuredProvider(settings: AiSettings, id: string) {
  const provider = providerFor(id);
  const config = settings.providerConfig[id] ?? {};
  if (id === "openrouter") return Boolean(settings.providerKeys[id]?.trim() && config.modelId?.trim());
  if (provider?.type === "local") return Boolean(config.baseUrl?.trim() && config.modelId?.trim());
  return Boolean(settings.providerKeys[id]?.trim());
}

function modelOptions(settings: AiSettings) {
  const options: ModelOption[] = [];
  for (const provider of PROVIDERS) {
    if (!configuredProvider(settings, provider.id)) continue;
    const config = settings.providerConfig[provider.id] ?? {};
    if (provider.id === "openrouter" || provider.type === "local") {
      if (config.modelId?.trim()) options.push({ value: `${provider.id}::::${config.modelId.trim()}`, provider: provider.id, endpointId: "", modelId: config.modelId.trim(), label: config.modelId.trim(), hint: provider.type === "local" ? "Local" : "Configurable" });
      continue;
    }
    for (const [id, label, hint] of provider.models ?? []) options.push({ value: `${provider.id}::::${id}`, provider: provider.id, endpointId: "", modelId: id, label, hint });
  }
  for (const endpoint of settings.customEndpoints) {
    if (endpoint.baseUrl.trim() && endpoint.modelId.trim()) options.push({ value: `custom-endpoint::${endpoint.id}::${endpoint.modelId.trim()}`, provider: "custom-endpoint", endpointId: endpoint.id, modelId: endpoint.modelId.trim(), label: endpoint.modelId.trim(), hint: endpoint.name || "Custom endpoint" });
  }
  return options;
}

function imageOptions(settings: AiSettings) {
  const options: ModelOption[] = [];
  for (const provider of PROVIDERS) {
    if (provider.type !== "cloud" || !settings.providerKeys[provider.id]) continue;
    if (provider.id === "openrouter" && settings.providerConfig.openrouter?.imageModelId?.trim()) {
      const modelId = settings.providerConfig.openrouter.imageModelId.trim();
      options.push({ value: `openrouter::::${modelId}`, provider: "openrouter", endpointId: "", modelId, label: modelId, hint: "Custom" });
      continue;
    }
    for (const model of IMAGE_MODELS.filter((entry) => entry.provider === provider.id)) options.push({ value: `${model.provider}::::${model.id}`, provider: model.provider, endpointId: "", modelId: model.id, label: model.label, hint: model.hint });
  }
  for (const endpoint of settings.customEndpoints) {
    if (endpoint.baseUrl.trim() && endpoint.imageModelId.trim()) options.push({ value: `custom-endpoint::${endpoint.id}::${endpoint.imageModelId.trim()}`, provider: "custom-endpoint", endpointId: endpoint.id, modelId: endpoint.imageModelId.trim(), label: endpoint.imageModelId.trim(), hint: endpoint.name || "Custom endpoint" });
  }
  return options;
}

function optionsForSelect(options: ModelOption[]) {
  const grouped = new Map<string, ModelOption[]>();
  for (const option of options) grouped.set(option.provider, [...(grouped.get(option.provider) ?? []), option]);
  return [...grouped.entries()].map(([providerId, entries]) => (
    <optgroup key={providerId} label={providerId === "custom-endpoint" ? "Custom endpoints" : providerFor(providerId)?.label ?? providerId}>
      {entries.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.hint}</option>)}
    </optgroup>
  ));
}

export function ModelsSettings({ onClose, fallbackToLegacy, showToast, onSelectTab }: ModelsSettingsProps) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [testing, setTesting] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const next = await loadStoredSettings();
      if (mounted) {
        setSettings(next);
        setKeyValues(next.providerKeys);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function persist(next: AiSettings) {
    setSettings(next);
    setKeyValues((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id in next.providerKeys)));
    try {
      const encrypted = await encryptData({ data: JSON.stringify(next) });
      localStorage.setItem(AI_SETTINGS_KEY, encrypted);
    } catch (error) {
      showToast(`Could not save model settings: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  async function update(next: AiSettings, message?: string) {
    await persist(next);
    if (message) showToast(message, "success");
  }

  function patchProvider(id: string, patch: Partial<ProviderConfig>) {
    if (!settings) return;
    const next = { ...settings, providerConfig: { ...settings.providerConfig, [id]: { ...(settings.providerConfig[id] ?? {}), ...patch } } };
    void update(next);
  }

  async function saveKey(id: string) {
    if (!settings) return;
    const value = keyValues[id]?.trim() ?? "";
    const provider = providerFor(id);
    if (!value) { showToast("Enter your API key.", "error"); return; }
    if (provider?.keyPrefix && !value.startsWith(provider.keyPrefix)) { showToast(`${provider.label} keys start with \"${provider.keyPrefix}\".`, "error"); return; }
    const next = { ...settings, providerKeys: { ...settings.providerKeys, [id]: value }, addingProviders: settings.addingProviders.filter((entry) => entry !== id) };
    await update(next, `${provider?.label ?? id} connected`);
    setEditingKeys((current) => { const copy = new Set(current); copy.delete(id); return copy; });
  }

  async function removeProvider(id: string) {
    if (!settings) return;
    const provider = providerFor(id);
    const providerConfig = { ...settings.providerConfig };
    if (providerConfig[id]) providerConfig[id] = { ...(provider?.baseUrl ? { baseUrl: provider.baseUrl } : {}), modelId: "" };
    const next = { ...settings, providerKeys: Object.fromEntries(Object.entries(settings.providerKeys).filter(([key]) => key !== id)), providerConfig, addingProviders: settings.addingProviders.filter((entry) => entry !== id), selectedProvider: settings.selectedProvider === id ? "openai" : settings.selectedProvider, selectedModel: settings.selectedProvider === id ? "gpt-4.1-mini" : settings.selectedModel };
    await update(next);
  }

  function addProvider(id: string) {
    if (!settings) return;
    setProviderMenuOpen(false);
    if (settings.addingProviders.includes(id)) return;
    void update({ ...settings, addingProviders: [...settings.addingProviders, id] });
  }

  function addCustomEndpoint() {
    if (!settings) return;
    const id = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `endpoint_${Date.now()}`;
    const endpoint: CustomEndpoint = { id, name: "", baseUrl: "", modelId: "", imageModelId: "", contextLimit: 128000 };
    setExpandedEndpoints((current) => new Set(current).add(id));
    setProviderMenuOpen(false);
    void update({ ...settings, customEndpoints: [...settings.customEndpoints, endpoint] });
  }

  async function saveEndpoint(id: string, patch: Partial<CustomEndpoint>) {
    if (!settings) return;
    const customEndpoints = settings.customEndpoints.map((endpoint) => endpoint.id === id ? { ...endpoint, ...patch } : endpoint);
    await update({ ...settings, customEndpoints });
  }

  async function removeEndpoint(id: string) {
    if (!settings) return;
    await update({ ...settings, customEndpoints: settings.customEndpoints.filter((endpoint) => endpoint.id !== id), providerKeys: Object.fromEntries(Object.entries(settings.providerKeys).filter(([key]) => key !== `custom:${id}`)) });
  }

  async function testBaseUrl(id: string, value: string) {
    if (!value.trim()) return;
    setTesting((current) => ({ ...current, [id]: "Testing…" }));
    try {
      const code = await lmPing({ baseUrl: value.trim() });
      setTesting((current) => ({ ...current, [id]: Number(code) >= 200 && Number(code) < 500 ? "Reachable — server responded." : "Could not reach the server." }));
    } catch {
      setTesting((current) => ({ ...current, [id]: "Could not reach the server." }));
    }
  }

  if (!settings) return <SettingsFrame onClose={onClose} fallbackToLegacy={fallbackToLegacy} activeTab="models" onSelectTab={onSelectTab}><div className="py-8 text-center text-xs text-zinc-500">Loading models…</div></SettingsFrame>;

  const options = modelOptions(settings);
  const images = imageOptions(settings);
  const selected = options.find((option) => option.provider === settings.selectedProvider && option.endpointId === settings.selectedEndpointId && option.modelId === settings.selectedModel) ?? options[0];
  const selectedImage = images.find((option) => option.provider === settings.imageProvider && option.endpointId === settings.imageEndpointId && option.modelId === settings.imageModel) ?? images[0];
  const visibleIds = new Set([...PROVIDERS.filter((provider) => configuredProvider(settings, provider.id)).map((provider) => provider.id), ...settings.addingProviders]);
  const visibleProviders = PROVIDERS.filter((provider) => visibleIds.has(provider.id));
  const addableProviders = PROVIDERS.filter((provider) => !visibleIds.has(provider.id));

  return (
    <SettingsFrame onClose={onClose} fallbackToLegacy={fallbackToLegacy} activeTab="models" onSelectTab={onSelectTab}>
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1"><div><p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Models</p><p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500/90">Connect the providers you use and choose the model for editing.</p></div></div>
        <div className="rounded-2xl border border-black/5 bg-black/5 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="mb-2 flex items-center gap-2">{icon("tune", "text-[18px] text-primary")}<span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Defaults</span></div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Chat model</label>
          <select className="w-full rounded-xl border border-transparent bg-white/60 px-3 py-2 text-xs text-zinc-800 outline-none transition-all focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200" disabled={!options.length} value={selected?.value ?? ""} onChange={(event) => { const choice = options.find((option) => option.value === event.target.value); if (!choice) return; void update({ ...settings, selectedProvider: choice.provider, selectedEndpointId: choice.endpointId, selectedModel: choice.modelId }, `Model selected: ${choice.modelId}`); }}>
            {options.length ? optionsForSelect(options) : <option>No configured models</option>}
          </select>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">Your selected provider and model are used for text actions.</p>
          <label className="mb-1 mt-3 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Image model</label>
          <select className="w-full rounded-xl border border-transparent bg-white/60 px-3 py-2 text-xs text-zinc-800 outline-none transition-all focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200" disabled={!images.length} value={selectedImage?.value ?? ""} onChange={(event) => { const choice = images.find((option) => option.value === event.target.value); if (!choice) return; void update({ ...settings, imageProvider: choice.provider, imageEndpointId: choice.endpointId, imageModel: choice.modelId as AiSettings["imageModel"] }, `Image model selected: ${choice.modelId}`); }}>
            {images.length ? optionsForSelect(images) : <option>No connected image models</option>}
          </select>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500">Used by Generate Image and Generate Diagram. Add an image-capable provider below to use its image models.</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1"><div><p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Providers</p><p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500/90">Keys stay encrypted on this device and are sent only to the selected provider.</p></div><div className="relative"><button type="button" onClick={() => setProviderMenuOpen((open) => !open)} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-primary transition-all hover:bg-primary/20">{icon("add", "text-[14px]")}Add provider</button>{providerMenuOpen ? <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-zinc-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/95"><p className="px-2.5 pb-1 pt-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Cloud</p>{addableProviders.filter((provider) => provider.type === "cloud").map((provider) => <button type="button" key={provider.id} onClick={() => addProvider(provider.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-zinc-700 transition-colors hover:bg-primary/10 dark:text-zinc-200">{icon(provider.icon, "text-[15px] text-zinc-500")}<span>{provider.label}</span></button>)}<p className="px-2.5 pb-1 pt-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Local &amp; custom</p>{addableProviders.filter((provider) => provider.type === "local").map((provider) => <button type="button" key={provider.id} onClick={() => addProvider(provider.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-zinc-700 transition-colors hover:bg-primary/10 dark:text-zinc-200">{icon(provider.icon, "text-[15px] text-zinc-500")}<span>{provider.label}</span></button>)}<button type="button" onClick={addCustomEndpoint} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-zinc-700 transition-colors hover:bg-primary/10 dark:text-zinc-200">{icon("link", "text-[15px] text-primary")}<span>OpenAI Compatible</span></button></div> : null}</div></div>
        {visibleProviders.length || settings.customEndpoints.length ? <div className="space-y-2">{visibleProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} settings={settings} editingKeys={editingKeys} keyValue={keyValues[provider.id] ?? ""} testing={testing[provider.id]} onKeyValue={(value) => setKeyValues((current) => ({ ...current, [provider.id]: value }))} onSaveKey={() => void saveKey(provider.id)} onEditKey={() => setEditingKeys((current) => new Set(current).add(provider.id))} onCancelKey={() => setEditingKeys((current) => { const next = new Set(current); next.delete(provider.id); return next; })} onClearKey={() => void update({ ...settings, providerKeys: Object.fromEntries(Object.entries(settings.providerKeys).filter(([key]) => key !== provider.id)) })} onRemove={() => void removeProvider(provider.id)} onPatch={(patch) => patchProvider(provider.id, patch)} onTest={(value) => void testBaseUrl(provider.id, value)} />)}{settings.customEndpoints.map((endpoint) => <CustomEndpointCard key={endpoint.id} endpoint={endpoint} settings={settings} expanded={expandedEndpoints.has(endpoint.id) || !endpoint.baseUrl.trim()} keyValue={keyValues[`custom:${endpoint.id}`] ?? ""} editing={editingKeys.has(`custom:${endpoint.id}`) || !settings.providerKeys[`custom:${endpoint.id}`]} testing={testing[endpoint.id]} onToggle={() => setExpandedEndpoints((current) => { const next = new Set(current); if (next.has(endpoint.id)) next.delete(endpoint.id); else next.add(endpoint.id); return next; })} onPatch={(patch) => void saveEndpoint(endpoint.id, patch)} onRemove={() => void removeEndpoint(endpoint.id)} onKeyValue={(value) => setKeyValues((current) => ({ ...current, [`custom:${endpoint.id}`]: value }))} onSaveKey={() => void saveKey(`custom:${endpoint.id}`)} onEditKey={() => setEditingKeys((current) => new Set(current).add(`custom:${endpoint.id}`))} onClearKey={() => void update({ ...settings, providerKeys: Object.fromEntries(Object.entries(settings.providerKeys).filter(([key]) => key !== `custom:${endpoint.id}`)) })} onTest={(value) => void testBaseUrl(endpoint.id, value)} />)}</div> : <div className="rounded-2xl border border-dashed border-zinc-300/70 bg-black/5 px-4 py-7 text-center dark:border-zinc-700/70 dark:bg-white/5"><p className="text-xs text-zinc-500">No providers connected yet.</p><p className="mt-1 text-[10px] text-zinc-500/80">Add a cloud provider, local model, or custom endpoint to get started.</p></div>}
      </div>
      <div className="rounded-2xl border border-primary/10 bg-primary/5 px-3 py-2.5"><p className="flex items-center gap-2 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">{icon("lock", "text-[15px] text-primary")}Keys are stored locally on this device and are sent only to the selected provider.</p></div>
    </SettingsFrame>
  );
}

export type PreferencesTab = "models" | "general" | "clipboard";

export function SettingsFrame({ children, onClose, fallbackToLegacy, activeTab = "models", onSelectTab }: { children: React.ReactNode; onClose: () => void; fallbackToLegacy: (view?: string) => void; activeTab?: PreferencesTab; onSelectTab?: (tab: PreferencesTab) => void }) {
  const tab = (next: PreferencesTab) => {
    if (onSelectTab) onSelectTab(next);
    else {
      fallbackToLegacy("settings");
      window.setTimeout(() => (window as Window & { selectSettingsTab?: (value: string) => void }).selectSettingsTab?.(next), 0);
    }
  };
  const tabClass = (value: PreferencesTab) => value === activeTab
    ? "flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-primary shadow-sm transition-all dark:bg-zinc-800 dark:text-primary"
    : "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500 transition-all hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";
  return <div id="settings-view" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 bg-black/30 p-2 backdrop-blur-[2px] dark:bg-black/60"><div className="flex h-full w-full flex-col overflow-hidden rounded-[22px] bg-white/90 shadow-2xl dark:bg-zinc-950/95"><header data-tauri-drag-region className="shrink-0 border-b border-black/5 dark:border-white/10"><div className="flex h-11 items-center justify-between gap-2 px-3"><div className="flex min-w-0 items-center gap-2">{icon("tune", "text-[18px] text-primary")}<h2 className="truncate text-sm font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Preferences</h2></div><button type="button" onClick={onClose} aria-label="Close preferences" title="Close preferences" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-all hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200">{icon("close", "text-[18px]")}</button></div><div className="px-2 pb-2"><div role="tablist" aria-label="Preference sections" className="flex rounded-xl bg-black/5 p-1 dark:bg-white/5"><button type="button" id="settings-tab-models" data-settings-tab="models" role="tab" aria-selected={activeTab === "models"} onClick={() => tab("models")} className={tabClass("models")}>{icon("smart_toy", "text-[15px]")}<span data-i18n="models">Models</span></button><button type="button" id="settings-tab-general" data-settings-tab="general" role="tab" aria-selected={activeTab === "general"} onClick={() => tab("general")} className={tabClass("general")}>{icon("settings", "text-[15px]")}<span data-i18n="general">General</span></button><button type="button" id="settings-tab-clipboard" data-settings-tab="clipboard" role="tab" aria-selected={activeTab === "clipboard"} onClick={() => tab("clipboard")} className={tabClass("clipboard")}>{icon("content_paste", "text-[15px]")}<span data-i18n="clipboard">Clipboard</span></button></div></div></header><div className="flex-1 overflow-y-auto px-3 pb-5">{children}</div></div></div>;
}

function ProviderCard({ provider, settings, editingKeys, keyValue, testing, onKeyValue, onSaveKey, onEditKey, onCancelKey, onClearKey, onRemove, onPatch, onTest }: { provider: ProviderCatalogEntry; settings: AiSettings; editingKeys: Set<string>; keyValue: string; testing?: string; onKeyValue: (value: string) => void; onSaveKey: () => void; onEditKey: () => void; onCancelKey: () => void; onClearKey: () => void; onRemove: () => void; onPatch: (patch: Partial<ProviderConfig>) => void; onTest: (value: string) => void }) {
  const config = settings.providerConfig[provider.id] ?? {};
  const key = settings.providerKeys[provider.id] ?? "";
  const editing = !key || editingKeys.has(provider.id);
  if (editing && keyValue === key) keyValue = "";
  const local = provider.type === "local" || provider.id === "openrouter";
  return <div className="rounded-2xl border border-black/5 bg-black/5 p-3 dark:border-white/5 dark:bg-white/5"><div className="flex items-center gap-2">{icon(provider.icon, "text-[18px] text-primary")}<span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{provider.label}</span>{key || (local && config.modelId?.trim()) ? <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400">{icon("check_circle", "text-[11px]")}Connected</span> : null}<a href={provider.docs} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-zinc-500 transition-colors hover:text-primary">{local && provider.id !== "openrouter" ? "Docs" : "Get key"}{icon("open_in_new", "text-[12px]")}</a><button type="button" onClick={onRemove} title="Remove provider" className="ml-1 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500">{icon("close", "text-[14px]")}</button></div>{local ? <><p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-500/90">{provider.description ?? (provider.id === "openrouter" ? "Use any model id from openrouter.ai/models." : "")}</p><div className="mt-2.5 space-y-2">{provider.id !== "openrouter" ? <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-zinc-500">Base URL</span><div className="flex gap-1.5"><input defaultValue={config.baseUrl ?? provider.baseUrl ?? ""} onBlur={(event) => onPatch({ baseUrl: event.currentTarget.value.trim() })} spellCheck={false} placeholder={provider.baseUrl ?? "https://api.example.com/v1"} className="min-w-0 flex-1 rounded-xl border border-transparent bg-white/60 px-3 py-2 font-mono text-[11px] text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200" /><button type="button" onClick={(event) => onTest((event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement)?.value ?? "")} className="rounded-xl border border-zinc-300/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:border-primary/30 hover:text-primary dark:border-zinc-700">Test</button></div><span className={`provider-test-status mt-1 block text-[10px] ${testing?.includes("Could") ? "text-red-400" : "text-zinc-500"}`}>{testing ?? ""}</span></label> : null}<label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-zinc-500">Model ID</span><input defaultValue={config.modelId ?? ""} onBlur={(event) => onPatch({ modelId: event.currentTarget.value.trim() })} spellCheck={false} placeholder={provider.modelPlaceholder ?? (provider.id === "openrouter" ? "anthropic/claude-sonnet-4-6" : "Model id")} className="w-full rounded-xl border border-transparent bg-white/60 px-3 py-2 font-mono text-[11px] text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200" /></label>{provider.id === "openrouter" ? <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-zinc-500">Image model ID</span><input defaultValue={config.imageModelId ?? ""} onBlur={(event) => onPatch({ imageModelId: event.currentTarget.value.trim() })} spellCheck={false} placeholder="bytedance-seed/seedream-4.5" className="w-full rounded-xl border border-transparent bg-white/60 px-3 py-2 font-mono text-[11px] text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200" /></label> : null}{provider.id === "openrouter" ? <KeyField provider={provider} keyValue={keyValue} editing={editing} onChange={onKeyValue} onSave={onSaveKey} onEdit={onEditKey} onCancel={onCancelKey} onClear={onClearKey} /> : null}</div></> : <KeyField provider={provider} keyValue={keyValue} editing={editing} onChange={onKeyValue} onSave={onSaveKey} onEdit={onEditKey} onCancel={onCancelKey} onClear={onClearKey} />}</div>;
}

function KeyField({ provider, keyValue, storedKey = keyValue, editing, onChange, onSave, onEdit, onCancel, onClear }: { provider: ProviderCatalogEntry; storedKey?: string; keyValue: string; editing: boolean; onChange: (value: string) => void; onSave: () => void; onEdit: () => void; onCancel: () => void; onClear: () => void }) {
  const [visible, setVisible] = useState(false);
  return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-zinc-500">API key</span>{editing ? <><div className="flex gap-1.5"><div className="relative min-w-0 flex-1"><input type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} value={keyValue} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSave(); }} placeholder={provider.keyPrefix ? `${provider.keyPrefix}…` : "Paste API key"} className="w-full rounded-xl border border-transparent bg-white/60 px-3 py-2 pr-8 font-mono text-[11px] text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200" /><button type="button" title={visible ? "Hide key" : "Show key"} onClick={() => setVisible((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-primary">{icon(visible ? "visibility_off" : "visibility", "text-[14px]")}</button></div><button type="button" onClick={onSave} className="rounded-xl bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90">Save</button></div>{storedKey ? <button type="button" onClick={onCancel} className="mt-1.5 text-[10px] text-zinc-500 hover:text-primary">Cancel</button> : null}</> : <div className="flex items-center gap-1.5"><code className="min-w-0 flex-1 truncate rounded-xl bg-white/50 px-3 py-2 font-mono text-[11px] text-zinc-500 dark:bg-zinc-900/50">{maskApiKey(storedKey ?? "")}</code><button type="button" onClick={onEdit} title="Replace" className="rounded-lg p-1.5 text-zinc-400 hover:bg-primary/10 hover:text-primary">{icon("edit", "text-[14px]")}</button><button type="button" onClick={onClear} title="Remove key" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-500">{icon("close", "text-[14px]")}</button></div>}</label>;
}

function CustomEndpointCard({ endpoint, settings, expanded, keyValue, editing, testing, onToggle, onPatch, onRemove, onKeyValue, onSaveKey, onEditKey, onClearKey, onTest }: { endpoint: CustomEndpoint; settings: AiSettings; expanded: boolean; keyValue: string; editing: boolean; testing?: string; onToggle: () => void; onPatch: (patch: Partial<CustomEndpoint>) => void; onRemove: () => void; onKeyValue: (value: string) => void; onSaveKey: () => void; onEditKey: () => void; onClearKey: () => void; onTest: (value: string) => void }) {
  const key = settings.providerKeys[`custom:${endpoint.id}`] ?? "";
  if (editing && keyValue === key) keyValue = "";
  const onCancelKey = () => {};
  return <div className="overflow-hidden rounded-2xl border border-black/5 bg-black/5 dark:border-white/5 dark:bg-white/5"><div className="flex items-center gap-2 px-3 py-2.5"><button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">{icon("expand_more", `text-[15px] text-zinc-500 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`)}{icon("link", "text-[18px] text-primary")}<span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{endpoint.name || "OpenAI Compatible"}</span>{endpoint.modelId.trim() ? <code className="min-w-0 truncate font-mono text-[10px] text-zinc-500">{endpoint.modelId}</code> : null}</button><button type="button" onClick={onRemove} title="Remove provider" className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500">{icon("close", "text-[14px]")}</button></div>{expanded ? <div className="space-y-2.5 border-t border-black/5 px-3 py-3 dark:border-white/5"><TextField label="Name" value={endpoint.name} placeholder="My endpoint" onBlur={(value) => onPatch({ name: value })} /><label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-zinc-500">Base URL</span><div className="flex gap-1.5"><input defaultValue={endpoint.baseUrl} onBlur={(event) => onPatch({ baseUrl: event.currentTarget.value.trim() })} placeholder="https://api.example.com/v1" spellCheck={false} className="min-w-0 flex-1 rounded-xl border border-transparent bg-white/60 px-3 py-2 font-mono text-[11px] text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200" /><button type="button" onClick={(event) => onTest((event.currentTarget.parentElement?.querySelector("input") as HTMLInputElement)?.value ?? "")} className="rounded-xl border border-zinc-300/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:border-primary/30 hover:text-primary dark:border-zinc-700">Test</button></div><span className="provider-test-status mt-1 block text-[10px] text-zinc-500">{testing ?? ""}</span></label><TextField label="Model ID" value={endpoint.modelId} placeholder="gpt-4o, qwen3-max, glm-4.6" onBlur={(value) => onPatch({ modelId: value })} mono /><TextField label="Image model ID" value={endpoint.imageModelId} placeholder="Image model ID (optional)" onBlur={(value) => onPatch({ imageModelId: value })} mono /><TextField label="Context" value={String(endpoint.contextLimit)} placeholder="128000" onBlur={(value) => { const contextLimit = Number.parseInt(value, 10); onPatch({ contextLimit: Number.isFinite(contextLimit) && contextLimit >= 1000 ? contextLimit : 128000 }); }} mono /><KeyField provider={{ id: `custom:${endpoint.id}`, label: "", type: "cloud", docs: "", icon: "key" }} keyValue={keyValue} editing={editing} onChange={onKeyValue} onSave={onSaveKey} onEdit={onEditKey} onCancel={onCancelKey} onClear={onClearKey} /></div> : null}</div>;
}

function TextField({ label, value, placeholder, onBlur, mono = false }: { label: string; value: string; placeholder: string; onBlur: (value: string) => void; mono?: boolean }) {
  return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</span><input defaultValue={value} onBlur={(event) => onBlur(event.currentTarget.value.trim())} placeholder={placeholder} spellCheck={false} className={`w-full rounded-xl border border-transparent bg-white/60 px-3 py-2 text-[11px] text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 dark:bg-zinc-900/50 dark:text-zinc-200${mono ? " font-mono" : ""}`} /></label>;
}

async function loadStoredSettings() {
  const read = async (key: string) => {
    const value = localStorage.getItem(key);
    if (!value) return null;
    try { return await decryptData({ encryptedData: value }); } catch { return null; }
  };
  const stored = await read(AI_SETTINGS_KEY) ?? await read(LEGACY_AI_SETTINGS_KEY);
  if (stored) {
    try { return normalizeAiSettings(JSON.parse(stored)); } catch { /* fall through to defaults */ }
  }
  const next = cloneDefaults();
  const legacyKey = await read(LEGACY_OPENAI_KEY);
  if (legacyKey) next.providerKeys.openai = legacyKey;
  return next;
}
