import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Pone un identificador de compilación en dist/sw.js. Así cada publicación usa una caché
 * nueva y el service worker borra la anterior (antes la caché crecía con cada deploy).
 */
function swBuildId() {
  let outDir = "dist";
  return {
    name: "xtats-sw-build-id",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, "sw.js");
      const id = Date.now().toString(36);
      writeFileSync(file, readFileSync(file, "utf8").replaceAll("__BUILD_ID__", id));
    },
  };
}

export default defineConfig({
  plugins: [react(), swBuildId()],
  build: {
    rollupOptions: {
      output: {
        // Librerías en archivos aparte: cambian poco y el navegador las mantiene en caché entre deploys
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (id.includes("node_modules/@supabase/")) return "supabase";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
