import {
  applyAppearance,
  loadAppearance,
  saveAppearance,
} from "./appearance";
import {
  addClipboardItem,
  normalizeClipboardHistory,
  normalizeClipboardSettings,
  sortClipboardItems,
  trimClipboardHistory,
} from "./clipboard-domain";
import {
  maskApiKey,
  normalizeAiSettings,
  providerNeedsKey,
  DEFAULT_AI_SETTINGS,
} from "./ai-domain";
import {
  formatLength,
  formatShortcutKey,
  formatTime,
  generatedImageDataUrl,
  historyGroupLabel,
  translate,
} from "./presentation-domain";
import * as tauriCommands from "./tauri-commands";
import * as tauriEvents from "./tauri-events";

export interface LegacyServices {
  appearance: { apply: typeof applyAppearance; load: typeof loadAppearance; save: typeof saveAppearance };
  clipboard: {
    add: typeof addClipboardItem;
    normalizeHistory: typeof normalizeClipboardHistory;
    normalizeSettings: typeof normalizeClipboardSettings;
    sort: typeof sortClipboardItems;
    trim: typeof trimClipboardHistory;
  };
  ai: {
    defaults: typeof DEFAULT_AI_SETTINGS;
    maskApiKey: typeof maskApiKey;
    normalizeSettings: typeof normalizeAiSettings;
    providerNeedsKey: typeof providerNeedsKey;
  };
  presentation: {
    formatLength: typeof formatLength;
    formatShortcutKey: typeof formatShortcutKey;
    formatTime: typeof formatTime;
    generatedImageDataUrl: typeof generatedImageDataUrl;
    historyGroupLabel: typeof historyGroupLabel;
    translate: typeof translate;
  };
  tauri: typeof tauriCommands;
  events: typeof tauriEvents;
}

declare global {
  interface Window {
    GhostWriterServices?: LegacyServices;
  }
}

/**
 * Expose the typed services to the still-vanilla pages. Inline handlers can
 * adopt one helper at a time while their existing fallback remains available
 * during the migration.
 */
export function installLegacyServices() {
  window.GhostWriterServices = {
    appearance: { apply: applyAppearance, load: loadAppearance, save: saveAppearance },
    clipboard: {
      add: addClipboardItem,
      normalizeHistory: normalizeClipboardHistory,
      normalizeSettings: normalizeClipboardSettings,
      sort: sortClipboardItems,
      trim: trimClipboardHistory,
    },
    ai: {
      defaults: DEFAULT_AI_SETTINGS,
      maskApiKey,
      normalizeSettings: normalizeAiSettings,
      providerNeedsKey,
    },
    presentation: {
      formatLength,
      formatShortcutKey,
      formatTime,
      generatedImageDataUrl,
      historyGroupLabel,
      translate,
    },
    tauri: tauriCommands,
    events: tauriEvents,
  };
}
