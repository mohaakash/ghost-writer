import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event";

declare global {
  interface Window {
    __TAURI__?: {
      core?: { invoke: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T> };
      event?: { listen: <T = unknown>(event: string, handler: EventCallback<T>) => Promise<UnlistenFn>; emit?: (event: string, payload?: unknown) => Promise<void> };
      window?: { getCurrentWindow?: () => { hide?: () => Promise<void>; show?: () => Promise<void>; setFocus?: () => Promise<void>; startDragging?: () => Promise<void> } };
    };
  }
}

export {};
