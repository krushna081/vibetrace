import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const src = resolve(root, "src");
const dist = resolve(root, "dist");
const repoEnvDir = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Two builds are required for a Manifest V3 extension:
 *  - the page/service-worker build emits popup, sidepanel and the module worker;
 *  - the content build emits a classic IIFE script because MV3 content scripts
 *    injected via chrome.scripting.executeScript are not ES modules.
 */
export default defineConfig(({ mode }) => {
  if (mode === "content") {
    return {
      root: src,
      publicDir: false,
      envDir: repoEnvDir,
      build: {
        outDir: dist,
        emptyOutDir: false,
        target: "chrome116",
        minify: "esbuild",
        lib: {
          entry: resolve(src, "content/content.ts"),
          name: "VibeTraceContent",
          formats: ["iife"],
          fileName: () => "content.js",
        },
        rollupOptions: {
          output: { extend: true },
        },
      },
    };
  }

  return {
    root: src,
    publicDir: resolve(root, "public"),
    envDir: repoEnvDir,
    plugins: [react()],
    base: "/",
    build: {
      outDir: dist,
      emptyOutDir: true,
      target: "chrome116",
      sourcemap: false,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        input: {
          popup: resolve(src, "popup/index.html"),
          sidepanel: resolve(src, "sidepanel/index.html"),
          background: resolve(src, "background.ts"),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  };
});
