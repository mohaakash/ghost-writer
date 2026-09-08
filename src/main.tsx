import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./appearance.js";
import "./styles.css";
import { GlassWindow } from "./components/primitives";
import { installLegacyServices } from "./lib/legacy-adapter";
import { isReactNotepadEnabled } from "./lib/migration-flags";
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
if (isNotepadPage && isReactNotepadEnabled()) {
  document.querySelector(".notepad-shell")?.setAttribute("hidden", "true");
  document.getElementById("toast")?.setAttribute("hidden", "true");
  const host = document.createElement("div");
  host.id = "react-notepad-root";
  host.style.position = "fixed";
  host.style.inset = "0";
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><NotepadPage /></StrictMode>);
} else {
  const host = document.createElement("span");
  host.id = "react-runtime";
  host.style.display = "none";
  document.body.appendChild(host);
  createRoot(host).render(<StrictMode><ReactRuntime /></StrictMode>);
}
