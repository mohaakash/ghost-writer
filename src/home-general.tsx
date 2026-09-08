import { useEffect, useRef, useState } from "react";
import { applyAppearance, loadAppearance, saveAppearance, type AppearanceSettings } from "./lib/appearance";
import { formatShortcutKey } from "./lib/presentation-domain";
import { configureShortcuts } from "./lib/tauri-commands";
import { onAppearanceChanged } from "./lib/tauri-events";
import { SettingsFrame, type PreferencesTab } from "./home-models";

type ToastType = "info" | "success" | "error";

interface GeneralSettingsProps {
  onClose: () => void;
  fallbackToLegacy: (view?: string) => void;
  onSelectTab: (tab: PreferencesTab) => void;
  showToast: (message: string, type?: ToastType) => void;
}

const DEFAULT_APP_SHORTCUT = "Ctrl+Shift+U";
const DEFAULT_CLIPBOARD_SHORTCUT = "Ctrl+Shift+V";

function readStorage(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function themeLabel(theme: AppearanceSettings["theme"], language: string) {
  if (theme === "dark") return language === "ar" ? "داكن" : language === "fr" ? "Sombre" : "Dark";
  return language === "ar" ? "فاتح" : language === "fr" ? "Clair" : "Light";
}

/** General preferences staged against the exact legacy settings panel. */
export function GeneralSettings({ onClose, fallbackToLegacy, onSelectTab, showToast }: GeneralSettingsProps) {
  const [shortcut, setShortcut] = useState(() => readStorage("app_shortcut", DEFAULT_APP_SHORTCUT));
  const [clipboardShortcut] = useState(() => readStorage("clipboard_shortcut", DEFAULT_CLIPBOARD_SHORTCUT));
  const [recording, setRecording] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => loadAppearance());
  const [language, setLanguage] = useState(() => readStorage("app_lang", "en"));
  const languageSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    applyAppearance(appearance);
    let dispose: (() => void) | undefined;
    void onAppearanceChanged((next) => {
      setAppearance(next);
      applyAppearance(next);
    }).then((cleanup) => { dispose = cleanup; }).catch(() => {});
    return () => dispose?.();
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
      void configureShortcuts({ appShortcut: nextShortcut, clipboardShortcut }).then(() => {
        try { localStorage.setItem("app_shortcut", nextShortcut); } catch { /* keep the native shortcut even if storage is unavailable */ }
        setShortcut(nextShortcut);
        showToast(`Shortcut set to ${nextShortcut}`, "success");
      }).catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Could not register shortcut", "error");
      });
    };
    window.addEventListener("keydown", handleKeys, true);
    return () => window.removeEventListener("keydown", handleKeys, true);
  }, [clipboardShortcut, recording, showToast]);

  function updateAppearance(patch: Partial<AppearanceSettings>) {
    try {
      setAppearance(saveAppearance(patch));
    } catch (error) {
      showToast(`Could not save appearance: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  function openLanguagePicker() {
    const select = languageSelectRef.current as (HTMLSelectElement & { showPicker?: () => void }) | null;
    if (!select) return;
    if (select.showPicker) select.showPicker();
    else select.focus();
  }

  function changeLanguage(nextLanguage: string) {
    setLanguage(nextLanguage);
    try { localStorage.setItem("app_lang", nextLanguage); } catch { /* legacy translation remains the fallback */ }
    // The complete translation catalogue still belongs to the legacy owner.
    // Hand off this interaction so every visible label updates together.
    fallbackToLegacy("settings");
    window.setTimeout(() => {
      const legacy = window as Window & {
        changeLanguage?: (value: string) => void;
        selectSettingsTab?: (value: string) => void;
      };
      legacy.changeLanguage?.(nextLanguage);
      legacy.selectSettingsTab?.("general");
    }, 0);
  }

  return (
    <SettingsFrame onClose={onClose} fallbackToLegacy={fallbackToLegacy} activeTab="general" onSelectTab={onSelectTab}>
      <section id="settings-general-panel" className="space-y-5 px-1 pt-2 pb-4">
        <div className="mt-2 space-y-2">
          <label data-i18n="global_shortcut" className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-white">Global Shortcut</label>
          <button id="shortcut-recorder" type="button" onClick={() => setRecording(true)} className="group flex w-full items-center justify-between rounded-xl border border-transparent bg-black/5 px-4 py-3 text-sm transition-all hover:border-primary/20 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <span className={`material-icons-outlined text-[20px] ${recording ? "text-primary" : "text-zinc-400 group-hover:text-primary"}`}>keyboard</span>
              <span id="shortcut-display" className={`font-bold text-zinc-800 dark:text-zinc-200${recording ? " text-primary" : ""}`}>{recording ? "..." : shortcut}</span>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Edit</span>
          </button>
        </div>

        <div className="space-y-2">
          <label data-i18n="appearance" className="ml-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Appearance</label>
          <button type="button" onClick={() => updateAppearance({ theme: appearance.theme === "dark" ? "light" : "dark" })} className="group flex w-full items-center justify-between rounded-xl border border-transparent bg-black/5 px-4 py-3 text-sm transition-all hover:border-primary/20 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <span className="material-icons-outlined text-[20px] text-zinc-500 group-hover:text-primary dark:text-zinc-400">dark_mode</span>
              <span data-i18n="interface_theme" className="font-medium text-zinc-800 dark:text-zinc-200">Interface Theme</span>
            </div>
            <span id="theme-label" className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-zinc-500">{themeLabel(appearance.theme, language)}</span>
          </button>

          <button type="button" onClick={openLanguagePicker} className="group flex w-full items-center justify-between rounded-xl border border-transparent bg-black/5 px-4 py-3 text-sm transition-all hover:border-primary/20 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <span className="material-icons-outlined text-[20px] text-zinc-500 group-hover:text-primary dark:text-zinc-400">language</span>
              <span data-i18n="language" className="font-medium text-zinc-800 dark:text-zinc-200">Language</span>
            </div>
            <select id="language-select" ref={languageSelectRef} value={language} onChange={(event) => changeLanguage(event.target.value)} onClick={(event) => event.stopPropagation()} className="cursor-pointer bg-transparent p-0 text-right text-[10px] font-bold uppercase text-zinc-500 outline-none">
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </button>
        </div>

        <div className="rounded-2xl border border-black/5 bg-black/5 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="mb-3 flex items-center gap-2"><span className="material-icons-outlined text-[18px] text-primary">blur_on</span><span data-i18n="window_effects" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Window effects</span></div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-white/40 px-3 py-2.5 dark:bg-zinc-900/40">
            <span className="min-w-0"><span data-i18n="acrylic_blur" className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">Acrylic blur</span><span data-i18n="acrylic_blur_help" className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">Frosted-glass backdrop across all windows.</span></span>
            <input id="appearance-acrylic" type="checkbox" checked={appearance.acrylic} onChange={(event) => updateAppearance({ acrylic: event.target.checked })} className="h-4 w-4 shrink-0 rounded border-zinc-300 text-primary focus:ring-primary/30 dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <div className="mt-2 rounded-xl bg-white/40 px-3 py-2.5 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between gap-3"><span className="min-w-0"><span data-i18n="blur_amount" className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">Blur amount</span><span data-i18n="blur_amount_help" className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">Strength of the frosted-glass effect.</span></span><span id="appearance-blur-value" className="shrink-0 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{appearance.blurAmount}px</span></div>
            <input id="appearance-blur" type="range" min="0" max="40" step="1" value={appearance.blurAmount} onChange={(event) => updateAppearance({ blurAmount: Number(event.target.value) })} className="mt-2 w-full accent-primary" />
          </div>
          <div className="mt-2 rounded-xl bg-white/40 px-3 py-2.5 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between gap-3"><span className="min-w-0"><span data-i18n="transparency" className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">Transparency</span><span data-i18n="transparency_help" className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">Opacity of the window background.</span></span><span id="appearance-transparency-value" className="shrink-0 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{appearance.transparency}%</span></div>
            <input id="appearance-transparency" type="range" min="0" max="100" step="1" value={appearance.transparency} onChange={(event) => updateAppearance({ transparency: Number(event.target.value) })} className="mt-2 w-full accent-primary" />
          </div>
        </div>
      </section>
    </SettingsFrame>
  );
}
