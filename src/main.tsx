import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./appearance.js";
import "./styles.css";
import { GlassWindow } from "./components/primitives";
import { ClipboardPage } from "./clipboard";
import { HomePage } from "./home";
import { installLegacyServices } from "./lib/legacy-adapter";
import { isReactClipboardEnabled, isReactHomeAiEnabled, isReactHomeClipboardEnabled, isReactHomeEnabled, isReactHomeGeneralEnabled, isReactHomeModelsEnabled, isReactNotepadEnabled, REACT_HOME_FLAG } from "./lib/migration-flags";
import { NotepadPage } from "./notepad";

installLegacyServices();

function ReactRuntime() {
  return (
    <GlassWindow
      aria-hidden="true"
      data-react-runtime="true"
      className="hidden"
    />
  );
}

const isNotepadPage = Boolean(document.querySelector(".notepad-shell"));
const isClipboardPage = Boolean(document.querySelector(".clipboard-shell"));
const isHomePage = Boolean(document.querySelector("#floating-menu"));
if (isHomePage && isReactHomeEnabled()) {
  const legacyShell = document.getElementById("floating-menu");
  const legacyToast = document.getElementById("toast");
  legacyShell?.setAttribute("hidden", "true");
  legacyShell?.setAttribute("aria-hidden", "true");
  legacyToast?.setAttribute("hidden", "true");
  legacyToast?.setAttribute("aria-hidden", "true");
  const host = document.createElement("div");
  host.id = "react-home-root";
  host.style.position = "fixed";
  host.style.inset = "0";
  document.body.appendChild(host);
  const root = createRoot(host);
  const fallbackToLegacy = (view = "menu") => {
    root.unmount();
    host.remove();
    legacyShell?.removeAttribute("hidden");
    legacyToast?.removeAttribute("hidden");
    legacyShell?.removeAttribute("aria-hidden");
    legacyToast?.removeAttribute("aria-hidden");
    try { localStorage.removeItem(REACT_HOME_FLAG); } catch { /* keep the fallback available if storage is unavailable */ }
    window.setTimeout(() => (window as Window & { showView?: (nextView: string) => void }).showView?.(view), 0);
  };
  root.render(<StrictMode><HomePage fallbackToLegacy={fallbackToLegacy} modelsEnabled={isReactHomeModelsEnabled()} generalEnabled={isReactHomeGeneralEnabled()} clipboardSettingsEnabled={isReactHomeClipboardEnabled()} aiEnabled={isReactHomeAiEnabled()} /></StrictMode>);
} else if (isNotepadPage && isReactNotepadEnabled()) {
  document.querySelector(".notepad-shell")?.setAttribute("hidden", "true");
  document.getElementById("toast")?.setAttribute("hidden", "true");
  const host = document.createElement("div");
  host.id = "react-notepad-root";
  host.style.position = "fixed";
  host.style.inset = "0";
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><NotepadPage /></StrictMode>);
} else if (isClipboardPage && isReactClipboardEnabled()) {
  document.querySelector(".clipboard-shell")?.setAttribute("hidden", "true");
  document.getElementById("toast")?.setAttribute("hidden", "true");
  const host = document.createElement("div");
  host.id = "react-clipboard-root";
  host.style.position = "fixed";
  host.style.inset = "0";
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><ClipboardPage /></StrictMode>);
} else {
  const host = document.createElement("span");
  host.id = "react-runtime";
  host.style.display = "none";
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><ReactRuntime /></StrictMode>);
}
