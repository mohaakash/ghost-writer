import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  type AppearanceSettings,
} from "./appearance-domain";

export { APPEARANCE_KEY, DEFAULT_APPEARANCE, normalizeAppearance } from "./appearance-domain";
export type { AppearanceSettings, Theme } from "./appearance-domain";

export function loadAppearance(): AppearanceSettings {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? "{}"));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function applyAppearance(settings: AppearanceSettings) {
  const root = document.documentElement;
  root.classList.toggle("dark", settings.theme === "dark");
  root.classList.toggle("light", settings.theme === "light");
  root.classList.toggle("no-acrylic", !settings.acrylic);
  root.style.setProperty("--glass-blur", `${settings.blurAmount}px`);
  root.style.setProperty("--glass-alpha", (settings.transparency / 100).toFixed(3));
  root.style.setProperty(
    "--frost-opacity",
    settings.acrylic && settings.blurAmount > 0
      ? String(Math.min(0.16, 0.05 + settings.blurAmount / 40 * 0.11))
      : "0",
  );
}

export function saveAppearance(patch: Partial<AppearanceSettings>): AppearanceSettings {
  const settings = normalizeAppearance({ ...loadAppearance(), ...patch });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings));
  applyAppearance(settings);
  window.dispatchEvent(new CustomEvent("appearancechange", { detail: settings }));
  try {
    void window.__TAURI__?.event?.emit?.("appearance-changed", settings);
  } catch {
    // Browser preview has no Tauri event bridge.
  }
  return settings;
}
