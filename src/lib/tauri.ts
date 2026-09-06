import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import type { MouseEvent } from "react";

/** A single typed boundary keeps browser previews and Tauri windows working alike. */
export async function invoke<T = unknown>(command: string, args?: object): Promise<T> {
  const bridge = window.__TAURI__?.core?.invoke;
  if (bridge) return bridge<T>(command, args as Record<string, unknown> | undefined);
  try {
    return await tauriInvoke<T>(command, args as Record<string, unknown> | undefined);
  } catch (error) {
    throw new Error(`Tauri command '${command}' is unavailable outside the desktop shell: ${String(error)}`);
  }
}

export async function listen<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  const bridge = window.__TAURI__?.event?.listen;
  if (bridge) {
    const unlisten = await bridge<T>(event, (message) => handler(message.payload));
    return unlisten;
  }
  const unlisten = await tauriListen<T>(event, (message) => handler(message.payload));
  return unlisten;
}

export function currentWindow() {
  return window.__TAURI__?.window?.getCurrentWindow?.();
}

export async function startDragging(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0) return;
  const target = event.target as HTMLElement;
  if (target.closest("button, input, textarea, select, a, [data-no-drag]")) return;
  await currentWindow()?.startDragging?.();
}
