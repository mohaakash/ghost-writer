import { STORAGE_KEYS } from "./contracts";

export const AI_SETTINGS_KEY = STORAGE_KEYS.aiSettings;
export const LEGACY_AI_SETTINGS_KEY = STORAGE_KEYS.legacyAiSettings;
export const LEGACY_OPENAI_KEY = STORAGE_KEYS.legacyOpenAiKey;

export const IMAGE_MODEL_IDS = [
  "gpt-image-2",
  "gpt-image-1",
  "dall-e-3",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
  "grok-imagine-image-2.0",
  "bytedance-seed/seedream-4.5",
  "black-forest-labs/flux.2-pro",
] as const;

export type ImageModelId = typeof IMAGE_MODEL_IDS[number];

export interface ProviderConfig {
  baseUrl?: string;
  modelId?: string;
  imageModelId?: string;
}

export interface CustomEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  modelId: string;
  imageModelId: string;
  contextLimit: number;
}

export interface AiSettings {
  version: number;
  selectedProvider: string;
  selectedModel: string;
  selectedEndpointId: string;
  imageProvider: string;
  imageModel: ImageModelId;
  imageEndpointId: string;
  providerKeys: Record<string, string>;
  providerConfig: Record<string, ProviderConfig>;
  customEndpoints: CustomEndpoint[];
  addingProviders: string[];
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  version: 2,
  selectedProvider: "openai",
  selectedModel: "gpt-4.1-mini",
  selectedEndpointId: "",
  imageProvider: "openai",
  imageModel: "gpt-image-2",
  imageEndpointId: "",
  providerKeys: {},
  providerConfig: {
    openrouter: { modelId: "", imageModelId: "" },
    lmstudio: { baseUrl: "http://localhost:1234/v1", modelId: "" },
    mlx: { baseUrl: "http://127.0.0.1:8080/v1", modelId: "" },
    ollama: { baseUrl: "http://localhost:11434/v1", modelId: "" },
  },
  customEndpoints: [],
  addingProviders: ["openai"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProviderConfig(value: unknown, fallback: ProviderConfig): ProviderConfig {
  const incoming = isRecord(value) ? value : {};
  return { ...fallback, ...incoming } as ProviderConfig;
}

/** Match the legacy settings migration shape while keeping it pure and testable. */
export function normalizeAiSettings(value: unknown): AiSettings {
  const incoming = isRecord(value) ? value : {};
  const providerConfigInput = isRecord(incoming.providerConfig) ? incoming.providerConfig : {};
  const providerConfig: Record<string, ProviderConfig> = {
    ...DEFAULT_AI_SETTINGS.providerConfig,
    ...(providerConfigInput as Record<string, ProviderConfig>),
  };
  for (const id of Object.keys(DEFAULT_AI_SETTINGS.providerConfig)) {
    providerConfig[id] = normalizeProviderConfig(providerConfig[id], DEFAULT_AI_SETTINGS.providerConfig[id]);
  }

  const customEndpoints = Array.isArray(incoming.customEndpoints)
    ? incoming.customEndpoints
        .filter((endpoint): endpoint is Record<string, unknown> => isRecord(endpoint) && Boolean(endpoint.id))
        .map((endpoint) => ({
          id: String(endpoint.id),
          name: String(endpoint.name || ""),
          baseUrl: String(endpoint.baseUrl || endpoint.baseURL || ""),
          modelId: String(endpoint.modelId || ""),
          imageModelId: String(endpoint.imageModelId || ""),
          contextLimit: Number(endpoint.contextLimit) || 128000,
        }))
    : [];

  const imageModel = IMAGE_MODEL_IDS.includes(incoming.imageModel as ImageModelId)
    ? incoming.imageModel as ImageModelId
    : DEFAULT_AI_SETTINGS.imageModel;
  const providerKeys = isRecord(incoming.providerKeys) ? incoming.providerKeys as Record<string, string> : {};
  const addingProviders = Array.isArray(incoming.addingProviders)
    ? incoming.addingProviders as string[]
    : DEFAULT_AI_SETTINGS.addingProviders;

  return {
    ...DEFAULT_AI_SETTINGS,
    ...incoming,
    imageModel,
    imageProvider: String(incoming.imageProvider || DEFAULT_AI_SETTINGS.imageProvider),
    imageEndpointId: String(incoming.imageEndpointId || ""),
    providerKeys,
    providerConfig,
    customEndpoints,
    addingProviders,
  } as AiSettings;
}

export function providerNeedsKey(id: string, localProviderIds = ["lmstudio", "mlx", "ollama"]): boolean {
  if (id === "openai-compatible" || id.startsWith("custom:")) return false;
  return !localProviderIds.includes(id);
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(8)}${key.slice(-4)}`;
}
