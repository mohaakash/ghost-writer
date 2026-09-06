import { STORAGE_KEYS } from "./contracts";

export type Theme = "dark" | "light";

export interface AppearanceSettings {
  theme: Theme;
  acrylic: boolean;
  blurAmount: number;
  transparency: number;
}

export const APPEARANCE_KEY = STORAGE_KEYS.appearance;
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  acrylic: true,
  blurAmount: 20,
  transparency: 95,
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

/** Match the legacy appearance.js normalization exactly, including 0 values. */
export function normalizeAppearance(value: unknown): AppearanceSettings {
  const input = value && typeof value === "object" ? value as Partial<AppearanceSettings> : {};
  return {
    theme: input.theme === "light" ? "light" : "dark",
    acrylic: input.acrylic !== false,
    blurAmount: clamp(input.blurAmount, 0, 40, DEFAULT_APPEARANCE.blurAmount),
    transparency: clamp(input.transparency, 0, 100, DEFAULT_APPEARANCE.transparency),
  };
}
