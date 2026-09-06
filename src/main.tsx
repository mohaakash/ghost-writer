import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./appearance.js";
import "./styles.css";
import { installLegacyServices } from "./lib/legacy-adapter";

installLegacyServices();

function ReactRuntime() {
  return <span aria-hidden="true" data-react-runtime="true" style={{ display: "none" }} />;
}

const host = document.createElement("span");
host.id = "react-runtime";
host.style.display = "none";
document.body.appendChild(host);

createRoot(host).render(
  <StrictMode>
    <ReactRuntime />
  </StrictMode>,
);
