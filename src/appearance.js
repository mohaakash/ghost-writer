/* Ghost Writer — Unified appearance settings (theme, acrylic, blur, transparency).
   Shared across the home, clipboard and notepad windows. Settings live in
   localStorage, so any window change is applied everywhere via storage events. */
(function () {
  "use strict";

  var EVENT_NAME = "appearance-changed";
  var KEY = "ghost_writer_appearance_v1";
  var DEFAULTS = {
    theme: "dark", // "dark" | "light"
    acrylic: true, // frosted-glass backdrop blur on/off
    blurAmount: 20, // backdrop blur amount in px (0-40)
    transparency: 95, // shell background opacity percent (0-100)
  };

  function clamp(value, min, max, fallback) {
    return typeof value === "number" && isFinite(value)
      ? Math.min(max, Math.max(min, Math.round(value)))
      : fallback;
  }

  function normalize(value) {
    var s = value && typeof value === "object" ? value : {};
    return {
      theme: s.theme === "light" ? "light" : "dark",
      acrylic: s.acrylic !== false,
      blurAmount: clamp(s.blurAmount, 0, 40, DEFAULTS.blurAmount),
      transparency: clamp(s.transparency, 0, 100, DEFAULTS.transparency),
    };
  }

  function load() {
    try {
      return normalize(JSON.parse(localStorage.getItem(KEY) || "{}"));
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  var settings = load();

  function injectStyles() {
    if (document.getElementById("appearance-style")) return;
    var style = document.createElement("style");
    style.id = "appearance-style";
    style.textContent =
      ":root{" +
      "--glass-blur:20px;" +
      "--glass-alpha:0.95;" +
      "--frost-opacity:0;" +
      "}" +
      ".glass-effect{" +
      "backdrop-filter:blur(var(--glass-blur,20px)) saturate(180%) !important;" +
      "-webkit-backdrop-filter:blur(var(--glass-blur,20px)) saturate(180%) !important;" +
      "}" +
      "html.no-acrylic .glass-effect{" +
      "backdrop-filter:none !important;-webkit-backdrop-filter:none !important;" +
      "}" +
      "html.no-acrylic .bottom-sheet-overlay," +
      "html.no-acrylic [class*=\"backdrop-blur\"]{" +
      "backdrop-filter:none !important;-webkit-backdrop-filter:none !important;" +
      "}" +
      ".app-shell{" +
      "position:relative;isolation:isolate;" +
      "background-color:rgba(255,255,255,var(--glass-alpha,0.95));" +
      "}" +
      "html.dark .app-shell{" +
      "background-color:rgba(28,28,30,var(--glass-alpha,0.95));" +
      "}" +
      ".app-frost{" +
      "position:absolute;inset:0;z-index:-1;pointer-events:none;" +
      "opacity:var(--frost-opacity,0);transition:opacity 150ms ease;" +
      "background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>\"),linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.025) 45%,rgba(255,255,255,0) 80%);" +
      "background-repeat:repeat,no-repeat;" +
      "background-size:180px 180px,100% 100%;" +
      "}" +
      "html.dark .app-frost{" +
      "background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>\"),linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015) 45%,rgba(255,255,255,0) 80%);" +
      "}";
    document.head.appendChild(style);
  }

  function ensureFrost() {
    document.querySelectorAll(".app-shell").forEach(function (shell) {
      if (!shell.querySelector(".app-frost")) {
        var el = document.createElement("div");
        el.className = "app-frost";
        el.setAttribute("aria-hidden", "true");
        shell.insertBefore(el, shell.firstChild);
      }
    });
  }

  function apply() {
    var root = document.documentElement;
    if (!root) return;
    injectStyles();
    ensureFrost();
    root.classList.toggle("dark", settings.theme === "dark");
    root.classList.toggle("no-acrylic", !settings.acrylic);
    root.style.setProperty("--glass-blur", settings.blurAmount + "px");
    root.style.setProperty("--glass-alpha", (settings.transparency / 100).toFixed(3));
    var frost = settings.acrylic && settings.blurAmount > 0
      ? Math.min(0.16, 0.05 + (settings.blurAmount / 40) * 0.11)
      : 0;
    root.style.setProperty("--frost-opacity", frost.toFixed(3));
  }

  function get() {
    return { ...settings };
  }

  function set(patch) {
    settings = normalize({ ...settings, ...(patch || {}) });
    apply();
    localStorage.setItem(KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("appearancechange", { detail: get() }));
    emitEvent();
  }

  /* Tauri event bridging: realtime cross-window sync regardless of platform
     (storage events are unreliable between webviews on some platforms). */
  function emitEvent() {
    try {
      const emitter = window.__TAURI__?.event?.emit;
      if (emitter) emitter(EVENT_NAME, get());
    } catch (e) {
      /* Tauri unavailable — storage events still cover same-origin windows */
    }
  }

  try {
    const listener = window.__TAURI__?.event?.listen;
    if (listener) {
      listener(EVENT_NAME, (event) => {
        const incoming = event && event.payload;
        if (incoming && typeof incoming === "object") {
          settings = normalize(incoming);
          apply();
          window.dispatchEvent(new CustomEvent("appearancechange", { detail: get() }));
        }
      });
    }
  } catch (e) {
    /* non-Tauri context */
  }

  window.addEventListener("storage", function (event) {
    if (event.key === KEY) {
      settings = load();
      apply();
      window.dispatchEvent(new CustomEvent("appearancechange", { detail: get() }));
    }
  });

  window.addEventListener("focus", function () {
    settings = load();
    apply();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      settings = load();
      apply();
    }
  });

  var Appearance = {
    KEY: KEY,
    DEFAULTS: { ...DEFAULTS },
    get: get,
    set: set,
    apply: apply,
  };
  window.Appearance = Appearance;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();