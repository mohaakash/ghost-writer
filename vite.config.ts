import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  root: "src",
  // Tauri serves packaged assets from its app protocol rather than the web root.
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "src/index.html"),
        notepad: resolve(process.cwd(), "src/notepad.html"),
        clipboard: resolve(process.cwd(), "src/clipboard.html"),
      },
    },
  },
});
